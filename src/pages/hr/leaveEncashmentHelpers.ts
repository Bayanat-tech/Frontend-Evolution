// ─────────────────────────────────────────────────────────────────────────────
// leaveEncashmentHelpers.ts
// Pure helpers for the Leave Encashment page: row shaping, validation,
// and payload building for the dynamic procedure calls.
// Mirrors the pattern used in progressCalculations.ts (ApplicationProgressPage).
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_TYPE_LEAVE_ENCASHMENT = "LEAVE";

export type LeaveBalanceRow = {
  company_code?: string;
  employee_id?: string;
  leave_type?: string;
  leave_type_desc?: string;
  max_no_of_leaves?: number | string;
  no_of_leaves_taken?: number | string;
  leaves_requested?: number | string;
  leaves_approved?: number | string;
  leave_balance?: number | string;
  no_of_leaves_lapsed?: number | string;
  no_of_leaves_accrued?: number | string;
  no_of_leaves_available?: number | string;
  sort_order?: number | string;
};

export type LeaveHeader = {
  company_code?: string;
  employee_id?: string;
  hdr_lve_slno?: string | number;
  destination?: string;
  planned_leave?: string;
  advance_payment?: string;
  approval_status?: string;
  long_short?: string;
  leave_remarks?: string;
  leave_allowance?: string;
  payment_mode?: string;
  no_ticket_adult?: number | string;
  no_ticket_child?: number | string;
  no_ticket_infant?: number | string;
  leave_start_date?: string;
  leave_end_date?: string;
  lve_doc_no?: string;
  leave_request_date?: string;
  verified_status?: string;
  doc_type?: string;
};

export type LeaveDetailRow = {
  id?: string | number;
  hdr_lve_slno?: string | number;
  leave_type?: string;
  leave_start_date?: string;
  leave_end_date?: string;
  leave_days?: number | string;
  leave_reason?: string;
  days_adjusted?: number | string;
  half_day?: string;
  adjustment_remarks?: string;
  status?: string;
  remarks?: string;
  company_code?: string;
  employee_id?: string;
  doc_type?: string;
  lve_doc_no?: string;
};

export const emptyHeader = (companyCode: string, employeeId: string): LeaveHeader => ({
  company_code: companyCode,
  employee_id: employeeId,
  hdr_lve_slno: "",
  destination: "",
  planned_leave: "N",
  advance_payment: "N",
  approval_status: "New",
  long_short: "Encash",
  leave_remarks: "Leave Encashment",
  leave_allowance: "",
  payment_mode: "",
  leave_start_date: "",
  leave_end_date: "",
  lve_doc_no: "",
  leave_request_date: new Date().toISOString().slice(0, 10),
  verified_status: "New",
  doc_type: DOC_TYPE_LEAVE_ENCASHMENT,
});

export const emptyDetailRow = (
  companyCode: string,
  employeeId: string,
  hdrLveSlno: string | number,
): LeaveDetailRow => ({
  hdr_lve_slno: hdrLveSlno,
  leave_type: "",
  leave_start_date: "",
  leave_end_date: "",
  leave_days: 0,
  leave_reason: "Encash",
  days_adjusted: 0,
  half_day: "No",
  adjustment_remarks: "",
  status: "Active",
  remarks: "Leave Encashment",
  company_code: companyCode,
  employee_id: employeeId,
  doc_type: DOC_TYPE_LEAVE_ENCASHMENT,
});

/** Resolve the leave balance row for a given leave type from the balance grid. */
export const findBalanceForType = (
  balances: LeaveBalanceRow[],
  leaveType: string,
): LeaveBalanceRow | undefined => balances.find((row) => row.leave_type === leaveType);

/** Validate a detail (encashment line) row against the loaded leave balance. */
export const validateDetailRow = (
  row: LeaveDetailRow,
  balances: LeaveBalanceRow[],
): string | null => {
  if (!row.leave_type) return "Leave type is required";
  const days = Number(row.leave_days || 0);
  if (!days || days <= 0) return "Days must be greater than zero";

  const balance = findBalanceForType(balances, row.leave_type);
  const available = Number(balance?.leave_balance ?? balance?.no_of_leaves_available ?? 0);
  if (balance && days > available) {
    return `Only ${available} day(s) available for ${row.leave_type}`;
  }
  return null;
};

/** Build the payload sent to the save procedure for header + detail rows together. */
export const buildLeaveEncashmentPayload = (header: LeaveHeader, details: LeaveDetailRow[]) => ({
  header,
  details: details.map((row) => ({ ...row, doc_type: DOC_TYPE_LEAVE_ENCASHMENT })),
});

export const toDateInputValue = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};