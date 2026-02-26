import { css } from '@emotion/css';
import classNames from 'classnames';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DashboardLink } from '@grafana/schema';
import { CollapsableSection, Icon, Stack, TagList, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { getPluginNameForControlSource } from '../../utils/dashboardControls';

type Props = {
  links: DashboardLink[];
};

export function SystemLinksSection({ links }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <CollapsableSection label={<SystemLinksSectionLabel />} isOpen={isOpen} onToggle={setIsOpen}>
        <table className={classNames('filter-table', 'filter-table--hover', styles.table)} role="grid">
          <thead>
            <tr>
              <th>
                <Trans i18nKey="dashboard-scene.dashboard-link-list.type">Type</Trans>
              </th>
              <th>
                <Trans i18nKey="dashboard-scene.dashboard-link-list.info">Info</Trans>
              </th>
              <th className={styles.thNarrow} />
            </tr>
          </thead>
          <tbody>
            {links.map((link, index) => {
              const pluginName = getPluginNameForControlSource(link.origin);

              return (
                <tr key={`${link.title}-${index}`}>
                  <td role="gridcell">
                    <Icon name="external-link-alt" /> &nbsp; {link.type}
                  </td>
                  <td role="gridcell">
                    <Stack>
                      {link.title && <span className={styles.titleWrapper}>{link.title}</span>}
                      {link.type === 'link' && <span className={styles.urlWrapper}>{link.url}</span>}
                      {link.type === 'dashboards' && <TagList tags={link.tags ?? []} />}
                    </Stack>
                  </td>
                  <td role="gridcell" className={styles.sourceCell}>
                    <Tooltip content={getSourceTooltip(pluginName)}>
                      <Icon name="database" className={styles.iconMuted} aria-hidden />
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CollapsableSection>
    </div>
  );
}

function SystemLinksSectionLabel() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Icon name="database" className={styles.iconMuted} />
      <Text variant="h5">
        <Trans i18nKey="dashboard-scene.system-links-section.label">Provisioned by data source</Trans>
      </Text>
    </Stack>
  );
}

function getSourceTooltip(pluginName: string | undefined): string {
  if (pluginName) {
    return t('dashboard-scene.system-links-section.tooltip', 'Added by the {{pluginName}} plugin', { pluginName });
  }
  return t('dashboard-scene.system-links-section.tooltip-unknown', 'Added by a data source plugin');
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: theme.spacing(3),
  }),
  table: css({
    width: '100%',
  }),
  thNarrow: css({
    width: '1%',
  }),
  titleWrapper: css({
    width: '20vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  urlWrapper: css({
    width: '40vw',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  sourceCell: css({
    width: '1%',
    textAlign: 'center',
  }),
  iconMuted: css({
    color: theme.colors.text.secondary,
  }),
});
