import {
  Loader2, Save, Building2, IdCard, Ruler, Box, ShieldCheck,
  LayoutGrid, StickyNote, ChevronRight, X
} from "lucide-react";
import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useState
} from "react";
import { TProduct, TProductFormik } from "./product-wms.types";
import { useAuth } from "../../../../state/AuthContext";
import { useToast } from "../../../../components/ui/AlertToast";
import { LookupField } from "../../../../components/ui/LookupField";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { addProduct, editProduct, executeWmsInboundSql, getWmsMaster } from "../../../../api/wms";
import type { LucideIcon } from "lucide-react";

/* ✅ Expose save() to the parent (header Save button) */
export type ProductFormHandle = {
  save: () => Promise<void>;
};

const STEPS = ["Product Details", "UOM & Volume", "Manufacture & Validation", "Category & Product"];

const emptyProduct: TProduct = {
  prod_name: "", prod_code: "", prin_code: "", brand_code: "", group_code: "",
  packdesc: "", barcode: "", p_uom: "", suom: "",
  length: 0, breadth: 0, height: 0, volume: 0, gross_wt: 0, net_wt: 0,
  foc: "", cpu: 0, harm_code: "", imco_code: "", kitting: "", manu_code: "",
  base_price: 0, flat_storage: 0, site_type: "", site_ind: "", pack_key: "",
  prod_ti: 0, prod_hi: 0, chargetime: "", prod_status: "O", shelf_life: 0,
  category_abc: "", reord_level: 0, reord_qty: 0, alt_prod_code: "",
  pref_site: "", pref_loc_from: "", pref_loc_to: "", pref_aisle_from: "",
  pref_aisle_to: "", pref_col_from: 0, pref_col_to: 0, pref_ht_from: 0, pref_ht_to: 0,
  uppp: 0, chk_manucode: "", chk_lotno: "", chk_mfgexpdt: "",
  puom_volume: 0, puom_netwt: 0, puom_grosswt: 0, l_uom: "", luppp: 0,
  uom_count: 0, prod_type: 0, twoplus_uom: "", upp: 0, wave_code: 0,
  product_stage: "", co_pack: "", model_number: "", variant_code: "", cnt_origin: "",
  serialize: "", packing: "", old_upp: 0, avg_consumption: 0, prod_image_path_web: "",
  minperiod_exppick: 0, rcpt_exp_limit: 0, qty_as_wt: "", hazmat_ind: "",
  hazmat_class: "", food_ind: "", pharma_ind: "", special_instructions: "",
  strength: "", pack_size: 0, group_code_bk: "", batch_type: 0,
  sap_prod_code: "", sap_prod_desc: "", temp_code: "", edit_user: "", class: "",
  wob: 0, unified_code: "", current_season: "", product_category: "",
  generic_article: "", prod_gender: "", prod_color: "", prod_size: "", prnt_p_code: "",
};

/* ─────────────────────────────────────────────────────────────
   SectionPanel — EXACT Freight structure
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — matches WmsMasterForm / Freight label styling
   ───────────────────────────────────────────────────────────── */
function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Checkbox — native, blue, side-by-side (uses DIV, not label)
   ───────────────────────────────────────────────────────────── */
function CheckboxField({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#00378C", width: "15px", height: "15px" }}
        className="shrink-0 cursor-pointer rounded border border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00378C]/25 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {label && (
        <span
          onClick={() => !disabled && onChange(!checked)}
          className={`text-[11.5px] font-medium text-slate-700 leading-none transition-colors ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:text-slate-900"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Form (forwardRef so parent can trigger save)
   ───────────────────────────────────────────────────────────── */
const AddProductWmsForm = forwardRef<
  ProductFormHandle,
  {
    onClose: (refetchData?: boolean) => void;
    isEditMode: boolean;
    existingData?: Partial<TProductFormik>;
  }
>(function AddProductWmsForm({ onClose, isEditMode, existingData }, ref) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TProduct>({ ...emptyProduct, company_code: user?.company_code });

  const [principals, setPrincipals] = useState<any[]>([]);
  const [uomList, setUomList] = useState<any[]>([]);
  const [harmonizeList, setHarmonizeList] = useState<any[]>([]);
  const [manufacturerList, setManufacturerList] = useState<any[]>([]);
  const [categoryList, setCategoryList] = useState<any[]>([]);
  const [productTypeList, setProductTypeList] = useState<any[]>([]);
  const [siteIndList, setSiteIndList] = useState<any[]>([]);
  const [pickWaveList, setPickWaveList] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [
          principalRes, uomRes, harmRes, manuRes, catRes, prodTypeRes, siteIndRes, pickWaveRes,
        ] = await Promise.all([
          getWmsMaster("principal", { page: 1, limit: 100000 }),
          getWmsMaster("uom", { page: 1, limit: 100000 }),
          getWmsMaster("harmonize", { page: 1, limit: 100000 }),
          getWmsMaster("manufacturer", { page: 1, limit: 100000 }),
          getWmsMaster("ddcategory", { page: 1, limit: 100000 }),
          executeWmsInboundSql("SELECT * FROM MS_PRODTYPE"),
          executeWmsInboundSql("SELECT * FROM MS_SITEIND"),
          executeWmsInboundSql("SELECT WAVE_NAME AS NAME, WAVE_CODE AS CODE FROM MS_PICKWAVE"),
        ]);
        setPrincipals(principalRes?.tableData ?? []);
        setUomList(uomRes?.tableData ?? []);
        setHarmonizeList(harmRes?.tableData ?? []);
        setManufacturerList(manuRes?.tableData ?? []);
        setCategoryList(catRes?.tableData ?? []);
        setProductTypeList(prodTypeRes ?? []);
        setSiteIndList(siteIndRes ?? []);
        setPickWaveList(pickWaveRes ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load reference data");
      }
    })();
  }, []);

  useEffect(() => {
    if (isEditMode && existingData) {
      setForm({ ...emptyProduct, ...existingData });
    }
  }, [isEditMode, existingData]);

  const selectedPrincipal = useMemo(
    () => principals.find((p) => p.prin_code === form.prin_code),
    [principals, form.prin_code]
  );

  const filteredManufacturers = useMemo(
    () => manufacturerList.filter((m) => m.prin_code === form.prin_code),
    [manufacturerList, form.prin_code]
  );

  const isSameUOM = Boolean(form.p_uom && form.l_uom && form.p_uom === form.l_uom);

  useEffect(() => {
    if (form.p_uom && form.l_uom) {
      const sameUom = form.p_uom === form.l_uom;
      const nextCount = sameUom ? 1 : 2;
      setForm((prev) => ({
        ...prev,
        uom_count: nextCount,
        uppp: sameUom ? 1 : prev.uppp,
      }));
    } else {
      setForm((prev) => (prev.uom_count === 0 ? prev : { ...prev, uom_count: 0 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.p_uom, form.l_uom]);

  const setField = <K extends keyof TProductFormik>(key: K, value: TProductFormik[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (!form.prod_name?.trim()) return "Product Name is required";
    if (!form.prin_code) return "Principal Code is required";
    if (!form.group_code) return "Group Code is required";
    if (!form.brand_code) return "Brand Code is required";
    if (!form.p_uom) return "Primary UOM is required";
    if (!form.l_uom) return "Lowest UOM is required";
    if (isSameUOM) {
      if (Number(form.uppp) !== 1) return "UPPP must be 1 when Primary and Lowest UOM are the same";
    } else if (!form.uppp || Number(form.uppp) < 2) {
      return "UPPP must be at least 2 when Primary and Lowest UOM are different";
    }
    if (!form.upp || Number(form.upp) <= 0) return "Def. Units/Pallette must be greater than 0";
    if (!form.site_ind) return "Default Site Ind is required";
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.warning(error);
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (!isEditMode && selectedPrincipal?.auto_generate_product_code === "Y") {
        delete payload.prod_code;
      }
      delete payload.prin_name;
      delete payload.group_name;
      delete payload.brand_name;
      if (isEditMode) {
        await editProduct(payload);
      } else {
        await addProduct(payload);
      }
      toast.success("Product saved successfully");
      onClose(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  /* ✅ Expose save() to parent */
  useImperativeHandle(ref, () => ({
    save: handleSubmit,
  }));

  return (
    <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
      {/* ── Tabs shell (Freight style) ── */}
      <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
        <div className="freight-tabs-list flex overflow-x-auto">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              aria-pressed={step === index}
              className={`freight-workspace-tab ${step === index ? "active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="freight-tabs-panel border-t p-3 grid gap-3">
          {/* ══ STEP 0 — Product Details ══ */}
          {step === 0 && (
            <>
              <SectionPanel title="Classification" icon={Building2}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Principal Code" required>
                    <LookupField
                      label=""
                      value={form.prin_code}
                      valueField="prin_code"
                      displayFields={["prin_code", "prin_name"]}
                      disabled={isEditMode}
                      columns={[
                        { field: "prin_code", header: "Principal Code" },
                        { field: "prin_name", header: "Principal Name" },
                      ]}
                      loadOptions={async () => principals}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          prin_code: value,
                          group_code: "",
                          brand_code: "",
                          manu_code: "",
                        }))
                      }
                      compact
                    />
                  </Field>

                  <Field label="Group Code" required>
                    <LookupField
                      label=""
                      disabled={!form.prin_code || isEditMode}
                      value={form.group_code ?? ""}
                      valueField="group_code"
                      displayFields={["group_code", "group_name"]}
                      columns={[
                        { field: "group_code", header: "Group Code" },
                        { field: "group_name", header: "Group Name" },
                      ]}
                      loadOptions={async () => {
                        if (!form.prin_code) return [];
                        const sql = `SELECT * FROM MS_PRODGROUP WHERE PRIN_CODE = '${form.prin_code}'`;
                        return (await executeWmsInboundSql(sql)) ?? [];
                      }}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, group_code: value, brand_code: "" }))
                      }
                      compact
                    />
                  </Field>

                  <Field label="Brand Code" required>
                    <LookupField
                      label=""
                      disabled={!form.prin_code || !form.group_code || isEditMode}
                      value={form.brand_code ?? ""}
                      valueField="brand_code"
                      displayFields={["brand_code", "brand_name"]}
                      columns={[
                        { field: "brand_code", header: "Brand Code" },
                        { field: "brand_name", header: "Brand Name" },
                      ]}
                      loadOptions={async () => {
                        if (!form.prin_code || !form.group_code) return [];
                        const sql = `SELECT * FROM MS_PRODBRAND WHERE PRIN_CODE = '${form.prin_code}' AND GROUP_CODE = '${form.group_code}'`;
                        return (await executeWmsInboundSql(sql)) ?? [];
                      }}
                      onChange={(value) => setField("brand_code", value)}
                      compact
                    />
                  </Field>
                </div>
              </SectionPanel>

              <SectionPanel title="Identification" icon={IdCard}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Product Code">
                    <Input
                      value={form.prod_code ?? ""}
                      disabled={!!form.prin_code && selectedPrincipal?.auto_generate_product_code === "Y"}
                      onChange={(e) => setField("prod_code", e.target.value)}
                    />
                  </Field>
                  <Field label="Product Name" required className="md:col-span-2">
                    <Input value={form.prod_name} onChange={(e) => setField("prod_name", e.target.value)} />
                  </Field>
                  <Field label="Model #">
                    <Input value={form.model_number} onChange={(e) => setField("model_number", e.target.value)} />
                  </Field>
                  <Field label="Variant">
                    <Input value={form.variant_code} onChange={(e) => setField("variant_code", e.target.value)} />
                  </Field>
                </div>
              </SectionPanel>
            </>
          )}

          {/* ══ STEP 1 — UOM & Volume ══ */}
          {step === 1 && (
            <>
              <SectionPanel title="Unit of Measure" icon={Box}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="No. of UOMs">
                    <Input disabled value={form.uom_count} />
                  </Field>
                  <Field label="Primary UOM" required>
                    <LookupField
                      label=""
                      value={form.p_uom ?? ""}
                      valueField="uom_code"
                      displayFields={["uom_code", "uom_name"]}
                      columns={[
                        { field: "uom_code", header: "Code" },
                        { field: "uom_name", header: "Name" },
                      ]}
                      loadOptions={async () => uomList}
                      onChange={(value) => setField("p_uom", value)}
                      compact
                    />
                  </Field>
                  <Field label="Lowest UOM" required>
                    <LookupField
                      label=""
                      value={form.l_uom ?? ""}
                      valueField="uom_code"
                      displayFields={["uom_code", "uom_name"]}
                      columns={[
                        { field: "uom_code", header: "Code" },
                        { field: "uom_name", header: "Name" },
                      ]}
                      loadOptions={async () => uomList}
                      onChange={(value) => setField("l_uom", value)}
                      compact
                    />
                  </Field>
                  <Field label="Units/Prim Pack" required>
                    <Input
                      type="number"
                      disabled={isSameUOM}
                      value={form.uppp}
                      onChange={(e) => setField("uppp", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Def. Units/Pallette" required>
                    <Input
                      type="number"
                      value={form.upp}
                      onChange={(e) => setField("upp", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Qty As Wt">
                    <CheckboxField
                      checked={form.qty_as_wt === "Y"}
                      onChange={(v) => setField("qty_as_wt", v ? "Y" : "N")}
                      label="Yes/No"
                    />
                  </Field>
                </div>
              </SectionPanel>

              <SectionPanel title="Dimensions & Weight" icon={Ruler}>
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    { label: "Length", key: "length" },
                    { label: "Width", key: "breadth" },
                    { label: "Height", key: "height" },
                    { label: "Volume", key: "volume" },
                    { label: "Gross Weight", key: "gross_wt" },
                    { label: "Net Weight", key: "net_wt" },
                    { label: "Layers", key: "prod_hi" },
                    { label: "Carton / Layer", key: "prod_ti" },
                  ].map(({ label, key }) => (
                    <Field label={label} key={key}>
                      <Input
                        type="number"
                        value={(form as any)[key]}
                        onChange={(e) =>
                          setField(key as keyof TProductFormik, Number(e.target.value) as any)
                        }
                      />
                    </Field>
                  ))}
                </div>
              </SectionPanel>
            </>
          )}

          {/* ══ STEP 2 — Manufacture & Validation ══ */}
          {step === 2 && (
            <>
              <SectionPanel title="References" icon={Building2}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Harmonize Code">
                    <LookupField
                      label=""
                      value={form.harm_code ?? ""}
                      valueField="harm_code"
                      displayFields={["harm_code", "harm_desc"]}
                      columns={[
                        { field: "harm_code", header: "Code" },
                        { field: "harm_desc", header: "Description" },
                      ]}
                      loadOptions={async () => harmonizeList}
                      onChange={(value) => setField("harm_code", value)}
                      compact
                    />
                  </Field>
                  <Field label="IMCO Code">
                    <Input value={form.imco_code} onChange={(e) => setField("imco_code", e.target.value)} />
                  </Field>
                  <Field label="Manufacturer">
                    <LookupField
                      label=""
                      value={form.manu_code ?? ""}
                      valueField="manu_code"
                      displayFields={["manu_code", "manu_name"]}
                      columns={[
                        { field: "manu_code", header: "Code" },
                        { field: "manu_name", header: "Name" },
                      ]}
                      loadOptions={async () => filteredManufacturers}
                      onChange={(value) => setField("manu_code", value)}
                      compact
                    />
                  </Field>
                  <Field label="Alternate Prod Code">
                    <Input
                      value={form.alt_prod_code}
                      onChange={(e) => setField("alt_prod_code", e.target.value)}
                    />
                  </Field>
                  <Field label="Default Site Ind" required>
                    <LookupField
                      label=""
                      value={form.site_ind ?? ""}
                      valueField="SITE_IND"
                      displayFields={["SITE_IND", "IND_DESC"]}
                      columns={[
                        { field: "SITE_IND", header: "Ind" },
                        { field: "IND_DESC", header: "Description" },
                      ]}
                      loadOptions={async () => siteIndList}
                      onChange={(value) => setField("site_ind", value)}
                      compact
                    />
                  </Field>
                  <Field label="Batch Type">
                    <Input
                      type="number"
                      value={form.batch_type}
                      onChange={(e) => setField("batch_type", Number(e.target.value))}
                    />
                  </Field>
                </div>
              </SectionPanel>

              <SectionPanel title="Validation Rules" icon={ShieldCheck}>
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    { label: "Mfg/Exp Dt", key: "chk_mfgexpdt" },
                    { label: "Supp. cd", key: "chk_manucode" },
                    { label: "Lot No", key: "chk_lotno" },
                    { label: "Kitting", key: "kitting" },
                    { label: "Serialize", key: "serialize" },
                  ].map(({ label, key }) => (
                    <Field label={label} key={key}>
                      <CheckboxField
                        checked={(form as any)[key] === "Y"}
                        onChange={(v) => setField(key as keyof TProductFormik, (v ? "Y" : "N") as any)}
                        label="Y/N"
                      />
                    </Field>
                  ))}
                  <Field label="Receipt Exp Limit">
                    <Input
                      type="number"
                      value={form.rcpt_exp_limit}
                      onChange={(e) => setField("rcpt_exp_limit", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Min Period Exp Pick">
                    <Input
                      type="number"
                      value={form.minperiod_exppick}
                      onChange={(e) => setField("minperiod_exppick", Number(e.target.value))}
                    />
                  </Field>
                </div>
              </SectionPanel>
            </>
          )}

          {/* ══ STEP 3 — Category & Product ══ */}
          {step === 3 && (
            <>
              <SectionPanel title="Category & Status" icon={LayoutGrid}>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Category ABC">
                    <LookupField
                      label=""
                      value={form.category_abc ?? ""}
                      valueField="category_code"
                      displayFields={["category_code", "category_name"]}
                      columns={[
                        { field: "category_code", header: "Code" },
                        { field: "category_name", header: "Name" },
                      ]}
                      loadOptions={async () => categoryList}
                      onChange={(value) => setField("category_abc", value)}
                      compact
                    />
                  </Field>
                  <Field label="Status" required>
                    <Select
                      value={form.prod_status}
                      onChange={(e) => setField("prod_status", e.target.value)}
                    >
                      <option value="O">Active</option>
                      <option value="C">Inactive</option>
                    </Select>
                  </Field>
                  <Field label="Product Type">
                    <LookupField
                      label=""
                      value={String(form.prod_type ?? "")}
                      valueField="PRODTYPE_CODE"
                      displayFields={["PRODTYPE_CODE", "PRODTYPE_DESC"]}
                      columns={[
                        { field: "PRODTYPE_CODE", header: "Code" },
                        { field: "PRODTYPE_DESC", header: "Description" },
                      ]}
                      loadOptions={async () => productTypeList}
                      onChange={(value) => setField("prod_type", value ? parseInt(value, 10) : 0)}
                      compact
                    />
                  </Field>
                  <Field label="Product Stage">
                    <Input
                      value={form.product_stage}
                      onChange={(e) => setField("product_stage", e.target.value)}
                    />
                  </Field>
                  <Field label="Base Price">
                    <Input
                      type="number"
                      value={form.base_price}
                      onChange={(e) => setField("base_price", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Def. Pick Wave">
                    <LookupField
                      label=""
                      value={String(form.wave_code ?? "")}
                      valueField="CODE"
                      displayFields={["CODE", "NAME"]}
                      columns={[
                        { field: "CODE", header: "Code" },
                        { field: "NAME", header: "Name" },
                      ]}
                      loadOptions={async () => pickWaveList}
                      onChange={(value) => setField("wave_code", value ? parseInt(value, 10) : 0)}
                      compact
                    />
                  </Field>
                  <Field label="Shelf Life (Days)">
                    <Input
                      type="number"
                      value={form.shelf_life}
                      onChange={(e) => setField("shelf_life", Number(e.target.value))}
                    />
                  </Field>
                </div>
              </SectionPanel>

              <SectionPanel title="Attributes" icon={ShieldCheck}>
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    { label: "Co-packed", key: "co_pack" },
                    { label: "Hazmat Class", key: "hazmat_class" },
                    { label: "Food Ind", key: "food_ind" },
                    { label: "Pharma Ind", key: "pharma_ind" },
                  ].map(({ label, key }) => (
                    <Field label={label} key={key}>
                      <CheckboxField
                        checked={(form as any)[key] === "Y"}
                        onChange={(v) => setField(key as keyof TProductFormik, (v ? "Y" : "N") as any)}
                        label="Y/N"
                      />
                    </Field>
                  ))}
                </div>
              </SectionPanel>

              <SectionPanel title="Notes" icon={StickyNote}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Special Instructions" className="md:col-span-2">
                    <Input
                      value={form.special_instructions}
                      onChange={(e) => setField("special_instructions", e.target.value)}
                    />
                  </Field>
                </div>
              </SectionPanel>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom action row (Freight style) ── */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className={`inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors ${
            step === 0 ? "invisible" : ""
          }`}
        >
          <X size={11} /> Back
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 rounded-md px-4 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-semibold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
            >
              Next <ChevronRight size={11} className="ml-1" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className={`inline-flex items-center gap-1 rounded-md px-4 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-semibold shadow-sm transition-all ${
                saving
                  ? "bg-primary/60 text-primary-foreground cursor-not-allowed"
                  : isEditMode
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  {isEditMode ? "Update" : "Submit"}
                  <Save size={11} className="ml-1" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default AddProductWmsForm;