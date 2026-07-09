import type { MenuNode } from "../types/auth";

const masterSignals = [
  "master",
  "masters",
  "general master",
];

const excludedUtilitySignals = [
  "dashboard",
  "report",
  "reports",
  "transaction",
  "transactions",
  "inbound",
  "outbound",
  "request",
  "approval",
  "task",
  "process",
];

const moduleOwnedMasterSignals = [
  "tenant master",
  "tenant_master",
  "tenant-master",
  "tenant admin",
  "tenant_admin",
  "tenant-admin",
  "tenantadmin",
  "tenet master",
  "tenet_master",
  "tenet-master",
];

export function buildWorkspaceApps(menuTree: MenuNode[]): MenuNode[] {
  const mastersApp = buildBtMastersApp(menuTree);
  if (!mastersApp) return menuTree;

  const moduleApps = menuTree.map((item) => (isUtilitiesApp(item) ? item : stripMasterBranches(item)));
  const hasBtMasters = moduleApps.some((item) => isBtMastersApp(item));
  return hasBtMasters ? moduleApps : [...moduleApps, mastersApp];
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

export function buildBtMastersApp(menuTree: MenuNode[]): MenuNode | null {
  const groups = menuTree
    .map((app) => {
      if (isUtilitiesApp(app)) return null;
      const masterLeaves = collectMasterLeaves(app);
      if (!masterLeaves.length) return null;
      return {
        id: `bt-masters-${cleanAppCode(app.title)}`,
        title: app.title,
        type: "collapse" as const,
        children: masterLeaves,
      };
    })
    .filter(Boolean) as MenuNode[];

  if (!groups.length) return null;

  return {
    id: "virtual-bt-masters",
    title: "BT MASTERS",
    type: "group",
    children: groups,
  };
}

function collectMasterLeaves(app: MenuNode): MenuNode[] {
  const leaves: MenuNode[] = [];

  const walk = (node: MenuNode, ancestry: string[]) => {
    const children = node.children || [];
    const trail = [...ancestry, node.title || "", node.url_path || ""];
    if ((node.type === "item" || node.url_path) && isMasterTrail(trail) && !isModuleOwnedMasterTrail(trail)) {
      leaves.push({
        ...node,
        id: `bt-masters-${cleanAppCode(app.title)}-${node.id || cleanAppCode(node.title)}`,
      });
    }
    children.forEach((child) => walk(child, trail));
  };

  (app.children || []).forEach((child) => walk(child, [app.title || ""]));
  return dedupeLeaves(leaves);
}

function stripMasterBranches(app: MenuNode): MenuNode {
  return {
    ...app,
    children: (app.children || [])
      .map((child) => pruneMasterNode(child, [app.title || ""]))
      .filter(Boolean) as MenuNode[],
  };
}

function pruneMasterNode(node: MenuNode, ancestry: string[]): MenuNode | null {
  const trail = [...ancestry, node.title || "", node.url_path || ""];
  const isMasterNode = isMasterTrail(trail);
  const isModuleOwnedMaster = isModuleOwnedMasterTrail(trail);

  const children = (node.children || [])
    .map((child) => pruneMasterNode(child, trail))
    .filter(Boolean) as MenuNode[];

  if (isMasterNode && !isModuleOwnedMaster) {
    if (children.length) {
      return {
        ...node,
        children,
      };
    }
    return null;
  }

  if (node.children?.length && !children.length && node.type !== "item" && !node.url_path) {
    return null;
  }

  return {
    ...node,
    children,
  };
}

function isMasterTrail(parts: string[]) {
  const text = parts.join(" ").toLowerCase();
  if (excludedUtilitySignals.some((signal) => text.includes(signal))) return false;
  if (masterSignals.some((signal) => text.includes(signal))) return true;
  return /(^|[^a-z0-9])gm([^a-z0-9]|$)/.test(text);
}

function isModuleOwnedMasterTrail(parts: string[]) {
  const text = parts.join(" ").toLowerCase();
  const compact = text.replace(/[^a-z0-9]/g, "");
  return moduleOwnedMasterSignals.some((signal) => {
    const normalizedSignal = signal.toLowerCase();
    return text.includes(normalizedSignal) || compact.includes(normalizedSignal.replace(/[^a-z0-9]/g, ""));
  });
}

function dedupeLeaves(leaves: MenuNode[]) {
  const seen = new Set<string>();
  return leaves.filter((leaf) => {
    const key = `${leaf.title}|${leaf.url_path || ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
