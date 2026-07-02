import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, ImagePlus, Inbox, MessageSquarePlus, Paperclip, RefreshCw, Search, Send, ShieldCheck, Trash2, UserRoundCheck, X } from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  SupportUser,
  deleteSupportMessage,
  getSupportActiveUsers,
  getSupportMessages,
  getSupportTickets,
  markSupportRead,
  sendSupportMessage,
  updateSupportTicket,
} from "../../api/support";
import { API_URL } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { cn } from "../../lib/utils";

type AdminSupportTab = "dashboard" | "tickets" | "users";

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
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedTicket = useMemo(() => tickets.find((ticket) => Number(ticket.TICKET_ID) === selectedId) || null, [tickets, selectedId]);
  const currentUser = user?.loginid || user?.username || "";
  const openTickets = tickets.filter((ticket) => ticket.STATUS !== "CLOSED");
  const closedTickets = tickets.filter((ticket) => ticket.STATUS === "CLOSED");
  const onlineUsers = activeUsers.filter(isSupportUserOnline);
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
    socket.on("support:tickets-changed", (payload: { ticketId?: number }) => {
      void loadAll(false);
      if (selectedId && (!payload.ticketId || Number(payload.ticketId) === selectedId)) {
        void loadMessages(selectedId);
      }
    });
    socket.on("connect_error", () => setNotice("Realtime support connection is not available. Data will refresh automatically."));
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length]);

  const loadAll = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [nextTickets, nextUsers] = await Promise.all([getSupportTickets("admin"), getSupportActiveUsers()]);
      setTickets(nextTickets);
      setActiveUsers(nextUsers);
      if (selectedId && !nextTickets.some((ticket) => Number(ticket.TICKET_ID) === selectedId)) {
        setSelectedId(null);
        setMessages([]);
      }
      setNotice("");
    } catch (error) {
      setNotice(toFriendlyError(error, "Unable to load admin support center"));
    } finally {
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
      setAttachments([]);
      await loadAll(false);
      await loadMessages(selectedId);
    } catch (error) {
      setNotice(toFriendlyError(error, "Unable to send reply"));
    } finally {
      setLoading(false);
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

          <div className="support-center-card span-2">
            <div className="support-center-card-head">
              <h3>Ticket status</h3>
              <span>{loading ? "Loading..." : "Live queue"}</span>
            </div>
            <StatusBar label="Open" value={openTickets.length} max={maxMetric} />
            <StatusBar label="Closed" value={closedTickets.length} max={maxMetric} />
          </div>

          <div className="support-center-card">
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
        </div>
      )}

      {activeTab === "users" && (
        <div className="support-center-card">
          <div className="support-center-card-head">
            <h3>Active users</h3>
            <span>{onlineUsers.length} online</span>
          </div>
          <div className="support-center-user-grid">
            {activeUsers.map((item) => {
              const online = isSupportUserOnline(item);
              const name = item.USERNAME || item.LOGINID || "User";
              return (
                <div className={cn("support-center-user", online && "online")} key={`${item.LOGINID}-${item.TENANT_ID || ""}`}>
                  <div className="support-center-avatar">{name.slice(0, 2).toUpperCase()}<i /></div>
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
                    <em>{ticket.LAST_MESSAGE || "No messages yet"}</em>
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
                <p>{selectedTicket ? `${selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID} - ${selectedTicket.STATUS}` : "Customer conversations appear here with realtime updates."}</p>
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
                const mine = String(message.SENDER_LOGINID || "").toUpperCase() === String(currentUser || "").toUpperCase() || message.SENDER_ROLE === "ADMIN";
                const deleted = message.IS_DELETED === "Y";
                const system = message.SENDER_ROLE === "SYSTEM";
                return (
                  <div className={cn("support-center-message", mine && "mine", system && "system", deleted && "deleted")} key={message.MESSAGE_ID}>
                    <div>
                      <header>
                        <strong>{message.SENDER_NAME || message.SENDER_LOGINID}</strong>
                        <span>{message.CREATED_AT}</span>
                        {!deleted && !system && (
                          <button onClick={() => void removeMessage(Number(message.MESSAGE_ID))} title="Delete message">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </header>
                      <p>{message.MESSAGE_TEXT}</p>
                      {!!message.attachments?.length && (
                        <div className="support-center-files">
                          {message.attachments.map((item) => (
                            <a href={item.DATA_URL || item.FILE_URL} target="_blank" rel="noreferrer" key={item.ATTACHMENT_ID || item.FILE_NAME}>
                              {String(item.FILE_TYPE || "").startsWith("image/") ? <img src={item.DATA_URL || item.FILE_URL} alt={item.FILE_NAME || "Attachment"} /> : <Paperclip size={14} />}
                              <span>{item.FILE_NAME}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="support-center-composer">
              {!!attachments.length && (
                <div className="support-center-pending">
                  {attachments.map((file, index) => (
                    <button key={`${file.file_name}-${index}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      <Paperclip size={13} /> {file.file_name} <X size={12} />
                    </button>
                  ))}
                </div>
              )}
              <div>
                <button className="icon-button" onClick={() => fileInputRef.current?.click()} title="Attach screenshot or file">
                  <ImagePlus size={17} />
                </button>
                <textarea
                  value={compose}
                  onPaste={onPaste}
                  onChange={(event) => setCompose(event.target.value)}
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
        </div>
      )}
    </section>
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

function StatusBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="support-center-statusbar">
      <div><span>{label}</span><strong>{value}</strong></div>
      <i><b style={{ width: `${Math.max(5, (value / max) * 100)}%` }} /></i>
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
