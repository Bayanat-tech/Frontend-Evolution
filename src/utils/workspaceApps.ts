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

export function buildWorkspaceApps(menuTree: MenuNode[]): MenuNode[] {
  const mastersApp = buildBtMastersApp(menuTree);
  if (!mastersApp) return menuTree;
  const hasBtMasters = menuTree.some((item) => isBtMastersApp(item));
  return hasBtMasters ? menuTree : [...menuTree, mastersApp];
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
    if ((node.type === "item" || node.url_path) && isMasterTrail(trail)) {
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

function isMasterTrail(parts: string[]) {
  const text = parts.join(" ").toLowerCase();
  if (excludedUtilitySignals.some((signal) => text.includes(signal))) return false;
  if (masterSignals.some((signal) => text.includes(signal))) return true;
  return /(^|[^a-z0-9])gm([^a-z0-9]|$)/.test(text);
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
