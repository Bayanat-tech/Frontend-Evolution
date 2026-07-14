import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../../state/AuthContext";
import { executeDynamicDelete, executeDynamicMutationColumn90, getDynamicLookup } from "../../../../api/lookups";


export const useStatusBasedTotalCount = () => {
  return useQuery({
    queryKey: ['status_based_total_count'],
    queryFn: async () => {
        const response = await getDynamicLookup(
            {
                parameter: 'OX_ASSET_INVENTORY_STATUS_BASED_TOTAL_COUNT',
            }
        )
        return Array.isArray(response) ? response : [];
    }
  });
};

type AssetInventoryRow = {
  asset_id?: string | number;
  asset_type?: string | number | null;
  asset_type_name?: string;
  running_hours_unit?: string;
  status_code?: string | number | null;
  inventory?: string | number | null;
  site_project?: string | number | null;
  site_project_name?: string;
  business_unit?: string;
  asset_value?: number | null;
  purchase_date?: string | null;
  warranty_date?: string | null;
  required_geo_location_while_inspection?: string | boolean | null;
  geo_location?: string | null;
  inspection_form_ids?: string[];
  inspection_form_names?: string[];
  asset_number: string;
  category: string;
  category_type: string;
  asset_name: string;
  location: string;
  model: string;
  meter: number;
  status: string;
  operator: string;
};

export type DropdownOption = {
  value: string;
  label: string;
  raw: any;
};

const getValue = (row: any, keys: string[], fallback: any = '') => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return fallback;
};

const normalizeDropdownOption = (row: any): DropdownOption => {
  const value = getValue(
    row,
    [
      'inspection_form_code', 'INSPECTION_FORM_CODE',
      'asset_type_code', 'ASSET_TYPE_CODE',
      'site_project_code', 'SITE_PROJECT_CODE',
      'status_code', 'STATUS_CODE',
      'id', 'ID',
      'code', 'CODE',
      'status', 'STATUS'
    ],
    ''
  );

  const label = getValue(
    row,
    [
      'inspection_form_name', 'INSPECTION_FORM_NAME',
      'asset_type_name', 'ASSET_TYPE_NAME',
      'site_project_name', 'SITE_PROJECT_NAME',
      'status_name', 'STATUS_NAME',
      'name', 'NAME',
      'description', 'DESCRIPTION',
      'status', 'STATUS'
    ],
    value
  );

  return {
    value: String(value ?? ''),
    label: String(label ?? ''),
    raw: row
  };
};

const normalizeAssetRow = (row: any): AssetInventoryRow => ({
  asset_id: getValue(row, ['asset_id', 'ASSET_ID'], undefined),
  asset_type: getValue(row, ['asset_type', 'ASSET_TYPE', 'asset_type_code', 'ASSET_TYPE_CODE'], null),
  asset_type_name: String(getValue(row, ['asset_type_name', 'ASSET_TYPE_NAME'], '')),
  running_hours_unit: String(getValue(row, ['running_hours_unit', 'RUNNING_HOURS_UNIT'], '')),
  status_code: getValue(row, ['status', 'STATUS', 'status_code', 'STATUS_CODE'], null),
  inventory: getValue(row, ['inventory', 'INVENTORY', 'inventory_id', 'INVENTORY_ID'], null),
  site_project: getValue(row, ['site_project', 'SITE_PROJECT', 'site_project_code', 'SITE_PROJECT_CODE'], null),
  site_project_name: String(getValue(row, ['site_project_name', 'SITE_PROJECT_NAME'], '')),
  business_unit: String(getValue(row, ['business_unit', 'BUSINESS_UNIT'], '')),
  asset_value: Number(getValue(row, ['asset_value', 'ASSET_VALUE'], 0)) || null,
  purchase_date: getValue(row, ['purchase_date', 'PURCHASE_DATE'], null),
  warranty_date: getValue(row, ['warranty_date', 'WARRANTY_DATE'], null),
  required_geo_location_while_inspection: getValue(
    row,
    ['required_geo_location_while_inspection', 'REQUIRED_GEO_LOCATION_WHILE_INSPECTION', 'geo_location', 'GEO_LOCATION'],
    null
  ),
  geo_location: String(getValue(row, ['geo_location', 'GEO_LOCATION'], '')),
  inspection_form_ids: String(getValue(row, ['inspection_form_ids', 'INSPECTION_FORM_IDS'], ''))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  inspection_form_names: String(getValue(row, ['inspection_form_names', 'INSPECTION_FORM_NAMES'], ''))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  asset_number: String(getValue(row, ['asset_number', 'ASSET_NUMBER', 'asset_id', 'ASSET_ID'], '')),
  category: String(getValue(row, ['asset_category', 'ASSET_CATEGORY', 'category', 'CATEGORY'], '')),
  category_type: String(getValue(row, ['category_type', 'CATEGORY_TYPE', 'asset_type_name', 'ASSET_TYPE_NAME'], 'MACHINE')).toUpperCase(),
  asset_name: String(getValue(row, ['asset_name', 'ASSET_NAME'], '')),
  location: String(getValue(row, ['site_project_name', 'SITE_PROJECT_NAME', 'site_project', 'SITE_PROJECT', 'location', 'LOCATION'], '')),
  model: String(getValue(row, ['model_make', 'MODEL_MAKE', 'model', 'MODEL'], '')),
  meter: Number(getValue(row, ['running_hours', 'RUNNING_HOURS', 'meter', 'METER'], 0)),
  status: String(getValue(row, ['status_name', 'STATUS_NAME', 'status', 'STATUS'], '')).toUpperCase(),
  operator: String(getValue(row, ['operator_name', 'OPERATOR_NAME', 'operator', 'OPERATOR'], ''))
});

export const useAssetInventoryRows = (statusSelected: string | null) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['asset_inventory_rows', user?.loginid, statusSelected],
    enabled: !!user?.loginid,
    queryFn: async () => {
      const selectedStatus = (statusSelected || 'total').trim();
      const response = await getDynamicLookup({
        parameter: 'OX_ASSET_INVENTORY_GET_BY_STATUS_NAME',
        code1: selectedStatus,
        loginid: user?.loginid ?? ''
      });

      const rawRows = Array.isArray(response)
        ? response
        : response && typeof response === 'object' && Array.isArray((response as any).data)
          ? (response as any).data
          : [];

      const normalizedRows: AssetInventoryRow[] = rawRows.map(normalizeAssetRow);
      return normalizedRows;
    }
  });
};

export const inUpdAssetInventory = async (
  payload: Record<string, any>,
  loginid: string
) => {
  const toNumber = (value: any): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return Number.isNaN(num) ? undefined : num;
  };

  const inspectionFormJson = Array.isArray(payload?.assign_inspection_form)
    ? JSON.stringify(payload.assign_inspection_form.map((item: any) => toNumber(item) ?? item))
    : undefined;

  const toYesNo = (value: any): 'Y' | 'N' => {
    if (value === true || String(value).toUpperCase() === 'Y') return 'Y';
    return 'N';
  };

  const toDateObject = (value: any): Date | null => {
    if (!value) return null;
    const dateObj = value instanceof Date ? value : new Date(value);
    return Number.isNaN(dateObj.getTime()) ? null : dateObj;
  };

  const toDateString = (value: any): string | undefined => {
    const dateObj = toDateObject(value);
    if (!dateObj) return undefined;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const assetId = toNumber(payload?.asset_id);

  const requestPayload = {
    parameter: 'OX_IN_UPD_ASSET_INVENTORY',
    loginid,
    val1s1: payload?.asset_number ?? '',
    val1s2: payload?.asset_name ?? '',
    val1s3: payload?.asset_category ?? '',
    val1s4: payload?.model_make ?? '',
    val1s5: payload?.manufacture ?? '',
    val1s6: payload?.business_unit ?? '',
    val1s7: toYesNo(payload?.required_geo_location_while_inspection),
    val1s8: payload?.operator_name ?? '',
    val1s9: payload?.maintenance_priority ?? '',
    val1s10: payload?.ownership_mode ?? '',
    val1s11: inspectionFormJson,
    val1s12: toDateString(payload?.purchase_date),
    val1s13: toDateString(payload?.warranty_date),
    val1s14: toDateString(payload?.last_maintenance_date),
    val1s15: payload?.running_hours_unit ?? '',

    val1n1: assetId,
    val1n2: toNumber(payload?.asset_type),
    val1n3: toNumber(payload?.status),
    val1n4: toNumber(payload?.inventory),
    val1n5: toNumber(payload?.site_project),
    val1n6: toNumber(payload?.running_hours),
    val1n7: toNumber(payload?.asset_value)
  };

  // Remove unnecessary keys (undefined/null/empty-string) before API call
  const cleanedPayload = Object.fromEntries(
    Object.entries(requestPayload).filter(([key, value]) => {
      if (key === 'parameter' || key === 'loginid') return true;
      return value !== undefined && value !== null && value !== '';
    })
  ) as Parameters<typeof executeDynamicMutationColumn90>[0];

  // Single API call for both add and update
  const response = await executeDynamicMutationColumn90(cleanedPayload);

  return response;
};

export const delAssetInventory = async (
  assetId: number,
  loginid: string
) => {
  const response = await executeDynamicDelete({
    parameter: 'OX_DEL_ASSET_INVENTORY',
    loginid,
    number1: assetId
  });

  return response;
};

const useAssetInventoryDropdown = (parameter: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['asset_inventory_dropdown', parameter, user?.loginid],
    enabled: !!parameter,
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter,
        loginid: user?.loginid ?? ''
      });

      const rows = Array.isArray(response)
        ? response
        : response && typeof response === 'object' && Array.isArray((response as any).data)
          ? (response as any).data
          : [];

      return rows.map(normalizeDropdownOption);
    }
  });
};

export const useAssetTypeDropdown = () =>
  useAssetInventoryDropdown('OX_ASSET_INVENTORY_ASSET_TYPE_DROPDWON');

export const useStatusDropdown = () =>
  useAssetInventoryDropdown('OX_ASSET_INVENTORY_STATUS_DROPDWON');

export const useSiteProjectDropdown = () =>
  useAssetInventoryDropdown('OX_ASSET_INVENTORY_SITE_PROJECT_DROPDWON');

export const useInspectionFormDropdown = () =>
  useAssetInventoryDropdown('OX_ASSET_INVENTORY_INSPECTION_FORM_DROPDWON');