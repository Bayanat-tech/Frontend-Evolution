import { Download, Loader2, Paperclip, Plus, Printer, Save, Send, Undo2, Upload, X, XCircle } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue, LookupRow } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { BudgetRequestRow } from "./BudgetRequestPage";
import { upsertBulkAccountBudgetEntryApi } from "../../../api/transactions";
import { Dialog } from "../../../components/ui/Dialog";
import ImportBudgetEdi, { type ImportedBudgetRow } from "./ExportToExcel";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";

// Year range this org is currently budgeting for. Bump the upper bound when a new year opens up.
const MIN_BUDGET_YEAR = 2026;
const MAX_BUDGET_YEAR = 2036;
const BUDGET_YEARS = Array.from({ length: MAX_BUDGET_YEAR - MIN_BUDGET_YEAR + 1 }, (_, i) => String(MIN_BUDGET_YEAR + i));

export type BudgetEditorState =
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: BudgetRequestRow }
  | null;

// Keys for the four workflow actions plus Close, used to track which single button is in-flight.
type ActionKey = "draft" | "submit" | "sendBack" | "reject" | "cancel" | "close";

interface BudgetAllocationRow {
  id: string;
  cost_code: string;
  cost_name: string;
  month_budget: string;
  budget_year: string;
  requested_amt: number;
  approved_amt: number;
}

interface BudgetRequestForm {
  request_number: string;
  div_code: string;
  div_name: string;
  curr_code: string;
  curr_name: string;
  request_date: string;
  ex_rate: number;
  budget_year: string;
  description: string;
  remarks: string;
  canceled?: string;
  flow_level_running?: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Clamp the current calendar year into [MIN_BUDGET_YEAR, MAX_BUDGET_YEAR] as the default selection.
function defaultBudgetYear() {
  const now = new Date().getFullYear();
  return String(Math.min(Math.max(now, MIN_BUDGET_YEAR), MAX_BUDGET_YEAR));
}

const emptyAllocationRow = (year: string): BudgetAllocationRow => ({
  id: newId(),
  cost_code: "",
  cost_name: "",
  month_budget: "",
  budget_year: year,
  requested_amt: 0,
  approved_amt: 0,
});

function emptyForm(editor: BudgetEditorState): BudgetRequestForm {
  return {


    request_number: editor?.mode === "edit" ? editor.row.request_number : "",
    div_code: editor?.mode === "create" ? editor.divCode || "" : editor?.mode === "edit" ? editor.row.div_code : "",
    div_name: editor?.mode === "create" ? editor.divName || "" : editor?.mode === "edit" ? editor.row.div_name || "" : "",
    curr_code: editor?.mode === "edit" ? editor.row.curr_code || "" : "",
    curr_name: "",
    ex_rate: 1,
    budget_year: editor?.mode === "edit" ? editor.row.budget_year || defaultBudgetYear() : defaultBudgetYear(),
    description: editor?.mode === "edit" ? editor.row.description || "" : "",
    request_date: editor?.mode === "edit" ? editor.row.request_date || "" : new Date().toISOString().slice(0, 10),
    remarks: "",
    canceled: editor?.mode === "edit" ? editor.row.canceled : "N",
    flow_level_running:
      editor?.mode === "edit"
        ? Number(
          editor.row.flow_level_running ?? editor.row.flow_level ?? 0,
        )
        : 0,
  };
}

function lowerRecord(raw: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(raw || {}).map(([key, value]) => [key.toLowerCase(), value]));
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function numberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthNameToNumber(monthName: string): number | null {
  const index = MONTHS.indexOf(monthName);
  return index === -1 ? null : index + 1; // 1-based: Jan=1, Feb=2, ... Dec=12
}
function monthNumberToName(monthNumber: unknown): string {
  const num = Number(monthNumber);
  if (!Number.isInteger(num) || num < 1 || num > 12) return "";
  return MONTHS[num - 1];
}

//Loads the header via Account_Budget_HEADER_PAGE. Returns the first matching row, lower-cased.
async function fetchBudgetHeader(budgetNo: string, companyCode?: string, loginid?: string): Promise<Record<string, unknown>> {
  const rows = await getDynamicLookup({
    parameter: "MS_BUDGET_ACCOUNT_HEADER_PAGE",
    code1: companyCode,
    code2: budgetNo,
    loginid: loginid || "ADMIN",
  });
  const row = (rows || [])[0] as Record<string, unknown> | undefined;
  return row ? lowerRecord(row) : {};
}

// Loads the allocation lines via Account_Budget_Detail_PAGE.
async function fetchBudgetDetail(budgetNo: string, companyCode?: string, loginid?: string): Promise<BudgetAllocationRow[]> {
  const rows = await getDynamicLookup({
    parameter: "MS_BUDGET_ACCOUNT_DETAIL_PAGE",
    code1: companyCode,
    code2: budgetNo,
    loginid: loginid || "ADMIN",
  });
  return (rows || []).map((raw) => {
    const row = lowerRecord(raw as Record<string, unknown>);
    return {
      id: newId(),
      cost_code: text(row.cost_code),
      cost_name: text(row.cost_name),
      month_budget: monthNumberToName(row.month_budget),
      budget_year: text(row.budget_year),
      requested_amt: numberOrZero(row.requested_amt),
      approved_amt: numberOrZero(row.approved_amt),
    } satisfies BudgetAllocationRow;
  });
}

// TODO: swap for real endpoints once the backend routes are ready.
function buildHeaderPayload(form: BudgetRequestForm, companyCode?: string, loginid?: string) {
  return {
    request_number: form.request_number || undefined, // omit for create; backend assigns a new one
    div_code: form.div_code,
    div_name: form.div_name,
    curr_code: form.curr_code,
    curr_name: form.curr_name,
    ex_rate: form.ex_rate,
    request_date: form.request_date,
    budget_year: form.budget_year,
    description: form.description,
    remarks: form.remarks,
    canceled: form.canceled || "N",
    company_code: companyCode,
    user_id: loginid,
  };
}

function monthNameToISODate(monthName: string, year: string): string | null {
  const monthIndex = MONTHS.indexOf(monthName);
  if (monthIndex === -1 || !year) return null;
  return new Date(Date.UTC(Number(year), monthIndex, 1)).toISOString();
}

function buildDetailsPayload(rows: BudgetAllocationRow[]) {
  return rows.map((row) => ({
    cost_code: row.cost_code,
    cost_name: row.cost_name,
    month_budget: monthNameToNumber(row.month_budget), budget_year: row.budget_year,
    requested_amt: row.requested_amt,
    approved_amt: row.approved_amt,
  }));
}

async function saveBudgetRequestDraft(
  form: BudgetRequestForm,
  rows: BudgetAllocationRow[],
  companyCode?: string,
  loginid?: string
) {
  return upsertBulkAccountBudgetEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid),
      details: buildDetailsPayload(rows),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    "SAVEASDRAFT"
  );
}

async function submitBudgetRequest(
  form: BudgetRequestForm,
  rows: BudgetAllocationRow[],
  companyCode?: string,
  loginid?: string
) {
  return upsertBulkAccountBudgetEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid),
      details: buildDetailsPayload(rows),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    "SUBMITTED"
  );
}

async function rejectBudgetRequest(
  form: BudgetRequestForm,
  rows: BudgetAllocationRow[],
  companyCode?: string,
  loginid?: string
) {
  return upsertBulkAccountBudgetEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid),
      details: buildDetailsPayload(rows),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    "REJECTED"
  );
}


async function closeBudgetRequest(
  form: BudgetRequestForm,
  rows: BudgetAllocationRow[],
  companyCode?: string,
  loginid?: string
) {
  return upsertBulkAccountBudgetEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid),
      details: buildDetailsPayload(rows),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    "CLOSED"
  );
}


async function cancelBudgetRequest(
  form: BudgetRequestForm,
  rows: BudgetAllocationRow[],
  companyCode?: string,
  loginid?: string
) {
  return upsertBulkAccountBudgetEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid),
      details: buildDetailsPayload(rows),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    "CANCELED"
  );
}
async function sendBackBudgetRequest(
  form: BudgetRequestForm,
  rows: BudgetAllocationRow[],
  companyCode?: string,
  loginid?: string
) {
  return upsertBulkAccountBudgetEntryApi(
    {
      header: buildHeaderPayload(form, companyCode, loginid),
      details: buildDetailsPayload(rows),
      company_code: companyCode || "",
      loginid: loginid || "ADMIN",
    },
    "SENTBACK"
  );
}

export function BudgetRequestEditor({
  editor,
  isPendingTab,
  onClose,
  onSaved,
}: {
  editor: BudgetEditorState;
  isPendingTab: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const editMode = editor?.mode === "edit";
  const [form, setForm] = useState<BudgetRequestForm>(() => emptyForm(editor));
  const [rows, setRows] = useState<BudgetAllocationRow[]>(() => (editMode ? [] : [emptyAllocationRow(form.budget_year)]));
  const [loading, setLoading] = useState(Boolean(editMode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flowLevelRunning, setFlowLevelRunning] = useState<number>(0);
  const [importOpen, setImportOpen] = useState(false);
  // Tracks which single workflow button is currently in-flight, so only that button shows a spinner
  // while the rest of the action bar disables to prevent double-submits.
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);

  useEffect(() => {
    if (!editor) return;
    const initialForm = emptyForm(editor);
    setForm(initialForm);
    setRows(editor.mode === "edit" ? [] : [emptyAllocationRow(initialForm.budget_year)]);
    setError("");
    setLoading(editor.mode === "edit");
  }, [editor]);

  // In edit mode, pull the header from Account_Budget_HEADER_PAGE and the lines from Account_Budget_Detail_PAGE.
  useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!editMode || editor?.mode !== "edit") return;
      setLoading(true);
      setError("");
      try {
        const requestNumber = editor.row.request_number;
        const [headerRaw, detailRows] = await Promise.all([
          fetchBudgetHeader(requestNumber, user?.company_code, user?.loginid || user?.username),
          fetchBudgetDetail(requestNumber, user?.company_code, user?.loginid || user?.username),
        ]);
        if (!mounted) return;

        setForm((current) => ({
          ...current,
          request_number: text(headerRaw.request_number || requestNumber),
          div_code: text(headerRaw.div_code || current.div_code),
          div_name: text(headerRaw.div_name || current.div_name),
          curr_code: text(headerRaw.curr_code || current.curr_code),
          curr_name: text(headerRaw.curr_name || current.curr_name),
          ex_rate: Number(headerRaw.ex_rate || current.ex_rate || 1),
          budget_year: text(headerRaw.budget_year || current.budget_year),
          description: text(headerRaw.description || current.description),
          remarks: text(headerRaw.remarks || current.remarks),
          request_date: toDateInputValue(headerRaw.request_date) || current.request_date,
          flow_level_running: flowLevelRunning,
          canceled: text(headerRaw.canceled || current.canceled || "N"),
        }));
        setRows(detailRows.length ? detailRows : [emptyAllocationRow(text(headerRaw.budget_year) || defaultBudgetYear())]);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load budget request");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadExisting();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, editor?.mode === "edit" ? editor.row.request_number : undefined, user?.company_code, user?.loginid || user?.username]);

  const disabled = form.canceled === "Y" || saving || loading;
  const actionDisabled = disabled || !isPendingTab;
  const effectiveFlowLevel = Number.isFinite(flowLevelRunning) ? flowLevelRunning : 0;

  const isLevelOne = editMode && effectiveFlowLevel === 1;
  const isLevelGreaterThanOne = editMode && effectiveFlowLevel > 1;
  const headerAndLineDisabled = disabled || isLevelGreaterThanOne;
  const approvedAmountDisabled = disabled || isLevelOne;
  const isCancelled = form.canceled === "Y";

  const totalRequested = rows.reduce((sum, row) => sum + (Number(row.requested_amt) || 0), 0);
  const totalApproved = rows.reduce((sum, row) => sum + (Number(row.approved_amt) || 0), 0);

  const updateField = (field: keyof BudgetRequestForm, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  // Changing the header Year auto-fills every allocation row's Year with the newly selected year.
  const updateYear = (value: string) => {
    setForm((current) => ({ ...current, budget_year: value }));
    setRows((current) => current.map((row) => ({ ...row, budget_year: value })));
  };

  const updateRow = (id: string, patch: Partial<BudgetAllocationRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((current) => [...current, emptyAllocationRow(form.budget_year)]);
  const removeRow = (id: string) => setRows((current) => current.filter((row) => row.id !== id));

  const handleImportedRows = (importedRows: ImportedBudgetRow[]) => {
    if (!importedRows.length) return;

    const mappedRows: BudgetAllocationRow[] = importedRows.map((row, index) => ({
      id: `${Date.now()}_${index}`,
      cost_code: row.cost_code || "",
      cost_name: row.cost_name || "",
      month_budget: row.month_budget || "",
      budget_year: row.budget_year || form.budget_year || defaultBudgetYear(),
      requested_amt: Number(row.requested_amt || 0),
      approved_amt: Number(row.approved_amt || 0),
    }));

    setRows(mappedRows);
    setForm((current) => ({ ...current, budget_year: mappedRows[0]?.budget_year || current.budget_year }));
  };

  // key identifies which button triggered this action, so the UI can show a spinner on that
  // specific button while disabling the rest of the action bar via actionBusy below.
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await getDynamicLookup({
          parameter: "MS_BUDGET_FUN_CHECK_BUDGET_APPR_LEVEL",
          code1: user?.company_code,
          code2: user?.loginid || user?.username || "ADMIN",
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

  const handleSaveAsDraft = () =>
    runAction("draft", async () => {
      await saveBudgetRequestDraft(form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Budget request saved as draft");

  const handleSubmit = () => {
    if (!form.div_code) return setError("Division is required");
    if (!form.curr_code) return setError("Currency is required");
    if (!form.budget_year) return setError("Budget Year is required");
    return runAction("submit", async () => {
      await submitBudgetRequest(form, rows, user?.company_code, user?.loginid || user?.username);
    }, editMode ? "Budget request updated successfully" : "Budget request created successfully");
  };

  const handleReject = () =>
    runAction("reject", async () => {
      await rejectBudgetRequest(form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Budget request rejected");

  const handleCancel = () =>
    runAction("cancel", async () => {
      await cancelBudgetRequest(form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Budget request cancelled");

  const handleClose = () =>
    runAction("close", async () => {
      await closeBudgetRequest(form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Budget request closed");

  const handleSendBack = () =>
    runAction("sendBack", async () => {
      await sendBackBudgetRequest(form, rows, user?.company_code, user?.loginid || user?.username);
    }, "Budget request sent back");

  // True while any workflow action button is in-flight; used to disable the whole bar so a
  // second button can't be clicked mid-request.
  const actionBarBusy = actionLoading !== null || saving;

  return (
    <>
      <form
        className={`payment-workbench commercial-editor grid h-screen ${isCancelled ? "grid-rows-[auto_auto_minmax(0,1fr)_auto] is-cancelled" : "grid-rows-[auto_minmax(0,1fr)_auto]"}`}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                  {editMode ? "Edit Budget Request" : "New Budget Request"}
                </p>
                <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">Budget Request</h2>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Request Number</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{form.request_number || "New"}</strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Budget Year</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{form.budget_year || "—"}</strong>
              </div>
              <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Requested</span>
                <strong className="block text-sm leading-tight text-primary-foreground">{formatAmount(totalRequested)}</strong>
              </div>
              {form.div_code && (
                <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Division</span>
                  <strong className="block truncate text-sm leading-tight text-primary-foreground">{form.div_name ? `${form.div_code} - ${form.div_name}` : form.div_code}</strong>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {form.canceled === "Y" && <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">Cancelled</Badge>}
              {form.request_number && (
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
              <span className="cancelled-document-kicker">Cancelled Request</span>
              <strong>{form.request_number || "Budget Request"}</strong>
            </div>
            <p>This budget request is cancelled and opened in read-only mode.</p>
          </div>
        )}

        <CardContent className="min-h-0 overflow-auto p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading budget request...</div>
          ) : (
            <div className="grid gap-3">
              <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

              <div className="rounded-md border bg-card">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                  <div>
                    <p className="eyebrow m-0">Header</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Budget Information</h3>
                  </div>
                </div>
                <div className="payment-header-grid grid grid-cols-4 gap-2.5 p-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                  {editMode && <Field label="Budget Number"><Input disabled value={form.request_number || ""} /></Field>}

                  <LookupField
                    label="Division *"
                    value={form.div_code}
                    displayValue={form.div_name ? `${form.div_code} - ${form.div_name}` : form.div_code}
                    columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
                    valueField="div_code"
                    displayFields={["div_code", "div_name"]}
                    loadOptions={() => getDynamicLookup({
                      parameter: "Account_division",
                      code1: user?.company_code,
                      loginid: user?.loginid || user?.username || "ADMIN",
                    })}
                    disabled={headerAndLineDisabled}
                    onChange={(value, row) => setForm((current) => ({
                      ...current,
                      div_code: value,
                      div_name: text(getLookupValue(row || {}, "div_name")),
                    }))}
                  />

                  <LookupField
                    label="Currency *"
                    value={form.curr_code}
                    displayValue={form.curr_name ? `${form.curr_code} - ${form.curr_name}` : form.curr_code}
                    columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                    valueField="curr_code"
                    displayFields={["curr_code", "curr_name"]}
                    loadOptions={() => getDynamicLookup({
                      parameter: "Account_Currency_CODE_Serach",
                      code1: user?.company_code,
                      loginid: user?.loginid || user?.username || "ADMIN",
                    })}
                    disabled={headerAndLineDisabled}
                    onChange={(value, row) => setForm((current) => ({
                      ...current,
                      curr_code: value,
                      curr_name: text(getLookupValue(row || {}, "curr_name")),
                      ex_rate: Number(getLookupValue(row || {}, "ex_rate") || (row as Record<string, unknown>)?.ex_rate || current.ex_rate || 1),
                    }))}
                  />

                  <Field label="Request Date *">
                    <Input type="date" disabled={headerAndLineDisabled} required value={form.request_date} onChange={(event) => updateField("request_date", event.target.value)} />
                  </Field>

                  <Field label="Budget Year *">
                    <Select className="max-w-[120px]" disabled={headerAndLineDisabled} required value={form.budget_year} onChange={(event) => updateYear(event.target.value)}>
                      {BUDGET_YEARS.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </Select>
                  </Field>

                  <label className="field col-span-1 max-md:col-span-1">
                    <span>Description</span>
                    <Input disabled={headerAndLineDisabled} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
                  </label>

                  <label className="field col-span-2 max-md:col-span-1">
                    <span>Remarks</span>
                    <Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
                  </label>
                </div>
              </div>

              <div className="commercial-lines-card rounded-md border bg-card">
                <div className="flex items-center justify-between  border-b bg-secondary/40 px-3 py-1.5">
                  <div>
                    <p className="eyebrow m-0">Allocation</p>
                    <h3 className="m-0 text-sm font-semibold leading-tight">Budget Allocation Lines</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button disabled={headerAndLineDisabled} size="sm" type="button" variant="outline" onClick={addRow}>
                      <Plus size={14} /> Add Line
                    </Button>
                    <Button disabled={!editMode || isLevelGreaterThanOne} size="sm" type="button" variant="outline" onClick={() => setImportOpen(true)}>
                      <Upload size={14} /> Import from Excel
                    </Button>
                  </div>
                </div>
                <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
                  <table className="finance-lines-table w-full min-w-[1000px] text-sm">
                    <thead className="sticky top-0 bg-primary text-xs text-primary-foreground">
                      <tr>
                        <th className="finance-sticky-col finance-col-no px-2 py-2 text-left">No</th>
                        <th className="px-2 py-2 text-left w-64">Cost Code</th>
                        <th className="px-2 py-2 text-left w-32">Month</th>
                        <th className="px-2 py-2 text-left w-32">Year</th>
                        <th className="finance-amount-cell px-2 py-2 text-left w-32">Requested Amount</th>
                        <th className="finance-amount-cell px-2 py-2 text-left w-32">Approved Amount</th>
                        <th className="px-2 py-2 text-left w-32">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>No allocation lines yet</td></tr>
                      ) : rows.map((row, index) => (
                        <tr className="border-t odd:bg-muted/20" key={row.id}>
                          <td className="finance-sticky-col finance-col-no px-2 py-1 text-xs">{index + 1}</td>
                          <td className="w-64 px-2 py-1">
                            {/* TODO: wire to cost code/name master lookup API */}
                            <LookupField
                              label=""
                              value={row.cost_code || ""}
                              displayValue={row.cost_name ? `${row.cost_code} - ${row.cost_name}` : row.cost_code}
                              columns={[{ field: "cost_code", header: "Cost Code" }, { field: "cost_name", header: "Cost Name" }]}
                              valueField="cost_code"
                              displayFields={["cost_code", "cost_name"]}
                              loadOptions={() => getDynamicLookup({
                                parameter: "MS_BUDGET_ACCOUNT_COST",
                                code1: user?.company_code,
                                loginid: user?.loginid || user?.username || "ADMIN",
                              })}
                              disabled={headerAndLineDisabled}
                              onChange={(value, selectedRow) => updateRow(row.id, {
                                cost_code: value,
                                cost_name: text(getLookupValue(selectedRow || {}, "cost_name")),
                              })}
                            />
                          </td>
                          <td className="w-36 px-2 py-1">
                            <Select disabled={headerAndLineDisabled} value={row.month_budget} onChange={(event) => updateRow(row.id, { month_budget: event.target.value })}>
                              <option value="">Select</option>
                              {MONTHS.map((month) => (
                                <option key={month} value={month}>{month}</option>
                              ))}
                            </Select>
                          </td>
                          <td className="w-28 px-2 py-1">
                            {/* Auto-filled from the header Year; still editable per-line if a row genuinely needs a different year. */}
                            <Select disabled={headerAndLineDisabled} value={row.budget_year} onChange={(event) => updateRow(row.id, { budget_year: event.target.value })}>
                              {BUDGET_YEARS.map((year) => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </Select>
                          </td>
                          <td className="finance-amount-cell w-40 px-2 py-1">
                            <Input
                              className="finance-money-input"
                              disabled={headerAndLineDisabled}
                              type="number"
                              style={{ textAlign: "right" }}
                              step="0.001"
                              value={row.requested_amt}
                              onChange={(event) => updateRow(row.id, { requested_amt: Number(event.target.value || 0) })}
                            />
                          </td>
                          <td className="finance-amount-cell w-40 px-2 py-1">
                            <Input
                              className="finance-money-input"
                              disabled={approvedAmountDisabled}
                              readOnly={flowLevelRunning === 1}
                              type="number"
                              style={{ textAlign: "right" }}
                              step="0.001"
                              value={row.approved_amt}
                              onChange={(event) => updateRow(row.id, { approved_amt: Number(event.target.value || 0) })}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Button disabled={headerAndLineDisabled} size="icon" type="button" variant="ghost" onClick={() => removeRow(row.id)}><X size={14} /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Total Requested</span>
                  <strong className="text-emerald-600">{formatAmount(totalRequested)}</strong>
                </div>
                {<div className="flex items-center justify-end gap-8 px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">Total Approved</span>
                  <strong className="text-emerald-600">{formatAmount(totalApproved)}</strong>
                </div>}
              </div>
            </div>
          )}
        </CardContent>

        <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
          <div className="flex flex-wrap gap-3 rounded-2xl bg-gray-50 p-5 shadow-inner">

            <Button
              type="button"
              onClick={handleSaveAsDraft}
              disabled={actionDisabled || actionBarBusy}
              className="rounded-full bg-blue-600 hover:bg-blue-700 shadow-md disabled:opacity-60"
            >
              {actionLoading === "draft" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {actionLoading === "draft" ? "Saving..." : "Save Draft"}
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={actionDisabled || actionBarBusy}
              className="rounded-full bg-green-600 hover:bg-green-700 shadow-md disabled:opacity-60"
            >
              {actionLoading === "submit" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {actionLoading === "submit" ? "Submitting..." : "Submit"}
            </Button>

            <Button
              type="button"
              onClick={handleSendBack}
              disabled={actionDisabled || actionBarBusy}
              className="rounded-full bg-yellow-500 hover:bg-yellow-600 shadow-md disabled:opacity-60"
            >
              {actionLoading === "sendBack" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              {actionLoading === "sendBack" ? "Sending Back..." : "Send Back"}
            </Button>

            <Button
              type="button"
              onClick={handleReject}
              disabled={actionDisabled || actionBarBusy}
              className="rounded-full bg-red-600 hover:bg-red-700 shadow-md disabled:opacity-60"
            >
              {actionLoading === "reject" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {actionLoading === "reject" ? "Rejecting..." : "Reject"}
            </Button>

            <Button
              type="button"
              onClick={handleCancel}
              disabled={actionDisabled || actionBarBusy}
              className="rounded-full bg-orange-500 hover:bg-orange-600 shadow-md disabled:opacity-60"
            >
              {actionLoading === "cancel" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={actionBarBusy}
              className="rounded-full shadow-md disabled:opacity-60"
            >
              Close
            </Button>

          </div>
          <div className="flex items-center gap-2">
            <Button aria-label="Print" type="button" variant="outline" size="icon" disabled={actionDisabled}><Printer size={15} /></Button>
            <Button aria-label="Upload" type="button" variant="outline" size="icon" disabled={actionDisabled}><Upload size={15} /></Button>
            <Button aria-label="Attachment" type="button" variant="outline" size="icon" disabled={actionDisabled}><Paperclip size={15} /></Button>
            <Button aria-label="Download" type="button" variant="outline" size="icon" disabled={actionDisabled}><Download size={15} /></Button>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </form>
      <Dialog
        open={importOpen}
        title="Import Budget Excel"
        description="Upload budget data from an Excel file and stage it for import."
        wide
        onClose={() => setImportOpen(false)}
        footer={<Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>}
      >
        <ImportBudgetEdi
          requestNumber={form.request_number}
          onClose={() => setImportOpen(false)}
          onSuccess={(importedRows) => {
            handleImportedRows(importedRows);
            setImportOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function formatAmount(value: number) {
  const amount = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return value < 0 ? `(${amount})` : amount;
}