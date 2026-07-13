import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, Search, Wrench } from "lucide-react";
import { SupportTicket, getDeveloperSupportTickets, updateDeveloperSupportStatus } from "../../api/support";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";

const DEV_STATUSES = [
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_INFO", label: "Waiting Info" },
  { value: "DONE", label: "Done" },
];

export function SupportDeveloperWorkbenchPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedTicket = tickets.find((ticket) => Number(ticket.TICKET_ID) === selectedId) || null;
  const activeTickets = tickets.filter((ticket) => (ticket.DEV_STATUS || "ASSIGNED") !== "DONE");
  const doneTickets = tickets.filter((ticket) => (ticket.DEV_STATUS || "ASSIGNED") === "DONE");
  const filteredTickets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => [ticket.SUBJECT, ticket.REQUESTER_NAME, ticket.REQUESTER_LOGINID, ticket.DEV_STATUS, ticket.LAST_MESSAGE].join(" ").toLowerCase().includes(needle));
  }, [tickets, query]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const nextTickets = await getDeveloperSupportTickets();
      setTickets(nextTickets);
      if (!selectedId && nextTickets.length) setSelectedId(Number(nextTickets[0].TICKET_ID));
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load developer tickets");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!selectedTicket) return;
    setLoading(true);
    try {
      await updateDeveloperSupportStatus(Number(selectedTicket.TICKET_ID), status);
      setNotice(`Ticket marked ${status.replace(/_/g, " ").toLowerCase()}.`);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="support-center-page support-dev-workbench-page">
      <div className="support-page-titlebar">
        <div>
          <p className="eyebrow m-0">Support</p>
          <h1>Developer Workbench</h1>
          <span>Track assigned support tickets and keep progress visible to admins.</span>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      {notice && <div className="support-center-notice">{notice}</div>}

      <div className="support-dev-summary">
        <div>
          <Wrench size={17} />
          <strong>{tickets.length}</strong>
          <span>Total assigned</span>
        </div>
        <div>
          <Clock3 size={17} />
          <strong>{activeTickets.length}</strong>
          <span>In progress</span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <strong>{doneTickets.length}</strong>
          <span>Done</span>
        </div>
      </div>

      <div className="support-dev-workbench-grid">
        <aside className="support-center-card support-dev-ticket-list">
          <label className="support-center-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assigned tickets..." />
          </label>
          <div className="support-assign-list">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.TICKET_ID}
                className={cn(Number(ticket.TICKET_ID) === selectedId && "active")}
                onClick={() => setSelectedId(Number(ticket.TICKET_ID))}
              >
                <strong>{ticket.SUBJECT || `Ticket ${ticket.TICKET_ID}`}</strong>
                <span>{ticket.REQUESTER_NAME || ticket.REQUESTER_LOGINID}</span>
                <em>{ticket.DEV_STATUS || "ASSIGNED"}</em>
              </button>
            ))}
            {!filteredTickets.length && <p>No assigned tickets found.</p>}
          </div>
        </aside>

        <main className="support-center-card support-dev-detail">
          {selectedTicket ? (
            <>
              <div className="support-center-card-head">
                <h3>{selectedTicket.SUBJECT || `Ticket ${selectedTicket.TICKET_ID}`}</h3>
                <span>{selectedTicket.DEV_STATUS || "ASSIGNED"}</span>
              </div>
              <div className="support-ticket-brief">
                <span>{selectedTicket.REQUESTER_NAME || selectedTicket.REQUESTER_LOGINID}</span>
                <p>{selectedTicket.LAST_MESSAGE || "No message summary available."}</p>
                <small>Assigned by {selectedTicket.ASSIGNED_BY || "Support"} {selectedTicket.ASSIGNED_AT ? `on ${selectedTicket.ASSIGNED_AT}` : ""}</small>
                <small>{selectedTicket.DUE_AT ? `Due by ${selectedTicket.DUE_AT}` : "No SLA timer set"}</small>
              </div>
              <div className="support-dev-status-actions">
                {DEV_STATUSES.map((status) => (
                  <button
                    type="button"
                    key={status.value}
                    className={cn((selectedTicket.DEV_STATUS || "ASSIGNED") === status.value && "active")}
                    onClick={() => void updateStatus(status.value)}
                    disabled={loading}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="support-center-empty-state">
              <Wrench size={28} />
              <strong>{tickets.length ? "Select a ticket" : "No assigned tickets yet"}</strong>
              <span>
                {tickets.length
                  ? "Choose a ticket from the left list to review the customer issue and update progress."
                  : "When support assigns a ticket to you, it will appear here with customer details and progress actions."}
              </span>
              <div className="support-dev-empty-grid">
                <div><strong>1</strong><span>Review the customer message and attachments.</span></div>
                <div><strong>2</strong><span>Move status to In Progress while working.</span></div>
                <div><strong>3</strong><span>Mark Done after the fix is delivered.</span></div>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
