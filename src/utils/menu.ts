import type { MenuNode } from "../types/auth";

export function cleanPath(path?: string) {
  if (!path) return "";
  return path.replace(/^\/+/, "");
}

const isPlaceholderTitle = (title?: string) => {
  const value = String(title ?? "").trim().toLowerCase();
  return value === "" || value === "null";
};

/**
 * Defensively removes hierarchy placeholders returned by older backend builds.
 * When LEVEL3 is null, its route belongs to LEVEL2, so the LEVEL2 node becomes
 * the clickable item instead of displaying a child named "Null".
 */
export function normalizePermissionMenuTree(nodes: MenuNode[]): MenuNode[] {
  const normalized = nodes.flatMap((node) => {
    const normalizedChildren = normalizePermissionMenuTree(node.children || []);

    if (isPlaceholderTitle(node.title)) {
      return normalizedChildren;
    }

    const placeholderChildren = (node.children || []).filter((child) => isPlaceholderTitle(child.title));
    const placeholderRoute = placeholderChildren.find((child) => cleanPath(child.url_path));
    const children = normalizedChildren;
    const urlPath = cleanPath(node.url_path) || cleanPath(placeholderRoute?.url_path);

    return [{
      ...node,
      type: children.length > 0 ? node.type : "item",
      ...(urlPath ? { url_path: urlPath } : {}),
      ...(children.length > 0 ? { children } : { children: undefined }),
    }];
  });

  return normalized.some((node) => Number.isFinite(Number(node.position)))
    ? normalized.sort(
        (left, right) =>
          Number(left.position ?? Number.MAX_SAFE_INTEGER) -
            Number(right.position ?? Number.MAX_SAFE_INTEGER) ||
          left.title.localeCompare(right.title),
      )
    : normalized;
}

export function firstLeafPath(node: MenuNode): string {
  if (node.url_path) return cleanPath(node.url_path);
  for (const child of node.children || []) {
    const found = firstLeafPath(child);
    if (found) return found;
  }
  return "";
}

export function getMenuSerial(node?: MenuNode | null): string {
  const serial = node?.serial_no ?? node?.id;
  return serial === undefined || serial === null ? "" : String(serial).trim();
}

export function getMenuRouteTarget(node: MenuNode | undefined, appCode: string): string | null {
  if (!node || !appCode) return null;
  const serial = getMenuSerial(node);
  if (serial) return `/workspace/${appCode}/menu/${encodeURIComponent(serial)}`;
  const directPath = cleanPath(node.url_path);
  if (directPath) return `/workspace/${appCode}/${directPath}`;
  const firstLeaf = firstMenuLeaf(node);
  const firstLeafSerial = getMenuSerial(firstLeaf);
  if (firstLeafSerial) return `/workspace/${appCode}/menu/${encodeURIComponent(firstLeafSerial)}`;
  const firstLeafPath = cleanPath(firstLeaf?.url_path);
  return firstLeafPath ? `/workspace/${appCode}/${firstLeafPath}` : null;
}

export function firstMenuLeaf(node?: MenuNode): MenuNode | undefined {
  if (!node) return undefined;
  if (node.type === "item" || node.url_path) return node;
  for (const child of node.children || []) {
    const found = firstMenuLeaf(child);
    if (found) return found;
  }
  return undefined;
}

export function findMenuBySerial(nodes: MenuNode[], serialNo?: string | number | null): MenuNode | undefined {
  const wanted = serialNo === undefined || serialNo === null ? "" : String(serialNo).trim();
  if (!wanted) return undefined;
  for (const node of nodes) {
    if (getMenuSerial(node) === wanted) return node;
    const found = findMenuBySerial(node.children || [], wanted);
    if (found) return found;
  }
  return undefined;
}

export function findMenuPathBySerial(nodes: MenuNode[], serialNo?: string | number | null): MenuNode[] {
  const wanted = serialNo === undefined || serialNo === null ? "" : String(serialNo).trim();
  if (!wanted) return [];
  for (const node of nodes) {
    if (getMenuSerial(node) === wanted) return [node];
    const childPath = findMenuPathBySerial(node.children || [], wanted);
    if (childPath.length) return [node, ...childPath];
  }
  return [];
}

export function flattenLeaves(nodes: MenuNode[]): MenuNode[] {
  const leaves: MenuNode[] = [];

  const walk = (items: MenuNode[]) => {
    for (const item of items) {
      if (item.type === "item" || item.url_path) {
        leaves.push(item);
      }
      if (item.children?.length) walk(item.children);
    }
  };

  walk(nodes);
  return leaves;
}

export function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
