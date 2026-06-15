import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { FaPlus } from 'react-icons/fa';
import AddUpdInspectionFormPage from './AddUpdInspectionFormPage';
import SectionInspectionForm from './section/SectionInspectionForm';
import { delInspectionForm } from './api/section_api_call';
import { getDynamicLookup } from '../../../api/lookups';
import { useAuth } from '../../../state/AuthContext';
import { DataTable } from '../../../components/ui/DataTable';

/* ── Shared QueryClient for this module ────────────────────────────────── */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 1000 * 30,
        },
    },
});

/* ── Tiny modal shell ───────────────────────────────────────────────────── */
const Modal = ({
    open,
    onClose,
    width = 560,
    fullscreen = false,
    children,
}: {
    open: boolean;
    onClose?: () => void;
    width?: number | string;
    fullscreen?: boolean;
    children: React.ReactNode;
}) => {
    if (!open) return null;
    return (
        <div
            className="modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={onClose}
        >
            <div
                className="modal-card"
                style={{
                    width: fullscreen ? 'min(96vw, 90vw)' : width,
                    maxWidth: fullscreen ? '96vw' : undefined,
                    maxHeight: fullscreen ? '90vh' : undefined,
                    height: fullscreen ? '88vh' : undefined,
                    display: fullscreen ? 'flex' : undefined,
                    flexDirection: fullscreen ? 'column' : undefined,
                    padding: 0,
                    borderRadius: 18,
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};

/* ── Delete confirm modal ───────────────────────────────────────────────── */
const DeleteConfirmModal = ({
    open,
    message,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    if (!open) return null;
    return (
        <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={onCancel}>
            <div
                className="modal-card"
                style={{ width: 380, maxWidth: '96vw' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-head">
                    <div>
                        <h2>Confirm Delete</h2>
                        <p>{message}</p>
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="ui-button ui-button-secondary ui-button-sm" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="ui-button ui-button-destructive ui-button-sm" onClick={onConfirm}>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Row type ───────────────────────────────────────────────────────────── */
type InspectionFormRow = {
    inspection_form_code: number;
    inspection_form_name: string;
    description?: string;
};

/* ── Inner page (uses hooks — must be inside QueryClientProvider) ───────── */
const InspectionFormPageInner = () => {
    const { user } = useAuth();
    const [selectedRow, setSelectedRow] = useState<InspectionFormRow | null>(null);
    const [formDialog, setFormDialog] = useState<{ open: boolean; type: 'add' | 'edit' }>({
        open: false,
        type: 'add',
    });
    const [sectionDialog, setSectionDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [deletingRow, setDeletingRow] = useState<InspectionFormRow | null>(null);

    const { data: gridData, refetch, isFetching, isError } = useQuery<InspectionFormRow[]>({
        queryKey: ['inspection-form', user?.loginid],
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: 'OX_INSPECTION_FORM_MAIN_PAGE',
                loginid: user?.loginid ?? '',
            });
            if (Array.isArray(response)) return response;
            if (response && typeof response === 'object' && Array.isArray((response as any).data))
                return (response as any).data;
            return [];
        },
    });

    const columns: ColumnDef<InspectionFormRow>[] = [
        {
            id: 'form_name',
            header: 'Form Name',
            enableColumnFilter: false,
            enableSorting: false,
            cell: ({ row }) => {
                const data = row.original;
                return (
                    <div
                        className="sap-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            setSelectedRow(data);
                            setSectionDialog(true);
                        }}
                    >
                        <div className="sap-icon">📄</div>
                        <div className="sap-content">
                            <div className="sap-title">{data.inspection_form_name}</div>
                            <div className="sap-description">{data.description ?? '—'}</div>
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            size: 140,
            enableColumnFilter: false,
            enableSorting: false,
            cell: ({ row }) => {
                const data = row.original;
                return (
                    <div
                        style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#2563eb', fontWeight: 600, fontSize: 13, padding: 0,
                            }}
                            onClick={() => {
                                setSelectedRow(data);
                                setFormDialog({ open: true, type: 'edit' });
                            }}
                        >
                            Edit
                        </button>
                        <button
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#dc2626', fontWeight: 600, fontSize: 13, padding: 0,
                            }}
                            onClick={() => {
                                setDeletingRow(data);
                                setDeleteDialog(true);
                            }}
                        >
                            Delete
                        </button>
                    </div>
                );
            },
        },
    ];

    const handleConfirmDelete = async () => {
        if (!deletingRow?.inspection_form_code) return;
        try {
            const res = await delInspectionForm(deletingRow.inspection_form_code, user?.loginid ?? '');
            if ((res as any)?.success) refetch();
            else console.error((res as any)?.message ?? 'Delete failed');
        } catch (err) {
            console.error(err);
        } finally {
            setDeleteDialog(false);
            setDeletingRow(null);
        }
    };

    return (
        <div>
            {/* Page header */}
            <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                paddingBottom: 10, borderBottom: '1px solid #aebbd0', marginBottom: 16,
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' }}>Checklist</h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                        Manage inspection form templates
                    </p>
                </div>
                <button
                    className="ui-button ui-button-default ui-button-sm"
                    style={{ borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                        setSelectedRow(null);
                        setFormDialog({ open: true, type: 'add' });
                    }}
                >
                    <FaPlus size={11} />
                    Create New Form
                </button>
            </div>

            {isError && (
                <div className="alert error" style={{ marginBottom: 12 }}>
                    Failed to load inspection forms. Please refresh and try again.
                </div>
            )}

            <DataTable
                columns={columns}
                data={gridData ?? []}
                loading={isFetching}
                height={520}
                density="comfortable"
                enablePagination={false}
                enableColumnFilters={false}
                emptyText="No inspection forms yet. Click 'Create New Form' to get started."
            />

            {/* Add / Edit Form modal */}
            <Modal
                open={formDialog.open}
                onClose={() => setFormDialog((p) => ({ ...p, open: false }))}
                width={520}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 20px', borderBottom: '2px solid #2aa160',
                    fontSize: '1rem', fontWeight: 700, color: '#223246', background: '#fff',
                }}>
                    <span style={{ color: '#2aa160', fontSize: '1.1rem' }}>✔</span>
                    {formDialog.type === 'add' ? 'Add Inspection Form' : 'Edit Inspection Form'}
                </div>
                <AddUpdInspectionFormPage
                    rowData={selectedRow}
                    mode={formDialog.type}
                    refetch={refetch}
                    onCancel={() => setFormDialog((p) => ({ ...p, open: false }))}
                />
            </Modal>

            {/* Section / Checklist fullscreen modal */}
            <Modal open={sectionDialog} width="90vw" fullscreen>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    <SectionInspectionForm rowData={selectedRow} />
                </div>
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'flex-end', background: '#fff',
                }}>
                    <button
                        className="ui-button ui-button-secondary ui-button-sm"
                        onClick={() => setSectionDialog(false)}
                        style={{ fontWeight: 700 }}
                    >
                        Close
                    </button>
                </div>
            </Modal>

            {/* Delete confirm modal */}
            <DeleteConfirmModal
                open={deleteDialog}
                message="Are you sure you want to delete this inspection form? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={() => {
                    setDeleteDialog(false);
                    setDeletingRow(null);
                }}
            />
        </div>
    );
};

/* ── Public export: wraps inner page with its own QueryClientProvider ───── */
const InspectionFormPage = () => (
    <QueryClientProvider client={queryClient}>
        <InspectionFormPageInner />
    </QueryClientProvider>
);

export default InspectionFormPage;