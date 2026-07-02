import { Search } from "lucide-react";
import { useState } from "react";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Field, VendorPageHeader } from "./components";
import { getVendorAccounts } from "../../api/vendor";
import type { Notice, VendorTableRow } from "./vendorTypes";
import { useAuth } from "../../state/AuthContext";

export function VendorProfilePage() {
  const { user } = useAuth();
  const [term, setTerm] = useState(user?.loginid || user?.username || "");
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const search = async () => {
    setLoading(true);
    setNotice(null);
    try {
      setRows(await getVendorAccounts(term, user?.company_code));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to search vendor profile" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-4">
      <VendorPageHeader title="Vendor Profile" description="Vendor account lookup and profile visibility has its own page." />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-[minmax(0,420px)_auto]">
          <Field label="Vendor Code Or Name" value={term} onChange={setTerm} />
          <div className="flex items-end">
            <Button onClick={() => void search()} disabled={loading}><Search size={15} /> Search</Button>
          </div>
        </CardContent>
      </Card>
      <DataTable
        columns={[
          { accessorKey: "AC_CODE", header: "Vendor Code" },
          { accessorKey: "AC_DESC", header: "Vendor Name" },
          { accessorKey: "ADDRESS1", header: "Address" },
          { accessorKey: "PHONE", header: "Phone" },
          { accessorKey: "EMAIL", header: "Email" },
          { accessorKey: "STATUS", header: "Status" },
        ]}
        data={rows}
        loading={loading}
        density="grid"
        height={470}
        minWidth={900}
        emptyText="Search for a vendor profile"
      />
    </section>
  );
}
