import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { GridRow, useSectionInspectionGrid } from './useSectionInspectionGrid';
import { FaPlus } from 'react-icons/fa';
import { useMemo, useState } from 'react';
import { useFormik } from 'formik';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent } from '../../../../../components/mms_ui';
import { delUnderSection } from '../api/section_api_call';
import { useAuth } from '../../../../../state/AuthContext';
import AddUnderSectionPage from './under-section/AddUnderSectionPage';
import AddSectionPage from './header/AddSectionPage';

interface SectionInspectionFormProps {
    rowData: any;
}

type TInspectionItemForm = {
    header_section_id: number | null;
    under_section_title: string;
    type: string;
    required: boolean;
    sort_order: number | '';
    instruction: string;
};

const SectionInspectionForm = ({ rowData }: SectionInspectionFormProps) => {
    const { user } = useAuth();
    const [ dialogController, setDialogController ] = useState({
        open: false,
        mode: 'add' as 'add' | 'update',
    })
    const [ updateDialogOpen, setUpdateDialogOpen ] = useState(false);
    const [ editingRowData, setEditingRowData ] = useState<any>(null);
    const [ deleteDialogOpen, setDeleteDialogOpen ] = useState(false);
    const [ deletingRowData, setDeletingRowData ] = useState<any>(null);
    const inspectionFormId = rowData?.inspection_form_code;

    const handleDeleteUnderSection = (data: any) => {
        if (!data?.under_section_id || !data?.header_section_id) return;
        setDeletingRowData(data);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteUnderSection = async () => {
        if (!deletingRowData?.under_section_id || !deletingRowData?.header_section_id) return;

        await delUnderSection(
            Number(deletingRowData.under_section_id),
            Number(deletingRowData.header_section_id),
            user?.loginid ?? ''
        );

        setDeleteDialogOpen(false);
        setDeletingRowData(null);
        refetch();
    };

    const { columnDefs, rowData: rowGridData, isFetching, isError, gridData, toggleSection, refetch } = useSectionInspectionGrid(inspectionFormId, (action, data) => {
        if (action === 'update') {
            setEditingRowData(data);
            setUpdateDialogOpen(true);
        } else if (action === 'delete') {
            handleDeleteUnderSection(data);
        }
    });

    const table = useReactTable({
        data: rowGridData,
        columns: columnDefs,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id
    });

    const sectionOptions = useMemo(
        () =>
            rowGridData
                .filter((item: GridRow): item is Extract<GridRow, { rowType: 'section' }> => item.rowType === 'section')
                .map((item: any) => ({
                    id: item.header_section_id,
                    label: item.header_section_title,
                    underSectionCount: gridData.filter(
                        (row) => row.header_section_id === item.header_section_id && row.under_section_id !== null && row.under_section_id !== undefined
                    ).length
                })),
        [rowGridData, gridData]
    );

    const formik = useFormik<TInspectionItemForm>({
        initialValues: {
            header_section_id: null,
            under_section_title: '',
            type: 'Good-Repair-Replace-NA',
            required: false,
            sort_order: '',
            instruction: ''
        },
        // validationSchema: Yup.object({
        //     header_section_id: Yup.number().nullable().required('Add under Section is required'),
        //     under_section_title: Yup.string().trim().required('Inspection Item is required'),
        //     type: Yup.string().required('Type is required'),
        //     sort_order: Yup.number()
        //         .transform((value, originalValue) => (originalValue === '' ? null : value))
        //         .nullable()
        //         .typeError('Sort Order must be a number')
        //         .required('Sort Order is required')
        // }),
        onSubmit: (values) => {
            console.log('Inspection item payload:', {
                inspection_form_id: inspectionFormId,
                ...values,
                required: values.required ? 'Y' : 'N'
            });
        }
    });

    const editFormik = useFormik<TInspectionItemForm>({
        initialValues: {
            header_section_id: editingRowData?.header_section_id ?? null,
            under_section_title: editingRowData?.under_section_title ?? '',
            type: editingRowData?.type ?? 'Good-Repair-Replace-NA',
            required: editingRowData?.required === 'Y',
            sort_order: editingRowData?.sort_order ?? '',
            instruction: editingRowData?.instruction ?? ''
        },
        // validationSchema: Yup.object({
        //     header_section_id: Yup.number().nullable().required('Add under Section is required'),
        //     under_section_title: Yup.string().trim().required('Inspection Item is required'),
        //     type: Yup.string().required('Type is required'),
        //     sort_order: Yup.number()
        //         .transform((value, originalValue) => (originalValue === '' ? null : value))
        //         .nullable()
        //         .typeError('Sort Order must be a number')
        //         .required('Sort Order is required')
        // }),
        onSubmit: (values) => {
            console.log('Inspection item payload:', {
                inspection_form_id: inspectionFormId,
                ...values,
                required: values.required ? 'Y' : 'N'
            });
        },
        enableReinitialize: true
    });

    // Api call
    return (
        <>
        <h3 className="font-bold mb-3 text-[#374151]">
            Checklist View/Edit
        </h3>
        <div className="flex w-full flex-col lg:flex-row gap-0">
        {/* Left Section - Grid */}
            <div className="w-full lg:w-[70%] h-full min-w-0">
                <div className="px-4 py-1 w-full">
                    {/* Buttons */}
                    <div className="flex items-center justify-start mb-2.5 gap-2">
                        <Button
                            startIcon={<FaPlus size={12} />}
                            size="small"
                            onClick={() => setDialogController({ open: true, mode: 'add' })}
                            className="rounded-full normal-case bg-[#0a6ed1] text-white"
                        >
                            Add Section
                        </Button>
                        <Button
                            startIcon={<FaPlus size={12} />}
                            size="small"
                            onClick={() => setDialogController({ open: true, mode: 'update' })}
                            className="rounded-full normal-case bg-[#0a6ed1] text-white"
                        >
                            Update Section Name
                        </Button>
                    </div>

                    {/* Records Count */}
                    <p className="mb-2 text-xs text-[#6b7280]">
                        {isFetching ? 'Loading sections...' : `Records: ${gridData.length}`}
                        {isError ? ' (Fetch failed)' : ''}
                    </p>

                    {/* Grid */}
                    <div className="relative w-full">
                        <div className="w-full border border-[#e5e7eb] rounded-lg overflow-hidden">
                            <table className="w-full border-collapse table-fixed">
                                <thead>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id} className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                                            {headerGroup.headers.map((header) => (
                                                <th
                                                    key={header.id}
                                                    style={{ width: header.getSize() }}
                                                    className="text-left text-xs font-semibold text-[#374151] px-3 py-2 whitespace-normal"
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {table.getRowModel().rows.map((row) => {
                                        const isSection = row.original.rowType === 'section';

                                        return (
                                            <tr
                                                key={row.id}
                                                onClick={() => {
                                                    if (isSection) toggleSection(row.original.header_section_id);
                                                }}
                                                className={
                                                    isSection
                                                        ? 'bg-[#f3f4f6] border-t border-b border-[#e5e7eb] cursor-pointer font-semibold'
                                                        : 'bg-white border-b border-[#f1f5f9]'
                                                }
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <td
                                                        key={cell.id}
                                                        style={{ width: cell.column.getSize() }}
                                                        className="align-middle px-3 py-2 text-sm"
                                                    >
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {isFetching && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/60 backdrop-blur-[1px]">
                                <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm">
                                    <CircularProgress size={16} className="border-[#2aa160]/30 border-t-[#2aa160]" />
                                    <span className="text-xs font-medium text-[#374151]">Loading sections...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        {/* Right Section - Details Panel */}
            <AddUnderSectionPage 
                formik={formik} 
                sectionOptions={sectionOptions}
                inspectionFormId={inspectionFormId}
                refetch={refetch}
                mode="add"
                onCancel={() => formik.resetForm()}
            />
        </div>

        <Dialog
            open={dialogController.open}
            onClose={() => setDialogController((prev) => ({ ...prev, open: false }))}
            // paperClassName="rounded-[18px] overflow-hidden bg-transparent shadow-none"
        >
            <DialogContent >
                <AddSectionPage
                    inspection_form_id={inspectionFormId}
                    refetch={refetch}
                    mode={dialogController.mode}
                    sectionOptions={sectionOptions}
                    onCancel={() => setDialogController((prev) => ({ ...prev, open: false }))}
                /> 
            </DialogContent>
        </Dialog>

        <Dialog
            open={updateDialogOpen}
            onClose={() => {
                setUpdateDialogOpen(false);
                setEditingRowData(null);
            }}
            // paperClassName="rounded-xl min-w-[480px] max-h-[85vh]"
        >
            <DialogContent className="p-0 overflow-visible">
                <AddUnderSectionPage 
                    formik={editFormik} 
                    sectionOptions={sectionOptions}
                    inspectionFormId={inspectionFormId}
                    refetch={refetch}
                    mode="update"
                    underSectionId={editingRowData?.under_section_id}
                    onEditComplete={() => {
                        setUpdateDialogOpen(false);
                        setEditingRowData(null);
                        editFormik.resetForm();
                    }}
                    onCancel={() => {
                        setUpdateDialogOpen(false);
                        setEditingRowData(null);
                    }}
                />
            </DialogContent>
        </Dialog>

        <Dialog
            open={deleteDialogOpen}
            onClose={() => {
                setDeleteDialogOpen(false);
                setDeletingRowData(null);
            }}
            maxWidth="xs"
            fullWidth
        >
            <DialogContent className="pt-5 pb-3 text-[0.95rem]">
                Are you sure you want to delete this inspection item?
            </DialogContent>
            <DialogActions>
                <Button
                    size="small"
                    className="border border-[#c8d3df] text-[#243447] bg-white"
                    onClick={() => {
                        setDeleteDialogOpen(false);
                        setDeletingRowData(null);
                    }}
                >
                    Cancel
                </Button>
                <Button size="small" className="bg-[#dc2626] text-white" onClick={confirmDeleteUnderSection}>
                    Delete
                </Button>
            </DialogActions>
        </Dialog>

        </>
    );
};

export default SectionInspectionForm;
