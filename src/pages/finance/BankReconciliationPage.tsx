import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Save, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { getDynamicLookupaccount, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type ReconRow = {
  doc_type: string;
  doc_no: string;
  doc_date?: string;
  cheque_no?: string;
  cheque_date?: string;
  amount?: number;
  recon_ind: string;
  recon_date?: string;
  bank_code?: string;
};

type FilterState = {
  division: string;
  divisionName: string;
  bankAccount: string;
  bankAccountName: string;
  docType: string;
  docDateFrom: string;
  docDateTo: string;
  chequeDateFrom: string;
  chequeDateTo: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function BankReconciliationPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    division: "",
    divisionName: "",
    bankAccount: "",
    bankAccountName: "",
    docType: "",
    docDateFrom: "",
    docDateTo: "",
    chequeDateFrom: "",
    chequeDateTo: "",
  });
  const [docTypes, setDocTypes] = useState<LookupRow[]>([]);
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    void getDynamicLookupaccount({ parameter: "BANK_RECONCILIATION_GET_DOCUMENT_TYPE", loginid: user?.loginid || "", code1: user?.company_code || "" })
      .then(setDocTypes)
      .catch(() => setDocTypes([]));
  }, [user?.loginid]);

  const retrieve = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookupaccount({
        parameter: "BANK_RECONCILIATION_GET_DETAIL_DATA",
        loginid: user?.loginid || "",
        code1: user?.company_code || "",
        code2: filters.docType,
        code3: filters.bankAccount,
        code4: filters.division,
        code5: filters.docDateFrom,
        code6: filters.docDateTo,
        code7: filters.chequeDateFrom,
        code8: filters.chequeDateTo,
      });
      setRows(data.map(mapRecon));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to retrieve reconciliation data" });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const selected = rows.filter((row) => row.recon_ind === "Y");
    if (selected.length === 0) {
      setNotice({ type: "error", message: "Select at least one reconciled row" });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await api.post("/api/finance/updBankReconBulk", {
        loginid: user?.loginid,
        details: selected.map((row) => ({
          doc_type: row.doc_type,
          doc_no: row.doc_no,
          cheque_no: row.cheque_no,
          recon_ind: row.recon_ind,
          recon_date: row.recon_date || today(),
          company_code: user?.company_code,
        })),
      });
      if (!response.data?.success) throw new Error(response.data?.message || "Unable to update reconciliation");
      setNotice({ type: "success", message: response.data.message || "Reconciliation updated successfully" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save reconciliation" });
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (index: number, patch: Partial<ReconRow>) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  const columns = useMemo<ColumnDef<ReconRow>[]>(() => [
    { accessorKey: "doc_type", header: "Type" },
    { accessorKey: "doc_no", header: "Doc No", cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span> },
    { accessorKey: "doc_date", header: "Doc Date", cell: ({ getValue }) => dateInput(getValue()) },
    { accessorKey: "cheque_no", header: "Cheque No" },
    { accessorKey: "cheque_date", header: "Cheque Date", cell: ({ getValue }) => dateInput(getValue()) },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => formatAmount(Number(getValue() || 0)) },
    {
      accessorKey: "recon_ind",
      header: "Recon",
      cell: ({ row }) => (
        <input
          checked={row.original.recon_ind === "Y"}
          className="h-4 w-4 accent-[var(--primary)]"
          onChange={(event) => updateRow(row.index, { recon_ind: event.target.checked ? "Y" : "N", recon_date: event.target.checked ? row.original.recon_date || today() : "" })}
          type="checkbox"
        />
      ),
    },
    {
      accessorKey: "recon_date",
      header: "Recon Date",
      cell: ({ row }) => <Input className="h-8" type="date" value={dateInput(row.original.recon_date)} onChange={(event) => updateRow(row.index, { recon_date: event.target.value })} />,
    },
    { accessorKey: "bank_code", header: "Bank" },
  ], []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Retrieve cheque transactions and update reconciliation status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void retrieve()}><RefreshCw size={15} /> Retrieve</Button>
          <Button disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <Card className="p-4">
        <form className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1" onSubmit={retrieve}>
          <LookupField
            label="Division"
            value={filters.division}
            displayValue={filters.divisionName ? `${filters.division} - ${filters.divisionName}` : filters.division}
            columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            loadOptions={() => getDynamicLookupaccount({ parameter: "BANK_RECONCILIATION_GET_DIVISION", loginid: user?.loginid || "", code1: user?.company_code || "" })}
            onChange={(value, row) => setFilters((current) => ({ ...current, division: value, divisionName: String(getLookupValue(row || {}, "div_name") || "") }))}
          />
          <LookupField
            label="Bank Account"
            value={filters.bankAccount}
            displayValue={filters.bankAccountName ? `${filters.bankAccount} - ${filters.bankAccountName}` : filters.bankAccount}
            columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }]}
            valueField="ac_code"
            displayFields={["ac_code", "ac_name"]}
            loadOptions={() => getDynamicLookupaccount({ parameter: "BANK_RECONCILIATION_GET_BANK_ACCOUNT", loginid: user?.loginid || "", code1: user?.company_code || "" })}
            onChange={(value, row) => setFilters((current) => ({ ...current, bankAccount: value, bankAccountName: String(getLookupValue(row || {}, "ac_name") || "") }))}
          />
          <label className="field"><span>Document Type</span><Select value={filters.docType} onChange={(event) => setFilters((current) => ({ ...current, docType: event.target.value }))}><option value="">All</option>{docTypes.map((type, index) => <option key={`${getLookupValue(type, "doc_id")}_${index}`} value={String(getLookupValue(type, "doc_id") || "")}>{String(getLookupValue(type, "doc_id") || "")}</option>)}</Select></label>
          <label className="field"><span>Doc Date From</span><Input type="date" value={filters.docDateFrom} onChange={(event) => setFilters((current) => ({ ...current, docDateFrom: event.target.value }))} /></label>
          <label className="field"><span>Doc Date To</span><Input type="date" value={filters.docDateTo} onChange={(event) => setFilters((current) => ({ ...current, docDateTo: event.target.value }))} /></label>
          <label className="field"><span>Cheque Date From</span><Input type="date" value={filters.chequeDateFrom} onChange={(event) => setFilters((current) => ({ ...current, chequeDateFrom: event.target.value }))} /></label>
          <label className="field"><span>Cheque Date To</span><Input type="date" value={filters.chequeDateTo} onChange={(event) => setFilters((current) => ({ ...current, chequeDateTo: event.target.value }))} /></label>
          <div className="flex items-end"><Button className="w-full" type="submit"><Search size={15} /> Retrieve</Button></div>
        </form>
      </Card>

      <DataTable columns={columns} data={rows} title={loading ? "Loading" : `${rows.length} Rows`} subtitle="Reconciliation" loading={loading} height={560} minWidth={1060} density="grid" />
    </section>
  );
}

function mapRecon(row: LookupRow): ReconRow {
  return {
    doc_type: String(getLookupValue(row, "doc_type") || ""),
    doc_no: String(getLookupValue(row, "doc_no") || ""),
    doc_date: String(getLookupValue(row, "doc_date") || ""),
    cheque_no: String(getLookupValue(row, "cheque_no") || ""),
    cheque_date: String(getLookupValue(row, "cheque_date") || ""),
    amount: Number(getLookupValue(row, "amount") || 0),
    recon_ind: String(getLookupValue(row, "recon_ind") || "N"),
    recon_date: String(getLookupValue(row, "recon_date") || ""),
    bank_code: String(getLookupValue(row, "bank_code") || ""),
  };
}

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function formatAmount(value: number) {
  const amount = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return value < 0 ? `(${amount})` : amount;
}
