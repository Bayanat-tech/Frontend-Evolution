import type { MenuNode } from "../types/auth";

export function cleanPath(path?: string) {
  if (!path) return "";
  return path.replace(/^\/+/, "");
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
