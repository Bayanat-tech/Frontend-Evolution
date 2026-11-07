import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Headphones,
  ImagePlus,
  LayoutDashboard,
  Mail,
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
  AlertCircle,
  RotateCcw,
  Tags,
  Play
} from 'lucide-react';
import { supportApi, supportMessage, playSupportNotificationSound, type Ticket, type Message, type Upload, type Attachment, type SupportCategory } from '../../api/support';
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
  const clean = name.replace(/[-_.]+/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function isFeminineName(name?: string) {
  if (!name) return false;
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  const femaleKeywords = [
    'rashmita', 'srishti', 'usha', 'pooja', 'neha', 'priya', 'anjali', 'divya',
    'sneha', 'swati', 'kavita', 'meera', 'rekha', 'sunita', 'shweta', 'sheetal',
    'radha', 'aarti', 'jyoti', 'rupa', 'komal', 'sonal', 'anita', 'renu', 'alka'
  ];
  if (femaleKeywords.includes(first)) return true;
  if (/(a|i)$/.test(first) && !['sagar', 'ganesh', 'rishi', 'shiva', 'krishna', 'ravi', 'ali'].includes(first)) {
    return true;
  }
  return false;
}

function DeveloperAvatar({ name, isOnline, size = 32 }: { name?: string; isOnline?: boolean | string; size?: number }) {
  const isGirl = isFeminineName(name);
  const online = isOnline === 'Y' || isOnline === true;
  return (
    <div className="sup-dev-avatar-wrap" title={`${name || 'Developer'} (${isGirl ? 'Developer 👩‍💻' : 'Developer 👨‍💻'}${online ? ' · Online Now' : ' · Offline'})`}>
      <div
        className={`sup-dev-avatar ${isGirl ? 'girl' : 'boy'}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        <span>{isGirl ? '👩‍💻' : '👨‍💻'}</span>
      </div>
      <span className={online ? 'sup-online-dot' : 'sup-offline-dot'} />
    </div>
  );
}

const supportApiDelete = (ticket: number, message: number) =>
  api.delete(`/api/support/tickets/${ticket}/messages/${message}`);

export function SupportLauncher() {
  const { role, unread } = useSupport();
  const { user } = useAuth();
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

  // DEVADMIN and Developers work directly in full desk; hide floating headset launcher for staff
  const isStaff = role === 'admin' || role === 'developer' || user?.loginid?.toUpperCase() === 'DEVADMIN';
  if (isStaff) {
    return null;
  }

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
        <Headphones size={20} strokeWidth={2.2} />
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

function detectCurrentModule(pathname: string): string {
  const clean = (pathname || '').toLowerCase();
  if (clean.includes('/hcm')) return 'HCM';
  if (clean.includes('/ims')) return 'IMS';
  if (clean.includes('/wms')) return 'WMS';
  if (clean.includes('/fms') || clean.includes('/freight')) return 'FMS';
  if (clean.includes('/finance') || clean.includes('/fin')) return 'Finance';
  if (clean.includes('/vms') || clean.includes('/vendor')) return 'VMS';
  if (clean.includes('/security') || clean.includes('/sec')) return 'Security';
  if (clean.includes('/pams')) return 'PAMS';
  if (clean.includes('/hr')) return 'HR';
  if (clean.includes('/masters')) return 'Masters';
  const parts = clean.split('/').filter(Boolean);
  const wsIdx = parts.indexOf('workspace');
  if (wsIdx !== -1 && parts[wsIdx + 1] && parts[wsIdx + 1] !== 'support') {
    return parts[wsIdx + 1].toUpperCase();
  }
  return 'General';
}

export function SupportCenter({ compact = false, onClose }: { compact?: boolean; onClose?: () => void }) {
  const { user } = useAuth();
  const { role } = useSupport();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = role === 'admin' || user?.loginid?.toUpperCase() === 'DEVADMIN';
  const isDeveloper = role === 'developer';
  const isStaff = isAdmin || isDeveloper;

  const currentYear = new Date().getFullYear().toString();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [typing, setTyping] = useState('');

  // Filters - Default active tickets & current year
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [monthFilter, setMonthFilter] = useState('all');
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 12;

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
  const [showReassign, setShowReassign] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);

  // Category Master & SLA state
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [estDays, setEstDays] = useState<number>(1);
  const [estHours, setEstHours] = useState<number>(0);

  // Category Management Screen Form
  const [catNameInput, setCatNameInput] = useState('');
  const [catDescInput, setCatDescInput] = useState('');
  const [catDaysInput, setCatDaysInput] = useState(1);
  const [catHoursInput, setCatHoursInput] = useState(4);
  const [catSearch, setCatSearch] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  // Work Finish & Rework Modals
  const [showDevFinishModal, setShowDevFinishModal] = useState(false);
  const [devResolutionInput, setDevResolutionInput] = useState('');
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkCommentsInput, setReworkCommentsInput] = useState('');

  // Settings & Team
  const [teamLogin, setTeamLogin] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [skills, setSkills] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [settings, setSettings] = useState<{ contacts: any[]; queue: any[] }>({ contacts: [], queue: [] });
  const [contact, setContact] = useState({ email_id: '', display_name: '', recipient_type: 'CC' as 'TO' | 'CC' });

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
    if (location.pathname.endsWith('/team') || location.pathname.endsWith('/developers')) return 'team';
    if (location.pathname.endsWith('/reports') || location.pathname.endsWith('/overview')) return 'reports';
    if (location.pathname.endsWith('/settings') || location.pathname.endsWith('/notifications')) return 'settings';
    if (location.pathname.endsWith('/categories')) return 'categories';
    if (location.pathname.endsWith('/assigned')) return 'assigned';
    return isAdmin && location.pathname.endsWith('/tickets') ? 'tickets' : isAdmin ? 'dashboard' : 'tickets';
  }, [compact, location.pathname, isAdmin]);

  const patch = (v: Partial<typeof draft>) => setDrafts(d => ({ ...d, [draftKey]: { ...draft, ...v } }));

  const refresh = useCallback(async (isBackground = false) => {
    if (!isBackground) setFetching(true);
    try {
      const effectiveRole = isAdmin ? 'admin' : isDeveloper ? 'developer' : 'user';
      const t = await supportApi.tickets(effectiveRole);
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
  }, [isAdmin, isDeveloper]);

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
    if (isAdmin) {
      void supportApi.developers().then(setDevelopers).catch(() => undefined);
      void supportApi.candidateDevelopers().then(setCandidates).catch(() => undefined);
      void supportApi.categories().then(setCategories).catch(() => undefined);
      if (tab === 'settings') {
        void supportApi.settings().then(setSettings).catch(() => undefined);
      }
    }
  }, [isAdmin, tab]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, yearFilter, monthFilter, developerFilter, priorityFilter]);

  // Clear notice banner on tab change
  useEffect(() => {
    setNotice('');
  }, [tab]);

  // Service overview tickets: filtered only by year & month, NOT by queue statusFilter
  const reportsTickets = useMemo(() => {
    return tickets.filter(t => {
      if (yearFilter !== 'all' || monthFilter !== 'all') {
        const ticketDate = new Date(t.CREATED_AT || t.LAST_MESSAGE_AT);
        if (yearFilter !== 'all' && String(ticketDate.getFullYear()) !== yearFilter) return false;
        if (monthFilter !== 'all' && String(ticketDate.getMonth()) !== monthFilter) return false;
      }
      return true;
    });
  }, [tickets, yearFilter, monthFilter]);

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
    setShowDevFinishModal(false);
    setShowReworkModal(false);
    setShowReassign(false);
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
    setSelectedCategory(ticket?.CATEGORY_ID || '');
    setEstDays(ticket?.ESTIMATED_DAYS ?? 1);
    setEstHours(ticket?.ESTIMATED_HOURS ?? 0);
  }, [selected, ticket?.DEVELOPER_LOGINID, ticket?.CATEGORY_ID]);

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
        const detectedMod = detectCurrentModule(location.pathname);
        const subModMatch = draft.subject.match(/\[([A-Za-z0-9_-]+)\]/);
        const effectiveMod = subModMatch ? subModMatch[1] : detectedMod;
        const subject = draft.subject.trim() || draft.text.trim().slice(0, 80) || 'Support Request';
        const c = await supportApi.create({
          ...body,
          subject,
          module: effectiveMod || 'Workspace',
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
      // Developer desk filter: developer only sees their own assigned tickets
      if ((isDeveloper || tab === 'assigned') && t.DEVELOPER_LOGINID?.toUpperCase() !== user?.loginid?.toUpperCase()) {
        return false;
      }

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
  }, [tickets, query, statusFilter, priorityFilter, developerFilter, yearFilter, monthFilter, isDeveloper, tab, user?.loginid]);

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
    const detectedMod = detectCurrentModule(location.pathname);
    setDrafts(d => {
      const prevSub = d.new?.subject || '';
      const hasTag = /\[\w+\]/.test(prevSub);
      return {
        ...d,
        new: {
          text: d.new?.text || '',
          subject: hasTag ? prevSub : `[${detectedMod}] ${prevSub}`.trim(),
          files: d.new?.files || []
        }
      };
    });
    setTimeout(() => textInput.current?.focus(), 50);
  };

  // KPIs
  const totalCount = tickets.length;
  const activeCount = tickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
  const reviewCount = tickets.filter(t => t.STATUS === 'RESOLVED').length;
  const closedCount = tickets.filter(t => t.STATUS === 'CLOSED').length;
  const overdueCount = tickets.filter(overdue).length;

  // Pagination for Tickets Queue
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const paginatedTickets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, page, pageSize]);

  return (
    <section className={`sup ${compact ? 'sup-compact' : ''}`}>
      {/* Top Main Header */}
      <header className="sup-head">
        <div className="sup-title">
          <span className="sup-brand"><Headphones size={20} /></span>
          <div>
            <h1>{compact ? 'Bayanat Help & Support' : isAdmin ? 'Enterprise Support Desk' : isDeveloper ? 'Developer Workbench' : 'My Support Tickets'}</h1>
          </div>
        </div>
        <div className="sup-actions">
          <button title="Refresh" aria-label="Refresh" disabled={fetching} onClick={() => void refresh()}>
            <RefreshCw size={15} className={fetching ? 'sup-spin' : ''} />
          </button>
          {!compact && isAdmin && (
            <button
              className="sup-export-btn"
              title="Download Filtered Tickets as CSV"
              onClick={handleExportCSV}
            >
              <Download size={14} />Export CSV
            </button>
          )}
          {!isStaff && (
            <button className="sup-primary" onClick={startNewIssue} disabled={busy}>
              <Plus size={15} />New issue
            </button>
          )}
          {compact && isStaff && (
            <button
              type="button"
              className="sup-launch"
              title="Open full support desk"
              onClick={() => {
                if (onClose) onClose();
                navigate(isDeveloper ? '/workspace/support/support/assigned' : '/workspace/support/support/dashboard');
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

      {/* DevAdmin Main Desk Navigation Tabs */}
      {!compact && isAdmin && (
        <nav className="sup-nav-tabs">
          <button
            className={`sup-nav-tab ${tab === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigate('/workspace/support/support/dashboard')}
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button
            className={`sup-nav-tab ${tab === 'tickets' ? 'active' : ''}`}
            onClick={() => navigate('/workspace/support/support/tickets')}
          >
            <MessageSquare size={14} /> Ticket Queue
          </button>
          <button
            className={`sup-nav-tab ${tab === 'team' ? 'active' : ''}`}
            onClick={() => navigate('/workspace/support/support/team')}
          >
            <Users size={14} /> Developers
          </button>
          <button
            className={`sup-nav-tab ${tab === 'categories' ? 'active' : ''}`}
            onClick={() => navigate('/workspace/support/support/categories')}
          >
            <Tags size={14} /> Category Master
          </button>
          <button
            className={`sup-nav-tab ${tab === 'reports' ? 'active' : ''}`}
            onClick={() => navigate('/workspace/support/support/reports')}
          >
            <BarChart3 size={14} /> Service Overview
          </button>
          <button
            className={`sup-nav-tab ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('/workspace/support/support/settings')}
          >
            <Bell size={14} /> Notifications
          </button>
        </nav>
      )}

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
      {!compact && tab === 'dashboard' && isAdmin ? (
        <div className="sup-dashboard">
          <div className="sup-dashboard-header">
            <div>
              <h2>Executive Support Overview</h2>
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
                  {['Finance', 'HCM', 'IMS', 'WMS', 'FMS', 'VMS', 'Security', 'Masters', 'General'].map(mod => {
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
            /* Developer SLA & Workload Matrix */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 4 Mini KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div className="sup-kpi-card" style={{ padding: '14px 16px', background: 'var(--sup-card-bg)', border: '1px solid var(--sup-line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sup-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Developers</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--sup-ink)' }}>{developers.length}</div>
                  </div>
                </div>

                <div className="sup-kpi-card" style={{ padding: '14px 16px', background: 'var(--sup-card-bg)', border: '1px solid var(--sup-line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dcfce7', color: '#16a34a', display: 'grid', placeItems: 'center' }}>
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sup-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Online Now</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {developers.filter(d => d.IS_ONLINE === 'Y').length}
                      <span className="sup-online-dot" style={{ position: 'static', display: 'inline-block' }} />
                    </div>
                  </div>
                </div>

                <div className="sup-kpi-card" style={{ padding: '14px 16px', background: 'var(--sup-card-bg)', border: '1px solid var(--sup-line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                    <Clock3 size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sup-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Workload</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>
                      {tickets.filter(t => t.DEVELOPER_LOGINID && !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length}
                    </div>
                  </div>
                </div>

                <div className="sup-kpi-card" style={{ padding: '14px 16px', background: 'var(--sup-card-bg)', border: '1px solid var(--sup-line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'grid', placeItems: 'center' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sup-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Completed / Resolved</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>
                      {tickets.filter(t => t.DEVELOPER_LOGINID && ['RESOLVED', 'CLOSED'].includes(t.STATUS)).length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer Matrix Table */}
              <div className="sup-panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="sup-panel-title" style={{ padding: '14px 18px', borderBottom: '1px solid var(--sup-line)' }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>Developer Workload & SLA Matrix</strong>
                    <div style={{ fontSize: 11.5, color: 'var(--sup-muted)', marginTop: 2 }}>Real-time team presence, active allocations, and resolution velocity</div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--sup-line)', textAlign: 'left', fontSize: 12 }}>
                        <th style={{ padding: '10px 16px' }}>Developer</th>
                        <th style={{ padding: '10px 12px' }}>Login ID</th>
                        <th style={{ padding: '10px 12px' }}>Presence Status</th>
                        <th style={{ padding: '10px 12px' }}>Workload Capacity</th>
                        <th style={{ padding: '10px 12px' }}>Active</th>
                        <th style={{ padding: '10px 12px' }}>Resolved</th>
                        <th style={{ padding: '10px 12px' }}>Account Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {developers.map(d => {
                        const devTickets = tickets.filter(t => t.DEVELOPER_LOGINID === d.LOGINID);
                        const devActive = devTickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
                        const devResolved = devTickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.STATUS)).length;
                        const isOnline = d.IS_ONLINE === 'Y';
                        return (
                          <tr key={d.LOGINID} style={{ borderBottom: '1px solid var(--sup-line)', fontSize: 12.5 }}>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <DeveloperAvatar name={d.USERNAME || d.LOGINID} isOnline={isOnline} size={34} />
                                <div>
                                  <strong style={{ fontSize: 13, color: 'var(--sup-ink)' }}>{d.USERNAME || d.LOGINID}</strong>
                                  <div style={{ fontSize: 11, color: 'var(--sup-muted)' }}>{d.EMAIL_ID}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 12px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                                {d.LOGINID}
                              </span>
                            </td>
                            <td style={{ padding: '12px 12px' }}>
                              <span className={`sup-presence-tag ${isOnline ? 'online' : 'offline'}`}>
                                <span className={isOnline ? 'sup-online-dot' : 'sup-offline-dot'} style={{ position: 'static' }} />
                                {isOnline ? 'Online Now' : 'Offline'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 12px', minWidth: 140 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                  <span style={{ fontWeight: 600, color: devActive === 0 ? '#15803d' : devActive <= 2 ? '#0284c7' : '#b45309' }}>
                                    {devActive === 0 ? 'Available' : devActive <= 2 ? 'Optimal' : 'High Load'}
                                  </span>
                                  <span style={{ color: 'var(--sup-muted)' }}>{devActive} tickets</span>
                                </div>
                                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${Math.min(100, Math.max(8, devActive * 25))}%`,
                                      background: devActive === 0 ? '#22c55e' : devActive <= 2 ? '#3b82f6' : '#f59e0b',
                                      borderRadius: 3
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 12px' }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: devActive > 0 ? '#b45309' : 'inherit' }}>
                                {devActive}
                              </span>
                            </td>
                            <td style={{ padding: '12px 12px' }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>
                                {devResolved}
                              </span>
                            </td>
                            <td style={{ padding: '12px 12px' }}>
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
            </div>
          )}
        </div>
      ) : tab === 'team' && isAdmin ? (
        /* TAB 2: DEVELOPER MANAGEMENT (DEVADMIN) */
        <div className="sup-settings">
          <div className="sup-master-header" style={{ marginBottom: 16 }}>
            <h2>Enterprise Support Developers</h2>
            <p style={{ color: 'var(--sup-muted)', fontSize: 12 }}>
              Developers registered here can be assigned support tickets across all tenants and have access to their dedicated Developer Workbench.
            </p>
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
                  <option value="">Choose Developer</option>
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
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <DeveloperAvatar name={d.USERNAME || d.LOGINID} isOnline={d.IS_ONLINE} size={32} />
                          <div>
                            <strong>{d.USERNAME}</strong>
                            <div style={{ fontSize: 11, color: 'var(--sup-muted)' }}>
                              <span className={`sup-presence-tag ${d.IS_ONLINE === 'Y' ? 'online' : 'offline'}`} style={{ padding: '0 6px', fontSize: 10 }}>
                                {d.IS_ONLINE === 'Y' ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{d.LOGINID}</td>
                      <td>{d.EMAIL_ID}</td>
                      <td>
                        <span className="sup-status s-assigned">
                          {tickets.filter(t => t.DEVELOPER_LOGINID === d.LOGINID && !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length} Active
                        </span>
                      </td>
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
      ) : tab === 'categories' && isAdmin ? (
        /* TAB: CATEGORY & SLA MASTER (DEVADMIN) */
        <div className="sup-settings-wrap">
          <div className="sup-master-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>Support Category & SLA Master</h2>
              <p style={{ fontSize: 12, color: 'var(--sup-muted)', marginTop: 2 }}>
                Configure work categories, target SLA days, and hours used for developer assignments and audits.
              </p>
            </div>
            <button
              className="sup-primary"
              style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => void supportApi.categories().then(setCategories)}
              disabled={fetching}
            >
              <RefreshCw size={14} className={fetching ? 'sup-spin' : ''} />Refresh Categories
            </button>
          </div>

          <div className="sup-cat-grid">
            {/* Left: Category Table */}
            <div className="sup-section-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--sup-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <h3 style={{ fontSize: 13, margin: 0 }}><Tags size={15} /> Registered Categories ({categories.length})</h3>
                <div className="sup-search" style={{ maxWidth: 220 }}>
                  <Search size={13} />
                  <input
                    placeholder="Search category..."
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--sup-line)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>Category Name</th>
                      <th style={{ padding: '10px 12px' }}>Description</th>
                      <th style={{ padding: '10px 12px' }}>SLA Target</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories
                      .filter(c => !catSearch.trim() || c.CATEGORY_NAME.toLowerCase().includes(catSearch.toLowerCase()) || (c.DESCRIPTION || '').toLowerCase().includes(catSearch.toLowerCase()))
                      .map(c => {
                        const totalHours = (c.ESTIMATED_DAYS * 24) + c.ESTIMATED_HOURS;
                        const isInactive = c.ACTIVE_FLAG === 'N';
                        return (
                          <tr key={c.CATEGORY_ID} style={{ borderBottom: '1px solid var(--sup-line)', opacity: isInactive ? 0.6 : 1 }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--sup-ink)' }}>
                              {c.CATEGORY_NAME}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--sup-muted)', maxWidth: 220 }}>
                              {c.DESCRIPTION || '—'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span className="sup-cat-sla">
                                {c.ESTIMATED_DAYS}d {c.ESTIMATED_HOURS}h ({totalHours} hrs)
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span className={`sup-status ${c.ACTIVE_FLAG === 'Y' ? 's-open' : 's-closed'}`}>
                                {c.ACTIVE_FLAG === 'Y' ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  onClick={() => {
                                    setEditingCatId(c.CATEGORY_ID);
                                    setCatNameInput(c.CATEGORY_NAME);
                                    setCatDescInput(c.DESCRIPTION || '');
                                    setCatDaysInput(c.ESTIMATED_DAYS);
                                    setCatHoursInput(c.ESTIMATED_HOURS);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={c.ACTIVE_FLAG === 'Y' ? 'sup-danger' : 'sup-success'}
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  onClick={() => {
                                    void run(async () => {
                                      await supportApi.saveCategory({
                                        category_id: c.CATEGORY_ID,
                                        category_name: c.CATEGORY_NAME,
                                        description: c.DESCRIPTION,
                                        estimated_days: c.ESTIMATED_DAYS,
                                        estimated_hours: c.ESTIMATED_HOURS,
                                        active_flag: c.ACTIVE_FLAG === 'Y' ? 'N' : 'Y'
                                      });
                                      setCategories(await supportApi.categories());
                                    }, `Category ${c.ACTIVE_FLAG === 'Y' ? 'deactivated' : 'activated'}.`);
                                  }}
                                >
                                  {c.ACTIVE_FLAG === 'Y' ? 'Disable' : 'Enable'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Add/Edit Category Form */}
            <div className="sup-section-card" style={{ height: 'fit-content' }}>
              <h3><Tags size={15} /> {editingCatId ? 'Edit Category' : 'Create New Category'}</h3>
              <p style={{ fontSize: 12, color: 'var(--sup-muted)', marginBottom: 12 }}>
                {editingCatId ? 'Update category name, description, or SLA timing.' : 'Add a new category that will appear in ticket assignments.'}
              </p>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!catNameInput.trim()) return;
                  void run(async () => {
                    await supportApi.saveCategory({
                      category_id: editingCatId,
                      category_name: catNameInput.trim(),
                      description: catDescInput.trim(),
                      estimated_days: Number(catDaysInput) || 0,
                      estimated_hours: Number(catHoursInput) || 0,
                      active_flag: 'Y'
                    });
                    setEditingCatId(null);
                    setCatNameInput('');
                    setCatDescInput('');
                    setCatDaysInput(1);
                    setCatHoursInput(4);
                    setCategories(await supportApi.categories());
                  }, editingCatId ? 'Category updated.' : 'Category created.');
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <label>
                  Category Name <span className="sup-req">*</span>
                  <input
                    required
                    placeholder="e.g. Support, Development, Change Request"
                    value={catNameInput}
                    onChange={e => setCatNameInput(e.target.value)}
                  />
                </label>

                <label>
                  Description
                  <input
                    placeholder="Brief description of work type"
                    value={catDescInput}
                    onChange={e => setCatDescInput(e.target.value)}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>
                    Target SLA Days
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={catDaysInput}
                      onChange={e => setCatDaysInput(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label>
                    Target SLA Hours
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={catHoursInput}
                      onChange={e => setCatHoursInput(Number(e.target.value) || 0)}
                    />
                  </label>
                </div>

                <div style={{ fontSize: 11.5, color: '#047857', background: '#ecfdf5', padding: '6px 10px', borderRadius: 6 }}>
                  Total Default SLA: <strong>{catDaysInput} days {catHoursInput} hrs</strong> ({(catDaysInput * 24) + catHoursInput} total hours)
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {editingCatId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(null);
                        setCatNameInput('');
                        setCatDescInput('');
                        setCatDaysInput(1);
                        setCatHoursInput(4);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="sup-primary" disabled={busy || !catNameInput.trim()} style={{ flex: 1 }}>
                    {editingCatId ? 'Update Category' : 'Save Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : tab === 'settings' && isAdmin ? (
        /* TAB: NOTIFICATIONS & ALERT CONFIGURATION (DEVADMIN) */
        <div className="sup-settings-wrap" style={{ padding: '8px 14px', gap: 8 }}>
          <div className="sup-master-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div>
              <h2 style={{ fontSize: 15, margin: 0 }}>Support Notifications & Email Alert Configuration</h2>
            </div>
            <button
              className="sup-primary"
              style={{ fontSize: 11.5, padding: '4px 10px', height: 28 }}
              onClick={() => void supportApi.settings().then(setSettings)}
              disabled={fetching}
            >
              <RefreshCw size={13} className={fetching ? 'sup-spin' : ''} />Refresh Outbox
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 10 }}>
            {/* Add Contact Card */}
            <div className="sup-section-card">
              <h3><Mail size={16} />Add Notification Recipient / CC Email</h3>
              <p style={{ fontSize: 12, color: 'var(--sup-muted)', marginBottom: 12 }}>
                Recipients registered here will receive automatic alerts for new tickets, SLA escalations, and ticket closures.
              </p>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!contact.email_id.trim()) return;
                  void run(async () => {
                    await supportApi.contact({
                      email_id: contact.email_id.trim(),
                      display_name: contact.display_name.trim(),
                      recipient_type: contact.recipient_type,
                      active_flag: 'Y'
                    });
                    const s = await supportApi.settings();
                    setSettings(s);
                    setContact({ email_id: '', display_name: '', recipient_type: 'CC' });
                  }, `Notification recipient ${contact.email_id} (${contact.recipient_type}) saved.`);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                  <label>
                    Email Address *
                    <input
                      type="email"
                      required
                      value={contact.email_id}
                      onChange={e => setContact({ ...contact, email_id: e.target.value })}
                      placeholder="e.g. prem@bayanattechnology.com"
                      className="sup-input-modern"
                    />
                  </label>
                  <label>
                    Routing Role
                    <select
                      value={contact.recipient_type}
                      onChange={e => setContact({ ...contact, recipient_type: e.target.value as 'TO' | 'CC' })}
                      className="sup-input-modern"
                      style={{ height: 35, padding: '0 8px' }}
                    >
                      <option value="TO">TO (Primary)</option>
                      <option value="CC">CC (Carbon Copy)</option>
                    </select>
                  </label>
                </div>
                <label>
                  Display Name
                  <input
                    type="text"
                    value={contact.display_name}
                    onChange={e => setContact({ ...contact, display_name: e.target.value })}
                    placeholder="e.g. Prem Rawat"
                    className="sup-input-modern"
                  />
                </label>
                <button className="sup-primary" style={{ marginTop: 6, alignSelf: 'flex-start' }} disabled={busy || !contact.email_id.trim()}>
                  <Plus size={14} />Add Notification Recipient
                </button>
              </form>
            </div>

            {/* Configured Recipients Card */}
            <div className="sup-section-card">
              <h3><Bell size={16} />Configured Alert Recipients ({settings.contacts?.length || 0})</h3>
              <div className="sup-table-scroll" style={{ maxHeight: 140 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Display Name</th>
                      <th>Email ID</th>
                      <th>Routing</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(settings.contacts || []).map((c: any) => (
                      <tr key={c.EMAIL_ID}>
                        <td><strong>{c.DISPLAY_NAME || 'Support Contact'}</strong></td>
                        <td>{c.EMAIL_ID}</td>
                        <td>
                          <span className={c.RECIPIENT_TYPE === 'TO' ? 'sup-badge-to' : 'sup-badge-cc'}>
                            {c.RECIPIENT_TYPE || 'CC'}
                          </span>
                        </td>
                        <td>
                          <span className={`sup-status ${c.ACTIVE_FLAG === 'Y' ? 's-closed' : 's-waiting_info'}`}>
                            {c.ACTIVE_FLAG === 'Y' ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          <button
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            disabled={busy}
                            onClick={() => {
                              const nextFlag = c.ACTIVE_FLAG === 'Y' ? 'N' : 'Y';
                              void run(async () => {
                                await supportApi.contact({ email_id: c.EMAIL_ID, display_name: c.DISPLAY_NAME, recipient_type: c.RECIPIENT_TYPE || 'CC', active_flag: nextFlag });
                                setSettings(await supportApi.settings());
                              }, `Recipient ${nextFlag === 'Y' ? 'enabled' : 'disabled'}.`);
                            }}
                          >
                            {c.ACTIVE_FLAG === 'Y' ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!settings.contacts || settings.contacts.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--sup-muted)', padding: 16 }}>
                          No notification recipients configured. (Default CC: prem@bayanattechnology.com)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Email Outbox Queue Audit */}
          <div className="sup-section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3><FileSpreadsheet size={16} />Live Support Email Dispatch Outbox & Audit</h3>
              <span style={{ fontSize: 12, color: 'var(--sup-muted)' }}>Recent 50 queued notifications</span>
            </div>
            <div className="sup-table-scroll" style={{ maxHeight: 160 }}>
              <table>
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Recipients</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Dispatched Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(settings.queue || []).map((q: any) => (
                    <tr key={q.EMAIL_ID}>
                      <td>#{q.TICKET_ID}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.RECIPIENTS}</td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.SUBJECT}</td>
                      <td>
                        <span className={`sup-status ${q.STATUS === 'SENT' ? 's-closed' : q.STATUS === 'RETRY' ? 's-waiting_info' : 's-assigned'}`}>
                          {q.STATUS}
                        </span>
                      </td>
                      <td>{q.ATTEMPTS || 0}</td>
                      <td>{q.SENT_AT || 'Pending'}</td>
                    </tr>
                  ))}
                  {(!settings.queue || settings.queue.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--sup-muted)', padding: 20 }}>
                        Email dispatch log is clear.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === 'reports' && isAdmin ? (
        /* TAB: SERVICE OVERVIEW & ANALYTICS (DEVADMIN) */
        <div className="sup-reports-wrap">
          <div className="sup-master-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2>Support Operations & Analytics Overview</h2>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} title="Year">
                <option value="all">All Years</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} title="Month">
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
              <button className="sup-export-btn" onClick={handleExportCSV}>
                <Download size={14} />Export Tickets to CSV
              </button>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="sup-kpi-grid">
            <div className="sup-kpi-card tone-blue">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Total Tickets</span>
                <span className="sup-kpi-icon"><MessageSquare size={16} /></span>
              </div>
              <span className="sup-kpi-value">{reportsTickets.length}</span>
              <span className="sup-kpi-sub">Filtered volume ({yearFilter !== 'all' ? yearFilter : 'All Years'})</span>
            </div>

            <div className="sup-kpi-card tone-amber">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Active / In Progress</span>
                <span className="sup-kpi-icon"><Clock3 size={16} /></span>
              </div>
              <span className="sup-kpi-value">{reportsTickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length}</span>
              <span className="sup-kpi-sub">Awaiting developer completion</span>
            </div>

            <div className="sup-kpi-card tone-green">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">Resolved / Closed</span>
                <span className="sup-kpi-icon"><CheckCircle2 size={16} /></span>
              </div>
              <span className="sup-kpi-value">{reportsTickets.filter(t => ['CLOSED', 'RESOLVED'].includes(t.STATUS)).length}</span>
              <span className="sup-kpi-sub">{reportsTickets.length ? Math.round((reportsTickets.filter(t => ['CLOSED', 'RESOLVED'].includes(t.STATUS)).length / reportsTickets.length) * 100) : 0}% completion rate</span>
            </div>

            <div className="sup-kpi-card tone-rose">
              <div className="sup-kpi-top">
                <span className="sup-kpi-label">SLA Overdue</span>
                <span className="sup-kpi-icon"><AlertCircle size={16} /></span>
              </div>
              <span className="sup-kpi-value">{reportsTickets.filter(overdue).length}</span>
              <span className="sup-kpi-sub">Critical attention needed</span>
            </div>
          </div>

          {/* Module Breakdown & Developer Performance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            <div className="sup-section-card">
              <h3><BarChart3 size={16} />Module Ticket Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Finance', 'HCM', 'IMS', 'WMS', 'FMS', 'VMS', 'Security', 'Masters', 'Other'].map(mod => {
                  const count = reportsTickets.filter(t => {
                    const str = `${t.MODULE_NAME || ''} ${t.SUBJECT || ''}`.toUpperCase();
                    if (mod === 'Other') return !['FINANCE', 'HCM', 'IMS', 'WMS', 'FMS', 'VMS', 'SECURITY', 'MASTERS'].some(m => str.includes(m));
                    return str.includes(mod.toUpperCase());
                  }).length;
                  const pct = reportsTickets.length ? Math.round((count / reportsTickets.length) * 100) : 0;
                  return (
                    <div key={mod} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span><strong>{mod}</strong></span>
                        <span style={{ color: 'var(--sup-muted)' }}>{count} tickets ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--sup-blue)', borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sup-section-card">
              <h3><Users size={16} />Developer Workload & Performance</h3>
              <div className="sup-table-scroll" style={{ maxHeight: 260 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Developer</th>
                      <th>Active</th>
                      <th>Resolved</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {developers.map(d => {
                      const devTickets = reportsTickets.filter(t => t.DEVELOPER_LOGINID === d.LOGINID);
                      const devActive = devTickets.filter(t => !['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
                      const devDone = devTickets.filter(t => ['CLOSED', 'RESOLVED'].includes(t.STATUS)).length;
                      return (
                        <tr key={d.LOGINID}>
                          <td><strong>{d.USERNAME}</strong></td>
                          <td><span className="sup-status s-assigned">{devActive}</span></td>
                          <td><span className="sup-status s-closed">{devDone}</span></td>
                          <td><strong>{devTickets.length}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
              {!isStaff && (
                <button style={{ fontSize: 11 }} onClick={startNewIssue}>
                  Need developer fix? + Raise Ticket
                </button>
              )}
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

              {compact && !isStaff && (
                <button
                  type="button"
                  className="sup-primary"
                  style={{ width: '100%', height: 34, fontSize: 12.5, justifyContent: 'center' }}
                  onClick={startNewIssue}
                >
                  <Plus size={14} />Raise New Ticket
                </button>
              )}
            </div>

            {/* Scrollable WhatsApp List */}
            <div className="sup-ticket-list">
              {paginatedTickets.map(t => {
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
                        {t.CATEGORY_NAME && (
                          <span className="sup-cat-badge" style={{ marginLeft: 4 }}>
                            {t.CATEGORY_NAME}
                          </span>
                        )}
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

            {/* Pagination Controls */}
            {visible.length > pageSize && (
              <div className="sup-pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="sup-page-btn"
                >
                  ◀ Prev
                </button>
                <span className="sup-page-info">
                  Page {page} of {totalPages} ({visible.length} tickets)
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="sup-page-btn"
                >
                  Next ▶
                </button>
              </div>
            )}
          </aside>

          {/* Right Panel: WhatsApp-Style Thread & Chat */}
          <main className="sup-thread">
            {newIssue ? (
              <div className="sup-create-ticket-view">
                <div className="sup-thread-head">
                  <button className="sup-mobile-back" aria-label="Back" onClick={() => { setNewIssue(false); setMobileThread(false); }}>
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h2>Raise New Support Ticket</h2>
                    <p>{user?.username || user?.loginid} · {user?.company_code} · {user?.tenantId || 'Default'}</p>
                  </div>
                </div>

                <div className="sup-create-form-body">
                  <div className="sup-form-field">
                    <label>
                      Issue Subject <span className="sup-req">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={300}
                      value={draft.subject}
                      onChange={e => patch({ subject: e.target.value })}
                      placeholder="Brief summary of the issue (e.g. Sales Invoice attachment 400 error)"
                      className="sup-input-modern"
                    />
                  </div>

                  <div className="sup-form-field">
                    <label>Module / Area</label>
                    <div className="sup-module-pills">
                      {['Finance', 'HCM', 'IMS', 'WMS', 'FMS', 'VMS', 'Security', 'Masters', 'General'].map(mod => {
                        const isMatch = (draft.subject || '').toLowerCase().includes(mod.toLowerCase());
                        return (
                          <button
                            type="button"
                            key={mod}
                            className={`sup-mod-chip ${isMatch ? 'active' : ''}`}
                            onClick={() => {
                              if (!draft.subject.includes(`[${mod}]`)) {
                                patch({ subject: `[${mod}] ${draft.subject.replace(/\[\w+\]\s*/g, '')}`.trim() });
                              }
                            }}
                          >
                            {mod}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sup-form-field">
                    <label>
                      Detailed Description <span className="sup-req">*</span>
                    </label>
                    <textarea
                      ref={textInput}
                      required
                      maxLength={8000}
                      value={draft.text}
                      onChange={e => patch({ text: e.target.value })}
                      onPaste={paste}
                      placeholder="Please describe what happened, error codes or messages, and steps to reproduce. (You can paste screenshots directly with Ctrl+V)..."
                      className="sup-textarea-modern"
                      rows={5}
                    />
                  </div>

                  <div className="sup-attachment-zone">
                    <div className="sup-att-header">
                      <span>Attachments & Screenshots</span>
                      <small>Paste directly (Ctrl+V) or upload images/PDFs (max 5MB each)</small>
                    </div>

                    {draft.files.length > 0 && (
                      <div className="sup-files-list">
                        {draft.files.map((f, i) => (
                          <div key={i} className="sup-file-chip">
                            <Paperclip size={12} />
                            <span className="sup-file-name" title={f.file_name}>{f.file_name}</span>
                            <span className="sup-file-size">({Math.round(f.file_size / 1024)} KB)</span>
                            <button type="button" onClick={() => patch({ files: draft.files.filter((_, n) => n !== i) })}>
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="sup-att-buttons">
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
                      <button
                        type="button"
                        className="sup-att-btn"
                        disabled={readingFiles || busy}
                        onClick={() => fileInput.current?.click()}
                      >
                        <ImagePlus size={15} />
                        {readingFiles ? 'Reading Files...' : 'Attach Screenshots / Files'}
                      </button>
                    </div>
                  </div>

                  <div className="sup-form-footer">
                    <button
                      type="button"
                      className="sup-cancel-btn"
                      onClick={() => { setNewIssue(false); setMobileThread(false); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="sup-primary sup-submit-ticket-btn"
                      disabled={busy || readingFiles || !draft.subject?.trim() || !draft.text?.trim()}
                      onClick={send}
                    >
                      <Send size={15} />
                      {busy ? 'Submitting Ticket...' : 'Submit Support Ticket'}
                    </button>
                  </div>
                </div>
              </div>
            ) : ticket ? (
              <>
                <div className="sup-thread-head compact-bar">
                  <button className="sup-mobile-back" aria-label="Back" onClick={() => setMobileThread(false)}>
                    <ArrowLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--sup-blue)', flexShrink: 0 }}>#{ticket.TICKET_ID}</span>
                    <strong style={{ fontSize: 13, color: 'var(--sup-ink)', flexShrink: 0, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID}>
                      {ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID}
                    </strong>
                    <span style={{ color: 'var(--sup-muted)', flexShrink: 0 }}>—</span>
                    <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--sup-ink)' }} title={ticket.SUBJECT}>
                      {ticket.SUBJECT}
                    </h2>
                  </div>
                  <div className="sup-thread-head-actions">
                    {statusBadge(ticket.STATUS)}

                    {/* Developer Workflow Actions */}
                    {isDeveloper && ticket.DEVELOPER_LOGINID?.toUpperCase() === user?.loginid?.toUpperCase() && !['CLOSED', 'RESOLVED'].includes(ticket.STATUS) && (
                      <>
                        {(ticket.STATUS === 'ASSIGNED' || ticket.STATUS === 'REOPENED' || ticket.DEV_STATUS === 'REWORK') && (
                          <button
                            type="button"
                            className="sup-primary"
                            style={{ padding: '5px 12px', fontSize: 12, background: 'var(--sup-blue)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                            onClick={() => void run(() => supportApi.progress(ticket.TICKET_ID, 'IN_PROGRESS'), 'Started work on ticket.')}
                            disabled={busy}
                            title="Start working on this ticket"
                          >
                            <Play size={13} />Start Work
                          </button>
                        )}
                        {ticket.STATUS === 'IN_PROGRESS' && ticket.DEV_STATUS !== 'REWORK' && (
                          <>
                            <span className="sup-badge-progress">
                              <span className="sup-pulse-dot" />In Progress
                            </span>
                            <button
                              type="button"
                              className="sup-primary"
                              style={{ padding: '5px 12px', fontSize: 12, background: 'var(--sup-blue)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                              onClick={() => {
                                setDevResolutionInput('');
                                setShowDevFinishModal(true);
                              }}
                              disabled={busy}
                              title="Finish work and submit resolution to DevAdmin"
                            >
                              <CheckCircle2 size={13} />Finish Work
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* Send Reminder button for DEVADMIN */}
                    {isAdmin && ticket.DEVELOPER_LOGINID && ticket.STATUS !== 'CLOSED' && (
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
                    {isAdmin && ticket.STATUS !== 'CLOSED' && (
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
                  {ticket.CATEGORY_NAME && (
                    <span className="sup-cat-badge">
                      <Tags size={12} />{ticket.CATEGORY_NAME}
                    </span>
                  )}
                  {(ticket.ESTIMATED_DAYS != null || ticket.ESTIMATED_HOURS != null) && (
                    <span className="sup-cat-sla">
                      <Clock3 size={12} />Est: {ticket.ESTIMATED_DAYS ? `${ticket.ESTIMATED_DAYS}d ` : ''}{ticket.ESTIMATED_HOURS ? `${ticket.ESTIMATED_HOURS}h` : ''}
                    </span>
                  )}
                  <span className={overdue(ticket) ? 'sup-overdue' : ''}>
                    <Clock3 size={13} />{ticket.DUE_AT ? `Due ${dateFmt(ticket.DUE_AT)}` : 'No SLA set'}
                  </span>
                  <button
                    type="button"
                    style={{
                      border: '1px solid #bfdbfe',
                      background: showHistory ? '#dbeafe' : '#eff6ff',
                      color: 'var(--sup-blue)',
                      marginLeft: 'auto',
                      cursor: 'pointer',
                      padding: '3px 10px',
                      borderRadius: 14,
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    onClick={() => {
                      setShowHistory(v => !v);
                      if (!showHistory) {
                        void supportApi.events(ticket.TICKET_ID).then(setEvents);
                      }
                    }}
                  >
                    <Clock3 size={12} /> Activity Log
                  </button>
                </div>

                {/* Rework comments alert banner if rework required */}
                {ticket.REWORK_COMMENTS && ticket.STATUS === 'IN_PROGRESS' && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: 6, padding: '10px 16px', margin: '8px 20px', color: '#9f1239', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      <strong>Rework Required by DevAdmin:</strong>
                      <p style={{ margin: '3px 0 0', lineHeight: 1.4 }}>{ticket.REWORK_COMMENTS}</p>
                    </div>
                  </div>
                )}

                {/* History popup / drawer */}
                {showHistory && (
                  <div className="sup-history-card">
                    <div className="sup-history-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock3 size={15} color="var(--sup-blue)" />
                        <strong style={{ fontSize: 13, color: 'var(--sup-ink)' }}>Ticket Activity & Audit Trail</strong>
                        <span className="sup-history-count">{events.length}</span>
                      </div>
                      <button
                        type="button"
                        className="sup-history-close"
                        onClick={() => setShowHistory(false)}
                        title="Close Audit Trail"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="sup-history-body">
                      {events.map((e, idx) => {
                        const eventType = e.EVENT_TYPE.toUpperCase();
                        const isLast = idx === events.length - 1;
                        let dotTone = 'blue';
                        if (['CLOSED', 'RESOLVED'].includes(eventType)) dotTone = 'green';
                        else if (['REOPENED', 'REWORK'].includes(eventType)) dotTone = 'red';
                        else if (['ASSIGNED'].includes(eventType)) dotTone = 'indigo';
                        else if (['IN_PROGRESS', 'WAITING_INFO'].includes(eventType)) dotTone = 'amber';

                        return (
                          <div key={e.EVENT_ID} className={`sup-history-item tone-${dotTone}`}>
                            <div className="sup-history-marker">
                              <span className="sup-history-dot" />
                              {!isLast && <span className="sup-history-line" />}
                            </div>
                            <div className="sup-history-content">
                              <div className="sup-history-top">
                                <span className={`sup-event-badge badge-${dotTone}`}>
                                  {e.EVENT_TYPE.replaceAll('_', ' ')}
                                </span>
                                <span className="sup-history-actor">
                                  <Users size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                                  {e.ACTOR_LOGINID}
                                </span>
                                <time className="sup-history-time">{dateFmt(e.CREATED_AT)}</time>
                              </div>
                              {e.EVENT_TEXT && (
                                <p className="sup-history-desc">{e.EVENT_TEXT}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {!events.length && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sup-muted)', fontSize: 12.5 }}>
                          No activity events recorded yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Close Confirmation Modal for Admin */}
                {showCloseModal && (
                  <div style={{ padding: '14px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#991b1b', fontSize: 13 }}>Close Ticket #{ticket.TICKET_ID}</strong>
                      <span style={{ fontSize: 11, color: '#b91c1c' }}>Specify reason for closure</span>
                    </div>

                    {/* Quick reason chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Created by mistake', 'Duplicate ticket', 'Resolved directly', 'User guidance provided'].map(r => (
                        <button
                          key={r}
                          type="button"
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, border: '1px solid #fca5a5', background: '#ffffff', color: '#991b1b', cursor: 'pointer' }}
                          onClick={() => setClosingRemark(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <input
                      placeholder="Enter closing reason or resolution summary (e.g. Created by mistake)..."
                      value={closingRemark}
                      onChange={e => setClosingRemark(e.target.value)}
                      style={{ height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 12.5 }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                      <button onClick={() => { setShowCloseModal(false); setClosingRemark(''); }}>Cancel</button>
                      <button
                        className="sup-danger"
                        onClick={() => handleCloseTicket(ticket.TICKET_ID, closingRemark || 'Created by mistake')}
                        disabled={busy}
                      >
                        Confirm & Close Ticket
                      </button>
                    </div>
                  </div>
                )}

                {/* Reopened Ticket Alert: Previous developer is already assigned and working */}
                {ticket.STATUS === 'REOPENED' && ticket.DEVELOPER_LOGINID && (
                  <div style={{ padding: '8px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: '#1e40af', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <RotateCcw size={14} color="#1d4ed8" />
                      <strong>Ticket Reopened:</strong> Assigned developer <strong>{ticket.DEVELOPER_NAME || ticket.DEVELOPER_LOGINID}</strong> will continue work.
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        style={{ padding: '3px 10px', fontSize: 11, background: '#ffffff', border: '1px solid #93c5fd', borderRadius: 4, color: '#1e40af', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => setShowReassign(v => !v)}
                      >
                        {showReassign ? 'Hide Reassign' : 'Reassign to another developer'}
                      </button>
                    )}
                  </div>
                )}

                {/* Admin Assignment Section with Category Master Integration */}
                {isAdmin && !['CLOSED', 'RESOLVED'].includes(ticket.STATUS) && (!ticket.DEVELOPER_LOGINID || showReassign || ticket.STATUS !== 'REOPENED') && (
                  <form
                    className="sup-assignment"
                    onSubmit={e => {
                      e.preventDefault();
                      const slaMin = (Number(estDays) || 0) * 1440 + (Number(estHours) || 0) * 60;
                      const selectedCatObj = categories.find(c => c.CATEGORY_ID === Number(selectedCategory));
                      void run(
                        () => supportApi.assign(ticket.TICKET_ID, {
                          developer_loginid: developer,
                          priority,
                          sla_minutes: slaMin > 0 ? slaMin : Number(estimate) || 480,
                          category_id: selectedCategory ? Number(selectedCategory) : undefined,
                          category_name: selectedCatObj?.CATEGORY_NAME,
                          estimated_days: Number(estDays) || 0,
                          estimated_hours: Number(estHours) || 0
                        }),
                        'Developer assigned with Category SLA and notified.'
                      ).then(() => setShowReassign(false));
                    }}
                  >
                    <label className="sup-assign-cat">
                      Category Master
                      <select
                        value={selectedCategory}
                        onChange={e => {
                          const catId = e.target.value ? Number(e.target.value) : '';
                          setSelectedCategory(catId);
                          const cat = categories.find(c => c.CATEGORY_ID === catId);
                          if (cat) {
                            setEstDays(cat.ESTIMATED_DAYS);
                            setEstHours(cat.ESTIMATED_HOURS);
                            setEstimate(String((cat.ESTIMATED_DAYS * 24 * 60) + (cat.ESTIMATED_HOURS * 60)));
                          }
                        }}
                      >
                        <option value="">-- Select Category --</option>
                        {categories.filter(c => c.ACTIVE_FLAG === 'Y').map(c => (
                          <option key={c.CATEGORY_ID} value={c.CATEGORY_ID}>
                            {c.CATEGORY_NAME} ({c.ESTIMATED_DAYS}d {c.ESTIMATED_HOURS}h)
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="sup-assign-dev">
                      Assign Developer
                      <select required value={developer} onChange={e => setDeveloper(e.target.value)}>
                        <option value="">Select Developer</option>
                        {developers.filter(d => d.ACTIVE_FLAG === 'Y').map(d => (
                          <option key={d.LOGINID} value={d.LOGINID}>{d.USERNAME || d.LOGINID}</option>
                        ))}
                      </select>
                    </label>

                    <label className="sup-assign-priority">
                      Priority
                      <select value={priority} onChange={e => setPriority(e.target.value)}>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="NORMAL">Normal</option>
                        <option value="LOW">Low</option>
                      </select>
                    </label>

                    <label className="sup-assign-num">
                      Est Days
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={estDays}
                        onChange={e => {
                          const d = Number(e.target.value) || 0;
                          setEstDays(d);
                          setEstimate(String((d * 24 * 60) + (Number(estHours) * 60)));
                        }}
                      />
                    </label>

                    <label className="sup-assign-num">
                      Est Hours
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={estHours}
                        onChange={e => {
                          const h = Number(e.target.value) || 0;
                          setEstHours(h);
                          setEstimate(String((Number(estDays) * 24 * 60) + (h * 60)));
                        }}
                      />
                    </label>

                    <button className="sup-primary sup-assign-btn" disabled={busy || !developer}>Assign</button>
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

                {/* Admin Approval & Oppose/Rework of Developer Resolution */}
                {ticket.STATUS === 'RESOLVED' && isAdmin && (
                  <div className="sup-resolution" style={{ padding: '12px 20px', background: '#fef9c3', borderTop: '1px solid #fde047', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#854d0e', fontSize: 13 }}>Developer has submitted resolution:</strong>
                      <p style={{ margin: '4px 0 0', color: '#713f12', fontSize: 12.5 }}>{ticket.RESOLUTION || 'Fix verified by developer.'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="sup-danger"
                        disabled={busy}
                        onClick={() => {
                          setReworkCommentsInput('');
                          setShowReworkModal(true);
                        }}
                        style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title="Reject resolution and send back to developer for rework"
                      >
                        <RotateCcw size={13} />Rework Needed (Not Done)
                      </button>
                      <button
                        type="button"
                        className="sup-success"
                        disabled={busy}
                        onClick={() => handleCloseTicket(ticket.TICKET_ID, ticket.RESOLUTION || 'Developer resolution approved.')}
                        style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title="Accept resolution and close ticket"
                      >
                        <CheckCircle2 size={13} />Approve & Final Close
                      </button>
                    </div>
                  </div>
                )}

                {/* Reopen Ticket for User/Admin */}
                {ticket.STATUS === 'CLOSED' && (
                  <div style={{ padding: '10px 20px', background: '#f1f5f9', borderTop: '1px solid var(--sup-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--sup-ink)' }}>This ticket is closed. If issue persists or needs further attention:</span>
                    <button
                      type="button"
                      className="sup-reopen-btn"
                      onClick={() => {
                        const reason = window.prompt('Please specify reason to reopen:');
                        if (reason) {
                          void run(() => supportApi.update(ticket.TICKET_ID, { status: 'REOPENED', reason }), 'Ticket reopened.');
                        }
                      }}
                    >
                      <RotateCcw size={13} /> Reopen Ticket
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="sup-empty sup-welcome">
                <Headphones size={36} color="var(--sup-blue)" />
                <h2>Select a ticket to view conversation</h2>
                <p>Choose an item from the left queue {isStaff ? 'to view discussion, assignment, and status.' : 'or click "+ New issue" to raise a new request.'}</p>
                {!isStaff && (
                  <button className="sup-primary" onClick={startNewIssue}>
                    <Plus size={15} />New issue
                  </button>
                )}
              </div>
            )}

            {/* Compose Area for active conversation */}
            {!newIssue && ticket && ticket.STATUS !== 'CLOSED' && (
              <div className="sup-compose">
                <textarea
                  ref={textInput}
                  maxLength={8000}
                  value={draft.text}
                  onChange={e => patch({ text: e.target.value })}
                  onPaste={paste}
                  placeholder="Write your reply... (Ctrl + Enter to send)"
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

      {/* DEVELOPER FINISH WORK MODAL */}
      {showDevFinishModal && ticket && (
        <div className="sup-modal-overlay" onClick={() => setShowDevFinishModal(false)}>
          <div className="sup-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sup-modal-head">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}><CheckCircle2 size={18} color="var(--sup-blue)" /> Finish Work & Submit Resolution</h3>
              <button onClick={() => setShowDevFinishModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div className="sup-modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--sup-muted)' }}>
                Please describe the fix details and verified test cases. Once submitted, DevAdmin will review and approve.
              </p>
              <textarea
                autoFocus
                rows={5}
                value={devResolutionInput}
                onChange={e => setDevResolutionInput(e.target.value)}
                placeholder="Explain fix details and verified tests..."
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--sup-line)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div className="sup-modal-foot" style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--sup-line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowDevFinishModal(false)}>Cancel</button>
              <button
                className="sup-primary"
                style={{ background: 'var(--sup-blue)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                disabled={busy || !devResolutionInput.trim()}
                onClick={() => {
                  void run(
                    () => supportApi.progress(ticket.TICKET_ID, 'RESOLVED', devResolutionInput.trim()),
                    'Work finished and resolution submitted to DevAdmin.'
                  ).then(() => {
                    setShowDevFinishModal(false);
                    setDevResolutionInput('');
                  });
                }}
              >
                Submit Resolution to DevAdmin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVADMIN REWORK / OPPOSE MODAL */}
      {showReworkModal && ticket && (
        <div className="sup-modal-overlay" onClick={() => setShowReworkModal(false)}>
          <div className="sup-modal-box" onClick={e => e.stopPropagation()}>
            <div className="sup-modal-head">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#b91c1c' }}><RotateCcw size={18} color="#b91c1c" /> Rework Needed (Oppose Resolution)</h3>
              <button onClick={() => setShowReworkModal(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div className="sup-modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--sup-muted)' }}>
                Explain why the issue is not resolved or what tests failed. The ticket will return to <strong>In Progress (Rework)</strong> and the developer will be notified immediately.
              </p>
              <textarea
                autoFocus
                rows={4}
                value={reworkCommentsInput}
                onChange={e => setReworkCommentsInput(e.target.value)}
                placeholder="Specify what went wrong or additional requirements..."
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div className="sup-modal-foot" style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid var(--sup-line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowReworkModal(false)}>Cancel</button>
              <button
                className="sup-danger"
                style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                disabled={busy || !reworkCommentsInput.trim()}
                onClick={() => {
                  void run(
                    () => supportApi.rejectReopen(ticket.TICKET_ID, reworkCommentsInput.trim()),
                    'Ticket returned to developer for rework.'
                  ).then(() => {
                    setShowReworkModal(false);
                    setReworkCommentsInput('');
                  });
                }}
              >
                Return for Rework
              </button>
            </div>
          </div>
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
