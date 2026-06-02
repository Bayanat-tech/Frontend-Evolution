import {
  Activity,
  Anchor,
  Archive,
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
import type { MenuNode } from "../types/auth";
import { cleanPath, flattenLeaves, titleCase } from "../utils/menu";
import { resolveWorkspaceRoute } from "../routes/workspaceRoutes";
import { cn } from "../lib/utils";

export function WorkspacePage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { appCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, menuTree, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeApp = useMemo(() => {
    return menuTree.find((item) => item.title.toLowerCase().replace(/\s+/g, "-") === appCode) || menuTree[0];
  }, [appCode, menuTree]);

  const leaves = useMemo(() => flattenLeaves(activeApp?.children || []), [activeApp]);
  const activeLeaf = leaves.find((leaf) => {
    return isPathActive(cleanPath(leaf.url_path), location.pathname);
  });

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth <= 768) setCollapsed(true);
  }, [location.pathname]);

  const workspaceRoute = resolveWorkspaceRoute({ pathname: location.pathname, activeApp });

  return (
    <div className="workspace">
      <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
        <div className="sidebar-top">
          <Link to="/apps" className={collapsed ? "sidebar-brand logo-only" : "sidebar-brand"} title="Bayanat Technology">
            <span className="sidebar-logo-wrap">
              <img src="/bayanat-logo.png" alt="Bayanat Technology" className="sidebar-logo" />
            </span>
            {!collapsed && (
              <span className="sidebar-brand-copy">
                <strong>Bayanat</strong>
                <small>Technology</small>
              </span>
            )}
          </Link>
          <button
            className="icon-button sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <Menu size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        {!collapsed && <p className="sidebar-label">{titleCase(activeApp?.title || "Workspace")}</p>}

        <nav className="sidebar-nav">
          {(activeApp?.children || []).map((item) => (
            <MenuItem
              key={item.id || item.title}
              item={item}
              collapsed={collapsed}
              expanded={expanded}
              setExpanded={setExpanded}
              appCode={appCode || ""}
              pathname={location.pathname}
              level={1}
            />
          ))}
        </nav>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-search">
            <Search size={16} />
            <input placeholder="Search menu, reports, forms..." />
          </div>
          <button className="icon-button" onClick={onToggleTheme} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div className="header-user compact">
            <div className="avatar">{(user?.username || user?.loginid || "U").slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{user?.username || user?.loginid}</strong>
              <span>{user?.company_code || "Company"}</span>
            </div>
            <button className="icon-button" onClick={handleLogout}>
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="workspace-content">
          <nav className="breadcrumb">
            <Link to="/apps">
              <Home size={14} /> Home
            </Link>
            <ChevronRight size={14} />
            <span>{titleCase(activeApp?.title || "Workspace")}</span>
            {activeLeaf && (
              <>
                <ChevronRight size={14} />
                <span>{titleCase(activeLeaf.title)}</span>
              </>
            )}
          </nav>

          {workspaceRoute}
        </main>
      </section>
    </div>
  );
}

function MenuItem({
  item,
  collapsed,
  expanded,
  setExpanded,
  appCode,
  pathname,
  level,
}: {
  item: MenuNode;
  collapsed: boolean;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
  appCode: string;
  pathname: string;
  level: number;
}) {
  const key = item.id || item.title;
  const children = item.children || [];
  const hasChildren = children.length > 0;
  const path = cleanPath(item.url_path);
  const to = path ? `/workspace/${appCode}/${path}` : "#";
  const active = isMenuNodeActive(item, pathname);
  const shouldRenderChildren = !collapsed && expanded[key];

  if (hasChildren) {
    return (
      <div className={cn("nav-group", collapsed && "collapsed", `nav-level-${level}`)}>
        <button
          className={cn("nav-item", active && "active", collapsed && "icon-only", `nav-level-${level}`)}
          onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
          title={collapsed ? titleCase(item.title) : undefined}
        >
          <span className="nav-link-copy">
            <MenuIcon item={item} level={level} className="nav-leading-icon" />
            {!collapsed && <span>{titleCase(item.title)}</span>}
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link className={cn("nav-item", active && "active", collapsed && "icon-only", `nav-level-${level}`)} to={to} title={collapsed ? titleCase(item.title) : undefined}>
      <span className="nav-link-copy">
        <MenuIcon item={item} level={level} className="nav-leading-icon" />
        {!collapsed && <span>{titleCase(item.title)}</span>}
      </span>
    </Link>
  );
}

function MenuIcon({ item, level, className }: { item: MenuNode; level: number; className?: string }) {
  if (level >= 3) return <span className={cn("nav-dot", className)} aria-hidden="true" />;
  const Icon = getMenuIcon(item);
  return <Icon className={className} size={level === 1 ? 16 : 15} aria-hidden="true" />;
}

function getMenuIcon(item: MenuNode): LucideIcon {
  const text = `${item.title || ""} ${item.url_path || ""}`.toLowerCase();
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
