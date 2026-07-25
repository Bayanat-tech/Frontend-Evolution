import { useMemo, useState } from "react";
import { Bell, ClipboardList, FileText, Info, PackageCheck, ReceiptText, WalletCards } from "lucide-react";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";
import { FreightJobPage } from "./FreightJobPage";
import { FreightPacklistPage } from "./FreightPacklistPage";
import { FreightJobActivitiesPage } from "./FreightJobActivitiesPage";
import { FreightJobFollowupTab } from "./FreightJobFollowupTabs";

type JobTab = "job" | "packlist" | "activities" | "documents" | "instructions" | "alerts" | "deposits";

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

const tabs: { key: JobTab; label: string; icon: typeof ClipboardList; ready: boolean }[] = [
  { key: "job", label: "Job / File", icon: ClipboardList, ready: true },
  { key: "packlist", label: "Pack List", icon: PackageCheck, ready: true },
  { key: "activities", label: "Cost Sheet", icon: ReceiptText, ready: true },
  { key: "documents", label: "Documents", icon: FileText, ready: true },
  { key: "instructions", label: "Instructions", icon: Info, ready: true },
  { key: "alerts", label: "Alerts", icon: Bell, ready: true },
  { key: "deposits", label: "Deposits", icon: WalletCards, ready: true },
];

export function FreightJobWorkspacePage({ target, initialTab = "job" }: { target?: FreightWorkspaceTarget; initialTab?: JobTab }) {
  const [activeTab, setActiveTab] = useState<JobTab>(initialTab);
  const title = useMemo(() => {
    const mode = modeLabel[target?.mode || "air"];
    const direction = directionLabel[target?.direction || "import"];
    return `${mode} ${direction} Job Workspace`;
  }, [target?.direction, target?.mode]);

  return (
    <section className="grid gap-2">
      <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow mb-0.5">Freight Operations</p>
            <h1 className="m-0 text-lg font-semibold text-foreground">{title}</h1>
            <p className="m-0 text-xs text-muted-foreground">Job, pack list, cost sheet, and job follow-up in one workspace.</p>
          </div>
          <div className="flex flex-wrap gap-1">
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

      {activeTab === "job" && <FreightJobPage target={target} />}
      {activeTab === "packlist" && <FreightPacklistPage target={target} />}
      {activeTab === "activities" && <FreightJobActivitiesPage target={target} />}
      {activeTab === "documents" && <FreightJobFollowupTab target={target} kind="documents" />}
      {activeTab === "instructions" && <FreightJobFollowupTab target={target} kind="instructions" />}
      {activeTab === "alerts" && <FreightJobFollowupTab target={target} kind="alerts" />}
      {activeTab === "deposits" && <FreightJobFollowupTab target={target} kind="deposits" />}
    </section>
  );
}
