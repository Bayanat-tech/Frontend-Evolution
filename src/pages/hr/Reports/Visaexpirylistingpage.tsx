"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { BiscDatePicker } from "../../../components/ui/BiscDatePicker";
import { Button } from "../../../components/ui/Button";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { openVisaExpiryReport } from "../../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LookupOption {
  code: string;
  name: string;
}

type EmployeeFilter = "A" | "ALL";

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

// ─── Field wrapper (same style as Freight) ────────────────────────────────────

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
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [message, setMessage] = useState("Select filters and run the report.");

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
    setReportError(null);
    setMessage("Select filters and run the report.");
  };

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!visaExpiryFrom || !visaExpiryTo) {
      setReportError("Please select both Visa Expiry From and To dates.");
      return;
    }

    setReportError(null);
    setMessage("");
    setGenerating(true);

    try {
      await openVisaExpiryReport({
        parameter: "Hr_Report_VISA_EXPIRY_REPORT",
        loginid: loginId,
        code1: companyCode,
        code2: division,
        code3: department,
        code4: section,
        code5: grade,
        code6: designation,
        code7: employee,
        code8: sponsor,
        code9: employeeFilter,
        date1: visaExpiryFrom,
        date2: visaExpiryTo,
      });
      setMessage("Report generated successfully.");
    } catch (err: any) {
      const msg = err?.message ?? "Failed to generate report. Please try again.";
      setReportError(msg);
      setMessage(msg);
      console.error(err);
    } finally {
      setGenerating(false);
    }
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

        {/* ── Actions bar (only Generate Report) ────────────────────────── */}
        <div className="freight-report-actions flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}{" "}
            {generating ? "Generating..." : "Generate Report"}
          </Button>
        </div>

        {/* ── Message ───────────────────────────────────────────────────── */}
        {message ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
        {reportError ? (
          <p className="px-3 pb-3 text-sm text-destructive">{reportError}</p>
        ) : null}
      </div>
    </section>
  );
}