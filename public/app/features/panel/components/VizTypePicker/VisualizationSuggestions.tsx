import { css } from '@emotion/css';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAsyncRetry } from 'react-use';

import {
  GrafanaTheme2,
  PanelData,
  PanelModel,
  PanelPluginMeta,
  PanelPluginVisualizationSuggestion,
  VisualizationSuggestion,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button, Icon, Spinner, Text, useStyles2 } from '@grafana/ui';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

import { useStructureRev } from '../../../explore/Graph/useStructureRev';
import { getPresetsForPanel } from '../../presets/getPresets';
import { getAllPanelPluginMeta, filterPluginList } from '../../state/util';
import { panelsWithoutData } from '../../suggestions/consts';
import { getAllSuggestions } from '../../suggestions/getAllSuggestions';
import { hasData } from '../../suggestions/utils';

import { VisualizationCardGrid, VisualizationCardGridGroup } from './VisualizationCardGrid';
import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { VizSuggestionsInteractions, PANEL_STATES, type PanelState } from './interactions';
import { VizTypeChangeDetails } from './types';

export interface Props {
  onChange: (options: VizTypeChangeDetails, panel?: VizPanel) => void;
  data?: PanelData;
  panel?: PanelModel;
  vizPanel?: VizPanel;
  searchQuery?: string;
  isNewPanel?: boolean;
  onShowPresets?: (suggestion: PanelPluginVisualizationSuggestion, presets: VisualizationSuggestion[]) => void;
}

const useSuggestions = (data: PanelData | undefined, searchQuery: string | undefined) => {
  const [hasFetched, setHasFetched] = useState(false);
  const structureRev = useStructureRev(data?.series ?? []);

  const { value, loading, error, retry } = useAsyncRetry(async () => {
    await new Promise((resolve) => setTimeout(resolve, hasFetched ? 75 : 0));
    setHasFetched(true);
    return await getAllSuggestions(data?.series);
  }, [hasFetched, structureRev]);

  const filteredValue = useMemo(() => {
    if (!value || !searchQuery) {
      return value;
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredSuggestions = value.suggestions.filter(
      (suggestion) =>
        suggestion.name.toLowerCase().includes(lowerCaseQuery) ||
        suggestion.pluginId.toLowerCase().includes(lowerCaseQuery) ||
        suggestion.description?.toLowerCase().includes(lowerCaseQuery)
    );

    return {
      ...value,
      suggestions: filteredSuggestions,
    };
  }, [value, searchQuery]);

  return { value: filteredValue, loading, error, retry };
};

export function VisualizationSuggestions({
  onChange,
  data,
  panel,
  vizPanel,
  searchQuery,
  isNewPanel,
  onShowPresets,
}: Props) {
  const styles = useStyles2(getStyles);

  const { value: result, loading, error, retry } = useSuggestions(data, searchQuery);

  const suggestions = result?.suggestions;
  const hasLoadingErrors = result?.hasErrors ?? false;
  const [firstCardHash, setFirstCardHash] = useState<string | null>(null);
  const isNewVizSuggestionsEnabled = config.featureToggles.newVizSuggestions;
  const isUnconfiguredPanel =
    vizPanel?.state.pluginId === UNCONFIGURED_PANEL_PLUGIN_ID || panel?.type === UNCONFIGURED_PANEL_PLUGIN_ID;

  const panelState = useMemo((): PanelState => {
    if (isUnconfiguredPanel) {
      return PANEL_STATES.UNCONFIGURED_PANEL;
    }

    if (isNewPanel) {
      return PANEL_STATES.NEW_PANEL;
    }

    return PANEL_STATES.EXISTING_PANEL;
  }, [isUnconfiguredPanel, isNewPanel]);

  const suggestionsByVizType = useMemo((): VisualizationCardGridGroup[] => {
    const meta = getAllPanelPluginMeta();
    const record: Record<string, PanelPluginMeta> = {};
    for (const m of meta) {
      record[m.id] = m;
    }

    const result: VisualizationCardGridGroup[] = [];
    let currentVizType: PanelPluginMeta | undefined = undefined;
    for (const suggestion of suggestions || []) {
      const vizType = record[suggestion.pluginId];
      if (!currentVizType || currentVizType.id !== vizType?.id) {
        currentVizType = vizType;
        result.push({ meta: vizType, items: [] });
      }
      result[result.length - 1].items.push(suggestion);
    }
    return result;
  }, [suggestions]);

  const applySuggestion = useCallback(
    (
      suggestion: PanelPluginVisualizationSuggestion,
      suggestionIndex: number,
      isAutoSelected = false,
      shouldCloseVizPicker = false
    ) => {
      if (shouldCloseVizPicker) {
        VizSuggestionsInteractions.suggestionAccepted({
          pluginId: suggestion.pluginId,
          suggestionName: suggestion.name,
          panelState,
          suggestionIndex: suggestionIndex + 1,
        });
      }

      onChange({
        pluginId: suggestion.pluginId,
        options: suggestion.options,
        fieldConfig: suggestion.fieldConfig,
        withModKey: !shouldCloseVizPicker,
        fromSuggestions: true,
      });
    },
    [onChange, panelState]
  );

  const handleSuggestionClick = useCallback(
    async (item: PanelPluginVisualizationSuggestion, index: number) => {
      if (config.featureToggles.vizPresets && onShowPresets && vizPanel) {
        try {
          const presetsResult = await getPresetsForPanel(item.pluginId, vizPanel);
          if (presetsResult.presets && presetsResult.presets.length > 0) {
            applySuggestion(item, index, false, false);
            onShowPresets(item, presetsResult.presets);
            return;
          }
        } catch (error) {
          console.error('Failed to load presets:', error);
        }
      }
      applySuggestion(item, index, false, true);
    },
    [applySuggestion, onShowPresets, vizPanel]
  );

  useEffect(() => {
    if (!isNewVizSuggestionsEnabled || !suggestions || suggestions.length === 0 || !isUnconfiguredPanel) {
      return;
    }

    // Only auto-apply the first suggestion for unconfigured panels.
    // For existing panels, do not auto-select when navigating back to the suggestions tab.
    if (!isUnconfiguredPanel) {
      return;
    }

    // Skip auto-selection until real data arrives; `data` is omitted from deps
    // because suggestions already re-compute when data changes.
    if (!data || !hasData(data)) {
      return;
    }

    // if the first suggestion has changed, we're going to change the currently selected suggestion and
    // set the firstCardHash to the new first suggestion's hash. We also choose the first suggestion if
    // the previously selected suggestion is no longer present in the list.
    const newFirstCardHash = suggestions[0]?.hash ?? null;
    if (firstCardHash !== newFirstCardHash) {
      applySuggestion(suggestions[0], 0, true, false);
      setFirstCardHash(newFirstCardHash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, firstCardHash, isNewVizSuggestionsEnabled, isUnconfiguredPanel, applySuggestion]);

  if (loading || !data) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="xxl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert title={t('panel.visualization-suggestions.error-loading-suggestions.title', 'Error')} severity="error">
        <Trans i18nKey="panel.visualization-suggestions.error-loading-suggestions.message">
          An error occurred when loading visualization suggestions.
        </Trans>
      </Alert>
    );
  }

  if (isNewVizSuggestionsEnabled && !hasData(data)) {
    return <NoDataPanelList searchQuery={searchQuery} panel={panel} onChange={onChange} />;
  }

  return (
    <>
      {hasLoadingErrors && (
        <Alert severity="warning" title={''}>
          <div className={styles.alertContent}>
            <Trans i18nKey="panel.visualization-suggestions.error-loading-some-suggestions.message">
              Some suggestions could not be loaded
            </Trans>
            <Button variant="secondary" size="sm" onClick={retry}>
              <Trans i18nKey="panel.visualization-suggestions.error-loading-suggestions.try-again-button">
                Try again
              </Trans>
            </Button>
          </div>
        </Alert>
      )}
      <VisualizationCardGrid
        groups={isNewVizSuggestionsEnabled ? suggestionsByVizType : undefined}
        items={!isNewVizSuggestionsEnabled ? suggestions : undefined}
        data={data!}
        onItemClick={handleSuggestionClick}
        getItemKey={(item) => item.hash}
      />
    </>
  );
}

interface NoDataPanelListProps {
  searchQuery?: string;
  panel?: PanelModel;
  onChange: (options: VizTypeChangeDetails) => void;
}

function NoDataPanelList({ searchQuery, panel, onChange }: NoDataPanelListProps) {
  const styles = useStyles2(getStyles);
  const noDataPanels = useMemo(() => {
    const panels = getAllPanelPluginMeta().filter((p) => panelsWithoutData.has(p.id));
    return filterPluginList(panels, searchQuery ?? '', panel?.type);
  }, [searchQuery, panel?.type]);

  return (
    <>
      <div className={styles.emptyStateWrapper}>
        <Icon name="chart-line" size="xxxl" className={styles.emptyStateIcon} />
        <Text element="p" textAlignment="center" color="secondary">
          <Trans i18nKey="panel.visualization-suggestions.run-query-hint">
            Run a query to start seeing suggested visualizations
          </Trans>
        </Text>
      </div>
      <div className={styles.orDivider}>
        <div className={styles.orDividerLine} />
        <Text color="secondary" variant="body">
          <Trans i18nKey="panel.visualization-suggestions.or-divider">OR</Trans>
        </Text>
        <div className={styles.orDividerLine} />
      </div>
      <div className={styles.startWithoutDataSection}>
        <Text element="p" textAlignment="center" color="secondary" variant="body">
          <Trans i18nKey="panel.visualization-suggestions.start-without-data-title">Start without data</Trans>
        </Text>
        <Text element="p" textAlignment="center" color="secondary" variant="bodySmall">
          <Trans i18nKey="panel.visualization-suggestions.start-without-data-description">
            Add panels that don&apos;t require a query
          </Trans>
        </Text>
      </div>
      {noDataPanels.map((plugin) => (
        <VizTypePickerPlugin
          key={plugin.id}
          isCurrent={plugin.id === panel?.type}
          plugin={plugin}
          disabled={false}
          onSelect={(withModKey) =>
            onChange({
              pluginId: plugin.id,
              withModKey,
            })
          }
        />
      ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    loadingContainer: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      marginTop: theme.spacing(6),
    }),
    alertContent: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }),
    emptyStateWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(4, 2, 2),
      textAlign: 'center',
    }),
    emptyStateIcon: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
    }),
    orDivider: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      padding: theme.spacing(1, 2),
    }),
    orDividerLine: css({
      flex: 1,
      height: '1px',
      background: theme.colors.border.weak,
    }),
    startWithoutDataSection: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1, 2, 2),
    }),
    cardContainer: css({
      position: 'relative',
    }),
    vizTypeHeader: css({
      gridColumn: '1 / -1',
      marginBottom: theme.spacing(0.5),
      marginTop: theme.spacing(2),
      '&:first-of-type': {
        marginTop: 0,
      },
    }),
    vizTypeLogo: css({
      filter: 'grayscale(100%)',
      maxHeight: `${theme.typography.body.lineHeight}em`,
      width: `${theme.typography.body.lineHeight}em`,
      alignItems: 'center',
      display: 'inline-block',
      marginRight: theme.spacing(1),
    }),
    applySuggestionButton: css({
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
      padding: theme.spacing(0, 2),
    }),
  };
};
