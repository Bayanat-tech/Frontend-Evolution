import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Plane,
  RefreshCw,
  Search,
  Ship,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
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

const processItems: { key: FreightProcess; label: string; icon: typeof ClipboardList }[] = [
  { key: "enquiry", label: "Enquiry", icon: ClipboardList },
  { key: "rfq", label: "RFQ", icon: FileText },
  { key: "quotation", label: "Quotation", icon: FileSpreadsheet },
];

const directionItems: { key: FreightDirection; label: string }[] = [
  { key: "import", label: "Import" },
  { key: "export", label: "Export" },
  { key: "reexport", label: "Import for Re-export" },
];

const modeItems: { key: FreightMode; label: string; icon: typeof Plane }[] = [
  { key: "air", label: "Air", icon: Plane },
  { key: "sea", label: "Sea", icon: Ship },
  { key: "land", label: "Land", icon: Truck },
];

const actionItems = [
  { key: "job", label: "Job", icon: BriefcaseBusiness },
  { key: "job-sheet", label: "Job Sheet", icon: FileSpreadsheet },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "cost-sheet", label: "Cost Sheet", icon: DollarSign },
  { key: "reports", label: "Reports", icon: ClipboardList },
];

const reportItems = [
  "Enquiry List",
  "RFQ List",
  "Quotation List",
  "Freight Job List",
  "Freight Profit",
  "Freight Expense",
  "Freight Revenue",
  "Freight Brokerage",
  "Deposits",
  "Container Deposit",
];

export function FreightWorkspacePage({ target }: { target?: FreightWorkspaceTarget }) {
  const { user } = useAuth();
  const [jobNo, setJobNo] = useState("");
  const [jobDate, setJobDate] = useState("");
  const [fy, setFy] = useState("");
  const [process, setProcess] = useState<FreightProcess>(target?.process || "enquiry");
  const [direction, setDirection] = useState<FreightDirection>(target?.direction || "import");
  const [mode, setMode] = useState<FreightMode>(target?.mode || "air");
  const [activeAction, setActiveAction] = useState(target?.action || "job");

  const selectedTitle = useMemo(() => {
    const processLabel = processItems.find((item) => item.key === process)?.label || "Enquiry";
    const directionLabel = directionItems.find((item) => item.key === direction)?.label || "Import";
    const modeLabel = modeItems.find((item) => item.key === mode)?.label || "Air";
    return `${processLabel} / ${directionLabel} / ${modeLabel}`;
  }, [direction, mode, process]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Freight Workspace</h1>
          <p className="m-0 text-sm text-muted-foreground">{selectedTitle}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{user?.company_code || user?.COMPANY_CODE || ""}</span>
          <Button variant="outline" size="icon" title="Refresh">
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
          <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
            Job No
            <div className="flex gap-2">
              <Input value={jobNo} onChange={(event) => setJobNo(event.target.value)} />
              <Button variant="outline" size="icon" title="Search job">
                <Search size={15} />
              </Button>
            </div>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
            Job Date
            <Input type="date" value={jobDate} onChange={(event) => setJobDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
            FY
            <Input value={fy} onChange={(event) => setFy(event.target.value)} />
          </label>
        </div>
        <Button variant="outline" onClick={() => { setJobNo(""); setJobDate(""); setFy(""); }}>
          Clear
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            {processItems.map((item) => {
              const Icon = item.icon;
              const selected = process === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setProcess(item.key)}
                  className={`flex min-h-20 items-center justify-between rounded-lg border p-4 text-left shadow-sm transition ${
                    selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                  }`}
                >
                  <span className="text-lg font-semibold">{item.label}</span>
                  <Icon size={22} />
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {directionItems.map((item) => {
              const selected = direction === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setDirection(item.key)}
                  className={`min-h-16 rounded-lg border px-4 text-base font-semibold shadow-sm transition ${
                    selected ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "bg-card hover:bg-accent"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {modeItems.map((item) => {
              const Icon = item.icon;
              const selected = mode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMode(item.key)}
                  className={`flex min-h-16 items-center justify-center gap-3 rounded-lg border px-4 text-base font-semibold shadow-sm transition ${
                    selected ? "border-sky-600 bg-sky-50 text-sky-950" : "bg-card hover:bg-accent"
                  }`}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {actionItems.map((item) => {
              const Icon = item.icon;
              const selected = activeAction === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveAction(item.key)}
                  className={`flex min-h-16 items-center justify-center gap-2 rounded-lg border px-3 font-semibold shadow-sm transition ${
                    selected ? "border-amber-600 bg-amber-50 text-amber-950" : "bg-card hover:bg-accent"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="grid content-start gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="m-0 text-sm font-semibold uppercase text-muted-foreground">Reports</h2>
          <div className="grid gap-2">
            {reportItems.map((label) => (
              <button
                key={label}
                type="button"
                className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-sm font-medium hover:bg-accent"
              >
                {label}
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

export type { FreightWorkspaceTarget };
