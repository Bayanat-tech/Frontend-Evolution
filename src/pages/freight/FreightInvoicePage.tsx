import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Eye, FileText, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { freightSelect } from "../../api/freight";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";

type InvoiceEditorMode = "add" | "view";

type InvoiceFormState = {
  invoice_no: string;
  invoice_date: string;
  from_date: string;
  to_date: string;
  prin_code: string;
  prin_name: string;
  curr_code: string;
  inv_status: string;
};

const today = new Date().toISOString().slice(0, 10);

export function FreightInvoicePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = text(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const loginId = text(userRecord.loginid || userRecord.LOGINID || userRecord.user_id || userRecord.USER_ID || "Admin");

  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [filterPrincipal, setFilterPrincipal] = useState("");
  const [filterPrincipalName, setFilterPrincipalName] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<InvoiceEditorMode>("add");
  const [form, setForm] = useState<InvoiceFormState>(emptyForm());
  const [candidateRows, setCandidateRows] = useState<LookupRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<LookupRow[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTotal = useMemo(
    () => selectedRows.reduce((sum, row) => sum + number(row, "bill"), 0),
    [selectedRows]
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/invoice/list", {
        company_code: companyCode,
        prin_code: filterPrincipal,
        from_date: filterFromDate,
        to_date: filterToDate,
        search: query,
      });
      setRows((response.data.data || []).map(normalizeRow));
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to load freight invoices.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyCode, filterFromDate, filterPrincipal, filterToDate, query, toast]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      accessorKey: "invoice_no",
      header: "Invoice No",
      size: 150,
      cell: ({ row }) => (
        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => void openExisting(row.original)}>
          {text(row.original.invoice_no)}
        </button>
      ),
    },
    { accessorKey: "invoice_date", header: "Date", size: 120, cell: ({ row }) => formatDate(text(row.original.invoice_date)) },
    { accessorKey: "prin_code", header: "Principal", size: 100 },
    { accessorKey: "prin_name", header: "Principal Name", size: 260, cell: ({ row }) => text(row.original.prin_name) || "-" },
    { accessorKey: "job_count", header: "Jobs", size: 80, cell: ({ row }) => centered(text(row.original.job_count) || "0") },
    { accessorKey: "line_count", header: "Lines", size: 80, cell: ({ row }) => centered(text(row.original.line_count) || "0") },
    { accessorKey: "curr_code", header: "Currency", size: 90 },
    { accessorKey: "inv_amount", header: "Amount", size: 130, cell: ({ row }) => money(number(row.original, "inv_amount")) },
    { accessorKey: "inv_status", header: "Status", size: 90, cell: ({ row }) => statusChip(text(row.original.inv_status)) },
    {
      id: "actions",
      header: "Actions",
      size: 80,
      enableColumnFilter: false,
      cell: ({ row }) => <Button type="button" size="icon" variant="ghost" title="View invoice" onClick={() => void openExisting(row.original)}><Eye size={14} /></Button>,
    },
  ], []);

  function openNew() {
    setEditorMode("add");
    setForm(emptyForm());
    setSelectedRows([]);
    setCandidateRows([]);
    setCandidateSearch("");
    setEditorOpen(true);
    void loadCandidateJobs("", "");
  }

  async function openExisting(row: LookupRow) {
    setEditorMode("view");
    setSaving(true);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow; jobSelection?: LookupRow[] } }>("/api/freight/invoice/get", {
        company_code: companyCode,
        invoice_no: text(row.invoice_no),
      });
      const header = normalizeRow(response.data.data?.header || row);
      const jobs = (response.data.data?.jobSelection || []).map(normalizeRow);
      setForm({
        invoice_no: text(header.invoice_no),
        invoice_date: inputDate(text(header.invoice_date)) || today,
        from_date: inputDate(text(header.from_date)),
        to_date: inputDate(text(header.to_date)),
        prin_code: text(header.prin_code),
        prin_name: text(header.prin_name),
        curr_code: text(header.curr_code) || "OMR",
        inv_status: text(header.inv_status) || "N",
      });
      setSelectedRows(jobs);
      setCandidateRows([]);
      setEditorOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to open freight invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function loadCandidateJobs(search = candidateSearch, prinCode = form.prin_code) {
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/invoice/job-selection", {
        company_code: companyCode,
        prin_code: prinCode,
        from_date: form.from_date || filterFromDate,
        to_date: form.to_date || filterToDate,
        search,
      });
      setCandidateRows((response.data.data || []).map(normalizeRow));
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to load billable freight jobs.");
      setCandidateRows([]);
    }
  }

  function toggleCandidate(row: LookupRow) {
    const key = lineKey(row);
    const exists = selectedRows.some((item) => lineKey(item) === key);
    if (exists) {
      setSelectedRows((prev) => prev.filter((item) => lineKey(item) !== key));
      return;
    }

    const rowPrin = text(row.prin_code);
    if (form.prin_code && rowPrin && form.prin_code !== rowPrin) {
      toast.error("One freight invoice can contain one principal only.");
      return;
    }

    if (!form.prin_code) {
      setForm((prev) => ({
        ...prev,
        prin_code: rowPrin,
        prin_name: text(row.prin_name),
      }));
    }
    setSelectedRows((prev) => [...prev, row]);
  }

  function removeSelected(row: LookupRow) {
    setSelectedRows((prev) => prev.filter((item) => lineKey(item) !== lineKey(row)));
  }

  async function saveInvoice() {
    if (!selectedRows.length) {
      toast.error("Select at least one confirmed freight job activity.");
      return;
    }
    if (!form.prin_code) {
      toast.error("Principal is required.");
      return;
    }

    setSaving(true);
    try {
      const invoiceHeader = [{
        company_code: companyCode,
        invoice_no: form.invoice_no,
        invoice_date: form.invoice_date || today,
        from_date: form.from_date || null,
        to_date: form.to_date || null,
        job_no: unique(selectedRows.map((row) => text(row.job_no))).length === 1 ? text(selectedRows[0].job_no) : "",
        prin_code: form.prin_code,
        cust_code: form.prin_code,
        inv_amount: selectedTotal,
        curr_code: form.curr_code || "OMR",
        inv_status: form.inv_status || "N",
        user_id: loginId,
      }];

      const invoiceDetails = selectedRows.map((row, index) => ({
        company_code: companyCode,
        invoice_no: form.invoice_no,
        srno: index + 1,
        act_code: text(row.act_code),
        bill: number(row, "bill"),
        cost: number(row, "actual_cost"),
        quantity: number(row, "quantity") || 1,
        bill_rate: number(row, "bill_rate"),
        cost_rate: number(row, "cost_rate"),
        inv_desc: text(row.activity),
        user_id: loginId,
      }));

      const jobSelection = selectedRows.map((row) => ({
        ...row,
        company_code: companyCode,
        selected: "Y",
      }));

      const response = await api.post<{ success?: boolean; message?: string; data?: { invoice_no?: string } }>("/api/freight/invoice/save", {
        invoiceHeader,
        invoiceDetails,
        jobSelection,
      });

      if (!response.data.success) throw new Error(response.data.message || "Unable to save freight invoice.");
      toast.success(`Freight invoice ${response.data.data?.invoice_no || ""} saved.`);
      setEditorOpen(false);
      await loadRows();
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || error?.message || "Unable to save freight invoice.");
    } finally {
      setSaving(false);
    }
  }

  const selectedKeys = useMemo(() => new Set(selectedRows.map(lineKey)), [selectedRows]);
  const readOnly = editorMode === "view";

  return (
    <section className="grid gap-3">
      <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <div>
              <p className="eyebrow m-0">Freight Billing</p>
              <h1 className="m-0 text-2xl font-semibold text-foreground">Freight Invoice</h1>
              <p className="m-0 mt-1 text-sm text-muted-foreground">Create invoices from confirmed Freight job activity lines.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void loadRows()} disabled={loading}><RefreshCw size={15} />Refresh</Button>
            <Button type="button" onClick={openNew}><Plus size={15} />Add Invoice</Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[170px_170px_minmax(260px,1fr)_auto_auto]">
          <Field label="From"><Input type="date" value={filterFromDate} onChange={(event) => setFilterFromDate(event.target.value)} /></Field>
          <Field label="To"><Input type="date" value={filterToDate} onChange={(event) => setFilterToDate(event.target.value)} /></Field>
          <Field label="Principal">
            <LookupField
              compact
              value={filterPrincipal}
              displayValue={filterPrincipal ? [filterPrincipal, filterPrincipalName].filter(Boolean).join(" - ") : ""}
              valueField="prin_code"
              displayFields={["prin_code", "prin_name"]}
              columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Principal" }, { field: "curr_code", header: "Currency" }]}
              loadOptions={(search) => loadFreightLookup("freight_principal", companyCode, search)}
              onChange={(value, row) => {
                setFilterPrincipal(value);
                setFilterPrincipalName(text(row?.prin_name ?? row?.PRIN_NAME));
              }}
              placeholder="All principals"
            />
          </Field>
          <Button type="button" className="self-end" onClick={() => void loadRows()} disabled={loading}><Search size={14} />Run</Button>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setFilterFromDate("");
              setFilterToDate("");
              setFilterPrincipal("");
              setFilterPrincipalName("");
              setQuery("");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search invoice, principal, job..."
        title={`${rows.length} Freight Invoices`}
        subtitle="Invoice register"
        height="calc(100vh - 340px)"
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={50}
        enableExport
        exportFilename="freight-invoice-list.csv"
        getRowId={(row, index) => text(row.invoice_no) || String(index)}
        onRowClick={(row) => void openExisting(row)}
      />

      <Dialog
        open={editorOpen}
        wide
        title={readOnly ? "View Freight Invoice" : "Add Freight Invoice"}
        description={readOnly ? form.invoice_no : "Select confirmed Freight service lines and create an invoice."}
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Close</Button>
            {!readOnly && <Button type="button" onClick={() => void saveInvoice()} disabled={saving || !selectedRows.length}><Save size={14} />{saving ? "Saving" : "Save Invoice"}</Button>}
          </>
        }
      >
        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-4">
            <MetricCard label="Selected Jobs" value={String(unique(selectedRows.map((row) => text(row.job_no))).length)} />
            <MetricCard label="Activity Lines" value={String(selectedRows.length)} />
            <MetricCard label="Invoice Amount" value={`${selectedTotal.toFixed(3)} ${form.curr_code || "OMR"}`} highlight />
            <MetricCard label="Status" value={readOnly ? "View" : "Draft"} />
          </div>

          <div className="rounded-md border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/25 px-3 py-2">
              <Calculator size={15} className="text-primary" />
              <h2 className="m-0 text-sm font-semibold text-foreground">Invoice Header</h2>
            </div>
          <div className="grid gap-2 p-3 md:grid-cols-6">
            <Field label="Invoice No"><Input value={form.invoice_no || "Auto"} disabled /></Field>
            <Field label="Invoice Date"><Input type="date" value={form.invoice_date} disabled={readOnly} onChange={(event) => setFormField("invoice_date", event.target.value)} /></Field>
            <Field label="From Date"><Input type="date" value={form.from_date} disabled={readOnly} onChange={(event) => setFormField("from_date", event.target.value)} /></Field>
            <Field label="To Date"><Input type="date" value={form.to_date} disabled={readOnly} onChange={(event) => setFormField("to_date", event.target.value)} /></Field>
            <Field label="Principal">
              <LookupField
                compact
                disabled={readOnly || selectedRows.length > 0}
                value={form.prin_code}
                displayValue={principalText(form)}
                valueField="prin_code"
                displayFields={["prin_code", "prin_name"]}
                columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Principal" }, { field: "curr_code", header: "Currency" }]}
                loadOptions={(search) => loadFreightLookup("freight_principal", companyCode, search)}
                onChange={(value, row) => {
                  setForm((prev) => ({ ...prev, prin_code: value, prin_name: text(row?.prin_name ?? row?.PRIN_NAME), curr_code: text(row?.curr_code ?? row?.CURR_CODE) || prev.curr_code }));
                  setCandidateRows([]);
                }}
                placeholder="Select principal"
              />
            </Field>
            <Field label="Amount"><Input value={selectedTotal.toFixed(3)} disabled className="text-right font-semibold" /></Field>
          </div>
          </div>

          {!readOnly && (
            <div className="rounded-md border">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b bg-muted/25 p-3">
                <div>
                  <h2 className="m-0 text-sm font-semibold text-foreground">Billable Freight Lines</h2>
                  <p className="m-0 text-xs text-muted-foreground">Confirmed job activity lines not yet consolidated into another invoice.</p>
                </div>
                <div className="flex min-w-[360px] items-center gap-2">
                  <Input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search job, activity..." />
                  <Button type="button" variant="outline" onClick={() => void loadCandidateJobs()}><Search size={14} />Find</Button>
                </div>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="w-12 px-2 py-2 text-center">Use</th>
                      <th className="px-2 py-2 text-left">Job</th>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Principal</th>
                      <th className="px-2 py-2 text-left">Activity</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Bill</th>
                      <th className="px-2 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidateRows.map((row) => (
                      <tr key={lineKey(row)} className="border-t hover:bg-primary/5">
                        <td className="px-2 py-2 text-center"><input type="checkbox" checked={selectedKeys.has(lineKey(row))} onChange={() => toggleCandidate(row)} /></td>
                        <td className="px-2 py-2 font-semibold text-primary">{text(row.job_no)}</td>
                        <td className="px-2 py-2">{formatDate(text(row.job_date))}</td>
                        <td className="px-2 py-2">{text(row.prin_code)} - {text(row.prin_name)}</td>
                        <td className="px-2 py-2">{text(row.act_code)} - {text(row.activity)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row, "quantity").toFixed(3)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row, "bill").toFixed(3)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row, "actual_cost").toFixed(3)}</td>
                      </tr>
                    ))}
                    {!candidateRows.length && <tr><td className="px-2 py-8 text-center text-muted-foreground" colSpan={8}>No confirmed billable Freight activity lines found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-md border">
            <div className="flex items-center justify-between border-b bg-muted/25 p-3">
              <div>
                <h2 className="m-0 text-sm font-semibold text-foreground">Selected Invoice Lines</h2>
                <p className="m-0 text-xs text-muted-foreground">{selectedRows.length} lines / {unique(selectedRows.map((row) => text(row.job_no))).length} jobs</p>
              </div>
              <div className="text-right">
                <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Invoice Amount</p>
                <p className="m-0 text-lg font-bold text-primary">{selectedTotal.toFixed(3)} {form.curr_code || "OMR"}</p>
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-2 py-2 text-left">Job</th>
                    <th className="px-2 py-2 text-left">Activity</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Rate</th>
                    <th className="px-2 py-2 text-right">Bill</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                    {!readOnly && <th className="px-2 py-2 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.map((row) => (
                    <tr key={lineKey(row)} className="border-t">
                      <td className="px-2 py-2 font-semibold text-primary">{text(row.job_no)}</td>
                      <td className="px-2 py-2">{text(row.act_code)} - {text(row.activity)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{number(row, "quantity").toFixed(3)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{number(row, "bill_rate").toFixed(3)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{number(row, "bill").toFixed(3)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{number(row, "actual_cost").toFixed(3)}</td>
                      {!readOnly && <td className="px-2 py-2 text-right"><Button type="button" size="icon" variant="ghost" onClick={() => removeSelected(row)}><Trash2 size={14} /></Button></td>}
                    </tr>
                  ))}
                  {!selectedRows.length && <tr><td className="px-2 py-8 text-center text-muted-foreground" colSpan={readOnly ? 6 : 7}>No lines selected.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Dialog>
    </section>
  );

  function setFormField(key: keyof InvoiceFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
}

function emptyForm(): InvoiceFormState {
  return {
    invoice_no: "",
    invoice_date: today,
    from_date: "",
    to_date: "",
    prin_code: "",
    prin_name: "",
    curr_code: "OMR",
    inv_status: "N",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">{label}{children}</label>;
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${highlight ? "border-primary/25 bg-primary/5" : "bg-muted/20"}`}>
      <p className="m-0 text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={`m-0 mt-1 text-base font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

async function loadFreightLookup(parameter: string, companyCode: string, search?: string) {
  const rows = await freightSelect<LookupRow>({
    parameter,
    code1: companyCode,
    code2: search?.trim() || "NULL",
  });
  return rows.map(normalizeRow);
}

function normalizeRow(row: LookupRow): LookupRow {
  const next: LookupRow = { ...row };
  Object.entries(row).forEach(([key, val]) => {
    next[key.toLowerCase()] = val;
  });
  return next;
}

function text(input: unknown) {
  return input === undefined || input === null ? "" : String(input).trim();
}

function number(row: LookupRow, key: string) {
  const raw = row[key] ?? row[key.toUpperCase()];
  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

function lineKey(row: LookupRow) {
  return [text(row.company_code), text(row.invoice_no), text(row.prin_code), text(row.job_no), text(row.srno), text(row.act_code)].join("|");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function inputDate(input: string) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDate(input: string) {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString("en-GB");
}

function money(value: number) {
  return <span className="block text-right font-semibold tabular-nums">{value.toFixed(3)}</span>;
}

function centered(value: string) {
  return <span className="block text-center tabular-nums">{value}</span>;
}

function principalText(form: InvoiceFormState) {
  return [form.prin_code, form.prin_name].filter(Boolean).join(" - ") || "Select a job line";
}

function statusChip(status: string) {
  const label = status === "Y" || status === "A" ? "Approved" : status === "C" ? "Cancelled" : "Open";
  const color = status === "Y" || status === "A" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "C" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${color}`}>{label}</span>;
}

export default FreightInvoicePage;
