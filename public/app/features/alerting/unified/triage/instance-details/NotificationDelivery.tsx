import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';

import {
  CreateNotificationqueryNotificationEntry,
  useCreateNotificationqueryMutation,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2, IconName, Labels, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box, Icon, LoadingPlaceholder, Stack, Text, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaAlertState, mapStateWithReasonToBaseState } from 'app/types/unified-alerting-dto';

import { LogRecord } from '../../components/rules/state-history/common';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface StateSegment {
  state: GrafanaAlertState;
  from: number;
  to: number;
  durationMs: number;
}

function buildStateSegments(records: LogRecord[]): StateSegment[] {
  if (records.length === 0) {
    return [];
  }

  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const segments: StateSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];
    const nextTimestamp = i < sorted.length - 1 ? sorted[i + 1].timestamp : Date.now();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const baseState = mapStateWithReasonToBaseState(record.line.current) as GrafanaAlertState;

    segments.push({
      state: baseState,
      from: record.timestamp,
      to: nextTimestamp,
      durationMs: nextTimestamp - record.timestamp,
    });
  }

  return segments;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function stateToColor(state: string, theme: GrafanaTheme2): string {
  switch (state) {
    case 'Normal':
      return theme.colors.success.main;
    case 'Pending':
    case 'Recovering':
      return theme.colors.warning.main;
    case 'Alerting':
      return theme.colors.error.main;
    case 'NoData':
      return theme.colors.info.main;
    case 'Error':
      return theme.colors.warning.main;
    default:
      return theme.colors.secondary.main;
  }
}

function labelsToMatchers(labels: Labels) {
  return Object.entries(labels).map(([label, value]) => ({
    label,
    type: '=' as const,
    value,
  }));
}

interface NotificationDeliveryProps {
  ruleUID: string;
  instanceLabels: Labels;
  timeRange: TimeRange;
  records: LogRecord[];
}

export function NotificationDelivery({ ruleUID, instanceLabels, timeRange, records }: NotificationDeliveryProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const [createNotificationQuery, { data, isLoading, isError }] = useCreateNotificationqueryMutation();

  useEffect(() => {
    if (!timeRange?.from || !timeRange?.to) {
      return;
    }

    const labels = labelsToMatchers(instanceLabels);

    createNotificationQuery({
      createNotificationqueryRequestBody: {
        ruleUID,
        from: timeRange.from.toISOString(),
        to: timeRange.to.toISOString(),
        ...(labels.length > 0 && { labels }),
      },
    });
  }, [createNotificationQuery, ruleUID, instanceLabels, timeRange]);

  const notifications = useMemo(() => {
    const entries = data?.entries ?? [];
    return [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data?.entries]);

  const segments = useMemo(() => buildStateSegments(records), [records]);
  const totalDuration = useMemo(() => {
    if (segments.length === 0) {
      return 0;
    }
    return segments[segments.length - 1].to - segments[0].from;
  }, [segments]);

  if (records.length === 0) {
    return null;
  }

  return (
    <Box>
      <Stack direction="column" gap={2}>
        <Stack direction="column" gap={0.5}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon name="bell" />
            <Text variant="h5">{t('alerting.instance-details.notification-delivery', 'Notification Delivery')}</Text>
          </Stack>
          <Text variant="bodySmall" color="secondary">
            {t('alerting.instance-details.notification-delivery-scope', 'Showing notifications for this alert rule')}
          </Text>
        </Stack>

        {/* State Timeline Bar */}
        {segments.length > 0 && (
          <Stack direction="column" gap={0.5}>
            <div className={styles.timelineBar}>
              {segments.map((segment, index) => {
                const widthPercent =
                  totalDuration > 0 ? (segment.durationMs / totalDuration) * 100 : 100 / segments.length;
                return (
                  <Tooltip
                    key={index}
                    content={t('alerting.instance-details.segment-tooltip', '{{state}}: {{duration}}', {
                      state: segment.state,
                      duration: formatDuration(segment.durationMs),
                    })}
                  >
                    <div
                      className={styles.timelineSegment}
                      style={{
                        width: `${Math.max(widthPercent, 2)}%`,
                        backgroundColor: stateToColor(segment.state, theme),
                      }}
                    >
                      {widthPercent > 12 && (
                        <Text variant="bodySmall" color="maxContrast" truncate>
                          {segment.state}
                        </Text>
                      )}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
            <Stack direction="row" justifyContent="space-between">
              <Text variant="bodySmall" color="secondary">
                {dateFormatter.format(new Date(segments[0].from))}
              </Text>
              <Text variant="bodySmall" color="secondary">
                {dateFormatter.format(new Date(segments[segments.length - 1].to))}
              </Text>
            </Stack>
          </Stack>
        )}

        {/* Notification list */}
        {isLoading && (
          <LoadingPlaceholder text={t('alerting.instance-details.loading-notifications', 'Loading notifications...')} />
        )}
        {isError && (
          <Alert
            severity="warning"
            title={t('alerting.instance-details.notifications-error', 'Could not load notification history')}
          >
            {t(
              'alerting.instance-details.notifications-error-desc',
              'Notification history may not be enabled. Enable the alertingNotificationHistory feature toggle.'
            )}
          </Alert>
        )}
        {!isLoading && !isError && notifications.length === 0 && (
          <Text color="secondary">
            {t('alerting.instance-details.no-notifications', 'No notifications found for this time range')}
          </Text>
        )}
        {!isLoading && !isError && notifications.length > 0 && <NotificationGroups notifications={notifications} />}
      </Stack>
    </Box>
  );
}

interface NotificationGroup {
  label: string;
  status: 'firing' | 'resolved';
  notifications: NotificationEntry[];
}

function groupNotifications(notifications: NotificationEntry[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  let currentGroup: NotificationGroup | null = null;

  for (const n of notifications) {
    const ts = new Date(n.timestamp).getTime();
    const belongsToCurrent =
      currentGroup &&
      currentGroup.status === n.status &&
      currentGroup.notifications.length > 0 &&
      ts - new Date(currentGroup.notifications[currentGroup.notifications.length - 1].timestamp).getTime() < 60 * 1000;

    if (belongsToCurrent && currentGroup) {
      currentGroup.notifications.push(n);
    } else {
      currentGroup = {
        label: n.status === 'firing' ? 'Firing' : 'Resolved',
        status: n.status,
        notifications: [n],
      };
      groups.push(currentGroup);
    }
  }

  let firingCount = 0;
  for (const g of groups) {
    if (g.status === 'firing') {
      firingCount++;
      g.label = firingCount === 1 ? 'Firing' : `Firing (repeat #${firingCount - 1})`;
    }
  }

  return groups;
}

function NotificationGroups({ notifications }: { notifications: NotificationEntry[] }) {
  const styles = useStyles2(getStyles);
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  return (
    <Stack direction="column" gap={2}>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className={styles.notificationList}>
          <div className={group.status === 'resolved' ? styles.groupHeaderResolved : styles.groupHeaderFiring}>
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name={group.status === 'firing' ? 'fire' : 'check-circle'} size="sm" />
              <Text variant="bodySmall" weight="medium">
                {group.label}
              </Text>
              <Text variant="bodySmall" color="secondary">
                {dateFormatter.format(new Date(group.notifications[0].timestamp))}
              </Text>
            </Stack>
          </div>
          {group.notifications.map((notification, index) => (
            <div key={index} className={styles.notificationRow}>
              <div className={styles.colTime}>
                <Text variant="bodySmall">{dateFormatter.format(new Date(notification.timestamp))}</Text>
              </div>
              <div className={styles.colReceiver}>
                <Stack direction="row" gap={1} alignItems="center">
                  <IntegrationIcon integration={notification.integration} />
                  <Text variant="bodySmall" truncate>
                    {notification.receiver}
                  </Text>
                </Stack>
              </div>
              <div className={styles.colStatus}>
                {notification.outcome === 'success' ? (
                  <Stack direction="row" gap={0.5} alignItems="center">
                    <Icon name="check-circle" size="sm" className={styles.successIcon} />
                    <Text variant="bodySmall" color="success">
                      {t('alerting.instance-details.delivered', 'Delivered')}
                    </Text>
                  </Stack>
                ) : (
                  <Tooltip
                    content={notification.error || t('alerting.instance-details.unknown-error', 'Unknown error')}
                  >
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <Icon name="exclamation-circle" size="sm" className={styles.errorIcon} />
                      <Text variant="bodySmall" color="error">
                        {t('alerting.instance-details.failed', 'Failed')}
                      </Text>
                    </Stack>
                  </Tooltip>
                )}
              </div>
              <div className={styles.colDuration}>
                <Text variant="bodySmall" color="secondary">
                  {formatDuration(notification.duration)}
                </Text>
              </div>
            </div>
          ))}
        </div>
      ))}
    </Stack>
  );
}

function IntegrationIcon({ integration }: { integration: string }) {
  const iconMap: Record<string, IconName> = {
    slack: 'slack',
    email: 'envelope',
    pagerduty: 'fire',
    webhook: 'link',
    teams: 'microsoft',
    telegram: 'message',
    opsgenie: 'bell',
  };

  return <Icon name={iconMap[integration] || 'bell'} size="sm" />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  timelineBar: css({
    display: 'flex',
    flexDirection: 'row',
    height: '32px',
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.border.weak}`,
  }),

  timelineSegment: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'opacity 0.2s',
    },
    '&:hover': {
      opacity: 0.8,
    },
    '&:not(:last-child)': {
      borderRight: `1px solid ${theme.colors.background.primary}`,
    },
  }),

  notificationList: css({
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),

  groupHeaderFiring: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing(1, 1.5),
    backgroundColor: theme.colors.error.transparent,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.error.text,
  }),

  groupHeaderResolved: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing(1, 1.5),
    backgroundColor: theme.colors.success.transparent,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.success.text,
  }),

  notificationRow: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing(1, 1.5),
    '&:not(:last-child)': {
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
    },
  }),

  colTime: css({
    width: '100px',
    flexShrink: 0,
  }),

  colReceiver: css({
    flex: 1,
    minWidth: 0,
  }),

  colStatus: css({
    width: '120px',
    flexShrink: 0,
  }),

  colDuration: css({
    width: '80px',
    flexShrink: 0,
    textAlign: 'right',
  }),

  successIcon: css({
    color: theme.colors.success.main,
  }),

  errorIcon: css({
    color: theme.colors.error.main,
  }),
});
