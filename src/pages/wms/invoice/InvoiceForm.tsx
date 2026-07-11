import { useEffect, useMemo, useState } from "react";
import { FileText, LoaderCircle, Package, Printer, Receipt, Save, Trash2, X } from "lucide-react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/Table";
import { useAuth } from "../../../state/AuthContext";
import {
  getPrincipalDropdown,
  getInvoiceDetailLines,
  updateBillingApi,
  TInvoice,
  TInvoiceDetail,
} from "../../../api/billing";
import JobSelectionModal from "./JobSelectionModal";
import StorageSelectionModal from "./StorageSelectionModal";

type InvoiceFormProps = {
  existingData?: Record<string, unknown>;
  viewMode?: boolean;
  onClose: (shouldRefetch?: boolean) => void;
};

const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];

type FieldDef = { label: string; key: string; type?: "text" | "date" };

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
  { label: "Invoice Description 1", key: "inv_desc1" },
  { label: "Invoice Description 2", key: "inv_desc2" },
];

const CURRENCY_FIELDS: FieldDef[] = [
  { label: "Currency Code", key: "curr_code" },
  { label: "Exchange Rate", key: "ex_rate" },
];

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 border-b pb-1">
      <Icon size={13} className="text-primary" />
      <div>
        <p className="m-0 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary">{title}</p>
        <p className="m-0 text-xs font-medium leading-tight text-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function FieldGrid({ fields, invoice, onChange, disabled }: {
  fields: FieldDef[];
  invoice: any;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(({ label, key, type }) => (
        <label key={key} className="field">
          <span className="text-xs">{label}</span>
          <Input
            className="h-8 text-sm"
            type={type === "date" ? "date" : "text"}
            value={getValue(invoice, key) ?? ""}
            onChange={(e) => onChange(key, e.target.value)}
            disabled={disabled}
          />
        </label>
      ))}
    </div>
  );
}

export function InvoiceForm({ existingData, viewMode, onClose }: InvoiceFormProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [invoice, setInvoice] = useState<any>(existingData ?? {});
  const [lines, setLines] = useState<any[]>([]);
  const [storageLines, setStorageLines] = useState<any[]>([]);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");

  const prinCode = getValue(invoice, "prin_code") || "";
  const invoiceNo = getValue(invoice, "invoice_no") || "";
  const fromDate = getValue(invoice, "from_date");
  const toDate = getValue(invoice, "to_date");
  const hasExistingData = !!existingData && Object.keys(existingData).length > 0;

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

  const handleDeleteLine = (activity: string) => {
    if (!window.confirm("Remove this line item?")) return;
    setLines((prev) => prev.filter((r) => r.activity !== activity));
  };

  const handleDeleteStorageLine = (index: number) => {
    if (!window.confirm("Remove this storage line?")) return;
    setStorageLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleJobSelect = (selectedJobs: any[]) => {
    const existingKeys = new Set(
      lines.map((row) => `${String(row.job_no ?? "").trim()}||${String(row.act_code ?? "").trim()}`),
    );
    const duplicates: string[] = [];
    const newLines: any[] = [];

    selectedJobs.forEach((job) => {
      const jobNo = String(job.job_no ?? job.JOB_NO ?? "").trim();
      const actCode = String(job.act_code ?? job.ACT_CODE ?? "").trim();
      const key = `${jobNo}||${actCode}`;
      if (existingKeys.has(key)) {
        duplicates.push(`Job No: ${jobNo}, Act Code: ${actCode}`);
        return;
      }
      existingKeys.add(key);
      newLines.push({
        srno: lines.length + newLines.length + 1,
        act_code: actCode,
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
      });
    });

    if (duplicates.length) setWarning(`Already selected — ${duplicates.join(" | ")}`);
    if (newLines.length) setLines((prev) => [...prev, ...newLines]);
  };

  const handleStorageSelect = (selectedRows: any[]) => {
    setStorageLines((prev) => [...prev, ...selectedRows]);
  };

  const handleSave = async () => {
    setSaving(true);
    setWarning("");
    try {
      const invoiceHeader: TInvoice[] = [{ ...invoice, USER_ID: user?.loginid, COMPANY_CODE: user?.company_code }];
      const invoiceDetails: TInvoiceDetail[] = lines.map((row, index) => {
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

      // NOTE: storageLines aren't sent to the backend yet — updateBillingApi's
      // contract only accepts invoiceHeader/invoiceDetails today. Once you have
      // a backend field/endpoint for storage lines, wire storageLines in here.
      const result = await updateBillingApi({ invoiceHeader, invoiceDetails });
      if (result.success) onClose(true);
      else setWarning(result.message);
    } catch (err) {
      setWarning(err instanceof Error ? err.message : "Error while saving invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    console.log("Print invoice", { company_code: user?.company_code, prin_code: prinCode, invoice_no: invoiceNo });
  };

  return (
    <Dialog
      open
      wide
      title={viewMode ? "View Invoice" : existingData ? "Edit Invoice" : "Create Invoice"}
      onClose={() => onClose(false)}
      contentClassName="max-h-[90vh] w-[min(96vw,1200px)]"
      footer={
        <div className="flex w-full items-center justify-between">
          {hasExistingData ? (
            <Button variant="outline" onClick={handlePrint}>
              <Printer size={14} /> Print
            </Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onClose(false)}>
              <X size={14} /> Cancel
            </Button>
            {!viewMode && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Save Invoice
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="mb-3 flex gap-1 border-b">
        {["Invoice Details", "Additional Data", "Storage"].map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(index as 0 | 1 | 2)}
            className={
              tab === index
                ? "border-b-2 border-primary px-3 py-1.5 text-sm font-semibold text-primary"
                : "border-b-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {warning && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {warning}
        </div>
      )}

      {/* ── TAB 1: Invoice Details ── */}
      {tab === 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-3">
            <section>
              <SectionHeader icon={Receipt} title="Invoice Information" subtitle="Principal, Invoice No & Period" />
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <LookupField
                    label="Principal Code"
                    required
                    compact
                    value={prinCode}
                    columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }]}
                    valueField="prin_code"
                    displayFields={["prin_code", "prin_name"]}
                    loadOptions={() => getPrincipalDropdown(user?.company_code ?? "", user?.loginid ?? "")}
                    onChange={(value) => setField("prin_code", value)}
                    disabled={viewMode}
                  />
                </div>
                {HEADER_FIELDS.map(({ label, key, type }) => (
                  <label key={key} className="field">
                    <span className="text-xs">{label}</span>
                    <Input
                      className="h-8 text-sm"
                      type={type === "date" ? "date" : "text"}
                      value={getValue(invoice, key) ?? ""}
                      onChange={(e) => setField(key, e.target.value)}
                      disabled={viewMode}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader icon={FileText} title="Status" subtitle="Dispatch & Invoice Status" />
              <FieldGrid fields={STATUS_FIELDS} invoice={invoice} onChange={setField} disabled={viewMode} />
            </section>

            <section>
              <SectionHeader icon={Receipt} title="Currency" subtitle="Currency Code & Exchange Rate" />
              <FieldGrid fields={CURRENCY_FIELDS} invoice={invoice} onChange={setField} disabled={viewMode} />
            </section>
          </div>

          <div className="grid gap-3">
            <section>
              <SectionHeader icon={FileText} title="References" subtitle="Account, Credit Note & Principal References" />
              <FieldGrid fields={REFERENCE_FIELDS} invoice={invoice} onChange={setField} disabled={viewMode} />
            </section>

            <section>
              <SectionHeader icon={FileText} title="Description" subtitle="Invoice Descriptions" />
              <FieldGrid fields={DESCRIPTION_FIELDS} invoice={invoice} onChange={setField} disabled={viewMode} />
            </section>
          </div>
        </div>
      )}

      {/* ── TAB 2: Additional Data (line items) ── */}
      {tab === 1 && (
        <div className="grid gap-3">
          <div className="max-h-[380px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-secondary/70">
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Sr</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost Rate</TableHead>
                  <TableHead className="text-right">Cost Amt</TableHead>
                  <TableHead className="text-right">Bill Rate</TableHead>
                  <TableHead className="text-right">Bill Amt</TableHead>
                  <TableHead>Other</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedLines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                      No data found
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedLines.map((row) => (
                    <TableRow key={row.srno}>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteLine(row.activity)} disabled={viewMode}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </TableCell>
                      <TableCell>{row.srno}</TableCell>
                      <TableCell>{row.activity}</TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                      <TableCell className="text-right">{row.cost_rate}</TableCell>
                      <TableCell className="text-right">{row.cost_amount}</TableCell>
                      <TableCell className="text-right">{row.bill_rate}</TableCell>
                      <TableCell className="text-right">{row.bill_amount}</TableCell>
                      <TableCell>{row.other_services}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex">
            <Button variant="outline" onClick={() => setJobModalOpen(true)} disabled={viewMode || !prinCode}>
              Select Job
            </Button>
          </div>
        </div>
      )}

{/* ── TAB 3: Storage ── */}
{tab === 2 && (
  <div className="grid gap-3">
    <div className="max-h-[380px] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-secondary/70">
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Principal Code</TableHead>
            <TableHead>Txn Date</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {storageLines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                No storage lines added
              </TableCell>
            </TableRow>
          ) : (
            storageLines.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => handleDeleteStorageLine(index)} disabled={viewMode}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </TableCell>
                <TableCell>{row.prin_code ?? row.PRIN_CODE ?? ""}</TableCell>
                <TableCell>
                  {(() => {
                    const d = row.txn_date ?? row.TXN_DATE;
                    if (!d) return "";
                    const date = new Date(d);
                    return Number.isNaN(date.getTime()) ? String(d) : date.toLocaleDateString("en-GB");
                  })()}
                </TableCell>
                <TableCell className="text-right">{row.qty ?? row.QTY ?? ""}</TableCell>
                <TableCell className="text-right">{row.amount ?? row.AMOUNT ?? ""}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

    <div className="flex">
      <Button variant="outline" onClick={() => setStorageModalOpen(true)} disabled={viewMode}>
        <Package size={14} /> Select Storage
      </Button>
    </div>
  </div>
)}

      {jobModalOpen && (
        <JobSelectionModal
          prinCode={prinCode}
          invoiceNo={invoiceNo}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setJobModalOpen(false)}
          onSelect={handleJobSelect}
        />
      )}

      {storageModalOpen && (
        <StorageSelectionModal
          onClose={() => setStorageModalOpen(false)}
          onSelect={handleStorageSelect}
        />
      )}
    </Dialog>
  );
}

export default InvoiceForm;