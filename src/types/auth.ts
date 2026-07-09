export type MenuNode = {
  id?: string;
  serial_no?: string | number | null;
  title: string;
  type: "collapse" | "group" | "item";
  icon?: string;
  url_path?: string;
  app_code?: string;
  level1?: string;
  level2?: string;
  level3?: string;
  component_name?: string | null;
  api_endpoint?: string | null;
  route_type?: string | null;
  children?: MenuNode[];
};

export type UserProfile = {
  username?: string;
  USERNAME?: string;
  email_id?: string;
  EMAIL_ID?: string;
  loginid?: string;
  LOGINID?: string;
  company_code?: string;
  COMPANY_CODE?: string;
  company_name?: string;
  COMPANY_NAME?: string;
  tenantId?: string;
  tenant_name?: string;
  TENANT_NAME?: string;
  tenantName?: string;
  TENANTNAME?: string;
};

export type LoginResponse = {
  success: boolean;
  data: {
    token: string;
    tenantId?: string;
    user: UserProfile;
  };
  message?: string;
};

export type AuthMeResponse = {
  success: boolean;
  data: {
    user: UserProfile;
    tenantId?: string;
    permissionBasedMenuTree: MenuNode[];
    permissions: Record<string, unknown>;
    user_permission: Record<string, unknown>;
    userAccessibleModules?: Record<string, Record<string, boolean>>;
  };
  message?: string;
};
