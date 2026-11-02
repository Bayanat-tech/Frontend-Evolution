// src/pages/hr/Reports/HrEmployeeWiseCostReport.tsx

import React, {
  useCallback,
  useImperativeHandle,
  useState,
  forwardRef,
} from "react";
import { CalendarDays, Filter, Package, UserRound, Users } from "lucide-react";
import { api } from "../../../api/client";
import { DynamicQueryParams, getDynamicLookup, LookupRow } from "../../../api/lookups";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { LookupField } from "../../../components/ui/LookupField";
import { NewReportDialog } from "../../../components/new_report_format";
import { useAuth } from "../../../state/AuthContext";

export type HrEmployeeWiseCostReportHandle = {
  run: () => Promise<void>;
  print: () => void;
};

type Props = {
  onClose?: (shouldRefetch?: boolean) => void;
};

const PRINT_IFRAME_ID = "hr-emp-cost-print-iframe";
const REPORT_TITLE = "Employee Wise Cost Report";
const REPORT_URL = "/api/wms/reports/hr/employee-wise-cost/html";

const PARAM_DIVISION_LIST      = "EDUCATION_QUALIFICATION_DIVISION_LIST";
const PARAM_DEPARTMENT_LIST    = "MS_EMP_HR_LEAVE_ENTITLEMENT_DEPARTMENT";
const PARAM_SECTION_LIST       = "EDUCATION_QUALIFICATION_MS_HR_SECTION";
const PARAM_EMPLOYEE_LIST      = "MS_EMP_HR_LEAVE_ENTITLEMENT_EMPLOYEE_LIST";

const PAY_MONTHS = [
  { code: "1", name: "JAN" }, { code: "2", name: "FEB" }, { code: "3", name: "MAR" },
  { code: "4", name: "APR" }, { code: "5", name: "MAY" }, { code: "6", name: "JUN" },
  { code: "7", name: "JUL" }, { code: "8", name: "AUG" }, { code: "9", name: "SEP" },
  { code: "10", name: "OCT" }, { code: "11", name: "NOV" }, { code: "12", name: "DEC" },
];

const SOURCE_OPTIONS = [
  { code: "Payroll", name: "Payroll" },
  { code: "Timesheet", name: "Timesheet" },
  { code: "Both", name: "Both" },
];

const REPORT_TYPES = [
  "Employee Wise Cost",
  "PASI",
  "PASI Comparison",
  "Accrual"
];

const currentMonth = (): string => String(new Date().getMonth() + 1);
const currentYear = (): string => String(new Date().getFullYear());

const buildPayload = (
  parameter: string,
  loginid: string,
  extra: Partial<Omit<DynamicQueryParams, "parameter" | "loginid">> = {},
): DynamicQueryParams => ({ parameter, loginid, ...extra });

const matches = (rows: LookupRow[], q?: string) => {
  const term = (q || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)));
};

const val = (row: LookupRow | null | undefined, ...keys: string[]): string => {
  if (!row) return "";
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

function FloatLabel({ label, required, children, bgColor = "#fff" }: { label: string; required?: boolean; children: React.ReactNode; bgColor?: string; }) {
  return (
    <div style={{ position: "relative", marginTop: 6 }}>
      <span style={{ position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280", background: bgColor, padding: "0 4px", zIndex: 1, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
        {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
      </span>
      {children}
    </div>
  );
}

function SummaryStripItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string; }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2 shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={14} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
        <div className="truncate text-[12.5px] font-semibold text-slate-800" title={value}>{value}</div>
      </div>
    </div>
  );
}

export const HrEmployeeWiseCostReport = forwardRef<HrEmployeeWiseCostReportHandle, Props>(
  function HrEmployeeWiseCostReport(_props, ref) {
    const { user } = useAuth() as any;
    const loginid: string = user?.loginId ?? user?.loginid ?? user?.userId ?? user?.username ?? "";
    const companyCode: string = user?.companyCode ?? user?.company_code ?? "";

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
    const [reportHtml, setReportHtml] = useState<string | null>(null);
    const [reportPreviewError, setReportPreviewError] = useState("");

    // Hierarchy Filters
    const [divCode, setDivCode] = useState("");
    const [divDisplay, setDivDisplay] = useState("");
    const [deptCode, setDeptCode] = useState("");
    const [deptDisplay, setDeptDisplay] = useState("");
    const [sectionCode, setSectionCode] = useState("");
    const [sectionDisplay, setSectionDisplay] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [employeeDisplay, setEmployeeDisplay] = useState("");

    // New Inputs from Screenshot
    const [payMonth, setPayMonth] = useState<string>(currentMonth());
    const [payYear, setPayYear] = useState<string>(currentYear());
    const [source, setSource] = useState("Payroll");
    const [historyReport, setHistoryReport] = useState(false);
    const [reportType, setReportType] = useState("Employee Wise Cost");

    const loadDivisions = useCallback(async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(buildPayload(PARAM_DIVISION_LIST, loginid, { code1: companyCode }));
      return matches(data, q);
    }, [companyCode, loginid]);

    const loadDepartments = useCallback(async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(buildPayload(PARAM_DEPARTMENT_LIST, loginid, { code1: companyCode, code2: divCode || undefined }));
      return matches(data, q);
    }, [companyCode, loginid, divCode]);

    const loadSections = useCallback(async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(buildPayload(PARAM_SECTION_LIST, loginid, { code1: companyCode, code2: divCode || undefined, code3: deptCode || undefined }));
      return matches(data, q);
    }, [companyCode, loginid, divCode, deptCode]);

    const loadEmployees = useCallback(async (q?: string) => {
      if (!companyCode) return [];
      const data = await getDynamicLookup(buildPayload(PARAM_EMPLOYEE_LIST, loginid, { code1: companyCode, code2: divCode || undefined, code3: deptCode || undefined, code4: sectionCode || undefined }));
      return matches(data, q);
    }, [companyCode, loginid, divCode, deptCode, sectionCode]);

    const handleDivisionChange = (value: string, row: LookupRow | null) => {
      setDivCode(value); setDivDisplay(row ? `${val(row, "DIV_CODE")} ${val(row, "DIV_NAME")}`.trim() : "");
      setDeptCode(""); setDeptDisplay(""); setSectionCode(""); setSectionDisplay(""); setEmployeeId(""); setEmployeeDisplay("");
    };
    const handleDepartmentChange = (value: string, row: LookupRow | null) => {
      setDeptCode(value); setDeptDisplay(row ? `${val(row, "DEPT_CODE")} ${val(row, "DEPT_NAME")}`.trim() : "");
      setSectionCode(""); setSectionDisplay(""); setEmployeeId(""); setEmployeeDisplay("");
    };
    const handleSectionChange = (value: string, row: LookupRow | null) => {
      setSectionCode(value); setSectionDisplay(row ? `${val(row, "SECTION_CODE")} ${val(row, "SECTION_NAME")}`.trim() : "");
      setEmployeeId(""); setEmployeeDisplay("");
    };
    const handleEmployeeChange = (value: string, row: LookupRow | null) => {
      setEmployeeId(value);
      setEmployeeDisplay(row ? `${val(row, "employee_code", "EMPLOYEE_CODE")} ${val(row, "employee_name", "EMPLOYEE_NAME", "rpt_name", "RPT_NAME")}`.trim() : "");
    };

    const buildReportQuery = () => ({
      company_code: companyCode || "All",
      div_code: divCode || "All",
      dept_code: deptCode || "All",
      section_code: sectionCode || "All",
      employee_id: employeeId || "All",
      pay_month: payMonth,
      pay_year: payYear,
      source: source,
      history_report: historyReport ? "Y" : "N",
      report_type: reportType,
      print: "false",
    });

    const fetchReport = useCallback(async () => {
      setReportHtml(null); setReportPreviewError(""); setReportPreviewOpen(true); setLoading(true); setError("");
      try {
        const qs = new URLSearchParams(buildReportQuery() as any).toString();
        const res = await api.get(`${REPORT_URL}?${qs}`, { responseType: "text" });
        setReportHtml(res.data);
      } catch (e: any) {
        const message = e?.response?.data?.message ?? "Failed to load report.";
        setReportPreviewError(message); setError(message);
      } finally {
        setLoading(false);
      }
    }, [companyCode, divCode, deptCode, sectionCode, employeeId, payMonth, payYear, source, historyReport, reportType]);

    const handleRun = useCallback(async () => {
      if (!companyCode) { setError("Company is required"); return; }
      await fetchReport();
    }, [companyCode, fetchReport]);

    useImperativeHandle(ref, () => ({ run: handleRun, print: () => void handleRun() }));

    const handleReset = () => {
      setDivCode(""); setDivDisplay(""); setDeptCode(""); setDeptDisplay("");
      setSectionCode(""); setSectionDisplay(""); setEmployeeId(""); setEmployeeDisplay("");
      setPayMonth(currentMonth()); setPayYear(currentYear()); setSource("Payroll"); 
      setHistoryReport(false); setReportType("Employee Wise Cost"); setError("");
    };

    const closeReportPreview = () => { setReportPreviewOpen(false); setReportHtml(null); setReportPreviewError(""); };
    const handleOpenReportInNewWindow = () => {
      if (!reportHtml) return;
      const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    };

    const handleDownloadReportPdf = () => {
      if (!reportHtml) return;
      let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe"); iframe.id = PRINT_IFRAME_ID;
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      doc.open(); doc.write(reportHtml); doc.close();
      const doPrint = () => { try { iframe?.contentWindow?.focus(); iframe?.contentWindow?.print(); } catch {} };
      if (iframe.contentDocument?.readyState === "complete") setTimeout(doPrint, 300);
      else { iframe.onload = () => setTimeout(doPrint, 300); setTimeout(doPrint, 700); }
    };

    const labelFor = (v: string | undefined): string => v || "All";
    const BG = "#EEF5FD";

    return (
      <section className="freight-ui-standard freight-report-screen" style={{ width: "100%" }}>
        <div className="freight-report-card" style={{ width: "100%" }}>
          <style>{`
            .action-btn-primary:hover { background: #1e40af !important; }
            .field-row { background: ${BG}; border-radius: 8px; padding: 10px 12px; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>

          <div className="freight-report-titlebar">
            <h1>HR Reports - Employee Wise Cost</h1>
            <span className="freight-report-title-dot" aria-hidden="true" />
          </div>

          <ReportFilterHeader onClear={handleReset} label="Report Filters" />

          <div className="freight-report-summary grid grid-cols-5 gap-2 border-b bg-muted/10 p-3">
            <SummaryStripItem icon={Users} label="Division" value={labelFor(divDisplay)} />
            <SummaryStripItem icon={Filter} label="Department" value={labelFor(deptDisplay)} />
            <SummaryStripItem icon={Package} label="Section" value={labelFor(sectionDisplay)} />
            <SummaryStripItem icon={UserRound} label="Employee" value={labelFor(employeeDisplay)} />
            <SummaryStripItem icon={CalendarDays} label="Pay Period" value={`${payMonth}/${payYear}`} />
          </div>

          {error && (
            <div style={{ margin: "10px 12px", padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠️</span>{error}
              <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626" }}>✕</button>
            </div>
          )}

          <div style={{ padding: "0 12px" }}>
            {/* Row 1: Hierarchy */}
            <div className="field-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 6, width: "100%" }}>
              <FloatLabel label="Division" bgColor={BG}>
                <LookupField compact label="" value={divCode} displayValue={divDisplay || undefined} columns={[{ field: "DIV_CODE", header: "Code" }, { field: "DIV_NAME", header: "Name" }]} valueField="DIV_CODE" displayFields={["DIV_CODE", "DIV_NAME"]} loadOptions={loadDivisions} onChange={handleDivisionChange} placeholder="Select division" />
              </FloatLabel>
              <FloatLabel label="Department" bgColor={BG}>
                <LookupField compact label="" value={deptCode} displayValue={deptDisplay || undefined} columns={[{ field: "DEPT_CODE", header: "Code" }, { field: "DEPT_NAME", header: "Name" }]} valueField="DEPT_CODE" displayFields={["DEPT_CODE", "DEPT_NAME"]} loadOptions={loadDepartments} onChange={handleDepartmentChange} placeholder="Select department" />
              </FloatLabel>
              <FloatLabel label="Section" bgColor={BG}>
                <LookupField compact label="" value={sectionCode} displayValue={sectionDisplay || undefined} columns={[{ field: "SECTION_CODE", header: "Code" }, { field: "SECTION_NAME", header: "Name" }]} valueField="SECTION_CODE" displayFields={["SECTION_CODE", "SECTION_NAME"]} loadOptions={loadSections} onChange={handleSectionChange} placeholder="Select section" />
              </FloatLabel>
              <FloatLabel label="Employee Code" bgColor={BG}>
                <LookupField compact label="" value={employeeId} displayValue={employeeDisplay || undefined} columns={[{ field: "EMPLOYEE_CODE", header: "Code" }, { field: "RPT_NAME", header: "Name" }]} valueField="EMPLOYEE_ID" displayFields={["EMPLOYEE_CODE", "RPT_NAME"]} loadOptions={loadEmployees} onChange={handleEmployeeChange} placeholder="Select employee" />
              </FloatLabel>
            </div>

            {/* Row 2: Month/Year and Source, Radio Buttons */}
            <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 10, alignItems: "start" }}>
              
              {/* Left Column (Month/Year) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <FloatLabel label="Pay Month" bgColor={BG}>
                  <Select value={payMonth} onChange={(e) => setPayMonth(e.target.value)} style={{ fontSize: 12 }}>
                    {PAY_MONTHS.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
                  </Select>
                </FloatLabel>
                <FloatLabel label="Pay Year" bgColor={BG}>
                  <Input type="number" value={payYear} onChange={(e) => setPayYear(e.target.value)} />
                </FloatLabel>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", marginTop: 4 }}>
                  <input type="checkbox" checked={historyReport} onChange={(e) => setHistoryReport(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span>History Report</span>
                </label>
              </div>

              {/* Middle Column (Source) */}
              <div>
                <FloatLabel label="Source" bgColor={BG}>
                  <Select value={source} onChange={(e) => setSource(e.target.value)} style={{ fontSize: 12 }}>
                    {SOURCE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                  </Select>
                </FloatLabel>
              </div>

              {/* Right Column (Radio Buttons) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
                {REPORT_TYPES.map((type) => (
                  <label key={type} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="reportType"
                      value={type}
                      checked={reportType === type}
                      onChange={() => setReportType(type)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>

            </div>
          </div>

          <div className="freight-report-actions">
            <Button className="action-btn-primary" size="sm" onClick={() => void handleRun()} disabled={loading}>
              {loading ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 6 }} />Generating…</> : "Generate Report"}
            </Button>
          </div>
        </div>
        
        <NewReportDialog open={reportPreviewOpen} onClose={closeReportPreview} title={REPORT_TITLE} htmlContent={reportHtml} loading={loading} error={reportPreviewError || null} onOpenInNewWindow={handleOpenReportInNewWindow} onDownloadPdf={handleDownloadReportPdf} />
      </section>
    );
  },
);

export default HrEmployeeWiseCostReport;