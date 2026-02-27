package git

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
)

const (
	waitTimeoutDefault  = 60 * time.Second
	waitIntervalDefault = 100 * time.Millisecond
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// gitTestHelper wraps the standard test helper with git-specific functionality
type gitTestHelper struct {
	*apis.K8sTestHelper
	gitServer      *gittest.Server
	Repositories   *apis.K8sResourceClient
	AdminREST      *rest.RESTClient
	EditorREST     *rest.RESTClient
	ViewerREST     *rest.RESTClient
	DashboardsV1   *apis.K8sResourceClient
}

func runGrafanaWithGitServer(t *testing.T) *gitTestHelper {
	t.Helper()

	ctx := context.Background()

	// Start git server using gittest
	gitServer, err := gittest.NewServer(ctx, gittest.WithLogger(gittest.NewTestLogger(t)))
	require.NoError(t, err, "failed to start git server")
	t.Cleanup(func() {
		if err := gitServer.Cleanup(); err != nil {
			t.Logf("failed to cleanup git server: %v", err)
		}
	})

	// Start Grafana with provisioning enabled
	opts := testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagProvisioningExport,
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode:  grafanarest.Mode5,
				EnableMigration: true,
			},
			"folders.folder.grafana.app": {
				DualWriterMode:  grafanarest.Mode5,
				EnableMigration: true,
			},
		},
		ProvisioningAllowedTargets: []string{"folder", "instance"},
	}

	k8s := apis.NewK8sTestHelper(t, opts)

	// Set up K8s resource clients
	repositories := k8s.GetResourceClient(apis.ResourceClientArgs{
		User:      k8s.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	dashboardsV1 := k8s.GetResourceClient(apis.ResourceClientArgs{
		User:      k8s.Org1.Admin,
		Namespace: "default",
		GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
	})

	// Get REST clients for different roles
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	adminClient := k8s.Org1.Admin.RESTClient(t, gv)
	editorClient := k8s.Org1.Editor.RESTClient(t, gv)
	viewerClient := k8s.Org1.Viewer.RESTClient(t, gv)

	helper := &gitTestHelper{
		K8sTestHelper: k8s,
		gitServer:     gitServer,
		Repositories:  repositories,
		DashboardsV1:  dashboardsV1,
		AdminREST:     adminClient,
		EditorREST:    editorClient,
		ViewerREST:    viewerClient,
	}

	return helper
}

// createGitRepo creates a git repository using gittest and registers it with Grafana provisioning
func (h *gitTestHelper) createGitRepo(t *testing.T, repoName string, initialFiles map[string][]byte) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	t.Helper()

	ctx := context.Background()

	// Create user and remote repository
	user, err := h.gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create user")

	remote, err := h.gitServer.CreateRepo(ctx, repoName, user)
	require.NoError(t, err, "failed to create remote repository")

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err, "failed to create local repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	// Initialize local repo with remote and initial commit
	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repo with remote")

	// Add initial files if provided
	for path, content := range initialFiles {
		err = local.CreateFile(path, string(content))
		require.NoError(t, err, "failed to create file %s", path)
	}

	if len(initialFiles) > 0 {
		_, err = local.Git("add", ".")
		require.NoError(t, err, "failed to add files")
		_, err = local.Git("commit", "-m", "Add initial files")
		require.NoError(t, err, "failed to commit files")
		_, err = local.Git("push")
		require.NoError(t, err, "failed to push files")
	}

	// Register repository with Grafana
	repoSpec := map[string]interface{}{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]interface{}{
			"name":      repoName,
			"namespace": "default",
		},
		"spec": map[string]interface{}{
			"title":       fmt.Sprintf("Test Repository %s", repoName),
			"description": fmt.Sprintf("Integration test repository for %s", repoName),
			"type":        "git",
			"git": map[string]interface{}{
				"url":       remote.URL,
				"branch":    "main",
				"path":      "",
				"tokenUser": user.Username,
			},
			"sync": map[string]interface{}{
				"enabled":         true,
				"target":          "instance",
				"intervalSeconds": 60,
			},
			"workflows": []string{"write"},
		},
		"secure": map[string]interface{}{
			"token": map[string]interface{}{
				"create": user.Password,
			},
		},
	}

	repoJSON, err := json.Marshal(repoSpec)
	require.NoError(t, err)

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Body(repoJSON).
		SetHeader("Content-Type", "application/json").
		Do(context.Background())

	require.NoError(t, result.Error(), "failed to create repository")

	// Wait for repository to be healthy
	h.waitForHealthyRepository(t, repoName)

	return remote, local
}

// waitForHealthyRepository waits for a repository to become healthy
func (h *gitTestHelper) waitForHealthyRepository(t *testing.T, repoName string) {
	t.Helper()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repo, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository") {
			return
		}

		// Check health status
		conditions, found, err := unstructured.NestedSlice(repo.Object, "status", "conditions")
		if !assert.NoError(collect, err) || !assert.True(collect, found, "conditions not found") {
			return
		}

		healthy := false
		for _, cond := range conditions {
			condMap := cond.(map[string]interface{})
			if condMap["type"] == "Health" && condMap["status"] == "True" {
				healthy = true
				break
			}
		}

		assert.True(collect, healthy, "repository not healthy")
	}, waitTimeoutDefault, waitIntervalDefault, "repository %s should become healthy", repoName)
}

// syncAndWait triggers a sync job and waits for it to complete
func (h *gitTestHelper) syncAndWait(t *testing.T, repoName string) {
	t.Helper()

	jobSpec := map[string]interface{}{
		"action": "pull",
		"pull":   map[string]interface{}{},
	}

	jobJSON, err := json.Marshal(jobSpec)
	require.NoError(t, err)

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(jobJSON).
		SetHeader("Content-Type", "application/json").
		Do(context.Background())

	if apierrors.IsAlreadyExists(result.Error()) {
		// Job already running, just wait
		h.waitForJobsComplete(t, repoName)
		return
	}

	require.NoError(t, result.Error(), "failed to trigger sync")
	h.waitForJobsComplete(t, repoName)
}

// waitForJobsComplete waits for all jobs for a repository to complete
func (h *gitTestHelper) waitForJobsComplete(t *testing.T, repoName string) {
	t.Helper()

	jobsClient := h.GetResourceClient(apis.ResourceClientArgs{
		User:      h.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
	})

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		jobs, err := jobsClient.Resource.List(context.Background(), metav1.ListOptions{})
		if !assert.NoError(collect, err, "failed to list jobs") {
			return
		}

		hasActiveJobs := false
		for _, job := range jobs.Items {
			labels := job.GetLabels()
			if labels["provisioning.grafana.app/repository"] == repoName {
				hasActiveJobs = true
				break
			}
		}

		assert.False(collect, hasActiveJobs, "jobs still active for repository %s", repoName)
	}, waitTimeoutDefault, waitIntervalDefault, "jobs should complete for repository %s", repoName)
}

func TestIntegrationGitFiles_CreateFile(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	repoName := "test-create-file"
	_, _ = helper.createGitRepo(t, repoName, nil)

	t.Run("create file on default branch", func(t *testing.T) {
		// Create a simple dashboard file
		dashboardContent := []byte(`{
			"uid": "test-dashboard-1",
			"title": "Test Dashboard 1",
			"schemaVersion": 39,
			"version": 1
		}`)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard1.json").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create file on default branch")

		// Verify file exists in repository
		fileObj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "dashboard1.json")
		require.NoError(t, err, "file should exist in repository")
		require.NotNil(t, fileObj)

		// Trigger sync and verify dashboard is created
		helper.syncAndWait(t, repoName)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if !assert.NoError(collect, err) {
				return
			}

			found := false
			for _, dash := range dashboards.Items {
				if dash.GetName() == "test-dashboard-1" {
					found = true
					assert.Equal(collect, repoName, dash.GetAnnotations()[utils.AnnoKeyManagerIdentity])
					break
				}
			}
			assert.True(collect, found, "dashboard should be synced to Grafana")
		}, waitTimeoutDefault, waitIntervalDefault, "dashboard should appear after sync")
	})

	t.Run("create file on new branch", func(t *testing.T) {
		branchName := "feature-branch"

		dashboardContent := []byte(`{
			"uid": "test-dashboard-2",
			"title": "Test Dashboard 2",
			"schemaVersion": 39,
			"version": 1
		}`)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("ref", branchName).
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create file on new branch")

		// Verify file exists on the branch
		fileObj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branchName,
		}, "files", "dashboard2.json")
		require.NoError(t, err, "file should exist on branch")
		require.NotNil(t, fileObj)
	})
}

func TestIntegrationGitFiles_UpdateFile(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	repoName := "test-update-file"
	initialContent := map[string][]byte{
		"dashboard.json": []byte(`{
			"uid": "test-dash",
			"title": "Original Title",
			"schemaVersion": 39,
			"version": 1
		}`),
	}

	_, _ = helper.createGitRepo(t, repoName, initialContent)
	helper.syncAndWait(t, repoName)

	t.Run("update file on default branch", func(t *testing.T) {
		updatedContent := []byte(`{
			"uid": "test-dash",
			"title": "Updated Title",
			"schemaVersion": 39,
			"version": 2
		}`)

		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard.json").
			Body(updatedContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on default branch")

		// Sync and verify update
		helper.syncAndWait(t, repoName)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboard, err := helper.DashboardsV1.Resource.Get(ctx, "test-dash", metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}

			title, _, err := unstructured.NestedString(dashboard.Object, "spec", "title")
			if !assert.NoError(collect, err) {
				return
			}

			assert.Equal(collect, "Updated Title", title, "dashboard title should be updated")
		}, waitTimeoutDefault, waitIntervalDefault, "dashboard should be updated after sync")
	})

	t.Run("update file on branch", func(t *testing.T) {
		branchName := "update-branch"

		updatedContent := []byte(`{
			"uid": "test-dash",
			"title": "Branch Update",
			"schemaVersion": 39,
			"version": 3
		}`)

		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard.json").
			Param("ref", branchName).
			Body(updatedContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on branch")

		// Verify the file was updated on the branch
		fileObj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branchName,
		}, "files", "dashboard.json")
		require.NoError(t, err, "file should exist on branch")
		require.NotNil(t, fileObj)
	})
}

func TestIntegrationGitFiles_DeleteFile(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	repoName := "test-delete-file"
	initialContent := map[string][]byte{
		"dashboard1.json": []byte(`{
			"uid": "dash-1",
			"title": "Dashboard 1",
			"schemaVersion": 39,
			"version": 1
		}`),
		"dashboard2.json": []byte(`{
			"uid": "dash-2",
			"title": "Dashboard 2",
			"schemaVersion": 39,
			"version": 1
		}`),
	}

	_, _ = helper.createGitRepo(t, repoName, initialContent)
	helper.syncAndWait(t, repoName)

	t.Run("delete file on default branch", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard1.json").
			Do(ctx)

		require.NoError(t, result.Error(), "should delete file on default branch")

		// Sync and verify dashboard is deleted
		helper.syncAndWait(t, repoName)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err := helper.DashboardsV1.Resource.Get(ctx, "dash-1", metav1.GetOptions{})
			assert.True(collect, apierrors.IsNotFound(err), "dashboard should be deleted from Grafana")
		}, waitTimeoutDefault, waitIntervalDefault, "dashboard should be deleted after sync")
	})

	t.Run("delete file on branch", func(t *testing.T) {
		branchName := "delete-branch"

		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("ref", branchName).
			Do(ctx)

		require.NoError(t, result.Error(), "should delete file on branch")

		// Verify file is deleted on branch but not on main
		_, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branchName,
		}, "files", "dashboard2.json")
		require.Error(t, err, "file should not exist on delete branch")

		// File should still exist on main branch
		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "dashboard2.json")
		require.NoError(t, err, "file should still exist on main branch")
	})
}

func TestIntegrationGitFiles_MoveFile(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	repoName := "test-move-file"
	initialContent := map[string][]byte{
		"dashboard.json": []byte(`{
			"uid": "move-dash",
			"title": "Dashboard to Move",
			"schemaVersion": 39,
			"version": 1
		}`),
	}

	_, _ = helper.createGitRepo(t, repoName, initialContent)
	helper.syncAndWait(t, repoName)

	t.Run("move file on default branch", func(t *testing.T) {
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		url := fmt.Sprintf(
			"http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/moved/dashboard.json?originalPath=dashboard.json&message=Move%%20file",
			addr, repoName,
		)

		req, err := http.NewRequest(http.MethodPost, url, nil)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode, "should move file on default branch")

		// Verify file moved
		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "moved", "dashboard.json")
		require.NoError(t, err, "file should exist at new location")

		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "dashboard.json")
		require.Error(t, err, "file should not exist at old location")
	})
}

func TestIntegrationGitFiles_ListFiles(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	repoName := "test-list-files"
	initialContent := map[string][]byte{
		"dashboard1.json": []byte(`{"uid": "dash-1", "title": "Dashboard 1"}`),
		"dashboard2.json": []byte(`{"uid": "dash-2", "title": "Dashboard 2"}`),
		"folder/dashboard3.json": []byte(`{"uid": "dash-3", "title": "Dashboard 3"}`),
	}

	_, _ = helper.createGitRepo(t, repoName, initialContent)

	t.Run("list all files", func(t *testing.T) {
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			Suffix("files/").
			Do(ctx)

		require.NoError(t, result.Error(), "should list files")

		fileListObj := &unstructured.Unstructured{}
		err := result.Into(fileListObj)
		require.NoError(t, err)

		items, found, err := unstructured.NestedSlice(fileListObj.Object, "items")
		require.NoError(t, err)
		require.True(t, found)
		require.Len(t, items, 3, "should list all files")
	})

	t.Run("list files in subdirectory", func(t *testing.T) {
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			Suffix("files/folder/").
			Do(ctx)

		require.NoError(t, result.Error(), "should list files in subdirectory")

		fileListObj := &unstructured.Unstructured{}
		err := result.Into(fileListObj)
		require.NoError(t, err)

		items, found, err := unstructured.NestedSlice(fileListObj.Object, "items")
		require.NoError(t, err)
		require.True(t, found)
		require.Len(t, items, 1, "should list files in subdirectory")
	})
}

func TestIntegrationGitFiles_BranchOperations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	repoName := "test-branch-ops"
	initialContent := map[string][]byte{
		"main-file.json": []byte(`{"uid": "main-dash", "title": "Main Dashboard"}`),
	}

	_, _ = helper.createGitRepo(t, repoName, initialContent)

	t.Run("create multiple files on same branch", func(t *testing.T) {
		branchName := "multi-file-branch"

		// Create first file
		file1Content := []byte(`{"uid": "branch-dash-1", "title": "Branch Dashboard 1"}`)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file1.json").
			Param("ref", branchName).
			Body(file1Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create first file on branch")

		// Create second file on same branch
		file2Content := []byte(`{"uid": "branch-dash-2", "title": "Branch Dashboard 2"}`)
		result = helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file2.json").
			Param("ref", branchName).
			Body(file2Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create second file on same branch")

		// Verify both files exist on branch
		_, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branchName,
		}, "files", "branch-file1.json")
		require.NoError(t, err, "first file should exist on branch")

		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branchName,
		}, "files", "branch-file2.json")
		require.NoError(t, err, "second file should exist on branch")

		// Verify files don't exist on main branch
		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "branch-file1.json")
		require.Error(t, err, "first file should not exist on main branch")

		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "branch-file2.json")
		require.Error(t, err, "second file should not exist on main branch")
	})

	t.Run("update file independently on different branches", func(t *testing.T) {
		branch1 := "update-branch-1"
		branch2 := "update-branch-2"

		// Create initial file
		initialContent := []byte(`{"uid": "multi-branch-dash", "title": "Original", "version": 1}`)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Body(initialContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create initial file")

		// Update on branch 1
		branch1Content := []byte(`{"uid": "multi-branch-dash", "title": "Branch 1 Update", "version": 2}`)
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Param("ref", branch1).
			Body(branch1Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on branch 1")

		// Update on branch 2
		branch2Content := []byte(`{"uid": "multi-branch-dash", "title": "Branch 2 Update", "version": 3}`)
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Param("ref", branch2).
			Body(branch2Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on branch 2")

		// Verify different content on each branch
		branch1File, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branch1,
		}, "files", "multi-branch.json")
		require.NoError(t, err)

		branch2File, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branch2,
		}, "files", "multi-branch.json")
		require.NoError(t, err)

		// Extract and verify titles are different
		branch1Resource, _, _ := unstructured.NestedMap(branch1File.Object, "resource")
		branch2Resource, _, _ := unstructured.NestedMap(branch2File.Object, "resource")

		require.NotEqual(t, branch1Resource, branch2Resource, "file content should differ between branches")
	})
}
