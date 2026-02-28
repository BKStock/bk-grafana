import { css } from '@emotion/css';

import { GrafanaTheme2, PanelData, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

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
        <Button
          fill="text"
          icon="arrow-left"
          aria-label={t('panel.presets.back-button-text', 'Go back')}
          onClick={onBack}
        >
          <Trans i18nKey="panel.presets.back-button-text">Go back</Trans>
        </Button>
        <Text element="p" variant="body">
          <Trans i18nKey="panel.presets.title">Select style</Trans>
        </Text>
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
