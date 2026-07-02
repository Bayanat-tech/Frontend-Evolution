import { Input } from "../../../../components/ui/Input";

type Props = {
  formik: any;
};

const fieldConfigs: Array<{ name: string; label: string; span?: 'full'; type?: string; multiline?: boolean }> = [
  { name: 'docNo', label: 'Doc No' },
  { name: 'docDate', label: 'Doc Date', type: 'date' },
  { name: 'docType', label: 'Doc Type' },
  { name: 'refNo', label: 'Ref No' },
  { name: 'nameFrom', label: 'Name From' },
  { name: 'nameTo', label: 'Name To' },
  { name: 'addrFrom', label: 'Addr From' },
  { name: 'addrTo', label: 'Addr To' },
  { name: 'lettrSubject', label: 'Lettr Subject', span: 'full' },
  { name: 'remarks1', label: 'Remarks 1', span: 'full', multiline: true },
  { name: 'remarks2', label: 'Remarks 2', span: 'full', multiline: true },
  { name: 'signatoryName', label: 'Signatory Name' },
  { name: 'signatoryPosition', label: 'Signatory Position' },
];

const SalaryAdditionDeductionTab1 = ({ formik }: Props) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

export default SalaryAdditionDeductionTab1;