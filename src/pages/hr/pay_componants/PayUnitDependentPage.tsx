import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../../../state/AuthContext';
import { getDynamicLookup } from '../../../api/lookups';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import AddPayUnitDependentForm from './AddPayUnitDependentForm';


function uppercaseKeys<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key in row) {
    out[key.toUpperCase()] = row[key];
  }
  return out as T;
}

const PayUnitDependentPage = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? '';
  const loginid = user?.loginid ?? '';

  const [openDivision, setOpenDivision] = useState(true);
  const [selectedDiv, setSelectedDiv] = useState<{ div_code: string; div_name: string } | null>(null);

  // ===================== FETCH DIVISION =====================
  const { data: divisionData } = useQuery({
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
        <span className="text-foreground">Pay Unit Dependent</span>
      </nav>

      {/* ===================== DIVISION DIALOG ===================== */}
      <Dialog open={openDivision} title="Select Division" onClose={() => setOpenDivision(false)}>
        <div className="flex h-[60vh] w-full flex-col">
          <div className="flex-1 overflow-y-auto">
            {(divisionData?.tableData ?? []).map((item: any, index: number) => (
              <div
                key={index}
                className="mb-0.5 flex items-center justify-between rounded-lg border border-gray-200 p-2 hover:bg-blue-50 cursor-pointer"
              >
                <h5 className="text-base font-medium text-[#082a89]">{item.DIV_NAME}</h5>
                <Button type="button" onClick={() => handleSelectDivision(item.DIV_CODE, item.DIV_NAME)} variant="outline">
                  Select
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Dialog>

      {/* ===================== HEADER + DETAIL TABS ===================== */}

      {selectedDiv && (
        <AddPayUnitDependentForm
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

export default PayUnitDependentPage;