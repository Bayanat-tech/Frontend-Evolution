import { getWmsMaster } from "../wms";
import type { DropdownOption } from "./country";

export async function fetchDepartments(
  filters?: Record<string, unknown>
): Promise<DropdownOption[]> {
  try {
    const response = await getWmsMaster("department", {
      page: 1,
      limit: 10000,
      ...(filters ? { filter: JSON.stringify(filters) } : {}),
    });
    return (response.tableData as Record<string, unknown>[]).map((row) => ({
      label: String(row.department_name ?? ""),
      value: String(row.department_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}
