import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Edit2, Save, Send, X, CheckCircle,
  ChevronLeft, Paperclip, FileText, Trash2,
  Printer,
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
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";

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
    CAPEX_OPEX_NON_OPEX: "",
    USER_DT: null,
    USER_ID: "",
    SUPPLIER_CODE: "",
    SUPPLIER_NAME: "",
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

  const [attachOpen, setAttachOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");

  const disabled = isViewMode || saving;

  // ─── Lookup Queries ───────────────────────────────────────────────
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
  const { data: supplierList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-supplier-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "Amlspf_MsPsSupplierMaster", loginid, code1: companyCode }),
    enabled: !!companyCode,
  });
  const { data: compntCatCode = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-tax-component-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "Amlspf_MsPsTaxCode", loginid, code1: companyCode }),
    enabled: !!companyCode,
  });

  // ─── Header & Items Queries ──────────────────────────────────────
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
      ITEM_DESP: row.ITEM_DESP || itemCodes.find((i) => i.item_code === row.ITEM_CODE)?.item_desp || "",
      COST_NAME: row.COST_NAME || costCodes.find((c) => c.cost_code === row.COST_CODE)?.cost_name || "",
      BASE_AMOUNT: num(row.AMOUNT) * num(row.CURRENCY_RATE || header.CURRENCY_RATE || 1),
    }));
    // Reassign SRNO based on array position
    const renumbered = enriched.map((item, idx) => ({ ...item, ITEM_SRNO: idx + 1 }));
    setItems(renumbered);
    setLoading(false);
  }, [itemList, itemCodes, costCodes, header.CURRENCY_RATE]);

  const setHdr = (field: keyof TPRHeader, value: unknown) => setHeader((prev) => ({ ...prev, [field]: value }));

  const totalAmount = items.reduce((s, r) => s + num(r.AMOUNT), 0);
  const totalTax = items.reduce((s, r) => s + num(r.TX_COMPNT_AMT_1), 0);
  const totalBase = items.reduce((s, r) => s + num(r.BASE_AMOUNT), 0);

  // ─── Save Functions ───────────────────────────────────────────────
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
  const handlePrint = () => {
    window.print();
  };

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

  // ─── Inline Item Functions ────────────────────────────────────────
  const addItemLine = () => {
    const srNo = items.length + 1;
    const blank = blankItem(srNo, requestNumber ?? "", companyCode, header);
    (blank as any).id = newId();
    setItems([...items, blank]);
  };

  const removeItem = (id: string) => {
    const updated = items.filter((item) => (item as any).id !== id);
    // Reassign SRNO
    const renumbered = updated.map((item, idx) => ({ ...item, ITEM_SRNO: idx + 1 }));
    setItems(renumbered);
  };

  const updateItemField = (id: string, field: keyof TPRItem, value: unknown) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => (item as any).id === id);
      if (index === -1) return prev;
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Recalculate based on changes
      if (field === "ITEM_RATE" || field === "DISCOUNT_AMOUNT") {
        const rate = field === "ITEM_RATE" ? num(value) : num(item.ITEM_RATE);
        const discount = field === "DISCOUNT_AMOUNT" ? num(value) : num(item.DISCOUNT_AMOUNT);
        item.FINAL_RATE = rate - discount;
        const qty = num(item.ALLOCATED_APPROVED_QUANTITY);
        item.AMOUNT = item.FINAL_RATE * qty;
        item.BASE_AMOUNT = item.AMOUNT * num(item.CURRENCY_RATE);
        item.TX_COMPNT_AMT_1 = (item.AMOUNT * num(item.TX_COMPNT_PERC_1)) / 100;
      }
      if (field === "ALLOCATED_APPROVED_QUANTITY") {
        const qty = num(value);
        item.AMOUNT = num(item.FINAL_RATE) * qty;
        item.BASE_AMOUNT = item.AMOUNT * num(item.CURRENCY_RATE);
        item.TX_COMPNT_AMT_1 = (item.AMOUNT * num(item.TX_COMPNT_PERC_1)) / 100;
      }
      if (field === "CURRENCY_RATE") {
        item.BASE_AMOUNT = num(item.AMOUNT) * num(value);
      }
      if (field === "TX_COMPNT_PERC_1") {
        item.TX_COMPNT_AMT_1 = (num(item.AMOUNT) * num(value)) / 100;
      }
      if (field === "TX_CAT_CODE" && typeof value === 'string') {
        const found = taxCodes.find((t) => t.tx_cat_code === value);
        if (found) {
          item.TX_COMPNTCAT_CODE_1 = found.tx_compntcat_code_1 || "";
          item.TX_COMPNT_PERC_1 = found.tx_compnt_perc_1 || 0;
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  // ─── Lookup Column Definitions ───────────────────────────────────
  const currencyColumns = [
    { field: "CURR_CODE", header: "Code" },
    { field: "CURR_NAME", header: "Name" },
  ];
  const taxCategoryColumns = [
    { field: "TX_CAT_CODE", header: "Code" },
    { field: "TX_CAT_NAME", header: "Name" },
    { field: "TX_COMPNTCAT_CODE_1", header: "Tax Code" },
    { field: "TX_COMPNT_PERC_1", header: "Tax %" },
  ];
  const taxComponentColumns = [
    { field: "tx_compntcat_code", header: "Code" },
    { field: "tx_compntcat_name", header: "Name" },
  ];
  const itemCodeColumns = [
    { field: "item_code", header: "Code" },
    { field: "item_desp", header: "Description" },
  ];
  const costCodeColumns = [
    { field: "cost_code", header: "Code" },
    { field: "cost_name", header: "Name" },
  ];
  const supplierColumns = [
    { field: "supplier_code", header: "Code" },
    { field: "supplier_name", header: "Name" },
  ];
  const taxTypeColumns = [
    { field: "TX_TYPE_CODE", header: "Code" },
    { field: "TX_TYPE_NAME", header: "Name" },
    { field: "TX_TYPE_DESC", header: "Description" },
  ];
  const capexOptions = ["CAPEX", "OPEX", "NON-OPEX"];

  // ─── Render ───────────────────────────────────────────────────────
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

              {/* ─── Header Section ─── */}
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
                    <Input disabled={disabled} value={String(header.CREATE_USER || "")} onChange={(e) => setHdr("CREATE_USER", e.target.value)} placeholder="Creator" />
                  </label>
                  <label className="field">
                    <span>Creation Date</span>
                    <Input disabled={disabled} type="date" value={header.CREATE_DATE ? String(header.CREATE_DATE).slice(0, 10) : ""} onChange={(e) => setHdr("CREATE_DATE", e.target.value)} />
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
                  <LookupField
                    label="Tax Type"
                    value={String(header.TAX_TYPE || "")}
                    displayValue={header.TAX_TYPE || ""}
                    columns={taxTypeColumns}
                    valueField="TX_TYPE_CODE"
                    displayFields={["TX_TYPE_CODE", "TX_TYPE_NAME"]}
                    loadOptions={() => almsCommonSelect({ parameter: "Amlspf_MsTaxType", loginid, code1: companyCode })}
                    onChange={(val) => setHdr("TAX_TYPE", val)}
                    disabled={disabled}
                  />

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

              {/* ─── Items Section ─── */}
              <div className="rounded-md border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                  <div>
                    <p className="eyebrow m-0">Details</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Line Items</h3>
                  </div>
                  {!isViewMode && (
                    <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={addItemLine}>
                      <Plus size={14} /> Add Line
                    </Button>
                  )}
                </div>

                {/* ─── Detail Table ─── */}
                <div className="commercial-lines-scroll max-h-[43vh] overflow-auto">
                  <div className="relative">
                    <table className="finance-lines-table w-full min-w-[2000px] text-sm">
                      <thead className="sticky top-0 z-10 bg-primary text-xs text-primary-foreground">
                        <tr>
                          {/* Fixed columns - No and Item */}
                          <th className="sticky left-0 z-20 bg-primary px-2 py-2 text-center w-[45px] min-w-[45px] max-w-[45px]">
                            No
                          </th>
                          <th className="sticky left-[45px] z-20 bg-primary px-2 py-2 text-left w-[350px] min-w-[350px] max-w-[350px]">
                            Item
                          </th>

                          {/* Scrollable columns */}
                          <th className="px-2 py-2 text-left w-[280px] min-w-[280px] max-w-[280px]">
                            Cost Code
                          </th>
                          <th className="px-2 py-2 text-center w-[80px] min-w-[80px] max-w-[80px]">
                            Req Qty
                          </th>
                          <th className="px-2 py-2 text-center w-[80px] min-w-[80px] max-w-[80px]">
                            Appr Qty
                          </th>
                          <th className="px-2 py-2 text-right w-[90px] min-w-[90px] max-w-[90px]">
                            Rate
                          </th>
                          <th className="px-2 py-2 text-center w-[75px] min-w-[75px] max-w-[75px]">
                            Currency
                          </th>
                          <th className="px-2 py-2 text-right w-[80px] min-w-[80px] max-w-[80px]">
                            Ex Rate
                          </th>
                          <th className="px-2 py-2 text-left w-[250px] min-w-[250px] max-w-[250px]">
                            Supplier
                          </th>
                          <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[100px] max-w-[100px]">
                            Amount
                          </th>
                          <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[100px] max-w-[100px]">
                            Base Amt
                          </th>
                          <th className="px-2 py-2 text-center w-[100px] min-w-[100px] max-w-[100px]">
                            Tax Code
                          </th>
                          <th className="px-2 py-2 text-left w-[280px] min-w-[280px] max-w-[280px]">
                            Tax Category
                          </th>
                          <th className="px-2 py-2 text-right w-[65px] min-w-[65px] max-w-[65px]">
                            Tax %
                          </th>
                          <th className="finance-amount-cell px-2 py-2 text-right w-[90px] min-w-[90px] max-w-[90px]">
                            Tax Amt
                          </th>
                          <th className="px-2 py-2 text-center w-[90px] min-w-[90px] max-w-[90px]">
                            Tax Type
                          </th>
                          <th className="px-2 py-2 text-right w-[90px] min-w-[90px] max-w-[90px]">
                            Discount
                          </th>
                          <th className="px-2 py-2 text-right w-[90px] min-w-[90px] max-w-[90px]">
                            Final Rate
                          </th>
                          <th className="px-2 py-2 text-center w-[95px] min-w-[95px] max-w-[95px]">
                            Capex
                          </th>
                          <th className="px-2 py-2 text-center w-[55px] min-w-[55px] max-w-[55px]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={20}>No items yet. Click "Add Line" to add items.</td></tr>
                        ) : items.map((item, index) => {
                          const itemId = (item as any).id || String(item.ITEM_SRNO);
                          
                          // ─── Proper display values with Code - Description ───
                          const itemDisplay = item.ITEM_CODE && item.ITEM_DESP 
                            ? `${item.ITEM_CODE} - ${item.ITEM_DESP}` 
                            : (item.ITEM_CODE || "");
                            
                          const costDisplay = item.COST_CODE && item.COST_NAME 
                            ? `${item.COST_CODE} - ${item.COST_NAME}` 
                            : (item.COST_CODE || "");
                            
                          const supplierDisplay = item.SUPPLIER || "";
                          const taxCategoryDisplay = item.TX_CAT_CODE || "";
                          
                          return (
                            <tr className="border-t odd:bg-muted/20 hover:bg-muted/40" key={itemId}>
                              {/* Fixed columns */}
                              <td className="sticky left-0 z-10 bg-background px-2 py-1 text-xs text-center w-[45px] min-w-[45px] max-w-[45px]">
                                {item.ITEM_SRNO}
                              </td>
                              <td className="sticky left-[45px] z-10 bg-background px-2 py-1 w-[350px] min-w-[350px] max-w-[350px]">
                                <LookupField
                                  label=""
                                  compact
                                  placeholder="Search Item"
                                  value={item.ITEM_CODE || ""}
                                  displayValue={itemDisplay}
                                  columns={itemCodeColumns}
                                  valueField="item_code"
                                  displayFields={["item_code", "item_desp"]}
                                  loadOptions={() => almsCommonSelect({ parameter: "Amlspf_MsPsItemMasterPage", loginid, code1: companyCode })}
                                  onChange={(val, row) => {
                                    updateItemField(itemId, "ITEM_CODE", val);
                                    if (row) {
                                      updateItemField(itemId, "ITEM_DESP", row.ITEM_DESP || "");
                                    }
                                  }}
                                  disabled={disabled}
                                />
                              </td>

                              {/* Scrollable columns */}
                              <td className="px-2 py-1 w-[280px] min-w-[280px] max-w-[280px]">
                                <LookupField
                                  label=""
                                  compact
                                  placeholder="Cost Code"
                                  value={item.COST_CODE || ""}
                                  displayValue={costDisplay}
                                  columns={costCodeColumns}
                                  valueField="cost_code"
                                  displayFields={["cost_code", "cost_name"]}
                                  loadOptions={() => almsCommonSelect({ parameter: "Amlspf_MsPsCostMaster", loginid, code1: companyCode })}
                                  onChange={(val, row) => {
                                    updateItemField(itemId, "COST_CODE", val);
                                    if (row) {
                                      updateItemField(itemId, "COST_NAME", row.COST_NAME || "");
                                    }
                                  }}
                                  disabled={disabled}
                                />
                              </td>
                              <td className="px-2 py-1 w-[80px] min-w-[80px] max-w-[80px]">
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={item.REQUEST_QUANTITY || ""}
                                  onChange={(e) => updateItemField(itemId, "REQUEST_QUANTITY", Number(e.target.value) || 0)}
                                  disabled={disabled}
                                  className="h-9 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1 w-[80px] min-w-[80px] max-w-[80px]">
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={item.ALLOCATED_APPROVED_QUANTITY || ""}
                                  onChange={(e) => updateItemField(itemId, "ALLOCATED_APPROVED_QUANTITY", Number(e.target.value) || 0)}
                                  disabled={disabled}
                                  className="h-9 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1 w-[90px] min-w-[90px] max-w-[90px]">
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={item.ITEM_RATE || ""}
                                  onChange={(e) => updateItemField(itemId, "ITEM_RATE", Number(e.target.value) || 0)}
                                  disabled={disabled}
                                  className="h-9 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1 w-[75px] min-w-[75px] max-w-[75px]">
                                <Input
                                  value={item.CURR_CODE || header.CURR_CODE || "AED"}
                                  onChange={(e) => updateItemField(itemId, "CURR_CODE", e.target.value)}
                                  disabled={disabled}
                                  className="h-9 text-center text-sm"
                                />
                              </td>
                              <td className="px-2 py-1 w-[80px] min-w-[80px] max-w-[80px]">
                                <Input
                                  type="number"
                                  step="0.0001"
                                  value={item.CURRENCY_RATE || ""}
                                  onChange={(e) => updateItemField(itemId, "CURRENCY_RATE", Number(e.target.value) || 1)}
                                  disabled={disabled}
                                  className="h-9 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="1"
                                />
                              </td>
                              <td className="px-2 py-1 w-[250px] min-w-[250px] max-w-[250px]">
                                <LookupField
                                  label=""
                                  compact
                                  placeholder="Supplier"
                                  value={item.SUPPLIER || ""}
                                  displayValue={supplierDisplay}
                                  columns={supplierColumns}
                                  valueField="supplier_code"
                                  displayFields={["supplier_code", "supplier_name"]}
                                  loadOptions={() => almsCommonSelect({ parameter: "Amlspf_MsPsSupplierMaster", loginid, code1: companyCode })}
                                  onChange={(val, row) => {
                                    updateItemField(itemId, "SUPPLIER_CODE", val);
                                    if (row) {
                                      updateItemField(itemId, "SUPPLIER_NAME", row.SUPPLIER_NAME || "");
                                    }
                                  }}
                                  disabled={disabled}
                                />
                              </td>
                              <td className="finance-amount-cell px-2 py-1 text-right font-semibold w-[100px] min-w-[100px] max-w-[100px]">
                                {fmt3(item.AMOUNT)}
                              </td>
                              <td className="finance-amount-cell px-2 py-1 text-right w-[100px] min-w-[100px] max-w-[100px]">
                                {fmt3(item.BASE_AMOUNT)}
                              </td>
                              <td className="px-2 py-1 w-[100px] min-w-[100px] max-w-[100px]">
                                <Input
                                  value={item.TX_COMPNTCAT_CODE_1 || ""}
                                  onChange={(e) => updateItemField(itemId, "TX_COMPNTCAT_CODE_1", e.target.value)}
                                  disabled={disabled}
                                  className="h-9 text-center text-sm"
                                />
                              </td>
                              <td className="px-2 py-1 w-[280px] min-w-[280px] max-w-[280px]">
                                <LookupField
                                  label=""
                                  compact
                                  placeholder="Tax Category"
                                  value={item.TX_CAT_CODE || ""}
                                  displayValue={taxCategoryDisplay}
                                  columns={taxCategoryColumns}
                                  valueField="TX_CAT_CODE"
                                  displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
                                  loadOptions={() => almsCommonSelect({ parameter: "Amlspf_MsPsTaxCategory", loginid, code1: companyCode })}
                                  onChange={(val, row) => {
                                    updateItemField(itemId, "TX_CAT_CODE", val);
                                    if (row) {
                                      updateItemField(itemId, "TX_COMPNTCAT_CODE_1", row.TX_COMPNTCAT_CODE_1 || "");
                                      updateItemField(itemId, "TX_COMPNT_PERC_1", row.TX_COMPNT_PERC_1 || 0);
                                    }
                                  }}
                                  disabled={disabled}
                                />
                              </td>
                              <td className="px-2 py-1 w-[65px] min-w-[65px] max-w-[65px]">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.TX_COMPNT_PERC_1 || ""}
                                  onChange={(e) => updateItemField(itemId, "TX_COMPNT_PERC_1", Number(e.target.value) || 0)}
                                  disabled={disabled}
                                  className="h-9 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="finance-amount-cell px-2 py-1 text-right w-[90px] min-w-[90px] max-w-[90px]">
                                {fmt3(item.TX_COMPNT_AMT_1)}
                              </td>
                              <td className="px-2 py-1 w-[90px] min-w-[90px] max-w-[90px]">
                                <LookupField
                                  label=""
                                  compact
                                  placeholder="Tax Type"
                                  value={item.TAX_TYPE || "Std."}
                                  displayValue={item.TAX_TYPE || "Std."}
                                  columns={taxTypeColumns}
                                  valueField="TX_TYPE_CODE"
                                  displayFields={["TX_TYPE_CODE", "TX_TYPE_NAME"]}
                                  loadOptions={() => almsCommonSelect({ parameter: "Amlspf_MsTaxType", loginid, code1: companyCode })}
                                  onChange={(val) => updateItemField(itemId, "TAX_TYPE", val)}
                                  disabled={disabled}
                                />
                              </td>
                              <td className="px-2 py-1 w-[90px] min-w-[90px] max-w-[90px]">
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={item.DISCOUNT_AMOUNT || ""}
                                  onChange={(e) => updateItemField(itemId, "DISCOUNT_AMOUNT", Number(e.target.value) || 0)}
                                  disabled={disabled}
                                  className="h-9 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1 text-right w-[90px] min-w-[90px] max-w-[90px]">
                                {fmt3(item.FINAL_RATE)}
                              </td>
                              <td className="px-2 py-1 w-[95px] min-w-[95px] max-w-[95px]">
                                <Select
                                  className="h-9 text-sm"
                                  value={item.CAPEX_OPEX_NON_OPEX || ""}
                                  onChange={(e) => updateItemField(itemId, "CAPEX_OPEX_NON_OPEX" as any, e.target.value)}
                                  disabled={disabled}
                                >
                                  <option value="">—</option>
                                  {capexOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </Select>
                              </td>
                              <td className="px-2 py-1 text-center w-[55px] min-w-[55px] max-w-[55px]">
                                {!isViewMode && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    type="button"
                                    onClick={() => removeItem(itemId)}
                                    title="Remove"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                  >
                                    <X size={14} />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ─── Summary ─── */}
                <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <strong className="text-primary">{fmt3(totalAmount)}</strong>
                </div>
                <div className="flex items-center justify-end gap-8 px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <strong className="text-primary">{fmt3(totalTax)}</strong>
                </div>
                <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Base Amount</span>
                  <strong className="text-primary">{fmt3(totalBase)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
          <div className="text-sm text-muted-foreground">
            Total Amount <strong className="text-primary">{fmt3(totalAmount)}</strong>
          </div>
          {!isViewMode && (
            <div className="flex items-center gap-2">
              <Button disabled={saving} type="button" variant="outline" onClick={() => onClose()}>Close</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={handleSaveDraft}><Save size={15} /> {saving ? "Saving..." : "Save Draft"}</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={handlePrint}>
              <Printer size={15} /> Print
            </Button>
              <Button disabled={saving} type="button" variant="default" onClick={handleSubmit}><Send size={15} /> Submit</Button>
              <Button disabled={saving} type="button" variant="default" onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle size={15} /> Approve</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={() => { setRemarkText(""); setRejectOpen(true); }} className="border-destructive/30 text-destructive hover:bg-destructive/10"><X size={15} /> Reject</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={() => { setRemarkText(""); setSendBackOpen(true); }} className="border-purple-300 text-purple-700 hover:bg-purple-50"><ChevronLeft size={15} /> Send Back</Button>
              <Button disabled={saving || !requestNumber} type="button" variant="default" onClick={handleGeneratePO} className="bg-indigo-600 hover:bg-indigo-700">Generate PO</Button>
            </div>
          )}
        </div>
      </section>

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectOpen} title="Reject Request" description="Enter the reason for rejection." onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={handleRejectConfirm}>Confirm Reject</Button>
          </>
        }
      >
        <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter reject remark..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </Dialog>

      {/* ─── Send Back Dialog ─── */}
      <Dialog open={sendBackOpen} title="Send Back Request" description="Enter the reason for sending back." onClose={() => setSendBackOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={handleSendBackConfirm} variant="default">Confirm Send Back</Button>
          </>
        }
      >
        <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter send back reason..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </Dialog>
    </div>
  );
};

export default AddPRRequestPage;