import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckSquare, FileText, Info, Paperclip, Plus, RefreshCw, Save, Search, Trash2, WalletCards } from "lucide-react";
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

export function FreightJobFollowupTab({ target, kind, initialJob = null }: { target?: FreightWorkspaceTarget; kind: FollowupKind; initialJob?: LookupRow | null }) {
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
  const mode = modeMap[target?.mode || "air"];
  const jobType = directionMap[target?.direction || "import"];
  const stats = useMemo(() => getStats(kind, rows), [kind, rows]);

  useEffect(() => {
    if (!notice) return;
    if (notice.type === "success") toast.success(notice.text);
    else toast.error(notice.text);
    setNotice(null);
  }, [notice, toast]);

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
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || `Unable to load ${cfg.title}.` });
    } finally {
      setLoading(false);
    }
  }, [cfg.endpoint, cfg.title, companyCode, job]);

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
    setSaving(true);
    try {
      await api.post(`/api/freight/${cfg.endpoint}/init`, { ...jobPayload(companyCode, job), user_id: userId, op_type: jobType === "EXP" ? "EXP" : "IMP", op_mode: mode });
      await loadRows(job);
      setNotice({ type: "success", text: `${cfg.title} initialized from freight masters.` });
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || `Unable to initialize ${cfg.title}.` });
    } finally {
      setSaving(false);
    }
  }

  async function saveRows() {
    if (!job) return;
    setSaving(true);
    try {
      const bodyKey = kind === "documents" ? "docs" : "lines";
      await api.post(`/api/freight/${cfg.endpoint}/save`, { ...jobPayload(companyCode, job), user_id: userId, [bodyKey]: rows });
      setNotice({ type: "success", text: `${cfg.title} saved.` });
      await loadRows(job);
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || `Unable to save ${cfg.title}.` });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: LookupRow) {
    if (!job) return;
    const key = kind === "documents" ? { doc_nr: text(row, "doc_nr") } : kind === "deposits" ? { sr_no: text(row, "sr_no") } : { op_code: text(row, "op_code") };
    setSaving(true);
    try {
      await api.post(`/api/freight/${cfg.endpoint}/delete`, { ...jobPayload(companyCode, job), ...key });
      await loadRows(job);
      setNotice({ type: "success", text: "Line deleted." });
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to delete line." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-2">
      <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon size={18} /></span>
            <div><p className="eyebrow mb-0.5">Job Follow-up</p><h2 className="m-0 text-lg font-semibold">{cfg.title}</h2><p className="m-0 text-xs text-muted-foreground">Select a freight job and maintain operational follow-up rows.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {notice && <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>}
            <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={!job || loading}><RefreshCw size={14} />Refresh</Button>
            {kind !== "deposits" && <Button type="button" size="sm" variant="outline" onClick={() => void initRows()} disabled={!job || saving}><Search size={14} />Init</Button>}
            <Button type="button" size="sm" onClick={() => void saveRows()} disabled={!job || saving}><Save size={14} />Save</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(360px,520px)_1fr_1fr]">
        <div className="rounded-md border bg-card p-2 shadow-sm">
          {initialJob ? (
            <Metric label="Selected Freight Job" value={`${text(job || undefined, "job_no") || "-"} / ${text(job || undefined, "prin_name") || text(job || undefined, "prin_code") || "-"}`} />
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

      {kind === "documents" && <DocumentsGrid rows={rows} setRows={setRows} deleteRow={deleteRow} onAttach={setDocAttachmentRow} />}
      {kind === "instructions" && <InstructionGrid rows={rows} setRows={setRows} deleteRow={deleteRow} />}
      {kind === "alerts" && <AlertGrid rows={rows} setRows={setRows} deleteRow={deleteRow} />}
      {kind === "deposits" && <DepositGrid rows={rows} setRows={setRows} deleteRow={deleteRow} />}

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
        readOnly={!job || !docAttachmentRow}
      />
    </section>
  );
}

function DocumentsGrid({ rows, setRows, deleteRow, onAttach }: GridProps & { onAttach: (row: LookupRow) => void }) {
  return <EditableGrid columns={["doc_nr", "doc_desc", "mandatory", "collected", "doc_received_dt", "doc_received_by", "document_type", "remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} onAttach={onAttach} />;
}

function InstructionGrid({ rows, setRows, deleteRow }: GridProps) {
  return <EditableGrid columns={["op_code", "op_desc", "op_assigned", "op_date", "op_remarks", "end_date", "end_remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} addFactory={() => ({ OP_CODE: "", OP_DESC: "", OP_ASSIGNED: "", OP_DATE: "", OP_REMARKS: "", END_DATE: "", END_REMARKS: "" })} />;
}

function AlertGrid({ rows, setRows, deleteRow }: GridProps) {
  return <EditableGrid columns={["op_desc", "op_date", "op_yesno", "op_count", "remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} />;
}

function DepositGrid({ rows, setRows, deleteRow }: GridProps) {
  return <EditableGrid columns={["sr_no", "deposit_type", "amount", "currency", "deposit_date", "deposit_expiry_date", "status", "be_no", "claim_ref_no", "deposit_remarks"]} rows={rows} setRows={setRows} deleteRow={deleteRow} addFactory={() => ({ SR_NO: String(rows.length + 1), TXN_TYPE: "JOB", DEPOSIT_TYPE: "CNTRLNR", AMOUNT: "0", CURRENCY: "OMR", STATUS: "D" })} />;
}

type GridProps = { rows: LookupRow[]; setRows: (updater: (rows: LookupRow[]) => LookupRow[]) => void; deleteRow: (row: LookupRow) => void; addFactory?: () => LookupRow };

function EditableGrid({ columns, rows, setRows, deleteRow, addFactory, onAttach }: GridProps & { columns: string[]; onAttach?: (row: LookupRow) => void }) {
  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1.5">
        <div className="text-xs font-semibold text-foreground">{rows.length} lines</div>
        {addFactory && <Button type="button" size="sm" variant="outline" onClick={() => setRows((current) => [...current, normalizeLookupRow(addFactory())])}><Plus size={14} />Line</Button>}
      </div>
      <div className="max-h-[calc(100vh-330px)] overflow-auto">
        <div className={`grid min-w-[1100px] gap-1 border-b bg-muted/25 px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr)) ${onAttach ? "44px " : ""}44px` }}>
          {columns.map((column) => <span key={column}>{label(column)}</span>)}{onAttach && <span>Files</span>}<span />
        </div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid min-w-[1100px] gap-1 border-b px-2 py-1" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr)) ${onAttach ? "44px " : ""}44px` }}>
            {columns.map((column) => <Cell key={column} row={row} column={column} onChange={(value) => setRows((current) => current.map((item, index) => index === rowIndex ? { ...item, [column.toUpperCase()]: value } : item))} />)}
            {onAttach && <Button type="button" size="icon" variant="ghost" title="Document attachments" onClick={() => onAttach(row)}><Paperclip size={14} /></Button>}
            <Button type="button" size="icon" variant="ghost" title="Delete" onClick={() => deleteRow(row)}><Trash2 size={14} /></Button>
          </div>
        ))}
        {!rows.length && <div className="px-3 py-8 text-center text-sm text-muted-foreground">No rows yet. Select job and initialize or add a line.</div>}
      </div>
    </div>
  );
}

function Cell({ row, column, onChange }: { row: LookupRow; column: string; onChange: (value: string) => void }) {
  const value = text(row, column);
  if (column.includes("date")) return <Input className="h-7 text-xs" type="date" value={dateValue(value)} onChange={(event) => onChange(event.target.value)} />;
  if (column === "op_desc") return <Input className="h-7 bg-muted/35 text-xs font-semibold" value={value} readOnly />;
  if (["mandatory", "collected"].includes(column)) return <select className="h-7 rounded-md border bg-background px-1 text-xs" value={value || "N"} onChange={(event) => onChange(event.target.value)}><option value="Y">Y</option><option value="N">N</option></select>;
  if (column === "op_yesno") return <select className="h-7 rounded-md border bg-background px-1 text-xs" value={value || ""} onChange={(event) => onChange(event.target.value)}><option value="">Blank</option><option value="Yes">Yes</option><option value="No">No</option></select>;
  return <Input className="h-7 text-xs" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border bg-card px-3 py-2 shadow-sm"><div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div><div className="truncate text-lg font-semibold text-foreground">{value}</div></div>;
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
