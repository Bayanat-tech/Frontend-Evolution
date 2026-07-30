import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Factory,
  FolderCog,
  Gauge,
  Globe,
  IdCard,
  Landmark,
  LifeBuoy,
  Layers,
  Package,
  PackageCheck,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UserRoundCheck,
  Warehouse,
  Route,
  ExternalLink,
  ScanFace,
} from "lucide-react";
import type { CSSProperties, ElementType } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderProfile } from "../components/HeaderProfile";
import { useAuth } from "../state/AuthContext";
import type { MenuNode } from "../types/auth";
import { firstLeafPath, flattenLeaves } from "../utils/menu";
import { buildWorkspaceApps, cleanAppCode, isBtMastersApp, isBtSupportApp, isUtilitiesApp } from "../utils/workspaceApps";

type ModuleAccent = {
  gradient: string;
  light: string;
  border: string;
  icon: string;
  text: string;
  glow: string;
};

type ModuleMeta = {
  Icon: ElementType;
  accent: ModuleAccent;
  code: string;
  fullForm: string;
  description: string;
  status: "completed" | "in-progress";
};

const defaultAccents: ModuleAccent[] = [
  { gradient: "linear-gradient(135deg, #3b82f6 0%, #0f766e 100%)", light: "#eaf3ff", border: "#a8c8ff", icon: "#0f4fa8", text: "#0f2f64", glow: "rgba(59, 130, 246, 0.18)" },
  { gradient: "linear-gradient(135deg, #14b8a6 0%, #2563eb 100%)", light: "#e7f9f7", border: "#94d9d0", icon: "#0f766e", text: "#134e4a", glow: "rgba(20, 184, 166, 0.18)" },
  { gradient: "linear-gradient(135deg, #8b5cf6 0%, #2563eb 100%)", light: "#f0edff", border: "#c4b5fd", icon: "#6d28d9", text: "#40237a", glow: "rgba(139, 92, 246, 0.18)" },
  { gradient: "linear-gradient(135deg, #f59e0b 0%, #0f766e 100%)", light: "#fff7df", border: "#f6d68a", icon: "#b45309", text: "#6b3b08", glow: "rgba(245, 158, 11, 0.18)" },
];

export const moduleCatalog: Array<{ keys: string[]; meta: ModuleMeta; external?: { url: string } }> = [
  {
    keys: ["bt support", "support"],
    meta: {
      Icon: LifeBuoy,
      accent: { gradient: "linear-gradient(135deg, #0b63ce 0%, #1294d8 100%)", light: "#eaf5ff", border: "#abd3ff", icon: "#0b63ce", text: "#0d356d", glow: "rgba(11, 99, 206, 0.18)" },
      code: "SUPPORT",
      fullForm: "Support Ticketing System",
      description: "Realtime help desk, customer chat, ticket assignment and developer workbench.",
      status: "completed",
    },
  },
  {
    keys: ["wms", "warehouse"],
    meta: {
      Icon: Warehouse,
      accent: { gradient: "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)", light: "#e6f8ff", border: "#8ddbed", icon: "#027a9f", text: "#075264", glow: "rgba(14, 165, 233, 0.18)" },
      code: "WMS",
      fullForm: "Warehouse Management System",
      description: "Inbound, outbound, inventory, barcode, billing and reports.",
      status: "completed",
    },
  },
  {
    keys: ["progress", "freight", "fms"],
    meta: {
      Icon: Truck,
      accent: { gradient: "linear-gradient(135deg, #64748b 0%, #0ea5e9 100%)", light: "#f1f5f9", border: "#cbd5e1", icon: "#334155", text: "#1e293b", glow: "rgba(100, 116, 139, 0.14)" },
      code: "FMS",
      fullForm: "Freight Management System",
      description: "Enquiry, quotation, BL/AWB, tracking, costing and invoicing.",
      status: "completed",
    },
  },
  {
    keys: ["progress", "Transport", "tms"],
    meta: {
      Icon: Route,
      accent: { gradient: "linear-gradient(135deg, #64748b 0%, #81b454 100%)", light: "#f1f5f9", border: "#cbd5e1", icon: "#334155", text: "#1e293b", glow: "rgba(100, 116, 139, 0.14)" },
      code: "TMS",
      fullForm: "Transport Management System",
      description: "Operational workflows, integrations and reports.",
      status: "in-progress",
    },
  },
  {
    keys: ["mms", "maintenance"],
    meta: {
      Icon: Settings2,
      accent: { gradient: "linear-gradient(135deg, #8b5cf6 0%, #0f766e 100%)", light: "#f0edff", border: "#c4b5fd", icon: "#6d28d9", text: "#40237a", glow: "rgba(139, 92, 246, 0.14)" },
      code: "MMS",
      fullForm: "Maintenance Management System",
      description: "Equipment, preventive service, work orders and spare inventory.",
      status: "completed",
    },
  },
  {
    keys: ["progress", "Procurement", "pms"],
    meta: {
      Icon: Truck,
      accent: { gradient: "linear-gradient(135deg, #64748b 0%, #242f34 100%)", light: "#f1f5f9", border: "#cbd5e1", icon: "#334155", text: "#1e293b", glow: "rgba(100, 116, 139, 0.14)" },
      code: "PMS",
      fullForm: "Procurement Management System",
      description: "Operational workflows, integrations and reports.",
      status: "in-progress",
    },
  },
  {
    keys: ["finance", "accounts"],
    meta: {
      Icon: Landmark,
      accent: { gradient: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)", light: "#eaf3ff", border: "#9cc2ff", icon: "#0f4fa8", text: "#0f2f64", glow: "rgba(37, 99, 235, 0.16)" },
      code: "Finance",
      fullForm: "Finance Management System",
      description: "Receivables, payables, bank reconciliation, invoices and P&L.",
      status: "completed",
    },
  },
  {
    keys: ["vms", "vendor"],
    meta: {
      Icon: BriefcaseBusiness,
      accent: { gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)", light: "#fff6e8", border: "#f5c56f", icon: "#b45309", text: "#78350f", glow: "rgba(245, 158, 11, 0.16)" },
      code: "VMS",
      fullForm: "Vendor Management System",
      description: "Vendor onboarding, invoices, payment status and statements.",
      status: "completed",
    },
  },
  {
    keys: ["cms"],
    meta: {
      Icon: Globe,
      accent: { gradient: "linear-gradient(135deg, #74d6ec 0%, #8788ce 100%)", light: "#ecfeff", border: "#a5f3fc", icon: "#0891b2", text: "#164e63", glow: "rgba(6, 182, 212, 0.14)" },
      code: "CMS",
      fullForm: "Customer Management System",
      description: "Customer Onboarding, View services/sales Invoices, Integration ",
      status: "in-progress", 
    },
  },
  {
    keys: ["purchase_sales", "purchase", "sales"],
    meta: {
      Icon: ShoppingCart,
      accent: { gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)", light: "#f3e8ff", border: "#d8b4fe", icon: "#6d28d9", text: "#4c1d95", glow: "rgba(139, 92, 246, 0.14)" },
      code: "PURCHASE_SALES",
      fullForm: "Purchase Sales Management System",
      description: "Operational workflows, integrations and reports.",
      status: "completed",
    },
  },
  {
    keys: ["pams", "performance"],
    meta: {
      Icon: BarChart3,
      accent: { gradient: "linear-gradient(135deg, #22c55e 0%, #0891b2 100%)", light: "#ecfdf3", border: "#86efac", icon: "#15803d", text: "#14532d", glow: "rgba(34, 197, 94, 0.16)" },
      code: "PAMS",
      fullForm: "Performance Appraisal Management System",
      description: "KPI cycles, appraisals, approvals and performance reports.",
      status: "completed",
    },
  },
  {
    keys: ["ems", "employee"],
    meta: {
      Icon: IdCard,
      accent: { gradient: "linear-gradient(135deg, #16a34a 0%, #0f766e 100%)", light: "#eaf8df", border: "#b7e7a7", icon: "#15803d", text: "#14532d", glow: "rgba(22, 163, 74, 0.14)" },
      code: "EMS",
      fullForm: "Employee Management System",
      description: "Leave, payslip, advances, letters, appraisal and reports.",
      status: "completed",
    },
  },
  
  {
    keys: ["lms"],
    meta: {
      Icon: PackageCheck,
      accent: { gradient: "linear-gradient(135deg, #0891b2 0%, #6366f1 100%)", light: "#ecfeff", border: "#a5f3fc", icon: "#0891b2", text: "#164e63", glow: "rgba(6, 182, 212, 0.14)" },
      code: "LMS",
      fullForm: "Logistics Management System",
      description: "Trips, documentation, alerts, costing, invoicing and reports.",
      status: "completed",
    },
  },
  {
    keys: ["hr", "human", "hcm"],
    meta: {
      Icon: UserRoundCheck,
      accent: { gradient: "linear-gradient(135deg, #16a34a 0%, #0f766e 100%)", light: "#eaf8df", border: "#b7e7a7", icon: "#15803d", text: "#14532d", glow: "rgba(22, 163, 74, 0.14)" },
      code: "HCM",
      fullForm: "Human Capital Management",
      description: "Onboarding, leave, payroll, settlements, advances and reports.",
      status: "completed",
    },
  },
  {
    keys: [],
    meta: {
      Icon: ScanFace,
      accent: { gradient: "linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)", light: "#fff0f6", border: "#f9a8d4", icon: "#be185d", text: "#831843", glow: "rgba(236, 72, 153, 0.18)" },
      code: "AMS",
      fullForm: "Attendance Management System",
      description: "Biometric Attendances with geo location , shifts, OT , Integration , Reports.",
      status: "completed",
    },
    external: { url: "https://ams-new.bayanattechnology.com" },
  },
  {
    keys: ["security"],
    meta: {
      Icon: ShieldCheck,
      accent: { gradient: "linear-gradient(135deg, #64748b 0%, #2563eb 100%)", light: "#f1f5f9", border: "#cbd5e1", icon: "#334155", text: "#1e293b", glow: "rgba(100, 116, 139, 0.18)" },
      code: "Security",
      fullForm: "Security and Access Management",
      description: "Users, roles, access control, permissions and audit.",
      status: "completed",
    },
  },
  {
    keys: ["other", "aps", "application"],
    meta: {
      Icon: Globe,
      accent: { gradient: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)", light: "#ecfeff", border: "#a5f3fc", icon: "#0891b2", text: "#164e63", glow: "rgba(6, 182, 212, 0.18)" },
      code: "Other",
      fullForm: "Operational Applications",
      description: "Operational workflows, integrations and reports.",
      status: "completed",
    },
  },
];

const fallbackIcons = [Layers, Package, Boxes, Truck, Building2, ArrowRightLeft, Factory, Gauge];
// const completedModuleOrder = ["WMS", "Finance", "HCM", "EMS", "MMS", "VMS", "PAMS", "LMS", "Other"];

function isSecurityModule(app: MenuNode) {
  const text = `${app.title} ${app.id || ""}`.toLowerCase();
  return text.includes("security");
}

//
const trailingCodes = ["EMS","HCM","AMS"];

const appLaunchGroups = [
  {
    key: "operations",
    title: "Operations Suite",
    subtitle: "Warehouse, freight, transport and maintenance operations",
    codes: ["WMS", "FMS", "TMS", "MMS"],
    tone: "operations",
  },
  {
    key: "business",
    title: "Business Suite",
    subtitle: "Finance, vendor and customer management workflows",
    codes: ["FINANCE", "VMS", "CMS", "PURCHASE_SALES"],
    tone: "business",
  },
  {
    key: "people",
    title: "Workforce Suite",
    subtitle: "Employee, HR and attendance applications",
    codes: ["EMS", "HCM", "AMS", "LMS"],
    tone: "people",
  },
];

function getSortWeight(code: string, catalogOrder: string[]) {
  if (trailingCodes.includes(code)) {
    return catalogOrder.length - 0.5;
  }
  const index = catalogOrder.indexOf(code);
  return index === -1 ? catalogOrder.length : index;
}

function sortAppsByDisplayOrder(apps: MenuNode[]) {
  const catalogOrder = moduleCatalog.map((entry) => entry.meta.code);
  return [...apps].sort((first, second) => {
    const firstCode = getModuleMeta(first, 0).code;
    const secondCode = getModuleMeta(second, 0).code;
    const normalizedFirst = getSortWeight(firstCode, catalogOrder);
    const normalizedSecond = getSortWeight(secondCode, catalogOrder);
    return normalizedFirst - normalizedSecond || first.title.localeCompare(second.title);
  });
}

export function AppSelectionPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user, menuTree, logout } = useAuth();
  const navigate = useNavigate();
  const workspaceApps = useMemo(() => buildWorkspaceApps(menuTree), [menuTree]);
  const canOpenSupportCenter = useMemo(() => isLikelySupportAdmin(user), [user]);
  const supportApp = useMemo(() => workspaceApps.find((app) => isBtSupportApp(app)), [workspaceApps]);
  const securityApp = useMemo(() => workspaceApps.find((app) => isSecurityModule(app)), [workspaceApps]);
  const coreApps = useMemo(
    () => workspaceApps.filter((app) => !isUtilitiesApp(app) && !isSecurityModule(app) && !isBtSupportApp(app)),
    [workspaceApps]
  );
  const btMastersApp = useMemo(() => workspaceApps.find((app) => isBtMastersApp(app)) || workspaceApps.find((app) => isUtilitiesApp(app)), [workspaceApps]);
  const hasUtilityCards = Boolean((canOpenSupportCenter && supportApp) || securityApp || btMastersApp);
  const displayCoreApps = useMemo(() => sortAppsByDisplayOrder(coreApps), [coreApps]);

  const displayCards = useMemo(() => {
    const appCards = displayCoreApps.map((app, index) => ({
      kind: "app" as const,
      key: app.id || app.title,
      app,
      meta: getModuleMeta(app, index),
    }));

    const presentCodes = new Set(appCards.map((c) => c.meta.code));

    const externalCards = moduleCatalog
      .filter((entry) => entry.external && !presentCodes.has(entry.meta.code))
      .map((entry) => ({
        kind: "external" as const,
        key: `external-${entry.meta.code}`,
        meta: entry.meta,
        url: entry.external!.url,
      }));

    const catalogOrderCodes = moduleCatalog.map((entry) => entry.meta.code);
    return [...appCards, ...externalCards].sort(
      (a, b) => getSortWeight(a.meta.code, catalogOrderCodes) - getSortWeight(b.meta.code, catalogOrderCodes)
    );
  }, [displayCoreApps]);

  const groupedDisplayCards = useMemo(() => {
    const groups = appLaunchGroups.map((group) => ({ ...group, cards: [] as typeof displayCards }));
    const otherGroup = {
      key: "other",
      title: "Additional Apps",
      subtitle: "Other permitted applications",
      codes: [] as string[],
      tone: "other",
      cards: [] as typeof displayCards,
    };
    displayCards.forEach((card) => {
      const code = card.meta.code.toUpperCase();
      const group = groups.find((item) => item.codes.includes(code)) || otherGroup;
      group.cards.push(card);
    });
    return [...groups, otherGroup].filter((group) => group.cards.length > 0);
  }, [displayCards]);

//   const trailingBreakIndex = useMemo(() => {
//   return displayCoreApps.findIndex((app) => {
//     const weight = getSortWeight(getModuleMeta(app, 0).code, catalogOrderCodes);
//     return weight >= catalogOrderCodes.length - 0.5;
//   });
// }, [displayCoreApps, catalogOrderCodes]);
  const openApp = (app: MenuNode) => {
    const firstPath = firstLeafPath(app);
    navigate(`/workspace/${cleanAppCode(app.title)}${firstPath ? `/${firstPath}` : ""}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`app app-selection-shell${dark ? " dark" : ""}`}>
      <header className="selection-header app-launch-header">
        <div className="brand-mini">
          <span className="brand-logo-shell">
            <img src="/bayanat-logo.png" alt="Bayanat Technology" className="brand-logo" />
          </span>
          <div className="brand-wordmark">
            <strong>Bayanat</strong>
            <span>Technology</span>
          </div>
        </div>
        <HeaderProfile user={user} dark={dark} onToggleTheme={onToggleTheme} onLogout={handleLogout} />
      </header>

      <main className="selection-main app-launch-main">
        {menuTree.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={34} />
            <h2>No modules available</h2>
            <p>Your login is valid, but no permission menu was returned by the backend.</p>
          </div>
        ) : (
          <div className="app-launch-sections">
            <section className="app-launch-section">
              <div className="app-launch-section-title">
                <span>Core Apps</span>
              </div>

              <div className="app-core-groups">
                {groupedDisplayCards.map((group) => (
                  <div className={`app-core-group app-core-group--${group.tone}`} key={group.key}>
                    <div className="module-grid app-launch-grid app-core-group-grid">
                      {group.cards.map((card) => (
                        <ModuleCard
                          key={card.key}
                          childCount={card.kind === "app" ? (card.app.children?.length || 0) : 0}
                          screenCount={card.kind === "app" ? flattenLeaves(card.app.children || []).length : 0}
                          meta={card.meta}
                          isExternal={card.kind === "external"}
                          onClick={() =>
                            card.kind === "external"
                              ? window.open(card.url, "_blank", "noopener,noreferrer")
                              : openApp(card.app)
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {hasUtilityCards ? (
              <section className="app-launch-section app-launch-utility-section">
                <div className="app-launch-section-title">
                  <span>Utilities</span>
                </div>
                <div className="utility-card-grid">
                  {canOpenSupportCenter && supportApp ? (
                    <UtilityAppCard app={supportApp} meta={getModuleMeta(supportApp, 0)} onClick={() => openApp(supportApp)} />
                  ) : null}
                  {securityApp ? (
                    <UtilityAppCard app={securityApp} meta={getModuleMeta(securityApp, 0)} onClick={() => openApp(securityApp)} />
                  ) : null}
                  {btMastersApp ? <BtMastersCard app={btMastersApp} onClick={() => openApp(btMastersApp)} /> : null}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function ModuleCard({
  childCount,
  screenCount,
  meta,
  onClick,
  isExternal = false,
}: {
  childCount: number;
  screenCount: number;
  meta: ModuleMeta;
  onClick: () => void;
  isExternal?: boolean;
}) {
  const Icon = meta.Icon;
  const cardStyle = {
    "--module-gradient": meta.accent.gradient,
    "--module-light": meta.accent.light,
    "--module-border": meta.accent.border,
    "--module-icon": meta.accent.icon,
    "--module-text": meta.accent.text,
    "--module-glow": meta.accent.glow,
  } as CSSProperties;

  return (
    <button className="module-card app-module-card" onClick={onClick} style={cardStyle}>
      <span className="app-module-card__bar" />
      <div className="app-module-card__top">
        <span className="app-module-card__icon">
          <Icon size={24} />
        </span>
        {/* <span className="app-module-card__badges">
          {meta.status === "in-progress" ? <span className="app-module-card__status">In progress</span> : null}
          <span className="app-module-card__badge">{childCount} GRP</span>
        </span> */}

        <span className="app-module-card__badges">
          {isExternal ? (
            <span className="app-module-card__status">External</span>
          ) : meta.status === "in-progress" ? (
            <span className="app-module-card__status">In progress</span>
          ) : null}
          {!isExternal ? <span className="app-module-card__badge">{childCount} GRP</span> : null}
        </span>
      </div>
      <Icon size={86} className="app-module-card__watermark" aria-hidden="true" />
      <div className="app-module-card__copy">
        <h2><span>B<sup>T</sup>-</span>{meta.code}</h2>
        <em>({meta.fullForm})</em>
        <p>{meta.description}</p>
      </div>
      <div className="app-module-card__footer">
        <span>{isExternal ? "Opens in new tab" : `${screenCount} screen${screenCount === 1 ? "" : "s"}`}</span>
        <strong>
          OPEN {isExternal ? <ExternalLink size={13} /> : <ChevronRight size={14} />}
        {/* <span>{screenCount} screen{screenCount === 1 ? "" : "s"}</span>
        <strong>
          OPEN <ChevronRight size={14} /> */}
        </strong>
      </div>
      <span className="app-module-card__ambient" aria-hidden="true" />
    </button>
  );
}

function BtMastersCard({ app, onClick }: { app: MenuNode; onClick: () => void }) {
  const sourceModules = app.children || [];
  const masterScreens = flattenLeaves(sourceModules).length;
  const preview = sourceModules.slice(0, 3);
  const hiddenCount = Math.max(sourceModules.length - preview.length, 0);
  const cardStyle = {
    "--module-gradient": "linear-gradient(135deg, #0f172a 0%, #2563eb 52%, #14b8a6 100%)",
    "--module-light": "#eef6ff",
    "--module-border": "#93c5fd",
    "--module-icon": "#0f4fa8",
    "--module-text": "#0f172a",
    "--module-glow": "rgba(37, 99, 235, 0.22)",
  } as CSSProperties;

  return (
    <button className="utility-card bt-masters-card" onClick={onClick} style={cardStyle}>
      <span className="utility-card__icon">
        <Sparkles size={12} className="app-module-card__spark" />
        <FolderCog size={22} />
      </span>
      <FolderCog size={78} className="utility-card__watermark" aria-hidden="true" />
      <div className="utility-card__copy">
        <h2><span>B<sup>T</sup>-</span>Masters</h2>
        <em>(General Masters)</em>
      </div>
      <div className="bt-masters-card__modules">
        {preview.map((module) => (
          <span key={module.id || module.title}>
            {module.title}
            <strong>{flattenLeaves(module.children || []).length}</strong>
          </span>
        ))}
        {hiddenCount > 0 ? <span>+{hiddenCount} more</span> : null}
      </div>
      <div className="bt-masters-card__footer">
        <span>{masterScreens} master screen{masterScreens === 1 ? "" : "s"}</span>
        <strong>
          OPEN <ChevronRight size={14} />
        </strong>
      </div>
    </button>
  );
}

function UtilityAppCard({ app, meta, onClick }: { app: MenuNode; meta: ModuleMeta; onClick: () => void }) {
  const Icon = meta.Icon;
  const screenCount = flattenLeaves(app.children || []).length;
  const cardStyle = {
    "--module-gradient": meta.accent.gradient,
    "--module-light": meta.accent.light,
    "--module-border": meta.accent.border,
    "--module-icon": meta.accent.icon,
    "--module-text": meta.accent.text,
    "--module-glow": meta.accent.glow,
  } as CSSProperties;

  return (
    <button className="utility-card" type="button" onClick={onClick} style={cardStyle}>
      <span className="utility-card__icon">
        <Icon size={22} />
      </span>
      <Icon size={78} className="utility-card__watermark" aria-hidden="true" />
      <div className="utility-card__copy">
        <h2><span>B<sup>T</sup>-</span>{meta.code}</h2>
        <em>({meta.fullForm})</em>
        <p>{meta.description}</p>
      </div>
      <div className="bt-masters-card__footer">
        <span>{screenCount} screen{screenCount === 1 ? "" : "s"}</span>
        <strong>OPEN <ChevronRight size={14} /></strong>
      </div>
    </button>
  );
}

export function getModuleMeta(app: MenuNode, index: number): ModuleMeta {
  const text = `${app.title} ${app.id || ""}`.toLowerCase();
  const matched = moduleCatalog.find(({ keys }) => keys.some((key) => text.includes(key)));
  if (matched) return matched.meta;
  const Icon = fallbackIcons[index % fallbackIcons.length];
  const accent = defaultAccents[index % defaultAccents.length];
  return {
    Icon,
    accent,
    code: app.title.toUpperCase(),
    fullForm: "Operational Application",
    description: "Operational workflows, integrations and reports.",
    status: "completed",
  };
}

function isLikelySupportAdmin(user: unknown) {
  const record = (user || {}) as Record<string, unknown>;
  const supportAdminLoginIds = new Set(["ADMIN", "2012020136"]);
  const values = [record.loginid, record.LOGINID, record.username, record.USERNAME, record.role, record.user_role, record.USER_ROLE, record.isAdmin]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim().toUpperCase());
  return values.some((value) => supportAdminLoginIds.has(value) || value === "Y" || value === "TRUE" || value.includes("ADMIN"));
}
