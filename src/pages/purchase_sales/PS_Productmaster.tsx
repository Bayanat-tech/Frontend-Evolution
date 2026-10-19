import { Edit2, FileText, List, Plus, RotateCcw, Save, Trash2, X, Loader2, Building2, IdCard, Ruler, Box, ShieldCheck, LayoutGrid, StickyNote, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeDynamicDelete, executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from "../../components/ui/LookupField";
import { Input } from "../../components/ui/Input";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & field definitions                                          */
/* ------------------------------------------------------------------ */

type ProductRow = Record<string, any>;

const LIST_COLUMNS: { key: string; label: string; width?: number }[] = [
  { key: "prod_code", label: "Product Code", width: 150 },
  { key: "prod_name", label: "Product Name", width: 260 },
  { key: "model_number", label: "Model No", width: 150 },
  { key: "group_code", label: "Group", width: 120 },
  { key: "brand_code", label: "Brand", width: 120 },
  { key: "category_code", label: "Category", width: 120 },
  { key: "p_uom", label: "Primary UOM", width: 120 },
  { key: "div_code", label: "Division", width: 110 },
  { key: "sales_rate", label: "Sales Rate", width: 120 },
];

type Notice = { type: "success" | "error"; message: string } | null;

const STEPS = ["Product Details", "UOM & Volume", "Manufacture & Validation", "Category & Product"];

const makeEmpty = (): ProductRow => ({
  prod_code: "", prod_name: "", prin_code: "", brand_code: "", group_code: "",
  model_number: "", variant_code: "", p_uom: "", l_uom: "", uppp: 0, upp: 0,
  uom_count: 0, length: 0, breadth: 0, height: 0, volume: 0, gross_wt: 0, net_wt: 0,
  manu_code: "", alt_prod_code: "", site_ind: "", category_abc: "", prod_status: "O",
  prod_type: 0, product_stage: "", base_price: 0, wave_code: 0, shelf_life: 0,
  co_pack: "N", barcode: "", size_code: "", color_code: "", div_code: "",
  active: "Y", remarks: "", cost_rate: 0, retail_rate: 0, sales_rate: 0,
  reorder_qty: 0, tx_compt_1: "N", tx_compt_2: "N", tx_compt_3: "N", tx_compt_4: "N",
});

/* ─────────────────────────────────────────────────────────────
   SectionPanel — Clean white box with blue icon
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
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm mb-4 w-full">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-[#00378C] text-white">
          <Icon size={16} />
        </div>
        <h3 className="m-0 text-[13px] font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — Uppercase bold label, spacing
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
    <label className={`group flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 transition-colors">
        {label}
        {required && <strong className="ml-0.5 font-bold" style={{ color: "#E24B4A" }}> *</strong>}
      </span>
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Checkbox
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
    <div className="inline-flex h-10 items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#00378C", width: "16px", height: "16px" }}
        className="shrink-0 cursor-pointer rounded border border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00378C]/25 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {label && (
        <span
          onClick={() => !disabled && onChange(!checked)}
          className={`text-[12px] font-medium text-slate-700 leading-none transition-colors ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:text-slate-900"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const ProductPurchaseSales = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [original, setOriginal] = useState<ProductRow | null>(null);
  const [form, setForm] = useState<ProductRow>(() => makeEmpty());
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await getDynamicLookup({
        parameter: "PURCHASE_SALES_MSE_PRODUCT_DATA_TABLE",
        code1: companyCode,
      });
      setRows((Array.isArray(response) ? response : []).map(normalizeRow));
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err, "Unable to load products") });
      setRows([]);
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

  const openAdd = () => {
    setEditMode(false);
    setOriginal(null);
    setForm(makeEmpty());
    setStep(0);
    setError("");
    setNotice(null);
    setFormOpen(true);
  };

  const openEdit = (row: ProductRow) => {
    setEditMode(true);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row });
    setStep(0);
    setError("");
    setNotice(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setError("");
  };

  const setField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    setError("");
    
    if (!form.prod_name?.trim()) {
      setError("Product Name is required");
      return;
    }
    if (!form.group_code) {
      setError("Group Code is required");
      return;
    }
    if (!form.brand_code) {
      setError("Brand Code is required");
      return;
    }

    try {
      setSaving(true);
      const data: ProductRow = editMode ? { ...(original || {}), ...form } : form;
      await saveProduct(data, loginId, companyCode);
      setNotice({ type: "success", message: editMode ? "Successfully updated" : "Successfully created" });
      setFormOpen(false);
      await loadRows(false);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save product"));
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "PURCHASE_SALES_DEL_MSE_PRODUCT",
        loginid: loginId,
        code1: companyCode,
        code2: String(deleteTarget.prod_code),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Successfully deleted" });
      await loadRows(false);
    } catch (err) {
      setNotice({ type: "error", message: getErrorMessage(err, "Unable to delete product") });
    }
  };

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      ...LIST_COLUMNS.map<ColumnDef<ProductRow>>((column, index) => ({
        accessorKey: column.key,
        header: column.label,
        size: column.width,
        cell: ({ row }) =>
          index === 0 ? (
            <button
              type="button"
              onClick={() => openEdit(row.original)}
              className="font-semibold text-[#00378C] hover:underline cursor-pointer text-left bg-transparent border-none p-0"
              title="Click to edit"
            >
              {String(row.original[column.key] ?? "")}
            </button>
          ) : (
            <span>{String(row.original[column.key] ?? "")}</span>
          ),
      })),
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
              title="Edit"
              onClick={() => openEdit(row.original)}
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
    ],
    [],
  );

  const pageTitle = formOpen ? (editMode ? "Edit Product" : "New Product") : "Product";

  return (
    // Added w-full max-w-full to force the container to take the whole screen
    <div className="flex flex-col gap-4 p-4 bg-[#f8fafc] min-h-screen w-full max-w-full overflow-x-hidden">
      
      {formOpen && (
        <div className="relative flex flex-col w-full rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          
          {/* Header with Gradient Line */}
          <div className="relative border-b border-slate-200">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500" />
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 pt-5">
              <div className="flex items-center gap-3">
                <FileText className="text-[#00378C]" size={20} />
                <h1 className="m-0 text-xl font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
                {!editMode && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Draft
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  disabled={saving}
                  className="h-8 gap-1.5 text-xs font-semibold px-3 rounded-md border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft size={14} /> List
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  disabled={saving}
                  className="h-8 gap-1.5 text-xs font-semibold px-3 rounded-md border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <X size={14} /> Close
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={saving}
                  className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-sm text-xs font-semibold px-4 rounded-md"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs - Full Width Gray Bar */}
          <div className="flex w-full overflow-x-auto bg-slate-50 border-b border-slate-200">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                aria-pressed={step === index}
                className={`whitespace-nowrap px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  step === index 
                    ? "border-[#00378C] text-[#00378C] bg-white shadow-[0_1px_0_0_#fff]" 
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content Area - Gray background, full width */}
          <div className="flex flex-col gap-4 p-5 bg-slate-50 w-full">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
            
            {/* ══ STEP 0 — Product Details ══ */}
            {step === 0 && (
              <div className="w-full">
                <SectionPanel title="Classification" icon={Building2}>
                  <div className="grid gap-4 md:grid-cols-2 w-full">
                    <Field label="Group Code" required>
                      <LookupField
                        label=""
                        value={form.group_code ?? ""}
                        valueField="group_code"
                        displayFields={["group_code", "group_name"]}
                        columns={[
                          { field: "group_code", header: "Group Code" },
                          { field: "group_name", header: "Group Name" },
                        ]}
                        loadOptions={async () => {
                          return await getDynamicLookup({
                            parameter: "PURCHASE_SALES_DD_ONLY_COMPANY_GROUP",
                            loginid: loginId,
                            code1: companyCode,
                          }) || [];
                        }}
                        onChange={(value) => setField("group_code", value)}
                        compact
                      />
                    </Field>

                    <Field label="Brand Code" required>
                      <LookupField
                        label=""
                        value={form.brand_code ?? ""}
                        valueField="brand_code"
                        displayFields={["brand_code", "brand_name"]}
                        columns={[
                          { field: "brand_code", header: "Brand Code" },
                          { field: "brand_name", header: "Brand Name" },
                        ]}
                        loadOptions={async () => {
                          return await getDynamicLookup({
                            parameter: "PURCHASE_SALES_DD_ONLY_COMPANY_BRAND",
                            loginid: loginId,
                            code1: companyCode,
                          }) || [];
                        }}
                        onChange={(value) => setField("brand_code", value)}
                        compact
                      />
                    </Field>
                  </div>
                </SectionPanel>

                <SectionPanel title="Identification" icon={IdCard}>
                  <div className="grid gap-4 md:grid-cols-2 w-full">
                    <Field label="Product Code" required>
                      <Input
                        value={form.prod_code ?? ""}
                        disabled={editMode}
                        onChange={(e) => setField("prod_code", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Product Name" required>
                      <Input 
                        value={form.prod_name ?? ""} 
                        onChange={(e) => setField("prod_name", e.target.value)} 
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Model #">
                      <Input 
                        value={form.model_number ?? ""} 
                        onChange={(e) => setField("model_number", e.target.value)} 
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Variant / Season">
                      <Input 
                        value={form.season_code ?? form.variant_code ?? ""} 
                        onChange={(e) => setField("season_code", e.target.value)} 
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                  </div>
                </SectionPanel>
              </div>
            )}

            {/* ══ STEP 1 — UOM & Volume ══ */}
            {step === 1 && (
              <div className="w-full">
                <SectionPanel title="Unit of Measure" icon={Box}>
                  <div className="grid gap-4 md:grid-cols-3 w-full">
                    <Field label="No. of UOMs">
                      <Input disabled value={form.uom_count ?? 0} className="h-10 bg-slate-50/50 border-slate-200 w-full" />
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
                        loadOptions={async () => {
                          return await getDynamicLookup({
                            parameter: "PURCHASE_SALES_DD_ONLY_COMPANY_UOM",
                            loginid: loginId,
                            code1: companyCode,
                          }) || [];
                        }}
                        onChange={(value) => setField("p_uom", value)}
                        compact
                      />
                    </Field>
                    <Field label="Lower UOM" required>
                      <LookupField
                        label=""
                        value={form.l_uom ?? ""}
                        valueField="uom_code"
                        displayFields={["uom_code", "uom_name"]}
                        columns={[
                          { field: "uom_code", header: "Code" },
                          { field: "uom_name", header: "Name" },
                        ]}
                        loadOptions={async () => {
                          return await getDynamicLookup({
                            parameter: "PURCHASE_SALES_DD_ONLY_COMPANY_UOM",
                            loginid: loginId,
                            code1: companyCode,
                          }) || [];
                        }}
                        onChange={(value) => setField("l_uom", value)}
                        compact
                      />
                    </Field>
                    <Field label="UPPP" required>
                      <Input
                        type="number"
                        value={form.uppp ?? 0}
                        onChange={(e) => setField("uppp", Number(e.target.value))}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                  </div>
                </SectionPanel>

                <SectionPanel title="Dimensions" icon={Ruler}>
                  <div className="grid gap-4 md:grid-cols-4 w-full">
                    {[
                      { label: "Length", key: "length" },
                      { label: "Breadth", key: "breadth" },
                      { label: "Height", key: "height" },
                      { label: "Volume", key: "volume" },
                      { label: "Gross Weight", key: "gross_wt" },
                      { label: "Net Weight", key: "net_wt" },
                    ].map(({ label, key }) => (
                      <Field label={label} key={key}>
                        <Input
                          type="number"
                          value={form[key] ?? 0}
                          onChange={(e) => setField(key, Number(e.target.value))}
                          className="h-10 bg-slate-50/50 border-slate-200 w-full"
                        />
                      </Field>
                    ))}
                  </div>
                </SectionPanel>
              </div>
            )}

            {/* ══ STEP 2 — Manufacture & Validation ══ */}
            {step === 2 && (
              <div className="w-full">
                <SectionPanel title="Manufacture Details" icon={Building2}>
                  <div className="grid gap-4 md:grid-cols-3 w-full">
                    <Field label="Manufacturer Code">
                      <Input 
                        value={form.manu_code ?? ""} 
                        onChange={(e) => setField("manu_code", e.target.value)} 
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Origin Country">
                      <Input 
                        value={form.origin_country ?? ""} 
                        onChange={(e) => setField("origin_country", e.target.value)} 
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Alternate Product">
                      <Input
                        value={form.alt_prod_code ?? ""}
                        onChange={(e) => setField("alt_prod_code", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                  </div>
                </SectionPanel>

                <SectionPanel title="Pricing" icon={ShieldCheck}>
                  <div className="grid gap-4 md:grid-cols-4 w-full">
                    <Field label="Cost Rate Unit">
                      <Input
                        type="number"
                        value={form.cost_rate ?? 0}
                        onChange={(e) => setField("cost_rate", Number(e.target.value))}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Retail Price">
                      <Input
                        type="number"
                        value={form.retail_rate ?? 0}
                        onChange={(e) => setField("retail_rate", Number(e.target.value))}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Sales Rate">
                      <Input
                        type="number"
                        value={form.sales_rate ?? 0}
                        onChange={(e) => setField("sales_rate", Number(e.target.value))}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Reorder Qty">
                      <Input
                        type="number"
                        value={form.reorder_qty ?? 0}
                        onChange={(e) => setField("reorder_qty", Number(e.target.value))}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                  </div>
                </SectionPanel>
                
                <SectionPanel title="Tax Component" icon={ShieldCheck}>
                  <div className="grid gap-4 md:grid-cols-4 w-full">
                     {[1, 2, 3, 4].map((num) => (
                      <Field label={`Tax Component ${num}`} key={`tx_${num}`}>
                        <Input
                          value={form[`tx_compt_${num}`] ?? ""}
                          onChange={(e) => setField(`tx_compt_${num}`, e.target.value)}
                          className="h-10 bg-slate-50/50 border-slate-200 w-full"
                        />
                      </Field>
                    ))}
                  </div>
                </SectionPanel>
              </div>
            )}

            {/* ══ STEP 3 — Category & Product ══ */}
            {step === 3 && (
              <div className="w-full">
                <SectionPanel title="Classification" icon={LayoutGrid}>
                  <div className="grid gap-4 md:grid-cols-3 w-full">
                    <Field label="Category Code">
                      <LookupField
                        label=""
                        value={form.category_code ?? ""}
                        valueField="category_code"
                        displayFields={["category_code", "category_name"]}
                        columns={[
                          { field: "category_code", header: "Code" },
                          { field: "category_name", header: "Name" },
                        ]}
                        loadOptions={async () => {
                          return await getDynamicLookup({
                            parameter: "PURCHASE_SALES_DD_ONLY_COMPANY_CATEGORY",
                            loginid: loginId,
                            code1: companyCode,
                          }) || [];
                        }}
                        onChange={(value) => setField("category_code", value)}
                        compact
                      />
                    </Field>
                    
                    <Field label="Product Type Code">
                      <LookupField
                        label=""
                        value={form.prodtype_code ?? ""}
                        valueField="prodtype_code"
                        displayFields={["prodtype_code", "prodtype_name"]}
                        columns={[
                          { field: "prodtype_code", header: "Code" },
                          { field: "prodtype_name", header: "Name" },
                        ]}
                        loadOptions={async () => {
                          return await getDynamicLookup({
                            parameter: "PURCHASE_SALES_DD_ONLY_COMPANY_PRODTYPE",
                            loginid: loginId,
                            code1: companyCode,
                          }) || [];
                        }}
                        onChange={(value) => setField("prodtype_code", value)}
                        compact
                      />
                    </Field>

                    <Field label="Division Code">
                      <LookupField
                        label=""
                        value={form.div_code ?? ""}
                        valueField="div_code"
                        displayFields={["div_code", "div_name"]}
                        columns={[
                          { field: "div_code", header: "Code" },
                          { field: "div_name", header: "Name" },
                        ]}
                        loadOptions={async () => {
                          return await getDynamicLookup({
                            parameter: "PURCHASE_SALES_DD_ONLY_COMPANY_HR_DIVISION",
                            loginid: loginId,
                            code1: companyCode,
                          }) || [];
                        }}
                        onChange={(value) => setField("div_code", value)}
                        compact
                      />
                    </Field>
                    
                    <Field label="Color Code">
                      <Input
                        value={form.color_code ?? ""}
                        onChange={(e) => setField("color_code", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                  </div>
                </SectionPanel>

                <SectionPanel title="Barcode and QR Code" icon={ShieldCheck}>
                  <div className="grid gap-4 md:grid-cols-4 w-full">
                    <Field label="Barcode">
                      <Input
                        value={form.barcode ?? ""}
                        onChange={(e) => setField("barcode", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Size Code">
                      <Input
                        value={form.size_code ?? ""}
                        onChange={(e) => setField("size_code", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Active">
                      <CheckboxField
                        checked={form.active === "Y" || form.active === true}
                        onChange={(v) => setField("active", v ? "Y" : "N")}
                        label="Yes/No"
                      />
                    </Field>
                    <Field label="Co Packing">
                      <Input
                        value={form.co_packing ?? ""}
                        onChange={(e) => setField("co_packing", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                    <Field label="Product Stage">
                      <Input
                        value={form.product_stage ?? ""}
                        onChange={(e) => setField("product_stage", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                  </div>
                </SectionPanel>

                <SectionPanel title="Remarks" icon={StickyNote}>
                  <div className="grid gap-4 md:grid-cols-1 w-full">
                    <Field label="Remarks">
                      <Input
                        value={form.remarks ?? ""}
                        onChange={(e) => setField("remarks", e.target.value)}
                        className="h-10 bg-slate-50/50 border-slate-200 w-full"
                      />
                    </Field>
                  </div>
                </SectionPanel>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className={`inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors ${
                step === 0 ? "invisible" : ""
              }`}
            >
              <ChevronLeft size={14} /> Back
            </button>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-medium">
                Step {step + 1} of {STEPS.length}
              </span>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="inline-flex items-center gap-1 rounded-md px-4 py-1.5 text-xs font-semibold shadow-sm bg-[#00378C] hover:bg-[#002d72] text-white transition-all"
                >
                  Next <ChevronRight size={14} className="ml-1" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit()}
                  className={`inline-flex items-center gap-1 rounded-md px-4 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                    saving
                      ? "bg-[#00378C]/60 text-white cursor-not-allowed"
                      : "bg-[#00378C] hover:bg-[#002d72] text-white"
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-1" /> Saving…
                    </>
                  ) : (
                    <>
                      Save <Save size={14} className="ml-1" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- LIST ---------- */}
      {!formOpen && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm w-full">
          <DataTable
            columns={columns}
            data={filteredRows}
            title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Records`}
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search product..."
            loading={loading}
            emptyText="No products found"
            height="calc(100dvh - 150px)"
            minWidth={Math.max(900, LIST_COLUMNS.reduce((sum, column) => sum + (column.width || 160), 120))}
            density="grid"
            enablePagination={false}
            enableExport={false}
            actionButton={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={openAdd}
                  className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-3.5 rounded-lg"
                >
                  <Plus size={14} strokeWidth={2.5} /> Add
                </Button>
                <FinanceListActionsMenu
                  fyPeriod=""
                  fyPeriods={[]}
                  onFyPeriodChange={() => {}}
                  onExport={() =>
                    exportToCsv(filteredRows, columns, `product-${new Date().toISOString().slice(0, 10)}.csv`)
                  }
                  onRefresh={() => void loadRows(false)}
                />
              </div>
            }
            getRowId={(row, index) => `${String(row.prod_code ?? "")}_${index}`}
          />
        </div>
      )}

      {/* ---------- DELETE CONFIRM ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Delete Product"
        description="This action cannot be undone."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Close
            </Button>
            <Button variant="destructive" onClick={() => void deleteRow()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete <strong>{String(deleteTarget?.prod_code ?? "")}</strong>?
        </p>
      </Dialog>
    </div>
  );
};

export default ProductPurchaseSales;

/* ------------------------------------------------------------------ */
/*  Save (insert / update)                                             */
/* ------------------------------------------------------------------ */

async function saveProduct(form: ProductRow, loginid: string, companyCode: string) {
  const toStr = (v: unknown) => (v != null && v !== "" ? String(v) : undefined);
  const toNum = (v: unknown) => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  await executeDynamicMutationColumn90({
    parameter: "purchase_sales_ins_upd_mse_product",
    loginid,

    val1s1: companyCode,
    val1s2: toStr(form.prod_code),
    val1s3: toStr(form.prod_name),
    val1s4: toStr(form.model_number),
    val1s5: toStr(form.barcode ?? form.bar_code),
    val1s6: toStr(form.group_code),
    val1s7: toStr(form.brand_code),
    val1s8: toStr(form.category_code),
    val1s9: toStr(form.prodtype_code),
    val1s10: toStr(form.manu_code),
    val1s11: toStr(form.alt_prod_code),
    val1s12: toStr(form.p_uom),
    val1s13: toStr(form.l_uom),
    val1s14: toStr(form.origin_country),
    val1s15: toStr(form.co_packing ?? form.co_pack) ?? "N",
    val1s16: toStr(form.product_stage),
    val1s17: toStr(form.div_code),
    val1s18: toStr(form.size_code),
    val1s19: toStr(form.color_code),
    val1s20: toStr(form.season_code),
    val1s21: toStr(form.remarks),
    val1s22: toStr(form.is_inventory) ?? "Y",
    val1s23: toStr(form.active ?? form.is_active) ?? "Y",
    val1s24: toStr(form.active_status) ?? "Y",
    val1s25: toStr(form.supplier_code),
    val1s26: toStr(form.prod_image_path),
    val1s27: toStr(form.tx_compt_1) ?? "N",
    val1s28: toStr(form.tx_compt_2) ?? "N",
    val1s29: toStr(form.tx_compt_3) ?? "N",
    val1s30: toStr(form.tx_compt_4) ?? "N",

    val1n1: toNum(form.uom_count),
    val1n2: toNum(form.uppp),
    val1n3: toNum(form.length),
    val1n4: toNum(form.breadth),
    val1n5: toNum(form.height),
    val1n6: toNum(form.volume),
    val1n7: toNum(form.gross_wt),
    val1n8: toNum(form.net_wt),
    val1n9: toNum(form.cost_rate),
    val1n10: toNum(form.sales_rate),
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeRow(row: Record<string, unknown>): ProductRow {
  const normalized: ProductRow = { ...row };
  Object.entries(row).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    const axiosError = error as any;
    const data = axiosError.response?.data;
    if (data) {
      if (typeof data === "string") return data;
      if (data.message) return data.message;
      if (data.error) return data.error;
      if (data.msg) return data.msg;
    }
    return error.message;
  }
  return defaultMessage;
}