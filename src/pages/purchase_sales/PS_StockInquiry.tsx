import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { getDynamicLookupaccount } from "../../api/lookups";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

// ─── Field set — mirrors the old dw_erp_stockinquiry DataWindow filter bar,
// trimmed down to only the slots the retrieve proc (PROC_BUILD_DYNAMIC_SQL_
// PURCHASE_SALE, STOCK_INQUIRY_* branches) actually reads:
//   P_CODE2  -> prod_code
//   P_CODE4  -> div_code
//   P_CODE6  -> group_code
//   P_CODE7  -> category_code
//   P_CODE8  -> brand_code
//   P_CODE9  -> prodtype_code
//   P_CODE10 -> manu_code
// Origin Country has NO branch anywhere in the proc — that param is never
// referenced in the WHERE clause, so that filter input was removed rather
// than shipping a control that silently does nothing. Barcode and Model
// Number are kept per request (as P_CODE3 and P_CODE5 respectively), but
// note the proc as pasted has no WHERE predicate on either slot yet — both
// will be received and ignored server-side until matching WHEN clauses /
// WHERE conditions are added there. Re-add Origin Country here too once the
// proc grows a matching predicate. Division WAS wired in the UI before but
// was never sent (code4 was hard-coded to "NULL") — that's fixed here since
// div_code is a real predicate on every branch. ──────────────────────────
type TStockInquiryFilters = {
  product_code: string;
  barcode: string;
  model_number: string;
  group_code: string;
  category_code: string;
  brand_code: string;
  product_type: string;
  manufacturer: string;
  division: string;
  refresh_product_list: boolean;
};

const EMPTY_FILTERS: TStockInquiryFilters = {
  product_code: "",
  barcode: "",
  model_number: "",
  group_code: "",
  category_code: "",
  brand_code: "",
  product_type: "",
  manufacturer: "",
  division: "",
  refresh_product_list: false,
};

// ─── Row shapes — one per tab/grid, field names copied verbatim from the
// SELECT list of each STOCK_INQUIRY_* branch in the proc. ─────────────────

// TAB1 — Stock Summary (STOCK_INQUIRY_STOCK_SUMMARY)
// Note: manu_code/manu_name are in the proc's GROUP BY but NOT in its
// SELECT list, so they're intentionally absent here too — the proc simply
// doesn't return manufacturer on this branch.
type TStockSummaryRow = {
  company_code: string;
  div_code: string;
  prod_code: string;
  prod_name: string;
  qty_stock: number;
  qty_picked: number;
  qty_avl: number;
  l_uom: string;
  wt_avg_price: number;
  group_code: string;
  group_name: string;
  brand_code: string;
  brand_name: string;
  category_code: string;
  category_name: string;
  prodtype_code: string;
  prodtype_name: string;
  unit_price: number;
  sell_price: number;
  is_inventory: string;
  is_active: string;
  [key: string]: unknown;
};

// TAB2 — Stock by Zone (STOCK_INQUIRY_STOCK_BY_ZONE)
type TStockByZoneRow = {
  company_code: string;
  div_code: string;
  prod_code: string;
  prod_name: string;
  qty_stock: number;
  qty_picked: number;
  qty_avl: number;
  l_uom: string;
  wt_avg_price: number;
  group_code: string;
  group_name: string;
  brand_code: string;
  brand_name: string;
  category_code: string;
  category_name: string;
  prodtype_code: string;
  prodtype_name: string;
  zone_code: string;
  [key: string]: unknown;
};

// TAB3 — Stock Detail (STOCK_INQUIRY_STOCK_DETAIL)
type TStockDetailRow = {
  company_code: string;
  div_code: string;
  dept_code: string;
  doc_type: string;
  doc_no: string;
  doc_serial_no: string;
  doc_date: string;
  prod_code: string;
  prod_name: string;
  qty_stock: number;
  qty_picked: number;
  qty_avl: number;
  wt_avg_price: number;
  unit_price: number;
  disc_code?: string;
  curr_code?: string;
  ex_rate?: number;
  lot_no?: string;
  mfg_date?: string;
  expiry_date?: string;
  tx_identity_number?: string;
  group_code: string;
  group_name: string;
  brand_code: string;
  brand_name: string;
  category_code: string;
  category_name: string;
  prodtype_code: string;
  prodtype_name: string;
  manu_code?: string;
  manu_name?: string;
  p_uom?: string;
  l_uom: string;
  uppp?: number;
  volume?: number;
  gross_wt?: number;
  [key: string]: unknown;
};

// TAB4 — Product Info (STOCK_INQUIRY_PRODUCT_INFO)
type TProductInfoRow = {
  prod_code: string;
  prod_name: string;
  group_code: string;
  group_name: string;
  brand_code: string;
  brand_name: string;
  category_code: string;
  category_name: string;
  prodtype_code: string;
  prodtype_name: string;
  manu_code: string;
  manu_name: string;
  wt_avg_cost: number;
  vis_ind?: string;
  [key: string]: unknown;
};

// ─── LookupField configs — one per dropdown filter still backed by a real
// param. Origin Country lookup removed (see note above). ──────────────────

const PRODUCT_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_PRODCODE";
const PRODUCT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "prod_code", header: "Product Code" },
  { field: "prod_name", header: "Product Name" },
];

// Backed by MS_PROD_BARCODE (PROD_CODE, BARCODE), scoped by COMPANY_CODE.
const BARCODE_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_BARCODE";
const BARCODE_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "barcode", header: "Barcode" },
  { field: "prod_code", header: "Product Code" },
];

const GROUP_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_PRODGROUP";
const GROUP_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "group_code", header: "Group Code" },
  { field: "group_name", header: "Group Name" },
];

const CATEGORY_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_PRODCATEGORY";
const CATEGORY_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "category_code", header: "Category Code" },
  { field: "category_name", header: "Category Name" },
];

const BRAND_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_PRODBRAND";
const BRAND_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "brand_code", header: "Brand Code" },
  { field: "brand_name", header: "Brand Name" },
];

const PRODUCT_TYPE_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_PRODTYPE";
const PRODUCT_TYPE_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "prodtype_code", header: "Type Code" },
  { field: "prodtype_name", header: "Type Name" },
];

const MANUFACTURER_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_MANUFACTURER";
const MANUFACTURER_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "manu_code", header: "Manufacturer Code" },
  { field: "manu_name", header: "Manufacturer Name" },
];

const DIVISION_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_DIVISION";
const DIVISION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "div_code", header: "Division Code" },
  { field: "div_name", header: "Division Name" },
];

type TabKey = "stock_summary" | "stock_by_zone" | "stock_detail" | "product_info";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stock_summary", label: "Stock Summary" },
  { key: "stock_by_zone", label: "Stock by Zone" },
  { key: "stock_detail", label: "Stock Detail" },
  { key: "product_info", label: "Product Info." },
];

const RETRIEVE_PARAMETER: Record<TabKey, string> = {
  stock_summary: "PURCHASE_SALE_STOCK_INQUIRY_STOCK_SUMMARY",
  stock_by_zone: "PURCHASE_SALE_STOCK_INQUIRY_STOCK_BY_ZONE",
  stock_detail: "PURCHASE_SALE_STOCK_INQUIRY_STOCK_DETAIL",
  product_info: "PURCHASE_SALE_STOCK_INQUIRY_PRODUCT_INFO",
};

export function StockInquiryPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [filters, setFilters] = useState<TStockInquiryFilters>({ ...EMPTY_FILTERS });
  const [activeTab, setActiveTab] = useState<TabKey>("product_info");

  const [stockSummaryRows, setStockSummaryRows] = useState<TStockSummaryRow[]>([]);
  const [stockByZoneRows, setStockByZoneRows] = useState<TStockByZoneRow[]>([]);
  const [stockDetailRows, setStockDetailRows] = useState<TStockDetailRow[]>([]);
  const [productInfoRows, setProductInfoRows] = useState<TProductInfoRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const set = (field: keyof TStockInquiryFilters, value: unknown) =>
    setFilters((prev) => ({ ...prev, [field]: value }));

  // ── Dropdown lookups — every LookupField shares this loader, each passing
  // its own proc parameter. LookupField loads the full list once (cached
  // internally) and handles its own search/paging/popover UI. ─────────────
  const loadLookupRows = useCallback(
    async (parameter: string): Promise<LookupRow[]> => {
      if (!companyCode) return [];
      const response = await getDynamicLookupaccount({
        parameter,
        loginid,
        code1: companyCode,
        code2: "NULL",
        code3: "NULL",
        code4: "NULL",
        code5: "NULL",
        code6: "NULL",
        code7: "NULL",
        code8: "NULL",
        code9: "NULL",
        code10: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      return Array.isArray(response) ? (response as LookupRow[]) : [];
    },
    [loginid, companyCode],
  );

  // ── Retrieve — slot mapping matches what each STOCK_INQUIRY_* branch
  // reads out of P_CODE1..P_CODE10 (see comment block up top). code3
  // (Barcode) and code5 (Model Number) have no WHERE predicate in the
  // proc yet, so they currently have no filtering effect server-side —
  // they're still sent in case/when those predicates get added. ─────────
  const handleRetrieve = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await getDynamicLookupaccount({
        parameter: RETRIEVE_PARAMETER[activeTab],
        loginid,
        code1: companyCode,
        code2: filters.product_code || "NULL",
        code3: filters.barcode || "NULL",
        code4: filters.division || "NULL",
        code5: filters.model_number || "NULL",
        code6: filters.group_code || "NULL",
        code7: filters.category_code || "NULL",
        code8: filters.brand_code || "NULL",
        code9: filters.product_type || "NULL",
        code10: filters.manufacturer || "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      const list = Array.isArray(response) ? response : [];

      switch (activeTab) {
        case "stock_summary":
          setStockSummaryRows(list as TStockSummaryRow[]);
          break;
        case "stock_by_zone":
          setStockByZoneRows(list as TStockByZoneRow[]);
          break;
        case "stock_detail":
          setStockDetailRows(list as TStockDetailRow[]);
          break;
        case "product_info":
          setProductInfoRows(list as TProductInfoRow[]);
          break;
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load stock inquiry data",
      });
      switch (activeTab) {
        case "stock_summary":
          setStockSummaryRows([]);
          break;
        case "stock_by_zone":
          setStockByZoneRows([]);
          break;
        case "stock_detail":
          setStockDetailRows([]);
          break;
        case "product_info":
          setProductInfoRows([]);
          break;
      }
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode, filters, activeTab]);

  // TAB1 — Stock Summary columns
  const stockSummaryColumns: ColumnDef<TStockSummaryRow>[] = [
    { accessorKey: "prod_code", header: "Product Code", size: 130 },
    { accessorKey: "prod_name", header: "Product Name", size: 220 },
    { accessorKey: "div_code", header: "Division", size: 90 },
    { accessorKey: "qty_stock", header: "Stock Qty", size: 100 },
    { accessorKey: "qty_picked", header: "Picked Qty", size: 100 },
    { accessorKey: "qty_avl", header: "Available Qty", size: 110 },
    { accessorKey: "l_uom", header: "UoM", size: 80 },
    { accessorKey: "wt_avg_price", header: "Wt. Avg Price", size: 110 },
    { accessorKey: "unit_price", header: "Unit Price", size: 100 },
    { accessorKey: "sell_price", header: "Sell Price", size: 100 },
    { accessorKey: "group_code", header: "Group", size: 100 },
    { accessorKey: "brand_code", header: "Brand", size: 100 },
    { accessorKey: "category_code", header: "Category", size: 100 },
    { accessorKey: "prodtype_code", header: "Product Type", size: 110 },
    { accessorKey: "is_inventory", header: "Is Inventory", size: 100 },
    { accessorKey: "is_active", header: "Is Active", size: 90 },
  ];

  // TAB2 — Stock by Zone columns
  const stockByZoneColumns: ColumnDef<TStockByZoneRow>[] = [
    { accessorKey: "prod_code", header: "Product Code", size: 130 },
    { accessorKey: "prod_name", header: "Product Name", size: 220 },
    { accessorKey: "div_code", header: "Division", size: 90 },
    { accessorKey: "zone_code", header: "Zone Code", size: 100 },
    { accessorKey: "qty_stock", header: "Stock Qty", size: 100 },
    { accessorKey: "qty_picked", header: "Picked Qty", size: 100 },
    { accessorKey: "qty_avl", header: "Available Qty", size: 110 },
    { accessorKey: "l_uom", header: "UoM", size: 80 },
    { accessorKey: "wt_avg_price", header: "Wt. Avg Price", size: 110 },
    { accessorKey: "group_code", header: "Group", size: 100 },
    { accessorKey: "brand_code", header: "Brand", size: 100 },
    { accessorKey: "category_code", header: "Category", size: 100 },
    { accessorKey: "prodtype_code", header: "Product Type", size: 110 },
  ];

  // TAB3 — Stock Detail columns
  const stockDetailColumns: ColumnDef<TStockDetailRow>[] = [
    { accessorKey: "doc_date", header: "Doc Date", size: 110 },
    { accessorKey: "doc_type", header: "Doc Type", size: 90 },
    { accessorKey: "doc_no", header: "Doc No", size: 120 },
    { accessorKey: "doc_serial_no", header: "Doc Serial No", size: 110 },
    { accessorKey: "prod_code", header: "Product Code", size: 120 },
    { accessorKey: "prod_name", header: "Product Name", size: 200 },
    { accessorKey: "div_code", header: "Division", size: 90 },
    { accessorKey: "dept_code", header: "Department", size: 100 },
    { accessorKey: "qty_stock", header: "Stock Qty", size: 100 },
    { accessorKey: "qty_picked", header: "Picked Qty", size: 100 },
    { accessorKey: "qty_avl", header: "Available Qty", size: 110 },
    { accessorKey: "l_uom", header: "UoM", size: 70 },
    { accessorKey: "wt_avg_price", header: "Wt. Avg Price", size: 110 },
    { accessorKey: "unit_price", header: "Unit Price", size: 100 },
    { accessorKey: "disc_code", header: "Discount", size: 90 },
    { accessorKey: "curr_code", header: "Currency", size: 90 },
    { accessorKey: "ex_rate", header: "Ex. Rate", size: 90 },
    { accessorKey: "lot_no", header: "Lot No", size: 100 },
    { accessorKey: "mfg_date", header: "Mfg Date", size: 110 },
    { accessorKey: "expiry_date", header: "Expiry Date", size: 110 },
    { accessorKey: "group_code", header: "Group", size: 100 },
    { accessorKey: "brand_code", header: "Brand", size: 100 },
    { accessorKey: "category_code", header: "Category", size: 100 },
    { accessorKey: "prodtype_code", header: "Product Type", size: 110 },
    { accessorKey: "manu_code", header: "Manufacturer", size: 130 },
    { accessorKey: "p_uom", header: "Purch. UoM", size: 100 },
    { accessorKey: "uppp", header: "Units/Pack", size: 100 },
    { accessorKey: "volume", header: "Volume", size: 90 },
    { accessorKey: "gross_wt", header: "Gross Wt", size: 90 },
    { accessorKey: "tx_identity_number", header: "Tx Identity No.", size: 130 },
  ];

  // TAB4 — Product Info columns
  const productInfoColumns: ColumnDef<TProductInfoRow>[] = [
    { accessorKey: "prod_code", header: "Product Code", size: 140 },
    { accessorKey: "prod_name", header: "Product Name", size: 240 },
    { accessorKey: "group_code", header: "Group", size: 110 },
    { accessorKey: "brand_code", header: "Brand", size: 110 },
    { accessorKey: "category_code", header: "Category", size: 110 },
    { accessorKey: "prodtype_code", header: "Product Type", size: 120 },
    { accessorKey: "manu_code", header: "Manufacturer", size: 130 },
    { accessorKey: "wt_avg_cost", header: "Wt. Avg Cost", size: 110 },
  ];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Stock Inquiry</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Search product and stock information.
          </p>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      {/* Origin Country was removed — the retrieve proc never reads that
          slot. Barcode (P_CODE3) and Model Number (P_CODE5) are kept per
          request even though the proc doesn't filter on either yet. */}
      <div className="rounded-md border bg-card p-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2" key="product_code">
            <span className="w-24 shrink-0 text-sm text-primary font-medium">Product Code:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.product_code}
                columns={PRODUCT_LOOKUP_COLUMNS}
                valueField="prod_code"
                displayFields={["display_name"]}
                loadOptions={() => loadLookupRows(PRODUCT_LOOKUP_PARAMETER)}
                onChange={(value) => set("product_code", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="barcode">
            <span className="w-24 shrink-0 text-sm">Barcode:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.barcode}
                columns={BARCODE_LOOKUP_COLUMNS}
                valueField="barcode"
                displayFields={["barcode", "prod_code"]}
                loadOptions={() => loadLookupRows(BARCODE_LOOKUP_PARAMETER)}
                onChange={(value) => set("barcode", value)}
                placeholder="Barcode"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="model_number">
            <span className="w-24 shrink-0 text-sm">Model Number:</span>
            <div className="min-w-0 flex-1">
              <Input
                className="h-7 text-sm px-2"
                value={filters.model_number}
                onChange={(e) => set("model_number", e.target.value)}
                placeholder="Model number"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="group_code">
            <span className="w-24 shrink-0 text-sm">Group Code:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.group_code}
                columns={GROUP_LOOKUP_COLUMNS}
                valueField="group_code"
                displayFields={["group_code", "group_name"]}
                loadOptions={() => loadLookupRows(GROUP_LOOKUP_PARAMETER)}
                onChange={(value) => set("group_code", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="category_code">
            <span className="w-24 shrink-0 text-sm">Category Code:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.category_code}
                columns={CATEGORY_LOOKUP_COLUMNS}
                valueField="category_code"
                displayFields={["category_code", "category_name"]}
                loadOptions={() => loadLookupRows(CATEGORY_LOOKUP_PARAMETER)}
                onChange={(value) => set("category_code", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="brand_code">
            <span className="w-24 shrink-0 text-sm">Brand Code:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.brand_code}
                columns={BRAND_LOOKUP_COLUMNS}
                valueField="brand_code"
                displayFields={["brand_code", "brand_name"]}
                loadOptions={() => loadLookupRows(BRAND_LOOKUP_PARAMETER)}
                onChange={(value) => set("brand_code", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="product_type">
            <span className="w-24 shrink-0 text-sm">Product Type:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.product_type}
                columns={PRODUCT_TYPE_LOOKUP_COLUMNS}
                valueField="prodtype_code"
                displayFields={["prodtype_code", "prodtype_name"]}
                loadOptions={() => loadLookupRows(PRODUCT_TYPE_LOOKUP_PARAMETER)}
                onChange={(value) => set("product_type", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="manufacturer">
            <span className="w-24 shrink-0 text-sm">Manufacturer:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.manufacturer}
                columns={MANUFACTURER_LOOKUP_COLUMNS}
                valueField="manu_code"
                displayFields={["manu_code", "manu_name"]}
                loadOptions={() => loadLookupRows(MANUFACTURER_LOOKUP_PARAMETER)}
                onChange={(value) => set("manufacturer", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="division">
            <span className="w-24 shrink-0 text-sm">Division:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.division}
                columns={DIVISION_LOOKUP_COLUMNS}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={() => loadLookupRows(DIVISION_LOOKUP_PARAMETER)}
                onChange={(value) => set("division", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-sm text-primary" key="refresh_product_list">
            <input
              type="checkbox"
              checked={filters.refresh_product_list}
              onChange={(e) => set("refresh_product_list", e.target.checked)}
            />
            Refresh Product List
          </label>
        </div>

        <div className="mt-2 flex justify-end border-t pt-2">
          <Button size="sm" disabled={loading} onClick={handleRetrieve}>
            <RefreshCw size={13} /> {loading ? "Retrieving..." : "Retrieve"}
          </Button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      {activeTab === "stock_summary" && (
        <DataTable
          columns={stockSummaryColumns}
          data={stockSummaryRows}
          title={`${stockSummaryRows.length.toLocaleString()} Records`}
          subtitle="Stock Summary"
          searchPlaceholder="Search code, name..."
          loading={loading}
          height={480}
          minWidth={1300}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row, index) => `${row.prod_code ?? ""}-${row.div_code ?? ""}-${index}`}
        />
      )}

      {activeTab === "stock_by_zone" && (
        <DataTable
          columns={stockByZoneColumns}
          data={stockByZoneRows}
          title={`${stockByZoneRows.length.toLocaleString()} Records`}
          subtitle="Stock by Zone"
          searchPlaceholder="Search code, name..."
          loading={loading}
          height={480}
          minWidth={1000}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row, index) => `${row.prod_code ?? ""}-${row.zone_code ?? ""}-${index}`}
        />
      )}

      {activeTab === "stock_detail" && (
        <DataTable
          columns={stockDetailColumns}
          data={stockDetailRows}
          title={`${stockDetailRows.length.toLocaleString()} Records`}
          subtitle="Stock Detail"
          searchPlaceholder="Search code, name, doc no..."
          loading={loading}
          height={480}
          minWidth={1700}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row, index) => `${row.prod_code ?? ""}-${row.doc_no ?? ""}-${index}`}
        />
      )}

      {activeTab === "product_info" && (
        <DataTable
          columns={productInfoColumns}
          data={productInfoRows}
          title={`${productInfoRows.length.toLocaleString()} Records`}
          subtitle="Product Info"
          searchPlaceholder="Search code, name..."
          loading={loading}
          height={480}
          minWidth={1000}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row) => String(row.prod_code ?? "")}
        />
      )}
    </section>
  );
}