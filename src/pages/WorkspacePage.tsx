import {
  Activity,
  Anchor,
  Archive,
  ArrowLeft,
  BadgeDollarSign,
  Ban,
  BarChart3,
  Boxes,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  CircleDot,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileText,
  FolderCog,
  Globe2,
  GraduationCap,
  Home,
  Landmark,
  Layers,
  Languages,
  LayoutGrid,
  LogOut,
  Map,
  MapPin,
  Menu,
  Moon,
  Package,
  PackageCheck,
  PanelLeftClose,
  Plane,
  Receipt,
  RefreshCw,
  Ruler,
  Search,
  Settings,
  Ship,
  ShoppingCart,
  Sun,
  Tags,
  Truck,
  UserRoundCheck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { HeaderProfile } from "../components/HeaderProfile";
import { SupportChatWidget } from "../components/SupportChatWidget";
import type { MenuNode } from "../types/auth";
import { cleanPath, flattenLeaves, titleCase } from "../utils/menu";
import { buildWorkspaceApps, cleanAppCode } from "../utils/workspaceApps";
import { resolveWorkspaceRoute } from "../routes/workspaceRoutes";
import { cn } from "../lib/utils";
import { getModuleMeta } from "./AppSelectionPage";

export function WorkspacePage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { appCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, menuTree, logout } = useAuth();
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const workspaceApps = useMemo(() => buildWorkspaceApps(menuTree), [menuTree]);

  const activeApp = useMemo(() => {
    return workspaceApps.find((item) => cleanAppCode(item.title) === appCode) || workspaceApps[0];
  }, [appCode, workspaceApps]);

  const activeMenuPath = useMemo(() => findActiveMenuPath(activeApp?.children || [], location.pathname), [activeApp, location.pathname]);
  const activeMenu = activeMenuPath[activeMenuPath.length - 1];
  const appRouteTarget = getMenuNodeTarget(activeApp, appCode || "");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const syncMobileState = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileMenuOpen(false);
    };
    syncMobileState();
    media.addEventListener("change", syncMobileState);
    return () => media.removeEventListener("change", syncMobileState);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const shouldLock = isMobile && mobileMenuOpen;
    document.body.classList.toggle("mobile-menu-lock", shouldLock);
    return () => document.body.classList.remove("mobile-menu-lock");
  }, [isMobile, mobileMenuOpen]);

  const workspaceRoute = resolveWorkspaceRoute({ pathname: location.pathname, activeApp, activeMenu });
  const displayCollapsed = isMobile ? false : collapsed;
  const userDisplayName = user?.username || user?.loginid || "User";
  const companyName = user?.company_name || user?.company_code || "Company";
  const isFreightLandingRoute = useMemo(() => {
    const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, "");
    return (appCode || "").toLowerCase() === "fms" && (normalizedPath === "/workspace/fms" || normalizedPath === "/workspace/fms/fms");
  }, [appCode, location.pathname]);

  // useEffect(() => {
  //   setExpanded(collectExpandedPath(activeMenuPath));
  // }, [activeApp?.id, activeApp?.title, location.pathname]);

  useEffect(() => {
    setExpanded({
      ...collectDefaultExpanded(activeApp?.children || [], 1),
      ...collectExpandedPath(activeMenuPath),
    });
  }, [activeApp?.id, activeApp?.title, location.pathname]);

  useEffect(() => {
    if (!isMobile && isFreightLandingRoute) {
      setCollapsed(true);
    }
  }, [isFreightLandingRoute, isMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen((value) => !value);
      return;
    }
    setCollapsed((value) => {
      const nextCollapsed = !value;
      if (!nextCollapsed) {
        // setExpanded(collectExpandedPath(activeMenuPath));
         setExpanded({
          ...collectDefaultExpanded(activeApp?.children || [], 1),
          ...collectExpandedPath(activeMenuPath),
        });
      }
      return nextCollapsed;
    });
  };

  const handleMenuNavigate = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
      return;
    }
    setCollapsed(true);
  };

  return (
    <div className="workspace">
      <aside className={cn("sidebar", displayCollapsed && "collapsed", isMobile && "mobile-sidebar", mobileMenuOpen && "mobile-open")}>
        <div className="sidebar-top">
          <Link to="/apps" className={displayCollapsed ? "sidebar-brand logo-only" : "sidebar-brand"} title="Bayanat Technology">
            <span className="sidebar-logo-wrap">
              <img src="/bayanat-logo.png" alt="Bayanat Technology" className="sidebar-logo" />
            </span>
            {!displayCollapsed && (
              <span className="sidebar-brand-copy">
                <strong>Bayanat</strong>
                <small>Technology</small>
              </span>
            )}
          </Link>
          <button
            className="icon-button sidebar-toggle"
            onClick={toggleSidebar}
            title={isMobile ? (mobileMenuOpen ? "Close menu" : "Open menu") : displayCollapsed ? "Expand menu" : "Collapse menu"}
            aria-label={isMobile ? (mobileMenuOpen ? "Close menu" : "Open menu") : displayCollapsed ? "Expand menu" : "Collapse menu"}
          >
            {isMobile ? mobileMenuOpen ? <PanelLeftClose size={17} /> : <Menu size={17} /> : displayCollapsed ? <Menu size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

         {!displayCollapsed && (
            <p className="sidebar-label" title={activeApp ? getModuleMeta(activeApp, 0).fullForm : "Workspace"}>
             {activeApp ? getModuleMeta(activeApp, 0).fullForm : "Workspace"}
            </p>
         )}

        <nav className="sidebar-nav">
          {(activeApp?.children || []).map((item) => (
            <MenuItem
              key={item.id || item.title}
              item={item}
              collapsed={displayCollapsed}
              expanded={expanded}
              setExpanded={setExpanded}
              appCode={appCode || ""}
              pathname={location.pathname}
              level={1}
              onNavigate={handleMenuNavigate}
            />
          ))}
        </nav>

        <div className={cn("sidebar-footer", displayCollapsed && "collapsed")}>
          {!displayCollapsed && (
            <div className="sidebar-company-card">
              <span>Company</span>
              <strong>{companyName}</strong>
            </div>
          )}
          <Link className={cn("sidebar-switch-module", displayCollapsed && "icon-only")} to="/apps" title="Switch Module" aria-label="Switch Module">
            <ArrowLeft size={15} />
            {!displayCollapsed && "Switch Module"}
          </Link>
        </div>
      </aside>
      {isMobile && mobileMenuOpen && <button className="sidebar-backdrop" type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}

      <section className="workspace-main">
        <div className="mobile-appbar">
          <Link to="/apps" className="mobile-brand" aria-label="Bayanat Technology">
            <span className="sidebar-logo-wrap">
              <img src="/bayanat-logo.png" alt="Bayanat Technology" className="sidebar-logo" />
            </span>
          </Link>
          <button className="icon-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu" title="Open menu">
            <Menu size={19} />
          </button>
        </div>
        <header className="workspace-header">
          <div className="workspace-search">
            <Search size={16} />
            <input placeholder="Search menu, reports, forms..." />
          </div>
          <div className="workspace-header-actions">
            <SupportChatWidget />
            <HeaderProfile
              user={user}
              dark={dark}
              onToggleTheme={onToggleTheme}
              onLogout={handleLogout}
            />
          </div>
        </header>

        <main className="workspace-content">
          <nav className="breadcrumb">
            <Link to="/apps">
              <Home size={14} /> Home
            </Link>
            {activeApp && (
              <>
                <ChevronRight size={14} />
                {appRouteTarget ? (
                  <Link to={appRouteTarget}>{titleCase(activeApp.title)}</Link>
                ) : (
                  <span>{titleCase(activeApp.title)}</span>
                )}
              </>
            )}
            {activeMenuPath.map((node, index) => {
              const isLast = index === activeMenuPath.length - 1;
              const target = getMenuNodeTarget(node, appCode || "");
              return (
                <span className="breadcrumb-segment" key={node.id || `${node.title}-${index}`}>
                  <ChevronRight size={14} />
                  {isLast || !target ? (
                    <span className={isLast ? "breadcrumb-current" : undefined}>{titleCase(node.title)}</span>
                  ) : (
                    <Link to={target}>{titleCase(node.title)}</Link>
                  )}
                </span>
              );
            })}
          </nav>

          {workspaceRoute}
        </main>
      </section>
    </div>
  );
}

function collectExpandedPath(nodes: MenuNode[]): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};
  nodes.slice(0, -1).forEach((node) => {
    if (node.children?.length) {
      expanded[node.id || node.title] = true;
    }
  });
  return expanded;
}

function collectDefaultExpanded(nodes: MenuNode[], maxLevel: number, level = 1): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};
  nodes.forEach((node) => {
    if (node.children?.length && level <= maxLevel) {
      expanded[node.id || node.title] = true;
      Object.assign(expanded, collectDefaultExpanded(node.children, maxLevel, level + 1));
    }
  });
  return expanded;
}

function MenuItem({
  item,
  collapsed,
  expanded,
  setExpanded,
  appCode,
  pathname,
  level,
  onNavigate,
}: {
  item: MenuNode;
  collapsed: boolean;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
  appCode: string;
  pathname: string;
  level: number;
  onNavigate: () => void;
}) {
  const key = item.id || item.title;
  const children = item.children || [];
  const hasChildren = children.length > 0;
  const path = cleanPath(item.url_path);
  const to = path ? `/workspace/${appCode}/${path}` : "#";
  const active = isMenuNodeActive(item, pathname);
  const shouldRenderChildren = !collapsed && expanded[key];
  const displayTitle = titleCase(item.title);

  if (hasChildren) {
    return (
      <div className={cn("nav-group", collapsed && "collapsed", `nav-level-${level}`)}>
        <button
          className={cn("nav-item", active && "active", collapsed && "icon-only", `nav-level-${level}`)}
          onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
          title={displayTitle}
          aria-label={displayTitle}
        >
          <span className="nav-link-copy">
            <MenuIcon item={item} level={level} className="nav-leading-icon" />
            {!collapsed && <span title={displayTitle}>{displayTitle}</span>}
          </span>
          {!collapsed && (expanded[key] ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
        </button>
        {shouldRenderChildren && (
          <div className={cn("nav-children", collapsed && "collapsed")}>
            {children.map((child) => (
              <MenuItem
                key={child.id || child.title}
                item={child}
                collapsed={collapsed}
                expanded={expanded}
                setExpanded={setExpanded}
                appCode={appCode}
                pathname={pathname}
                level={level + 1}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link className={cn("nav-item", active && "active", collapsed && "icon-only", `nav-level-${level}`)} to={to} title={displayTitle} aria-label={displayTitle} onClick={onNavigate}>
      <span className="nav-link-copy">
        <MenuIcon item={item} level={level} className="nav-leading-icon" />
        {!collapsed && <span title={displayTitle}>{displayTitle}</span>}
      </span>
    </Link>
  );
}

function MenuIcon({ item, level, className }: { item: MenuNode; level: number; className?: string }) {
  if (level >= 3) return <span className={cn("nav-dot", className)} aria-hidden="true" />;
  const Icon = getMenuIcon(item);
  return <Icon className={className} size={level === 1 ? 15 : 13} aria-hidden="true" />;
}

function getMenuIcon(item: MenuNode): LucideIcon {
  const text = `${item.title || ""} ${item.url_path || ""}`.toLowerCase();
  if (text.includes("freight report")) return FileBarChart;
  if (text.includes("freight air") || text.includes("airline") || text.includes("tariff")) return Plane;
  if (text.includes("freight sea") || text.includes("vessel")) return Ship;
  if (text.includes("freight road")) return Truck;
  if (text.includes("freight") || text.includes("rfq") || text.includes("quotation")) return Ship;
  if (text.includes("country")) return Globe2;
  if (text.includes("division")) return Building2;
  if (text.includes("department") || text.includes("section")) return Archive;
  if (text.includes("transaction")) return Receipt;
  if (text.includes("employee")) return Users;
  if (text.includes("paycomponent") || text.includes("pay component") || text.includes("payroll")) return BadgeDollarSign;
  if (text.includes("main bank") || text.includes("main_bank") || text.includes("bank")) return Landmark;
  if (text.includes("document type") || text.includes("document_type") || text.includes("doctype") || text.includes("doc type")) return FileText;
  if (text.includes("holiday") || text.includes("calendar")) return CalendarDays;
  if (text.includes("category")) return Tags;
  if (text.includes("sponsor")) return UserRoundCheck;
  if (text.includes("contract")) return BriefcaseBusiness;
  if (text.includes("education") || text.includes("discipline") || text.includes("grade")) return GraduationCap;
  if (text.includes("language")) return Languages;
  if (text.includes("skill")) return BadgeDollarSign;
  if (text.includes("designation")) return ClipboardCheck;
  if (text.includes("airport")) return Plane;
  if (text.includes("currency")) return BadgeDollarSign;
  if (text.includes("uom") || text.includes("uoc") || text.includes("unit")) return Ruler;
  if (text.includes("brand")) return Tags;
  if (text.includes("group") || text.includes("subgroup")) return Layers;
  if (text.includes("line")) return Ship;
  if (text.includes("vessel")) return Anchor;
  if (text.includes("airline")) return Plane;
  if (text.includes("location")) return MapPin;
  if (text.includes("site") || text.includes("port")) return Map;
  if (text.includes("customer") || text.includes("supplier") || text.includes("principal")) return Users;
  if (text.includes("user") || text.includes("salesman")) return UserCog;
  if (text.includes("master")) return Settings;
  if (text.includes("finance") || text.includes("account") || text.includes("bank")) return Landmark;
  if (text.includes("payment") || text.includes("receipt") || text.includes("cash") || text.includes("cheque")) return Receipt;
  if (text.includes("invoice") || text.includes("purchase") || text.includes("sales") || text.includes("lpo")) return ShoppingCart;
  if (text.includes("budget")) return BadgeDollarSign;
  if (text.includes("report")) return BarChart3;
  if (text.includes("inbound") || text.includes("receiving")) return PackageCheck;
  if (text.includes("outbound") || text.includes("picking")) return Truck;
  if (text.includes("warehouse") || text.includes("wms") || text.includes("location")) return Warehouse;
  if (text.includes("stock")) return Boxes;
  if (text.includes("shipment") || text.includes("vessel") || text.includes("port")) return Ship;
  if (text.includes("product") || text.includes("brand") || text.includes("group")) return Package;
  if (text.includes("activity")) return Activity;
  if (text.includes("option") || text.includes("setup") || text.includes("utility")) return FolderCog;
  if (text.includes("cancel")) return Ban;
  if (text.includes("rollover") || text.includes("refresh")) return RefreshCw;
  if (text.includes("open") || text.includes("position")) return ClipboardList;
  if (text.includes("closed") || text.includes("confirm")) return ClipboardCheck;
  if (text.includes("document") || text.includes("file")) return FileText;
  if (text.includes("portal") || text.includes("application")) return LayoutGrid;
  if (item.children?.length) return Archive;
  return CircleDot;
}

function isMenuNodeActive(item: MenuNode, pathname: string): boolean {
  const path = cleanPath(item.url_path);
  if (isPathActive(path, pathname)) return true;
  return Boolean(item.children?.some((child) => isMenuNodeActive(child, pathname)));
}

function findActiveMenuPath(items: MenuNode[], pathname: string): MenuNode[] {
  for (const item of items) {
    const path = cleanPath(item.url_path);
    if (isPathActive(path, pathname)) return [item];
    const childPath = findActiveMenuPath(item.children || [], pathname);
    if (childPath.length) return [item, ...childPath];
  }
  return [];
}

function getMenuNodeTarget(item: MenuNode | undefined, appCode: string): string | null {
  if (!item || !appCode) return null;
  const directPath = cleanPath(item.url_path);
  if (directPath) return `/workspace/${appCode}/${directPath}`;
  const firstLeaf = flattenLeaves(item.children || [])[0];
  const firstLeafPath = cleanPath(firstLeaf?.url_path);
  return firstLeafPath ? `/workspace/${appCode}/${firstLeafPath}` : null;
}

function isPathActive(menuPath: string, pathname: string): boolean {
  if (!menuPath) return false;
  const path = normalizeRoutePath(menuPath);
  const current = normalizeRoutePath(pathname);
  return current === path || current.endsWith(`/${path}`);
}

function normalizeRoutePath(path: string) {
  return path
    .replace(/^\/+|\/+$/g, "")
    .replace(/^workspace\/[^/]+\//i, "")
    .toLowerCase();
}
