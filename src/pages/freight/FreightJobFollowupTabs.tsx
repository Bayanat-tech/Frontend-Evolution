import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, CheckSquare, FileText, Info, Paperclip, Plus, RefreshCw, Save, Search, Trash2, WalletCards } from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";
import { FreightAttachmentDialog } from "./FreightAttachmentDialog";

type FollowupKind = "documents" | "instructions" | "alerts" | "deposits";
type Notice = { type: "success" | "error"; text: string } | null;

const meta = {
  documents: { title: "Documents", icon: FileText, endpoint: "job-documents", summary: "mandatory collected" },
  instructions: { title: "Instructions", icon: Info, endpoint: "job-instructions", summary: "instructions closed" },
  alerts: { title: "Alerts", icon: Bell, endpoint: "job-alerts", summary: "alerts completed" },
  deposits: { title: "Deposits", icon: WalletCards, endpoint: "job-deposits", summary: "deposit value" },
};

const modeMap = { air: "A", sea: "S", land: "R" };
const directionMap = { import: "IMP", export: "EXP", reexport: "IRE" };

export function FreightJobFollowupTab({
  target,
  kind,
  initialJob = null,
  readOnly = false,
  onEmbeddedActionsChange,
  onEmbeddedList,
}: {
  target?: FreightWorkspaceTarget;
  kind: FollowupKind;
  initialJob?: LookupRow | null;
  readOnly?: boolean;
  onEmbeddedActionsChange?: (actions: ReactNode | null) => void;
  onEmbeddedList?: () => void;
}) {
  const cfg = meta[kind];
  const Icon = cfg.icon;
  const { toast } = useToast();
  const [job, setJob] = useState<LookupRow | null>(null);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [docAttachmentRow, setDocAttachmentRow] = useState<LookupRow | null>(null);
  const { user } = useAuth();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "Admin");
  const modeKey = (target?.mode || "air") as keyof typeof modeMap;
  const directionKey = (target?.direction || "import") as keyof typeof directionMap;
  const mode = modeMap[modeKey];
  const jobType = directionMap[directionKey];
  const stats = useMemo(() => getStats(kind, rows), [kind, rows]);
  const embeddedInWorkspace = Boolean(onEmbeddedActionsChange);

  const notify = useCallback((next: Exclude<Notice, null>) => {
    setNotice(next);
    if (next.type === "success") toast.success(next.text);
    else toast.error(next.text);
  }, [toast]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadRows = useCallback(async (selected = job) => {
    if (!selected) return;
    setLoading(true);
    setNotice(null);
    try {
      const payload = jobPayload(companyCode, selected);
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>(`/api/freight/${cfg.endpoint}/list`, payload);
      setRows((response.data.data || []).map(normalizeLookupRow));
    } catch (error: any) {
      setRows([]);
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || `Unable to load ${cfg.title}.` });
    } finally {
      setLoading(false);
    }
  }, [cfg.endpoint, cfg.title, companyCode, job, notify]);

  useEffect(() => {
    setJob(null);
    setRows([]);
  }, [jobType, mode]);

  useEffect(() => {
    if (!initialJob) return;
    const selected = normalizeLookupRow(initialJob);
    setJob(selected);
    void loadRows(selected);
  }, [initialJob]);

  async function initRows() {
    if (!job) return;
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Follow-up rows are view only." });
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/freight/${cfg.endpoint}/init`, { ...jobPayload(companyCode, job), user_id: userId, op_type: jobType === "EXP" ? "EXP" : "IMP", op_mode: mode });
      await loadRows(job);
      notify({ type: "success", text: `${cfg.title} initialized from freight masters.` });
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || `Unable to initialize ${cfg.title}.` });
    } finally {
      setSaving(false);
    }
  }

  async function saveRows() {
    if (!job) return;
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Follow-up rows are view only." });
      return;
    }
    setSaving(true);
    try {
      const bodyKey = kind === "documents" ? "docs" : "lines";
      await api.post(`/api/freight/${cfg.endpoint}/save`, { ...jobPayload(companyCode, job), user_id: userId, [bodyKey]: rows });
      notify({ type: "success", text: `${cfg.title} saved.` });
      await loadRows(job);
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || `Unable to save ${cfg.title}.` });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: LookupRow) {
    if (!job) return;
    if (readOnly) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Follow-up rows are view only." });
      return;
    }
    const key = kind === "documents" ? { doc_nr: text(row, "doc_nr") } : kind === "deposits" ? { sr_no: text(row, "sr_no") } : { op_code: text(row, "op_code") };
    setSaving(true);
    try {
      await api.post(`/api/freight/${cfg.endpoint}/delete`, { ...jobPayload(companyCode, job), ...key });
      await loadRows(job);
      notify({ type: "success", text: "Line deleted." });
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete line." });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!onEmbeddedActionsChange) return;
    onEmbeddedActionsChange(
      <div className="freight-job-inline-actions freight-job-inline-actions-header freight-job-commandbar">
        {notice && <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>}
        <Button type="button" size="sm" variant="outline" onClick={onEmbeddedList}>
          <ArrowLeft size={14} />List
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={!job || loading}>
          <RefreshCw size={14} />Refresh
        </Button>
        {kind !== "deposits" && (
          <Button type="button" size="sm" variant="outline" onClick={() => void initRows()} disabled={!job || saving || readOnly}>
            <Search size={14} />Init
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => void saveRows()} disabled={!job || saving || readOnly}>
          <Save size={14} />Save
        </Button>
        <span className="freight-job-mode-badge viewing">View</span>
      </div>
    );
    return () => onEmbeddedActionsChange(null);
  }, [job, kind, loading, notice, onEmbeddedActionsChange, onEmbeddedList, readOnly, saving, loadRows]);

  return (
    <section className="grid gap-2 freight-job-ops-screen">
      {!embeddedInWorkspace && <div className="freight-form-header">
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={18} /></span>
            <div><p className="eyebrow mb-0.5">Job Follow-up</p><h2 className="m-0 text-lg font-semibold">{cfg.title}</h2><p className="m-0 text-xs text-muted-foreground">Select a freight job and maintain operational follow-up rows.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {notice && <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>}
            <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={!job || loading}><RefreshCw size={14} />Refresh</Button>
            {kind !== "deposits" && <Button type="button" size="sm" variant="outline" onClick={() => void initRows()} disabled={!job || saving || readOnly}><Search size={14} />Init</Button>}
            <Button type="button" size="sm" onClick={() => void saveRows()} disabled={!job || saving || readOnly}><Save size={14} />Save</Button>
          </div>
        </div>
      </div>}

      <div className="grid gap-2 lg:grid-cols-[minmax(360px,520px)_1fr_1fr]">
        <div className="freight-job-metric-card freight-job-selector-card">
          {initialJob ? (
            <>
              <div>Selected Freight Job</div>
              <strong>{`${text(job || undefined, "job_no") || "-"} / ${text(job || undefined, "prin_name") || text(job || undefined, "prin_code") || "-"}`}</strong>
            </>
          ) : (
            <label className="grid gap-1 text-[10px] font-semibold uppercase text-muted-foreground">Freight Job
              <LookupField
                value={text(job || undefined, "job_no")}
                compact
                valueField="JOB_NO"
                displayFields={["JOB_NO", "PRIN_CODE", "PRIN_NAME"]}
                columns={[{ field: "JOB_NO", header: "Job" }, { field: "JOB_DATE", header: "Date" }, { field: "PRIN_CODE", header: "Principal" }, { field: "PRIN_NAME", header: "Name" }]}
                loadOptions={() => loadJobs(companyCode, mode, jobType)}
                onChange={(_, row) => {
                  const selected = normalizeLookupRow(row || {});
                  setJob(selected);
                  void loadRows(selected);
                }}
              />
            </label>
          )}
        </div>
        <Metric label="Job" value={text(job || undefined, "job_no") || "-"} />
        <Metric label={cfg.summary} value={stats} />
      </div>

      {kind === "documents" && <DocumentsGrid rows={rows} setRows={setRows} deleteRow={deleteRow} onAttach={setDocAttachmentRow} readOnly={readOnly} />}
      {kind === "instructions" && <InstructionGrid rows={rows} setRows={setRows} deleteRow={deleteRow} readOnly={readOnly} />}
      {kind === "alerts" && <AlertGrid rows={rows} setRows={setRows} deleteRow={deleteRow} readOnly={readOnly} />}
      {kind === "deposits" && <DepositGrid rows={rows} setRows={setRows} deleteRow={deleteRow} readOnly={readOnly} />}

      <FreightAttachmentDialog
        open={Boolean(docAttachmentRow)}
        onClose={() => setDocAttachmentRow(null)}
        title="Document Attachments"
        companyCode={companyCode}
        prinCode={text(job || undefined, "prin_code")}
        jobNo={text(job || undefined, "job_no")}
        docNr={text(docAttachmentRow || undefined, "doc_nr")}
        context="DOC"
        loginId={userId}
        readOnly={!job || !docAttachmentRow || readOnly}
      />
    </section>
  );
}

function DocumentsGrid({ rows, setRows, deleteRow, onAttach, readOnly }: GridProps & { onAttach: (row: LookupRow) => void }) {
  return <EditableGrid columns={["doc_nr", "doc_desc", "mandatory", "collected", "doc_received_dt", "doc_received_by", "document_type", "remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} onAttach={onAttach} readOnly={readOnly} />;
}

function InstructionGrid({ rows, setRows, deleteRow, readOnly }: GridProps) {
  return <EditableGrid columns={["op_code", "op_desc", "op_assigned", "op_date", "op_remarks", "end_date", "end_remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} addFactory={() => ({ OP_CODE: "", OP_DESC: "", OP_ASSIGNED: "", OP_DATE: "", OP_REMARKS: "", END_DATE: "", END_REMARKS: "" })} readOnly={readOnly}  labels={{ op_code: "Instruction Code", op_desc: "Instruction", op_assigned: " Instruction Assigned To", op_date: "Instruction Date", op_remarks: "Remarks" }} />;
}

function AlertGrid({ rows, setRows, deleteRow, readOnly }: GridProps) {
  return <EditableGrid columns={["op_desc", "op_date", "remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} readOnly={readOnly} labels={{ op_desc: "Alert Description", op_date: "Alert Date", remarks: "Remarks" }} />;
}

function DepositGrid({ rows, setRows, deleteRow, readOnly }: GridProps) {
  return <EditableGrid columns={["sr_no", "deposit_type", "amount", "currency", "deposit_date", "deposit_expiry_date", "status", "be_no", "claim_ref_no", "deposit_remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} addFactory={() => ({ SR_NO: String(rows.length + 1), TXN_TYPE: "JOB", DEPOSIT_TYPE: "CNTRLNR", AMOUNT: "0", CURRENCY: "OMR", STATUS: "D" })} readOnly={readOnly} />;
}

// type GridProps = { rows: LookupRow[]; setRows: (updater: (rows: LookupRow[]) => LookupRow[]) => void; deleteRow: (row: LookupRow) => void; addFactory?: () => LookupRow; readOnly?: boolean };
type GridProps = { rows: LookupRow[]; setRows: (updater: (rows: LookupRow[]) => LookupRow[]) => void; deleteRow: (row: LookupRow) => void; addFactory?: () => LookupRow; readOnly?: boolean; labels?: Record<string, string> };

function EditableGrid({ columns, rows, setRows, deleteRow, addFactory, onAttach, readOnly = false, labels }: GridProps & { columns: string[]; onAttach?: (row: LookupRow) => void }) {
  return (
    <div className="freight-job-table-shell">
      <div className="flex items-center justify-between border-b bg-[#f8fbff] px-2 py-1.5">
        <div className="text-xs font-semibold text-foreground">{rows.length} lines</div>
        {addFactory && !readOnly && <Button type="button" size="sm" variant="outline" onClick={() => setRows((current) => [...current, normalizeLookupRow(addFactory())])}><Plus size={14} />Line</Button>}
      </div>
      <div className="max-h-[calc(100vh-330px)] overflow-auto">
        <div className="freight-job-table-head grid min-w-[1100px] gap-1 px-2 py-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr)) ${onAttach ? "44px " : ""}44px` }}>
          {columns.map((column) => <span key={column}>{labels?.[column] ?? label(column)}</span>)}{onAttach && <span>Files</span>}<span />
          {/* {columns.map((column) => <span key={column}>{label(column)}</span>)}{onAttach && <span>Files</span>}<span /> */}
        </div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="freight-job-table-row grid min-w-[1100px] gap-1 px-2 py-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr)) ${onAttach ? "44px " : ""}44px` }}>
            {columns.map((column) => <Cell key={column} row={row} column={column} readOnly={readOnly} onChange={(value) => setRows((current) => current.map((item, index) => index === rowIndex ? { ...item, [column.toUpperCase()]: value } : item))} />)}
            {onAttach && <Button type="button" size="icon" variant="ghost" title="Document attachments" onClick={() => onAttach(row)}><Paperclip size={14} /></Button>}
            <Button type="button" size="icon" variant="ghost" title="Delete" disabled={readOnly} onClick={() => deleteRow(row)}><Trash2 size={14} /></Button>
          </div>
        ))}
        {!rows.length && <div className="px-3 py-8 text-center text-sm text-muted-foreground">No rows yet. Select job and initialize or add a line.</div>}
      </div>
    </div>
  );
}



function Cell({ row, column, onChange, readOnly = false }: { row: LookupRow; column: string; onChange: (value: string) => void; readOnly?: boolean }) {
  const value = text(row, column);
  const normalizedColumn = column.toLowerCase();
  const isDateField = normalizedColumn.includes("date") || normalizedColumn.endsWith("_dt") || normalizedColumn.includes("_dt");

  if (isDateField) return <Input className="h-7 text-xs" type="date" value={dateValue(value)} disabled={readOnly} onChange={(event) => onChange(event.target.value)} />;
  if (column === "op_desc") return <Input className="h-7 bg-muted/35 text-xs font-semibold" value={value} readOnly />;
  if (["mandatory", "collected"].includes(column)) return <select className="h-7 rounded-md border bg-background px-1 text-xs" value={value || "N"} disabled={readOnly} onChange={(event) => onChange(event.target.value)}><option value="Y">Y</option><option value="N">N</option></select>;
  if (column === "op_yesno") return <select className="h-7 rounded-md border bg-background px-1 text-xs" value={value || ""} disabled={readOnly} onChange={(event) => onChange(event.target.value)}><option value="">Blank</option><option value="Yes">Yes</option><option value="No">No</option></select>;
  return <Input className="h-7 text-xs" value={value} disabled={readOnly} onChange={(event) => onChange(event.target.value)} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="freight-job-metric-card"><div>{label}</div><strong>{value}</strong></div>;
}

async function loadJobs(companyCode: string, mode: string, jobType: string) {
  const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/job-activities/jobs", { company_code: companyCode, transport_mode: mode, job_type: jobType });
  return (response.data.data || []).map(normalizeLookupRow);
}

function getStats(kind: FollowupKind, rows: LookupRow[]) {
  if (kind === "documents") return `${rows.filter((row) => text(row, "mandatory") === "Y" && text(row, "collected") === "Y").length}/${rows.filter((row) => text(row, "mandatory") === "Y").length}`;
  if (kind === "deposits") return rows.reduce((sum, row) => sum + Number(text(row, "amount") || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (kind === "alerts") return `${rows.filter((row) => text(row, "op_yesno") === "Yes").length}/${rows.length}`;
  return `${rows.filter((row) => text(row, "end_date")).length}/${rows.length}`;
}

function jobPayload(companyCode: string, job: LookupRow) {
  return { company_code: companyCode, prin_code: text(job, "prin_code"), job_no: text(job, "job_no") };
}

function normalizeLookupRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function text(row: LookupRow | undefined, key: string) {
  if (!row) return "";
  const value = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function label(key: string) {
  return key.replace(/_/g, " ");
}

function dateValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}
