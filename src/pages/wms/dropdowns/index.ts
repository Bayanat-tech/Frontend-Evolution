import { getWmsMaster } from "../../../api/wms";

export interface DropdownOption {
  label: string;
  value: string;
  [key: string]: unknown;  // Allow extra properties for filtering
}

// ==================== Country ====================
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

// ==================== Currency ====================
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

// ==================== Department ====================
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
      label: `${String(row.dept_code ?? "")} - ${String(row.dept_name ?? "")}`,
      value: String(row.dept_code ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}

// ==================== Division ====================
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

// ==================== Group ====================
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

// ==================== Principal ====================
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

// ==================== Territory ====================
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

// ==================== Registry & Utilities ====================
export type DropdownKey =
  | "country"
  | "department"
  | "currency"
  | "territory"
  | "division"
  | "principal"
  | "group";

export const dropdownRegistry: Record<
  DropdownKey,
  (filters?: Record<string, unknown>) => Promise<DropdownOption[]>
> = {
  country: fetchCountries,
  department: fetchDepartments,
  currency: fetchCurrencies,
  territory: fetchTerritories,
  division: fetchDivisions,
  principal: fetchPrincipals,
  group: fetchGroups,
};

/**
 * Fetch dropdown options by key
 * @param key - The dropdown key (e.g., 'country', 'currency')
 * @param filters - Optional filters to pass to the API
 * @returns Promise<DropdownOption[]>
 */
export async function fetchDropdownOptions(
  key: DropdownKey,
  filters?: Record<string, unknown>
): Promise<DropdownOption[]> {
  const fetchFn = dropdownRegistry[key];
  if (!fetchFn) {
    console.warn(`Dropdown API not found for key: ${key}`);
    return [];
  }
  return fetchFn(filters);
}

/**
 * Register a custom dropdown API
 * @param key - The dropdown key
 * @param fetchFn - The fetch function
 */
export function registerDropdownApi(
  key: DropdownKey,
  fetchFn: (filters?: Record<string, unknown>) => Promise<DropdownOption[]>
): void {
  dropdownRegistry[key] = fetchFn;
}
