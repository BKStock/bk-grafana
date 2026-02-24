import { SceneDataQuery } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { DATASOURCE_UID, METRIC_NAME } from '../constants';

import { AlertStateFilter } from './utils';

function getDataQuery(expression: string, options?: Partial<SceneDataQuery>): SceneDataQuery {
  const datasourceRef: DataSourceRef = {
    type: 'prometheus',
    uid: DATASOURCE_UID,
  };

  const query: SceneDataQuery = {
    refId: 'query',
    expr: expression,
    instant: false,
    datasource: datasourceRef,
    ...options,
  };

  return query;
}

/**
 * Returns the inner metric expression for use inside aggregations (non-dedup queries).
 *
 * - null:    GRAFANA_ALERTS{<filter>}
 * - firing:  GRAFANA_ALERTS{alertstate="firing",<filter>}
 * - pending: GRAFANA_ALERTS{alertstate="pending",<filter>} unless ignoring(alertstate, grafana_alertstate) GRAFANA_ALERTS{alertstate="firing",<filter>}
 */
export function alertsMetricExpr(filter: string, alertStateFilter: AlertStateFilter = null): string {
  if (alertStateFilter === null) {
    return `${METRIC_NAME}{${filter}}`;
  }

  const firingFilter = filter ? `alertstate="firing",${filter}` : 'alertstate="firing"';

  if (alertStateFilter === 'firing') {
    return `${METRIC_NAME}{${firingFilter}}`;
  }

  // pending: only instances that never fired
  const pendingFilter = filter ? `alertstate="pending",${filter}` : 'alertstate="pending"';
  return (
    `${METRIC_NAME}{${pendingFilter}} unless ignoring(alertstate, grafana_alertstate) ` +
    `${METRIC_NAME}{${firingFilter}}`
  );
}

/** Time series for the summary bar chart: count by alertstate */
export function summaryChartQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(`count by (alertstate) (${alertsMetricExpr(filter, alertStateFilter)})`, {
    legendFormat: '{{alertstate}}',
  });
}

/** Range table query (A) for tree rows + deduplicated instant query (B) for badge counts */
export function getWorkbenchQueries(
  countBy: string,
  filter: string,
  alertStateFilter: AlertStateFilter = null
): [SceneDataQuery, SceneDataQuery] {
  return [
    getDataQuery(`count by (${countBy}) (${alertsMetricExpr(filter, alertStateFilter)})`, {
      refId: 'A',
      format: 'table',
    }),
    getDataQuery(getAlertsSummariesQuery(countBy, filter, alertStateFilter), {
      refId: 'B',
      instant: true,
      range: false,
      format: 'table',
    }),
  ];
}

/** Deduplicated instant count by alertstate for summary instance counts */
export function summaryInstanceCountQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(getAlertsSummariesQuery('alertstate', filter, alertStateFilter), {
    instant: true,
    format: 'table',
  });
}

/** Deduplicated instant count by rule fields + alertstate for summary rule counts */
export function summaryRuleCountQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(
    getAlertsSummariesQuery('alertname, grafana_folder, grafana_rule_uid, alertstate', filter, alertStateFilter),
    {
      instant: true,
      format: 'table',
    }
  );
}

/** Instance timeseries for a specific alert rule.
 * When alertstate=firing, shows all states so flapping instances display their
 * complete pending+firing timeline. The rule is already visible in the tree
 * because it passed the alertstate filter at the workbench level. */
export function alertRuleInstancesQuery(
  ruleUID: string,
  filter: string,
  alertStateFilter: AlertStateFilter = null
): SceneDataQuery {
  const filters = filter ? `grafana_rule_uid="${ruleUID}",${filter}` : `grafana_rule_uid="${ruleUID}"`;
  // Show all states for firing filter so the full flapping timeline is visible
  const timeseriesFilter = alertStateFilter === 'firing' ? null : alertStateFilter;
  return getDataQuery(
    `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${alertsMetricExpr(filters, timeseriesFilter)})`,
    { format: 'timeseries', legendFormat: '{{alertstate}}' }
  );
}

/**
 * Raw PromQL expression that returns one deduplicated series per active alert instance.
 * Uses last_over_time to capture all instances active during the range, and `unless` to
 * remove pending instances that also had a corresponding firing series.
 *
 * - null:    firing OR (pending UNLESS firing) — firing takes priority
 * - firing:  only firing instances
 * - pending: pending UNLESS firing — only pending that never fired
 */
export function alertInstancesExpr(filter: string, alertStateFilter: AlertStateFilter = null): string {
  const firingFilter = filter ? `alertstate="firing",${filter}` : 'alertstate="firing"';
  const pendingFilter = filter ? `alertstate="pending",${filter}` : 'alertstate="pending"';

  const firingExpr = `last_over_time(${METRIC_NAME}{${firingFilter}}[$__range])`;
  const pendingExpr = `last_over_time(${METRIC_NAME}{${pendingFilter}}[$__range])`;
  const ignoring = 'ignoring(alertstate, grafana_alertstate)';

  if (alertStateFilter === 'firing') {
    return firingExpr;
  }

  if (alertStateFilter === 'pending') {
    // Only pending that never fired
    return `${pendingExpr} unless ${ignoring} ${firingExpr}`;
  }

  // Default: firing takes priority
  return `${firingExpr} or (${pendingExpr} unless ${ignoring} ${firingExpr})`;
}

/** Wraps alertInstancesExpr in a count-by aggregation */
function getAlertsSummariesQuery(countBy: string, filter: string, alertStateFilter: AlertStateFilter = null): string {
  return `count by (${countBy}) (${alertInstancesExpr(filter, alertStateFilter)})`;
}

/** Instant table query returning one row per deduplicated alert instance (for label breakdown) */
export function alertInstancesQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(alertInstancesExpr(filter, alertStateFilter), { instant: true, range: false, format: 'table' });
}
