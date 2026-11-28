// AppraisalLogDialog.tsx
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { pamsSelect } from "../../api/pams";

type Row = Record<string, unknown>;
type State = "DONE" | "CURRENT" | "UPCOMING";

interface LogRow {
  role: string;
  state: State;
  name: string;
  code: string;
  action: string;
  actionText: string;
  date: string;
  rating: number;
  remarks: string;
}

interface Props {
  open: boolean;
  docNo: string;
  employeeName?: string;
  loginid: string;
  onClose: () => void;
}

const BTN_BLUE = "rounded-full bg-blue-600 text-white shadow-md px-3 py-1 text-[12px]";

const txt = (r: Row, k: string): string => {
  const v = r[k] ?? r[k.toLowerCase()];
  return v === null || v === undefined ? "" : String(v).trim();
};

function toLogRow(r: Row): LogRow {
  const st = txt(r, "STATE").toUpperCase();
  return {
    role: txt(r, "LEVEL_NAME"),
    state: st === "DONE" || st === "CURRENT" ? (st as State) : "UPCOMING",
    name: txt(r, "APPROVER_NAME"),
    code: txt(r, "APPROVER_CODE"),
    action: txt(r, "ACTION").toUpperCase().replace(/[\s_]/g, ""),
    actionText: txt(r, "ACTION"),
    date: txt(r, "ACTION_DATE"),
    rating: Number(txt(r, "RATING")) || 0,
    remarks: txt(r, "REMARKS"),
  };
}

function getRatingMeta(rating: number): { label: string; numColor: string; labelColor: string } {
  if (rating >= 4.5) return { label: "Exceptional", numColor: "#16a34a", labelColor: "#16a34a" };
  if (rating >= 3.5) return { label: "Above Expectation", numColor: "#2563eb", labelColor: "#2563eb" };
  if (rating >= 2.5) return { label: "Meets Expectation", numColor: "#7c3aed", labelColor: "#7c3aed" };
  if (rating >= 1.5) return { label: "Below Expectation", numColor: "#d97706", labelColor: "#d97706" };
  if (rating >= 1) return { label: "Unsatisfactory", numColor: "#dc2626", labelColor: "#dc2626" };
  return { label: "—", numColor: "#6b7280", labelColor: "#6b7280" };
}

/** "10/09/2026 16:26" -> { date: "10/09/2026", time: "04:26 PM" } */
function splitDateTime(val: string): { date: string; time: string } {
  const m = val.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return { date: val, time: "" };
  const h = Number(m[2]);
  const time = `${String(h % 12 || 12).padStart(2, "0")}:${m[3]} ${h >= 12 ? "PM" : "AM"}`;
  return { date: m[1], time };
}

const BLUE = "#082A89";

function statusFor(row: LogRow): { label: string; chip: string } {
  if (row.state === "CURRENT") return { label: "Pending Approval", chip: "bg-amber-100 text-amber-800" };
  if (row.state === "UPCOMING") return { label: "Upcoming", chip: "bg-slate-100 text-slate-500" };
  if (row.action === "REJECTED") return { label: "Rejected", chip: "bg-red-100 text-red-800" };
  if (row.action === "SENTBACK") return { label: "Sent Back", chip: "bg-orange-100 text-orange-800" };
  if (row.action === "APPROVED") return { label: "Approved", chip: "bg-green-100 text-green-800" };
  if (row.action === "SUBMITTED") return { label: "Submitted", chip: "bg-blue-100 text-blue-800" };
  return { label: row.actionText || "—", chip: "bg-slate-100 text-slate-700" };
}

const AppraisalLogDialog: React.FC<Props> = ({ open, docNo, employeeName, loginid, onClose }) => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !docNo || !loginid) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setRows([]);
    pamsSelect<Row>({ parameter: "appraisal_approval_log", loginid, code1: docNo })
      .then((res) => {
        if (cancelled) return;
        setRows((Array.isArray(res) ? res : []).map(toLogRow));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load approval log");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, docNo, loginid]);

  const current = rows.find((r) => r.state === "CURRENT");
  const allDone = rows.length > 0 && rows.every((r) => r.state === "DONE");
  const person = (r: LogRow) => r.name || r.code || r.role || "—";

  return (
    <Dialog
      open={open}
      title="Approval Log"
      contentClassName="w-[min(96vw,980px)]"
      onClose={onClose}
      footer={
        <Button type="button" className={BTN_BLUE} onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-3 text-sm font-semibold" style={{ color: BLUE }}>
        Document {docNo}
        {employeeName ? ` • ${employeeName}` : ""}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No approval flow found.</div>
      ) : (
        <>
          <div
            className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
              allDone ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {allDone ? (
              <span className="font-semibold">Fully approved</span>
            ) : current ? (
              <span>
                <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Waiting for: </span>
                <span className="font-semibold">{person(current)}</span>
              </span>
            ) : (
              <span className="font-semibold">In progress</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide" style={{ background: "#E8F0FF", color: BLUE }}>
                  <th className="w-16 whitespace-nowrap px-3 py-2 font-semibold">Sr. No.</th>
                  <th className="px-3 py-2 font-semibold">Approval Status</th>
                  <th className="px-3 py-2 font-semibold">Updated By</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold"> Updated Date &amp; Time</th>
                  <th className="px-3 py-2 text-center font-semibold">Rating</th>
                  <th className="px-3 py-2 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const st = statusFor(r);
                  const muted = r.state === "UPCOMING";
                  return (
                    <tr key={i} className={`border-t align-top ${muted ? "text-muted-foreground" : ""}`}>
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.chip}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{person(r)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.date ? (
                          <>
                            <span className="font-medium">{splitDateTime(r.date).date}</span>
                            {splitDateTime(r.date).time && (
                              <span className="ml-2 text-xs text-muted-foreground">{splitDateTime(r.date).time}</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.rating > 0 ? (
                          <>
                            <div className="text-base font-extrabold leading-none" style={{ color: getRatingMeta(r.rating).numColor }}>
                              {r.rating}
                            </div>
                            <div className="mt-0.5 text-[10px] font-semibold" style={{ color: getRatingMeta(r.rating).labelColor }}>
                              {getRatingMeta(r.rating).label}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[320px] whitespace-pre-wrap break-words px-3 py-2">{r.remarks || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
};

export default AppraisalLogDialog;