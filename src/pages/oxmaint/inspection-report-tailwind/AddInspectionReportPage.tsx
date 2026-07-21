import { useMemo, useState } from 'react';
import { FaChevronLeft, FaClipboardCheck, FaInfoCircle, FaSearch } from 'react-icons/fa';
import { useFormik } from 'formik';
import { IconButton } from '../../../components/mms_ui';
import {
  getInspectionReportAssetInventoryDropdown,
  getInspectionReportInspectionFormDropdown,
  getInspectionReportStructure
} from './api/inspectionReportApi';
import {
  DoInspectionSection,
  InspectionInfoSection,
  InspectionSummarySection,
  SelectionDialog
} from './components';
import { InspectionInfoFormValues, InspectionSummaryValues } from './components';
import {
  AddInspectionReportPageProps,
  InspectionItemResponse,
  SelectionDialogState
} from './types/AddInspectionReportPage.types';
import {
  AssetInventoryDropdownOption,
  InspectionFormDropdownOption,
  InspectionReportStructureRow
} from './types/inspectionReportApi.types';
import { useAuth } from '../../../state/AuthContext';

const RUNNING_HOURS_UNIT_OPTIONS = ['Hours', 'Miles', 'KM', 'Counter'] as const;

const normalizeRunningHoursUnit = (unit?: string) => {
  const value = (unit || '').trim().toLowerCase();

  if (!value) return 'Hours';
  if (value === 'hours' || value === 'hour' || value === 'hrs' || value === 'hr') return 'Hours';
  if (value === 'miles' || value === 'mile' || value === 'mi') return 'Miles';
  if (value === 'km' || value === 'kilometer' || value === 'kilometers') return 'KM';
  if (value === 'counter' || value === 'count') return 'Counter';

  return RUNNING_HOURS_UNIT_OPTIONS.includes(unit as (typeof RUNNING_HOURS_UNIT_OPTIONS)[number]) ? unit! : 'Hours';
};

const getDefaultInspectionValueByType = (type: string): string | number | null => {
  const key = (type || '').trim().toLowerCase();

  if (key === 'good-repair-replace-na') return 'NA';
  if (key === 'yes-no-na') return 'NA';
  if (key === 'pass-fail-na') return 'NA';
  if (key === 'ok-faulty-na') return 'NA';
  if (key === 'text field') return '';
  if (key === 'number') return null;

  return null;
};

type StepIconProps = { active: boolean; children: React.ReactNode; label: string; showLine?: boolean };

const StepIndicator = ({ active, children, label, showLine = true }: StepIconProps) => (
  <div className="flex items-center gap-2 relative flex-1 min-w-0">
    <div
      className={`w-[34px] h-[34px] rounded-full border flex items-center justify-center shrink-0 ${
        active
          ? 'border-[#0a6ed1] bg-[#0a6ed1] text-white shadow-[0_8px_18px_rgba(10,110,209,0.2)]'
          : 'border-[#d8dee8] bg-white text-[#64748b]'
      }`}
    >
      {children}
    </div>
    <p className="text-xs font-bold text-[#243447] whitespace-nowrap">{label}</p>
    {showLine && <div className="h-px flex-1 bg-[#e5e7eb]" />}
  </div>
);

const AddInspectionReportPage = ({ onBack }: AddInspectionReportPageProps) => {
  const { user } = useAuth();
  const [selectionDialog, setSelectionDialog] = useState<SelectionDialogState>({
    kind: null,
    search: ''
  });
  const [assetOptions, setAssetOptions] = useState<AssetInventoryDropdownOption[]>([]);
  const [isAssetLoading, setIsAssetLoading] = useState(false);

  const [inspectionFormOptions, setInspectionFormOptions] = useState<InspectionFormDropdownOption[]>([]);
  const [isInspectionFormLoading, setIsInspectionFormLoading] = useState(false);
  const [inspectionStructure, setInspectionStructure] = useState<InspectionReportStructureRow[]>([]);
  const [inspectionResponses, setInspectionResponses] = useState<Record<string, InspectionItemResponse>>({});
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [inspectionSummary, setInspectionSummary] = useState<InspectionSummaryValues>({
    overall_condition: 'A little wear',
    asset_safe_to_use: 'No' as 'Yes' | 'No',
    maintenance_required: 'Yes' as 'Yes' | 'No',
    asset_status: 'Maintenance Required',
    maintenance_priority: 'Low',
    additional_note: ''
  });

  const formik = useFormik<InspectionInfoFormValues>({
    initialValues: {
      report_no: '',
      asset_inventory_code: '', // stores selected asset code for API payload
      asset_number: '', // display only: selected asset number
      location: '',
      asset_name: '',
      inspector_name: '',
      inventory_no: '',
      inspection_form_code: '', // stores selected form code for API payload
      inspection_form: '', // display only: selected inspection form name
      running_hours: '',
      running_hours_unit: 'Hours'
    },
    onSubmit: () => {
      // handled in next step
    }
  });

  const loadAssetInventory = async () => {
    setIsAssetLoading(true);
    const options = await getInspectionReportAssetInventoryDropdown(user?.loginid ?? '');
    setAssetOptions(options);
    setIsAssetLoading(false);
  };

  const openAssetDialog = async () => {
    setSelectionDialog({ kind: 'asset', search: '' });
    if (assetOptions.length === 0) {
      await loadAssetInventory();
    }
  };

  const closeAssetDialog = () => {
    setSelectionDialog((prev) => ({ ...prev, kind: null, search: '' }));
  };

  const loadInspectionForms = async () => {
    setIsInspectionFormLoading(true);
    const options = await getInspectionReportInspectionFormDropdown(user?.loginid ?? '');
    setInspectionFormOptions(options);
    setIsInspectionFormLoading(false);
  };

  const openInspectionDialog = async () => {
    setSelectionDialog({ kind: 'inspection', search: '' });
    if (inspectionFormOptions.length === 0) {
      await loadInspectionForms();
    }
  };

  const closeInspectionDialog = () => {
    setSelectionDialog((prev) => ({ ...prev, kind: null, search: '' }));
  };

  const filteredInspectionForms = useMemo(() => {
    if (selectionDialog.kind !== 'inspection') return inspectionFormOptions;

    const q = selectionDialog.search.trim().toLowerCase();
    if (!q) return inspectionFormOptions;

    return inspectionFormOptions.filter((option) =>
      [option.inspection_form_name, option.description, option.inspection_form_code].join(' ').toLowerCase().includes(q)
    );
  }, [inspectionFormOptions, selectionDialog.kind, selectionDialog.search]);

  const filteredAssetOptions = useMemo(() => {
    if (selectionDialog.kind !== 'asset') return assetOptions;

    const q = selectionDialog.search.trim().toLowerCase();
    if (!q) return assetOptions;

    return assetOptions.filter((option) =>
      [option.asset_number, option.asset_name, option.inventory_no, option.asset_inventory_code].join(' ').toLowerCase().includes(q)
    );
  }, [assetOptions, selectionDialog.kind, selectionDialog.search]);

  const activeSelectionDialog = selectionDialog.kind === 'asset'
    ? {
        title: 'Select Asset Number',
        options: filteredAssetOptions.map((option) => ({
          code: option.asset_inventory_code,
          displayText: option.asset_number,
          secondaryText: `${option.asset_name || ''}${option.inventory_no ? ` • ${option.inventory_no}` : ''}`
        })),
        loading: isAssetLoading,
        selectedCode: formik.values.asset_inventory_code,
        emptyMessage: 'No asset found',
        loadingMessage: 'Loading assets...',
        onSelect: (code: string) => {
          const selectedAsset = assetOptions.find((a) => a.asset_inventory_code === code);
          if (selectedAsset) {
            handleSelectAsset(selectedAsset);
          }
        }
      }
    : selectionDialog.kind === 'inspection'
      ? {
          title: 'Select Inspection Form',
          options: filteredInspectionForms.map((option) => ({
            code: option.inspection_form_code,
            displayText: option.inspection_form_name,
            secondaryText: option.description || option.inspection_form_code
          })),
          loading: isInspectionFormLoading,
          selectedCode: formik.values.inspection_form_code,
          emptyMessage: 'No inspection form found',
          loadingMessage: 'Loading inspection forms...',
          onSelect: (code: string) => {
            const selectedForm = inspectionFormOptions.find((f) => f.inspection_form_code === code);
            if (selectedForm) {
              handleSelectInspectionForm(selectedForm);
            }
          }
        }
      : null;

  const groupedInspectionStructure = useMemo(() => {
    const grouped = new Map<
      string,
      {
        header_section_id: string;
        header_section_title: string;
        items: InspectionReportStructureRow[];
      }
    >();

    inspectionStructure.forEach((row) => {
      const sectionId = String(row.header_section_id ?? '');

      if (!grouped.has(sectionId)) {
        grouped.set(sectionId, {
          header_section_id: sectionId,
          header_section_title: row.header_section_title || '',
          items: []
        });
      }

      const underSectionId = String(row.under_section_id ?? '').trim();
      if (underSectionId) {
        grouped.get(sectionId)?.items.push(row);
      }
    });

    return Array.from(grouped.values()).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    }));
  }, [inspectionStructure]);

  const handleSelectAsset = (option: AssetInventoryDropdownOption) => {
    formik.setFieldValue('asset_inventory_code', option.asset_inventory_code);
    formik.setFieldValue('asset_number', option.asset_number);
    formik.setFieldValue('asset_name', option.asset_name || '');
    formik.setFieldValue('inventory_no', option.inventory_no || '');
    formik.setFieldValue('running_hours', option.running_hours || '');
    formik.setFieldValue('running_hours_unit', normalizeRunningHoursUnit(option.running_hours_unit));
    closeAssetDialog();
  };

  const handleSelectInspectionForm = (option: InspectionFormDropdownOption) => {
    formik.setFieldValue('inspection_form_code', option.inspection_form_code);
    formik.setFieldValue('inspection_form', option.inspection_form_name);
    closeInspectionDialog();
  };

  const canProceedToNext = Boolean(
    formik.values.asset_inventory_code &&
      formik.values.inspection_form_code &&
      formik.values.location.trim() &&
      formik.values.inspector_name.trim()
  );

  const handleNext = async () => {
    if (!canProceedToNext || isLoadingStructure) return;

    setIsLoadingStructure(true);
    try {
      const structure = await getInspectionReportStructure(formik.values.inspection_form_code, user?.loginid ?? '');
      setInspectionStructure(structure);
      setExpandedSectionIds(Array.from(new Set(structure.map((row) => String(row.header_section_id ?? '')))).filter(Boolean));
      setCurrentStep(2);
      console.log('Fetched inspection report structure:', structure);
    } catch (error) {
      console.error('Failed to fetch inspection report structure:', error);
    } finally {
      setIsLoadingStructure(false);
    }
  };

  const handleSubmitCreatePreview = () => {
    const structureItems = inspectionStructure.filter((row) => String(row.under_section_id ?? '').trim().length > 0);

    const uniqueInspectionItems = Array.from(
      new Map(structureItems.map((row) => [String(row.under_section_id), row])).values()
    );

    const inspectionItemsPayload = uniqueInspectionItems.map((row) => {
      const key = String(row.under_section_id);
      const existingResponse = inspectionResponses[key];

      return {
        under_section_id: key,
        header_section_id: String(row.header_section_id ?? ''),
        type: row.type,
        value: existingResponse ? existingResponse.value : getDefaultInspectionValueByType(row.type),
        note: existingResponse ? existingResponse.note : '',
        upload_url: existingResponse ? existingResponse.upload_url : ''
      };
    });

    const payload = {
      loginid: user?.loginid ?? '',
      inspection_info: {
        report_no: formik.values.report_no,
        asset_inventory_code: formik.values.asset_inventory_code,
        asset_number: formik.values.asset_number,
        location: formik.values.location,
        asset_name: formik.values.asset_name,
        inspector_name: formik.values.inspector_name,
        inventory_no: formik.values.inventory_no,
        inspection_form_code: formik.values.inspection_form_code,
        inspection_form: formik.values.inspection_form,
        running_hours: formik.values.running_hours,
        running_hours_unit: formik.values.running_hours_unit,
        ...inspectionSummary
      },
      inspection_items: inspectionItemsPayload
    };

    console.log('Create inspection report payload preview:', payload);
    onBack?.();
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] font-app">
      <div className="h-[42px] flex items-center px-3 bg-white border-b border-[#e5e7eb]">
        <IconButton size="small" className="text-[#1f2937]" onClick={onBack}>
          <FaChevronLeft size={14} />
        </IconButton>
      </div>

      <div className="flex items-center gap-3.5 px-3 pt-3 pb-2.5 bg-white border-b border-[#dbe3ee]">
        <StepIndicator active={currentStep >= 1} label="Inspection Info">
          <FaInfoCircle size={15} />
        </StepIndicator>
        <StepIndicator active={currentStep >= 2} label="Do Inspection">
          <FaSearch size={14} />
        </StepIndicator>
        <StepIndicator active={currentStep >= 3} label="Inspection Summary" showLine={false}>
          <FaClipboardCheck size={15} />
        </StepIndicator>
      </div>

      <div className="p-3 pb-3.5">
        <InspectionInfoSection
          formik={formik}
          openAssetDialog={openAssetDialog}
          openInspectionDialog={openInspectionDialog}
          runningHoursUnitOptions={RUNNING_HOURS_UNIT_OPTIONS}
          canProceedToNext={canProceedToNext}
          isLoadingStructure={isLoadingStructure}
          onNext={handleNext}
        />

        {currentStep >= 2 && (
          <DoInspectionSection
            groupedInspectionStructure={groupedInspectionStructure}
            expandedSectionIds={expandedSectionIds}
            inspectionResponses={inspectionResponses}
            onToggleSection={(sectionId) => {
              setExpandedSectionIds((prev) =>
                prev.includes(sectionId)
                  ? prev.filter((id) => id !== sectionId)
                  : [...prev, sectionId]
              );
            }}
            onSaveInspectionItem={(payload) => {
              setInspectionResponses((prev) => ({
                ...prev,
                [payload.under_section_id]: payload
              }));
            }}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep >= 3 && (
          <InspectionSummarySection
            inspectionSummary={inspectionSummary}
            onChange={setInspectionSummary}
            onSubmit={handleSubmitCreatePreview}
            inspectionInfo={{
              location: formik.values.location,
              asset_number: formik.values.asset_number,
              asset_name: formik.values.asset_name,
              inspector_name: formik.values.inspector_name,
              inventory_no: formik.values.inventory_no,
              running_hours: formik.values.running_hours,
              running_hours_unit: formik.values.running_hours_unit,
              inspection_form_code: formik.values.inspection_form_code
            }}
            inspectionStructure={inspectionStructure}
            inspectionResponses={inspectionResponses}
          />
        )}
      </div>

      {activeSelectionDialog && (
        <SelectionDialog
          open={Boolean(selectionDialog.kind)}
          title={activeSelectionDialog.title}
          options={activeSelectionDialog.options}
          loading={activeSelectionDialog.loading}
          searchValue={selectionDialog.search}
          onSearchChange={(value) => setSelectionDialog((prev) => ({ ...prev, search: value }))}
          onClose={selectionDialog.kind === 'inspection' ? closeInspectionDialog : closeAssetDialog}
          onSelect={(option) => activeSelectionDialog.onSelect(option.code)}
          selectedCode={activeSelectionDialog.selectedCode}
          emptyMessage={activeSelectionDialog.emptyMessage}
          loadingMessage={activeSelectionDialog.loadingMessage}
        />
      )}
    </div>
  );
};

export default AddInspectionReportPage;
