import { Save, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  executeDynamicMutation,
  executeDynamicMutationColumn90,
  getDynamicLookup,
  getDynamicLookupaccount,
  getLookupValue,
  LookupRow,
} from "../../api/lookups";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

// Insert/Update parameter, per the PL/SQL: `WHEN 'PURCHASE_SALE_MSE_SETUP_INS_UPD' THEN ...`
// NOTE: this page intentionally does NOT fetch existing setup data on load.
// It always starts blank; Submit inserts a new row or (if the procedure's
// own COMPANY_CODE lookup finds one) updates the existing row for this company.
const PURCHASE_SALE_MSE_SETUP_INS_UPD = "PURCHASE_SALE_MSE_SETUP_INS_UPD";

const PURCHASE_SALE_MSE_SETUP_DEPT = "PURCHASE_SALE_MSE_SETUP_DEPT";
const DIVISION_PARAM = "Account_division";
const PURCHASE_SALES_MSE_SETUP_ZONE = "PURCHASE_SALES_MSE_SETUP_ZONE";
const Account_AC_CODE_Serach = "Account_AC_CODE_Serach";
const BASE_DISC_PARAM = "PURCHASE_SALE_MSE_SETUP_BASEDISC";
type YesNo = "Y" | "N";

type SetupForm = {
  company_code: string;
  def_dept_code: string;
  def_div_code: string;
  def_zone_code: string;
  allow_neg_stock: YesNo;
  allow_neg_pick: YesNo;
  reserve_on_order: YesNo;
  grn_auto_confirm: YesNo;
  dn_auto_confirm: YesNo;
  adjust_ac_code: string;
  pin_auto_post: YesNo;
  sin_auto_post: YesNo;
  base_disc_code: string;
  dupl_item_pur: YesNo;
  edit_grn_dt: boolean;
  edit_dn_dt: boolean;
  itemdesc_edit: boolean;
  plead_time: string;
};

// Generic {code, name} pair used by Dept/Div/Zone/BaseDisc plain dropdowns.
type CodeOption = {
  code: string;
  name: string;
};

// The two procedure entry points a dropdown lookup can be routed to.
type LookupFn = typeof getDynamicLookup;

// Same A/C Code lookup columns used by Expense Master / Asset Sale register,
// so the picker shows Code + Name side by side.
const accountColumns = [
  { field: "ac_code", header: "A/C Code" },
  { field: "ac_name", header: "A/C Name" },
];

const EMPTY: SetupForm = {
  company_code: "",
  def_dept_code: "",
  def_div_code: "",
  def_zone_code: "",
  allow_neg_stock: "N",
  allow_neg_pick: "N",
  reserve_on_order: "N",
  grn_auto_confirm: "Y",
  dn_auto_confirm: "Y",
  adjust_ac_code: "",
  pin_auto_post: "Y",
  sin_auto_post: "Y",
  base_disc_code: "",
  dupl_item_pur: "Y",
  edit_grn_dt: false,
  edit_dn_dt: false,
  itemdesc_edit: false,
  plead_time: "",
};

// ── Reusable field pieces ───────────────────────────────────────────────

function YesNoSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as YesNo)}>
        <option value="Y">Yes</option>
        <option value="N">No</option>
      </select>
    </label>
  );
}

function CodeSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  required,
  error,
  loading,
}: {
  label: string;
  value: string;
  options: CodeOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  loading?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label} {required && <strong className="text-destructive">*</strong>}
      </span>
      <select className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{loading ? "Loading..." : `Select ${label.toLowerCase()}...`}</option>
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.code} - {opt.name}
          </option>
        ))}
      </select>
      {error && <span className="text-destructive text-xs mt-0.5">{error}</span>}
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// Thin wrapper around LookupField, matching the pattern used by
// AddExpenseMasterForm's Lookup helper — fetches the option list from a
// dynamic-lookup parameter (via getDynamicLookup / common) and shows
// Code/Name columns in the picker.
function AccountLookup({
  label,
  value,
  displayValue,
  companyCode,
  disabled,
  required,
  error,
  onSelect,
}: {
  label: string;
  value: string;
  displayValue: string;
  companyCode: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onSelect: (value: string, row: LookupRow | null) => void;
}) {
  return (
    <div className="field">
      <span>
        {label} {required && <strong className="text-destructive">*</strong>}
      </span>
      <LookupField
        label={label}
        value={value}
        displayValue={displayValue}
        columns={accountColumns}
        valueField="ac_code"
        displayFields={["ac_code", "ac_name"]}
        disabled={disabled}
        loadOptions={() =>
          getDynamicLookup({
            parameter: Account_AC_CODE_Serach,
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
          })
        }
        onChange={onSelect}
      />
      {error && <span className="text-destructive text-xs mt-0.5">{error}</span>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export function PurchaseSaleSetupPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "ADMIN";
  const companyCode = user?.company_code || "";

  const [form, setForm] = useState<SetupForm>(EMPTY);
  const [adjustAcName, setAdjustAcName] = useState("");

  const [depts, setDepts] = useState<CodeOption[]>([]);
  const [divisions, setDivisions] = useState<CodeOption[]>([]);
  const [zones, setZones] = useState<CodeOption[]>([]);
  const [baseDiscCodes, setBaseDiscCodes] = useState<CodeOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof SetupForm, string>>>({});

  const setField = <K extends keyof SetupForm>(field: K, value: SetupForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // No data fetch for the setup row itself — the form always starts blank.
  // We only ever prefill company_code, since it comes from auth context
  // rather than from any lookup call.
  useEffect(() => {
    setForm((prev) => (prev.company_code === companyCode ? prev : { ...prev, company_code: companyCode }));
  }, [companyCode]);

  // Generic {code,name} lookup fetch — used for Dept, Div, Zone, and
  // Base Discount plain <select> dropdowns. `codeField`/`nameField` are
  // read via getLookupValue so casing from the backend doesn't matter
  // (e.g. Dept returns pl_code/name, Zone returns zone_code/zone_name).
  //
  // `fetchFn` selects which backend procedure to hit:
  //   - getDynamicLookup         -> proc_build_dynamic_sql_common   (Division only)
  //   - getDynamicLookupaccount  -> proc_build_dynamic_sql_common20 (Dept/Zone/BaseDisc)
  const loadCodeOptions = useCallback(
    async (
      parameter: string,
      codeField: string,
      nameField: string,
      fetchFn: LookupFn,
    ): Promise<CodeOption[]> => {
      const data = await fetchFn({
        parameter,
        loginid,
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
      return data.map((row) => ({
        code: String(getLookupValue(row, codeField) || ""),
        name: String(getLookupValue(row, nameField) || ""),
      }));
    },
    [loginid, companyCode],
  );

  const loadDropdownOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [deptOpts, divOpts, zoneOpts, baseDiscOpts] = await Promise.all([
        // common20
        loadCodeOptions(PURCHASE_SALE_MSE_SETUP_DEPT, "pl_code", "name", getDynamicLookupaccount).catch(() => []),
        // common (only this one, among the plain selects)
        loadCodeOptions(DIVISION_PARAM, "div_code", "div_name", getDynamicLookup).catch(() => []),
        // common20
        loadCodeOptions(PURCHASE_SALES_MSE_SETUP_ZONE, "zone_code", "zone_name", getDynamicLookupaccount).catch(() => []),
        // common20
        loadCodeOptions(BASE_DISC_PARAM, "disccode_no", "disccode_type", getDynamicLookupaccount).catch(() => []),
      ]);
      setDepts(deptOpts);
      setDivisions(divOpts);
      setZones(zoneOpts);
      setBaseDiscCodes(baseDiscOpts);
    } finally {
      setLoadingOptions(false);
    }
  }, [loadCodeOptions]);

  useEffect(() => {
    void loadDropdownOptions();
  }, [loadDropdownOptions]);

  // Resolve the Adjustment A/c display name whenever a code is picked from
  // the lookup itself (onSelect below) — no longer backfilled from any
  // MSE_SETUP fetch, since this page doesn't fetch existing setup rows.

  const validate = (): boolean => {
    const next: Partial<Record<keyof SetupForm, string>> = {};
    if (!form.def_dept_code.trim()) next.def_dept_code = "Default Dept Code is required";
    if (!form.def_div_code.trim()) next.def_div_code = "Default Div Code is required";
    if (!form.def_zone_code.trim()) next.def_zone_code = "Default Zone Code is required";
    if (form.plead_time.trim() && Number.isNaN(Number(form.plead_time))) {
      next.plead_time = "Purchase Lead Time must be a number";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Cancel now just discards in-progress edits and resets to a blank form
  // (there's no saved row to reload back to).
  const handleCancel = () => {
    setErrors({});
    setNotice(null);
    setAdjustAcName("");
    setForm({ ...EMPTY, company_code: companyCode });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setNotice(null);
    try {
      // Matches the PL/SQL branch WHEN 'PURCHASE_SALE_MSE_SETUP_INS_UPD':
      // P_VAL1S1..P_VAL1S14 map 1:1, in order, onto
      // COMPANY_CODE, DEF_DEPT_CODE, DEF_DIV_CODE, DEF_ZONE_CODE,
      // ALLOW_NEG_STOCK, ALLOW_NEG_PICK, RESERVE_ON_ORDER, GRN_AUTO_CONFIRM,
      // DN_AUTO_CONFIRM, ADJUST_AC_CODE, PIN_AUTO_POST, SIN_AUTO_POST,
      // BASE_DISC_CODE, DUPL_ITEM_PUR.
      await executeDynamicMutationColumn90({
        parameter: PURCHASE_SALE_MSE_SETUP_INS_UPD,
        loginid,
        val1s1: companyCode,
        val1s2: form.def_dept_code.trim(),
        val1s3: form.def_div_code.trim(),
        val1s4: form.def_zone_code.trim(),
        val1s5: form.allow_neg_stock,
        val1s6: form.allow_neg_pick,
        val1s7: form.reserve_on_order,
        val1s8: form.grn_auto_confirm,
        val1s9: form.dn_auto_confirm,
        val1s10: form.adjust_ac_code.trim(),
        val1s11: form.pin_auto_post,
        val1s12: form.sin_auto_post,
        val1s13: form.base_disc_code.trim(),
        val1s14: form.dupl_item_pur,
      });

      setNotice({ type: "success", message: "Purchase/Sales setup saved successfully." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save purchase/sales setup",
      });
    } finally {
      setSaving(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[420px] flex-col">
      <form
        className="grid flex-1 content-start gap-4 overflow-auto p-4"
        id="purchase-sale-setup-form"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold text-foreground">Purchase/Sales Setup</h1>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              Default codes and auto-processing rules used across purchase and sales documents.
            </p>
          </div>
        </div>

        <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow">Company {companyCode || "—"}</p>
              <h2 className="m-0 text-sm font-semibold">Purchase/Sales Setup</h2>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            {/* Left column */}
            <div className="grid gap-4">
              <CodeSelect
                label="Default Dept Code"
                value={form.def_dept_code}
                options={depts}
                onChange={(v) => setField("def_dept_code", v)}
                disabled={saving}
                loading={loadingOptions}
                required
                error={errors.def_dept_code}
              />

              <CodeSelect
                label="Default Div Code"
                value={form.def_div_code}
                options={divisions}
                onChange={(v) => setField("def_div_code", v)}
                disabled={saving}
                loading={loadingOptions}
                required
                error={errors.def_div_code}
              />

              <CodeSelect
                label="Default Zone Code"
                value={form.def_zone_code}
                options={zones}
                onChange={(v) => setField("def_zone_code", v)}
                disabled={saving}
                loading={loadingOptions}
                required
                error={errors.def_zone_code}
              />

              <AccountLookup
                label="Adjustment A/c Code"
                value={form.adjust_ac_code}
                displayValue={
                  form.adjust_ac_code && adjustAcName
                    ? `${form.adjust_ac_code} - ${adjustAcName}`
                    : form.adjust_ac_code
                }
                companyCode={companyCode}
                disabled={saving}
                onSelect={(value, row) => {
                  setField("adjust_ac_code", value);
                  setAdjustAcName(row ? String(getLookupValue(row, "ac_name") ?? "") : "");
                }}
              />

              <CodeSelect
                label="Base Discount Code"
                value={form.base_disc_code}
                options={baseDiscCodes}
                onChange={(v) => setField("base_disc_code", v)}
                disabled={saving}
                loading={loadingOptions}
              />

              <YesNoSelect
                label="Duplicate Items in Purchase"
                value={form.dupl_item_pur}
                onChange={(v) => setField("dupl_item_pur", v)}
                disabled={saving}
              />

              <div className="grid gap-2">
                <CheckboxField
                  label="Product Name Editable"
                  checked={form.itemdesc_edit}
                  onChange={(v) => setField("itemdesc_edit", v)}
                  disabled={saving}
                />
                <CheckboxField
                  label="GRN Date Change"
                  checked={form.edit_grn_dt}
                  onChange={(v) => setField("edit_grn_dt", v)}
                  disabled={saving}
                />
                <CheckboxField
                  label="DN Date Change"
                  checked={form.edit_dn_dt}
                  onChange={(v) => setField("edit_dn_dt", v)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Right column */}
            <div className="grid gap-4">
              <YesNoSelect
                label="Allow Negative Stock"
                value={form.allow_neg_stock}
                onChange={(v) => setField("allow_neg_stock", v)}
                disabled={saving}
              />
              <YesNoSelect
                label="Allow Negative Pick"
                value={form.allow_neg_pick}
                onChange={(v) => setField("allow_neg_pick", v)}
                disabled={saving}
              />
              <YesNoSelect
                label="Reserve On Order"
                value={form.reserve_on_order}
                onChange={(v) => setField("reserve_on_order", v)}
                disabled={saving}
              />
              <YesNoSelect
                label="GRN Auto Confirm"
                value={form.grn_auto_confirm}
                onChange={(v) => setField("grn_auto_confirm", v)}
                disabled={saving}
              />
              <YesNoSelect
                label="DN Auto Confirm"
                value={form.dn_auto_confirm}
                onChange={(v) => setField("dn_auto_confirm", v)}
                disabled={saving}
              />
              <YesNoSelect
                label="P.Invoice Auto Post"
                value={form.pin_auto_post}
                onChange={(v) => setField("pin_auto_post", v)}
                disabled={saving}
              />
              <YesNoSelect
                label="Sales Invoice Auto Post"
                value={form.sin_auto_post}
                onChange={(v) => setField("sin_auto_post", v)}
                disabled={saving}
              />
              <label className="field">
                <span>Purchase Lead Time</span>
                <Input
                  type="number"
                  min={0}
                  value={form.plead_time}
                  disabled={saving}
                  onChange={(e) => setField("plead_time", e.target.value)}
                  placeholder="Days"
                />
                {errors.plead_time && (
                  <span className="text-destructive text-xs mt-0.5">{errors.plead_time}</span>
                )}
              </label>
            </div>
          </CardContent>
        </Card>
      </form>

      <div className="flex items-center justify-end gap-2 border-t bg-card p-4">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          <X size={15} /> Cancel
        </Button>
        <Button disabled={saving} type="submit" form="purchase-sale-setup-form">
          {saving ? <span className="spinner small" /> : <Save size={15} />} {saving ? "Saving..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}