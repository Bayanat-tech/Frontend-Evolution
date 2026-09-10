"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Building2, CalendarDays, Loader2, Search, Users } from "lucide-react";

import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup } from "../../../api/lookups";
import {
  getVisaExpiryReportHtml,
  getVisaExpiryReportExcelDownload,
} from "../../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LookupOption {
  code: string;
  name: string;
}

type EmployeeFilter = "A" | "ALL";

// ─── Date helpers ───────────────────────────────────────────────────────────────

const getToday = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
};

const getNextMonth = (): string => {
  const n = new Date();
  n.setMonth(n.getMonth() + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
};

function toDisplayDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

// ─── Generic lookup fetcher ───────────────────────────────────────────────────

const fetchLookup = async (
  parameter: string,
  loginId: string,
  companyCode: string,
  codeKey: string,
  nameKey: string,
  extraNameKey?: string
): Promise<LookupOption[]> => {
  try {
    const res = await getDynamicLookup({
      parameter,
      loginid: loginId,
      code1: companyCode,
      code2: "", code3: "", code4: "",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    });

    return Array.isArray(res)
      ? res
          .filter((x: any) => x[codeKey] != null && String(x[codeKey]).trim() !== "")
          .map((x: any) => ({
            code: String(x[codeKey]),
            name: extraNameKey && x[extraNameKey]
              ? `${x[nameKey] ?? ""} (${x[extraNameKey]})`
              : x[nameKey] ?? "",
          }))
      : [];
  } catch (err) {
    console.error(`[${parameter}] Fetch error:`, err);
    return [];
  }
};

// ─── Small presentational bits (mirrors ProfitLossPage look) ─────────────────

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      <span>
        {label} {required && <span className="text-destructive normal-case">*</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryStripItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 shadow-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={16} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
        <div className="truncate text-[13px] font-semibold text-slate-800" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

function SummaryBadge({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-1.5 ${strong ? "border-primary/20 bg-primary/10 text-primary" : "bg-muted/40 text-foreground"}`}>
      <div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

// ─── Searchable popover select (same interaction as PLSummaryPage's SingleSelectLookup) ──

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  loading,
  placeholder = "All",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: LookupOption[];
  loading?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? options.filter((o) => o.code.toLowerCase().includes(term) || o.name.toLowerCase().includes(term))
    : options;

  const selected = options.find((o) => o.code === value);
  const displayText = !value ? placeholder : selected ? `${selected.code} - ${selected.name}` : value;

  return (
    <Field label={label} required={required}>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          disabled={loading}
          className="flex h-8 w-full items-center justify-between rounded-md border bg-background px-2 text-left text-sm normal-case text-foreground shadow-sm disabled:opacity-50"
        >
          <span className={`truncate ${value ? "text-foreground" : "text-muted-foreground"}`}>{displayText}</span>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border bg-white shadow-lg">
            <div className="border-b p-1.5">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-7 w-full rounded-md border bg-background px-2 text-xs normal-case text-foreground shadow-sm"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <label
                className={`flex cursor-pointer items-center gap-2 border-b px-3 py-1.5 text-sm normal-case font-semibold ${
                  !value ? "bg-primary/5 text-primary" : "text-foreground"
                }`}
              >
                <input
                  type="radio"
                  checked={!value}
                  onChange={() => {
                    onChange("");
                    setOpen(false);
                    setSearch("");
                  }}
                  className="accent-primary"
                />
                {placeholder}
              </label>

              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm normal-case text-muted-foreground">No results found</div>
              ) : (
                filtered.map((o) => (
                  <label
                    key={o.code}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm normal-case ${
                      value === o.code ? "bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      checked={value === o.code}
                      onChange={() => {
                        onChange(o.code);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="accent-primary"
                    />
                    <span className="truncate">
                      <span className="font-medium">{o.code}</span>
                      <span className="ml-1.5 text-muted-foreground">{o.name}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VisaExpiryListingPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Lookup options ────────────────────────────────────────────────────────
  const [divisionOptions, setDivisionOptions] = useState<LookupOption[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<LookupOption[]>([]);
  const [sectionOptions, setSectionOptions] = useState<LookupOption[]>([]);
  const [gradeOptions, setGradeOptions] = useState<LookupOption[]>([]);
  const [designationOptions, setDesignationOptions] = useState<LookupOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<LookupOption[]>([]);
  const [sponsorOptions, setSponsorOptions] = useState<LookupOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // ── Selected filter values (plain codes, matching SearchableSelect) ──────
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [grade, setGrade] = useState("");
  const [designation, setDesignation] = useState("");
  const [employee, setEmployee] = useState("");
  const [sponsor, setSponsor] = useState("");

  // ── Date + radio ──────────────────────────────────────────────────────────
  const [visaExpiryFrom, setVisaExpiryFrom] = useState(getToday());
  const [visaExpiryTo, setVisaExpiryTo] = useState(getNextMonth());
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("A");

  // ── Report / preview dialog state ────────────────────────────────────────
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [message, setMessage] = useState("Select filters and generate the report.");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [exporting, setExporting] = useState(false);

  const canGenerate = Boolean(visaExpiryFrom && visaExpiryTo);
  const employeeFilterLabel = employeeFilter === "A" ? "Active Employees" : "All Employees";
  const dialogTitle = "Visa Expiry Report";
  const divisionName = divisionOptions.find((d) => d.code === division)?.name;

  // ── Fetch all lookups on mount ───────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLookupsLoading(true);
      try {
        const [div, dept, sec, grd, desig, emp, spon] = await Promise.all([
          fetchLookup("AC_ASSETS_DEPRECIATION_DIVISION_LIST", loginId, companyCode, "div_code", "div_name"),
          fetchLookup("HR_CAM_DEPARTMENT_DEPTCODE", loginId, companyCode, "dept_code", "dept_short_name"),
          fetchLookup("AC_ASSETS_SECTION", loginId, companyCode, "section_code", "section_name"),
          fetchLookup("AC_ASSETS_HR_GRADE_LIST", loginId, companyCode, "grade_code", "grade_name"),
          fetchLookup("MST_HR_MS_HR_DESIGNATION_LIST", loginId, companyCode, "desg_code", "desg_name"),
          fetchLookup("AC_ASSETS_HR_EMPLOYEE_LIST", loginId, companyCode, "emp_id", "emp_name"),
          fetchLookup("AC_ASSETS_HR_SPONSOR", loginId, companyCode, "sponsor_name", "sponsor_short_name"),
        ]);
        setDivisionOptions(div);
        setDepartmentOptions(dept);
        setSectionOptions(sec);
        setGradeOptions(grd);
        setDesignationOptions(desig);
        setEmployeeOptions(emp);
        setSponsorOptions(spon);
      } finally {
        setLookupsLoading(false);
      }
    };
    load();
  }, [companyCode, loginId]);

  // ── Keep the dialog's blob URL in sync with the generated report HTML ────
  useEffect(() => {
    if (!previewOpen) return;
    if (reportHtml === null || reportHtml === undefined) return;

    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) window.URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, reportHtml]);

  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const buildPayload = () => ({
    parameter: "Hr_Report_VISA_EXPIRY_REPORT",
    loginid: loginId,
    code1: companyCode,
    code2: division || "",
    code3: department || "",
    code4: section || "",
    code5: grade || "",
    code6: designation || "",
    code7: employee || "",
    code8: sponsor || "",
    code9: employeeFilter,
    date1: visaExpiryFrom,
    date2: visaExpiryTo,
  });

  const handleGenerate = async () => {
    if (!canGenerate) {
      setReportError("Please select both Visa Expiry From and To dates.");
      return;
    }

    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    setMessage("");

    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewOpen(true);

    try {
      const html = await getVisaExpiryReportHtml(buildPayload());
      setReportHtml(html);
      setMessage("Report generated successfully.");
    } catch (err: any) {
      const errorMessage = err?.message ?? "Failed to generate report";
      setReportError(errorMessage);
      setMessage(errorMessage);
    } finally {
      setReportLoading(false);
    }
  };

  const handleReset = () => {
    setDivision("");
    setDepartment("");
    setSection("");
    setGrade("");
    setDesignation("");
    setEmployee("");
    setSponsor("");
    setVisaExpiryFrom(getToday());
    setVisaExpiryTo(getNextMonth());
    setEmployeeFilter("A");
    setReportError(null);
    setMessage("Select filters and generate the report.");
    closePreview();
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewOpen(false);
    setPreviewUrl("");
    setReportHtml(null);
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      await getVisaExpiryReportExcelDownload(buildPayload());
    } catch (err: any) {
      setReportError(err?.message ?? "Failed to download Excel");
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>{dialogTitle}</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
          <div className="freight-report-title-actions flex flex-wrap items-center gap-2">
            {division && <SummaryBadge label="Division" value={division} strong />}
          </div>
        </div>

        <ReportFilterHeader onClear={handleReset} />

        <div className="freight-report-summary grid grid-cols-2 gap-2 border-b bg-muted/10 p-3 md:grid-cols-3">
          <SummaryStripItem
            icon={CalendarDays}
            label="Visa Expiry Period"
            value={`${toDisplayDate(visaExpiryFrom) || "Start"} – ${toDisplayDate(visaExpiryTo) || "End"}`}
          />
          <SummaryStripItem
            icon={Building2}
            label="Division"
            value={division ? `${division}${divisionName ? ` - ${divisionName}` : ""}` : "All divisions"}
          />
          <SummaryStripItem icon={Users} label="Employee Type" value={employeeFilterLabel} />
        </div>

        <div className="freight-report-fields grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <SearchableSelect
            label="Division"
            value={division}
            onChange={setDivision}
            options={divisionOptions}
            loading={lookupsLoading}
            placeholder="All Divisions"
          />
          <SearchableSelect
            label="Department"
            value={department}
            onChange={setDepartment}
            options={departmentOptions}
            loading={lookupsLoading}
            placeholder="All Departments"
          />
          <SearchableSelect
            label="Section"
            value={section}
            onChange={setSection}
            options={sectionOptions}
            loading={lookupsLoading}
            placeholder="All Sections"
          />
          <SearchableSelect
            label="Grade"
            value={grade}
            onChange={setGrade}
            options={gradeOptions}
            loading={lookupsLoading}
            placeholder="All Grades"
          />
          <SearchableSelect
            label="Employee Code"
            value={employee}
            onChange={setEmployee}
            options={employeeOptions}
            loading={lookupsLoading}
            placeholder="All Employees"
          />
          <SearchableSelect
            label="Sponsor"
            value={sponsor}
            onChange={setSponsor}
            options={sponsorOptions}
            loading={lookupsLoading}
            placeholder="All Sponsors"
          />
          <SearchableSelect
            label="Designation"
            value={designation}
            onChange={setDesignation}
            options={designationOptions}
            loading={lookupsLoading}
            placeholder="All Designations"
          />

          <Field label="From" required>
            <input
              type="date"
              value={visaExpiryFrom}
              max={visaExpiryTo || undefined}
              onChange={(e) => setVisaExpiryFrom(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm normal-case text-foreground shadow-sm"
            />
          </Field>

          <Field label="To" required>
            <input
              type="date"
              value={visaExpiryTo}
              min={visaExpiryFrom || undefined}
              onChange={(e) => setVisaExpiryTo(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm normal-case text-foreground shadow-sm"
            />
          </Field>

          <Field label="Employee Type">
            <div className="flex h-8 items-center gap-4 normal-case">
              <label className="flex items-center gap-1.5 text-sm font-medium normal-case text-foreground">
                <input
                  type="radio"
                  name="empFilter"
                  value="A"
                  checked={employeeFilter === "A"}
                  onChange={() => setEmployeeFilter("A")}
                  className="accent-primary"
                />
                Active
              </label>
              <label className="flex items-center gap-1.5 text-sm font-medium normal-case text-foreground">
                <input
                  type="radio"
                  name="empFilter"
                  value="ALL"
                  checked={employeeFilter === "ALL"}
                  onChange={() => setEmployeeFilter("ALL")}
                  className="accent-primary"
                />
                All
              </label>
            </div>
          </Field>
        </div>

        <div className="freight-report-actions">
          <PrimaryButton onClick={handleGenerate} disabled={!canGenerate || reportLoading}>
            {reportLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {reportLoading ? "Generating..." : "Generate Report"}
          </PrimaryButton>
        </div>
        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
        {reportError && !previewOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive">{reportError}</p>
        ) : null}
      </div>

      {previewOpen && (
        <ReportPreviewDialog
          title={dialogTitle}
          pdfUrl={previewUrl}
          error={reportError || undefined}
          exporting={exporting}
          onExcel={handleExcel}
          onClose={closePreview}
          onDownload={() => {}}
          downloadName={`${dialogTitle.replace(/[^a-z0-9]+/gi, "_")}.html`}
        />
      )}
    </section>
  );
}