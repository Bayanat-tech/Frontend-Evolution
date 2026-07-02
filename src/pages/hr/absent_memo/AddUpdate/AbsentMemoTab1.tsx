import { LookupField } from '../../../../components/ui/LookupField';
import { FloatingField, floatingInputClass, floatingTextareaClass } from '../../../../components/ui/FloatingField';
import { getDynamicLookup } from '../../../../api/lookups';
import { useAuth } from '../../../../state/AuthContext';

type Props = {
  formik: any;
};

const AbsentMemoTab1 = ({ formik }: Props) => {
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
      {/* Row 1: Doc No, Doc Date, Doc Type, Ref No */}
      <FloatingField label="Doc No">
        <input
          className={floatingInputClass}
          name="docNo"
          value={formik.values.docNo ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      <FloatingField label="Doc Date">
        <input
          className={floatingInputClass}
          type="date"
          name="docDate"
          value={formik.values.docDate ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      <FloatingField label="Doc Type">
        <input
          className={floatingInputClass}
          name="docType"
          value={formik.values.docType ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      <FloatingField label="Ref No">
        <input
          className={floatingInputClass}
          name="refNo"
          value={formik.values.refNo ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      {/* Row 2: Employee Code, Name From */}
      <div className="col-span-2">
        <LookupField
          label="Employee Code"
          value={formik.values.employeeCode ?? ''}
          columns={[
            { field: 'employee_code', header: 'Employee Code' },
            { field: 'rpt_name', header: 'Name' },
          ]}
          valueField="employee_code"
          displayFields={['employee_code', 'rpt_name']}
          loadOptions={loadEmployees}
          onChange={(value, row) => {
            formik.setFieldValue('employeeCode', value);
            formik.setFieldValue('nameFrom', String(row?.rpt_name ?? row?.RPT_NAME ?? ''));
          }}
        />
      </div>

      <FloatingField label="Name From" className="col-span-2">
        <input
          className={floatingInputClass}
          name="nameFrom"
          value={formik.values.nameFrom ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      {/* Row 3: Addr From, Lettr Subject */}
      <FloatingField label="Addr From" className="col-span-2">
        <input
          className={floatingInputClass}
          name="addrFrom"
          value={formik.values.addrFrom ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      <FloatingField label="Lettr Subject" className="col-span-2">
        <input
          className={floatingInputClass}
          name="lettrSubject"
          value={formik.values.lettrSubject ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      {/* Row 4-5: Remarks (full width) */}
      <FloatingField label="Remarks 1" className="col-span-4">
        <textarea
          className={floatingTextareaClass}
          name="remarks1"
          value={formik.values.remarks1 ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      <FloatingField label="Remarks 2" className="col-span-4">
        <textarea
          className={floatingTextareaClass}
          name="remarks2"
          value={formik.values.remarks2 ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      {/* Row 6: Signatory Name, Signatory Position */}
      <FloatingField label="Signatory Name" className="col-span-2">
        <input
          className={floatingInputClass}
          name="signatoryName"
          value={formik.values.signatoryName ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>

      <FloatingField label="Signatory Position" className="col-span-2">
        <input
          className={floatingInputClass}
          name="signatoryPosition"
          value={formik.values.signatoryPosition ?? ''}
          onChange={formik.handleChange}
        />
      </FloatingField>
    </div>
  );
};

export default AbsentMemoTab1;