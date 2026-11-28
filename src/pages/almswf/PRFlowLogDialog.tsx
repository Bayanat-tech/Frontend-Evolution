import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    CheckCircle2, Send, Undo2, XCircle, MessageSquare, Ban, FileText,
    ChevronDown, ChevronRight, Smartphone, Loader2, Circle,
} from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { almsCommonSelect } from "../../api/alms";

const PO_BLUE = "#00378C";

type Props = {
    open: boolean;
    onClose: () => void;
    requestNumber: string;
    companyCode: string;
    loginid: string;
};

type Row = Record<string, any>;
const g = (r: Row, k: string) => r?.[k] ?? r?.[k.toLowerCase()];
const n = (v: unknown) => Number(v) || 0;
const fmt3 = (v: unknown) =>
    n(v).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtDate = (v: unknown) =>
    v
        ? new Date(String(v)).toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })
        : "";

function norm(a: unknown): string {
    const x = String(a || "").trim().toUpperCase();
    if (x === "SUBMIT") return "SUBMITTED";
    if (x === "APPROVE") return "APPROVED";
    if (x === "REJECT") return "REJECTED";
    if (x === "CANCELLED") return "CANCELED";
    if (x === "COMMENT") return "COMMENTED";
    return x;
}

const META: Record<string, { label: string; icon: any; chip: string; dot: string }> = {
    SAVEASDRAFT: { label: "Draft", icon: FileText, chip: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-500" },
    SUBMITTED: { label: "Submitted", icon: Send, chip: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-600" },
    APPROVED: { label: "Approved", icon: CheckCircle2, chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-600" },
    SENDBACK: { label: "Sent Back", icon: Undo2, chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    REJECTED: { label: "Rejected", icon: XCircle, chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-600" },
    COMMENTED: { label: "Comment", icon: MessageSquare, chip: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
    CANCELED: { label: "Cancelled", icon: Ban, chip: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-600" },
};
const metaOf = (a: string) =>
    META[a] ?? { label: a || "—", icon: Circle, chip: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400" };

const initials = (s: string) =>
    String(s || "U").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function PRFlowLogDialog({ open, onClose, requestNumber, companyCode, loginid }: Props) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const enabled = open && !!requestNumber && !!companyCode;

    const { data: hdr = [], isFetching: hf } = useQuery<Row[]>({
        queryKey: ["pr-flowlog-hdr", requestNumber, companyCode],
        queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_FLOW_LOG_HDR", loginid, code1: companyCode, code2: requestNumber, code3: "", code4: "" }),
        enabled, staleTime: 0,
    });
    const { data: det = [], isFetching: df } = useQuery<Row[]>({
        queryKey: ["pr-flowlog-det", requestNumber, companyCode],
        queryFn: () => almsCommonSelect({ parameter: "PS_PREQUEST_ENTRY_FLOW_LOG_DET", loginid, code1: companyCode, code2: requestNumber, code3: "", code4: "" }),
        enabled, staleTime: 0,
    });

    const loading = hf || df;

    const detByLog = useMemo(() => {
        const m = new Map<string, Row[]>();
        det.forEach((d) => {
            const k = String(g(d, "LOGGER_NUMBER"));
            if (!m.has(k)) m.set(k, []);
            m.get(k)!.push(d);
        });
        return m;
    }, [det]);

    const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));
    const allKeys = hdr.map((h, i) => String(g(h, "LOGGER_NUMBER") ?? i));
    const allOpen = allKeys.length > 0 && allKeys.every((k) => expanded[k]);

    return (
        <Dialog
            open={open}
            wide
            title={`Flow Log — ${requestNumber}`}
            description="Full activity history with item snapshot at every step."
            onClose={onClose}
            footer={<Button type="button" onClick={onClose} className="rounded-full bg-blue-600 text-white hover:bg-blue-700">Close</Button>}
        >
            <div className="flex w-full flex-col gap-3" style={{ minWidth: 720 }}>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                        {hdr.length} {hdr.length === 1 ? "activity" : "activities"}
                    </span>
                    <div className="flex items-center gap-3">
                        {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
                        {hdr.length > 0 && (
                            <button
                                type="button"
                                className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-[#00378C] hover:underline"
                                onClick={() => setExpanded(Object.fromEntries(allKeys.map((k) => [k, !allOpen])))}
                            >
                                {allOpen ? "Collapse all" : "Expand all"}
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto pr-1">
                    {hdr.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-400">{loading ? "Loading..." : "No activity yet."}</div>
                    ) : (
                        <ol className="relative ml-3 border-l-2 border-slate-200">
                            {hdr.map((h, i) => {
                                const key = String(g(h, "LOGGER_NUMBER") ?? i);
                                const action = norm(g(h, "LAST_ACTION"));
                                const m = metaOf(action);
                                const Icon = m.icon;
                                const items = detByLog.get(key) ?? [];
                                const isOpen = !!expanded[key];
                                const amount = n(g(h, "AMOUNT"));
                                const prev = i > 0 ? n(g(hdr[i - 1], "AMOUNT")) : null;
                                const delta = prev !== null && Math.abs(amount - prev) > 0.0005 ? amount - prev : 0;
                                const note = String(g(h, "SENTBACK_REASON") || g(h, "REJECT_REASON") || g(h, "REMARKS") || "").trim();
                                const total = items.reduce((s, r) => s + n(g(r, "AMOUNT")), 0);
                                const name = String(g(h, "ACTION_BY_NAME") || g(h, "ACTION_BY") || "");

                                return (
                                    <li key={key + i} className="relative mb-3 ml-6 last:mb-0">
                                        <span className={`absolute -left-[37px] top-3 flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-white ${m.dot}`}>
                                            <Icon size={13} />
                                        </span>

                                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                            <div className="flex flex-wrap items-center gap-3 p-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                                    {initials(name)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-bold uppercase text-slate-800">{name}</span>
                                                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${m.chip}`}>{m.label}</span>
                                                        {String(g(h, "MOBILE_APP_UPDATE")).toUpperCase() === "Y" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                                                <Smartphone size={10} /> Mobile
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">{fmtDate(g(h, "ACTION_DATE"))}</div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="text-[10px] font-semibold uppercase text-slate-400">Amount</div>
                                                    <div className="text-sm font-bold text-emerald-600">{fmt3(amount)}</div>
                                                    {delta !== 0 && (
                                                        <div className={`text-[10px] font-bold ${delta > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                                            {delta > 0 ? "▲" : "▼"} {fmt3(Math.abs(delta))} vs previous
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {note && (
                                                <div className="mx-3 mb-3 rounded border-l-4 border-blue-400 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-900">
                                                    {action === "SENDBACK" ? "Reason: " : action === "REJECTED" ? "Reject reason: " : "Remarks: "}{note}
                                                </div>
                                            )}

                                            {items.length > 0 && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggle(key)}
                                                        className="flex w-full cursor-pointer items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#00378C] hover:bg-slate-100"
                                                    >
                                                        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                        {items.length} item{items.length === 1 ? "" : "s"} snapshot
                                                    </button>

                                                    {isOpen && (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full min-w-[640px] border-collapse text-[11px]">
                                                                <thead>
                                                                    <tr className="text-white" style={{ backgroundColor: PO_BLUE }}>
                                                                        {["#", "Item", "Qty", "Alloc. Qty", "Rate", "Curr", "Ex Rate", "Amount", "Base Amt"].map((c, ci) => (
                                                                            <th key={c} className={`px-2 py-1.5 font-semibold ${ci < 2 ? "text-left" : "text-right"}`}>{c}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {items.map((r, ri) => (
                                                                        <tr key={ri} className="border-t border-slate-100 odd:bg-slate-50/50">
                                                                            <td className="px-2 py-1.5 text-slate-500">{g(r, "ITEM_SRNO")}</td>
                                                                            <td className="px-2 py-1.5">
                                                                                <div className="font-semibold text-slate-800">{g(r, "ITEM_CODE")}</div>
                                                                                <div className="text-slate-500">{g(r, "ITEM_DESP")}</div>
                                                                            </td>
                                                                            <td className="px-2 py-1.5 text-right">{fmt3(g(r, "ITEM_QTY"))}</td>
                                                                            <td className="px-2 py-1.5 text-right">{fmt3(g(r, "ALLOCATED_APPROVED_QUANTITY"))}</td>
                                                                            <td className="px-2 py-1.5 text-right">{fmt3(g(r, "ITEM_RATE"))}</td>
                                                                            <td className="px-2 py-1.5 text-right">{g(r, "CURR_CODE")}</td>
                                                                            <td className="px-2 py-1.5 text-right">{n(g(r, "CURRENCY_RATE")).toFixed(4)}</td>
                                                                            <td className="px-2 py-1.5 text-right font-bold text-emerald-600">{fmt3(g(r, "AMOUNT"))}</td>
                                                                            <td className="px-2 py-1.5 text-right">{fmt3(g(r, "BASE_AMOUNT"))}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot>
                                                                    <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                                                                        <td colSpan={7} className="px-2 py-1.5 text-right uppercase text-slate-600">Total Amount</td>
                                                                        <td className="px-2 py-1.5 text-right text-emerald-700">{fmt3(total)}</td>
                                                                        <td />
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            </div>
        </Dialog>
    );
}