import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { getDynamicLookupaccount } from "../../api/lookups";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

// ─── Field set — mirrors the old dw_erp_stockinquiry DataWindow filter bar.
// Only the filter fields visible on the old screen are kept; nothing new
// invented here. The *_name companion fields from the old DataWindow are
// gone — LookupField resolves and displays the name itself once a code is
// selected, so there's no separate piece of state to keep in sync. ────────
type TStockInquiryFilters = {
  product_code: string;
  barcode: string;
  product_name: string;
  model_number: string;
  group_code: string;
  category_code: string;
  brand_code: string;
  product_type: string;
  manufacturer: string;
  division: string;
  origin_country: string;
  refresh_product_list: boolean;
};

const EMPTY_FILTERS: TStockInquiryFilters = {
  product_code: "",
  barcode: "",
  product_name: "",
  model_number: "",
  group_code: "",
  category_code: "",
  brand_code: "",
  product_type: "",
  manufacturer: "",
  division: "",
  origin_country: "",
  refresh_product_list: false,
};

// ─── Row shapes — one per tab/grid, field names follow the "TAB SCREEN"
// reference screenshots. TODO: confirm exact column names against the real
// stock inquiry proc output before wiring against production. ─────────────

// TAB1 — Stock Summary
type TStockSummaryRow = {
  product_code: string;
  product_name: string;
  stock_quantity: number;
  reserve_quantity: number;
  available_quantity: number;
  uom: string;
  unit_price: number;
  sell_price: number;
  is_inventory: string;
  is_active: string;
  [key: string]: unknown;
};

// TAB2 — Stock by Zone
type TStockByZoneRow = {
  product_code: string;
  product_name: string;
  stock_quantity: number;
  reserve_quantity: number;
  available_quantity: number;
  uom: string;
  zone_code: string;
  [key: string]: unknown;
};

// TAB3 — Stock Detail
type TStockDetailRow = {
  doc_date: string;
  product_code: string;
  product_name: string;
  stock_quantity: number;
  reserve_quantity: number;
  available_quantity: number;
  uom: string;
  lot_no?: string;
  mfg_date?: string;
  expiry_date?: string;
  product_group?: string;
  product_brand?: string;
  category?: string;
  product_type?: string;
  manufacturer?: string;
  doc_type: string;
  doc_no: string;
  [key: string]: unknown;
};

// ─── LookupField configs — one per dropdown filter. Field names for
// PRODCODE/PRODBRAND/PRODCATEGORY/PRODTYPE match the columns already
// SELECTed in PROC_BUILD_DYNAMIC_SQL_PURCHASE_SALE. GROUP/MANUFACTURER/
// DIVISION/ORIGIN_COUNTRY parameters, table names, and column names are
// PLACEHOLDERS — that proc has no branch for them yet; add the WHEN clauses
// (same simple "SELECT CODE, NAME ... WHERE COMPANY_CODE = ..." shape as
// PURCHASE_SALE_MSE_PRODBRAND) and confirm real table/column names before
// wiring this against production. ──────────────────────────────────────────

const PRODUCT_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_PRODCODE";
const PRODUCT_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "prod_code", header: "Product Code" },
  { field: "prod_name", header: "Product Name" },
];

const GROUP_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_PRODGROUP"; // TODO: not yet in proc
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

const MANUFACTURER_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_MANUFACTURER"; // TODO: not yet in proc
const MANUFACTURER_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "manufacturer_code", header: "Manufacturer Code" },
  { field: "manufacturer_name", header: "Manufacturer Name" },
];

const DIVISION_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_DIVISION"; // TODO: not yet in proc
const DIVISION_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "division_code", header: "Division Code" },
  { field: "division_name", header: "Division Name" },
];

const ORIGIN_COUNTRY_LOOKUP_PARAMETER = "PURCHASE_SALE_MSE_ORIGIN_COUNTRY"; // TODO: not yet in proc
const ORIGIN_COUNTRY_LOOKUP_COLUMNS: { field: string; header: string }[] = [
  { field: "country_code", header: "Country Code" },
  { field: "country_name", header: "Country Name" },
];

// TAB4 — Product Info
type TProductInfoRow = {
  product_code: string;
  product_name: string;
  group_code: string;
  brand_code: string;
  category_code: string;
  product_type: string;
  manufacturer?: string;
  [key: string]: unknown;
};

type TabKey = "stock_summary" | "stock_by_zone" | "stock_detail" | "product_info";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stock_summary", label: "Stock Summary" },
  { key: "stock_by_zone", label: "Stock by Zone" },
  { key: "stock_detail", label: "Stock Detail" },
  { key: "product_info", label: "Product Info." },
];

// ─── Retrieve — parameter names are PLACEHOLDERS, one per tab/grid. VERIFY
// against the real PROC_BUILD_DYNAMIC_SQL_COMMON20 (or equivalent) entries
// for stock inquiry before wiring this up against production. ─────────────
const RETRIEVE_PARAMETER: Record<TabKey, string> = {
  stock_summary: "STOCK_INQUIRY_STOCK_SUMMARY",
  stock_by_zone: "STOCK_INQUIRY_STOCK_BY_ZONE",
  stock_detail: "STOCK_INQUIRY_STOCK_DETAIL",
  product_info: "STOCK_INQUIRY_PRODUCT_INFO",
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

  // ── Retrieve — sends filter bar values through to the dynamic lookup proc
  // for whichever tab is currently active. TODO: confirm code1..code10 slot
  // mapping against the actual proc; this ordering is a best-effort
  // placeholder following the filter bar layout. ────────────────────────────
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
        code4: filters.product_name || "NULL",
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
    { accessorKey: "product_code", header: "Product Code", size: 130 },
    { accessorKey: "product_name", header: "Product Name", size: 240 },
    { accessorKey: "stock_quantity", header: "Stock Quantity", size: 120 },
    { accessorKey: "reserve_quantity", header: "Reserve Quantity", size: 130 },
    { accessorKey: "available_quantity", header: "Available Quantity", size: 140 },
    { accessorKey: "uom", header: "UoM", size: 80 },
    { accessorKey: "unit_price", header: "Unit Price", size: 100 },
    { accessorKey: "sell_price", header: "Sell Price", size: 100 },
    { accessorKey: "is_inventory", header: "Is Inventory", size: 100 },
    { accessorKey: "is_active", header: "Is Active", size: 90 },
  ];

  // TAB2 — Stock by Zone columns
  const stockByZoneColumns: ColumnDef<TStockByZoneRow>[] = [
    { accessorKey: "product_code", header: "Product Code", size: 130 },
    { accessorKey: "product_name", header: "Product Name", size: 240 },
    { accessorKey: "stock_quantity", header: "Stock Quantity", size: 120 },
    { accessorKey: "reserve_quantity", header: "Reserve Quantity", size: 130 },
    { accessorKey: "available_quantity", header: "Available Quantity", size: 140 },
    { accessorKey: "uom", header: "UoM", size: 80 },
    { accessorKey: "zone_code", header: "Zone Code", size: 100 },
  ];

  // TAB3 — Stock Detail columns
  const stockDetailColumns: ColumnDef<TStockDetailRow>[] = [
    { accessorKey: "doc_date", header: "Doc Date", size: 110 },
    { accessorKey: "product_code", header: "Product Code", size: 120 },
    { accessorKey: "product_name", header: "Product Name", size: 220 },
    { accessorKey: "stock_quantity", header: "Stock Quantity", size: 110 },
    { accessorKey: "reserve_quantity", header: "Reserve Quantity", size: 120 },
    { accessorKey: "available_quantity", header: "Available Quantity", size: 130 },
    { accessorKey: "uom", header: "UoM", size: 70 },
    { accessorKey: "lot_no", header: "Lot No", size: 100 },
    { accessorKey: "mfg_date", header: "Mfg Date", size: 110 },
    { accessorKey: "expiry_date", header: "Expiry Date", size: 110 },
    { accessorKey: "product_group", header: "Product Group", size: 130 },
    { accessorKey: "product_brand", header: "Product Brand", size: 130 },
    { accessorKey: "category", header: "Category", size: 120 },
    { accessorKey: "product_type", header: "Product Type", size: 120 },
    { accessorKey: "manufacturer", header: "Manufacturer", size: 140 },
    { accessorKey: "doc_type", header: "Doc Type", size: 90 },
    { accessorKey: "doc_no", header: "Doc No", size: 120 },
  ];

  // TAB4 — Product Info columns
  const productInfoColumns: ColumnDef<TProductInfoRow>[] = [
    { accessorKey: "product_code", header: "Product Code", size: 140 },
    { accessorKey: "product_name", header: "Product Name", size: 260 },
    { accessorKey: "group_code", header: "Group", size: 120 },
    { accessorKey: "brand_code", header: "Brand", size: 120 },
    { accessorKey: "category_code", header: "Category", size: 120 },
    { accessorKey: "product_type", header: "Product Type", size: 130 },
    { accessorKey: "manufacturer", header: "Manufacturer", size: 150 },
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
      {/* 3–4 fields per row on wider screens; every code+name dropdown uses
          LookupField (it owns its own display text, so the old disabled
          "name" companion inputs are gone). Inputs sit in a flexible column
          rather than a fixed px width, so they're a bit wider than before
          without needing per-field width tuning. */}
      <div className="rounded-md border bg-card p-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex items-center gap-1.5 min-w-0" key="product_code">
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
              <Input
                className="h-7 text-sm px-2"
                value={filters.barcode}
                onChange={(e) => set("barcode", e.target.value)}
              />
            </div>
            <Button size="icon" variant="outline" className="h-7 w-7" title="Search barcode">
              <Search size={12} />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="product_name">
            <span className="w-24 shrink-0 text-sm">Product Name:</span>
            <div className="min-w-0 flex-1">
              <Input
                className="h-7 text-sm px-2"
                value={filters.product_name}
                onChange={(e) => set("product_name", e.target.value)}
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
                valueField="manufacturer_code"
                displayFields={["manufacturer_code", "manufacturer_name"]}
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
                valueField="division_code"
                displayFields={["division_code", "division_name"]}
                loadOptions={() => loadLookupRows(DIVISION_LOOKUP_PARAMETER)}
                onChange={(value) => set("division", value)}
                placeholder="Code or name"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0" key="origin_country">
            <span className="w-24 shrink-0 text-sm">Origin Country:</span>
            <div className="min-w-0 flex-1">
              <LookupField
                compact
                value={filters.origin_country}
                columns={ORIGIN_COUNTRY_LOOKUP_COLUMNS}
                valueField="country_code"
                displayFields={["country_code", "country_name"]}
                loadOptions={() => loadLookupRows(ORIGIN_COUNTRY_LOOKUP_PARAMETER)}
                onChange={(value) => set("origin_country", value)}
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
          minWidth={1100}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row) => String(row.product_code ?? "")}
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
          minWidth={900}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row, index) => `${row.product_code ?? ""}-${row.zone_code ?? ""}-${index}`}
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
          minWidth={1500}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row, index) => `${row.product_code ?? ""}-${row.doc_no ?? ""}-${index}`}
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
          minWidth={900}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row) => String(row.product_code ?? "")}
        />
      )}
    </section>
  );
}