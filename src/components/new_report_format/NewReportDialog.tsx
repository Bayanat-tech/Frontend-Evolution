import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Download,
  ExternalLink,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  Printer,
  RotateCcw,
  Maximize2,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { NewReportDialogProps } from "./types";

type Orientation = "portrait" | "landscape";

/**
 * A4 at 96dpi (CSS px). Matches browser print page size.
 * 210mm ≈ 794px, 297mm ≈ 1123px
 */
const PAGE_SIZE: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 794, h: 1123 },
  landscape: { w: 1123, h: 794 },
};

/** 8mm margin used by the report @page rule ≈ 30px at 96dpi */
const PAGE_MARGIN_PX = 30;

/**
 * Report preview modal with:
 * - Portrait / Landscape dropdown
 * - Real page breaks based on HTML content height
 * - Toolbar page indicator + left thumbnails driven by page count
 * - Optional headerSlot for drill-down breadcrumbs / alerts (does not affect print/measure)
 */
export function NewReportDialog({
  open,
  onClose,
  title,
  htmlContent,
  loading = false,
  error = null,
  meta,
  onExportExcel,
  exportingExcel = false,
  onOpenInNewWindow,
  onDownloadPdf,
  headerSlot,
}: NewReportDialogProps) {
  const measureRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageSheetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [zoom, setZoom] = useState(74);
  const [page, setPage] = useState(1);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [totalPages, setTotalPages] = useState(1);
  const [measuring, setMeasuring] = useState(false);
  /** Left page-thumb navbar visible */
  const [navOpen, setNavOpen] = useState(true);

  const pageW = PAGE_SIZE[orientation].w;
  const pageH = PAGE_SIZE[orientation].h;
  /** Content area inside the 8mm print margins */
  const contentW = pageW - PAGE_MARGIN_PX * 2;
  const contentH = pageH - PAGE_MARGIN_PX * 2;

  /**
   * Build HTML for preview that mirrors browser Print layout:
   * - Force the report's @media print rules on screen
   * - Constrain to A4 page width for the selected orientation
   * - Same margins as @page { margin: 8mm }
   */
  const preparedHtml = useMemo(() => {
    if (!htmlContent) return null;

    const inject = `
<style id="nr-page-style">
  /* ── Screen preview = same look as browser Print ── */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    width: ${contentW}px !important;
    max-width: ${contentW}px !important;
    min-width: ${contentW}px !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
    overflow-y: visible !important;
    font-family: Arial, sans-serif !important;
    font-size: 10px !important;
    color: #000 !important;
  }
  .sheet {
    width: ${contentW}px !important;
    max-width: ${contentW}px !important;
    min-width: ${contentW}px !important;
    margin: 0 !important;
    padding: 6mm !important;
    background: #ffffff !important;
    overflow: visible !important;
  }
  * { box-sizing: border-box; }
  table {
    width: 100% !important;
    max-width: 100% !important;
    font-size: 9px !important;
    border-collapse: collapse !important;
  }
  th, td {
    white-space: nowrap !important;
  }
  thead { display: table-header-group !important; }
  tfoot { display: table-footer-group !important; }
  .actions { display: none !important; }
  img, svg { max-width: 100% !important; height: auto !important; }

  /* Keep real print consistent with dialog orientation */
  @media print {
    @page { size: A4 ${orientation}; margin: 8mm; }
    html, body {
      background: white !important;
      overflow: visible !important;
      font-size: 10px !important;
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
    }
    .sheet {
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
      padding: 6mm !important;
      overflow: visible !important;
    }
    table { font-size: 9px !important; }
    th, td { white-space: nowrap !important; }
  }
</style>`;

    if (/<head[^>]*>/i.test(htmlContent)) {
      return htmlContent.replace(/<head[^>]*>/i, (m) => `${m}${inject}`);
    }
    if (/<html[^>]*>/i.test(htmlContent)) {
      return htmlContent.replace(/<html[^>]*>/i, (m) => `${m}<head>${inject}</head>`);
    }
    return `<!DOCTYPE html><html><head>${inject}</head><body>${htmlContent}</body></html>`;
  }, [htmlContent, contentW, orientation]);

  const [contentHeight, setContentHeight] = useState(0);

  // Measure real content height only (never use iframe chrome height)
  const remeasure = useCallback(() => {
    const iframe = measureRef.current;
    if (!iframe || !preparedHtml) {
      setTotalPages(1);
      setContentHeight(0);
      return;
    }
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc?.body) return;

      const sheet = doc.querySelector(".sheet") as HTMLElement | null;
      // Prefer .sheet; fall back to body. Avoid documentElement (tracks iframe box).
      let height = 0;
      if (sheet) {
        height = Math.ceil(
          Math.max(sheet.scrollHeight, sheet.offsetHeight, sheet.getBoundingClientRect().height)
        );
      } else {
        height = Math.ceil(Math.max(doc.body.scrollHeight, doc.body.offsetHeight));
      }

      // Guard against absurd values from layout glitches
      if (!height || height < 50) height = contentH;
      if (height > 500000) height = contentH;

      setContentHeight(height);
      const pages = Math.max(1, Math.ceil(height / contentH));
      setTotalPages(pages);
      setPage((p) => Math.min(p, pages));
    } catch {
      setTotalPages(1);
      setContentHeight(contentH);
    }
  }, [preparedHtml, contentH]);

  useEffect(() => {
    if (!open) {
      setZoom(74);
      setPage(1);
      setTotalPages(1);
      setOrientation("landscape");
      setMeasuring(false);
      setNavOpen(true);
    }
  }, [open]);

  // When htmlContent changes (e.g. drill-down navigation), reset page + remeasure
  useEffect(() => {
    if (!open || !htmlContent) return;
    setPage(1);
    setMeasuring(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [htmlContent, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setPage((p) => {
          const n = Math.max(1, p - 1);
          requestAnimationFrame(() => {
            pageSheetRefs.current[n - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return n;
        });
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setPage((p) => {
          const n = Math.min(totalPages, p + 1);
          requestAnimationFrame(() => {
            pageSheetRefs.current[n - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return n;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, totalPages]);

  // Reset page when orientation changes
  useEffect(() => {
    setPage(1);
    setMeasuring(true);
  }, [orientation]);

  const onIframeLoad = () => {
    const iframe = measureRef.current;
    // Expand measure frame so scrollHeight reflects full content, not the iframe box
    if (iframe) {
      try {
        iframe.style.height = "10px";
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          // Suppress window.print() from report HTML while measuring (same as IframeReportRenderer)
          const win = iframe.contentWindow as Window & { print?: () => void };
          if (win && typeof win.print === "function") {
            const originalPrint = win.print.bind(win);
            win.print = () => {};
            // Restore after a tick so accidental auto-print is blocked only on load
            setTimeout(() => {
              try {
                win.print = originalPrint;
              } catch {
                /* ignore */
              }
            }, 500);
          }

          const h = Math.max(
            doc.body.scrollHeight,
            (doc.querySelector(".sheet") as HTMLElement | null)?.scrollHeight ?? 0
          );
          iframe.style.height = `${Math.max(h, 100)}px`;
        }
      } catch {
        /* ignore */
      }
    }
    requestAnimationFrame(() => {
      remeasure();
      setMeasuring(false);
    });
  };

  // Re-measure if content string changes
  useEffect(() => {
    if (preparedHtml) setMeasuring(true);
  }, [preparedHtml]);

  // Thumbnail list — MUST stay above any early return (Rules of Hooks)
  const thumbPages = useMemo(() => {
    const maxThumbs = 30;
    if (totalPages <= maxThumbs) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const set = new Set<number>();
    for (let i = 1; i <= 3; i++) set.add(i);
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
      set.add(i);
    }
    for (let i = totalPages - 2; i <= totalPages; i++) {
      if (i >= 1) set.add(i);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [totalPages, page]);

  if (!open) return null;

  /**
   * Print on the same screen — no new tab.
   * Hidden iframe with allow-modals so the browser print dialog can open.
   */
  const handlePrint = () => {
    const html = preparedHtml || htmlContent;
    if (!html) return;

    const PRINT_IFRAME_ID = "nr-print-iframe";
    let iframe = document.getElementById(PRINT_IFRAME_ID) as HTMLIFrameElement | null;

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = PRINT_IFRAME_ID;
      iframe.setAttribute(
        "sandbox",
        "allow-same-origin allow-scripts allow-modals"
      );
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);
    }

    const doPrint = () => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        /* ignore */
      }
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    if (iframe.contentDocument?.readyState === "complete") {
      setTimeout(doPrint, 300);
    } else {
      iframe.onload = () => setTimeout(doPrint, 300);
      setTimeout(doPrint, 700);
    }
  };

  const goToPage = (n: number) => {
    const clamped = Math.max(1, Math.min(totalPages, n));
    setPage(clamped);
    const el = pageSheetRefs.current[clamped - 1];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const goPrev = () => goToPage(page - 1);
  const goNext = () => goToPage(page + 1);

  /** Update active page from scroll position */
  const onScrollPreview = () => {
    const root = scrollRef.current;
    if (!root || totalPages < 1) return;
    const scrollTop = root.scrollTop + 40;
    const sheets = pageSheetRefs.current;
    let best = 1;
    for (let i = 0; i < sheets.length; i++) {
      const el = sheets[i];
      if (!el) continue;
      if (el.offsetTop <= scrollTop) best = i + 1;
    }
    if (best !== page) setPage(best);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "20px 28px",
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        boxSizing: "border-box",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1280,
          height: "100%",
          maxHeight: "calc(100vh - 40px)",
          background: "#ffffff",
          borderRadius: 10,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "12px 18px 10px",
            borderBottom: "1px solid #e5e7eb",
            flexShrink: 0,
            background: "#fff",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "#64748b",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Report Preview
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#0f172a",
                lineHeight: 1.25,
              }}
            >
              {title}
            </div>
          </div>

          {/* Orientation dropdown — top right of header area */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#64748b",
                fontWeight: 500,
              }}
            >
              View
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                disabled={loading || !htmlContent}
                style={{
                  height: 32,
                  padding: "0 28px 0 10px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0f172a",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Optional slot: drill breadcrumbs, loading/error banners — does not affect page measure/print */}
        {headerSlot != null && headerSlot !== false && (
          <div
            style={{
              flexShrink: 0,
              borderBottom: "1px solid #e5e7eb",
              background: "#fff",
            }}
          >
            {headerSlot}
          </div>
        )}

        {/* Dark toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "#1f2937",
            color: "#f1f5f9",
            flexShrink: 0,
            minHeight: 40,
          }}
        >
          <button
            type="button"
            style={{
              ...toolIconBtn,
              background: navOpen ? "#374151" : "transparent",
            }}
            title={navOpen ? "Hide page navigator" : "Show page navigator"}
            onClick={() => setNavOpen((v) => !v)}
          >
            <Menu size={15} />
          </button>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 160,
            }}
          >
            {title}
          </span>

          {/* Page nav */}
          <button
            type="button"
            onClick={goPrev}
            disabled={page <= 1}
            style={{ ...toolIconBtn, opacity: page <= 1 ? 0.35 : 1 }}
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "#374151",
              borderRadius: 4,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 500,
              minWidth: 52,
              justifyContent: "center",
            }}
          >
            <span>{page}</span>
            <span style={{ opacity: 0.55 }}>/</span>
            <span>{measuring ? "…" : totalPages}</span>
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={page >= totalPages}
            style={{ ...toolIconBtn, opacity: page >= totalPages ? 0.35 : 1 }}
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>

          {/* Zoom */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 4 }}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(40, z - 10))}
              style={toolIconBtn}
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: 12, minWidth: 38, textAlign: "center", fontWeight: 500 }}>
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              style={toolIconBtn}
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 11, color: "#9ca3af", marginRight: 4 }}>
            {orientation === "portrait" ? "A4 Portrait" : "A4 Landscape"}
          </span>

          <button type="button" onClick={handlePrint} style={toolIconBtn} title="Print">
            <Printer size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(orientation === "portrait" ? 74 : 60)}
            style={toolIconBtn}
            title="Reset zoom"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            style={toolIconBtn}
            title="100%"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
            background: "#111827",
          }}
        >
          {/* Collapsible page navigator — real mini previews of each page */}
          <div
            style={{
              width: navOpen ? (orientation === "portrait" ? 100 : 132) : 0,
              minWidth: navOpen ? (orientation === "portrait" ? 100 : 132) : 0,
              background: "#1f2937",
              borderRight: navOpen ? "1px solid #374151" : "none",
              padding: navOpen ? "12px 8px" : 0,
              overflowY: "auto",
              overflowX: "hidden",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "center",
              transition: "width 0.2s ease, min-width 0.2s ease, padding 0.2s ease",
            }}
          >
            {navOpen &&
              thumbPages.map((n, idx) => {
                const prev = thumbPages[idx - 1];
                const showGap = prev != null && n - prev > 1;
                // Thumbnail sheet size (fits nav column)
                const thumbW = orientation === "portrait" ? 72 : 108;
                const thumbH = orientation === "portrait" ? 102 : 76;
                // Scale full A4 page into the thumb
                const scale = thumbW / pageW;
                const offsetY = -(n - 1) * contentH;
                const isLast = n === totalPages;
                const remaining =
                  contentHeight > 0
                    ? Math.max(contentHeight - (n - 1) * contentH, 0)
                    : contentH;
                const sliceH = isLast
                  ? Math.min(contentH, Math.max(remaining, 80))
                  : contentH;

                return (
                  <React.Fragment key={`thumb-${n}-${orientation}`}>
                    {showGap && (
                      <span style={{ fontSize: 10, color: "#6b7280" }}>···</span>
                    )}
                    <button
                      type="button"
                      onClick={() => goToPage(n)}
                      title={`Go to page ${n}`}
                      style={{
                        width: thumbW,
                        height: thumbH,
                        border:
                          page === n ? "2px solid #3b82f6" : "1px solid #4b5563",
                        borderRadius: 4,
                        overflow: "hidden",
                        background: "#ffffff",
                        padding: 0,
                        cursor: "pointer",
                        position: "relative",
                        flexShrink: 0,
                        boxShadow:
                          page === n
                            ? "0 0 0 1px rgba(59,130,246,0.4)"
                            : "none",
                      }}
                    >
                      {/* Mini report preview: same HTML, clipped to this page, scaled down */}
                      {preparedHtml && !loading ? (
                        <div
                          style={{
                            width: pageW,
                            height: pageH,
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                            pointerEvents: "none",
                            overflow: "hidden",
                            background: "#fff",
                          }}
                        >
                          <div
                            style={{
                              width: pageW,
                              height: Math.min(pageH, sliceH + PAGE_MARGIN_PX * 2),
                              overflow: "hidden",
                              boxSizing: "border-box",
                              padding: PAGE_MARGIN_PX,
                              background: "#fff",
                            }}
                          >
                            <div
                              style={{
                                width: contentW,
                                height: sliceH,
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              <iframe
                                title={`thumb-page-${n}`}
                                srcDoc={preparedHtml}
                                tabIndex={-1}
                                style={{
                                  width: contentW,
                                  height: Math.max(contentHeight, contentH),
                                  border: "none",
                                  display: "block",
                                  background: "#fff",
                                  transform: `translateY(${offsetY}px)`,
                                  pointerEvents: "none",
                                }}
                                sandbox="allow-same-origin"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            background: "#f8fafc",
                          }}
                        />
                      )}
                      <span
                        style={{
                          position: "absolute",
                          bottom: 2,
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: page === n ? "#3b82f6" : "#0f172a",
                          background: "rgba(255,255,255,0.9)",
                          padding: "0 5px",
                          borderRadius: 3,
                          lineHeight: "16px",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                        }}
                      >
                        {n}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
          </div>

          {/* Scrollable multi-page preview */}
          <div
            ref={scrollRef}
            onScroll={onScrollPreview}
            style={{
              flex: 1,
              overflow: "auto",
              background: "#374151",
              padding: "20px 24px 40px",
            }}
          >
            {loading && (
              <div style={centerMsg}>
                <span style={spinner} />
                Generating report…
              </div>
            )}

            {!loading && error && (
              <div
                style={{
                  marginTop: 80,
                  marginLeft: "auto",
                  marginRight: "auto",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  padding: "16px 24px",
                  borderRadius: 8,
                  fontSize: 13,
                  maxWidth: 420,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {!loading && !error && preparedHtml && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease",
                  // Keep scroll height correct after CSS scale
                  marginBottom: `${Math.max(0, (zoom / 100 - 1) * (Math.max(contentHeight, contentH) + totalPages * 24 + pageH))}px`,
                }}
              >
                {/*
                  One continuous report, split visually into A4 sheets.
                  Each sheet clips a slice of the same content via translateY.
                  Measure iframe runs report scripts (drill postMessage) with
                  sandbox allow-scripts allow-same-origin so DRILL_DOWN works.
                */}
                <iframe
                  ref={measureRef}
                  title={`${title}-measure`}
                  srcDoc={preparedHtml}
                  onLoad={onIframeLoad}
                  style={{
                    position: "absolute",
                    left: -9999,
                    top: 0,
                    width: contentW,
                    height: 50,
                    opacity: 0,
                    pointerEvents: "none",
                    border: "none",
                  }}
                  sandbox="allow-same-origin allow-scripts"
                />

                {Array.from({ length: totalPages }, (_, i) => {
                  const pageNum = i + 1;
                  const offsetY = -i * contentH;
                  // Last page may be shorter than a full sheet
                  const isLast = pageNum === totalPages;
                  const remaining =
                    contentHeight > 0
                      ? Math.max(contentHeight - i * contentH, 0)
                      : contentH;
                  const sliceH = isLast
                    ? Math.min(contentH, Math.max(remaining, 80))
                    : contentH;
                  const sheetH = sliceH + PAGE_MARGIN_PX * 2;

                  return (
                    <div
                      key={`${pageNum}-${htmlContent?.slice(0, 32) ?? ""}`}
                      ref={(el) => {
                        pageSheetRefs.current[i] = el;
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        marginBottom: 20,
                      }}
                    >
                      <div
                        style={{
                          width: pageW,
                          height: sheetH,
                          overflow: "hidden",
                          background: "#ffffff",
                          boxShadow:
                            page === pageNum
                              ? "0 0 0 2px #3b82f6, 0 8px 30px rgba(0,0,0,0.35)"
                              : "0 8px 30px rgba(0,0,0,0.35)",
                          position: "relative",
                          borderRadius: 1,
                          boxSizing: "border-box",
                          padding: PAGE_MARGIN_PX,
                        }}
                      >
                        <div
                          style={{
                            width: contentW,
                            height: sliceH,
                            overflow: "hidden",
                            position: "relative",
                            background: "#ffffff",
                          }}
                        >
                          <iframe
                            title={`${title}-page-${pageNum}`}
                            srcDoc={preparedHtml}
                            style={{
                              width: contentW,
                              height: Math.max(contentHeight, contentH),
                              border: "none",
                              display: "block",
                              background: "#fff",
                              transform: `translateY(${offsetY}px)`,
                              // pointer-events needed so drill links/buttons inside report work
                              pointerEvents: "auto",
                            }}
                            sandbox="allow-same-origin allow-scripts"
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: page === pageNum ? "#93c5fd" : "#94a3b8",
                          fontWeight: 500,
                        }}
                      >
                        Page {pageNum} of {totalPages}
                        {measuring && pageNum === 1 ? " · measuring…" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !error && !preparedHtml && (
              <div style={{ ...centerMsg, color: "#94a3b8" }}>No report content</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "10px 16px",
            borderTop: "1px solid #e5e7eb",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          <span style={{ marginRight: "auto", fontSize: 12, color: "#94a3b8" }}>
            PDF preview · Esc to close · scroll or ← → for pages · menu toggles navigator
          </span>

          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              disabled={exportingExcel || loading}
              style={{
                ...footerBtn,
                opacity: exportingExcel || loading ? 0.55 : 1,
                cursor: exportingExcel || loading ? "not-allowed" : "pointer",
              }}
            >
              <FileSpreadsheet size={14} strokeWidth={2} />
              {exportingExcel ? "Exporting…" : "Excel"}
            </button>
          )}

          {onOpenInNewWindow && (
            <button type="button" onClick={onOpenInNewWindow} style={footerBtn}>
              <ExternalLink size={14} strokeWidth={2} />
              Open in new window
            </button>
          )}

          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              style={{
                ...footerBtn,
                background: "#1e3a8a",
                borderColor: "#1e3a8a",
                color: "#fff",
              }}
            >
              <Download size={14} strokeWidth={2} />
              Download PDF
            </button>
          )}

          <button type="button" onClick={onClose} style={footerBtn}>
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes nr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const toolIconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "none",
  background: "transparent",
  color: "#e2e8f0",
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const footerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  fontSize: 13,
  fontWeight: 500,
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#334155",
  cursor: "pointer",
};

const centerMsg: React.CSSProperties = {
  marginTop: 80,
  color: "#e2e8f0",
  fontSize: 14,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

const spinner: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid rgba(255,255,255,0.25)",
  borderTopColor: "#fff",
  borderRadius: "50%",
  animation: "nr-spin 0.8s linear infinite",
};

export default NewReportDialog;