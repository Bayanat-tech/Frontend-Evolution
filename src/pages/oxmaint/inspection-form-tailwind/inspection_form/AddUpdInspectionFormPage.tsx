import { useFormik } from 'formik';
import { FiSave, FiX } from 'react-icons/fi';
import { Button, TextField } from '../../../../components/mms_ui';
import { inUpdInspectionForm } from './api/section_api_call';
import { useAuth } from '../../../../state/AuthContext';

const AddUpdInspectionFormPage = ({
    rowData,
    mode,
    onCancel,
    refetch
}: {
    rowData?: any;
    mode: string;
    onCancel?: () => void;
    refetch?: () => void;
}) => {
    const { user } = useAuth();
    const initialValues = {
        name: rowData?.inspection_form_name || '', 
        description: rowData?.description || '',
    };
    
    const Formik = useFormik({
        initialValues: initialValues,
        enableReinitialize: true,
        onSubmit: async (values) => {
            await inUpdInspectionForm(
                values.name,
                values.description,
                user?.loginid ?? '',
                mode === 'edit' ? rowData?.inspection_form_code : null
            );
            refetch?.();
            onCancel?.();
        }
    });
    return (
        <form onSubmit={Formik.handleSubmit} className="p-6">
            <div className="mb-4">
                <TextField
                    fullWidth
                    label="Form Title"
                    name="name"
                    value={Formik.values.name}
                    onChange={Formik.handleChange}
                    onBlur={Formik.handleBlur}
                    size="small"
                />
            </div>

            <div className="mb-4">
                <TextField
                    fullWidth
                    label="Form Description"
                    name="description"
                    value={Formik.values.description}
                    onChange={Formik.handleChange}
                    onBlur={Formik.handleBlur}
                    multiline
                    minRows={3}
                    size="small"
                />
            </div>

            <div className="flex justify-end gap-3 mt-2">
                <Button
                    type="submit"
                    size="small"
                    startIcon={<FiSave size={18} />}
                    className="text-[#223246] font-bold normal-case text-base bg-transparent hover:bg-black/5"
                >
                    Save
                </Button>
                <Button
                    type="button"
                    size="small"
                    startIcon={<FiX size={18} />}
                    onClick={onCancel}
                    className="text-[#223246] font-bold normal-case text-base bg-transparent hover:bg-black/5"
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
};

export default AddUpdInspectionFormPage;
