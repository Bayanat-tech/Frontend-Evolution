import { useFormik } from "formik";
import { Check, Plus, X } from "lucide-react";
import { inUpdHeaderSection } from "../../api/section_api_call";
import { useAuth } from "../../../../../../state/AuthContext";
import { Autocomplete } from "../../../../../../components/mms_ui";

type TSectionOption = {
    id: number;
    label: string;
};

type AddSectionPageProps = {
    inspection_form_id: number;
    refetch: () => void;
    onCancel?: () => void;
    mode?: 'add' | 'update';
    sectionOptions?: TSectionOption[];
};

const AddSectionPage = ({
    inspection_form_id,
    refetch,
    onCancel,
    mode = 'add',
    sectionOptions = []
}: AddSectionPageProps) => {
    const { user } = useAuth();
    const Formik = useFormik({
        enableReinitialize: true,
        initialValues: {
            section_title: '',
            header_section_id: null as number | null
        },
        onSubmit: async (values) => {
            const sectionTitle = values.section_title.trim();
            if (!sectionTitle) return;
            if (mode === 'update' && !values.header_section_id) return;

            const insertInspectionItem = await inUpdHeaderSection(
                inspection_form_id,
                sectionTitle,
                user?.loginid || '',
                mode === 'update' ? values.header_section_id : null
            );
            console.log('API response for sections:', insertInspectionItem);
            Formik.resetForm();
            refetch();
            onCancel?.();
        }
    });

    const selectedSection = sectionOptions.find((option) => option.id === Formik.values.header_section_id) ?? null;

    const isUpdateMode = mode === 'update';
    const pageTitle = isUpdateMode ? 'Update Section' : 'Add Section';
    const actionLabel = isUpdateMode ? 'Update' : 'Add';

    return (
        <div className="w-[400px] max-w-full overflow-hidden rounded-xl bg-[#ececec] font-segoe">
            <div className="border-b-2 border-[#2aa160] bg-[#e4e4e4] px-4 py-2.5">
                <h1 className="flex items-center gap-2 text-lg font-semibold leading-none text-[#223246]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2aa160] text-white">
                        <Check size={12} strokeWidth={3} />
                    </span>
                    {pageTitle}
                </h1>
            </div>

            <form onSubmit={Formik.handleSubmit} className="px-4 py-4">
                {isUpdateMode && (
                    <Autocomplete
                        size="small"
                        options={sectionOptions}
                        value={selectedSection}
                        onChange={(value) => Formik.setFieldValue('header_section_id', value?.id ?? null)}
                        label="Section"
                        required
                        className="mb-3"
                    />
                )}

                <input
                    type="text"
                    name="section_title"
                    value={Formik.values.section_title}
                    onChange={Formik.handleChange}
                    placeholder=""
                    className="h-9 w-full rounded border border-[#c4c4c4] bg-white px-2.5 text-sm text-[#223246] outline-none transition focus:border-[#2aa160]"
                />

                <div className="mt-5 flex items-center justify-end gap-4">
                    <button
                        type="submit"
                        className="flex items-center gap-1.5 text-base font-semibold text-[#223246] transition hover:opacity-80"
                    >
                        <Plus size={16} strokeWidth={2.5} /> {actionLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex items-center gap-1.5 text-base font-semibold text-[#223246] transition hover:opacity-80"
                    >
                        <X size={16} strokeWidth={2.5} /> Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddSectionPage;
