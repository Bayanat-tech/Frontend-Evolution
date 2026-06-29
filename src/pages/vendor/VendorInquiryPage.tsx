import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Field, VendorPageHeader } from "./components";
import { getVendorInvoiceStatus, getVendorOutstanding, getVendorStatement } from "../../api/vendor";
import type { Notice, VendorTableRow } from "./vendorTypes";
import { useAuth } from "../../state/AuthContext";

type InquiryMode = "outstanding" | "status" | "statement";

const titles: Record<InquiryMode, string> = {
  outstanding: "Vendor Outstanding",
  status: "Vendor Invoice Status",
  statement: "Vendor Statement",
};

export function VendorInquiryPage({ mode }: { mode: InquiryMode }) {
  const { user } = useAuth();
  const [acCode, setAcCode] = useState(user?.loginid || user?.username || "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const columns = useMemo<ColumnDef<VendorTableRow>[]>(() => {
    if (mode === "outstanding") {
      return [
        { accessorKey: "AC_CODE", header: "Vendor Code" },
        { accessorKey: "AC_DESC", header: "Vendor Name" },
        { accessorKey: "DOC_NO", header: "Doc No" },
        { accessorKey: "DOC_DATE", header: "Doc Date" },
        { accessorKey: "DR_AMOUNT", header: "Debit" },
        { accessorKey: "CR_AMOUNT", header: "Credit" },
        { accessorKey: "BALANCE", header: "Balance" },
      ];
    }
    if (mode === "status") {
      return [
        { accessorKey: "DOC_NO", header: "Invoice No" },
        { accessorKey: "DOC_DATE", header: "Invoice Date" },
        { accessorKey: "AC_CODE", header: "Vendor Code" },
        { accessorKey: "AC_DESC", header: "Vendor Name" },
        { accessorKey: "LAST_ACTION", header: "Status" },
        { accessorKey: "NET_AMOUNT", header: "Amount" },
      ];
    }
    return [
      { accessorKey: "DOC_DATE", header: "Date" },
      { accessorKey: "DOC_NO", header: "Doc No" },
      { accessorKey: "NARRATION", header: "Narration" },
      { accessorKey: "DR_AMOUNT", header: "Debit" },
      { accessorKey: "CR_AMOUNT", header: "Credit" },
      { accessorKey: "BALANCE", header: "Balance" },
    ];
  }, [mode]);

  const search = async () => {
    setNotice(null);
    if (!acCode) {
      setNotice({ type: "error", message: "Vendor code is required." });
      return;
    }
    setLoading(true);
    try {
      if (mode === "outstanding") setRows(await getVendorOutstanding(acCode, user?.company_code));
      if (mode === "status") setRows(await getVendorInvoiceStatus(acCode, fromDate, toDate, user?.company_code));
      if (mode === "statement") setRows(await getVendorStatement(acCode, fromDate, toDate, user?.company_code));
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load vendor inquiry" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-4">
      <VendorPageHeader title={titles[mode]} description="Vendor inquiry pages are separate from transaction and approval workflows." />
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-4">
          <Field label="Vendor Code" value={acCode} onChange={setAcCode} required />
          <Field label="From Date" value={fromDate} onChange={setFromDate} type="date" />
          <Field label="To Date" value={toDate} onChange={setToDate} type="date" />
          <div className="flex items-end">
            <Button onClick={() => void search()} disabled={loading}><Search size={15} /> Search</Button>
          </div>
        </CardContent>
      </Card>
      <DataTable columns={columns} data={rows} loading={loading} density="grid" height={470} minWidth={980} emptyText="Run a search to view vendor records" enableExport exportFilename={`vendor-${mode}.csv`} />
    </section>
  );
}
