import { getWmsMaster } from "../wms";
import type { DropdownOption } from "./country";

export async function fetchGroups(
  filters?: Record<string, unknown>
): Promise<DropdownOption[]> {
  try {
    const response = await getWmsMaster("group", {
      page: 1,
      limit: 10000,
    });
    return (response.tableData as Record<string, unknown>[]).map((row) => ({
      label: `${String(row.group_code ?? "")} - ${String(row.group_name ?? "")}`,
      value: String(row.group_code ?? ""),
      prin_code: String(row.prin_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}
