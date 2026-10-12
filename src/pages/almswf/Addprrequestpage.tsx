import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Save, Send, X, CheckCircle,
  ChevronLeft, Paperclip, FileText, Printer,
  Receipt, Percent, Columns3, Search, List, ChevronUp, ChevronDown, Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import type { TPRHeader, TPRItem } from "./PurchaseSummary-types";
import { almsCommonSelect, almsSavePrequestBulk } from "../../api/alms";
import { openPRPurchaseReport } from "../../api/transactions";
import { useToast } from "../../components/ui/AlertToast";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
// SMALL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
function fmt3(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function num(v: unknown) { return Number(v) || 0; }
function newId() { return `${Date.now()}_${Math.random().toString(36).slice(2)}`; }

// ═══════════════════════════════════════════════════════════════════════════
// PRESENTATION HELPERS (same structure as the PO page)
// ═══════════════════════════════════════════════════════════════════════════
function HeaderBlock({
  label,
  icon,
  children,
  gridCols = "grid-cols-4",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  gridCols?: string;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-slate-300 bg-card">
      <div className="flex items-center gap-2 border-b border-slate-300 bg-slate-100 px-2 py-1">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#00378C] text-white">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">{label}</span>
      </div>
      <div className={`grid gap-x-1 gap-y-1 px-2.5 py-1.5 ${gridCols} max-md:grid-cols-1`}>
        {children}
      </div>
    </div>
  );
}

function CField({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${className || ""}`}>
      <span className="text-[10px] font-semibold">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS HELPERS (unchanged)
// ═══════════════════════════════════════════════════════════════════════════
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

function amountBeforeDisc(item: TPRItem): number {
  return num(item.ITEM_RATE) * computeQuantity(item);
}
function itemDiscPrice(item: TPRItem): number {
  return amountBeforeDisc(item) * (num(item.DISCOUNT_AMOUNT) / 100);
}
function itemFinalRate(item: TPRItem): number {
  const qty = computeQuantity(item);
  if (qty === 0) return num(item.ITEM_RATE);
  return num(item.ITEM_RATE) - (itemDiscPrice(item) / qty);
}
function itemAmount(item: TPRItem): number { return itemFinalRate(item) * computeQuantity(item); }
function itemNetAmount(item: TPRItem): number { return itemAmount(item); }
function itemTaxAmount(item: TPRItem): number {
  return itemNetAmount(item) * (num(item.TX_COMPNT_PERC_1) / 100);
}
function itemLcurrAmount(item: TPRItem, exRate: number): number {
  return itemAmount(item) * (exRate || 1);
}
function itemTaxLcurrAmount(item: TPRItem, exRate: number): number {
  return itemTaxAmount(item) * (exRate || 1);
}
function itemLcurrAfterDisc(item: TPRItem, exRate: number): number {
  return itemLcurrAmount(item, exRate) + itemTaxLcurrAmount(item, exRate);
}

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

  item.FINAL_RATE = finalRate;
  item.AMOUNT = amount;
  item.TX_COMPNT_AMT_1 = taxAmt;
  (item as any).LCURR_AMT = lcurrAmt;
  (item as any).TX_COMPNT_LCURAMT_1 = taxLcurr;
  (item as any).LCURR_AFTER_DISCOUNT = lcurrAfterDisc;
  (item as any).BASE_AMOUNT = lcurrAmt;
  (item as any).FINAL_AMOUNT = lcurrAmt + taxLcurr;
  (item as any).AMOUNT_BEFORE_DISC = amtBeforeDisc;
  (item as any).DISC_PRICE = discPrice;
  (item as any).QUANTITY = qty;
  (item as any).ITEM_QTY = qty;
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

  item.FINAL_RATE = finalRate;
  item.AMOUNT = amount;
  item.TX_COMPNT_AMT_1 = taxAmt;
  (item as any).LCURR_AMT = lcurrAmt;
  (item as any).TX_COMPNT_LCURAMT_1 = taxLcurr;
  (item as any).LCURR_AFTER_DISCOUNT = lcurrAfterDisc;
  (item as any).BASE_AMOUNT = lcurrAmt;
  (item as any).FINAL_AMOUNT = lcurrAmt + taxLcurr;
  (item as any).AMOUNT_BEFORE_DISC = amtBeforeDisc;
  (item as any).DISC_PRICE = discPrice;
  (item as any).QUANTITY = approvedQty;
  (item as any).ITEM_QTY = approvedQty;
  (item as any).ALLOCATED_APPROVED_QUANTITY = approvedQty;
  (item as any).REQUEST_QUANTITY = requestedQty;
  return item;
}

function calculateTotalUnitPrice(items: TPRItem[]): number {
  return items.reduce((total, item) => total + (num(item.ITEM_RATE) * computeQuantity(item)), 0);
}
function calculateAmountBeforeDisc(items: TPRItem[]): number {
  return items.reduce((total, item) => total + (num(item.ITEM_RATE) * computeQuantity(item)), 0);
}

function distributeDiscountToItems(items: TPRItem[], discPercent: number, userApprovalLevel: number): TPRItem[] {
  const totalUnitPrice = calculateTotalUnitPrice(items);
  if (totalUnitPrice === 0 || discPercent === 0) {
    return items.map((item) => {
      const updated = { ...item, DISCOUNT_AMOUNT: 0 };
      const exRate = num(updated.CURRENCY_RATE) || 1;
      return userApprovalLevel >= 2
        ? recalcItemOnApprovedQty(updated, exRate)
        : recalcItem(updated, exRate);
    });
  }
  return items.map((item) => {
    const itemQtyVal = computeQuantity(item);
    const unitPrice = num(item.ITEM_RATE);
    const itemTotal = unitPrice * itemQtyVal;
    const itemDiscPercent = (itemTotal / totalUnitPrice) * discPercent;
    const updated = { ...item, DISCOUNT_AMOUNT: itemDiscPercent };
    const exRate = num(updated.CURRENCY_RATE) || 1;
    return userApprovalLevel >= 2
      ? recalcItemOnApprovedQty(updated, exRate)
      : recalcItem(updated, exRate);
  });
}

function distributeDiscountFromAmount(items: TPRItem[], discAmount: number, userApprovalLevel: number): TPRItem[] {
  const totalUnitPrice = calculateTotalUnitPrice(items);
  if (totalUnitPrice === 0 || discAmount === 0) {
    return items.map((item) => {
      const updated = { ...item, DISCOUNT_AMOUNT: 0 };
      const exRate = num(updated.CURRENCY_RATE) || 1;
      return userApprovalLevel >= 2
        ? recalcItemOnApprovedQty(updated, exRate)
        : recalcItem(updated, exRate);
    });
  }
  return items.map((item) => {
    const itemQtyVal = computeQuantity(item);
    const unitPrice = num(item.ITEM_RATE);
    const itemTotal = unitPrice * itemQtyVal;
    const itemDiscAmount = (itemTotal / totalUnitPrice) * discAmount;
    const itemDiscPercent = (itemDiscAmount / itemTotal) * 100;
    const updated = { ...item, DISCOUNT_AMOUNT: itemDiscPercent };
    const exRate = num(updated.CURRENCY_RATE) || 1;
    return userApprovalLevel >= 2
      ? recalcItemOnApprovedQty(updated, exRate)
      : recalcItem(updated, exRate);
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
    CAPEX_OPEX_NON_OPEX: "", USER_DT: null, USER_ID: "",
    SUPPLIER_CODE: "", SUPPLIER_NAME: "", CASH_IND: "",
    P_UOM: "", QTY_PUOM: 0, L_UOM: "", QTY_LUOM: 0, UPPP: 0,
    QUANTITY: 0, AMOUNT_BEFORE_DISC: 0, DISC_PRICE: 0,
    APPROVED_QTY_PUOM: 0, APPROVED_QTY_LUOM: 0, APPROVED_UPPP: 0,
  } as TPRItem;
}

function validatePRForm(header: Partial<TPRHeader>, items: TPRItem[], terms: any[], userLevel: number) {
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
      if (userLevel >= 6 && !item.SUPPLIER) errors.push(`Item ${index + 1}: Supplier is required`);
      if (userLevel === 1 && computeQuantity(item) <= 0) errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      if (num(item.ITEM_RATE) <= 0) errors.push(`Item ${index + 1}: Rate must be greater than 0`);
    });
  }
  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const AddPRRequestPage = ({
  isEditMode,
  isViewMode = false,
  existingData,
  flowCode,
  flowDescription,
  docType = "PR",
  docNo,
  onClose,
}: AddPRRequestPageProps) => {
  const { user } = useAuth();
  const companyCode = String(user?.company_code ?? "").trim();
  const loginid = String(user?.loginid ?? "").trim();
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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [selectedSendBackTo, setSelectedSendBackTo] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "terms">("items");
  const [terms, setTerms] = useState<any[]>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Lines card UI state (same as PO lines table)
  const [lineSearch, setLineSearch] = useState("");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(true);

  const [userApprovalLevel, setUserApprovalLevel] = useState<number>(0);
  const [displayDate, setDisplayDate] = useState("");
  const isInitialized = useRef(false);
  const itemsLoadedRef = useRef(false);
  const lastLoadedRequestRef = useRef<string | undefined>(undefined);
  const headerLoadedRef = useRef<string | null>(null);
  const autoAddedSuppliersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (lastLoadedRequestRef.current !== requestNumber) {
      itemsLoadedRef.current = false;
      lastLoadedRequestRef.current = requestNumber;
    }
  }, [requestNumber]);

  const isFinalApproved = String((header as any).FINAL_APPROVED || "").toUpperCase() === "Y";
  const effectiveViewMode = isFinalApproved || (isViewMode && !isEditMode);
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

  useEffect(() => {
    if (!isEditMode && !isViewMode) { setUserApprovalLevel(1); return; }
    const fetchUserLevel = async () => {
      if (!user?.loginid || !companyCode || !header.FLOW_CODE) return;
      try {
        const result = await almsCommonSelect({
          parameter: "PS_PREQUEST_ENTRY_GET_USER_LEVEL",
          loginid, code1: companyCode, code2: header.FLOW_CODE || "",
          code3: user?.loginid || "", code4: "",
        });
        if (result && result.length > 0) {
          setUserApprovalLevel(Number(result[0].FLOW_LEVEL) || 0);
        } else {
          setUserApprovalLevel(Number(header.FLOW_LEVEL_RUNNING) || 0);
        }
      } catch {
        setUserApprovalLevel(Number(header.FLOW_LEVEL_RUNNING) || 0);
      }
    };
    fetchUserLevel();
  }, [user, companyCode, header.FLOW_CODE, header.FLOW_LEVEL_RUNNING, isEditMode, isViewMode]);

  const shouldShowSupplier = () => userApprovalLevel >= 6;
  const shouldShowApprovedQty = () => userApprovalLevel >= 2;
  const shouldShowTermsTab = () => userApprovalLevel >= 6 || (header as any).FINAL_APPROVED === "Y";

  // ─── Lookups ───
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

  const { data: hdrList = [], isFetching: hdrFetching } = useQuery<TPRHeader[]>({
    queryKey: ["pr-header", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRHeader>({ parameter: "PS_PREQUEST_ENTRY_HEADER_PAGE", loginid, code1: companyCode, code2: "PR", code3: requestNumber || "", code4: "" }),
    enabled: (isEditMode || isViewMode) && !!requestNumber,
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
  });
  const { data: itemList = [], isFetching: itemsFetching } = useQuery<TPRItem[]>({
    queryKey: ["pr-item-list", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRItem>({ parameter: "PS_PREQUEST_ENTRY_DETAIL_PAGE", loginid, code1: companyCode, code2: "PR", code3: requestNumber || "", code4: "" }),
    enabled: (isEditMode || isViewMode) && !!requestNumber,
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
  });
  const { data: termsList = [] } = useQuery<any[]>({
    queryKey: ["pr-terms", requestNumber, companyCode],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TERMS", loginid, code1: companyCode, code2: requestNumber || "", code3: "", code4: "" }),
    enabled: (isEditMode || isViewMode) && !!requestNumber && shouldShowTermsTab(),
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
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
      setHeader((prev) => ({
        ...prev, ...h,
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
      const base: TPRItem = {
        ...row,
        id: (row as any).id || newId(),
        ITEM_DESP: row.ITEM_DESP || productCodes.find((i) => i.PROD_CODE === row.ITEM_CODE)?.PROD_NAME || "",
        COST_NAME: row.COST_NAME || costCodes.find((c) => c.COST_CODE === row.COST_CODE)?.COST_NAME || "",
        SUPPLIER_NAME: (row as any).SUPPLIER_NAME || supplierList.find((s) => s.SUPPLIER_CODE === row.SUPPLIER)?.SUPPLIER_NAME || "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userApprovalLevel]);

  useEffect(() => {
    if (termsList.length === 0) { if (isViewMode && requestNumber) setTerms([]); return; }
    const enriched = termsList.map((row: any) => ({
      ...row, id: row.id || newId(),
      SUPPLIER_NAME: row.SUPPLIER_NAME || supplierList.find((s) => s.SUPPLIER_CODE === row.SUPPLIER)?.SUPPLIER_NAME || "",
    }));
    setTerms(enriched);
  }, [termsList, supplierList, isViewMode, requestNumber]);

  useEffect(() => {
    if (userApprovalLevel < 6) return;
    if (items.length === 0) return;
    const itemSuppliers = new Set<string>();
    items.forEach((it) => { const s = String(it.SUPPLIER || "").trim(); if (s) itemSuppliers.add(s); });
    setTerms((prev) => {
      const termSuppliers = new Set(prev.map((t) => String(t.SUPPLIER || "").trim()).filter(Boolean));
      let next = [...prev];
      let changed = false;
      itemSuppliers.forEach((sup) => {
        if (!termSuppliers.has(sup)) {
          const itm = items.find((it) => String(it.SUPPLIER || "").trim() === sup);
          const supName = (itm as any)?.SUPPLIER_NAME || supplierList.find((s: any) => s.SUPPLIER_CODE === sup)?.SUPPLIER_NAME || "";
          next.push({ id: newId(), COMPANY_CODE: companyCode, SUPPLIER: sup, SUPPLIER_NAME: supName, DLVR_TERM: "", PAYMENT_TERMS: "", WARRANTY: "", REMARKS: "", USER_ID: "", USER_DT: null });
          autoAddedSuppliersRef.current.add(sup);
          changed = true;
        }
      });
      const toRemove = new Set<string>();
      autoAddedSuppliersRef.current.forEach((sup) => { if (!itemSuppliers.has(sup)) toRemove.add(sup); });
      if (toRemove.size > 0) {
        const filtered = next.filter((t) => {
          const sup = String(t.SUPPLIER || "").trim();
          return !(toRemove.has(sup) && autoAddedSuppliersRef.current.has(sup));
        });
        if (filtered.length !== next.length) { next = filtered; changed = true; }
        toRemove.forEach((sup) => autoAddedSuppliersRef.current.delete(sup));
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, userApprovalLevel, supplierList]);

  const setHdr = (field: keyof TPRHeader, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  const totalAmount = items.reduce((s, r) => s + num(r.AMOUNT), 0);
  const totalTax = items.reduce((s, r) => s + num(r.TX_COMPNT_AMT_1), 0);
  const totalBase = items.reduce((s, r) => s + num(r.BASE_AMOUNT), 0);
  const totalFinalAmount = items.reduce((s, r) => s + num(r.FINAL_AMOUNT), 0);
  const totalAmountBeforeDisc = calculateAmountBeforeDisc(items);

  const isApprovedLevel = userApprovalLevel >= 2;
  const totalQtyPuom = items.reduce((sum, i) => sum + (isApprovedLevel ? num((i as any).APPROVED_QTY_PUOM) : num(i.QTY_PUOM)), 0);
  const totalQtyLuom = items.reduce((sum, i) => sum + (isApprovedLevel ? num((i as any).APPROVED_QTY_LUOM) : num(i.QTY_LUOM)), 0);

  const [discountScope, setDiscountScope] = useState<"ITEM" | "PO">("ITEM");

  const totalDiscAmount = items.reduce((sum, item) =>
    sum + (num(item.ITEM_RATE) * num(item.DISCOUNT_AMOUNT) / 100 * computeQuantity(item)), 0);

  // Line search (same behaviour as PO lines table)
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

  // Column widths for the items table — compact vs all columns
  const colWidths = useMemo(() => {
    const qtyGroup = [60, 60, 60, ...(showAllColumns ? [60] : []), 70];
    const w: number[] = [30, 270, 60, ...qtyGroup, ...qtyGroup];
    if (userApprovalLevel >= 6) w.push(300);
    w.push(80, 90, 65, 75, 80, 90, 95);
    if (showAllColumns) w.push(75, 60, 80, 210, 210, 85, 95);
    w.push(44);
    return w;
  }, [showAllColumns, userApprovalLevel]);
  const tableMinWidth = colWidths.reduce((a, b) => a + b, 0);
  const itemsColSpan = colWidths.length;
  const qtyColSpan = showAllColumns ? 5 : 4;

  const calculateDiscountFromAmount = (type: "amount" | "percent") => {
    if (items.length === 0) { toast.warning("Please add items first", 4000); return; }
    if (type === "amount") {
      const d = num(header.DISC_AMOUNT);
      if (d <= 0) { toast.warning("Please enter a discount amount first", 4000); return; }
      setItems(distributeDiscountFromAmount(items, d, userApprovalLevel));
      const t = calculateTotalUnitPrice(items);
      if (t > 0) setHdr("DISCOUNT_AMOUNT", (d / t) * 100);
    } else {
      const p = num(header.DISCOUNT_AMOUNT);
      if (p <= 0) { toast.warning("Please enter a discount percentage first", 4000); return; }
      setItems(distributeDiscountToItems(items, p, userApprovalLevel));
      const t = calculateTotalUnitPrice(items);
      if (t > 0) setHdr("DISC_AMOUNT", (p / 100) * t);
    }
  };

  const validateAndShowErrors = (): boolean => {
    const { valid, errors } = validatePRForm(header, items, terms, userApprovalLevel);
    if (!valid) { toast.error(errors[0], 5000); setNotice({ type: "error", message: errors.join(". ") }); return false; }
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
      TX_COMPNT_1_EXPMT: "", REMARKS_HISTRY: "", CURR_CODE: header.CURR_CODE || "",
      CREATE_USER: isEditMode ? (header.CREATE_USER || loginid) : loginid,
      CREATE_DATE: isEditMode ? ((header as any).CREATE_DATE || new Date().toISOString()) : new Date().toISOString(),
      LAST_UPDATED: loginid, LAST_ACTION: status, HISTORY_SERIAL: 0,
      ATTACH_FILE_NAME: "", ATTACH_FILE_NAME1: "", ATTACH_FILE_NAME2: "",
      REJECT_HISTRY: "", SENDBACK_HISTRY: "", REQ_DOC_NO: 0, REQ_DIV_CODE: "",
      COST_CODE: "", PO_AMOUNT: 0, DOC_DATE: new Date().toISOString(),
      CANCEL_FLAG: "", CANCEL_DATE: null, CANCEL_USER: "", MOBILE_APP_UPDATE: "",
      FA_USER: "", HOD_USER: "", MAIL_CC: "", WARRANTY: "", PO_CREATOR: "", REQUEST_HOD_USER: "",
      CANCEL_REMARK: "", PDO_TYPE: header.PDO_TYPE || "N", TYPE_OF_CONTRACT: "",
      AC_CODE: "", AC_NAME: "", COUNTRY_CODE: "", TERRITORY_CODE: "",
      ADDRESS_1: "", ADDRESS_2: "", ADDRESS_3: "", PHONE: "", FAX: "", E_MAIL: "",
      CONTACT_PERSON: "", MOBILE_NO: "", AC_TYPE: "", AC_ACTIVE: "",
      CREDIT_PERIOD: 0, CREDIT_AMOUNT: 0,
      BANK_AC_CODE: "", BANK_NAME: "", BANK_SWIFT: "", IBAN_NO: "", BANK_AC_NAME: "",
      TAX_REGISTRD: "", TAX_COUNTRY_CODE: "", TRN_NO: "", CR_NO: "", RCM_APPLY: "",
      SECTOR_CODE: "", CITY_NAME: "", EXP_TYPE_CODE: "", PL_BL_CODE: "", DEPT_CODE: "",
      AC_STATUS: "", AC_INFZE: "", BI_MAIN_GROUP: "", BI_SUB_GROUP: "", BI_EXP_TYPE: "",
      BI_PL_BS_IND: "", BI_DEPT: "", CREATED_BY: "", UPDATED_BY: "",
      NEXT_ACTION_BY: overrides.NEXT_ACTION_BY ?? "",
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
      COST_CODE: item.COST_CODE || "", CAPEX: item.CAPEX_OPEX_NON_OPEX || "",
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

    const cleanedHeader = cleanNumericData(headerData);
    const cleanedDetails = cleanNumericData(detailsData);
    const cleanedTerms = cleanNumericData(termsData);

    const result = await almsSavePrequestBulk({
      header: cleanedHeader, details: cleanedDetails, terms: cleanedTerms,
    });
    return result;
  };

  const [savingAction, setSavingAction] = useState<string | null>(null);

  const refreshPrCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["pr-header"] });
    queryClient.invalidateQueries({ queryKey: ["pr-item-list"] });
    queryClient.invalidateQueries({ queryKey: ["pr-terms"] });
  };

  const runAction = async (status: string, successMsg: string, remark = "", overrides: Partial<Record<string, any>> = {}) => {
    if (saving) return;
    if (status !== "SAVEASDRAFT") { if (!validateAndShowErrors()) return; }
    setSavingAction(status);
    setNotice(null);
    try {
      const result = await saveBulk(status, remark, overrides);
      if (!result.success) throw new Error(result.message || "Failed to save");
      refreshPrCaches();
      toast.success(successMsg, 4000);
      setSavingAction(null);
      onClose(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed", 5000);
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Action failed" });
      setSavingAction(null);
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

  const handlePrint = () => {
    if (!requestNumber) { toast.warning("Please save the request before printing.", 4000); return; }
    openPRPurchaseReport({ parameter: "PS_PREQUEST_ENTRY_PRReport", loginid, code1: companyCode, code2: requestNumber });
  };

  const handleApprove = async () => {
    if (!requestNumber) { toast.error("No PR to approve", 5000); return; }
    if (!validateAndShowErrors()) return;
    setSaving(true); setNotice(null);
    try {
      const cur = Number(header.FLOW_LEVEL_RUNNING) || 1;
      const fin = Number(header.FLOW_LEVEL_FINAL) || 1;
      const next = cur + 1;
      const isFinal = next >= fin ? "Y" : "N";
      const result = await saveBulk("APPROVED", "", { FLOW_LEVEL_RUNNING: next, FINAL_APPROVED: isFinal });
      if (!result.success) throw new Error(result.message || "Failed to approve");
      refreshPrCaches();
      toast.success("PR approved successfully!", 4000);
      onClose(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve", 5000);
    } finally { setSaving(false); }
  };

  const { data: sendBackTargets = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-sendback-targets", requestNumber, companyCode, header.FLOW_LEVEL_RUNNING],
    queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_SENDBACK_TARGETS", loginid, code1: companyCode, code2: requestNumber || "", code3: String(header.FLOW_LEVEL_RUNNING || 0), code4: "" }),
    enabled: sendBackOpen && !!requestNumber,
  });

  const sendBackOptions = useMemo(() => {
    const opts: { loginid: string; label: string; level: number }[] = [];
    if (header.USER_ID) {
      const name = (header as any).CREATE_USER_NAME || "";
      opts.push({ loginid: String(header.USER_ID), label: name || String(header.USER_ID), level: 0 });
    }
    const seen = new Set(opts.map((o) => o.loginid));
    sendBackTargets.forEach((row: any) => {
      const lg = String(row.loginid ?? row.LOGINID ?? "");
      const emp = String(row.emp_name ?? row.EMP_NAME ?? "").trim();
      const lvl = Number(row.flow_level_running ?? row.FLOW_LEVEL_RUNNING ?? 0) || 0;
      if (lg && !seen.has(lg) && lg !== loginid) { seen.add(lg); opts.push({ loginid: lg, label: emp || lg, level: lvl }); }
    });
    return opts;
  }, [header.USER_ID, sendBackTargets, loginid]);

  const handleSendBackConfirm = async () => {
    if (!selectedSendBackTo) { toast.warning("Please select who to send this back to", 4000); return; }
    if (!remarkText.trim()) { toast.warning("Please enter a send back reason", 4000); return; }
    const target = sendBackOptions.find((o) => o.loginid === selectedSendBackTo);
    await runAction("SENDBACK", "PR sent back successfully!", remarkText, {
      FLOW_LEVEL_RUNNING: target?.level ?? 0, NEXT_ACTION_BY: selectedSendBackTo,
    });
    setSendBackOpen(false); setRemarkText(""); setSelectedSendBackTo("");
  };

  const handleRejectConfirm = async () => {
    if (!remarkText.trim()) { toast.warning("Please enter a rejection reason", 4000); return; }
    if (!validateAndShowErrors()) return;
    setRejectOpen(false);
    const reason = remarkText;
    await runAction("REJECTED", "PR rejected successfully!", reason, { NEXT_ACTION_BY: loginid });
    setRemarkText("");
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
    (blank as any).id = newId();
    setItems([...items, blank]);
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
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

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

  const blankTerm = () => ({
    id: newId(), COMPANY_CODE: companyCode, SUPPLIER: "", SUPPLIER_NAME: "",
    DLVR_TERM: "", PAYMENT_TERMS: "", WARRANTY: "", REMARKS: "", USER_ID: "", USER_DT: null,
  });
  const addTermLine = () => setTerms((prev) => [...prev, blankTerm()]);
  const removeTerm = (id: string) => {
    setTerms((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t) { const sup = String(t.SUPPLIER || "").trim(); if (sup) autoAddedSuppliersRef.current.delete(sup); }
      return prev.filter((x) => x.id !== id);
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

  const canEditRequested = !disabled && userApprovalLevel < 2;
  const canEditApproved = !disabled && userApprovalLevel >= 2;

  const resetDiscountItems = () =>
    setItems((prev) => prev.map((item) => {
      const u = { ...item, DISCOUNT_AMOUNT: 0 };
      const exRate = num(u.CURRENCY_RATE) || 1;
      return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(u, exRate) : recalcItem(u, exRate);
    }));

  const tabBtn = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-2 border-b-2 pb-0.5 text-xs font-bold uppercase tracking-wide transition-colors ${active
      ? (shouldShowTermsTab() ? "border-[#00378C] text-slate-900" : "border-transparent text-slate-900")
      : "border-transparent text-slate-400 hover:text-slate-700"}`;
  const tabCount =
    "rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#00378C]";

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full bg-background">
      <style>{`
        .commercial-lines-scroll { scrollbar-width: auto; scrollbar-color: #94a3b8 #e2e8f0; }
        .commercial-lines-scroll::-webkit-scrollbar { height: 16px; width: 16px; }
        .commercial-lines-scroll::-webkit-scrollbar-track { background: #e2e8f0; }
        .commercial-lines-scroll::-webkit-scrollbar-thumb {
          background-color: #94a3b8; border-radius: 8px; border: 3px solid #e2e8f0;
        }
        .commercial-lines-scroll::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
        .commercial-lines-scroll::-webkit-scrollbar-corner { background: #e2e8f0; }
        .finance-lines-table td, .finance-lines-table th { overflow: hidden; }
        .finance-lines-table td > * { max-width: 100%; }
      `}</style>

      {/* ═══════════════ FULL PAGE WRAPPER (sidebar visible) ═══════════════ */}
      <section
        className="payment-workbench commercial-editor m-1.5 flex flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm"
        style={{ height: "calc(100vh - 68px)", maxHeight: "calc(100vh - 68px)" }}
      >
        {/* ═══════════════ TOP BAR ═══════════════ */}
        <CardHeader className="flex-none border-b bg-[#00378C] px-4 py-2.5 text-white shadow-sm">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => onClose()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 hover:bg-white/20"
                title="Back"
              >
                <ChevronLeft size={16} />
              </button>
              <FileText size={16} />
              <h2 className="m-0 text-sm font-bold leading-tight text-white">
                {docType !== "PR" ? "Purchase Order" : "Purchase Request"}
              </h2>
              <span className="rounded-md border border-amber-300 bg-orange-500 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-slate-900">
                DOC NO - {docType !== "PR" ? (docNo || "NEW") : (requestNumber || "NEW")}
              </span>
              <span className="rounded-md border border-white/25 bg-[#002a6b] px-2.5 py-1 text-xs font-bold tracking-wide text-white">
                <span className="mr-1.5 text-[10px] font-bold">DATE</span><span className="text-sm font-bold">{displayDate || "--"}</span>
              </span>
              <span className="rounded-md border border-emerald-500/50 bg-[#04283a] px-2.5 py-1 text-xs font-bold tracking-wide text-white">
                <span className="mr-1.5 text-[10px] font-bold">TOTAL</span><span className="text-sm font-bold">{fmt3(totalAmount)}</span>
              </span>
              {/* <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/90">
                FLOW {header.FLOW_CODE || "—"}
              </span> */}
              <button
                type="button"
                onClick={() => setHeaderOpen((v) => !v)}
                className="inline-flex h-8 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/10 hover:bg-white/20"
                title={headerOpen ? "Hide header" : "Show header"}
              >
                {headerOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {(header as any).purch_status && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/90">
                  {(header as any).purch_status}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={() => setAttachmentOpen(true)}>
                <Paperclip size={14} className="text-[#00378C]" /> Files
              </Button>
              {!effectiveViewMode && !(docType !== "PR") && (
                <>
                  <Button disabled={saving} type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={handleSaveDraft}>
                    <Save size={14} className="text-[#00378C]" /> {savingAction === "SAVEASDRAFT" ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button disabled={saving} type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={handleSubmit}>
                    <Send size={14} className="text-[#00378C]" /> {savingAction === "SUBMITTED" ? "Submitting..." : "Submit"}
                  </Button>
                </>
              )}
              {!effectiveViewMode && userApprovalLevel >= 2 && userApprovalLevel <= 6 && (
                <>
                  <Button disabled={saving} type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={() => { setRemarkText(""); setSendBackOpen(true); }}>
                    <ChevronLeft size={14} className="text-purple-600" /> Send Back
                  </Button>
                  <Button disabled={saving} type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={() => { setRemarkText(""); setRejectOpen(true); }}>
                    <X size={14} className="text-red-600" /> Reject
                  </Button>
                </>
              )}
              {!effectiveViewMode && userApprovalLevel === 7 && (
                <>
                  <Button disabled={saving} type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={handleApprove}>
                    <CheckCircle size={14} className="text-emerald-600" /> {savingAction === "APPROVED" ? "Approving..." : "Approve"}
                  </Button>
                  <Button disabled={saving} type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={() => { setRemarkText(""); setSendBackOpen(true); }}>
                    <ChevronLeft size={14} className="text-purple-600" /> Send Back
                  </Button>
                  <Button disabled={saving} type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={() => { setRemarkText(""); setRejectOpen(true); }}>
                    <X size={14} className="text-red-600" /> Reject
                  </Button>
                </>
              )}
              <Button type="button" size="sm" className="h-8 rounded-lg border border-slate-200 !bg-white px-3 text-xs font-semibold !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={handlePrint}>
                <Printer size={14} className="text-[#00378C]" /> Print
              </Button>
              <Button aria-label="Close" type="button" size="icon" variant="secondary" className="h-8 w-8 rounded-lg border border-slate-200 !bg-white !px-0 !text-slate-800 shadow-sm hover:!bg-slate-50" onClick={() => onClose()}>
                <X size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* ═══════════════ SCROLLABLE CONTENT ═══════════════ */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">
              Loading document...
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

              {/* ═══════════ HEADER (same 2-column layout as PO) ═══════════ */}
              {headerOpen && (
              <div className="flex-none rounded-md border-2 border-gray-100 bg-card overflow-hidden">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 p-2 items-start">

                  {/* ── LEFT COLUMN ── */}
                  <div className="flex flex-col gap-2">
                    <HeaderBlock label="Description & Remarks" icon={<FileText size={11} />} gridCols="grid-cols-2">
                      <CField label="Description / Reason" required>
                        <textarea
                          disabled={disabled}
                          value={String(header.DESCRIPTION || "")}
                          onChange={(e) => {
                            setHdr("DESCRIPTION", e.target.value);
                            const t = e.target; t.style.height = "auto"; t.style.height = t.scrollHeight + "px";
                          }}
                          className="w-full rounded-md border bg-background px-2 py-1 text-xs resize-none overflow-hidden min-h-[52px]"
                          placeholder="Enter description or reason..."
                          rows={2}
                        />
                      </CField>
                      <CField label="Remarks" required>
                        <textarea
                          disabled={disabled}
                          value={String(header.REMARKS || "")}
                          onChange={(e) => {
                            setHdr("REMARKS", e.target.value);
                            const t = e.target; t.style.height = "auto"; t.style.height = t.scrollHeight + "px";
                          }}
                          className="w-full rounded-md border bg-background px-2 py-1 text-xs resize-none overflow-hidden min-h-[52px]"
                          placeholder="Enter remarks..."
                          rows={2}
                        />
                      </CField>
                    </HeaderBlock>

                    <HeaderBlock label="Discount Scope & Delivery Terms" icon={<Percent size={11} />} gridCols="grid-cols-4">
                      <div className="col-span-4 flex items-center gap-6 border-b border-gray-100 pb-1 mb-0.5">
                        <span className="text-[9px] font-semibold text-foreground/75">Discount Applied To:</span>
                        <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                          <input
                            type="radio" name="discount_scope" value="PO"
                            checked={discountScope === "PO"}
                            disabled={disabled || items.length === 0}
                            onChange={() => {
                              setDiscountScope("PO");
                              resetDiscountItems();
                              setHdr("DISCOUNT_AMOUNT", 0); setHdr("DISC_AMOUNT", 0);
                            }}
                          />
                          Entire PR
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                          <input
                            type="radio" name="discount_scope" value="ITEM"
                            checked={discountScope === "ITEM"}
                            disabled={disabled || items.length === 0}
                            onChange={() => {
                              setDiscountScope("ITEM");
                              setHdr("DISCOUNT_AMOUNT", 0); setHdr("DISC_AMOUNT", 0);
                            }}
                          />
                          Individual Items
                        </label>
                      </div>

                      <CField label="Disc Amt">
                        <Input
                          className="h-7 text-right text-xs" type="number" step="0.01"
                          disabled={disabled || items.length === 0 || discountScope === "ITEM"}
                          value={discountScope === "ITEM" ? totalDiscAmount.toFixed(3) : num(header.DISC_AMOUNT).toFixed(3)}
                          onChange={(e) => {
                            const a = Number(e.target.value) || 0;
                            setHdr("DISC_AMOUNT", a);
                            if (a > 0 && discountScope === "PO") {
                              setHdr("DISCOUNT_AMOUNT", 0);
                              setItems(distributeDiscountFromAmount(items, a, userApprovalLevel));
                              const t = calculateTotalUnitPrice(items);
                              if (t > 0) setHdr("DISCOUNT_AMOUNT", (a / t) * 100);
                            } else if (a === 0 && discountScope === "PO") {
                              resetDiscountItems();
                              setHdr("DISCOUNT_AMOUNT", 0);
                            }
                          }}
                        />
                      </CField>
                      <CField label="Disc %">
                        <Input
                          className="h-7 text-right text-xs" type="number" step="0.001"
                          disabled={disabled || items.length === 0 || discountScope === "ITEM"}
                          value={
                            discountScope === "ITEM"
                              ? (calculateTotalUnitPrice(items) > 0 ? ((totalDiscAmount / calculateTotalUnitPrice(items)) * 100).toFixed(3) : "0.000")
                              : num(header.DISCOUNT_AMOUNT).toFixed(3)
                          }
                          onChange={(e) => {
                            const p = Number(e.target.value) || 0;
                            setHdr("DISCOUNT_AMOUNT", p);
                            if (p > 0 && discountScope === "PO") {
                              setHdr("DISC_AMOUNT", 0);
                              setItems(distributeDiscountToItems(items, p, userApprovalLevel));
                              const t = calculateTotalUnitPrice(items);
                              if (t > 0) setHdr("DISC_AMOUNT", (p / 100) * t);
                            } else if (p === 0 && discountScope === "PO") {
                              resetDiscountItems();
                              setHdr("DISC_AMOUNT", 0);
                            }
                          }}
                        />
                      </CField>

                      {discountScope === "PO" ? (
                        <div className="col-span-2 flex items-end gap-2">
                          {Number(header.DISC_AMOUNT) > 0 && (
                            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => calculateDiscountFromAmount("amount")} disabled={disabled || items.length === 0}>
                              Calculate From Amount
                            </Button>
                          )}
                          {Number(header.DISCOUNT_AMOUNT) > 0 && (
                            <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => calculateDiscountFromAmount("percent")} disabled={disabled || items.length === 0}>
                              Calculate From %
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="col-span-2" />
                      )}
                    </HeaderBlock>
                  </div>

                  {/* ── RIGHT COLUMN ── */}
                  <div className="flex flex-col gap-2">
                    <HeaderBlock label="Document Details" icon={<FileText size={11} />} gridCols="grid-cols-6">
                      <CField label="Doc No" className="col-span-2">
                        <Input disabled value={requestNumber || "New"} className="h-7 bg-muted/30 text-xs" />
                      </CField>
                      <CField label="Request Date" className="col-span-2">
                        <Input disabled type="text" value={displayDate} className="h-7 text-xs" />
                      </CField>
                      <CField label="POD Type" required className="col-span-2">
                        <Select
                          disabled={disabled}
                          value={header.PDO_TYPE || "N"}
                          onChange={(e) => setHdr("PDO_TYPE", e.target.value)}
                          className="h-7 text-xs"
                        >
                          <option value="P">PDO-OTO</option>
                          <option value="Q">PDO-NON-OTO</option>
                          <option value="N">NON-PDO</option>
                        </Select>
                      </CField>


                      <div className="col-span-4">
                        <LookupField
                          label="Currency *"
                          placeholder="Search Currency"
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
                      </div>
                      <CField label="Ex Rate" className="col-span-2">
                        <Input
                          className="h-7 w-full text-right text-xs" type="number" step="0.0001"
                          disabled={disabled}
                          value={header.CURRENCY_RATE ?? ""}
                          onChange={(e) => {
                            const r = Number(e.target.value);
                            setHdr("CURRENCY_RATE", r);
                            updateAllItemsWithHeader({ CURRENCY_RATE: r });
                          }}
                        />
                      </CField>
                    </HeaderBlock>

                    <HeaderBlock label="Tax Configuration" icon={<Receipt size={11} />} gridCols="grid-cols-3">
                      <CField label="Tax Type">
                        <Select
                          className="h-7 text-xs"
                          value={String(header.TAX_TYPE || "Std.")}
                          disabled={disabled}
                          onChange={(e) => {
                            const v = e.target.value;
                            const perc = v === "Std." ? 5 : 0;
                            setHdr("TAX_TYPE", v);
                            setItems((prev) => prev.map((item) => {
                              const m: TPRItem = { ...item, TAX_TYPE: v, TX_COMPNT_PERC_1: perc };
                              const ex = num(m.CURRENCY_RATE) || 1;
                              return userApprovalLevel >= 2 ? recalcItemOnApprovedQty(m, ex) : recalcItem(m, ex);
                            }));
                          }}
                        >
                          <option value="Std.">Std.</option>
                          <option value="Zero">Zero</option>
                          <option value="Exempt">Exempt</option>
                        </Select>
                      </CField>

                      <LookupField
                        label="Tax Category"
                        placeholder="Search Tax Category"
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

                      <LookupField
                        label="Tax Code"
                        placeholder="Search Tax Component"
                        value={header.TX_COMPNTCAT_CODE_1 || ""}
                        displayValue={
                          header.TX_COMPNTCAT_CODE_1 && (header as any).TX_COMPNTCAT_NAME
                            ? `${header.TX_COMPNTCAT_CODE_1} - ${(header as any).TX_COMPNTCAT_NAME}`
                            : header.TX_COMPNTCAT_CODE_1 || ""
                        }
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
                    </HeaderBlock>
                  </div>
                </div>
              </div>
              )}

              {/* ═══════════ LINES CARD (same as PO lines table) ═══════════ */}
              <div className="flex min-h-[300px] min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-gray-100 bg-card">
                {/* Actions bar */}
                <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b bg-white px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#00378C] text-white">
                      <List size={14} />
                    </span>
                    <button type="button" onClick={() => setActiveTab("items")} className={tabBtn(activeTab === "items")}>
                      <span>Details Items</span>
                      <span className={tabCount}>{items.length} {items.length === 1 ? "line" : "lines"}</span>
                    </button>
                    {shouldShowTermsTab() && (
                      <>
                        <span className="h-4 w-px bg-slate-300" />
                        <button type="button" onClick={() => setActiveTab("terms")} className={tabBtn(activeTab === "terms")}>
                          <span>Terms & Conditions</span>
                          <span className={tabCount}>{terms.length}</span>
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
                        <button
                          type="button"
                          onClick={() => setShowAllColumns(!showAllColumns)}
                          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all ${showAllColumns
                            ? "border-[#00378C]/40 bg-blue-50 text-[#00378C]"
                            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                          title={showAllColumns ? "Switch to Compact View" : "Show all columns including UPPP, Tax Type, Tax %, Tax Cat, Tax Code & Lcurr After Tax"}
                        >
                          <Columns3 size={13} className={showAllColumns ? "text-[#00378C]" : "text-slate-500"} />
                          <span>{showAllColumns ? "All Columns" : "Compact View"}</span>
                        </button>

                        <div className="relative flex h-8 w-64 items-center rounded-full border border-slate-300 bg-white pl-8 pr-7 transition-all duration-300 ease-out focus-within:w-96 focus-within:border-[#00378C] focus-within:ring-2 focus-within:ring-[#00378C]/20">
                          <Search size={13} className="absolute left-3 text-slate-400" />
                          <input
                            className="h-full w-full border-0 bg-transparent text-xs outline-none placeholder:text-slate-400"
                            type="text"
                            value={lineSearch}
                            onChange={(e) => setLineSearch(e.target.value)}
                            placeholder="Search lines..."
                          />
                          {lineSearch && (
                            <button type="button" onClick={() => setLineSearch("")} className="absolute right-2 text-slate-400 hover:text-slate-700" title="Clear">
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    {!effectiveViewMode && activeTab === "items" && (
                      <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={addItemLine} className="h-8 rounded-full px-3 text-xs">
                        <Plus size={14} /> Add Line
                      </Button>
                    )}
                    {!effectiveViewMode && activeTab === "terms" && shouldShowTermsTab() && (
                      <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={addTermLine} className="h-8 rounded-full px-3 text-xs">
                        <Plus size={14} /> Add Line
                      </Button>
                    )}
                  </div>
                </div>

                {/* ───────────── ITEMS TAB ───────────── */}
                {activeTab === "items" && (
                  <>
                    <div
                      ref={tableContainerRef}
                      className="commercial-lines-scroll min-h-0 flex-1 overflow-auto min-w-0"
                      style={{ overscrollBehavior: "contain" }}
                    >
                      <table
                        className="finance-lines-table w-full table-fixed text-[10px] border-separate border-spacing-0"
                        style={{ minWidth: tableMinWidth }}
                      >
                        <colgroup>
                          {colWidths.map((w, i) => <col key={i} style={{ width: `${w}px` }} />)}
                        </colgroup>
                        <thead className="sticky top-0 z-30 bg-[#00378C] text-[10px] font-semibold text-white shadow-sm">
                          <tr>
                            <th rowSpan={2} className="sticky left-0 z-40 bg-[#00378C] px-1 py-1.5 text-center align-middle border-r border-white/20">SNo</th>
                            <th rowSpan={2} className="sticky left-[30px] z-40 bg-[#00378C] px-1 py-1.5 text-center align-middle border-r border-white/20">Product Code</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">P Uom</th>
                            <th colSpan={qtyColSpan} className="px-1 py-1.5 text-center align-middle border-l-2 border-r-2 border-b-2 border-white/60">Requested Qty</th>
                            <th colSpan={qtyColSpan} className="px-1 py-1.5 text-center align-middle border-l-2 border-r-2 border-b-2 border-white/60">Approved Qty</th>
                            {shouldShowSupplier() && (
                              <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-l-2 border-r border-white/20 bg-[#00378C]">Supplier *</th>
                            )}
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-l-2 border-r border-white/20">Unit Price</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Amount Before Disc</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Disc %</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Disc Price</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Unit Price Net Amt</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Amount</th>
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Lcurr Amt Before Tax</th>
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Tax Type</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Tax %</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Tax Amount</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Tax Cat</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Tax Code</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Tax Lcurr Amount</th>}
                            {showAllColumns && <th rowSpan={2} className="px-1 py-1.5 text-center align-middle border-r border-white/20">Lcurr Amt After Tax</th>}
                            <th rowSpan={2} className="px-1 py-1.5 text-center align-middle">Action</th>
                          </tr>
                          <tr>
                            <th className="px-1 py-1.5 text-center align-middle border-l-2 border-r border-white/20">PQTY</th>
                            <th className="px-1 py-1.5 text-center align-middle border-r border-white/20">LUOM</th>
                            <th className="px-1 py-1.5 text-center align-middle border-r border-white/20">LQTY</th>
                            {showAllColumns && <th className="px-1 py-1.5 text-center align-middle border-r border-white/20">UPPP</th>}
                            <th className="px-1 py-1.5 text-center align-middle border-r-2 border-white/20">ReqQty</th>
                            <th className="px-1 py-1.5 text-center align-middle border-l-2 border-r border-white/20">PQTY</th>
                            <th className="px-1 py-1.5 text-center align-middle border-r border-white/20">LUOM</th>
                            <th className="px-1 py-1.5 text-center align-middle border-r border-white/20">LQTY</th>
                            {showAllColumns && <th className="px-1 py-1.5 text-center align-middle border-r border-white/20">UPPP</th>}
                            <th className="px-1 py-1.5 text-center align-middle border-r-2 border-white/20">ApprQty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr>
                              <td className="px-3 py-8 text-center text-muted-foreground" colSpan={itemsColSpan}>
                                No detail lines yet — click "Add Line" to get started
                              </td>
                            </tr>
                          ) : filteredItems.length === 0 ? (
                            <tr>
                              <td className="px-3 py-8 text-center text-muted-foreground" colSpan={itemsColSpan}>
                                No lines match "<strong>{lineSearch}</strong>"
                              </td>
                            </tr>
                          ) : filteredItems.map((item) => {
                            const itemId = (item as any).id || String(item.ITEM_SRNO);
                            const qty = computeQuantity(item);
                            const approvedQty = computeApprovedQuantity(item);
                            const amtBeforeDisc = num((item as any).AMOUNT_BEFORE_DISC) || amountBeforeDisc(item);
                            const discPrice = num((item as any).DISC_PRICE) || itemDiscPrice(item);
                            const finalRate = num(item.FINAL_RATE) || itemFinalRate(item);
                            const amount = num(item.AMOUNT) || itemAmount(item);
                            const taxAmt = num(item.TX_COMPNT_AMT_1) || itemTaxAmount(item);
                            const lcurrAmt = num((item as any).LCURR_AMT) || itemLcurrAmount(item, num(item.CURRENCY_RATE) || 1);
                            const taxLcurr = num((item as any).TX_COMPNT_LCURAMT_1) || itemTaxLcurrAmount(item, num(item.CURRENCY_RATE) || 1);
                            const lcurrAfterDisc = num((item as any).LCURR_AFTER_DISCOUNT) || itemLcurrAfterDisc(item, num(item.CURRENCY_RATE) || 1);
                            const productDisplay = item.ITEM_CODE && item.ITEM_DESP ? `${item.ITEM_CODE} - ${item.ITEM_DESP}` : (item.ITEM_CODE || "");
                            const supplierDisplay = item.SUPPLIER && (item as any).SUPPLIER_NAME ? `${item.SUPPLIER} - ${(item as any).SUPPLIER_NAME}` : (item.SUPPLIER || "");

                            return (
                              <tr className="border-t odd:bg-muted/20 hover:bg-muted/40" key={itemId}>
                                <td className="sticky left-0 z-20 bg-card px-1 py-1 text-center border-r border-border">{item.ITEM_SRNO}</td>
                                <td className="sticky left-[30px] z-20 bg-card px-1 py-1 border-r border-border">
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
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input disabled readOnly value={item.P_UOM || ""} className="h-7 w-full text-center text-[10px] px-1" />
                                </td>

                                {/* Requested qty */}
                                <td className="px-1 py-1 border-l-2 border-r border-border">
                                  <Input type="number" step="0.001" value={item.QTY_PUOM || ""}
                                    onChange={(e) => updateItemField(itemId, "QTY_PUOM", Number(e.target.value) || 0)}
                                    disabled={!canEditRequested}
                                    className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input disabled readOnly value={item.L_UOM || ""} className="h-7 w-full text-center text-[10px] px-1" />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input type="number" step="0.001" value={isSameUom(item) ? 0 : item.QTY_LUOM || ""}
                                    onChange={(e) => updateItemField(itemId, "QTY_LUOM", Number(e.target.value) || 0)}
                                    disabled={!canEditRequested || isSameUom(item)}
                                    className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                </td>
                                {showAllColumns && (
                                  <td className="px-1 py-1 border-r border-border">
                                    <Input type="number" step="0.001" value={item.UPPP || ""}
                                      onChange={(e) => updateItemField(itemId, "UPPP", Number(e.target.value) || 0)}
                                      disabled={!canEditRequested}
                                      className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                  </td>
                                )}
                                <td className="px-1 py-1 border-r-2 border-border">
                                  <Input disabled readOnly value={qty} className="h-7 w-full text-right text-[10px] px-1 font-semibold" />
                                </td>

                                {/* Approved qty */}
                                <td className="px-1 py-1 border-l-2 border-r border-border">
                                  <Input type="number" step="0.001" value={(item as any).APPROVED_QTY_PUOM || ""}
                                    onChange={(e) => updateItemField(itemId, "APPROVED_QTY_PUOM" as any, Number(e.target.value) || 0)}
                                    disabled={!canEditApproved}
                                    className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input disabled readOnly value={item.L_UOM || ""} className="h-7 w-full text-center text-[10px] px-1" />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input type="number" step="0.001" value={(item as any).APPROVED_QTY_LUOM || ""}
                                    onChange={(e) => updateItemField(itemId, "APPROVED_QTY_LUOM" as any, Number(e.target.value) || 0)}
                                    disabled={!canEditApproved || isSameUom(item)}
                                    className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                </td>
                                {showAllColumns && (
                                  <td className="px-1 py-1 border-r border-border">
                                    <Input type="number" step="0.001" value={(item as any).APPROVED_UPPP || ""}
                                      onChange={(e) => updateItemField(itemId, "APPROVED_UPPP" as any, Number(e.target.value) || 0)}
                                      disabled={!canEditApproved}
                                      className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                  </td>
                                )}
                                <td className="px-1 py-1 border-r-2 border-border">
                                  <Input disabled readOnly value={approvedQty} className="h-7 w-full text-right text-[10px] px-1 font-semibold" />
                                </td>

                                {shouldShowSupplier() && (
                                  <td className="px-1 py-1 border-l-2 border-r border-border">
                                    <LookupField
                                      label="" compact placeholder="Search Supplier *"
                                      value={item.SUPPLIER || ""}
                                      displayValue={supplierDisplay}
                                      columns={supplierColumns}
                                      valueField="SUPPLIER_CODE"
                                      displayFields={["SUPPLIER_CODE", "SUPPLIER_NAME"]}
                                      loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_SUPPLIERS", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                                      onChange={(val, row) => {
                                        updateItemField(itemId, "SUPPLIER", val);
                                        if (row) updateItemField(itemId, "SUPPLIER_NAME", row.SUPPLIER_NAME || "");
                                      }}
                                      disabled={disabled}
                                    />
                                  </td>
                                )}

                                <td className="px-1 py-1 border-l-2 border-r border-border">
                                  <Input type="number" step="0.0001" value={item.ITEM_RATE || ""}
                                    onChange={(e) => updateItemField(itemId, "ITEM_RATE", Number(e.target.value) || 0)}
                                    disabled={disabled || userApprovalLevel < 1}
                                    className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                </td>
                                <td className="finance-amount-cell px-1 py-1 text-right text-blue-600 border-r border-border">{fmt3(amtBeforeDisc)}</td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input type="number" step="0.001" value={item.DISCOUNT_AMOUNT || ""}
                                    onChange={(e) => updateItemField(itemId, "DISCOUNT_AMOUNT", Number(e.target.value) || 0)}
                                    disabled={disabled || discountScope === "PO"}
                                    className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                </td>
                                <td className="finance-amount-cell px-1 py-1 text-right border-r border-border">{fmt3(discPrice)}</td>
                                <td className="finance-amount-cell px-1 py-1 text-right border-r border-border">{fmt3(finalRate)}</td>
                                <td className="finance-amount-cell px-1 py-1 text-right font-semibold text-green-600 border-r border-border">{fmt3(amount)}</td>
                                <td className="finance-amount-cell px-1 py-1 text-right text-green-600 border-r border-border">{fmt3(lcurrAmt)}</td>

                                {showAllColumns && (
                                  <td className="px-1 py-1 border-r border-border">
                                    <Select className="h-7 w-full text-[10px] px-1" value={item.TAX_TYPE || "Std."}
                                      onChange={(e) => updateItemField(itemId, "TAX_TYPE", e.target.value)}
                                      disabled={disabled}>
                                      <option value="Std.">Std.</option>
                                      <option value="Zero">Zero</option>
                                      <option value="Exempt">Exempt</option>
                                      <option value="No VAT">No VAT</option>
                                    </Select>
                                  </td>
                                )}
                                {showAllColumns && (
                                  <td className="px-1 py-1 border-r border-border">
                                    <Input type="number" step="0.01" value={item.TX_COMPNT_PERC_1 || ""}
                                      onChange={(e) => updateItemField(itemId, "TX_COMPNT_PERC_1", Number(e.target.value) || 0)}
                                      disabled={disabled}
                                      className="h-7 w-full text-right text-[10px] px-1 [appearance:textfield]" placeholder="0" />
                                  </td>
                                )}
                                {showAllColumns && (
                                  <td className="finance-amount-cell px-1 py-1 text-right text-green-600 border-r border-border">{fmt3(taxAmt)}</td>
                                )}
                                {showAllColumns && (
                                  <td className="px-1 py-1 border-r border-border">
                                    <LookupField
                                      label="" compact placeholder="Tax Cat"
                                      value={item.TX_CAT_CODE || ""}
                                      displayValue={item.TX_CAT_CODE && item.TX_CAT_NAME ? `${item.TX_CAT_CODE} - ${item.TX_CAT_NAME}` : item.TX_CAT_CODE || ""}
                                      columns={taxCategoryColumns}
                                      valueField="TX_CAT_CODE"
                                      displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
                                      loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                                      onChange={(val, row) => {
                                        updateItemField(itemId, "TX_CAT_CODE", val);
                                        if (row) {
                                          updateItemField(itemId, "TX_CAT_NAME", row.TX_CAT_NAME || "");
                                          updateItemField(itemId, "TX_COMPNTCAT_CODE_1", row.TX_COMPNTCAT_CODE_1 || "");
                                        }
                                      }}
                                      disabled={disabled}
                                    />
                                  </td>
                                )}
                                {showAllColumns && (
                                  <td className="px-1 py-1 border-r border-border">
                                    <LookupField
                                      label="" compact placeholder="Tax Code"
                                      value={item.TX_COMPNTCAT_CODE_1 || ""}
                                      displayValue={item.TX_COMPNTCAT_CODE_1 && item.TX_COMPNTCAT_NAME ? `${item.TX_COMPNTCAT_CODE_1} - ${item.TX_COMPNTCAT_NAME}` : item.TX_COMPNTCAT_CODE_1 || ""}
                                      columns={taxComponentColumns}
                                      valueField="TX_COMPNTCAT_CODE"
                                      displayFields={["TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME"]}
                                      loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_TAX_COMPONENT", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                                      onChange={(val, row) => {
                                        updateItemField(itemId, "TX_COMPNTCAT_CODE_1", val);
                                        if (row) {
                                          updateItemField(itemId, "TX_COMPNTCAT_NAME", row.TX_COMPNTCAT_NAME || "");
                                          if (row.TX_PERCNT !== undefined) updateItemField(itemId, "TX_COMPNT_PERC_1", Number(row.TX_PERCNT) || 0);
                                        }
                                      }}
                                      disabled={disabled}
                                    />
                                  </td>
                                )}
                                {showAllColumns && (
                                  <td className="finance-amount-cell px-1 py-1 text-right text-green-600 border-r border-border">{fmt3(taxLcurr)}</td>
                                )}
                                {showAllColumns && (
                                  <td className="finance-amount-cell px-1 py-1 text-right font-semibold text-blue-600 border-r border-border">{fmt3(lcurrAfterDisc)}</td>
                                )}
                                <td className="px-1 py-1 text-center">
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    title="Delete row"
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => removeItem(itemId)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer totals — PO style */}
                    <div
                      className="commercial-lines-footer flex flex-none flex-wrap items-center justify-end border-t border-[#cbd5e1] px-3 py-2 gap-3"
                      style={{
                                        backgroundColor: "#f8fafc",
                        boxShadow: "0 -2px 6px rgba(0,0,0,0.06)",
                        fontSize: 14,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Total Qty (Puom){isApprovedLevel ? " Approved" : ""}</span>
                        <strong>{totalQtyPuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Total Qty (Luom){isApprovedLevel ? " Approved" : ""}</span>
                        <strong>{totalQtyLuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Amount Before Discount</span>
                        <strong className="text-emerald-600">{fmt3(totalAmountBeforeDisc)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Discount</span>
                        <strong>{fmt3(totalDiscAmount)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Amount Before Tax</span>
                        {/* totalAmount is already net of discount (AMOUNT = final rate × qty) */}
                        <strong>{fmt3(totalAmount)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Tax</span>
                        <strong>{fmt3(totalTax)}</strong>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1">
                        <span className="font-semibold text-[#00378C]">Amount After Tax</span>
                        <strong className="text-sm text-emerald-600">{fmt3(totalFinalAmount)}</strong>
                      </div>
                    </div>
                  </>
                )}

                {/* ───────────── TERMS TAB ───────────── */}
                {activeTab === "terms" && shouldShowTermsTab() && (
                  <>
                    <div className="commercial-lines-scroll min-h-0 flex-1 overflow-auto min-w-0" style={{ overscrollBehavior: "contain" }}>
                      <table
                        className="finance-lines-table w-full table-fixed text-[10px] border-separate border-spacing-0"
                        style={{ minWidth: 1180 }}
                      >
                        <colgroup>
                          <col style={{ width: "40px" }} />
                          <col style={{ width: "300px" }} />
                          <col style={{ width: "200px" }} />
                          <col style={{ width: "220px" }} />
                          <col style={{ width: "160px" }} />
                          <col />
                          <col style={{ width: "50px" }} />
                        </colgroup>
                        <thead className="sticky top-0 z-30 bg-[#00378C] text-[10px] font-semibold text-white shadow-sm">
                          <tr>
                            <th className="px-2 py-2 text-center align-middle border-r border-white/20">SNo</th>
                            <th className="px-2 py-2 text-center align-middle border-r border-white/20">Supplier</th>
                            <th className="px-2 py-2 text-center align-middle border-r border-white/20">Delivery Term</th>
                            <th className="px-2 py-2 text-center align-middle border-r border-white/20">Payment Terms</th>
                            <th className="px-2 py-2 text-center align-middle border-r border-white/20">Warranty</th>
                            <th className="px-2 py-2 text-center align-middle border-r border-white/20">Remarks</th>
                            <th className="px-2 py-2 text-center align-middle">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {terms.length === 0 ? (
                            <tr>
                              <td className="px-3 py-8 text-center text-muted-foreground" colSpan={7}>
                                No terms yet — they are added automatically for each supplier selected on the items
                              </td>
                            </tr>
                          ) : terms.map((term, idx) => {
                            const disp = term.SUPPLIER && term.SUPPLIER_NAME ? `${term.SUPPLIER} - ${term.SUPPLIER_NAME}` : (term.SUPPLIER || "");
                            return (
                              <tr className="border-t odd:bg-muted/20 hover:bg-muted/40" key={term.id}>
                                <td className="px-2 py-1 text-center border-r border-border">{idx + 1}</td>
                                <td className="px-1 py-1 border-r border-border">
                                  <LookupField
                                    label="" compact placeholder="Supplier"
                                    value={term.SUPPLIER || ""}
                                    displayValue={disp}
                                    columns={supplierColumns}
                                    valueField="SUPPLIER_CODE"
                                    displayFields={["SUPPLIER_CODE", "SUPPLIER_NAME"]}
                                    loadOptions={() => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_SUPPLIERS", loginid, code1: companyCode, code2: loginid, code3: "", code4: "" })}
                                    onChange={(val, row) => {
                                      updateTermField(term.id, "SUPPLIER", val);
                                      if (row) updateTermField(term.id, "SUPPLIER_NAME", row.SUPPLIER_NAME ?? "");
                                    }}
                                    disabled={disabled}
                                  />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input value={term.DLVR_TERM || ""} onChange={(e) => updateTermField(term.id, "DLVR_TERM", e.target.value)} disabled={disabled} className="h-7 w-full text-[10px] px-2" />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input value={term.PAYMENT_TERMS || ""} onChange={(e) => updateTermField(term.id, "PAYMENT_TERMS", e.target.value)} disabled={disabled} className="h-7 w-full text-[10px] px-2" />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input value={term.WARRANTY || ""} onChange={(e) => updateTermField(term.id, "WARRANTY", e.target.value)} disabled={disabled} className="h-7 w-full text-[10px] px-2" />
                                </td>
                                <td className="px-1 py-1 border-r border-border">
                                  <Input value={term.REMARKS || ""} onChange={(e) => updateTermField(term.id, "REMARKS", e.target.value)} disabled={disabled} className="h-7 w-full text-[10px] px-2" />
                                </td>
                                <td className="px-1 py-1 text-center">
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    title="Delete row"
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => removeTerm(term.id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div
                      className="commercial-lines-footer flex flex-none flex-wrap items-center justify-end border-t border-[#cbd5e1] px-3 py-2 gap-3"
                      style={{
                                        backgroundColor: "#f8fafc",
                        boxShadow: "0 -2px 6px rgba(0,0,0,0.06)",
                        fontSize: 14,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Supplier Terms</span>
                        <strong>{terms.length}</strong>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ DIALOGS (unchanged) ═══════════ */}
      <AttachmentDialog
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        requestNumber={requestNumber || ""}
        title="Purchase Request Attachments"
        module="PR"
        type="Purchase Request"
        companyCode={companyCode}
        loginId={loginid}
        flowLevel={Number(header.FLOW_LEVEL_RUNNING) || 1}
      />

      <Dialog
        open={rejectOpen}
        title="Reject Request"
        description="Enter the reason for rejection."
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={handleRejectConfirm}>Confirm Reject</Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <label className="field">
            <span>Rejection Reason *</span>
            <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter reject remark..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
          {!remarkText.trim() && <span className="text-xs text-red-500">Rejection reason is required</span>}
        </div>
      </Dialog>

      <Dialog
        open={sendBackOpen}
        title="Send Back Request"
        description="Select who to send this back to, and enter the reason."
        onClose={() => setSendBackOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button>
            <Button disabled={saving || !selectedSendBackTo || !remarkText.trim()} onClick={handleSendBackConfirm} variant="default">Confirm Send Back</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="field">
            <span>Send Back To *</span>
            <Select value={selectedSendBackTo} onChange={(e) => setSelectedSendBackTo(e.target.value)} className="w-full">
              <option value="">Select user</option>
              {sendBackOptions.map((o) => (<option key={o.loginid} value={o.loginid}>{o.label}</option>))}
            </Select>
            {!selectedSendBackTo && <span className="text-xs text-red-500">Please select a user to send back</span>}
          </label>
          <label className="field">
            <span>Send Back Reason *</span>
            <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter send back reason..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            {!remarkText.trim() && <span className="text-xs text-red-500">Send back reason is required</span>}
          </label>
        </div>
      </Dialog>
    </div>
  );
};

export default AddPRRequestPage;