import { FieldConfigSource, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

/**
 * Returns presets for a panel
 * @TODO: error handling?
 */
export async function getPresets(
  pluginId: string,
  fieldConfig?: FieldConfigSource
): Promise<PanelPluginVisualizationSuggestion[]> {
  const plugin = await importPanelPlugin(pluginId);
  return plugin.getPresets({ fieldConfig }) ?? [];
}
