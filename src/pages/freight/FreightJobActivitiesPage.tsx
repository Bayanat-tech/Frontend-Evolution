import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calculator, CheckCircle2, Edit2, Plus, RefreshCw, Save, Trash2, TrendingUp } from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { executeWmsInboundSql } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type ViewMode = "list" | "editor";
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

export function FreightJobActivitiesPage({ target }: { target?: FreightWorkspaceTarget }) {
  const { user } = useAuth();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");
  const mode = modeMap[target?.mode || "air"];
  const direction = directionMap[target?.direction || "import"];

  const [view, setView] = useState<ViewMode>("list");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [header, setHeader] = useState<LookupRow | null>(null);
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const totals = useMemo(() => calculateTotals(lines), [lines]);

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
      setRows((response.data.data || []).map(normalizeLookupRow));
    } catch (error: any) {
      setRows([]);
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to load freight jobs." });
    } finally {
      setLoading(false);
    }
  }, [companyCode, direction.code, mode.code, query]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    { accessorKey: "job_no", header: "Job No", size: 120, cell: ({ row }) => <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openJob(row.original)}>{lookupText(row.original, "job_no")}</button> },
    { accessorKey: "job_date", header: "Date", size: 110, cell: ({ row }) => formatDate(lookupText(row.original, "job_date")) },
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
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to open job activities." });
    } finally {
      setLoading(false);
    }
  }

  async function saveLines() {
    if (!header) return;
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
      setNotice({ type: "success", text: "Job activities saved." });
      await loadRows();
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save job activities." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmJob() {
    if (!header) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.post("/api/freight/job-activities/confirm", {
        company_code: companyCode,
        prin_code: lookupText(header, "prin_code"),
        job_no: lookupText(header, "job_no"),
        user_id: userId,
      });
      setNotice({ type: "success", text: "Job activities confirmed." });
      await openJob(header);
    } catch (error: any) {
      setNotice({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to confirm job activities." });
    } finally {
      setSaving(false);
    }
  }

  if (view === "list") {
    return (
      <section className="grid gap-3">
        <Header title={`${mode.label} ${direction.label} Service Activities`} subtitle="Job cost sheet and profit lines">
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
    <section className="grid gap-2">
      <Header title="Service & Activities" subtitle={`${lookupText(header, "job_no")} / ${lookupText(header, "prin_name") || lookupText(header, "prin_code")}`}>
        {notice && <NoticeChip notice={notice} />}
        <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}><ArrowLeft size={14} />List</Button>
        <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus size={14} />Line</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void confirmJob()} disabled={saving || !lines.length}><CheckCircle2 size={14} />Confirm</Button>
        <Button type="button" size="sm" onClick={() => void saveLines()} disabled={saving}><Save size={14} />Save</Button>
      </Header>

      <div className="grid gap-2 lg:grid-cols-4">
        <Metric label="Revenue" value={money(totals.revenue)} />
        <Metric label="Expense" value={money(totals.expense)} />
        <Metric label="Profit" value={money(totals.profit)} tone={totals.profit < 0 ? "bad" : "good"} />
        <Metric label="Lines" value={String(lines.length)} />
      </div>

      <div className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="grid grid-cols-[42px_90px_minmax(190px,1fr)_76px_94px_105px_105px_90px_105px_90px_105px_50px] items-center gap-1 border-b bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
          <span>No</span><span>Activity</span><span>Description</span><span>Qty</span><span>Rate</span><span>Revenue</span><span>Other Cost</span><span>Agent</span><span>Agent Cost</span><span>Transp.</span><span>Transp. Cost</span><span />
        </div>
        <div className="max-h-[calc(100vh-330px)] overflow-auto">
          {lines.map((line, index) => (
            <div key={`${line.srno}-${index}`} className="grid grid-cols-[42px_90px_minmax(190px,1fr)_76px_94px_105px_105px_90px_105px_90px_105px_50px] items-center gap-1 border-b px-2 py-1">
              <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
              <ActivityLookup value={line.act_code} companyCode={companyCode} onChange={(value, row) => updateLine(index, { act_code: value, activity: lookupText(row || undefined, "activity"), other_services: lookupText(row || undefined, "activity") || line.other_services, bill_rate: lookupText(row || undefined, "bill") || line.bill_rate, actual_cost: lookupText(row || undefined, "cost") || line.actual_cost })} />
              <Input className="h-7 text-xs" value={line.other_services} onChange={(event) => updateLine(index, { other_services: event.target.value })} />
              <MoneyInput value={line.quantity} onChange={(value) => updateLine(index, recalc({ ...line, quantity: value }))} />
              <MoneyInput value={line.bill_rate} onChange={(value) => updateLine(index, recalc({ ...line, bill_rate: value }))} />
              <MoneyInput value={line.bill} onChange={(value) => updateLine(index, { bill: value })} />
              <MoneyInput value={line.actual_cost} onChange={(value) => updateLine(index, { actual_cost: value })} />
              <Input className="h-7 text-xs" value={line.broker_code} onChange={(event) => updateLine(index, { broker_code: event.target.value })} />
              <MoneyInput value={line.partners_price} onChange={(value) => updateLine(index, { partners_price: value })} />
              <Input className="h-7 text-xs" value={line.transporter_code} onChange={(event) => updateLine(index, { transporter_code: event.target.value })} />
              <MoneyInput value={line.transport_price} onChange={(value) => updateLine(index, { transport_price: value })} />
              <Button type="button" size="icon" variant="ghost" title="Remove line" onClick={() => removeLine(index)}><Trash2 size={14} /></Button>
            </div>
          ))}
          {!lines.length && <div className="px-3 py-8 text-center text-sm text-muted-foreground">No activity lines yet.</div>}
        </div>
      </div>
    </section>
  );

  function addLine() {
    setLines((current) => [...current, emptyLine(current.length + 1)]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, rowIndex) => rowIndex !== index).map((line, rowIndex) => ({ ...line, srno: String(rowIndex + 1) })));
  }

  function updateLine(index: number, patch: Partial<ActivityLine>) {
    setLines((current) => current.map((line, rowIndex) => rowIndex === index ? { ...line, ...patch, srno: String(index + 1) } : line));
  }
}

function Header({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Calculator size={18} /></span>
        <div><p className="eyebrow mb-0.5">Freight Cost Sheet</p><h1 className="m-0 text-lg font-semibold text-foreground">{title}</h1><p className="m-0 text-xs text-muted-foreground">{subtitle}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : "text-foreground";
  return <div className="rounded-md border bg-card px-3 py-2 shadow-sm"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><TrendingUp size={12} />{label}</div><div className={`text-lg font-semibold ${toneClass}`}>{value}</div></div>;
}

function ActivityLookup({ companyCode, value, onChange }: { companyCode: string; value: string; onChange: (value: string, row: LookupRow | null) => void }) {
  return (
    <LookupField
      value={value}
      compact
      valueField="ACT_CODE"
      displayFields={["ACT_CODE", "ACTIVITY"]}
      columns={[{ field: "ACT_CODE", header: "Code" }, { field: "ACTIVITY", header: "Activity" }, { field: "BILL", header: "Bill" }, { field: "COST", header: "Cost" }]}
      loadOptions={() => loadFreightLookup(`SELECT ACTIVITY_CODE ACT_CODE, ACTIVITY, BILL, COST FROM MS_ACTIVITY WHERE COMPANY_CODE='${sqlEscape(companyCode)}' AND NVL(FREEZE_FLAG,'N') <> 'Y' ORDER BY ACTIVITY_CODE`)}
      onChange={onChange}
    />
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Input className="h-7 text-right text-xs" type="number" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function NoticeChip({ notice }: { notice: Exclude<Notice, null> }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.text}</span>;
}

function emptyLine(srno: number): ActivityLine {
  return { srno: String(srno), act_code: "", activity: "", other_services: "", quantity: "1", bill_rate: "0", bill: "0", actual_cost: "0", broker_code: "", partners_price: "0", transporter_code: "", vehicle_no: "", transport_price: "0", confirmed: "Y", print_flag: "Y", payment_mode: "", div_code: "", remarks: "" };
}

function toLine(row: LookupRow, index: number): ActivityLine {
  const base = emptyLine(index + 1);
  return Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as ActivityLine;
}

function recalc(line: ActivityLine) {
  return { bill: String(numberValue(line.quantity) * numberValue(line.bill_rate)) };
}

function calculateTotals(lines: ActivityLine[]) {
  return lines.reduce((sum, line) => {
    const revenue = numberValue(line.bill);
    const expense = numberValue(line.actual_cost) + numberValue(line.partners_price) + numberValue(line.transport_price);
    return { revenue: sum.revenue + revenue, expense: sum.expense + expense, profit: sum.profit + revenue - expense };
  }, { revenue: 0, expense: 0, profit: 0 });
}

async function loadFreightLookup(sql: string) {
  return (await executeWmsInboundSql(sql)).map(normalizeLookupRow);
}

function normalizeLookupRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
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

function money(input: unknown) {
  return numberValue(input).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function sqlEscape(value: string) {
  return value.replace(/'/g, "''");
}
