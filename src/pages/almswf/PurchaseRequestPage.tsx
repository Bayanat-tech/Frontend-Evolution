import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../state/AuthContext";
import { Plus, Eye, Edit2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTableAlms";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import type { TPPOGenerated, TPurchaseSummaryTxn } from "./PurchaseSummary-types";
import AddPRRequestPage from "./Addprrequestpage";
import { almsCommonSelect } from "../../api/alms";
import type { Division } from "../../api/transactions";
import { DivisionPickerDialog } from "../../components/finance/DivisionPickerDialog";

const TAB_CODE3 = ["PENDING", "INPROGRESS", "REJECTED", "SENDBACK", "CLOSED", "POGENERATED"] as const;
const TAB_LABELS = ["Pending", "In Progress", "Rejected", "Sent Back", "Final Approved", "Po Generated"];

function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

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

interface PurchaseRequestPageProps {
  initialTab?: number;
}

type TaskPopupData = {
  existingData: TPurchaseSummaryTxn | null;
  isEditMode: boolean;
  isViewMode: boolean;
  flowCode: string;
  flowDescription: string;
  docType?: string;
  docNo?: string;
};

type FlowRow = { flowCode: string; flowDescription: string; divCode: string; divName: string };

/**
 * Safe value picker — tries multiple key casings and returns first non-empty.
 */
function pick(obj: any, ...keys: string[]): string {
  if (!obj) return "";
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

const PurchaseRequestpage = ({ initialTab = 0 }: PurchaseRequestPageProps) => {
  const { user } = useAuth();
  const loginid = (user?.loginid || user?.username || "").trim();
  const companyCode = (user?.company_code || "").trim();

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [taskPopup, setTaskPopup] = useState<{
    open: boolean;
    title: string;
    data: TaskPopupData;
  }>({
    open: false,
    title: "",
    data: {
      existingData: null,
      isEditMode: false,
      isViewMode: false,
      flowCode: "",
      flowDescription: "",
    },
  });

  const [flowConfirm, setFlowConfirm] = useState({
    open: false,
    loading: false,
    rows: [] as FlowRow[],
    selectedFlowCode: "",
  });

  // ── Division picker state ──────────────────────────────────────────────
  const [divisionPicker, setDivisionPicker] = useState<{
    open: boolean;
    divisions: Division[];
    allFlows: FlowRow[];
  }>({
    open: false,
    divisions: [],
    allFlows: [],
  });

  // ── NEW: loading flag for Add PR button (avoid flicker dialog) ────────
  const [flowFetching, setFlowFetching] = useState(false);

  const activeCode3 = TAB_CODE3[activeTab];
  const isPoGeneratedTab = activeCode3 === "POGENERATED";
  const isPendingTab = activeCode3 === "PENDING";

  const prQuery = useQuery({
    queryKey: ["purchase-request-page", loginid, companyCode, activeCode3, "pr"],
    queryFn: () => almsCommonSelect<TPurchaseSummaryTxn>({
      parameter: "PS_PREQUEST_ENTRY_TAB_LIST",
      loginid, code1: companyCode, code2: loginid, code3: activeCode3, code4: "",
    }),
    enabled: !!loginid && !!companyCode && !isPoGeneratedTab,
  });

  const poQuery = useQuery({
    queryKey: ["purchase-request-page", loginid, companyCode, activeCode3, "po"],
    queryFn: () => almsCommonSelect<TPPOGenerated>({
      parameter: "PS_PREQUEST_ENTRY_POGENERATED",
      loginid, code1: companyCode, code2: loginid, code3: activeCode3, code4: "",
    }),
    enabled: !!loginid && !!companyCode && isPoGeneratedTab,
  });

  const data = isPoGeneratedTab ? poQuery.data : prQuery.data;
  const isLoading = isPoGeneratedTab ? poQuery.isLoading : prQuery.isLoading;
  const isError = isPoGeneratedTab ? poQuery.isError : prQuery.isError;
  const error = isPoGeneratedTab ? poQuery.error : prQuery.error;

  const rows = useMemo(() => data ?? [], [data]);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    if (isPoGeneratedTab) {
      return (rows as TPPOGenerated[]).filter((row) =>
        [row.PO_NUMBER, row.PR_NUMBER, row.SUPPLIER_CODE, row.SUPPLIER_NAME, row.PR_DESCRIPTION]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      );
    }
    return (rows as TPurchaseSummaryTxn[]).filter((row) =>
      [row.REQUEST_NUMBER, (row as any).DESCRIPTION, (row as any).SUPPLIER, (row as any).SUPPLIER_NAME]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [rows, query, isPoGeneratedTab]);

  useEffect(() => {
    if (isError) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load purchase requests",
      });
    }
  }, [isError, error]);

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ Open Add PR — NO dialog flicker.
  //    Fetch karte waqt sirf button pe spinner. Data ready hone pe hi
  //    DivisionPickerDialog open hoga.
  // ═══════════════════════════════════════════════════════════════════════
  const openAddPopup = async () => {
    setFlowFetching(true);
    setNotice(null);

    try {
      const rawRows = (await almsCommonSelect<Record<string, unknown>>({
        parameter: "PS_PREQUEST_ENTRY_UserFlowCode",
        loginid, code1: companyCode, code2: loginid, code3: "Admin", code4: "",
      })) as unknown as Record<string, unknown>[];

      const divisionsRaw = (await almsCommonSelect<Record<string, unknown>>({
        parameter: "PS_PREQUEST_ENTRY_DIVISION",
        loginid, code1: companyCode, code2: loginid, code3: "", code4: "",
      })) as unknown as Record<string, unknown>[];

      // 🐞 DEBUG
      console.log("[DivisionPicker] rawRows:", rawRows);
      console.log("[DivisionPicker] divisionsRaw:", divisionsRaw);

      const flowRows: FlowRow[] = (rawRows || [])
        .map((row) => {
          const flowCode = pick(row, "FLOW_CODE", "flow_code");
          const flowDivCode = pick(
            row,
            "DIV_CODE", "div_code",
            "DIVISION_CODE", "division_code"
          );
          const inlineDivName = pick(
            row,
            "DIV_NAME", "div_name",
            "DIVISION_NAME", "division_name"
          );

          const div = (divisionsRaw || []).find((d) => {
            const dCode = pick(d, "DIV_CODE", "div_code", "DIVISION_CODE", "division_code");
            return dCode && dCode.toUpperCase() === flowDivCode.toUpperCase();
          });

          const divName =
            (div && pick(div, "DIV_NAME", "div_name", "DIVISION_NAME", "division_name")) ||
            inlineDivName ||
            flowDivCode;

          return {
            flowCode,
            flowDescription: pick(row, "FLOW_DESCRIPTION", "flow_description"),
            divCode: flowDivCode,
            divName,
          };
        })
        .filter((r) => r.flowCode);

      console.log("[DivisionPicker] normalized flowRows:", flowRows);

      if (flowRows.length === 0) {
        setNotice({ type: "error", message: "No approval flow found for this user." });
        return;
      }

      // Unique divisions
      const divMap = new Map<string, Division>();
      for (const row of flowRows) {
        const code = (row.divCode || "__NO_DIV__").toUpperCase();
        if (!divMap.has(code)) {
          divMap.set(code, {
            div_code: row.divCode || "—",
            div_name: row.divName || row.divCode || "—",
          } as unknown as Division);
        }
      }
      const uniqueDivisions = Array.from(divMap.values());

      console.log("[DivisionPicker] uniqueDivisions:", uniqueDivisions);

      // ✅ Data ready — ab picker kholo (pehle kuch nahi khulna chahiye)
      setDivisionPicker({
        open: true,
        divisions: uniqueDivisions,
        allFlows: flowRows,
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to determine approval flow",
      });
    } finally {
      setFlowFetching(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ Division select → filter flows → next step
  // ═══════════════════════════════════════════════════════════════════════
  const handleDivisionSelect = (division: Division) => {
    const selectedCode = String(
      (division as any).div_code ?? (division as any).DIV_CODE ?? ""
    ).trim().toUpperCase();

    console.log("[DivisionPicker] selected:", division, "→ normalized code:", selectedCode);
    console.log("[DivisionPicker] allFlows:", divisionPicker.allFlows);

    const filteredFlows = divisionPicker.allFlows.filter((f) => {
      const c = String(f.divCode || "").trim().toUpperCase();
      if (selectedCode === "__NO_DIV__" || selectedCode === "—") return !c;
      return c === selectedCode;
    });

    console.log("[DivisionPicker] filteredFlows:", filteredFlows);

    setDivisionPicker({ open: false, divisions: [], allFlows: [] });

    if (filteredFlows.length === 0) {
      // Fallback: strict match fail → sab flows dikha do
      if (divisionPicker.allFlows.length > 0) {
        setFlowConfirm({
          open: true,
          loading: false,
          rows: divisionPicker.allFlows,
          selectedFlowCode:
            divisionPicker.allFlows.length === 1
              ? divisionPicker.allFlows[0].flowCode
              : "",
        });
        return;
      }
      setNotice({ type: "error", message: "No approval flow found for selected division." });
      return;
    }

    // Single flow → direct editor
    if (filteredFlows.length === 1) {
      const selected = filteredFlows[0];
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
      return;
    }

    // Multiple flows → flow confirm dialog
    setFlowConfirm({
      open: true,
      loading: false,
      rows: filteredFlows,
      selectedFlowCode: "",
    });
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
    const flowCode = (row as any).FLOW_CODE || "";
    const flowDescription = (row as any).FLOW_DESCRIPTION || "";
    setTaskPopup({
      open: true,
      title: `${actionType === "edit" ? "Edit" : "View"} PR - ${row.REQUEST_NUMBER}`,
      data: {
        existingData: row,
        isEditMode: actionType === "edit",
        isViewMode: actionType === "view",
        flowCode, flowDescription,
      },
    });
  };

  const closePopup = useCallback((refresh?: boolean) => {
    setTaskPopup((prev) => ({ ...prev, open: false }));
    if (refresh) {
      const queryKey = isPoGeneratedTab
        ? ["purchase-request-page", loginid, companyCode, activeCode3, "po"]
        : ["purchase-request-page", loginid, companyCode, activeCode3, "pr"];
      queryClient.refetchQueries({ queryKey, type: "active" });
    }
  }, [queryClient, loginid, companyCode, activeCode3, isPoGeneratedTab]);

  const handleSavedDraft = useCallback((savedRequestNumber: string) => {
    setTaskPopup((prev) => {
      if (!prev.data.existingData && savedRequestNumber) {
        const syntheticRow = {
          REQUEST_NUMBER: savedRequestNumber,
          FLOW_CODE: prev.data.flowCode,
          FLOW_DESCRIPTION: prev.data.flowDescription,
        } as unknown as TPurchaseSummaryTxn;
        return {
          ...prev,
          title: `Edit PR - ${savedRequestNumber}`,
          data: { ...prev.data, existingData: syntheticRow },
        };
      }
      return prev;
    });
  }, []);

  const prColumns = useMemo<ColumnDef<TPurchaseSummaryTxn>[]>(
    () => [
      {
        accessorKey: "REQUEST_NO",
        header: "Request No",
        cell: ({ row }) => (
          <span className="font-semibold text-[#082A89]">{row.original.REQUEST_NUMBER}</span>
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
      { accessorKey: "CREATE_USER", header: "Create User" },
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
              style={{ background: style.bg, color: style.color, borderColor: style.border }}
            >
              {val || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "sentback_reason",
        header: "Reason",
        cell: ({ row }) => {
          const r = row.original as any;
          return (
            r.SENTBACK_REASON || r.sentback_reason ||
            r.REJECT_REASON || r.reject_reason ||
            r.REASON || "—"
          );
        },
      },
      {
        accessorKey: "next_action_by",
        header: "Next Action By",
        cell: ({ row }) => {
          const r = row.original as any;
          if (!r.NEXT_ACTION_BY) return "—";
          return r.NEXT_ACTION_BY_NAME
            ? `${r.NEXT_ACTION_BY} - ${r.NEXT_ACTION_BY_NAME}`
            : r.NEXT_ACTION_BY;
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const isFinalApproved = String((row.original as any).FINAL_APPROVED || "").toUpperCase() === "Y";
          return (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" title="View" onClick={() => handleActions("view", row.original)}>
                <Eye size={15} />
              </Button>
              {isPendingTab && (
                <Button
                  size="icon" variant="ghost"
                  title={isFinalApproved ? "Approved — cannot edit" : "Edit"}
                  onClick={() => handleActions("edit", row.original)}
                  disabled={isFinalApproved}
                >
                  <Edit2 size={15} />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [isPendingTab]
  );

  const poColumns = useMemo<ColumnDef<TPPOGenerated>[]>(
    () => [
      {
        accessorKey: "PO_NUMBER",
        header: "PO Number",
        cell: ({ row }) => (
          <span className="font-semibold text-[#082A89]">{row.original.PO_NUMBER}</span>
        ),
      },
      { accessorKey: "PO_DATE", header: "PO Date", cell: ({ row }) => row.original.PO_DATE || "NA" },
      {
        accessorKey: "SUPPLIER_CODE",
        header: "Supplier",
        cell: ({ row }) => {
          const r = row.original;
          if (r.SUPPLIER_CODE && r.SUPPLIER_NAME) return `${r.SUPPLIER_CODE} - ${r.SUPPLIER_NAME}`;
          if (r.SUPPLIER_CODE) return r.SUPPLIER_CODE;
          return "—";
        },
      },
      {
        accessorKey: "PR_NUMBER",
        header: "PR Number",
        cell: ({ row }) => (
          <span className="font-medium text-blue-600">{row.original.PR_NUMBER || "—"}</span>
        ),
      },
      { accessorKey: "PR_DATE", header: "PR Date", cell: ({ row }) => row.original.PR_DATE || "NA" },
      {
        accessorKey: "PR_DESCRIPTION",
        header: "PR Description",
        cell: ({ row }) => row.original.PR_DESCRIPTION || "—",
      },
    ],
    []
  );

  const columns = isPoGeneratedTab ? poColumns : prColumns;

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ Full-page PR editor — sidebar visible
  // ═══════════════════════════════════════════════════════════════════════
  if (taskPopup.open) {
    return (
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
        docType={taskPopup.data.docType}
        docNo={taskPopup.data.docNo}
        onClose={closePopup}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIST PAGE
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Purchase Request</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Manage purchase requisition requests</p>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-wrap gap-2 rounded-md">
        {TAB_LABELS.map((label, index) => (
          <Button
            key={index}
            size="default"
            variant={activeTab === index ? "default" : "outline"}
            onClick={() => { setActiveTab(index); setPageIndex(0); }}
            className="px-6 py-2.5 min-w-[120px]"
            style={{
              fontSize: "15px",
              fontWeight: activeTab === index ? 600 : 500,
              transition: "all 0.2s ease",
              ...(activeTab === index && { boxShadow: "0 2px 8px rgba(8, 42, 137, 0.2)" }),
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="min-h-[650px]">
        <DataTable
          columns={columns as ColumnDef<any, unknown>[]}
          data={filteredRows}
          title={isLoading ? "Loading" : `${filteredRows.length.toLocaleString()} ${isPoGeneratedTab ? "Purchase Orders" : "Purchase Requests"}`}
          subtitle={
            isPoGeneratedTab ? (
              <span className="text-sm text-muted-foreground">Generated PO List</span>
            ) : (
              <button
                type="button"
                onClick={() => void openAddPopup()}
                disabled={flowFetching}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-semibold text-white cursor-pointer transition-colors hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                style={{ background: "#082A89" }}
                title="Add Purchase Request"
              >
                {flowFetching ? (
                  <>
                    <svg
                      className="animate-spin"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
                      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <Plus size={10} />
                    Add PR
                  </>
                )}
              </button>
            )
          }
          searchValue={query}
          onSearchChange={(value) => { setQuery(value); setPageIndex(0); }}
          searchPlaceholder={isPoGeneratedTab ? "Search PO number, PR number, supplier..." : "Search request no, description, user..."}
          loading={isLoading}
          emptyText={isPoGeneratedTab ? "No purchase orders generated yet" : "No purchase requests found"}
          height={620}
          minWidth={1000}
          density="grid"
          enablePagination
          manualPagination
          enableExport
          exportFilename={isPoGeneratedTab ? "purchase-orders.csv" : "purchase-requests.csv"}
          initialSorting={[{ id: isPoGeneratedTab ? "PO_DATE" : "request_date", desc: true }]}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={filteredRows.length}
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters) => { setColumnFilters(filters); setPageIndex(0); }}
          onPageChange={setPageIndex}
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPageIndex(0); }}
          getRowId={(row: any, index) => row.REQUEST_NUMBER || row.PO_NUMBER || `temp-${index}`}
        />
      </div>

      {/* ── Division Picker Dialog ─────────────────────────────────── */}
      <DivisionPickerDialog
        open={divisionPicker.open}
        divisions={divisionPicker.divisions}
        onSelect={handleDivisionSelect}
        onClose={() => setDivisionPicker({ open: false, divisions: [], allFlows: [] })}
        title="Select Division"
      />

      {/* Approval Flow Dialog — NO loading branch (flicker-proof) */}
      <Dialog
        open={flowConfirm.open}
        wide={false}
        title="Select Approval Flow"
        description="Choose the approval flow for this purchase request"
        onClose={() => setFlowConfirm((prev) => ({ ...prev, open: false }))}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setFlowConfirm((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button disabled={!flowConfirm.selectedFlowCode} size="sm" onClick={confirmFlowAndOpenPR}>
              OK
            </Button>
          </>
        }
      >
        <div className="max-h-[320px] overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-1.5 text-center"></th>
                <th className="px-2 py-1.5 text-left whitespace-nowrap">Flow Code</th>
                <th className="px-2 py-1.5 text-left whitespace-nowrap">Description</th>
                <th className="px-2 py-1.5 text-left whitespace-nowrap">Division</th>
              </tr>
            </thead>
            <tbody>
              {flowConfirm.rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-muted-foreground" colSpan={4}>No approval flow found</td>
                </tr>
              ) : flowConfirm.rows.map((row) => (
                <tr
                  key={row.flowCode}
                  className="cursor-pointer border-t odd:bg-muted/20 hover:bg-accent"
                  onClick={() => setFlowConfirm((prev) => ({ ...prev, selectedFlowCode: row.flowCode }))}
                >
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="radio"
                      name="flow-code"
                      className="h-3 w-3"
                      checked={flowConfirm.selectedFlowCode === row.flowCode}
                      onChange={() => setFlowConfirm((prev) => ({ ...prev, selectedFlowCode: row.flowCode }))}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{row.flowCode}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{row.flowDescription || "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.divCode ? (
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 whitespace-nowrap">
                        {row.divCode} {row.divName ? `- ${row.divName}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
    </section>
  );
};

export default PurchaseRequestpage;