import { FreightDatePicker, FreightDateTimePicker } from "../../components/freight/FreightDatePicker";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Calculator,
  CheckCircle,
  Eye,
  Layers,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Save,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../../api/client";
import { freightSelect, getFreightInvoiceDetailReport } from "../../api/freight";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";

type InvoiceEditorMode = "add" | "edit" | "view";

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

const statusTabs = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
];

export function isInvoiceConfirmed(status: unknown): boolean {
  const s = text(status).toUpperCase();
  if (s === "N" || s === "DRAFT") return false;
  // In PowerBuilder / Freight: 'B' = Billed/Confirmed, 'C' = Confirmed, 'CONFIRMED', 'F', 'Y' or null in TN_INVOICE = Confirmed
  return true;
}

function filterInvoiceByStatus(row: LookupRow, status: string) {
  const confirmed = isInvoiceConfirmed(row.inv_status);
  if (status === "confirmed") return confirmed;
  if (status === "draft") return !confirmed;
  return true;
}

function StatusChip({ tone, label }: { tone: "green" | "red" | "slate"; label: string }) {
  const cls = tone === "green"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded border px-2 py-0 text-[10.5px] leading-tight font-medium ${cls}`}>{label}</span>;
}

export function FreightInvoicePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = text(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const loginId = text(userRecord.loginid || userRecord.LOGINID || userRecord.user_id || userRecord.USER_ID || "Admin");

  const [rows, setRows] = useState<LookupRow[]>([]);
  const [activeStatus, setActiveStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<InvoiceEditorMode>("add");
  const [form, setForm] = useState<InvoiceFormState>(emptyForm());
  const candidateRequestRef = useRef(0);
  const [candidateRows, setCandidateRows] = useState<LookupRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<LookupRow[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => filterInvoiceByStatus(row, activeStatus));
  }, [rows, activeStatus]);

  const selectedBase = useMemo(
    () => selectedRows.reduce((sum, row) => sum + number(row, "bill"), 0),
    [selectedRows]
  );
  const selectedTax = useMemo(
    () => selectedRows.reduce((sum, row) => sum + number(row, "tax_amount"), 0),
    [selectedRows]
  );
  const selectedTotal = selectedBase + selectedTax;


  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/invoice/list", {
        company_code: companyCode,
      });
      setRows((response.data.data || []).map(normalizeRow));
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to load freight invoices.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyCode, toast]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openNewForJob = useCallback(async (jobNo: string) => {
    candidateRequestRef.current += 1;
    setEditorMode("add");
    setForm(emptyForm());
    setSelectedRows([]);
    setCandidateRows([]);
    setCandidateSearch(jobNo);
    setEditorOpen(true);

    try {
      const jobRes = await api.post<{ success?: boolean; data?: { header?: LookupRow; lines?: LookupRow[] } }>("/api/freight/job-activities/get", {
        company_code: companyCode,
        job_no: jobNo,
      });
      const jobHeader = jobRes.data?.data?.header;
      const prinCode = text(jobHeader?.prin_code || jobHeader?.PRIN_CODE);
      const prinName = text(jobHeader?.prin_name || jobHeader?.PRIN_NAME);
      const currCode = text(jobHeader?.curr_code || jobHeader?.CURR_CODE) || "OMR";

      if (prinCode) {
        setForm((prev) => ({
          ...prev,
          prin_code: prinCode,
          prin_name: prinName,
          curr_code: currCode,
        }));

        const candRes = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/invoice/job-selection", {
          company_code: companyCode,
          prin_code: prinCode,
          search: jobNo,
        });
        const candList = (candRes.data?.data || []).map(normalizeRow);
        setCandidateRows(candList);

        const matchingLines = candList.filter((row) => text(row.job_no).toUpperCase() === jobNo.toUpperCase());
        if (matchingLines.length > 0) {
          setSelectedRows(matchingLines);
        }
      }
    } catch {
      // Non-fatal, user can still select manually
    }
  }, [companyCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramJobNo = params.get("job_no");
    if (paramJobNo) {
      void openNewForJob(paramJobNo);
    }
  }, [openNewForJob]);

  function openNew() {
    candidateRequestRef.current += 1;
    setEditorMode("add");
    setForm(emptyForm());
    setSelectedRows([]);
    setCandidateRows([]);
    setCandidateSearch("");
    setEditorOpen(true);
  }

  async function openExisting(row: LookupRow, mode: Exclude<InvoiceEditorMode, "add">) {
    candidateRequestRef.current += 1;
    setEditorMode(mode);
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
      setCandidateSearch("");
      setEditorOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || "Unable to open freight invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmExistingInvoice(invoiceNo: string) {
    if (!invoiceNo) return;
    if (!window.confirm(`Are you sure you want to confirm Invoice ${invoiceNo}? Once confirmed, the invoice is finalized.`)) {
      return;
    }
    setSaving(true);
    try {
      const response = await api.post<{ success?: boolean; message?: string }>("/api/freight/invoice/confirm", {
        company_code: companyCode,
        invoice_no: invoiceNo,
        user_id: loginId,
      });
      if (!response.data.success) throw new Error(response.data.message || "Unable to confirm freight invoice.");
      toast.success(response.data.message || `Freight invoice ${invoiceNo} confirmed successfully.`);
      if (editorOpen) {
        setEditorOpen(false);
      }
      await loadRows();
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || error?.message || "Unable to confirm freight invoice.");
    } finally {
      setSaving(false);
    }
  }

  const directPrintInvoice = useCallback(async (prinCode: string, invoiceNo: string) => {
    if (!invoiceNo) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      toast.error("Please allow pop-ups for this site to view the report.");
      return;
    }
    reportWindow.document.write("<p style='font-family:Arial;padding:24px'>Loading invoice report...</p>");
    try {
      const html = await getFreightInvoiceDetailReport(prinCode, invoiceNo, companyCode, "grouped");
      if (reportWindow.closed) return;
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
    } catch {
      reportWindow.close();
      toast.error("Failed to load invoice report.");
    }
  }, [companyCode, toast]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      accessorKey: "invoice_no",
      header: "Invoice No",
      size: 150,
      cell: ({ row }) => (
        <button type="button" className="freight-table-link font-semibold text-primary hover:underline" onClick={() => void openExisting(row.original, "view")}>
          {text(row.original.invoice_no)}
        </button>
      ),
    },
    { accessorKey: "invoice_date", header: "Date", size: 120, cell: ({ row }) => formatDate(text(row.original.invoice_date)) },
    { accessorKey: "from_date", header: "From Date", size: 120, cell: ({ row }) => formatDate(text(row.original.from_date)) },
    { accessorKey: "to_date", header: "To Date", size: 120, cell: ({ row }) => formatDate(text(row.original.to_date)) },
    { accessorKey: "prin_code", header: "Principal", size: 100 },
    { accessorKey: "prin_name", header: "Principal Name", size: 260, cell: ({ row }) => text(row.original.prin_name) || "-" },
    { accessorKey: "job_no", header: "Job No", size: 110, cell: ({ row }) => text(row.original.job_no) || "-" },
    { accessorKey: "cust_code", header: "Customer Code", size: 120, cell: ({ row }) => text(row.original.cust_code) || "-" },
    { accessorKey: "job_count", header: "Jobs", size: 80, cell: ({ row }) => centered(text(row.original.job_count) || "0") },
    { accessorKey: "line_count", header: "Lines", size: 80, cell: ({ row }) => centered(text(row.original.line_count) || "0") },
    { accessorKey: "curr_code", header: "Currency", size: 90 },
    { accessorKey: "inv_amount", header: "Amount", size: 130, cell: ({ row }) => money(number(row.original, "inv_amount")) },
    {
      accessorKey: "inv_status",
      header: "Status",
      size: 100,
      cell: ({ row }) => {
        const confirmed = isInvoiceConfirmed(row.original.inv_status);
        if (confirmed) return <StatusChip tone="green" label="Confirmed" />;
        return <StatusChip tone="slate" label="Draft" />;
      },
    },
    {
      id: "actions",
      header: "Actions",
      size: 120,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const confirmed = isInvoiceConfirmed(row.original.inv_status);
        const invNo = text(row.original.invoice_no);
        const prinCode = text(row.original.prin_code);
        return (
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Print / Download invoice" onClick={() => void directPrintInvoice(prinCode, invNo)}><Printer size={13} /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" title="View invoice" onClick={() => void openExisting(row.original, "view")}><Eye size={13} /></Button>
            {!confirmed && (
              <>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" title="Edit invoice" onClick={() => void openExisting(row.original, "edit")}><Pencil size={13} /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Confirm invoice" onClick={() => void confirmExistingInvoice(invNo)}><CheckCircle size={13} /></Button>
              </>
            )}
          </div>
        );
      },
    },
  ], [companyCode, loginId, loadRows, directPrintInvoice]);

  async function loadCandidateJobs(
  search = candidateSearch,
  prinCode = form.prin_code,
  fromDate = form.from_date,
  toDate = form.to_date,
  invoiceNo = form.invoice_no
) {
  const requestId = ++candidateRequestRef.current;
  if (!prinCode) { setCandidateRows([]); return; }
  try {
    const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/invoice/job-selection", {
      company_code: companyCode,
      prin_code: prinCode,
      from_date: fromDate,
      to_date: toDate,
      invoice_no: invoiceNo || undefined,
      search,
    });
    if (requestId === candidateRequestRef.current) setCandidateRows((response.data.data || []).map(normalizeRow));
  } catch (error: any) {
    if (requestId !== candidateRequestRef.current) return;
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

  async function saveInvoice(action: "draft" | "confirm" = "draft") {
    if (!form.prin_code) {
      toast.error("Kindly fill in the missing fields.");
      return;
    }
    if (!selectedRows.length) {
      toast.error("Kindly fill in the missing fields.");
      return;
    }

    const nextStatus = action === "confirm" ? "C" : (form.inv_status || "N");

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
        inv_status: nextStatus,
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
      toast.success(action === "confirm" ? `Freight invoice ${response.data.data?.invoice_no || form.invoice_no} confirmed successfully.` : `Freight invoice ${response.data.data?.invoice_no || ""} saved.`);
      setEditorOpen(false);
      await loadRows();
    } catch (error: any) {
      toast.error(error?.response?.data?.details || error?.response?.data?.message || error?.message || "Unable to save freight invoice.");
    } finally {
      setSaving(false);
    }
  }

  const selectedKeys = useMemo(() => new Set(selectedRows.map(lineKey)), [selectedRows]);
  const isFormConfirmed = isInvoiceConfirmed(form.inv_status);
  const readOnly = editorMode === "view" || (editorMode === "edit" && isFormConfirmed);

  async function printInvoice(reportType: "grouped" | "activitywise") {
    if (!form.prin_code || !form.invoice_no) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      toast.error("Please allow pop-ups for this site to view the report.");
      return;
    }
    reportWindow.document.write("<p style='font-family:Arial;padding:24px'>Loading invoice report...</p>");
    try {
      const html = await getFreightInvoiceDetailReport(form.prin_code, form.invoice_no, companyCode, reportType);
      if (reportWindow.closed) return;
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
      setPrintDialogOpen(false);
    } catch {
      reportWindow.close();
      toast.error("Failed to load invoice report.");
    }
  }

  return (
    <section className={`freight-workspace-ui grid gap-2 ${editorOpen ? "freight-invoice-editor-screen" : "freight-list-screen freight-invoice-list-screen"}`}>
      {!editorOpen && (<>
      {/* Filter Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {statusTabs.map((tab) => {
          const count = rows.filter((row) => filterInvoiceByStatus(row, tab.value)).length;
          const active = activeStatus === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveStatus(tab.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#00378C] text-white shadow-xs font-semibold ring-2 ring-[#00378C]/20"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        actionButton={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-8 gap-1.5 px-3.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-all shadow-xs cursor-pointer"
              title="Create Invoice"
              onClick={openNew}
            >
              <Plus size={14} /> Create Invoice
            </Button>
            <FinanceListActionsMenu
              onExport={() => exportToCsv(filteredRows, columns, "freight-invoice-list.csv")}
              onRefresh={() => void loadRows()}
            />
          </div>
        }
        loading={loading}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Filter visible invoices..."
        height="calc(100dvh - 180px)"
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={25}
        enableExport={false}
        getRowId={(row, index) => text(row.invoice_no) || String(index)}
      />

      </>)}

      {editorOpen && <div className="freight-invoice-editor freight-document-editor">
        <header className="freight-document-header">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="button" className="freight-back-button" aria-label="Back to invoice list" title="Back to invoice list" disabled={saving} onClick={() => { setEditorOpen(false); setPrintDialogOpen(false); }}><ArrowLeft size={18} /></button>
            <Receipt size={18} className="text-primary" />
            <h1 className="m-0 text-base font-bold">{readOnly ? "Freight Invoice" : editorMode === "edit" ? "Edit Freight Invoice" : "New Freight Invoice"}</h1>


          </div>
          <div className="freight-invoice-header-actions"><div className="flex w-full items-center justify-between">
            {form.invoice_no ? <Button type="button" variant="outline" onClick={() => void directPrintInvoice(form.prin_code, form.invoice_no)}><Printer size={14} /> Print</Button> : <span />}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => { setEditorOpen(false); setPrintDialogOpen(false); }}>{readOnly ? "Close" : "Cancel"}</Button>
              {readOnly && form.invoice_no && !isFormConfirmed && (
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => void confirmExistingInvoice(form.invoice_no)} disabled={saving}>
                  <CheckCircle size={14} />Confirm Invoice
                </Button>
              )}
              {!readOnly && !isFormConfirmed && (
                <>
                  <Button type="button" variant="outline" onClick={() => void saveInvoice("draft")} disabled={saving || !selectedRows.length}>
                    <Save size={14} />{saving ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => void saveInvoice("confirm")} disabled={saving || !selectedRows.length || isFormConfirmed}>
                    <CheckCircle size={14} />{saving ? "Confirming..." : "Confirm Invoice"}
                  </Button>
                </>
              )}
            </div>
          </div></div>
        </header>
        <div className="freight-document-body">
        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-6">
            <MetricCard icon={Briefcase} label="Selected Jobs" value={String(unique(selectedRows.map((row) => text(row.job_no))).length)} />
            <MetricCard icon={Layers} label="Activity Lines" value={String(selectedRows.length)} />
            <MetricCard label="Before Tax" value={`${selectedBase.toFixed(3)} ${form.curr_code || "OMR"}`} />
            <MetricCard label="Tax" value={`${selectedTax.toFixed(3)} ${form.curr_code || "OMR"}`} />
            <MetricCard icon={TrendingUp} label="Invoice Total" value={`${selectedTotal.toFixed(3)} ${form.curr_code || "OMR"}`} highlight />
            <MetricCard label="Status" value={isFormConfirmed ? "Confirmed" : "Draft"} tone={isFormConfirmed ? "emerald" : "amber"} />
          </div>


          <div className="rounded-xl border border-slate-200 bg-card shadow-2xs overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200/80 bg-gradient-to-r from-blue-50/50 via-slate-50 to-slate-50 px-3 py-2">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-blue-100 text-[#00378C]">
                <Calculator size={13} />
              </div>
              <h2 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-800">Invoice Header</h2>
            </div>
          <div className="grid gap-2 p-3 md:grid-cols-6">
            <div className="grid gap-1 text-xs font-semibold text-muted-foreground">
              <LookupField
                label="Principal"
                showLabelInCompact
                compact
                required
                disabled={readOnly || selectedRows.length > 0}
                value={form.prin_code}
                displayValue={principalText(form)}
                valueField="prin_code"
                displayFields={["prin_name", "prin_code"]}
                columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Principal" }]}
                loadOptions={(search) => loadFreightLookup("freight_principal", companyCode, search)}
                onChange={(value, row) => {
                  setForm((prev) => ({ ...prev, prin_code: value, prin_name: text(row?.prin_name ?? row?.PRIN_NAME), curr_code: text(row?.curr_code ?? row?.CURR_CODE) || prev.curr_code }));
                  setCandidateRows([]);
                  void loadCandidateJobs(candidateSearch, value);
                }}
                placeholder="Select principal"
              />
            </div>
            <Field label="Invoice No"><Input value={form.invoice_no || "Auto"} disabled /></Field>
            <Field label="Invoice Date" required><FreightDatePicker value={form.invoice_date}
        disabled={readOnly}
        onChange={(nextValue) => setFormField("invoice_date", nextValue)} /></Field>
            <Field label="From Date"><FreightDatePicker value={form.from_date}
        disabled={readOnly}
        onChange={(nextValue) => {setFormField("from_date", nextValue); void loadCandidateJobs(candidateSearch, form.prin_code, nextValue, form.to_date);}} /></Field>
            <Field label="To Date"><FreightDatePicker value={form.to_date}
        disabled={readOnly}
        onChange={(nextValue) => {setFormField("to_date", nextValue); void loadCandidateJobs(candidateSearch, form.prin_code, form.from_date, nextValue);}} /></Field>

            <Field label="Total With Tax"><Input value={selectedTotal.toFixed(3)} disabled className="text-right font-semibold" /></Field>
          </div>
          </div>



          {!readOnly && (
            <div className="rounded-xl border border-slate-200 bg-card shadow-2xs overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200/80 bg-gradient-to-r from-blue-50/50 via-slate-50 to-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-blue-100 text-[#00378C]">
                    <Search size={13} />
                  </div>
                  <div>
                    <h2 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-800">Billable Freight Lines</h2>
                    <p className="m-0 text-xs text-muted-foreground">Confirmed job activity lines not yet consolidated into another invoice.</p>
                  </div>
                </div>
                <div className="flex min-w-[340px] items-center gap-2">
                  <Input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder={form.prin_code ? "Search job, activity..." : "Select a principal first"} disabled={!form.prin_code} />
                  <Button type="button" variant="outline" onClick={() => void loadCandidateJobs()} disabled={!form.prin_code}><Search size={14} />Find</Button>
                </div>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="sticky top-0 bg-[#00378C] text-[11px] font-semibold text-white uppercase tracking-wider shadow-sm z-10 whitespace-nowrap">
                    <tr>
                      <th className="w-12 px-2 py-2 text-center text-white font-semibold border-r border-white/15">Use</th>
                      <th className="px-2 py-2 text-left text-white font-semibold border-r border-white/15">Job</th>
                      <th className="px-2 py-2 text-left text-white font-semibold border-r border-white/15">Date</th>
                      <th className="px-2 py-2 text-left text-white font-semibold border-r border-white/15">Principal</th>
                      <th className="px-2 py-2 text-left text-white font-semibold border-r border-white/15">Activity</th>
                      <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Qty</th>
                      <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Bill</th>
                      <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Tax</th>
                      <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Total</th>
                      <th className="px-2 py-2 text-right text-slate-700 font-bold">Cost</th>
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
                        <td className="px-2 py-2 text-right tabular-nums">{number(row, "tax_amount").toFixed(3)}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{(number(row, "bill") + number(row, "tax_amount")).toFixed(3)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{number(row, "actual_cost").toFixed(3)}</td>
                      </tr>
                    ))}
                    {!candidateRows.length && <tr><td className="px-2 py-8 text-center text-muted-foreground" colSpan={10}>{form.prin_code ? "No confirmed billable freight activity lines found." : "Select a principal to load billable freight lines."}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-card shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-blue-50/50 via-slate-50 to-slate-50 p-3">
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-md bg-blue-100 text-[#00378C]">
                  <Receipt size={13} />
                </div>
                <div>
                  <h2 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-800">Selected Invoice Lines</h2>
                  <p className="m-0 text-xs text-muted-foreground">{selectedRows.length} lines / {unique(selectedRows.map((row) => text(row.job_no))).length} jobs</p>
                </div>
              </div>
              <div className="text-right">
                <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">Before Tax {selectedBase.toFixed(3)} / Tax {selectedTax.toFixed(3)}</p>
                <p className="m-0 text-lg font-bold text-primary">{selectedTotal.toFixed(3)} {form.curr_code || "OMR"}</p>
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider shadow-xs z-10 whitespace-nowrap border-b-2 border-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-left text-white font-semibold border-r border-white/15">Job</th>
                    <th className="px-2 py-2 text-left text-white font-semibold border-r border-white/15">Activity</th>
                    <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Qty</th>
                    <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Rate</th>
                    <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Bill</th>
                    <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Tax</th>
                    <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Total</th>
                    <th className="px-2 py-2 text-right text-white font-semibold border-r border-white/15">Cost</th>
                    {!readOnly && <th className="px-2 py-2 text-right text-slate-700 font-bold">Action</th>}
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
                      <td className="px-2 py-2 text-right tabular-nums">{number(row, "tax_amount").toFixed(3)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{(number(row, "bill") + number(row, "tax_amount")).toFixed(3)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{number(row, "actual_cost").toFixed(3)}</td>
                      {!readOnly && <td className="px-2 py-2 text-right"><Button type="button" size="icon" variant="ghost" onClick={() => removeSelected(row)}><Trash2 size={14} /></Button></td>}
                    </tr>
                  ))}
                  {!selectedRows.length && <tr><td className="px-2 py-8 text-center text-muted-foreground" colSpan={readOnly ? 8 : 9}>No lines selected.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>}

      {printDialogOpen && (
        <Dialog open compact title="Print Invoice" onClose={() => setPrintDialogOpen(false)}>
          <div className="grid gap-3 py-1">
            <p className="m-0 text-sm text-muted-foreground">Choose how you want the invoice report to be generated.</p>
            <Button type="button" variant="outline" className="justify-start" onClick={() => void printInvoice("grouped")}><Printer size={15} /> Grouped — summary by activity groups</Button>
            <Button type="button" variant="outline" className="justify-start" onClick={() => void printInvoice("activitywise")}><Printer size={15} /> Activity-wise — detailed activity breakdown</Button>
          </div>
        </Dialog>
      )}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
      <span>
        {label}
        {required && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>}
      </span>
      {children}
    </label>
  );
}


function MetricCard({
  icon: Icon,
  label,
  value,
  highlight,
  tone = "default",
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "default" | "emerald" | "amber";
}) {
  const highlightClass = highlight
    ? "border-blue-300 bg-gradient-to-br from-blue-50/80 to-white text-[#00378C] ring-1 ring-blue-200"
    : tone === "emerald"
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-gradient-to-br from-amber-50/80 to-white text-amber-800"
        : "border-slate-200 bg-gradient-to-b from-slate-50/80 to-white text-slate-800";

  return (
    <div className={`relative overflow-hidden rounded-xl border p-2.5 shadow-2xs ${highlightClass}`}>
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${highlight ? "bg-[#00378C]" : tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-slate-300"}`} />
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && <Icon size={13} className={highlight ? "text-[#00378C]" : "text-slate-400"} />}
      </div>
      <div className={`mt-1 truncate text-base font-extrabold ${highlight ? "text-[#00378C]" : "text-slate-900"}`}>{value}</div>
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
  return [form.prin_name, form.prin_code].filter(Boolean).join(" - ") || "";
}

export default FreightInvoicePage;
