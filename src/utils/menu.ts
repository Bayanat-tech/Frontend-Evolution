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
