// hooks/useRawSqlDropdown.ts
import { useEffect, useState } from "react";
import { api } from "../api/client";

type DropdownOption = { value: string; label: string };

type UseRawSqlDropdownProps = {
  sql: string;
  valueKey: string;
  labelKeys: string[]; // joins with " - "
  enabled?: boolean;   // optional, default true
};

export function useRawSqlDropdown({ sql, valueKey, labelKeys, enabled = true }: UseRawSqlDropdownProps) {
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !sql) return;
    setLoading(true);
    setError(null);

    api.post("/api/wms/inbound/executeRawSql", { raw_sql: sql })
      .then((response:any) => {
        const data = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
        setOptions(
          data.map((row: Record<string, unknown>) => {
            const get = (key: string) => String(row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()] ?? "");
            return {
              value: get(valueKey),
              label: labelKeys.map(get).filter(Boolean).join(" - "),
            };
          })
        );
      })
      .catch((err:any) => setError(err instanceof Error ? err.message : "Failed to load options"))
      .finally(() => setLoading(false));
  }, [sql, enabled]);

  return { options, loading, error };
}