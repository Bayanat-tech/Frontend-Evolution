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
  BarChart3,
  Truck,
  Users,
  Settings,
  Globe,
  Layers,
  Package,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { cleanPath, firstMenuLeaf, getMenuRouteTarget } from "../utils/menu";

const appIcons = [
  Database, Warehouse, ArrowRightLeft, Building2, ShieldCheck,
  BarChart3, Truck, Users, Settings, Globe, Layers, Package, Boxes,
];

const cardAccents = [
  { gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", light: "#EEF2FF", border: "#c7d2fe", icon: "#4f46e5", text: "#3730a3", tag: "FINANCE" },
  { gradient: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)", light: "#E0F2FE", border: "#7dd3fc", icon: "#0284c7", text: "#075985", tag: "WMS" },
  { gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)", light: "#ECFDF5", border: "#6ee7b7", icon: "#059669", text: "#065f46", tag: "ERP" },
  { gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", light: "#FFFBEB", border: "#fcd34d", icon: "#d97706", text: "#92400e", tag: "SCM" },
  { gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", light: "#F5F3FF", border: "#ddd6fe", icon: "#7c3aed", text: "#4c1d95", tag: "SEC" },
  { gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", light: "#F0FDFA", border: "#99f6e4", icon: "#0d9488", text: "#134e4a", tag: "OPS" },
  { gradient: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)", light: "#FFF1F2", border: "#fda4af", icon: "#e11d48", text: "#881337", tag: "HR" },
];

export function AppSelectionPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user, menuTree, tenantId, logout } = useAuth();
  const navigate = useNavigate();

  const openApp = (index: number) => {
    const app = menuTree[index];
    if (!app) return;
    const appCode = cleanAppCode(app.url_path || app.app_code || app.title);
    const target = getMenuRouteTarget(firstMenuLeaf(app), appCode);
    navigate(target || `/workspace/${appCode}`);
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
        <section className="selection-hero">
          <div className="section-title">
            <p style={{
              margin: "0 0 6px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--color-primary)",
              opacity: 0.7,
            }}>
              WELCOME BACK, {(user?.username || user?.loginid || "USER").toUpperCase()}
            </p>
            <h1 style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--color-foreground, inherit)",
              lineHeight: 1.3,
            }}>
              Choose your workspace &amp;{" "}
              <span style={{fontWeight: 700, color: "var(--color-foreground, inherit)",  }}>
                let's get things done.
              </span>
            </h1>
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
              const accent = cardAccents[index % cardAccents.length];
              const childCount = app.children?.length || 0;
              return (
                <ModuleCard
                  key={app.id || app.title}
                  title={app.title.toUpperCase()}
                  childCount={childCount}
                  Icon={Icon}
                  accent={accent}
                  dark={dark}
                  onClick={() => openApp(index)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ModuleCard({
  title, childCount, Icon, accent, dark, onClick,
}: {
  title: string;
  childCount: number;
  Icon: React.ElementType;
  accent: { gradient: string; light: string; border: string; icon: string; text: string; tag: string };
  dark: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      className="module-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: hovered ? accent.border : undefined,
        boxShadow: hovered ? `0 8px 28px ${accent.border}bb` : undefined,
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
        padding: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Gradient top bar */}
      <div style={{
        height: "4px",
        background: accent.gradient,
        width: "100%",
        flexShrink: 0,
        opacity: hovered ? 1 : 0.5,
        transition: "opacity 0.2s ease",
      }} />

      {/* Card body — matches original padding */}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>

        {/* Icon row with subtle number badge */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div
            className="module-icon"
            style={{
              background: hovered ? accent.light : undefined,
              borderRadius: "10px",
              transition: "background 0.2s ease",
              margin: 0,
            }}
          >
            <Icon
              size={24}
              style={{ color: hovered ? accent.icon : undefined, transition: "color 0.2s ease" }}
            />
          </div>

          {/* Group count badge */}
          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: hovered ? accent.text : (dark ? "#6b7280" : "#9ca3af"),
            background: hovered ? accent.light : (dark ? "#1e2235" : "#f3f4f6"),
            border: `1px solid ${hovered ? accent.border : "transparent"}`,
            padding: "2px 8px",
            borderRadius: "20px",
            transition: "all 0.2s ease",
          }}>
            {childCount} GRP
          </span>
        </div>

        {/* Title + subtitle */}
        <div>
          <h2 style={{
            letterSpacing: "0.07em",
            fontSize: "13px",
            fontWeight: 700,
            color: hovered ? accent.text : undefined,
            transition: "color 0.2s ease",
            margin: "0 0 4px",
          }}>
            {title}
          </h2>
          <p style={{ fontSize: "12px", margin: 0 }}>
            {childCount} menu group{childCount === 1 ? "" : "s"} available
          </p>
        </div>

        {/* Open link */}
        <span style={{
          color: hovered ? accent.icon : undefined,
          fontWeight: 600,
          letterSpacing: "0.05em",
          fontSize: "12px",
          transition: "color 0.2s ease",
          display: "flex",
          alignItems: "center",
          gap: "2px",
          marginTop: "auto",
        }}>
          OPEN <ChevronRight size={13} />
        </span>
      </div>
    </button>
  );
}

function cleanAppCode(value: string) {
  return cleanPath(value).toLowerCase().replace(/\s+/g, "-");
}

function formatTenant(value?: string) {
  if (!value) return "Tenant workspace";
  return value;
}
