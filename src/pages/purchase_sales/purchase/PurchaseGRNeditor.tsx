import { ChevronDown, Download, Loader2, Paperclip, Printer, Save, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { CardContent, CardHeader } from "../../../components/ui/Card";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { getDynamicLookup } from "../../../api/lookups";
import { exportGrnPrintReportExcel, getGrnPrintReportPreviewUrl } from "../../../api/transactions";
import { useAuth } from "../../../state/AuthContext";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";

import {
  ActionKey,
  ExpenseRow,
  PO_DOC_TYPE,
  PROCESSGRN,
  PurchaseConfig,
  PurchaseOrderEditorState,
  PurchaseOrderForm,
  PurchaseOrderLineRow,
  SendBackUserOption,
} from "./Purchaseordertypes";
import {
  amountBeforeDiscPrice,
  computeQuantity,
  emptyForm,
  emptyLineRow,
  fetchPurchaseOrderDetail,
  fetchPurchaseOrderHeader,
  fetchPurchaseExpenseDetails,
  formatAmount,
  lineAmount,
  lineDiscPrice,
  lineNetAmount,
  lineTaxAmount,
  lowerRecord,
  newId,
  numberOrZero,
  runWorkflow,
  text,
} from "./Purchaseorderutils";
import { PurchaseOrderHeaderForm } from "./Purchaseorderheaderform";
import { PurchaseOrderLinesTable } from "./Purchaseorderlinestable";
import { SendBackDialog } from "./Sendbackdialog";
import { RejectDialog } from "./Rejectdialog";
import { PurchaseGrnHeaderForm } from "./PurchaseGrnheaderForm";
import { PurchaseGrnDetailsTable } from "./PurchaseGrnDetails";
import { PurchaseGrnOtherExpenses } from "./PurchaseGrnOtherExpenses";
import { AttachmentDialog } from "../../../components/ui/AttachmentDialog";
import { NewReportDialog } from "../../../components/new_report_format";
import { FinanceDocumentIdentity } from "../../../components/finance/FinanceDocumentIdentity";
import { createPortal } from "react-dom";
import { PurchaseReportPreview } from "../Reports/Purchasereportpreview";
import { openPurchaseReport } from "../Reports/PurchaseReportPreviewState";


export type { PurchaseOrderEditorState };

/**
 * getGrnPrintReportPreviewUrl returns a blob: URL. NewReportDialog needs the
 * raw HTML string, so read the blob back as text and release the URL at once.
 */
async function fetchHtmlFromPreviewUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    return await res.text();
  } finally {
    try {
      window.URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

function emptyGrnExpenseRow(divCode?: string): ExpenseRow {
  return {
    id: newId(),
    company_code: null,
    doc_type: PO_DOC_TYPE.GRN,
    doc_no: null,
    doc_date: null,
    div_code: divCode || "",
    dept_code: null,
    serial_no: 0,
    exp_code: null,
    expense_name: null,
    remarks: null,
    amount: 0,
    curr_code: null,
    ex_rate: 1,
    lcur_amount: 0,
    ref_doc_type: null,
    ref_doc_no: 0,
    ref_doc_serial: 0,
    edit_user: null,
    edit_date: null,
    user_id: null,
    user_dt: null,
    zone_code: null,
    ac_code: null,
    wrk_type: null,
    employee_id: null,
    hourly_rate: 0,
  };
}

export function PurchaseGRNEditor({
  config,
  editor,
  isPendingTab,
  onClose,
  onSaved,
}: {
  config: PurchaseConfig;
  editor: PurchaseOrderEditorState;
  isPendingTab: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const editMode = editor?.mode === "edit";
  const [form, setForm] = useState<PurchaseOrderForm>(() => emptyForm(editor));
  const [rows, setRows] = useState<PurchaseOrderLineRow[]>(() => (editMode ? [] : [emptyLineRow(form.div_code)]));
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(() =>
    editMode ? [] : [emptyGrnExpenseRow(form.div_code)]
  );
  const [loading, setLoading] = useState(Boolean(editMode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flowLevelRunning, setFlowLevelRunning] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const [printing, setPrinting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // ── Report preview dialog state (HTML fed straight into NewReportDialog) ──
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportPreviewError, setReportPreviewError] = useState("");

  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false);
  const [sendBackUser, setSendBackUser] = useState("");
  const [sendBackUserName, setSendBackUserName] = useState("");
  const [sendBackUserLevel, setSendBackUserLevel] = useState<number>(0);
  const [sendBackReason, setSendBackReason] = useState("");
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [sendBackError, setSendBackError] = useState("");
  const [sendBackUsers, setSendBackUsers] = useState<SendBackUserOption[]>([]);
  const [sendBackUsersLoading, setSendBackUsersLoading] = useState(false);
  const [discountEditType, setDiscountEditType] = useState<"amount" | "percent" | null>(null);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [showHeaderDetails, setShowHeaderDetails] = useState(true);
  const [activeTab, setActiveTab] = useState<"main" | "expenses">("main");
  const submitBtnRef = useRef<HTMLDivElement>(null);
  const prevHeaderCurr = useRef("");
  const [submitConfirmPos, setSubmitConfirmPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!editor) return;
    const initialForm = emptyForm(editor);
    setForm(initialForm);
    setRows(editor.mode === "edit" ? [] : [emptyLineRow(initialForm.div_code)]);
    setExpenseRows(editor.mode === "edit" ? [] : [emptyGrnExpenseRow(initialForm.div_code)]);
    setError("");
    setActiveTab("main");
    setLoading(editor.mode === "edit");
  }, [editor]);

  useEffect(() => {
    const taxPerc =
      form.tx_compnt_1_expmt === "S" ? 5 : 0;

    setRows((current) =>
      current.map((row) => {
        // Only reset % / amount when the Tax Type really changed for this line.
        // On load (and when only category/code change) keep the saved line %.
        const typeChanged = (row.tx_compnt_1_expmt || "") !== (form.tx_compnt_1_expmt || "");

        const updatedRow = {
          ...row,

          tx_compntcat_code_1: `${form.tx_compntcat_code_1 || ""}`,
          tx_cat_code: `${form.tx_cat_code || ""}`,
          tx_compnt_1_expmt: form.tx_compnt_1_expmt || "",
          tx_compnt_perc_1: typeChanged ? taxPerc : row.tx_compnt_perc_1,
          ...(typeChanged
            ? { tx_compnt_amt_1: (Number(lineAmount(row)) || 0) * (taxPerc / 100) }
            : {}),
        };

        return updatedRow;
      })
    );


  }, [
    form.tx_compntcat_code_1,
    form.tx_cat_code,
    form.tx_compnt_1_expmt,
    form.tx_compnt_perc_1

  ]);

  useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!editMode || editor?.mode !== "edit") return;
      setLoading(true);
      setError("");
      try {
        const docNo = editor.row.doc_no;
        const [headerRaw, detailRows, expenseDetailRows] = await Promise.all([
          fetchPurchaseOrderHeader(docNo, config, user?.company_code, user?.loginid || user?.username),
          fetchPurchaseOrderDetail(docNo, config, user?.company_code, user?.loginid || user?.username),
          fetchPurchaseExpenseDetails(docNo, config, user?.company_code, user?.loginid || user?.username),
        ]);
        let acRow: Record<string, unknown> | undefined;
        const savedAcCode = text(headerRaw.ac_code);
        if (savedAcCode) {
          try {
            const acList = await getDynamicLookup({
              parameter: "Account_AC_CODE_Serach_For_suppier_customer",
              code1: user?.company_code,
              loginid: user?.loginid || user?.username || "ADMIN",
            });
            acRow = (acList || [])
              .map((r) => lowerRecord(r as Record<string, unknown>))
              .find((r) => text(r.ac_code).trim().toUpperCase() === savedAcCode.trim().toUpperCase());
          } catch {
            acRow = undefined;
          }
        }
        if (!mounted) return;

        setForm((current) => ({
          ...current,
          doc_no: text(headerRaw.doc_no || docNo),
          doc_date: toDateInputValue(headerRaw.doc_date) || current.doc_date,
          ref_no: text(headerRaw.quotn_no || current.ref_no),
          ref_date: toDateInputValue(headerRaw.quotn_date) || current.ref_date,
          div_code: text(headerRaw.div_code || current.div_code),
          div_name: text(headerRaw.div_name || current.div_name),
          ac_code: text(headerRaw.ac_code || current.ac_code),
          ac_name: text(headerRaw.ac_name || current.ac_name),
          party_address: text(headerRaw.address || current.party_address),
          dept_code: text(headerRaw.dept_code || current.dept_code),
          address1: text(headerRaw.address1 || acRow?.address1 || current.address1),
          address2: text(headerRaw.address2 || acRow?.address2 || current.address2),
          address3: text(headerRaw.address3 || acRow?.address3 || current.address3),
          e_mail: text(headerRaw.e_mail || acRow?.e_mail || current.e_mail),
          prin_name: text(headerRaw.prin_name || acRow?.prin_name || current.prin_name),
          credit_amount: numberOrZero(headerRaw.credit_amount || acRow?.credit_amount || current.credit_amount || 0),
          credit_period: Number(headerRaw.credit_period || acRow?.credit_period || current.credit_period || 0),
          party_phone: text(headerRaw.tel || acRow?.party_phone || current.party_phone),
          party_fax: text(headerRaw.fax || acRow?.party_fax || current.party_fax),
          buyer: text(headerRaw.buyer || current.buyer),
          wo_number: text(headerRaw.wo_number || current.wo_number),
          curr_code: text(headerRaw.curr_code || current.curr_code),
          curr_name: text(headerRaw.curr_name || current.curr_name),
          ex_rate: Number(headerRaw.ex_rate || current.ex_rate || 1),
          payment_terms: text(headerRaw.pay_terms || current.payment_terms),
          dlvr_term: text(headerRaw.delivery_term || current.dlvr_term),
          po_dlvr_contact: text(headerRaw.po_dlvr_contact || current.po_dlvr_contact),
          po_dlvr_mobile: text(headerRaw.po_dlvr_mobile || current.po_dlvr_mobile),
          po_dlvr_email: text(headerRaw.po_dlvr_email || current.po_dlvr_email),
          po_remarks: text(headerRaw.po_remarks || current.po_remarks),
          disc_price: Number(headerRaw.disc_price || 0),
          disc_pct: Number(headerRaw.disc_pct || 0),
          tax_category: text(headerRaw.tax_category || current.tax_category),
          tax_code: text(headerRaw.tax_code || current.tax_code),
          expense_ac_post: text(headerRaw.expense_ac_post || current.expense_ac_post),
          print_on_letterhead: text(headerRaw.print_on_letterhead || current.print_on_letterhead || "N"),
          project_name: text(headerRaw.project_name || current.project_name),
          pr_no: text(headerRaw.pr_no || current.pr_no),
          scope_of_work: text(headerRaw.scope_of_work || current.scope_of_work),
          flow_level_running: flowLevelRunning,
          canceled: text(headerRaw.canceled || current.canceled || "N"),
          // --- PO-reference fields ---
          po_doc_no: text(headerRaw.po_doc_no || current.po_doc_no),
          po_doc_date: toDateInputValue(headerRaw.po_doc_date) || current.po_doc_date,
          po_div_code: text(headerRaw.po_div_code || current.po_div_code),
          po_ac_code: text(headerRaw.po_ac_code || current.po_ac_code),
          po_payment_terms: text(headerRaw.po_payment_terms || current.po_payment_terms),
          po_dlvr_term: text(headerRaw.po_dlvr_term || current.po_dlvr_term),
          total_po_amount: numberOrZero(headerRaw.total_po_amount) || current.total_po_amount,
          po_disc_hdr_price: numberOrZero(headerRaw.po_disc_hdr_price),
          po_disc_hdr_percent: numberOrZero(headerRaw.po_disc_hdr_percent),
          po_discount_scoope: text(headerRaw.po_discount_scoope) || "ITEM",
          po_tx_compnt_1_expmt: text(headerRaw.po_tx_compnt_1_expmt),
          po_tx_cat_code: text(headerRaw.po_tx_cat_code),
          po_tx_compntcat_code_1: text(headerRaw.po_tx_compntcat_code_1),

        }));
        setRows(detailRows.length ? detailRows : [emptyLineRow(text(headerRaw.div_code) || "")]);
        setExpenseRows(
          expenseDetailRows.length
            ? expenseDetailRows
            : [emptyGrnExpenseRow(text(headerRaw.div_code) || "")]
        );
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load Purchase GRN");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadExisting();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, editor?.mode === "edit" ? editor.row.doc_no : undefined, user?.company_code, user?.loginid || user?.username]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await getDynamicLookup({
          parameter: "PS_POORDER_ENTRY_FUN_CHECK_GLOBAL_APPR_LEVEL",
          code1: user?.company_code,
          code2: user?.loginid || user?.username || "ADMIN",
          code3: PROCESSGRN,
        });
        if (!mounted) return;
        const first = (rows || [])[0] as Record<string, unknown> | undefined;
        const val = first ? Number(first.level ?? first.flow_level ?? first.flow_level_running ?? Object.values(first)[0]) : 0;
        setFlowLevelRunning(Number.isFinite(val) ? val : 0);
      } catch {
        if (mounted) setFlowLevelRunning(0);
      }
    })();
    return () => { mounted = false; };
  }, [user?.company_code, user?.loginid, user?.username]);

  useEffect(() => {
    const newCurr = form.curr_code || "";
    const newRate = Number(form.ex_rate) || 1;
    const prev = prevHeaderCurr.current;
    prevHeaderCurr.current = newCurr;
    if (!newCurr) return;
    setExpenseRows((current) =>
      current.map((r) => {
        const code = r.curr_code || "";
        if (code && code !== prev) return r;
        return {
          ...r,
          curr_code: newCurr,
          ex_rate: newRate,
          lcur_amount: Number(((Number(r.amount) || 0) * newRate).toFixed(2)),
        };
      })
    );
  }, [form.curr_code, form.ex_rate]);

  const disabled = form.canceled === "Y" || saving || loading;
  const actionDisabled = disabled || !isPendingTab;
  const effectiveFlowLevel = Number.isFinite(flowLevelRunning) ? flowLevelRunning : 0;
  const isLevelGreaterThanOne = editMode && effectiveFlowLevel > 1;
  // const headerAndLineDisabled = disabled || isLevelGreaterThanOne;
  const headerAndLineDisabled = disabled || isLevelGreaterThanOne || !isPendingTab;
  const isCancelled = form.canceled === "Y";
  const canSendBackOrReject = effectiveFlowLevel !== 1 && effectiveFlowLevel !== 0;

  const finalTotal = (() => {
    const totalAmount = rows.reduce((sum, row) => sum + lineAmount(row), 0);
    const totalDiscPrice = rows.reduce((sum, row) => sum + lineDiscPrice(row), 0);
    const totalTaxAmount = rows.reduce((sum, row) => sum + lineTaxAmount(row), 0);
    return totalAmount - totalDiscPrice - form.disc_price + totalTaxAmount;
  })();

  const updateField = (field: keyof PurchaseOrderForm, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const applyDiscountCalculation = (type: "amount" | "percent", value?: number) => {
    const totalAmount = rows.reduce(
      (sum, row) => sum + amountBeforeDiscPrice(row),
      0
    );

    if (totalAmount <= 0) return;

    const inputValue = value ?? (type === "amount" ? form.disc_hdr_price : form.disc_hdr_percent);

    let discountAmount = 0;
    let discountPercent = 0;

    if (type === "amount") {
      discountAmount = Number(inputValue) || 0;
      discountPercent = (discountAmount / totalAmount) * 100;
    } else {
      discountPercent = Number(inputValue) || 0;
      discountAmount = totalAmount * (discountPercent / 100);
    }

    setDiscountEditType(type);

    setForm((current) => ({
      ...current,
      disc_hdr_price: discountAmount,
      disc_hdr_percent: discountPercent,
    }));

    setRows((current) =>
      current.map((row) => {
        const amount = amountBeforeDiscPrice(row);
        return {
          ...row,
          disc_percent: discountPercent,
          disc_price: amount * (discountPercent / 100),
        };
      })
    );
  };

  const rowsAmountSignature = rows
    .map((r) => `${r.unit_price}|${r.qty_puom}|${r.qty_luom}|${r.uppp}`)
    .join(",");

  const effectiveDiscountType: "amount" | "percent" | null =
    discountEditType ??
    (numberOrZero(form.disc_hdr_percent) !== 0
      ? "percent"
      : numberOrZero(form.disc_hdr_price) !== 0
        ? "amount"
        : null);

  useEffect(() => {
    if (form.discount_scoope !== "PO" || !effectiveDiscountType) return;
    applyDiscountCalculation(effectiveDiscountType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsAmountSignature, form.discount_scoope]);
  const updateRow = (id: string, patch: Partial<PurchaseOrderLineRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const updateExpenseRow = (id: string, patch: Partial<ExpenseRow>) => {
    setExpenseRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };
  const addExpenseRow = () =>
    setExpenseRows((current) => [
      ...current,
      {
        ...emptyGrnExpenseRow(form.div_code),
        curr_code: form.curr_code || null,
        ex_rate: Number(form.ex_rate) || 1,
      },
    ]);
  const removeExpenseRow = (id: string) => setExpenseRows((current) => current.filter((row) => row.id !== id));

  const addRow = () =>
    setRows((current) => [
      ...current,
      {
        ...emptyLineRow(form.div_code),
        tx_compntcat_code_1: `${form.tx_compntcat_code_1 || ""}`,
        tx_cat_code: `${form.tx_cat_code || ""}`,
        disc_price: form.disc_hdr_price,
        disc_percent: form.disc_hdr_percent,
        tx_compnt_1_expmt: form.tx_compnt_1_expmt || "",
        tx_compnt_perc_1: form.tx_compnt_1_expmt === "S" ? Number(form.tx_compnt_perc_1 || 0) : 0,
      },
    ]);
  const removeRow = (id: string) => setRows((current) => current.filter((row) => row.id !== id));

  const runAction = async (key: ActionKey, action: () => Promise<void> | void, successMessage?: string) => {
    setActionLoading(key);
    setSaving(true);
    setError("");
    try {
      await action();
      if (successMessage) await onSaved(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  };

  const hasValidLines = rows.some((row) => text(row.prod_code).trim().length > 0);

  const handleSaveAsDraft = () => {
    if (rows.length === 0 || !hasValidLines) return setError("Add at least one line item before saving as draft");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNo = i + 1;

      if (!text(row.prod_code).trim()) {
        return setError(`Line ${lineNo}: Product should not be empty`);
      }

      const netQty = computeQuantity(row);
      if (!(netQty > 0)) {
        return setError(`Line ${lineNo}: Net Quantity should not be 0`);
      }

      if (!(numberOrZero(row.unit_price) > 0)) {
        return setError(`Line ${lineNo}: Rate should not be 0`);
      }
    }
    return runAction("draft", async () => {
      await runWorkflow("SAVEASDRAFT", PO_DOC_TYPE.GRN, form, rows, user?.company_code, user?.loginid || user?.username, expenseRows);
    }, "Purchase Quotation saved as draft");
  };

  // const handleSubmitClick = () => {
  //   if (!form.div_code) return setError("Division is required");
  //   if (!form.ac_code) return setError("A/c Code is required");
  //   if (rows.length === 0 || !hasValidLines) return setError("Add at least one line item before submitting");
  //   setShowSubmitConfirm(true);
  // };

  const handleSubmitClick = () => {
    if (!form.div_code) return setError("Division is required");
    if (!form.ac_code) return setError("A/c Code is required");
    if (rows.length === 0) return setError("Add at least one line item before submitting");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNo = i + 1;

      if (!text(row.prod_code).trim()) {
        return setError(`Line ${lineNo}: Product should not be empty`);
      }

      const netQty = numberOrZero(row.qty_puom) * numberOrZero(row.uppp) + numberOrZero(row.qty_luom);
      if (!(netQty > 0)) {
        return setError(`Line ${lineNo}: Net Quantity should not be 0`);
      }

      if (!(numberOrZero(row.unit_price) > 0)) {
        return setError(`Line ${lineNo}: Rate should not be 0`);
      }
    }

    return confirmSubmit();
  };


  const confirmSubmit = () => {

    return runAction("submit", async () => {
      await runWorkflow("SUBMITTED", PO_DOC_TYPE.GRN, form, rows, user?.company_code, user?.loginid || user?.username, expenseRows);
    }, editMode ? "Purchase GRN updated successfully" : "Purchase GRN created successfully");
  };

  const handleCancel = () =>
    runAction("cancel", async () => {
      await runWorkflow("CANCELED", PO_DOC_TYPE.GRN, form, rows, user?.company_code, user?.loginid || user?.username, expenseRows);
    }, "Purchase GRN cancelled");

  // ── Print opens the in-app NewReportDialog preview ───────────────────────




  const handlePrintGrn = async () => {
    if (!form.doc_no) {
      setError("Save the GRN before printing");
      return;
    }
    const params = {
      parameter: "GRN_Print",
      loginid: user?.loginid || user?.username || "ADMIN",
      company_code: user?.company_code,
      doc_type: PO_DOC_TYPE.GRN,
      doc_no: form.doc_no,
    } as any;
    setPrinting(true);
    setError("");
    const preview = openPurchaseReport(`Purchase GRN ${form.doc_no}`.trim());
    try {
      const url = await getGrnPrintReportPreviewUrl(params);
      const html = await fetchHtmlFromPreviewUrl(url);
      preview.ready({
        html,
        filename: `purchase_grn_${form.doc_no}_${new Date().toISOString().slice(0, 10)}`,
        orientation: "portrait",
        onExcel: async () => {
          await exportGrnPrintReportExcel(params);
        },
      });
    } catch (printError) {
      preview.fail(printError instanceof Error ? printError : new Error("Error while generating report"));
    } finally {
      setPrinting(false);
    }
  };



  const handleExportGrnExcel = async () => {
    if (!form.doc_no) {
      setError("Save the GRN before exporting to Excel");
      return;
    }
    setExportingExcel(true);
    setError("");
    try {
      await exportGrnPrintReportExcel({
        parameter: "GRN_Print",
        loginid: user?.loginid || user?.username || "ADMIN",
        company_code: user?.company_code,
        doc_type: PO_DOC_TYPE.GRN,
        doc_no: form.doc_no,
      } as any);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Error while exporting to Excel");
    } finally {
      setExportingExcel(false);
    }
  };




  const handleExcel = async () => {
    if (!form.doc_no) {
      setError("Save the GRN before exporting to Excel");
      return;
    }
    setExportingExcel(true);
    setError("");
    try {
      await exportGrnPrintReportExcel({
        parameter: "GRN_Print",
        loginid: user?.loginid || user?.username || "ADMIN",
        company_code: user?.company_code,
        doc_type: PO_DOC_TYPE.GRN,
        doc_no: String(form.doc_no),
      } as any);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Excel export failed");
    } finally {
      setExportingExcel(false);
    }
  };
  const openRejectDialog = () => {
    setRejectError("");
    setRejectReason("");
    setRejectDialogOpen(true);
  };
  const closeRejectDialog = () => {
    if (actionLoading === "reject") return;
    setRejectDialogOpen(false);
  };
  const confirmReject = () => {
    if (!rejectReason.trim()) {
      setRejectError("Please enter a reason");
      return;
    }
    setRejectError("");
    return runAction("reject", async () => {
      const payloadForm: PurchaseOrderForm = { ...form, reject_reason: rejectReason.trim() };
      await runWorkflow("REJECTED", PO_DOC_TYPE.GRN, payloadForm, rows, user?.company_code, user?.loginid || user?.username, expenseRows);
      setRejectDialogOpen(false);
    }, "Purchase GRN rejected");
  };

  const openSendBackDialog = async () => {
    setSendBackError("");
    setSendBackUser("");
    setSendBackUserName("");
    setSendBackUserLevel(0);
    setSendBackReason("");
    setSendBackDialogOpen(true);
    setSendBackUsersLoading(true);
    try {
      const rows = await getDynamicLookup({
        parameter: "PS_POORDER_ENTRY_SENTBACK_USER_LIST",
        code1: user?.company_code,
        number1: flowLevelRunning,
        code2: PROCESSGRN,
      });
      const options: SendBackUserOption[] = (rows || []).map((raw) => {
        const row = lowerRecord(raw as Record<string, unknown>);
        return {
          code: text(row.level_no),
          name: text(row.description),
          level_no: numberOrZero(row.level_no),
        };
      }).filter((option) => option.code);
      setSendBackUsers(options);
    } catch {
      setSendBackUsers([]);
    } finally {
      setSendBackUsersLoading(false);
    }
  };
  const closeSendBackDialog = () => {
    if (actionLoading === "sendBack") return;
    setSendBackDialogOpen(false);
  };
  const confirmSendBack = () => {
    if (!sendBackUser) {
      setSendBackError("Please select a level to send back to");
      return;
    }
    if (!sendBackReason.trim()) {
      setSendBackError("Please enter a reason");
      return;
    }
    setSendBackError("");
    return runAction("sendBack", async () => {
      const payloadForm: PurchaseOrderForm = {
        ...form,
        next_action_by: sendBackUserName,
        sentback_reason: sendBackReason.trim(),
        flow_level_running: sendBackUserLevel,
      };
      await runWorkflow("SENTBACK", PO_DOC_TYPE.GRN, payloadForm, rows, user?.company_code, user?.loginid || user?.username, expenseRows);
      setSendBackDialogOpen(false);
    }, "Purchase GRN sent back");
  };

  const actionBarBusy = actionLoading !== null || saving;

  const tabButtonClass = (key: "main" | "expenses") =>
    `px-4 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${activeTab === key
      ? "border-[#00378C] text-[#00378C]"
      : "border-transparent text-slate-500 hover:text-slate-800"
    }`;
  const expenseTotalLcur = expenseRows.reduce((sum, row) => {
    const amt = Number(row.amount) || 0;
    const rate = Number(row.ex_rate) || 1;
    return sum + (Number(row.lcur_amount) || amt * rate);
  }, 0);

  return (
    <>

      <div className="finance-document-ui finance-document-editor commercial-editor payment-workbench flex h-screen flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm px-4 py-2">
        <form
          data-header-expanded={showHeaderDetails} className={` finance-document-ui payment-workbench commercial-editor grid h-screen ${isCancelled ? "grid-rows-[auto_auto_minmax(0,1fr)_auto] is-cancelled" : "grid-rows-[auto_minmax(0,1fr)_auto]"}`}
          onSubmit={(event) => { event.preventDefault(); void handleSubmitClick(); }}
        >
          <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
            <div className="flex min-h-10 items-center justify-between gap-3">
              <FinanceDocumentIdentity
                title="Goods Receipt Note"
                documentNo={form.doc_no}
                documentDate={form.doc_date}
                total={formatAmount(finalTotal)}
                divCode={form.div_code}
                divName={form.div_name}
                onBack={onClose}
                headerExpanded={showHeaderDetails}
                onToggleHeader={() => setShowHeaderDetails(value => !value)}
              />
              <div className="flex items-center gap-2">
                {form.canceled === "Y" && <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">Cancelled</Badge>}

                <div className="flex items-center gap-2">
                  {isPendingTab && (
                    <Button type="button" onClick={handleSaveAsDraft} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-blue-600 hover:bg-blue-700 shadow-md disabled:opacity-60">
                      {actionLoading === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={15} />}
                      {actionLoading === "draft" ? "Saving..." : "Save Draft"}
                    </Button>
                  )}
                  <div ref={submitBtnRef} className="relative z-[100] overflow-visible">
                    {isPendingTab && (
                      <Button
                        type="button"
                        onClick={handleSubmitClick}
                        disabled={actionDisabled || actionBarBusy}
                      >
                        {actionLoading === "submit" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        {actionLoading === "submit" ? "Submitting..." : "Submit"}
                      </Button>
                    )}
                    {showSubmitConfirm &&
                      createPortal(
                        <div
                          style={{ position: "fixed", top: submitConfirmPos.top, right: submitConfirmPos.right }}
                          className="z-[9999] w-56 rounded-lg border border-slate-200 bg-white p-3 text-black shadow-xl"
                        >
                          <p className="mb-2 text-sm text-gray-700">Submit this Purchase Quotation?</p>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>
                              No
                            </Button>
                            <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700" onClick={confirmSubmit}>
                              Yes
                            </Button>
                          </div>
                        </div>,
                        document.body
                      )}
                  </div>


                  {isPendingTab && canSendBackOrReject && (
                    <Button type="button" onClick={openSendBackDialog} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-yellow-500 hover:bg-yellow-600 shadow-md disabled:opacity-60">
                      {actionLoading === "sendBack" ? "Sending Back..." : "Send Back"}
                    </Button>
                  )}

                  {isPendingTab && canSendBackOrReject && (
                    <Button type="button" onClick={openRejectDialog} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-red-600 hover:bg-red-700 shadow-md disabled:opacity-60">
                      {actionLoading === "reject" ? "Rejecting..." : "Reject"}
                    </Button>
                  )}
                  {isPendingTab && form.doc_no && (
                    <Button type="button" onClick={handleCancel} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-orange-500 hover:bg-orange-600 shadow-md disabled:opacity-60">
                      {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
                    </Button>
                  )}

                </div>
                {form.doc_no && (
                  <>
                    <Button type="button" variant="secondary" onClick={handlePrintGrn} disabled={printing}>
                      {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Print
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleExcel()}
                      disabled={exportingExcel}
                    >
                      {exportingExcel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      Excel
                    </Button>
                  </>
                )}
                <Button type="button" variant="secondary" onClick={() => setAttachmentOpen(true)}>
                  <Paperclip size={15} /> Files
                </Button>
                {/* <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={onClose}><X size={16} /></Button> */}
              </div>
            </div>
          </CardHeader>

          {isCancelled && (
            <div className="cancelled-document-banner" role="status">
              <div>
                <span className="cancelled-document-kicker">Cancelled Document</span>
                <strong>{form.doc_no || "Goods Receipt Note"}</strong>
              </div>
              <p>This Purchase GRN is cancelled and opened in read-only mode.</p>
            </div>
          )}

          <CardContent className="commercial-editor-body min-h-0 min-w-0 overflow-auto p-3">
            {loading ? (
              <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading Goods Receipt Note...</div>
            ) : (
              <div className="commercial-editor-sections grid gap-3 min-w-0">
                <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

                {/* ── Tabs: Header & Details | Other Expenses ── */}
                <div className="flex items-center gap-1 border-b border-slate-200" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "main"}
                    className={tabButtonClass("main")}
                    onClick={() => setActiveTab("main")}
                  >
                    Header &amp; Details
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "expenses"}
                    className={tabButtonClass("expenses")}
                    onClick={() => setActiveTab("expenses")}
                  >
                    Other Expenses
                  </button>
                </div>

                {/* ── Tab 1: Header + Details ── */}
           <div className={activeTab === "main" ? "contents" : "hidden"}>
                  {!showHeaderDetails ? (
                    <div className="flex items-center justify-between px-3.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs shadow-xs min-w-0">
                      <div className="flex items-center gap-4 text-slate-700 flex-wrap min-w-0">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-semibold text-[#00378C]">Doc Date:</span>
                          <span className="font-medium">{form.doc_date}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-semibold text-[#00378C]">Division:</span>
                          <span className="font-medium">{form.div_code}{form.div_name ? ` - ${form.div_name}` : ""}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-[#00378C]">A/c Code:</span>
                          <span className="font-medium truncate">{form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code || "Not selected"}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-semibold text-[#00378C]">Currency:</span>
                          <span className="font-medium">{form.curr_code || "-"} ({Number(form.ex_rate || 1).toFixed(4)})</span>
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs font-semibold text-[#00378C] border-[#00378C] hover:bg-blue-100/60 ml-2 shrink-0 cursor-pointer"
                        onClick={() => setShowHeaderDetails(true)}
                      >
                        Show Header Fields <ChevronDown size={13} className="ml-1" />
                      </Button>
                    </div>
                  ) : (
                    <div style={{ height: "auto", maxHeight: "none", overflow: "visible" }}>
                      <PurchaseGrnHeaderForm
                        form={form}
                        rows={rows}
                        docType={PO_DOC_TYPE.GRN}
                        calculateDiscount={applyDiscountCalculation}
                        setForm={setForm}
                        updateField={updateField}
                        disabled={disabled}
                        headerAndLineDisabled={headerAndLineDisabled}
                        editMode={editMode}
                        companyCode={user?.company_code}
                        loginid={user?.loginid || user?.username}
                        setdetails={setRows}
                      />
                    </div>
                  )}
                  <PurchaseGrnDetailsTable
                    rows={rows}
                    form={form}
                    setdetails={setRows}
                    docType={PO_DOC_TYPE.GRN}
                    updateRow={updateRow}
                    addRow={addRow}
                    removeRow={removeRow}
                    headerAndLineDisabled={headerAndLineDisabled}
                    discAmt={form.disc_price}
                    ex_rate={form.ex_rate}
                    expenseTotal={expenseTotalLcur}
                    companyCode={user?.company_code}
                    loginid={user?.loginid || user?.username}
                  />
                </div>

                {/* ── Tab 2: Other Expenses ── */}
                <div className={activeTab === "expenses" ? "grid gap-3 min-w-0" : "hidden"}>
                  <PurchaseGrnOtherExpenses
                    rows={expenseRows}
                    updateRow={updateExpenseRow}
                    addRow={addExpenseRow}
                    removeRow={removeExpenseRow}
                    disabled={headerAndLineDisabled}
                  />
                </div>
              </div>
            )}
          </CardContent>
          {/* <div className="commercial-sticky-footer flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs">
                <span className="text-[11px] font-medium text-slate-500">Total Amount</span>
                <strong className="font-mono text-xs text-slate-900">{formatAmount(finalTotal)}</strong>
              </div>


            </div>

            <div className="flex items-center gap-2">
              {isPendingTab && (
                <Button type="button" onClick={handleSaveAsDraft} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-blue-600 hover:bg-blue-700 shadow-md disabled:opacity-60">
                  {actionLoading === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={15} />}
                  {actionLoading === "draft" ? "Saving..." : "Save Draft"}
                </Button>
              )}
              {isPendingTab && (
                <div className="relative">
                  <Button type="button" onClick={handleSubmitClick} disabled={actionDisabled || actionBarBusy}>
                    {actionLoading === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {actionLoading === "submit" ? "Submitting..." : "Submit"}
                  </Button>
                  {showSubmitConfirm && (
                    <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border bg-white p-3 shadow-lg">
                      <p className="mb-2 text-sm text-gray-700">Submit this Purchase Quotation?</p>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowSubmitConfirm(false)}>No</Button>
                        <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700" onClick={confirmSubmit}>Yes</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isPendingTab && canSendBackOrReject && (
                <Button type="button" onClick={openSendBackDialog} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-yellow-500 hover:bg-yellow-600 shadow-md disabled:opacity-60">
                  {actionLoading === "sendBack" ? "Sending Back..." : "Send Back"}
                </Button>
              )}

              {isPendingTab && canSendBackOrReject && (
                <Button type="button" onClick={openRejectDialog} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-red-600 hover:bg-red-700 shadow-md disabled:opacity-60">
                  {actionLoading === "reject" ? "Rejecting..." : "Reject"}
                </Button>
              )}
              {isPendingTab && (
                <Button type="button" onClick={handleCancel} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-orange-500 hover:bg-orange-600 shadow-md disabled:opacity-60">
                  {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
                </Button>
              )}

            </div>
          </div> */}
        </form>
      </div>

      {/* ── Report preview dialog (NewReportDialog + NewReportDialogProps) ── */}
      <PurchaseReportPreview />

      <SendBackDialog
        open={sendBackDialogOpen}
        isSaving={actionLoading === "sendBack"}
        users={sendBackUsers}
        usersLoading={sendBackUsersLoading}
        selectedCode={sendBackUser}
        reason={sendBackReason}
        error={sendBackError}
        onSelectUser={(match, code) => {
          setSendBackUser(code);
          setSendBackUserName(match?.name || "");
          setSendBackUserLevel(match?.level_no || 0);
        }}
        onReasonChange={setSendBackReason}
        onClearError={() => setSendBackError("")}
        onClose={closeSendBackDialog}
        onConfirm={confirmSendBack}
      />

      <RejectDialog
        open={rejectDialogOpen}
        isSaving={actionLoading === "reject"}
        reason={rejectReason}
        error={rejectError}
        onReasonChange={setRejectReason}
        onClearError={() => setRejectError("")}
        onClose={closeRejectDialog}
        onConfirm={confirmReject}
      />

      <AttachmentDialog
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        requestNumber={form.doc_no ? String(form.doc_no) : ""}
        title="Purchase grn Attachments"
        module="PG"
        type="Purchase grn"
        companyCode={user?.company_code || ""}
        loginId={user?.loginid || ""}
        flowLevel={effectiveFlowLevel}
        readOnly={!isPendingTab || isCancelled}
      />
    </>
  );
}