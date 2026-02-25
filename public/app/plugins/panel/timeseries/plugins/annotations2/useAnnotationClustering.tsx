import { useMemo } from 'react';
import { DataFrame, FieldType } from '@grafana/data';

interface Props {
  annotations: DataFrame[];
  clusteringMode: ClusteringMode | null;
}

enum ClusteringMode {
  Hover = 'hover',
  Render = 'render',
}

export const useAnnotationClustering = ({ annotations: _annos, clusteringMode }: Props) => {
  const { annos } = useMemo(() => {
    const annos2: DataFrame[] = [];

    // 15min in millis
    // todo: compute this from pixel space, to make dynamic, like 10px -> millis
    let mergeThreshold = (3600 / 4) * 1e3;

    // per-frame clustering
    if (clusteringMode === ClusteringMode.Render) {
      for (let i = 0; i < _annos.length; i++) {
        let frame = _annos[i];

        let timeVals = frame.fields.find((f) => f.name === 'time')!.values;
        let colorVals = frame.fields.find((f) => f.name === 'color')!.values;

        if (timeVals.length > 1) {
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

          // console.log(clusters);

          let frame2: DataFrame = {
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

          let hasTimeEndField = frame2.fields.findIndex((field) => field.name === 'timeEnd') !== -1;

          if (!hasTimeEndField) {
            frame2.fields.push({
              type: FieldType.time,
              name: 'timeEnd',
              values: Array(frame2.fields[0].values.length).fill(null),
              config: {},
            });
          }

          // append cluster regions to frame
          clusters.forEach((idxs, ci) => {
            frame2.fields.forEach((field) => {
              let vals = field.values;

              if (field.name === 'time') {
                vals.push(timeVals[idxs[0]]);
              } else if (field.name === 'timeEnd') {
                let lastIdx = idxs.length - 1;
                vals.push(timeVals[idxs[lastIdx]]);
              } else if (field.name === 'isRegion') {
                vals.push(true);
              } else if (field.name === 'color') {
                vals.push(colorVals[idxs[0]]);
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

          frame2.length = frame2.fields[0].values.length;

          // console.log(frame2);
          annos2.push(frame2);
        } else {
          annos2.push(frame);
        }
      }
    } else if (clusteringMode === ClusteringMode.Hover) {
      // TODO
    }

    return { annos: annos2.length > 0 ? annos2 : _annos };
  }, [_annos, clusteringMode]);

  return annos;
};
