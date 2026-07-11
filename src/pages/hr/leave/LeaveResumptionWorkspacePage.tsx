import { CalendarDays, CheckCircle2, Clock3, FileText } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import { LeaveCancelRequestPage } from "./LeaveCancelRequestPage";
import { LeaveClosedRequestPage } from "./LeaveClosedRequestPage";
import { LeaveFlowTable } from "./LeaveFlowTable";
import { LeaveInProgressPage } from "./LeaveInProgressPage";
import { leaveFlowConfigs, type LeaveFlowKey } from "./leaveFlowConfig";

type ResumptionTab = Exclude<LeaveFlowKey, "rejected">;

const tabs: Array<{ key: ResumptionTab; label: string; icon: ReactNode }> = [
  { key: "request", label: "Leave Resumption", icon: <FileText size={15} /> },
  { key: "inProgress", label: "In Progress", icon: <Clock3 size={15} /> },
  { key: "closed", label: "Closed", icon: <CheckCircle2 size={15} /> },
  { key: "cancelled", label: "Cancel", icon: <CalendarDays size={15} /> },
];

export function LeaveResumptionWorkspacePage() {
  const [activeTab, setActiveTab] = useState<ResumptionTab>("request");

  return (
    <section className="grid gap-4">
      <div>
        <p className="eyebrow">HR Flow</p>
        <h1 className="m-0 text-2xl font-semibold text-foreground">Leave Resumption</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Review leave resumption request, in-progress, closed, and cancelled queues.</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2 shadow-sm">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "request" ? <LeaveFlowTable config={{ ...leaveFlowConfigs.request, title: "Leave Resumption", description: "Resume-date requests waiting for review and action." }} /> : null}
      {activeTab === "inProgress" ? <LeaveInProgressPage /> : null}
      {activeTab === "closed" ? <LeaveClosedRequestPage /> : null}
      {activeTab === "cancelled" ? <LeaveCancelRequestPage /> : null}
    </section>
  );
}
