"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { Button } from "../../../components/ui/Button";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";

import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
// NOTE: add these two to api/transactions (copy the Visa Expiry ones and point
// them at the new endpoints – see the controller file for the handler names).

import { NewReportDialog } from "../../../components/new_report_format";
import { getEmployeeAssessmentReportExcelDownload, getEmployeeAssessmentReportHtml } from "../../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LookupOption {
  code: string;
  name: string;
}

type EmployeeFilter = "A" | "ALL";

interface Params {
  division: string;
  department: string;
  section: string;
  employee: string;
  employeeFilter: EmployeeFilter;
  periodFrom: string;
  periodTo: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const getYearStart = (): string => `${new Date().getFullYear()}-01-01`;
const getYearEnd = (): string => `${new Date().getFullYear()}-12-31`;

const toDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "All";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

// ─── Native select ────────────────────────────────────────────────────────────

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Generic lookup fetcher ───────────────────────────────────────────────────

const fetchLookup = async (
  parameter: string,
  loginId: string,
  companyCode: string,
  codeKey: string,
  nameKey: string
): Promise<LookupOption[]> => {
  try {
    const res = await getDynamicLookup({
      parameter,
      loginid: loginId,
      code1: companyCode,
      code2: "",
      code3: "",
      code4: "",
      number1: 0,
      number2: 0,
      number3: 0,
      number4: 0,
      date1: null,
      date2: null,
      date3: null,
      date4: null,
    });

    return Array.isArray(res)
      ? res
          .filter(
            (x: any) => x[codeKey] != null && String(x[codeKey]).trim() !== ""
          )
          .map((x: any) => ({
            code: String(x[codeKey]),
            name: x[nameKey] ?? "",
          }))
      : [];
  } catch (err) {
    console.error(`[${parameter}] Fetch error:`, err);
    return [];
  }
};

const withAll = (opts: LookupOption[]) => [
  { label: "All", value: "" },
  ...opts.map((o) => ({ label: `${o.code} - ${o.name}`, value: o.code })),
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeAssessmentReportPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Lookup options (same lookups as Visa Expiry) ──────────────────────────
  const [divisionOptions, setDivisionOptions] = useState<LookupOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<LookupOption[]>([]);
  const [sectionOptions, setSectionOptions] = useState<LookupOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<LookupOption[]>([]);

  // ── Selected filter values ────────────────────────────────────────────────
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [employee, setEmployee] = useState("");

  // ── Financial year + employee type ────────────────────────────────────────
  const [periodFrom, setPeriodFrom] = useState(getYearStart());
  const [periodTo, setPeriodTo] = useState(getYearEnd());
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("A");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Select filters and run the report.");

  const lastParamsRef = useRef<Params | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const dateRangeValid = !periodFrom || !periodTo || periodFrom <= periodTo;

  // ── Fetch lookups on mount ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [div, dept, sec, emp] = await Promise.all([
        fetchLookup(
          "AC_ASSETS_DEPRECIATION_DIVISION_LIST",
          loginId,
          companyCode,
          "div_code",
          "div_name"
        ),
        fetchLookup(
          "HR_CAM_DEPARTMENT_DEPTCODE",
          loginId,
          companyCode,
          "dept_code",
          "dept_short_name"
        ),
        fetchLookup(
          "AC_ASSETS_SECTION",
          loginId,
          companyCode,
          "section_code",
          "section_name"
        ),
        fetchLookup(
          "AC_ASSETS_HR_EMPLOYEE_LIST",
          loginId,
          companyCode,
          "emp_id",
          "emp_name"
        ),
      ]);
      setDivisionOptions(div);
      setDepartmentOptions(dept);
      setSectionOptions(sec);
      setEmployeeOptions(emp);
    };
    load();
  }, [loginId, companyCode]);

  const buildPayload = (p: Params) => ({
    parameter: "Hr_Report_EMP_ASSESSMENT_REPORT",
    loginid: loginId,
    code1: companyCode,
    code2: p.division,
    code3: p.department,
    code4: p.section,
    code5: p.employee,
    code9: p.employeeFilter,
    date1: p.periodFrom,
    date2: p.periodTo,
  });

  // ── Fetch report HTML → NewReportDialog ───────────────────────────────────
  const fetchReport = useCallback(
    async (p: Params) => {
      setLoading(true);
      setError("");
      setMessage("");
      lastParamsRef.current = p;

      setReportHtml(null);
      setPreviewOpen(true);

      try {
        const html = await getEmployeeAssessmentReportHtml({
          parameter: "Hr_Report_EMP_ASSESSMENT_REPORT",
          loginid: loginId,
          code1: companyCode,
          code2: p.division,
          code3: p.department,
          code4: p.section,
          code5: p.employee,
          code9: p.employeeFilter,
          date1: p.periodFrom,
          date2: p.periodTo,
        });

        setReportHtml(html);
        setMessage("Report generated successfully.");
      } catch (err: any) {
        const msg = err?.message ?? "Failed to load report. Please try again.";
        setError(msg);
        setMessage(msg);
      } finally {
        setLoading(false);
      }
    },
    [loginId, companyCode]
  );

  // ── Clear All ─────────────────────────────────────────────────────────────
  const handleClearAll = () => {
    setDivision("");
    setDepartment("");
    setSection("");
    setEmployee("");
    setPeriodFrom(getYearStart());
    setPeriodTo(getYearEnd());
    setEmployeeFilter("A");
    setError("");
    setMessage("Select filters and run the report.");
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!periodFrom || !periodTo) {
      setError("Please select both Financial Year From and To dates.");
      return;
    }
    if (!dateRangeValid) return;

    fetchReport({
      division,
      department,
      section,
      employee,
      employeeFilter,
      periodFrom,
      periodTo,
    });
  };

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExcel = async () => {
    if (!lastParamsRef.current) return;
    setExporting(true);
    try {
      await getEmployeeAssessmentReportExcelDownload(
        buildPayload(lastParamsRef.current)
      );
    } catch (err) {
      console.error("Excel export error:", err);
      setError("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // ── Open in new tab ───────────────────────────────────────────────────────
  const handleOpenInNewWindow = () => {
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

  // ── Print / Save as PDF ───────────────────────────────────────────────────
  const handleDownloadPdf = () => {
    if (!reportHtml) return;
    const PRINT_IFRAME_ID = "emp-assessment-print-iframe";
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

  const closePreview = () => {
    setPreviewOpen(false);
    setReportHtml(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        {/* ── Title bar ─────────────────────────────────────────────────── */}
        <div className="freight-report-titlebar">
          <h1>Employee Assessment Report</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={handleClearAll} />

        {/* ── Row 1: Division / Department / Section / Employee ─────────── */}
        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Division">
            <Select
              value={division}
              onChange={setDivision}
              options={withAll(divisionOptions)}
            />
          </Field>

          <Field label="Department">
            <Select
              value={department}
              onChange={setDepartment}
              options={withAll(departmentOptions)}
            />
          </Field>

          <Field label="Section">
            <Select
              value={section}
              onChange={setSection}
              options={withAll(sectionOptions)}
            />
          </Field>

          <Field label="Employee Code">
            <Select
              value={employee}
              onChange={setEmployee}
              options={withAll(employeeOptions)}
            />
          </Field>
        </div>

        {/* ── Row 2: Financial Year From / To / Employee Type ───────────── */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Financial Year From">
            <BiscDatePicker
              value={periodFrom}
              onChange={(value) => {
                if (!periodTo || value <= periodTo) setPeriodFrom(value);
              }}
            />
          </Field>

          <Field label="Financial Year To">
            <BiscDatePicker
              value={periodTo}
              onChange={(value) => {
                if (!periodFrom || value >= periodFrom) setPeriodTo(value);
              }}
            />
          </Field>

          <Field label="Employee Type">
            <Select
              value={employeeFilter}
              onChange={(v) => setEmployeeFilter(v as EmployeeFilter)}
              options={[
                { label: "Active Employees", value: "A" },
                { label: "All Employees", value: "ALL" },
              ]}
            />
          </Field>
        </div>

        {!dateRangeValid && (
          <p className="px-3 pb-2 text-xs text-destructive">
            Financial Year From must be on or before Financial Year To.
          </p>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="freight-report-actions flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={loading || !dateRangeValid}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}{" "}
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>

        {message ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
        {error && !previewOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <NewReportDialog
        open={previewOpen}
        onClose={closePreview}
        title="Employee Assessment Report"
        htmlContent={reportHtml}
        loading={loading}
        error={error || null}
        meta={{
          companyName: companyCode,
          user: loginId,
          period: `${toDisplayDate(periodFrom)} - ${toDisplayDate(periodTo)}`,
          status: employeeFilter === "A" ? "Active Employees" : "All Employees",
          generatedAt: new Date().toLocaleString(),
        }}
        onExportExcel={handleExcel}
        exportingExcel={exporting}
        onOpenInNewWindow={handleOpenInNewWindow}
        onDownloadPdf={handleDownloadPdf}
      />
    </section>
  );
}