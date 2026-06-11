import { Edit2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeCommonProcedure, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type PLForm = {
  company_code: string;
  h_code: string;
  pl_code: string;
  pl_name: string;
  pl_type: string;
  prv_code: string;
};

type Editor = { mode: "create" } | { mode: "edit"; row: LookupRow } | null;

const EMPTY_PL: PLForm = {
  company_code: "",
  h_code: "",
  pl_code: "",
  pl_name: "",
  pl_type: "",
  prv_code: "",
};

export function PLSetupPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<LookupRow | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      setRows(await getDynamicLookup({ parameter: "MS_AC_SETUP_PLSETUP", loginid: user?.loginid || "", code1: user?.company_code || "" }));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load P&L setup" });
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

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      accessorFn: (row) => String(getLookupValue(row, "h_code") || ""),
      id: "h_code",
      header: "H Code",
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "pl_code") || ""),
      id: "pl_code",
      header: "PL Code",
      cell: ({ getValue }) => <span className="font-medium">{String(getValue() || "")}</span>,
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "pl_name") || ""),
      id: "pl_name",
      header: "PL Name",
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "pl_type") || ""),
      id: "pl_type",
      header: "Type",
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "prv_code") || ""),
      id: "prv_code",
      header: "Previous",
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)}><Trash2 size={15} /></Button>
        </div>
      ),
    },
  ], []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await executeCommonProcedure({
        parameter: "PROC_MS_AC_PLSETUP_DELETE",
        loginid: user?.loginid || "",
        val1s1: user?.company_code || "",
        val1s2: String(getLookupValue(deleteTarget, "pl_code") || ""),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "P&L setup deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete P&L setup" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Master</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">P&L Setup</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Add P&L Setting</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Setup Records"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search P&L setup..."
        loading={loading}
        emptyText="No P&L setup records found"
        height={670}
        density="grid"
        getRowId={(row, index) => `${getLookupValue(row, "pl_code") || index}`}
      />

      {editor && (
        <Dialog
          open
          title={`${editor.mode === "create" ? "Create" : "Edit"} P&L Setting`}
          description="P&L setup details"
          onClose={() => setEditor(null)}
        >
          <PLSetupEditor
            editor={editor}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setNotice({ type: "success", message: editor.mode === "edit" ? "P&L setup updated successfully" : "P&L setup added successfully" });
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
          title="Delete P&L Setup"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void handleDelete()}>Delete</Button>
              
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{String(getLookupValue(deleteTarget, "pl_code") || "")}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function PLSetupEditor({ editor, onClose, onSaved }: { editor: Exclude<Editor, null>; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const isEdit = editor.mode === "edit";
  const [form, setForm] = useState<PLForm>(() => mapPLForm(editor.mode === "edit" ? editor.row : undefined, user?.company_code || ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof PLForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.pl_code || !form.pl_name || !form.pl_type) {
      setError("PL Code, PL Name and PL Type are required.");
      return;
    }
    try {
      setSaving(true);
      await postFinance("insUpdMSACPLSetup", { data: [{ ...form, company_code: user?.company_code || form.company_code }] });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save P&L setup");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[360px] flex-col">
      <div className="border-b pb-3">
        <p className="eyebrow">{isEdit ? "Modify" : "Create"}</p>
        <h2 className="m-0 text-xl font-semibold tracking-tight">P&L Setting</h2>
      </div>
      <form className="grid flex-1 content-start gap-4 overflow-auto py-4" id="pl-setup-form" onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>PL Code</span>
            <Input value={form.pl_code} onChange={(e) => setField("pl_code", e.target.value)} disabled={isEdit} />
          </label>
          <label className="field">
            <span>PL Type</span>
            <Select value={form.pl_type} onChange={(e) => setField("pl_type", e.target.value)} disabled={isEdit}>
              <option value="">Select type</option>
              <option value="P">P</option>
              <option value="L">L</option>
              <option value="B">B</option>
            </Select>
          </label>
          <label className="field">
            <span>H Code</span>
            <Input value={form.h_code} onChange={(e) => setField("h_code", e.target.value)} disabled={isEdit} />
          </label>
          <label className="field">
            <span>Previous Code</span>
            <Input value={form.prv_code} onChange={(e) => setField("prv_code", e.target.value)} disabled={isEdit} />
          </label>
        </div>
        <label className="field">
          <span>PL Name</span>
          <Input value={form.pl_name} onChange={(e) => setField("pl_name", e.target.value)} />
        </label>
      </form>
      <div className="flex items-center justify-end gap-2 border-t bg-card pt-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button disabled={saving} type="submit" form="pl-setup-form">
          {saving ? <span className="spinner small" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

function mapPLForm(row: LookupRow | undefined, companyCode: string): PLForm {
  if (!row) return { ...EMPTY_PL, company_code: companyCode };
  return {
    company_code: String(getLookupValue(row, "company_code") || companyCode),
    h_code: String(getLookupValue(row, "h_code") || ""),
    pl_code: String(getLookupValue(row, "pl_code") || ""),
    pl_name: String(getLookupValue(row, "pl_name") || ""),
    pl_type: String(getLookupValue(row, "pl_type") || ""),
    prv_code: String(getLookupValue(row, "prv_code") || ""),
  };
}