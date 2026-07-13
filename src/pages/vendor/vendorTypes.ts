export type VendorView =
  | "requests"
  | "approvals"
  | "sentBack"
  | "accountEntry"
  | "closed"
  | "registration"
  | "profile"
  | "outstanding"
  | "status"
  | "statement";

export type VendorPageProps = {
  routePath?: string;
};

export type VendorTableRow = Record<string, unknown>;

export type Notice = {
  type: "success" | "error";
  message: string;
};

export type VendorStatusKey = "draft" | "submitted" | "pending" | "inProgress" | "sentBack" | "rejected" | "closed" | "canceled";