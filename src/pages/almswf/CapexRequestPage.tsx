// src/pages/almswf/Capex_Request_page.tsx
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../state/AuthContext";
import { Plus, Eye } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import type { ColumnDef } from "@tanstack/react-table";
import type { TPurchaseSummaryTxn } from "./PurchaseSummary-types";
import AddCPRequestPage from "./AddCPRequestPage";
import { almsCommonSelect } from "../../api/alms";

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_STATUS = ["PENDING", "IN PROGRESS", "REJECTED", "SENT BACK", "APPROVED", "PO GENERATED"] as const;
const TAB_LABELS = ["Pending", "In Progress", "Rejected", "Sent Back", "Final Approved", "Po Generated"] as const;

const STATUS_MATCH: Record<(typeof TAB_STATUS)[number], string[]> = {
  PENDING: ["PENDING"],
  "IN PROGRESS": ["IN PROGRESS"],
  REJECTED: ["REJECTED"],
  "SENT BACK": ["SENT BACK"],
  APPROVED: ["APPROVED", "A/C POSTED"],
  "PO GENERATED": ["PO GENERATED"],
};

// Tab values madhe space aahe ("IN PROGRESS", "SENT BACK"), mhanun donhi forms ithe
const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-blue-50 text-blue-800 border-blue-200",
  "A/C POSTED": "bg-blue-50 text-blue-800 border-blue-200",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  "IN PROGRESS": "bg-blue-100 text-blue-800 border-blue-300",
  INPROGRESS: "bg-blue-100 text-blue-800 border-blue-300",
  REJECTED: "bg-red-50 text-red-800 border-red-200",
  "SENT BACK": "bg-purple-50 text-purple-800 border-purple-200",
  SENTBACK: "bg-purple-50 text-purple-800 border-purple-200",
  "PO GENERATED": "bg-emerald-100 text-emerald-800 border-emerald-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function statusOf(row: TPurchaseSummaryTxn): string {
  return String((row as any).PURCH_STATUS ?? (row as any).purch_status ?? "").toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CapexRequestPageProps {
  initialTab?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Capex_Request_page = ({ initialTab = 0 }: CapexRequestPageProps) => {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const queryClient = useQueryClient();

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(initialTab);
  const statusFilter = TAB_STATUS[activeTab] ?? TAB_STATUS[0];
  const [query, setQuery] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // ── Popup state (Add / View) ────────────────────────────────────────────────
  const [taskPopup, setTaskPopup] = useState({
    open: false,
    title: "",
    data: {
      existingData: null as TPurchaseSummaryTxn | null,
      isEditMode: false,
      isViewMode: false,
    },
  });

  // ── Fetch (VW_CP_PAGE view — CP records only) ───────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["capex-request-page", loginid, companyCode],
    queryFn: () =>
      almsCommonSelect<TPurchaseSummaryTxn>({
        parameter: "Amlspf_VW_CP_PAGE",
        loginid,
        code1: companyCode,
        code2: "", // blank = fetch all CP records for this company; backend should NVL/skip filter when blank
      }),
    enabled: !!loginid && !!companyCode,
  });

  const rows = useMemo(() => data ?? [], [data]);

  // ── Tab counts (saglach data already fetch aahe, mhanun client-side) ──────
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TAB_STATUS.forEach((t) => {
      const allowed = STATUS_MATCH[t];
      counts[t] = rows.filter((row) => allowed.includes(statusOf(row))).length;
    });
    return counts;
  }, [rows]);

  // ── Client-side status filter ──────────────────────────────────────────────
  const statusFilteredRows = useMemo(() => {
    const allowed = STATUS_MATCH[statusFilter];
    return rows.filter((row) => allowed.includes(statusOf(row)));
  }, [rows, statusFilter]);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return statusFilteredRows;
    const q = query.toLowerCase();
    return statusFilteredRows.filter((row) =>
      [row.REQUEST_NUMBER, (row as any).DESCRIPTION, (row as any).CREATE_USER, (row as any).PURCH_STATUS]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [statusFilteredRows, query]);

  // ── Notice (error ani success ek-ch jagi) ───────────────────────────────────
  const notice = useMemo(() => {
    if (successNotice) return { type: "success" as const, message: successNotice };
    if (isError && !errorDismissed) {
      return {
        type: "error" as const,
        message: error instanceof Error ? error.message : "Failed to load capex requests",
      };
    }
    return null;
  }, [successNotice, isError, errorDismissed, error]);

  const closeNotice = () => {
    setSuccessNotice(null);
    setErrorDismissed(true);
  };

  // ── Popup handlers ──────────────────────────────────────────────────────────
  const openAddPopup = () => {
    setTaskPopup({
      open: true,
      title: "Add CP",
      data: { existingData: null, isEditMode: false, isViewMode: false },
    });
  };

  const openView = (row: TPurchaseSummaryTxn) => {
    setTaskPopup({
      open: true,
      title: `View CP - ${row.REQUEST_NUMBER}`,
      data: { existingData: row, isEditMode: false, isViewMode: true },
    });
  };

  const closePopup = (refresh?: boolean, message?: string) => {
    setTaskPopup((prev) => ({ ...prev, open: false }));
    if (refresh) {
      setErrorDismissed(false);
      void queryClient.invalidateQueries({ queryKey: ["capex-request-page", loginid, companyCode] });
      if (message) setSuccessNotice(message);
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────────
  // Data keys UPPERCASE aahet, mhanun accessorKey pan UPPERCASE (sort / filter sathi)
  const columns = useMemo<ColumnDef<TPurchaseSummaryTxn>[]>(
    () => [
      {
        accessorKey: "REQUEST_NUMBER",
        header: "Request No",
        size: 150,
        cell: ({ row }) => <span className="text-xs font-semibold text-[#082A89]">{row.original.REQUEST_NUMBER}</span>,
      },
      { accessorKey: "REQUEST_DATE", header: "Request Date", size: 120, cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "DESCRIPTION", header: "Description", size: 400, cell: ({ getValue }) => String(getValue() || "—") },
      {
        accessorKey: "AMOUNT",
        header: () => <div className="text-right">Amount</div>,
        size: 120,
        cell: ({ getValue }) => <div className="text-right font-semibold">{Number(getValue() || 0).toLocaleString()}</div>,
      },
      { accessorKey: "CREATE_USER", header: "Create User", size: 120 },
      { accessorKey: "CREATE_DATE", header: "Create Date", size: 120, cell: ({ getValue }) => fmtDate(getValue()) },
      {
        id: "PURCH_STATUS",
        accessorFn: (row) => statusOf(row),
        header: () => <div className="text-center">Status</div>,
        size: 140,
        cell: ({ row }) => {
          const val = statusOf(row.original);
          const style = STATUS_STYLES[val] ?? "bg-zinc-100 text-zinc-600 border-zinc-300";
          return (
            <div className="flex justify-center">
              <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${style}`}>
                {(row.original as any).PURCH_STATUS || (row.original as any).purch_status || "—"}
              </span>
            </div>
          );
        },
      },
      { accessorKey: "NEXT_ACTION_BY", header: "Next Action By", size: 160, cell: ({ getValue }) => String(getValue() || "—") },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openView(row.original)} title="View">
              <Eye size={15} />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Full-page editor — sidebar visible rahato (Dialog wrapper kadhla)
  // ═══════════════════════════════════════════════════════════════════════
  if (taskPopup.open) {
    return (
      <AddCPRequestPage
        isEditMode={taskPopup.data.isEditMode}
        isViewMode={taskPopup.data.isViewMode}
        existingData={
          taskPopup.data.existingData
            ? { request_number: taskPopup.data.existingData.REQUEST_NUMBER }
            : undefined
        }
        onClose={closePopup}
      />
    );
  }

  // ── Render (List page) ─────────────────────────────────────────────────────
  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-title">
        <h6 className="m-0 text-xl font-semibold tracking-tight">Capex Request</h6>
      </div>

      <AutoDismissAlert notice={notice} onClose={closeNotice} />

      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {TAB_STATUS.map((value, index) => {
          const active = activeTab === index;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(index)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-[#00378C] font-semibold text-white shadow-sm"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span>{TAB_LABELS[index]}</span>
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {tabCounts[value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={filteredRows}
          toolbar={
            statusFilter === "PENDING" && (
              <button
                title="Add CP"
                onClick={openAddPopup}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90"
              >
                <Plus size={14} />
                Add CP
              </button>
            )
          }
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search request no, description, user..."
          loading={isLoading}
          emptyText="No capex requests found"
          height={620}
          minWidth={1100}
          density="grid"
          enablePagination
          pageSize={50}
          enableColumnFilters
          enableExport
          exportFilename="capex-requests.csv"
          initialSorting={[{ id: "REQUEST_DATE", desc: true }]}
          getRowId={(row, index) => `${row.REQUEST_NUMBER}_${index}`}
        />
      </div>
    </section>
  );
};

export default Capex_Request_page;