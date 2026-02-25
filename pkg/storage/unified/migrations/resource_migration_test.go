package migrations

import (
	"context"
	"fmt"
	"sync"
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

func uniqueTable(t *testing.T, engine *xorm.Engine) string {
	t.Helper()
	name := fmt.Sprintf("test_%s", uuid.New().String()[:8])
	_, err := engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY, val TEXT)", engine.Quote(name)))
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name)))
		_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name+legacySuffix)))
	})
	return name
}

func dummyGR() schema.GroupResource {
	return schema.GroupResource{Group: "test.group", Resource: "test-resource"}
}

func testDef(gr schema.GroupResource, lockTables, renameTables []string) MigrationDefinition {
	return MigrationDefinition{
		ID: "test-def", MigrationID: "test-migration",
		Resources: []ResourceInfo{{GroupResource: gr, LockTables: lockTables}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
		RenameTables: renameTables,
	}
}

func newRunner(t *testing.T, locker MigrationTableLocker, renamer MigrationTableRenamer, def MigrationDefinition) (*MigrationRunner, *MockUnifiedMigrator) {
	t.Helper()
	m := NewMockUnifiedMigrator(t)
	m.EXPECT().Migrate(mock.Anything, mock.Anything).Return(&resourcepb.BulkResponse{}, nil)
	m.EXPECT().RebuildIndexes(mock.Anything, mock.Anything).Return(nil)
	return NewMigrationRunner(m, locker, renamer, setting.NewCfg(), def, nil), m
}

func ensureOrg(t *testing.T, engine *xorm.Engine) {
	t.Helper()
	var count int64
	has, _ := engine.NewSession().SQL("SELECT COUNT(*) FROM org WHERE id = 1").Get(&count)
	if !has || count == 0 {
		_, err := engine.Exec("INSERT INTO org (id, name, created, updated, version) VALUES (1, 'test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)")
		require.NoError(t, err)
	}
}

func runMigration(t *testing.T, engine *xorm.Engine, runner *MigrationRunner, driverName string) {
	t.Helper()
	mg := migrator.NewMigrator(engine, setting.NewCfg())
	sess := engine.NewSession()
	defer sess.Close()
	require.NoError(t, sess.Begin())
	require.NoError(t, runner.Run(context.Background(), sess, mg, RunOptions{DriverName: driverName}))
	_ = sess.Commit()
}

func assertRenamed(t *testing.T, engine *xorm.Engine, tables ...string) {
	t.Helper()
	for _, table := range tables {
		exists, err := engine.IsTableExist(table)
		require.NoError(t, err)
		require.False(t, exists, "%s should be gone", table)
		exists, err = engine.IsTableExist(table + legacySuffix)
		require.NoError(t, err)
		require.True(t, exists, "%s_legacy should exist", table)
	}
}

func assertNotRenamed(t *testing.T, engine *xorm.Engine, table string) {
	t.Helper()
	exists, err := engine.IsTableExist(table)
	require.NoError(t, err)
	require.True(t, exists)
	exists, err = engine.IsTableExist(table + legacySuffix)
	require.NoError(t, err)
	require.False(t, exists)
}

func noopLocker() *tableLockerMock {
	return &tableLockerMock{unlockFunc: func(context.Context) error { return nil }}
}

func TestIntegrationRun_Postgres_LocksOnSession(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbPostgres() {
		t.Skip("Postgres-only")
	}
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()
	ensureOrg(t, engine)

	table := uniqueTable(t, engine)
	runner, _ := newRunner(t, &postgresTableLocker{}, &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, nil))
	runMigration(t, engine, runner, migrator.Postgres)
}

func TestIntegrationRun_MySQL_UsesTableLocker(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()
	ensureOrg(t, engine)

	table := uniqueTable(t, engine)
	unlockCalled := false
	locker := &tableLockerMock{unlockFunc: func(context.Context) error { unlockCalled = true; return nil }}
	runner, _ := newRunner(t, locker, &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, nil))
	runMigration(t, engine, runner, migrator.MySQL)

	require.True(t, unlockCalled)
	require.Equal(t, []string{table}, locker.tables)
}

func TestIntegrationRun_Rename(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()
	ensureOrg(t, engine)

	t.Run("Postgres", func(t *testing.T) {
		if !db.IsTestDbPostgres() {
			t.Skip("Postgres-only")
		}
		table := uniqueTable(t, engine)
		runner, _ := newRunner(t, &postgresTableLocker{}, &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, []string{table}))
		runMigration(t, engine, runner, migrator.Postgres)
		assertRenamed(t, engine, table)
	})

	t.Run("SQLite", func(t *testing.T) {
		if !db.IsTestDbSQLite() {
			t.Skip("SQLite-only")
		}
		table := uniqueTable(t, engine)
		runner, _ := newRunner(t, noopLocker(), &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, []string{table}))
		runMigration(t, engine, runner, migrator.SQLite)
		assertRenamed(t, engine, table)
	})

	t.Run("MySQL single table", func(t *testing.T) {
		if !db.IsTestDbMySQL() {
			t.Skip("MySQL-only")
		}
		table := uniqueTable(t, engine)
		sqlProvider := legacysql.NewDatabaseProvider(dbstore)
		runner, _ := newRunner(t, &mysqlTableLocker{sql: sqlProvider}, &mysqlTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, []string{table}))
		runMigration(t, engine, runner, migrator.MySQL)
		assertRenamed(t, engine, table)
	})

	t.Run("MySQL multiple tables", func(t *testing.T) {
		if !db.IsTestDbMySQL() {
			t.Skip("MySQL-only")
		}
		t1, t2 := uniqueTable(t, engine), uniqueTable(t, engine)
		sqlProvider := legacysql.NewDatabaseProvider(dbstore)
		runner, _ := newRunner(t, &mysqlTableLocker{sql: sqlProvider}, &mysqlTableRenamer{log: logger}, testDef(dummyGR(), []string{t1, t2}, []string{t1, t2}))
		runMigration(t, engine, runner, migrator.MySQL)
		assertRenamed(t, engine, t1, t2)
	})

	t.Run("no rename configured", func(t *testing.T) {
		table := uniqueTable(t, engine)
		driverName := migrator.SQLite
		if db.IsTestDbMySQL() {
			driverName = migrator.MySQL
		} else if db.IsTestDbPostgres() {
			driverName = migrator.Postgres
		}
		runner, _ := newRunner(t, noopLocker(), &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, nil))
		runMigration(t, engine, runner, driverName)
		assertNotRenamed(t, engine, table)
	})
}

func TestIntegrationMySQL_WaitForRenamesQueued(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()

	table := uniqueTable(t, engine)
	renamer := &mysqlTableRenamer{log: logger}
	mg := migrator.NewMigrator(engine, setting.NewCfg())

	sess := engine.NewSession()
	defer sess.Close()
	require.NoError(t, sess.Begin())

	lockConn, err := engine.DB().Conn(context.Background())
	require.NoError(t, err)
	defer func() { _ = lockConn.Close() }()
	_, err = lockConn.ExecContext(context.Background(), fmt.Sprintf("LOCK TABLES %s READ", engine.Quote(table)))
	require.NoError(t, err)
	defer func() { _, _ = lockConn.ExecContext(context.Background(), "UNLOCK TABLES") }()

	renameConn, err := engine.DB().Conn(context.Background())
	require.NoError(t, err)
	defer func() { _ = renameConn.Close() }()
	renameDone := make(chan error, 1)
	go func() {
		_, rerr := renameConn.ExecContext(context.Background(),
			fmt.Sprintf("RENAME TABLE %s TO %s", engine.Quote(table), engine.Quote(table+legacySuffix)))
		renameDone <- rerr
	}()

	require.NoError(t, renamer.waitForRenamesQueued(context.Background(), sess, mg, []renamePair{{table, table + legacySuffix}}))

	_, _ = lockConn.ExecContext(context.Background(), "UNLOCK TABLES")
	select {
	case err := <-renameDone:
		require.NoError(t, err)
	case <-time.After(10 * time.Second):
		t.Fatal("RENAME timed out")
	}
}

func TestIntegrationMySQL_WaitForRenamesQueued_ExactMatch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()

	t1, t2 := uniqueTable(t, engine), uniqueTable(t, engine)
	renamer := &mysqlTableRenamer{log: logger}
	mg := migrator.NewMigrator(engine, setting.NewCfg())

	sess := engine.NewSession()
	defer sess.Close()
	require.NoError(t, sess.Begin())

	lockConn, err := engine.DB().Conn(context.Background())
	require.NoError(t, err)
	defer func() { _ = lockConn.Close() }()
	_, err = lockConn.ExecContext(context.Background(), fmt.Sprintf("LOCK TABLES %s READ, %s READ", engine.Quote(t1), engine.Quote(t2)))
	require.NoError(t, err)
	defer func() { _, _ = lockConn.ExecContext(context.Background(), "UNLOCK TABLES") }()

	var wg sync.WaitGroup
	results := make([]chan error, 2)
	for i, tbl := range []string{t1, t2} {
		results[i] = make(chan error, 1)
		wg.Add(1)
		go func(tbl string, ch chan<- error) {
			defer wg.Done()
			conn, cerr := engine.DB().Conn(context.Background())
			if cerr != nil {
				ch <- cerr
				return
			}
			defer func() { _ = conn.Close() }()
			_, rerr := conn.ExecContext(context.Background(), fmt.Sprintf("RENAME TABLE %s TO %s", engine.Quote(tbl), engine.Quote(tbl+legacySuffix)))
			ch <- rerr
		}(tbl, results[i])
	}

	pairs := []renamePair{{t1, t1 + legacySuffix}, {t2, t2 + legacySuffix}}
	require.NoError(t, renamer.waitForRenamesQueued(context.Background(), sess, mg, pairs))

	// Mismatched table should timeout
	err = renamer.waitForRenamesQueued(context.Background(), sess, mg, []renamePair{{t1, t1 + legacySuffix}, {"nonexistent_xyz", "nonexistent_xyz" + legacySuffix}})
	require.Error(t, err)
	require.Contains(t, err.Error(), "timeout")

	_, _ = lockConn.ExecContext(context.Background(), "UNLOCK TABLES")
	for _, ch := range results {
		select {
		case err := <-ch:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			t.Fatal("RENAME timed out")
		}
	}
}

func TestIntegrationMySQL_CrashRecovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()
	ensureOrg(t, engine)

	t1, t2 := uniqueTable(t, engine), uniqueTable(t, engine)
	def := testDef(dummyGR(), []string{t1, t2}, []string{t1, t2})

	// Simulate partial crash: only t1 renamed
	_, err := engine.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", engine.Quote(t1), engine.Quote(t1+legacySuffix)))
	require.NoError(t, err)

	sqlProvider := legacysql.NewDatabaseProvider(dbstore)
	runner, m := newRunner(t, &mysqlTableLocker{sql: sqlProvider}, &mysqlTableRenamer{log: logger}, def)
	runMigration(t, engine, runner, migrator.MySQL)

	// Recovery restores tables, then full migration re-runs including rename
	m.AssertCalled(t, "Migrate", mock.Anything, mock.Anything)
	assertRenamed(t, engine, t1, t2)
}

func TestIntegrationBuildRenamePairs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()
	mg := migrator.NewMigrator(engine, setting.NewCfg())

	t.Run("skips already renamed", func(t *testing.T) {
		name := fmt.Sprintf("test_crash_%s", uuid.New().String()[:8])
		_, err := engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", engine.Quote(name+legacySuffix)))
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name)))
			_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name+legacySuffix)))
		})
		pairs, err := buildRenamePairs(logger, mg, []string{name})
		require.NoError(t, err)
		require.Empty(t, pairs)
	})

	t.Run("returns pair for table needing rename", func(t *testing.T) {
		table := uniqueTable(t, engine)
		pairs, err := buildRenamePairs(logger, mg, []string{table})
		require.NoError(t, err)
		require.Len(t, pairs, 1)
		require.Equal(t, table, pairs[0].oldName)
	})

	t.Run("errors when both exist", func(t *testing.T) {
		table := uniqueTable(t, engine)
		_, _ = engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", engine.Quote(table+legacySuffix)))
		_, err := buildRenamePairs(logger, mg, []string{table})
		require.Error(t, err)
		require.Contains(t, err.Error(), "unexpected state")
	})
}
