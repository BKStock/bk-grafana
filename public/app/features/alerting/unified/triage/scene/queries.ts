/**
 * Query builders for the alerting triage view.
 *
 * This module has two tiers of functions:
 *
 * **Expression builders** (return PromQL strings)
 *   Building blocks that produce raw PromQL expressions. They are composed
 *   into the query builders below.
 *   - `alertSeriesExpr`          — matching alert series (one per label combo per time step)
 *   - `uniqueAlertInstancesExpr` — one row per unique alert instance (deduplicated over $__range)
 *   - `countUniqueInstancesExpr` — count-by aggregation over unique instances (private)
 *
 * **Query builders** (return `SceneDataQuery`)
 *   Ready-made queries consumed directly by Scene components.
 *   - `summaryChartQuery`           — bar chart: count by alertstate over time
 *   - `workbenchQueries`            — tree rows (range) + badge counts (instant)
 *   - `summaryInstanceCountQuery`   — instant count of unique instances by alertstate
 *   - `summaryRuleCountQuery`       — instant count of unique instances by rule + alertstate
 *   - `alertRuleTimeseriesQuery`    — timeseries for a single rule's instances
 *   - `uniqueAlertInstancesQuery`   — instant table of unique instances (label breakdown, tag keys)
 */
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
 * Returns a PromQL expression that selects matching alert series.
 *
 * Each matching label-combination × time-step is a separate series, so this
 * expression is suited for **range aggregations** (charts, timelines).
 *
 * - null:    GRAFANA_ALERTS{<filter>}
 * - firing:  GRAFANA_ALERTS{alertstate="firing",<filter>}
 * - pending: GRAFANA_ALERTS{alertstate="pending",<filter>} unless ignoring(alertstate, grafana_alertstate) GRAFANA_ALERTS{alertstate="firing",<filter>}
 */
export function alertSeriesExpr(filter: string, alertStateFilter: AlertStateFilter = null): string {
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

/** Time series for the summary bar chart: count by alertstate over time. */
export function summaryChartQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(`count by (alertstate) (${alertSeriesExpr(filter, alertStateFilter)})`, {
    legendFormat: '{{alertstate}}',
  });
}

/**
 * Two queries for the workbench tree:
 * - **A** (range table): count-by over alert series, used to render timeline rows
 * - **B** (instant table): count-by over unique instances, used for badge counts
 */
export function workbenchQueries(
  countBy: string,
  filter: string,
  alertStateFilter: AlertStateFilter = null
): [SceneDataQuery, SceneDataQuery] {
  return [
    getDataQuery(`count by (${countBy}) (${alertSeriesExpr(filter, alertStateFilter)})`, {
      refId: 'A',
      format: 'table',
    }),
    getDataQuery(countUniqueInstancesExpr(countBy, filter, alertStateFilter), {
      refId: 'B',
      instant: true,
      range: false,
      format: 'table',
    }),
  ];
}

/** Instant count of unique instances grouped by alertstate (summary badges). */
export function summaryInstanceCountQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(countUniqueInstancesExpr('alertstate', filter, alertStateFilter), {
    instant: true,
    format: 'table',
  });
}

/** Instant count of unique instances grouped by rule fields + alertstate (rule count badge). */
export function summaryRuleCountQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(
    countUniqueInstancesExpr('alertname, grafana_folder, grafana_rule_uid, alertstate', filter, alertStateFilter),
    {
      instant: true,
      format: 'table',
    }
  );
}

/**
 * Timeseries query for a single alert rule's instances.
 *
 * When alertstate="firing", shows all states so flapping instances display their
 * complete pending→firing timeline. The rule is already visible in the tree
 * because it passed the alertstate filter at the workbench level.
 */
export function alertRuleTimeseriesQuery(
  ruleUID: string,
  filter: string,
  alertStateFilter: AlertStateFilter = null
): SceneDataQuery {
  const filters = filter ? `grafana_rule_uid="${ruleUID}",${filter}` : `grafana_rule_uid="${ruleUID}"`;
  // Show all states for firing filter so the full flapping timeline is visible
  const timeseriesFilter = alertStateFilter === 'firing' ? null : alertStateFilter;
  return getDataQuery(
    `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${alertSeriesExpr(filters, timeseriesFilter)})`,
    { format: 'timeseries', legendFormat: '{{alertstate}}' }
  );
}

/**
 * Returns a PromQL expression that produces one entry per unique alert instance,
 * deduplicated over the selected time range (`$__range`).
 *
 * Uses `last_over_time` to capture all instances active during the range, then
 * `unless` to remove pending instances that also had a corresponding firing series.
 * This is suited for **instant aggregations** (counts, tables).
 *
 * - null:    firing OR (pending UNLESS firing) — firing takes priority
 * - firing:  only firing instances
 * - pending: pending UNLESS firing — only pending that never fired
 */
export function uniqueAlertInstancesExpr(filter: string, alertStateFilter: AlertStateFilter = null): string {
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

/** Wraps `uniqueAlertInstancesExpr` in a count-by aggregation. */
function countUniqueInstancesExpr(countBy: string, filter: string, alertStateFilter: AlertStateFilter = null): string {
  return `count by (${countBy}) (${uniqueAlertInstancesExpr(filter, alertStateFilter)})`;
}

/** Instant table query returning one row per unique alert instance (for label breakdown and tag key lookups). */
export function uniqueAlertInstancesQuery(filter: string, alertStateFilter: AlertStateFilter = null): SceneDataQuery {
  return getDataQuery(uniqueAlertInstancesExpr(filter, alertStateFilter), {
    instant: true,
    range: false,
    format: 'table',
  });
}
