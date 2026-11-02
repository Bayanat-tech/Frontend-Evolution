// src/pages/almswf/Credit_Request_page.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../state/AuthContext";
import { Plus, Eye, Edit2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { NoticeToast } from "../../components/ui/NoticeToast";
import type { ColumnDef } from "@tanstack/react-table";
import type { TPurchaseSummaryTxn } from "./PurchaseSummary-types";
import AddCRRequestPage from "./AddCRRequestPage";
import { getDynamicLookup } from "../../api/lookups";
import AutoDismissAlert from "../../components/ui/AutoDismissAlert";

// ─── Constants ────────────────────────────────────────────────────────────────
const TAB_STATUS = ["PENDING", "INPROGRESS", "CLOSED", "CANCELED", "REJECTED", "SENDBACK"] as const;
const TAB_LABELS = ["Pending", "In Progress", "Closed", "Canceled", "Rejected", "Send Back"] as const;

type CRTab = (typeof TAB_STATUS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function statusOf(row: TPurchaseSummaryTxn): string {
  return String((row as any).LAST_ACTION ?? (row as any).last_action ?? "").toUpperCase();
}

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-blue-50 text-blue-800 border-blue-200",
  "A/C POSTED": "bg-blue-50 text-blue-800 border-blue-200",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  INPROGRESS: "bg-blue-100 text-blue-800 border-blue-300",
  REJECTED: "bg-red-50 text-red-800 border-red-200",
  SENTBACK: "bg-purple-50 text-purple-800 border-purple-200",
  SENDBACK: "bg-purple-50 text-purple-800 border-purple-200",
  "PO GENERATED": "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELED: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface CreditRequestPageProps {
  initialTab?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const CreditRequestPage = ({ initialTab = 0 }: CreditRequestPageProps) => {
  const { user } = useAuth();

  const [rows, setRows] = useState<TPurchaseSummaryTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRows, setTotalRows] = useState(0);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [tab, setTab] = useState<CRTab>(TAB_STATUS[initialTab] ?? "PENDING");
  const [query, setQuery] = useState("");

  const [tabCounts, setTabCounts] = useState<Record<string, number>>({
  PENDING: 0, INPROGRESS: 0, CLOSED: 0, CANCELED: 0, REJECTED: 0, SENDBACK: 0,
});
const isInProgressTab = tab === "INPROGRESS";

  // ── Popup state (Add / Edit / View) ─────────────────────────────────────────
  const [taskPopup, setTaskPopup] = useState({
    open: false,
    title: "",
    data: {
      existingData: null as TPurchaseSummaryTxn | null,
      isEditMode: false,
      isViewMode: false,
    },
  });

  // ── Fetch (server-side, tab-driven) ─────────────────────────────────────────
 const fetchCreditRequest = async (tabValue: CRTab = tab) => {
  const response = await getDynamicLookup({
    parameter: "PS_CREDITREQUEST_ENTRY_TAB_LIST",
    code1: user?.company_code,
    code2: user?.loginid || user?.username || "ADMIN",
    code3: tabValue,
  });
  const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
  return rawRows.map(uppercaseKeys) as TPurchaseSummaryTxn[];
};

const loadRows = async (clearNotice = true) => {
  setLoading(true);
  if (clearNotice) setNotice(null);
  try {
    const response = await fetchCreditRequest();
    setRows(response);
    setTotalRows(response.length);
    setTabCounts((prev) => ({ ...prev, [tab]: response.length }));
  } catch (error) {
    setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load credit requests" });
  } finally {
    setLoading(false);
  }
};

const loadTabCounts = async () => {
  const results = await Promise.all(
    TAB_STATUS.map(async (t) => {
      try {
        const res = await fetchCreditRequest(t);
        return { t, count: res.length };
      } catch {
        return { t, count: 0 };
      }
    })
  );
  setTabCounts((prev) => {
    const next = { ...prev };
    results.forEach(({ t, count }) => { next[t] = count; });
    return next;
  });
};

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.company_code, user?.loginid, user?.username]);



  useEffect(() => {
  if (!user?.company_code) return;
  void loadTabCounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user?.company_code, user?.loginid, user?.username]);

  // ── Client-side search filter ───────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      [row.REQUEST_NUMBER, (row as any).DESCRIPTION, (row as any).CREATE_USER, (row as any).PURCH_STATUS]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [rows, query]);


  const openAddPopup = () => {
  setTaskPopup({
    open: true,
    title: "Add CR",
    data: { existingData: null, isEditMode: false, isViewMode: false },
  });
};

const handleActions = (actionType: "view" | "edit", row: TPurchaseSummaryTxn) => {
  setTaskPopup({
    open: true,
    title: `${actionType === "edit" ? "Edit" : "View"} CR - ${row.REQUEST_NUMBER}`,
    data: {
      existingData: row,
      isEditMode: actionType === "edit",
      isViewMode: actionType === "view",
    },
  });
};


const closePopup = (refresh?: boolean, message?: string) => {
  setTaskPopup((prev) => ({ ...prev, open: false }));
  if (refresh) {
    void loadRows(false).then(() => {
      if (message) setNotice({ type: "success", message });
    });
    void loadTabCounts();
  }
};

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<TPurchaseSummaryTxn>[]>(
  () => [
    {
      accessorKey: "REQUEST_NUMBER",
      header: "Request No",
      size: 150,
      cell: ({ row }) => <span className="text-xs font-semibold text-[#082A89]">{row.original.REQUEST_NUMBER}</span>,
    },
    { accessorKey: "REQUEST_DATE", header: "Request Date", size: 120, cell: ({ getValue }) => fmtDate(getValue()) },
    { accessorKey: "COMPANY_NAME", header: "Company Name", size: 260, cell: ({ getValue }) => String(getValue() || "—") },
    { accessorKey: "DESCRIPTION", header: "Description", size: 300, cell: ({ getValue }) => String(getValue() || "—") },
    {
      accessorKey: "AMOUNT",
      header: () => <div className="text-right">Amount</div>,
      size: 120,
      cell: ({ getValue }) => (
        <div className="text-right font-semibold">{Number(getValue() || 0).toLocaleString()}</div>
      ),
    },
    { accessorKey: "CREATE_USER", header: "Create User", size: 120 },
    { accessorKey: "CREATE_DATE", header: "Create Date", size: 120, cell: ({ getValue }) => fmtDate(getValue()) },
    {
      accessorKey: "LAST_ACTION",
      header: () => <div className="text-center">Last Action</div>,
      size: 130,
      cell: ({ row }) => {
        const val = statusOf(row.original);
        const style = STATUS_STYLES[val] ?? "bg-zinc-100 text-zinc-600 border-zinc-300";
        return (
          <div className="flex justify-center">
            <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${style}`}>
              {(row.original as any).LAST_ACTION || "—"}
            </span>
          </div>
        );
      },
    },
    { accessorKey: "NEXT_ACTION_BY", header: "Next Action By", size: 160, cell: ({ getValue }) => String(getValue() || "—") },
        {
      id: "actions",
      header: "Actions",
      size: 100,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => handleActions("view", row.original)} title="View">
            <Eye size={15} />
          </Button>
          {!isInProgressTab && (
            <Button size="icon" variant="ghost" onClick={() => handleActions("edit", row.original)} title="Edit">
              <Edit2 size={15} />
            </Button>
          )}
        </div>
      ),
    },
  ],
  [isInProgressTab]
);


  if (taskPopup.open) {
  return (
    <AddCRRequestPage
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
      <h6 className="m-0 text-xl font-semibold tracking-tight">Credit Request</h6>
    </div>

    <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

    <div className="flex flex-wrap items-center gap-1.5 pb-1">
      {TAB_STATUS.map((value, index) => {
        const active = tab === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
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
          tab === "PENDING" && (
            <button
              title="Add CR"
              onClick={openAddPopup}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90"
            >
              <Plus size={14} />
              Add CR
            </button>
          )
        }
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search request no, description, user..."
        loading={loading}
        emptyText="No credit requests found"
        height={620}
        minWidth={1200}
        density="grid"
        enablePagination
        pageSize={50}
        enableColumnFilters
        enableExport
        exportFilename="credit-requests.csv"
        initialSorting={[{ id: "REQUEST_DATE", desc: true }]}
        getRowId={(row, index) => `${row.REQUEST_NUMBER}_${index}`}
      />
    </div>
  </section>
);
};

export default CreditRequestPage;