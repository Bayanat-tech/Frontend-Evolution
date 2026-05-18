export type MenuNode = {
  id?: string;
  title: string;
  type: "collapse" | "group" | "item";
  icon?: string;
  url_path?: string;
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
  tenantId?: string;
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
