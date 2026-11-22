import { FormEvent, useEffect, useId, useState } from "react";
import { Receipt, Settings2, Send, Search, CreditCard, FileText, RefreshCw, CheckCircle2, Clock3 } from "lucide-react";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import "./billing-ui.css";
type Row = Record<string, any>;
const labels: Record<string,string> = { activate: "Activate billing", deactivate: "Deactivate billing", suspend: "Suspend module access", restore: "Restore module access", cancel: "Stop future renewals" };
export function CompanySubscriptionPanel({ tenant, company }: { tenant: string; company: string }) {
  const [draft,setDraft] = useState<Row>({}), [data,setData] = useState<Row>({ invoices:[],reminders:[],modules:[] });
  const [loading,setLoading] = useState(true), [saving,setSaving] = useState(false), [dirty,setDirty] = useState(false);
  const [error,setError] = useState(""), [notice,setNotice] = useState(""), [revision,setRevision] = useState(0);
  const [action,setAction] = useState<string | null>(null), [payment,setPayment] = useState<Row | null>(null), [view,setView] = useState<Row | null>(null);
  const [reference,setReference] = useState(""), [paidOn,setPaidOn] = useState("");
  const [tab,setTab] = useState("terms"), [search,setSearch] = useState(""), [filter,setFilter] = useState("ALL");
  const tabsId = useId();
  const base = `/api/security/platform/${encodeURIComponent(tenant)}`, query = `?company=${encodeURIComponent(company)}`;
  const enabled = draft.BILLING_ENABLED === "Y";
  useEffect(() => {
    let active=true; setLoading(true); setError("");
    api.get(`${base}/billing${query}`).then(r => { if(active) {setData(r.data.data);setDraft(r.data.data.subscription);setDirty(false);} })
      .catch(e => {if(active) setError(e.response?.data?.message || "Unable to load billing");}).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[base,query,revision]);
  const set = (key:string,value:any) => {setDraft(current => ({...current,[key]:value}));setDirty(true);};
  const run = async (fn:()=>Promise<any>,message:string,after?:()=>void) => {
    if(saving) return; setSaving(true);setError("");setNotice("");
    try {const r=await fn();setNotice(r?.data?.data?.warning || message);setRevision(v=>v+1);after?.();}
    catch(e:any) {setError(e.response?.data?.message || e.message || "Billing operation failed");} finally {setSaving(false);}
  };
  const save = (e:FormEvent) => {e.preventDefault();void run(()=>api.put(`${base}/subscription${query}`,draft),"Settings saved. Billing remains inactive until PRODADMIN activates it.");};
  const fields = [["PLAN_NAME","Plan name","text"],["CURRENCY","Currency code","text"],["AMOUNT","Amount per cycle","number"],["START_DATE","Start date (UTC)","date"],["BILLING_EMAIL","Billing email contact","email"],["DUE_DAYS","Payment due after (days)","number"],["GRACE_DAYS","Grace period (days)","number"],["BILLING_REFERENCE","Contract / billing reference","text"]];
  const invoiceStatus = (i:Row) => i.STATUS === "PAID" ? "PAID" : data.today > i.DUE_DATE ? "OVERDUE" : "PENDING";
  const invoices:Row[] = data.invoices || [];
  const filteredInvoices = invoices.filter(i => (filter === "ALL" || invoiceStatus(i) === filter) && `INV-${i.INVOICE_ID} ${i.PLAN_NAME || ""} ${i.MODULE_CODES} ${i.PERIOD_START} ${i.CURRENCY}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="billing-workspace" aria-busy={loading || saving}>
    <div className={`billing-state ${enabled ? "billing-state-active" : ""}`}><div className="billing-state-heading"><span className="billing-brand-icon"><Receipt size={25} /></span><div><span className={`billing-state-badge ${enabled ? "is-active" : ""}`}>{enabled ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{enabled ? "Active" : "Inactive"}</span><h3>Invoice billing: {enabled ? "Active" : "Inactive"}</h3>
      <p>{enabled ? draft.STATUS === "CLOSED" ? `Future renewals have stopped for ${company}.` : `Billing applies to ${company}. Next invoice: ${draft.NEXT_BILL_DATE || "—"}.` : `Billing does not apply to ${company}. No invoices, reminders or billing-related restrictions will run.`}</p>
      {enabled && draft.SUSPENDED === "Y" && <strong>Selected modules are suspended for non-payment.</strong>}
      {enabled && draft.CANCEL_ON && <strong>Renewals stopped. Access ends after {draft.CANCEL_ON}.</strong>}</div></div>
      <div className="billing-actions"><Button variant="outline" disabled={saving || loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={15} />Reload</Button>
        {data.canManage && <Button variant={enabled ? "outline" : "default"} disabled={saving || loading || dirty || !draft.VERSION_NO || (!enabled && (!data.emailConfigured || data.schedulerEnabled === false))} onClick={()=>setAction(enabled ? "deactivate" : "activate")}>{enabled ? "Deactivate billing" : "Activate billing"}</Button>}</div>
    </div>
    {!loading && !data.canManage && <p className="platform-help">Only PRODADMIN / production administrators can activate billing, record payments and restrict access.</p>}
    {dirty && <p className="platform-notice">Save settings before activation.</p>}
    {error && <p className="platform-error" role="alert">{error}</p>}{notice && <p className="platform-notice" role="status">{notice}</p>}
    {loading ? <div className="billing-loading" role="status"><RefreshCw size={20} />Loading billing workspace…</div> : <>
      <dl className="billing-plan-summary"><div><dt>Company & plan</dt><dd>{company}<span>{draft.PLAN_NAME || "No plan configured"}</span></dd></div><div><dt>Amount per cycle{dirty ? " · unsaved" : ""}</dt><dd>{draft.CURRENCY || "—"} {draft.AMOUNT != null && draft.AMOUNT !== "" ? Number(draft.AMOUNT).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : "—"}<span>{String(draft.BILLING_CYCLE || "Monthly").toLowerCase()}</span></dd></div><div><dt>Next invoice</dt><dd>{enabled && draft.STATUS !== "CLOSED" ? draft.NEXT_BILL_DATE || "Scheduled" : "Not scheduled"}<span>{draft.BILLING_EMAIL || "Billing contact not set"}</span></dd></div></dl>
      <div className="billing-navigation" role="tablist" aria-label="Billing workspace">{[{key:"terms",label:"Subscription terms",Icon:Settings2,count:null},{key:"invoices",label:"Invoices",Icon:Receipt,count:invoices.length},{key:"reminders",label:"Reminders",Icon:Send,count:data.reminders?.length || 0}].map(({key,label,Icon,count})=><button key={key} id={`${tabsId}-${key}-tab`} type="button" role="tab" aria-selected={tab===key} aria-controls={`${tabsId}-${key}`} onClick={()=>setTab(key)}><Icon size={17} />{label}{count!==null && <span>{count}</span>}</button>)}</div>
      <div id={`${tabsId}-terms`} role="tabpanel" aria-labelledby={`${tabsId}-terms-tab`} hidden={tab!=="terms"}>
      <form className="platform-editor" onSubmit={save}><div className="billing-section-title"><Settings2 size={19} /><h3>Subscription terms</h3></div>
        <p className="platform-help">Selecting modules for billing does not grant screen access. Payments are recorded manually; no bank account or card is charged. Deactivate billing before changing commercial terms.</p>
        {!data.emailConfigured && <p className="platform-error">Configure billing SMTP on the server before activation.</p>}
        {data.schedulerEnabled === false && <p className="platform-error">Automatic billing is unavailable while the server scheduler is disabled.</p>}
        <fieldset className="platform-subscription-fields" disabled={saving || enabled || draft.VERSION_NO == null}>
          <label>Billing cycle<select value={draft.BILLING_CYCLE || "MONTHLY"} onChange={e=>set("BILLING_CYCLE",e.target.value)}>{["MONTHLY","QUARTERLY","YEARLY","CUSTOM"].map(v=><option key={v}>{v}</option>)}</select></label>
          {fields.map(([key,title,type])=><label key={key}>{title}<input type={type} value={draft[key] ?? ""} maxLength={key === "CURRENCY" ? 3 : key === "BILLING_EMAIL" ? 254 : 100}
            min={type === "number" ? 0 : undefined} step={key === "AMOUNT" ? "0.01" : type === "number" ? "1" : undefined}
            onChange={e=>set(key,key === "CURRENCY" ? e.target.value.toUpperCase() : e.target.value)} /></label>)}
          {draft.BILLING_CYCLE === "CUSTOM" && <label>Custom cycle length (days)<input type="number" min="1" max="366" value={draft.CUSTOM_DAYS || ""} onChange={e=>set("CUSTOM_DAYS",e.target.value)} /></label>}
          <fieldset className="billing-module-picker platform-field-wide"><legend>Modules covered by this amount</legend>{(data.modules || []).map((code:string)=><label key={code}><input type="checkbox" checked={String(draft.MODULE_CODES || "").split(",").includes(code)} onChange={e=>{
            const modules=String(draft.MODULE_CODES || "").split(",").filter(Boolean);set("MODULE_CODES",(e.target.checked ? [...new Set([...modules,code])] : modules.filter(m=>m!==code)).join(","));
          }} /> {code}</label>)}</fieldset>
          <label className="platform-field-wide">Notes<textarea rows={3} maxLength={1000} value={draft.NOTES || ""} onChange={e=>set("NOTES",e.target.value)} /></label>
          <div className="platform-editor-actions"><Button type="submit" disabled={saving || enabled || draft.VERSION_NO == null}>Save billing settings</Button></div>
        </fieldset>
      </form>
      </div>
      {enabled && data.canManage && <div className="billing-actions">
        <Button variant="outline" disabled={saving} onClick={()=>void run(()=>api.post(`${base}/billing/run${query}`),"Invoice and reminder schedule checked.")}>Process due invoices</Button>
        <Button variant="outline" disabled={saving} onClick={()=>setAction(draft.SUSPENDED === "Y" ? "restore" : "suspend")}>{draft.SUSPENDED === "Y" ? "Restore module access" : "Suspend after grace period"}</Button>
        {draft.STATUS !== "CLOSED" && <Button variant="outline" disabled={saving} onClick={()=>setAction("cancel")}>Stop future renewals</Button>}
      </div>}
      <div className="billing-history" id={`${tabsId}-invoices`} role="tabpanel" aria-labelledby={`${tabsId}-invoices-tab`} hidden={tab!=="invoices"}><div className="billing-invoice-toolbar"><div><h3>Invoices</h3><p>{invoices.length} invoices · {invoices.filter(i=>i.STATUS!=="PAID").length} awaiting payment</p></div><div className="billing-filters"><label className="billing-search"><Search size={16} /><input aria-label="Search invoices" placeholder="Search invoice, plan or module" value={search} onChange={e=>setSearch(e.target.value)} /></label><select aria-label="Invoice payment status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="OVERDUE">Overdue</option><option value="PAID">Paid</option></select></div></div>
        <p className="platform-help">Suspension after the grace period requires PRODADMIN confirmation. Payment restores access when no overdue invoices remain.</p>
        {data.invoices?.length ? <div className="billing-table-scroll"><table><thead><tr>{["Invoice","Period","Amount","Due / grace ends","Status","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filteredInvoices.map((i:Row)=><tr key={i.INVOICE_ID}>
          <td>INV-{i.INVOICE_ID}</td><td>{i.PERIOD_START} – {i.PERIOD_END}</td><td>{i.CURRENCY} {Number(i.AMOUNT).toFixed(2)}</td><td>{i.DUE_DATE}<br /><small>{i.GRACE_END}</small></td>
          <td><span className={`billing-status billing-status-${invoiceStatus(i).toLowerCase()}`}>{i.STATUS === "PAID" ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{i.STATUS === "PAID" ? "Paid" : data.today > i.GRACE_END ? "Overdue · grace ended" : data.today > i.DUE_DATE ? "Overdue" : "Pending"}</span></td>
          <td><div className="billing-actions"><Button size="sm" variant="outline" onClick={()=>setView(i)}><FileText size={14} />View invoice</Button>{i.STATUS !== "PAID" && data.canManage && <Button size="sm" disabled={saving} onClick={()=>{setReference("");setPaidOn(data.today);setPayment(i);}}><CreditCard size={14} />Record payment</Button>}</div></td>
        </tr>)}{!filteredInvoices.length && <tr><td colSpan={6} className="billing-filter-empty">No invoices match your search. <button type="button" onClick={()=>{setSearch("");setFilter("ALL");}}>Clear filters</button></td></tr>}</tbody></table></div> : <div className="billing-empty"><Receipt size={34} /><h4>Your invoice history starts here</h4><p>Invoices appear after billing is activated and the selected start date arrives.</p><Button variant="outline" onClick={()=>setTab("terms")}>Review subscription terms</Button></div>}
      </div>
      <div className="billing-history" id={`${tabsId}-reminders`} role="tabpanel" aria-labelledby={`${tabsId}-reminders-tab`} hidden={tab!=="reminders"}><h3>In-app reminders & email delivery</h3>{data.reminders?.length ? <div className="billing-table-scroll"><table><thead><tr><th>Invoice</th><th>Reminder</th><th>Contact</th><th>Email status</th></tr></thead><tbody>{data.reminders.map((r:Row)=><tr key={r.REMINDER_ID}><td>INV-{r.INVOICE_ID}</td><td>{String(r.KIND).replace(/_/g," ")}</td><td>{r.EMAIL_TO}</td><td><span className={`billing-status ${r.EMAIL_STATUS==="SENT" ? "billing-status-paid" : r.EMAIL_STATUS==="FAILED" ? "billing-status-overdue" : "billing-status-pending"}`}>{r.EMAIL_STATUS}</span>{r.LAST_ERROR && <small className="platform-error"> {r.LAST_ERROR}</small>}</td></tr>)}</tbody></table></div> : <div className="billing-empty"><Send size={30} /><h4>No reminders to follow up</h4><p>Invoice, overdue and grace-expiry reminders will appear here, together with their email delivery status.</p></div>}</div>
    </>}
    <ConfirmDialog open={Boolean(action)} title={labels[action || ""] || "Confirm billing change"} description={`${company} / ${tenant}`} actionLabel={labels[action || ""] || "Confirm"}
      tone={["deactivate","suspend","cancel"].includes(action || "") ? "danger" : "default"} onClose={()=>setAction(null)} onConfirm={()=>{
        const selected=action;setAction(null);if(selected) void run(()=>api.post(`${base}/billing/control${query}`,{action:selected,version:draft.VERSION_NO}),"Billing action completed.",()=>{if(selected==="activate")setTab("invoices");});
      }}>
      <p>{action === "activate" ? `Activate ${draft.MODULE_CODES || "no modules"} for ${draft.CURRENCY || ""} ${draft.AMOUNT || ""} per ${draft.BILLING_CYCLE || ""}, starting ${draft.START_DATE || "no date selected"}. Invoices and reminders will be emailed to ${draft.BILLING_EMAIL || "no billing contact"}. Grace period: ${draft.GRACE_DAYS ?? 7} days after payment is due. Suspension is a separate manual action.`
        : action === "deactivate" ? "Stop future invoices, reminders and billing-related restrictions. Keep all invoices and payments in history."
        : action === "suspend" ? "Suspend the selected modules for this company's users. An invoice must be unpaid beyond its grace period. Support and security administration remain available."
        : action === "cancel" ? "Stop future renewals. Module access ends after the last invoiced period. Existing unpaid invoices remain payable."
        : "Restore access after overdue invoices are paid. Other screen permissions remain unchanged."}</p>
    </ConfirmDialog>
    <Dialog open={Boolean(payment)} title="Record invoice payment" description={payment ? `INV-${payment.INVOICE_ID} · ${payment.CURRENCY} ${Number(payment.AMOUNT).toFixed(2)}` : ""} onClose={()=>setPayment(null)}
      footer={<><Button variant="outline" onClick={()=>setPayment(null)}>Cancel</Button><Button disabled={!reference.trim() || !paidOn || saving} onClick={()=>{
        const invoice=payment;setPayment(null);if(invoice) void run(()=>api.post(`${base}/billing/invoices/${invoice.INVOICE_ID}/pay${query}`,{reference,paidOn}),"Payment recorded. Access is restored when no overdue invoices remain.");
      }}>Confirm payment received</Button></>}>
      <p>Record full payment already received. This does not collect money.</p><label>Payment reference<input maxLength={100} value={reference} onChange={e=>setReference(e.target.value)} /></label><label>Payment date<input type="date" max={data.today} value={paidOn} onChange={e=>setPaidOn(e.target.value)} /></label>
    </Dialog>
    <Dialog open={Boolean(view)} title={`Subscription invoice INV-${view?.INVOICE_ID || ""}`} onClose={()=>setView(null)} footer={<Button onClick={()=>window.print()}>Print invoice</Button>}>
      {view && <article className="billing-invoice-print"><h2>Subscription invoice INV-{view.INVOICE_ID}</h2><p>Company: {company}<br />Tenant: {tenant}</p><p>{view.PLAN_NAME} · {view.MODULE_CODES}</p><p>Period: {view.PERIOD_START} to {view.PERIOD_END}<br />Due: {view.DUE_DATE}</p><h3>{view.CURRENCY} {Number(view.AMOUNT).toFixed(2)}</h3><p>Status: {view.STATUS}{view.PAID_ON ? ` · Paid on ${view.PAID_ON}` : ""}</p>{view.PAYMENT_REFERENCE && <p>Payment reference: {view.PAYMENT_REFERENCE}</p>}</article>}
    </Dialog>
  </section>;
}
