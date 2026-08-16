import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calculator, CheckCircle2, Edit2, Plus, RefreshCw, Save, Trash2, TrendingUp } from "lucide-react";
import { api } from "../../api/client";
import { freightSelect } from "../../api/freight";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type ViewMode = "list" | "editor";
type ActivityScreen = "jobsheet" | "activities";
type Notice = { type: "success" | "error"; text: string } | null;

type ActivityLine = {
  srno: string;
  act_code: string;
  activity: string;
  other_services: string;
  quantity: string;
  bill_rate: string;
  bill: string;
  actual_cost: string;
  broker_code: string;
  partners_price: string;
  transporter_code: string;
  vehicle_no: string;
  transport_price: string;
  confirmed: string;
  print_flag: string;
  payment_mode: string;
  div_code: string;
  remarks: string;
  tx_cat_code: string;
  tx_compntcat_code_1: string;
  tx_compnt_perc_1: string;
  tx_compnt_amt_1: string;
  tx_compnt_lcuramt_1: string;
  tx_cat_code_cost: string;
  tx_compntcat_code_1_cost: string;
  tx_compnt_perc_1_cost: string;
  tx_compnt_amt_1_cost: string;
  tx_compnt_lcuramt_1_cost: string;
};

const modeMap = {
  air: { code: "A", label: "Air" },
  sea: { code: "S", label: "Sea" },
  land: { code: "R", label: "Road" },
};

const directionMap = {
  import: { code: "IMP", label: "Import" },
  export: { code: "EXP", label: "Export" },
  reexport: { code: "IRE", label: "Import for Re-export" },
};

export function FreightJobActivitiesPage({
  target,
  initialJob = null,
  startMode = "list",
  screen = "activities",
  readOnly = false,
  onEmbeddedActionsChange,
  onEmbeddedList,
}: {
  target?: FreightWorkspaceTarget;
  initialJob?: LookupRow | null;
  startMode?: ViewMode;
  screen?: ActivityScreen;
  readOnly?: boolean;
  onEmbeddedActionsChange?: (actions: ReactNode | null) => void;
  onEmbeddedList?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");
  const modeKey = (target?.mode || "air") as keyof typeof modeMap;
  const directionKey = (target?.direction || "import") as keyof typeof directionMap;
  const mode = modeMap[modeKey];
  const direction = directionMap[directionKey];
  const copy = screen === "jobsheet"
    ? { eyebrow: "Freight Job Sheet", title: "JOB Sheet", subtitle: "Revenue, cost, profit and billing activity lines" }
    : { eyebrow: "Freight Service", title: "Service & Activities", subtitle: "Operational services, vendor cost and customer billing lines" };

  const [view, setView] = useState<ViewMode>(startMode);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [header, setHeader] = useState<LookupRow | null>(null);
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

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

  const totals = useMemo(() => calculateTotals(lines), [lines]);
  const isConfirmed = Boolean(lookupText(header, "confirm_date"));
  const isClosed = readOnly || Boolean(
    isTruthy(lookupText(header, "canceled")) ||
    isTruthy(lookupText(header, "invoiced")) ||
    isTruthy(lookupText(header, "completed")) ||
    lookupText(header, "invoice_date") ||
    lookupText(header, "complete_date")
  );
  const isLineLocked = isConfirmed || isClosed;
  const embeddedInWorkspace = Boolean(onEmbeddedActionsChange);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/job-activities/jobs", {
        company_code: companyCode,
        transport_mode: mode.code,
        job_type: direction.code,
        search: query,
      });
      setRows((response.data.data || []).map(normalizeLookupRow).filter((row) => matchesCurrentJobBucket(row, mode.code, direction.code)));
    } catch (error: any) {
      setRows([]);
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load freight jobs." });
    } finally {
      setLoading(false);
    }
  }, [companyCode, direction.code, mode.code, notify, query]);

  useEffect(() => {
    if (view === "list") void loadRows();
  }, [loadRows, view]);

  useEffect(() => {
    setView(startMode);
  }, [startMode]);

  useEffect(() => {
    if (!initialJob) return;
    void openJob(initialJob);
  }, [initialJob]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "job_no", header: "Job No", size: 120, cell: ({ row }) => <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openJob(row.original)}>{lookupText(row.original, "job_no")}</button> },
    { accessorKey: "job_date", header: "Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "job_date")) },
    { accessorKey: "transport_mode", header: "Mode", size: 70 },
    { accessorKey: "job_type", header: "Type", size: 80 },
    { accessorKey: "prin_code", header: "Principal", size: 90 },
    { accessorKey: "prin_name", header: "Principal Name", size: 220 },
    { accessorKey: "activity_count", header: "Lines", size: 70 },
    { accessorKey: "revenue", header: "Revenue", size: 110, cell: ({ row }) => money(lookupText(row.original, "revenue")) },
    { accessorKey: "expense", header: "Expense", size: 110, cell: ({ row }) => money(lookupText(row.original, "expense")) },
    { accessorKey: "profit", header: "Profit", size: 110, cell: ({ row }) => <span className={numberValue(lookupText(row.original, "profit")) < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{money(lookupText(row.original, "profit"))}</span> },
    { accessorKey: "confirm_date", header: "Confirm", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "confirm_date")) || "-" },
    { id: "actions", header: "Actions", size: 70, cell: ({ row }) => <Button type="button" size="icon" variant="ghost" title="Open activities" onClick={() => openJob(row.original)}><Edit2 size={14} /></Button> },
  ], []);

  async function openJob(row: LookupRow) {
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow; lines?: LookupRow[] } }>("/api/freight/job-activities/get", {
        company_code: companyCode,
        prin_code: lookupText(row, "prin_code"),
        job_no: lookupText(row, "job_no"),
      });
      setHeader(normalizeLookupRow(response.data.data?.header || row));
      setLines((response.data.data?.lines || []).map(toLine));
      setView("editor");
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to open job activities." });
    } finally {
      setLoading(false);
    }
  }

  async function saveLines() {
    if (!header) return;
    if (isLineLocked) {
      notify({ type: "error", text: "Confirmed, invoiced, or completed job is locked. Activities are view only." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/job-activities/save", {
        company_code: companyCode,
        prin_code: lookupText(header, "prin_code"),
        job_no: lookupText(header, "job_no"),
        user_id: userId,
        lines,
      });
      notify({ type: "success", text: "Job activities saved." });
      await loadRows();
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save job activities." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmJob() {
    if (!header) return;
    if (isClosed) {
      notify({ type: "error", text: "Invoiced or completed job is locked. Activities are view only." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/job-activities/confirm", {
        company_code: companyCode,
        prin_code: lookupText(header, "prin_code"),
        job_no: lookupText(header, "job_no"),
        user_id: userId,
      });
      notify({ type: "success", text: "Job activities confirmed." });
      await openJob(header);
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to confirm job activities." });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!onEmbeddedActionsChange) return;
    if (view !== "editor") {
      onEmbeddedActionsChange(null);
      return () => onEmbeddedActionsChange(null);
    }
    onEmbeddedActionsChange(
      <div className="freight-job-inline-actions freight-job-inline-actions-header freight-job-commandbar">
        {notice && <NoticeChip notice={notice} />}
        <Button type="button" size="sm" variant="outline" onClick={onEmbeddedList || (() => setView("list"))}>
          <ArrowLeft size={14} />List
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={isLineLocked}>
          <Plus size={14} />Line
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void confirmJob()} disabled={saving || isClosed || !lines.length || Boolean(lookupText(header, "confirm_date"))}>
          <CheckCircle2 size={14} />{lookupText(header, "confirm_date") ? "Confirmed" : "Confirm"}
        </Button>
        <Button type="button" size="sm" onClick={() => void saveLines()} disabled={saving || isLineLocked}>
          <Save size={14} />Save
        </Button>
        <span className="freight-job-mode-badge viewing">View</span>
      </div>
    );
    return () => onEmbeddedActionsChange(null);
  }, [header, isClosed, isLineLocked, lines.length, notice, onEmbeddedActionsChange, onEmbeddedList, saving, view]);

  if (view === "list") {
    return (
      <section className="grid gap-3">
        <Header eyebrow={copy.eyebrow} title={`${mode.label} ${direction.label} ${copy.title}`} subtitle={copy.subtitle}>
          {notice && <NoticeChip notice={notice} />}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}><RefreshCw size={14} />Refresh</Button>
        </Header>
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search job, principal..."
          title={`${rows.length} Jobs`}
          subtitle={`${mode.label} / ${direction.label}`}
          height="calc(100vh - 240px)"
          minWidth={1100}
          density="grid"
          enablePagination
          pageSize={50}
          enableExport
          exportFilename={`freight-${mode.code}-${direction.code}-job-activities.csv`}
          onRowClick={openJob}
        />
      </section>
    );
  }

  return (
    <section className="grid gap-2 freight-job-ops-screen">
      {!embeddedInWorkspace && <Header eyebrow={copy.eyebrow} title={copy.title} subtitle={`${lookupText(header, "job_no")} / ${lookupText(header, "prin_name") || lookupText(header, "prin_code")}`}>
        {notice && <NoticeChip notice={notice} />}
        {!initialJob && <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} />List</Button>}
        <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={isLineLocked}><Plus size={14} />Line</Button>
        {/* <Button type="button" size="sm" variant="outline" onClick={() => void confirmJob()} disabled={saving || !lines.length}><CheckCircle2 size={14} />Confirm</Button> */}
       <Button type="button" size="sm" variant="outline" onClick={() => void confirmJob()} disabled={saving || isClosed || !lines.length || Boolean(lookupText(header, "confirm_date"))}>
           <CheckCircle2 size={14} />{lookupText(header, "confirm_date") ? "Confirmed" : "Confirm"}
        </Button>
        <Button type="button" size="sm" onClick={() => void saveLines()} disabled={saving || isLineLocked}><Save size={14} />Save</Button>
      </Header>}

      <div className="grid gap-2 lg:grid-cols-4">
        <Metric label="Revenue" value={money(totals.revenue)} />
        <Metric label="Expense" value={money(totals.expense)} />
        <Metric label="Profit" value={money(totals.profit)} tone={totals.profit < 0 ? "bad" : "good"} />
        <Metric label="Lines" value={String(lines.length)} />
      </div>

      <div className="freight-job-table-shell">
        <div className="freight-job-table-head grid grid-cols-[42px_90px_minmax(190px,1fr)_76px_94px_105px_105px_90px_105px_90px_105px_50px] items-center gap-1 px-2 py-1">
          <span>No</span><span>Activity</span><span>Description</span><span>Qty</span><span>Rate</span><span>Revenue</span><span>Other Cost</span><span>Agent</span><span>Agent Cost</span><span>Transp.</span><span>Transp. Cost</span><span />
        </div>
        <div className="max-h-[calc(100vh-330px)] overflow-auto">
          {lines.map((line, index) => (
            <div key={`${line.srno}-${index}`} className="freight-job-table-row">
              <div className="grid grid-cols-[42px_90px_minmax(190px,1fr)_76px_94px_105px_105px_90px_105px_90px_105px_50px] items-center gap-1 px-2 py-1">
                <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                <ActivityLookup value={line.act_code} companyCode={companyCode} disabled={isLineLocked} onChange={(value, row) => updateLine(index, { act_code: value, activity: lookupText(row || undefined, "activity"), other_services: lookupText(row || undefined, "activity") || line.other_services, bill_rate: lookupText(row || undefined, "bill") || line.bill_rate, actual_cost: lookupText(row || undefined, "cost") || line.actual_cost })} />
                <Input className="h-7 text-xs" value={line.other_services} disabled={isLineLocked} onChange={(event) => updateLine(index, { other_services: event.target.value })} />
                <MoneyInput value={line.quantity} disabled={isLineLocked}onChange={(value) => updateLine(index, recalc({ ...line, quantity: value }))} />
                <MoneyInput value={line.bill_rate} disabled={isLineLocked} onChange={(value) => updateLine(index, recalc({ ...line, bill_rate: value }))} />
                <MoneyInput value={line.bill} disabled={isLineLocked} onChange={(value) => updateLine(index, { bill: value })} />
                <MoneyInput value={line.actual_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, { actual_cost: value })} />
                <Input className="h-7 text-xs" value={line.broker_code} disabled={isLineLocked} onChange={(event) => updateLine(index, { broker_code: event.target.value })} />
                <MoneyInput value={line.partners_price} disabled={isLineLocked} onChange={(value) => updateLine(index, { partners_price: value })} />
                <Input className="h-7 text-xs" value={line.transporter_code} disabled={isLineLocked} onChange={(event) => updateLine(index, { transporter_code: event.target.value })} />
                <MoneyInput value={line.transport_price} disabled={isLineLocked} onChange={(value) => updateLine(index, { transport_price: value })} />
                <Button type="button" size="icon" variant="ghost" title="Remove line" disabled={isLineLocked} onClick={() => removeLine(index)}><Trash2 size={14} /></Button>
              </div>
              <div className="freight-job-table-subrow grid grid-cols-[42px_repeat(10,minmax(88px,1fr))] gap-1 px-2 pb-1">
                <span className="self-center text-[10px] font-semibold uppercase text-muted-foreground">Tax</span>
                <TaxCategoryLookup companyCode={companyCode} value={line.tx_cat_code} disabled={isLineLocked} placeholder="Sale Cat" onChange={(value) => updateLine(index, { tx_cat_code: value })} />
                <TaxCodeLookup companyCode={companyCode} value={line.tx_compntcat_code_1} disabled={isLineLocked} placeholder="Sale Code" onChange={(value, row) => updateLine(index, { tx_compntcat_code_1: value, tx_cat_code: lookupText(row, "tx_cat_code") || line.tx_cat_code, tx_compnt_perc_1: lookupText(row, "tx_percnt") || line.tx_compnt_perc_1 })} />
                <MoneyInput value={line.tx_compnt_perc_1} disabled={isLineLocked} onChange={(value) => updateLine(index, { tx_compnt_perc_1: value })} />
                <MoneyInput value={line.tx_compnt_amt_1} disabled={isLineLocked} onChange={(value) => updateLine(index, { tx_compnt_amt_1: value })} />
                <MoneyInput value={line.tx_compnt_lcuramt_1} disabled={isLineLocked} onChange={(value) => updateLine(index, { tx_compnt_lcuramt_1: value })} />
                <TaxCategoryLookup companyCode={companyCode} value={line.tx_cat_code_cost} disabled={isLineLocked} placeholder="Cost Cat" onChange={(value) => updateLine(index, { tx_cat_code_cost: value })} />
                <TaxCodeLookup companyCode={companyCode} value={line.tx_compntcat_code_1_cost} disabled={isLineLocked} placeholder="Cost Code" onChange={(value, row) => updateLine(index, { tx_compntcat_code_1_cost: value, tx_cat_code_cost: lookupText(row, "tx_cat_code") || line.tx_cat_code_cost, tx_compnt_perc_1_cost: lookupText(row, "tx_percnt") || line.tx_compnt_perc_1_cost })} />
                <MoneyInput value={line.tx_compnt_perc_1_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, { tx_compnt_perc_1_cost: value })} />
                <MoneyInput value={line.tx_compnt_amt_1_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, { tx_compnt_amt_1_cost: value })} />
                <MoneyInput value={line.tx_compnt_lcuramt_1_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, { tx_compnt_lcuramt_1_cost: value })} />
              </div>
            </div>
          ))}
          {!lines.length && <div className="px-3 py-8 text-center text-sm text-muted-foreground">No activity lines yet.</div>}
        </div>
      </div>
    </section>
  );

  function addLine() {
    if (isLineLocked) {
      notify({ type: "error", text: "Confirmed, invoiced, or completed job is locked. Activities are view only." });
      return;
    }
    setLines((current) => [...current, emptyLine(current.length + 1)]);
  }

  function removeLine(index: number) {
    if (isLineLocked) return;
    setLines((current) => current.filter((_, rowIndex) => rowIndex !== index).map((line, rowIndex) => ({ ...line, srno: String(rowIndex + 1) })));
  }

  function updateLine(index: number, patch: Partial<ActivityLine>) {
    if (isLineLocked) return;
    setLines((current) => current.map((line, rowIndex) => rowIndex === index ? { ...line, ...patch, srno: String(index + 1) } : line));
  }
}

function isTruthy(value: string) {
  return ["Y", "YES", "TRUE", "1"].includes(value.trim().toUpperCase());
}

function Header({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="freight-form-header">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Calculator size={18} /></span>
        <div><p className="eyebrow mb-0.5">{eyebrow}</p><h1 className="m-0 text-lg font-semibold text-foreground">{title}</h1><p className="m-0 text-xs text-muted-foreground">{subtitle}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  const toneClass = tone === "good" ? " good" : tone === "bad" ? " bad" : "";
  return <div className={`freight-job-metric-card${toneClass}`}><div><TrendingUp size={12} />{label}</div><strong>{value}</strong></div>;
}

function ActivityLookup({ companyCode, value, onChange, disabled }: { companyCode: string; value: string; onChange: (value: string, row: LookupRow | null) => void; disabled?: boolean }) {
  return (
    <LookupField
      value={value}
      compact
      valueField="ACT_CODE"
      displayFields={["ACT_CODE", "ACTIVITY"]}
      columns={[{ field: "ACT_CODE", header: "Code" }, { field: "ACTIVITY", header: "Activity" }, { field: "BILL", header: "Bill" }, { field: "COST", header: "Cost" }]}
      loadOptions={(query) => loadFreightLookup("freight_activity", companyCode, query)}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function TaxCategoryLookup({ companyCode, value, onChange, disabled, placeholder }: { companyCode: string; value: string; onChange: (value: string, row: LookupRow | null) => void; disabled?: boolean; placeholder: string }) {
  return (
    <LookupField
      value={value}
      compact
      placeholder={placeholder}
      valueField="TX_CAT_CODE"
      displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
      columns={[{ field: "TX_CAT_CODE", header: "Code" }, { field: "TX_CAT_NAME", header: "Tax Category" }]}
      loadOptions={(query) => loadFreightLookup("freight_tax_category", companyCode, query)}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function TaxCodeLookup({ companyCode, value, onChange, disabled, placeholder }: { companyCode: string; value: string; onChange: (value: string, row: LookupRow | null) => void; disabled?: boolean; placeholder: string }) {
  return (
    <LookupField
      value={value}
      compact
      placeholder={placeholder}
      valueField="TX_COMPNTCAT_CODE"
      displayFields={["TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME"]}
      columns={[{ field: "TX_COMPNTCAT_CODE", header: "Code" }, { field: "TX_COMPNTCAT_NAME", header: "Tax Code" }, { field: "TX_CAT_CODE", header: "Tax Category" }, { field: "TX_PERCNT", header: "Tax %" }]}
      loadOptions={(query) => loadFreightLookup("freight_tax_code", companyCode, query)}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function MoneyInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <Input className="h-7 text-right text-xs tabular-nums" type="text" inputMode="decimal" value={value} disabled={disabled} onChange={(event) => onChange(normalizeMoneyInput(event.target.value))} />;
}

function NoticeChip({ notice }: { notice: Exclude<Notice, null> }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>;
}

function emptyLine(srno: number): ActivityLine {
  return { srno: String(srno), act_code: "", activity: "", other_services: "", quantity: "1", bill_rate: "0", bill: "0", actual_cost: "0", broker_code: "", partners_price: "0", transporter_code: "", vehicle_no: "", transport_price: "0", confirmed: "Y", print_flag: "Y", payment_mode: "", div_code: "", remarks: "", tx_cat_code: "", tx_compntcat_code_1: "", tx_compnt_perc_1: "", tx_compnt_amt_1: "", tx_compnt_lcuramt_1: "", tx_cat_code_cost: "", tx_compntcat_code_1_cost: "", tx_compnt_perc_1_cost: "", tx_compnt_amt_1_cost: "", tx_compnt_lcuramt_1_cost: "" };
}

function toLine(row: LookupRow, index: number): ActivityLine {
  const base = emptyLine(index + 1);
  return Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as ActivityLine;
}

function recalc(line: ActivityLine) {
  return { ...line, bill: String(numberValue(line.quantity) * numberValue(line.bill_rate)) };
}

function calculateTotals(lines: ActivityLine[]) {
  return lines.reduce((sum, line) => {
    const revenue = numberValue(line.bill);
    const expense = numberValue(line.actual_cost) + numberValue(line.partners_price) + numberValue(line.transport_price);
    return { revenue: sum.revenue + revenue, expense: sum.expense + expense, profit: sum.profit + revenue - expense };
  }, { revenue: 0, expense: 0, profit: 0 });
}

async function loadFreightLookup(parameter: string, companyCode: string, query = "") {
  return (await freightSelect<LookupRow>({ parameter, code1: companyCode, code2: query || "NULL", number1: 50 })).map(normalizeLookupRow);
}

function normalizeLookupRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function matchesCurrentJobBucket(row: LookupRow, mode: string, jobType: string) {
  const rowMode = lookupText(row, "transport_mode");
  const rowJobType = lookupText(row, "job_type");
  if (rowMode && rowMode !== mode) return false;
  if (rowJobType && jobType === "IRE") return rowJobType === "IRE" || (rowJobType === "IMP" && lookupText(row, "reexport") === "Y");
  if (rowJobType && rowJobType !== jobType) return false;
  return true;
}

function lookupText(row: LookupRow | null | undefined, key: string) {
  if (!row) return "";
  const value = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberValue(input: unknown) {
  const number = Number(input || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeMoneyInput(value: string) {
  const withoutCommas = value.replace(/,/g, "");
  const numericOnly = withoutCommas.replace(/[^\d.-]/g, "");
  const sign = numericOnly.startsWith("-") ? "-" : "";
  const unsigned = numericOnly.replace(/-/g, "");
  const [whole = "", ...decimal] = unsigned.split(".");
  return `${sign}${whole}${decimal.length ? `.${decimal.join("")}` : ""}`;
}

function money(input: unknown) {
  return numberValue(input).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

