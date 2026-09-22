import { CheckCircle2, Eye, Pencil, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { bulkVendorApproval, executeVendorSql, getVendorRequest, type VendorRequestPayload } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { makeVendorColumns, RefreshButton, TabStrip, VendorPageHeader } from "./components";
import { vendorApprovalSql } from "./vendorSql";
import type { Notice, VendorTableRow } from "./vendorTypes";
import { VendorActionDialog } from "./VendorActionDialog";
import { VendorRequestDialog } from "./VendorRequestDialog";

type ApprovalTab = "pending" | "inProgress" | "rejected" | "closed";

const tabActions: Record<ApprovalTab, string[]> = {
  pending: ["PENDING", "SUBMITTED"],
  inProgress: ["IN_PROGRESS", "INPROGRESS"],
  rejected: ["REJECTED"],
  closed: ["APPROVED", "CLOSED"],
};

export function VendorApprovalsPage() {
  const { user } = useAuth();
  console.log("User:", user);
  const [tab, setTab] = useState<ApprovalTab>("pending");
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [action, setAction] = useState<{ docNo: string; action: "SENTBACK" | "REJECTED"; flowLevel?: string | number } | null>(null);
  const [viewer, setViewer] = useState<VendorRequestPayload | null | undefined>(undefined);
  const [editor, setEditor] = useState<{ request: VendorRequestPayload | null; flowLevel?: string | number } | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadRows = useCallback(async () => {
    const company = user?.company_code || "";
    const loginid = user?.loginid || user?.username || "";
    const approverLoginid = user?.loginid1 || loginid;
    if (!company || !loginid) return;
    setLoading(true);
    try {
      const sql = vendorApprovalSql(company, loginid, tabActions[tab], approverLoginid);
      setRows(await executeVendorSql(sql));
      setSelected(new Set());
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load approval queue" });
    } finally {
      setLoading(false);
    }
  }, [tab, user?.company_code, user?.loginid, user?.loginid1, user?.username]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openViewer = useCallback(async (row: VendorTableRow) => {
    const docNo = String(row.DOC_NO || "");
    const application = String((user as Record<string, unknown> | null | undefined)?.APPLICATION || "");
    const loginid = application === "EMPLOYEE"
      ? String(row.AC_CODE || "")
      : String(user?.loginid || user?.username || "");
    if (!docNo || !loginid) return;

    try {
      setViewer(await getVendorRequest(`${docNo}$$$${loginid}`));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to open vendor details" });
    }
  }, [user, user?.loginid, user?.username]);

  const openEditor = useCallback(async (row: VendorTableRow) => {
    const docNo = String(row.DOC_NO || "");
    const flowLevel = row.FLOW_LEVEL as string | number | undefined;
    const application = String((user as Record<string, unknown> | null | undefined)?.APPLICATION || "");
    const loginid = application === "EMPLOYEE"
      ? String(row.AC_CODE || "")
      : String(user?.loginid || user?.username || "");
    if (!docNo || !loginid) return;

    try {
      setEditor({ request: await getVendorRequest(`${docNo}$$$${loginid}`), flowLevel });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to open vendor approval" });
    }
  }, [user, user?.loginid, user?.username]);

  const runBulk = async (bulkAction: "APPROVED" | "REJECTED") => {
  if (selected.size === 0) return;
  const label = bulkAction === "APPROVED" ? "Approve" : "Reject";
  if (!window.confirm(`${label} ${selected.size} request(s)?`)) return;
  const count = selected.size;
  setBulkBusy(true);
  try {
    await bulkVendorApproval({
      company_code: user?.company_code || "",
      loginid: user?.loginid1 || user?.loginid || "",
      docNos: Array.from(selected).join(","),
      action: bulkAction,
    });
    setNotice({ type: "success", message: `${count} request(s) ${bulkAction === "APPROVED" ? "approved" : "rejected"}` });
    await loadRows();
     } catch (err) {
    setNotice({ type: "error", message: err instanceof Error ? err.message : "Bulk action failed" });
    await loadRows();
  } finally {
    setBulkBusy(false);
  }
 };

  const baseColumns = useMemo<ColumnDef<VendorTableRow>[]>(() => makeVendorColumns([
    {
      id: "actions",
      header: "Approval",
      enableSorting: false,
      cell: ({ row }) => {
        const docNo = String(row.original.DOC_NO || "");
        const flowLevel = row.original.FLOW_LEVEL as string | number | undefined;
        return (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="View header/details" onClick={() => void openViewer(row.original)}><Eye size={15} /></Button>
            <Button size="icon" variant="ghost" title="Edit / approve" disabled={tab === "inProgress"} onClick={() => void openEditor(row.original)}><Pencil size={15} /></Button>
            <Button size="icon" variant="ghost" title="Send back" disabled={tab === "inProgress"} onClick={() => setAction({ docNo, action: "SENTBACK", flowLevel })}><RotateCcw size={15} /></Button>
            <Button size="icon" variant="ghost" title="Reject" disabled={tab === "inProgress"} onClick={() => setAction({ docNo, action: "REJECTED", flowLevel })}><XCircle size={15} /></Button>
          </div>
        );
      },
    },
    ]), [openEditor, openViewer, tab]);

  const columns = useMemo<ColumnDef<VendorTableRow>[]>(() => {
  if (tab !== "pending") return baseColumns;
  const allDocs = rows.map((r) => String(r.DOC_NO || ""));
  const selectCol: ColumnDef<VendorTableRow> = {
    id: "select",
    enableSorting: false,
    header: () => (
      <input
        type="checkbox"
        checked={allDocs.length > 0 && selected.size === allDocs.length}
        onChange={(e) => setSelected(e.target.checked ? new Set(allDocs) : new Set())}
      />
    ),
    cell: ({ row }) => {
      const doc = String(row.original.DOC_NO || "");
      return (
        <input
          type="checkbox"
          checked={selected.has(doc)}
          onChange={(e) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (e.target.checked) next.add(doc);
              else next.delete(doc);
              return next;
            })
          }
        />
      );
    },
  };
  return [selectCol, ...baseColumns];
}, [baseColumns, tab, rows, selected]);

  return (
    <section className="grid gap-4">
      <VendorPageHeader
        title="Vendor Approval"
        // actions={<RefreshButton loading={loading} onClick={() => void loadRows()} />}
        actions={
          <>
            {tab === "pending" && (
              <>
                <Button size="sm" disabled={selected.size === 0 || bulkBusy} onClick={() => void runBulk("APPROVED")}>
                  <CheckCircle2 size={14} /> Bulk Approve ({selected.size})
                </Button>
                <Button size="sm" variant="destructive" disabled={selected.size === 0 || bulkBusy} onClick={() => void runBulk("REJECTED")}>
                  <XCircle size={14} /> Bulk Reject ({selected.size})
                </Button>
              </>
            )}
            <RefreshButton loading={loading} onClick={() => void loadRows()} />
          </>
        }
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <TabStrip
        value={tab}
        onChange={setTab}
        tabs={[
          { label: "Pending", value: "pending", icon: "pending" },
          { label: "In Progress", value: "inProgress", icon: "inProgress" },
          { label: "Rejected", value: "rejected", icon: "rejected" },
          { label: "Closed", value: "closed", icon: "closed" },
        ]}
      />
      <DataTable
        columns={columns}
        data={rows}
        searchValue={query}
        onSearchChange={setQuery}
        loading={loading}
        searchPlaceholder="Search approval queue..."
        emptyText="No approvals found"
        density="grid"
        height={470}
        minWidth={1100}
        enableExport
        exportFilename={`vendor-approval-${tab}.csv`}
      />
      {action && (
        <VendorActionDialog
          docNo={action.docNo}
          action={action.action}
          flowLevel={action.flowLevel}
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null);
            setNotice({ type: "success", message: "Vendor request updated" });
            await loadRows();
          }}
        />
      )}
      {viewer !== undefined && (
        <VendorRequestDialog
          open
          readOnly
          request={viewer}
          onClose={() => setViewer(undefined)}
        />
      )}
      {editor !== undefined && (
        <VendorRequestDialog
          open
          approvalMode
          readOnly={tab === "inProgress"}
          request={editor.request}
          approvalFlowLevel={editor.flowLevel}
          onApprovalAction={(nextAction, flowLevel) => {
            const docNo = String(editor.request?.DOC_NO || "");
            setEditor(undefined);
            if (docNo) setAction({ docNo, action: nextAction, flowLevel });
          }}
          onClose={() => setEditor(undefined)}
          onSaved={async (nextAction) => {
            setEditor(undefined);
            setNotice({ type: "success", message: nextAction === "APPROVED" ? "Vendor request approved" : "Vendor request updated" });
            await loadRows();
          }}
        />
      )}
    </section>
  );
}
