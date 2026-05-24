import type { DropdownOption } from "./country";
import { fetchCountries } from "./country";
import { fetchPrincipals } from "./principal";
import { fetchDepartments } from "./department";
import { fetchCurrencies } from "./currency";
import { fetchTerritories } from "./territory";
import { fetchDivisions } from "./division";
import { fetchGroups } from "./group";

export type { DropdownOption };

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
