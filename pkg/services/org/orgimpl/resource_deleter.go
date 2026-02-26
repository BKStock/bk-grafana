package orgimpl

import (
	"context"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

// resourceDeleter is the interface used by DeletionService.
type resourceDeleter interface {
	deleteCollections(ctx context.Context, orgID int64)
}

// k8sResourceDeleter deletes org-scoped k8s resources during org deletion.
// It routes through the k8s API server, which dispatches to either unified
// storage or legacy SQL depending on the current dual-write mode.
type k8sResourceDeleter struct {
	namespacer request.NamespaceMapper
	restConfig apiserver.RestConfigProvider
	log        log.Logger
	gvrs       []schema.GroupVersionResource
}

func newK8sResourceDeleter(cfg *setting.Cfg, restCfg apiserver.RestConfigProvider, logger log.Logger) *k8sResourceDeleter {
	return &k8sResourceDeleter{
		namespacer: request.GetNamespaceMapper(cfg),
		restConfig: restCfg,
		log:        logger,
		gvrs:       migratedResourceGVRs(),
	}
}

// migratedResourceGVRs returns the list of GVRs for resources that may have
// been migrated to unified storage and need deletion during org cleanup.
func migratedResourceGVRs() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		playlistv1.PlaylistKind().GroupVersionResource(),
	}
}

// deleteCollections deletes all resources for each migrated GVR in the given org.
// Errors are logged as warnings rather than returned, because a missing or
// unregistered resource should not block the rest of org deletion.
func (d *k8sResourceDeleter) deleteCollections(ctx context.Context, orgID int64) {
	cfg, err := d.restConfig.GetRestConfig(ctx)
	if err != nil {
		d.log.Warn("Failed to get rest config for k8s resource deletion during org deletion", "orgId", orgID, "error", err)
		return
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		d.log.Warn("Failed to create dynamic client for k8s resource deletion during org deletion", "orgId", orgID, "error", err)
		return
	}

	ns := d.namespacer(orgID)

	for _, gvr := range d.gvrs {
		if err := dyn.Resource(gvr).Namespace(ns).DeleteCollection(ctx, v1.DeleteOptions{}, v1.ListOptions{}); err != nil {
			d.log.Warn("Failed to delete resource collection during org deletion",
				"orgId", orgID, "gvr", gvr.String(), "error", err)
		}
	}
}
