import { Save, X, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  getDynamicLookup,
  getLookupValue,
  LookupRow,
} from "../../api/lookups";
import { Button } from "../../components/ui/Button";
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

// ===================== FULL FORM STATE =====================
// Extends TAssetRow with all fields present in the original MUI form
type TFullAssetForm = TAssetRow & {
  alias_name: string;
  bar_code: string;
  emp_id: string;
  emp_name: string;
  reg_no: string;
  reg_start_date: string;
  reg_exp_date: string;
  parent_asset: string;
  doc_dtl_sr_no: string;
  doc_serial_no: string;
  salvage_value: string;
  transporter_code: string;
  transporter_name: string;
  supp_code: string;
  supp_name: string;
  exp_subtype_code: string;
  exp_subtype_description: string;
  ac_exp_code: string;
  exp_description: string;
  voucher_date: string;
  attached_asset_id: string;
  busines_segment: string;
  asset_group: string;
  accudprc_opening: string;
  accudprc_amount: string;
  wd_value: string;
  last_dprc_date: string;
  ytd_dprcn: string;
  dprc_required: string;
  tax_dprc_percentage: string;
  tax_accuudrpc_opening: string;
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
  // base fields
  company_code: "", asset_id: "", asset_name: "", site_code: "", site_name: "",
  div_code: "", div_name: "", asset_group_code: "", asset_group_name: "",
  asset_subgroup_code: "", asset_subgroup_name: "", asset_brand_code: "", asset_brand_name: "",
  asset_ac_code: "", dprc_ac_code: "", accudprc_ac_code: "", dprc_percentage: "0.000",
  dprc_commence_date: "", doc_type: "", doc_no: "", asset_properties: "", purchase_date: "",
  quantity: "1.000", price: "0.000", amount: "0.000", supplier_name: "",
  supplier_ac_code: "", supp_code: "", status: "Y",
  // extended fields
  alias_name: "", bar_code: "", emp_id: "", emp_name: "",
  reg_no: "", reg_start_date: "", reg_exp_date: "", parent_asset: "",
  doc_dtl_sr_no: "", doc_serial_no: "",
  salvage_value: "0.000",
  transporter_code: "", transporter_name: "",
  supp_name: "",
  exp_subtype_code: "", exp_subtype_description: "",
  ac_exp_code: "", exp_description: "",
  voucher_date: "", attached_asset_id: "",
  busines_segment: "", asset_group: "",
  accudprc_opening: "0.000", accudprc_amount: "0.000", wd_value: "0.000",
  last_dprc_date: "", ytd_dprcn: "0.000", dprc_required: "Y",
  tax_dprc_percentage: "0.000", tax_accuudrpc_opening: "0.000",
  tax_wd_value: "0.000", tax_ytd_dprcn: "0.000",
  tax_last_dprc_date: "", tax_accudprc_amount: "0.000",
  sales_date: "", sales_amount: "0.000", sales_profitloss: "0.000",
  active_flag: "Y",
};

const accountColumns = [
  { field: "ac_code", header: "A/C Code" },
  { field: "ac_name", header: "A/C Name" },
];

// ===================== SECTION WRAPPER =====================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3 mb-3">
      <p className="eyebrow mb-3">{title}</p>
      {children}
    </div>
  );
}

// ===================== FIELD COMPONENTS =====================
function Field({
  label, value, onChange, onBlur, disabled, type = "text", numeric, required, placeholder,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  disabled?: boolean; type?: "text" | "date";
  numeric?: boolean; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <Input
        className={numeric ? "text-right tabular-nums" : ""}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        disabled={disabled}
      />
    </label>
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
          alias_name: g("alias_name"),
          site_code: g("site_code"), site_name: g("site_name"),
          div_code: g("div_code") || div_code, div_name: g("div_name") || div_name,
          asset_group_code: g("asset_group_code"), asset_group_name: g("asset_group_name"),
          asset_subgroup_code: g("asset_subgroup_code"), asset_subgroup_name: g("asset_subgroup_name"),
          asset_brand_code: g("asset_brand_code"), asset_brand_name: g("asset_brand_name"),
          bar_code: g("bar_code"),
          emp_id: g("emp_id"), emp_name: g("emp_name"),
          reg_no: g("reg_no"),
          reg_start_date: dateInput(g("reg_start_date")),
          reg_exp_date: dateInput(g("reg_exp_date")),
          parent_asset: g("parent_asset"),
          doc_serial_no: g("doc_serial_no"),
          asset_properties: g("asset_properties"),
          status: g("status") || "Y",
          active_flag: g("active_flag") || "Y",
          busines_segment: g("busines_segment"),
          asset_group: g("asset_group"),
          // Purchase
          purchase_date: dateInput(g("purchase_date")),
          doc_type: g("doc_type"), doc_no: g("doc_no"),
          doc_dtl_sr_no: g("doc_dtl_sr_no"),
          quantity: money(getLookupValue(h, "quantity") || 1),
          price: money(getLookupValue(h, "price")),
          amount: money(getLookupValue(h, "amount")),
          salvage_value: money(getLookupValue(h, "salvage_value")),
          supplier_name: g("supplier_name"),
          supplier_ac_code: g("supplier_ac_code"),
          supp_code: g("supp_code"), supp_name: g("supp_name"),
          transporter_code: g("transporter_code"), transporter_name: g("transporter_name"),
          voucher_date: dateInput(g("voucher_date")),
          exp_subtype_code: g("exp_subtype_code"), exp_subtype_description: g("exp_subtype_description"),
          ac_exp_code: g("ac_exp_code"), exp_description: g("exp_description"),
          attached_asset_id: g("attached_asset_id"),
          // Accounts
          asset_ac_code: g("asset_ac_code"),
          dprc_ac_code: g("dprc_ac_code"),
          accudprc_ac_code: g("accudprc_ac_code"),
          // Depreciation
          dprc_percentage: money(getLookupValue(h, "dprc_percentage")),
          dprc_commence_date: dateInput(g("dprc_commence_date")),
          last_dprc_date: dateInput(g("last_dprc_date")),
          ytd_dprcn: money(getLookupValue(h, "ytd_dprcn")),
          accudprc_amount: money(getLookupValue(h, "accudprc_amount")),
          accudprc_opening: money(getLookupValue(h, "accudprc_opening")),
          wd_value: money(getLookupValue(h, "wd_value")),
          dprc_required: g("dprc_required") || "Y",
          // Tax Depreciation
          tax_dprc_percentage: money(getLookupValue(h, "tax_dprc_percentage")),
          tax_accuudrpc_opening: money(getLookupValue(h, "tax_acuudrpc_opening") || getLookupValue(h, "tax_accuudrpc_opening")),
          tax_wd_value: money(getLookupValue(h, "tax_wd_value")),
          tax_ytd_dprcn: money(getLookupValue(h, "tax_ytd_dprcn")),
          tax_last_dprc_date: dateInput(g("tax_last_dprc_date")),
          tax_accudprc_amount: money(getLookupValue(h, "tax_accudprc_amount")),
          // Sales
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
  const loader = (parameter: string, extraCode2?: string) => () =>
    getDynamicLookup({
      parameter,
      loginid: loginId,
      code1: companyCode,
      code2: extraCode2 ?? "", code3: "", code4: "",
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
      // Uses the same procedure and parameter mapping as the original MUI form
      const { postFinance } = await import("../../api/lookups");
      await postFinance("proc_build_dynamic_ins_upd_column90", {
        parameter: "ms_ac_asset_register_ins_upd",
        loginid: loginId,
        // PRIMARY
        val1s1: companyCode,
        val1s2: isEdit ? form.asset_id : "",
        // TEXT FIELDS
        val1s3: form.asset_name,
        val1s4: form.asset_group_code,
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
        val1s31: form.active_flag,
        // DATES AS STRING
        val1s5: form.dprc_commence_date,
        val1s6: form.sales_date,
        val1s7: form.purchase_date,
        val1s29: form.last_dprc_date,
        val1s30: form.tax_last_dprc_date,
        val1s39: form.reg_start_date,
        val1s40: form.reg_exp_date,
        val1s41: form.voucher_date,
        // NUMBERS AS STRING
        val1s32: form.sales_profitloss,
        val1s33: form.ytd_dprcn,
        val1s34: form.accudprc_amount,
        val1s35: form.wd_value,
        val1s36: form.dprc_percentage,
        val1s37: form.doc_no,
        val1s38: form.sales_amount,
        val1s42: form.quantity,
        val1s43: form.price,
        val1s44: form.amount,
        val1s45: form.salvage_value,
        val1s46: form.doc_dtl_sr_no,
        val1s47: form.doc_serial_no,
        val1s48: form.tax_dprc_percentage,
        val1s49: form.tax_accuudrpc_opening,
        val1s50: form.tax_wd_value,
        val1s51: form.tax_ytd_dprcn,
        val1s52: form.tax_accudprc_amount,
        // extra
        val1s53: form.supplier_ac_code,
        val1s54: form.attached_asset_id,
        val1s55: form.alias_name,
        val1s56: form.busines_segment,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save asset");
    } finally {
      setSaving(false);
    }
  };

  // ===================== RENDER =====================
  return (
    <div className="flex flex-col w-full">
      {/* Header Row */}
      <div className="mb-3 flex items-center justify-between rounded-md border bg-secondary/40 px-3 py-2">
        <div>
          <p className="text-xs text-muted-foreground">Asset ID</p>
          <p className="text-sm font-semibold">{form.asset_id || "Autogenerated"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Division</p>
          <p className="text-sm font-semibold">
            {form.div_code ? `${form.div_code} – ${form.div_name}` : "—"}
          </p>
        </div>
      </div>

      {error && <div className="alert error mb-3">{error}</div>}

      <form
        id="asset-register-form"
        onSubmit={handleSubmit}
        className="grid gap-3 overflow-auto max-h-[65vh] pr-1"
      >
        {/* ==================== ASSET DETAILS ==================== */}
        <Section title="Asset Details">
          <div className="grid grid-cols-4 gap-3">
            {/* <Field label="Asset ID11" value={form.asset_id}
              onChange={(v) => set("asset_id", v)} disabled={isReadOnly || isEdit} /> */}

            {/* <div className="col-span-2"> */}
              <Field label="Asset Name" value={form.asset_name}
                onChange={(v) => set("asset_name", v)} disabled={isReadOnly} required />
            {/* </div> */}

            <Field label="Alias Name" value={form.alias_name}
              onChange={(v) => set("alias_name", v)} disabled={isReadOnly} />

            <LookupField
              label="Division"
              value={form.div_code}
              displayValue={display(form.div_code, form.div_name)}
              columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]}
              valueField="div_code" displayFields={["div_code", "div_name"]}
              disabled={isReadOnly}
              loadOptions={loader("Account_division")}
              onChange={(value, row) => {
                set("div_code", value);
                set("div_name", String(getLookupValue(row || {}, "div_name") || ""));
              }}
            />
            <LookupField
              label="Location (Site)"
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
            <LookupField
              label="Asset Group"
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
            <LookupField
              label="Asset Subgroup"
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
            <LookupField
              label="Asset Brand"
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

            <Field label="Bar Code" value={form.bar_code}
              onChange={(v) => set("bar_code", v)} disabled={isReadOnly} />

            {/* Employee — uses search icon (LookupField or custom) */}
            <LookupField
              label="Employee"
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

            <Field label="Reg No" value={form.reg_no}
              onChange={(v) => set("reg_no", v)} disabled={isReadOnly} />
            <Field label="Reg Start Date" type="date" value={form.reg_start_date}
              onChange={(v) => set("reg_start_date", v)} disabled={isReadOnly} />
            <Field label="Reg Expiry Date" type="date" value={form.reg_exp_date}
              onChange={(v) => set("reg_exp_date", v)} disabled={isReadOnly} />

            <Field label="Parent Asset" value={form.parent_asset}
              onChange={(v) => set("parent_asset", v)} disabled={isReadOnly} />
            <Field label="Asset Serial No" value={form.doc_serial_no}
              onChange={(v) => set("doc_serial_no", v)} disabled={isReadOnly} numeric />
            <Field label="Business Segment" value={form.busines_segment}
              onChange={(v) => set("busines_segment", v)} disabled={isReadOnly} />

            <label className="field">
              <span>Status</span>
              <Select value={form.status} onChange={(e) => set("status", e.target.value)} disabled={isReadOnly}>
                <option value="Y">Active</option>
                <option value="N">Inactive</option>
              </Select>
            </label>

            <div className="col-span-4">
              <label className="field">
                <span>Asset Properties</span>
                <textarea
                  className="ui-textarea min-h-[60px]"
                  value={form.asset_properties}
                  onChange={(e) => set("asset_properties", e.target.value)}
                  disabled={isReadOnly}
                />
              </label>
            </div>
          </div>
        </Section>

        {/* ==================== PURCHASE & SUPPLIER ==================== */}
        <Section title="Purchase & Supplier">
          <div className="grid grid-cols-4 gap-3">
            <Field label="Purchase Date" type="date" value={form.purchase_date}
              onChange={(v) => set("purchase_date", v)} disabled={isReadOnly} />
            <Field label="Doc Type" value={form.doc_type}
              onChange={(v) => set("doc_type", v)} disabled={isReadOnly} />
            <Field label="Doc No" value={form.doc_no}
              onChange={(v) => set("doc_no", v)} disabled={isReadOnly} numeric />
            <Field label="Doc Detail Sr No" value={form.doc_dtl_sr_no}
              onChange={(v) => set("doc_dtl_sr_no", v)} disabled={isReadOnly} numeric />

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

            <Field label="Supplier Name" value={form.supplier_name}
              onChange={(v) => set("supplier_name", v)} disabled={isReadOnly} />
            <LookupField
              label="Supplier Code"
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
            <LookupField
              label="Transporter"
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
            <Field label="Voucher Date" type="date" value={form.voucher_date}
              onChange={(v) => set("voucher_date", v)} disabled={isReadOnly} />

            <LookupField
              label="Exp Subtype"
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
            <LookupField
              label="A/C Exp Code"
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
        </Section>

        {/* ==================== ACCOUNTS ==================== */}
        <Section title="Accounts">
          <div className="grid grid-cols-4 gap-3">
            <LookupField
              label="Asset A/C"
              value={form.asset_ac_code} displayValue={form.asset_ac_code}
              columns={accountColumns} valueField="ac_code" displayFields={["ac_code", "ac_name"]}
              disabled={isReadOnly}
              loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
              onChange={(value) => set("asset_ac_code", value)}
            />
            <LookupField
              label="Supplier A/C"
              value={form.supplier_ac_code} displayValue={form.supplier_ac_code}
              columns={accountColumns} valueField="ac_code" displayFields={["ac_code", "ac_name"]}
              disabled={isReadOnly}
              loadOptions={loader("Account_AC_CODE_Serach")}
              onChange={(value) => set("supplier_ac_code", value)}
            />
            <LookupField
              label="Depreciation A/C"
              value={form.dprc_ac_code} displayValue={form.dprc_ac_code}
              columns={accountColumns} valueField="ac_code" displayFields={["ac_code", "ac_name"]}
              disabled={isReadOnly}
              loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
              onChange={(value) => set("dprc_ac_code", value)}
            />
            <LookupField
              label="Accumulated Dep. A/C"
              value={form.accudprc_ac_code} displayValue={form.accudprc_ac_code}
              columns={accountColumns} valueField="ac_code" displayFields={["ac_code", "ac_name"]}
              disabled={isReadOnly}
              loadOptions={loader("AC_ASSETS_DEPRECIATION_ACCOUNT_CODE_LIST")}
              onChange={(value) => set("accudprc_ac_code", value)}
            />
            <Field label="Attached Asset ID" value={form.attached_asset_id}
              onChange={(v) => set("attached_asset_id", v)} disabled={isReadOnly} />
          </div>
        </Section>

        {/* ==================== DEPRECIATION ==================== */}
        <Section title="Depreciation">
          <div className="grid grid-cols-4 gap-3">
            <Field label="Dep. %" value={form.dprc_percentage}
              onChange={(v) => set("dprc_percentage", v)} onBlur={(v) => fmt("dprc_percentage", v)}
              disabled={isReadOnly} numeric />
            <Field label="Dep. Commence Date" type="date" value={form.dprc_commence_date}
              onChange={(v) => set("dprc_commence_date", v)} disabled={isReadOnly} />
            <Field label="Last Dep. Date" type="date" value={form.last_dprc_date}
              onChange={(v) => set("last_dprc_date", v)} disabled={isReadOnly} />
            <Field label="YTD Depreciation" value={form.ytd_dprcn}
              onChange={(v) => set("ytd_dprcn", v)} onBlur={(v) => fmt("ytd_dprcn", v)}
              disabled={isReadOnly} numeric />

            <Field label="AccuDep. Amount" value={form.accudprc_amount}
              onChange={(v) => set("accudprc_amount", v)} onBlur={(v) => fmt("accudprc_amount", v)}
              disabled={isReadOnly} numeric />
            <Field label="AccuDep. Opening" value={form.accudprc_opening}
              onChange={(v) => set("accudprc_opening", v)} onBlur={(v) => fmt("accudprc_opening", v)}
              disabled={isReadOnly} numeric />
            <Field label="WDV (Written Down Value)" value={form.wd_value}
              onChange={(v) => set("wd_value", v)} onBlur={(v) => fmt("wd_value", v)}
              disabled={isReadOnly} numeric />

            <label className="field">
              <span>Dep. Required</span>
              <Select value={form.dprc_required} onChange={(e) => set("dprc_required", e.target.value)} disabled={isReadOnly}>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </label>
          </div>
        </Section>

        {/* ==================== TAX DEPRECIATION ==================== */}
        <Section title="Tax Depreciation">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tax Dep. %" value={form.tax_dprc_percentage}
              onChange={(v) => set("tax_dprc_percentage", v)} onBlur={(v) => fmt("tax_dprc_percentage", v)}
              disabled={isReadOnly} numeric />
            <Field label="Tax WDV" value={form.tax_wd_value}
              onChange={(v) => set("tax_wd_value", v)} onBlur={(v) => fmt("tax_wd_value", v)}
              disabled={isReadOnly} numeric />
            <Field label="Tax AccuDep. Amount" value={form.tax_accudprc_amount}
              onChange={(v) => set("tax_accudprc_amount", v)} onBlur={(v) => fmt("tax_accudprc_amount", v)}
              disabled={isReadOnly} numeric />
            <Field label="Tax AccuDep. Opening" value={form.tax_accuudrpc_opening}
              onChange={(v) => set("tax_accuudrpc_opening", v)} onBlur={(v) => fmt("tax_accuudrpc_opening", v)}
              disabled={isReadOnly} numeric />
            <Field label="Tax Last Dep. Date" type="date" value={form.tax_last_dprc_date}
              onChange={(v) => set("tax_last_dprc_date", v)} disabled={isReadOnly} />
            <Field label="Tax YTD Depreciation" value={form.tax_ytd_dprcn}
              onChange={(v) => set("tax_ytd_dprcn", v)} onBlur={(v) => fmt("tax_ytd_dprcn", v)}
              disabled={isReadOnly} numeric />
          </div>
        </Section>

        {/* ==================== SALES / DISPOSAL ==================== */}
        <Section title="Sales / Disposal">
          <div className="grid grid-cols-4 gap-3">
            <Field label="Sales Date" type="date" value={form.sales_date}
              onChange={(v) => set("sales_date", v)} disabled={isReadOnly} />
            <Field label="Sales Amount" value={form.sales_amount}
              onChange={(v) => set("sales_amount", v)} onBlur={(v) => fmt("sales_amount", v)}
              disabled={isReadOnly} numeric />
            <Field label="Sales Profit / Loss" value={form.sales_profitloss}
              onChange={(v) => set("sales_profitloss", v)} onBlur={(v) => fmt("sales_profitloss", v)}
              disabled={isReadOnly} numeric />
            <label className="field">
              <span>Active Flag</span>
              <Select value={form.active_flag} onChange={(e) => set("active_flag", e.target.value)} disabled={isReadOnly}>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </Select>
            </label>
          </div>
        </Section>
      </form>

      {/* ==================== FOOTER ==================== */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onClose}>
          <X size={15} /> Close
        </Button>
        {!isReadOnly && (
          <Button disabled={saving} type="submit" form="asset-register-form">
            {saving ? <span className="spinner small" /> : <Save size={15} />}
            {isEdit ? "Update" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}