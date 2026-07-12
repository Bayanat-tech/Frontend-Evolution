import { LeaveFlowTable } from "./LeaveFlowTable";
import { leaveFlowConfigs } from "./leaveFlowConfig";

export function LeaveRejectedRequestPage() {
  return <LeaveFlowTable config={leaveFlowConfigs.rejected} />;
}
