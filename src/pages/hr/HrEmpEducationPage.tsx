import { MdAddCircleOutline } from "react-icons/md";
import { Save } from "lucide-react";
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
  _rowId: string;
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
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, "0");
  const d  = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeRow(): EduRow {
  return {
    _rowId:          `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
  code4 = ""
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const loginid     = user?.loginid      ?? "";
  const companyCode = user?.company_code ?? "";

  // ── Filter state ───────────────────────────────────────────────────────────
  const [division,   setDivision]   = useState<DivisionOption | null>(null);
  const [department, setDepartment] = useState<DeptOption     | null>(null);
  const [section,    setSection]    = useState<SectionOption  | null>(null);
  const [employee,   setEmployee]   = useState<EmployeeOption | null>(null);

  // ── Grid / notice state ────────────────────────────────────────────────────
  const [rows,   setRows]   = useState<EduRow[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Master data — edu level + discipline ──────────────────────────────────
  const { data: eduLevelOpts = [] } = useQuery<EduLevelOption[]>({
    queryKey: ["edu-level", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_HR_EDUCATIONAL_LEVEL_SELECT", loginid, companyCode)
      );
      return res as EduLevelOption[];
    },
  });

  const { data: eduDiscOpts = [] } = useQuery<EduDiscOption[]>({
    queryKey: ["edu-discipline", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_HR_EDU_DISCIPLINE", loginid, companyCode)
      );
      return res as EduDiscOption[];
    },
  });

  // ── Employee education data ────────────────────────────────────────────────
  useQuery({
    queryKey: ["education-data", employee?.employee_id],
    enabled: !!employee?.employee_id,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_EMP_EDUCATION_SELECT",
          loginid,
          companyCode,
          employee?.employee_id ?? ""
        )
      );
      const data: EduRow[] = (Array.isArray(res) ? res : []).map(
        (r: Record<string, unknown>, i: number) => ({
          _rowId:          `row_${i}`,
          edu_desc_code:   String(r.edu_desc_code   ?? ""),
          edu_disc_desc:   String(r.edu_disc_desc   ?? ""),
          edu_level_code:  String(r.edu_level_code  ?? ""),
          edu_level_desc:  String(r.edu_level_desc  ?? ""),
          start_date:      toIsoDate(String(r.start_date      ?? "")),
          end_date:        toIsoDate(String(r.end_date        ?? "")),
          year_of_passing: String(r.year_of_passing ?? ""),
          studied_at:      String(r.studied_at      ?? ""),
          status_flag:     String(r.status_flag     ?? "A"),
        })
      );
      setRows(data);
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
        })
      );
    },
    [eduDiscOpts, eduLevelOpts]
  );

  const updateRowText = useCallback(
    (rowId: string, field: keyof EduRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => (r._rowId === rowId ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const deleteRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r._rowId !== rowId));
  }, []);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<EduRow>[]>(
    () => [
      {
        id: "index",
        header: "#",
        size: 50,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: "edu_desc_code",
        header: "Educational Discipline *",
        size: 240,
        cell: ({ row }) => (
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
        header: "Educational Level *",
        size: 200,
        cell: ({ row }) => (
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
              { code: "A", label: "Active"   },
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
    [eduDiscOpts, eduLevelOpts, updateRowSelect, updateRowText, deleteRow]
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee?.employee_id) throw new Error("Please select an employee");
      if (rows.length === 0)      throw new Error("Add at least one education record");

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
        company_code:       companyCode,
        education_details,
        loginid,
      });

      if (!success) throw new Error("Save failed. Please try again.");
    },
    onSuccess: () => {
      setNotice({ type: "success", message: "Education details saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["education-data", employee?.employee_id] });
    },
    onError: (err: Error) => {
      setNotice({ type: "error", message: err.message ?? "Failed to save education details." });
    },
  });

  // ── Lookup loaders ─────────────────────────────────────────────────────────
  const loadDivisions = useCallback(
    () => getDynamicLookup(
      buildParams("EDUCATION_QUALIFICATION_DIVISION_LIST", loginid, companyCode)
    ),
    [loginid, companyCode]
  );

  const loadDepartments = useCallback(
    () => getDynamicLookup(
      buildParams("EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE", loginid, companyCode, division?.div_code ?? "")
    ),
    [loginid, companyCode, division?.div_code]
  );

  const loadSections = useCallback(
    () => getDynamicLookup(
      buildParams("EDUCATION_QUALIFICATION_MS_HR_SECTION", loginid, companyCode, department?.dept_code ?? "")
    ),
    [loginid, companyCode, department?.dept_code]
  );

  const loadEmployees = useCallback(
    () => getDynamicLookup(
      buildParams(
        "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
        loginid,
        companyCode,
        department?.dept_code ?? "",
        division?.div_code    ?? "",
        section?.section_code ?? ""
      )
    ),
    [loginid, companyCode, division?.div_code, department?.dept_code, section?.section_code]
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

          <label className="field">
            <span>Division</span>
            <LookupField
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
                  row ? { div_code: String(row.div_code), div_name: String(row.div_name) } : null
                );
              }}
            />
          </label>

          <label className="field">
            <span>Department</span>
            <LookupField
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
              disabled={!division}
              onChange={(_, row) => {
                setDepartment(
                  row ? { dept_code: String(row.dept_code), dept_name: String(row.dept_name) } : null
                );
              }}
            />
          </label>

          <label className="field">
            <span>Section (All)</span>
            <LookupField
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
                    ? { section_code: String(row.section_code), section_name: String(row.section_name) }
                    : null
                );
              }}
            />
          </label>

          <label className="field">
            <span>Employee <strong className="text-destructive">*</strong></span>
            <LookupField
              compact
              label="Employee"
              value={employee?.employee_id ?? ""}
              displayValue={employee ? `${employee.employee_id} - ${employee.employee_name}` : ""}
              columns={[
                { field: "employee_id",   header: "ID"       },
                { field: "employee_name", header: "Employee" },
              ]}
              valueField="employee_id"
              displayFields={["employee_id", "employee_name"]}
              loadOptions={loadEmployees}
              disabled={!division || !department}
              onChange={(_, row) => {
                setEmployee(
                  row
                    ? { employee_id: String(row.employee_id), employee_name: String(row.employee_name) }
                    : null
                );
              }}
            />
          </label>

        </CardContent>
      </Card>

      {/* ── Education Grid ───────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length} Record${rows.length !== 1 ? "s" : ""}`}
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
          disabled={mutation.isPending || rows.length === 0 || !employee?.employee_id}
          onClick={() => mutation.mutate()}
        >
          <Save size={15} />
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

    </section>
  );
}