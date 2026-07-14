import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Bell, BellOff, CheckCircle2, Clock3, Eye, FileText, ImagePlus, Inbox, MessageSquarePlus, Paperclip, RefreshCw, Search, Send, ShieldCheck, TimerReset, Trash2, UserRoundCheck, X } from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  SupportAttachment,
  SupportAssistantSuggestion,
  SupportMessage,
  SupportTicket,
  SupportUser,
  deleteSupportMessage,
  getSupportActiveUsers,
  getSupportAssistantSuggestion,
  getSupportMessages,
  getSupportTickets,
  markSupportRead,
  sendSupportMessage,
  supportHeartbeat,
  updateSupportTicket,
} from "../../api/support";
import { API_URL } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";
import { isSupportRingMuted, setSupportRingMuted } from "../../utils/supportNotification";

type AdminSupportTab = "dashboard" | "tickets" | "report" | "users";
const SUPPORT_QUICK_EMOJIS = ["\u{1F44D}", "\u{1F64F}", "\u2705", "\u{1F60A}", "\u{1F44C}", "\u{1F680}"];
const QUICK_REPLIES = ["We are checking this now.", "Please share a screenshot.", "This is resolved. Please confirm.", "Thank you, we will update shortly."];

export function AdminSupportCenterPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSupportTab>("dashboard");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<SupportUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [compose, setCompose] = useState("");
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<SupportAttachment | null>(null);
  const [assistantSuggestion, setAssistantSuggestion] = useState<SupportAssistantSuggestion | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [typingByTicket, setTypingByTicket] = useState<Record<number, string>>({});
  const [ringMuted, setRingMuted] = useState(() => isSupportRingMuted());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const loadAllInFlightRef = useRef(false);
  const selectedIdRef = useRef<number | null>(null);
  const currentUserRef = useRef("");

  const selectedTicket = useMemo(() => tickets.find((ticket) => Number(ticket.TICKET_ID) === selectedId) || null, [tickets, selectedId]);
  const currentUser = user?.loginid || user?.username || "";
  const openTickets = tickets.filter((ticket) => ticket.STATUS !== "CLOSED");
  const closedTickets = tickets.filter((ticket) => ticket.STATUS === "CLOSED");
  const assignedTickets = tickets.filter((ticket) => ticket.DEVELOPER_LOGINID);
  const unassignedOpenTickets = openTickets.filter((ticket) => !ticket.DEVELOPER_LOGINID);
  const overdueTickets = openTickets.filter(isTicketOverdue);
  const onlineUsers = activeUsers.filter(isSupportUserOnline);
  const awayUsers = activeUsers.filter((item) => !isSupportUserOnline(item));
  const prioritySummary = useMemo(() => buildPrioritySummary(tickets), [tickets]);
  const developerSummary = useMemo(() => buildDeveloperSummary(tickets), [tickets]);
  const reportHealth = tickets.length ? Math.round((closedTickets.length / tickets.length) * 100) : 0;
  const assignmentHealth = openTickets.length ? Math.round((assignedTickets.filter((ticket) => ticket.STATUS !== "CLOSED").length / openTickets.length) * 100) : 100;
  const filteredTickets = tickets.filter((ticket) => {
    const text = [
      ticket.SUBJECT,
      ticket.REQUESTER_NAME,
      ticket.REQUESTER_LOGINID,
      ticket.STATUS,
      ticket.LAST_MESSAGE,
      ticket.PRIORITY,
    ].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const maxMetric = Math.max(tickets.length, 1);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    void supportHeartbeat().catch(() => undefined);
    const beat = () => void supportHeartbeat().catch(() => undefined);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    window.addEventListener("focus", beat);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(beat, 15000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", beat);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    void loadAll();
    const timer = window.setInterval(() => void loadAll(false), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("bayanat_service_token");
    if (!token) return undefined;
    const socket = io(API_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    socket.on("support:ready", () => void loadAll(false));
    socket.on("support:presence-changed", () => void loadAll(false));
    socket.on("support:typing", (payload: { ticketId?: number; loginid?: string; username?: string; typing?: boolean }) => {
      const ticketId = Number(payload.ticketId || 0);
      const typingName = payload.username || payload.loginid || "User";
      if (ticketId) {
        setTypingByTicket((current) => {
          const next = { ...current };
          if (payload.typing) next[ticketId] = `${typingName} typing...`;
          else delete next[ticketId];
          return next;
        });
      }
      const activeTicketId = selectedIdRef.current;
      if (!payload.ticketId || Number(payload.ticketId) !== activeTicketId) return;
      const loginid = String(payload.loginid || "").toUpperCase();
      if (!loginid || loginid === String(currentUserRef.current || "").toUpperCase()) return;
      setTypingUsers((current) => {
        const next = { ...current };
        if (payload.typing) next[loginid] = payload.username || payload.loginid || "User";
        else delete next[loginid];
        return next;
      });
    });
    socket.on("support:tickets-changed", (payload: { ticketId?: number }) => {
      const activeTicketId = selectedIdRef.current;
      if (activeTicketId && (!payload.ticketId || Number(payload.ticketId) === activeTicketId)) {
        void loadMessages(activeTicketId);
      }
      void loadAll(false);
    });
    socket.on("connect_error", () => setNotice("Realtime support connection is not available. Data will refresh automatically."));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onMuteChanged = (event: Event) => setRingMuted(Boolean((event as CustomEvent<{ muted?: boolean }>).detail?.muted));
    window.addEventListener("support:ring-muted-changed", onMuteChanged);
    return () => window.removeEventListener("support:ring-muted-changed", onMuteChanged);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
    setTypingUsers({});
  }, [selectedId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (!selectedTicket) {
      setAssistantSuggestion(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void getSupportAssistantSuggestion({
        subject: selectedTicket.SUBJECT,
        message: selectedTicket.LAST_MESSAGE,
        module: selectedTicket.MODULE_NAME,
      })
        .then(setAssistantSuggestion)
        .catch(() => setAssistantSuggestion(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [selectedTicket?.TICKET_ID, selectedTicket?.LAST_MESSAGE, selectedTicket?.MODULE_NAME, selectedTicket?.SUBJECT]);

  const loadAll = async (showLoading = true) => {
    if (loadAllInFlightRef.current) return;
    loadAllInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [nextTickets, nextUsers] = await Promise.all([getSupportTickets("admin"), getSupportActiveUsers()]);
      setTickets(nextTickets);
      setActiveUsers(nextUsers);
      const activeTicketId = selectedIdRef.current;
      if (activeTicketId && !nextTickets.some((ticket) => Number(ticket.TICKET_ID) === activeTicketId)) {
        setSelectedId(null);
        setMessages([]);
      }
      setNotice("");
    } catch (error) {
      setNotice(toFriendlyError(error, "Unable to load admin support center"));
    } finally {
      loadAllInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  };

  const loadMessages = async (ticketId: number) => {
    try {
      const nextMessages = await getSupportMessages(ticketId, "admin");
      setMessages(nextMessages);
      await markSupportRead(ticketId).catch(() => undefined);
    } catch (error) {
      setNotice(toFriendlyError(error, "Unable to load this support thread"));
      setSelectedId(null);
      setMessages([]);
    }
  };

  const send = async () => {
    const message = compose.trim();
    if (!selectedId || (!message && !attachments.length)) return;
    setLoading(true);
    try {
      await sendSupportMessage(selectedId, { message, attachments }, "admin");
      setCompose("");
      notifyTyping(false);
      setAttachments([]);
      await loadAll(false);
      await loadMessages(selectedId);
    } catch (error) {
      setNotice(toFriendlyError(error, "Unable to send reply"));
    } finally {
      setLoading(false);
    }
  };

  const notifyTyping = (typing: boolean) => {
    if (!selectedTicket) return;
    socketRef.current?.emit("support:typing", {
      ticketId: selectedTicket.TICKET_ID,
      requesterLoginid: selectedTicket.REQUESTER_LOGINID,
      assignedTo: selectedTicket.ASSIGNED_TO,
      typing,
    });
  };

  const onComposeChange = (value: string) => {
    setCompose(value);
    notifyTyping(Boolean(value.trim()));
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    if (value.trim()) {
      typingStopRef.current = window.setTimeout(() => notifyTyping(false), 1600);
    }
  };

  const closeTicket = async () => {
    if (!selectedId) return;
    await updateSupportTicket(selectedId, { status: "CLOSED" }, "admin");
    await loadAll(false);
    await loadMessages(selectedId);
  };

  const removeMessage = async (messageId: number) => {
    if (!selectedId) return;
    const ok = window.confirm("Delete this message for everyone?");
    if (!ok) return;
    await deleteSupportMessage(selectedId, messageId, "admin");
    await loadMessages(selectedId);
  };

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 5);
    const encoded = await Promise.all(files.map(readFile));
    setAttachments((current) => [...current, ...encoded].slice(0, 5));
    event.target.value = "";
  };

  const onPaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles: File[] = [];
    Array.from(event.clipboardData.items).forEach((item) => {
      if (item.kind !== "file") return;
      const file = item.getAsFile();
      if (file?.type.startsWith("image/")) pastedFiles.push(file);
    });
    if (!pastedFiles.length) return;
    event.preventDefault();
    const encoded = await Promise.all(pastedFiles.slice(0, 3).map(readFile));
    setAttachments((current) => [...current, ...encoded].slice(0, 5));
  };

  return (
    <section className="support-center-page">
      <div className="support-center-hero">
        <div>
          <p className="eyebrow m-0">Support</p>
          <h1>Admin Support Center</h1>
          <span>Monitor customers, reply in real time, close resolved tickets, and review closed history.</span>
        </div>
        <div className="support-center-actions">
          <Button variant="outline" onClick={() => void loadAll()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => { setSupportRingMuted(!ringMuted); setRingMuted(!ringMuted); }} title={ringMuted ? "Unmute support ring" : "Mute support ring"}>
            {ringMuted ? <BellOff size={15} /> : <Bell size={15} />} {ringMuted ? "Muted" : "Sound"}
          </Button>
          <div className="support-center-live">
            <span />
            Realtime active
          </div>
        </div>
      </div>

      {notice && <div className="support-center-notice">{notice}</div>}

      <div className="support-center-tabs">
        <button className={cn(activeTab === "dashboard" && "active")} onClick={() => setActiveTab("dashboard")}>
          <BarChart3 size={16} /> Dashboard
        </button>
        <button className={cn(activeTab === "tickets" && "active")} onClick={() => setActiveTab("tickets")}>
          <Inbox size={16} /> Support Reply
        </button>
        <button className={cn(activeTab === "report" && "active")} onClick={() => setActiveTab("report")}>
          <FileText size={16} /> Report
        </button>
        <button className={cn(activeTab === "users" && "active")} onClick={() => setActiveTab("users")}>
          <UserRoundCheck size={16} /> Online Users
        </button>
      </div>

      {activeTab === "dashboard" && (
        <div className="support-center-dashboard">
          <MetricCard label="Total tickets" value={tickets.length} icon={<Inbox size={18} />} />
          <MetricCard label="Open queue" value={openTickets.length} icon={<Clock3 size={18} />} tone="blue" />
          <MetricCard label="Closed tickets" value={closedTickets.length} icon={<CheckCircle2 size={18} />} tone="green" />
          <MetricCard label="Online now" value={onlineUsers.length} icon={<UserRoundCheck size={18} />} tone="teal" />

          <div className="support-center-card support-center-status-card">
            <div className="support-center-card-head">
              <h3>Ticket status</h3>
              <span>{loading ? "Loading..." : "Live queue"}</span>
            </div>
            <TicketStatusChart open={openTickets.length} closed={closedTickets.length} total={tickets.length} />
          </div>

          <div className="support-center-card support-center-recent-card">
            <div className="support-center-card-head">
              <h3>Recent tickets</h3>
              <span>{tickets.length} total</span>
            </div>
            <div className="support-center-mini-list">
              {tickets.slice(0, 6).map((ticket) => (
                <button key={ticket.TICKET_ID} onClick={() => { setSelectedId(Number(ticket.TICKET_ID)); setActiveTab("tickets"); }}>
                  <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                  <span>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} - {ticket.STATUS}</span>
                </button>
              ))}
              {!tickets.length && <p>No tickets found.</p>}
            </div>
          </div>

          <div className="support-center-card support-center-live-card">
            <div className="support-center-card-head">
              <h3>Live users</h3>
              <span>{onlineUsers.length} online</span>
            </div>
            <div className="support-center-mini-users">
              {onlineUsers.slice(0, 6).map((item) => {
                const online = isSupportUserOnline(item);
                const name = item.USERNAME || item.LOGINID || "User";
                return (
                  <button key={`${item.LOGINID}-${item.TENANT_ID || ""}`} onClick={() => setActiveTab("users")}>
                    <span className="support-center-avatar">{name.slice(0, 2).toUpperCase()}<i className={online ? "online" : ""} /></span>
                    <span>
                      <strong>{name}</strong>
                      <em>{online ? "Online" : "Away"}</em>
                    </span>
                  </button>
                );
              })}
              {!onlineUsers.length && <p>No users are online right now.</p>}
            </div>
          </div>

          <div className="support-center-card support-center-insight-card">
            <div className="support-center-card-head">
              <h3>Queue insight</h3>
              <span>Workload view</span>
            </div>
            <div className="support-center-insight-grid">
              <InsightBar label="Open workload" value={openTickets.length} max={maxMetric} tone="blue" />
              <InsightBar label="Closed ratio" value={closedTickets.length} max={maxMetric} tone="green" />
              <InsightBar label="Online coverage" value={onlineUsers.length} max={Math.max(activeUsers.length, 1)} tone="teal" />
            </div>
          </div>

          <div className="support-center-card support-center-attention-card">
            <div className="support-center-card-head">
              <h3>Attention queue</h3>
              <span>{openTickets.length} open</span>
            </div>
            <div className="support-center-attention-list">
              {openTickets.slice(0, 4).map((ticket) => (
                <button key={ticket.TICKET_ID} onClick={() => { setSelectedId(Number(ticket.TICKET_ID)); setActiveTab("tickets"); }}>
                  <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                  <span>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID}</span>
                  <em>{ticket.LAST_MESSAGE || "Waiting for first reply"}</em>
                </button>
              ))}
              {!openTickets.length && <p>All open requests are cleared.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "report" && (
        <div className="support-report-page">
          <div className="support-report-banner">
            <div>
              <p className="eyebrow m-0">Phase 1 report</p>
              <h2>Support performance overview</h2>
              <span>Live ticket health, SLA attention, priority spread and developer workload in one review screen.</span>
            </div>
            <div className="support-report-score">
              <strong>{reportHealth}%</strong>
              <span>Closure health</span>
            </div>
          </div>

          <div className="support-report-kpis">
            <ReportKpi title="Open tickets" value={openTickets.length} subtitle={`${unassignedOpenTickets.length} unassigned`} icon={<Inbox size={17} />} />
            <ReportKpi title="SLA risk" value={overdueTickets.length} subtitle={overdueTickets.length ? "Needs attention" : "On track"} tone={overdueTickets.length ? "amber" : "green"} icon={<TimerReset size={17} />} />
            <ReportKpi title="Assigned" value={assignedTickets.length} subtitle={`${assignmentHealth}% open coverage`} tone="blue" icon={<UserRoundCheck size={17} />} />
            <ReportKpi title="Online users" value={onlineUsers.length} subtitle={`${activeUsers.length} tracked`} tone="teal" icon={<Activity size={17} />} />
          </div>

          <div className="support-report-grid">
            <div className="support-report-card support-report-wide">
              <div className="support-center-card-head">
                <h3>Ticket health</h3>
                <span>{tickets.length} total</span>
              </div>
              <div className="support-report-health">
                <div className="support-report-meter">
                  <i style={{ width: `${Math.max(reportHealth, tickets.length ? 6 : 0)}%` }} />
                </div>
                <div className="support-report-health-legend">
                  <span><b className="blue-dot" /> Open queue <strong>{openTickets.length}</strong></span>
                  <span><b className="green-dot" /> Closed tickets <strong>{closedTickets.length}</strong></span>
                  <span><b className="amber-dot" /> Overdue SLA <strong>{overdueTickets.length}</strong></span>
                </div>
              </div>
            </div>

            <div className="support-report-card">
              <div className="support-center-card-head">
                <h3>Priority spread</h3>
                <span>{prioritySummary.length} levels</span>
              </div>
              <div className="support-report-priority">
                {prioritySummary.map((item) => (
                  <div key={item.label}>
                    <span className={`support-priority-dot ${item.tone}`} />
                    <strong>{item.label}</strong>
                    <em>{item.count}</em>
                    <i><b style={{ width: `${item.percent}%` }} /></i>
                  </div>
                ))}
              </div>
            </div>

            <div className="support-report-card">
              <div className="support-center-card-head">
                <h3>Developer workload</h3>
                <span>{developerSummary.length} assigned</span>
              </div>
              <div className="support-report-devs">
                {developerSummary.slice(0, 6).map((item) => (
                  <div key={item.name}>
                    <span>{item.name.slice(0, 2).toUpperCase()}</span>
                    <strong>{item.name}</strong>
                    <em>{item.count} ticket{item.count === 1 ? "" : "s"}</em>
                  </div>
                ))}
                {!developerSummary.length && <p>No developer assignments yet.</p>}
              </div>
            </div>

            <div className="support-report-card support-report-wide">
              <div className="support-center-card-head">
                <h3>Attention report</h3>
                <span>{overdueTickets.length + unassignedOpenTickets.length} action items</span>
              </div>
              <div className="support-report-attention">
                {[...overdueTickets, ...unassignedOpenTickets]
                  .filter((ticket, index, array) => array.findIndex((item) => item.TICKET_ID === ticket.TICKET_ID) === index)
                  .slice(0, 6)
                  .map((ticket) => (
                    <button key={ticket.TICKET_ID} onClick={() => { setSelectedId(Number(ticket.TICKET_ID)); setActiveTab("tickets"); }}>
                      <AlertTriangle size={15} />
                      <span>
                        <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                        <em>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} - {ticket.DEVELOPER_LOGINID ? formatDueLabel(ticket) : "No developer assigned"}</em>
                      </span>
                      <b>{ticket.PRIORITY || "NORMAL"}</b>
                    </button>
                  ))}
                {!overdueTickets.length && !unassignedOpenTickets.length && <p>All open tickets have developer coverage and no SLA risk.</p>}
              </div>
            </div>

            <div className="support-report-card">
              <div className="support-center-card-head">
                <h3>Recent activity</h3>
                <span>Latest 5</span>
              </div>
              <div className="support-report-activity">
                {tickets.slice(0, 5).map((ticket) => (
                  <button key={ticket.TICKET_ID} onClick={() => { setSelectedId(Number(ticket.TICKET_ID)); setActiveTab("tickets"); }}>
                    <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                    <span>{ticket.LAST_MESSAGE || "No latest message"}</span>
                    <em>{ticket.LAST_MESSAGE_AT || ticket.CREATED_AT || "-"}</em>
                  </button>
                ))}
                {!tickets.length && <p>No ticket activity available.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="support-center-users-page">
          <div className="support-center-presence-summary">
            <div>
              <UserRoundCheck size={15} />
              <strong>{activeUsers.length}</strong>
              <span>Total users</span>
            </div>
            <div className="online">
              <CheckCircle2 size={15} />
              <strong>{onlineUsers.length}</strong>
              <span>Online now</span>
            </div>
            <div>
              <Clock3 size={15} />
              <strong>{awayUsers.length}</strong>
              <span>Away</span>
            </div>
          </div>

          <div className="support-center-card support-center-presence-board online-board">
            <div className="support-center-card-head">
              <h3>Online now</h3>
              <span>{onlineUsers.length} active</span>
            </div>
            <div className="support-center-presence-grid">
              {onlineUsers.map((item) => {
                const name = item.USERNAME || item.LOGINID || "User";
                return <PresenceCard item={item} name={name} online key={`${item.LOGINID}-${item.TENANT_ID || ""}`} />;
              })}
              {!onlineUsers.length && <p className="support-center-muted">No users are online right now.</p>}
            </div>
          </div>

          <div className="support-center-card support-center-presence-board away-board">
            <div className="support-center-card-head">
              <h3>Away users</h3>
              <span>{awayUsers.length} away</span>
            </div>
            <div className="support-center-presence-grid">
              {awayUsers.map((item) => {
                const name = item.USERNAME || item.LOGINID || "User";
                return <PresenceCard item={item} name={name} online={false} key={`${item.LOGINID}-${item.TENANT_ID || ""}`} />;
              })}
              {!awayUsers.length && <p className="support-center-muted">No away users found.</p>}
            </div>
          </div>

          <div className="support-center-card support-center-presence-board all-users">
            <div className="support-center-card-head">
              <h3>All users</h3>
              <span>{activeUsers.length} visible</span>
            </div>
            <div className="support-center-user-grid">
              {activeUsers.map((item) => {
              const online = isSupportUserOnline(item);
              const name = item.USERNAME || item.LOGINID || "User";
              return (
                <div className={cn("support-center-user", online && "online")} key={`${item.LOGINID}-${item.TENANT_ID || ""}`}>
                  <div className="support-center-avatar">{name.slice(0, 2).toUpperCase()}<i className={online ? "online" : ""} /></div>
                  <div>
                    <strong>{name}</strong>
                    <span>{item.LOGINID} - {online ? "Online" : "Away"}</span>
                    <small>{item.TENANT_ID || item.COMPANY_CODE || "Tenant"}</small>
                  </div>
                </div>
              );
              })}
              {!activeUsers.length && <p className="support-center-muted">No active users found.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "tickets" && (
        <div className="support-center-workbench">
          <aside className="support-center-queue">
            <div className="support-center-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets, user, status..." />
            </div>
            <div className="support-center-ticket-list">
              {filteredTickets.map((ticket) => (
                <button
                  className={cn("support-center-ticket", selectedId === Number(ticket.TICKET_ID) && "active")}
                  key={ticket.TICKET_ID}
                  onClick={() => setSelectedId(Number(ticket.TICKET_ID))}
                >
                  <span className="support-center-avatar">{String(ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID || "U").slice(0, 2).toUpperCase()}<i className={ticket.REQUESTER_IS_ONLINE === "Y" ? "online" : ""} /></span>
                  <span>
                    <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                    <small>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} - {ticket.PRIORITY || "NORMAL"}</small>
                    <em className={typingByTicket[Number(ticket.TICKET_ID)] ? "support-ticket-typing" : ""}>
                      {typingByTicket[Number(ticket.TICKET_ID)] || ticket.LAST_MESSAGE || "No messages yet"}
                    </em>
                  </span>
                  <b className={cn(ticket.STATUS === "CLOSED" && "closed")}>{ticket.STATUS}</b>
                </button>
              ))}
              {!filteredTickets.length && <div className="support-center-empty">No tickets match this search.</div>}
            </div>
          </aside>

          <main className="support-center-thread">
            <header>
              <div>
                <h2>{selectedTicket ? selectedTicket.SUBJECT || `Ticket ${selectedTicket.TICKET_ID}` : "Select a support ticket"}</h2>
                <p className={Object.keys(typingUsers).length ? "is-typing" : ""}>
                  {Object.keys(typingUsers).length
                    ? `${Object.values(typingUsers).join(", ")} typing...`
                    : selectedTicket
                      ? `${selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID} - ${selectedTicket.STATUS}`
                      : "Customer conversations appear here with realtime updates."}
                </p>
              </div>
              {selectedTicket && selectedTicket.STATUS !== "CLOSED" && (
                <Button variant="outline" onClick={() => void closeTicket()}>
                  <CheckCircle2 size={15} /> Close ticket
                </Button>
              )}
            </header>

            <div className="support-center-messages" ref={scrollerRef}>
              {!selectedTicket && (
                <div className="support-center-empty-state">
                  <MessageSquarePlus size={28} />
                  <strong>No ticket selected</strong>
                  <span>Pick a ticket from the queue to review the conversation.</span>
                </div>
              )}
              {selectedTicket?.STATUS === "CLOSED" && (
                <div className="support-center-closed">
                  <ShieldCheck size={16} />
                  This ticket is closed. It remains available for audit and follow-up history.
                </div>
              )}
              {messages.map((message) => {
                const mine = String(message.SENDER_LOGINID || "").toUpperCase() === String(currentUser || "").toUpperCase();
                const deleted = message.IS_DELETED === "Y";
                const system = message.SENDER_ROLE === "SYSTEM";
                return (
                  <div className={cn("support-center-message", mine && "mine", system && "system", deleted && "deleted")} key={message.MESSAGE_ID}>
                    <div>
                      <header>
                        <strong>{message.SENDER_NAME || message.SENDER_LOGINID}</strong>
                        <span>{message.CREATED_AT}</span>
                        {!deleted && !system && mine && (
                          <button onClick={() => void removeMessage(Number(message.MESSAGE_ID))} title="Delete message">
                            <Trash2 size={12} />
                          </button>
                        )}
                        {mine && !system && <span className="support-read-state">{message.READ_AT ? "Read" : "Sent"}</span>}
                      </header>
                      <p>{message.MESSAGE_TEXT}</p>
                      {!!message.attachments?.length && (
                        <div className="support-center-files">
                          {message.attachments.map((item) => (
                            <button type="button" onClick={() => setPreviewAttachment(item)} key={item.ATTACHMENT_ID || item.FILE_NAME}>
                              {String(item.FILE_TYPE || "").startsWith("image/") ? <img src={item.DATA_URL || item.FILE_URL} alt={item.FILE_NAME || "Attachment"} /> : <Paperclip size={14} />}
                              <span>{item.FILE_NAME}</span>
                              <Eye size={13} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="support-center-composer">
              {!!Object.keys(typingUsers).length && (
                <div className="support-typing-indicator">{Object.values(typingUsers).join(", ")} typing...</div>
              )}
              {!!attachments.length && (
                <div className="support-center-pending">
                  {attachments.map((file, index) => (
                    <button key={`${file.file_name}-${index}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      <Paperclip size={13} /> {file.file_name} <X size={12} />
                    </button>
                  ))}
                </div>
              )}
              <div className="support-center-emoji-row" aria-label="Quick emojis">
                {SUPPORT_QUICK_EMOJIS.map((emoji) => (
                  <button type="button" key={emoji} onClick={() => setCompose((current) => `${current}${current ? " " : ""}${emoji}`)} disabled={!selectedTicket} title={`Add ${emoji}`}>
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="support-quick-replies" aria-label="Quick replies">
                {[
                  ...(assistantSuggestion?.suggestedReply ? [assistantSuggestion.suggestedReply] : []),
                  ...QUICK_REPLIES,
                ].filter((reply, index, items) => items.indexOf(reply) === index).map((reply) => (
                  <button type="button" key={reply} disabled={!selectedTicket} onClick={() => setCompose(reply)}>
                    {reply}
                  </button>
                ))}
              </div>
              {selectedTicket && assistantSuggestion && (
                <div className="support-ai-suggestion admin">
                  <span>{assistantSuggestion.category}</span>
                  <strong>{assistantSuggestion.priority}</strong>
                  <em>{assistantSuggestion.developerGroup}</em>
                  <button type="button" onClick={() => setCompose(assistantSuggestion.suggestedReply)}>
                    Use suggestion
                  </button>
                </div>
              )}
              <div>
                <button className="icon-button" onClick={() => fileInputRef.current?.click()} title="Attach screenshot or file">
                  <ImagePlus size={17} />
                </button>
                <textarea
                  value={compose}
                  onPaste={onPaste}
                  onChange={(event) => onComposeChange(event.target.value)}
                  placeholder={selectedTicket ? "Reply to customer or paste a screenshot..." : "Select a ticket before replying..."}
                  disabled={!selectedTicket}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                {(compose.trim() || attachments.length > 0) && (
                  <button className="support-center-clear" onClick={() => { setCompose(""); setAttachments([]); }} title="Clear draft">
                    <X size={14} />
                  </button>
                )}
                <Button onClick={() => void send()} disabled={!selectedTicket || loading || (!compose.trim() && !attachments.length)}>
                  <Send size={15} /> Send
                </Button>
              </div>
              <input ref={fileInputRef} className="hidden" type="file" accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx" multiple onChange={onFiles} />
            </footer>
          </main>

          <aside className="support-center-context">
            <div className="support-context-profile">
              <span className="support-center-avatar">
                {String(selectedTicket?.REQUESTER_NAME || selectedTicket?.REQUESTER_LOGINID || "ST").slice(0, 2).toUpperCase()}
                <i className={selectedTicket?.REQUESTER_IS_ONLINE === "Y" ? "online" : ""} />
              </span>
              <div>
                <h3>{selectedTicket?.REQUESTER_NAME || selectedTicket?.REQUESTER_LOGINID || "Ticket details"}</h3>
                <span>{selectedTicket?.REQUESTER_IS_ONLINE === "Y" ? "Online" : "Support customer"}</span>
              </div>
            </div>
            <div className="support-context-fields">
              <div>
                <span>Ticket</span>
                <strong>{selectedTicket ? `#${selectedTicket.TICKET_ID}` : "-"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selectedTicket?.STATUS || "-"}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>{selectedTicket?.PRIORITY || "-"}</strong>
              </div>
              <div>
                <span>Assigned developer</span>
                <strong>{selectedTicket?.DEVELOPER_NAME || selectedTicket?.DEVELOPER_LOGINID || "Not assigned"}</strong>
              </div>
              <div>
                <span>Developer status</span>
                <strong>{selectedTicket?.DEV_STATUS || "UNASSIGNED"}</strong>
              </div>
              <div>
                <span>Module</span>
                <strong>{selectedTicket?.MODULE_NAME || "-"}</strong>
              </div>
            </div>
            <div className="support-context-note">
              <h3>Latest summary</h3>
              <p>{selectedTicket?.LAST_MESSAGE || "Select a ticket to view the latest customer message and assignment state."}</p>
            </div>
          </aside>
        </div>
      )}
      {previewAttachment && (
        <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}
    </section>
  );
}

function ReportKpi({ title, value, subtitle, icon, tone }: { title: string; value: number; subtitle: string; icon: React.ReactNode; tone?: "blue" | "green" | "teal" | "amber" }) {
  return (
    <div className={cn("support-report-kpi", tone)}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <em>{title}</em>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: string }) {
  return (
    <div className={cn("support-center-metric", tone)}>
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function buildPrioritySummary(tickets: SupportTicket[]) {
  const order = ["CRITICAL", "HIGH", "MEDIUM", "NORMAL", "LOW"];
  const counts = new Map<string, number>();
  tickets.forEach((ticket) => {
    const key = String(ticket.PRIORITY || "NORMAL").toUpperCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const total = Math.max(tickets.length, 1);
  return order
    .filter((label) => counts.has(label) || label === "NORMAL")
    .map((label) => ({
      label,
      count: counts.get(label) || 0,
      percent: Math.max(counts.get(label) ? 8 : 2, Math.round(((counts.get(label) || 0) / total) * 100)),
      tone: priorityTone(label),
    }));
}

function buildDeveloperSummary(tickets: SupportTicket[]) {
  const counts = new Map<string, number>();
  tickets.forEach((ticket) => {
    const name = ticket.DEVELOPER_NAME || ticket.DEVELOPER_LOGINID;
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
}

function isTicketOverdue(ticket: SupportTicket) {
  if (ticket.STATUS === "CLOSED" || !ticket.DUE_AT) return false;
  const due = parseSupportDate(ticket.DUE_AT);
  return Boolean(due && due.getTime() < Date.now());
}

function formatDueLabel(ticket: SupportTicket) {
  if (!ticket.DUE_AT) return "No SLA timer";
  const due = parseSupportDate(ticket.DUE_AT);
  if (!due) return "SLA date unavailable";
  const diffMinutes = Math.round((due.getTime() - Date.now()) / 60000);
  if (diffMinutes < 0) return `Overdue by ${formatMinutes(Math.abs(diffMinutes))}`;
  return `Due in ${formatMinutes(diffMinutes)}`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  return dayHours ? `${days}d ${dayHours}h` : `${days}d`;
}

function parseSupportDate(value: string) {
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function priorityTone(priority: string) {
  const key = priority.toUpperCase();
  if (key === "CRITICAL" || key === "HIGH") return "danger";
  if (key === "MEDIUM" || key === "NORMAL") return "blue";
  return "muted";
}

function TicketStatusChart({ open, closed, total }: { open: number; closed: number; total: number }) {
  const chartTotal = Math.max(total, 1);
  const openPercent = Math.round((open / chartTotal) * 100);
  const closedPercent = Math.round((closed / chartTotal) * 100);
  return (
    <div className="support-center-status-chart">
      <div className="support-status-hero">
        <span>Live workload</span>
        <strong>{total}</strong>
        <small>Total tickets tracked</small>
      </div>
      <div className="support-center-status-lines">
        <div>
          <i className="open" />
          <span>Open queue</span>
          <em><b style={{ width: `${Math.max(open ? 8 : 2, openPercent)}%` }} /></em>
          <strong>{open}</strong>
        </div>
        <div>
          <i className="closed" />
          <span>Closed tickets</span>
          <em><b style={{ width: `${Math.max(closed ? 8 : 2, closedPercent)}%` }} /></em>
          <strong>{closed}</strong>
        </div>
      </div>
    </div>
  );
}

function InsightBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "blue" | "green" | "teal" }) {
  const percent = Math.max(4, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="support-center-insight-bar">
      <div><span>{label}</span><strong>{value}</strong></div>
      <i className={tone}><b style={{ width: `${percent}%` }} /></i>
    </div>
  );
}

function PresenceCard({ item, name, online }: { item: SupportUser; name: string; online: boolean }) {
  return (
    <div className={cn("support-center-presence-card", online && "online")}>
      <div className="support-center-avatar">{name.slice(0, 2).toUpperCase()}<i className={online ? "online" : ""} /></div>
      <div>
        <strong>{name}</strong>
        <span>{item.LOGINID}</span>
        <small>{item.TENANT_ID || item.COMPANY_CODE || "Tenant"}</small>
      </div>
      <em>{online ? "Online" : "Away"}</em>
    </div>
  );
}

function AttachmentPreviewModal({ attachment, onClose }: { attachment: SupportAttachment; onClose: () => void }) {
  const src = attachment.DATA_URL || attachment.FILE_URL || attachment.data_url || "";
  const type = String(attachment.FILE_TYPE || attachment.file_type || "");
  const name = attachment.FILE_NAME || attachment.file_name || "Attachment";
  return (
    <div className="support-preview-backdrop" role="dialog" aria-label="Attachment preview">
      <div className="support-preview-card">
        <header>
          <strong>{name}</strong>
          <button type="button" onClick={onClose} aria-label="Close preview"><X size={16} /></button>
        </header>
        {type.startsWith("image/") ? <img src={src} alt={name} /> : <iframe src={src} title={name} />}
        <footer>
          <a href={src} target="_blank" rel="noreferrer" download={name}>Open / download</a>
        </footer>
      </div>
    </div>
  );
}

function readFile(file: File): Promise<SupportAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read attachment"));
    reader.onload = () => resolve({
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      data_url: String(reader.result || ""),
    });
    reader.readAsDataURL(file);
  });
}

function isSupportUserOnline(item: SupportUser) {
  if (item.IS_ONLINE === "Y") return true;
  if (!item.LAST_SEEN_AT) return false;
  const lastSeen = new Date(String(item.LAST_SEEN_AT).replace(" ", "T"));
  if (Number.isNaN(lastSeen.getTime())) return false;
  return Date.now() - lastSeen.getTime() <= 5 * 60 * 1000;
}

function toFriendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
