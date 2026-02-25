import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { DashboardScene } from '../../scene/DashboardScene';
import { openAddLinkPane } from '../../settings/links/LinkAddEditableElement';

import { AddButton } from './AddButton';

export function AddLink({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddLinkClick = useCallback(() => {
    openAddLinkPane(dashboardScene);
  }, [dashboardScene]);

  return (
    <AddButton
      icon="external-link-alt"
      label={t('dashboard-scene.add-link.label-link', 'Link')}
      tooltip={t('dashboard-scene.add-link.tooltip', 'Add link to another dashboard or external site')}
      onClick={onAddLinkClick}
    />
  );
}
