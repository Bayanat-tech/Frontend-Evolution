import type { AbsentMemoDetailRow } from './types';
import AbsentMemoTab1 from './AbsentMemoTab1';
import AbsentMemoDetailTab from './AbsentMemoDetailTab';

type Props = {
  mode?: string;
  formik: any;
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};

const AddAbsentMemoPage = ({ formik, detailRows, setDetailRows }: Props) => {
  return (
    <form className="flex flex-col gap-4" onSubmit={formik.handleSubmit}>
      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-1 rounded-full bg-primary" />
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Details
          </h3>
        </div>
        <AbsentMemoTab1 formik={formik} />
      </section>

      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-1 rounded-full bg-primary" />
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Absence Lines
          </h3>
        </div>
        <AbsentMemoDetailTab detailRows={detailRows} setDetailRows={setDetailRows} />
      </section>
    </form>
  );
};

export default AddAbsentMemoPage;