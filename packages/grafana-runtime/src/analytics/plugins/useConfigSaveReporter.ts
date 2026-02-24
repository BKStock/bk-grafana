import { useEffect } from 'react';

import { DataSourceTestFailed, DataSourceTestSucceeded } from '@grafana/data';

import { getAppEvents } from '../../services';

import { usePluginInteractionReporter } from './usePluginInteractionReporter';

/**
 * Reports a `grafana_plugin_save_result` interaction event when a datasource
 * configuration save succeeds or fails.
 *
 * @param pluginId - The plugin ID (e.g. `'grafana-cloudwatch-datasource'`)
 * @param properties - Additional properties to include in the interaction event
 *
 * @alpha
 */
export function useConfigSaveReporter(pluginId: string, properties?: Record<string, unknown>) {
  const report = usePluginInteractionReporter();

  useEffect(() => {
    const successSubscription = getAppEvents().subscribe<DataSourceTestSucceeded>(DataSourceTestSucceeded, () => {
      report('grafana_plugin_save_result', { ...properties, plugin_id: pluginId, result: 'success' });
    });
    const failSubscription = getAppEvents().subscribe<DataSourceTestFailed>(DataSourceTestFailed, () => {
      report('grafana_plugin_save_result', { ...properties, plugin_id: pluginId, result: 'error' });
    });
    return () => {
      successSubscription.unsubscribe();
      failSubscription.unsubscribe();
    };
  }, [pluginId, properties, report]);
}
