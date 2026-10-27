import { freightTextLimit, freightValidationError, assertFreightRecords } from "../../utils/freightValidation";
import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calculator, CheckCircle2, CheckSquare, Edit2, FileText, List, ListPlus, Plus, Printer, RefreshCw, Save, Search, Trash2, TrendingUp, X } from "lucide-react";
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

import { Dialog } from "../../components/ui/Dialog";
import { Coins, Globe, Percent, Receipt } from "lucide-react";

type ViewMode = "list" | "editor";
type ActivityScreen = "jobsheet" | "activities";
type Notice = { type: "success" | "error"; text: string } | null;

type ActivityLine = {
  srno: string;
  act_code: string;
  activity: string;
  other_services: string;
  consolidated_invno?: string;
  pi_no?: string;
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
  tx_cat_name?: string;
  tx_compntcat_code_1: string;
  tx_compntcat_name_1?: string;
  tx_compnt_perc_1: string;
  tx_compnt_amt_1: string;
  tx_compnt_lcuramt_1: string;
  tx_compnt_1_expmt: string;
  // Cost Tax Components
  tx_cat_code_cost: string;
  tx_cat_name_cost?: string;
  tx_compntcat_code_1_cost: string;
  tx_compntcat_name_1_cost?: string;
  tx_compnt_perc_1_cost: string;
  tx_compnt_amt_1_cost: string;
  tx_compnt_lcuramt_1_cost: string;
  tx_compnt_1_expmt_cost: string;
  tx_compnt_lcuramt_2_cost?: string;
  tx_compnt_lcuramt_3_cost?: string;
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
  const [activeTaxIndex, setActiveTaxIndex] = useState<number | null>(null);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [lineSearch, setLineSearch] = useState("");
  const [masterCurrency, setMasterCurrency] = useState<{ curr_code: string; ex_rate: string }>({ curr_code: "OMR", ex_rate: "1" });
  const [bookedPIList, setBookedPIList] = useState<any[]>([]);
  const [costBookingModalOpen, setCostBookingModalOpen] = useState(false);

  const getBookedPIForLine = useCallback((costType: "Agent Cost" | "Transporter Cost" | "Other Cost", actCode: string, amount: number) => {
    if (!bookedPIList.length || !amount) return null;
    const match = bookedPIList.find((pi: any) => {
      const rem = String(pi.REMARKS || "").toUpperCase();
      const typeMatch =
        costType === "Agent Cost"
          ? rem.includes("AGENT") || rem.includes("BROKER")
          : costType === "Transporter Cost"
          ? rem.includes("TRANS")
          : rem.includes("OTHER") || rem.includes("ACTUAL");
      if (!typeMatch) return false;
      const actMatch = rem.includes(actCode.toUpperCase());
      if (!actMatch) return false;
      const amtMatch = Math.abs(Number(pi.AMOUNT) - amount) < 0.001;
      return amtMatch;
    });
    return match ? String(match.DOC_NO) : null;
  }, [bookedPIList]);

  useEffect(() => {
    if (!companyCode) return;
    loadFreightLookup("freight_currency", companyCode, "").then((currencies) => {
      const base = currencies.find((c) => Number(lookupText(c, "ex_rate")) === 1) || currencies[0];
      if (base) {
        setMasterCurrency({
          curr_code: lookupText(base, "curr_code") || "OMR",
          ex_rate: lookupText(base, "ex_rate") || "1",
        });
      }
    }).catch(() => {});
  }, [companyCode]);

  const baseCurrency = lookupText(header, "curr_code") || masterCurrency.curr_code || "OMR";
  const companyName = String(userRecord.company_name || userRecord.COMPANY_NAME || companyCode);

  const filteredLines = useMemo(() => {
    if (!lineSearch.trim()) return lines;
    const q = lineSearch.toLowerCase();
    return lines.filter((l) =>
      (l.act_code || "").toLowerCase().includes(q) ||
      (l.activity || "").toLowerCase().includes(q) ||
      (l.other_services || "").toLowerCase().includes(q) ||
      (l.broker_name || "").toLowerCase().includes(q) ||
      (l.broker_code || "").toLowerCase().includes(q) ||
      (l.transporter_name || "").toLowerCase().includes(q) ||
      (l.transporter_code || "").toLowerCase().includes(q)
    );
  }, [lines, lineSearch]);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F3") {
        e.preventDefault();
        if (lines.length > 0) {
          const idx = activeFcIndex ?? selectedLineIndex ?? 0;
          if (lines[idx]) setActiveFcIndex(idx);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFcIndex, selectedLineIndex, lines]);

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
      const bookedPi = (response.data.data as any)?.booked_pi || [];
      setBookedPIList(Array.isArray(bookedPi) ? bookedPi : []);
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
    <section className="finance-document-ui freight-ui-standard grid gap-2 freight-job-ops-screen min-w-0">
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
                {dirty && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Unsaved changes
                  </span>
                )}
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

      <div className="commercial-lines-card rounded-md border bg-card shadow-xs">
        {/* Finance Line Actions Header */}
        <div className="finance-line-actions flex flex-nowrap items-center justify-between gap-1.5 px-2 py-1 bg-slate-50/90 border-b border-slate-200 min-w-0 overflow-hidden">
          <div className="finance-line-actions-left flex items-center gap-1.5 min-w-0 shrink">
            <span className="finance-line-actions-icon p-1 bg-blue-100/70 text-[#00378C] rounded shrink-0">
              <List size={13} />
            </span>
            <span className="finance-line-actions-title font-bold text-xs text-slate-800 uppercase tracking-wide whitespace-nowrap shrink-0">
              Service & Activity Lines
            </span>
            <span className="finance-line-actions-badge text-[10px] font-semibold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
              {lineSearch.trim()
                ? `${filteredLines.length}/${lines.length} lines`
                : `${lines.length} ${lines.length === 1 ? "line" : "lines"}`}
            </span>

            {/* Inline KPI Strip (wide screens only to prevent wrapping) */}
            <div className="hidden xl:flex items-center gap-1 ml-1 text-[10px] whitespace-nowrap shrink-0">
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 font-medium text-blue-900">
                <span className="text-blue-700 font-bold">Rev:</span> {money(totals.revenue)} {baseCurrency}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-medium text-emerald-900">
                <span className="text-emerald-700 font-bold">Tax:</span> {money(totals.tax)} {baseCurrency}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-medium text-slate-800">
                <span className="text-slate-600 font-bold">Exp:</span> {money(totals.expense)} {baseCurrency}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-bold ${
                  totals.profit >= 0
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-rose-50 border-rose-300 text-rose-800"
                }`}
              >
                <span>Profit:</span> {money(totals.profit)} {baseCurrency}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-nowrap">
            {/* Search Filter input */}
            <div className="bisc-table-search relative flex items-center shrink-0">
              <Search size={12} className="bisc-table-search-icon absolute left-2 text-slate-400" />
              <input
                className="bisc-search-input h-7 pl-6 pr-5 text-xs rounded border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00378C] w-28 sm:w-32 md:w-36 transition-all"
                type="text"
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                placeholder="Search activities..."
              />
              {lineSearch && (
                <button
                  type="button"
                  onClick={() => setLineSearch("")}
                  className="bisc-table-search-clear absolute right-1.5 text-slate-400 hover:text-slate-700"
                  title="Clear"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void populateFromQuotation()}
              disabled={saving || populating || isLineLocked || !lookupText(header, "quotation_ref")}
              title={
                lookupText(header, "quotation_ref")
                  ? `Load missing activities from ${lookupText(header, "quotation_ref")}`
                  : "Job has no quotation reference"
              }
              className="h-7 px-2 text-[11px] font-medium whitespace-nowrap shrink-0"
            >
              <ListPlus size={12} className="mr-1 shrink-0" /> {populating ? "..." : "Populate Quotation"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCostBookingModalOpen(true)}
              className="h-7 px-2.5 text-[11px] font-semibold text-[#00378C] border-blue-300 bg-blue-50/70 hover:bg-blue-100 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              title="View PowerBuilder dw_3 Cost Booking Breakdown & Purchase Invoices"
            >
              <Receipt size={12} className="mr-1 text-[#00378C] shrink-0" /> Cost Bookings (dw_3)
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={addLine}
              disabled={isLineLocked}
              className="h-7 px-2 text-[11px] font-semibold !bg-[#00378C] !text-white !border-[#002d72] hover:!bg-[#002d72] shadow-xs cursor-pointer whitespace-nowrap shrink-0"
              title="Add activity line (Alt + A)"
            >
              <Plus size={12} className="mr-1 shrink-0" /> Add Line
            </Button>
          </div>
        </div>

        {/* Scrollable Table matching Finance Detail Tables */}
        <div className="commercial-lines-scroll overflow-auto max-h-[calc(100vh-250px)] min-h-[320px]">
          <table className="finance-lines-table w-full text-xs min-w-[1360px] border-collapse">
            <thead className="sticky top-0 shadow-md z-10 whitespace-nowrap">
              {/* Tier 1 Header: Group Categories (PB Income & Expense Division) in matching Corporate Navy */}
              <tr className="text-[11px] font-extrabold uppercase tracking-wider text-center select-none bg-[#002d72] text-white border-b border-[#002052]">
                <th colSpan={4} className="bg-[#00245e] text-white/95 border-r border-white/20 py-1.5 px-2">
                  Service & Activity Details
                </th>
                <th colSpan={2} className="bg-[#00378C] text-white border-r border-white/20 py-1.5 px-2">
                  Income (Billing)
                </th>
                <th colSpan={5} className="bg-[#002d72] text-white border-r border-white/20 py-1.5 px-2">
                  Expense (Costs & Vendors)
                </th>
                <th colSpan={1} className="bg-[#00378C] text-white border-r border-white/20 py-1.5 px-2">
                  Tax
                </th>
                <th colSpan={1} className="bg-[#00245e] text-white/95 border-r border-white/20 py-1.5 px-2" title="Customer Billing Sales Invoice">
                  Invoice
                </th>
                <th colSpan={1} className="bg-[#00245e] text-white/95 py-1.5 px-2">
                  Actions
                </th>
              </tr>

              {/* Tier 2 Header: Individual Columns matching Finance Detail Tables */}
              <tr className="bg-[#00378C] text-[11px] font-semibold text-white uppercase tracking-wider shadow-xs">
                <th className="finance-sticky-col finance-col-no px-1.5 py-2 text-center w-8 bg-[#00378C] text-white border-r border-white/15" title="Tick / Select">
                  Tick
                </th>
                <th className="px-2 py-2 text-center w-9 bg-[#00378C] text-white border-r border-white/15">#</th>
                <th className="px-2 py-2 text-left min-w-[220px] text-white border-r border-white/15">Activity / Description</th>
                <th className="px-2 py-2 text-right w-[60px] text-white border-r border-white/15" title="Type of Measure is Quantity or Volume or Weight">Q* / V / W</th>
                {/* Income Columns */}
                <th className="px-2 py-2 text-right w-[85px] bg-[#003380] text-blue-100 border-r border-white/15">Rate</th>
                <th className="px-2 py-2 text-right w-[95px] bg-[#003380] text-white font-bold border-r border-white/15">Bill Amt</th>
                {/* Expense Columns */}
                <th className="px-2 py-2 text-right w-[95px] bg-[#002868] text-amber-200 font-extrabold border-r border-white/15" title="Other Cost Amt (PB actual_cost)">
                  Other Cost
                </th>
                <th className="px-2 py-2 text-left w-[165px] bg-[#002f78] text-white/95 border-r border-white/15">Agent</th>
                <th className="px-2 py-2 text-right w-[85px] bg-[#002f78] text-white border-r border-white/15">Agent Price</th>
                <th className="px-2 py-2 text-left w-[165px] bg-[#002f78] text-white/95 border-r border-white/15">Transporter</th>
                <th className="px-2 py-2 text-right w-[85px] bg-[#002f78] text-white border-r border-white/15">Transp Price</th>
                {/* Tax */}
                <th className="px-2 py-2 text-center w-[110px] text-emerald-200 bg-[#00378C] border-r border-white/15">Tax / VAT</th>
                {/* Customer Sales Invoice (PowerBuilder consolidated_invno) */}
                <th className="px-2 py-2 text-center w-[120px] bg-[#681822] text-rose-100 border-r border-white/15" title="Customer Freight Invoice (PB consolidated_invno)">Invoice No</th>
                {/* Action */}
                <th className="px-2 py-2 text-center w-[75px] text-white bg-[#00378C]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLines.map((line) => {
                const index = lines.indexOf(line);
                const isInvalid = invalidLineIndices.includes(index);
                const hasForeignCurrency = Boolean(line.bill_curr_code && line.bill_curr_code !== "OMR");
                const hasTax =
                  numberValue(line.tx_compnt_amt_1) > 0 ||
                  numberValue(line.tx_compnt_amt_1_cost) > 0 ||
                  line.tx_compnt_1_expmt === "S";

                const agentCostVal = numberValue(line.partners_price);
                const transpCostVal = numberValue(line.transport_price);
                const actualCostVal = numberValue(line.actual_cost);
                const agentPi = getBookedPIForLine("Agent Cost", line.act_code, agentCostVal);
                const transpPi = getBookedPIForLine("Transporter Cost", line.act_code, transpCostVal);
                const otherPi = getBookedPIForLine("Other Cost", line.act_code, actualCostVal);

                return (
                  <tr
                    key={`${line.srno}-${index}`}
                    onClick={() => setSelectedLineIndex(index)}
                    onFocusCapture={() => setSelectedLineIndex(index)}
                    className={`transition-colors ${
                      selectedLineIndex === index
                        ? "bg-blue-50/70 border-l-4 border-l-[#00378C]"
                        : isInvalid
                        ? "bg-rose-50/70 border-l-4 border-l-rose-500 ring-1 ring-rose-400"
                        : index % 2 === 1
                        ? "bg-slate-50/40 hover:bg-blue-50/40"
                        : "bg-white hover:bg-blue-50/40"
                    }`}
                  >
                    {/* Row Tick & # */}
                    <td className="finance-sticky-col finance-col-no px-1 py-1 text-center w-8 border-r border-slate-200">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={line.confirmed === "Y"}
                        disabled={isLineLocked}
                        onChange={(e) => updateLine(index, { confirmed: e.target.checked ? "Y" : "N" })}
                        title="Tick / Confirm line"
                      />
                    </td>
                    <td className="px-2 py-1 text-center font-mono text-[11px] font-semibold text-slate-500 border-r border-slate-200">
                      {index + 1}
                    </td>

                    {/* Activity / Description (Unified Column) */}
                    <td className="px-1.5 py-1 min-w-[220px] max-w-[280px] border-r border-slate-200">
                      <div className="flex flex-col gap-1">
                        <ActivityLookup
                          value={line.act_code}
                          displayValue={line.activity}
                          companyCode={companyCode}
                          disabled={isLineLocked}
                          onChange={async (value, row) => {
                            const newBillRate = lookupText(row || undefined, "bill");
                            const newCost = lookupText(row || undefined, "cost");
                            const divCode = line.div_code || lookupText(header, "div_code") || "10";
                            const txCat = line.tx_cat_code || lookupText(header, "tx_cat_code") || "11";
                            const actName = lookupText(row || undefined, "activity");

                            let updatedLine: ActivityLine = recalc({
                              ...line,
                              act_code: value,
                              activity: actName,
                              other_services: actName || line.other_services,
                              bill_rate: newBillRate !== "" ? newBillRate : line.bill_rate,
                              actual_cost: newCost !== "" ? newCost : line.actual_cost,
                              div_code: divCode,
                              tx_cat_code: txCat,
                            });

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
                                    tx_compntcat_name_1: lookupText(firstComp, "tx_compntcat_name"),
                                    tx_compnt_perc_1: taxPerc,
                                    tx_compnt_1_expmt: isStandard,
                                  });
                                }
                              } catch (err) {
                                console.warn("Could not auto-populate tax components:", err);
                              }
                            }

                            updateLine(index, updatedLine);
                          }}
                        />
                        <input
                          className="h-6 w-full text-[11px] px-2 rounded border border-slate-300 bg-white/70 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00378C] disabled:cursor-not-allowed disabled:opacity-50 font-sans"
                          placeholder="Activity remarks / description..."
                          value={line.other_services}
                          disabled={isLineLocked}
                          onChange={(event) => updateLine(index, { other_services: event.target.value })}
                          maxLength={freightTextLimit("TN_INVOICE_DET", "other_services")}
                        />
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="px-1.5 py-1 w-[55px] border-r border-slate-200">
                      <MoneyInput
                        value={line.quantity}
                        disabled={isLineLocked}
                        onChange={(value) => updateLine(index, recalc({ ...line, quantity: value }))}
                      />
                    </td>

                    {/* Rate (OMR) */}
                    <td
                      className="px-1.5 py-1 w-[85px] border-r border-slate-200"
                      title={
                        hasForeignCurrency
                          ? `Base: OMR ${money(line.bill_rate)} | Foreign: ${money(line.bill_rate_oc)} ${line.bill_curr_code} (Ex: ${line.bill_ex_rate})`
                          : undefined
                      }
                    >
                      <MoneyInput
                        value={line.bill_rate}
                        disabled={isLineLocked}
                        onChange={(value) => {
                          const newRate = numberValue(value);
                          const qty = numberValue(line.quantity) || 1;
                          const bill = round3(qty * newRate);
                          const billEx = numberValue(line.bill_ex_rate) || 1;
                          const isFc = Boolean(line.bill_curr_code && line.bill_curr_code !== "OMR");
                          const newRateOc = isFc && billEx > 0 ? round3(newRate / billEx) : newRate;
                          const newBillOc = isFc && billEx > 0 ? round3(bill / billEx) : bill;
                          updateLine(
                            index,
                            recalcSalesTax({
                              ...line,
                              bill_rate: value,
                              bill: String(bill),
                              bill_rate_oc: String(newRateOc),
                              bill_oc: String(newBillOc),
                            })
                          );
                        }}
                      />
                    </td>

                    {/* Revenue (OMR) */}
                    <td
                      className="px-1.5 py-1 w-[95px] border-r border-slate-200"
                      title={
                        hasForeignCurrency
                          ? `Base: OMR ${money(line.bill)} | Foreign: ${money(line.bill_oc)} ${line.bill_curr_code} (Ex: ${line.bill_ex_rate})`
                          : undefined
                      }
                    >
                      <MoneyInput
                        value={line.bill}
                        disabled={isLineLocked}
                        onChange={(value) => {
                          const newBill = numberValue(value);
                          const qty = numberValue(line.quantity) || 1;
                          const newRate = qty > 0 ? round3(newBill / qty) : newBill;
                          const billEx = numberValue(line.bill_ex_rate) || 1;
                          const isFc = Boolean(line.bill_curr_code && line.bill_curr_code !== "OMR");
                          const newBillOc = isFc && billEx > 0 ? round3(newBill / billEx) : newBill;
                          const newRateOc = isFc && billEx > 0 ? round3(newRate / billEx) : newRate;
                          updateLine(
                            index,
                            recalcSalesTax({
                              ...line,
                              bill: value,
                              bill_rate: String(newRate),
                              bill_oc: String(newBillOc),
                              bill_rate_oc: String(newRateOc),
                            })
                          );
                        }}
                      />
                    </td>

                    {/* Other Cost Amt (OMR) - PB actual_cost with distinct yellow styling */}
                    <td
                      className="px-1.5 py-1 w-[95px] bg-amber-50/60 border-r border-slate-200"
                      title={
                        line.ac_curr_code && line.ac_curr_code !== "OMR"
                          ? `Other Cost: OMR ${money(line.actual_cost)} | Foreign: ${money(line.actual_cost_oc)} ${line.ac_curr_code} (Ex: ${line.ac_ex_rate})`
                          : "Other Cost Amount (actual_cost)"
                      }
                    >
                      <MoneyInput
                        value={line.actual_cost}
                        disabled={isLineLocked}
                        className="!bg-[#fef9c3] !border-amber-300 text-amber-950 font-bold focus:!bg-[#fef08a]"
                        onChange={(value) => {
                          const newCost = numberValue(value);
                          const acEx = numberValue(line.ac_ex_rate) || 1;
                          const isFc = Boolean(line.ac_curr_code && line.ac_curr_code !== "OMR");
                          const newCostOc = isFc && acEx > 0 ? round3(newCost / acEx) : newCost;
                          updateLine(
                            index,
                            recalcCostTax({
                              ...line,
                              actual_cost: value,
                              actual_cost_oc: String(newCostOc),
                            })
                          );
                        }}
                      />
                      {otherPi && (
                        <span className="block mt-0.5 text-[9px] font-mono font-bold text-sky-800 bg-sky-50 border border-sky-300 rounded px-1 text-center shadow-2xs" title={`Other Cost Booked in PI #${otherPi}`}>
                          PI: {otherPi}
                        </span>
                      )}
                    </td>

                    {/* Agent / Broker */}
                    <td className="px-1.5 py-1 w-[165px] border-r border-slate-200">
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
                    </td>

                    {/* Agent Price (OMR) */}
                    <td
                      className="px-1.5 py-1 w-[85px] border-r border-slate-200"
                      title={
                        line.partner_curr_code && line.partner_curr_code !== "OMR"
                          ? `Base Agent: OMR ${money(line.partners_price)} | Foreign: ${money(line.partner_price_oc)} ${line.partner_curr_code} (Ex: ${line.partner_ex_rate})`
                          : undefined
                      }
                    >
                      <MoneyInput
                        value={line.partners_price}
                        disabled={isLineLocked}
                        onChange={(value) => {
                          const newPrice = numberValue(value);
                          const pEx = numberValue(line.partner_ex_rate) || 1;
                          const isFc = Boolean(line.partner_curr_code && line.partner_curr_code !== "OMR");
                          const newPriceOc = isFc && pEx > 0 ? round3(newPrice / pEx) : newPrice;
                          updateLine(index, {
                            ...line,
                            partners_price: value,
                            partner_price_oc: String(newPriceOc),
                          });
                        }}
                      />
                      {agentPi && (
                        <span className="block mt-0.5 text-[9px] font-mono font-bold text-sky-800 bg-sky-50 border border-sky-300 rounded px-1 text-center shadow-2xs" title={`Agent Booked in PI #${agentPi}`}>
                          PI: {agentPi}
                        </span>
                      )}
                    </td>

                    {/* Transporter */}
                    <td className="px-1.5 py-1 w-[165px] border-r border-slate-200">
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
                    </td>

                    {/* Transporter Price (OMR) */}
                    <td
                      className="px-1.5 py-1 w-[85px]"
                      title={
                        line.tp_curr_code && line.tp_curr_code !== "OMR"
                          ? `Base Transp: OMR ${money(line.transport_price)} | Foreign: ${money(line.transport_price_oc)} ${line.tp_curr_code} (Ex: ${line.tp_ex_rate})`
                          : undefined
                      }
                    >
                      <MoneyInput
                        value={line.transport_price}
                        disabled={isLineLocked}
                        onChange={(value) => {
                          const newPrice = numberValue(value);
                          const tpEx = numberValue(line.tp_ex_rate) || 1;
                          const isFc = Boolean(line.tp_curr_code && line.tp_curr_code !== "OMR");
                          const newPriceOc = isFc && tpEx > 0 ? round3(newPrice / tpEx) : newPrice;
                          updateLine(index, {
                            ...line,
                            transport_price: value,
                            transport_price_oc: String(newPriceOc),
                          });
                        }}
                      />
                      {transpPi && (
                        <span className="block mt-0.5 text-[9px] font-mono font-bold text-sky-800 bg-sky-50 border border-sky-300 rounded px-1 text-center shadow-2xs" title={`Transporter Booked in PI #${transpPi}`}>
                          PI: {transpPi}
                        </span>
                      )}
                    </td>

                    {/* Tax (VAT) Dedicated Button */}
                    <td className="px-1.5 py-1 w-[110px] border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() => setActiveTaxIndex(index)}
                        className={`h-7 w-full px-1.5 rounded border flex items-center justify-between gap-1 text-[11px] font-mono transition-all cursor-pointer shadow-2xs ${
                          hasTax
                            ? "border-emerald-400 bg-emerald-50/90 text-emerald-900 font-bold hover:bg-emerald-100"
                            : "border-dashed border-slate-300 bg-slate-50/60 text-slate-500 hover:border-slate-400 hover:bg-slate-100"
                        }`}
                        title={
                          hasTax
                            ? `Sales Tax: ${line.tx_compnt_perc_1 || 0}% | OMR ${money(line.tx_compnt_lcuramt_1)}${
                                hasForeignCurrency ? ` (${money(line.tx_compnt_amt_1)} ${line.bill_curr_code})` : ""
                              }`
                            : "Click to configure Tax & VAT"
                        }
                      >
                        <span className="flex items-center gap-0.5 font-bold">
                          <Percent size={11} className={hasTax ? "text-emerald-600" : "text-slate-400"} />
                          <span>{numberValue(line.tx_compnt_perc_1) > 0 ? `${line.tx_compnt_perc_1}%` : "0%"}</span>
                        </span>
                        <span className="text-[10.5px] tabular-nums font-semibold truncate text-right">
                          {hasTax ? money(line.tx_compnt_lcuramt_1) : "No Tax"}
                        </span>
                      </button>
                    </td>

                    {/* Freight Invoice No (Red badge) */}
                    <td className="px-1.5 py-1 text-center w-[110px] border-r border-slate-200">
                      {line.consolidated_invno ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 font-mono shadow-2xs"
                          title={`Freight Invoice #${line.consolidated_invno}`}
                        >
                          {line.consolidated_invno}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium italic">—</span>
                      )}
                    </td>



                    {/* Action Buttons: Currency Calculator & Delete */}
                    <td className="px-1.5 py-1 w-[75px] text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className={`h-7 w-7 rounded border flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0 ${
                            hasForeignCurrency
                              ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 ring-1 ring-amber-300"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          }`}
                          title={
                            hasForeignCurrency
                              ? `Currency Calculator (${line.bill_curr_code} @ ${line.bill_ex_rate}) - Click to view/edit`
                              : "Currency Calculator (Click to enter foreign currency)"
                          }
                          onClick={() => setActiveFcIndex(index)}
                        >
                          <Calculator size={13} className={hasForeignCurrency ? "text-amber-700" : "text-slate-500"} />
                        </button>

                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 shrink-0 cursor-pointer"
                          title="Remove line"
                          disabled={isLineLocked}
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!lines.length && (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">No service & activity lines yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "+ Add Line" to add services or "Populate Quotation" to import approved activities.
                    </p>
                  </td>
                </tr>
              )}

              {lines.length > 0 && filteredLines.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No activity lines match "<strong>{lineSearch}</strong>"
                  </td>
                </tr>
              )}
            </tbody>

            {/* Pinned Column Totals Footer */}
            {lines.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-100/95 backdrop-blur-xs text-[11px] font-bold text-slate-800 border-t-2 border-slate-300 shadow-xs z-10 whitespace-nowrap">
                <tr>
                  <td className="px-1 py-1.5 text-center text-slate-400">-</td>
                  <td className="px-1 py-1.5 text-center text-slate-400">-</td>
                  <td className="px-3 py-1.5 text-left font-extrabold uppercase text-slate-600">
                    Totals ({lines.length} {lines.length === 1 ? "line" : "lines"}):
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">-</td>
                  {/* Income Totals */}
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">-</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold text-blue-900 bg-blue-50/70 border-r border-slate-200">
                    {money(totals.incomeBill)}
                  </td>
                  {/* Expense Totals */}
                  <td className="px-2 py-1.5 text-right font-mono font-bold text-amber-950 bg-amber-100/80 border-r border-amber-300">
                    {money(totals.expenseOthers)}
                  </td>
                  <td className="px-2 py-1.5 text-left text-slate-400">-</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-700 bg-amber-50/40 border-r border-slate-200">
                    {money(totals.expenseAgent)}
                  </td>
                  <td className="px-2 py-1.5 text-left text-slate-400">-</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-700 bg-amber-50/40 border-r border-slate-200">
                    {money(totals.expenseTransport)}
                  </td>
                  {/* Tax Total */}
                  <td className="px-2 py-1.5 text-center font-mono font-bold text-emerald-800 bg-emerald-50/80 border-r border-slate-200">
                    {money(totals.tax)}
                  </td>
                  {/* Customer Sales Invoice Total */}
                  <td className="px-2 py-1.5 text-center text-slate-400 border-r border-slate-200">-</td>
                  <td className="px-2 py-1.5 text-center text-[10px] text-slate-400 font-mono">
                    —
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PowerBuilder 2D Financial Summary Matrix & Operational Strip */}
        <div className="border-t border-slate-200 bg-slate-50/80 p-3 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-medium text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200 shadow-2xs">
              <span className="font-extrabold text-[#00378C]">* Q / V / W :</span>
              <span>Type of Measure is Quantity or Volume or Weight</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200">
              <span><strong className="text-slate-700">Ref:</strong> {lookupText(header, "customer_ref") || lookupText(header, "ref_no") || "-"}</span>
              <span>•</span>
              <span><strong className="text-slate-700">Confirm Date:</strong> {formatDate(lookupText(header, "confirm_date")) || "Pending"}</span>
              <span>•</span>
              <span><strong className="text-slate-700">GRN Date:</strong> {formatDate(lookupText(header, "grn_date")) || "-"}</span>
              <span>•</span>
              <span>
                <strong className="text-slate-700">Status:</strong>{" "}
                <span className={`font-semibold ${lookupText(header, "confirm_date") ? "text-emerald-700" : "text-amber-700"}`}>
                  {lookupText(header, "confirm_date") ? "Confirmed" : "Draft / Open"}
                </span>
              </span>
            </div>
          </div>

          {/* 2D Financial Matrix Card matching PowerBuilder dw_ft_service_activities_dtl */}
          <div className="overflow-x-auto w-full xl:w-auto rounded-md border border-slate-300 bg-white shadow-xs">
            <table className="text-xs border-collapse font-sans text-right min-w-[580px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100/90 text-[11px]">
                  <th className="px-3 py-1 text-left font-bold text-slate-600 border-r border-slate-200">Category</th>
                  <th colSpan={2} className="px-3 py-1 text-center font-bold text-blue-800 bg-blue-50/80 border-r border-slate-200">Income</th>
                  <th colSpan={3} className="px-3 py-1 text-center font-bold text-amber-800 bg-amber-50/80 border-r border-slate-200">Expense</th>
                  <th className="px-3 py-1 text-center font-bold text-emerald-800 bg-emerald-50/80">Profit</th>
                </tr>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                  <th className="px-3 py-0.5 text-left border-r border-slate-200 text-slate-500">Type</th>
                  <th className="px-2.5 py-0.5 border-r border-slate-200 bg-blue-50/30">Others</th>
                  <th className="px-2.5 py-0.5 border-r border-slate-200 bg-blue-50/30">Bill</th>
                  <th className="px-2.5 py-0.5 border-r border-slate-200 bg-amber-50/30">Others</th>
                  <th className="px-2.5 py-0.5 border-r border-slate-200 bg-amber-50/30">Agent</th>
                  <th className="px-2.5 py-0.5 border-r border-slate-200 bg-amber-50/30">Transporter</th>
                  <th className="px-3 py-0.5 text-emerald-800 bg-emerald-50/30">Net Profit</th>
                </tr>
              </thead>
              <tbody className="text-[11px] font-mono tabular-nums divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-1 text-left font-sans font-bold text-slate-700 border-r border-slate-200">Amount</td>
                  <td className="px-2.5 py-1 text-slate-600 border-r border-slate-200">{money(totals.incomeOthers)}</td>
                  <td className="px-2.5 py-1 font-bold text-blue-900 border-r border-slate-200">{money(totals.incomeBill)}</td>
                  <td className="px-2.5 py-1 text-amber-950 bg-amber-50/50 font-semibold border-r border-slate-200">{money(totals.expenseOthers)}</td>
                  <td className="px-2.5 py-1 text-slate-700 border-r border-slate-200">{money(totals.expenseAgent)}</td>
                  <td className="px-2.5 py-1 text-slate-700 border-r border-slate-200">{money(totals.expenseTransport)}</td>
                  <td className={`px-3 py-1 font-bold ${totals.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {money(totals.profit)}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50 bg-slate-50/30">
                  <td className="px-3 py-1 text-left font-sans font-bold text-slate-700 border-r border-slate-200">Total TAX :</td>
                  <td className="px-2.5 py-1 text-slate-500 border-r border-slate-200">{money(totals.incomeOthersTax)}</td>
                  <td className="px-2.5 py-1 font-semibold text-emerald-800 border-r border-slate-200">{money(totals.incomeBillTax)}</td>
                  <td className="px-2.5 py-1 text-slate-500 border-r border-slate-200">{money(totals.expenseOthersTax)}</td>
                  <td className="px-2.5 py-1 text-slate-500 border-r border-slate-200">{money(totals.expenseAgentTax)}</td>
                  <td className="px-2.5 py-1 text-slate-500 border-r border-slate-200">{money(totals.expenseTransportTax)}</td>
                  <td className="px-3 py-1 text-slate-400 font-sans text-center">-</td>
                </tr>
                <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                  <td className="px-3 py-1 text-left font-sans text-slate-900 border-r border-slate-200">Net Amount with TAX :</td>
                  <td className="px-2.5 py-1 text-slate-800 border-r border-slate-200">{money(totals.incomeOthersNet)}</td>
                  <td className="px-2.5 py-1 text-blue-950 font-extrabold border-r border-slate-200">{money(totals.incomeBillNet)}</td>
                  <td className="px-2.5 py-1 text-amber-950 bg-amber-100/50 font-bold border-r border-slate-200">{money(totals.expenseOthersNet)}</td>
                  <td className="px-2.5 py-1 text-slate-800 border-r border-slate-200">{money(totals.expenseAgentNet)}</td>
                  <td className="px-2.5 py-1 text-slate-800 border-r border-slate-200">{money(totals.expenseTransportNet)}</td>
                  <td className={`px-3 py-1 font-extrabold ${totals.profit >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
                    {money(totals.profit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Multi-Currency & Foreign Currency Exchange Dialog (PowerBuilder dw_7 / F3) */}
      {activeFcIndex !== null && lines[activeFcIndex] && (
        <Dialog
          open={true}
          title={`Currency Calculator & Exchange Rate (Line #${activeFcIndex + 1})`}
          onClose={() => setActiveFcIndex(null)}
          contentClassName="w-[min(96vw,720px)]"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-muted-foreground italic">
                * Main table displays Base Currency (OMR). Foreign amounts are converted via Exchange Rate: Base = Foreign × Ex. Rate.
              </span>
              <Button type="button" size="sm" onClick={() => setActiveFcIndex(null)}>
                Apply & Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-2.5 text-amber-950 flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="font-semibold text-amber-800">Activity: </span>
                <span className="font-mono font-bold text-foreground">
                  {lines[activeFcIndex].act_code} - {lines[activeFcIndex].activity || lines[activeFcIndex].other_services || "Service Line"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-amber-800 font-semibold">Qty: </span>
                  <span className="font-mono font-bold text-foreground">{lines[activeFcIndex].quantity || 1}</span>
                </div>
                <div>
                  <span className="text-amber-800 font-semibold">Base Currency: </span>
                  <span className="font-mono font-bold text-primary">{baseCurrency} ({companyName})</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 flex items-center justify-between">
              <span>Enter figures from your sheet in <strong>Foreign Currency (FC)</strong>. The system calculates and displays <strong>Base {baseCurrency}</strong> on the main table: <code className="bg-slate-200/80 px-1 rounded font-mono text-[10.5px]">Base ({baseCurrency}) = Foreign × Ex. Rate</code></span>
            </div>

            {/* 1. Sales / Billing Currency */}
            <div className="rounded-lg border border-border p-3 space-y-2.5 bg-card">
              <div className="font-bold text-primary flex items-center justify-between uppercase tracking-wider text-[11px]">
                <div className="flex items-center gap-2">
                  <span>1. Sales / Customer Billing Currency</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = lines[activeFcIndex];
                      const code = cur.bill_curr_code || "OMR";
                      const ex = cur.bill_ex_rate || "1";
                      const exNum = numberValue(ex) || 1;
                      const costOc = numberValue(cur.actual_cost_oc) || numberValue(cur.actual_cost);
                      const pOc = numberValue(cur.partner_price_oc) || numberValue(cur.partners_price);
                      const tpOc = numberValue(cur.transport_price_oc) || numberValue(cur.transport_price);

                      const costBase = round3(costOc * exNum);
                      const pBase = round3(pOc * exNum);
                      const tpBase = round3(tpOc * exNum);

                      updateLine(activeFcIndex, recalcCostTax(recalcSalesTax({
                        ...cur,
                        ac_curr_code: code,
                        ac_ex_rate: ex,
                        actual_cost_oc: String(costOc),
                        actual_cost: String(costBase),
                        partner_curr_code: code,
                        partner_ex_rate: ex,
                        partner_price_oc: String(pOc),
                        partners_price: String(pBase),
                        tp_curr_code: code,
                        tp_ex_rate: ex,
                        transport_price_oc: String(tpOc),
                        transport_price: String(tpBase),
                      })));
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 font-semibold cursor-pointer tracking-normal lowercase normal-case"
                    title="Copy Billing Currency and Exchange Rate to Cost, Agent, and Transporter"
                  >
                    Sync Currency to All Sections (Cost, Agent, Transp)
                  </button>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground lowercase">
                  base revenue: <strong className="text-foreground uppercase">{baseCurrency} {money(lines[activeFcIndex].bill)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Currency</label>
                  <CurrencyLookup
                    companyCode={companyCode}
                    value={lines[activeFcIndex].bill_curr_code}
                    disabled={isLineLocked}
                    onChange={(currCode, row) => {
                      const ex = lookupText(row, "ex_rate") || "1";
                      const exNum = numberValue(ex) || 1;
                      const cur = lines[activeFcIndex];
                      const qty = numberValue(cur.quantity) || 1;
                      // Entered sheet values
                      const billRateOc = numberValue(cur.bill_rate_oc) || numberValue(cur.bill_rate);
                      const billOc = round3(billRateOc * qty);
                      const costOc = numberValue(cur.actual_cost_oc) || numberValue(cur.actual_cost);
                      const pOc = numberValue(cur.partner_price_oc) || numberValue(cur.partners_price);
                      const tpOc = numberValue(cur.transport_price_oc) || numberValue(cur.transport_price);

                      // Convert foreign sheet values to Base Currency (OMR) via exchange rate
                      const billRateBase = round3(billRateOc * exNum);
                      const billBase = round3(billOc * exNum);
                      const costBase = round3(costOc * exNum);
                      const pBase = round3(pOc * exNum);
                      const tpBase = round3(tpOc * exNum);

                      updateLine(activeFcIndex, recalcCostTax(recalcSalesTax({
                        ...cur,
                        bill_curr_code: currCode,
                        bill_ex_rate: ex,
                        bill_rate_oc: String(billRateOc),
                        bill_oc: String(billOc),
                        bill_rate: String(billRateBase),
                        bill: String(billBase),
                        ac_curr_code: currCode,
                        ac_ex_rate: ex,
                        actual_cost_oc: String(costOc),
                        actual_cost: String(costBase),
                        partner_curr_code: currCode,
                        partner_ex_rate: ex,
                        partner_price_oc: String(pOc),
                        partners_price: String(pBase),
                        tp_curr_code: currCode,
                        tp_ex_rate: ex,
                        transport_price_oc: String(tpOc),
                        transport_price: String(tpBase),
                      })));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Ex. Rate</label>
                  <MoneyInput
                    value={lines[activeFcIndex].bill_ex_rate}
                    disabled={isLineLocked}
                    onChange={(val) => {
                      const newEx = numberValue(val) || 1;
                      const cur = lines[activeFcIndex];
                      const qty = numberValue(cur.quantity) || 1;
                      const billRateOc = numberValue(cur.bill_rate_oc) || numberValue(cur.bill_rate);
                      const billOc = round3(billRateOc * qty);
                      const billRateBase = round3(billRateOc * newEx);
                      const billBase = round3(billOc * newEx);
                      const costBase = round3((numberValue(cur.actual_cost_oc) || numberValue(cur.actual_cost)) * newEx);
                      const pBase = round3((numberValue(cur.partner_price_oc) || numberValue(cur.partners_price)) * newEx);
                      const tpBase = round3((numberValue(cur.transport_price_oc) || numberValue(cur.transport_price)) * newEx);

                      updateLine(activeFcIndex, recalcCostTax(recalcSalesTax({
                        ...cur,
                        bill_ex_rate: val,
                        bill_rate_oc: String(billRateOc),
                        bill_oc: String(billOc),
                        bill_rate: String(billRateBase),
                        bill: String(billBase),
                        ac_ex_rate: val,
                        actual_cost: String(costBase),
                        partner_ex_rate: val,
                        partners_price: String(pBase),
                        tp_ex_rate: val,
                        transport_price: String(tpBase),
                      })));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Rate ({lines[activeFcIndex].bill_curr_code || "FC"})</label>
                  <MoneyInput
                    value={lines[activeFcIndex].bill_rate_oc}
                    disabled={isLineLocked}
                    onChange={(val) => {
                      const rateOc = numberValue(val);
                      const qty = numberValue(lines[activeFcIndex].quantity) || 1;
                      const billOc = round3(qty * rateOc);
                      const ex = numberValue(lines[activeFcIndex].bill_ex_rate) || 1;
                      const rateBase = round3(rateOc * ex);
                      const billBase = round3(billOc * ex);
                      updateLine(activeFcIndex, recalcSalesTax({
                        ...lines[activeFcIndex],
                        bill_rate_oc: val,
                        bill_oc: String(billOc),
                        bill_rate: String(rateBase),
                        bill: String(billBase),
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Base Rate ({baseCurrency})</label>
                  <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                    {money(lines[activeFcIndex].bill_rate)}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Vendor / Actual Cost Currency */}
            <div className="rounded-lg border border-border p-3 space-y-2.5 bg-card">
              <div className="font-bold text-emerald-700 flex items-center justify-between uppercase tracking-wider text-[11px]">
                <span>2. Vendor / Actual Cost Currency</span>
                <span className="text-[11px] font-mono text-muted-foreground lowercase">
                  base cost: <strong className="text-foreground uppercase">{baseCurrency} {money(lines[activeFcIndex].actual_cost)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Cost Currency</label>
                  <CurrencyLookup
                    companyCode={companyCode}
                    value={lines[activeFcIndex].ac_curr_code}
                    disabled={isLineLocked}
                    onChange={(currCode, row) => {
                      const ex = lookupText(row, "ex_rate") || "1";
                      const exNum = numberValue(ex) || 1;
                      const cur = lines[activeFcIndex];
                      const costOc = numberValue(cur.actual_cost_oc) || numberValue(cur.actual_cost);
                      const costBase = round3(costOc * exNum);
                      updateLine(activeFcIndex, recalcCostTax({
                        ...cur,
                        ac_curr_code: currCode,
                        ac_ex_rate: ex,
                        actual_cost_oc: String(costOc),
                        actual_cost: String(costBase),
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
                      const newEx = numberValue(val) || 1;
                      const cur = lines[activeFcIndex];
                      const costOc = numberValue(cur.actual_cost_oc) || numberValue(cur.actual_cost);
                      const costBase = round3(costOc * newEx);
                      updateLine(activeFcIndex, recalcCostTax({
                        ...cur,
                        ac_ex_rate: val,
                        actual_cost_oc: String(costOc),
                        actual_cost: String(costBase),
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Cost ({lines[activeFcIndex].ac_curr_code || "FC"})</label>
                  <MoneyInput
                    value={lines[activeFcIndex].actual_cost_oc}
                    disabled={isLineLocked}
                    onChange={(val) => {
                      const costOc = numberValue(val);
                      const ex = numberValue(lines[activeFcIndex].ac_ex_rate) || 1;
                      const costBase = round3(costOc * ex);
                      updateLine(activeFcIndex, recalcCostTax({
                        ...lines[activeFcIndex],
                        actual_cost_oc: val,
                        actual_cost: String(costBase),
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Base Cost ({baseCurrency})</label>
                  <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                    {money(lines[activeFcIndex].actual_cost)}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Agent / Partner Price Currency */}
            <div className="rounded-lg border border-border p-3 space-y-2.5 bg-card">
              <div className="font-bold text-sky-700 flex items-center justify-between uppercase tracking-wider text-[11px]">
                <span>3. Agent / Partner Price Currency</span>
                <span className="text-[11px] font-mono text-muted-foreground lowercase">
                  base agent: <strong className="text-foreground uppercase">{baseCurrency} {money(lines[activeFcIndex].partners_price)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Partner Currency</label>
                  <CurrencyLookup
                    companyCode={companyCode}
                    value={lines[activeFcIndex].partner_curr_code}
                    disabled={isLineLocked}
                    onChange={(currCode, row) => {
                      const ex = lookupText(row, "ex_rate") || "1";
                      const exNum = numberValue(ex) || 1;
                      const cur = lines[activeFcIndex];
                      const pOc = numberValue(cur.partner_price_oc) || numberValue(cur.partners_price);
                      const pBase = round3(pOc * exNum);
                      updateLine(activeFcIndex, {
                        ...cur,
                        partner_curr_code: currCode,
                        partner_ex_rate: ex,
                        partner_price_oc: String(pOc),
                        partners_price: String(pBase),
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
                      const newEx = numberValue(val) || 1;
                      const cur = lines[activeFcIndex];
                      const pOc = numberValue(cur.partner_price_oc) || numberValue(cur.partners_price);
                      const pBase = round3(pOc * newEx);
                      updateLine(activeFcIndex, {
                        ...cur,
                        partner_ex_rate: val,
                        partner_price_oc: String(pOc),
                        partners_price: String(pBase),
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Price ({lines[activeFcIndex].partner_curr_code || "FC"})</label>
                  <MoneyInput
                    value={lines[activeFcIndex].partner_price_oc}
                    disabled={isLineLocked}
                    onChange={(val) => {
                      const pOc = numberValue(val);
                      const ex = numberValue(lines[activeFcIndex].partner_ex_rate) || 1;
                      const pBase = round3(pOc * ex);
                      updateLine(activeFcIndex, {
                        ...lines[activeFcIndex],
                        partner_price_oc: val,
                        partners_price: String(pBase),
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Base Price ({baseCurrency})</label>
                  <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                    {money(lines[activeFcIndex].partners_price)}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Transporter Price Currency */}
            <div className="rounded-lg border border-border p-3 space-y-2.5 bg-card">
              <div className="font-bold text-indigo-700 flex items-center justify-between uppercase tracking-wider text-[11px]">
                <span>4. Transporter Price Currency</span>
                <span className="text-[11px] font-mono text-muted-foreground lowercase">
                  base transp: <strong className="text-foreground uppercase">{baseCurrency} {money(lines[activeFcIndex].transport_price)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Transp. Currency</label>
                  <CurrencyLookup
                    companyCode={companyCode}
                    value={lines[activeFcIndex].tp_curr_code}
                    disabled={isLineLocked}
                    onChange={(currCode, row) => {
                      const ex = lookupText(row, "ex_rate") || "1";
                      const exNum = numberValue(ex) || 1;
                      const cur = lines[activeFcIndex];
                      const tpOc = numberValue(cur.transport_price_oc) || numberValue(cur.transport_price);
                      const tpBase = round3(tpOc * exNum);
                      updateLine(activeFcIndex, {
                        ...cur,
                        tp_curr_code: currCode,
                        tp_ex_rate: ex,
                        transport_price_oc: String(tpOc),
                        transport_price: String(tpBase),
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
                      const newEx = numberValue(val) || 1;
                      const cur = lines[activeFcIndex];
                      const tpOc = numberValue(cur.transport_price_oc) || numberValue(cur.transport_price);
                      const tpBase = round3(tpOc * newEx);
                      updateLine(activeFcIndex, {
                        ...cur,
                        tp_ex_rate: val,
                        transport_price_oc: String(tpOc),
                        transport_price: String(tpBase),
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Price ({lines[activeFcIndex].tp_curr_code || "FC"})</label>
                  <MoneyInput
                    value={lines[activeFcIndex].transport_price_oc}
                    disabled={isLineLocked}
                    onChange={(val) => {
                      const tpOc = numberValue(val);
                      const ex = numberValue(lines[activeFcIndex].tp_ex_rate) || 1;
                      const tpBase = round3(tpOc * ex);
                      updateLine(activeFcIndex, {
                        ...lines[activeFcIndex],
                        transport_price_oc: val,
                        transport_price: String(tpBase),
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Base Price (OMR)</label>
                  <div className="h-7 px-2 flex items-center font-mono font-bold bg-muted/40 rounded border border-input text-foreground">
                    {money(lines[activeFcIndex].transport_price)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* PowerBuilder dw_3 Cost Booking Breakdown & Vouchers Dialog */}
      <Dialog
        open={costBookingModalOpen}
        onClose={() => setCostBookingModalOpen(false)}
        title="Cost Bookings & Vouchers"
        description="Detailed vendor and provision cost allocations from dw_service_activities_costbooking"
        wide
        contentClassName="max-w-5xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              Corresponds to PowerBuilder dw_3 (dw_service_activities_costbooking)
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCostBookingModalOpen(false)}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Job Expenses</span>
              <span className="text-base font-mono font-bold text-slate-900 mt-1 block">
                OMR {money(totals.expenseOthers + totals.expenseAgent + totals.expenseTransport)}
              </span>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Booked in Purchase Invoice</span>
              <span className="text-base font-mono font-bold text-emerald-800 mt-1 block">
                OMR {money(
                  lines.reduce((sum, l) => {
                    let s = sum;
                    const ap = numberValue(l.partners_price);
                    const tp = numberValue(l.transport_price);
                    const oc = numberValue(l.actual_cost);
                    if (ap > 0 && getBookedPIForLine("Agent Cost", l.act_code, ap)) s += ap;
                    if (tp > 0 && getBookedPIForLine("Transporter Cost", l.act_code, tp)) s += tp;
                    if (oc > 0 && getBookedPIForLine("Other Cost", l.act_code, oc)) s += oc;
                    return s;
                  }, 0)
                )}
              </span>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Unbooked / Provision</span>
              <span className="text-base font-mono font-bold text-amber-900 mt-1 block">
                OMR {money(
                  lines.reduce((sum, l) => {
                    let s = sum;
                    const ap = numberValue(l.partners_price);
                    const tp = numberValue(l.transport_price);
                    const oc = numberValue(l.actual_cost);
                    if (ap > 0 && !getBookedPIForLine("Agent Cost", l.act_code, ap)) s += ap;
                    if (tp > 0 && !getBookedPIForLine("Transporter Cost", l.act_code, tp)) s += tp;
                    if (oc > 0 && !getBookedPIForLine("Other Cost", l.act_code, oc)) s += oc;
                    return s;
                  }, 0)
                )}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#002d72] text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-2.5 text-center w-10">#</th>
                  <th className="py-2 px-3 text-center w-28">Type (Stream)</th>
                  <th className="py-2 px-3 min-w-[140px]">Activity</th>
                  <th className="py-2 px-3 min-w-[160px]">Vendor / Beneficiary</th>
                  <th className="py-2 px-3 w-28">A/C Ref</th>
                  <th className="py-2 px-3 text-right w-28">Amount</th>
                  <th className="py-2 px-3 text-center w-28">Status</th>
                  <th className="py-2 px-3 text-center w-36">PI / Voucher</th>
                  <th className="py-2 px-2 text-center w-16">Conf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(() => {
                  const rows: any[] = [];
                  lines.forEach((l, idx) => {
                    const srno = String(l.srno || idx + 1);
                    const actCode = l.act_code;
                    const actName = l.activity || l.other_services || actCode;

                    // 1. Broker
                    const ap = numberValue(l.partners_price);
                    if (ap > 0) {
                      const pi = getBookedPIForLine("Agent Cost", actCode, ap);
                      rows.push({
                        key: `${srno}_BROKER`,
                        srno,
                        type: "BROKER",
                        typeBadge: "bg-purple-100 text-purple-800 border-purple-200",
                        actName,
                        vendorName: l.broker_name || l.broker_code || "Agent / Broker",
                        vendorCode: l.broker_code,
                        acRef: (l as any).broker_acref || "-",
                        amount: ap,
                        isBooked: Boolean(pi),
                        piNo: pi,
                      });
                    }

                    // 2. Transporter
                    const tp = numberValue(l.transport_price);
                    if (tp > 0) {
                      const pi = getBookedPIForLine("Transporter Cost", actCode, tp);
                      rows.push({
                        key: `${srno}_TRANSPORT`,
                        srno,
                        type: "TRANSPORT",
                        typeBadge: "bg-emerald-100 text-emerald-800 border-emerald-200",
                        actName,
                        vendorName: l.transporter_name || l.transporter_code || "Transporter",
                        vendorCode: l.transporter_code,
                        acRef: (l as any).transporter_ac_code || "-",
                        amount: tp,
                        isBooked: Boolean(pi),
                        piNo: pi,
                      });
                    }

                    // 3. Other Cost
                    const oc = numberValue(l.actual_cost);
                    if (oc > 0) {
                      const pi = getBookedPIForLine("Other Cost", actCode, oc);
                      rows.push({
                        key: `${srno}_ACTUAL`,
                        srno,
                        type: "ACTUAL",
                        typeBadge: "bg-amber-100 text-amber-800 border-amber-200",
                        actName,
                        vendorName: l.broker_name ? `${l.broker_name} (Direct)` : "Direct Provision",
                        vendorCode: l.broker_code || "-",
                        acRef: "2020100000",
                        amount: oc,
                        isBooked: Boolean(pi),
                        piNo: pi,
                      });
                    }
                  });

                  if (!rows.length) {
                    return (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No expense cost bookings in this job.
                        </td>
                      </tr>
                    );
                  }

                  return rows.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2.5 text-center font-mono text-slate-500">{r.srno}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold border ${r.typeBadge}`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">{r.actName}</td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-800 block truncate max-w-[200px]">{r.vendorName}</span>
                        {r.vendorCode && r.vendorCode !== "-" && (
                          <span className="text-[10px] font-mono text-slate-500">{r.vendorCode}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">{r.acRef}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{money(r.amount)}</td>
                      <td className="py-2 px-3 text-center">
                        {r.isBooked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={11} className="text-emerald-600" /> Booked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                            Unbooked
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {r.piNo ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs">
                            {r.piNo}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono italic">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block w-4 h-4 rounded-full text-[10px] font-bold ${r.isBooked ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                          {r.isBooked ? "Y" : "N"}
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      {/* Dedicated Tax Configuration Dialog */}
      {activeTaxIndex !== null && lines[activeTaxIndex] && (
        <Dialog
          open={true}
          title={`Sales Tax Configuration (Line #${activeTaxIndex + 1})`}
          onClose={() => setActiveTaxIndex(null)}
          contentClassName="w-[min(96vw,860px)]"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-muted-foreground italic">
                * Customer Sales Tax is computed dynamically based on revenue. Vendor/Cost Tax is handled directly during Purchase Booking.
              </span>
              <Button type="button" size="sm" onClick={() => setActiveTaxIndex(null)}>
                Apply & Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 p-2.5 text-emerald-950 flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="font-semibold text-emerald-800">Activity: </span>
                <span className="font-mono font-bold text-foreground">
                  {lines[activeTaxIndex].act_code} - {lines[activeTaxIndex].activity || lines[activeTaxIndex].other_services || "Service Line"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-emerald-800 font-semibold">Revenue: </span>
                  <span className="font-mono font-bold text-primary">{baseCurrency} {money(lines[activeTaxIndex].bill)}</span>
                </div>
                <div>
                  <span className="text-emerald-800 font-semibold">Cost: </span>
                  <span className="font-mono font-bold text-emerald-700">{baseCurrency} {money(lines[activeTaxIndex].actual_cost)}</span>
                </div>
              </div>
            </div>

            {/* 1. Sales / Output Tax */}
            <div className="rounded-lg border border-border p-3 space-y-3 bg-card">
              <div className="font-bold text-primary flex items-center justify-between uppercase tracking-wider text-[11px]">
                <span>Customer Sales Tax / Output VAT</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Sales Tax Amt: <strong className="text-primary font-bold">{baseCurrency} {money(lines[activeTaxIndex].tx_compnt_lcuramt_1)}</strong>
                  {Boolean(lines[activeTaxIndex].bill_curr_code && lines[activeTaxIndex].bill_curr_code !== "OMR") && (
                    <span className="ml-1 text-[10px] text-sky-700 font-normal">
                      ({money(lines[activeTaxIndex].tx_compnt_amt_1)} {lines[activeTaxIndex].bill_curr_code})
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1.5fr_1fr_80px] gap-2.5 items-end">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Tax Category</label>
                  <TaxCategoryLookup
                    companyCode={companyCode}
                    divisionCode={lines[activeTaxIndex].div_code || lookupText(header, "div_code") || "10"}
                    value={lines[activeTaxIndex].tx_cat_code}
                    displayValue={lines[activeTaxIndex].tx_cat_name}
                    disabled={isLineLocked}
                    placeholder="Tax Category"
                    onChange={(val, row) => {
                      const catName = lookupText(row, "tx_cat_name");
                      updateLine(activeTaxIndex, recalcSalesTax({
                        ...lines[activeTaxIndex],
                        tx_cat_code: val,
                        tx_cat_name: catName,
                        tx_compntcat_code_1: "",
                        tx_compntcat_name_1: "",
                        tx_compnt_perc_1: "0",
                        tx_compnt_1_expmt: "N",
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Tax Code</label>
                  <TaxCodeLookup
                    companyCode={companyCode}
                    divisionCode={lines[activeTaxIndex].div_code || lookupText(header, "div_code") || "10"}
                    taxCategory={lines[activeTaxIndex].tx_cat_code}
                    activityCode={lines[activeTaxIndex].act_code}
                    value={lines[activeTaxIndex].tx_compntcat_code_1}
                    displayValue={lines[activeTaxIndex].tx_compntcat_name_1}
                    disabled={isLineLocked}
                    placeholder="Tax Code"
                    onChange={(val, row) => {
                      const perc = lookupText(row, "tx_percnt") || "0";
                      const codeName = lookupText(row, "tx_compntcat_name");
                      const treatment = numberValue(perc) > 0 ? "S" : "Z";
                      updateLine(activeTaxIndex, recalcSalesTax({
                        ...lines[activeTaxIndex],
                        tx_compntcat_code_1: val,
                        tx_compntcat_name_1: codeName,
                        tx_compnt_perc_1: perc,
                        tx_compnt_1_expmt: treatment,
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Treatment</label>
                  <TaxTreatmentSelect
                    value={lines[activeTaxIndex].tx_compnt_1_expmt}
                    disabled={isLineLocked}
                    onChange={(treatment) => {
                      updateLine(activeTaxIndex, recalcSalesTax({
                        ...lines[activeTaxIndex],
                        tx_compnt_1_expmt: treatment,
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Tax Rate %</label>
                  <Input
                    className="h-7 text-right text-xs font-mono"
                    value={lines[activeTaxIndex].tx_compnt_perc_1}
                    disabled={isLineLocked}
                    onChange={(e) => {
                      updateLine(activeTaxIndex, recalcSalesTax({
                        ...lines[activeTaxIndex],
                        tx_compnt_perc_1: e.target.value,
                      }));
                    }}
                  />
                </div>
              </div>
            </div>

            </div>
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
  const [cachedName, setCachedName] = useState(displayValue || "");

  useEffect(() => {
    if (displayValue) setCachedName(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (value && !cachedName && companyCode) {
      loadFreightLookup("freight_activity", companyCode, value).then((rows) => {
        const found = rows.find((r) => lookupText(r, "act_code") === value);
        if (found) {
          const name = lookupText(found, "activity");
          if (name) setCachedName(name);
        }
      }).catch(() => {});
    }
  }, [value, cachedName, companyCode]);

  const fullName = cachedName || displayValue || "";

  return (
    <LookupField
      value={value}
      displayValue={fullName || ""}
      triggerClassName={value ? "border-blue-300/80 bg-blue-50/40 text-[#00378C]" : ""}
      compact
      placeholder="Select Act..."
      valueField="ACT_CODE"
      displayFields={["ACTIVITY"]}
      columns={[
        { field: "ACT_CODE", header: "Code" },
        { field: "ACTIVITY", header: "Activity Name" },
      ]}
      loadOptions={(query) => loadFreightLookup("freight_activity", companyCode, query)}
      onChange={(val, row) => {
        const name = lookupText(row || undefined, "activity") || "";
        setCachedName(name);
        onChange(val, row);
      }}
      disabled={disabled}
      popoverWidth={580}
    />
  );
}

function TaxCategoryLookup({
  companyCode,
  divisionCode,
  value,
  displayValue,
  onChange,
  disabled,
  placeholder,
}: {
  companyCode: string;
  divisionCode: string;
  value: string;
  displayValue?: string;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [cachedName, setCachedName] = useState(displayValue || "");

  useEffect(() => {
    if (displayValue) setCachedName(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (value && !cachedName && companyCode && divisionCode) {
      freightTaxCategories<LookupRow>(companyCode, divisionCode, "").then((rows) => {
        const found = rows.find((r) => lookupText(r, "tx_cat_code") === value);
        if (found) {
          const name = lookupText(found, "tx_cat_name");
          if (name) setCachedName(name);
        }
      }).catch(() => {});
    }
  }, [value, cachedName, companyCode, divisionCode]);

  const formattedDisplayValue = useMemo(() => {
    if (!value) return "";
    const name = cachedName || displayValue || "";
    if (!name) return value;
    if (name.startsWith(value)) return name;
    return `${value} - ${name}`;
  }, [value, cachedName, displayValue]);

  return (
    <LookupField
      value={value}
      displayValue={formattedDisplayValue}
      compact
      placeholder={placeholder}
      valueField="TX_CAT_CODE"
      displayFields={["TX_CAT_CODE", "TX_CAT_NAME"]}
      columns={[{ field: "TX_CAT_CODE", header: "Code" }, { field: "TX_CAT_NAME", header: "Tax Category Name" }]}
      loadOptions={(query) => freightTaxCategories<LookupRow>(companyCode, divisionCode, query).then((rows) => rows.map(normalizeLookupRow))}
      onChange={(val, row) => {
        const name = lookupText(row || undefined, "tx_cat_name");
        setCachedName(name);
        onChange(val, row);
      }}
      disabled={disabled || !divisionCode}
      popoverWidth={480}
    />
  );
}

function TaxCodeLookup({
  companyCode,
  divisionCode,
  taxCategory,
  activityCode,
  value,
  displayValue,
  onChange,
  disabled,
  placeholder,
}: {
  companyCode: string;
  divisionCode: string;
  taxCategory: string;
  activityCode: string;
  value: string;
  displayValue?: string;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [cachedName, setCachedName] = useState(displayValue || "");

  useEffect(() => {
    if (displayValue) setCachedName(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (value && !cachedName && companyCode && divisionCode && taxCategory) {
      freightTaxComponents<LookupRow>(companyCode, divisionCode, taxCategory, "", activityCode).then((rows) => {
        const found = rows.find((r) => lookupText(r, "tx_compntcat_code") === value);
        if (found) {
          const name = lookupText(found, "tx_compntcat_name") || lookupText(found, "tx_compntcat_code");
          if (name) setCachedName(name);
        }
      }).catch(() => {});
    }
  }, [value, cachedName, companyCode, divisionCode, taxCategory, activityCode]);

  const formattedDisplayValue = useMemo(() => {
    if (!value) return "";
    const name = cachedName || displayValue || "";
    if (!name) return value;
    if (name.startsWith(value)) return name;
    return `${value} - ${name}`;
  }, [value, cachedName, displayValue]);

  return (
    <LookupField
      value={value}
      displayValue={formattedDisplayValue}
      compact
      placeholder={placeholder}
      valueField="TX_COMPNTCAT_CODE"
      displayFields={["TX_COMPNTCAT_CODE", "TX_COMPNTCAT_NAME"]}
      columns={[
        { field: "TX_COMPNTCAT_CODE", header: "Code" },
        { field: "TX_COMPNTCAT_NAME", header: "Tax Code Name" },
        { field: "TX_CAT_CODE", header: "Category" },
        { field: "TX_PERCNT", header: "Tax %" },
      ]}
      loadOptions={(query) => freightTaxComponents<LookupRow>(companyCode, divisionCode, taxCategory, query, activityCode).then((rows) => rows.map(normalizeLookupRow))}
      onChange={(val, row) => {
        const name = lookupText(row || undefined, "tx_compntcat_name");
        setCachedName(name);
        onChange(val, row);
      }}
      disabled={disabled || !divisionCode || !taxCategory}
      popoverWidth={580}
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
  const [cachedName, setCachedName] = useState(displayValue || "");

  useEffect(() => {
    if (displayValue) setCachedName(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (value && !cachedName && companyCode) {
      loadFreightLookup("freight_broker", companyCode, value).then((rows) => {
        const valUpper = String(value).trim().toUpperCase();
        const found = rows.find(
          (r) =>
            lookupText(r, "broker_code").toUpperCase() === valUpper ||
            lookupText(r, "broker_name").toUpperCase() === valUpper
        );
        if (found) {
          const name = lookupText(found, "broker_name") || lookupText(found, "agent_name") || lookupText(found, "broker_code");
          if (name) setCachedName(name);
        } else if (value) {
          setCachedName(String(value));
        }
      }).catch(() => {
        if (value) setCachedName(String(value));
      });
    }
  }, [value, cachedName, companyCode]);

  const fullName = cachedName || displayValue || value || "";

  return (
    <LookupField
      value={value}
      displayValue={fullName || ""}
      triggerClassName={value ? "border-indigo-300/80 bg-indigo-50/40 text-indigo-900" : ""}
      compact
      placeholder="Select Broker..."
      valueField="BROKER_CODE"
      displayFields={["BROKER_NAME"]}
      columns={[
        { field: "BROKER_CODE", header: "Code" },
        { field: "BROKER_NAME", header: "Agent / Broker Full Name" },
        { field: "BROKER_CITY", header: "City" },
      ]}
      loadOptions={(query) => loadFreightLookup("freight_broker", companyCode, query)}
      onChange={(val, row) => {
        const name = lookupText(row || undefined, "broker_name") || lookupText(row || undefined, "agent_name") || "";
        setCachedName(name);
        onChange(val, row);
      }}
      disabled={disabled}
      popoverWidth={650}
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
  const [cachedName, setCachedName] = useState(displayValue || "");

  useEffect(() => {
    if (displayValue) setCachedName(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (value && !cachedName && companyCode) {
      loadFreightLookup("freight_transporter", companyCode, value).then((rows) => {
        const found = rows.find((r) => lookupText(r, "transporter_code") === value);
        if (found) {
          const name = lookupText(found, "transporter_name");
          if (name) setCachedName(name);
        }
      }).catch(() => {});
    }
  }, [value, cachedName, companyCode]);

  const fullName = cachedName || displayValue || "";

  return (
    <LookupField
      value={value}
      displayValue={fullName || ""}
      triggerClassName={value ? "border-amber-300/80 bg-amber-50/40 text-amber-950" : ""}
      compact
      placeholder="Select Transp..."
      valueField="TRANSPORTER_CODE"
      displayFields={["TRANSPORTER_NAME"]}
      columns={[
        { field: "TRANSPORTER_CODE", header: "Code" },
        { field: "TRANSPORTER_NAME", header: "Transporter Full Name" },
      ]}
      loadOptions={(query) => loadFreightLookup("freight_transporter", companyCode, query)}
      onChange={(val, row) => {
        const name = lookupText(row || undefined, "transporter_name") || "";
        setCachedName(name);
        onChange(val, row);
      }}
      disabled={disabled}
      popoverWidth={650}
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

function MoneyInput({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Input
      className={`h-7 text-right text-[11px] font-mono px-1.5 tabular-nums ${className}`}
      type="text"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(normalizeMoneyInput(event.target.value))}
    />
  );
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
    consolidated_invno: "",
    pi_no: "",
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
  line.activity = lookupText(row, "activity") || "";
  line.consolidated_invno = lookupText(row, "consolidated_invno") || lookupText(row, "invoice_no") || "";
  line.pi_no = lookupText(row, "pi_no") || lookupText(row, "booked_pi_no") || lookupText(row, "trans_docno") || "";
  line.tx_cat_name = lookupText(row, "tx_cat_name") || "";
  line.tx_compntcat_name_1 = lookupText(row, "tx_compntcat_name_1") || lookupText(row, "tx_compntcat_name") || "";
  line.tx_cat_name_cost = lookupText(row, "tx_cat_name_cost") || "";
  line.tx_compntcat_name_1_cost = lookupText(row, "tx_compntcat_name_1_cost") || "";

  // Ensure Foreign Currency (OC) fields are properly synchronized from Base OMR
  const billEx = numberValue(line.bill_ex_rate) || 1;
  if (!numberValue(line.bill_rate_oc) && numberValue(line.bill_rate)) {
    line.bill_rate_oc = billEx > 0 ? String(numberValue(line.bill_rate) / billEx) : line.bill_rate;
  }
  if (!numberValue(line.bill_oc) && numberValue(line.bill)) {
    line.bill_oc = billEx > 0 ? String(numberValue(line.bill) / billEx) : line.bill;
  }
  const acEx = numberValue(line.ac_ex_rate) || 1;
  if (!numberValue(line.actual_cost_oc) && numberValue(line.actual_cost)) {
    line.actual_cost_oc = acEx > 0 ? String(numberValue(line.actual_cost) / acEx) : line.actual_cost;
  }
  const pEx = numberValue(line.partner_ex_rate) || 1;
  if (!numberValue(line.partner_price_oc) && numberValue(line.partners_price)) {
    line.partner_price_oc = pEx > 0 ? String(numberValue(line.partners_price) / pEx) : line.partners_price;
  }
  const tpEx = numberValue(line.tp_ex_rate) || 1;
  if (!numberValue(line.transport_price_oc) && numberValue(line.transport_price)) {
    line.transport_price_oc = tpEx > 0 ? String(numberValue(line.transport_price) / tpEx) : line.transport_price;
  }

  return line;
}

function round3(input: number): number {
  return Math.round((input + Number.EPSILON) * 1000) / 1000;
}

function recalc(line: ActivityLine) {
  const qty = numberValue(line.quantity) || 1;
  const isFc = Boolean(line.bill_curr_code && line.bill_curr_code !== "OMR");
  const ex = numberValue(line.bill_ex_rate) || 1;
  const rateBase = numberValue(line.bill_rate);
  const billBase = round3(qty * rateBase);
  const rateOc = isFc && ex > 0 ? round3(rateBase / ex) : (numberValue(line.bill_rate_oc) || rateBase);
  const billOc = round3(qty * rateOc);

  return recalcSalesTax({
    ...line,
    bill_rate: String(rateBase),
    bill: String(billBase),
    bill_rate_oc: String(rateOc),
    bill_oc: String(billOc),
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
  const isStandard = line.tx_compnt_1_expmt === "S";
  const perc = numberValue(line.tx_compnt_perc_1);
  const billBase = numberValue(line.bill);
  const billOc = numberValue(line.bill_oc);
  const ex = numberValue(line.bill_ex_rate) || 1;
  const taxBase = isStandard ? round3((billBase * perc) / 100) : 0;
  const taxFc = isStandard
    ? (billOc > 0 ? round3((billOc * perc) / 100) : (ex > 0 ? round3(taxBase / ex) : taxBase))
    : 0;
  return {
    ...line,
    tx_compnt_amt_1: String(taxFc),
    tx_compnt_lcuramt_1: String(taxBase),
  };
}

function recalcCostTax(line: ActivityLine) {
  const isStandard = line.tx_compnt_1_expmt_cost === "S";
  const perc = numberValue(line.tx_compnt_perc_1_cost);
  const costBase = numberValue(line.actual_cost);
  const costOc = numberValue(line.actual_cost_oc);
  const ex = numberValue(line.ac_ex_rate) || 1;
  const taxBase = isStandard ? round3((costBase * perc) / 100) : 0;
  const taxFc = isStandard
    ? (costOc > 0 ? round3((costOc * perc) / 100) : (ex > 0 ? round3(taxBase / ex) : taxBase))
    : 0;
  return {
    ...line,
    tx_compnt_amt_1_cost: String(taxFc),
    tx_compnt_lcuramt_1_cost: String(taxBase),
  };
}

function calculateTotals(lines: ActivityLine[]) {
  return lines.reduce(
    (sum, line) => {
      // Income
      const bill = numberValue(line.bill);
      const otherBill = 0; // other_bill_amt if present
      const taxBill = numberValue(line.tx_compnt_lcuramt_1);
      const taxOtherBill = 0;

      // Expense
      const costOthers = numberValue(line.actual_cost);
      const taxCostOthers = numberValue(line.tx_compnt_lcuramt_1_cost);

      const costAgent = numberValue(line.partners_price);
      const taxCostAgent = numberValue(line.tx_compnt_lcuramt_2_cost);

      const costTransport = numberValue(line.transport_price);
      const taxCostTransport = numberValue(line.tx_compnt_lcuramt_3_cost);

      const totalIncome = bill + otherBill;
      const totalExpense = costOthers + costAgent + costTransport;
      const totalTax = taxBill + taxOtherBill;

      return {
        // High level totals
        revenue: sum.revenue + totalIncome,
        expense: sum.expense + totalExpense,
        cost: sum.cost + costOthers,
        partners: sum.partners + costAgent,
        transport: sum.transport + costTransport,
        tax: sum.tax + totalTax,
        profit: sum.profit + totalIncome - totalExpense,

        // Exact PB 2D Matrix Breakdown
        incomeOthers: sum.incomeOthers + otherBill,
        incomeOthersTax: sum.incomeOthersTax + taxOtherBill,
        incomeOthersNet: sum.incomeOthersNet + otherBill + taxOtherBill,

        incomeBill: sum.incomeBill + bill,
        incomeBillTax: sum.incomeBillTax + taxBill,
        incomeBillNet: sum.incomeBillNet + bill + taxBill,

        expenseOthers: sum.expenseOthers + costOthers,
        expenseOthersTax: sum.expenseOthersTax + taxCostOthers,
        expenseOthersNet: sum.expenseOthersNet + costOthers + taxCostOthers,

        expenseAgent: sum.expenseAgent + costAgent,
        expenseAgentTax: sum.expenseAgentTax + taxCostAgent,
        expenseAgentNet: sum.expenseAgentNet + costAgent + taxCostAgent,

        expenseTransport: sum.expenseTransport + costTransport,
        expenseTransportTax: sum.expenseTransportTax + taxCostTransport,
        expenseTransportNet: sum.expenseTransportNet + costTransport + taxCostTransport,
      };
    },
    {
      revenue: 0,
      expense: 0,
      cost: 0,
      partners: 0,
      transport: 0,
      tax: 0,
      profit: 0,

      incomeOthers: 0,
      incomeOthersTax: 0,
      incomeOthersNet: 0,

      incomeBill: 0,
      incomeBillTax: 0,
      incomeBillNet: 0,

      expenseOthers: 0,
      expenseOthersTax: 0,
      expenseOthersNet: 0,

      expenseAgent: 0,
      expenseAgentTax: 0,
      expenseAgentNet: 0,

      expenseTransport: 0,
      expenseTransportTax: 0,
      expenseTransportNet: 0,
    }
  );
}

async function loadFreightLookup(parameter: string, companyCode: string, query = "") {
  return (await freightSelect<LookupRow>({ parameter, code1: companyCode, code2: query || "NULL", number1: 1000 })).map(normalizeLookupRow);
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

