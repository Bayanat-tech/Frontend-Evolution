import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, LoaderCircle, Package, Printer, Receipt, Save, Trash2, X } from "lucide-react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/Table";
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
import JobSelectionModal from "./JobSelectionModal";
import StorageSelectionModal from "./StorageSelectionModal";
import { executeWmsInboundSql, getInvocieDetailReport } from "../../../api/wms";

type InvoiceFormProps = {
  existingData?: Record<string, unknown>;
  viewMode?: boolean;
  onClose: (shouldRefetch?: boolean) => void;
};

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

type FieldDef = { label: string; key: string; type?: "text" | "date"; disabled?: boolean; required?: boolean; wide?: boolean };

const HEADER_FIELDS: FieldDef[] = [
  { label: "Invoice No", key: "invoice_no" },
  { label: "Invoice Date", key: "invoice_date", type: "date" },
  { label: "From Date", key: "from_date", type: "date" },
  { label: "To Date", key: "to_date", type: "date" },
];

const STATUS_FIELDS: FieldDef[] = [
  { label: "Invoice Status", key: "inv_status" },
  { label: "Despatched", key: "despatched" },
  { label: "Dispatch Date", key: "desp_date", type: "date" },
  { label: "Invoice Mode", key: "inv_mode" },
];

const REFERENCE_FIELDS: FieldDef[] = [
  { label: "Account Reference", key: "account_ref" },
  { label: "Invoice To", key: "inv_to" },
  { label: "Principal Ref 1", key: "prin_ref1" },
  { label: "Principal Ref 2", key: "prin_ref2" },
  { label: "Credit Note No", key: "credit_note_no" },
  { label: "Credit Note Date", key: "credit_note_date", type: "date" },
];

const DESCRIPTION_FIELDS: FieldDef[] = [
  { label: "Invoice Description 1", key: "inv_desc1", wide: true },
  { label: "Invoice Description 2", key: "inv_desc2", wide: true },
];

const CURRENCY_FIELDS: FieldDef[] = [
  { label: "Currency Code", key: "curr_code", disabled: true },
  { label: "Exchange Rate", key: "ex_rate", disabled: true },
];

const REPORT_LOADING_HTML = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Loading report...</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;
    justify-content:center;height:100vh;margin:0;color:#555;">
    Loading invoice report...
  </body>
</html>`;

const reportErrorHtml = (message: string) => `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Error</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;
    justify-content:center;height:100vh;margin:0;color:#c0392b;">
    ${message}
  </body>
</html>`;

// ── Compact primitives ──
function GroupDivider({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="col-span-full mt-0.5 flex items-center gap-1 border-b border-primary/20 pb-0 first:mt-0">
      <Icon size={12} className="text-primary" />
      <span className="text-[9px] font-semibold uppercase tracking-wider text-primary">{title}</span>
    </div>
  );
}

function CompactField({
  field,
  invoice,
  onChange,
  disabled,
}: {
  field: FieldDef;
  invoice: any;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  const { label, key, type, disabled: fieldDisabled, required, wide } = field;
  return (
    <label className={`field grid gap-0 ${wide ? "col-span-2" : ""}`}>
      <span className="text-[9px] font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      <Input
        className="h-6 w-full rounded border border-input bg-background px-1.5 text-[10px] shadow-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted-foreground"
        type={type === "date" ? "date" : "text"}
        value={type === "date" ? toDateInputValue(getValue(invoice, key)) : getValue(invoice, key) ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
        disabled={disabled || fieldDisabled}
      />
    </label>
  );
}

function BillingSection({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: any;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-white p-1.5">
      <div className="mb-0.5 flex items-center justify-between gap-2 border-b pb-0">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-primary" />
          <div>
            <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-primary">{title}</p>
            <p className="m-0 text-[10px] font-medium text-foreground">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyTableState({ icon: Icon, message, actionLabel, onAction }: {
  icon: any;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-muted-foreground">
      <Icon size={16} className="text-muted-foreground/60" />
      <p className="m-0 text-[10px]">{message}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" type="button" onClick={onAction} className="h-6 text-xs">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function InvoiceForm({ existingData, viewMode, onClose }: InvoiceFormProps) {
  const { user } = useAuth();
  const company_code = user?.company_code ?? "";

  const [invoice, setInvoice] = useState<any>(existingData ?? {});
  const [lines, setLines] = useState<any[]>([]);
  const [jobSelectionRows, setJobSelectionRows] = useState<any[]>([]);
  const [storageLines, setStorageLines] = useState<StorageSelectionRow[]>([]);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [printError, setPrintError] = useState("");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const prinCode = getValue(invoice, "prin_code") || "";
  const invoiceNo = getValue(invoice, "invoice_no") || "";
  const fromDate = getValue(invoice, "from_date");
  const toDate = getValue(invoice, "to_date");
  const hasExistingData = !!existingData && Object.keys(existingData).length > 0;
  const consolidatedInvNo = getValue(invoice, "consolidated_invno") || invoiceNo;
  const currCode = getValue(invoice, "curr_code") || "";

  const report_type = ['grouped','activitywise'];

  const existingJobKeys = useMemo(
    () => lines.map((row) => `${String(row.job_no ?? "").trim()}||${String(row.act_code ?? "").trim()}`),
    [lines],
  );

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
  }, [prinCode, invoiceNo, user?.loginid, user?.company_code]);

  const setField = (key: string, value: string) => {
    setInvoice((prev: any) => ({ ...prev, [key]: value }));
  };

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
    const totalQty = storageLines.reduce((sum, r) => sum + Number(r.QTY || 0), 0);
    const totalAmount = storageLines.reduce((sum, r) => sum + Number(r.AMOUNT || 0), 0);
    return { count: storageLines.length, totalQty, totalAmount };
  }, [storageLines]);

  const billingTotals = useMemo(() => {
    const jobTotal = groupedLines.reduce((sum, row) => sum + Number(row.bill_amount || 0), 0);
    const storageTotal = aggregatedStorage?.totalAmount ?? 0;
    return { jobTotal, storageTotal, grandTotal: jobTotal + storageTotal };
  }, [groupedLines, aggregatedStorage]);

  const handleDeleteLine = (activity: string) => {
    if (!window.confirm("Remove this line item?")) return;
    setLines((prev) => prev.filter((r) => r.activity !== activity));
  };

  const handleClearStorageLines = () => {
    if (!window.confirm("Remove all storage lines?")) return;
    setStorageLines([]);
  };

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

      const storageSelection = storageLines.map((row) => ({
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

      const invoiceDetails: TInvoiceDetail[] = [
        ...jobLineRows,
        ...jobSelection,
        ...storageDetailRows,
      ].map((row, index) => ({
        ...row,
        srno: index + 1,
        INV_DESC1: getValue(invoice, "inv_desc1") ?? "",
        INV_DESC2: getValue(invoice, "inv_desc2") ?? "",
      }));

      const result = await updateBillingApi({
        invoiceHeader,
        invoiceDetails,
        storageSelection,
        jobSelection,
      });
      if (result.success) onClose(true);
      else setWarning(result.message);
    } catch (err) {
      setWarning(err instanceof Error ? err.message : "Error while saving invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (report_type: string) => {
    if (!prinCode || !invoiceNo) return;
    setPrintError("");

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setPrintError("Please allow pop-ups for this site to view the report.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(REPORT_LOADING_HTML);
    reportWindow.document.close();

    try {
      const html = await getInvocieDetailReport(String(prinCode), String(invoiceNo), String(company_code), String(report_type));
      if (reportWindow.closed) return;
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
    } catch (err) {
      setPrintError("Failed to load report. Please try again.");
      if (!reportWindow.closed) {
        reportWindow.document.open();
        reportWindow.document.write(reportErrorHtml("Failed to load report. Please try again."));
        reportWindow.document.close();
      }
    }
  };

  useEffect(() => {
    if (!invoice.curr_code) return;
    let cancelled = false;
    const fetchExRate = async () => {
      try {
        const ex_rate_sql = `SELECT EX_RATE FROM MS_CURRENCY WHERE CURR_CODE = '${invoice.curr_code}'`;
        const response = await executeWmsInboundSql(ex_rate_sql);
        const rate = response?.[0]?.ex_rate ?? response?.[0]?.EX_RATE ?? "";
        if (!cancelled) {
          setField("ex_rate", String(rate));
        }
      } catch (err) {
        if (!cancelled) {
          setField("ex_rate", "");
        }
      }
    };
    fetchExRate();
    return () => {
      cancelled = true;
    };
  }, [invoice.curr_code]);

  return (
    <div className="grid gap-1.5 rounded-md border bg-white p-2 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b pb-1.5">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="ghost" onClick={() => onClose(false)} title="Back to listing" className="h-6 w-6">
            <ArrowLeft size={14} />
          </Button>
          <h1 className="m-0 text-sm font-semibold text-foreground">
            {viewMode ? "View Invoice" : existingData ? "Edit Invoice" : "Create Invoice"}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {hasExistingData && (
            <Button variant="outline" onClick={() => setPrintDialogOpen(true)} size="sm" className="h-6 text-xs">
              <Printer size={12} /> Print
            </Button>
          )}
          <Button variant="outline" onClick={() => onClose(false)} size="sm" className="h-6 text-xs">
            <X size={12} /> Cancel
          </Button>
          {!viewMode && (
            <Button
              onClick={handleSave}
              disabled={saving || (lines.length === 0 && storageLines.length === 0)}
              size="sm"
              className="h-6 text-xs"
            >
              {saving ? <LoaderCircle size={12} className="animate-spin" /> : <Save size={12} />} Save
            </Button>
          )}
        </div>
      </div>

      {warning && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
          {warning}
        </div>
      )}
      {printError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
          {printError}
        </div>
      )}

      {/* ── TOP: Invoice Details (all fields) ── */}
      <div className="grid grid-cols-3 gap-x-1.5 gap-y-0.5 bg-white">
        <GroupDivider icon={Receipt} title="Invoice Information" />
        <div className="col-span-2 grid gap-0">
          <span className="text-[9px] font-medium text-foreground">
            Principal Code <span className="text-destructive">*</span>
          </span>
          <LookupField
            label=""
            required
            compact
            value={prinCode}
            columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }]}
            valueField="prin_code"
            displayFields={["prin_code", "prin_name"]}
            loadOptions={() => getPrincipalDropdown(user?.company_code ?? "", user?.loginid ?? "")}
            onChange={(value, row) => {
              setInvoice((prev: any) => ({
                ...prev,
                prin_code: value,
                curr_code: row ? (getValue(row, "curr_code") ?? "") : "",
              }));
            }}
            disabled={viewMode}
            // className="h-6 text-[10px]"
          />
        </div>
        {HEADER_FIELDS.map((f) => (
          <CompactField key={f.key} field={f} invoice={invoice} onChange={setField} disabled={viewMode} />
        ))}

        <GroupDivider icon={FileText} title="Status" />
        {STATUS_FIELDS.map((f) => (
          <CompactField key={f.key} field={f} invoice={invoice} onChange={setField} disabled={viewMode} />
        ))}

        <GroupDivider icon={FileText} title="References" />
        {REFERENCE_FIELDS.map((f) => (
          <CompactField key={f.key} field={f} invoice={invoice} onChange={setField} disabled={viewMode} />
        ))}

        <GroupDivider icon={FileText} title="Description" />
        {DESCRIPTION_FIELDS.map((f) => (
          <CompactField key={f.key} field={f} invoice={invoice} onChange={setField} disabled={viewMode} />
        ))}

        <GroupDivider icon={Receipt} title="Currency" />
        {CURRENCY_FIELDS.map((f) => (
          <CompactField key={f.key} field={f} invoice={invoice} onChange={setField} disabled={viewMode} />
        ))}
        <p className="col-span-full -mt-0.5 text-[9px] text-muted-foreground">
          Auto-filled from the selected Principal — not editable here.
        </p>
      </div>

      {/* ── BOTTOM: Billing sections side by side ── */}
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {/* Job Details */}
        <BillingSection
          icon={Receipt}
          title="Job Details"
          subtitle="Activities billed on this invoice"
          action={
            !viewMode && (
              <Button size="sm" variant="outline" onClick={() => setJobModalOpen(true)} disabled={!prinCode} className="h-6 text-[10px]">
                + Select Job
              </Button>
            )
          }
        >
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-secondary/70">
                <TableRow>
                  <TableHead className="py-0.5 text-[9px]">Action</TableHead>
                  <TableHead className="py-0.5 text-[9px]">Sr</TableHead>
                  <TableHead className="py-0.5 text-[9px]">Activity</TableHead>
                  <TableHead className="py-0.5 text-right text-[9px]">Qty</TableHead>
                  <TableHead className="py-0.5 text-right text-[9px]">Cost Rate</TableHead>
                  <TableHead className="py-0.5 text-right text-[9px]">Cost Amt</TableHead>
                  <TableHead className="py-0.5 text-right text-[9px]">Bill Rate</TableHead>
                  <TableHead className="py-0.5 text-right text-[9px]">Bill Amt</TableHead>
                  <TableHead className="py-0.5 text-[9px]">Other</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-0">
                      <EmptyTableState
                        icon={Receipt}
                        message={prinCode ? "No jobs added to this invoice yet." : "Pick a Principal on the Invoice Details tab first."}
                        actionLabel={prinCode && !viewMode ? "Select Job" : undefined}
                        onAction={() => setJobModalOpen(true)}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedLines.map((row) => (
                    <TableRow key={row.srno}>
                      <TableCell className="py-0.5">
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteLine(row.activity)} disabled={viewMode} className="h-5 w-5">
                          <Trash2 size={11} className="text-destructive" />
                        </Button>
                      </TableCell>
                      <TableCell className="py-0.5 text-[10px]">{row.srno}</TableCell>
                      <TableCell className="py-0.5 text-[10px]">{row.activity}</TableCell>
                      <TableCell className="py-0.5 text-right text-[10px]">{row.quantity}</TableCell>
                      <TableCell className="py-0.5 text-right text-[10px]">{row.cost_rate}</TableCell>
                      <TableCell className="py-0.5 text-right text-[10px]">{row.cost_amount}</TableCell>
                      <TableCell className="py-0.5 text-right text-[10px]">{row.bill_rate}</TableCell>
                      <TableCell className="py-0.5 text-right text-[10px]">{row.bill_amount}</TableCell>
                      <TableCell className="py-0.5 text-[10px]">{row.other_services}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </BillingSection>

        {/* Storage Details */}
        <BillingSection
          icon={Package}
          title="Storage Details"
          subtitle="Aggregated storage charges for this invoice"
          action={
            !viewMode && (
              <Button size="sm" variant="outline" onClick={() => setStorageModalOpen(true)} disabled={!prinCode} className="h-6 text-[10px]">
                + Select Storage
              </Button>
            )
          }
        >
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-secondary/70">
                <TableRow>
                  <TableHead className="py-0.5 text-[9px]">Action</TableHead>
                  <TableHead className="py-0.5 text-[9px]">Records</TableHead>
                  <TableHead className="py-0.5 text-right text-[9px]">Qty</TableHead>
                  <TableHead className="py-0.5 text-right text-[9px]">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!aggregatedStorage ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-0">
                      <EmptyTableState
                        icon={Package}
                        message={prinCode ? "No storage charges added to this invoice yet." : "Pick a Principal on the Invoice Details tab first."}
                        actionLabel={prinCode && !viewMode ? "Select Storage" : undefined}
                        onAction={() => setStorageModalOpen(true)}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell className="py-0.5">
                      <Button size="icon" variant="ghost" onClick={handleClearStorageLines} disabled={viewMode} className="h-5 w-5">
                        <Trash2 size={11} className="text-destructive" />
                      </Button>
                    </TableCell>
                    <TableCell className="py-0.5 text-[10px]">{aggregatedStorage.count} record{aggregatedStorage.count > 1 ? "s" : ""}</TableCell>
                    <TableCell className="py-0.5 text-right text-[10px]">{aggregatedStorage.totalQty}</TableCell>
                    <TableCell className="py-0.5 text-right text-[10px]">{aggregatedStorage.totalAmount.toFixed(3)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </BillingSection>
      </div>

      {/* Totals strip */}
      <section className="rounded-md border bg-secondary/20 p-1.5">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="text-right">
            <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">Job total</p>
            <p className="m-0 text-xs font-semibold text-foreground">{billingTotals.jobTotal.toFixed(3)} {currCode}</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">Storage total</p>
            <p className="m-0 text-xs font-semibold text-foreground">{billingTotals.storageTotal.toFixed(3)} {currCode}</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-[8px] font-semibold uppercase tracking-wide text-primary">Grand total</p>
            <p className="m-0 text-sm font-bold text-primary">{billingTotals.grandTotal.toFixed(3)} {currCode}</p>
          </div>
        </div>
      </section>

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

      {printDialogOpen && (
        <Dialog
          open
          title="Print Invoice"
          onClose={() => setPrintDialogOpen(false)}
          compact
        >
          <div className="grid gap-1.5 py-1">
            <p className="m-0 text-sm text-muted-foreground">
              Choose how you want the invoice report to be generated.
            </p>
            <div className="grid gap-1">
              {report_type.map((type) => {
                const isGrouped = type === "grouped";
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handlePrint(type)}
                    className="group flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/15">
                      <Printer size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-semibold text-foreground">
                        {isGrouped ? "Grouped" : "Activity-wise"}
                      </p>
                      <p className="m-0 text-xs text-muted-foreground">
                        {isGrouped
                          ? "Summary by activity groups"
                          : "Detailed breakdown per activity"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Print →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default InvoiceForm;