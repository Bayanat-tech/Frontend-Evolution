import { useQuery } from "@tanstack/react-query";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { mapEmployeeHr } from "../../../pages/hr/Employee Master/employee-hr.mapper";
import type { TEmployeeHr } from "../../../pages/hr/Employee Master/employee-hr.types";

export const employeeListKey = (companyCode: string) => ["employee-hr", companyCode];

const EMPTY: TEmployeeHr[] = [];

export function useEmployeeList() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const query = useQuery({
    queryKey: employeeListKey(companyCode),
    queryFn: async (): Promise<TEmployeeHr[]> => {
      const response = await getDynamicLookup({
        parameter: "MSEHR_TRANSACTIONS_MS_HR_EMPLOYEE",
        loginid,
        code1: companyCode,
      });
      return ((Array.isArray(response) ? response : []) as Record<string, unknown>[]).map(mapEmployeeHr);
    },
    enabled: !!companyCode,
  });

  return { ...query, rows: query.data ?? EMPTY, companyCode, loginid };
}