import { describe, it, expect } from 'vitest';
import {
  FINANCE_FORMULA_REGISTRY,
  getFinanceFormula,
  listFinanceFormulas,
  isValidFinanceFormulaId,
  FinanceFormulaId,
} from '../financeFormulaRegistry';

const ALL_FORMULA_IDS: FinanceFormulaId[] = [
  'percent_change',
  'simple_return',
  'cagr',
  'volatility_estimate',
  'max_drawdown',
  'sharpe_ratio',
  'option_breakeven_call',
  'option_breakeven_put',
  'pe_ratio',
  'market_cap',
  'revenue_growth',
  'eps',
];

describe('financeFormulaRegistry', () => {
  it('registry includes all 12 formulas', () => {
    expect(FINANCE_FORMULA_REGISTRY).toHaveLength(12);
  });

  it('getFinanceFormula returns definition for valid id', () => {
    const formula = getFinanceFormula('cagr');
    expect(formula).toBeDefined();
    expect(formula?.id).toBe('cagr');
    expect(formula?.formulaText).toBeTruthy();
    expect(formula?.titleKey).toBeTruthy();
    expect(formula?.variables).toBeDefined();
    expect(formula?.variables.length).toBeGreaterThan(0);
    expect(formula?.limitationKey).toBeTruthy();
  });

  it('getFinanceFormula returns undefined for invalid id', () => {
    expect(getFinanceFormula('not_a_formula' as FinanceFormulaId)).toBeUndefined();
    expect(getFinanceFormula('random_id' as FinanceFormulaId)).toBeUndefined();
    expect(getFinanceFormula('' as FinanceFormulaId)).toBeUndefined();
  });

  it('isValidFinanceFormulaId returns true for valid ids', () => {
    for (const id of ALL_FORMULA_IDS) {
      expect(isValidFinanceFormulaId(id)).toBe(true);
    }
  });

  it('isValidFinanceFormulaId returns false for invalid ids', () => {
    expect(isValidFinanceFormulaId('not_a_formula')).toBe(false);
    expect(isValidFinanceFormulaId('')).toBe(false);
    expect(isValidFinanceFormulaId('PERCENT_CHANGE')).toBe(false); // case-sensitive
    expect(isValidFinanceFormulaId('pe_ratio_extra')).toBe(false);
  });

  it('every formula has non-empty formulaText', () => {
    for (const formula of FINANCE_FORMULA_REGISTRY) {
      expect(formula.formulaText.trim().length).toBeGreaterThan(0);
    }
  });

  it('every formula has non-empty limitationKey', () => {
    for (const formula of FINANCE_FORMULA_REGISTRY) {
      expect(formula.limitationKey.trim().length).toBeGreaterThan(0);
    }
  });

  it('all expected FinanceFormulaId values exist in registry', () => {
    for (const id of ALL_FORMULA_IDS) {
      const found = FINANCE_FORMULA_REGISTRY.find((f) => f.id === id);
      expect(found).toBeDefined();
    }
  });

  it('listFinanceFormulas returns array with correct length', () => {
    const list = listFinanceFormulas();
    expect(list).toHaveLength(12);
    expect(Array.isArray(list)).toBe(true);
  });

  it('registry formulas have valid category values', () => {
    const validCategories = ['return', 'risk', 'options', 'valuation', 'fundamentals'];
    for (const formula of FINANCE_FORMULA_REGISTRY) {
      expect(validCategories).toContain(formula.category);
    }
  });

  it('every formula has at least one variable', () => {
    for (const formula of FINANCE_FORMULA_REGISTRY) {
      expect(formula.variables.length).toBeGreaterThan(0);
    }
  });

  it('every formula variable has symbol and meaningKey', () => {
    for (const formula of FINANCE_FORMULA_REGISTRY) {
      for (const variable of formula.variables) {
        expect(variable.symbol.trim().length).toBeGreaterThan(0);
        expect(variable.meaningKey.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
