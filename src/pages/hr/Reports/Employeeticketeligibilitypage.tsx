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
// NOTE: add these two to api/transactions (copy the Employee Assessment ones and
// point them at the new endpoints – handler names are in the controller file).
import {
  getEmployeeTicketEligibilityReportHtml,
  getEmployeeTicketEligibilityReportExcelDownload,
} from "../../../api/transactions";
import { NewReportDialog } from "../../../components/new_report_format";

// ─── Lookup parameter names ───────────────────────────────────────────────────
// Division / Department / Section reuse the ones from the Assessment page.
// TODO: confirm the three below against your dynamic-lookup table.
const LOOKUP = {
  division: "EDUCATION_QUALIFICATION_DIVISION_LIST",
  department: "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
  section: "EDUCATION_QUALIFICATION_MS_HR_SECTION",
  grade: "EDUCATION_QUALIFICATION_TICKET_ELIG_GRADE",
  designation: "EDUCATION_QUALIFICATION_TICKET_ELIG_DESIGNATION",
  formalDesignation: "EDUCATION_QUALIFICATION_TICKET_ELIG_FORMAL_DESIGNATION",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupBy = "DESIGNATION" | "GRADE_DESIGNATION" | "DIVISION" | "DEPARTMENT" | "SECTION";

interface Params {
  division: string;
  department: string;
  section: string;
  grade: string;
  designation: string;
  formalDesignation: string;
  groupBy: GroupBy;
  joinFrom: string;
  joinTo: string;
}

const ALL_SENTINEL = "__ALL__";

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
          setOptions(
            mapOptions(rows, codeKeys, nameKeys).filter((o) =>
              seen.has(o.value) ? false : (seen.add(o.value), true)
            )
          );
        }
      } catch {
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

// ─── Floating-label field wrapper (label sits on the top border, like Absence) ─

function Field({
  label,
  required,
  hideInnerHint,
  children,
}: {
  label: string;
  required?: boolean;
  /** Hides the "Click to select multiple" helper text rendered by MultiSelectField. */
  hideInnerHint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative ${hideInnerHint ? "[&_p]:hidden" : ""}`}>
      <span className="pointer-events-none absolute -top-2 left-3 z-10 bg-background px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </div>
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
      className="h-10 w-full rounded-md border bg-background px-3 text-sm font-medium text-foreground"
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

const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: "Designation", value: "DESIGNATION" },
  { label: "Grade + Designation", value: "GRADE_DESIGNATION" },
  { label: "Division", value: "DIVISION" },
  { label: "Department", value: "DEPARTMENT" },
  { label: "Section", value: "SECTION" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeTicketEligibilityPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Filter state (multi-select) ───────────────────────────────────────────
  const [divisions, setDivisions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [formalDesgs, setFormalDesgs] = useState<string[]>([]);

  const [groupBy, setGroupBy] = useState<GroupBy>("DESIGNATION");
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

  // Department  <- Division
  const departmentLookup = useOptions(
    () => loadMerged(LOOKUP.department, loginId, companyCode, divisions),
    ["dept_code"], ["dept_name"], [loginId, companyCode, divKey]
  );

  // Section  <- Division, Department
  const sectionLookup = useOptions(
    () => loadMerged(LOOKUP.section, loginId, companyCode, divisions, departments),
    ["section_code"], ["section_name"], [loginId, companyCode, divKey, deptKey]
  );

  // Grade / Designation / Formal Designation  <- Division, Department, Section
  // Each lookup is called with code2 = division, code3 = department, code4 = section
  const gradeLookup = useOptions(
    () => loadMerged(LOOKUP.grade, loginId, companyCode, divisions, departments, sections),
    ["grade_code"], ["grade_name"], [loginId, companyCode, divKey, deptKey, sectKey]
  );

  const designationLookup = useOptions(
    () => loadMerged(LOOKUP.designation, loginId, companyCode, divisions, departments, sections),
    ["desg_code"], ["desg_name"], [loginId, companyCode, divKey, deptKey, sectKey]
  );

  const formalLookup = useOptions(
    () => loadMerged(LOOKUP.formalDesignation, loginId, companyCode, divisions, departments, sections),
    ["labour_desg_code", "desg_code"], ["labour_desg_name", "desg_name"],
    [loginId, companyCode, divKey, deptKey, sectKey]
  );

  // Remove child selections that no longer belong to the chosen parents
  usePrune(departmentLookup.options, departmentLookup.loading, departments, setDepartments);
  usePrune(sectionLookup.options, sectionLookup.loading, sections, setSections);
  usePrune(gradeLookup.options, gradeLookup.loading, grades, setGrades);
  usePrune(designationLookup.options, designationLookup.loading, designations, setDesignations);
  usePrune(formalLookup.options, formalLookup.loading, formalDesgs, setFormalDesgs);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const lastParamsRef = useRef<Params | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const dateRangeValid = !joinFrom || !joinTo || joinFrom <= joinTo;

  const buildPayload = (p: Params) => ({
    parameter: "Hr_Report_EMP_TICKET_ELIGIBILITY_REPORT",
    loginid: loginId,
    code1: companyCode,
    code2: p.division,
    code3: p.department,
    code4: p.section,
    code5: p.grade,
    code6: p.designation,
    code7: p.formalDesignation,
    code8: p.groupBy,
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
        const html = await getEmployeeTicketEligibilityReportHtml(buildPayload(p));
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
      formalDesignation: toApiCodeString(formalDesgs),
      groupBy,
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
    setFormalDesgs([]);
    setGroupBy("DESIGNATION");
    setJoinFrom("");
    setJoinTo("");
    setError("");
    setMessage("");
  };

  const handleExcel = async () => {
    if (!lastParamsRef.current) return;
    setExporting(true);
    try {
      await getEmployeeTicketEligibilityReportExcelDownload(buildPayload(lastParamsRef.current));
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
    const PRINT_IFRAME_ID = "emp-ticket-eligibility-print-iframe";
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
          <h1>Employee Ticket Eligibility</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        <ReportFilterHeader onClear={handleClearAll} />

        {/* ── Single compact grid: 3 columns x 3 rows (9 fields) ───────── */}
        <div className="freight-report-fields grid gap-x-3 gap-y-5 px-3 pb-3 pt-5 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Division" hideInnerHint>
            <MultiSelectField
              className="freight-report-multi-select"
              label=""
              options={divisionLookup.options}
              loading={divisionLookup.loading}
              value={divisions}
              onChange={setDivisions}
            />
          </Field>

          <Field label="Department" hideInnerHint>
            <MultiSelectField
              className="freight-report-multi-select"
              label=""
              options={departmentLookup.options}
              loading={departmentLookup.loading}
              value={departments}
              onChange={setDepartments}
            />
          </Field>

          <Field label="Section" hideInnerHint>
            <MultiSelectField
              className="freight-report-multi-select"
              label=""
              options={sectionLookup.options}
              loading={sectionLookup.loading}
              value={sections}
              onChange={setSections}
            />
          </Field>

          <Field label="Grade" hideInnerHint>
            <MultiSelectField
              className="freight-report-multi-select"
              label=""
              options={gradeLookup.options}
              loading={gradeLookup.loading}
              value={grades}
              onChange={setGrades}
            />
          </Field>

          <Field label="Designation" hideInnerHint>
            <MultiSelectField
              className="freight-report-multi-select"
              label=""
              options={designationLookup.options}
              loading={designationLookup.loading}
              value={designations}
              onChange={setDesignations}
            />
          </Field>

          <Field label="Formal Designation" hideInnerHint>
            <MultiSelectField
              className="freight-report-multi-select"
              label=""
              options={formalLookup.options}
              loading={formalLookup.loading}
              value={formalDesgs}
              onChange={setFormalDesgs}
            />
          </Field>

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

          <Field label="Group Criteria">
            <Select
              value={groupBy}
              onChange={(v) => setGroupBy(v as GroupBy)}
              options={GROUP_OPTIONS}
            />
          </Field>
        </div>

        {!dateRangeValid && (
          <p className="px-3 pb-2 text-xs text-destructive">
            Join Date From must be on or before Join Date To.
          </p>
        )}

        {error && !previewOpen ? (
          <p className="px-3 pb-2 text-sm text-destructive">{error}</p>
        ) : null}

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="freight-report-actions flex flex-wrap items-center justify-end gap-2 border-t px-3 py-3">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !dateRangeValid}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{" "}
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </div>
      </div>

      <NewReportDialog
        open={previewOpen}
        onClose={closePreview}
        title="Employee Ticket Eligibility"
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