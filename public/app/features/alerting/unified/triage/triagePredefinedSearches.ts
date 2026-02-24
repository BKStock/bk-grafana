/**
 * Pre-defined saved searches for the Alert Activity (Triage) page.
 *
 * These appear in the Saved searches dropdown when alertingTriageSavedSearches
 * is enabled. Users can rename, delete, and set default on them like their own
 * saves; renames and dismissals are persisted via useTriagePredefinedOverrides.
 * Stable IDs allow the app to identify predefined items for that behaviour.
 */

import { t } from '@grafana/i18n';

import { toUrl } from '../../../variables/adhoc/urlParser';
import { SavedSearch } from '../components/saved-searches/savedSearchesSchema';

import { URL_PARAMS } from './constants';
import { defaultTimeRange } from './scene/utils';

/** Prefix for predefined search IDs; used to identify predefined items for overrides and dismissed handling. */
export const TRIAGE_PREDEFINED_SEARCH_ID_PREFIX = 'triage-predefined-';

/** Label for evaluation group in state history / GRAFANA_ALERTS metric. */
const EVAL_GROUP_LABEL = 'rule_group';

/**
 * Builds a triage saved search query string from groupBy, filters, and optional time range.
 * Uses the same format as serializeTriageState for consistency.
 */
function buildTriageQueryString(options: {
  groupBy: string[];
  filters?: Array<{ key: string; operator: '=' | '=!'; value: string }>;
  from?: string;
  to?: string;
}): string {
  const params = new URLSearchParams();

  if (options.filters?.length) {
    const filterStrings = toUrl(options.filters.map((f) => ({ key: f.key, operator: f.operator, value: f.value })));
    filterStrings.forEach((s) => params.append(URL_PARAMS.filters, s));
  }

  options.groupBy.forEach((key) => {
    if (key) {
      params.append(URL_PARAMS.groupBy, key);
    }
  });

  params.set(URL_PARAMS.timeFrom, options.from ?? defaultTimeRange.from);
  params.set(URL_PARAMS.timeTo, options.to ?? defaultTimeRange.to);

  return params.toString();
}

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
      query: buildTriageQueryString({
        groupBy: ['grafana_folder', EVAL_GROUP_LABEL],
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
      }),
    },
    {
      id: PREDEFINED_IDS[1],
      name: t('alerting.triage.saved-searches.predefined.firing-only', 'Filter: Firing'),
      isDefault: false,
      query: buildTriageQueryString({
        groupBy: [],
        filters: [{ key: 'alertstate', operator: '=', value: 'firing' }],
      }),
    },
    {
      id: PREDEFINED_IDS[2],
      name: t('alerting.triage.saved-searches.predefined.folder-evalgroup', 'Group by: Folder and Evaluation group'),
      isDefault: false,
      query: buildTriageQueryString({
        groupBy: ['grafana_folder', EVAL_GROUP_LABEL],
      }),
    },
    {
      id: PREDEFINED_IDS[3],
      name: t('alerting.triage.saved-searches.predefined.folder-firing', 'Group by: Folder'),
      isDefault: false,
      query: buildTriageQueryString({
        groupBy: ['grafana_folder'],
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
