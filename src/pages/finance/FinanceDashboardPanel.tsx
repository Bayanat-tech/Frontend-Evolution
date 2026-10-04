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

  SALES_INVOICE_CANCELED_COUNT?: number;
  PURCHASE_INVOICE_CANCELED_COUNT?: number;
  BANK_PAYMENT_CANCELED_COUNT?: number;
  BANK_RECEIPT_CANCELED_COUNT?: number;
  CASH_PAYMENT_CANCELED_COUNT?: number;
  CASH_RECEIPT_CANCELED_COUNT?: number;
  CREDIT_NOTE_CANCELED_COUNT?: number;
  DEBIT_NOTE_CANCELED_COUNT?: number;

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

type ExposureRow = {
  PARTY_TYPE?: "CUSTOMER" | "SUPPLIER";
  AC_CODE?: string;
  AC_NAME?: string;
  OPEN_INVOICE_COUNT?: number;
  OUTSTANDING_AMOUNT?: number;
  OVERDUE_AMOUNT?: number;
  OLDEST_DUE_DATE?: string;
};

type ExposureSummary = {
  RECEIVABLE_OUTSTANDING?: number;
  RECEIVABLE_OVERDUE?: number;
  PAYABLE_OUTSTANDING?: number;
  PAYABLE_OVERDUE?: number;
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
  topCustomers?: ExposureRow[];
  topSuppliers?: ExposureRow[];
  exposureSummary?: ExposureSummary;
  attention?: AttentionRow[];
  currency_code?: string;
  currency_symbol?: string;
  currency_decimals?: number;
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
          company_name: companyName,
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
  }, [companyCode, companyName, divCode, fyPeriod, month]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = data.summary || {};
  const exposure = data.exposureSummary || {};
  const isIndiaCompany =
    companyCode === "GNL" ||
    companyCode === "GRL" ||
    companyCode === "BTIND" ||
    companyName.toUpperCase().includes("INDIA");
  const currencyCode = data.currency_code || (isIndiaCompany ? "INR" : "OMR");
  const currencyDecimals =
    data.currency_decimals != null
      ? data.currency_decimals
      : ["OMR", "BHD", "KWD", "KD", "JOD", "TND"].includes(currencyCode.toUpperCase())
        ? 3
        : 2;
  const masterCurrencySymbol = String(data.currency_symbol || "").trim();
  const currencySymbol = isUsableCurrencySymbol(masterCurrencySymbol, currencyCode)
    ? masterCurrencySymbol
    : currencySymbolFor(currencyCode);

  // Hero Overview Cards
  const netFlow = number(summary.NET_CASH_FLOW);
  const netFlowIsPositive = netFlow >= 0;

  // Commercial Cards
  const commercialCards: Array<ModuleCardProps> = [
    {
      title: "Sales Invoices (SI)",
      count: summary.SALES_INVOICE_COUNT,
      canceledCount: summary.SALES_INVOICE_CANCELED_COUNT,
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
      canceledCount: summary.PURCHASE_INVOICE_CANCELED_COUNT,
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
      canceledCount: summary.CREDIT_NOTE_CANCELED_COUNT,
      amount: summary.CREDIT_NOTE_AMOUNT,
      icon: TrendingDown,
      tone: "red",
      route: "/workspace/finance/finance/accounts/transactions/credit-note",
      caption: "Sales Adjustments",
    },
    {
      title: "Debit Notes (DN)",
      count: summary.DEBIT_NOTE_COUNT,
      canceledCount: summary.DEBIT_NOTE_CANCELED_COUNT,
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
      canceledCount: summary.BANK_RECEIPT_CANCELED_COUNT,
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
      canceledCount: summary.BANK_PAYMENT_CANCELED_COUNT,
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
      canceledCount: summary.CASH_RECEIPT_CANCELED_COUNT,
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
      canceledCount: summary.CASH_PAYMENT_CANCELED_COUNT,
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

      {/* Decision KPIs: collections, obligations, liquidity and controls */}
      <section className="finance-dashboard-hero-kpis">
        <HeroCard
          title="Customer Receivables"
          value={number(exposure.RECEIVABLE_OUTSTANDING)}
          icon={TrendingUp}
          tone="emerald"
          loading={loading}
          caption={`${formatCurrency(number(exposure.RECEIVABLE_OVERDUE), false, currencySymbol, currencyDecimals)} overdue`}
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />

        <HeroCard
          title="Supplier Payables"
          value={number(exposure.PAYABLE_OUTSTANDING)}
          icon={TrendingDown}
          tone="rose"
          loading={loading}
          caption={`${formatCurrency(number(exposure.PAYABLE_OVERDUE), false, currencySymbol, currencyDecimals)} overdue`}
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />

        <HeroCard
          title="Cash Received"
          value={number(summary.BANK_RECEIPT_AMOUNT) + number(summary.CASH_RECEIPT_AMOUNT)}
          icon={Banknote}
          tone="emerald"
          loading={loading}
          caption="Bank and cash receipts"
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />

        <HeroCard
          title="Cash Paid"
          value={number(summary.BANK_PAYMENT_AMOUNT) + number(summary.CASH_PAYMENT_AMOUNT)}
          icon={CreditCard}
          tone="rose"
          loading={loading}
          caption="Bank and cash payments"
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />

        <HeroCard
          title="Net Cash Movement"
          value={netFlow}
          prevValue={summary.PREV_NET_CASH_FLOW}
          icon={Scale}
          tone={netFlowIsPositive ? "emerald" : "rose"}
          loading={loading}
          caption="Receipts less payments"
          isBalance
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />

        <HeroCard
          title="Control Exceptions"
          value={number(summary.TOTAL_CANCELED_COUNT) + number(summary.UNPOSTED_JOURNAL_COUNT)}
          icon={AlertTriangle}
          tone="amber"
          loading={loading}
          caption={`${number(summary.TOTAL_CANCELED_COUNT)} cancelled · ${number(summary.UNPOSTED_JOURNAL_COUNT)} unposted JVs`}
          isCount
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />
      </section>

      {/* Compact document activity snapshot */}
      <section className="finance-dashboard-section">
        <div className="finance-dashboard-section-title">
          <span />
          <h2>Document &amp; Treasury Activity</h2>
          <span />
        </div>
        <div className="finance-dashboard-kpis finance-dashboard-kpis-summary">
          {[...commercialCards, ...treasuryCards].map((card) => (
            <ModuleCard
              key={card.title}
              {...card}
              loading={loading}
              onNavigate={navigate}
              currencySymbol={currencySymbol}
              decimals={currencyDecimals}
            />
          ))}
        </div>
      </section>

      {/* Interactive Charts: 12-Month Liquidity & Activity Breakdown */}
      <div className="finance-dashboard-chart-grid">
        <CashFlowTrendChart
          title="Monthly Cash Received vs Paid"
          rows={data.monthly || []}
          loading={loading}
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />
        <ActivityMixChart
          title="Monthly Transaction Volume"
          rows={data.monthly || []}
          loading={loading}
        />
      </div>

      {/* Outstanding exposure: actionable collection and payment priorities */}
      <div className="finance-dashboard-panel-grid finance-dashboard-exposure-grid">
        <ExposurePanel
          title="Top 5 Customers to Collect"
          subtitle="Open sales invoices"
          rows={data.topCustomers || []}
          loading={loading}
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
          tone="customer"
        />
        <ExposurePanel
          title="Top 5 Suppliers to Pay"
          subtitle="Open purchase invoices"
          rows={data.topSuppliers || []}
          loading={loading}
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
          tone="supplier"
        />
      </div>

      <div className="finance-dashboard-panel-grid finance-dashboard-activity-grid">
        <AttentionQueuePanel
          rows={data.attention || []}
          loading={loading}
          onNavigate={navigate}
          currencySymbol={currencySymbol}
          decimals={currencyDecimals}
        />
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
  currencySymbol: string;
  decimals?: number;
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
  currencySymbol,
  decimals = 2,
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
          formatCurrency(value, isBalance, currencySymbol, decimals)
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
          <span>Prev: {formatCompactCurrency(prevValue, currencySymbol)}</span>
        )}
      </div>
    </article>
  );
}

type ModuleCardProps = {
  title: string;
  count?: number;
  canceledCount?: number;
  amount?: number;
  prevAmount?: number;
  icon: LucideIcon;
  tone: string;
  route: string;
  caption?: string;
  loading?: boolean;
  onNavigate?: (route: string) => void;
  currencySymbol?: string;
  decimals?: number;
};

function ModuleCard({
  title,
  count,
  canceledCount,
  amount,
  prevAmount,
  icon: Icon,
  tone,
  route,
  caption,
  loading,
  onNavigate,
  currencySymbol = "¤",
  decimals = 2,
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
          formatCurrency(amt, false, currencySymbol, decimals)
        )}
      </strong>

      <div className="finance-dashboard-kpi-foot">
        <span className="finance-dashboard-kpi-badge">
          {cnt.toLocaleString()} vouchers
          {canceledCount && canceledCount > 0 ? (
            <span className="text-[#b45309] dark:text-[#f59e0b] font-normal ml-1">
              ({canceledCount} cancelled)
            </span>
          ) : null}
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
  currencySymbol,
  decimals = 2,
}: {
  title: string;
  rows: MonthlyRow[];
  loading: boolean;
  currencySymbol: string;
  decimals?: number;
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
    ...normalized.flatMap((r) => [number(r.RECEIPTS), number(r.PAYMENTS)])
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

  const inflowPoints = normalized.map((r, i) => `${getX(i)},${getY(number(r.RECEIPTS))}`).join(" ");
  const outflowPoints = normalized.map((r, i) => `${getX(i)},${getY(number(r.PAYMENTS))}`).join(" ");

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
            Received
          </span>
          <span>
            <i style={{ background: "#e11d48" }} />
            Paid
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
                cy={getY(number(r.RECEIPTS))}
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
                cy={getY(number(r.PAYMENTS))}
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
                  Received: {formatCurrency(number(hoveredRow.RECEIPTS), false, currencySymbol, decimals)}
                </span>
                <span style={{ color: "#fda4af" }}>
                  Paid: {formatCurrency(number(hoveredRow.PAYMENTS), false, currencySymbol, decimals)}
                </span>
              </div>
              <div style={{ marginTop: "2px", fontSize: "9px", color: number(hoveredRow.RECEIPTS) >= number(hoveredRow.PAYMENTS) ? "#86efac" : "#fca5a5" }}>
                Net: {formatCurrency(number(hoveredRow.RECEIPTS) - number(hoveredRow.PAYMENTS), true, currencySymbol, decimals)}
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

function ExposurePanel({
  title,
  subtitle,
  rows,
  loading,
  currencySymbol,
  tone,
  decimals = 2,
}: {
  title: string;
  subtitle: string;
  rows: ExposureRow[];
  loading: boolean;
  currencySymbol: string;
  tone: "customer" | "supplier";
  decimals?: number;
}) {
  const largest = Math.max(1, ...rows.map((row) => number(row.OUTSTANDING_AMOUNT)));

  return (
    <article className={`finance-dashboard-card finance-dashboard-exposure tone-${tone}`}>
      <div className="finance-dashboard-card-head">
        <h3>
          <Users size={15} className="finance-card-icon" />
          {title}
        </h3>
        <span>{subtitle}</span>
      </div>

      <div className="finance-dashboard-ranking">
        {loading ? (
          <div className="finance-dashboard-empty">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : rows.length > 0 ? (
          rows.map((row, idx) => {
            const outstanding = number(row.OUTSTANDING_AMOUNT);
            const overdue = number(row.OVERDUE_AMOUNT);
            const overduePercent = outstanding > 0 ? (overdue / outstanding) * 100 : 0;
            return (
            <div className="finance-dashboard-rank" key={`${row.AC_CODE || row.AC_NAME}-${idx}`}>
              <b>{idx + 1}</b>
              <div>
                <div>
                  <strong title={row.AC_NAME}>{row.AC_NAME}</strong>
                  <span>{formatCurrency(outstanding, false, currencySymbol, decimals)}</span>
                </div>
                <i>
                  <span style={{ width: `${Math.min(100, (outstanding / largest) * 100)}%` }} />
                </i>
                <small>
                  {number(row.OPEN_INVOICE_COUNT)} open invoices &middot; {formatCurrency(overdue, false, currencySymbol, decimals)} overdue ({overduePercent.toFixed(0)}%)
                </small>
              </div>
            </div>
            );
          })
        ) : (
          <div className="finance-dashboard-empty">
            <CheckCircle2 size={18} />
            <span>No open balances found</span>
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
  currencySymbol,
  decimals = 2,
}: {
  rows: AttentionRow[];
  loading: boolean;
  onNavigate: (route: string) => void;
  currencySymbol: string;
  decimals?: number;
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
                  {formatCurrency(number(row.AMOUNT), false, currencySymbol, decimals)}
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

function formatCurrency(val: number, isBalance = false, symbol = "¤", decimals = 2): string {
  const absFormatted = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const amount = usesCurrencySuffix(symbol)
    ? `${absFormatted} ${symbol}`
    : `${symbol}${needsCurrencyGap(symbol) ? " " : ""}${absFormatted}`;
  if (isBalance && val < 0) {
    return `(${amount})`;
  }
  return amount;
}

function needsCurrencyGap(symbol: string): boolean {
  return /^[A-Za-z]{2,5}$/.test(symbol.trim());
}

function usesCurrencySuffix(symbol: string): boolean {
  return /[\u0600-\u06ff]/.test(symbol);
}

function formatCompactCurrency(value: number, symbol: string): string {
  const compact = compactNumber(value);
  return usesCurrencySuffix(symbol)
    ? `${compact} ${symbol}`
    : `${symbol}${needsCurrencyGap(symbol) ? " " : ""}${compact}`;
}

function currencySymbolFor(code: string): string {
  const symbols: Record<string, string> = {
    AED: "د.إ",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    OMR: "ر.ع.",
    QAR: "ر.ق",
    SAR: "ر.س",
    USD: "$",
    KWD: "د.ك",
    KD: "د.ك",
    BHD: "ب.د",
    JPY: "¥",
  };
  return symbols[code.toUpperCase()] || code.toUpperCase() || "¤";
}

function isUsableCurrencySymbol(symbol: string, code: string): boolean {
  return Boolean(
    symbol &&
    !symbol.includes("?") &&
    symbol.trim() !== "" &&
    symbol.toUpperCase() !== code.toUpperCase()
  );
}

function compactNumber(val: number): string {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(val);
}
