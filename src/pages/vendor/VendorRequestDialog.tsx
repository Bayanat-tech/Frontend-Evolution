import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Eye, Paperclip, Plus, RotateCcw, Save, Send, Trash2, X, XCircle, UploadCloud } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { NoticeToast } from "../../components/ui/NoticeToast";
import {
  executeVendorSql,
  getAllVendorFiles,
  getPendingVendorLpo,
  getPendingVendorLpoDetail,
  getVendorAccounts,
  saveVendorFiles,
  saveVendorRequest,
  uploadVendorAttachment,
  deleteVendorAttachment,
  type VendorRequestPayload,
  type VendorRow,
} from "../../api/vendor";
import { useAuth } from "../../state/AuthContext";
import { cn } from "../../lib/utils";

type RefDoc = VendorRow & {
  DOC_NO?: string;
  AC_CODE?: string;
  DIV_CODE?: string;
  DIV_NAME?: string;
  DOC_TYPE?: string;
  PDO_TYPE?: string;
  CURR_CODE?: string;
  EX_RATE?: number | string;
};

const emptyRequest = (companyCode = ""): VendorRequestPayload => ({
  COMPANY_CODE: companyCode,
  DOC_NO: "",
  DOC_DATE: toInputDate(new Date()),
  INVOICE_DATE: toInputDate(new Date()),
  INVOICE_NUMBER: "",
  REF_DOC_NO: "",
  REF_DOC1: "",
  REF_DOC2: "",
  REF_DOC3: "",
  REMARKS: "",
  items: [],
});

type VendorRequestSaveAction = "SAVEASDRAFT" | "SUBMITTED" | "APPROVED";
type VendorApprovalAction = "SENTBACK" | "REJECTED";

export function VendorRequestDialog({
  open,
  request,
  readOnly = false,
  approvalMode = false,
  approvalFlowLevel,
  onApprovalAction,
  onClose,
  onSaved,
}: {
  open: boolean;
  request?: VendorRequestPayload | null;
  readOnly?: boolean;
  approvalMode?: boolean;
  approvalFlowLevel?: string | number;
  onApprovalAction?: (action: VendorApprovalAction, flowLevel?: string | number) => void;
  onClose: () => void;
  onSaved?: (action: VendorRequestSaveAction) => Promise<void>;
}) {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginid = user?.loginid || user?.username || "";
  const isEdit = Boolean(request?.DOC_NO);
  const attachmentsLocked = approvalMode && Number(approvalFlowLevel) > 1;

  const [activeTab, setActiveTab] = useState<"info" | "details">("info");
  const [form, setForm] = useState<VendorRequestPayload>(() => emptyRequest(companyCode));
  const [items, setItems] = useState<VendorRow[]>([]);
  const [accounts, setAccounts] = useState<VendorRow[]>([]);
  const [refDocs, setRefDocs] = useState<RefDoc[]>([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState<{ srNo?: number; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRef, setLoadingRef] = useState(false);
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState<VendorRow | null>(null);
  const [savedDocNo, setSavedDocNo] = useState("");

  useEffect(() => {
    if (!open) return;
    const next = { ...emptyRequest(companyCode), ...(request || {}),
    AC_NAME: (request as any)?.PARTY_NAME || "",
    ADDRESS: (request as any)?.PARTY_ADDRESS || "",
    PHONE: (request as any)?.PARTY_PHONE || "",
    FAX: (request as any)?.PARTY_FAX || "",};
    setForm(next);
    setItems(normalizeItems(Array.isArray(request?.items) ? request.items : []));
    setSavedDocNo(String(next.DOC_NO || ""));
    setError("");
    setActiveTab("info");

    void Promise.all([
      getVendorAccounts(loginid, companyCode).catch(() => []),
      getPendingVendorLpo({ company_code: companyCode, ac_code: loginid }).catch(() => []),
    ]).then(([accountRows, refRows]) => {
      setAccounts(accountRows);
      setRefDocs(refRows as RefDoc[]);
      const account = accountRows[0];
      if (!request?.AC_CODE && account) {
        setForm((prev) => ({
          ...prev,
          AC_CODE: String(account.AC_CODE || ""),
          AC_NAME: String(account.AC_NAME || account.AC_DESC || ""),
          ADDRESS: String(account.ADDRESS || ""),
          PHONE: String(account.PHONE || ""),
          FAX: String(account.FAX || ""),
        }));
      }
    });
  }, [companyCode, loginid, open, request]);

  const selectedRef = useMemo(() => refDocs.find((item) => String(item.DOC_NO || "") === String(form.REF_DOC_NO || "")), [form.REF_DOC_NO, refDocs]);
  const refDocOptions = useMemo(() => {
  const currentRef = String(form.REF_DOC_NO || "");
  if (currentRef && !refDocs.some((item) => String(item.DOC_NO || "") === currentRef)) {
    return [{ DOC_NO: currentRef } as RefDoc, ...refDocs];
  }
  return refDocs;
 }, [refDocs, form.REF_DOC_NO]);
  const account = accounts[0] || {};
  const totals = useMemo(() => calculateTotals(items), [items]);

  const setField = (field: keyof VendorRequestPayload, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const loadRefDetails = async (docNo: string) => {
    const ref = refDocs.find((item) => String(item.DOC_NO || "") === docNo);
    setForm((prev) => ({
      ...prev,
      REF_DOC_NO: docNo,
      DOC_TYPE: String(ref?.DOC_TYPE || prev.DOC_TYPE || ""),
      PDO_TYPE: String(ref?.PDO_TYPE || prev.PDO_TYPE || ""),
      CURR_CODE: String(ref?.CURR_CODE || prev.CURR_CODE || ""),
      EX_RATE: ref?.EX_RATE ?? prev.EX_RATE,
      DIV_CODE: String(ref?.DIV_CODE || prev.DIV_CODE || ""),
      DIV_NAME: String(ref?.DIV_NAME || prev.DIV_NAME || ""),
    }));
    if (!docNo) {
      setItems([]);
      return;
    }
    setLoadingRef(true);
    try {
      const detailRows = await getPendingVendorLpoDetail(docNo, loginid, companyCode);
      setItems(normalizeItems(detailRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoice details for selected ref doc");
    } finally {
      setLoadingRef(false);
    }
  };

  const save = async (event: FormEvent | undefined, action: VendorRequestSaveAction) => {
    event?.preventDefault();
    setError("");
    const totalQty = items.reduce((sum, item) => sum + Number(item.QTY || 0), 0);
    if (!form.REF_DOC_NO && !isEdit) return setError("Ref Doc No is required.");
    if (!form.INVOICE_NUMBER) return setError("Invoice No is required.");
    if (!form.INVOICE_DATE) return setError("Invoice Date is required.");
    if (action !== "SAVEASDRAFT" && totalQty <= 0) return setError("Total quantity cannot be 0.");

    const filteredItems = action === "SAVEASDRAFT" ? items : items.filter((item) => Number(item.QTY || 0) > 0);
    try {
      setSaving(true);
      const payload: VendorRequestPayload = {
        ...form,
        COMPANY_CODE: companyCode,
        DOC_NO: savedDocNo || String(form.DOC_NO || ""),
        AC_CODE: String(account.AC_CODE || form.AC_CODE || ""),
        AC_NAME: String(account.AC_NAME || form.AC_NAME || ""),
        ADDRESS: String(account.ADDRESS || form.ADDRESS || ""),
        PHONE: String(account.PHONE || form.PHONE || ""),
        FAX: String(account.FAX || form.FAX || ""),
        LAST_ACTION: action,
        EDIT_USER: loginid,
        DOC_TYPE: String(selectedRef?.DOC_TYPE || form.DOC_TYPE || ""),
        PDO_TYPE: String(selectedRef?.PDO_TYPE || form.PDO_TYPE || ""),
        CURR_CODE: String(selectedRef?.CURR_CODE || form.CURR_CODE || ""),
        EX_RATE: selectedRef?.EX_RATE ?? form.EX_RATE,
        DOC_DATE: toBackendDate(form.DOC_DATE),
        INVOICE_DATE: toBackendDate(form.INVOICE_DATE),
        items: filteredItems.map((item) => ({
          ...item,
          QTY: Number(item.QTY || 0),
          DOC_DATE: toBackendDate(item.DOC_DATE || form.DOC_DATE),
          AC_CODE: String(item.AC_CODE || account.AC_CODE || form.AC_CODE || ""),
          ORIGINAL_QTY: Number(item.ORIGINAL_QTY ?? item.QTY ?? 0),
        })),
      };
      const response = await saveVendorRequest(payload);
      const generated = String(response?.data?.requestNumber || response?.requestNumber || payload.DOC_NO || "");
      if (generated) {
        setSavedDocNo(generated);
        setForm((prev) => ({ ...prev, DOC_NO: generated }));
      }
      await onSaved?.(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save purchase invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      wide
        contentClassName={cn(
    "vendor-invoice-dialog",
    activeTab === "details" && "vendor-invoice-dialog-details"
  )}
      // contentClassName="vendor-invoice-dialog"
      title={readOnly ? "View Purchase Invoices" : isEdit ? "Edit Purchase Invoices" : "Add Purchase Invoices"}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {approvalMode ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => onApprovalAction?.("SENTBACK", approvalFlowLevel)}><RotateCcw size={15} /> Send Back</Button>
              <Button type="button" variant="destructive" disabled={saving} onClick={() => onApprovalAction?.("REJECTED", approvalFlowLevel)}><XCircle size={15} /> Reject</Button>
              <Button type="button" disabled={saving} onClick={(event) => void save(event as unknown as FormEvent, "APPROVED")}><CheckCircle2 size={15} /> Approve</Button>
            </div>
          ) : !readOnly ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={(event) => void save(event as unknown as FormEvent, "SAVEASDRAFT")}><Save size={15} /> Save As Draft</Button>
              <Button type="button" disabled={saving} onClick={(event) => void save(event as unknown as FormEvent, "SUBMITTED")}><Send size={15} /> Submit</Button>
            </div>
          ) : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" disabled={!savedDocNo} onClick={() => setFilesOpen({ title: "Global Attachments" })}><Paperclip size={15} /></Button>
            
            <Button type="button" variant="outline" onClick={onClose}><X size={15} /></Button>
          </div>
        </div>
      }
    >
      <form className="grid gap-3 self-start h-fit" onSubmit={(event) => void save(event, "SAVEASDRAFT")}>
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

        <div className="flex border-b">
          <TabButton active={activeTab === "info"} onClick={() => setActiveTab("info")}>Invoice Information</TabButton>
          <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")}>Invoice Details</TabButton>
        </div>

        {activeTab === "info" ? (

          <div className="grid-cols-1 grid-gap-2 rounded-md border bg-white p-1">
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
    <FormInput label="Doc No" value={savedDocNo || String(form.DOC_NO || "")} readOnly />
    <FormInput label="Doc Date" value={toInputDate(form.DOC_DATE)} type="date" onChange={(value) => setField("DOC_DATE", value)} readOnly={readOnly} />
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-muted-foreground">Ref Doc No</span>
      <Select value={String(form.REF_DOC_NO || "")} onChange={(event) => void loadRefDetails(event.target.value)} disabled={readOnly || loadingRef || isEdit}>
        <option value="">Select Ref Doc</option>
        {/* {refDocs.map((item) => <option key={String(item.DOC_NO)} value={String(item.DOC_NO)}>{String(item.DOC_NO)}</option>)} */}
        {refDocOptions.map((item) => <option key={String(item.DOC_NO)} value={String(item.DOC_NO)}>{String(item.DOC_NO)}</option>)}
      </Select>
    </label>
    <FormInput label="Well Id" value={String(form.REF_DOC1 || "")} onChange={(value) => setField("REF_DOC1", value)} readOnly={readOnly} />

    <FormInput label="RIG No" value={String(form.REF_DOC2 || "")} onChange={(value) => setField("REF_DOC2", value)} readOnly={readOnly} />
    <FormInput label="Truck No" value={String(form.REF_DOC3 || "")} onChange={(value) => setField("REF_DOC3", value)} readOnly={readOnly} />
    <FormInput label="Invoice No" value={String(form.INVOICE_NUMBER || "")} onChange={(value) => setField("INVOICE_NUMBER", value)} required readOnly={readOnly} />
    <FormInput label="Invoice Date" value={toInputDate(form.INVOICE_DATE)} type="date" onChange={(value) => setField("INVOICE_DATE", value)} required readOnly={readOnly} />
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
    <FormInput label="Account Number" value={String(account.AC_CODE || form.AC_CODE || "")} readOnly />
    <FormInput label="Account Name" value={String(account.AC_NAME || form.AC_NAME || "")} readOnly className="sm:col-span-2 md:col-span-2" />

    <FormInput label="Phone" value={String(account.PHONE || form.PHONE || "")} readOnly />
    <FormInput label="Fax" value={String(account.FAX || form.FAX || "")} readOnly />
    <FormInput label="Division Code" value={String(form.DIV_CODE || "")} readOnly />

    <FormInput label="Division Name" value={String(form.DIV_NAME || "")} readOnly />
    <FormInput label="Address" value={String(account.ADDRESS || form.ADDRESS || "")} readOnly className="sm:col-span-2 md:col-span-2" />

    <FormInput label="Remarks" value={String(form.REMARKS || "")} onChange={(value) => setField("REMARKS", value)} className="sm:col-span-2 md:col-span-3" readOnly={readOnly} />
  </div>
 </div>
        ) : (
          <InvoiceDetailsTab
            items={items}
            loading={loadingRef}
            requestNumber={savedDocNo}
            totals={totals}
            onItemsChange={setItems}
            onAddPending={() => setPendingOpen(true)}
            onOpenAttachment={(srNo) => setFilesOpen({ srNo, title: `Attachments for Serial No: ${srNo}` })}
            readOnly={readOnly}
            attachmentsLocked={attachmentsLocked}
          />
        )}
      </form>

      {pendingOpen && !readOnly && (
        <PendingItemsDialog
          refDocNo={String(form.REF_DOC_NO || "")}
          headerAcCode={String(items[0]?.HEADER_AC_CODE || account.AC_CODE || form.AC_CODE || "")}
          existingItems={items}
          onClose={() => setPendingOpen(false)}
          onAdd={(rows) => {
            setItems((prev) => normalizeItems([...prev, ...rows]));
            setPendingOpen(false);
          }}
        />
      )}

      {filesOpen && (
        <VendorFilesDialog
          requestNumber={savedDocNo || String(form.DOC_NO || "")}
          srNo={filesOpen.srNo}
          title={filesOpen.title}
          onClose={() => setFilesOpen(null)}
          readOnly={attachmentsLocked}
        />
      )}
    </Dialog>
  );
}

function InvoiceDetailsTab({
  items,
  loading,
  requestNumber,
  totals,
  onItemsChange,
  onAddPending,
  onOpenAttachment,
  readOnly,
  attachmentsLocked,
}: {
  items: VendorRow[];
  loading: boolean;
  requestNumber: string;
  totals: ReturnType<typeof calculateTotals>;
  onItemsChange: (rows: VendorRow[]) => void;
  onAddPending: () => void;
  onOpenAttachment: (srNo: number) => void;
  readOnly?: boolean;
  attachmentsLocked?: boolean;
}) {
  const setItem = (index: number, field: string, value: string) => onItemsChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === "QTY" ? Number(value) : value } : item));
  const reset = () => onItemsChange(items.map((item) => ({ ...item, QTY: 0 })));

  return (
    <div className="vendor-detail-panel grid gap-2 rounded-md border bg-white p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-muted-foreground">
          {items.length} lines loaded
        </div>
        {!readOnly && (
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onAddPending}><Plus size={14} /> Add Pending Items</Button>
            <Button type="button" size="sm" variant="outline" onClick={reset}><RotateCcw size={14} /> Reset</Button>
          </div>
        )}
      </div>
      <div className="vendor-detail-scroll overflow-auto rounded-md border">
        <table className="vendor-detail-table w-full min-w-[1360px] text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-muted-foreground">
            <tr>
              <th className="border-b px-1.5 py-1 font-semibold w-12">Sr No</th>
              <th className="border-b px-1.5 py-1 font-semibold min-w-[240px] max-w-[340px]">Description</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[72px]">Qty</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[90px]">Org Qty</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[100px]">Rate</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[110px]">Amount</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[78px]">Currency</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[84px]">Ex Rate</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[110px]">Base Amt</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[56px]">Attach</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[90px]">Tax Code</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[74px]">Tax %</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[110px]">Tax Local Amt</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[110px]">Final Amt</th>
              <th className="border-b px-1.5 py-1 font-semibold min-w-[220px] max-w-[280px]">Item Remark</th>
              <th className="border-b px-1.5 py-1 font-semibold w-[48px]" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-2 py-8 text-center text-muted-foreground" colSpan={16}>Loading invoice details...</td></tr>
            ) : items.length ? items.map((item, index) => {
              const qty = Number(item.QTY || 0);
              const price = Number(item.PRICE ?? item.RATE ?? 0);
              const exRate = Number(item.EX_RATE || 1);
              const taxPerc = Number(item.TX_COMPNT_PERC_1 || 0);
              const amount = qty * price;
              const baseAmt = amount * exRate;
              const taxLocal = baseAmt * (taxPerc / 100);
              return (
                <tr key={`${item.SERIAL_NO || index}`} className="h-6 border-b">
                  <td className="px-1.5 py-0.5 text-muted-foreground">{String(item.SERIAL_NO || index + 1)}</td>
                  <td className="min-w-[240px] max-w-[340px] truncate px-1.5 py-0.5 text-muted-foreground" title={String(item.REMARKS || item.ITEM_DESC || "")}>{String(item.REMARKS || item.ITEM_DESC || "")}</td>
                  <td className="w-[72px] px-1.5 py-0.5"><Input className="vendor-line-input text-right w-full" type="number" value={String(item.QTY ?? 0)} readOnly={readOnly} onChange={(event) => setItem(index, "QTY", event.target.value)} /></td>
                  <td className="w-[90px] px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(item.ORIGINAL_QTY)}</td>
                  <td className="px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(price)}</td>
                  <td className="px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(amount)}</td>
                  <td className="px-1.5 py-0.5 text-muted-foreground">{String(item.CURR_CODE || "")}</td>
                  <td className="px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(exRate)}</td>
                  <td className="px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(baseAmt)}</td>
                  <td className="px-1.5 py-0.5">
                    <Button className="vendor-line-icon" type="button" size="icon" variant="ghost" disabled={!requestNumber} onClick={() => onOpenAttachment(Number(item.SERIAL_NO || index + 1))}><Paperclip size={12} /></Button>
                  </td>
                  <td className="px-1.5 py-0.5 text-muted-foreground">{String(item.TX_CAT_CODE || "")}</td>
                  <td className="px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(taxPerc)}</td>
                  <td className="px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(taxLocal)}</td>
                  <td className="px-1.5 py-0.5 text-right text-muted-foreground">{formatAmount(baseAmt + taxLocal)}</td>
                  <td className="px-1.5 py-0.5"><Input className="vendor-line-input" value={String(item.ITEM_REMARK || "")} readOnly={readOnly} onChange={(event) => setItem(index, "ITEM_REMARK", event.target.value)} /></td>
                  <td className="px-1.5 py-0.5">{!readOnly && <Button className="vendor-line-icon" type="button" size="icon" variant="ghost" onClick={() => onItemsChange(items.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={12} /></Button>}</td>
                </tr>
              );
            }) : (
              <tr><td className="px-2 py-8 text-center text-muted-foreground" colSpan={16}>Select a Ref Doc No to load invoice lines.</td></tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-50 font-semibold shadow-[0_-1px_0_rgba(148,163,184,0.35)]">
            <tr>
              <td className="px-1.5 py-1" colSpan={2}>Total</td>
              <td className="px-1.5 py-1 text-right">{formatAmount(totals.qty)}</td>
              <td />
              <td />
              <td className="px-1.5 py-1 text-right">{formatAmount(totals.amount)}</td>
              <td />
              <td />
              <td className="px-1.5 py-1 text-right">{formatAmount(totals.base)}</td>
              <td colSpan={7} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PendingItemsDialog({
  refDocNo,
  headerAcCode,
  existingItems,
  onClose,
  onAdd,
}: {
  refDocNo: string;
  headerAcCode: string;
  existingItems: VendorRow[];
  onClose: () => void;
  onAdd: (rows: VendorRow[]) => void;
}) {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!refDocNo || !headerAcCode) return;
    const safeHeader = escapeSql(headerAcCode);
    const existingSerials = existingItems.map((item) => Number(item.SERIAL_NO || 0)).filter(Boolean).join(",") || "0";
    const sql = `
      SELECT *
      FROM VW_VM_LPO_DTL_PENDING_AWARE
      WHERE DOC_NO = '${escapeSql(refDocNo)}'
        AND HEADER_AC_CODE = '${safeHeader}'
        AND SERIAL_NO NOT IN (${existingSerials})
      ORDER BY SERIAL_NO
    `;
    setLoading(true);
    void executeVendorSql(sql).then(setRows).finally(() => setLoading(false));
  }, [existingItems, headerAcCode, refDocNo]);

  return (
    <Dialog open wide contentClassName="vendor-pending-dialog" title="Pending Items" onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => onAdd(rows.filter((row) => selected[String(row.SERIAL_NO)]))}>Save</Button></>}>
      <div className="overflow-auto rounded-md border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-muted-foreground">
            <tr><th className="w-10 p-2" /><th className="p-2">Sr No</th><th className="p-2">Description</th><th className="p-2">Price</th><th className="p-2">Currency</th><th className="p-2">Ex Rate</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading...</td></tr> : rows.map((row) => (
              <tr key={String(row.SERIAL_NO)} className="border-t">
                <td className="p-2"><input type="checkbox" checked={Boolean(selected[String(row.SERIAL_NO)])} onChange={(event) => setSelected((prev) => ({ ...prev, [String(row.SERIAL_NO)]: event.target.checked }))} /></td>
                <td className="p-2">{String(row.SERIAL_NO || "")}</td>
                <td className="p-2">{String(row.REMARKS || "")}</td>
                <td className="p-2 text-right">{formatAmount(row.PRICE)}</td>
                <td className="p-2">{String(row.CURR_CODE || "")}</td>
                <td className="p-2 text-right">{formatAmount(row.EX_RATE)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

function VendorFilesDialog({ requestNumber, srNo, title, onClose, readOnly }: { requestNumber: string; srNo?: number; title: string; onClose: () => void; readOnly?: boolean }) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<VendorRow[]>([]);
  const [picked, setPicked] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<import("../../components/ui/NoticeToast").ToastNotice>(null);
  const [previewFile, setPreviewFile] = useState<VendorRow | null>(null);

  const fileCount = files.length;
  const selectedCount = picked.length;
  const totalFileLabel = `${fileCount} file${fileCount === 1 ? "" : "s"}`;
  const selectedLabel = selectedCount ? `${selectedCount} file${selectedCount === 1 ? "" : "s"} selected` : "Select files to upload";
  const attachmentScopeLabel = srNo ? `Detail row ${srNo}` : "Global document";
  const filterByScope = (rows: VendorRow[]) => srNo ? rows.filter((row) => getFileSrNo(row) === srNo) : rows.filter((row) => getFileSrNo(row) === 0);

  useEffect(() => {
    if (!requestNumber) return;
    setLoading(true);
    void getAllVendorFiles(requestNumber).then((rows) => {
      setFiles(filterByScope(rows));
      setError(null);
    }).catch(() => {
      setFiles([]);
      setError({ type: "error", message: "Unable to load attachments." });
    }).finally(() => setLoading(false));
  }, [requestNumber, srNo]);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPicked(Array.from(event.target.files || []));
    event.target.value = "";
    setError(null);
  };

  const openPreview = (file: VendorRow) => {
    if (!getFileUrl(file)) {
      setError({ type: "error", message: "No preview URL available for this attachment." });
      return;
    }
    setPreviewFile(file);
  };

  const closePreview = () => setPreviewFile(null);

  const getPreviewType = (file: VendorRow) => {
    const fileType = String(file.type || file.TYPE || "").toLowerCase();
    const fileUrl = getFileUrl(file);
    if (fileType.includes("pdf")) return "pdf";
    if (fileType.includes("image") || /\.(png|jpe?g|gif|bmp|svg)$/i.test(fileUrl)) return "image";
    return "other";
  };

  const deleteAttachment = async (file: VendorRow) => {
    const srNoValue = getFileSrNo(file);
    const attachmentSrNoValue = getFileAttachmentSrNo(file);

    if (!requestNumber) return;
    if (attachmentSrNoValue === undefined) {
      setError({ type: "error", message: "Attachment serial number is missing." });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await deleteVendorAttachment(requestNumber, srNoValue, attachmentSrNoValue);
      setFiles((current) => current.filter((item) => {
        const itemSrNo = getFileSrNo(item);
        const itemAttachmentSrNo = getFileAttachmentSrNo(item);
        return itemSrNo !== srNoValue || itemAttachmentSrNo !== attachmentSrNoValue;
      }));
      setError({ type: "success", message: "Attachment deleted successfully." });
    } catch (err) {
      setError({ type: "error", message: err instanceof Error ? err.message : "Unable to delete attachment" });
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!requestNumber || picked.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const uploadedFiles = await Promise.all(picked.map(async (file) => {
        const fileUrl = await uploadVendorAttachment(requestNumber, file);
        return {
          company_code: user?.company_code || "",
          request_number: requestNumber,
          sr_no: srNo ?? 0,
          file_name: file.name,
          org_file_name: file.name,
          user_file_name: file.name,
          aws_file_locn: fileUrl,
          extensions: file.name.split(".").pop() || "",
          modules: "Vendor",
          type: file.type,
          file_transfer: "N",
          created_by: user?.loginid || user?.username || "",
          updated_by: user?.loginid || user?.username || "",
        };
      }));
      await saveVendorFiles(requestNumber, uploadedFiles);
      setPicked([]);
      setFiles(filterByScope(await getAllVendorFiles(requestNumber)));
      setError({ type: "success", message: "Attachments saved successfully." });
    } catch (err) {
      setError({ type: "error", message: err instanceof Error ? err.message : "Unable to save attachment metadata" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open wide title={title} onClose={onClose} footer={(
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={!picked.length || saving || readOnly} onClick={() => void save()}>
            <UploadCloud size={15} /> Save Files
          </Button>
        </>
      )}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
              <Paperclip size={18} />
            </span>
            <div>
              <h3 className="m-0 text-sm font-semibold">Document Files</h3>
              <p className="m-0 text-xs text-muted-foreground">{requestNumber ? `${attachmentScopeLabel} - ${totalFileLabel}` : "No document number available yet"}</p>
            </div>
          </div>
          <input ref={inputRef} className="hidden" multiple type="file" onChange={handleFileInput} disabled={!requestNumber} />
          <Button disabled={!requestNumber || saving || readOnly} type="button" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={15} /> {requestNumber ? selectedLabel : "Upload Files"}
          </Button>
        </div>

        <NoticeToast notice={error} onClose={() => setError(null)} />

        {!requestNumber ? (
          <div className="grid min-h-[260px] place-items-center rounded-md border border-dashed bg-secondary/20 p-8 text-center">
            <div>
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary">
                <Paperclip size={20} />
              </div>
              <h3 className="m-0 text-base font-semibold">Save Required</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Attachments need a saved document or account code before upload.</p>
            </div>
          </div>
        ) : loading ? (
          <div className="grid min-h-[260px] place-items-center text-sm text-muted-foreground">Loading attachments...</div>
        ) : files.length === 0 ? (
          <div className="grid min-h-[260px] place-items-center rounded-md border border-dashed bg-secondary/20 p-8 text-center">
            <div>
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md bg-primary/10 text-primary">
                <Paperclip size={20} />
              </div>
              <h3 className="m-0 text-base font-semibold">No Attachments</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Upload supporting documents, invoices, approvals, or scanned files.</p>
            </div>
          </div>
        ) : (
          <div className="max-h-[430px] overflow-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">SR. No</th>
                  <th className="px-3 py-2 text-left">Line</th>
                  <th className="px-3 py-2 text-left">File Name</th>
                  <th className="px-3 py-2 text-left">File Type</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, index) => {
                  const srNoValue = getFileSrNo(file);
                  const attachmentSrNoValue = getFileAttachmentSrNo(file);
                  const fileName = getFileName(file);
                  const fileType = getFileType(file);
                  const fileUrl = getFileUrl(file);
                  const previewAvailable = Boolean(fileUrl);
                  return (
                    <tr className="border-t" key={index}>
                      <td className="px-3 py-2">{String(attachmentSrNoValue ?? "")}</td>
                      <td className="px-3 py-2">{srNoValue ? `Detail ${srNoValue}` : "Global"}</td>
                      <td className="px-3 py-2">{fileName}</td>
                      <td className="px-3 py-2">{fileType}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            onClick={() => openPreview(file)}
                            disabled={!previewAvailable}
                            title={previewAvailable ? "Preview file" : "Preview unavailable"}
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            disabled={!fileUrl}
                            title={fileUrl ? "Download file" : "Download unavailable"}
                            onClick={() => {
                              if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
                            }}
                          >
                            <Download size={16} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            onClick={() => void deleteAttachment(file)}
                            disabled={saving || readOnly}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>

      <Dialog
        open={Boolean(previewFile)}
        title={previewFile ? getFileName(previewFile) : "Attachment Preview"}
        description={previewFile ? getFileType(previewFile) : undefined}
        contentClassName="vendor-attachment-preview-dialog"
        onClose={closePreview}
        footer={(
          <>
            {previewFile && getFileUrl(previewFile) ? (
              <Button type="button" onClick={() => window.open(getFileUrl(previewFile), "_blank", "noopener,noreferrer")}>
                <Download size={15} /> Download
              </Button>
            ) : null}
            <Button variant="outline" onClick={closePreview}>Close</Button>
          </>
        )}
      >
        {previewFile ? (
          <div className="min-h-[520px] max-h-[78vh] overflow-hidden rounded-md border bg-background text-sm">
            {getPreviewType(previewFile) === "pdf" ? (
              <iframe
                title="attachment-preview"
                src={getFileUrl(previewFile)}
                className="h-[78vh] w-full"
              />
            ) : getPreviewType(previewFile) === "image" ? (
              <img
                src={getFileUrl(previewFile)}
                alt={getFileName(previewFile)}
                className="h-[78vh] w-full object-contain"
              />
            ) : (
              <div className="grid min-h-[260px] place-items-center p-6 text-center text-sm text-muted-foreground">
                <p>No preview available for this file type.</p>
                <a href={getFileUrl(previewFile)} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
                  Open in new tab
                </a>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function getFileField(file: VendorRow, keys: string[]) {
  for (const key of keys) {
    const value = file[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  const lowerKeys = keys.map((key) => key.toLowerCase());
  const matchedKey = Object.keys(file).find((key) => lowerKeys.includes(key.toLowerCase()));
  return matchedKey ? file[matchedKey] : undefined;
}

function getFileSrNo(file: VendorRow) {
  return Number(getFileField(file, ["srNo", "SR_NO", "sr_no"]) ?? 0);
}

function getFileAttachmentSrNo(file: VendorRow) {
  const value = getFileField(file, ["attachmentSrNo", "ATTACHMENT_SR_NO", "attachment_sr_no"]);
  return value === undefined ? undefined : Number(value);
}

function getFileUrl(file: VendorRow) {
  return String(getFileField(file, ["awsFileLocn", "AWS_FILE_LOCN", "aws_file_locn", "awsFileLocation", "AWS_FILE_LOCATION"]) || "");
}

function getFileName(file: VendorRow) {
  return String(getFileField(file, ["orgFileName", "ORG_FILE_NAME", "org_file_name", "fileName", "FILE_NAME", "file_name", "userFileName", "USER_FILE_NAME"]) || "Attachment");
}

function getFileType(file: VendorRow) {
  return String(getFileField(file, ["type", "TYPE", "extensions", "EXTENSIONS"]) || "");
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return <button type="button" className={cn("border-b-2 px-4 py-3 text-sm font-semibold", active ? "border-primary text-primary" : "border-transparent text-foreground")} onClick={onClick}>{children}</button>;
}

function FormInput({ label, value, onChange, type = "text", readOnly, required, className }: { label: string; value: string; onChange?: (value: string) => void; type?: string; readOnly?: boolean; required?: boolean; className?: string }) {
  return (
    <label className={cn("grid gap-1 text-sm", className)}>
      <span className="font-medium text-muted-foreground">{required ? `*${label}` : label}</span>
      <Input value={value} type={type} readOnly={readOnly} required={required} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  );
}

function normalizeItems(rows: VendorRow[]) {
  return rows.map((row, index) => ({
    ...row,
    SERIAL_NO: row.SERIAL_NO ?? index + 1,
    QTY: Number(row.QTY ?? 0),
    ORIGINAL_QTY: Number(row.ORIGINAL_QTY ?? row.QTY ?? 0),
    PRICE: Number(row.PRICE ?? row.RATE ?? 0),
  }));
}

function calculateTotals(rows: VendorRow[]) {
  return rows.reduce<{ qty: number; amount: number; base: number }>((sum, row) => {
    const qty = Number(row.QTY || 0);
    const price = Number(row.PRICE ?? row.RATE ?? 0);
    const exRate = Number(row.EX_RATE || 1);
    const amount = qty * price;
    return { qty: sum.qty + qty, amount: sum.amount + amount, base: sum.base + amount * exRate };
  }, { qty: 0, amount: 0, base: 0 });
}

function formatAmount(value: unknown) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function toInputDate(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function toBackendDate(value: unknown) {
  const inputDate = toInputDate(value);
  const match = inputDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function escapeSql(value: string) {
  return String(value || "").replace(/'/g, "''");
}
