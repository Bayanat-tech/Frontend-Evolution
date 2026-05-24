import { getWmsMaster } from "../wms";

export interface DropdownOption {
  label: string;
  value: string;
  [key: string]: unknown;  // Allow extra properties for filtering
}

export async function fetchCountries(): Promise<DropdownOption[]> {
  try {
    const response = await getWmsMaster("country", {
      page: 1,
      limit: 10000,
    });
    return (response.tableData as Record<string, unknown>[]).map((row) => ({
      label: String(row.country_name ?? ""),
      value: String(row.country_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching countries:", error);
    return [];
  }
}
