import { Edit2, FileText, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeDynamicDelete, executeDynamicMutationColumn90, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { LookupField } from "../../components/ui/LookupField";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { useAuth } from "../../state/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types & field definitions                                          */
/* ------------------------------------------------------------------ */

type ProductRow = Record<string, unknown>;

type LookupConfig = {
  parameter: string;
  valueField: string;
  nameField: string;
  valueHeader: string;
  nameHeader: string;
};

type ProductField = {
  name: string;
  label: string;
  section: string;
  type?: "text" | "number" | "textarea";
  lookup?: LookupConfig;
  required?: boolean;
  disabledOnEdit?: boolean;
  fullRow?: boolean;
};

const lookup = (
  parameter: string,
  valueField: string,
  nameField: string,
  valueHeader: string,
  nameHeader: string,
): LookupConfig => ({ parameter, valueField, nameField, valueHeader, nameHeader });

const FIELDS: ProductField[] = [
  // Product Details
  { name: "prod_code", label: "Product Code", section: "Product Details", required: true, disabledOnEdit: true },
  { name: "prod_name", label: "Product Name", section: "Product Details", required: true },
  { name: "model_number", label: "Model Number", section: "Product Details" },
  { name: "group_code", label: "Group Code", section: "Product Details", lookup: lookup("PURCHASE_SALES_DD_ONLY_COMPANY_GROUP", "group_code", "group_name", "Group Code", "Group Name") },
  { name: "brand_code", label: "Brand Code", section: "Product Details", lookup: lookup("PURCHASE_SALES_DD_ONLY_COMPANY_BRAND", "brand_code", "brand_name", "Brand Code", "Brand Name") },
  { name: "category_code", label: "Category Code", section: "Product Details", lookup: lookup("PURCHASE_SALES_DD_ONLY_COMPANY_CATEGORY", "category_code", "category_name", "Category Code", "Category Name") },
  { name: "prodtype_code", label: "Product Type Code", section: "Product Details", lookup: lookup("PURCHASE_SALES_DD_ONLY_COMPANY_PRODTYPE", "prodtype_code", "prodtype_name", "Type Code", "Type Name") },
  { name: "season_code", label: "Season Code", section: "Product Details" },

  // Barcode and QR Code
  { name: "barcode", label: "Barcode", section: "Barcode and QR Code" },
  { name: "size_code", label: "Size Code", section: "Barcode and QR Code" },
  { name: "active", label: "Active", section: "Barcode and QR Code" },
  { name: "co_packing", label: "Co Packing", section: "Barcode and QR Code" },
  { name: "product_stage", label: "Product Stage", section: "Barcode and QR Code" },

  // Unit of Measurement
  { name: "uom_count", label: "No. of UOMs", section: "Unit of Measurement", type: "number" },
  { name: "p_uom", label: "Primary UOM", section: "Unit of Measurement", lookup: lookup("PURCHASE_SALES_DD_ONLY_COMPANY_UOM", "uom_code", "uom_name", "UOM Code", "UOM Name") },
  { name: "l_uom", label: "Lower UOM", section: "Unit of Measurement", lookup: lookup("PURCHASE_SALES_DD_ONLY_COMPANY_UOM", "uom_code", "uom_name", "UOM Code", "UOM Name") },
  { name: "uppp", label: "UPPP", section: "Unit of Measurement", type: "number" },

  // Division
  { name: "div_code", label: "Division Code", section: "Division", lookup: lookup("PURCHASE_SALES_DD_ONLY_COMPANY_HR_DIVISION", "div_code", "div_name", "Division Code", "Division Name") },
  { name: "color_code", label: "Color Code", section: "Division" },

  // Dimensions
  { name: "length", label: "Length", section: "Dimensions", type: "number" },
  { name: "breadth", label: "Breadth", section: "Dimensions", type: "number" },
  { name: "height", label: "Height", section: "Dimensions", type: "number" },
  { name: "volume", label: "Volume", section: "Dimensions", type: "number" },
  { name: "net_wt", label: "Net Weight", section: "Dimensions", type: "number" },

  // Remarks
  { name: "remarks", label: "Remarks", section: "Remarks", type: "textarea", fullRow: true },

  // Additional
  { name: "manu_code", label: "Manufacturer Code", section: "Additional" },
  { name: "origin_country", label: "Origin Country", section: "Additional" },
  { name: "cost_rate", label: "Cost Rate Unit", section: "Additional", type: "number" },
  { name: "retail_rate", label: "Retail Price", section: "Additional", type: "number" },
  { name: "sales_rate", label: "Sales Rate", section: "Additional", type: "number" },
  { name: "reorder_qty", label: "Reorder Qty", section: "Additional", type: "number" },
  { name: "alt_prod_code", label: "Alternate Product", section: "Additional" },

  // Tax Component
  { name: "tx_compt_1", label: "Tax Component 1", section: "Tax Component" },
  { name: "tx_compt_2", label: "Tax Component 2", section: "Tax Component" },
  { name: "tx_compt_3", label: "Tax Component 3", section: "Tax Component" },
  { name: "tx_compt_4", label: "Tax Component 4", section: "Tax Component" },
];

const SECTIONS = Array.from(new Set(FIELDS.map((field) => field.section)));

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

const inputClass =
  "h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500";

type Notice = { type: "success" | "error"; message: string } | null;

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
    setError("");
    setNotice(null);
    setFormOpen(true);
  };

  const openEdit = (row: ProductRow) => {
    setEditMode(true);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row, active: row.active ?? row.is_active ?? "" });
    setError("");
    setNotice(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setError("");
  };

  const setField = (name: string, value: unknown) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const missing = FIELDS.find((field) => field.required && !String(form[field.name] ?? "").trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    try {
      setSaving(true);
      // On edit, keep values of columns that are not shown on this form (e.g. supplier, image path).
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
    <section className="grid gap-2 p-1">
      {/* ---------- Top Header (compact) ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00378C]/10 text-[#00378C]">
            <FileText size={14} />
          </div>
          <h1 className="m-0 truncate text-[15px] font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
        </div>

        {formOpen && (
          <div className="flex items-center gap-1.5">
            <Button
              type="submit"
              form="product-form"
              disabled={saving}
              className="h-7 gap-1 bg-[#00378C] text-white hover:bg-[#002d72] shadow-sm text-xs font-semibold px-3 rounded-md"
            >
              <Save size={13} /> {saving ? "Saving..." : editMode ? "Update" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close"
              title="Close"
              className="h-7 w-7 rounded-md"
            >
              <X size={14} />
            </Button>
          </div>
        )}
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* ---------- EDITOR ---------- */}
      {formOpen && (
        <form id="product-form" className="flex flex-col gap-2" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {SECTIONS.map((section) => (
              <div key={section} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 rounded-t-lg border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00378C]/10 text-[#00378C]">
                    <FileText size={12} />
                  </div>
                  <h3 className="m-0 text-xs font-semibold text-slate-800">{section}</h3>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    {FIELDS.filter((field) => field.section === section).map((field) => (
                      <ProductFieldInput
                        key={field.name}
                        field={field}
                        value={form[field.name]}
                        disabled={Boolean(editMode && field.disabledOnEdit)}
                        loginId={loginId}
                        companyCode={companyCode}
                        onChange={(value) => setField(field.name, value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </form>
      )}

      {/* ---------- LIST ---------- */}
      {!formOpen && (
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
    </section>
  );
};

export default ProductPurchaseSales;

/* ------------------------------------------------------------------ */
/*  Field input                                                        */
/* ------------------------------------------------------------------ */

function ProductFieldInput({
  field,
  value,
  disabled,
  loginId,
  companyCode,
  onChange,
}: {
  field: ProductField;
  value: unknown;
  disabled: boolean;
  loginId: string;
  companyCode: string;
  onChange: (value: unknown) => void;
}) {
  const labelText = `${field.label}${field.required ? " *" : ""}`;
  const wrapperClass = `flex flex-col ${field.fullRow ? "col-span-2" : ""}`;

  if (field.lookup) {
    const config = field.lookup;
    return (
      <div className={wrapperClass}>
        <LookupField
          label={labelText}
          value={String(value ?? "")}
          displayValue={String(value ?? "")}
          columns={[
            { field: config.valueField, header: config.valueHeader },
            { field: config.nameField, header: config.nameHeader },
          ]}
          valueField={config.valueField}
          displayFields={[config.valueField, config.nameField]}
          disabled={disabled}
          loadOptions={() =>
            getDynamicLookup({ parameter: config.parameter, loginid: loginId, code1: companyCode })
          }
          onChange={(next) => onChange(next)}
        />
      </div>
    );
  }

  const label = (
    <label className="mb-0.5 block text-[11px] font-medium text-slate-600 text-left">
      {field.label}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div className={wrapperClass}>
        {label}
        <textarea
          className="w-full h-[52px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00378C] focus:outline-none focus:ring-1 focus:ring-[#00378C]/30 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {label}
      <input
        type={field.type === "number" ? "number" : "text"}
        disabled={disabled}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}

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

    // keys
    val1s1: companyCode, // COMPANY_CODE
    val1s2: toStr(form.prod_code), // PROD_CODE

    // strings
    val1s3: toStr(form.prod_name), // PROD_NAME
    val1s4: toStr(form.model_number), // MODEL_NUMBER
    val1s5: toStr(form.barcode ?? form.bar_code), // BAR_CODE
    val1s6: toStr(form.group_code), // GROUP_CODE
    val1s7: toStr(form.brand_code), // BRAND_CODE
    val1s8: toStr(form.category_code), // CATEGORY_CODE
    val1s9: toStr(form.prodtype_code), // PRODTYPE_CODE
    val1s10: toStr(form.manu_code), // MANU_CODE
    val1s11: toStr(form.alt_prod_code), // ALT_PROD_CODE
    val1s12: toStr(form.p_uom), // P_UOM
    val1s13: toStr(form.l_uom), // L_UOM
    val1s14: toStr(form.origin_country), // ORIGIN_COUNTRY
    val1s15: toStr(form.co_packing ?? form.co_pack) ?? "N", // CO_PACK
    val1s16: toStr(form.product_stage), // PRODUCT_STAGE
    val1s17: toStr(form.div_code), // DIV_CODE
    val1s18: toStr(form.size_code), // SIZE_CODE
    val1s19: toStr(form.color_code), // COLOR_CODE
    val1s20: toStr(form.season_code), // SEASON_CODE
    val1s21: toStr(form.remarks), // REMARKS
    val1s22: toStr(form.is_inventory) ?? "Y", // IS_INVENTORY
    val1s23: toStr(form.active ?? form.is_active) ?? "Y", // IS_ACTIVE
    val1s24: toStr(form.active_status) ?? "Y", // ACTIVE_STATUS
    val1s25: toStr(form.supplier_code), // SUPPLIER_CODE
    val1s26: toStr(form.prod_image_path), // PROD_IMAGE_PATH
    val1s27: toStr(form.tx_compt_1) ?? "N", // TX_COMPNT_1_EXPMT
    val1s28: toStr(form.tx_compt_2) ?? "N", // TX_COMPNT_2_EXPMT
    val1s29: toStr(form.tx_compt_3) ?? "N", // TX_COMPNT_3_EXPMT
    val1s30: toStr(form.tx_compt_4) ?? "N", // TX_COMPNT_4_EXPMT

    // numbers
    val1n1: toNum(form.uom_count), // UOM_COUNT
    val1n2: toNum(form.uppp), // UPPP
    val1n3: toNum(form.length), // LENGTH
    val1n4: toNum(form.breadth), // BREADTH
    val1n5: toNum(form.height), // HEIGHT
    val1n6: toNum(form.volume), // VOLUME
    val1n7: toNum(form.gross_wt), // GROSS_WT
    val1n8: toNum(form.net_wt), // NET_WT
    val1n9: toNum(form.cost_rate), // COST_RATE
    val1n10: toNum(form.sales_rate), // SALES_RATE
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeEmpty(): ProductRow {
  return Object.fromEntries(FIELDS.map((field) => [field.name, ""]));
}

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