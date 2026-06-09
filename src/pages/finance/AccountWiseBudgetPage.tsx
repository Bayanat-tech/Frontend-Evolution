import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeDynamicDelete, getDynamicLookup, getLookupText, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { useAuth } from "../../state/AuthContext";

type BudgetRow = {
  company_code: string;
  doc_no: string;
  doc_date: string;
  doc_type: string;
  budget_year: string;
  div_code: string;
  div_name: string;
  ac_code: string;
  ac_name: string;
  total_budget: string;
  jan_budget_month: string;
  feb_budget_month: string;
  mar_budget_month: string;
  apr_budget_month: string;
  may_budget_month: string;
  jun_budget_month: string;
  jul_budget_month: string;
  aug_budget_month: string;
  sep_budget_month: string;
  oct_budget_month: string;
  nov_budget_month: string;
  dec_budget_month: string;
};

type EditorState =
  | { mode: "create"; row?: undefined }
  | { mode: "edit"; row: BudgetRow }
  | { mode: "view"; row: BudgetRow }
  | null;

const MONTHS: { field: keyof BudgetRow; label: string }[] = [
  { field: "jan_budget_month", label: "Jan" },
  { field: "feb_budget_month", label: "Feb" },
  { field: "mar_budget_month", label: "Mar" },
  { field: "apr_budget_month", label: "Apr" },
  { field: "may_budget_month", label: "May" },
  { field: "jun_budget_month", label: "Jun" },
  { field: "jul_budget_month", label: "Jul" },
  { field: "aug_budget_month", label: "Aug" },
  { field: "sep_budget_month", label: "Sep" },
  { field: "oct_budget_month", label: "Oct" },
  { field: "nov_budget_month", label: "Nov" },
  { field: "dec_budget_month", label: "Dec" },
];

export function AccountWiseBudgetPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "MS_BUDGET_ACWISE_PAGE",
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
      const seen = new Set<string>();
      setRows(data.map(mapBudgetRow).filter((row) => {
        const key = `${row.company_code}_${row.doc_no}_${row.ac_code}_${row.budget_year}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load account-wise budgets" });
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

  const columns = useMemo<ColumnDef<BudgetRow>[]>(() => [
    { accessorKey: "doc_type", header: "Type" },
    {
      accessorKey: "doc_date",
      header: "Date",
      cell: ({ getValue }) => formatDate(String(getValue() || "")),
    },
    { accessorKey: "budget_year", header: "Year" },
    {
      id: "account",
      header: "Account",
      accessorFn: (row) => `${row.ac_code} ${row.ac_name}`,
      cell: ({ row }) => <span className="block max-w-[220px] truncate">{row.original.ac_code} {row.original.ac_name ? `- ${row.original.ac_name}` : ""}</span>,
    },
    ...MONTHS.map<ColumnDef<BudgetRow>>((month) => ({
      accessorKey: month.field,
      header: month.label,
      cell: ({ getValue }) => <span className="block text-right tabular-nums">{money(getValue())}</span>,
    })),
    {
      accessorKey: "total_budget",
      header: "Total",
      cell: ({ getValue }) => <span className="block text-right font-semibold tabular-nums">{money(getValue())}</span>,
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
        parameter: "ACCOUNT_WISE_BUDGET_DELETE",
        loginid: user?.loginid || "",
        code1: deleteTarget.doc_no,
        code2: user?.company_code || "",
        code3: deleteTarget.ac_code,
        code4: deleteTarget.budget_year,
        code5: "",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Budget deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete budget" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Master</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">A/c Wise Budget</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Create Budget</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Budgets"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search budget..."
        loading={loading}
        emptyText="No budgets found"
        height={670}
        minWidth={1260}
        density="grid"
        getRowId={(row, index) => `${row.doc_no}_${row.ac_code}_${row.budget_year}_${index}`}
      />

      {editor && (
        <Dialog
          open
          wide
          title={`${editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Edit" : "View"} A/c Wise Budget`}
          description="Monthly budget details"
          onClose={() => setEditor(null)}
        >
          <BudgetEditor editor={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice({ type: "success", message: editor.mode === "edit" ? "Budget updated successfully" : "Budget added successfully" }); await loadRows(false); }} />
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Budget"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete budget <strong>{deleteTarget.doc_no || deleteTarget.ac_code}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function BudgetEditor({ editor, onClose, onSaved }: { editor: Exclude<EditorState, null>; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const readOnly = editor.mode === "view";
  const isEdit = editor.mode === "edit";
  const [form, setForm] = useState<BudgetRow>(() => ({
    ...emptyBudget(user?.company_code || ""),
    ...(editor.row || {}),
    doc_date: toInputDate(editor.row?.doc_date) || new Date().toISOString().slice(0, 10),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(() => MONTHS.reduce((sum, month) => sum + numberValue(form[month.field]), 0), [form]);

  const setField = (field: keyof BudgetRow, value: string) => setForm((prev) => ({ ...prev, [field]: value, total_budget: MONTHS.some((month) => month.field === field) ? calcTotal({ ...prev, [field]: value }) : prev.total_budget }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setError("");
    if (!form.budget_year || !form.ac_code || !form.div_code || !form.doc_type) {
      setError("Version, Budget Year, Division and Account are required.");
      return;
    }

    try {
      setSaving(true);
      await postFinance("upsertAcBudget", {
        company_code: form.company_code || user?.company_code || "",
        budget_year: form.budget_year,
        ac_code: form.ac_code,
        div_code: form.div_code,
        doc_no: isEdit ? numberValue(form.doc_no) : 0,
        doc_type: form.doc_type,
        doc_date: form.doc_date,
        jan_budget_month: numberValue(form.jan_budget_month),
        feb_budget_month: numberValue(form.feb_budget_month),
        mar_budget_month: numberValue(form.mar_budget_month),
        apr_budget_month: numberValue(form.apr_budget_month),
        may_budget_month: numberValue(form.may_budget_month),
        jun_budget_month: numberValue(form.jun_budget_month),
        jul_budget_month: numberValue(form.jul_budget_month),
        aug_budget_month: numberValue(form.aug_budget_month),
        sep_budget_month: numberValue(form.sep_budget_month),
        oct_budget_month: numberValue(form.oct_budget_month),
        nov_budget_month: numberValue(form.nov_budget_month),
        dec_budget_month: numberValue(form.dec_budget_month),
        loginid: user?.loginid || "",
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[560px] flex-col">
      <div className="border-b pb-3">
        <p className="eyebrow">{editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Modify" : "View"}</p>
        <div className="flex items-end justify-between gap-3">
          <h2 className="m-0 text-xl font-semibold tracking-tight">A/c Wise Budget</h2>
          <strong className="text-lg tabular-nums">{money(String(total))}</strong>
        </div>
      </div>
      <form className="grid flex-1 content-start gap-4 overflow-auto py-4" id="account-budget-form" onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <LookupField
            label="Version"
            value={form.doc_type}
            displayValue={form.doc_type}
            columns={[
              { field: "version_code", header: "Version" },
              { field: "version_desc", header: "Description" },
            ]}
            valueField="version_code"
            displayFields={["version_code", "version_desc"]}
            disabled={readOnly}
            loadOptions={() => getDynamicLookup({ parameter: "AC_BUDGET_GET_VERSION", loginid: user?.loginid || "", code1: user?.company_code || "" })}
            onChange={(value) => setField("doc_type", value)}
          />
          <label className="field">
            <span>Doc Date</span>
            <Input type="date" value={form.doc_date} onChange={(event) => setField("doc_date", event.target.value)} disabled={readOnly} />
          </label>
          <LookupField
            label="Budget Year"
            value={form.budget_year}
            displayValue={form.budget_year}
            columns={[{ field: "budget_year", header: "Budget Year" }]}
            valueField="budget_year"
            displayFields={["budget_year"]}
            disabled={readOnly}
            loadOptions={() => getDynamicLookup({ parameter: "AC_BUDGET_GET_YEAR", loginid: user?.loginid || "", code1: user?.company_code || "" })}
            onChange={(value) => setField("budget_year", value)}
          />
          <LookupField
            label="Division"
            value={form.div_code}
            displayValue={form.div_code ? `${form.div_code}${form.div_name ? ` - ${form.div_name}` : ""}` : ""}
            columns={[
              { field: "div_code", header: "Division Code" },
              { field: "div_name", header: "Division Name" },
            ]}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            disabled={readOnly}
            loadOptions={() => getDynamicLookup({ parameter: "Account_division", loginid: user?.loginid || "", code1: user?.company_code || "" })}
            onChange={(value, row) => setForm((prev) => ({ ...prev, div_code: value, div_name: row ? getLookupText(row, ["div_name", "DIV_NAME", "division_name"]) : "" }))}
          />
        </div>
        <LookupField
          label="Account"
          value={form.ac_code}
          displayValue={form.ac_code ? `${form.ac_code}${form.ac_name ? ` - ${form.ac_name}` : ""}` : ""}
          columns={[
            { field: "ac_code", header: "Account Code" },
            { field: "ac_name", header: "Account Name" },
          ]}
          valueField="ac_code"
          displayFields={["ac_code", "ac_name"]}
          disabled={readOnly}
          loadOptions={() => getDynamicLookup({ parameter: "MS_BUDGET_ACCOUNT_CODE_LIST", loginid: user?.loginid || "", code1: user?.company_code || "" })}
          onChange={(value, row) => setForm((prev) => ({ ...prev, ac_code: value, ac_name: row ? getLookupText(row, ["ac_name", "AC_NAME", "account_name"]) : "" }))}
        />
        <div className="grid grid-cols-3 gap-3">
          {MONTHS.map((month) => (
            <label className="field" key={month.field}>
              <span>{month.label}</span>
              <Input className="text-right tabular-nums" type="number" value={form[month.field]} onChange={(event) => setField(month.field, event.target.value)} disabled={readOnly} />
            </label>
          ))}
        </div>
        <label className="field">
          <span>Total Budget</span>
          <Input className="text-right font-semibold tabular-nums" value={money(String(total))} disabled />
        </label>
      </form>
      <div className="flex items-center justify-end gap-2 border-t bg-card pt-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!readOnly && <Button disabled={saving} type="submit" form="account-budget-form">{saving ? <span className="spinner small" /> : "Save"}</Button>}
      </div>
    </div>
  );
}

function emptyBudget(companyCode: string): BudgetRow {
  const year = String(new Date().getFullYear());
  return {
    company_code: companyCode,
    doc_no: "",
    doc_date: new Date().toISOString().slice(0, 10),
    doc_type: "BDA",
    budget_year: year,
    div_code: "",
    div_name: "",
    ac_code: "",
    ac_name: "",
    total_budget: "0.00",
    jan_budget_month: "0.00",
    feb_budget_month: "0.00",
    mar_budget_month: "0.00",
    apr_budget_month: "0.00",
    may_budget_month: "0.00",
    jun_budget_month: "0.00",
    jul_budget_month: "0.00",
    aug_budget_month: "0.00",
    sep_budget_month: "0.00",
    oct_budget_month: "0.00",
    nov_budget_month: "0.00",
    dec_budget_month: "0.00",
  };
}

function mapBudgetRow(row: LookupRow): BudgetRow {
  const mapped = {
    company_code: String(getLookupValue(row, "company_code") || ""),
    doc_no: String(getLookupValue(row, "doc_no") || ""),
    doc_date: String(getLookupValue(row, "doc_date") || ""),
    doc_type: String(getLookupValue(row, "doc_type") || ""),
    budget_year: String(getLookupValue(row, "budget_year") || ""),
    div_code: String(getLookupValue(row, "div_code") || ""),
    div_name: String(getLookupValue(row, "div_name") || ""),
    ac_code: String(getLookupValue(row, "ac_code") || ""),
    ac_name: String(getLookupValue(row, "ac_name") || ""),
    total_budget: String(getLookupValue(row, "total_budget") || "0"),
    jan_budget_month: String(getLookupValue(row, "jan_budget_month") || "0"),
    feb_budget_month: String(getLookupValue(row, "feb_budget_month") || "0"),
    mar_budget_month: String(getLookupValue(row, "mar_budget_month") || "0"),
    apr_budget_month: String(getLookupValue(row, "apr_budget_month") || "0"),
    may_budget_month: String(getLookupValue(row, "may_budget_month") || "0"),
    jun_budget_month: String(getLookupValue(row, "jun_budget_month") || "0"),
    jul_budget_month: String(getLookupValue(row, "jul_budget_month") || "0"),
    aug_budget_month: String(getLookupValue(row, "aug_budget_month") || "0"),
    sep_budget_month: String(getLookupValue(row, "sep_budget_month") || "0"),
    oct_budget_month: String(getLookupValue(row, "oct_budget_month") || "0"),
    nov_budget_month: String(getLookupValue(row, "nov_budget_month") || "0"),
    dec_budget_month: String(getLookupValue(row, "dec_budget_month") || "0"),
  };
  return { ...mapped, total_budget: mapped.total_budget || calcTotal(mapped) };
}

function calcTotal(row: Pick<BudgetRow, typeof MONTHS[number]["field"]>) {
  return MONTHS.reduce((sum, month) => sum + numberValue(row[month.field]), 0).toFixed(2);
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return numberValue(value).toFixed(2);
}

function formatDate(value: string) {
  const input = toInputDate(value);
  if (!input) return "";
  const [year, month, day] = input.split("-");
  return `${day}/${month}/${year}`;
}

function toInputDate(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}
