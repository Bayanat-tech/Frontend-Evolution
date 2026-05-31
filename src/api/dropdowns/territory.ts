import { getWmsMaster } from "../wms";
import type { DropdownOption } from "./country";

export async function fetchTerritories(
  filters?: Record<string, unknown>
): Promise<DropdownOption[]> {
  try {
    const response = await getWmsMaster("territory", {
      page: 1,
      limit: 10000,
      ...(filters ? { filter: JSON.stringify(filters) } : {}),
    });
    return (response.tableData as Record<string, unknown>[]).map((row) => ({
      label: String(row.territory_name ?? ""),
      value: String(row.territory_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching territories:", error);
    return [];
  }
}
