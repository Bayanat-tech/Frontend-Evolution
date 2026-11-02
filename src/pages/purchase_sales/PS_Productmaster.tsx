import { Edit2, FileText, List, Plus, Save, Trash2, X, Loader2, IdCard, Ruler, Box, ShieldCheck, LayoutGrid, StickyNote, Wallet } from "lucide-react";
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
import type { ReactNode } from "react";

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

/* Input sizing — same as Employee Master */
const CTL = "h-7 text-xs";

/* ─────────────── UI building blocks (Employee Master style) ─────────────── */

function HeaderBlock({
  label,
  icon,
  children,
  gridCols = "grid-cols-2",
  bodyClass,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  gridCols?: string;
  bodyClass?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-md border border-[#cbd5e1] bg-card ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] bg-slate-50 px-2.5 py-1">
        <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
          {icon}
        </span>
        <span className="text-xs font-bold text-[#00378C]">{label}</span>
      </div>
      <div
        className={
          bodyClass ?? `grid gap-x-2 gap-y-1.5 px-2.5 py-2 ${gridCols} max-md:grid-cols-1`
        }
      >
        {children}
      </div>
    </div>
  );
}

function CField({
  label,
  required,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="text-[10px] text-destructive">{error}</span>}
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

  /* Helper to render a compact UOM lookup */
  const renderUomLookup = (key: "p_uom" | "l_uom") => (
    <div className="w-full min-w-0">
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

  /* Helper to render a compact code/name lookup */
  const renderLookup = (
    key: string,
    parameter: string,
    codeField: string,
    nameField: string,
    codeHeader = "Code",
    nameHeader = "Name",
  ) => (
    <div className="w-full min-w-0">
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

  /* Helpers for plain text / number inputs */
  const textInput = (key: string) => (
    <Input
      className={CTL}
      value={form[key] ?? ""}
      onChange={(e) => setField(key, e.target.value)}
    />
  );
  const numInput = (key: string) => (
    <Input
      className={CTL}
      type="number"
      value={form[key] ?? 0}
      onChange={(e) => setField(key, Number(e.target.value))}
    />
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Employee Master style layout
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        {/* Header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                {editMode ? "Edit Product" : "New Product"}
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                {editMode ? "Editing" : "Draft"}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-[#00378C]">
                Product Code:
                <strong className="font-semibold">
                  {editMode && form.prod_code ? String(form.prod_code) : "Auto-generated"}
                </strong>
              </span>
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

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Form body */}
        <div style={{ zoom: 0.8 }} className="freight-workspace-ui freight-dense-form freight-ui-standard grid items-start gap-1.5">

          {/* ══════════ TOP HALF ══════════ */}
          <div className="grid items-start gap-1.5 xl:grid-cols-3">
            {/* Identification (spans 2 cols) */}
            <div className="xl:col-span-2">
              <HeaderBlock label="Identification" icon={<IdCard size={11} />} gridCols="grid-cols-1 sm:grid-cols-4">
                <CField label="Product Name" required className="sm:col-span-2">
                  {textInput("prod_name")}
                </CField>
                <CField label="Model #">
                  {textInput("model_number")}
                </CField>
                <CField label="Variant / Season">
                  <Input
                    className={CTL}
                    value={form.season_code ?? form.variant_code ?? ""}
                    onChange={(e) => setField("season_code", e.target.value)}
                  />
                </CField>
                <CField label="Barcode">
                  {textInput("barcode")}
                </CField>
                <CField label="Size Code">
                  {textInput("size_code")}
                </CField>
                <CField label="Color Code">
                  {textInput("color_code")}
                </CField>
                <CField label="Product Stage">
                  {textInput("product_stage")}
                </CField>
              </HeaderBlock>
            </div>

            {/* Classification (1 col) */}
            <div>
              <HeaderBlock label="Classification" icon={<LayoutGrid size={11} />} gridCols="grid-cols-2">
                <CField label="Group Code" required>
                  {renderLookup("group_code", "PURCHASE_SALES_DD_ONLY_COMPANY_GROUP", "group_code", "group_name", "Group Code", "Group Name")}
                </CField>
                <CField label="Brand Code" required>
                  {renderLookup("brand_code", "PURCHASE_SALES_DD_ONLY_COMPANY_BRAND", "brand_code", "brand_name", "Brand Code", "Brand Name")}
                </CField>
                <CField label="Category Code">
                  {renderLookup("category_code", "PURCHASE_SALES_DD_ONLY_COMPANY_CATEGORY", "category_code", "category_name")}
                </CField>
                <CField label="Product Type Code">
                  {renderLookup("prodtype_code", "PURCHASE_SALES_DD_ONLY_COMPANY_PRODTYPE", "prodtype_code", "prodtype_name")}
                </CField>
                <CField label="Division Code" className="col-span-2">
                  {renderLookup("div_code", "PURCHASE_SALES_DD_ONLY_COMPANY_HR_DIVISION", "div_code", "div_name")}
                </CField>
              </HeaderBlock>
            </div>
          </div>

          {/* ══════════ BOTTOM HALF (4 Columns) ══════════ */}
          <div className="grid gap-1.5 xl:grid-cols-4">

            {/* Column 1: UOM & Manufacture */}
            <div className="flex h-full flex-col gap-1.5">
              <HeaderBlock className="flex-1" label="Unit of Measure & Manufacture" icon={<Box size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
                <CField label="Primary UOM" required>
                  {renderUomLookup("p_uom")}
                </CField>
                <CField label="Lower UOM" required>
                  {renderUomLookup("l_uom")}
                </CField>
                <CField label="UPPP" required>
                  <Input
                    className={CTL}
                    type="number"
                    disabled={sameUom}
                    value={sameUom ? 1 : form.uppp ?? 0}
                    onChange={(e) => setField("uppp", Number(e.target.value))}
                  />
                </CField>
                <CField label="Manufacturer Code">
                  {textInput("manu_code")}
                </CField>
                <CField label="Origin Country">
                  {textInput("origin_country")}
                </CField>
                <CField label="Alternate Product">
                  {textInput("alt_prod_code")}
                </CField>
              </HeaderBlock>
            </div>

            {/* Column 2: Dimensions & Weight */}
            <div className="flex h-full flex-col gap-1.5">
              <HeaderBlock className="flex-1" label="Dimensions & Weight" icon={<Ruler size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
                {[
                  { label: "Length", key: "length" },
                  { label: "Breadth", key: "breadth" },
                  { label: "Height", key: "height" },
                  { label: "Volume", key: "volume" },
                  { label: "Gross Weight", key: "gross_wt" },
                  { label: "Net Weight", key: "net_wt" },
                ].map(({ label, key }) => (
                  <CField label={label} key={key}>
                    {numInput(key)}
                  </CField>
                ))}
              </HeaderBlock>
            </div>

            {/* Column 3: Pricing + Tax */}
            <div className="flex h-full flex-col gap-1.5">
              <HeaderBlock label="Pricing & Reorder" icon={<Wallet size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
                <CField label="Cost Rate Unit">
                  {numInput("cost_rate")}
                </CField>
                <CField label="Retail Price">
                  {numInput("retail_rate")}
                </CField>
                <CField label="Sales Rate">
                  {numInput("sales_rate")}
                </CField>
                <CField label="Reorder Qty">
                  {numInput("reorder_qty")}
                </CField>
              </HeaderBlock>

              <HeaderBlock className="flex-1" label="Tax Components" icon={<ShieldCheck size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
                {[1, 2, 3, 4].map((n) => (
                  <CField label={`Tax Comp ${n}`} key={`tx_${n}`}>
                    {textInput(`tx_compt_${n}`)}
                  </CField>
                ))}
              </HeaderBlock>
            </div>

            {/* Column 4: Attributes & Notes */}
            <div className="flex h-full flex-col gap-1.5">
              <HeaderBlock className="flex-1" label="Attributes & Notes" icon={<StickyNote size={11} />} gridCols="grid-cols-1 sm:grid-cols-2">
                <CField label="Active">
                  <CheckboxField
                    checked={form.active === "Y" || form.active === true}
                    onChange={(v) => setField("active", v ? "Y" : "N")}
                    label="Yes/No"
                  />
                </CField>
                <CField label="Co Packing">
                  {textInput("co_packing")}
                </CField>
                <CField label="Remarks" className="sm:col-span-2">
                  {textInput("remarks")}
                </CField>
              </HeaderBlock>
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