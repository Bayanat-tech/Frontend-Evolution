"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import {
  MultiSelectField,
  type MultiSelectOption,
} from "../../../components/ui/MultiSelectField";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";

import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
// NOTE: add these two to api/transactions (copy the Employee Address List ones and point them at:
//   POST .../reports/getEmployeeSalaryNotProcessedReportHtml/html     -> returns HTML string
//   POST .../reports/getEmployeeSalaryNotProcessedReportExcel/excel   -> .xls download
import {
  getEmployeeSalaryNotProcessedReportHtml,
  getEmployeeSalaryNotProcessedReportExcelDownload,
} from "../../../api/transactions";
import { NewReportDialog } from "../../../components/new_report_format";

// ─── Lookup parameter names (same as Ticket Eligibility / Address List) ───────
// Parent codes go as code2 = division, code3 = department, code4 = section.
const LOOKUP = {
  division: "EDUCATION_QUALIFICATION_DIVISION_LIST",
  department: "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
  section: "EDUCATION_QUALIFICATION_MS_HR_SECTION",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Params {
  division: string;
  department: string;
  section: string;
  payMonth: number; // 0 = All
  payYear: number; // 0 = All
}

const ALL_SENTINEL = "__ALL__";
const ALL_MONTHS = 0;
const ALL_YEARS = 0;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_OPTIONS = [
  { label: "All", value: String(ALL_MONTHS) },
  ...MONTHS.map((m, i) => ({ label: m, value: String(i + 1) })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toApiCodeString = (selected: string[]): string => {
  if (selected.length === 0 || selected.includes(ALL_SENTINEL)) return "All";
  return selected.join(",");
};

/** Lookup rows -> MultiSelect options (upper/lower-case keys both work). */
const mapOptions = (rows: any, codeKeys: string[], nameKeys: string[]): MultiSelectOption[] =>
  (Array.isArray(rows) ? rows : [])
    .map((r: any) => {
      const lowerMap: Record<string, any> = {};
      Object.keys(r).forEach((k) => (lowerMap[k.toLowerCase()] = r[k]));
      const pick = (keys: string[]) => {
        for (const k of keys) {
          const v = lowerMap[k.toLowerCase()];
          if (v != null && String(v).trim()) return String(v).trim();
        }
        return "";
      };
      const code = pick(codeKeys);
      const name = pick(nameKeys);
      if (!code) return null;
      return { value: code, label: name ? `${code} - ${name}` : code } as MultiSelectOption;
    })
    .filter(Boolean) as MultiSelectOption[];

function buildParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = ""
) {
  return {
    parameter, loginid, code1: companyCode, code2, code3, code4,
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

/** Selected parent codes, or [""] (= no restriction) when nothing / "All" is selected. */
const parents = (codes: string[]): string[] =>
  codes.length === 0 || codes.includes(ALL_SENTINEL) ? [""] : codes;

/** The lookups take one parent code per call, so call once per parent combination and merge. */
async function loadMerged(
  parameter: string,
  loginId: string,
  companyCode: string,
  divs: string[] = [],
  depts: string[] = [],
  sects: string[] = []
): Promise<any[]> {
  const calls: Promise<any>[] = [];
  for (const d of parents(divs))
    for (const dp of parents(depts))
      for (const s of parents(sects))
        calls.push(getDynamicLookup(buildParams(parameter, loginId, companyCode, d, dp, s)));
  const results = await Promise.all(calls.slice(0, 30)); // safety cap
  return results.flatMap((r) => (Array.isArray(r) ? r : []));
}

/** When a parent changes, drop selected values that are no longer in the reloaded options. */
function usePrune(
  options: MultiSelectOption[],
  loading: boolean,
  value: string[],
  setValue: (v: string[]) => void
) {
  useEffect(() => {
    if (loading || !value.length) return;
    const valid = new Set(options.map((o) => o.value));
    const kept = value.filter((v) => v === ALL_SENTINEL || valid.has(v));
    if (kept.length !== value.length) setValue(kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, loading]);
}

/** Loads options for a MultiSelect; reloads when `deps` change. */
function useOptions(
  load: () => Promise<any>,
  codeKeys: string[],
  nameKeys: string[],
  deps: React.DependencyList
) {
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await load();
        if (!alive) return;
        const seen = new Set<string>();
        const opts = mapOptions(rows, codeKeys, nameKeys).filter((o) =>
          seen.has(o.value) ? false : (seen.add(o.value), true)
        );
        if (!opts.length) {
          console.debug(
            "[lookup] 0 options. rows:",
            Array.isArray(rows) ? rows.length : rows,
            "columns:",
            Array.isArray(rows) && rows[0] ? Object.keys(rows[0]) : []
          );
        }
        setOptions(opts);
      } catch (err) {
        console.error("[lookup] failed to load options:", err);
        if (alive) setOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { options, loading };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeSalaryNotProcessedPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  const now = new Date();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [divisions, setDivisions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [payMonth, setPayMonth] = useState<string>(String(now.getMonth() + 1));
  const [payYear, setPayYear] = useState<string>(String(now.getFullYear()));

  // ── Lookups ───────────────────────────────────────────────────────────────
  const divKey = divisions.join(",");
  const deptKey = departments.join(",");

  const divisionLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.division, loginId, companyCode)),
    ["div_code"], ["div_name"], [loginId, companyCode]
  );

  // Department <- Division
  const departmentLookup = useOptions(
    () => loadMerged(LOOKUP.department, loginId, companyCode, divisions),
    ["dept_code"], ["dept_name"], [loginId, companyCode, divKey]
  );

  // Section <- Division, Department
  const sectionLookup = useOptions(
    () => loadMerged(LOOKUP.section, loginId, companyCode, divisions, departments),
    ["section_code"], ["section_name"], [loginId, companyCode, divKey, deptKey]
  );

  usePrune(departmentLookup.options, departmentLookup.loading, departments, setDepartments);
  usePrune(sectionLookup.options, sectionLookup.loading, sections, setSections);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Select filters and run the report.");

  const lastParamsRef = useRef<Params | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  // Year is optional: blank = All years
  const yearNum = payYear.trim() === "" ? ALL_YEARS : Number(payYear);
  const monthNum = Number(payMonth);
  const inputValid =
    (monthNum === ALL_MONTHS || (monthNum >= 1 && monthNum <= 12)) &&
    (yearNum === ALL_YEARS || (Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= 2200));

  const periodText = `${monthNum === ALL_MONTHS ? "All" : MONTHS[monthNum - 1]} ${
    yearNum === ALL_YEARS ? "All" : yearNum
  }`;

  const buildPayload = (p: Params) => ({
    parameter: "Hr_Report_EMP_SALARY_NOT_PROCESSED",
    loginid: loginId,
    code1: companyCode,
    code2: p.division,
    code3: p.department,
    code4: p.section,
    number1: p.payMonth, // :pay_month (0 = All)
    number2: p.payYear, // :pay_year  (0 = All)
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
        const html = await getEmployeeSalaryNotProcessedReportHtml(buildPayload(p));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loginId, companyCode]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!inputValid) return;
    fetchReport({
      division: toApiCodeString(divisions),
      department: toApiCodeString(departments),
      section: toApiCodeString(sections),
      payMonth: monthNum,
      payYear: yearNum,
    });
  };

  const handleClearAll = () => {
    setDivisions([]);
    setDepartments([]);
    setSections([]);
    setPayMonth(String(now.getMonth() + 1));
    setPayYear(String(now.getFullYear()));
    setError("");
    setMessage("Select filters and run the report.");
  };

  const handleExcel = async () => {
    if (!lastParamsRef.current) return;
    setExporting(true);
    try {
      await getEmployeeSalaryNotProcessedReportExcelDownload(buildPayload(lastParamsRef.current));
    } catch (err) {
      console.error("Excel export error:", err);
      setError("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

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

  const handleDownloadPdf = () => {
    if (!reportHtml) return;
    const PRINT_IFRAME_ID = "emp-salary-not-processed-print-iframe";
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
        <div className="freight-report-titlebar">
          <h1>HR Reports - Payroll Processing Fail</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={handleClearAll} />

        {/* Row 1: Division / Department / Section */}
        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          <MultiSelectField
            className="freight-report-multi-select"
            label="Division"
            options={divisionLookup.options}
            loading={divisionLookup.loading}
            value={divisions}
            onChange={setDivisions}
          />
          <MultiSelectField
            className="freight-report-multi-select"
            label="Department"
            options={departmentLookup.options}
            loading={departmentLookup.loading}
            value={departments}
            onChange={setDepartments}
          />
          <MultiSelectField
            className="freight-report-multi-select"
            label="Section"
            options={sectionLookup.options}
            loading={sectionLookup.loading}
            value={sections}
            onChange={setSections}
          />
        </div>

        {/* Row 2: Pay Month / Pay Year */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Pay Month">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={payMonth}
              onChange={(e) => setPayMonth(e.target.value)}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pay Year">
            <input
              type="number"
              min={1900}
              max={2200}
              placeholder="All"
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={payYear}
              onChange={(e) => setPayYear(e.target.value)}
            />
          </Field>
        </div>

        {!inputValid && (
          <p className="px-3 pb-2 text-xs text-destructive">Enter a valid Pay Month and Pay Year.</p>
        )}

        <div className="freight-report-actions flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !inputValid}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{" "}
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>

        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
        {error && !previewOpen ? <p className="px-3 pb-3 text-sm text-destructive">{error}</p> : null}
      </div>

      <NewReportDialog
        open={previewOpen}
        onClose={closePreview}
        title="Employee Payroll Process Fail List"
        htmlContent={reportHtml}
        loading={loading}
        error={error || null}
        meta={{
          companyName: companyCode,
          user: loginId,
          period: periodText,
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