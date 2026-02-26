/**
 * Shared panel plugin change utility.
 *
 * Encapsulates the implicit dashboard behaviors when changing a panel's
 * visualization type: clearing custom fieldConfig, filtering overrides
 * to standard properties, calling changePluginType, and applying
 * caller-provided options/fieldConfig on top of the new plugin defaults.
 *
 * Used by both PanelOptionsPane (UI) and UPDATE_PANEL (mutation API).
 */

import { FieldConfigSource, filterFieldConfigOverrides, isStandardFieldProp } from '@grafana/data';
import type { VizPanel } from '@grafana/scenes';

export interface ChangePanelPluginOptions {
  newPluginId: string;
  newOptions?: Record<string, unknown>;
  newFieldConfig?: FieldConfigSource;
}

/**
 * Change a panel's plugin type with proper fieldConfig cleanup.
 *
 * 1. Clears custom field config defaults (preserves standard props like unit, thresholds, color)
 * 2. Filters overrides to keep only standard field properties
 * 3. Calls panel.changePluginType() with the cleaned fieldConfig
 * 4. Applies caller-provided options/fieldConfig on top of plugin defaults
 */
export async function changePanelPlugin(
  panel: VizPanel,
  { newPluginId, newOptions, newFieldConfig }: ChangePanelPluginOptions
): Promise<void> {
  const { fieldConfig: prevFieldConfig } = panel.state;

  let cleanFieldConfig: FieldConfigSource = {
    defaults: {
      ...prevFieldConfig.defaults,
      custom: {},
    },
    overrides: filterFieldConfigOverrides(prevFieldConfig.overrides, isStandardFieldProp),
  };

  if (newFieldConfig) {
    cleanFieldConfig = {
      ...newFieldConfig,
      overrides: cleanFieldConfig.overrides,
    };
  }

  await panel.changePluginType(newPluginId, newOptions, cleanFieldConfig);

  if (newOptions) {
    panel.onOptionsChange(newOptions, true);
  }

  if (newFieldConfig) {
    panel.onFieldConfigChange({ ...newFieldConfig, overrides: cleanFieldConfig.overrides }, true);
  }
}
