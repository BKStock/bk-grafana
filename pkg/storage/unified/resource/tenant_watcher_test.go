package resource

import (
	"encoding/json"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestNewTenantWatcherConfig(t *testing.T) {
	newCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.TenantApiServerAddress = "https://example.com/tenant-api"
		cfg.TenantWatcherAllowInsecureTLS = true

		grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
		grpcSection.Key("token").SetValue("token")
		grpcSection.Key("token_exchange_url").SetValue("https://example.com/token-exchange")

		return cfg
	}

	t.Run("returns config when all settings are present", func(t *testing.T) {
		cfg := newCfg()
		tenantWatcherCfg := NewTenantWatcherConfig(cfg)
		require.NotNil(t, tenantWatcherCfg)
		require.Equal(t, "https://example.com/tenant-api", tenantWatcherCfg.TenantAPIServerURL)
		require.Equal(t, "token", tenantWatcherCfg.Token)
		require.Equal(t, "https://example.com/token-exchange", tenantWatcherCfg.TokenExchangeURL)
		require.True(t, tenantWatcherCfg.AllowInsecure)
	})

	t.Run("returns nil when tenant api server address is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.TenantApiServerAddress = ""
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})

	t.Run("returns nil when token is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token").SetValue("")
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})

	t.Run("returns nil when token exchange url is missing", func(t *testing.T) {
		cfg := newCfg()
		cfg.SectionWithEnvOverrides("grpc_client_authentication").Key("token_exchange_url").SetValue("")
		require.Nil(t, NewTenantWatcherConfig(cfg))
	})
}

func newTestTenantWatcher(t *testing.T) *TenantWatcher {
	t.Helper()
	return &TenantWatcher{
		log:    log.NewNopLogger(),
		kv:     setupBadgerKV(t),
		ctx:    t.Context(),
		stopCh: make(chan struct{}),
	}
}

func pendingDeleteTenant(name, deleteAfter string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{}
	obj.SetName(name)
	obj.SetLabels(map[string]string{labelPendingDelete: "true"})
	obj.SetAnnotations(map[string]string{annotationPendingDeleteAfter: deleteAfter})
	return obj
}

func readPendingDeleteRecord(t *testing.T, kv KV, name string) *PendingDeleteRecord {
	t.Helper()
	reader, err := kv.Get(t.Context(), pendingDeleteSection, name)
	if err != nil {
		return nil
	}
	defer func() { _ = reader.Close() }()
	data, err := io.ReadAll(reader)
	require.NoError(t, err)
	var record PendingDeleteRecord
	require.NoError(t, json.Unmarshal(data, &record))
	return &record
}

func TestHandleTenant_MarkPendingDelete(t *testing.T) {
	t.Run("creates record with correct fields", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z")

		tw.handleTenant(tenant)

		record := readPendingDeleteRecord(t, tw.kv, "tenant-1")
		require.NotNil(t, record)
		assert.Equal(t, "2026-03-01T00:00:00Z", record.DeleteAfter)
		assert.False(t, record.ResourcesLabelled)
	})

	t.Run("does not overwrite existing record", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := pendingDeleteTenant("tenant-1", "2026-03-01T00:00:00Z")
		tw.handleTenant(tenant)

		// Manually update the stored record to flip resourcesLabelled so we
		// can detect whether a second call overwrites it.
		writer, err := tw.kv.Save(t.Context(), pendingDeleteSection, "tenant-1")
		require.NoError(t, err)
		require.NoError(t, json.NewEncoder(writer).Encode(PendingDeleteRecord{
			DeleteAfter:       "2026-03-01T00:00:00Z",
			ResourcesLabelled: true,
		}))
		require.NoError(t, writer.Close())

		// Handle the same tenant again — should be a no-op.
		tw.handleTenant(tenant)

		record := readPendingDeleteRecord(t, tw.kv, "tenant-1")
		require.NotNil(t, record)
		assert.True(t, record.ResourcesLabelled, "existing record should not be overwritten")
	})

	t.Run("skips when missing delete-after annotation", func(t *testing.T) {
		tw := newTestTenantWatcher(t)
		tenant := &unstructured.Unstructured{}
		tenant.SetName("tenant-1")
		tenant.SetLabels(map[string]string{labelPendingDelete: "true"})

		tw.handleTenant(tenant)

		record := readPendingDeleteRecord(t, tw.kv, "tenant-1")
		assert.Nil(t, record)
	})
}
