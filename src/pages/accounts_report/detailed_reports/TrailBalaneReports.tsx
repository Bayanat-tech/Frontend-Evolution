import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { useAuth } from "../../../state/AuthContext";
import { api } from "../../../api/client";
import { getDynamicLookup } from "../../../api/lookups";
import ReportDialogPage from "../../../components/ReportDialogPage";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;

type TReportFormat =
  | "standard"
  | "sub_ledger_1"
  | "sub_ledger_2"
  | "tb_without_year_end_jv";

const REPORT_FORMAT_OPTIONS: { value: TReportFormat; label: string }[] = [
  { value: "standard",               label: "Standard" },
  { value: "sub_ledger_1",           label: "Sub Ledger Format 1" },
  { value: "sub_ledger_2",           label: "Sub Ledger Format 2" },
  { value: "tb_without_year_end_jv", label: "TB Without Year End JV" },
];

type ReportType = "l2" | "l3" | "l4" | "ac";

interface ReportTypeConfig {
  label:             string;
  selectorParameter: string;
  valueField:        string;
  descField:         string;
  formValueKey:      string;
  reportEndpoint:    string;
  excelEndpoint:     string;
  excelFileName:     string;
}

const REPORT_TYPES: Record<ReportType, ReportTypeConfig> = {
  l2: {
    label:             "L2",
    selectorParameter: "BOLD_REPORT_TRAIL_STATEMENT_L2_CODE",
    valueField:        "l2_code",
    descField:         "l2_description",
    formValueKey:      "l2_code",
    reportEndpoint:    "api/finance/transactions/report/trialbalance/html/l2",
    excelEndpoint:     "api/finance/transactions/report/trialbalance/excel/l2",
    excelFileName:     "TrailBalance_L2.xlsx",
  },
  l3: {
    label:             "L3",
    selectorParameter: "BOLD_REPORT_TRAIL_STATEMENT_L3_CODE",
    valueField:        "l3_code",
    descField:         "l3_description",
    formValueKey:      "l3_code",
    reportEndpoint:    "api/finance/transactions/report/trialbalance/html/l3",
    excelEndpoint:     "api/finance/transactions/report/trialbalance/excel/l3",
    excelFileName:     "TrailBalance_L3.xlsx",
  },
  l4: {
    label:             "L4",
    selectorParameter: "BOLD_REPORT_TRAIL_STATEMENT_L4_CODE",
    valueField:        "l4_code",
    descField:         "l4_description",
    formValueKey:      "l4_code",
    reportEndpoint:    "api/finance/transactions/report/trialbalance/html/l4",
    excelEndpoint:     "api/finance/transactions/report/trialbalance/excel/l4",
    excelFileName:     "TrailBalance_L4.xlsx",
  },
  ac: {
    label:             "Account (A/c)",
    selectorParameter: "BOLD_REPORT_TRAIL_STATEMENT_AC_CODE",
    valueField:        "ac_code",
    descField:         "ac_name",
    formValueKey:      "ac_code",
    reportEndpoint:    "api/finance/transactions/report/trialbalance/html/ac",
    excelEndpoint:     "api/finance/transactions/report/trialbalance/excel/ac",
    excelFileName:     "TrailBalance_AC.xlsx",
  },
};

const AC_L4 = {
  selectorParameter: "BOLD_REPORT_TRAIL_STATEMENT_L4_CODE",
  valueField:        "l4_code",
  descField:         "l4_description",
  formValueKey:      "l4_code",
  label:             "L4 Code",
};

type FormState = {
  from_date:         string;
  to_date:           string;
  division_code:     string;
  report_format:     TReportFormat;
  exclude_zero_txns: boolean;
};

type Division = { div_code: string; div_name: string };

// ─── Report HTML renderer ─────────────────────────────────────────────────────

function HtmlReportRenderer({ required_values }: { required_values: { html: string } }) {
  return (
    <div
      style={{ width: "100%" }}
      dangerouslySetInnerHTML={{ __html: required_values.html }}
    />
  );
}

// ─── Reusable checkbox selector ───────────────────────────────────────────────

interface CheckboxSelectorProps {
  rows:        AnyRow[];
  loading:     boolean;
  selectedKeys: Set<string>;
  valueField:  string;
  descField:   string;
  label:       string;
  onToggle:    (key: string) => void;
  onClearAll:  () => void;
  onSelectAll: () => void;
}

function CheckboxSelector({
  rows,
  loading,
  selectedKeys,
  valueField,
  descField,
  label,
  onToggle,
  onClearAll,
  onSelectAll,
}: CheckboxSelectorProps) {
  const selCount = selectedKeys.size;
  const total    = rows.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {loading ? "Loading…" : `${selCount} of ${total} ${label} selected`}
        </p>
        <div className="flex items-center gap-3">
          {!loading && selCount < total && (
            <button
              onClick={onSelectAll}
              className="text-[10px] text-primary/80 hover:text-primary underline"
            >
              Select all
            </button>
          )}
          {selCount > 0 && (
            <button
              onClick={onClearAll}
              className="text-[10px] text-destructive/70 hover:text-destructive underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-56 overflow-y-auto rounded border border-border">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground">
            Loading items…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground">
            No items available
          </div>
        ) : (
          rows.map((row) => {
            const key     = String(row[valueField]);
            const desc    = String(row[descField] ?? "");
            const checked = selectedKeys.has(key);
            return (
              <label
                key={key}
                className={[
                  "flex items-center gap-2.5 px-3 py-1.5 cursor-pointer select-none",
                  "border-b border-border last:border-b-0 transition-colors",
                  checked
                    ? "bg-primary/5 text-primary"
                    : "hover:bg-muted/40 text-foreground",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(key)}
                  className="h-3 w-3 accent-primary flex-shrink-0"
                />
                <span className="text-[11px] font-medium w-24 flex-shrink-0">{key}</span>
                <span className="text-[11px] text-muted-foreground truncate">{desc}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrialBalancePage() {
  const { user } = useAuth();

  // ── Report type ────────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>("l2");
  const config   = REPORT_TYPES[reportType];
  const isAcMode = reportType === "ac";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    from_date:         "",
    to_date:           "",
    division_code:     "",
    report_format:     "standard",
    exclude_zero_txns: false,
  });

  // ── Division lookup ────────────────────────────────────────────────────────
  const [divisions, setDivisions]               = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  // ── Primary selector (L2/L3/L4 and A/c Code in AC mode) ───────────────────
  const [primaryRows, setPrimaryRows]       = useState<AnyRow[]>([]);
  const [primaryLoading, setPrimaryLoading] = useState(false);
  const [selectedKeys, setSelectedKeys]     = useState<Set<string>>(new Set());

  // ── Secondary selector (L4 Code in AC mode) ───────────────────────────────
  const [l4Rows, setL4Rows]           = useState<AnyRow[]>([]);
  const [l4Loading, setL4Loading]     = useState(false);
  const [selectedL4Keys, setSelectedL4Keys] = useState<Set<string>>(new Set());

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportHtml, setReportHtml]       = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError]     = useState<string | null>(null);

  // ── Fetch divisions ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setDivisionsLoading(true);
      try {
        const res = await getDynamicLookup({
          parameter: "Account_division",
          loginid:   user?.loginid      ?? "",
          code1:     user?.company_code ?? "",
        });
        setDivisions(res as Division[]);
      } catch {
        setDivisions([]);
      } finally {
        setDivisionsLoading(false);
      }
    };
    fetch();
  }, [user]);

  // ── Fetch primary rows on type change ──────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setPrimaryLoading(true);
      setPrimaryRows([]);
      setSelectedKeys(new Set());
      try {
        const res = await getDynamicLookup({
          parameter: config.selectorParameter,
          loginid:   user?.loginid      ?? "",
          code1:     user?.company_code ?? "",
        });
        setPrimaryRows(res as AnyRow[]);
      } catch {
        setPrimaryRows([]);
      } finally {
        setPrimaryLoading(false);
      }
    };
    fetch();
  }, [config.selectorParameter, user]);

  // ── Fetch L4 rows (AC mode only) ──────────────────────────────────────────
  useEffect(() => {
    if (!isAcMode) return;
    const fetch = async () => {
      setL4Loading(true);
      try {
        const res = await getDynamicLookup({
          parameter: AC_L4.selectorParameter,
          loginid:   user?.loginid      ?? "",
          code1:     user?.company_code ?? "",
        });
        setL4Rows(res as AnyRow[]);
      } catch {
        setL4Rows([]);
      } finally {
        setL4Loading(false);
      }
    };
    fetch();
  }, [isAcMode, user]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTogglePrimary = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleSelectAllPrimary = useCallback(() => {
    setSelectedKeys(new Set(primaryRows.map((r) => String(r[config.valueField]))));
  }, [primaryRows, config.valueField]);

  const handleToggleL4 = useCallback((key: string) => {
    setSelectedL4Keys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleSelectAllL4 = useCallback(() => {
    setSelectedL4Keys(new Set(l4Rows.map((r) => String(r[AC_L4.valueField]))));
  }, [l4Rows]);

  const handleReset = () => {
    setForm({
      from_date:         "",
      to_date:           "",
      division_code:     "",
      report_format:     "standard",
      exclude_zero_txns: false,
    });
    setSelectedKeys(new Set());
    setSelectedL4Keys(new Set());
    setReportError(null);
    setReportHtml(null);
  };

  const handleTypeChange = (type: ReportType) => {
    setReportType(type);
    setSelectedKeys(new Set());
    setSelectedL4Keys(new Set());
    setReportError(null);
    setReportHtml(null);
  };

  const canGenerate = Boolean(form.from_date && form.to_date);

  // ── Build POST payload ─────────────────────────────────────────────────────
  const buildPayload = () => {
    const base = {
      company_code:          user?.company_code ?? "",
      division_code:         form.division_code,
      from_date:             form.from_date,
      to_date:               form.to_date,
      [config.formValueKey]: Array.from(selectedKeys),
    };

    if (isAcMode) {
      return {
        ...base,
        report_format:            form.report_format,
        exclude_zero_txns:        form.exclude_zero_txns,
        [AC_L4.formValueKey]:     Array.from(selectedL4Keys),
      };
    }

    return base;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    try {
      const { data } = await api.post<string>(config.reportEndpoint, buildPayload(), {
        headers:      { Accept: "text/html" },
        responseType: "text",
      });
      setReportHtml(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to generate report";
      setReportError(String(msg));
    } finally {
      setReportLoading(false);
    }
  };

  const handleExcel = async () => {
    try {
      const response = await api.post(config.excelEndpoint, buildPayload(), {
        responseType: "arraybuffer",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", config.excelFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to download Excel";
      setReportError(String(msg));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const pageTitle = `Trial Balance – ${config.label}`;

  return (
    <>
      <section className="grid gap-4">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">
              {pageTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Financial Reports</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" title="Reset" onClick={handleReset}>
              <RefreshCw size={15} />
            </Button>
            <Button disabled={!canGenerate || reportLoading} onClick={handleGenerate}>
              {reportLoading ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <Play size={15} /> Generate Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {reportError && (
          <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
            <span className="font-semibold">Error:</span> {reportError}
            <button
              onClick={() => setReportError(null)}
              className="ml-auto text-destructive/60 hover:text-destructive"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* ── Report Type Selector ── */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-1 rounded-full bg-primary" />
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Report Type
                </p>
                <h2 className="text-[11px] font-semibold text-foreground leading-tight">
                  Select which trial balance to generate
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="flex gap-0 border border-border rounded-md overflow-hidden w-fit">
              {(Object.entries(REPORT_TYPES) as [ReportType, ReportTypeConfig][]).map(
                ([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => handleTypeChange(key)}
                    className={[
                      "px-4 py-1.5 text-[11px] font-medium transition-colors border-r border-border last:border-r-0",
                      reportType === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    ].join(" ")}
                  >
                    {cfg.label}
                  </button>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Filters ── */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-1 rounded-full bg-primary" />
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Parameters
                </p>
                <h2 className="text-[11px] font-semibold text-foreground leading-tight">
                  Report Filters
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className={`grid grid-cols-1 gap-3 ${isAcMode ? "sm:grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2 md:grid-cols-4"}`}>
              <label className={`flex flex-col gap-1.5 ${!isAcMode ? "sm:col-span-2" : ""}`}>
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
                  Division
                </span>
                <select
                  value={form.division_code}
                  onChange={(e) => setForm((p) => ({ ...p, division_code: e.target.value }))}
                  disabled={divisionsLoading}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                >
                  <option value="">— All Divisions —</option>
                  {divisions.map((d) => (
                    <option key={d.div_code} value={d.div_code}>
                      {d.div_code} – {d.div_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  From Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={form.from_date}
                  onChange={(e) => setForm((p) => ({ ...p, from_date: e.target.value }))}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  To Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={form.to_date}
                  onChange={(e) => setForm((p) => ({ ...p, to_date: e.target.value }))}
                  className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

              {isAcMode && (
                <div className="flex flex-col gap-0.5 sm:col-span-2 md:col-span-3">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Report Format
                  </span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                    {REPORT_FORMAT_OPTIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="report_format"
                          value={value}
                          checked={form.report_format === value}
                          onChange={() => setForm((p) => ({ ...p, report_format: value }))}
                          className="h-3 w-3 accent-primary"
                        />
                        <span className="text-[11px] text-foreground">{label}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={form.exclude_zero_txns}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, exclude_zero_txns: e.target.checked }))
                        }
                        className="h-3 w-3 accent-primary"
                      />
                      <span className="text-[11px] text-foreground">Exclude Zero TXNs</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Selector area ── */}
        <Card className="border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-1 rounded-full bg-primary" />
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Code Selection
                </p>
                <h2 className="text-[11px] font-semibold text-foreground leading-tight">
                  {isAcMode ? "A/c Code & L4 Code" : `${config.label} Codes`}
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {isAcMode ? (
              /* AC mode: two side-by-side checkbox selectors */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    A/c Code
                  </p>
                  <CheckboxSelector
                    rows={primaryRows}
                    loading={primaryLoading}
                    selectedKeys={selectedKeys}
                    valueField={config.valueField}
                    descField={config.descField}
                    label="A/c codes"
                    onToggle={handleTogglePrimary}
                    onClearAll={() => setSelectedKeys(new Set())}
                    onSelectAll={handleSelectAllPrimary}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    L4 Code
                  </p>
                  <CheckboxSelector
                    rows={l4Rows}
                    loading={l4Loading}
                    selectedKeys={selectedL4Keys}
                    valueField={AC_L4.valueField}
                    descField={AC_L4.descField}
                    label="L4 codes"
                    onToggle={handleToggleL4}
                    onClearAll={() => setSelectedL4Keys(new Set())}
                    onSelectAll={handleSelectAllL4}
                  />
                </div>
              </div>
            ) : (
              /* L2 / L3 / L4: single checkbox selector */
              <CheckboxSelector
                rows={primaryRows}
                loading={primaryLoading}
                selectedKeys={selectedKeys}
                valueField={config.valueField}
                descField={config.descField}
                label={`${config.label} codes`}
                onToggle={handleTogglePrimary}
                onClearAll={() => setSelectedKeys(new Set())}
                onSelectAll={handleSelectAllPrimary}
              />
            )}
          </CardContent>
        </Card>

      </section>

      {/* ── Report Dialog ── */}
      {reportHtml !== null && (
        <ReportDialogPage
          title={pageTitle}
          Report={HtmlReportRenderer}
          required_values={{ html: reportHtml }}
          excel={handleExcel}
          onClose={() => setReportHtml(null)}
        />
      )}
    </>
  );
}