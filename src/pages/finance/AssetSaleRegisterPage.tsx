import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, Trash2, Save, X, FileText, DollarSign, Landmark } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { useAuth } from "../../state/AuthContext";

// ===================== TYPES =====================
type AssetSaleRow = {
  company_code: string;
  doc_no: string;
  doc_date: string;
  div_code: string;
  div_name: string;
  asset_id: string;
  asset_name: string;
  asset_ac_code: string;
  dprc_ac_code: string;
  accudprc_ac_code: string;
  dprc_percentage: string;
  dprc_commence_date: string;
  doc_type: string;
  asset_properties: string;
  acuudrpc_opening: string;
  prevdrpc_amount: string;
  currdrpc_amount: string;
  total_depreciation_amount: string;
  sales_date: string;
  sales_amount: string;
  sales_profitloss: string;
  quantity: string;
  price: string;
  asset_amount: string;
  wd_value: string;
  salvage_value: string;
  customer_name: string;
  customer_ac_code: string;
  status: string;
  exp_code: string;
  exp_code_name: string;
  exp_subtype_code: string;
  exp_subtype_name: string;
  sold: string;
  fa_disposal_ac: string;
  pl_fa_disposal_ac: string;
};

type EditorState =
  | { mode: "create"; row?: undefined }
  | { mode: "edit"; row: AssetSaleRow }
  | { mode: "view"; row: AssetSaleRow }
  | null;

const EMPTY_SALE: AssetSaleRow = {
  company_code: "",
  doc_no: "",
  doc_date: today(),
  div_code: "",
  div_name: "",
  asset_id: "",
  asset_name: "",
  asset_ac_code: "",
  dprc_ac_code: "",
  accudprc_ac_code: "",
  dprc_percentage: "0.000",
  dprc_commence_date: "",
  doc_type: "",
  asset_properties: "",
  acuudrpc_opening: "0.000",
  prevdrpc_amount: "0.000",
  currdrpc_amount: "0.000",
  total_depreciation_amount: "0.000",
  sales_date: today(),
  sales_amount: "0.000",
  sales_profitloss: "0.000",
  quantity: "1.000",
  price: "0.000",
  asset_amount: "0.000",
  wd_value: "0.000",
  salvage_value: "0.000",
  customer_name: "",
  customer_ac_code: "",
  status: "Y",
  exp_code: "",
  exp_code_name: "",
  exp_subtype_code: "",
  exp_subtype_name: "",
  sold: "Y",
  fa_disposal_ac: "",
  pl_fa_disposal_ac: "",
};

// ===================== MAIN PAGE =====================
export function AssetSaleRegisterPage({ mode = "sale" }: { mode?: "sale" | "disposal" }) {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [rows, setRows] = useState<AssetSaleRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetSaleRow | null>(null);
  const title = mode === "disposal" ? "Asset Disposal" : "Asset Sale";

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_SALE_REGISTER",
        loginid: loginId,
        code1: companyCode,
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
      setRows(data.map(mapAssetSale));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${title.toLowerCase()}` });
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

  const columns = useMemo<ColumnDef<AssetSaleRow>[]>(() => [
    { accessorKey: "doc_no", header: "Doc No", size: 120, cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span> },
    { accessorKey: "doc_date", header: "Doc Date", size: 120 },
    { accessorKey: "div_code", header: "Division", size: 110 },
    { accessorKey: "asset_id", header: "Asset ID", size: 130 },
    { accessorKey: "asset_ac_code", header: "Asset A/C", size: 150 },
    { accessorKey: "total_depreciation_amount", header: "Total Dep.", size: 130 },
    { accessorKey: "wd_value", header: "WD Value", size: 120 },
    { accessorKey: "sales_date", header: mode === "disposal" ? "Disposal Date" : "Sales Date", size: 120 },
    { accessorKey: "sales_amount", header: mode === "disposal" ? "Disposal Amt" : "Sales Amt", size: 130 },
    { accessorKey: "sales_profitloss", header: "Profit/Loss", size: 120 },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => { setNotice(null); setEditor({ mode: "view", row: row.original }); }}><Eye size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => { setNotice(null); setEditor({ mode: "edit", row: row.original }); }}><Edit2 size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)}><Trash2 size={15} /></Button>
        </div>
      ),
    },
  ], [mode]);

  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "AC_ASSETS_SALE_REGISTER_DELETE",
        loginid: loginId,
        code1: companyCode,
        code2: String(Number(deleteTarget.doc_no || 0)),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `${title} deleted successfully` });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to delete ${title.toLowerCase()}` });
    }
  };

  const closeEditor = () => {
    setNotice(null);
    setEditor(null);
  };

  // ===================== INLINE EDITOR VIEW =====================
  if (editor) {
    return (
      <AssetSaleEditor
        key={`${editor.mode}_${editor.row?.doc_no || "new"}`}
        editor={editor}
        title={title}
        mode={mode}
        companyCode={companyCode}
        loginId={loginId}
        onClose={closeEditor}
        onSaved={async () => {
          setEditor(null);
          setNotice({ type: "success", message: `${title} saved successfully` });
          await loadRows(false);
        }}
      />
    );
  }

  // ===================== LIST VIEW =====================
  return (
    <section className="finance-utility-page finance-list-page grid gap-4">
      {/* Page Header - Matching Prepaid Register */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <DollarSign size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{title} Register</h1>
            <p className="m-0 text-xs text-slate-500">Asset Utility</p>
          </div>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={filteredRows}
          title={loading ? "Loading" : `${filteredRows.length} Records`}
          subtitle={title}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search document, asset, account..."
          loading={loading}
          emptyText={`No ${title.toLowerCase()} records found`}
          height={650}
          minWidth={1450}
          density="grid"
          enableExport={false}
          actionButton={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="h-8 gap-1.5 px-3.5 rounded-lg bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold cursor-pointer transition-colors"
                title={`Create ${title}`}
                onClick={() => { setNotice(null); setEditor({ mode: "create" }); }}
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
              <FinanceListActionsMenu
                onExport={() =>
                  exportToCsv(
                    filteredRows,
                    columns.filter((column) => column.id !== "actions"),
                    `${title.toLowerCase().replace(/\s+/g, "-")}-register.csv`,
                  )
                }
                onRefresh={() => void loadRows(false)}
              />
            </div>
          }
          getRowId={(row, index) => `${row.doc_no || "new"}_${row.asset_id}_${index}`}
        />
      </div>

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title={`Delete ${title}`}
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.doc_no || "this record"}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// INLINE EDITOR — MATCHING PREPAID REGISTER / AIRLINE TARIFF UI
// ---------------------------------------------------------------------------

function AssetSaleEditor({
  editor,
  title,
  mode,
  companyCode,
  loginId,
  onClose,
  onSaved,
}: {
  editor: Exclude<EditorState, null>;
  title: string;
  mode: "sale" | "disposal";
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const readOnly = editor.mode === "view";
  const [form, setForm] = useState<AssetSaleRow>(() => ({ ...EMPTY_SALE, company_code: companyCode, ...(editor.row || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const setField = (field: keyof AssetSaleRow, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const setMoney = (field: keyof AssetSaleRow, value: string) => setField(field, money(value));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!form.asset_id || !form.sales_date || !form.sales_amount) {
      setError("Asset, date and amount are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await postFinance("upsertAssetSaleRegister", {
        ...form,
        company_code: companyCode,
        doc_no: form.doc_no ? Number(form.doc_no) : null,
        dprc_percentage: num(form.dprc_percentage),
        acuudrpc_opening: num(form.acuudrpc_opening),
        prevdrpc_amount: num(form.prevdrpc_amount),
        currdrpc_amount: num(form.currdrpc_amount),
        total_depreciation_amount: num(form.total_depreciation_amount),
        sales_amount: num(form.sales_amount),
        sales_profitloss: num(form.sales_profitloss),
        quantity: num(form.quantity),
        price: num(form.price),
        asset_amount: num(form.asset_amount),
        wd_value: num(form.wd_value),
        salvage_value: num(form.salvage_value),
        loginid: loginId,
        user_id: loginId,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to save ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const pageTitle =
    editor.mode === "create"
      ? `New ${title}`
      : editor.mode === "edit"
      ? `Edit ${title}`
      : `View ${title}`;

  return (
    <section className="freight-airline-tariff-screen grid gap-2 freight-ui-standard freight-dense-form">
      {/* ============ HEADER CARD ============ */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <DollarSign size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{pageTitle}</h1>
            <p className="m-0 text-xs text-slate-500">Doc No: {form.doc_no || "Autogenerated"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-secondary px-3 py-1 text-right">
            <span className="block text-[10px] uppercase leading-tight text-muted-foreground">
              {mode === "disposal" ? "Disposal Amt" : "Sales Amt"}
            </span>
            <strong className="text-sm tabular-nums">{form.sales_amount || "0.000"}</strong>
          </div>
          {!readOnly && (
            <Button
              type="submit"
              form="asset-sale-form"
              disabled={saving}
              className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
            >
              {saving ? <span className="spinner small" /> : <Save size={14} />} Save
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
            title="Close form"
            className="h-8 w-8 rounded-lg"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

      <form className="flex flex-col gap-2" id="asset-sale-form" onSubmit={handleSubmit}>
        {/* ============ CARD 1: DOCUMENT DETAILS ============ */}
        <div className="freight-master-form-card">
          <div className="freight-master-form-header">
            <h3><span className="freight-section-icon"><FileText size={16} /></span>Document Details</h3>
          </div>
          <div className="freight-master-form-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Field label="Doc Date" type="date" value={form.doc_date} onChange={(v) => setField("doc_date", v)} disabled={readOnly} required />
              
              <div className="freight-master-field">
                <label className="freight-master-label">Division</label>
                <LookupField
                  compact
                  value={form.div_code}
                  displayValue={display(form.div_code, form.div_name)}
                  columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]}
                  valueField="div_code"
                  displayFields={["div_code", "div_name"]}
                  disabled={readOnly}
                  loadOptions={() => getDynamicLookup({
                    parameter: "Account_division",
                    code1: companyCode, code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })}
                  onChange={(value, row) => {
                    setField("div_code", value);
                    setField("div_name", String(getLookupValue(row || {}, "div_name") || ""));
                  }}
                />
              </div>

              <div className="freight-master-field">
                <label className="freight-master-label">
                  <span>Asset</span>
                  <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <LookupField
                  compact
                  value={form.asset_id}
                  displayValue={display(form.asset_id, form.asset_name)}
                  columns={[{ field: "asset_id", header: "Asset ID" }, { field: "asset_name", header: "Asset Name" }]}
                  valueField="asset_id"
                  displayFields={["asset_id", "asset_name"]}
                  disabled={readOnly}
                  loadOptions={() => getDynamicLookup({
                    parameter: "AC_ASSETS_SearchID",
                    code1: companyCode, code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })}
                  onChange={(value, row) => {
                    setField("asset_id", value);
                    setField("asset_name", String(getLookupValue(row || {}, "asset_name") || ""));
                  }}
                />
              </div>

              <Field className="col-span-1 sm:col-span-2" label="Asset Properties" value={form.asset_properties} onChange={(v) => setField("asset_properties", v)} disabled={readOnly} />

              <div className="freight-master-field">
                <label className="freight-master-label">Status</label>
                <Select className="freight-master-select" value={form.status} onChange={(event) => setField("status", event.target.value)} disabled={readOnly}>
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* ============ CARD 2: ACCOUNTS ============ */}
        <div className="freight-master-form-card">
          <div className="freight-master-form-header">
            <h3><span className="freight-section-icon"><Landmark size={16} /></span>Accounts</h3>
          </div>
          <div className="freight-master-form-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="freight-master-field">
                <label className="freight-master-label">Asset A/C</label>
                <LookupField
                  compact
                  value={form.asset_ac_code}
                  displayValue={form.asset_ac_code}
                  columns={accountColumns}
                  valueField="ac_code"
                  displayFields={["ac_code", "ac_name"]}
                  disabled={readOnly}
                  loadOptions={() => getDynamicLookup({
                    parameter: "Account_AC_CODE_Serach",
                    code1: companyCode, code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })}
                  onChange={(value) => setField("asset_ac_code", value)}
                />
              </div>

              <div className="freight-master-field">
                <label className="freight-master-label">Customer A/C</label>
                <LookupField
                  compact
                  value={form.customer_ac_code}
                  displayValue={form.customer_ac_code}
                  columns={accountColumns}
                  valueField="ac_code"
                  displayFields={["ac_code", "ac_name"]}
                  disabled={readOnly}
                  loadOptions={() => getDynamicLookup({
                    parameter: "Account_AC_CODE_Serach",
                    code1: companyCode, code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })}
                  onChange={(value) => setField("customer_ac_code", value)}
                />
              </div>

              <div className="freight-master-field">
                <label className="freight-master-label">FA Disposal A/C</label>
                <LookupField
                  compact
                  value={form.fa_disposal_ac}
                  displayValue={form.fa_disposal_ac}
                  columns={accountColumns}
                  valueField="ac_code"
                  displayFields={["ac_code", "ac_name"]}
                  disabled={readOnly}
                  loadOptions={() => getDynamicLookup({
                    parameter: "Account_AC_CODE_Serach",
                    code1: companyCode, code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })}
                  onChange={(value) => setField("fa_disposal_ac", value)}
                />
              </div>

              <div className="freight-master-field">
                <label className="freight-master-label">P/L Disposal A/C</label>
                <LookupField
                  compact
                  value={form.pl_fa_disposal_ac}
                  displayValue={form.pl_fa_disposal_ac}
                  columns={accountColumns}
                  valueField="ac_code"
                  displayFields={["ac_code", "ac_name"]}
                  disabled={readOnly}
                  loadOptions={() => getDynamicLookup({
                    parameter: "Account_AC_CODE_Serach",
                    code1: companyCode, code2: "", code3: "", code4: "",
                    number1: 0, number2: 0, number3: 0, number4: 0,
                    date1: null, date2: null, date3: null, date4: null,
                  })}
                  onChange={(value) => setField("pl_fa_disposal_ac", value)}
                />
              </div>

              <Field className="col-span-1 sm:col-span-2 lg:col-span-4" label="Customer Name" value={form.customer_name} onChange={(v) => setField("customer_name", v)} disabled={readOnly} />
            </div>
          </div>
        </div>

        {/* ============ CARD 3: SALE / DISPOSAL VALUES ============ */}
        <div className="freight-master-form-card">
          <div className="freight-master-form-header">
            <h3><span className="freight-section-icon"><DollarSign size={16} /></span>{mode === "disposal" ? "Disposal Values" : "Sale Values"}</h3>
          </div>
          <div className="freight-master-form-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Field label={mode === "disposal" ? "Disposal Date *" : "Sales Date *"} type="date" value={form.sales_date} onChange={(v) => setField("sales_date", v)} disabled={readOnly} required />
              <Field label={mode === "disposal" ? "Disposal Amount *" : "Sales Amount *"} value={form.sales_amount} onChange={(v) => setField("sales_amount", v)} onBlur={(v) => setMoney("sales_amount", v)} disabled={readOnly} numeric required />
              <Field label="Profit/Loss" value={form.sales_profitloss} onChange={(v) => setField("sales_profitloss", v)} onBlur={(v) => setMoney("sales_profitloss", v)} disabled={readOnly} numeric />
              <Field label="Quantity" value={form.quantity} onChange={(v) => setField("quantity", v)} onBlur={(v) => setMoney("quantity", v)} disabled={readOnly} numeric />
              <Field label="Price" value={form.price} onChange={(v) => setField("price", v)} onBlur={(v) => setMoney("price", v)} disabled={readOnly} numeric />
              <Field label="Asset Value" value={form.asset_amount} onChange={(v) => setField("asset_amount", v)} onBlur={(v) => setMoney("asset_amount", v)} disabled={readOnly} numeric />
              <Field label="WD Value" value={form.wd_value} onChange={(v) => setField("wd_value", v)} onBlur={(v) => setMoney("wd_value", v)} disabled={readOnly} numeric />
              <Field label="Total Depreciation" value={form.total_depreciation_amount} onChange={(v) => setField("total_depreciation_amount", v)} onBlur={(v) => setMoney("total_depreciation_amount", v)} disabled={readOnly} numeric />
              <Field label="Salvage Value" value={form.salvage_value} onChange={(v) => setField("salvage_value", v)} onBlur={(v) => setMoney("salvage_value", v)} disabled={readOnly} numeric />
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FIELD COMPONENT MATCHING PREPAID REGISTER
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  onBlur,
  disabled,
  type = "text",
  numeric,
  required,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "date" | "number";
  numeric?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`freight-master-field ${className || ""}`}>
      <label className="freight-master-label">
        <span>{label}</span>
        {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
      </label>
      <input
        className={`freight-master-input ${numeric ? "numeric text-right tabular-nums" : ""}`}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

const accountColumns = [
  { field: "ac_code", header: "A/C Code" },
  { field: "ac_name", header: "A/C Name" },
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function mapAssetSale(row: LookupRow): AssetSaleRow {
  return {
    ...EMPTY_SALE,
    company_code: String(getLookupValue(row, "company_code") || ""),
    doc_no: String(getLookupValue(row, "doc_no") || ""),
    doc_date: dateInput(getLookupValue(row, "doc_date")),
    div_code: String(getLookupValue(row, "div_code") || ""),
    div_name: String(getLookupValue(row, "div_name") || ""),
    asset_id: String(getLookupValue(row, "asset_id") || ""),
    asset_name: String(getLookupValue(row, "asset_name") || ""),
    asset_ac_code: String(getLookupValue(row, "asset_ac_code") || ""),
    dprc_ac_code: String(getLookupValue(row, "dprc_ac_code") || ""),
    accudprc_ac_code: String(getLookupValue(row, "accudprc_ac_code") || ""),
    dprc_percentage: money(getLookupValue(row, "dprc_percentage")),
    dprc_commence_date: dateInput(getLookupValue(row, "dprc_commence_date")),
    doc_type: String(getLookupValue(row, "doc_type") || ""),
    asset_properties: String(getLookupValue(row, "asset_properties") || ""),
    total_depreciation_amount: money(getLookupValue(row, "totaldrpc_amount") || getLookupValue(row, "total_depreciation_amount")),
    sales_date: dateInput(getLookupValue(row, "sales_date")),
    sales_amount: money(getLookupValue(row, "sales_amount")),
    sales_profitloss: money(getLookupValue(row, "sales_profitloss")),
    quantity: money(getLookupValue(row, "quantity") || 1),
    price: money(getLookupValue(row, "price")),
    asset_amount: money(getLookupValue(row, "amount") || getLookupValue(row, "asset_amount")),
    wd_value: money(getLookupValue(row, "wd_value")),
    salvage_value: money(getLookupValue(row, "salvage_value")),
    customer_name: String(getLookupValue(row, "customer_name") || ""),
    customer_ac_code: String(getLookupValue(row, "customer_ac_code") || ""),
    status: String(getLookupValue(row, "status") || "Y"),
    exp_code: String(getLookupValue(row, "ac_exp_code") || getLookupValue(row, "exp_code") || ""),
    exp_subtype_code: String(getLookupValue(row, "exp_subtype_code") || ""),
    sold: String(getLookupValue(row, "sold") || "Y"),
    fa_disposal_ac: String(getLookupValue(row, "fa_disposal_ac") || ""),
    pl_fa_disposal_ac: String(getLookupValue(row, "pl_fa_disposal_ac") || ""),
  };
}

function display(code: string, name: string) {
  return code ? (name ? `${code} - ${name}` : code) : "";
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return num(value).toFixed(3);
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