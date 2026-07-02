import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "../../components/ui/DataTable";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { executeVendorSql } from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { makeVendorColumns, RefreshButton, VendorPageHeader } from "./components";
import { vendorClosedSql } from "./vendorSql";
import type { Notice, VendorTableRow } from "./vendorTypes";

export function VendorClosedPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadRows = useCallback(async () => {
    if (!user?.company_code) return;
    setLoading(true);
    try {
      setRows(await executeVendorSql(vendorClosedSql(user.company_code, user.loginid || user.username || "")));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load closed records" });
    } finally {
      setLoading(false);
    }
  }, [user?.company_code, user?.loginid, user?.username]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = useMemo(() => makeVendorColumns([{ accessorKey: "ERP_DOC_NO", header: "ERP Doc" }]), []);

  return (
    <section className="grid gap-4">
      <VendorPageHeader title="Closed Vendor Documents" description="Closed and approved vendor documents have their own read-only page." actions={<RefreshButton loading={loading} onClick={() => void loadRows()} />} />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <DataTable columns={columns} data={rows} searchValue={query} onSearchChange={setQuery} loading={loading} searchPlaceholder="Search closed documents..." emptyText="No closed documents found" density="grid" height={470} minWidth={1060} enableExport exportFilename="vendor-closed.csv" />
    </section>
  );
}
