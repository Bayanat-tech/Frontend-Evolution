// src/pages/almswf/Purchase_Request_page.tsx
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../state/AuthContext";
import { Plus, Eye, Edit2, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import type { TPurchaseSummaryTxn } from "./PurchaseSummary-types";
import AddPRRequestPage from "./Addprrequestpage";
import { almsCommonSelect } from "../../api/alms";

const TAB_CODE3 = ["PENDING", "INPROGRESS", "REJECTED", "SENDBACK", "CLOSED", "POGENERATED"] as const;
const TAB_LABELS = ["Pending", "In Progress", "Rejected", "Sent Back", "Final Approved", "Po Generated"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Display status derived from LAST_ACTION / FINAL_APPROVED (new schema) —
// PURCH_STATUS doesn't exist anymore, so the status badge is now computed
// client-side from whichever tab's data this row came from / its own fields.
function statusOf(row: TPurchaseSummaryTxn): string {
  const finalApproved = String((row as any).FINAL_APPROVED ?? "").toUpperCase();
  const lastAction = String((row as any).LAST_ACTION ?? "").toUpperCase();
  if (finalApproved === "Y") return "APPROVED";
  if (lastAction) return lastAction;
  return "PENDING";
}

function getStatusBadgeStyle(status: string) {
  const val = status.toUpperCase();
  let bg = "#f4f4f5", color = "#52525b", border = "#d4d4d8";
  if (val === "APPROVED" || val === "A/C POSTED") { bg = "#e8f0fe"; color = "#1a4fa0"; border = "#b3caf5"; }
  else if (val === "PENDING" || val === "DRAFT") { bg = "#fff4e5"; color = "#92400e"; border = "#fcd38a"; }
  else if (val === "SUBMITTED") { bg = "#dbeafe"; color = "#1e40af"; border = "#93c5fd"; }
  else if (val === "REJECTED") { bg = "#fdecea"; color = "#a01a1a"; border = "#f5b3b3"; }
  else if (val === "SENDBACK" || val === "SENT BACK") { bg = "#f3e8fe"; color = "#6b21a8"; border = "#d9b3f5"; }
  else if (val === "PO GENERATED") { bg = "#d1fae5"; color = "#065f46"; border = "#6ee7b7"; }
  return { bg, color, border };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface PurchaseRequestPageProps {
  initialTab?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Purchase_Request_page = ({ initialTab = 0 }: PurchaseRequestPageProps) => {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const queryClient = useQueryClient();

  // ── State ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Popup state ─────────────────────────────────────────────────────────────
  const [taskPopup, setTaskPopup] = useState({
    open: false,
    title: "",
    data: {
      existingData: null as TPurchaseSummaryTxn | null,
      isEditMode: false,
      isViewMode: false,
      flowCode: "" as string,
      flowDescription: "" as string,
    },
  });

  // ── Approval-flow confirmation popup ──────────────────────────────────────
  const [flowConfirm, setFlowConfirm] = useState({
    open: false,
    loading: false,
    rows: [] as { flowCode: string; flowDescription: string }[],
    selectedFlowCode: "",
  });

 
  const activeCode3 = TAB_CODE3[activeTab];
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-request-page", loginid, companyCode, activeCode3],
    queryFn: () =>
      almsCommonSelect<TPurchaseSummaryTxn>({
        parameter: "PS_PREQUEST_ENTRY_TAB_LIST",
        loginid,
        code1: companyCode,
        code2: loginid,
        code3: activeCode3,
        code4: "",
      }),
    enabled: !!loginid && !!companyCode,
  });

  const rows = useMemo(() => data ?? [], [data]);

  // ── Client-side search filtering only (tab filtering now happens server-side) ──
  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      [row.REQUEST_NUMBER, (row as any).DESCRIPTION, (row as any).CREATE_USER, statusOf(row)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [rows, query]);

  // ── Auto-dismiss notice ────────────────────────────────────────────────────
  useEffect(() => {
    if (isError) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load purchase requests"
      });
    }
  }, [isError, error]);

  // ── Popup handlers ──────────────────────────────────────────────────────────
  const openAddPopup = async () => {
    setFlowConfirm({ open: true, loading: true, rows: [], selectedFlowCode: "" });
    try {
      const rawRows = await almsCommonSelect<Record<string, unknown>>({
        parameter: "PS_PREQUEST_ENTRY_UserFlowCode", // Need to confirm this parameter name with Sir
        loginid,
        code1: companyCode,   // P_CODE1
        code2: loginid,       // P_CODE2 - logged-in user
        code3: "Admin",       // P_CODE3 - EMP_ID_LEVEL1 (to be replaced with actual employee code)
        code4: "",            // P_CODE4
      });
      const flowRows = rawRows
        .map((row) => ({
          flowCode: String(row.FLOW_CODE ?? row.flow_code ?? ""),
          flowDescription: String(row.FLOW_DESCRIPTION ?? row.flow_description ?? ""),
        }))
        .filter((row) => row.flowCode);

      if (flowRows.length === 0) {
        setFlowConfirm({ open: false, loading: false, rows: [], selectedFlowCode: "" });
        setNotice({ type: "error", message: "No approval flow found for this user. Please check MS_APPROVER_LEVELS setup." });
        return;
      }
      setFlowConfirm({
        open: true,
        loading: false,
        rows: flowRows,
        selectedFlowCode: flowRows.length === 1 ? flowRows[0].flowCode : "",
      });
    } catch (err) {
      setFlowConfirm({ open: false, loading: false, rows: [], selectedFlowCode: "" });
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to determine approval flow" });
    }
  };

  const confirmFlowAndOpenPR = () => {
    const selected = flowConfirm.rows.find((row) => row.flowCode === flowConfirm.selectedFlowCode);
    if (!selected) return;
    setFlowConfirm((prev) => ({ ...prev, open: false }));
    setTaskPopup({
      open: true,
      title: "Add PR",
      data: {
        existingData: null,
        isEditMode: false,
        isViewMode: false,
        flowCode: selected.flowCode,
        flowDescription: selected.flowDescription,
      },
    });
  };

  const handleActions = (actionType: "view" | "edit", row: TPurchaseSummaryTxn) => {
    setTaskPopup({
      open: true,
      title: `${actionType === "edit" ? "Edit" : "View"} PR - ${row.REQUEST_NUMBER}`,
      data: {
        existingData: row,
        isEditMode: actionType === "edit",
        isViewMode: actionType === "view",
        flowCode: "",
        flowDescription: "",
      },
    });
  };

  const closePopup = (refresh?: boolean) => {
    setTaskPopup((prev) => ({ ...prev, open: false }));
    if (refresh) {
      // Invalidate every tab's cached query, not just the active one — the
      // saved PR might now belong to a different tab than the one open
      // (e.g. saving as Draft should land it in Pending regardless of which
      // tab was active when "Add PR" was clicked).
      queryClient.invalidateQueries({ queryKey: ["purchase-request-page", loginid, companyCode] });
      setNotice({ type: "success", message: "Purchase request updated successfully" });
    }
  };

  const handleRefresh = () => {
    setNotice(null);
    refetch();
  };

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<TPurchaseSummaryTxn>[]>(
    () => [
      {
        accessorKey: "REQUEST_NO",
        header: "Request No",
        cell: ({ row }) => (
          <span className="font-semibold text-[#082A89]">
            {row.original.REQUEST_NUMBER}
          </span>
        ),
      },
      {
        accessorKey: "REQUEST_DATE",
        header: "Request Date",
        cell: ({ row }) => fmtDate((row.original as any).REQUEST_DATE),
      },
      {
        accessorKey: "DESCRIPTION",
        header: "Description",
        cell: ({ row }) => (row.original as any).DESCRIPTION || "—",
      },
      {
        accessorKey: "AMOUNT",
        header: "Amount",
        cell: ({ row }) => {
          const amt = (row.original as any).AMOUNT || 0;
          return <span className="font-semibold">{Number(amt).toLocaleString()}</span>;
        },
      },
      {
        accessorKey: "CREATE_USER",
        header: "Create User",
      },
      {
        accessorKey: "create_date",
        header: "Create Date",
        cell: ({ row }) => fmtDate((row.original as any).CREATE_DATE),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const val = statusOf(row.original);
          const style = getStatusBadgeStyle(val);
          return (
            <span
              className="inline-block rounded-full border px-3 py-0.5 text-xs font-bold whitespace-nowrap"
              style={{
                background: style.bg,
                color: style.color,
                borderColor: style.border,
              }}
            >
              {val || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "next_action_by",
        header: "Next Action By",
        cell: ({ row }) => (row.original as any).NEXT_ACTION_BY || "—",
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="View"
              onClick={() => handleActions("view", row.original)}
            >
              <Eye size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Edit"
              onClick={() => handleActions("edit", row.original)}
            >
              <Edit2 size={15} />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="finance-list-page grid gap-4">
      {/* Header */}
      <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Purchase Request</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Manage purchase requisition requests</p>
        </div>
        <div className="finance-list-actions">
          <Button
            variant="outline"
            size="icon"
            title="Refresh"
            aria-label="Refresh"
            onClick={handleRefresh}
          >
            <RefreshCw size={15} />
          </Button>
          <Button
            title="Add Purchase Request"
            onClick={() => void openAddPopup()}
            style={{ background: "#082A89" }}
          >
            <Plus size={15} /> Add PR
          </Button>
        </div>
      </div>

      {/* Auto-dismiss alert */}
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* Custom Tab Bar */}
      <div className="flex flex-wrap gap-2 rounded-md">
        {TAB_LABELS.map((label, index) => (
          <Button
            key={index}
            size="default"
            variant={activeTab === index ? "default" : "outline"}
            onClick={() => {
              setActiveTab(index);
              setPageIndex(0);
            }}
            className="px-6 py-2.5 min-w-[120px]"
            style={{
              fontSize: "15px",
              fontWeight: activeTab === index ? 600 : 500,
              transition: "all 0.2s ease",
              ...(activeTab === index && {
                boxShadow: "0 2px 8px rgba(8, 42, 137, 0.2)",
              })
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Data Table */}
      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={filteredRows}
          title={isLoading ? "Loading" : `${filteredRows.length.toLocaleString()} Purchase Requests`}
          subtitle="Purchase Request List"
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search request no, description, user..."
          loading={isLoading}
          emptyText="No purchase requests found"
          height={620}
          minWidth={1000}
          density="grid"
          enablePagination
          manualPagination
          enableExport
          exportFilename="purchase-requests.csv"
          initialSorting={[{ id: "request_date", desc: true }]}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={filteredRows.length}
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters) => {
            setColumnFilters(filters);
            setPageIndex(0);
          }}
          onPageChange={setPageIndex}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPageIndex(0);
          }}
          getRowId={(row, index) => row.REQUEST_NUMBER || `temp-${index}`}
        />
      </div>

      {/* ─── Approval Flow confirmation popup ─── */}
      <Dialog
        open={flowConfirm.open}
        wide
        title="Approval Flow"
        description="Select the approval flow this purchase request will follow."
        onClose={() => setFlowConfirm((prev) => ({ ...prev, open: false }))}
        footer={
          <>
            <Button variant="outline" onClick={() => setFlowConfirm((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button disabled={flowConfirm.loading || !flowConfirm.selectedFlowCode} onClick={confirmFlowAndOpenPR}>
              OK
            </Button>
          </>
        }
      >
        {flowConfirm.loading ? (
          <p className="m-0 text-sm text-muted-foreground">Loading approval flow...</p>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="w-12 px-3 py-2 text-center"></th>
                  <th className="px-3 py-2 text-left">Flow Code</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                {flowConfirm.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={3}>No approval flow found</td>
                  </tr>
                ) : flowConfirm.rows.map((row) => (
                  <tr
                    key={row.flowCode}
                    className="cursor-pointer border-t odd:bg-muted/20 hover:bg-accent"
                    onClick={() => setFlowConfirm((prev) => ({ ...prev, selectedFlowCode: row.flowCode }))}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="radio"
                        name="flow-code"
                        checked={flowConfirm.selectedFlowCode === row.flowCode}
                        onChange={() => setFlowConfirm((prev) => ({ ...prev, selectedFlowCode: row.flowCode }))}
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.flowCode}</td>
                    <td className="px-3 py-2">{row.flowDescription || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>

      {/* Add / Edit / View Dialog */}
      <Dialog
        open={taskPopup.open}
        wide
        title={taskPopup.title}
        onClose={() => closePopup()}
      >
        {taskPopup.open && (
          <AddPRRequestPage
            isEditMode={taskPopup.data.isEditMode}
            isViewMode={taskPopup.data.isViewMode}
            existingData={
              taskPopup.data.existingData
                ? { request_number: taskPopup.data.existingData.REQUEST_NUMBER }
                : undefined
            }
            flowCode={taskPopup.data.flowCode}
            flowDescription={taskPopup.data.flowDescription}
            onClose={closePopup}
          />
        )}
      </Dialog>
    </section>
  );
};

export default Purchase_Request_page;