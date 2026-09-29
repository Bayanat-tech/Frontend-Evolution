import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { DivisionPickerDialog } from '../../../components/ui/DivisionPickerDialog';
import AddGradePayUnitForm from './AddGradePayUnitForm';

function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

const GradePayUnitPage = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? '';
  const loginid = user?.loginid ?? '';

  const [openDivision, setOpenDivision] = useState(true);
  const [selectedDiv, setSelectedDiv] = useState<{ div_code: string; div_name: string } | null>(null);

  // ===================== FETCH DIVISION =====================
  const { data: divisionData, isLoading: isLoadingDivision } = useQuery({
    queryKey: ['division', companyCode],
    queryFn: async () => {
      const response = await getDynamicLookup({
        parameter: 'Account_division',
        code1: companyCode,
        code2: loginid
      });

      const rawRows = (response ?? []) as unknown as Record<string, unknown>[];
      const tableData = rawRows.map(uppercaseKeys);
      return { tableData, count: tableData.length };
    },
    enabled: !!companyCode
  });

  // ===================== SELECT DIVISION =====================
  const handleSelectDivision = (div_code: string, div_name: string) => {
    setSelectedDiv({ div_code, div_name });
    setOpenDivision(false);
  };

  // ===================== RENDER =====================
  return (
    <div className="flex flex-col space-y-0.5">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <a href="/dashboard" className="hover:underline hover:text-foreground">
          Home
        </a>
        <span>/</span>
        <span className="text-foreground">Grade Pay Unit</span>
      </nav>

      <DivisionPickerDialog
        open={openDivision}
        divisions={divisionData?.tableData ?? []}
        loading={isLoadingDivision}
        description="Choose a division to continue."
        onSelect={(item, code, name) => handleSelectDivision(code || item.DIV_CODE || item.div_code, name || item.DIV_NAME || item.div_name)}
        onClose={() => setOpenDivision(false)}
      />

      {selectedDiv && (
        <AddGradePayUnitForm
          key={selectedDiv.div_code}
          onClose={() => { }}
          isEdit={false}
          isViewMode={false}
          div_code={selectedDiv.div_code}
          div_name={selectedDiv.div_name}
        />
      )}
    </div>
  );
};

export default GradePayUnitPage;