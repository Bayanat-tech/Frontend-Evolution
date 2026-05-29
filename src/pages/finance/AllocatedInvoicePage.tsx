import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Save, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

type InvoiceLine = {
  id: string;
  sr: number;
  inv_no: string;
  inv_date: string;
  balance_amount: number;
  amount: number;
  org_curr_code: string;
};

export function AllocatedInvoicePage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(today());
  const [division, setDivision] = useState("");
  const [divisionName, setDivisionName] = useState("");
  const [acCode, setAcCode] = useState("");
  const [acName, setAcName] = useState("");
  const [scope, setScope] = useState("");
  const [remarks, setRemarks] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const total = lines.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const columns = useMemo<ColumnDef<InvoiceLine>[]>(() => [
    { accessorKey: "sr", header: "Sr.", size: 60 },
    { accessorKey: "inv_no", header: "Invoice No", size: 160, cell: ({ row }) => <Input className="h-8" value={row.original.inv_no} onChange={(event) => patchLine(row.original.id, { inv_no: event.target.value })} /> },
    { accessorKey: "inv_date", header: "Invoice Date", size: 140, cell: ({ row }) => <Input className="h-8" type="date" value={row.original.inv_date} onChange={(event) => patchLine(row.original.id, { inv_date: event.target.value })} /> },
    { accessorKey: "balance_amount", header: "Balance", size: 130, cell: ({ row }) => <Input className="h-8 text-right tabular-nums" value={String(row.original.balance_amount)} onChange={(event) => patchLine(row.original.id, { balance_amount: num(event.target.value) })} /> },
    { accessorKey: "amount", header: "Amount", size: 130, cell: ({ row }) => <Input className="h-8 text-right tabular-nums" value={String(row.original.amount)} onChange={(event) => patchLine(row.original.id, { amount: num(event.target.value) })} /> },
    { accessorKey: "org_curr_code", header: "Currency", size: 120, cell: ({ row }) => <Input className="h-8" value={row.original.org_curr_code} onChange={(event) => patchLine(row.original.id, { org_curr_code: event.target.value })} /> },
    { id: "actions", header: "", size: 44, cell: ({ row }) => <Button size="icon" variant="ghost" onClick={() => removeLine(row.original.id)}><Trash2 size={14} /></Button> },
  ], [lines]);

  const patchLine = (id: string, patch: Partial<InvoiceLine>) => {
    setLines((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((row) => row.id !== id).map((row, index) => ({ ...row, sr: index + 1 })));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { id: `line_${Date.now()}`, sr: prev.length + 1, inv_no: "", inv_date: "", balance_amount: 0, amount: 0, org_curr_code: "" }]);
  };

  const handleSave = (action: "draft" | "submit") => {
    setNotice({
      type: "error",
      message: `Allocated Invoice ${action === "draft" ? "draft" : "submit"} backend endpoint was not present in the scanned Bayanat code. UI and line editing are ready; backend save mapping still needs the real procedure/API.`,
    });
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Allocated Invoice</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => handleSave("draft")}><Save size={15} /> Save Draft</Button>
          <Button onClick={() => handleSave("submit")}><Send size={15} /> Submit</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Allocation Details</p>
              <h2 className="m-0 text-base font-semibold">Document {docNo || "Autogenerated"}</h2>
            </div>
            <div className="rounded-md border bg-secondary px-3 py-2 text-right">
              <span className="block text-[11px] uppercase text-muted-foreground">Total Amount</span>
              <strong>{total.toFixed(3)}</strong>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="field"><span>Doc No</span><Input value={docNo} onChange={(event) => setDocNo(event.target.value)} /></label>
            <label className="field"><span>Date</span><Input type="date" value={docDate} onChange={(event) => setDocDate(event.target.value)} /></label>
            <LookupField label="Division" value={division} displayValue={display(division, divisionName)} columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]} valueField="div_code" displayFields={["div_code", "div_name"]} loadOptions={() => getDynamicLookup({ parameter: "Account_division", loginid: loginId, code1: companyCode })} onChange={(value, row) => { setDivision(value); setDivisionName(String(getLookupValue(row || {}, "div_name") || "")); }} />
            <LookupField label="A/C Code" value={acCode} displayValue={display(acCode, acName)} columns={[{ field: "ac_code", header: "A/C Code" }, { field: "ac_name", header: "A/C Name" }, { field: "curr_code", header: "Currency" }]} valueField="ac_code" displayFields={["ac_code", "ac_name"]} loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach", loginid: loginId, code1: companyCode })} onChange={(value, row) => { setAcCode(value); setAcName(String(getLookupValue(row || {}, "ac_name") || "")); }} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field"><span>Scope of Work</span><textarea className="ui-textarea min-h-[70px]" value={scope} onChange={(event) => setScope(event.target.value)} /></label>
            <label className="field"><span>Remarks</span><textarea className="ui-textarea min-h-[70px]" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="field"><span>Cheque No</span><Input value={chequeNo} onChange={(event) => setChequeNo(event.target.value)} /></label>
            <label className="field"><span>Cheque Date</span><Input type="date" value={chequeDate} onChange={(event) => setChequeDate(event.target.value)} /></label>
            <label className="field"><span>Bank</span><Input value={bankName} onChange={(event) => setBankName(event.target.value)} /></label>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={lines} title={`${lines.length} Lines`} subtitle="Invoice Lines" height={430} minWidth={900} density="grid" getRowId={(row) => row.id} toolbar={<Button size="sm" onClick={addLine}><Plus size={14} /> Add Line</Button>} emptyText="No invoice lines added" />
    </section>
  );
}

function display(code: string, name: string) {
  return code ? (name ? `${code} - ${name}` : code) : "";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
