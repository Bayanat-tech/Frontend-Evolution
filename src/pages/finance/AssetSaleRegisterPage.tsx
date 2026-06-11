import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
// Card removed: editor will open in modal Dialog
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

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
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "view", row: row.original })}><Eye size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={15} /></Button>
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

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Asset Utility</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Create {title}</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

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
        getRowId={(row, index) => `${row.doc_no || "new"}_${row.asset_id}_${index}`}
      />

      {editor && (
        <Dialog
          open
          wide
          title={`${editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Edit" : "View"} ${title}`}
          description="Details"
          onClose={() => setEditor(null)}
        >
          <AssetSaleEditor
            editor={editor}
            title={title}
            companyCode={companyCode}
            loginId={loginId}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setNotice({ type: "success", message: `${title} saved successfully` });
              await loadRows(false);
            }}
          />
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog open compact tone="danger" title={`Delete ${title}`} description="This action cannot be undone." onClose={() => setDeleteTarget(null)} footer={<><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button></>}>
          <p className="modal-copy">Delete <strong>{deleteTarget.doc_no || "this record"}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function AssetSaleEditor({ editor, title, companyCode, loginId, onClose, onSaved }: { editor: Exclude<EditorState, null>; title: string; companyCode: string; loginId: string; onClose: () => void; onSaved: () => Promise<void> }) {
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

  return (
    <div className="flex min-h-[690px] flex-col">
      <div className="border-b p-4">
        <p className="eyebrow">{editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Modify" : "View"}</p>
        <h2 className="m-0 text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Doc No: {form.doc_no || "Autogenerated"}</p>
      </div>
      <form className="grid flex-1 content-start gap-4 overflow-auto p-4" id="asset-sale-form" onSubmit={handleSubmit}>
        <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />
        <div className="grid grid-cols-2 gap-3">
          {/* <Field label="Doc No" value={form.doc_no} onChange={(value) => setField("doc_no", value)} disabled={readOnly} numeric /> */}
          <Field label="Doc Date" type="date" value={form.doc_date} onChange={(value) => setField("doc_date", value)} disabled={readOnly} />
          <Lookup label="Division" parameter="Account_division" value={form.div_code} displayValue={display(form.div_code, form.div_name)} valueField="div_code" displayFields={["div_code", "div_name"]} columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("div_code", value); setField("div_name", String(getLookupValue(row || {}, "div_name") || "")); }} />
          <Lookup label="Asset *" parameter="AC_ASSETS_SearchID" value={form.asset_id} displayValue={display(form.asset_id, form.asset_name)} valueField="asset_id" displayFields={["asset_id", "asset_name"]} columns={[{ field: "asset_id", header: "Asset ID" }, { field: "asset_name", header: "Asset Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("asset_id", value); setField("asset_name", String(getLookupValue(row || {}, "asset_name") || "")); }} />
          <Lookup label="Asset A/C" parameter="Account_AC_CODE_Serach" value={form.asset_ac_code} displayValue={form.asset_ac_code} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("asset_ac_code", value)} />
          <Lookup label="Customer A/C" parameter="Account_AC_CODE_Serach" value={form.customer_ac_code} displayValue={form.customer_ac_code} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("customer_ac_code", value)} />
          <Lookup label="FA Disposal A/C" parameter="Account_AC_CODE_Serach" value={form.fa_disposal_ac} displayValue={form.fa_disposal_ac} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("fa_disposal_ac", value)} />
          <Lookup label="P/L Disposal A/C" parameter="Account_AC_CODE_Serach" value={form.pl_fa_disposal_ac} displayValue={form.pl_fa_disposal_ac} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("pl_fa_disposal_ac", value)} />
          <Field label="Customer Name" value={form.customer_name} onChange={(value) => setField("customer_name", value)} disabled={readOnly} />
          <label className="field"><span>Status</span><Select value={form.status} onChange={(event) => setField("status", event.target.value)} disabled={readOnly}><option value="Y">Active</option><option value="N">Inactive</option></Select></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Sales Date *" type="date" value={form.sales_date} onChange={(value) => setField("sales_date", value)} disabled={readOnly} />
          <Field label="Sales Amount *" value={form.sales_amount} onChange={(value) => setField("sales_amount", value)} onBlur={(value) => setMoney("sales_amount", value)} disabled={readOnly} numeric />
          <Field label="Profit/Loss" value={form.sales_profitloss} onChange={(value) => setField("sales_profitloss", value)} onBlur={(value) => setMoney("sales_profitloss", value)} disabled={readOnly} numeric />
          <Field label="Quantity" value={form.quantity} onChange={(value) => setField("quantity", value)} onBlur={(value) => setMoney("quantity", value)} disabled={readOnly} numeric />
          <Field label="Price" value={form.price} onChange={(value) => setField("price", value)} onBlur={(value) => setMoney("price", value)} disabled={readOnly} numeric />
          <Field label="Asset Value" value={form.asset_amount} onChange={(value) => setField("asset_amount", value)} onBlur={(value) => setMoney("asset_amount", value)} disabled={readOnly} numeric />
          <Field label="WD Value" value={form.wd_value} onChange={(value) => setField("wd_value", value)} onBlur={(value) => setMoney("wd_value", value)} disabled={readOnly} numeric />
          <Field label="Total Dep." value={form.total_depreciation_amount} onChange={(value) => setField("total_depreciation_amount", value)} onBlur={(value) => setMoney("total_depreciation_amount", value)} disabled={readOnly} numeric />
          <Field label="Salvage" value={form.salvage_value} onChange={(value) => setField("salvage_value", value)} onBlur={(value) => setMoney("salvage_value", value)} disabled={readOnly} numeric />
        </div>
        <Field label="Asset Properties" value={form.asset_properties} onChange={(value) => setField("asset_properties", value)} disabled={readOnly} />
      </form>
      <div className="flex items-center justify-end gap-2 border-t bg-card p-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!readOnly && <Button disabled={saving} type="submit" form="asset-sale-form">{saving ? <span className="spinner small" /> : <Save size={15} />} Save</Button>}
      </div>
    </div>
  );
}

function Lookup({ label, parameter, value, displayValue, valueField, displayFields, columns, companyCode, disabled, onSelect }: { label: string; parameter: string; value: string; displayValue: string; valueField: string; displayFields: string[]; columns: { field: string; header: string }[]; companyCode: string; disabled?: boolean; onSelect: (value: string, row: LookupRow | null) => void }) {
  return <LookupField label={label} value={value} displayValue={displayValue} columns={columns} valueField={valueField} displayFields={displayFields} disabled={disabled} loadOptions={() => getDynamicLookup({ parameter, code1: companyCode, code2: "", code3: "", code4: "", number1: 0, number2: 0, number3: 0, number4: 0, date1: null, date2: null, date3: null, date4: null })} onChange={onSelect} />;
}

function Field({ label, value, onChange, onBlur, disabled, type = "text", numeric }: { label: string; value: string; onChange: (value: string) => void; onBlur?: (value: string) => void; disabled?: boolean; type?: "text" | "date"; numeric?: boolean }) {
  return <label className="field"><span>{label}</span><Input className={numeric ? "text-right tabular-nums" : ""} type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={(event) => onBlur?.(event.target.value)} disabled={disabled} /></label>;
}

const accountColumns = [{ field: "ac_code", header: "A/C Code" }, { field: "ac_name", header: "A/C Name" }];

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

function display(code: string, name: string) { return code ? (name ? `${code} - ${name}` : code) : ""; }
function num(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown) { return num(value).toFixed(3); }
function today() { return new Date().toISOString().slice(0, 10); }
function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}
