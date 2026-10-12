/**
 * HR Reports – complete single file
 * Pages: Joiner | Register | Leavers | Tenure
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

export type ReportKey = "joiner" | "register" | "leavers" | "tenure";
export type FilterValues = Record<string, string | string[] | boolean>;

const ALL = "All";

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

/** Keys that hold dates: join_from/join_to, sep_from/sep_to, as_of_date */
const DATE_KEY = /(_from|_to|_date)$/;

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

function buildPayload(values: FilterValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (DATE_KEY.test(k)) {
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

  // ── Base LOVs (Division, Grade, Designation) ──
  useEffect(() => {
    if (!companyCode) return;
    let cancelled = false;

    (async () => {
      setOptionsLoading(true);
      try {
        const [divs, grades, desgs] = await Promise.all([
          fetchHrLov("HR_REPORT_DIVISION", companyCode),
          fetchHrLov("HR_REPORT_GRADE", companyCode),
          fetchHrLov("HR_REPORT_DESIGNATION", companyCode),
        ]);
        if (cancelled) return;
        setFieldOptions((prev) => ({
          ...prev,
          div_code: [{ value: ALL, label: "All" }, ...divs],
          grade_code: [{ value: ALL, label: "All" }, ...grades],
          desg_code: [{ value: ALL, label: "All" }, ...desgs],
          labour_desg_code: [{ value: ALL, label: "All" }, ...desgs],
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
        dept_code: [{ value: ALL, label: "All" }, ...depts],
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
        section_code: [{ value: ALL, label: "All" }, ...secs],
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [values.div_code, values.dept_code, companyCode]);

  // ── Employee LOV (only for Register & Tenure) ──
  useEffect(() => {
    if (!companyCode) return;
    if (reportKey !== "register" && reportKey !== "tenure") return;

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
      setFieldOptions((prev) => ({
        ...prev,
        employee_code: [{ value: ALL, label: "All" }, ...emps],
        employee_id: [{ value: ALL, label: "All" }, ...emps],
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
        // Reset children when parent changes
        if (key === "div_code") {
          next.dept_code = [ALL];
          next.section_code = [ALL];
          if (reportKey === "register" || reportKey === "tenure") {
            next.employee_code = [ALL];
            next.employee_id = [ALL];
          }
        }
        if (key === "dept_code") {
          next.section_code = [ALL];
          if (reportKey === "register" || reportKey === "tenure") {
            next.employee_code = [ALL];
            next.employee_id = [ALL];
          }
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

/* Default export */
export default {
  EmployeeJoinerReportPage,
  EmployeeRegisterReportPage,
  EmployeeLeaversReportPage,
  EmployeeTenureReportPage,
};