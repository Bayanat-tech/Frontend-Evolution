import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, FileText, Languages, Loader2, Plus, RefreshCw, Save, Trash2, UserSearch } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useLookupOptions } from "../../components/ui/Uselookupoptions";
import { useAuth } from "../../state/AuthContext";
import hrEmpLanguageServiceInstance from "./Upserthremplanguage";

/* ================= TYPES ================= */

type DivisionOption = { div_code: string; div_name: string };
type DeptOption = { dept_code: string; dept_name: string };
type SectionOption = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string; employee_name: string };
type LanguageOption = { lang_code: string; lang_desc: string };
type StatusOption = { value_code: string; value_desc: string };

type LangRow = {
  id: string;
  /** false for rows added in this session (nothing to delete server-side) */
  persisted: boolean;
  lang_code: string;
  lang_desc: string;
  to_read: string;
  to_write: string;
  to_speak: string;
  remarks: string;
  /** "D" marks a persisted row for deletion on the next save */
  status_flag: string;
};

const PROFICIENCY_OPTIONS = [
  { code: "B", label: "Basic" },
  { code: "I", label: "Intermediate" },
  { code: "F", label: "Fluent" },
  { code: "E", label: "Expert" },
];

const PROFICIENCY_FIELDS = [
  ["to_read", "Read"],
  ["to_write", "Write"],
  ["to_speak", "Speak"],
] as const;

/* ================= HELPERS ================= */

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

const createEmptyRow = (): LangRow => ({
  id: newId(),
  persisted: false,
  lang_code: "",
  lang_desc: "",
  to_read: "",
  to_write: "",
  to_speak: "",
  remarks: "",
  status_flag: "A",
});

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

const proficiencyLabel = (code: string) =>
  PROFICIENCY_OPTIONS.find((o) => o.code === code)?.label ?? (code || "—");

const mapLanguage = (r: Record<string, unknown>): LanguageOption => ({
  lang_code: String(r.LANG_CODE ?? ""),
  lang_desc: String(r.LANG_DESC ?? ""),
});
const mapStatus = (r: Record<string, unknown>): StatusOption => ({
  value_code: String(r.VALUE_CODE ?? ""),
  value_desc: String(r.VALUE_DESC ?? ""),
});

/* ================= FORM ================= */

export function HrEmpLanguagePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const loginid = user?.loginid ?? "";
    const companyCode = user?.company_code ?? "";

    // Both were always called with no code2 → pass ""
    const languageOpts = useLookupOptions("EDUCATION_QUALIFICATION_LANG_LANG_SELECT", mapLanguage, "languages", "");
    const statusOpts = useLookupOptions("EDUCATION_QUALIFICATION_LANG_STATUS_SELECT", mapStatus, "statuses", "");

    const [saving, setSaving] = useState(false);

    // ── Filters ──
    const [division, setDivision] = useState<DivisionOption | null>(null);
    const [department, setDepartment] = useState<DeptOption | null>(null);
    const [section, setSection] = useState<SectionOption | null>(null);
    const [employee, setEmployee] = useState<EmployeeOption | null>(null);
    const [resetKey, setResetKey] = useState(0); // remounts the LookupFields on reset

    // ── Grid ──
    const [rows, setRows] = useState<LangRow[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [draft, setDraft] = useState<LangRow | null>(null); // inline panel above the grid
    const loadToken = useRef(0);

    const visibleRows = useMemo(() => rows.filter((r) => r.status_flag !== "D"), [rows]);

    /* ── Lookups for the filter LookupFields ── */
    const lookup = useCallback(
      (parameter: string, code2 = "", code3 = "", code4 = "") =>
        getDynamicLookup(buildParams(parameter, loginid, companyCode, code2, code3, code4)),
      [loginid, companyCode],
    );

    const loadDivisions = useCallback(() => lookup("EDUCATION_QUALIFICATION_LANG_DIVISION_LIST"), [lookup]);
    const loadDepartments = useCallback(
      () => lookup("EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE", division?.div_code ?? ""),
      [lookup, division?.div_code],
    );
    const loadSections = useCallback(
      () =>
        lookup(
          "EDUCATION_QUALIFICATION_MS_HR_SECTION",
          division?.div_code ?? "",
          department?.dept_code ?? "",
        ),
      [lookup, division?.div_code, department?.dept_code],
    );
    const loadEmployees = useCallback(
      () =>
        lookup(
          "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
          division?.div_code ?? "", // code2 = DIVISION
          department?.dept_code ?? "", // code3 = DEPARTMENT
          section?.section_code ?? "", // code4 = SECTION
        ),
      [lookup, division?.div_code, department?.dept_code, section?.section_code],
    );

    /* ── Load the selected employee's language rows ── */
    const loadRows = useCallback(
      async (employeeId: string) => {
        const token = ++loadToken.current;
        if (!employeeId) {
          setRows([]);
          setLoadingRows(false);
          return;
        }
        setLoadingRows(true);
        try {
          const res = await lookup("EDUCATION_QUALIFICATION_LANG_SELECT", employeeId);
          if (token !== loadToken.current) return;
          const raw = (Array.isArray(res) ? res : []) as unknown as Record<string, unknown>[];
          setRows(
            raw.map((r) => ({
              id: newId(),
              persisted: true,
              lang_code: String(r.lang_code ?? ""),
              lang_desc: String(r.lang_desc ?? ""),
              // Oracle already returns the single-char codes (B/I/F/E)
              to_read: String(r.to_read ?? ""),
              to_write: String(r.to_write ?? ""),
              to_speak: String(r.to_speak ?? ""),
              remarks: String(r.remarks ?? ""),
              status_flag: String(r.status_flag ?? "A"),
            })),
          );
        } catch (error) {
          if (token !== loadToken.current) return;
          setRows([]);
          toast.error(error instanceof Error ? error.message : "Unable to load language records");
        } finally {
          if (token === loadToken.current) setLoadingRows(false);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [lookup],
    );

    /* ── Filter change handlers (each level clears everything below it) ── */
    const applyEmployee = (emp: EmployeeOption | null) => {
      setEmployee(emp);
      setDraft(null);
      void loadRows(emp?.employee_id ?? "");
    };

    const handleDivisionChange = (row: Record<string, unknown> | null | undefined) => {
      setDivision(row ? { div_code: String(row.div_code ?? ""), div_name: String(row.div_name ?? "") } : null);
      setDepartment(null);
      setSection(null);
      applyEmployee(null);
    };

    const handleDepartmentChange = (row: Record<string, unknown> | null | undefined) => {
      setDepartment(row ? { dept_code: String(row.dept_code ?? ""), dept_name: String(row.dept_name ?? "") } : null);
      setSection(null);
      applyEmployee(null);
    };

    const handleSectionChange = (row: Record<string, unknown> | null | undefined) => {
      setSection(
        row ? { section_code: String(row.section_code ?? ""), section_name: String(row.section_name ?? "") } : null,
      );
      applyEmployee(null);
    };

    const handleEmployeeChange = (row: Record<string, unknown> | null | undefined) => {
      applyEmployee(
        row
          ? {
              employee_id: String(row.employee_id ?? ""),
              // the API may return either name field depending on the lookup
              employee_name: String(row.employee_name ?? row.rpt_name ?? ""),
            }
          : null,
      );
    };

    const reset = () => {
      setDivision(null);
      setDepartment(null);
      setSection(null);
      setResetKey((k) => k + 1);
      applyEmployee(null);
    };

    /* ── Row panel handlers ── */
    const patchDraft = (patch: Partial<LangRow>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

    const saveDraft = () => {
      if (!draft) return;
      if (!draft.lang_code) return void toast.warning("Please select a Language");
      const missing = PROFICIENCY_FIELDS.find(([key]) => !draft[key]);
      if (missing) return void toast.warning(`Please select ${missing[1]} proficiency`);
      if (!draft.status_flag) return void toast.warning("Please select a Status");
      if (visibleRows.some((r) => r.id !== draft.id && r.lang_code === draft.lang_code)) {
        return void toast.warning("This language is already added for the employee");
      }
      setRows((prev) => {
        const index = prev.findIndex((r) => r.id === draft.id);
        if (index === -1) return [...prev, draft];
        const next = [...prev];
        next[index] = draft;
        return next;
      });
      setDraft(null);
    };

    // Persisted rows are flagged "D" and removed by the next Save; new rows just disappear
    const deleteRow = (row: LangRow) => {
      setRows((prev) =>
        row.persisted
          ? prev.map((r) => (r.id === row.id ? { ...r, status_flag: "D" } : r))
          : prev.filter((r) => r.id !== row.id),
      );
      setDraft((d) => (d?.id === row.id ? null : d));
    };

    /* ── Save ── */
    const handleSave = async () => {
      if (!employee?.employee_id) {
        toast.warning("Please select an employee");
        return;
      }
      if (visibleRows.length === 0) {
        toast.warning("Add at least one language record");
        return;
      }
      try {
        const language_details = rows.map((r) => ({
          employee_id: employee.employee_id,
          lang_code: r.lang_code,
          to_read: r.to_read,
          to_write: r.to_write,
          to_speak: r.to_speak,
          remarks: r.remarks,
          status_flag: r.status_flag,
          company_code: companyCode,
          user_id: loginid,
        }));

        const result: unknown = await hrEmpLanguageServiceInstance.upsertHrEmpLanguageApi({
          company_code: companyCode,
          language_details,
          loginid,
        });
        // the old code treated the return value as a boolean; also accept { success, message }
        const ok = typeof result === "object" && result !== null && "success" in result
          ? Boolean((result as { success: unknown }).success)
          : Boolean(result);
        if (!ok) {
          const message = (result as { message?: string } | null)?.message;
          throw new Error(message || "Save failed. Please try again.");
        }

        toast.success("Language details saved successfully");
        setDraft(null);
        await loadRows(employee.employee_id); // refresh so rows are persisted and deletions applied
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save language details");
      }
    };

    const handleHeaderSave = async () => {
      setSaving(true);
      try {
        await handleSave();
      } finally {
        setSaving(false);
      }
    };

    /* ── Columns ── */
    const columns = useMemo<ColumnDef<LangRow>[]>(
      () => [
        { id: "srno", header: "SlNo", size: 60, enableSorting: false, cell: ({ row }) => row.index + 1 },
        {
          accessorKey: "lang_code",
          header: "Language",
          size: 220,
          enableSorting: false,
          cell: ({ row }) =>
            row.original.lang_desc ||
            languageOpts.find((o) => o.lang_code === row.original.lang_code)?.lang_desc ||
            row.original.lang_code ||
            "—",
        },
        {
          accessorKey: "to_read",
          header: "Read",
          size: 130,
          enableSorting: false,
          cell: ({ row }) => proficiencyLabel(row.original.to_read),
        },
        {
          accessorKey: "to_write",
          header: "Write",
          size: 130,
          enableSorting: false,
          cell: ({ row }) => proficiencyLabel(row.original.to_write),
        },
        {
          accessorKey: "to_speak",
          header: "Speak",
          size: 130,
          enableSorting: false,
          cell: ({ row }) => proficiencyLabel(row.original.to_speak),
        },
        {
          accessorKey: "status_flag",
          header: "Status",
          size: 120,
          enableSorting: false,
          cell: ({ row }) =>
            statusOpts.find((o) => o.value_code === row.original.status_flag)?.value_desc ??
            (row.original.status_flag || "—"),
        },
        {
          accessorKey: "remarks",
          header: "Remarks",
          size: 240,
          enableSorting: false,
          cell: ({ row }) => row.original.remarks || "—",
        },
        {
          id: "actions",
          header: "Actions",
          size: 90,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                onClick={() => setDraft({ ...row.original })}
                title="Edit row"
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                onClick={() => deleteRow(row.original)}
                title="Remove row"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ),
        },
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [languageOpts, statusOpts],
    );

    const isEditingRow = !!draft && rows.some((r) => r.id === draft.id);

    /* ── UI ── */
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  HR Employee - Language Skills
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  Editing
                </span>
                {employee && (
                  <span className="text-xs text-muted-foreground">
                    {employee.employee_id} - {employee.employee_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={reset} disabled={saving}>
              <RefreshCw size={14} /> Refresh
            </Button>
            <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        <SectionPanel title="Select Employee" icon={UserSearch}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Division">
              <LookupField
                key={`division-${resetKey}`}
                compact
                label="Division"
                value={division?.div_code ?? ""}
                displayValue={division ? `${division.div_code} - ${division.div_name}` : ""}
                columns={[
                  { field: "div_code", header: "Code" },
                  { field: "div_name", header: "Division" },
                ]}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={loadDivisions}
                onChange={(_, row) => handleDivisionChange(row)}
              />
            </Field>

            {/* key includes the parent selection so the list remounts and re-fetches scoped to it */}
            <Field label="Department">
              <LookupField
                key={`department-${resetKey}-${division?.div_code ?? ""}`}
                compact
                label="Department"
                value={department?.dept_code ?? ""}
                displayValue={department ? `${department.dept_code} - ${department.dept_name}` : ""}
                columns={[
                  { field: "dept_code", header: "Code" },
                  { field: "dept_name", header: "Department" },
                ]}
                valueField="dept_code"
                displayFields={["dept_code", "dept_name"]}
                loadOptions={loadDepartments}
                onChange={(_, row) => handleDepartmentChange(row)}
              />
            </Field>

            <Field label="Section">
              <LookupField
                key={`section-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
                compact
                label="Section"
                value={section?.section_code ?? ""}
                displayValue={section ? `${section.section_code} - ${section.section_name}` : ""}
                columns={[
                  { field: "section_code", header: "Code" },
                  { field: "section_name", header: "Section" },
                ]}
                valueField="section_code"
                displayFields={["section_code", "section_name"]}
                loadOptions={loadSections}
                onChange={(_, row) => handleSectionChange(row)}
              />
            </Field>

            <Field label="Employee" required>
              <LookupField
                key={`employee-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}-${section?.section_code ?? ""}`}
                compact
                label="Employee"
                value={employee?.employee_id ?? ""}
                displayValue={employee ? `${employee.employee_id} - ${employee.employee_name}` : ""}
                columns={[
                  { field: "employee_id", header: "ID" },
                  { field: "employee_name", header: "Employee" },
                ]}
                valueField="employee_id"
                displayFields={["employee_id", "employee_name"]}
                loadOptions={loadEmployees}
                onChange={(_, row) => handleEmployeeChange(row)}
              />
            </Field>
          </div>
        </SectionPanel>

        {/* ── Language Details (inline add / edit panel, above the grid) ── */}
        {draft && (
          <SectionPanel title="Language Details" icon={Languages}>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Language" required>
                <Select
                  value={draft.lang_code}
                  onChange={(e) => {
                    const opt = languageOpts.find((x) => x.lang_code === e.target.value);
                    patchDraft({ lang_code: e.target.value, lang_desc: opt?.lang_desc ?? "" });
                  }}
                >
                  <option value="">-- Select --</option>
                  {languageOpts.map((o) => (
                    <option key={o.lang_code} value={o.lang_code}>
                      {o.lang_desc}
                    </option>
                  ))}
                </Select>
              </Field>

              {PROFICIENCY_FIELDS.map(([key, label]) => (
                <Field key={key} label={label} required>
                  <Select value={draft[key]} onChange={(e) => patchDraft({ [key]: e.target.value })}>
                    <option value="">-- Select --</option>
                    {PROFICIENCY_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}

              <Field label="Status" required>
                <Select value={draft.status_flag} onChange={(e) => patchDraft({ status_flag: e.target.value })}>
                  <option value="">-- Select --</option>
                  {statusOpts.map((o) => (
                    <option key={o.value_code} value={o.value_code}>
                      {o.value_desc}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Remarks" className="md:col-span-3">
                <Input value={draft.remarks} onChange={(e) => patchDraft({ remarks: e.target.value })} />
              </Field>
            </div>

            <div className="mt-3 flex justify-end gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveDraft}>
                {isEditingRow ? "Update Row" : "Add Row"}
              </Button>
            </div>
          </SectionPanel>
        )}

        <DataTable
          columns={columns}
          data={visibleRows}
          title={loadingRows ? "Loading" : `${visibleRows.length.toLocaleString()} Record${visibleRows.length !== 1 ? "s" : ""}`}
          subtitle="Language Records"
          loading={loadingRows}
          emptyText={employee ? "No language records" : "Select an employee to load language records"}
          height={420}
          minWidth={1000}
          density="grid"
          getRowId={(row) => row.id}
          toolbar={
            <button
              type="button"
              onClick={() => setDraft(createEmptyRow())}
              disabled={!employee?.employee_id}
              title={employee ? "Add a language row" : "Select an employee first"}
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

export default HrEmpLanguagePage;