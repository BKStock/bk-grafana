import { HttpResponse, http } from 'msw';

import { API_GROUP, API_VERSION, ListCorrelationApiResponse } from '@grafana/api-clients/rtkq/correlations/v0alpha1';

import { CorrelationSpec } from '../../../../types/correlations';

export const getCorrelationsHandler = (
  data: ListCorrelationApiResponse | ((info: Parameters<Parameters<typeof http.get>[1]>[0]) => Response)
) =>
  http.get('/apis/correlations.grafana.app/v0alpha1/namespaces/:namespace/correlations', ({ request }) => {
    /* const limitFilter = new URL(request.url).searchParams.get('limit') || null;
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
      
      {
      kind: 'CorrelationList',
      apiVersion: 'correlations.grafana.app/v0alpha1',
      metadata: {},
      code: 200,
      items: returnCorr.map((rc) => generateCorrMetadata(rc)),
    }*/

    return HttpResponse.json(data);
  });
