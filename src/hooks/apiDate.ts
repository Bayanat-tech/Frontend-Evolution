export const API_TIME_ZONE =
  (import.meta as any).env?.VITE_API_TIME_ZONE ?? "Asia/Kolkata";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}/;


export function isApiDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE_ONLY.test(value) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

export function formatApiDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { timeZone: API_TIME_ZONE });
}

export function toApiDateInput(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  // en-CA formats as yyyy-mm-dd
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: API_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}