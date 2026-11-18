// Shared contract between EmployeeWorkspacePage and its tabs.
// Every tab exposes save() through a ref; the header Save calls the active tab's save().
//
// save() may return:
//   true / undefined → saved (or nothing to save): the workspace moves to the next tab
//                      (after the last tab it goes back to the Employee Master list)
//   false            → stay on this tab (validation error, failed save, or the tab wants to stay)

export type TabHandle = { save: () => Promise<boolean | void> };

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