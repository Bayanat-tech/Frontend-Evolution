// src/pages/hr/Reports/HrRetirementReport.tsx
//
// HR Retirement Report — full-width page matching Freight Revenue layout.
//
// Filter dropdowns follow the SAME pattern as HrEmpEducationPage.tsx:
//   • LookupField (not MultiSelectField)
//   • buildParams + getDynamicLookup (server-side cascade via code2/code3/code4)
//   • Division → Department → Section → Employee chain
//
// Lookup parameter names come from PROC_BUILD_DYNAMIC_EDUCATION_QUALIFICATION
// (same proc the Education page uses), because the retirement report shares
// the org-hierarchy filter chain with that page:
//   • Division   → EDUCATION_QUALIFICATION_DIVISION_LIST
//                  (code1 = company)                              → div_code, div_name
//   • Department → EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE
//                  (code1 = company, code2 = div_code)            → dept_code, dept_name
//   • Section    → EDUCATION_QUALIFICATION_MS_HR_SECTION
//                  (code1 = company, code2 = div_code, code3 = dept_code)
//                                                                 → section_code, section_name
//   • Employee   → EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER
//                  (code1 = company, code2 = div_code, code3 = dept_code, code4 = section_code)
//                                                                 → employee_id, employee_name

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
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
import { getDynamicLookup } from "../../../api/lookups";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";

/* ✅ Expose run()/print() to the parent (header buttons) */
export type HrRetirementReportHandle = {
  run: () => Promise<void>;
  print: () => void;
};

type Props = {
  onClose?: (shouldRefetch?: boolean) => void;
};

/* ───────────────────────── types ───────────────────────── */

type DivisionOption = { div_code: string; div_name: string };
type DeptOption = { dept_code: string; dept_name: string };
type SectionOption = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string; employee_name: string };

type Params = {
  div_code: string;
  dept_code: string;
  section_code: string;
  employee_code: string;
  from_date: string;
  to_date: string;
};

/* ───────────────────────── constants ───────────────────────── */

const PRINT_IFRAME_ID = "hr-retirement-report-print-iframe";
const REPORT_TITLE = "HR Retirement Report";
const RETIREMENT_REPORT_URL = "/api/wms/reports/hr/retirement/html";

/* ───────────────────────── helpers ───────────────────────── */

const firstOfYear = (): string => {
  const now = new Date();
  return `${now.getFullYear() - 20}-01-01`;
};
const lastOfYear = (): string => {
  const now = new Date();
  return `${now.getFullYear() + 60}-12-31`;
};

function buildParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = "",
) {
  return {
    parameter,
    loginid,
    code1: companyCode,
    code2,
    code3,
    code4,
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

/** Case-insensitive field reader (see HrEmpEducationPage). */
function getField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return String(row[k]);
    const upper = k.toUpperCase();
    if (row[upper] !== undefined && row[upper] !== null) return String(row[upper]);
    const lower = k.toLowerCase();
    if (row[lower] !== undefined && row[lower] !== null) return String(row[lower]);
  }
  return "";
}

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
export const HrRetirementReport = forwardRef<HrRetirementReportHandle, Props>(
  function HrRetirementReport(_props, ref) {
    const { user } = useAuth();
    const loginid = user?.loginid ?? "";
    const companyCode = user?.company_code ?? "";

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
    const [reportHtml, setReportHtml] = useState<string | null>(null);
    const [reportPreviewError, setReportPreviewError] = useState("");

    // ── Filter state ──────────────────────────────────────────────────────────
    const [division, setDivision] = useState<DivisionOption | null>(null);
    const [department, setDepartment] = useState<DeptOption | null>(null);
    const [section, setSection] = useState<SectionOption | null>(null);
    const [employee, setEmployee] = useState<EmployeeOption | null>(null);
    const [resetKey, setResetKey] = useState(0);

    const [fromDate, setFromDate] = useState<string>(firstOfYear());
    const [toDate, setToDate] = useState<string>(lastOfYear());

    // ── Cascade resets (clear children when a parent changes) ─────────────────
    useEffect(() => {
      setDepartment(null);
      setSection(null);
      setEmployee(null);
    }, [division]);

    useEffect(() => {
      setSection(null);
      setEmployee(null);
    }, [department]);

    useEffect(() => {
      setEmployee(null);
    }, [section]);

    // ── Lookup loaders (server-side cascade via code2/code3/code4) ────────────
    const loadDivisions = useCallback(
      () =>
        getDynamicLookup(
          buildParams("EDUCATION_QUALIFICATION_DIVISION_LIST", loginid, companyCode),
        ),
      [loginid, companyCode],
    );

    // P_CODE2 = DIV_CODE (optional; empty ⇒ all departments)
    const loadDepartments = useCallback(
      () =>
        getDynamicLookup(
          buildParams(
            "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
            loginid,
            companyCode,
            division?.div_code ?? "",
          ),
        ),
      [loginid, companyCode, division?.div_code],
    );

    // P_CODE2 = DIV_CODE, P_CODE3 = DEPT_CODE
    const loadSections = useCallback(
      () =>
        getDynamicLookup(
          buildParams(
            "EDUCATION_QUALIFICATION_MS_HR_SECTION",
            loginid,
            companyCode,
            division?.div_code ?? "",
            department?.dept_code ?? "",
          ),
        ),
      [loginid, companyCode, division?.div_code, department?.dept_code],
    );

    // P_CODE2 = DIV_CODE, P_CODE3 = DEPT_CODE, P_CODE4 = SECTION_CODE
    const loadEmployees = useCallback(
      () =>
        getDynamicLookup(
          buildParams(
            "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
            loginid,
            companyCode,
            division?.div_code ?? "",
            department?.dept_code ?? "",
            section?.section_code ?? "",
          ),
        ),
      [loginid, companyCode, division?.div_code, department?.dept_code, section?.section_code],
    );

    // ── Build payload for the report endpoint ─────────────────────────────────
    const buildPayload = () => ({
      company_code: companyCode || "All",
      div_code: division?.div_code ?? "All",
      dept_code: department?.dept_code ?? "All",
      section_code: section?.section_code ?? "All",
      employee_code: employee?.employee_id ?? "All",
      from_date: fromDate || "",
      to_date: toDate || "",
      print: "false",
    });

    // ── Report fetch ──────────────────────────────────────────────────────────
    const fetchReport = useCallback(async () => {
      setReportHtml(null);
      setReportPreviewError("");
      setReportPreviewOpen(true);
      setLoading(true);
      setError("");

      try {
        const payload = buildPayload();
        const qs = new URLSearchParams(payload as any).toString();
        const res = await api.get(`${RETIREMENT_REPORT_URL}?${qs}`, {
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
    }, [companyCode, division, department, section, employee, fromDate, toDate]);

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
        iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-modals");
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
      if (!fromDate) return "Retirement From date is required";
      if (!toDate) return "Retirement To date is required";
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
      setDivision(null);
      setDepartment(null);
      setSection(null);
      setEmployee(null);
      setFromDate(firstOfYear());
      setToDate(lastOfYear());
      setError("");
      setResetKey((k) => k + 1);
    };

    const labelFor = (v: string | undefined): string => v || "All";
    const divDisplay = labelFor(division ? `${division.div_code} - ${division.div_name}` : "");
    const deptDisplay = labelFor(department ? `${department.dept_code} - ${department.dept_name}` : "");
    const sectDisplay = labelFor(section ? `${section.section_code} - ${section.section_name}` : "");
    const empDisplay = labelFor(employee ? `${employee.employee_id} - ${employee.employee_name}` : "");

    const BG = "#EEF5FD";

    // ── UI ────────────────────────────────────────────────────────────────────
    return (
      <section className="freight-ui-standard freight-report-screen" style={{ width: "100%" }}>
        <div className="freight-report-card" style={{ width: "100%" }}>
          <style>{`
            .action-btn-primary:hover { background: #1e40af !important; }
            .field-row { background: ${BG}; border-radius: 8px; padding: 10px 12px; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>

          {/* Title bar */}
          <div className="freight-report-titlebar">
            <h1>HR Retirement Report</h1>
            <span className="freight-report-title-dot" aria-hidden="true" />
            <div className="freight-report-title-actions flex flex-wrap items-center gap-2">
              <div className="rounded-md border bg-muted/40 px-3 py-1.5 text-foreground">
                <div className="text-[9px] font-semibold uppercase text-muted-foreground">Filters</div>
                <div className="text-[12px] font-semibold">Ready</div>
              </div>
            </div>
          </div>

          <ReportFilterHeader onClear={handleReset} label="Report Filters" />

          {/* Summary strip */}
          <div className="freight-report-summary grid grid-cols-4 gap-2 border-b bg-muted/10 p-3">
            <SummaryStripItem icon={Users} label="Division" value={divDisplay} />
            <SummaryStripItem icon={Filter} label="Department" value={deptDisplay} />
            <SummaryStripItem icon={Package} label="Section" value={sectDisplay} />
            <SummaryStripItem icon={UserRound} label="Employee" value={empDisplay} />
          </div>

          {/* Errors */}
          {error && (
            <div style={{ margin: "10px 12px", padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span>
              {error}
              <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626" }}>✕</button>
            </div>
          )}

          {/* Field rows */}
          <div style={{ padding: "0 12px" }}>
            {/* Row 1: Division / Department / Section / Employee — 4 in a row */}
            <div
              className="field-row"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                marginTop: 6,
                width: "100%",
              }}
            >
              <FloatLabel label="Division" bgColor={BG}>
                <LookupField
                  key={`division-${resetKey}`}
                  compact
                  label=""
                  value={division?.div_code ?? ""}
                  displayValue={division ? `${division.div_code} - ${division.div_name}` : ""}
                  columns={[
                    { field: "div_code", header: "Code" },
                    { field: "div_name", header: "Division" },
                  ]}
                  valueField="div_code"
                  displayFields={["div_code", "div_name"]}
                  loadOptions={loadDivisions}
                  onChange={(_, row) =>
                    setDivision(
                      row
                        ? {
                            div_code: String(row.div_code ?? ""),
                            div_name: String(row.div_name ?? ""),
                          }
                        : null,
                    )
                  }
                />
              </FloatLabel>

              <FloatLabel label="Department" bgColor={BG}>
                <LookupField
                  key={`department-${resetKey}-${division?.div_code ?? ""}`}
                  compact
                  label=""
                  value={department?.dept_code ?? ""}
                  displayValue={department ? `${department.dept_code} - ${department.dept_name}` : ""}
                  columns={[
                    { field: "dept_code", header: "Code" },
                    { field: "dept_name", header: "Department" },
                  ]}
                  valueField="dept_code"
                  displayFields={["dept_code", "dept_name"]}
                  loadOptions={loadDepartments}
                  onChange={(_, row) =>
                    setDepartment(
                      row
                        ? {
                            dept_code: String(row.dept_code ?? ""),
                            dept_name: String(row.dept_name ?? ""),
                          }
                        : null,
                    )
                  }
                />
              </FloatLabel>

              <FloatLabel label="Section" bgColor={BG}>
                <LookupField
                  key={`section-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
                  compact
                  label=""
                  value={section?.section_code ?? ""}
                  displayValue={section ? `${section.section_code} - ${section.section_name}` : ""}
                  columns={[
                    { field: "section_code", header: "Code" },
                    { field: "section_name", header: "Section" },
                  ]}
                  valueField="section_code"
                  displayFields={["section_code", "section_name"]}
                  loadOptions={loadSections}
                  onChange={(_, row) =>
                    setSection(
                      row
                        ? {
                            section_code: String(row.section_code ?? ""),
                            section_name: String(row.section_name ?? ""),
                          }
                        : null,
                    )
                  }
                />
              </FloatLabel>

              <FloatLabel label="Employee" bgColor={BG}>
                <LookupField
                  key={`employee-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}-${section?.section_code ?? ""}`}
                  compact
                  label=""
                  value={employee?.employee_id ?? ""}
                  displayValue={employee ? `${employee.employee_id} - ${employee.employee_name}` : ""}
                  columns={[
                    { field: "employee_id", header: "ID" },
                    { field: "employee_name", header: "Employee" },
                  ]}
                  valueField="employee_id"
                  displayFields={["employee_id", "employee_name"]}
                  loadOptions={loadEmployees}
                  onChange={(_, row) =>
                    setEmployee(
                      row
                        ? {
                            employee_id: String(row.employee_id ?? ""),
                            // API may return either rpt_name or employee_name
                            employee_name: String(row.employee_name ?? row.rpt_name ?? ""),
                          }
                        : null,
                    )
                  }
                />
              </FloatLabel>
            </div>

            {/* Row 2: From / To dates */}
            <div
              className="field-row"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                marginTop: 10,
              }}
            >
              <FloatLabel label="From" required bgColor={BG}>
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
              <div />
              <div />
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
                  <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 6 }} />
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
  },
);

export default HrRetirementReport;