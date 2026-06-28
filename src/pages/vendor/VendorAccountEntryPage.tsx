import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { executeVendorSql } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { makeVendorColumns, RefreshButton, VendorPageHeader } from "./components";
import { vendorAccountEntrySql } from "./vendorSql";
import type { Notice, VendorTableRow } from "./vendorTypes";

export function VendorAccountEntryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadRows = useCallback(async () => {
    if (!user?.company_code) return;
    setLoading(true);
    try {
      setRows(await executeVendorSql(vendorAccountEntrySql(user.company_code)));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load account entry records" });
    } finally {
      setLoading(false);
    }
  }, [user?.company_code]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = useMemo(() => makeVendorColumns([{ accessorKey: "ERP_DOC_NO", header: "ERP Doc" }, { accessorKey: "DATA_TRANSFER_FLAG", header: "Transfer" }]), []);

  return (
    <section className="grid gap-4">
      <VendorPageHeader title="Vendor Account Entry" description="Approved vendor documents ready for accounts posting and ERP tracking." actions={<RefreshButton loading={loading} onClick={() => void loadRows()} />} />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <DataTable columns={columns} data={rows} searchValue={query} onSearchChange={setQuery} loading={loading} searchPlaceholder="Search account entry..." emptyText="No account entry records found" density="grid" height={470} minWidth={1120} enableExport exportFilename="vendor-account-entry.csv" />
    </section>
  );
}
