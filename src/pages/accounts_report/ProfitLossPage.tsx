"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RefreshCw, X, Search, ChevronLeft } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup } from "../../api/lookups";
import ReportDialogPage from "../../components/ReportDialogPage";
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

// ─── Iframe renderer ──────────────────────────────────────────────────────────

function IframeReportRenderer({
  required_values,
}: {
  required_values: { html: string };
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const win = iframe.contentWindow as any;
    let originalPrint: (() => void) | undefined;
    if (win) {
      originalPrint = win.print;
      win.print = () => {};
    }

    doc.open();
    doc.write(required_values.html);
    doc.close();

    const restorePrint = () => {
      if (win && originalPrint) win.print = originalPrint;
    };
    if (doc.readyState === "complete") {
      restorePrint();
    } else {
      iframe.addEventListener("load", restorePrint, { once: true });
    }
  }, [required_values.html]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: "100%", minHeight: "70vh", border: "none" }}
      title="report"
    />
  );
}

// ─── Drill-back overlay button (renders on top of the dialog) ─────────────────

function DrillBackButton({ onClick }: { onClick: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "72px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
      }}
    >
      <button
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 12px",
          fontSize: "11px",
          fontWeight: 600,
          background: "#1a5f4a",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        Back
      </button>
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
  const [divisionSearch, setDivisionSearch] = useState("");
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);
  const [division, setDivision] = useState("");
  const [divisionDisplay, setDivisionDisplay] = useState("");

  // ── Form state ───────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(getStartOfYear());
  const [dateTo, setDateTo] = useState(getToday());

  // ── Report / drill state ─────────────────────────────────────────────────
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Drill-down stack: each entry is a level pushed on top
  const [drillStack, setDrillStack] = useState<DrillState[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const filteredDivisions = divisionList.filter((d) =>
    `${d.div_code} ${d.div_name}`
      .toLowerCase()
      .includes(divisionSearch.toLowerCase())
  );
  const canGenerate = Boolean(division && dateFrom && dateTo);
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

  // ── postMessage listener for drill-down clicks inside the iframe ─────────
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "PNL_DRILL_DOWN") return;

      setDrillLoading(true);
      setReportError(null);

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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleReset = () => {
    setDivision("");
    setDivisionDisplay("");
    setDivisionSearch("");
    setDateFrom(getStartOfYear());
    setDateTo(getToday());
    setReportHtml(null);
    setReportError(null);
    setDrillStack([]);
  };

  const buildPayload = useCallback(
    () => ({
      parameter: "ProfitLoss",
      loginid: loginId,
      company_code: companyCode,
      division_code: division,
      from_date: dateFrom,
      to_date: dateTo,
    }),
    [companyCode, loginId, division, dateFrom, dateTo]
  );

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    setDrillStack([]);
    try {
      const html = await getProfitLossReportHtml(buildPayload());
      setReportHtml(html);
    } catch (err: any) {
      setReportError(err?.message ?? "Failed to generate report");
    } finally {
      setReportLoading(false);
    }
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
    }
  };

  const handleDrillBack = () => {
    setDrillStack((prev) => prev.slice(0, -1));
    setReportError(null);
  };

  const handleCloseReport = () => {
    setReportHtml(null);
    setDrillStack([]);
  };

  const pageTitle = "Profit & Loss";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="grid gap-4">

        {/* Page Header */}
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
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

        {/* Error Banner */}
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

        {/* Filters Card */}
        <Card className="border-border shadow-sm overflow-visible">
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
          <CardContent className="px-4 py-3 overflow-visible">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 overflow-visible">

              {/* Division searchable select */}
              <label className="flex flex-col gap-1.5 sm:col-span-2 overflow-visible">
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
                  Division <strong className="text-destructive">*</strong>
                </span>
                <div className="relative z-50 overflow-visible">
                  <div className="flex items-center gap-2 rounded border border-input bg-background px-2">
                    <Search size={13} className="text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={divisionLoading ? "Loading…" : "Search division…"}
                      value={showDivisionDropdown ? divisionSearch : divisionDisplay}
                      onChange={(e) => {
                        setDivisionSearch(e.target.value);
                        setShowDivisionDropdown(true);
                      }}
                      onFocus={() => setShowDivisionDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowDivisionDropdown(false), 200)
                      }
                      disabled={divisionLoading}
                      className="h-8 w-full bg-transparent text-[11px] text-foreground outline-none disabled:opacity-50"
                    />
                  </div>
                  {showDivisionDropdown && filteredDivisions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-52 overflow-y-auto rounded border border-border bg-background shadow-lg">
                      {filteredDivisions.map((d) => (
                        <button
                          key={d.div_code}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-muted/40"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDivision(d.div_code);
                            setDivisionDisplay(`${d.div_code} – ${d.div_name}`);
                            setDivisionSearch("");
                            setShowDivisionDropdown(false);
                            setReportError(null);
                          }}
                        >
                          <span className="w-20 flex-shrink-0 font-medium">{d.div_code}</span>
                          <span className="truncate text-muted-foreground">{d.div_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {/* From Date */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  From Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

              {/* To Date */}
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  To Date <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </label>

            </div>
          </CardContent>
        </Card>

      </section>

      {/* ── Back button floats over the dialog when drilling down ── */}
      {activeHtml !== null && drillStack.length > 0 && (
        <DrillBackButton onClick={handleDrillBack} />
      )}

      {/* ── Report Dialog ── */}
      {activeHtml !== null && (
        <ReportDialogPage
          title={dialogTitle}
          Report={IframeReportRenderer}
          required_values={{ html: drillLoading ? getLoadingHtml() : activeHtml! }}
          excel={handleExcel}
          onClose={handleCloseReport}
        />
      )}
    </>
  );
}

// ─── Loading placeholder HTML ─────────────────────────────────────────────────

function getLoadingHtml(): string {
  return `<!doctype html><html><body style="display:flex;align-items:center;justify-content:center;height:60vh;font-family:Arial,sans-serif;color:#1a5f4a;font-size:14px">
  <div style="text-align:center">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;display:block;margin:0 auto 12px">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    Loading drill-down data…
  </div>
</body></html>`;
}