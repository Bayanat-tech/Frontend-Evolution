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
import { firstLeafPath } from "../utils/menu";
import { buildWorkspaceApps, cleanAppCode, isBtMastersApp, isUtilitiesApp } from "../utils/workspaceApps";

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
    keys: ["ims", "inventory management", "purchase_sales", "purchase-sales", "purchase sales"],
    meta: {
      Icon: Boxes,
      accent: { gradient: "linear-gradient(135deg, #3b82f6 0%, #0f766e 100%)", light: "#eaf3ff", border: "#a8c8ff", icon: "#0f4fa8", text: "#0f2f64", glow: "rgba(59, 130, 246, 0.18)" },
      code: "IMS",
      fullForm: "Inventory Management System",
      description: "Purchases, sales, stock movements, production and inventory reports.",
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
  // {
  //   keys: [],
  //   meta: {
  //     Icon: ScanFace,
  //     accent: { gradient: "linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)", light: "#fff0f6", border: "#f9a8d4", icon: "#be185d", text: "#831843", glow: "rgba(236, 72, 153, 0.18)" },
  //     code: "AMS",
  //     fullForm: "Attendance Management System",
  //     description: "Biometric Attendances with geo location , shifts, OT , Integration , Reports.",
  //     status: "completed",
  //   },
  //   external: { url: "https://ams-new.bayanattechnology.com" },
  // },
  
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

export function AppSelectionPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { user, menuTree, logout } = useAuth();
  const navigate = useNavigate();
  const workspaceApps = useMemo(() => buildWorkspaceApps(menuTree), [menuTree]);
  const findApp = (code: string) => workspaceApps.find((app) => getModuleMeta(app, 0).code === code);
  const openApp = (app: MenuNode) => {
    const code = cleanAppCode(app.title);
    if (code === "finance") {
      navigate("/workspace/finance");
      return;
    }
    const firstPath = firstLeafPath(app);
    navigate(`/workspace/${code}${firstPath ? `/${firstPath}` : ""}`);
  };
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  const catalogMeta = (code: string) => moduleCatalog.find((entry) => entry.meta.code === code)!.meta;
  const renderApp = (code: string, overrides: Partial<ModuleMeta> = {}) => {
    const app = findApp(code);
    if (!app) return null;
    return <ModuleCard key={code} meta={{ ...catalogMeta(code), ...overrides }} onClick={() => openApp(app)} />;
  };
  const mastersApp = workspaceApps.find(isBtMastersApp) || workspaceApps.find(isUtilitiesApp);
  const securityApp = findApp("Security");
  const sections = [
    {
      id: "erp", title: "ERP",
      cards: [
        renderApp("Finance"),
        renderApp("HCM", { description: "Leave management and attendance management." }),
        renderApp("IMS", { description: "Purchases, sales, stock movements, production, inventory and maintenance management." }),
      ],
    },
    {
      id: "supply", title: "Supply Chain Extensions",
      cards: [
        renderApp("WMS"), renderApp("FMS"),
        renderApp(findApp("LMS") ? "LMS" : "TMS", { code: "TMS", fullForm: "Transport Management System", Icon: Route }),
      ],
    },
    {
      id: "onboarding", title: "Unified Onboarding & Self-Service",
      cards: findApp("VMS") ? [
        <ModuleCard key="customer" meta={{ ...catalogMeta("CMS"), fullForm: "Customer Onboarding" }} />,
        renderApp("VMS", { fullForm: "Vendor Onboarding" }),
        <ModuleCard key="employee" meta={{ ...catalogMeta("EMS"), fullForm: "Employee Onboarding" }} />,
      ] : [],
    },
    {
      id: "utilities", title: "Utilities",
      cards: securityApp || mastersApp ? [
        <ModuleCard key="support" meta={{ ...catalogMeta("Security"), code: "Support", fullForm: "Support Ticketing System", description: "Support and development tickets with resolution tracking.", Icon: LifeBuoy }} />,
        securityApp ? <ModuleCard key="security" meta={catalogMeta("Security")} onClick={() => openApp(securityApp)} /> : null,
        mastersApp ? <ModuleCard key="masters" meta={{ ...catalogMeta("Security"), code: "Masters", fullForm: "General Masters", description: "General masters for your permitted applications.", Icon: FolderCog }} onClick={() => openApp(mastersApp)} /> : null,
      ] : [],
    },
  ].map((section) => ({ ...section, cards: section.cards.filter((card) => card !== null) }))
    .filter((section) => section.cards.length > 0);
  const launcherStyle = {
    "--hub-section-count": sections.length || 1,
    "--hub-columns": Math.max(1, ...sections.map((section) => section.cards.length)),
  } as CSSProperties;


  return (
    <div className={`app app-selection-shell${dark ? " dark" : ""}`}>
      <header className="selection-header app-launch-header">
        <div className="brand-mini">
          <span className="brand-logo-shell"><img src="/bayanat-logo.png" alt="Bayanat Technology" className="brand-logo" /></span>
          <div className="brand-wordmark"><strong>Bayanat</strong><span>Technology</span></div>
        </div>
        <HeaderProfile user={user} dark={dark} onToggleTheme={onToggleTheme} onLogout={handleLogout} />
      </header>
      <main className="selection-main app-launch-main" style={launcherStyle}>
        {sections.length === 0 ? (
          <div className="empty-state"><ShieldCheck size={34} /><h2>No modules available</h2><p>No application modules are assigned to your account.</p></div>
        ) : (
          <div className="app-launch-sections">
            <h1 className="app-launch-title"><Layers size={20} aria-hidden="true" />Enterprise Portal</h1>
            {sections.map((section) => (
              <section key={section.id} className="app-launch-section" aria-labelledby={section.id + "-heading"}>
                <h2 id={section.id + "-heading"} className="app-launch-section-title">{section.title}</h2>
                <div className={`module-grid app-launch-grid${section.id === "onboarding" ? " app-launch-onboarding-grid" : ""}`}>
                  {section.cards}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ModuleCard({ meta, onClick }: { meta: ModuleMeta; onClick?: () => void }) {
  const Icon = meta.Icon;
  const cardStyle = {
    "--module-gradient": meta.accent.gradient,
    "--module-light": meta.accent.light,
    "--module-border": meta.accent.border,
    "--module-icon": meta.accent.icon,
    "--module-text": meta.accent.text,
    "--module-glow": meta.accent.glow,
  } as CSSProperties;
  const content = <>
    <span className="app-module-card__bar" />
    <div className="app-module-card__top"><span className="app-module-card__icon"><Icon size={24} /></span></div>
    <Icon size={86} className="app-module-card__watermark" aria-hidden="true" />
    <div className="app-module-card__copy">
      {onClick ? <><h2><span>B<sup>T</sup>-</span>{meta.code}</h2><em>({meta.fullForm})</em><p>{meta.description}</p></> : <h2>{meta.fullForm}</h2>}
    </div>
    <div className="app-module-card__footer">
      {onClick ? <strong>OPEN <ChevronRight size={14} /></strong> : <span className="app-module-card__coming-soon">Coming soon</span>}
    </div>
  </>;
  return onClick ? (
    <button type="button" className="module-card app-module-card" onClick={onClick} style={cardStyle}>{content}</button>
  ) : (
    <div className="module-card app-module-card app-module-card--static" style={cardStyle}>{content}</div>
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
