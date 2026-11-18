import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { mapEmployeeHr } from "../../../pages/hr/Employee Master/employee-hr.mapper";
import type { TEmployeeHr } from "../../../pages/hr/Employee Master/employee-hr.types";

export const employeeListKey = (companyCode: string) => ["employee-hr", companyCode];

const EMPTY: TEmployeeHr[] = [];

/** created_at as a timestamp, or null when the record has none (older records) */
const createdTime = (r: TEmployeeHr): number | null => {
  const v = (r as unknown as Record<string, unknown>).created_at;
  if (!v) return null;
  const t = new Date(String(v)).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Newest first: by created_at when both rows have it, otherwise by employee_id (highest first). */
const newestFirst = (a: TEmployeeHr, b: TEmployeeHr): number => {
  const ta = createdTime(a);
  const tb = createdTime(b);
  if (ta !== null && tb !== null && ta !== tb) return tb - ta;
  if (ta !== null && tb === null) return -1; // rows with a created date come before rows without one
  if (ta === null && tb !== null) return 1;

  const ia = Number(a.employee_id);
  const ib = Number(b.employee_id);
  if (!Number.isNaN(ia) && !Number.isNaN(ib) && ia !== ib) return ib - ia;
  return String(b.employee_id).localeCompare(String(a.employee_id));
};

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
    // Always load a fresh list when the list page (or the workspace) opens, so a newly added
    // employee is never hidden by a cached copy, whatever the app-wide staleTime is.
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Newest employee first
  const rows = useMemo(() => (query.data ? [...query.data].sort(newestFirst) : EMPTY), [query.data]);

  return { ...query, rows, companyCode, loginid };
}