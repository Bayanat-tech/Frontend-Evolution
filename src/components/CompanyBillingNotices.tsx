import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import "./CompanyBillingNotices.css";
export function CompanyBillingNotices() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Record<string, any>[]>([]);
  useEffect(() => {
    let active = true; setNotices([]);
    if (!user?.tenantId || !user.company_code || user.isPlatformAdmin) return;
    api.get("/api/auth/billing-notices").then(r => { if (active) setNotices(r.data.data || []); }).catch(() => {});
    return () => { active = false; };
  }, [user?.tenantId, user?.company_code, user?.loginid]);
  if (!notices.length) return null;
  return <aside className="company-billing-notices" role="status"><strong>Company subscription payment reminder</strong>
    {notices.map(n => <p key={n.INVOICE_ID}>Invoice INV-{n.INVOICE_ID} is awaiting payment. Due: {n.DUE_DATE}; grace period ends: {n.GRACE_END}.{n.SUSPENDED === "Y" ? " Some modules are suspended." : ""} Please contact your company administrator.</p>)}
  </aside>;
}
