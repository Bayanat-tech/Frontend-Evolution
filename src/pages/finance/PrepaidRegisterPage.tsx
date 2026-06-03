import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
// Card removed: editor will open in modal Dialog like asset group
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type PrepaidRow = {
  company_code: string;
  doc_type: string;
  doc_no: string;
  doc_date: string;
  div_code: string;
  div_name: string;
  description: string;
  remarks: string;
  amount: string;
  amount_dr_cr: string;
  daily_rate: string;
  lcur_amount: string;
  monthly_amount: string;
  credit_ac: string;
  credit_ac_name: string;
  debit_ac: string;
  debit_ac_name: string;
  start_date: string;
  end_date: string;
  opening_amount: string;
  allocated_amount: string;
  balance_amount: string;
  ac_exp_code: string;
  ac_exp_name: string;
  exp_type_code: string;
  exp_type_name: string;
  exp_subtype_code: string;
  exp_subtype_name: string;
  grouping: string;
  grouping_name: string;
};

type EditorState =
  | { mode: "create"; row?: undefined }
  | { mode: "edit"; row: PrepaidRow }
  | { mode: "view"; row: PrepaidRow }
  | null;

const EMPTY_PREPAID: PrepaidRow = {
  company_code: "",
  doc_type: "PRE",
  doc_no: "",
  doc_date: today(),
  div_code: "",
  div_name: "",
  description: "",
  remarks: "",
  amount: "0.000",
  amount_dr_cr: "DR",
  daily_rate: "1.000",
  lcur_amount: "0.000",
  monthly_amount: "0.000",
  credit_ac: "",
  credit_ac_name: "",
  debit_ac: "",
  debit_ac_name: "",
  start_date: "",
  end_date: "",
  opening_amount: "0.000",
  allocated_amount: "0.000",
  balance_amount: "0.000",
  ac_exp_code: "",
  ac_exp_name: "",
  exp_type_code: "",
  exp_type_name: "",
  exp_subtype_code: "",
  exp_subtype_name: "",
  grouping: "",
  grouping_name: "",
};

export function PrepaidRegisterPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [rows, setRows] = useState<PrepaidRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrepaidRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_PREPAID_PREPAID_PAGE",
        loginid: loginId,
        code1: companyCode,
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
      const seen = new Set<string>();
      const mapped = data.map(mapPrepaid).filter((row) => {
        const key = row.doc_no || `${row.doc_type}_${row.description}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setRows(mapped);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load prepaid register" });
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

  const columns = useMemo<ColumnDef<PrepaidRow>[]>(() => [
    { accessorKey: "doc_no", header: "Doc No", size: 130, cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span> },
    { accessorKey: "doc_date", header: "Doc Date", size: 120 },
    { accessorKey: "div_code", header: "Division", size: 110 },
    { accessorKey: "description", header: "Description", size: 240 },
    { accessorKey: "amount", header: "Amount", size: 120 },
    { accessorKey: "balance_amount", header: "Balance", size: 120 },
    { accessorKey: "monthly_amount", header: "Monthly", size: 120 },
    { accessorKey: "credit_ac", header: "Credit A/C", size: 140 },
    { accessorKey: "debit_ac", header: "Debit A/C", size: 140 },
    { accessorKey: "start_date", header: "Start", size: 115 },
    { accessorKey: "end_date", header: "End", size: 115 },
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
        parameter: "AC_PREPAID_DELETE",
        loginid: loginId,
        code1: deleteTarget.doc_no,
        code2: companyCode,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Prepaid record deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete prepaid record" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Asset Utility</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Prepaid Register</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Create Prepaid</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Prepaid Records"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search document, account, description..."
        loading={loading}
        emptyText="No prepaid records found"
        height={650}
        minWidth={1500}
        density="grid"
        getRowId={(row, index) => `${row.doc_no || "new"}_${index}`}
      />

      {editor && (
        <Dialog
          open
          wide
          title={`${editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Edit" : "View"} Prepaid Record`}
          description="Prepaid details"
          onClose={() => setEditor(null)}
        >
          <PrepaidEditor
            editor={editor}
            companyCode={companyCode}
            loginId={loginId}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setNotice({ type: "success", message: "Prepaid record saved successfully" });
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
          title="Delete Prepaid"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.doc_no || "this prepaid record"}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function PrepaidEditor({
  editor,
  companyCode,
  loginId,
  onClose,
  onSaved,
}: {
  editor: Exclude<EditorState, null>;
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const readOnly = editor.mode === "view";
  const isEdit = editor.mode === "edit";
  const [form, setForm] = useState<PrepaidRow>(() => ({ ...EMPTY_PREPAID, company_code: companyCode, ...(editor.row || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const amount = number(form.amount);
    const rate = number(form.daily_rate);
    const lcur = (amount * rate).toFixed(3);
    if (form.lcur_amount !== lcur) setForm((prev) => ({ ...prev, lcur_amount: lcur }));
  }, [form.amount, form.daily_rate]);

  const setField = (field: keyof PrepaidRow, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const setAmount = (field: keyof PrepaidRow, value: string) => setField(field, money(value));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!form.doc_date || !form.credit_ac || !form.debit_ac || !form.amount) {
      setError("Doc Date, Credit A/C, Debit A/C and Amount are required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await postFinance("upsertPrepaid", {
        ...form,
        company_code: companyCode,
        doc_type: "PRE",
        doc_no: form.doc_no ? Number(form.doc_no) : null,
        amount: number(form.amount),
        daily_rate: number(form.daily_rate),
        lcur_amount: number(form.lcur_amount),
        monthly_amount: number(form.monthly_amount),
        opening_amount: number(form.opening_amount),
        allocated_amount: number(form.allocated_amount),
        balance_amount: number(form.balance_amount),
        total_allocated_amount: number(form.allocated_amount),
        user_id: loginId,
        loginid: loginId,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save prepaid record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[690px] flex-col">
      <div className="border-b p-4">
        <p className="eyebrow">{editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Modify" : "View"}</p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold tracking-tight">Prepaid Register</h2>
            <p className="mt-1 text-xs text-muted-foreground">Doc No: {form.doc_no || "Autogenerated"}</p>
          </div>
          <div className="rounded-md border bg-secondary px-3 py-2 text-right">
            <span className="block text-[11px] uppercase text-muted-foreground">Balance</span>
            <strong>{form.balance_amount || "0.000"}</strong>
          </div>
        </div>
      </div>

      <form className="grid flex-1 content-start gap-4 overflow-auto p-4" id="prepaid-register-form" onSubmit={handleSubmit}>
        <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

        <div className="grid grid-cols-3 gap-3">
          <Field label="Doc No" value={form.doc_no} onChange={(value) => setField("doc_no", value)} disabled={readOnly || isEdit} />
          <Field label="Doc Date" type="date" value={form.doc_date} onChange={(value) => setField("doc_date", value)} disabled={readOnly} />
          <Lookup
            label="Division"
            parameter="Account_division"
            value={form.div_code}
            displayValue={display(form.div_code, form.div_name)}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]}
            companyCode={companyCode}
            disabled={readOnly}
            onSelect={(value, row) => {
              setField("div_code", value);
              setField("div_name", String(getLookupValue(row || {}, "div_name") || ""));
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Lookup
            label="Credit A/C *"
            parameter="AC_PREPAID_GET_CREDIT_AC"
            value={form.credit_ac}
            displayValue={display(form.credit_ac, form.credit_ac_name)}
            valueField="ac_code"
            displayFields={["ac_code", "ac_name"]}
            columns={accountColumns}
            companyCode={companyCode}
            disabled={readOnly}
            onSelect={(value, row) => {
              setField("credit_ac", value);
              setField("credit_ac_name", String(getLookupValue(row || {}, "ac_name") || ""));
            }}
          />
          <Lookup
            label="Debit A/C *"
            parameter="AC_PREPAID_GET_DEBIT_AC"
            value={form.debit_ac}
            displayValue={display(form.debit_ac, form.debit_ac_name)}
            valueField="ac_code"
            displayFields={["ac_code", "ac_name"]}
            columns={accountColumns}
            companyCode={companyCode}
            disabled={readOnly}
            onSelect={(value, row) => {
              setField("debit_ac", value);
              setField("debit_ac_name", String(getLookupValue(row || {}, "ac_name") || ""));
            }}
          />
        </div>

        <Field label="Description" value={form.description} onChange={(value) => setField("description", value)} disabled={readOnly} />
        <label className="field">
          <span>Remarks</span>
          <textarea className="ui-textarea min-h-[74px]" value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} disabled={readOnly} />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Start Date" type="date" value={form.start_date} onChange={(value) => setField("start_date", value)} disabled={readOnly} />
          <Field label="End Date" type="date" value={form.end_date} onChange={(value) => setField("end_date", value)} disabled={readOnly} />
          <label className="field">
            <span>DR/CR</span>
            <Select value={form.amount_dr_cr} onChange={(event) => setField("amount_dr_cr", event.target.value)} disabled={readOnly}>
              <option value="DR">DR</option>
              <option value="CR">CR</option>
            </Select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Amount *" value={form.amount} onChange={(value) => setField("amount", value)} onBlur={(value) => setAmount("amount", value)} disabled={readOnly} numeric />
          <Field label="Daily Rate" value={form.daily_rate} onChange={(value) => setField("daily_rate", value)} onBlur={(value) => setAmount("daily_rate", value)} disabled={readOnly} numeric />
          <Field label="LCur Amount" value={form.lcur_amount} onChange={(value) => setField("lcur_amount", value)} disabled numeric />
          <Field label="Monthly Amount" value={form.monthly_amount} onChange={(value) => setField("monthly_amount", value)} onBlur={(value) => setAmount("monthly_amount", value)} disabled={readOnly} numeric />
          <Field label="Opening Amount" value={form.opening_amount} onChange={(value) => setField("opening_amount", value)} onBlur={(value) => setAmount("opening_amount", value)} disabled={readOnly} numeric />
          <Field label="Allocated Amount" value={form.allocated_amount} onChange={(value) => setField("allocated_amount", value)} onBlur={(value) => setAmount("allocated_amount", value)} disabled={readOnly} numeric />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Lookup
            label="Grouping"
            parameter="AC_PREPAID_GET_GROUPING"
            value={form.grouping}
            displayValue={display(form.grouping, form.grouping_name)}
            valueField="group_code"
            displayFields={["group_code", "group_desc"]}
            columns={[{ field: "group_code", header: "Group" }, { field: "group_desc", header: "Description" }]}
            companyCode={companyCode}
            disabled={readOnly}
            onSelect={(value, row) => {
              setField("grouping", value);
              setField("grouping_name", String(getLookupValue(row || {}, "group_desc") || ""));
            }}
          />
          <Lookup
            label="Expense Type"
            parameter="AC_PREPAID_GET_EXP_TYPE"
            value={form.exp_type_code}
            displayValue={display(form.exp_type_code, form.exp_type_name)}
            valueField="exp_type_code"
            displayFields={["exp_type_code", "exp_type_description"]}
            columns={[{ field: "exp_type_code", header: "Type" }, { field: "exp_type_description", header: "Description" }]}
            companyCode={companyCode}
            disabled={readOnly}
            onSelect={(value, row) => {
              setField("exp_type_code", value);
              setField("exp_type_name", String(getLookupValue(row || {}, "exp_type_description") || ""));
              setField("exp_subtype_code", "");
              setField("exp_subtype_name", "");
            }}
          />
          <Lookup
            label="Expense Sub Type"
            parameter="AC_PREPAID_GET_EXP_SUBTYPE"
            value={form.exp_subtype_code}
            displayValue={display(form.exp_subtype_code, form.exp_subtype_name)}
            valueField="exp_subtype_code"
            displayFields={["exp_subtype_code", "exp_subtype_description"]}
            columns={[{ field: "exp_subtype_code", header: "Sub Type" }, { field: "exp_subtype_description", header: "Description" }]}
            companyCode={companyCode}
            code2={form.exp_type_code}
            disabled={readOnly || !form.exp_type_code}
            onSelect={(value, row) => {
              setField("exp_subtype_code", value);
              setField("exp_subtype_name", String(getLookupValue(row || {}, "exp_subtype_description") || ""));
            }}
          />
          <Lookup
            label="Expense Code"
            parameter="AC_PREPAID_GET_MS_AC_EXPCODE"
            value={form.ac_exp_code}
            displayValue={display(form.ac_exp_code, form.ac_exp_name)}
            valueField="exp_code"
            displayFields={["exp_code", "exp_description"]}
            columns={[{ field: "exp_code", header: "Exp Code" }, { field: "exp_description", header: "Description" }]}
            companyCode={companyCode}
            code2={form.exp_type_code}
            disabled={readOnly}
            onSelect={(value, row) => {
              setField("ac_exp_code", value);
              setField("ac_exp_name", String(getLookupValue(row || {}, "exp_description") || ""));
            }}
          />
        </div>
      </form>

      <div className="flex items-center justify-end gap-2 border-t bg-card p-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!readOnly && <Button disabled={saving} type="submit" form="prepaid-register-form">{saving ? <span className="spinner small" /> : <Save size={15} />} Save</Button>}
      </div>
    </div>
  );
}

function Lookup({
  label,
  parameter,
  value,
  displayValue,
  valueField,
  displayFields,
  columns,
  companyCode,
  code2 = "",
  disabled,
  onSelect,
}: {
  label: string;
  parameter: string;
  value: string;
  displayValue: string;
  valueField: string;
  displayFields: string[];
  columns: { field: string; header: string }[];
  companyCode: string;
  code2?: string;
  disabled?: boolean;
  onSelect: (value: string, row: LookupRow | null) => void;
}) {
  return (
    <LookupField
      label={label}
      value={value}
      displayValue={displayValue}
      columns={columns}
      valueField={valueField}
      displayFields={displayFields}
      disabled={disabled}
      loadOptions={() =>
        getDynamicLookup({
          parameter,
          code1: companyCode,
          code2,
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
        })
      }
      onChange={onSelect}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  disabled,
  type = "text",
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "date";
  numeric?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input
        className={numeric ? "text-right tabular-nums" : ""}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

const accountColumns = [
  { field: "ac_code", header: "A/C Code" },
  { field: "ac_name", header: "A/C Name" },
];

function mapPrepaid(row: LookupRow): PrepaidRow {
  return {
    ...EMPTY_PREPAID,
    company_code: String(getLookupValue(row, "company_code") || ""),
    doc_type: String(getLookupValue(row, "doc_type") || "PRE"),
    doc_no: String(getLookupValue(row, "doc_no") || ""),
    doc_date: dateInput(getLookupValue(row, "doc_date")),
    div_code: String(getLookupValue(row, "div_code") || ""),
    div_name: String(getLookupValue(row, "div_name") || ""),
    description: String(getLookupValue(row, "description") || ""),
    remarks: String(getLookupValue(row, "remarks") || ""),
    amount: money(getLookupValue(row, "amount")),
    amount_dr_cr: String(getLookupValue(row, "amount_dr_cr") || "DR"),
    daily_rate: money(getLookupValue(row, "daily_rate") || 1),
    lcur_amount: money(getLookupValue(row, "lcur_amount")),
    monthly_amount: money(getLookupValue(row, "monthly_amount")),
    credit_ac: String(getLookupValue(row, "credit_ac") || ""),
    credit_ac_name: String(getLookupValue(row, "credit_ac_name") || getLookupValue(row, "credit_name") || ""),
    debit_ac: String(getLookupValue(row, "debit_ac") || ""),
    debit_ac_name: String(getLookupValue(row, "debit_ac_name") || getLookupValue(row, "debit_name") || ""),
    start_date: dateInput(getLookupValue(row, "start_date")),
    end_date: dateInput(getLookupValue(row, "end_date")),
    opening_amount: money(getLookupValue(row, "opening_amount")),
    allocated_amount: money(getLookupValue(row, "allocated_amount") || getLookupValue(row, "total_allocated_amount")),
    balance_amount: money(getLookupValue(row, "balance_amount")),
    ac_exp_code: String(getLookupValue(row, "ac_exp_code") || ""),
    ac_exp_name: String(getLookupValue(row, "ac_exp_name") || getLookupValue(row, "exp_description") || ""),
    exp_type_code: String(getLookupValue(row, "exp_type_code") || ""),
    exp_type_name: String(getLookupValue(row, "exp_type_name") || getLookupValue(row, "exp_type_description") || ""),
    exp_subtype_code: String(getLookupValue(row, "exp_subtype_code") || ""),
    exp_subtype_name: String(getLookupValue(row, "exp_subtype_name") || getLookupValue(row, "exp_subtype_description") || ""),
    grouping: String(getLookupValue(row, "grouping") || getLookupValue(row, "group_code") || ""),
    grouping_name: String(getLookupValue(row, "grouping_name") || getLookupValue(row, "group_desc") || ""),
  };
}

function display(code: string, name: string) {
  if (!code) return "";
  return name ? `${code} - ${name}` : code;
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return number(value).toFixed(3);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}
