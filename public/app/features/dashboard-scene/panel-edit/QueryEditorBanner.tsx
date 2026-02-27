import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, IconButton, InlineSwitch, TextLink, useStyles2 } from '@grafana/ui';

import { PanelEditor } from './PanelEditor';

type BannerVariant = 'upgrade' | 'downgrade';

interface Props {
  panelEditor: PanelEditor;
  variant: BannerVariant;
}

const DISMISSED_KEYS: Record<BannerVariant, string> = {
  upgrade: 'grafana.queryEditorBanner.upgrade.dismissed',
  downgrade: 'grafana.queryEditorBanner.downgrade.dismissed',
};

const VARIANT_ICONS: Record<BannerVariant, 'bolt' | 'rocket'> = {
  upgrade: 'bolt',
  downgrade: 'rocket',
};

const FEEDBACK_URL = 'https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/';

export function QueryEditorBanner({ panelEditor, variant }: Props) {
  const styles = useStyles2(getStyles);
  const { useQueryExperienceNext } = panelEditor.useState();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_KEYS[variant]) === 'true';
    } catch {
      return false;
    }
  });

  if (!config.featureToggles.queryEditorNext || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEYS[variant], 'true');
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <div className={styles.iconCircle}>
          <Icon name={VARIANT_ICONS[variant]} size="md" className={styles.accentIcon} />
        </div>
        <span className={styles.title}>
          {variant === 'upgrade'
            ? t('dashboard-scene.query-editor-banner.upgrade-title', 'New editor available!')
            : t('dashboard-scene.query-editor-banner.downgrade-title', 'New query editor!')}
        </span>
        <span className={styles.description}>
          {variant === 'upgrade'
            ? t('dashboard-scene.query-editor-banner.upgrade-description', 'Try the improved query editing experience.')
            : t(
                'dashboard-scene.query-editor-banner.downgrade-description',
                'Try the improved query editing experience.'
              )}
          {variant === 'downgrade' && (
            <>
              {' '}
              <TextLink href={FEEDBACK_URL} external inline variant="body">
                {t('dashboard-scene.query-editor-banner.learn-more', 'Learn more')}
              </TextLink>
            </>
          )}
        </span>
      </div>
      <div className={styles.right}>
        <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={styles.actionLink}>
          {variant === 'upgrade' ? (
            <>
              {t('dashboard-scene.query-editor-banner.give-feedback', 'Give feedback')}
              <Icon name="external-link-alt" size="sm" style={{ opacity: 0.8 }} />
            </>
          ) : (
            <>
              <Icon name="comment-alt" size="sm" />
              {t('dashboard-scene.query-editor-banner.give-feedback', 'Give feedback')}
            </>
          )}
        </a>
        {variant === 'upgrade' ? (
          <InlineSwitch
            label={t('dashboard-scene.query-editor-banner.new-editor', 'New editor')}
            showLabel={true}
            id="query-editor-version-banner"
            value={useQueryExperienceNext ?? false}
            onClick={panelEditor.onToggleQueryEditorVersion}
            aria-label={t('dashboard-scene.query-editor-banner.toggle-aria', 'Toggle between query editor v1 and v2')}
          />
        ) : (
          <button className={styles.actionLink} onClick={panelEditor.onToggleQueryEditorVersion}>
            <Icon name="history" size="sm" />
            {t('dashboard-scene.query-editor-banner.go-back', 'Go back to classic')}
          </button>
        )}
        <IconButton
          name="times"
          size="md"
          tooltip={t('dashboard-scene.query-editor-banner.dismiss', 'Dismiss')}
          onClick={handleDismiss}
          className={styles.closeButton}
          aria-label={t('dashboard-scene.query-editor-banner.dismiss', 'Dismiss')}
        />
      </div>
    </div>
  );
}

// Intentional custom colors for the promotional banner — not part of the standard theme palette.
const BANNER_BG = '#1D293D';
const BANNER_BORDER = '#314158';
const ICON_BG = '#111217';
const ACCENT_COLOR = '#FF9830';

function getStyles(theme: GrafanaTheme2) {
  return {
    banner: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(0, 2),
      height: theme.spacing(5),
      backgroundColor: BANNER_BG,
      border: `1px solid ${BANNER_BORDER}`,
      borderRadius: theme.shape.radius.default,
      flexShrink: 0,
    }),
    left: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      minWidth: 0,
    }),
    iconCircle: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(3.25),
      height: theme.spacing(3.25),
      borderRadius: theme.shape.radius.circle,
      backgroundColor: ICON_BG,
      flexShrink: 0,
    }),
    accentIcon: css({
      color: ACCENT_COLOR,
    }),
    title: css({
      color: ACCENT_COLOR,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.body.fontSize,
      whiteSpace: 'nowrap',
    }),
    description: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    right: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      flexShrink: 0,
      marginLeft: theme.spacing(2),
    }),
    actionLink: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      '&:hover': {
        color: theme.colors.text.primary,
        textDecoration: 'underline',
      },
    }),
    closeButton: css({
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}
