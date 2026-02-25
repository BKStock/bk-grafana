import { css } from '@emotion/css';
import React, { useRef } from 'react';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const PRESETS_TRANSITION_DURATION = 200;

export function PresetsTransition({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <CSSTransition
      in={visible}
      mountOnEnter
      unmountOnExit
      timeout={PRESETS_TRANSITION_DURATION}
      classNames={styles}
      nodeRef={nodeRef}
    >
      <div ref={nodeRef}>{children}</div>
    </CSSTransition>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  enter: css({
    label: 'enter',
    opacity: 0,
    transform: 'translateX(16px)',
  }),
  enterActive: css({
    label: 'enterActive',
    opacity: 1,
    transform: 'translateX(0)',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: `opacity ${PRESETS_TRANSITION_DURATION}ms ${theme.transitions.easing.easeOut},
                   transform ${PRESETS_TRANSITION_DURATION}ms ${theme.transitions.easing.easeOut}`,
    },
  }),
  exit: css({
    label: 'exit',
    opacity: 1,
    transform: 'translateX(0)',
  }),
  exitActive: css({
    label: 'exitActive',
    opacity: 0,
    transform: 'translateX(16px)',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: `opacity ${PRESETS_TRANSITION_DURATION}ms ${theme.transitions.easing.easeIn},
                   transform ${PRESETS_TRANSITION_DURATION}ms ${theme.transitions.easing.easeIn}`,
    },
  }),
});
