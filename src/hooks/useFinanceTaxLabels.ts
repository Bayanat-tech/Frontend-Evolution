import { useEffect, useState } from 'react';
import { getCompanyInfo, type CompanyInfo } from '../api/transactions';
import { useAuth } from '../state/AuthContext';
import { DEFAULT_FINANCE_TAX_LABELS, resolveFinanceTaxLabels, type FinanceTaxLabels } from '../utils/financeTaxTreatment';

export function useFinanceTaxLabels(companyInfo?: CompanyInfo | null): FinanceTaxLabels {
  const { user } = useAuth();
  const companyKey = `${user?.loginid || user?.username || ''}:${user?.company_code || ''}`;
  const [loaded, setLoaded] = useState<{ key: string; labels: FinanceTaxLabels } | null>(null);

  useEffect(() => {
    if (companyInfo !== undefined || !user?.company_code) return;
    let active = true;
    getCompanyInfo().then(info => {
      if (active) setLoaded({ key: companyKey, labels: resolveFinanceTaxLabels(info.tax_treatment_labels) });
    }).catch(() => {
      if (active) setLoaded({ key: companyKey, labels: { ...DEFAULT_FINANCE_TAX_LABELS } });
    });
    return () => { active = false; };
  }, [companyInfo, companyKey, user?.company_code]);

  if (companyInfo !== undefined) return resolveFinanceTaxLabels(companyInfo?.tax_treatment_labels);
  return loaded?.key === companyKey ? loaded.labels : DEFAULT_FINANCE_TAX_LABELS;
}
