import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { QUERY_EDITOR_COLORS, TIME_OPTION_PLACEHOLDER } from '../../constants';
import { useDatasourceContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';
import { QueryOptionField } from '../types';

interface FooterLabelValue {
  id: QueryOptionField;
  label: string;
  value: string;
  isActive?: boolean;
}

export function QueryEditorFooter() {
  const styles = useStyles2(getStyles);

  const { queryOptions } = useQueryEditorUIContext();
  const { options, openSidebar } = queryOptions;
  const { data } = useQueryRunnerContext();
  const { datasource, dsSettings } = useDatasourceContext();

  const showCacheTimeout = dsSettings?.meta.queryOptions?.cacheTimeout;
  const showCacheTTL = dsSettings?.cachingConfig?.enabled;

  const items: FooterLabelValue[] = useMemo(() => {
    const realMaxDataPoints = data?.request?.maxDataPoints;
    const realInterval = data?.request?.interval;
    const minIntervalOnDs = datasource?.interval ?? t('query-editor-next.footer.placeholder.no-limit', 'No limit');

    const result: FooterLabelValue[] = [
      {
        id: QueryOptionField.maxDataPoints,
        label: t('query-editor-next.footer.label.max-data-points', 'Max data points'),
        value: options.maxDataPoints != null ? String(options.maxDataPoints) : String(realMaxDataPoints ?? '-'),
        isActive: options.maxDataPoints != null,
      },
      {
        id: QueryOptionField.minInterval,
        label: t('query-editor-next.footer.label.min-interval', 'Min interval'),
        value: options.minInterval ?? minIntervalOnDs,
        isActive: options.minInterval != null,
      },
      {
        id: QueryOptionField.interval,
        label: t('query-editor-next.footer.label.interval', 'Interval'),
        value: realInterval ?? '-',
        isActive: false,
      },
      {
        id: QueryOptionField.relativeTime,
        label: t('query-editor-next.footer.label.relative-time', 'Relative time'),
        value: options.timeRange?.from ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.from != null,
      },
      {
        id: QueryOptionField.timeShift,
        label: t('query-editor-next.footer.label.time-shift', 'Time shift'),
        value: options.timeRange?.shift ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.shift != null,
      },
    ];

    if (showCacheTimeout) {
      result.push({
        id: QueryOptionField.cacheTimeout,
        label: t('query-editor-next.footer.label.cache-timeout', 'Cache timeout'),
        value: options.cacheTimeout ?? '60',
        isActive: options.cacheTimeout != null,
      });
    }

    if (showCacheTTL) {
      result.push({
        id: QueryOptionField.queryCachingTTL,
        label: t('query-editor-next.footer.label.cache-ttl', 'Cache TTL'),
        value:
          options.queryCachingTTL != null
            ? String(options.queryCachingTTL)
            : dsSettings?.cachingConfig?.TTLMs != null
              ? String(dsSettings.cachingConfig.TTLMs)
              : '-',
        isActive: options.queryCachingTTL != null,
      });
    }

    return result;
  }, [options, data, datasource, showCacheTimeout, showCacheTTL, dsSettings?.cachingConfig?.TTLMs]);

  const handleItemClick = (event: React.MouseEvent, fieldId?: QueryOptionField) => {
    // Stop propagation to prevent ClickOutsideWrapper from immediately closing
    event.stopPropagation();

    // Don't focus interval since it's read-only
    if (fieldId && fieldId !== QueryOptionField.interval) {
      openSidebar(fieldId);
    } else {
      openSidebar();
    }
  };

  return (
    <div className={styles.container}>
      <ul className={styles.itemsList}>
        {items.map((item) => (
          <li key={item.id}>
            <Button
              fill="text"
              size="sm"
              className={styles.itemButton}
              onClick={(e) => handleItemClick(e, item.id)}
              aria-label={t('query-editor-next.footer.edit-option', 'Edit {{label}}', { label: item.label })}
            >
              {item.isActive && <span className={styles.activeIndicator} />}
              <span className={styles.label}>{item.label}</span>
              <span className={cx(styles.value, item.isActive && styles.valueActive)}>{item.value}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div className={styles.queryOptionsWrapper}>
        <Button
          fill="text"
          size="sm"
          icon="angle-left"
          iconPlacement="right"
          onClick={(e) => handleItemClick(e)}
          aria-label={t('query-editor-next.footer.query-options', 'Query Options')}
        >
          <Trans i18nKey="query-editor-next.footer.query-options">Query Options</Trans>
        </Button>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'sticky',
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      backgroundColor: QUERY_EDITOR_COLORS.footerBackground,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderBottomLeftRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      padding: theme.spacing(0.5, 0.5, 0.5, 1.5),
      zIndex: theme.zIndex.navbarFixed,
      minHeight: 26,
      overflow: 'hidden',
    }),
    itemsList: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      listStyle: 'none',
      margin: 0,
      padding: 0,
      flex: 1,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    }),
    itemButton: css({
      // Override Button's default padding and add gap for children
      padding: theme.spacing(0, 0.5),

      '& > span': {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
      },
    }),
    label: css({
      color: theme.colors.text.primary,
    }),
    value: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
    }),
    valueActive: css({
      color: theme.colors.success.text,
    }),
    activeIndicator: css({
      width: 6,
      height: 6,
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.success.text,
      flexShrink: 0,
    }),
    queryOptionsWrapper: css({
      position: 'relative',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',

      '&::before': {
        content: '""',
        position: 'absolute',
        right: '100%',
        top: 0,
        bottom: 0,
        width: theme.spacing(4),
        background: `linear-gradient(to right, transparent, ${QUERY_EDITOR_COLORS.footerBackground})`,
        pointerEvents: 'none',
      },
    }),
  };
}
