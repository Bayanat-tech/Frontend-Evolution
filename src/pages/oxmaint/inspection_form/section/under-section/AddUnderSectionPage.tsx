import { useState, useEffect } from 'react';
import { useAuth } from '../../../../../state/AuthContext';
import { inUpdUnderSection } from '../../api/section_api_call';

interface SectionOption {
    id: number;
    label: string;
    underSectionCount?: number;
}

interface AddUnderSectionPageProps {
    sectionOptions: SectionOption[];
    mode?: 'add' | 'update';
    inspectionFormId: number;
    refetch: () => void;
    underSectionId?: number | null;
    onEditComplete?: () => void;
    onCancel?: () => void;
    // For pre-populating in update mode — passed from parent
    defaultValues?: {
        header_section_id?: number | null;
        under_section_title?: string;
        type?: string;
        required?: boolean;
        sort_order?: number | '';
        instruction?: string;
    };
}

const TYPE_OPTIONS = [
    'Good-Repair-Replace-NA',
    'Yes-No-NA',
    'Text Field',
    'Number',
    'Pass-Fail-NA',
    'Ok-Faulty-NA',
];

const AddUnderSectionPage = ({
    sectionOptions,
    mode = 'add',
    inspectionFormId,
    refetch,
    underSectionId = null,
    onEditComplete,
    onCancel,
    defaultValues,
}: AddUnderSectionPageProps) => {
    const { user } = useAuth();

    const [headerSectionId, setHeaderSectionId] = useState<number | ''>('');
    const [underSectionTitle, setUnderSectionTitle] = useState('');
    const [type, setType] = useState('Good-Repair-Replace-NA');
    const [required, setRequired] = useState(false);
    const [sortOrder, setSortOrder] = useState<number | ''>('');
    const [instruction, setInstruction] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Populate from defaultValues when mode=update or when they change
    useEffect(() => {
        if (defaultValues) {
            setHeaderSectionId(defaultValues.header_section_id ?? '');
            setUnderSectionTitle(defaultValues.under_section_title ?? '');
            setType(defaultValues.type ?? 'Good-Repair-Replace-NA');
            setRequired(defaultValues.required ?? false);
            setSortOrder(defaultValues.sort_order ?? '');
            setInstruction(defaultValues.instruction ?? '');
        }
    }, [defaultValues]);

    // Auto-set sort order when section changes (add mode)
    const handleSectionChange = (id: number | '') => {
        setHeaderSectionId(id);
        if (mode === 'add' && id) {
            const found = sectionOptions.find((o) => o.id === Number(id));
            setSortOrder(found ? (found.underSectionCount ?? 0) + 1 : '');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!headerSectionId || !underSectionTitle.trim()) return;

        const sortVal = sortOrder === '' ? 0 : Number(sortOrder);
        setSubmitting(true);
        try {
            await inUpdUnderSection(
                Number(headerSectionId),
                underSectionTitle.trim(),
                type,
                required ? 'Y' : 'N',
                sortVal,
                instruction,
                user?.loginid || '',
                underSectionId
            );
            if (mode === 'add') {
                setHeaderSectionId('');
                setUnderSectionTitle('');
                setType('Good-Repair-Replace-NA');
                setRequired(false);
                setSortOrder('');
                setInstruction('');
            }
            refetch();
            onEditComplete?.();
        } finally {
            setSubmitting(false);
        }
    };

    const isUpdate = mode === 'update';

    return (
        <div style={{ background: '#fff' }}>
            {/* Panel header */}
            <div
                style={{
                    padding: '10px 16px',
                    background: '#f3f4f6',
                    borderBottom: '1px solid #e5e7eb',
                }}
            >
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2937' }}>
                    {isUpdate ? 'Update Inspection Item' : 'Add Inspection Item'}
                </span>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '14px 16px', display: 'grid', gap: 10 }}>
                {/* Section */}
                <div className="field">
                    <span>Section <b>*</b></span>
                    <select
                        className="ui-select"
                        value={headerSectionId}
                        onChange={(e) =>
                            handleSectionChange(e.target.value ? Number(e.target.value) : '')
                        }
                        required
                        style={{ height: 34, fontSize: 13 }}
                    >
                        <option value="">— Select section —</option>
                        {sectionOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Item title */}
                <div className="field">
                    <span>Item <b>*</b></span>
                    <input
                        className="ui-input"
                        type="text"
                        placeholder="Enter inspection item"
                        value={underSectionTitle}
                        onChange={(e) => setUnderSectionTitle(e.target.value)}
                        required
                        style={{ height: 34, fontSize: 13 }}
                    />
                </div>

                {/* Type — radio grid */}
                <div className="field">
                    <span>Type</span>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '4px 12px',
                            marginTop: 2,
                        }}
                    >
                        {TYPE_OPTIONS.map((opt) => (
                            <label
                                key={opt}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    color: '#374151',
                                    userSelect: 'none',
                                }}
                            >
                                <input
                                    type="radio"
                                    name="type"
                                    value={opt}
                                    checked={type === opt}
                                    onChange={() => setType(opt)}
                                    style={{ accentColor: '#00378c', margin: 0 }}
                                />
                                {opt}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Required checkbox */}
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        fontSize: 12,
                        cursor: 'pointer',
                        color: '#374151',
                        userSelect: 'none',
                        marginTop: -2,
                    }}
                >
                    <input
                        type="checkbox"
                        checked={required}
                        onChange={(e) => setRequired(e.target.checked)}
                        style={{ accentColor: '#00378c', width: 14, height: 14, margin: 0 }}
                    />
                    Required
                </label>

                {/* Sort Order */}
                <div className="field">
                    <span>Sort Order</span>
                    <input
                        className="ui-input"
                        type="number"
                        placeholder="Auto"
                        value={sortOrder}
                        onChange={(e) =>
                            setSortOrder(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        style={{ height: 34, fontSize: 13 }}
                    />
                </div>

                {/* Instructions */}
                <div className="field">
                    <span>Instructions</span>
                    <textarea
                        className="ui-textarea"
                        placeholder="Optional instructions for this item"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        rows={2}
                        style={{ minHeight: 52, fontSize: 13 }}
                    />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                        type="submit"
                        className="ui-button ui-button-default ui-button-sm"
                        disabled={submitting}
                        style={{ flex: isUpdate ? 1 : undefined }}
                    >
                        {submitting ? 'Saving...' : isUpdate ? 'Update' : 'Save'}
                    </button>
                    {isUpdate && onCancel && (
                        <button
                            type="button"
                            className="ui-button ui-button-secondary ui-button-sm"
                            onClick={onCancel}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default AddUnderSectionPage;