import { ChevronDown, Download, Loader2, Paperclip, Printer, Save, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { CardContent, CardHeader } from "../../../components/ui/Card";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";

import {
  ActionKey,
  PO_DOC_TYPE,
  PROCESS,
  PurchaseConfig,
  PurchaseOrderEditorState,
  PurchaseOrderForm,
  PurchaseOrderLineRow,
  SendBackUserOption,
} from "../../purchase_sales/purchase/Purchaseordertypes";
import {
  emptyForm,
  emptyLineRow,
  fetchPurchaseOrderDetail,
  fetchPurchaseOrderHeader,
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
  DiscAmountPercentage,
  TotalUnitPrice,
  Totalunitprice,
  computeQuantity,
  DiscPrice,
  amountBeforeDiscPrice,
  TotalDiscAmount,
} from "../../purchase_sales/purchase/Purchaseorderutils";
import { PurchaseOrderHeaderForm } from "../../purchase_sales/purchase/Purchaseorderheaderform";
import { PurchaseOrderLinesTable } from "../../purchase_sales/purchase/Purchaseorderlinestable";
import { SendBackDialog } from "../../purchase_sales/purchase/Sendbackdialog";
import { RejectDialog } from "../../purchase_sales/purchase/Rejectdialog";
import { AttachmentDialog } from "../../../components/ui/AttachmentDialog";
import {
  getPoOrderReportHtml,
  getPoOrderReportExcel,
} from "../../../api/transactions";

import { NewReportDialog } from "../../../components/new_report_format";
import { FinanceDocumentIdentity } from "../../../components/finance/FinanceDocumentIdentity";
import { createPortal } from "react-dom";

import { openPurchaseReport } from "../Reports/PurchaseReportPreviewState";
import { PurchaseReportPreview } from "../Reports/Purchasereportpreview";


export type { PurchaseOrderEditorState };

export function SalesReturnEditor({
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
  const [loading, setLoading] = useState(Boolean(editMode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flowLevelRunning, setFlowLevelRunning] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // ---- Send Back dialog state ----
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false);
  const [sendBackUser, setSendBackUser] = useState("");
  const [sendBackUserName, setSendBackUserName] = useState("");
  const [sendBackUserLevel, setSendBackUserLevel] = useState<number>(0);
  const [sendBackReason, setSendBackReason] = useState("");
  const [sendBackError, setSendBackError] = useState("");
  const [sendBackUsers, setSendBackUsers] = useState<SendBackUserOption[]>([]);
  const [sendBackUsersLoading, setSendBackUsersLoading] = useState(false);

  // ---- Reject dialog state ----
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [attachmentOpen, setAttachmentOpen] = useState(false);


  // ---- Report Preview state ----

  const [reportPreviewError, setReportPreviewError] = useState("");
  const [reportPreviewExporting, setReportPreviewExporting] = useState(false);
  const totalUnitPrice = rows.reduce((sum, row) => sum + Totalunitprice(row), 0);
  const [discountEditType, setDiscountEditType] = useState<"amount" | "percent" | null>(null);
  const [showHeaderDetails, setShowHeaderDetails] = useState(true);
  const submitBtnRef = useRef<HTMLDivElement>(null);
  const [submitConfirmPos, setSubmitConfirmPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!editor) return;
    const initialForm = emptyForm(editor);
    setForm(initialForm);
    setRows(editor.mode === "edit" ? [] : [emptyLineRow(initialForm.div_code)]);
    setError("");
    setLoading(editor.mode === "edit");
  }, [editor]);

  useEffect(() => {
    const taxPerc =
      form.tx_compnt_1_expmt === "S" ? 5 : 0;

    setRows((current) =>
      current.map((row) => {
        const updatedRow = {
          ...row,

          tx_compntcat_code_1: `${form.tx_compntcat_code_1 || ""}`,
          tx_cat_code: `${form.tx_cat_code || ""}`,
          tx_compnt_1_expmt: form.tx_compnt_1_expmt || "",
          tx_compnt_perc_1: taxPerc,
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
        const [headerRaw, detailRows] = await Promise.all([
          fetchPurchaseOrderHeader(docNo, config, user?.company_code, user?.loginid || user?.username),
          fetchPurchaseOrderDetail(docNo, config, user?.company_code, user?.loginid || user?.username),
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
          ref_date: toDateInputValue(headerRaw.ref_date) || current.ref_date,
          div_code: text(headerRaw.div_code || current.div_code),
          div_name: text(headerRaw.div_name || current.div_name),
          ac_code: text(headerRaw.ac_code || current.ac_code),
          ac_name: text(headerRaw.ac_name || acRow?.ac_name || current.ac_name),
          party_address: text(headerRaw.address || acRow?.party_address || current.party_address),
          address1: text(headerRaw.address1 || acRow?.address1 || current.address1),
          address2: text(headerRaw.address2 || acRow?.address2 || current.address2),
          address3: text(headerRaw.address3 || acRow?.address3 || current.address3),
          e_mail: text(headerRaw.e_mail || acRow?.e_mail || current.e_mail),
          prin_name: text(headerRaw.prin_name || acRow?.prin_name || current.prin_name),
          credit_amount: numberOrZero(headerRaw.credit_amount || acRow?.credit_amount || current.credit_amount || 0),
          credit_period: Number(headerRaw.credit_period || acRow?.credit_period || current.credit_period || 0),
          dept_code: text(headerRaw.dept_code || acRow?.dept_code || current.dept_code),
          party_phone: text(headerRaw.tel || acRow?.party_phone || current.party_phone),
          party_fax: text(headerRaw.fax || acRow?.party_fax || current.party_fax),
          buyer: text(headerRaw.buyer || current.buyer),
          wo_number: text(headerRaw.wo_number || current.wo_number),
          curr_code: text(headerRaw.curr_code || acRow?.curr_code || current.curr_code),
          curr_name: text(headerRaw.curr_name || acRow?.curr_name || current.curr_name),
          ex_rate: Number(headerRaw.ex_rate || acRow?.ex_rate || current.ex_rate || 1),
          payment_terms: text(headerRaw.pay_terms || current.payment_terms),
          dlvr_term: text(headerRaw.delivery_term || current.dlvr_term),
          dlvr_contact: text(headerRaw.delivery_contact || current.dlvr_contact),
          dlvr_mobile: text(headerRaw.delivery_tel || current.dlvr_mobile),
          dlvr_email: text(headerRaw.delivery_email || current.dlvr_email),
          remarks: text(headerRaw.remarks || current.remarks),
          disc_hdr_percent: numberOrZero(headerRaw.disc_hdr_percent),
          disc_hdr_price: numberOrZero(headerRaw.disc_hdr_price),
          tx_cat_code: text(headerRaw.tx_cat_code || current.tx_cat_code),
          tx_compntcat_code_1: text(headerRaw.tx_compntcat_code_1 || current.tx_compntcat_code_1),
          expense_ac_post: text(headerRaw.expense_ac_post || current.expense_ac_post),
          print_on_letterhead: text(headerRaw.print_on_letterhead || current.print_on_letterhead || "N"),
          project_name: text(headerRaw.project_name || current.project_name),
          pr_no: text(headerRaw.pr_no || current.pr_no),
          scope_of_work: text(headerRaw.scope_of_work || current.scope_of_work),
          flow_level_running: flowLevelRunning,
          canceled: text(headerRaw.canceled || current.canceled || "N"),
          pay_terms: text(headerRaw.pay_terms || current.pay_terms),
          tx_compnt_1_expmt: text(headerRaw.tx_compnt_1_expmt || current.tx_compnt_1_expmt),
          inv_no: text(headerRaw.inv_no),
          inv_date: text(headerRaw.inv_date),
          discount_scoope:
            headerRaw.discount_scoope === "PO" ||
              headerRaw.discount_scoope === "ITEM"
              ? headerRaw.discount_scoope
              : current.discount_scoope || "ITEM",
        }));

        setRows(detailRows.length ? detailRows : [emptyLineRow(text(headerRaw.div_code) || "")]);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load Sales Return");
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
          code3: PROCESS,
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

  const disabled = form.canceled === "Y" || saving || loading;
  const actionDisabled = disabled || !isPendingTab;
  const effectiveFlowLevel = Number.isFinite(flowLevelRunning) ? flowLevelRunning : 0;
  const isLevelGreaterThanOne = editMode && effectiveFlowLevel > 1;
  // const headerAndLineDisabled = disabled || isLevelGreaterThanOne;
  const headerAndLineDisabled = disabled || isLevelGreaterThanOne || !isPendingTab;
  const isCancelled = form.canceled === "Y";
  const canSendBackOrReject = effectiveFlowLevel !== 1 && effectiveFlowLevel !== 0;
  console.log("ROWS DEBUG:", rows.map(r => ({
    p_uom: r.p_uom, l_uom: r.l_uom, qty_puom: r.qty_puom, qty_luom: r.qty_luom, uppp: r.uppp,
    unit_price: r.unit_price,
    computedQty: computeQuantity(r),
    lineTotal: Totalunitprice(r)
  })));
  const finalTotal = (() => {
    const totalAmount = rows.reduce((sum, row) => sum + lineAmount(row), 0);
    const totalDiscPrice = rows.reduce((sum, row) => sum + DiscPrice(row), 0);
    const totalTaxAmount = rows.reduce((sum, row) => sum + lineTaxAmount(row), 0);
    return totalAmount - totalDiscPrice - form.disc_price + totalTaxAmount;
  })();
  const totalQtyPuom = rows.reduce((sum, row) => sum + (Number(row.qty_puom) || 0), 0);
  const totalQtyLuom = rows.reduce((sum, row) => sum + (Number(row.qty_luom) || 0), 0);
  const baseTotalAmount = rows.reduce((sum, row) => sum + lineAmount(row), 0);
  const totalDiscountAmt = TotalDiscAmount(rows);
  const amountBeforeTax = baseTotalAmount - totalDiscountAmt;
  const totalTaxAmt = rows.reduce((sum, row) => sum + lineTaxAmount(row), 0);
  const amountAfterTax = amountBeforeTax + totalTaxAmt;
  const totalAmountDisct = rows.reduce((sum, row) => sum + amountBeforeDiscPrice(row), 0);
  const grandTotal = totalAmountDisct - TotalDiscAmount(rows);

  // const updateField = (field: keyof PurchaseOrderForm, value: string | number) => {
  //   setForm((current) => {
  //     let updated = { ...current, [field]: value };

  //     if (field === "disc_hdr_price") {
  //       updated.disc_hdr_percent = Number(value) > 0 ? DiscAmountPercentage(updated, rows) : 0;
  //     }

  //     return updated;
  //   });

  //   if (field === "disc_hdr_price") {
  //     const pct = Number(value) > 0 ? DiscAmountPercentage({ ...form, disc_hdr_price: Number(value) }, rows) : 0;
  //     setRows((current) => current.map((row) => ({
  //       ...row,
  //       disc_price: Number(value) || 0,
  //       disc_percent: pct
  //     })));
  //   }

  //   if (field === "disc_hdr_percent") {
  //     setRows((current) => current.map((row) => ({ ...row, disc_percent: Number(value) || 0 })));
  //   }
  // };


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

  const updateField = (
    field: keyof PurchaseOrderForm,
    value: string | number
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };
  const updateRow = (id: string, patch: Partial<PurchaseOrderLineRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () =>
    setRows((current) => [
      ...current,
      {
        ...emptyLineRow(form.div_code),
        tx_compntcat_code_1: `${form.tx_compntcat_code_1 || ""}`,
        tx_cat_code: `${form.tx_cat_code || ""}`,
        tx_compnt_1_expmt: form.tx_compnt_1_expmt || "",
        tx_compnt_perc_1: form.tx_compnt_1_expmt === "S" ? 5 : 0,
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

  // ---- Report Preview ----
  const handlePrint = async () => {
    if (!form.doc_no) return;

    const params = {
      company_code: user?.company_code,
      doc_type: PO_DOC_TYPE.SOR,
      doc_no: form.doc_no,
    };
    const preview = openPurchaseReport(`Sales Return ${form.doc_no}`.trim());

    try {
      const html = await getPoOrderReportHtml(params);
      preview.ready({
        html,
        filename: `purchase_order_${form.doc_no}_${new Date().toISOString().slice(0, 10)}`,
        orientation: "portrait",
        onExcel: async () => {
          await getPoOrderReportExcel(params);
        },
      });
    } catch (error) {
      preview.fail(error instanceof Error ? error : new Error("Unable to load report"));
    }
  };


  const handleReportPreviewExcel = async () => {
    if (!form.doc_no) return;

    setReportPreviewExporting(true);
    setReportPreviewError("");

    try {
      await getPoOrderReportExcel({
        company_code: user?.company_code,
        doc_type: PO_DOC_TYPE.SOR,
        doc_no: form.doc_no,
      });
    } catch (error) {
      setReportPreviewError(
        error instanceof Error ? error.message : "Unable to export report"
      );
    } finally {
      setReportPreviewExporting(false);
    }
  };

  const hasValidLines = rows.some((row) => text(row.prod_code).trim().length > 0);

  const handleSaveAsDraft = () => {
    if (rows.length === 0 || !hasValidLines) return setError("Add at least one line item before saving as draft");
    return runAction("draft", async () => {
      await runWorkflow("SAVEASDRAFT", PO_DOC_TYPE.SOR, form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Purchase Quotation saved as draft");
  };

  // const handleSubmitClick = () => {
  //   if (!form.div_code) return setError("Division is required");
  //   if (!form.ac_code) return setError("A/c Code is required");
  //   if (!form.curr_code) return setError("Currency is required");
  //   if (rows.length === 0 || !hasValidLines) return setError("Add at least one line item before submitting");
  //   setShowSubmitConfirm(true);
  // };

  const handleSubmitClick = () => {
    if (!form.div_code) return setError("Division is required");
    if (!form.ac_code) return setError("A/c Code is required");
    if (!form.curr_code) return setError("Currency is required");
    if (rows.length === 0 || !hasValidLines) return setError("Add at least one line item before submitting");

    const invalidRow = rows.find((row) => {
      const qtyPuom = numberOrZero(row.qty_puom);
      const uppp = numberOrZero(row.uppp);
      const qtyLuom = numberOrZero(row.qty_luom);
      const unitPrice = numberOrZero(row.unit_price);
      const total = (qtyPuom * uppp + qtyLuom) * unitPrice;
      return !(total > 0);
    });
    if (invalidRow) {
      return setError("One or more line items have zero total amount. Please check quantity and unit price before submitting");
    }
    const rect = submitBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setSubmitConfirmPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = () => {
    setShowSubmitConfirm(false);
    if (lineAmount(rows[0]) < lineDiscPrice(rows[0])) {
      return setError("Line item discount cannot exceed line item amount");
    }
    return runAction("submit", async () => {
      await runWorkflow("SUBMITTED", PO_DOC_TYPE.SOR, form, rows, user?.company_code, user?.loginid || user?.username);
    }, editMode ? "Sales Return updated successfully" : "Sales Return created successfully");
  };
  const handleCancel = () =>
    runAction("cancel", async () => {
      await runWorkflow("CANCELED", PO_DOC_TYPE.SOR, form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Sales Return cancelled");

  // ---- Reject handlers ----
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
      await runWorkflow("REJECTED", PO_DOC_TYPE.SOR, payloadForm, rows, user?.company_code, user?.loginid || user?.username);
      setRejectDialogOpen(false);
    }, "Sales Return rejected");
  };

  // ---- Send Back handlers ----
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
        code2: PROCESS,
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
      await runWorkflow("SENTBACK", PO_DOC_TYPE.SOR, payloadForm, rows, user?.company_code, user?.loginid || user?.username);
      setSendBackDialogOpen(false);
    }, "Sales Return sent back");
  };

  const actionBarBusy = actionLoading !== null || saving;
  console.log("flowLevelRunning------------------>", flowLevelRunning)

  return (
    <>
      <div className="finance-document-ui finance-document-editor commercial-editor payment-workbench flex h-screen flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm px-4 py-2">
        <form
          data-header-expanded={showHeaderDetails} className={` finance-document-ui payment-workbench commercial-editor grid h-screen ${isCancelled ? "grid-rows-[auto_auto_minmax(0,1fr)_auto] is-cancelled" : "grid-rows-[auto_minmax(0,1fr)_auto]"}`}
          onSubmit={(event) => { event.preventDefault(); void handleSubmitClick(); }}
        >
          <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
            <div className="flex min-h-10 items-center justify-between gap-3">
              {/* <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                  {editMode ? "Edit Sales Return" : "New Sales Return"}
                </p>
                <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">Sales Return</h2>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Doc No</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{form.doc_no || "New"}</strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Total</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{formatAmount(finalTotal)}</strong>
              </div>
              {form.ac_code && (
                <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">A/c Code</span>
                  <strong className="block truncate text-sm leading-tight text-primary-foreground">{form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}</strong>
                </div>
              )}

              {form.div_code && (
                <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Division Code</span>
                  <strong className="block truncate text-sm leading-tight text-primary-foreground">{form.div_name ? `${form.div_code} - ${form.div_name}` : form.div_code}</strong>
                </div>
              )}
            </div> */}

              <FinanceDocumentIdentity
                title="Sales Return"
                documentNo={form.doc_no}
                documentDate={form.doc_date}
                total={formatAmount(grandTotal)}
                divCode={form.div_code}
                divName={form.div_name}
                onBack={onClose}
                headerExpanded={showHeaderDetails}
                onToggleHeader={() => setShowHeaderDetails(value => !value)}
              />
              <div className="flex items-center gap-2">
                {form.canceled === "Y" && <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">Cancelled</Badge>}
                {form.doc_no && (
                  <>
                    {/* <Button type="button" variant="secondary" onClick={handlePrint}>
                    <Printer size={15} /> Print
                  </Button> */}
                    <Button
                      aria-label="Excel"
                      title="Excel"
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => void handleReportPreviewExcel()}
                      disabled={reportPreviewExporting}
                    >
                      <Download size={15} />
                    </Button>
                  </>
                )}
                <Button type="button" variant="secondary" onClick={() => setAttachmentOpen(true)}>
                  <Paperclip size={15} /> Files
                </Button>

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
                          <p className="mb-2 text-sm text-gray-700">Submit this Sales Return?</p>
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
                  {isPendingTab && (
                    <Button type="button" onClick={handleCancel} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-orange-500 hover:bg-orange-600 shadow-md disabled:opacity-60">
                      {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
                    </Button>
                  )}

                </div>
                <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={onClose}><X size={16} /></Button>
              </div>
            </div>
          </CardHeader>

          {isCancelled && (
            <div className="cancelled-document-banner" role="status">
              <div>
                <span className="cancelled-document-kicker">Cancelled Document</span>
                <strong>{form.doc_no || "Sales Return"}</strong>
              </div>
              <p>This Sales Return is cancelled and opened in read-only mode.</p>
            </div>
          )}

          <CardContent className="commercial-editor-body min-h-0 min-w-0 overflow-auto p-3">
            {loading ? (
              <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading Purchase Quotation...</div>
            ) : (
              <div className="commercial-editor-sections grid gap-3 min-w-0">
                <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

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
                    <PurchaseOrderHeaderForm
                      form={form}
                      docType={config.docType}
                      setForm={setForm}
                      updateField={updateField}
                      disabled={disabled}
                      headerAndLineDisabled={headerAndLineDisabled}
                      editMode={editMode}
                      companyCode={user?.company_code}
                      loginid={user?.loginid || user?.username}
                      rows={rows}
                      setdetails={setRows}
                      calculateDiscount={applyDiscountCalculation}
                    />
                  </div>
                )}

                <PurchaseOrderLinesTable
                  rows={rows}
                  form={form}
                  setdetails={setRows}
                  docType={config.docType}
                  updateRow={updateRow}
                  addRow={addRow}
                  removeRow={removeRow}
                  ex_rate={form.ex_rate}
                  headerAndLineDisabled={headerAndLineDisabled}
                  discAmt={form.disc_price}
                  companyCode={user?.company_code}
                  loginid={user?.loginid || user?.username}

                />
              </div>
            )}
          </CardContent>

          {/* ← paste the new totals bar here */}




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
        title="Sales Return Attachments"
        module="PO"
        type="Sales Return"
        companyCode={user?.company_code || ""}
        loginId={user?.loginid || ""}
        flowLevel={effectiveFlowLevel}
      />


      <PurchaseReportPreview />
    </>
  );
}