import { getWmsMaster } from "../wms";
import type { DropdownOption } from "./country";

export async function fetchPrincipals(
  filters?: Record<string, unknown>
): Promise<DropdownOption[]> {
  try {
    const response = await getWmsMaster("principal", {
      page: 1,
      limit: 10000,
      ...(filters ? { filter: JSON.stringify(filters) } : {}),
    });
    return (response.tableData as Record<string, unknown>[]).map((row) => ({
      label: `${String(row.prin_code ?? "")} - ${String(row.prin_name ?? "")}`,
      value: String(row.prin_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching principals:", error);
    return [];
  }
}
