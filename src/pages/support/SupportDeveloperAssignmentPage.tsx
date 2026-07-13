import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Filter, Mail, MessageSquare, MoreHorizontal, RefreshCw, Search, UserPlus } from "lucide-react";
import {
  SupportDeveloper,
  SupportTicket,
  assignSupportDeveloper,
  getSupportDevelopers,
  getSupportTickets,
  saveSupportDeveloper,
} from "../../api/support";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const SLA_OPTIONS = [
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "1 day" },
  { value: "2880", label: "2 days" },
];

export function SupportDeveloperAssignmentPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [developers, setDevelopers] = useState<SupportDeveloper[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedDeveloper, setSelectedDeveloper] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [slaMinutes, setSlaMinutes] = useState("480");
  const [developerForm, setDeveloperForm] = useState({ loginid: "", username: "", email_id: "", skill_tags: "" });
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedTicket = tickets.find((ticket) => Number(ticket.TICKET_ID) === selectedTicketId) || null;
  const openTickets = tickets.filter((ticket) => ticket.STATUS !== "CLOSED");
  const assignedTickets = tickets.filter((ticket) => ticket.DEVELOPER_LOGINID);
  const filteredTickets = openTickets.filter((ticket) => {
    const text = [ticket.SUBJECT, ticket.REQUESTER_NAME, ticket.REQUESTER_LOGINID, ticket.DEVELOPER_NAME, ticket.DEV_STATUS, ticket.LAST_MESSAGE].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const developerLoads = useMemo(() => {
    const counts = new Map<string, number>();
    assignedTickets.forEach((ticket) => {
      const key = String(ticket.DEVELOPER_LOGINID || "").toUpperCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [assignedTickets]);
  const selectedDeveloperProfile = developers.find((developer) => developer.LOGINID === selectedDeveloper) || null;

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nextTickets, nextDevelopers] = await Promise.all([getSupportTickets("admin"), getSupportDevelopers()]);
      setTickets(nextTickets);
      setDevelopers(nextDevelopers);
      if (!selectedTicketId && nextTickets.length) setSelectedTicketId(Number(nextTickets[0].TICKET_ID));
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load support assignment data");
    } finally {
      setLoading(false);
    }
  };

  const assign = async () => {
    if (!selectedTicket || !selectedDeveloper) return;
    setLoading(true);
    try {
      await assignSupportDeveloper(Number(selectedTicket.TICKET_ID), {
        developer_loginid: selectedDeveloper,
        priority,
        sla_minutes: Number(slaMinutes),
        note,
      });
      setNote("");
      setNotice("Developer assigned and email notification sent.");
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to assign developer");
    } finally {
      setLoading(false);
    }
  };

  const saveDeveloper = async () => {
    if (!developerForm.loginid.trim()) {
      setNotice("Developer login id is required.");
      return;
    }
    setLoading(true);
    try {
      await saveSupportDeveloper(developerForm);
      setDeveloperForm({ loginid: "", username: "", email_id: "", skill_tags: "" });
      setNotice("Developer added to support team.");
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save developer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="support-center-page support-assignment-page">
      <div className="support-page-titlebar">
        <div>
          <p className="eyebrow m-0">Support</p>
          <h1>Developer Assignment</h1>
          <span>Assign open customer tickets to developers and notify them by email.</span>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      {notice && <div className="support-center-notice">{notice}</div>}

      <div className="support-desk-board support-assignment-board">
        <aside className="support-desk-filter">
          <label className="support-desk-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets" />
          </label>
          <div className="support-desk-section">
            <span>Inbox</span>
            <button className="active"><strong>Open queue</strong><em>{openTickets.length}</em></button>
            <button><strong>Assigned</strong><em>{assignedTickets.length}</em></button>
            <button><strong>Unassigned</strong><em>{openTickets.length - assignedTickets.filter((ticket) => ticket.STATUS !== "CLOSED").length}</em></button>
          </div>
          <div className="support-desk-section">
            <span>Status</span>
            <button><Circle size={8} fill="#2f80d8" color="#2f80d8" /><strong>Assigned</strong><em>{assignedTickets.length}</em></button>
            <button><Circle size={8} fill="#27c46a" color="#27c46a" /><strong>Done</strong><em>{tickets.filter((ticket) => ticket.DEV_STATUS === "DONE").length}</em></button>
            <button><Circle size={8} fill="#e3a326" color="#e3a326" /><strong>Waiting</strong><em>{tickets.filter((ticket) => ticket.DEV_STATUS === "WAITING_INFO").length}</em></button>
          </div>
          <div className="support-desk-section">
            <span>Developers</span>
            {developers.slice(0, 5).map((developer) => (
              <button key={developer.LOGINID}>
                <span className="support-mini-avatar">{String(developer.USERNAME || developer.LOGINID).slice(0, 2).toUpperCase()}</span>
                <strong>{developer.USERNAME || developer.LOGINID}</strong>
                <em>{developerLoads.get(String(developer.LOGINID).toUpperCase()) || 0}</em>
              </button>
            ))}
          </div>
        </aside>

        <aside className="support-desk-list">
          <header>
            <div>
              <h2>Tickets</h2>
              <span>{filteredTickets.length} visible</span>
            </div>
            <button type="button" title="Filter"><Filter size={16} /></button>
          </header>
          <div className="support-desk-chips">
            <span>Open</span>
            <span>Newest</span>
          </div>
          <div className="support-desk-ticket-list">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.TICKET_ID}
                className={cn(Number(ticket.TICKET_ID) === selectedTicketId && "active")}
                onClick={() => {
                  setSelectedTicketId(Number(ticket.TICKET_ID));
                  setSelectedDeveloper(ticket.DEVELOPER_LOGINID || "");
                  setPriority(ticket.PRIORITY || "MEDIUM");
                  setSlaMinutes(ticket.SLA_MINUTES ? String(ticket.SLA_MINUTES) : "480");
                }}
              >
                <span className="support-mini-avatar">{String(ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID || "U").slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                  <small>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} - {ticket.PRIORITY || "NORMAL"}</small>
                  <em>{ticket.LAST_MESSAGE || "No latest message available"}</em>
                </span>
                <b>{ticket.DEVELOPER_NAME ? "Assigned" : "New"}</b>
                <MoreHorizontal size={16} />
              </button>
            ))}
            {!filteredTickets.length && <p>No open tickets found.</p>}
          </div>
        </aside>

        <main className="support-desk-thread">
          <header>
            <div>
              <h2>{selectedTicket ? selectedTicket.SUBJECT || `Ticket ${selectedTicket.TICKET_ID}` : "Select a ticket"}</h2>
              <span>{selectedTicket ? `${selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID} - ${selectedTicket.STATUS}` : "Ticket assignment workspace"}</span>
            </div>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </Button>
          </header>
          {selectedTicket ? (
            <>
              <div className="support-desk-message-preview">
                <span className="support-mini-avatar large">{String(selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID || "U").slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID}</strong>
                  <p>{selectedTicket.LAST_MESSAGE || "No latest message available."}</p>
                  <small>{selectedTicket.LAST_MESSAGE_AT || selectedTicket.CREATED_AT || "Latest update"}</small>
                </div>
              </div>
              <div className="support-desk-assignment-card">
                <div className="support-center-card-head">
                  <h3>Assign developer</h3>
                  <span>{selectedTicket.DEV_STATUS || "UNASSIGNED"}</span>
                </div>
                <label className="support-field">
                  <span>Developer</span>
                  <select value={selectedDeveloper} onChange={(event) => setSelectedDeveloper(event.target.value)}>
                    <option value="">Select developer</option>
                    {developers.map((developer) => (
                      <option key={developer.LOGINID} value={developer.LOGINID}>
                        {developer.USERNAME || developer.LOGINID} ({developer.LOGINID}) - {developerLoads.get(String(developer.LOGINID).toUpperCase()) || 0} assigned
                      </option>
                    ))}
                  </select>
                </label>
                <div className="support-assignment-options">
                  <label className="support-field">
                    <span>Priority</span>
                    <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                      {PRIORITY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="support-field">
                    <span>SLA timer</span>
                    <select value={slaMinutes} onChange={(event) => setSlaMinutes(event.target.value)}>
                      {SLA_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="support-field">
                  <span>Assignment note</span>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context for the developer..." />
                </label>
                <Button onClick={() => void assign()} disabled={!selectedDeveloper || loading}>
                  <UserPlus size={15} /> Assign and email developer
                </Button>
              </div>
            </>
          ) : (
            <div className="support-center-empty-state">
              <MessageSquare size={28} />
              <strong>Select an open ticket</strong>
              <span>Ticket details and assignment controls will appear here.</span>
            </div>
          )}
        </main>

        <aside className="support-desk-profile">
          <header>
            <div className="support-mini-avatar large">{String(selectedDeveloperProfile?.USERNAME || selectedDeveloperProfile?.LOGINID || "DV").slice(0, 2).toUpperCase()}</div>
            <div>
              <h3>{selectedDeveloperProfile?.USERNAME || "Add developer"}</h3>
              <span>{selectedDeveloperProfile ? selectedDeveloperProfile.LOGINID : "Create or update developer profile"}</span>
            </div>
          </header>
          <div className="support-dev-create modern">
            <input value={developerForm.loginid} onChange={(event) => setDeveloperForm((current) => ({ ...current, loginid: event.target.value }))} placeholder="Login ID" />
            <input value={developerForm.username} onChange={(event) => setDeveloperForm((current) => ({ ...current, username: event.target.value }))} placeholder="Developer name" />
            <input value={developerForm.email_id} onChange={(event) => setDeveloperForm((current) => ({ ...current, email_id: event.target.value }))} placeholder="Email for assignment" />
            <input value={developerForm.skill_tags} onChange={(event) => setDeveloperForm((current) => ({ ...current, skill_tags: event.target.value }))} placeholder="Skills, module, stack" />
            <Button variant="outline" onClick={() => void saveDeveloper()} disabled={loading}>
              <UserPlus size={14} /> Add Developer
            </Button>
          </div>
          <div className="support-desk-notes">
            <h3>Assignment guide</h3>
            <p>Select a ticket, choose an active developer, add a short note, then assign. The developer receives an email with ticket context and attachment links.</p>
          </div>
          <div className="support-desk-notes">
            <h3>Recent assigned</h3>
            {assignedTickets.slice(0, 5).map((ticket) => (
              <button key={ticket.TICKET_ID} onClick={() => setSelectedTicketId(Number(ticket.TICKET_ID))}>
                <CheckCircle2 size={14} />
                <span>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</span>
                <em>{ticket.DEV_STATUS || "ASSIGNED"}</em>
              </button>
            ))}
            {!assignedTickets.length && <p>No assigned tickets yet.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
