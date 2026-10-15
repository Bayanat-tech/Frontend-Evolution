import { freightColumnRules } from "./freightColumnRules";

export function freightTextLimit(table: string, field: string) {
  return freightColumnRules[table]?.[field.toLowerCase()]?.maxLength;
}

/** Oracle BYTE columns use AL32UTF8, so multibyte text must also fit the byte limit. */
export function freightValidationError(table: string, record: object): string | null {
  for (const [field, value] of Object.entries(record)) {
    const rule = freightColumnRules[table]?.[field.toLowerCase()];
    if (!rule || value == null || value === "") continue;
    const text = String(value);
    const label = field.replace(/_/g, " ");
    if ([...text].length > rule.maxLength) return `${label}: maximum ${rule.maxLength} characters.`;
    if (rule.maxBytes && new TextEncoder().encode(text).length > rule.maxBytes) {
      return `${label}: maximum ${rule.maxBytes} UTF-8 bytes. Non-English characters can use more than one byte.`;
    }
  }
  return null;
}

export function assertFreightRecords(table: string, records: object[], label: string) {
  for (const [index, record] of records.entries()) {
    const error = freightValidationError(table, record);
    if (error) throw new Error(`${label}${records.length > 1 ? ` ${index + 1}` : ""}: ${error}`);
  }
}
