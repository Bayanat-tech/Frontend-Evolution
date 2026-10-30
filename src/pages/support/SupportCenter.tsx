import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Download, Headphones, ImagePlus, MessageSquare, Paperclip, Plus, RefreshCw, Search, Send, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { supportApi, supportMessage, type Ticket, type Message, type Upload, type Attachment } from '../../api/support';
import { useAuth } from '../../state/AuthContext';
import { useSupport } from '../../components/SupportProvider';
import { api } from '../../api/client';
import './support.css';

const labels: Record<string, string> = { OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', WAITING_INFO: 'Waiting for information', RESOLVED: 'Awaiting admin review', CLOSED: 'Closed', REOPENED: 'Reopened' };
const date = (s?: string) => s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not set';
const overdue = (t: Ticket) => !!t.DUE_AT && !['RESOLVED', 'CLOSED'].includes(t.STATUS) && new Date(t.DUE_AT).getTime() < Date.now();
const status = (s: string) => <span className={`sup-status s-${s.toLowerCase()}`}>{labels[s] || s}</span>;
const supportApiDelete = (ticket: number, message: number) => api.delete(`/api/support/tickets/${ticket}/messages/${message}`);

export function SupportLauncher() {
    const { role, unread } = useSupport();
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const button = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                button.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <>
            <button
                ref={button}
                type="button"
                className="sup-launch"
                aria-label="Help & Support"
                title="Help & Support"
                onClick={() => setOpen(true)}
            >
                <Headphones size={18} />
                {unread > 0 && (
                    <span className="sup-launch-count" aria-label={`${unread} unread support messages`}>
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>
            {open &&
                createPortal(
                    <div className="sup-drawer-wrap">
                        <button
                            className="sup-backdrop"
                            aria-label="Close support"
                            onClick={() => {
                                setOpen(false);
                                button.current?.focus();
                            }}
                        />
                        <div
                            className="sup-drawer"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Support chat"
                            onKeyDown={(e) => {
                                if (e.key !== 'Tab') return;
                                const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                                    'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]'
                                );
                                const first = nodes[0],
                                    last = nodes[nodes.length - 1];
                                if (e.shiftKey && document.activeElement === first) {
                                    e.preventDefault();
                                    last?.focus();
                                } else if (!e.shiftKey && document.activeElement === last) {
                                    e.preventDefault();
                                    first?.focus();
                                }
                            }}
                        >
                            <SupportCenter
                                compact
                                onClose={() => {
                                    setOpen(false);
                                    button.current?.focus();
                                }}
                            />
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}

export function SupportCenter({ compact = false, onClose }: {
    compact?: boolean;
    onClose?: () => void;
}) {
    const { user } = useAuth(), { role, ready } = useSupport(), location = useLocation();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]), [selected, setSelected] = useState<number | null>(null), [messages, setMessages] = useState<Message[]>([]), [events, setEvents] = useState<any[]>([]);
    const [typing, setTyping] = useState('');
    const [query, setQuery] = useState(''), [filter, setFilter] = useState('active'), [newIssue, setNewIssue] = useState(false), [drafts, setDrafts] = useState<Record<string, {
        text: string;
        subject: string;
        files: Upload[];
    }>>({});
    const [busy, setBusy] = useState(false), [fetching, setFetching] = useState(false), [notice, setNotice] = useState(''), [noticeGood, setNoticeGood] = useState(false), [developers, setDevelopers] = useState<any[]>([]), [developer, setDeveloper] = useState(''), [priority, setPriority] = useState('NORMAL'), [estimate, setEstimate] = useState('480'), [resolution, setResolution] = useState(''), [showHistory, setShowHistory] = useState(false), [mobileThread, setMobileThread] = useState(false), [readingFiles, setReadingFiles] = useState(false);
    const [teamLogin, setTeamLogin] = useState(''), [skills, setSkills] = useState(''), [settings, setSettings] = useState<{
        contacts: any[];
        queue: any[];
    }>({ contacts: [], queue: [] }), [contact, setContact] = useState({ email_id: '', display_name: '' });
    const ticket = tickets.find(t => t.TICKET_ID === selected), draftKey = newIssue ? 'new' : String(selected || 'none'), draft = drafts[draftKey] || { text: '', subject: '', files: [] };
    const selectedRef = useRef(selected), request = useRef(0), tail = useRef<HTMLDivElement>(null), file = useRef<HTMLInputElement>(null), close = useRef<HTMLButtonElement>(null), textInput = useRef<HTMLTextAreaElement>(null);
    selectedRef.current = selected;
    const listRequest = useRef(0);
    useEffect(() => {
        ++listRequest.current; ++request.current;
        setTickets([]); setMessages([]); setSelected(null); setNewIssue(false); setDrafts({}); setDevelopers([]);
        setSettings({contacts:[],queue:[]});
    }, [user?.loginid,user?.tenantId,user?.company_code]);
    useEffect(() => { let timer: ReturnType<typeof setTimeout>; const update = (e: Event) => { const p = (e as CustomEvent).detail; if (p.ticketId !== selectedRef.current || p.loginid === user?.loginid)
        return; setTyping(p.typing ? (p.username || p.loginid) + ' is typing...' : ''); clearTimeout(timer); if (p.typing)
        timer = setTimeout(() => setTyping(''), 3000); }; window.addEventListener('support:typing-updated', update); return () => { clearTimeout(timer); window.removeEventListener('support:typing-updated', update); }; }, [user?.loginid]);
    const tab = compact ? 'tickets' : location.pathname.endsWith('/team') ? 'team' : location.pathname.endsWith('/settings') ? 'settings' : location.pathname.endsWith('/reports') ? 'reports' : 'tickets';
    const patch = (v: Partial<typeof draft>) => setDrafts(d => ({ ...d, [draftKey]: { ...draft, ...v } }));
    const refresh = useCallback(async () => {
        const seq=++listRequest.current; setFetching(true); try {
        const t = await supportApi.tickets(role);
        if(seq===listRequest.current) setTickets(t);
    }
    catch (e) {
        setNoticeGood(false);
        setNotice(supportMessage(e));
    }
    finally {
        if(seq===listRequest.current) setFetching(false);
    } }, [role, user?.loginid, user?.tenantId, user?.company_code]);
    useEffect(() => { void refresh(); const update = () => void refresh(); window.addEventListener('support:updated', update); const timer = setInterval(update, 15000); return () => { clearInterval(timer); window.removeEventListener('support:updated', update); }; }, [refresh]);
    useEffect(() => { if (role !== 'admin')
        return; void supportApi.developers().then(setDevelopers).catch(e => setNotice(supportMessage(e))); if (tab === 'settings')
        void supportApi.settings().then(setSettings).catch(e => setNotice(supportMessage(e))); }, [role, tab]);
    const loadMessages = useCallback(async () => { if (!selectedRef.current)
        return; const id = selectedRef.current, seq = ++request.current; try {
        const m = await supportApi.messages(id);
        if (seq !== request.current || selectedRef.current !== id)
            return;
        setMessages(m);
        if (document.visibilityState === 'visible' && m.length)
            void supportApi.read(id, m[m.length - 1].MESSAGE_ID).then(() => { setTickets(t => t.map(x => x.TICKET_ID === id ? { ...x, UNREAD_COUNT: 0 } : x)); window.dispatchEvent(new Event('support:read')); }).catch(() => undefined);
    }
    catch (e) {
        if (selectedRef.current === id)
            setNotice(supportMessage(e));
    } }, []);
    useEffect(() => { setMessages([]); setEvents([]); setTyping(''); setResolution(''); setShowHistory(false); if (!selected || newIssue)
        return; void loadMessages(); const timer = setInterval(() => void loadMessages(), 15000); const update = () => void loadMessages(); window.addEventListener('support:updated', update); document.addEventListener('visibilitychange', update); return () => { ++request.current; clearInterval(timer); window.removeEventListener('support:updated', update); document.removeEventListener('visibilitychange', update); }; }, [selected, newIssue, loadMessages]);
    useEffect(() => { setDeveloper(ticket?.DEVELOPER_LOGINID || ''); setPriority(ticket?.PRIORITY || 'NORMAL'); setEstimate(String(ticket?.SLA_MINUTES || 480)); }, [selected, ticket?.DEVELOPER_LOGINID]);
    useEffect(() => { tail.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
    useEffect(() => { if (compact)
        close.current?.focus(); }, [compact]);
    const run = async (fn: () => Promise<any>, success: string) => { if (busy)
        return; setBusy(true); setNotice(''); try {
        await fn();
        setNoticeGood(true);
        setNotice(success);
        await refresh();
        if (selectedRef.current)
            await loadMessages();
    }
    catch (e) {
        setNoticeGood(false);
        setNotice(supportMessage(e));
    }
    finally {
        setBusy(false);
    } };
    const send = () => {
        const id = selected, key = draftKey, body = { message: draft.text.trim(), attachments: draft.files };
        if (!body.message.trim()) return;
        void run(async () => {
            if (newIssue) {
                const subject = draft.subject.trim() || draft.text.trim().slice(0, 80) || 'Support Request';
                const c = await supportApi.create({
                    ...body,
                    subject,
                    module: location.pathname.split('/')[2] || 'Workspace',
                    page_url: location.pathname
                });
                setNewIssue(false);
                setSelected(c.ticketId);
                setMobileThread(true);
            } else if (id) {
                await supportApi.reply(id, body);
            }
            setDrafts(d => ({ ...d, [key]: { text: '', subject: '', files: [] } }));
        }, newIssue ? 'Ticket created. Support has been notified.' : 'Reply sent.');
    };
    const attach = async (files: File[]) => { setReadingFiles(true); setNotice(''); try {
        if (files.length + draft.files.length > 5)
            throw Error('Attach up to five files.');
        if ([...files, ...draft.files.map(f => ({ size: f.file_size }))].reduce((s, f) => s + f.size, 0) > 15 * 1024 * 1024)
            throw Error('Attachments must total 15 MB or less.');
        const added = await Promise.all(files.map(async (f) => { if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'].includes(f.type) || f.size > 5 * 1024 * 1024 || !f.size)
            throw Error('Use PNG, JPEG, WebP, PDF or text, up to 5 MB per file.'); const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(Error('Unable to read attachment')); r.onload = () => resolve(String(r.result)); r.readAsDataURL(f); }); return { file_name: f.name || 'Screenshot.png', file_type: f.type, file_size: f.size, data_url: data }; }));
        patch({ files: [...draft.files, ...added] });
    }
    catch (e) {
        setNoticeGood(false);
        setNotice(supportMessage(e));
    }
    finally {
        setReadingFiles(false);
    } };
    const paste = (e: ClipboardEvent<HTMLTextAreaElement>) => { const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/')); if (files.length) {
        e.preventDefault();
        void attach(files);
    } };
    const visible = tickets.filter(t => (filter === 'all' || filter === 'active' && !['CLOSED', 'RESOLVED'].includes(t.STATUS) || filter === 'review' && t.STATUS === 'RESOLVED' || filter === 'closed' && t.STATUS === 'CLOSED' || filter === 'overdue' && overdue(t)) && [t.SUBJECT, t.REQUESTER_NAME, t.COMPANY_CODE, t.TENANT_ID, t.TICKET_ID].join(' ').toLowerCase().includes(query.toLowerCase()));
    const select = (t: Ticket) => { if (busy)
        return; setNewIssue(false); setSelected(t.TICKET_ID); setMobileThread(true); setNotice(''); };
    const start = () => { if (busy)
        return; setSelected(null); setNewIssue(true); setMobileThread(true); setNotice(''); setTimeout(() => textInput.current?.focus(), 0); };
    const title = compact ? 'How can we help?' : role === 'admin' ? 'Support desk' : role === 'developer' ? 'Developer workbench' : 'My support tickets';
    return <section className={`sup ${compact ? 'sup-compact' : ''}`}>
  <header className="sup-head">
    <div className="sup-title">
      <span className="sup-brand"><Headphones size={20}/></span>
      <div>
        <h1>{title}</h1>
        <p>{compact ? 'Your issue, updates and resolution in one place.' : role === 'admin' ? 'One queue for every company and tenant.' : role === 'developer' ? 'Reply, track progress and submit resolutions for review.' : 'Track your requests and talk to support.'}</p>
      </div>
    </div>
    <div className="sup-actions">
      <button title="Refresh tickets" aria-label="Refresh tickets" disabled={fetching} onClick={() => void refresh()}>
        <RefreshCw size={16} className={fetching ? 'sup-spin' : ''}/>
      </button>
      <button className="sup-primary" onClick={start} disabled={busy}>
        <Plus size={16}/>New issue
      </button>
      {compact && (role === 'admin' || role === 'developer') && (
        <button
          type="button"
          title="Open full support desk"
          aria-label="Open full support desk"
          onClick={() => {
            if (onClose) onClose();
            navigate(role === 'developer' ? '/workspace/support/support/assigned' : '/workspace/support/support/tickets');
          }}
        >
          Full desk ↗
        </button>
      )}
      {onClose && <button ref={close} onClick={onClose} aria-label="Close support"><X size={19}/></button>}
    </div>
  </header>
  {notice && <div className={`sup-notice ${noticeGood ? 'good' : 'bad'}`} role={noticeGood ? 'status' : 'alert'}>{notice}<button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14}/></button></div>}
  {tab === 'team' && role === 'admin' ? <div className="sup-settings"><h2>Support developers</h2><p>Create the developer's account and default tenant in Security first. Add that existing login here to grant the Support module and assigned-ticket access.</p><form className="sup-form-row" onSubmit={e => { e.preventDefault(); void run(async () => { await supportApi.developer({ loginid: teamLogin, skill_tags: skills }); setDevelopers(await supportApi.developers()); setTeamLogin(''); setSkills(''); }, 'Developer access saved.'); }}><label>Existing login ID<input required value={teamLogin} onChange={e => setTeamLogin(e.target.value)}/></label><label>Skills / modules<input value={skills} onChange={e => setSkills(e.target.value)}/></label><button className="sup-primary" disabled={busy}>Add developer</button></form><div className="sup-table-scroll"><table><thead><tr><th>Developer</th><th>Login</th><th>Tenant / company</th><th>Email from user master</th><th>Active workload</th><th>Access</th></tr></thead><tbody>{developers.map(d => <tr key={d.LOGINID}><td>{d.USERNAME}</td><td>{d.LOGINID}</td><td>{d.TENANT_ID}<br />{d.COMPANY_CODE}</td><td>{d.EMAIL_ID}</td><td>{tickets.filter(t => t.DEVELOPER_LOGINID === d.LOGINID && !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length}</td><td><button disabled={busy} onClick={() => void run(async () => { await supportApi.developer({ loginid: d.LOGINID, active_flag: 'N' }); setDevelopers(await supportApi.developers()); }, 'Developer support access disabled.')}>Disable</button></td></tr>)}</tbody></table></div>{!developers.length && <p>No support developers have been added.</p>}</div>
            : tab === 'settings' && role === 'admin' ? <div className="sup-settings"><h2>Notification recipients</h2><p>New requests, resolutions, reopenings and overdue warnings go to active support contacts. Assignment notifications go to the developer's user-master email.</p><form className="sup-form-row" onSubmit={e => { e.preventDefault(); void run(async () => { await supportApi.contact(contact); setSettings(await supportApi.settings()); setContact({ email_id: '', display_name: '' }); }, 'Support contact saved.'); }}><label>Name<input value={contact.display_name} onChange={e => setContact(c => ({ ...c, display_name: e.target.value }))}/></label><label>Email<input required type="email" value={contact.email_id} onChange={e => setContact(c => ({ ...c, email_id: e.target.value }))}/></label><button className="sup-primary" disabled={busy}>Save contact</button></form>{settings.contacts.map(c => <div className="sup-contact" key={c.EMAIL_ID}><span><strong>{c.DISPLAY_NAME}</strong><br />{c.EMAIL_ID}</span><button disabled={busy} onClick={() => void run(async () => { await supportApi.contact({ ...c, email_id: c.EMAIL_ID, display_name: c.DISPLAY_NAME, active_flag: c.ACTIVE_FLAG === 'Y' ? 'N' : 'Y' }); setSettings(await supportApi.settings()); }, 'Contact updated.')}>{c.ACTIVE_FLAG === 'Y' ? 'Disable' : 'Enable'}</button></div>)}<h2>Email delivery</h2><p>Queued does not mean delivered. Failed deliveries retry automatically up to five times.</p><button onClick={() => void supportApi.settings().then(setSettings).catch(e => setNotice(supportMessage(e)))}>Refresh delivery status</button><div className="sup-table-scroll"><table><thead><tr><th>Ticket</th><th>Notification</th><th>Status</th><th>Attempts</th><th>Last error</th></tr></thead><tbody>{settings.queue.map(q => <tr key={q.EMAIL_ID}><td>#{q.TICKET_ID}</td><td>{q.SUBJECT}<br /><small>{q.RECIPIENTS}</small></td><td>{q.STATUS}</td><td>{q.ATTEMPTS}</td><td>{q.LAST_ERROR || '-'}</td></tr>)}</tbody></table></div></div>
                : tab === 'reports' && role === 'admin' ? <div className="sup-settings"><h2>Service overview</h2><p>Current queue, limited to the latest 500 tickets. Due times remain visible while work is waiting for information.</p><div className="sup-overview">{[['Active', tickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length], ['Awaiting review', tickets.filter(t => t.STATUS === 'RESOLVED').length], ['Overdue', tickets.filter(overdue).length], ['Closed', tickets.filter(t => t.STATUS === 'CLOSED').length]].map(([l, n]) => <span key={l}><strong>{n}</strong>{l}</span>)}</div><div className="sup-table-scroll"><table><thead><tr><th>Company / tenant</th><th>Ticket</th><th>Status</th><th>Developer</th><th>Due</th></tr></thead><tbody>{tickets.map(t => <tr key={t.TICKET_ID}><td>{t.COMPANY_CODE}<br />{t.TENANT_ID}</td><td>#{t.TICKET_ID} · {t.SUBJECT}</td><td>{labels[t.STATUS] || t.STATUS}</td><td>{t.DEVELOPER_NAME || 'Unassigned'}</td><td>{date(t.DUE_AT)}{overdue(t) && ' · Overdue'}</td></tr>)}</tbody></table></div></div>
                    : <div className={`sup-layout ${mobileThread ? 'show-thread' : ''}`}><aside className="sup-inbox"><div className="sup-inbox-tools"><label className="sup-search"><Search size={15}/><input aria-label="Search support tickets" placeholder="Search tickets, company..." value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label="Ticket status filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Active tickets</option><option value="review">Awaiting review</option><option value="overdue">Overdue</option><option value="closed">Closed</option><option value="all">All tickets</option></select><span>{visible.length} tickets</span></div><div className="sup-ticket-list">{visible.map(t => <button disabled={busy} onClick={() => select(t)} key={t.TICKET_ID} className={selected === t.TICKET_ID && !newIssue ? 'selected' : ''}><div><span>#{t.TICKET_ID} · {t.MODULE_NAME || 'Support'}</span><time>{date(t.LAST_MESSAGE_AT)}</time></div><strong>{t.SUBJECT}</strong><p>{t.LAST_MESSAGE || 'New request'}</p><div>{status(t.STATUS)}{t.UNREAD_COUNT > 0 && <b className="sup-unread">{t.UNREAD_COUNT}</b>}{overdue(t) && <span className="sup-overdue"><Clock3 size={12}/>Overdue</span>}</div>{role !== 'user' && <small>{t.REQUESTER_NAME || t.REQUESTER_LOGINID} · {t.COMPANY_CODE}</small>}</button>)}{!visible.length && <div className="sup-empty"><MessageSquare size={26}/><strong>{fetching ? 'Loading tickets...' : 'No tickets in this view'}</strong><p>{role === 'user' ? 'Start a new issue or change the status filter.' : 'Change the filter or wait for a new request.'}</p></div>}</div></aside>
  <main className="sup-thread">{newIssue ? <><div className="sup-thread-head"><button className="sup-mobile-back" aria-label="Back to ticket list" onClick={() => setMobileThread(false)}><ArrowLeft size={17}/></button><div><h2>Tell us what went wrong</h2><p>{user?.username || user?.loginid} · {user?.company_code}</p></div></div><div className="sup-new"><label>Issue subject <span>Optional (defaults to description)</span><input maxLength={300} value={draft.subject} onChange={e => patch({ subject: e.target.value })} placeholder="For example: Purchase invoice will not save"/></label><p>Include what you tried, the result you expected and any document number. Please keep passwords and payment-card details out of screenshots.</p></div></> : ticket ? <><div className="sup-thread-head"><button className="sup-mobile-back" aria-label="Back to ticket list" onClick={() => setMobileThread(false)}><ArrowLeft size={17}/></button><div><span>Ticket #{ticket.TICKET_ID} · {ticket.PRIORITY}</span><h2>{ticket.SUBJECT}</h2><p>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} · {ticket.COMPANY_CODE} · {ticket.TENANT_ID}</p></div>{status(ticket.STATUS)}</div><div className="sup-ticket-meta"><span><Users size={14}/>{ticket.DEVELOPER_NAME || 'Awaiting assignment'}</span><span className={overdue(ticket) ? 'sup-overdue' : ''}><Clock3 size={14}/>{ticket.DUE_AT ? `Due ${date(ticket.DUE_AT)}` : 'No estimate set'}</span><button onClick={() => { setShowHistory(v => !v); void supportApi.events(ticket.TICKET_ID).then(setEvents).catch(e => setNotice(supportMessage(e))); }}>Activity</button></div>{showHistory && <div className="sup-history">{events.map(e => <p key={e.EVENT_ID}><strong>{e.EVENT_TYPE.replaceAll('_', ' ')}</strong> · {e.ACTOR_LOGINID}<small>{date(e.CREATED_AT)}</small><span>{e.EVENT_TEXT}</span></p>)}{!events.length && <p>No recorded activity for this legacy ticket.</p>}</div>}{role === 'admin' && !['CLOSED', 'RESOLVED'].includes(ticket.STATUS) && <form className="sup-assignment" onSubmit={e => { e.preventDefault(); void run(() => supportApi.assign(ticket.TICKET_ID, { developer_loginid: developer, priority, sla_minutes: Number(estimate) }), 'Assigned. The developer notification is queued.'); }}><label>Developer<select required value={developer} onChange={e => setDeveloper(e.target.value)}><option value="">Select developer</option>{developers.map(d => <option key={d.LOGINID} value={d.LOGINID}>{d.USERNAME || d.LOGINID}</option>)}</select></label><label>Priority<select value={priority} onChange={e => setPriority(e.target.value)}>{['LOW', 'NORMAL', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p}>{p}</option>)}</select></label><label>Estimate (minutes)<input required type="number" min={1} max={43200} value={estimate} onChange={e => setEstimate(e.target.value)}/></label><button className="sup-primary" disabled={busy || !developer}>Assign</button></form>}
    <div className="sup-messages" aria-live="polite" aria-label="Ticket messages">{messages.map(m => <article key={m.MESSAGE_ID} className={`sup-message ${m.SENDER_ROLE === 'SYSTEM' ? 'system' : m.SENDER_LOGINID.toUpperCase() === user?.loginid?.toUpperCase() && m.SENDER_TENANT_ID === user?.tenantId ? 'mine' : ''}`}><div><strong>{m.SENDER_ROLE === 'SYSTEM' ? 'Ticket update' : m.SENDER_NAME || m.SENDER_LOGINID}</strong><time>{date(m.CREATED_AT)}</time></div><p>{m.MESSAGE_TEXT}</p>{m.attachments.map(a => <AttachmentLink key={a.ATTACHMENT_ID} attachment={a} ticketId={ticket.TICKET_ID}/>)}{m.IS_DELETED !== 'Y' && m.SENDER_ROLE !== 'SYSTEM' && m.SENDER_LOGINID.toUpperCase() === user?.loginid?.toUpperCase() && m.SENDER_TENANT_ID === user?.tenantId && <button className="sup-message-delete" aria-label="Delete your message" disabled={busy} onClick={() => { if (window.confirm('Delete your message?'))
                             void run(() => supportApiDelete(ticket.TICKET_ID, m.MESSAGE_ID), 'Message deleted.'); }}><Trash2 size={12}/></button>}</article>)}{!messages.length && <p className="sup-thread-placeholder">Loading conversation...</p>}{typing && <p className="sup-typing" role="status">{typing}</p>}<div ref={tail}/></div>
    {ticket.STATUS === 'RESOLVED' && <div className="sup-resolution"><CheckCircle2 size={18}/><div><strong>Resolution submitted</strong><p>{ticket.RESOLUTION}</p>{role === 'admin' && <button className="sup-primary" disabled={busy} onClick={() => void run(() => supportApi.update(ticket.TICKET_ID, { status: 'CLOSED' }), 'Ticket closed. Support contacts have been notified.')}>Approve and close</button>}</div></div>}
    {role === 'developer' && ticket.DEVELOPER_LOGINID === user?.loginid?.toUpperCase() && !['CLOSED', 'RESOLVED'].includes(ticket.STATUS) && <div className="sup-progress"><div className="sup-actions"><button disabled={busy} onClick={() => void run(() => supportApi.progress(ticket.TICKET_ID, 'IN_PROGRESS'), 'Progress updated.')}>Start work</button><button disabled={busy} onClick={() => void run(() => supportApi.progress(ticket.TICKET_ID, 'WAITING_INFO'), 'Progress updated.')}>Waiting for information</button></div><label>Resolution for admin review<textarea value={resolution} maxLength={2000} onChange={e => setResolution(e.target.value)} placeholder="Describe the fix and how it was verified"/></label><button disabled={busy || !resolution.trim()} className="sup-primary" onClick={() => void run(() => supportApi.update(ticket.TICKET_ID, { status: 'RESOLVED', resolution }), 'Resolution submitted. Support admins have been notified.')}>Submit resolution</button></div>}
    {['CLOSED', 'RESOLVED'].includes(ticket.STATUS) && (role === 'user' || role === 'admin') && <div className="sup-progress"><label>Issue still not resolved?<textarea maxLength={2000} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Explain what still needs attention"/></label><button disabled={busy || !resolution.trim()} onClick={() => void run(() => supportApi.update(ticket.TICKET_ID, { status: 'REOPENED', reason: resolution }), 'Ticket reopened. Support has been notified.')}>Reopen ticket</button></div>}
   </> : <div className="sup-empty sup-welcome"><Headphones size={32}/><h2>{role === 'user' ? 'Help is a conversation away' : 'Select a ticket to get started'}</h2><p>{role === 'user' ? 'Raise an issue with comments and screenshots. Your company and screen details are included automatically.' : 'Review the issue, assign an owner and keep the requester informed.'}</p><button className="sup-primary" onClick={start}><Plus size={16}/>New issue</button></div>}
  {(newIssue || ticket && ticket.STATUS !== 'CLOSED') && <div className="sup-compose"><label htmlFor="support-message">{newIssue ? 'Comments / issue details · Required' : 'Reply · Required'}</label><textarea ref={textInput} id="support-message" maxLength={8000} value={draft.text} onChange={e => { patch({ text: e.target.value }); if (selected)
                        window.dispatchEvent(new CustomEvent('support:typing-request', { detail: { ticketId: selected, typing: !!e.target.value.trim() } })); }} onPaste={paste} placeholder={newIssue ? 'Describe the issue and steps to reproduce it...' : 'Write a reply...'} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        if (!busy && !readingFiles && draft.text.trim())
                            send();
                    } }}/>{draft.files.length > 0 && <div className="sup-files">{draft.files.map((f, i) => <span key={i}><Paperclip size={12}/>{f.file_name}<button aria-label={`Remove ${f.file_name}`} onClick={() => patch({ files: draft.files.filter((_, n) => n !== i) })}><X size={12}/></button></span>)}</div>}<div className="sup-compose-actions"><input ref={file} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => { void attach(Array.from(e.target.files || [])); e.target.value = ''; }}/><button disabled={readingFiles || busy} onClick={() => file.current?.click()}><ImagePlus size={16}/>{readingFiles ? 'Reading...' : 'Attach'}</button><small>Paste screenshots · 5 MB/file</small><button className="sup-primary" disabled={busy || readingFiles || !draft.text.trim()} onClick={send}><Send size={15}/>{busy ? 'Saving...' : newIssue ? 'Submit issue' : 'Send'}</button></div></div>}
  </main></div>}
 </section>;
}

function AttachmentLink({ attachment: a, ticketId }: {
    attachment: Attachment;
    ticketId: number;
}) { const [url, setUrl] = useState(''), [error, setError] = useState(''); useEffect(() => { let active = true, obj = ''; if (!a.FILE_TYPE.startsWith('image/'))
    return; void supportApi.attachment(ticketId, a.ATTACHMENT_ID).then(r => { obj = URL.createObjectURL(r.data); if (active)
    setUrl(obj);
else
    URL.revokeObjectURL(obj); }).catch(() => { if (active)
    setError('Preview unavailable'); }); return () => { active = false; if (obj)
    URL.revokeObjectURL(obj); }; }, [ticketId, a.ATTACHMENT_ID]); const download = async () => { try {
    const r = await supportApi.attachment(ticketId, a.ATTACHMENT_ID), u = URL.createObjectURL(r.data), link = document.createElement('a');
    link.href = u;
    link.download = a.FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
}
catch (e) {
    setError(supportMessage(e));
} }; return <div className="sup-attachment">{url && <img src={url} alt={a.FILE_NAME}/>}<button onClick={() => void download()}><Download size={13}/>{a.FILE_NAME}</button>{error && <small role="alert">{error}</small>}</div>; }
