import { useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import type { UserProfile } from "../types/auth";

export function HeaderProfile({
  user,
  dark,
  onToggleTheme,
  onLogout,
}: {
  user: UserProfile | null;
  dark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const displayName = user?.username || user?.loginid || "User";
  const companyName = user?.company_name || user?.company_code || user?.COMPANY_CODE || "Company";
  const tenantName = user?.tenant_name || user?.TENANT_NAME || user?.tenantName || user?.TENANTNAME || "-";
  const email = user?.email_id || user?.EMAIL_ID || "-";

  return (
    <div className="header-user-shell">
      <button className="icon-button" onClick={onToggleTheme} title={dark ? "Light mode" : "Dark mode"}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button
        type="button"
        className="header-user compact"
        onClick={() => setOpen((value) => !value)}
        title="View profile"
        aria-label="View profile"
      >
        <div className="avatar">{displayName.slice(0, 2).toUpperCase()}</div>
        <div className="header-user-copy">
          <strong>{displayName}</strong>
        </div>
      </button>
      <button className="icon-button" onClick={onLogout} title="Logout" aria-label="Logout">
        <LogOut size={18} />
      </button>
      {open && (
        <div className="header-profile-card">
          <div className="header-profile-card__header">
            <div className="avatar large">{displayName.slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{displayName}</strong>
            </div>
          </div>
          <div className="header-profile-card__body">
            <div>
              <span>Login</span>
              <strong>{user?.loginid || "-"}</strong>
            </div>
            <div>
              <span>Tenant</span>
              <strong>{tenantName}</strong>
            </div>
            <div>
              <span>Company</span>
              <strong>{companyName}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{email}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
