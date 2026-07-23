import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Edit2, Save, Send, X, CheckCircle,
  ChevronLeft, Paperclip, FileText, Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
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
    FINAL_AMOUNT: 0,
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

  // ─── Supplier Terms state ─────────────────────────────────────────
  const [terms, setTerms] = useState<any[]>([]);

  const disabled = isViewMode || saving;

  // PDO Type mapping - Display values based on backend data
  const PDO_TYPE_MAP: Record<string, string> = {
    'P': 'PDO-OTO',
    'Q': 'PDO-NON-OTO',
    'N': 'NON-PDO'
  };

  // Helper function to get display value from data value
  const getPdoDisplayValue = (dataValue: string | undefined | null): string => {
    if (!dataValue) return '';
    return PDO_TYPE_MAP[dataValue] || dataValue;
  };

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
  // NEW: currency lookup, used to correctly resolve CURR_NAME for each item by its own CURR_CODE
  const { data: currencyList = [] } = useQuery<LookupItem[]>({
    queryKey: ["pr-currency-lookup", companyCode],
    queryFn: () => almsCommonSelect({ parameter: "Amlspf_MsPsCurrencyMaster", loginid, code1: companyCode }),
    enabled: !!companyCode,
  });

  // ─── Header & Items Queries ──────────────────────────────────────
  const { data: hdrList = [] } = useQuery<TPRHeader[]>({
    queryKey: ["pr-header", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRHeader>({ parameter: "Amlspf_TabPRHeader", loginid, code1: companyCode, code2: requestNumber }),
    enabled: isEditMode && !!requestNumber,
  });
  useEffect(() => {
    if (hdrList.length > 0) {
      const hdr = hdrList[0];
      setHeader(hdr);
      setLoading(false);
    }
    else if (!isEditMode) setLoading(false);
  }, [hdrList, isEditMode]);

  const { data: itemList = [] } = useQuery<TPRItem[]>({
    queryKey: ["pr-item-list", requestNumber, companyCode],
    queryFn: () => almsCommonSelect<TPRItem>({ parameter: "Amlspf_TabPRItems", loginid, code1: companyCode, code2: requestNumber }),
    enabled: isEditMode && !!requestNumber,
  });
  useEffect(() => {
    if (itemList.length === 0 || itemCodes.length === 0) return;
    const enriched = itemList.map((row) => ({
      ...row,
      id: (row as any).id || newId(),
      ITEM_DESP: row.ITEM_DESP || itemCodes.find((i) => i.ITEM_CODE === row.ITEM_CODE)?.ITEM_DESP || "",
      COST_NAME: row.COST_NAME || costCodes.find((c) => c.COST_CODE === row.COST_CODE)?.COST_NAME || "",
      SUPPLIER_NAME: (row as any).SUPPLIER_NAME || supplierList.find((s) => s.SUPPLIER_CODE === row.SUPPLIER)?.SUPPLIER_NAME || "",
      TX_CAT_NAME: (row as any).TX_CAT_NAME || taxCodes.find((t) => t.TX_CAT_CODE === row.TX_CAT_CODE)?.TX_CAT_NAME || "",
      // FIX: resolve CURR_NAME from the item's OWN CURR_CODE via currencyList,
      // instead of blindly falling back to header.CURR_NAME (was causing
      // "OMR - UAE DIRHAM" style mismatches).
      CURR_NAME: (row as any).CURR_NAME || currencyList.find((c) => c.CURR_CODE === row.CURR_CODE)?.CURR_NAME || "",
      BASE_AMOUNT: num(row.AMOUNT) * num(row.CURRENCY_RATE || header.CURRENCY_RATE || 1),
      FINAL_AMOUNT: (num(row.AMOUNT) * num(row.CURRENCY_RATE || header.CURRENCY_RATE || 1)) + num(row.TX_COMPNT_AMT_1),
    }));
    const renumbered = enriched.map((item, idx) => ({ ...item, ITEM_SRNO: idx + 1 }));
    setItems(renumbered);
    setLoading(false);
    // NOTE: header.CURR_NAME removed from deps on purpose — CURR_NAME is now
    // resolved from the item's own CURR_CODE via currencyList, not copied from header.
  }, [itemList, itemCodes, costCodes, supplierList, taxCodes, currencyList, header.CURRENCY_RATE]);

  // ─── Supplier Terms Query ──────────────────────────────────────────
  const { data: termsList = [] } = useQuery<any[]>({
    queryKey: ["pr-terms", requestNumber, companyCode],
    queryFn: () => almsCommonSelect({
      parameter: "Amlspf_TabPRTerms",
      loginid,
      code1: companyCode,
      code2: requestNumber,
      code3: "NULL",
      code4: "NULL",
      number1: 0,
      number2: 0,
      number3: 0,
      number4: 0,
    }),
    enabled: isEditMode && !!requestNumber,
  });
  useEffect(() => {
    if (termsList.length === 0) return;
    const enriched = termsList.map((row: any) => ({ ...row, id: row.id || newId() }));
    setTerms(enriched);
  }, [termsList]);

  const setHdr = (field: keyof TPRHeader, value: unknown) => setHeader((prev) => ({ ...prev, [field]: value }));

  const totalAmount = items.reduce((s, r) => s + num(r.AMOUNT), 0);
  const totalTax = items.reduce((s, r) => s + num(r.TX_COMPNT_AMT_1), 0);
  const totalBase = items.reduce((s, r) => s + num(r.BASE_AMOUNT), 0);
  const totalFinalAmount = items.reduce((s, r) => s + num(r.FINAL_AMOUNT), 0);
  const [headerExpanded, setHeaderExpanded] = useState(true);

  // ─── Save Functions ───────────────────────────────────────────────
 const saveHeader = async (status: string) => almsSave({
    parameter: "purchase_request_header_ins_upd",
    loginid,
    val1s1: requestNumber || "",
    val1s2: companyCode,
    val1s3: header.REQUEST_DATE ? String(header.REQUEST_DATE).slice(0, 10) : "",
    val1s4: header.DESCRIPTION || "",
    val1s5: header.REMARKS || "",
    val1s6: (header as any).DEPARTMENT_CODE || "",
    val1s7: "101", 
    val1s8: status,
    val1s9: header.CURR_CODE || "",
    val1s10: header.TX_CAT_CODE || "",
    val1s11: header.TX_COMPNTCAT_CODE_1 || "",
    val1s12: (header as any).SUPPLIER || "",
    val1s13: (header as any).COST_CODE || "",
    val1s14: (header as any).WARRANTY || "",
    val1s15: header.PDO_TYPE || "N",
    val1n1: header.FLOW_LEVEL_INITIAL || 1,
    val1n2: header.FLOW_LEVEL_RUNNING || 1,
    val1n3: header.FLOW_LEVEL_FINAL || 3,
    val1n4: totalAmount || 0,
    val1n5: header.CURRENCY_RATE || 1,
  });

  const saveItems = async () => {
    for (const item of items) {
      await almsSave({
        parameter: "purchase_request_details_ins_upd",
        loginid,
        val1s1: requestNumber || "",
        val1s2: companyCode,
        val1s3: item.ITEM_CODE || "",
        val1s4: item.COST_CODE || "",
        val1s5: item.SUPPLIER || "",
        val1s6: item.CURR_CODE || "",
        val1s7: item.TX_CAT_CODE || "",
        val1s8: item.TX_COMPNTCAT_CODE_1 || "",
        val1s9: "SAVE",
        val1s10: item.CAPEX_OPEX_NON_OPEX || "",
        val1n1: item.ITEM_SRNO || 0,
        val1n2: item.REQUEST_QUANTITY || 0,
        val1n3: item.ALLOCATED_APPROVED_QUANTITY || 0,
        val1n4: item.ITEM_RATE || 0,
        val1n5: item.DISCOUNT_AMOUNT || 0,
        val1n6: item.FINAL_RATE || 0,
        val1n7: item.AMOUNT || 0,
        val1n8: item.CURRENCY_RATE || 1,
        val1n9: item.TX_COMPNT_PERC_1 || 0,
        val1n10: item.TX_COMPNT_AMT_1 || 0,
      });
    }
  };

  // NOTE: Parameter name "Amlspf_IU_PURCHASE_REQUEST_TERMS" is assumed to
  // follow the same naming pattern as the header/details save procedures.
  // Confirm the actual save/insert-update parameter name with backend (Prem
  // Sir / Sandeep Sir) and update below if different.
  const saveTerms = async () => {
    for (const term of terms) {
      await almsSave({
        parameter: "Amlspf_IU_PURCHASE_REQUEST_TERMS",
        loginid,
        val1s1: requestNumber || "",
        val1s2: companyCode,
        val1s3: term.supplier || "",
        val1s4: term.dlvr_term || "",
        val1s5: term.payment_terms || "",
        val1s6: term.warranty || "",
        val1s7: term.remarks || "",
      });
    }
  };

  const runAction = async (status: string, successMsg: string) => {
    setSaving(true); setNotice(null);
    try {
      const result = await saveHeader(status);
      if (result.success) {
        await saveItems();
        await saveTerms();
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

  // ─── Update all items with header values ──────────────────────
  // FIX: accepts optional overrides so callers can pass freshly-selected
  // values immediately (avoids stale-closure bug where `header` state hasn't
  // updated yet right after setHdr() calls in the same event handler).
  const updateAllItemsWithHeader = (overrides: Partial<TPRHeader> = {}) => {
    const hdr = { ...header, ...overrides };
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        CURR_CODE: hdr.CURR_CODE || item.CURR_CODE || "",
        CURR_NAME: hdr.CURR_NAME || item.CURR_NAME || "",
        CURRENCY_RATE: hdr.CURRENCY_RATE || item.CURRENCY_RATE || 1,
        TX_CAT_CODE: hdr.TX_CAT_CODE || item.TX_CAT_CODE || "",
        TX_CAT_NAME: hdr.TX_CAT_NAME || item.TX_CAT_NAME || "",
        TX_COMPNTCAT_CODE_1: hdr.TX_COMPNTCAT_CODE_1 || item.TX_COMPNTCAT_CODE_1 || "",
        TX_COMPNT_PERC_1: hdr.TX_COMPNT_PERC_1 || item.TX_COMPNT_PERC_1 || 0,
        BASE_AMOUNT: num(item.AMOUNT) * num(hdr.CURRENCY_RATE || item.CURRENCY_RATE || 1),
        TX_COMPNT_AMT_1: (num(item.AMOUNT) * num(hdr.TX_COMPNT_PERC_1 || item.TX_COMPNT_PERC_1 || 0)) / 100,
        FINAL_AMOUNT: (num(item.AMOUNT) * num(hdr.CURRENCY_RATE || item.CURRENCY_RATE || 1)) +
                     ((num(item.AMOUNT) * num(hdr.TX_COMPNT_PERC_1 || item.TX_COMPNT_PERC_1 || 0)) / 100),
      }))
    );
  };

  // ─── Inline Item Functions ────────────────────────────────────────
  const addItemLine = () => {
    const srNo = items.length + 1;
    const blank = blankItem(srNo, requestNumber ?? "", companyCode, header);
    // Override with header values
    blank.CURR_CODE = header.CURR_CODE || "";
    blank.CURR_NAME = header.CURR_NAME || "";
    blank.CURRENCY_RATE = header.CURRENCY_RATE || 1;
    blank.TX_CAT_CODE = header.TX_CAT_CODE || "";
    blank.TX_CAT_NAME = header.TX_CAT_NAME || "";
    blank.TX_COMPNTCAT_CODE_1 = header.TX_COMPNTCAT_CODE_1 || "";
    blank.TX_COMPNT_PERC_1 = header.TX_COMPNT_PERC_1 || 0;
    (blank as any).id = newId();
    setItems([...items, blank]);
  };

  const removeItem = (id: string) => {
    const updated = items.filter((item) => (item as any).id !== id);
    const renumbered = updated.map((item, idx) => ({ ...item, ITEM_SRNO: idx + 1 }));
    setItems(renumbered);
  };

  // Update item field with recalculations
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
        item.FINAL_AMOUNT = item.BASE_AMOUNT + item.TX_COMPNT_AMT_1;
      }
      if (field === "ALLOCATED_APPROVED_QUANTITY") {
        const qty = num(value);
        item.AMOUNT = num(item.FINAL_RATE) * qty;
        item.BASE_AMOUNT = item.AMOUNT * num(item.CURRENCY_RATE);
        item.TX_COMPNT_AMT_1 = (item.AMOUNT * num(item.TX_COMPNT_PERC_1)) / 100;
        item.FINAL_AMOUNT = item.BASE_AMOUNT + item.TX_COMPNT_AMT_1;
      }
      if (field === "CURRENCY_RATE") {
        const rate = num(value);
        item.CURRENCY_RATE = rate;
        item.BASE_AMOUNT = num(item.AMOUNT) * rate;
        item.TX_COMPNT_AMT_1 = (num(item.AMOUNT) * num(item.TX_COMPNT_PERC_1)) / 100;
        item.FINAL_AMOUNT = item.BASE_AMOUNT + item.TX_COMPNT_AMT_1;
      }
      if (field === "TX_COMPNT_PERC_1") {
        const perc = num(value);
        item.TX_COMPNT_PERC_1 = perc;
        item.TX_COMPNT_AMT_1 = (num(item.AMOUNT) * perc) / 100;
        item.FINAL_AMOUNT = item.BASE_AMOUNT + item.TX_COMPNT_AMT_1;
      }
      if (field === "TX_CAT_CODE" && typeof value === 'string') {
        const found = taxCodes.find((t) => t.tx_cat_code === value);
        if (found) {
          item.TX_CAT_CODE = value;
          item.TX_CAT_NAME = found.tx_cat_name || "";
          item.TX_COMPNTCAT_CODE_1 = found.tx_compntcat_code_1 || "";
          item.TX_COMPNT_PERC_1 = found.tx_compnt_perc_1 || 0;
          item.TX_COMPNT_AMT_1 = (num(item.AMOUNT) * num(item.TX_COMPNT_PERC_1)) / 100;
          item.FINAL_AMOUNT = item.BASE_AMOUNT + item.TX_COMPNT_AMT_1;
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  // ─── Supplier Terms Inline Functions ───────────────────────────────
  const blankTerm = () => ({
    id: newId(),
    request_number: requestNumber || "",
    company_code: companyCode,
    supplier: "",
    dlvr_term: "",
    payment_terms: "",
    warranty: "",
    remarks: "",
    user_id: "",
    user_dt: null,
  });

  const addTermLine = () => setTerms((prev) => [...prev, blankTerm()]);

  const removeTerm = (id: string) => setTerms((prev) => prev.filter((t) => t.id !== id));

  const updateTermField = (id: string, field: string, value: unknown) => {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
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

  function formatDateToDDMMYYYY(USER_DT: any): string {
    if (USER_DT == null) return "";
    if (Array.isArray(USER_DT)) {
      return USER_DT.length > 0 ? String(USER_DT[0]) : "";
    }

    const raw = String(USER_DT).trim();
    if (!raw) return "";

    // Already formatted
    if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw;

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      // Try parsing YYYYMMDD or YYYY-MM-DD variants manually
      const ymd = raw.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
      if (ymd) {
        return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;
      }
      return "";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    return `${day}-${month}-${year}`;
  }

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
              <div className="rounded-md border bg-card overflow-hidden">
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
                            <span>Creator</span>
                            <Input
                              disabled={disabled}
                              value={String(header.CREATE_USER || "")}
                              onChange={(e) => setHdr("CREATE_USER", e.target.value)}
                              placeholder="Creator"
                              className="w-full"
                            />
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>POD Type *</span>
                            <Input
                              disabled={true}
                              value={getPdoDisplayValue(header.PDO_TYPE)}
                              placeholder="POD type"
                              className="w-full bg-muted/50"
                            />
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>Request Date</span>
                            <Input
  disabled={disabled}
  type="date"
  min={new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
  value={header.REQUEST_DATE ? String(header.REQUEST_DATE).slice(0, 10) : ""}
  onChange={(e) => setHdr("REQUEST_DATE", e.target.value)}
  className="w-full"
/>
                          </label>
                        </div>
                        <div className="col-span-1">
                          <label className="field">
                            <span>Creation Date</span>
                            <Input
                              disabled={disabled}
                              type="date"
                              value={header.CREATE_DATE ? String(header.CREATE_DATE).slice(0, 10) : ""}
                              onChange={(e) => setHdr("CREATE_DATE", e.target.value)}
                              className="w-full"
                            />
                          </label>
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
                                columns={[
                                  { field: "CURR_CODE", header: "Code" },
                                  { field: "CURR_NAME", header: "Name" },
                                  { field: "EX_RATE", header: "Ex Rate" }
                                ]}
                                valueField="CURR_CODE"
                                displayFields={["CURR_CODE", "CURR_NAME", "EX_RATE"]}
                                loadOptions={() => almsCommonSelect({
                                  parameter: "Amlspf_MsPsCurrencyMaster",
                                  loginid,
                                  code1: companyCode
                                })}
                                onChange={(value, row) => {
                                  const currName = String(row?.CURR_NAME || row?.curr_name || "");
                                  const exRate = Number(row?.EX_RATE || row?.ex_rate || header.CURRENCY_RATE || 1);

                                  setHdr("CURR_CODE", value);
                                  setHdr("CURR_NAME", currName);
                                  setHdr("CURRENCY_RATE", exRate);

                                  // FIX: pass fresh values directly instead of relying on
                                  // `header` state, which hasn't updated yet at this point
                                  // (stale closure was causing old currency to show in items).
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
                                // Update all items with new rate
                                setItems((prev) =>
                                  prev.map((item) => ({
                                    ...item,
                                    CURRENCY_RATE: rate,
                                    BASE_AMOUNT: num(item.AMOUNT) * rate,
                                    FINAL_AMOUNT: (num(item.AMOUNT) * rate) + num(item.TX_COMPNT_AMT_1),
                                  }))
                                );
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
                                columns={[
                                  { field: "TX_CAT_CODE", header: "Code" },
                                  { field: "TX_CAT_NAME", header: "Name" },
                                  { field: "TX_COMPNTCAT_CODE_1", header: "Tax Code" },
                                  { field: "TX_COMPNT_PERC_1", header: "Tax %" }
                                ]}
                                valueField="TX_CAT_CODE"
                                displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
                                loadOptions={() => almsCommonSelect({
                                  parameter: "Amlspf_MsPsTaxCategory",
                                  loginid,
                                  code1: companyCode
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

                                    // FIX: same stale-closure fix — pass fresh values directly.
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
                            <span>Tax Code</span>
                            <Input
                              disabled={disabled}
                              value={String(header.TX_COMPNTCAT_CODE_1 || "")}
                              onChange={(e) => setHdr("TX_COMPNTCAT_CODE_1", e.target.value)}
                              className="w-full"
                            />
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
                                  prev.map((item) => ({
                                    ...item,
                                    TAX_TYPE: v,
                                    TX_COMPNT_PERC_1: perc,
                                    TX_COMPNT_AMT_1: (num(item.AMOUNT) * perc) / 100,
                                    FINAL_AMOUNT: num(item.BASE_AMOUNT) + ((num(item.AMOUNT) * perc) / 100),
                                  }))
                                );
                              }}
                              className="w-full"
                            >
                              <option value="S">YES</option>
                              <option value="N">No</option>
                            </Select>
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
                          <span>Description / Reason</span>
                          <Input
                            disabled={disabled}
                            value={String(header.DESCRIPTION || "")}
                            onChange={(e) => setHdr("DESCRIPTION", e.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Remarks *</span>
                          <Input
                            disabled={disabled}
                            value={String(header.REMARKS || "")}
                            onChange={(e) => setHdr("REMARKS", e.target.value)}
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
                <div
                  className="commercial-lines-scroll overflow-x-auto overflow-y-auto"
                  style={{
                    minHeight: 0,
                    height: "fit-content",
                    maxHeight: "calc(100vh - 360px)"
                  }}
                >
                  <div className="relative">
                    <table className="finance-lines-table w-full min-w-[2400px] text-[12px]">
                      <thead className="sticky top-0 z-10 bg-primary text-xs text-primary-foreground">
                        <tr>
                          <th className="sticky left-0 z-20 bg-primary px-2 py-2 text-center w-[45px] min-w-[45px] max-w-[45px]">No</th>
                          <th className="sticky left-[45px] z-20 bg-primary px-2 py-2 text-left w-[350px] min-w-[630px] max-w-[350px]">Item</th>
                          <th className="px-2 py-2 text-left w-[280px] min-w-[300px] max-w-[280px]">Cost Code</th>
                          <th className="px-2 py-2 text-center w-[80px] min-w-[120px] max-w-[80px]">Req Qty</th>
                          <th className="px-2 py-2 text-center w-[80px] min-w-[120px] max-w-[80px]">Appr Qty</th>
                          <th className="px-2 py-2 text-right w-[90px] min-w-[120px] max-w-[90px]">Rate</th>
                          <th className="px-2 py-2 text-center w-[75px] min-w-[150px] max-w-[75px]">Currency</th>
                          <th className="px-2 py-2 text-right w-[80px] min-w-[100px] max-w-[80px]">Ex Rate</th>
                          <th className="px-2 py-2 text-left w-[250px] min-w-[480px] max-w-[250px]">Supplier</th>
                          <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[100px] max-w-[100px]">Amount</th>
                          <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[100px] max-w-[100px]">Base Amt</th>
                          <th className="px-2 py-2 text-center w-[100px] min-w-[100px] max-w-[100px]">Tax Code</th>
                          <th className="px-2 py-2 text-left w-[280px] min-w-[280px] max-w-[280px]">Tax Category</th>
                          <th className="px-2 py-2 text-right w-[65px] min-w-[95px] max-w-[65px]">Tax %</th>
                          <th className="finance-amount-cell px-2 py-2 text-right w-[90px] min-w-[90px] max-w-[90px]">Tax Amt</th>
                          <th className="px-2 py-2 text-center w-[90px] min-w-[150px] max-w-[90px]">Tax Type</th>
                          <th className="px-2 py-2 text-right w-[90px] min-w-[120px] max-w-[90px]">Discount</th>
                          <th className="px-2 py-2 text-right w-[90px] min-w-[90px] max-w-[90px]">Final Rate</th>
                          <th className="finance-amount-cell px-2 py-2 text-right w-[100px] min-w-[100px] max-w-[100px] font-bold bg-primary text-primary-foreground">Final Amt</th>
                          <th className="px-2 py-2 text-center w-[95px] min-w-[95px] max-w-[95px]">Capex</th>
                          <th className="px-2 py-2 text-center w-[55px] min-w-[55px] max-w-[55px]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={21}>No items yet. Click "Add Line" to add items.</td></tr>
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

                          const currencyDisplay = item.CURR_CODE && (item as any).CURR_NAME
                            ? `${item.CURR_CODE} - ${(item as any).CURR_NAME}`
                            : (item.CURR_CODE || "");

                          return (
                            <tr className="border-t odd:bg-muted/20 hover:bg-muted/40" key={itemId}>
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
                                    updateItemField(itemId, "SUPPLIER", val);
                                    if (row) {
                                      updateItemField(itemId, "SUPPLIER_NAME", row.supplier_name ?? row.SUPPLIER_NAME ?? "");
                                      updateItemField(itemId, "SUPPLIER_CODE", row.supplier_code ?? val);
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
                                      updateItemField(itemId, "TX_CAT_NAME", row.TX_CAT_NAME || "");
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
                              <td className="finance-amount-cell px-2 py-1 text-right font-bold w-[100px] min-w-[100px] max-w-[100px] bg-green-50">
                                {fmt3(item.FINAL_AMOUNT || 0)}
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
                  <span className="text-muted-foreground">Base Amount</span>
                  <strong className="text-primary">{fmt3(totalBase)}</strong>
                </div>
                <div className="flex items-center justify-end gap-8 px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <strong className="text-primary">{fmt3(totalTax)}</strong>
                </div>
                <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm font-bold">
                  <span className="text-muted-foreground">Net Amount</span>
                  <strong className="text-primary text-base">{fmt3(totalFinalAmount)}</strong>
                </div>
              </div>

              {/* ─── Supplier Terms Section ─── */}
              <div className="rounded-md border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                  <div>
                    <p className="eyebrow m-0">Terms and Conditions</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Supplier Terms</h3>
                  </div>
                  {!isViewMode && (
                    <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={addTermLine}>
                      <Plus size={14} /> Add Line
                    </Button>
                  )}
                </div>

                <div
                  className="commercial-lines-scroll overflow-x-auto overflow-y-auto"
                  style={{ minHeight: 0, height: "fit-content", maxHeight: "320px" }}
                >
                  <div className="relative">
                    <table className="finance-lines-table w-full min-w-[1200px] text-[12px]">
                      <thead className="sticky top-0 z-10 bg-primary text-xs text-primary-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left w-[200px] min-w-[200px]">Request Number</th>
                          <th className="px-2 py-2 text-left w-[200px] min-w-[200px]">Supplier</th>
                          <th className="px-2 py-2 text-left w-[180px] min-w-[180px]">Delivery Term</th>
                          <th className="px-2 py-2 text-left w-[220px] min-w-[220px]">Payment Terms</th>
                          <th className="px-2 py-2 text-left w-[160px] min-w-[160px]">Warranty</th>
                          <th className="px-2 py-2 text-left w-[260px] min-w-[660px]">Remarks</th>
                          <th className="px-2 py-2 text-left w-[110px] min-w-[110px]">User ID</th>
                          <th className="px-2 py-2 text-left w-[120px] min-w-[120px]">User Date</th>
                          <th className="px-2 py-2 text-center w-[55px] min-w-[55px]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {terms.length === 0 ? (
                          <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>No terms yet. Click "Add Line" to add supplier terms.</td></tr>
                        ) : terms.map((term) => (
                          <tr className="border-t odd:bg-muted/20 hover:bg-muted/40" key={term.id}>
                            <td className="px-2 py-1 w-[200px] min-w-[200px]">
                              <Input
                                value={term.REQUEST_NUMBER || ""}
                                onChange={(e) => updateTermField(term.id, "request_number", e.target.value)}
                                disabled={disabled}
                                className="h-9 text-sm"
                                placeholder="Request Number"
                              />
                            </td>
                            <td className="px-2 py-1 w-[200px] min-w-[200px]">
                              <Input
                                value={term.SUPPLIER || ""}
                                onChange={(e) => updateTermField(term.id, "supplier", e.target.value)}
                                disabled={disabled}
                                className="h-9 text-sm"
                                placeholder="Supplier"
                              />
                            </td>
                            <td className="px-2 py-1 w-[180px] min-w-[180px]">
                              <Input
                                value={term.DLVR_TERM || ""}
                                onChange={(e) => updateTermField(term.id, "dlvr_term", e.target.value)}
                                disabled={disabled}
                                className="h-9 text-sm"
                                placeholder="Delivery Term"
                              />
                            </td>
                            <td className="px-2 py-1 w-[220px] min-w-[220px]">
                              <Input
                                value={term.PAYMENT_TERMS || ""}
                                onChange={(e) => updateTermField(term.id, "payment_terms", e.target.value)}
                                disabled={disabled}
                                className="h-9 text-sm"
                                placeholder="Payment Terms"
                              />
                            </td>
                            <td className="px-2 py-1 w-[160px] min-w-[160px]">
                              <Input
                                value={term.WARRANTY || ""}
                                onChange={(e) => updateTermField(term.id, "warranty", e.target.value)}
                                disabled={disabled}
                                className="h-9 text-sm"
                                placeholder="Warranty"
                              />
                            </td>
                            <td className="px-2 py-1 w-[260px] min-w-[260px]">
                              <Input
                                value={term.REMARKS || ""}
                                onChange={(e) => updateTermField(term.id, "remarks", e.target.value)}
                                disabled={disabled}
                                className="h-9 text-sm"
                                placeholder="Remarks"
                              />
                            </td>
                            <td className="px-2 py-1 w-[220px] min-w-[220px]">
                              <Input
                                value={term.USER_ID || ""}
                                onChange={(e) => updateTermField(term.id, "user_id", e.target.value)}
                                disabled={disabled}
                                className="h-9 text-sm"
                                placeholder="User ID"
                              />
                            </td>
                            <td className="px-2 py-1 w-[220px] min-w-[220px]">
  <Input
    value={term.USER_DT ? formatDateToDDMMYYYY(term.USER_DT) : ""}
    onChange={(e) => {
      // Parse dd-mm-yyyy back to ISO format for storage
      const formattedDate = e.target.value;
      if (formattedDate) {
        const [day, month, year] = formattedDate.split('-');
        const isoDate = `${year}-${month}-${day}T00:00:00.000Z`;
        updateTermField(term.id, "user_dt", isoDate);
      } else {
        updateTermField(term.id, "user_dt", "");
      }
    }}
    disabled={disabled}
    className="h-9 text-sm"
    placeholder="DD-MM-YYYY"
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
       <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
          <div className="text-sm text-muted-foreground">
            Net Amount <strong className="text-primary">{fmt3(totalFinalAmount)}</strong>
          </div>
          {!isViewMode && (
            <div className="flex items-center gap-2">
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-slate-600 hover:bg-slate-700" onClick={handleSaveDraft}><Save size={15} /> {saving ? "Saving..." : "Save Draft"}</Button>
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-blue-600 hover:bg-blue-700" onClick={handleSubmit}><Send size={15} /> Submit</Button>
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove}><CheckCircle size={15} /> Approve</Button>
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-destructive hover:bg-destructive/90" onClick={() => { setRemarkText(""); setRejectOpen(true); }}><X size={15} /> Reject</Button>
              <Button disabled={saving} type="button" variant="default" className="min-w-[110px] justify-center bg-purple-600 hover:bg-purple-700" onClick={() => { setRemarkText(""); setSendBackOpen(true); }}><ChevronLeft size={15} /> Send Back</Button>
              <Button disabled={saving || !requestNumber} type="button" variant="default" className="min-w-[110px] justify-center bg-indigo-600 hover:bg-indigo-700" onClick={handleGeneratePO}>Generate PO</Button>
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