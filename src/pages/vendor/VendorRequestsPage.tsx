import { Edit2, Eye, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../../components/ui/DataTable";
import { Button } from "../../components/ui/Button";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { executeVendorSql, getVendorRequest, type VendorRequestPayload } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { makeVendorColumns, TabStrip, VendorPageHeader } from "./components";
import { vendorRequestSql } from "./vendorSql";
import type { Notice, VendorTableRow } from "./vendorTypes";
import { VendorRequestDialog } from "./VendorRequestDialog";

type RequestTab = "DRAFT" | "SUBMITTED" | "REJECTED" | "CLOSED";

export function VendorRequestsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<RequestTab>("DRAFT");
  // rows are derived from allRows based on selected tab
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editor, setEditor] = useState<VendorRequestPayload | null | undefined>(undefined);

  // const loadRows = useCallback(async () => {
  //   const company = user?.company_code || "";
  //   const loginid = user?.loginid || user?.username || "";
  //   if (!company || !loginid) return;
  //   setLoading(true);
  //   try {
  //     setRows(await executeVendorSql(vendorRequestSql(company, loginid, tab)));
  //   } catch (err) {
  //     setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load vendor requests" });
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [tab, user?.company_code, user?.loginid, user?.username]);


const [allRows, setAllRows] = useState<VendorTableRow[]>([]);

const loadRows = useCallback(async () => {
  const company = user?.company_code || "";
  const loginid = user?.loginid || user?.username || "";
  if (!company || !loginid) return;
  setLoading(true);
  try {
    setAllRows(await executeVendorSql(vendorRequestSql(company, loginid, "ALL"))); // fetch everything
  } catch (err) {
    setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load vendor requests" });
  } finally {
    setLoading(false);
  }
}, [user?.company_code, user?.loginid, user?.username]);
useEffect(() => {
  void loadRows();
}, [loadRows]);

// const rows = useMemo(() => {
//   return allRows.filter((r) => {
//     const action = String(r.LAST_ACTION || "").trim().toUpperCase();
//     if (tab === "DRAFT") return !action;
//     if (tab === "SUBMITTED") return ["SUBMITTED", "IN_PROGRESS", "PENDING", "APPROVED"].includes(action);
//     if (tab === "REJECTED") return action === "REJECTED";
//     if (tab === "CLOSED") return action === "CLOSED";
//     return action === tab;
//   });
// }, [allRows, tab]);

// const tabCounts = useMemo(() => {
//   const countByStatus = (status: string | string[]) => {
//     const statuses = Array.isArray(status) ? status : [status];
//     return allRows.filter((r) => statuses.includes(String(r.LAST_ACTION || "").trim().toUpperCase())).length;
//   };

//   return {
//     DRAFT: allRows.filter((r) => !String(r.LAST_ACTION || "").trim()).length,
//     SUBMITTED: countByStatus(["SUBMITTED", "IN_PROGRESS", "PENDING", "APPROVED"]),
//     REJECTED: countByStatus("REJECTED"),
//     CLOSED: countByStatus("CLOSED"),
//   };
// }, [allRows]);

//   useEffect(() => {
//     void loadRows();
//   }, [loadRows]);
    
// after
const rows = useMemo(() => {
  return allRows.filter((r) => {
    const action = String(r.LAST_ACTION || "").trim().toUpperCase();
    if (tab === "DRAFT") return !action || action === "SAVEASDRAFT" || action === "SENTBACK";
// const rows = useMemo(() => {
//   return allRows.filter((r) => {
//     const action = String(r.LAST_ACTION || "").trim().toUpperCase();
//     if (tab === "DRAFT") return !action || action === "SAVEASDRAFT";
    if (tab === "SUBMITTED") return ["SUBMITTED", "IN_PROGRESS", "PENDING", "APPROVED"].includes(action);
    if (tab === "REJECTED") return action === "REJECTED";
    if (tab === "CLOSED") return action === "CLOSED";
    return action === tab;
  });
}, [allRows, tab]);

const tabCounts = useMemo(() => {
  const countByStatus = (status: string | string[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return allRows.filter((r) => statuses.includes(String(r.LAST_ACTION || "").trim().toUpperCase())).length;
  };

  return {
    DRAFT: allRows.filter((r) => {
      const action = String(r.LAST_ACTION || "").trim().toUpperCase();
      return !action || action === "SAVEASDRAFT" || action === "SENTBACK";;
    }).length,
    SUBMITTED: countByStatus(["SUBMITTED", "IN_PROGRESS", "PENDING", "APPROVED"]),
    REJECTED: countByStatus("REJECTED"),
    CLOSED: countByStatus("CLOSED"),
  };
}, [allRows]);

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
          <Button size="icon" variant="ghost" title="Edit request" disabled={tab === "SUBMITTED"} onClick={() => void openExisting(row.original)}><Edit2 size={15} /></Button>
        </div>
      ),
    },
  ]), [tab]);
  

  return (
    // <section className="grid gap-4">
    <section className="vendor-list-screen grid gap-4">
      <VendorPageHeader
        title="Vendor Requests"
        // actions={<><RefreshButton loading={loading} onClick={() => void loadRows()} /><Button size="sm" onClick={() => setEditor(null)}><Plus size={14} /> New Request</Button></>}
      />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <TabStrip
        value={tab}
        onChange={setTab}
        tabs={[
          { label: "Draft", value: "DRAFT" ,count: tabCounts.DRAFT},
          { label: "In Progress", value: "SUBMITTED" ,count: tabCounts.SUBMITTED},
          { label: "Reject", value: "REJECTED" ,count: tabCounts.REJECTED},
          { label: "Closed", value: "CLOSED" ,count: tabCounts.CLOSED},
        ]}
      />
      <DataTable
        columns={columns}
        data={rows}
        toolbar={
           <button
             type="button"
             onClick={() => setEditor(null)}
             className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
           >
             <Plus size={14} />
               New Request
              </button>
         }
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
          readOnly={tab === "SUBMITTED"}
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
