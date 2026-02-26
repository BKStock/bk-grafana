import { css } from '@emotion/css';
import classNames from 'classnames';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { CollapsableSection, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { getPluginNameForControlSource } from '../../utils/dashboardControls';

import { getDefinition } from './utils';

type Props = {
  variables: Array<SceneVariable<SceneVariableState>>;
};

export function SystemVariablesSection({ variables }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <CollapsableSection label={<SystemVariablesSectionLabel />} isOpen={isOpen} onToggle={setIsOpen}>
        <table className={classNames('filter-table', 'filter-table--hover', styles.table)} role="grid">
          <thead>
            <tr>
              <th>
                <Trans i18nKey="dashboard-scene.variable-editor-list.variable">Variable</Trans>
              </th>
              <th>
                <Trans i18nKey="dashboard-scene.variable-editor-list.definition">Definition</Trans>
              </th>
              <th className={styles.thNarrow} />
            </tr>
          </thead>
          <tbody>
            {variables.map((variable, index) => {
              const variableState = variable.state;
              const origin = variableState.origin;
              const pluginName = getPluginNameForControlSource(origin);

              return (
                <tr key={`${variableState.name}-${index}`}>
                  <td role="gridcell" className={styles.nameCell}>
                    {variableState.name}
                  </td>
                  <td role="gridcell" className={styles.definitionColumn}>
                    {getDefinition(variable)}
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

function SystemVariablesSectionLabel() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Icon name="database" className={styles.iconMuted} />
      <Text variant="h5">
        <Trans i18nKey="dashboard-scene.system-variables-section.label">Provisioned by data source</Trans>
      </Text>
    </Stack>
  );
}

function getSourceTooltip(pluginName: string | undefined): string {
  if (pluginName) {
    return t('dashboard-scene.system-variables-section.tooltip', 'Added by the {{pluginName}} plugin', {
      pluginName,
    });
  }
  return t('dashboard-scene.system-variables-section.tooltip-unknown', 'Added by a data source plugin');
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
  nameCell: css({
    fontWeight: theme.typography.fontWeightMedium,
    width: '20%',
  }),
  definitionColumn: css({
    width: '70%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 0,
  }),
  sourceCell: css({
    width: '1%',
    textAlign: 'center',
  }),
  iconMuted: css({
    color: theme.colors.text.secondary,
  }),
});
