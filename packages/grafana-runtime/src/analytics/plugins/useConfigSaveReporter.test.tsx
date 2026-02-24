import { act, renderHook } from '@testing-library/react';
import * as React from 'react';

import {
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  DataSourceTestFailed,
  DataSourceTestSucceeded,
  EventBusSrv,
  PluginMeta,
  PluginMetaInfo,
  PluginSignatureStatus,
  PluginType,
} from '@grafana/data';
import iconGaugeSvg from 'app/plugins/panel/gauge/img/icon_gauge.svg';

import * as services from '../../services';
import { reportInteraction } from '../utils';

import { useConfigSaveReporter } from './useConfigSaveReporter';

jest.mock('../utils', () => ({ reportInteraction: jest.fn() }));
jest.mock('../../services', () => ({ ...jest.requireActual('../../services'), getAppEvents: jest.fn() }));
const reportInteractionMock = jest.mocked(reportInteraction);

describe('useConfigSaveReporter', () => {
  let appEventBus: EventBusSrv;

  beforeEach(() => {
    jest.resetAllMocks();
    appEventBus = new EventBusSrv();
    jest.mocked(services.getAppEvents).mockReturnValue(appEventBus);
  });

  it('reports grafana_plugin_save_result with result success when DataSourceTestSucceeded is published', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })), {
      wrapper: createWrapper(),
    });

    act(() => {
      appEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(reportInteractionMock).toHaveBeenCalledTimes(1);
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ plugin_id: 'grafana-cloudwatch-datasource', result: 'success', auth_type: 'default' })
    );
  });

  it('reports grafana_plugin_save_result with result error when DataSourceTestFailed is published', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })), {
      wrapper: createWrapper(),
    });

    act(() => {
      appEventBus.publish(new DataSourceTestFailed());
    });

    expect(reportInteractionMock).toHaveBeenCalledTimes(1);
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ plugin_id: 'grafana-cloudwatch-datasource', result: 'error', auth_type: 'default' })
    );
  });

  it('includes datasource plugin context info in the reported properties', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })), {
      wrapper: createWrapper({
        uid: 'abc123',
        meta: createPluginMeta({ id: 'grafana-cloudwatch-datasource', name: 'CloudWatch', info: createPluginMetaInfo({ version: '1.0.0' }) }),
      }),
    });

    act(() => {
      appEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(reportInteractionMock).toHaveBeenCalledWith('grafana_plugin_save_result', {
      plugin_id: 'grafana-cloudwatch-datasource',
      result: 'success',
      auth_type: 'default',
      grafana_version: '1.0',
      plugin_type: 'datasource',
      plugin_version: '1.0.0',
      plugin_name: 'CloudWatch',
      datasource_uid: 'abc123',
    });
  });

  it('works with no getProperties argument', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource'), {
      wrapper: createWrapper(),
    });

    act(() => {
      appEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ plugin_id: 'grafana-cloudwatch-datasource', result: 'success' })
    );
  });

  it('forwards arbitrary extra properties to the interaction event', () => {
    renderHook(
      () => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default', custom_prop: 'value' })),
      { wrapper: createWrapper() }
    );

    act(() => {
      appEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ auth_type: 'default', custom_prop: 'value' })
    );
  });

  it('stops reporting after unmount', () => {
    const { unmount } = renderHook(
      () => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })),
      { wrapper: createWrapper() }
    );

    unmount();

    act(() => {
      appEventBus.publish(new DataSourceTestSucceeded());
      appEventBus.publish(new DataSourceTestFailed());
    });

    expect(reportInteractionMock).not.toHaveBeenCalled();
  });

  it('uses the current properties at event time, not at subscription time', () => {
    let authType = 'default';

    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: authType })), {
      wrapper: createWrapper(),
    });

    authType = 'keys';

    act(() => {
      appEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ auth_type: 'keys' })
    );
  });

  it('does not recreate subscriptions when re-rendered with a new getProperties function reference', () => {
    const { rerender } = renderHook(
      ({ authType }: { authType: string }) =>
        useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: authType })),
      { wrapper: createWrapper(), initialProps: { authType: 'default' } }
    );

    jest.mocked(services.getAppEvents).mockClear();
    rerender({ authType: 'default' });

    expect(services.getAppEvents).not.toHaveBeenCalled();
  });
});

function createWrapper(settings?: Partial<DataSourceInstanceSettings>) {
  return ({ children }: React.PropsWithChildren<{}>) => (
    <DataSourcePluginContextProvider instanceSettings={createDataSourceInstanceSettings(settings)}>
      {children}
    </DataSourcePluginContextProvider>
  );
}

function createDataSourceInstanceSettings(settings: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings {
  const { meta, ...rest } = settings;
  return {
    uid: '',
    name: '',
    meta: createPluginMeta(meta),
    type: PluginType.datasource,
    readOnly: false,
    jsonData: {},
    access: 'proxy',
    ...rest,
  };
}

function createPluginMeta(meta: Partial<PluginMeta> = {}): PluginMeta {
  return {
    id: 'grafana-cloudwatch-datasource',
    name: 'CloudWatch',
    type: PluginType.datasource,
    info: createPluginMetaInfo(),
    module: 'app/plugins/datasource/cloudwatch/module',
    baseUrl: '',
    signature: PluginSignatureStatus.internal,
    ...meta,
  };
}

function createPluginMetaInfo(info: Partial<PluginMetaInfo> = {}): PluginMetaInfo {
  return {
    author: { name: 'Grafana Labs' },
    description: '',
    links: [],
    logos: { large: iconGaugeSvg, small: iconGaugeSvg },
    screenshots: [],
    updated: '',
    version: '',
    ...info,
  };
}
