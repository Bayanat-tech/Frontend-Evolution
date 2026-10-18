import { freightTextLimit, freightValidationError, assertFreightRecords } from "../../utils/freightValidation";
import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calculator, CheckCircle2, Edit2, ListPlus, Plus, RefreshCw, Save, Trash2, TrendingUp } from "lucide-react";
import { api } from "../../api/client";
import { freightSelect, freightTaxCategories, freightTaxComponents } from "../../api/freight";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";
import { Coins, Globe } from "lucide-react";

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
  broker_name?: string;
  partners_price: string;
  transporter_code: string;
  transporter_name?: string;
  vehicle_no: string;
  transport_price: string;
  confirmed: string;
  print_flag: string;
  payment_mode: string;
  div_code: string;
  remarks: string;
  // Multi-Currency & Foreign Currency Fields
  bill_curr_code: string;
  bill_ex_rate: string;
  bill_rate_oc: string;
  bill_oc: string;
  ac_curr_code: string;
  ac_ex_rate: string;
  actual_cost_oc: string;
  partner_curr_code: string;
  partner_ex_rate: string;
  partner_price_oc: string;
  tp_curr_code: string;
  tp_ex_rate: string;
  transport_price_oc: string;
  // Sales Tax Components
  tx_cat_code: string;
  tx_compntcat_code_1: string;
  tx_compnt_perc_1: string;
  tx_compnt_amt_1: string;
  tx_compnt_lcuramt_1: string;
  tx_compnt_1_expmt: string;
  // Cost Tax Components
  tx_cat_code_cost: string;
  tx_compntcat_code_1_cost: string;
  tx_compnt_perc_1_cost: string;
  tx_compnt_amt_1_cost: string;
  tx_compnt_lcuramt_1_cost: string;
  tx_compnt_1_expmt_cost: string;
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

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
  const [activeListTab, setActiveListTab] = useState<"active" | "confirmed" | "all">("active");
  const [query, setQuery] = useState("");
  const [header, setHeader] = useState<LookupRow | null>(null);
  const [lines, setLines] = useState<ActivityLine[]>([]);
  const [invalidLineIndices, setInvalidLineIndices] = useState<number[]>([]);
  const [activeFcIndex, setActiveFcIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const isConf = Boolean(lookupText(r, "confirm_date"));
      if (activeListTab === "active") return !isConf;
      if (activeListTab === "confirmed") return isConf;
      return true;
    });
  }, [rows, activeListTab]);

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
  // Match PowerBuilder uo_ff_service_activities_new:
  // Confirmation (confirm_date) is an operational milestone and does NOT freeze line editing.
  // Lines can be edited until invoiced or completed/canceled.
  const isLineLocked = isClosed;
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
    { id: "actions", header: "Actions", size: 70, cell: ({ row }) => <Button type="button" size="icon" variant="ghost" className="h-6 w-6" title="Open activities" onClick={() => openJob(row.original)}><Edit2 size={13} /></Button> },
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
      const loadedHeader = normalizeLookupRow(response.data.data?.header || row);
      const quotationRef = lookupText(loadedHeader, "quotation_ref") || lookupText(row, "quotation_ref");
      setHeader({ ...loadedHeader, QUOTATION_REF: quotationRef });
      setLines((response.data.data?.lines || []).map((lineRow, idx) => toLine(lineRow, idx, loadedHeader)));
      setDirty(false);
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

    const invalidIndices: number[] = [];
    lines.forEach((l, i) => {
      if (!l.act_code || !l.act_code.trim() || Number(l.quantity || 0) <= 0) {
        invalidIndices.push(i);
      }
    });

    for (const [index, line] of lines.entries()) {
      const schemaError = freightValidationError("TN_INVOICE_DET", line);
      if (schemaError) { notify({ type: "error", text: `Activity line ${index + 1}: ${schemaError}` }); return; }
    }

    if (invalidIndices.length > 0) {
      setInvalidLineIndices(invalidIndices);
      notify({ type: "error", text: "Kindly fill in the missing fields." });
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
      setDirty(false);
      await loadRows();
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to save job activities." });
    } finally {
      setSaving(false);
    }
  }

  async function populateFromQuotation() {
    if (!header) return;
    if (isLineLocked) {
      notify({ type: "error", text: "Confirmed, invoiced, or completed job is locked. Activities are view only." });
      return;
    }

    const quotationRef = lookupText(header, "quotation_ref");
    if (!quotationRef) {
      notify({ type: "error", text: "This job is not linked to an approved quotation." });
      return;
    }

    setPopulating(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; message?: string; data?: { lines?: LookupRow[] } }>(
        "/api/freight/job-activities/populate-from-quotation",
        {
          company_code: companyCode,
          prin_code: lookupText(header, "prin_code"),
          job_no: lookupText(header, "job_no"),
        },
      );
      const incoming = (response.data.data?.lines || []).map((lineRow, idx) => toLine(lineRow, idx, header)).map((line) => ({
        ...line,
        div_code: line.div_code || lookupText(header, "div_code"),
        tx_cat_code: line.tx_cat_code || lookupText(header, "tx_cat_code"),
      }));
      const existingCodes = new Set(lines.map((line) => line.act_code.trim().toUpperCase()).filter(Boolean));
      const additions = incoming.filter((line) => {
        const code = line.act_code.trim().toUpperCase();
        if (!code || existingCodes.has(code)) return false;
        existingCodes.add(code);
        return true;
      });
      const addedCount = additions.length;
      if (addedCount) setLines((current) => [...current, ...additions].map((line, index) => ({ ...line, srno: String(index + 1) })));
      if (addedCount) {
        setDirty(true);
        notify({ type: "success", text: `${addedCount} activities loaded from quotation ${quotationRef}. Review and save them.` });
      } else {
        notify({ type: "success", text: response.data.message || `No new activities are available in quotation ${quotationRef}.` });
      }
    } catch (error: any) {
      notify({ type: "error", text: error?.response?.data?.details || error?.response?.data?.message || "Unable to populate quotation activities." });
    } finally {
      setPopulating(false);
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
        {!onEmbeddedList && (<Button type="button" size="sm" variant="outline" onClick={onEmbeddedList || (() => setView("list"))} aria-label="Back to list" title="Back to list"><ArrowLeft size={14} /></Button>)}
        <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={isLineLocked}>
          <Plus size={14} />Line
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void populateFromQuotation()} disabled={saving || populating || isLineLocked || !lookupText(header, "quotation_ref")} title={lookupText(header, "quotation_ref") ? `Load missing activities from ${lookupText(header, "quotation_ref")}` : "Job has no quotation reference"}>
          <ListPlus size={14} />{populating ? "Loading..." : "Populate from Quotation"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void confirmJob()} disabled={saving || populating || dirty || isClosed || !lines.length || Boolean(lookupText(header, "confirm_date"))} title={dirty ? "Save activity changes before confirmation" : undefined}>
          <CheckCircle2 size={14} />{lookupText(header, "confirm_date") ? "Confirmed" : "Confirm"}
        </Button>
        <Button type="button" size="sm" onClick={() => void saveLines()} disabled={saving || isLineLocked}>
          <Save size={14} />Save
        </Button>
      </div>
    );
    return () => onEmbeddedActionsChange(null);
  // }, [dirty, header, isClosed, isLineLocked, lines.length, notice, onEmbeddedActionsChange, onEmbeddedList, populating, saving, view]);
  }, [dirty, header, isClosed, isLineLocked, lines, notice, onEmbeddedActionsChange, onEmbeddedList, populating, saving, view]);

  if (view === "list") {
    return (
      <section className="freight-list-screen grid gap-3">
        <Header eyebrow={copy.eyebrow} title={`${mode.label} ${direction.label} ${copy.title}`} subtitle={copy.subtitle}>
          {notice && <NoticeChip notice={notice} />}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}><RefreshCw size={14} />Refresh</Button>
        </Header>
        {/* Filter Tabs Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {(
            [
              { id: "active", label: "Active", count: rows.filter((r) => !lookupText(r, "confirm_date")).length },
              { id: "confirmed", label: "Confirmed", count: rows.filter((r) => Boolean(lookupText(r, "confirm_date"))).length },
              { id: "all", label: "All", count: rows.length },
            ] as const
          ).map((tab) => {
            const active = activeListTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveListTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-[#00378C] text-white shadow-xs font-semibold ring-2 ring-[#00378C]/20"
                    : "border border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        <DataTable
          columns={columns}
          data={filteredRows}
          loading={loading}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search job, principal..."
          title={`${filteredRows.length} Jobs`}
          subtitle={`${mode.label} / ${direction.label}`}
          height="calc(100vh - 240px)"
          minWidth={1100}
          density="grid"
          enablePagination
          pageSize={25}
          enableExport={false}
          actionButton={
            <FinanceListActionsMenu
              onExport={() => exportToCsv(filteredRows, columns, `freight-${mode.code}-${direction.code}-job-activities.csv`)}
              onRefresh={() => void loadRows()}
            />
          }
          exportFilename={`freight-${mode.code}-${direction.code}-job-activities.csv`}
          onRowClick={openJob}
        />
      </section>
    );
  }

  return (
    <section className="freight-ui-standard grid gap-2 freight-job-ops-screen min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-card text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-muted-foreground">Active Job:</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-[#f59e0b] bg-[#fef3c7] px-3 py-0.5 font-mono text-sm font-bold text-[#78350f] shadow-xs">
            {lookupText(header, "job_no") || "No Job Selected"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-[#f59e0b] bg-[#fef3c7] px-2.5 py-0.5 font-mono text-xs font-bold text-[#78350f] shadow-xs">
            {formatDate(lookupText(header, "job_date")) || today()}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-muted-foreground">Principal:</span>
          <strong className="text-foreground font-semibold">{lookupText(header, "prin_name") || lookupText(header, "prin_code") || "-"}</strong>
          {lookupText(header, "quotation_ref") && (
            <>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-muted-foreground">From Quotation:</span>
              <strong className="text-primary font-semibold">{lookupText(header, "quotation_ref")}</strong>
            </>
          )}
          {dirty && (
            <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          {isClosed ? (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">Locked</span>
          ) : isConfirmed ? (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">Confirmed</span>
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
          )}
        </div>
      </div>

      {!embeddedInWorkspace && (
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            {!initialJob && (
              <button
                type="button"
                onClick={() => setView("list")}
                className="flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-colors cursor-pointer"
                title="Back to List"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="min-w-0">
              <p className="eyebrow mb-0 text-[10px] font-bold uppercase tracking-wider text-primary">
                {copy.eyebrow}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-[#f59e0b] bg-[#fef3c7] px-3 py-1 font-mono text-base font-bold text-[#78350f] shadow-xs">
                  {lookupText(header, "job_no") || "NEW"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-[#f59e0b] bg-[#fef3c7] px-2.5 py-0.5 font-mono text-sm font-bold text-[#78350f] shadow-xs">
                  {formatDate(lookupText(header, "job_date")) || today()}
                </span>
                <h1 className="m-0 text-base font-bold leading-tight text-foreground">
                  {copy.title}
                </h1>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {notice && <NoticeChip notice={notice} />}
            <Button type="button" size="sm" onClick={addLine} disabled={isLineLocked} className="!bg-[#00378C] !text-white !border-[#002d72] hover:!bg-[#002d72]">
              <Plus size={14} /> Add Line
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void populateFromQuotation()}
              disabled={saving || populating || isLineLocked || !lookupText(header, "quotation_ref")}
              title={lookupText(header, "quotation_ref") ? `Load missing activities from ${lookupText(header, "quotation_ref")}` : "Job has no quotation reference"}
            >
              <ListPlus size={14} /> {populating ? "Loading..." : "Populate from Quotation"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void confirmJob()}
              disabled={saving || populating || dirty || isClosed || !lines.length || Boolean(lookupText(header, "confirm_date"))}
              title={dirty ? "Save activity changes before confirmation" : undefined}
            >
              <CheckCircle2 size={14} /> {lookupText(header, "confirm_date") ? "Confirmed" : "Confirm"}
            </Button>
            <Button type="button" size="sm" onClick={() => void saveLines()} disabled={saving || isLineLocked}>
              <Save size={14} /> Save
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <Metric label="Revenue" value={money(totals.revenue)} />
        <Metric label="Expense" value={money(totals.expense)} />
        <Metric label="Profit" value={money(totals.profit)} tone={totals.profit < 0 ? "bad" : "good"} />
        <Metric label="Lines" value={String(lines.length)} />
      </div>

      <div className="freight-job-table-shell freight-activity-table overflow-x-auto min-w-0">
        <div className="min-w-[1360px]">
          <div className="freight-job-table-head sticky top-0 z-10 grid grid-cols-[40px_150px_minmax(180px,1fr)_65px_90px_95px_95px_150px_95px_150px_95px_70px_36px] items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold bg-[#00378C] text-white tracking-wide rounded-t-lg shadow-xs">
            <span>No</span>
            <span>Activity</span>
            <span>Description</span>
            <span>Qty</span>
            <span>Rate</span>
            <span>Revenue</span>
            <span>Cost</span>
            <span>Agent / Broker</span>
            <span>Agent Price</span>
            <span>Transporter</span>
            <span>Transp. Price</span>
            <span>Currency</span>
            <span />
          </div>
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-border/60">
            {lines.map((line, index) => {
              const isInvalid = invalidLineIndices.includes(index);
              return (
              <div key={`${line.srno}-${index}`} className={`freight-job-table-row flex flex-col transition-colors ${isInvalid ? "bg-rose-50/70 border-l-4 border-l-rose-500 ring-1 ring-rose-400" : "hover:bg-slate-50/70"}`}>
                <div className="freight-activity-primary-row grid grid-cols-[40px_150px_minmax(180px,1fr)_65px_90px_95px_95px_150px_95px_150px_95px_70px_36px] items-center gap-1.5 px-3 py-1.5">
                  <span className="text-xs font-semibold text-muted-foreground text-center">{index + 1}</span>
                  <ActivityLookup value={line.act_code} displayValue={line.activity} companyCode={companyCode} disabled={isLineLocked} onChange={async (value, row) => {
                    const newBillRate = lookupText(row || undefined, "bill");
                    const newCost = lookupText(row || undefined, "cost");
                    const divCode = line.div_code || lookupText(header, "div_code") || "10";
                    const txCat = line.tx_cat_code || lookupText(header, "tx_cat_code") || "11";

                    let updatedLine: ActivityLine = recalc({
                      ...line,
                      act_code: value,
                      activity: lookupText(row || undefined, "activity"),
                      other_services: lookupText(row || undefined, "activity") || line.other_services,
                      bill_rate: newBillRate !== "" ? newBillRate : line.bill_rate,
                      actual_cost: newCost !== "" ? newCost : line.actual_cost,
                      div_code: divCode,
                      tx_cat_code: txCat,
                    });

                    // Match PowerBuilder uof_get_tax_compnentcat: auto-populate tax code and percentage
                    if (value && companyCode && divCode && txCat) {
                      try {
                        const compRows = await freightTaxComponents<LookupRow>(companyCode, divCode, txCat, "", value);
                        if (compRows.length > 0) {
                          const firstComp = normalizeLookupRow(compRows[0]);
                          const taxCode = lookupText(firstComp, "tx_compntcat_code");
                          const taxPerc = lookupText(firstComp, "tx_percnt") || "0";
                          const isStandard = numberValue(taxPerc) > 0 ? "S" : "N";
                          updatedLine = recalcSalesTax({
                            ...updatedLine,
                            tx_compntcat_code_1: taxCode,
                            tx_compnt_perc_1: taxPerc,
                            tx_compnt_1_expmt: isStandard,
                          });
                        }
                      } catch (err) {
                        console.warn("Could not auto-populate tax components:", err);
                      }
                    }

                    updateLine(index, updatedLine);
                  }} />
                  <Input className="h-7 text-xs" placeholder="Service description" value={line.other_services} disabled={isLineLocked} onChange={(event) => updateLine(index, { other_services: event.target.value })} maxLength={freightTextLimit("TN_INVOICE_DET", "other_services")} maxBytes={freightTextLimit("TN_INVOICE_DET", "other_services")} />
                  <MoneyInput value={line.quantity} disabled={isLineLocked} onChange={(value) => updateLine(index, recalc({ ...line, quantity: value }))} />
                  <MoneyInput value={line.bill_rate} disabled={isLineLocked} onChange={(value) => updateLine(index, recalc({ ...line, bill_rate: value }))} />
                  <MoneyInput value={line.bill} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcSalesTax({ ...line, bill: value }))} />
                  <MoneyInput value={line.actual_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcCostTax({ ...line, actual_cost: value }))} />
                  
                  {/* Agent / Broker Dropdown */}
                  <AgentLookup
                    companyCode={companyCode}
                    value={line.broker_code}
                    displayValue={line.broker_name}
                    disabled={isLineLocked}
                    onChange={(val, row) => {
                      updateLine(index, {
                        broker_code: val,
                        broker_name: lookupText(row, "broker_name") || lookupText(row, "agent_name") || "",
                      });
                    }}
                  />
                  <MoneyInput value={line.partners_price} disabled={isLineLocked} onChange={(value) => updateLine(index, { partners_price: value })} />
                  
                  {/* Transporter Dropdown */}
                  <TransporterLookup
                    companyCode={companyCode}
                    value={line.transporter_code}
                    displayValue={line.transporter_name}
                    disabled={isLineLocked}
                    onChange={(val, row) => {
                      updateLine(index, {
                        transporter_code: val,
                        transporter_name: lookupText(row, "transporter_name") || "",
                      });
                    }}
                  />
                  <MoneyInput value={line.transport_price} disabled={isLineLocked} onChange={(value) => updateLine(index, { transport_price: value })} />

                  {/* Multi-Currency / FC Dialog Button (PowerBuilder dw_7 / F3) */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-[11px] gap-1 font-mono border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-amber-900 shadow-2xs"
                    title="Foreign Currency / Multi-Currency Exchange Rates (PB dw_7)"
                    onClick={() => setActiveFcIndex(index)}
                  >
                    <Coins size={12} className="text-amber-600" />
                    <span>{line.bill_curr_code || "OMR"}</span>
                  </Button>

                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600" title="Remove line" disabled={isLineLocked} onClick={() => removeLine(index)}>
                    <Trash2 size={13} />
                  </Button>
                </div>

                {/* <div className="freight-activity-tax-row grid grid-cols-2 gap-2 border-t border-dashed border-border/60 bg-muted/20 px-3 py-1.5 text-[11px]">
                  <div className="freight-activity-tax-group sales flex items-center gap-1.5">
                    <span className="font-semibold text-primary uppercase text-[10px] tracking-wider min-w-[55px]">Sales Tax:</span>
                    <div className="w-28">
                      <TaxCategoryLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} value={line.tx_cat_code} disabled={isLineLocked} placeholder="Sale Cat" onChange={(value) => updateLine(index, recalcSalesTax({ ...line, div_code: line.div_code || lookupText(header, "div_code"), tx_cat_code: value, tx_compntcat_code_1: "", tx_compnt_perc_1: "0", tx_compnt_1_expmt: "N" }))} />
                    </div>
                    <div className="w-32">
                      <TaxCodeLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} taxCategory={line.tx_cat_code} activityCode={line.act_code} value={line.tx_compntcat_code_1} disabled={isLineLocked} placeholder="Sale Code" onChange={(value, row) => { const percent = lookupText(row, "tx_percnt") || "0"; updateLine(index, recalcSalesTax({ ...line, tx_compntcat_code_1: value, tx_cat_code: lookupText(row, "tx_cat_code") || line.tx_cat_code, tx_compnt_perc_1: percent, tx_compnt_1_expmt: numberValue(percent) > 0 ? "S" : "N" })); }} />
                    </div>
                    <div className="w-16">
                      <MoneyInput value={line.tx_compnt_perc_1} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcSalesTax({ ...line, tx_compnt_perc_1: value }))} />
                    </div>
                    <div className="w-20">
                      <TaxTreatmentSelect value={line.tx_compnt_1_expmt} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcSalesTax({ ...line, tx_compnt_1_expmt: value, tx_compnt_perc_1: value === "S" ? line.tx_compnt_perc_1 : "0" }))} />
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground pl-1">
                      <span>Amt:</span>
                      <span className="font-semibold text-foreground">{money(line.tx_compnt_amt_1)}</span>
                    </div>
                  </div>

                  <div className="freight-activity-tax-group cost flex items-center gap-1.5">
                    <span className="font-semibold text-emerald-700 uppercase text-[10px] tracking-wider min-w-[55px]">Cost Tax:</span>
                    <div className="w-28">
                      <TaxCategoryLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} value={line.tx_cat_code_cost} disabled={isLineLocked} placeholder="Cost Cat" onChange={(value) => updateLine(index, recalcCostTax({ ...line, div_code: line.div_code || lookupText(header, "div_code"), tx_cat_code_cost: value, tx_compntcat_code_1_cost: "", tx_compnt_perc_1_cost: "0", tx_compnt_1_expmt_cost: "N" }))} />
                    </div>
                    <div className="w-32">
                      <TaxCodeLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} taxCategory={line.tx_cat_code_cost} activityCode={line.act_code} value={line.tx_compntcat_code_1_cost} disabled={isLineLocked} placeholder="Cost Code" onChange={(value, row) => { const percent = lookupText(row, "tx_percnt") || "0"; updateLine(index, recalcCostTax({ ...line, tx_compntcat_code_1_cost: value, tx_cat_code_cost: lookupText(row, "tx_cat_code") || line.tx_cat_code_cost, tx_compnt_perc_1_cost: percent, tx_compnt_1_expmt_cost: numberValue(percent) > 0 ? "S" : "N" })); }} />
                    </div>
                    <div className="w-16">
                      <MoneyInput value={line.tx_compnt_perc_1_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcCostTax({ ...line, tx_compnt_perc_1_cost: value }))} />
                    </div>
                    <div className="w-20">
                      <TaxTreatmentSelect value={line.tx_compnt_1_expmt_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcCostTax({ ...line, tx_compnt_1_expmt_cost: value, tx_compnt_perc_1_cost: value === "S" ? line.tx_compnt_perc_1_cost : "0" }))} />
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground pl-1">
                      <span>Amt:</span>
                      <span className="font-semibold text-foreground">{money(line.tx_compnt_amt_1_cost)}</span>
                    </div>
                  </div>
                </div> */}
              
              <div className="freight-activity-tax-row grid grid-cols-[42px_max-content_max-content] gap-2 items-center border-t border-dashed border-border/60 bg-muted/20 px-3 py-1.5 text-[11px]">
  <span />
  <div className="freight-activity-tax-group sales flex items-center gap-1.5 shrink-0">
    <span className="font-semibold text-primary uppercase text-[10px] tracking-wider min-w-[55px]">Sales Tax:</span>
    <div className="w-28">
      <TaxCategoryLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} value={line.tx_cat_code} disabled={isLineLocked} placeholder="Sale Cat" onChange={(value) => updateLine(index, recalcSalesTax({ ...line, div_code: line.div_code || lookupText(header, "div_code"), tx_cat_code: value, tx_compntcat_code_1: "", tx_compnt_perc_1: "0", tx_compnt_1_expmt: "N" }))} />
    </div>
    <div className="w-28">
      <TaxCodeLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} taxCategory={line.tx_cat_code} activityCode={line.act_code} value={line.tx_compntcat_code_1} disabled={isLineLocked} placeholder="Sale Code" onChange={(value, row) => { const percent = lookupText(row, "tx_percnt") || "0"; updateLine(index, recalcSalesTax({ ...line, tx_compntcat_code_1: value, tx_cat_code: lookupText(row, "tx_cat_code") || line.tx_cat_code, tx_compnt_perc_1: percent, tx_compnt_1_expmt: numberValue(percent) > 0 ? "S" : "N" })); }} />
    </div>
    <div className="w-14">
      <MoneyInput value={line.tx_compnt_perc_1} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcSalesTax({ ...line, tx_compnt_perc_1: value }))} />
    </div>
    <div className="w-16">
      <TaxTreatmentSelect value={line.tx_compnt_1_expmt} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcSalesTax({ ...line, tx_compnt_1_expmt: value, tx_compnt_perc_1: value === "S" ? line.tx_compnt_perc_1 : "0" }))} />
    </div>
    <div className="flex items-center gap-0.1 text-muted-foreground pl-9 shrink-0 whitespace-nowrap">
      <span>Amt:</span>
      <span className="font-semibold text-foreground tabular-nums min-w-[60px] text-right">{money(line.tx_compnt_amt_1)}</span>
    </div>
  </div>

  <div className="freight-activity-tax-group cost flex items-center gap-1.5 shrink-0 border-l border-border/60 pl-8">
    <span className="font-semibold text-emerald-700 uppercase text-[10px] tracking-wider min-w-[55px]">Cost Tax:</span>
    <div className="w-28">
      <TaxCategoryLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} value={line.tx_cat_code_cost} disabled={isLineLocked} placeholder="Cost Cat" onChange={(value) => updateLine(index, recalcCostTax({ ...line, div_code: line.div_code || lookupText(header, "div_code"), tx_cat_code_cost: value, tx_compntcat_code_1_cost: "", tx_compnt_perc_1_cost: "0", tx_compnt_1_expmt_cost: "N" }))} />
    </div>
    <div className="w-28">
      <TaxCodeLookup companyCode={companyCode} divisionCode={line.div_code || lookupText(header, "div_code")} taxCategory={line.tx_cat_code_cost} activityCode={line.act_code} value={line.tx_compntcat_code_1_cost} disabled={isLineLocked} placeholder="Cost Code" onChange={(value, row) => { const percent = lookupText(row, "tx_percnt") || "0"; updateLine(index, recalcCostTax({ ...line, tx_compntcat_code_1_cost: value, tx_cat_code_cost: lookupText(row, "tx_cat_code") || line.tx_cat_code_cost, tx_compnt_perc_1_cost: percent, tx_compnt_1_expmt_cost: numberValue(percent) > 0 ? "S" : "N" })); }} />
    </div>
    <div className="w-14">
      <MoneyInput value={line.tx_compnt_perc_1_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcCostTax({ ...line, tx_compnt_perc_1_cost: value }))} />
    </div>
    <div className="w-16">
      <TaxTreatmentSelect value={line.tx_compnt_1_expmt_cost} disabled={isLineLocked} onChange={(value) => updateLine(index, recalcCostTax({ ...line, tx_compnt_1_expmt_cost: value, tx_compnt_perc_1_cost: value === "S" ? line.tx_compnt_perc_1_cost : "0" }))} />
    </div>
    <div className="flex items-center text-muted-foreground pl-9 shrink-0 whitespace-nowrap">
      <span>Amt:</span>
      <span className="font-semibold text-foreground tabular-nums min-w-[60px] text-right">{money(line.tx_compnt_amt_1_cost)}</span>
    </div>
  </div>
</div>
              
              </div>
            );
          })}
            {!lines.length && (
              <div className="px-3 py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <p className="font-medium text-foreground">No service & activity lines yet.</p>
                <p className="text-xs text-muted-foreground">Click "+ Line" to add services or "Populate from Quotation" to import approved activities.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Currency & Foreign Currency Exchange Dialog (PowerBuilder dw_7 / F3) */}
      {activeFcIndex !== null && lines[activeFcIndex] && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setActiveFcIndex(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#00378C]">
                <Globe size={18} />
                <span>Multi-Currency & Exchange Rate Details (Line #{activeFcIndex + 1})</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-2.5 text-amber-900 flex justify-between items-center">
                <div>
                  <span className="font-semibold">Activity: </span>
                  <span className="font-mono">{lines[activeFcIndex].act_code} - {lines[activeFcIndex].activity || lines[activeFcIndex].other_services || "Service Line"}</span>
                </div>
                <div>
                  <span className="font-semibold">Quantity: </span>
                  <span className="font-mono font-bold">{lines[activeFcIndex].quantity || 1}</span>
                </div>
              </div>

              {/* 1. Sales / Billing Currency */}
              <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
                <div className="font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span>1. Sales / Billing Currency</span>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Currency</label>
                    <CurrencyLookup
                      companyCode={companyCode}
                      value={lines[activeFcIndex].bill_curr_code}
                      disabled={isLineLocked}
                      onChange={(currCode, row) => {
                        const ex = lookupText(row, "ex_rate") || "1";
                        const ocRate = numberValue(lines[activeFcIndex].bill_rate_oc) || numberValue(lines[activeFcIndex].bill_rate);
                        const rate = ocRate * numberValue(ex);
                        updateLine(activeFcIndex, recalc({
                          ...lines[activeFcIndex],
                          bill_curr_code: currCode,
                          bill_ex_rate: ex,
                          bill_rate_oc: String(ocRate),
                          bill_rate: String(rate),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Ex. Rate</label>
                    <MoneyInput
                      value={lines[activeFcIndex].bill_ex_rate}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ex = numberValue(val) || 1;
                        const ocRate = numberValue(lines[activeFcIndex].bill_rate_oc);
                        const rate = ocRate > 0 ? ocRate * ex : numberValue(lines[activeFcIndex].bill_rate);
                        updateLine(activeFcIndex, recalc({
                          ...lines[activeFcIndex],
                          bill_ex_rate: val,
                          bill_rate: String(rate),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Rate (OC)</label>
                    <MoneyInput
                      value={lines[activeFcIndex].bill_rate_oc}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ocRate = numberValue(val);
                        const ex = numberValue(lines[activeFcIndex].bill_ex_rate) || 1;
                        const rate = ocRate * ex;
                        updateLine(activeFcIndex, recalc({
                          ...lines[activeFcIndex],
                          bill_rate_oc: val,
                          bill_rate: String(rate),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Local Base Revenue</label>
                    <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                      {money(lines[activeFcIndex].bill)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Vendor / Actual Cost Currency */}
              <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
                <div className="font-bold text-emerald-700 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span>2. Vendor / Actual Cost Currency</span>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Cost Currency</label>
                    <CurrencyLookup
                      companyCode={companyCode}
                      value={lines[activeFcIndex].ac_curr_code}
                      disabled={isLineLocked}
                      onChange={(currCode, row) => {
                        const ex = lookupText(row, "ex_rate") || "1";
                        const ocCost = numberValue(lines[activeFcIndex].actual_cost_oc) || numberValue(lines[activeFcIndex].actual_cost);
                        const cost = ocCost * numberValue(ex);
                        updateLine(activeFcIndex, recalcCostTax({
                          ...lines[activeFcIndex],
                          ac_curr_code: currCode,
                          ac_ex_rate: ex,
                          actual_cost_oc: String(ocCost),
                          actual_cost: String(cost),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Ex. Rate</label>
                    <MoneyInput
                      value={lines[activeFcIndex].ac_ex_rate}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ex = numberValue(val) || 1;
                        const ocCost = numberValue(lines[activeFcIndex].actual_cost_oc);
                        const cost = ocCost > 0 ? ocCost * ex : numberValue(lines[activeFcIndex].actual_cost);
                        updateLine(activeFcIndex, recalcCostTax({
                          ...lines[activeFcIndex],
                          ac_ex_rate: val,
                          actual_cost: String(cost),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Cost (OC)</label>
                    <MoneyInput
                      value={lines[activeFcIndex].actual_cost_oc}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ocCost = numberValue(val);
                        const ex = numberValue(lines[activeFcIndex].ac_ex_rate) || 1;
                        const cost = ocCost * ex;
                        updateLine(activeFcIndex, recalcCostTax({
                          ...lines[activeFcIndex],
                          actual_cost_oc: val,
                          actual_cost: String(cost),
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Local Base Cost</label>
                    <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                      {money(lines[activeFcIndex].actual_cost)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Agent / Partner Price Currency */}
              <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
                <div className="font-bold text-sky-700 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span>3. Agent / Partner Price Currency</span>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Partner Currency</label>
                    <CurrencyLookup
                      companyCode={companyCode}
                      value={lines[activeFcIndex].partner_curr_code}
                      disabled={isLineLocked}
                      onChange={(currCode, row) => {
                        const ex = lookupText(row, "ex_rate") || "1";
                        const ocPrice = numberValue(lines[activeFcIndex].partner_price_oc) || numberValue(lines[activeFcIndex].partners_price);
                        const price = ocPrice * numberValue(ex);
                        updateLine(activeFcIndex, {
                          partner_curr_code: currCode,
                          partner_ex_rate: ex,
                          partner_price_oc: String(ocPrice),
                          partners_price: String(price),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Ex. Rate</label>
                    <MoneyInput
                      value={lines[activeFcIndex].partner_ex_rate}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ex = numberValue(val) || 1;
                        const ocPrice = numberValue(lines[activeFcIndex].partner_price_oc);
                        const price = ocPrice > 0 ? ocPrice * ex : numberValue(lines[activeFcIndex].partners_price);
                        updateLine(activeFcIndex, {
                          partner_ex_rate: val,
                          partners_price: String(price),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Partner Price (OC)</label>
                    <MoneyInput
                      value={lines[activeFcIndex].partner_price_oc}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ocPrice = numberValue(val);
                        const ex = numberValue(lines[activeFcIndex].partner_ex_rate) || 1;
                        const price = ocPrice * ex;
                        updateLine(activeFcIndex, {
                          partner_price_oc: val,
                          partners_price: String(price),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Local Base Partner Price</label>
                    <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                      {money(lines[activeFcIndex].partners_price)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Transporter Price Currency */}
              <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
                <div className="font-bold text-indigo-700 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span>4. Transporter Price Currency</span>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Transp. Currency</label>
                    <CurrencyLookup
                      companyCode={companyCode}
                      value={lines[activeFcIndex].tp_curr_code}
                      disabled={isLineLocked}
                      onChange={(currCode, row) => {
                        const ex = lookupText(row, "ex_rate") || "1";
                        const ocPrice = numberValue(lines[activeFcIndex].transport_price_oc) || numberValue(lines[activeFcIndex].transport_price);
                        const price = ocPrice * numberValue(ex);
                        updateLine(activeFcIndex, {
                          tp_curr_code: currCode,
                          tp_ex_rate: ex,
                          transport_price_oc: String(ocPrice),
                          transport_price: String(price),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Ex. Rate</label>
                    <MoneyInput
                      value={lines[activeFcIndex].tp_ex_rate}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ex = numberValue(val) || 1;
                        const ocPrice = numberValue(lines[activeFcIndex].transport_price_oc);
                        const price = ocPrice > 0 ? ocPrice * ex : numberValue(lines[activeFcIndex].transport_price);
                        updateLine(activeFcIndex, {
                          tp_ex_rate: val,
                          transport_price: String(price),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Transp. Price (OC)</label>
                    <MoneyInput
                      value={lines[activeFcIndex].transport_price_oc}
                      disabled={isLineLocked}
                      onChange={(val) => {
                        const ocPrice = numberValue(val);
                        const ex = numberValue(lines[activeFcIndex].tp_ex_rate) || 1;
                        const price = ocPrice * ex;
                        updateLine(activeFcIndex, {
                          transport_price_oc: val,
                          transport_price: String(price),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Local Base Transp. Price</label>
                    <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                      {money(lines[activeFcIndex].transport_price)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" size="sm" onClick={() => setActiveFcIndex(null)}>
                Close & Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
    </section>
  );

  function addLine() {
    if (isLineLocked) {
      notify({ type: "error", text: "Confirmed, invoiced, or completed job is locked. Activities are view only." });
      return;
    }
    setLines((current) => [...current, {
      ...emptyLine(current.length + 1, header),
      div_code: lookupText(header, "div_code"),
      tx_cat_code: lookupText(header, "tx_cat_code"),
    }]);
    setDirty(true);
  }

  function removeLine(index: number) {
    if (isLineLocked) return;
    setInvalidLineIndices((prev) => prev.filter((i) => i !== index).map((i) => i > index ? i - 1 : i));
    setLines((current) => current.filter((_, rowIndex) => rowIndex !== index).map((line, rowIndex) => ({ ...line, srno: String(rowIndex + 1) })));
    setDirty(true);
  }

  function updateLine(index: number, patch: Partial<ActivityLine>) {
    if (isLineLocked) return;
    setInvalidLineIndices((prev) => prev.filter((i) => i !== index));
    setLines((current) => current.map((line, rowIndex) => rowIndex === index ? { ...line, ...patch, srno: String(index + 1) } : line));
    setDirty(true);
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

function ActivityLookup({
  companyCode,
  value,
  displayValue,
  onChange,
  disabled,
}: {
  companyCode: string;
  value: string;
  displayValue?: string;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
}) {
  const formattedDisplayValue = useMemo(() => {
    if (!value) return displayValue || "";
    if (!displayValue) return value;
    const trimmedVal = String(value).trim();
    const trimmedDisp = String(displayValue).trim();
    if (trimmedDisp.startsWith(trimmedVal)) return trimmedDisp;
    return `${trimmedVal} - ${trimmedDisp}`;
  }, [value, displayValue]);

  return (
    <LookupField
      value={value}
      displayValue={formattedDisplayValue}
      compact
      valueField="ACT_CODE"
      displayFields={["ACT_CODE", "ACTIVITY"]}
      columns={[{ field: "ACT_CODE", header: "Code" }, { field: "ACTIVITY", header: "Activity" }]}
      loadOptions={(query) => loadFreightLookup("freight_activity", companyCode, query)}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function TaxCategoryLookup({ companyCode, divisionCode, value, onChange, disabled, placeholder }: { companyCode: string; divisionCode: string; value: string; onChange: (value: string, row: LookupRow | null) => void; disabled?: boolean; placeholder: string }) {
  return (
    <LookupField
      value={value}
      compact
      placeholder={placeholder}
      valueField="TX_CAT_CODE"
      displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
      columns={[{ field: "TX_CAT_CODE", header: "Code" }, { field: "TX_CAT_NAME", header: "Tax Category" }]}
      loadOptions={(query) => freightTaxCategories<LookupRow>(companyCode, divisionCode, query).then((rows) => rows.map(normalizeLookupRow))}
      onChange={onChange}
      disabled={disabled || !divisionCode}
    />
  );
}

function TaxCodeLookup({ companyCode, divisionCode, taxCategory, activityCode, value, onChange, disabled, placeholder }: { companyCode: string; divisionCode: string; taxCategory: string; activityCode: string; value: string; onChange: (value: string, row: LookupRow | null) => void; disabled?: boolean; placeholder: string }) {
  return (
    <LookupField
      value={value}
      compact
      placeholder={placeholder}
      valueField="TX_COMPNTCAT_CODE"
      displayFields={["TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME"]}
      columns={[{ field: "TX_COMPNTCAT_CODE", header: "Code" }, { field: "TX_COMPNTCAT_NAME", header: "Tax Code" }, { field: "TX_CAT_CODE", header: "Tax Category" }, { field: "TX_PERCNT", header: "Tax %" }]}
      loadOptions={(query) => freightTaxComponents<LookupRow>(companyCode, divisionCode, taxCategory, query, activityCode).then((rows) => rows.map(normalizeLookupRow))}
      onChange={onChange}
      disabled={disabled || !divisionCode || !taxCategory}
    />
  );
}

function AgentLookup({
  companyCode,
  value,
  displayValue,
  onChange,
  disabled,
}: {
  companyCode: string;
  value: string;
  displayValue?: string;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
}) {
  const formattedDisplayValue = useMemo(() => {
    if (!value) return displayValue || "";
    if (!displayValue) return value;
    const trimmedVal = String(value).trim();
    const trimmedDisp = String(displayValue).trim();
    if (trimmedDisp.startsWith(trimmedVal)) return trimmedDisp;
    return `${trimmedVal} - ${trimmedDisp}`;
  }, [value, displayValue]);

  return (
    <LookupField
      value={value}
      displayValue={formattedDisplayValue}
      compact
      placeholder="Select Agent / Broker"
      valueField="BROKER_CODE"
      displayFields={["BROKER_CODE", "BROKER_NAME"]}
      columns={[
        { field: "BROKER_CODE", header: "Agent Code" },
        { field: "BROKER_NAME", header: "Agent / Broker Name" },
        { field: "BROKER_CITY", header: "City" },
      ]}
      loadOptions={(query) => loadFreightLookup("freight_broker", companyCode, query)}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function TransporterLookup({
  companyCode,
  value,
  displayValue,
  onChange,
  disabled,
}: {
  companyCode: string;
  value: string;
  displayValue?: string;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
}) {
  const formattedDisplayValue = useMemo(() => {
    if (!value) return displayValue || "";
    if (!displayValue) return value;
    const trimmedVal = String(value).trim();
    const trimmedDisp = String(displayValue).trim();
    if (trimmedDisp.startsWith(trimmedVal)) return trimmedDisp;
    return `${trimmedVal} - ${trimmedDisp}`;
  }, [value, displayValue]);

  return (
    <LookupField
      value={value}
      displayValue={formattedDisplayValue}
      compact
      placeholder="Select Transporter"
      valueField="TRANSPORTER_CODE"
      displayFields={["TRANSPORTER_CODE", "TRANSPORTER_NAME"]}
      columns={[
        { field: "TRANSPORTER_CODE", header: "Transp. Code" },
        { field: "TRANSPORTER_NAME", header: "Transporter Name" },
      ]}
      loadOptions={(query) => loadFreightLookup("freight_transporter", companyCode, query)}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function CurrencyLookup({
  companyCode,
  value,
  onChange,
  disabled,
}: {
  companyCode: string;
  value: string;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
}) {
  return (
    <LookupField
      value={value}
      compact
      placeholder="Currency"
      valueField="CURR_CODE"
      displayFields={["CURR_CODE", "CURR_NAME"]}
      columns={[
        { field: "CURR_CODE", header: "Currency" },
        { field: "CURR_NAME", header: "Name" },
        { field: "EX_RATE", header: "Ex. Rate" },
      ]}
      loadOptions={(query) => loadFreightLookup("freight_currency", companyCode, query)}
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

function emptyLine(srno: number, header?: LookupRow | null): ActivityLine {
  const jobCurr = lookupText(header, "curr_code") || "OMR";
  const jobEx = lookupText(header, "ex_rate") || "1";
  return {
    srno: String(srno),
    act_code: "",
    activity: "",
    other_services: "",
    quantity: "1",
    bill_rate: "0",
    bill: "0",
    actual_cost: "0",
    broker_code: "",
    broker_name: "",
    partners_price: "0",
    transporter_code: "",
    transporter_name: "",
    vehicle_no: "",
    transport_price: "0",
    confirmed: "Y",
    print_flag: "Y",
    payment_mode: "",
    div_code: "",
    remarks: "",
    bill_curr_code: jobCurr,
    bill_ex_rate: jobEx,
    bill_rate_oc: "0",
    bill_oc: "0",
    ac_curr_code: jobCurr,
    ac_ex_rate: jobEx,
    actual_cost_oc: "0",
    partner_curr_code: jobCurr,
    partner_ex_rate: jobEx,
    partner_price_oc: "0",
    tp_curr_code: jobCurr,
    tp_ex_rate: jobEx,
    transport_price_oc: "0",
    tx_cat_code: "",
    tx_compntcat_code_1: "",
    tx_compnt_perc_1: "",
    tx_compnt_amt_1: "",
    tx_compnt_lcuramt_1: "",
    tx_compnt_1_expmt: "N",
    tx_cat_code_cost: "",
    tx_compntcat_code_1_cost: "",
    tx_compnt_perc_1_cost: "",
    tx_compnt_amt_1_cost: "",
    tx_compnt_lcuramt_1_cost: "",
    tx_compnt_1_expmt_cost: "N",
  };
}

function toLine(row: LookupRow, index: number, header?: LookupRow | null): ActivityLine {
  const base = emptyLine(index + 1, header);
  const line = Object.fromEntries(Object.keys(base).map((key) => [key, lookupText(row, key) || (base as any)[key]])) as ActivityLine;
  // Fallbacks for display names
  line.broker_name = lookupText(row, "broker_name") || lookupText(row, "agent_name") || "";
  line.transporter_name = lookupText(row, "transporter_name") || "";
  return line;
}

function recalc(line: ActivityLine) {
  const qty = numberValue(line.quantity) || 1;
  const billRate = numberValue(line.bill_rate);
  const bill = qty * billRate;
  return recalcSalesTax({
    ...line,
    bill: String(bill),
    bill_oc: line.bill_curr_code && line.bill_ex_rate && numberValue(line.bill_ex_rate) > 0 && line.bill_curr_code !== "OMR"
      ? String(bill / numberValue(line.bill_ex_rate))
      : String(bill),
  });
}

function TaxTreatmentSelect({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <select className="h-7 min-w-0 rounded-md border border-input bg-background px-1 text-xs" value={value || "N"} disabled={disabled} onChange={(event) => onChange(event.target.value)} title="Tax treatment">
      <option value="S">Standard</option>
      <option value="Z">Zero</option>
      <option value="E">Exempt</option>
      <option value="N">No Tax</option>
    </select>
  );
}

function recalcSalesTax(line: ActivityLine) {
  const amount = line.tx_compnt_1_expmt === "S" ? numberValue(line.bill) * numberValue(line.tx_compnt_perc_1) / 100 : 0;
  return { ...line, tx_compnt_amt_1: String(amount), tx_compnt_lcuramt_1: String(amount) };
}

function recalcCostTax(line: ActivityLine) {
  const amount = line.tx_compnt_1_expmt_cost === "S" ? numberValue(line.actual_cost) * numberValue(line.tx_compnt_perc_1_cost) / 100 : 0;
  return { ...line, tx_compnt_amt_1_cost: String(amount), tx_compnt_lcuramt_1_cost: String(amount) };
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

