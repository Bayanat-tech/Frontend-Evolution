// Shared contract between EmployeeWorkspacePage and its tabs.
// Every tab exposes save() through a ref; the header Save calls the active tab's save().

export type TabHandle = { save: () => Promise<void> };

export type TabProps = {
  employeeId: string;
  employeeName?: string;
};

// Change this to match your router config
export const EMPLOYEE_MASTER_PATH = "/workspace/hcm/hr/employee/employee_master";

export const TAB_KEYS = ["master", "details", "dependants", "language", "payunits"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const employeeWorkspacePath = (employeeCode: string, tab?: TabKey) =>
  `${EMPLOYEE_MASTER_PATH}/${encodeURIComponent(employeeCode)}${tab ? `?tab=${tab}` : ""}`;