// TODO assess the use of this

export type CorrelationTargetSpec = {
  [key: string]: any;
};
export type CorrelationTransformationSpec = {
  expression?: string;
  field?: string;
  mapValue?: string;
  type: 'regex' | 'logfmt';
};
export type CorrelationConfigSpec = {
  field: string;
  target: CorrelationTargetSpec;
  transformations?: CorrelationTransformationSpec[];
};
export type CorrelationDataSourceRef = {
  /** same as pluginId */
  group: string;
  /** same as grafana uid */
  name: string;
};
export type CorrelationCorrelationType = 'query' | 'external';
export type CorrelationSpec = {
  config: CorrelationConfigSpec;
  description?: string;
  label: string;
  source: CorrelationDataSourceRef;
  target?: CorrelationDataSourceRef;
  type: CorrelationCorrelationType;
};
export type Correlation = {
  apiVersion: string;
  kind: string;
  metadata: any;
  spec: CorrelationSpec;
};
