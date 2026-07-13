import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { FaPlus, FaSearch } from 'react-icons/fa';
import { Button, Dialog, DialogActions, DialogContent } from '../../../../components/mms_ui';
import AddUpdInspectionFormPage from './AddUpdInspectionFormPage';
import SectionInspectionForm from './section/SectionInspectionForm';
import { delInspectionForm } from './api/section_api_call';
import { getDynamicLookup } from '../../../../api/lookups';
import { useAuth } from '../../../../state/AuthContext';
import { DataTable } from '../../../../components/ui/DataTable';
import { MdModeEdit } from "react-icons/md";
import { MdDelete } from "react-icons/md";



type InspectionFormRow = {
    inspection_form_code: number;
    inspection_form_name: string;
    description?: string;
    [key: string]: any;
};

const InspectionFormPage = () => {
    const { user } = useAuth();
    const [selectedRowData, setSelectedRowData] = useState<any>(null);
    const [searchText, setSearchText] = useState('');

    const [dialogStatus, setDialogStatus] = useState({
        open: false,
        type: '' // 'add' | 'edit'
    });
    const [sectionDialogStatus, setSectionDialogStatus] = useState({
        open: false,
    });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingRowData, setDeletingRowData] = useState<any>(null);

    // Fetch Data
    const { data: gridData, refetch, isFetching, isError } = useQuery({
        queryKey: ['inspection-form', user?.loginid],
        queryFn: async () => {
            const response = await getDynamicLookup({
                parameter: 'OX_INSPECTION_FORM_MAIN_PAGE',
                loginid: user?.loginid ?? '',
            });

            if (Array.isArray(response)) return response;
            if (response && typeof response === 'object' && Array.isArray((response as any).data)) {
                return (response as any).data;
            }

            return [];
        }
    });

    // Column Definitions
    const columnDefs: ColumnDef<InspectionFormRow>[] = [
        {
            id: 'inspection_form_name',
            header: '',
            size: 600,
            enableSorting: false,
            cell: ({ row }) => {
                const data = row.original;

                return (
                    <div
                        className="flex items-center w-full h-full py-1 px-3 border-b border-[#e5e7eb] transition-colors group-hover:bg-[#f8fafc] cursor-pointer"

                    >

                    <div className=" border-1 rounded-md py-0.5 px-2 flex items-center gap-2 w-[85%] h-full"
                        onClick={() => {
                            setSelectedRowData(data);
                            setSectionDialogStatus({ open: true });
                        }}
                    >    
                        <div className="text-sm mr-1.5 text-[#6b7280]">📄</div>
                        <div className="flex-1 flex flex-col gap-0">
                            <div className="text-[13px] text-[#111827] leading-tight">{data.inspection_form_name}</div>
                            <div className="text-[11px] text-[#6b7280] leading-tight">{data.description ?? '-'}</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2.5 w-[15%] h-full">
                        <span
                            className="cursor-pointer text-[#2563eb] text-[16px]"
                            onClick={() => {
                                setSelectedRowData(row.original);
                                setDialogStatus({ open: true, type: 'edit' });
                            }}
                        >
                            <MdModeEdit size={16} />
                        </span>
                        <span
                            className="cursor-pointer text-[#dc2626] text-[16px] px-3"
                            onClick={() => {
                                setDeletingRowData(row.original);
                                setDeleteDialogOpen(true);
                            }}
                        >
                            <MdDelete size={16} />
                        </span>
                    </div>

                    </div>
                );
            }
        },
    ];

    // Single Delete Function
    const handleSingleDelete = async (rowData: any) => {
        try {
            if (!rowData?.inspection_form_code) return;

            const response = await delInspectionForm(rowData.inspection_form_code, user?.loginid ?? '');
            if (response?.success) {
                refetch();
            } else {
                console.error(response?.message ?? 'Delete failed');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleConfirmDelete = async () => {
        await handleSingleDelete(deletingRowData);
        setDeleteDialogOpen(false);
        setDeletingRowData(null);
    };

    return (
        <div>
            <div className="px-4 py-1 w-full">
                {/* Buttons */}
                <div className="flex items-center justify-between mb-2.5">
                    <Button
                        onClick={() => {
                            setSelectedRowData(null);
                            setDialogStatus({ open: true, type: 'add' });
                        }}
                        startIcon={<FaPlus size={12} />}
                        size="small"
                        className="rounded-full normal-case bg-[#0a6ed1] text-white"
                    >
                        Create New Form
                    </Button>

                    <div className="flex items-center px-3 py-1 h-8 rounded-md border border-blue-500 overflow-hidden w-72">
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Search Something..."
                            className="w-full outline-none bg-transparent text-gray-600 text-sm h-6"
                        />
                        <FaSearch size={14} className="fill-gray-600 text-gray-600" />
                    </div>
                </div>
                <hr className="mb-2.5 border-t border-[#e5e7eb]" />

                <div className="mb-2 text-xs text-[#6b7280]">
                    {isFetching ? 'Loading inspection forms...' : `Records: ${(gridData || []).length}`}
                    {isError ? ' (Fetch failed)' : ''}
                </div>

                <div className="p-10 w-full">
                    <div className="text-lg font-bold">Inspection Forms</div>
                    <hr className="mb-2.5 border-t border-[#e5e7eb]" />
                    <DataTable
                        columns={columnDefs}
                        data={(gridData || []) as InspectionFormRow[]}
                        loading={isFetching}
                        searchValue={searchText}
                        emptyText="No inspection forms found"
                        enableColumnFilters={false}
                        rowClassName={() => 'group'}
                        density="grid"
                    />
                </div>
            </div>

            <Dialog
                open={dialogStatus.open}
                onClose={() => setDialogStatus({ open: false, type: '' })}
                paperClassName=" rounded-[18px] overflow-hidden"
            >
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#0a6ed1] text-[1.05rem] font-bold text-[#223246]">
                    <span className="text-[#0a6ed1] text-[1.2rem]">✔</span>
                    {dialogStatus.type === 'add' ? 'Add Inspection Form' : 'Edit Inspection Form'}
                </div>
                <DialogContent className="p-0">
                    <AddUpdInspectionFormPage
                        rowData={selectedRowData}
                        mode={dialogStatus.type}
                        refetch={refetch}
                        onCancel={() => setDialogStatus({ open: false, type: '' })}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={sectionDialogStatus.open}
                onClose={() => setSectionDialogStatus({ open: false })}
                fullWidth
                maxWidth="lg"
                paperClassName="w-[80vw] max-w-[90vw] h-[85vh] max-h-[90vh] p-3"
            >
                <DialogContent>
                    <SectionInspectionForm rowData={selectedRowData} />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setSectionDialogStatus({ open: false })}
                        size="small"
                        className="text-[#223246] font-bold normal-case text-base bg-transparent hover:bg-black/5 text-[16px]"
                    >
                        Close
                    </Button>
                </DialogActions>
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
                    Are you sure you want to delete this inspection form?
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
                    <Button size="small" className="bg-[#dc2626] text-white" onClick={handleConfirmDelete}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default InspectionFormPage;