/**
 * Pre-defined saved searches for the Alert Activity (Triage) page.
 *
 * These appear in the Saved searches dropdown when alertingTriageSavedSearches
 * is enabled. Users can rename, delete, and set default on them like their own
 * saves; renames and dismissals are persisted via useTriagePredefinedOverrides.
 * Stable IDs allow the app to identify predefined items for that behaviour.
 */

import { t } from '@grafana/i18n';

import { SavedSearch } from '../components/saved-searches/savedSearchesSchema';

import { buildTriageQueryStringFromParts } from './scene/triageSavedSearchUtils';
import { defaultTimeRange } from './scene/utils';

/** Prefix for predefined search IDs; used to identify predefined items for overrides and dismissed handling. */
export const TRIAGE_PREDEFINED_SEARCH_ID_PREFIX = 'triage-predefined-';

/** Label for evaluation group in state history / GRAFANA_ALERTS metric. */
const EVAL_GROUP_LABEL = 'rule_group';

const PREDEFINED_IDS = [
  `${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}folder-evalgroup-firing`,
  `${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}firing-only`,
  `${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}folder-evalgroup`,
  `${TRIAGE_PREDEFINED_SEARCH_ID_PREFIX}folder-firing`,
] as const;

/**
 * Pre-defined triage saved searches for common scenarios.
 * Uses default time range from scene/utils (15m).
 * Order defines display order in the dropdown (before user saves).
 * Must be called from a component or function so t() is not used at top level.
 */
export function getTriagePredefinedSearches(): SavedSearch[] {
  return [
    {
      id: PREDEFINED_IDS[0],
      name: t(
        'alerting.triage.saved-searches.predefined.folder-evalgroup-firing',
        'Filter: Firing; Group by: Folder and Evaluation group'
      ),
      isDefault: false,
      query: buildTriageQueryStringFromParts({
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
        groupBy: ['grafana_folder', EVAL_GROUP_LABEL],
        from: defaultTimeRange.from,
        to: defaultTimeRange.to,
      }),
    },
    {
      id: PREDEFINED_IDS[1],
      name: t('alerting.triage.saved-searches.predefined.firing-only', 'Filter: Firing'),
      isDefault: false,
      query: buildTriageQueryStringFromParts({
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
        groupBy: [],
        from: defaultTimeRange.from,
        to: defaultTimeRange.to,
      }),
    },
    {
      id: PREDEFINED_IDS[2],
      name: t('alerting.triage.saved-searches.predefined.folder-evalgroup', 'Group by: Folder and Evaluation group'),
      isDefault: false,
      query: buildTriageQueryStringFromParts({
        groupBy: ['grafana_folder', EVAL_GROUP_LABEL],
        from: defaultTimeRange.from,
        to: defaultTimeRange.to,
      }),
    },
    {
      id: PREDEFINED_IDS[3],
      name: t('alerting.triage.saved-searches.predefined.folder-firing', 'Group by: Folder'),
      isDefault: false,
      query: buildTriageQueryStringFromParts({
        groupBy: ['grafana_folder'],
        from: defaultTimeRange.from,
        to: defaultTimeRange.to,
      }),
    },
  ];
}

/** Set of predefined search IDs (e.g. for identifying predefined items when applying overrides or dismissed state). */
export const TRIAGE_PREDEFINED_SEARCH_IDS = new Set<string>(PREDEFINED_IDS);

/**
 * Returns true if the given saved search ID is a predefined search.
 */
export function isTriagePredefinedSearchId(id: string): boolean {
  return id.startsWith(TRIAGE_PREDEFINED_SEARCH_ID_PREFIX);
}
