"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { Button } from "../../../components/ui/Button";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { ReportPreviewDialog } from "../../../components/reports/ReportPreviewDialog";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
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

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

// ─── Field wrapper (same style as Freight/DN Summary) ─────────────────────────

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

// ─── Native select (Freight style) ────────────────────────────────────────────

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
  nameKey: string,
  extraNameKey?: string
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
            name:
              extraNameKey && x[extraNameKey]
                ? `${x[nameKey] ?? ""} (${x[extraNameKey]})`
                : x[nameKey] ?? "",
          }))
      : [];
  } catch (err) {
    console.error(`[${parameter}] Fetch error:`, err);
    return [];
  }
};

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

  // ── Selected filter values ────────────────────────────────────────────────
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [grade, setGrade] = useState("");
  const [designation, setDesignation] = useState("");
  const [employee, setEmployee] = useState("");
  const [sponsor, setSponsor] = useState("");

  // ── Date + employee type ──────────────────────────────────────────────────
  const [visaExpiryFrom, setVisaExpiryFrom] = useState(getToday());
  const [visaExpiryTo, setVisaExpiryTo] = useState(getNextMonth());
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>("A");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Select filters and run the report.");

  const lastParamsRef = React.useRef<Params | null>(null);

  // ── Inline preview dialog state (no new window) ─────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const dateRangeValid =
    !visaExpiryFrom || !visaExpiryTo || visaExpiryFrom <= visaExpiryTo;

  // ── Fetch all lookups on mount ────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [div, dept, sec, grd, desig, emp, spon] = await Promise.all([
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
          "AC_ASSETS_HR_GRADE_LIST",
          loginId,
          companyCode,
          "grade_code",
          "grade_name"
        ),
        fetchLookup(
          "MST_HR_MS_HR_DESIGNATION_LIST",
          loginId,
          companyCode,
          "desg_code",
          "desg_name"
        ),
        fetchLookup(
          "AC_ASSETS_HR_EMPLOYEE_LIST",
          loginId,
          companyCode,
          "emp_id",
          "emp_name"
        ),
        fetchLookup(
          "AC_ASSETS_HR_SPONSOR",
          loginId,
          companyCode,
          "sponsor_name",
          "sponsor_short_name"
        ),
      ]);
      setDivisionOptions(div);
      setDepartmentOptions(dept);
      setSectionOptions(sec);
      setGradeOptions(grd);
      setDesignationOptions(desig);
      setEmployeeOptions(emp);
      setSponsorOptions(spon);
    };
    load();
  }, [loginId, companyCode]);

  // ── Fetch report HTML → inline blob URL for the dialog iframe ───────────
  const fetchReport = useCallback(
    async (p: Params) => {
      setLoading(true);
      setError("");
      setMessage("");
      lastParamsRef.current = p;

      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setReportHtml(null);
      setPreviewOpen(true);

      try {
        const html = await getVisaExpiryReportHtml({
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
    [loginId, companyCode, previewUrl]
  );

  // ── Keep blob URL in sync with reportHtml ───────────────────────────────
  useEffect(() => {
    if (!previewOpen) return;
    if (loading) return;
    if (reportHtml === null || reportHtml === undefined) return;

    const blob = new Blob([reportHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) window.URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, reportHtml, loading]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── Clear All ─────────────────────────────────────────────────────────────
  const handleClearAll = () => {
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
    setError("");
    setMessage("Select filters and run the report.");
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (!visaExpiryFrom || !visaExpiryTo) {
      setError("Please select both Visa Expiry From and To dates.");
      return;
    }
    if (!dateRangeValid) return;

    fetchReport({
      division,
      department,
      section,
      grade,
      designation,
      employee,
      sponsor,
      employeeFilter,
      visaExpiryFrom,
      visaExpiryTo,
    });
  };

  // Excel — only used by ReportPreviewDialog's internal Excel button
  const handleExcel = async () => {
    if (!lastParamsRef.current) return;
    const p = lastParamsRef.current;
    setExporting(true);
    try {
      await getVisaExpiryReportExcelDownload({
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
    } catch (err) {
      console.error("Excel export error:", err);
      setError("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewOpen(false);
    setPreviewUrl("");
    setReportHtml(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        {/* ── Title bar ─────────────────────────────────────────────────── */}
        <div className="freight-report-titlebar">
          <h1>Visa Expiry Report</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        {/* ── Report Filters header with Clear All ──────────────────────── */}
        <ReportFilterHeader onClear={handleClearAll} />

        {/* ── Row 1: Division / Department / Section / Grade ────────────── */}
        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Division">
            <Select
              value={division}
              onChange={setDivision}
              options={[
                { label: "All", value: "" },
                ...divisionOptions.map((o) => ({
                  label: `${o.code} - ${o.name}`,
                  value: o.code,
                })),
              ]}
            />
          </Field>

          <Field label="Department">
            <Select
              value={department}
              onChange={setDepartment}
              options={[
                { label: "All", value: "" },
                ...departmentOptions.map((o) => ({
                  label: `${o.code} - ${o.name}`,
                  value: o.code,
                })),
              ]}
            />
          </Field>

          <Field label="Section">
            <Select
              value={section}
              onChange={setSection}
              options={[
                { label: "All", value: "" },
                ...sectionOptions.map((o) => ({
                  label: `${o.code} - ${o.name}`,
                  value: o.code,
                })),
              ]}
            />
          </Field>

          <Field label="Grade">
            <Select
              value={grade}
              onChange={setGrade}
              options={[
                { label: "All", value: "" },
                ...gradeOptions.map((o) => ({
                  label: `${o.code} - ${o.name}`,
                  value: o.code,
                })),
              ]}
            />
          </Field>
        </div>

        {/* ── Row 2: Designation / Employee / Sponsor / Employee Type ───── */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Designation">
            <Select
              value={designation}
              onChange={setDesignation}
              options={[
                { label: "All", value: "" },
                ...designationOptions.map((o) => ({
                  label: `${o.code} - ${o.name}`,
                  value: o.code,
                })),
              ]}
            />
          </Field>

          <Field label="Employee">
            <Select
              value={employee}
              onChange={setEmployee}
              options={[
                { label: "All", value: "" },
                ...employeeOptions.map((o) => ({
                  label: `${o.code} - ${o.name}`,
                  value: o.code,
                })),
              ]}
            />
          </Field>

          <Field label="Sponsor">
            <Select
              value={sponsor}
              onChange={setSponsor}
              options={[
                { label: "All", value: "" },
                ...sponsorOptions.map((o) => ({
                  label: `${o.code} - ${o.name}`,
                  value: o.code,
                })),
              ]}
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

        {/* ── Row 3: Visa Expiry From / To ──────────────────────────────── */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Visa Expiry From">
            <BiscDatePicker
              value={visaExpiryFrom}
              onChange={(value) => {
                if (!visaExpiryTo || value <= visaExpiryTo)
                  setVisaExpiryFrom(value);
              }}
            />
          </Field>

          <Field label="Visa Expiry To">
            <BiscDatePicker
              value={visaExpiryTo}
              onChange={(value) => {
                if (!visaExpiryFrom || value >= visaExpiryFrom)
                  setVisaExpiryTo(value);
              }}
            />
          </Field>
        </div>

        {/* ── Date validation warning ───────────────────────────────────── */}
        {!dateRangeValid && (
          <p className="px-3 pb-2 text-xs text-destructive">
            Visa Expiry From must be on or before Visa Expiry To.
          </p>
        )}

        {/* ── Actions bar (only Generate Report) ────────────────────────── */}
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

        {/* ── Message ───────────────────────────────────────────────────── */}
        {message ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
        {error && !previewOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      {/* ── Inline preview dialog (Print/Excel inside dialog only) ────── */}
      {previewOpen && (
        <ReportPreviewDialog
          title="Visa Expiry Report"
          pdfUrl={previewUrl}
          error={error || undefined}
          exporting={exporting}
          onExcel={handleExcel}
          onClose={closePreview}
          onDownload={() => {}}
          downloadName="visa_expiry_report.html"
        />
      )}
    </section>
  );
}