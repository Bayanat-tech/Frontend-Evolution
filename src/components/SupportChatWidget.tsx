import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Headphones, ImagePlus, MessageSquarePlus, Paperclip, RefreshCw, Send, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  SupportUser,
  createSupportTicket,
  getSupportActiveUsers,
  getSupportMessages,
  getSupportTickets,
  markSupportRead,
  sendSupportMessage,
  supportHeartbeat,
  updateSupportTicket,
} from "../api/support";
import { API_URL } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "../lib/utils";

type ChatRole = "user" | "admin";

export function SupportChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ChatRole>("user");
  const [serverCanAdmin, setServerCanAdmin] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<SupportUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compose, setCompose] = useState("");
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [threadNotice, setThreadNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedTicket = useMemo(() => tickets.find((ticket) => Number(ticket.TICKET_ID) === selectedId) || null, [tickets, selectedId]);
  const unreadTotal = tickets.reduce((sum, ticket) => sum + Number(ticket.UNREAD_COUNT || 0), 0);
  const currentUser = user?.loginid || user?.username || "";
  const canUseAdmin = serverCanAdmin;
  const onlineUsers = activeUsers.filter((item) => item.IS_ONLINE === "Y").length;

  useEffect(() => {
    setRole((current) => (canUseAdmin ? current : "user"));
  }, [canUseAdmin]);

  useEffect(() => {
    void supportHeartbeat().catch(() => undefined);
    const timer = window.setInterval(() => void supportHeartbeat().catch(() => undefined), 45000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadAll();
    const timer = window.setInterval(() => void loadAll(false), 30000);
    return () => window.clearInterval(timer);
  }, [open, role]);

  useEffect(() => {
    if (!open) return undefined;
    const token = localStorage.getItem("bayanat_service_token");
    if (!token) return undefined;

    const socket = io(API_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("support:ready", (payload: { role?: string }) => {
      const isAdmin = payload.role === "admin";
      setServerCanAdmin(isAdmin);
      setRole(isAdmin ? "admin" : "user");
    });
    socket.on("support:presence-changed", () => {
      void loadAll(false);
    });
    socket.on("support:tickets-changed", (payload: { ticketId?: number }) => {
      void loadAll(false);
      if (selectedId && (!payload.ticketId || Number(payload.ticketId) === selectedId)) {
        void loadMessages(selectedId);
      }
    });
    socket.on("connect_error", () => {
      setServerCanAdmin(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [open, selectedId, role]);

  useEffect(() => {
    if (!selectedId || !open) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId, open, role]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length]);

  const loadAll = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [nextTickets, nextActive] = await Promise.all([getSupportTickets(role), getSupportActiveUsers()]);
      setTickets(nextTickets);
      setActiveUsers(nextActive);
      const stillVisible = selectedId ? nextTickets.some((ticket) => Number(ticket.TICKET_ID) === selectedId) : true;
      if (selectedId && !stillVisible) {
        setSelectedId(null);
        setMessages([]);
        setThreadNotice("That ticket is no longer available in this view. Select another ticket or start a new request.");
      } else if (!selectedId && nextTickets[0] && !threadNotice) {
        setSelectedId(Number(nextTickets[0].TICKET_ID));
      }
    } catch (error) {
      setNotice(toFriendlySupportError(error, "Unable to load support chat"));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadMessages = async (ticketId: number) => {
    try {
      setThreadNotice("");
      const nextMessages = await getSupportMessages(ticketId, role);
      setMessages(nextMessages);
      await markSupportRead(ticketId).catch(() => undefined);
    } catch (error) {
      const friendly = toFriendlySupportError(error, "Unable to load messages");
      setThreadNotice(friendly);
      if (isTicketAccessError(error)) {
        setSelectedId(null);
        setMessages([]);
        await loadAll(false);
        return;
      }
      setNotice(friendly);
    }
  };

  const send = async () => {
    const message = compose.trim();
    if (!message && !attachments.length) return;
    setLoading(true);
    setNotice("");
    try {
      if (selectedId) {
        await sendSupportMessage(selectedId, { message, attachments }, role);
      } else {
        const created = await createSupportTicket({
          subject: subject.trim() || message.slice(0, 70) || "Support request",
          message,
          module: location.pathname.split("/")[2] || "Workspace",
          page_url: location.pathname,
          priority: "NORMAL",
          attachments,
        });
        setSelectedId(Number(created.ticketId));
      }
      setCompose("");
      setSubject("");
      setAttachments([]);
      await loadAll(false);
      if (selectedId) await loadMessages(selectedId);
    } catch (error) {
      const friendly = toFriendlySupportError(error, "Unable to send message");
      if (isTicketAccessError(error)) {
        setSelectedId(null);
        setMessages([]);
        setThreadNotice(friendly);
      } else {
        setNotice(friendly);
      }
    } finally {
      setLoading(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedId) return;
    await updateSupportTicket(selectedId, { status: "CLOSED" }, role);
    await loadAll(false);
  };

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 3);
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
    pastedFiles.splice(3);

    if (!pastedFiles.length) return;
    event.preventDefault();
    const stampedFiles = pastedFiles.map((file, index) => {
      const extension = file.type.split("/")[1] || "png";
      const filename = file.name || `pasted-screenshot-${Date.now()}-${index + 1}.${extension}`;
      return new File([file], filename, { type: file.type, lastModified: file.lastModified });
    });
    const encoded = await Promise.all(stampedFiles.map(readFile));
    setAttachments((current) => [...current, ...encoded].slice(0, 5));
  };

  return (
    <>
      <button className="support-launcher" onClick={() => setOpen(true)} title="Support chat" aria-label="Support chat">
        <Headphones size={17} />
        {unreadTotal > 0 && <span>{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
      </button>
      {open && (
        <div className="support-shell" role="dialog" aria-label="Support chat">
          <section className={cn("support-panel", role === "admin" ? "admin-mode" : "user-mode")}>
            <header className="support-header">
              <div>
                <p className="eyebrow m-0">Support</p>
                <h2>{canUseAdmin ? "Admin Help Desk" : "Live Help Desk"}</h2>
              </div>
              <div className="support-header-actions">
                <div className="support-mode-badge">
                  {canUseAdmin ? <ShieldCheck size={13} /> : <Headphones size={13} />}
                  {canUseAdmin ? "All tickets" : "My support"}
                </div>
                <button className="icon-button" onClick={() => void loadAll()} title="Refresh"><RefreshCw size={15} /></button>
                <button className="icon-button" onClick={() => setOpen(false)} title="Close"><X size={16} /></button>
              </div>
            </header>

            {notice && <div className="support-notice">{notice}</div>}

            <div className="support-body">
              <aside className="support-sidebar">
                {canUseAdmin && (
                  <div className="support-admin-summary">
                    <div>
                      <strong>{tickets.length}</strong>
                      <span>Open queue</span>
                    </div>
                    <div>
                      <strong>{onlineUsers}</strong>
                      <span>Online now</span>
                    </div>
                  </div>
                )}

                <div className="support-active-users">
                  <div className="support-section-title">
                    <UserRoundCheck size={14} /> Active users
                  </div>
                  <div className="support-user-strip">
                    {activeUsers.slice(0, 8).map((item) => (
                      <div className="support-avatar-wrap" title={`${item.USERNAME || item.LOGINID} ${item.IS_ONLINE === "Y" ? "online" : "offline"}`} key={item.LOGINID}>
                        <div className="support-avatar">{String(item.USERNAME || item.LOGINID).slice(0, 2).toUpperCase()}</div>
                        <span className={cn("presence-dot", item.IS_ONLINE === "Y" && "online")} />
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="support-new-ticket" variant="outline" onClick={() => { setSelectedId(null); setMessages([]); setThreadNotice(""); }}>
                  <MessageSquarePlus size={14} /> New request
                </Button>

                <div className="support-ticket-list">
                  {tickets.map((ticket) => (
                    <button
                      className={cn("support-ticket", selectedId === Number(ticket.TICKET_ID) && "active")}
                      key={ticket.TICKET_ID}
                      onClick={() => { setThreadNotice(""); setSelectedId(Number(ticket.TICKET_ID)); }}
                    >
                      <span className="support-ticket-avatar">
                        {String(ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID || "U").slice(0, 2).toUpperCase()}
                        <i className={cn("presence-dot", ticket.REQUESTER_IS_ONLINE === "Y" && "online")} />
                      </span>
                      <span className="support-ticket-content">
                        <span className="support-ticket-top">
                          <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                          <span className={cn("support-status-chip", ticket.STATUS === "CLOSED" && "closed")}>{ticket.STATUS}</span>
                        </span>
                        <small>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} - {ticket.PRIORITY || "NORMAL"}</small>
                        <em>{ticket.LAST_MESSAGE || "No messages yet"}</em>
                      </span>
                      {Number(ticket.UNREAD_COUNT || 0) > 0 && <b>{ticket.UNREAD_COUNT}</b>}
                    </button>
                  ))}
                  {!tickets.length && <div className="support-empty">{loading ? "Loading..." : "No support tickets yet"}</div>}
                </div>
              </aside>

              <main className="support-chat">
                <div className="support-thread-head">
                  <div>
                    <h3>{selectedTicket ? selectedTicket.SUBJECT || `Ticket ${selectedTicket.TICKET_ID}` : "New Support Request"}</h3>
                    <p>{selectedTicket ? `${selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID} - ${canUseAdmin ? "Customer thread" : "Support thread"}` : "Describe the issue and attach a screenshot if needed."}</p>
                  </div>
                  {selectedTicket && (
                    <div className="support-thread-actions">
                      <span className={cn("support-status-chip", selectedTicket.STATUS === "CLOSED" && "closed")}>{selectedTicket.STATUS}</span>
                      {canUseAdmin && selectedTicket.STATUS !== "CLOSED" && selectedId && (
                        <Button size="sm" variant="outline" onClick={() => void closeTicket()}>
                          <CheckCircle2 size={14} /> Close
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="support-messages" ref={scrollerRef}>
                  {threadNotice && <div className="support-thread-notice">{threadNotice}</div>}
                  {!selectedId && (
                    <div className="support-new-fields">
                      <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
                    </div>
                  )}
                  {messages.map((message) => {
                    const mine = String(message.SENDER_LOGINID || "").toUpperCase() === String(currentUser || "").toUpperCase();
                    return (
                      <div className={cn("support-message", mine && "mine")} key={message.MESSAGE_ID}>
                        <div className="support-message-bubble">
                          <div className="support-message-meta">
                            <strong>{message.SENDER_NAME || message.SENDER_LOGINID}</strong>
                            <span>{message.CREATED_AT}</span>
                          </div>
                          <p>{message.MESSAGE_TEXT}</p>
                          {!!message.attachments?.length && (
                            <div className="support-attachments">
                              {message.attachments.map((item) => (
                                <a href={item.DATA_URL || item.FILE_URL} download={item.FILE_NAME} target="_blank" rel="noreferrer" key={item.ATTACHMENT_ID || item.FILE_NAME}>
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
                  {selectedId && !messages.length && <div className="support-empty centered">No messages in this thread.</div>}
                </div>

                <footer className="support-compose">
                  {!!attachments.length && (
                    <div className="support-pending-files">
                      {attachments.map((file, index) => (
                        <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} key={`${file.file_name}-${index}`}>
                          <Paperclip size={13} /> {file.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="support-compose-row">
                    <button className="icon-button" onClick={() => fileInputRef.current?.click()} title="Attach screenshot or file">
                      <ImagePlus size={17} />
                    </button>
                    <textarea value={compose} onPaste={onPaste} onChange={(event) => setCompose(event.target.value)} placeholder="Type your message or paste a screenshot..." onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }} />
                    <Button onClick={() => void send()} disabled={loading || (!compose.trim() && !attachments.length)}>
                      <Send size={15} /> Send
                    </Button>
                  </div>
                  <input ref={fileInputRef} className="hidden" type="file" accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx" multiple onChange={onFiles} />
                </footer>
              </main>
            </div>
          </section>
        </div>
      )}
    </>
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

function isTicketAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("not found or not accessible");
}

function toFriendlySupportError(error: unknown, fallback: string) {
  if (isTicketAccessError(error)) {
    return "This support ticket is no longer available for your login. Please select another ticket or start a new request.";
  }
  return error instanceof Error ? error.message : fallback;
}
