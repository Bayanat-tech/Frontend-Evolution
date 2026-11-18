// src/hooks/useLookupOptions.ts
//
// One generic hook replacing the per-page useGradeOptions / useDependUnitOptions /
// useCodeOptions / useCountryOptions copies. Fetches a dynamic lookup using the
// user's company + login, upper-cases the keys, and maps rows to options.
//
// `map` must be referentially stable (define it at module level).

import { useEffect, useState } from "react";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";

export function uppercaseKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in row) out[key.toUpperCase()] = row[key];
  return out;
}

export function useLookupOptions<T>(
  parameter: string,
  map: (row: Record<string, unknown>) => T,
  label: string,
  /** Override code2 (defaults to the login id). Pass "" for lookups that never sent code2. */
  code2Override?: string,
): T[] {
  const { user } = useAuth();
  const { toast } = useToast();
  const [options, setOptions] = useState<T[]>([]);
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  useEffect(() => {
    if (!companyCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getDynamicLookup({ parameter, code1: companyCode, code2: code2Override ?? loginid });
        const rows = (Array.isArray(res) ? res : []) as unknown as Record<string, unknown>[];
        if (!cancelled) setOptions(rows.map(uppercaseKeys).map(map));
      } catch {
        if (!cancelled) {
          setOptions([]);
          toast.error(`Unable to load ${label}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parameter, companyCode, loginid, code2Override]);

  return options;
}