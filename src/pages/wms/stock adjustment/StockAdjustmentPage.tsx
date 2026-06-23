import type { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw } from "lucide-react";
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
  Object.entries(row).forEach(([k, v]) => { out[k.toLowerCase()] = v; });
  return out;
}

// ─── Remarks pill (same color logic as old code) ──────────────────────────────
function RemarksPill({ remarks }: { remarks: string }) {
  if (!remarks || remarks === "N/A") return <span className="text-muted-foreground">—</span>;
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
  const hash = remarks.split("").reduce((acc, c) => c.charCodeAt(0) + ((acc << 5) - acc), 0);
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
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load stock adjustments." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  const detailUrl = (row: WmsRow) =>
    `${ADJ_BASE}/view/${val(row, "adj_no")}?principal_code=${val(row, "prin_code")}`;

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "adj_no",
        header: "Adj No",
        size: 90,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() => navigate(detailUrl(row.original))}
          >
            {val(row.original, "adj_no")}
          </button>
        ),
      },
      {
        id: "principal",
        header: "Principal Code",
        size: 260,
        cell: ({ row }) => {
          const code = val(row.original, "prin_code");
          const name = val(row.original, "prin_name");
          return [code, name].filter(Boolean).join(" - ") || "—";
        },
      },
      {
        id: "adj_code",
        header: "Adj Code",
        size: 220,
        cell: ({ row }) => {
          const code = val(row.original, "adj_code");
          const reason = val(row.original, "adj_reason");
          return [code, reason].filter(Boolean).join(" - ") || "—";
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
        cell: ({ row }) => formatDate(val(row.original, "adj_date")),
      },
      {
        accessorKey: "user_id",
        header: "User ID",
        size: 110,
        cell: ({ row }) => val(row.original, "user_id"),
      },
      {
        accessorKey: "user_dt",
        header: "User Date",
        size: 120,
        cell: ({ row }) => formatDate(val(row.original, "user_dt")),
      },
    ],
    [navigate]
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Stock Adjustment Listing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            View and manage stock adjustment records across principals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={15} /> Add Adjustment
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        subtitle="Stock Adjustments"
        searchPlaceholder="Search adj no, principal, remarks..."
        loading={loading}
        height="calc(100vh - 260px)"
        minWidth={1060}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => String((row as WmsRow)._id || index)}
        rowClassName={(row) =>
          val(row as WmsRow, "confirmed") === "Y" ? "bg-emerald-50/70" : "bg-blue-50/50"
        }
      />

      {formOpen && (
        <AddStockAdjustmentForm
          open={formOpen}
          onClose={(shouldRefetch) => {
            setFormOpen(false);
            if (shouldRefetch) {
              void loadRows(false);
              setNotice({ type: "success", message: "Stock adjustment created successfully." });
            }
          }}
        />
      )}
    </section>
  );
}

export default StockAdjPage;