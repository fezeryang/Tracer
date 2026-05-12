/**
 * Phase C-8B: Finance Formula Registry
 *
 * Hardcoded whitelist of 12 financial education formulas.
 * No AI, no KaTeX — pure display text with variable definitions.
 * All formulas include educational disclaimers.
 */

export type FinanceFormulaId =
  | 'percent_change'
  | 'simple_return'
  | 'cagr'
  | 'volatility_estimate'
  | 'max_drawdown'
  | 'sharpe_ratio'
  | 'option_breakeven_call'
  | 'option_breakeven_put'
  | 'pe_ratio'
  | 'market_cap'
  | 'revenue_growth'
  | 'eps';

export type FinanceFormulaCategory = 'return' | 'risk' | 'options' | 'valuation' | 'fundamentals';

export interface FinanceFormulaVariable {
  symbol: string;
  meaningKey: string;
}

export interface FinanceFormulaDefinition {
  id: FinanceFormulaId;
  titleKey: string;
  formulaText: string;
  variables: FinanceFormulaVariable[];
  limitationKey: string;
  category: FinanceFormulaCategory;
}

const REGISTRY: FinanceFormulaDefinition[] = [
  // --- Return Metrics ---
  {
    id: 'percent_change',
    titleKey: 'financeFormula.percent_change.title',
    formulaText: '(Current - Previous) / |Previous| × 100%',
    variables: [
      { symbol: 'Current', meaningKey: 'financeFormula.percent_change.current' },
      { symbol: 'Previous', meaningKey: 'financeFormula.percent_change.previous' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'return',
  },
  {
    id: 'simple_return',
    titleKey: 'financeFormula.simple_return.title',
    formulaText: '(Ending Value - Beginning Value) / Beginning Value × 100%',
    variables: [
      { symbol: 'Beginning Value', meaningKey: 'financeFormula.simple_return.beginning' },
      { symbol: 'Ending Value', meaningKey: 'financeFormula.simple_return.ending' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'return',
  },
  {
    id: 'cagr',
    titleKey: 'financeFormula.cagr.title',
    formulaText: '(Ending Value / Beginning Value)^(1/n) - 1',
    variables: [
      { symbol: 'Beginning Value', meaningKey: 'financeFormula.cagr.beginning' },
      { symbol: 'Ending Value', meaningKey: 'financeFormula.cagr.ending' },
      { symbol: 'n', meaningKey: 'financeFormula.cagr.n' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'return',
  },

  // --- Risk Metrics ---
  {
    id: 'volatility_estimate',
    titleKey: 'financeFormula.volatility_estimate.title',
    formulaText: 'σ = √[Σ(ri - r̄)² / (n - 1)] × √252',
    variables: [
      { symbol: 'ri', meaningKey: 'financeFormula.volatility_estimate.ri' },
      { symbol: 'r̄', meaningKey: 'financeFormula.volatility_estimate.rbar' },
      { symbol: 'n', meaningKey: 'financeFormula.volatility_estimate.n' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'risk',
  },
  {
    id: 'max_drawdown',
    titleKey: 'financeFormula.max_drawdown.title',
    formulaText: 'Max Drawdown = (Peak - Trough) / Peak × 100%',
    variables: [
      { symbol: 'Peak', meaningKey: 'financeFormula.max_drawdown.peak' },
      { symbol: 'Trough', meaningKey: 'financeFormula.max_drawdown.trough' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'risk',
  },
  {
    id: 'sharpe_ratio',
    titleKey: 'financeFormula.sharpe_ratio.title',
    formulaText: 'Sharpe Ratio = (Rp - Rf) / σp',
    variables: [
      { symbol: 'Rp', meaningKey: 'financeFormula.sharpe_ratio.rp' },
      { symbol: 'Rf', meaningKey: 'financeFormula.sharpe_ratio.rf' },
      { symbol: 'σp', meaningKey: 'financeFormula.sharpe_ratio.sigmap' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'risk',
  },

  // --- Options ---
  {
    id: 'option_breakeven_call',
    titleKey: 'financeFormula.option_breakeven_call.title',
    formulaText: 'Breakeven (Call) = Strike Price + Premium Paid',
    variables: [
      { symbol: 'Strike Price', meaningKey: 'financeFormula.option_breakeven_call.strike' },
      { symbol: 'Premium Paid', meaningKey: 'financeFormula.option_breakeven_call.premium' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'options',
  },
  {
    id: 'option_breakeven_put',
    titleKey: 'financeFormula.option_breakeven_put.title',
    formulaText: 'Breakeven (Put) = Strike Price - Premium Paid',
    variables: [
      { symbol: 'Strike Price', meaningKey: 'financeFormula.option_breakeven_put.strike' },
      { symbol: 'Premium Paid', meaningKey: 'financeFormula.option_breakeven_put.premium' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'options',
  },

  // --- Valuation ---
  {
    id: 'pe_ratio',
    titleKey: 'financeFormula.pe_ratio.title',
    formulaText: 'P/E Ratio = Stock Price / Earnings Per Share',
    variables: [
      { symbol: 'Stock Price', meaningKey: 'financeFormula.pe_ratio.price' },
      { symbol: 'EPS', meaningKey: 'financeFormula.pe_ratio.eps' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'valuation',
  },
  {
    id: 'market_cap',
    titleKey: 'financeFormula.market_cap.title',
    formulaText: 'Market Cap = Stock Price × Total Shares Outstanding',
    variables: [
      { symbol: 'Stock Price', meaningKey: 'financeFormula.market_cap.price' },
      { symbol: 'Shares Outstanding', meaningKey: 'financeFormula.market_cap.shares' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'valuation',
  },

  // --- Fundamentals ---
  {
    id: 'revenue_growth',
    titleKey: 'financeFormula.revenue_growth.title',
    formulaText: 'Revenue Growth = (Current Revenue - Previous Revenue) / Previous Revenue × 100%',
    variables: [
      { symbol: 'Current Revenue', meaningKey: 'financeFormula.revenue_growth.current' },
      { symbol: 'Previous Revenue', meaningKey: 'financeFormula.revenue_growth.previous' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'fundamentals',
  },
  {
    id: 'eps',
    titleKey: 'financeFormula.eps.title',
    formulaText: 'EPS = (Net Income - Preferred Dividends) / Average Outstanding Shares',
    variables: [
      { symbol: 'Net Income', meaningKey: 'financeFormula.eps.netIncome' },
      { symbol: 'Preferred Dividends', meaningKey: 'financeFormula.eps.preferred' },
      { symbol: 'Avg Outstanding Shares', meaningKey: 'financeFormula.eps.shares' },
    ],
    limitationKey: 'financeFormula.limitation',
    category: 'fundamentals',
  },
];

export const FINANCE_FORMULA_REGISTRY: FinanceFormulaDefinition[] = REGISTRY;

export function getFinanceFormula(id: FinanceFormulaId): FinanceFormulaDefinition | undefined {
  return REGISTRY.find((f) => f.id === id);
}

export function listFinanceFormulas(): FinanceFormulaDefinition[] {
  return [...REGISTRY];
}

const VALID_IDS = new Set<FinanceFormulaId>(REGISTRY.map((f) => f.id));

export function isValidFinanceFormulaId(id: string): id is FinanceFormulaId {
  return VALID_IDS.has(id as FinanceFormulaId);
}
