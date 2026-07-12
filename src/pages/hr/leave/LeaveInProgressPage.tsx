import { LeaveFlowTable } from "./LeaveFlowTable";
import { leaveFlowConfigs } from "./leaveFlowConfig";

export function LeaveInProgressPage() {
  return <LeaveFlowTable config={leaveFlowConfigs.inProgress} />;
}
