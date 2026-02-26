import { css } from '@emotion/css';

import { ActionModel, GrafanaTheme2, LinkModel } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VizTooltipFooter } from '@grafana/ui/internal';

import { AnnotationTooltipBody } from './AnnotationTooltipBody';
import { AnnotationTooltipHeader } from './AnnotationTooltipHeader';
import { useAnnotationTooltip } from './useAnnotationTooltip';

export interface AnnotationTooltipProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annoVals: Record<string, any[]>;
  annoIdx: number;
  timeZone: string;
  isPinned: boolean;
  onClose: () => void;
  onEdit: () => void;
  links?: LinkModel[];
  actions?: ActionModel[];
}

export const AnnotationTooltip2 = ({
  annoVals,
  annoIdx,
  timeZone,
  isPinned,
  onClose,
  onEdit,
  links = [],
  actions = [],
}: AnnotationTooltipProps) => {
  const styles = useStyles2(getStyles);
  let { onAnnotationDelete, canEdit, canDelete, time, text, alertText, alertState, avatarImgSrc, title } =
    useAnnotationTooltip(annoVals, annoIdx, timeZone);

  return (
    <div className={styles.wrapper}>
      <AnnotationTooltipHeader
        avatarImg={avatarImgSrc}
        alertState={alertState}
        timeRange={time}
        canEdit={canEdit}
        canDelete={canDelete}
        isPinned={isPinned}
        onEdit={onEdit}
        onDelete={onAnnotationDelete}
        onRemove={(e) => {
          // Don't trigger onClick
          e.stopPropagation();
          onClose();
        }}
      />

      <AnnotationTooltipBody title={title} text={text} alertText={alertText} tags={annoVals.tags} annoIdx={annoIdx} />

      {(links.length > 0 || actions.length > 0) && <VizTooltipFooter dataLinks={links} actions={actions} />}
    </div>
  );
};

// @todo clean up
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
