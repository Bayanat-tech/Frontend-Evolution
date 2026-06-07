export const STANDARD_WEIGHTS: Record<string, number> = {
  standard_1: 0.1,
  standard_2: 0.25,
  standard_3: 0.25,
  standard_4: 0.1,
  standard_5: 0.1,
  standard_6: 0.1,
  standard_7: 0.1,
};

export const STATUS_SCORE_MAP: Record<string, number> = {
  "Not Started (0%)": 0,
  "In Progress (25%)": 0.25,
  "In Progress (50%)": 0.5,
  "In Progress (75%)": 0.75,
  "Done (100%)": 1,
};

export function isStandardField(field: string) {
  return /^standard_\d+$/.test(field);
}

const roundTo = (value: number, decimalPlaces: number) => {
  const multiplier = 10 ** decimalPlaces;
  return Math.round(value * multiplier) / multiplier;
};

const truncateDate = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export function calculateProgressFields(row: Record<string, unknown>) {
  const status = String(row.status ?? "");
  const results = (STATUS_SCORE_MAP[status] ?? 0) * 100;
  const results1 =
    Object.entries(STANDARD_WEIGHTS).reduce((sum, [field, weight]) => {
      return sum + (row[field] === "Y" ? weight : 0);
    }, 0) * 100;
  const overallResult = (results + results1) / 2;
  const weightage = Number(row.weightage || 0);
  const overallWeightageAccomplished = roundTo((Number.isFinite(weightage) ? weightage : 0) * overallResult, 4);
  const estCompletionDate = truncateDate(row.est_completion_date);
  const endDate = truncateDate(row.end_date);
  const variance =
    estCompletionDate && endDate
      ? Math.trunc((estCompletionDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  return {
    results,
    results1,
    overall_result: overallResult,
    overall_weightage_accomplished: overallWeightageAccomplished,
    variance,
  };
}

export function applyProgressCalculations<T extends Record<string, unknown>>(row: T) {
  return { ...row, ...calculateProgressFields(row) };
}

export function buildBTProjectPayloadRow(row: Record<string, unknown>, module?: string) {
  const withCalculated = applyProgressCalculations(row);

  return {
    ID: withCalculated.id ?? null,
    id: withCalculated.id ?? null,
    MODULE: module ?? "",
    SUB_MODULES: withCalculated.sub_modules ?? "",
    ACTIVITY: withCalculated.activity ?? "",
    WEIGHTAGE: Number(withCalculated.weightage || 0),
    DEVELOPER: withCalculated.developer ?? null,
    START_DATE: withCalculated.start_date || null,
    EST_COMPLETION_DATE: withCalculated.est_completion_date || null,
    END_DATE: withCalculated.end_date || null,
    VARIANCE: Number(withCalculated.variance || 0),
    STATUS: withCalculated.status ?? null,
    RESULTS: Number(withCalculated.results || 0),
    TESTER: withCalculated.tester ?? null,
    STANDARD_1: withCalculated.standard_1 ?? null,
    STANDARD_2: withCalculated.standard_2 ?? null,
    STANDARD_3: withCalculated.standard_3 ?? null,
    STANDARD_4: withCalculated.standard_4 ?? null,
    STANDARD_5: withCalculated.standard_5 ?? null,
    STANDARD_6: withCalculated.standard_6 ?? null,
    STANDARD_7: withCalculated.standard_7 ?? null,
    RESULTS1: Number(withCalculated.results1 || 0),
    OVERALL_RESULT: Number(withCalculated.overall_result || 0),
    OVERALL_WEIGHTAGE_ACCOMPLISHED: Number(withCalculated.overall_weightage_accomplished || 0),
  };
}
