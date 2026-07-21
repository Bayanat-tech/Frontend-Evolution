import type { AbsentMemoDetailRow } from './types';
import { LookupField } from '../../../components/ui/LookupField';
import { DocField, docInputClass, docTextareaClass, DocumentSection, DocumentTable } from '../../../components/ui/DocumentPageShell';
import { getDynamicLookup } from '../../../api/lookups';
import { useAuth } from '../../../state/AuthContext';
import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { DataTable } from '../../../components/ui/DataTable';

type Props = {
  mode?: string;
  formik: any;
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};
type AbsentMemoTab1Props = { formik: any };
type AbsentMemoDetailTabProps = {
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};

const AddAbsentMemoPage = ({ formik, detailRows, setDetailRows }: Props) => {
  return (
    <form className="grid gap-4" onSubmit={formik.handleSubmit}>
      <DocumentSection label="Header" subtitle="Payment Information">
        <AbsentMemoTab1 formik={formik} />
      </DocumentSection>

      <DocumentSection
        label="Details"
        subtitle="Absence Lines"
        action={
          <Button size="sm" type="button" onClick={() => {}} className="invisible" />
        }
      >
        <AbsentMemoDetailTab detailRows={detailRows} setDetailRows={setDetailRows} />
      </DocumentSection>
    </form>
  );
};

const AbsentMemoTab1 = ({ formik }: AbsentMemoTab1Props) => {
  const { user } = useAuth();

  const loadEmployees = async () => {
    const response = await getDynamicLookup({
      parameter: 'HR_ADDITION_DEDUCTION_EMPLOYEE_DROP_DOWN',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
    });
    return Array.isArray(response) ? response : [];
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      <DocField label="Doc No">
        <input
          className={docInputClass}
          name="docNo"
          value={formik.values.docNo ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Doc Date">
        <input
          className={docInputClass}
          type="date"
          name="docDate"
          value={formik.values.docDate ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Doc Type">
        <input
          className={docInputClass}
          name="docType"
          value={formik.values.docType ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Ref No">
        <input
          className={docInputClass}
          name="refNo"
          value={formik.values.refNo ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Employee Code" required>
        <LookupField
          value={formik.values.employeeCode ?? ''}
          columns={[
            { field: 'employee_code', header: 'Employee Code' },
            { field: 'rpt_name', header: 'Name' },
          ]}
          valueField="employee_code"
          displayFields={['employee_code']}
          loadOptions={loadEmployees}
          onChange={(value, row) => {
            formik.setFieldValue('employeeCode', value);
            formik.setFieldValue('nameFrom', String(row?.rpt_name ?? row?.RPT_NAME ?? ''));
          }}
        />
      </DocField>

      <DocField label="Name From">
        <input
          className={docInputClass}
          name="nameFrom"
          value={formik.values.nameFrom ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Addr From">
        <input
          className={docInputClass}
          name="addrFrom"
          value={formik.values.addrFrom ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Lettr Subject">
        <input
          className={docInputClass}
          name="lettrSubject"
          value={formik.values.lettrSubject ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Remarks 1" className="col-span-2">
        <textarea
          className={docTextareaClass}
          name="remarks1"
          value={formik.values.remarks1 ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Remarks 2" className="col-span-2">
        <textarea
          className={docTextareaClass}
          name="remarks2"
          value={formik.values.remarks2 ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Signatory Name" className="col-span-2">
        <input
          className={docInputClass}
          name="signatoryName"
          value={formik.values.signatoryName ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>

      <DocField label="Signatory Position" className="col-span-2">
        <input
          className={docInputClass}
          name="signatoryPosition"
          value={formik.values.signatoryPosition ?? ''}
          onChange={formik.handleChange}
        />
      </DocField>
    </div>
  );
};

const AbsentMemoDetailTab = ({ detailRows, setDetailRows }: AbsentMemoDetailTabProps) => {
  const { user } = useAuth();

  const loadPayUnits = async () => {
    const response = await getDynamicLookup({
      parameter: 'PAY_COMPONENT_DependentPayCompId',
      loginid: user?.loginid ?? '',
      code1: user?.company_code ?? '',
    });
    return Array.isArray(response) ? response : [];
  };

  const updateRow = (rowKey: number | string, patch: Partial<AbsentMemoDetailRow>) => {
    setDetailRows((prev) =>
      prev.map((row) => (String(row.srNo) === String(rowKey) ? { ...row, ...patch } : row)),
    );
  };

  const handleAddDetailRow = () => {
    const nextSrNo = detailRows.length > 0 ? Number(detailRows[detailRows.length - 1]?.srNo || 0) + 1 : 1;
    setDetailRows((prev) => [
      ...prev,
      {
        srNo: nextSrNo,
        payUnit: '',
        description: '',
        effectiveFrom: '',
        absentFromDate: '',
        absentToDate: '',
        noOfDays: '',
        amount: '',
        refLeaveDocNo: '',
        cancel: 'No',
      },
    ]);
  };

  const handleRemoveDetailRow = (rowKey: number | string) => {
    setDetailRows((prev) => prev.filter((row) => String(row.srNo) !== String(rowKey)));
  };

  const columns = useMemo<ColumnDef<AbsentMemoDetailRow>[]>(
    () => [
      { accessorKey: 'srNo', header: 'No', size: 55 },
      {
        accessorKey: 'payUnit',
        header: 'Pay Unit',
        size: 180,
        cell: ({ row }) => (
          <LookupField
            label="Pay Unit"
            compact
            value={row.original.payUnit}
            columns={[
              { field: 'value_code', header: 'Value Code' },
              { field: 'value_desc', header: 'Description' },
            ]}
            valueField="value_code"
            displayFields={['value_code', 'value_desc']}
            loadOptions={loadPayUnits}
            onChange={(value) => updateRow(row.original.srNo, { payUnit: value })}
          />
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            value={row.original.description}
            onChange={(e) => updateRow(row.original.srNo, { description: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'effectiveFrom',
        header: 'Effective From',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="date"
            value={row.original.effectiveFrom}
            onChange={(e) => updateRow(row.original.srNo, { effectiveFrom: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'absentFromDate',
        header: 'From Date',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="date"
            value={row.original.absentFromDate}
            onChange={(e) => updateRow(row.original.srNo, { absentFromDate: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'absentToDate',
        header: 'To Date',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="date"
            value={row.original.absentToDate}
            onChange={(e) => updateRow(row.original.srNo, { absentToDate: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'noOfDays',
        header: 'No Of Days',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="number"
            value={String(row.original.noOfDays ?? '')}
            onChange={(e) => updateRow(row.original.srNo, { noOfDays: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            type="number"
            value={String(row.original.amount ?? '')}
            onChange={(e) => updateRow(row.original.srNo, { amount: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'refLeaveDocNo',
        header: 'Ref Leave Doc No',
        cell: ({ row }) => (
          <Input
            className="h-7 text-[11px] px-2"
            value={row.original.refLeaveDocNo}
            onChange={(e) => updateRow(row.original.srNo, { refLeaveDocNo: e.target.value })}
          />
        ),
      },
      {
        accessorKey: 'cancel',
        header: 'Cancel',
        cell: ({ row }) => (
          <Select
            className="h-7 text-[11px] px-2"
            value={row.original.cancel}
            onChange={(e) => updateRow(row.original.srNo, { cancel: e.target.value })}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </Select>
        ),
      },
      {
        id: 'actions',
        header: 'Remove',
        cell: ({ row }) => (
          <Button
            size="icon"
            variant="ghost"
            title="Delete Row"
            onClick={() => handleRemoveDetailRow(row.original.srNo)}
          >
            <Trash2 size={13} />
          </Button>
        ),
        size: 60,
      },
    ],
    [user],
  );

  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleAddDetailRow}
          className="border border-[#0e4f8f] bg-white text-[#0e4f8f] hover:bg-[#eaf2fb]"
        >
          <Plus size={13} /> Add Line
        </Button>
      </div>

      <DocumentTable>
        <DataTable
          columns={columns}
          data={detailRows}
          emptyText="No lines added"
          height={260}
          density="compact"
          getRowId={(row) => String(row.srNo)}
        />
      </DocumentTable>
    </div>
  );
};

export default AddAbsentMemoPage;