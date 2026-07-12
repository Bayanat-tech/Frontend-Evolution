import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Eye, FileDown, Pencil, RefreshCw, Search, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getHrLeaveFlow } from "../../../api/hr";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import NoticeToast, { type ToastNotice } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import type { LeaveFlowConfig } from "./leaveFlowConfig";
import { LeaveRequestDialog } from "./LeaveRequestDialog";

type LeaveFlowRow = Record<string, unknown>;

const preferredColumns = [
  "REQUEST_NUMBER",
  "REQUEST_DATE",
  "EMPLOYEE_NAME_DISPLAY",
  "EMPLOYEE_NAME",
  "EMPLOYEE_ID",
  "LEAVE_TYPE_DESC",
  "LEAVE_TYPE",
  "LEAVE_START_DATE",
  "LEAVE_END_DATE",
  "LEAVE_DAYS",
  "REASON",
  "LAST_ACTION",
  "NEXT_ACTION_BY",
  "FINAL_APPROVED",
  "STATUS",
];

const toneClasses: Record<LeaveFlowConfig["statusTone"], string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export function LeaveFlowTable({
  config,
  headerActions,
  refreshToken,
  onEditRow,
}: {
  config: LeaveFlowConfig;
  headerActions?: ReactNode;
  refreshToken?: number;
  onEditRow?: (row: LeaveFlowRow) => void;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaveFlowRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewRow, setViewRow] = useState<LeaveFlowRow | null>(null);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");

  const loadRows = async (clearNotice = true) => {
    if (clearNotice) setNotice(null);
    if (!loginId) {
      setRows([]);
      setNotice({ type: "error", message: "Login id is missing for leave flow lookup" });
      return;
    }
    setLoading(true);
    try {
      const response = await getHrLeaveFlow(config.endpoint, loginId);
      setRows(response.tableData || []);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(false);
  }, [config.endpoint, loginId, refreshToken]);

  const columns = useMemo<ColumnDef<LeaveFlowRow>[]>(() => {
    const sample = rows[0] || {};
    const orderedKeys = preferredColumns.filter((key) => key in sample);
    const fallbackKeys = Object.keys(sample).filter((key) => !orderedKeys.includes(key)).slice(0, 8);
    const finalKeys = [...orderedKeys, ...fallbackKeys].slice(0, 14);

    const dataColumns = finalKeys.map((key) => ({
      accessorKey: key,
      header: titleCase(key),
      size: getColumnSize(key),
      cell: ({ row }: { row: { original: LeaveFlowRow } }) => formatValue(row.original[key]),
    }));

    if (!onEditRow && config.key === "request") return dataColumns;

    return [
      {
        id: "actions",
        header: "Action",
        size: 84,
        cell: ({ row }: { row: { original: LeaveFlowRow } }) => (
          onEditRow ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="leave-row-action"
              title="Edit leave request"
              aria-label="Edit leave request"
              onClick={() => onEditRow(row.original)}
            >
              <Pencil size={14} />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="leave-row-action"
              title="View leave request"
              aria-label="View leave request"
              onClick={() => setViewRow(row.original)}
            >
              <Eye size={14} />
            </Button>
          )
        ),
      },
      ...dataColumns,
    ];
  }, [rows, onEditRow, config.key]);

  return (
    <section className="leave-flow-page">
      <div className="leave-flow-header">
        <div className="min-w-0">
          <p className="leave-flow-eyebrow">{config.eyebrow}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1>{config.title}</h1>
            <span className={`leave-flow-status ${toneClasses[config.statusTone]}`}>{config.statusLabel}</span>
            <Badge variant="outline">{rows.length.toLocaleString()} requests</Badge>
          </div>
          <p>{config.description}</p>
        </div>
        <div className="leave-flow-actions">
          {headerActions}
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        toolbar={<ToolbarMeta config={config} />}
        loading={loading}
        emptyText={`No ${config.title.toLowerCase()} found`}
        density="grid"
        height="calc(100vh - 182px)"
        minWidth={1500}
        enablePagination
        enableExport
        exportFilename={`${config.componentName}.csv`}
        pageSize={100}
        getRowId={(row, index) => `${String(row.REQUEST_NUMBER ?? row.requestNumber ?? row.SR_NO ?? config.key)}_${index}`}
      />
      <LeaveRequestDialog
        open={Boolean(viewRow)}
        initialRow={viewRow}
        readOnly
        onClose={() => setViewRow(null)}
        onSaved={() => void loadRows(false)}
      />
    </section>
  );
}

function ToolbarMeta({ config }: { config: LeaveFlowConfig }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1">
        <Search size={12} /> Live filter
      </Badge>
      <Badge variant="outline" className="gap-1">
        <FileDown size={12} /> CSV ready
      </Badge>
      {config.key === "closed" ? (
        <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 size={12} /> Final
        </Badge>
      ) : null}
      {config.key === "rejected" ? (
        <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
          <XCircle size={12} /> Returned
        </Badge>
      ) : null}
    </div>
  );
}

function getColumnSize(key: string) {
  if (key.includes("EMPLOYEE_NAME")) return 220;
  if (key.includes("REQUEST_NUMBER")) return 130;
  if (key.includes("DATE")) return 140;
  if (key.includes("REASON")) return 260;
  return 160;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
  return String(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}
