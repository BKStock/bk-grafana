package datasource

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupHealth(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,       // Required to start the datasource api servers
			featuremgmt.FlagQueryServiceWithConnections,                // enables CRUD endpoints
			featuremgmt.FlagDatasourcesApiServerEnableResourceEndpoint, // enables resource endpoint
			featuremgmt.FlagDatasourcesApiServerEnableHealthEndpoint,   // enabled health endpoint
		},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"datasources.grafana-testdata-datasource.datasource.grafana.app": {
				DualWriterMode: grafanarest.Mode0,
			},
		},
	})
	t.Cleanup(helper.Shutdown)

	ds := helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID:  helper.Org1.Admin.Identity.GetOrgID(),
		Name:   "health-test",
		Type:   "grafana-testdata-datasource",
		UID:    "health-test",
		Access: datasources.DS_ACCESS_PROXY,
		URL:    "http://localhost",
	})
	require.Equal(t, "health-test", ds.UID)
	return helper
}

func TestIntegrationDatasourceHealth(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setupHealth(t)

	t.Run("GET health returns OK and plugin message", func(t *testing.T) {
		var healthResult datasourceV0alpha1.HealthCheckResult
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, &healthResult)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode, "health check should succeed: %s", string(raw.Body))
		require.Equal(t, "OK", healthResult.Status)
		require.Equal(t, int(backend.HealthStatusOk), healthResult.Code)
		require.Equal(t, "Data source is working", healthResult.Message)
	})

	t.Run("response has expected Kind and APIVersion", func(t *testing.T) {
		var healthResult datasourceV0alpha1.HealthCheckResult
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, &healthResult)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.Equal(t, "HealthCheckResult", healthResult.Kind)
		require.Equal(t, "grafana-testdata-datasource.datasource.grafana.app/v0alpha1", healthResult.APIVersion)
	})

	t.Run("testdata plugin returns no details", func(t *testing.T) {
		var healthResult datasourceV0alpha1.HealthCheckResult
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, &healthResult)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.Nil(t, healthResult.Details, "testdata plugin does not return JSON details")
	})

	t.Run("health endpoint returns error for non-existent datasource", func(t *testing.T) {
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/does-not-exist/health",
		}, nil)
		require.NotNil(t, raw.Response)
		require.Equal(t, http.StatusNotFound, raw.Response.StatusCode, "expected 404 for non-existent datasource, got %d: %s", raw.Response.StatusCode, string(raw.Body))
	})
}

func TestIntegrationDatasourceHealthAuthentication(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := setupHealth(t)

	t.Run("admin is allowed to call health endpoint", func(t *testing.T) {
		var healthResult datasourceV0alpha1.HealthCheckResult
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, &healthResult)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.Equal(t, "OK", healthResult.Status)
	})

	t.Run("editor is allowed to call health endpoint", func(t *testing.T) {
		var healthResult datasourceV0alpha1.HealthCheckResult
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Editor,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, &healthResult)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.Equal(t, "OK", healthResult.Status)
	})

	t.Run("viewer is allowed to call health endpoint", func(t *testing.T) {
		var healthResult datasourceV0alpha1.HealthCheckResult
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Viewer,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, &healthResult)
		require.Equal(t, http.StatusOK, raw.Response.StatusCode)
		require.Equal(t, "OK", healthResult.Status)
	})

	t.Run("unauthenticated request returns 403", func(t *testing.T) {
		var healthResult datasourceV0alpha1.HealthCheckResult
		raw := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.None,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, &healthResult)
		require.NotNil(t, raw.Response)
		require.Equal(t, http.StatusForbidden, raw.Response.StatusCode)
	})

	t.Run("health endpoint cross-org access denied", func(t *testing.T) {
		raw := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.OrgB.Admin,
			Method: "GET",
			Path:   "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/namespaces/default/datasources/health-test/health",
		}, nil)
		require.NotNil(t, raw.Status)
		require.Equal(t, int32(http.StatusForbidden), raw.Status.Code)
	})
}
