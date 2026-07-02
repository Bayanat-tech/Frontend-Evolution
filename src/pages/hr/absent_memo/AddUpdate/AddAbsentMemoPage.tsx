import { useState } from 'react';
import type { AbsentMemoDetailRow } from './types';
import AbsentMemoTab1 from './AbsentMemoTab1';
import AbsentMemoDetailTab from './AbsentMemoDetailTab';

type Props = {
  mode?: string;
  formik: any;
  detailRows: AbsentMemoDetailRow[];
  setDetailRows: React.Dispatch<React.SetStateAction<AbsentMemoDetailRow[]>>;
};

const TABS = [
  { key: 'header', label: 'Details' },
  { key: 'detail', label: 'Absence Lines' },
];

const AddAbsentMemoPage = ({ formik, detailRows, setDetailRows }: Props) => {
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

      {activeTab === 'header' && <AbsentMemoTab1 formik={formik} />}
      {activeTab === 'detail' && <AbsentMemoDetailTab detailRows={detailRows} setDetailRows={setDetailRows} />}
    </form>
  );
};

export default AddAbsentMemoPage;