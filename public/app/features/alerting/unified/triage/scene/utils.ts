import { TimeRange } from '@grafana/data';
import { AdHocFilterWithLabels, AdHocFiltersVariable, SceneObject, sceneGraph, sceneUtils } from '@grafana/scenes';
import { useSceneContext } from '@grafana/scenes-react';

import { VARIABLES } from '../constants';
import { Domain } from '../types';

import { prometheusExpressionBuilder } from './expressionBuilder';

export const defaultTimeRange = {
  from: 'now-15m',
  to: 'now',
} as const;

export function convertTimeRangeToDomain(timeRange: TimeRange): Domain {
  return [timeRange.from.toDate(), timeRange.to.toDate()];
}

export type AlertStateFilter = 'firing' | 'pending' | null;

export interface QueryFilter {
  /** PromQL filter string WITHOUT alertstate */
  filter: string;
  alertStateFilter: AlertStateFilter;
  /** true if ANY filters are active (including alertstate) */
  hasActiveFilters: boolean;
}

/**
 * Separates alertstate filters from the rest of the ad-hoc filters.
 *
 * - Exact `=` matches for "firing" or "pending" set the alertStateFilter
 * - All other alertstate operators/values are silently dropped
 * - Remaining (non-alertstate) filters are returned as-is
 */
export function separateAlertStateFilter(filters: AdHocFilterWithLabels[]): {
  remaining: AdHocFilterWithLabels[];
  alertStateFilter: AlertStateFilter;
} {
  let alertStateFilter: AlertStateFilter = null;
  const remaining: AdHocFilterWithLabels[] = [];

  for (const f of filters) {
    if (f.key === 'alertstate') {
      if (f.operator === '=' && (f.value === 'firing' || f.value === 'pending')) {
        alertStateFilter = f.value;
      }
      // All other alertstate operators/values are silently dropped
      continue;
    }
    remaining.push(f);
  }

  return { remaining, alertStateFilter };
}

/**
 * Returns a structured query filter from the ad-hoc filters variable.
 * Strips alertstate from the PromQL filter string and extracts it as a separate value.
 */
export function useQueryFilter(): QueryFilter {
  const sceneContext = useSceneContext();
  const filtersVar = sceneGraph.lookupVariable(VARIABLES.filters, sceneContext);
  if (!filtersVar || !sceneUtils.isAdHocVariable(filtersVar)) {
    return { filter: '', alertStateFilter: null, hasActiveFilters: false };
  }
  const { filters } = filtersVar.useState();

  const { remaining, alertStateFilter } = separateAlertStateFilter(filters);
  const filter = prometheusExpressionBuilder(remaining);
  const hasActiveFilters = filters.length > 0;

  return { filter, alertStateFilter, hasActiveFilters };
}

type AdHocFilterOperator = '=' | '!=' | '=~' | '!~' | '=|' | '!=|';

export function addOrReplaceFilter(
  sceneContext: SceneObject,
  key: string,
  operator: AdHocFilterOperator,
  value: string
) {
  const filtersVariable = sceneGraph.lookupVariable(VARIABLES.filters, sceneContext);
  if (filtersVariable instanceof AdHocFiltersVariable) {
    const currentFilters = filtersVariable.state.filters;
    const existingIndex = currentFilters.findIndex((f) => f.key === key);
    const newFilter = { key, operator, value };
    const updatedFilters =
      existingIndex >= 0
        ? currentFilters.map((f, i) => (i === existingIndex ? newFilter : f))
        : [...currentFilters, newFilter];
    filtersVariable.setState({ filters: updatedFilters });
  }
}
