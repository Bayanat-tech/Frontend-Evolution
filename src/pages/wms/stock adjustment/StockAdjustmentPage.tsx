import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye, ClipboardList, Search, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import { executeWmsInboundSql } from "../../../api/wms";
import { AddStockAdjustmentForm } from "./AddStockAdjustmentForm";

// ─── Types ────────────────────────────────────────────────────────────────────
type WmsRow = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function val(row: WmsRow, key: string) {
  return String(row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()] ?? "");
}

function formatDate(input: string) {
  if (!input || input === "N/A") return "—";
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  return d.toLocaleDateString("en-GB");
}

function normalizeRow(row: WmsRow): WmsRow {
  const out: WmsRow = { ...row };
  Object.entries(row).forEach(([k, v]) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

// ─── Remarks pill ─────────────────────────────────────────────────────────────
function RemarksPill({ remarks }: { remarks: string }) {
  if (!remarks || remarks === "N/A")
    return <span className="text-muted-foreground">—</span>;
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
  const hash = remarks
    .split("")
    .reduce((acc, c) => c.charCodeAt(0) + ((acc << 5) - acc), 0);
  const cls = palettes[Math.abs(hash) % palettes.length];
  return (
    <span
      className={`inline-flex max-w-[180px] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
      title={remarks}
    >
      {remarks}
    </span>
  );
}

// ─── Base path ────────────────────────────────────────────────────────────────
const ADJ_BASE = "/workspace/wms/wms/activity/request/stock_adj";

// ─── Component ────────────────────────────────────────────────────────────────
export function StockAdjPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<WmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const raw = await executeWmsInboundSql(`
        SELECT 
          A.*, 
          P.PRIN_NAME,
          R.ADJREASON AS ADJ_REASON
        FROM TA_ADJHEADER A
        LEFT JOIN MS_PRINCIPAL P 
          ON A.PRIN_CODE = P.PRIN_CODE
          AND A.COMPANY_CODE = P.COMPANY_CODE
        LEFT JOIN MS_ADJREASON R
          ON A.ADJ_CODE = R.ADJREASON_CODE
        WHERE A.COMPANY_CODE = '${user?.company_code || ""}'
        ORDER BY A.USER_DT DESC
      `);
      const arr = Array.isArray(raw) ? raw : [];
      setRows(
        arr.map((row, index) => ({
          ...normalizeRow(row as WmsRow),
          _id: `${val(row as WmsRow, "company_code")}-${val(row as WmsRow, "prin_code")}-${val(row as WmsRow, "adj_no")}-${index}`,
        }))
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load stock adjustments.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const detailUrl = (row: WmsRow) =>
    `${ADJ_BASE}/view/${val(row, "adj_no")}?principal_code=${val(row, "prin_code")}`;

  // ── Search filter ─────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        val(row, "adj_no"),
        val(row, "prin_code"),
        val(row, "prin_name"),
        val(row, "adj_code"),
        val(row, "adj_reason"),
        val(row, "remarks"),
        val(row, "user_id"),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  // ── Columns ───────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        id: "principal",
        header: "Principal",
        size: 260,
        cell: ({ row }) => {
          const code = val(row.original, "prin_code");
          const name = val(row.original, "prin_name");
          return (
            <span className="text-[11.5px] text-foreground">
              {[code, name].filter(Boolean).join(" - ") || "—"}
            </span>
          );
        },
      },
      {
        id: "adj_code",
        header: "Adj Code",
        size: 220,
        cell: ({ row }) => {
          const code = val(row.original, "adj_code");
          const reason = val(row.original, "adj_reason");
          return (
            <span className="text-[11.5px] text-foreground">
              {[code, reason].filter(Boolean).join(" - ") || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "remarks",
        header: "Remarks",
        size: 200,
        cell: ({ row }) => <RemarksPill remarks={val(row.original, "remarks")} />,
      },
      {
        accessorKey: "adj_date",
        header: "Adj Date",
        size: 120,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(val(row.original, "adj_date"))}
          </span>
        ),
      },
      {
        accessorKey: "user_id",
        header: "User ID",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground font-medium">
            {val(row.original, "user_id")}
          </span>
        ),
      },
      {
        accessorKey: "user_dt",
        header: "User Date",
        size: 120,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(val(row.original, "user_dt"))}
          </span>
        ),
      },
      {
        id: "actions",
        header: "ACTIONS",
        size: 80,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Open adjustment"
              onClick={(e) => {
                e.stopPropagation();
                navigate(detailUrl(row.original));
              }}
            >
              <Eye size={13} />
            </button>
          </div>
        ),
      },
    ],
    [navigate]
  );

  // ── Render Full Page Form if open (Replaces grid) ─────────────────────────
  if (formOpen) {
    return (
      <AddStockAdjustmentForm
        onClose={(shouldRefetch) => {
          setFormOpen(false);
          if (shouldRefetch) {
            void loadRows(false);
            setNotice({ type: "success", message: "Stock adjustment created successfully." });
          }
        }}
      />
    );
  }

  // ── Render Listing Page ───────────────────────────────────────────────────
  return (
    <section className="grid gap-3">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ClipboardList size={15} />
          </div>
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Stock Adjustment Listing
          </h2>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* ── Unified Toolbar: Search + Export + Add ──────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search adjustment no, principal..."
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-[11.5px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {}}
          >
            <Download size={14} /> Export
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Add Adjustment
          </Button>
        </div>
      </div>

      {/* ── DataTable (no export, no search — handled above) ── */}
      <DataTable
        enableExport={false}
        columns={columns}
        data={filteredRows}
        loading={loading}
        height="calc(100dvh - 200px)"
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => String((row as WmsRow)._id || index)}
        rowClassName={() => "freight-status-row freight-status-draft"}
        onRowClick={(row) => navigate(detailUrl(row))}
      />
    </section>
  );
}

export default StockAdjPage;