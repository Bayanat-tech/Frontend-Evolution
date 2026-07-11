import { useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, Clock3, FileText, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { LeaveCancelRequestPage } from "./LeaveCancelRequestPage";
import { LeaveClosedRequestPage } from "./LeaveClosedRequestPage";
import { LeaveInProgressPage } from "./LeaveInProgressPage";
import { LeaveRejectedRequestPage } from "./LeaveRejectedRequestPage";
import { LeaveRequestPage } from "./LeaveRequestPage";
import type { LeaveFlowKey } from "./leaveFlowConfig";

type LeaveTab = {
  key: LeaveFlowKey;
  label: string;
  icon: ReactNode;
};

const leaveTabs: LeaveTab[] = [
  { key: "request", label: "Leave Request", icon: <FileText size={15} /> },
  { key: "inProgress", label: "In Progress", icon: <Clock3 size={15} /> },
  { key: "closed", label: "Closed", icon: <CheckCircle2 size={15} /> },
  { key: "cancelled", label: "Cancel", icon: <CalendarDays size={15} /> },
  { key: "rejected", label: "Rejected", icon: <XCircle size={15} /> },
];

export function LeaveWorkspacePage({ initialTab = "request" }: { initialTab?: LeaveFlowKey }) {
  const [activeTab, setActiveTab] = useState<LeaveFlowKey>(initialTab);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">HR Flow</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Leave Request</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Review leave requests across request, in-progress, closed, cancelled, and rejected queues.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2 shadow-sm">
        {leaveTabs.map((tab) => (
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

      {activeTab === "request" ? <LeaveRequestPage /> : null}
      {activeTab === "inProgress" ? <LeaveInProgressPage /> : null}
      {activeTab === "closed" ? <LeaveClosedRequestPage /> : null}
      {activeTab === "cancelled" ? <LeaveCancelRequestPage /> : null}
      {activeTab === "rejected" ? <LeaveRejectedRequestPage /> : null}
    </section>
  );
}
