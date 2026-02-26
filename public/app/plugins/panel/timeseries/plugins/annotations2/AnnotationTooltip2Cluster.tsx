import { css } from '@emotion/css';
import * as React from 'react';

import {
  GrafanaTheme2,
  dateTimeFormat,
  systemDateFormats,
  textUtil,
  LinkModel,
  ActionModel,
  Field,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, IconButton, Tag, useStyles2, ScrollContainer } from '@grafana/ui';
import { VizTooltipFooter } from '@grafana/ui/internal';
import alertDef from 'app/features/alerting/state/alertDef';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annoVals: Record<string, any[]>;
  annoIdx: number;
  timeZone: string;
  isPinned: boolean;
  onClose: () => void;
  links?: LinkModel[];
  actions: Array<ActionModel<Field>>;
}

export const AnnotationTooltip2Cluster = ({
  annoVals,
  annoIdx,
  timeZone,
  isPinned,
  onClose,
  links,
  actions,
}: Props) => {
  console.log('AnnotationTooltip2Cluster', annoVals);
  // const annoId = annoVals.id?.[annoIdx];

  const styles = useStyles2(getStyles);
  const focusRef = React.useRef<HTMLButtonElement | null>(null);
  // const { canEditAnnotations = retFalse, canDeleteAnnotations = retFalse, onAnnotationDelete } = usePanelContext();

  React.useEffect(() => {
    if (isPinned) {
      focusRef.current?.focus();
    }
  }, [isPinned]);

  const timeFormatter = (value: number) =>
    dateTimeFormat(value, {
      format: systemDateFormats.fullDate,
      timeZone,
    });

  let items: React.ReactNode[] = [];

  let clusterIdx = annoVals.clusterIdx[annoIdx];

  for (let i = 0; i < annoVals.time.length; i++) {
    if (annoVals.clusterIdx[i] === clusterIdx && i !== annoIdx) {
      let text = annoVals.text?.[i] ?? '';
      let alertText = '';

      if (annoVals.alertId?.[i] !== undefined && annoVals.newState?.[i]) {
        alertText = annoVals.data?.[i] ? alertDef.getAlertAnnotationText(annoVals.data[i]) : '';
      } else if (annoVals.title?.[i]) {
        text = annoVals.title[i] + (text ? `<br />${text}` : '');
      }

      items.push(
        <div className={styles.body}>
          {text && <div className={styles.text} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(text) }} />}
          {alertText}
          <div>
            <Stack gap={0.5} wrap={true}>
              {annoVals.tags?.[i]?.map((t: string, i: number) => (
                <Tag name={t} key={`${t}-${i}`} />
              ))}
            </Stack>
          </div>
        </div>
      );
    }
  }

  let time = timeFormatter(annoVals.time[annoIdx]);

  if (annoVals.isRegion?.[annoIdx]) {
    time += ' - ' + timeFormatter(annoVals.timeEnd[annoIdx]);
  }

  let avatar = '';
  let state = '';

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Stack gap={2} basis="100%" justifyContent="space-between" alignItems="center">
          <div className={styles.meta}>
            <span>
              {avatar}
              {state}
            </span>
            {time}
          </div>

          {isPinned && (
            // @todo canEdit/canDelete is set when user cannot edit/delete
            <div className={styles.controls}>
              {isPinned && (
                <IconButton
                  name={'times'}
                  size={'sm'}
                  onClick={(e) => {
                    // Don't trigger onClick
                    e.stopPropagation();
                    onClose();
                  }}
                  tooltip={t('timeseries.annotation-tooltip2.tooltip-close', 'Close')}
                />
              )}
            </div>
          )}
        </Stack>
      </div>

      <ScrollContainer maxHeight="200px">{items}</ScrollContainer>

      <VizTooltipFooter actions={actions} dataLinks={links ?? []} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    zIndex: theme.zIndex.tooltip,
    whiteSpace: 'initial',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    userSelect: 'text',
  }),
  header: css({
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.fontSize,
    color: theme.colors.text.primary,
    display: 'flex',
  }),
  meta: css({
    display: 'flex',
    color: theme.colors.text.primary,
    fontWeight: 400,
  }),
  controls: css({
    display: 'flex',
    '> :last-child': {
      marginLeft: 0,
    },
  }),
  body: css({
    padding: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    fontWeight: 400,
    a: {
      color: theme.colors.text.link,
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  }),
  text: css({
    paddingBottom: theme.spacing(1),
  }),
  avatar: css({
    borderRadius: theme.shape.radius.circle,
    width: 16,
    height: 16,
    marginRight: theme.spacing(1),
  }),
  alertState: css({
    paddingRight: theme.spacing(1),
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
