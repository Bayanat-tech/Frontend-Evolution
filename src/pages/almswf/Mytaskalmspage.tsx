// src/pages/almswf/Mytaskalmspage.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../state/AuthContext";
import { Plus, Eye, Edit2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { NoticeToast } from "../../components/ui/NoticeToast";
import type { ColumnDef } from "@tanstack/react-table";
import type { TPurchaseSummaryTxn } from "./PurchaseSummary-types";
import AddPRRequestPage from "./Addprrequestpage";
import { almsCommonSelect } from "../../api/alms";
import AddCRRequestPage from "./AddCRRequestPage";
import AddCPRequestPage from "./AddCPRequestPage";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(val: unknown): string {
  const raw = String(val || "");
  if (!raw || raw === "null" || raw === "undefined") return "NA";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "NA";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function requestType(requestNumber?: string): "PR" | "CR" | "CP" {
  if (requestNumber?.startsWith("PR")) return "PR";
  if (requestNumber?.startsWith("CR")) return "CR";
  return "CP";
}

function statusOf(row: TPurchaseSummaryTxn): string {
  return String((row as any).PURCH_STATUS ?? (row as any).purch_status ?? "").toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface MytaskalmsPageProps {
  initialTab?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const MytaskalmsPage = ({ initialTab = 0 }: MytaskalmsPageProps) => {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(initialTab);
  const statusFilter = TAB_STATUS[activeTab];
  const [query, setQuery] = useState("");


  // ── Popup state (Add / Edit / View) ─────────────────────────────────────────
  const [taskPopup, setTaskPopup] = useState({
    open: false,
    title: "",
    data: {
      existingData: null as TPurchaseSummaryTxn | null,
      isEditMode: false,
      isViewMode: false,
      type: "" as "PR" | "CR" | "CP" | "",
    },
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["mytask-alms", loginid, companyCode],
    queryFn: () =>
      almsCommonSelect<TPurchaseSummaryTxn>({
        parameter: "Amlspf_mytaskalmsPage",
        loginid,
        code1: companyCode,
        code3: statusFilter,
      }),
    enabled: !!loginid && !!companyCode,
  });

  const rows = useMemo(() => data ?? [], [data]);

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

  // ── Popup handlers ──────────────────────────────────────────────────────────
  const openAddPopup = (type: "PR" | "CR" | "CP") => {
    setTaskPopup({
      open: true,
      title: `Add ${type}`,
      data: { existingData: null, isEditMode: false, isViewMode: false, type },
    });
  };

  const handleActions = (actionType: "view" | "edit", row: TPurchaseSummaryTxn) => {
    const type = requestType(row.REQUEST_NUMBER);
    setTaskPopup({
      open: true,
      title: `${actionType === "edit" ? "Edit" : "View"} ${type} - ${row.REQUEST_NUMBER}`,
      data: {
        existingData: row,
        isEditMode: actionType === "edit",
        isViewMode: actionType === "view",
        type,
      },
    });
  };

  const closePopup = (refresh?: boolean) => {
    setTaskPopup((prev) => ({ ...prev, open: false }));
    if (refresh) {
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
        accessorKey: "DESCRIPTION",
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
        accessorKey: "purch_status",
        header: "Status",
        size: 130,
        cell: ({ row }) => {
          const val = statusOf(row.original);
          let bg = "#f4f4f5", color = "#52525b", border = "#d4d4d8";
          if (val === "APPROVED" || val === "A/C POSTED") { bg = "#e8f0fe"; color = "#1a4fa0"; border = "#b3caf5"; }
          else if (val === "PENDING") { bg = "#fff4e5"; color = "#92400e"; border = "#fcd38a"; }
          else if (val === "IN PROGRESS") { bg = "#dbeafe"; color = "#1e40af"; border = "#93c5fd"; }
          else if (val === "REJECTED") { bg = "#fdecea"; color = "#a01a1a"; border = "#f5b3b3"; }
          else if (val === "SENT BACK") { bg = "#f3e8fe"; color = "#6b21a8"; border = "#d9b3f5"; }
          else if (val === "PO GENERATED") { bg = "#d1fae5"; color = "#065f46"; border = "#6ee7b7"; }
          return (
            <span
              style={{
                display: "inline-block", padding: "2px 10px", borderRadius: "999px",
                fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
                background: bg, color, border: `1px solid ${border}`,
              }}
            >
              {(row.original as any).PURCH_STATUS || (row.original as any).purch_status || "—"}
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
        cell: ({ row }) => {
          const type = requestType(row.original.REQUEST_NUMBER);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Button
                size="sm" variant="ghost" title="View"
                onClick={() => handleActions("view", row.original)}
                style={{ padding: "4px", height: "28px", width: "28px" }}
              >
                <Eye size={14} />
              </Button>
              {type !== "CP" && (
                <Button
                  size="sm" variant="ghost" title="Edit"
                  onClick={() => handleActions("edit", row.original)}
                  style={{ padding: "4px", height: "28px", width: "28px" }}
                >
                  <Edit2 size={14} />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
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
        <span style={{ color: "#111827", fontWeight: 500 }}>My Task</span>
      </div>

      {/* Notice */}
      {isError && (
        <NoticeToast
          notice={{ type: "error", message: error instanceof Error ? error.message : "Failed to load tasks" }}
          onClose={() => { }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div className="flex flex-wrap gap-2 rounded-md">
          {TAB_LABELS.map((label, index) => (
            <Button
              key={index}
              size="default"
              variant={activeTab === index ? "default" : "outline"}
              onClick={() => setActiveTab(index)}
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

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button onClick={() => openAddPopup("PR")} style={{ background: "#082A89" }}>
            <Plus size={15} /> Add PR
          </Button>
          <Button onClick={() => openAddPopup("CR")} style={{ background: "#0a6640" }}>
            <Plus size={15} /> Add CR
          </Button>
          {/* <Button onClick={() => openAddPopup("CP")} style={{ background: "#6b21a8" }}>
            <Plus size={15} /> Add CP
          </Button> */}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredRows}
        title={`${filteredRows.length.toLocaleString()} Records`}
        subtitle={`${TAB_LABELS[activeTab]} Requests`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search request..."
        loading={isLoading}
        height={500}
        density="compact"
        enablePagination
        pageSize={50}
        enableColumnFilters
        getRowId={(row) => row.REQUEST_NUMBER ?? ""}
      />

      {/* Add / Edit / View Dialog */}
      <Dialog
        open={taskPopup.open}
        wide
        title={taskPopup.title}
        onClose={() => closePopup()}
      >
        {taskPopup.open && taskPopup.data.type === "PR" && (
          <AddPRRequestPage
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
        {taskPopup.open && taskPopup.data.type === "CR" && (
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
        {taskPopup.open && taskPopup.data.type === "CP" && (
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
        )}
      </Dialog>
    </div>
  );
};

export default MytaskalmsPage;