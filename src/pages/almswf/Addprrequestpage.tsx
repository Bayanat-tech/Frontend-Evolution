import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Edit2, Save, Send, X, CheckCircle,
  ChevronLeft, Paperclip, FileText, Trash2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Badge } from "../../components/ui/Badge";
import { CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";

import type { TPRHeader, TPRItem } from "./PurchaseSummary-types";
import { almsSave, almsCommonSelect } from "../../api/alms";

type AddPRRequestPageProps = {
  isEditMode: boolean;
  isViewMode?: boolean;
  existingData?: { request_number?: string };
  onClose: (refresh?: boolean) => void;
};

type LookupItem = Record<string, any>;

function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function num(v: unknown) { return Number(v) || 0; }
function newId() { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }

function blankItem(srNo: number, requestNumber: string, companyCode: string, hdr: Partial<TPRHeader>): TPRItem {
  return {
    REQUEST_NUMBER: requestNumber,
    ITEM_SRNO: srNo,
    COMPANY_CODE: companyCode,
    ITEM_CODE: "",
    ITEM_DESP: "",
    COST_CODE: "",
    COST_NAME: "",
    SUPPLIER: "",
    REQUEST_QUANTITY: 0,
    ALLOCATED_APPROVED_QUANTITY: 0,
    ITEM_QTY: 0,
    ITEM_RATE: 0,
    DISCOUNT_AMOUNT: 0,
    FINAL_RATE: 0,
    AMOUNT: 0,
    LCURR_AMT: 0,
    BASE_AMOUNT: 0,
    CURR_CODE: hdr.CURR_CODE ?? "",
    CURRENCY_RATE: hdr.CURRENCY_RATE ?? 0,
    TX_CAT_CODE: hdr.TX_CAT_CODE ?? "",
    TX_COMPNTCAT_CODE_1: hdr.TX_COMPNTCAT_CODE_1 ?? "",
    TX_COMPNT_PERC_1: 0,
    TX_COMPNT_AMT_1: 0,
    TX_COMPNT_LCURAMT_1: 0,
    TAX_TYPE: "Std.",
    TX_COMPNTCAT_CODE: "",
    TX_COMPNTCAT_NAME: "",
    USER_DT: null,
    USER_ID: "",
  };
}

const AddPRRequestPage = ({ isEditMode, isViewMode = false, existingData, onClose }: AddPRRequestPageProps) => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestNumber, setRequestNumber] = useState<string | undefined>(existingData?.request_number);
  const [header, setHeader] = useState<Partial<TPRHeader>>({});
  const [items, setItems] = useState<TPRItem[]>([]);

  const [itemModal, setItemModal] = useState<{ open: boolean; mode: "add" | "edit"; data: TPRItem | null; index: number | null }>({
    open: false, mode: "add", data: null, index: null,
  });
  const [attachOpen, setAttachOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");

  const disabled = isViewMode || saving;

  const { data: itemCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-items-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "Amlspf_MsPsItemMasterPage", loginid, code1: companyCode }),
    enabled: !!companyCode,
  });
  const { data: costCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-cost-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "Amlspf_MsPsCostMaster", loginid, code1: companyCode }),
    enabled: !!companyCode,
  });
  const { data: taxCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-tax-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "Amlspf_MsPsTaxCategory", loginid, code1: companyCode }),
    enabled: !!companyCode,
  });

  const { data: hdrList = [] } = useQuery<TPRHeader[]>({
    queryKey: ["pr-header", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRHeader>({ parameter: "Amlspf_TabPRHeader", loginid, code1: companyCode, code2: requestNumber }),
    enabled: isEditMode && !!requestNumber,
  });
  useEffect(() => {
    if (hdrList.length > 0) { setHeader(hdrList[0]); setLoading(false); }
    else if (!isEditMode) setLoading(false);
  }, [hdrList, isEditMode]);

  const { data: itemList = [] } = useQuery<TPRItem[]>({
    queryKey: ["pr-item-list", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRItem>({ parameter: "Amlspf_TabPRItems", loginid, code1: companyCode, code2: requestNumber }),
    enabled: isEditMode && !!requestNumber,
  });
  useEffect(() => {
    if (itemList.length === 0 || itemCodes.length === 0) return;
    const enriched = itemList.map((row, index) => ({
      ...row,
      id: (row as any).id || newId(),
      item_srno: row.ITEM_SRNO || index + 1,
      item_desp: row.ITEM_DESP || itemCodes.find((i) => i.item_code === row.ITEM_CODE)?.item_desp || "",
      cost_name: row.COST_NAME || costCodes.find((c) => c.cost_code === row.COST_CODE)?.cost_name || "",
      base_amount: num(row.AMOUNT) * num(row.CURRENCY_RATE || header.CURRENCY_RATE || 1),
    }));
    setItems(enriched);
    setLoading(false);
  }, [itemList, itemCodes, costCodes, header.CURRENCY_RATE]);

  const setHdr = (field: keyof TPRHeader, value: unknown) => setHeader((prev) => ({ ...prev, [field]: value }));

  const totalAmount = items.reduce((s, r) => s + num(r.AMOUNT), 0);
  const totalTax = items.reduce((s, r) => s + num(r.TX_COMPNT_AMT_1), 0);
  const totalBase = items.reduce((s, r) => s + num(r.BASE_AMOUNT), 0);

  const saveHeader = async (status: string) => almsSave({
    parameter: "Amlspf_IU_PURCHASE_REQUEST_HEADER",
    loginid,
    val1s1: requestNumber || "",
    val1s2: companyCode,
    val1s3: header.FLOW_CODE || "ITPURCHASEFLOW",
    val1s5: header.DESCRIPTION || "",
    val1s6: header.REMARKS || "",
    val1s7: header.CURR_CODE || "AED",
    val1s8: status,
    val1s9: new Date().toISOString(),
    val1s10: header.TX_CAT_CODE || "",
    val1n1: header.FLOW_LEVEL_INITIAL || 1,
    val1n2: header.FLOW_LEVEL_RUNNING || 1,
    val1n3: header.FLOW_LEVEL_FINAL || 3,
    val1n4: totalAmount || 0,
    val1n5: header.CURRENCY_RATE || 1,
    val1d1: header.REQUEST_DATE ? new Date(header.REQUEST_DATE) : null,
  });

  const saveItems = async () => {
    for (const item of items) {
      await almsSave({
        parameter: "Amlspf_IU_PURCHASE_REQUEST_DETAILS",
        loginid,
        val1s1: requestNumber || "",
        val1s2: companyCode,
        val1s3: item.ITEM_CODE || "",
        val1s4: item.COST_CODE || "",
        val1s5: item.SUPPLIER || "",
        val1s6: item.CURR_CODE || "AED",
        val1s7: item.TX_CAT_CODE || "",
        val1s8: item.TX_COMPNTCAT_CODE_1 || "",
        val1n1: item.ITEM_SRNO || 0,
        val1n2: item.REQUEST_QUANTITY || 0,
        val1n3: item.ALLOCATED_APPROVED_QUANTITY || 0,
        val1n4: item.ITEM_RATE || 0,
        val1n5: item.DISCOUNT_AMOUNT || 0,
      });
    }
  };

  const runAction = async (status: string, successMsg: string) => {
    setSaving(true); setNotice(null);
    try {
      const result = await saveHeader(status);
      if (result.success) {
        await saveItems();
        setNotice({ type: "success", message: successMsg });
        onClose(true);
      }
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Action failed" });
    } finally { setSaving(false); }
  };

  const handleSaveDraft = () => runAction("DRAFT", "Draft saved successfully!");
  const handleSubmit = () => runAction("SUBMITTED", "PR submitted successfully!");

  const handleApprove = async () => {
    if (!requestNumber) return setNotice({ type: "error", message: "No PR to approve" });
    setSaving(true); setNotice(null);
    try {
      await almsSave({ parameter: "Amlspf_ApprovePR", loginid, code1: companyCode, code2: requestNumber });
      setNotice({ type: "success", message: "PR approved successfully!" });
      onClose(true);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to approve" });
    } finally { setSaving(false); }
  };

  const handleRejectConfirm = async () => {
    if (!remarkText.trim()) return setNotice({ type: "error", message: "Please enter a reject remark" });
    setSaving(true); setNotice(null);
    try {
      await almsSave({ parameter: "Amlspf_RejectPR", loginid, code1: companyCode, code2: requestNumber, code3: remarkText });
      setNotice({ type: "success", message: "PR rejected successfully!" });
      setRejectOpen(false); setRemarkText("");
      onClose(true);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to reject" });
    } finally { setSaving(false); }
  };

  const handleSendBackConfirm = async () => {
    if (!remarkText.trim()) return setNotice({ type: "error", message: "Please enter a send back reason" });
    setSaving(true); setNotice(null);
    try {
      await almsSave({ parameter: "Amlspf_SendBackPR", loginid, code1: companyCode, code2: requestNumber, code3: remarkText });
      setNotice({ type: "success", message: "PR sent back successfully!" });
      setSendBackOpen(false); setRemarkText("");
      onClose(true);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to send back" });
    } finally { setSaving(false); }
  };

  const handleGeneratePO = async () => {
    if (!requestNumber) return;
    setSaving(true); setNotice(null);
    try {
      await almsSave({ parameter: "Amlspf_GeneratePO", loginid, code1: companyCode, code2: requestNumber, code3: header.FINAL_APPROVED || "YES" });
      setNotice({ type: "success", message: "PO generated successfully!" });
      onClose(true);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to generate PO" });
    } finally { setSaving(false); }
  };

  const openAddItem = () => setItemModal({ open: true, mode: "add", data: blankItem(items.length + 1, requestNumber ?? "", companyCode, header), index: null });
  const openEditItem = (index: number) => setItemModal({ open: true, mode: "edit", data: { ...items[index] }, index });
  const closeItemModal = () => setItemModal({ open: false, mode: "add", data: null, index: null });

  const setItemField = (field: keyof TPRItem, value: unknown) => {
    setItemModal((prev) => {
      if (!prev.data) return prev;
      const next = { ...prev.data, [field]: value } as TPRItem;
      if (field === "ITEM_RATE" || field === "DISCOUNT_AMOUNT") {
        next.FINAL_RATE = num(field === "ITEM_RATE" ? value : next.ITEM_RATE) - num(field === "DISCOUNT_AMOUNT" ? value : next.DISCOUNT_AMOUNT);
        next.AMOUNT = next.FINAL_RATE * num(next.ALLOCATED_APPROVED_QUANTITY);
        next.BASE_AMOUNT = next.AMOUNT * num(next.CURRENCY_RATE);
        next.TX_COMPNT_AMT_1 = (next.AMOUNT * num(next.TX_COMPNT_PERC_1)) / 100;
      }
      if (field === "ALLOCATED_APPROVED_QUANTITY") {
        next.AMOUNT = num(next.FINAL_RATE) * num(value);
        next.BASE_AMOUNT = next.AMOUNT * num(next.CURRENCY_RATE);
        next.TX_COMPNT_AMT_1 = (next.AMOUNT * num(next.TX_COMPNT_PERC_1)) / 100;
      }
      if (field === "CURRENCY_RATE") next.BASE_AMOUNT = num(next.AMOUNT) * num(value);
      if (field === "TX_COMPNT_PERC_1") next.TX_COMPNT_AMT_1 = (num(next.AMOUNT) * num(value)) / 100;
      return { ...prev, data: next };
    });
  };

  const saveItemModal = () => {
    if (!itemModal.data) return;
    const enriched: TPRItem = {
      ...itemModal.data,
      ITEM_DESP : itemModal.data.ITEM_DESP || itemCodes.find((i) => i.item_code === itemModal.data?.ITEM_CODE)?.item_desp || "",
      COST_NAME: itemModal.data.COST_NAME || costCodes.find((c) => c.cost_code === itemModal.data?.COST_CODE)?.cost_name || "",
      BASE_AMOUNT: num(itemModal.data.AMOUNT) * num(itemModal.data.CURRENCY_RATE),
    };
    let next: TPRItem[];
    if (itemModal.mode === "add") next = [...items, enriched];
    else { next = [...items]; next[itemModal.index!] = enriched; }
    next = next.map((it, i) => ({ ...it, item_srno: i + 1 }));
    setItems(next);
    closeItemModal();
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index).map((it, i) => ({ ...it, item_srno: i + 1 })));

  const itemColumns = useMemo<ColumnDef<TPRItem>[]>(() => [
    { accessorKey: "item_srno", header: "No", size: 50, cell: ({ row }) => <span className="text-xs">{row.original.ITEM_SRNO}</span> },
    { accessorKey: "item_code", header: "Item", cell: ({ row }) => {
      const c = row.original.ITEM_CODE || "", d = row.original.ITEM_DESP || "";
      return <span className="font-medium">{c ? (d ? `${c} — ${d}` : c) : "—"}</span>;
    }},
    { accessorKey: "cost_code", header: "Cost Code", cell: ({ row }) => {
      const c = row.original.COST_CODE || "", n = row.original.COST_NAME || "";
      return <span>{c ? (n ? `${c} — ${n}` : c) : "—"}</span>;
    }},
    { accessorKey: "request_quantity", header: "Req Qty" },
    { accessorKey: "allocated_approved_quantity", header: "Appr Qty" },
    { accessorKey: "item_rate", header: "Rate", cell: ({ getValue }) => fmt3(num(getValue())) },
    { accessorKey: "amount", header: "Amount", cell: ({ getValue }) => <strong>{fmt3(num(getValue()))}</strong> },
    { accessorKey: "tx_compnt_amt_1", header: "Tax Amt", cell: ({ getValue }) => fmt3(num(getValue())) },
    { accessorKey: "base_amount", header: "Base Amount", cell: ({ row }) => fmt3(num(row.original.AMOUNT) * num(row.original.CURRENCY_RATE)) },
    ...(!isViewMode ? [{
      id: "actions" as const, header: "Action",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" type="button" onClick={() => openEditItem(row.index)} title="Edit"><Edit2 size={14} /></Button>
          <Button size="icon" variant="ghost" type="button" onClick={() => removeItem(row.index)} title="Remove"><X size={14} /></Button>
        </div>
      ),
    }] as ColumnDef<TPRItem>[] : []),
  ], [isViewMode, items]);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <section className="payment-workbench commercial-editor grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]">
        <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                  {isEditMode ? "Edit Document" : "New Document"}
                </p>
                <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">Purchase Request</h2>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Doc No</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{requestNumber || "New"}</strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Total</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{fmt3(totalAmount)}</strong>
              </div>
              {(header as any).purch_status && (
                <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Status</span>
                  <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">{(header as any).purch_status}</Badge>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {requestNumber && (
                <>
                  <Button type="button" variant="secondary" onClick={() => setAttachOpen(true)}><Paperclip size={15} /> Files</Button>
                  {isEditMode && <Button type="button" variant="secondary" onClick={() => setLogOpen(true)}><FileText size={15} /> Log</Button>}
                </>
              )}
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}><X size={16} /></Button>
            </div>
          </div>
        </CardHeader>

        <div className="min-h-0 overflow-auto p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading document...</div>
          ) : (
            <div className="grid gap-3">
              <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1.5">
                  <p className="eyebrow m-0">Header</p>
                  <h3 className="m-0 text-sm font-semibold leading-tight">Request Information</h3>
                </div>
                <div className="payment-header-grid grid grid-cols-6 gap-2.5 p-3 max-2xl:grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                  <label className="field">
                    <span>Request Date</span>
                    <Input disabled={disabled} type="date" value={header.REQUEST_DATE ? String(header.REQUEST_DATE).slice(0, 10) : ""} onChange={(e) => setHdr("REQUEST_DATE", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>POD Type *</span>
                    <Input disabled={disabled} value={String(header.PDO_TYPE || "")} onChange={(e) => setHdr("PDO_TYPE", e.target.value)} placeholder="POD type" />
                  </label>
                  <label className="field">
                    <span>Creator</span>
                    <Input disabled={disabled} value={String(header.CREATE_USER|| "")} onChange={(e) => setHdr("CREATE_USER", e.target.value)} placeholder="Creator" />
                  </label>
                  <label className="field">
                    <span>Creation Date</span>
                    <Input disabled={disabled} type="date" value={header.CREATE_DATE? String(header.CREATE_DATE).slice(0, 10) : ""} onChange={(e) => setHdr("CREATE_DATE", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Currency *</span>
                    <Input disabled={disabled} value={String(header.CURR_CODE || "")} onChange={(e) => setHdr("CURR_CODE", e.target.value)} placeholder="e.g. AED" />
                  </label>
                  <label className="field">
                    <span>Exchange Rate</span>
                    <Input disabled={disabled} type="number" step="0.0001" value={header.CURRENCY_RATE ?? ""} onChange={(e) => setHdr("CURRENCY_RATE", Number(e.target.value))} />
                  </label>
                  <label className="field">
                    <span>Tax Category</span>
                    <Input disabled={disabled} value={String(header.TX_CAT_CODE || "")} onChange={(e) => setHdr("TX_CAT_CODE", e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Tax Code</span>
                    <Input disabled={disabled} value={String(header.TX_COMPNTCAT_CODE_1 || "")} onChange={(e) => setHdr("TX_COMPNTCAT_CODE_1", e.target.value)} />
                  </label>
                  <label className="field col-span-3 max-lg:col-span-2 max-md:col-span-1">
                    <span>Description / Reason</span>
                    <Input disabled={disabled} value={String(header.DESCRIPTION || "")} onChange={(e) => setHdr("DESCRIPTION", e.target.value)} />
                  </label>
                  <label className="field col-span-3 max-lg:col-span-2 max-md:col-span-1">
                    <span>Remarks *</span>
                    <Input disabled={disabled} value={String(header.REMARKS || "")} onChange={(e) => setHdr("REMARKS", e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="commercial-lines-card rounded-md border bg-card">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                  <div>
                    <p className="eyebrow m-0">Details</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Line Items</h3>
                  </div>
                  {!isViewMode && (
                    <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={openAddItem}><Plus size={14} /> Add Line</Button>
                  )}
                </div>
                <DataTable
                  columns={itemColumns}
                  data={items}
                  title={`${items.length} Items`}
                  loading={false}
                  height={360}
                  density="grid"
                  enablePagination={false}
                  getRowId={(row) => row.ID || String(row.ITEM_SRNO)}
                />
                <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Amount</span><strong className="text-primary">{fmt3(totalAmount)}</strong>
                </div>
                <div className="flex items-center justify-end gap-8 px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Tax</span><strong className="text-primary">{fmt3(totalTax)}</strong>
                </div>
                <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Base Amount</span><strong className="text-primary">{fmt3(totalBase)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
          <div className="text-sm text-muted-foreground">Total Amount <strong className="text-primary">{fmt3(totalAmount)}</strong></div>
          {!isViewMode && (
            <div className="flex items-center gap-2">
              <Button disabled={saving} type="button" variant="outline" onClick={() => onClose()}>Close</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={handleSaveDraft}><Save size={15} /> {saving ? "Saving..." : "Save Draft"}</Button>
              <Button disabled={saving} type="button" variant="default" onClick={handleSubmit}><Send size={15} /> Submit</Button>
              <Button disabled={saving} type="button" variant="default" onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle size={15} /> Approve</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={() => { setRemarkText(""); setRejectOpen(true); }} className="border-destructive/30 text-destructive hover:bg-destructive/10"><X size={15} /> Reject</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={() => { setRemarkText(""); setSendBackOpen(true); }} className="border-purple-300 text-purple-700 hover:bg-purple-50"><ChevronLeft size={15} /> Send Back</Button>
              <Button disabled={saving || !requestNumber} type="button" variant="default" onClick={handleGeneratePO} className="bg-indigo-600 hover:bg-indigo-700">Generate PO</Button>
            </div>
          )}
        </div>
      </section>

      {itemModal.open && itemModal.data && (
        <Dialog
          open wide
          title={itemModal.mode === "add" ? "Add Item" : "Edit Item"}
          description="Fill in item details. Amount and tax are calculated automatically."
          onClose={closeItemModal}
          footer={<>
            <Button variant="outline" onClick={closeItemModal}><X size={14} /> Cancel</Button>
            <Button onClick={saveItemModal} variant="default"><Save size={14} /> {itemModal.mode === "add" ? "Add Item" : "Save Changes"}</Button>
          </>}
        >
          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
            <label className="field col-span-2 max-md:col-span-1">
              <span>Item Code</span>
              <select className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm" value={itemModal.data.ITEM_CODE || ""}
                onChange={(e) => {
                  const found = itemCodes.find((i) => i.item_code === e.target.value);
                  setItemField("ITEM_CODE", e.target.value);
                  if (found) setItemField("ITEM_DESP", found.item_desp || "");
                }}>
                <option value="">— Select —</option>
                {itemCodes.map((i) => <option key={i.item_code} value={i.item_code}>{i.item_code} — {i.item_desp}</option>)}
              </select>
            </label>
            <label className="field col-span-2 max-md:col-span-1">
              <span>Cost Code</span>
              <select className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm" value={itemModal.data.COST_CODE || ""}
                onChange={(e) => {
                  const found = costCodes.find((c) => c.cost_code === e.target.value);
                  setItemField("COST_CODE", e.target.value);
                  if (found) setItemField("COST_NAME", found.cost_name || "");
                }}>
                <option value="">— Select —</option>
                {costCodes.map((c) => <option key={c.cost_code} value={c.cost_code}>{c.cost_code} — {c.cost_name}</option>)}
              </select>
            </label>
            <label className="field"><span>Currency</span><Input value={itemModal.data.CURR_CODE || header.CURR_CODE || ""} onChange={(e) => setItemField("CURR_CODE", e.target.value)} /></label>
            {[
              { label: "Request Qty", field: "request_quantity", readOnly: false },
              { label: "Approved Qty", field: "allocated_approved_quantity", readOnly: false },
              { label: "Item Rate", field: "item_rate", readOnly: false },
              { label: "Discount", field: "discount_amount", readOnly: false },
              { label: "Exchange Rate", field: "currency_rate", readOnly: false },
              { label: "Final Rate", field: "final_rate", readOnly: true },
              { label: "Amount", field: "amount", readOnly: true },
              { label: "Base Amount", field: "base_amount", readOnly: true },
            ].map(({ label, field, readOnly }) => (
              <label key={field} className="field">
                <span>{label}</span>
                <Input type="number" step="0.001" disabled={readOnly}
                  value={field === "base_amount" ? (num(itemModal.data!.AMOUNT) * num(itemModal.data!.CURRENCY_RATE)).toFixed(3) : String((itemModal.data as any)[field] ?? "")}
                  onChange={(e) => !readOnly && setItemField(field as keyof TPRItem, Number(e.target.value))} />
              </label>
            ))}
            <label className="field col-span-2 max-md:col-span-1">
              <span>Tax Category</span>
              <select className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm" value={itemModal.data.TX_CAT_CODE || ""}
                onChange={(e) => {
                  const found = taxCodes.find((t) => t.TX_CAT_CODE === e.target.value);
                  setItemField("TX_CAT_CODE", e.target.value);
                  if (found) { setItemField("TX_COMPNTCAT_CODE_1", found.TX_COMPNTCAT_CODE_1 || ""); setItemField("TX_COMPNT_PERC_1", found.TX_COMPNT_PERC_1 || 0); }
                }}>
                <option value="">— Select —</option>
                {taxCodes.map((t) => <option key={t.TX_CAT_CODE} value={t.TX_CAT_CODE}>{t.TX_CAT_CODE} — {t.TX_CAT_NAME}</option>)}
              </select>
            </label>
            <label className="field"><span>Tax Code</span><Input value={itemModal.data.TX_COMPNTCAT_CODE_1 || ""} onChange={(e) => setItemField("TX_COMPNTCAT_CODE_1", e.target.value)} /></label>
            <label className="field"><span>Tax %</span><Input type="number" step="0.01" value={itemModal.data.TX_COMPNT_PERC_1 ?? ""} onChange={(e) => setItemField("TX_COMPNT_PERC_1", Number(e.target.value))} /></label>
            <label className="field"><span>Tax Amount</span><Input disabled value={String(itemModal.data.TX_COMPNT_AMT_1 ?? 0)} /></label>
          </div>
        </Dialog>
      )}

      <Dialog open={rejectOpen} title="Reject Request" description="Enter the reason for rejection." onClose={() => setRejectOpen(false)}
        footer={<><Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={handleRejectConfirm}>Confirm Reject</Button></>}>
        <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter reject remark..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </Dialog>

      <Dialog open={sendBackOpen} title="Send Back Request" description="Enter the reason for sending back." onClose={() => setSendBackOpen(false)}
        footer={<><Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button><Button disabled={saving} onClick={handleSendBackConfirm} variant="default">Confirm Send Back</Button></>}>
        <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter send back reason..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </Dialog>
    </div>
  );
};

export default AddPRRequestPage;