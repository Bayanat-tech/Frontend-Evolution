import { Input } from '../../../../components/ui/Input';
import { LookupField } from '../../../../components/ui/LookupField';
import { getDynamicLookup } from '../../../../api/lookups';
import { useAuth } from '../../../../state/AuthContext';


type Props = {
  formik: any;
};

const fieldConfigs: Array<{ name: string; label: string; span?: 'full'; type?: string; multiline?: boolean }> = [
  { name: 'docNo', label: 'Doc No' },
  { name: 'docDate', label: 'Doc Date', type: 'date' },
  { name: 'docType', label: 'Doc Type' },
  { name: 'refNo', label: 'Ref No' },
  { name: 'addrFrom', label: 'Addr From' },
  { name: 'lettrSubject', label: 'Lettr Subject' },
  { name: 'remarks1', label: 'Remarks 1', span: 'full', multiline: true },
  { name: 'remarks2', label: 'Remarks 2', span: 'full', multiline: true },
  { name: 'signatoryName', label: 'Signatory Name' },
  { name: 'signatoryPosition', label: 'Signatory Position' },
];

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <LookupField
        label="Employee Code"
        required
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

      {fieldConfigs.map((field) => (
        <label key={field.name} className={`flex flex-col gap-1 ${field.span === 'full' ? 'sm:col-span-2' : ''}`}>
          <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
          {field.multiline ? (
            <textarea
              className="min-h-[72px] w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              name={field.name}
              value={formik.values[field.name] ?? ''}
              onChange={formik.handleChange}
            />
          ) : (
            <Input
              type={field.type ?? 'text'}
              name={field.name}
              value={formik.values[field.name] ?? ''}
              onChange={formik.handleChange}
            />
          )}
        </label>
      ))}
    </div>
  );
};

export default AbsentMemoTab1;