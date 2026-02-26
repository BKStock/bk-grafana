import { AdHocFilterWithLabels } from '@grafana/scenes';

import { separateAlertStateFilter } from './utils';

describe('separateAlertStateFilter', () => {
  it('should return null alertStateFilter when no alertstate filter exists', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '=', value: 'foo' },
      { key: 'severity', operator: '=', value: 'critical' },
    ];

    const result = separateAlertStateFilter(filters);

    expect(result.alertStateFilter).toBeNull();
    expect(result.remaining).toEqual(filters);
  });

  it('should extract alertstate="firing" as alertStateFilter', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertstate', operator: '=', value: 'firing' },
      { key: 'alertname', operator: '=', value: 'foo' },
    ];

    const result = separateAlertStateFilter(filters);

    expect(result.alertStateFilter).toBe('firing');
    expect(result.remaining).toEqual([{ key: 'alertname', operator: '=', value: 'foo' }]);
  });

  it('should extract alertstate="pending" as alertStateFilter', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '=', value: 'foo' },
      { key: 'alertstate', operator: '=', value: 'pending' },
    ];

    const result = separateAlertStateFilter(filters);

    expect(result.alertStateFilter).toBe('pending');
    expect(result.remaining).toEqual([{ key: 'alertname', operator: '=', value: 'foo' }]);
  });

  it('should silently drop alertstate with non-= operator', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertstate', operator: '=~', value: 'firing|pending' },
      { key: 'alertname', operator: '=', value: 'foo' },
    ];

    const result = separateAlertStateFilter(filters);

    expect(result.alertStateFilter).toBeNull();
    expect(result.remaining).toEqual([{ key: 'alertname', operator: '=', value: 'foo' }]);
  });

  it('should silently drop alertstate with != operator', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertstate', operator: '!=', value: 'firing' }];

    const result = separateAlertStateFilter(filters);

    expect(result.alertStateFilter).toBeNull();
    expect(result.remaining).toEqual([]);
  });

  it('should silently drop alertstate with unrecognized value', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertstate', operator: '=', value: 'resolved' }];

    const result = separateAlertStateFilter(filters);

    expect(result.alertStateFilter).toBeNull();
    expect(result.remaining).toEqual([]);
  });

  it('should handle empty filters array', () => {
    const result = separateAlertStateFilter([]);

    expect(result.alertStateFilter).toBeNull();
    expect(result.remaining).toEqual([]);
  });

  it('should use the last alertstate filter when multiple are present', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertstate', operator: '=', value: 'firing' },
      { key: 'alertstate', operator: '=', value: 'pending' },
    ];

    const result = separateAlertStateFilter(filters);

    expect(result.alertStateFilter).toBe('pending');
    expect(result.remaining).toEqual([]);
  });
});
