import { Download, Paperclip, Plus, Printer, Save, Send, Undo2, Upload, X, XCircle } from "lucide-react";
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

// Year range this org is currently budgeting for. Bump the upper bound when a new year opens up.
const MIN_BUDGET_YEAR = 2026;
const MAX_BUDGET_YEAR = 2036;
const BUDGET_YEARS = Array.from({ length: MAX_BUDGET_YEAR - MIN_BUDGET_YEAR + 1 }, (_, i) => String(MIN_BUDGET_YEAR + i));

export type BudgetEditorState =
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: BudgetRequestRow }
  | null;

interface BudgetAllocationRow {
  id: string;
  cost_code: string;
  cost_name: string;
  month: string;
  year: string;
  requested_amount: number;
  approved_amount: number;
}

interface BudgetRequestForm {
  budget_no: string;
  div_code: string;
  div_name: string;
  curr_code: string;
  curr_name: string;
  ex_rate: number;
  year: string;
  description: string;
  remarks: string;
  canceled?: string;
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
  month: "",
  year,
  requested_amount: 0,
  approved_amount: 0,
});

function emptyForm(editor: BudgetEditorState): BudgetRequestForm {
  return {
    budget_no: editor?.mode === "edit" ? editor.row.budget_no : "",
    div_code: editor?.mode === "create" ? editor.divCode || "" : editor?.mode === "edit" ? editor.row.div_code : "",
    div_name: editor?.mode === "create" ? editor.divName || "" : editor?.mode === "edit" ? editor.row.div_name || "" : "",
    curr_code: editor?.mode === "edit" ? editor.row.curr_code || "" : "",
    curr_name: "",
    ex_rate: 1,
    year: editor?.mode === "edit" ? editor.row.year || defaultBudgetYear() : defaultBudgetYear(),
    description: editor?.mode === "edit" ? editor.row.description || "" : "",
    remarks: "",
    canceled: editor?.mode === "edit" ? editor.row.canceled : "N",
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

// Loads the header via Account_Budget_HEADER_PAGE. Returns the first matching row, lower-cased.
async function fetchBudgetHeader(budgetNo: string, companyCode?: string, loginid?: string): Promise<Record<string, unknown>> {
  const rows = await getDynamicLookup({
    parameter: "Account_Budget_Header_PAGE",
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
    parameter: "Account_Budget_Detail_PAGE",
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
      month: text(row.month),
      year: text(row.year),
      requested_amount: numberOrZero(row.requested_amount),
      approved_amount: numberOrZero(row.approved_amount),
    } satisfies BudgetAllocationRow;
  });
}

// TODO: swap for real endpoints once the backend routes are ready.
async function saveBudgetRequestDraft(_form: BudgetRequestForm, _rows: BudgetAllocationRow[]) { /* no-op */ }
async function submitBudgetRequest(_form: BudgetRequestForm, _rows: BudgetAllocationRow[]) { /* no-op */ }
async function rejectBudgetRequest(_budgetNo: string) { /* no-op */ }
async function sendBackBudgetRequest(_budgetNo: string) { /* no-op */ }

export function BudgetRequestEditor({
  editor,
  onClose,
  onSaved,
}: {
  editor: BudgetEditorState;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const editMode = editor?.mode === "edit";
  const [form, setForm] = useState<BudgetRequestForm>(() => emptyForm(editor));
  const [rows, setRows] = useState<BudgetAllocationRow[]>(() => (editMode ? [] : [emptyAllocationRow(form.year)]));
  const [loading, setLoading] = useState(Boolean(editMode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // In edit mode, pull the header from Account_Budget_HEADER_PAGE and the lines from Account_Budget_Detail_PAGE.
  useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!editMode || editor?.mode !== "edit") return;
      setLoading(true);
      setError("");
      try {
        const budgetNo = editor.row.budget_no;
        const [headerRaw, detailRows] = await Promise.all([
          fetchBudgetHeader(budgetNo, user?.company_code, user?.loginid || user?.username),
          fetchBudgetDetail(budgetNo, user?.company_code, user?.loginid || user?.username),
        ]);
        if (!mounted) return;
        setForm((current) => ({
          ...current,
          budget_no: text(headerRaw.budget_no || budgetNo),
          div_code: text(headerRaw.div_code || current.div_code),
          div_name: text(headerRaw.div_name || current.div_name),
          curr_code: text(headerRaw.curr_code || current.curr_code),
          curr_name: text(headerRaw.curr_name || current.curr_name),
          ex_rate: Number(headerRaw.ex_rate || current.ex_rate || 1),
          year: text(headerRaw.year || current.year),
          description: text(headerRaw.description || current.description),
          remarks: text(headerRaw.remarks || current.remarks),
          canceled: text(headerRaw.canceled || current.canceled || "N"),
        }));
        setRows(detailRows.length ? detailRows : [emptyAllocationRow(text(headerRaw.year) || defaultBudgetYear())]);
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
  }, [editMode]);

  const disabled = form.canceled === "Y" || saving || loading;
  const isCancelled = form.canceled === "Y";

  const totalRequested = rows.reduce((sum, row) => sum + (Number(row.requested_amount) || 0), 0);
  const totalApproved = rows.reduce((sum, row) => sum + (Number(row.approved_amount) || 0), 0);

  const updateField = (field: keyof BudgetRequestForm, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  // Changing the header Year auto-fills every allocation row's Year with the newly selected year.
  const updateYear = (value: string) => {
    setForm((current) => ({ ...current, year: value }));
    setRows((current) => current.map((row) => ({ ...row, year: value })));
  };

  const updateRow = (id: string, patch: Partial<BudgetAllocationRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((current) => [...current, emptyAllocationRow(form.year)]);
  const removeRow = (id: string) => setRows((current) => current.filter((row) => row.id !== id));

  const runAction = async (action: () => Promise<void> | void, successMessage?: string) => {
    setSaving(true);
    setError("");
    try {
      await action();
      if (successMessage) await onSaved(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsDraft = () => runAction(() => saveBudgetRequestDraft(form, rows), "Budget request saved as draft");
  const handleSubmit = () => {
    if (!form.div_code) return setError("Division is required");
    if (!form.curr_code) return setError("Currency is required");
    if (!form.year) return setError("Year is required");
    return runAction(() => submitBudgetRequest(form, rows), editMode ? "Budget request updated successfully" : "Budget request created successfully");
  };
  const handleReject = () => runAction(() => rejectBudgetRequest(form.budget_no), "Budget request rejected");
  const handleSendBack = () => runAction(() => sendBackBudgetRequest(form.budget_no), "Budget request sent back");

  return (
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
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Budget No</span>
              <strong className="block text-sm leading-tight text-primary-foreground">{form.budget_no || "New"}</strong>
            </div>
            <div className="commercial-summary-chip rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Year</span>
              <strong className="block text-sm leading-tight text-primary-foreground">{form.year || "—"}</strong>
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
            {form.budget_no && (
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
            <strong>{form.budget_no || "Budget Request"}</strong>
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
              {editMode && <Field label="Budget No"><Input disabled value={form.budget_no || ""} /></Field>}

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
                disabled={disabled}
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
                  disabled={disabled}
                  onChange={(value, row) => setForm((current) => ({
                    ...current,
                    curr_code: value,
                    curr_name: text(getLookupValue(row || {}, "curr_name")),
                    ex_rate: Number(getLookupValue(row || {}, "ex_rate") || (row as Record<string, unknown>)?.ex_rate || current.ex_rate || 1),
                  }))}
                />
              

              <Field label="Year *">
                <Select className="max-w-[120px]" disabled={disabled} required value={form.year} onChange={(event) => updateYear(event.target.value)}>
                  {BUDGET_YEARS.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </Field>

              <label className="field col-span-1 max-md:col-span-1">
                <span>Description</span>
                <Input disabled={disabled} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
              </label>

              <label className="field col-span-2 max-md:col-span-1">
                <span>Remarks</span>
                <Input disabled={disabled} value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
              </label>
            </div>
          </div>

          <div className="commercial-lines-card rounded-md border bg-card">
            <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
              <div>
                <p className="eyebrow m-0">Allocation</p>
                <h3 className="m-0 text-sm font-semibold leading-tight">Budget Allocation Lines</h3>
              </div>
              <Button disabled={disabled} size="sm" type="button" variant="outline" onClick={addRow}>
                <Plus size={14} /> Add Line
              </Button>
            </div>
            <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
              <table className="finance-lines-table w-full min-w-[1200px] text-sm">
                <thead className="sticky top-0 bg-primary text-xs text-primary-foreground">
                  <tr>
                    <th className="finance-sticky-col finance-col-no px-2 py-2 text-left">No</th>
                    <th className="px-2 py-2 text-left">Cost Code</th>
                    <th className="px-2 py-2 text-left">Month</th>
                    <th className="px-2 py-2 text-left">Year</th>
                    <th className="finance-amount-cell px-2 py-2 text-left">Requested Amount</th>
                    <th className="finance-amount-cell px-2 py-2 text-left">Approved Amount</th>
                    <th className="px-2 py-2 text-left">Action</th>
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
                            parameter: "Account_COST",
                            code1: user?.company_code,
                            loginid: user?.loginid || user?.username || "ADMIN",
                          })}
                          disabled={disabled}
                          onChange={(value, selectedRow) => updateRow(row.id, {
                            cost_code: value,
                            cost_name: text(getLookupValue(selectedRow || {}, "cost_name")),
                          })}
                        />
                      </td>
                      <td className="w-36 px-2 py-1">
                        <Select disabled={disabled} value={row.month} onChange={(event) => updateRow(row.id, { month: event.target.value })}>
                          <option value="">Select</option>
                          {MONTHS.map((month) => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="w-28 px-2 py-1">
                        {/* Auto-filled from the header Year; still editable per-line if a row genuinely needs a different year. */}
                        <Select disabled={disabled} value={row.year} onChange={(event) => updateRow(row.id, { year: event.target.value })}>
                          {BUDGET_YEARS.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="finance-amount-cell w-40 px-2 py-1">
                        <Input
                          className="finance-money-input"
                          disabled={disabled}
                          type="number"
                          style={{ textAlign: "right" }}
                          step="0.001"
                          value={row.requested_amount}
                          onChange={(event) => updateRow(row.id, { requested_amount: Number(event.target.value || 0) })}
                        />
                      </td>
                      <td className="finance-amount-cell w-40 px-2 py-1">
                        <Input
                          className="finance-money-input"
                          disabled={disabled}
                          type="number"
                          style={{ textAlign: "right" }}
                          step="0.001"
                          value={row.approved_amount}
                          onChange={(event) => updateRow(row.id, { approved_amount: Number(event.target.value || 0) })}
                        />
                      </td>
                      <td className="px-2 py-1"><Button disabled={disabled} size="icon" type="button" variant="ghost" onClick={() => removeRow(row.id)}><X size={14} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">Total Requested</span>
              <strong className="text-emerald-600">{formatAmount(totalRequested)}</strong>
            </div>
            <div className="flex items-center justify-end gap-8 px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">Total Approved</span>
              <strong className="text-emerald-600">{formatAmount(totalApproved)}</strong>
            </div>
          </div>
        </div>
        )}
      </CardContent>

      <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => void handleSaveAsDraft()}>
            <Save size={14} /> Save As Draft
          </Button>
          <Button type="submit" disabled={disabled}>
            <Send size={14} /> Submit
          </Button>
          <Button type="button" variant="destructive" disabled={disabled} onClick={() => void handleReject()}>
            <XCircle size={14} /> Reject
          </Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => void handleSendBack()}>
            <Undo2 size={14} /> Send Back
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button aria-label="Print" type="button" variant="outline" size="icon"><Printer size={15} /></Button>
          <Button aria-label="Upload" type="button" variant="outline" size="icon"><Upload size={15} /></Button>
          <Button aria-label="Attachment" type="button" variant="outline" size="icon"><Paperclip size={15} /></Button>
          <Button aria-label="Download" type="button" variant="outline" size="icon"><Download size={15} /></Button>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </form>
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