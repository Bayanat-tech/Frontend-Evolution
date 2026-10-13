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
  grade: "MST_HR_MS_HR_Grade_Page",
  designation: "EDUCATION_QUALIFICATION_DESIGNATION_LIST",
  formalDesignation: "MS_EMP_HR_EMPLOYEE_LABOUR_DESG",
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

/** A lookup returns one-parent-code only, so cascade only when exactly one parent is picked. */
const single = (codes: string[]): string =>
  codes.length === 1 && codes[0] !== ALL_SENTINEL ? codes[0] : "";

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
        if (alive) setOptions(mapOptions(rows, codeKeys, nameKeys));
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

  const departmentLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.department, loginId, companyCode, single(divisions))),
    ["dept_code"], ["dept_name"], [loginId, companyCode, divisions.join(",")]
  );

  const sectionLookup = useOptions(
    () =>
      getDynamicLookup(
        buildParams(LOOKUP.section, loginId, companyCode, single(divisions), single(departments))
      ),
    ["section_code"], ["section_name"],
    [loginId, companyCode, divisions.join(","), departments.join(",")]
  );

  const gradeLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.grade, loginId, companyCode)),
    ["grade_code"], ["grade_name"], [loginId, companyCode]
  );

  const designationLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.designation, loginId, companyCode)),
    ["desg_code"], ["desg_name"], [loginId, companyCode]
  );

  const formalLookup = useOptions(
    () => getDynamicLookup(buildParams(LOOKUP.formalDesignation, loginId, companyCode)),
    ["labour_desg_code", "desg_code"], ["labour_desg_name", "desg_name"], [loginId, companyCode]
  );

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
    setMessage("Select filters and run the report.");
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

        {/* ── Row 2: Grade / Designation / Formal Designation ───────────── */}
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
            label="Formal Designation"
            options={formalLookup.options}
            loading={formalLookup.loading}
            value={formalDesgs}
            onChange={setFormalDesgs}
          />
        </div>

        {/* ── Row 3: Join Date From / To / Group Criteria ───────────────── */}
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