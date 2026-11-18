import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CalendarDays, RefreshCw, Wallet2, Layers,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { executeWmsInboundSql } from "../../../api/wms";
import { getPrincipalDropdown } from "../../../api/billing";

// ---------------------------------------------------------------------------
// Period (month + year filter)
// month = 0 means "All months" (whole year), 1..12 = a single month
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Period = {
  job: string;   // JOB_DATE condition for the selected period
  txn: string;   // TXN_DATE condition for the selected period
  stn: string;   // STN_DATE condition for the selected period
  yJob: string;  // JOB_DATE condition for the whole selected year (trend chart)
  yStn: string;  // STN_DATE condition for the whole selected year (trend chart)
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// year and month come from <select> values (numbers), so interpolation is safe.
const rangeFor = (year: number, month: number) => {
  const y = Math.trunc(year);
  const m = Math.trunc(month);
  const start = m === 0 ? `TO_DATE('${y}-01-01','YYYY-MM-DD')` : `TO_DATE('${y}-${pad2(m)}-01','YYYY-MM-DD')`;
  const end = `ADD_MONTHS(${start}, ${m === 0 ? 12 : 1})`;
  return (col: string) => `${col} >= ${start} AND ${col} < ${end}`;
};

const buildPeriod = (year: number, month: number): Period => {
  const p = rangeFor(year, month);
  const y = rangeFor(year, 0);
  return {
    job: p("JOB_DATE"),
    txn: p("TXN_DATE"),
    stn: p("STN_DATE"),
    yJob: y("JOB_DATE"),
    yStn: y("STN_DATE"),
  };
};

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const jobKpiSql = (type: "IMP" | "EXP", batchTable: "TT_BATCH" | "TO_BATCH", p: Period) => `
SELECT
  (SELECT COUNT(*) FROM TI_JOB WHERE CANCELED <> 'Y' AND JOB_TYPE = '${type}' AND ${p.job}) AS TOTAL_JOBS,
  (SELECT COUNT(*) FROM TI_JOB WHERE JOB_NO NOT IN (SELECT JOB_NO FROM ${batchTable}) AND JOB_TYPE = '${type}' AND ${p.job}) AS JOB_PENDING,
  (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED <> 'Y' AND JOB_NO IN (SELECT JOB_NO FROM ${batchTable}) AND JOB_TYPE = '${type}' AND ${p.job}) AS CONFIRM_PENDING,
  (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED = 'Y' AND JOB_TYPE = '${type}' AND ${p.job}) AS TOTAL_CONFIRMED,
  (SELECT NVL(SUM(BILL), 0) FROM TN_INVOICE_DET WHERE JOB_TYPE = '${type}' AND ${p.txn}) AS TOTAL_REVENUE
FROM DUAL`;

const topPrincipalSql = (type: "IMP" | "EXP", p: Period) => `
SELECT PRIN_CODE, SUM(BILL) AS TOTAL_BILL
FROM TN_INVOICE_DET
WHERE JOB_TYPE = '${type}' AND ${p.txn}
GROUP BY PRIN_CODE
ORDER BY TOTAL_BILL DESC
FETCH FIRST 5 ROWS ONLY`;

const transferKpiSql = (p: Period) => `
SELECT
  (SELECT COUNT(*) FROM TS_STN WHERE CANCEL <> 'Y' AND ${p.stn}) AS TOTAL_TRANSFER,
  (SELECT COUNT(*) FROM TS_STN WHERE STN_NO NOT IN (SELECT STN_NO FROM TS_BATCH) AND ${p.stn}) AS TRANSFER_PENDING,
  (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED <> 'Y' AND STN_NO IN (SELECT STN_NO FROM TS_BATCH) AND ${p.stn}) AS CONFIRM_PENDING,
  (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED = 'Y' AND ${p.stn}) AS TOTAL_CONFIRMED
FROM DUAL`;

// Trend charts always cover the whole selected year so the month-by-month shape stays visible.
const monthlyJobsSql = (p: Period) => `
SELECT TO_CHAR(JOB_DATE, 'MM') AS MONTH_NO,
  SUM(CASE WHEN JOB_TYPE = 'IMP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_INBOUND,
  SUM(CASE WHEN JOB_TYPE = 'EXP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_OUTBOUND
FROM TI_JOB
WHERE ${p.yJob}
GROUP BY TO_CHAR(JOB_DATE, 'MM')
ORDER BY MONTH_NO`;

// Transfers live in TS_STN (same table as the KPI query). Swap back to TI_JOB/'TRF' if that's what you really use.
const monthlyTransferSql = (p: Period) => `
SELECT TO_CHAR(STN_DATE, 'MM') AS MONTH_NO, COUNT(*) AS CONFIRMED_TRANSFER
FROM TS_STN
WHERE CONFIRMED = 'Y' AND ${p.yStn}
GROUP BY TO_CHAR(STN_DATE, 'MM')
ORDER BY MONTH_NO`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];
const num = (obj: any, key: string) => Number(getValue(obj, key) ?? 0) || 0;

const runSql = async (sql: string): Promise<any[]> => {
  const rows = await executeWmsInboundSql(sql.trim().replace(/;+\s*$/, ""));
  return Array.isArray(rows) ? rows : [];
};

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtMoney = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const fmtCompact = (n: number) => compactFmt.format(n);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const C = {
  inbound: "#2563EB",
  outbound: "#F59E0B",
  transfer: "#10B981",
  pending: "#F59E0B",
  awaiting: "#6366F1",
  done: "#10B981",
};

const niceScale = (max: number) => {
  const raw = Math.max(max, 1) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) as number;
  return { step, max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
};

const smoothPath = (pts: Array<[number, number]>) => {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
};

type Slice<T> = { data: T | null; error: string | null };
type JobKpi = { total: number; pending: number; confirmPending: number; confirmed: number; revenue: number };
type TrfKpi = { total: number; pending: number; confirmPending: number; confirmed: number };

const toJobKpi = (rows: any[]): JobKpi => ({
  total: num(rows[0], "total_jobs"),
  pending: num(rows[0], "job_pending"),
  confirmPending: num(rows[0], "confirm_pending"),
  confirmed: num(rows[0], "total_confirmed"),
  revenue: num(rows[0], "total_revenue"),
});

const toMonthly = (rows: any[], key: string) => {
  const out = Array(12).fill(0) as number[];
  rows.forEach((r) => {
    const idx = Number(getValue(r, "month_no")) - 1;
    if (idx >= 0 && idx < 12) out[idx] = num(r, key);
  });
  return out;
};

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

const card = "rounded-2xl border bg-card shadow-sm";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function CardHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
      <div className="min-w-0">
        <h3 className="m-0 text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="m-0 mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
      <AlertCircle size={14} /> {text}
    </div>
  );
}

// Ring chart. Segments are drawn clockwise from 12 o'clock.
function Donut({
  segments, size = 132, thickness = 16, children,
}: {
  segments: Array<{ value: number; color: string }>; size?: number; thickness?: number; children?: React.ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-muted" />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const gap = segments.filter((x) => x.value > 0).length > 1 ? 2 : 0;
            const el = (
              <circle
                key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
                strokeDasharray={`${Math.max(len - gap, 0)} ${circ}`} strokeDashoffset={-offset} strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero stat + period filter
// ---------------------------------------------------------------------------

function HeroStat({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading: boolean }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
      <p className="m-0 text-[11.5px] font-medium text-white/70">{label}</p>
      {loading ? (
        <div className="mt-1 h-6 w-20 animate-pulse rounded bg-white/20" />
      ) : (
        <p className="m-0 text-[22px] font-extrabold leading-tight tracking-tight tabular-nums">{value}</p>
      )}
      {sub && !loading && <p className="m-0 truncate text-[11px] text-white/60">{sub}</p>}
    </div>
  );
}

const selectCls =
  "h-8 cursor-pointer rounded-lg border border-white/25 bg-white/15 px-2.5 text-[12.5px] font-semibold text-white outline-none transition hover:bg-white/25 focus:border-white/60 disabled:opacity-60 [&>option]:text-slate-900";

function PeriodFilter({
  month, year, years, onMonth, onYear, disabled,
}: {
  month: number; year: number; years: number[]; onMonth: (m: number) => void; onYear: (y: number) => void; disabled: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <CalendarDays size={15} className="text-white/70" />
      <select aria-label="Month" value={month} disabled={disabled} onChange={(e) => onMonth(Number(e.target.value))} className={selectCls}>
        <option value={0}>All months</option>
        {MONTHS_FULL.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select aria-label="Year" value={year} disabled={disabled} onChange={(e) => onYear(Number(e.target.value))} className={selectCls}>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend chart (smooth area lines, hover tooltip, clickable legend)
// ---------------------------------------------------------------------------

type TrendSeries = { key: string; label: string; color: string; values: number[] };

function TrendChart({
  series, loading, highlight, year,
}: {
  series: TrendSeries[]; loading: boolean; highlight: number | null; year: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const W = 730, H = 220, L = 34, R = 12, T = 12, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const visible = series.filter((s) => !hidden.has(s.key));
  const scale = niceScale(Math.max(1, ...visible.flatMap((s) => s.values)));
  const x = (i: number) => L + (i / 11) * pw;
  const y = (v: number) => T + ph - (v / scale.max) * ph;
  const allZero = series.every((s) => s.values.every((v) => v === 0));
  const step = pw / 11;

  const toggle = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  if (loading) return <Skeleton className="mt-3 h-[220px]" />;

  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key} type="button" onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition ${off ? "bg-transparent text-muted-foreground opacity-60" : "bg-muted/60 text-foreground"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              <b className="tabular-nums">{fmtInt(s.values.reduce((a, b) => a + b, 0))}</b>
            </button>
          );
        })}
      </div>

      <div className="relative mt-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full text-border" onMouseLeave={() => setHover(null)}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Selected month band */}
          {highlight !== null && (
            <rect
              x={Math.max(L, x(highlight) - step / 2)} y={T}
              width={Math.min(step, W - R - Math.max(L, x(highlight) - step / 2))} height={ph}
              fill="currentColor" className="text-muted" opacity="0.55" rx="6"
            />
          )}

          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
            </g>
          ))}
          {MONTHS.map((m, i) => (
            <text
              key={m} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10.5"
              className={i === hover || i === highlight ? "fill-foreground font-semibold" : "fill-muted-foreground"}
            >
              {m}
            </text>
          ))}

          {visible.map((s) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = smoothPath(pts);
            return (
              <g key={s.key}>
                <path d={`${line} L${x(11)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#trend-${s.key})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
              </g>
            );
          })}

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground" />
              {visible.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill="white" stroke={s.color} strokeWidth="2.5" />
              ))}
            </g>
          )}

          <rect
            x={L} y={T} width={pw} height={ph} fill="transparent"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - box.left) / box.width;
              setHover(Math.min(11, Math.max(0, Math.round(ratio * 11))));
            }}
          />
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[128px] rounded-xl border bg-popover px-3 py-2 text-[12px] shadow-lg"
            style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`, transform: "translateX(-50%)" }}
          >
            <p className="m-0 mb-1 font-bold text-foreground">{MONTHS[hover]} {year}</p>
            {visible.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
                </span>
                <b className="tabular-nums text-foreground">{fmtInt(s.values[hover])}</b>
              </div>
            ))}
          </div>
        )}

        {allZero && (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted-foreground">No confirmed activity in {year}.</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped bars: inbound vs outbound vs transfer, per stage
// ---------------------------------------------------------------------------

function StageBars({
  groups, loading,
}: {
  groups: Array<{ label: string; values: [number, number, number] }>; loading: boolean;
}) {
  const W = 340, H = 220, L = 30, R = 6, T = 20, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const scale = niceScale(Math.max(1, ...groups.flatMap((g) => g.values)));
  const y = (v: number) => T + ph - (v / scale.max) * ph;
  const colors = [C.inbound, C.outbound, C.transfer];
  const gw = pw / groups.length;
  const bw = 22, gap = 4;

  if (loading) return <Skeleton className="mt-3 h-[220px]" />;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 block h-auto w-full text-border">
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
          <text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const start = L + gi * gw + (gw - (3 * bw + 2 * gap)) / 2;
        return (
          <g key={g.label}>
            {g.values.map((v, si) => {
              const bx = start + si * (bw + gap);
              const h = Math.max(y(0) - y(v), v > 0 ? 3 : 0);
              return (
                <g key={si}>
                  <rect x={bx} y={y(0) - h} width={bw} height={h} rx="5" fill={colors[si]}>
                    <title>{`${g.label}: ${fmtInt(v)}`}</title>
                  </rect>
                  <text x={bx + bw / 2} y={y(0) - h - 5} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-foreground tabular-nums">{fmtInt(v)}</text>
                </g>
              );
            })}
            <text x={L + gi * gw + gw / 2} y={H - 7} textAnchor="middle" fontSize="11" className="fill-muted-foreground">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Flow card (Inbound / Outbound / Transfer) - compact
// ---------------------------------------------------------------------------

function FlowCard({
  title, icon: Icon, color, data, stageLabels, footer, periodLabel, loading,
}: {
  title: string; icon: typeof Layers; color: string; data: Omit<JobKpi, "revenue"> | null;
  stageLabels: [string, string, string]; footer: { label: string; value: string; icon: typeof Layers };
  periodLabel: string; loading: boolean;
}) {
  const d = data ?? { total: 0, pending: 0, confirmPending: 0, confirmed: 0 };
  const stageTotal = d.pending + d.confirmPending + d.confirmed;
  const FooterIcon = footer.icon;
  const rows: Array<[string, number, string]> = [
    [stageLabels[0], d.pending, C.pending],
    [stageLabels[1], d.confirmPending, C.awaiting],
    [stageLabels[2], d.confirmed, C.done],
  ];

  return (
    <section className={`${card} flex min-w-0 flex-col gap-3 overflow-hidden p-3.5`}>
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h3>
          <p className="m-0 text-[11.5px] text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="ml-auto text-right">
          {loading && !data ? <Skeleton className="h-7 w-12" /> : (
            <p className="m-0 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtInt(d.total)}</p>
          )}
          <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">total jobs</p>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <Donut segments={rows.map(([, v, c]) => ({ value: v, color: c }))} size={92} thickness={12}>
          <div>
            <p className="m-0 text-[17px] font-extrabold leading-none tabular-nums text-foreground">{pct(d.confirmed, stageTotal)}%</p>
            <p className="m-0 mt-0.5 text-[10px] text-muted-foreground">confirmed</p>
          </div>
        </Donut>
        <ul className="m-0 grid min-w-0 flex-1 list-none gap-2 p-0">
          {rows.map(([label, value, c]) => (
            <li key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                <span className="truncate">{label}</span>
              </span>
              <b className="font-bold tabular-nums text-foreground">{fmtInt(value)}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          <FooterIcon size={13} /> {footer.label}
        </span>
        <b className="text-[13px] font-bold tabular-nums text-foreground">{footer.value}</b>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Top principals with Inbound / Outbound switch
// ---------------------------------------------------------------------------

function PrincipalsCard({
  inbound, outbound, names, periodLabel, loading,
}: {
  inbound: Slice<any[]>; outbound: Slice<any[]>; names: Record<string, string>; periodLabel: string; loading: boolean;
}) {
  const [tab, setTab] = useState<"in" | "out">("in");
  const slice = tab === "in" ? inbound : outbound;
  const color = tab === "in" ? C.inbound : C.outbound;
  const rows = slice.data ?? [];
  const top = Math.max(1, ...rows.map((r) => num(r, "total_bill")));
  const sum = rows.reduce((s, r) => s + num(r, "total_bill"), 0);

  return (
    <section className={`${card} min-w-0 overflow-hidden p-3.5`}>
      <CardHead
        title="Top 5 principals"
        subtitle={`By billing, ${periodLabel}`}
        right={
          <div className="inline-flex rounded-full bg-muted p-0.5 text-[11.5px] font-semibold">
            {(["in", "out"] as const).map((t) => (
              <button
                key={t} type="button" onClick={() => setTab(t)}
                className={`rounded-full px-2.5 py-0.5 transition ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {t === "in" ? "Inbound" : "Outbound"}
              </button>
            ))}
          </div>
        }
      />
      <div className="mt-3">
        {slice.error ? (
          <ErrorLine text={slice.error} />
        ) : loading && !slice.data ? (
          <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : rows.length === 0 ? (
          <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">No billing recorded for this period.</p>
        ) : (
          <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
            {rows.map((r, i) => {
              const bill = num(r, "total_bill");
              const code = String(getValue(r, "prin_code") ?? "").trim();
              const name = names[code];
              return (
                <li key={`${code}-${i}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10.5px] font-bold text-white" style={{ background: color, opacity: 1 - i * 0.14 }}>{i + 1}</span>
                      <span className="min-w-0" title={name ? `${name} (${code})` : code}>
                        <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">{name || code}</span>
                        {name && <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">{code}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <b className="text-[12.5px] font-bold tabular-nums text-foreground">{fmtMoney(bill)}</b>
                      <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">{pct(bill, sum)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(bill / top) * 100}%`, background: color, opacity: 1 - i * 0.12 }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function WmsDashboard() {
  const { user } = useAuth();

  // Filter: defaults to the current month and year
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(currentYear);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => currentYear - i), [currentYear]);

  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [inKpi, setInKpi] = useState<Slice<JobKpi>>({ data: null, error: null });
  const [inTop, setInTop] = useState<Slice<any[]>>({ data: null, error: null });
  const [outKpi, setOutKpi] = useState<Slice<JobKpi>>({ data: null, error: null });
  const [outTop, setOutTop] = useState<Slice<any[]>>({ data: null, error: null });
  const [trfKpi, setTrfKpi] = useState<Slice<TrfKpi>>({ data: null, error: null });
  const [jobsMonthly, setJobsMonthly] = useState<Slice<{ inb: number[]; out: number[] }>>({ data: null, error: null });
  const [trfMonthly, setTrfMonthly] = useState<Slice<number[]>>({ data: null, error: null });
  const [prinNames, setPrinNames] = useState<Record<string, string>>({});

  // Ignore responses from an older filter selection if the user changes filters quickly
  const requestId = useRef(0);

  // Optional font: loads Plus Jakarta Sans once, falls back to Inter/system if offline
  useEffect(() => {
    const id = "wms-dashboard-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  // Principal names do not depend on the period, so load them once per user
  useEffect(() => {
    if (!user?.company_code) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await getPrincipalDropdown(user?.company_code ?? "", user?.loginid ?? "");
        const map: Record<string, string> = {};
        (Array.isArray(rows) ? rows : []).forEach((r: any) => {
          const code = String(getValue(r, "prin_code") ?? "").trim();
          if (code) map[code] = String(getValue(r, "prin_name") ?? "").trim();
        });
        if (!cancelled) setPrinNames(map);
      } catch {
        if (!cancelled) setPrinNames({});
      }
    })();
    return () => { cancelled = true; };
  }, [user?.company_code, user?.loginid]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const isCurrent = () => id === requestId.current;
    const p = buildPeriod(year, month);

    setLoading(true);
    const wrap = async <T,>(sql: string, map: (rows: any[]) => T, set: (s: Slice<T>) => void) => {
      try {
        const result = map(await runSql(sql));
        if (isCurrent()) set({ data: result, error: null });
      } catch (e) {
        if (isCurrent()) set({ data: null, error: e instanceof Error ? e.message : "Failed to load data." });
      }
    };
    await Promise.all([
      wrap(jobKpiSql("IMP", "TT_BATCH", p), toJobKpi, setInKpi),
      wrap(topPrincipalSql("IMP", p), (r) => r, setInTop),
      wrap(jobKpiSql("EXP", "TO_BATCH", p), toJobKpi, setOutKpi),
      wrap(topPrincipalSql("EXP", p), (r) => r, setOutTop),
      wrap(transferKpiSql(p), (r): TrfKpi => ({
        total: num(r[0], "total_transfer"), pending: num(r[0], "transfer_pending"),
        confirmPending: num(r[0], "confirm_pending"), confirmed: num(r[0], "total_confirmed"),
      }), setTrfKpi),
      wrap(monthlyJobsSql(p), (r) => ({ inb: toMonthly(r, "confirmed_inbound"), out: toMonthly(r, "confirmed_outbound") }), setJobsMonthly),
      wrap(monthlyTransferSql(p), (r) => toMonthly(r, "confirmed_transfer"), setTrfMonthly),
    ]);
    if (!isCurrent()) return;
    setUpdatedAt(new Date());
    setLoading(false);
  }, [year, month]);

  // Runs on first load and whenever the month or year filter changes
  useEffect(() => { if (user?.company_code) load(); }, [user?.company_code, load]);

  const zeros = useMemo(() => Array(12).fill(0) as number[], []);

  const periodLabel = month === 0 ? `${year}` : `${MONTHS_FULL[month - 1]} ${year}`;
  const isCurrentYearAll = month === 0 && year === currentYear;
  const rangeText =
    month === 0
      ? isCurrentYearAll ? `Year to date, 1 Jan ${year} to today` : `Full year ${year}`
      : periodLabel;

  const inD = inKpi.data, outD = outKpi.data, trfD = trfKpi.data;

  const hero = useMemo(() => {
    const billing = (inD?.revenue ?? 0) + (outD?.revenue ?? 0);
    const jobs = (inD?.total ?? 0) + (outD?.total ?? 0) + (trfD?.total ?? 0);
    const confirmed = (inD?.confirmed ?? 0) + (outD?.confirmed ?? 0) + (trfD?.confirmed ?? 0);
    const open =
      (inD?.pending ?? 0) + (inD?.confirmPending ?? 0) +
      (outD?.pending ?? 0) + (outD?.confirmPending ?? 0) +
      (trfD?.pending ?? 0) + (trfD?.confirmPending ?? 0);
    return { billing, jobs, confirmed, open, rate: Math.min(100, pct(confirmed, confirmed + open)) };
  }, [inD, outD, trfD]);

  const trendSeries = useMemo<TrendSeries[]>(() => [
    { key: "inbound", label: "Inbound", color: C.inbound, values: jobsMonthly.data?.inb ?? zeros },
    { key: "outbound", label: "Outbound", color: C.outbound, values: jobsMonthly.data?.out ?? zeros },
    { key: "transfer", label: "Transfer", color: C.transfer, values: trfMonthly.data ?? zeros },
  ], [jobsMonthly.data, trfMonthly.data, zeros]);

  const stageGroups = useMemo(() => [
    { label: "Pending", values: [inD?.pending ?? 0, outD?.pending ?? 0, trfD?.pending ?? 0] as [number, number, number] },
    { label: "Awaiting", values: [inD?.confirmPending ?? 0, outD?.confirmPending ?? 0, trfD?.confirmPending ?? 0] as [number, number, number] },
    { label: "Confirmed", values: [inD?.confirmed ?? 0, outD?.confirmed ?? 0, trfD?.confirmed ?? 0] as [number, number, number] },
  ], [inD, outD, trfD]);

  const inRev = inD?.revenue ?? 0;
  const outRev = outD?.revenue ?? 0;
  const revTotal = inRev + outRev;

  const errors = [inKpi, inTop, outKpi, outTop, trfKpi, jobsMonthly, trfMonthly].filter((s) => s.error);
  const busyFirst = loading && !updatedAt;

  return (
    <div className="grid gap-3" style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}>
      {/* Hero: one slim row on wide screens */}
      <section
        className="relative overflow-hidden rounded-2xl px-4 py-3 text-white shadow-md"
        style={{ background: "linear-gradient(118deg, #00246B 0%, #00378C 48%, #1467D6 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid items-center gap-3 2xl:grid-cols-[340px_1fr]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight">Warehouse overview</h1>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-white/70">
                {rangeText}
                {updatedAt ? `. Updated ${updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </p>
              <PeriodFilter
                month={month} year={year} years={years}
                onMonth={setMonth} onYear={setYear} disabled={false}
              />
            </div>
            <button
              type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh dashboard"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat label="Total billing" value={fmtCompact(hero.billing)} sub={`In ${fmtCompact(inRev)}, out ${fmtCompact(outRev)}`} loading={busyFirst} />
            <HeroStat label="Total jobs" value={fmtInt(hero.jobs)} sub={`${fmtInt(inD?.total ?? 0)} in, ${fmtInt(outD?.total ?? 0)} out, ${fmtInt(trfD?.total ?? 0)} transfer`} loading={busyFirst} />
            <HeroStat label="Confirmed" value={fmtInt(hero.confirmed)} sub={`${hero.rate}% of handled work`} loading={busyFirst} />
            <HeroStat label="Needs action" value={fmtInt(hero.open)} sub="Pending plus awaiting confirm" loading={busyFirst} />
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <ErrorLine text={`${errors.length} of 7 queries failed. First error: ${errors[0].error}`} />
      )}

      {/* Row 1: three flows + billing split */}
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <FlowCard
          title="Inbound" icon={ArrowDownToLine} color={C.inbound} data={inD} loading={loading} periodLabel={periodLabel}
          footer={{ label: "Billing", value: fmtMoney(inRev), icon: Wallet2 }}
          stageLabels={["Putaway pending", "Confirm pending", "GRN confirmed"]}
        />
        <FlowCard
          title="Outbound" icon={ArrowUpFromLine} color={C.outbound} data={outD} loading={loading} periodLabel={periodLabel}
          footer={{ label: "Billing", value: fmtMoney(outRev), icon: Wallet2 }}
          stageLabels={["Pick pending", "Confirm pending", "Delivered"]}
        />
        <FlowCard
          title="Transfer" icon={ArrowLeftRight} color={C.transfer} data={trfD} loading={loading} periodLabel={periodLabel}
          footer={{ label: "Open transfers", value: fmtInt((trfD?.pending ?? 0) + (trfD?.confirmPending ?? 0)), icon: Layers }}
          stageLabels={["Transfer pending", "Confirm pending", "Confirmed"]}
        />

        <section className={`${card} flex min-w-0 flex-col gap-2 p-3.5`}>
          <CardHead title="Billing split" subtitle={`Inbound vs outbound, ${periodLabel}`} />
          <div className="flex flex-1 items-center gap-3">
            {busyFirst ? <Skeleton className="h-[96px] w-[96px] rounded-full" /> : (
              <Donut size={96} thickness={12} segments={[{ value: inRev, color: C.inbound }, { value: outRev, color: C.outbound }]}>
                <div>
                  <p className="m-0 text-[17px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtCompact(revTotal)}</p>
                  <p className="m-0 mt-0.5 text-[10px] text-muted-foreground">total</p>
                </div>
              </Donut>
            )}
            <div className="grid min-w-0 flex-1 gap-2">
              {[
                ["Inbound", inRev, C.inbound],
                ["Outbound", outRev, C.outbound],
              ].map(([label, value, color]) => (
                <div key={label as string} className="rounded-xl bg-muted/60 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <LegendDot color={color as string} label={label as string} />
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{pct(value as number, revTotal)}%</span>
                  </div>
                  <b className="text-[13px] font-bold tabular-nums text-foreground">{fmtMoney(value as number)}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: trend + stage comparison + principals */}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-12">
        <section className={`${card} min-w-0 p-3.5 lg:col-span-2 2xl:col-span-6`}>
          <CardHead
            title="Confirmed jobs by month"
            subtitle={month === 0 ? `Year ${year}. Click a legend chip to hide a line` : `Year ${year}, ${MONTHS_FULL[month - 1]} highlighted. Click a legend chip to hide a line`}
          />
          <TrendChart series={trendSeries} loading={busyFirst} highlight={month === 0 ? null : month - 1} year={year} />
        </section>

        <section className={`${card} min-w-0 p-3.5 2xl:col-span-3`}>
          <CardHead title="Workload by stage" subtitle={`Status by flow, ${periodLabel}`} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[["Inbound", C.inbound], ["Outbound", C.outbound], ["Transfer", C.transfer]].map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 text-[11.5px] font-medium text-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          <StageBars groups={stageGroups} loading={busyFirst} />
        </section>

        <div className="min-w-0 2xl:col-span-3 [&>section]:h-full">
          <PrincipalsCard inbound={inTop} outbound={outTop} names={prinNames} periodLabel={periodLabel} loading={loading} />
        </div>
      </div>
    </div>
  );
}