import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Save, Send, X, CheckCircle,
  ChevronLeft, Paperclip, FileText,
  Printer,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { Badge } from "../../components/ui/Badge";
import { CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import type { TPRHeader, TPRItem } from "./PurchaseSummary-types";
import { almsCommonSelect, almsSave, almsSavePrequestBulk } from "../../api/alms";
import { openPRPurchaseReport } from "../../api/transactions";
import { useToast } from "../../components/ui/AlertToast";

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

// ─── PO-style calculation helpers ─────────────────────────────────────────
function itemQty(item: Partial<TPRItem>, userLevel: number) {
  return userLevel >= 2 ? num(item.ALLOCATED_APPROVED_QUANTITY) : num(item.REQUEST_QUANTITY);
}

function itemDiscPrice(item: Partial<TPRItem>) {
  return num(item.ITEM_RATE) * (num(item.DISCOUNT_AMOUNT) / 100);
}

function itemFinalRate(item: Partial<TPRItem>) {
  return num(item.ITEM_RATE) - itemDiscPrice(item);
}

function itemAmount(item: Partial<TPRItem>, userLevel: number) {
  return itemFinalRate(item) * itemQty(item, userLevel);
}

function itemNetAmount(item: Partial<TPRItem>, userLevel: number) {
  return itemAmount(item, userLevel);
}

function itemTaxAmount(item: Partial<TPRItem>, userLevel: number) {
  return itemNetAmount(item, userLevel) * (num(item.TX_COMPNT_PERC_1) / 100);
}

function itemLcurrAmount(item: Partial<TPRItem>, exRate: number, userLevel: number) {
  return itemAmount(item, userLevel) * (exRate || 1);
}

function itemTaxLcurrAmount(item: Partial<TPRItem>, exRate: number, userLevel: number) {
  return itemTaxAmount(item, userLevel) * (exRate || 1);
}

function itemLcurrAfterDiscount(item: Partial<TPRItem>, exRate: number, userLevel: number) {
  return itemLcurrAmount(item, exRate, userLevel) + itemTaxLcurrAmount(item, exRate, userLevel);
}

function recalcItem<T extends Partial<TPRItem>>(item: T, exRate: number, userLevel: number): T {
  const rate = exRate || 1;
  item.FINAL_RATE = itemFinalRate(item);
  item.AMOUNT = itemAmount(item, userLevel);
  item.TX_COMPNT_AMT_1 = itemTaxAmount(item, userLevel);
  (item as any).LCURR_AMT = itemLcurrAmount(item, rate, userLevel);
  (item as any).TX_COMPNT_LCURAMT_1 = itemTaxLcurrAmount(item, rate, userLevel);
  (item as any).LCURR_AFTER_DISCOUNT = itemLcurrAfterDiscount(item, rate, userLevel);
  (item as any).BASE_AMOUNT = (item as any).LCURR_AMT;
  (item as any).FINAL_AMOUNT = (item as any).LCURR_AMT + (item as any).TX_COMPNT_LCURAMT_1;
  return item;
}

function cleanNumericData(data: any): any {
  const numericFields = [
    'AMOUNT', 'CURRENCY_RATE', 'ITEM_RATE', 'ITEM_QTY',
    'CREDIT_AMOUNT', 'PO_AMOUNT', 'DISCOUNT_AMOUNT',
    'FINAL_RATE', 'BASE_AMOUNT', 'FINAL_AMOUNT', 'LCURR_AMT',
    'TX_COMPNT_AMT_1', 'TX_COMPNT_LCURAMT_1', 'TX_COMPNT_PERC_1',
    'REQUEST_QUANTITY', 'ALLOCATED_APPROVED_QUANTITY',
    'LCURR_AFTER_DISCOUNT'
  ];

  if (Array.isArray(data)) {
    return data.map(item => cleanNumericData(item));
  }

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
    FINAL_AMOUNT: 0,
    LCURR_AFTER_DISCOUNT: 0,
    CURR_CODE: hdr.CURR_CODE ?? "",
    CURR_NAME: hdr.CURR_NAME ?? "",
    CURRENCY_RATE: hdr.CURRENCY_RATE ?? 0,
    TX_CAT_CODE: hdr.TX_CAT_CODE ?? "",
    TX_CAT_NAME: hdr.TX_CAT_NAME ?? "",
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
    CASH_IND: "",
  };
}

// ─── Validation Function ──────────────────────────────────────────────────────
function validatePRForm(header: Partial<TPRHeader>, items: TPRItem[], terms: any[], userLevel: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!header.DESCRIPTION || header.DESCRIPTION.trim() === "") {
    errors.push("Description / Reason is required");
  }
  if (!header.REMARKS || header.REMARKS.trim() === "") {
    errors.push("Remarks is required");
  }
  if (!header.PDO_TYPE) {
    errors.push("POD Type is required");
  }
  if (!header.CURR_CODE) {
    errors.push("Currency is required");
  }

  if (items.length === 0) {
    errors.push("At least one item is required");
  } else {
    items.forEach((item, index) => {
      if (!item.ITEM_CODE) {
        errors.push(`Item ${index + 1}: Item Code is required`);
      }
      if (!item.ITEM_DESP) {
        errors.push(`Item ${index + 1}: Item Description is required`);
      }
      if (userLevel >= 6 && !item.SUPPLIER) {
        errors.push(`Item ${index + 1}: Supplier is required`);
      }
      if (userLevel >= 2 && num(item.ALLOCATED_APPROVED_QUANTITY) <= 0) {
        errors.push(`Item ${index + 1}: Approved Quantity must be greater than 0`);
      }
      if (userLevel === 1 && num(item.REQUEST_QUANTITY) <= 0) {
        errors.push(`Item ${index + 1}: Request Quantity must be greater than 0`);
      }
      if (num(item.ITEM_RATE) <= 0) {
        errors.push(`Item ${index + 1}: Rate must be greater than 0`);
      }
      if (!item.COST_CODE) {
        errors.push(`Item ${index + 1}: Cost Code is required`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

const AddPRRequestPage = ({ isEditMode, isViewMode = false, existingData, flowCode, flowDescription, docType = "PR", docNo, onClose }: AddPRRequestPageProps) => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";
  const { toast } = useToast();
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestNumber, setRequestNumber] = useState<string | undefined>(existingData?.request_number);
  const [header, setHeader] = useState<Partial<TPRHeader>>({});
  const [items, setItems] = useState<TPRItem[]>([]);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [selectedSendBackTo, setSelectedSendBackTo] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "terms">("items");
  const [terms, setTerms] = useState<any[]>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const PDO_TYPE_MAP: Record<string, string> = {
    'P': 'PDO-OTO',
    'Q': 'PDO-NON-OTO',
    'N': 'NON-PDO'
  };
  const [userApprovalLevel, setUserApprovalLevel] = useState<number>(0);
  const [displayDate, setDisplayDate] = useState("");
  const isInitialized = useRef(false);
  const disabled = isViewMode || saving;


  useEffect(() => {
    if (isInitialized.current) return;

    // Only for NEW document (not edit/view)
    if (!isEditMode && !isViewMode) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      const yyyyMMdd = today.toISOString().slice(0, 10);

      setDisplayDate(formattedDate);
      setHdr("REQUEST_DATE", yyyyMMdd);
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
    if ((isEditMode || isViewMode) && header.REQUEST_DATE) {
      const date = new Date(header.REQUEST_DATE);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        setDisplayDate(`${day}/${month}/${year}`);
      }
    }
  }, [isEditMode, isViewMode, header.REQUEST_DATE]);

  // ─── Fetch user's approval level based on flow ──────────────
  useEffect(() => {
    const fetchUserLevel = async () => {
      if (!user?.loginid || !companyCode || !header.FLOW_CODE) return;

      try {
        const result = await almsCommonSelect({
          parameter: "PS_PREQUEST_ENTRY_GET_USER_LEVEL",
          loginid,
          code1: companyCode,
          code2: header.FLOW_CODE || "",
          code3: user?.loginid || "",
          code4: ""
        });

        if (result && result.length > 0) {
          const level = Number(result[0].FLOW_LEVEL) || 0;
          setUserApprovalLevel(level);
        } else {
          const currentLevel = Number(header.FLOW_LEVEL_RUNNING) || 0;
          setUserApprovalLevel(currentLevel);
        }
      } catch (error) {
        console.error("Failed to fetch user level:", error);
        const currentLevel = Number(header.FLOW_LEVEL_RUNNING) || 0;
        setUserApprovalLevel(currentLevel);
      }
    };

    fetchUserLevel();
  }, [user, companyCode, header.FLOW_CODE, header.FLOW_LEVEL_RUNNING]);

  const shouldShowSupplier = (): boolean => {
    return userApprovalLevel >= 6;
  };

  const shouldShowApprovedQty = (): boolean => {
    return userApprovalLevel >= 2;
  };

  const shouldShowTermsTab = (): boolean => {
    return userApprovalLevel >= 6;
  };

  // ─── Lookup Queries ──────────────────────────────────────────────
  const { data: itemCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-items-lookup", companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_ITEMS",
      loginid,
      code1: companyCode,
      code2: loginid,
      code3: "",
      code4: ""
    }),
    enabled: !!companyCode,
  });

  const { data: costCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-cost-lookup", companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_COSTS",
      loginid,
      code1: companyCode,
      code2: loginid,
      code3: "",
      code4: ""
    }),
    enabled: !!companyCode,
  });

  const { data: taxCodes = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-tax-lookup", companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_TAX",
      loginid,
      code1: companyCode,
      code2: loginid,
      code3: "",
      code4: ""
    }),
    enabled: !!companyCode,
  });

  const { data: taxComponentList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-tax-component-lookup", companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_TAX_COMPONENT",
      loginid,
      code1: companyCode,
      code2: loginid,
      code3: "",
      code4: ""
    }),
    enabled: !!companyCode,
  });

  const { data: supplierList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-supplier-lookup", companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_SUPPLIERS",
      loginid,
      code1: companyCode,
      code2: loginid,
      code3: "",
      code4: ""
    }),
    enabled: !!companyCode && shouldShowSupplier(),
  });

  const { data: currencyList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-currency-lookup", companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_CURRENCY",
      loginid,
      code1: companyCode,
      code2: loginid,
      code3: "",
      code4: ""
    }),
    enabled: !!companyCode,
  });

  const { data: divisionList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-division-lookup", companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_DIVISION",
      loginid,
      code1: companyCode,
      code2: loginid,
      code3: "",
      code4: ""
    }),
    enabled: !!companyCode,
  });

  // ─── Fetch Header Data ────────────────────────────────────────────
  const { data: hdrList = [] } = useQuery<TPRHeader[]>({
    queryKey: ["pr-header", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRHeader>({
      parameter: "PS_PREQUEST_ENTRY_HEADER_PAGE",
      loginid,
      code1: companyCode,
      code2: "PR",
      code3: requestNumber || "",
      code4: ""
    }),
    enabled: (isEditMode || isViewMode) && !!requestNumber,
  });

  // ─── Fetch Items Data ────────────────────────────────────────────
  const { data: itemList = [] } = useQuery<TPRItem[]>({
    queryKey: ["pr-item-list", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRItem>({
      parameter: "PS_PREQUEST_ENTRY_DETAIL_PAGE",
      loginid,
      code1: companyCode,
      code2: "PR",
      code3: requestNumber || "",
      code4: ""
    }),
    enabled: (isEditMode || isViewMode) && !!requestNumber,
  });

  // ─── Fetch Terms Data ────────────────────────────────────────────
  const { data: termsList = [] } = useQuery<any[]>({
    queryKey: ["pr-terms", requestNumber, companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_TERMS",
      loginid,
      code1: companyCode,
      code2: requestNumber || "",
      code3: "",
      code4: "",
    }),
    enabled: (isEditMode || isViewMode) && !!requestNumber && shouldShowTermsTab(),
  });

  // ─── Fetch Flow Details for DIV_CODE ────────────────────────────
  const { data: flowDetailData } = useQuery<LookupItem[]>({
    queryKey: ["pr-flow-details", flowCode, companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_GET_FLOW_DETAILS",
      loginid,
      code1: companyCode,
      code2: flowCode || "",
      code3: "",
      code4: ""
    }),
    enabled: !!flowCode && !!companyCode && !isEditMode && !isViewMode,
  });

  // ─── Auto-populate Division from Flow ────────────────────────────
  useEffect(() => {
    if (isEditMode || isViewMode) return;
    if (!flowDetailData || flowDetailData.length === 0) return;

    const flow = flowDetailData[0];
    const divCode = flow.DIV_CODE || "";

    if (divCode) {
      setHdr("DIV_CODE", divCode);
      const div = divisionList.find((d: any) => d.DIV_CODE === divCode);
      if (div) {
        setHdr("DIV_NAME", div.DIV_NAME || "");
      }
    }
  }, [flowDetailData, divisionList, isEditMode, isViewMode]);

  // ─── Set Header Data ─────────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode && !isViewMode) {
      setLoading(false);
      return;
    }

    if (hdrList.length > 0) {
      const headerData = hdrList[0];
      setHeader({
        ...headerData,
        DIV_CODE: (headerData as any).DIV_CODE || "",
        DIV_NAME: (headerData as any).DIV_NAME || "",
        DEPT_CODE_FLOW: (headerData as any).DEPT_CODE_FLOW || "",
        DEPT_NAME: (headerData as any).DEPT_NAME || "",
        FLOW_CODE: (headerData as any).FLOW_CODE || headerData.FLOW_CODE || "",
        FLOW_DESCRIPTION: (headerData as any).FLOW_DESCRIPTION || headerData.FLOW_DESCRIPTION || "",
      });
      setLoading(false);
    } else if (!loading) {
      setLoading(false);
    }
  }, [hdrList, isEditMode, isViewMode, requestNumber]);

  // ─── Set Flow Code for New Document ─────────────────────────────
  useEffect(() => {
    if (isEditMode || isViewMode) return;
    if (!flowCode && !flowDescription) return;
    setHeader((prev) => ({
      ...prev,
      FLOW_CODE: flowCode || (prev as any).FLOW_CODE,
      FLOW_DESCRIPTION: flowDescription || (prev as any).FLOW_DESCRIPTION,
    }));
  }, [isEditMode, isViewMode, flowCode, flowDescription]);

  // ─── Set Items Data ──────────────────────────────────────────────
  useEffect(() => {
    if (itemList.length === 0) {
      if (isViewMode && requestNumber) {
        setItems([]);
      }
      return;
    }

    const enriched = itemList.map((row) => {
      const base: TPRItem = {
        ...row,
        id: (row as any).id || newId(),
        ITEM_DESP: row.ITEM_DESP || itemCodes.find((i) => i.ITEM_CODE === row.ITEM_CODE)?.ITEM_DESP || "",
        COST_NAME: row.COST_NAME || costCodes.find((c) => c.COST_CODE === row.COST_CODE)?.COST_NAME || "",
        SUPPLIER_NAME: (row as any).SUPPLIER_NAME || supplierList.find((s) => s.SUPPLIER_CODE === row.SUPPLIER)?.SUPPLIER_NAME || "",
        TX_CAT_NAME: (row as any).TX_CAT_NAME || taxCodes.find((t) => t.TX_CAT_CODE === row.TX_CAT_CODE)?.TX_CAT_NAME || "",
        CURR_NAME: (row as any).CURR_NAME || currencyList.find((c) => c.CURR_CODE === row.CURR_CODE)?.CURR_NAME || "",
        CAPEX_OPEX_NON_OPEX: (row as any).CAPEX || (row as any).CAPEX_OPEX_NON_OPEX || "",
        LCURR_AFTER_DISCOUNT: 0,
        CASH_IND: (row as any).CASH_IND || "",
      } as TPRItem;
      const exRate = num(base.CURRENCY_RATE || header.CURRENCY_RATE || 1);
      return recalcItem(base, exRate, userApprovalLevel);
    });
    const renumbered = enriched.map((item, idx) => ({ ...item, ITEM_SRNO: idx + 1 }));
    setItems(renumbered);
  }, [userApprovalLevel]);

  // ─── Set Terms Data ──────────────────────────────────────────────
  useEffect(() => {
    if (termsList.length === 0) {
      if (isViewMode && requestNumber) {
        setTerms([]);
      }
      return;
    }

    const enriched = termsList.map((row: any) => ({
      ...row,
      id: row.id || newId(),
      SUPPLIER_NAME: row.SUPPLIER_NAME || supplierList.find((s) => s.SUPPLIER_CODE === row.SUPPLIER)?.SUPPLIER_NAME || "",
    }));
    setTerms(enriched);
  }, [termsList, supplierList, isViewMode, requestNumber]);

  const setHdr = (field: keyof TPRHeader, value: unknown) => setHeader((prev) => ({ ...prev, [field]: value }));

  const totalAmount = items.reduce((s, r) => s + num(r.AMOUNT), 0);
  const totalTax = items.reduce((s, r) => s + num(r.TX_COMPNT_AMT_1), 0);
  const totalBase = items.reduce((s, r) => s + num(r.BASE_AMOUNT), 0);
  const totalFinalAmount = items.reduce((s, r) => s + num(r.FINAL_AMOUNT), 0);
  const [headerExpanded, setHeaderExpanded] = useState(true);

  const validateAndShowErrors = (): boolean => {
    const { valid, errors } = validatePRForm(header, items, terms, userApprovalLevel);
    if (!valid) {
      toast.error(errors[0], 5000);
      setNotice({
        type: "error",
        message: errors.join(". ")
      });
      return false;
    }
    return true;
  };

  const saveBulk = async (status: string, remark: string = "", overrides: Partial<Record<string, any>> = {}): Promise<{ success: boolean; message?: string;[key: string]: any }> => {
    const headerData = {
      REQUEST_NUMBER: requestNumber || null,
      COMPANY_CODE: companyCode,
      REQUEST_DATE: header.REQUEST_DATE ? new Date(header.REQUEST_DATE).toISOString() : new Date().toISOString(),
      SUPPLIER: "",
      DESCRIPTION: header.DESCRIPTION || "",
      REMARKS: header.REMARKS || "",
      AMOUNT: totalAmount || 0,
      DEPARTMENT_CODE: "",
      FLOW_CODE: header.FLOW_CODE || "",
      FLOW_DESCRIPTION: header.FLOW_DESCRIPTION || "",
      FLOW_LEVEL_INITIAL: header.FLOW_LEVEL_INITIAL || 1,
      FLOW_LEVEL_RUNNING: overrides.FLOW_LEVEL_RUNNING ?? (header.FLOW_LEVEL_RUNNING || 1),
      FLOW_LEVEL_FINAL: header.FLOW_LEVEL_FINAL || 3,
      CURRENCY_RATE: header.CURRENCY_RATE || 1,
      USER_DT: new Date().toISOString(),
      USER_ID: loginid,
      FA_UPLOADED: "",
      FINAL_APPROVED: header.isFinalApproval ? "Y" : "N",
      TX_CAT_CODE: header.TX_CAT_CODE || "",
      TX_COMPNTCAT_CODE_1: header.TX_COMPNTCAT_CODE_1 || "",
      TX_COMPNTCAT_CODE_2: "",
      TX_COMPNTCAT_CODE_3: "",
      TX_COMPNTCAT_CODE_4: "",
      TX_COMPNT_1_EXPMT: "",
      REMARKS_HISTRY: "",
      CURR_CODE: header.CURR_CODE || "",
      CREATE_USER: isEditMode ? (header.CREATE_USER || loginid) : loginid,
      CREATE_DATE: isEditMode ? (header.CREATE_DATE || new Date().toISOString()) : new Date().toISOString(),
      LAST_UPDATED: loginid,
      LAST_ACTION: status,
      HISTORY_SERIAL: 0,
      ATTACH_FILE_NAME: "",
      ATTACH_FILE_NAME1: "",
      ATTACH_FILE_NAME2: "",
      REJECT_HISTRY: "",
      SENDBACK_HISTRY: "",
      REQ_DOC_NO: 0,
      REQ_DIV_CODE: "",
      COST_CODE: "",
      PO_AMOUNT: 0,
      DOC_DATE: new Date().toISOString(),
      CANCEL_FLAG: "",
      CANCEL_DATE: null,
      CANCEL_USER: "",
      MOBILE_APP_UPDATE: "",
      FA_USER: "",
      HOD_USER: "",
      MAIL_CC: "",
      WARRANTY: "",
      PO_CREATOR: "",
      REQUEST_HOD_USER: "",
      CANCEL_REMARK: "",
      PDO_TYPE: header.PDO_TYPE || "N",
      TYPE_OF_CONTRACT: "",
      AC_CODE: "",
      AC_NAME: "",
      COUNTRY_CODE: "",
      TERRITORY_CODE: "",
      ADDRESS_1: "",
      ADDRESS_2: "",
      ADDRESS_3: "",
      PHONE: "",
      FAX: "",
      E_MAIL: "",
      CONTACT_PERSON: "",
      MOBILE_NO: "",
      AC_TYPE: "",
      AC_ACTIVE: "",
      CREDIT_PERIOD: 0,
      CREDIT_AMOUNT: 0,
      BANK_AC_CODE: "",
      BANK_NAME: "",
      BANK_SWIFT: "",
      IBAN_NO: "",
      BANK_AC_NAME: "",
      TAX_REGISTRD: "",
      TAX_COUNTRY_CODE: "",
      TRN_NO: "",
      CR_NO: "",
      RCM_APPLY: "",
      SECTOR_CODE: "",
      CITY_NAME: "",
      EXP_TYPE_CODE: "",
      PL_BL_CODE: "",
      DEPT_CODE: "",
      AC_STATUS: "",
      AC_INFZE: "",
      BI_MAIN_GROUP: "",
      BI_SUB_GROUP: "",
      BI_EXP_TYPE: "",
      BI_PL_BS_IND: "",
      BI_DEPT: "",
      CREATED_BY: "",
      UPDATED_BY: "",
      NEXT_ACTION_BY: overrides.NEXT_ACTION_BY ?? "",
      SENTBACK_REASON: status === "SENDBACK" ? remark : "",
      REJECT_REASON: status === "REJECTED" ? remark : "",
      DOC_NO: header.DOC_NO ?? null,
      DIV_CODE: header.DIV_CODE || "",
      DIV_NAME: header.DIV_NAME || "",
      DEPT_CODE_FLOW: header.DEPT_CODE_FLOW || "",
      DEPT_NAME: header.DEPT_NAME || "",
      ...overrides,
    };

    const detailsData = items.map((item) => ({
      REQUEST_NUMBER: requestNumber || null,
      ITEM_CODE: item.ITEM_CODE || "",
      ITEM_RATE: item.ITEM_RATE || 0,
      ITEM_QTY: item.ALLOCATED_APPROVED_QUANTITY || 0,
      CURRENCY_RATE: item.CURRENCY_RATE || 1,
      AMOUNT: item.AMOUNT || 0,
      COMPANY_CODE: companyCode,
      USER_DT: new Date().toISOString(),
      USER_ID: isEditMode ? (header.USER_ID || loginid) : loginid,
      TX_CAT_CODE: item.TX_CAT_CODE || "",
      TX_COMPNTCAT_CODE_1: item.TX_COMPNTCAT_CODE_1 || "",
      TX_COMPNT_PERC_1: item.TX_COMPNT_PERC_1 || 0,
      TX_COMPNT_AMT_1: item.TX_COMPNT_AMT_1 || 0,
      TX_COMPNT_LCURAMT_1: item.TX_COMPNT_LCURAMT_1 || 0,
      TX_COMPNT_1_EXPMT: "",
      CURR_CODE: item.CURR_CODE || "",
      LCURR_AMT: item.LCURR_AMT || 0,
      LCURR_AFTER_DISCOUNT: (item as any).LCURR_AFTER_DISCOUNT || 0,
      ALLOCATED_APPROVED_QUANTITY: item.ALLOCATED_APPROVED_QUANTITY || 0,
      SELECTED_ITEM: "",
      LAST_ACTION: status,
      HISTORY_SERIAL: 0,
      ITEM_SRNO: item.ITEM_SRNO || 0,
      SUPPLIER_PART_CODE: "",
      RATE_METHODE: "",
      CASH_IND: item.CASH_IND || "",
      MAIL_ATTATCH: "",
      ITEM_CANEL: "",
      SUPPLIER: item.SUPPLIER || "",
      REF_DOC_NO: 0,
      DISCOUNT_AMOUNT: item.DISCOUNT_AMOUNT || 0,
      FINAL_RATE: item.FINAL_RATE || 0,
      COST_CODE: item.COST_CODE || "",
      CAPEX: item.CAPEX_OPEX_NON_OPEX || "",
      BUYER: "",
      REASON_FOR_PO_MODIFY: "",
      DOC_TYPE: "PR",
      DOC_NO: null,
      DOC_DATE: new Date().toISOString(),
      DIV_CODE: "",
      SERIAL_NO: 0,
      PROD_CODE: "",
      PROD_NAME: "",
      P_UOM: "",
      QTY_PUOM: 0,
      L_UOM: "",
      QTY_LUOM: 0,
      UPPP: 0,
      QUANTITY: 0,
      REQUIRED_DT: null,
      SIGN_IND: "-1",
      QTY_PROCESSED: 0,
      CANCELLED: "",
      CANCELLED_DT: null,
      JOB_NO: "",
      REF_DOC_TYPE: "",
      EDIT_USER: "",
      EDIT_DATE: null,
      ZONE_CODE: "",
      STOCK_QTY_WHENPRQ: 0,
      REQUEST_QUANTITY: item.REQUEST_QUANTITY || 0,
    }));

    const termsData = terms.map((term) => ({
      SUPPLIER: term.SUPPLIER || "",
      REMARKS: term.REMARKS || "",
      DLVR_TERM: term.DLVR_TERM || "",
      PAYMENT_TERMS: term.PAYMENT_TERMS || "",
      COMPANY_CODE: companyCode,
      USER_DT: new Date().toISOString(),
      USER_ID: loginid,
      WARRANTY: term.WARRANTY || "",
      DOC_NO: null
    }));

    const cleanedHeader = cleanNumericData(headerData);
    const cleanedDetails = cleanNumericData(detailsData);
    const cleanedTerms = cleanNumericData(termsData);

    const result = await almsSavePrequestBulk({
      header: cleanedHeader,
      details: cleanedDetails,
      terms: cleanedTerms,
    });

    console.log("Save Response:", result);
    return result;
  };

  const [savingAction, setSavingAction] = useState<string | null>(null);

  const runAction = async (status: string, successMsg: string, remark: string = "", overrides: Partial<Record<string, any>> = {}) => {
    if (saving) return;

    if (status !== "SAVEASDRAFT") {
      if (!validateAndShowErrors()) {
        return;
      }
    }

    setSavingAction(status);
    setNotice(null);
    try {
      const result = await saveBulk(status, remark, overrides);
      if (result.success) {
        toast.success(successMsg, 4000);
        onClose(true);
      } else {
        throw new Error(result.message || "Failed to save");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed", 5000);
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Action failed" });
    } finally {
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
    if (!requestNumber) {
      toast.warning("Please save the request before printing.", 4000);
      return;
    }
    openPRPurchaseReport({
      parameter: "PS_PREQUEST_ENTRY_PRReport",
      loginid,
      code1: companyCode,
      code2: requestNumber,
    });
  };

  const handleApprove = async () => {
    if (!requestNumber) {
      toast.error("No PR to approve", 5000);
      return;
    }

    if (!validateAndShowErrors()) {
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const currentLevel = Number(header.FLOW_LEVEL_RUNNING) || 1;
      const finalLevel = Number(header.FLOW_LEVEL_FINAL) || 1;
      const nextLevel = currentLevel + 1;
      const isFinal = nextLevel >= finalLevel ? "Y" : "N";
      const result = await saveBulk("APPROVED", "", {
        FLOW_LEVEL_RUNNING: nextLevel,
        FINAL_APPROVED: isFinal,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to approve");
      }

      toast.success("PR approved successfully!", 4000);
      onClose(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve", 5000);
    } finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!requestNumber) {
      toast.error("No PR to reject", 5000);
      return;
    }
  };

  const { data: sendBackTargets = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-sendback-targets", requestNumber, companyCode, header.FLOW_LEVEL_RUNNING],
    queryFn: () => almsCommonSelect({
      parameter: "PS_PREQUEST_ENTRY_SENDBACK_TARGETS",
      loginid,
      code1: companyCode,
      code2: requestNumber || "",
      code3: String(header.FLOW_LEVEL_RUNNING || 0),
      code4: "",
    }),
    enabled: sendBackOpen && !!requestNumber,
  });

  const sendBackOptions = useMemo(() => {
    const opts: { loginid: string; label: string; level: number }[] = [];

    if (header.USER_ID) {
      opts.push({ loginid: String(header.USER_ID), label: `${header.USER_ID} (Creator)`, level: 0 });
    }

    const seen = new Set(opts.map((o) => o.loginid));
    sendBackTargets.forEach((row: any) => {
      const lg = String(row.LOGINID || "");
      if (lg && !seen.has(lg) && lg !== loginid) {
        seen.add(lg);
        opts.push({ loginid: lg, label: `${lg} (Level ${row.FLOW_LEVEL_RUNNING})`, level: Number(row.FLOW_LEVEL_RUNNING) || 0 });
      }
    });
    return opts;
  }, [header.USER_ID, sendBackTargets, loginid]);

  const handleSendBackConfirm = async () => {
    if (!selectedSendBackTo) {
      toast.warning("Please select who to send this back to", 4000);
      return;
    }
    if (!remarkText.trim()) {
      toast.warning("Please enter a send back reason", 4000);
      return;
    }

    const target = sendBackOptions.find((o) => o.loginid === selectedSendBackTo);
    await runAction("SENDBACK", "PR sent back successfully!", remarkText, {
      FLOW_LEVEL_RUNNING: target?.level ?? 0,
      NEXT_ACTION_BY: selectedSendBackTo,
    });
    setSendBackOpen(false);
    setRemarkText("");
    setSelectedSendBackTo("");
  };

  const handleRejectConfirm = async () => {
    if (!remarkText.trim()) {
      toast.warning("Please enter a rejection reason", 4000);
      return;
    }

    if (!validateAndShowErrors()) {
      return;
    }

    setRejectOpen(false);
    const reason = remarkText;
    await runAction("REJECTED", "PR rejected successfully!", reason, {
      NEXT_ACTION_BY: loginid,
    });
    setRemarkText("");
  };

  const updateAllItemsWithHeader = (overrides: Partial<TPRHeader> = {}) => {
    const hdr = { ...header, ...overrides };
    setItems((prev) =>
      prev.map((item) => {
        const merged: TPRItem = {
          ...item,
          CURR_CODE: hdr.CURR_CODE || item.CURR_CODE || "",
          CURR_NAME: hdr.CURR_NAME || item.CURR_NAME || "",
          CURRENCY_RATE: hdr.CURRENCY_RATE || item.CURRENCY_RATE || 1,
          TX_CAT_CODE: hdr.TX_CAT_CODE || item.TX_CAT_CODE || "",
          TX_CAT_NAME: hdr.TX_CAT_NAME || item.TX_CAT_NAME || "",
          TX_COMPNTCAT_CODE_1: hdr.TX_COMPNTCAT_CODE_1 || item.TX_COMPNTCAT_CODE_1 || "",
          TX_COMPNT_PERC_1: hdr.TX_COMPNT_PERC_1 || item.TX_COMPNT_PERC_1 || 0,
          TX_COMPNTCAT_NAME: (hdr as any).TX_COMPNTCAT_NAME || (item as any).TX_COMPNTCAT_NAME || "",
        };
        const exRate = num(merged.CURRENCY_RATE) || 1;
        return recalcItem(merged, exRate, userApprovalLevel);
      })
    );
  };

  const addItemLine = () => {
    const srNo = items.length + 1;
    const blank = blankItem(srNo, requestNumber ?? "", companyCode, header);
    blank.CURR_CODE = header.CURR_CODE || "";
    blank.CURR_NAME = header.CURR_NAME || "";
    blank.CURRENCY_RATE = header.CURRENCY_RATE || 1;
    blank.TX_CAT_CODE = header.TX_CAT_CODE || "";
    blank.TX_CAT_NAME = header.TX_CAT_NAME || "";
    blank.TX_COMPNTCAT_CODE_1 = header.TX_COMPNTCAT_CODE_1 || "";
    blank.TX_COMPNT_PERC_1 = header.TX_COMPNT_PERC_1 || 0;
    blank.CASH_IND = "N";
    (blank as any).id = newId();
    setItems([...items, blank]);

    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const removeItem = (id: string) => {
    const updated = items.filter((item) => (item as any).id !== id);
    const renumbered = updated.map((item, idx) => ({ ...item, ITEM_SRNO: idx + 1 }));
    setItems(renumbered);
  };

  const updateItemField = (id: string, field: keyof TPRItem, value: unknown) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => (item as any).id === id);
      if (index === -1) return prev;
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === "ITEM_RATE" || field === "DISCOUNT_AMOUNT" || field === "ALLOCATED_APPROVED_QUANTITY" || field === "REQUEST_QUANTITY") {
        const exRate = num(item.CURRENCY_RATE) || 1;
        recalcItem(item, exRate, userApprovalLevel);
      }
      if (field === "CURRENCY_RATE") {
        const rate = num(value);
        item.CURRENCY_RATE = rate;
        recalcItem(item, rate || 1, userApprovalLevel);
      }
      if (field === "TX_COMPNT_PERC_1") {
        item.TX_COMPNT_PERC_1 = num(value);
        const exRate = num(item.CURRENCY_RATE) || 1;
        recalcItem(item, exRate, userApprovalLevel);
      }
      if (field === "TX_CAT_CODE" && typeof value === 'string') {
        const found = taxCodes.find((t) => t.tx_cat_code === value);
        if (found) {
          item.TX_CAT_CODE = value;
          item.TX_CAT_NAME = found.tx_cat_name || "";
          item.TX_COMPNTCAT_CODE_1 = found.tx_compntcat_code_1 || "";
          item.TX_COMPNT_PERC_1 = found.tx_compnt_perc_1 || 0;
          const exRate = num(item.CURRENCY_RATE) || 1;
          recalcItem(item, exRate, userApprovalLevel);
        }
      }
      if (field === "TX_COMPNTCAT_CODE_1" && typeof value === 'string') {
        const found = taxComponentList.find((t) => t.TX_COMPNTCAT_CODE === value);
        if (found) {
          item.TX_COMPNTCAT_CODE_1 = value;
          item.TX_COMPNTCAT_NAME = found.TX_COMPNTCAT_NAME || "";
          if (found.TX_PERCNT !== undefined) {
            item.TX_COMPNT_PERC_1 = Number(found.TX_PERCNT) || 0;
          }
          const exRate = num(item.CURRENCY_RATE) || 1;
          recalcItem(item, exRate, userApprovalLevel);
        }
      }
      if (field === "CASH_IND" && typeof value === 'string') {
        item.CASH_IND = value;
      }

      updated[index] = item;
      return updated;
    });
  };

  const blankTerm = () => ({
    id: newId(),
    COMPANY_CODE: companyCode,
    SUPPLIER: "",
    SUPPLIER_NAME: "",
    DLVR_TERM: "",
    PAYMENT_TERMS: "",
    WARRANTY: "",
    REMARKS: "",
    USER_ID: "",
    USER_DT: null,
  });

  const addTermLine = () => setTerms((prev) => [...prev, blankTerm()]);

  const removeTerm = (id: string) => setTerms((prev) => prev.filter((t) => t.id !== id));

  const updateTermField = (id: string, field: string, value: unknown) => {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const upsertTermForSupplier = (supplierCode: string, supplierName: string) => {
    if (!supplierCode) return;
    setTerms((prev) => {
      if (prev.some((t) => t.SUPPLIER === supplierCode)) return prev;
      return [
        ...prev,
        {
          id: newId(),
          COMPANY_CODE: companyCode,
          SUPPLIER: supplierCode,
          SUPPLIER_NAME: supplierName,
          DLVR_TERM: "",
          PAYMENT_TERMS: "",
          WARRANTY: "",
          REMARKS: "",
          USER_ID: "",
          USER_DT: null,
        },
      ];
    });
  };

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
    { field: "TX_COMPNTCAT_CODE", header: "Code" },
    { field: "TX_COMPNTCAT_NAME", header: "Name" },
  ];
  const itemCodeColumns = [
    { field: "ITEM_CODE", header: "Code" },
    { field: "ITEM_DESP", header: "Description" },
  ];
  const costCodeColumns = [
    { field: "COST_CODE", header: "Code" },
    { field: "COST_NAME", header: "Name" },
  ];
  const supplierColumns = [
    { field: "SUPPLIER_CODE", header: "Code" },
    { field: "SUPPLIER_NAME", header: "Name" },
  ];
  const taxTypeColumns = [
    { field: "TX_TYPE_CODE", header: "Code" },
    { field: "TX_TYPE_NAME", header: "Name" },
    { field: "TX_TYPE_DESC", header: "Description" },
  ];
  const capexOptions = ["CAPEX", "OPEX", "NON-OPEX"];
  const cashIndOptions = [
    { value: "Y", label: "Cash" },
    { value: "N", label: "Credit" }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <section className="payment-workbench commercial-editor grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]">
        <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                  {isViewMode ? "View Document" : isEditMode ? "Edit Document" : "New Document"}
                </p>
                <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">
                  {docType !== "PR" ? "Purchase Order" : "Purchase Request"}
                </h2>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Doc No</span>
                <strong className="block text-sm leading-tight text-primary-foreground">
                  {docType !== "PR" ? (docNo || "New") : (requestNumber || "New")}
                </strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Flow Code</span>
                <strong className="block text-sm leading-tight text-primary-foreground">
                  {header.FLOW_CODE || "—"}
                </strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Total</span>
                <strong className="block text-sm leading-tight text-emerald-300">{fmt3(totalAmount)}</strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Net Amount</span>
                <strong className="block text-sm leading-tight text-emerald-300">{fmt3(totalFinalAmount)}</strong>
              </div>
              {(header as any).purch_status && (
                <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Status</span>
                  <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">{(header as any).purch_status}</Badge>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditMode && <Button type="button" variant="secondary" onClick={() => setLogOpen(true)}><FileText size={15} /> Log</Button>}
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}><X size={16} /></Button>
            </div>
          </div>
        </CardHeader>

        <div className="min-h-0 flex flex-1 flex-col overflow-hidden p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading document...</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

              {/* ─── Header Section ─── */}
              <div className="flex-none rounded-md border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                  <div>
                    <p className="eyebrow m-0">Header</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Request Information</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHeaderExpanded((v) => !v)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {headerExpanded ? "Compact header" : "Full header"}
                  </button>
                </div>

                {headerExpanded ? (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 p-3 items-start">
                    {/* ── DOCUMENT box ── */}
                    <div className="rounded-md border">
                      <div className="border-b bg-muted/40 px-3 py-1.5">
                        <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-blue-700">Document</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 p-3">
                        <div className="col-span-1">
                          <label className="field">
                            <span>Doc No</span>
                            <Input disabled value={requestNumber || "New"} className="bg-muted/30 w-full" />
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>POD Type *</span>
                            <Select
                              disabled={disabled}
                              value={header.PDO_TYPE || "N"}
                              onChange={(e) => setHdr("PDO_TYPE", e.target.value)}
                              className="w-full"
                            >
                              <option value="P">PDO-OTO</option>
                              <option value="Q">PDO-NON-OTO</option>
                              <option value="N">NON-PDO</option>
                            </Select>
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>Request Date</span>
                            <Input
                              disabled
                              type="text"
                              placeholder="dd/mm/yyyy"
                              value={displayDate}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDisplayDate(value);

                                const parts = value.split('/');
                                if (parts.length === 3) {
                                  const day = parseInt(parts[0]);
                                  const month = parseInt(parts[1]) - 1;
                                  const year = parseInt(parts[2]);
                                  const date = new Date(year, month, day);
                                  if (!isNaN(date.getTime())) {
                                    const yyyy = date.getFullYear();
                                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                                    const dd = String(date.getDate()).padStart(2, '0');
                                    setHdr("REQUEST_DATE", `${yyyy}-${mm}-${dd}`);
                                  }
                                }
                              }}
                              className="w-full"
                            />
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>Flow Code</span>
                            <Input
                              disabled
                              value={String(header.FLOW_CODE || "")}
                              placeholder="Flow Code"
                              className="w-full bg-muted/50"
                            />
                          </label>
                        </div>
                        <div className="col-span-2 grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="field">
                              <span>Division</span>
                              <Input
                                disabled
                                value={
                                  header.DIV_CODE && header.DIV_NAME
                                    ? `${header.DIV_CODE} - ${header.DIV_NAME}`
                                    : header.DIV_CODE || "—"
                                }
                                className="w-full bg-muted/50 text-blue-700 font-medium"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── CURRENCY & TAX box ── */}
                    <div className="rounded-md border">
                      <div className="border-b bg-muted/40 px-3 py-1.5">
                        <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-blue-700">Currency &amp; Tax</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 p-3">
                        <div className="col-span-2">
                          <label className="field">
                            <span>Currency *</span>
                            <div className="w-full">
                              <LookupField
                                label=""
                                compact
                                placeholder="Search Currency"
                                value={header.CURR_CODE || ""}
                                displayValue={
                                  header.CURR_CODE && header.CURR_NAME
                                    ? `${header.CURR_CODE} - ${header.CURR_NAME}`
                                    : header.CURR_CODE || ""
                                }
                                columns={currencyColumns}
                                valueField="CURR_CODE"
                                displayFields={["CURR_CODE", "CURR_NAME", "EX_RATE"]}
                                loadOptions={() => almsCommonSelect({
                                  parameter: "PS_PREQUEST_ENTRY_CURRENCY",
                                  loginid,
                                  code1: companyCode,
                                  code2: loginid,
                                  code3: "",
                                  code4: ""
                                })}
                                onChange={(value, row) => {
                                  const currName = String(row?.CURR_NAME || row?.curr_name || "");
                                  const exRate = Number(row?.EX_RATE || row?.ex_rate || header.CURRENCY_RATE || 1);

                                  setHdr("CURR_CODE", value);
                                  setHdr("CURR_NAME", currName);
                                  setHdr("CURRENCY_RATE", exRate);

                                  updateAllItemsWithHeader({
                                    CURR_CODE: value,
                                    CURR_NAME: currName,
                                    CURRENCY_RATE: exRate,
                                  });
                                }}
                                disabled={disabled}
                              />
                            </div>
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>Exchange Rate</span>
                            <Input
                              disabled={disabled}
                              type="number"
                              step="0.0001"
                              value={header.CURRENCY_RATE ?? ""}
                              onChange={(e) => {
                                const rate = Number(e.target.value);
                                setHdr("CURRENCY_RATE", rate);
                                updateAllItemsWithHeader({ CURRENCY_RATE: rate });
                              }}
                              className="w-full"
                            />
                          </label>
                        </div>

                        <div className="col-span-2">
                          <label className="field">
                            <span>Tax Category</span>
                            <div className="w-full">
                              <LookupField
                                label=""
                                compact
                                placeholder="Search Tax Category"
                                value={header.TX_CAT_CODE || ""}
                                displayValue={
                                  header.TX_CAT_CODE && header.TX_CAT_NAME
                                    ? `${header.TX_CAT_CODE} - ${header.TX_CAT_NAME}`
                                    : header.TX_CAT_CODE || ""
                                }
                                columns={taxCategoryColumns}
                                valueField="TX_CAT_CODE"
                                displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
                                loadOptions={() => almsCommonSelect({
                                  parameter: "PS_PREQUEST_ENTRY_TAX",
                                  loginid,
                                  code1: companyCode,
                                  code2: loginid,
                                  code3: "",
                                  code4: ""
                                })}
                                onChange={(val, row) => {
                                  if (row) {
                                    const taxCode = String(row.TX_COMPNTCAT_CODE_1 || "");
                                    const taxPercent = Number(row.TX_COMPNT_PERC_1) || 0;
                                    const taxName = String(row.TX_CAT_NAME || "");

                                    setHdr("TX_CAT_CODE", val);
                                    setHdr("TX_CAT_NAME", taxName);
                                    setHdr("TX_COMPNTCAT_CODE_1", taxCode);
                                    setHdr("TX_COMPNT_PERC_1", taxPercent);

                                    updateAllItemsWithHeader({
                                      TX_CAT_CODE: val,
                                      TX_CAT_NAME: taxName,
                                      TX_COMPNTCAT_CODE_1: taxCode,
                                      TX_COMPNT_PERC_1: taxPercent,
                                    });
                                  }
                                }}
                                disabled={disabled}
                              />
                            </div>
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>Tax Type</span>
                            <Select
                              value={String(header.TAX_TYPE || "N")}
                              disabled={disabled}
                              onChange={(e) => {
                                const v = e.target.value;
                                const perc = v === "S" ? 5 : 0;
                                setHdr("TAX_TYPE", v);
                                setItems((prev) =>
                                  prev.map((item) => {
                                    const merged: TPRItem = { ...item, TAX_TYPE: v, TX_COMPNT_PERC_1: perc };
                                    const exRate = num(merged.CURRENCY_RATE) || 1;
                                    return recalcItem(merged, exRate, userApprovalLevel);
                                  })
                                );
                              }}
                              className="w-full"
                            >
                              <option value="S">YES</option>
                              <option value="N">No</option>
                            </Select>
                          </label>
                        </div>
                        <div className="col-span-2">
                          <label className="field">
                            <span>Tax Code</span>
                            <div className="w-full">
                              <LookupField
                                label=""
                                compact
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
                                loadOptions={() => almsCommonSelect({
                                  parameter: "PS_PREQUEST_ENTRY_TAX_COMPONENT",
                                  loginid,
                                  code1: companyCode,
                                  code2: loginid,
                                  code3: "",
                                  code4: ""
                                })}
                                onChange={(val, row) => {
                                  if (row && typeof row === 'object') {
                                    const taxComponentName = String(row.TX_COMPNTCAT_NAME || '');
                                    const taxPercent = Number(row.TX_PERCNT) || 0;

                                    setHdr("TX_COMPNTCAT_CODE_1", val);
                                    setHdr("TX_COMPNTCAT_NAME", taxComponentName);
                                    setHdr("TX_COMPNT_PERC_1", taxPercent);

                                    updateAllItemsWithHeader({
                                      TX_COMPNTCAT_CODE_1: val,
                                      TX_COMPNTCAT_NAME: taxComponentName,
                                      TX_COMPNT_PERC_1: taxPercent,
                                    });
                                  } else {
                                    setHdr("TX_COMPNTCAT_CODE_1", val);
                                    updateAllItemsWithHeader({
                                      TX_COMPNTCAT_CODE_1: val,
                                    });
                                  }
                                }}
                                disabled={disabled}
                              />
                            </div>
                          </label>
                        </div>

                      </div>
                    </div>

                    {/* ── REMARKS box ── */}
                    <div className="rounded-md border w-full lg:col-span-2">
                      <div className="border-b bg-muted/40 px-3 py-1.5">
                        <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-blue-700">Description &amp; Remarks</p>
                      </div>
                      <div className="flex flex-col gap-2.5 p-3">
                        <label className="field">
                          <span>Description / Reason *</span>
                          <textarea
                            disabled={disabled}
                            value={String(header.DESCRIPTION || "")}
                            onChange={(e) => {
                              setHdr("DESCRIPTION", e.target.value);
                              const target = e.target;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none overflow-hidden min-h-[40px]"
                            placeholder="Enter description or reason..."
                            rows={1}
                            style={{ height: 'auto' }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                          />

                        </label>
                        <label className="field">
                          <span>Remarks *</span>
                          <textarea
                            disabled={disabled}
                            value={String(header.REMARKS || "")}
                            onChange={(e) => {
                              setHdr("REMARKS", e.target.value);
                              const target = e.target;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none overflow-hidden min-h-[40px]"
                            placeholder="Enter remarks..."
                            rows={1}
                            style={{ height: 'auto' }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2 text-sm text-muted-foreground">
                    <span>
                      <strong className="text-foreground">Doc No:</strong> {requestNumber || "New"}
                    </span>
                    <span>
                      <strong className="text-foreground">Flow Code:</strong> {header.FLOW_CODE || "—"}
                    </span>
                    <span>
                      <strong className="text-foreground">Currency:</strong> {header.CURR_CODE || "—"}
                    </span>
                    {(header as any).purch_status && (
                      <span>
                        <strong className="text-foreground">Status:</strong> {(header as any).purch_status}
                      </span>
                    )}
                    <span>
                      <strong className="text-foreground">Remarks:</strong> {header.REMARKS || "—"}
                    </span>
                  </div>
                )}
              </div>

              {/* ─── Tabs Container ─── */}
              <div className="flex min-h-0 flex-1 flex-col rounded-md border bg-card overflow-hidden">
                <div className="flex flex-none items-center border-b bg-secondary/40">
                  <button
                    onClick={() => setActiveTab("items")}
                    className={`px-4 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === "items"
                      ? 'border-primary text-primary bg-background'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Details Items
                  </button>

                  {shouldShowTermsTab() && (
                    <button
                      onClick={() => setActiveTab("terms")}
                      className={`px-4 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === "terms"
                        ? 'border-primary text-primary bg-background'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Terms & Conditions
                    </button>
                  )}

                  <div className="ml-auto px-3">
                    {!isViewMode && activeTab === "items" && (
                      <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={addItemLine}>
                        <Plus size={14} /> Add Line
                      </Button>
                    )}
                    {!isViewMode && activeTab === "terms" && shouldShowTermsTab() && (
                      <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={addTermLine}>
                        <Plus size={14} /> Add Line
                      </Button>
                    )}
                  </div>
                </div>

                {/* ─── Items Tab Content ─── */}
                {activeTab === "items" && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div
                      ref={tableContainerRef}
                      className="commercial-lines-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto"
                      style={{ overscrollBehavior: 'contain' }}
                    >
                      <table className="finance-lines-table w-full min-w-[3500px] text-[12px] border-separate border-spacing-0">
                        <thead className="sticky top-0 z-30 bg-primary text-xs text-primary-foreground">
                          <tr>
                            <th className="sticky left-0 z-40 bg-primary px-2 py-2 text-center w-[45px] min-w-[45px] max-w-[45px] border-r border-primary-foreground/10">
                              No
                            </th>
                            <th className="sticky left-[45px] z-40 bg-primary px-2 py-2 text-left w-[450px] min-w-[450px] max-w-[450px] border-r border-primary-foreground/10">
                              Item *
                            </th>
                            <th className="px-2 py-2 text-left w-[280px] min-w-[300px] max-w-[280px]">Cost Code *</th>
                            <th className="px-2 py-2 text-center w-[80px] min-w-[150px] max-w-[80px]">Req Qty</th>
                            {shouldShowApprovedQty() && (
                              <th className="px-2 py-2 text-center w-[80px] min-w-[150px] max-w-[80px]">Appr Qty *</th>
                            )}
                            <th className="px-2 py-2 text-right w-[90px] min-w-[150px] max-w-[90px]">Unit Price *</th>
                            <th className="px-2 py-2 text-center w-[75px] min-w-[220px] max-w-[75px]">Currency</th>
                            <th className="px-2 py-2 text-right w-[80px] min-w-[150px] max-w-[80px]">Ex Rate</th>
                            {shouldShowSupplier() && (
                              <th className="px-2 py-2 text-left w-[250px] min-w-[550px] max-w-[250px]">Supplier *</th>
                            )}
                            <th className="px-2 py-2 text-right w-[80px] min-w-[150px] max-w-[80px]">Quantity</th>
                            <th className="px-2 py-2 text-right w-[65px] min-w-[150px] max-w-[65px]">Disc %</th>
                            <th className="px-2 py-2 text-right w-[90px] min-w-[150px] max-w-[90px]">Disc Price</th>
                            <th className="px-2 py-2 text-right w-[90px] min-w-[150px] max-w-[150px]">Unit price Net Amt</th>
                            <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[150px] max-w-[100px]">Amount</th>
                            <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[150px] max-w-[100px]">Lcurr Amount</th>
                            <th className="px-2 py-2 text-left w-[280px] min-w-[330px] max-w-[280px]">Tax Cat</th>
                            <th className="px-2 py-2 text-left w-[280px] min-w-[300px] max-w-[280px]">Tax Code</th>
                            <th className="px-2 py-2 text-right w-[65px] min-w-[150px] max-w-[65px]">Tax %</th>
                            <th className="finance-amount-cell px-2 py-2 text-right w-[90px] min-w-[150px] max-w-[90px]">Tax Amount</th>
                            <th className="px-2 py-2 text-center w-[90px] min-w-[200px] max-w-[90px]">Tax Type</th>
                            <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[150px] max-w-[100px]">Tax Lcurr amount</th>
                            <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[150px] max-w-[100px]">Lcurr after Discount</th>
                            <th className="px-2 py-2 text-center w-[95px] min-w-[150px] max-w-[95px]">Capex</th>
                            <th className="px-2 py-2 text-center w-[80px] min-w-[100px] max-w-[80px]">Cash Indicator</th>
                            <th className="px-2 py-2 text-center w-[55px] min-w-[55px] max-w-[55px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={25}>No items yet. Click "Add Line" to add items.</td></tr>
                          ) : items.map((item) => {
                            const itemId = (item as any).id || String(item.ITEM_SRNO);

                            const itemDisplay = item.ITEM_CODE && item.ITEM_DESP
                              ? `${item.ITEM_CODE} - ${item.ITEM_DESP}`
                              : (item.ITEM_CODE || "");

                            const costDisplay = item.COST_CODE && item.COST_NAME
                              ? `${item.COST_CODE} - ${item.COST_NAME}`
                              : (item.COST_CODE || "");

                            const supplierDisplay = item.SUPPLIER && item.SUPPLIER_NAME
                              ? `${item.SUPPLIER} - ${item.SUPPLIER_NAME}`
                              : (item.SUPPLIER || "");

                            const taxCategoryDisplay = item.TX_CAT_CODE && (item as any).TX_CAT_NAME
                              ? `${item.TX_CAT_CODE} - ${(item as any).TX_CAT_NAME}`
                              : (item.TX_CAT_CODE || "");

                            const taxComponentDisplay = item.TX_COMPNTCAT_CODE_1 && (item as any).TX_COMPNTCAT_NAME
                              ? `${item.TX_COMPNTCAT_CODE_1} - ${(item as any).TX_COMPNTCAT_NAME}`
                              : (item.TX_COMPNTCAT_CODE_1 || "");

                            const currencyDisplay = item.CURR_CODE && (item as any).CURR_NAME
                              ? `${item.CURR_CODE} - ${(item as any).CURR_NAME}`
                              : (item.CURR_CODE || "");

                            return (
                              <tr className="border-t odd:bg-muted/20 hover:bg-muted/40" key={itemId}>
                                <td className="sticky left-0 z-20 bg-background px-2 py-1 text-xs text-center w-[45px] min-w-[45px] max-w-[45px] border-r border-border">
                                  {item.ITEM_SRNO}
                                </td>
                                <td className="sticky left-[45px] z-20 bg-background px-2 py-1 w-[350px] min-w-[350px] max-w-[350px] border-r border-border">
                                  <LookupField
                                    label=""
                                    compact
                                    placeholder="Search Item *"
                                    value={item.ITEM_CODE || ""}
                                    displayValue={itemDisplay}
                                    columns={itemCodeColumns}
                                    valueField="item_code"
                                    displayFields={["item_code", "item_desp"]}
                                    loadOptions={() => almsCommonSelect({
                                      parameter: "PS_PREQUEST_ENTRY_ITEMS",
                                      loginid,
                                      code1: companyCode,
                                      code2: loginid,
                                      code3: "",
                                      code4: ""
                                    })}
                                    onChange={(val, row) => {
                                      updateItemField(itemId, "ITEM_CODE", val);
                                      if (row) {
                                        updateItemField(itemId, "ITEM_DESP", row.item_desp ?? row.ITEM_DESP ?? "");
                                      }
                                    }}
                                    disabled={disabled}
                                  />
                                </td>
                                <td className="px-2 py-1 w-[280px] min-w-[280px] max-w-[280px]">
                                  <LookupField
                                    label=""
                                    compact
                                    placeholder="Cost Code *"
                                    value={item.COST_CODE || ""}
                                    displayValue={costDisplay}
                                    columns={costCodeColumns}
                                    valueField="cost_code"
                                    displayFields={["cost_code", "cost_name"]}
                                    loadOptions={() => almsCommonSelect({
                                      parameter: "PS_PREQUEST_ENTRY_COSTS",
                                      loginid,
                                      code1: companyCode,
                                      code2: loginid,
                                      code3: "",
                                      code4: ""
                                    })}
                                    onChange={(val, row) => {
                                      updateItemField(itemId, "COST_CODE", val);
                                      if (row) {
                                        updateItemField(itemId, "COST_NAME", row.cost_name ?? row.COST_NAME ?? "");
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
                                {shouldShowApprovedQty() && (
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
                                )}
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
                                    value={currencyDisplay}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const code = val.split(" - ")[0] || val;
                                      updateItemField(itemId, "CURR_CODE", code);
                                      const name = val.split(" - ")[1] || "";
                                      if (name) {
                                        updateItemField(itemId, "CURR_NAME", name);
                                      }
                                    }}
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
                                {shouldShowSupplier() && (
                                  <td className="px-2 py-1 w-[250px] min-w-[250px] max-w-[250px]">
                                    <LookupField
                                      label=""
                                      compact
                                      placeholder="Supplier *"
                                      value={item.SUPPLIER || ""}
                                      displayValue={supplierDisplay}
                                      columns={supplierColumns}
                                      valueField="supplier_code"
                                      displayFields={["supplier_code", "supplier_name"]}
                                      loadOptions={() => almsCommonSelect({
                                        parameter: "PS_PREQUEST_ENTRY_SUPPLIERS",
                                        loginid,
                                        code1: companyCode,
                                        code2: loginid,
                                        code3: "",
                                        code4: ""
                                      })}
                                      onChange={(val, row) => {
                                        const oldSupplier = item.SUPPLIER;

                                        updateItemField(itemId, "SUPPLIER", val);

                                        if (row) {
                                          const supName = row.supplier_name ?? row.SUPPLIER_NAME ?? "";

                                          updateItemField(itemId, "SUPPLIER_NAME", supName);
                                          updateItemField(itemId, "SUPPLIER_CODE", row.supplier_code ?? val);

                                          upsertTermForSupplier(val, supName as any);

                                          if (oldSupplier && oldSupplier !== val) {
                                            const stillUsed = items.some(
                                              i =>
                                                (i as any).id !== itemId &&
                                                i.SUPPLIER === oldSupplier
                                            );

                                            if (!stillUsed) {
                                              setTerms(prev =>
                                                prev.filter(t => t.SUPPLIER !== oldSupplier)
                                              );
                                            }
                                          }
                                        }
                                      }}
                                      disabled={disabled}
                                    />
                                  </td>
                                )}
                                <td className="finance-amount-cell px-2 py-1 text-right w-[80px] min-w-[80px] max-w-[80px]">
                                  {fmt3(itemQty(item, userApprovalLevel))}
                                </td>
                                <td className="px-2 py-1 w-[65px] min-w-[65px] max-w-[65px]">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.DISCOUNT_AMOUNT || ""}
                                    onChange={(e) => updateItemField(itemId, "DISCOUNT_AMOUNT", Number(e.target.value) || 0)}
                                    disabled={disabled}
                                    className="h-9 text-right text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="finance-amount-cell px-2 py-1 text-right w-[90px] min-w-[90px] max-w-[90px]">
                                  {fmt3(itemDiscPrice(item))}
                                </td>
                                <td className="finance-amount-cell px-2 py-1 text-right w-[90px] min-w-[90px] max-w-[90px]">
                                  {fmt3(item.FINAL_RATE)}
                                </td>
                                <td className="finance-amount-cell px-2 py-1 text-right font-semibold text-green-600 w-[100px] min-w-[100px] max-w-[100px]">
                                  {fmt3(item.AMOUNT)}
                                </td>
                                <td className="finance-amount-cell px-2 py-1 text-right text-green-600 w-[100px] min-w-[100px] max-w-[100px]">
                                  {fmt3((item as any).LCURR_AMT || 0)}
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
                                    loadOptions={() => almsCommonSelect({
                                      parameter: "PS_PREQUEST_ENTRY_TAX",
                                      loginid,
                                      code1: companyCode,
                                      code2: loginid,
                                      code3: "",
                                      code4: ""
                                    })}
                                    onChange={(val, row) => {
                                      updateItemField(itemId, "TX_CAT_CODE", val);
                                      if (row) {
                                        updateItemField(itemId, "TX_CAT_NAME", row.TX_CAT_NAME || "");
                                        updateItemField(itemId, "TX_COMPNTCAT_CODE_1", row.TX_COMPNTCAT_CODE_1 || "");
                                        updateItemField(itemId, "TX_COMPNT_PERC_1", row.TX_COMPNT_PERC_1 || 0);
                                      }
                                    }}
                                    disabled={disabled}
                                  />
                                </td>
                                <td className="px-2 py-1 w-[280px] min-w-[280px] max-w-[280px]">
                                  <LookupField
                                    label=""
                                    compact
                                    placeholder="Tax Component"
                                    value={item.TX_COMPNTCAT_CODE_1 || ""}
                                    displayValue={taxComponentDisplay}
                                    columns={taxComponentColumns}
                                    valueField="TX_COMPNTCAT_CODE"
                                    displayFields={["TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME"]}
                                    loadOptions={() => almsCommonSelect({
                                      parameter: "PS_PREQUEST_ENTRY_TAX_COMPONENT",
                                      loginid,
                                      code1: companyCode,
                                      code2: loginid,
                                      code3: "",
                                      code4: ""
                                    })}
                                    onChange={(val, row) => {
                                      updateItemField(itemId, "TX_COMPNTCAT_CODE_1", val);
                                      if (row) {
                                        updateItemField(itemId, "TX_COMPNTCAT_NAME", row.TX_COMPNTCAT_NAME || "");
                                        if (row.TX_PERCNT !== undefined) {
                                          updateItemField(itemId, "TX_COMPNT_PERC_1", Number(row.TX_PERCNT) || 0);
                                        }
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
                                <td className="finance-amount-cell px-2 py-1 text-right text-green-600 w-[90px] min-w-[90px] max-w-[90px]">
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
                                    loadOptions={() => almsCommonSelect({
                                      parameter: "PS_PREQUEST_ENTRY_TAX_TYPE",
                                      loginid,
                                      code1: companyCode,
                                      code2: loginid,
                                      code3: "",
                                      code4: ""
                                    })}
                                    onChange={(val) => updateItemField(itemId, "TAX_TYPE", val)}
                                    disabled={disabled}
                                  />
                                </td>
                                <td className="finance-amount-cell px-2 py-1 text-right text-green-600 w-[100px] min-w-[100px] max-w-[100px]">
                                  {fmt3((item as any).TX_COMPNT_LCURAMT_1 || 0)}
                                </td>
                                <td className="finance-amount-cell px-2 py-1 text-right font-semibold text-blue-600 w-[100px] min-w-[100px] max-w-[100px]">
                                  {fmt3((item as any).LCURR_AFTER_DISCOUNT || 0)}
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
                                <td className="px-2 py-1 w-[80px] min-w-[80px] max-w-[80px]">
                                  <Select
                                    className="h-9 text-sm"
                                    value={item.CASH_IND || "N"}
                                    onChange={(e) => updateItemField(itemId, "CASH_IND", e.target.value)}
                                    disabled={disabled}
                                  >
                                    {cashIndOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
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

                    {/* ─── Summary Footer ─── */}
                    <div className="flex-none border-t bg-gradient-to-r from-gray-50/80 to-white/80 backdrop-blur-sm shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-end px-2 py-1">
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider eyebrow m-0">Base Amount</span>
                            <div className="text-sm font-semibold text-emerald-700">{fmt3(totalBase)}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider eyebrow m-0">Tax</span>
                            <div className="text-sm font-semibold text-emerald-700">{fmt3(totalTax)}</div>
                          </div>
                          <div className="h-8 w-px bg-border"></div>
                          <div className="text-right">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider eyebrow m-0">Net Amount</span>
                            <div className="text-xl font-bold text-emerald-700">{fmt3(totalFinalAmount)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Terms Tab Content ─── */}
                {activeTab === "terms" && shouldShowTermsTab() && (
                  <div className="commercial-lines-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                    <div className="relative">
                      <table className="finance-lines-table w-full min-w-[1200px] text-[12px] border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-primary text-xs text-primary-foreground">
                          <tr>
                            <th className="px-2 py-2 text-left w-[180px] min-w-[180px]">Supplier</th>
                            <th className="px-2 py-2 text-left w-[180px] min-w-[180px]">Delivery Term</th>
                            <th className="px-2 py-2 text-left w-[220px] min-w-[220px]">Payment Terms</th>
                            <th className="px-2 py-2 text-left w-[160px] min-w-[160px]">Warranty</th>
                            <th className="px-2 py-2 text-left w-[360px] min-w-[360px]">Remarks</th>
                            <th className="px-2 py-2 text-center w-[55px] min-w-[55px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {terms.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>No terms yet.</td></tr>
                          ) : terms.map((term) => {
                            const termSupplierDisplay = term.SUPPLIER && term.SUPPLIER_NAME
                              ? `${term.SUPPLIER} - ${term.SUPPLIER_NAME}`
                              : (term.SUPPLIER || "");

                            return (
                              <tr className="border-t odd:bg-muted/20 hover:bg-muted/40" key={term.id}>
                                <td className="px-2 py-1 w-[260px] min-w-[260px]">
                                  <LookupField
                                    label=""
                                    compact
                                    placeholder="Supplier"
                                    value={term.SUPPLIER || ""}
                                    displayValue={termSupplierDisplay}
                                    columns={supplierColumns}
                                    valueField="supplier_code"
                                    displayFields={["supplier_code", "supplier_name"]}
                                    loadOptions={() => almsCommonSelect({
                                      parameter: "PS_PREQUEST_ENTRY_SUPPLIERS",
                                      loginid,
                                      code1: companyCode,
                                      code2: loginid,
                                      code3: "",
                                      code4: ""
                                    })}
                                    onChange={(val, row) => {
                                      updateTermField(term.id, "SUPPLIER", val);
                                      if (row) {
                                        const supName = row.supplier_name ?? row.SUPPLIER_NAME ?? "";
                                        updateTermField(term.id, "SUPPLIER_NAME", supName);
                                      }
                                    }}
                                    disabled={disabled}
                                  />
                                </td>
                                <td className="px-2 py-1 w-[180px] min-w-[180px]">
                                  <Input
                                    value={term.DLVR_TERM || ""}
                                    onChange={(e) => updateTermField(term.id, "DLVR_TERM", e.target.value)}
                                    disabled={disabled}
                                    className="h-9 text-sm"
                                    placeholder="Delivery Term"
                                  />
                                </td>
                                <td className="px-2 py-1 w-[220px] min-w-[220px]">
                                  <Input
                                    value={term.PAYMENT_TERMS || ""}
                                    onChange={(e) => updateTermField(term.id, "PAYMENT_TERMS", e.target.value)}
                                    disabled={disabled}
                                    className="h-9 text-sm"
                                    placeholder="Payment Terms"
                                  />
                                </td>
                                <td className="px-2 py-1 w-[160px] min-w-[160px]">
                                  <Input
                                    value={term.WARRANTY || ""}
                                    onChange={(e) => updateTermField(term.id, "WARRANTY", e.target.value)}
                                    disabled={disabled}
                                    className="h-9 text-sm"
                                    placeholder="Warranty"
                                  />
                                </td>
                                <td className="px-2 py-1 w-[260px] min-w-[260px]">
                                  <Input
                                    value={term.REMARKS || ""}
                                    onChange={(e) => updateTermField(term.id, "REMARKS", e.target.value)}
                                    disabled={disabled}
                                    className="h-9 text-sm"
                                    placeholder="Remarks"
                                  />
                                </td>
                                <td className="px-2 py-1 text-center w-[55px] min-w-[55px]">
                                  {!isViewMode && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      type="button"
                                      onClick={() => removeTerm(term.id)}
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
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-1">
          {!isViewMode && !(docType !== "PR") && (
            <div className="flex items-center gap-2">
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-slate-600 hover:bg-slate-700" onClick={handleSaveDraft}> <Save size={15} /> {savingAction === "SAVEASDRAFT" ? "Saving..." : "Save Draft"}</Button>
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-blue-600 hover:bg-blue-700" onClick={handleSubmit}>  <Send size={15} /> {savingAction === "SUBMITTED" ? "Submitting..." : "Submit"}</Button>
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove}>  <CheckCircle size={15} /> {savingAction === "APPROVED" ? "Approving..." : "Approve"}</Button>
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-purple-600 hover:bg-purple-700" onClick={() => { setRemarkText(""); setSendBackOpen(true); }}><ChevronLeft size={15} /> Send Back</Button>
              <Button
                disabled={saving}
                type="button"
                variant="default"
                className="min-w-[110px] justify-center bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  setRemarkText("");
                  setRejectOpen(true);
                }}
              >
                <X size={15} /> {savingAction === "REJECTED" ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button disabled={saving} type="button" variant="default" className="min-w-[100px] justify-center bg-gray-600 hover:bg-gray-700" onClick={handlePrint}>
              <Printer size={15} /> Print
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAttachmentOpen(true)}>
              <Paperclip size={15} /> Files
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Attachments ─── */}
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

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectOpen} title="Reject Request" description="Enter the reason for rejection." onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={handleRejectConfirm}>
              Confirm Reject
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <label className="field">
            <span>Rejection Reason *</span>
            <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter reject remark..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </label>
          {!remarkText.trim() && (
            <span className="text-xs text-red-500">Rejection reason is required</span>
          )}
        </div>
      </Dialog>

      {/* ─── Send Back Dialog ─── */}
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
            <Select
              value={selectedSendBackTo}
              onChange={(e) => setSelectedSendBackTo(e.target.value)}
              className="w-full"
            >
              <option value="">Select user</option>
              {sendBackOptions.map((o) => (
                <option key={o.loginid} value={o.loginid}>{o.label}</option>
              ))}
            </Select>
            {!selectedSendBackTo && (
              <span className="text-xs text-red-500">Please select a user to send back</span>
            )}
          </label>
          <label className="field">
            <span>Send Back Reason *</span>
            <textarea
              rows={4}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="Enter send back reason..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {!remarkText.trim() && (
              <span className="text-xs text-red-500">Send back reason is required</span>
            )}
          </label>
        </div>
      </Dialog>
    </div>
  );
};

export default AddPRRequestPage;