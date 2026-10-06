import { Save, X, FileText, TrendingDown, Receipt, DollarSign } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  getDynamicLookup,
  getLookupValue,
  executeDynamicMutationColumn90,
} from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import type { TAssetRow } from "./AssetRegisterPage";

// ===================== TYPES =====================
type TProps = {
  mode: "create" | "edit" | "view";
  asset_id?: string;
  div_code: string;
  div_name: string;
  companyCode: string;
  loginId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type TFullAssetForm = TAssetRow & {
  bar_code: string;
  emp_id: string;
  emp_name: string;
  reg_no: string;
  parent_asset: string;
  doc_serial_no: string;
  salvage_value: string;
  transporter_code: string;
  transporter_name: string;
  supp_name: string;
  exp_subtype_code: string;
  exp_subtype_description: string;
  ac_exp_code: string;
  exp_description: string;
  accudprc_amount: string;
  wd_value: string;
  last_dprc_date: string;
  ytd_dprcn: string;
  dprc_required: string;
  tax_dprc_percentage: string;
  tax_wd_value: string;
  tax_ytd_dprcn: string;
  tax_last_dprc_date: string;
  tax_accudprc_amount: string;
  sales_date: string;
  sales_amount: string;
  sales_profitloss: string;
  active_flag: string;
};

// ===================== HELPERS =====================
function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown) {
  return num(value).toFixed(3);
}
function dateInput(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}
function display(code: string, name: string) {
  return code ? (name ? `${code} – ${name}` : code) : "";
}

const EMPTY: TFullAssetForm = {
  company_code: "", asset_id: "", asset_name: "", site_code: "", site_name: "",
  div_code: "", div_name: "", asset_group_code: "", asset_group_name: "",
  asset_subgroup_code: "", asset_subgroup_name: "", asset_brand_code: "", asset_brand_name: "",
  asset_ac_code: "", dprc_ac_code: "", accudprc_ac_code: "", dprc_percentage: "0.000",
  dprc_commence_date: "", doc_type: "", doc_no: "", asset_properties: "", purchase_date: "",
  quantity: "1.000", price: "0.000", amount: "0.000", supplier_name: "",
  supplier_ac_code: "", supp_code: "", status: "Y",
  bar_code: "", emp_id: "", emp_name: "",
  reg_no: "", parent_asset: "", doc_serial_no: "",
  salvage_value: "0.000",
  transporter_code: "", transporter_name: "", supp_name: "",
  exp_subtype_code: "", exp_subtype_description: "",
  ac_exp_code: "", exp_description: "",
  accudprc_amount: "0.000", wd_value: "0.000",
  last_dprc_date: "", ytd_dprcn: "0.000", dprc_required: "Y",
  tax_dprc_percentage: "0.000", tax_wd_value: "0.000", tax_ytd_dprcn: "0.000",
  tax_last_dprc_date: "", tax_accudprc_amount: "0.000",
  sales_date: "", sales_amount: "0.000", sales_profitloss: "0.000",
  active_flag: "Y",
};

const accountColumns = [
  { field: "ac_code", header: "A/C Code" },
  { field: "ac_name", header: "A/C Name" },
];

// ===================== FIELD COMPONENT =====================
// ===================== FIELD COMPONENT =====================
function Field({
  label, value, onChange, onBlur, disabled, type = "text", numeric, required, placeholder, className,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  disabled?: boolean; type?: "text" | "date";
  numeric?: boolean; required?: boolean; placeholder?: string;
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
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

// ===================== SECTION WRAPPER =====================
function FormCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="freight-master-form-card">
      <div className="freight-master-form-header">
        <h3>
          <span className="freight-section-icon">{icon}</span>
          {title}
        </h3>
      </div>
      <div className="freight-master-form-body">{children}</div>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
export function AddAssetRegisterForm({
  mode, asset_id, div_code, div_name, companyCode, loginId, onClose, onSaved,
}: TProps) {
  const isReadOnly = mode === "view";
  const isEdit = mode === "edit";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TFullAssetForm>({
    ...EMPTY,
    company_code: companyCode,
    div_code,
    div_name,
  });

  // ===================== LOAD EXISTING =====================
  useEffect(() => {
    if (!asset_id) return;
    const load = async () => {
      try {
        const res = await getDynamicLookup({
          parameter: "AC_ASSETS_register",
          loginid: loginId,
          code1: companyCode,
          code2: asset_id,
          code3: "NULL", code4: "NULL",
          number1: 0, number2: 0, number3: 0, number4: 0,
          date1: null, date2: null, date3: null, date4: null,
        });
        const h = res.find(
          (row) => String(getLookupValue(row, "asset_id") || "") === String(asset_id)
        );
        if (!h) return;
        const g = (field: string) => String(getLookupValue(h, field) || "");
        setForm({
          ...EMPTY,
          company_code: g("company_code") || companyCode,
          asset_id: g("asset_id"),
          asset_name: g("asset_name"),
          site_code: g("site_code"), site_name: g("site_name"),
          div_code: g("div_code") || div_code, div_name: g("div_name") || div_name,
          asset_group_code: g("asset_group_code"), asset_group_name: g("asset_group_name"),
          asset_subgroup_code: g("asset_subgroup_code"), asset_subgroup_name: g("asset_subgroup_name"),
          asset_brand_code: g("asset_brand_code"), asset_brand_name: g("asset_brand_name"),
          bar_code: g("bar_code"),
          emp_id: g("emp_id"), emp_name: g("emp_name"),
          reg_no: g("reg_no"),
          parent_asset: g("parent_asset"),
          doc_serial_no: g("doc_serial_no"),
          asset_properties: g("asset_properties"),
          status: g("status") || "Y",
          active_flag: g("active_flag") || "Y",
          purchase_date: dateInput(g("purchase_date")),
          doc_type: g("doc_type"), doc_no: g("doc_no"),
          quantity: money(getLookupValue(h, "quantity") || 1),
          price: money(getLookupValue(h, "price")),
          amount: money(getLookupValue(h, "amount")),
          salvage_value: money(getLookupValue(h, "salvage_value")),
          supplier_name: g("supplier_name"),
          supplier_ac_code: g("supplier_ac_code"),
          supp_code: g("supp_code"), supp_name: g("supp_name"),
          transporter_code: g("transporter_code"), transporter_name: g("transporter_name"),
          exp_subtype_code: g("exp_subtype_code"), exp_subtype_description: g("exp_subtype_description"),
          ac_exp_code: g("ac_exp_code"), exp_description: g("exp_description"),
          asset_ac_code: g("asset_ac_code"),
          dprc_ac_code: g("dprc_ac_code"),
          accudprc_ac_code: g("accudprc_ac_code"),
          dprc_percentage: money(getLookupValue(h, "dprc_percentage")),
          dprc_commence_date: dateInput(g("dprc_commence_date")),
          last_dprc_date: dateInput(g("last_dprc_date")),
          ytd_dprcn: money(getLookupValue(h, "ytd_dprcn")),
          accudprc_amount: money(getLookupValue(h, "accudprc_amount")),
          wd_value: money(getLookupValue(h, "wd_value")),
          dprc_required: g("dprc_required") || "Y",
          tax_dprc_percentage: money(getLookupValue(h, "tax_dprc_percentage")),
          tax_wd_value: money(getLookupValue(h, "tax_wd_value")),
          tax_ytd_dprcn: money(getLookupValue(h, "tax_ytd_dprcn")),
          tax_last_dprc_date: dateInput(g("tax_last_dprc_date")),
          tax_accudprc_amount: money(getLookupValue(h, "tax_accudprc_amount")),
          sales_date: dateInput(g("sales_date")),
          sales_amount: money(getLookupValue(h, "sales_amount")),
          sales_profitloss: money(getLookupValue(h, "sales_profitloss")),
        });
      } catch {
        // silently fail
      }
    };
    void load();
  }, [asset_id]);

  // ===================== AUTO AMOUNT =====================
  useEffect(() => {
    const amount = (num(form.quantity) * num(form.price)).toFixed(3);
    if (form.amount !== amount) setForm((p) => ({ ...p, amount }));
  }, [form.quantity, form.price]);

  // ===================== SETTERS =====================
  const set = (field: keyof TFullAssetForm, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));
  const fmt = (field: keyof TFullAssetForm, v: string) => set(field, money(v));

  // ===================== LOOKUP LOADERS =====================
  const loader = (parameter: string) => () =>
    getDynamicLookup({
      parameter,
      loginid: loginId,
      code1: companyCode,
      code2: "", code3: "", code4: "",
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    });

  // ===================== SUBMIT =====================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!form.asset_name || !form.asset_group_code || !form.asset_ac_code) {
      setError("Asset Name, Asset Group, and Asset A/C are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await executeDynamicMutationColumn90({
        parameter: "ms_ac_asset_register_ins_upd",
        loginid: loginId,
        val1s1: companyCode,
        val1s2: isEdit ? form.asset_id : "",
        val1s3: form.asset_name,
        val1s4: form.asset_group_code,
        val1s5: form.dprc_commence_date,
        val1s6: form.sales_date,
        val1s7: form.purchase_date,
        val1s8: form.status,
        val1s9: form.site_code,
        val1s10: form.div_code,
        val1s11: form.asset_ac_code,
        val1s12: form.asset_brand_code,
        val1s14: form.bar_code,
        val1s15: form.emp_id,
        val1s16: form.asset_properties,
        val1s17: form.reg_no,
        val1s18: form.parent_asset,
        val1s19: form.asset_subgroup_code,
        val1s20: form.supp_code,
        val1s21: form.supplier_name,
        val1s22: form.doc_type,
        val1s23: form.transporter_code,
        val1s25: form.dprc_ac_code,
        val1s26: form.accudprc_ac_code,
        val1s27: form.ac_exp_code,
        val1s28: form.exp_subtype_code,
        val1s29: form.last_dprc_date,
        val1s30: form.tax_last_dprc_date,
        val1s31: form.active_flag,
        val1s32: form.sales_profitloss,
        val1s33: form.ytd_dprcn,
        ...(({
          val1s34: form.accudprc_amount,
          val1s35: form.wd_value,
          val1s36: form.dprc_percentage,
          val1s37: form.doc_no,
          val1s38: form.sales_amount,
          val1s42: form.quantity,
          val1s43: form.price,
          val1s44: form.amount,
          val1s45: form.salvage_value,
          val1s47: form.doc_serial_no,
          val1s48: form.tax_dprc_percentage,
          val1s50: form.tax_wd_value,
          val1s51: form.tax_ytd_dprcn,
          val1s52: form.tax_accudprc_amount,
        }) as any),
      } as any);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save asset");
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "create" ? "New Asset" : mode === "edit" ? "Edit Asset" : "View Asset";

  // ===================== RENDER =====================
  return (
    <section className="freight-airline-tariff-screen grid gap-2 freight-ui-standard freight-dense-form">
      {/* ===================== HEADER CARD ===================== */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <FileText size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{title}</h1>
            <p className="m-0 text-xs text-slate-500">
              Asset ID: {form.asset_id || "Autogenerated"} | Division: {form.div_code ? `${form.div_code} – ${form.div_name}` : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-secondary px-3 py-1 text-right">
            <span className="block text-[10px] uppercase leading-tight text-muted-foreground">Value</span>
            <strong className="text-sm tabular-nums">{form.amount || "0.000"}</strong>
          </div>
          {!isReadOnly && (
            <Button
              type="submit"
              form="asset-register-form"
              disabled={saving}
              className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
            >
              {saving ? <span className="spinner small" /> : <Save size={14} />}
              {isEdit ? "Update" : "Save"}
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

      <form className="flex flex-col gap-2" id="asset-register-form" onSubmit={handleSubmit}>
        {/* ============ CARD 1: ASSET DETAILS ============ */}
        <FormCard icon={<FileText size={16} />} title="Asset Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="freight-master-field">
              <label className="freight-master-label">Location (Site)</label>
              <LookupField
                compact
                value={form.site_code}
                displayValue={display(form.site_code, form.site_name)}
                columns={[{ field: "site_code", header: "Site" }, { field: "site_name", header: "Name" }]}
                valueField="site_code" displayFields={["site_code", "site_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_site_code")}
                onChange={(value, row) => {
                  set("site_code", value);
                  set("site_name", String(getLookupValue(row || {}, "site_name") || ""));
                }}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">Division Code</label>
              <input
                className="freight-master-input"
                value={display(form.div_code, form.div_name)}
                disabled
                readOnly
              />
            </div>

            <Field label="Asset Name" value={form.asset_name}
              onChange={(v) => set("asset_name", v)} disabled={isReadOnly} required
              className="col-span-1 sm:col-span-2" />

            <div className="freight-master-field col-span-1 sm:col-span-2">
              <label className="freight-master-label">
                <span>Asset Group</span>
                <span className="text-red-500 font-bold ml-0.5">*</span>
              </label>
              <LookupField
                compact
                value={form.asset_group_code}
                displayValue={display(form.asset_group_code, form.asset_group_name)}
                columns={[{ field: "asset_group_code", header: "Group" }, { field: "asset_group_name", header: "Name" }]}
                valueField="asset_group_code" displayFields={["asset_group_code", "asset_group_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_group_code")}
                onChange={(value, row) => {
                  set("asset_group_code", value);
                  set("asset_group_name", String(getLookupValue(row || {}, "asset_group_name") || ""));
                }}
              />
            </div>

            <Field label="Bar Code" value={form.bar_code}
              onChange={(v) => set("bar_code", v)} disabled={isReadOnly} />

            <div className="freight-master-field">
              <label className="freight-master-label">Status</label>
              <Select className="freight-master-select" value={form.status} onChange={(e) => set("status", e.target.value)} disabled={isReadOnly}>
                <option value="Y">Active</option>
                <option value="N">Inactive</option>
              </Select>
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">Employee ID</label>
              <LookupField
                compact
                value={form.emp_id}
                displayValue={display(form.emp_id, form.emp_name)}
                columns={[{ field: "emp_id", header: "Emp ID" }, { field: "emp_name", header: "Name" }]}
                valueField="emp_id" displayFields={["emp_id", "emp_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_Emp_Id")}
                onChange={(value, row) => {
                  set("emp_id", value);
                  set("emp_name", String(getLookupValue(row || {}, "emp_name") || ""));
                }}
              />
            </div>

            <div className="freight-master-field col-span-1 sm:col-span-2 lg:col-span-4">
              <label className="freight-master-label">Asset Properties</label>
              <textarea
                className="freight-master-input min-h-[60px]"
                value={form.asset_properties}
                onChange={(e) => set("asset_properties", e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <Field label="Reg No" value={form.reg_no}
              onChange={(v) => set("reg_no", v)} disabled={isReadOnly} />

            <Field label="Parent Asset" value={form.parent_asset}
              onChange={(v) => set("parent_asset", v)} disabled={isReadOnly} />

            <div className="freight-master-field">
              <label className="freight-master-label">Asset Subgroup</label>
              <LookupField
                compact
                value={form.asset_subgroup_code}
                displayValue={display(form.asset_subgroup_code, form.asset_subgroup_name)}
                columns={[{ field: "asset_subgroup_code", header: "Subgroup" }, { field: "asset_subgroup_name", header: "Name" }]}
                valueField="asset_subgroup_code" displayFields={["asset_subgroup_code", "asset_subgroup_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_Subgroup_code")}
                onChange={(value, row) => {
                  set("asset_subgroup_code", value);
                  set("asset_subgroup_name", String(getLookupValue(row || {}, "asset_subgroup_name") || ""));
                }}
              />
            </div>

            <Field label="Asset Serial No" value={form.doc_serial_no}
              onChange={(v) => set("doc_serial_no", v)} disabled={isReadOnly} numeric />

            <div className="freight-master-field">
              <label className="freight-master-label">Asset Brand</label>
              <LookupField
                compact
                value={form.asset_brand_code}
                displayValue={display(form.asset_brand_code, form.asset_brand_name)}
                columns={[{ field: "asset_brand_code", header: "Brand" }, { field: "asset_brand_name", header: "Name" }]}
                valueField="asset_brand_code" displayFields={["asset_brand_code", "asset_brand_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_Brand_code")}
                onChange={(value, row) => {
                  set("asset_brand_code", value);
                  set("asset_brand_name", String(getLookupValue(row || {}, "asset_brand_name") || ""));
                }}
              />
            </div>

            <Field label="Supplier Name" value={form.supplier_name}
              onChange={(v) => set("supplier_name", v)} disabled={isReadOnly} />

            <div className="freight-master-field">
              <label className="freight-master-label">Supplier Code</label>
              <LookupField
                compact
                value={form.supp_code}
                displayValue={display(form.supp_code, form.supp_name)}
                columns={[{ field: "supp_code", header: "Code" }, { field: "supp_name", header: "Name" }]}
                valueField="supp_code" displayFields={["supp_code", "supp_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_supp_code")}
                onChange={(value, row) => {
                  set("supp_code", value);
                  set("supp_name", String(getLookupValue(row || {}, "supp_name") || ""));
                }}
              />
            </div>

            <Field label="Purchase Date" type="date" value={form.purchase_date}
              onChange={(v) => set("purchase_date", v)} disabled={isReadOnly} />

            <Field label="Doc Type" value={form.doc_type}
              onChange={(v) => set("doc_type", v)} disabled={isReadOnly} />

            <Field label="Doc No" value={form.doc_no}
              onChange={(v) => set("doc_no", v)} disabled={isReadOnly} numeric />

            <Field label="Quantity" value={form.quantity}
              onChange={(v) => set("quantity", v)} onBlur={(v) => fmt("quantity", v)}
              disabled={isReadOnly} numeric />

            <Field label="Price" value={form.price}
              onChange={(v) => set("price", v)} onBlur={(v) => fmt("price", v)}
              disabled={isReadOnly} numeric />

            <Field label="Value (Auto)" value={form.amount}
              onChange={(v) => set("amount", v)} disabled numeric />

            <Field label="Salvage Value" value={form.salvage_value}
              onChange={(v) => set("salvage_value", v)} onBlur={(v) => fmt("salvage_value", v)}
              disabled={isReadOnly} numeric />

            <div className="freight-master-field">
              <label className="freight-master-label">Transporter Code</label>
              <LookupField
                compact
                value={form.transporter_code}
                displayValue={display(form.transporter_code, form.transporter_name)}
                columns={[{ field: "transporter_code", header: "Code" }, { field: "transporter_name", header: "Name" }]}
                valueField="transporter_code" displayFields={["transporter_code", "transporter_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_transporter_code")}
                onChange={(value, row) => {
                  set("transporter_code", value);
                  set("transporter_name", String(getLookupValue(row || {}, "transporter_name") || ""));
                }}
              />
            </div>
          </div>
        </FormCard>

        {/* ============ CARD 2: DEPRECIATION DETAILS ============ */}
        <FormCard icon={<TrendingDown size={16} />} title="Depreciation Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Field label="DPRC Percentage" value={form.dprc_percentage}
              onChange={(v) => set("dprc_percentage", v)} onBlur={(v) => fmt("dprc_percentage", v)}
              disabled={isReadOnly} numeric />

            <Field label="DPRC Commence Date" type="date" value={form.dprc_commence_date}
              onChange={(v) => set("dprc_commence_date", v)} disabled={isReadOnly} />

            <Field label="Last DPRC Date" type="date" value={form.last_dprc_date}
              onChange={(v) => set("last_dprc_date", v)} disabled={isReadOnly} />

            <Field label="YTD DPRCN" value={form.ytd_dprcn}
              onChange={(v) => set("ytd_dprcn", v)} onBlur={(v) => fmt("ytd_dprcn", v)}
              disabled={isReadOnly} numeric />

            <Field label="AccuDPRC Amount" value={form.accudprc_amount}
              onChange={(v) => set("accudprc_amount", v)} onBlur={(v) => fmt("accudprc_amount", v)}
              disabled={isReadOnly} numeric />

            <Field label="WD Value" value={form.wd_value}
              onChange={(v) => set("wd_value", v)} onBlur={(v) => fmt("wd_value", v)}
              disabled={isReadOnly} numeric />

            <div className="freight-master-field">
              <label className="freight-master-label">Asset AC Code</label>
              <LookupField
                compact
                value={form.asset_ac_code}
                displayValue={form.asset_ac_code}
                columns={accountColumns}
                valueField="ac_code" displayFields={["ac_code", "ac_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
                onChange={(value) => set("asset_ac_code", value)}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">DPRC AC Code</label>
              <LookupField
                compact
                value={form.dprc_ac_code}
                displayValue={form.dprc_ac_code}
                columns={accountColumns}
                valueField="ac_code" displayFields={["ac_code", "ac_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
                onChange={(value) => set("dprc_ac_code", value)}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">AccuDPRC AC Code</label>
              <LookupField
                compact
                value={form.accudprc_ac_code}
                displayValue={form.accudprc_ac_code}
                columns={accountColumns}
                valueField="ac_code" displayFields={["ac_code", "ac_name"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
                onChange={(value) => set("accudprc_ac_code", value)}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">Exp Subtype Code</label>
              <LookupField
                compact
                value={form.exp_subtype_code}
                displayValue={display(form.exp_subtype_code, form.exp_subtype_description)}
                columns={[{ field: "exp_subtype_code", header: "Code" }, { field: "exp_subtype_description", header: "Description" }]}
                valueField="exp_subtype_code" displayFields={["exp_subtype_code", "exp_subtype_description"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_EXPSUBTYPE")}
                onChange={(value, row) => {
                  set("exp_subtype_code", value);
                  set("exp_subtype_description", String(getLookupValue(row || {}, "exp_subtype_description") || ""));
                }}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">AC Exp Code</label>
              <LookupField
                compact
                value={form.ac_exp_code}
                displayValue={display(form.ac_exp_code, form.exp_description)}
                columns={[{ field: "exp_code", header: "Code" }, { field: "exp_description", header: "Description" }]}
                valueField="exp_code" displayFields={["exp_code", "exp_description"]}
                disabled={isReadOnly}
                loadOptions={loader("AC_ASSETS_exp_code")}
                onChange={(value, row) => {
                  set("ac_exp_code", value);
                  set("exp_description", String(getLookupValue(row || {}, "exp_description") || ""));
                }}
              />
            </div>
          </div>
        </FormCard>

        {/* ============ CARD 3: TAX DEPRECIATION DETAILS ============ */}
        <FormCard icon={<Receipt size={16} />} title="Tax Depreciation Details">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Tax DPRC Percentage" value={form.tax_dprc_percentage}
              onChange={(v) => set("tax_dprc_percentage", v)} onBlur={(v) => fmt("tax_dprc_percentage", v)}
              disabled={isReadOnly} numeric />

            <Field label="Tax WD Value" value={form.tax_wd_value}
              onChange={(v) => set("tax_wd_value", v)} onBlur={(v) => fmt("tax_wd_value", v)}
              disabled={isReadOnly} numeric />

            <Field label="Tax AccuDPRC Amount" value={form.tax_accudprc_amount}
              onChange={(v) => set("tax_accudprc_amount", v)} onBlur={(v) => fmt("tax_accudprc_amount", v)}
              disabled={isReadOnly} numeric />

            <Field label="Tax Last DPRC Date" type="date" value={form.tax_last_dprc_date}
              onChange={(v) => set("tax_last_dprc_date", v)} disabled={isReadOnly} />

            <Field label="Tax YTD DPRCN" value={form.tax_ytd_dprcn}
              onChange={(v) => set("tax_ytd_dprcn", v)} onBlur={(v) => fmt("tax_ytd_dprcn", v)}
              disabled={isReadOnly} numeric />
          </div>
        </FormCard>

        {/* ============ CARD 4: SALES DETAILS ============ */}
        <FormCard icon={<DollarSign size={16} />} title="Sales Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Field label="Sales Date" type="date" value={form.sales_date}
              onChange={(v) => set("sales_date", v)} disabled={isReadOnly} />

            <Field label="Sales Amount" value={form.sales_amount}
              onChange={(v) => set("sales_amount", v)} onBlur={(v) => fmt("sales_amount", v)}
              disabled={isReadOnly} numeric />

            <Field label="Sales Profit/Loss" value={form.sales_profitloss}
              onChange={(v) => set("sales_profitloss", v)} onBlur={(v) => fmt("sales_profitloss", v)}
              disabled={isReadOnly} numeric />

            <div className="freight-master-field">
              <label className="freight-master-label">Active Flag</label>
              <Select className="freight-master-select" value={form.active_flag} onChange={(e) => set("active_flag", e.target.value)} disabled={isReadOnly}>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </div>
          </div>
        </FormCard>
      </form>
    </section>
  );
}