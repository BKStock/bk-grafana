package migrations

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type tableLockerMock struct {
	unlockFunc func(context.Context) error
	tables     []string
}

func (m *tableLockerMock) LockMigrationTables(_ context.Context, _ *xorm.Session, _ *migrator.Migrator, tables []string) (func(context.Context) error, error) {
	m.tables = tables
	return m.unlockFunc, nil
}

func TestIntegrationMigrationRunnerLocksTables(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only: tableLocker mock is only exercised on MySQL path")
	}
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)

	gr := schema.GroupResource{Group: "group", Resource: "resource"}
	unlockCalled := false
	locker := &tableLockerMock{unlockFunc: func(context.Context) error { unlockCalled = true; return nil }}
	def := MigrationDefinition{
		ID: "test", MigrationID: "test",
		Resources: []ResourceInfo{{GroupResource: gr, LockTables: []string{"resource"}}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
	}
	m := NewMockUnifiedMigrator(t)
	m.EXPECT().Migrate(mock.Anything, mock.Anything).Return(&resourcepb.BulkResponse{}, nil)
	m.EXPECT().RebuildIndexes(mock.Anything, mock.Anything).Return(nil)

	runner := NewMigrationRunner(m, locker, &transactionalTableRenamer{log: logger}, def, nil)
	engine := dbstore.GetEngine()
	mg := migrator.NewMigrator(engine, setting.NewCfg())
	sess := engine.NewSession()
	defer sess.Close()
	_, _ = sess.Exec("INSERT INTO org (id, name, created, updated, version) VALUES (1, 'test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)")

	require.NoError(t, runner.Run(context.Background(), sess, mg, RunOptions{DriverName: engine.DriverName()}))
	require.True(t, unlockCalled)
	require.Equal(t, []string{"resource"}, locker.tables)
}

func createTestTable(t *testing.T, dbstore db.DB) string {
	t.Helper()
	name := fmt.Sprintf("test_lock_%s", uuid.New().String()[:8])
	engine := dbstore.GetEngine()
	_, err := engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY, val TEXT)", engine.Quote(name)))
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name))) })
	return name
}

func TestIntegrationTableLocker(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if db.IsTestDbSQLite() {
		t.Skip("SQLite uses no-op locker")
	}

	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()
	ctx := context.Background()

	type lockerSetup struct {
		name   string
		locker MigrationTableLocker
		sess   func(t *testing.T) *xorm.Session // nil for MySQL (doesn't need sess)
		mg     *migrator.Migrator               // nil for MySQL
		unlock func(unlock func(context.Context) error, sess *xorm.Session)
	}

	var setups []lockerSetup
	if db.IsTestDbMySQL() {
		sqlProvider := legacysql.NewDatabaseProvider(dbstore)
		setups = append(setups, lockerSetup{
			name:   "mysql",
			locker: &mysqlTableLocker{sql: sqlProvider},
			unlock: func(unlock func(context.Context) error, _ *xorm.Session) {
				require.NoError(t, unlock(ctx))
			},
		})
	}
	if db.IsTestDbPostgres() {
		mg := migrator.NewMigrator(engine, setting.NewCfg())
		setups = append(setups, lockerSetup{
			name:   "postgres",
			locker: &postgresTableLocker{},
			mg:     mg,
			sess: func(t *testing.T) *xorm.Session {
				t.Helper()
				s := engine.NewSession()
				t.Cleanup(func() { s.Close() })
				require.NoError(t, s.Begin())
				return s
			},
			unlock: func(_ func(context.Context) error, sess *xorm.Session) {
				require.NoError(t, sess.Rollback())
			},
		})
	}

	for _, setup := range setups {
		t.Run(setup.name+"/lock and unlock", func(t *testing.T) {
			var sess *xorm.Session
			if setup.sess != nil {
				sess = setup.sess(t)
			}
			unlock, err := setup.locker.LockMigrationTables(ctx, sess, setup.mg, []string{createTestTable(t, dbstore), createTestTable(t, dbstore)})
			require.NoError(t, err)
			setup.unlock(unlock, sess)
		})

		t.Run(setup.name+"/empty list is no-op", func(t *testing.T) {
			var sess *xorm.Session
			if setup.sess != nil {
				sess = setup.sess(t)
			}
			unlock, err := setup.locker.LockMigrationTables(ctx, sess, setup.mg, nil)
			require.NoError(t, err)
			setup.unlock(unlock, sess)
		})

		t.Run(setup.name+"/non-existent tables skipped", func(t *testing.T) {
			var sess *xorm.Session
			if setup.sess != nil {
				sess = setup.sess(t)
			}
			unlock, err := setup.locker.LockMigrationTables(ctx, sess, setup.mg, []string{createTestTable(t, dbstore), "nonexistent_" + uuid.New().String()[:8]})
			require.NoError(t, err)
			setup.unlock(unlock, sess)
		})

		t.Run(setup.name+"/lock blocks writes", func(t *testing.T) {
			table := createTestTable(t, dbstore)
			var sess *xorm.Session
			if setup.sess != nil {
				sess = setup.sess(t)
			}
			unlock, err := setup.locker.LockMigrationTables(ctx, sess, setup.mg, []string{table})
			require.NoError(t, err)

			writeErr := make(chan error, 1)
			go func() {
				_, werr := engine.Exec(fmt.Sprintf("UPDATE %s SET val=val WHERE id=-1", engine.Quote(table)))
				writeErr <- werr
			}()

			select {
			case <-writeErr:
				t.Fatal("write should be blocked")
			case <-time.After(2 * time.Second):
			}
			setup.unlock(unlock, sess)
			select {
			case err = <-writeErr:
				require.NoError(t, err)
			case <-time.After(10 * time.Second):
				t.Fatal("write still blocked after unlock")
			}
		})
	}
}
