import type { SalaryAdditionDeductionDetailRow } from './types';
import SalaryAdditionDeductionTab1 from './SalaryAdditionDeductionTab1';
import SalaryAdditionDeductionTab2 from './SalaryAdditionDeductionTab2';

type Props = {
  mode?: string;
  formik: any;
  detailRows: SalaryAdditionDeductionDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<SalaryAdditionDeductionDetailRow[]>>;
};

const AddSalaryAdditionDeductionPage = ({ formik, detailRows, setDetailRows }: Props) => {
  return (
    <form className="flex flex-col gap-4" onSubmit={formik.handleSubmit}>
      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-1 rounded-full bg-primary" />
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Details
          </h3>
        </div>
        <SalaryAdditionDeductionTab1 formik={formik} />
      </section>

      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-1 rounded-full bg-primary" />
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Addition / Deduction Lines
          </h3>
        </div>
        <SalaryAdditionDeductionTab2 detailRows={detailRows} setDetailRows={setDetailRows} />
      </section>
    </form>
  );
};

export default AddSalaryAdditionDeductionPage;