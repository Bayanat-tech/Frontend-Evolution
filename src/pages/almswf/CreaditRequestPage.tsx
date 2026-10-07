// src/pages/almswf/Credit_Request_page.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../state/AuthContext";
import { Plus, Eye, Edit2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { NoticeToast } from "../../components/ui/NoticeToast";
import type { ColumnDef } from "@tanstack/react-table";
import type { TPurchaseSummaryTxn } from "./PurchaseSummary-types";
import AddCRRequestPage from "./AddCRRequestPage";
import { getDynamicLookup } from "../../api/lookups";

// ─── Constants ────────────────────────────────────────────────────────────────
// NOTE: these must exactly match PROC_BUILD_DYNAMIC_CREDITREQUEST_ENTRY's P_CODE3
// CASE values (PS_CREDITREQUEST_ENTRY_TAB_LIST). No spaces — "INPROGRESS" and
// "SENDBACK" are single words on the backend, unlike the generic PR/PO tab set.
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
  return String((row as any).LAST_ACTION ?? (row as any).LAST_ACTION ?? "").toUpperCase();
}

// getDynamicLookup returns raw lowercase keys from Oracle (unlike almsCommonSelect,
// which auto-uppercases). Normalize here so columns/cells (which read UPPERCASE keys
// like REQUEST_NUMBER, DESCRIPTION, AMOUNT) resolve correctly instead of showing NA/blank.
function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CreditRequestPageProps {
  initialTab?: number; // index into TAB_STATUS, kept for backward-compat with existing routing
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Credit_Request_page = ({ initialTab = 0 }: CreditRequestPageProps) => {
  const { user } = useAuth();

  const [rows, setRows] = useState<TPurchaseSummaryTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRows, setTotalRows] = useState(0);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [tab, setTab] = useState<CRTab>(TAB_STATUS[initialTab] ?? "PENDING");
  const [query, setQuery] = useState("");

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

  // ── Fetch (server-side, tab-driven — mirrors PS_POORDER_ENTRY_TAB_List pattern) ──
  const fetchCreditRequest = async () => {
    const response = await getDynamicLookup({
      parameter: "PS_CREDITREQUEST_ENTRY_TAB_LIST",
      code1: user?.company_code,
      code2: user?.loginid || user?.username || "ADMIN",
      code3: tab,
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
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load credit requests" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.company_code, user?.loginid, user?.username]);

  // ── Client-side search filter (tab filtering is already done server-side) ───
  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      [row.REQUEST_NUMBER, (row as any).DESCRIPTION, (row as any).CREATE_USER, (row as any).PURCH_STATUS]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [rows, query]);

  // ── Popup handlers ──────────────────────────────────────────────────────────
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

  const closePopup = (refresh?: boolean) => {
    setTaskPopup((prev) => ({ ...prev, open: false }));
    if (refresh) {
      void loadRows(false);
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<TPurchaseSummaryTxn>[]>(
    () => [
      {
        accessorKey: "request_number",
        header: "Request No",
        size: 150,
        cell: ({ row }) => (
          <span style={{ color: "#082A89", fontWeight: 600, fontSize: "0.82rem" }}>
            {row.original.REQUEST_NUMBER}
          </span>
        ),
      },
      {
        accessorKey: "request_date",
        header: "Request Date",
        size: 150,
        cell: ({ row }) => fmtDate((row.original as any).REQUEST_DATE),
      },
      {
        accessorKey: "company_name",
        header: "Company Name",
        size: 600,
        cell: ({ row }) => (row.original as any).COMPANY_NAME || "—",
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 600,
        cell: ({ row }) => (row.original as any).DESCRIPTION || "—",
      },
      {
        accessorKey: "AMOUNT",
        header: "Amount",
        size: 120,
        cell: ({ row }) => {
          const amt = (row.original as any).AMOUNT || 0;
          return <span style={{ fontWeight: 600 }}>{Number(amt).toLocaleString()}</span>;
        },
      },
      {
        accessorKey: "CREATE_USER",
        header: "Create User",
        size: 120,
      },
      {
        accessorKey: "create_date",
        header: "Create Date",
        size: 120,
        cell: ({ row }) => fmtDate((row.original as any).CREATE_DATE),
      },
      {
        accessorKey: "LAST_ACTION",
        header: "Last Action",
        size: 130,
        cell: ({ row }) => {
          const val = statusOf(row.original);
          let bg = "#f4f4f5", color = "#52525b", border = "#d4d4d8";
          if (val === "APPROVED" || val === "A/C POSTED") { bg = "#e8f0fe"; color = "#1a4fa0"; border = "#b3caf5"; }
          else if (val === "PENDING") { bg = "#fff4e5"; color = "#92400e"; border = "#fcd38a"; }
          else if (val === "INPROGRESS") { bg = "#dbeafe"; color = "#1e40af"; border = "#93c5fd"; }
          else if (val === "REJECTED") { bg = "#fdecea"; color = "#a01a1a"; border = "#f5b3b3"; }
          else if (val === "SENTBACK") { bg = "#f3e8fe"; color = "#6b21a8"; border = "#d9b3f5"; }
          else if (val === "PO GENERATED") { bg = "#d1fae5"; color = "#065f46"; border = "#6ee7b7"; }
          return (
            <span
              style={{
                display: "inline-block", padding: "2px 10px", borderRadius: "999px",
                fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
                background: bg, color, border: `1px solid ${border}`,
              }}
            >
              {(row.original as any).LAST_ACTION || (row.original as any).last_action || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "next_action_by",
        header: "Next Action By",
        size: 160,
        cell: ({ row }) => (row.original as any).NEXT_ACTION_BY || "—",
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        cell: ({ row }) => (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Button
              size="sm" variant="ghost" title="View"
              onClick={() => handleActions("view", row.original)}
              style={{ padding: "4px", height: "28px", width: "28px" }}
            >
              <Eye size={14} />
            </Button>
            {tab !== "INPROGRESS" && (
              <Button
                size="sm" variant="ghost" title="Edit"
                onClick={() => handleActions("edit", row.original)}
                style={{ padding: "4px", height: "28px", width: "28px" }}
              >
                <Edit2 size={14} />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [tab]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280" }}>
        <a href="/dashboard" style={{ color: "#6b7280", textDecoration: "none" }}>Home</a>
        <span style={{ color: "#d1d5db" }}>/</span>
        <a href="/alms" style={{ color: "#6b7280", textDecoration: "none" }}>ALMS</a>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ color: "#111827", fontWeight: 500 }}>Credit Request</span>
      </div>

      {/* Notice */}
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div className="flex flex-wrap gap-2 rounded-md">
          {TAB_LABELS.map((label, index) => (
            <Button
              key={index}
              size="default"
              variant={tab === TAB_STATUS[index] ? "default" : "outline"}
              onClick={() => setTab(TAB_STATUS[index])}
              className="px-6 py-2.5 min-w-[120px]"
              style={{
                fontSize: "15px",
                fontWeight: tab === TAB_STATUS[index] ? 600 : 500,
                transition: "all 0.2s ease",
                ...(tab === TAB_STATUS[index] && {
                  boxShadow: "0 2px 8px rgba(8, 42, 137, 0.2)",
                })
              }}
            >
              {label}
            </Button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button onClick={openAddPopup} style={{ background: "#0a6640" }}>
            <Plus size={15} /> Add CR
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Records`}
        subtitle={`${TAB_LABELS[TAB_STATUS.indexOf(tab)]} Requests`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search request..."
        loading={loading}
        height={500}
        density="compact"
        enablePagination
        pageSize={50}
        enableColumnFilters
        getRowId={(row, index) => row.REQUEST_NUMBER || `temp-${index}`}
      />

      {/* Add / Edit / View Dialog */}
      <Dialog
        open={taskPopup.open}
        wide
        title={taskPopup.title}
        onClose={() => closePopup()}
      >
        {taskPopup.open && (
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
        )}
      </Dialog>
    </div>
  );
};

export default Credit_Request_page;