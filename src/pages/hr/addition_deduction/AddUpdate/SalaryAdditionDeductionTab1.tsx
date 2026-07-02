import { FloatingField, floatingInputClass, floatingTextareaClass } from '../../../../components/ui/FloatingField';

type Props = {
  formik: any;
};

const SalaryAdditionDeductionTab1 = ({ formik }: Props) => {
  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Row 1: Doc No, Doc Date, Doc Type, Ref No */}
      <FloatingField label="Doc No">
        <input className={floatingInputClass} name="docNo" value={formik.values.docNo ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      <FloatingField label="Doc Date">
        <input className={floatingInputClass} type="date" name="docDate" value={formik.values.docDate ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      <FloatingField label="Doc Type">
        <input className={floatingInputClass} name="docType" value={formik.values.docType ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      <FloatingField label="Ref No">
        <input className={floatingInputClass} name="refNo" value={formik.values.refNo ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      {/* Row 2: Name From, Name To */}
      <FloatingField label="Name From" className="col-span-2">
        <input className={floatingInputClass} name="nameFrom" value={formik.values.nameFrom ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      <FloatingField label="Name To" className="col-span-2">
        <input className={floatingInputClass} name="nameTo" value={formik.values.nameTo ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      {/* Row 3: Addr From, Addr To */}
      <FloatingField label="Addr From" className="col-span-2">
        <input className={floatingInputClass} name="addrFrom" value={formik.values.addrFrom ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      <FloatingField label="Addr To" className="col-span-2">
        <input className={floatingInputClass} name="addrTo" value={formik.values.addrTo ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      {/* Row 4: Lettr Subject (full width) */}
      <FloatingField label="Lettr Subject" className="col-span-4">
        <input className={floatingInputClass} name="lettrSubject" value={formik.values.lettrSubject ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      {/* Row 5-6: Remarks (full width) */}
      <FloatingField label="Remarks 1" className="col-span-4">
        <textarea className={floatingTextareaClass} name="remarks1" value={formik.values.remarks1 ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      <FloatingField label="Remarks 2" className="col-span-4">
        <textarea className={floatingTextareaClass} name="remarks2" value={formik.values.remarks2 ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      {/* Row 7: Signatory Name, Signatory Position */}
      <FloatingField label="Signatory Name" className="col-span-2">
        <input className={floatingInputClass} name="signatoryName" value={formik.values.signatoryName ?? ''} onChange={formik.handleChange} />
      </FloatingField>

      <FloatingField label="Signatory Position" className="col-span-2">
        <input className={floatingInputClass} name="signatoryPosition" value={formik.values.signatoryPosition ?? ''} onChange={formik.handleChange} />
      </FloatingField>
    </div>
  );
};

export default SalaryAdditionDeductionTab1;