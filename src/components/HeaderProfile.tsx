import { useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut, Moon, Sun } from "lucide-react";
import type { UserProfile } from "../types/auth";

export function HeaderProfile({
  user,
  dark,
  onToggleTheme,
  onLogout,
  variant = "header",
}: {
  variant?: "header" | "sidebar";
  user: UserProfile | null;
  dark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const displayName = user?.username || user?.loginid || "User";
  const companyName = user?.company_name || user?.company_code || user?.COMPANY_CODE || "Company";
  const tenantName = user?.tenant_name || user?.TENANT_NAME || user?.tenantName || user?.TENANTNAME || "-";
  const email = user?.email_id || user?.EMAIL_ID || "-";

  return (
    <div ref={shellRef} className={`header-user-shell ${variant === "sidebar" ? "sidebar-account" : ""}`}>
      <button type="button" className="icon-button account-theme" onClick={onToggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
        {variant === "sidebar" && <span>{dark ? "Light mode" : "Dark mode"}</span>}
      </button>
      <button
        type="button"
        className="header-user compact"
        onClick={() => setOpen((value) => !value)}
        title="View profile"
        aria-label="View profile"
        aria-expanded={open}
      >
        <div className="avatar">{displayName.slice(0, 2).toUpperCase()}</div>
        <div className="header-user-copy">
          <strong>{displayName}</strong>
          {variant === "sidebar" && <small>View profile</small>}
        </div>
        {variant === "sidebar" && <ChevronUp className="account-chevron" size={15} />}
      </button>
      <button type="button" className="icon-button account-logout" onClick={onLogout} title="Logout" aria-label="Logout">
        <LogOut size={18} />
        {variant === "sidebar" && <span>Log out</span>}
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
