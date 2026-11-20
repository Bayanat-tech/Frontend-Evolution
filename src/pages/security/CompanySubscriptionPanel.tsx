import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";

type Subscription = Record<string, string | number | null>;
export function CompanySubscriptionPanel({ tenant, company }: { tenant: string; company: string }) {
  const [draft, setDraft] = useState<Subscription>({});
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const path = `/api/security/platform/${encodeURIComponent(tenant)}/subscription?company=${encodeURIComponent(company)}`;
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    api.get(path).then(r => { if (active) setDraft(r.data.data); })
      .catch(e => { if (active) setError(e.response?.data?.message || "Unable to load subscription. Please retry."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, revision]);
  const set = (key: string, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const r = await api.put(path, draft);
      setDraft(current => ({ ...current, VERSION_NO: r.data.data.version }));
      setNotice("Subscription saved and recorded in the activity log.");
    } catch (e: any) { setError(e.response?.data?.message || "Unable to save subscription."); }
    finally { setSaving(false); }
  };
  const fields = [
    ["PLAN_NAME","Plan name","text"], ["CURRENCY","Currency code","text"],
    ["AMOUNT","Amount per cycle","number"], ["NEXT_BILL_DATE","Next billing date","date"],
    ["BILLING_REFERENCE","Billing reference","text"],
  ];
  return <form className="platform-editor" onSubmit={save} aria-busy={loading || saving}>
    <div className="platform-editor-heading"><div><h3>Company subscription</h3><p className="platform-help">Track commercial terms for {company}. These settings do not charge customers or suspend application access.</p></div>
      <Button type="button" variant="outline" disabled={saving || loading} onClick={() => setRevision(v => v + 1)}>Reload</Button></div>
    {error && <p className="platform-error" role="alert">{error}</p>}
    {notice && <p className="platform-notice" role="status">{notice}</p>}
    {loading ? <p role="status">Loading subscription…</p> : <fieldset disabled={saving || draft.VERSION_NO == null} className="platform-subscription-fields">
      <label>Status<select value={String(draft.STATUS || "DRAFT")} onChange={e => set("STATUS", e.target.value)}>{["DRAFT","ACTIVE","PAUSED","CLOSED"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Billing cycle<select value={String(draft.BILLING_CYCLE || "MONTHLY")} onChange={e => set("BILLING_CYCLE", e.target.value)}>{["MONTHLY","QUARTERLY","YEARLY","CUSTOM"].map(v => <option key={v}>{v}</option>)}</select></label>
      {fields.map(([key, title, type]) => <label key={key}>{title}<input type={type} value={draft[key] ?? ""}
        maxLength={key === "CURRENCY" ? 3 : 100} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined}
        onChange={e => set(key, key === "CURRENCY" ? e.target.value.toUpperCase() : e.target.value)} /></label>)}
      <label className="platform-field-wide">Notes<textarea rows={3} maxLength={1000} value={String(draft.NOTES || "")} onChange={e => set("NOTES", e.target.value)} /></label>
      <div className="platform-editor-actions"><Button type="submit" disabled={saving || loading || draft.VERSION_NO == null}>{saving ? "Saving…" : "Save subscription"}</Button></div>
    </fieldset>}
  </form>;
}
