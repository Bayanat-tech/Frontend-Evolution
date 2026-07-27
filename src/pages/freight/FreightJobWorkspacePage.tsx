import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Ban, Bell, BrainCircuit, CheckCircle2, ClipboardList, FileText, Info, PackageCheck, Plane, Plus, ReceiptText, RefreshCw, Search, Ship, Truck, WalletCards } from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";
import { FreightJobPage } from "./FreightJobPage";
import { FreightPacklistPage } from "./FreightPacklistPage";
import { FreightJobActivitiesPage } from "./FreightJobActivitiesPage";
import { FreightJobFollowupTab } from "./FreightJobFollowupTabs";

type JobTab = "job" | "packlist" | "activities" | "documents" | "instructions" | "alerts" | "deposits";
type WorkspaceMode = "list" | "steps";

const modeLabel = {
  air: "Air",
  sea: "Sea",
  land: "Road",
};

const directionLabel = {
  import: "Import",
  export: "Export",
  reexport: "Import for Re-export",
};

const modeCode = {
  air: "A",
  sea: "S",
  land: "R",
};

const directionCode = {
  import: "IMP",
  export: "EXP",
  reexport: "IRE",
};

const modeIcon = {
  air: Plane,
  sea: Ship,
  land: Truck,
};

const tabs: { key: JobTab; label: string; icon: typeof ClipboardList; ready: boolean }[] = [
  { key: "job", label: "Job / File", icon: ClipboardList, ready: true },
  { key: "packlist", label: "Job Sheet", icon: PackageCheck, ready: true },
  { key: "activities", label: "Service & Activities", icon: ReceiptText, ready: true },
  { key: "documents", label: "Documents", icon: FileText, ready: true },
  { key: "instructions", label: "Instructions", icon: Info, ready: true },
  { key: "alerts", label: "Alerts", icon: Bell, ready: true },
  { key: "deposits", label: "Deposits", icon: WalletCards, ready: true },
];

const listingTabs = [
  { value: "in_progress", label: "In Progress" },
  { value: "confirmed", label: "Confirmed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "cancel", label: "Cancelled" },
  { value: "all", label: "All" },
];

export function FreightJobWorkspacePage({ target, initialTab = "job" }: { target?: FreightWorkspaceTarget; initialTab?: JobTab }) {
  const { user } = useAuth();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const [activeTab, setActiveTab] = useState<JobTab>(initialTab);
  const [mode, setMode] = useState<WorkspaceMode>(initialTab === "job" ? "list" : "steps");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<LookupRow | null>(null);
  const [activeStatus, setActiveStatus] = useState("in_progress");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const targetMode = target?.mode || "air";
  const targetDirection = target?.direction || "import";
  const title = useMemo(() => {
    const modeText = modeLabel[targetMode];
    const direction = directionLabel[targetDirection];
    return `${modeText} ${direction} Job Workspace`;
  }, [targetDirection, targetMode]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/job/list", {
        company_code: companyCode,
        transport_mode: modeCode[targetMode],
        job_type: directionCode[targetDirection],
        search: query,
      });
      setRows((response.data.data || []).map(normalizeLookupRow));
    } catch (error: any) {
      setRows([]);
      setMessage(error?.response?.data?.details || error?.response?.data?.message || "Unable to load Freight jobs.");
    } finally {
      setLoading(false);
    }
  }, [companyCode, query, targetDirection, targetMode]);

  useEffect(() => {
    if (mode === "list") void loadRows();
  }, [loadRows, mode]);

  useEffect(() => {
    setActiveTab(initialTab);
    setMode(initialTab === "job" ? "list" : "steps");
    setSelectedJob(null);
  }, [initialTab, targetDirection, targetMode]);

  const columns = useMemo<ColumnDef<LookupRow>[]>(() => [
    {
      accessorKey: "job_no",
      header: "Job No",
      size: 130,
      cell: ({ row }) => (
        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => openSteps(row.original, "job")}>
          {text(row.original, "job_no")}
        </button>
      ),
    },
    { accessorKey: "job_date", header: "Date", size: 110, cell: ({ row }) => formatDate(text(row.original, "job_date")) },
    { accessorKey: "prin_code", header: "Principal", size: 100 },
    { accessorKey: "prin_name", header: "Principal Name", size: 240 },
    { accessorKey: "doc_ref", header: targetMode === "air" ? "MAWB" : "BL / Doc Ref", size: 145 },
    { accessorKey: "hawb", header: targetMode === "air" ? "HAWB" : "House Ref", size: 130 },
    { accessorKey: "port_code", header: "Origin", size: 90 },
    { accessorKey: "destination_port", header: "Destination", size: 115 },
    { accessorKey: "invoice_date", header: "Invoice", size: 110, cell: ({ row }) => text(row.original, "invoice_date") ? <StatusChip tone="green" label="Invoiced" /> : <StatusChip tone="slate" label="Pending" /> },
    { accessorKey: "canceled", header: "Status", size: 95, cell: ({ row }) => text(row.original, "canceled") === "Y" ? <StatusChip tone="red" label="Cancelled" /> : <StatusChip tone="green" label="Open" /> },
    {
      id: "actions",
      header: "Open",
      size: 90,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Button type="button" size="sm" variant="ghost" onClick={() => openSteps(row.original, "job")}>
          Steps <ArrowRight size={13} />
        </Button>
      ),
    },
  ], [targetMode]);

  const health = useMemo(() => buildHealth(rows), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => filterJobByStatus(row, activeStatus)), [activeStatus, rows]);

  function openSteps(row: LookupRow | null, tab: JobTab) {
    setSelectedJob(row ? normalizeLookupRow(row) : null);
    setActiveTab(tab);
    setMode("steps");
  }

  if (mode === "list") {
    return (
      <section className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Freight Operations</p>
            <h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Manage freight jobs, cargo packing, service costing, documents, instructions, alerts, deposits, and closure.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void loadRows()} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </Button>
            <Button type="button" onClick={() => openSteps(null, "job")}>
              <Plus size={15} /> Add Job
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-2">
          <div className="flex flex-wrap gap-2">
            {listingTabs.map((tab) => (
              <Button key={tab.value} size="sm" variant={activeStatus === tab.value ? "default" : "outline"} onClick={() => setActiveStatus(tab.value)}>
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="flex min-w-[280px] flex-1 items-center justify-end gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              <BrainCircuit size={14} className="text-primary" />
              <span>{message || smartAdvice(health)}</span>
            </div>
            <div className="relative w-80 max-w-full">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground" size={15} />
              <Input className="h-9 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search job, principal, reference..." />
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredRows}
          title={loading ? "Loading" : `${filteredRows.length} Jobs`}
          subtitle={`${modeLabel[targetMode]} / ${directionLabel[targetDirection]}`}
          loading={loading}
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Filter visible jobs..."
          height="calc(100vh - 310px)"
          minWidth={1320}
          density="grid"
          enablePagination
          pageSize={50}
          enableExport
          exportFilename={`freight-${targetMode}-${targetDirection}-jobs.csv`}
          onRowClick={(row) => openSteps(row, "job")}
          rowClassName={(row) =>
            text(row, "canceled") === "Y" ? "bg-red-50/70"
            : text(row, "invoice_date") ? "bg-emerald-50/70"
            : "bg-blue-50/50"
          }
        />
      </section>
    );
  }

  return (
    <section className="grid gap-2">
      <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow mb-0.5">Freight Job</p>
            <h1 className="m-0 text-lg font-semibold text-foreground">{title}</h1>
            <p className="m-0 text-xs text-muted-foreground">
              {selectedJob ? `Job ${text(selectedJob, "job_no")} / ${text(selectedJob, "prin_name") || text(selectedJob, "prin_code")}` : "New job flow"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/60"
              onClick={() => setMode("list")}
            >
              <ArrowLeft size={14} />
              Listing
            </button>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition ${
                    active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-muted/60"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon size={14} />
                  {tab.label}
                  {!tab.ready && <span className={`rounded px-1 text-[9px] ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>Next</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === "job" && <FreightJobPage target={target} initialJob={selectedJob} startMode="editor" />}
      {activeTab === "packlist" && <FreightPacklistPage target={target} initialJob={selectedJob} startMode={selectedJob ? "editor" : "list"} />}
      {activeTab === "activities" && <FreightJobActivitiesPage target={target} />}
      {activeTab === "documents" && <FreightJobFollowupTab target={target} kind="documents" />}
      {activeTab === "instructions" && <FreightJobFollowupTab target={target} kind="instructions" />}
      {activeTab === "alerts" && <FreightJobFollowupTab target={target} kind="alerts" />}
      {activeTab === "deposits" && <FreightJobFollowupTab target={target} kind="deposits" />}
    </section>
  );
}

function StatusChip({ tone, label }: { tone: "green" | "red" | "slate"; label: string }) {
  const cls = tone === "green"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function filterJobByStatus(row: LookupRow, tab: string) {
  const cancelled = text(row, "canceled") === "Y";
  const invoiced = Boolean(text(row, "invoice_date"));
  const confirmed = Boolean(text(row, "confirm_date"));
  if (tab === "cancel") return cancelled;
  if (tab === "invoiced") return !cancelled && invoiced;
  if (tab === "confirmed") return !cancelled && confirmed && !invoiced;
  if (tab === "in_progress") return !cancelled && !confirmed && !invoiced;
  return true;
}

function buildHealth(rows: LookupRow[]) {
  const open = rows.filter((row) => text(row, "canceled") !== "Y").length;
  const pendingInvoice = rows.filter((row) => text(row, "canceled") !== "Y" && !text(row, "invoice_date")).length;
  const cancelled = rows.filter((row) => text(row, "canceled") === "Y").length;
  return {
    open,
    pendingInvoice,
    cancelled,
    smartText: pendingInvoice > 0 ? `${pendingInvoice} Follow-up` : "Clear",
  };
}

function smartAdvice(health: ReturnType<typeof buildHealth>) {
  if (health.pendingInvoice > 0) return "Review open jobs without invoice date, then complete cost sheet and documents before close.";
  if (health.cancelled > 0) return "Cancelled jobs are excluded from active flow. Use reports to audit them when needed.";
  return "No urgent job gaps found for this list.";
}

function normalizeLookupRow(row: LookupRow) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toUpperCase(), value])) as LookupRow;
}

function text(row: LookupRow | null | undefined, key: string) {
  if (!row) return "";
  const value = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}
