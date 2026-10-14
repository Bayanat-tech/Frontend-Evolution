import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Home,
  Hourglass,
  Layers,
  Loader2,
  RefreshCw,
  ChevronRight,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { pamsSelect } from '../../api/pams';
import { executeWmsInboundSql } from '../../api/wms';
import { useAuth } from '../../state/AuthContext';

// ── Interfaces ───────────────────────────────────────────────
interface EmployeeData { TOTAL_EMPLOYEES: number; }
interface EmployeeDivision { DIV_CODE: string; DIV_NAME: string; }
interface EmployeeDepartment { DEPT_CODE: string; DEPT_NAME: string; }
interface PeriodData { VALUE: string; LABEL: string; }
interface ApiResponse<T> { success: boolean; data: T[]; totalCount: number; }
interface RatingRow { TOTAL_RATING: number; COUNT: number; }

type StatusMode = 'running' | 'final';
type Tone = 'blue' | 'emerald' | 'rose' | 'amber' | 'indigo';

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

// ── Styles (Finance-dashboard look, scoped to .pams-dashboard) ─
const PAMS_CSS = `
.pams-dashboard { --pd-blue:#00378C; --pd-border:#dbe3ee; --pd-muted:#64748b; padding:0 14px 20px; min-height:100vh; display:flex; flex-direction:column; gap:10px; font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif; font-size:11px; color:#0f172a; background:#fff; box-sizing:border-box; }
.pams-dashboard * { box-sizing:border-box; }

/* Breadcrumb */
.pams-crumb { display:flex; align-items:center; gap:7px; padding:8px 2px; margin:0 -14px; padding-left:16px; border-bottom:1px solid var(--pd-border); font-size:11.5px; font-weight:600; color:#475569; }
.pams-crumb svg { color:#64748b; }
.pams-crumb b { color:#0f172a; font-weight:700; }

/* Header */
.pams-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; padding-top:2px; }
.pams-header h1 { display:flex; align-items:center; gap:8px; margin:0; font-size:19px; font-weight:800; letter-spacing:-0.01em; color:var(--pd-blue); }
.pams-header p { margin:6px 0 0; font-size:10.5px; color:#334155; font-weight:500; }

.pams-filters { display:flex; align-items:flex-end; flex-wrap:wrap; gap:10px; }
.pams-filters label { display:flex; flex-direction:column; gap:3px; }
.pams-filters label > span { font-size:8.5px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#334155; }
.pams-filters select { height:30px; min-width:120px; max-width:210px; padding:0 8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; font-size:11px; font-weight:600; color:#0f172a; outline:none; }
.pams-filters select:focus { border-color:var(--pd-blue); box-shadow:0 0 0 2px rgba(0,55,140,0.15); }
.pams-filters strong { display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 12px; border-radius:6px; border:1px solid #c7d6f2; background:#eef3ff; color:var(--pd-blue); font-size:11px; font-weight:700; }
.pams-toggle { display:inline-flex; height:30px; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; background:#fff; }
.pams-toggle button { padding:0 14px; border:none; background:transparent; color:var(--pd-muted); font-size:11px; font-weight:700; cursor:pointer; transition:all .15s; }
.pams-toggle button + button { border-left:1px solid #cbd5e1; }
.pams-toggle button.is-on-running { background:#fff3de; color:#b45309; }
.pams-toggle button.is-on-final { background:#e6f7f0; color:#047857; }
.pams-refresh { width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:var(--pd-blue); cursor:pointer; transition:background .15s; }
.pams-refresh:hover { background:#eef3ff; }

/* Hero KPIs */
.pams-hero { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; }
.pams-hero-card { background:#fff; border:1px solid var(--pd-border); border-top:2px solid var(--tone); border-radius:5px; padding:9px 10px 7px; display:flex; flex-direction:column; gap:6px; }
.pams-hero-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.pams-hero-top span { font-size:9px; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:#334155; }
.pams-hero-icon { width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:6px; background:var(--tone-bg); color:var(--tone); flex-shrink:0; }
.pams-hero-icon svg { width:14px; height:14px; }
.pams-hero-value { font-size:17px; font-weight:800; line-height:1.15; color:#0f172a; min-height:20px; padding-bottom:5px; border-bottom:1px solid #eef2f7; }
.pams-hero-foot { font-size:9.5px; color:var(--pd-muted); font-weight:500; }
.tone-blue { --tone:#00378C; --tone-bg:#e8efff; }
.tone-emerald { --tone:#059669; --tone-bg:#e6f7f0; }
.tone-rose { --tone:#e11d48; --tone-bg:#ffe9ee; }
.tone-amber { --tone:#d97706; --tone-bg:#fff3de; }
.tone-indigo { --tone:#4f46e5; --tone-bg:#ecebff; }

/* Section title */
.pams-section-title { display:flex; align-items:center; gap:10px; margin:2px 0 8px; }
.pams-section-title span { flex:1; height:1px; background:var(--pd-border); }
.pams-section-title h2 { margin:0; font-size:9.5px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:var(--pd-blue); }

/* Compact KPIs */
.pams-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:8px; }
.pams-kpi { background:#fff; border:1px solid var(--pd-border); border-radius:5px; padding:8px 10px 7px; display:flex; flex-direction:column; gap:6px; transition:border-color .15s; }
.pams-kpi:hover { border-color:var(--pd-blue); }
.pams-kpi-top { display:flex; align-items:center; justify-content:space-between; }
.pams-kpi-top span { font-size:9px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#334155; }
.pams-kpi-top i { width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:6px; background:var(--tone-bg); color:var(--tone); }
.pams-kpi strong { font-size:15px; font-weight:800; min-height:18px; }
.pams-kpi small { display:inline-block; width:fit-content; font-size:9px; color:var(--pd-muted); font-weight:700; background:#f1f5f9; border-radius:4px; padding:1px 6px; }

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

/* Ranking: one row of 5 mini cards (like Top 5 Customers / Suppliers) */
.pams-ranking { display:grid; grid-template-columns:repeat(auto-fit,minmax(118px,1fr)); gap:8px; }
.pams-rank { display:flex; gap:7px; align-items:flex-start; border:1px solid #e8edf4; border-radius:5px; padding:7px 8px; background:#fff; min-width:0; }
.pams-rank > b { width:17px; height:17px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:5px; background:var(--tone-bg); color:var(--tone); font-size:9.5px; font-weight:800; }
.pams-rank > div { flex:1; min-width:0; }
.pams-rank-line { display:flex; flex-direction:column; gap:1px; }
.pams-rank-line strong { font-size:10.5px; font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pams-rank-line span { font-size:11px; font-weight:800; color:#0f172a; }
.pams-rank-bar { display:block; height:4px; margin:5px 0 4px; background:#eef2f7; border-radius:99px; overflow:hidden; }
.pams-rank-bar > span { display:block; height:100%; background:var(--tone); border-radius:99px; }
.pams-rank small { display:block; font-size:9px; color:#94a3b8; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* Table / list */
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
.pams-empty { display:flex; align-items:center; justify-content:center; gap:8px; padding:22px 10px; color:#94a3b8; font-size:11px; font-weight:600; grid-column:1 / -1; }
.pams-skeleton { display:inline-block; width:80px; height:16px; border-radius:4px; background:linear-gradient(90deg,#eef2f7 25%,#e2e8f0 50%,#eef2f7 75%); background-size:200% 100%; animation:pams-shimmer 1.2s infinite; }
@keyframes pams-shimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
.pams-spin { animation:pams-rot .8s linear infinite; }
@keyframes pams-rot { to { transform:rotate(360deg); } }
`;

// ── UI Components ────────────────────────────────────────────
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
}: { title: string; value: string | number; caption: string; icon: LucideIcon; tone: Tone; loading: boolean }) => (
  <article className={`pams-hero-card tone-${tone}`}>
    <div className='pams-hero-top'>
      <span>{title}</span>
      <div className='pams-hero-icon'><Icon size={16} /></div>
    </div>
    <div className='pams-hero-value'>{loading ? <span className='pams-skeleton' /> : value}</div>
    <div className='pams-hero-foot'>{caption}</div>
  </article>
);

const MiniKpi = ({
  title, value, caption, icon: Icon, tone, loading,
}: { title: string; value: string | number; caption: string; icon: LucideIcon; tone: Tone; loading: boolean }) => (
  <article className={`pams-kpi tone-${tone}`}>
    <div className='pams-kpi-top'>
      <span>{title}</span>
      <i><Icon size={14} /></i>
    </div>
    <strong>{loading ? <span className='pams-skeleton' /> : value}</strong>
    <small>{caption}</small>
  </article>
);

const RankPanel = ({
  title, subtitle, items, tone, loading, icon: Icon,
}: { title: string; subtitle: string; items: any[]; tone: 'emerald' | 'rose'; loading: boolean; icon: LucideIcon }) => (
  <article className={`pams-card tone-${tone}`}>
    <div className='pams-card-head'>
      <h3><Icon size={15} />{title}</h3>
      <span>{subtitle}</span>
    </div>
    <div className='pams-ranking'>
      {loading ? (
        <div className='pams-empty'><Loader2 size={18} className='pams-spin' /></div>
      ) : items.length > 0 ? (
        items.map((item, i) => (
          <div className='pams-rank' key={i}>
            <b>{i + 1}</b>
            <div>
              <div className='pams-rank-line'>
                <strong title={item.name}>{item.name}</strong>
                <span>{item.value}</span>
              </div>
              <i className='pams-rank-bar'><span style={{ width: `${Math.min(100, (Number(item.value) / 5) * 100)}%` }} /></i>
              <small>{item.subtext}</small>
            </div>
          </div>
        ))
      ) : (
        <div className='pams-empty'><CheckCircle2 size={18} /><span>No rated employees found</span></div>
      )}
    </div>
  </article>
);

// ── Main Component ───────────────────────────────────────────
const PamsDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ddepartment, setDdepartment] = useState<string>('All');
  const [ddivision, setDdivision] = useState<string>('All');
  const [dperiod, setDperiod] = useState<string>('');
  const [statusMode, setStatusMode] = useState<StatusMode>('final');

  const statusFilterClause = statusMode === 'final' ? `NVL(FINAL_APPROVED,'No') = 'YES'` : `NVL(FINAL_APPROVED,'No') <> 'YES'`;

  // ── Queries ────────────────────────────────────────────────
  const { data: Total_Employees } = useQuery<EmployeeData[]>({
    queryKey: ['total_employees', ddivision, ddepartment],
    queryFn: () => pamsSelect<EmployeeData>({ parameter: 'employee_hierarchy_total', loginid: user?.loginid ?? '', code1: user?.company_code ?? '', code2: ddivision, code3: ddepartment }),
  });

  const { data: Division } = useQuery<EmployeeDivision[]>({
    queryKey: ['division'],
    queryFn: () => pamsSelect<EmployeeDivision>({ parameter: 'employee_division', loginid: user?.loginid ?? '', code1: user?.company_code ?? '' }),
  });

  const { data: Department } = useQuery<EmployeeDepartment[]>({
    queryKey: ['department', ddivision],
    queryFn: () => pamsSelect<EmployeeDepartment>({ parameter: 'employee_department', loginid: user?.loginid ?? '', code1: user?.company_code ?? '', code2: ddivision }),
  });

  const { data: PeriodResponse } = useQuery<ApiResponse<PeriodData> | null>({
    queryKey: ['period'],
    queryFn: async () => {
      const sql = `SELECT PERIOD_NUMBER AS VALUE, TO_CHAR(PERIOD_FROM_DATE,'DD-MON-YYYY') || ' - ' || TO_CHAR(PERIOD_TO_DATE,'DD-MON-YYYY') AS LABEL FROM MS_KPI_PERIOD WHERE company_code = '${user?.company_code}' ORDER BY PERIOD_NUMBER DESC`;
      const response = await executeWmsInboundSql(sql);
      return response as unknown as ApiResponse<PeriodData> | null;
    },
  });
  const Period: any = PeriodResponse ?? [];

  useEffect(() => { if (Period.length > 0 && !dperiod) setDperiod(String(Period[0].VALUE)); }, [PeriodResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: FinalApprovedRes } = useQuery({
    queryKey: ['final_approved', ddivision, ddepartment, dperiod], enabled: !!Division && !!Department && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT COUNT(*) AS total_final_approved FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}') AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND NVL(FINAL_APPROVED,'No') = 'YES'`;
      return await executeWmsInboundSql(sql);
    },
  });

  const { data: RunningRes } = useQuery({
    queryKey: ['running_count', ddivision, ddepartment, dperiod], enabled: !!Division && !!Department && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT COUNT(*) AS total_running FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}') AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND NVL(FINAL_APPROVED,'No') <> 'YES'`;
      return await executeWmsInboundSql(sql);
    },
  });

  const { data: Pending_Appraisals } = useQuery({
    queryKey: ['pending_appraisals', ddivision, ddepartment, dperiod], enabled: !!ddivision && !!ddepartment && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT COUNT(*) AS total_pending_appraisals FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}') AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND LAST_ACTION <> 'SAVE AS DRAFT' AND NVL(FINAL_APPROVED,'No') <> 'YES'`;
      return await executeWmsInboundSql(sql);
    },
  });

  const { data: Ratings } = useQuery({
    queryKey: ['ratings', statusMode, ddivision, ddepartment, dperiod], enabled: !!Division && !!Department && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT COUNT(*) AS total_employees, ROUND(AVG(TOTAL_RATING), 2) AS avg_rating, SUM(CASE WHEN TOTAL_RATING >= 4 THEN 1 ELSE 0 END) AS top_performers, SUM(CASE WHEN TOTAL_RATING <= 2 THEN 1 ELSE 0 END) AS low_performers, ROUND((SUM(CASE WHEN TOTAL_RATING >= 4 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100, 2) AS top_performers_pct, ROUND((SUM(CASE WHEN TOTAL_RATING <= 2 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100, 2) AS low_performers_pct FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}') AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND ${statusFilterClause}`;
      return await executeWmsInboundSql(sql);
    },
  });

  const { data: RatingDistribution } = useQuery({
    queryKey: ['rating_distribution', statusMode, ddivision, ddepartment, dperiod], enabled: !!ddivision && !!ddepartment && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT TOTAL_RATING, COUNT(*) AS COUNT FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR div_code = '${ddivision}') AND ('${ddepartment}' = 'All' OR dept_code = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND ${statusFilterClause} AND TOTAL_RATING IS NOT NULL GROUP BY TOTAL_RATING ORDER BY TOTAL_RATING`;
      return (await executeWmsInboundSql(sql)) as unknown as RatingRow[] | null;
    },
  });

  const { data: DeptHistogram } = useQuery({
    queryKey: ['dept_histogram', statusMode, ddivision, ddepartment, dperiod], enabled: !!ddivision && !!ddepartment && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT DEPT_NAME, ROUND(AVG(TOTAL_RATING), 2) AS AVG_RATING, COUNT(*) AS EMP_COUNT FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}') AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND ${statusFilterClause} AND TOTAL_RATING IS NOT NULL GROUP BY DEPT_NAME ORDER BY AVG_RATING DESC`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const { data: AppraisalStatus } = useQuery({
    queryKey: ['appraisal_status', ddivision, ddepartment, dperiod], enabled: !!ddivision && !!ddepartment && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT SUM(CASE WHEN NVL(FINAL_APPROVED,'No') = 'YES' THEN 1 ELSE 0 END) AS COMPLETED, SUM(CASE WHEN NVL(FINAL_APPROVED,'No') <> 'YES' AND LAST_ACTION <> 'SAVE AS DRAFT' AND REVIEW_DATE IS NOT NULL THEN 1 ELSE 0 END) AS IN_PROGRESS, SUM(CASE WHEN (LAST_ACTION = 'SAVE AS DRAFT' OR REVIEW_DATE IS NULL) AND NVL(FINAL_APPROVED,'No') <> 'YES' THEN 1 ELSE 0 END) AS PENDING, COUNT(*) AS TOTAL FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}') AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}'`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const { data: TopEmployees } = useQuery({
    queryKey: ['top_employees', statusMode, ddivision, ddepartment, dperiod], enabled: !!ddivision && !!ddepartment && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT ROWNUM AS RANK, EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM (SELECT EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}') AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND ${statusFilterClause} AND TOTAL_RATING IS NOT NULL ORDER BY TOTAL_RATING DESC) WHERE ROWNUM <= 5`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const { data: BottomEmployees } = useQuery({
    queryKey: ['bottom_employees', statusMode, ddivision, ddepartment, dperiod], enabled: !!ddivision && !!ddepartment && !!dperiod,
    queryFn: async () => {
      const sql = `SELECT ROWNUM AS RANK, EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM (SELECT EMPLOYEE_NAME, DEPT_NAME, TOTAL_RATING FROM VW_PAMS_DASH_BOARD WHERE ('${ddivision}' = 'All' OR DIV_CODE = '${ddivision}') AND ('${ddepartment}' = 'All' OR DEPT_CODE = '${ddepartment}') AND PERIOD_NUMBER = '${dperiod}' AND ${statusFilterClause} AND TOTAL_RATING IS NOT NULL ORDER BY TOTAL_RATING ASC) WHERE ROWNUM <= 5`;
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

  const statusRow = (AppraisalStatus as any[])?.[0] ?? {};
  const totalStatus = Number(statusRow.TOTAL ?? 0);
  const safeTotalStatus = totalStatus || 1;
  const finalCount = Number((FinalApprovedRes as any)?.[0]?.TOTAL_FINAL_APPROVED ?? 0);
  const runningCount = Number((RunningRes as any)?.[0]?.TOTAL_RUNNING ?? 0);
  const ratingRow = (Ratings as any)?.[0] ?? {};
  const deptRowsAll = (DeptHistogram as any[]) ?? [];

  const loading = !Division || !Department || !dperiod || !Ratings || !AppraisalStatus;

  const handleRefresh = () => { void queryClient.invalidateQueries(); };

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

  // ── Chart.js Integration ───────────────────────────────────
  useEffect(() => {
    if (!RatingDistribution || !AppraisalStatus || !DeptHistogram) return;

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

      // 1. Bell Chart
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

      // 2. Doughnut (Appraisal Status)
      const sRow = (AppraisalStatus as any[])?.[0] ?? {};
      const completed = Number(sRow.COMPLETED ?? 0);
      const inProgress = Number(sRow.IN_PROGRESS ?? 0);
      const pending = Number(sRow.PENDING ?? 0);
      const total = Number(sRow.TOTAL ?? 1) || 1;

      new Chart(pieCanvas, {
        type: 'doughnut',
        data: { labels: ['Completed', 'In Progress', 'Pending'], datasets: [{ data: [completed, inProgress, pending], backgroundColor: ['#00378C', '#059669', '#d97706'], borderWidth: 3, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => { const pct = Math.round((ctx.parsed / total) * 100); return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`; } } } } },
      });

      // 3. Rating Range Breakdown
      new Chart(ratingRangeCanvas, {
        type: 'doughnut',
        data: { labels: legendItems.map((r) => `${r.num} - ${r.label}`), datasets: [{ data: legendItems.map((r) => r.count), backgroundColor: legendItems.map((r) => r.color), borderWidth: 3, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} (${legendItems[ctx.dataIndex].pct})` } } } },
      });

      // 4. Department Performance
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
  }, [RatingDistribution, AppraisalStatus, DeptHistogram, ratingPoints, legendItems]);

  const modeLabel = statusMode === 'final' ? 'Final Approved' : 'Running';
  const companyLabel = user?.company_code || '—';

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className='pams-dashboard'>
      <style>{PAMS_CSS}</style>

      {/* Breadcrumb */}
      <div className='pams-crumb'>
        <Home size={13} />
        <span>Home</span>
        <ChevronRight size={12} />
        <b>PAMS</b>
      </div>

      {/* Top Header */}
      <header className='pams-header'>
        <div>
          <h1>
            <Building2 size={22} />
            PAMS Dashboard
          </h1>
          <p>Appraisal progress, ratings and team performance for {companyLabel}</p>
        </div>

        <div className='pams-filters'>
          <label>
            <span>Company</span>
            <strong><Building2 size={13} />{companyLabel}</strong>
          </label>
          <FilterSelect
            label='Division'
            value={ddivision}
            onChange={setDdivision}
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
            options={Period.map((p: PeriodData) => ({ code: p.VALUE, name: p.LABEL }))}
          />
          <label>
            <span>Status</span>
            <div className='pams-toggle'>
              <button type='button' className={statusMode === 'running' ? 'is-on-running' : ''} onClick={() => setStatusMode('running')}>Running</button>
              <button type='button' className={statusMode === 'final' ? 'is-on-final' : ''} onClick={() => setStatusMode('final')}>Final</button>
            </div>
          </label>
          <button type='button' className='pams-refresh' onClick={handleRefresh} title='Refresh PAMS Metrics'>
            {loading ? <Loader2 size={16} className='pams-spin' /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      {/* Hero KPIs */}
      <section className='pams-hero'>
        <HeroCard title='Total Employees' value={Total_Employees?.[0]?.TOTAL_EMPLOYEES || 0} caption='Active workforce' icon={Users} tone='blue' loading={!Total_Employees} />
        <HeroCard
          title={statusMode === 'final' ? 'Final Approved' : 'Running'}
          value={statusMode === 'final' ? finalCount : runningCount}
          caption='Appraisal status'
          icon={statusMode === 'final' ? CheckCircle2 : Clock}
          tone={statusMode === 'final' ? 'emerald' : 'amber'}
          loading={statusMode === 'final' ? !FinalApprovedRes : !RunningRes}
        />
        <HeroCard title='Pending Appraisals' value={(Pending_Appraisals as any)?.[0]?.TOTAL_PENDING_APPRAISALS || 0} caption='Requires action' icon={Hourglass} tone='rose' loading={!Pending_Appraisals} />
        <HeroCard title='Avg Rating' value={`${ratingRow.AVG_RATING || 0} / 5`} caption={`Overall performance · ${modeLabel}`} icon={Star} tone='indigo' loading={!Ratings} />
        <HeroCard title='Top Performers' value={`${ratingRow.TOP_PERFORMERS_PCT || 0}%`} caption='Rating >= 4.0' icon={TrendingUp} tone='emerald' loading={!Ratings} />
        <HeroCard title='Low Performers' value={`${ratingRow.LOW_PERFORMERS_PCT || 0}%`} caption='Rating <= 2.0' icon={TrendingDown} tone='rose' loading={!Ratings} />
      </section>

      

      {/* Charts Row 1 */}
      <div className='pams-chart-grid'>
        <article className='pams-card'>
          <div className='pams-card-head'>
            <h3><BarChart3 size={15} />Performance Distribution — {modeLabel}</h3>
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
                <b>{totalStatus}</b>
                <small>Total</small>
              </div>
            </div>
            <div className='pams-donut-list'>
              {[
                { label: 'Completed', color: '#00378C', value: statusRow.COMPLETED ?? 0 },
                { label: 'In Progress', color: '#059669', value: statusRow.IN_PROGRESS ?? 0 },
                { label: 'Pending', color: '#d97706', value: statusRow.PENDING ?? 0 },
              ].map((item) => (
                <div key={item.label} className='pams-donut-row'>
                  <div><span className='pams-dot' style={{ background: item.color }} />{item.label}</div>
                  <div>
                    <b style={{ color: item.color }}>{Math.round((Number(item.value) / safeTotalStatus) * 100)}%</b>
                    <small>({item.value})</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      {/* Charts Row 2 */}
      <div className='pams-chart-grid'>
        <article className='pams-card'>
          <div className='pams-card-head'>
            <h3><Layers size={15} />Rating Range Breakdown</h3>
            <span>{modeLabel}</span>
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
                  <div><span className='pams-dot' style={{ background: r.color }} />{r.num} — {r.label}</div>
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

      {/* Top / Bottom performers */}
      <div className='pams-panel-grid'>
        <RankPanel
          title='Top 5 Rated Employees'
          subtitle={modeLabel}
          tone='emerald'
          icon={Trophy}
          loading={!TopEmployees}
          items={((TopEmployees as any[]) ?? []).map((emp: any) => ({ name: emp.EMPLOYEE_NAME, subtext: emp.DEPT_NAME, value: Number(emp.TOTAL_RATING).toFixed(1) }))}
        />
        <RankPanel
          title='Bottom 5 Performers'
          subtitle={modeLabel}
          tone='rose'
          icon={AlertTriangle}
          loading={!BottomEmployees}
          items={((BottomEmployees as any[]) ?? []).map((emp: any) => ({ name: emp.EMPLOYEE_NAME, subtext: emp.DEPT_NAME, value: Number(emp.TOTAL_RATING).toFixed(1) }))}
        />
      </div>

      {/* Department table */}
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
                  <td colSpan={4}><div className='pams-empty'>No data available</div></td>
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