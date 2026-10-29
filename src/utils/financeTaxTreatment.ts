export type FinanceTaxTreatment = 'N' | 'S' | 'Z' | 'E';
export type FinanceTaxLabels = Record<FinanceTaxTreatment, string>;

export const DEFAULT_FINANCE_TAX_LABELS: FinanceTaxLabels = {
  N: 'No Tax', S: 'Std Tax', Z: 'Zero-rated', E: 'Exempt',
};

export function resolveFinanceTaxLabels(config?: Partial<FinanceTaxLabels> | null): FinanceTaxLabels {
  const labels = { ...DEFAULT_FINANCE_TAX_LABELS };
  for (const code of Object.keys(labels) as FinanceTaxTreatment[]) {
    const label = config?.[code]?.trim();
    if (label) labels[code] = label;
  }
  return labels;
}

export function financeTaxLabel(value: unknown, labels: FinanceTaxLabels): string {
  const code = String(value || 'N').trim().toUpperCase() as FinanceTaxTreatment;
  return Object.prototype.hasOwnProperty.call(labels, code) ? labels[code] : labels.N;
}

/** Master TX_TYPE labels are not the one-character transaction treatment. */
export function taxTreatmentFromMaster(value: unknown, rate: number): FinanceTaxTreatment {
  const type = String(value ?? '').trim().toUpperCase();
  if (type === 'N' || type === 'N/A' || type === 'N//A' || type === 'NO TAX') return 'N';
  if (type === 'E' || type.includes('EXEMPT')) return 'E';
  if (type === 'Z' || type.includes('ZERO')) return 'Z';
  if (type === 'S' || type.includes('STD') || type.includes('STANDARD')) return 'S';
  return rate > 0 ? 'S' : 'N';
}
