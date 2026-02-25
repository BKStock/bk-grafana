import { css } from '@emotion/css';

export const containerStyles = css({
  display: 'flex',
  flexDirection: 'column',

  // Allow selecting/copying row label text rendered on the uPlot y-axis.
  '.u-axis': {
    userSelect: 'text',
  },
});
