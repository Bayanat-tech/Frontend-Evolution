import { Plus, Search, Edit2, Eye, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { executeDynamicDelete, getDynamicLookup } from '../../../api/lookups';
// import AddAttendanceTypeForm from './AddAttendanceTypeForm';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Dialog } from '../../../components/ui/Dialog';
import { DataTable } from '../../../components/ui/DataTable';
import { useAuth } from '../../../state/AuthContext';
import AddAttendanceTypeForm from './AddAttendanceTypeForm';

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

export type TAttendanceTypeRow = {
  COMPANY_CODE: string;
  ATTEND_TYPE: string;
  ATTEND_DESC: string;
  ATTEND_SHORT_DESC?: string;
  STATUS?: string;
  ATTENDANCE_CATEGORY?: string;
  ATTEND_PERIODICITY?: string;
  REMARKS?: string;
};

type TAttendanceTypePopup = {
  open: boolean;
  title: string;
  wide: boolean;
  data: {
    existingData: Partial<TAttendanceTypeRow>;
    isEditMode: boolean;
    isViewMode: boolean;
  };
};

const AttendanceTypesPage = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? '';
  const loginid = user?.loginid ?? '';
  const queryClient = useQueryClient();

  const [globalFilter, setGlobalFilter] = useState('');

  const [attendancePopup, setAttendancePopup] = useState<TAttendanceTypePopup>({
    open: false,
    title: 'Add Attendance Type',
    wide: true,
    data: { existingData: {}, isEditMode: false, isViewMode: false }
  });

  // ===================== FETCH DATA =====================
  const { data: attendanceData } = useQuery({
    queryKey: ['attendance-types', companyCode],
    queryFn: async () => {
      // NOTE: confirm this stored-procedure WHEN block returns ALL rows for
      // the company (list mode), not a single ATTEND_TYPE record.
      const response = await getDynamicLookup({
        parameter: 'PAY_COMPONENT_ATTENDANCE_TYPE',
        code1: companyCode,
        code2: loginid
      });

      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const tableData = rawRows.map(uppercaseKeys).map((row: any) => ({
        COMPANY_CODE: row.COMPANY_CODE,
        ATTEND_TYPE: row.ATTEND_TYPE,
        ATTEND_DESC: row.ATTEND_DESC,
        ATTEND_SHORT_DESC: row.ATTEND_SHORT_DESC,
        STATUS: row.STATUS,
        ATTENDANCE_CATEGORY: row.ATTENDANCE_CATEGORY,
        ATTEND_PERIODICITY: row.ATTEND_PERIODICITY,
        REMARKS: row.REMARKS
      }));

      return { tableData, count: tableData.length };
    },
    enabled: !!companyCode
  });

  // ===================== FILTER DATA =====================
  const filteredData = useMemo(() => {
    const rows = attendanceData?.tableData ?? [];
    const trimmed = globalFilter.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      [row.ATTEND_TYPE, row.ATTEND_DESC, row.ATTEND_SHORT_DESC].some((val) =>
        String(val ?? '')
          .toLowerCase()
          .includes(trimmed)
      )
    );
  }, [attendanceData?.tableData, globalFilter]);

  // ===================== DELETE =====================
  const handleDelete = async (row: TAttendanceTypeRow) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    queryClient.setQueryData(['attendance-types', companyCode], (oldData: any) => {
      if (!oldData) return { tableData: [], count: 0 };
      return {
        ...oldData,
        tableData: oldData.tableData.filter((item: any) => item.ATTEND_TYPE !== row.ATTEND_TYPE),
        count: oldData.count - 1
      };
    });

    // NOTE: confirm exact delete proc parameter name on backend
    await executeDynamicDelete({
      parameter: 'PAY_COMP_ATTENDANCE_TYPE_delete',
      loginid,
      code1: row.COMPANY_CODE,
      code2: row.ATTEND_TYPE
    });
  };

  // ===================== ACTIONS =====================
  const handleActions = (actionType: 'edit' | 'view' | 'delete', row: TAttendanceTypeRow) => {
    if (actionType === 'edit') {
      setAttendancePopup({
        open: true,
        title: 'Edit Attendance Type',
        wide: true,
        data: { existingData: row, isEditMode: true, isViewMode: false }
      });
    }
    if (actionType === 'view') {
      setAttendancePopup({
        open: true,
        title: 'View Attendance Type',
        wide: true,
        data: { existingData: row, isEditMode: true, isViewMode: true }
      });
    }
    if (actionType === 'delete') {
      handleDelete(row);
    }
  };

  const handleAddClick = () => {
    setAttendancePopup({
      open: true,
      title: 'Add Attendance Type',
      wide: true,
      data: { existingData: {}, isEditMode: false, isViewMode: false }
    });
  };

  const togglePopup = (refetch?: boolean) => {
    setAttendancePopup((prev) => ({
      ...prev,
      open: false,
      data: { existingData: {}, isEditMode: false, isViewMode: false }
    }));
    if (refetch) {
      queryClient.invalidateQueries({ queryKey: ['attendance-types', companyCode] });
    }
  };

  // ===================== COLUMNS =====================
  const columns = useMemo<ColumnDef<TAttendanceTypeRow>[]>(
    () => [
      { accessorKey: 'ATTEND_TYPE', header: 'Attend Type', size: 130 },
      { accessorKey: 'ATTEND_DESC', header: 'Description', size: 260 },
      { accessorKey: 'ATTEND_SHORT_DESC', header: 'Short Description', size: 180 },
      { accessorKey: 'ATTENDANCE_CATEGORY', header: 'Category', size: 150 },
      { accessorKey: 'ATTEND_PERIODICITY', header: 'Periodicity', size: 150 },
      { accessorKey: 'STATUS', header: 'Status', size: 100 },
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
        <span className="text-foreground">Attendance Types</span>
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

        <Button type="button" variant="default" onClick={handleAddClick}>
          <Plus size={15} /> Add Attendance Type
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
        getRowId={(row, index) => row.ATTEND_TYPE || `temp-${index}`}
      />

     {attendancePopup.open && (
  <AddAttendanceTypeForm
    key={attendancePopup.data.existingData?.ATTEND_TYPE || 'new'}
    onClose={() => togglePopup(true)}
    isEdit={attendancePopup.data.isEditMode}
    isViewMode={attendancePopup.data.isViewMode}
    company_code={companyCode}
    attend_type={attendancePopup.data.existingData?.ATTEND_TYPE || undefined}
  />
)}




    </div>
  );
};

export default AttendanceTypesPage;