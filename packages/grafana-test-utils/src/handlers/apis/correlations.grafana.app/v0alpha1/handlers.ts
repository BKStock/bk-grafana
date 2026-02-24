import { HttpResponse, http } from 'msw';

import { CorrelationSpec } from '../../../../types/correlations';

const generateCorrMetadata = (correlation: CorrelationSpec) => {
  let labels: any = {
    'correlations.grafana.app/sourceDS-ref': `${correlation.source.group}.${correlation.source.name}`,
  };

  if (correlation.target?.group !== undefined && correlation.target?.name !== undefined) {
    labels['correlations.grafana.app/targetDS-ref'] = `${correlation.target?.group}.${correlation.target?.name}`;
  }

  return {
    kind: 'Correlation',
    apiVersion: 'correlations.grafana.app/v0alpha1',
    metadata: {
      name: Math.floor(Math.random() * 1000),
      namespace: 'default',
      labels: labels,
    },
    spec: correlation,
  };
};

const fakeCorrelations: CorrelationSpec[] = [
  {
    source: { group: 'loki', name: 'lokiUID' },
    target: { group: 'loki', name: 'lokiUID' },
    label: 'Loki to Loki',
    type: 'query',
    config: {
      field: 'line',
      target: {},
      transformations: [{ type: 'regex', expression: 'url=http[s]?://(S*)', mapValue: 'path' }],
    },
  },
  {
    source: { group: 'loki', name: 'lokiUID' },
    target: { group: 'prometheus', name: 'prometheusUID' },
    label: 'Loki to Prometheus',
    type: 'query',
    config: {
      field: 'line',
      target: {},
      transformations: [{ type: 'regex', expression: 'url=http[s]?://(S*)', mapValue: 'path' }],
    },
  },
  {
    source: { group: 'prometheus', name: 'prometheusUID' },
    target: { group: 'loki', name: 'lokiUID' },
    label: 'Prometheus to Loki',
    type: 'query',
    config: { field: 'label', target: {} },
  },
  {
    source: { group: 'prometheus', name: 'prometheusUID' },
    target: { group: 'prometheus', name: 'prometheusUID' },
    label: 'Prometheus to Prometheus',
    type: 'query',
    config: { field: 'label', target: {} },
  },
];

const getCorrelationsHandler = () =>
  http.get('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations', ({ request }) => {
    const limitFilter = new URL(request.url).searchParams.get('limit') || null;
    const labelFilter = new URL(request.url).searchParams.get('label') || null;
    let returnCorr = [];

    if (labelFilter !== null) {
      returnCorr = fakeCorrelations.filter((fc) => fc.source.name === labelFilter);
    } else {
      returnCorr = fakeCorrelations;
    }

    if (limitFilter !== null) {
      returnCorr = returnCorr.slice(0, parseInt(limitFilter, 10));
    }

    return HttpResponse.json({
      kind: 'CorrelationList',
      apiVersion: 'orrelations.grafana.app/v0alpha1',
      metadata: {},
      code: 200,
      items: returnCorr.map((rc) => generateCorrMetadata(rc)),
    });
  });

export default [getCorrelationsHandler()];
