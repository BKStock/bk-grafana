// The github package exists to provide a client for the GH API, which can also be faked with a mock.
// In most cases, we want the real client, but testing should mock it, lest we get blocked from their API, or have to configure auth for simple tests.
package github

import (
	"context"
	"errors"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// API errors that we need to convey after parsing real GH errors (or faking them).
var (
	ErrResourceNotFound = errors.New("the resource does not exist")
	ErrUnauthorized     = errors.New("unauthorized")
	//lint:ignore ST1005 this is not punctuation
	ErrServiceUnavailable = apierrors.NewServiceUnavailable("github is unavailable")
	ErrTooManyItems       = errors.New("maximum number of items exceeded")
)

//go:generate mockery --name Client --structname MockClient --inpackage --filename mock_client.go --with-expecter
type Client interface {
	// Repositories
	GetRepository(ctx context.Context, owner, repository string) (Repository, error)

	// Branch protection
	GetBranchProtection(ctx context.Context, owner, repository, branch string) (*BranchProtection, error)

	// Commits
	Commits(ctx context.Context, owner, repository, path, branch string) ([]Commit, error)

	// Webhooks
	ListWebhooks(ctx context.Context, owner, repository string) ([]WebhookConfig, error)
	CreateWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) (WebhookConfig, error)
	GetWebhook(ctx context.Context, owner, repository string, webhookID int64) (WebhookConfig, error)
	DeleteWebhook(ctx context.Context, owner, repository string, webhookID int64) error
	EditWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) error

	// Pull requests
	ListPullRequestFiles(ctx context.Context, owner, repository string, number int) ([]CommitFile, error)
	CreatePullRequestComment(ctx context.Context, owner, repository string, number int, body string) error
}

type Repository struct {
	ID            int64
	Name          string
	DefaultBranch string
}

type CommitAuthor struct {
	Name      string
	Username  string
	AvatarURL string
}

type Commit struct {
	Ref       string
	Message   string
	Author    *CommitAuthor
	Committer *CommitAuthor
	CreatedAt time.Time
}

//go:generate mockery --name CommitFile --structname MockCommitFile --inpackage --filename mock_commit_file.go --with-expecter
type CommitFile interface {
	GetSHA() string
	GetFilename() string
	GetPreviousFilename() string
	GetStatus() string
}

type WebhookConfig struct {
	// The ID of the webhook.
	// Can be 0 on creation.
	ID int64
	// The events which this webhook shall contact the URL for.
	Events []string
	// Is the webhook enabled?
	Active bool
	// The URL GitHub should contact on events.
	URL string
	// The content type GitHub should send to the URL.
	// If not specified, this is "form".
	ContentType string
	// The secret to use when sending events to the URL.
	// If fetched from GitHub, this is empty as it contains no useful information.
	Secret string
}

// BranchProtection holds the subset of GitHub branch protection rules
// that are relevant for determining whether direct pushes are allowed.
//
// These fields map to the GitHub "Branch protection" settings documented at:
// https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
//
// Each boolean is true when the corresponding GitHub API field is present (non-nil)
// in the Protection response. The GitHub API only returns these objects when the
// setting is actively enabled, so a nil check is sufficient to detect them.
type BranchProtection struct {
	// RequiredPullRequestReviews is true when "Require a pull request before merging"
	// is enabled. This forces all changes to go through a PR with the configured
	// number of approving reviews. Direct pushes are rejected by GitHub with a 403.
	RequiredPullRequestReviews bool

	// RequiredStatusChecks is true when "Require status checks to pass before merging"
	// is enabled. While this primarily gates PR merges (not direct pushes), it signals
	// the branch is intended for a PR-based workflow. A direct push would bypass all
	// configured CI checks, which is almost certainly not what the repository owner wants.
	RequiredStatusChecks bool

	// EnforceAdmins is true when "Do not allow bypassing the above settings" is
	// enabled AND active. This is a modifier: it makes other rules apply to admins
	// and roles with "bypass branch protections" permission too. It does NOT block
	// pushes on its own — only strengthens the other rules.
	EnforceAdmins bool

	// Restrictions is true when "Restrict who can push to matching branches" is enabled.
	// Only the listed users, teams, or apps may push. Our token-based push will be
	// rejected unless the authenticated identity is explicitly in the allow list.
	Restrictions bool

	// LockBranch is true when "Lock branch" is enabled. The branch becomes fully
	// read-only: no commits can be pushed by anyone, regardless of permissions.
	LockBranch bool
}

// BlocksDirectPush returns human-readable reasons why direct pushes would be
// blocked by branch protection rules. An empty/nil slice means no blocking
// rules were detected.
//
// EnforceAdmins is intentionally excluded: it is a modifier that strengthens
// other rules, not a standalone reason that blocks pushes.
func (bp *BranchProtection) BlocksDirectPush() []string {
	if bp == nil {
		return nil
	}

	var reasons []string
	if bp.RequiredPullRequestReviews {
		reasons = append(reasons, "required pull request reviews")
	}
	if bp.RequiredStatusChecks {
		reasons = append(reasons, "required status checks")
	}
	if bp.Restrictions {
		reasons = append(reasons, "push restrictions (only specific users/teams/apps can push)")
	}
	if bp.LockBranch {
		reasons = append(reasons, "branch is locked (read-only)")
	}
	return reasons
}
