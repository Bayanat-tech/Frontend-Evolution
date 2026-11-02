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

const toDMY = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
};

const inRange = (v: unknown, from: string, to: string) => {
  const d = v ? new Date(v as string) : null;
  if (!d || isNaN(d.getTime())) return true; // keep undated rows visible
  if (from && d < new Date(`${from}T00:00:00`)) return false;
  if (to && d > new Date(`${to}T23:59:59.999`)) return false;
  return true;
};
const fmtDate = (v: unknown) => {
  if (!v) return "";
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB").format(d);
};

const fmtAmt = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  const s = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Math.abs(n));
  return n < 0 ? `(${s})` : s;
};

const amtCell = (v: unknown) => (
  <span className={`block text-right ${Number(v) < 0 ? "text-red-700" : ""}`}>{fmtAmt(v)}</span>
);

const statusCell = (v: unknown) => {
  const s = String(v ?? "");
  const l = s.toLowerCase();
  const c = l.includes("payment cleared") ? "text-green-700 border-green-700"
    : l.includes("adv. payment") ? "text-blue-800 border-blue-800"
    : l.includes("payment pending") ? "text-red-600 border-red-600"
    : l.includes("not booked") ? "text-amber-600 border-amber-600"
    : "text-slate-600 border-slate-400";
  return s ? <span className={`rounded-full border px-2 text-[10px] font-bold ${c}`}>{s}</span> : null;
};

export function VendorInquiryPage({ mode }: { mode: InquiryMode }) {
  const { user } = useAuth();
  const acCode = user?.loginid || user?.username || "";
  // const [acCode, setAcCode] = useState(user?.loginid || user?.username || "");
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(mode === "outstanding" ? "" : today);
  const [toDate, setToDate] = useState(mode === "outstanding" ? "" : today);
  const [rows, setRows] = useState<VendorTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const withBalance = (rows: VendorTableRow[], dr: string, cr: string) => {
  let b = 0;
  return rows.map((r: any) => {
    b += (Number(r[cr]) || 0) - (Number(r[dr]) || 0);
    return { ...r, BALANCE: b };
  }) as VendorTableRow[];
 };

  // const columns = useMemo<ColumnDef<VendorTableRow>[]>(() => {
  //   if (mode === "outstanding") {
  //     return [
  //       { accessorKey: "AC_CODE", header: "Vendor Code" },
  //       { accessorKey: "AC_DESC", header: "Vendor Name" },
  //       { accessorKey: "DOC_NO", header: "Doc No" },
  //       { accessorKey: "DOC_DATE", header: "Doc Date" },
  //       { accessorKey: "DR_AMOUNT", header: "Debit" },
  //       { accessorKey: "CR_AMOUNT", header: "Credit" },
  //       { accessorKey: "BALANCE", header: "Balance" },
  //     ];
  //   }
  //   if (mode === "status") {
  //     return [
  //       { accessorKey: "DOC_NO", header: "Invoice No" },
  //       { accessorKey: "DOC_DATE", header: "Invoice Date" },
  //       { accessorKey: "AC_CODE", header: "Vendor Code" },
  //       { accessorKey: "AC_DESC", header: "Vendor Name" },
  //       { accessorKey: "LAST_ACTION", header: "Status" },
  //       { accessorKey: "NET_AMOUNT", header: "Amount" },
  //     ];
  //   }
  //   return [
  //     { accessorKey: "DOC_DATE", header: "Date" },
  //     { accessorKey: "DOC_NO", header: "Doc No" },
  //     { accessorKey: "NARRATION", header: "Narration" },
  //     { accessorKey: "DR_AMOUNT", header: "Debit" },
  //     { accessorKey: "CR_AMOUNT", header: "Credit" },
  //     { accessorKey: "BALANCE", header: "Balance" },
  //   ];
  // }, [mode]);

  const columns = useMemo<ColumnDef<VendorTableRow>[]>(() => {
  if (mode === "outstanding") {
    return [
      { id: "DOC_TYPE", header: "Doc Type",
        accessorFn: (r: any) => (r.DOC_TYPE?.trim() ? r.DOC_TYPE : (r.REMARKS ?? "").substring(0, 3)) },
      { accessorKey: "INV_NO", header: "Invoice No" },
      { accessorKey: "INV_DATE", header: "Invoice Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "DOC_NO", header: "Doc Ref No" },
      { id: "REMARKS", header: "Remark", accessorFn: (r: any) => (r.REMARKS ?? "").substring(3) },
      { accessorKey: "DEBIT_AMOUNT", header: "Debit Amt", cell: ({ getValue }) => amtCell(getValue()) },
      { accessorKey: "CREDIT_AMOUNT", header: "Credit Amt", cell: ({ getValue }) => amtCell(getValue()) },
      { accessorKey: "BALANCE", header: "Balance", cell: ({ getValue }) => amtCell(getValue()) },
    ];
  }
  if (mode === "status") {
    return [
      { accessorKey: "DOC_TYPE", header: "Doc Type" },
      { accessorKey: "PO_NO", header: "PO No" },
      { accessorKey: "PO_DATE", header: "PO Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "PI_DOC_NO", header: "Invoice No",
        cell: ({ getValue }) => { const v = getValue(); return v === 0 || v === "0" ? "" : (v as any); } },
      { accessorKey: "INV_DATE", header: "Invoice Date", cell: ({ getValue }) => fmtDate(getValue()) },
      { accessorKey: "AMOUNT", header: "Amount", cell: ({ getValue }) => amtCell(getValue()) },
      { accessorKey: "DIV_NAME", header: "Division Name" },
      { accessorKey: "PAY_STATUS", header: "Status", cell: ({ getValue }) => statusCell(getValue()) },
    ];
  }
  return [
    { accessorKey: "INV_NO", header: "Invoice No" },
    { accessorKey: "INV_DATE", header: "Invoice Date", cell: ({ getValue }) => fmtDate(getValue()) },
    { accessorKey: "DOC_TYPE", header: "Doc Type" },
    { accessorKey: "DOC_NO", header: "Doc No" },
    { accessorKey: "DOC_DATE", header: "Doc Date", cell: ({ getValue }) => fmtDate(getValue()) },
    { accessorKey: "REMARKS", header: "Remark" },
    { accessorKey: "DEBIT_AMT", header: "Debit Amt", cell: ({ getValue }) => amtCell(getValue()) },
    { accessorKey: "CREDIT_AMT", header: "Credit Amt", cell: ({ getValue }) => amtCell(getValue()) },
    { accessorKey: "BALANCE", header: "Balance", cell: ({ getValue }) => amtCell(getValue()) },
  ];
}, [mode]);

  const search = async () => {
  setNotice(null);
  if (!acCode) {
    setNotice({ type: "error", message: "Vendor code is required." });
    return;
  }
  if (mode === "status" && (!fromDate || !toDate)) {
    setNotice({ type: "error", message: "From and To dates are required." });
    return;
  }
  setLoading(true);
  try {
    const from = toDMY(fromDate);
    const to = toDMY(toDate);
    // if (mode === "outstanding") setRows(withBalance(await getVendorOutstanding(acCode, user?.company_code), "DEBIT_AMOUNT", "CREDIT_AMOUNT"));
    if (mode === "outstanding") {
      const all = withBalance(await getVendorOutstanding(acCode, user?.company_code), "DEBIT_AMOUNT", "CREDIT_AMOUNT");
      setRows(all.filter((r: any) => inRange(r.INV_DATE, fromDate, toDate)));
   }
    if (mode === "status") setRows(await getVendorInvoiceStatus(acCode, from, to, user?.company_code));
    if (mode === "statement") setRows(withBalance(await getVendorStatement(acCode, from, to, user?.company_code), "DEBIT_AMT", "CREDIT_AMT"));
  } catch (err) {
    setNotice({ type: "error", message: err instanceof Error ? err.message : "Unable to load vendor inquiry" });
  } finally {
    setLoading(false);
  }
};

  return (
    <section className="grid gap-4">
      <VendorPageHeader title={titles[mode]}/>
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-7">
          {/* <Field label="Vendor Code" value={acCode} onChange={setAcCode} required /> */}
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
