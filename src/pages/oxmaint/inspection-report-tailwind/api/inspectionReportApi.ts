import {
  AssetInventoryDropdownOption,
  InspectionFormDropdownOption,
  InspectionReportStructureRow
} from '../types/inspectionReportApi.types';
import { executeDynamicDelete, getDynamicLookup } from '../../../../api/lookups';

export const deleteInspectionReport = async (reportId: number, loginid: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await executeDynamicDelete({
      parameter: 'OX_DEL_INSPECTION_FORM_REPORT_DELETE',
      loginid,
      number1: reportId
    });

    return {
      success: Boolean(response?.success),
      message: response?.message
    };
  } catch (error) {
    console.error('Error deleting inspection report:', error);
    return {
      success: false,
      message: 'Failed to delete inspection report'
    };
  }
};

export const getInspectionReportInspectionFormDropdown = async (loginid: string): Promise<InspectionFormDropdownOption[]> => {
  try {
    const response = await getDynamicLookup({
      parameter: 'OX_INSPECTION_REPORT_INSPECTION_FORM_DROPDOWN',
      loginid
    });

    if (!Array.isArray(response)) return [];

    return response.map((item: any) => ({
      inspection_form_code: String(
        item?.inspection_form_code ?? item?.INSPECTION_FORM_CODE ?? item?.form_code ?? item?.id ?? ''
      ),
      inspection_form_name: String(
        item?.inspection_form_name ?? item?.INSPECTION_FORM_NAME ?? item?.name ?? item?.form_name ?? ''
      ),
      description: item?.description ?? item?.DESCRIPTION ?? ''
    }));
  } catch (error) {
    console.error('Error loading inspection form dropdown:', error);
    return [];
  }
};

export const getInspectionReportAssetInventoryDropdown = async (loginid: string): Promise<AssetInventoryDropdownOption[]> => {
  try {
    const response = await getDynamicLookup({
      parameter: 'OX_INSPECTION_REPORT_ASSET_INVENTORY_DROPDOWN',
      loginid
    });

    if (!Array.isArray(response)) return [];

    return response.map((item: any) => ({
      asset_inventory_code: String(
        item?.asset_inventory_code ?? item?.ASSET_INVENTORY_CODE ?? item?.asset_id ?? item?.ASSET_ID ?? item?.id ?? ''
      ),
      asset_number: String(
        item?.asset_number ?? item?.ASSET_NUMBER ?? item?.asset_no ?? item?.ASSET_NO ?? item?.code ?? ''
      ),
      asset_name: String(item?.asset_name ?? item?.ASSET_NAME ?? item?.name ?? ''),
      inventory_no: String(item?.inventory_no ?? item?.INVENTORY_NO ?? item?.inventory ?? item?.INVENTORY ?? ''),
      running_hours: String(item?.running_hours ?? item?.RUNNING_HOURS ?? ''),
      running_hours_unit: String(item?.running_hours_unit ?? item?.RUNNING_HOURS_UNIT ?? '')
    }));
  } catch (error) {
    console.error('Error loading asset inventory dropdown:', error);
    return [];
  }
};

export const getInspectionReportStructure = async (
  inspectionFormCode: string,
  loginid: string
): Promise<InspectionReportStructureRow[]> => {
  try {
    const response = await getDynamicLookup({
      parameter: 'OX_INSPECTION_REPORT_FETCH_STRUCTURE',
      loginid,
      number1: Number(inspectionFormCode)
    });

    if (!Array.isArray(response)) return [];

    return response.map((item: any) => ({
      inspection_form_code: String(item?.inspection_form_code ?? item?.INSPECTION_FORM_CODE ?? ''),
      inspection_form_name: String(item?.inspection_form_name ?? item?.INSPECTION_FORM_NAME ?? ''),
      header_section_id: String(item?.header_section_id ?? item?.HEADER_SECTION_ID ?? ''),
      header_section_title: String(item?.header_section_title ?? item?.HEADER_SECTION_TITLE ?? ''),
      under_section_id: String(item?.under_section_id ?? item?.UNDER_SECTION_ID ?? ''),
      under_section_title: String(item?.under_section_title ?? item?.UNDER_SECTION_TITLE ?? ''),
      type: String(item?.type ?? item?.TYPE ?? ''),
      required: String(item?.required ?? item?.REQUIRED ?? ''),
      sort_order: item?.sort_order ?? item?.SORT_ORDER ?? '',
      instruction: String(item?.instruction ?? item?.INSTRUCTION ?? '')
    }));
  } catch (error) {
    console.error('Error loading inspection report structure:', error);
    return [];
  }
};
