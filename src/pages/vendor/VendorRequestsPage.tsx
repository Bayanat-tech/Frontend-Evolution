import { Edit2, Eye, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { executeVendorSql, getVendorRequest, type VendorRequestPayload } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { makeVendorColumns, RefreshButton, TabStrip, VendorPageHeader } from "./components";
import { vendorRequestSql } from "./vendorSql";
import type { Notice, VendorTableRow } from "./vendorTypes";
import { VendorRequestDialog } from "./VendorRequestDialog";

type RequestTab = "DRAFT" | "SUBMITTED" | "REJECTED" | "CLOSED";

export function VendorRequestsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<RequestTab>("DRAFT");
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<VendorRequestPayload | null | undefined>(undefined);

  const loadRows = useCallback(async () => {
    const company = user?.company_code || "";
    const loginid = user?.loginid || user?.username || "";
    if (!company || !loginid) return;
    setLoading(true);
    try {
      setRows(await executeVendorSql(vendorRequestSql(company, loginid, tab)));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load vendor requests" });
    } finally {
      setLoading(false);
    }
  }, [tab, user?.company_code, user?.loginid, user?.username]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);
    
  const openExisting = async (row: VendorTableRow) => {
    const rawDocNo = String(row.DOC_NO || "");
    const loginid = user?.loginid || user?.username || "";
    if (!rawDocNo || !loginid) return;

    const docNo = `${rawDocNo}$$$${loginid}`;
    try {
      setEditor(await getVendorRequest(docNo));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to open request" });
    }
  };

  const columns = useMemo<ColumnDef<VendorTableRow>[]>(() => makeVendorColumns([
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" title="View request" onClick={() => void openExisting(row.original)}><Eye size={15} /></Button>
          <Button size="icon" variant="ghost" title="Edit request" onClick={() => void openExisting(row.original)}><Edit2 size={15} /></Button>
        </div>
      ),
    },
  ]), []);

  return (
    <section className="grid gap-4">
      <VendorPageHeader
        title="Vendor Requests"
        description="Draft, in-progress, rejected and closed purchase invoice requests."
        actions={<><RefreshButton loading={loading} onClick={() => void loadRows()} /><Button size="sm" onClick={() => setEditor(null)}><Plus size={14} /> New Request</Button></>}
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <TabStrip
        value={tab}
        onChange={setTab}
        tabs={[
          { label: "Draft", value: "DRAFT", icon: "draft" },
          { label: "In Progress", value: "SUBMITTED", icon: "submitted" },
          { label: "Reject", value: "REJECTED", icon: "rejected" },
          { label: "Closed", value: "CLOSED", icon: "closed" },
        ]}
      />
      <DataTable
        columns={columns}
        data={rows}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search vendor requests..."
        loading={loading}
        emptyText="No vendor requests found"
        density="grid"
        height={470}
        minWidth={1180}
        enableExport
        exportFilename={`vendor-requests-${tab.toLowerCase()}.csv`}
      />
      {editor !== undefined && (
        <VendorRequestDialog
          open
          request={editor}
          onClose={() => setEditor(undefined)}
          onSaved={async (action) => {
            if (action === "SUBMITTED") setEditor(undefined);
            setNotice({ type: "success", message: action === "SAVEASDRAFT" ? "Vendor draft saved" : "Vendor request submitted" });
            await loadRows();
          }}
        />
      )}
    </section>
  );
}
