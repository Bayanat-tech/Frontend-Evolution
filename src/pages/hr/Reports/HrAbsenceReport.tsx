// src/pages/hr/Reports/HrAbsenceReport.tsx
//
// HR Absence Report — full-width page matching Freight Revenue layout.
//
// Filter dropdowns use the WORKING pattern from HREmployeeLeaveEntitlement.tsx
// (backed by PROC_BUILD_DYNAMIC_SQL_MS_EMP_HR_LEAVE_ENTITLEMENT):
//   • Division   → MS_EMP_HR_LEAVE_ENTITLEMENT_DIVISION
//                  (code1 = company)                              → DIV_CODE, DIV_NAME
//   • Department → MS_EMP_HR_LEAVE_ENTITLEMENT_DEPARTMENT
//                  (code1 = company, code2 = div_code)            → DEPT_CODE, DEPT_NAME,
//                                                                   DIV_CODE, DIV_NAME
//   • Section    → MS_EMP_HR_LEAVE_ENTITLEMENT_SECTION
//                  (code1 = company, code2 = div_code, code3 = dept_code)
//                                                                 → SECTION_CODE, SECTION_NAME,
//                                                                   DIV_CODE, DIV_NAME,
//                                                                   DEPT_CODE, DEPT_NAME
//   • Employee   → MS_EMP_HR_LEAVE_ENTITLEMENT_EMPLOYEE_LIST
//                  (code1 = company, code2 = div_code, code3 = dept_code, code4 = section_code)
//                                                                 → EMPLOYEE_ID, EMPLOYEE_CODE,
//                                                                   RPT_NAME, DIV_CODE,
//                                                                   DIV_NAME, DEPT_CODE,
//                                                                   DEPT_NAME, SECTION_CODE,
//                                                                   SECTION_NAME

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
import { LookupField } from "../../../components/ui/LookupField";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";

/* ✅ Expose run()/print() to the parent (header buttons) */
export type HrAbsenceReportHandle = {
  run: () => Promise<void>;
  print: () => void;
};

type Props = {
  onClose?: (shouldRefetch?: boolean) => void;
};

/* ───────────────────────── constants ───────────────────────── */

const PRINT_IFRAME_ID = "hr-absence-report-print-iframe";
const REPORT_TITLE = "HR Absence Report";
const ABSENCE_REPORT_URL = "/api/wms/reports/hr/absence/html";

const MONTH_OPTIONS = [
  { code: "1",  label: "JAN" },
  { code: "2",  label: "FEB" },
  { code: "3",  label: "MAR" },
  { code: "4",  label: "APR" },
  { code: "5",  label: "MAY" },
  { code: "6",  label: "JUN" },
  { code: "7",  label: "JUL" },
  { code: "8",  label: "AUG" },
  { code: "9",  label: "SEP" },
  { code: "10", label: "OCT" },
  { code: "11", label: "NOV" },
  { code: "12", label: "DEC" },
];

/* ───────────────────────── helpers ───────────────────────── */

const currentMonthCode = (): string => String(new Date().getMonth() + 1);
const currentYear = (): string => String(new Date().getFullYear());

/** Identical to HREmployeeLeaveEntitlement's buildPayload. */
const buildPayload = (
  parameter: string,
  loginid: string,
  extra: Partial<Omit<DynamicQueryParams, "parameter" | "loginid">> = {},
): DynamicQueryParams => ({ parameter, loginid, ...extra });

/** Identical to HREmployeeLeaveEntitlement's `matches`. */
const matches = (rows: LookupRow[], q?: string) => {
  const term = (q || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)),
  );
};

/** Identical to HREmployeeLeaveEntitlement's `val`. */
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
export const HrAbsenceReport = forwardRef<HrAbsenceReportHandle, Props>(
  function HrAbsenceReport(_props, ref) {
    const { user } = useAuth() as any;
    const loginid: string =
      user?.loginId ?? user?.loginid ?? user?.userId ?? user?.username ?? "";
    const companyCode: string =
      user?.companyCode ?? user?.company_code ?? "";

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
    const [employeeId, setEmployeeId] = useState("");
    const [employeeDisplay, setEmployeeDisplay] = useState("");

    // Pay Month / Pay Year — drive the period filter
    const [payMonth, setPayMonth] = useState<string>(currentMonthCode());
    const [payYear, setPayYear] = useState<string>(currentYear());

    // History checkbox
    const [history, setHistory] = useState<boolean>(false);

    // ── Lookup loaders — using the WORKING MS_EMP_HR_LEAVE_ENTITLEMENT proc ──
    const loadDivisions = useCallback(
      async (q?: string) => {
        if (!companyCode) return [];
        const data = await getDynamicLookup(
          buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_DIVISION", loginid, {
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
          buildPayload("MS_EMP_HR_LEAVE_ENTITLEMENT_SECTION", loginid, {
            code1: companyCode,
            code2: divCode || undefined,
            code3: deptCode || undefined,
          }),
        );
        return matches(data, q);
      },
      [companyCode, loginid, divCode, deptCode],
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

    // ── Selection handlers — identical to HREmployeeLeaveEntitlement ─────────
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

    const handleEmployeeChange = (value: string, row: LookupRow | null) => {
      resetMessages();
      setEmployeeId(value);

      const code = val(row, "EMPLOYEE_CODE", "EMPLOYEE_ID");
      const name = val(row, "RPT_NAME");
      setEmployeeDisplay(row ? `${code} ${name}`.trim() : "");

      if (row) {
        const empDiv = val(row, "DIV_CODE");
        if (empDiv) {
          setDivCode(empDiv);
          setDivDisplay(`${empDiv} ${val(row, "DIV_NAME")}`.trim() || empDiv);
        }
        const empDept = val(row, "DEPT_CODE");
        if (empDept) {
          setDeptCode(empDept);
          setDeptDisplay(`${empDept} ${val(row, "DEPT_NAME")}`.trim() || empDept);
        }
        const empSec = val(row, "SECTION_CODE");
        if (empSec) {
          setSectionCode(empSec);
          setSectionDisplay(`${empSec} ${val(row, "SECTION_NAME")}`.trim() || empSec);
        }
      }
    };

    // ── Build payload for the report endpoint ────────────────────────────────
    // NOTE: proc uses P_NUMBER1 = Pay Month, P_NUMBER2 = Pay Year.
    const buildReportQuery = () => ({
      company_code: companyCode || "All",
      div_code: divCode || "All",
      dept_code: deptCode || "All",
      section_code: sectionCode || "All",
      employee_code: employeeId || "All",
      pay_month: payMonth || "",
      pay_year: payYear || "",
      history: history ? "Y" : "N",
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
        const res = await api.get(`${ABSENCE_REPORT_URL}?${qs}`, {
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
    }, [companyCode, divCode, deptCode, sectionCode, employeeId, payMonth, payYear, history]);

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
      if (!payMonth) return "Pay Month is required";
      if (!payYear) return "Pay Year is required";
      const m = Number(payMonth);
      const y = Number(payYear);
      if (!Number.isFinite(m) || m < 1 || m > 12) return "Invalid Pay Month";
      if (!Number.isFinite(y) || y < 1900 || y > 9999) return "Invalid Pay Year";
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
    }, [payMonth, payYear, fetchReport]);

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
      setEmployeeId("");
      setEmployeeDisplay("");
      setPayMonth(currentMonthCode());
      setPayYear(currentYear());
      setHistory(false);
      setError("");
    };

    const labelFor = (v: string | undefined): string => v || "All";
    const divShow = labelFor(divDisplay);
    const deptShow = labelFor(deptDisplay);
    const sectShow = labelFor(sectionDisplay);
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
            <h1>HR Absence Report</h1>
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
            {/* Row 1: Division / Department / Section / Employee */}
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

            {/* Row 2: Pay Month / Pay Year / History */}
            <div
              className="field-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 10,
                marginTop: 10,
              }}
            >
              <FloatLabel label="Pay Month" required bgColor={BG}>
                <select
                  value={payMonth}
                  onChange={(e) => setPayMonth(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    fontSize: 13,
                  }}
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </FloatLabel>

              <FloatLabel label="Pay Year" required bgColor={BG}>
                <select
                  value={payYear}
                  onChange={(e) => setPayYear(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    fontSize: 13,
                  }}
                >
                  {Array.from({ length: 7 }, (_, i) => {
                    const y = new Date().getFullYear() - 3 + i;
                    return (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </FloatLabel>

              <FloatLabel label="History" bgColor={BG}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 32,
                    paddingLeft: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={history}
                    onChange={(e) => setHistory(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
                      color: "#475569",
                    }}
                  >
                    Show all months
                  </span>
                </div>
              </FloatLabel>

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
  },
);

export default HrAbsenceReport;