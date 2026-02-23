package migrations

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
)

var tableLockerLog = log.New("migrations.table_locker")

// MigrationTableLocker abstracts locking of legacy database tables during migration.
type MigrationTableLocker interface {
	// LockMigrationTables locks legacy tables during migration to prevent concurrent writes.
	LockMigrationTables(ctx context.Context, sess *xorm.Session, mg *migrator.Migrator, tables []string) (func(context.Context) error, error)
}

// newTableLocker returns the appropriate locker for the database type.
func newTableLocker(sqlStore db.DB, sql legacysql.LegacyDatabaseProvider) MigrationTableLocker {
	switch string(sqlStore.GetDBType()) {
	case "sqlite3":
		return &sqliteTableLocker{}
	case "postgres":
		return &postgresTableLocker{}
	default:
		return &mysqlTableLocker{sql: sql}
	}
}

// sqliteTableLocker is a no-op — SQLite uses a shared transaction (single writer).
type sqliteTableLocker struct{}

func (l *sqliteTableLocker) LockMigrationTables(_ context.Context, _ *xorm.Session, _ *migrator.Migrator, _ []string) (func(context.Context) error, error) {
	return func(context.Context) error { return nil }, nil
}

// postgresTableLocker acquires SHARE MODE locks on the migration session (sess).
// Postgres auto-upgrades to ACCESS EXCLUSIVE when ALTER TABLE RENAME executes on the same session.
type postgresTableLocker struct{}

func (l *postgresTableLocker) LockMigrationTables(_ context.Context, sess *xorm.Session, mg *migrator.Migrator, tables []string) (func(context.Context) error, error) {
	for _, table := range tables {
		exists, err := mg.DBEngine.IsTableExist(table)
		if err != nil {
			return nil, fmt.Errorf("failed to check if table %q exists: %w", table, err)
		}
		if !exists {
			continue
		}
		lockSQL := "LOCK TABLE " + mg.Dialect.Quote(table) + " IN SHARE MODE"
		if _, err := sess.Exec(lockSQL); err != nil {
			return nil, fmt.Errorf("failed to lock table %q: %w", table, err)
		}
	}
	// Lock is released when sess's transaction commits/rollbacks — no explicit unlock needed.
	return func(context.Context) error { return nil }, nil
}

// mysqlTableLocker acquires READ locks on a dedicated connection outside the pool.
// We avoid using the same connection, since MySQL requires all tables in a query to be locked together.
type mysqlTableLocker struct {
	sql legacysql.LegacyDatabaseProvider
}

func (l *mysqlTableLocker) LockMigrationTables(ctx context.Context, _ *xorm.Session, _ *migrator.Migrator, tables []string) (func(context.Context) error, error) {
	if len(tables) == 0 {
		return func(context.Context) error { return nil }, nil
	}

	sqlHelper, err := l.sql(ctx)
	if err != nil {
		return nil, err
	}

	quotedTables := make([]string, 0, len(tables))
	seen := make(map[string]struct{}, len(tables))
	for _, table := range tables {
		if table == "" {
			continue
		}
		if _, ok := seen[table]; ok {
			continue
		}
		seen[table] = struct{}{}
		fullName := sqlHelper.Table(table)
		exists, err := sqlHelper.DB.GetEngine().IsTableExist(fullName)
		if err != nil {
			return nil, fmt.Errorf("failed to check if table %q exists: %w", fullName, err)
		}
		if !exists {
			tableLockerLog.Info("Skipping lock for non-existent table", "table", fullName)
			continue
		}
		quotedTables = append(quotedTables, sqlHelper.DB.Quote(fullName))
	}
	if len(quotedTables) == 0 {
		return func(context.Context) error { return nil }, nil
	}

	var lockSQL strings.Builder
	lockSQL.WriteString("LOCK TABLES ")
	for i, table := range quotedTables {
		if i > 0 {
			lockSQL.WriteString(", ")
		}
		lockSQL.WriteString(table)
		lockSQL.WriteString(" READ")
	}

	conn, err := sqlHelper.DB.GetEngine().DB().Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get dedicated connection for table lock: %w", err)
	}

	if _, err := conn.ExecContext(ctx, lockSQL.String()); err != nil {
		if closeErr := conn.Close(); closeErr != nil {
			tableLockerLog.Warn("failed to close connection after lock error", "error", closeErr)
		}
		return nil, err
	}

	return func(ctx context.Context) error {
		defer func() {
			if closeErr := conn.Close(); closeErr != nil {
				tableLockerLog.Warn("failed to close lock connection", "error", closeErr)
			}
		}()
		_, err := conn.ExecContext(ctx, "UNLOCK TABLES")
		return err
	}, nil
}

func lockTablesForResources(def MigrationDefinition) []string {
	return def.GetLockTables()
}
