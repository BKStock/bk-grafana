import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { sanitizeUrl } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { DashboardLink } from '@grafana/schema';
import { MenuItem, Tooltip, useStyles2 } from '@grafana/ui';
import {
  DashboardLinkButton,
  DashboardLinksDashboard,
} from 'app/features/dashboard/components/SubMenu/DashboardLinksDashboard';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

import { LINK_ICON_MAP } from '../settings/links/utils';

export interface Props {
  link: DashboardLink;
  dashboardUID: string;
  // Set to `true` if displaying a link in a drop-down menu (e.g. dashboard controls)
  inMenu?: boolean;
  /** When set, clicking the link opens the edit pane instead of navigating (edit mode) */
  onEditClick?: (e: React.PointerEvent) => void;
}

export function DashboardLinkRenderer({ link, dashboardUID, inMenu, onEditClick }: Props) {
  const linkInfo = getLinkSrv().getAnchorInfo(link);
  const styles = useStyles2(getStyles);
  const isEditMode = Boolean(onEditClick);

  const handleEditPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEditClick?.(e);
  };

  let content: React.ReactNode;
  if (link.type === 'dashboards') {
    content = (
      <div className={isEditMode ? styles.pointerEventsNone : undefined}>
        <DashboardLinksDashboard link={link} linkInfo={linkInfo} dashboardUID={dashboardUID} />
      </div>
    );
  } else {
    const icon = LINK_ICON_MAP[link.icon];
    const linkElement = inMenu ? (
      <MenuItem
        icon={icon}
        url={sanitizeUrl(linkInfo.href)}
        label={linkInfo.title}
        target={link.targetBlank ? '_blank' : undefined}
        data-testid={selectors.components.DashboardLinks.link}
      />
    ) : (
      <DashboardLinkButton
        icon={icon}
        href={sanitizeUrl(linkInfo.href)}
        target={link.targetBlank ? '_blank' : undefined}
        rel="noreferrer"
        data-testid={selectors.components.DashboardLinks.link}
      >
        {linkInfo.title}
      </DashboardLinkButton>
    );
    content = link.tooltip ? <Tooltip content={linkInfo.tooltip}>{linkElement}</Tooltip> : linkElement;
    if (isEditMode) {
      content = <div className={styles.pointerEventsNone}>{content}</div>;
    }
  }

  const containerClassName = cx(
    isEditMode ? styles.clickableLinkContainer : styles.linkContainer,
    isEditMode && 'dashboard-selectable-element'
  );

  return (
    <div
      className={containerClassName}
      data-testid={selectors.components.DashboardLinks.container}
      onPointerDown={isEditMode ? handleEditPointerDown : undefined}
      role={isEditMode ? 'button' : undefined}
      tabIndex={isEditMode ? 0 : undefined}
    >
      {content}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    linkContainer: css({
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      lineHeight: 1,
    }),
    clickableLinkContainer: css({
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      lineHeight: 1,
      cursor: 'pointer',
    }),
    // In edit mode, disable pointer events on the inner link so the wrapper always receives the click.
    // Use inline-flex + alignItems center + lineHeight 1 so this wrapper doesn't shift vertical alignment vs variables/annotations.
    pointerEventsNone: css({
      display: 'inline-flex',
      alignItems: 'center',
      lineHeight: 1,
      pointerEvents: 'none',
    }),
  };
}
