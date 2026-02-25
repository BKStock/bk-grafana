# GRAFANA_ALERTS Metric

Reference documentation for the `GRAFANA_ALERTS` Prometheus metric used by the alerting triage view.

## Metric Overview

- **Source**: Grafana's built-in Prometheus datasource (configured via `unifiedAlerting.stateHistory`)
- **Shape**: One series per alert instance (unique combination of labels)
- **Values**: `alertstate` is either `firing` or `pending`; each series carries a set of internal + user-defined labels

## Label Categories

### Internal Labels (6)

Always present on every series. Managed by `INTERNAL_LABELS` in `constants.ts` and excluded from user-facing dropdowns:

| Label                | Description                           |
| -------------------- | ------------------------------------- |
| `__name__`           | Metric name (`GRAFANA_ALERTS`)        |
| `alertname`          | Alert rule name                       |
| `alertstate`         | Prometheus state (`firing`/`pending`) |
| `grafana_alertstate` | Grafana-specific state                |
| `grafana_folder`     | Folder name                           |
| `grafana_rule_uid`   | Unique rule identifier                |

### User-Defined Labels

Applied by alert rule authors via the alert rule editor. Coverage varies widely across instances. Typical examples include `team`, `severity`, `service_name`, `group`.

The "Frequent" group in the filter/group-by dropdowns dynamically surfaces the top 5 most popular user-defined labels (see `tagKeysProviders.ts`).

## Query Patterns

The triage view builds all its queries in `scene/queries.ts`. See the module-level JSDoc there for the full list. The two core PromQL expression builders are:

- **`alertSeriesExpr`** — selects matching alert series (one per label combo per time step). Used in range aggregations for charts and timelines.
- **`uniqueAlertInstancesExpr`** — produces one row per unique alert instance, deduplicated over `$__range` using `last_over_time` + `unless`. Used in instant aggregations for counts, tables, and label breakdowns.

### Datasource lookups (in `tagKeysProviders.ts`)

| Function            | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `fetchTagKeys`      | Calls `getTagKeys` scoped to the metric — populates filter/group-by keys |
| `fetchTagValues`    | Calls `getTagValues` scoped to the metric — populates filter value lists |
| `fetchTopLabelKeys` | Queries unique instances and ranks label keys by frequency               |

## Deduplication

A single alert rule can produce many series (one per unique label set per `alertstate`). The triage view deduplicates in two ways:

1. **Tree rows**: grouped `by (alertname, grafana_folder, grafana_rule_uid, ...)` so each rule appears once
2. **Instance counts**: `uniqueAlertInstancesExpr` uses `last_over_time` to collapse the time dimension, then `unless ignoring(alertstate, grafana_alertstate)` to pick firing over pending when both exist for the same instance
