import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { loginRequest, meRequest } from "../api/auth";
import { setAuthToken } from "../api/client";
import type { MenuNode, UserProfile } from "../types/auth";
import { normalizePermissionMenuTree } from "../utils/menu";

type AuthState = {
  isBooting: boolean;
  isAuthenticated: boolean;
  user: UserProfile | null;
  menuTree: MenuNode[];
  tenantId: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "bayanat_service_token";

function normalizeUser(user: UserProfile, tenantId?: string): UserProfile {
  return {
    ...user,
    username: user.username || user.USERNAME,
    email_id: user.email_id || user.EMAIL_ID,
    loginid: user.loginid || user.LOGINID,
    loginid1: user.loginid1 || user.LOGINID1 || user.loginid || user.LOGINID,
    company_code: user.company_code || user.COMPANY_CODE,
    company_name: user.company_name || user.COMPANY_NAME || user.company_code || user.COMPANY_CODE,
    tenantId: tenantId || user.tenantId,
    tenant_name: user.tenant_name || user.TENANT_NAME || user.tenantName || user.TENANTNAME || tenantId || user.tenantId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [menuTree, setMenuTree] = useState<MenuNode[]>([]);
  const [tenantId, setTenantId] = useState("");

  const hydrate = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsBooting(false);
      return;
    }

    try {
      setAuthToken(token);
      const me = await meRequest();
      if (me.success) {
        setUser(normalizeUser(me.data.user, me.data.tenantId));
        setMenuTree(
          normalizePermissionMenuTree(
            Array.isArray(me.data.permissionBasedMenuTree) ? me.data.permissionBasedMenuTree : [],
          ),
        );
        setTenantId(me.data.tenantId || "");
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      setUser(null);
      setMenuTree([]);
      setTenantId("");
    } finally {
      setIsBooting(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    if (!result.success || !result.data?.token) {
      throw new Error(result.message || "Login failed");
    }

    localStorage.setItem(TOKEN_KEY, result.data.token);
    setAuthToken(result.data.token);

    const me = await meRequest();
    if (!me.success) {
      throw new Error(me.message || "Unable to load user permissions");
    }

    setUser(normalizeUser(me.data.user, me.data.tenantId || result.data.tenantId));
    setMenuTree(
      normalizePermissionMenuTree(
        Array.isArray(me.data.permissionBasedMenuTree) ? me.data.permissionBasedMenuTree : [],
      ),
    );
    setTenantId(me.data.tenantId || result.data.tenantId || "");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setMenuTree([]);
    setTenantId("");
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isBooting,
      isAuthenticated: Boolean(user),
      user,
      menuTree,
      tenantId,
      login,
      logout,
    }),
    [isBooting, user, menuTree, tenantId, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
