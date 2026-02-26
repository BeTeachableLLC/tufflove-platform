export interface AddBack {
  amount?: number | null;
  label?: string | null;
}

export interface FinancialsInput {
  revenue?: number | null;
  sde?: number | null;
  ebitda?: number | null;
  addBacks: AddBack[];
}

export interface AssumptionsInput {
  operatorReplacementCost: number;
  rentAdjustment: number;
  oneTimeExpenseAdjustment: number;
  otherAdjustments: number;
  purchasePrice: number;
  downPaymentPercent: number;
  debtInterestRate: number;
  debtYears: number;
}

export type RiskFlagLevel = "red" | "yellow" | "green";

export interface RiskFlag {
  level: RiskFlagLevel;
  message: string;
}

export interface UnderwritingTrace {
  normalizedEbitda: number;
  baseEarnings: number;
  totalAddBacks: number;
  totalAdjustments: number;
  operatorDeduction: number;
  annualDebtService: number;
  principal: number;
}

export interface UnderwritingResult {
  normalizedEbitda: number;
  annualDebtService: number;
  dscr: number;
  riskFlags: RiskFlag[];
  trace: UnderwritingTrace;
}
