import { useEffect, useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { getDynamicLookup } from '../../api/lookups';

export type TCodeOption = {
  value_code: string;
  value_desc: string;
};

export const useCodeOptions = (parameter: string): TCodeOption[] => {
  const { user } = useAuth();
  const [options, setOptions] = useState<TCodeOption[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await getDynamicLookup({
          parameter,
          loginid: user?.loginid ?? '',
          code1: user?.company_code ?? ''
        });
        if (Array.isArray(response)) {
          setOptions(
            response.map((row: any) => ({
              value_code: row.VALUE_CODE ?? row.value_code ?? '',
              value_desc: row.VALUE_DESC ?? row.value_desc ?? ''
            }))
          );
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (user?.company_code) fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_code, parameter]);

  return options;
};