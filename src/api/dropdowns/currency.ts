import { getWmsMaster } from "../wms";
import type { DropdownOption } from "./country";

export async function fetchCurrencies(
  filters?: Record<string, unknown>
): Promise<DropdownOption[]> {
  try {
    const response = await getWmsMaster("currency", {
      page: 1,
      limit: 10000,
      ...(filters ? { filter: JSON.stringify(filters) } : {}),
    });
    return (response.tableData as Record<string, unknown>[]).map((row) => ({
      label: String(row.currency_name ?? ""),
      value: String(row.currency_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching currencies:", error);
    return [];
  }
}
