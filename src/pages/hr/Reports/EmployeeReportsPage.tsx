/**
 * HR Reports – single file
 * Pages: Joiner | Register | Leavers | Tenure
 * Endpoint: POST /api/hr/reports/:type/:report   (type = html | excel)
 *
 * Uses NewReportPage + NewReportDialog
 */

import { useCallback, useState } from "react";
import { NewReportDialog, NewReportPage, ReportFieldConfig } from "../../../components/new_report_format";
import { api } from "../../../api/client";


/* ═══════════════════════════════════════════════════════════════════════════
   Shared types & hook
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

function buildPayload(values: FilterValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "boolean") {
      out[k] = v ? "Y" : "N";
    } else {
      out[k] = toApiValue(v);
    }
  }
  return out;
}

function useHrReport(
  reportKey: ReportKey,
  title: string,
  fields: ReportFieldConfig[],
  initialExtra?: FilterValues
) {
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

  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  const onChange = useCallback((key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

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
    fields,
    values,
    onChange,
    onClearAll,
    onGenerate,
    loading,
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

/* Shared shell that renders NewReportPage + NewReportDialog */
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
        error={r.error}
        onClearError={() => r.setError(null)}
        fieldsPerRow={3}
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
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 4 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 4 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 4 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 4 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 4 },
  { key: "labour_desg_code", label: "Formal Designation", type: "multiselect", colSpan: 4 },
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
    colSpan: 4,
    options: [
      { value: "A", label: "Active Employees" },
      { value: "All", label: "All Employees" },
    ],
  },
  {
    key: "group_by",
    label: "Group Criteria",
    type: "select",
    colSpan: 4,
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
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 4 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 4 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 4 },
  { key: "employee_code", label: "Employee Code", type: "multiselect", colSpan: 4 },
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
    colSpan: 4,
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
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 4 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 4 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 4 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 4 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 4 },
  { key: "labour_desg_code", label: "Formal Designation", type: "multiselect", colSpan: 4 },
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
    colSpan: 4,
    options: [{ value: "All", label: "All" }],
  },
  {
    key: "group_by",
    label: "Group Criteria",
    type: "select",
    colSpan: 4,
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
  { key: "div_code", label: "Division", type: "multiselect", colSpan: 4 },
  { key: "dept_code", label: "Department", type: "multiselect", colSpan: 4 },
  { key: "section_code", label: "Section", type: "multiselect", colSpan: 4 },
  { key: "grade_code", label: "Grade", type: "multiselect", colSpan: 4 },
  { key: "desg_code", label: "Designation", type: "multiselect", colSpan: 4 },
  { key: "employee_id", label: "Employee Code", type: "multiselect", colSpan: 4 },
  { key: "as_of_date", label: "To Date", type: "date", colSpan: 4 },
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

/* Optional default export if you only need one entry */
export default {
  EmployeeJoinerReportPage,
  EmployeeRegisterReportPage,
  EmployeeLeaversReportPage,
  EmployeeTenureReportPage,
};