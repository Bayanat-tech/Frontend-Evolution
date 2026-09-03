import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, Briefcase, LoaderCircle, Printer, Receipt, Save, Sheet } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/Table";
import { useAuth } from "../../../state/AuthContext";
import { executeWmsInboundSql, getInvocieDetailReport } from "../../../api/wms";
import {
  getPrincipalDropdown,
  getInvoiceJobSelection,
  getStorageSelection,
  normalizeStorageRow,
  updateBillingApi,
  TInvoice,
  TInvoiceDetail,
  StorageSelectionRow,
} from "../../../api/billing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];

const toDDMMYYYY = (d?: string | Date | null) => {
  if (!d) return undefined;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return undefined;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
};

const formatDate = (input: any) => {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return date.toLocaleDateString("en-GB");
};

const toDateInputValue = (value: unknown): string => {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const todayStr = new Date().toISOString().slice(0, 10);

const normalizeJobRow = (row: any) => ({
  company_code: row.company_code ?? row.COMPANY_CODE ?? "",
  job_no: row.job_no ?? row.JOB_NO ?? "",
  invoice_no: row.invoice_no ?? row.INVOICE_NO ?? "",
  // Original SRNO of this row on its own source job invoice (TN_INVOICE_DET).
  // Needed so PROC_UPDATE_INVOICE_DTLS can find and link the right row.
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
    .map((v) => String(v ?? "").trim())
    .join("||");

const storageRowKey = (row: any, index: number) => String(row.SEQ_NUMBER ?? index);

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

type FieldDef = {
  label: string;
  key: string;
  type?: "date" | "select";
  span?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

const HEADER_FIELDS: FieldDef[] = [
  { label: "Invoice no", key: "invoice_no", placeholder: "Auto-generated" },
  { label: "Invoice date", key: "invoice_date", type: "date" },
  { label: "From date", key: "from_date", type: "date" },
  { label: "To date", key: "to_date", type: "date" },
];

const DETAIL_FIELDS: FieldDef[] = [
  {
    label: "Despatched",
    key: "despatched",
    type: "select",
    options: [
      { value: "Y", label: "Yes" },
      { value: "N", label: "No" },
    ],
  },
  { label: "Dispatch date", key: "desp_date", type: "date" },
  { label: "Invoice mode", key: "inv_mode", placeholder: "e.g., Email, Print" },
  { label: "Account reference", key: "account_ref", placeholder: "Account ref" },
  { label: "Invoice to", key: "inv_to", placeholder: "Customer name" },
  { label: "Principal ref 1", key: "prin_ref1", placeholder: "Ref 1" },
  { label: "Principal ref 2", key: "prin_ref2", placeholder: "Ref 2" },
  { label: "Credit note no", key: "credit_note_no", placeholder: "Optional" },
  { label: "Credit note date", key: "credit_note_date", type: "date" },
  { label: "Invoice description 1", key: "inv_desc1", span: 2, placeholder: "Description line 1" },
  { label: "Invoice description 2", key: "inv_desc2", span: 2, placeholder: "Description line 2" },
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

function FieldLabel({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground ${className}`}>
      {label}
      {children}
    </label>
  );
}

const fieldClassName =
  "flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

function renderField(f: FieldDef, invoice: any, setField: (key: string, value: string) => void, disabled?: boolean) {
  const value = getValue(invoice, f.key) ?? "";
  const span = f.span ? `sm:col-span-${f.span}` : "";

  if (f.type === "date") {
    return (
      <FieldLabel key={f.key} label={f.label} className={span}>
        <Input className="h-8 text-sm" type="date" value={toDateInputValue(value)} onChange={(e) => setField(f.key, e.target.value)} disabled={disabled} />
      </FieldLabel>
    );
  }
  if (f.type === "select" && f.options) {
    return (
      <FieldLabel key={f.key} label={f.label} className={span}>
        <select className={fieldClassName} value={value} onChange={(e) => setField(f.key, e.target.value)} disabled={disabled}>
          <option value="">Select</option>
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldLabel>
    );
  }
  return (
    <FieldLabel key={f.key} label={f.label} className={span}>
      <Input className="h-8 text-sm" value={value} onChange={(e) => setField(f.key, e.target.value)} disabled={disabled} placeholder={f.placeholder} />
    </FieldLabel>
  );
}

// ---------------------------------------------------------------------------
// Panel header (themed per-section)
// ---------------------------------------------------------------------------

function PanelHeader({
  icon,
  accent,
  title,
  subtitle,
  selectedCount,
  totalCount,
}: {
  icon: React.ReactNode;
  accent: "primary" | "amber";
  title: string;
  subtitle: string;
  selectedCount: number;
  totalCount: number;
}) {
  const accentClasses = accent === "primary" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600";
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${accentClasses}`}>{icon}</div>
        <div className="min-w-0">
          <p className="m-0 text-[13px] font-semibold text-foreground">{title}</p>
          <p className="m-0 truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${accentClasses}`}>
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

export default function InvoiceForm({ existingData, viewMode, onClose }: InvoiceFormProps) {
  const { user } = useAuth();

  const [invoice, setInvoice] = useState<any>(() => {
    if (existingData && Object.keys(existingData).length > 0) return existingData;
    return {
      invoice_date: todayStr,
      from_date: todayStr,
      to_date: todayStr,
      desp_date: todayStr,
      credit_note_date: todayStr,
      despatched: "N",
    };
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

  const setField = (key: string, value: string) => setInvoice((prev: any) => ({ ...prev, [key]: value }));

  const prinCode = getValue(invoice, "prin_code") || "";
  const invoiceNo = getValue(invoice, "invoice_no") || "";
  const fromDate = getValue(invoice, "from_date");
  const toDate = getValue(invoice, "to_date");
  const currCode = getValue(invoice, "curr_code") || "";
  const hasExistingData = !!existingData && Object.keys(existingData).length > 0;
  const consolidatedInvNo = getValue(invoice, "consolidated_invno") || invoiceNo;
  const isNew = !hasExistingData;

  // -------------------------------------------------------------------------
  // Currency dropdown + exchange rate lookup (unchanged)
  // -------------------------------------------------------------------------

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
      } catch {
        if (!cancelled) setCurrencyOptions([]);
      } finally {
        if (!cancelled) setLoadingCurrencies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.company_code]);

  useEffect(() => {
    if (!invoice.curr_code) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await executeWmsInboundSql(`SELECT EX_RATE FROM MS_CURRENCY WHERE CURR_CODE = '${invoice.curr_code}'`);
        const rate = rows?.[0]?.ex_rate ?? rows?.[0]?.EX_RATE ?? "";
        if (!cancelled) setField("ex_rate", String(rate));
      } catch {
        if (!cancelled) setField("ex_rate", "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoice.curr_code]);

  // -------------------------------------------------------------------------
  // Job rows — auto-loaded straight into the grid once a principal is picked
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode) {
      setJobRows([]);
      setSelectedJobKeys(new Set());
      return;
    }
    let cancelled = false;
    setLoadingJobs(true);
    (async () => {
      try {
        const response = await getInvoiceJobSelection({
          loginid: user.loginid ?? "",
          company_code: user.company_code ?? "",
          prin_code: prinCode,
          invoice_no: invoiceNo || undefined,
          from_date: toDDMMYYYY(fromDate),
          to_date: toDDMMYYYY(toDate),
        });
        const normalized = Array.isArray(response)
          ? response
              .map(normalizeJobRow)
              .filter((row, index, arr) => arr.findIndex((r) => jobRowKey(r) === jobRowKey(row)) === index)
          : [];
        if (cancelled) return;
        setJobRows(normalized);
        // Rows already linked on the invoice (SELECTED='Y' from the backend view) start checked.
        setSelectedJobKeys(new Set(normalized.filter((r) => r.selected).map(jobRowKey)));
      } catch {
        if (!cancelled) {
          setJobRows([]);
          setSelectedJobKeys(new Set());
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prinCode, invoiceNo, fromDate, toDate, user?.loginid, user?.company_code]);

  // -------------------------------------------------------------------------
  // Storage rows — same pattern
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode) {
      setStorageRows([]);
      setSelectedStorageKeys(new Set());
      return;
    }
    let cancelled = false;
    setLoadingStorage(true);
    (async () => {
      try {
        const response = await getStorageSelection({
          loginid: user.loginid ?? "",
          company_code: user.company_code ?? "",
          prin_code: prinCode,
          consolidated_invno: consolidatedInvNo,
          from_date: toDDMMYYYY(fromDate),
          to_date: toDDMMYYYY(toDate),
        });
        const normalized = Array.isArray(response) ? response.map((r) => normalizeStorageRow(r, consolidatedInvNo)) : [];
        if (cancelled) return;
        setStorageRows(normalized);
        setSelectedStorageKeys(
          new Set(
            normalized.reduce<string[]>((acc, row: any, i) => {
              if (row.SELECTED === "Y") acc.push(storageRowKey(row, i));
              return acc;
            }, []),
          ),
        );
      } catch {
        if (!cancelled) {
          setStorageRows([]);
          setSelectedStorageKeys(new Set());
        }
      } finally {
        if (!cancelled) setLoadingStorage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prinCode, consolidatedInvNo, fromDate, toDate, user?.loginid, user?.company_code]);

  // -------------------------------------------------------------------------
  // Selection state
  // -------------------------------------------------------------------------

  const toggleJobRow = (key: string) => {
    if (viewMode) return;
    setSelectedJobKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAllJobs = () => {
    if (viewMode) return;
    setSelectedJobKeys((prev) => {
      const allSelected = jobRows.length > 0 && jobRows.every((r) => prev.has(jobRowKey(r)));
      return allSelected ? new Set() : new Set(jobRows.map(jobRowKey));
    });
  };

  const toggleStorageRow = (key: string) => {
    if (viewMode) return;
    setSelectedStorageKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAllStorage = () => {
    if (viewMode) return;
    setSelectedStorageKeys((prev) => {
      const allSelected = storageRows.length > 0 && storageRows.every((r, i) => prev.has(storageRowKey(r, i)));
      return allSelected ? new Set() : new Set(storageRows.map((r, i) => storageRowKey(r, i)));
    });
  };

  const selectedJobRows = useMemo(() => jobRows.filter((r) => selectedJobKeys.has(jobRowKey(r))), [jobRows, selectedJobKeys]);
  const selectedStorageRows = useMemo(
    () => storageRows.filter((r, i) => selectedStorageKeys.has(storageRowKey(r, i))),
    [storageRows, selectedStorageKeys],
  );

  const billingTotals = useMemo(() => {
    const jobTotal = selectedJobRows.reduce((sum, r) => sum + Number(r.bill || 0), 0);
    const storageTotal = selectedStorageRows.reduce((sum: number, r: any) => sum + Number(r.AMOUNT || 0), 0);
    return { jobTotal, storageTotal, grandTotal: jobTotal + storageTotal };
  }, [selectedJobRows, selectedStorageRows]);

  const lineCount = selectedJobRows.length + selectedStorageRows.length;

  // -------------------------------------------------------------------------
  // Save — checked rows are the payload
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const invoiceHeader: TInvoice[] = [{ ...invoice, USER_ID: user?.loginid, COMPANY_CODE: user?.company_code }];

      const jobSelection = selectedJobRows.map((row) => ({
        job_no: row.job_no,
        act_code: row.act_code,
        act_group_name: row.act_group_name,
        activity: row.activity,
        invoice_no: row.invoice_no,
        prin_code: prinCode,
        quantity: row.quantity,
        bill: row.bill,
        job_date: row.job_date,
        srno: row.srno,
        selected: "Y",
      }));

      const storageSelection = selectedStorageRows.map((row: any) => ({ ...row, act_code: "9001", SELECTED: "Y" }));

      const jobDetailRows: TInvoiceDetail[] = selectedJobRows.map((row) => {
        const quantity = Number(row.quantity || 0);
        const billRate = Number(row.bill_rate || 0);
        const costRate = Number(row.cost_rate || 0);
        return {
          invoice_no: invoiceNo,
          prin_code: prinCode,
          job_no: row.job_no,
          act_code: row.act_code,
          activity: row.activity,
          quantity,
          bill_rate: billRate,
          cost_rate: costRate,
          bill_amount: quantity * billRate,
          cost_amount: quantity * costRate,
        } as TInvoiceDetail;
      });

      const storageDetailRows: TInvoiceDetail[] = selectedStorageRows.map((row: any) => ({
        invoice_no: invoiceNo,
        prin_code: prinCode,
        act_code: "9001",
        activity: row.ACTIVITY,
        bill: row.AMOUNT,
        cost: 0,
        quantity: row.QTY,
        bill_rate: row.QTY ? row.AMOUNT / row.QTY : 0,
        cost_rate: 0,
        job_no: "",
      }));

      const invoiceDetails: TInvoiceDetail[] = [...jobDetailRows, ...storageDetailRows].map((row, index) => ({
        ...row,
        srno: index + 1,
        INV_DESC1: getValue(invoice, "inv_desc1") ?? "",
        INV_DESC2: getValue(invoice, "inv_desc2") ?? "",
      }));

      const result = await updateBillingApi({ invoiceHeader, invoiceDetails, storageSelection, jobSelection });
      if (result.success) onClose(true);
      else setNotice({ type: "error", text: result.message });
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Error while saving invoice." });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (report_type: "grouped" | "activitywise") => {
    if (!prinCode || !invoiceNo) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setNotice({ type: "error", text: "Please allow pop-ups for this site to view the report." });
      return;
    }
    reportWindow.document.write("Loading invoice report...");
    try {
      const html = await getInvocieDetailReport(String(prinCode), String(invoiceNo), String(user?.company_code ?? ""), report_type);
      if (reportWindow.closed) return;
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
    } catch {
      setNotice({ type: "error", text: "Failed to load report. Please try again." });
      if (!reportWindow.closed) reportWindow.close();
    }
  };

  return (
    <div className="grid gap-2.5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button type="button" size="icon" variant="ghost" title="Back" className="h-8 w-8 shrink-0" onClick={() => onClose(false)}>
            <ArrowLeft size={15} />
          </Button>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Receipt size={15} />
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="m-0 text-lg  ">
              {isNew ? "Create Invoice" : invoiceNo || "Invoice"}
              {viewMode && <span className="ml-2 align-middle text-[11px] font-medium text-muted-foreground">(view only)</span>}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {hasExistingData && (
            <>
              <HeaderChip label="Currency" value={currCode || "-"} />
              <HeaderChip label="Lines" value={String(lineCount)} />
              <Button type="button" size="sm" variant="outline" onClick={() => handlePrint("grouped")}>
                <Printer size={14} /> Grouped
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handlePrint("activitywise")}>
                <Sheet size={14} /> Activity-wise
              </Button>
            </>
          )}
          {notice && (
            <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {notice.text}
            </span>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => onClose(false)}>
            Cancel
          </Button>
          {!viewMode && (
            <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving" : "Save"}
            </Button>
          )}
        </div>
      </div>

      <fieldset disabled={viewMode} className="contents">
        {/* Identity fields */}
        <section className="rounded-md border bg-card px-3 py-2.5 shadow-sm">
          <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            <FieldLabel label="Principal code">
              <LookupField
                compact
                label="Principal code"
                required
                value={prinCode}
                columns={[
                  { field: "prin_code", header: "Code" },
                  { field: "prin_name", header: "Name" },
                ]}
                valueField="prin_code"
                displayFields={["prin_code", "prin_name"]}
                loadOptions={() => getPrincipalDropdown(user?.company_code ?? "", user?.loginid ?? "")}
                onChange={(value, row) => setInvoice((prev: any) => ({ ...prev, prin_code: value, curr_code: row ? getValue(row, "curr_code") ?? "" : "" }))}
                disabled={viewMode}
              />
            </FieldLabel>
            {HEADER_FIELDS.map((f) => renderField(f, invoice, setField, viewMode))}
          </div>
        </section>

        {/* Details fields */}
        <section className="rounded-md border bg-card px-3 py-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {DETAIL_FIELDS.map((f) => renderField(f, invoice, setField, viewMode))}

            <FieldLabel label="Currency code">
              <LookupField
                compact
                label="Currency code"
                value={currCode}
                columns={[
                  { field: "code", header: "Code" },
                  { field: "name", header: "Name" },
                ]}
                valueField="code"
                displayFields={["code", "name"]}
                loadOptions={async () => {
                  if (currencyOptions.length) return currencyOptions;
                  try {
                    const rows = await executeWmsInboundSql(`SELECT CURR_CODE, CURR_NAME FROM MS_CURRENCY ORDER BY CURR_CODE`);
                    const opts = (Array.isArray(rows) ? rows : []).map((row: any) => ({ code: row.CURR_CODE ?? row.curr_code ?? "", name: row.CURR_NAME ?? row.curr_name ?? "" }));
                    if (opts.length) setCurrencyOptions(opts);
                    return opts;
                  } catch {
                    return [];
                  }
                }}
                onChange={(value) => setInvoice((prev: any) => ({ ...prev, curr_code: value }))}
                disabled={viewMode || loadingCurrencies}
                placeholder={loadingCurrencies ? "Loading…" : "Select currency"}
              />
            </FieldLabel>
            <FieldLabel label="Exchange rate">
              <Input className="h-8 text-sm" value={getValue(invoice, "ex_rate") ?? ""} disabled placeholder="Auto" />
            </FieldLabel>
          </div>
        </section>

        {/* Billing grids */}
        <section className="grid gap-3 lg:grid-cols-2">
          {/* Job selection grid */}
          <div className="flex max-h-[460px] min-h-[220px] flex-col rounded-md border bg-background shadow-sm">
            <PanelHeader
              icon={<Briefcase size={14} />}
              accent="primary"
              title="Job details"
              subtitle="Check the activities to bill on this invoice"
              selectedCount={selectedJobRows.length}
              totalCount={jobRows.length}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-secondary/70">
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={jobRows.length > 0 && jobRows.every((r) => selectedJobKeys.has(jobRowKey(r)))}
                        onChange={toggleAllJobs}
                        disabled={viewMode || jobRows.length === 0}
                      />
                    </TableHead>
                    <TableHead>Job No</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Bill Rate</TableHead>
                    <TableHead className="text-right">Cost Rate</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead>Job Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingJobs ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-[12px] text-muted-foreground">
                        Loading jobs…
                      </TableCell>
                    </TableRow>
                  ) : !prinCode ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-[12px] text-muted-foreground">
                        Select a principal to load job details.
                      </TableCell>
                    </TableRow>
                  ) : jobRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-[12px] text-muted-foreground">
                        No jobs found for this principal.
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobRows.map((row) => {
                      const key = jobRowKey(row);
                      const isSelected = selectedJobKeys.has(key);
                      return (
                        <TableRow
                          key={key}
                          className={isSelected ? "cursor-pointer bg-primary/10" : "cursor-pointer hover:bg-accent"}
                          onClick={() => toggleJobRow(key)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleJobRow(key)} disabled={viewMode} />
                          </TableCell>
                          <TableCell>{row.job_no}</TableCell>
                          <TableCell>{row.act_code ? `${row.act_code} - ${row.activity}` : row.activity}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-right">{row.bill_rate.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.cost_rate.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.bill.toFixed(2)}</TableCell>
                          <TableCell>{row.job_date ? formatDate(row.job_date) : ""}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Storage selection grid */}
          <div className="flex max-h-[460px] min-h-[220px] flex-col rounded-md border bg-background shadow-sm">
            <PanelHeader
              icon={<Boxes size={14} />}
              accent="amber"
              title="Storage details"
              subtitle="Check the storage charges to bill on this invoice"
              selectedCount={selectedStorageRows.length}
              totalCount={storageRows.length}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-secondary/70">
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={storageRows.length > 0 && storageRows.every((r, i) => selectedStorageKeys.has(storageRowKey(r, i)))}
                        onChange={toggleAllStorage}
                        disabled={viewMode || storageRows.length === 0}
                      />
                    </TableHead>
                    <TableHead>Serial No</TableHead>
                    <TableHead>Reporting Date</TableHead>
                    <TableHead>Txn Date</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStorage ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-[12px] text-muted-foreground">
                        Loading storage…
                      </TableCell>
                    </TableRow>
                  ) : !prinCode ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-[12px] text-muted-foreground">
                        Select a principal to load storage details.
                      </TableCell>
                    </TableRow>
                  ) : storageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-[12px] text-muted-foreground">
                        No storage records found for this principal.
                      </TableCell>
                    </TableRow>
                  ) : (
                    storageRows.map((row: any, index) => {
                      const key = storageRowKey(row, index);
                      const isSelected = selectedStorageKeys.has(key);
                      return (
                        <TableRow
                          key={key}
                          className={isSelected ? "cursor-pointer bg-amber-500/10" : "cursor-pointer hover:bg-accent"}
                          onClick={() => toggleStorageRow(key)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleStorageRow(key)} disabled={viewMode} />
                          </TableCell>
                          <TableCell>{row.SEQ_NUMBER}</TableCell>
                          <TableCell>{formatDate(row.RCPT_DATE)}</TableCell>
                          <TableCell>{formatDate(row.TXN_DATE)}</TableCell>
                          <TableCell className="text-right">{row.QTY}</TableCell>
                          <TableCell className="text-right">{Number(row.AMOUNT ?? 0).toFixed(3)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      </fieldset>

      {/* Totals */}
      <footer className="flex flex-wrap items-center justify-end gap-6 rounded-md border bg-card px-4 py-2.5 shadow-sm">
        <Total label="Job total" value={billingTotals.jobTotal} suffix={currCode} />
        <Total label="Storage total" value={billingTotals.storageTotal} suffix={currCode} />
        <div className="h-6 w-px bg-border" />
        <Total label="Grand total" value={billingTotals.grandTotal} suffix={currCode} emphasize />
      </footer>
    </div>
  );
}

function Total({ label, value, suffix, emphasize }: { label: string; value: number; suffix?: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={emphasize ? "text-[15px] font-semibold text-primary" : "text-[14px] font-medium text-foreground"}>
        {value.toFixed(3)} {suffix}
      </span>
    </div>
  );
}