import { METRIC_NAME } from '../constants';

import { alertSeriesExpr, uniqueAlertInstancesExpr } from './queries';

describe('alertSeriesExpr', () => {
  it('should return plain metric when alertStateFilter is null', () => {
    expect(alertSeriesExpr('severity="critical"')).toBe(`${METRIC_NAME}{severity="critical"}`);
  });

  it('should return plain metric with empty filter when alertStateFilter is null', () => {
    expect(alertSeriesExpr('')).toBe(`${METRIC_NAME}{}`);
  });

  it('should return only firing metric when alertStateFilter is firing', () => {
    const result = alertSeriesExpr('severity="critical"', 'firing');
    expect(result).toBe(`${METRIC_NAME}{alertstate="firing",severity="critical"}`);
  });

  it('should return only firing metric with empty base filter', () => {
    const result = alertSeriesExpr('', 'firing');
    expect(result).toBe(`${METRIC_NAME}{alertstate="firing"}`);
  });

  it('should return pending-unless-firing when alertStateFilter is pending', () => {
    const result = alertSeriesExpr('severity="critical"', 'pending');
    expect(result).toBe(
      `${METRIC_NAME}{alertstate="pending",severity="critical"} unless ignoring(alertstate, grafana_alertstate) ` +
        `${METRIC_NAME}{alertstate="firing",severity="critical"}`
    );
  });

  it('should return pending-unless-firing with empty base filter', () => {
    const result = alertSeriesExpr('', 'pending');
    expect(result).toBe(
      `${METRIC_NAME}{alertstate="pending"} unless ignoring(alertstate, grafana_alertstate) ` +
        `${METRIC_NAME}{alertstate="firing"}`
    );
  });
});

describe('uniqueAlertInstancesExpr', () => {
  describe('with no alertStateFilter (default dedup)', () => {
    it('should return firing OR (pending UNLESS firing) with filter', () => {
      const result = uniqueAlertInstancesExpr('severity="critical"');
      expect(result).toBe(
        `last_over_time(${METRIC_NAME}{alertstate="firing",severity="critical"}[$__range]) or ` +
          `(last_over_time(${METRIC_NAME}{alertstate="pending",severity="critical"}[$__range]) ` +
          `unless ignoring(alertstate, grafana_alertstate) ` +
          `last_over_time(${METRIC_NAME}{alertstate="firing",severity="critical"}[$__range]))`
      );
    });

    it('should return firing OR (pending UNLESS firing) with empty filter', () => {
      const result = uniqueAlertInstancesExpr('');
      expect(result).toBe(
        `last_over_time(${METRIC_NAME}{alertstate="firing"}[$__range]) or ` +
          `(last_over_time(${METRIC_NAME}{alertstate="pending"}[$__range]) ` +
          `unless ignoring(alertstate, grafana_alertstate) ` +
          `last_over_time(${METRIC_NAME}{alertstate="firing"}[$__range]))`
      );
    });
  });

  describe('with alertStateFilter=firing', () => {
    it('should return only firing instances with filter', () => {
      const result = uniqueAlertInstancesExpr('severity="critical"', 'firing');
      expect(result).toBe(`last_over_time(${METRIC_NAME}{alertstate="firing",severity="critical"}[$__range])`);
    });

    it('should return only firing instances with empty filter', () => {
      const result = uniqueAlertInstancesExpr('', 'firing');
      expect(result).toBe(`last_over_time(${METRIC_NAME}{alertstate="firing"}[$__range])`);
    });
  });

  describe('with alertStateFilter=pending', () => {
    it('should return pending UNLESS firing with filter', () => {
      const result = uniqueAlertInstancesExpr('severity="critical"', 'pending');
      expect(result).toBe(
        `last_over_time(${METRIC_NAME}{alertstate="pending",severity="critical"}[$__range]) ` +
          `unless ignoring(alertstate, grafana_alertstate) ` +
          `last_over_time(${METRIC_NAME}{alertstate="firing",severity="critical"}[$__range])`
      );
    });

    it('should return pending UNLESS firing with empty filter', () => {
      const result = uniqueAlertInstancesExpr('', 'pending');
      expect(result).toBe(
        `last_over_time(${METRIC_NAME}{alertstate="pending"}[$__range]) ` +
          `unless ignoring(alertstate, grafana_alertstate) ` +
          `last_over_time(${METRIC_NAME}{alertstate="firing"}[$__range])`
      );
    });
  });
});
