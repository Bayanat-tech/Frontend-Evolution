import { Loader2, Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { DataTable } from "../../../components/ui/DataTable";
import { executeHrRawSql } from "../../../api/hr";
import { TLeaveApproval } from "./leave-approval-types";
import LeaveResumptionForm from "./LeaveResumptionForm";
// Same directory as the Leave Request page: reuse its procedure caller.
// Adjust the file name if your leave request page file is named differently.
import { getLeaveFlowBucket } from "./LeaveWorkspacePage";

type ResumptionBucketKey = "approval" | "inProgress" | "closed";
type ResumptionTabKey = ResumptionBucketKey | "all";

type TabDefinition = {
  key: ResumptionTabKey;
  label: string;
};

const statusTabs: TabDefinition[] = [
  { key: "approval", label: "Approval" },
  { key: "inProgress", label: "In Progress" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const bucketKeys: ResumptionBucketKey[] = ["approval", "inProgress", "closed"];

// Procedure parameter for each tab (PROC_BUILD_DYNAMIC_SQL_GET_LEAVE_FLOW)
const tabEndpoints: Record<ResumptionBucketKey, string> = {
  approval: "LEAVE_FLOW_RESUMPTION_APPROVAL",
  inProgress: "LEAVE_FLOW_RESUMPTION_INPROGRESS",
  closed: "LEAVE_FLOW_RESUMPTION_CLOSED",
};

type ResumptionRow = TLeaveApproval & { _inferredTab?: ResumptionBucketKey };

const emptyData = (): Record<ResumptionBucketKey, ResumptionRow[]> => ({
  approval: [],
  inProgress: [],
  closed: [],
});

const emptyCounts = (): Record<ResumptionTabKey, number> => ({
  approval: 0,
  inProgress: 0,
  closed: 0,
  all: 0,
});

export function LeaveResumptionApprovalPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const loginId = String(user?.loginid1 || user?.LOGINID1 || user?.loginid || user?.LOGINID || "");
  const compCode = String(user?.COMPANY_CODE || user?.company_code || "00001");
  // Legacy users have letters in their login id (same rule as the Leave Request page)
  const isMhdl = /[a-z]/i.test(String(user?.LOGINID || user?.loginid || ""));

  const [activeTab, setActiveTab] = useState<ResumptionTabKey>("approval");
  const [dataByTab, setDataByTab] = useState<Record<ResumptionBucketKey, ResumptionRow[]>>(emptyData());
  const [counts, setCounts] = useState<Record<ResumptionTabKey, number>>(emptyCounts());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Page state: "list" shows the grid, "editor" shows the form as a full page (same as Leave Request)
  const [view, setView] = useState<"list" | "editor">("list");
  const [editData, setEditData] = useState<TLeaveApproval | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Load every bucket (one procedure call per tab) and the tab counts
  const loadRows = useCallback(async () => {
    if (!loginId || !compCode) {
      setDataByTab(emptyData());
      setCounts(emptyCounts());
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        bucketKeys.map((key) =>
          getLeaveFlowBucket({
            companyCode: compCode,
            loginId,
            parameter: tabEndpoints[key],
            legacy: isMhdl,
          })
        )
      );

      const nextData = emptyData();
      const nextCounts = emptyCounts();
      const uniqueIds = new Set<string>();

      results.forEach((res, index) => {
        const key = bucketKeys[index];
        if (res.status === "fulfilled") {
          const rows = res.value as unknown as ResumptionRow[];
          nextData[key] = rows;
          nextCounts[key] = rows.length;
          rows.forEach((row, i) => uniqueIds.add(String(row.REQUEST_NUMBER ?? `${key}_${i}`)));
        } else {
          console.warn(`Unable to load leave resumption ${key}:`, res.reason);
        }
      });

      // "All" counts each request once, even if it appears in several buckets
      nextCounts.all = uniqueIds.size;
      setDataByTab(nextData);
      setCounts(nextCounts);
    } catch (error) {
      console.warn("Unable to load leave resumptions:", error);
    } finally {
      setLoading(false);
    }
  }, [loginId, compCode, isMhdl]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const currentRows = useMemo<ResumptionRow[]>(() => {
    if (activeTab === "all") {
      const allRows: ResumptionRow[] = [];
      const seenIds = new Set<string>();
      bucketKeys.forEach((k) => {
        dataByTab[k].forEach((row, i) => {
          const id = String(row.REQUEST_NUMBER ?? `${k}_${i}`);
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

  const allLoadedRows = useMemo(
    () => bucketKeys.flatMap((k) => dataByTab[k]),
    [dataByTab]
  );

  const openEdit = async (requestNumber: string) => {
    setView("editor");
    setEditLoading(true);
    setEditData(null);
    const fallbackRow = () => allLoadedRows.find((r) => r.REQUEST_NUMBER === requestNumber) ?? null;
    try {
      const editsql = (requestNumber: string) => `
      SELECT *
      FROM VW_LEAVE_REQUEST_FLOW_CLOSE
      WHERE company_code = '${user?.COMPANY_CODE}'
      AND request_number = '${requestNumber}'
      ORDER BY request_number ASC
      `;
      const res = await executeHrRawSql(editsql(requestNumber));
      const found = (res ?? []) as TLeaveApproval[];
      // Fall back to the grid row if the lookup view returns nothing (e.g. other tenants).
      setEditData(found[0] ?? fallbackRow());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load leave request");
      setEditData(fallbackRow());
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditor = () => {
    setView("list");
    setEditData(null);
  };

  const columns = useMemo<ColumnDef<ResumptionRow>[]>(
    () => [
      {
        accessorKey: "REQUEST_NUMBER",
        header: "REQUEST NO",
        size: 130,
        cell: ({ row }) => {
          const tabKey = row.original._inferredTab || activeTab;
          const reqNo = row.original.REQUEST_NUMBER || "-";
          // Only rows in the Approval bucket can be actioned by this user
          if (tabKey !== "approval") {
            return <span className="font-semibold text-[#00378C] text-[11.5px]">{reqNo}</span>;
          }
          return (
            <button
              className="font-semibold text-[#00378C] hover:underline text-left text-[11.5px] cursor-pointer"
              type="button"
              onClick={() => void openEdit(row.original.REQUEST_NUMBER)}
              title="Open leave resumption"
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
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.REQUEST_DATE)}</span>
        ),
      },
      {
        accessorKey: "EMPLOYEE_NAME_DISPLAY",
        header: "EMPLOYEE NAME",
        minSize: 180,
        cell: ({ row }) => (
          <div className="truncate" title={String(row.original.EMPLOYEE_NAME_DISPLAY || "")}>
            <span className="text-[11.5px] text-foreground">{row.original.EMPLOYEE_NAME_DISPLAY || "-"}</span>
          </div>
        ),
      },
      {
        accessorKey: "LEAVE_TYPE_DESC",
        header: "LEAVE TYPE",
        size: 140,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground font-medium">{row.original.LEAVE_TYPE_DESC || "-"}</span>
        ),
      },
      {
        accessorKey: "LEAVE_START_DATE",
        header: "START DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.LEAVE_START_DATE)}</span>
        ),
      },
      {
        accessorKey: "LEAVE_END_DATE",
        header: "END DATE",
        size: 100,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.LEAVE_END_DATE)}</span>
        ),
      },
      {
        accessorKey: "ACTUAL_RESUME_DATE",
        header: "ACTUAL RESUME",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.ACTUAL_RESUME_DATE)}</span>
        ),
      },
      {
        accessorKey: "DUTY_RESUME_DATE",
        header: "DUTY RESUME",
        size: 110,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{formatDate(row.original.DUTY_RESUME_DATE)}</span>
        ),
      },
      {
        accessorKey: "REMARKS",
        header: "REMARKS",
        size: 150,
        cell: ({ row }) => (
          <div className="truncate" title={String(row.original.REMARKS || "")}>
            <span className="text-[11.5px] text-muted-foreground">{row.original.REMARKS || "-"}</span>
          </div>
        ),
      },
      {
        id: "status",
        header: "STATUS",
        size: 130,
        cell: ({ row }) => {
          const tabKey = row.original._inferredTab || activeTab;
          const status = resumptionStatus(row.original, tabKey);
          return <span className={statusBadgeClass(status, tabKey)}>{status}</span>;
        },
      },
      {
        accessorKey: "NEXT_ACTION_BY_NAME",
        header: "NEXT ACTION BY",
        size: 160,
        cell: ({ row }) => (
          <span className="text-[11.5px] text-foreground">{row.original.NEXT_ACTION_BY_NAME || "-"}</span>
        ),
      },
      {
        id: "actions",
        header: "ACTIONS",
        size: 80,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const tabKey = row.original._inferredTab || activeTab;
          if (tabKey !== "approval") return <div className="text-center text-[11.5px] text-muted-foreground">-</div>;
          return (
            <div className="flex items-center justify-center">
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Open leave resumption"
                aria-label="Open leave resumption"
                onClick={() => void openEdit(row.original.REQUEST_NUMBER)}
              >
                <Pencil size={13} />
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, allLoadedRows]
  );

  return (
    <section className="leave-resumption-freight-view grid gap-2">
      {view === "editor" ? (
        editLoading ? (
          <div className="flex h-[calc(100dvh-150px)] items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={16} />
            Loading leave request...
          </div>
        ) : (
          <LeaveResumptionForm
            data={editData}
            isEditMode
            onClose={closeEditor}
            onSuccess={() => {
              closeEditor();
              void loadRows();
            }}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2.5">
              <h2
                className="text-foreground m-0"
                style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
              >
                Leave Resumption
              </h2>
            </div>
          </div>

          {/* Status pill tabs (same look as the Leave Request page) */}
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

          <DataTable
            columns={columns}
            data={currentRows}
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Search leave resumption..."
            loading={loading}
            emptyText="No leave resumption found"
            density="grid"
            height="calc(100dvh - 180px)"
            minWidth={1300}
            enablePagination
            enableExport
            exportFilename={`Leave_Resumption_${activeTab}.csv`}
            pageSize={25}
            getRowId={(row, index) => `${row.REQUEST_NUMBER ?? index}`}
          />
        </>
      )}
    </section>
  );
}

function getStatusText(tabKey: string): string {
  if (tabKey === "approval") return "Approval";
  if (tabKey === "inProgress") return "In Progress";
  if (tabKey === "closed") return "Closed";
  return "Active";
}

// Status shown in the grid, derived from the resume date fields returned by the procedure
function resumptionStatus(row: TLeaveApproval, tabKey: string): string {
  const approved = String((row as Record<string, unknown>).RESUME_DATE_APPROVED ?? "")
    .trim()
    .toUpperCase();
  if (approved === "YES" || approved === "Y") return "Closed";
  if (!row.ACTUAL_RESUME_DATE) return "Resume Date Pending";
  return getStatusText(tabKey);
}

function statusBadgeClass(status: string, tabKey: string): string {
  if (status === "Closed" || tabKey === "closed") {
    return "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-emerald-700";
  }
  if (tabKey === "inProgress") {
    return "inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-sky-700";
  }
  return "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700";
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB");
}

export default LeaveResumptionApprovalPage;