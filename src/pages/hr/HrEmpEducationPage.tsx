// src/pages/hr/HrEmpEducationPage.tsx
//
// Employee Educational Qualifications — new UI (modelled on ProductWmsPage):
//  • Freight-style transaction header with Refresh / Save buttons
//  • Filters in a SectionPanel (Division → Department → Section → Employee)
//  • Education grid in a DataTable with "Add Row" inside the toolbar
//  • toast feedback instead of NoticeToast
//
// All data logic (cascade resets, skip-hydrate guard, soft-delete via
// status_flag "D", upsert payload) is unchanged.

import { GraduationCap, Plus, RefreshCw, Save, UserSearch, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import hrEmpEducationServiceInstance from "./upsertHrEmpEducation";

// ── Types ─────────────────────────────────────────────────────────────────────

type DivisionOption = { div_code: string; div_name: string };
type DeptOption = { dept_code: string; dept_name: string };
type SectionOption = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string; employee_name: string };
type EduLevelOption = { edu_level_code: string; edu_level_desc: string };
type EduDiscOption = { edu_disc_code: string; edu_disc_desc: string };

type EduRow = {
  _rowId: string;
  // Rows loaded from the API are "persisted". Removing one flips status_flag
  // to "D" (kept in state so the upsert payload tells the backend to remove
  // it); never-saved rows are simply dropped.
  _isPersisted: boolean;
  edu_desc_code: string;
  edu_disc_desc: string;
  edu_level_code: string;
  edu_level_desc: string;
  start_date: string;
  end_date: string;
  year_of_passing: string;
  studied_at: string;
  status_flag: string;
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
    _rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    _isPersisted: false,
    edu_desc_code: "",
    edu_disc_desc: "",
    edu_level_code: "",
    edu_level_desc: "",
    start_date: "",
    end_date: "",
    year_of_passing: "",
    studied_at: "",
    status_flag: "A",
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
    code1: companyCode,
    code2,
    code3,
    code4,
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

// ── Freight building blocks ───────────────────────────────────────────────────
// (Same as in the Grade / Product forms — worth moving to components/ui later.)

function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
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
  value: string;
  options: { code: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  // ── Filter state ───────────────────────────────────────────────────────────
  const [division, setDivision] = useState<DivisionOption | null>(null);
  const [department, setDepartment] = useState<DeptOption | null>(null);
  const [section, setSection] = useState<SectionOption | null>(null);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);

  // Bumping this remounts every LookupField (via `key`) so Refresh restores
  // the page to its just-opened state.
  const [resetKey, setResetKey] = useState(0);

  // ── Grid state ─────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<EduRow[]>([]);

  // Scoped skip-hydrate guard: the post-save refetch must not clobber local
  // rows, but it must only apply to the employee we just saved for.
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
    enabled: !!employee?.employee_id,
    // Always refetch on (re)mount so re-selecting an employee after Refresh
    // never silently reuses a cached result.
    refetchOnMount: "always",
    queryFn: async () => {
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
          _rowId: `row_${i}`,
          _isPersisted: true,
          edu_desc_code: String(r.edu_desc_code ?? ""),
          edu_disc_desc: String(r.edu_disc_desc ?? ""),
          edu_level_code: String(r.edu_level_code ?? ""),
          edu_level_desc: String(r.edu_level_desc ?? ""),
          start_date: toIsoDate(String(r.start_date ?? "")),
          end_date: toIsoDate(String(r.end_date ?? "")),
          year_of_passing: String(r.year_of_passing ?? ""),
          studied_at: String(r.studied_at ?? ""),
          status_flag: String(r.status_flag ?? "A"),
        }),
      );

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

  // Surface fetch errors as a toast (previously silent)
  useEffect(() => {
    if (eduQuery.isError) {
      toast.error(
        eduQuery.error instanceof Error ? eduQuery.error.message : "Unable to load education records",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eduQuery.isError]);

  // ── Cascade resets (clear children when a parent changes) ──────────────────
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

  const updateRowText = useCallback((rowId: string, field: keyof EduRow, value: string) => {
    setRows((prev) => prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r)));
  }, []);

  // Persisted rows → soft-delete (status_flag "D", still sent on save).
  // Unsaved rows → dropped outright.
  const deleteRow = useCallback((rowId: string) => {
    setRows((prev) =>
      prev
        .map((r) => (r._rowId === rowId && r._isPersisted ? { ...r, status_flag: "D" } : r))
        .filter((r) => !(r._rowId === rowId && !r._isPersisted)),
    );
  }, []);

  // Rows pending deletion stay in `rows` (for save) but are hidden from the grid.
  const visibleRows = useMemo(() => rows.filter((r) => r.status_flag !== "D"), [rows]);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<EduRow>[]>(
    () => [
      {
        id: "index",
        header: "#",
        size: 50,
        cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.index + 1}</span>,
      },
      {
        accessorKey: "edu_desc_code",
        header: "Educational Discipline *",
        size: 240,
        cell: ({ row }) => (
          <EditableSelectCell
            value={row.original.edu_desc_code}
            options={eduDiscOpts.map((o) => ({ code: o.edu_disc_code, label: o.edu_disc_desc }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "edu_desc_code", v)}
          />
        ),
      },
      {
        accessorKey: "edu_level_code",
        header: "Educational Level *",
        size: 200,
        cell: ({ row }) => (
          <EditableSelectCell
            value={row.original.edu_level_code}
            options={eduLevelOpts.map((o) => ({ code: o.edu_level_code, label: o.edu_level_desc }))}
            onChange={(v) => updateRowSelect(row.original._rowId, "edu_level_code", v)}
          />
        ),
      },
      {
        accessorKey: "start_date",
        header: "Start Date *",
        size: 160,
        cell: ({ row }) => (
          <EditableTextCell
            initialValue={row.original.start_date}
            type="date"
            onBlur={(v) => updateRowText(row.original._rowId, "start_date", v)}
          />
        ),
      },
      {
        accessorKey: "end_date",
        header: "End Date",
        size: 160,
        cell: ({ row }) => (
          <EditableTextCell
            initialValue={row.original.end_date}
            type="date"
            onBlur={(v) => updateRowText(row.original._rowId, "end_date", v)}
          />
        ),
      },
      {
        accessorKey: "year_of_passing",
        header: "Year Passed *",
        size: 120,
        cell: ({ row }) => (
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
        header: "University / Institution *",
        size: 220,
        cell: ({ row }) => (
          <EditableTextCell
            initialValue={row.original.studied_at}
            onBlur={(v) => updateRowText(row.original._rowId, "studied_at", v)}
          />
        ),
      },
      {
        accessorKey: "status_flag",
        header: "Status *",
        size: 130,
        cell: ({ row }) => (
          <EditableSelectCell
            value={row.original.status_flag}
            options={[
              { code: "A", label: "Active" },
              { code: "I", label: "Inactive" },
            ]}
            onChange={(v) => updateRowSelect(row.original._rowId, "status_flag", v)}
          />
        ),
      },
      {
        id: "remove",
        header: "",
        size: 60,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <button
              type="button"
              title="Remove row"
              onClick={() => deleteRow(row.original._rowId)}
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        ),
      },
    ],
    [eduDiscOpts, eduLevelOpts, updateRowSelect, updateRowText, deleteRow],
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee?.employee_id) throw new Error("Please select an employee");
      if (visibleRows.length === 0 && rows.every((r) => r.status_flag === "D")) {
        throw new Error("Add at least one education record");
      }

      // Send ALL rows, including status_flag "D", so the backend can remove them.
      const education_details = rows.map((r) => ({
        employee_id: employee.employee_id,
        edu_desc_code: r.edu_desc_code,
        edu_level_code: r.edu_level_code,
        start_date: toIsoDate(r.start_date),
        end_date: r.end_date ? toIsoDate(r.end_date) : null,
        year_of_passing: Number(r.year_of_passing) || 0,
        studied_at: r.studied_at,
        status_flag: r.status_flag,
        company_code: companyCode,
        user_id: loginid,
      }));

      const success = await hrEmpEducationServiceInstance.upsertHrEmpEducationApi({
        company_code: companyCode,
        education_details,
        loginid,
      });

      if (!success) throw new Error("Save failed. Please try again.");
    },
    onSuccess: () => {
      toast.success("Education details saved successfully");

      // Drop rows we just told the server to delete; mark the rest persisted.
      setRows((prev) =>
        prev.filter((r) => r.status_flag !== "D").map((r) => ({ ...r, _isPersisted: true })),
      );

      // Skip re-hydration for THIS employee's post-save refetch only.
      skipHydrateForEmployeeRef.current = employee?.employee_id ?? null;
      queryClient.invalidateQueries({ queryKey: ["education-data", employee?.employee_id] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save education details");
    },
  });

  // ── Refresh: restore page to its just-opened state ─────────────────────────
  const handleRefresh = () => {
    setDivision(null);
    setDepartment(null);
    setSection(null);
    setEmployee(null);
    setRows([]);
    setResetKey((k) => k + 1); // remount LookupFields → fresh option lists
    void queryClient.invalidateQueries({ queryKey: ["edu-level", companyCode] });
    void queryClient.invalidateQueries({ queryKey: ["edu-discipline", companyCode] });
    // Remove cached education data for every employee so re-selecting always
    // triggers a genuine fetch.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === "education-data" });
    skipHydrateForEmployeeRef.current = null;
  };

  // ── Lookup loaders ─────────────────────────────────────────────────────────
  const loadDivisions = useCallback(
    () => getDynamicLookup(buildParams("EDUCATION_QUALIFICATION_DIVISION_LIST", loginid, companyCode)),
    [loginid, companyCode],
  );

  // Department: P_CODE2 = DIV_CODE (optional; empty ⇒ all departments)
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

  // Section: P_CODE2 = DIV_CODE (optional), P_CODE3 = DEPT_CODE (required, field disabled until set)
  const loadSections = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_MS_HR_SECTION",
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
        ),
      ),
    [loginid, companyCode, division?.div_code, department?.dept_code],
  );

  // Employee: P_CODE2 = DIV_CODE, P_CODE3 = DEPT_CODE, P_CODE4 = SECTION_CODE
  const loadEmployees = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
          section?.section_code ?? "",
        ),
      ),
    [loginid, companyCode, division?.div_code, department?.dept_code, section?.section_code],
  );

  const canSave = !mutation.isPending && visibleRows.length > 0 && !!employee?.employee_id;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <GraduationCap size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                Employee Educational Qualifications
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                {employee ? `${employee.employee_id} - ${employee.employee_name}` : "No employee selected"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button type="button" size="sm" disabled={!canSave} onClick={() => mutation.mutate()}>
            <Save size={14} /> {mutation.isPending ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <SectionPanel title="Select Employee" icon={UserSearch}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* Division — top of the chain */}
          <Field label="Division">
            <LookupField
              key={`division-${resetKey}`}
              compact
              label=""
              value={division?.div_code ?? ""}
              displayValue={division ? `${division.div_code} - ${division.div_name}` : ""}
              columns={[
                { field: "div_code", header: "Code" },
                { field: "div_name", header: "Division" },
              ]}
              valueField="div_code"
              displayFields={["div_code", "div_name"]}
              loadOptions={loadDivisions}
              onChange={(_, row) =>
                setDivision(
                  row
                    ? { div_code: String(row.div_code ?? ""), div_name: String(row.div_name ?? "") }
                    : null,
                )
              }
            />
          </Field>

          {/* Department — optional; key includes division so it re-fetches when Division changes */}
          <Field label="Department">
            <LookupField
              key={`department-${resetKey}-${division?.div_code ?? ""}`}
              compact
              label=""
              value={department?.dept_code ?? ""}
              displayValue={department ? `${department.dept_code} - ${department.dept_name}` : ""}
              columns={[
                { field: "dept_code", header: "Code" },
                { field: "dept_name", header: "Department" },
              ]}
              valueField="dept_code"
              displayFields={["dept_code", "dept_name"]}
              loadOptions={loadDepartments}
              onChange={(_, row) =>
                setDepartment(
                  row
                    ? { dept_code: String(row.dept_code ?? ""), dept_name: String(row.dept_name ?? "") }
                    : null,
                )
              }
            />
          </Field>

          {/* Section — keyed on Division + Department so it always re-fetches scoped */}
          <Field label="Section" required>
            <LookupField
              key={`section-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
              compact
              label=""
              value={section?.section_code ?? ""}
              displayValue={section ? `${section.section_code} - ${section.section_name}` : ""}
              columns={[
                { field: "section_code", header: "Code" },
                { field: "section_name", header: "Section" },
              ]}
              valueField="section_code"
              displayFields={["section_code", "section_name"]}
              loadOptions={loadSections}
              onChange={(_, row) =>
                setSection(
                  row
                    ? {
                        section_code: String(row.section_code ?? ""),
                        section_name: String(row.section_name ?? ""),
                      }
                    : null,
                )
              }
            />
          </Field>

          {/* Employee — keyed on the whole chain */}
          <Field label="Employee" required>
            <LookupField
              key={`employee-${resetKey}-${department?.dept_code ?? ""}-${division?.div_code ?? ""}-${section?.section_code ?? ""}`}
              compact
              label=""
              value={employee?.employee_id ?? ""}
              displayValue={employee ? `${employee.employee_id} - ${employee.employee_name}` : ""}
              columns={[
                { field: "employee_id", header: "ID" },
                { field: "employee_name", header: "Employee" },
              ]}
              valueField="employee_id"
              displayFields={["employee_id", "employee_name"]}
              loadOptions={loadEmployees}
              onChange={(_, row) =>
                setEmployee(
                  row
                    ? {
                        employee_id: String(row.employee_id ?? ""),
                        // API may return either rpt_name or employee_name
                        employee_name: String(row.employee_name ?? row.rpt_name ?? ""),
                      }
                    : null,
                )
              }
            />
          </Field>
        </div>
      </SectionPanel>

      {/* Education grid — Add Row lives in the DataTable toolbar */}
      <DataTable
        columns={columns}
        data={visibleRows}
        title={eduQuery.isFetching ? "Loading" : `${visibleRows.length} Record${visibleRows.length !== 1 ? "s" : ""}`}
        subtitle="Education Records"
        searchPlaceholder="Search discipline, level, institution..."
        loading={eduQuery.isFetching}
        emptyText={employee ? "No education records" : "Select an employee to view records"}
        height={420}
        minWidth={1280}
        density="grid"
        enablePagination={false}
        getRowId={(row) => row._rowId}
        toolbar={
          <button
            type="button"
            disabled={!employee?.employee_id}
            onClick={() => setRows((prev) => [...prev, makeRow()])}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            Add Row
          </button>
        }
      />
    </section>
  );
}