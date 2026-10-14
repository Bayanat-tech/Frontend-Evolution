// src/pages/hr/Reports/HrLabourCardExpiry.tsx
//
// HR Labour Card Expiry Listing Report — full-width page matching the
// HR Retirement Report layout.
//
// Filter cascade mirrors HREmployeeLeaveEntitlement / HrRetirementReport:
//   Division → Department → Section → Employee
// Plus two independent filters:
//   • Grade        → MS_HR_GRADE_LIST (falls back to EDUCATION_QUALIFICATION_GRADE_LIST)
//   • Designation  → MS_HR_DESIGNATION_LIST (falls back to EDUCATION_QUALIFICATION_DESIGNATION_LIST)
//
// Lookup parameter names (same as HrRetirementReport):
//   • Division    → EDUCATION_QUALIFICATION_DIVISION_LIST
//                   (code1 = company)                              → div_code, div_name
//   • Department  → MS_EMP_HR_LEAVE_ENTITLEMENT_DEPARTMENT
//                   (code1 = company, code2 = div_code)            → dept_code, dept_name
//   • Section     → EDUCATION_QUALIFICATION_MS_HR_SECTION
//                   (code1 = company, code2 = div_code, code3 = dept_code)
//                                                                  → section_code, section_name
//   • Employee    → MS_EMP_HR_LEAVE_ENTITLEMENT_EMPLOYEE_LIST
//                   (code1 = company, code2 = div_code, code3 = dept_code, code4 = section_code)
//                                                                  → EMPLOYEE_ID, EMPLOYEE_CODE, RPT_NAME
//   • Grade       → MS_HR_GRADE_LIST / EDUCATION_QUALIFICATION_GRADE_LIST
//                                                                  → GRADE_CODE, GRADE_NAME
//   • Designation → MS_HR_DESIGNATION_LIST / EDUCATION_QUALIFICATION_DESIGNATION_LIST
//                                                                  → DESG_CODE, DESG_NAME

import React, {
  useCallback,
  useImperativeHandle,
  useState,
  forwardRef,
} from "react";
import {
  CalendarDays,
  Filter,
  Package,
  UserRound,
  Users,
} from "lucide-react";
import { api } from "../../../api/client";
import {
  DynamicQueryParams,
  getDynamicLookup,
  LookupRow,
} from "../../../api/lookups";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";

/* ✅ Expose run()/print() to the parent (header buttons) */
export type HrLabourCardExpiryReportHandle = {
  run: () => Promise<void>;
  print: () => void;
};

type Props = {
  onClose?: (shouldRefetch?: boolean) => void;
};

/* ───────────────────────── constants ───────────────────────── */

const PRINT_IFRAME_ID = "hr-labour-card-expiry-report-print-iframe";
const REPORT_TITLE = "HR Labour Card Expiry Listing";
const LABOUR_CARD_REPORT_URL = "/api/wms/reports/hr/labour-card-expiry/html";

/* ───────────────────────── helpers ───────────────────────── */

const firstOfMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

const endOfNextYear = (): string => {
  const now = new Date();
  return `${now.getFullYear() + 1}-12-31`;
};

/** Identical to HrRetirementReport's buildPayload. */
const buildPayload = (
  parameter: string,
  loginid: string,
  extra: Partial<Omit<DynamicQueryParams, "parameter" | "loginid">> = {},
): DynamicQueryParams => ({ parameter, loginid, ...extra });

/** Identical to HrRetirementReport's `matches`. */
const matches = (rows: LookupRow[], q?: string) => {
  const term = (q || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)),
  );
};

/** Identical to HrRetirementReport's `val`. */
const val = (row: LookupRow | null | undefined, ...keys: string[]): string => {
  if (!row) return "";
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

/* ───────────────────────── shared styles ───────────────────────── */

function FloatLabel({
  label,
  required,
  children,
  bgColor = "#fff",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  bgColor?: string;
}) {
  return (
    <div style={{ position: "relative", marginTop: 6 }}>
      <span
        style={{
          position: "absolute",
          top: -8,
          left: 10,
          fontSize: 11,
          color: "#6b7280",
          background: bgColor,
          padding: "0 4px",
          zIndex: 1,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 500,
        }}
      >
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </span>
      {children}
    </div>
  );
}

function SummaryStripItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2 shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={14} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">
          {label}
        </div>
        <div className="truncate text-[12.5px] font-semibold text-slate-800" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────────────────────── */
export const HrLabourCardExpiryReport = forwardRef<
  HrLabourCardExpiryReportHandle,
  Props
>(function HrLabourCardExpiryReport(_props, ref) {
  const { user } = useAuth() as any;
  const loginid: string =
    user?.loginId ?? user?.loginid ?? user?.userId ?? user?.username ?? "";
  const companyCode: string = user?.companyCode ?? user?.company_code ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");

  // ── Filter state ─────────────────────────────────────────────────────────
  const [divCode, setDivCode] = useState("");
  const [divDisplay, setDivDisplay] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDisplay, setDeptDisplay] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [sectionDisplay, setSectionDisplay] = useState("");
  const [gradeCode, setGradeCode] = useState("");
  const [gradeDisplay, setGradeDisplay] = useState("");
  const [desgCode, setDesgCode] = useState("");
  const [desgDisplay, setDesgDisplay] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeDisplay, setEmployeeDisplay] = useState("");

  // Labour Card expiry range (defaults match screenshot: 01/10/2026 → 19/10/2026).
  const [fromDate, setFromDate] = useState<string>(firstOfMonth());
  const [toDate, setToDate] = useState<string>(endOfNextYear());

  // Active / All employees toggle — mirrors SQL: ('All' = :as_emp_status OR EMPSTATUS_CODE <> 'S')
  // "Active Employees"  → emp_status = 'A'  (server treats non-'All' as filter; see report proc)
  // "All Employees"     → emp_status = 'All'
  const [empStatus, setEmpStatus] = useState<"A" | "All">("A");

  // ── Lookup loaders — IDENTICAL STRUCTURE to HrRetirementReport ────────────
  const loadDivisions = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("EDUCATION_QUALIFICATION_DIVISION_LIST", loginid, {
          code1: companyCode,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginid],
  );

  const loadDepartments = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_DEPARTMENT", loginid, {
          code1: companyCode,
          code2: divCode || undefined,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginid, divCode],
  );

  const loadSections = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("EDUCATION_QUALIFICATION_MS_HR_SECTION", loginid, {
          code1: companyCode,
          code2: divCode || undefined,
          code3: deptCode || undefined,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginid, divCode, deptCode],
  );

  const loadGrades = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      // Try the HR-specific grade list first; if the endpoint returns nothing,
      // fall back to the education qualification grade list used by other
      // employee reports.
      let data: LookupRow[] = [];
      try {
        data = await getDynamicLookup(
          buildPayload("MS_HR_GRADE_LIST", loginid, {
            code1: companyCode,
          }),
        );
      } catch {
        data = [];
      }
      if (!data || data.length === 0) {
        try {
          data = await getDynamicLookup(
            buildPayload("EDUCATION_QUALIFICATION_GRADE_LIST", loginid, {
              code1: companyCode,
            }),
          );
        } catch {
          data = [];
        }
      }
      return matches(data, q);
    },
    [companyCode, loginid],
  );

  const loadDesignations = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      let data: LookupRow[] = [];
      try {
        data = await getDynamicLookup(
          buildPayload("MS_HR_DESIGNATION_LIST", loginid, {
            code1: companyCode,
          }),
        );
      } catch {
        data = [];
      }
      if (!data || data.length === 0) {
        try {
          data = await getDynamicLookup(
            buildPayload("EDUCATION_QUALIFICATION_DESIGNATION_LIST", loginid, {
              code1: companyCode,
            }),
          );
        } catch {
          data = [];
        }
      }
      return matches(data, q);
    },
    [companyCode, loginid],
  );

  const loadEmployees = useCallback(
    async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(
        buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_EMPLOYEE_LIST", loginid, {
          code1: companyCode,
          code2: divCode || undefined,
          code3: deptCode || undefined,
          code4: sectionCode || undefined,
        }),
      );
      return matches(data, q);
    },
    [companyCode, loginid, divCode, deptCode, sectionCode],
  );

  // ── Selection handlers — IDENTICAL to HrRetirementReport ─────────────────
  const resetMessages = () => {
    setError("");
  };

  const handleDivisionChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setDivCode(value);
    setDivDisplay(row ? `${val(row, "DIV_CODE")} ${val(row, "DIV_NAME")}`.trim() : "");
    setDeptCode("");
    setDeptDisplay("");
    setSectionCode("");
    setSectionDisplay("");
    setEmployeeId("");
    setEmployeeDisplay("");
  };

  const handleDepartmentChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setDeptCode(value);
    setDeptDisplay(row ? `${val(row, "DEPT_CODE")} ${val(row, "DEPT_NAME")}`.trim() : "");

    const parentDiv = val(row, "DIV_CODE");
    if (parentDiv) {
      setDivCode(parentDiv);
      setDivDisplay(`${parentDiv} ${val(row, "DIV_NAME")}`.trim() || parentDiv);
    }

    setSectionCode("");
    setSectionDisplay("");
    setEmployeeId("");
    setEmployeeDisplay("");
  };

  const handleSectionChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setSectionCode(value);
    setSectionDisplay(
      row ? `${val(row, "SECTION_CODE")} ${val(row, "SECTION_NAME")}`.trim() : "",
    );

    const parentDiv = val(row, "DIV_CODE");
    if (parentDiv) {
      setDivCode(parentDiv);
      setDivDisplay(`${parentDiv} ${val(row, "DIV_NAME")}`.trim() || parentDiv);
    }
    const parentDept = val(row, "DEPT_CODE");
    if (parentDept) {
      setDeptCode(parentDept);
      setDeptDisplay(`${parentDept} ${val(row, "DEPT_NAME")}`.trim() || parentDept);
    }

    setEmployeeId("");
    setEmployeeDisplay("");
  };

  const handleGradeChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setGradeCode(value);
    setGradeDisplay(
      row ? `${val(row, "GRADE_CODE")} ${val(row, "GRADE_NAME")}`.trim() : "",
    );
  };

  const handleDesignationChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setDesgCode(value);
    setDesgDisplay(
      row ? `${val(row, "DESG_CODE")} ${val(row, "DESG_NAME")}`.trim() : "",
    );
  };

  const handleEmployeeChange = (value: string, row: LookupRow | null) => {
    resetMessages();
    setEmployeeId(value);

    const code = val(row, "employee_id", "EMPLOYEE_ID", "employee_code", "EMPLOYEE_CODE");
    const name = val(row, "employee_name", "EMPLOYEE_NAME", "rpt_name", "RPT_NAME");
    setEmployeeDisplay(row ? `${code} ${name}`.trim() : "");

    if (row) {
      const empDiv = val(row, "div_code", "DIV_CODE");
      if (empDiv) {
        setDivCode(empDiv);
        setDivDisplay(`${empDiv} ${val(row, "div_name", "DIV_NAME")}`.trim() || empDiv);
      }
      const empDept = val(row, "dept_code", "DEPT_CODE");
      if (empDept) {
        setDeptCode(empDept);
        setDeptDisplay(`${empDept} ${val(row, "dept_name", "DEPT_NAME")}`.trim() || empDept);
      }
      const empSec = val(row, "section_code", "SECTION_CODE");
      if (empSec) {
        setSectionCode(empSec);
        setSectionDisplay(
          `${empSec} ${val(row, "section_name", "SECTION_NAME")}`.trim() || empSec,
        );
      }
    }
  };

  // ── Build payload for the report endpoint ────────────────────────────────
  const buildReportQuery = () => ({
    company_code: companyCode || "All",
    div_code: divCode || "All",
    dept_code: deptCode || "All",
    section_code: sectionCode || "All",
    grade_code: gradeCode || "All",
    desg_code: desgCode || "All",
    employee_code: employeeId || "All",
    from_date: fromDate || "",
    to_date: toDate || "",
    emp_status: empStatus,
    print: "false",
  });

  // ── Report fetch ─────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setReportHtml(null);
    setReportPreviewError("");
    setReportPreviewOpen(true);
    setLoading(true);
    setError("");

    try {
      const payload = buildReportQuery();
      const qs = new URLSearchParams(payload as any).toString();
      const res = await api.get(`${LABOUR_CARD_REPORT_URL}?${qs}`, {
        responseType: "text",
      });
      setReportHtml(res.data);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ?? "Failed to load report. Please try again.";
      setReportPreviewError(message);
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    companyCode,
    divCode,
    deptCode,
    sectionCode,
    gradeCode,
    desgCode,
    employeeId,
    fromDate,
    toDate,
    empStatus,
  ]);

  const closeReportPreview = () => {
    setReportPreviewOpen(false);
    setReportHtml(null);
    setReportPreviewError("");
  };

  const handleOpenReportInNewWindow = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } else {
      window.URL.revokeObjectURL(url);
    }
  };

  const handleDownloadReportPdf = () => {
    if (!reportHtml) return;
    let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.setAttribute(
        "sandbox",
        "allow-same-origin allow-scripts allow-modals",
      );
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    const doPrint = () => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        /* ignore */
      }
    };

    if (iframe.contentDocument?.readyState === "complete") {
      setTimeout(doPrint, 300);
    } else {
      iframe.onload = () => setTimeout(doPrint, 300);
      setTimeout(doPrint, 700);
    }
  };

  const validate = (): string | null => {
    if (!companyCode) return "Company is required";
    if (!fromDate) return "Labour Card Expiry From date is required";
    if (!toDate) return "Labour Card Expiry To date is required";
    if (new Date(fromDate) > new Date(toDate))
      return "'From Date' cannot be greater than 'To Date'";
    return null;
  };

  const handleRun = useCallback(async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    await fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, fetchReport]);

  const handlePrint = useCallback(() => {
    void handleRun();
  }, [handleRun]);

  useImperativeHandle(ref, () => ({
    run: handleRun,
    print: handlePrint,
  }));

  const handleReset = () => {
    setDivCode("");
    setDivDisplay("");
    setDeptCode("");
    setDeptDisplay("");
    setSectionCode("");
    setSectionDisplay("");
    setGradeCode("");
    setGradeDisplay("");
    setDesgCode("");
    setDesgDisplay("");
    setEmployeeId("");
    setEmployeeDisplay("");
    setFromDate(firstOfMonth());
    setToDate(endOfNextYear());
    setEmpStatus("A");
    setError("");
  };

  const labelFor = (v: string | undefined): string => v || "All";
  const divShow = labelFor(divDisplay);
  const deptShow = labelFor(deptDisplay);
  const sectShow = labelFor(sectionDisplay);
  const gradeShow = labelFor(gradeDisplay);
  const desgShow = labelFor(desgDisplay);
  const empShow = labelFor(employeeDisplay);

  const BG = "#EEF5FD";

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <section
      className="freight-ui-standard freight-report-screen"
      style={{ width: "100%" }}
    >
      <div className="freight-report-card" style={{ width: "100%" }}>
        <style>{`
          .action-btn-primary:hover { background: #1e40af !important; }
          .field-row { background: ${BG}; border-radius: 8px; padding: 10px 12px; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

        {/* Title bar */}
        <div className="freight-report-titlebar">
          <h1>HR Labour Card Expiry Listing</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
          <div className="freight-report-title-actions flex flex-wrap items-center gap-2">
            <div className="rounded-md border bg-muted/40 px-3 py-1.5 text-foreground">
              <div className="text-[9px] font-semibold uppercase text-muted-foreground">
                Filters
              </div>
              <div className="text-[12px] font-semibold">Ready</div>
            </div>
          </div>
        </div>

        <ReportFilterHeader onClear={handleReset} label="Report Filters" />

        {/* Summary strip */}
        <div className="freight-report-summary grid grid-cols-4 gap-2 border-b bg-muted/10 p-3">
          <SummaryStripItem icon={Users} label="Division" value={divShow} />
          <SummaryStripItem icon={Filter} label="Department" value={deptShow} />
          <SummaryStripItem icon={Package} label="Section" value={sectShow} />
          <SummaryStripItem icon={UserRound} label="Employee" value={empShow} />
        </div>

        {/* Errors */}
        {error && (
          <div
            style={{
              margin: "10px 12px",
              padding: "8px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              color: "#dc2626",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            {error}
            <button
              onClick={() => setError("")}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "#dc2626",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Field rows */}
        <div style={{ padding: "0 12px" }}>
          {/* Row 1: Division / Department / Section */}
          <div
            className="field-row"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginTop: 6,
              width: "100%",
            }}
          >
            <FloatLabel label="Division" bgColor={BG}>
              <LookupField
                compact
                label=""
                value={divCode}
                displayValue={divDisplay || undefined}
                columns={[
                  { field: "DIV_CODE", header: "Code" },
                  { field: "DIV_NAME", header: "Name" },
                ]}
                valueField="DIV_CODE"
                displayFields={["DIV_CODE", "DIV_NAME"]}
                loadOptions={loadDivisions}
                onChange={handleDivisionChange}
                placeholder="Select division"
              />
            </FloatLabel>

            <FloatLabel label="Department" bgColor={BG}>
              <LookupField
                compact
                label=""
                value={deptCode}
                displayValue={deptDisplay || undefined}
                columns={[
                  { field: "DEPT_CODE", header: "Code" },
                  { field: "DEPT_NAME", header: "Name" },
                ]}
                valueField="DEPT_CODE"
                displayFields={["DEPT_CODE", "DEPT_NAME"]}
                loadOptions={loadDepartments}
                onChange={handleDepartmentChange}
                placeholder="Select department"
              />
            </FloatLabel>

            <FloatLabel label="Section" bgColor={BG}>
              <LookupField
                compact
                label=""
                value={sectionCode}
                displayValue={sectionDisplay || undefined}
                columns={[
                  { field: "SECTION_CODE", header: "Code" },
                  { field: "SECTION_NAME", header: "Name" },
                ]}
                valueField="SECTION_CODE"
                displayFields={["SECTION_CODE", "SECTION_NAME"]}
                loadOptions={loadSections}
                onChange={handleSectionChange}
                placeholder="Select section"
              />
            </FloatLabel>
          </div>

          {/* Row 2: Grade / Designation / Employee */}
          <div
            className="field-row"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginTop: 10,
            }}
          >
            <FloatLabel label="Grade" bgColor={BG}>
              <LookupField
                compact
                label=""
                value={gradeCode}
                displayValue={gradeDisplay || undefined}
                columns={[
                  { field: "GRADE_CODE", header: "Code" },
                  { field: "GRADE_NAME", header: "Name" },
                ]}
                valueField="GRADE_CODE"
                displayFields={["GRADE_CODE", "GRADE_NAME"]}
                loadOptions={loadGrades}
                onChange={handleGradeChange}
                placeholder="Select grade"
              />
            </FloatLabel>

            <FloatLabel label="Designation" bgColor={BG}>
              <LookupField
                compact
                label=""
                value={desgCode}
                displayValue={desgDisplay || undefined}
                columns={[
                  { field: "DESG_CODE", header: "Code" },
                  { field: "DESG_NAME", header: "Name" },
                ]}
                valueField="DESG_CODE"
                displayFields={["DESG_CODE", "DESG_NAME"]}
                loadOptions={loadDesignations}
                onChange={handleDesignationChange}
                placeholder="Select designation"
              />
            </FloatLabel>

            <FloatLabel label="Employee Code" bgColor={BG}>
              <LookupField
                compact
                label=""
                value={employeeId}
                displayValue={employeeDisplay || undefined}
                columns={[
                  { field: "EMPLOYEE_CODE", header: "Code" },
                  { field: "RPT_NAME", header: "Name" },
                ]}
                valueField="EMPLOYEE_ID"
                displayFields={["EMPLOYEE_CODE", "RPT_NAME"]}
                loadOptions={loadEmployees}
                onChange={handleEmployeeChange}
                placeholder="Select employee"
              />
            </FloatLabel>
          </div>

          {/* Row 3: Labour Card Expiry dates + Active/All toggle */}
          <div
            className="field-row"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginTop: 10,
              alignItems: "end",
            }}
          >
            <FloatLabel label="Labour Card Expiry From" required bgColor={BG}>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </FloatLabel>

            <FloatLabel label="To" required bgColor={BG}>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </FloatLabel>

            <div
              style={{
                display: "flex",
                gap: 18,
                alignItems: "center",
                paddingBottom: 4,
                gridColumn: "span 2",
                justifyContent: "flex-end",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  color: "#1f2937",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="emp_status"
                  value="A"
                  checked={empStatus === "A"}
                  onChange={() => setEmpStatus("A")}
                />
                Active Employees
              </label>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  color: "#1f2937",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="emp_status"
                  value="All"
                  checked={empStatus === "All"}
                  onChange={() => setEmpStatus("All")}
                />
                All Employees
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="freight-report-actions">
          <Button
            className="action-btn-primary"
            size="sm"
            onClick={() => void handleRun()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    border: "2px solid #ffffff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    marginRight: 6,
                  }}
                />
                Generating…
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </div>
      </div>

      {/* Report preview dialog */}
      <NewReportDialog
        open={reportPreviewOpen}
        onClose={closeReportPreview}
        title={REPORT_TITLE}
        htmlContent={reportHtml}
        loading={loading}
        error={reportPreviewError || null}
        onOpenInNewWindow={handleOpenReportInNewWindow}
        onDownloadPdf={handleDownloadReportPdf}
      />
    </section>
  );
});

export default HrLabourCardExpiryReport;