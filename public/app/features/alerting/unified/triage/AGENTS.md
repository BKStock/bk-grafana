# Alerting Triage View

## Overview

The triage view (`/alerting/alerts`) is the main page for observing and investigating active alert instances. It queries the `GRAFANA_ALERTS` Prometheus metric from the state-history datasource and presents the data as an interactive workbench.

See `Triage.md` for product goals.

## Page Structure

```
TriagePage (Triage.tsx)
└── TriageScene (scene/TriageScene.tsx)
    ├── Controls: GroupBy variable, AdHoc Filters, Saved Searches, Time picker
    └── WorkbenchRenderer (scene/Workbench.tsx)
        ├── SummaryStats — compact firing/pending instance + rule counts
        ├── SummaryChart — bar chart of alert counts over time
        └── Workbench tree — hierarchical rows grouped by labels
            ├── FolderGroupRow / GroupRow — grouping rows
            └── AlertRuleRow → AlertRuleSummary + AlertRuleInstances
```

The page is built with Grafana Scenes. `TriageScene` sets up the scene graph with a shared time range, cursor sync, and two variables (`groupBy` and `filters`). The `WorkbenchRenderer` reads those variables via `useQueryFilter()` and feeds them into query builders.

## Key Modules

| Module                       | Role                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| `scene/queries.ts`           | PromQL expression builders and `SceneDataQuery` factories                |
| `scene/utils.ts`             | `useQueryFilter()` hook — extracts alertstate filter from ad-hoc filters |
| `scene/dataFrameUtils.ts`    | Converts instant-query DataFrames to label maps                          |
| `scene/tagKeysProviders.ts`  | Populates filter/group-by dropdowns with label keys and values           |
| `scene/dataTransform.ts`     | Converts query results into the workbench tree structure                 |
| `scene/expressionBuilder.ts` | Builds PromQL filter strings from ad-hoc filter objects                  |
| `constants.ts`               | Datasource UID, metric name, internal labels, URL params                 |

## GRAFANA_ALERTS Metric

- **Source**: Grafana's built-in Prometheus datasource (configured via `unifiedAlerting.stateHistory`)
- **Shape**: One series per alert instance (unique combination of labels)
- **Values**: `alertstate` is either `firing` or `pending`; each series carries a set of internal + user-defined labels

### Internal Labels

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

Applied by alert rule authors via the alert rule editor. Coverage varies across instances. Typical examples: `team`, `severity`, `service_name`, `group`.

## Alert State Filtering

The `alertstate` label is special — a single alert instance can have both a `firing` and a `pending` series simultaneously. The triage view handles this by extracting `alertstate` from ad-hoc filters as a first-class `AlertStateFilter` type (see `separateAlertStateFilter` in `utils.ts`) and encoding the semantics directly in PromQL:

| Filter    | Behavior                                                            |
| --------- | ------------------------------------------------------------------- |
| _(none)_  | Show all instances; firing takes priority over pending for dedup    |
| `firing`  | Show only firing instances                                          |
| `pending` | Show only instances that are pending **and never fired** (`unless`) |

This logic lives in two expression builders in `queries.ts`:

- **`alertSeriesExpr`** — for range queries (charts, timelines)
- **`uniqueAlertInstancesExpr`** — for instant queries (counts, tables) using `last_over_time` + `unless`

## Query Patterns

The triage view builds all queries in `scene/queries.ts`. See the module-level JSDoc there for the full list. Query builders accept a `filter` string (non-alertstate filters) and an `AlertStateFilter` and return `SceneDataQuery` objects.

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
