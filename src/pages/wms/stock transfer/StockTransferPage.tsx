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
          className="font-semibold text-primary hover:underline text-[11.5px] text-left cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            navigate(detailUrl(row.original));
          }}
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
        return <span className="text-[11.5px] text-foreground">{[code, name].filter(Boolean).join(" - ") || "-"}</span>;
      },
    },
    {
      accessorKey: "user_dt",
      header: "Date",
      size: 120,
      cell: ({ row }) => <span className="text-[11.5px] text-foreground">{formatDate(val(row.original, "user_dt") || val(row.original, "stn_date"))}</span>,
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
      cell: ({ row }) => <span className="text-[11.5px] text-foreground">{val(row.original, "count_no") || "-"}</span>,
    },
    {
      id: "actions",
      header: "ACTIONS",
      size: 80,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <button
          type="button"
          className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          title="View transfer"
          onClick={(e) => {
            e.stopPropagation(); // Prevent row click from firing twice
            navigate(detailUrl(row.original));
          }}
        >
          <Eye size={13} />
        </button>
      ),
    },
  ], [navigate]);

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Stock Transfer Listing
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* <Button variant="outline" onClick={() => loadRows()}><RefreshCw size={15} /> Refresh</Button> */}
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Table - exactly like Freight */}
      <DataTable
        columns={columns}
        data={rows}
        toolbar={
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Add Transfer
          </button>
        }
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search transfer no, principal..."
        loading={loading}
        height="calc(100vh - 180px)"
        minWidth={960}
        density="grid"
        enablePagination
        pageSize={25}
        enableExport
        exportFilename="stock-transfers-list.csv"
        getRowId={(row, index) => {
          const stn = val(row, "stn_no");
          const prin = val(row, "prin_code");
          const co = val(row, "company_code");
          return stn ? `${co}-${prin}-${stn}` : String(index);
        }}
        rowClassName={(row) => {
          // Apply row colors based on status, forcing onto cells to override DataTable defaults
          if (val(row, "confirmed") === "Y") return "[&>td]:bg-emerald-50/70"; // Confirmed -> Light Green
          return "[&>td]:bg-amber-50/70"; // Default -> Light Yellow (matching Freight's In Progress)
        }}
        onRowClick={(row) => navigate(detailUrl(row))}
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