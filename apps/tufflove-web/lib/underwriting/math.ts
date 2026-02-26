import { FinancialsInput, AssumptionsInput, UnderwritingResult, AddBack, RiskFlag } from "./types";

const DSCR_GREEN = 1.5;
const DSCR_YELLOW = 1.25;

export function computeNormalizedEbitda(fin: FinancialsInput, asm: AssumptionsInput) {
  const baseEarnings = (fin.ebitda !== null && fin.ebitda !== undefined) ? fin.ebitda : (fin.sde ?? 0);
  const totalAddBacks = fin.addBacks.reduce((sum: number, item: AddBack) => sum + (item.amount ?? 0), 0);
  const totalAdjustments = asm.rentAdjustment + asm.oneTimeExpenseAdjustment + asm.otherAdjustments;
  const operatorDeduction = Math.abs(asm.operatorReplacementCost);
  const normalizedEbitda = baseEarnings + totalAddBacks + totalAdjustments - operatorDeduction;
  return { normalizedEbitda, baseEarnings, totalAddBacks, totalAdjustments, operatorDeduction };
}
export function computeDebtService(purchasePrice: number, downPaymentPercent: number, rate: number, years: number) {
  const principal = purchasePrice - (purchasePrice * downPaymentPercent);
  if (principal <= 0) return { annualDebtService: 0, principal };
  if (rate === 0) return { annualDebtService: principal / years, principal };
  const r = rate / 12; const n = years * 12;
  const monthlyPayment = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return { annualDebtService: monthlyPayment * 12, principal };
}
export function runUnderwritingMath(fin: FinancialsInput, asm: AssumptionsInput): UnderwritingResult {
  const ebitdaCalc = computeNormalizedEbitda(fin, asm);
  const debtCalc = computeDebtService(asm.purchasePrice, asm.downPaymentPercent, asm.debtInterestRate, asm.debtYears);
  const dscr = debtCalc.annualDebtService > 0 ? ebitdaCalc.normalizedEbitda / debtCalc.annualDebtService : 999;
  const riskFlags: RiskFlag[] = [];
  if (dscr < DSCR_YELLOW) riskFlags.push({ level: "red", message: "DSCR < 1.25" });
  else if (dscr < DSCR_GREEN) riskFlags.push({ level: "yellow", message: "DSCR Tight" });
  else riskFlags.push({ level: "green", message: "DSCR Healthy" });
  if (ebitdaCalc.operatorDeduction === 0) riskFlags.push({ level: "red", message: "Operator Cost 0" });
  return { normalizedEbitda: ebitdaCalc.normalizedEbitda, annualDebtService: debtCalc.annualDebtService, dscr, riskFlags, trace: { ...ebitdaCalc, ...debtCalc } };
}
