import { css } from '@emotion/css';

import { GrafanaTheme2, PanelData, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Button, IconButton, Text, useStyles2 } from '@grafana/ui';

import { VisualizationCardGrid } from './VisualizationCardGrid';

export interface Props {
  presets: PanelPluginVisualizationSuggestion[];
  data: PanelData; // @TODO
  onApply: (preset: PanelPluginVisualizationSuggestion) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function VisualizationPresets({ presets, data, onApply, onBack, onSkip }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <IconButton
            key="arrow-left"
            name="arrow-left"
            variant="primary"
            size="xl"
            aria-label={t('panel.presets.back-button', 'Back')}
            tooltip={t('panel.presets.back-button-tooltip', 'Go back')}
            data-testid={selectors.components.PanelEditor.toggleVizPicker}
            onClick={onBack}
          />
          <Text element="p" variant="body">
            <Trans i18nKey="panel.presets.title">Select style</Trans>
          </Text>
        </div>
        <Button variant="primary" fill="text" onClick={onSkip}>
          <Trans i18nKey="panel.presets.skip-button">Skip</Trans>
        </Button>
      </div>
      <VisualizationCardGrid
        items={presets}
        data={data}
        onItemClick={(preset) => onApply(preset)}
        getItemKey={(preset) => preset.hash}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing(0.5),
  }),
  headerLeft: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});
