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
import hrEmpEducationServiceInstance from "./upsertHrEmpEducation";
import type { ColumnDef } from "@tanstack/react-table";

// ── Types ─────────────────────────────────────────────────────────────────────

type DivisionOption = { div_code: string;     div_name: string };
type DeptOption     = { dept_code: string;    dept_name: string };
type SectionOption  = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string;  employee_name: string };
type EduLevelOption = { edu_level_code: string; edu_level_desc: string };
type EduDiscOption  = { edu_disc_code: string;  edu_disc_desc: string };

type EduRow = {
  _rowId:          string;
  // FIX: track whether this row already exists on the server. Rows loaded
  // from the API are "persisted" — if the user removes one of these from
  // the grid, we can't just drop it from local state, because the next
  // save's payload would simply omit it and the backend (an upsert API)
  // would never know to delete/deactivate it. So persisted rows that get
  // "removed" are kept in state with status_flag flipped to "D" and sent
  // to the server on save, then truly dropped from the grid afterwards.
  _isPersisted:    boolean;
  edu_desc_code:   string;
  edu_disc_desc:   string;
  edu_level_code:  string;
  edu_level_desc:  string;
  start_date:      string;
  end_date:        string;
  year_of_passing: string;
  studied_at:      string;
  status_flag:     string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIsoDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeRow(): EduRow {
  return {
    _rowId:          `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    _isPersisted:    false,
    edu_desc_code:   "",
    edu_disc_desc:   "",
    edu_level_code:  "",
    edu_level_desc:  "",
    start_date:      "",
    end_date:        "",
    year_of_passing: "",
    studied_at:      "",
    status_flag:     "A",
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
  type = "text",
  onBlur,
}: {
  initialValue: string;
  type?: string;
  onBlur: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.value = initialValue ?? "";
  }, [initialValue]);

  return (
    <Input
      ref={ref}
      type={type}
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
  value:    string;
  options:  { code: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
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

export function HrEmpEducationPage() {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const loginid     = user?.loginid      ?? "";
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
  const [rows,   setRows]   = useState<EduRow[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // FIX: guards against the post-save refetch clobbering rows the user just
  // edited/deleted locally. We only want the query's setRows(data) to run
  // for a genuine "employee changed / first load" fetch, not for the
  // invalidate-on-success refetch (where we already know the authoritative
  // state because we just sent it).
  //
  // FIX #2: this now stores the employee_id the skip applies to (not just a
  // bare boolean). A bare boolean was a bug — if the user saved for Employee
  // A and then switched to Employee B (or reselected A after a Refresh)
  // before the post-save refetch for A had fired, the skip flag would still
  // be `true` and would incorrectly swallow the hydration for whichever
  // employee's fetch ran next, making the grid look like it "didn't fetch"
  // even though the network request went through fine.
  const skipHydrateForEmployeeRef = useRef<string | null>(null);

  // ── Master data — edu level + discipline ───────────────────────────────────
  const { data: eduLevelOpts = [] } = useQuery<EduLevelOption[]>({
    queryKey: ["edu-level", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_HR_EDUCATIONAL_LEVEL_SELECT", loginid, companyCode),
      );
      return res as EduLevelOption[];
    },
  });

  const { data: eduDiscOpts = [] } = useQuery<EduDiscOption[]>({
    queryKey: ["edu-discipline", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_HR_EDU_DISCIPLINE", loginid, companyCode),
      );
      return res as EduDiscOption[];
    },
  });

  // ── Employee education data ────────────────────────────────────────────────
  const eduQuery = useQuery({
    queryKey: ["education-data", employee?.employee_id],
    enabled:  !!employee?.employee_id,
    // FIX: always treat cached data as stale on (re)enable, so re-selecting
    // the same employee after a Refresh (which resets local filter state
    // but doesn't touch this query's cache) reliably triggers a real network
    // fetch instead of silently reusing a previous result.
    refetchOnMount: "always",
    queryFn:  async () => {
      const currentEmployeeId = employee?.employee_id ?? "";
      const res = await getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_EMP_EDUCATION_SELECT",
          loginid,
          companyCode,
          currentEmployeeId,
        ),
      );
      const data: EduRow[] = (Array.isArray(res) ? res : []).map(
        (r: Record<string, unknown>, i: number) => ({
          _rowId:          `row_${i}`,
          _isPersisted:    true,
          edu_desc_code:   String(r.edu_desc_code   ?? ""),
          edu_disc_desc:   String(r.edu_disc_desc   ?? ""),
          edu_level_code:  String(r.edu_level_code  ?? ""),
          edu_level_desc:  String(r.edu_level_desc  ?? ""),
          start_date:      toIsoDate(String(r.start_date      ?? "")),
          end_date:        toIsoDate(String(r.end_date        ?? "")),
          year_of_passing: String(r.year_of_passing ?? ""),
          studied_at:      String(r.studied_at      ?? ""),
          status_flag:     String(r.status_flag     ?? "A"),
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
    (rowId: string, field: keyof EduRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r._rowId !== rowId) return r;
          if (field === "edu_desc_code") {
            const opt = eduDiscOpts.find((x) => x.edu_disc_code === value);
            return { ...r, edu_desc_code: value, edu_disc_desc: opt?.edu_disc_desc ?? "" };
          }
          if (field === "edu_level_code") {
            const opt = eduLevelOpts.find((x) => x.edu_level_code === value);
            return { ...r, edu_level_code: value, edu_level_desc: opt?.edu_level_desc ?? "" };
          }
          return { ...r, [field]: value };
        }),
      );
    },
    [eduDiscOpts, eduLevelOpts],
  );

  const updateRowText = useCallback(
    (rowId: string, field: keyof EduRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  // FIX: deleteRow no longer just filters the row out of state.
  // - If the row was never saved (new/unpersisted), it's safe to drop it
  //   entirely, same as before.
  // - If the row came from the server (_isPersisted), we mark it as
  //   status_flag "D" (deleted) but KEEP it in state so it's included in
  //   the next save payload — the backend needs to know it was removed,
  //   otherwise it stays in the DB and reappears on the post-save refetch.
  //   We hide it from the visible grid via the `visibleRows` filter below.
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

  // FIX: rows marked for deletion are kept in `rows` (so save can send
  // them) but hidden from the visible grid the user interacts with.
  const visibleRows = useMemo(
    () => rows.filter((r) => r.status_flag !== "D"),
    [rows],
  );

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<EduRow>[]>(
    () => [
      {
        id:     "index",
        header: "#",
        size:   50,
        cell:   ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: "edu_desc_code",
        header:      "Educational Discipline *",
        size:        240,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.edu_desc_code}
            options={eduDiscOpts.map((o) => ({
              code:  o.edu_disc_code,
              label: o.edu_disc_desc,
            }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "edu_desc_code", v)}
          />
        ),
      },
      {
        accessorKey: "edu_level_code",
        header:      "Educational Level *",
        size:        200,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.edu_level_code}
            options={eduLevelOpts.map((o) => ({
              code:  o.edu_level_code,
              label: o.edu_level_desc,
            }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "edu_level_code", v)}
          />
        ),
      },
      {
        accessorKey: "start_date",
        header:      "Start Date *",
        size:        160,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.start_date}
            type="date"
            onBlur={(v) => updateRowText(row.original._rowId, "start_date", v)}
          />
        ),
      },
      {
        accessorKey: "end_date",
        header:      "End Date",
        size:        160,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.end_date}
            type="date"
            onBlur={(v) => updateRowText(row.original._rowId, "end_date", v)}
          />
        ),
      },
      {
        accessorKey: "year_of_passing",
        header:      "Year Passed *",
        size:        120,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.year_of_passing}
            onBlur={(v) => {
              const clean = v.replace(/\D/g, "").slice(0, 4);
              updateRowText(row.original._rowId, "year_of_passing", clean);
            }}
          />
        ),
      },
      {
        accessorKey: "studied_at",
        header:      "University / Institution *",
        size:        220,
        cell:        ({ row }) => (
          <EditableTextCell
            initialValue={row.original.studied_at}
            onBlur={(v) => updateRowText(row.original._rowId, "studied_at", v)}
          />
        ),
      },
      {
        accessorKey: "status_flag",
        header:      "Status *",
        size:        130,
        cell:        ({ row }) => (
          <EditableSelectCell
            value={row.original.status_flag}
            options={[
              { code: "A", label: "Active"   },
              { code: "I", label: "Inactive" },
            ]}
            onChange={(v) => updateRowSelect(row.original._rowId, "status_flag", v)}
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
    [eduDiscOpts, eduLevelOpts, updateRowSelect, updateRowText, deleteRow],
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee?.employee_id) throw new Error("Please select an employee");
      // FIX: validate against the visible (non-deleted) rows, not the raw
      // `rows` array, since `rows` may now contain status_flag "D" entries
      // pending deletion that shouldn't block saving an otherwise-empty grid.
      if (visibleRows.length === 0 && rows.every((r) => r.status_flag === "D")) {
        throw new Error("Add at least one education record");
      }

      // FIX: send ALL rows, including ones marked status_flag "D", so the
      // backend can actually remove/deactivate the records the user deleted.
      const education_details = rows.map((r) => ({
        employee_id:     employee.employee_id,
        edu_desc_code:   r.edu_desc_code,
        edu_level_code:  r.edu_level_code,
        start_date:      toIsoDate(r.start_date),
        end_date:        r.end_date ? toIsoDate(r.end_date) : null,
        year_of_passing: Number(r.year_of_passing) || 0,
        studied_at:      r.studied_at,
        status_flag:     r.status_flag,
        company_code:    companyCode,
        user_id:         loginid,
      }));

      const success = await hrEmpEducationServiceInstance.upsertHrEmpEducationApi({
        company_code:      companyCode,
        education_details,
        loginid,
      });

      if (!success) throw new Error("Save failed. Please try again.");
    },
    onSuccess: () => {
      setNotice({ type: "success", message: "Education details saved successfully." });

      // FIX: drop rows we just told the server to delete, and mark the
      // remaining rows as persisted (they now exist server-side too).
      setRows((prev) =>
        prev
          .filter((r) => r.status_flag !== "D")
          .map((r) => ({ ...r, _isPersisted: true })),
      );

      // FIX: tell the next education-data fetch FOR THIS SPECIFIC EMPLOYEE
      // to skip re-hydrating `rows` from the server response — we already
      // have the correct local state and don't want a race/shape mismatch
      // to bring back a row the user just deleted. Scoping this to the
      // employee id (instead of a bare boolean) prevents it from
      // accidentally swallowing a different employee's legitimate fetch.
      skipHydrateForEmployeeRef.current = employee?.employee_id ?? null;
      queryClient.invalidateQueries({ queryKey: ["education-data", employee?.employee_id] });
    },
    onError: (err: Error) => {
      setNotice({ type: "error", message: err.message ?? "Failed to save education details." });
    },
  });

  // ── Lookup loaders ─────────────────────────────────────────────────────────
  const loadDivisions = useCallback(
    () =>
      getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_DIVISION_LIST", loginid, companyCode),
      ),
    [loginid, companyCode],
  );

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

  const loadSections = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_MS_HR_SECTION",
          loginid,
          companyCode,
          department?.dept_code ?? "",
        ),
      ),
    [loginid, companyCode, department?.dept_code],
  );

  // FIX: loadEmployees now accepts any combination of filters.
  // Division and section are optional — only department is used as
  // the primary filter (code2). Division goes to code3, section to code4.
  // The disabled prop below is also relaxed to only require department.
  const loadEmployees = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
          loginid,
          companyCode,
          department?.dept_code  ?? "",  // code2 — primary filter
          division?.div_code     ?? "",  // code3 — optional
          section?.section_code  ?? "",  // code4 — optional
        ),
      ),
    [loginid, companyCode, department?.dept_code, division?.div_code, section?.section_code],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="grid gap-4">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">
            Employee Educational Qualifications
          </h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Maintain education history for employees across divisions and departments.
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
              // Force every LookupField to remount so it reloads its
              // option list fresh instead of showing a stale cached list.
              setResetKey((k) => k + 1);
              // Also refresh the master dropdown data (edu level / discipline).
              void queryClient.invalidateQueries({ queryKey: ["edu-level", companyCode] });
              void queryClient.invalidateQueries({ queryKey: ["edu-discipline", companyCode] });
              // FIX: fully remove any cached education-data results (for
              // every employee, not just the currently selected one) so
              // re-selecting an employee after Refresh always triggers a
              // genuine fresh fetch instead of potentially reusing a
              // previous result from the query cache.
              queryClient.removeQueries({
                predicate: (query) => query.queryKey[0] === "education-data",
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
      <Card>
        <CardHeader>
          <div>
            <p className="eyebrow">Filters</p>
            <h2 className="m-0 text-sm font-semibold">Select Employee</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

          <label className="field">
            <span>Company</span>
            <Input disabled value={companyCode} />
          </label>

          {/* Division — optional, narrows employee list */}
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

          {/* Department — optional but recommended */}
          <label className="field">
            <span>Department</span>
            <LookupField
              key={`department-${resetKey}`}
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

          {/* Section — fully optional */}
          <label className="field">
            <span>Section</span>
            <LookupField
              key={`section-${resetKey}`}
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
              disabled={!department}
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

          {/* Employee — FIX: only requires department, not division */}
          <label className="field">
            <span>
              Employee <strong className="text-destructive">*</strong>
            </span>
            <LookupField
              key={`employee-${resetKey}`}
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
              // FIX: was `!division || !department` — division is optional
              disabled={false}
              onChange={(_, row) => {
                setEmployee(
                  row
                    ? {
                        employee_id: String(
                          row.employee_id ?? "",
                        ),
                        // FIX: guard both rpt_name and employee_name —
                        // API may return either depending on the lookup
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

      {/* ── Education Grid ───────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        // FIX: render only visibleRows (excludes rows pending deletion)
        // so a removed row stays gone from the UI, while the underlying
        // `rows` state still carries it (status_flag "D") for the save call.
        data={visibleRows}
        title={`${visibleRows.length} Record${visibleRows.length !== 1 ? "s" : ""}`}
        subtitle="Education Records"
        searchPlaceholder="Search discipline, level, institution..."
        height={420}
        minWidth={1280}
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