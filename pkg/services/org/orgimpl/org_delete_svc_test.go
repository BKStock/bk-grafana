package orgimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// fakeK8sResourceDeleter records calls for testing.
type fakeK8sResourceDeleter struct {
	DeletedOrgs []int64
}

func (f *fakeK8sResourceDeleter) deleteCollections(_ context.Context, orgID int64) {
	f.DeletedOrgs = append(f.DeletedOrgs, orgID)
}

func newFakeK8sResourceDeleter() *fakeK8sResourceDeleter {
	return &fakeK8sResourceDeleter{}
}

func TestDeletionService_Delete(t *testing.T) {
	store := &FakeOrgStore{}
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	dashSvc := dashboards.NewFakeDashboardService(t)
	k8sDeleter := newFakeK8sResourceDeleter()
	svc := &DeletionService{
		store:      store,
		cfg:        setting.NewCfg(),
		dashSvc:    dashSvc,
		ac:         ac,
		k8sDeleter: k8sDeleter,
	}

	// if a user has access to delete orgs, then the dashboards should be deleted with a service identity
	requester := &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionOrgsDelete: {"*"},
			},
			2: {
				accesscontrol.ActionOrgsDelete: {"*"},
			},
		},
	}
	dashSvc.On("DeleteAllDashboards", mock.MatchedBy(func(ctx context.Context) bool {
		return identity.IsServiceIdentity(ctx)
	}), int64(2)).Return(nil).Once()
	ctx := context.Background()
	ctx = identity.WithRequester(ctx, requester)
	err := svc.Delete(ctx, &org.DeleteOrgCommand{ID: 2})
	require.NoError(t, err)
	dashSvc.AssertExpectations(t)

	// Verify the k8s deleter was called for the org
	require.Equal(t, []int64{2}, k8sDeleter.DeletedOrgs)

	// if a user does not have access to delete orgs, then the dashboards should not be deleted
	requester = &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionOrgsRead: {"*"},
			},
			2: {
				accesscontrol.ActionOrgsRead: {"*"},
			},
		},
	}
	ctx = context.Background()
	ctx = identity.WithRequester(ctx, requester)
	err = svc.Delete(ctx, &org.DeleteOrgCommand{ID: 2})
	require.Error(t, err)
}
