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
  PurchaseConfig,
  PurchaseOrderEditorState,
  SendBackUserOption,
} from "../purchase/Purchaseordertypes";
import {

  formatAmount,
  lineNetAmount,

  lowerRecord,
  newId,
  numberOrZero,
  text,
} from "../purchase/Purchaseorderutils";
import { SendBackDialog } from "../purchase/Sendbackdialog";
import { RejectDialog } from "../purchase/Rejectdialog";
import {  PROCESSSA, InventoryConfig, IV_DOC_TYPE, PurchaseOrderForm, InventoryLineRow } from "./Inventorytypes";
import { emptyForm, emptyLineRow, fetchSalesOrderDetail, fetchSalesOrderHeader, lineAmount, lineDiscPrice, lineTaxAmount, runWorkflow } from "./Inventoryutils";
import { StockHeaderForm } from "./StockHeaderForm";
import { StockDetail } from "./StockDetail";


export type { PurchaseOrderEditorState };

export function StockadjustmentEditor({
  config,
  editor,
  isPendingTab,
  onClose,
  onSaved,
}: {
  config: InventoryConfig;
  editor: PurchaseOrderEditorState;
  isPendingTab: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const editMode = editor?.mode === "edit";
  const [form, setForm] = useState<PurchaseOrderForm>(() => emptyForm(editor));
  const [rows, setRows] = useState<InventoryLineRow[]>(() => (editMode ? [] : [emptyLineRow(form.div_code)]));
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
    let mounted = true;
    async function loadExisting() {
      if (!editMode || editor?.mode !== "edit") return;
      setLoading(true);
      setError("");
      try {
        const docNo = editor.row.doc_no;
        const [headerRaw, detailRows] = await Promise.all([
          fetchSalesOrderHeader(docNo,config, user?.company_code, user?.loginid || user?.username),
          fetchSalesOrderDetail(docNo,config, user?.company_code, user?.loginid || user?.username),
        ]);
        if (!mounted) return;

        setForm((current) => ({
          ...current,
          doc_no: text(headerRaw.doc_no || docNo),
          doc_date: toDateInputValue(headerRaw.doc_date) || current.doc_date,
          quotn_no: text(headerRaw.quotn_no || current.quotn_no),
          quotn_date: toDateInputValue(headerRaw.quotn_date) || current.quotn_date,
          div_code: text(headerRaw.div_code || current.div_code),
          div_name: text(headerRaw.div_name || current.div_name),
          ac_code: text(headerRaw.ac_code || current.ac_code),
          ac_name: text(headerRaw.ac_name || current.ac_name),
          address: text(headerRaw.address || current.address),
          credit_period: Number(headerRaw.credit_period || current.credit_period || 0),
          dept_code: text(headerRaw.dept_code || current.dept_code),
          tel: text(headerRaw.tel || current.tel),
          fax: text(headerRaw.fax || current.fax),
          buyer: text(headerRaw.buyer || current.buyer),
          wo_no: text(headerRaw.wo_no || current.wo_no),
          curr_code: text(headerRaw.curr_code || current.curr_code),
          curr_name: text(headerRaw.curr_name || current.curr_name),
          ex_rate: Number(headerRaw.ex_rate || current.ex_rate || 1),
          pay_terms: text(headerRaw.pay_terms || current.pay_terms),
          delivery_term: text(headerRaw.delivery_term || current.delivery_term),
          delivery_contact: text(headerRaw.delivery_contact || current.delivery_contact),
          delivery_tel: text(headerRaw.delivery_tel || current.delivery_tel),
          delivery_email: text(headerRaw.delivery_email || current.delivery_email),
          remarks: text(headerRaw.remarks || current.remarks),
          issued_by: text(headerRaw.issued_by || current.issued_by),
           received_by: text(headerRaw.received_by || current.received_by),
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
          from_zone_code : text(headerRaw.from_zone_code || current.from_zone_code ),
        to_zone_code : text(headerRaw.to_zone_code || current.to_zone_code ),
          zone_code : text(headerRaw.zone_code || current.zone_code ),
          job_no : text(headerRaw.job_no || current.job_no ),

        }));
        setRows(detailRows.length ? detailRows : [emptyLineRow(text(headerRaw.div_code) || "")]);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load Stock Adjustment");
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
          code3: PROCESSSA,
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

  const updateRow = (id: string, patch: Partial<InventoryLineRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((current) => [...current, emptyLineRow(form.div_code)]);
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
 {  if (!form.div_code) return setError("Division is required");
  return runAction("draft", async () => {
    await runWorkflow("SAVEASDRAFT",  IV_DOC_TYPE.SAJ, form, rows, user?.company_code, user?.loginid || user?.username);
  }, "Stock Adjustment saved as draft");
}
  const handleSubmit = () => {
    if (!form.div_code) return setError("Division is required");
    return runAction("submit", async () => {
      await runWorkflow("SUBMITTED", IV_DOC_TYPE.SAJ, form, rows, user?.company_code, user?.loginid || user?.username);
    }, editMode ? "Stock Adjustment updated successfully" : "Stock Adjustment created successfully");
  };

  const handleCancel = () =>
    runAction("cancel", async () => {
      await runWorkflow("CANCELED", IV_DOC_TYPE.SAJ, form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Stock Adjustment cancelled");

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
      await runWorkflow("REJECTED", IV_DOC_TYPE.SAJ, payloadForm, rows, user?.company_code, user?.loginid || user?.username);
      setRejectDialogOpen(false);
    }, "Stock Adjustment rejected");
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
        code2: PROCESSSA,
      });
      const options: SendBackUserOption[] = (rows || []).map((raw) => {
        const row = lowerRecord(raw as Record<string, unknown>);
        const level = row.level_no ?? row.level ?? row.levelno ?? row.level_no;
        const name = row.description ?? row.desc ?? row.name ?? row.username;
        return {
          code: text(level),
          name: text(name),
          level_no: numberOrZero(level),
        };
      }).filter((option) => option.code);
      setSendBackUsers(options);
    } catch (error) {
      setSendBackUsers([]);
      setSendBackError(error instanceof Error ? error.message : "Unable to load send-back users");
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
      await runWorkflow("SENTBACK", IV_DOC_TYPE.SAJ, payloadForm, rows, user?.company_code, user?.loginid || user?.username);
      setSendBackDialogOpen(false);
    }, "Stock Adjustment sent back");
  };

  const actionBarBusy = actionLoading !== null || saving;

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
                  {editMode ? "Edit Stock Adjustment" : "New Stock Adjustment"}
                </p>
                <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">Stock Adjustment</h2>
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
              <strong>{form.doc_no || "Stock Adjustment"}</strong>
            </div>
            <p>This Stock Adjustment is cancelled and opened in read-only mode.</p>
          </div>
        )}

        <CardContent className="min-h-0 overflow-auto p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading Stock Adjustment...</div>
          ) : (
            <div className="grid gap-3">
              <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

              <StockHeaderForm
                form={form}
                setForm={setForm}
                updateField={updateField}
                disabled={disabled}
                headerAndLineDisabled={headerAndLineDisabled}
                editMode={editMode}
                companyCode={user?.company_code}
                loginid={user?.loginid || user?.username}
                docType={config.docType}
              />

              <StockDetail
                rows={rows}
                updateRow={updateRow}
                addRow={addRow}
                removeRow={removeRow}
                headerAndLineDisabled={headerAndLineDisabled}
                companyCode={user?.company_code}
                loginid={user?.loginid || user?.username}
                docType={config.docType}
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