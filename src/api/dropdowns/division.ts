import { getWmsMaster } from "../wms";
import type { DropdownOption } from "./country";

export async function fetchDivisions(
  filters?: Record<string, unknown>
): Promise<DropdownOption[]> {
  try {
    const response = await getWmsMaster("division", {
      page: 1,
      limit: 10000,
      ...(filters ? { filter: JSON.stringify(filters) } : {}),
    });
    return (response.tableData as Record<string, unknown>[]).map((row) => ({
      label: `${String(row.div_code ?? "")} - ${String(row.div_name ?? "")}`,
      value: String(row.div_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching divisions:", error);
    return [];
  }
}
