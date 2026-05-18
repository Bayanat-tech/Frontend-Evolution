import {
  ArrowRightLeft,
  Boxes,
  Building2,
  ChevronRight,
  Database,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { firstLeafPath, titleCase } from "../utils/menu";

const appIcons = [Database, Boxes, ArrowRightLeft, Building2, ShieldCheck];

export function AppSelectionPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user, menuTree, tenantId, logout } = useAuth();
  const navigate = useNavigate();

  const openApp = (index: number) => {
    const app = menuTree[index];
    if (!app) return;
    const firstPath = firstLeafPath(app);
    navigate(`/workspace/${cleanAppCode(app.title)}${firstPath ? `/${firstPath}` : ""}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <header className="selection-header">
        <div className="brand-mini">
          <span className="brand-logo-shell">
            <img src="/bayanat-logo.png" alt="Bayanat Technology" className="brand-logo" />
          </span>
          <div className="brand-wordmark">
            <strong>Bayanat</strong>
            <span>Technology</span>
          </div>
          <span className="tenant-pill">{formatTenant(tenantId)}</span>
        </div>
        <div className="header-user">
          <button className="icon-button" onClick={onToggleTheme} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="avatar">{(user?.username || user?.loginid || "U").slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user?.username || user?.loginid || "User"}</strong>
            <span>{user?.company_code || "Company"}</span>
          </div>
          <button className="icon-button" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="selection-main">
        <nav className="breadcrumb">Home / Application Selection</nav>
        <section className="selection-hero">
          <div className="section-title">
            <p>Select Application</p>
            <h1>Choose where you want to work</h1>
            <span>Welcome back, {user?.username || user?.loginid || "User"}. Your permitted modules are ready.</span>
          </div>
        </section>

        {menuTree.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={34} />
            <h2>No modules available</h2>
            <p>Your login is valid, but no permission menu was returned by the backend.</p>
          </div>
        ) : (
          <div className="module-grid">
            {menuTree.map((app, index) => {
              const Icon = appIcons[index % appIcons.length];
              const childCount = app.children?.length || 0;
              return (
                <button className="module-card" key={app.id || app.title} onClick={() => openApp(index)}>
                  <div className="module-icon">
                    <Icon size={24} />
                  </div>
                  <div>
                    <h2>{titleCase(app.title)}</h2>
                    <p>{childCount} menu group{childCount === 1 ? "" : "s"} available</p>
                  </div>
                  <span>
                    Open <ChevronRight size={15} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function cleanAppCode(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function formatTenant(value?: string) {
  if (!value) return "Tenant workspace";
  return value;
}
