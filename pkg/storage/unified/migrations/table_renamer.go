package migrations

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const legacySuffix = "_legacy"

// MigrationTableRenamer renames legacy tables after a successful migration.
type MigrationTableRenamer interface {
	// RenameTables renames the given tables with a _legacy suffix.
	// doUnlock releases the migration lock at the right moment for the database.
	RenameTables(ctx context.Context, sess *xorm.Session, mg *migrator.Migrator, tables []string, doUnlock func()) error
}

// newTableRenamer returns the appropriate renamer for the database type.
func newTableRenamer(dbType string, log log.Logger) MigrationTableRenamer {
	switch dbType {
	case "mysql":
		return &mysqlTableRenamer{log: log}
	default:
		return &transactionalTableRenamer{log: log}
	}
}

// transactionalTableRenamer renames tables on the same session (Postgres/SQLite).
// DDL is transactional on these databases.
type transactionalTableRenamer struct {
	log log.Logger
}

func (r *transactionalTableRenamer) RenameTables(_ context.Context, sess *xorm.Session, mg *migrator.Migrator, tables []string, doUnlock func()) error {
	doUnlock() // no-op for Postgres (lock is on sess), but keeps the interface uniform
	toRename, err := buildRenamePairs(r.log, mg, tables)
	if err != nil {
		return err
	}

	if len(toRename) == 0 {
		return nil
	}

	for _, p := range toRename {
		renameSQL := mg.Dialect.RenameTable(p.oldName, p.newName)
		r.log.Info("renaming legacy table", "table", p.oldName, "newName", p.newName, "sql", renameSQL)
		if _, err := sess.Exec(renameSQL); err != nil {
			return fmt.Errorf("failed to rename table %q to %q: %w", p.oldName, p.newName, err)
		}
	}
	return nil
}

// mysqlTableRenamer queues one RENAME per table on separate connections, waits for
// all to reach metadata-lock-wait state, then releases the READ lock so DDL priority
// ensures renames execute before any pending DML.
type mysqlTableRenamer struct {
	log log.Logger
}

func (r *mysqlTableRenamer) RenameTables(ctx context.Context, sess *xorm.Session, mg *migrator.Migrator, tables []string, doUnlock func()) error {
	pairs, errChs, err := r.queueRenames(ctx, mg, tables)
	if err != nil {
		return fmt.Errorf("failed to queue MySQL renames: %w", err)
	}
	if len(pairs) == 0 {
		return nil
	}

	if err := r.waitForRenamesQueued(ctx, sess, mg, pairs); err != nil {
		return fmt.Errorf("aborting rename: not all RENAME statements confirmed queued (set disable_legacy_table_rename=true to skip renaming): %w", err)
	}
	doUnlock() // release READ lock — DDL priority ensures RENAMEs run first

	// Collect all results; rollback successful renames if any failed.
	renameErrors := make([]error, len(errChs))
	var firstErr error
	for i, ch := range errChs {
		renameErrors[i] = <-ch
		if renameErrors[i] != nil && firstErr == nil {
			firstErr = renameErrors[i]
		}
	}
	if firstErr != nil {
		r.rollbackRenames(mg, pairs, renameErrors)
		return fmt.Errorf("MySQL RENAME TABLE failed: %w", firstErr)
	}
	return nil
}

// queueRenames starts one RENAME TABLE per table on separate connections.
func (r *mysqlTableRenamer) queueRenames(ctx context.Context, mg *migrator.Migrator, tables []string) ([]renamePair, []<-chan error, error) {
	toRename, err := buildRenamePairs(r.log, mg, tables)
	if err != nil {
		return nil, nil, err
	}
	if len(toRename) == 0 {
		return nil, nil, nil
	}

	errChs := make([]<-chan error, 0, len(toRename))
	for _, pair := range toRename {
		ch := make(chan error, 1)
		errChs = append(errChs, ch)

		go func(p renamePair, errCh chan<- error) {
			conn, err := mg.DBEngine.DB().Conn(ctx)
			if err != nil {
				errCh <- fmt.Errorf("failed to get connection for RENAME %q: %w", p.oldName, err)
				return
			}
			defer func() { _ = conn.Close() }()

			renameSQL := fmt.Sprintf("RENAME TABLE %s TO %s", mg.Dialect.Quote(p.oldName), mg.Dialect.Quote(p.newName))
			r.log.Info("Queued MySQL RENAME TABLE", "table", p.oldName, "sql", renameSQL)
			_, err = conn.ExecContext(ctx, renameSQL)
			errCh <- err
		}(pair, ch)
	}

	return toRename, errChs, nil
}

// waitForRenamesQueued polls information_schema.processlist via sess to confirm all
// RENAME statements are waiting for metadata locks. Returns error on timeout.
func (r *mysqlTableRenamer) waitForRenamesQueued(ctx context.Context, sess *xorm.Session, mg *migrator.Migrator, pairs []renamePair) error {
	deadline := time.After(time.Minute)
	for {
		found := 0
		for _, p := range pairs {
			exactMatch := fmt.Sprintf("RENAME TABLE %s TO %s", mg.Dialect.Quote(p.oldName), mg.Dialect.Quote(p.newName))
			var count int
			_, err := sess.SQL(
				"SELECT COUNT(*) FROM information_schema.processlist "+
					"WHERE state = 'Waiting for table metadata lock' AND info = ?",
				exactMatch).Get(&count)
			if err != nil {
				return err
			}
			if count > 0 {
				found++
			}
		}
		if found >= len(pairs) {
			r.log.Info("All MySQL RENAME TABLE statements queued", "count", found)
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("context cancelled while waiting for RENAME statements to queue: %w", ctx.Err())
		case <-deadline:
			return fmt.Errorf("timeout: only %d of %d RENAME statements confirmed in processlist", found, len(pairs))
		case <-time.After(100 * time.Millisecond):
		}
	}
}

// rollbackRenames reverses successful renames when some failed, keeping DB consistent.
func (r *mysqlTableRenamer) rollbackRenames(mg *migrator.Migrator, pairs []renamePair, errs []error) {
	for i, p := range pairs {
		if errs[i] != nil {
			continue
		}
		rollbackSQL := fmt.Sprintf("RENAME TABLE %s TO %s", mg.Dialect.Quote(p.newName), mg.Dialect.Quote(p.oldName))
		r.log.Warn("Rolling back successful rename due to other rename failure",
			"table", p.oldName, "sql", rollbackSQL)
		if _, err := mg.DBEngine.Exec(rollbackSQL); err != nil {
			r.log.Error("Failed to rollback rename — manual intervention required",
				"table", p.oldName, "newName", p.newName, "error", err)
		}
	}
}

// renamePair holds the old and new names for a table rename.
type renamePair struct {
	oldName string
	newName string
}

// buildRenamePairs returns tables needing rename. Skips already-renamed tables.
func buildRenamePairs(log log.Logger, mg *migrator.Migrator, tables []string) ([]renamePair, error) {
	var toRename []renamePair

	for _, table := range tables {
		newName := table + legacySuffix

		sourceExists, err := mg.DBEngine.IsTableExist(table)
		if err != nil {
			return nil, fmt.Errorf("failed to check if table %q exists: %w", table, err)
		}

		targetExists, err := mg.DBEngine.IsTableExist(newName)
		if err != nil {
			return nil, fmt.Errorf("failed to check if table %q exists: %w", newName, err)
		}

		switch {
		case !sourceExists && targetExists:
			log.Info("table already renamed, skipping", "table", table, "newName", newName)
			continue
		case !sourceExists:
			return nil, fmt.Errorf("table %q does not exist and neither does %q", table, newName)
		case targetExists:
			return nil, fmt.Errorf("both %q and %q exist, unexpected state", table, newName)
		default:
			toRename = append(toRename, renamePair{oldName: table, newName: newName})
		}
	}

	return toRename, nil
}
