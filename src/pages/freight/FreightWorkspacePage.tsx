import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPinned,
  PackageCheck,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Ship,
  Sparkles,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";

type FreightMode = "air" | "sea" | "land";
type FreightDirection = "import" | "export" | "reexport";
type FreightProcess = "enquiry" | "rfq" | "quotation";

type FreightWorkspaceTarget = {
  process?: FreightProcess;
  direction?: FreightDirection;
  mode?: FreightMode;
  action?: string;
};

type FreightJobRow = {
  JOB_NO?: string;
  JOB_DATE?: string;
  PRIN_CODE?: string;
  PRIN_NAME?: string;
  TRANSPORT_MODE?: string;
  JOB_TYPE?: string;
  PACKLIST_DATE?: string;
  CONFIRM_DATE?: string;
  INVOICE_DATE?: string;
  STATUS?: string;
  [key: string]: unknown;
};

type WorkspaceSummary = {
  OPEN_JOBS?: number;
  PENDING_ENQUIRIES?: number;
  ACTIVE_RFQ?: number;
  ACTIVE_QUOTATIONS?: number;
  [key: string]: unknown;
};

const processItems: { key: FreightProcess; label: string; subtitle: string; icon: typeof ClipboardList; route: string }[] = [
  { key: "enquiry", label: "Enquiry", subtitle: "Customer request", icon: ClipboardList, route: "/workspace/fms/freight/freight_enquiry/enquiry" },
  { key: "rfq", label: "RFQ", subtitle: "Supplier rates", icon: FileText, route: "/workspace/fms/freight/request_quote/rfq" },
  { key: "quotation", label: "Quotation", subtitle: "Selling rates", icon: FileSpreadsheet, route: "/workspace/fms/freight/freight_quotation/quotation" },
];

const directionItems: { key: FreightDirection; label: string; routeText: string }[] = [
  { key: "import", label: "Import", routeText: "import" },
  { key: "export", label: "Export", routeText: "export" },
  { key: "reexport", label: "Re-export", routeText: "import_ for_reexport" },
];

const modeItems: { key: FreightMode; label: string; icon: typeof Plane; segment: string }[] = [
  { key: "air", label: "Air", icon: Plane, segment: "freight_air" },
  { key: "sea", label: "Sea", icon: Ship, segment: "freight_sea" },
  { key: "land", label: "Land", icon: Truck, segment: "freight_road" },
];

const jobActions = [
  { key: "job", label: "Job", icon: BriefcaseBusiness },
  { key: "job-sheet", label: "Job Sheet", icon: FileSpreadsheet },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "cost-sheet", label: "Cost Sheet", icon: DollarSign },
];

const reportItems = [
  { label: "Enquiry List", route: "/workspace/fms/freight/freight_reports/enquiry_list" },
  { label: "RFQ List", route: "/workspace/fms/freight/freight_reports/rfq_list" },
  { label: "Quotation List", route: "/workspace/fms/freight/freight_reports/quotation_list" },
  { label: "Freight Job List", route: "/workspace/fms/freight/freight_reports/freight_job_list" },
  { label: "Profit", route: "/workspace/fms/freight/freight_reports/freight_profit" },
  { label: "Expense", route: "/workspace/fms/freight/freight_reports/freight_expense" },
  { label: "Revenue", route: "/workspace/fms/freight/freight_reports/freight_revenue" },
  { label: "Brokerage", route: "/workspace/fms/freight/freight_reports/freight_brokerage" },
  { label: "Deposits", route: "/workspace/fms/freight/freight_reports/deposits" },
  { label: "Container Deposit", route: "/workspace/fms/freight/freight_reports/container_deposit" },
];

export function FreightWorkspacePage({ target }: { target?: FreightWorkspaceTarget }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobNo, setJobNo] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [fy, setFy] = useState("");
  const [process, setProcess] = useState<FreightProcess>(target?.process || "enquiry");
  const [direction, setDirection] = useState<FreightDirection>(target?.direction || "import");
  const [mode, setMode] = useState<FreightMode>(target?.mode || "air");
  const [activeAction, setActiveAction] = useState(target?.action || "job");
  const [summary, setSummary] = useState<WorkspaceSummary>({});
  const [jobs, setJobs] = useState<FreightJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");

  const selectedTitle = useMemo(() => {
    const directionLabel = directionItems.find((item) => item.key === direction)?.label || "Import";
    const modeLabel = modeItems.find((item) => item.key === mode)?.label || "Air";
    return `${directionLabel} / ${modeLabel}`;
  }, [direction, mode]);

  const openProcess = (nextProcess = process) => {
    const item = processItems.find((entry) => entry.key === nextProcess);
    if (item) navigate(item.route);
  };

  const openOperation = (nextMode = mode, nextDirection = direction) => {
    const modeItem = modeItems.find((entry) => entry.key === nextMode);
    const directionItem = directionItems.find((entry) => entry.key === nextDirection);
    if (!modeItem || !directionItem) return;
    navigate(`/workspace/fms/freight/${modeItem.segment}/${directionItem.routeText}`);
  };

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post<{ success?: boolean; data?: { summary?: WorkspaceSummary; recentJobs?: FreightJobRow[] }; message?: string }>(
        "/api/freight/workspace/summary",
        { company_code: companyCode, user_id: userId }
      );
      setSummary(response.data.data?.summary || {});
      setJobs(response.data.data?.recentJobs || []);
    } catch (error: any) {
      setMessage(error?.response?.data?.details || error?.response?.data?.message || "Create Freight workspace procedures to show live job data.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [companyCode, userId]);

  const searchJobs = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post<{ success?: boolean; data?: FreightJobRow[]; message?: string }>("/api/freight/workspace/job-search", {
        company_code: companyCode,
        user_id: userId,
        job_no: jobNo || null,
        job_date: jobDate || null,
        fy_period: fy || null,
      });
      setJobs(response.data.data || []);
      if (!response.data.data?.length) setMessage("No freight jobs found for this search.");
    } catch (error: any) {
      setMessage(error?.response?.data?.details || error?.response?.data?.message || "Unable to search freight jobs.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [companyCode, fy, jobDate, jobNo, userId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  return (
    <section className="grid gap-3">
      <div className="rounded-md border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
              <span>FMS Freight</span>
              <span className="rounded border bg-muted px-2 py-0.5 text-foreground">{companyCode}</span>
              <span className="rounded border bg-primary/10 px-2 py-0.5 text-primary">{selectedTitle}</span>
            </div>
            <h1 className="m-0 mt-1 text-2xl font-semibold leading-tight text-foreground">Freight Workspace</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => openProcess("enquiry")}>
              <Plus size={15} /> Enquiry
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => openProcess("rfq")}>
              RFQ
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => openProcess("quotation")}>
              Quotation
            </Button>
            <Button type="button" variant="outline" size="icon" title="Refresh" onClick={loadWorkspace}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-4">
          <Metric icon={BriefcaseBusiness} label="Open Jobs" value={valueText(summary.OPEN_JOBS)} />
          <Metric icon={ClipboardList} label="Pending Enquiry" value={valueText(summary.PENDING_ENQUIRIES)} />
          <Metric icon={FileText} label="Active RFQ" value={valueText(summary.ACTIVE_RFQ)} />
          <Metric icon={FileSpreadsheet} label="Quotations" value={valueText(summary.ACTIVE_QUOTATIONS)} />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <main className="grid min-w-0 content-start gap-3">
          <section className="rounded-md border bg-card shadow-sm">
            <PanelHeader icon={Search} title="Find Job" subtitle="Search from Freight job list" />
            <div className="grid gap-2 p-3 md:grid-cols-12">
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground md:col-span-5">
                Job No
                <Input className="h-9" value={jobNo} onChange={(event) => setJobNo(event.target.value)} placeholder="Job number or principal" />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground md:col-span-3">
                Job Date
                <Input className="h-9" type="date" value={jobDate} onChange={(event) => setJobDate(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground md:col-span-2">
                FY
                <Input className="h-9" value={fy} onChange={(event) => setFy(event.target.value)} placeholder="226" />
              </label>
              <div className="flex items-end gap-2 md:col-span-2">
                <Button type="button" size="sm" className="h-9 flex-1" onClick={searchJobs}>
                  <Search size={14} /> Search
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => { setJobNo(""); setJobDate(""); setFy(""); void loadWorkspace(); }}>
                  <RefreshCw size={14} />
                </Button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-md border bg-card shadow-sm">
            <PanelHeader icon={BriefcaseBusiness} title="Continue Work" subtitle={message || "Recent jobs from Oracle"} />
            <div className="overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Job No</th>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Principal</th>
                    <th className="px-3 py-2 text-left font-semibold">Mode</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        <Loader2 size={18} className="mx-auto mb-2 animate-spin" /> Loading freight jobs
                      </td>
                    </tr>
                  ) : jobs.length ? (
                    jobs.slice(0, 10).map((row, index) => (
                      <tr key={`${row.JOB_NO || index}`} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 font-semibold text-primary">{text(row.JOB_NO)}</td>
                        <td className="px-3 py-2">{formatDate(row.JOB_DATE)}</td>
                        <td className="px-3 py-2">{text(row.PRIN_NAME || row.PRIN_CODE)}</td>
                        <td className="px-3 py-2">{text(row.TRANSPORT_MODE)}</td>
                        <td className="px-3 py-2">{text(row.JOB_TYPE)}</td>
                        <td className="px-3 py-2">
                          <span className="rounded border bg-muted px-2 py-0.5 text-xs font-semibold">{jobStatus(row)}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => openJobRow(row)}>
                            Open <ArrowRight size={13} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        {message || "No freight jobs loaded yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        <aside className="grid content-start gap-3">
          <section className="rounded-md border bg-card shadow-sm">
            <PanelHeader icon={Sparkles} title="Start Work" subtitle="Commercial flow" />
            <div className="grid gap-2 p-3">
              {processItems.map((item) => {
                const Icon = item.icon;
                const selected = process === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setProcess(item.key)}
                    onDoubleClick={() => openProcess(item.key)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                      selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={16} />
                      <span>
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className={`block text-xs ${selected ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{item.subtitle}</span>
                      </span>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border bg-card shadow-sm">
            <PanelHeader icon={PackageCheck} title="Operation" subtitle="Mode and movement" />
            <div className="grid gap-3 p-3">
              <SegmentGroup>
                {directionItems.map((item) => (
                  <SegmentButton key={item.key} selected={direction === item.key} onClick={() => setDirection(item.key)}>
                    {item.label}
                  </SegmentButton>
                ))}
              </SegmentGroup>
              <div className="grid grid-cols-3 gap-2">
                {modeItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMode(item.key)}
                      onDoubleClick={() => openOperation(item.key, direction)}
                      className={`grid h-16 place-items-center rounded-md border text-sm font-semibold transition ${
                        mode === item.key ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-accent"
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <Button type="button" size="sm" onClick={() => openOperation()}>
                Open {selectedTitle} <ArrowRight size={14} />
              </Button>
            </div>
          </section>

          <section className="rounded-md border bg-card shadow-sm">
            <PanelHeader icon={MapPinned} title="Job Actions" subtitle="After selecting a job" />
            <div className="grid grid-cols-2 gap-2 p-3">
              {jobActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveAction(item.key)}
                    className={`flex items-center gap-2 rounded-md border px-2 py-2 text-sm font-semibold transition ${
                      activeAction === item.key ? "border-amber-500 bg-amber-50 text-amber-950" : "bg-background hover:bg-accent"
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border bg-card shadow-sm">
            <PanelHeader icon={BarChart3} title="Reports" subtitle="Freight monitoring" />
            <div className="flex flex-wrap gap-2 p-3">
              {reportItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.route)}
                  className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );

  function openJobRow(row: FreightJobRow) {
    const nextMode = modeFromText(row.TRANSPORT_MODE);
    const nextDirection = directionFromText(row.JOB_TYPE);
    openOperation(nextMode, nextDirection);
  }
}

function PanelHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: typeof Search }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-b bg-muted/25 px-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <h2 className="m-0 text-sm font-semibold leading-tight text-foreground">{title}</h2>
        <p className="m-0 truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Search; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="truncate text-base font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

function SegmentGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 overflow-hidden rounded-md border bg-muted/20 p-1">{children}</div>;
}

function SegmentButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1.5 text-xs font-semibold transition ${selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background"}`}
    >
      {children}
    </button>
  );
}

function valueText(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function text(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
}

function jobStatus(row: FreightJobRow) {
  if (row.INVOICE_DATE) return "Invoiced";
  if (row.CONFIRM_DATE) return "Confirmed";
  if (row.PACKLIST_DATE) return "Packlist";
  return String(row.STATUS || "Open");
}

function modeFromText(value: unknown): FreightMode {
  const textValue = String(value || "").toLowerCase();
  if (textValue.includes("sea")) return "sea";
  if (textValue.includes("road") || textValue.includes("land")) return "land";
  return "air";
}

function directionFromText(value: unknown): FreightDirection {
  const textValue = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (textValue.includes("reexport") || textValue.includes("reexp")) return "reexport";
  if (textValue.includes("export")) return "export";
  return "import";
}

export type { FreightWorkspaceTarget };
