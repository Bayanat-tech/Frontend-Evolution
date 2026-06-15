import { useState, useEffect } from 'react';
import { FiSave, FiX } from 'react-icons/fi';
import { inUpdInspectionForm } from './api/section_api_call';
import { useAuth } from '../../../state/AuthContext';

interface AddUpdInspectionFormPageProps {
    rowData?: any;
    mode: string;
    onCancel?: () => void;
    refetch?: () => void;
}

const AddUpdInspectionFormPage = ({
    rowData,
    mode,
    onCancel,
    refetch,
}: AddUpdInspectionFormPageProps) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setName(rowData?.inspection_form_name || '');
        setDescription(rowData?.description || '');
    }, [rowData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        try {
            await inUpdInspectionForm(
                name.trim(),
                description.trim(),
                user?.loginid ?? '',
                mode === 'edit' ? rowData?.inspection_form_code : null
            );
            refetch?.();
            onCancel?.();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
            <div className="field" style={{ marginBottom: 14 }}>
                <span>Form Title <b>*</b></span>
                <input
                    className="ui-input"
                    type="text"
                    placeholder="Enter form title"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>

            <div className="field" style={{ marginBottom: 20 }}>
                <span>Form Description</span>
                <textarea
                    className="ui-textarea"
                    placeholder="Enter a description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                    type="submit"
                    className="ui-button ui-button-default ui-button-sm"
                    disabled={submitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <FiSave size={15} />
                    {submitting ? 'Saving...' : 'Save'}
                </button>
                <button
                    type="button"
                    className="ui-button ui-button-secondary ui-button-sm"
                    onClick={onCancel}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <FiX size={15} />
                    Cancel
                </button>
            </div>
        </form>
    );
};

export default AddUpdInspectionFormPage;