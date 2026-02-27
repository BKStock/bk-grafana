import { useMemo } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv, isExpressionReference } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

export interface CacheOptionsInfo {
  showCacheTimeout: boolean;
  showCacheTTL: boolean;
  cacheTTLPlaceholder: string | undefined;
}

/**
 * Determines cache option visibility and placeholder values.
 *
 * In non-Mixed mode, derives values from the panel-level datasource settings.
 * In Mixed mode, aggregates across all queries' datasources so that cache options
 * remain visible when at least one datasource supports them.
 * The TTL placeholder uses the lowest value among all datasources (most conservative default).
 */
export function useCacheOptionsInfo(
  dsSettings: DataSourceInstanceSettings | undefined,
  queries: DataQuery[]
): CacheOptionsInfo {
  return useMemo(() => {
    if (!dsSettings || dsSettings.uid !== MIXED_DATASOURCE_NAME) {
      return {
        showCacheTimeout: Boolean(dsSettings?.meta.queryOptions?.cacheTimeout),
        showCacheTTL: Boolean(dsSettings?.cachingConfig?.enabled),
        cacheTTLPlaceholder:
          dsSettings?.cachingConfig?.TTLMs != null ? String(dsSettings.cachingConfig.TTLMs) : undefined,
      };
    }

    let showCacheTimeout = false;
    let showCacheTTL = false;
    let lowestTTL: number | undefined;

    const seen = new Set<string>();
    for (const query of queries) {
      const uid = query.datasource?.uid;
      if (!uid || seen.has(uid) || isExpressionReference(query.datasource)) {
        continue;
      }
      seen.add(uid);

      const settings = getDataSourceSrv().getInstanceSettings(uid);
      if (!settings) {
        continue;
      }

      if (settings.meta.queryOptions?.cacheTimeout) {
        showCacheTimeout = true;
      }

      if (settings.cachingConfig?.enabled) {
        showCacheTTL = true;
        const ttl = settings.cachingConfig.TTLMs;
        if (ttl != null && (lowestTTL == null || ttl < lowestTTL)) {
          lowestTTL = ttl;
        }
      }
    }

    return {
      showCacheTimeout,
      showCacheTTL,
      cacheTTLPlaceholder: lowestTTL != null ? String(lowestTTL) : undefined,
    };
  }, [dsSettings, queries]);
}
