import { HttpResponse, http } from 'msw';

import { CorrelationSpec } from '../../../../types/correlations';

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
      kind: 'correlationsasdasd',
      apiVersion: 'v1',
      metadata: {},
      code: 200,
      items: returnCorr,
    });
  });

export default [getCorrelationsHandler()];
