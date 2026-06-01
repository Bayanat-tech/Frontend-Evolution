import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, ArrowRight, Printer, RefreshCw, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../api/client";
import { getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

type ChequeRow = {
  id: string;
  cheque_no: string;
  cheque_date: string;
  cheque_bank: string;
  doc_type: string;
  doc_no: string;
  amount: number;
  curr_code: string;
};

export function ChequeDepositSlipPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [filters, setFilters] = useState({ division: "", divisionName: "", bank_ac: "", bankName: "", doc_date_from: "", doc_date_to: "", cheque_date_from: "", cheque_date_to: "", cheque_no: "" });
  const [available, setAvailable] = useState<ChequeRow[]>([]);
  const [selectedAvailable, setSelectedAvailable] = useState<Record<string, boolean>>({});
  const [depositItems, setDepositItems] = useState<ChequeRow[]>([]);
  const [selectedDeposit, setSelectedDeposit] = useState<Record<string, boolean>>({});
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const retrieve = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const where = [
        `C.COMPANY_CODE = '${escapeSql(companyCode)}'`,
        filters.doc_date_from ? `C.DOC_DATE >= TO_DATE('${filters.doc_date_from}','YYYY-MM-DD')` : "",
        filters.doc_date_to ? `C.DOC_DATE <= TO_DATE('${filters.doc_date_to}','YYYY-MM-DD')` : "",
        filters.cheque_date_from ? `C.CHEQUE_DATE >= TO_DATE('${filters.cheque_date_from}','YYYY-MM-DD')` : "",
        filters.cheque_date_to ? `C.CHEQUE_DATE <= TO_DATE('${filters.cheque_date_to}','YYYY-MM-DD')` : "",
        filters.cheque_no ? `C.CHEQUE_NO LIKE '%${escapeSql(filters.cheque_no)}%'` : "",
      ].filter(Boolean).join(" AND ");
      const rawSql = `SELECT C.CHEQUE_NO, C.CHEQUE_DATE, C.CHEQUE_BANK, C.DOC_TYPE, C.DOC_NO, C.AMOUNT, C.CURR_CODE FROM MS_CHEQUE C WHERE ${where} ORDER BY C.CHEQUE_DATE DESC`;
      const response = await api.post("/api/wms/inbound/executeRawSql", { raw_sql: rawSql });
      const data = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
      setAvailable(data.map(mapCheque));
      setSelectedAvailable({});
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to retrieve cheques" });
    } finally {
      setLoading(false);
    }
  };

  const moveRight = () => {
    const existing = new Set(depositItems.map((row) => row.id));
    const additions = available.filter((row) => selectedAvailable[row.id] && !existing.has(row.id));
    setDepositItems((prev) => [...prev, ...additions]);
    setSelectedAvailable({});
  };

  const moveLeft = () => {
    setDepositItems((prev) => prev.filter((row) => !selectedDeposit[row.id]));
    setSelectedDeposit({});
  };

  const save = async () => {
    if (!docDate || !filters.bank_ac || depositItems.length === 0) {
      setNotice({ type: "error", message: "Doc date, bank account and deposit items are required." });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await postFinance("insUpdChqDepositBulk", {
        header: {
          company_code: companyCode,
          doc_type: "BD",
          doc_no: docNo || 0,
          doc_date: docDate,
          bank_ac_code: filters.bank_ac,
          ac_code: filters.bank_ac,
          remarks,
          user_id: loginId,
          user_dt: new Date().toISOString(),
          div_code: filters.division,
        },
        details: depositItems.map((row, index) => ({
          company_code: companyCode,
          doc_type: "BD",
          doc_no: docNo || 0,
          serial_no: index + 1,
          cheque_no: row.cheque_no,
          cheque_date: row.cheque_date,
          cheque_bank: row.cheque_bank,
          curr_code: row.curr_code,
          amount: row.amount,
          ref_doc_type: row.doc_type,
          ref_doc_no: row.doc_no,
          user_id: loginId,
          user_dt: new Date().toISOString(),
          div_code: filters.division,
        })),
      });
      setNotice({ type: "success", message: "Cheque deposit saved successfully" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save cheque deposit" });
    } finally {
      setLoading(false);
    }
  };

  const total = depositItems.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const leftColumns = useMemo(() => chequeColumns(selectedAvailable, setSelectedAvailable), [selectedAvailable]);
  const rightColumns = useMemo(() => chequeColumns(selectedDeposit, setSelectedDeposit, true), [selectedDeposit]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="m-0 text-2xl font-semibold tracking-tight">Cheque Deposit Slip</h1></div>
        <div className="flex flex-wrap items-center justify-end gap-2"><Button variant="outline" disabled={loading} onClick={() => void retrieve()}><RefreshCw size={15} /> Retrieve</Button><Button disabled={loading} onClick={() => void save()}><Save size={15} /> Save Deposit</Button><Button variant="secondary" onClick={() => window.print()}><Printer size={15} /> Print</Button></div>
      </div>
      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <Card>
        <CardHeader className="border-b"><h2 className="m-0 text-base font-semibold">Filters</h2></CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-4">
          <LookupField label="Division" value={filters.division} displayValue={display(filters.division, filters.divisionName)} columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]} valueField="div_code" displayFields={["div_code", "div_name"]} loadOptions={() => getDynamicLookup({ parameter: "Account_division", loginid: loginId, code1: companyCode })} onChange={(value, row) => setFilters((prev) => ({ ...prev, division: value, divisionName: String(getLookupValue(row || {}, "div_name") || "") }))} />
          <LookupField label="Bank A/C" value={filters.bank_ac} displayValue={display(filters.bank_ac, filters.bankName)} columns={[{ field: "ac_code", header: "A/C Code" }, { field: "ac_name", header: "A/C Name" }]} valueField="ac_code" displayFields={["ac_code", "ac_name"]} loadOptions={() => getDynamicLookup({ parameter: "BANK_RECONCILIATION_GET_BANK_ACCOUNT", loginid: loginId, code1: companyCode })} onChange={(value, row) => setFilters((prev) => ({ ...prev, bank_ac: value, bankName: String(getLookupValue(row || {}, "ac_name") || "") }))} />
          <label className="field"><span>Doc Date From</span><Input type="date" value={filters.doc_date_from} onChange={(event) => setFilters((prev) => ({ ...prev, doc_date_from: event.target.value }))} /></label>
          <label className="field"><span>Doc Date To</span><Input type="date" value={filters.doc_date_to} onChange={(event) => setFilters((prev) => ({ ...prev, doc_date_to: event.target.value }))} /></label>
          <label className="field"><span>Cheque Date From</span><Input type="date" value={filters.cheque_date_from} onChange={(event) => setFilters((prev) => ({ ...prev, cheque_date_from: event.target.value }))} /></label>
          <label className="field"><span>Cheque Date To</span><Input type="date" value={filters.cheque_date_to} onChange={(event) => setFilters((prev) => ({ ...prev, cheque_date_to: event.target.value }))} /></label>
          <label className="field"><span>Cheque No</span><Input value={filters.cheque_no} onChange={(event) => setFilters((prev) => ({ ...prev, cheque_no: event.target.value }))} /></label>
          <label className="field"><span>Deposit Date</span><Input type="date" value={docDate} onChange={(event) => setDocDate(event.target.value)} /></label>
          <label className="field md:col-span-2"><span>Deposit Doc No</span><Input value={docNo} onChange={(event) => setDocNo(event.target.value)} placeholder="Autogenerated or manual" /></label>
          <label className="field md:col-span-2"><span>Remarks</span><Input value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 max-xl:grid-cols-1">
        <DataTable columns={leftColumns} data={available} title={`${available.length} Cheques`} subtitle="Available Cheques" loading={loading} height={430} minWidth={780} density="grid" getRowId={(row) => row.id} />
        <div className="flex flex-col items-center justify-center gap-2 max-xl:flex-row"><Button size="icon" onClick={moveRight}><ArrowRight size={16} /></Button><Button size="icon" variant="outline" onClick={moveLeft}><ArrowLeft size={16} /></Button></div>
        <DataTable columns={rightColumns} data={depositItems} title={`${depositItems.length} Items`} subtitle="Deposit Slip Items" height={430} minWidth={780} density="grid" getRowId={(row) => row.id} toolbar={<div className="text-sm font-semibold text-primary">Total {total.toFixed(3)}</div>} />
      </div>
    </section>
  );
}

function chequeColumns(selected: Record<string, boolean>, setSelected: (next: Record<string, boolean>) => void, removable = false): ColumnDef<ChequeRow>[] {
  return [
    { id: "select", header: "", size: 42, enableSorting: false, cell: ({ row }) => <input className="h-4 w-4 accent-[var(--primary)]" type="checkbox" checked={Boolean(selected[row.original.id])} onChange={(event) => setSelected({ ...selected, [row.original.id]: event.target.checked })} /> },
    { accessorKey: "cheque_no", header: "Cheque No", size: 130 },
    { accessorKey: "cheque_date", header: "Cheque Date", size: 120 },
    { accessorKey: "cheque_bank", header: "Cheque Bank", size: 140 },
    { accessorKey: "doc_type", header: "Doc Type", size: 100 },
    { accessorKey: "doc_no", header: "Doc No", size: 120 },
    { accessorKey: "amount", header: "Amount", size: 110, cell: ({ getValue }) => Number(getValue() || 0).toFixed(3) },
    ...(removable ? [{ id: "remove", header: "", size: 42, cell: () => <Trash2 size={14} className="text-muted-foreground" /> } as ColumnDef<ChequeRow>] : []),
  ];
}

function mapCheque(row: LookupRow, index: number): ChequeRow {
  const chequeNo = String(getLookupValue(row, "CHEQUE_NO") || getLookupValue(row, "cheque_no") || "");
  const docNo = String(getLookupValue(row, "DOC_NO") || getLookupValue(row, "doc_no") || "");
  return { id: `${chequeNo}_${docNo}_${index}`, cheque_no: chequeNo, cheque_date: dateInput(getLookupValue(row, "CHEQUE_DATE") || getLookupValue(row, "cheque_date")), cheque_bank: String(getLookupValue(row, "CHEQUE_BANK") || getLookupValue(row, "cheque_bank") || ""), doc_type: String(getLookupValue(row, "DOC_TYPE") || getLookupValue(row, "doc_type") || ""), doc_no: docNo, amount: Number(getLookupValue(row, "AMOUNT") || getLookupValue(row, "amount") || 0), curr_code: String(getLookupValue(row, "CURR_CODE") || getLookupValue(row, "curr_code") || "") };
}

function display(code: string, name: string) { return code ? (name ? `${code} - ${name}` : code) : ""; }
function today() { return new Date().toISOString().slice(0, 10); }
function dateInput(value: unknown) { if (!value) return ""; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10); }
function escapeSql(value: string) { return value.replace(/'/g, "''"); }
