import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeDynamicDelete, executeDynamicMutation, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { useAuth } from "../../state/AuthContext";

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

type EditorState =
  | { mode: "create"; row?: undefined }
  | { mode: "edit"; row: BudgetVersionRow }
  | { mode: "view"; row: BudgetVersionRow }
  | null;

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

export function BudgetVersionPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BudgetVersionRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
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
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load budget versions" });
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
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [rows, query]);

  const columns = useMemo<ColumnDef<BudgetVersionRow>[]>(() => [
    {
      accessorKey: "doc_type",
      header: "Doc Type",
      cell: ({ getValue }) => <span className="font-medium">{String(getValue() || "")}</span>,
    },
    { accessorKey: "budget_year", header: "Year" },
    { accessorKey: "div_code", header: "Division" },
    { accessorKey: "version", header: "Version" },
    {
      accessorKey: "remarks",
      header: "Remarks",
      cell: ({ getValue }) => <span className="block max-w-[260px] truncate">{String(getValue() || "")}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "view", row: row.original })}><Eye size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)}><Trash2 size={15} /></Button>
        </div>
      ),
    },
  ], []);

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
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete budget version" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Master</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Budget Version</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Add Version</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Versions"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search budget version..."
        loading={loading}
        emptyText="No budget versions found"
        height={670}
        density="grid"
        getRowId={(row, index) => `${row.company_code}_${row.doc_type}_${row.budget_year}_${row.div_code}_${row.version}_${index}`}
      />

      {editor && (
        <Dialog
          open
          title={`${editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Edit" : "View"} Budget Version`}
          description="Budget version details"
          onClose={() => setEditor(null)}
        >
          <BudgetVersionEditor
            editor={editor}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setNotice({ type: "success", message: editor.mode === "edit" ? "Budget version updated successfully" : "Budget version added successfully" });
              await loadRows(false);
            }}
          />
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Budget Version"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.version}</strong> for {deleteTarget.budget_year}?</p>
        </Dialog>
      )}
    </section>
  );
}

function BudgetVersionEditor({ editor, onClose, onSaved }: { editor: Exclude<EditorState, null>; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const readOnly = editor.mode === "view";
  const isEdit = editor.mode === "edit";

  const originalRow = editor.row;

  const [form, setForm] = useState<BudgetVersionRow>(() => ({
    ...EMPTY_ROW,
    company_code: user?.company_code || "",
    user_id: user?.loginid || "",
    user_dt: new Date().toISOString().slice(0, 10),
    ...(editor.row || {}),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof BudgetVersionRow, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setError("");
    if (!form.doc_type || !form.budget_year || !form.div_code || !form.version) {
      setError("Document Type, Budget Year, Division and Version are required.");
      return;
    }

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
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save budget version");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[480px] flex-col">
      <div className="border-b pb-3">
        <p className="eyebrow">{editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Modify" : "View"}</p>
        <h2 className="m-0 text-xl font-semibold tracking-tight">Budget Version</h2>
      </div>
      <form className="grid flex-1 content-start gap-4 overflow-auto py-4" id="budget-version-form" onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Document Type" value={form.doc_type} onChange={(value) => setField("doc_type", value)} disabled={readOnly} />
          <Field label="Budget Year" value={form.budget_year} onChange={(value) => setField("budget_year", value)} disabled={readOnly} />
          <Field label="Division Code" value={form.div_code} onChange={(value) => setField("div_code", value)} disabled={readOnly} />
          <Field label="Version" value={form.version} onChange={(value) => setField("version", value)} disabled={readOnly} />
        </div>
        <label className="field">
          <span>Remarks</span>
          <textarea className="ui-textarea" value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} disabled={readOnly} />
        </label>
      </form>
      <div className="flex items-center justify-end gap-2 border-t bg-card pt-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!readOnly && <Button disabled={saving} type="submit" form="budget-version-form">{saving ? <span className="spinner small" /> : "Save"}</Button>}
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, disabled }: { label: string; type?: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

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

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}