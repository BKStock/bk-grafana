import { DataFrameView } from '@grafana/data';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { RuleFrame, countRules } from './SummaryStats';

describe('countRules', () => {
  // Helper to create mock DataFrameView
  function createMockRuleDfv(
    data: Array<{ ruleUID: string; alertstate: PromAlertingRuleState.Firing | PromAlertingRuleState.Pending }>
  ): DataFrameView<RuleFrame> {
    return {
      length: data.length,
      fields: {
        grafana_rule_uid: {
          values: data.map((d) => d.ruleUID),
        },
        alertstate: {
          values: data.map((d) => d.alertstate),
        },
      },
    } as unknown as DataFrameView<RuleFrame>;
  }

  it('should count rules by alertstate', () => {
    const ruleDfv = createMockRuleDfv([
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending },
    ]);

    const result = countRules(ruleDfv);

    expect(result.firing).toBe(2);
    expect(result.pending).toBe(1);
  });

  it('should count rules with BOTH firing and pending in both counts', () => {
    const ruleDfv = createMockRuleDfv([
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Pending }, // Same rule, both states
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Firing }, // Only firing
      { ruleUID: 'rule3', alertstate: PromAlertingRuleState.Pending }, // Only pending
    ]);

    const result = countRules(ruleDfv);

    expect(result.firing).toBe(2); // rule1 and rule2
    expect(result.pending).toBe(2); // rule1 and rule3
  });

  it('should deduplicate multiple instances of the same rule', () => {
    const ruleDfv = createMockRuleDfv([
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule1', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
      { ruleUID: 'rule2', alertstate: PromAlertingRuleState.Pending },
    ]);

    const result = countRules(ruleDfv);

    expect(result.firing).toBe(1);
    expect(result.pending).toBe(1);
  });

  it('should return 0 for both counts when no rules', () => {
    const ruleDfv = createMockRuleDfv([]);

    const result = countRules(ruleDfv);

    expect(result.firing).toBe(0);
    expect(result.pending).toBe(0);
  });

  it('should handle complex scenario with many rules', () => {
    const ruleDfv = createMockRuleDfv([
      // Rule A: Only firing (3 instances)
      { ruleUID: 'ruleA', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'ruleA', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'ruleA', alertstate: PromAlertingRuleState.Firing },
      // Rule B: Only pending (2 instances)
      { ruleUID: 'ruleB', alertstate: PromAlertingRuleState.Pending },
      { ruleUID: 'ruleB', alertstate: PromAlertingRuleState.Pending },
      // Rule C: Both firing and pending (4 instances)
      { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Firing },
      { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Pending },
      { ruleUID: 'ruleC', alertstate: PromAlertingRuleState.Pending },
      // Rule D: Only firing (1 instance)
      { ruleUID: 'ruleD', alertstate: PromAlertingRuleState.Firing },
      // Rule E: Only pending (1 instance)
      { ruleUID: 'ruleE', alertstate: PromAlertingRuleState.Pending },
    ]);

    const result = countRules(ruleDfv);
    expect(result.firing).toBe(3); // Rule A, C, and D
    expect(result.pending).toBe(3); // Rule B, C, and E
  });
});
