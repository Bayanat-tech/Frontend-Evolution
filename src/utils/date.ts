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

