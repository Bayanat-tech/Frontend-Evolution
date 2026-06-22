import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { getAllStockTransfers } from "../../../api/wms";
import TransferForm from "./AddStockTransferForm";

type WmsRow = Record<string, unknown>;

// ── Base path for stock transfer — keep in one place ──────────────────────────
const STN_BASE = "/workspace/wms/activity/request/stock_transfer";

function val(row: WmsRow, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? "");
}

function formatDate(input: string) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString("en-GB");
}

function DescriptionPill({ description }: { description: string }) {
  const safeValue = description ?? "";
  if (!safeValue || safeValue === "N/A") return <span className="text-muted-foreground">—</span>;
  const palettes = [
    "bg-blue-50 text-blue-700 border-blue-300",
    "bg-green-50 text-green-700 border-green-300",
    "bg-orange-50 text-orange-700 border-orange-300",
    "bg-purple-50 text-purple-700 border-purple-300",
    "bg-cyan-50 text-cyan-700 border-cyan-300",
    "bg-red-50 text-red-700 border-red-300",
    "bg-teal-50 text-teal-700 border-teal-300",
    "bg-yellow-50 text-yellow-700 border-yellow-300",
    "bg-pink-50 text-pink-700 border-pink-300",
  ];
  const hash = safeValue.split("").reduce((acc, c) => c.charCodeAt(0) + ((acc << 5) - acc), 0);
  const cls = palettes[Math.abs(hash) % palettes.length];
  return (
    <span
      className={`inline-flex max-w-[200px] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
      title={safeValue}
    >
      {safeValue}
    </span>
  );
}

export function StockTransferPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getAllStockTransfers();
      const normalized = [...(data as any[])]
        .sort((a, b) => new Date(b.USER_DT ?? b.STN_DATE ?? 0).getTime() - new Date(a.USER_DT ?? a.STN_DATE ?? 0).getTime())
        .map((row) => {
          const n: WmsRow = { ...row };
          Object.entries(row).forEach(([k, v]) => { n[k.toLowerCase()] = v; });
          return n;
        });
      setRows(normalized);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load stock transfers." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  // ── Build absolute detail URL ──
function detailUrl(row: WmsRow) {
  const stn = val(row, "stn_no");
  const prin = val(row, "prin_code");
  const co = val(row, "company_code");
  return `${STN_BASE}/view/${stn}?principal_code=${prin}&company_code=${co}`;
}
  const columns = useMemo<ColumnDef<WmsRow>[]>(() => [
    {
      accessorKey: "stn_no",
      header: "Transfer No",
      size: 130,
      cell: ({ row }) => (
        <button
          className="font-semibold text-primary hover:underline"
          onClick={() => navigate(detailUrl(row.original))}
        >
          {val(row.original, "stn_no")}
        </button>
      ),
    },
    {
      id: "principal",
      header: "Principal",
      size: 280,
      cell: ({ row }) => {
        const code = val(row.original, "prin_code");
        const name = val(row.original, "prin_name");
        return [code, name].filter(Boolean).join(" - ") || "-";
      },
    },
    {
      accessorKey: "user_dt",
      header: "Date",
      size: 120,
      cell: ({ row }) => formatDate(val(row.original, "user_dt") || val(row.original, "stn_date")),
    },
    {
      accessorKey: "description",
      header: "Description",
      size: 200,
      cell: ({ row }) => <DescriptionPill description={val(row.original, "description")} />,
    },
    {
      accessorKey: "count_no",
      header: "Count No",
      size: 110,
      cell: ({ row }) => val(row.original, "count_no") || "-",
    },
    {
      id: "actions",
      header: "Actions",
      size: 80,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          title="View transfer"
          onClick={() => navigate(detailUrl(row.original))}
        >
          <Eye size={14} />
        </Button>
      ),
    },
  ], [navigate]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Stock Transfer Listing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            View and manage stock transfer records across principals and warehouses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setFormOpen(true)}><Plus size={15} /> Add Transfer</Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        subtitle="Stock Transfers"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search transfer no, principal..."
        loading={loading}
        height="calc(100vh - 260px)"
        minWidth={960}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => {
          const stn = val(row, "stn_no");
          const prin = val(row, "prin_code");
          const co = val(row, "company_code");
          return stn ? `${co}-${prin}-${stn}` : String(index);
        }}
        rowClassName={(row) =>
          val(row, "confirmed") === "Y" ? "bg-emerald-50/70" : "bg-blue-50/50"
        }
      />

      {formOpen && (
        <TransferForm
          open={formOpen}
          onClose={(shouldRefetch) => {
            setFormOpen(false);
            if (shouldRefetch) {
              void loadRows(false);
              setNotice({ type: "success", message: "Stock transfer created successfully." });
            }
          }}
        />
      )}
    </section>
  );
}

export default StockTransferPage;