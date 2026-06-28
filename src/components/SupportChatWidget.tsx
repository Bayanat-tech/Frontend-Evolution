import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, Headphones, ImagePlus, MessageSquarePlus, Paperclip, RefreshCw, Send, UserRoundCheck, X } from "lucide-react";
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
import { useAuth } from "../state/AuthContext";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "../lib/utils";

type ChatRole = "user" | "admin";

export function SupportChatWidget({ adminEnabled = false }: { adminEnabled?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ChatRole>(adminEnabled ? "admin" : "user");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<SupportUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compose, setCompose] = useState("");
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const selectedTicket = useMemo(() => tickets.find((ticket) => Number(ticket.TICKET_ID) === selectedId) || null, [tickets, selectedId]);
  const unreadTotal = tickets.reduce((sum, ticket) => sum + Number(ticket.UNREAD_COUNT || 0), 0);
  const currentUser = user?.loginid || user?.username || "";
  const canUseAdmin = adminEnabled || ["ADMIN", "SA", "SUPER"].some((key) => currentUser.toUpperCase().includes(key));

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
    const timer = window.setInterval(() => void loadAll(false), 7000);
    return () => window.clearInterval(timer);
  }, [open, role]);

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
      if (!selectedId && nextTickets[0]) setSelectedId(Number(nextTickets[0].TICKET_ID));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load support chat");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadMessages = async (ticketId: number) => {
    try {
      const nextMessages = await getSupportMessages(ticketId, role);
      setMessages(nextMessages);
      await markSupportRead(ticketId).catch(() => undefined);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load messages");
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
      setNotice(error instanceof Error ? error.message : "Unable to send message");
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

  return (
    <>
      <button className="support-launcher" onClick={() => setOpen(true)} title="Support chat" aria-label="Support chat">
        <Headphones size={17} />
        {unreadTotal > 0 && <span>{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
      </button>
      {open && (
        <div className="support-shell" role="dialog" aria-label="Support chat">
          <div className="support-backdrop" onClick={() => setOpen(false)} />
          <section className="support-panel">
            <header className="support-header">
              <div>
                <p className="eyebrow m-0">Support</p>
                <h2>Live Help Desk</h2>
              </div>
              <div className="support-header-actions">
                {canUseAdmin && (
                  <div className="support-role-switch">
                    <button className={role === "user" ? "active" : ""} onClick={() => setRole("user")}>Mine</button>
                    <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")}>Admin</button>
                  </div>
                )}
                <button className="icon-button" onClick={() => void loadAll()} title="Refresh"><RefreshCw size={15} /></button>
                <button className="icon-button" onClick={() => setOpen(false)} title="Close"><X size={16} /></button>
              </div>
            </header>

            {notice && <div className="support-notice">{notice}</div>}

            <div className="support-body">
              <aside className="support-sidebar">
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

                <Button className="support-new-ticket" variant="outline" onClick={() => { setSelectedId(null); setMessages([]); }}>
                  <MessageSquarePlus size={14} /> New request
                </Button>

                <div className="support-ticket-list">
                  {tickets.map((ticket) => (
                    <button
                      className={cn("support-ticket", selectedId === Number(ticket.TICKET_ID) && "active")}
                      key={ticket.TICKET_ID}
                      onClick={() => setSelectedId(Number(ticket.TICKET_ID))}
                    >
                      <span className={cn("presence-dot", ticket.REQUESTER_IS_ONLINE === "Y" && "online")} />
                      <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                      <small>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} · {ticket.STATUS}</small>
                      <em>{ticket.LAST_MESSAGE || "No messages yet"}</em>
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
                    <p>{selectedTicket ? `${selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID} · ${selectedTicket.STATUS}` : "Describe the issue and attach a screenshot if needed."}</p>
                  </div>
                  {selectedTicket?.STATUS !== "CLOSED" && selectedId && (
                    <Button size="sm" variant="outline" onClick={() => void closeTicket()}>
                      <CheckCircle2 size={14} /> Close
                    </Button>
                  )}
                </div>

                <div className="support-messages" ref={scrollerRef}>
                  {!selectedId && (
                    <div className="support-new-fields">
                      <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
                    </div>
                  )}
                  {messages.map((message) => {
                    const mine = message.SENDER_LOGINID === currentUser;
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
                                <a href={item.DATA_URL} download={item.FILE_NAME} target="_blank" rel="noreferrer" key={item.ATTACHMENT_ID || item.FILE_NAME}>
                                  {String(item.FILE_TYPE || "").startsWith("image/") ? <img src={item.DATA_URL} alt={item.FILE_NAME || "Attachment"} /> : <Paperclip size={14} />}
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
                    <textarea value={compose} onChange={(event) => setCompose(event.target.value)} placeholder="Type your message..." onKeyDown={(event) => {
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
