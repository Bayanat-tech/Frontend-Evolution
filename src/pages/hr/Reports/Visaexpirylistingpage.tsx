"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { Button } from "../../../components/ui/Button";
import {
  MultiSelectField,
  type MultiSelectOption,
} from "../../../components/ui/MultiSelectField";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";

import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import {
  getVisaExpiryReportHtml,
  getVisaExpiryReportExcelDownload,
} from "../../../api/transactions";
import { NewReportDialog } from "../../../components/new_report_format";

// ─── Lookup parameter names + column keys ─────────────────────────────────────

const LOOKUP = {
  division:    { parameter: "AC_ASSETS_DEPRECIATION_DIVISION_LIST", code: "div_code",     name: "div_name" },
  department:  { parameter: "HR_CAM_DEPARTMENT_DEPTCODE",           code: "dept_code",    name: "dept_name" },
  section:     { parameter: "AC_ASSETS_SECTION",                    code: "section_code", name: "section_name" },
  grade:       { parameter: "AC_ASSETS_HR_GRADE_LIST",              code: "grade_code",   name: "grade_name" },
  designation: { parameter: "MST_HR_MS_HR_DESIGNATION_LIST",        code: "desg_code",    name: "desg_name" },
  employee:    { parameter: "EDUCATION_QUALIFICATION_EMPLOYEE_LIST",           code: "employee_code",       name: "employee_name" },
  sponsor:     { parameter: "AC_ASSETS_HR_SPONSOR",                 code: "sponsor_name", name: "sponsor_short_name" },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeFilter = "A" | "ALL";

interface Params {
  division: string;
  department: string;
  section: string;
  grade: string;
  designation: string;
  employee: string;
  sponsor: string;
  employeeFilter: EmployeeFilter;
  visaExpiryFrom: string;
  visaExpiryTo: string;
}

const ALL_SENTINEL = "__ALL__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Selected values -> "A,B,C" or "All" (nothing / All selected). */
const toApiCodeString = (selected: string[]): string => {
  if (selected.length === 0 || selected.includes(ALL_SENTINEL)) return "All";
  return selected.join(",");
};

const pad = (n: number) => String(n).padStart(2, "0");

const toIso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Default "From": 6 months back, so recently expired visas are visible. */
const getDefaultFrom = (): string => {
  const n = new Date();
  n.setMonth(n.getMonth() - 6);
  return toIso(n);
};

/** Default "To": 1 year ahead. */
const getDefaultTo = (): string => {
  const n = new Date();
  n.setFullYear(n.getFullYear() + 1);
  return toIso(n);
};

const toDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "All";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

/** Turns lookup rows into MultiSelect options (tolerant of upper/lower-case keys). */
const mapOptions = (rows: any, codeKey: string, nameKey: string): MultiSelectOption[] => {
  const seen = new Set<string>();
  return (Array.isArray(rows) ? rows : [])
    .map((r: any) => {
      const pick = (k: string) => {
        const v = r[k] ?? r[k.toUpperCase()];
        return v != null && String(v).trim() ? String(v).trim() : "";
      };
      const code = pick(codeKey);
      const name = pick(nameKey);
      if (!code || seen.has(code)) return null;
      seen.add(code);
      return { value: code, label: name && name !== code ? `${code} - ${name}` : code } as MultiSelectOption;
    })
    .filter(Boolean) as MultiSelectOption[];
};

/** Loads the options of one lookup for a MultiSelect. */
function useLookupOptions(
  cfg: { parameter: string; code: string; name: string },
  loginId: string,
  companyCode: string
) {
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await getDynamicLookup({
          parameter: cfg.parameter,
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
        if (alive) setOptions(mapOptions(rows, cfg.code, cfg.name));
      } catch (err) {
        console.error(`[${cfg.parameter}] Fetch error:`, err);
        if (alive) setOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginId, companyCode]);

  return { options, loading };
}

// ─── Field wrapper / native select ────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VisaExpiryListingPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Lookups ───────────────────────────────────────────────────────────────
  const divisionLookup    = useLookupOptions(LOOKUP.division,    loginId, companyCode);
  const departmentLookup  = useLookupOptions(LOOKUP.department,  loginId, companyCode);
  const sectionLookup     = useLookupOptions(LOOKUP.section,     loginId, companyCode);
  const gradeLookup       = useLookupOptions(LOOKUP.grade,       loginId, companyCode);
  const designationLookup = useLookupOptions(LOOKUP.designation, loginId, companyCode);
  const employeeLookup    = useLookupOptions(LOOKUP.employee,    loginId, companyCode);
  const sponsorLookup     = useLookupOptions(LOOKUP.sponsor,     loginId, companyCode);

  // ── Selected filter values (multi-select) ─────────────────────────────────
  const [divisions, setDivisions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [sponsors, setSponsors] = useState<string[]>([]);

  // ── Date + employee type ──────────────────────────────────────────────────
  const [visaExpiryFrom, setVisaExpiryFrom] = useState(getDefaultFrom());
  const [visaExpiryTo, setVisaExpiryTo] = useState(getDefaultTo());
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("A");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Select filters and run the report.");

  const lastParamsRef = useRef<Params | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const dateRangeValid =
    !visaExpiryFrom || !visaExpiryTo || visaExpiryFrom <= visaExpiryTo;

  const buildPayload = (p: Params) => ({
    parameter: "Hr_Report_VISA_EXPIRY_REPORT",
    loginid: loginId,
    code1: companyCode,
    code2: p.division,
    code3: p.department,
    code4: p.section,
    code5: p.grade,
    code6: p.designation,
    code7: p.employee,
    code8: p.sponsor,
    code9: p.employeeFilter,
    date1: p.visaExpiryFrom,
    date2: p.visaExpiryTo,
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
        const html = await getVisaExpiryReportHtml(buildPayload(p));
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
  const handleClearAll = () => {
    setDivisions([]);
    setDepartments([]);
    setSections([]);
    setGrades([]);
    setDesignations([]);
    setEmployees([]);
    setSponsors([]);
    setVisaExpiryFrom(getDefaultFrom());
    setVisaExpiryTo(getDefaultTo());
    setEmployeeFilter("A");
    setError("");
    setMessage("Select filters and run the report.");
  };

  const handleGenerate = () => {
    if (!visaExpiryFrom || !visaExpiryTo) {
      setError("Please select both Visa Expiry From and To dates.");
      return;
    }
    if (!dateRangeValid) return;

    fetchReport({
      division: toApiCodeString(divisions),
      department: toApiCodeString(departments),
      section: toApiCodeString(sections),
      grade: toApiCodeString(grades),
      designation: toApiCodeString(designations),
      employee: toApiCodeString(employees),
      sponsor: toApiCodeString(sponsors),
      employeeFilter,
      visaExpiryFrom,
      visaExpiryTo,
    });
  };

  const handleExcel = async () => {
    if (!lastParamsRef.current) return;
    setExporting(true);
    try {
      await getVisaExpiryReportExcelDownload(buildPayload(lastParamsRef.current));
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
    const PRINT_IFRAME_ID = "visa-expiry-print-iframe";
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
          <h1>Visa Expiry Report</h1>
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

        {/* Row 2: Grade / Designation / Employee */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
          <MultiSelectField
            className="freight-report-multi-select"
            label="Grade"
            options={gradeLookup.options}
            loading={gradeLookup.loading}
            value={grades}
            onChange={setGrades}
          />
          <MultiSelectField
            className="freight-report-multi-select"
            label="Designation"
            options={designationLookup.options}
            loading={designationLookup.loading}
            value={designations}
            onChange={setDesignations}
          />
          <MultiSelectField
            className="freight-report-multi-select"
            label="Employee"
            options={employeeLookup.options}
            loading={employeeLookup.loading}
            value={employees}
            onChange={setEmployees}
          />
        </div>

        {/* Row 3: Sponsor / Employee Type */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
          <MultiSelectField
            className="freight-report-multi-select"
            label="Sponsor"
            options={sponsorLookup.options}
            loading={sponsorLookup.loading}
            value={sponsors}
            onChange={setSponsors}
          />

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

        {/* Row 4: Visa Expiry From / To */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Visa Expiry From">
            <BiscDatePicker
              value={visaExpiryFrom}
              onChange={(value) => {
                if (!visaExpiryTo || value <= visaExpiryTo) setVisaExpiryFrom(value);
              }}
            />
          </Field>

          <Field label="Visa Expiry To">
            <BiscDatePicker
              value={visaExpiryTo}
              onChange={(value) => {
                if (!visaExpiryFrom || value >= visaExpiryFrom) setVisaExpiryTo(value);
              }}
            />
          </Field>
        </div>

        {!dateRangeValid && (
          <p className="px-3 pb-2 text-xs text-destructive">
            Visa Expiry From must be on or before Visa Expiry To.
          </p>
        )}

        <div className="freight-report-actions flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !dateRangeValid}>
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
        title="Visa Expiry Report"
        htmlContent={reportHtml}
        loading={loading}
        error={error || null}
        meta={{
          companyName: companyCode,
          user: loginId,
          period: `${toDisplayDate(visaExpiryFrom)} - ${toDisplayDate(visaExpiryTo)}`,
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