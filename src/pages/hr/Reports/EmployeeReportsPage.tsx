/**
 * HR Reports – complete single file
 * Pages: Joiner | Register | Leavers | Tenure | Attendance Register | Accrual Balance | Pay Unit List | Passport Expiry | Air Ticket Request | Employee Listing | Airfare
 * Endpoint: POST /api/hr/reports/:type/:report   (type = html | excel)
 * LOV: getDynamicLookup → /api/wms/common/proc_build_dynamic_sql_common
 * Company Code: from useAuth()
 * Layout: 4 columns per row
 */

import { useCallback, useState, useEffect, useMemo } from "react";
import { NewReportDialog, NewReportPage, ReportFieldConfig } from "../../../components/new_report_format";
import { api } from "../../../api/client";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";


/* ═══════════════════════════════════════════════════════════════════════════
   Shared types & helpers
   ═══════════════════════════════════════════════════════════════════════════ */

export type ReportKey =
  | "joiner"
  | "register"
  | "leavers"
  | "tenure"
  | "attendance"
  | "accrual"
  | "payunit"
  | "passport"
  | "airticket"
  | "listing"
  | "airfare";
export type FilterValues = Record<string, string | string[] | boolean>;

const ALL = "All";

/** Reports that show an employee LOV (and must reset it when Division/Department change) */
const EMP_LOV_REPORTS: ReportKey[] = [
  "register",
  "tenure",
  "attendance",
  "accrual",
  "payunit",
  "passport",
  "airticket",
  "listing",
  "airfare",
];

function toApiValue(v: string | string[] | boolean | undefined): string {
  if (v == null || v === false) return ALL;
  if (v === true) return "Y";
  if (Array.isArray(v)) {
    const cleaned = v.map(String).filter((x) => x && x !== ALL);
    return cleaned.length ? cleaned[0] : ALL;
  }
  const s = String(v).trim();
  return s || ALL;
}

/** Keys that hold dates: join_from/join_to, sep_from/sep_to, period_from/period_to, pp_expiry_from/pp_expiry_to, as_of_date */
const DATE_KEY = /(_from|_to|_date)$/;

/** Employee range keys look like *_from / *_to but are NOT dates */
const NON_DATE_KEYS = new Set(["emp_from", "emp_to"]);

/**
 * Normalise any date value to a 'YYYY-MM-DD' string, or "" when empty/invalid.
 * Pure string handling – no Date object, so no timezone shift.
 * Accepts 'YYYY-MM-DD[...]', 'DD/MM/YYYY', 'DD-MM-YYYY'.
 */
function toDateString(v: string | string[] | boolean | undefined): string {
  const raw = Array.isArray(v) ? String(v[0] ?? "") : v == null || typeof v === "boolean" ? "" : String(v);
  const s = raw.trim();
  if (!s) return "";

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  return "";
}

/** Today as 'YYYY-MM-DD' using local time */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildPayload(values: FilterValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (DATE_KEY.test(k) && !NON_DATE_KEYS.has(k)) {
      // dates are sent as 'YYYY-MM-DD' (or "" when not set) – never "All"
      out[k] = toDateString(v);
    } else if (typeof v === "boolean") {
      out[k] = v ? "Y" : "N";
    } else {
      out[k] = toApiValue(v);
    }
  }
  return out;
}

/* ───────────────────────── LOV helper using getDynamicLookup ───────────────────────── */

type LovOption = { value: string; label: string; code?: string };

interface DynamicQueryParams {
  parameter: string;
  loginid?: string;
  code1?: string;   // COMPANY_CODE
  code2?: string;   // DIV_CODE
  code3?: string;   // DEPT_CODE
  code4?: string;   // SECTION_CODE
  number1?: number;
  number2?: number;
  number3?: number;
  number4?: number;
  date1?: string;
  date2?: string;
  date3?: string;
  date4?: string;
}

async function fetchHrLov(
  parameter: string,
  companyCode: string,
  filters: { div_code?: string; dept_code?: string; section_code?: string } = {}
): Promise<LovOption[]> {
  if (!companyCode) return [];

  try {
    const params: DynamicQueryParams = {
      parameter,
      code1: companyCode,                       // P_COMPANY_CODE / P_CODE1
      code2: filters.div_code || undefined,     // P_DIV_CODE / P_CODE2
      code3: filters.dept_code || undefined,    // P_DEPT_CODE / P_CODE3
      code4: filters.section_code || undefined, // P_SECTION_CODE / P_CODE4
    };

    const rows = await getDynamicLookup(params);

    return (rows || []).map((r: any) => ({
      value: String(
        r.VALUE ?? r.value ?? r.CODE ?? r.code ??
        r.DIV_CODE ?? r.DEPT_CODE ?? r.SECTION_CODE ??
        r.EMPLOYEE_ID ?? r.GRADE_CODE ?? r.DESG_CODE ?? ""
      ),
      label: String(
        r.LABEL ?? r.label ?? r.NAME ?? r.name ??
        r.DIV_NAME ?? r.DEPT_NAME ?? r.SECTION_NAME ??
        r.RPT_NAME ?? r.GRADE_NAME ?? r.DESG_NAME ?? r.VALUE ?? ""
      ),
      code: r.CODE ?? r.code,
    }));
  } catch (err) {
    console.error(`LOV error [${parameter}]:`, err);
    return [];
  }
}

/** Prepend a single "All" option and remove any existing "All" from the backend response */
function withAllOption(items: LovOption[]): LovOption[] {
  const filtered = (items || []).filter(
    (o) =>
      String(o.value).toLowerCase() !== "all" &&
      String(o.label).toLowerCase() !== "all"
  );
  return [{ value: ALL, label: "All" }, ...filtered];
}

/* ───────────────────────── Shared hook ───────────────────────── */

function useHrReport(
  reportKey: ReportKey,
  title: string,
  fields: ReportFieldConfig[],
  initialExtra?: FilterValues
) {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";

  const [values, setValues] = useState<FilterValues>(() => {
    const init: FilterValues = { ...(initialExtra || {}) };
    fields.forEach((f) => {
      if (init[f.key] !== undefined) return;
      if (f.type === "multiselect") init[f.key] = [ALL];
      else if (f.type === "daterange" && f.toKey) {
        init[f.key] = "";
        init[f.toKey!] = "";
      } else if (f.type === "select") init[f.key] = f.options?.[0]?.value ?? ALL;
      else init[f.key] = "";
    });
    return init;
  });

  const [fieldOptions, setFieldOptions] = useState<Record<string, LovOption[]>>({});
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  // ── Base LOVs (Division, Grade, Designation, Category) ──
  useEffect(() => {
    if (!companyCode) return;
    let cancelled = false;

    (async () => {
      setOptionsLoading(true);
      try {
        const [divs, grades, desgs, cats] = await Promise.all([
          fetchHrLov("HR_REPORT_DIVISION", companyCode),
          fetchHrLov("HR_REPORT_GRADE", companyCode),
          fetchHrLov("HR_REPORT_DESIGNATION", companyCode),
          // fetchHrLov swallows errors → stays empty if this LOV is not defined yet
          fetchHrLov("HR_REPORT_CATEGORY", companyCode),
        ]);
        if (cancelled) return;
        setFieldOptions((prev) => ({
          ...prev,
          div_code: withAllOption(divs),
          grade_code: withAllOption(grades),
          desg_code: withAllOption(desgs),
          labour_desg_code: withAllOption(desgs),
          category_code: withAllOption(cats),
        }));
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyCode]);

  // ── Cascading: Department depends on Division ──
  useEffect(() => {
    if (!companyCode) return;
    const div = toApiValue(values.div_code);
    let cancelled = false;

    (async () => {
      const depts = await fetchHrLov("HR_REPORT_DEPARTMENT", companyCode, {
        div_code: div === ALL ? undefined : div,
      });
      if (cancelled) return;
      setFieldOptions((prev) => ({
        ...prev,
        dept_code: withAllOption(depts),
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [values.div_code, companyCode]);

  // ── Cascading: Section depends on Division + Department ──
  useEffect(() => {
    if (!companyCode) return;
    const div = toApiValue(values.div_code);
    const dept = toApiValue(values.dept_code);
    let cancelled = false;

    (async () => {
      const secs = await fetchHrLov("HR_REPORT_SECTION", companyCode, {
        div_code: div === ALL ? undefined : div,
        dept_code: dept === ALL ? undefined : dept,
      });
      if (cancelled) return;
      setFieldOptions((prev) => ({
        ...prev,
        section_code: withAllOption(secs),
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [values.div_code, values.dept_code, companyCode]);

  // ── Employee LOV (Register, Tenure, Attendance, Accrual, Pay Unit, Passport, Air Ticket, Listing, Airfare) ──
  useEffect(() => {
    if (!companyCode) return;
    if (!EMP_LOV_REPORTS.includes(reportKey)) return;

    const div = toApiValue(values.div_code);
    const dept = toApiValue(values.dept_code);
    const sect = toApiValue(values.section_code);
    let cancelled = false;

    (async () => {
      const emps = await fetchHrLov("HR_REPORT_EMPLOYEE", companyCode, {
        div_code: div === ALL ? undefined : div,
        dept_code: dept === ALL ? undefined : dept,
        section_code: sect === ALL ? undefined : sect,
      });
      if (cancelled) return;
      const withAll = withAllOption(emps);
      setFieldOptions((prev) => ({
        ...prev,
        employee_code: withAll,
        employee_id: withAll,
        emp_from: withAll,
        emp_to: withAll,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [values.div_code, values.dept_code, values.section_code, companyCode, reportKey]);

  // Merge dynamic options into fields
  const fieldsWithOptions = useMemo(() => {
    return fields.map((f) => {
      if (f.type === "multiselect" && fieldOptions[f.key]) {
        return { ...f, options: fieldOptions[f.key], loading: optionsLoading };
      }
      return f;
    });
  }, [fields, fieldOptions, optionsLoading]);

  const onChange = useCallback(
    (key: string, value: any) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        const hasEmp = EMP_LOV_REPORTS.includes(reportKey);
        const resetEmp = () => {
          next.employee_code = [ALL];
          next.employee_id = [ALL];
          next.emp_from = [ALL];
          next.emp_to = [ALL];
        };
        // Reset children when parent changes
        if (key === "div_code") {
          next.dept_code = [ALL];
          next.section_code = [ALL];
          if (hasEmp) resetEmp();
        }
        if (key === "dept_code") {
          next.section_code = [ALL];
          if (hasEmp) resetEmp();
        }
        return next;
      });
      setError(null);
    },
    [reportKey]
  );

  const onClearAll = useCallback(() => {
    const init: FilterValues = { ...(initialExtra || {}) };
    fields.forEach((f) => {
      if (f.type === "multiselect") init[f.key] = [ALL];
      else if (f.type === "daterange" && f.toKey) {
        init[f.key] = "";
        init[f.toKey!] = "";
      } else if (f.type === "select") init[f.key] = f.options?.[0]?.value ?? ALL;
      else init[f.key] = "";
    });
    setValues(init);
    setError(null);
  }, [fields, initialExtra]);

  const onGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHtmlContent(null);
    try {
      const payload = buildPayload(values);
      const res = await api.post(`/api/hr/reports/html/${reportKey}`, payload, {
        responseType: "text",
        headers: { Accept: "text/html" },
        transformResponse: [(d) => d],
      });
      const data = res.data;
      if (typeof data === "string" && data.trim().startsWith("{")) {
        const json = JSON.parse(data);
        if (json?.success === false) throw new Error(json.message || "No data found");
      }
      setHtmlContent(typeof data === "string" ? data : String(data));
      setDialogOpen(true);
    } catch (e: any) {
      let msg = e?.message || "Unable to generate report";
      try {
        const d = e?.response?.data;
        if (typeof d === "string") {
          try {
            msg = JSON.parse(d)?.message || d;
          } catch {
            msg = d;
          }
        } else if (d?.message) msg = d.message;
      } catch {
        /* ignore */
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [values, reportKey]);

  const onExportExcel = useCallback(async () => {
    setExportingExcel(true);
    try {
      const payload = buildPayload(values);
      const res = await api.post(`/api/hr/reports/excel/${reportKey}`, payload, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HR_${reportKey}_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Excel export failed");
    } finally {
      setExportingExcel(false);
    }
  }, [values, reportKey]);

  const onOpenInNewWindow = useCallback(() => {
    if (!htmlContent) return;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(htmlContent);
      w.document.close();
    }
  }, [htmlContent]);

  return {
    title,
    fields: fieldsWithOptions,
    values,
    onChange,
    onClearAll,
    onGenerate,
    loading,
    optionsLoading,
    error,
    setError,
    dialogOpen,
    setDialogOpen,
    htmlContent,
    onExportExcel,
    exportingExcel,
    onOpenInNewWindow,
  };
}

/* Shared shell – 4 columns per row */
function HrReportShell({ r }: { r: ReturnType<typeof useHrReport> }) {
  return (
    <>
      <NewReportPage
        title={r.title}
        fields={r.fields}
        values={r.values}
        onChange={r.onChange}
        onClearAll={r.onClearAll}
        onGenerate={r.onGenerate}
        loading={r.loading}
        optionsLoading={r.optionsLoading}
        error={r.error}
        onClearError={() => r.setError(null)}
        fieldsPerRow={4}
      />
      <NewReportDialog
        open={r.dialogOpen}
        onClose={() => r.setDialogOpen(false)}
        title={r.title}
        htmlContent={r.htmlContent}
        loading={r.loading}
        error={r.error}
        onExportExcel={r.onExportExcel}
        exportingExcel={r.exportingExcel}
        onOpenInNewWindow={r.onOpenInNewWindow}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. Employee Joiner List
   ═══════════════════════════════════════════════════════════════════════════ */

const JOINER_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 3 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 3 },
  { key: "labour_desg_code", label: "Formal Designation", type: "multiselect", colSpan: 3 },
  {
    key: "join_from",
    label: "Join Date Range",
    type: "daterange",
    toKey: "join_to",
    colSpan: 6,
  },
  {
    key: "emp_status",
    label: "Employee Status",
    type: "select",
    colSpan: 3,
    options: [
      { value: "A", label: "Active Employees" },
      { value: "All", label: "All Employees" },
    ],
  },
  {
    key: "group_by",
    label: "Group Criteria",
    type: "select",
    colSpan: 3,
    options: [
      { value: "DIV", label: "Division" },
      { value: "DEPT", label: "Department" },
      { value: "SECT", label: "Section" },
      { value: "DESG", label: "Designation" },
      { value: "LABOUR_DESG", label: "Formal Designation" },
    ],
  },
];

export function EmployeeJoinerReportPage() {
  const r = useHrReport("joiner", "Employee Joiner List", JOINER_FIELDS, {
    emp_status: "A",
    group_by: "DIV",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Employee Register
   ═══════════════════════════════════════════════════════════════════════════ */

const REGISTER_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 3 },
  {
    key: "join_from",
    label: "Join Date Range",
    type: "daterange",
    toKey: "join_to",
    colSpan: 6,
  },
  {
    key: "emp_status",
    label: "Employee Status",
    type: "select",
    colSpan: 3,
    options: [
      { value: "A", label: "Active Employees" },
      { value: "All", label: "All Employees" },
    ],
  },
  {
    key: "blank_form",
    label: "Blank Form",
    type: "select",
    colSpan: 3,
    options: [
      { value: "N", label: "No" },
      { value: "Y", label: "Yes" },
    ],
  },
  {
    key: "medical_eligibility",
    label: "Medical Eligibility",
    type: "select",
    colSpan: 3,
    options: [
      { value: "N", label: "No" },
      { value: "Y", label: "Yes" },
    ],
  },
];

export function EmployeeRegisterReportPage() {
  const r = useHrReport("register", "Employee Register", REGISTER_FIELDS, {
    emp_status: "A",
    blank_form: "N",
    medical_eligibility: "N",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Employee Leavers
   ═══════════════════════════════════════════════════════════════════════════ */

const LEAVERS_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 3 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 3 },
  { key: "labour_desg_code", label: "Formal Designation", type: "multiselect", colSpan: 3 },
  {
    key: "sep_from",
    label: "Separation Date Range",
    type: "daterange",
    toKey: "sep_to",
    colSpan: 6,
  },
  {
    key: "reason_category",
    label: "Reason Category",
    type: "select",
    colSpan: 3,
    options: [{ value: "All", label: "All" }],
  },
  {
    key: "group_by",
    label: "Group Criteria",
    type: "select",
    colSpan: 3,
    options: [
      { value: "DIV", label: "Division" },
      { value: "DEPT", label: "Department" },
      { value: "SECT", label: "Section" },
      { value: "DESG", label: "Designation" },
      { value: "LABOUR_DESG", label: "Formal Designation" },
      { value: "SEP_REASON", label: "Separation Reason" },
      { value: "REASON_SUB", label: "Reasons SubCategory" },
    ],
  },
];

export function EmployeeLeaversReportPage() {
  const r = useHrReport("leavers", "Employee Leavers Listing", LEAVERS_FIELDS, {
    group_by: "DIV",
    reason_category: "All",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Employee Tenure
   ═══════════════════════════════════════════════════════════════════════════ */

const TENURE_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 3 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 3 },
  { key: "employee_id", label: "Employee Code", type: "multiselect", colSpan: 3 },
  { key: "as_of_date", label: "To Date", type: "date", colSpan: 3 },
  {
    key: "show_age",
    label: "Show Age",
    type: "select",
    colSpan: 3,
    options: [
      { value: "N", label: "No" },
      { value: "Y", label: "Yes" },
    ],
  },
];

export function EmployeeTenureReportPage() {
  const r = useHrReport("tenure", "Employee Tenure Report", TENURE_FIELDS, {
    show_age: "N",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Attendance Register
   ═══════════════════════════════════════════════════════════════════════════ */

const ATTENDANCE_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "emp_from", label: "Employee From", type: "multiselect", colSpan: 3 },
  { key: "emp_to", label: "Employee To", type: "multiselect", colSpan: 3 },
  {
    key: "period_from",
    label: "Date Range",
    type: "daterange",
    toKey: "period_to",
    colSpan: 6,
  },
  {
    key: "history",
    label: "History Report",
    type: "select",
    colSpan: 3,
    options: [
      { value: "N", label: "No" },
      { value: "Y", label: "Yes" },
    ],
  },
];

export function AttendanceRegisterReportPage() {
  const r = useHrReport("attendance", "Attendance Register", ATTENDANCE_FIELDS, {
    history: "N",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Employee Accrual Balance (Leave Accruals)
   ═══════════════════════════════════════════════════════════════════════════ */

const ACCRUAL_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 3 },
  { key: "as_of_date", label: "Date To", type: "date", colSpan: 3 },
];

export function EmployeeAccrualBalanceReportPage() {
  const r = useHrReport("accrual", "Employee Accrual Balance", ACCRUAL_FIELDS, {
    as_of_date: todayIso(),
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. Employee Pay Unit List
   ═══════════════════════════════════════════════════════════════════════════ */

const PAYUNIT_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 3 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 3 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 3 },
  {
    key: "join_from",
    label: "Join Date Range",
    type: "daterange",
    toKey: "join_to",
    colSpan: 6,
  },
  {
    key: "emp_status",
    label: "Employee Status",
    type: "select",
    colSpan: 3,
    options: [
      { value: "A", label: "Active Employees" },
      { value: "All", label: "All Employees" },
    ],
  },
  {
    key: "group_by",
    label: "Group Criteria",
    type: "select",
    colSpan: 3,
    options: [
      { value: "DESG", label: "Designation" },
      { value: "GRADE_DESG", label: "Grade + Designation" },
      { value: "DIV", label: "Division" },
      { value: "DEPT", label: "Department" },
      { value: "EMP", label: "Employee" },
      { value: "SECT", label: "Section" },
    ],
  },
];

export function EmployeePayUnitReportPage() {
  const r = useHrReport("payunit", "Employee Pay Units List", PAYUNIT_FIELDS, {
    emp_status: "A",
    group_by: "DESG",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. Passport Expiry Listing
   ═══════════════════════════════════════════════════════════════════════════ */

const PASSPORT_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 3 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 3 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 3 },
  {
    key: "pp_expiry_from",
    label: "Passport Expiry",
    type: "daterange",
    toKey: "pp_expiry_to",
    colSpan: 3,
  },
  {
    key: "emp_status",
    label: "Employee Status",
    type: "select",
    colSpan: 3,
    options: [
      { value: "A", label: "Active Employees" },
      { value: "All", label: "All Employees" },
    ],
  },
];

export function PassportExpiryReportPage() {
  const r = useHrReport("passport", "Passport Expiry Listing", PASSPORT_FIELDS, {
    emp_status: "A",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Air Ticket Request Listing  (Status wise / Agent wise)
   ═══════════════════════════════════════════════════════════════════════════ */

const AIRTICKET_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 3 },
  {
    key: "req_from",
    label: "Ticket Request",
    type: "daterange",
    toKey: "req_to",
    colSpan: 3,
  },
  {
    key: "group_by",
    label: "Listing Type",
    type: "select",
    colSpan: 3,
    options: [
      { value: "STATUS", label: "Status wise Listing" },
      { value: "AGENT", label: "Agent wise Listing" },
    ],
  },
];

export function AirTicketRequestReportPage() {
  const r = useHrReport("airticket", "Air Ticket Request List", AIRTICKET_FIELDS, {
    group_by: "STATUS",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. Employee Listing  (grouped by Designation / Grade / Division / …)
   ═══════════════════════════════════════════════════════════════════════════ */

const LISTING_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 3 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 3 },
  { key: "labour_desg_code", label: "Formal Designation", type: "multiselect", colSpan: 3 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 3 },
  { key: "category_code", label: "Category", type: "multiselect", colSpan: 3 },
  {
    key: "join_from",
    label: "Join Date Range",
    type: "daterange",
    toKey: "join_to",
    colSpan: 6,
  },
  {
    key: "emp_status",
    label: "Employee Status",
    type: "select",
    colSpan: 3,
    options: [
      { value: "A", label: "Active Employees" },
      { value: "All", label: "All Employees" },
    ],
  },
  {
    key: "group_by",
    label: "Group Criteria",
    type: "select",
    colSpan: 3,
    options: [
      { value: "DESG", label: "Designation" },
      { value: "GRADE", label: "Grade" },
      { value: "GRADE_DESG", label: "Grade + Designation" },
      { value: "DIV", label: "Division" },
      { value: "DEPT", label: "Department" },
      { value: "SECT", label: "Section" },
      { value: "LABOUR_DESG", label: "Formal Designation" },
      { value: "CATEGORY", label: "Category" },
    ],
  },
];

export function EmployeeListingReportPage() {
  const r = useHrReport("listing", "Employee Listing", LISTING_FIELDS, {
    emp_status: "A",
    group_by: "DESG",
  });
  return <HrReportShell r={r} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. Employee Airfare Report  (Payroll → Exception Reports → Employee Airfare)
   Filters: Division | Department | Section | Employee Code | Pay Month | Pay Year | History
   ═══════════════════════════════════════════════════════════════════════════ */

const AIRFARE_FIELDS: ReportFieldConfig[] = [
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 3 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 3 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 3 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 3 },
  {
    key: "pay_month",
    label: "Pay Month",
    type: "select",
    colSpan: 3,
    options: [
      { value: "All", label: "All" },
      { value: "1", label: "January" },
      { value: "2", label: "February" },
      { value: "3", label: "March" },
      { value: "4", label: "April" },
      { value: "5", label: "May" },
      { value: "6", label: "June" },
      { value: "7", label: "July" },
      { value: "8", label: "August" },
      { value: "9", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" },
    ],
  },
  { key: "pay_year", label: "Pay Year", type: "text", colSpan: 3 },
  {
    key: "history",
    label: "History Report",
    type: "select",
    colSpan: 3,
    options: [
      { value: "N", label: "No" },
      { value: "Y", label: "Yes" },
    ],
  },
];

export function EmployeeAirfareReportPage() {
  const r = useHrReport("airfare", "Employee Airfare Report", AIRFARE_FIELDS, {
    pay_month: "All",
    history: "N",
  });
  return <HrReportShell r={r} />;
}

/* Default export */
export default {
  EmployeeJoinerReportPage,
  EmployeeRegisterReportPage,
  EmployeeLeaversReportPage,
  EmployeeTenureReportPage,
  AttendanceRegisterReportPage,
  EmployeeAccrualBalanceReportPage,
  EmployeePayUnitReportPage,
  PassportExpiryReportPage,
  AirTicketRequestReportPage,
  EmployeeListingReportPage,
  EmployeeAirfareReportPage,
};