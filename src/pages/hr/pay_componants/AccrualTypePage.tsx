import { Plus, Search, Edit2, Eye, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { executeDynamicDelete, getDynamicLookup } from '../../../api/lookups';
// import AddAccrualTypeForm from './AddAccrualTypeForm';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog } from '../../../components/ui/Dialog';
import { DataTable } from '../../../components/ui/DataTable';
import { useAuth } from '../../../state/AuthContext';
import AddAccrualTypeForm from './AddAccrualTypeForm';

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

export type TAccrualTypeHeader = {
  COMPANY_CODE: string;
  ACCRUAL_TYPE: string;
  ACCRUAL_DESC: string;
  ACCRUAL_SHORT_DESC?: string;
};

// Local popup-state shape (replaces the missing TUniversalDialogProps type)
type TAccrualTypePopup = {
  open: boolean;
  title: string;
  wide: boolean;
  data: {
    existingData: Partial<TAccrualTypeHeader>;
    isEditMode: boolean;
    isViewMode: boolean;
  };
};

const AccrualTypePage = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? '';
  const loginid = user?.loginid ?? '';
  const queryClient = useQueryClient();

  const [globalFilter, setGlobalFilter] = useState('');

  const [accrualTypePopup, setAccrualTypePopup] = useState<TAccrualTypePopup>({
    open: false,
    title: 'Add Accrual Type',
    wide: true,
    data: { existingData: {}, isEditMode: false, isViewMode: false }
  });

  // ===================== FETCH DATA =====================
  const { data: accrualTypeData } = useQuery({
    queryKey: ['accrual-type-header', companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_ACCRUAL_TYPE',
        code1: companyCode,
        code2: ''
      });

      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const tableData = rawRows.map(uppercaseKeys).map((row: any) => ({
        COMPANY_CODE: row.COMPANY_CODE,
        ACCRUAL_TYPE: row.ACCRUAL_TYPE,
        ACCRUAL_DESC: row.ACCRUAL_DESC,
        ACCRUAL_SHORT_DESC: row.ACCRUAL_SHORT_DESC ?? ''
      }));

      return { tableData, count: tableData.length };
    },
    enabled: !!companyCode
  });

  // ===================== FILTER DATA =====================
  const filteredData = useMemo(() => {
    const rows = accrualTypeData?.tableData ?? [];
    const trimmed = globalFilter.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      [row.ACCRUAL_TYPE, row.ACCRUAL_DESC, row.ACCRUAL_SHORT_DESC].some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(trimmed)
      )
    );
  }, [accrualTypeData?.tableData, globalFilter]);

  // ===================== DELETE =====================
  const handleDelete = async (row: TAccrualTypeHeader) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    queryClient.setQueryData(['accrual-type-header', companyCode], (oldData: any) => {
      if (!oldData) return { tableData: [], count: 0 };
      return {
        ...oldData,
        tableData: oldData.tableData.filter((item: any) => item.ACCRUAL_TYPE !== row.ACCRUAL_TYPE),
        count: oldData.count - 1
      };
    });

    await executeDynamicDelete({
      parameter: 'ACCRUAL_TYPE_delete',
      loginid,
      code1: row.COMPANY_CODE,
      code2: row.ACCRUAL_TYPE
    });
  };

  // ===================== ACTIONS =====================
  const handleActions = (actionType: 'edit' | 'view' | 'delete', row: TAccrualTypeHeader) => {
    if (actionType === 'edit') {
      setAccrualTypePopup({
        open: true,
        title: 'Edit Accrual Type',
        wide: true,
        data: { existingData: row, isEditMode: true, isViewMode: false }
      });
    }
    if (actionType === 'view') {
      setAccrualTypePopup({
        open: true,
        title: 'View Accrual Type',
        wide: true,
        data: { existingData: row, isEditMode: true, isViewMode: true }
      });
    }
    if (actionType === 'delete') {
      handleDelete(row);
    }
  };

  const togglePopup = (refetch?: boolean) => {
    setAccrualTypePopup((prev) => ({
      ...prev,
      open: false,
      data: { existingData: {}, isEditMode: false, isViewMode: false }
    }));
    if (refetch) {
      queryClient.invalidateQueries({ queryKey: ['accrual-type-header', companyCode] });
    }
  };

  const handleAddNew = () => {
    setAccrualTypePopup({
      open: true,
      title: 'Add Accrual Type',
      wide: true,
      data: { existingData: {}, isEditMode: false, isViewMode: false }
    });
  };

  // ===================== COLUMNS =====================
  const columns = useMemo<ColumnDef<TAccrualTypeHeader>[]>(
    () => [
      { accessorKey: 'COMPANY_CODE', header: 'Company Code', size: 130 },
      { accessorKey: 'ACCRUAL_TYPE', header: 'Accrual Type', size: 150 },
      { accessorKey: 'ACCRUAL_DESC', header: 'Description', size: 300 },
      { accessorKey: 'ACCRUAL_SHORT_DESC', header: 'Short Description', size: 220 },
      {
        id: 'actions',
        header: 'Actions',
        size: 120,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" type="button" title="View" onClick={() => handleActions('view', row.original)}>
              <Eye size={14} />
            </Button>
            <Button size="icon" variant="ghost" type="button" title="Edit" onClick={() => handleActions('edit', row.original)}>
              <Edit2 size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              title="Delete"
              className="text-destructive hover:text-destructive"
              onClick={() => handleActions('delete', row.original)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )
      }
    ],
    []
  );

  // ===================== RENDER =====================
  return (
    <div className="flex flex-col space-y-2">
      <nav className="mb-2 mt-1 flex items-center gap-1 text-sm text-muted-foreground">
        <a href="/dashboard" className="hover:underline hover:text-foreground">
          Home
        </a>
        <span>/</span>
        <span className="text-foreground">Accrual Type</span>
      </nav>

      <div className="flex justify-end space-x-2">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search..."
            className="pl-9"
          />
        </div>

        <Button type="button" variant="default" onClick={handleAddNew}>
          <Plus size={15} /> Create Accrual Type
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        title={`${filteredData.length.toLocaleString()} Records`}
        height={500}
        density="compact"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => row.ACCRUAL_TYPE || `temp-${index}`}
      />

      {accrualTypePopup.open && (
        <Dialog
          open={accrualTypePopup.open}
          wide={accrualTypePopup.wide}
          title={accrualTypePopup.title}
          onClose={() => togglePopup(true)}
        >
          <AddAccrualTypeForm
            key={accrualTypePopup.data.existingData?.ACCRUAL_TYPE || 'new'}
            onClose={() => togglePopup(true)}
            isEdit={accrualTypePopup.data.isEditMode}
            isViewMode={accrualTypePopup.data.isViewMode}
            company_code={accrualTypePopup.data.existingData?.COMPANY_CODE || undefined}
            accrual_type={accrualTypePopup.data.existingData?.ACCRUAL_TYPE || undefined}
          />
        </Dialog>
      )}
    </div>
  );
};

export default AccrualTypePage;