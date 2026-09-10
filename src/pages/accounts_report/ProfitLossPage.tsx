"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, CalendarDays, Filter, Loader2, Search } from "lucide-react";

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

// ─── Small presentational bits (mirrors the Freight report page look) ────────

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
      <span>
        {label} {required && <span className="text-destructive normal-case">*</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryStripItem({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 shadow-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon size={16} />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
        <div className="truncate text-[13px] font-semibold text-slate-800" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

function SummaryBadge({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-1.5 ${strong ? "border-primary/20 bg-primary/10 text-primary" : "bg-muted/40 text-foreground"}`}>
      <div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

// Small local button so the primary action matches app styling without an
// extra import; swap for ../../components/ui/Button if you prefer that one.
function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
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
  const divisionName = useMemo(
    () => divisionList.find((d) => d.div_code === division)?.div_name,
    [divisionList, division],
  );

  // ── Form state ───────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(getStartOfYear());
  const [dateTo, setDateTo] = useState(getToday());

  // ── Report / drill state ─────────────────────────────────────────────────
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [message, setMessage] = useState("Select filters and generate the report.");

  const [drillStack, setDrillStack] = useState<DrillState[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ── Report preview dialog state (replaces the old popup window) ──────────
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

  // ── postMessage listener for drill-down clicks ────────────────────────────
  // The report HTML now renders directly inside ReportPreviewDialog's iframe
  // (a child of THIS page), so window.parent from the report already points
  // here — no popup-window relay script is needed any more.
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "PNL_DRILL_DOWN") return;

      setDrillLoading(true);
      setReportError(null);
      // Clear the preview URL so the dialog shows its own loading state
      // while the drill-down HTML is being fetched.
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

  // ── Keep the dialog's blob URL in sync with whatever should be showing ───
  // (root report, or the current top of the drill-down stack).
  useEffect(() => {
    if (!previewOpen) return;
    if (drillLoading) return; // dialog shows its own spinner meanwhile
    if (activeHtml === null || activeHtml === undefined) return; // still generating root report

    const blob = new Blob([activeHtml], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) window.URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, activeHtml, drillLoading]);

  // Revoke the blob URL on unmount.
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
  });

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    setDrillStack([]);
    setMessage("");

    // Open the dialog right away — it shows its own loading spinner until
    // previewUrl is populated by the sync effect above.
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

  const handleReset = () => {
    setDivision("");
    setDateFrom(getStartOfYear());
    setDateTo(getToday());
    setReportError(null);
    setMessage("Select filters and generate the report.");
    closePreview();
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

  const pageTitle = "Profit & Loss";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="freight-ui-standard freight-report-screen">
      <div className="freight-report-card">
        <div className="freight-report-titlebar">
          <h1>{pageTitle}</h1>
          <span className="freight-report-title-dot" aria-hidden="true" />
          <div className="freight-report-title-actions flex flex-wrap items-center gap-2">
            {division && <SummaryBadge label="Division" value={division} strong />}
          </div>
        </div>

        <ReportFilterHeader onClear={handleReset} />

        <div className="freight-report-summary grid grid-cols-2 gap-2 border-b bg-muted/10 p-3 md:grid-cols-3">
          <SummaryStripItem
            icon={CalendarDays}
            label="Period"
            value={`${toDisplayDate(dateFrom) || "Start"} – ${toDisplayDate(dateTo) || "Today"}`}
          />
          <SummaryStripItem
            icon={Building2}
            label="Division"
            value={division ? `${division}${divisionName ? ` - ${divisionName}` : ""}` : "All divisions"}
          />
          <SummaryStripItem icon={BarChart3} label="Report" value={pageTitle} />
        </div>

        {/* Fixed: was "md:grid-cols-2 xl:grid-cols-4" which split the 3 fields
            across two rows on medium screens. Now fixed to 3 columns so
            Division / From / To always sit in a single row from md upward. */}
        <div className="freight-report-fields grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
          <Field label="Division">
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              disabled={divisionLoading}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm disabled:opacity-50"
            >
              <option value="">— All Divisions —</option>
              {divisionList.map((d) => (
                <option key={d.div_code} value={d.div_code}>
                  {d.div_code} – {d.div_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="From" required>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground shadow-sm"
            />
          </Field>

          <Field label="To" required>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground shadow-sm"
            />
          </Field>
        </div>

        <div className="freight-report-actions">
          <PrimaryButton onClick={handleGenerate} disabled={!canGenerate || reportLoading}>
            {reportLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {reportLoading ? "Generating..." : "Generate Report"}
          </PrimaryButton>
        </div>
        {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
        {reportError && !previewOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive">{reportError}</p>
        ) : null}
      </div>

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