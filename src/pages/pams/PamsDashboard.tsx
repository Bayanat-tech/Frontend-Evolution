import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Hourglass,
  Layers,
  Loader2,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { executeWmsInboundSql } from '../../api/wms';
import { useAuth } from '../../state/AuthContext';

interface EmployeeDivision { DIV_CODE: string; DIV_NAME: string; }
interface EmployeeDepartment { DEPT_CODE: string; DEPT_NAME: string; }
interface PeriodData { VALUE: string; LABEL: string; }
interface RatingRow { TOTAL_RATING: number; COUNT: number; }

type Tone = 'blue' | 'emerald' | 'rose' | 'amber' | 'indigo';

// Full access: COO, CEO, HR -> saare division / department ke saare appraisals
const FULL_ACCESS_CODES = ['2018030473', '2010080001', '2021060535'];
const MODE_LABEL = 'Final Approved';
const TOP_MIN = 4;   // Top performer: rating >= 4
const LOW_MAX = 2;   // Low performer: rating <= 2

const RATING_CONFIG: Record<number, { label: string; color: string }> = {
  5: { label: 'Outstanding', color: '#1d4ed8' },
  4: { label: 'Exceeds', color: '#059669' },
  3: { label: 'Meets', color: '#d97706' },
  2: { label: 'Needs Improvement', color: '#ea580c' },
  1: { label: 'Poor', color: '#dc2626' },
};

const ZONE_COLORS = [
  { min: 0.5, max: 1.5, color: 'rgba(220,38,38,0.15)' },
  { min: 1.5, max: 2.5, color: 'rgba(234,88,12,0.15)' },
  { min: 2.5, max: 3.5, color: 'rgba(217,119,6,0.15)' },
  { min: 3.5, max: 4.5, color: 'rgba(5,150,105,0.15)' },
  { min: 4.5, max: 5.5, color: 'rgba(29,78,216,0.15)' },
];

const esc = (v: unknown) => String(v ?? '').replace(/'/g, "''");

function getRatingPoints(rows: RatingRow[]) {
  return rows.map((r) => ({ x: Number(r.TOTAL_RATING), y: Number(r.COUNT) })).sort((a, b) => a.x - b.x);
}

function interpolateForFill(points: { x: number; y: number }[]) {
  if (points.length === 0) return [];
  const pts: { x: number; y: number }[] = [];
  const minX = Math.max(0.5, points[0].x - 0.25);
  const maxX = Math.min(5.5, points[points.length - 1].x + 0.25);
  for (let x = minX; x <= maxX; x += 0.02) {
    let y = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (x >= points[i].x && x <= points[i + 1].x) {
        const t = (x - points[i].x) / (points[i + 1].x - points[i].x || 1);
        y = points[i].y + (points[i + 1].y - points[i].y) * t;
        break;
      }
    }
    if (x <= points[0].x) y = points[0].y;
    if (x >= points[points.length - 1].x) y = points[points.length - 1].y;
    pts.push({ x: parseFloat(x.toFixed(2)), y });
  }
  return pts;
}

const PAMS_CSS = `
.pams-dashboard { --pd-blue:#00378C; --pd-border:#dbe3ee; --pd-muted:#64748b; padding:0 14px 20px; min-height:100vh; display:flex; flex-direction:column; gap:10px; font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif; font-size:11px; color:#0f172a; background:#fff; box-sizing:border-box; }
.pams-dashboard * { box-sizing:border-box; }

/* Header */
.pams-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; padding-top:2px; }
.pams-header h1 { display:flex; align-items:center; gap:8px; margin:0; font-size:19px; font-weight:800; letter-spacing:-0.01em; color:var(--pd-blue); }
.pams-header p { margin:6px 0 0; font-size:10.5px; color:#334155; font-weight:500; }

.pams-filters { display:flex; align-items:flex-end; flex-wrap:wrap; gap:10px; }
.pams-filters label { display:flex; flex-direction:column; gap:3px; }
.pams-filters label > span { font-size:8.5px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#334155; }
.pams-filters select { height:30px; min-width:120px; max-width:210px; padding:0 8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; font-size:11px; font-weight:600; color:#0f172a; outline:none; }
.pams-filters select:focus { border-color:var(--pd-blue); box-shadow:0 0 0 2px rgba(0,55,140,0.15); }
.pams-refresh { width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:var(--pd-blue); cursor:pointer; transition:background .15s; }
.pams-refresh:hover { background:#eef3ff; }

/* Hero KPIs */
.pams-hero { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; }
.pams-hero-card { background:#fff; border:1px solid var(--pd-border); border-top:2px solid var(--tone); border-radius:5px; padding:9px 10px 7px; display:flex; flex-direction:column; gap:6px; }
.pams-hero-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.pams-hero-top span { font-size:9px; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:#334155; }
.pams-hero-icon { width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px; background:var(--tone-bg); color:var(--tone); flex-shrink:0; }
.pams-hero-icon svg { width:14px; height:14px; }
.pams-hero-value { display:flex; align-items:center; gap:8px; font-size:17px; font-weight:800; line-height:1.15; color:#0f172a; min-height:20px; padding-bottom:5px; border-bottom:1px solid #eef2f7; }
.pams-hero-foot { font-size:9.5px; color:var(--pd-muted); font-weight:500; }
.tone-blue { --tone:#00378C; --tone-bg:#e8efff; }
.tone-emerald { --tone:#059669; --tone-bg:#e6f7f0; }
.tone-rose { --tone:#e11d48; --tone-bg:#ffe9ee; }
.tone-amber { --tone:#d97706; --tone-bg:#fff3de; }
.tone-indigo { --tone:#4f46e5; --tone-bg:#ecebff; }

/* Stars */
.pams-stars { position:relative; display:inline-block; height:var(--ss); width:calc(var(--ss) * 5); flex-shrink:0; vertical-align:middle; }
.pams-stars-bg, .pams-stars-fg { display:flex; height:100%; white-space:nowrap; }
.pams-stars-bg { color:#e2e8f0; }
.pams-stars-fg { position:absolute; left:0; top:0; overflow:hidden; color:#f59e0b; }
.pams-stars svg { width:var(--ss); height:var(--ss); flex-shrink:0; }

/* Cards & grids */
.pams-chart-grid, .pams-panel-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
@media (max-width:1000px) { .pams-chart-grid, .pams-panel-grid { grid-template-columns:1fr; } }
.pams-card { background:#fff; border:1px solid var(--pd-border); border-radius:5px; padding:0; min-width:0; overflow:hidden; }
.pams-card > :not(.pams-card-head) { margin:10px 12px; }
.pams-card-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 12px; border-bottom:1px solid var(--pd-border); flex-wrap:wrap; }
.pams-card-head h3 { display:flex; align-items:center; gap:7px; margin:0; font-size:11.5px; font-weight:800; color:var(--pd-blue); }
.pams-card-head h3 svg { color:var(--pd-blue); width:14px; height:14px; }
.pams-card-head > span { font-size:9.5px; font-weight:600; color:var(--pd-muted); }
.pams-legend { display:flex; gap:12px; font-size:9.5px; font-weight:700; color:#334155; }
.pams-legend i { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:5px; }
.pams-chart-box { position:relative; height:230px; }
.pams-donut-wrap { display:flex; gap:18px; align-items:center; min-height:200px; flex-wrap:wrap; }
.pams-donut { position:relative; width:160px; height:160px; flex-shrink:0; }
.pams-donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; }
.pams-donut-center b { font-size:21px; font-weight:800; color:#0f172a; line-height:1; }
.pams-donut-center small { margin-top:3px; font-size:8.5px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8; }
.pams-donut-list { flex:1; min-width:170px; display:flex; flex-direction:column; gap:6px; }
.pams-donut-row { display:flex; align-items:center; justify-content:space-between; padding:6px 9px; border:1px solid #e8edf4; background:#fff; border-radius:5px; }
.pams-donut-row > div:first-child { display:flex; align-items:center; gap:8px; font-size:11px; font-weight:600; color:#334155; }
.pams-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.pams-donut-row b { font-size:11.5px; font-weight:800; }
.pams-donut-row small { font-size:10px; color:#94a3b8; margin-left:4px; font-weight:600; }
.pams-score-legend { display:flex; justify-content:center; gap:20px; flex-wrap:wrap; padding-top:8px; border-top:1px solid #eef2f7; }
.pams-score-legend > div { display:flex; flex-direction:column; align-items:center; gap:2px; }
.pams-score-legend b { font-size:14px; font-weight:800; }
.pams-score-legend span { font-size:9.5px; font-weight:600; color:var(--pd-muted); }
.pams-score-legend em { font-style:normal; font-size:9.5px; font-weight:700; background:#f1f5f9; padding:1px 6px; border-radius:4px; }

/* Performer list */
.pams-perf-list { display:flex; flex-direction:column; gap:6px; }
.pams-perf { display:flex; align-items:center; gap:10px; border:1px solid #e8edf4; border-radius:6px; padding:7px 10px; background:#fff; min-width:0; }
.pams-perf:hover { border-color:var(--tone); background:#fafcff; }
.pams-perf-rank { width:22px; height:22px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:6px; background:var(--tone-bg); color:var(--tone); font-size:10.5px; font-weight:800; }
.pams-perf-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.pams-perf-info strong { font-size:11.5px; font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pams-perf-info small { font-size:9.5px; color:#94a3b8; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pams-perf-score { display:flex; align-items:center; gap:7px; flex-shrink:0; }
.pams-perf-score b { min-width:26px; text-align:center; padding:2px 6px; border-radius:4px; background:var(--tone-bg); color:var(--tone); font-size:11px; font-weight:800; }

/* Table */
.pams-card > .pams-table-wrap { margin:0; }
.pams-table-wrap { overflow-x:auto; }
.pams-table { width:100%; border-collapse:collapse; font-size:11px; }
.pams-table th { text-align:left; padding:8px 14px; background:#f8fafc; border-bottom:1px solid var(--pd-border); font-size:9px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--pd-muted); white-space:nowrap; }
.pams-table th.c, .pams-table td.c { text-align:center; }
.pams-table td { padding:9px 14px; border-bottom:1px solid #eef2f7; color:#334155; }
.pams-table tbody tr:last-child td { border-bottom:none; }
.pams-table tbody tr:hover { background:#f8fbff; }
.pams-pill { display:inline-block; padding:2px 9px; border-radius:4px; font-size:10px; font-weight:800; border:1px solid transparent; }
.pams-pill.good { background:#ecfdf5; color:#047857; border-color:#a7f3d0; }
.pams-pill.ok { background:#fffbeb; color:#b45309; border-color:#fde68a; }
.pams-pill.bad { background:#fff1f2; color:#be123c; border-color:#fecdd3; }
.pams-score { display:inline-block; min-width:30px; padding:2px 8px; border-radius:4px; background:#e8efff; color:var(--pd-blue); font-weight:800; }
.pams-export { display:inline-flex; align-items:center; gap:5px; height:24px; padding:0 10px; border:1px solid #c7d6f2; border-radius:5px; background:#fff; color:var(--pd-blue); font-size:10.5px; font-weight:700; cursor:pointer; }
.pams-export:hover { background:#eef3ff; }
.pams-export:disabled { opacity:.5; cursor:not-allowed; }

/* States */
.pams-empty { display:flex; align-items:center; justify-content:center; gap:8px; padding:22px 10px; color:#94a3b8; font-size:11px; font-weight:600; }
.pams-skeleton { display:inline-block; width:80px; height:16px; border-radius:4px; background:linear-gradient(90deg,#eef2f7 25%,#e2e8f0 50%,#eef2f7 75%); background-size:200% 100%; animation:pams-shimmer 1.2s infinite; }
@keyframes pams-shimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
.pams-spin { animation:pams-rot .8s linear infinite; }
@keyframes pams-rot { to { transform:rotate(360deg); } }
`;

/** Star rating (decimal supported, e.g. 3.5 = 3 and a half stars) */
const Stars = ({ value, size = 13 }: { value: number; size?: number }) => {
  const pct = (Math.max(0, Math.min(5, Number(value) || 0)) / 5) * 100;
  const row = [0, 1, 2, 3, 4].map((i) => <Star key={i} fill='currentColor' strokeWidth={0} />);
  return (
    <span className='pams-stars' style={{ ['--ss' as any]: `${size}px` }} title={`${Number(value || 0).toFixed(1)} / 5`}>
      <span className='pams-stars-bg'>{row}</span>
      <span className='pams-stars-fg' style={{ width: `${pct}%` }}>{row}</span>
    </span>
  );
};

const FilterSelect = ({ label, value, onChange, options, disabled }: any) => (
  <label>
    <span>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {options.map((opt: any) => (
        <option key={opt.code} value={opt.code}>{opt.name}</option>
      ))}
    </select>
  </label>
);

const HeroCard = ({
  title, value, caption, icon: Icon, tone, loading,
}: { title: string; value: ReactNode; caption: string; icon: LucideIcon; tone: Tone; loading: boolean }) => (
  <article className={`pams-hero-card tone-${tone}`}>
    <div className='pams-hero-top'>
      <span>{title}</span>
      <div className='pams-hero-icon'><Icon size={16} /></div>
    </div>
    <div className='pams-hero-value'>{loading ? <span className='pams-skeleton' /> : value}</div>
    <div className='pams-hero-foot'>{caption}</div>
  </article>
);

const PerformerPanel = ({
  title, subtitle, items, tone, loading, icon: Icon, emptyText,
}: { title: string; subtitle: string; items: any[]; tone: 'emerald' | 'rose'; loading: boolean; icon: LucideIcon; emptyText: string }) => (
  <article className={`pams-card tone-${tone}`}>
    <div className='pams-card-head'>
      <h3><Icon size={15} />{title}</h3>
      <span>{subtitle}</span>
    </div>
    <div className='pams-perf-list'>
      {loading ? (
        <div className='pams-empty'><Loader2 size={18} className='pams-spin' /></div>
      ) : items.length > 0 ? (
        items.map((item, i) => (
          <div className='pams-perf' key={`${item.code}-${i}`}>
            <span className='pams-perf-rank'>{i + 1}</span>
            <div className='pams-perf-info'>
              <strong title={item.name}>{item.name}</strong>
              <small>{item.subtext}</small>
            </div>
            <div className='pams-perf-score'>
              <Stars value={item.rating} size={13} />
              <b>{Number(item.rating).toFixed(1)}</b>
            </div>
          </div>
        ))
      ) : (
        <div className='pams-empty'><CheckCircle2 size={18} /><span>{emptyText}</span></div>
      )}
    </div>
  </article>
);

const PamsDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ddepartment, setDdepartment] = useState<string>('All');
  const [ddivision, setDdivision] = useState<string>('All');
  const [dperiod, setDperiod] = useState<string>('');

  const login = esc(String(user?.LOGINID ?? '').trim());
  const company = esc(user?.company_code ?? '');
  const hasFullAccess = FULL_ACCESS_CODES.includes(login);

  // Access: COO / CEO / HR = sab division + department,
  // baaki = jis doc mein CREATED_BY / HOD / DEPT_HEAD wo khud hai
  const accessClause = hasFullAccess
    ? '1=1'
    : `(TRIM(h.CREATED_BY) = '${login}' OR TRIM(h.HOD) = '${login}' OR TRIM(h.DEPT_HEAD) = '${login}')`;

  // Base dataset: EMS_APPRAISAL_HDR (rating = FINAL_RATING)
  const buildBase = (div: string, dept: string) => `(
    SELECT h.APPRAISAL_DOC_NO,
           h.EMPLOYEE_CODE,
           h.PERIOD_NUMBER,
           UPPER(TRIM(NVL(h.FINAL_APPROVED,'NO'))) AS FA,
           CASE WHEN NVL(UPPER(TRIM(h.LAST_ACTION)),'SAVE AS DRAFT') = 'SAVE AS DRAFT' THEN 1 ELSE 0 END AS IS_DRAFT,
           h.FINAL_RATING AS TOTAL_RATING,
           NVL(e.RPT_NAME, h.EMPLOYEE_CODE) AS EMPLOYEE_NAME,
           e.DIV_CODE,
           e.DIV_NAME,
           e.DEPT_CODE,
           NVL(h.DEPT_NAME, e.DEPT_NAME) AS DEPT_NAME
      FROM EMS_APPRAISAL_HDR h
      LEFT JOIN (
            SELECT TRIM(EMPLOYEE_CODE) AS EMPLOYEE_CODE, COMPANY_CODE,
                   MIN(RPT_NAME) AS RPT_NAME,
                   MIN(DIV_CODE) AS DIV_CODE, MIN(DIV_NAME) AS DIV_NAME,
                   MIN(DEPT_CODE) AS DEPT_CODE, MIN(DEPT_NAME) AS DEPT_NAME
              FROM CUSTOMERS.VW_HR_EMPLOYEE_AWARE
             GROUP BY TRIM(EMPLOYEE_CODE), COMPANY_CODE
      ) e ON e.EMPLOYEE_CODE = TRIM(h.EMPLOYEE_CODE) AND e.COMPANY_CODE = h.COMPANY_CODE
     WHERE h.COMPANY_CODE = '${company}'
       AND h.PERIOD_NUMBER = '${esc(dperiod)}'
       AND ${accessClause}
       AND ('${esc(div)}' = 'All' OR e.DIV_CODE = '${esc(div)}')
       AND ('${esc(dept)}' = 'All' OR e.DEPT_CODE = '${esc(dept)}')
  ) b`;

  const baseAll = buildBase(ddivision, ddepartment);
  const ready = !!dperiod && !!login;
  const key = [login, company, dperiod, ddivision, ddepartment];

  // ── Filters ────────────────────────────────────────────────
  const { data: PeriodResponse } = useQuery<PeriodData[] | null>({
    queryKey: ['pams_period', company],
    enabled: !!company,
    queryFn: async () => {
      const sql = `SELECT PERIOD_NUMBER AS VALUE, TO_CHAR(PERIOD_FROM_DATE,'DD-MON-YYYY') || ' - ' || TO_CHAR(PERIOD_TO_DATE,'DD-MON-YYYY') AS LABEL FROM MS_KPI_PERIOD WHERE company_code = '${company}' AND PERIOD_NUMBER NOT IN (SELECT PERIOD_NUMBER FROM HIDE_PERIOD) ORDER BY PERIOD_NUMBER DESC`;
      return (await executeWmsInboundSql(sql)) as unknown as PeriodData[] | null;
    },
  });
  const Period: PeriodData[] = PeriodResponse ?? [];

  useEffect(() => {
    if (Period.length > 0 && !dperiod) setDperiod(String(Period[0].VALUE));
  }, [PeriodResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: Division } = useQuery<EmployeeDivision[]>({
    queryKey: ['pams_division', login, company, dperiod],
    enabled: ready,
    queryFn: async () => {
      const sql = `SELECT DISTINCT DIV_CODE, DIV_NAME FROM ${buildBase('All', 'All')} WHERE DIV_CODE IS NOT NULL ORDER BY DIV_CODE`;
      return ((await executeWmsInboundSql(sql)) ?? []) as unknown as EmployeeDivision[];
    },
  });

  const { data: Department } = useQuery<EmployeeDepartment[]>({
    queryKey: ['pams_department', login, company, dperiod, ddivision],
    enabled: ready,
    queryFn: async () => {
      const sql = `SELECT DEPT_CODE, MIN(DEPT_NAME) AS DEPT_NAME FROM ${buildBase(ddivision, 'All')} WHERE DEPT_CODE IS NOT NULL GROUP BY DEPT_CODE ORDER BY DEPT_CODE`;
      return ((await executeWmsInboundSql(sql)) ?? []) as unknown as EmployeeDepartment[];
    },
  });

  // ── KPI summary ────────────────────────────────────────────
  const { data: Summary } = useQuery<any[] | null>({
    queryKey: ['pams_summary', ...key],
    enabled: ready,
    queryFn: async () => {
      const sql = `SELECT
          COUNT(*) AS TOTAL,
          SUM(CASE WHEN FA = 'YES' THEN 1 ELSE 0 END) AS FINAL_CNT,
          SUM(CASE WHEN FA <> 'YES' THEN 1 ELSE 0 END) AS PENDING_CNT,
          SUM(CASE WHEN FA <> 'YES' AND IS_DRAFT = 0 THEN 1 ELSE 0 END) AS IN_PROGRESS_CNT,
          SUM(CASE WHEN FA <> 'YES' AND IS_DRAFT = 1 THEN 1 ELSE 0 END) AS DRAFT_CNT,
          SUM(CASE WHEN FA = 'YES' AND TOTAL_RATING IS NOT NULL THEN 1 ELSE 0 END) AS RATED_CNT,
          ROUND(AVG(CASE WHEN FA = 'YES' AND TOTAL_RATING IS NOT NULL THEN TOTAL_RATING END), 2) AS AVG_RATING,
          SUM(CASE WHEN FA = 'YES' AND TOTAL_RATING >= ${TOP_MIN} THEN 1 ELSE 0 END) AS TOP_CNT,
          SUM(CASE WHEN FA = 'YES' AND TOTAL_RATING IS NOT NULL AND TOTAL_RATING <= ${LOW_MAX} THEN 1 ELSE 0 END) AS LOW_CNT
        FROM ${baseAll}`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const { data: RatingDistribution } = useQuery({
    queryKey: ['pams_rating_distribution', ...key],
    enabled: ready,
    queryFn: async () => {
      const sql = `SELECT TOTAL_RATING, COUNT(*) AS COUNT FROM ${baseAll} WHERE FA = 'YES' AND TOTAL_RATING IS NOT NULL GROUP BY TOTAL_RATING ORDER BY TOTAL_RATING`;
      return (await executeWmsInboundSql(sql)) as unknown as RatingRow[] | null;
    },
  });

  const { data: DeptHistogram } = useQuery({
    queryKey: ['pams_dept_histogram', ...key],
    enabled: ready,
    queryFn: async () => {
      const sql = `SELECT DEPT_NAME, ROUND(AVG(TOTAL_RATING), 2) AS AVG_RATING, COUNT(*) AS EMP_COUNT FROM ${baseAll} WHERE FA = 'YES' AND TOTAL_RATING IS NOT NULL GROUP BY DEPT_NAME ORDER BY AVG_RATING DESC`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  // Top performers: rating >= 4 only (kabhi Low list se overlap nahi hoga)
  const { data: TopEmployees } = useQuery({
    queryKey: ['pams_top_employees', ...key],
    enabled: ready,
    queryFn: async () => {
      const sql = `SELECT EMPLOYEE_CODE, EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM (SELECT EMPLOYEE_CODE, EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM ${baseAll} WHERE FA = 'YES' AND TOTAL_RATING >= ${TOP_MIN} ORDER BY TOTAL_RATING DESC, EMPLOYEE_NAME) WHERE ROWNUM <= 5`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  // Low performers: rating <= 2 only
  const { data: LowEmployees } = useQuery({
    queryKey: ['pams_low_employees', ...key],
    enabled: ready,
    queryFn: async () => {
      const sql = `SELECT EMPLOYEE_CODE, EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM (SELECT EMPLOYEE_CODE, EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM ${baseAll} WHERE FA = 'YES' AND TOTAL_RATING IS NOT NULL AND TOTAL_RATING <= ${LOW_MAX} ORDER BY TOTAL_RATING ASC, EMPLOYEE_NAME) WHERE ROWNUM <= 5`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  // ── Derived data ───────────────────────────────────────────
  const distRows = useMemo(() => (RatingDistribution as RatingRow[]) ?? [], [RatingDistribution]);
  const ratingPoints = useMemo(() => getRatingPoints(distRows), [distRows]);
  const totalCount = useMemo(() => distRows.reduce((sum, r) => sum + Number(r.COUNT), 0), [distRows]);

  const legendItems = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((rating) => {
        const bucketRows = distRows.filter((r) => Math.round(Number(r.TOTAL_RATING)) === rating);
        const count = bucketRows.reduce((sum, r) => sum + Number(r.COUNT), 0);
        const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(0) + '%' : '0%';
        return { num: String(rating), label: RATING_CONFIG[rating].label, color: RATING_CONFIG[rating].color, pct, count };
      }),
    [distRows, totalCount]
  );

  const s = (Summary as any[])?.[0] ?? {};
  const totalDocs = Number(s.TOTAL ?? 0);
  const finalCount = Number(s.FINAL_CNT ?? 0);
  const pendingCount = Number(s.PENDING_CNT ?? 0);
  const inProgressCount = Number(s.IN_PROGRESS_CNT ?? 0);
  const draftCount = Number(s.DRAFT_CNT ?? 0);
  const ratedCount = Number(s.RATED_CNT ?? 0);
  const avgRating = Number(s.AVG_RATING ?? 0);
  const topCnt = Number(s.TOP_CNT ?? 0);
  const lowCnt = Number(s.LOW_CNT ?? 0);
  const topPct = ratedCount ? Math.round((topCnt / ratedCount) * 10000) / 100 : 0;
  const lowPct = ratedCount ? Math.round((lowCnt / ratedCount) * 10000) / 100 : 0;
  const safeTotalDocs = totalDocs || 1;
  const deptRowsAll = (DeptHistogram as any[]) ?? [];

  const loading = !dperiod || !Summary;

  const handleRefresh = () => { void queryClient.invalidateQueries(); };

  const handleDivisionChange = (v: string) => {
    setDdivision(v);
    setDdepartment('All');
  };

  const handleExport = () => {
    if (!deptRowsAll.length) return;
    const header = 'Department,Avg Rating,Total Employees';
    const lines = deptRowsAll.map(
      (d: any) => `"${String(d.DEPT_NAME ?? '').replace(/"/g, '""')}",${Number(d.AVG_RATING).toFixed(2)},${d.EMP_COUNT}`
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pams-department-performance-${dperiod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!RatingDistribution || !Summary || !DeptHistogram) return;

    const drawCharts = () => {
      const Chart = (window as any).Chart;
      if (!Chart) return;

      const maxCount = Math.max(...ratingPoints.map((p) => p.y), 1);
      const fillPoints = interpolateForFill(ratingPoints);

      const multiColorFill = {
        id: 'multiColorFill',
        beforeDatasetsDraw(chart: any) {
          const { ctx, scales: { x, y } } = chart;
          if (chart.canvas.id !== 'bellChart') return;
          ZONE_COLORS.forEach(({ min, max, color }) => {
            const seg = fillPoints.filter((p: any) => p.x >= min && p.x <= max);
            if (!seg.length) return;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x.getPixelForValue(seg[0].x), y.getPixelForValue(0));
            seg.forEach((p: any) => ctx.lineTo(x.getPixelForValue(p.x), y.getPixelForValue(p.y)));
            ctx.lineTo(x.getPixelForValue(seg[seg.length - 1].x), y.getPixelForValue(0));
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.restore();
          });
        },
      };

      const bellCanvas = document.getElementById('bellChart') as HTMLCanvasElement;
      const pieCanvas = document.getElementById('pieChart') as HTMLCanvasElement;
      const ratingRangeCanvas = document.getElementById('ratingRangeChart') as HTMLCanvasElement;
      const deptCanvas = document.getElementById('deptChart') as HTMLCanvasElement;

      if (!bellCanvas || !pieCanvas || !ratingRangeCanvas || !deptCanvas) return;

      Chart.getChart(bellCanvas)?.destroy();
      Chart.getChart(pieCanvas)?.destroy();
      Chart.getChart(ratingRangeCanvas)?.destroy();
      Chart.getChart(deptCanvas)?.destroy();

      Chart.defaults.font.family = "'Inter', 'Segoe UI', sans-serif";

      new Chart(bellCanvas, {
        type: 'line', plugins: [multiColorFill],
        data: {
          datasets: [
            { type: 'line', label: 'Trend', data: ratingPoints, borderColor: '#00378C', borderWidth: 2.5, pointRadius: 0, tension: 0.25, fill: false, parsing: false, order: 2 },
            { type: 'scatter', label: 'Composite scores', data: ratingPoints, backgroundColor: '#0f172a', pointRadius: 5, pointHoverRadius: 7, pointBorderColor: '#fff', pointBorderWidth: 1.5, parsing: false, order: 1 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: (ctx: any) => ` Score ${ctx.parsed.x}: ${ctx.parsed.y} employees` } } },
          scales: {
            x: { type: 'linear', min: 0.5, max: 5.5, title: { display: true, text: 'Rating Score', color: '#6b7280', font: { size: 12, weight: '600' } }, afterBuildTicks: (axis: any) => { axis.ticks = [1, 2, 3, 4, 5].map((v) => ({ value: v })); }, ticks: { font: { size: 11 }, color: '#9ca3af' }, grid: { display: false }, border: { display: true, color: '#e5e7eb' } },
            y: { display: true, min: 0, max: maxCount * 1.25, title: { display: true, text: 'No. of Employees', color: '#6b7280', font: { size: 12, weight: '600' } }, ticks: { stepSize: Math.max(1, Math.ceil(maxCount / 5)), font: { size: 11 }, color: '#9ca3af', precision: 0 }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: true, color: '#e5e7eb' } },
          },
        },
      });

      const sRow = (Summary as any[])?.[0] ?? {};
      const completed = Number(sRow.FINAL_CNT ?? 0);
      const inProgress = Number(sRow.IN_PROGRESS_CNT ?? 0);
      const draft = Number(sRow.DRAFT_CNT ?? 0);
      const total = Number(sRow.TOTAL ?? 1) || 1;

      new Chart(pieCanvas, {
        type: 'doughnut',
        data: { labels: ['Completed', 'In Progress', 'Draft'], datasets: [{ data: [completed, inProgress, draft], backgroundColor: ['#00378C', '#059669', '#d97706'], borderWidth: 3, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => { const pct = Math.round((ctx.parsed / total) * 100); return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`; } } } } },
      });

      new Chart(ratingRangeCanvas, {
        type: 'doughnut',
        data: { labels: legendItems.map((r) => `${r.num} - ${r.label}`), datasets: [{ data: legendItems.map((r) => r.count), backgroundColor: legendItems.map((r) => r.color), borderWidth: 3, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} (${legendItems[ctx.dataIndex].pct})` } } } },
      });

      const deptRows = (DeptHistogram as any[]) ?? [];
      const deptLabels = deptRows.map((r: any) => r.DEPT_NAME ?? '');
      const deptValues = deptRows.map((r: any) => Number(r.AVG_RATING));
      const allDeptVals = deptValues.length ? deptValues : [3];
      const deptMin = Math.max(0, Math.floor(Math.min(...allDeptVals) - 0.5));
      const deptMax = Math.min(5, Math.ceil(Math.max(...allDeptVals) + 0.5));

      new Chart(deptCanvas, {
        type: 'bar',
        data: { labels: deptLabels.length ? deptLabels : ['No Data'], datasets: [{ data: deptValues.length ? deptValues : [0], backgroundColor: '#00378C', borderRadius: 6, barThickness: 32 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => { const row = deptRows[ctx.dataIndex]; return [' Avg Rating: ' + Number(ctx.parsed.y).toFixed(1), ` Employees: ${row?.EMP_COUNT ?? 0}`]; } } } },
          scales: { x: { ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 30 }, grid: { display: false }, border: { display: false } }, y: { min: deptMin, max: deptMax, ticks: { stepSize: 0.5, font: { size: 11 }, color: '#9ca3af', callback: (v: any) => (+v).toFixed(1) }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } } },
          layout: { padding: { top: 20 } },
        },
      });
    };

    if ((window as any).Chart) { drawCharts(); } else {
      const existing = document.getElementById('chartjs-cdn') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', drawCharts, { once: true });
      } else {
        const script = document.createElement('script');
        script.id = 'chartjs-cdn';
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
        script.onload = () => drawCharts();
        document.head.appendChild(script);
      }
    }
  }, [RatingDistribution, Summary, DeptHistogram, ratingPoints, legendItems]);

  const mapPerf = (rows: any[] | null | undefined) =>
    (rows ?? []).map((emp: any) => ({
      code: emp.EMPLOYEE_CODE,
      name: emp.EMPLOYEE_NAME,
      subtext: `${emp.EMPLOYEE_CODE} · ${emp.DEPT_NAME ?? '—'}`,
      rating: Number(emp.TOTAL_RATING),
    }));

  return (
    <div className='pams-dashboard'>
      <style>{PAMS_CSS}</style>

      <header className='pams-header'>
        <div>
          <h1>
            <Building2 size={22} />
            PAMS Dashboard
          </h1>
          <p>Appraisal progress, ratings and team performance</p>
        </div>

        <div className='pams-filters'>
          <FilterSelect
            label='Division'
            value={ddivision}
            onChange={handleDivisionChange}
            options={[{ code: 'All', name: 'All Divisions' }, ...(Division ?? []).map((d) => ({ code: d.DIV_CODE, name: d.DIV_NAME }))]}
          />
          <FilterSelect
            label='Department'
            value={ddepartment}
            onChange={setDdepartment}
            options={[{ code: 'All', name: 'All Departments' }, ...(Department ?? []).map((d) => ({ code: d.DEPT_CODE, name: d.DEPT_NAME }))]}
          />
          <FilterSelect
            label='Period'
            value={dperiod}
            onChange={setDperiod}
            options={Period.map((p) => ({ code: p.VALUE, name: p.LABEL }))}
          />
          <button type='button' className='pams-refresh' onClick={handleRefresh} title='Refresh PAMS Metrics'>
            {loading ? <Loader2 size={16} className='pams-spin' /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <section className='pams-hero'>
        <HeroCard title='Total Employees' value={totalDocs} caption='Appraisal docs created' icon={Users} tone='blue' loading={loading} />
        <HeroCard title='Final Approved' value={finalCount} caption='FINAL_APPROVED = YES' icon={CheckCircle2} tone='emerald' loading={loading} />
        <HeroCard title='Pending Appraisals' value={pendingCount} caption='Not yet final approved' icon={Hourglass} tone='rose' loading={loading} />
        <HeroCard
          title='Avg Rating'
          value={<><span>{avgRating ? avgRating.toFixed(1) : '0.0'}</span><Stars value={avgRating} size={14} /></>}
          caption={`Out of 5 · ${MODE_LABEL}`}
          icon={Star}
          tone='indigo'
          loading={loading}
        />
        <HeroCard title='Top Performers' value={`${topPct}%`} caption={`${topCnt} employee(s) · Rating >= ${TOP_MIN}`} icon={TrendingUp} tone='emerald' loading={loading} />
        <HeroCard title='Low Performers' value={`${lowPct}%`} caption={`${lowCnt} employee(s) · Rating <= ${LOW_MAX}`} icon={TrendingDown} tone='rose' loading={loading} />
      </section>

      <div className='pams-chart-grid'>
        <article className='pams-card'>
          <div className='pams-card-head'>
            <h3><BarChart3 size={15} />Performance Distribution — {MODE_LABEL}</h3>
            <div className='pams-legend'>
              <span><i style={{ background: '#00378C' }} />Trend</span>
              <span><i style={{ background: '#0f172a' }} />Scores</span>
            </div>
          </div>
          <div className='pams-chart-box'>
            <canvas id='bellChart'></canvas>
          </div>
          <div className='pams-score-legend'>
            {legendItems.map((r) => (
              <div key={r.num}>
                <b style={{ color: r.color }}>{r.num}</b>
                <span>{r.label}</span>
                <em style={{ color: r.color }}>{r.pct} ({r.count})</em>
              </div>
            ))}
          </div>
        </article>

        <article className='pams-card'>
          <div className='pams-card-head'>
            <h3><ClipboardCheck size={15} />Appraisal Status</h3>
          </div>
          <div className='pams-donut-wrap'>
            <div className='pams-donut'>
              <canvas id='pieChart'></canvas>
              <div className='pams-donut-center'>
                <b>{totalDocs}</b>
                <small>Total</small>
              </div>
            </div>
            <div className='pams-donut-list'>
              {[
                { label: 'Completed', color: '#00378C', value: finalCount },
                { label: 'In Progress', color: '#059669', value: inProgressCount },
                { label: 'Draft', color: '#d97706', value: draftCount },
              ].map((item) => (
                <div key={item.label} className='pams-donut-row'>
                  <div><span className='pams-dot' style={{ background: item.color }} />{item.label}</div>
                  <div>
                    <b style={{ color: item.color }}>{Math.round((Number(item.value) / safeTotalDocs) * 100)}%</b>
                    <small>({item.value})</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <div className='pams-chart-grid'>
        <article className='pams-card'>
          <div className='pams-card-head'>
            <h3><Layers size={15} />Rating Range Breakdown</h3>
            <span>{MODE_LABEL}</span>
          </div>
          <div className='pams-donut-wrap'>
            <div className='pams-donut'>
              <canvas id='ratingRangeChart'></canvas>
              <div className='pams-donut-center'>
                <b>{totalCount}</b>
                <small>Rated</small>
              </div>
            </div>
            <div className='pams-donut-list'>
              {legendItems.map((r) => (
                <div key={r.num} className='pams-donut-row'>
                  <div>
                    <span className='pams-dot' style={{ background: r.color }} />
                    <Stars value={Number(r.num)} size={11} />
                    {r.label}
                  </div>
                  <div>
                    <b style={{ color: r.color }}>{r.pct}</b>
                    <small>({r.count})</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className='pams-card'>
          <div className='pams-card-head'>
            <h3><BarChart3 size={15} />Department Performance</h3>
            <span>Avg rating</span>
          </div>
          <div className='pams-chart-box'>
            <canvas id='deptChart'></canvas>
          </div>
        </article>
      </div>

      <div className='pams-panel-grid'>
        <PerformerPanel
          title='Top Performers'
          subtitle={`Rating >= ${TOP_MIN} · ${MODE_LABEL}`}
          tone='emerald'
          icon={Trophy}
          loading={!TopEmployees}
          emptyText='No top performers found'
          items={mapPerf(TopEmployees as any[])}
        />
        <PerformerPanel
          title='Low Performers'
          subtitle={`Rating <= ${LOW_MAX} · ${MODE_LABEL}`}
          tone='rose'
          icon={AlertTriangle}
          loading={!LowEmployees}
          emptyText='No low performers found'
          items={mapPerf(LowEmployees as any[])}
        />
      </div>

      <article className='pams-card'>
        <div className='pams-card-head'>
          <h3><Users size={15} />Department Performance Overview</h3>
          <button type='button' className='pams-export' onClick={handleExport} disabled={!deptRowsAll.length}>
            <Download size={14} /> Export
          </button>
        </div>
        <div className='pams-table-wrap'>
          <table className='pams-table'>
            <thead>
              <tr>
                <th>Department</th>
                <th className='c'>Avg Rating</th>
                <th className='c'>Rating</th>
                <th className='c'>Total Employees</th>
                <th className='c'>Status</th>
              </tr>
            </thead>
            <tbody>
              {deptRowsAll.length > 0 ? (
                deptRowsAll.map((dept: any, i: number) => {
                  const avg = Number(dept.AVG_RATING);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{dept.DEPT_NAME}</td>
                      <td className='c'><span className='pams-score'>{avg.toFixed(1)}</span></td>
                      <td className='c'><Stars value={avg} size={12} /></td>
                      <td className='c'>{dept.EMP_COUNT}</td>
                      <td className='c'>
                        <span className={`pams-pill ${avg >= 4 ? 'good' : avg >= 3 ? 'ok' : 'bad'}`}>
                          {avg >= 4 ? 'Excellent' : avg >= 3 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}><div className='pams-empty'>No data available</div></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
};

export default PamsDashboard;