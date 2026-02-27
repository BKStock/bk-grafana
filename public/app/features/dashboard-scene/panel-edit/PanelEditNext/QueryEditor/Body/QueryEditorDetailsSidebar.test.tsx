import { fireEvent, screen } from '@testing-library/react';

import { DataSourceInstanceSettings, PanelData } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { QueryGroupOptions } from 'app/types/query';

import { renderWithQueryEditorProvider, mockOptions, mockActions, ds1SettingsMock } from '../testUtils';

import { QueryEditorDetailsSidebar } from './QueryEditorDetailsSidebar';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  isExpressionReference: jest.fn((ref) => ref?.uid === '__expr__' || ref?.type === '__expr__'),
}));

const mixedDsSettings: DataSourceInstanceSettings = {
  ...ds1SettingsMock,
  uid: MIXED_DATASOURCE_NAME,
  name: 'Mixed',
  type: 'mixed',
};

function mockGetInstanceSettings(settingsMap: Record<string, Partial<DataSourceInstanceSettings>>) {
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    getInstanceSettings: (uid: string) => settingsMap[uid] ?? null,
  });
}

describe('QueryEditorDetailsSidebar', () => {
  const mockCloseSidebar = jest.fn();

  const defaultQrState: { queries: DataQuery[]; data: PanelData | undefined; isLoading: boolean } = {
    queries: [],
    data: {
      request: {
        maxDataPoints: 1000,
        interval: '15s',
      },
    } as unknown as PanelData,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSidebar = (
    options: QueryGroupOptions = mockOptions,
    qrState: { queries: DataQuery[]; data: PanelData | undefined; isLoading: boolean } = defaultQrState,
    dsSettings?: DataSourceInstanceSettings
  ) => {
    return renderWithQueryEditorProvider(<QueryEditorDetailsSidebar />, {
      qrState,
      dsState: dsSettings ? { dsSettings } : undefined,
      uiStateOverrides: {
        queryOptions: {
          options,
          isQueryOptionsOpen: true,
          openSidebar: jest.fn(),
          closeSidebar: mockCloseSidebar,
          focusedField: null,
        },
      },
    });
  };

  it('should render all query options fields', () => {
    renderSidebar();

    expect(screen.getByLabelText('Max data points')).toBeInTheDocument();
    expect(screen.getByLabelText('Min interval')).toBeInTheDocument();
    expect(screen.getByText('Interval')).toBeInTheDocument();
    expect(screen.getByLabelText('Relative time')).toBeInTheDocument();
    expect(screen.getByLabelText('Time shift')).toBeInTheDocument();
  });

  it('should close sidebar when header is clicked', async () => {
    renderSidebar();

    const header = screen.getByRole('button', { name: /query options/i });
    fireEvent.click(header);

    expect(mockCloseSidebar).toHaveBeenCalled();
  });

  describe('maxDataPoints input', () => {
    it('should call onQueryOptionsChange with updated maxDataPoints on blur', () => {
      renderSidebar();

      const input = screen.getByLabelText('Max data points');
      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDataPoints: 500,
        })
      );
    });

    it('should set maxDataPoints to null for invalid input', () => {
      renderSidebar();

      const input = screen.getByLabelText('Max data points');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDataPoints: null,
        })
      );
    });

    it('should set maxDataPoints to null for zero', () => {
      renderSidebar();

      const input = screen.getByLabelText('Max data points');
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDataPoints: null,
        })
      );
    });
  });

  describe('minInterval input', () => {
    it('should call onQueryOptionsChange with updated minInterval on blur', () => {
      renderSidebar();

      const input = screen.getByLabelText('Min interval');
      fireEvent.change(input, { target: { value: '10s' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minInterval: '10s',
        })
      );
    });

    it('should set minInterval to null for empty input', () => {
      const optionsWithMinInterval = {
        ...mockOptions,
        minInterval: '5s',
      };

      renderSidebar(optionsWithMinInterval);

      const input = screen.getByLabelText('Min interval');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minInterval: null,
        })
      );
    });
  });

  describe('relativeTime input', () => {
    it('should call onQueryOptionsChange with valid relative time', () => {
      renderSidebar();

      const input = screen.getByLabelText('Relative time');
      fireEvent.change(input, { target: { value: '1h' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: expect.objectContaining({
            from: '1h',
          }),
        })
      );
    });

    it('should not call onQueryOptionsChange with invalid relative time', () => {
      renderSidebar();

      const input = screen.getByLabelText('Relative time');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      // onQueryOptionsChange should not be called for invalid time
      expect(mockActions.onQueryOptionsChange).not.toHaveBeenCalled();
    });
  });

  describe('timeShift input', () => {
    it('should call onQueryOptionsChange with valid time shift', () => {
      renderSidebar();

      const input = screen.getByLabelText('Time shift');
      fireEvent.change(input, { target: { value: '2h' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: expect.objectContaining({
            shift: '2h',
          }),
        })
      );
    });

    it('should not call onQueryOptionsChange with invalid time shift', () => {
      renderSidebar();

      const input = screen.getByLabelText('Time shift');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      // onQueryOptionsChange should not be called for invalid time
      expect(mockActions.onQueryOptionsChange).not.toHaveBeenCalled();
    });
  });

  describe('hideTimeInfo toggle', () => {
    it('should not render hide time info toggle when no time overrides are set', () => {
      renderSidebar();

      expect(screen.queryByLabelText('Hide time info')).not.toBeInTheDocument();
    });

    it('should render hide time info toggle when relative time is set', () => {
      const optionsWithRelativeTime: QueryGroupOptions = {
        ...mockOptions,
        timeRange: { from: '1h', shift: undefined, hide: false },
      };
      renderSidebar(optionsWithRelativeTime);

      expect(screen.getByLabelText('Hide time info')).toBeInTheDocument();
    });

    it('should render hide time info toggle when time shift is set', () => {
      const optionsWithTimeShift: QueryGroupOptions = {
        ...mockOptions,
        timeRange: { from: undefined, shift: '2h', hide: false },
      };
      renderSidebar(optionsWithTimeShift);

      expect(screen.getByLabelText('Hide time info')).toBeInTheDocument();
    });

    it('should call onQueryOptionsChange with toggled hide value', () => {
      const optionsWithTimeOverride: QueryGroupOptions = {
        ...mockOptions,
        timeRange: { from: '1h', shift: undefined, hide: false },
      };
      renderSidebar(optionsWithTimeOverride);

      const toggle = screen.getByLabelText('Hide time info');
      fireEvent.click(toggle);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: expect.objectContaining({
            hide: true,
          }),
        })
      );
    });
  });

  describe('cache options', () => {
    it('should render cache timeout when datasource supports it', () => {
      const dsSettingsWithCache = {
        ...ds1SettingsMock,
        meta: {
          ...ds1SettingsMock.meta,
          queryOptions: { cacheTimeout: true },
        },
      };

      renderSidebar(mockOptions, defaultQrState, dsSettingsWithCache);

      expect(screen.getByLabelText('Cache timeout')).toBeInTheDocument();
    });

    it('should not render cache timeout when datasource does not support it', () => {
      renderSidebar();

      expect(screen.queryByLabelText('Cache timeout')).not.toBeInTheDocument();
    });

    it('should render cache TTL when datasource caching is enabled', () => {
      const dsSettingsWithCacheTTL = {
        ...ds1SettingsMock,
        cachingConfig: { enabled: true, TTLMs: 60000 },
      };

      renderSidebar(mockOptions, defaultQrState, dsSettingsWithCacheTTL);

      expect(screen.getByLabelText('Cache TTL')).toBeInTheDocument();
    });

    it('should not render cache TTL when datasource caching is disabled', () => {
      renderSidebar();

      expect(screen.queryByLabelText('Cache TTL')).not.toBeInTheDocument();
    });

    describe('Mixed mode', () => {
      it('should show cache timeout when any query DS supports it', () => {
        mockGetInstanceSettings({
          'ds-prom': {
            ...ds1SettingsMock,
            uid: 'ds-prom',
            meta: { ...ds1SettingsMock.meta, queryOptions: { cacheTimeout: true } },
          },
          'ds-loki': { ...ds1SettingsMock, uid: 'ds-loki' },
        });

        const queries: DataQuery[] = [
          { refId: 'A', datasource: { uid: 'ds-prom', type: 'prometheus' } },
          { refId: 'B', datasource: { uid: 'ds-loki', type: 'loki' } },
        ];
        const qrState = { ...defaultQrState, queries };

        renderSidebar(mockOptions, qrState, mixedDsSettings);

        expect(screen.getByLabelText('Cache timeout')).toBeInTheDocument();
      });

      it('should show cache TTL when any query DS has caching enabled', () => {
        mockGetInstanceSettings({
          'ds-prom': {
            ...ds1SettingsMock,
            uid: 'ds-prom',
            cachingConfig: { enabled: true, TTLMs: 60000 },
          },
          'ds-loki': { ...ds1SettingsMock, uid: 'ds-loki' },
        });

        const queries: DataQuery[] = [
          { refId: 'A', datasource: { uid: 'ds-prom', type: 'prometheus' } },
          { refId: 'B', datasource: { uid: 'ds-loki', type: 'loki' } },
        ];
        const qrState = { ...defaultQrState, queries };

        renderSidebar(mockOptions, qrState, mixedDsSettings);

        expect(screen.getByLabelText('Cache TTL')).toBeInTheDocument();
      });

      it('should hide cache options when no query DS supports them', () => {
        mockGetInstanceSettings({
          'ds-prom': { ...ds1SettingsMock, uid: 'ds-prom' },
          'ds-loki': { ...ds1SettingsMock, uid: 'ds-loki' },
        });

        const queries: DataQuery[] = [
          { refId: 'A', datasource: { uid: 'ds-prom', type: 'prometheus' } },
          { refId: 'B', datasource: { uid: 'ds-loki', type: 'loki' } },
        ];
        const qrState = { ...defaultQrState, queries };

        renderSidebar(mockOptions, qrState, mixedDsSettings);

        expect(screen.queryByLabelText('Cache timeout')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Cache TTL')).not.toBeInTheDocument();
      });
    });
  });

  describe('computed interval display', () => {
    it('should display computed interval from data request', () => {
      renderSidebar();

      // The interval should be displayed as read-only text
      expect(screen.getByText('15s')).toBeInTheDocument();
    });

    it('should display dash when interval is not available', () => {
      const qrStateWithoutInterval = {
        queries: [],
        data: undefined,
        isLoading: false,
      };

      renderSidebar(mockOptions, qrStateWithoutInterval);

      // Should show "-" when no interval
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });
});
