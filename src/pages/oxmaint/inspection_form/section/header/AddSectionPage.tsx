import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { inUpdHeaderSection } from '../../api/section_api_call';
import { useAuth } from '../../../../../state/AuthContext';

type TSectionOption = {
    id: number;
    label: string;
};

interface AddSectionPageProps {
    inspection_form_id: number;
    refetch: () => void;
    onCancel?: () => void;
    mode?: 'add' | 'update';
    sectionOptions?: TSectionOption[];
}

const AddSectionPage = ({
    inspection_form_id,
    refetch,
    onCancel,
    mode = 'add',
    sectionOptions = [],
}: AddSectionPageProps) => {
    const { user } = useAuth();
    const [sectionTitle, setSectionTitle] = useState('');
    const [headerSectionId, setHeaderSectionId] = useState<number | ''>('');
    const [submitting, setSubmitting] = useState(false);

    const isUpdateMode = mode === 'update';
    const pageTitle = isUpdateMode ? 'Update Section' : 'Add Section';
    const actionLabel = isUpdateMode ? 'Update' : 'Add';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = sectionTitle.trim();
        if (!trimmed) return;
        if (isUpdateMode && !headerSectionId) return;

        setSubmitting(true);
        try {
            await inUpdHeaderSection(
                inspection_form_id,
                trimmed,
                user?.loginid || '',
                isUpdateMode ? Number(headerSectionId) : null
            );
            setSectionTitle('');
            setHeaderSectionId('');
            refetch();
            onCancel?.();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            style={{
                width: 400,
                maxWidth: '100%',
                borderRadius: 14,
                overflow: 'hidden',
                background: '#ececec',
                fontFamily: 'var(--app-font-family)',
            }}
        >
            {/* Header */}
            <div
                style={{
                    borderBottom: '2px solid #2aa160',
                    background: '#e4e4e4',
                    padding: '10px 16px',
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#223246',
                        lineHeight: 1,
                    }}
                >
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#2aa160',
                            color: '#fff',
                            flexShrink: 0,
                        }}
                    >
                        <Check size={12} strokeWidth={3} />
                    </span>
                    {pageTitle}
                </h2>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
                {isUpdateMode && (
                    <div className="field" style={{ marginBottom: 12 }}>
                        <span>Section</span>
                        <select
                            className="ui-select"
                            value={headerSectionId}
                            onChange={(e) =>
                                setHeaderSectionId(e.target.value ? Number(e.target.value) : '')
                            }
                            required
                        >
                            <option value="">— Select section —</option>
                            {sectionOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="field">
                    <span>{isUpdateMode ? 'New Section Name' : 'Section Title'}</span>
                    <input
                        className="ui-input"
                        type="text"
                        placeholder={isUpdateMode ? 'Enter new name' : 'Enter section title'}
                        value={sectionTitle}
                        onChange={(e) => setSectionTitle(e.target.value)}
                        required
                    />
                </div>

                <div
                    style={{
                        marginTop: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 16,
                    }}
                >
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: submitting ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#223246',
                            opacity: submitting ? 0.6 : 1,
                            padding: 0,
                        }}
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        {actionLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#223246',
                            padding: 0,
                        }}
                    >
                        <X size={16} strokeWidth={2.5} />
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddSectionPage;