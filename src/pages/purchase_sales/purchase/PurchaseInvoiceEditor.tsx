import { Download, Loader2, Paperclip, Printer, Save, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
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
} from "./Purchaseordertypes";
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
  
} from "./Purchaseorderutils";
import { PurchaseOrderHeaderForm } from "./Purchaseorderheaderform";
import { PurchaseOrderLinesTable } from "./Purchaseorderlinestable";
import { SendBackDialog } from "./Sendbackdialog";
import { RejectDialog } from "./Rejectdialog";


export type { PurchaseOrderEditorState };

export function PurchaseInvoiceEditor({
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

  useEffect(() => {
    if (!editor) return;
    const initialForm = emptyForm(editor);
    setForm(initialForm);
    setRows(editor.mode === "edit" ? [] : [emptyLineRow(initialForm.div_code)]);
    setError("");
    setLoading(editor.mode === "edit");
  }, [editor]);

  useEffect(() => {
    if (!form.tax_code && !form.tax_category) return;
    setRows((current) =>
      current.map((row) => ({
        ...row,
        tax_code: form.tax_code || row.tax_code,
        tax_cat: form.tax_category || row.tax_cat,
      }))
    );
  }, [form.tax_code, form.tax_category]);

  useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!editMode || editor?.mode !== "edit") return;
      setLoading(true);
      setError("");
      try {
        const docNo = editor.row.doc_no;
        const [headerRaw, detailRows] = await Promise.all([
          fetchPurchaseOrderHeader(docNo,config, user?.company_code, user?.loginid || user?.username),
          fetchPurchaseOrderDetail(docNo,config, user?.company_code, user?.loginid || user?.username),
        ]);
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
          ac_name: text(headerRaw.ac_name || current.ac_name),
          party_address: text(headerRaw.address || current.party_address),
          credit_period: Number(headerRaw.credit_period || current.credit_period || 0),
          dept_code: text(headerRaw.dept_code || current.dept_code),
          party_phone: text(headerRaw.tel || current.party_phone),
          party_fax: text(headerRaw.fax || current.party_fax),
          buyer: text(headerRaw.buyer || current.buyer),
          wo_number: text(headerRaw.wo_number || current.wo_number),
          curr_code: text(headerRaw.curr_code || current.curr_code),
          curr_name: text(headerRaw.curr_name || current.curr_name),
          ex_rate: Number(headerRaw.ex_rate || current.ex_rate || 1),
          payment_terms: text(headerRaw.pay_terms || current.payment_terms),
          dlvr_term: text(headerRaw.delivery_term || current.dlvr_term),
          dlvr_contact: text(headerRaw.delivery_contact || current.dlvr_contact),
          dlvr_mobile: text(headerRaw.delivery_tel || current.dlvr_mobile),
          dlvr_email: text(headerRaw.delivery_email || current.dlvr_email),
          remarks: text(headerRaw.remarks || current.remarks),
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
        }));
        setRows(detailRows.length ? detailRows : [emptyLineRow(text(headerRaw.div_code) || "")]);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load Purchase Invoice");
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
          code3: "purchase_invoice",
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
  const headerAndLineDisabled = disabled || isLevelGreaterThanOne;
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

  const updateRow = (id: string, patch: Partial<PurchaseOrderLineRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () =>
    setRows((current) => [
      ...current,
      {
        ...emptyLineRow(form.div_code),
        tax_code: form.tax_code,
        tax_cat: form.tax_category,
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

 const handleSaveAsDraft = () =>
  runAction("draft", async () => {
    await runWorkflow("SAVEASDRAFT", PO_DOC_TYPE.PIN, form, rows, user?.company_code, user?.loginid || user?.username);
  }, "Sales Order saved as draft");
  const handleSubmit = () => {
    if (!form.div_code) return setError("Division is required");
    if (!form.ac_code) return setError("A/c Code is required");
    if (!form.curr_code) return setError("Currency is required");
    return runAction("submit", async () => {
      await runWorkflow("SUBMITTED", PO_DOC_TYPE.PIN, form, rows, user?.company_code, user?.loginid || user?.username);
    }, editMode ? "Purchase Invoice updated successfully" : "Purchase Invoice created successfully");
  };

  const handleCancel = () =>
    runAction("cancel", async () => {
      await runWorkflow("CANCELED", PO_DOC_TYPE.PIN, form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Purchase Invoice cancelled");

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
      await runWorkflow("REJECTED", PO_DOC_TYPE.PIN, payloadForm, rows, user?.company_code, user?.loginid || user?.username);
      setRejectDialogOpen(false);
    }, "Purchase Invoice rejected");
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
      await runWorkflow("SENTBACK", PO_DOC_TYPE.PIN, payloadForm, rows, user?.company_code, user?.loginid || user?.username);
      setSendBackDialogOpen(false);
    }, "Purchase Invoice sent back");
  };

  const actionBarBusy = actionLoading !== null || saving;
    console.log("flowLevelRunning------------------>",flowLevelRunning)

  return (
    <>
      <form
        className={`payment-workbench commercial-editor grid h-screen ${isCancelled ? "grid-rows-[auto_auto_minmax(0,1fr)_auto] is-cancelled" : "grid-rows-[auto_minmax(0,1fr)_auto]"}`}
        onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}
      >
        <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                  {editMode ? "Edit Purchase Invoice" : "New Purchase Invoice"}
                </p>
                <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">Purchase Invoice</h2>
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
            </div>
            <div className="flex items-center gap-2">
              {form.canceled === "Y" && <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">Cancelled</Badge>}
              {form.doc_no && (
                <>
                  <Button type="button" variant="secondary"><Printer size={15} /> Print</Button>
                  <Button aria-label="Excel" type="button" variant="secondary" size="icon"><Download size={15} /></Button>
                </>
              )}
              <Button type="button" variant="secondary"><Paperclip size={15} /> Files</Button>
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={onClose}><X size={16} /></Button>
            </div>
          </div>
        </CardHeader>

        {isCancelled && (
          <div className="cancelled-document-banner" role="status">
            <div>
              <span className="cancelled-document-kicker">Cancelled Document</span>
              <strong>{form.doc_no || "Purchase Invoice"}</strong>
            </div>
            <p>This Purchase Invoice is cancelled and opened in read-only mode.</p>
          </div>
        )}

        <CardContent className="min-h-0 overflow-auto p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading Purchase Invoice...</div>
          ) : (
            <div className="grid gap-3">
              <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

              <PurchaseOrderHeaderForm
                form={form}
                setdetails={setRows}
                docType={PO_DOC_TYPE.PIN}
                setForm={setForm}
                updateField={updateField}
                disabled={disabled}
                headerAndLineDisabled={headerAndLineDisabled}
                editMode={editMode}
                companyCode={user?.company_code}
                loginid={user?.loginid || user?.username}
              />

              <PurchaseOrderLinesTable
                rows={rows}
                form={form}
                setdetails={setRows}
                docType={PO_DOC_TYPE.PIN}
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

        <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
          <div className="flex flex-wrap gap-3 rounded-2xl bg-gray-50 p-5 shadow-inner">
           { isPendingTab && (
             <Button type="button" onClick={handleSaveAsDraft} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-blue-600 hover:bg-blue-700 shadow-md disabled:opacity-60">
                {actionLoading === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {actionLoading === "draft" ? "Saving..." : "Save Draft"}
              </Button>
            )}
          { isPendingTab && <Button type="button" onClick={handleSubmit} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-green-600 hover:bg-green-700 shadow-md disabled:opacity-60">
              {actionLoading === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {actionLoading === "submit" ? "Submitting..." : "Submit"}
            </Button>}

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
{isPendingTab &&
            <Button type="button" onClick={handleCancel} disabled={actionDisabled || actionBarBusy} className="rounded-full bg-orange-500 hover:bg-orange-600 shadow-md disabled:opacity-60">
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
            </Button>}
          </div>
          <div className="flex items-center gap-2">
            <Button aria-label="Print" type="button" variant="outline" size="icon" disabled={actionDisabled}><Printer size={15} /></Button>
            <Button aria-label="Attachment" type="button" variant="outline" size="icon" disabled={actionDisabled}><Paperclip size={15} /></Button>
            <Button aria-label="Download" type="button" variant="outline" size="icon" disabled={actionDisabled}><Download size={15} /></Button>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </form>

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
    </>
  );
}