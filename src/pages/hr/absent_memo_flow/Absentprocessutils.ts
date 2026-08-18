import { AbsentDetailRow } from "./Absentprocesstypes";

export function calcTotalAmount(rows: AbsentDetailRow[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export function calcTotalDeductDays(rows: AbsentDetailRow[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.deduct_noof_leavedays) || 0), 0);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}