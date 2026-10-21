import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Save, Send, X, CheckCircle,
  ArrowLeft, ChevronLeft, Paperclip, FileText, Printer,
  Receipt, Percent, Columns3, Search, List, ChevronUp, ChevronDown, Trash2,
  Loader2, Download, MessageSquare, Clock, FileSpreadsheet
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { CardHeader, CardContent } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import type { TPRHeader, TPRItem } from "./PurchaseSummary-types";
import { almsCommonSelect, almsSavePrequestBulk } from "../../api/alms";
import { getPrRegisterFormReportExcel, getPrRegisterFormReportHtml, openPRPurchaseReport } from "../../api/transactions";
import { useToast } from "../../components/ui/AlertToast";
import { PurchaseDocumentIdentity } from "./PurchaseDocumentIdentity";
import { openPurchaseReport } from "../purchase_sales/Reports/PurchaseReportPreviewState";
import { PurchaseReportPreview } from "../purchase_sales/Reports/Purchasereportpreview";
import ImportPrItems, { PrImportRow } from "./Importpritems";


const PO_BLUE = "#00378C";
const BTN_BLUE = "rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-60";

// Employees who get the Supplier column + Terms & Conditions tab.
// 2019070493 = ESHRAQ, 2010080035 = SHAHAB
const SUPPLIER_USER_CODES: string[] = ["2019070493", "2010080035"];

type AddPRRequestPageProps = {
  isEditMode: boolean;
  isViewMode?: boolean;
  existingData?: { request_number?: string };
  flowCode?: string;
  flowDescription?: string;
  docType?: string;
  docNo?: string;
  onClose: (refresh?: boolean) => void;
};

type LookupItem = Record<string, any>;

function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function num(v: unknown) { return Number(v) || 0; }
function newId() { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }

const INPUT_BG = "!bg-white disabled:!bg-slate-100 disabled:!text-slate-500";
const AMOUNT_CELL = "px-1 py-1 text-right font-bold text-emerald-600 bg-slate-200 text-[10px]";
const UOM_LABEL = "bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500 text-center break-words leading-tight";
const BAND = (bg: string): React.CSSProperties => ({ backgroundColor: bg, color: "#1e293b" });

function HeaderBlock({ label, icon, children, gridCols = "grid-cols-2", grow = false }: { label: string; icon: ReactNode; children: ReactNode; gridCols?: string; grow?: boolean; }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-sm border bg-card ${grow ? "flex-1" : ""}`} style={{ borderColor: `${PO_BLUE}99` }}>
      <div className="flex flex-none items-center gap-2 border-b bg-slate-100 px-2 py-1" style={{ borderColor: `${PO_BLUE}66` }}>
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] text-white" style={{ backgroundColor: PO_BLUE }}>{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">{label}</span>
      </div>
      <div className={`grid gap-x-2 gap-y-1 px-2.5 py-1.5 content-start auto-rows-min ${gridCols} max-md:grid-cols-1 ${grow ? "flex-1" : ""}`}>{children}</div>
    </div>
  );
}

function CField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode; }) {
  return (
    <label className={`field flex flex-col gap-0.5 ${className || ""}`}>
      <span className="text-[10px] font-semibold">{label}{required && <span className="ml-1 text-destructive">*</span>}</span>
      {children}
    </label>
  );
}

function isSameUom(item: TPRItem): boolean {
  const primary = String(item.P_UOM || "").trim().toUpperCase();
  const loose = String(item.L_UOM || "").trim().toUpperCase();
  return !!primary && primary === loose;
}
function computeQuantity(item: TPRItem): number {
  const qtyPuom = num(item.QTY_PUOM);
  const qtyLuom = num(item.QTY_LUOM);
  const uppp = num(item.UPPP);
  return isSameUom(item) ? qtyPuom : qtyPuom * uppp + qtyLuom;
}
function computeApprovedQuantity(item: TPRItem): number {
  const qtyPuom = num((item as any).APPROVED_QTY_PUOM);
  const qtyLuom = num((item as any).APPROVED_QTY_LUOM);
  const uppp = num((item as any).APPROVED_UPPP);
  return isSameUom(item) ? qtyPuom : qtyPuom * uppp + qtyLuom;
}
function amountBeforeDisc(item: TPRItem): number { return num(item.ITEM_RATE) * computeQuantity(item); }
function itemDiscPrice(item: TPRItem): number { return amountBeforeDisc(item) * (num(item.DISCOUNT_AMOUNT) / 100); }
function itemFinalRate(item: TPRItem): number {
  const qty = computeQuantity(item);
  if (qty === 0) return num(item.ITEM_RATE);
  return num(item.ITEM_RATE) - (itemDiscPrice(item) / qty);
}
function itemAmount(item: TPRItem): number { return itemFinalRate(item) * computeQuantity(item); }
function itemNetAmount(item: TPRItem): number { return itemAmount(item); }
function itemTaxAmount(item: TPRItem): number { return itemNetAmount(item) * (num(item.TX_COMPNT_PERC_1) / 100); }
function itemLcurrAmount(item: TPRItem, exRate: number): number { return itemAmount(item) * (exRate || 1); }
function itemTaxLcurrAmount(item: TPRItem, exRate: number): number { return itemTaxAmount(item) * (exRate || 1); }
function itemLcurrAfterDisc(item: TPRItem, exRate: number): number { return itemLcurrAmount(item, exRate) + itemTaxLcurrAmount(item, exRate); }

function recalcItem<T extends Partial<TPRItem>>(item: T, exRate: number): T {
  const rate = exRate || 1;
  const qty = computeQuantity(item as TPRItem);
  const amtBeforeDisc = amountBeforeDisc(item as TPRItem);
  const discPrice = itemDiscPrice(item as TPRItem);
  const finalRate = itemFinalRate(item as TPRItem);
  const amount = itemAmount(item as TPRItem);
  const taxAmt = itemTaxAmount(item as TPRItem);
  const lcurrAmt = itemLcurrAmount(item as TPRItem, rate);
  const taxLcurr = itemTaxLcurrAmount(item as TPRItem, rate);
  const lcurrAfterDisc = itemLcurrAfterDisc(item as TPRItem, rate);
  item.FINAL_RATE = finalRate; item.AMOUNT = amount; item.TX_COMPNT_AMT_1 = taxAmt;
  (item as any).LCURR_AMT = lcurrAmt; (item as any).TX_COMPNT_LCURAMT_1 = taxLcurr;
  (item as any).LCURR_AFTER_DISCOUNT = lcurrAfterDisc; (item as any).BASE_AMOUNT = lcurrAmt;
  (item as any).FINAL_AMOUNT = lcurrAmt + taxLcurr; (item as any).AMOUNT_BEFORE_DISC = amtBeforeDisc;
  (item as any).DISC_PRICE = discPrice; (item as any).QUANTITY = qty; (item as any).ITEM_QTY = qty;
  (item as any).ALLOCATED_APPROVED_QUANTITY = computeApprovedQuantity(item as TPRItem);
  return item;
}

function recalcItemOnApprovedQty<T extends Partial<TPRItem>>(item: T, exRate: number): T {
  const rate = exRate || 1;
  const apprQtyPuom = num((item as any).APPROVED_QTY_PUOM);
  const apprQtyLuom = num((item as any).APPROVED_QTY_LUOM);
  const apprUppp = num((item as any).APPROVED_UPPP);
  const primaryUom = String(item.P_UOM || "").trim().toUpperCase();
  const looseUom = String(item.L_UOM || "").trim().toUpperCase();
  const sameUom = !!primaryUom && primaryUom === looseUom;
  const approvedQty = sameUom ? apprQtyPuom : apprQtyPuom * apprUppp + apprQtyLuom;
  const reqQtyPuom = num(item.QTY_PUOM);
  const reqQtyLuom = num(item.QTY_LUOM);
  const reqUppp = num(item.UPPP);
  const requestedQty = sameUom ? reqQtyPuom : reqQtyPuom * reqUppp + reqQtyLuom;
  const unitPrice = num(item.ITEM_RATE);
  const amtBeforeDisc = unitPrice * approvedQty;
  const discPercent = num(item.DISCOUNT_AMOUNT);
  const discPrice = amtBeforeDisc * (discPercent / 100);
  const finalRate = approvedQty === 0 ? unitPrice : unitPrice - (discPrice / approvedQty);
  const amount = finalRate * approvedQty;
  const taxPerc = num(item.TX_COMPNT_PERC_1);
  const taxAmt = amount * (taxPerc / 100);
  const lcurrAmt = amount * rate;
  const taxLcurr = taxAmt * rate;
  const lcurrAfterDisc = lcurrAmt + taxLcurr;
  item.FINAL_RATE = finalRate; item.AMOUNT = amount; item.TX_COMPNT_AMT_1 = taxAmt;
  (item as any).LCURR_AMT = lcurrAmt; (item as any).TX_COMPNT_LCURAMT_1 = taxLcurr;
  (item as any).LCURR_AFTER_DISCOUNT = lcurrAfterDisc; (item as any).BASE_AMOUNT = lcurrAmt;
  (item as any).FINAL_AMOUNT = lcurrAmt + taxLcurr; (item as any).AMOUNT_BEFORE_DISC = amtBeforeDisc;
  (item as any).DISC_PRICE = discPrice; (item as any).QUANTITY = approvedQty; (item as any).ITEM_QTY = approvedQty;
  (item as any).ALLOCATED_APPROVED_QUANTITY = approvedQty; (item as any).REQUEST_QUANTITY = requestedQty;
  return item;
}

function calculateTotalUnitPrice(items: TPRItem[]): number {
  return items.reduce((total, item) => total + (num(item.ITEM_RATE) * computeQuantity(item)), 0);
}
function distributeDiscountToItems(items: TPRItem[], discPercent: number, userApprovalLevel: number): TPRItem[] {
  const totalUnitPrice = calculateTotalUnitPrice(items);
  if (totalUnitPrice === 0 || discPercent === 0) {
    return items.map((item) => {
      const updated = { ...item, DISCOUNT_AMOUNT: 0 };
      const exRate = num(updated.CURRENCY_RATE) || 1;
      return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(updated, exRate) : recalcItem(updated, exRate);
    });
  }
  return items.map((item) => {
    const itemQtyVal = computeQuantity(item);
    const unitPrice = num(item.ITEM_RATE);
    const itemTotal = unitPrice * itemQtyVal;
    const itemDiscPercent = (itemTotal / totalUnitPrice) * discPercent;
    const updated = { ...item, DISCOUNT_AMOUNT: itemDiscPercent };
    const exRate = num(updated.CURRENCY_RATE) || 1;
    return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(updated, exRate) : recalcItem(updated, exRate);
  });
}
function distributeDiscountFromAmount(items: TPRItem[], discAmount: number, userApprovalLevel: number): TPRItem[] {
  const totalUnitPrice = calculateTotalUnitPrice(items);
  if (totalUnitPrice === 0 || discAmount === 0) {
    return items.map((item) => {
      const updated = { ...item, DISCOUNT_AMOUNT: 0 };
      const exRate = num(updated.CURRENCY_RATE) || 1;
      return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(updated, exRate) : recalcItem(updated, exRate);
    });
  }
  return items.map((item) => {
    const itemQtyVal = computeQuantity(item);
    const unitPrice = num(item.ITEM_RATE);
    const itemTotal = unitPrice * itemQtyVal;
    const itemDiscAmount = (itemTotal / totalUnitPrice) * discAmount;
    const itemDiscPercent = (itemTotal > 0) ? (itemDiscAmount / itemTotal) * 100 : 0;
    const updated = { ...item, DISCOUNT_AMOUNT: itemDiscPercent };
    const exRate = num(updated.CURRENCY_RATE) || 1;
    return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(updated, exRate) : recalcItem(updated, exRate);
  });
}
function cleanNumericData(data: any): any {
  const numericFields = [
    'AMOUNT', 'CURRENCY_RATE', 'ITEM_RATE', 'ITEM_QTY',
    'CREDIT_AMOUNT', 'PO_AMOUNT', 'DISCOUNT_AMOUNT',
    'FINAL_RATE', 'BASE_AMOUNT', 'FINAL_AMOUNT', 'LCURR_AMT',
    'TX_COMPNT_AMT_1', 'TX_COMPNT_LCURAMT_1', 'TX_COMPNT_PERC_1',
    'REQUEST_QUANTITY', 'ALLOCATED_APPROVED_QUANTITY',
    'LCURR_AFTER_DISCOUNT', 'QTY_PUOM', 'QTY_LUOM', 'UPPP',
    'QUANTITY', 'AMOUNT_BEFORE_DISC', 'DISC_PRICE',
    'APPROVED_QTY_PUOM', 'APPROVED_QTY_LUOM', 'APPROVED_UPPP',
  ];
  if (Array.isArray(data)) return data.map((i) => cleanNumericData(i));
  if (data && typeof data === 'object') {
    const cleaned: any = {};
    for (const key in data) {
      const value = data[key];
      if (numericFields.includes(key) && typeof value === 'string') {
        cleaned[key] = parseFloat(value.replace(/,/g, '')) || 0;
      } else if (value && typeof value === 'object') {
        cleaned[key] = cleanNumericData(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
  return data;
}

function blankItem(srNo: number, requestNumber: string, companyCode: string, hdr: Partial<TPRHeader>): TPRItem {
  return {
    REQUEST_NUMBER: requestNumber, ITEM_SRNO: srNo, COMPANY_CODE: companyCode,
    ITEM_CODE: "", ITEM_DESP: "", COST_CODE: "", COST_NAME: "",
    SUPPLIER: "", REQUEST_QUANTITY: 0, ALLOCATED_APPROVED_QUANTITY: 0, ITEM_QTY: 0,
    ITEM_RATE: 0, DISCOUNT_AMOUNT: 0, FINAL_RATE: 0, AMOUNT: 0,
    LCURR_AMT: 0, BASE_AMOUNT: 0, FINAL_AMOUNT: 0, LCURR_AFTER_DISCOUNT: 0,
    CURR_CODE: hdr.CURR_CODE ?? "", CURR_NAME: hdr.CURR_NAME ?? "",
    CURRENCY_RATE: hdr.CURRENCY_RATE ?? 0,
    TX_CAT_CODE: hdr.TX_CAT_CODE ?? "", TX_CAT_NAME: hdr.TX_CAT_NAME ?? "",
    TX_COMPNTCAT_CODE_1: hdr.TX_COMPNTCAT_CODE_1 ?? "",
    TX_COMPNT_PERC_1: 0, TX_COMPNT_AMT_1: 0, TX_COMPNT_LCURAMT_1: 0,
    TAX_TYPE: "Std.", TX_COMPNTCAT_CODE: "", TX_COMPNTCAT_NAME: "",
    CAPEX_OPEX_NON_OPEX: "",
    USER_DT: null, USER_ID: "",
    SUPPLIER_CODE: "", SUPPLIER_NAME: "", CASH_IND: "",
    P_UOM: "", QTY_PUOM: 0, L_UOM: "", QTY_LUOM: 0, UPPP: 0,
    QUANTITY: 0, AMOUNT_BEFORE_DISC: 0, DISC_PRICE: 0,
    APPROVED_QTY_PUOM: 0, APPROVED_QTY_LUOM: 0, APPROVED_UPPP: 0,
  } as TPRItem;
}

function validatePRForm(header: Partial<TPRHeader>, items: TPRItem[], terms: any[], userLevel: number, isSupplierUser: boolean) {
  const errors: string[] = [];
  if (!String(header.DESCRIPTION ?? "").trim()) errors.push("Description / Reason is required");
  if (!String(header.REMARKS ?? "").trim()) errors.push("Remarks is required");
  if (!header.PDO_TYPE) errors.push("POD Type is required");
  if (!header.CURR_CODE) errors.push("Currency is required");
  if (items.length === 0) {
    errors.push("At least one item is required");
  } else {
    items.forEach((item, index) => {
      if (!item.ITEM_CODE) errors.push(`Item ${index + 1}: Product Code is required`);
      if (!item.ITEM_DESP) errors.push(`Item ${index + 1}: Product Description is required`);
      if (isSupplierUser && !item.SUPPLIER) errors.push(`Item ${index + 1}: Supplier is required`);
      if (userLevel === 1 && computeQuantity(item) <= 0) errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      if (num(item.ITEM_RATE) <= 0) errors.push(`Item ${index + 1}: Rate must be greater than 0`);
      if (!item.CAPEX_OPEX_NON_OPEX) errors.push(`Item ${index + 1}: CAPEX is required`);
    });
  }

  if (isSupplierUser && terms.length > 0) {
    terms.forEach((term, index) => {
      if (!String(term.DLVR_TERM ?? "").trim()) errors.push(`Term ${index + 1}: Delivery Term is required`);
      if (!String(term.PAYMENT_TERMS ?? "").trim()) errors.push(`Term ${index + 1}: Payment Terms is required`);
      if (!String(term.WARRANTY ?? "").trim()) errors.push(`Term ${index + 1}: Warranty is required`);
      if (!String(term.REMARKS ?? "").trim()) errors.push(`Term ${index + 1}: Remarks is required`);
    });
  }

  return { valid: errors.length === 0, errors };
}

const AddPRRequestPage = ({
  isEditMode, isViewMode = false, existingData, flowCode, flowDescription, docType = "PR", docNo, onClose,
}: AddPRRequestPageProps) => {
  const { user } = useAuth();
  const companyCode = String(user?.company_code ?? "").trim();
  const loginid = String(user?.loginid ?? "").trim();
  const isSupplierUser = SUPPLIER_USER_CODES.includes(loginid);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestNumber, setRequestNumber] = useState<string | undefined>(existingData?.request_number);

  const [header, setHeader] = useState<Partial<TPRHeader>>({
    CURR_CODE: "OMR", CURR_NAME: "OMANI RIAL", CURRENCY_RATE: 1,
    TX_CAT_CODE: "01", TX_CAT_NAME: "LOCAL PURCHASE - SRV",
    TX_COMPNTCAT_CODE_1: "10100", TX_COMPNTCAT_NAME: "LOCAL PURCHASE - SRV",
    TAX_TYPE: "No VAT", PDO_TYPE: "N",
  });

  const [items, setItems] = useState<TPRItem[]>([]);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [selectedSendBackTo, setSelectedSendBackTo] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "terms">("items");
  const [terms, setTerms] = useState<any[]>([]);
  const [termsLoadTick, setTermsLoadTick] = useState(0);
  const serverTermsRef = useRef<Map<string, any>>(new Map());
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [lineSearch, setLineSearch] = useState("");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(true);

  // In edit/view mode user level is 0 until resolved. Add mode is always 1.
  // userLevelLoading is used ONLY to gate the Add Line / Import Excel buttons
  // so a 2nd-level approver never sees them flash before level resolves.
  const [userApprovalLevel, setUserApprovalLevel] = useState<number>(isEditMode || isViewMode ? 0 : 1);
  const [userLevelLoading, setUserLevelLoading] = useState<boolean>(isEditMode || isViewMode);
  const [lastApprovalLevel, setLastApprovalLevel] = useState<number>(7);
  const [displayDate, setDisplayDate] = useState("");
  const isInitialized = useRef(false);
  const itemsLoadedRef = useRef(false);
  const lastLoadedRequestRef = useRef<string | undefined>(undefined);
  const headerLoadedRef = useRef<string | null>(null);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [localComments, setLocalComments] = useState<any[]>([]);
  const commentsListRef = useRef<HTMLDivElement>(null);

  const { data: historyList = [], refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ["pr-history", requestNumber, companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_HISTORY",
      loginid, code1: companyCode, code2: requestNumber || "", code3: "", code4: ""
    }),
    enabled: !!requestNumber && commentsOpen,
    staleTime: 0
  });

  const displayHistory = useMemo(() => {
    const serverTexts = new Set(
      historyList
        .filter((h) => ["COMMENTED", "COMMENT"].includes(String(h.LAST_ACTION || "").toUpperCase()))
        .map((h) => String(h.COMMENTS || h.REMARKS_HISTORY || h.REMARKS || "").trim().toUpperCase())
    );
    const extra = localComments.filter((c) => !serverTexts.has(String(c.COMMENTS || "").trim().toUpperCase()));
    return [...historyList, ...extra];
  }, [historyList, localComments]);

  useEffect(() => {
    if (!commentsOpen) return;
    const t = setTimeout(() => {
      const el = commentsListRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
    return () => clearTimeout(t);
  }, [commentsOpen, displayHistory.length]);

  useEffect(() => {
    if (lastLoadedRequestRef.current !== requestNumber) {
      itemsLoadedRef.current = false;
      lastLoadedRequestRef.current = requestNumber;
    }
  }, [requestNumber]);

  const isFinalApproved = String((header as any).FINAL_APPROVED || "").toUpperCase() === "Y";
  const isCancelled =
    String((header as any).CANCEL_FLAG || "").toUpperCase() === "Y" ||
    String(header.LAST_ACTION || "").toUpperCase() === "CANCELED" ||
    String(header.LAST_ACTION || "").toUpperCase() === "CANCELLED";
  const isSentBack = String(header.LAST_ACTION || "").toUpperCase() === "SENDBACK";

  const isLastLevel = userApprovalLevel >= 2 && userApprovalLevel === lastApprovalLevel;

  const effectiveViewMode = isFinalApproved || isCancelled || (isViewMode && !isEditMode);
  const disabled = saving || effectiveViewMode;

  useEffect(() => {
    if (isEditMode || isViewMode) return;
    if (!flowCode) return;
    setHdr("FLOW_CODE", flowCode);
    if (flowDescription) setHdr("FLOW_DESCRIPTION", flowDescription);
  }, [flowCode, flowDescription, isEditMode, isViewMode]);

  useEffect(() => {
    if (isInitialized.current) return;
    if (!isEditMode && !isViewMode) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      setDisplayDate(`${day}/${month}/${year}`);
      setHdr("REQUEST_DATE", today.toISOString().slice(0, 10));
      isInitialized.current = true;
    }
  }, [isEditMode, isViewMode]);

  useEffect(() => {
    if (header.REQUEST_DATE) {
      const date = new Date(header.REQUEST_DATE);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        setDisplayDate(`${day}/${month}/${year}`);
      }
    }
  }, [header.REQUEST_DATE]);

  // Resolve user level. While `userLevelLoading` is true, buttons/inputs are
  // gated so 2nd-level approvers never see Add Line / Import Excel flash.
  useEffect(() => {
    if (!isEditMode && !isViewMode) {
      setUserApprovalLevel(1);
      setUserLevelLoading(false);
      return;
    }

    if (!header.FLOW_CODE) {
      if (!loading) {
        setUserApprovalLevel(Number(header.FLOW_LEVEL_RUNNING) || 0);
        setUserLevelLoading(false);
      }
      return;
    }

    let cancelled = false;
    const fetchUserLevel = async () => {
      try {
        const result = await almsCommonSelect({
          parameter: "PS_PREQUEST_ENTRY_GET_USER_LEVEL",
          loginid, code1: companyCode, code2: header.FLOW_CODE || "",
          code3: user?.loginid || "", code4: "",
        });
        if (cancelled) return;
        if (result && result.length > 0) {
          setUserApprovalLevel(Number(result[0].FLOW_LEVEL) || 0);
          const ll = Number(result[0].LAST_LEVEL) || 0;
          if (ll > 0) setLastApprovalLevel(ll);
        } else {
          setUserApprovalLevel(Number(header.FLOW_LEVEL_RUNNING) || 0);
        }
      } catch {
        if (cancelled) return;
        setUserApprovalLevel(Number(header.FLOW_LEVEL_RUNNING) || 0);
      } finally {
        if (!cancelled) setUserLevelLoading(false);
      }
    };
    fetchUserLevel();
    return () => { cancelled = true; };
  }, [user, companyCode, header.FLOW_CODE, header.FLOW_LEVEL_RUNNING, loading, isEditMode, isViewMode]);

  const shouldShowSupplier = () => isSupplierUser;
  const shouldShowTermsTab = () => isSupplierUser;

  const { data: productCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-product-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_PRODUCT_LIST", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" }),
    enabled: !!companyCode,
  });
  const { data: costCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-cost-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_COSTS", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" }),
    enabled: !!companyCode,
  });
  const { data: taxCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-tax-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" }),
    enabled: !!companyCode,
  });
  const { data: taxComponentList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-tax-component-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX_COMPONENT", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" }),
    enabled: !!companyCode,
  });
  const { data: supplierList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-supplier-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_SUPPLIERS", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" }),
    enabled: !!companyCode && shouldShowSupplier(),
  });
  const { data: currencyList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-currency-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_CURRENCY", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" }),
    enabled: !!companyCode,
  });
  const { data: divisionList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-division-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_DIVISION", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" }),
    enabled: !!companyCode,
  });

  // placeholderData keeps previous cached data visible instantly while fresh
  // data loads in background — no blank screen on repeat visits.
  const { data: hdrList = [], isFetching: hdrFetching } = useQuery<TPRHeader[]>({
    queryKey: ["pr-header", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRHeader>({ parameter: "PS_PREQUEST_ENTRY_HEADER_PAGE", loginid, code1: companyCode, code2: "PR", code3: requestNumber || "", code4: "" }),
    enabled: (isEditMode || isViewMode) && !!requestNumber,
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });
  const { data: itemList = [], isFetching: itemsFetching } = useQuery<TPRItem[]>({
    queryKey: ["pr-item-list", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRItem>({ parameter: "PS_PREQUEST_ENTRY_DETAIL_PAGE", loginid, code1: companyCode, code2: "PR", code3: requestNumber || "", code4: "" }),
    enabled: (isEditMode || isViewMode) && !!requestNumber,
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });
  const { data: termsList = [] } = useQuery<any[]>({
    queryKey: ["pr-terms", requestNumber, companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TERMS", loginid, code1: companyCode, code2: requestNumber || "", code3: "", code4: "" }),
    enabled: (isEditMode || isViewMode) && !!requestNumber && shouldShowTermsTab(),
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });
  const { data: flowDetailData } = useQuery<LookupItem[]>({
    queryKey: ["pr-flow-details", flowCode, companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_GET_FLOW_DETAILS", loginid, code1: companyCode, code2: flowCode || "", code3: "", code4: "" }),
    enabled: !!flowCode && !!companyCode && !isEditMode && !isViewMode,
  });

  useEffect(() => {
    if (isEditMode || isViewMode) return;
    if (!flowDetailData || flowDetailData.length === 0) return;
    const flow = flowDetailData[0];
    const divCode = flow.DIV_CODE || "";
    if (divCode) {
      setHdr("DIV_CODE", divCode);
      const div = divisionList.find((d: any) => d.DIV_CODE === divCode);
      if (div) setHdr("DIV_NAME", div.DIV_NAME || "");
    }
  }, [flowDetailData, divisionList, isEditMode, isViewMode]);

  useEffect(() => {
    if (!isEditMode && !isViewMode) {
      if (flowCode) {
        setHdr("FLOW_CODE", flowCode);
        if (flowDescription) setHdr("FLOW_DESCRIPTION", flowDescription);
      }
      setLoading(false);
      return;
    }
    if (hdrFetching) return;
    if (headerLoadedRef.current === (requestNumber || "")) return;
    if (hdrList.length > 0) {
      headerLoadedRef.current = requestNumber || "";
      const h = hdrList[0];
      const isSentBackHeader = String(h.LAST_ACTION || "").toUpperCase() === "SENDBACK";

      setHeader((prev) => ({
        ...prev, ...h,
        REMARKS: isSentBackHeader ? "" : (h.REMARKS || ""),
        DIV_CODE: (h as any).DIV_CODE || prev.DIV_CODE || "",
        DIV_NAME: (h as any).DIV_NAME || prev.DIV_NAME || "",
        DEPT_CODE_FLOW: (h as any).DEPT_CODE_FLOW || "",
        DEPT_NAME: (h as any).DEPT_NAME || "",
        FLOW_CODE: (h as any).FLOW_CODE || flowCode || prev.FLOW_CODE || "",
        FLOW_DESCRIPTION: (h as any).FLOW_DESCRIPTION || flowDescription || prev.FLOW_DESCRIPTION || "",
        CURR_NAME: (h as any).CURR_NAME || prev.CURR_NAME || "",
        TX_CAT_NAME: (h as any).TX_CAT_NAME || prev.TX_CAT_NAME || "",
        TX_COMPNTCAT_NAME: (h as any).TX_COMPNTCAT_NAME || prev.TX_COMPNTCAT_NAME || "",
      }));
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [hdrList, hdrFetching, isEditMode, isViewMode, requestNumber, flowCode, flowDescription]);

  useEffect(() => {
    if (!isEditMode && !isViewMode) return;
    if (!header.CURR_CODE && !header.TX_CAT_CODE && !header.TX_COMPNTCAT_CODE_1) return;
    setHeader((prev) => {
      const updates: Partial<TPRHeader> & { TX_COMPNTCAT_NAME?: string } = {};
      if (prev.CURR_CODE && !prev.CURR_NAME && currencyList.length > 0) {
        const c = currencyList.find((x: any) => x.CURR_CODE === prev.CURR_CODE);
        if (c) updates.CURR_NAME = c.CURR_NAME || "";
      }
      if (prev.TX_CAT_CODE && !prev.TX_CAT_NAME && taxCodes.length > 0) {
        const t = taxCodes.find((x: any) => x.TX_CAT_CODE === prev.TX_CAT_CODE);
        if (t) updates.TX_CAT_NAME = t.TX_CAT_NAME || "";
      }
      if (prev.TX_COMPNTCAT_CODE_1 && !(prev as any).TX_COMPNTCAT_NAME && taxComponentList.length > 0) {
        const c = taxComponentList.find((x: any) => x.TX_COMPNTCAT_CODE === prev.TX_COMPNTCAT_CODE_1);
        if (c) updates.TX_COMPNTCAT_NAME = c.TX_COMPNTCAT_NAME || "";
      }
      return Object.keys(updates).length === 0 ? prev : { ...prev, ...updates };
    });
  }, [header.CURR_CODE, header.TX_CAT_CODE, header.TX_COMPNTCAT_CODE_1, currencyList, taxCodes, taxComponentList, isEditMode, isViewMode]);

  useEffect(() => {
    if (itemsLoadedRef.current) return;
    if (itemsFetching) return;
    if (itemList.length === 0) {
      if (isViewMode && requestNumber) { setItems([]); itemsLoadedRef.current = true; }
      return;
    }
    const enriched = itemList.map((row) => {
      const rawSup = String((row as any).SUPPLIER || "").trim();
      const supCode = rawSup.includes(" - ") ? rawSup.split(" - ")[0].trim() : rawSup;

      const base: TPRItem = {
        ...row,
        id: (row as any).id || newId(),
        ITEM_DESP: row.ITEM_DESP || productCodes.find((i) => i.PROD_CODE === row.ITEM_CODE)?.PROD_NAME || "",
        COST_NAME: row.COST_NAME || costCodes.find((c) => c.COST_CODE === row.COST_CODE)?.COST_NAME || "",
        SUPPLIER: supCode,
        SUPPLIER_NAME: (row as any).SUPPLIER_NAME || supplierList.find((s) => s.SUPPLIER_CODE === supCode)?.SUPPLIER_NAME || "",
        TX_CAT_NAME: (row as any).TX_CAT_NAME || taxCodes.find((t) => t.TX_CAT_CODE === row.TX_CAT_CODE)?.TX_CAT_NAME || "",
        TX_COMPNTCAT_NAME: (row as any).TX_COMPNTCAT_NAME || taxComponentList.find((t) => t.TX_COMPNTCAT_CODE === row.TX_COMPNTCAT_CODE_1)?.TX_COMPNTCAT_NAME || "",
        CURR_NAME: (row as any).CURR_NAME || currencyList.find((c) => c.CURR_CODE === row.CURR_CODE)?.CURR_NAME || "",
        CAPEX_OPEX_NON_OPEX: (row as any).CAPEX || (row as any).CAPEX_OPEX_NON_OPEX || "",
        LCURR_AFTER_DISCOUNT: 0,
        CASH_IND: (row as any).CASH_IND || "",
        P_UOM: (row as any).P_UOM || "",
        QTY_PUOM: (row as any).QTY_PUOM || 0,
        L_UOM: (row as any).L_UOM || "",
        QTY_LUOM: (row as any).QTY_LUOM || 0,
        UPPP: (row as any).UPPP || 0,
        QUANTITY: 0, AMOUNT_BEFORE_DISC: 0, DISC_PRICE: 0,
        APPROVED_QTY_PUOM: (row as any).APPROVED_QTY_PUOM || 0,
        APPROVED_QTY_LUOM: (row as any).APPROVED_QTY_LUOM || 0,
        APPROVED_UPPP: (row as any).APPROVED_UPPP || 0,
      } as TPRItem;
      const appQtyPuom = num((base as any).APPROVED_QTY_PUOM);
      const reqQtyPuom = num(base.QTY_PUOM);
      if (appQtyPuom === 0 && reqQtyPuom > 0) (base as any).APPROVED_QTY_PUOM = reqQtyPuom;
      const appQtyLuom = num((base as any).APPROVED_QTY_LUOM);
      const reqQtyLuom = num(base.QTY_LUOM);
      if (appQtyLuom === 0 && reqQtyLuom > 0) (base as any).APPROVED_QTY_LUOM = reqQtyLuom;
      const appUppp = num((base as any).APPROVED_UPPP);
      const reqUppp = num(base.UPPP);
      if (appUppp === 0 && reqUppp > 0) (base as any).APPROVED_UPPP = reqUppp;

      const exRate = num(base.CURRENCY_RATE || header.CURRENCY_RATE || 1);
      return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(base, exRate) : recalcItem(base, exRate);
    });
    const renumbered = enriched.map((item, idx) => ({ ...item, ITEM_SRNO: idx + 1 }));
    setItems(renumbered);
    itemsLoadedRef.current = true;
  }, [itemList, itemsFetching, productCodes, costCodes, supplierList, taxCodes, taxComponentList, currencyList, isViewMode, requestNumber, userApprovalLevel, header.CURRENCY_RATE]);

  useEffect(() => {
    if (userApprovalLevel < 2) return;
    setItems((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        const exRate = num(item.CURRENCY_RATE) || 1;
        const rec = recalcItemOnApprovedQty({ ...item }, exRate);
        if (num(rec.AMOUNT) !== num(item.AMOUNT)) changed = true;
        return rec;
      });
      return changed ? next : prev;
    });
  }, [userApprovalLevel]);

  useEffect(() => {
    if (termsList.length > 0) {
      const pick = (row: any, k: string) => row?.[k] ?? row?.[k.toLowerCase()] ?? "";
      const seen = new Set<string>();
      const enriched: any[] = [];
      termsList.forEach((row: any) => {
        const rawSup = String(pick(row, "SUPPLIER")).trim();
        const sup = rawSup.includes(" - ") ? rawSup.split(" - ")[0].trim() : rawSup;
        if (sup && seen.has(sup)) return;
        if (sup) seen.add(sup);
        enriched.push({
          ...row,
          id: row.id || newId(),
          SUPPLIER: sup,
          SUPPLIER_NAME: pick(row, "SUPPLIER_NAME") || supplierList.find((x: any) => x.SUPPLIER_CODE === sup)?.SUPPLIER_NAME || "",
          DLVR_TERM: pick(row, "DLVR_TERM"),
          PAYMENT_TERMS: pick(row, "PAYMENT_TERMS"),
          WARRANTY: pick(row, "WARRANTY"),
          REMARKS: pick(row, "REMARKS"),
        });
      });
      enriched.forEach((t) => { if (t.SUPPLIER) serverTermsRef.current.set(t.SUPPLIER, t); });
      setTerms(enriched);
      setTermsLoadTick((t) => t + 1);
    } else if (isViewMode && requestNumber) {
      setTerms([]);
    }
  }, [termsList, isViewMode, requestNumber, supplierList]);

  useEffect(() => {
    if (!isSupplierUser) return;
    if ((isEditMode || isViewMode) && !!requestNumber && !itemsLoadedRef.current) return;

    const used: string[] = [];
    const nameMap = new Map<string, string>();
    items.forEach((it) => {
      const rawSup = String(it.SUPPLIER || "").trim();
      if (!rawSup) return;
      const s = rawSup.includes(" - ") ? rawSup.split(" - ")[0].trim() : rawSup;

      if (!nameMap.has(s)) {
        const nm = (it as any).SUPPLIER_NAME || supplierList.find((x: any) => x.SUPPLIER_CODE === s)?.SUPPLIER_NAME || "";
        nameMap.set(s, nm);
        used.push(s);
      } else if (!nameMap.get(s)) {
        const nm = (it as any).SUPPLIER_NAME || supplierList.find((x: any) => x.SUPPLIER_CODE === s)?.SUPPLIER_NAME || "";
        if (nm) nameMap.set(s, nm);
      }
    });

    setTerms((prev) => {
      const keptBySupplier = new Map<string, any>();
      const orphans: any[] = [];

      prev.forEach((t) => {
        const rawSup = String(t.SUPPLIER || "").trim();
        const sup = rawSup.includes(" - ") ? rawSup.split(" - ")[0].trim() : rawSup;
        if (sup && used.indexOf(sup) !== -1 && !keptBySupplier.has(sup)) keptBySupplier.set(sup, t);
        else orphans.push(t);
      });

      const next: any[] = used.map((sup) => {
        const name = nameMap.get(sup) || "";
        const existing = keptBySupplier.get(sup);
        if (existing) {
          return { ...existing, SUPPLIER: sup, SUPPLIER_NAME: name || existing.SUPPLIER_NAME };
        }
        const orphan = orphans.shift();
        if (orphan) return { ...orphan, SUPPLIER: sup, SUPPLIER_NAME: name };
        const fromServer = serverTermsRef.current.get(sup);
        if (fromServer) return { ...fromServer, SUPPLIER: sup, SUPPLIER_NAME: name || fromServer.SUPPLIER_NAME };
        return {
          id: newId(),
          COMPANY_CODE: companyCode,
          SUPPLIER: sup,
          SUPPLIER_NAME: name,
          DLVR_TERM: "",
          PAYMENT_TERMS: "",
          WARRANTY: "",
          REMARKS: "",
          USER_ID: "",
          USER_DT: null,
        };
      });

      if (next.length === prev.length) {
        let changed = false;
        for (let i = 0; i < next.length; i++) {
          if (next[i] !== prev[i]) { changed = true; break; }
        }
        if (!changed) return prev;
      }
      return next;
    });
  }, [items, isSupplierUser, supplierList, companyCode, termsLoadTick, isEditMode, isViewMode, requestNumber]);

  const setHdr = (field: keyof TPRHeader, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  const isApprovedLevel = userApprovalLevel >= 2;
  const totalAmount = items.reduce((s, r) => s + num(r.AMOUNT), 0);
  const totalTax = items.reduce((s, r) => s + num(r.TX_COMPNT_AMT_1), 0);
  const totalFinalAmount = items.reduce((s, r) => s + num(r.FINAL_AMOUNT), 0);

  const totalAmountBeforeDisc = items.reduce((sum, item) => {
    const qty = isApprovedLevel ? computeApprovedQuantity(item) : computeQuantity(item);
    return sum + (num(item.ITEM_RATE) * qty);
  }, 0);

  const [discountScope, setDiscountScope] = useState<"ITEM" | "PO">("ITEM");
  const [discAmtText, setDiscAmtText] = useState("0.000");
  const [discPctText, setDiscPctText] = useState("0.000");

  const totalDiscAmount = items.reduce((sum, item) => {
    const storedPrice = num((item as any).DISC_PRICE);
    if (storedPrice > 0) return sum + storedPrice;
    const qty = isApprovedLevel ? computeApprovedQuantity(item) : computeQuantity(item);
    return sum + (num(item.ITEM_RATE) * num(item.DISCOUNT_AMOUNT) / 100 * qty);
  }, 0);

  useEffect(() => {
    if (discountScope === "ITEM") {
      setDiscAmtText(totalDiscAmount.toFixed(3));
      const t = calculateTotalUnitPrice(items);
      setDiscPctText(t > 0 ? ((totalDiscAmount / t) * 100).toFixed(3) : "0.000");
    } else {
      setDiscAmtText(num(header.DISC_AMOUNT).toFixed(3));
      setDiscPctText(num(header.DISCOUNT_AMOUNT).toFixed(3));
    }
  }, [discountScope]);

  useEffect(() => {
    if (discountScope !== "ITEM") return;
    setDiscAmtText(totalDiscAmount.toFixed(3));
    const t = calculateTotalUnitPrice(items);
    setDiscPctText(t > 0 ? ((totalDiscAmount / t) * 100).toFixed(3) : "0.000");
  }, [discountScope, totalDiscAmount, items.length]);

  const filteredItems = useMemo(() => {
    const q = lineSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      String(r.ITEM_CODE || "").toLowerCase().includes(q) ||
      String(r.ITEM_DESP || "").toLowerCase().includes(q) ||
      String((r as any).SUPPLIER_NAME || "").toLowerCase().includes(q) ||
      String(r.SUPPLIER || "").toLowerCase().includes(q)
    );
  }, [items, lineSearch]);

  const colWidths = useMemo(() => {
    const qtyGroup = [60, 50, 60, 65];
    const w: number[] = [30, 240, 55, ...qtyGroup, ...qtyGroup];
    if (isSupplierUser) w.push(380);
    w.push(80, 105, 65, 70, 108, 60, 70, 108);
    if (showAllColumns) {
      w.push(200, 100, 260, 270, 160, 210);
    }
    w.push(90);
    w.push(70);
    return w;
  }, [showAllColumns, isSupplierUser]);

  const tableMinWidth = colWidths.reduce((a, b) => a + b, 0);
  const itemsColSpan = colWidths.length;
  const qtyColSpan = 4;

  const validateAndShowErrors = (): boolean => {
    const { valid, errors } = validatePRForm(header, items, terms, userApprovalLevel, isSupplierUser);
    if (!valid) {
      setNotice({ type: "error", message: errors.join(". ") });
      return false;
    }
    return true;
  };

  const saveBulk = async (status: string, remark = "", overrides: Partial<Record<string, any>> = {}) => {
    const headerData: any = {
      REQUEST_NUMBER: requestNumber || null, COMPANY_CODE: companyCode,
      REQUEST_DATE: header.REQUEST_DATE ? new Date(header.REQUEST_DATE).toISOString() : new Date().toISOString(),
      SUPPLIER: "", DESCRIPTION: header.DESCRIPTION || "", REMARKS: header.REMARKS || "",
      AMOUNT: totalAmount || 0, DEPARTMENT_CODE: "",
      FLOW_CODE: header.FLOW_CODE || "", FLOW_DESCRIPTION: header.FLOW_DESCRIPTION || "",
      FLOW_LEVEL_INITIAL: header.FLOW_LEVEL_INITIAL || 1,
      FLOW_LEVEL_RUNNING: overrides.FLOW_LEVEL_RUNNING ?? (header.FLOW_LEVEL_RUNNING || 1),
      FLOW_LEVEL_FINAL: header.FLOW_LEVEL_FINAL || 3,
      CURRENCY_RATE: header.CURRENCY_RATE || 1, USER_DT: new Date().toISOString(), USER_ID: loginid,
      FA_UPLOADED: "", FINAL_APPROVED: header.isFinalApproval ? "Y" : "N",
      TX_CAT_CODE: header.TX_CAT_CODE || "", TX_COMPNTCAT_CODE_1: header.TX_COMPNTCAT_CODE_1 || "",
      TX_COMPNTCAT_CODE_2: "", TX_COMPNTCAT_CODE_3: "", TX_COMPNTCAT_CODE_4: "",
      TX_COMPNT_1_EXPMT: "", REMARKS_HISTORY: overrides.REMARKS_HISTORY || "", CURR_CODE: header.CURR_CODE || "",
      CREATE_USER: isEditMode ? (header.CREATE_USER || loginid) : loginid,
      CREATE_DATE: isEditMode ? ((header as any).CREATE_DATE || new Date().toISOString()) : new Date().toISOString(),
      LAST_UPDATED: loginid, LAST_ACTION: status, HISTORY_SERIAL: 0,
      ATTACH_FILE_NAME: "", ATTACH_FILE_NAME1: "", ATTACH_FILE_NAME2: "",
      REJECT_HISTRY: "", SENDBACK_HISTORY: "", REQ_DOC_NO: 0, REQ_DIV_CODE: "",
      COST_CODE: "", PO_AMOUNT: 0, DOC_DATE: new Date().toISOString(),
      CANCEL_FLAG: "", CANCEL_DATE: null, CANCEL_USER: "", MOBILE_APP_UPDATE: "",
      FA_USER: "", HOD_USER: "", MAIL_CC: "", WARRANTY: "", PO_CREATOR: "", REQUEST_HOD_USER: "",
      CANCEL_REMARK: "",
      PDO_TYPE: header.PDO_TYPE || "N", TYPE_OF_CONTRACT: "",
      AC_CODE: "", AC_NAME: "", COUNTRY_CODE: "", TERRITORY_CODE: "",
      ADDRESS_1: "", ADDRESS_2: "", ADDRESS_3: "", PHONE: "", FAX: "", E_MAIL: "",
      CONTACT_PERSON: "", MOBILE_NO: "", AC_TYPE: "", AC_ACTIVE: "",
      CREDIT_PERIOD: 0, CREDIT_AMOUNT: 0,
      BANK_AC_CODE: "", BANK_NAME: "", BANK_SWIFT: "", IBAN_NO: "", BANK_AC_NAME: "",
      TAX_REGISTRD: "", TAX_COUNTRY_CODE: "", TRN_NO: "", CR_NO: "", RCM_APPLY: "",
      SECTOR_CODE: "", CITY_NAME: "", EXP_TYPE_CODE: "", PL_BL_CODE: "", DEPT_CODE: "",
      AC_STATUS: "", AC_INFZE: "", BI_MAIN_GROUP: "", BI_SUB_GROUP: "", BI_EXP_TYPE: "",
      BI_PL_BS_IND: "", BI_DEPT: "", CREATED_BY: "", UPDATED_BY: "",
      NEXT_ACTION_BY: overrides.NEXT_ACTION_BY ?? header.NEXT_ACTION_BY ?? "",
      SENTBACK_REASON: status === "SENDBACK" ? remark : "",
      REJECT_REASON: status === "REJECTED" ? remark : "",
      DOC_NO: (header as any).DOC_NO ?? null,
      DIV_CODE: header.DIV_CODE || "", DIV_NAME: header.DIV_NAME || "",
      DEPT_CODE_FLOW: header.DEPT_CODE_FLOW || "", DEPT_NAME: header.DEPT_NAME || "",
      DISC_AMOUNT: header.DISC_AMOUNT || 0,
      DISCOUNT_AMOUNT: discountScope === "PO" ? num(header.DISCOUNT_AMOUNT) || 0 : 0,
      DISCOUNT_SCOPE: discountScope,
      ...overrides,
    };

    const detailsData = items.map((item) => ({
      REQUEST_NUMBER: requestNumber || null,
      ITEM_CODE: item.ITEM_CODE || "", ITEM_RATE: item.ITEM_RATE || 0,
      ITEM_QTY: computeQuantity(item), CURRENCY_RATE: item.CURRENCY_RATE || 1,
      AMOUNT: item.AMOUNT || 0, COMPANY_CODE: companyCode,
      USER_DT: new Date().toISOString(),
      USER_ID: isEditMode ? ((header as any).USER_ID || loginid) : loginid,
      TX_CAT_CODE: item.TX_CAT_CODE || "", TX_COMPNTCAT_CODE_1: item.TX_COMPNTCAT_CODE_1 || "",
      TX_COMPNT_PERC_1: item.TX_COMPNT_PERC_1 || 0, TX_COMPNT_AMT_1: item.TX_COMPNT_AMT_1 || 0,
      TX_COMPNT_LCURAMT_1: item.TX_COMPNT_LCURAMT_1 || 0, TX_COMPNT_1_EXPMT: "",
      CURR_CODE: item.CURR_CODE || "", LCURR_AMT: item.LCURR_AMT || 0,
      LCURR_AFTER_DISCOUNT: (item as any).LCURR_AFTER_DISCOUNT || 0,
      ALLOCATED_APPROVED_QUANTITY: item.ALLOCATED_APPROVED_QUANTITY || 0,
      SELECTED_ITEM: "", LAST_ACTION: status, HISTORY_SERIAL: 0,
      ITEM_SRNO: item.ITEM_SRNO || 0, SUPPLIER_PART_CODE: "", RATE_METHODE: "",
      CASH_IND: item.CASH_IND || "", MAIL_ATTATCH: "", ITEM_CANEL: "",
      SUPPLIER: item.SUPPLIER || "", REF_DOC_NO: 0,
      DISCOUNT_AMOUNT: item.DISCOUNT_AMOUNT || 0, FINAL_RATE: item.FINAL_RATE || 0,
      COST_CODE: item.COST_CODE || "", CAPEX: item.CAPEX_OPEX_NON_OPEX,
      BUYER: "", REASON_FOR_PO_MODIFY: "", DOC_TYPE: "PR", DOC_NO: null,
      DOC_DATE: new Date().toISOString(), DIV_CODE: "", SERIAL_NO: 0,
      PROD_CODE: item.ITEM_CODE || "", PROD_NAME: item.ITEM_DESP || "",
      P_UOM: item.P_UOM || "", QTY_PUOM: item.QTY_PUOM || 0,
      L_UOM: item.L_UOM || "", QTY_LUOM: item.QTY_LUOM || 0,
      UPPP: item.UPPP || 0, QUANTITY: computeQuantity(item),
      REQUIRED_DT: null, SIGN_IND: "-1", QTY_PROCESSED: 0,
      CANCELLED: "", CANCELLED_DT: null, JOB_NO: "", REF_DOC_TYPE: "",
      EDIT_USER: "", EDIT_DATE: null, ZONE_CODE: "", STOCK_QTY_WHENPRQ: 0,
      REQUEST_QUANTITY: computeQuantity(item),
      AMOUNT_BEFORE_DISC: (item as any).AMOUNT_BEFORE_DISC || 0,
      DISC_PRICE: (item as any).DISC_PRICE || 0,
      APPROVED_QTY_PUOM: (item as any).APPROVED_QTY_PUOM || 0,
      APPROVED_QTY_LUOM: (item as any).APPROVED_QTY_LUOM || 0,
      APPROVED_UPPP: (item as any).APPROVED_UPPP || 0,
    }));

    const termsData = terms.map((t) => ({
      SUPPLIER: t.SUPPLIER || "", REMARKS: t.REMARKS || "",
      DLVR_TERM: t.DLVR_TERM || "", PAYMENT_TERMS: t.PAYMENT_TERMS || "",
      COMPANY_CODE: companyCode, USER_DT: new Date().toISOString(), USER_ID: loginid,
      WARRANTY: t.WARRANTY || "", DOC_NO: null,
    }));

    const result = await almsSavePrequestBulk({
      header: cleanNumericData(headerData),
      details: cleanNumericData(detailsData),
      terms: cleanNumericData(termsData),
    });
    return result;
  };

  const [savingAction, setSavingAction] = useState<string | null>(null);

  const refreshPrCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["pr-header"] });
    queryClient.invalidateQueries({ queryKey: ["pr-item-list"] });
    queryClient.invalidateQueries({ queryKey: ["pr-terms"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-request-page"] });
  };

  const runAction = async (status: string, successMsg: string, remark = "", overrides: Partial<Record<string, any>> = {}) => {
    if (saving) return false;
    if (status !== "SAVEASDRAFT" && status !== "CANCELED" && status !== "COMMENTED" && status !== "SENDBACK") {
      if (!validateAndShowErrors()) return false;
    }
    setSavingAction(status);
    setNotice(null);
    try {
      const result = await saveBulk(status, remark, overrides);
      if (!result.success) throw new Error(result.message || "Failed to save");
      refreshPrCaches();
      toast.success(successMsg, 4000);
      setSavingAction(null);
      if (status !== "COMMENTED") onClose(true);
      return true;
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Action failed" });
      setSavingAction(null);
      return false;
    }
  };

  const handleSaveDraft = () => {
    if (!header.DESCRIPTION && items.length === 0) {
      toast.warning("Please add at least a description or an item before saving draft", 4000);
      return;
    }
    runAction("SAVEASDRAFT", "Draft saved successfully!");
  };

  const handleSubmit = () => runAction("SUBMITTED", "PR submitted successfully!");

  const handleCancel = () => {
    if (!requestNumber) { onClose(); return; }
    if (!window.confirm("Are you sure you want to cancel this Purchase Request? This action cannot be undone.")) return;
    runAction("CANCELED", "PR cancelled successfully!", "", {
      CANCEL_FLAG: "Y",
      CANCEL_DATE: new Date().toISOString(),
      CANCEL_USER: loginid,
      NEXT_ACTION_BY: "",
    });
  };

  const handlePrint = async () => {
    if (!requestNumber) { toast.warning("Please save the request before printing.", 4000); return; }

    const params = { loginid, company_code: companyCode, request_number: requestNumber };
    const preview = openPurchaseReport(`Purchase Request - ${requestNumber}`);

    try {
      const html = await getPrRegisterFormReportHtml(params);
      preview.ready({
        html,
        filename: `purchase_request_${requestNumber}`,
        orientation: "landscape",
        onExcel: async () => {
          await getPrRegisterFormReportExcel(params);
        },
      });
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load report. Please try again.";
      preview.fail(new Error(msg));
      toast.error(msg, 5000);
    }
  };

  const handleApprove = async () => {
    if (!requestNumber) { toast.error("No PR to approve", 5000); return; }
    if (!validateAndShowErrors()) return;
    setSaving(true); setSavingAction("APPROVED"); setNotice(null);
    try {
      const cur = Number(header.FLOW_LEVEL_RUNNING) || 1;
      const fin = Number(header.FLOW_LEVEL_FINAL) || 1;
      const next = cur + 1;
      const isFinal = next >= fin ? "Y" : "N";
      const result = await saveBulk("APPROVED", "", { FLOW_LEVEL_RUNNING: next, FINAL_APPROVED: isFinal });
      if (!result.success) throw new Error(result.message || "Failed to approve");
      refreshPrCaches();
      toast.success("PR approved successfully!", 4000);
      window.scrollTo({ top: 0, behavior: "smooth" });
      onClose(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve", 5000);
    } finally { setSaving(false); setSavingAction(null); }
  };

  const { data: sendBackTargets = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-sendback-targets", requestNumber, companyCode, header.FLOW_LEVEL_RUNNING],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_SENDBACK_TARGETS", loginid, code1: companyCode, code2: requestNumber || "", code3: String(header.FLOW_LEVEL_RUNNING || 0), code4: "" }),
    enabled: sendBackOpen && !!requestNumber,
  });

  const sendBackOptions = useMemo(() => {
    const opts: { loginid: string; label: string; level: number }[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    const addOpt = (id: string, label: string, level: number) => {
      const trimmedId = String(id || "").trim();
      if (!trimmedId) return;
      const upperId = trimmedId.toUpperCase();
      const upperLabel = String(label || "").trim().toUpperCase();

      if (seenIds.has(upperId) || upperId === String(loginid).trim().toUpperCase()) return;
      if (upperLabel && seenNames.has(upperLabel)) return;

      seenIds.add(upperId);
      if (upperLabel) seenNames.add(upperLabel);
      opts.push({ loginid: trimmedId, label: label || trimmedId, level });
    };

    const creatorId = (header as any).CREATE_USER;
    const creatorName = (header as any).CREATE_USER_NAME || "";
    if (creatorId) {
      addOpt(String(creatorId), creatorName, 0);
    }

    sendBackTargets.forEach((row: any) => {
      const lg = String(row.loginid ?? row.LOGINID ?? "").trim();
      const emp = String(row.emp_name ?? row.EMP_NAME ?? "").trim();
      const lvl = Number(row.flow_level_running ?? row.FLOW_LEVEL_RUNNING ?? 0) || 0;
      addOpt(lg, emp, lvl);
    });

    return opts;
  }, [header.CREATE_USER, (header as any).CREATE_USER_NAME, sendBackTargets, loginid]);

  const handleSendBackConfirm = async () => {
    if (!selectedSendBackTo) { toast.warning("Please select who to send this back to", 4000); return; }
    if (!remarkText.trim()) { toast.warning("Please enter a send back reason", 4000); return; }
    const target = sendBackOptions.find((o) => o.loginid === selectedSendBackTo);
    const success = await runAction("SENDBACK", "PR sent back successfully!", remarkText, {
      FLOW_LEVEL_RUNNING: target?.level ?? 0, NEXT_ACTION_BY: selectedSendBackTo,
    });
    if (success) {
      setSendBackOpen(false);
      setRemarkText("");
      setSelectedSendBackTo("");
    }
  };

  const handleRejectConfirm = async () => {
    if (!remarkText.trim()) { toast.warning("Please enter a rejection reason", 4000); return; }
    if (!validateAndShowErrors()) return;
    setRejectOpen(false);
    const reason = remarkText;
    await runAction("REJECTED", "PR rejected successfully!", reason, { NEXT_ACTION_BY: loginid });
    setRemarkText("");
  };

  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    const localId = newId();
    const knownName = historyList.find((h) => String(h.ACTION_BY || "").trim() === loginid)?.ACTION_BY_NAME;
    setLocalComments((prev) => [...prev, {
      _lid: localId,
      LAST_ACTION: "COMMENTED",
      COMMENTS: text,
      ACTION_BY: loginid,
      ACTION_BY_NAME: String(knownName || (user as any)?.emp_name || (user as any)?.name || loginid),
      ACTION_DATE: new Date().toISOString(),
    }]);
    setNewComment("");
    const ok = await runAction("COMMENTED", "Comment added successfully!", text, {
      REMARKS: text,
      REMARKS_HISTORY: text,
      NEXT_ACTION_BY: header.NEXT_ACTION_BY || "",
    });
    if (ok) {
      await refetchHistory();
      setLocalComments([]);
    } else {
      setLocalComments((prev) => prev.filter((c) => c._lid !== localId));
      setNewComment(text);
    }
  };

  const updateAllItemsWithHeader = (overrides: Partial<TPRHeader> = {}) => {
    const h = { ...header, ...overrides };
    setItems((prev) => prev.map((item) => {
      const merged: TPRItem = {
        ...item,
        CURR_CODE: h.CURR_CODE || item.CURR_CODE || "",
        CURR_NAME: h.CURR_NAME || item.CURR_NAME || "",
        CURRENCY_RATE: h.CURRENCY_RATE || item.CURRENCY_RATE || 1,
        TX_CAT_CODE: h.TX_CAT_CODE || item.TX_CAT_CODE || "",
        TX_CAT_NAME: h.TX_CAT_NAME || item.TX_CAT_NAME || "",
        TX_COMPNTCAT_CODE_1: h.TX_COMPNTCAT_CODE_1 || item.TX_COMPNTCAT_CODE_1 || "",
        TX_COMPNT_PERC_1: (h as any).TX_COMPNT_PERC_1 || item.TX_COMPNT_PERC_1 || 0,
        TX_COMPNTCAT_NAME: (h as any).TX_COMPNTCAT_NAME || (item as any).TX_COMPNTCAT_NAME || "",
      };
      const exRate = num(merged.CURRENCY_RATE) || 1;
      return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(merged, exRate) : recalcItem(merged, exRate);
    }));
  };

  const addItemLine = () => {
    if (effectiveViewMode) return;
    const blank = blankItem(items.length + 1, requestNumber ?? "", companyCode, header);
    blank.CURR_CODE = header.CURR_CODE || "";
    blank.CURR_NAME = header.CURR_NAME || "";
    blank.CURRENCY_RATE = header.CURRENCY_RATE || 1;
    blank.TX_CAT_CODE = header.TX_CAT_CODE || "";
    blank.TX_CAT_NAME = header.TX_CAT_NAME || "";
    blank.TX_COMPNTCAT_CODE_1 = header.TX_COMPNTCAT_CODE_1 || "";
    blank.TX_COMPNT_PERC_1 = (header as any).TX_COMPNT_PERC_1 || 0;
    blank.CASH_IND = "N";
    blank.CAPEX_OPEX_NON_OPEX = "";
    (blank as any).id = newId();
    setItems([...items, blank]);
  };

  const handleImportItems = (rows: PrImportRow[]) => {
    if (effectiveViewMode || rows.length === 0) return;
    const exRate = num(header.CURRENCY_RATE) || 1;

    setItems((prev) => {
      const start = prev.length;
      const added = rows.map((r, i) => {
        const prod = productCodes.find(
          (p) => String(p.PROD_CODE).trim().toUpperCase() === r.prodCode.trim().toUpperCase()
        );
        const sup = r.supplierCode
          ? supplierList.find(
              (s) => String(s.SUPPLIER_CODE).trim().toUpperCase() === r.supplierCode.trim().toUpperCase()
            )
          : undefined;

        const blank = blankItem(start + i + 1, requestNumber ?? "", companyCode, header);
        blank.CURR_CODE = header.CURR_CODE || "";
        blank.CURR_NAME = header.CURR_NAME || "";
        blank.CURRENCY_RATE = header.CURRENCY_RATE || 1;
        blank.TX_CAT_CODE = header.TX_CAT_CODE || "";
        blank.TX_CAT_NAME = header.TX_CAT_NAME || "";
        blank.TX_COMPNTCAT_CODE_1 = header.TX_COMPNTCAT_CODE_1 || "";
        blank.TX_COMPNT_PERC_1 = (header as any).TX_COMPNT_PERC_1 || 0;
        blank.CASH_IND = "N";
        (blank as any).id = newId();

        blank.ITEM_CODE = String(prod?.PROD_CODE ?? r.prodCode);
        blank.ITEM_DESP = String(prod?.PROD_NAME ?? "");
        blank.P_UOM = String(prod?.P_UOM ?? "");
        blank.L_UOM = String(prod?.L_UOM ?? "");
        blank.UPPP = Number(prod?.UPPP) || 0;
        blank.ITEM_RATE = r.rate;
        blank.QTY_PUOM = r.qtyPuom;
        blank.QTY_LUOM = r.qtyLuom;
        blank.CAPEX_OPEX_NON_OPEX = r.capex;
        if (sup) {
          blank.SUPPLIER = String(sup.SUPPLIER_CODE);
          (blank as any).SUPPLIER_NAME = String(sup.SUPPLIER_NAME ?? "");
        }
        blank.REQUEST_QUANTITY = computeQuantity(blank);
        return recalcItem(blank, exRate);
      });
      return [...prev, ...added];
    });

    setActiveTab("items");
    toast.success(`${rows.length} item line${rows.length === 1 ? "" : "s"} imported from Excel`, 4000);
  };

  const removeItem = (id: string) => {
    if (effectiveViewMode) return;
    const updated = items.filter((i) => (i as any).id !== id);
    setItems(updated.map((i, idx) => ({ ...i, ITEM_SRNO: idx + 1 })));
  };

  const updateItemField = (id: string, field: keyof TPRItem, value: unknown) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => (i as any).id === id);
      if (index === -1) return prev;

      let normalizedValue = value;
      if (field === "SUPPLIER" && typeof value === "string") {
        normalizedValue = value.split(" - ")[0].trim();
      }

      if (field === "APPROVED_QTY_PUOM" || field === "APPROVED_QTY_LUOM") {
        const existing = prev[index];
        const draft = { ...existing, [field]: value } as TPRItem;
        const reqQty = computeQuantity(existing);
        const apprQty = computeApprovedQuantity(draft);
        if (reqQty > 0 && apprQty > reqQty) {
          toast.warning(`Approved quantity cannot exceed requested quantity (${fmt3(reqQty)})`, 4000);
          return prev;
        }
      }

      const updated = [...prev];
      const item = { ...updated[index], [field]: normalizedValue };

      if (field === "ITEM_CODE" && typeof value === "string") {
        const trimmed = value.trim().toUpperCase();
        if (trimmed) {
          const dup = prev.some((it) => (it as any).id !== id && String(it.ITEM_CODE || "").trim().toUpperCase() === trimmed);
          if (dup) { toast.warning("This product is already added in another line.", 4000); return prev; }
        }
        const found = productCodes.find((p) => String(p.PROD_CODE) === value);
        if (found) {
          item.ITEM_CODE = value;
          item.ITEM_DESP = found.PROD_NAME || "";
          item.P_UOM = found.P_UOM || "";
          item.L_UOM = found.L_UOM || "";
          item.UPPP = Number(found.UPPP) || 0;
          item.ITEM_RATE = Number(found.BASE_PRICE) || 0;
        }
      }

      if (field === "DISC_PRICE" as any) {
        const qtyForCalc = userApprovalLevel >= 2 ? computeApprovedQuantity(item) : computeQuantity(item);
        const gross = num(item.ITEM_RATE) * qtyForCalc;
        const newPrice = Number(value) || 0;
        (item as any).DISC_PRICE = newPrice;
        item.DISCOUNT_AMOUNT = gross > 0 ? (newPrice / gross) * 100 : 0;
        const exRate = num(item.CURRENCY_RATE) || 1;
        if (userApprovalLevel >= 2) recalcItemOnApprovedQty(item, exRate);
        else recalcItem(item, exRate);
        (item as any).DISC_PRICE = newPrice;
        updated[index] = item;
        return updated;
      }

      const approvedFields = ["APPROVED_QTY_PUOM", "APPROVED_QTY_LUOM", "APPROVED_UPPP"];
      if (["ITEM_RATE", "DISCOUNT_AMOUNT", "QTY_PUOM", "QTY_LUOM", "UPPP", "TX_COMPNT_PERC_1", "CURRENCY_RATE", ...approvedFields].includes(field as string)) {
        const exRate = num(item.CURRENCY_RATE) || 1;
        if (userApprovalLevel >= 2) recalcItemOnApprovedQty(item, exRate);
        else recalcItem(item, exRate);
        if (["QTY_PUOM", "QTY_LUOM", "UPPP", "ITEM_CODE"].includes(field as string)) {
          item.REQUEST_QUANTITY = computeQuantity(item);
        }
      }

      if (field === "TX_CAT_CODE" && typeof value === "string") {
        const found = taxCodes.find((t) => t.TX_CAT_CODE === value);
        if (found) {
          item.TX_CAT_CODE = value;
          item.TX_CAT_NAME = found.TX_CAT_NAME || "";
          item.TX_COMPNTCAT_CODE_1 = found.TX_COMPNTCAT_CODE_1 || "";
          item.TX_COMPNT_PERC_1 = found.TX_COMPNT_PERC_1 || 0;
          const exRate = num(item.CURRENCY_RATE) || 1;
          if (userApprovalLevel >= 2) recalcItemOnApprovedQty(item, exRate);
          else recalcItem(item, exRate);
        }
      }

      if (field === "TX_COMPNTCAT_CODE_1" && typeof value === "string") {
        const found = taxComponentList.find((t) => t.TX_COMPNTCAT_CODE === value);
        if (found) {
          item.TX_COMPNTCAT_CODE_1 = value;
          item.TX_COMPNTCAT_NAME = found.TX_COMPNTCAT_NAME || "";
          if (found.TX_PERCNT !== undefined) item.TX_COMPNT_PERC_1 = Number(found.TX_PERCNT) || 0;
          const exRate = num(item.CURRENCY_RATE) || 1;
          if (userApprovalLevel >= 2) recalcItemOnApprovedQty(item, exRate);
          else recalcItem(item, exRate);
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  const updateTermField = (id: string, field: string, value: unknown) =>
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));

  const currencyColumns = [{ field: "CURR_CODE", header: "Code" }, { field: "CURR_NAME", header: "Name" }];
  const taxCategoryColumns = [{ field: "TX_CAT_CODE", header: "Code" }, { field: "TX_CAT_NAME", header: "Name" }];
  const taxComponentColumns = [{ field: "TX_COMPNTCAT_CODE", header: "Code" }, { field: "TX_COMPNTCAT_NAME", header: "Name" }];
  const productColumns = [
    { field: "PROD_CODE", header: "Code" }, { field: "PROD_NAME", header: "Name" },
    { field: "P_UOM", header: "P Uom" }, { field: "L_UOM", header: "L Uom" },
  ];
  const supplierColumns = [{ field: "SUPPLIER_CODE", header: "Code" }, { field: "SUPPLIER_NAME", header: "Name" }];

  const canEditRequested = !disabled && !userLevelLoading && userApprovalLevel < 2;
  const canEditApproved = !disabled && !userLevelLoading && userApprovalLevel >= 2;

  const resetDiscountItems = () =>
    setItems((prev) => prev.map((item) => {
      const u = { ...item, DISCOUNT_AMOUNT: 0 };
      const exRate = num(u.CURRENCY_RATE) || 1;
      return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(u, exRate) : recalcItem(u, exRate);
    }));

  const tabBtn = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-2 border-b-2 pb-0.5 text-xs font-bold uppercase tracking-wide transition-colors ${active
      ? (shouldShowTermsTab() ? "border-[#00378C] text-[#00378C]" : "border-transparent text-[#00378C]")
      : "border-transparent text-slate-400 hover:text-slate-700"}`;

  return (
    <>
      <div className="finance-document-ui finance-document-editor commercial-editor payment-workbench flex h-screen flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm px-4 py-2">
        <style>{`
          .commercial-lines-scroll { scrollbar-width: auto; scrollbar-color: #94a3b8 #e2e8f0; }
          .commercial-lines-scroll::-webkit-scrollbar { height: 16px; width: 16px; }
          .commercial-lines-scroll::-webkit-scrollbar-track { background: #e2e8f0; }
          .commercial-lines-scroll::-webkit-scrollbar-thumb { background-color: #94a3b8; border-radius: 8px; border: 8px solid #e2e8f0; }
          .commercial-lines-scroll::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
          .commercial-lines-scroll::-webkit-scrollbar-corner { background: #e2e8f0; }
          .finance-lines-table td { overflow: hidden; }
          .finance-lines-table th { overflow: visible; }
          .finance-lines-table td > * { max-width: 100%; }
          .finance-action-col { position: sticky; right: 0; z-index: 25; background-color: #ffffff !important; border-left: 1px solid #cbd5e1; box-shadow: -6px 0 8px -6px rgba(0,0,0,0.15); }
          .finance-action-col-head { position: sticky; right: 0; z-index: 45; background-color: ${PO_BLUE} !important; border-left: 1px solid #1e40af; box-shadow: -6px 0 8px -6px rgba(0,0,0,0.35); }
          .cancelled-document-banner { background-image: repeating-linear-gradient(45deg, #fee2e2 0px, #fee2e2 12px, #fecaca 12px, #fecaca 24px) !important; border-bottom: 1px solid #f87171; }
          .cancelled-watermark { position: absolute; right: -40px; bottom: -20px; font-size: 140px; font-weight: 900; letter-spacing: 8px; color: #ef4444; opacity: 0.08; transform: rotate(-15deg); pointer-events: none; user-select: none; z-index: 0; white-space: nowrap; line-height: 1; }
          .cancelled-content-wrapper { position: relative; overflow: hidden; min-height: 100%; }
          .cancelled-content-wrapper > *:not(.cancelled-watermark) { position: relative; z-index: 1; }
        `}</style>

        <form
          data-header-expanded={headerOpen}
          className={`finance-document-ui payment-workbench commercial-editor grid h-full ${(isCancelled || isSentBack) ? "grid-rows-[auto_auto_minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)_auto]"}`}
          onSubmit={(event) => { event.preventDefault(); if (!isLastLevel) void handleSubmit(); }}
        >
          <CardHeader className="commercial-command-header border-b bg-primary px-4 text-primary-foreground shadow-sm" style={{ paddingTop: "10px", paddingBottom: "10px", minHeight: "52px" }}>
            <div className="flex items-center justify-between gap-3" style={{ minHeight: "44px" }}>

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <PurchaseDocumentIdentity
                  title={docType !== "PR" ? "Purchase Order" : "Purchase Request"}
                  documentNo={docType !== "PR" ? (docNo || "") : (requestNumber || "")}
                  hideDate={true}
                  total={fmt3(totalFinalAmount)}
                  divCode={header.DIV_CODE}
                  divName={header.DIV_NAME}
                  onBack={() => onClose()}
                  headerExpanded={headerOpen}
                  onToggleHeader={() => setHeaderOpen((v) => !v)}
                >
                  {null}
                </PurchaseDocumentIdentity>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isCancelled && (
                  <Badge variant="outline" className="!border-red-300 !bg-red-500 !text-white font-bold shadow-sm">Cancelled</Badge>
                )}
                {isFinalApproved && !isCancelled && (
                  <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">Approved</Badge>
                )}
                {effectiveViewMode && !isFinalApproved && !isCancelled && (
                  <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">View Only</Badge>
                )}

                <div className="flex items-center gap-2">
                  {!effectiveViewMode && docType === "PR" && (
                    <Button type="button" onClick={handleSaveDraft} disabled={disabled || saving} className={BTN_BLUE}>
                      {savingAction === "SAVEASDRAFT" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={15} />}
                      {savingAction === "SAVEASDRAFT" ? "Saving..." : "Save Draft"}
                    </Button>
                  )}
                  {!effectiveViewMode && docType === "PR" && !isLastLevel && (
                    <Button type="button" onClick={handleSubmit} disabled={disabled || saving} className={BTN_BLUE}>
                      {savingAction === "SUBMITTED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {savingAction === "SUBMITTED" ? "Submitting..." : "Submit"}
                    </Button>
                  )}
                  {!effectiveViewMode && isLastLevel && (
                    <Button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        await handleApprove();
                      }}
                      disabled={disabled || saving}
                      className={BTN_BLUE}
                    >
                      {savingAction === "APPROVED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      {savingAction === "APPROVED" ? "Approving..." : "Approve"}
                    </Button>
                  )}
                  {!effectiveViewMode && userApprovalLevel >= 2 && (
                    <Button type="button" onClick={() => { setRemarkText(""); setSelectedSendBackTo(""); setSendBackOpen(true); }} disabled={disabled || saving} className={BTN_BLUE}>
                      <ChevronLeft size={15} /> Send Back
                    </Button>
                  )}
                  {!effectiveViewMode && userApprovalLevel >= 2 && (
                    <Button type="button" onClick={() => { setRemarkText(""); setRejectOpen(true); }} disabled={disabled || saving} className={BTN_BLUE}>
                      <X size={15} /> Reject
                    </Button>
                  )}
                  {!effectiveViewMode && userApprovalLevel < 2 && (
                    <Button type="button" onClick={handleCancel} disabled={disabled || saving} className={BTN_BLUE}>
                      {savingAction === "CANCELED" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling...</>) : "Cancel"}
                    </Button>
                  )}

                  <Button type="button" onClick={() => setAttachmentOpen(true)} className={BTN_BLUE}>
                    <Paperclip size={15} /> Files
                  </Button>
                  {requestNumber && (
                    <Button type="button" onClick={handlePrint} className={BTN_BLUE}>
                      <Printer size={15} /> Print
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          {isSentBack && !isCancelled && (
            <div
              className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between text-xs text-yellow-800 shadow-sm"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <span className="bg-yellow-500 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase">Sent Back</span>
                <strong>Reason:</strong> {(header as any).SENTBACK_REASON || "—"}
              </div>
              <div>
                <strong>Next Action By:</strong> {(header as any).NEXT_ACTION_BY_NAME || header.NEXT_ACTION_BY || "—"}
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="cancelled-document-banner" role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                <Badge variant="outline" className="!rounded !bg-red-600 !text-white !border-red-700 font-bold uppercase tracking-wider !text-[11px] !px-2.5 !py-1 shadow-sm whitespace-nowrap">
                  Cancelled Document
                </Badge>
                <strong style={{ color: "#991b1b", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {requestNumber || "Purchase Request"}
                </strong>
              </div>
              <p style={{ margin: 0, color: "#991b1b", fontSize: "12px", fontWeight: 600 }}>
                This Purchase Request is cancelled and opened in read-only mode.
              </p>
            </div>
          )}

          <CardContent className="commercial-editor-body min-h-0 min-w-0 overflow-auto p-3">
            <div className={`commercial-editor-sections grid gap-3 min-w-0 ${isCancelled ? "cancelled-content-wrapper" : ""}`}>
              {isCancelled && (
                <div className="cancelled-watermark" aria-hidden="true">CANCELLED</div>
              )}

              <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

              {headerOpen ? (
                <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1.35fr)] gap-1 p-1 items-stretch">

                    <div className="flex flex-col gap-1.5">
                      <HeaderBlock label="Description & Remarks" icon={<FileText size={11} />} gridCols="grid-cols-1" grow>

                        <CField label="Description / Reason" required>
                          <textarea rows={3} disabled={disabled} value={String(header.DESCRIPTION || "")} onChange={(e) => setHdr("DESCRIPTION", e.target.value)} className="w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs" placeholder="Enter description or reason..." />
                        </CField>

                        <div className="mt-1 flex items-end gap-2">
                          <div className="min-w-0 flex-1">
                            <CField label="Remarks" required>
                              <textarea rows={3} disabled={disabled} value={String(header.REMARKS || "")} onChange={(e) => setHdr("REMARKS", e.target.value)} className="w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs" placeholder="Enter remarks..." />
                            </CField>
                          </div>

                          <Button
                            type="button"
                            onClick={() => setCommentsOpen(true)}
                            className="mb-0.5 inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-solid !border-emerald-200 !bg-emerald-50 px-4 text-[11px] font-bold uppercase tracking-wide !text-slate-900 shadow-sm transition-all hover:!border-emerald-300 hover:!bg-emerald-100 active:scale-95"
                          >
                            <MessageSquare size={13} className="text-emerald-700" />
                            Com. & Hist.
                          </Button>
                        </div>

                      </HeaderBlock>
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <HeaderBlock label="Document Details" icon={<FileText size={11} />} gridCols="grid-cols-2" grow>
                        <CField label="Request Date">
                          <Input className="h-7 text-xs" disabled type="text" value={displayDate} />
                        </CField>
                        <CField label="POD Type" required>
                          <Select disabled={disabled} value={header.PDO_TYPE || "N"} onChange={(e) => setHdr("PDO_TYPE", e.target.value)} className="h-7 text-xs">
                            <option value="P">PDO-OTO</option>
                            <option value="Q">PDO-NON-OTO</option>
                            <option value="N">NON-PDO</option>
                          </Select>
                        </CField>
                        <CField label="Currency" required>
                          <LookupField
                            placeholder="Currency..."
                            value={header.CURR_CODE || ""}
                            displayValue={header.CURR_CODE && header.CURR_NAME ? `${header.CURR_CODE} - ${header.CURR_NAME}` : header.CURR_CODE || ""}
                            columns={currencyColumns}
                            valueField="CURR_CODE"
                            displayFields={["CURR_CODE", "CURR_NAME", "EX_RATE"]}
                            loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_CURRENCY", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                            onChange={(value, row) => {
                              const n = String(row?.CURR_NAME || row?.curr_name || "");
                              const ex = Number(row?.EX_RATE || row?.ex_rate || header.CURRENCY_RATE || 1);
                              setHdr("CURR_CODE", value); setHdr("CURR_NAME", n); setHdr("CURRENCY_RATE", ex);
                              updateAllItemsWithHeader({ CURR_CODE: value, CURR_NAME: n, CURRENCY_RATE: ex });
                            }}
                            disabled={disabled}
                          />
                        </CField>
                        <CField label="Ex Rate">
                          <Input className="h-7 text-xs text-right" type="number" step="0.0001" disabled={disabled} value={header.CURRENCY_RATE ?? ""} onChange={(e) => { const r = Number(e.target.value); setHdr("CURRENCY_RATE", r); updateAllItemsWithHeader({ CURRENCY_RATE: r }); }} />
                        </CField>
                        <CField label="Flow">
                          <Input className="h-7 text-xs" disabled type="text" value={header.FLOW_DESCRIPTION || ""} placeholder="—" />
                        </CField>
                      </HeaderBlock>
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <HeaderBlock label="Tax Configuration" icon={<Receipt size={11} />} gridCols="grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
                        <CField label="Tax Type">
                          <Select className="h-7 text-xs w-auto min-w-[68px]" value={String(header.TAX_TYPE || "Std.")} disabled={disabled} onChange={(e) => {
                            const v = e.target.value;
                            const perc = v === "Std." ? 5 : 0;
                            setHdr("TAX_TYPE", v);
                            setItems((prev) => prev.map((item) => {
                              const m: TPRItem = { ...item, TAX_TYPE: v, TX_COMPNT_PERC_1: perc };
                              const ex = num(m.CURRENCY_RATE) || 1;
                              return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(m, ex) : recalcItem(m, ex);
                            }));
                          }}>
                            <option value="Std.">Std.</option>
                            <option value="Zero">Zero</option>
                            <option value="Exempt">Exempt</option>
                            <option value="No VAT">No VAT</option>
                          </Select>
                        </CField>

                        <CField label="Tax Category">
                          <LookupField
                            placeholder="Tax Category..."
                            value={header.TX_CAT_CODE || ""}
                            displayValue={header.TX_CAT_CODE && header.TX_CAT_NAME ? `${header.TX_CAT_CODE} - ${header.TX_CAT_NAME}` : header.TX_CAT_CODE || ""}
                            columns={taxCategoryColumns}
                            valueField="TX_CAT_CODE"
                            displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
                            loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                            onChange={(val, row) => {
                              if (row) {
                                const tc = String(row.TX_COMPNTCAT_CODE_1 || "");
                                const tp = Number(row.TX_COMPNT_PERC_1) || 0;
                                const tn = String(row.TX_CAT_NAME || "");
                                setHdr("TX_CAT_CODE", val); setHdr("TX_CAT_NAME", tn);
                                setHdr("TX_COMPNTCAT_CODE_1", tc); setHdr("TX_COMPNT_PERC_1", tp);
                                updateAllItemsWithHeader({ TX_CAT_CODE: val, TX_CAT_NAME: tn, TX_COMPNTCAT_CODE_1: tc, TX_COMPNT_PERC_1: tp });
                              }
                            }}
                            disabled={disabled}
                          />
                        </CField>

                        <CField label="Tax Code">
                          <LookupField
                            placeholder="Tax Code..."
                            value={header.TX_COMPNTCAT_CODE_1 || ""}
                            displayValue={header.TX_COMPNTCAT_CODE_1 && (header as any).TX_COMPNTCAT_NAME ? `${header.TX_COMPNTCAT_CODE_1} - ${(header as any).TX_COMPNTCAT_NAME}` : header.TX_COMPNTCAT_CODE_1 || ""}
                            columns={taxComponentColumns}
                            valueField="TX_COMPNTCAT_CODE"
                            displayFields={["TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME"]}
                            loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX_COMPONENT", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                            onChange={(val, row) => {
                              if (row && typeof row === "object") {
                                const n = String(row.TX_COMPNTCAT_NAME || "");
                                const p = Number(row.TX_PERCNT) || 0;
                                setHdr("TX_COMPNTCAT_CODE_1", val); setHdr("TX_COMPNTCAT_NAME", n); setHdr("TX_COMPNT_PERC_1", p);
                                updateAllItemsWithHeader({ TX_COMPNTCAT_CODE_1: val, TX_COMPNTCAT_NAME: n, TX_COMPNT_PERC_1: p });
                              } else {
                                setHdr("TX_COMPNTCAT_CODE_1", val);
                                updateAllItemsWithHeader({ TX_COMPNTCAT_CODE_1: val });
                              }
                            }}
                            disabled={disabled}
                          />
                        </CField>
                      </HeaderBlock>

                      <HeaderBlock label="Discount" icon={<Percent size={11} />} gridCols="grid-cols-2" grow>
                        <div className="col-span-2 flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold">Discount Applied To</span>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                              <input type="radio" name="discount_scope" value="PO" checked={discountScope === "PO"} disabled={disabled || items.length === 0} onChange={() => {
                                const seededPrice = totalDiscAmount;
                                const totalBefore = calculateTotalUnitPrice(items);
                                const seededPercent = totalBefore > 0 ? (seededPrice / totalBefore) * 100 : 0;
                                setDiscountScope("PO");
                                setHdr("DISC_AMOUNT", seededPrice);
                                setHdr("DISCOUNT_AMOUNT", seededPercent);
                                setDiscAmtText(seededPrice.toFixed(3));
                                setDiscPctText(seededPercent.toFixed(3));
                              }} />
                              Entire PR
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                              <input type="radio" name="discount_scope" value="ITEM" checked={discountScope === "ITEM"} disabled={disabled || items.length === 0} onChange={() => { setDiscountScope("ITEM"); setHdr("DISCOUNT_AMOUNT", 0); setHdr("DISC_AMOUNT", 0); }} />
                              Individual Items
                            </label>
                          </div>
                        </div>

                        <CField label="Disc %">
                          <Input
                            className="h-7 text-xs text-right"
                            type="text"
                            inputMode="decimal"
                            value={discPctText}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setDiscPctText(raw);
                              const p = parseFloat(raw);
                              if (isNaN(p)) return;
                              setHdr("DISCOUNT_AMOUNT", p);
                              if (p > 0 && discountScope === "PO") {
                                setHdr("DISC_AMOUNT", 0);
                                setItems(distributeDiscountToItems(items, p, userApprovalLevel));
                                const t = calculateTotalUnitPrice(items);
                                if (t > 0) {
                                  const amt = (p / 100) * t;
                                  setHdr("DISC_AMOUNT", amt);
                                  setDiscAmtText(amt.toFixed(3));
                                }
                              } else if (p === 0 && discountScope === "PO") {
                                resetDiscountItems();
                                setHdr("DISC_AMOUNT", 0);
                                setDiscAmtText("0.000");
                              }
                            }}
                            onBlur={(e) => {
                              const p = parseFloat(e.target.value) || 0;
                              setDiscPctText(p.toFixed(3));
                            }}
                            disabled={disabled || items.length === 0 || discountScope === "ITEM"}
                          />
                        </CField>
                        <CField label="Disc Amt">
                          <Input
                            className="h-7 text-xs text-right"
                            type="text"
                            inputMode="decimal"
                            value={discAmtText}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setDiscAmtText(raw);
                              const a = parseFloat(raw);
                              if (isNaN(a)) return;
                              setHdr("DISC_AMOUNT", a);
                              if (a > 0 && discountScope === "PO") {
                                setHdr("DISCOUNT_AMOUNT", 0);
                                setItems(distributeDiscountFromAmount(items, a, userApprovalLevel));
                                const t = calculateTotalUnitPrice(items);
                                if (t > 0) {
                                  const pct = (a / t) * 100;
                                  setHdr("DISCOUNT_AMOUNT", pct);
                                  setDiscPctText(pct.toFixed(3));
                                }
                              } else if (a === 0 && discountScope === "PO") {
                                resetDiscountItems();
                                setHdr("DISCOUNT_AMOUNT", 0);
                                setDiscPctText("0.000");
                              }
                            }}
                            onBlur={(e) => {
                              const a = parseFloat(e.target.value) || 0;
                              setDiscAmtText(a.toFixed(3));
                            }}
                            disabled={disabled || items.length === 0 || discountScope === "ITEM"}
                          />
                        </CField>
                      </HeaderBlock>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs shadow-xs min-w-0">
                  <div className="flex items-center gap-4 text-slate-700 flex-wrap min-w-0">
                    <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-[#00378C]">Doc Date:</span><span className="font-medium">{displayDate}</span></span>
                    <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-[#00378C]">Flow:</span><span className="font-medium">{header.FLOW_DESCRIPTION || "-"}</span></span>
                    <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-[#00378C]">Currency:</span><span className="font-medium">{header.CURR_CODE || "-"} ({Number(header.CURRENCY_RATE || 1).toFixed(4)})</span></span>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    <Button type="button" size="sm" className={`h-6 text-xs ${BTN_BLUE}`} onClick={() => setCommentsOpen(true)}>
                      <MessageSquare size={12} className="mr-1" /> Comments & Activity
                    </Button>
                    <Button type="button" size="sm" className={`h-6 text-xs ${BTN_BLUE}`} onClick={() => setHeaderOpen(true)}>
                      Show Header Fields <ChevronDown size={13} className="ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex min-h-[300px] min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-gray-100 bg-card">
                <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b bg-white px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ backgroundColor: PO_BLUE }}>
                      <List size={14} />
                    </span>
                    <button type="button" onClick={() => setActiveTab("items")} className={tabBtn(activeTab === "items")}>
                      <span>{isSupplierUser ? "Item Details" : "Details Items"}</span>
                    </button>
                    {shouldShowTermsTab() && (
                      <>
                        <span className="h-4 w-px bg-slate-300" />
                        <button type="button" onClick={() => setActiveTab("terms")} className={tabBtn(activeTab === "terms")}>
                          <span>Terms & Conditions</span>
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#00378C]">{terms.length}</span>
                        </button>
                      </>
                    )}
                    {activeTab === "items" && lineSearch.trim() && (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Filtered ({filteredItems.length} of {items.length})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeTab === "items" && (
                      <>
                        <button type="button" onClick={() => setShowAllColumns(!showAllColumns)} className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all ${showAllColumns ? "border-[#00378C]/40 bg-blue-50 text-[#00378C]" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                          <Columns3 size={13} className={showAllColumns ? "text-[#00378C]" : "text-slate-500"} />
                          <span>{showAllColumns ? "Compact View" : "All Columns"}</span>
                        </button>
                        <div className="relative flex h-8 w-64 items-center rounded-full border border-slate-300 bg-white pl-8 pr-3 transition-all duration-300 ease-out focus-within:w-96 focus-within:border-[#00378C] focus-within:ring-2 focus-within:ring-[#00378C]/20">
                          <Search size={13} className="absolute left-3 text-slate-400" />
                          <input className="h-full w-full border-0 bg-transparent text-xs outline-none placeholder:text-slate-400" type="text" value={lineSearch} onChange={(e) => setLineSearch(e.target.value)} placeholder="Search lines..." />
                        </div>
                      </>
                    )}
                    {/* Buttons only render AFTER user level resolves — 2nd-level approver will never see them flash */}
                    {!effectiveViewMode && activeTab === "items" && !userLevelLoading && userApprovalLevel < 2 && (
                      <>
                        <Button disabled={disabled} type="button" onClick={() => setImportOpen(true)} className={`h-8 px-3 text-xs ${BTN_BLUE}`}><FileSpreadsheet size={14} /> Import Excel</Button>
                        <Button disabled={disabled} type="button" onClick={addItemLine} className={`h-8 px-3 text-xs ${BTN_BLUE}`}><Plus size={14} /> Add Line</Button>
                      </>
                    )}
                  </div>
                </div>

                {activeTab === "items" && (
                  <>
                    <div ref={tableContainerRef} className="commercial-lines-scroll min-h-0 flex-1 overflow-auto min-w-0" style={{ overscrollBehavior: "contain" }}>
                      <table
                        className="finance-lines-table w-full table-fixed border-collapse text-[10px] [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-300 [&_th]:whitespace-nowrap [&_th]:leading-tight"
                        style={{ minWidth: tableMinWidth }}
                      >
                        <colgroup>
                          {colWidths.map((w, i) => <col key={i} style={{ width: `${w}px` }} />)}
                        </colgroup>
                        <thead className="sticky top-0 z-30 text-[10px] font-semibold text-white shadow-sm" style={{ backgroundColor: PO_BLUE }}>
                          <tr>
                            <th rowSpan={2} className="sticky left-0 z-40 px-0 py-1 text-center align-middle text-[9px]" style={{ backgroundColor: PO_BLUE }}>
                              <span className="block leading-tight">SR</span>
                              <span className="block leading-tight">NO</span>
                            </th>
                            <th rowSpan={2} className="sticky left-[30px] z-40 px-1 py-1.5 text-center align-middle" style={{ backgroundColor: PO_BLUE }}>PRODUCT</th>
                            <th rowSpan={2} className="px-0 py-1 text-center align-middle text-[9px]">
                              <span className="block leading-tight">PUOM</span>
                            </th>
                            <th colSpan={qtyColSpan} className="px-1 py-1.5 text-center align-middle">REQUESTED QTY</th>
                            <th colSpan={qtyColSpan} className="px-1 py-1.5 text-center align-middle">APPROVED QTY</th>
                            {shouldShowSupplier() && (
                              <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">SUPPLIER *</th>
                            )}
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">UNIT PRICE</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">AMOUNT</th>
                            <th colSpan={2} className="px-1 py-1.5 text-center align-middle" style={BAND("#bbf7d0")}>DISCOUNT</th>
                            <th rowSpan={2} className="group relative px-1 py-1 text-center align-middle !overflow-visible hover:!z-40 text-[9px]">
                              <span className="block leading-tight">TOTAL AMOUNT</span>
                              <span className="block leading-tight">(E.T)</span>
                              <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">Total Amount Excluding Tax</span>
                            </th>
                            <th colSpan={2} className="px-1 py-1.5 text-center align-middle" style={BAND("#f5d0fe")}>TAX</th>
                            <th rowSpan={2} className="group relative px-1 py-1 text-center align-middle !overflow-visible hover:!z-40 text-[9px]">
                              <span className="block leading-tight">TOTAL AMOUNT</span>
                              <span className="block leading-tight">(I.T)</span>
                              <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">Total Amount Including Tax</span>
                            </th>
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">LCURR AMOUNT BEFORE TAX</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">TAX TYPE</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">TAX CAT</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">TAX CODE</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">TAX LCURR AMOUNT</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">LCURR AMOUNT AFTER TAX</th>}

                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">CAPEX</th>
                            <th rowSpan={2} className="finance-action-col-head px-0 py-1.5 text-center align-middle">ACTION</th>
                          </tr>
                          <tr>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">PQTY</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">LUOM</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">LQTY</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">REQQTY</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">PQTY</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">LUOM</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">LQTY</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]">APRQTY</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]" style={BAND("#bbf7d0")}>DISC %</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]" style={BAND("#bbf7d0")}>DISC AMT</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]" style={BAND("#f5d0fe")}>TAX %</th>
                            <th className="px-1 py-1 text-center align-middle text-[9px]" style={BAND("#f5d0fe")}>TAX AMT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={itemsColSpan}>No detail lines yet — click "Add Line" to get started</td></tr>
                          ) : filteredItems.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={itemsColSpan}>No lines match "<strong>{lineSearch}</strong>"</td></tr>
                          ) : filteredItems.map((item) => {
                            const itemId = (item as any).id || String(item.ITEM_SRNO);
                            const qty = computeQuantity(item);
                            const approvedQty = computeApprovedQuantity(item);
                            const discPrice = num((item as any).DISC_PRICE) || itemDiscPrice(item);
                            const amount = num(item.AMOUNT) || itemAmount(item);
                            const taxAmt = num(item.TX_COMPNT_AMT_1) || itemTaxAmount(item);
                            const lcurrAmt = num((item as any).LCURR_AMT) || itemLcurrAmount(item, num(item.CURRENCY_RATE) || 1);
                            const taxLcurr = num((item as any).TX_COMPNT_LCURAMT_1) || itemTaxLcurrAmount(item, num(item.CURRENCY_RATE) || 1);
                            const lcurrAfterDisc = num((item as any).LCURR_AFTER_DISCOUNT) || itemLcurrAfterDisc(item, num(item.CURRENCY_RATE) || 1);

                            const supplierCode = item.SUPPLIER ? String(item.SUPPLIER).split(" - ")[0].trim() : "";
                            const supplierName = (item as any).SUPPLIER_NAME || supplierList.find((s: any) => s.SUPPLIER_CODE === supplierCode)?.SUPPLIER_NAME || "";
                            const supplierDisplay = supplierCode && supplierName ? `${supplierCode} - ${supplierName}` : supplierCode;

                            const productDisplay = item.ITEM_CODE && item.ITEM_DESP ? `${item.ITEM_CODE} - ${item.ITEM_DESP}` : (item.ITEM_CODE || "");

                            const qtyForCalc = userApprovalLevel >= 2 ? approvedQty : qty;
                            const grossAmount = num(item.ITEM_RATE) * qtyForCalc;

                            return (
                              <tr className="border-t odd:bg-muted/20" key={itemId}>
                                <td className="sticky left-0 z-20 bg-card px-1 py-1 text-center text-[10px]">{item.ITEM_SRNO}</td>
                                <td className="group sticky left-[30px] z-20 bg-card px-1 py-1 !overflow-visible hover:!z-[25]">
                                  <div className="w-full" title={productDisplay}>
                                    <LookupField
                                      label="" compact placeholder="Search Product *"
                                      value={item.ITEM_CODE || ""}
                                      displayValue={productDisplay}
                                      columns={productColumns}
                                      valueField="PROD_CODE"
                                      displayFields={["PROD_CODE", "PROD_NAME"]}
                                      loadOptions={async () => {
                                        const all = await almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_PRODUCT_LIST", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" });
                                        const sel = new Set(items.filter((it) => (it as any).id !== itemId).map((it) => String(it.ITEM_CODE || "").trim()).filter(Boolean));
                                        return (all as any[]).filter((p: any) => !sel.has(String(p.PROD_CODE || "").trim()));
                                      }}
                                      onChange={(val, row) => {
                                        if (row) {
                                          setItems((prev) => prev.map((it) => {
                                            if ((it as any).id !== itemId) return it;
                                            const tr = String(val ?? "").trim().toUpperCase();
                                            if (tr) {
                                              const dup = prev.some((o) => (o as any).id !== itemId && String(o.ITEM_CODE || "").trim().toUpperCase() === tr);
                                              if (dup) { toast.warning("This product is already added in another line.", 4000); return it; }
                                            }
                                            const updated: TPRItem = {
                                              ...it,
                                              ITEM_CODE: String(val ?? ""),
                                              ITEM_DESP: String(row.PROD_NAME ?? ""),
                                              P_UOM: String(row.P_UOM ?? ""),
                                              L_UOM: String(row.L_UOM ?? ""),
                                              UPPP: Number(row.UPPP) || 0,
                                              ITEM_RATE: Number(row.BASE_PRICE) || 0,
                                            };
                                            updated.REQUEST_QUANTITY = computeQuantity(updated);
                                            const ex = num(updated.CURRENCY_RATE) || 1;
                                            return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(updated, ex) : recalcItem(updated, ex);
                                          }));
                                        }
                                      }}
                                      disabled={disabled}
                                    />
                                  </div>
                                  <span className="pointer-events-none absolute left-1/2 top-full z-50 -mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">Unit Per Primary: {item.UPPP || 0}</span>
                                </td>

                                <td className={`${UOM_LABEL} text-center`}>{item.P_UOM || ""}</td>

                                <td className="px-1 py-1">
                                  <Input type="number" step="0.001" value={item.QTY_PUOM || ""} onChange={(e) => updateItemField(itemId, "QTY_PUOM", Number(e.target.value) || 0)} disabled={!canEditRequested} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>
                                <td className={`${UOM_LABEL} text-center`}>{item.L_UOM || ""}</td>
                                <td className="px-1 py-1">
                                  <Input type="number" step="0.001" value={isSameUom(item) ? 0 : item.QTY_LUOM || ""} onChange={(e) => updateItemField(itemId, "QTY_LUOM", Number(e.target.value) || 0)} disabled={!canEditRequested || isSameUom(item)} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>
                                <td className="bg-slate-200 px-1 py-1 text-right font-semibold text-[10px]">{fmt3(qty)}</td>

                                <td className="px-1 py-1">
                                  <Input type="number" step="0.001" value={(item as any).APPROVED_QTY_PUOM || ""} onChange={(e) => updateItemField(itemId, "APPROVED_QTY_PUOM" as any, Number(e.target.value) || 0)} disabled={!canEditApproved} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>
                                <td className={`${UOM_LABEL} text-center`}>{item.L_UOM || ""}</td>
                                <td className="px-1 py-1">
                                  <Input type="number" step="0.001" value={(item as any).APPROVED_QTY_LUOM || ""} onChange={(e) => updateItemField(itemId, "APPROVED_QTY_LUOM" as any, Number(e.target.value) || 0)} disabled={!canEditApproved || isSameUom(item)} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>
                                <td className="bg-slate-200 px-1 py-1 text-right font-semibold text-[10px]">{fmt3(approvedQty)}</td>

                                {shouldShowSupplier() && (
                                  <td className="px-1 py-1" title={supplierDisplay}>
                                    <LookupField
                                      label="" compact placeholder="Search Supplier *"
                                      value={supplierCode}
                                      displayValue={supplierDisplay}
                                      columns={supplierColumns}
                                      valueField="SUPPLIER_CODE"
                                      displayFields={["SUPPLIER_CODE", "SUPPLIER_NAME"]}
                                      loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_SUPPLIERS", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                                      onChange={(val, row) => {
                                        const rawVal = String(row?.SUPPLIER_CODE ?? val ?? "");
                                        const code = rawVal.split(" - ")[0].trim();
                                        updateItemField(itemId, "SUPPLIER", code);
                                        if (row) updateItemField(itemId, "SUPPLIER_NAME" as any, row.SUPPLIER_NAME || "");
                                      }}
                                      disabled={disabled}
                                    />
                                  </td>
                                )}

                                <td className="px-1 py-1">
                                  <Input type="number" step="0.0001" value={item.ITEM_RATE || ""} onChange={(e) => updateItemField(itemId, "ITEM_RATE", Number(e.target.value) || 0)} disabled={disabled || userApprovalLevel < 1} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>

                                <td className={AMOUNT_CELL}>{fmt3(grossAmount)}</td>

                                <td className="px-1 py-1">
                                  <Input type="number" step="0.001" value={item.DISCOUNT_AMOUNT || ""} onChange={(e) => updateItemField(itemId, "DISCOUNT_AMOUNT", Number(e.target.value) || 0)} disabled={disabled || discountScope === "PO"} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>

                                <td className="px-1 py-1">
                                  <Input type="number" step="0.001" value={discPrice || ""} onChange={(e) => updateItemField(itemId, "DISC_PRICE" as any, Number(e.target.value) || 0)} disabled={disabled || discountScope === "PO"} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>

                                <td className={AMOUNT_CELL}>{fmt3(amount)}</td>
                                <td className="px-1 py-1">
                                  <Input type="number" step="0.01" value={item.TX_COMPNT_PERC_1 || ""} onChange={(e) => updateItemField(itemId, "TX_COMPNT_PERC_1", Number(e.target.value) || 0)} disabled={disabled} className={`h-7 w-full text-right text-[10px] px-1 [appearance:textfield] ${INPUT_BG}`} placeholder="0" />
                                </td>
                                <td className={AMOUNT_CELL}>{fmt3(taxAmt)}</td>
                                <td className={AMOUNT_CELL}>{fmt3(amount + taxAmt)}</td>

                                {showAllColumns && <td className={AMOUNT_CELL}>{fmt3(lcurrAmt)}</td>}
                                {showAllColumns && (
                                  <td className="px-1 py-1">
                                    <Select className="h-7 w-full text-[10px] px-1" value={item.TAX_TYPE || "Std."} onChange={(e) => updateItemField(itemId, "TAX_TYPE", e.target.value)} disabled={disabled}>
                                      <option value="Std.">Std.</option>
                                      <option value="Zero">Zero</option>
                                      <option value="Exempt">Exempt</option>
                                      <option value="No VAT">No VAT</option>
                                    </Select>
                                  </td>
                                )}
                                {showAllColumns && (
                                  <td className="px-1 py-1">
                                    <LookupField
                                      label="" compact placeholder="Tax Cat"
                                      value={item.TX_CAT_CODE || ""}
                                      displayValue={item.TX_CAT_CODE && item.TX_CAT_NAME ? `${item.TX_CAT_CODE} - ${item.TX_CAT_NAME}` : item.TX_CAT_CODE || ""}
                                      columns={taxCategoryColumns}
                                      valueField="TX_CAT_CODE"
                                      displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
                                      loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                                      onChange={(val, row) => { updateItemField(itemId, "TX_CAT_CODE", val); if (row) { updateItemField(itemId, "TX_CAT_NAME", row.TX_CAT_NAME || ""); updateItemField(itemId, "TX_COMPNTCAT_CODE_1", row.TX_COMPNTCAT_CODE_1 || ""); } }}
                                      disabled={disabled}
                                    />
                                  </td>
                                )}
                                {showAllColumns && (
                                  <td className="px-1 py-1">
                                    <LookupField
                                      label="" compact placeholder="Tax Code"
                                      value={item.TX_COMPNTCAT_CODE_1 || ""}
                                      displayValue={item.TX_COMPNTCAT_CODE_1 && item.TX_COMPNTCAT_NAME ? `${item.TX_COMPNTCAT_CODE_1} - ${item.TX_COMPNTCAT_NAME}` : item.TX_COMPNTCAT_CODE_1 || ""}
                                      columns={taxComponentColumns}
                                      valueField="TX_COMPNTCAT_CODE"
                                      displayFields={["TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME"]}
                                      loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX_COMPONENT", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                                      onChange={(val, row) => { updateItemField(itemId, "TX_COMPNTCAT_CODE_1", val); if (row) { updateItemField(itemId, "TX_COMPNTCAT_NAME", row.TX_COMPNTCAT_NAME || ""); if (row.TX_PERCNT !== undefined) updateItemField(itemId, "TX_COMPNT_PERC_1", Number(row.TX_PERCNT) || 0); } }}
                                      disabled={disabled}
                                    />
                                  </td>
                                )}
                                {showAllColumns && <td className={AMOUNT_CELL}>{fmt3(taxLcurr)}</td>}
                                {showAllColumns && <td className={AMOUNT_CELL}>{fmt3(lcurrAfterDisc)}</td>}

                                <td className="px-1 py-1">
                                  <Select
                                    value={item.CAPEX_OPEX_NON_OPEX || ""}
                                    onChange={(e) => updateItemField(itemId, "CAPEX_OPEX_NON_OPEX", e.target.value)}
                                    disabled={disabled}
                                    className="h-7 w-full text-[10px] px-1"
                                  >
                                    <option value="" disabled>Select...</option>
                                    <option value="N">No</option>
                                    <option value="Y">Yes</option>
                                  </Select>
                                </td>

                                <td className="finance-action-col px-1 py-1 text-center">
                                  <button type="button" disabled={disabled} title="Delete row" className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => removeItem(itemId)}>
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="commercial-lines-footer flex flex-none flex-wrap items-center justify-end gap-3 border-t border-[#cbd5e1] px-3 py-2" style={{ backgroundColor: "#f8fafc", boxShadow: "0 -2px 6px rgba(0,0,0,0.06)", fontSize: 14 }}>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Amount</span>
                        <strong className="text-emerald-600">{fmt3(totalAmountBeforeDisc)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Discount</span>
                        <strong>{fmt3(totalDiscAmount)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Total Amount Excluding Tax</span>
                        <strong>{fmt3(totalAmount)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Tax</span>
                        <strong>{fmt3(totalTax)}</strong>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1">
                        <span className="font-semibold" style={{ color: PO_BLUE }}>Total Amount Including Tax</span>
                        <strong className="text-sm text-emerald-600">{fmt3(totalFinalAmount)}</strong>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "terms" && shouldShowTermsTab() && (
                  <>
                    <div className="commercial-lines-scroll min-h-0 flex-1 overflow-auto min-w-0" style={{ overscrollBehavior: "contain" }}>
                      <table className="finance-lines-table w-full table-fixed border-collapse text-[10px] [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-300 [&_th]:whitespace-nowrap">
                        <colgroup>
                          <col style={{ width: "70px" }} />
                          <col style={{ width: "340px" }} />
                          <col style={{ width: "220px" }} />
                          <col style={{ width: "240px" }} />
                          <col style={{ width: "180px" }} />
                          <col />
                        </colgroup>
                        <thead className="sticky top-0 z-30 text-[10px] font-semibold text-white shadow-sm" style={{ backgroundColor: PO_BLUE }}>
                          <tr>
                            <th className="px-2 py-2 text-center align-middle">Sr No</th>
                            <th className="px-2 py-2 text-center align-middle">Supplier</th>
                            <th className="px-2 py-2 text-center align-middle">Delivery Term *</th>
                            <th className="px-2 py-2 text-center align-middle">Payment Terms *</th>
                            <th className="px-2 py-2 text-center align-middle">Warranty *</th>
                            <th className="px-2 py-2 text-center align-middle">Remarks *</th>
                          </tr>
                        </thead>
                        <tbody>
                          {terms.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>No terms yet — they are added automatically for each supplier selected on the items</td></tr>
                          ) : terms.map((term, idx) => {
                            const disp = term.SUPPLIER && term.SUPPLIER_NAME ? `${term.SUPPLIER} - ${term.SUPPLIER_NAME}` : (term.SUPPLIER || "");
                            return (
                              <tr className="border-t odd:bg-muted/20" key={term.id}>
                                <td className="px-2 py-1 text-center">{idx + 1}</td>
                                <td className="px-2 py-1 font-semibold text-slate-700 whitespace-normal break-words" title={disp}>{disp}</td>
                                <td className="px-1 py-1"><Input value={term.DLVR_TERM || ""} onChange={(e) => updateTermField(term.id, "DLVR_TERM", e.target.value)} disabled={disabled} className={`h-7 w-full text-[10px] px-2 ${INPUT_BG}`} /></td>
                                <td className="px-1 py-1"><Input value={term.PAYMENT_TERMS || ""} onChange={(e) => updateTermField(term.id, "PAYMENT_TERMS", e.target.value)} disabled={disabled} className={`h-7 w-full text-[10px] px-2 ${INPUT_BG}`} /></td>
                                <td className="px-1 py-1"><Input value={term.WARRANTY || ""} onChange={(e) => updateTermField(term.id, "WARRANTY", e.target.value)} disabled={disabled} className={`h-7 w-full text-[10px] px-2 ${INPUT_BG}`} /></td>
                                <td className="px-1 py-1"><Input value={term.REMARKS || ""} onChange={(e) => updateTermField(term.id, "REMARKS", e.target.value)} disabled={disabled} className={`h-7 w-full text-[10px] px-2 ${INPUT_BG}`} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="commercial-lines-footer flex flex-none flex-wrap items-center justify-end gap-3 border-t border-[#cbd5e1] px-3 py-2" style={{ backgroundColor: "#f8fafc", boxShadow: "0 -2px 6px rgba(0,0,0,0.06)", fontSize: 14 }}>
                      <div className="flex items-center gap-2"><span className="text-muted-foreground">Supplier Terms</span><strong>{terms.length}</strong></div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </form>
      </div>

      <AttachmentDialog
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        requestNumber={requestNumber || ""}
        title="Purchase Request Attachments"
        module="PR" type="Purchase Request"
        companyCode={companyCode} loginId={loginid}
        flowLevel={Number(header.FLOW_LEVEL_RUNNING) || 1}
      />

      <Dialog
        open={importOpen}
        wide
        title="Import Items from Excel"
        description="Upload an Excel file, review the validation status, then add the valid lines."
        onClose={() => setImportOpen(false)}
      >
        {importOpen && (
          <ImportPrItems
            productCodes={productCodes}
            supplierList={supplierList}
            existingCodes={items.map((i) => String(i.ITEM_CODE || ""))}
            requireSupplier={isSupplierUser}
            requireQty={userApprovalLevel === 1}
            onImport={handleImportItems}
            onClose={() => setImportOpen(false)}
          />
        )}
      </Dialog>

      <Dialog open={rejectOpen} title="Reject Request" description="Enter the reason for rejection." onClose={() => setRejectOpen(false)}
        footer={<>
          <Button type="button" onClick={() => setRejectOpen(false)} className={BTN_BLUE}>Cancel</Button>
          <Button
            type="button"
            disabled={saving}
            onClick={async (e) => {
              e.preventDefault(); e.stopPropagation();
              window.scrollTo({ top: 0, behavior: "smooth" });
              await handleRejectConfirm();
            }}
            className={BTN_BLUE}
          >
            {savingAction === "REJECTED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X size={15} />}
            {savingAction === "REJECTED" ? "Rejecting..." : "Confirm Reject"}
          </Button>
        </>}>
        <div className="flex flex-col gap-2">
          <label className="field"><span>Rejection Reason *</span>
            <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter reject remark..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
      </Dialog>

      <Dialog open={sendBackOpen} title="Send Back Request" description="Select who to send this back to, and enter the reason." onClose={() => setSendBackOpen(false)}
        footer={<>
          <Button type="button" onClick={() => setSendBackOpen(false)} className={BTN_BLUE}>Cancel</Button>
          <Button
            type="button"
            disabled={saving}
            onClick={async (e) => {
              e.preventDefault(); e.stopPropagation();
              window.scrollTo({ top: 0, behavior: "smooth" });
              await handleSendBackConfirm();
            }}
            className={BTN_BLUE}
          >
            {savingAction === "SENDBACK" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronLeft size={15} />}
            {savingAction === "SENDBACK" ? "Sending..." : "Confirm Send Back"}
          </Button>
        </>}>
        <div className="flex flex-col gap-3">
          <label className="field"><span>Send Back To *</span>
            <Select value={selectedSendBackTo} onChange={(e) => setSelectedSendBackTo(e.target.value)} className="w-full">
              <option value="">Select user</option>
              {sendBackOptions.map((o) => (<option key={o.loginid} value={o.loginid}>{o.label}</option>))}
            </Select>
          </label>
          <label className="field"><span>Send Back Reason *</span>
            <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter send back reason..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
        </div>
      </Dialog>

      <Dialog
        open={commentsOpen}
        title="Comments & Activity"
        onClose={() => setCommentsOpen(false)}
      >
        <div className="flex flex-col gap-4 w-full" style={{ minWidth: '450px' }}>

          <div ref={commentsListRef} className="max-h-[350px] overflow-y-auto pr-2 space-y-4">
            {displayHistory.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8 uppercase">No activity yet.</div>
            ) : displayHistory.map((h, i) => {
              const initial = String(h.ACTION_BY_NAME || h.ACTION_BY || "U").charAt(0).toUpperCase();
              const dateStr = h.ACTION_DATE ? new Date(h.ACTION_DATE).toLocaleString('en-GB', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
              }) : "";

              const actionType = String(h.LAST_ACTION || "").toUpperCase();
              const isComment = actionType === "COMMENTED" || actionType === "COMMENT";
              const commentTxt = String(h.COMMENTS || h.REMARKS_HISTORY || h.REMARKS || "");
              const isFirstAction = Number(h.LOGGER_NUMBER) === 1;

              let mainActionText = "";
              if (actionType === "SUBMITTED" || actionType === "SUBMIT") {
                mainActionText = isFirstAction ? "DOCUMENT CREATED BY USER." : "DOCUMENT SUBMITTED BY USER.";
                if (h.COMMENTS && h.COMMENTS.toUpperCase() !== "DOCUMENT SUBMITTED." && h.COMMENTS.toUpperCase() !== "DOCUMENT CREATED BY USER." && h.COMMENTS.toUpperCase() !== "DOCUMENT SUBMITTED BY USER.") {
                  mainActionText += ` REMARKS: ${String(h.COMMENTS).toUpperCase()}`;
                }
              } else if (actionType === "APPROVED" || actionType === "APPROVE") {
                mainActionText = "DOCUMENT APPROVED BY USER.";
                if (h.COMMENTS && h.COMMENTS.toUpperCase() !== "DOCUMENT APPROVED." && h.COMMENTS.toUpperCase() !== "DOCUMENT APPROVED BY USER.") {
                  mainActionText += ` REMARKS: ${String(h.COMMENTS).toUpperCase()}`;
                }
              } else if (actionType === "REJECTED" || actionType === "REJECT") {
                mainActionText = `DOCUMENT REJECTED. REASON: ${String(h.REJECT_REASON || "").toUpperCase()}`;
              } else if (actionType === "SENDBACK") {
                mainActionText = `DOCUMENT SENT BACK TO ${String(h.NEXT_ACTION_BY_NAME || h.NEXT_ACTION_BY || "").toUpperCase()}.`;
              } else if (isComment) {
                mainActionText = commentTxt.toUpperCase();
              } else {
                mainActionText = String(h.COMMENTS || actionType).toUpperCase();
              }

              return (
                <div key={i} className="flex gap-3 items-start bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                  <div className="h-8 w-8 rounded-full bg-[#e2e8f0] text-slate-600 flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-sm">
                    {initial}
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 uppercase">
                        {h.ACTION_BY_NAME || h.ACTION_BY}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {h.ROLE || ""}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap font-medium uppercase">
                        {dateStr}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-600 mt-1 break-words uppercase">
                      {mainActionText}
                    </span>

                    {actionType === "SENDBACK" && h.SENTBACK_REASON && (
                      <div className="mt-2 p-2 bg-slate-100 rounded-md border border-slate-200">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5 tracking-wider">
                          REASON FOR SEND BACK:
                        </span>
                        <span className="text-xs font-bold text-black uppercase block leading-tight">
                          {h.SENTBACK_REASON}
                        </span>
                      </div>
                    )}

                    {isComment && (
                      <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-500 rounded-r-md shadow-sm">
                        <span className="text-xs font-semibold text-blue-900 uppercase block leading-tight">
                          {commentTxt}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-100">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Type your comment here..."
              className="flex-1 h-10 rounded-md border-slate-300 focus-visible:ring-1 focus-visible:ring-[#00378C] text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleAddComment();
                }
              }}
            />
            <Button
              onClick={() => void handleAddComment()}
              disabled={!newComment.trim() || saving || !requestNumber}
              className="rounded-md bg-[#00378C] hover:bg-[#002c75] text-white h-10 w-12 p-0 shrink-0 shadow-sm"
            >
              {savingAction === "COMMENTED" ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
            </Button>
          </div>
        </div>
      </Dialog>

       <PurchaseReportPreview />
    </>
  );
};

export default AddPRRequestPage;