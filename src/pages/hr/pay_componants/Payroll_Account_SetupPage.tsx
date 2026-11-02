// Payroll Account Setup page — new UI
//  • Cascading filters (Company → Division → Department → Section) in a SectionPanel
//  • Two-view state machine: list ↔ full-page editor (add / edit / view)
//  • DataTable toolbar holds Reset / Refresh / Add Payroll; row actions are Edit / View
//  • Header Save calls formRef.current?.save() — the modal + bottom Submit bar are gone
//  • Removed: the leftover "cancel leave" handleSave, empCode / docNo state, gridRef and postFinance

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, Eye, FileText, Filter, Plus, RefreshCw, RotateCcw, Save, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { getDynamicLookup } from "../../../api/lookups";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Select } from "../../../components/ui/Select";
import { uppercaseKeys } from "../../../components/ui/Uselookupoptions";
import { useAuth } from "../../../state/AuthContext";
import AddPayrollAccountSetupForm, {
  type PayrollAccountFormHandle,
  type TPayrollAccountForm,
} from "./AddPayrollAccountSetupForm";

type TLeaveRow = {
  pay_comp_id: string;
  ac_code_db: string;
  ac_code_cr: string;
  [key: string]: unknown; // keep every field the lookup returns so edit can populate from the row
};

type EditorMode = "add" | "edit" | "view";

function lowercaseKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in row) out[key.toLowerCase()] = row[key];
  return out;
}

const fetchLookup = async (parameter: string, code1: string, code2 = "", code3 = "", code4 = "") => {
  const res = await getDynamicLookup({ parameter, code1, code2, code3, code4 });
  const rows = (res ?? []) as unknown as Record<string, unknown>[];
  return rows.map(lowercaseKeys);
};

const s = (v: unknown) => (v == null ? "" : String(v));

const PayrollAccountSetupPage = () => {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const userCompany = user?.company_code ?? "";

  // ── Filter state (codes only; names are looked up from the option lists) ──
  const [company, setCompany] = useState("");
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [query, setQuery] = useState("");

  // ── View state ──
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [activeRow, setActiveRow] = useState<TLeaveRow | null>(null);
  const [saving, setSaving] = useState(false);

  const formRef = useRef<PayrollAccountFormHandle>(null);

  // ── Filter option queries ──
  const { data: companies = [] } = useQuery({
    queryKey: ["lc_company", userCompany],
    queryFn: async () =>
      (await fetchLookup("EDUCATION_QUALIFICATION_Company", userCompany, loginid)).map((r) => ({
        company_code: s(r.company_code),
        comp_name: s(r.comp_name),
      })),
    enabled: !!userCompany,
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ["lc_division", company],
    queryFn: async () =>
      (await fetchLookup("Account_division", company, loginid)).map((r) => ({
        div_code: s(r.div_code),
        div_name: s(r.div_name),
      })),
    enabled: !!company,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["lc_department", company, division],
    queryFn: async () =>
      (await fetchLookup("EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE", company, division)).map((r) => ({
        dept_code: s(r.dept_code),
        dept_name: s(r.dept_name),
      })),
    enabled: !!division,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["lc_section", company, division, department],
    queryFn: async () =>
      (await fetchLookup("EDUCATION_QUALIFICATION_MS_HR_SECTION", company, division, department)).map((r) => ({
        section_code: s(r.section_code),
        section_name: s(r.section_name),
      })),
    enabled: !!department,
    staleTime: 0,
    gcTime: 0,
  });

  // ── Grid data ──
  const ready = !!company && !!division && !!department && !!section;

  const { data: rows = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["pa_setup", company, division, department, section],
    queryFn: async () =>
      (
        await fetchLookup(
          "PAY_COMPONENT_AccountSetup",
          company, // P_CODE1 → COMPANY_CODE
          division, // P_CODE2 → DIV_CODE
          department, // P_CODE3 → DEPT_CODE
          section, // P_CODE4 → SECTION_CODE
        )
      ).map(
        (r): TLeaveRow => ({
          ...r,
          pay_comp_id: s(r.pay_comp_id),
          ac_code_db: s(r.ac_code_db),
          ac_code_cr: s(r.ac_code_cr),
        }),
      ),
    enabled: ready,
    staleTime: 0,
    gcTime: 0,
  });

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.pay_comp_id, r.ac_code_db, r.ac_code_cr].some((v) => s(v).toLowerCase().includes(q)));
  }, [rows, query]);

  // ── Filter handlers (each level clears everything below it) ──
  const handleCompany = (code: string) => {
    setCompany(code);
    setDivision("");
    setDepartment("");
    setSection("");
  };
  const handleDivision = (code: string) => {
    setDivision(code);
    setDepartment("");
    setSection("");
  };
  const handleDepartment = (code: string) => {
    setDepartment(code);
    setSection("");
  };

  const handleReset = () => {
    setCompany("");
    setDivision("");
    setDepartment("");
    setSection("");
    setQuery("");
  };

  // ── Navigation handlers ──
  const openEditor = (mode: EditorMode, row: TLeaveRow | null = null) => {
    setEditorMode(mode);
    setActiveRow(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
  };

  const handleSaved = () => {
    handleCloseEditor();
    void refetch();
  };

  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  // ── Columns ──
  const columns = useMemo<ColumnDef<TLeaveRow>[]>(
    () => [
      { id: "srno", header: "#", size: 50, enableSorting: false, cell: ({ row }) => row.index + 1 },
      { accessorKey: "pay_comp_id", header: "Pay Component ID", size: 200, enableSorting: false },
      { accessorKey: "ac_code_db", header: "DB Account Code", size: 200, enableSorting: false },
      { accessorKey: "ac_code_cr", header: "CR Account Code", size: 200, enableSorting: false },
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
              onClick={() => openEditor("edit", row.original)}
              title="Edit payroll account setup"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("view", row.original)}
              title="View payroll account setup"
            >
              <Eye size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    const isView = editorMode === "view";
    const title =
      editorMode === "add"
        ? "New Payroll Account Setup"
        : editorMode === "edit"
          ? "Edit Payroll Account Setup"
          : "View Payroll Account Setup";
    const badge = editorMode === "add" ? "Draft" : editorMode === "edit" ? "Editing" : "View only";

    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{title}</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[division, department, section].filter(Boolean).join(" / ")}
                  {activeRow?.pay_comp_id ? ` — ${activeRow.pay_comp_id}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save (Save hidden in view mode) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            {!isView && (
              <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
                <Save size={14} /> {saving ? "Saving" : "Save"}
              </Button>
            )}
          </div>
        </div>

        <AddPayrollAccountSetupForm
          key={activeRow?.pay_comp_id || "new"}
          ref={formRef}
          mode={editorMode}
          // the form reads UPPERCASE keys; the list rows are lowercased
          existingData={activeRow ? (uppercaseKeys(activeRow) as Partial<TPayrollAccountForm>) : undefined}
          company_code={company}
          div_code={division}
          dept_code={department}
          section_code={section}
          onClose={(shouldRefetch?: boolean) => (shouldRefetch ? handleSaved() : handleCloseEditor())}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — filters + DataTable (buttons inside the toolbar)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <h2
          className="text-foreground m-0"
          style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
        >
          Payroll Account Setup
        </h2>
      </div>

      {/* Field / Select / SectionPanel are styled by these Freight classes (the editor forms carry them too) */}
      <div className="freight-workspace-ui freight-dense-form freight-ui-standard">
      <SectionPanel title="Filters" icon={Filter}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Company">
            <Select value={company} onChange={(e) => handleCompany(e.target.value)}>
              <option value="">-- Select --</option>
              {companies.map((o) => (
                <option key={o.company_code} value={o.company_code}>
                  {o.company_code} - {o.comp_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Division">
            <Select disabled={!company} value={division} onChange={(e) => handleDivision(e.target.value)}>
              <option value="">-- Select --</option>
              {divisions.map((o) => (
                <option key={o.div_code} value={o.div_code}>
                  {o.div_code} - {o.div_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Department">
            <Select disabled={!division} value={department} onChange={(e) => handleDepartment(e.target.value)}>
              <option value="">-- Select --</option>
              {departments.map((o) => (
                <option key={o.dept_code} value={o.dept_code}>
                  {o.dept_code} - {o.dept_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Section">
            <Select disabled={!department} value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">-- Select --</option>
              {sections.map((o) => (
                <option key={o.section_code} value={o.section_code}>
                  {o.section_code} - {o.section_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionPanel>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={isLoading ? "Loading" : `${filteredRows.length.toLocaleString()} Records`}
        subtitle="Payroll Account Setup List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search pay component, account code..."
        loading={isLoading}
        emptyText={ready ? "No payroll account setups found" : "Select company, division, department and section"}
        height={460}
        minWidth={800}
        density="grid"
        getRowId={(row, index) => row.pay_comp_id || `temp-${index}`}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RotateCcw size={14} />
              Reset
            </button>

            <button
              type="button"
              onClick={() => void refetch()}
              disabled={!ready || isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => openEditor("add")}
              disabled={!ready}
              title={ready ? "Add payroll account setup" : "Select all four filters first"}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} />
              Add Payroll
            </button>
          </div>
        }
      />
    </section>
  );
};

export default PayrollAccountSetupPage;