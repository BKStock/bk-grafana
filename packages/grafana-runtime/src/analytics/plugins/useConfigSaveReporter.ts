import { useEffect, useRef } from 'react';

import { DataSourceTestFailed, DataSourceTestSucceeded } from '@grafana/data';

import { getAppEvents } from '../../services';

import { usePluginInteractionReporter } from './usePluginInteractionReporter';

/**
 * Reports a `grafana_plugin_save_result` interaction event when a datasource
 * configuration save succeeds or fails.
 *
 * @param pluginId - The plugin ID (e.g. `'grafana-cloudwatch-datasource'`)
 * @param getProperties - A function returning additional properties to include in the interaction event.
 *   Called at event time so it always reflects the latest state.
 *
 * @alpha
 */
export function useConfigSaveReporter(pluginId: string, getProperties?: () => Record<string, unknown>) {
  const report = usePluginInteractionReporter();
  const getPropertiesRef = useRef(getProperties);
  getPropertiesRef.current = getProperties;

  useEffect(() => {
    const successSubscription = getAppEvents().subscribe<DataSourceTestSucceeded>(DataSourceTestSucceeded, () => {
      report('grafana_plugin_save_result', { ...getPropertiesRef.current?.(), plugin_id: pluginId, result: 'success' });
    });
    const failSubscription = getAppEvents().subscribe<DataSourceTestFailed>(DataSourceTestFailed, () => {
      report('grafana_plugin_save_result', { ...getPropertiesRef.current?.(), plugin_id: pluginId, result: 'error' });
    });
    return () => {
      successSubscription.unsubscribe();
      failSubscription.unsubscribe();
    };
  }, [pluginId, report]);
}
