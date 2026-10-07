import { Edit2, Eye, FileText, Plus, Save, Trash2, X } from "lucide-react";
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
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { LookupField } from "../../components/ui/LookupField";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
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

const inputClass =
  "h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function BankCodeSettingsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<LookupRow | null>(null);
  const [draftRows, setDraftRows] = useState<LookupRow[]>([]);

  const addDraftRow = () => {
    setNotice(null);
    setDraftRows((prev) => [
      {
        __draft: true,
        __id: `${Date.now()}_${prev.length}`,
        ac_code: "",
        ac_name: "",
        bank_ac_code: "",
        bank_address: "",
        last_cheque_no: "",
        chq_template: "",
        words_length: "",
      } as LookupRow,
      ...prev,
    ]);
  };

  const updateDraftRow = (id: string, key: string, value: string) =>
    setDraftRows((prev) =>
      prev.map((row) =>
        rowDraftId(row) === id ? ({ ...row, [key]: value } as LookupRow) : row
      )
    );

  const removeDraftRow = (id: string) =>
    setDraftRows((prev) => prev.filter((row) => rowDraftId(row) !== id));

  const handleSaveAll = async () => {
    setNotice(null);

    const companyCode = user?.company_code || "";
    if (!companyCode) {
      setNotice({ type: "error", message: "Company code is required" });
      return;
    }

    // Draft rows that have an account code
    const draftPayload = draftRows
      .map((row) => ({
        company_code: companyCode,
        ac_code: cellValue(row, "ac_code").trim(),
        bank_ac_code: cellValue(row, "bank_ac_code").trim() || null,
        bank_address: cellValue(row, "bank_address").trim() || null,
        last_cheque_no: cellValue(row, "last_cheque_no").trim() || null,
        chq_template: cellValue(row, "chq_template").trim() || null,
        words_length: (() => {
          const v = cellValue(row, "words_length").trim();
          return v === "" ? null : Number(v);
        })(),
      }))
      .filter((r) => r.ac_code);

    // Existing loaded rows
    const existingPayload = rows.map((row) => {
      const form = mapBankCodeForm(row);
      return {
        company_code: companyCode,
        ac_code: form.ac_code.trim(),
        bank_ac_code: form.bank_ac_code.trim() || null,
        bank_address: form.bank_address.trim() || null,
        last_cheque_no: form.last_cheque_no.trim() || null,
        chq_template: form.chq_template.trim() || null,
        words_length:
          form.words_length.trim() === ""
            ? null
            : Number(form.words_length),
      };
    }).filter((r) => r.ac_code);

    // Dedupe by ac_code (draft wins over existing if same code)
    const byCode = new Map<string, (typeof draftPayload)[0]>();
    existingPayload.forEach((r) => byCode.set(r.ac_code, r));
    draftPayload.forEach((r) => byCode.set(r.ac_code, r));
    const userRows = Array.from(byCode.values());

    // Marker row so backend can clear company even when list is empty
    const markerRow = {
      company_code: companyCode,
      ac_code: "",
      bank_ac_code: null as string | null,
      bank_address: null as string | null,
      last_cheque_no: null as string | null,
      chq_template: null as string | null,
      words_length: null as number | null,
    };

    const payload = [markerRow, ...userRows];

    try {
      setSaving(true);
      await api.post("/api/finance/bankcode", payload);
      setDraftRows([]);
      setNotice({
        type: "success",
        message:
          userRows.length === 0
            ? "All bank codes cleared successfully"
            : `${userRows.length} bank code(s) saved successfully`,
      });
      await loadRows(false);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.details ||
        (error instanceof Error ? error.message : "Unable to save bank codes");
      setNotice({ type: "error", message: String(msg) });
    } finally {
      setSaving(false);
    }
  };

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
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to load bank codes",
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
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [query, rows]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(
    () => [
      {
        accessorFn: (row) => cellValue(row, "ac_code"),
        id: "ac_code",
        header: "Bank Code",
        cell: ({ row, getValue }) =>
          isDraftRow(row.original) ? (
            <DraftInput
              value={getValue() as string}
              placeholder="Bank code"
              onChange={(v) =>
                updateDraftRow(rowDraftId(row.original), "ac_code", v)
              }
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditor({ mode: "edit", row: row.original })}
              className="font-semibold text-[#00378C] hover:underline cursor-pointer text-left bg-transparent border-none p-0"
              title="Click to edit"
            >
              {String(getValue() || "")}
            </button>
          ),
      },
      {
        accessorFn: (row) => cellValue(row, "ac_name"),
        id: "ac_name",
        header: "A/c Name",
        cell: ({ row, getValue }) =>
          isDraftRow(row.original) ? (
            <DraftInput
              value={getValue() as string}
              placeholder="A/c name"
              onChange={(v) =>
                updateDraftRow(rowDraftId(row.original), "ac_name", v)
              }
            />
          ) : (
            <span>{String(getValue() || "")}</span>
          ),
      },
      {
        accessorFn: (row) => cellValue(row, "bank_ac_code"),
        id: "bank_ac_code",
        header: "Bank A/C",
        cell: ({ row, getValue }) =>
          isDraftRow(row.original) ? (
            <DraftInput
              value={getValue() as string}
              placeholder="Bank A/C"
              onChange={(v) =>
                updateDraftRow(rowDraftId(row.original), "bank_ac_code", v)
              }
            />
          ) : (
            <span>{String(getValue() || "")}</span>
          ),
      },
      {
        accessorFn: (row) => cellValue(row, "bank_address"),
        id: "bank_address",
        header: "Bank Address",
        cell: ({ row, getValue }) =>
          isDraftRow(row.original) ? (
            <DraftInput
              value={getValue() as string}
              placeholder="Bank address"
              onChange={(v) =>
                updateDraftRow(rowDraftId(row.original), "bank_address", v)
              }
            />
          ) : (
            <span className="block max-w-[260px] truncate">
              {String(getValue() || "")}
            </span>
          ),
      },
      {
        accessorFn: (row) => cellValue(row, "last_cheque_no"),
        id: "last_cheque_no",
        header: "Last Cheque No",
        cell: ({ row, getValue }) =>
          isDraftRow(row.original) ? (
            <DraftInput
              type="number"
              value={getValue() as string}
              placeholder="0"
              onChange={(v) =>
                updateDraftRow(rowDraftId(row.original), "last_cheque_no", v)
              }
            />
          ) : (
            <span>{String(getValue() || "")}</span>
          ),
      },
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableSorting: false,
        cell: ({ row }) =>
          isDraftRow(row.original) ? (
            <div className="flex items-center justify-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md"
                title="Remove row"
                onClick={() => removeDraftRow(rowDraftId(row.original))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
                title="View"
                onClick={() => setEditor({ mode: "view", row: row.original })}
              >
                <Eye size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
                title="Edit"
                onClick={() => setEditor({ mode: "edit", row: row.original })}
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
    []
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Soft-remove from UI list; full persist on Save (truncate/replace)
      // OR keep dynamic delete if you still use it:
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
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to delete bank code",
      });
    }
  };

  return (
    <section className="grid gap-2 p-1">
      {editor ? (
        <BankCodeEditor
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            setNotice({ type: "success", message: "Bank code updated successfully" });
            await loadRows(false);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
                <FileText size={14} />
              </div>
              <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">
                Bank Code Settings
              </h1>
            </div>
          </div>

          <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

          <DataTable
            columns={columns}
            data={[...draftRows, ...filteredRows]}
            title={
              loading
                ? "Loading"
                : `${(draftRows.length + filteredRows.length).toLocaleString()} Records`
            }
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search bank code..."
            loading={loading}
            emptyText="No bank codes found"
            height="calc(100dvh - 150px)"
            minWidth={900}
            density="grid"
            enablePagination={false}
            enableExport={false}
            actionButton={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={addDraftRow}
                  disabled={saving}
                  className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-3.5 rounded-lg"
                >
                  <Plus size={14} strokeWidth={2.5} /> Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSaveAll()}
                  disabled={saving}
                  className="h-8 gap-1.5 text-xs font-semibold px-3.5 rounded-lg"
                >
                  <Save size={14} /> {saving ? "Saving…" : "Save"}
                </Button>
                <FinanceListActionsMenu
                  fyPeriod=""
                  fyPeriods={[]}
                  onFyPeriodChange={() => {}}
                  onExport={() =>
                    exportToCsv(
                      filteredRows,
                      columns,
                      `bank-code-settings-${new Date().toISOString().slice(0, 10)}.csv`
                    )
                  }
                  onRefresh={() => void loadRows(false)}
                />
              </div>
            }
            getRowId={(row, index) =>
              isDraftRow(row)
                ? `draft_${rowDraftId(row)}`
                : `${getLookupValue(row, "ac_code") || index}`
            }
          />
        </>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Delete Bank Code"
        description="This action cannot be undone."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Close
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete{" "}
          <strong>
            {deleteTarget
              ? String(getLookupValue(deleteTarget, "ac_code") || "")
              : ""}
          </strong>
          ?
        </p>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor                                                             */
/* ------------------------------------------------------------------ */

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
  const [form, setForm] = useState<BankCodeFormState>(() =>
    mapBankCodeForm(editor.row)
  );
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

    const companyCode = user?.company_code || "";
    if (!companyCode) {
      setError("Company code is required.");
      return;
    }

    try {
      setSaving(true);

      // Single-row save via same bulk API (marker + one row)
      // Load current list is better for full replace — here we only upsert one via mutation
      // Prefer bulk API if your procedure is replace-all:
      // For edit dialog, keep dynamic mutation OR post full list from parent.
      // Using same bankcode API with marker + this row only would wipe others.
      // So editor still uses dynamic mutation for single update:
      await executeDynamicMutation({
        parameter: "AC_BANK_CODE",
        loginid: user?.loginid || "",
        val1s1: form.ac_code,
        val1s2: companyCode,
        val1s3: form.bank_ac_code,
        val1s4: form.bank_address,
        val1s5: form.chq_template,
        val1n1: Number(form.last_cheque_no || 0),
        val1n2: Number(form.words_length || 0),
      });

      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save bank code"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
            <FileText size={14} />
          </div>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">
            {readOnly ? "View Bank Code" : "Edit Bank Code"}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {!readOnly && (
            <Button
              type="submit"
              form="bank-code-form"
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
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            title="Close"
            className="h-7 w-7 rounded-md"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      <form
        id="bank-code-form"
        className="flex flex-col gap-2"
        onSubmit={handleSubmit}
      >
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00378C]/10 text-[#00378C]">
              <FileText size={12} />
            </div>
            <h3 className="m-0 text-xs font-semibold text-slate-800">
              Bank Account Details
            </h3>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2.5">
              <div className="col-span-2">
                <LookupField
                  label="Account"
                  value={form.ac_code}
                  displayValue={
                    form.ac_code ? `${form.ac_code} - ${form.ac_name}` : ""
                  }
                  columns={[
                    { field: "ac_code", header: "Account Code" },
                    { field: "ac_name", header: "Account Name" },
                  ]}
                  valueField="ac_code"
                  displayFields={["ac_code", "ac_name"]}
                  disabled={readOnly || editor.mode === "edit"}
                  loadOptions={() =>
                    getDynamicLookup({
                      parameter: "AC_ACCOUNT_CODE_LIST",
                      loginid: user?.loginid || "",
                    })
                  }
                  onChange={(value, row) => {
                    setForm((prev) => ({
                      ...prev,
                      ac_code: value,
                      ac_name: row ? getLookupText(row, ["ac_name"]) : "",
                    }));
                  }}
                />
              </div>
              <FormField
                label="Bank Account Code"
                value={form.bank_ac_code}
                disabled={readOnly}
                onChange={(value) => setField("bank_ac_code", value)}
              />
              <FormField
                label="Last Cheque No"
                type="number"
                value={form.last_cheque_no}
                disabled={readOnly}
                onChange={(value) => setField("last_cheque_no", value)}
              />
            </div>

            <div className="mt-2.5">
              <label className="mb-1 block text-[11px] font-medium text-slate-600 text-left">
                Bank Address
              </label>
              <textarea
                className="w-full h-[52px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                disabled={readOnly}
                value={form.bank_address}
                onChange={(e) => setField("bank_address", e.target.value)}
              />
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Field                                                         */
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
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isDraftRow(row: LookupRow): boolean {
  return Boolean((row as Record<string, unknown>).__draft);
}

function rowDraftId(row: LookupRow): string {
  return String((row as Record<string, unknown>).__id ?? "");
}

function cellValue(row: LookupRow, key: string): string {
  if (isDraftRow(row)) return String((row as Record<string, unknown>)[key] ?? "");
  return String(getLookupValue(row, key) || "");
}

function DraftInput({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
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