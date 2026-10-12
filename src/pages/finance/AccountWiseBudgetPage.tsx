import { Edit2, Eye, FileText, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeDynamicDelete, getDynamicLookup, getLookupText, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { LookupField } from "../../components/ui/LookupField";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
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

const inputClass =
  "h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

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
    {
      accessorKey: "doc_type",
      header: "Type",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setEditor({ mode: "edit", row: row.original })}
          className="font-semibold text-[#00378C] hover:underline cursor-pointer text-left bg-transparent border-none p-0"
          title="Click to edit"
        >
          {String(row.original.doc_type || "")}
        </button>
      ),
    },
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
      header: () => <div className="text-right">{month.label}</div>,
      cell: ({ getValue }) => <span className="block text-right tabular-nums">{money(getValue())}</span>,
    })),
    {
      accessorKey: "total_budget",
      header: () => <div className="text-right">Total</div>,
      cell: ({ getValue }) => <span className="block text-right font-semibold tabular-nums">{money(getValue())}</span>,
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
    <section className="finance-list-page finance-utility-page grid gap-2 p-1">
      {editor ? (
        <BudgetEditor
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setNotice({ type: "success", message: editor.mode === "edit" ? "Budget updated successfully" : "Budget added successfully" });
            setEditor(null);
            await loadRows(false);
          }}
        />
      ) : (
        <>
          {/* ---------- Top Header (compact) ---------- */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
                <FileText size={14} />
              </div>
              <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">
                A/c Wise Budget
              </h1>
            </div>
          </div>

          <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

          {/* ---------- LIST ---------- */}
          <DataTable
            columns={columns}
            data={filteredRows}
            title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Records`}
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search budget..."
            loading={loading}
            emptyText="No budgets found"
            height="calc(100dvh - 150px)"
            minWidth={1260}
            density="grid"
            enablePagination={false}
            enableExport={false}
            actionButton={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setEditor({ mode: "create" });
                  }}
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
                      `account-wise-budget-${new Date().toISOString().slice(0, 10)}.csv`,
                    )
                  }
                  onRefresh={() => void loadRows(false)}
                />
              </div>
            }
            getRowId={(row, index) => `${row.doc_no}_${row.ac_code}_${row.budget_year}_${index}`}
          />
        </>
      )}

      {/* ---------- DELETE CONFIRM ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Delete Budget"
        description="This action cannot be undone."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Close</Button>
            <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete budget <strong>{deleteTarget?.doc_no || deleteTarget?.ac_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor (in-page, same layout as Budget Version)                    */
/* ------------------------------------------------------------------ */

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

  const pageTitle = editor.mode === "create" ? "New A/c Wise Budget" : readOnly ? "View A/c Wise Budget" : "Edit A/c Wise Budget";

  return (
    <>
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

        <div className="flex items-center gap-1.5">
          <span className="mr-2 text-sm font-semibold tabular-nums text-slate-900" title="Total Budget">
            Total: {money(String(total))}
          </span>
          {!readOnly && (
            <Button
              type="submit"
              form="account-budget-form"
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

      {/* ---------- EDITOR ---------- */}
      <form id="account-budget-form" className="flex flex-col gap-2" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 rounded-t-lg">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00378C]/10 text-[#00378C]">
              <FileText size={12} />
            </div>
            <h3 className="m-0 text-xs font-semibold text-slate-800">Budget Details</h3>
          </div>

          <div className="p-3">
            {/* 4 fields in one row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2.5">
              <LookupField
                label="Version"
                required
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
              <div className="flex flex-col">
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600 text-left">
                  Doc Date <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>
                </label>
                <input
                  type="date"
                  value={form.doc_date}
                  onChange={(event) => setField("doc_date", event.target.value)}
                  disabled={readOnly}
                  className={inputClass}
                />
              </div>
              <LookupField
                label="Budget Year"
                required
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
                required
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

            {/* Account */}
            <div className="mt-2.5 grid grid-cols-1 lg:grid-cols-2 gap-x-3">
              <LookupField
                label="Account"
                required
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
            </div>
          </div>
        </div>

        {/* Monthly budget card */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 rounded-t-lg">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00378C]/10 text-[#00378C]">
              <FileText size={12} />
            </div>
            <h3 className="m-0 text-xs font-semibold text-slate-800">Monthly Budget</h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-2.5">
              {MONTHS.map((month) => (
                <div className="flex flex-col" key={month.field}>
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-600 text-left">{month.label}</label>
                  <input
                    className={`${inputClass} text-right tabular-nums`}
                    type="number"
                    value={form[month.field]}
                    onChange={(event) => setField(month.field, event.target.value)}
                    disabled={readOnly}
                  />
                </div>
              ))}
              <div className="flex flex-col">
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600 text-left">Total Budget</label>
                <input
                  className={`${inputClass} text-right font-semibold tabular-nums`}
                  value={money(String(total))}
                  disabled
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers (unchanged)                                                */
/* ------------------------------------------------------------------ */

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