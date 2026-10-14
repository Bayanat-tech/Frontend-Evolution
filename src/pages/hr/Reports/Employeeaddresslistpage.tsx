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
// NOTE: add these two to api/transactions (copy the Ticket Eligibility ones and
// point them at the new endpoints – handler names are in the controller file).
import {
  getEmployeeAddressListReportHtml,
  getEmployeeAddressListReportExcelDownload,
} from "../../../api/transactions";
import { NewReportDialog } from "../../../components/new_report_format";

// ─── Lookup parameter names ───────────────────────────────────────────────────
// Same lookups as the Ticket Eligibility page.
// TODO: confirm grade / designation names if you have address-list specific ones.
const LOOKUP = {
  division: "EDUCATION_QUALIFICATION_DIVISION_LIST",
  department: "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
  section: "EDUCATION_QUALIFICATION_MS_HR_SECTION",
  grade: "EDUCATION_QUALIFICATION_TICKET_ELIG_GRADE",
  designation: "EDUCATION_QUALIFICATION_TICKET_ELIG_DESIGNATION",
  employee: "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Params {
  division: string;
  department: string;
  section: string;
  grade: string;
  designation: string;
  employeeCode: string;
  status: string;
  joinFrom: string;
  joinTo: string;
}

const ALL_SENTINEL = "__ALL__";

// TODO: confirm the EMP_STATUS codes used in your system (C / P are used in the ticket report).
const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "All" },
  { label: "C", value: "C" },
  { label: "P", value: "P" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toApiCodeString = (selected: string[]): string => {
  if (selected.length === 0 || selected.includes(ALL_SENTINEL)) return "All";
  return selected.join(",");
};

const toDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "All";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

/** Turns lookup rows into MultiSelect options, tolerant of upper/lower-case keys. */
const mapOptions = (rows: any, codeKeys: string[], nameKeys: string[]): MultiSelectOption[] =>
  (Array.isArray(rows) ? rows : [])
    .map((r: any) => {
      const pick = (keys: string[]) => {
        for (const k of keys) {
          const v = r[k] ?? r[k.toUpperCase()];
          if (v != null && String(v).trim()) return String(v).trim();
        }
        return "";
      };
      // Fallback: if the expected keys are not found, auto-detect any "*code*" / "*name*" column
      const autoPick = (needle: string, exclude = "") => {
        const k = Object.keys(r).find(
          (key) => key.toLowerCase().includes(needle) && (!exclude || !key.toLowerCase().includes(exclude))
        );
        return k && r[k] != null ? String(r[k]).trim() : "";
      };
      const code = pick(codeKeys) || autoPick("code") || autoPick("id");
      const name = pick(nameKeys) || autoPick("name");
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

/**
 * The lookups accept one parent code per call (code2 = division, code3 = department,
 * code4 = section), so call once per selected parent combination and merge the rows.
 */
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
        if (alive) {
          const seen = new Set<string>();
          const opts = mapOptions(rows, codeKeys, nameKeys).filter((o) =>
            seen.has(o.value) ? false : (seen.add(o.value), true)
          );
          // Debug: lookup returned rows but nothing could be mapped / or returned nothing at all
          if (!opts.length) {
            console.warn(
              "[lookup] no options built. rows:",
              Array.isArray(rows) ? rows.length : rows,
              "first row:",
              Array.isArray(rows) ? rows[0] : undefined
            );
          }
          setOptions(opts);
        }
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

// ─── Field wrapper / native select / text input ──────────────────────────────

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

export default function EmployeeAddressListPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Filter state ──────────────────────────────────────────────────────────
  const [divisions, setDivisions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);

  const [employees, setEmployees] = useState<string[]>([]);
  const [status, setStatus] = useState("All");
  const [joinFrom, setJoinFrom] = useState("");
  const [joinTo, setJoinTo] = useState("");

  // ── Lookups ───────────────────────────────────────────────────────────────
  const divisionLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.division, loginId, companyCode)),
    ["div_code"], ["div_name"], [loginId, companyCode]
  );

  const divKey = divisions.join(",");
  const deptKey = departments.join(",");
  const sectKey = sections.join(",");

  // Department  <- Division (dependent when Division selected, all when not)
  const departmentLookup = useOptions(
    () => loadMerged(LOOKUP.department, loginId, companyCode, divisions),
    ["dept_code"], ["dept_name"], [loginId, companyCode, divKey]
  );

  // Section  <- Division, Department (dependent when selected, all when not)
  const sectionLookup = useOptions(
    () => loadMerged(LOOKUP.section, loginId, companyCode, divisions, departments),
    ["section_code"], ["section_name"], [loginId, companyCode, divKey, deptKey]
  );

  // Grade  <- INDEPENDENT (always all grades, no parent dependency)
  const gradeLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.grade, loginId, companyCode)),
    ["grade_code"], ["grade_name"],
    [loginId, companyCode]
  );

  // Designation  <- INDEPENDENT (always all designations, no parent dependency)
  const designationLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.designation, loginId, companyCode)),
    ["desg_code"], ["desg_name"],
    [loginId, companyCode]
  );

  // Employee  <- Division, Department, Section (dependent when selected, all when not)
  // TODO: confirm the returned column names (employee_code / employee_name) for this lookup.
  const employeeLookup = useOptions(
    () => loadMerged(LOOKUP.employee, loginId, companyCode, divisions, departments, sections),
    ["employee_code", "emp_code"], ["employee_name", "rpt_name", "emp_name"],
    [loginId, companyCode, divKey, deptKey, sectKey]
  );

  // Remove child selections that no longer belong to the chosen parents.
  // (Grade / Designation are independent, so they are NOT pruned.)
  usePrune(employeeLookup.options, employeeLookup.loading, employees, setEmployees);
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

  const dateRangeValid = !joinFrom || !joinTo || joinFrom <= joinTo;

  const buildPayload = (p: Params) => ({
    parameter: "Hr_Report_EMP_ADDRESS_LIST_REPORT",
    loginid: loginId,
    code1: companyCode,
    code2: p.division,
    code3: p.department,
    code4: p.section,
    code5: p.grade,
    code6: p.designation,
    code7: p.employeeCode,
    code8: p.status,
    date1: p.joinFrom,
    date2: p.joinTo,
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
        const html = await getEmployeeAddressListReportHtml(buildPayload(p));
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
    if (!dateRangeValid) return;
    fetchReport({
      division: toApiCodeString(divisions),
      department: toApiCodeString(departments),
      section: toApiCodeString(sections),
      grade: toApiCodeString(grades),
      designation: toApiCodeString(designations),
      employeeCode: toApiCodeString(employees),
      status,
      joinFrom,
      joinTo,
    });
  };

  const handleClearAll = () => {
    setDivisions([]);
    setDepartments([]);
    setSections([]);
    setGrades([]);
    setDesignations([]);
    setEmployees([]);
    setStatus("All");
    setJoinFrom("");
    setJoinTo("");
    setError("");
    setMessage("Select filters and run the report.");
  };

  const handleExcel = async () => {
    if (!lastParamsRef.current) return;
    setExporting(true);
    try {
      await getEmployeeAddressListReportExcelDownload(buildPayload(lastParamsRef.current));
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
    const PRINT_IFRAME_ID = "emp-address-list-print-iframe";
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
          <h1>Employee Address List</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={handleClearAll} />

        {/* ── Row 1: Division / Department / Section ────────────────────── */}
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

        {/* ── Row 2: Grade / Designation / Employee Code ────────────────── */}
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

        {/* ── Row 3: Join Date From / To / Status ───────────────────────── */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Join Date From">
            <BiscDatePicker
              value={joinFrom}
              onChange={(value) => {
                if (!joinTo || value <= joinTo) setJoinFrom(value);
              }}
            />
          </Field>

          <Field label="Join Date To">
            <BiscDatePicker
              value={joinTo}
              onChange={(value) => {
                if (!joinFrom || value >= joinFrom) setJoinTo(value);
              }}
            />
          </Field>

          <Field label="Status">
            <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </Field>
        </div>

        {!dateRangeValid && (
          <p className="px-3 pb-2 text-xs text-destructive">
            Join Date From must be on or before Join Date To.
          </p>
        )}

        {/* ── Actions ───────────────────────────────────────────────────── */}
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
        title="Employee Address List"
        htmlContent={reportHtml}
        loading={loading}
        error={error || null}
        meta={{
          companyName: companyCode,
          user: loginId,
          period:
            joinFrom || joinTo ? `${toDisplayDate(joinFrom)} - ${toDisplayDate(joinTo)}` : "All",
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