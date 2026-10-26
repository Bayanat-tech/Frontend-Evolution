import { Edit2, FileText, List, Plus, Save, Trash2, X, Loader2, Building2, IdCard, Ruler, Box, ShieldCheck, LayoutGrid, StickyNote } from "lucide-react";
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

/* Compact input styling — applied on every Input in the editor */
const INPUT_CLS = "!h-7 !text-[11px] !px-2 !py-0";

/* ─────────────────────────────────────────────────────────────
   SectionPanel — compact
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
      <div className="freight-panel-title flex items-center justify-start border-b bg-muted/35 px-2 py-1">
        <div className="flex min-w-0 items-center justify-start gap-1.5">
          <span className="freight-section-icon">
            <Icon size={11} />
          </span>
          <h3 className="m-0 truncate text-left text-[10.5px] font-semibold text-foreground">{title}</h3>
        </div>
      </div>
      <div className="freight-panel-body px-2 py-1.5">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — compact label
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
    <label className={`freight-field-label group flex flex-col gap-0.5 min-w-0 ${className ?? ""}`}>
      <span className="truncate text-[10px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold">*</strong>}
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
    <div className="inline-flex items-center gap-1.5 select-none h-7">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "#00378C", width: "13px", height: "13px" }}
        className="shrink-0 cursor-pointer rounded border border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00378C]/25 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {label && (
        <span
          onClick={() => !disabled && onChange(!checked)}
          className={`text-[10.5px] font-medium text-slate-700 leading-none transition-colors ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:text-slate-900"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* Reusable lookup config for the simple code/name dropdowns */
const UOM_PARAM = "PURCHASE_SALES_DD_ONLY_COMPANY_UOM";

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
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);

  // Both UOMs picked and identical → UPPP is locked to 1
  const sameUom = Boolean(form.p_uom) && Boolean(form.l_uom) && form.p_uom === form.l_uom;

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
    setError("");
    setNotice(null);
    setView("editor");
  };

  const openEdit = (row: ProductRow) => {
    setEditMode(true);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row });
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

  /* ---- UOM change: auto UPPP = 1 when both UOMs are same, derive uom_count ---- */
  const setUom = (key: "p_uom" | "l_uom", value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const wasSame = Boolean(prev.p_uom) && Boolean(prev.l_uom) && prev.p_uom === prev.l_uom;
      const isSame = Boolean(next.p_uom) && Boolean(next.l_uom) && next.p_uom === next.l_uom;

      if (isSame) next.uppp = 1;
      else if (wasSame) next.uppp = 0; // was auto-locked, unlock with clean value

      next.uom_count = next.p_uom && next.l_uom ? (isSame ? 1 : 2) : next.p_uom || next.l_uom ? 1 : 0;
      return next;
    });
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
      const data: ProductRow = editMode ? { ...(original || {}), ...form } : { ...form };
      if (sameUom) {
        data.uppp = 1;
        data.uom_count = 1;
      }
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

  /* Helper to render a compact UOM lookup (wrapped in .pd-lookup for sizing) */
  const renderUomLookup = (key: "p_uom" | "l_uom") => (
    <div className="pd-lookup w-full min-w-0">
      <LookupField
        label=""
        value={form[key] ?? ""}
        valueField="uom_code"
        displayFields={["uom_code", "uom_name"]}
        columns={[
          { field: "uom_code", header: "Code" },
          { field: "uom_name", header: "Name" },
        ]}
        loadOptions={async () => {
          return (
            (await getDynamicLookup({
              parameter: UOM_PARAM,
              loginid: loginId,
              code1: companyCode,
            })) || []
          );
        }}
        onChange={(value) => setUom(key, value)}
        compact
      />
    </div>
  );

  /* Helper to render a compact code/name lookup (wrapped in .pd-lookup for sizing) */
  const renderLookup = (
    key: string,
    parameter: string,
    codeField: string,
    nameField: string,
    codeHeader = "Code",
    nameHeader = "Name",
  ) => (
    <div className="pd-lookup w-full min-w-0">
      <LookupField
        label=""
        value={form[key] ?? ""}
        valueField={codeField}
        displayFields={[codeField, nameField]}
        columns={[
          { field: codeField, header: codeHeader },
          { field: nameField, header: nameHeader },
        ]}
        loadOptions={async () => {
          return (
            (await getDynamicLookup({
              parameter,
              loginid: loginId,
              code1: companyCode,
            })) || []
          );
        }}
        onChange={(value) => setField(key, value)}
        compact
      />
    </div>
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — single compact view, no tabs, no scroll
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-1.5">
        {/* Header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1 shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={13} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-base font-semibold leading-tight text-foreground">
                {editMode ? "Edit Product" : "New Product"}
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] leading-tight font-medium text-amber-700">
                {editMode ? "Editing" : "Draft"}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] leading-tight font-medium text-[#00378C]">
                Product Code:
                <strong className="font-semibold">
                  {editMode && form.prod_code ? String(form.prod_code) : "Auto-generated"}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor}>
              <List size={13} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={13} /> Close
            </Button>
            <Button type="button" size="sm" onClick={() => handleSubmit()} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Form body — everything visible at once */}
        <div className="pd-compact grid gap-1.5">
          <style>{`
            .pd-compact .freight-panel-title { justify-content: flex-start !important; padding: 3px 8px !important; min-height: 0 !important; }
            .pd-compact .freight-panel-title > div { display: flex !important; align-items: center !important; justify-content: flex-start !important; gap: 6px !important; }
            .pd-compact .freight-section-icon { width: 18px !important; height: 18px !important; min-width: 18px !important; border-radius: 4px !important; display: inline-grid !important; place-items: center !important; }
            .pd-compact .freight-section-icon svg { width: 11px !important; height: 11px !important; }
            .pd-compact .freight-panel-title h3 { font-size: 10.5px !important; text-align: left !important; margin: 0 !important; }
            .pd-compact .freight-panel-body { padding: 5px 8px 6px !important; }
            .pd-compact .freight-field-label { gap: 2px !important; }
            .pd-compact .freight-field-label > span { font-size: 9.5px !important; line-height: 1.1 !important; font-weight: 500 !important; letter-spacing: 0.02em !important; opacity: 0.85; }
            .pd-compact input:not([type="checkbox"]),
            .pd-compact select,
            .pd-compact button { height: 24px !important; min-height: 24px !important; font-size: 11px !important; padding-top: 0 !important; padding-bottom: 0 !important; padding-left: 7px !important; border-radius: 4px !important; }
            .pd-compact button svg { width: 12px !important; height: 12px !important; }

            /* Lookup (dropdown) fields — LookupField's trigger is a div.lookup-field-trigger (h-7 = 28px).
               Shrink it to 24px to match the inputs, and keep its inner buttons (text / clear / chevron) intact. */
            .pd-compact .lookup-field-trigger { height: 24px !important; min-height: 24px !important; max-height: 24px !important; border-radius: 4px !important; }
            .pd-compact .lookup-field-trigger > button { height: 100% !important; min-height: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; border-radius: 0 !important; }
            .pd-compact .lookup-field-trigger > button:first-of-type { padding-left: 7px !important; }
            .pd-compact .lookup-field-trigger > button:not(:first-of-type) { width: 18px !important; padding-left: 0 !important; padding-right: 0 !important; }
            .pd-compact .lookup-field-trigger svg { width: 11px !important; height: 11px !important; }
          `}</style>
          {/* 1. Identification */}
          <SectionPanel title="Identification" icon={IdCard}>
            <div className="grid gap-x-2 gap-y-1.5 grid-cols-2 md:grid-cols-6">
              <Field label="Product Name" required className="col-span-2">
                <Input
                  className={INPUT_CLS}
                  value={form.prod_name ?? ""}
                  onChange={(e) => setField("prod_name", e.target.value)}
                />
              </Field>
              <Field label="Model #">
                <Input
                  className={INPUT_CLS}
                  value={form.model_number ?? ""}
                  onChange={(e) => setField("model_number", e.target.value)}
                />
              </Field>
              <Field label="Variant / Season">
                <Input
                  className={INPUT_CLS}
                  value={form.season_code ?? form.variant_code ?? ""}
                  onChange={(e) => setField("season_code", e.target.value)}
                />
              </Field>
              <Field label="Barcode">
                <Input
                  className={INPUT_CLS}
                  value={form.barcode ?? ""}
                  onChange={(e) => setField("barcode", e.target.value)}
                />
              </Field>
              <Field label="Size Code">
                <Input
                  className={INPUT_CLS}
                  value={form.size_code ?? ""}
                  onChange={(e) => setField("size_code", e.target.value)}
                />
              </Field>
            </div>
          </SectionPanel>

                    <SectionPanel title="Unit of Measure & Manufacture" icon={Box}>
            <div className="grid gap-x-2 gap-y-1.5 grid-cols-2 md:grid-cols-6">
              <Field label="Primary UOM" required>
                {renderUomLookup("p_uom")}
              </Field>
              <Field label="Lower UOM" required>
                {renderUomLookup("l_uom")}
              </Field>
              <Field label="UPPP" required>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  disabled={sameUom}
                  value={sameUom ? 1 : form.uppp ?? 0}
                  onChange={(e) => setField("uppp", Number(e.target.value))}
                />
              </Field>
              <Field label="Manufacturer Code">
                <Input
                  className={INPUT_CLS}
                  value={form.manu_code ?? ""}
                  onChange={(e) => setField("manu_code", e.target.value)}
                />
              </Field>
              <Field label="Origin Country">
                <Input
                  className={INPUT_CLS}
                  value={form.origin_country ?? ""}
                  onChange={(e) => setField("origin_country", e.target.value)}
                />
              </Field>
              <Field label="Alternate Product">
                <Input
                  className={INPUT_CLS}
                  value={form.alt_prod_code ?? ""}
                  onChange={(e) => setField("alt_prod_code", e.target.value)}
                />
              </Field>
            </div>
          </SectionPanel>

          {/* 2. Classification */}
          <SectionPanel title="Classification" icon={LayoutGrid}>
            <div className="grid gap-x-2 gap-y-1.5 grid-cols-2 md:grid-cols-6">
              <Field label="Group Code" required>
                {renderLookup("group_code", "PURCHASE_SALES_DD_ONLY_COMPANY_GROUP", "group_code", "group_name", "Group Code", "Group Name")}
              </Field>
              <Field label="Brand Code" required>
                {renderLookup("brand_code", "PURCHASE_SALES_DD_ONLY_COMPANY_BRAND", "brand_code", "brand_name", "Brand Code", "Brand Name")}
              </Field>
              <Field label="Category Code">
                {renderLookup("category_code", "PURCHASE_SALES_DD_ONLY_COMPANY_CATEGORY", "category_code", "category_name")}
              </Field>
              <Field label="Product Type Code">
                {renderLookup("prodtype_code", "PURCHASE_SALES_DD_ONLY_COMPANY_PRODTYPE", "prodtype_code", "prodtype_name")}
              </Field>
              <Field label="Division Code">
                {renderLookup("div_code", "PURCHASE_SALES_DD_ONLY_COMPANY_HR_DIVISION", "div_code", "div_name")}
              </Field>
              <Field label="Color Code">
                <Input
                  className={INPUT_CLS}
                  value={form.color_code ?? ""}
                  onChange={(e) => setField("color_code", e.target.value)}
                />
              </Field>
            </div>
          </SectionPanel>

          {/* 3. UOM + Manufacture */}


          {/* 4. Dimensions & Weight — ONE LINE */}
          <SectionPanel title="Dimensions & Weight" icon={Ruler}>
            <div className="grid gap-x-2 gap-y-1.5 grid-cols-3 md:grid-cols-6">
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
                    className={INPUT_CLS}
                    type="number"
                    value={form[key] ?? 0}
                    onChange={(e) => setField(key, Number(e.target.value))}
                  />
                </Field>
              ))}
            </div>
          </SectionPanel>

          {/* 5. Pricing & Tax */}
          <SectionPanel title="Pricing, Reorder & Tax" icon={ShieldCheck}>
            <div className="grid gap-x-2 gap-y-1.5 grid-cols-4 md:grid-cols-8">
              <Field label="Cost Rate Unit">
                <Input
                  className={INPUT_CLS}
                  type="number"
                  value={form.cost_rate ?? 0}
                  onChange={(e) => setField("cost_rate", Number(e.target.value))}
                />
              </Field>
              <Field label="Retail Price">
                <Input
                  className={INPUT_CLS}
                  type="number"
                  value={form.retail_rate ?? 0}
                  onChange={(e) => setField("retail_rate", Number(e.target.value))}
                />
              </Field>
              <Field label="Sales Rate">
                <Input
                  className={INPUT_CLS}
                  type="number"
                  value={form.sales_rate ?? 0}
                  onChange={(e) => setField("sales_rate", Number(e.target.value))}
                />
              </Field>
              <Field label="Reorder Qty">
                <Input
                  className={INPUT_CLS}
                  type="number"
                  value={form.reorder_qty ?? 0}
                  onChange={(e) => setField("reorder_qty", Number(e.target.value))}
                />
              </Field>
              {[1, 2, 3, 4].map((num) => (
                <Field label={`Tax Comp ${num}`} key={`tx_${num}`}>
                  <Input
                    className={INPUT_CLS}
                    value={form[`tx_compt_${num}`] ?? ""}
                    onChange={(e) => setField(`tx_compt_${num}`, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </SectionPanel>

          {/* 6. Other / Notes */}
          <SectionPanel title="Attributes & Notes" icon={StickyNote}>
            <div className="grid gap-x-2 gap-y-1.5 grid-cols-2 md:grid-cols-6">
              <Field label="Active">
                <CheckboxField
                  checked={form.active === "Y" || form.active === true}
                  onChange={(v) => setField("active", v ? "Y" : "N")}
                  label="Yes/No"
                />
              </Field>
              <Field label="Co Packing">
                <Input
                  className={INPUT_CLS}
                  value={form.co_packing ?? ""}
                  onChange={(e) => setField("co_packing", e.target.value)}
                />
              </Field>
              <Field label="Product Stage">
                <Input
                  className={INPUT_CLS}
                  value={form.product_stage ?? ""}
                  onChange={(e) => setField("product_stage", e.target.value)}
                />
              </Field>
              <Field label="Remarks" className="col-span-2 md:col-span-3">
                <Input
                  className={INPUT_CLS}
                  value={form.remarks ?? ""}
                  onChange={(e) => setField("remarks", e.target.value)}
                />
              </Field>
            </div>
          </SectionPanel>
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
    val1s2: toStr(form.prod_code), // empty on create → backend auto-generates
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