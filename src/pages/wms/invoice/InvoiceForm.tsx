import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Boxes, Briefcase, FileText, LoaderCircle, Printer,
  Receipt, Save, Settings2, Sheet, Wallet2,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/Table";
import { useAuth } from "../../../state/AuthContext";
import { executeWmsInboundSql, getInvocieDetailReport } from "../../../api/wms";
import {
  getPrincipalDropdown, getInvoiceJobSelection, getStorageSelection,
  normalizeStorageRow, updateBillingApi, TInvoice, TInvoiceDetail, StorageSelectionRow,
} from "../../../api/billing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Single source of truth for every LookupField placeholder
const placeholderCls = "text-[10px] font-normal italic !text-muted-foreground/60";

const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];

const toDDMMYYYY = (d?: string | Date | null) => {
  if (!d) return undefined;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return undefined;
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};

const formatDate = (input: any) => {
  if (!input) return "";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? String(input) : date.toLocaleDateString("en-GB");
};

const toDateInputValue = (value: unknown): string => {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const todayStr = new Date().toISOString().slice(0, 10);

const normalizeJobRow = (row: any) => ({
  company_code: row.company_code ?? row.COMPANY_CODE ?? "",
  job_no: row.job_no ?? row.JOB_NO ?? "",
  invoice_no: row.invoice_no ?? row.INVOICE_NO ?? "",
  srno: row.srno ?? row.SRNO ?? null,
  prin_code: row.prin_code ?? row.PRIN_CODE ?? "",
  quantity: Number(row.quantity ?? row.QUANTITY ?? 0),
  activity: row.activity ?? row.ACTIVITY ?? "",
  act_code: row.act_code ?? row.ACT_CODE ?? "",
  act_group_name: row.act_group_name ?? row.ACT_GROUP_NAME ?? "",
  activity_group_code: row.activity_group_code ?? row.ACTIVITY_GROUP_CODE ?? "",
  bill: Number(row.bill ?? row.BILL ?? 0),
  bill_rate: Number(row.bill_rate ?? row.BILL_RATE ?? 0),
  cost_rate: Number(row.cost_rate ?? row.COST_RATE ?? 0),
  job_date: row.job_date ?? row.JOB_DATE ?? null,
  selected: (row.selected ?? row.SELECTED) === "Y",
});

type NormalizedJobRow = ReturnType<typeof normalizeJobRow>;

const jobRowKey = (row: NormalizedJobRow) =>
  [row.company_code, row.invoice_no, row.prin_code, row.job_no, row.srno ?? "", row.act_code]
    .map((v) => String(v ?? "").trim()).join("||");

const storageRowKey = (row: any, index: number) => String(row.SEQ_NUMBER ?? index);

// Helper to safely map col spans to full Tailwind classes
const getColSpanClass = (span: number) => {
  switch (span) {
    case 2: return "lg:col-span-2";
    case 3: return "lg:col-span-3";
    case 4: return "lg:col-span-4";
    case 6: return "lg:col-span-6";
    case 9: return "lg:col-span-9";
    case 12: return "lg:col-span-12";
    default: return "lg:col-span-3";
  }
};

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

type FieldDef = {
  label: string;
  key: string;
  type?: "date" | "select";
  colSpan?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

// NOTE: the first 3 entries are rendered in the top header card; the Invoice Setup
// tab renders DETAIL_FIELDS.slice(3). All date fields now live in the top header card
// (Credit note date included), so no date field is defined here anymore.
const DETAIL_FIELDS: FieldDef[] = [
  { label: "Despatched", key: "despatched", type: "select", options: [{ value: "Y", label: "Yes" }, { value: "N", label: "No" }] },
  { label: "Dispatch date", key: "desp_date", type: "date" },
  { label: "Invoice mode", key: "inv_mode", placeholder: "e.g., Email, Print" },
  { label: "Account reference", key: "account_ref", placeholder: "Account ref", colSpan: 3 },
  { label: "Invoice to", key: "inv_to", placeholder: "Customer name", colSpan: 3 },
  { label: "Principal ref 1", key: "prin_ref1", placeholder: "Ref 1", colSpan: 3 },
  { label: "Principal ref 2", key: "prin_ref2", placeholder: "Ref 2", colSpan: 3 },
  { label: "Credit note no", key: "credit_note_no", placeholder: "Optional", colSpan: 3 },
  { label: "Invoice description 1", key: "inv_desc1", placeholder: "Description line 1", colSpan: 9 },
  { label: "Invoice description 2", key: "inv_desc2", placeholder: "Description line 2", colSpan: 12 },
];

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-52 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px]">
      <span className="font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </span>
  );
}

function StatusBadge({ isNew, viewMode }: { isNew: boolean; viewMode?: boolean }) {
  if (viewMode) return <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-slate-600">View only</span>;
  if (isNew) return <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">Draft</span>;
  return <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-sky-700">Saved</span>;
}

function FormInput({
  label, value, onChange, type = "text", step, required, placeholder, className = "", disabled, inputClassName = "",
}: {
  label: string; value: string; onChange: (value: string) => void; type?: string; step?: string;
  required?: boolean; placeholder?: string; className?: string; disabled?: boolean; inputClassName?: string;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      <span> {label} {required && <span style={{ color: "#E24B4A" }}>*</span>} </span>
      <Input
        className={`h-7 text-[11px] placeholder:text-[10px] ${type === "number" ? "text-right tabular-nums" : ""} ${inputClassName}`}
        value={value} type={type} step={step} required={required} placeholder={placeholder} disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLInputElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLInputElement).setCustomValidity("")}
      />
    </label>
  );
}

function FormSelect({
  label, value, onChange, options, required, className = "",
}: {
  label: string; value: string; onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>; required?: boolean; className?: string;
}) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
      <span> {label} {required && <span style={{ color: "#E24B4A" }}>*</span>} </span>
      <select
        className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        value={value} required={required} onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function FormLookup({
  label, value, valueField, displayFields, columns, loadOptions, onChange, required, disabled, className = "",
}: {
  label: string; value: string; valueField: string; displayFields: string[];
  columns: Array<{ field: string; header: string }>; loadOptions: () => Promise<any[]>;
  onChange: (value: string, row: any | null) => void; required?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <div className={`grid gap-0.5 text-[11.5px] font-semibold text-slate-700 freight-field-label ${className}`}>
      <span>
        {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
      </span>
      <LookupField
        compact label={label} value={value} columns={columns} valueField={valueField}
        displayFields={displayFields} loadOptions={loadOptions} onChange={onChange}
        required={required} disabled={disabled} enforceRequired={required} placeholder={`Select ${label}`}
        placeholderClassName={placeholderCls}
      />
    </div>
  );
}

function SectionPanel({
  title, meta, icon: Icon, children, className = "",
}: {
  title: string; meta?: string; icon: typeof Receipt; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`freight-panel overflow-hidden rounded-md border bg-background shadow-sm ${className}`}>
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon"><Icon size={12} /></span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold uppercase text-foreground">{title}</h3>
            {meta && <p className="m-0 truncate text-[11px] text-muted-foreground">{meta}</p>}
          </div>
        </div>
      </div>
      <div className="freight-panel-body">{children}</div>
    </section>
  );
}

function PanelHeader({
  icon, accent, title, subtitle, selectedCount, totalCount,
}: {
  icon: React.ReactNode; accent: "primary" | "amber"; title: string; subtitle: string;
  selectedCount: number; totalCount: number;
}) {
  const accentBar = accent === "primary" ? "bg-primary" : "bg-amber-500";
  const accentBg = accent === "primary" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600";

  return (
    <div className="relative flex shrink-0 items-center justify-between gap-2 border-b bg-muted/35 px-3 py-1.5 pl-4">
      <span className={`absolute left-0 top-0 h-full w-1 ${accentBar}`} />
      <div className="flex min-w-0 items-center gap-2">
        <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${accentBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-semibold uppercase text-foreground">{title}</p>
          <p className="m-0 truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${accentBg}`}>
        {selectedCount} / {totalCount} selected
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface InvoiceFormProps {
  existingData?: Record<string, unknown>;
  viewMode?: boolean;
  onClose: (shouldRefetch?: boolean) => void;
}

type InvoiceTab = "setup" | "jobs" | "storage";

export default function InvoiceForm({ existingData, viewMode, onClose }: InvoiceFormProps) {
  const { user } = useAuth();
  const { company_code: authCompanyCode, loginid } = user ?? {};
  const [activeTab, setActiveTab] = useState<InvoiceTab>("setup");

  const [invoice, setInvoice] = useState<any>(() => {
    if (existingData && Object.keys(existingData).length > 0) return existingData;
    return { invoice_date: todayStr, from_date: todayStr, to_date: todayStr, desp_date: todayStr, credit_note_date: todayStr, despatched: "N" };
  });

  const [jobRows, setJobRows] = useState<NormalizedJobRow[]>([]);
  const [selectedJobKeys, setSelectedJobKeys] = useState<Set<string>>(new Set());
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [storageRows, setStorageRows] = useState<StorageSelectionRow[]>([]);
  const [selectedStorageKeys, setSelectedStorageKeys] = useState<Set<string>>(new Set());
  const [loadingStorage, setLoadingStorage] = useState(false);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currencyOptions, setCurrencyOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [companyCurrCode, setCompanyCurrCode] = useState<string>("");
  const [exRateTouched, setExRateTouched] = useState(false);

  const setField = (key: string, value: string) => setInvoice((prev: any) => ({ ...prev, [key]: value }));

  const prinCode = getValue(invoice, "prin_code") || "";
  const invoiceNo = getValue(invoice, "invoice_no") || "";
  const fromDate = getValue(invoice, "from_date");
  const toDate = getValue(invoice, "to_date");
  const currCode = getValue(invoice, "curr_code") || "";
  const hasExistingData = !!existingData && Object.keys(existingData).length > 0;
  const consolidatedInvNo = getValue(invoice, "consolidated_invno") || invoiceNo;
  const isNew = !hasExistingData;

  // Company base currency
  useEffect(() => {
    if (!authCompanyCode) { setCompanyCurrCode(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const rows = await executeWmsInboundSql(`SELECT * FROM MS_COMPANYINFO WHERE COMPANY_CODE = '${authCompanyCode}'`);
        const row = Array.isArray(rows) ? rows[0] : undefined;
        const curr = getValue(row, "curr_code");
        if (!cancelled) setCompanyCurrCode(String(curr ?? "").trim());
      } catch { if (!cancelled) setCompanyCurrCode(""); }
    })();
    return () => { cancelled = true; };
  }, [authCompanyCode]);

  // Currency dropdown
  useEffect(() => {
    if (!user?.company_code) return;
    let cancelled = false;
    setLoadingCurrencies(true);
    (async () => {
      try {
        const rows = await executeWmsInboundSql(`SELECT CURR_CODE, CURR_NAME FROM MS_CURRENCY ORDER BY CURR_CODE`);
        if (!cancelled && Array.isArray(rows)) {
          setCurrencyOptions(rows.map((row: any) => ({ code: row.CURR_CODE ?? row.curr_code ?? "", name: row.CURR_NAME ?? row.curr_name ?? "" })));
        }
      } catch { if (!cancelled) setCurrencyOptions([]); }
      finally { if (!cancelled) setLoadingCurrencies(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.company_code]);

  useEffect(() => {
    if (!invoice.curr_code || exRateTouched) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await executeWmsInboundSql(`SELECT EX_RATE FROM MS_CURRENCY WHERE CURR_CODE = '${invoice.curr_code}'`);
        const rate = rows?.[0]?.ex_rate ?? rows?.[0]?.EX_RATE ?? "";
        if (!cancelled) setField("ex_rate", String(rate));
      } catch { if (!cancelled) setField("ex_rate", ""); }
    })();
    return () => { cancelled = true; };
  }, [invoice.curr_code, exRateTouched]);

  const exchangeFactor = useMemo(() => {
    const invCurr = String(currCode || "").trim().toUpperCase();
    const baseCurr = String(companyCurrCode || "").trim().toUpperCase();
    if (!invCurr || !baseCurr || invCurr === baseCurr) return 1;
    const rate = Number(invoice.ex_rate);
    return rate > 0 ? 1 / rate : 1;
  }, [currCode, companyCurrCode, invoice.ex_rate]);

  // Job rows
  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode) {
      setJobRows([]); setSelectedJobKeys(new Set()); return;
    }
    let cancelled = false;
    setLoadingJobs(true);
    (async () => {
      try {
        const response = await getInvoiceJobSelection({
          loginid: user.loginid ?? "", company_code: user.company_code ?? "", prin_code: prinCode,
          invoice_no: invoiceNo || undefined, from_date: toDDMMYYYY(fromDate), to_date: toDDMMYYYY(toDate),
        });
        const normalized = Array.isArray(response)
          ? response.map(normalizeJobRow).filter((row, index, arr) => arr.findIndex((r) => jobRowKey(r) === jobRowKey(row)) === index)
          : [];
        if (cancelled) return;
        setJobRows(normalized);
        setSelectedJobKeys(new Set(normalized.filter((r) => r.selected).map(jobRowKey)));
      } catch { if (!cancelled) { setJobRows([]); setSelectedJobKeys(new Set()); } }
      finally { if (!cancelled) setLoadingJobs(false); }
    })();
    return () => { cancelled = true; };
  }, [prinCode, invoiceNo, fromDate, toDate, user?.loginid, user?.company_code]);

  // Storage rows
  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode) {
      setStorageRows([]); setSelectedStorageKeys(new Set()); return;
    }
    let cancelled = false;
    setLoadingStorage(true);
    (async () => {
      try {
        const response = await getStorageSelection({
          loginid: user.loginid ?? "", company_code: user.company_code ?? "", prin_code: prinCode,
          consolidated_invno: consolidatedInvNo, from_date: toDDMMYYYY(fromDate), to_date: toDDMMYYYY(toDate),
        });
        const normalized = Array.isArray(response) ? response.map((r) => normalizeStorageRow(r, consolidatedInvNo)) : [];
        if (cancelled) return;
        setStorageRows(normalized);
        setSelectedStorageKeys(new Set(normalized.reduce<string[]>((acc, row: any, i) => { if (row.SELECTED === "Y") acc.push(storageRowKey(row, i)); return acc; }, [])));
      } catch { if (!cancelled) { setStorageRows([]); setSelectedStorageKeys(new Set()); } }
      finally { if (!cancelled) setLoadingStorage(false); }
    })();
    return () => { cancelled = true; };
  }, [prinCode, consolidatedInvNo, fromDate, toDate, user?.loginid, user?.company_code]);

  const displayJobRows = useMemo<NormalizedJobRow[]>(
    () => jobRows.map((row) => ({ ...row, bill: row.bill * exchangeFactor, bill_rate: row.bill_rate * exchangeFactor, cost_rate: row.cost_rate * exchangeFactor })),
    [jobRows, exchangeFactor],
  );

  const displayStorageRows = useMemo(
    () => storageRows.map((row: any) => ({ ...row, AMOUNT: Number(row.AMOUNT ?? 0) * exchangeFactor })),
    [storageRows, exchangeFactor],
  );

  const toggleJobRow = (key: string) => { if (!viewMode) setSelectedJobKeys((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; }); };
  const toggleAllJobs = () => { if (!viewMode) setSelectedJobKeys((prev) => { const allSelected = jobRows.length > 0 && jobRows.every((r) => prev.has(jobRowKey(r))); return allSelected ? new Set() : new Set(jobRows.map(jobRowKey)); }); };
  const toggleStorageRow = (key: string) => { if (!viewMode) setSelectedStorageKeys((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; }); };
  const toggleAllStorage = () => { if (!viewMode) setSelectedStorageKeys((prev) => { const allSelected = storageRows.length > 0 && storageRows.every((r, i) => prev.has(storageRowKey(r, i))); return allSelected ? new Set() : new Set(storageRows.map((r, i) => storageRowKey(r, i))); }); };

  const selectedJobRows = useMemo(() => displayJobRows.filter((r) => selectedJobKeys.has(jobRowKey(r))), [displayJobRows, selectedJobKeys]);
  const selectedStorageRows = useMemo(() => displayStorageRows.filter((r: any, i: number) => selectedStorageKeys.has(storageRowKey(r, i))), [displayStorageRows, selectedStorageKeys]);

  const billingTotals = useMemo(() => {
    const jobTotal = selectedJobRows.reduce((sum, r) => sum + Number(r.bill || 0), 0);
    const storageTotal = selectedStorageRows.reduce((sum: number, r: any) => sum + Number(r.AMOUNT || 0), 0);
    return { jobTotal, storageTotal, grandTotal: jobTotal + storageTotal };
  }, [selectedJobRows, selectedStorageRows]);

  const lineCount = selectedJobRows.length + selectedStorageRows.length;

  const handleSave = async () => {
    setSaving(true); setNotice(null);
    try {
      const invoiceHeader: TInvoice[] = [{
        ...invoice, USER_ID: user?.loginid, COMPANY_CODE: user?.company_code,
        CURR_CODE: getValue(invoice, "curr_code") ?? "", EX_RATE: getValue(invoice, "ex_rate") ? Number(getValue(invoice, "ex_rate")) : null,
      }];
      const jobSelection = selectedJobRows.map((row) => ({
        job_no: row.job_no, act_code: row.act_code, act_group_name: row.act_group_name, activity: row.activity,
        invoice_no: row.invoice_no, prin_code: prinCode, quantity: row.quantity, bill: row.bill, job_date: row.job_date, srno: row.srno, selected: "Y",
      }));
      const storageSelection = selectedStorageRows.map((row: any) => ({ ...row, act_code: "9001", SELECTED: "Y" }));
      const jobDetailRows: TInvoiceDetail[] = selectedJobRows.map((row) => {
        const quantity = Number(row.quantity || 0);
        const billRate = Number(row.bill_rate || 0);
        const costRate = Number(row.cost_rate || 0);
        return { invoice_no: invoiceNo, prin_code: prinCode, job_no: row.job_no, act_code: row.act_code, activity: row.activity, quantity, bill_rate: billRate, cost_rate: costRate, bill_amount: quantity * billRate, cost_amount: quantity * costRate } as TInvoiceDetail;
      });
      const storageDetailRows: TInvoiceDetail[] = selectedStorageRows.map((row: any) => ({
        invoice_no: invoiceNo, prin_code: prinCode, act_code: "9001", activity: row.ACTIVITY, bill: row.AMOUNT, cost: 0,
        quantity: row.QTY, bill_rate: row.QTY ? row.AMOUNT / row.QTY : 0, cost_rate: 0, job_no: "",
      }));
      const invoiceDetails: TInvoiceDetail[] = [...jobDetailRows, ...storageDetailRows].map((row, index) => ({
        ...row, srno: index + 1, INV_DESC1: getValue(invoice, "inv_desc1") ?? "", INV_DESC2: getValue(invoice, "inv_desc2") ?? "",
      }));
      const result = await updateBillingApi({ invoiceHeader, invoiceDetails, storageSelection, jobSelection });
      if (result.success) onClose(true);
      else setNotice({ type: "error", text: result.message });
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Error while saving invoice." });
    } finally { setSaving(false); }
  };

  const handlePrint = async (report_type: "grouped" | "activitywise") => {
    if (!prinCode || !invoiceNo) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) { setNotice({ type: "error", text: "Please allow pop-ups for this site to view the report." }); return; }
    reportWindow.document.write("Loading invoice report...");
    try {
      const html = await getInvocieDetailReport(String(prinCode), String(invoiceNo), String(user?.company_code ?? ""), report_type);
      if (reportWindow.closed) return;
      reportWindow.document.open(); reportWindow.document.write(html); reportWindow.document.close();
    } catch {
      setNotice({ type: "error", text: "Failed to load report. Please try again." });
      if (!reportWindow.closed) reportWindow.close();
    }
  };

  return (
    <form className="freight-dense-form freight-ui-standard freight-enquiry-editor grid gap-2" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      {/* Header bar */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Receipt size={15} /></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{isNew ? "Create Invoice" : invoiceNo || "Edit Invoice"}</h1>
              <StatusBadge isNew={isNew} viewMode={viewMode} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {hasExistingData && (
            <>
              <HeaderChip label="Currency" value={currCode || "-"} />
              <HeaderChip label="Lines" value={String(lineCount)} />
              <HeaderChip label="Grand Total" value={`${billingTotals.grandTotal.toFixed(3)} ${currCode || ""}`.trim()} />
            </>
          )}
          {notice && (
            <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>
          )}
          {hasExistingData && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => handlePrint("grouped")}><Printer size={14} /> Grouped</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handlePrint("activitywise")}><Sheet size={14} /> Activity-wise</Button>
            </>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => onClose(false)}><ArrowLeft size={14} /> Cancel</Button>
          {!viewMode && (
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving" : "Save"}
            </Button>
          )}
        </div>
      </div>

      <fieldset disabled={viewMode} className="contents">
        {/* Top Header Card: 5-column grid. Row 1 = non-date fields, Row 2 = ALL dates together */}
        <section className="freight-form-card enquiry-details-card rounded-md border bg-card shadow-sm p-3">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
            {/* Row 1: Principal (2 cols), Currency, Exchange Rate, Despatched */}
            <div className="lg:col-span-2">
              <FormLookup label="Principal Code" value={prinCode} valueField="prin_code" displayFields={["prin_code", "prin_name"]} columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }]} loadOptions={() => getPrincipalDropdown(user?.company_code ?? "", user?.loginid ?? "")} onChange={(value, row) => setInvoice((prev: any) => ({ ...prev, prin_code: value, curr_code: row ? getValue(row, "curr_code") ?? "" : "" }))} required disabled={viewMode} />
            </div>
            <div>
              <FormLookup label="Currency" value={currCode} valueField="code" displayFields={["code", "name"]} columns={[{ field: "code", header: "Code" }, { field: "name", header: "Name" }]} loadOptions={async () => { if (currencyOptions.length) return currencyOptions; try { const rows = await executeWmsInboundSql(`SELECT CURR_CODE, CURR_NAME FROM MS_CURRENCY ORDER BY CURR_CODE`); const opts = (Array.isArray(rows) ? rows : []).map((row: any) => ({ code: row.CURR_CODE ?? row.curr_code ?? "", name: row.CURR_NAME ?? row.curr_name ?? "" })); if (opts.length) setCurrencyOptions(opts); return opts; } catch { return []; } }} onChange={(value) => setInvoice((prev: any) => ({ ...prev, curr_code: value }))} disabled={viewMode || loadingCurrencies} />
            </div>
            <div><FormInput label="Exchange Rate" value={getValue(invoice, "ex_rate") ?? ""} onChange={(v) => setField("ex_rate", v)} placeholder="Auto" /></div>
            <div><FormSelect label="Despatched" value={getValue(invoice, "despatched") ?? "N"} onChange={(v) => setField("despatched", v)} options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No" }]} /></div>

            {/* Row 2: every date field, side by side */}
            <div><FormInput label="Invoice date" type="date" value={toDateInputValue(getValue(invoice, "invoice_date"))} onChange={(v) => setField("invoice_date", v)} /></div>
            <div><FormInput label="From date" type="date" value={toDateInputValue(fromDate)} onChange={(v) => setField("from_date", v)} /></div>
            <div><FormInput label="To date" type="date" value={toDateInputValue(toDate)} onChange={(v) => setField("to_date", v)} /></div>
            <div><FormInput label="Dispatch Date" type="date" value={toDateInputValue(getValue(invoice, "desp_date"))} onChange={(v) => setField("desp_date", v)} /></div>
            <div><FormInput label="Credit note date" type="date" value={toDateInputValue(getValue(invoice, "credit_note_date"))} onChange={(v) => setField("credit_note_date", v)} /></div>
          </div>
        </section>

        {/* Tabs Shell */}
        <div className="freight-tabs-shell grid gap-0 rounded-md border bg-[#00378C] shadow-sm">
          <div className="freight-tabs-list flex overflow-x-auto">
            {[
              { key: "setup", label: "Invoice Setup", icon: FileText },
              { key: "jobs", label: "Job Details", icon: Briefcase },
              { key: "storage", label: "Storage Details", icon: Boxes },
            ].map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as InvoiceTab)} aria-pressed={activeTab === tab.key} className={`freight-workspace-tab ${activeTab === tab.key ? "active" : ""}`}>
                <tab.icon size={14} />{tab.label}
              </button>
            ))}
          </div>

          <div className="freight-tabs-panel border-t">
            {/* Tab 1: Invoice Setup */}
            {activeTab === "setup" && (
              <section>
                <div className="grid gap-1.5 xl:grid-cols-12">
                  <SectionPanel className="xl:col-span-12" icon={Settings2} title="References & Description">
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-12">
                      {DETAIL_FIELDS.slice(3).map((f) => {
                        const value = getValue(invoice, f.key) ?? "";
                        const spanClass = getColSpanClass(f.colSpan || 3);
                        if (f.type === "date") return <FormInput key={f.key} label={f.label} type="date" value={toDateInputValue(value)} onChange={(v) => setField(f.key, v)} className={spanClass} />;
                        if (f.type === "select" && f.options) return <FormSelect key={f.key} label={f.label} value={value} onChange={(v) => setField(f.key, v)} options={f.options} className={spanClass} />;
                        return <FormInput key={f.key} label={f.label} value={value} onChange={(v) => setField(f.key, v)} placeholder={f.placeholder} className={spanClass} />;
                      })}
                    </div>
                  </SectionPanel>
                </div>
              </section>
            )}

            {/* Tab 2: Job Details */}
            {activeTab === "jobs" && (
              <section>
                <div className="grid gap-1.5 xl:grid-cols-12">
                <div className="xl:col-span-12 flex max-h-[500px] min-h-[220px] flex-col overflow-hidden rounded-md border bg-background shadow-sm">
                  <PanelHeader icon={<Briefcase size={13} />} accent="primary" title="Job Details" subtitle="" selectedCount={selectedJobRows.length} totalCount={jobRows.length} />
                  <div className="min-h-0 flex-1 overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-secondary/70">
                        <TableRow>
                          <TableHead className="w-8 text-[10.5px]"><input type="checkbox" checked={jobRows.length > 0 && jobRows.every((r) => selectedJobKeys.has(jobRowKey(r)))} onChange={toggleAllJobs} disabled={viewMode || jobRows.length === 0} /></TableHead>
                          <TableHead className="text-[10.5px] uppercase">Job No</TableHead>
                          <TableHead className="text-[10.5px] uppercase">Activity</TableHead>
                          <TableHead className="text-right text-[10.5px] uppercase">Qty</TableHead>
                          <TableHead className="text-right text-[10.5px] uppercase">Bill Rate</TableHead>
                          <TableHead className="text-right text-[10.5px] uppercase">Cost Rate</TableHead>
                          <TableHead className="text-right text-[10.5px] uppercase">Bill</TableHead>
                          <TableHead className="text-[10.5px] uppercase">Job Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingJobs ? (
                          <TableRow><TableCell colSpan={8} className="h-[220px] align-middle text-center text-[12px] text-muted-foreground">Loading jobs…</TableCell></TableRow>
                        ) : !prinCode ? (
                          <TableRow><TableCell colSpan={8} className="h-[220px] align-middle text-center text-[12px] text-muted-foreground">Select a principal to load job details.</TableCell></TableRow>
                        ) : displayJobRows.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="h-[220px] align-middle text-center text-[12px] text-muted-foreground">No jobs found for this principal.</TableCell></TableRow>
                        ) : (
                          displayJobRows.map((row) => {
                            const key = jobRowKey(row);
                            const isSelected = selectedJobKeys.has(key);
                            return (
                              <TableRow key={key} className={isSelected ? "cursor-pointer bg-primary/10" : "cursor-pointer hover:bg-accent"} onClick={() => toggleJobRow(key)}>
                                <TableCell onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleJobRow(key)} disabled={viewMode} /></TableCell>
                                <TableCell className="text-[11.5px] text-foreground">{row.job_no}</TableCell>
                                <TableCell className="text-[11.5px] text-foreground">{row.act_code ? `${row.act_code} - ${row.activity}` : row.activity}</TableCell>
                                <TableCell className="text-right text-[11.5px] text-foreground">{row.quantity}</TableCell>
                                <TableCell className="text-right text-[11.5px] text-foreground">{row.bill_rate.toFixed(2)}</TableCell>
                                <TableCell className="text-right text-[11.5px] text-foreground">{row.cost_rate.toFixed(2)}</TableCell>
                                <TableCell className="text-right text-[11.5px] font-semibold text-foreground">{row.bill.toFixed(2)}</TableCell>
                                <TableCell className="text-[11.5px] text-foreground">{row.job_date ? formatDate(row.job_date) : ""}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                </div>
              </section>
            )}

            {/* Tab 3: Storage Details */}
            {activeTab === "storage" && (
              <section>
                <div className="xl:col-span-12 flex max-h-[500px] min-h-[220px] flex-col overflow-hidden rounded-md border bg-background shadow-sm">
                  <PanelHeader icon={<Boxes size={13} />} accent="amber" title="Storage Details" subtitle="" selectedCount={selectedStorageRows.length} totalCount={storageRows.length} />
                  <div className="min-h-0 flex-1 overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-secondary/70">
                        <TableRow>
                          <TableHead className="w-8 text-[10.5px]"><input type="checkbox" checked={storageRows.length > 0 && storageRows.every((r, i) => selectedStorageKeys.has(storageRowKey(r, i)))} onChange={toggleAllStorage} disabled={viewMode || storageRows.length === 0} /></TableHead>
                          <TableHead className="text-[10.5px] uppercase">Serial No</TableHead>
                          <TableHead className="text-[10.5px] uppercase">Reporting Date</TableHead>
                          <TableHead className="text-[10.5px] uppercase">Txn Date</TableHead>
                          <TableHead className="text-right text-[10.5px] uppercase">Qty</TableHead>
                          <TableHead className="text-right text-[10.5px] uppercase">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingStorage ? (
                          <TableRow><TableCell colSpan={6} className="h-[220px] align-middle text-center text-[12px] text-muted-foreground">Loading storage…</TableCell></TableRow>
                        ) : !prinCode ? (
                          <TableRow><TableCell colSpan={6} className="h-[220px] align-middle text-center text-[12px] text-muted-foreground">Select a principal to load storage details.</TableCell></TableRow>
                        ) : displayStorageRows.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="h-[220px] align-middle text-center text-[12px] text-muted-foreground">No storage records found for this principal.</TableCell></TableRow>
                        ) : (
                          displayStorageRows.map((row: any, index) => {
                            const key = storageRowKey(row, index);
                            const isSelected = selectedStorageKeys.has(key);
                            return (
                              <TableRow key={key} className={isSelected ? "cursor-pointer bg-amber-500/10" : "cursor-pointer hover:bg-accent"} onClick={() => toggleStorageRow(key)}>
                                <TableCell onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleStorageRow(key)} disabled={viewMode} /></TableCell>
                                <TableCell className="text-[11.5px] text-foreground">{row.SEQ_NUMBER}</TableCell>
                                <TableCell className="text-[11.5px] text-foreground">{formatDate(row.RCPT_DATE)}</TableCell>
                                <TableCell className="text-[11.5px] text-foreground">{formatDate(row.TXN_DATE)}</TableCell>
                                <TableCell className="text-right text-[11.5px] text-foreground">{row.QTY}</TableCell>
                                <TableCell className="text-right text-[11.5px] font-semibold text-foreground">{Number(row.AMOUNT ?? 0).toFixed(3)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </fieldset>

      {/* Totals */}
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-1.5 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500/10 text-emerald-600"><Wallet2 size={13} /></span>
          <span className="text-[11px] font-semibold uppercase tracking-wide">Invoice totals</span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Total label="Job total" value={billingTotals.jobTotal} suffix={currCode} />
          <Total label="Storage total" value={billingTotals.storageTotal} suffix={currCode} />
          <div className="h-5 w-px bg-border" />
          <Total label="Grand total" value={billingTotals.grandTotal} suffix={currCode} emphasize />
        </div>
      </footer>
    </form>
  );
}

function Total({ label, value, suffix, emphasize }: { label: string; value: number; suffix?: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={emphasize ? "text-[14px] font-semibold text-primary" : "text-[13px] font-medium text-foreground"}>{value.toFixed(3)} {suffix}</span>
    </div>
  );
}