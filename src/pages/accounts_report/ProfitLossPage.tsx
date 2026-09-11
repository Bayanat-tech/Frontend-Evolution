"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, Search } from "lucide-react";

import { BiscDatePicker } from "../../components/ui/BiscDatePicker";
import { Button } from "../../components/ui/Button";
import { MultiSelectField, type MultiSelectOption } from "../../components/ui/MultiSelectField";
import { ReportFilterHeader } from "../../components/reports/ReportFilterHeader";
import { ReportPreviewDialog } from "../../components/reports/ReportPreviewDialog";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup } from "../../api/lookups";
import {
  getProfitLossReportHtml,
  getProfitLossReportExcelDownload,
} from "../../api/transactions";
import { api } from "../../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Division = { div_code: string; div_name: string };

type DrillLevel = "l1" | "l2" | "l3";

interface DrillState {
  level: DrillLevel;
  html: string;
  title: string;
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

function toDisplayDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

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

  // ── Report / drill state ─────────────────────────────────────────────────
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [message, setMessage] = useState("Select filters and run the report.");

  const [drillStack, setDrillStack] = useState<DrillState[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ── Report preview dialog state ──────────────────────────────────────────
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [exporting, setExporting] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const canGenerate = Boolean(dateFrom && dateTo);
  const currentDrill = drillStack[drillStack.length - 1] ?? null;
  const activeHtml = currentDrill?.html ?? reportHtml;
  const dialogTitle = currentDrill?.title ?? "Profit & Loss";

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
      setReportError(null);
      setPreviewUrl((prev) => {
        if (prev) window.URL.revokeObjectURL(prev);
        return "";
      });

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
          setDrillStack((prev) => [
            ...prev,
            {
              level: "l2",
              html: response.data as string,
              title: `Account Summary — PL: ${data.pl_code}`,
              pl_code: data.pl_code,
            },
          ]);
        } else if (data.drillLevel === "l3" && data.ac_code) {
          const response = await api.post(
            "/api/finance/transactions/reports/profitloss/drilldown/l3",
            { ...basePayload, ac_code: data.ac_code },
            { responseType: "text" }
          );
          setDrillStack((prev) => [
            ...prev,
            {
              level: "l3",
              html: response.data as string,
              title: `Transaction Detail — ${data.ac_code}`,
              ac_code: data.ac_code,
            },
          ]);
        }
      } catch (err: any) {
        setReportError(err?.message ?? "Failed to load drill-down");
      } finally {
        setDrillLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loginId]);

  // ── Keep the dialog's blob URL in sync ───────────────────────────────────
  useEffect(() => {
    if (!previewOpen) return;
    if (drillLoading) return;
    if (activeHtml === null || activeHtml === undefined) return;

    const blob = new Blob([activeHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) window.URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, activeHtml, drillLoading]);

  useEffect(() => {
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    setMessage("");

    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewOpen(true);

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

  // ── Clear All (exactly like Freight page) ────────────────────────────────
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
    setMessage("Select filters and run the report.");
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewOpen(false);
    setPreviewUrl("");
    setReportHtml(null);
    setDrillStack([]);
  };

  const handleDrillBack = () => {
    setDrillStack((prev) => prev.slice(0, -1));
    setReportError(null);
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
    setExporting(true);
    try {
      if (currentDrill?.level === "l2" && currentDrill.pl_code) {
        const response = await api.post(
          "/api/finance/transactions/reports/profitloss/drilldown/l2/excel",
          { ...buildPayload(), pl_code: currentDrill.pl_code },
          { responseType: "blob" }
        );
        triggerDownload(response.data, `pnl_l2_${currentDrill.pl_code}.xlsx`);
      } else if (currentDrill?.level === "l3" && currentDrill.ac_code) {
        const response = await api.post(
          "/api/finance/transactions/reports/profitloss/drilldown/l3/excel",
          { ...buildPayload(), ac_code: currentDrill.ac_code },
          { responseType: "blob" }
        );
        triggerDownload(response.data, `pnl_l3_${currentDrill.ac_code}.xlsx`);
      } else {
        await getProfitLossReportExcelDownload(buildPayload());
      }
    } catch (err: any) {
      setReportError(err?.message ?? "Failed to download Excel");
    } finally {
      setExporting(false);
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
        {reportError && !previewOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive">{reportError}</p>
        ) : null}
      </div>

      {/* ── Preview dialog ──────────────────────────────────────────────── */}
      {previewOpen && (
        <ReportPreviewDialog
          title={dialogTitle}
          pdfUrl={previewUrl}
          error={reportError || undefined}
          exporting={exporting}
          onExcel={handleExcel}
          onClose={closePreview}
          onDownload={() => {}}
          downloadName={`${dialogTitle.replace(/[^a-z0-9]+/gi, "_")}.html`}
          onBack={drillStack.length > 0 ? handleDrillBack : undefined}
        />
      )}
    </section>
  );
}