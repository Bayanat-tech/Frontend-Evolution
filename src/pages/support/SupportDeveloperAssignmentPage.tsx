import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mail, RefreshCw, Search, UserPlus } from "lucide-react";
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

export function SupportDeveloperAssignmentPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [developers, setDevelopers] = useState<SupportDeveloper[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedDeveloper, setSelectedDeveloper] = useState("");
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
      await assignSupportDeveloper(Number(selectedTicket.TICKET_ID), { developer_loginid: selectedDeveloper, note });
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

      <div className="support-assignment-grid">
        <div className="support-center-card support-assignment-queue">
          <div className="support-center-card-head">
            <h3>Open queue</h3>
            <span>{openTickets.length} open</span>
          </div>
          <label className="support-center-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticket, user, developer..." />
          </label>
          <div className="support-assign-list">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.TICKET_ID}
                className={cn(Number(ticket.TICKET_ID) === selectedTicketId && "active")}
                onClick={() => {
                  setSelectedTicketId(Number(ticket.TICKET_ID));
                  setSelectedDeveloper(ticket.DEVELOPER_LOGINID || "");
                }}
              >
                <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                <span>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID} - {ticket.PRIORITY || "NORMAL"}</span>
                <em>{ticket.DEVELOPER_NAME ? `Assigned to ${ticket.DEVELOPER_NAME}` : "Unassigned"}</em>
              </button>
            ))}
            {!filteredTickets.length && <p>No open tickets found.</p>}
          </div>
        </div>

        <div className="support-center-card support-assignment-form">
          <div className="support-center-card-head">
            <h3>Assignment</h3>
            <span>{selectedTicket ? `#${selectedTicket.TICKET_ID}` : "Select ticket"}</span>
          </div>
          {selectedTicket ? (
            <>
              <div className="support-ticket-brief">
                <strong>{selectedTicket.SUBJECT || `Ticket ${selectedTicket.TICKET_ID}`}</strong>
                <span>{selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID}</span>
                <p>{selectedTicket.LAST_MESSAGE || "No latest message available."}</p>
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
              <label className="support-field">
                <span>Assignment note</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context for the developer..." />
              </label>
              <Button onClick={() => void assign()} disabled={!selectedDeveloper || loading}>
                <UserPlus size={15} /> Assign and email developer
              </Button>
            </>
          ) : (
            <div className="support-center-empty-state">
              <UserPlus size={28} />
              <strong>Select an open ticket</strong>
              <span>Developer assignment details will appear here.</span>
            </div>
          )}
        </div>

        <div className="support-center-card support-developer-loads">
          <div className="support-center-card-head">
            <h3>Developer workload</h3>
            <span>{assignedTickets.length} assigned</span>
          </div>
          <div className="support-dev-create">
            <input value={developerForm.loginid} onChange={(event) => setDeveloperForm((current) => ({ ...current, loginid: event.target.value }))} placeholder="Login ID" />
            <input value={developerForm.username} onChange={(event) => setDeveloperForm((current) => ({ ...current, username: event.target.value }))} placeholder="Developer name" />
            <input value={developerForm.email_id} onChange={(event) => setDeveloperForm((current) => ({ ...current, email_id: event.target.value }))} placeholder="Email for assignment" />
            <input value={developerForm.skill_tags} onChange={(event) => setDeveloperForm((current) => ({ ...current, skill_tags: event.target.value }))} placeholder="Skills, module, stack" />
            <Button variant="outline" onClick={() => void saveDeveloper()} disabled={loading}>
              <UserPlus size={14} /> Add Developer
            </Button>
          </div>
          <div className="support-dev-list">
            {developers.slice(0, 12).map((developer) => {
              const count = developerLoads.get(String(developer.LOGINID).toUpperCase()) || 0;
              return (
                <div key={developer.LOGINID}>
                  <span className="support-center-avatar">{String(developer.USERNAME || developer.LOGINID).slice(0, 2).toUpperCase()}</span>
                  <strong>{developer.USERNAME || developer.LOGINID}</strong>
                  <em>{count} ticket{count === 1 ? "" : "s"}</em>
                  {developer.EMAIL_ID && <Mail size={14} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="support-center-card support-assignment-history">
          <div className="support-center-card-head">
            <h3>Assigned tickets</h3>
            <span>{assignedTickets.length} total</span>
          </div>
          <div className="support-assigned-table">
            {assignedTickets.slice(0, 10).map((ticket) => (
              <div key={ticket.TICKET_ID}>
                <CheckCircle2 size={15} />
                <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                <span>{ticket.DEVELOPER_NAME || ticket.DEVELOPER_LOGINID}</span>
                <em>{ticket.DEV_STATUS || "ASSIGNED"}</em>
              </div>
            ))}
            {!assignedTickets.length && <p>No assigned tickets yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
