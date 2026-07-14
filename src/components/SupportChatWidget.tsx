import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Eye, Headphones, ImagePlus, MessageSquarePlus, Paperclip, RefreshCw, Send, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  SupportAttachment,
  SupportAssistantSuggestion,
  SupportMessage,
  SupportTicket,
  SupportUser,
  createSupportTicket,
  deleteSupportMessage,
  getSupportActiveUsers,
  getSupportAssistantSuggestion,
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
import { playSupportRing } from "../utils/supportNotification";

type ChatRole = "user" | "admin";
const SUPPORT_QUICK_EMOJIS = ["\u{1F44D}", "\u{1F64F}", "\u2705", "\u{1F60A}", "\u{1F44C}", "\u{1F680}"];
const QUICK_REPLIES = ["Please check this.", "I have attached a screenshot.", "Thank you.", "It is working now."];

export function SupportChatWidget() {
  const { user } = useAuth();
  const { appCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [previewAttachment, setPreviewAttachment] = useState<SupportAttachment | null>(null);
  const [assistantSuggestion, setAssistantSuggestion] = useState<SupportAssistantSuggestion | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [typingByTicket, setTypingByTicket] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [threadNotice, setThreadNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const adminNotifySocketRef = useRef<Socket | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const loadAllInFlightRef = useRef(false);
  const adminTicketRefreshInFlightRef = useRef(false);
  const selectedIdRef = useRef<number | null>(null);
  const currentUserRef = useRef("");

  const selectedTicket = useMemo(() => tickets.find((ticket) => Number(ticket.TICKET_ID) === selectedId) || null, [tickets, selectedId]);
  const unreadTotal = tickets.reduce((sum, ticket) => sum + Number(ticket.UNREAD_COUNT || 0), 0);
  const currentUser = user?.loginid || user?.username || "";
  const canUseAdmin = serverCanAdmin;
  const likelyAdminUser = isLikelySupportAdmin(user);
  const canOpenAdminPage = canUseAdmin || likelyAdminUser;
  const selectedTicketClosed = selectedTicket?.STATUS === "CLOSED";
  const onlineUsers = activeUsers.filter(isSupportUserOnline).length;
  const visibleActiveUsers = [...activeUsers]
    .sort((first, second) => Number(isSupportUserOnline(second)) - Number(isSupportUserOnline(first)))
    .slice(0, 8);
  const assistantText = `${subject} ${compose}`.trim();

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    setRole((current) => (canUseAdmin ? current : "user"));
  }, [canUseAdmin]);

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
    if (!open) return;
    void loadAll();
    const timer = window.setInterval(() => void loadAll(false), 30000);
    return () => window.clearInterval(timer);
  }, [open, role]);

  useEffect(() => {
    if (!canOpenAdminPage) return undefined;
    const token = localStorage.getItem("bayanat_service_token");
    if (!token) return undefined;

    const connectedAt = Date.now();
    const socket = io(API_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
    adminNotifySocketRef.current = socket;

    socket.on("support:ready", (payload: { role?: string }) => {
      const isAdmin = payload.role === "admin";
      setServerCanAdmin(isAdmin);
      if (isAdmin) void refreshAdminTickets();
    });
    socket.on("support:tickets-changed", (payload: { ticketId?: number; actorLoginid?: string; senderLoginid?: string; loginid?: string } = {}) => {
      void refreshAdminTickets();
      const actor = String(payload.actorLoginid || payload.senderLoginid || payload.loginid || "").trim().toUpperCase();
      const isOwnAction = actor && actor === String(currentUser || "").trim().toUpperCase();
      if (!isOwnAction && Date.now() - connectedAt > 1500) {
        playSupportRing();
      }
    });
    socket.on("connect_error", () => {
      if (!likelyAdminUser) setServerCanAdmin(false);
    });

    return () => {
      socket.disconnect();
      adminNotifySocketRef.current = null;
    };
  }, [canOpenAdminPage, currentUser, likelyAdminUser]);

  const refreshAdminTickets = async () => {
    if (adminTicketRefreshInFlightRef.current) return;
    adminTicketRefreshInFlightRef.current = true;
    try {
      setTickets(await getSupportTickets("admin"));
    } catch {
      // Header badge refresh is best-effort.
    } finally {
      adminTicketRefreshInFlightRef.current = false;
    }
  };

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
      void supportHeartbeat()
        .then(() => loadAll(false))
        .catch(() => undefined);
    });
    socket.on("support:presence-changed", () => {
      void loadAll(false);
    });
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
    socket.on("connect_error", () => {
      setServerCanAdmin(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [open, role]);

  useEffect(() => {
    if (!selectedId || !open) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
    setTypingUsers({});
  }, [selectedId, open, role]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (canUseAdmin || selectedId || assistantText.length < 8) {
      setAssistantSuggestion(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void getSupportAssistantSuggestion({
        subject,
        message: compose,
        module: location.pathname.split("/")[2] || appCode || "Workspace",
      })
        .then(setAssistantSuggestion)
        .catch(() => setAssistantSuggestion(null));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [assistantText, appCode, canUseAdmin, compose, location.pathname, selectedId, subject]);

  const loadAll = async (showLoading = true) => {
    if (loadAllInFlightRef.current) return;
    loadAllInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [nextTickets, nextActive] = await Promise.all([getSupportTickets(role), getSupportActiveUsers()]);
      setTickets(nextTickets);
      setActiveUsers(nextActive);
      const activeTicketId = selectedIdRef.current;
      const stillVisible = activeTicketId ? nextTickets.some((ticket) => Number(ticket.TICKET_ID) === activeTicketId) : true;
      if (activeTicketId && !stillVisible) {
        setSelectedId(null);
        setMessages([]);
        setThreadNotice("That ticket is no longer available in this view. Select another ticket or start a new request.");
      } else if (!activeTicketId && nextTickets[0] && !threadNotice) {
        setSelectedId(Number(nextTickets[0].TICKET_ID));
      }
    } catch (error) {
      setNotice(toFriendlySupportError(error, "Unable to load support chat"));
    } finally {
      loadAllInFlightRef.current = false;
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
          priority: assistantSuggestion?.priority || "NORMAL",
          attachments,
        });
        setSelectedId(Number(created.ticketId));
      }
      setCompose("");
      setSubject("");
      setAttachments([]);
      notifyTyping(false);
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

  const deleteMessage = async (messageId: number) => {
    if (!selectedId) return;
    const ok = window.confirm("Delete this message for everyone?");
    if (!ok) return;
    await deleteSupportMessage(selectedId, messageId, role);
    await loadAll(false);
    await loadMessages(selectedId);
  };

  const clearDraft = () => {
    setCompose("");
    setAttachments([]);
    notifyTyping(false);
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

  const openSupport = () => {
    if (canOpenAdminPage) {
      navigate("/workspace/bt-support/support/admin");
      setOpen(false);
      return;
    }
    setOpen(true);
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
      <button className="support-launcher" onClick={openSupport} title={canOpenAdminPage ? "Admin support center" : "Support chat"} aria-label={canOpenAdminPage ? "Admin support center" : "Support chat"}>
        <Headphones size={17} />
        {unreadTotal > 0 && <span>{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
      </button>
      {open && typeof document !== "undefined" && createPortal(
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

                {canUseAdmin && (
                  <div className="support-active-users">
                    <div className="support-section-title">
                      <UserRoundCheck size={14} /> Active users <span>{onlineUsers} online</span>
                    </div>
                    <div className="support-user-strip">
                      {visibleActiveUsers.map((item) => {
                        const online = isSupportUserOnline(item);
                        const name = item.USERNAME || item.LOGINID || "User";
                        return (
                          <div className={cn("support-avatar-wrap", online && "online")} title={`${name} ${online ? "online" : "away"}`} key={item.LOGINID || name}>
                            <div className="support-avatar">{String(name).slice(0, 2).toUpperCase()}</div>
                            <span className={cn("presence-dot", online && "online")} />
                            <span className="support-active-copy">
                              <strong>{name}</strong>
                              <small>{online ? "Online" : "Away"}</small>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!canUseAdmin && (
                  <Button className="support-new-ticket" variant="outline" onClick={() => { setSelectedId(null); setMessages([]); setThreadNotice(""); }}>
                    <MessageSquarePlus size={14} /> New request
                  </Button>
                )}

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
                        <em className={typingByTicket[Number(ticket.TICKET_ID)] ? "support-ticket-typing" : ""}>
                          {typingByTicket[Number(ticket.TICKET_ID)] || ticket.LAST_MESSAGE || "No messages yet"}
                        </em>
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
                    <h3>{selectedTicket ? selectedTicket.SUBJECT || `Ticket ${selectedTicket.TICKET_ID}` : canUseAdmin ? "Support Queue" : "New Support Request"}</h3>
                    <p className={Object.keys(typingUsers).length ? "is-typing" : ""}>
                      {Object.keys(typingUsers).length
                        ? `${Object.values(typingUsers).join(", ")} typing...`
                        : selectedTicket
                          ? `${selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID} - ${canUseAdmin ? "Customer thread" : "Support thread"}`
                          : canUseAdmin
                            ? "Select a customer ticket from the queue to reply or close it."
                            : "Describe the issue and attach a screenshot if needed."}
                    </p>
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
                  {selectedTicketClosed && (
                    <div className="support-closed-banner">
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>Ticket closed</strong>
                        <p>{canUseAdmin ? "This ticket is closed and remains visible for review." : "Support has closed this ticket. If the issue is not solved, reply below to reopen it."}</p>
                      </div>
                    </div>
                  )}
                  {!selectedId && canUseAdmin && (
                    <div className="support-admin-empty">
                      <MessageSquarePlus size={24} />
                      <strong>{tickets.length ? "Select a ticket" : "No tickets waiting"}</strong>
                      <p>{tickets.length ? "Choose a conversation from the left queue to review messages, reply, or close the request." : "New customer requests will appear here in real time."}</p>
                    </div>
                  )}
                  {!selectedId && !canUseAdmin && (
                    <div className="support-new-fields">
                      <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
                    </div>
                  )}
                  {messages.map((message) => {
                    const mine = String(message.SENDER_LOGINID || "").toUpperCase() === String(currentUser || "").toUpperCase();
                    const deleted = message.IS_DELETED === "Y";
                    const system = message.SENDER_ROLE === "SYSTEM";
                    const canDeleteMessage = !deleted && !system && selectedId && mine;
                    return (
                      <div className={cn("support-message", mine && "mine", system && "system", deleted && "deleted")} key={message.MESSAGE_ID}>
                        <div className="support-message-bubble">
                          <div className="support-message-meta">
                            <strong>{message.SENDER_NAME || message.SENDER_LOGINID}</strong>
                            <span>{message.CREATED_AT}</span>
                            {canDeleteMessage && (
                              <button type="button" onClick={() => void deleteMessage(Number(message.MESSAGE_ID))} title="Delete message for everyone">
                                <X size={11} /> Delete
                              </button>
                            )}
                            {mine && !system && <span className="support-read-state">{message.READ_AT ? "Read" : "Sent"}</span>}
                          </div>
                          <p>{message.MESSAGE_TEXT}</p>
                          {!!message.attachments?.length && (
                            <div className="support-attachments">
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
                  {selectedId && !messages.length && <div className="support-empty centered">No messages in this thread.</div>}
                </div>

                <footer className="support-compose">
                  {!!Object.keys(typingUsers).length && (
                    <div className="support-typing-indicator">{Object.values(typingUsers).join(", ")} typing...</div>
                  )}
                  {!!attachments.length && (
                    <div className="support-pending-files">
                      {attachments.map((file, index) => (
                        <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} key={`${file.file_name}-${index}`} title="Remove attachment">
                          <Paperclip size={13} /> <span>{file.file_name}</span> <X size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="support-emoji-row" aria-label="Quick emojis">
                    {SUPPORT_QUICK_EMOJIS.map((emoji) => (
                      <button type="button" key={emoji} onClick={() => setCompose((current) => `${current}${current ? " " : ""}${emoji}`)} title={`Add ${emoji}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="support-quick-replies" aria-label="Quick replies">
                    {QUICK_REPLIES.map((reply) => (
                      <button type="button" key={reply} onClick={() => setCompose(reply)}>
                        {reply}
                      </button>
                    ))}
                  </div>
                  <div className="support-compose-row">
                    <button className="icon-button" onClick={() => fileInputRef.current?.click()} title="Attach screenshot or file">
                      <ImagePlus size={17} />
                    </button>
                    <textarea value={compose} onPaste={onPaste} onChange={(event) => onComposeChange(event.target.value)} placeholder={selectedTicketClosed && !canUseAdmin ? "Reply to reopen this ticket..." : "Type your message or paste a screenshot..."} onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }} />
                    {(compose.trim() || attachments.length > 0) && (
                      <button className="support-clear-draft" type="button" onClick={clearDraft} title="Clear typed message and attachments" aria-label="Clear typed message and attachments">
                        <X size={14} />
                      </button>
                    )}
                    <Button onClick={() => void send()} disabled={(canUseAdmin && !selectedId) || loading || (!compose.trim() && !attachments.length)}>
                      <Send size={15} /> {selectedTicketClosed && !canUseAdmin ? "Reopen" : "Send"}
                    </Button>
                  </div>
                  <input ref={fileInputRef} className="hidden" type="file" accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx" multiple onChange={onFiles} />
                </footer>
              </main>
            </div>
          </section>
        </div>,
        document.body
      )}
      {previewAttachment && typeof document !== "undefined" && createPortal(
        <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />,
        document.body
      )}
    </>
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

function isSupportUserOnline(item: SupportUser) {
  if (item.IS_ONLINE === "Y") return true;
  if (!item.LAST_SEEN_AT) return false;
  const normalized = String(item.LAST_SEEN_AT).replace(" ", "T");
  const lastSeen = new Date(normalized);
  if (Number.isNaN(lastSeen.getTime())) return false;
  return Date.now() - lastSeen.getTime() <= 5 * 60 * 1000;
}

function isLikelySupportAdmin(user: unknown) {
  const record = (user || {}) as Record<string, unknown>;
  const supportAdminLoginIds = new Set(["ADMIN", "2012020136"]);
  const values = [record.loginid, record.LOGINID, record.username, record.USERNAME, record.role, record.user_role, record.USER_ROLE, record.isAdmin]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim().toUpperCase());
  return values.some((value) => supportAdminLoginIds.has(value) || value === "Y" || value === "TRUE" || value.includes("ADMIN"));
}
