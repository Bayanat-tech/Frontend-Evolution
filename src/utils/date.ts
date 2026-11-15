/**
 * Global Date Formatting Utilities
 * Standard: DD/MM/YYYY across all listing tables, forms, and displays.
 */

/**
 * Formats any date value (string, Date, timestamp) into DD/MM/YYYY.
 * Handles ISO strings, YYYY-MM-DD, timestamps, and preserves DD/MM/YYYY without timezone drift.
 */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str || str === "null" || str === "undefined" || str === "N/A" || str === "-") return "";

  // Already in DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(str)) {
    return str.replace(/-/g, "/");
  }

  // ISO or YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // DD-MM-YYYY or D-M-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date value into YYYY-MM-DD for native HTML <input type="date"> elements.
 */
export function dateInput(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str || str === "null" || str === "undefined") return "";

  // Already YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str.slice(0, 10);
  return date.toISOString().slice(0, 10);
}


// ---------- Financial-year helpers (all finance pages) ----------
export type FyRange = { min: string; max: string } | null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pick = (row: any, key: string) => row?.[key] ?? row?.[key.toUpperCase()];

/** {min,max} as YYYY-MM-DD, or null for 'All' / rows without dates. */
// export function getFyRange(fyPeriods: any[], fyPeriod: string): FyRange {
//   const fy = (fyPeriods || []).find((p) => String(pick(p, "fy_period")) === String(fyPeriod));
//   if (!fy) return null;
//   const min = dateInput(pick(fy, "date_from"));
//   const max = dateInput(pick(fy, "date_to"));
//   return ISO_DATE.test(min) && ISO_DATE.test(max) ? { min, max } : null;
// }

const pad2 = (n: number) => String(n).padStart(2, "0");

export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// handles YYYY-MM-DD, DD-MM-YYYY and ISO timestamps (converted to local date)
const ymdLocal = (v: unknown): string => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export function getFyRange(
  fyPeriods: any[],
  fyPeriod: string,
  opts?: { docDate?: string; docEditFrom?: string; docEditTo?: string }
): FyRange {
  const rows = (fyPeriods || [])
    .map((p) => ({ code: String(pick(p, "fy_period")), min: ymdLocal(pick(p, "date_from")), max: ymdLocal(pick(p, "date_to")) }))
    .filter((r) => ISO_DATE.test(r.min) && ISO_DATE.test(r.max));
  const byDate = (d: string) => rows.find((r) => d >= r.min && d <= r.max);
  const pack = (r?: { min: string; max: string }): FyRange => (r ? { min: r.min, max: r.max } : null);

  let target: { min: string; max: string } | null = null;
  if (opts?.docDate) {                       // edit mode: FY of the saved date
    const hit = byDate(ymdLocal(opts.docDate));
    if (hit) target = { min: hit.min, max: hit.max };
  }
  if (!target) {
    const selected = rows.find((r) => r.code === String(fyPeriod));
    if (selected) target = { min: selected.min, max: selected.max };
    else {
      const todayHit = byDate(localToday());
      if (todayHit) target = { min: todayHit.min, max: todayHit.max };
    }
  }

  if (target) {
    // If account period is locked prior to a specific date (docEditFrom), clamp min to prevent backdated entries
    if (opts?.docEditFrom) {
      const editFrom = ymdLocal(opts.docEditFrom);
      if (ISO_DATE.test(editFrom) && editFrom > target.min && editFrom <= target.max) {
        target.min = editFrom;
      }
    }
    // If account period is locked after a specific date (docEditTo), clamp max
    if (opts?.docEditTo) {
      const editTo = ymdLocal(opts.docEditTo);
      if (ISO_DATE.test(editTo) && editTo < target.max && editTo >= target.min) {
        target.max = editTo;
      }
    }
    return pack(target);
  }

  return null;
}

/** Spread onto BiscDatePicker: <BiscDatePicker {...fyDateProps(fyRange)} /> */
export const fyDateProps = (r: FyRange) => (r ? { min: r.min, max: r.max } : {});

/** Pull a default date (e.g. today) inside the FY. */
export const clampToFy = (d: string, r: FyRange) =>
  !r || !d ? d : d < r.min ? r.min : d > r.max ? r.max : d;

/** Error message or null. Use in submit(). */
export function validateFyDate(d: string, r: FyRange, label = "Date"): string | null {
  if (!r || !d) return null;
  const v = dateInput(d);
  return v < r.min || v > r.max
    ? `${label} must be within the financial year (${formatDate(r.min)} – ${formatDate(r.max)}).`
    : null;
}