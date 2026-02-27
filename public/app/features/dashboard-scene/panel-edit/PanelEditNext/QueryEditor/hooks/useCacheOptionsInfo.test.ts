import { renderHook } from '@testing-library/react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { ds1SettingsMock } from '../testUtils';

import { useCacheOptionsInfo } from './useCacheOptionsInfo';

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

function createQuery(refId: string, dsUid: string, dsType = 'test'): DataQuery {
  return { refId, datasource: { uid: dsUid, type: dsType } };
}

function mockGetInstanceSettings(settingsMap: Record<string, Partial<DataSourceInstanceSettings>>) {
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    getInstanceSettings: (uid: string) => settingsMap[uid] ?? null,
  });
}

describe('useCacheOptionsInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('non-Mixed mode', () => {
    it('should show cache timeout when DS supports it', () => {
      const dsWithCacheTimeout: DataSourceInstanceSettings = {
        ...ds1SettingsMock,
        meta: { ...ds1SettingsMock.meta, queryOptions: { cacheTimeout: true } },
      };

      const { result } = renderHook(() => useCacheOptionsInfo(dsWithCacheTimeout, []));

      expect(result.current.showCacheTimeout).toBe(true);
      expect(result.current.showCacheTTL).toBe(false);
    });

    it('should show cache TTL when DS caching is enabled', () => {
      const dsWithCacheTTL: DataSourceInstanceSettings = {
        ...ds1SettingsMock,
        cachingConfig: { enabled: true, TTLMs: 60000 },
      };

      const { result } = renderHook(() => useCacheOptionsInfo(dsWithCacheTTL, []));

      expect(result.current.showCacheTTL).toBe(true);
      expect(result.current.cacheTTLPlaceholder).toBe('60000');
    });

    it('should hide both cache options when DS does not support them', () => {
      const { result } = renderHook(() => useCacheOptionsInfo(ds1SettingsMock, []));

      expect(result.current.showCacheTimeout).toBe(false);
      expect(result.current.showCacheTTL).toBe(false);
      expect(result.current.cacheTTLPlaceholder).toBeUndefined();
    });

    it('should return undefined for dsSettings=undefined', () => {
      const { result } = renderHook(() => useCacheOptionsInfo(undefined, []));

      expect(result.current.showCacheTimeout).toBe(false);
      expect(result.current.showCacheTTL).toBe(false);
    });
  });

  describe('Mixed mode', () => {
    it('should show cache timeout when any query DS supports it', () => {
      mockGetInstanceSettings({
        'ds-prom': {
          ...ds1SettingsMock,
          uid: 'ds-prom',
          meta: { ...ds1SettingsMock.meta, queryOptions: { cacheTimeout: true } },
        },
        'ds-loki': {
          ...ds1SettingsMock,
          uid: 'ds-loki',
        },
      });

      const queries = [createQuery('A', 'ds-prom'), createQuery('B', 'ds-loki')];
      const { result } = renderHook(() => useCacheOptionsInfo(mixedDsSettings, queries));

      expect(result.current.showCacheTimeout).toBe(true);
    });

    it('should show cache TTL when any query DS has caching enabled', () => {
      mockGetInstanceSettings({
        'ds-prom': {
          ...ds1SettingsMock,
          uid: 'ds-prom',
          cachingConfig: { enabled: true, TTLMs: 60000 },
        },
        'ds-loki': {
          ...ds1SettingsMock,
          uid: 'ds-loki',
        },
      });

      const queries = [createQuery('A', 'ds-prom'), createQuery('B', 'ds-loki')];
      const { result } = renderHook(() => useCacheOptionsInfo(mixedDsSettings, queries));

      expect(result.current.showCacheTTL).toBe(true);
      expect(result.current.cacheTTLPlaceholder).toBe('60000');
    });

    it('should use the lowest TTL as placeholder when multiple DSs have caching enabled', () => {
      mockGetInstanceSettings({
        'ds-prom': {
          ...ds1SettingsMock,
          uid: 'ds-prom',
          cachingConfig: { enabled: true, TTLMs: 300000 },
        },
        'ds-loki': {
          ...ds1SettingsMock,
          uid: 'ds-loki',
          cachingConfig: { enabled: true, TTLMs: 60000 },
        },
      });

      const queries = [createQuery('A', 'ds-prom'), createQuery('B', 'ds-loki')];
      const { result } = renderHook(() => useCacheOptionsInfo(mixedDsSettings, queries));

      expect(result.current.showCacheTTL).toBe(true);
      expect(result.current.cacheTTLPlaceholder).toBe('60000');
    });

    it('should hide cache options when no query DS supports them', () => {
      mockGetInstanceSettings({
        'ds-prom': { ...ds1SettingsMock, uid: 'ds-prom' },
        'ds-loki': { ...ds1SettingsMock, uid: 'ds-loki' },
      });

      const queries = [createQuery('A', 'ds-prom'), createQuery('B', 'ds-loki')];
      const { result } = renderHook(() => useCacheOptionsInfo(mixedDsSettings, queries));

      expect(result.current.showCacheTimeout).toBe(false);
      expect(result.current.showCacheTTL).toBe(false);
    });

    it('should ignore expression queries', () => {
      mockGetInstanceSettings({
        'ds-prom': {
          ...ds1SettingsMock,
          uid: 'ds-prom',
          cachingConfig: { enabled: true, TTLMs: 60000 },
        },
      });

      const queries = [createQuery('A', 'ds-prom'), createQuery('B', '__expr__', '__expr__')];
      const { result } = renderHook(() => useCacheOptionsInfo(mixedDsSettings, queries));

      expect(result.current.showCacheTTL).toBe(true);
      expect(result.current.cacheTTLPlaceholder).toBe('60000');
    });

    it('should handle empty queries array', () => {
      const { result } = renderHook(() => useCacheOptionsInfo(mixedDsSettings, []));

      expect(result.current.showCacheTimeout).toBe(false);
      expect(result.current.showCacheTTL).toBe(false);
    });

    it('should handle queries with missing datasource uid', () => {
      mockGetInstanceSettings({});

      const queries: DataQuery[] = [{ refId: 'A' }];
      const { result } = renderHook(() => useCacheOptionsInfo(mixedDsSettings, queries));

      expect(result.current.showCacheTimeout).toBe(false);
      expect(result.current.showCacheTTL).toBe(false);
    });

    it('should not look up the same datasource twice', () => {
      const getInstanceSettingsMock = jest.fn((uid: string) => {
        if (uid === 'ds-prom') {
          return {
            ...ds1SettingsMock,
            uid: 'ds-prom',
            cachingConfig: { enabled: true, TTLMs: 60000 },
          };
        }
        return null;
      });

      (getDataSourceSrv as jest.Mock).mockReturnValue({
        getInstanceSettings: getInstanceSettingsMock,
      });

      const queries = [createQuery('A', 'ds-prom'), createQuery('B', 'ds-prom')];
      renderHook(() => useCacheOptionsInfo(mixedDsSettings, queries));

      expect(getInstanceSettingsMock).toHaveBeenCalledTimes(1);
    });
  });
});
