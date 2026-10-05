"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Search, X } from "lucide-react";

import { BiscDatePicker } from "../../components/ui/BiscDatePicker";
import { Button } from "../../components/ui/Button";
import { MultiSelectField, type MultiSelectOption } from "../../components/ui/MultiSelectField";
import { ReportFilterHeader } from "../../components/reports/ReportFilterHeader";
import { NewReportDialog } from "../../components/new_report_format";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup } from "../../api/lookups";
import {
  getProfitLossReportHtml,
  getProfitLossReportExcelDownload,
} from "../../api/transactions";
import { api } from "../../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Division = { div_code: string; div_name: string };

type DrillLevel = "l2" | "l3";

interface DrillEntry {
  id:       number;
  level:    DrillLevel;
  label:    string;
  html:     string;
  pl_code?: string;
  ac_code?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStartOfYear = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-01-01`;
};

const getToday = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
};

function toInputDate(value: string) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

// ─── Field wrapper (same style as Freight page) ───────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

// ─── Drill breadcrumb bar (same pattern as Trial Balance) ─────────────────────

interface DrillBreadcrumbProps {
  stack:      DrillEntry[];
  onNavigate: (index: number) => void;
}

function DrillBreadcrumb({ stack, onNavigate }: DrillBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-3 py-1.5 text-[10px]">
      <button
        type="button"
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 text-primary/80 hover:text-primary font-medium"
      >
        <ChevronLeft size={11} /> Main Report
      </button>
      {stack.map((entry, i) => (
        <span key={entry.id} className="flex items-center gap-1">
          <span className="text-muted-foreground">/</span>
          <button
            type="button"
            onClick={() => onNavigate(i)}
            className={[
              "font-medium",
              i === stack.length - 1
                ? "text-foreground cursor-default"
                : "text-primary/80 hover:text-primary",
            ].join(" ")}
          >
            {entry.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfitLossPage() {
  const { user } = useAuth();

  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Division lookup ──────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<Division[]>([]);
  const [divisionLoading, setDivisionLoading] = useState(false);
  const [division, setDivision] = useState("");

  // ── Form state ───────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(getStartOfYear());
  const [dateTo, setDateTo] = useState(getToday());
  const [reportPeriod, setReportPeriod] = useState("D"); // Daily / Monthly / Yearly
  const [reportMode, setReportMode] = useState("D"); // Detail / Grouped
  const [reportVariant, setReportVariant] = useState(""); // Standard / etc.

  // ── Main report state ────────────────────────────────────────────────────
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [message, setMessage] = useState("Select filters and run the report.");

  // ── Drill-down state ─────────────────────────────────────────────────────
  const [drillStack, setDrillStack] = useState<DrillEntry[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const drillIdCounter = useRef(0);

  // ── Derived ──────────────────────────────────────────────────────────────
  const canGenerate = Boolean(dateFrom && dateTo);
  const topDrill = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;
  const dialogHtml = topDrill ? topDrill.html : reportHtml;
  const dialogTitle = topDrill ? topDrill.label : "Profit & Loss";
  const dialogOpen = reportHtml !== null;

  // ── Fetch divisions ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchDivisions = async () => {
      setDivisionLoading(true);
      try {
        const res = await getDynamicLookup({
          parameter: "Account_division",
          loginid: loginId,
          code1: companyCode,
        });
        setDivisionList((res as Division[]) ?? []);
      } catch {
        setDivisionList([]);
      } finally {
        setDivisionLoading(false);
      }
    };
    fetchDivisions();
  }, [companyCode, loginId]);

  // ── postMessage listener for drill-down clicks ───────────────────────────
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "PNL_DRILL_DOWN") return;

      setDrillLoading(true);
      setDrillError(null);

      try {
        const basePayload = {
          parameter: "ProfitLoss",
          loginid: loginId,
          company_code: data.company_code,
          from_date: data.from_date,
          to_date: data.to_date,
          division_code: data.division_code,
        };

        if (data.drillLevel === "l2" && data.pl_code) {
          const response = await api.post(
            "/api/finance/transactions/reports/profitloss/drilldown/l2",
            { ...basePayload, pl_code: data.pl_code },
            { responseType: "text" }
          );

          const entry: DrillEntry = {
            id:      ++drillIdCounter.current,
            level:   "l2",
            label:   `Account Summary — PL: ${data.pl_code}`,
            html:    response.data as string,
            pl_code: data.pl_code,
          };
          setDrillStack((prev) => [...prev, entry]);
        } else if (data.drillLevel === "l3" && data.ac_code) {
          const response = await api.post(
            "/api/finance/transactions/reports/profitloss/drilldown/l3",
            { ...basePayload, ac_code: data.ac_code },
            { responseType: "text" }
          );

          const entry: DrillEntry = {
            id:      ++drillIdCounter.current,
            level:   "l3",
            label:   `Transaction Detail — ${data.ac_code}`,
            html:    response.data as string,
            ac_code: data.ac_code,
          };
          setDrillStack((prev) => [...prev, entry]);
        }
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

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loginId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const buildPayload = () => ({
    parameter: "ProfitLoss",
    loginid: loginId,
    company_code: companyCode,
    division_code: division || "All",
    from_date: dateFrom,
    to_date: dateTo,
    report_period: reportPeriod,
    report_mode: reportMode,
    report_variant: reportVariant,
  });

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    setDrillStack([]);
    setDrillError(null);
    setMessage("");

    try {
      const html = await getProfitLossReportHtml(buildPayload());
      setReportHtml(html);
      setMessage("Report generated successfully.");
    } catch (err: any) {
      const errorMessage = err?.message ?? "Failed to generate report";
      setReportError(errorMessage);
      setMessage(errorMessage);
    } finally {
      setReportLoading(false);
    }
  };

  const handleReset = () => {
    setDivision("");
    setDateFrom(getStartOfYear());
    setDateTo(getToday());
    setReportPeriod("D");
    setReportMode("D");
    setReportVariant("");
    setReportHtml(null);
    setDrillStack([]);
    setReportError(null);
    setDrillError(null);
    setMessage("Select filters and run the report.");
  };

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

  const triggerDownload = (data: Blob, filename: string) => {
    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExcel = async () => {
    try {
      if (topDrill?.level === "l2" && topDrill.pl_code) {
        const response = await api.post(
          "/api/finance/transactions/reports/profitloss/drilldown/l2/excel",
          { ...buildPayload(), pl_code: topDrill.pl_code },
          { responseType: "blob" }
        );
        triggerDownload(response.data, `pnl_l2_${topDrill.pl_code}.xlsx`);
      } else if (topDrill?.level === "l3" && topDrill.ac_code) {
        const response = await api.post(
          "/api/finance/transactions/reports/profitloss/drilldown/l3/excel",
          { ...buildPayload(), ac_code: topDrill.ac_code },
          { responseType: "blob" }
        );
        triggerDownload(response.data, `pnl_l3_${topDrill.ac_code}.xlsx`);
      } else {
        await getProfitLossReportExcelDownload(buildPayload());
      }
    } catch (err: any) {
      const msg = err?.message ?? "Failed to download Excel";
      if (topDrill) {
        setDrillError(msg);
      } else {
        setReportError(msg);
      }
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        {/* ── Title bar (same as Freight) ─────────────────────────────────── */}
        <div className="freight-report-titlebar">
          <h1>Profit &amp; Loss</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
        </div>

        {/* ── Report Filters header with Clear All ───────────────────────── */}
        <ReportFilterHeader onClear={handleReset} />

        {/* ── Filter fields ──────────────────────────────────────────────── */}
        <div className="freight-report-fields grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
          <MultiSelectField
            className="freight-report-multi-select"
            label="Division"
            options={divisionList.map(
              (d): MultiSelectOption => ({
                value: d.div_code,
                label: `${d.div_code} – ${d.div_name}`,
              })
            )}
            loading={divisionLoading}
            value={division ? [division] : []}
            onChange={(next) => setDivision(next[0] ?? "")}
          />

          <Field label="From">
            <BiscDatePicker
              value={toInputDate(dateFrom)}
              onChange={(value) => {
                if (!dateTo || value <= dateTo) setDateFrom(value);
              }}
            />
          </Field>

          <Field label="To">
            <BiscDatePicker
              value={toInputDate(dateTo)}
              onChange={(value) => {
                if (!dateFrom || value >= dateFrom) setDateTo(value);
              }}
            />
          </Field>
        </div>

        {/* ── Second row: Period / Report Mode / Report Variant ─────────── */}
        <div className="freight-report-fields grid gap-3 px-3 pb-3 md:grid-cols-3">
          <Field label="Period">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
            >
              <option value="D">Daily</option>
              <option value="M">Monthly</option>
              <option value="Y">Yearly</option>
            </select>
          </Field>

          <Field label="Report Mode">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={reportMode}
              onChange={(e) => setReportMode(e.target.value)}
            >
              <option value="D">Detail</option>
              <option value="G">Grouped</option>
            </select>
          </Field>

          <Field label="Report Variant">
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm"
              value={reportVariant}
              onChange={(e) => setReportVariant(e.target.value)}
            >
              <option value="">Standard</option>
              <option value="ANALYSIS">Analysis</option>
              <option value="SUMMARY">Summary</option>
              <option value="CROSSTAB">Cross Tab</option>
            </select>
          </Field>
        </div>

        {/* ── Actions bar (right aligned, same as Freight) ──────────────── */}
        <div className="freight-report-actions">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={!canGenerate || reportLoading}
          >
            {reportLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Search size={15} />
            )}{" "}
            Generate Report
          </Button>
        </div>

        {/* ── Message ────────────────────────────────────────────────────── */}
        {message ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p>
        ) : null}
        {reportError && !dialogOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive">{reportError}</p>
        ) : null}
      </div>

      {/* ── New Report Dialog (with drill support via headerSlot) ── */}
      <NewReportDialog
        open={dialogOpen}
        onClose={handleCloseReport}
        title={dialogTitle}
        htmlContent={dialogHtml}
        loading={reportLoading || drillLoading}
        error={drillError ?? (reportError && !reportHtml ? reportError : null)}
        onExportExcel={handleExcel}
        headerSlot={
          (drillLoading || drillError || drillStack.length > 0) ? (
            <div className="flex flex-col gap-0">
              {drillLoading && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-border text-[10px] text-primary">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading drill-down…
                </div>
              )}

              {drillError && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-destructive/10 border-b border-destructive/20 text-[10px] text-destructive">
                  <span className="font-semibold">Drill-down error:</span> {drillError}
                  <button type="button" onClick={() => setDrillError(null)} className="ml-auto">
                    <X size={11} />
                  </button>
                </div>
              )}

              {drillStack.length > 0 && (
                <div className="border-b border-border bg-muted/20">
                  <DrillBreadcrumb stack={drillStack} onNavigate={handleDrillNavigate} />
                </div>
              )}
            </div>
          ) : undefined
        }
      />
    </section>
  );
}