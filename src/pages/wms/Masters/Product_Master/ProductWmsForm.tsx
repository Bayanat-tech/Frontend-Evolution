import { Loader2, Save , Building2, IdCard, Ruler, Box, ShieldCheck,LayoutGrid, StickyNote, } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TProduct, TProductFormik } from "./product-wms.types";
import { useAuth } from "../../../../state/AuthContext";
import { useToast } from "../../../../components/ui/AlertToast";
import { Card, CardContent } from "../../../../components/ui/Card";
import { LookupField } from "../../../../components/ui/LookupField";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Button } from "../../../../components/ui/Button";
import { addProduct, editProduct, executeWmsInboundSql, getWmsMaster } from "../../../../api/wms";
import type { LucideIcon } from "lucide-react";


const STEPS = ["Product Details", "UOM & Volume", "Manufacture & Validation", "Category & Product"];

const emptyProduct: TProduct = {
  prod_name: "",
  prod_code: "",
  prin_code: "",
  brand_code: "",
  group_code: "",
  packdesc: "",
  barcode: "",
  p_uom: "",
  suom: "",
  length: 0,
  breadth: 0,
  height: 0,
  volume: 0,
  gross_wt: 0,
  net_wt: 0,
  foc: "",
  cpu: 0,
  harm_code: "",
  imco_code: "",
  kitting: "",
  manu_code: "",
  base_price: 0,
  flat_storage: 0,
  site_type: "",
  site_ind: "",
  pack_key: "",
  prod_ti: 0,
  prod_hi: 0,
  chargetime: "",
  prod_status: "O",
  shelf_life: 0,
  category_abc: "",
  reord_level: 0,
  reord_qty: 0,
  alt_prod_code: "",
  pref_site: "",
  pref_loc_from: "",
  pref_loc_to: "",
  pref_aisle_from: "",
  pref_aisle_to: "",
  pref_col_from: 0,
  pref_col_to: 0,
  pref_ht_from: 0,
  pref_ht_to: 0,
  uppp: 0,
  chk_manucode: "",
  chk_lotno: "",
  chk_mfgexpdt: "",
  puom_volume: 0,
  puom_netwt: 0,
  puom_grosswt: 0,
  l_uom: "",
  luppp: 0,
  uom_count: 0,
  prod_type: 0,
  twoplus_uom: "",
  upp: 0,
  wave_code: 0,
  product_stage: "",
  co_pack: "",
  model_number: "",
  variant_code: "",
  cnt_origin: "",
  serialize: "",
  packing: "",
  old_upp: 0,
  avg_consumption: 0,
  prod_image_path_web: "",
  minperiod_exppick: 0,
  rcpt_exp_limit: 0,
  qty_as_wt: "",
  hazmat_ind: "",
  hazmat_class: "",
  food_ind: "",
  pharma_ind: "",
  special_instructions: "",
  strength: "",
  pack_size: 0,
  group_code_bk: "",
  batch_type: 0,
  sap_prod_code: "",
  sap_prod_desc: "",
  temp_code: "",
  edit_user: "",
  class: "",
  wob: 0,
  unified_code: "",
  current_season: "",
  product_category: "",
  generic_article: "",
  prod_gender: "",
  prod_color: "",
  prod_size: "",
  prnt_p_code: "",
};

type TOption = { code: string; name: string };

export default function AddProductWmsForm({
  onClose,
  isEditMode,
  existingData,
}: {
  onClose: (refetchData?: boolean) => void;
  isEditMode: boolean;
  existingData?: Partial<TProductFormik>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TProduct>({ ...emptyProduct, company_code: user?.company_code });

  // reference/master data
  const [principals, setPrincipals] = useState<any[]>([]);
  const [uomList, setUomList] = useState<any[]>([]);
  const [harmonizeList, setHarmonizeList] = useState<any[]>([]);
  const [manufacturerList, setManufacturerList] = useState<any[]>([]);
  const [categoryList, setCategoryList] = useState<any[]>([]);
  const [productTypeList, setProductTypeList] = useState<any[]>([]);
  const [siteIndList, setSiteIndList] = useState<any[]>([]);
  const [pickWaveList, setPickWaveList] = useState<any[]>([]);

  // load static/independent reference lists once
  useEffect(() => {
    (async () => {
      try {
        const [
          principalRes,
          uomRes,
          harmRes,
          manuRes,
          catRes,
          prodTypeRes,
          siteIndRes,
          pickWaveRes,
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

  // populate form when editing
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

  // auto-derive uom_count / uppp when UOMs change
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

  return (
    <div className="grid gap-4">
      {/* ── Stepper ── */}
        <div className="flex items-center justify-between px-1">
          {STEPS.map((label, index) => (
            <div key={label} className={`flex items-center ${index < STEPS.length - 1 ? "flex-1" : ""}`}>
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors
                    ${step === index ? "bg-primary text-primary-foreground" : step > index ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}
                >
                  {step > index ? "✓" : index + 1}
                </button>
                <span className={`whitespace-nowrap text-[10px] ${step === index ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`mx-1.5 mb-4 h-px flex-1 ${step > index ? "bg-green-600" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

      {/* ── Step content ── */}
      <div className="grid gap-3 pr-1">
        {step === 0 && (
          <>
            <Card>
              <SectionHeading title="Classification" icon={Building2}  />
              <CardContent className="grid gap-3 md:grid-cols-2 ">
                <LookupField
                  label="Principal Code"
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
                />

                <LookupField
                  disabled={!form.prin_code || isEditMode}
                  label="Group Code"
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
                  onChange={(value) => setForm((prev) => ({ ...prev, group_code: value, brand_code: "" }))}
                />

                <LookupField
                  disabled={!form.prin_code || !form.group_code || isEditMode}
                  label="Brand Code"
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
                />
              </CardContent>
            </Card>

            <Card>
              <SectionHeading title="Identification" icon={IdCard} /> 
              <CardContent className="grid gap-3 md:grid-cols-3 pt-2">
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
              </CardContent>
            </Card>
          </>
        )}

        {step === 1 && (
          <>
            <Card>
              <SectionHeading title="Unit of Measure" icon={Box} />
              <CardContent className="grid gap-3 md:grid-cols-3 pt-2">
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
                  <Input type="number" value={form.upp} onChange={(e) => setField("upp", Number(e.target.value))} />
                </Field>
                <Field label="Qty As Wt">
                  <label className="flex items-center gap-2 text-sm">
                    <CheckboxField checked={form.qty_as_wt === "Y"} onChange={(v) => setField("qty_as_wt", v ? "Y" : "N")} />
                    Yes/No
                  </label>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <SectionHeading title="Dimensions & Weight" icon={Ruler} /> 
              <CardContent className="grid gap-3 md:grid-cols-4 pt-2">
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
                      onChange={(e) => setField(key as keyof TProductFormik, Number(e.target.value) as any)}
                    />
                  </Field>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <Card>
              <SectionHeading title="References" icon={Building2} />  
              <CardContent className="grid gap-3 md:grid-cols-3">
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
                  />
                </Field>
                <Field label="Alternate Prod Code">
                  <Input value={form.alt_prod_code} onChange={(e) => setField("alt_prod_code", e.target.value)} />
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
                  />
                </Field>
                <Field label="Batch Type">
                  <Input
                    type="number"
                    value={form.batch_type}
                    onChange={(e) => setField("batch_type", Number(e.target.value))}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <SectionHeading title="Validation Rules" icon={ShieldCheck} />
              <CardContent className="grid gap-3 md:grid-cols-5 pt-2">
                {[
                  { label: "Mfg/Exp Dt", key: "chk_mfgexpdt" },
                  { label: "Supp. cd", key: "chk_manucode" },
                  { label: "Lot No", key: "chk_lotno" },
                  { label: "Kitting", key: "kitting" },
                  { label: "Serialize", key: "serialize" },
                ].map(({ label, key }) => (
                  <Field label={label} key={key}>
                    <label className="flex items-center gap-2 text-sm">
                      <CheckboxField
                        checked={(form as any)[key] === "Y"}
                        onChange={(v) => setField(key as keyof TProductFormik, (v ? "Y" : "N") as any)}
                      />
                      Y/N
                    </label>
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
              </CardContent>
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <Card>
              <SectionHeading title="Category & Status" icon={LayoutGrid} />
              <CardContent className="grid gap-3 md:grid-cols-3 pt-2">
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
                  />
                </Field>
                <Field label="Status" required>
                  <Select value={form.prod_status} onChange={(e) => setField("prod_status", e.target.value)}>
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
                  />
                </Field>
                <Field label="Product Stage">
                  <Input value={form.product_stage} onChange={(e) => setField("product_stage", e.target.value)} />
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
                  />
                </Field>
                <Field label="Shelf Life (Days)">
                  <Input
                    type="number"
                    value={form.shelf_life}
                    onChange={(e) => setField("shelf_life", Number(e.target.value))}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <SectionHeading title="Attributes" icon={ShieldCheck} /> 
              <CardContent className="grid gap-3 md:grid-cols-5 pt-2">
                {[
                  { label: "Co-packed", key: "co_pack" },
                  { label: "Hazmat Class", key: "hazmat_class" },
                  { label: "Food Ind", key: "food_ind" },
                  { label: "Pharma Ind", key: "pharma_ind" },
                ].map(({ label, key }) => (
                  <Field label={label} key={key}>
                    <label className="flex items-center gap-2 text-sm">
                    <CheckboxField
                            checked={(form as any)[key] === "Y"}
                            onChange={(v) => setField(key as keyof TProductFormik, (v ? "Y" : "N") as any)}
                      />
                      Y/N
                    </label>
                  </Field>
                ))}
              </CardContent>
            </Card>

            <Card>
              <SectionHeading title="Notes" icon={StickyNote} /> 
              <CardContent className="grid gap-3 md:grid-cols-2 pt-2">
                <Field label="Special Instructions" className="md:col-span-2">
                  <Input
                    value={form.special_instructions}
                    onChange={(e) => setField("special_instructions", e.target.value)}
                  />
                </Field>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Nav / submit ── */}
      <div className="flex justify-between pt-1">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} className={step === 0 ? "invisible" : ""}>
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : (
          <Button disabled={saving} onClick={handleSubmit}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Saving..." : isEditMode ? "Update" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}

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
    <label className={`field ${className ?? ""}`}>
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

function CheckboxField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ width: 14, height: 14 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-[3px] border transition-colors
        ${checked ? "bg-primary border-primary" : "bg-white border-gray-300"}`}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function SectionHeading({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="col-span-full -mt-0.5 mb-1 flex items-center gap-2 border-b border-border pb-2 pt-2 pl-2 ">
      <Icon size={14} className="text-muted-foreground" />
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
    </div>
  );
}