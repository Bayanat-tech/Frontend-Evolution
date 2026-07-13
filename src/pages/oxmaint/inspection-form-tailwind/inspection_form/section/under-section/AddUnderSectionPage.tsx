import { FormikProps } from 'formik';
import {
    Autocomplete,
    Button,
    CheckboxOption,
    FieldLabel,
    RadioGroup,
    RadioOption,
    TextField
} from '../../../../../../components/mms_ui';
import { inUpdUnderSection } from '../../api/section_api_call';
import { useAuth } from '../../../../../../state/AuthContext';

interface SectionOption {
    id: number;
    label: string;
    underSectionCount?: number;
}

interface TInspectionItemForm {
    header_section_id: number | null;
    under_section_title: string;
    type: string;
    required: boolean;
    sort_order: number | '';
    instruction: string;
}

interface AddUnderSectionPageProps {
    formik: FormikProps<TInspectionItemForm>;
    sectionOptions: SectionOption[];
    mode?: 'add' | 'update';
    inspectionFormId: number;
    refetch: () => void;
    underSectionId?: number | null;
    onEditComplete?: () => void;
    onCancel?: () => void;
}

const AddUnderSectionPage = ({
    formik,
    sectionOptions,
    mode = 'add',
    inspectionFormId,
    refetch,
    underSectionId = null,
    onEditComplete,
    onCancel
}: AddUnderSectionPageProps) => {
    const { user } = useAuth();
    const typeOptions = ['Good-Repair-Replace-NA', 'Yes-No-NA', 'Text Field', 'Number', 'Pass-Fail-NA', 'Ok-Faulty-NA'];

    const selectedSection = sectionOptions.find((option) => option.id === formik.values.header_section_id) ?? null;

    const nextSortOrder = selectedSection ? (selectedSection.underSectionCount ?? 0) + 1 : '';

    const handleSectionChange = (sectionId: number | null) => {
        formik.setFieldValue('header_section_id', sectionId);
        formik.setFieldValue('sort_order', sectionId ? ((sectionOptions.find((option) => option.id === sectionId)?.underSectionCount ?? 0) + 1) : '');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formik.values.header_section_id || !formik.values.under_section_title.trim()) {
            return;
        }

        const sortOrderValue = formik.values.sort_order === '' ? 0 : Number(formik.values.sort_order);

        try {
            const result = await inUpdUnderSection(
                formik.values.header_section_id,
                formik.values.under_section_title,
                formik.values.type,
                formik.values.required ? 'Y' : 'N',
                sortOrderValue,
                formik.values.instruction,
                user?.loginid || '',
                underSectionId
            );

            console.log('API response for under section:', result);
            formik.resetForm();
            refetch();

            if (onEditComplete) {
                onEditComplete();
            }
        } catch (error) {
            console.error('Error submitting under section:', error);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md max-w-[90vw] p-2 border border-[#e5e7eb] h-full">
            <div 
            // className="px-4 py-3 bg-[#f3f4f6] border-b border-[#e5e7eb]"
            >
                <p className="text-[0.95rem] font-semibold text-[#1f2937] m-0">
                    {mode === 'update' ? 'Update Inspection Item' : 'Add Inspection Item'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 p-4">
                <Autocomplete
                    size="small"
                    options={sectionOptions}
                    value={selectedSection}
                    onChange={(value) => handleSectionChange(value?.id ?? null)}
                    label="Section"
                    required
                    error={Boolean(formik.touched.header_section_id && formik.errors.header_section_id)}
                />

                <TextField
                    size="small"
                    name="under_section_title"
                    label="Item"
                    value={formik.values.under_section_title}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                />

                <div>
                    <FieldLabel>Type</FieldLabel>
                    <RadioGroup className="grid grid-cols-2 gap-1.5">
                        {typeOptions.map((typeOption) => (
                            <RadioOption
                                key={typeOption}
                                checked={formik.values.type === typeOption}
                                label={typeOption}
                                onClick={() => formik.setFieldValue('type', typeOption)}
                            />
                        ))}
                    </RadioGroup>
                </div>

                <CheckboxOption
                    checked={formik.values.required}
                    label="Required"
                    onChange={(checked) => formik.setFieldValue('required', checked)}
                />

                <TextField
                    size="small"
                    name="sort_order"
                    label="Sort Order"
                    type="number"
                    value={formik.values.sort_order === '' ? nextSortOrder : formik.values.sort_order}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                />

                <TextField
                    size="small"
                    name="instruction"
                    label="Instructions"
                    value={formik.values.instruction}
                    onChange={formik.handleChange}
                    multiline
                    minRows={2}
                />

                <div className="flex gap-2 mt-1.5">
                    <Button
                        type="submit"
                        size="small"
                        className={`bg-[#0a6ed1] text-white font-semibold text-[0.85rem] py-[5.6px] ${mode === 'update' ? 'flex-1' : ''}`}
                    >
                        {mode === 'update' ? 'Update' : 'Save'}
                    </Button>
                    {mode === 'update' && onCancel && (
                        <Button
                            type="button"
                            size="small"
                            onClick={onCancel}
                            className="flex-1 border border-[#c8d3df] text-[#243447] bg-white font-semibold text-[0.85rem] py-[5.6px]"
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default AddUnderSectionPage;
