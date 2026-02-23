import { TimeRange } from '@grafana/data';
import { useVariableValue } from '@grafana/scenes-react';

import { VARIABLES } from '../constants';
import { Domain } from '../types';

export const defaultTimeRange = {
  from: 'now-15m',
  to: 'now',
} as const;

export function convertTimeRangeToDomain(timeRange: TimeRange): Domain {
  return [timeRange.from.toDate(), timeRange.to.toDate()];
}

/**
 * This hook will create a Prometheus label matcher string from the "groupBy" and "filters" variables
 */
export function useQueryFilter(): string {
  const [filters = ''] = useVariableValue<string>(VARIABLES.filters);
  return filters;
}
