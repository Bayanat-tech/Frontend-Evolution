import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Clock, Loader2, UserPlus, Undo2, Ban, Hourglass } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { almsCommonSelect } from "../../api/alms";

type S = string | null | undefined;
type Props = {
    open: boolean;
    onClose: () => void;
    requestNumber: string;
    companyCode: string;
    loginid: string;
    flowCode?: S;
    flowDescription?: S;
    lastAction?: S;
    nextActionBy?: S;
    nextActionByName?: S;
    createUser?: S;
    createUserName?: S;
    finalApproved?: boolean;
};

type Row = Record<string, any>;
type Step = { level: number; ids: string[]; name: string; status: string; date: any; note: string };

const g = (r: Row, k: string) => r?.[k] ?? r?.[k.toLowerCase()];
const n = (v: unknown) => Number(v) || 0;
const up = (v: unknown) => String(v ?? "").trim().toUpperCase();
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (v: unknown) =>
    v
        ? new Date(String(v)).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })
        : "";

function norm(a: unknown): string {
    const x = up(a);
    if (x === "SUBMIT") return "SUBMITTED";
    if (x === "APPROVE") return "APPROVED";
    if (x === "REJECT") return "REJECTED";
    if (x === "CANCELLED") return "CANCELED";
    if (x === "COMMENT") return "COMMENTED";
    return x;
}

const hasId = (s: Step, id: unknown) => !!up(id) && s.ids.some((i) => up(i) === up(id));

/* FIX 1: tighter, viewport-friendly columns.
   - 28px timeline
   - employee takes flexible space (min 0 so it can shrink)
   - status fixed 120px
   - remarks takes whatever is left (min 0)
   - smaller gap (gap-2 instead of gap-3) */
const COLS =
    "grid grid-cols-[28px_minmax(0,1.2fr)_120px_minmax(0,1.4fr)] items-center gap-2";

export default function PRApprovalGraphDialog({
    open, onClose, requestNumber, companyCode, loginid,
    flowCode, flowDescription, lastAction, nextActionBy,
    createUser, createUserName, finalApproved = false,
}: Props) {
    const enabled = open && !!requestNumber && !!companyCode;

    const { data: hdr = [], isFetching: hf } = useQuery<Row[]>({
        queryKey: ["pr-flowlog-hdr", requestNumber, companyCode],
        queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_FLOW_LOG_HDR", loginid, code1: companyCode, code2: requestNumber, code3: "", code4: "" }),
        enabled, staleTime: 0,
    });
    const { data: levels = [], isFetching: lf } = useQuery<Row[]>({
        queryKey: ["pr-flowlog-levels", flowCode, companyCode],
        queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_FLOW_LEVELS", loginid, code1: companyCode, code2: flowCode || "", code3: "", code4: "" }),
        enabled: enabled && !!flowCode, staleTime: 0,
    });
    const loading = hf || lf;

    const acts = useMemo(
        () => hdr.filter((h) => !["COMMENTED", "SAVEASDRAFT"].includes(norm(g(h, "LAST_ACTION")))),
        [hdr]
    );
    const state = norm(lastAction) || (acts.length ? norm(g(acts[acts.length - 1], "LAST_ACTION")) : "");
    const terminal = finalApproved || ["REJECTED", "CANCELED"].includes(state);

    const steps = useMemo<Step[]>(() => {
        const cid = up(createUser) || up(g(hdr[0], "ACTION_BY"));
        const cname = String(createUserName || g(hdr[0], "ACTION_BY_NAME") || cid);

        let base: Step[] = [];
        levels.forEach((lv, i) => {
            const empId = String(g(lv, "EMP_ID") || "").trim();
            if (!empId) return;
            const level = n(g(lv, "LVL")) || i + 1;
            const name = String(g(lv, "EMP_NAME") || empId);
            const dup = base.find((s) => s.level === level && up(s.name) === up(name));
            if (dup) { if (!hasId(dup, empId)) dup.ids.push(empId); return; }
            base.push({ level, ids: [empId], name, status: "", date: null, note: "" });
        });

        let creatorRow = base.find((s) => hasId(s, cid));
        if (cid && !creatorRow) {
            creatorRow = { level: 0, ids: [cid], name: cname, status: "", date: null, note: "" };
            base.unshift(creatorRow);
        }

        if (creatorRow) {
            const involved = new Set<string>();
            hdr.forEach((h) => { involved.add(up(g(h, "ACTION_BY"))); involved.add(up(g(h, "NEXT_ACTION_BY"))); });
            base = base.filter((s) => s === creatorRow || s.level !== creatorRow!.level || s.ids.some((i) => involved.has(up(i))));
            creatorRow.status = "CREATOR";
            creatorRow.date = acts[0] ? g(acts[0], "ACTION_DATE") : null;
        }

        const nameOf = (id: string) => base.find((s) => hasId(s, id))?.name || id;

        acts.forEach((h) => {
            const a = norm(g(h, "LAST_ACTION"));
            const row = base.find((s) => hasId(s, g(h, "ACTION_BY")));
            if (!row) return;

            if (a === "SENDBACK") {
                const toId = String(g(h, "NEXT_ACTION_BY") || "").trim();
                const reason = String(g(h, "SENTBACK_REASON") || g(h, "REMARKS") || "").trim();
                row.status = "SENDBACK";
                row.date = g(h, "ACTION_DATE");
                row.note = `Sent back to ${toId ? nameOf(toId) : "Creator"}${reason ? `: ${reason}` : ""}`;
                return;
            }
            if (row === creatorRow && a === "SUBMITTED") return;
            row.status = a;
            row.date = g(h, "ACTION_DATE");
            row.note = a === "REJECTED" ? String(g(h, "REJECT_REASON") || "") : "";
        });
        return base;
    }, [levels, acts, hdr, createUser, createUserName]);

    const holder = up(nextActionBy);
    const currentIdx = terminal
        ? -1
        : (() => {
            const mine = steps.map((s, i) => (hasId(s, holder) ? i : -1)).filter((i) => i >= 0);
            if (mine.length) return mine.find((i) => !steps[i].status) ?? mine[0];
            return steps.findIndex((s) => !s.status);
        })();

    const view = (s: Step, cur: boolean) => {
        if (cur) return { label: "Pending", icon: Hourglass, badge: "bg-amber-50 text-amber-700 border-amber-300", node: "bg-amber-500 text-white border-amber-500 ring-4 ring-amber-100" };
        switch (s.status) {
            case "CREATOR": return { label: "Creator", icon: UserPlus, badge: "bg-blue-50 text-blue-700 border-blue-200", node: "bg-blue-600 text-white border-blue-600" };
            case "SUBMITTED": return { label: "Submitted", icon: Check, badge: "bg-emerald-50 text-emerald-700 border-emerald-200", node: "bg-emerald-600 text-white border-emerald-600" };
            case "APPROVED": return { label: "Approved", icon: Check, badge: "bg-emerald-50 text-emerald-700 border-emerald-200", node: "bg-emerald-600 text-white border-emerald-600" };
            case "SENDBACK": return { label: "Sent Back", icon: Undo2, badge: "bg-orange-50 text-orange-700 border-orange-300", node: "bg-orange-500 text-white border-orange-500" };
            case "REJECTED": return { label: "Rejected", icon: X, badge: "bg-rose-50 text-rose-700 border-rose-200", node: "bg-rose-600 text-white border-rose-600" };
            case "CANCELED": return { label: "Cancelled", icon: Ban, badge: "bg-red-50 text-red-700 border-red-200", node: "bg-red-600 text-white border-red-600" };
            default: return { label: finalApproved ? "Not Required" : "Waiting", icon: Clock, badge: "bg-slate-50 text-slate-400 border-slate-200", node: "bg-white text-slate-300 border-slate-300" };
        }
    };

    return (
        <Dialog
            open={open}
            title={`Approval Graph — ${requestNumber}`}
            description={flowDescription || undefined}
            onClose={onClose}
            footer={<Button type="button" onClick={onClose} className="rounded-full bg-blue-600 px-8 text-white hover:bg-blue-700">OK</Button>}
        >
            {/* FIX 2: drop fixed 1500px width — let it use the available dialog width. 
          Use w-full so it never exceeds dialog container. */}
            <div className="w-full max-w-full overflow-x-hidden">
                <div className={`${COLS} mb-1 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white`} style={{ backgroundColor: "#00378C" }}>
                    <span />
                    <span>Employee</span>
                    <span>Status</span>
                    <span>Remarks</span>
                </div>

                {steps.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {loading ? "Loading..." : "No approval levels found for this flow."}
                    </div>
                ) : (
                    <div className="max-h-none overflow-visible rounded-md border border-slate-200">
                        {steps.map((s, idx) => {
                            const cur = idx === currentIdx;
                            const v = view(s, cur);
                            const Icon = v.icon;
                            const showDate = !!s.date && !cur && !!s.status;
                            return (
                                <div
                                    key={`${s.level}-${s.ids[0]}`}
                                    className={`${COLS} relative border-b border-slate-100 px-3 py-2.5 last:border-b-0 ${cur ? "bg-amber-50/70" : idx % 2 ? "bg-slate-50/60" : "bg-white"}`}
                                >
                                    {/* timeline */}
                                    <div className="relative flex h-full items-center justify-center self-stretch">
                                        <span
                                            className="absolute left-1/2 w-0.5 -translate-x-1/2 bg-slate-200"
                                            style={{ top: idx === 0 ? "50%" : -10, bottom: idx === steps.length - 1 ? "50%" : -10 }}
                                        />
                                        <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${v.node}`}>
                                            {s.status || cur ? <Icon size={13} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                                        </span>
                                    </div>

                                    {/* employee — wraps, no truncation */}
                                    <div className="min-w-0 text-[13px] font-semibold text-slate-800">
                                        <div className="break-words" title={s.name}>{title(s.name)}</div>
                                    </div>

                                    {/* status */}
                                    <div className="flex min-w-0 flex-col items-start gap-0.5">
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${v.badge}`}>
                                            <Icon size={10} strokeWidth={2.5} /> {v.label}
                                        </span>
                                        {showDate && <span className="pl-1 text-[9px] text-slate-500">{fmtDate(s.date)}</span>}
                                    </div>

                                    {/* remarks — wraps to multiple lines */}
                                    <div className="min-w-0">
                                        {s.note ? (
                                            <div className="whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] leading-snug text-slate-700">
                                                {s.note}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-300">—</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Dialog>
    );
}