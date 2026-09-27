import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";

import { useAuth } from "../../../state/AuthContext";
import { api } from "../../../api/client";
import { getDynamicLookup } from "../../../api/lookups";
import { NewReportPage } from "../../../components/new_report_format";
import { NewReportDialog } from "../../../components/new_report_format";
import type { ReportFieldConfig, ReportOption } from "../../../components/new_report_format/types";

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
  drillLevel:        DrillLevel | null;
}

type DrillLevel = "l3" | "l4" | "ac" | "detail";

const DRILL_ENDPOINTS: Record<DrillLevel, string> = {
  l3:     "api/finance/transactions/report/trialbalance/drilldown/l3",
  l4:     "api/finance/transactions/report/trialbalance/drilldown/l4",
  ac:     "api/finance/transactions/report/trialbalance/drilldown/ac",
  detail: "api/finance/transactions/report/trialbalance/drilldown/detail",
};

const DRILL_EXCEL_ENDPOINTS: Record<DrillLevel, string> = {
  l3:     "api/finance/transactions/report/trialbalance/drilldown/l3/excel",
  l4:     "api/finance/transactions/report/trialbalance/drilldown/l4/excel",
  ac:     "api/finance/transactions/report/trialbalance/drilldown/ac/excel",
  detail: "api/finance/transactions/report/trialbalance/drilldown/detail/excel",
};

const DRILL_TITLES: Record<DrillLevel, string> = {
  l3:     "L3 Drill-Down",
  l4:     "L4 Drill-Down",
  ac:     "Account Drill-Down",
  detail: "Transaction Detail",
};

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
    drillLevel:        "l3",
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
    drillLevel:        "l4",
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
    drillLevel:        "ac",
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
    drillLevel:        "detail",
  },
};

const AC_L4 = {
  selectorParameter: "BOLD_REPORT_TRAIL_STATEMENT_L4_CODE",
  valueField:        "l4_code",
  descField:         "l4_description",
  formValueKey:      "l4_code",
  label:             "L4 Code",
};

type FormValues = Record<string, unknown>;

type Division = { div_code: string; div_name: string };

// ─── Drill-Down Stack entry ───────────────────────────────────────────────────

interface DrillEntry {
  id:      number;
  level:   DrillLevel;
  label:   string;
  html:    string;
  payload: Record<string, unknown>;
}

// ─── Drill breadcrumb bar ─────────────────────────────────────────────────────

interface DrillBreadcrumbProps {
  stack:      DrillEntry[];
  onNavigate: (index: number) => void;
}

function DrillBreadcrumb({ stack, onNavigate }: DrillBreadcrumbProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
        padding: "6px 12px",
        fontSize: 11,
      }}
    >
      <button
        type="button"
        onClick={() => onNavigate(-1)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--primary, #00378c)",
          fontWeight: 500,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontSize: 11,
        }}
      >
        <ChevronLeft size={11} /> Main Report
      </button>
      {stack.map((entry, i) => (
        <span key={entry.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--muted, #6b7a8d)" }}>/</span>
          <button
            type="button"
            onClick={() => onNavigate(i)}
            style={{
              fontWeight: 500,
              fontSize: 11,
              background: "none",
              border: "none",
              padding: 0,
              cursor: i === stack.length - 1 ? "default" : "pointer",
              color: i === stack.length - 1
                ? "var(--text, #1a1a2e)"
                : "var(--primary, #00378c)",
            }}
          >
            {entry.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowsToOptions(
  rows: AnyRow[],
  valueField: string,
  descField: string
): ReportOption[] {
  return rows.map((row) => {
    const value = String(row[valueField] ?? "");
    const desc = String(row[descField] ?? "");
    return {
      value,
      label: desc ? `${value} – ${desc}` : value,
      code: value,
    };
  });
}

/** MultiSelectField uses "All" as sentinel; strip it for API payloads. */
function normalizeMulti(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => v !== "All" && v !== "" && v != null).map(String);
}

/** If the multi-select is effectively "All" (or empty), expand to every available code. */
function resolveCodes(
  selected: unknown,
  availableRows: AnyRow[],
  valueField: string
): string[] {
  const normalized = normalizeMulti(selected);
  if (normalized.length === 0) {
    return availableRows
      .map((row) => String(row[valueField] ?? ""))
      .filter((v) => v !== "");
  }
  return normalized;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrialBalancePage() {
  const { user } = useAuth();

  // ── Report type ────────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>("l2");
  const config   = REPORT_TYPES[reportType];
  const isAcMode = reportType === "ac";

  // ── Form values (NewReportPage shape) ──────────────────────────────────────
  const [values, setValues] = useState<FormValues>({
    from_date:         "",
    to_date:           "",
    division_code:     "",
    primary_codes:     ["All"],
    l4_codes:          ["All"],
    report_format:     "standard",
    exclude_zero_txns: false,
  });

  // ── Division lookup ────────────────────────────────────────────────────────
  const [divisions, setDivisions]               = useState<Division[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(false);

  // ── Primary selector ───────────────────────────────────────────────────────
  const [primaryRows, setPrimaryRows]       = useState<AnyRow[]>([]);
  const [primaryLoading, setPrimaryLoading] = useState(false);

  // ── Secondary selector (AC mode L4) ───────────────────────────────────────
  const [l4Rows, setL4Rows]       = useState<AnyRow[]>([]);
  const [l4Loading, setL4Loading] = useState(false);

  // ── Main report state ──────────────────────────────────────────────────────
  const [reportHtml, setReportHtml]       = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError]     = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // ── Drill-down state ───────────────────────────────────────────────────────
  const [drillStack, setDrillStack]     = useState<DrillEntry[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError]     = useState<string | null>(null);
  const drillIdCounter                  = useRef(0);

  // ── Listen for DRILL_DOWN messages posted by report iframes ───────────────
  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      if (!ev.data || ev.data.type !== "DRILL_DOWN") return;

      const {
        drillLevel,
        company_code,
        from_date,
        to_date,
        division_code,
        code,
        codeField,
      } = ev.data as {
        drillLevel:    DrillLevel;
        company_code:  string;
        from_date:     string;
        to_date:       string;
        division_code: string;
        code:          string;
        codeField:     string;
      };

      const endpoint = DRILL_ENDPOINTS[drillLevel];
      if (!endpoint) return;

      const payload: Record<string, unknown> = {
        company_code,
        from_date,
        to_date,
        division_code,
        [codeField]: [code],
      };

      setDrillLoading(true);
      setDrillError(null);

      try {
        const { data } = await api.post<string>(endpoint, payload, {
          headers:      { Accept: "text/html" },
          responseType: "text",
        });

        const entry: DrillEntry = {
          id:      ++drillIdCounter.current,
          level:   drillLevel,
          label:   `${DRILL_TITLES[drillLevel]} · ${code}`,
          html:    data,
          payload,
        };

        setDrillStack((prev) => [...prev, entry]);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data ||
          err?.message ||
          "Failed to load drill-down";
        setDrillError(String(msg));
      } finally {
        setDrillLoading(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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
      setValues((prev) => ({ ...prev, primary_codes: ["All"] }));
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

  // ── Derived options ────────────────────────────────────────────────────────
  const divisionOptions: ReportOption[] = useMemo(
    () =>
      divisions.map((d) => ({
        value: d.div_code,
        label: `${d.div_code} – ${d.div_name}`,
        code: d.div_code,
      })),
    [divisions]
  );

  const primaryOptions = useMemo(
    () => rowsToOptions(primaryRows, config.valueField, config.descField),
    [primaryRows, config.valueField, config.descField]
  );

  const l4Options = useMemo(
    () => rowsToOptions(l4Rows, AC_L4.valueField, AC_L4.descField),
    [l4Rows]
  );

  const reportTypeOptions: ReportOption[] = useMemo(
    () =>
      (Object.entries(REPORT_TYPES) as [ReportType, ReportTypeConfig][]).map(
        ([key, cfg]) => ({ value: key, label: cfg.label })
      ),
    []
  );

  const reportFormatOptions: ReportOption[] = useMemo(
    () => REPORT_FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );

  // ── Field config for NewReportPage ─────────────────────────────────────────
  const fields: ReportFieldConfig[] = useMemo(() => {
    const list: ReportFieldConfig[] = [
      {
        key: "report_type",
        type: "select",
        label: "Report Type",
        options: reportTypeOptions,
        placeholder: "Select type",
        colSpan: 3,
      },
      {
        key: "division_code",
        type: "select",
        label: "Division",
        options: divisionOptions,
        placeholder: "All Divisions",
        loading: divisionsLoading,
        colSpan: 3,
      },
      {
        key: "from_date",
        type: "daterange",
        label: "Date Range",
        toKey: "to_date",
        required: true,
        colSpan: 6,
      },
      {
        key: "primary_codes",
        type: "multiselect",
        label: isAcMode ? "A/c Code" : `${config.label} Codes`,
        options: primaryOptions,
        placeholder: "All",
        loading: primaryLoading,
        colSpan: isAcMode ? 6 : 12,
      },
    ];

    if (isAcMode) {
      list.push(
        {
          key: "l4_codes",
          type: "multiselect",
          label: "L4 Code",
          options: l4Options,
          placeholder: "All",
          loading: l4Loading,
          colSpan: 6,
        },
        {
          key: "report_format",
          type: "select",
          label: "Report Format",
          options: reportFormatOptions,
          placeholder: "Standard",
          colSpan: 4,
        }
      );
    }

    return list;
  }, [
    reportTypeOptions,
    divisionOptions,
    divisionsLoading,
    primaryOptions,
    primaryLoading,
    l4Options,
    l4Loading,
    isAcMode,
    config.label,
    reportFormatOptions,
  ]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = useCallback((key: string, value: unknown) => {
    if (key === "report_type") {
      const next = value as ReportType;
      if (next && REPORT_TYPES[next]) {
        setReportType(next);
        setValues((prev) => ({
          ...prev,
          primary_codes: ["All"],
          l4_codes: ["All"],
        }));
        setReportError(null);
        setReportHtml(null);
        setDrillStack([]);
        setDrillError(null);
      }
      return;
    }
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearAll = useCallback(() => {
    setValues({
      from_date:         "",
      to_date:           "",
      division_code:     "",
      primary_codes:     ["All"],
      l4_codes:          ["All"],
      report_format:     "standard",
      exclude_zero_txns: false,
    });
    setReportError(null);
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);
  }, []);

  const handleCloseReport = () => {
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);
  };

  /**
   * Navigate the drill breadcrumb:
   *   index === -1  → back to main report (clear drill stack)
   *   index ===  n  → truncate stack to [0..n]
   */
  const handleDrillNavigate = (index: number) => {
    if (index === -1) {
      setDrillStack([]);
    } else {
      setDrillStack((prev) => prev.slice(0, index + 1));
    }
    setDrillError(null);
  };

  const canGenerate = Boolean(values.from_date && values.to_date);

  const buildPayload = () => {
    const primary = resolveCodes(
      values.primary_codes,
      primaryRows,
      config.valueField
    );

    const base: Record<string, unknown> = {
      company_code:          user?.company_code ?? "",
      division_code:         (values.division_code as string) || "",
      from_date:             values.from_date as string,
      to_date:               values.to_date as string,
      [config.formValueKey]: primary,
    };

    if (isAcMode) {
      return {
        ...base,
        report_format:        (values.report_format as string) || "standard",
        exclude_zero_txns:    Boolean(values.exclude_zero_txns),
        [AC_L4.formValueKey]: resolveCodes(
          values.l4_codes,
          l4Rows,
          AC_L4.valueField
        ),
      };
    }
    return base;
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      setReportError("From Date and To Date are required.");
      return;
    }
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);
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
    setExportingExcel(true);
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
    } finally {
      setExportingExcel(false);
    }
  };

  // ── Excel download for whichever drill level is currently visible ─────────
  const handleDrillExcel = async () => {
    const topDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
    if (!topDrill) return;
    const endpoint = DRILL_EXCEL_ENDPOINTS[topDrill.level];
    setExportingExcel(true);
    try {
      const response = await api.post(endpoint, topDrill.payload, {
        responseType: "arraybuffer",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `${topDrill.label.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
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
      setDrillError(String(msg));
    } finally {
      setExportingExcel(false);
    }
  };

  // ── Derive what to show inside NewReportDialog ─────────────────────────────
  const topDrill  = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
  const pageTitle = `Trial Balance – ${config.label}`;
  const dialogTitle = topDrill ? topDrill.label : pageTitle;
  const dialogHtml = topDrill ? topDrill.html : reportHtml;
  const dialogOpen = reportHtml !== null;

  // Values passed to NewReportPage (include synthetic report_type for the select)
  const pageValues: FormValues = {
    ...values,
    report_type: reportType,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <NewReportPage
        title={pageTitle}
        fields={fields}
        values={pageValues}
        onChange={handleChange}
        onClearAll={handleClearAll}
        onGenerate={handleGenerate}
        loading={reportLoading}
        optionsLoading={divisionsLoading || primaryLoading || (isAcMode && l4Loading)}
        error={reportError}
        onClearError={() => setReportError(null)}
        fieldsPerRow={4}
      >
        {isAcMode && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--text, #1a1a2e)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(values.exclude_zero_txns)}
                onChange={(e) =>
                  setValues((p) => ({ ...p, exclude_zero_txns: e.target.checked }))
                }
                style={{
                  width: 14,
                  height: 14,
                  accentColor: "var(--primary, #00378c)",
                }}
              />
              Exclude Zero TXNs
            </label>
          </div>
        )}
      </NewReportPage>

      <NewReportDialog
        open={dialogOpen}
        onClose={handleCloseReport}
        title={dialogTitle}
        htmlContent={dialogHtml}
        loading={reportLoading || drillLoading}
        error={drillError ?? (reportError && !reportHtml ? reportError : null)}
        onExportExcel={topDrill ? handleDrillExcel : handleExcel}
        exportingExcel={exportingExcel}
        headerSlot={
          drillLoading || drillError || drillStack.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {drillLoading && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 16px",
                    background: "var(--primary-soft, #e8f0ff)",
                    borderBottom: "1px solid var(--border, #cbd5e1)",
                    fontSize: 11,
                    color: "var(--primary, #00378c)",
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      border: "2px solid color-mix(in srgb, var(--primary, #00378c) 30%, transparent)",
                      borderTopColor: "var(--primary, #00378c)",
                      borderRadius: "50%",
                      animation: "nr-spin 0.75s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  Loading drill-down…
                </div>
              )}

              {drillError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 16px",
                    background: "#fef2f2",
                    borderBottom: "1px solid #fecaca",
                    fontSize: 11,
                    color: "var(--danger, #dc2626)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Drill-down error:</span> {drillError}
                  <button
                    type="button"
                    onClick={() => setDrillError(null)}
                    style={{
                      marginLeft: "auto",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--danger, #dc2626)",
                      padding: 0,
                      display: "flex",
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {drillStack.length > 0 && (
                <div
                  style={{
                    borderBottom: "1px solid var(--border, #cbd5e1)",
                    background: "var(--panel-soft, #f0f4f8)",
                  }}
                >
                  <DrillBreadcrumb stack={drillStack} onNavigate={handleDrillNavigate} />
                </div>
              )}
            </div>
          ) : undefined
        }
      />
    </>
  );
}