import { Edit2, FileText, List, Plus, Save, Trash2, X, Loader2, Building2, IdCard, Ruler, Box, ShieldCheck, LayoutGrid, StickyNote, ChevronRight } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeDynamicDelete, executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
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
   SectionPanel — EXACT Freight structure (from WMS)
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
    <div className="inline-flex items-center gap-2 select-none h-9">
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
  
  // View state
  const [view, setView] = useState<"list" | "editor">("list");
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
    setView("editor");
  };

  const openEdit = (row: ProductRow) => {
    setEditMode(true);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row });
    setStep(0);
    setError("");
    setNotice(null);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditMode(false);
    setOriginal(null);
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
      handleCloseEditor();
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

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  {editMode ? "Edit Product" : "New Product"}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editMode ? "Editing" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor}>
              <List size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button type="button" size="sm" onClick={() => handleSubmit()} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        {/* Form content */}
        <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">
          
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

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
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Product Code" required>
                        <Input
                          value={form.prod_code ?? ""}
                          disabled={editMode}
                          onChange={(e) => setField("prod_code", e.target.value)}
                        />
                      </Field>
                      <Field label="Product Name" required className="md:col-span-2">
                        <Input 
                          value={form.prod_name ?? ""} 
                          onChange={(e) => setField("prod_name", e.target.value)} 
                        />
                      </Field>
                      <Field label="Model #">
                        <Input 
                          value={form.model_number ?? ""} 
                          onChange={(e) => setField("model_number", e.target.value)} 
                        />
                      </Field>
                      <Field label="Variant / Season">
                        <Input 
                          value={form.season_code ?? form.variant_code ?? ""} 
                          onChange={(e) => setField("season_code", e.target.value)} 
                        />
                      </Field>
                    </div>
                  </SectionPanel>
                </>
              )}

              {/* ══ STEP 1 — UOM & Volume ══ */}
              {step === 1 && (
                <>
                  <SectionPanel title="Unit of Measure" icon={Box}>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="No. of UOMs">
                        <Input disabled value={form.uom_count ?? 0} />
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
                        />
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Dimensions & Weight" icon={Ruler}>
                    <div className="grid gap-3 md:grid-cols-4">
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
                  <SectionPanel title="Manufacture Details" icon={Building2}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Manufacturer Code">
                        <Input 
                          value={form.manu_code ?? ""} 
                          onChange={(e) => setField("manu_code", e.target.value)} 
                        />
                      </Field>
                      <Field label="Origin Country">
                        <Input 
                          value={form.origin_country ?? ""} 
                          onChange={(e) => setField("origin_country", e.target.value)} 
                        />
                      </Field>
                      <Field label="Alternate Product">
                        <Input
                          value={form.alt_prod_code ?? ""}
                          onChange={(e) => setField("alt_prod_code", e.target.value)}
                        />
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Pricing & Reorder" icon={ShieldCheck}>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Cost Rate Unit">
                        <Input
                          type="number"
                          value={form.cost_rate ?? 0}
                          onChange={(e) => setField("cost_rate", Number(e.target.value))}
                        />
                      </Field>
                      <Field label="Retail Price">
                        <Input
                          type="number"
                          value={form.retail_rate ?? 0}
                          onChange={(e) => setField("retail_rate", Number(e.target.value))}
                        />
                      </Field>
                      <Field label="Sales Rate">
                        <Input
                          type="number"
                          value={form.sales_rate ?? 0}
                          onChange={(e) => setField("sales_rate", Number(e.target.value))}
                        />
                      </Field>
                      <Field label="Reorder Qty">
                        <Input
                          type="number"
                          value={form.reorder_qty ?? 0}
                          onChange={(e) => setField("reorder_qty", Number(e.target.value))}
                        />
                      </Field>
                    </div>
                  </SectionPanel>
                  
                  <SectionPanel title="Tax Component" icon={ShieldCheck}>
                    <div className="grid gap-3 md:grid-cols-4">
                      {[1, 2, 3, 4].map((num) => (
                        <Field label={`Tax Component ${num}`} key={`tx_${num}`}>
                          <Input
                            value={form[`tx_compt_${num}`] ?? ""}
                            onChange={(e) => setField(`tx_compt_${num}`, e.target.value)}
                          />
                        </Field>
                      ))}
                    </div>
                  </SectionPanel>
                </>
              )}

              {/* ══ STEP 3 — Category & Product ══ */}
              {step === 3 && (
                <>
                  <SectionPanel title="Category & Division" icon={LayoutGrid}>
                    <div className="grid gap-3 md:grid-cols-3">
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
                        />
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Barcode & Attributes" icon={ShieldCheck}>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Barcode">
                        <Input
                          value={form.barcode ?? ""}
                          onChange={(e) => setField("barcode", e.target.value)}
                        />
                      </Field>
                      <Field label="Size Code">
                        <Input
                          value={form.size_code ?? ""}
                          onChange={(e) => setField("size_code", e.target.value)}
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
                        />
                      </Field>
                      <Field label="Product Stage">
                        <Input
                          value={form.product_stage ?? ""}
                          onChange={(e) => setField("product_stage", e.target.value)}
                        />
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Notes" icon={StickyNote}>
                    <div className="grid gap-3 md:grid-cols-1">
                      <Field label="Remarks">
                        <Input
                          value={form.remarks ?? ""}
                          onChange={(e) => setField("remarks", e.target.value)}
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
                  onClick={() => handleSubmit()}
                  className={`inline-flex items-center gap-1 rounded-md px-4 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-semibold shadow-sm transition-all ${
                    saving
                      ? "bg-primary/60 text-primary-foreground cursor-not-allowed"
                      : editMode
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
                      {editMode ? "Update" : "Submit"}
                      <Save size={11} className="ml-1" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style (buttons inside DataTable toolbar)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title only — buttons live inside the DataTable toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Products
          </h2>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Products`}
        subtitle="Product List"
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
        getRowId={(row, index) => `${String(row.prod_code ?? "")}_${index}`}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Product
            </button>
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
      />

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
    </section>
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