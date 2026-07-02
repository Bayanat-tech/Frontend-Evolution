import { useState } from 'react';
import type { SalaryAdditionDeductionDetailRow } from './types';
import SalaryAdditionDeductionTab1 from './SalaryAdditionDeductionTab1';
import SalaryAdditionDeductionTab2 from './SalaryAdditionDeductionTab2';

type Props = {
  mode?: string;
  formik: any;
  detailRows: SalaryAdditionDeductionDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<SalaryAdditionDeductionDetailRow[]>>;
};

const TABS = [
  { key: 'header', label: 'Details' },
  { key: 'detail', label: 'Addition / Deduction Lines' },
];

const AddSalaryAdditionDeductionPage = ({ formik, detailRows, setDetailRows }: Props) => {
  const [activeTab, setActiveTab] = useState(TABS[0].key);

  return (
    <form className="flex flex-col gap-3" onSubmit={formik.handleSubmit}>
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'header' && <SalaryAdditionDeductionTab1 formik={formik} />}
      {activeTab === 'detail' && (
        <SalaryAdditionDeductionTab2 detailRows={detailRows} setDetailRows={setDetailRows} />
      )}
    </form>
  );
};

export default AddSalaryAdditionDeductionPage;