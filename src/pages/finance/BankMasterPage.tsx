import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "../../api/client";
import { getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { useAuth } from "../../state/AuthContext";

type BankRow = {
  bank_code: string;
  bank_name: string;
  company_code: string;
  bank_short_name: string;
  main_bank_code: string;
  country_code: string;
  bank_addr1: string;
  phone: string;
  fax: string;
  email: string;
  remarks: string;
  status: string;
};

type EditorState =
  | { mode: "create"; row?: undefined }
  | { mode: "edit"; row: BankRow }
  | { mode: "view"; row: BankRow }
  | null;

const EMPTY_BANK: BankRow = {
  bank_code: "",
  bank_name: "",
  company_code: "",
  bank_short_name: "",
  main_bank_code: "",
  country_code: "",
  bank_addr1: "",
  phone: "",
  fax: "",
  email: "",
  remarks: "",
  status: "",
};

export function BankMasterPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BankRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await api.get("/api/hr/bank");
      const tableData = response.data?.data?.tableData || response.data?.data || [];
      setRows((Array.isArray(tableData) ? tableData : []).map(mapBank));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load banks" });
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

  const columns = useMemo<ColumnDef<BankRow>[]>(() => [
    {
      accessorKey: "bank_code",
      header: "Bank Code",
      cell: ({ getValue }) => <span className="font-medium">{String(getValue() || "")}</span>,
    },
    { accessorKey: "bank_name", header: "Bank Name" },
    { accessorKey: "bank_short_name", header: "Short Name" },
    { accessorKey: "main_bank_code", header: "Main Bank" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "status", header: "Status" },
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
      await api.post("/api/hr/bank", { ids: [deleteTarget.bank_code] });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Bank deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete bank" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Master</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Bank Master</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Add Bank</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="grid min-h-[620px] grid-cols-[minmax(0,1fr)_410px] gap-4 max-xl:grid-cols-1">
        <DataTable
          columns={columns}
          data={filteredRows}
          title={loading ? "Loading" : `${filteredRows.length} Records`}
          subtitle="Banks"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search bank..."
          loading={loading}
          emptyText="No banks found"
          height={590}
          minWidth={960}
          density="grid"
          getRowId={(row, index) => `${row.bank_code}_${index}`}
        />

        <Card className="overflow-hidden">
          {editor ? (
            <BankEditor editor={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice({ type: "success", message: editor.mode === "edit" ? "Bank updated successfully" : "Bank added successfully" }); await loadRows(false); }} />
          ) : (
            <div className="grid min-h-[620px] place-items-center p-8 text-center text-muted-foreground">
              <div>
                <p className="eyebrow">No Form Open</p>
                <h2 className="m-0 text-lg font-semibold text-foreground">Select a bank or add one</h2>
                <p className="mt-2 text-sm">The form opens here so the table remains visible.</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Bank"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.bank_code}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function BankEditor({ editor, onClose, onSaved }: { editor: Exclude<EditorState, null>; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const readOnly = editor.mode === "view";
  const isEdit = editor.mode === "edit";
  const [form, setForm] = useState<BankRow>(() => ({ ...EMPTY_BANK, company_code: user?.company_code || "", ...(editor.row || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof BankRow, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setError("");
    if (!form.bank_code || !form.bank_name || !form.main_bank_code || !form.bank_addr1) {
      setError("Bank Code, Bank Name, Main Bank Code and Address are required.");
      return;
    }

    try {
      setSaving(true);
      if (isEdit) {
        await api.put("/api/HR/gm/bank", form);
      } else {
        await api.post("/api/HR/gm/bank", form);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save bank");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[620px] flex-col">
      <div className="border-b p-4">
        <p className="eyebrow">{editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Modify" : "View"}</p>
        <h2 className="m-0 text-xl font-semibold tracking-tight">Bank</h2>
      </div>
      <form className="grid flex-1 content-start gap-4 overflow-auto p-4" id="bank-master-form" onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}
        <Field label="Bank Code" value={form.bank_code} onChange={(value) => setField("bank_code", value)} disabled={readOnly || isEdit} />
        <Field label="Bank Name" value={form.bank_name} onChange={(value) => setField("bank_name", value)} disabled={readOnly} />
        <Field label="Short Name" value={form.bank_short_name} onChange={(value) => setField("bank_short_name", value)} disabled={readOnly} />
        <Field label="Main Bank Code" value={form.main_bank_code} onChange={(value) => setField("main_bank_code", value)} disabled={readOnly} />
        <Field label="Country Code" value={form.country_code} onChange={(value) => setField("country_code", value)} disabled={readOnly} />
        <Field label="Phone" value={form.phone} onChange={(value) => setField("phone", value)} disabled={readOnly} />
        <Field label="Fax" value={form.fax} onChange={(value) => setField("fax", value)} disabled={readOnly} />
        <Field label="Email" value={form.email} onChange={(value) => setField("email", value)} disabled={readOnly} />
        <label className="field">
          <span>Address</span>
          <textarea className="ui-textarea" value={form.bank_addr1} onChange={(event) => setField("bank_addr1", event.target.value)} disabled={readOnly} />
        </label>
        <label className="field">
          <span>Remarks</span>
          <textarea className="ui-textarea" value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} disabled={readOnly} />
        </label>
      </form>
      <div className="flex items-center justify-end gap-2 border-t bg-card p-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!readOnly && <Button disabled={saving} type="submit" form="bank-master-form">{saving ? <span className="spinner small" /> : "Save"}</Button>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

function mapBank(row: LookupRow): BankRow {
  return {
    bank_code: String(getLookupValue(row, "bank_code") || ""),
    bank_name: String(getLookupValue(row, "bank_name") || ""),
    company_code: String(getLookupValue(row, "company_code") || ""),
    bank_short_name: String(getLookupValue(row, "bank_short_name") || ""),
    main_bank_code: String(getLookupValue(row, "main_bank_code") || ""),
    country_code: String(getLookupValue(row, "country_code") || ""),
    bank_addr1: String(getLookupValue(row, "bank_addr1") || ""),
    phone: String(getLookupValue(row, "phone") || ""),
    fax: String(getLookupValue(row, "fax") || ""),
    email: String(getLookupValue(row, "email") || ""),
    remarks: String(getLookupValue(row, "remarks") || ""),
    status: String(getLookupValue(row, "status") || ""),
  };
}
