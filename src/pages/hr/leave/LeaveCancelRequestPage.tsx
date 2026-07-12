import { LeaveFlowTable } from "./LeaveFlowTable";
import { leaveFlowConfigs } from "./leaveFlowConfig";

export function LeaveCancelRequestPage() {
  return <LeaveFlowTable config={leaveFlowConfigs.cancelled} />;
}
