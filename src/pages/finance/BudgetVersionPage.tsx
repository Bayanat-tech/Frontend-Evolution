import { Edit2, Eye, FileText, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  executeDynamicDelete,
  executeDynamicMutation,
  getDynamicLookup,
  getLookupValue,
  LookupRow,
} from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { useAuth } from "../../state/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BudgetVersionRow = {
  company_code: string;
  doc_type: string;
  budget_year: string;
  div_code: string;
  version: string;
  user_id: string;
  user_dt: string;
  remarks: string;
};

type EntryView = "list" | "editor";

const EMPTY_ROW: BudgetVersionRow = {
  company_code: "",
  doc_type: "",
  budget_year: "",
  div_code: "",
  version: "",
  user_id: "",
  user_dt: "",
  remarks: "",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function BudgetVersionPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BudgetVersionRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [entryView, setEntryView] = useState<EntryView>("list");
  const [readOnly, setReadOnly] = useState(false);
  const [form, setForm] = useState<BudgetVersionRow>(() => ({
    ...EMPTY_ROW,
    company_code: user?.company_code || "",
    user_id: user?.loginid || "",
    user_dt: new Date().toISOString().slice(0, 10),
  }));
  const [originalRow, setOriginalRow] = useState<BudgetVersionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BudgetVersionRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "BUDGET_VERSION_GET",
        loginid: user?.loginid || "",
        code1: user?.company_code || "",
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
      setRows(data.map(mapBudgetVersion));
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to load budget versions",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [rows, query]);

  const resetForm = () => {
    setForm({
      ...EMPTY_ROW,
      company_code: user?.company_code || "",
      user_id: user?.loginid || "",
      user_dt: new Date().toISOString().slice(0, 10),
    });
    setOriginalRow(null);
    setReadOnly(false);
    setError("");
  };

  const openAdd = () => {
    resetForm();
    setEntryView("editor");
    setNotice(null);
  };

  const openEdit = (row: BudgetVersionRow) => {
    setForm({ ...row });
    setOriginalRow(row);
    setReadOnly(false);
    setEntryView("editor");
    setNotice(null);
    setError("");
  };

  const openView = (row: BudgetVersionRow) => {
    setForm({ ...row });
    setOriginalRow(row);
    setReadOnly(true);
    setEntryView("editor");
    setNotice(null);
    setError("");
  };

  const backToList = () => {
    setEntryView("list");
    resetForm();
  };

  const setField = (field: keyof BudgetVersionRow, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setError("");
    if (!form.doc_type || !form.budget_year || !form.div_code || !form.version) {
      setError("Document Type, Budget Year, Division and Version are required.");
      return;
    }

    const isEdit = Boolean(originalRow);
    try {
      setSaving(true);
      await executeDynamicMutation({
        parameter: "BUDGET_VERSION_INS_UPD",
        loginid: user?.loginid || "",
        val1s1: isEdit ? form.company_code : undefined,
        val1s2: form.doc_type,
        val1s3: form.budget_year,
        val1s4: form.div_code,
        val1s5: form.version,
        val1s6: form.remarks,
        val1s7: form.user_id || user?.loginid || "",
        val1s8: "",
        val1s9: "",
        val1s10: "",
        val1d1: null,
        wval1s1: isEdit ? originalRow!.company_code : form.company_code,
        wval1s2: isEdit ? originalRow!.doc_type : "",
        wval1s3: isEdit ? originalRow!.budget_year : "",
        wval1s4: isEdit ? originalRow!.version : "",
        wval1s5: "",
      } as Parameters<typeof executeDynamicMutation>[0]);
      setNotice({
        type: "success",
        message: isEdit ? "Budget version updated successfully" : "Budget version added successfully",
      });
      await loadRows(false);
      setEntryView("list");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save budget version");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "BUDGET_VERSION_DELETE",
        loginid: user?.loginid || "",
        code1: deleteTarget.company_code,
        code2: deleteTarget.doc_type,
        code3: deleteTarget.budget_year,
        code4: deleteTarget.version,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Budget version deleted successfully" });
      await loadRows(false);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to delete budget version",
      });
    }
  };

  const columns = useMemo<ColumnDef<BudgetVersionRow>[]>(
    () => [
      {
        accessorKey: "doc_type",
        header: "Doc Type",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openEdit(row.original)}
            className="font-semibold text-[#00378C] hover:underline cursor-pointer text-left bg-transparent border-none p-0"
            title="Click to edit"
          >
            {String(row.original.doc_type || "")}
          </button>
        ),
      },
      { accessorKey: "budget_year", header: "Year" },
      {
        accessorKey: "div_code",
        header: () => <div className="text-center">Division</div>,
        cell: ({ getValue }) => <div className="text-center">{String(getValue() || "")}</div>,
      },
      { accessorKey: "version", header: "Version" },
      {
        accessorKey: "remarks",
        header: "Remarks",
        cell: ({ getValue }) => (
          <span className="block max-w-[260px] truncate">{String(getValue() || "")}</span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
              title="View"
              onClick={() => openView(row.original)}
            >
              <Eye size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
              title="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Edit2 size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md"
              title="Delete"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const pageTitle =
    entryView === "editor"
      ? originalRow
        ? readOnly
          ? "View Budget Version"
          : "Edit Budget Version"
        : "New Budget Version"
      : "Budget Version";

  return (
    <section className="finance-list-page finance-utility-page grid gap-2 p-1">
      {/* ---------- Top Header (compact) ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
            <FileText size={14} />
          </div>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">
            {pageTitle}
          </h1>
        </div>

        {entryView === "editor" && (
          <div className="flex items-center gap-1.5">
            {!readOnly && (
              <Button
                type="submit"
                form="budget-version-form"
                disabled={saving}
                className="h-7 gap-1 bg-[#00378C] text-white hover:bg-[#002d72] shadow-sm text-xs font-semibold px-3 rounded-md"
              >
                <Save size={13} /> Save
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={backToList}
              disabled={saving}
              aria-label="Close"
              title="Close"
              className="h-7 w-7 rounded-md"
            >
              <X size={14} />
            </Button>
          </div>
        )}
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* ---------- EDITOR – fits on one screen ---------- */}
      {entryView === "editor" && (
        <form id="budget-version-form" className="flex flex-col gap-2" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Section Header – very compact */}
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00378C]/10 text-[#00378C]">
                <FileText size={12} />
              </div>
              <h3 className="m-0 text-xs font-semibold text-slate-800">Budget Version Details</h3>
            </div>

            {/* Form Body – single tight block */}
            <div className="p-3">
              {/* 4 fields in one row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2.5">
                <FormField
                  label="Document Type"
                  value={form.doc_type}
                  required
                  disabled={readOnly}
                  placeholder="e.g. BD"
                  onChange={(value) => setField("doc_type", value)}
                />
                <FormField
                  label="Budget Year"
                  value={form.budget_year}
                  required
                  disabled={readOnly}
                  placeholder="e.g. 2025"
                  onChange={(value) => setField("budget_year", value)}
                />
                <FormField
                  label="Division Code"
                  value={form.div_code}
                  required
                  disabled={readOnly}
                  placeholder="e.g. 01"
                  onChange={(value) => setField("div_code", value)}
                />
                <FormField
                  label="Version"
                  value={form.version}
                  required
                  disabled={readOnly}
                  placeholder="e.g. V1"
                  onChange={(value) => setField("version", value)}
                />
              </div>

              {/* Remarks – short height, same card */}
              <div className="mt-2.5">
                <label className="mb-1 block text-[11px] font-medium text-slate-600 text-left">
                  Remarks
                </label>
                <textarea
                  className="w-full h-[52px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                  disabled={readOnly}
                  value={form.remarks}
                  placeholder="Optional remarks..."
                  onChange={(e) => setField("remarks", e.target.value)}
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ---------- LIST ---------- */}
      {entryView === "list" && (
        <DataTable
          columns={columns}
          data={filteredRows}
          title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Records`}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search budget version..."
          loading={loading}
          emptyText="No budget versions found"
          height="calc(100dvh - 150px)"
          minWidth={900}
          density="grid"
          enablePagination={false}
          enableExport={false}
          actionButton={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={openAdd}
                disabled={saving}
                className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-3.5 rounded-lg"
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
              <FinanceListActionsMenu
                fyPeriod=""
                fyPeriods={[]}
                onFyPeriodChange={() => {}}
                onExport={() =>
                  exportToCsv(
                    filteredRows,
                    columns,
                    `budget-version-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                onRefresh={() => void loadRows(false)}
              />
            </div>
          }
          initialSorting={[{ id: "budget_year", desc: true }]}
          getRowId={(row, index) =>
            `${row.company_code}_${row.doc_type}_${row.budget_year}_${row.div_code}_${row.version}_${index}`
          }
        />
      )}

      {/* ---------- DELETE CONFIRM ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Delete Budget Version"
        description="This action cannot be undone."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Close
            </Button>
            <Button variant="destructive" onClick={() => void deleteRow()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete <strong>{deleteTarget?.version}</strong> for {deleteTarget?.budget_year}?
        </p>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Field – ultra compact                                         */
/* ------------------------------------------------------------------ */

function FormField({
  label,
  value,
  onChange,
  disabled,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="mb-0.5 block text-[11px] font-medium text-slate-600 text-left">
        {label}
        {required && <span className="ml-0.5 text-destructive font-bold" style={{ color: "#E24B4A" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapBudgetVersion(row: LookupRow): BudgetVersionRow {
  return {
    company_code: String(getLookupValue(row, "company_code") || ""),
    doc_type: String(getLookupValue(row, "doc_type") || ""),
    budget_year: String(getLookupValue(row, "budget_year") || ""),
    div_code: String(getLookupValue(row, "div_code") || ""),
    version: String(getLookupValue(row, "version") || ""),
    user_id: String(getLookupValue(row, "user_id") || ""),
    user_dt: String(getLookupValue(row, "user_dt") || ""),
    remarks: String(getLookupValue(row, "remarks") || ""),
  };
}