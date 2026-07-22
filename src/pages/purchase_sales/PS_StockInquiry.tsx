import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { getDynamicLookupaccount } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

// ─── Field set — mirrors the old dw_erp_stockinquiry DataWindow filter bar.
// Only the filter fields visible on the old screen are kept; nothing new
// invented here. ─────────────────────────────────────────────────────────
type TStockInquiryFilters = {
  product_code: string;
  barcode: string;
  product_name: string;
  model_number: string;
  group_code: string;
  group_name: string;
  category_code: string;
  category_name: string;
  brand_code: string;
  brand_name: string;
  product_type: string;
  product_type_name: string;
  manufacturer: string;
  manufacturer_name: string;
  division: string;
  origin_country: string;
  origin_country_name: string;
  refresh_product_list: boolean;
};

const EMPTY_FILTERS: TStockInquiryFilters = {
  product_code: "",
  barcode: "",
  product_name: "",
  model_number: "",
  group_code: "",
  group_name: "",
  category_code: "",
  category_name: "",
  brand_code: "",
  brand_name: "",
  product_type: "",
  product_type_name: "",
  manufacturer: "",
  manufacturer_name: "",
  division: "",
  origin_country: "",
  origin_country_name: "",
  refresh_product_list: false,
};

// Row shape for the "Product Info" grid — field names are placeholders,
// TODO: confirm exact column names against the real stock inquiry proc output.
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

// ─── Retrieve — parameter name is a PLACEHOLDER. VERIFY against the real
// PROC_BUILD_DYNAMIC_SQL_COMMON20 (or equivalent) entry for stock inquiry /
// product info before wiring this up against production. ──────────────────
const RETRIEVE_PARAMETER = "STOCK_INQUIRY_PRODUCT_INFO";

export function StockInquiryPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [filters, setFilters] = useState<TStockInquiryFilters>({ ...EMPTY_FILTERS });
  const [activeTab, setActiveTab] = useState<TabKey>("product_info");

  const [rows, setRows] = useState<TProductInfoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const set = (field: keyof TStockInquiryFilters, value: unknown) =>
    setFilters((prev) => ({ ...prev, [field]: value }));

  // ── Retrieve — sends filter bar values through to the dynamic lookup proc.
  // TODO: confirm code1..code10 slot mapping against the actual proc; this
  // ordering is a best-effort placeholder following the filter bar layout. ──
  const handleRetrieve = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await getDynamicLookupaccount({
        parameter: RETRIEVE_PARAMETER,
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
      const list = Array.isArray(response) ? (response as TProductInfoRow[]) : [];
      setRows(list);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load stock inquiry data",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode, filters]);

  const columns: ColumnDef<TProductInfoRow>[] = [
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
      <div className="rounded-md border bg-card p-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="field min-w-0" key="product_code">
            <span className="text-primary font-medium">Product Code:</span>
            <div className="flex items-center gap-1 min-w-0">
              <div className="min-w-0 flex-1">
                <Input
                  value={filters.product_code}
                  onChange={(e) => set("product_code", e.target.value)}
                />
              </div>
              <Button size="icon" variant="outline" title="Search product code">
                <Search size={14} />
              </Button>
            </div>
          </label>

          <label className="field min-w-0" key="barcode">
            <span>Barcode:</span>
            <div className="flex items-center gap-1 min-w-0">
              <div className="min-w-0 flex-1">
                <Input value={filters.barcode} onChange={(e) => set("barcode", e.target.value)} />
              </div>
              <Button size="icon" variant="outline" title="Search barcode">
                <Search size={14} />
              </Button>
            </div>
          </label>

          <label className="field min-w-0" key="product_name">
            <span>Product Name:</span>
            <Input
              value={filters.product_name}
              onChange={(e) => set("product_name", e.target.value)}
            />
          </label>

          <label className="field min-w-0" key="model_number">
            <span>Model Number:</span>
            <Input
              value={filters.model_number}
              onChange={(e) => set("model_number", e.target.value)}
            />
          </label>

          <label className="field min-w-0" key="group_code">
            <span>Group Code:</span>
            <div className="flex items-center gap-1 min-w-0">
              <Button size="icon" variant="outline" title="Search group">
                <Search size={14} />
              </Button>
              <div className="w-24 shrink-0">
                <Input value={filters.group_code} onChange={(e) => set("group_code", e.target.value)} />
              </div>
              <div className="min-w-0 flex-1">
                <Input value={filters.group_name} disabled placeholder="Group name" />
              </div>
            </div>
          </label>

          <label className="field min-w-0" key="category_code">
            <span>Category Code:</span>
            <div className="flex items-center gap-1 min-w-0">
              <Button size="icon" variant="outline" title="Search category">
                <Search size={14} />
              </Button>
              <div className="w-24 shrink-0">
                <Input
                  value={filters.category_code}
                  onChange={(e) => set("category_code", e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input value={filters.category_name} disabled placeholder="Category name" />
              </div>
            </div>
          </label>

          <label className="field min-w-0" key="brand_code">
            <span>Brand Code:</span>
            <div className="flex items-center gap-1 min-w-0">
              <Button size="icon" variant="outline" title="Search brand">
                <Search size={14} />
              </Button>
              <div className="w-24 shrink-0">
                <Input value={filters.brand_code} onChange={(e) => set("brand_code", e.target.value)} />
              </div>
              <div className="min-w-0 flex-1">
                <Input value={filters.brand_name} disabled placeholder="Brand name" />
              </div>
            </div>
          </label>

          <label className="field min-w-0" key="product_type">
            <span>Product Type:</span>
            <div className="flex items-center gap-1 min-w-0">
              <Button size="icon" variant="outline" title="Search product type">
                <Search size={14} />
              </Button>
              <div className="w-24 shrink-0">
                <Input
                  value={filters.product_type}
                  onChange={(e) => set("product_type", e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input value={filters.product_type_name} disabled placeholder="Product type name" />
              </div>
            </div>
          </label>

          <label className="field min-w-0" key="manufacturer">
            <span>Manufacturer:</span>
            <div className="flex items-center gap-1 min-w-0">
              <Button size="icon" variant="outline" title="Search manufacturer">
                <Search size={14} />
              </Button>
              <div className="w-24 shrink-0">
                <Input
                  value={filters.manufacturer}
                  onChange={(e) => set("manufacturer", e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input value={filters.manufacturer_name} disabled placeholder="Manufacturer name" />
              </div>
            </div>
          </label>

          <label className="field min-w-0" key="division">
            <span>Division:</span>
            <div className="flex items-center gap-1 min-w-0">
              <div className="w-24 shrink-0">
                <Input value={filters.division} onChange={(e) => set("division", e.target.value)} />
              </div>
              <Button size="icon" variant="outline" title="Search division">
                <Search size={14} />
              </Button>
              <label className="flex items-center gap-1.5 text-sm text-primary shrink-0">
                <input
                  type="checkbox"
                  checked={filters.refresh_product_list}
                  onChange={(e) => set("refresh_product_list", e.target.checked)}
                />
                Refresh Product List
              </label>
            </div>
          </label>

          <label className="field min-w-0" key="origin_country">
            <span>Origin Country:</span>
            <div className="flex items-center gap-1 min-w-0">
              <Button size="icon" variant="outline" title="Search origin country">
                <Search size={14} />
              </Button>
              <div className="w-24 shrink-0">
                <Input
                  value={filters.origin_country}
                  onChange={(e) => set("origin_country", e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input value={filters.origin_country_name} disabled placeholder="Country name" />
              </div>
            </div>
          </label>
        </div>

        <div className="mt-3 flex justify-end border-t pt-3">
          <Button disabled={loading} onClick={handleRetrieve}>
            <RefreshCw size={15} /> {loading ? "Retrieving..." : "Retrieve"}
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
      {activeTab === "product_info" && (
        <DataTable
          columns={columns}
          data={rows}
          title={`${rows.length.toLocaleString()} Records`}
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

      {/* TODO: wire these up once the corresponding stock procs/params are confirmed */}
      {activeTab === "stock_summary" && (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Stock Summary — not yet implemented.
        </div>
      )}
      {activeTab === "stock_by_zone" && (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Stock by Zone — not yet implemented.
        </div>
      )}
      {activeTab === "stock_detail" && (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Stock Detail — not yet implemented.
        </div>
      )}
    </section>
  );
}