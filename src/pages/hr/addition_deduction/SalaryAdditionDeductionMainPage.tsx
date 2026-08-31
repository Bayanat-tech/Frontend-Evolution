import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useFormik } from 'formik';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { useToast } from '../../../components/ui/AlertToast';
import { DocumentPageShell } from '../../../components/ui/DocumentPageShell';
import AddSalaryAdditionDeductionPage from './AddUpdate/AddSalaryAdditionDeductionPage';
import type { SalaryAdditionDeductionDetailRow } from './AddUpdate/types';
import hrSalaryAdvDedServiceInstance from '../../../api/hr/upsertHrSalaryAdvDed';
import { getDynamicLookup } from '../../../api/lookups';
import { useAuth } from '../../../state/AuthContext';

const gridDataParameter = 'HR_ADDITION_DEDUCTION_MAIN_PAGE';

const columnDef: ColumnDef<any>[] = [
  { accessorKey: 'doc_no', header: 'Doc No' },
  { accessorKey: 'doc_type', header: 'Doc Type' },
  { accessorKey: 'doc_date', header: 'Doc Date' },
  { accessorKey: 'ref_no', header: 'Ref No' },
  { accessorKey: 'name_from', header: 'Name From' },
  { accessorKey: 'addr_from', header: 'Addr From' },
  { accessorKey: 'name_to', header: 'Name To' },
  { accessorKey: 'addr_to', header: 'Addr To' },
  { accessorKey: 'amount', header: 'Amount' },
];

const normalizeValue = (value: any) =>
  value === null || value === undefined ? '' : String(value);

const normalizeDateValue = (value: any) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const getInitialFormValues = (rowData: any) => ({
  docNo: normalizeValue(rowData?.docNo ?? rowData?.doc_no),
  docType: normalizeValue(rowData?.docType ?? rowData?.doc_type ?? 'ADV'),
  docDate:
    normalizeDateValue(rowData?.doc_date),
  refNo: normalizeValue(rowData?.refNo ?? rowData?.ref_no),
  nameFrom: normalizeValue(rowData?.nameFrom ?? rowData?.name_from),
  nameTo: normalizeValue(rowData?.nameTo ?? rowData?.name_to),
  addrFrom: normalizeValue(rowData?.addrFrom ?? rowData?.addr_from),
  addrTo: normalizeValue(rowData?.addrTo ?? rowData?.addr_to),
  lettrSubject: normalizeValue(rowData?.lettrSubject ?? rowData?.lettr_subject),
  remarks1: normalizeValue(rowData?.remarks1 ?? rowData?.remarks_1),
  remarks2: normalizeValue(rowData?.remarks2 ?? rowData?.remarks_2),
  signatoryName: normalizeValue(rowData?.signatoryName ?? rowData?.signatory_name),
  signatoryPosition: normalizeValue(
    rowData?.signatoryPosition ?? rowData?.signatory_position,
  ),
});

const mapDetailApiRow = (
  row: any,
  index: number,
): SalaryAdditionDeductionDetailRow => {
  const deductFromLeave = String(
    row?.DEDUCT_FROM_LEAVE ?? row?.deduct_from_leave ?? 'N',
  ).toUpperCase();
  return {
    srNo: row?.SERIAL_NO ?? row?.serial_no ?? row?.SR_NO ?? row?.sr_no ?? index + 1,
    employeeId: normalizeValue(row?.EMPLOYEE_ID ?? row?.employee_id),
    employee: normalizeValue(row?.EMP_NAME ?? row?.emp_name),
    payUnit: normalizeValue(row?.PAY_COMP_ID ?? row?.pay_comp_id),
    description: normalizeValue(row?.DESCRIPTION ?? row?.description),
    amount: normalizeValue(row?.AMOUNT ?? row?.amount),
    effectiveFrom: normalizeDateValue(row?.RECOVER_FROM_DT ?? row?.recover_from_dt),
    cancel: deductFromLeave === 'Y' || deductFromLeave === 'YES' ? 'Yes' : 'No',
  };
};

const SalaryAdditionDeductionMainPage = () => {
  const title = 'Salary Addition/Deduction';
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRowData, setSelectedRowData] = useState<any>(null);
  const [detailRows, setDetailRows] = useState<SalaryAdditionDeductionDetailRow[]>(
    [],
  );
  const [dialogStatus, setDialogStatus] = useState<{
    open: boolean;
    type: '' | 'add' | 'edit';
  }>({ open: false, type: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchDetailRowsByDocNo = async (docNo: number | string | undefined) => {
    const parsedDocNo = Number(docNo);
    if (!parsedDocNo || Number.isNaN(parsedDocNo)) return [];
    const response = await getDynamicLookup({
      parameter: 'HR_ADDITION_DEDUCTION_DETAIL',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
      number1: parsedDocNo,
    });
    const rows = Array.isArray(response) ? response : [];
    return rows.map(mapDetailApiRow);
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: getInitialFormValues(selectedRowData),
    onSubmit: async (values) => {
      if (detailRows.length === 0) {
        toast.error('Please add at least one detail line');
        return;
      }
      setIsSaving(true);
      try {
        const totalAmount = detailRows.reduce(
          (sum, row) => sum + Number(row.amount || 0),
          0,
        );

        const header = {
          company_code: user?.company_code ?? '',
          doc_type: values.docType || 'ADV',
          doc_no: values.docNo ? Number(values.docNo) : 0,
          doc_date: values.docDate
            ? new Date(values.docDate).toISOString()
            : new Date().toISOString(),
          ref_no: values.refNo || '',
          name_from: values.nameFrom || '',
          addr_from: values.addrFrom || '',
          name_to: values.nameTo || '',
          addr_to: values.addrTo || '',
          lettr_subject: values.lettrSubject || '',
          remarks_1: values.remarks1 || '',
          remarks_2: values.remarks2 || '',
          signatory_name: values.signatoryName || '',
          signatory_position: values.signatoryPosition || '',
          amount: totalAmount,
          user_id: user?.loginid || '',
        };

        const details = detailRows.map((row, index) => ({
          company_code: user?.company_code ?? '',
          doc_type: values.docType || 'ADV',
          doc_no: values.docNo ? Number(values.docNo) : 0,
          sr_no: Number(row.srNo) || index + 1,
          employee_id: row.employeeId || '',
          emplyee_code: row.employeeId || '',
          pay_comp_id: row.payUnit || '',
          amount: Number(row.amount || 0),
          recover_mth_amt: Number(row.amount || 0),
          recover_from_dt: row.effectiveFrom
            ? new Date(row.effectiveFrom).toISOString()
            : undefined,
          deduct_from_leave: row.cancel === 'Yes' ? 'Y' : 'N',
        }));

        const success = await hrSalaryAdvDedServiceInstance.upsertHrSalaryAdvDed({
          header,
          details,
          loginid: user?.loginid || '',
        });

        if (success) {
          toast.success(
            dialogStatus.type === 'edit' ? 'Updated Successfully' : 'Saved Successfully',
          );
          closeDialog();
          refetchGridData();
          return;
        }
        toast.error(dialogStatus.type === 'edit' ? 'Update Failed' : 'Save Failed');
      } catch (error) {
        console.error('Salary Addition/Deduction save error:', error);
        toast.error('Error while saving data');
      } finally {
        setIsSaving(false);
      }
    },
  });

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

  const openEdit = async (row: any) => {
    setSelectedRowData(row);
    setDetailRows([]);
    setDialogStatus({ open: true, type: 'edit' });
    try {
      const apiDetails = await fetchDetailRowsByDocNo(row?.doc_no ?? row?.docNo);
      setDetailRows(apiDetails);
    } catch (error) {
      console.error('Failed to fetch detail rows for edit mode:', error);
      setDetailRows([]);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      ...columnDef,
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => openEdit(row.original)}
              title="Edit"
            >
              <Edit2 size={14} />
            </Button>
          </div>
        ),
        size: 80,
      },
    ],
    [],
  );

  const {
    data: gridData,
    isLoading,
    refetch: refetchGridData,
  } = useQuery({
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

  const totalAmount = detailRows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );

  return (
    <section className="relative flex h-full min-h-0 flex-col gap-2 overflow-hidden p-0">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <h1 className="m-0 text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <Button title={`Add ${title}`} onClick={openAdd} size="sm">
          <Plus size={14} /> Add
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <DataTable
          columns={columns}
          data={gridData || []}
          loading={isLoading}
          emptyText={`No ${title.toLowerCase()} records found`}
          height={590}
          density="grid"
          getRowId={(row: any) => String(row.doc_no)}
        />
      </div>

      {dialogStatus.open && (
        <DocumentPageShell
          eyebrow={dialogStatus.type === 'edit' ? 'Edit Document' : 'Add Document'}
          title={title}
          badges={[
            { label: 'Doc No', value: formik.values.docNo || 'New' },
            { label: 'Doc Date', value: formik.values.docDate || '—' },
            { label: 'Ref No', value: formik.values.refNo || '—' },
          ]}
          onClose={closeDialog}
          onCancel={closeDialog}
          footer={
            <>
              <div className="text-sm text-slate-600">
                Total Amount{' '}
                <span className="text-base font-semibold text-[#0e4f8f]">
                  {totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
                  Close
                </Button>
                <Button
                  onClick={() => formik.submitForm()}
                  className="bg-[#0e4f8f] hover:bg-[#0c4278]"
                  disabled={isSaving}
                >
                  <Save size={14} />{' '}
                  {isSaving
                    ? 'Saving…'
                    : dialogStatus.type === 'edit'
                      ? 'Update'
                      : 'Save'}
                </Button>
              </div>
            </>
          }
        >
          <AddSalaryAdditionDeductionPage
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

export default SalaryAdditionDeductionMainPage;