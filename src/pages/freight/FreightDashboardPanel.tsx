import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  Loader2,
  Plane,
  RefreshCw,
  Ship,
  Truck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";

type Summary = Record<string, number | null | undefined>;
type MonthlyRow = {
  MONTH_NO?: number;
  MONTH_LABEL?: string;
  JOBS?: number;
  COMPLETED?: number;
  ENQUIRIES?: number;
  RFQS?: number;
  QUOTATIONS?: number;
};
type PrincipalRow = { PRIN_CODE?: string; PRIN_NAME?: string; JOB_COUNT?: number; SHARE_PERCENT?: number };
type AttentionRow = {
  REFERENCE_NO?: string;
  PRIN_NAME?: string;
  EVENT_DATE?: string;
  ROUTE_LABEL?: string;
  STATUS?: string;
  MODE_CODE?: string;
};
type DashboardData = {
  summary?: Summary;
  monthly?: MonthlyRow[];
  topPrincipals?: PrincipalRow[];
  attention?: AttentionRow[];
};

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function FreightDashboardPanel() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const companyName = String(userRecord.company_name || userRecord.COMPANY_NAME || companyCode);
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post<{ success?: boolean; data?: DashboardData; message?: string; details?: string }>(
        "/api/freight/workspace/dashboard",
        { company_code: companyCode, user_id: userId, year, month },
      );
      setData(response.data.data || {});
    } catch (requestError: any) {
      setData({});
      setError(requestError?.response?.data?.details || requestError?.response?.data?.message || "Freight dashboard is not available.");
    } finally {
      setLoading(false);
    }
  }, [companyCode, month, userId, year]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = data.summary || {};
  const commercialCards: MetricProps[] = [
    metric("Enquiries", summary.ENQUIRIES, summary.PREV_ENQUIRIES, ClipboardList, "blue"),
    metric("Requests for quotation", summary.RFQS, summary.PREV_RFQS, FileText, "violet"),
    metric("Quotations", summary.QUOTATIONS, summary.PREV_QUOTATIONS, FileCheck2, "teal"),
    metric("New jobs", summary.NEW_JOBS, summary.PREV_NEW_JOBS, BriefcaseBusiness, "amber"),
  ];
  const operationCards: MetricProps[] = [
    { title: "Open jobs", value: number(summary.OPEN_JOBS), icon: BriefcaseBusiness, tone: "blue", caption: "Current workload" },
    { title: "Completed", value: number(summary.COMPLETED_JOBS), icon: CheckCircle2, tone: "green", caption: months[month - 1] },
    { title: "Invoiced", value: number(summary.INVOICED_JOBS), icon: FileCheck2, tone: "teal", caption: months[month - 1] },
    { title: "Overdue operations", value: number(summary.OVERDUE_JOBS), icon: AlertTriangle, tone: "red", caption: "Needs attention" },
  ];
  const modeCards: MetricProps[] = [
    { title: "Air freight", value: number(summary.AIR_JOBS), icon: Plane, tone: "blue", caption: "Jobs this month" },
    { title: "Sea freight", value: number(summary.SEA_JOBS), icon: Ship, tone: "teal", caption: "Jobs this month" },
    { title: "Road freight", value: number(summary.ROAD_JOBS), icon: Truck, tone: "amber", caption: "Jobs this month" },
  ];

  return (
    <div className="freight-dashboard">
      <header className="freight-dashboard-header">
        <div>
          <h1>Freight Dashboard</h1>
          <p>Operational overview for {companyName}</p>
        </div>
        <div className="freight-dashboard-filters">
          <label><span>Company</span><strong><BriefcaseBusiness size={14} />{companyName}</strong></label>
          <label><span>Year</span><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{yearOptions(now.getFullYear()).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Month</span><select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{months.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></label>
          <button type="button" onClick={() => void loadDashboard()} disabled={loading} title="Refresh dashboard">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      {error && <div className="freight-dashboard-error"><AlertTriangle size={15} />{error}<button type="button" onClick={() => void loadDashboard()}>Try again</button></div>}

      <DashboardSection title="Commercial Pipeline"><div className="freight-dashboard-kpis">{commercialCards.map((item) => <MetricCard key={item.title} {...item} loading={loading} />)}</div></DashboardSection>
      <DashboardSection title="Job Operations"><div className="freight-dashboard-kpis">{operationCards.map((item) => <MetricCard key={item.title} {...item} loading={loading} />)}</div></DashboardSection>
      <DashboardSection title="Transport Mode Mix"><div className="freight-dashboard-kpis freight-dashboard-kpis-three">{modeCards.map((item) => <MetricCard key={item.title} {...item} loading={loading} />)}</div></DashboardSection>

      <div className="freight-dashboard-chart-grid">
        <TrendChart title="Jobs by Month" rows={data.monthly || []} series={[{ key: "JOBS", label: "New jobs", color: "#06479b" }, { key: "COMPLETED", label: "Completed", color: "#10a37f" }]} loading={loading} />
        <TrendChart title="Commercial Pipeline by Month" rows={data.monthly || []} series={[{ key: "ENQUIRIES", label: "Enquiries", color: "#06479b" }, { key: "RFQS", label: "RFQ", color: "#7c3aed" }, { key: "QUOTATIONS", label: "Quotations", color: "#f59e0b" }]} loading={loading} />
      </div>

      <div className="freight-dashboard-panel-grid">
        <TopPrincipals rows={data.topPrincipals || []} loading={loading} />
        <AttentionList rows={data.attention || []} loading={loading} />
      </div>
    </div>
  );
}

function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="freight-dashboard-section"><div className="freight-dashboard-section-title"><span /> <h2>{title}</h2> <span /></div>{children}</section>;
}

type MetricProps = { title: string; value: number; icon: LucideIcon; tone: string; previous?: number; change?: number | null; caption?: string };
function metric(title: string, current: unknown, previous: unknown, icon: LucideIcon, tone: string): MetricProps {
  const value = number(current);
  const prior = number(previous);
  return { title, value, previous: prior, change: prior === 0 ? (value > 0 ? null : 0) : ((value - prior) / prior) * 100, icon, tone };
}
function MetricCard({ title, value, previous, change, caption, icon: Icon, tone, loading }: MetricProps & { loading: boolean }) {
  return <article className={`freight-dashboard-kpi tone-${tone}`}>
    <div className="freight-dashboard-kpi-top"><span>{title}</span><i><Icon size={16} /></i></div>
    <strong>{loading ? <em className="freight-dashboard-skeleton" /> : value.toLocaleString()}</strong>
    <div className="freight-dashboard-kpi-foot">
      {change === null ? <b className="is-up"><ArrowUpRight size={13} /> New</b> : change !== undefined ? <b className={change >= 0 ? "is-up" : "is-down"}>{change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change).toFixed(1)}%</b> : <span>{caption}</span>}
      {previous !== undefined && <span>Prev {previous.toLocaleString()}</span>}
      {previous === undefined && <span>{caption}</span>}
    </div>
  </article>;
}

type Series = { key: keyof MonthlyRow; label: string; color: string };
function TrendChart({ title, rows, series, loading }: { title: string; rows: MonthlyRow[]; series: Series[]; loading: boolean }) {
  const normalized = useMemo(() => Array.from({ length: 12 }, (_, index) => rows.find((row) => Number(row.MONTH_NO) === index + 1) || { MONTH_NO: index + 1, MONTH_LABEL: months[index].slice(0, 3) }), [rows]);
  const max = Math.max(1, ...normalized.flatMap((row) => series.map((item) => number(row[item.key]))));
  const width = 720, height = 235, left = 38, right = 18, top = 22, bottom = 35;
  const x = (index: number) => left + index * ((width - left - right) / 11);
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  return <article className="freight-dashboard-card freight-dashboard-chart">
    <div className="freight-dashboard-card-head"><h3>{title}</h3><div>{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div></div>
    {loading ? <div className="freight-dashboard-chart-loading"><Loader2 className="animate-spin" size={22} /></div> : <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      {[0, .25, .5, .75, 1].map((ratio) => <line key={ratio} x1={left} x2={width - right} y1={y(max * ratio)} y2={y(max * ratio)} className="chart-gridline" />)}
      {[0, .5, 1].map((ratio) => <text key={ratio} x={left - 8} y={y(max * ratio) + 4} textAnchor="end" className="chart-axis">{compact(max * ratio)}</text>)}
      {normalized.map((row, index) => <text key={index} x={x(index)} y={height - 10} textAnchor="middle" className="chart-axis">{row.MONTH_LABEL}</text>)}
      {series.map((item) => {
        const points = normalized.map((row, index) => `${x(index)},${y(number(row[item.key]))}`).join(" ");
        return <g key={item.key}><polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{normalized.map((row, index) => <circle key={index} cx={x(index)} cy={y(number(row[item.key]))} r="3.2" fill={item.color} />)}</g>;
      })}
    </svg>}
  </article>;
}

function TopPrincipals({ rows, loading }: { rows: PrincipalRow[]; loading: boolean }) {
  return <article className="freight-dashboard-card"><div className="freight-dashboard-card-head"><h3><UsersRound size={16} /> Top 5 Principals</h3><span>By jobs this month</span></div><div className="freight-dashboard-ranking">
    {loading ? <LoadingRows /> : rows.length ? rows.map((row, index) => <div className="freight-dashboard-rank" key={`${row.PRIN_CODE}-${index}`}><b>{index + 1}</b><div><div><strong title={row.PRIN_NAME}>{row.PRIN_NAME || row.PRIN_CODE || "-"}</strong><span>{number(row.JOB_COUNT)} jobs</span></div><i><span style={{ width: `${Math.min(100, number(row.SHARE_PERCENT))}%` }} /></i><small>{number(row.SHARE_PERCENT).toFixed(1)}% of month jobs</small></div></div>) : <EmptyState label="No jobs for the selected month" />}
  </div></article>;
}

function AttentionList({ rows, loading }: { rows: AttentionRow[]; loading: boolean }) {
  return <article className="freight-dashboard-card"><div className="freight-dashboard-card-head"><h3><CalendarDays size={16} /> Operations Attention</h3><span>Overdue and next 14 days</span></div><div className="freight-dashboard-attention">
    {loading ? <LoadingRows /> : rows.length ? rows.map((row, index) => { const Icon = row.MODE_CODE === "sea" ? Ship : row.MODE_CODE === "road" ? Truck : Plane; return <div key={`${row.REFERENCE_NO}-${index}`}><span className={`mode-${row.MODE_CODE || "air"}`}><Icon size={15} /></span><div><strong>{row.REFERENCE_NO || "-"}</strong><small title={row.PRIN_NAME}>{row.PRIN_NAME || "-"} · {row.ROUTE_LABEL || "-"}</small></div><time>{dateText(row.EVENT_DATE)}</time><b className={String(row.STATUS).toLowerCase() === "overdue" ? "is-overdue" : ""}>{row.STATUS || "Upcoming"}</b></div>; }) : <EmptyState label="No operations need attention" />}
  </div></article>;
}

function LoadingRows() { return <div className="freight-dashboard-list-loading"><Loader2 className="animate-spin" size={22} /></div>; }
function EmptyState({ label }: { label: string }) { return <div className="freight-dashboard-empty"><CheckCircle2 size={20} />{label}</div>; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function compact(value: number) { return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function dateText(value: unknown) { if (!value) return "-"; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); }
function yearOptions(current: number) { return Array.from({ length: 5 }, (_, index) => current - index); }
