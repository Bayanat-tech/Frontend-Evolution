import { LeaveFlowTable } from "./LeaveFlowTable";
import { leaveFlowConfigs } from "./leaveFlowConfig";

export function LeaveClosedRequestPage() {
  return <LeaveFlowTable config={leaveFlowConfigs.closed} />;
}
