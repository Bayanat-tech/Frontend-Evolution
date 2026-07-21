import { Eye, Pencil, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { executeVendorSql, getVendorRequest, type VendorRequestPayload } from "../../api/vendor";
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

  const loadRows = useCallback(async () => {
    const company = user?.company_code || "";
    const loginid = user?.loginid || user?.username || "";
    const approverLoginid = user?.loginid1 || loginid;
    if (!company || !loginid) return;
    setLoading(true);
    try {
      const sql = vendorApprovalSql(company, loginid, tabActions[tab], approverLoginid);
      setRows(await executeVendorSql(sql));
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

  const columns = useMemo<ColumnDef<VendorTableRow>[]>(() => makeVendorColumns([
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
            <Button size="icon" variant="ghost" title="Edit / approve" onClick={() => void openEditor(row.original)}><Pencil size={15} /></Button>
            <Button size="icon" variant="ghost" title="Send back" onClick={() => setAction({ docNo, action: "SENTBACK", flowLevel })}><RotateCcw size={15} /></Button>
            <Button size="icon" variant="ghost" title="Reject" onClick={() => setAction({ docNo, action: "REJECTED", flowLevel })}><XCircle size={15} /></Button>
          </div>
        );
      },
    },
  ]), [openEditor, openViewer]);

  return (
    <section className="grid gap-4">
      <VendorPageHeader
        title="Vendor Approval"
        description="Approval queue logic is isolated here, separate from requests and sent-back maintenance."
        actions={<RefreshButton loading={loading} onClick={() => void loadRows()} />}
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
          readOnly
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
