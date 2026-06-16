import { useMemo, useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useAuth } from '../../../../state/AuthContext';
import { delUnderSection } from '../api/section_api_call';
import AddSectionPage from './header/AddSectionPage';
import AddUnderSectionPage from './under-section/AddUnderSectionPage';
import { GridRow, useSectionInspectionGrid } from './useSectionInspectionGrid';
import { DataTable } from '../../../../components/ui/DataTable';

interface SectionInspectionFormProps {
    rowData: any;
}

const Modal = ({
    open,
    onClose,
    children,
    width = 460,
}: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    width?: number;
}) => {
    if (!open) return null;
    return (
        <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
            <div
                className="modal-card"
                style={{ width, maxWidth: '96vw', padding: 0, borderRadius: 14 }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};

const DeleteConfirmModal = ({
    open,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    if (!open) return null;
    return (
        <div className="modal-backdrop" style={{ zIndex: 1300 }} onClick={onCancel}>
            <div
                className="modal-card"
                style={{ width: 380, maxWidth: '96vw' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-head">
                    <div>
                        <h2>Delete Item</h2>
                        <p>Are you sure you want to delete this inspection item? This action cannot be undone.</p>
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

const SectionInspectionForm = ({ rowData }: SectionInspectionFormProps) => {
    const { user } = useAuth();
    const inspectionFormId: number = rowData?.inspection_form_code;

    const [sectionDialog, setSectionDialog] = useState<{ open: boolean; mode: 'add' | 'update' }>({
        open: false,
        mode: 'add',
    });
    const [updateDialog, setUpdateDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<any>(null);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [deletingRow, setDeletingRow] = useState<any>(null);

    const {
        columnDefs,
        rowData: rowGridData,
        isFetching,
        isError,
        gridData,
        refetch,
    } = useSectionInspectionGrid(inspectionFormId, (action, data) => {
        if (action === 'update') {
            setEditingRow(data);
            setUpdateDialog(true);
        } else if (action === 'delete') {
            setDeletingRow(data);
            setDeleteDialog(true);
        }
    });

    const sectionOptions = useMemo(
        () =>
            rowGridData
                .filter((item): item is Extract<GridRow, { rowType: 'section' }> => item.rowType === 'section')
                .map((item) => ({
                    id: item.header_section_id,
                    label: item.header_section_title,
                    underSectionCount: gridData.filter(
                        (r) =>
                            r.header_section_id === item.header_section_id &&
                            r.under_section_id !== null &&
                            r.under_section_id !== undefined
                    ).length,
                })),
        [rowGridData, gridData]
    );

    const confirmDelete = async () => {
        if (!deletingRow?.under_section_id || !deletingRow?.header_section_id) return;
        await delUnderSection(
            Number(deletingRow.under_section_id),
            Number(deletingRow.header_section_id),
            user?.loginid ?? ''
        );
        setDeleteDialog(false);
        setDeletingRow(null);
        refetch();
    };

    const rowClassName = (row: GridRow) =>
        row.rowType === 'section' ? 'section-header-row' : 'section-item-row';

    return (
        <>
            <h3 style={{ fontWeight: 700, marginBottom: 12, color: '#374151', fontSize: '1rem' }}>
                Checklist View/Edit
            </h3>

            <div style={{ display: 'flex', width: '100%', gap: 0 }}>
                {/* Left: grid panel */}
                <div style={{ flex: '1 1 0', minWidth: 0, paddingRight: 16 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                        <button
                            className="ui-button ui-button-default ui-button-sm"
                            style={{ borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => setSectionDialog({ open: true, mode: 'add' })}
                        >
                            <FaPlus size={11} />
                            Add Section
                        </button>
                        <button
                            className="ui-button ui-button-default ui-button-sm"
                            style={{ borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            onClick={() => setSectionDialog({ open: true, mode: 'update' })}
                        >
                            <FaPlus size={11} />
                            Update Section Name
                        </button>
                    </div>

                    <div style={{ marginBottom: 6, fontSize: 12, color: '#6b7280' }}>
                        {isFetching ? 'Loading sections...' : `Records: ${gridData.length}`}
                        {isError ? ' (Fetch failed)' : ''}
                    </div>

                    <DataTable
                        columns={columnDefs}
                        data={rowGridData}
                        loading={isFetching}
                        height={460}
                        density="compact"
                        enablePagination={false}
                        enableColumnFilters={false}
                        rowClassName={rowClassName}
                        getRowId={(row) => row.id}
                        emptyText="No sections found. Add a section to get started."
                    />
                </div>

                {/* Right: Add Item panel */}
                <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid #e5e7eb', paddingLeft: 16 }}>
                    <AddUnderSectionPage
                        sectionOptions={sectionOptions}
                        inspectionFormId={inspectionFormId}
                        refetch={refetch}
                        mode="add"
                    />
                </div>
            </div>

            <Modal
                open={sectionDialog.open}
                onClose={() => setSectionDialog((p) => ({ ...p, open: false }))}
                width={420}
            >
                <AddSectionPage
                    inspection_form_id={inspectionFormId}
                    refetch={refetch}
                    mode={sectionDialog.mode}
                    sectionOptions={sectionOptions}
                    onCancel={() => setSectionDialog((p) => ({ ...p, open: false }))}
                />
            </Modal>

            <Modal
                open={updateDialog}
                onClose={() => {
                    setUpdateDialog(false);
                    setEditingRow(null);
                }}
                width={480}
            >
                <AddUnderSectionPage
                    sectionOptions={sectionOptions}
                    inspectionFormId={inspectionFormId}
                    refetch={refetch}
                    mode="update"
                    underSectionId={editingRow?.under_section_id}
                    defaultValues={
                        editingRow
                            ? {
                                  header_section_id: editingRow.header_section_id,
                                  under_section_title: editingRow.under_section_title,
                                  type: editingRow.type,
                                  required: editingRow.required === 'Y',
                                  sort_order: editingRow.sort_order,
                                  instruction: editingRow.instruction ?? '',
                              }
                            : undefined
                    }
                    onEditComplete={() => {
                        setUpdateDialog(false);
                        setEditingRow(null);
                    }}
                    onCancel={() => {
                        setUpdateDialog(false);
                        setEditingRow(null);
                    }}
                />
            </Modal>

            <DeleteConfirmModal
                open={deleteDialog}
                onConfirm={confirmDelete}
                onCancel={() => {
                    setDeleteDialog(false);
                    setDeletingRow(null);
                }}
            />
        </>
    );
};

export default SectionInspectionForm;