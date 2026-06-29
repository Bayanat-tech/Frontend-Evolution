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
  hdr_lve_slno?: string | number | null;
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
  cancel_date?: string;
  cancel_remarks?: string;
  resume_date?: string;
  actual_resume_date?: string;
  resume_work?: string;
  resume_approved?: string;
  lve_adjustment_reason?: string;
  leave_certificate_required?: string;
  // Audit columns — populated from the logged-in user at save time, not
  // edited directly in the form.
  user_id?: string;
  user_dt?: string;
  approved_by?: string;
  approved_on?: string;
  verified_by?: string;
  verified_on?: string;
  cancelld_by?: string;
  resume_approved_by?: string;
  leave_start_date?: string;
  leave_end_date?: string;
  approval_remarks?: string;
  resume_remarks?: string;
  resume_approved_on?: string;
  // Same null-vs-absent distinction as hdr_lve_slno above.
  lve_doc_no?: string | null;
  leave_request_date?: string;
  vac_adv_paid?: string;
  duty_resume_date?: string;
  verified_remarks?: string;
  verified_status?: string;
  doc_type?: string;
  include_consolidate?: string;
  lve_approved?: string;
  ref_hdr_lve_slno?: string | number;
  ref_lve_doc_no?: string;
  lve_continuity?: string;
  sys_generated?: string;
  pasi_months_deduct?: number | string;
  pasi_amt?: number | string;
  leave_created?: string;
  amt_avail_ncash?: number | string;
  cause_type?: string;
  extra_remarks?: string;
  pay_month?: number | string;
  pay_year?: number | string;
};

// Display values shown in the Status dropdown (Add Line dialog + grid).
// The API only ever receives the single-letter STATUS_CODE below — the
// proc's STATUS column on HR_EMP_LEAVE_DET is a code column, not free text.
export const STATUS_DISPLAY = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
} as const;

export type LeaveStatusDisplay = (typeof STATUS_DISPLAY)[keyof typeof STATUS_DISPLAY];

export const STATUS_OPTIONS: LeaveStatusDisplay[] = [STATUS_DISPLAY.ACTIVE, STATUS_DISPLAY.INACTIVE];

// Display -> single-letter code sent to the API (Active -> "A", Inactive -> "I").
const STATUS_DISPLAY_TO_CODE: Record<string, string> = {
  [STATUS_DISPLAY.ACTIVE]: "A",
  [STATUS_DISPLAY.INACTIVE]: "I",
};

// Reverse lookup, used when loading an existing document whose STATUS came
// back from the database as "A" / "I" and needs to render as a friendly
// label in the dropdown/grid.
const STATUS_CODE_TO_DISPLAY: Record<string, LeaveStatusDisplay> = {
  A: STATUS_DISPLAY.ACTIVE,
  I: STATUS_DISPLAY.INACTIVE,
};

/** Convert a status value (code "A"/"I" or display "Active"/"Inactive") to the display label. */
export const toStatusDisplay = (value: string | undefined): LeaveStatusDisplay => {
  if (!value) return STATUS_DISPLAY.ACTIVE;
  return STATUS_CODE_TO_DISPLAY[value.toUpperCase()] ?? (value as LeaveStatusDisplay);
};

/** Convert a status display label ("Active"/"Inactive") to the API code ("A"/"I"). */
export const toStatusCode = (value: string | undefined): string => {
  if (!value) return STATUS_DISPLAY_TO_CODE[STATUS_DISPLAY.ACTIVE];
  return STATUS_DISPLAY_TO_CODE[value] ?? value;
};

// Display values for the Half Day toggle (Add Line dialog + grid).
// The API only accepts a single-letter code on HR_EMP_LEAVE_DET.HALF_DAY,
// so "Yes"/"No" are converted to "Y"/"N" right before the payload leaves
// the app — same pattern as STATUS above.
export const HALF_DAY_DISPLAY = {
  YES: "Yes",
  NO: "No",
} as const;

export type HalfDayDisplay = (typeof HALF_DAY_DISPLAY)[keyof typeof HALF_DAY_DISPLAY];

export const HALF_DAY_OPTIONS: HalfDayDisplay[] = [HALF_DAY_DISPLAY.NO, HALF_DAY_DISPLAY.YES];

const HALF_DAY_DISPLAY_TO_CODE: Record<string, string> = {
  [HALF_DAY_DISPLAY.YES]: "Y",
  [HALF_DAY_DISPLAY.NO]: "N",
};

const HALF_DAY_CODE_TO_DISPLAY: Record<string, HalfDayDisplay> = {
  Y: HALF_DAY_DISPLAY.YES,
  N: HALF_DAY_DISPLAY.NO,
};

/** Convert a half-day value (code "Y"/"N" or display "Yes"/"No") to the display label. */
export const toHalfDayDisplay = (value: string | undefined): HalfDayDisplay => {
  if (!value) return HALF_DAY_DISPLAY.NO;
  return HALF_DAY_CODE_TO_DISPLAY[value.toUpperCase()] ?? (value as HalfDayDisplay);
};

/** Convert a half-day display label to the single-char API code ("Yes" -> "Y", "No" -> "N"). */
export const toHalfDayCode = (value: string | undefined): string => {
  if (!value) return HALF_DAY_DISPLAY_TO_CODE[HALF_DAY_DISPLAY.NO];
  return HALF_DAY_DISPLAY_TO_CODE[value] ?? value.charAt(0).toUpperCase();
};

// Display values for the Reason field. The API only accepts a single-
// letter code on HR_EMP_LEAVE_DET.LEAVE_REASON ("Encash" -> "E").
const LEAVE_REASON_DISPLAY_TO_CODE: Record<string, string> = {
  Encash: "E",
};

const LEAVE_REASON_CODE_TO_DISPLAY: Record<string, string> = {
  E: "Encash",
};

/** Convert a leave-reason value (code or display) to a friendly label for the form/grid. */
export const toLeaveReasonDisplay = (value: string | undefined): string => {
  if (!value) return "Encash";
  return LEAVE_REASON_CODE_TO_DISPLAY[value.toUpperCase()] ?? value;
};

/** Convert a leave-reason display value to the single-char API code. Unmapped
 *  values fall back to their first letter so a length error can't recur. */
export const toLeaveReasonCode = (value: string | undefined): string => {
  if (!value) return LEAVE_REASON_DISPLAY_TO_CODE.Encash;
  return LEAVE_REASON_DISPLAY_TO_CODE[value] ?? value.charAt(0).toUpperCase();
};

export type LeaveDetailRow = {
  id?: string | number;
  hdr_lve_slno?: string | number | null;
  leave_type?: string;
  leave_start_date?: string;
  leave_end_date?: string;
  leave_days?: number | string;
  leave_reason?: string;
  days_adjusted?: number | string;
  half_day?: string;
  adj_remarks?: string;
  // Holds the display label ("Active" / "Inactive") while in the form/grid;
  // converted to the "A"/"I" code only when buildLeaveEncashmentPayload runs.
  status?: string;
  user_id?: string;
  user_dt?: string;
  remarks?: string;
  company_code?: string;
  employee_id?: string;
  req_from?: string;
  req_to?: string;
  doc_type?: string;
  lve_doc_no?: string | null;
  unauth?: string;
  fy_leave_days?: number | string;
  fy_anny_date?: string;
  lve_wrk_days?: number | string;
  lve_days_period?: number | string;
};

export type LeaveEncashmentPayload = {
  header: LeaveHeader;
  details: LeaveDetailRow[];
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
  adj_remarks: "",
  status: STATUS_DISPLAY.ACTIVE,
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

const blankToNull = <T extends string | number | null | undefined>(
  value: T,
): Exclude<T, "" | undefined> | null =>
  (value === "" || value === undefined ? null : value) as Exclude<T, "" | undefined> | null;

export const buildLeaveEncashmentPayload = (
  header: LeaveHeader,
  details: LeaveDetailRow[],
  loginid: string,
): LeaveEncashmentPayload => {
  const nowIso = new Date().toISOString();
  const hdrLveSlno = blankToNull(header.hdr_lve_slno);
  const lveDocNo = blankToNull(header.lve_doc_no);

  return {
    header: {
      ...header,
      hdr_lve_slno: hdrLveSlno,
      lve_doc_no: lveDocNo,
      // The proc persists APPROVAL_STATUS as-is (it's in both the INSERT
      // and UPDATE column lists), and the API expects the single-letter
      // code rather than the "New" label shown on screen.
      approval_status: "A",
      doc_type: DOC_TYPE_LEAVE_ENCASHMENT,
      user_id: loginid,
      user_dt: nowIso,
    },
    details: details.map(({ id, ...row }) => ({
      ...row,
      // "Active"/"Inactive" -> "A"/"I", "Yes"/"No" -> "Y"/"N",
      // "Encash" -> "E" — right before this leaves the app, so the
      // HR_EMP_LEAVE_DET single-char columns never overflow.
      status: toStatusCode(row.status),
      half_day: toHalfDayCode(row.half_day),
      leave_reason: toLeaveReasonCode(row.leave_reason),
      doc_type: DOC_TYPE_LEAVE_ENCASHMENT,
      hdr_lve_slno: hdrLveSlno,
      lve_doc_no: lveDocNo,
      user_id: loginid,
      user_dt: nowIso,
    })),
  };
};

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