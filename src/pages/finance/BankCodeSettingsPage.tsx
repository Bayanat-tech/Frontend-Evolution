import { Edit2, Eye, RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  executeDynamicDelete,
  executeDynamicMutation,
  getDynamicLookup,
  getLookupText,
  getLookupValue,
  LookupRow,
} from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { useAuth } from "../../state/AuthContext";

type BankCodeFormState = {
  ac_code: string;
  ac_name: string;
  bank_ac_code: string;
  bank_address: string;
  last_cheque_no: string;
  chq_template: string;
  words_length: string;
};

type EditorState =
  | { mode: "edit"; row: LookupRow }
  | { mode: "view"; row: LookupRow }
  | null;

const EMPTY_FORM: BankCodeFormState = {
  ac_code: "",
  ac_name: "",
  bank_ac_code: "",
  bank_address: "",
  last_cheque_no: "",
  chq_template: "",
  words_length: "",
};

export function BankCodeSettingsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<LookupRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "BANK_CODE_SETTINGS_PAGE",
        loginid: user?.loginid || "",
        code1: user?.company_code || "",
        code2: "NULL",
        code3: "NULL",
        code4: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      setRows(data);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load bank codes" });
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
  }, [query, rows]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      accessorFn: (row) => String(getLookupValue(row, "ac_code") || ""),
      id: "ac_code",
      header: "Bank Code",
      cell: ({ getValue }) => <span className="font-medium">{String(getValue() || "")}</span>,
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "ac_name") || ""),
      id: "ac_name",
      header: "A/c Name",
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "bank_ac_code") || ""),
      id: "bank_ac_code",
      header: "Bank A/C",
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "bank_address") || ""),
      id: "bank_address",
      header: "Bank Address",
      cell: ({ getValue }) => <span className="block max-w-[220px] truncate">{String(getValue() || "")}</span>,
    },
    {
      accessorFn: (row) => String(getLookupValue(row, "last_cheque_no") || ""),
      id: "last_cheque_no",
      header: "Last Cheque No",
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "AC_BANK_CODE_DELETE",
        loginid: user?.loginid || "",
        code1: String(getLookupValue(deleteTarget, "ac_code") || ""),
        code2: user?.company_code || "",
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Bank code deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete bank code" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Master</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Bank Code Settings</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Bank Accounts"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search bank code..."
        loading={loading}
        emptyText="No bank codes found"
        height={670}
        density="grid"
        getRowId={(row, index) => `${getLookupValue(row, "ac_code") || index}`}
      />

      {editor && (
        <Dialog
          open
          title={`${editor.mode === "edit" ? "Edit" : "View"} Bank Code`}
          description="Bank account details"
          onClose={() => setEditor(null)}
        >
          <BankCodeEditor
            editor={editor}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setNotice({ type: "success", message: "Bank code updated successfully" });
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
          title="Delete Bank Code"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void handleDelete()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">
            Delete <strong>{String(getLookupValue(deleteTarget, "ac_code") || "")}</strong>?
          </p>
        </Dialog>
      )}
    </section>
  );
}

function BankCodeEditor({
  editor,
  onClose,
  onSaved,
}: {
  editor: Exclude<EditorState, null>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const readOnly = editor.mode === "view";
  const [form, setForm] = useState<BankCodeFormState>(() => mapBankCodeForm(editor.row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof BankCodeFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setError("");
    if (!form.ac_code || !form.bank_ac_code) {
      setError("Account Code and Bank Account Code are required.");
      return;
    }

    try {
      setSaving(true);
      await executeDynamicMutation({
        parameter: "AC_BANK_CODE",
        loginid: user?.loginid || "",
        val1s1: form.ac_code,
        val1s2: user?.company_code || "",
        val1s3: form.bank_ac_code,
        val1s4: form.bank_address,
        val1s5: form.chq_template,
        val1n1: Number(form.last_cheque_no || 0),
        val1n2: Number(form.words_length || 0),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save bank code");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[360px] flex-col">
      <div className="border-b pb-3">
        <p className="eyebrow">{editor.mode === "edit" ? "Modify" : "View"}</p>
        <h2 className="m-0 text-xl font-semibold tracking-tight">Bank Code</h2>
      </div>
      <form className="grid flex-1 content-start gap-4 overflow-auto py-4" id="bank-code-form" onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}
        <LookupField
          label="Account"
          value={form.ac_code}
          displayValue={form.ac_code ? `${form.ac_code} - ${form.ac_name}` : ""}
          columns={[
            { field: "ac_code", header: "Account Code" },
            { field: "ac_name", header: "Account Name" },
          ]}
          valueField="ac_code"
          displayFields={["ac_code", "ac_name"]}
          disabled={readOnly || editor.mode === "edit"}
          loadOptions={() => getDynamicLookup({ parameter: "AC_ACCOUNT_CODE_LIST", loginid: user?.loginid || "" })}
          onChange={(value, row) => {
            setForm((prev) => ({
              ...prev,
              ac_code: value,
              ac_name: row ? getLookupText(row, ["ac_name"]) : "",
            }));
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>Bank Account Code</span>
            <Input value={form.bank_ac_code} onChange={(e) => setField("bank_ac_code", e.target.value)} disabled={readOnly} />
          </label>
          <label className="field">
            <span>Last Cheque No</span>
            <Input type="number" value={form.last_cheque_no} onChange={(e) => setField("last_cheque_no", e.target.value)} disabled={readOnly} />
          </label>
        </div>
        <label className="field">
          <span>Bank Address</span>
          <textarea className="ui-textarea" value={form.bank_address} onChange={(e) => setField("bank_address", e.target.value)} disabled={readOnly} />
        </label>
      </form>
      <div className="flex items-center justify-end gap-2 border-t bg-card pt-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!readOnly && (
          <Button disabled={saving} type="submit" form="bank-code-form">
            {saving ? <span className="spinner small" /> : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}

function mapBankCodeForm(row?: LookupRow): BankCodeFormState {
  if (!row) return EMPTY_FORM;
  return {
    ac_code: String(getLookupValue(row, "ac_code") || ""),
    ac_name: String(getLookupValue(row, "ac_name") || ""),
    bank_ac_code: String(getLookupValue(row, "bank_ac_code") || ""),
    bank_address: String(getLookupValue(row, "bank_address") || ""),
    last_cheque_no: String(getLookupValue(row, "last_cheque_no") || ""),
    chq_template: String(getLookupValue(row, "chq_template") || ""),
    words_length: String(getLookupValue(row, "words_length") || ""),
  };
}