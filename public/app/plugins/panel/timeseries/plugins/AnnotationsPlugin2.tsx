import { css } from '@emotion/css';
import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import tinycolor from 'tinycolor2';
import uPlot from 'uplot';

import {
  arrayToDataFrame,
  colorManipulator,
  DataFrame,
  DataTopic,
  FieldType,
  InterpolateFunction,
} from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/internal';
import { TimeZone, VizAnnotations } from '@grafana/schema';
import {
  DEFAULT_ANNOTATION_COLOR,
  getPortalContainer,
  UPlotConfigBuilder,
  usePanelContext,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { AnnotationMarker2 } from './annotations2/AnnotationMarker2';
import { ANNOTATION_LANE_SIZE, getXAnnotationFrames, getXYAnnotationFrames } from './utils';

// (copied from TooltipPlugin2)
interface TimeRange2 {
  from: number;
  to: number;
}

interface AnnotationsPluginProps {
  config: UPlotConfigBuilder;
  annotationsOptions: VizAnnotations | undefined;
  annotations: DataFrame[];
  timeZone: TimeZone;
  newRange: TimeRange2 | null;
  setNewRange: (newRage: TimeRange2 | null) => void;
  canvasRegionRendering?: boolean;
  replaceVariables: InterpolateFunction;
}

// TODO: batch by color, use Path2D objects
const renderLine = (ctx: CanvasRenderingContext2D, y0: number, y1: number, x: number, color: string) => {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.strokeStyle = color;
  ctx.stroke();
};

enum ClusteringMode {
  Hover = 'hover',
  Render = 'render',
}

// const renderUpTriangle = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
//   ctx.beginPath();
//   ctx.moveTo(x - w/2, y + h/2);
//   ctx.lineTo(x + w/2, y + h/2);
//   ctx.lineTo(x, y);
//   ctx.closePath();
//   ctx.fillStyle = color;
//   ctx.fill();
// }

const DEFAULT_ANNOTATION_COLOR_HEX8 = tinycolor(DEFAULT_ANNOTATION_COLOR).toHex8String();

function getVals(frame: DataFrame) {
  let vals: Record<string, any[]> = {};
  frame.fields.forEach((f) => {
    vals[f.name] = f.values;
  });

  return vals;
}

export const AnnotationsPlugin2 = ({
  annotations,
  timeZone,
  config,
  newRange,
  setNewRange,
  replaceVariables,
  canvasRegionRendering = true,
  annotationsOptions,
}: AnnotationsPluginProps) => {
  const [plot, setPlot] = useState<uPlot>();

  const [portalRoot] = useState(() => getPortalContainer());
  const [annoIdx, setAnnoIdx] = useState<string | undefined>();
  const styles = useStyles2(getStyles);
  const getColorByName = useTheme2().visualization.getColorByName;

  const [_, forceUpdate] = useReducer((x) => x + 1, 0);

  const clusteringMode: ClusteringMode | null = annotationsOptions?.clustering ? ClusteringMode.Render : null;
  console.log('clusteringmode', clusteringMode);
  const { canExecuteActions } = usePanelContext();
  const userCanExecuteActions = canExecuteActions?.() ?? false;

  const { xAnnos, xyAnnos } = useMemo(() => {
    let xAnnos = getXAnnotationFrames(annotations);
    let xyAnnos = getXYAnnotationFrames(annotations);

    if (newRange) {
      let isRegion = newRange.to > newRange.from;

      const wipAnnoFrame = arrayToDataFrame([
        {
          time: newRange.from,
          timeEnd: isRegion ? newRange.to : null,
          isRegion: isRegion,
          color: DEFAULT_ANNOTATION_COLOR_HEX8,
        },
      ]);

      wipAnnoFrame.meta = {
        dataTopic: DataTopic.Annotations,
        custom: {
          isWip: true,
        },
      };
      const sortedAnnoFrame = maybeSortFrame(
        wipAnnoFrame,
        wipAnnoFrame.fields.findIndex((field) => field.name === 'time')
      );
      xAnnos.push(sortedAnnoFrame);
    }

    return {
      xAnnos,
      xyAnnos,
    };
  }, [annotations, newRange]);

  console.log('xAnnos (before cluster)', xAnnos);

  const { clusteredAnnos } = useMemo(() => {
    const clusteredAnnos: DataFrame[] = [];

    // 15min in millis
    // todo: compute this from pixel space, to make dynamic, like 10px -> millis
    let mergeThreshold = (3600 / 4) * 1e3;

    // per-frame clustering
    if (clusteringMode === ClusteringMode.Render) {
      for (let i = 0; i < xAnnos.length; i++) {
        let frame = xAnnos[i];

        let timeVals = frame.fields.find((f) => f.name === 'time')?.values;
        let colorVals = frame.fields.find((f) => f.name === 'color')?.values;

        if (timeVals && timeVals.length > 1) {
          let isRegionVals =
            frame.fields.find((f) => f.name === 'isRegion')?.values ?? Array(timeVals.length).fill(false);

          let len = timeVals.length;

          let clusterIdx = Array(timeVals.length).fill(null);
          let clusters: number[][] = [];

          let thisCluster: number[] = [];
          let prevIdx = null;

          for (let j = 0; j < len; j++) {
            let time = timeVals[j];

            if (!isRegionVals[j]) {
              if (prevIdx != null) {
                if (time - timeVals[prevIdx] <= mergeThreshold) {
                  console.log('merge threshold hit');
                  // open cluster
                  if (thisCluster.length === 0) {
                    thisCluster.push(prevIdx);
                    clusterIdx[prevIdx] = clusters.length;
                  }
                  thisCluster.push(j);
                  clusterIdx[j] = clusters.length;
                } else {
                  // close cluster
                  if (thisCluster.length > 0) {
                    clusters.push(thisCluster);
                    thisCluster = [];
                  }
                }
              }

              prevIdx = j;
            }
          }

          // close cluster
          if (thisCluster.length > 0) {
            clusters.push(thisCluster);
          }

          console.log('clusters', clusters);

          let clusteredFrame: DataFrame = {
            ...frame,
            fields: frame.fields
              .map((field) => ({
                ...field,
                values: field.values.slice(),
              }))
              // append cluster indices
              .concat({
                type: FieldType.number,
                name: 'clusterIdx',
                values: clusterIdx,
                config: {},
              }),
          };

          let hasTimeEndField = clusteredFrame.fields.findIndex((field) => field.name === 'timeEnd') !== -1;

          if (!hasTimeEndField) {
            clusteredFrame.fields.push({
              type: FieldType.time,
              name: 'timeEnd',
              values: Array(clusteredFrame.fields[0].values.length).fill(null),
              config: {},
            });
          }

          // append cluster regions to frame
          clusters.forEach((idxs, ci) => {
            clusteredFrame.fields.forEach((field) => {
              let vals = field.values;

              if (field.name === 'time') {
                vals.push(timeVals[idxs[0]]);
              } else if (field.name === 'timeEnd') {
                let lastIdx = idxs.length - 1;
                vals.push(timeVals[idxs[lastIdx]]);
              } else if (field.name === 'isRegion') {
                vals.push(true);
              } else if (field.name === 'color') {
                vals.push(colorVals?.[idxs[0]]);
              } else if (field.name === 'title') {
                vals.push(`Cluster ${ci}`);
              } else if (field.name === 'text') {
                vals.push(idxs.join());
              } else if (field.name === 'clusterIdx') {
                vals.push(ci);
              } else {
                vals.push(null);
              }
            });
          });

          clusteredFrame.length = clusteredFrame.fields[0].values.length;

          console.log('clusteredFrame', clusteredFrame);
          clusteredAnnos.push(clusteredFrame);
        } else {
          console.log('regular ol frame', frame);
          clusteredAnnos.push(frame);
        }
      }
    } else if (clusteringMode === ClusteringMode.Hover) {
      // TODO
    }

    return { clusteredAnnos: clusteredAnnos.length > 0 ? clusteredAnnos : xAnnos };
  }, [xAnnos, clusteringMode]);

  const exitWipEdit = useCallback(() => {
    setNewRange(null);
  }, [setNewRange]);

  console.log('clusteredAnnos', clusteredAnnos);

  const xAnnoRef = useRef(clusteredAnnos);
  xAnnoRef.current = clusteredAnnos;

  const xyAnnoRef = useRef(xyAnnos);
  xyAnnoRef.current = xyAnnos;

  const newRangeRef = useRef(newRange);
  newRangeRef.current = newRange;

  const xAxisRef = useRef<HTMLDivElement | undefined>(undefined);

  useLayoutEffect(() => {
    config.addHook('ready', (u) => {
      let xAxisEl = u.root.querySelector<HTMLDivElement>('.u-axis')!;
      xAxisRef.current = xAxisEl;
      setPlot(u);
    });

    config.addHook('draw', (u) => {
      let xAnnos = xAnnoRef.current;
      let xyAnnos = xyAnnoRef.current;

      const ctx = u.ctx;

      ctx.save();

      ctx.beginPath();
      ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.clip();

      // Multi-lane annotations do not support vertical lines or shaded regions
      xAnnos.forEach((frame) => {
        let vals = getVals(frame);
        const clusterIdx = vals.clusterIdx;
        if (!annotationsOptions?.multiLane) {
          let y0 = u.bbox.top;
          let y1 = y0 + u.bbox.height;

          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);

          for (let i = 0; i < vals.time.length; i++) {
            // skip rendering annos that are clustered (have non-null cluster index)
            if (clusterIdx?.[i] != null && !vals.isRegion[i]) {
              continue;
            }
            let color = getColorByName(vals.color?.[i] ?? DEFAULT_ANNOTATION_COLOR_HEX8);

            let x0 = u.valToPos(vals.time[i], 'x', true);
            renderLine(ctx, y0, y1, x0, color);

            // If dataframe does not have end times, let's omit rendering the region for now to prevent runtime error in valToPos
            // @todo do we want to fix isRegion to render a point (or use "to" as timeEnd) when we're missing timeEnd?
            if (vals.isRegion?.[i] && vals.timeEnd?.[i]) {
              let x1 = u.valToPos(vals.timeEnd[i], 'x', true);
              renderLine(ctx, y0, y1, x1, color);

              if (canvasRegionRendering) {
                ctx.fillStyle = colorManipulator.alpha(color, 0.1);
                ctx.fillRect(x0, y0, x1 - x0, u.bbox.height);
              }
            }
          }
        }
      });

      // xMin, xMax, yMin, yMax, color, lineWidth, lineStyle, fillOpacity, text
      xyAnnos.forEach((frame) => {
        let vals = getVals(frame);

        let xKey = config.scales[0].props.scaleKey;
        let yKey = config.scales[1].props.scaleKey;

        for (let i = 0; i < frame.length; i++) {
          let color = getColorByName(vals.color?.[i] || DEFAULT_ANNOTATION_COLOR_HEX8);

          let x0 = u.valToPos(vals.xMin[i], xKey, true);
          let x1 = u.valToPos(vals.xMax[i], xKey, true);
          let y0 = u.valToPos(vals.yMax[i], yKey, true);
          let y1 = u.valToPos(vals.yMin[i], yKey, true);

          ctx.fillStyle = colorManipulator.alpha(color, vals.fillOpacity[i]);
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

          ctx.lineWidth = Math.round(vals.lineWidth[i] * uPlot.pxRatio);

          if (vals.lineStyle[i] === 'dash') {
            // maybe extract this to vals.lineDash[i] in future?
            ctx.setLineDash([5, 5]);
          } else {
            // solid
            ctx.setLineDash([]);
          }

          ctx.strokeStyle = color;
          ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        }
      });

      ctx.restore();
    });
  }, [config, canvasRegionRendering, getColorByName, annotationsOptions?.multiLane]);

  // ensure xAnnos are re-drawn whenever they change
  useEffect(() => {
    if (plot) {
      plot.redraw();

      // this forces a second redraw after uPlot is updated (in the Plot.tsx didUpdate) with new data/scales
      // and ensures the anno marker positions in the dom are re-rendered in correct places
      // (this is temp fix until uPlot integrtion is refactored)
      setTimeout(() => {
        forceUpdate();
      }, 0);
    }
  }, [xAnnos, plot]);

  // Set active annotation tooltip state
  const setAnnotationIndex = useCallback((annoIdx: string | undefined) => {
    setAnnoIdx(annoIdx);
  }, []);

  if (plot) {
    let markers = xAnnos.flatMap((frame, frameIdx) => {
      let vals = getVals(frame);

      let markers: React.ReactNode[] = [];

      // Top offset for multi-lane annotations
      const top = annotationsOptions?.multiLane ? frameIdx * ANNOTATION_LANE_SIZE : undefined;

      for (let i = 0; i < vals.time.length; i++) {
        if (!vals.isRegion[i] && vals.clusterIdx?.[i] != null) {
          continue;
        }
        let color = getColorByName(vals.color?.[i] || DEFAULT_ANNOTATION_COLOR);
        let left = Math.round(plot.valToPos(vals.time[i], 'x')) || 0; // handles -0
        let style: React.CSSProperties | null = null;
        let className = '';
        let isVisible = true;

        if (vals.isRegion?.[i]) {
          let right = Math.round(plot.valToPos(vals.timeEnd?.[i], 'x')) || 0; // handles -0

          isVisible = left < plot.rect.width && right > 0;

          if (isVisible) {
            let clampedLeft = Math.max(0, left);
            let clampedRight = Math.min(plot.rect.width, right);

            style = { left: clampedLeft, background: color, width: clampedRight - clampedLeft, top };
            className = styles.annoRegion;
          }
        } else {
          isVisible = left >= 0 && left <= plot.rect.width;

          if (isVisible) {
            style = { left, borderBottomColor: color, top };
            className = styles.annoMarker;
          }
        }

        // @TODO: Reset newRange after annotation is saved
        if (isVisible) {
          const isWip = frame.meta?.custom?.isWip;
          const setAnnotation = (active: boolean) => {
            if (active) {
              setAnnotationIndex(`${frameIdx}:${i}`);
            } else {
              setAnnotationIndex(undefined);
            }
          };

          markers.push(
            <AnnotationMarker2
              pinAnnotation={setAnnotation}
              isPinned={annoIdx === `${frameIdx}:${i}`}
              showOnHover={!annoIdx}
              frame={frame}
              annoIdx={i}
              annoVals={vals}
              className={className}
              style={style}
              timeZone={timeZone}
              key={`${frameIdx}:${i}`}
              exitWipEdit={isWip ? exitWipEdit : null}
              portalRoot={portalRoot}
              canExecuteActions={userCanExecuteActions}
              replaceVariables={replaceVariables}
            />
          );
        }
      }

      return markers;
    });

    return createPortal(markers, xAxisRef.current!);
  }

  return null;
};

const getStyles = () => ({
  annoMarker: css({
    position: 'absolute',
    width: 0,
    height: 0,
    border: 'none',
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderBottomWidth: '5px',
    borderBottomStyle: 'solid',
    transform: 'translateX(-50%)',
    cursor: 'pointer',
    zIndex: 1,
    padding: 0,
    background: 'none',
  }),
  annoRegion: css({
    border: 'none',
    position: 'absolute',
    height: '5px',
    cursor: 'pointer',
    zIndex: 1,
    padding: 0,
    background: 'none',
  }),
});
