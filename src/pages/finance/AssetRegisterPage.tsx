import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
// Card removed: editor will open in modal Dialog like asset group
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { useAuth } from "../../state/AuthContext";

type AssetRow = {
  company_code: string;
  asset_id: string;
  asset_name: string;
  site_code: string;
  site_name: string;
  div_code: string;
  div_name: string;
  asset_group_code: string;
  asset_group_name: string;
  asset_subgroup_code: string;
  asset_subgroup_name: string;
  asset_brand_code: string;
  asset_brand_name: string;
  asset_ac_code: string;
  dprc_ac_code: string;
  accudprc_ac_code: string;
  dprc_percentage: string;
  dprc_commence_date: string;
  doc_type: string;
  doc_no: string;
  asset_properties: string;
  purchase_date: string;
  quantity: string;
  price: string;
  amount: string;
  supplier_name: string;
  supplier_ac_code: string;
  supp_code: string;
  status: string;
};

type EditorState =
  | { mode: "create"; row?: undefined }
  | { mode: "edit"; row: AssetRow }
  | { mode: "view"; row: AssetRow }
  | null;

const EMPTY_ASSET: AssetRow = {
  company_code: "",
  asset_id: "",
  asset_name: "",
  site_code: "",
  site_name: "",
  div_code: "",
  div_name: "",
  asset_group_code: "",
  asset_group_name: "",
  asset_subgroup_code: "",
  asset_subgroup_name: "",
  asset_brand_code: "",
  asset_brand_name: "",
  asset_ac_code: "",
  dprc_ac_code: "",
  accudprc_ac_code: "",
  dprc_percentage: "0.000",
  dprc_commence_date: "",
  doc_type: "",
  doc_no: "",
  asset_properties: "",
  purchase_date: "",
  quantity: "1.000",
  price: "0.000",
  amount: "0.000",
  supplier_name: "",
  supplier_ac_code: "",
  supp_code: "",
  status: "Y",
};

export function AssetRegisterPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_register",
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
      setRows(data.map(mapAsset));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load asset register" });
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

  const columns = useMemo<ColumnDef<AssetRow>[]>(() => [
    { accessorKey: "asset_id", header: "Asset ID", size: 130, cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span> },
    { accessorKey: "asset_name", header: "Asset Name", size: 260 },
    { accessorKey: "asset_group_code", header: "Group", size: 120 },
    { accessorKey: "asset_subgroup_code", header: "Subgroup", size: 130 },
    { accessorKey: "asset_brand_code", header: "Brand", size: 120 },
    { accessorKey: "asset_ac_code", header: "Asset A/C", size: 150 },
    { accessorKey: "purchase_date", header: "Purchase", size: 120 },
    { accessorKey: "quantity", header: "Qty", size: 90 },
    { accessorKey: "amount", header: "Value", size: 120 },
    { accessorKey: "status", header: "Status", size: 90 },
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
        parameter: "AC_ASSETS_delete_asset_register",
        loginid: loginId,
        code1: deleteTarget.asset_id,
        code2: companyCode,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Asset deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete asset" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Asset Utility</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Asset Register</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Create Asset</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Assets"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search asset id, name, account..."
        loading={loading}
        emptyText="No assets found"
        height={650}
        minWidth={1450}
        density="grid"
        getRowId={(row, index) => `${row.asset_id || "new"}_${index}`}
      />

      {editor && (
        <Dialog
          open
          wide
          title={`${editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Edit" : "View"} Asset`}
          description="Asset details"
          onClose={() => setEditor(null)}
        >
          <AssetEditor
            editor={editor}
            companyCode={companyCode}
            loginId={loginId}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setNotice({ type: "success", message: "Asset saved successfully" });
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
          title="Delete Asset"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.asset_id}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function AssetEditor({
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
  const [form, setForm] = useState<AssetRow>(() => ({ ...EMPTY_ASSET, company_code: companyCode, ...(editor.row || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const amount = (num(form.quantity) * num(form.price)).toFixed(3);
    if (form.amount !== amount) setForm((prev) => ({ ...prev, amount }));
  }, [form.quantity, form.price]);

  const setField = (field: keyof AssetRow, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const formatAmount = (field: keyof AssetRow, value: string) => setField(field, money(value));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!form.asset_name || !form.asset_group_code || !form.asset_ac_code) {
      setError("Asset Name, Asset Group and Asset A/C are required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await postFinance("upsertMsAcAsset", {
        ...form,
        company_code: companyCode,
        asset_id: form.asset_id || null,
        doc_no: form.doc_no ? Number(form.doc_no) : null,
        dprc_percentage: num(form.dprc_percentage),
        quantity: num(form.quantity),
        price: num(form.price),
        amount: num(form.amount),
        loginid: loginId,
        user_id: loginId,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save asset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[690px] flex-col">
      <div className="border-b p-4">
        <p className="eyebrow">{editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Modify" : "View"}</p>
        <h2 className="m-0 text-xl font-semibold tracking-tight">Asset Register</h2>
        <p className="mt-1 text-xs text-muted-foreground">Asset ID: {form.asset_id || "Autogenerated"}</p>
      </div>

      <form className="grid flex-1 content-start gap-4 overflow-auto p-4" id="asset-register-form" onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}

        <div className="rounded-md border bg-secondary/35 p-3">
          <p className="eyebrow mb-3">Asset Details</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset ID" value={form.asset_id} onChange={(value) => setField("asset_id", value)} disabled={readOnly || isEdit} />
            <Field label="Asset Name *" value={form.asset_name} onChange={(value) => setField("asset_name", value)} disabled={readOnly} />
            <Lookup label="Division" parameter="Account_division" value={form.div_code} displayValue={display(form.div_code, form.div_name)} valueField="div_code" displayFields={["div_code", "div_name"]} columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("div_code", value); setField("div_name", String(getLookupValue(row || {}, "div_name") || "")); }} />
            <Lookup label="Location" parameter="AC_ASSETS_site_code" value={form.site_code} displayValue={display(form.site_code, form.site_name)} valueField="site_code" displayFields={["site_code", "site_name"]} columns={[{ field: "site_code", header: "Site" }, { field: "site_name", header: "Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("site_code", value); setField("site_name", String(getLookupValue(row || {}, "site_name") || "")); }} />
            <Lookup label="Asset Group *" parameter="AC_ASSETS_group_code" value={form.asset_group_code} displayValue={display(form.asset_group_code, form.asset_group_name)} valueField="asset_group_code" displayFields={["asset_group_code", "asset_group_name"]} columns={[{ field: "asset_group_code", header: "Group" }, { field: "asset_group_name", header: "Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("asset_group_code", value); setField("asset_group_name", String(getLookupValue(row || {}, "asset_group_name") || "")); }} />
            <Lookup label="Asset Subgroup" parameter="AC_ASSETS_Subgroup_code" value={form.asset_subgroup_code} displayValue={display(form.asset_subgroup_code, form.asset_subgroup_name)} valueField="asset_subgroup_code" displayFields={["asset_subgroup_code", "asset_subgroup_name"]} columns={[{ field: "asset_subgroup_code", header: "Subgroup" }, { field: "asset_subgroup_name", header: "Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("asset_subgroup_code", value); setField("asset_subgroup_name", String(getLookupValue(row || {}, "asset_subgroup_name") || "")); }} />
            <Lookup label="Asset Brand" parameter="AC_ASSETS_Brand_code" value={form.asset_brand_code} displayValue={display(form.asset_brand_code, form.asset_brand_name)} valueField="asset_brand_code" displayFields={["asset_brand_code", "asset_brand_name"]} columns={[{ field: "asset_brand_code", header: "Brand" }, { field: "asset_brand_name", header: "Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("asset_brand_code", value); setField("asset_brand_name", String(getLookupValue(row || {}, "asset_brand_name") || "")); }} />
            <label className="field">
              <span>Status</span>
              <Select value={form.status} onChange={(event) => setField("status", event.target.value)} disabled={readOnly}>
                <option value="Y">Active</option>
                <option value="N">Inactive</option>
              </Select>
            </label>
          </div>
        </div>

        <div className="rounded-md border bg-secondary/35 p-3">
          <p className="eyebrow mb-3">Accounts</p>
          <div className="grid grid-cols-2 gap-3">
            <Lookup label="Asset A/C *" parameter="AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST" value={form.asset_ac_code} displayValue={form.asset_ac_code} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("asset_ac_code", value)} />
            <Lookup label="Depreciation A/C" parameter="AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST" value={form.dprc_ac_code} displayValue={form.dprc_ac_code} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("dprc_ac_code", value)} />
            <Lookup label="Accumulated Dep. A/C" parameter="AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST" value={form.accudprc_ac_code} displayValue={form.accudprc_ac_code} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("accudprc_ac_code", value)} />
            <Lookup label="Supplier A/C" parameter="Account_AC_CODE_Serach" value={form.supplier_ac_code} displayValue={form.supplier_ac_code} valueField="ac_code" displayFields={["ac_code", "ac_name"]} columns={accountColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value) => setField("supplier_ac_code", value)} />
          </div>
        </div>

        <div className="rounded-md border bg-secondary/35 p-3">
          <p className="eyebrow mb-3">Purchase & Depreciation</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Purchase Date" type="date" value={form.purchase_date} onChange={(value) => setField("purchase_date", value)} disabled={readOnly} />
            <Field label="Doc Type" value={form.doc_type} onChange={(value) => setField("doc_type", value)} disabled={readOnly} />
            <Field label="Doc No" value={form.doc_no} onChange={(value) => setField("doc_no", value)} disabled={readOnly} numeric />
            <Field label="Quantity" value={form.quantity} onChange={(value) => setField("quantity", value)} onBlur={(value) => formatAmount("quantity", value)} disabled={readOnly} numeric />
            <Field label="Price" value={form.price} onChange={(value) => setField("price", value)} onBlur={(value) => formatAmount("price", value)} disabled={readOnly} numeric />
            <Field label="Value" value={form.amount} onChange={(value) => setField("amount", value)} disabled numeric />
            <Field label="Depreciation %" value={form.dprc_percentage} onChange={(value) => setField("dprc_percentage", value)} onBlur={(value) => formatAmount("dprc_percentage", value)} disabled={readOnly} numeric />
            <Field label="Dep. Commence" type="date" value={form.dprc_commence_date} onChange={(value) => setField("dprc_commence_date", value)} disabled={readOnly} />
            <Field label="Supplier Name" value={form.supplier_name} onChange={(value) => setField("supplier_name", value)} disabled={readOnly} />
          </div>
        </div>

        <label className="field">
          <span>Asset Properties</span>
          <textarea className="ui-textarea min-h-[74px]" value={form.asset_properties} onChange={(event) => setField("asset_properties", event.target.value)} disabled={readOnly} />
        </label>
      </form>

      <div className="flex items-center justify-end gap-2 border-t bg-card p-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        {!readOnly && <Button disabled={saving} type="submit" form="asset-register-form">{saving ? <span className="spinner small" /> : <Save size={15} />} Save</Button>}
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
      loadOptions={() => getDynamicLookup({ parameter, code1: companyCode, code2: "", code3: "", code4: "", number1: 0, number2: 0, number3: 0, number4: 0, date1: null, date2: null, date3: null, date4: null })}
      onChange={onSelect}
    />
  );
}

function Field({ label, value, onChange, onBlur, disabled, type = "text", numeric }: { label: string; value: string; onChange: (value: string) => void; onBlur?: (value: string) => void; disabled?: boolean; type?: "text" | "date"; numeric?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input className={numeric ? "text-right tabular-nums" : ""} type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={(event) => onBlur?.(event.target.value)} disabled={disabled} />
    </label>
  );
}

const accountColumns = [
  { field: "ac_code", header: "A/C Code" },
  { field: "ac_name", header: "A/C Name" },
];

function mapAsset(row: LookupRow): AssetRow {
  return {
    ...EMPTY_ASSET,
    company_code: String(getLookupValue(row, "company_code") || ""),
    asset_id: String(getLookupValue(row, "asset_id") || ""),
    asset_name: String(getLookupValue(row, "asset_name") || ""),
    site_code: String(getLookupValue(row, "site_code") || ""),
    site_name: String(getLookupValue(row, "site_name") || ""),
    div_code: String(getLookupValue(row, "div_code") || ""),
    div_name: String(getLookupValue(row, "div_name") || ""),
    asset_group_code: String(getLookupValue(row, "asset_group_code") || ""),
    asset_group_name: String(getLookupValue(row, "asset_group_name") || ""),
    asset_subgroup_code: String(getLookupValue(row, "asset_subgroup_code") || ""),
    asset_subgroup_name: String(getLookupValue(row, "asset_subgroup_name") || ""),
    asset_brand_code: String(getLookupValue(row, "asset_brand_code") || ""),
    asset_brand_name: String(getLookupValue(row, "asset_brand_name") || ""),
    asset_ac_code: String(getLookupValue(row, "asset_ac_code") || ""),
    dprc_ac_code: String(getLookupValue(row, "dprc_ac_code") || ""),
    accudprc_ac_code: String(getLookupValue(row, "accudprc_ac_code") || ""),
    dprc_percentage: money(getLookupValue(row, "dprc_percentage")),
    dprc_commence_date: dateInput(getLookupValue(row, "dprc_commence_date")),
    doc_type: String(getLookupValue(row, "doc_type") || ""),
    doc_no: String(getLookupValue(row, "doc_no") || ""),
    asset_properties: String(getLookupValue(row, "asset_properties") || ""),
    purchase_date: dateInput(getLookupValue(row, "purchase_date")),
    quantity: money(getLookupValue(row, "quantity") || 1),
    price: money(getLookupValue(row, "price")),
    amount: money(getLookupValue(row, "amount")),
    supplier_name: String(getLookupValue(row, "supplier_name") || ""),
    supplier_ac_code: String(getLookupValue(row, "supplier_ac_code") || ""),
    supp_code: String(getLookupValue(row, "supp_code") || ""),
    status: String(getLookupValue(row, "status") || "Y"),
  };
}

function display(code: string, name: string) {
  if (!code) return "";
  return name ? `${code} - ${name}` : code;
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return num(value).toFixed(3);
}

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}
