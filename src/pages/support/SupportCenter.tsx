import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Headphones,
  ImagePlus,
  LayoutDashboard,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  AlertCircle
} from 'lucide-react';
import { supportApi, supportMessage, playSupportNotificationSound, type Ticket, type Message, type Upload, type Attachment } from '../../api/support';
import { useAuth } from '../../state/AuthContext';
import { useSupport } from '../../components/SupportProvider';
import { api } from '../../api/client';
import './support.css';

const labels: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  WAITING_INFO: 'Waiting info',
  RESOLVED: 'Dev Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened'
};

const dateFmt = (s?: string) => {
  if (!s) return 'Not set';
  const d = new Date(s);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const overdue = (t: Ticket) =>
  !!t.DUE_AT && !['RESOLVED', 'CLOSED'].includes(t.STATUS) && new Date(t.DUE_AT).getTime() < Date.now();

const statusBadge = (s: string) => (
  <span className={`sup-status s-${s.toLowerCase()}`}>{labels[s] || s}</span>
);

const getUserInitials = (name?: string) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const supportApiDelete = (ticket: number, message: number) =>
  api.delete(`/api/support/tickets/${ticket}/messages/${message}`);

export function SupportLauncher() {
  const { role, unread } = useSupport();
  const [open, setOpen] = useState(false);
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
            <div className="sup-drawer" role="dialog" aria-modal="true" aria-label="Support Desk">
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

export function SupportCenter({ compact = false, onClose }: { compact?: boolean; onClose?: () => void }) {
  const { user } = useAuth();
  const { role } = useSupport();
  const location = useLocation();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [typing, setTyping] = useState('');

  // Filters
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [newIssue, setNewIssue] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { text: string; subject: string; files: Upload[] }>>({});
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeGood, setNoticeGood] = useState(false);

  // Assignment & Dev state
  const [developers, setDevelopers] = useState<any[]>([]);
  const [developer, setDeveloper] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [estimate, setEstimate] = useState('480');
  const [resolution, setResolution] = useState('');
  const [closingRemark, setClosingRemark] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);

  // Settings & Team
  const [teamLogin, setTeamLogin] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [skills, setSkills] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [settings, setSettings] = useState<{ contacts: any[]; queue: any[] }>({ contacts: [], queue: [] });
  const [contact, setContact] = useState({ email_id: '', display_name: '' });

  // User compact 2-tab view
  const [compactTab, setCompactTab] = useState<'tickets' | 'chat'>('tickets');
  const [liveChatMessages, setLiveChatMessages] = useState<any[]>([]);
  const [liveChatText, setLiveChatText] = useState('');

  // Dashboard Tab sub-view
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'workload'>('overview');

  const ticket = tickets.find(t => t.TICKET_ID === selected);
  const draftKey = newIssue ? 'new' : String(selected || 'none');
  const draft = drafts[draftKey] || { text: '', subject: '', files: [] };
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const request = useRef(0);
  const tail = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);

  // Tab detection
  const tab = useMemo(() => {
    if (compact) return 'tickets';
    if (location.pathname.endsWith('/dashboard')) return 'dashboard';
    if (location.pathname.endsWith('/team')) return 'team';
    if (location.pathname.endsWith('/reports')) return 'reports';
    if (location.pathname.endsWith('/settings')) return 'settings';
    if (location.pathname.endsWith('/assigned')) return 'assigned';
    return role === 'admin' && location.pathname.endsWith('/tickets') ? 'tickets' : role === 'admin' ? 'dashboard' : 'tickets';
  }, [compact, location.pathname, role]);

  const patch = (v: Partial<typeof draft>) => setDrafts(d => ({ ...d, [draftKey]: { ...draft, ...v } }));

  const refresh = useCallback(async (isBackground = false) => {
    if (!isBackground) setFetching(true);
    try {
      const t = await supportApi.tickets(role);
      setTickets(prev => {
        // Play notification if a new unread arrives
        const prevUnread = prev.reduce((acc, curr) => acc + (curr.UNREAD_COUNT || 0), 0);
        const newUnread = t.reduce((acc, curr) => acc + (curr.UNREAD_COUNT || 0), 0);
        if (newUnread > prevUnread) {
          playSupportNotificationSound();
        }
        return t;
      });
    } catch (e) {
      if (!isBackground) {
        setNoticeGood(false);
        setNotice(supportMessage(e));
      }
    } finally {
      if (!isBackground) setFetching(false);
    }
  }, [role]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(true), 15000);
    const onUpdated = () => void refresh(true);
    window.addEventListener('support:updated', onUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('support:updated', onUpdated);
    };
  }, [refresh]);

  useEffect(() => {
    if (role === 'admin') {
      void supportApi.developers().then(setDevelopers).catch(() => undefined);
      void supportApi.candidateDevelopers().then(setCandidates).catch(() => undefined);
      if (tab === 'settings') {
        void supportApi.settings().then(setSettings).catch(() => undefined);
      }
    }
  }, [role, tab]);

  const loadMessages = useCallback(async () => {
    if (!selectedRef.current) return;
    const id = selectedRef.current;
    const seq = ++request.current;
    try {
      const m = await supportApi.messages(id);
      if (seq !== request.current || selectedRef.current !== id) return;
      setMessages(m);
      if (document.visibilityState === 'visible' && m.length) {
        void supportApi.read(id, m[m.length - 1].MESSAGE_ID).then(() => {
          setTickets(t => t.map(x => (x.TICKET_ID === id ? { ...x, UNREAD_COUNT: 0 } : x)));
          window.dispatchEvent(new Event('support:read'));
        }).catch(() => undefined);
      }
    } catch (e) {
      if (selectedRef.current === id) setNotice(supportMessage(e));
    }
  }, []);

  useEffect(() => {
    setMessages([]);
    setEvents([]);
    setTyping('');
    setResolution('');
    setShowHistory(false);
    setShowCloseModal(false);
    if (!selected || newIssue) return;
    void loadMessages();
    const timer = setInterval(() => void loadMessages(), 10000);
    const update = () => void loadMessages();
    window.addEventListener('support:updated', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('support:updated', update);
    };
  }, [selected, newIssue, loadMessages]);

  useEffect(() => {
    setDeveloper(ticket?.DEVELOPER_LOGINID || '');
    setPriority(ticket?.PRIORITY || 'NORMAL');
    setEstimate(String(ticket?.SLA_MINUTES || 480));
  }, [selected, ticket?.DEVELOPER_LOGINID]);

  useEffect(() => {
    tail.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const run = async (fn: () => Promise<any>, successMsg: string) => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      await fn();
      setNoticeGood(true);
      setNotice(successMsg);
      await refresh();
      if (selectedRef.current) await loadMessages();
    } catch (e) {
      setNoticeGood(false);
      setNotice(supportMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const id = selected;
    const key = draftKey;
    const body = { message: draft.text.trim(), attachments: draft.files };
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
    }, newIssue ? 'Ticket created. Support team notified.' : 'Reply sent.');
  };

  // Close ticket handler for Admin
  const handleCloseTicket = (ticketId: number, remark?: string) => {
    void run(async () => {
      await supportApi.update(ticketId, { status: 'CLOSED', resolution: remark || 'Closed by Admin' });
      setShowCloseModal(false);
      setClosingRemark('');
    }, 'Ticket successfully closed.');
  };

  // Developer resolution submit
  const handleDeveloperResolve = (ticketId: number) => {
    if (!resolution.trim()) return;
    void run(async () => {
      await supportApi.update(ticketId, { status: 'RESOLVED', resolution });
    }, 'Resolution submitted. Awaiting Admin final closure.');
  };

  const attach = async (files: File[]) => {
    setReadingFiles(true);
    setNotice('');
    try {
      if (files.length + draft.files.length > 5) throw Error('Attach up to 5 files.');
      const added = await Promise.all(
        files.map(async f => {
          if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'].includes(f.type) || f.size > 5 * 1024 * 1024 || !f.size) {
            throw Error('Allowed formats: PNG, JPEG, WebP, PDF or text up to 5 MB.');
          }
          const data = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onerror = () => reject(Error('Unable to read attachment'));
            r.onload = () => resolve(String(r.result));
            r.readAsDataURL(f);
          });
          return { file_name: f.name || 'Screenshot.png', file_type: f.type, file_size: f.size, data_url: data };
        })
      );
      patch({ files: [...draft.files, ...added] });
    } catch (e) {
      setNoticeGood(false);
      setNotice(supportMessage(e));
    } finally {
      setReadingFiles(false);
    }
  };

  const paste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      void attach(files);
    }
  };

  // Month & Year filtering
  const visible = useMemo(() => {
    return tickets.filter(t => {
      // Query filter
      const matchesQuery = [t.SUBJECT, t.REQUESTER_NAME, t.COMPANY_CODE, t.TENANT_ID, String(t.TICKET_ID)]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
      if (!matchesQuery) return false;

      // Status filter
      if (statusFilter === 'active' && ['CLOSED', 'RESOLVED'].includes(t.STATUS)) return false;
      if (statusFilter === 'review' && t.STATUS !== 'RESOLVED') return false;
      if (statusFilter === 'closed' && t.STATUS !== 'CLOSED') return false;
      if (statusFilter === 'overdue' && !overdue(t)) return false;

      // Priority filter
      if (priorityFilter !== 'all' && t.PRIORITY !== priorityFilter) return false;

      // Developer filter
      if (developerFilter !== 'all' && t.DEVELOPER_LOGINID !== developerFilter) return false;

      // Year & Month filter
      if (yearFilter !== 'all' || monthFilter !== 'all') {
        const ticketDate = new Date(t.CREATED_AT || t.LAST_MESSAGE_AT);
        if (yearFilter !== 'all' && String(ticketDate.getFullYear()) !== yearFilter) return false;
        if (monthFilter !== 'all' && String(ticketDate.getMonth()) !== monthFilter) return false;
      }

      return true;
    });
  }, [tickets, query, statusFilter, priorityFilter, developerFilter, yearFilter, monthFilter]);

  // Export Tickets as CSV
  const handleExportCSV = () => {
    const headers = ['Ticket ID', 'Requester Name', 'Tenant ID', 'Company', 'Subject', 'Status', 'Priority', 'Developer', 'Created Date', 'Due Date'];
    const rows = visible.map(t => [
      t.TICKET_ID,
      `"${(t.REQUESTER_NAME || t.REQUESTER_LOGINID || '').replace(/"/g, '""')}"`,
      `"${t.TENANT_ID || ''}"`,
      `"${t.COMPANY_CODE || ''}"`,
      `"${(t.SUBJECT || '').replace(/"/g, '""')}"`,
      t.STATUS,
      t.PRIORITY,
      `"${(t.DEVELOPER_NAME || t.DEVELOPER_LOGINID || 'Unassigned').replace(/"/g, '""')}"`,
      t.CREATED_AT || '',
      t.DUE_AT || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `support_tickets_report_${yearFilter !== 'all' ? yearFilter : 'all'}_${monthFilter !== 'all' ? Number(monthFilter) + 1 : 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Instant Live Chat
  const sessionKey = useMemo(() => `${user?.loginid || 'guest'}_session`, [user?.loginid]);
  useEffect(() => {
    if (compact && compactTab === 'chat') {
      void supportApi.liveChat(sessionKey).then(setLiveChatMessages).catch(() => undefined);
    }
  }, [compact, compactTab, sessionKey]);

  const sendLiveChat = async () => {
    if (!liveChatText.trim()) return;
    const txt = liveChatText.trim();
    setLiveChatText('');
    try {
      await supportApi.sendLiveChat({ sessionKey, message: txt, pageUrl: location.pathname });
      const msgs = await supportApi.liveChat(sessionKey);
      setLiveChatMessages(msgs);
      playSupportNotificationSound();
    } catch {
      // ignore
    }
  };

  const startNewIssue = () => {
    setSelected(null);
    setNewIssue(true);
    setMobileThread(true);
    setNotice('');
    setTimeout(() => textInput.current?.focus(), 50);
  };

  // KPIs
  const totalCount = tickets.length;
  const activeCount = tickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
  const reviewCount = tickets.filter(t => t.STATUS === 'RESOLVED').length;
  const closedCount = tickets.filter(t => t.STATUS === 'CLOSED').length;
  const overdueCount = tickets.filter(overdue).length;

  return (
    <section className={`sup ${compact ? 'sup-compact' : ''}`}>
      {/* Top Main Header */}
      <header className="sup-head">
        <div className="sup-title">
          <span className="sup-brand"><Headphones size={20} /></span>
          <div>
            <h1>{compact ? 'Bayanat Help & Support' : role === 'admin' ? 'Enterprise Support Desk' : role === 'developer' ? 'Developer Workbench' : 'My Support Tickets'}</h1>
            <p>{compact ? 'Instant answers, ticket status, and dedicated developer help.' : role === 'admin' ? 'Central ticketing operations, SLA metrics, and developer allocations.' : 'Track your assigned issues, progress, and resolution status.'}</p>
          </div>
        </div>
        <div className="sup-actions">
          <button title="Refresh" aria-label="Refresh" disabled={fetching} onClick={() => void refresh()}>
            <RefreshCw size={15} className={fetching ? 'sup-spin' : ''} />
          </button>
          {role !== 'admin' && role !== 'developer' && (
            <button className="sup-primary" onClick={startNewIssue} disabled={busy}>
              <Plus size={15} />New issue
            </button>
          )}
          {compact && (role === 'admin' || role === 'developer') && (
            <button
              type="button"
              className="sup-launch"
              title="Open full support desk"
              onClick={() => {
                if (onClose) onClose();
                navigate(role === 'developer' ? '/workspace/support/support/assigned' : '/workspace/support/support/dashboard');
              }}
            >
              Full desk ↗
            </button>
          )}
          {onClose && (
            <button ref={closeBtn} onClick={onClose} aria-label="Close" style={{ border: 0 }}>
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Notice alert */}
      {notice && (
        <div className={`sup-notice ${noticeGood ? 'good' : 'bad'}`} style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{notice}</span>
          <button onClick={() => setNotice('')} style={{ border: 0, background: 'transparent', marginLeft: 'auto', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* USER COMPACT DRAWER - 2 TABS */}
      {compact && (
        <div className="sup-modal-tabs">
          <button className={`sup-modal-tab ${compactTab === 'tickets' ? 'active' : ''}`} onClick={() => setCompactTab('tickets')}>
            <MessageSquare size={13} style={{ display: 'inline', marginRight: 5 }} />My Tickets ({tickets.length})
          </button>
          <button className={`sup-modal-tab ${compactTab === 'chat' ? 'active' : ''}`} onClick={() => setCompactTab('chat')}>
            <Bot size={13} style={{ display: 'inline', marginRight: 5 }} />Instant Help & AI
          </button>
        </div>
      )}

      {/* TAB 1: SUPPORT DASHBOARD (FOR DEVADMIN) */}
      {!compact && tab === 'dashboard' && role === 'admin' ? (
        <div className="sup-dashboard">
          <div className="sup-dashboard-header">
            <div>
              <h2>Executive Support Overview</h2>
              <p>Key resolution performance, volume trends, and active workloads across all tenants.</p>
            </div>
            <div className="sup-dashboard-filters">
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} title="Filter Year">
                <option value="all">All Years</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} title="Filter Month">
                <option value="all">All Months</option>
                <option value="0">January</option>
                <option value="1">February</option>
                <option value="2">March</option>
                <option value="3">April</option>
                <option value="4">May</option>
                <option value="5">June</option>
                <option value="6">July</option>
                <option value="7">August</option>
                <option value="8">September</option>
                <option value="9">October</option>
                <option value="10">November</option>
                <option value="11">December</option>
              </select>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} title="Filter Priority">
                <option value="all">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>
              <button className="sup-primary" onClick={handleExportCSV}>
                <FileSpreadsheet size={14} />Export CSV
              </button>
            </div>
          </div>

          {/* Hero KPIs matching Finance Dashboard */}
          <div className="sup-kpi-grid">
            <div className="sup-kpi-card tone-blue">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Total Tickets</span>
                <span className="sup-kpi-icon"><MessageSquare size={16} /></span>
              </div>
              <div className="sup-kpi-value">{totalCount}</div>
              <div className="sup-kpi-sub">Across all registered tenants</div>
            </div>

            <div className="sup-kpi-card tone-amber">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Active Workload</span>
                <span className="sup-kpi-icon"><Clock3 size={16} /></span>
              </div>
              <div className="sup-kpi-value">{activeCount}</div>
              <div className="sup-kpi-sub">Open & in developer progress</div>
            </div>

            <div className="sup-kpi-card tone-purple">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Awaiting Admin Close</span>
                <span className="sup-kpi-icon"><CheckCircle2 size={16} /></span>
              </div>
              <div className="sup-kpi-value">{reviewCount}</div>
              <div className="sup-kpi-sub">Developer resolved & verified</div>
            </div>

            <div className="sup-kpi-card tone-green">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Closed Tickets</span>
                <span className="sup-kpi-icon"><ShieldCheck size={16} /></span>
              </div>
              <div className="sup-kpi-value">{closedCount}</div>
              <div className="sup-kpi-sub">Successfully resolved</div>
            </div>

            <div className="sup-kpi-card tone-rose">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Overdue SLA</span>
                <span className="sup-kpi-icon"><AlertCircle size={16} /></span>
              </div>
              <div className="sup-kpi-value">{overdueCount}</div>
              <div className="sup-kpi-sub">Requiring immediate escalation</div>
            </div>
          </div>

          {/* Two Dashboard Sub-Tabs */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--sup-line)', paddingBottom: 6 }}>
            <button
              className={dashboardSubTab === 'overview' ? 'sup-primary' : ''}
              onClick={() => setDashboardSubTab('overview')}
              style={{ fontSize: 12 }}
            >
              Operational Overview
            </button>
            <button
              className={dashboardSubTab === 'workload' ? 'sup-primary' : ''}
              onClick={() => setDashboardSubTab('workload')}
              style={{ fontSize: 12 }}
            >
              Developer Workload & SLA Matrix
            </button>
          </div>

          {dashboardSubTab === 'overview' ? (
            <div className="sup-dashboard-panels">
              {/* Recent Attention Tickets */}
              <div className="sup-panel">
                <div className="sup-panel-title">
                  <span>Recent Attention Queue</span>
                  <button style={{ border: 0, fontSize: 11, color: 'var(--sup-blue)' }} onClick={() => navigate('/workspace/support/support/tickets')}>
                    View All ↗
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 280 }}>
                  {visible.slice(0, 6).map(t => (
                    <div
                      key={t.TICKET_ID}
                      style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => {
                        setSelected(t.TICKET_ID);
                        navigate('/workspace/support/support/tickets');
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 12.5 }}>#{t.TICKET_ID} · {t.SUBJECT}</strong>
                        <div style={{ fontSize: 11, color: 'var(--sup-muted)' }}>{t.REQUESTER_NAME || t.REQUESTER_LOGINID} · {t.TENANT_ID}</div>
                      </div>
                      {statusBadge(t.STATUS)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Status & Priority Breakdown */}
              <div className="sup-panel">
                <div className="sup-panel-title">
                  <span>Priority & Status Breakdown</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
                  {[
                    ['Critical', tickets.filter(t => t.PRIORITY === 'CRITICAL').length, '#ef4444'],
                    ['High', tickets.filter(t => t.PRIORITY === 'HIGH').length, '#f97316'],
                    ['Normal / Medium', tickets.filter(t => ['NORMAL', 'MEDIUM'].includes(t.PRIORITY)).length, '#3b82f6'],
                    ['Low', tickets.filter(t => t.PRIORITY === 'LOW').length, '#64748b']
                  ].map(([pName, count, col]) => (
                    <div key={pName as string} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 120, fontSize: 12 }}>{pName}</span>
                      <div style={{ flex: 1, background: '#e2e8f0', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${totalCount ? ((count as number) / totalCount) * 100 : 0}%`, background: col as string, height: '100%' }} />
                      </div>
                      <span style={{ width: 30, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Module-wise Breakdown matching ERP dashboard */}
              <div className="sup-panel" style={{ gridColumn: 'span 2' }}>
                <div className="sup-panel-title">
                  <span>Module Issue Breakdown</span>
                  <span style={{ fontSize: 11, color: 'var(--sup-muted)' }}>Distribution across ERP & Supply Chain</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '8px 0' }}>
                  {['HCM', 'Finance', 'WMS', 'FMS', 'Security', 'Masters', 'General'].map(mod => {
                    const modTickets = tickets.filter(t => (t.MODULE_NAME || '').toUpperCase().includes(mod.toUpperCase()) || (t.PAGE_URL || '').toUpperCase().includes(mod.toUpperCase()));
                    const modActive = modTickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
                    const modClosed = modTickets.filter(t => ['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
                    return (
                      <div key={mod} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--sup-line)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sup-blue)', marginBottom: 4 }}>BT-{mod}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sup-muted)' }}>
                          <span>Active: <strong style={{ color: modActive > 0 ? '#b45309' : 'inherit' }}>{modActive}</strong></span>
                          <span>Closed: <strong style={{ color: '#15803d' }}>{modClosed}</strong></span>
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>Total: {modTickets.length}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Developer SLA Matrix */
            <div className="sup-panel">
              <div className="sup-panel-title">
                <span>Developer Assignments & Workloads</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Developer Name</th>
                      <th>Login ID</th>
                      <th>Email</th>
                      <th>Active Tickets</th>
                      <th>Resolved Tickets</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {developers.map(d => {
                      const devTickets = tickets.filter(t => t.DEVELOPER_LOGINID === d.LOGINID);
                      const devActive = devTickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
                      const devResolved = devTickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.STATUS)).length;
                      return (
                        <tr key={d.LOGINID}>
                          <td><strong>{d.USERNAME || d.LOGINID}</strong></td>
                          <td>{d.LOGINID}</td>
                          <td>{d.EMAIL_ID}</td>
                          <td><span style={{ fontWeight: 600, color: devActive > 0 ? '#b45309' : 'inherit' }}>{devActive}</span></td>
                          <td><span style={{ fontWeight: 600, color: '#15803d' }}>{devResolved}</span></td>
                          <td>
                            <span className={`sup-status ${d.ACTIVE_FLAG === 'Y' ? 's-closed' : 's-waiting_info'}`}>
                              {d.ACTIVE_FLAG === 'Y' ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'team' && role === 'admin' ? (
        /* TAB 2: DEVELOPER MANAGEMENT (DEVADMIN) */
        <div className="sup-settings">
          <div className="sup-master-header" style={{ marginBottom: 16 }}>
            <h2>Enterprise Support Developers</h2>
            <p>Select developers from User Master (LOGINID starting with B / BI) to grant or configure ticket assignments.</p>
          </div>

          <form
            className="sup-developer-grant-card"
            onSubmit={e => {
              e.preventDefault();
              if (!teamLogin) return;
              void run(async () => {
                await supportApi.developer({ loginid: teamLogin, username: teamName, email_id: teamEmail, active_flag: 'Y' });
                setDevelopers(await supportApi.developers());
                setCandidates(await supportApi.candidateDevelopers());
                setSelectedCandidate('');
                setTeamLogin('');
                setTeamName('');
                setTeamEmail('');
              }, `Developer ${teamName || teamLogin} registered and granted access.`);
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) auto', gap: 14, alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600 }}>
                Select Developer from User Master (B% / BI%)
                <select
                  required
                  value={selectedCandidate}
                  onChange={e => {
                    const login = e.target.value;
                    setSelectedCandidate(login);
                    const found = candidates.find(c => c.loginid === login);
                    if (found) {
                      setTeamLogin(found.loginid);
                      setTeamName(found.username);
                      setTeamEmail(found.email_id);
                    } else {
                      setTeamLogin('');
                      setTeamName('');
                      setTeamEmail('');
                    }
                  }}
                  style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--sup-line)', background: 'var(--sup-card-bg)', fontSize: 13 }}
                >
                  <option value="">-- Choose Developer from SEC_LOGINTEST --</option>
                  {candidates.map(c => (
                    <option key={c.loginid} value={c.loginid}>
                      {c.username} ({c.loginid}) - {c.email_id} {c.is_registered ? (c.is_active ? '✓ Active' : '⚠ Disabled') : ''}
                    </option>
                  ))}
                </select>
              </label>

              <button className="sup-primary" style={{ height: 38, padding: '0 20px', whiteSpace: 'nowrap' }} disabled={busy || !teamLogin}>
                <UserCheck size={15} />Grant Developer Access
              </button>
            </div>

            {teamLogin && (
              <div style={{ display: 'flex', gap: 20, marginTop: 12, padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: 12 }}>
                <span><strong>Login ID:</strong> {teamLogin}</span>
                <span><strong>Full Name:</strong> {teamName}</span>
                <span><strong>Email:</strong> {teamEmail}</span>
              </div>
            )}
          </form>

          {/* Master Table Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 10px' }}>
            <div className="sup-search" style={{ maxWidth: 320 }}>
              <Search size={14} />
              <input
                placeholder="Search registered developers..."
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--sup-muted)', fontWeight: 500 }}>
              {developers.length} Developers Configured
            </span>
          </div>

          <div className="sup-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Developer Name</th>
                  <th>Login ID</th>
                  <th>Email</th>
                  <th>Active Workload</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {developers
                  .filter(d => {
                    if (!teamSearch.trim()) return true;
                    const q = teamSearch.toLowerCase();
                    return (
                      (d.USERNAME || '').toLowerCase().includes(q) ||
                      (d.LOGINID || '').toLowerCase().includes(q) ||
                      (d.EMAIL_ID || '').toLowerCase().includes(q)
                    );
                  })
                  .map(d => (
                    <tr key={d.LOGINID}>
                      <td><strong>{d.USERNAME}</strong></td>
                      <td>{d.LOGINID}</td>
                      <td>{d.EMAIL_ID}</td>
                      <td>{tickets.filter(t => t.DEVELOPER_LOGINID === d.LOGINID && !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length}</td>
                      <td>
                        <span className={`sup-status ${d.ACTIVE_FLAG === 'Y' ? 's-closed' : 's-waiting_info'}`}>
                          {d.ACTIVE_FLAG === 'Y' ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <button
                          disabled={busy}
                          onClick={() => {
                            const nextFlag = d.ACTIVE_FLAG === 'Y' ? 'N' : 'Y';
                            void run(async () => {
                              await supportApi.developer({ loginid: d.LOGINID, active_flag: nextFlag });
                              setDevelopers(await supportApi.developers());
                              setCandidates(await supportApi.candidateDevelopers());
                            }, `Developer ${nextFlag === 'Y' ? 'Enabled' : 'Disabled'}.`);
                          }}
                        >
                          {d.ACTIVE_FLAG === 'Y' ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : compact && compactTab === 'chat' ? (
        /* USER INSTANT HELP & SMART ASSISTANT CHAT */
        <div className="sup-live-chat-wrap">
          <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--sup-line)', fontSize: 11.5 }}>
            <strong>Bayanat Quick Assist</strong> · Instant answers & live routing
          </div>
          <div className="sup-messages">
            <div className="sup-message system">
              <p>Hello! Welcome to Bayanat Instant Support. How can we help you today with your invoices, vouchers, or reports?</p>
            </div>
            {liveChatMessages.map(m => (
              <div key={m.CHAT_ID} className={`sup-message ${m.SENDER_ROLE === 'USER' ? 'mine' : ''}`}>
                <div><strong>{m.SENDER_ROLE === 'USER' ? 'You' : m.USERNAME || 'Assistant'}</strong><time>{dateFmt(m.CREATED_AT)}</time></div>
                <p>{m.MESSAGE_TEXT}</p>
              </div>
            ))}
          </div>
          <div className="sup-compose" style={{ padding: '8px 12px' }}>
            <textarea
              style={{ minHeight: 46 }}
              placeholder="Ask a question or type your issue..."
              value={liveChatText}
              onChange={e => setLiveChatText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendLiveChat();
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <button style={{ fontSize: 11 }} onClick={startNewIssue}>
                Need developer fix? + Raise Ticket
              </button>
              <button className="sup-primary" style={{ padding: '4px 12px' }} onClick={sendLiveChat} disabled={!liveChatText.trim()}>
                <Send size={13} />Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* WHATSAPP-STYLE TICKET QUEUE & CHAT INTERFACE */
        <div className={`sup-layout ${mobileThread ? 'show-thread' : ''}`}>
          {/* Left Panel: WhatsApp-Style Ticket List */}
          <aside className="sup-inbox">
            <div className="sup-inbox-tools">
              <div className="sup-search">
                <Search size={14} />
                <input
                  aria-label="Search support tickets"
                  placeholder="Search user, ticket, company..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              {/* Status, Year, Month Filter Row */}
              <div className="sup-filter-row">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} title="Status">
                  <option value="all">All ({tickets.length})</option>
                  <option value="active">Active ({activeCount})</option>
                  <option value="review">Dev Resolved ({reviewCount})</option>
                  <option value="closed">Closed ({closedCount})</option>
                  <option value="overdue">Overdue ({overdueCount})</option>
                </select>

                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} title="Year">
                  <option value="all">Year: All</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>

                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} title="Month">
                  <option value="all">Month: All</option>
                  <option value="0">Jan</option>
                  <option value="1">Feb</option>
                  <option value="2">Mar</option>
                  <option value="3">Apr</option>
                  <option value="4">May</option>
                  <option value="5">Jun</option>
                  <option value="6">Jul</option>
                  <option value="7">Aug</option>
                  <option value="8">Sep</option>
                  <option value="9">Oct</option>
                  <option value="10">Nov</option>
                  <option value="11">Dec</option>
                </select>
              </div>
            </div>

            {/* Scrollable WhatsApp List */}
            <div className="sup-ticket-list">
              {visible.map(t => {
                const isSelected = selected === t.TICKET_ID && !newIssue;
                const initials = getUserInitials(t.REQUESTER_NAME || t.REQUESTER_LOGINID);

                return (
                  <button
                    key={t.TICKET_ID}
                    disabled={busy}
                    onClick={() => {
                      setNewIssue(false);
                      setSelected(t.TICKET_ID);
                      setMobileThread(true);
                      setNotice('');
                    }}
                    className={`sup-ticket-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="sup-avatar-badge">{initials}</div>
                    <div className="sup-item-body">
                      <div className="sup-item-top">
                        <span className="sup-item-name">{t.REQUESTER_NAME || t.REQUESTER_LOGINID}</span>
                        <time className="sup-item-time">{dateFmt(t.LAST_MESSAGE_AT || t.CREATED_AT)}</time>
                      </div>

                      <div className="sup-item-sub">
                        <span className="sup-item-tag">#{t.TICKET_ID}</span>
                        <span>{t.TENANT_ID || t.COMPANY_CODE}</span>
                      </div>

                      <div className="sup-item-snippet">{t.SUBJECT}</div>

                      <div className="sup-item-foot">
                        {statusBadge(t.STATUS)}
                        {t.UNREAD_COUNT > 0 && <span className="sup-unread-pill">{t.UNREAD_COUNT}</span>}
                        {overdue(t) && (
                          <span className="sup-overdue-pill">
                            <Clock3 size={11} />Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {!visible.length && (
                <div className="sup-empty">
                  <MessageSquare size={24} />
                  <strong>No tickets match filter</strong>
                  <p>Try changing your month or status filter.</p>
                </div>
              )}
            </div>
          </aside>

          {/* Right Panel: WhatsApp-Style Thread & Chat */}
          <main className="sup-thread">
            {newIssue ? (
              <>
                <div className="sup-thread-head">
                  <button className="sup-mobile-back" aria-label="Back" onClick={() => setMobileThread(false)}>
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h2>Raise New Support Ticket</h2>
                    <p>{user?.username || user?.loginid} · {user?.company_code}</p>
                  </div>
                </div>
                <div className="sup-new">
                  <label>
                    Issue Subject <span>(Required)</span>
                    <input
                      maxLength={300}
                      value={draft.subject}
                      onChange={e => patch({ subject: e.target.value })}
                      placeholder="e.g. Sales Invoice attachment 400 error"
                    />
                  </label>
                  <p style={{ marginTop: 12, color: 'var(--sup-muted)', fontSize: 12 }}>
                    Please write full description below, paste screenshots, and our support team will attend to it immediately.
                  </p>
                </div>
              </>
            ) : ticket ? (
              <>
                <div className="sup-thread-head">
                  <button className="sup-mobile-back" aria-label="Back" onClick={() => setMobileThread(false)}>
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--sup-muted)' }}>Ticket #{ticket.TICKET_ID} · {ticket.PRIORITY}</span>
                    <h2 style={{ fontSize: 15, margin: '2px 0' }}>{ticket.SUBJECT}</h2>
                    <p style={{ fontSize: 11 }}>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} · {ticket.COMPANY_CODE} · {ticket.TENANT_ID}</p>
                  </div>
                  <div className="sup-thread-head-actions">
                    {statusBadge(ticket.STATUS)}

                    {/* Send Reminder button for DEVADMIN */}
                    {role === 'admin' && ticket.DEVELOPER_LOGINID && ticket.STATUS !== 'CLOSED' && (
                      <button
                        className="sup-primary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => {
                          void run(
                            () => supportApi.sendReminder(ticket.TICKET_ID),
                            `Reminder sent to assigned developer ${ticket.DEVELOPER_NAME || ticket.DEVELOPER_LOGINID}.`
                          );
                        }}
                        disabled={busy}
                        title="Send urgent reminder notification to assigned developer"
                      >
                        <Clock3 size={13} />Send Reminder
                      </button>
                    )}

                    {/* Prominent Close Ticket Button for DEVADMIN */}
                    {role === 'admin' && ticket.STATUS !== 'CLOSED' && (
                      <button
                        className="sup-danger"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setShowCloseModal(true)}
                        disabled={busy}
                        title="Close this ticket"
                      >
                        <CheckCircle2 size={13} />Close Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* Overdue SLA Alert Banner */}
                {overdue(ticket) && (
                  <div className="sup-alert-banner">
                    <AlertCircle size={15} />
                    <span>OVERDUE SLA: Resolution deadline has passed. Immediate escalation or progress update required.</span>
                  </div>
                )}

                {/* Ticket Meta / Assignment Bar */}
                <div className="sup-ticket-meta">
                  <span><Users size={13} />{ticket.DEVELOPER_NAME || 'Awaiting Developer Assignment'}</span>
                  <span className={overdue(ticket) ? 'sup-overdue' : ''}>
                    <Clock3 size={13} />{ticket.DUE_AT ? `Due ${dateFmt(ticket.DUE_AT)}` : 'No SLA set'}
                  </span>
                  <button
                    style={{ border: 0, background: 'transparent', color: 'var(--sup-blue)', marginLeft: 'auto', cursor: 'pointer' }}
                    onClick={() => {
                      setShowHistory(v => !v);
                      void supportApi.events(ticket.TICKET_ID).then(setEvents);
                    }}
                  >
                    Activity Log
                  </button>
                </div>

                {/* History popup / drawer */}
                {showHistory && (
                  <div className="sup-history">
                    {events.map(e => (
                      <p key={e.EVENT_ID}>
                        <strong>{e.EVENT_TYPE.replaceAll('_', ' ')}</strong> · {e.ACTOR_LOGINID}
                        <small>{dateFmt(e.CREATED_AT)}</small>
                        <span>{e.EVENT_TEXT}</span>
                      </p>
                    ))}
                    {!events.length && <p>No events recorded.</p>}
                  </div>
                )}

                {/* Close Confirmation Modal for Admin */}
                {showCloseModal && (
                  <div style={{ padding: '12px 20px', background: '#fee2e2', borderBottom: '1px solid #f87171', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <strong>Confirm Closing Ticket #{ticket.TICKET_ID}</strong>
                    <input
                      placeholder="Optional closing remark or resolution summary..."
                      value={closingRemark}
                      onChange={e => setClosingRemark(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button onClick={() => setShowCloseModal(false)}>Cancel</button>
                      <button className="sup-danger" onClick={() => handleCloseTicket(ticket.TICKET_ID, closingRemark)} disabled={busy}>
                        Confirm Close
                      </button>
                    </div>
                  </div>
                )}

                {/* Admin Assignment Section */}
                {role === 'admin' && !['CLOSED', 'RESOLVED'].includes(ticket.STATUS) && (
                  <form
                    className="sup-assignment"
                    onSubmit={e => {
                      e.preventDefault();
                      void run(
                        () => supportApi.assign(ticket.TICKET_ID, { developer_loginid: developer, priority, sla_minutes: Number(estimate) }),
                        'Developer assigned and notified.'
                      );
                    }}
                  >
                    <label>
                      Assign Developer
                      <select required value={developer} onChange={e => setDeveloper(e.target.value)}>
                        <option value="">Select Developer</option>
                        {developers.filter(d => d.ACTIVE_FLAG === 'Y').map(d => (
                          <option key={d.LOGINID} value={d.LOGINID}>{d.USERNAME || d.LOGINID}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Priority
                      <select value={priority} onChange={e => setPriority(e.target.value)}>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="NORMAL">Normal</option>
                        <option value="LOW">Low</option>
                      </select>
                    </label>

                    <label>
                      Estimate (Mins)
                      <input type="number" min={1} max={43200} value={estimate} onChange={e => setEstimate(e.target.value)} />
                    </label>

                    <button className="sup-primary" disabled={busy || !developer}>Assign</button>
                  </form>
                )}

                {/* Conversation Messages */}
                <div className="sup-messages">
                  {messages.map(m => {
                    const isMine = m.SENDER_LOGINID.toUpperCase() === user?.loginid?.toUpperCase();
                    return (
                      <article key={m.MESSAGE_ID} className={`sup-message ${m.SENDER_ROLE === 'SYSTEM' ? 'system' : isMine ? 'mine' : ''}`}>
                        <div>
                          <strong>{m.SENDER_ROLE === 'SYSTEM' ? 'System Notification' : m.SENDER_NAME || m.SENDER_LOGINID}</strong>
                          <time>{dateFmt(m.CREATED_AT)}</time>
                        </div>
                        <p>{m.MESSAGE_TEXT}</p>
                        {m.attachments?.map(a => (
                          <AttachmentLink key={a.ATTACHMENT_ID} attachment={a} ticketId={ticket.TICKET_ID} />
                        ))}
                        {isMine && m.IS_DELETED !== 'Y' && m.SENDER_ROLE !== 'SYSTEM' && (
                          <button
                            className="sup-message-delete"
                            title="Delete"
                            onClick={() => {
                              if (window.confirm('Delete message?')) {
                                void run(() => supportApiDelete(ticket.TICKET_ID, m.MESSAGE_ID), 'Message deleted.');
                              }
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </article>
                    );
                  })}
                  <div ref={tail} />
                </div>

                {/* Developer Work Progress & Resolution Options */}
                {role === 'developer' && !['CLOSED', 'RESOLVED'].includes(ticket.STATUS) && (
                  <div className="sup-progress" style={{ padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid var(--sup-line)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button disabled={busy} onClick={() => void run(() => supportApi.progress(ticket.TICKET_ID, 'IN_PROGRESS'), 'Started work.')}>
                        Start Work
                      </button>
                      <button disabled={busy} onClick={() => void run(() => supportApi.progress(ticket.TICKET_ID, 'WAITING_INFO'), 'Status: Waiting Info.')}>
                        Waiting for Info
                      </button>
                    </div>

                    <label>
                      Developer Resolution / Fix Summary (Awaiting Admin Review)
                      <textarea
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        placeholder="Explain fix details and verified tests..."
                        style={{ minHeight: 50 }}
                      />
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button className="sup-success" disabled={busy || !resolution.trim()} onClick={() => handleDeveloperResolve(ticket.TICKET_ID)}>
                        <CheckCircle2 size={14} />Submit Resolution & Close Work
                      </button>
                    </div>
                  </div>
                )}

                {/* Admin Approval of Developer Resolution */}
                {ticket.STATUS === 'RESOLVED' && role === 'admin' && (
                  <div className="sup-resolution" style={{ padding: '10px 20px', background: '#fef9c3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Developer has submitted resolution:</strong>
                      <p style={{ margin: '3px 0' }}>{ticket.RESOLUTION || 'Fix verified by developer.'}</p>
                    </div>
                    <button className="sup-success" disabled={busy} onClick={() => handleCloseTicket(ticket.TICKET_ID, ticket.RESOLUTION)}>
                      Approve & Final Close
                    </button>
                  </div>
                )}

                {/* Reopen Ticket for User/Admin */}
                {ticket.STATUS === 'CLOSED' && (
                  <div style={{ padding: '10px 20px', background: '#f1f5f9', borderTop: '1px solid var(--sup-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12 }}>This ticket is closed. If issue persists:</span>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Please specify reason to reopen:');
                        if (reason) {
                          void run(() => supportApi.update(ticket.TICKET_ID, { status: 'REOPENED', reason }), 'Ticket reopened.');
                        }
                      }}
                    >
                      Reopen Ticket
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="sup-empty sup-welcome">
                <Headphones size={36} color="var(--sup-blue)" />
                <h2>Select a ticket to view conversation</h2>
                <p>Choose an item from the left queue {role !== 'admin' && role !== 'developer' ? 'or click "+ New issue" to raise a new request.' : 'to view discussion, assignment, and status.'}</p>
                {role !== 'admin' && role !== 'developer' && (
                  <button className="sup-primary" onClick={startNewIssue}>
                    <Plus size={15} />New issue
                  </button>
                )}
              </div>
            )}

            {/* Compose Area */}
            {(newIssue || (ticket && ticket.STATUS !== 'CLOSED')) && (
              <div className="sup-compose">
                <textarea
                  ref={textInput}
                  maxLength={8000}
                  value={draft.text}
                  onChange={e => patch({ text: e.target.value })}
                  onPaste={paste}
                  placeholder={newIssue ? 'Describe your issue in detail...' : 'Write your reply... (Ctrl + Enter to send)'}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      if (!busy && !readingFiles && draft.text.trim()) send();
                    }
                  }}
                />

                {draft.files.length > 0 && (
                  <div className="sup-files">
                    {draft.files.map((f, i) => (
                      <span key={i}>
                        <Paperclip size={11} />{f.file_name}
                        <button onClick={() => patch({ files: draft.files.filter((_, n) => n !== i) })}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="sup-compose-actions">
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                    hidden
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      void attach(Array.from(e.target.files || []));
                      e.target.value = '';
                    }}
                  />
                  <button disabled={readingFiles || busy} onClick={() => fileInput.current?.click()}>
                    <ImagePlus size={15} />{readingFiles ? 'Reading...' : 'Attach Screenshots'}
                  </button>
                  <small style={{ fontSize: 11, color: 'var(--sup-muted)' }}>Paste screenshots directly</small>
                  <button className="sup-primary" disabled={busy || readingFiles || !draft.text.trim()} onClick={send}>
                    <Send size={14} />{newIssue ? 'Submit Issue' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </section>
  );
}

function AttachmentLink({ attachment: a, ticketId }: { attachment: Attachment; ticketId: number }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let obj = '';
    if (!a.FILE_TYPE.startsWith('image/')) return;

    void supportApi.attachment(ticketId, a.ATTACHMENT_ID).then(r => {
      obj = URL.createObjectURL(r.data);
      if (active) setUrl(obj);
      else URL.revokeObjectURL(obj);
    }).catch(() => {
      if (active) setError('Preview unavailable');
    });

    return () => {
      active = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [ticketId, a.ATTACHMENT_ID]);

  const download = async () => {
    try {
      const r = await supportApi.attachment(ticketId, a.ATTACHMENT_ID);
      const u = URL.createObjectURL(r.data);
      const link = document.createElement('a');
      link.href = u;
      link.download = a.FILE_NAME;
      link.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) {
      setError(supportMessage(e));
    }
  };

  return (
    <div className="sup-attachment">
      {url && <img src={url} alt={a.FILE_NAME} />}
      <button onClick={() => void download()}>
        <Download size={12} />{a.FILE_NAME}
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
