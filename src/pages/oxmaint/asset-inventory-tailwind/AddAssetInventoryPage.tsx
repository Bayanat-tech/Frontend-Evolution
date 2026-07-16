import { FormikProps } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { MdPlaylistAddCheck } from 'react-icons/md';
import { FaSearch } from 'react-icons/fa';
import {
    Autocomplete,
    AutocompleteOption,
    Button,
    Checkbox,
    CheckboxOption,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    TextField
} from '../../../components/mms_ui';
import {
    DropdownOption,
    useAssetTypeDropdown,
    useInspectionFormDropdown,
    useSiteProjectDropdown,
    useStatusDropdown
} from './api/asset_inventory';
import { assetInventorySizeConfig } from './config/assetInventorySizeConfig';

export type AssetInventoryFormValues = {
    basicInfo: {
        asset_type: string | null;
        asset_number: string;
        asset_name: string;
        asset_category: string;
        model_make: string;
        running_hours: number | null;
        running_hours_unit: string | null;
        status: string | null;
        inventory: number | null;
        asset_uitilization_goal: string | null;
    };
    maintenanceInfo: {
        year: number | null;
        manufacture: string;
        last_maintenance_reading: number | null;
        last_maintenance_date: string | null;
        chassis_number: string;
        license_plate: string;
        registration_state: string;
        registration_exp_date: string | null;
    };
    financialInfo: {
        site_project: string | null;
        business_unit: string;
        asset_value: number | null;
        purchase_date: string | null;
        warranty_date: string | null;
        required_geo_location_while_inspection: boolean;
        assign_inspection_form: string[];
    };
    operationalInfo: {
        operator_name: string;
        maintenance_priority: string;
        ownership_mode: string;
        asset_note: string;
        asset_image_url_path: string;
        sensor_enabled: string;
        device_id: string;
        sensor_asset_id: string;
    };
};

type SectionKey = keyof AssetInventoryFormValues;
type FieldConfig = {
    name: string;
    label: string;
    type?: React.InputHTMLAttributes<unknown>['type'];
};

const SECTION_FIELDS: Array<{ key: SectionKey; title: string; fields: FieldConfig[] }> = [
    {
        key: 'basicInfo',
        title: 'Basic Info',
        fields: [
            { name: 'asset_type', label: 'Asset Type' },
            { name: 'asset_number', label: 'Asset Number' },
            { name: 'asset_name', label: 'Asset Name' },
            { name: 'asset_category', label: 'Asset Category' },
            { name: 'model_make', label: 'Model / Make' },
            { name: 'running_hours', label: 'Running Hours', type: 'number' },
            { name: 'running_hours_unit', label: 'Running Hours Unit' },
            { name: 'status', label: 'Status' },
            { name: 'inventory', label: 'Inventory', type: 'number' },
            { name: 'asset_uitilization_goal', label: 'Asset Utilization Goal' }
        ]
    },
    {
        key: 'maintenanceInfo',
        title: 'Maintenance Info',
        fields: [
            { name: 'year', label: 'Year', type: 'number' },
            { name: 'manufacture', label: 'Manufacture' },
            { name: 'last_maintenance_reading', label: 'Last Maintenance Reading', type: 'number' },
            { name: 'last_maintenance_date', label: 'Last Maintenance Date', type: 'date' },
            { name: 'chassis_number', label: 'Chassis Number' },
            { name: 'license_plate', label: 'License Plate' },
            { name: 'registration_state', label: 'Registration State' },
            { name: 'registration_exp_date', label: 'Registration Expiry Date', type: 'date' }
        ]
    },
    {
        key: 'financialInfo',
        title: 'Financial Info',
        fields: [
            { name: 'site_project', label: 'Site / Project' },
            { name: 'business_unit', label: 'Business Unit' },
            { name: 'asset_value', label: 'Asset Value', type: 'number' },
            { name: 'purchase_date', label: 'Purchase Date', type: 'date' },
            { name: 'warranty_date', label: 'Warranty Date', type: 'date' },
            { name: 'required_geo_location_while_inspection', label: 'Geo Location Required While Inspection' },
            { name: 'assign_inspection_form', label: 'Assign Inspection Form' }
        ]
    },
    {
        key: 'operationalInfo',
        title: 'Operational Info',
        fields: [
            { name: 'operator_name', label: 'Operator Name' },
            { name: 'maintenance_priority', label: 'Maintenance Priority' },
            { name: 'ownership_mode', label: 'Ownership Mode' },
            { name: 'asset_note', label: 'Asset Note' },
            { name: 'asset_image_url_path', label: 'Asset Image URL Path' },
            { name: 'sensor_enabled', label: 'Sensor Enabled' },
            { name: 'device_id', label: 'Device ID' },
            { name: 'sensor_asset_id', label: 'Sensor Asset ID' }
        ]
    }
];

const toAutocompleteOptions = (options: DropdownOption[]): AutocompleteOption[] =>
    options.map((option) => ({ id: option.value, label: option.label }));

const AddAssetInventoryPage = ({ formik }: { formik: FormikProps<AssetInventoryFormValues> }) => {
    const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
    const [inspectionSearch, setInspectionSearch] = useState('');
    const [draftInspectionFormValues, setDraftInspectionFormValues] = useState<string[]>([]);
    const { data: assetTypeOptions = [], isLoading: isAssetTypeLoading } = useAssetTypeDropdown();
    const { data: statusOptions = [], isLoading: isStatusLoading } = useStatusDropdown();
    const { data: siteProjectOptions = [], isLoading: isSiteProjectLoading } = useSiteProjectDropdown();
    const { data: inspectionFormOptions = [], isLoading: isInspectionFormLoading } = useInspectionFormDropdown();
    const runningHoursUnitOptions: DropdownOption[] = [
        { value: 'Hours', label: 'Hours', raw: 'Hours' },
        { value: 'Miles', label: 'Miles', raw: 'Miles' },
        { value: 'KM', label: 'KM', raw: 'KM' },
        { value: 'Counter', label: 'Counter', raw: 'Counter' },
    ];

    const selectedInspectionForms = useMemo(() => {
        const selectedValues = formik.values.financialInfo.assign_inspection_form || [];
        return inspectionFormOptions.filter((option: DropdownOption) => selectedValues.includes(option.value));
    }, [formik.values.financialInfo.assign_inspection_form, inspectionFormOptions]);

    const filteredInspectionForms = useMemo(() => {
        const search = inspectionSearch.trim().toLowerCase();
        if (!search) return inspectionFormOptions;
        return inspectionFormOptions.filter((option: DropdownOption) => option.label.toLowerCase().includes(search));
    }, [inspectionFormOptions, inspectionSearch]);

    const openInspectionDialog = () => {
        setDraftInspectionFormValues(formik.values.financialInfo.assign_inspection_form || []);
        setInspectionSearch('');
        setInspectionDialogOpen(true);
    };

    const closeInspectionDialog = () => {
        setInspectionDialogOpen(false);
        setInspectionSearch('');
    };

    const toggleInspectionSelection = (value: string) => {
        setDraftInspectionFormValues((prev) =>
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        );
    };

    const dropdownByFieldPath: Record<string, { options: DropdownOption[]; isLoading: boolean }> = {
        'basicInfo.asset_type': { options: assetTypeOptions, isLoading: isAssetTypeLoading },
        'basicInfo.running_hours_unit': { options: runningHoursUnitOptions, isLoading: false },
        'basicInfo.status': { options: statusOptions, isLoading: isStatusLoading },
        'financialInfo.site_project': { options: siteProjectOptions, isLoading: isSiteProjectLoading }
    };

    const syncDropdownField = (fieldPath: string, options: DropdownOption[]) => {
        const currentValue = String(formik.getFieldProps(fieldPath).value ?? '').trim();
        if (!currentValue) return;

        const exactValue = options.find((opt) => String(opt.value) === currentValue);
        if (exactValue) return;

        const byLabel = options.find((opt) => String(opt.label).toLowerCase() === currentValue.toLowerCase());
        if (byLabel) {
            formik.setFieldValue(fieldPath, byLabel.value, false);
        }
    };

    useEffect(() => {
        syncDropdownField('basicInfo.asset_type', assetTypeOptions);
    }, [assetTypeOptions]);

    useEffect(() => {
        syncDropdownField('basicInfo.running_hours_unit', runningHoursUnitOptions);
    }, [formik.values.basicInfo.running_hours_unit]);

    useEffect(() => {
        syncDropdownField('basicInfo.status', statusOptions);
    }, [statusOptions]);

    useEffect(() => {
        syncDropdownField('financialInfo.site_project', siteProjectOptions);
    }, [siteProjectOptions]);

    return (
        <form id="asset-inventory-form" onSubmit={formik.handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {SECTION_FIELDS.map((section) => (
                    <Paper
                        key={section.key}
                        className="p-4 h-full bg-[#f9f9f9] border border-[#e0e0e0] rounded-md"
                    >
                        <div className="flex flex-col gap-3">
                            {section.fields.map((field) => {
                                const fieldPath = `${section.key}.${field.name}`;
                                const dropdownConfig = dropdownByFieldPath[fieldPath];

                                if (fieldPath === 'financialInfo.assign_inspection_form') {
                                    return (
                                        <div key={fieldPath}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <p
                                                    className="font-bold text-[#1f2f43]"
                                                    style={{ fontSize: assetInventorySizeConfig.form.sectionTitleFontSize }}
                                                >
                                                    Assign Inspection Form
                                                </p>
                                                <Button
                                                    size="small"
                                                    startIcon={<MdPlaylistAddCheck size={16} />}
                                                    onClick={openInspectionDialog}
                                                    className="rounded-[10px] normal-case font-bold text-[0.78rem] px-3 border border-[#0a6ed1] text-[#0a6ed1] bg-white"
                                                >
                                                    Add Form
                                                </Button>
                                            </div>

                                            <div className="border-t border-b border-[#c9d5e3]">
                                                {selectedInspectionForms.length === 0 ? (
                                                    <p
                                                        className="py-2.5 text-[#6b7280]"
                                                        style={{ fontSize: assetInventorySizeConfig.form.helperFontSize }}
                                                    >
                                                        No inspection form selected
                                                    </p>
                                                ) : (
                                                    selectedInspectionForms.map((option: DropdownOption) => (
                                                        <div
                                                            key={option.value}
                                                            className="flex items-center justify-between py-1.5 border-b border-[#e5e7eb] last:border-b-0"
                                                        >
                                                            <p
                                                                className="text-[#1f2f43]"
                                                                style={{ fontSize: assetInventorySizeConfig.form.selectedItemFontSize }}
                                                            >
                                                                {option.label}
                                                            </p>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    const next = (formik.values.financialInfo.assign_inspection_form || []).filter((item) => item !== option.value);
                                                                    formik.setFieldValue('financialInfo.assign_inspection_form', next);
                                                                }}
                                                                className="text-[#1f2f43]"
                                                            >
                                                                <FiX size={16} />
                                                            </IconButton>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <Dialog open={inspectionDialogOpen} onClose={closeInspectionDialog} fullWidth maxWidth="sm">
                                                <DialogTitle className="pb-1.5 text-[1.02rem]">Select Inspection Form</DialogTitle>
                                                <DialogContent className="pt-0">
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        placeholder="Search"
                                                        value={inspectionSearch}
                                                        onChange={(event) => setInspectionSearch(event.target.value)}
                                                        endAdornment={<FaSearch size={13} />}
                                                        className="mb-2"
                                                    />

                                                    <div
                                                        className="border border-[#d5dbe3] rounded overflow-y-auto"
                                                        style={{ maxHeight: assetInventorySizeConfig.form.dialogListMaxHeight }}
                                                    >
                                                        {filteredInspectionForms.map((option: DropdownOption) => {
                                                            const checked = draftInspectionFormValues.includes(option.value);
                                                            return (
                                                                <button
                                                                    key={option.value}
                                                                    type="button"
                                                                    onClick={() => toggleInspectionSelection(option.value)}
                                                                    className="w-full flex items-center gap-2.5 text-left px-3 py-1.5 border-b border-[#e5e7eb] last:border-b-0 hover:bg-[#f4f7fb]"
                                                                >
                                                                    <Checkbox checked={checked} />
                                                                    <span className="text-sm text-[#1f2937]">{option.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                        {!isInspectionFormLoading && filteredInspectionForms.length === 0 && (
                                                            <p
                                                                className="p-3 text-[#6b7280]"
                                                                style={{ fontSize: assetInventorySizeConfig.form.helperFontSize }}
                                                            >
                                                                No matching inspection form found
                                                            </p>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                                <DialogActions>
                                                    <Button onClick={closeInspectionDialog} className="normal-case text-[0.8rem] bg-transparent text-[#1f2937] hover:bg-black/5">
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            formik.setFieldValue('financialInfo.assign_inspection_form', draftInspectionFormValues);
                                                            closeInspectionDialog();
                                                        }}
                                                        className="normal-case rounded-[10px] text-[0.8rem] bg-[#0a6ed1] text-white"
                                                    >
                                                        Select
                                                    </Button>
                                                </DialogActions>
                                            </Dialog>
                                        </div>
                                    );
                                }

                                if (dropdownConfig) {
                                    const options = toAutocompleteOptions(dropdownConfig.options);
                                    const currentValue = String(formik.getFieldProps(fieldPath).value ?? '');
                                    const selectedOption = options.find((option) => option.id === currentValue)
                                        ?? options.find((option) => option.label.toLowerCase() === currentValue.toLowerCase())
                                        ?? null;

                                    return (
                                        <Autocomplete
                                            key={fieldPath}
                                            size="small"
                                            options={options}
                                            value={selectedOption}
                                            onChange={(option) => {
                                                formik.setFieldValue(fieldPath, option?.id ?? null);
                                            }}
                                            label={field.label}
                                        />
                                    );
                                }

                                if (fieldPath === 'financialInfo.required_geo_location_while_inspection') {
                                    return (
                                        <CheckboxOption
                                            key={fieldPath}
                                            checked={Boolean(formik.values.financialInfo.required_geo_location_while_inspection)}
                                            label={field.label}
                                            onChange={(checked) => {
                                                formik.setFieldValue('financialInfo.required_geo_location_while_inspection', checked);
                                            }}
                                        />
                                    );
                                }

                                if (fieldPath === 'basicInfo.inventory') {
                                    return (
                                        <TextField
                                            key={fieldPath}
                                            fullWidth
                                            label={field.label}
                                            type="number"
                                            value={formik.getFieldProps(fieldPath).value ?? ''}
                                            onChange={(event) => {
                                                const nextValue = event.target.value;
                                                formik.setFieldValue(
                                                    fieldPath,
                                                    nextValue === '' ? null : Number(nextValue)
                                                );
                                            }}
                                            onBlur={formik.handleBlur}
                                            name={fieldPath}
                                            size="small"
                                        />
                                    );
                                }

                                return (
                                    <TextField
                                        key={fieldPath}
                                        fullWidth
                                        label={field.label}
                                        type={field.type ?? 'text'}
                                        value={formik.getFieldProps(fieldPath).value ?? ''}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        name={fieldPath}
                                        size="small"
                                    />
                                );
                            })}
                        </div>
                    </Paper>
                ))}
            </div>
        </form>
    );
}

export default AddAssetInventoryPage;
