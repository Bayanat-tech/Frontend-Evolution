export type AddInspectionReportPageProps = {
  onBack?: () => void;
};

export type SelectionDialogKind = 'asset' | 'inspection';

export type SelectionDialogState = {
  kind: SelectionDialogKind | null;
  search: string;
};

export type InspectionItemValue = string | number | null;

export type InspectionItemResponse = {
  under_section_id: string;
  header_section_id: string;
  type: string;
  value: InspectionItemValue;
  note: string;
  upload_url: string;
};
