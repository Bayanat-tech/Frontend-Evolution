import { Plus, Search, Edit2, Eye, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { executeDynamicDelete, getDynamicLookup } from '../../../api/lookups';
import AddPayUnitsForm from './AddPayUnitsForm';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog } from '../../../components/ui/Dialog';
import { DataTable } from '../../../components/ui/DataTable';
import { useAuth } from '../../../state/AuthContext';

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

export type TPayUnitsHeader = {
  PAY_COMP_ID: string;
  PAY_COMP_DESC: string;
  PAY_COMP_SHORT_DESC?: string;
  COMPANY_CODE: string;
  DIV_CODE?: string;
  DIV_NAME?: string;
};

// Local popup-state shape (replaces the missing TUniversalDialogProps type)
type TPayUnitsPopup = {
  open: boolean;
  title: string;
  wide: boolean;
  data: {
    existingData: Partial<TPayUnitsHeader>;
    isEditMode: boolean;
    isViewMode: boolean;
  };
};

const PayUnitsPage = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? '';
  const loginid = user?.loginid ?? '';
  const queryClient = useQueryClient();
  const [openDivision, setOpenDivision] = useState(false);

  const [globalFilter, setGlobalFilter] = useState('');

  const [payUnitsPopup, setPayUnitsPopup] = useState<TPayUnitsPopup>({
    open: false,
    title: 'Add Pay Unit',
    wide: true,
    data: { existingData: {}, isEditMode: false, isViewMode: false }
  });

  const handleDivisionChange = (divCode: string) => {
    setGlobalFilter(divCode);
  };

  // ===================== FETCH DATA =====================
  const { data: payUnitsData } = useQuery({
    queryKey: ['pay-units-header', companyCode],
    queryFn: async () => {
      // NOTE: verify P_CODE1/P_CODE2 mapping against the PAY_COMPONENT_PAY_UNITS
      // stored procedure — this mirrors the code1=company_code / code2=loginid
      // pattern used elsewhere in this codebase, but confirm it matches this proc.
      const response = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_PAY_UNITS',
        code1: companyCode,
        code2: loginid
      });

      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const tableData = rawRows.map(uppercaseKeys).map((row: any) => ({
        PAY_COMP_ID: row.PAY_COMP_ID,
        PAY_COMP_DESC: row.PAY_COMP_DESC,
        PAY_COMP_SHORT_DESC: row.PAY_COMP_SHORT_DESC,
        COMPANY_CODE: row.COMPANY_CODE,
        DIV_CODE: row.DIV_CODE,
        DIV_NAME: row.DIV_NAME ?? ''
      }));

      return { tableData, count: tableData.length };
    },
    enabled: !!companyCode
  });

  // ===================== FILTER DATA =====================
  const filteredData = useMemo(() => {
    const rows = payUnitsData?.tableData ?? [];
    const trimmed = globalFilter.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      [row.PAY_COMP_ID, row.PAY_COMP_DESC, row.PAY_COMP_SHORT_DESC].some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(trimmed)
      )
    );
  }, [payUnitsData?.tableData, globalFilter]);

  // ==========fetch Division==================
  const { data: divisionData } = useQuery({
    queryKey: ['division', companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: 'Account_division',
        code1: companyCode,
        code2: loginid
      });

      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const tableData = rawRows.map(uppercaseKeys);
      return { tableData, count: tableData.length };
    },
    enabled: !!companyCode
  });

  // ===================== DELETE =====================
  const handleDelete = async (row: TPayUnitsHeader) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    queryClient.setQueryData(['pay-units-header', companyCode], (oldData: any) => {
      if (!oldData) return { tableData: [], count: 0 };
      return {
        ...oldData,
        tableData: oldData.tableData.filter((item: any) => item.PAY_COMP_ID !== row.PAY_COMP_ID),
        count: oldData.count - 1
      };
    });

    await executeDynamicDelete({
      parameter: 'PAY_COMP_UNITS_delete',
      loginid,
      code1: row.COMPANY_CODE,
      code2: row.PAY_COMP_ID
    });
  };

  // ===================== ACTIONS =====================
  const handleActions = (actionType: 'edit' | 'view' | 'delete', row: TPayUnitsHeader) => {
    if (actionType === 'edit') {
      setPayUnitsPopup({
        open: true,
        title: 'Edit Pay Unit',
        wide: true,
        data: { existingData: row, isEditMode: true, isViewMode: false }
      });
    }
    if (actionType === 'view') {
      setPayUnitsPopup({
        open: true,
        title: 'View Pay Unit',
        wide: true,
        data: { existingData: row, isEditMode: true, isViewMode: true }
      });
    }
    if (actionType === 'delete') {
      handleDelete(row);
    }
  };

  const togglePopup = (refetch?: boolean) => {
    setPayUnitsPopup((prev) => ({
      ...prev,
      open: false,
      data: { existingData: {}, isEditMode: false, isViewMode: false }
    }));
    if (refetch) {
      queryClient.invalidateQueries({ queryKey: ['pay-units-header', companyCode] });
    }
  };

  const handleSelectDivision = (divCode: string, divName: string) => {
    setOpenDivision(false);
    setPayUnitsPopup({
      open: true,
      title: 'Add Unit Pay',
      wide: true,
      data: {
        existingData: { DIV_CODE: divCode, DIV_NAME: divName },
        isEditMode: false,
        isViewMode: false
      }
    });
  };

  // ===================== COLUMNS =====================
  const columns = useMemo<ColumnDef<TPayUnitsHeader>[]>(
    () => [
      { accessorKey: 'PAY_COMP_ID', header: 'Pay Component ID', size: 150 },
      { accessorKey: 'PAY_COMP_DESC', header: 'Description', size: 300 },
      { accessorKey: 'PAY_COMP_SHORT_DESC', header: 'Short Description', size: 220 },
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
        <span className="text-foreground">Pay Units</span>
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

        <Button type="button" variant="default" onClick={() => setOpenDivision(true)}>
          <Plus size={15} /> Create Pay Unit
        </Button>
      </div>

      <Dialog open={openDivision} title="Select Division" onClose={() => setOpenDivision(false)}>
        <div className="max-h-[60vh] w-full overflow-y-auto">
          {(divisionData?.tableData ?? []).map((item: any, index: number) => (
            <div
              key={index}
              className="mb-0.5 flex items-center justify-between rounded-lg border border-gray-200 p-2 hover:bg-blue-50 cursor-pointer"
            >
              <h5 className="text-base font-medium text-[#082a89]">{item.DIV_NAME}</h5>
              <Button type="button" onClick={() => handleSelectDivision(item.DIV_CODE, item.DIV_NAME)} variant="outline">
                Select
              </Button>
            </div>
          ))}
        </div>
      </Dialog>

      <DataTable
        columns={columns}
        data={filteredData}
        title={`${filteredData.length.toLocaleString()} Records`}
        height={500}
        density="compact"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => row.PAY_COMP_ID || `temp-${index}`}
      />

      {payUnitsPopup.open && (
        <Dialog open={payUnitsPopup.open} 
         wide={payUnitsPopup.wide}
         title={payUnitsPopup.title} 
         onClose={() => togglePopup(true)}>
          
          <AddPayUnitsForm
            key={payUnitsPopup.data.existingData?.PAY_COMP_ID || 'new'}
            onClose={() => togglePopup(true)}
            isEdit={payUnitsPopup.data.isEditMode}
            isViewMode={payUnitsPopup.data.isViewMode}
            pay_comp_id={payUnitsPopup.data.existingData?.PAY_COMP_ID || undefined}
            div_code={payUnitsPopup.data.existingData?.DIV_CODE || undefined}
            div_name={payUnitsPopup.data.existingData?.DIV_NAME || undefined}
            onDivisionChange={handleDivisionChange}
          />
        </Dialog>
      )}
    </div>
  );
};

export default PayUnitsPage;