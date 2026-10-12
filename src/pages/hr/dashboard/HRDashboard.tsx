// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import type { ReactNode } from "react";
// import {
//   AlertCircle, Building2, CalendarDays, Layers, Palmtree, RefreshCw, UserCheck, UserMinus, UserPlus, Users, VenusAndMars,
// } from "lucide-react";
// import { useAuth } from "../../../state/AuthContext";
// import { procBuildDynamicSqlCommonBase } from "../../../api/wms";
// import { fetchHrDashboardData } from "../../../api/wms";

// // ---------------------------------------------------------------------------
// // Period (month + year filter)
// // month = 0 means "All months" (whole year), 1..12 = a single month
// // The proc reads year from P_NUMBER1 and month from P_NUMBER2.
// // ---------------------------------------------------------------------------

// const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// const MONTHS_FULL = [
//   "January", "February", "March", "April", "May", "June",
//   "July", "August", "September", "October", "November", "December",
// ];

// // ---------------------------------------------------------------------------
// // Helpers
// // ---------------------------------------------------------------------------

// const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];
// const num = (obj: any, key: string) => Number(getValue(obj, key) ?? 0) || 0;
// const str = (obj: any, key: string) => String(getValue(obj, key) ?? "").trim();

// const fmtInt = (n: number) => n.toLocaleString("en-US");
// const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
// const fmtCompact = (n: number) => compactFmt.format(n);
// const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// const C = {
//   joiners: "#10B981",
//   separations: "#F59E0B",
//   headcount: "#2563EB",
//   leave: "#6366F1",
// };

// const PALETTE = ["#2563EB", "#F59E0B", "#10B981", "#6366F1", "#EC4899", "#94A3B8"];

// const niceScale = (max: number) => {
//   const raw = Math.max(max, 1) / 4;
//   const mag = Math.pow(10, Math.floor(Math.log10(raw)));
//   const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) as number;
//   return { step, max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
// };

// const smoothPath = (pts: Array<[number, number]>) => {
//   if (pts.length < 2) return "";
//   let d = `M${pts[0][0]},${pts[0][1]}`;
//   for (let i = 0; i < pts.length - 1; i++) {
//     const [x0, y0] = pts[i];
//     const [x1, y1] = pts[i + 1];
//     const cx = (x0 + x1) / 2;
//     d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
//   }
//   return d;
// };

// type Slice<T> = { data: T | null; error: string | null };
// type Summary = { total: number; onLeave: number; joiners: number; separations: number };

// const toSummary = (rows: any[]): Summary => ({
//   total: num(rows[0], "total_employees"),
//   onLeave: num(rows[0], "employees_on_leave"),
//   joiners: num(rows[0], "joiners"),
//   separations: num(rows[0], "separations"),
// });

// const toMonthly = (rows: any[], key: string) => {
//   const out = Array(12).fill(0) as number[];
//   rows.forEach((r) => {
//     const idx = Number(getValue(r, "month_no")) - 1;
//     if (idx >= 0 && idx < 12) out[idx] = num(r, key);
//   });
//   return out;
// };

// // The proc sorts age/service buckets by label (alphabetical), so order them here.
// const AGE_ORDER = ["Below 30", "30-39", "40-49", "50-59", "60 and Above", "Unknown"];
// const SERVICE_ORDER = ["Less than 1 Year", "1-4 Years", "5-9 Years", "10-14 Years", "15-19 Years", "20 Years and Above", "Unknown"];
// const SHORT: Record<string, string> = {
//   "Below 30": "<30", "60 and Above": "60+",
//   "Less than 1 Year": "<1 yr", "1-4 Years": "1-4 yr", "5-9 Years": "5-9 yr",
//   "10-14 Years": "10-14", "15-19 Years": "15-19", "20 Years and Above": "20+ yr",
//   Unknown: "N/A",
// };

// const toBuckets = (rows: any[], labelKey: string, order: string[]) =>
//   order
//     .map((label) => {
//       const row = rows.find((r) => str(r, labelKey) === label);
//       return { label: SHORT[label] ?? label, full: label, value: row ? num(row, "employee_count") : 0 };
//     })
//     .filter((b) => b.full !== "Unknown" || b.value > 0);

// const genderLabel = (g: string) => {
//   const v = g.toUpperCase();
//   if (v === "M" || v === "MALE") return "Male";
//   if (v === "F" || v === "FEMALE") return "Female";
//   return g || "Unspecified";
// };

// // ---------------------------------------------------------------------------
// // Shared UI
// // ---------------------------------------------------------------------------

// const card = "rounded-2xl border bg-card shadow-sm";

// function Skeleton({ className = "" }: { className?: string }) {
//   return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
// }

// function CardHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
//   return (
//     <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
//       <div className="min-w-0">
//         <h3 className="m-0 text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h3>
//         {subtitle && <p className="m-0 mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p>}
//       </div>
//       {right}
//     </div>
//   );
// }

// function ErrorLine({ text }: { text: string }) {
//   return (
//     <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
//       <AlertCircle size={14} /> {text}
//     </div>
//   );
// }

// // Ring chart. Segments are drawn clockwise from 12 o'clock.
// function Donut({
//   segments, size = 132, thickness = 16, children,
// }: {
//   segments: Array<{ value: number; color: string }>; size?: number; thickness?: number; children?: ReactNode;
// }) {
//   const total = segments.reduce((s, x) => s + x.value, 0);
//   const r = (size - thickness) / 2;
//   const circ = 2 * Math.PI * r;
//   let offset = 0;
//   return (
//     <div className="relative shrink-0" style={{ width: size, height: size }}>
//       <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
//         <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-muted" />
//         {total > 0 &&
//           segments.map((s, i) => {
//             const len = (s.value / total) * circ;
//             const gap = segments.filter((x) => x.value > 0).length > 1 ? 2 : 0;
//             const el = (
//               <circle
//                 key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
//                 strokeDasharray={`${Math.max(len - gap, 0)} ${circ}`} strokeDashoffset={-offset} strokeLinecap="butt"
//               />
//             );
//             offset += len;
//             return el;
//           })}
//       </svg>
//       <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Hero stat + period filter
// // ---------------------------------------------------------------------------

// function HeroStat({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading: boolean }) {
//   return (
//     <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
//       <p className="m-0 text-[11.5px] font-medium text-white/70">{label}</p>
//       {loading ? (
//         <div className="mt-1 h-6 w-20 animate-pulse rounded bg-white/20" />
//       ) : (
//         <p className="m-0 text-[22px] font-extrabold leading-tight tracking-tight tabular-nums">{value}</p>
//       )}
//       {sub && !loading && <p className="m-0 truncate text-[11px] text-white/60">{sub}</p>}
//     </div>
//   );
// }

// const selectCls =
//   "h-8 cursor-pointer rounded-lg border border-white/25 bg-white/15 px-2.5 text-[12.5px] font-semibold text-white outline-none transition hover:bg-white/25 focus:border-white/60 disabled:opacity-60 [&>option]:text-slate-900";

// function PeriodFilter({
//   month, year, years, onMonth, onYear, disabled,
// }: {
//   month: number; year: number; years: number[]; onMonth: (m: number) => void; onYear: (y: number) => void; disabled: boolean;
// }) {
//   return (
//     <div className="mt-2 flex flex-wrap items-center gap-2">
//       <CalendarDays size={15} className="text-white/70" />
//       <select aria-label="Month" value={month} disabled={disabled} onChange={(e) => onMonth(Number(e.target.value))} className={selectCls}>
//         <option value={0}>All months</option>
//         {MONTHS_FULL.map((m, i) => (
//           <option key={m} value={i + 1}>{m}</option>
//         ))}
//       </select>
//       <select aria-label="Year" value={year} disabled={disabled} onChange={(e) => onYear(Number(e.target.value))} className={selectCls}>
//         {years.map((y) => (
//           <option key={y} value={y}>{y}</option>
//         ))}
//       </select>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Trend chart (smooth area lines, hover tooltip, clickable legend)
// // ---------------------------------------------------------------------------

// type TrendSeries = { key: string; label: string; color: string; values: number[] };

// function TrendChart({
//   series, loading, highlight, year,
// }: {
//   series: TrendSeries[]; loading: boolean; highlight: number | null; year: number;
// }) {
//   const [hidden, setHidden] = useState<Set<string>>(new Set());
//   const [hover, setHover] = useState<number | null>(null);

//   const W = 730, H = 220, L = 34, R = 12, T = 12, B = 26;
//   const pw = W - L - R, ph = H - T - B;
//   const visible = series.filter((s) => !hidden.has(s.key));
//   const scale = niceScale(Math.max(1, ...visible.flatMap((s) => s.values)));
//   const x = (i: number) => L + (i / 11) * pw;
//   const y = (v: number) => T + ph - (v / scale.max) * ph;
//   const allZero = series.every((s) => s.values.every((v) => v === 0));
//   const step = pw / 11;

//   const toggle = (k: string) =>
//     setHidden((prev) => {
//       const next = new Set(prev);
//       next.has(k) ? next.delete(k) : next.add(k);
//       return next;
//     });

//   if (loading) return <Skeleton className="mt-3 h-[220px]" />;

//   return (
//     <div>
//       <div className="mt-2 flex flex-wrap gap-1.5">
//         {series.map((s) => {
//           const off = hidden.has(s.key);
//           return (
//             <button
//               key={s.key} type="button" onClick={() => toggle(s.key)}
//               className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition ${off ? "bg-transparent text-muted-foreground opacity-60" : "bg-muted/60 text-foreground"}`}
//             >
//               <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
//               {s.label}
//               <b className="tabular-nums">{fmtInt(s.values.reduce((a, b) => a + b, 0))}</b>
//             </button>
//           );
//         })}
//       </div>

//       <div className="relative mt-1.5">
//         <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full text-border" onMouseLeave={() => setHover(null)}>
//           <defs>
//             {series.map((s) => (
//               <linearGradient key={s.key} id={`hr-trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
//                 <stop offset="100%" stopColor={s.color} stopOpacity="0" />
//               </linearGradient>
//             ))}
//           </defs>

//           {highlight !== null && (
//             <rect
//               x={Math.max(L, x(highlight) - step / 2)} y={T}
//               width={Math.min(step, W - R - Math.max(L, x(highlight) - step / 2))} height={ph}
//               fill="currentColor" className="text-muted" opacity="0.55" rx="6"
//             />
//           )}

//           {scale.ticks.map((t) => (
//             <g key={t}>
//               <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
//               <text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
//             </g>
//           ))}
//           {MONTHS.map((m, i) => (
//             <text
//               key={m} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10.5"
//               className={i === hover || i === highlight ? "fill-foreground font-semibold" : "fill-muted-foreground"}
//             >
//               {m}
//             </text>
//           ))}

//           {visible.map((s) => {
//             const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
//             const line = smoothPath(pts);
//             return (
//               <g key={s.key}>
//                 <path d={`${line} L${x(11)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#hr-trend-${s.key})`} />
//                 <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
//               </g>
//             );
//           })}

//           {hover !== null && (
//             <g>
//               <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground" />
//               {visible.map((s) => (
//                 <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill="white" stroke={s.color} strokeWidth="2.5" />
//               ))}
//             </g>
//           )}

//           <rect
//             x={L} y={T} width={pw} height={ph} fill="transparent"
//             onMouseMove={(e) => {
//               const box = e.currentTarget.getBoundingClientRect();
//               const ratio = (e.clientX - box.left) / box.width;
//               setHover(Math.min(11, Math.max(0, Math.round(ratio * 11))));
//             }}
//           />
//         </svg>

//         {hover !== null && (
//           <div
//             className="pointer-events-none absolute top-1 z-10 min-w-[128px] rounded-xl border bg-popover px-3 py-2 text-[12px] shadow-lg"
//             style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`, transform: "translateX(-50%)" }}
//           >
//             <p className="m-0 mb-1 font-bold text-foreground">{MONTHS[hover]} {year}</p>
//             {visible.map((s) => (
//               <div key={s.key} className="flex items-center justify-between gap-4">
//                 <span className="inline-flex items-center gap-1.5 text-muted-foreground">
//                   <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
//                 </span>
//                 <b className="tabular-nums text-foreground">{fmtInt(s.values[hover])}</b>
//               </div>
//             ))}
//           </div>
//         )}

//         {allZero && (
//           <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted-foreground">No joiners or separations in {year}.</div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Single-series bar chart (age / service length)
// // ---------------------------------------------------------------------------

// function BarChart({
//   items, color, loading,
// }: {
//   items: Array<{ label: string; full: string; value: number }>; color: string; loading: boolean;
// }) {
//   const W = 340, H = 220, L = 30, R = 6, T = 20, B = 26;
//   const pw = W - L - R, ph = H - T - B;
//   const scale = niceScale(Math.max(1, ...items.map((i) => i.value)));
//   const y = (v: number) => T + ph - (v / scale.max) * ph;
//   const gw = pw / Math.max(items.length, 1);
//   const bw = Math.min(30, gw - 8);

//   if (loading) return <Skeleton className="mt-3 h-[220px]" />;

//   return (
//     <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 block h-auto w-full text-border">
//       {scale.ticks.map((t) => (
//         <g key={t}>
//           <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
//           <text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
//         </g>
//       ))}
//       {items.map((it, i) => {
//         const cx = L + i * gw + gw / 2;
//         const h = Math.max(y(0) - y(it.value), it.value > 0 ? 3 : 0);
//         return (
//           <g key={it.full}>
//             <rect x={cx - bw / 2} y={y(0) - h} width={bw} height={h} rx="5" fill={color}>
//               <title>{`${it.full}: ${fmtInt(it.value)}`}</title>
//             </rect>
//             <text x={cx} y={y(0) - h - 5} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-foreground tabular-nums">{fmtInt(it.value)}</text>
//             <text x={cx} y={H - 7} textAnchor="middle" fontSize="10" className="fill-muted-foreground">{it.label}</text>
//           </g>
//         );
//       })}
//     </svg>
//   );
// }

// // ---------------------------------------------------------------------------
// // Donut + legend card (division / grade / gender / status)
// // ---------------------------------------------------------------------------

// function DonutListCard({
//   title, subtitle, icon: Icon, accent, slice, labelOf, loading,
// }: {
//   title: string; subtitle: string; icon: typeof Layers; accent: string;
//   slice: Slice<any[]>; labelOf: (row: any) => string; loading: boolean;
// }) {
//   const all = (slice.data ?? []).map((r) => ({ label: labelOf(r), value: num(r, "employee_count") })).filter((r) => r.value > 0);
//   const top = all.slice(0, 5);
//   const rest = all.slice(5).reduce((s, r) => s + r.value, 0);
//   const rows = rest > 0 ? [...top, { label: "Others", value: rest }] : top;
//   const total = all.reduce((s, r) => s + r.value, 0);

//   return (
//     <section className={`${card} flex min-w-0 flex-col gap-3 overflow-hidden p-3.5`}>
//       <div className="flex items-center gap-2.5">
//         <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: accent }}>
//           <Icon size={17} />
//         </div>
//         <div className="min-w-0">
//           <h3 className="m-0 text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h3>
//           <p className="m-0 text-[11.5px] text-muted-foreground">{subtitle}</p>
//         </div>
//         <div className="ml-auto text-right">
//           {loading && !slice.data ? <Skeleton className="h-7 w-12" /> : (
//             <p className="m-0 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtInt(total)}</p>
//           )}
//           <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">employees</p>
//         </div>
//       </div>

//       {slice.error ? (
//         <ErrorLine text={slice.error} />
//       ) : loading && !slice.data ? (
//         <Skeleton className="h-[92px]" />
//       ) : rows.length === 0 ? (
//         <p className="m-0 py-6 text-center text-[12.5px] text-muted-foreground">No employees found.</p>
//       ) : (
//         <div className="flex flex-1 items-center gap-3">
//           <Donut segments={rows.map((r, i) => ({ value: r.value, color: PALETTE[i % PALETTE.length] }))} size={92} thickness={12}>
//             <div>
//               <p className="m-0 text-[17px] font-extrabold leading-none tabular-nums text-foreground">{pct(rows[0].value, total)}%</p>
//               <p className="m-0 mt-0.5 max-w-[56px] truncate text-[10px] text-muted-foreground">{rows[0].label}</p>
//             </div>
//           </Donut>
//           <ul className="m-0 grid min-w-0 flex-1 list-none gap-1.5 p-0">
//             {rows.map((r, i) => (
//               <li key={`${r.label}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
//                 <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
//                   <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
//                   <span className="truncate" title={r.label}>{r.label}</span>
//                 </span>
//                 <b className="font-bold tabular-nums text-foreground">{fmtInt(r.value)}</b>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Top departments
// // ---------------------------------------------------------------------------

// function DepartmentsCard({ slice, loading }: { slice: Slice<any[]>; loading: boolean }) {
//   const all = slice.data ?? [];
//   const rows = all.slice(0, 5);
//   const top = Math.max(1, ...rows.map((r) => num(r, "employee_count")));
//   const sum = all.reduce((s, r) => s + num(r, "employee_count"), 0);

//   return (
//     <section className={`${card} min-w-0 overflow-hidden p-3.5`}>
//       <CardHead title="Top 5 departments" subtitle={`By headcount, ${all.length} departments in total`} />
//       <div className="mt-3">
//         {slice.error ? (
//           <ErrorLine text={slice.error} />
//         ) : loading && !slice.data ? (
//           <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
//         ) : rows.length === 0 ? (
//           <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">No departments found.</p>
//         ) : (
//           <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
//             {rows.map((r, i) => {
//               const count = num(r, "employee_count");
//               const code = str(r, "dept_code") || "Unassigned";
//               return (
//                 <li key={`${code}-${i}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
//                   <div className="flex items-center justify-between gap-2">
//                     <span className="flex min-w-0 items-center gap-2">
//                       <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10.5px] font-bold text-white" style={{ background: C.headcount, opacity: 1 - i * 0.14 }}>{i + 1}</span>
//                       <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground" title={code}>{code}</span>
//                     </span>
//                     <span className="shrink-0 text-right">
//                       <b className="text-[12.5px] font-bold tabular-nums text-foreground">{fmtInt(count)}</b>
//                       <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">{pct(count, sum)}%</span>
//                     </span>
//                   </div>
//                   <div className="h-1.5 overflow-hidden rounded-full bg-muted">
//                     <div className="h-full rounded-full" style={{ width: `${(count / top) * 100}%`, background: C.headcount, opacity: 1 - i * 0.12 }} />
//                   </div>
//                 </li>
//               );
//             })}
//           </ol>
//         )}
//       </div>
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Division x Grade matrix
// // ---------------------------------------------------------------------------

// function MatrixCard({ slice, loading }: { slice: Slice<any[]>; loading: boolean }) {
//   const { divs, grades, max } = useMemo(() => {
//     const dMap = new Map<string, { label: string; total: number; cells: Record<string, number> }>();
//     const gMap = new Map<string, { label: string; total: number }>();
//     (slice.data ?? []).forEach((r) => {
//       const dc = str(r, "div_code") || "-";
//       const gc = str(r, "grade_code") || "-";
//       const n = num(r, "employee_count");
//       const d = dMap.get(dc) ?? { label: str(r, "div_name") || dc, total: 0, cells: {} };
//       d.total += n;
//       d.cells[gc] = (d.cells[gc] ?? 0) + n;
//       dMap.set(dc, d);
//       const g = gMap.get(gc) ?? { label: str(r, "grade_name") || gc, total: 0 };
//       g.total += n;
//       gMap.set(gc, g);
//     });
//     const divs = [...dMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
//     const grades = [...gMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);
//     const max = Math.max(1, ...divs.flatMap(([, d]) => grades.map(([gc]) => d.cells[gc] ?? 0)));
//     return { divs, grades, max };
//   }, [slice.data]);

//   return (
//     <section className={`${card} min-w-0 overflow-hidden p-3.5`}>
//       <CardHead title="Division by grade" subtitle="Headcount matrix, top divisions and grades" />
//       <div className="mt-3">
//         {slice.error ? (
//           <ErrorLine text={slice.error} />
//         ) : loading && !slice.data ? (
//           <Skeleton className="h-[200px]" />
//         ) : divs.length === 0 ? (
//           <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">No data available.</p>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full border-separate border-spacing-1 text-[11.5px]">
//               <thead>
//                 <tr>
//                   <th className="px-1 text-left font-semibold text-muted-foreground">Division</th>
//                   {grades.map(([gc, g]) => (
//                     <th key={gc} className="max-w-[70px] truncate px-1 text-center font-semibold text-muted-foreground" title={g.label}>{gc}</th>
//                   ))}
//                   <th className="px-1 text-right font-semibold text-muted-foreground">Total</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {divs.map(([dc, d]) => (
//                   <tr key={dc}>
//                     <td className="max-w-[130px] truncate px-1 font-medium text-foreground" title={d.label}>{d.label}</td>
//                     {grades.map(([gc]) => {
//                       const v = d.cells[gc] ?? 0;
//                       return (
//                         <td
//                           key={gc}
//                           className="rounded-md px-1 py-1 text-center font-semibold tabular-nums text-foreground"
//                           style={{ background: v > 0 ? `rgba(37,99,235,${0.1 + 0.5 * (v / max)})` : undefined }}
//                         >
//                           {v > 0 ? fmtInt(v) : <span className="text-muted-foreground">-</span>}
//                         </td>
//                       );
//                     })}
//                     <td className="px-1 text-right font-bold tabular-nums text-foreground">{fmtInt(d.total)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Employees on leave
// // ---------------------------------------------------------------------------

// function OnLeaveCard({ slice, loading }: { slice: Slice<any[]>; loading: boolean }) {
//   const rows = slice.data ?? [];
//   return (
//     <section className={`${card} flex min-w-0 flex-col overflow-hidden p-3.5`}>
//       <CardHead
//         title="Employees on leave"
//         subtitle="Currently away"
//         right={<span className="rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-foreground">{fmtInt(rows.length)}</span>}
//       />
//       <div className="mt-3 max-h-[260px] flex-1 overflow-y-auto pr-1">
//         {slice.error ? (
//           <ErrorLine text={slice.error} />
//         ) : loading && !slice.data ? (
//           <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
//         ) : rows.length === 0 ? (
//           <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">Nobody is on leave.</p>
//         ) : (
//           <ul className="m-0 grid list-none gap-2 p-0">
//             {rows.map((r, i) => {
//               const code = str(r, "employee_code") || str(r, "employee_id");
//               const meta = [str(r, "div_code"), str(r, "dept_code"), str(r, "grade_code")].filter(Boolean).join(" / ");
//               return (
//                 <li key={`${code}-${i}`} className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-3 py-1.5">
//                   <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ background: C.leave }}>
//                     <Palmtree size={14} />
//                   </span>
//                   <span className="min-w-0">
//                     <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">{code}</span>
//                     {meta && <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">{meta}</span>}
//                   </span>
//                 </li>
//               );
//             })}
//           </ul>
//         )}
//       </div>
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Main
// // ---------------------------------------------------------------------------

// const empty = <T,>(): Slice<T> => ({ data: null, error: null });

// export default function HrDashboard() {
//   const { user } = useAuth();

//   // Filter: defaults to the current month and year
//   const now = useMemo(() => new Date(), []);
//   const currentYear = now.getFullYear();
//   const [month, setMonth] = useState<number>(now.getMonth() + 1);
//   const [year, setYear] = useState<number>(currentYear);
//   const years = useMemo(() => Array.from({ length: 6 }, (_, i) => currentYear - i), [currentYear]);

//   const [loading, setLoading] = useState(true);
//   const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

//   const [summary, setSummary] = useState<Slice<Summary>>(empty());
//   const [divs, setDivs] = useState<Slice<any[]>>(empty());
//   const [grades, setGrades] = useState<Slice<any[]>>(empty());
//   const [divGrade, setDivGrade] = useState<Slice<any[]>>(empty());
//   const [depts, setDepts] = useState<Slice<any[]>>(empty());
//   const [gender, setGender] = useState<Slice<any[]>>(empty());
//   const [status, setStatus] = useState<Slice<any[]>>(empty());
//   const [age, setAge] = useState<Slice<ReturnType<typeof toBuckets>>>(empty());
//   const [service, setService] = useState<Slice<ReturnType<typeof toBuckets>>>(empty());
//   const [joiners, setJoiners] = useState<Slice<number[]>>(empty());
//   const [seps, setSeps] = useState<Slice<number[]>>(empty());
//   const [onLeave, setOnLeave] = useState<Slice<any[]>>(empty());

//   // Ignore responses from an older filter selection if the user changes filters quickly
//   const requestId = useRef(0);

//   // Optional font: loads Plus Jakarta Sans once, falls back to Inter/system if offline
//   useEffect(() => {
//     const id = "wms-dashboard-font";
//     if (document.getElementById(id)) return;
//     const link = document.createElement("link");
//     link.id = id;
//     link.rel = "stylesheet";
//     link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
//     document.head.appendChild(link);
//   }, []);

//   const load = useCallback(async () => {
//     if (!user?.company_code) return;
//     const id = ++requestId.current;
//     const isCurrent = () => id === requestId.current;

//     // month: 0 = whole year. Headcount snapshots ignore it, joiners/separations honour it.
//     const call = async (parameter: string, m: number): Promise<any[]> => {
//       // Call the new dedicated API
//       const rows = await fetchHrDashboardData({
//         parameter,
//         loginid: user.loginid ?? "",
//         code1: user.company_code,
//         number1: year,
//         number2: m,
//       });
//       return Array.isArray(rows) ? (rows as any[]) : [];
//     };

//     setLoading(true);
//     const wrap = async <T,>(parameter: string, m: number, map: (rows: any[]) => T, set: (s: Slice<T>) => void) => {
//       try {
//         const result = map(await call(parameter, m));
//         if (isCurrent()) set({ data: result, error: null });
//       } catch (e) {
//         if (isCurrent()) set({ data: null, error: e instanceof Error ? e.message : "Failed to load data." });
//       }
//     };
//     const raw = (r: any[]) => r;

//     await Promise.all([
//       wrap("HCM_DBOARD_FROM_DUAL", month, toSummary, setSummary),
//       wrap("HCM_DBOARD_DIVISIONWISE_EMPLOYEES", month, raw, setDivs),
//       wrap("HCM_DBOARD_GRADEWISE_EMPLOYEES", month, raw, setGrades),
//       wrap("HCM_DBOARD_DIVISION_GRADEWISE_EMPLOYEES", month, raw, setDivGrade),
//       wrap("HCM_DBOARD_DEPARTMENTWISE_EMPLOYEES", month, raw, setDepts),
//       wrap("HCM_DBOARD_GENDERWISE_EMPLOYEES", month, raw, setGender),
//       wrap("HCM_DBOARD_EMP_STATUS", month, raw, setStatus),
//       wrap("HCM_DBOARD_AGEWISE_EMPLOYEES", month, (r) => toBuckets(r, "age_group", AGE_ORDER), setAge),
//       wrap("HCM_DBOARD_SERVICE_LENGTHWISE_EMPLOYEES", month, (r) => toBuckets(r, "service_group", SERVICE_ORDER), setService),
//       // Trend charts always cover the whole selected year (month = 0) so the shape stays visible.
//       wrap("HCM_DBOARD_MONTHWISE_JOINERS", 0, (r) => toMonthly(r, "joiners"), setJoiners),
//       wrap("HCM_DBOARD_MONTHWISE_SEPARATIONS", 0, (r) => toMonthly(r, "separations"), setSeps),
//       wrap("HCM_DBOARD_ON_LEAVE", month, raw, setOnLeave),
//     ]);
//     if (!isCurrent()) return;
//     setUpdatedAt(new Date());
//     setLoading(false);
//   }, [user?.company_code, user?.loginid, year, month]);

//   // Runs on first load and whenever the month or year filter changes
//   useEffect(() => { load(); }, [load]);

//   const zeros = useMemo(() => Array(12).fill(0) as number[], []);

//   const periodLabel = month === 0 ? `${year}` : `${MONTHS_FULL[month - 1]} ${year}`;
//   const isCurrentYearAll = month === 0 && year === currentYear;
//   const rangeText =
//     month === 0
//       ? isCurrentYearAll ? `Year to date, 1 Jan ${year} to today` : `Full year ${year}`
//       : periodLabel;

//   const s = summary.data;
//   const net = (s?.joiners ?? 0) - (s?.separations ?? 0);

//   const trendSeries = useMemo<TrendSeries[]>(() => [
//     { key: "joiners", label: "Joiners", color: C.joiners, values: joiners.data ?? zeros },
//     { key: "separations", label: "Separations", color: C.separations, values: seps.data ?? zeros },
//   ], [joiners.data, seps.data, zeros]);

//   const slices = [summary, divs, grades, divGrade, depts, gender, status, age, service, joiners, seps, onLeave];
//   const errors = slices.filter((x) => x.error);
//   const busyFirst = loading && !updatedAt;

//   return (
//     <div className="grid gap-3" style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}>
//       {/* Hero */}
//       <section
//         className="relative overflow-hidden rounded-2xl px-4 py-3 text-white shadow-md"
//         style={{ background: "linear-gradient(118deg, #00246B 0%, #00378C 48%, #1467D6 100%)" }}
//       >
//         <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
//         <div className="relative grid items-center gap-3 2xl:grid-cols-[340px_1fr]">
//           <div className="flex items-start justify-between gap-3">
//             <div className="min-w-0">
//               <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight">HR overview</h1>
//               <p className="m-0 mt-0.5 text-[12px] leading-snug text-white/70">
//                 {rangeText}
//                 {updatedAt ? `. Updated ${updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
//               </p>
//               <PeriodFilter month={month} year={year} years={years} onMonth={setMonth} onYear={setYear} disabled={false} />
//             </div>
//             <button
//               type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh dashboard"
//               className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
//             >
//               <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
//             </button>
//           </div>

//           <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
//             <HeroStat
//               label="Total employees" value={fmtInt(s?.total ?? 0)}
//               sub={`${fmtInt(divs.data?.length ?? 0)} divisions, ${fmtInt(depts.data?.length ?? 0)} departments`} loading={busyFirst}
//             />
//             <HeroStat
//               label="On leave" value={fmtInt(s?.onLeave ?? 0)}
//               sub={`${pct(s?.onLeave ?? 0, s?.total ?? 0)}% of headcount`} loading={busyFirst}
//             />
//             <HeroStat label="Joiners" value={fmtInt(s?.joiners ?? 0)} sub={periodLabel} loading={busyFirst} />
//             <HeroStat
//               label="Separations" value={fmtInt(s?.separations ?? 0)}
//               sub={`Net ${net > 0 ? "+" : ""}${fmtInt(net)} in ${periodLabel}`} loading={busyFirst}
//             />
//           </div>
//         </div>
//       </section>

//       {errors.length > 0 && (
//         <ErrorLine text={`${errors.length} of ${slices.length} queries failed. First error: ${errors[0].error}`} />
//       )}

//       {/* Row 1: headcount breakdowns */}
//       <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
//         <DonutListCard
//           title="By division" subtitle="Current headcount" icon={Building2} accent={C.headcount}
//           slice={divs} loading={loading} labelOf={(r) => str(r, "div_name") || str(r, "div_code") || "Unassigned"}
//         />
//         <DonutListCard
//           title="By grade" subtitle="Current headcount" icon={Layers} accent={C.joiners}
//           slice={grades} loading={loading} labelOf={(r) => str(r, "grade_name") || str(r, "grade_code") || "Unassigned"}
//         />
//         <DonutListCard
//           title="By gender" subtitle="Current headcount" icon={VenusAndMars} accent={C.separations}
//           slice={gender} loading={loading} labelOf={(r) => genderLabel(str(r, "gender"))}
//         />
//         <DonutListCard
//           title="By status" subtitle="Employee status" icon={UserCheck} accent={C.leave}
//           slice={status} loading={loading} labelOf={(r) => str(r, "emp_status") || "Unknown"}
//         />
//       </div>

//       {/* Row 2: trend + age + service length */}
//       <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-12">
//         <section className={`${card} min-w-0 p-3.5 lg:col-span-2 2xl:col-span-6`}>
//           <CardHead
//             title="Joiners and separations by month"
//             subtitle={month === 0 ? `Year ${year}. Click a legend chip to hide a line` : `Year ${year}, ${MONTHS_FULL[month - 1]} highlighted. Click a legend chip to hide a line`}
//             right={
//               <span className="inline-flex items-center gap-2 text-[11.5px] text-muted-foreground">
//                 <UserPlus size={13} style={{ color: C.joiners }} /> <UserMinus size={13} style={{ color: C.separations }} />
//               </span>
//             }
//           />
//           {(joiners.error || seps.error) && <div className="mt-2"><ErrorLine text={joiners.error || seps.error || ""} /></div>}
//           <TrendChart series={trendSeries} loading={busyFirst} highlight={month === 0 ? null : month - 1} year={year} />
//         </section>

//         <section className={`${card} min-w-0 p-3.5 2xl:col-span-3`}>
//           <CardHead title="Age profile" subtitle="Employees by age group" />
//           {age.error ? <div className="mt-3"><ErrorLine text={age.error} /></div> : (
//             <BarChart items={age.data ?? AGE_ORDER.slice(0, 5).map((l) => ({ label: SHORT[l] ?? l, full: l, value: 0 }))} color={C.headcount} loading={busyFirst} />
//           )}
//         </section>

//         <section className={`${card} min-w-0 p-3.5 2xl:col-span-3`}>
//           <CardHead title="Length of service" subtitle="Employees by years with the company" />
//           {service.error ? <div className="mt-3"><ErrorLine text={service.error} /></div> : (
//             <BarChart items={service.data ?? SERVICE_ORDER.slice(0, 6).map((l) => ({ label: SHORT[l] ?? l, full: l, value: 0 }))} color={C.joiners} loading={busyFirst} />
//           )}
//         </section>
//       </div>

//       {/* Row 3: departments + matrix + on leave */}
//       <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-12">
//         <div className="min-w-0 2xl:col-span-3 [&>section]:h-full">
//           <DepartmentsCard slice={depts} loading={loading} />
//         </div>
//         <div className="min-w-0 2xl:col-span-6 [&>section]:h-full">
//           <MatrixCard slice={divGrade} loading={loading} />
//         </div>
//         <div className="min-w-0 lg:col-span-2 2xl:col-span-3 [&>section]:h-full">
//           <OnLeaveCard slice={onLeave} loading={loading} />
//         </div>
//       </div>
//     </div>
//   );
// }

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle, Building2, CalendarDays, Layers, Palmtree, RefreshCw, UserCheck, UserMinus, UserPlus, Users, VenusAndMars,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { procBuildDynamicSqlCommonBase } from "../../../api/wms";
import { getDynamicLookup, type DynamicQueryParams } from "../../../api/lookups";

// ---------------------------------------------------------------------------
// Period (month + year filter)
// month = 0 means "All months" (whole year), 1..12 = a single month
// The proc reads year from P_NUMBER1 and month from P_NUMBER2.
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];
const num = (obj: any, key: string) => Number(getValue(obj, key) ?? 0) || 0;
const str = (obj: any, key: string) => String(getValue(obj, key) ?? "").trim();

const fmtInt = (n: number) => n.toLocaleString("en-US");
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const fmtCompact = (n: number) => compactFmt.format(n);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const C = {
  joiners: "#10B981",
  separations: "#F59E0B",
  headcount: "#2563EB",
  leave: "#6366F1",
};

const PALETTE = ["#2563EB", "#F59E0B", "#10B981", "#6366F1", "#EC4899", "#94A3B8"];

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
type Summary = { total: number; onLeave: number; joiners: number; separations: number };

const toSummary = (rows: any[]): Summary => ({
  total: num(rows[0], "total_employees"),
  onLeave: num(rows[0], "employees_on_leave"),
  joiners: num(rows[0], "joiners"),
  separations: num(rows[0], "separations"),
});

const toMonthly = (rows: any[], key: string) => {
  const out = Array(12).fill(0) as number[];
  rows.forEach((r) => {
    const idx = Number(getValue(r, "month_no")) - 1;
    if (idx >= 0 && idx < 12) out[idx] = num(r, key);
  });
  return out;
};

// The proc sorts age/service buckets by label (alphabetical), so order them here.
const AGE_ORDER = ["Below 30", "30-39", "40-49", "50-59", "60 and Above", "Unknown"];
const SERVICE_ORDER = ["Less than 1 Year", "1-4 Years", "5-9 Years", "10-14 Years", "15-19 Years", "20 Years and Above", "Unknown"];
const SHORT: Record<string, string> = {
  "Below 30": "<30", "60 and Above": "60+",
  "Less than 1 Year": "<1 yr", "1-4 Years": "1-4 yr", "5-9 Years": "5-9 yr",
  "10-14 Years": "10-14", "15-19 Years": "15-19", "20 Years and Above": "20+ yr",
  Unknown: "N/A",
};

const toBuckets = (rows: any[], labelKey: string, order: string[]) =>
  order
    .map((label) => {
      const row = rows.find((r) => str(r, labelKey) === label);
      return { label: SHORT[label] ?? label, full: label, value: row ? num(row, "employee_count") : 0 };
    })
    .filter((b) => b.full !== "Unknown" || b.value > 0);

const genderLabel = (g: string) => {
  const v = g.toUpperCase();
  if (v === "M" || v === "MALE") return "Male";
  if (v === "F" || v === "FEMALE") return "Female";
  return g || "Unspecified";
};

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

const card = "rounded-2xl border bg-card shadow-sm";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function CardHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
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
  segments: Array<{ value: number; color: string }>; size?: number; thickness?: number; children?: ReactNode;
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
              <linearGradient key={s.key} id={`hr-trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

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
                <path d={`${line} L${x(11)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#hr-trend-${s.key})`} />
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
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted-foreground">No joiners or separations in {year}.</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-series bar chart (age / service length)
// ---------------------------------------------------------------------------

function BarChart({
  items, color, loading,
}: {
  items: Array<{ label: string; full: string; value: number }>; color: string; loading: boolean;
}) {
  const W = 340, H = 220, L = 30, R = 6, T = 20, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const scale = niceScale(Math.max(1, ...items.map((i) => i.value)));
  const y = (v: number) => T + ph - (v / scale.max) * ph;
  const gw = pw / Math.max(items.length, 1);
  const bw = Math.min(30, gw - 8);

  if (loading) return <Skeleton className="mt-3 h-[220px]" />;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 block h-auto w-full text-border">
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
          <text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
        </g>
      ))}
      {items.map((it, i) => {
        const cx = L + i * gw + gw / 2;
        const h = Math.max(y(0) - y(it.value), it.value > 0 ? 3 : 0);
        return (
          <g key={it.full}>
            <rect x={cx - bw / 2} y={y(0) - h} width={bw} height={h} rx="5" fill={color}>
              <title>{`${it.full}: ${fmtInt(it.value)}`}</title>
            </rect>
            <text x={cx} y={y(0) - h - 5} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-foreground tabular-nums">{fmtInt(it.value)}</text>
            <text x={cx} y={H - 7} textAnchor="middle" fontSize="10" className="fill-muted-foreground">{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Donut + legend card (division / grade / gender / status)
// ---------------------------------------------------------------------------

function DonutListCard({
  title, subtitle, icon: Icon, accent, slice, labelOf, loading,
}: {
  title: string; subtitle: string; icon: typeof Layers; accent: string;
  slice: Slice<any[]>; labelOf: (row: any) => string; loading: boolean;
}) {
  const all = (slice.data ?? []).map((r) => ({ label: labelOf(r), value: num(r, "employee_count") })).filter((r) => r.value > 0);
  const top = all.slice(0, 5);
  const rest = all.slice(5).reduce((s, r) => s + r.value, 0);
  const rows = rest > 0 ? [...top, { label: "Others", value: rest }] : top;
  const total = all.reduce((s, r) => s + r.value, 0);

  return (
    <section className={`${card} flex min-w-0 flex-col gap-3 overflow-hidden p-3.5`}>
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: accent }}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h3>
          <p className="m-0 text-[11.5px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="ml-auto text-right">
          {loading && !slice.data ? <Skeleton className="h-7 w-12" /> : (
            <p className="m-0 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtInt(total)}</p>
          )}
          <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">employees</p>
        </div>
      </div>

      {slice.error ? (
        <ErrorLine text={slice.error} />
      ) : loading && !slice.data ? (
        <Skeleton className="h-[92px]" />
      ) : rows.length === 0 ? (
        <p className="m-0 py-6 text-center text-[12.5px] text-muted-foreground">No employees found.</p>
      ) : (
        <div className="flex flex-1 items-center gap-3">
          <Donut segments={rows.map((r, i) => ({ value: r.value, color: PALETTE[i % PALETTE.length] }))} size={92} thickness={12}>
            <div>
              <p className="m-0 text-[17px] font-extrabold leading-none tabular-nums text-foreground">{pct(rows[0].value, total)}%</p>
              <p className="m-0 mt-0.5 max-w-[56px] truncate text-[10px] text-muted-foreground">{rows[0].label}</p>
            </div>
          </Donut>
          <ul className="m-0 grid min-w-0 flex-1 list-none gap-1.5 p-0">
            {rows.map((r, i) => (
              <li key={`${r.label}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate" title={r.label}>{r.label}</span>
                </span>
                <b className="font-bold tabular-nums text-foreground">{fmtInt(r.value)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Top departments
// ---------------------------------------------------------------------------

function DepartmentsCard({ slice, loading }: { slice: Slice<any[]>; loading: boolean }) {
  const all = slice.data ?? [];
  const rows = all.slice(0, 5);
  const top = Math.max(1, ...rows.map((r) => num(r, "employee_count")));
  const sum = all.reduce((s, r) => s + num(r, "employee_count"), 0);

  return (
    <section className={`${card} min-w-0 overflow-hidden p-3.5`}>
      <CardHead title="Top 5 departments" subtitle={`By headcount, ${all.length} departments in total`} />
      <div className="mt-3">
        {slice.error ? (
          <ErrorLine text={slice.error} />
        ) : loading && !slice.data ? (
          <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : rows.length === 0 ? (
          <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">No departments found.</p>
        ) : (
          <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
            {rows.map((r, i) => {
              const count = num(r, "employee_count");
              const code = str(r, "dept_code") || "Unassigned";
              return (
                <li key={`${code}-${i}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10.5px] font-bold text-white" style={{ background: C.headcount, opacity: 1 - i * 0.14 }}>{i + 1}</span>
                      <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground" title={code}>{code}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <b className="text-[12.5px] font-bold tabular-nums text-foreground">{fmtInt(count)}</b>
                      <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">{pct(count, sum)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(count / top) * 100}%`, background: C.headcount, opacity: 1 - i * 0.12 }} />
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
// Division x Grade matrix
// ---------------------------------------------------------------------------

function MatrixCard({ slice, loading }: { slice: Slice<any[]>; loading: boolean }) {
  const { divs, grades, max } = useMemo(() => {
    const dMap = new Map<string, { label: string; total: number; cells: Record<string, number> }>();
    const gMap = new Map<string, { label: string; total: number }>();
    (slice.data ?? []).forEach((r) => {
      const dc = str(r, "div_code") || "-";
      const gc = str(r, "grade_code") || "-";
      const n = num(r, "employee_count");
      const d = dMap.get(dc) ?? { label: str(r, "div_name") || dc, total: 0, cells: {} };
      d.total += n;
      d.cells[gc] = (d.cells[gc] ?? 0) + n;
      dMap.set(dc, d);
      const g = gMap.get(gc) ?? { label: str(r, "grade_name") || gc, total: 0 };
      g.total += n;
      gMap.set(gc, g);
    });
    const divs = [...dMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
    const grades = [...gMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);
    const max = Math.max(1, ...divs.flatMap(([, d]) => grades.map(([gc]) => d.cells[gc] ?? 0)));
    return { divs, grades, max };
  }, [slice.data]);

  return (
    <section className={`${card} min-w-0 overflow-hidden p-3.5`}>
      <CardHead title="Division by grade" subtitle="Headcount matrix, top divisions and grades" />
      <div className="mt-3">
        {slice.error ? (
          <ErrorLine text={slice.error} />
        ) : loading && !slice.data ? (
          <Skeleton className="h-[200px]" />
        ) : divs.length === 0 ? (
          <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">No data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-[11.5px]">
              <thead>
                <tr>
                  <th className="px-1 text-left font-semibold text-muted-foreground">Division</th>
                  {grades.map(([gc, g]) => (
                    <th key={gc} className="max-w-[70px] truncate px-1 text-center font-semibold text-muted-foreground" title={g.label}>{gc}</th>
                  ))}
                  <th className="px-1 text-right font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {divs.map(([dc, d]) => (
                  <tr key={dc}>
                    <td className="max-w-[130px] truncate px-1 font-medium text-foreground" title={d.label}>{d.label}</td>
                    {grades.map(([gc]) => {
                      const v = d.cells[gc] ?? 0;
                      return (
                        <td
                          key={gc}
                          className="rounded-md px-1 py-1 text-center font-semibold tabular-nums text-foreground"
                          style={{ background: v > 0 ? `rgba(37,99,235,${0.1 + 0.5 * (v / max)})` : undefined }}
                        >
                          {v > 0 ? fmtInt(v) : <span className="text-muted-foreground">-</span>}
                        </td>
                      );
                    })}
                    <td className="px-1 text-right font-bold tabular-nums text-foreground">{fmtInt(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Employees on leave
// ---------------------------------------------------------------------------

function OnLeaveCard({ slice, loading }: { slice: Slice<any[]>; loading: boolean }) {
  const rows = slice.data ?? [];
  return (
    <section className={`${card} flex min-w-0 flex-col overflow-hidden p-3.5`}>
      <CardHead
        title="Employees on leave"
        subtitle="Currently away"
        right={<span className="rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-foreground">{fmtInt(rows.length)}</span>}
      />
      <div className="mt-3 max-h-[260px] flex-1 overflow-y-auto pr-1">
        {slice.error ? (
          <ErrorLine text={slice.error} />
        ) : loading && !slice.data ? (
          <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : rows.length === 0 ? (
          <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">Nobody is on leave.</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {rows.map((r, i) => {
              const code = str(r, "employee_code") || str(r, "employee_id");
              const meta = [str(r, "div_code"), str(r, "dept_code"), str(r, "grade_code")].filter(Boolean).join(" / ");
              return (
                <li key={`${code}-${i}`} className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-3 py-1.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ background: C.leave }}>
                    <Palmtree size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">{code}</span>
                    {meta && <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">{meta}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const empty = <T,>(): Slice<T> => ({ data: null, error: null });

export default function HrDashboard() {
  const { user } = useAuth();

  // Filter: defaults to the current month and year
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(currentYear);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => currentYear - i), [currentYear]);

  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [summary, setSummary] = useState<Slice<Summary>>(empty());
  const [divs, setDivs] = useState<Slice<any[]>>(empty());
  const [grades, setGrades] = useState<Slice<any[]>>(empty());
  const [divGrade, setDivGrade] = useState<Slice<any[]>>(empty());
  const [depts, setDepts] = useState<Slice<any[]>>(empty());
  const [gender, setGender] = useState<Slice<any[]>>(empty());
  const [status, setStatus] = useState<Slice<any[]>>(empty());
  const [age, setAge] = useState<Slice<ReturnType<typeof toBuckets>>>(empty());
  const [service, setService] = useState<Slice<ReturnType<typeof toBuckets>>>(empty());
  const [joiners, setJoiners] = useState<Slice<number[]>>(empty());
  const [seps, setSeps] = useState<Slice<number[]>>(empty());
  const [onLeave, setOnLeave] = useState<Slice<any[]>>(empty());

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

  const load = useCallback(async () => {
    if (!user?.company_code) return;
    const id = ++requestId.current;
    const isCurrent = () => id === requestId.current;

    // month: 0 = whole year. Headcount snapshots ignore it, joiners/separations honour it.
const call = async (parameter: string, m: number): Promise<any[]> => {
  const params = {
    parameter,
    loginid: user.loginid ?? "",
    code1: user.company_code,
    number1: year,
    number2: m,
  } as DynamicQueryParams; // cast if your DynamicQueryParams type doesn't declare number1/number2

  const rows = await getDynamicLookup(params);
  return Array.isArray(rows) ? (rows as any[]) : [];
};

    setLoading(true);
    const wrap = async <T,>(parameter: string, m: number, map: (rows: any[]) => T, set: (s: Slice<T>) => void) => {
      try {
        const result = map(await call(parameter, m));
        if (isCurrent()) set({ data: result, error: null });
      } catch (e) {
        if (isCurrent()) set({ data: null, error: e instanceof Error ? e.message : "Failed to load data." });
      }
    };
    const raw = (r: any[]) => r;

    await Promise.all([
      wrap("HCM_DBOARD_FROM_DUAL", month, toSummary, setSummary),
      wrap("HCM_DBOARD_DIVISIONWISE_EMPLOYEES", month, raw, setDivs),
      wrap("HCM_DBOARD_GRADEWISE_EMPLOYEES", month, raw, setGrades),
      wrap("HCM_DBOARD_DIVISION_GRADEWISE_EMPLOYEES", month, raw, setDivGrade),
      wrap("HCM_DBOARD_DEPARTMENTWISE_EMPLOYEES", month, raw, setDepts),
      wrap("HCM_DBOARD_GENDERWISE_EMPLOYEES", month, raw, setGender),
      wrap("HCM_DBOARD_EMP_STATUS", month, raw, setStatus),
      wrap("HCM_DBOARD_AGEWISE_EMPLOYEES", month, (r) => toBuckets(r, "age_group", AGE_ORDER), setAge),
      wrap("HCM_DBOARD_SERVICE_LENGTHWISE_EMPLOYEES", month, (r) => toBuckets(r, "service_group", SERVICE_ORDER), setService),
      // Trend charts always cover the whole selected year (month = 0) so the shape stays visible.
      wrap("HCM_DBOARD_MONTHWISE_JOINERS", 0, (r) => toMonthly(r, "joiners"), setJoiners),
      wrap("HCM_DBOARD_MONTHWISE_SEPARATIONS", 0, (r) => toMonthly(r, "separations"), setSeps),
      wrap("HCM_DBOARD_ON_LEAVE", month, raw, setOnLeave),
    ]);
    if (!isCurrent()) return;
    setUpdatedAt(new Date());
    setLoading(false);
  }, [user?.company_code, user?.loginid, year, month]);

  // Runs on first load and whenever the month or year filter changes
  useEffect(() => { load(); }, [load]);

  const zeros = useMemo(() => Array(12).fill(0) as number[], []);

  const periodLabel = month === 0 ? `${year}` : `${MONTHS_FULL[month - 1]} ${year}`;
  const isCurrentYearAll = month === 0 && year === currentYear;
  const rangeText =
    month === 0
      ? isCurrentYearAll ? `Year to date, 1 Jan ${year} to today` : `Full year ${year}`
      : periodLabel;

  const s = summary.data;
  const net = (s?.joiners ?? 0) - (s?.separations ?? 0);

  const trendSeries = useMemo<TrendSeries[]>(() => [
    { key: "joiners", label: "Joiners", color: C.joiners, values: joiners.data ?? zeros },
    { key: "separations", label: "Separations", color: C.separations, values: seps.data ?? zeros },
  ], [joiners.data, seps.data, zeros]);

  const slices = [summary, divs, grades, divGrade, depts, gender, status, age, service, joiners, seps, onLeave];
  const errors = slices.filter((x) => x.error);
  const busyFirst = loading && !updatedAt;

  return (
    <div className="grid gap-3" style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}>
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl px-4 py-3 text-white shadow-md"
        style={{ background: "linear-gradient(118deg, #00246B 0%, #00378C 48%, #1467D6 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid items-center gap-3 2xl:grid-cols-[340px_1fr]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight">HR overview</h1>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-white/70">
                {rangeText}
                {updatedAt ? `. Updated ${updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </p>
              <PeriodFilter month={month} year={year} years={years} onMonth={setMonth} onYear={setYear} disabled={false} />
            </div>
            <button
              type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh dashboard"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat
              label="Total employees" value={fmtInt(s?.total ?? 0)}
              sub={`${fmtInt(divs.data?.length ?? 0)} divisions, ${fmtInt(depts.data?.length ?? 0)} departments`} loading={busyFirst}
            />
            <HeroStat
              label="On leave" value={fmtInt(s?.onLeave ?? 0)}
              sub={`${pct(s?.onLeave ?? 0, s?.total ?? 0)}% of headcount`} loading={busyFirst}
            />
            <HeroStat label="Joiners" value={fmtInt(s?.joiners ?? 0)} sub={periodLabel} loading={busyFirst} />
            <HeroStat
              label="Separations" value={fmtInt(s?.separations ?? 0)}
              sub={`Net ${net > 0 ? "+" : ""}${fmtInt(net)} in ${periodLabel}`} loading={busyFirst}
            />
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <ErrorLine text={`${errors.length} of ${slices.length} queries failed. First error: ${errors[0].error}`} />
      )}

      {/* Row 1: headcount breakdowns */}
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <DonutListCard
          title="By division" subtitle="Current headcount" icon={Building2} accent={C.headcount}
          slice={divs} loading={loading} labelOf={(r) => str(r, "div_name") || str(r, "div_code") || "Unassigned"}
        />
        <DonutListCard
          title="By grade" subtitle="Current headcount" icon={Layers} accent={C.joiners}
          slice={grades} loading={loading} labelOf={(r) => str(r, "grade_name") || str(r, "grade_code") || "Unassigned"}
        />
        <DonutListCard
          title="By gender" subtitle="Current headcount" icon={VenusAndMars} accent={C.separations}
          slice={gender} loading={loading} labelOf={(r) => genderLabel(str(r, "gender"))}
        />
        <DonutListCard
          title="By status" subtitle="Employee status" icon={UserCheck} accent={C.leave}
          slice={status} loading={loading} labelOf={(r) => str(r, "emp_status") || "Unknown"}
        />
      </div>

      {/* Row 2: trend + age + service length */}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-12">
        <section className={`${card} min-w-0 p-3.5 lg:col-span-2 2xl:col-span-6`}>
          <CardHead
            title="Joiners and separations by month"
            subtitle={month === 0 ? `Year ${year}. Click a legend chip to hide a line` : `Year ${year}, ${MONTHS_FULL[month - 1]} highlighted. Click a legend chip to hide a line`}
            right={
              <span className="inline-flex items-center gap-2 text-[11.5px] text-muted-foreground">
                <UserPlus size={13} style={{ color: C.joiners }} /> <UserMinus size={13} style={{ color: C.separations }} />
              </span>
            }
          />
          {(joiners.error || seps.error) && <div className="mt-2"><ErrorLine text={joiners.error || seps.error || ""} /></div>}
          <TrendChart series={trendSeries} loading={busyFirst} highlight={month === 0 ? null : month - 1} year={year} />
        </section>

        <section className={`${card} min-w-0 p-3.5 2xl:col-span-3`}>
          <CardHead title="Age profile" subtitle="Employees by age group" />
          {age.error ? <div className="mt-3"><ErrorLine text={age.error} /></div> : (
            <BarChart items={age.data ?? AGE_ORDER.slice(0, 5).map((l) => ({ label: SHORT[l] ?? l, full: l, value: 0 }))} color={C.headcount} loading={busyFirst} />
          )}
        </section>

        <section className={`${card} min-w-0 p-3.5 2xl:col-span-3`}>
          <CardHead title="Length of service" subtitle="Employees by years with the company" />
          {service.error ? <div className="mt-3"><ErrorLine text={service.error} /></div> : (
            <BarChart items={service.data ?? SERVICE_ORDER.slice(0, 6).map((l) => ({ label: SHORT[l] ?? l, full: l, value: 0 }))} color={C.joiners} loading={busyFirst} />
          )}
        </section>
      </div>

      {/* Row 3: departments + matrix + on leave */}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-12">
        <div className="min-w-0 2xl:col-span-3 [&>section]:h-full">
          <DepartmentsCard slice={depts} loading={loading} />
        </div>
        <div className="min-w-0 2xl:col-span-6 [&>section]:h-full">
          <MatrixCard slice={divGrade} loading={loading} />
        </div>
        <div className="min-w-0 lg:col-span-2 2xl:col-span-3 [&>section]:h-full">
          <OnLeaveCard slice={onLeave} loading={loading} />
        </div>
      </div>
    </div>
  );
}