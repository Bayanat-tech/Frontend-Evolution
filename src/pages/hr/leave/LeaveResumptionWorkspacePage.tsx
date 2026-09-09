import { useState } from "react";
import { LeaveCancelRequestPage } from "./LeaveCancelRequestPage";
import { LeaveClosedRequestPage } from "./LeaveClosedRequestPage";
import { LeaveInProgressPage } from "./LeaveInProgressPage";
import type { LeaveFlowKey } from "./leaveFlowConfig";
import LeaveResumptionApprovalPage from "./LeaveResumptionApprovalPage";

type ResumptionTab = Exclude<LeaveFlowKey, "rejected">;

const tabs: Array<{ key: ResumptionTab; label: string }> = [
  { key: "request", label: "Leave Resumption" },
  { key: "inProgress", label: "In Progress" },
  { key: "closed", label: "Closed" },
  { key: "cancelled", label: "Cancelled" },
];

export function LeaveResumptionWorkspacePage() {
  const [activeTab, setActiveTab] = useState<ResumptionTab>("request");

  return (
    <section className="leave-workspace-freight-view grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Leave Resumption Flow
          </h2>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#00378C] text-white shadow-sm font-semibold"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "request" ? <LeaveResumptionApprovalPage /> : null}
      {activeTab === "inProgress" ? <LeaveInProgressPage /> : null}
      {activeTab === "closed" ? <LeaveClosedRequestPage /> : null}
      {activeTab === "cancelled" ? <LeaveCancelRequestPage /> : null}
    </section>
  );
}

