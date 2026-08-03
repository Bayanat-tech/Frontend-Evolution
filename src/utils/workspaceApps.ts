import type { MenuNode } from "../types/auth";

export function buildWorkspaceApps(menuTree: MenuNode[]): MenuNode[] {
  const mastersApp = buildBtMastersApp(menuTree);
  const normalizedApps = menuTree.map(normalizeApplicationRoutes);
  const withSupport = normalizedApps.some((item) => isBtSupportApp(item))
    ? normalizedApps
    : [...normalizedApps, buildBtSupportApp()];
  if (!mastersApp) return withSupport;

  // APP_CODE=MASTERS is represented by the BT Masters utility only. Do not
  // expose it again as a standalone core application.
  const visibleApps = withSupport.filter(
    (item) => !isDedicatedMastersApp(item) && !isBtMastersApp(item),
  );
  return [...visibleApps, mastersApp];
}

export function cleanAppCode(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
}

export function isUtilitiesApp(node?: MenuNode | null) {
  const title = normalizeTitle(node?.title || "");
  return title === "bt masters" || title === "utilities";
}

export function isBtMastersApp(node?: MenuNode | null) {
  return normalizeTitle(node?.title || "") === "bt masters";
}

export function isBtSupportApp(node?: MenuNode | null) {
  return normalizeTitle(node?.title || "") === "bt support";
}

export function buildBtSupportApp(): MenuNode {
  return {
    id: "virtual-bt-support",
    title: "BT SUPPORT",
    type: "group",
    children: [
      {
        id: "bt-support-center",
        title: "Support Center",
        type: "collapse",
        children: [
          {
            id: "bt-support-admin-dashboard",
            title: "Admin Dashboard",
            type: "item",
            url_path: "support/admin",
          },
          {
            id: "bt-support-developer-assignment",
            title: "Developer Assignment",
            type: "item",
            url_path: "support/developer-assignment",
          },
          {
            id: "bt-support-developer-workbench",
            title: "Developer Workbench",
            type: "item",
            url_path: "support/developer-workbench",
          },
        ],
      },
    ],
  };
}

const securityRoutes: Record<string, string> = {
  "masters/general master/company": "security/masters/gm/company",
  "masters/general_master/company": "security/masters/gm/company",
  "masters/general master/flow assignment": "security/masters/gm/flow_assignment",
  "masters/general_master/flow_assignment": "security/masters/gm/flow_assignment",
  "users/sec login": "security/masters/gm/sec_login",
  "roles/role master": "security/masters/gm/role_master",
  "user access/company": "security/masters/gm/sec_company",
  "user access/modules": "security/masters/gm/sec_module_data",
  "user access/project": "security/masters/gm/project_access",
  "user access/roles": "security/masters/gm/access_assign_role",
  "user access/division": "security/masters/gm/user_division_access",
  "user access/screens": "security/masters/gm/access_assign_user",
  "tenants/users": "security/masters/tenant_masters/tenant_user",
  "tenants/registry": "security/masters/tenant_masters/tenant_registry",
  "tenants/mapping": "security/masters/tenant_masters/tenant_mapping",
};

function normalizeApplicationRoutes(app: MenuNode): MenuNode {
  if (normalizeTitle(app.title) !== "security") return app;

  const walk = (nodes: MenuNode[], trail: string[]): MenuNode[] => nodes.map((node) => {
    const nextTrail = [...trail, normalizeTitle(node.title)];
    const children = walk(node.children || [], nextTrail);
    const route = children.length === 0 ? securityRoutes[nextTrail.join("/")] : undefined;
    return {
      ...node,
      ...(route ? { url_path: route, type: "item" as const } : {}),
      ...(children.length > 0 ? { children } : { children: undefined }),
    };
  });

  return { ...app, children: walk(app.children || [], []) };
}

export function buildBtMastersApp(menuTree: MenuNode[]): MenuNode | null {
  const sourceApp = menuTree.find((app) => isDedicatedMastersApp(app));
  const existingBtMasters = menuTree.find((app) => isBtMastersApp(app));

  if (!sourceApp) return existingBtMasters || null;

  return {
    id: "virtual-bt-masters",
    title: "BT MASTERS",
    type: "group",
    children: normalizeBtMasterRoutes(sourceApp.children || []),
  };
}

const btMasterRoutes: Record<string, string> = {
  company: "security/masters/gm/company",
  division: "wms/masters/gm/division",
  department: "wms/masters/gm/department",
  salesman: "wms/masters/gm/salesman",
  supplier: "wms/masters/gm/supplier",
  partner: "wms/masters/gm/partner",
  country: "wms/masters/gm/country",
  ports: "wms/masters/gm/port",
  port: "wms/masters/gm/port",
  currency: "wms/masters/gm/currency",
  airline: "wms/masters/gm/airline",
  vessels: "wms/masters/gm/vessel",
  vessel: "wms/masters/gm/vessel",
  line: "wms/masters/gm/line",
  "hs codes": "wms/masters/gm/harmonize",
  "hs code": "wms/masters/gm/harmonize",
};

function normalizeBtMasterRoutes(nodes: MenuNode[]): MenuNode[] {
  return nodes.map((node) => {
    const children = normalizeBtMasterRoutes(node.children || []);
    const route = children.length === 0 ? btMasterRoutes[normalizeTitle(node.title)] : undefined;
    return {
      ...node,
      ...(route ? { url_path: route, type: "item" as const } : {}),
      ...(children.length > 0 ? { children } : { children: undefined }),
    };
  });
}

function isDedicatedMastersApp(node?: MenuNode | null) {
  return normalizeTitle(node?.title || "") === "masters";
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
