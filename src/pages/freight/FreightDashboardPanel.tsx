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
import { useNavigate } from "react-router-dom";
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

type PrincipalRow = {
  PRIN_CODE?: string;
  PRIN_NAME?: string;
  JOB_COUNT?: number;
  SHARE_PERCENT?: number;
};

type AttentionRow = {
  REFERENCE_NO?: string;
  PRIN_NAME?: string;
  EVENT_DATE?: string;
  ROUTE_LABEL?: string;
  STATUS?: string;
  MODE_CODE?: string;
};

type CompanyOption = {
  company_code: string;
  company_name: string;
};

type DashboardData = {
  summary?: Summary;
  monthly?: MonthlyRow[];
  topPrincipals?: PrincipalRow[];
  attention?: AttentionRow[];
  availableYears?: number[];
  availableCompanies?: CompanyOption[];
  latestActiveMonth?: number;
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function FreightDashboardPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();

  const userRecord = (user || {}) as Record<string, unknown>;
  const defaultCompany = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");

  const [companyCode, setCompanyCode] = useState(defaultCompany);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAutoSelectedMonth, setHasAutoSelectedMonth] = useState(false);

  const companyList: CompanyOption[] = useMemo(() => {
    if (data.availableCompanies && data.availableCompanies.length > 0) {
      return data.availableCompanies;
    }
    const userCompanyName = String(userRecord.company_name || userRecord.COMPANY_NAME || defaultCompany);
    return [{ company_code: defaultCompany, company_name: userCompanyName }];
  }, [data.availableCompanies, defaultCompany, userRecord]);

  const activeCompanyName = useMemo(() => {
    const found = companyList.find(
      (c) => c.company_code.toUpperCase() === companyCode.toUpperCase()
    );
    return found ? found.company_name : companyCode;
  }, [companyList, companyCode]);

  const yearOptionsList = useMemo(() => {
    if (data.availableYears && data.availableYears.length > 0) {
      const set = new Set([...data.availableYears, now.getFullYear()]);
      return Array.from(set).sort((a, b) => b - a);
    }
    return Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  }, [data.availableYears, now]);

  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post<{
        success?: boolean;
        data?: DashboardData;
        message?: string;
        details?: string;
      }>("/api/freight/workspace/dashboard", {
        company_code: companyCode,
        user_id: userId,
        year,
        month,
      });

      const result = response.data.data || {};
      setData(result);

      // Auto-select latest active month on first load if current month has zero jobs
      if (!hasAutoSelectedMonth && result.latestActiveMonth && result.summary) {
        const curJobs = Number(result.summary.NEW_JOBS ?? 0);
        if (curJobs === 0 && result.latestActiveMonth !== month) {
          setMonth(result.latestActiveMonth);
          setHasAutoSelectedMonth(true);
        }
      }
    } catch (requestError: any) {
      setData({});
      setError(
        requestError?.response?.data?.details ||
        requestError?.response?.data?.message ||
        "Freight dashboard is not available."
      );
    } finally {
      setLoading(false);
    }
  }, [companyCode, hasAutoSelectedMonth, month, userId, year]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = data.summary || {};
  const monthlyRows = data.monthly || [];

  // Monthly activity map for dropdown hints
  const monthActivityMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of monthlyRows) {
      if (r.MONTH_NO) {
        map.set(Number(r.MONTH_NO), Number(r.JOBS ?? 0));
      }
    }
    return map;
  }, [monthlyRows]);

  // Navigate helper
  const navigateTo = (path: string) => {
    navigate(`/workspace/fms/${path.replace(/^\/+/, "")}`);
  };

  // 1. Commercial Pipeline Cards
  const commercialCards: MetricProps[] = [
    metric("Enquiries", summary.ENQUIRIES, summary.PREV_ENQUIRIES, ClipboardList, "blue", "Sales enquiries", () =>
      navigateTo("freight/request_quote/enquiry")
    ),
    metric("Requests for quotation", summary.RFQS, summary.PREV_RFQS, FileText, "violet", "RFQs received", () =>
      navigateTo("freight/request_quote/rfq")
    ),
    metric("Quotations", summary.QUOTATIONS, summary.PREV_QUOTATIONS, FileCheck2, "teal", "Customer quotes", () =>
      navigateTo("freight/freight_quotation/quotation")
    ),
    metric("New jobs", summary.NEW_JOBS, summary.PREV_NEW_JOBS, BriefcaseBusiness, "amber", "Booked jobs", () =>
      navigateTo("freight/job_summary/freight_job")
    ),
  ];

  // 2. Job Operations Cards
  const operationCards: MetricProps[] = [
    {
      title: "Open jobs",
      value: number(summary.OPEN_JOBS),
      icon: BriefcaseBusiness,
      tone: "blue",
      caption: "Current workload",
      onClick: () => navigateTo("freight/job_summary/freight_job"),
    },
    {
      title: "Completed",
      value: number(summary.COMPLETED_JOBS),
      icon: CheckCircle2,
      tone: "green",
      caption: months[month - 1],
      onClick: () => navigateTo("freight/job_summary/freight_job"),
    },
    {
      title: "Invoiced",
      value: number(summary.INVOICED_JOBS),
      icon: FileCheck2,
      tone: "teal",
      caption: months[month - 1],
      onClick: () => navigateTo("freight/freight_invoice/invoice"),
    },
    {
      title: "Overdue operations",
      value: number(summary.OVERDUE_JOBS),
      icon: AlertTriangle,
      tone: "red",
      caption: "Needs attention",
      onClick: () => navigateTo("freight/job_summary/freight_job"),
    },
  ];

  // 3. Transport Mode Mix Cards
  const hasOtherJobs = Number(summary.OTHER_JOBS ?? 0) > 0;
  const modeCards: MetricProps[] = [
    {
      title: "Air freight",
      value: number(summary.AIR_JOBS),
      icon: Plane,
      tone: "blue",
      caption: `Jobs in ${months[month - 1]}`,
      onClick: () => navigateTo("freight/freight_air/import"),
    },
    {
      title: "Sea freight",
      value: number(summary.SEA_JOBS),
      icon: Ship,
      tone: "teal",
      caption: `Jobs in ${months[month - 1]}`,
      onClick: () => navigateTo("freight/freight_sea/import"),
    },
    {
      title: "Road freight",
      value: number(summary.ROAD_JOBS),
      icon: Truck,
      tone: "amber",
      caption: `Jobs in ${months[month - 1]}`,
      onClick: () => navigateTo("freight/freight_road/import"),
    },
    ...(hasOtherJobs
      ? [
          {
            title: "Other freight",
            value: number(summary.OTHER_JOBS),
            icon: BriefcaseBusiness,
            tone: "violet",
            caption: `Jobs in ${months[month - 1]}`,
            onClick: () => navigateTo("freight/job_summary/freight_job"),
          },
        ]
      : []),
  ];

  return (
    <div className="freight-dashboard">
      <header className="freight-dashboard-header">
        <div>
          <h1>Freight Dashboard</h1>
          <p>Operational overview for {activeCompanyName}</p>
        </div>
        <div className="freight-dashboard-filters">
          <label>
            <span>Company</span>
            {companyList.length > 1 ? (
              <select
                value={companyCode}
                onChange={(event) => setCompanyCode(event.target.value)}
                className="freight-company-select"
              >
                {companyList.map((c) => (
                  <option key={c.company_code} value={c.company_code}>
                    {c.company_name} ({c.company_code})
                  </option>
                ))}
              </select>
            ) : (
              <strong>
                <BriefcaseBusiness size={14} />
                {activeCompanyName}
              </strong>
            )}
          </label>
          <label>
            <span>Year</span>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {yearOptionsList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Month</span>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {months.map((item, index) => {
                const monthNo = index + 1;
                const jobCnt = monthActivityMap.get(monthNo);
                return (
                  <option key={item} value={monthNo}>
                    {item} {jobCnt !== undefined && jobCnt > 0 ? `(${jobCnt})` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            title="Refresh dashboard"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      {error && (
        <div className="freight-dashboard-error">
          <AlertTriangle size={15} />
          {error}
          <button type="button" onClick={() => void loadDashboard()}>
            Try again
          </button>
        </div>
      )}

      {/* 1. Commercial Pipeline Section */}
      <DashboardSection title="Commercial Pipeline">
        <div className="freight-dashboard-kpis">
          {commercialCards.map((item) => (
            <MetricCard key={item.title} {...item} loading={loading} />
          ))}
        </div>
      </DashboardSection>

      {/* 2. Job Operations Section */}
      <DashboardSection title="Job Operations">
        <div className="freight-dashboard-kpis">
          {operationCards.map((item) => (
            <MetricCard key={item.title} {...item} loading={loading} />
          ))}
        </div>
      </DashboardSection>

      {/* 3. Transport Mode Mix Section */}
      <DashboardSection title="Transport Mode Mix">
        <div
          className={`freight-dashboard-kpis ${
            hasOtherJobs ? "" : "freight-dashboard-kpis-three"
          }`}
        >
          {modeCards.map((item) => (
            <MetricCard key={item.title} {...item} loading={loading} />
          ))}
        </div>
      </DashboardSection>

      {/* 4. Interactive Trend Charts Grid */}
      <div className="freight-dashboard-chart-grid">
        <InteractiveTrendChart
          title={`Jobs by Month (${year})`}
          rows={monthlyRows}
          selectedMonth={month}
          series={[
            { key: "JOBS", label: "New jobs", color: "#00378C" },
            { key: "COMPLETED", label: "Completed", color: "#10b981" },
          ]}
          loading={loading}
        />
        <InteractiveTrendChart
          title={`Commercial Pipeline by Month (${year})`}
          rows={monthlyRows}
          selectedMonth={month}
          series={[
            { key: "ENQUIRIES", label: "Enquiries", color: "#00378C" },
            { key: "RFQS", label: "RFQ", color: "#7c3aed" },
            { key: "QUOTATIONS", label: "Quotations", color: "#f59e0b" },
          ]}
          loading={loading}
        />
      </div>

      {/* 5. Top Principals and Operations Attention */}
      <div className="freight-dashboard-panel-grid">
        <TopPrincipals
          rows={data.topPrincipals || []}
          monthLabel={months[month - 1]}
          loading={loading}
          onSelectPrincipal={(row) => {
            const prinCode = row.PRIN_CODE || "";
            if (prinCode) {
              navigateTo(`freight/job_summary/freight_job?prin=${encodeURIComponent(prinCode)}`);
            }
          }}
        />
        <AttentionList
          rows={data.attention || []}
          loading={loading}
          onSelectJob={(row) => {
            const jobNo = row.REFERENCE_NO || "";
            if (jobNo) {
              const mode = String(row.MODE_CODE || "").toLowerCase();
              const subPath = mode === "sea" ? "freight_sea/import" : mode === "road" ? "freight_road/import" : "freight_air/import";
              navigateTo(`freight/${subPath}?open=${encodeURIComponent(jobNo)}`);
            }
          }}
        />
      </div>
    </div>
  );
}

function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="freight-dashboard-section">
      <div className="freight-dashboard-section-title">
        <span /> <h2>{title}</h2> <span />
      </div>
      {children}
    </section>
  );
}

type MetricProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  previous?: number;
  change?: number | null;
  caption?: string;
  onClick?: () => void;
};

function metric(
  title: string,
  current: unknown,
  previous: unknown,
  icon: LucideIcon,
  tone: string,
  caption?: string,
  onClick?: () => void
): MetricProps {
  const value = number(current);
  const prior = number(previous);
  return {
    title,
    value,
    previous: prior,
    change:
      prior === 0
        ? value > 0
          ? null
          : 0
        : ((value - prior) / prior) * 100,
    icon,
    tone,
    caption,
    onClick,
  };
}

function MetricCard({
  title,
  value,
  previous,
  change,
  caption,
  icon: Icon,
  tone,
  loading,
  onClick,
}: MetricProps & { loading: boolean }) {
  return (
    <article
      className={`freight-dashboard-kpi tone-${tone} ${onClick ? "is-clickable" : ""}`}
      onClick={onClick}
      title={onClick ? `View ${title}` : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="freight-dashboard-kpi-top">
        <span>{title}</span>
        <i>
          <Icon size={16} />
        </i>
      </div>
      <strong>
        {loading ? <em className="freight-dashboard-skeleton" /> : value.toLocaleString()}
      </strong>
      <div className="freight-dashboard-kpi-foot">
        {change === null ? (
          <b className="is-up">
            <ArrowUpRight size={13} /> New
          </b>
        ) : change !== undefined && previous !== undefined && previous > 0 ? (
          <b className={change >= 0 ? "is-up" : "is-down"}>
            {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}%
          </b>
        ) : (
          <span>{caption}</span>
        )}
        {previous !== undefined && previous > 0 && <span>Prev {previous.toLocaleString()}</span>}
        {(previous === undefined || previous === 0) && <span>{caption}</span>}
      </div>
    </article>
  );
}

type Series = { key: keyof MonthlyRow; label: string; color: string };

function InteractiveTrendChart({
  title,
  rows,
  series,
  selectedMonth,
  loading,
}: {
  title: string;
  rows: MonthlyRow[];
  series: Series[];
  selectedMonth: number;
  loading: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const normalized = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const found = rows.find((row) => Number(row.MONTH_NO) === index + 1);
        return (
          found || {
            MONTH_NO: index + 1,
            MONTH_LABEL: months[index].slice(0, 3),
          }
        );
      }),
    [rows]
  );

  const max = Math.max(1, ...normalized.flatMap((row) => series.map((item) => number(row[item.key]))));
  const peakVal = Math.max(...normalized.flatMap((row) => series.map((item) => number(row[item.key]))));

  const width = 720;
  const height = 235;
  const left = 38;
  const right = 20;
  const top = 25;
  const bottom = 35;

  const x = (index: number) => left + index * ((width - left - right) / 11);
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);

  const activeIdx = hoverIndex !== null ? hoverIndex : selectedMonth - 1;
  const activeMonthData = normalized[activeIdx] || normalized[0];

  return (
    <article className="freight-dashboard-card freight-dashboard-chart">
      <div className="freight-dashboard-card-head">
        <h3>{title}</h3>
        <div className="flex items-center gap-3">
          {peakVal > 0 && (
            <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              Peak: {peakVal.toLocaleString()}
            </span>
          )}
          <div className="flex items-center gap-2">
            {series.map((item) => (
              <span key={item.key} className="flex items-center gap-1.5 text-xs font-medium">
                <i style={{ background: item.color }} className="inline-block w-2 h-2 rounded-full" />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="freight-dashboard-chart-loading">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={title}
            className="w-full select-none"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={left}
                x2={width - right}
                y1={y(max * ratio)}
                y2={y(max * ratio)}
                className="chart-gridline"
              />
            ))}

            {/* Y-Axis Labels */}
            {[0, 0.5, 1].map((ratio) => (
              <text
                key={ratio}
                x={left - 8}
                y={y(max * ratio) + 4}
                textAnchor="end"
                className="chart-axis font-mono"
              >
                {compact(max * ratio)}
              </text>
            ))}

            {/* X-Axis Month Labels */}
            {normalized.map((row, index) => {
              const isSelected = index + 1 === selectedMonth;
              const isHovered = index === hoverIndex;
              return (
                <text
                  key={index}
                  x={x(index)}
                  y={height - 10}
                  textAnchor="middle"
                  className={`chart-axis ${
                    isSelected ? "font-bold fill-[#00378C]" : isHovered ? "font-bold fill-slate-900" : ""
                  }`}
                >
                  {row.MONTH_LABEL}
                </text>
              );
            })}

            {/* Vertical hover / selected guide */}
            {activeIdx !== null && (
              <line
                x1={x(activeIdx)}
                x2={x(activeIdx)}
                y1={top}
                y2={height - bottom}
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            )}

            {/* Series Lines and Circles */}
            {series.map((item) => {
              const points = normalized
                .map((row, index) => `${x(index)},${y(number(row[item.key]))}`)
                .join(" ");
              return (
                <g key={item.key}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {normalized.map((row, index) => {
                    const isActive = index === activeIdx;
                    const val = number(row[item.key]);
                    return (
                      <circle
                        key={index}
                        cx={x(index)}
                        cy={y(val)}
                        r={isActive ? 5 : 3.2}
                        fill={item.color}
                        stroke="#ffffff"
                        strokeWidth={isActive ? 2 : 1}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Mouse hover detection columns */}
            {normalized.map((_, index) => (
              <rect
                key={index}
                x={x(index) - (width - left - right) / 22}
                y={top}
                width={(width - left - right) / 11}
                height={height - top - bottom}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(index)}
              />
            ))}
          </svg>

          {/* Dynamic interactive tooltip banner */}
          <div className="freight-chart-tooltip-bar flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {months[activeIdx]}
            </span>
            <div className="flex items-center gap-3">
              {series.map((item) => {
                const val = number(activeMonthData[item.key]);
                return (
                  <span key={item.key} className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <i style={{ background: item.color }} className="inline-block w-2 h-2 rounded-full" />
                    {item.label}: <strong className="text-slate-900 dark:text-slate-100">{val.toLocaleString()}</strong>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function TopPrincipals({
  rows,
  monthLabel,
  loading,
  onSelectPrincipal,
}: {
  rows: PrincipalRow[];
  monthLabel: string;
  loading: boolean;
  onSelectPrincipal?: (row: PrincipalRow) => void;
}) {
  return (
    <article className="freight-dashboard-card">
      <div className="freight-dashboard-card-head">
        <h3>
          <UsersRound size={16} /> Top 5 Principals
        </h3>
        <span>Jobs in {monthLabel}</span>
      </div>
      <div className="freight-dashboard-ranking">
        {loading ? (
          <LoadingRows />
        ) : rows.length ? (
          rows.map((row, index) => (
            <div
              className={`freight-dashboard-rank ${onSelectPrincipal ? "is-clickable" : ""}`}
              key={`${row.PRIN_CODE}-${index}`}
              onClick={() => onSelectPrincipal?.(row)}
              title={onSelectPrincipal ? `Filter jobs for ${row.PRIN_NAME || row.PRIN_CODE}` : undefined}
            >
              <b>{index + 1}</b>
              <div>
                <div>
                  <strong title={row.PRIN_NAME}>{row.PRIN_NAME || row.PRIN_CODE || "-"}</strong>
                  <span>{number(row.JOB_COUNT)} jobs</span>
                </div>
                <i>
                  <span style={{ width: `${Math.min(100, Math.max(4, number(row.SHARE_PERCENT)))}%` }} />
                </i>
                <small>{number(row.SHARE_PERCENT).toFixed(1)}% of month jobs</small>
              </div>
            </div>
          ))
        ) : (
          <EmptyState label={`No jobs recorded for ${monthLabel}`} />
        )}
      </div>
    </article>
  );
}

function AttentionList({
  rows,
  loading,
  onSelectJob,
}: {
  rows: AttentionRow[];
  loading: boolean;
  onSelectJob?: (row: AttentionRow) => void;
}) {
  return (
    <article className="freight-dashboard-card">
      <div className="freight-dashboard-card-head">
        <h3>
          <CalendarDays size={16} /> Operations Attention
        </h3>
        <span>Overdue & next 14 days</span>
      </div>
      <div className="freight-dashboard-attention">
        {loading ? (
          <LoadingRows />
        ) : rows.length ? (
          rows.map((row, index) => {
            const Icon =
              row.MODE_CODE === "sea"
                ? Ship
                : row.MODE_CODE === "road"
                ? Truck
                : Plane;
            const isOverdue = String(row.STATUS).toLowerCase() === "overdue";
            return (
              <div
                key={`${row.REFERENCE_NO}-${index}`}
                className={onSelectJob ? "is-clickable" : ""}
                onClick={() => onSelectJob?.(row)}
                title={onSelectJob ? `Open job ${row.REFERENCE_NO}` : undefined}
              >
                <span className={`mode-${row.MODE_CODE || "air"}`}>
                  <Icon size={15} />
                </span>
                <div>
                  <strong>{row.REFERENCE_NO || "-"}</strong>
                  <small title={row.PRIN_NAME}>
                    {row.PRIN_NAME || "-"} · {row.ROUTE_LABEL || "-"}
                  </small>
                </div>
                <time>{dateText(row.EVENT_DATE)}</time>
                <b className={isOverdue ? "is-overdue" : ""}>
                  {row.STATUS || "Upcoming"}
                </b>
              </div>
            );
          })
        ) : (
          <EmptyState label="No operations currently need attention" />
        )}
      </div>
    </article>
  );
}

function LoadingRows() {
  return (
    <div className="freight-dashboard-list-loading">
      <Loader2 className="animate-spin" size={22} />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="freight-dashboard-empty">
      <CheckCircle2 size={20} />
      {label}
    </div>
  );
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compact(value: number) {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dateText(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
