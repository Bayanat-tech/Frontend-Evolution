import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useFormik } from 'formik';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { useToast } from '../../../components/ui/AlertToast';
import { DocumentPageShell } from '../../../components/ui/DocumentPageShell';
import AddAbsentMemoPage from './AddAbsentMemoPage';
import type { AbsentMemoDetailRow } from './types';
import { getDynamicLookup } from '../../../api/lookups';
import { useAuth } from '../../../state/AuthContext';
import hrSalaryAdvDedServiceInstance from '../../../api/hr/upsertHrSalaryAdvDed';

const gridDataParameter = 'HR_ABSENT_MEMO_MAIN_PAGE';

const columnDef: ColumnDef<any>[] = [
  { accessorKey: 'doc_no', header: 'Doc No' },
  { accessorKey: 'doc_type', header: 'Doc Type' },
  { accessorKey: 'doc_date', header: 'Doc Date' },
  { accessorKey: 'ref_no', header: 'Ref No' },
  { accessorKey: 'employee_code', header: 'Employee Code' },
  { accessorKey: 'name_from', header: 'Name From' },
  { accessorKey: 'amount', header: 'Amount' },
];

const normalizeValue = (value: any) => (value === null || value === undefined ? '' : String(value));
const normalizeDateValue = (value: any) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const mapDetailRows = (rows: any[]): AbsentMemoDetailRow[] =>
  rows.map((row, index) => ({
    srNo: row?.sr_no ?? row?.SR_NO ?? row?.serial_no ?? row?.SERIAL_NO ?? index + 1,
    payUnit: String(row?.pay_comp_id ?? row?.PAY_COMP_ID ?? ''),
    description: String(row?.sal_type_flag ?? row?.SAL_TYPE_FLAG ?? row?.deduct_from_leave ?? row?.DEDUCT_FROM_LEAVE ?? ''),
    effectiveFrom: normalizeDateValue(row?.recover_from_dt ?? row?.RECOVER_FROM_DT ?? row?.leave_start_date ?? row?.LEAVE_START_DATE),
    absentFromDate: normalizeDateValue(row?.leave_start_date ?? row?.LEAVE_START_DATE),
    absentToDate: normalizeDateValue(row?.leave_end_date ?? row?.LEAVE_END_DATE),
    noOfDays: row?.deduct_noof_leavedays ?? row?.DEDUCT_NOOF_LEAVEDAYS ?? row?.leave_days_paid ?? row?.LEAVE_DAYS_PAID ?? '',
    amount: row?.amount ?? row?.AMOUNT ?? row?.recover_mth_amt ?? row?.RECOVER_MTH_AMT ?? '',
    refLeaveDocNo: String(row?.ref_leave_doc_no ?? row?.REF_LEAVE_DOC_NO ?? ''),
    cancel: String(row?.cancel_status ?? row?.CANCEL_STATUS ?? 'No'),
  }));

const getInitialFormValues = (rowData: any) => ({
  docNo: normalizeValue(rowData?.docNo ?? rowData?.doc_no),
  docType: normalizeValue(rowData?.docType ?? rowData?.doc_type ?? 'Absent'),
  docDate: normalizeDateValue(rowData?.docDate ?? rowData?.doc_date),
  refNo: normalizeValue(rowData?.refNo ?? rowData?.ref_no),
  employeeCode: normalizeValue(rowData?.employeeCode ?? rowData?.employee_code),
  nameFrom: normalizeValue(rowData?.nameFrom ?? rowData?.name_from),
  addrFrom: normalizeValue(rowData?.addrFrom ?? rowData?.addr_from),
  lettrSubject: normalizeValue(rowData?.lettrSubject ?? rowData?.lettr_subject ?? 'Salary Deduction'),
  remarks1: normalizeValue(rowData?.remarks1 ?? rowData?.remarks_1),
  remarks2: normalizeValue(rowData?.remarks2 ?? rowData?.remarks_2),
  signatoryName: normalizeValue(rowData?.signatoryName ?? rowData?.signatory_name),
  signatoryPosition: normalizeValue(rowData?.signatoryPosition ?? rowData?.signatory_position),
});

const AbsentMemoMainPage = () => {
  const title = 'Absent Memo';
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedRowData, setSelectedRowData] = useState<any>(null);
  const [detailRows, setDetailRows] = useState<AbsentMemoDetailRow[]>([]);
  const [dialogStatus, setDialogStatus] = useState<{ open: boolean; type: '' | 'add' | 'edit' }>({
    open: false,
    type: '',
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: getInitialFormValues(selectedRowData),
    onSubmit: async (values) => {
      try {
        const header = {
          company_code: user?.company_code ?? '',
          doc_type: values.docType || 'Absent',
          doc_no: values.docNo ? Number(values.docNo) : undefined,
          doc_date: values.docDate ? new Date(values.docDate).toISOString() : undefined,
          ref_no: values.refNo || '',
          name_from: values.nameFrom || '',
          addr_from: values.addrFrom || '',
          lettr_subject: values.lettrSubject || '',
          remarks_1: values.remarks1 || '',
          remarks_2: values.remarks2 || '',
          signatory_name: values.signatoryName || '',
          signatory_position: values.signatoryPosition || '',
          employee_code: values.employeeCode || '',
          employee_id: values.employeeCode || '',
        };

        const details = detailRows.map((row) => ({
          company_code: user?.company_code ?? '',
          doc_type: values.docType || 'Absent',
          doc_no: values.docNo ? Number(values.docNo) : undefined,
          employee_id: values.employeeCode || '',
          emplyee_code: values.employeeCode || '',
          pay_comp_id: row.payUnit || '',
          amount: Number(row.amount || 0),
          recover_mth_amt: Number(row.amount || 0),
          recover_from_dt: row.effectiveFrom ? new Date(row.effectiveFrom).toISOString() : undefined,
          deduct_from_leave: row.cancel === 'Yes' ? 'Y' : 'N',
          deduct_noof_leavedays: Number(row.noOfDays || 0),
          ref_leave_doc_no: row.refLeaveDocNo || '',
        }));

        const success = await hrSalaryAdvDedServiceInstance.upsertHrSalaryAdvDed({
          header,
          details,
          loginid: user?.loginid || '',
        });

        if (success) {
          toast.success(dialogStatus.type === 'edit' ? 'Updated Successfully' : 'Saved Successfully');
          closeDialog();
          refetchGridData();
          return;
        }

        toast.error(dialogStatus.type === 'edit' ? 'Update Failed' : 'Save Failed');
      } catch (error) {
        console.error('Absent Memo save error:', error);
        toast.error('Error while saving data');
      }
    },
  });

  useEffect(() => {
    const fetchDetailRows = async () => {
      if (!dialogStatus.open || dialogStatus.type !== 'edit' || !selectedRowData?.doc_no) return;
      try {
        const response = await getDynamicLookup({
          parameter: 'HR_ABSENT_MEMO_TAB_2_DATA',
          loginid: user?.loginid ?? '',
          code1: user?.company_code ?? '',
          number1: selectedRowData.doc_no,
        });
        const rawRows = Array.isArray(response) ? response : [];
        setDetailRows(mapDetailRows(rawRows));
      } catch (error) {
        console.error('Failed to load absent memo detail rows:', error);
        setDetailRows([]);
      }
    };

    void fetchDetailRows();
  }, [dialogStatus.open, dialogStatus.type, selectedRowData, user?.company_code, user?.loginid]);

  const closeDialog = () => {
    setDialogStatus({ open: false, type: '' });
    setSelectedRowData(null);
    setDetailRows([]);
    formik.resetForm();
  };

  const openAdd = () => {
    setSelectedRowData(null);
    setDetailRows([]);
    setDialogStatus({ open: true, type: 'add' });
  };

  const openEdit = (row: any) => {
    setSelectedRowData(row);
    setDetailRows([]);
    setDialogStatus({ open: true, type: 'edit' });
  };

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      ...columnDef,
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title="Edit">
              <Edit2 size={14} />
            </Button>
          </div>
        ),
        size: 80,
      },
    ],
    [],
  );

  const { data: gridData, isLoading, refetch: refetchGridData } = useQuery({
    queryKey: ['data', gridDataParameter, user?.company_code],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: gridDataParameter,
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
      });
      return Array.isArray(response) ? response : [];
    },
    enabled: !!user?.company_code,
  });

  const totalAmount = detailRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <Button title={`Add ${title}`} onClick={openAdd}>
          <Plus size={15} /> Add
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={gridData || []}
        loading={isLoading}
        emptyText={`No ${title.toLowerCase()} records found`}
        height={590}
        density="grid"
        getRowId={(row: any) => String(row.doc_no)}
      />

      {dialogStatus.open && (
        <DocumentPageShell
          eyebrow={dialogStatus.type === 'edit' ? 'Edit Document' : 'Add Document'}
          title={title}
          badges={[
            { label: 'Doc No', value: formik.values.docNo || 'New' },
            { label: 'Doc Date', value: formik.values.docDate || '—' },
            { label: 'Employee', value: formik.values.employeeCode || '—' },
          ]}
          onClose={closeDialog}
          onCancel={closeDialog}
          footer={
            <>
              <div className="text-sm text-slate-600">
                Total Amount{' '}
                <span className="text-base font-semibold text-[#0e4f8f]">
                  {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={closeDialog}>
                  Close
                </Button>
                <Button onClick={() => formik.submitForm()} className="bg-[#0e4f8f] hover:bg-[#0c4278]">
                  <Save size={14} /> {dialogStatus.type === 'edit' ? 'Update' : 'Save'}
                </Button>
              </div>
            </>
          }
        >
          <AddAbsentMemoPage
            mode={dialogStatus.type}
            formik={formik}
            detailRows={detailRows}
            setDetailRows={setDetailRows}
          />
        </DocumentPageShell>
      )}
    </section>
  );
};

export default AbsentMemoMainPage;