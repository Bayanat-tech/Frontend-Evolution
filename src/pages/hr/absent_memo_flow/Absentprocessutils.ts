import { AbsentDetailRow } from "./Absentprocesstypes";

// Inclusive day count between Absent From Date and Absent To Date
export function calcNoOfDays(fromDate: string, toDate: string): number {
  if (!fromDate || !toDate) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

// Recompute a single row's derived no_of_days after a date edit
export function recalcRow(row: AbsentDetailRow): AbsentDetailRow {
  return { ...row, no_of_days: calcNoOfDays(row.absent_from_date, row.absent_to_date) };
}

// Sum of Amount across all non-cancelled detail rows
export function calcTotalAmount(rows: AbsentDetailRow[]): number {
  return rows.reduce((sum, r) => (r.is_canceled ? sum : sum + (Number(r.amount) || 0)), 0);
}

export function calcTotalDays(rows: AbsentDetailRow[]): number {
  return rows.reduce((sum, r) => (r.is_canceled ? sum : sum + (Number(r.no_of_days) || 0)), 0);
}

export function formatCurrency(value: number): string {
  return (Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}