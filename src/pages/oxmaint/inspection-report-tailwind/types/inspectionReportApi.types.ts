export type InspectionFormDropdownOption = {
  inspection_form_code: string;
  inspection_form_name: string;
  description?: string;
};

export type AssetInventoryDropdownOption = {
  asset_inventory_code: string;
  asset_number: string;
  asset_name: string;
  inventory_no: string;
  running_hours: string;
  running_hours_unit: string;
};

export type InspectionReportStructureRow = {
  inspection_form_code: string;
  inspection_form_name: string;
  header_section_id: string;
  header_section_title: string;
  under_section_id: string;
  under_section_title: string;
  type: string;
  required: string;
  sort_order: number | string;
  instruction: string;
};
