import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Plus, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getHrLeaveFlow } from "../../../api/hr";
import { DataTable } from "../../../components/ui/DataTable";
import type { ToastNotice } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import { LeaveRequestDialog } from "./LeaveRequestDialog";
import type { LeaveFlowKey } from "./leaveFlowConfig";

export type LeaveTabKey = LeaveFlowKey | "all";

type TabDefinition = {
  key: LeaveTabKey;
  label: string;
};

const statusTabs: TabDefinition[] = [
  { key: "request", label: "Pending" },
  { key: "inProgress", label: "In Progress" },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const tabEndpoints: Record<LeaveFlowKey, string> = {
  request: "Pg_Leave_flow",
  inProgress: "Pg_leave_flow_InProgress",
  closed: "Pg_leave_flow_close",
  cancelled: "Pg_leave_flow_cancel",
  rejected: "Pg_leave_flow_Rejected",
};

type Row = Record<string, unknown>;

export function LeaveWorkspacePage({ initialTab = "request" }: { initialTab?: LeaveFlowKey }) {
  const { user } = useAuth();
  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || user?.username || "");

  const [activeTab, setActiveTab] = useState<LeaveTabKey>(initialTab);
  const [dataByTab, setDataByTab] = useState<Record<LeaveFlowKey, Row[]>>({
    request: [],
    inProgress: [],
    closed: [],
    cancelled: [],
    rejected: [],
  });
  const [counts, setCounts] = useState<Record<LeaveTabKey, number>>({
    request: 0,
    inProgress: 0,
    closed: 0,
    cancelled: 0,
    rejected: 0,
    all: 0,
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<ToastNotice>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Load all tab data and counts
  const loadAllData = useCallback(async (showNotice = false) => {
    if (!loginId) {
      setNotice({ type: "error", message: "User login ID is missing." });
      return;
    }
    setLoading(true);
    if (showNotice) setNotice(null);

    try {
      const keys: LeaveFlowKey[] = ["request", "inProgress", "closed", "cancelled", "rejected"];
      const results = await Promise.allSettled(
        keys.map((key) => getHrLeaveFlow(tabEndpoints[key], loginId, 1, 1000))
      );

      const nextData: Record<LeaveFlowKey, Row[]> = {
        request: [],
        inProgress: [],
        closed: [],
        cancelled: [],
        rejected: [],
      };

      let totalCount = 0;
      const nextCounts: Record<LeaveTabKey, number> = {
        request: 0,
        inProgress: 0,
        closed: 0,
        cancelled: 0,
        rejected: 0,
        all: 0,
      };

      results.forEach((res, index) => {
        const key = keys[index];
        if (res.status === "fulfilled") {
          const rows = res.value.tableData || [];
          nextData[key] = rows;
          const count = rows.length;
          nextCounts[key] = count;
          totalCount += count;
        } else {
          console.warn(`Failed to load ${key}:`, res.reason);
        }
      });

      nextCounts.all = totalCount;
      setDataByTab(nextData);
      setCounts(nextCounts);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load leave requests",
      });
    } finally {
      setLoading(false);
    }
  }, [loginId]);

  useEffect(() => {
    void loadAllData(false);
  }, [loadAllData]);

  // Rows currently active based on selected status pill tab
  const currentRows = useMemo(() => {
    if (activeTab === "all") {
      const allRows: Row[] = [];
      const seenIds = new Set<string>();
      const keys: LeaveFlowKey[] = ["request", "inProgress", "closed", "cancelled", "rejected"];
      keys.forEach((k) => {
        dataByTab[k].forEach((row, i) => {
          const id = String(row.REQUEST_NUMBER ?? row.requestNumber ?? `${k}_${i}`);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allRows.push({ ...row, _inferredTab: k });
          }
        });
      });
      return allRows;
    }
    return dataByTab[activeTab] || [];
  }, [activeTab, dataByTab]);

  const handleOpenView = (row: Row) => {
    setSelectedRow(row);
    setIsReadOnly(true);
    setDialogOpen(true);
  };

  const handleOpenEdit = (row: Row) => {
    setSelectedRow(row);
    setIsReadOnly(false);
    setDialogOpen(true);
  };

  const handleStartNew = () => {
    setSelectedRow(null);
    setIsReadOnly(false);
    setDialogOpen(true);
  };

  const handlePrint = (row: Row) => {
    const reqNo = String(row.REQUEST_NUMBER || row.requestNumber || "-");
    const empName = String(row.EMPLOYEE_NAME_DISPLAY || row.EMPLOYEE_NAME || row.employeeName || "-");
    const leaveType = String(row.LEAVE_TYPE_DESC || row.LEAVE_TYPE || "-");
    const startDate = formatDate(row.LEAVE_START_DATE);
    const endDate = formatDate(row.LEAVE_END_DATE);
    const days = String(row.LEAVE_DAYS || "-");
    const reason = String(row.REASON || "-");
    const status = String(row.STATUS || activeTab);

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Leave Request - ${reqNo}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #1e293b; }
            .header { border-bottom: 2px solid #00378C; padding-bottom: 12px; margin-bottom: 20px; }
            h2 { color: #00378C; margin: 0 0 6px; font-size: 22px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; }
            .label { font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px; margin-bottom: 2px; }
            .value { font-weight: 500; }
            .box { padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Leave Request Details</h2>
            <div style="font-size: 12px; color: #64748b;">Printed on ${new Date().toLocaleDateString("en-GB")}</div>
          </div>
          <div class="grid">
            <div class="box"><div class="label">Request Number</div><div class="value">${reqNo}</div></div>
            <div class="box"><div class="label">Employee</div><div class="value">${empName}</div></div>
            <div class="box"><div class="label">Leave Type</div><div class="value">${leaveType}</div></div>
            <div class="box"><div class="label">Duration</div><div class="value">${startDate} to ${endDate} (${days} days)</div></div>
            <div class="box" style="grid-column: span 2;"><div class="label">Reason</div><div class="value">${reason}</div></div>
            <div class="box"><div class="label">Status</div><div class="value">${status}</div></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "REQUEST_NUMBER",
        header: "REQUEST NO",
        size: 130,
        cell: ({ row }) => {
          const reqNo = String(row.original.REQUEST_NUMBER ?? row.original.requestNumber ?? "-");
          return (
            <button
              className="font-semibold text-[#00378C] hover:underline text-left text-[11.5px] cursor-pointer"
              type="button"
              onClick={() => handleOpenView(row.original)}
              title="View Leave Request"
            >
              {reqNo}
            </button>
          );
        },
      },
      {
        accessorKey: "REQUEST_DATE",
        header: "DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(row.original.REQUEST_DATE ?? row.original.requestDate)}
          </span>
        ),
      },
      {
        accessorKey: "EMPLOYEE_ID",
        header: "EMP ID",
        size: 90,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground font-medium">
            {String(row.original.EMPLOYEE_ID ?? row.original.employeeId ?? "-")}
          </span>
        ),
      },
      {
        accessorKey: "EMPLOYEE_NAME",
        header: "EMPLOYEE NAME",
        minSize: 180,
        cell: ({ row }) => {
          const name = String(
            row.original.EMPLOYEE_NAME_DISPLAY ?? row.original.EMPLOYEE_NAME ?? row.original.employeeName ?? "-"
          );
          return (
            <div className="truncate" title={name}>
              <span className="text-[11.5px] text-foreground">{name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "LEAVE_TYPE_DESC",
        header: "LEAVE TYPE",
        size: 130,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {String(row.original.LEAVE_TYPE_DESC ?? row.original.LEAVE_TYPE ?? row.original.leaveType ?? "-")}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_START_DATE",
        header: "START DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(row.original.LEAVE_START_DATE ?? row.original.leaveStartDate)}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_END_DATE",
        header: "END DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">
            {formatDate(row.original.LEAVE_END_DATE ?? row.original.leaveEndDate)}
          </span>
        ),
      },
      {
        accessorKey: "LEAVE_DAYS",
        header: "DAYS",
        size: 70,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground font-semibold">
            {String(row.original.LEAVE_DAYS ?? row.original.leaveDays ?? "-")}
          </span>
        ),
      },
      {
        accessorKey: "REASON",
        header: "REASON",
        minSize: 160,
        cell: ({ row }) => {
          const reason = String(row.original.REASON ?? row.original.reason ?? "-");
          return (
            <div className="truncate" title={reason}>
              <span className="text-[11.5px] text-muted-foreground">{reason}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "STATUS",
        header: "STATUS",
        size: 110,
        cell: ({ row }) => {
          const tabKey = (row.original._inferredTab as LeaveFlowKey) || activeTab;
          const status = String(row.original.STATUS ?? row.original.status ?? getStatusText(tabKey));
          return (
            <span className={statusBadgeClass(status, tabKey)}>
              {status}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "ACTIONS",
        size: 110,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const tabKey = (row.original._inferredTab as LeaveFlowKey) || activeTab;
          const isPending = tabKey === "request" || tabKey === "all";
          return (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="View Leave Request"
                onClick={() => handleOpenView(row.original)}
              >
                <Eye size={13} />
              </button>
              {isPending && (
                <button
                  type="button"
                  className="h-6 w-6 grid place-items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Leave Request"
                  onClick={() => handleOpenEdit(row.original)}
                >
                  <Pencil size={13} />
                </button>
              )}
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Print Leave Request"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrint(row.original);
                }}
              >
                <Printer size={13} />
              </button>
            </div>
          );
        },
      },
    ],
    [activeTab]
  );

  return (
    <section className="leave-workspace-freight-view grid gap-2">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Leave Request Flow
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notice && (
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {notice.message}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadAllData(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary text-xs font-medium cursor-pointer transition-all shadow-sm"
            title="Refresh leave requests"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-primary" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Freight-style Status Pill Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {statusTabs.map((tab) => {
          const count = counts[tab.key] || 0;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#00378C] text-white shadow-sm font-semibold"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main DataTable */}
      <DataTable
        columns={columns}
        data={currentRows}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAllData(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary text-xs font-medium cursor-pointer transition-all shadow-sm"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-primary" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleStartNew}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Leave Request
            </button>
          </div>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search request number, employee, leave type, reason..."
        loading={loading}
        height="calc(100dvh - 180px)"
        density="grid"
        enablePagination
        pageSize={25}
        enableExport
        exportFilename={`leave-request-${activeTab}.csv`}
        getRowId={(row, index) =>
          String(row.REQUEST_NUMBER ?? row.requestNumber ?? row.SR_NO ?? index)
        }
        onRowClick={handleOpenView}
      />

      {/* Leave Request Dialog (Add, Edit, View) */}
      <LeaveRequestDialog
        open={dialogOpen}
        initialRow={selectedRow}
        readOnly={isReadOnly}
        onClose={() => {
          setDialogOpen(false);
          setSelectedRow(null);
        }}
        onSaved={() => void loadAllData(false)}
      />
    </section>
  );
}

function getStatusText(tabKey: string): string {
  if (tabKey === "request") return "Pending";
  if (tabKey === "inProgress") return "In Progress";
  if (tabKey === "closed") return "Closed";
  if (tabKey === "cancelled") return "Cancelled";
  if (tabKey === "rejected") return "Rejected";
  return "Active";
}

function statusBadgeClass(status: string, tabKey: string): string {
  const norm = (status || "").toLowerCase();
  if (norm.includes("close") || norm.includes("approv") || tabKey === "closed") {
    return "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-emerald-700";
  }
  if (norm.includes("progress") || tabKey === "inProgress") {
    return "inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-sky-700";
  }
  if (norm.includes("cancel") || tabKey === "cancelled") {
    return "inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-slate-700";
  }
  if (norm.includes("reject") || tabKey === "rejected") {
    return "inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-red-700";
  }
  return "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700";
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  const str = String(value);
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleDateString("en-GB");
}
