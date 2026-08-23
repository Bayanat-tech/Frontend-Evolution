import { MdAddCircleOutline } from "react-icons/md";
import { RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import type { ColumnDef } from "@tanstack/react-table";
import hrEmpLanguageServiceInstance from "./Upserthremplanguage";

// ── Types ─────────────────────────────────────────────────────────────────────

type DivisionOption = { div_code: string;     div_name: string };
type DeptOption     = { dept_code: string;    dept_name: string };
type SectionOption  = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string;  employee_name: string };
type LanguageOption = { lang_code: string;    lang_desc: string };
type StatusOption   = { value_code: string;   value_desc: string };

// FIX: WMSTST.HR_EMP_LANGUAGES_OBJ.TO_READ / TO_WRITE / TO_SPEAK are
// VARCHAR2(1) columns in Oracle (confirmed via NJS-142 error: "value too
// large for attribute TO_READ ... maximum: 1"). The grid must display full
// proficiency labels to the user but SEND only the single-char code to the
// backend. `code` here is what gets saved to Oracle; `label` is what shows
// in the dropdown.
//
// NOTE: codes below (B/I/F/E) are a best guess. Confirm against your actual
// HR_CODE_VALUES / business standard and adjust if the DB expects different
// single-char codes (e.g. a different letter set for read/write/speak scale).
const PROFICIENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "B", label: "Basic" },
  { code: "I", label: "Intermediate" },
  { code: "F", label: "Fluent" },
  { code: "E", label: "Expert" },
];

type LangRow = {
  _rowId:        string;
  // FIX: same reasoning as HrEmpEducationPage — rows loaded from the API are
  // "persisted". Removing one of these from the grid must not simply drop it
  // from local state, because the save payload would then omit it and the
  // backend (an upsert API) would never know to delete/deactivate it.
  // Persisted rows that get "removed" are kept in state with status_flag
  // flipped to "D" and sent to the server on save, then dropped from the
  // grid afterwards.
  _isPersisted:  boolean;
  lang_code:     string;
  lang_desc:     string;
  to_read:       string;
  to_write:      string;
  to_speak:      string;
  remarks:       string;
  status_flag:   string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(): LangRow {
  return {
    _rowId:       `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    _isPersisted: false,
    lang_code:    "",
    lang_desc:    "",
    to_read:      "",
    to_write:     "",
    to_speak:     "",
    remarks:      "",
    status_flag:  "A",
  };
}

function buildParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = "",
) {
  return {
    parameter,
    loginid,
    code1:   companyCode,
    code2,
    code3,
    code4,
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

// ── Inline editable text cell ─────────────────────────────────────────────────

function EditableTextCell({
  initialValue,
  onBlur,
}: {
  initialValue: string;
  onBlur: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.value = initialValue ?? "";
  }, [initialValue]);

  return (
    <Input
      ref={ref}
      type="text"
      defaultValue={initialValue}
      onBlur={(e) => onBlur(e.target.value)}
    />
  );
}

// ── Inline editable select cell ───────────────────────────────────────────────

function EditableSelectCell({
  value,
  options,
  disabled = false,
  onChange,
}: {
  value:     string;
  options:   { code: string; label: string }[];
  disabled?: boolean;
  onChange:  (value: string) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function HrEmpLanguagePage() {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const loginid     = user?.loginid      ?? "";
  // FIX: company_code is intentionally NOT rendered anywhere in the UI
  // (per requirement — the image's Company field is dropped). It is still
  // required by every backend query, so it's read silently from the
  // authenticated user and threaded through buildParams()/save exactly like
  // before.
  const companyCode = user?.company_code ?? "";

  // ── Filter state ───────────────────────────────────────────────────────────
  const [division,   setDivision]   = useState<DivisionOption | null>(null);
  const [department, setDepartment] = useState<DeptOption     | null>(null);
  const [section,    setSection]    = useState<SectionOption  | null>(null);
  const [employee,   setEmployee]   = useState<EmployeeOption | null>(null);

  // FIX: bumping this remounts every LookupField below (via `key`), forcing
  // each one to re-run its loadOptions from scratch — this is what makes
  // "Refresh" restore the page to its just-opened state rather than just
  // re-fetching the currently selected employee's grid data.
  const [resetKey, setResetKey] = useState(0);

  // ── Grid / notice state ────────────────────────────────────────────────────
  const [rows,   setRows]   = useState<LangRow[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // FIX: guards against the post-save refetch clobbering rows the user just
  // edited/deleted locally. Scoped to the employee_id the skip applies to
  // (not a bare boolean) so switching employees before the post-save refetch
  // fires doesn't swallow a different employee's legitimate hydration.
  const skipHydrateForEmployeeRef = useRef<string | null>(null);

  // ── Master data — languages + status ───────────────────────────────────────
  const { data: languageOpts = [] } = useQuery<LanguageOption[]>({
    queryKey: ["hr-language", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_LANG_LANG_SELECT", loginid, companyCode),
      );
      return res as LanguageOption[];
    },
  });

  // Status : SELECT VALUE_DESC, VALUE_CODE FROM HR_CODE_VALUES
  //          WHERE GROUP_CODE = 6 AND STATUS = 'A' ORDER BY SORT_ORDER ASC
  const { data: statusOpts = [] } = useQuery<StatusOption[]>({
    queryKey: ["hr-language-status", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_LANG_STATUS_SELECT", loginid, companyCode),
      );
      return res as StatusOption[];
    },
  });

  // ── Employee language data ──────────────────────────────────────────────────
  // SELECT EMPLOYEE_ID, LANG_CODE, TO_READ, TO_WRITE, TO_SPEAK, REMARKS,
  //        STATUS_FLAG, USER_ID, USER_DT, COMPANY_CODE
  // FROM HR_EMP_LANGUAGES
  // WHERE COMPANY_CODE = :as_companycode AND EMPLOYEE_ID = :as_employee_id
  const langQuery = useQuery({
    queryKey: ["language-data", employee?.employee_id],
    enabled:  !!employee?.employee_id,
    // FIX: always treat cached data as stale on (re)enable, so re-selecting
    // the same employee after a Refresh reliably triggers a real network
    // fetch instead of silently reusing a previous result.
    refetchOnMount: "always",
    queryFn:  async () => {
      const currentEmployeeId = employee?.employee_id ?? "";
      const res = await getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_LANG_SELECT",
          loginid,
          companyCode,
          currentEmployeeId,
        ),
      );
      const data: LangRow[] = (Array.isArray(res) ? res : []).map(
        (r: Record<string, unknown>, i: number) => ({
          _rowId:       `row_${i}`,
          _isPersisted: true,
          lang_code:    String(r.lang_code ?? ""),
          lang_desc:    String(r.lang_desc ?? ""),
          // FIX: values coming back from Oracle are already the single-char
          // codes (B/I/F/E) since that's all the column can hold — no
          // conversion needed here, EditableSelectCell matches on `code`.
          to_read:      String(r.to_read   ?? ""),
          to_write:     String(r.to_write  ?? ""),
          to_speak:     String(r.to_speak  ?? ""),
          remarks:      String(r.remarks   ?? ""),
          status_flag:  String(r.status_flag ?? "A"),
        }),
      );

      // FIX: only skip hydration if this fetch is for the SAME employee the
      // skip was set for. Any other employee's fetch always hydrates normally.
      if (
        skipHydrateForEmployeeRef.current !== null &&
        skipHydrateForEmployeeRef.current === currentEmployeeId
      ) {
        skipHydrateForEmployeeRef.current = null;
      } else {
        setRows(data);
      }
      return data;
    },
  });

  // ── Cascade resets ─────────────────────────────────────────────────────────
  // NOTE: this is the OTHER half of the cascade (clearing children when a
  // parent changes). The `key` props below (which embed each parent's
  // current code) are what force a fresh remount + refetch on every field —
  // matching HrEmpEducationPage's current (no `disabled`) structure exactly.
  useEffect(() => {
    setDepartment(null);
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, [division]);

  useEffect(() => {
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, [department]);

  useEffect(() => {
    setEmployee(null);
    setRows([]);
  }, [section]);

  useEffect(() => {
    if (!employee) setRows([]);
  }, [employee]);

  // ── Row update helpers ─────────────────────────────────────────────────────
  const updateRowSelect = useCallback(
    (rowId: string, field: keyof LangRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r._rowId !== rowId) return r;
          if (field === "lang_code") {
            const opt = languageOpts.find((x) => x.lang_code === value);
            return { ...r, lang_code: value, lang_desc: opt?.lang_desc ?? "" };
          }
          return { ...r, [field]: value };
        }),
      );
    },
    [languageOpts],
  );

  const updateRowText = useCallback(
    (rowId: string, field: keyof LangRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  // FIX: deleteRow doesn't just filter the row out of state.
  // - Unpersisted (new) rows are dropped entirely.
  // - Persisted rows are marked status_flag "D" but kept in state so the
  //   next save payload carries them — the backend needs to know they were
  //   removed, otherwise they stay in the DB and reappear on refetch. They
  //   are hidden from the visible grid via `visibleRows` below.
  const deleteRow = useCallback((rowId: string) => {
    setRows((prev) =>
      prev
        .map((r) =>
          r._rowId === rowId && r._isPersisted
            ? { ...r, status_flag: "D" }
            : r,
        )
        .filter((r) => !(r._rowId === rowId && !r._isPersisted)),
    );
  }, []);

  // FIX: rows marked for deletion stay in `rows` (so save can send them) but
  // are hidden from the visible grid the user interacts with.
  const visibleRows = useMemo(
    () => rows.filter((r) => r.status_flag !== "D"),
    [rows],
  );

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<LangRow>[]>(
    () => [
      {
        id:     "index",
        header: "SlNo",
        size:   60,
        cell:   ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: "lang_code",
        header:      "Language *",
        size:        220,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.lang_code}
            options={languageOpts.map((o) => ({
              code:  o.lang_code,
              label: o.lang_desc,
            }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "lang_code", v)}
          />
        ),
      },
      {
        accessorKey: "to_read",
        header:      "Read *",
        size:        150,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.to_read}
            options={PROFICIENCY_OPTIONS}
            onChange={(v) => updateRowSelect(row.original._rowId, "to_read", v)}
          />
        ),
      },
      {
        accessorKey: "to_write",
        header:      "Write *",
        size:        150,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.to_write}
            options={PROFICIENCY_OPTIONS}
            onChange={(v) => updateRowSelect(row.original._rowId, "to_write", v)}
          />
        ),
      },
      {
        accessorKey: "to_speak",
        header:      "Speak *",
        size:        150,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.to_speak}
            options={PROFICIENCY_OPTIONS}
            onChange={(v) => updateRowSelect(row.original._rowId, "to_speak", v)}
          />
        ),
      },
      {
        accessorKey: "status_flag",
        header:      "Status *",
        size:        140,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.status_flag}
            options={statusOpts.map((o) => ({
              code:  o.value_code,
              label: o.value_desc,
            }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "status_flag", v)}
          />
        ),
      },
      {
        accessorKey: "remarks",
        header:      "Remarks",
        size:        240,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.remarks}
            onBlur={(v) => updateRowText(row.original._rowId, "remarks", v)}
          />
        ),
      },
      {
        id:                 "remove",
        header:             "",
        size:               60,
        enableColumnFilter: false,
        cell:               ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            title="Remove row"
            onClick={() => deleteRow(row.original._rowId)}
          >
            ✕
          </Button>
        ),
      },
    ],
    [languageOpts, statusOpts, updateRowSelect, updateRowText, deleteRow],
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee?.employee_id) throw new Error("Please select an employee");
      // FIX: validate against visible (non-deleted) rows, not the raw `rows`
      // array, since `rows` may contain status_flag "D" entries pending
      // deletion that shouldn't block saving an otherwise-empty grid.
      if (visibleRows.length === 0 && rows.every((r) => r.status_flag === "D")) {
        throw new Error("Add at least one language record");
      }

      // FIX: send ALL rows, including ones marked status_flag "D", so the
      // backend can actually remove/deactivate the records the user deleted.
      const language_details = rows.map((r) => ({
        employee_id:  employee.employee_id,
        lang_code:    r.lang_code,
        to_read:      r.to_read,
        to_write:     r.to_write,
        to_speak:     r.to_speak,
        remarks:      r.remarks,
        status_flag:  r.status_flag,
        company_code: companyCode,
        user_id:      loginid,
      }));

      const success = await hrEmpLanguageServiceInstance.upsertHrEmpLanguageApi({
        company_code:     companyCode,
        language_details,
        loginid,
      });

      if (!success) throw new Error("Save failed. Please try again.");
    },
    onSuccess: () => {
      setNotice({ type: "success", message: "Language details saved successfully." });

      // FIX: drop rows we just told the server to delete, and mark the
      // remaining rows as persisted (they now exist server-side too).
      setRows((prev) =>
        prev
          .filter((r) => r.status_flag !== "D")
          .map((r) => ({ ...r, _isPersisted: true })),
      );

      // FIX: tell the next language-data fetch FOR THIS SPECIFIC EMPLOYEE to
      // skip re-hydrating `rows` from the server response — we already have
      // the correct local state. Scoping to employee_id (instead of a bare
      // boolean) prevents it from swallowing a different employee's fetch.
      skipHydrateForEmployeeRef.current = employee?.employee_id ?? null;
      queryClient.invalidateQueries({ queryKey: ["language-data", employee?.employee_id] });
    },
    onError: (err: Error) => {
      setNotice({ type: "error", message: err.message ?? "Failed to save language details." });
    },
  });

  // ── Lookup loaders ─────────────────────────────────────────────────────────
  const loadDivisions = useCallback(
    () =>
      getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_LANG_DIVISION_LIST", loginid, companyCode),
      ),
    [loginid, companyCode],
  );

  // Department: scoped by Division when one is picked. Empty div_code =>
  // all departments for the company (EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE).
  const loadDepartments = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
          loginid,
          companyCode,
          division?.div_code ?? "",
        ),
      ),
    [loginid, companyCode, division?.div_code],
  );

  // Section: same shape as HrEmpEducationPage's loadSections — code2 =
  // DIV_CODE (optional), code3 = DEPT_CODE (optional). No `disabled` gate,
  // matching Education's current structure — the field is always clickable,
  // and the `key` below (embedding division + department codes) forces a
  // remount + fresh fetch whenever a parent filter changes.
  const loadSections = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_MS_HR_SECTION",
          loginid,
          companyCode,
          division?.div_code    ?? "", // code2 — DIV_CODE  (optional)
          department?.dept_code ?? "", // code3 — DEPT_CODE (optional)
        ),
      ),
    [loginid, companyCode, division?.div_code, department?.dept_code],
  );

  // Employee: same shape as HrEmpEducationPage's loadEmployees — no
  // `disabled` gate, `key` embeds every parent code so any upstream change
  // forces a remount + fresh fetch.
  //
  // NOTE: code slot order intentionally differs from Education's employee
  // loader. Education's stored-proc branch treats DIV_CODE/DEPT_CODE/
  // SECTION_CODE as fully optional (OR-empty pattern), so any slot order
  // works there. Language's stored-proc branch
  // (EDUCATION_QUALIFICATION_LANG_EMPLOYEE_LIST) has DEPT_CODE as a
  // mandatory hard equality on P_CODE2 — so department must stay in the
  // code2 slot here, or the query silently returns zero rows whenever
  // department is empty. To get identical code-slot ordering to Education
  // too, the backend proc's WHERE clause needs DEPT_CODE wrapped in the
  // same optional OR-pattern used for DIV_CODE/SECTION_CODE first.
  const loadEmployees = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
          loginid,
          companyCode,
          department?.dept_code ?? "", // code2 — DEPT_CODE (mandatory in proc)
          division?.div_code    ?? "", // code3 — DIV_CODE  (optional)
          section?.section_code ?? "", // code4 — SECTION_CODE (optional)
        ),
      ),
    [
      loginid,
      companyCode,
      department?.dept_code,
      division?.div_code,
      section?.section_code,
    ],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="grid gap-4">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">
            HR Employee - Language Skills
          </h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Maintain language proficiency records for employees across divisions and departments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Reset all filters and grid state back to how the page
              // looked when it was first opened.
              setDivision(null);
              setDepartment(null);
              setSection(null);
              setEmployee(null);
              setRows([]);
              setNotice(null);
              // Force every LookupField to remount so it reloads its option
              // list fresh instead of showing a stale cached list.
              setResetKey((k) => k + 1);
              // Refresh master dropdown data (languages / status).
              void queryClient.invalidateQueries({ queryKey: ["hr-language", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["hr-language-status", companyCode] });
              // Fully remove any cached language-data results (for every
              // employee, not just the currently selected one) so
              // re-selecting an employee after Refresh always triggers a
              // genuine fresh fetch instead of reusing a previous result.
              queryClient.removeQueries({
                predicate: (query) => query.queryKey[0] === "language-data",
              });
              skipHydrateForEmployeeRef.current = null;
            }}
          >
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      {/* NOTE: Company field intentionally omitted from the UI — companyCode
          is still read from the authenticated user and passed to every API
          call under the hood. */}
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Filters</p>
            <h2 className="m-0 text-sm font-semibold">Select Employee</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

          {/* Division — top of the chain, always enabled */}
          <label className="field">
            <span>Division</span>
            <LookupField
              key={`division-${resetKey}`}
              compact
              label="Division"
              value={division?.div_code ?? ""}
              displayValue={division ? `${division.div_code} - ${division.div_name}` : ""}
              columns={[
                { field: "div_code", header: "Code"     },
                { field: "div_name", header: "Division" },
              ]}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              loadOptions={loadDivisions}
              onChange={(_, row) => {
                setDivision(
                  row
                    ? { div_code: String(row.div_code ?? ""), div_name: String(row.div_name ?? "") }
                    : null,
                );
              }}
            />
          </label>

          {/* Department — key includes division.div_code so picking a
              Division forces a remount and re-fetches departments scoped
              to it. */}
          <label className="field">
            <span>Department</span>
            <LookupField
              key={`department-${resetKey}-${division?.div_code ?? ""}`}
              compact
              label="Department"
              value={department?.dept_code ?? ""}
              displayValue={department ? `${department.dept_code} - ${department.dept_name}` : ""}
              columns={[
                { field: "dept_code", header: "Code"       },
                { field: "dept_name", header: "Department" },
              ]}
              valueField="dept_code"
              displayFields={["dept_code", "dept_name"]}
              loadOptions={loadDepartments}
              onChange={(_, row) => {
                setDepartment(
                  row
                    ? { dept_code: String(row.dept_code ?? ""), dept_name: String(row.dept_name ?? "") }
                    : null,
                );
              }}
            />
          </label>

          {/* Section — key includes division.div_code + department.dept_code:
              any change up the chain forces a remount, so loadSections()
              always runs fresh and scoped correctly. Matches Education's
              current (no `disabled`) structure. */}
          <label className="field">
            <span>Section</span>
            <LookupField
              key={`section-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
              compact
              label="Section"
              value={section?.section_code ?? ""}
              displayValue={section ? `${section.section_code} - ${section.section_name}` : ""}
              columns={[
                { field: "section_code", header: "Code"    },
                { field: "section_name", header: "Section" },
              ]}
              valueField="section_code"
              displayFields={["section_code", "section_name"]}
              loadOptions={loadSections}
              onChange={(_, row) => {
                setSection(
                  row
                    ? {
                        section_code: String(row.section_code ?? ""),
                        section_name: String(row.section_name ?? ""),
                      }
                    : null,
                );
              }}
            />
          </label>

          {/* Employee — key includes department.dept_code + division.div_code
              + section.section_code: any change up the chain forces a
              remount, so loadEmployees() always runs fresh and scoped
              correctly. Matches Education's current (no `disabled`)
              structure. */}
          <label className="field">
            <span>
              Employee <strong className="text-destructive">*</strong>
            </span>
            <LookupField
              key={`employee-${resetKey}-${department?.dept_code ?? ""}-${division?.div_code ?? ""}-${section?.section_code ?? ""}`}
              compact
              label="Employee"
              value={employee?.employee_id ?? ""}
              displayValue={
                employee
                  ? `${employee.employee_id} - ${employee.employee_name}`
                  : ""
              }
              columns={[
                { field: "employee_id",   header: "ID"       },
                { field: "employee_name", header: "Employee" },
              ]}
              valueField="employee_id"
              displayFields={["employee_id", "employee_name"]}
              loadOptions={loadEmployees}
              onChange={(_, row) => {
                setEmployee(
                  row
                    ? {
                        employee_id: String(row.employee_id ?? ""),
                        // Guard both rpt_name and employee_name — the API
                        // may return either depending on the lookup.
                        employee_name: String(
                          row.employee_name ?? row.rpt_name ?? "",
                        ),
                      }
                    : null,
                );
              }}
            />
          </label>

        </CardContent>
      </Card>

      {/* ── Language Grid ────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        // Renders only visibleRows (excludes rows pending deletion) so a
        // removed row stays gone from the UI, while the underlying `rows`
        // state still carries it (status_flag "D") for the save call.
        data={visibleRows}
        title={`${visibleRows.length} Record${visibleRows.length !== 1 ? "s" : ""}`}
        subtitle="Language Records"
        searchPlaceholder="Search language, status, remarks..."
        height={420}
        minWidth={1080}
        density="grid"
        enablePagination={false}
        getRowId={(row) => row._rowId}
        toolbar={
          <Button
            variant="outline"
            disabled={!employee?.employee_id}
            onClick={() => setRows((prev) => [...prev, makeRow()])}
          >
            <MdAddCircleOutline size={15} /> Add Row
          </Button>
        }
      />

      {/* ── Footer Actions ───────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2">
        <Button
          disabled={mutation.isPending || visibleRows.length === 0 || !employee?.employee_id}
          onClick={() => mutation.mutate()}
        >
          <Save size={15} />
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

    </section>
  );
}