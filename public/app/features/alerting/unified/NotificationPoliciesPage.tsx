import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';
import { useSet } from 'react-use';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import {
  NotificationPoliciesFilter,
  useNotificationPoliciesFilters,
} from 'app/features/alerting/unified/components/notification-policies/Filters';
import {
  GetRouteGroupsMapFn,
  PoliciesTree,
} from 'app/features/alerting/unified/components/notification-policies/PoliciesTree';
import { CreateModal } from 'app/features/alerting/unified/components/notification-policies/components/Modals';
import {
  useCreatePolicyAction,
  useListNotificationPolicyRoutes,
} from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { useRouteGroupsMatcher } from 'app/features/alerting/unified/useRouteGroupsMatcher';
import { AlertmanagerGroup, ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from './api/alertmanagerApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { InhibitionRulesAlert } from './components/InhibitionRulesAlert';
import { TimeIntervalsTable } from './components/mute-timings/MuteTimingsTable';
import { useNotificationPoliciesNav } from './navigation/useNotificationConfigNav';
import { useAlertmanager } from './state/AlertmanagerContext';
import { ROOT_ROUTE_NAME } from './utils/k8s/constants';
import { stringifyErrorLike } from './utils/misc';
import { withPageErrorBoundary } from './withPageErrorBoundary';

enum ActiveTab {
  NotificationPolicies = 'notification_policies',
  TimeIntervals = 'time_intervals',
}

const NotificationPoliciesTabs = () => {
  const styles = useStyles2(getStyles);

  // When V2 navigation is enabled, Time Intervals has its own dedicated tab in the navigation,
  // so we don't show local tabs here - just show the notification policies content directly
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // Alertmanager logic and data hooks
  const { selectedAlertmanager = '' } = useAlertmanager();
  const [policiesSupported, canSeePoliciesTab] = useAlertmanagerAbility(AlertmanagerAction.ViewNotificationPolicyTree);
  const [timingsSupported, canSeeTimingsTab] = useAlertmanagerAbility(AlertmanagerAction.ViewTimeInterval);
  const availableTabs = [
    canSeePoliciesTab && ActiveTab.NotificationPolicies,
    canSeeTimingsTab && ActiveTab.TimeIntervals,
  ].filter((tab) => !!tab);
  const { data: muteTimings = [] } = useMuteTimings({
    alertmanager: selectedAlertmanager,
    skip: !canSeeTimingsTab,
  });

  // Tab state management
  const [queryParams, setQueryParams] = useQueryParams();
  const { tab } = getActiveTabFromUrl(queryParams, availableTabs[0]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(tab);

  const muteTimingsTabActive = activeTab === ActiveTab.TimeIntervals;
  const policyTreeTabActive = activeTab === ActiveTab.NotificationPolicies;

  const numberOfMuteTimings = muteTimings.length;

  // V2 Navigation: No local tabs, just show notification policies content
  if (useV2Nav) {
    return (
      <>
        <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
        <InhibitionRulesAlert alertmanagerSourceName={selectedAlertmanager} />
        <PolicyTreeTab />
      </>
    );
  }

  // Legacy Navigation: Show local tabs for Notification Policies and Time Intervals
  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
      <InhibitionRulesAlert alertmanagerSourceName={selectedAlertmanager} />
      <TabsBar>
        {policiesSupported && canSeePoliciesTab && (
          <Tab
            label={t('alerting.notification-policies-tabs.label-notification-policies', 'Notification Policies')}
            active={policyTreeTabActive}
            onChangeTab={() => {
              setActiveTab(ActiveTab.NotificationPolicies);
              setQueryParams({ tab: ActiveTab.NotificationPolicies });
            }}
          />
        )}
        {timingsSupported && canSeeTimingsTab && (
          <Tab
            label={t('alerting.notification-policies-tabs.label-time-intervals', 'Time intervals')}
            active={muteTimingsTabActive}
            counter={numberOfMuteTimings}
            onChangeTab={() => {
              setActiveTab(ActiveTab.TimeIntervals);
              setQueryParams({ tab: ActiveTab.TimeIntervals });
            }}
          />
        )}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {policyTreeTabActive && <PolicyTreeTab />}
        {muteTimingsTabActive && <TimeIntervalsTable />}
      </TabContent>
    </>
  );
};

const PolicyTreeTab = () => {
  const { selectedAlertmanager = '', isGrafanaAlertmanager } = useAlertmanager();
  const [, canSeeAlertGroups] = useAlertmanagerAbility(AlertmanagerAction.ViewAlertGroups);

  // Single worker + alert groups query shared by all PoliciesTree instances
  const { getRouteGroupsMap } = useRouteGroupsMatcher();
  const { currentData: alertGroups, refetch: refetchAlertGroups } = alertmanagerApi.useGetAlertmanagerAlertGroupsQuery(
    { amSourceName: selectedAlertmanager },
    { skip: !canSeeAlertGroups || !selectedAlertmanager }
  );

  const useMultiplePoliciesView = config.featureToggles.alertingMultiplePolicies;

  if (!isGrafanaAlertmanager || !useMultiplePoliciesView) {
    return (
      <PoliciesTree
        alertGroups={alertGroups}
        refetchAlertGroups={refetchAlertGroups}
        getRouteGroupsMap={getRouteGroupsMap}
      />
    );
  }

  return (
    <MultiplePoliciesView
      alertGroups={alertGroups}
      refetchAlertGroups={refetchAlertGroups}
      getRouteGroupsMap={getRouteGroupsMap}
    />
  );
};

/**
 * Shows all policy trees inline as full trees (no list view).
 * Default policy is hoisted to the top. All policies are collapsed by default.
 * Provides shared filters, policy tree selector, and collapse/expand all controls.
 */
interface MultiplePoliciesViewProps {
  alertGroups?: AlertmanagerGroup[];
  refetchAlertGroups: () => void;
  getRouteGroupsMap: GetRouteGroupsMapFn;
}

function MultiplePoliciesView({ alertGroups, refetchAlertGroups, getRouteGroupsMap }: MultiplePoliciesViewProps) {
  const { currentData: allPolicies, isLoading, error: fetchPoliciesError } = useListNotificationPolicyRoutes();

  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    createPoliciesSupported,
    createPoliciesAllowed,
    createTrigger,
    existingPolicyNames,
  } = useCreatePolicyAction(allPolicies);

  const { selectedPolicyTreeNames } = useNotificationPoliciesFilters();

  const [contactPointFilter, setContactPointFilter] = useState<string | undefined>();
  const [labelMatchersFilter, setLabelMatchersFilter] = useState<ObjectMatcher[]>([]);

  // Expand/collapse state uses the XOR model from Policy.tsx:
  // `defaultExpanded` is the baseline; `expandedOverrides` holds route IDs (hash-based) that are
  // toggled opposite to the baseline. Individual toggle receives the route's hash-based id from Policy.
  // "Expand all" / "Collapse all" flip the baseline and clear overrides.
  const [expandedOverrides, { toggle: handleTogglePolicyExpanded, clear }] = useSet<string>(new Set());
  const [manualDefaultExpanded, setManualDefaultExpanded] = useState<boolean | undefined>(undefined);

  // Reset manual override when filters change, so auto-expand kicks in again for new filter state
  const handleChangeContactPoint = useCallback((value: string | undefined) => {
    setContactPointFilter(value);
    setManualDefaultExpanded(undefined);
  }, []);
  const handleChangeLabelMatchers = useCallback((value: ObjectMatcher[]) => {
    setLabelMatchersFilter(value);
    setManualDefaultExpanded(undefined);
  }, []);

  const hasActiveFilters = Boolean(contactPointFilter) || labelMatchersFilter.length > 0;
  // Auto-expand when filters are active, unless the user has explicitly collapsed
  const defaultExpanded = manualDefaultExpanded ?? hasActiveFilters;
  const isAllExpanded = defaultExpanded && expandedOverrides.size === 0;

  const toggleAllExpanded = useCallback(() => {
    setManualDefaultExpanded(!defaultExpanded);
    clear();
  }, [defaultExpanded, clear]);

  const sortedPolicies = useMemo(() => sortPoliciesDefaultFirst(allPolicies), [allPolicies]);

  // Filter to only selected trees (or all if no selection)
  const visiblePolicies = useMemo(() => {
    if (selectedPolicyTreeNames.length === 0) {
      return sortedPolicies;
    }
    return sortedPolicies.filter((policy) => {
      const name = policy.name ?? ROOT_ROUTE_NAME;
      return selectedPolicyTreeNames.includes(name);
    });
  }, [sortedPolicies, selectedPolicyTreeNames]);

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.policies-list.text-loading', 'Loading....')} />;
  }

  if (fetchPoliciesError) {
    return (
      <Alert title={t('alerting.policies-list.fetch.error', 'Failed to fetch policies')}>
        {stringifyErrorLike(fetchPoliciesError)}
      </Alert>
    );
  }

  return (
    <>
      <Stack direction="column" gap={2}>
        {/* Filter bar row */}
        <Stack direction="row" alignItems="flex-end" gap={1} wrap="wrap">
          <Button
            icon={isAllExpanded ? 'table-collapse-all' : 'table-expand-all'}
            onClick={toggleAllExpanded}
            variant="secondary"
            aria-label={
              isAllExpanded
                ? t('alerting.multiple-policies-view.collapse-all', 'Collapse all')
                : t('alerting.multiple-policies-view.expand-all', 'Expand all')
            }
          >
            {isAllExpanded ? (
              <Trans i18nKey="alerting.multiple-policies-view.collapse-all">Collapse all</Trans>
            ) : (
              <Trans i18nKey="alerting.multiple-policies-view.expand-all">Expand all</Trans>
            )}
          </Button>
          <NotificationPoliciesFilter
            onChangeMatchers={handleChangeLabelMatchers}
            onChangeReceiver={handleChangeContactPoint}
          />
          {createPoliciesSupported && (
            <Button
              data-testid="create-policy-button"
              icon="plus"
              aria-label={t('alerting.policies-list.create.aria-label', 'add policy')}
              variant="primary"
              disabled={!createPoliciesAllowed}
              onClick={openCreateModal}
            >
              <Trans i18nKey="alerting.policies-list.create.text">New notification policy</Trans>
            </Button>
          )}
        </Stack>

        <Stack direction="column" gap={0} alignItems="stretch">
          {visiblePolicies.map((policy) => (
            <PoliciesTree
              key={policy.name ?? ROOT_ROUTE_NAME}
              routeName={policy.name}
              contactPointFilter={contactPointFilter}
              labelMatchersFilter={labelMatchersFilter}
              defaultExpanded={defaultExpanded}
              expandedOverrides={expandedOverrides}
              onTogglePolicyExpanded={handleTogglePolicyExpanded}
              alertGroups={alertGroups}
              refetchAlertGroups={refetchAlertGroups}
              getRouteGroupsMap={getRouteGroupsMap}
            />
          ))}
        </Stack>
      </Stack>
      <CreateModal
        existingPolicyNames={existingPolicyNames}
        isOpen={isCreateModalOpen}
        onConfirm={(route) => createTrigger.execute(route)}
        onDismiss={closeCreateModal}
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    marginTop: theme.spacing(2),
  }),
});

interface QueryParamValues {
  tab: ActiveTab;
}

/**
 * Sort policies so that the default policy (ROOT_ROUTE_NAME or unnamed) comes first
 */
function sortPoliciesDefaultFirst<T extends { name?: string }>(policies: T[] | undefined): T[] {
  if (!policies) {
    return [];
  }
  return [...policies].sort((a, b) => {
    const aIsDefault = a.name === ROOT_ROUTE_NAME || !a.name;
    const bIsDefault = b.name === ROOT_ROUTE_NAME || !b.name;
    if (aIsDefault && !bIsDefault) {
      return -1;
    }
    if (!aIsDefault && bIsDefault) {
      return 1;
    }
    return 0;
  });
}

function getActiveTabFromUrl(queryParams: UrlQueryMap, defaultTab: ActiveTab): QueryParamValues {
  let tab = defaultTab;

  if (queryParams.tab === ActiveTab.NotificationPolicies) {
    tab = ActiveTab.NotificationPolicies;
  }

  if (queryParams.tab === ActiveTab.TimeIntervals) {
    tab = ActiveTab.TimeIntervals;
  }

  return {
    tab,
  };
}

function NotificationPoliciesPage() {
  const { navId, pageNav } = useNotificationPoliciesNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="notification">
      <NotificationPoliciesTabs />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationPoliciesPage);
