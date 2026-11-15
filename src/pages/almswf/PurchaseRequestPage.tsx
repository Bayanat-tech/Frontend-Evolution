import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../state/AuthContext";
import { Plus, Eye, Edit2, Printer, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTableAlms";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import type { TPPOGenerated, TPurchaseSummaryTxn } from "./PurchaseSummary-types";
import AddPRRequestPage from "./Addprrequestpage";
import { almsCommonSelect } from "../../api/alms";
import { getPrRegisterFormReportExcel, getPrRegisterFormReportHtml, type Division } from "../../api/transactions";
import { DivisionPickerDialog } from "../../components/finance/DivisionPickerDialog";
import { PurchaseReportPreview } from "../purchase_sales/Reports/Purchasereportpreview";
import { openPurchaseReport } from "../purchase_sales/Reports/PurchaseReportPreviewState";
import { useToast } from "../../components/ui/AlertToast";

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_CODE3 = ["PENDING", "INPROGRESS", "REJECTED", "SENDBACK", "CLOSED", "POGENERATED", "CANCELLED"] as const;
const TAB_LABELS = ["Pending", "In Progress", "Rejected", "Sent Back", "Final Approved", "PO Generated", "Cancelled"];

const QUERY_ROOT = "purchase-request-page";

// Employees who should always see the Add PR button (per sir's instruction).
const HARDCODED_ADD_PR_EMPLOYEES = ["2019070493"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Same as fmtDate, but if the value is not parseable (e.g. API already sends
// "dd/mm/yyyy"), show the raw string instead of "NA".
function fmtDateOrRaw(val: unknown): string {
  const f = fmtDate(val);
  if (f !== "NA") return f;
  const raw = String(val ?? "").trim();
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  return raw;
}

function statusOf(row: TPurchaseSummaryTxn): string {
  const cancelFlag = String((row as any).CANCEL_FLAG ?? "").toUpperCase();
  const lastAction = String((row as any).LAST_ACTION ?? "").toUpperCase();
  if (cancelFlag === "Y" || lastAction === "CANCELED" || lastAction === "CANCELLED") return "CANCELLED";
  const finalApproved = String((row as any).FINAL_APPROVED ?? "").toUpperCase();
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
  else if (val === "SENDBACK" || val === "SENT BACK" || val === "SENTBACK") { bg = "#f3e8fe"; color = "#6b21a8"; border = "#d9b3f5"; }
  else if (val === "PO GENERATED") { bg = "#d1fae5"; color = "#065f46"; border = "#6ee7b7"; }
  else if (val === "CANCELLED" || val === "CANCELED") { bg = "#fee2e2"; color = "#991b1b"; border = "#fca5a5"; }
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
  divCode?: string;
  divName?: string;
};

type FlowRow = {
  flowCode: string;
  flowDescription: string;
  divCode: string;
  divName: string;
  userLevel: number;
};

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

// PR rows use REQUEST_NUMBER, PO Generated rows may only have PR_NUMBER.
function getRequestNo(row: any): string {
  return String(row?.REQUEST_NUMBER || row?.PR_NUMBER || "").trim();
}

// ─── Main Component ───────────────────────────────────────────────────────────
const PurchaseRequestpage = ({ initialTab = 0 }: PurchaseRequestPageProps) => {
  const { user } = useAuth();
  const loginid = (user?.loginid || user?.username || "").trim();
  const companyCode = (user?.company_code || "").trim();

  const isHardcodedAddPrUser = HARDCODED_ADD_PR_EMPLOYEES.includes(loginid);

  const { toast } = useToast();

  const handlePrint = async (requestNumber: string) => {
    if (!requestNumber) {
      toast.warning("Request number not found.", 4000);
      return;
    }

    const params = {
      loginid,
      company_code: companyCode,
      request_number: requestNumber,
    };

    const preview = openPurchaseReport(`Purchase Request - ${requestNumber}`);
    try {
      const [html, htmlPortrait] = await Promise.all([
        getPrRegisterFormReportHtml({ ...params, orientation: "landscape" }),
        getPrRegisterFormReportHtml({ ...params, orientation: "portrait" }),
      ]);
      preview.ready({
        html,
        htmlPortrait,
        filename: `purchase_request_${requestNumber}`,
        orientation: "landscape",
        onExcel: async () => {
          await getPrRegisterFormReportExcel(params);
        },
      });
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load report. Please try again.";
      preview.fail(new Error(msg));
      toast.error(msg, 5000);
    }
  };

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
      divCode: "",
      divName: "",
    },
  });

  const [flowConfirm, setFlowConfirm] = useState({
    open: false,
    loading: false,
    rows: [] as FlowRow[],
    selectedFlowCode: "",
  });

  const [divisionPicker, setDivisionPicker] = useState<{
    open: boolean;
    divisions: Division[];
    allFlows: FlowRow[];
  }>({
    open: false,
    divisions: [],
    allFlows: [],
  });

  const [flowFetching, setFlowFetching] = useState(false);

  const [pendingDivision, setPendingDivision] = useState<{ code: string; name: string }>({ code: "", name: "" });

  const activeCode3 = TAB_CODE3[activeTab] ?? TAB_CODE3[0];
  const isPoGeneratedTab = activeCode3 === "POGENERATED";
  const isPendingTab = activeCode3 === "PENDING";

  // ── Active tab data ────────────────────────────────────────────────────────
  const prQuery = useQuery({
    queryKey: [QUERY_ROOT, loginid, companyCode, activeCode3, "pr"],
    queryFn: () =>
      almsCommonSelect<TPurchaseSummaryTxn>({
        parameter: "PS_PREQUEST_ENTRY_TAB_LIST",
        loginid, code1: companyCode, code2: loginid, code3: activeCode3, code4: "",
      }),
    enabled: !!loginid && !!companyCode && !isPoGeneratedTab,
  });

  const poQuery = useQuery({
    queryKey: [QUERY_ROOT, loginid, companyCode, activeCode3, "po"],
    queryFn: () =>
      almsCommonSelect<TPPOGenerated>({
        parameter: "PS_PREQUEST_ENTRY_POGENERATED",
        loginid, code1: companyCode, code2: loginid, code3: activeCode3, code4: "",
      }),
    enabled: !!loginid && !!companyCode && isPoGeneratedTab,
  });

  const tabCountQueries = useQueries({
    queries: TAB_CODE3.map((code) => {
      const isPo = code === "POGENERATED";
      return {
        queryKey: [QUERY_ROOT, loginid, companyCode, code, isPo ? "po" : "pr"],
        queryFn: () =>
          almsCommonSelect<Record<string, unknown>>({
            parameter: isPo ? "PS_PREQUEST_ENTRY_POGENERATED" : "PS_PREQUEST_ENTRY_TAB_LIST",
            loginid, code1: companyCode, code2: loginid, code3: code, code4: "",
          }),
        enabled: !!loginid && !!companyCode,
      };
    }),
  });
  const tabCounts = tabCountQueries.map((q) => (Array.isArray(q.data) ? q.data.length : 0));


  const userFlowsQuery = useQuery({
    queryKey: [QUERY_ROOT, loginid, companyCode, "user-flows"],
    queryFn: () =>
      almsCommonSelect<Record<string, unknown>>({
        parameter: "PS_PREQUEST_ENTRY_UserFlowCode",
        loginid, code1: companyCode, code2: loginid, code3: "Admin", code4: "",
      }),
    enabled: !!loginid && !!companyCode && isPendingTab,
    staleTime: 5 * 60 * 1000,
  });

  const allUserFlows = useMemo<FlowRow[]>(() => {
    const raw = (userFlowsQuery.data as Record<string, unknown>[]) || [];
    return raw
      .map((row) => {
        const levelRaw =
          row.user_level ?? row.USER_LEVEL ?? row.userLevel ?? row.USERLEVEL ?? 0;
        const levelNum = Number(levelRaw);
        return {
          flowCode: pick(row, "FLOW_CODE", "flow_code"),
          flowDescription: pick(row, "FLOW_DESCRIPTION", "flow_description"),
          divCode: pick(row, "DIV_CODE", "div_code", "DIVISION_CODE", "division_code"),
          divName: pick(row, "DIV_NAME", "div_name", "DIVISION_NAME", "division_name"),
          userLevel: Number.isFinite(levelNum) ? levelNum : 0,
        };
      })
      .filter((r) => r.flowCode);
  }, [userFlowsQuery.data]);

  const selfFlows = useMemo(
    () => allUserFlows.filter((f) => f.userLevel === 1),
    [allUserFlows]
  );

  const canCreatePR = isHardcodedAddPrUser || selfFlows.length > 0;

  const data = isPoGeneratedTab ? poQuery.data : prQuery.data;
  const isLoading = isPoGeneratedTab ? poQuery.isLoading : prQuery.isLoading;
  const isError = isPoGeneratedTab ? poQuery.isError : prQuery.isError;
  const error = isPoGeneratedTab ? poQuery.error : prQuery.error;

  const rows = useMemo(() => data ?? [], [data]);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    if (isPoGeneratedTab) {
      return (rows as any[]).filter((row) =>
        [
          row.PO_NUMBER,
          row.PO_NOS,
          row.PR_NUMBER,
          row.REQUEST_NUMBER,
          row.SUPPLIER_CODE,
          row.SUPPLIER_NAME,
          row.PR_DESCRIPTION,
          row.DESCRIPTION,
          row.CREATE_USER,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      );
    }
    return (rows as TPurchaseSummaryTxn[]).filter((row) =>
      [
        row.REQUEST_NUMBER,
        (row as any).DESCRIPTION,
        (row as any).SUPPLIER,
        (row as any).SUPPLIER_NAME,
        (row as any).CREATE_USER,
      ]
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

  // ── Add PR: division → flow → editor ───────────────────────────────────────
  const openPrEditor = (flow: FlowRow, div: { code: string; name: string }) => {
    setTaskPopup({
      open: true,
      title: "Add PR",
      data: {
        existingData: null,
        isEditMode: false,
        isViewMode: false,
        flowCode: flow.flowCode,
        flowDescription: flow.flowDescription,
        divCode: div.code,
        divName: div.name,
      },
    });
  };

  const continueWithDivision = (div: { code: string; name: string }, allFlows: FlowRow[]) => {
    const code = div.code.trim().toUpperCase();
    const matched = code ? allFlows.filter((f) => String(f.divCode || "").trim().toUpperCase() === code) : [];
    const usable = matched.length > 0 ? matched : allFlows;

    setPendingDivision(div);

    if (usable.length === 1) {
      openPrEditor(usable[0], div);
      return;
    }
    setFlowConfirm({ open: true, loading: false, rows: usable, selectedFlowCode: "" });
  };

  const openAddPopup = async () => {
    // ── Gate ────────────────────────────────────────────────────────────────
    if (!canCreatePR) {
      setNotice({
        type: "error",
        message: "You do not have a creation-level (user_level 1) flow assigned.",
      });
      return;
    }

    if (userFlowsQuery.isLoading) {
      toast.warning("Loading your flows, please wait...", 3000);
      return;
    }

    // Usable flows for the picker:
    // - Normal path: only level-1 (self) flows
    // - Hardcoded user with no level-1 flow: fallback to all their flows
    const usableFlows: FlowRow[] =
      selfFlows.length > 0
        ? selfFlows
        : (isHardcodedAddPrUser ? allUserFlows : []);

    if (usableFlows.length === 0) {
      setNotice({ type: "error", message: "No approval flow found for this user." });
      return;
    }

    setFlowFetching(true);
    setNotice(null);
    try {
      const divisionsRaw = (await almsCommonSelect<Record<string, unknown>>({
        parameter: "PS_PREQUEST_ENTRY_DIVISION",
        loginid, code1: companyCode, code2: loginid, code3: "", code4: "",
      })) as unknown as Record<string, unknown>[];

      let divisions: Division[] = (divisionsRaw || [])
        .map((d) => ({
          div_code: pick(d, "DIV_CODE", "div_code", "DIVISION_CODE", "division_code"),
          div_name: pick(d, "DIV_NAME", "div_name", "DIVISION_NAME", "division_name"),
        }))
        .filter((d) => d.div_code) as unknown as Division[];

      if (divisions.length === 0) {
        const divMap = new Map<string, Division>();
        for (const row of usableFlows) {
          const code = (row.divCode || "").toUpperCase();
          if (code && !divMap.has(code)) {
            divMap.set(code, {
              div_code: row.divCode,
              div_name: row.divName || row.divCode,
            } as unknown as Division);
          }
        }
        divisions = Array.from(divMap.values());
      }

      // API returns div_code = null → go straight to flow picker / editor
      if (divisions.length === 0) {
        if (usableFlows.length === 1) {
          openPrEditor(usableFlows[0], { code: "", name: "" });
        } else {
          setFlowConfirm({
            open: true,
            loading: false,
            rows: usableFlows,
            selectedFlowCode: "",
          });
        }
        return;
      }

      if (divisions.length === 1) {
        const only = divisions[0] as any;
        continueWithDivision(
          { code: String(only.div_code), name: String(only.div_name || "") },
          usableFlows
        );
        return;
      }

      setDivisionPicker({ open: true, divisions, allFlows: usableFlows });
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : "Unable to determine approval flow",
      });
    } finally {
      setFlowFetching(false);
    }
  };

  const handleDivisionSelect = (division: Division) => {
    const div = {
      code: String((division as any).div_code ?? (division as any).DIV_CODE ?? "").trim(),
      name: String((division as any).div_name ?? (division as any).DIV_NAME ?? "").trim(),
    };
    const flows = divisionPicker.allFlows;
    setDivisionPicker({ open: false, divisions: [], allFlows: [] });
    continueWithDivision(div, flows);
  };

  const confirmFlowAndOpenPR = () => {
    const selected = flowConfirm.rows.find((row) => row.flowCode === flowConfirm.selectedFlowCode);
    if (!selected) return;
    setFlowConfirm((prev) => ({ ...prev, open: false }));
    openPrEditor(selected, pendingDivision);
  };

  const handleActions = (actionType: "view" | "edit", row: TPurchaseSummaryTxn) => {
    const reqNo = getRequestNo(row);
    const flowCode = (row as any).FLOW_CODE || "";
    const flowDescription = (row as any).FLOW_DESCRIPTION || "";
    // Make sure the editor always receives REQUEST_NUMBER (PO rows may only have PR_NUMBER)
    const normalizedRow = { ...(row as any), REQUEST_NUMBER: reqNo } as TPurchaseSummaryTxn;
    setTaskPopup({
      open: true,
      title: `${actionType === "edit" ? "Edit" : "View"} PR - ${reqNo}`,
      data: {
        existingData: normalizedRow,
        isEditMode: actionType === "edit",
        isViewMode: actionType === "view",
        flowCode, flowDescription,
      },
    });
  };

  const closePopup = useCallback(
    (refresh?: boolean) => {
      setTaskPopup((prev) => ({ ...prev, open: false }));
      if (refresh) {
        void queryClient.invalidateQueries({ queryKey: [QUERY_ROOT, loginid, companyCode] });
      }
    },
    [queryClient, loginid, companyCode]
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // ── Columns: PR (used by all tabs; PO tab derives from this) ──────────────
  const prColumns = useMemo<ColumnDef<TPurchaseSummaryTxn>[]>(
    () => [
      {
        id: "REQUEST_NUMBER",
        accessorFn: (row) => getRequestNo(row),
        header: "Request No",
        cell: ({ row }) => (
          <span className="font-semibold text-[#082A89]">
            {getRequestNo(row.original) || "—"}
          </span>
        ),
      },
      {
        id: "REQUEST_DATE",
        accessorFn: (row) => (row as any).REQUEST_DATE ?? (row as any).PR_DATE ?? "",
        header: "Request Date",
        cell: ({ row }) => {
          const r = row.original as any;
          return fmtDateOrRaw(r.REQUEST_DATE ?? r.PR_DATE);
        },
      },
      {
        id: "DESCRIPTION",
        accessorFn: (row) => (row as any).DESCRIPTION || (row as any).PR_DESCRIPTION || "",
        header: "Description",
        cell: ({ row }) => {
          const r = row.original as any;
          return r.DESCRIPTION || r.PR_DESCRIPTION || "—";
        },
      },
      {
        accessorKey: "AMOUNT",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
          const r = row.original as any;
          const amt = r.TOTAL_WITH_TAX ?? r.total_with_tax ?? r.AMOUNT ?? 0;
          return (
            <div className="text-right font-semibold">
              {Number(amt).toLocaleString(undefined, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}
            </div>
          );
        },
      },
      {
        accessorKey: "CREATE_USER",
        header: "Create User",
        cell: ({ row }) => {
          const r = row.original as any;
          const code = r.CREATE_USER || r.create_user || "";
          if (!code) return "—";
          const name =
            r.CREATE_USER_NAME ||
            r.create_user_name ||
            r.CREATE_USERNAME ||
            r.CREATED_BY_NAME ||
            r.CREATE_BY_NAME ||
            r.USER_NAME ||
            r.CREATE_USER_DESC ||
            "";
          return name ? `${code} - ${name}` : code;
        },
      },
      {
        accessorKey: "CREATE_DATE",
        header: "Create Date",
        cell: ({ row }) => fmtDateOrRaw((row.original as any).CREATE_DATE),
      },
      {
        id: "status",
        accessorFn: (row) => (isPoGeneratedTab ? "PO GENERATED" : statusOf(row)),
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const val = isPoGeneratedTab ? "PO GENERATED" : statusOf(row.original);
          const style = getStatusBadgeStyle(val);
          return (
            <div className="flex justify-center">
              <span
                className="inline-block whitespace-nowrap rounded-full border px-3 py-0.5 text-xs font-bold"
                style={{ background: style.bg, color: style.color, borderColor: style.border }}
              >
                {val || "—"}
              </span>
            </div>
          );
        },
      },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (row) => {
          const r = row as any;
          return String(
            r.SENTBACK_REASON || r.sentback_reason || r.LAST_SB_REASON ||
            r.REJECT_REASON || r.reject_reason ||
            r.CANCEL_REMARK || r.cancel_remark ||
            r.REASON || ""
          );
        },
        cell: ({ row }) => {
          const r = row.original as any;
          const sbReason = String(
            r.SENTBACK_REASON || r.sentback_reason || r.LAST_SB_REASON || ""
          ).trim();
          const sbBy = String(r.LAST_SB_BY_NAME || "").trim();
          const otherReason = String(
            r.REJECT_REASON || r.reject_reason ||
            r.CANCEL_REMARK || r.cancel_remark ||
            r.REASON || ""
          ).trim();

          const text = sbReason || otherReason;
          if (!text) return "—";
          const showBy = !!sbReason && !!sbBy;
          return (
            <div
              className="flex max-w-[280px] flex-col leading-tight"
              title={showBy ? `${text} (Sent back by ${sbBy})` : text}
            >
              <span className="truncate">{text}</span>
              {showBy && (
                <span className="truncate text-[10px] font-semibold text-purple-700">
                  Sent back by: {sbBy}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "next_action_by",
        header: "Next Action By",
        accessorFn: (row) => {
          const r = row as any;
          const isDraft = String(r.LAST_ACTION || "").toUpperCase() === "SAVEASDRAFT";
          return String(isDraft ? (r.USER_ID || r.user_id || "") : (r.NEXT_ACTION_BY || r.next_action_by || ""));
        },
        cell: ({ row }) => {
          const r = row.original as any;
          const isDraft = String(r.LAST_ACTION || "").toUpperCase() === "SAVEASDRAFT";

          const code = isDraft
            ? (r.USER_ID || r.user_id || "")
            : (r.NEXT_ACTION_BY || r.next_action_by || "");
          if (!code) return "—";
          const name = isDraft
            ? (r.DRAFT_USER_NAME || r.draft_user_name || "")
            : (r.NEXT_ACTION_BY_NAME || r.next_action_by_name || "");
          return name ? `${code} - ${name}` : code;
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original as any;
          const finalApprovedFlag = String(r.FINAL_APPROVED || "").toUpperCase() === "Y";
          const faUploaded = String(r.FA_UPLOADED || "N").toUpperCase();
          // Final approved but PO not generated yet (FA_UPLOADED = 'N') => still editable.
          // Locked only when final approved AND FA_UPLOADED is not 'N'.
          const isFinalApproved = finalApprovedFlag && faUploaded !== "N";
          const isCancelled =
            String(r.CANCEL_FLAG || "").toUpperCase() === "Y" ||
            String(r.LAST_ACTION || "").toUpperCase() === "CANCELED" ||
            String(r.LAST_ACTION || "").toUpperCase() === "CANCELLED";
          const requestNo = getRequestNo(r);

          return (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" title="View" onClick={() => handleActions("view", row.original)}>
                <Eye size={15} />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                title="Print"
                onClick={() => void handlePrint(requestNo)}
                disabled={!requestNo}
              >
                <Printer size={15} />
              </Button>

              {isPendingTab && (
                <Button
                  size="icon"
                  variant="ghost"
                  title={isFinalApproved ? "Approved — cannot edit" : isCancelled ? "Cancelled — cannot edit" : "Edit"}
                  onClick={() => handleActions("edit", row.original)}
                  disabled={isFinalApproved || isCancelled}
                >
                  <Edit2 size={15} />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPendingTab, isPoGeneratedTab, loginid, companyCode]
  );

  // ── Columns: PO Generated ──────────────────────────────────────────────────
  // Same columns as the other tabs, minus Reason / Next Action By,
  // plus PO Number & PO Date placed after Status, and Actions at the end.
  const poColumns = useMemo<ColumnDef<any>[]>(() => {
    const all = prColumns as ColumnDef<any>[];
    const base = all.filter(
      (c) => !["reason", "next_action_by", "actions"].includes(String(c.id ?? ""))
    );
    const actionsCol = all.find((c) => c.id === "actions");

    const poExtra: ColumnDef<any>[] = [
      {
        id: "PO_NUMBER",
        // PO tab API returns PR.* from TTE_PREQUEST_HDR, where the PO numbers live in PO_NOS
        accessorFn: (row) => (row as any).PO_NUMBER || (row as any).PO_NOS || "",
        header: "PO Number",
        cell: ({ row }) => (
          <span className="font-semibold text-[#082A89]">
            {(row.original as any).PO_NUMBER || (row.original as any).PO_NOS || "—"}
          </span>
        ),
      },
      {
        accessorKey: "PO_DATE",
        header: "PO Date",
        cell: ({ row }) => fmtDateOrRaw((row.original as any).PO_DATE),
      },
    ];

    return [...base, ...poExtra, ...(actionsCol ? [actionsCol] : [])];
  }, [prColumns]);

  const columns = isPoGeneratedTab ? poColumns : prColumns;

  // ── Full-page editor ───────────────────────────────────────────────────────
  if (taskPopup.open) {
    return (
      <AddPRRequestPage
        isEditMode={taskPopup.data.isEditMode}
        isViewMode={taskPopup.data.isViewMode}
        existingData={
          taskPopup.data.existingData
            ? { request_number: getRequestNo(taskPopup.data.existingData) }
            : undefined
        }
        flowCode={taskPopup.data.flowCode}
        flowDescription={taskPopup.data.flowDescription}
        divCode={taskPopup.data.divCode}
        divName={taskPopup.data.divName}
        docType={taskPopup.data.docType}
        docNo={taskPopup.data.docNo}
        onClose={closePopup}
      />
    );
  }

  // ── List page ──────────────────────────────────────────────────────────────
  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-title">
        <h6 className="m-0 text-xl font-semibold tracking-tight">Purchase Request</h6>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />


      <div
        style={{
          display: "flex", alignItems: "flex-end", gap: "4px",
          padding: "3px 7px 0 8px", overflowX: "auto",
          background: "#f1f5f9",
          border: "1px solid #e2e8f0",
          borderBottom: "1px solid #cbd5e1",
          borderRadius: "10px",
        }}
      >
        {TAB_LABELS.map((label, index) => {
          const active = activeTab === index;
          return (
            <button
              key={TAB_CODE3[index]}
              type="button"
              onClick={() => {
                setActiveTab(index);
                setPageIndex(0);
                setQuery("");
              }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "10px 16px", fontSize: "12.5px",
                fontWeight: active ? 700 : 500,
                color: active ? "#082A89" : "#475569",
                background: active ? "#e8f0ff" : "transparent",
                border: "none",
                borderBottom: active ? "2px solid #082A89" : "2px solid transparent",
                borderRadius: "10px 10px 0 0",
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#e8eef7"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span>{label}</span>
              <span
                style={{
                  minWidth: "20px", padding: "1px 7px", borderRadius: "999px",
                  fontSize: "11px", fontWeight: 700, textAlign: "center",
                  background: active ? "#082A89" : "#cbd5e1",
                  color: active ? "#fff" : "#334155",
                }}
              >
                {tabCounts[index] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[650px]">
        <DataTable
          columns={columns as ColumnDef<any, unknown>[]}
          data={filteredRows}

          subtitle={
            isPendingTab && canCreatePR ? (
              <button
                type="button"
                onClick={() => void openAddPopup()}
                disabled={flowFetching || userFlowsQuery.isLoading}
                title="Add Purchase Request"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
              >
                {flowFetching || userFlowsQuery.isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {flowFetching || userFlowsQuery.isLoading ? "Loading..." : "Add PR"}
              </button>
            ) : undefined
          }
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder={
            isPoGeneratedTab ? "Search PO number, PR number, supplier..." : "Search request no, description, user..."
          }
          loading={isLoading}
          emptyText={isPoGeneratedTab ? "No purchase orders generated yet" : "No purchase requests found"}
          height={620}
          minWidth={1000}
          density="grid"
          enablePagination
          manualPagination
          enableExport
          exportFilename={isPoGeneratedTab ? "purchase-orders.csv" : "purchase-requests.csv"}
          initialSorting={[{ id: isPoGeneratedTab ? "PO_DATE" : "REQUEST_DATE", desc: true }]}
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
          getRowId={(row: any, index) => row.PO_NUMBER || row.REQUEST_NUMBER || row.PR_NUMBER || `temp-${index}`}
        />
      </div>

      <DivisionPickerDialog
        open={divisionPicker.open}
        divisions={divisionPicker.divisions}
        onSelect={handleDivisionSelect}
        onClose={() => setDivisionPicker({ open: false, divisions: [], allFlows: [] })}
        title="Select Division"
      />

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
                <th className="whitespace-nowrap px-2 py-1.5 text-left">Flow Code</th>
                <th className="whitespace-nowrap px-2 py-1.5 text-left">Description</th>
                <th className="whitespace-nowrap px-2 py-1.5 text-left">Division</th>
              </tr>
            </thead>
            <tbody>
              {flowConfirm.rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-muted-foreground" colSpan={4}>No approval flow found</td>
                </tr>
              ) : (
                flowConfirm.rows.map((row) => (
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
                    <td className="whitespace-nowrap px-2 py-1.5 font-semibold">{row.flowCode}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{row.flowDescription || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {row.divCode ? (
                        <span className="inline-block whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                          {row.divCode} {row.divName ? `- ${row.divName}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Dialog>

      <PurchaseReportPreview />
    </section>
  );
};

export default PurchaseRequestpage;