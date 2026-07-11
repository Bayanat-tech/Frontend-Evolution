import { LeaveFlowTable } from "./LeaveFlowTable";
import { leaveFlowConfigs } from "./leaveFlowConfig";

export function LeaveRequestPage() {
  return <LeaveFlowTable config={leaveFlowConfigs.request} />;
}
