import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, FileText, History, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { DynamicQueryParams } from "../../../api/lookups";
import { api } from "../../../api/client";

type LogRow = Record<string, unknown>;

// Last action that is left out of the timeline (sent as code2 to the procedure).
const EXCLUDED_ACTION = "SUBMITTED";

const str = (row: LogRow | undefined, key: string) =>
  row && row[key] !== null && row[key] !== undefined ? String(row[key]) : "";

function extractApiErrorMessage(error: unknown, fallback: string) {
  const anyErr = error as any;
  const data = anyErr?.response?.data;
  const backendMessage = data?.details || data?.message;
  if (backendMessage && typeof backendMessage === "string") return backendMessage;
  if (error instanceof Error) return error.message;
  return fallback;
}

// PROC_BUILD_DYNAMIC_SQL_GET_LEAVE_FLOW, parameter LEAVE_FLOW_LOG
//   code1 = request number
//   code2 = last action to leave out (SUBMITTED)
export async function getLeaveLog(args: { loginId: string; requestNumber: string }): Promise<LogRow[]> {
  const params: DynamicQueryParams = {
    parameter: "LEAVE_FLOW_LOG",
    loginid: args.loginId,
    code1: args.requestNumber,
    code2: EXCLUDED_ACTION,
    code3: "N",
    number1: 0,
    number2: 1000,
  };

  try {
    const response = await api.post("/api/wms/common/proc_build_dynamic_sql_common20", params);
    if (!response.data.success) {
      throw new Error(response.data.details || response.data.message || "Unable to load leave log");
    }
    const rows = (response.data.data || []) as unknown as LogRow[];
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toUpperCase(), value])));
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to load leave log"));
  }
}

function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return (
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function actionBadgeClass(action: string) {
  const a = action.toLowerCase();
  const base = "inline-flex items-center rounded border px-2 py-0 text-[10.5px] leading-tight font-medium";
  if (a.includes("approv") || a.includes("close")) return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  if (a.includes("reject")) return `${base} border-red-200 bg-red-50 text-red-700`;
  if (a.includes("cancel") || a.includes("draft")) return `${base} border-slate-200 bg-slate-50 text-slate-700`;
  if (a.includes("sent")) return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  return `${base} border-sky-200 bg-sky-50 text-sky-700`;
}

function SummaryCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="m-0 truncate text-sm font-semibold text-slate-900" title={value}>
          {value || "N/A"}
        </p>
      </div>
    </div>
  );
}

/** Log content: summary cards + activity timeline. Used inside the dialog tab and the full log page. */
export function LeaveLogPanel({
  requestNumber,
  loginId,
  height = "calc(100dvh - 330px)",
}: {
  requestNumber: string;
  loginId: string;
  height?: string;
}) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!requestNumber) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    getLeaveLog({ loginId, requestNumber })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : "Unable to load leave log");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestNumber, loginId]);

  // Rows come back oldest first, so the last row is the current state.
  const latest = rows[rows.length - 1];
  const currentStatus = str(latest, "LAST_ACTION") || "N/A";
  const lastUpdated = latest ? formatDateTime(latest.UPDATED_AT) : "N/A";
  const leaveType = str(latest, "LEAVE_TYPE_DESC") || str(latest, "LEAVE_TYPE") || "N/A";

  const columns = useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        accessorKey: "REQUEST_NUMBER",
        header: "Request Number",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[11.5px] font-semibold text-[#00378C]">{str(row.original, "REQUEST_NUMBER") || "-"}</span>
        ),
      },
      {
        accessorKey: "LAST_ACTION",
        header: "Last Action",
        size: 130,
        cell: ({ row }) => {
          const action = str(row.original, "LAST_ACTION") || "-";
          return <span className={actionBadgeClass(action)}>{action}</span>;
        },
      },
      {
        accessorKey: "LEAVE_TYPE_DESC",
        header: "Leave Type",
        size: 150,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {str(row.original, "LEAVE_TYPE_DESC") || str(row.original, "LEAVE_TYPE") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "UPDATED_BY_DISPLAY",
        header: "Updated By",
        minSize: 200,
        cell: ({ row }) => {
          const v = str(row.original, "UPDATED_BY_DISPLAY") || str(row.original, "UPDATED_BY") || "-";
          return (
            <div className="truncate" title={v}>
              <span className="text-[11.5px] text-foreground">{v}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "UPDATED_AT",
        header: "Updated At",
        size: 150,
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{formatDateTime(row.original.UPDATED_AT)}</span>,
      },
      {
        accessorKey: "NEXT_ACTION_BY_DISPLAY",
        header: "Next Action By",
        minSize: 200,
        cell: ({ row }) => {
          const v = str(row.original, "NEXT_ACTION_BY_DISPLAY") || str(row.original, "NEXT_ACTION_BY") || "-";
          return (
            <div className="truncate" title={v}>
              <span className="text-[11.5px] text-foreground">{v}</span>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard label="Current Status" value={currentStatus} tone="bg-blue-50 text-blue-600" icon={<UserRound size={16} />} />
        <SummaryCard label="Last Updated" value={lastUpdated} tone="bg-emerald-50 text-emerald-600" icon={<History size={16} />} />
        <SummaryCard label="Leave Type" value={leaveType} tone="bg-violet-50 text-violet-600" icon={<FileText size={16} />} />
      </div>

      {error && (
        <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1.5">
          <h3 className="m-0 text-sm font-semibold text-slate-900">Activity Timeline</h3>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          height={height}
          density="grid"
          enablePagination
          pageSize={100}
          getRowId={(row, index) => `${str(row, "REQUEST_NUMBER")}_${str(row, "UPDATED_AT")}_${index}`}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-600">
        Last Updated: {lastUpdated} &bull; Total Records: {rows.length}
      </div>
    </div>
  );
}

/** Full page version (opened from the grid), styled like the leave editor page header. */
export function LeaveLogPage({
  requestNumber,
  loginId,
  onClose,
}: {
  requestNumber: string;
  loginId: string;
  onClose: () => void;
}) {
  return (
    <section className="flex flex-col gap-2 p-1">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="h-1 w-full bg-[#00378C]" />
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            aria-label="Back to list"
            title="Back to list"
            className="h-8 w-8 shrink-0 rounded-lg cursor-pointer"
          >
            <ArrowLeft size={15} />
          </Button>
          <h1 className="m-0 truncate text-sm font-semibold text-slate-900">Log Report</h1>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{requestNumber}</span>
        </div>
      </div>
      <LeaveLogPanel requestNumber={requestNumber} loginId={loginId} />
    </section>
  );
}