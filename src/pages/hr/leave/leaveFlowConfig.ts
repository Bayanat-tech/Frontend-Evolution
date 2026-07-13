export type LeaveFlowKey = "request" | "inProgress" | "closed" | "cancelled" | "rejected";

export type LeaveFlowConfig = {
  key: LeaveFlowKey;
  componentName: string;
  title: string;
  eyebrow: string;
  endpoint: string;
  description: string;
  statusLabel: string;
  statusTone: "blue" | "amber" | "green" | "red" | "slate";
  routeTokens: string[];
};

export const leaveFlowConfigs: Record<LeaveFlowKey, LeaveFlowConfig> = {
  request: {
    key: "request",
    componentName: "LeaveRequestPage",
    title: "Leave Request",
    eyebrow: "HR Flow",
    endpoint: "Pg_Leave_flow",
    description: "New leave requests waiting for review and action.",
    statusLabel: "Pending",
    statusTone: "blue",
    routeTokens: ["leaverequestpage", "leaverequest", "leaveapproval", "pgleaveflow", "hrmainpage"],
  },
  inProgress: {
    key: "inProgress",
    componentName: "LeaveInProgressPage",
    title: "Leave In Progress",
    eyebrow: "HR Flow",
    endpoint: "Pg_leave_flow_InProgress",
    description: "Requests currently moving through the approval flow.",
    statusLabel: "In Progress",
    statusTone: "amber",
    routeTokens: ["leaveinprogresspage", "inprogress", "pgleaveflowinprogress", "hrlinprogress"],
  },
  closed: {
    key: "closed",
    componentName: "LeaveClosedRequestPage",
    title: "Closed Leave Requests",
    eyebrow: "HR Flow",
    endpoint: "Pg_leave_flow_close",
    description: "Finalized leave requests with completed approvals.",
    statusLabel: "Closed",
    statusTone: "green",
    routeTokens: ["leaveclosedrequestpage", "closedrequest", "closedleaverequest", "pgleaveflowclose", "hrlclosedrequest"],
  },
  cancelled: {
    key: "cancelled",
    componentName: "LeaveCancelRequestPage",
    title: "Cancelled Leave Requests",
    eyebrow: "HR Flow",
    endpoint: "Pg_leave_flow_cancel",
    description: "Leave requests cancelled before completion.",
    statusLabel: "Cancelled",
    statusTone: "slate",
    routeTokens: ["leavecancelrequestpage", "cancelrequest", "cancelledrequest", "cancelledleaverequest", "pgleaveflowcancel", "hrlcancelrequest"],
  },
  rejected: {
    key: "rejected",
    componentName: "LeaveRejectedRequestPage",
    title: "Rejected Leave Requests",
    eyebrow: "HR Flow",
    endpoint: "Pg_leave_flow_Rejected",
    description: "Leave requests returned or rejected by the approver.",
    statusLabel: "Rejected",
    statusTone: "red",
    routeTokens: ["leaverejectedrequestpage", "rejectedrequest", "rejectedleaverequest", "pgleaveflowrejected", "hrlrejectedrequest"],
  },
};

export const leaveFlowConfigList = Object.values(leaveFlowConfigs);
