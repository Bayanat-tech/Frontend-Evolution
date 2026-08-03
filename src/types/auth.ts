export type MenuNode = {
  id?: string;
  title: string;
  type: "collapse" | "group" | "item";
  icon?: string;
  serial_no?: string | number;
  serial_number?: string | number;
  SERIAL_NO?: string | number;
  url_path?: string;
  component_name?: string;
  componentName?: string;
  position?: number;
  children?: MenuNode[];
};

export type UserProfile = {
  username?: string;
  USERNAME?: string;
  email_id?: string;
  EMAIL_ID?: string;
  loginid?: string;
  LOGINID?: string;
  loginid1?: string;
  LOGINID1?: string;
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
