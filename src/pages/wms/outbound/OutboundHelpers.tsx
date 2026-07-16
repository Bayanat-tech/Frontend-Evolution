// import type { WmsRow } from "./OutboundTypes";
// import { jobFields, outboundJobsPath } from "./OutboundTypes";
import { executeWmsInboundSql } from "../../../api/wms";
import type { LookupRow } from "../../../api/lookups";

export type WmsRow = Record<string, unknown>;

export function normalizeRow(row: WmsRow): WmsRow {
  const normalized: WmsRow = { ...row };
  Object.entries(row || {}).forEach(([key, rowValue]) => {
    normalized[key.toLowerCase()] = rowValue;
  });
  return normalized;
}
export const outboundJobsPath = "/workspace/wms/wms/transactions/outbound/jobs_oub";

export const jobFields = [
  { name: "prin_code", label: "Principal Code", required: true },
  { name: "dept_code", label: "Department Code" },
  { name: "div_code", label: "Division Code" },
  { name: "job_class", label: "Job Class", required: true },
  { name: "job_type", label: "Job Type", required: true },
  { name: "country_origin", label: "Country Origin" },
  { name: "country_destination", label: "Country Destination" },
  { name: "port_code", label: "Port Code" },
  { name: "destination_port", label: "Destination Port" },
  { name: "transport_mode", label: "Transport Mode" },
  { name: "schedule_date", label: "Schedule Date", type: "date" },
  { name: "doc_ref", label: "Doc Ref" },
  { name: "prin_ref2", label: "Principal Ref 2" },
  { name: "description1", label: "Description" },
  { name: "remarks", label: "Remarks" },
];

export function normalizeLookupRows(rows: unknown): LookupRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeRow((row || {}) as WmsRow) as LookupRow);
}

export function value(row: WmsRow, key: string): string {
  return String(row[key] ?? row[key.toUpperCase()] ?? "");
}

export function lookupText(row: LookupRow | WmsRow, key: string): string {
  return String(row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? "");
}

export function formatLookupDisplay(row: WmsRow, keys: string[]): string {
  return keys.map((key) => String(row[key] || "")).filter(Boolean).join(" - ");
}

export function formatCellValue(row: WmsRow, key: string): string {
  const cell = value(row, key);
  const isLocationField = key.includes("loc_code") || key === "location_code";
  if (
    !isLocationField &&
    (key.includes("date") ||
      key.includes("_from") ||
      key.includes("_to") ||
      key.endsWith("_start") ||
      key.endsWith("_end"))
  )
    return formatDate(cell);
  return cell;
}

export function formatDate(input: string): string {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString("en-GB");
}

export function toDateInputValue(input: string): string {
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function hasDate(input: string): boolean {
  return Boolean(input && input !== "N/A" && input !== "null");
}

export function isCanceled(row: WmsRow): boolean {
  return value(row, "canceled") === "Y" || hasDate(value(row, "cancel_date"));
}

export function sqlEscape(input: string): string {
  return String(input || "").replace(/'/g, "''");
}

export function processMessage(prefix: string, error: unknown): string {
  if (!(error instanceof Error) || !error.message) return prefix;
  const clean = error.message.replace(/\s+/g, " ").trim();
  return `${prefix} ${clean}`;
}

export function recalcQuantity(
  next: WmsRow,
  setForm: (updater: (current: WmsRow) => WmsRow) => void
): void {
  const primary = Number(next.qty_puom || 0);
  const lowest = Number(next.qty_luom || 0);
  const uppp = Number(next.uppp || 0);
  if (!Number.isFinite(primary) || !Number.isFinite(lowest)) return;
  const quantity =
    uppp > 0 ? Math.round(primary * uppp + lowest) : primary + lowest;
  setForm(() => ({ ...next, quantity }));
}

export function filterJobByTab(row: WmsRow, tab: string): boolean {
  const canceled = isCanceled(row);
  const confirmed =
    hasDate(value(row, "confirm_date")) ||
    hasDate(value(row, "confirmed_date"));
  if (tab === "cancel") return canceled || hasDate(value(row, "cancel_date"));
  if (tab === "confirmed") return confirmed && !canceled;
  return !confirmed && !canceled;
}

export function canCancelOutboundJob(row: WmsRow, activeTab: string): boolean {
  if (activeTab === "cancel") return false;
  if (activeTab === "confirmed") return true;
  return (
    Number(value(row, "oub_cnt_cancel") || 0) === 0 &&
    !hasDate(value(row, "confirm_date")) &&
    value(row, "canceled") !== "Y"
  );
}

export function tabRequiresSelection(tab: string): boolean {
  return ["picking_details", "cancel_picking", "job_confirmation"].includes(tab);
}

export function parseOutboundView(pathname: string): { jobNo: string; tab: string } {
  const parts = pathname.split("/").filter(Boolean);
  const viewIndex = parts.findIndex((part) => part.toLowerCase() === "view");
  return {
    jobNo: viewIndex >= 0 ? parts[viewIndex + 1] : "",
    tab: viewIndex >= 0 ? parts[viewIndex + 2] : "",
  };
}

export function outboundJobDetailPath(row: WmsRow): string {
  const jobNo = encodeURIComponent(value(row, "job_no"));
  const principalCode = encodeURIComponent(value(row, "prin_code"));
  return `${outboundJobsPath}/view/${jobNo}/order_entry${principalCode ? `?principal_code=${principalCode}` : ""}`;
}

export function outboundJobTabPath(
  jobNo: string,
  tab: string,
  job: WmsRow | null
): string {
  const encodedJobNo = encodeURIComponent(jobNo);
  const prin = value(job || {}, "prin_code");
  return `${outboundJobsPath}/view/${encodedJobNo}/${tab}${prin ? `?principal_code=${encodeURIComponent(prin)}` : ""}`;
}

export function makeEmptyJob(companyCode?: string): WmsRow {
  return {
    company_code: companyCode || "",
    job_type: "EXP",
    job_class: "N",
    transport_mode: "S",
    curr_code: "OMR",
    ex_rate: 1,
    schedule_date: new Date().toISOString().slice(0, 10),
  };
}

export function makeOutboundJobForm(row: WmsRow, companyCode?: string): WmsRow {
  const normalized = normalizeRow(row);
  return {
    ...makeEmptyJob(companyCode),
    ...normalized,
    company_code: value(normalized, "company_code") || companyCode || "",
    job_no: value(normalized, "job_no"),
    prin_code: value(normalized, "prin_code"),
    prin_name: value(normalized, "prin_name"),
    dept_code: value(normalized, "dept_code"),
    dept_name: value(normalized, "dept_name"),
    div_code: value(normalized, "div_code"),
    div_name: value(normalized, "div_name"),
    job_class: value(normalized, "job_class") || "N",
    job_type: value(normalized, "job_type") || "EXP",
    transport_mode: value(normalized, "transport_mode") || "S",
    schedule_date: toDateInputValue(
      value(normalized, "schedule_date") || value(normalized, "job_date")
    ),
    job_date: toDateInputValue(
      value(normalized, "job_date") || value(normalized, "schedule_date")
    ),
  };
}

export async function enrichOutboundJobFormNames(
  form: WmsRow,
  companyCode: string
): Promise<WmsRow> {
  const deptCode = value(form, "dept_code");
  const divCode = value(form, "div_code");
  if (
    (!deptCode && !divCode) ||
    (value(form, "dept_name") && value(form, "div_name"))
  )
    return form;

  const rows = await executeWmsInboundSql(`
    SELECT d.DEPT_NAME, v.DIV_NAME
    FROM MS_DEPARTMENT d
    LEFT JOIN MS_HR_DIVISION v
      ON v.COMPANY_CODE = d.COMPANY_CODE
     AND v.DIV_CODE = d.DIV_CODE
    WHERE d.COMPANY_CODE = '${sqlEscape(companyCode)}'
      ${deptCode ? `AND d.DEPT_CODE = '${sqlEscape(deptCode)}'` : ""}
      ${divCode ? `AND d.DIV_CODE = '${sqlEscape(divCode)}'` : ""}
    FETCH FIRST 1 ROWS ONLY
  `);
  const names = normalizeRow(rows[0] || {});
  return {
    ...form,
    dept_name: value(form, "dept_name") || value(names, "dept_name"),
    div_name: value(form, "div_name") || value(names, "div_name"),
  };
}

export function buildOutboundJobPayload(form: WmsRow, companyCode: string): WmsRow {
  const allowedFields = new Set([
    "company_code",
    "job_no",
    ...jobFields.map((field) => field.name),
  ]);
  const payload: WmsRow = {};

  allowedFields.forEach((field) => {
    if (field in form) payload[field] = form[field];
  });

  payload.company_code = form.company_code || companyCode;
  payload.job_type = "EXP";
  payload.job_class = payload.job_class || "N";
  payload.transport_mode = payload.transport_mode || "S";
  payload.schedule_date =
    payload.schedule_date || new Date().toISOString().slice(0, 10);
  payload.job_date =
    payload.job_date ||
    payload.schedule_date ||
    new Date().toISOString().slice(0, 10);
  payload.curr_code = payload.curr_code || "OMR";
  payload.ex_rate = payload.ex_rate || 1;

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
}

export async function validateDepartmentDivision(
  companyCode: string,
  deptCode: string,
  divCode: string
): Promise<boolean> {
  if (!deptCode || !divCode) return true;
  const rows = await executeWmsInboundSql(`
    SELECT DEPT_CODE
    FROM MS_DEPARTMENT
    WHERE COMPANY_CODE = '${sqlEscape(companyCode)}'
      AND DEPT_CODE = '${sqlEscape(deptCode)}'
      AND DIV_CODE = '${sqlEscape(divCode)}'
      FETCH FIRST 1 ROWS ONLY
  `);
  return rows.length > 0;
}

export function flagBadge(flag: string) {
  const yes = flag === "Y" || flag.toLowerCase() === "yes";
  return (
    <span className={yes ? "text-emerald-700" : "text-muted-foreground"}>
      {yes ? "Yes" : "No"}
    </span>
  )
}

export function transportModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    S: "Sea",
    A: "Air",
    R: "Road",
    C: "Courier",
  };
  return labels[mode] || mode || "Sea";
}