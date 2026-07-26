"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RefreshCw, X } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
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

const REPORT_WINDOW_NAME = "pnl_report_window";

// ─── Popup window shell ────────────────────────────────────────────────────────
// The popup gets its own tiny toolbar (Back / Print / Download Excel / Close).
// CRITICAL: it also relays PNL_DRILL_DOWN postMessages coming from the inner
// report iframe up to window.opener (the main app tab). Without this relay,
// drill-down clicks never reach the React app because the iframe's
// `window.parent` is this popup, not the app tab that opened it.

function buildShellHtml(title: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title.replace(/</g, "&lt;")}</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body { font-family: Arial, Helvetica, sans-serif; }
  #toolbar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #1a5f4a;
    color: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    z-index: 10;
  }
  #toolbar button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.15);
    border: none;
    color: #fff;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }
  #toolbar button:hover { background: rgba(255,255,255,0.28); }
  #toolbar button:disabled { opacity: 0.5; cursor: default; }
  #toolbar .title {
    margin-left: 4px;
    font-size: 13px;
    font-weight: 600;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #reportFrame {
    width: 100%;
    height: calc(100vh - 46px);
    border: none;
    display: block;
  }
  @media print {
    #toolbar { display: none !important; }
    #reportFrame { height: 100vh; }
  }
</style>
</head>
<body>
  <div id="toolbar">
    <button id="btnBack" style="display:none;">&larr; Back</button>
    <span class="title" id="titleSpan">${title.replace(/</g, "&lt;")}</span>
    <button id="btnPrint">&#128438; Print</button>
    <button id="btnExcel">Download Excel</button>
    <button id="btnClose">Close</button>
  </div>
  <iframe id="reportFrame"></iframe>
  <script>
    // Relay drill-down messages from the inner report iframe to the app tab
    // that opened this popup. Without this, the iframe's postMessage to
    // window.parent only ever reaches this popup window, never the opener.
    window.addEventListener("message", function (e) {
      var data = e.data;
      if (data && data.type === "PNL_DRILL_DOWN" && window.opener) {
        window.opener.postMessage(data, "*");
      }
    });
  </script>
</body>
</html>`;
}

function getLoadingHtml(label = "Loading…"): string {
  return `<!doctype html><html><body style="display:flex;align-items:center;justify-content:center;height:60vh;font-family:Arial,sans-serif;color:#1a5f4a;font-size:14px">
  <div style="text-align:center">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;display:block;margin:0 auto 12px">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    ${label}
  </div>
</body></html>`;
}

/** Writes report HTML into the popup's inner iframe (keeps toolbar intact). */
function writeReportContent(win: Window, html: string) {
  const doc = win.document;
  const frame = doc.getElementById("reportFrame") as HTMLIFrameElement | null;
  if (!frame) return;
  const frameDoc = frame.contentDocument || frame.contentWindow?.document;
  if (!frameDoc) return;

  const frameWin = frame.contentWindow as any;
  if (frameWin) {
    // Suppress the report's own print() call while (re)writing content.
    const originalPrint = frameWin.print;
    frameWin.print = () => {};
    const restore = () => {
      frameWin.print = originalPrint;
    };
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    if (frameDoc.readyState === "complete") {
      restore();
    } else {
      frame.addEventListener("load", restore, { once: true });
    }
  } else {
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
  }
}

/** Updates the popup toolbar's title + back-button visibility. */
function updateShellChrome(win: Window, title: string, showBack: boolean) {
  const doc = win.document;
  doc.title = title;
  const titleSpan = doc.getElementById("titleSpan");
  if (titleSpan) titleSpan.textContent = title;
  const backBtn = doc.getElementById("btnBack") as HTMLButtonElement | null;
  if (backBtn) backBtn.style.display = showBack ? "inline-flex" : "none";
}

/** Triggers the browser print dialog for just the report iframe's content
 *  (not the popup toolbar around it). */
function printReportFrame(win: Window) {
  const frame = win.document.getElementById("reportFrame") as HTMLIFrameElement | null;
  const frameWin = frame?.contentWindow;
  if (!frameWin) return;
  frameWin.focus();
  frameWin.print();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfitLossPage() {
  const { user } = useAuth();

  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? user?.username ?? "ADMIN";

  // ── Division lookup ──────────────────────────────────────────────────────
  // NOTE: dropdown now matches the Trial Balance page — a plain <select>
  // instead of the old search-as-you-type combobox. Division is optional;
  // an empty selection is sent to the backend as "All" (same fallback the
  // Trial Balance page relies on).
  const [divisionList, setDivisionList] = useState<Division[]>([]);
  const [divisionLoading, setDivisionLoading] = useState(false);
  const [division, setDivision] = useState("");

  // ── Form state ───────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(getStartOfYear());
  const [dateTo, setDateTo] = useState(getToday());

  // ── Report / drill state ─────────────────────────────────────────────────
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [drillStack, setDrillStack] = useState<DrillState[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ── Popup window plumbing ────────────────────────────────────────────────
  const reportWinRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  const onBackRef = useRef<() => void>(() => {});
  const onExcelRef = useRef<() => void>(() => {});
  const onPrintRef = useRef<() => void>(() => {});
  const onCloseRef = useRef<() => void>(() => {});

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

  // ── postMessage listener for drill-down clicks (relayed from the popup) ──
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

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleCloseReport = useCallback(() => {
    stopPolling();
    if (reportWinRef.current && !reportWinRef.current.closed) {
      reportWinRef.current.close();
    }
    reportWinRef.current = null;
    setReportHtml(null);
    setDrillStack([]);
  }, []);

  const handleDrillBack = useCallback(() => {
    setDrillStack((prev) => prev.slice(0, -1));
    setReportError(null);
  }, []);

  const buildPayload = useCallback(
    () => ({
      parameter: "ProfitLoss",
      loginid: loginId,
      company_code: companyCode,
      division_code: division || "All",
      from_date: dateFrom,
      to_date: dateTo,
    }),
    [companyCode, loginId, division, dateFrom, dateTo]
  );

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

  const handleExcel = useCallback(async () => {
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
  }, [currentDrill, buildPayload]);

  /** Prints whatever is currently shown in the popup's report iframe
   *  (base report or the current drill-down level), not the toolbar. */
  const handlePrint = useCallback(() => {
    const win = reportWinRef.current;
    if (!win || win.closed) return;
    printReportFrame(win);
  }, []);

  useEffect(() => {
    onBackRef.current = handleDrillBack;
  }, [handleDrillBack]);
  useEffect(() => {
    onExcelRef.current = handleExcel;
  }, [handleExcel]);
  useEffect(() => {
    onPrintRef.current = handlePrint;
  }, [handlePrint]);
  useEffect(() => {
    onCloseRef.current = handleCloseReport;
  }, [handleCloseReport]);

  /** Opens (or reuses) the popup window and wires up its toolbar buttons. */
  const ensureReportWindow = (title: string): Window | null => {
    let win = reportWinRef.current;
    if (!win || win.closed) {
      // No size/feature string => opens as a normal tab with address bar,
      // back/forward, etc. instead of a stripped-down popup window.
      win = window.open("", REPORT_WINDOW_NAME);
      reportWinRef.current = win;
    }
    if (!win) {
      setReportError(
        "Unable to open the report window. Please allow pop-ups for this site."
      );
      return null;
    }

    win.document.open();
    win.document.write(buildShellHtml(title));
    win.document.close();

    const btnBack = win.document.getElementById("btnBack");
    const btnExcel = win.document.getElementById("btnExcel");
    const btnPrint = win.document.getElementById("btnPrint");
    const btnClose = win.document.getElementById("btnClose");
    if (btnBack) btnBack.onclick = () => onBackRef.current();
    if (btnExcel) btnExcel.onclick = () => onExcelRef.current();
    if (btnPrint) btnPrint.onclick = () => onPrintRef.current();
    if (btnClose) btnClose.onclick = () => onCloseRef.current();

    stopPolling();
    pollRef.current = window.setInterval(() => {
      if (win && win.closed) {
        stopPolling();
        reportWinRef.current = null;
        setReportHtml(null);
        setDrillStack([]);
      }
    }, 500);

    return win;
  };

  const handleReset = () => {
    setDivision("");
    setDateFrom(getStartOfYear());
    setDateTo(getToday());
    setReportError(null);
    handleCloseReport();
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setReportLoading(true);
    setReportError(null);
    setReportHtml(null);
    setDrillStack([]);

    // Open the window synchronously (in direct response to the click) so
    // browsers don't treat it as a blocked popup.
    const win = ensureReportWindow("Profit & Loss");
    if (win) writeReportContent(win, getLoadingHtml("Generating report…"));

    try {
      const html = await getProfitLossReportHtml(buildPayload());
      setReportHtml(html);
      if (reportWinRef.current && !reportWinRef.current.closed) {
        writeReportContent(reportWinRef.current, html);
        updateShellChrome(reportWinRef.current, "Profit & Loss", false);
      }
    } catch (err: any) {
      const message = err?.message ?? "Failed to generate report";
      setReportError(message);
      if (reportWinRef.current && !reportWinRef.current.closed) {
        writeReportContent(
          reportWinRef.current,
          getLoadingHtml(`Error: ${message.replace(/</g, "&lt;")}`)
        );
      }
    } finally {
      setReportLoading(false);
    }
  };

  // Keep the popup's content in sync with drill-down state changes.
  useEffect(() => {
    const win = reportWinRef.current;
    if (!win || win.closed) return;
    if (activeHtml === null) return;

    updateShellChrome(win, dialogTitle, drillStack.length > 0);
    writeReportContent(
      win,
      drillLoading ? getLoadingHtml("Loading drill-down data…") : activeHtml
    );
  }, [activeHtml, dialogTitle, drillStack.length, drillLoading]);

  // Close the popup and stop polling if this component unmounts.
  useEffect(() => {
    return () => {
      stopPolling();
      if (reportWinRef.current && !reportWinRef.current.closed) {
        reportWinRef.current.close();
      }
    };
  }, []);

  const pageTitle = "Profit & Loss";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">

            {/* Division — plain select, same pattern as Trial Balance page */}
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
                Division
              </span>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                disabled={divisionLoading}
                className="h-8 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
              >
                <option value="">— All Divisions —</option>
                {divisionList.map((d) => (
                  <option key={d.div_code} value={d.div_code}>
                    {d.div_code} – {d.div_name}
                  </option>
                ))}
              </select>
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
  );
}