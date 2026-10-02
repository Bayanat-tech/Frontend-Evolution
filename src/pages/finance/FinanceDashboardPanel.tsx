import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Layers,
  Loader2,
  Receipt,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";

type Summary = {
  SALES_INVOICE_COUNT?: number;
  SALES_INVOICE_AMOUNT?: number;
  PREV_SALES_INVOICE_AMOUNT?: number;
  PURCHASE_INVOICE_COUNT?: number;
  PURCHASE_INVOICE_AMOUNT?: number;
  PREV_PURCHASE_INVOICE_AMOUNT?: number;

  BANK_PAYMENT_COUNT?: number;
  BANK_PAYMENT_AMOUNT?: number;
  PREV_BANK_PAYMENT_AMOUNT?: number;
  BANK_RECEIPT_COUNT?: number;
  BANK_RECEIPT_AMOUNT?: number;
  PREV_BANK_RECEIPT_AMOUNT?: number;
  CASH_PAYMENT_COUNT?: number;
  CASH_PAYMENT_AMOUNT?: number;
  PREV_CASH_PAYMENT_AMOUNT?: number;
  CASH_RECEIPT_COUNT?: number;
  CASH_RECEIPT_AMOUNT?: number;
  PREV_CASH_RECEIPT_AMOUNT?: number;

  CREDIT_NOTE_COUNT?: number;
  CREDIT_NOTE_AMOUNT?: number;
  DEBIT_NOTE_COUNT?: number;
  DEBIT_NOTE_AMOUNT?: number;
  JOURNAL_VOUCHER_COUNT?: number;
  UNPOSTED_JOURNAL_COUNT?: number;

  TOTAL_INFLOW?: number;
  PREV_TOTAL_INFLOW?: number;
  TOTAL_OUTFLOW?: number;
  PREV_TOTAL_OUTFLOW?: number;
  NET_CASH_FLOW?: number;
  PREV_NET_CASH_FLOW?: number;
  TOTAL_CANCELED_COUNT?: number;
};

type MonthlyRow = {
  MONTH_NO?: number;
  MONTH_LABEL?: string;
  INFLOW?: number;
  OUTFLOW?: number;
  RECEIPTS?: number;
  PAYMENTS?: number;
  SALES_INVOICED?: number;
  PURCHASES_BILLED?: number;
  INVOICES_COUNT?: number;
  PAYMENTS_COUNT?: number;
  JOURNALS_COUNT?: number;
};

type PartyRow = {
  AC_NAME?: string;
  VOUCHER_COUNT?: number;
  TOTAL_AMOUNT?: number;
  SHARE_PERCENT?: number;
};

type AttentionRow = {
  DOC_TYPE?: string;
  DOC_NO?: string;
  DOC_DATE?: string;
  AC_NAME?: string;
  REMARKS?: string;
  REF_NO?: string;
  AMOUNT?: number;
  CANCELED?: string;
  DIV_CODE?: string;
};

type DashboardData = {
  company_code?: string;
  fy_period?: string;
  available_fy_periods?: string[];
  available_divisions?: Array<{ div_code: string; div_name?: string }>;
  summary?: Summary;
  monthly?: MonthlyRow[];
  topParties?: PartyRow[];
  attention?: AttentionRow[];
};

const months = [
  "All Months",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function FinanceDashboardPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const companyName = String(userRecord.company_name || userRecord.COMPANY_NAME || companyCode);
  const userId = String(userRecord.user_id || userRecord.USER_ID || userRecord.loginid || userRecord.LOGINID || "");

  const [fyPeriod, setFyPeriod] = useState<string>("");
  const [divCode, setDivCode] = useState<string>("All");
  const [month, setMonth] = useState<number>(0); // 0 = All Months
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.post<{ success?: boolean; data?: DashboardData; message?: string }>(
        "/api/finance/dashboard",
        {
          company_code: companyCode,
          user_id: userId,
          fy_period: fyPeriod || undefined,
          div_code: divCode !== "All" ? divCode : undefined,
          month: month > 0 ? month : undefined,
        }
      );
      if (response.data?.success && response.data?.data) {
        setData(response.data.data);
        if (!fyPeriod && response.data.data.fy_period) {
          setFyPeriod(response.data.data.fy_period);
        }
      } else {
        setData({});
        setError(response.data?.message || "Failed to load finance metrics.");
      }
    } catch (requestError: any) {
      setData({});
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.details ||
          "Finance dashboard is temporarily unavailable."
      );
    } finally {
      setLoading(false);
    }
  }, [companyCode, divCode, fyPeriod, month]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = data.summary || {};

  // Hero Overview Cards
  const netFlow = number(summary.NET_CASH_FLOW);
  const netFlowIsPositive = netFlow >= 0;

  // Commercial Cards
  const commercialCards: Array<ModuleCardProps> = [
    {
      title: "Sales Invoices (SI)",
      count: summary.SALES_INVOICE_COUNT,
      amount: summary.SALES_INVOICE_AMOUNT,
      prevAmount: summary.PREV_SALES_INVOICE_AMOUNT,
      icon: Receipt,
      tone: "green",
      route: "/workspace/finance/finance/accounts/transactions/sales",
      caption: "Billed Revenue",
    },
    {
      title: "Purchase Invoices (PI)",
      count: summary.PURCHASE_INVOICE_COUNT,
      amount: summary.PURCHASE_INVOICE_AMOUNT,
      prevAmount: summary.PREV_PURCHASE_INVOICE_AMOUNT,
      icon: FileText,
      tone: "amber",
      route: "/workspace/finance/finance/accounts/transactions/purchase",
      caption: "Payable Expenses",
    },
    {
      title: "Credit Notes (CN)",
      count: summary.CREDIT_NOTE_COUNT,
      amount: summary.CREDIT_NOTE_AMOUNT,
      icon: TrendingDown,
      tone: "red",
      route: "/workspace/finance/finance/accounts/transactions/credit-note",
      caption: "Sales Adjustments",
    },
    {
      title: "Debit Notes (DN)",
      count: summary.DEBIT_NOTE_COUNT,
      amount: summary.DEBIT_NOTE_AMOUNT,
      icon: TrendingUp,
      tone: "violet",
      route: "/workspace/finance/finance/accounts/transactions/debit-note",
      caption: "Purchase Adjustments",
    },
  ];

  // Treasury & Banking Cards
  const treasuryCards: Array<ModuleCardProps> = [
    {
      title: "Bank Receipts (BR)",
      count: summary.BANK_RECEIPT_COUNT,
      amount: summary.BANK_RECEIPT_AMOUNT,
      prevAmount: summary.PREV_BANK_RECEIPT_AMOUNT,
      icon: Landmark,
      tone: "blue",
      route: "/workspace/finance/finance/accounts/transactions/cheque-receipt",
      caption: "Bank Inflow",
    },
    {
      title: "Bank Payments (BP)",
      count: summary.BANK_PAYMENT_COUNT,
      amount: summary.BANK_PAYMENT_AMOUNT,
      prevAmount: summary.PREV_BANK_PAYMENT_AMOUNT,
      icon: CreditCard,
      tone: "red",
      route: "/workspace/finance/finance/accounts/transactions/cheque-payment",
      caption: "Bank Outflow",
    },
    {
      title: "Cash Receipts (CR)",
      count: summary.CASH_RECEIPT_COUNT,
      amount: summary.CASH_RECEIPT_AMOUNT,
      prevAmount: summary.PREV_CASH_RECEIPT_AMOUNT,
      icon: Banknote,
      tone: "teal",
      route: "/workspace/finance/finance/accounts/transactions/cash-receipt",
      caption: "Petty Inflow",
    },
    {
      title: "Cash Payments (CP)",
      count: summary.CASH_PAYMENT_COUNT,
      amount: summary.CASH_PAYMENT_AMOUNT,
      prevAmount: summary.PREV_CASH_PAYMENT_AMOUNT,
      icon: Wallet,
      tone: "amber",
      route: "/workspace/finance/finance/accounts/transactions/petty_cash_payment",
      caption: "Petty Outflow",
    },
  ];

  return (
    <div className="finance-dashboard">
      {/* Top Header */}
      <header className="finance-dashboard-header">
        <div>
          <h1>
            <Landmark size={24} className="text-[#00378C]" />
            Finance Dashboard
          </h1>
          <p>Invoicing, treasury, adjustments and recent activity for {companyName}</p>
        </div>

        {/* Filter Toolbar */}
        <div className="finance-dashboard-filters">
          <label>
            <span>Company</span>
            <strong>
              <Building2 size={13} />
              {companyName}
            </strong>
          </label>

          <label>
            <span>Fiscal Period</span>
            <select
              value={fyPeriod}
              onChange={(e) => setFyPeriod(e.target.value)}
              disabled={loading}
            >
              {(data.available_fy_periods || ["226"]).map((p) => (
                <option key={p} value={p}>
                  FY {p}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Division</span>
            <select
              className="finance-filter-division"
              value={divCode}
              onChange={(e) => setDivCode(e.target.value)}
              disabled={loading}
              title={
                divCode === "All"
                  ? "All Divisions"
                  : (data.available_divisions || []).find((d) => d.div_code === divCode)?.div_name ||
                    `Division ${divCode}`
              }
            >
              <option value="All">All Divisions</option>
              {(data.available_divisions || []).map((d) => {
                const label =
                  d.div_name &&
                  d.div_name.toLowerCase() !== `division ${d.div_code}`.toLowerCase() &&
                  d.div_name !== d.div_code
                    ? `${d.div_code} - ${d.div_name}`
                    : `Division ${d.div_code}`;
                return (
                  <option key={d.div_code} value={d.div_code} title={label}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            <span>Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              disabled={loading}
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            title="Refresh Finance Metrics"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      {/* Error state */}
      {error && (
        <div className="finance-dashboard-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard()}>
            Try again
          </button>
        </div>
      )}

      {/* Top 4 Hero Cards: Net Liquidity & Volume */}
      <section className="finance-dashboard-hero-kpis">
        <HeroCard
          title="Inflow & Revenue"
          value={number(summary.TOTAL_INFLOW)}
          prevValue={summary.PREV_TOTAL_INFLOW}
          icon={TrendingUp}
          tone="emerald"
          loading={loading}
          caption="Receipts and sales invoices"
        />

        <HeroCard
          title="Outflow & Purchases"
          value={number(summary.TOTAL_OUTFLOW)}
          prevValue={summary.PREV_TOTAL_OUTFLOW}
          icon={TrendingDown}
          tone="rose"
          loading={loading}
          caption="Payments and purchase invoices"
        />

        <HeroCard
          title="Net Cash Position"
          value={netFlow}
          prevValue={summary.PREV_NET_CASH_FLOW}
          icon={Scale}
          tone={netFlowIsPositive ? "emerald" : "rose"}
          loading={loading}
          caption="Treasury Liquidity"
          isBalance
        />

        <HeroCard
          title="Audit & Exceptions"
          value={number(summary.TOTAL_CANCELED_COUNT)}
          icon={AlertTriangle}
          tone="amber"
          loading={loading}
          caption={`${number(summary.UNPOSTED_JOURNAL_COUNT)} unposted JVs`}
          isCount
        />
      </section>

      {/* Commercial Documents Section */}
      <section className="finance-dashboard-section">
        <div className="finance-dashboard-section-title">
          <span />
          <h2>Commercial Documents</h2>
          <span />
        </div>
        <div className="finance-dashboard-kpis">
          {commercialCards.map((card) => (
            <ModuleCard key={card.title} {...card} loading={loading} onNavigate={navigate} />
          ))}
        </div>
      </section>

      {/* Treasury, Cash & Bank Section */}
      <section className="finance-dashboard-section">
        <div className="finance-dashboard-section-title">
          <span />
          <h2>Treasury, Cash &amp; Bank Operations</h2>
          <span />
        </div>
        <div className="finance-dashboard-kpis">
          {treasuryCards.map((card) => (
            <ModuleCard key={card.title} {...card} loading={loading} onNavigate={navigate} />
          ))}
        </div>
      </section>

      {/* Interactive Charts: 12-Month Liquidity & Activity Breakdown */}
      <div className="finance-dashboard-chart-grid">
        <CashFlowTrendChart
          title="Monthly Inflow vs Outflow"
          rows={data.monthly || []}
          loading={loading}
        />
        <ActivityMixChart
          title="Monthly Transaction Volume"
          rows={data.monthly || []}
          loading={loading}
        />
      </div>

      {/* Bottom Grid: Top Parties & Recent Attention Queue */}
      <div className="finance-dashboard-panel-grid">
        <TopPartiesPanel rows={data.topParties || []} loading={loading} />
        <AttentionQueuePanel rows={data.attention || []} loading={loading} onNavigate={navigate} />
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

type HeroCardProps = {
  title: string;
  value: number;
  prevValue?: number;
  icon: LucideIcon;
  tone: "emerald" | "rose" | "amber" | "indigo";
  loading: boolean;
  caption?: string;
  isBalance?: boolean;
  isCount?: boolean;
};

function HeroCard({
  title,
  value,
  prevValue,
  icon: Icon,
  tone,
  loading,
  caption,
  isBalance,
  isCount,
}: HeroCardProps) {
  const change =
    prevValue !== undefined && prevValue > 0
      ? ((value - prevValue) / prevValue) * 100
      : null;

  return (
    <article className={`finance-dashboard-hero-card tone-${tone}`}>
      <div className="finance-dashboard-hero-top">
        <span>{title}</span>
        <div className="finance-dashboard-hero-icon">
          <Icon size={16} />
        </div>
      </div>

      <div className="finance-dashboard-hero-value">
        {loading ? (
          <span className="finance-dashboard-skeleton" />
        ) : isCount ? (
          value.toLocaleString()
        ) : (
          formatCurrency(value, isBalance)
        )}
      </div>

      <div className="finance-dashboard-hero-foot">
        {change !== null && Number.isFinite(change) ? (
          <b className={change >= 0 ? "is-up" : "is-down"}>
            {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}% vs prev
          </b>
        ) : (
          <span>{caption || "Current period"}</span>
        )}
        {prevValue !== undefined && prevValue > 0 && !isCount && (
          <span>Prev: {compactNumber(prevValue)} OMR</span>
        )}
      </div>
    </article>
  );
}

type ModuleCardProps = {
  title: string;
  count?: number;
  amount?: number;
  prevAmount?: number;
  icon: LucideIcon;
  tone: string;
  route: string;
  caption?: string;
  loading?: boolean;
  onNavigate?: (route: string) => void;
};

function ModuleCard({
  title,
  count,
  amount,
  prevAmount,
  icon: Icon,
  tone,
  route,
  caption,
  loading,
  onNavigate,
}: ModuleCardProps) {
  const amt = number(amount);
  const cnt = number(count);
  const change =
    prevAmount !== undefined && prevAmount > 0
      ? ((amt - prevAmount) / prevAmount) * 100
      : null;

  return (
    <article
      className={`finance-dashboard-kpi tone-${tone}`}
      onClick={() => onNavigate?.(route)}
      title={`Open ${title} module`}
    >
      <div className="finance-dashboard-kpi-top">
        <span>{title}</span>
        <i>
          <Icon size={14} />
        </i>
      </div>

      <strong>
        {loading ? (
          <span className="finance-dashboard-skeleton" />
        ) : (
          formatCurrency(amt)
        )}
      </strong>

      <div className="finance-dashboard-kpi-foot">
        <span className="finance-dashboard-kpi-badge">
          {cnt.toLocaleString()} vouchers
        </span>
        {change !== null && Number.isFinite(change) ? (
          <span className={change >= 0 ? "text-[#059669] font-bold" : "text-[#dc2626] font-bold"}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        ) : (
          <span>{caption}</span>
        )}
      </div>
    </article>
  );
}

// ─── Interactive SVG Chart 1: Cash Flow Inflow vs Outflow ─────────────────────

function CashFlowTrendChart({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: MonthlyRow[];
  loading: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const normalized = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNo = i + 1;
      const found = rows.find((r) => Number(r.MONTH_NO) === monthNo);
      return (
        found || {
          MONTH_NO: monthNo,
          MONTH_LABEL: (months[monthNo]?.slice(0, 3) || `M${monthNo}`).toUpperCase(),
          INFLOW: 0,
          OUTFLOW: 0,
          RECEIPTS: 0,
          PAYMENTS: 0,
        }
      );
    });
  }, [rows]);

  const maxVal = Math.max(
    1000,
    ...normalized.flatMap((r) => [number(r.INFLOW), number(r.OUTFLOW)])
  );

  const width = 640;
  const height = 230;
  const left = 55;
  const right = 20;
  const top = 22;
  const bottom = 32;

  const getX = (idx: number) => left + idx * ((width - left - right) / 11);
  const getY = (val: number) => top + (height - top - bottom) * (1 - Math.min(1, Math.max(0, val / maxVal)));
  const baseY = getY(0);

  const inflowPoints = normalized.map((r, i) => `${getX(i)},${getY(number(r.INFLOW))}`).join(" ");
  const outflowPoints = normalized.map((r, i) => `${getX(i)},${getY(number(r.OUTFLOW))}`).join(" ");

  const inflowArea = `${getX(0)},${baseY} ${inflowPoints} ${getX(11)},${baseY}`;
  const outflowArea = `${getX(0)},${baseY} ${outflowPoints} ${getX(11)},${baseY}`;

  const hoveredRow = hoverIndex !== null ? normalized[hoverIndex] : null;

  return (
    <article className="finance-dashboard-card finance-dashboard-chart">
      <div className="finance-dashboard-card-head">
        <h3>
          <TrendingUp size={15} className="finance-card-icon" />
          {title}
        </h3>
        <div className="finance-dashboard-card-legend">
          <span>
            <i style={{ background: "#00378C" }} />
            Inflow
          </span>
          <span>
            <i style={{ background: "#e11d48" }} />
            Outflow
          </span>
        </div>
      </div>

      {loading ? (
        <div className="finance-dashboard-empty">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading trend data...</span>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <svg
            className="finance-trend-svg"
            viewBox={`0 0 ${width} ${height}`}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="finInflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00378C" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#00378C" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="finOutflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e11d48" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Subtle Gridlines & Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const yPos = getY(maxVal * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={left}
                    x2={width - right}
                    y1={yPos}
                    y2={yPos}
                    className="chart-gridline"
                  />
                  <text
                    x={left - 8}
                    y={yPos + 3.5}
                    textAnchor="end"
                    className="chart-axis"
                  >
                    {compactNumber(maxVal * ratio)}
                  </text>
                </g>
              );
            })}

            {/* X-axis Month Labels */}
            {normalized.map((r, i) => (
              <text
                key={i}
                x={getX(i)}
                y={height - 10}
                textAnchor="middle"
                className="chart-axis"
                fontWeight={hoverIndex === i ? "700" : "500"}
                fill={hoverIndex === i ? "#00378C" : "#64748b"}
              >
                {r.MONTH_LABEL}
              </text>
            ))}

            {/* Gradient Area Fills */}
            <polygon points={inflowArea} fill="url(#finInflowGrad)" />
            <polygon points={outflowArea} fill="url(#finOutflowGrad)" />

            {/* Inflow Polylines (Corporate Blue) */}
            <polyline
              points={inflowPoints}
              fill="none"
              stroke="#00378C"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {normalized.map((r, i) => (
              <circle
                key={`inflow-${i}`}
                cx={getX(i)}
                cy={getY(number(r.INFLOW))}
                r={hoverIndex === i ? "5" : "3.5"}
                fill="#00378C"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            ))}

            {/* Outflow Polylines (Rose/Red) */}
            <polyline
              points={outflowPoints}
              fill="none"
              stroke="#e11d48"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {normalized.map((r, i) => (
              <circle
                key={`outflow-${i}`}
                cx={getX(i)}
                cy={getY(number(r.OUTFLOW))}
                r={hoverIndex === i ? "5" : "3.5"}
                fill="#e11d48"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            ))}

            {/* Hover guideline */}
            {hoverIndex !== null && (
              <line
                x1={getX(hoverIndex)}
                x2={getX(hoverIndex)}
                y1={top}
                y2={height - bottom}
                stroke="#00378C"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            )}

            {/* Hover catcher rects */}
            {normalized.map((_, i) => {
              const xPos = getX(i) - 20;
              return (
                <rect
                  key={`hit-${i}`}
                  x={xPos}
                  y={top}
                  width="40"
                  height={height - top - bottom}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredRow && hoverIndex !== null && (
            <div
              className="finance-chart-tooltip-box"
              style={{
                position: "absolute",
                top: 10,
                left: Math.min(width - 210, Math.max(left, getX(hoverIndex) - 85)),
              }}
            >
              <strong style={{ fontSize: "10.5px" }}>{months[hoverIndex + 1]}</strong>
              <div style={{ display: "flex", gap: "10px", marginTop: "3px" }}>
                <span style={{ color: "#93c5fd" }}>
                  Inflow: {number(hoveredRow.INFLOW).toLocaleString()} OMR
                </span>
                <span style={{ color: "#fda4af" }}>
                  Outflow: {number(hoveredRow.OUTFLOW).toLocaleString()} OMR
                </span>
              </div>
              <div style={{ marginTop: "2px", fontSize: "9px", color: number(hoveredRow.INFLOW) >= number(hoveredRow.OUTFLOW) ? "#86efac" : "#fca5a5" }}>
                Net: {(number(hoveredRow.INFLOW) - number(hoveredRow.OUTFLOW)).toLocaleString()} OMR
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Interactive SVG Chart 2: Transaction Mix Distribution ───────────────────

function ActivityMixChart({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: MonthlyRow[];
  loading: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const normalized = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNo = i + 1;
      const found = rows.find((r) => Number(r.MONTH_NO) === monthNo);
      return (
        found || {
          MONTH_NO: monthNo,
          MONTH_LABEL: (months[monthNo]?.slice(0, 3) || `M${monthNo}`).toUpperCase(),
          INVOICES_COUNT: 0,
          PAYMENTS_COUNT: 0,
          JOURNALS_COUNT: 0,
        }
      );
    });
  }, [rows]);

  const maxVal = Math.max(
    10,
    ...normalized.flatMap((r) => [
      number(r.INVOICES_COUNT),
      number(r.PAYMENTS_COUNT),
      number(r.JOURNALS_COUNT),
    ])
  );

  const width = 640;
  const height = 230;
  const left = 45;
  const right = 20;
  const top = 22;
  const bottom = 32;

  const getX = (idx: number) => left + idx * ((width - left - right) / 11);
  const getY = (val: number) => top + (height - top - bottom) * (1 - Math.min(1, Math.max(0, val / maxVal)));

  const invoicesPoints = normalized.map((r, i) => `${getX(i)},${getY(number(r.INVOICES_COUNT))}`).join(" ");
  const paymentsPoints = normalized.map((r, i) => `${getX(i)},${getY(number(r.PAYMENTS_COUNT))}`).join(" ");
  const journalsPoints = normalized.map((r, i) => `${getX(i)},${getY(number(r.JOURNALS_COUNT))}`).join(" ");

  const hoveredRow = hoverIndex !== null ? normalized[hoverIndex] : null;

  return (
    <article className="finance-dashboard-card finance-dashboard-chart">
      <div className="finance-dashboard-card-head">
        <h3>
          <Layers size={15} className="finance-card-icon" />
          {title}
        </h3>
        <div className="finance-dashboard-card-legend">
          <span>
            <i style={{ background: "#059669" }} />
            Invoices
          </span>
          <span>
            <i style={{ background: "#d97706" }} />
            Payments
          </span>
          <span>
            <i style={{ background: "#4f46e5" }} />
            Journals
          </span>
        </div>
      </div>

      {loading ? (
        <div className="finance-dashboard-empty">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading volume metrics...</span>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <svg
            className="finance-trend-svg"
            viewBox={`0 0 ${width} ${height}`}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Gridlines */}
            {[0, 0.5, 1].map((ratio) => {
              const yPos = getY(maxVal * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1={left}
                    x2={width - right}
                    y1={yPos}
                    y2={yPos}
                    className="chart-gridline"
                  />
                  <text
                    x={left - 8}
                    y={yPos + 3.5}
                    textAnchor="end"
                    className="chart-axis"
                  >
                    {Math.round(maxVal * ratio)}
                  </text>
                </g>
              );
            })}

            {/* X-axis Labels */}
            {normalized.map((r, i) => (
              <text
                key={i}
                x={getX(i)}
                y={height - 10}
                textAnchor="middle"
                className="chart-axis"
                fontWeight={hoverIndex === i ? "700" : "500"}
                fill={hoverIndex === i ? "#00378C" : "#64748b"}
              >
                {r.MONTH_LABEL}
              </text>
            ))}

            {/* Invoices Line (Emerald) */}
            <polyline
              points={invoicesPoints}
              fill="none"
              stroke="#059669"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Payments Line (Amber) */}
            <polyline
              points={paymentsPoints}
              fill="none"
              stroke="#d97706"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Journals Line (Indigo) */}
            <polyline
              points={journalsPoints}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Data point dots */}
            {normalized.map((r, i) => (
              <g key={`pts-${i}`}>
                <circle
                  cx={getX(i)}
                  cy={getY(number(r.INVOICES_COUNT))}
                  r={hoverIndex === i ? "4.5" : "3"}
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={getX(i)}
                  cy={getY(number(r.PAYMENTS_COUNT))}
                  r={hoverIndex === i ? "4.5" : "3"}
                  fill="#d97706"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={getX(i)}
                  cy={getY(number(r.JOURNALS_COUNT))}
                  r={hoverIndex === i ? "4.5" : "3"}
                  fill="#4f46e5"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            ))}

            {/* Hover guideline */}
            {hoverIndex !== null && (
              <line
                x1={getX(hoverIndex)}
                x2={getX(hoverIndex)}
                y1={top}
                y2={height - bottom}
                stroke="#00378C"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            )}

            {/* Hover catcher rects */}
            {normalized.map((_, i) => {
              const xPos = getX(i) - 20;
              return (
                <rect
                  key={`hit-${i}`}
                  x={xPos}
                  y={top}
                  width="40"
                  height={height - top - bottom}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredRow && hoverIndex !== null && (
            <div
              className="finance-chart-tooltip-box"
              style={{
                position: "absolute",
                top: 10,
                left: Math.min(width - 220, Math.max(left, getX(hoverIndex) - 95)),
              }}
            >
              <strong style={{ fontSize: "10.5px" }}>{months[hoverIndex + 1]}</strong>
              <div style={{ display: "flex", gap: "10px", marginTop: "3px" }}>
                <span style={{ color: "#6ee7b7" }}>
                  Invoices: {number(hoveredRow.INVOICES_COUNT).toLocaleString()}
                </span>
                <span style={{ color: "#fcd34d" }}>
                  Payments: {number(hoveredRow.PAYMENTS_COUNT).toLocaleString()}
                </span>
                <span style={{ color: "#a5b4fc" }}>
                  Journals: {number(hoveredRow.JOURNALS_COUNT).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Bottom Panels: Top Parties & Attention Queue ─────────────────────────────

function TopPartiesPanel({ rows, loading }: { rows: PartyRow[]; loading: boolean }) {
  return (
    <article className="finance-dashboard-card">
      <div className="finance-dashboard-card-head">
        <h3>
          <Users size={15} className="finance-card-icon" />
          Top 5 Account Parties
        </h3>
        <span>By transaction turnover</span>
      </div>

      <div className="finance-dashboard-ranking">
        {loading ? (
          <div className="finance-dashboard-empty">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : rows.length > 0 ? (
          rows.map((row, idx) => (
            <div className="finance-dashboard-rank" key={idx}>
              <b>{idx + 1}</b>
              <div>
                <div>
                  <strong title={row.AC_NAME}>{row.AC_NAME}</strong>
                  <span>{formatCurrency(number(row.TOTAL_AMOUNT))}</span>
                </div>
                <i>
                  <span style={{ width: `${Math.min(100, number(row.SHARE_PERCENT))}%` }} />
                </i>
                <small>
                  {number(row.VOUCHER_COUNT)} vouchers &middot;{" "}
                  {number(row.SHARE_PERCENT).toFixed(1)}% of top volume
                </small>
              </div>
            </div>
          ))
        ) : (
          <div className="finance-dashboard-empty">
            <CheckCircle2 size={18} />
            <span>No transaction parties found</span>
          </div>
        )}
      </div>
    </article>
  );
}

function AttentionQueuePanel({
  rows,
  loading,
  onNavigate,
}: {
  rows: AttentionRow[];
  loading: boolean;
  onNavigate: (route: string) => void;
}) {
  const getDocRoute = (docType: string) => {
    switch (docType?.toUpperCase()) {
      case "SI":
        return "/workspace/finance/finance/accounts/transactions/sales";
      case "PI":
        return "/workspace/finance/finance/accounts/transactions/purchase";
      case "BP":
        return "/workspace/finance/finance/accounts/transactions/cheque-payment";
      case "BR":
        return "/workspace/finance/finance/accounts/transactions/cheque-receipt";
      case "CP":
        return "/workspace/finance/finance/accounts/transactions/petty_cash_payment";
      case "CR":
        return "/workspace/finance/finance/accounts/transactions/cash-receipt";
      case "JV":
        return "/workspace/finance/finance/accounts/transactions/journal";
      case "CN":
        return "/workspace/finance/finance/accounts/transactions/credit-note";
      case "DN":
        return "/workspace/finance/finance/accounts/transactions/debit-note";
      default:
        return "/workspace/finance/finance/accounts/transactions/sales";
    }
  };

  return (
    <article className="finance-dashboard-card">
      <div className="finance-dashboard-card-head">
        <h3>
          <CalendarDays size={15} className="finance-card-icon" />
          Recent Transaction Activity &amp; Queue
        </h3>
        <span>Latest registered vouchers</span>
      </div>

      <div className="finance-dashboard-attention">
        {loading ? (
          <div className="finance-dashboard-empty">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : rows.length > 0 ? (
          rows.map((row, idx) => {
            const dt = (row.DOC_TYPE || "").toLowerCase();
            const route = getDocRoute(row.DOC_TYPE || "");
            const isCanceled = row.CANCELED === "Y";

            return (
              <div className="finance-dashboard-attention-row" key={idx}>
                <span className={`finance-dashboard-type-pill type-${dt}`}>
                  {row.DOC_TYPE}
                </span>

                <div className="finance-dashboard-attention-doc">
                  <strong>#{row.DOC_NO}</strong>
                  <small title={row.REMARKS || ""}>{row.REMARKS || row.REF_NO || "No remarks"}</small>
                </div>

                <div className="finance-dashboard-attention-party" title={row.AC_NAME || ""}>
                  {row.AC_NAME || "-"}
                </div>

                <div className="finance-dashboard-attention-amount">
                  {number(row.AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 3 })}
                </div>

                <span
                  className={`finance-dashboard-status-tag ${
                    isCanceled ? "is-canceled" : ""
                  }`}
                >
                  {isCanceled ? "Canceled" : "Active"}
                </span>

                <button
                  type="button"
                  className="finance-dashboard-view-btn"
                  onClick={() => onNavigate(route)}
                  title="View in module"
                >
                  Open
                  <ArrowRight size={10} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="finance-dashboard-empty">
            <CheckCircle2 size={18} />
            <span>No recent activity</span>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function number(val: unknown): number {
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(val: number, isBalance = false): string {
  const absFormatted = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  if (isBalance && val < 0) {
    return `(${absFormatted}) OMR`;
  }
  return `${absFormatted} OMR`;
}

function compactNumber(val: number): string {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(val);
}
