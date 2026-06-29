import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { executeVendorSql } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { makeVendorColumns, RefreshButton, TabStrip, VendorPageHeader } from "./components";
import { vendorApprovalSql } from "./vendorSql";
import type { Notice, VendorTableRow } from "./vendorTypes";
import { VendorActionDialog } from "./VendorActionDialog";

type ApprovalTab = "pending" | "inProgress" | "rejected" | "closed";

const tabActions: Record<ApprovalTab, string[]> = {
  pending: ["PENDING", "SUBMITTED"],
  inProgress: ["IN_PROGRESS", "INPROGRESS"],
  rejected: ["REJECTED"],
  closed: ["APPROVED", "CLOSED"],
};

export function VendorApprovalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ApprovalTab>("pending");
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [action, setAction] = useState<{ docNo: string; action: "APPROVED" | "SENT_BACK" | "REJECTED" } | null>(null);

  const loadRows = useCallback(async () => {
    const company = user?.company_code || "";
    const loginid = user?.loginid || user?.username || "";
    if (!company || !loginid) return;
    setLoading(true);
    try {
      setRows(await executeVendorSql(vendorApprovalSql(company, loginid, tabActions[tab])));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load approval queue" });
    } finally {
      setLoading(false);
    }
  }, [tab, user?.company_code, user?.loginid, user?.username]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = useMemo<ColumnDef<VendorTableRow>[]>(() => makeVendorColumns([
    {
      id: "actions",
      header: "Approval",
      enableSorting: false,
      cell: ({ row }) => {
        const docNo = String(row.original.DOC_NO || "");
        return (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="Approve" onClick={() => setAction({ docNo, action: "APPROVED" })}><CheckCircle2 size={15} /></Button>
            <Button size="icon" variant="ghost" title="Send back" onClick={() => setAction({ docNo, action: "SENT_BACK" })}><RotateCcw size={15} /></Button>
            <Button size="icon" variant="ghost" title="Reject" onClick={() => setAction({ docNo, action: "REJECTED" })}><XCircle size={15} /></Button>
          </div>
        );
      },
    },
  ]), []);

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
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null);
            setNotice({ type: "success", message: "Vendor request updated" });
            await loadRows();
          }}
        />
      )}
    </section>
  );
}
