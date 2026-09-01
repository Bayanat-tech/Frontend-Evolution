import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Printer, Save } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { useAuth } from "../../../state/AuthContext";
import {
  getPrincipalDropdown,
  getInvoiceDetailLines,
  getInvoiceJobSelection,
  updateBillingApi,
  TInvoice,
  TInvoiceDetail,
  StorageSelectionRow,
} from "../../../api/billing";
import { executeWmsInboundSql, getInvocieDetailReport } from "../../../api/wms";
import JobSelectionModal from "./JobSelectionModal";
import StorageSelectionModal from "./StorageSelectionModal";

// ---------------------------------------------------------------------------
// Helpers — date handling
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

const toDateInputValue = (value: unknown): string => {
  if (!value) return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Common input styling to make all fields look consistent
// ---------------------------------------------------------------------------

const inputBase =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#1F5C6B] focus:outline-none focus:ring-1 focus:ring-[#1F5C6B] disabled:bg-slate-50 disabled:text-slate-500";

const selectBase =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-[#1F5C6B] focus:outline-none focus:ring-1 focus:ring-[#1F5C6B] disabled:bg-slate-50";

// ---------------------------------------------------------------------------
// Field definitions (without "Invoice status")
// ---------------------------------------------------------------------------

type FieldDef = { label: string; key: string; type?: "date" | "select"; disabled?: boolean; span: number; placeholder?: string; options?: { value: string; label: string }[] };

const ALL_FIELDS: FieldDef[] = [
  { label: "Invoice no", key: "invoice_no", span: 3, placeholder: "Auto-generated" },
  { label: "Invoice date", key: "invoice_date", type: "date", span: 2 },
  { label: "From date", key: "from_date", type: "date", span: 2 },
  { label: "To date", key: "to_date", type: "date", span: 2 },

  // "Invoice status" removed

  {
    label: "Despatched",
    key: "despatched",
    span: 3,
    type: "select",
    options: [
      { value: "Y", label: "Yes" },
      { value: "N", label: "No" },
    ],
    placeholder: "Select",
  },
  { label: "Dispatch date", key: "desp_date", type: "date", span: 2 },
  { label: "Invoice mode", key: "inv_mode", span: 4, placeholder: "e.g., Email, Print" },

  { label: "Account reference", key: "account_ref", span: 2, placeholder: "Account ref" },
  { label: "Invoice to", key: "inv_to", span: 2, placeholder: "Customer name" },
  { label: "Principal ref 1", key: "prin_ref1", span: 2, placeholder: "Ref 1" },
  { label: "Principal ref 2", key: "prin_ref2", span: 2, placeholder: "Ref 2" },
  { label: "Credit note no", key: "credit_note_no", span: 2, placeholder: "Optional" },
  { label: "Credit note date", key: "credit_note_date", type: "date", span: 2 },

  { label: "Invoice description 1", key: "inv_desc1", span: 4, placeholder: "Description line 1" },
  { label: "Invoice description 2", key: "inv_desc2", span: 4, placeholder: "Description line 2" },
  // Exchange rate is handled separately as a disabled field
];

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function FieldWrap({ label, span, children }: { label: string; span: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0" style={{ gridColumn: `span ${span} / span ${span}` }}>
      <span className="text-[10px] font-medium text-slate-500 tracking-wide">{label}</span>
      {children}
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
    if (existingData && Object.keys(existingData).length > 0) {
      return existingData;
    }
    return {
      invoice_date: todayStr,
      from_date: todayStr,
      to_date: todayStr,
      desp_date: todayStr,
      credit_note_date: todayStr,
      despatched: "N", // default to No
    };
  });

  const [lines, setLines] = useState<any[]>([]);
  const [jobSelectionRows, setJobSelectionRows] = useState<any[]>([]);
  const [storageLines, setStorageLines] = useState<StorageSelectionRow[]>([]);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [printError, setPrintError] = useState("");
  const [currencyOptions, setCurrencyOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);

  const setField = (key: string, value: string) => {
    setInvoice((prev: any) => ({ ...prev, [key]: value }));
  };

  const prinCode = getValue(invoice, "prin_code") || "";
  const invoiceNo = getValue(invoice, "invoice_no") || "";
  const fromDate = getValue(invoice, "from_date");
  const toDate = getValue(invoice, "to_date");
  const currCode = getValue(invoice, "curr_code") || "";
  const hasExistingData = !!existingData && Object.keys(existingData).length > 0;
  const consolidatedInvNo = getValue(invoice, "consolidated_invno") || invoiceNo;
  const isNew = !hasExistingData;

  const existingJobKeys = useMemo(
    () => lines.map((row) => `${String(row.job_no ?? "").trim()}||${String(row.act_code ?? "").trim()}`),
    [lines],
  );

  // Load currency codes from MS_CURRENCY
  useEffect(() => {
    if (!user?.company_code) return;
    let cancelled = false;
    setLoadingCurrencies(true);
    (async () => {
      try {
        const rows = await executeWmsInboundSql(
          `SELECT CURR_CODE, CURR_NAME FROM MS_CURRENCY ORDER BY CURR_CODE`
        );
        if (!cancelled && Array.isArray(rows)) {
          const opts = rows.map((row: any) => ({
            code: row.CURR_CODE ?? row.curr_code ?? "",
            name: row.CURR_NAME ?? row.curr_name ?? "",
          }));
          setCurrencyOptions(opts);
        }
      } catch {
        if (!cancelled) setCurrencyOptions([]);
      } finally {
        if (!cancelled) setLoadingCurrencies(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.company_code]);

  // Existing job lines
  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode) return;
    (async () => {
      try {
        const response = await getInvoiceDetailLines({
          loginid: user.loginid ?? "",
          company_code: user.company_code ?? "",
          prin_code: prinCode,
          invoice_no: invoiceNo,
        });
        setLines(Array.isArray(response) ? response : []);
      } catch {
        setLines([]);
      }
    })();
  }, [prinCode, invoiceNo, user?.loginid, user?.company_code]);

  // Re-seed job selection rows
  useEffect(() => {
    if (!user?.loginid || !user?.company_code || !prinCode || !invoiceNo) return;
    (async () => {
      try {
        const response = await getInvoiceJobSelection({
          loginid: user.loginid ?? "",
          company_code: user.company_code ?? "",
          prin_code: prinCode,
          invoice_no: invoiceNo,
          from_date: toDDMMYYYY(fromDate),
          to_date: toDDMMYYYY(toDate),
        });
        const alreadyLinked = (Array.isArray(response) ? response : [])
          .filter((row: any) => (row.selected ?? row.SELECTED) === "Y")
          .map((row: any) => ({
            job_no: row.job_no ?? row.JOB_NO ?? "",
            act_code: row.act_code ?? row.ACT_CODE ?? "",
            act_group_name: row.act_group_name ?? row.ACT_GROUP_NAME ?? "",
            activity: row.activity ?? row.ACTIVITY ?? "",
            invoice_no: row.invoice_no ?? row.INVOICE_NO ?? "",
            prin_code: row.prin_code ?? row.PRIN_CODE ?? prinCode,
            quantity: Number(row.quantity ?? row.QUANTITY ?? 0),
            bill: Number(row.bill ?? row.BILL ?? 0),
            job_date: row.job_date ?? row.JOB_DATE ?? null,
            source_srno: row.srno ?? row.SRNO ?? null,
          }));
        setJobSelectionRows(alreadyLinked);
      } catch {
        setJobSelectionRows([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prinCode, invoiceNo, user?.loginid, user?.company_code]);

  // Exchange rate auto‑fill
  useEffect(() => {
    if (!invoice.curr_code) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await executeWmsInboundSql(
          `SELECT EX_RATE FROM MS_CURRENCY WHERE CURR_CODE = '${invoice.curr_code}'`,
        );
        const rate = rows?.[0]?.ex_rate ?? rows?.[0]?.EX_RATE ?? "";
        if (!cancelled) setField("ex_rate", String(rate));
      } catch {
        if (!cancelled) setField("ex_rate", "");
      }
    })();
    return () => { cancelled = true; };
  }, [invoice.curr_code]);

  // Group job lines
  const groupedLines = useMemo(() => {
    const map: Record<string, any> = {};
    lines.forEach((row) => {
      const key = row.activity || "";
      if (!map[key]) map[key] = { ...row };
      else map[key].quantity += Number(row.quantity || 0);
      map[key].cost_rate = Number(row.cost_rate || 0);
      map[key].bill_rate = Number(row.bill_rate || 0);
    });
    return Object.values(map).map((row: any, idx) => ({
      ...row,
      srno: idx + 1,
      cost_amount: (row.quantity || 0) * (row.cost_rate || 0),
      bill_amount: (row.quantity || 0) * (row.bill_rate || 0),
    }));
  }, [lines]);

  const aggregatedStorage = useMemo(() => {
    if (storageLines.length === 0) return null;
    const totalQty = storageLines.reduce((sum, r: any) => sum + Number(r.QTY || 0), 0);
    const totalAmount = storageLines.reduce((sum, r: any) => sum + Number(r.AMOUNT || 0), 0);
    return { count: storageLines.length, totalQty, totalAmount };
  }, [storageLines]);

  const billingTotals = useMemo(() => {
    const jobTotal = groupedLines.reduce((sum, row: any) => sum + Number(row.bill_amount || 0), 0);
    const storageTotal = aggregatedStorage?.totalAmount ?? 0;
    return { jobTotal, storageTotal, grandTotal: jobTotal + storageTotal };
  }, [groupedLines, aggregatedStorage]);

  const handleJobSelect = (selectedJobs: any[]) => {
    const existingKeys = new Set(
      lines.map((row) => `${String(row.job_no ?? "").trim()}||${String(row.act_code ?? "").trim()}`),
    );
    const duplicates: string[] = [];
    const newLines: any[] = [];
    const newJobSelectionRows: any[] = [];

    selectedJobs.forEach((job) => {
      const jobNo = String(job.job_no ?? job.JOB_NO ?? "").trim();
      const actCode = String(job.act_code ?? job.ACT_CODE ?? "").trim();
      const key = `${jobNo}||${actCode}`;
      if (existingKeys.has(key)) {
        duplicates.push(`Job No: ${jobNo}, Act Code: ${actCode}`);
        return;
      }
      existingKeys.add(key);

      const line = {
        srno: lines.length + newLines.length + 1,
        act_code: actCode,
        act_group_name: job.act_group_name ?? job.ACT_GROUP_NAME ?? "",
        activity: job.activity ?? job.ACTIVITY ?? "",
        invoice_no: job.invoice_no ?? job.INVOICE_NO ?? "",
        job_no: jobNo,
        prin_code: job.prin_code ?? job.PRIN_CODE ?? "",
        bill: Number(job.bill ?? job.BILL ?? 0),
        bill_rate: Number(job.bill_rate ?? job.BILL_RATE ?? 0),
        cost_rate: Number(job.cost_rate ?? job.COST_RATE ?? 0),
        actual_cost: Number(job.actual_cost ?? job.ACTUAL_COST ?? 0),
        quantity: Number(job.quantity ?? job.QUANTITY ?? 1),
        other_services: job.other_services ?? "",
        job_date: job.job_date ?? job.JOB_DATE ?? null,
        cancelled: false,
        source_srno: job.srno ?? job.SRNO ?? null,
      };
      newLines.push(line);
      newJobSelectionRows.push(line);
    });

    if (duplicates.length) setWarning(`Already selected — ${duplicates.join(" | ")}`);
    if (newLines.length) {
      setLines((prev) => [...prev, ...newLines]);
      setJobSelectionRows((prev) => [...prev, ...newJobSelectionRows]);
    }
  };

  const handleStorageSelect = (selectedRows: StorageSelectionRow[]) => {
    setStorageLines((prev) => [...prev, ...selectedRows]);
  };

  const handleSave = async () => {
    setSaving(true);
    setWarning("");
    try {
      const invoiceHeader: TInvoice[] = [{ ...invoice, USER_ID: user?.loginid, COMPANY_CODE: user?.company_code }];

      const jobLineRows: TInvoiceDetail[] = lines.map((row, index) => {
        const quantity = Number(row.quantity || 0);
        const billRate = Number(row.bill_rate || 0);
        const costRate = Number(row.cost_rate || 0);
        return {
          ...row,
          srno: index + 1,
          invoice_no: invoiceNo,
          prin_code: prinCode,
          job_no: row.job_no ?? "",
          quantity,
          bill_rate: billRate,
          cost_rate: costRate,
          bill_amount: quantity * billRate,
          cost_amount: quantity * costRate,
        };
      });

      const jobSelection = jobSelectionRows.map((row) => ({
        job_no: row.job_no,
        act_code: row.act_code,
        act_group_name: row.act_group_name,
        activity: row.activity,
        invoice_no: row.invoice_no,
        prin_code: prinCode,
        quantity: row.quantity,
        bill: row.bill,
        job_date: row.job_date,
        srno: row.source_srno,
        selected: "Y",
      }));

      const storageSelection = storageLines.map((row: any) => ({
        ...row,
        act_code: "9001",
        SELECTED: "Y",
      }));

      const storageDetailRows: TInvoiceDetail[] = storageLines.map((row: any) => ({
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

      const invoiceDetails: TInvoiceDetail[] = [...jobLineRows, ...jobSelection, ...storageDetailRows].map(
        (row, index) => ({
          ...row,
          srno: index + 1,
          INV_DESC1: getValue(invoice, "inv_desc1") ?? "",
          INV_DESC2: getValue(invoice, "inv_desc2") ?? "",
        }),
      );

      const result = await updateBillingApi({ invoiceHeader, invoiceDetails, storageSelection, jobSelection });
      if (result.success) onClose(true);
      else setWarning(result.message);
    } catch (err) {
      setWarning(err instanceof Error ? err.message : "Error while saving invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (report_type: "grouped" | "activitywise") => {
    if (!prinCode || !invoiceNo) return;
    setPrintError("");
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setPrintError("Please allow pop-ups for this site to view the report.");
      return;
    }
    reportWindow.document.write("Loading invoice report...");
    try {
      const html = await getInvocieDetailReport(
        String(prinCode),
        String(invoiceNo),
        String(user?.company_code ?? ""),
        report_type,
      );
      if (reportWindow.closed) return;
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
    } catch {
      setPrintError("Failed to load report. Please try again.");
      if (!reportWindow.closed) reportWindow.close();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-160px)] w-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white pt-1">
      {/* Header */}
      <header className="flex w-full shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => onClose(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            ←
          </button>
          <h1 className="text-[17px] font-semibold text-slate-900">
            {isNew ? "Create invoice" : viewMode ? "View invoice" : "Edit invoice"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {hasExistingData && (
            <>
              <button
                type="button"
                onClick={() => handlePrint("grouped")}
                className="flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <Printer size={13} /> Grouped
              </button>
              <button
                type="button"
                onClick={() => handlePrint("activitywise")}
                className="flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <Printer size={13} /> Activity-wise
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onClose(false)}
            className="h-8 rounded-md border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          {!viewMode && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex h-8 items-center gap-1 rounded-md bg-[#1F5C6B] px-4 text-[13px] font-medium text-white hover:bg-[#194b58] disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </header>

      {/* Warnings */}
      {warning && (
        <div className="mx-4 mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] text-rose-600">
          {warning}
        </div>
      )}
      {printError && (
        <div className="mx-4 mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] text-rose-600">
          {printError}
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 pb-4 pt-2 overflow-hidden">
        {/* Fields section — fixed height, no scroll */}
        <section className="shrink-0 w-full rounded-lg border border-slate-200 bg-white px-5 py-3">
          <fieldset disabled={viewMode} className="grid grid-cols-12 gap-x-3 gap-y-2">
            {/* Principal code */}
            <div style={{ gridColumn: "span 3 / span 3" }}>
              <LookupField
                label="Principal code"
                required
                compact
                showLabelInCompact
                value={prinCode}
                columns={[
                  { field: "prin_code", header: "Code" },
                  { field: "prin_name", header: "Name" },
                ]}
                valueField="prin_code"
                displayFields={["prin_code", "prin_name"]}
                loadOptions={() => getPrincipalDropdown(user?.company_code ?? "", user?.loginid ?? "")}
                onChange={(value, row) =>
                  setInvoice((prev: any) => ({
                    ...prev,
                    prin_code: value,
                    curr_code: row ? getValue(row, "curr_code") ?? "" : "",
                  }))
                }
                disabled={viewMode}
                // inputClassName={inputBase} // apply consistent styling
              />
            </div>

            {/* Dynamic fields */}
            {ALL_FIELDS.map(({ label, key, type, disabled, span, placeholder, options }) => {
              const value = getValue(invoice, key) ?? "";
              if (type === "date") {
                return (
                  <FieldWrap key={key} label={label} span={span}>
                    <Input
                      className={inputBase}
                      type="date"
                      value={toDateInputValue(value)}
                      onChange={(e) => setField(key, e.target.value)}
                      disabled={viewMode || disabled}
                    />
                  </FieldWrap>
                );
              }
              if (type === "select" && options) {
                return (
                  <FieldWrap key={key} label={label} span={span}>
                    <select
                      className={selectBase}
                      value={value}
                      onChange={(e) => setField(key, e.target.value)}
                      disabled={viewMode || disabled}
                    >
                      <option value="">{placeholder || "Select"}</option>
                      {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </FieldWrap>
                );
              }
              return (
                <FieldWrap key={key} label={label} span={span}>
                  <Input
                    className={inputBase}
                    type="text"
                    value={value}
                    onChange={(e) => setField(key, e.target.value)}
                    disabled={viewMode || disabled}
                    placeholder={placeholder || ""}
                  />
                </FieldWrap>
              );
            })}

            {/* Currency code — custom LookupField */}
            <div style={{ gridColumn: "span 2 / span 2" }}>
              <LookupField
                label="Currency code"
                compact
                showLabelInCompact
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
                    const rows = await executeWmsInboundSql(
                      `SELECT CURR_CODE, CURR_NAME FROM MS_CURRENCY ORDER BY CURR_CODE`
                    );
                    const opts = (Array.isArray(rows) ? rows : []).map((row: any) => ({
                      code: row.CURR_CODE ?? row.curr_code ?? "",
                      name: row.CURR_NAME ?? row.curr_name ?? "",
                    }));
                    if (opts.length) setCurrencyOptions(opts);
                    return opts;
                  } catch {
                    return [];
                  }
                }}
                onChange={(value) => setInvoice((prev: any) => ({ ...prev, curr_code: value }))}
                disabled={viewMode || loadingCurrencies}
                placeholder={loadingCurrencies ? "Loading…" : "Select currency"}
                // inputClassName={inputBase}
              />
            </div>

            {/* Exchange rate — disabled input */}
            <div style={{ gridColumn: "span 2 / span 2" }}>
              <FieldWrap label="Exchange rate" span={2}>
                <Input
                  className={inputBase}
                  type="text"
                  value={getValue(invoice, "ex_rate") ?? ""}
                  disabled
                  placeholder="Auto"
                />
              </FieldWrap>
            </div>
          </fieldset>
        </section>

        {/* Grids section — scrolls if needed */}
        <section className="flex-1 min-h-0 grid grid-cols-2 gap-3 overflow-auto">
          <GridPanel
            title="Job details"
            subtitle="Activities billed on this invoice"
            action={
              !viewMode && (
                <button
                  type="button"
                  onClick={() => setJobModalOpen(true)}
                  disabled={!prinCode}
                  className="h-6 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Select job
                </button>
              )
            }
            emptyText={prinCode ? "No jobs added to this invoice yet." : "Select a principal to load job details."}
            headers={["Activity", "Qty", "Cost rate", "Cost amt", "Bill rate", "Bill amt"]}
            rows={groupedLines}
            rowKey={(r: any) => r.srno}
            renderRow={(r: any) => [
              r.activity,
              String(r.quantity),
              Number(r.cost_rate).toFixed(2),
              Number(r.cost_amount).toFixed(2),
              Number(r.bill_rate).toFixed(2),
              Number(r.bill_amount).toFixed(2),
            ]}
          />
          <GridPanel
            title="Storage details"
            subtitle="Aggregated storage charges for this invoice"
            action={
              !viewMode && (
                <button
                  type="button"
                  onClick={() => setStorageModalOpen(true)}
                  disabled={!prinCode}
                  className="h-6 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Select storage
                </button>
              )
            }
            emptyText={prinCode ? "No storage charges added to this invoice yet." : "Select a principal to load storage details."}
            headers={["Record", "Qty", "Amount"]}
            rows={aggregatedStorage ? [aggregatedStorage] : []}
            rowKey={() => "storage-summary"}
            renderRow={(r: any) => [`${r.count} record${r.count > 1 ? "s" : ""}`, String(r.totalQty), r.totalAmount.toFixed(3)]}
          />
        </section>

        {/* Footer totals */}
        <footer className="flex w-full shrink-0 items-center justify-end gap-8 rounded-lg border border-slate-200 bg-white px-5 py-2.5">
          <Total label="Job total" value={billingTotals.jobTotal} suffix={currCode} />
          <Total label="Storage total" value={billingTotals.storageTotal} suffix={currCode} />
          <div className="h-6 w-px bg-slate-200" />
          <Total label="Grand total" value={billingTotals.grandTotal} suffix={currCode} emphasize />
        </footer>
      </div>

      {/* Modals */}
      {jobModalOpen && (
        <JobSelectionModal
          prinCode={prinCode}
          invoiceNo={invoiceNo}
          fromDate={fromDate}
          toDate={toDate}
          existingKeys={existingJobKeys}
          onClose={() => setJobModalOpen(false)}
          onSelect={handleJobSelect}
        />
      )}
      {storageModalOpen && (
        <StorageSelectionModal
          prinCode={prinCode}
          consolidatedInvNo={consolidatedInvNo}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setStorageModalOpen(false)}
          onSelect={handleStorageSelect}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GridPanel
// ---------------------------------------------------------------------------

function GridPanel({
  title,
  subtitle,
  action,
  emptyText,
  headers,
  rows,
  rowKey,
  renderRow,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  emptyText: string;
  headers: string[];
  rows: any[];
  rowKey: (row: any) => string | number;
  renderRow: (row: any) => string[];
}) {
  return (
    <div className="flex h-full min-h-[180px] w-full flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8 text-center text-[12px] text-slate-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)}>
                  {renderRow(row).map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Total
// ---------------------------------------------------------------------------

function Total({ label, value, suffix, emphasize }: { label: string; value: number; suffix?: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className={emphasize ? "text-[15px] font-semibold text-[#1F5C6B]" : "text-[14px] font-medium text-slate-700"}>
        {value.toFixed(3)} {suffix}
      </span>
    </div>
  );
}