import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  X,
  ExternalLink,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  Printer,
  Search,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { NewReportDialogProps } from "./types";

type Orientation = "portrait" | "landscape";

/* ───────────────────────── Responsive helpers ───────────────────────── */

type Breakpoint = "mobile" | "tablet" | "desktop";

const readBreakpoint = (): Breakpoint => {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
};

/** mobile < 640px · tablet < 1024px · desktop otherwise */
function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(readBreakpoint);
  useEffect(() => {
    const onResize = () => setBp(readBreakpoint());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return bp;
}

/**
 * Two-finger pinch zoom. `map` converts the pinch centre (in the target's own
 * client coordinates) into parent-window client coordinates; `zoomBy` is the
 * existing anchored zoom (dy > 0 zooms out, dy < 0 zooms in).
 */
const attachPinch = (
  target: EventTarget,
  map: (x: number, y: number) => [number, number],
  zoomBy: (dy: number, clientX: number, clientY: number) => void
) => {
  let last = 0;
  const dist = (t: TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const start = (e: Event) => {
    const t = (e as TouchEvent).touches;
    last = t.length === 2 ? dist(t) : 0;
  };
  const move = (e: Event) => {
    const t = (e as TouchEvent).touches;
    if (t.length !== 2 || !last) return;
    e.preventDefault();
    const d = dist(t);
    const [x, y] = map((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
    zoomBy(-Math.log(d / last) * 100, x, y);
    last = d;
  };
  const end = () => {
    last = 0;
  };
  target.addEventListener("touchstart", start, { passive: true });
  target.addEventListener("touchmove", move, { passive: false });
  target.addEventListener("touchend", end);
  target.addEventListener("touchcancel", end);
  return () => {
    target.removeEventListener("touchstart", start);
    target.removeEventListener("touchmove", move);
    target.removeEventListener("touchend", end);
    target.removeEventListener("touchcancel", end);
  };
};

/**
 * Pagination of the report. Header (thead) and footer (tfoot) of the report's
 * outer `table.report-shell` are repeated on every page; only the body (tbody)
 * is sliced. Coordinates are in the report document (CSS px).
 */
type PageLayout = {
  headerTop: number;
  headerH: number;
  footerTop: number;
  footerH: number;
  /** `repeat` = column-header (thead) window of the table a page continues, drawn above the slice */
  pages: { start: number; end: number; repeat?: { top: number; h: number } }[];
};

const EMPTY_LAYOUT: PageLayout = { headerTop: 0, headerH: 0, footerTop: 0, footerH: 0, pages: [] };

/**
 * A4 at 96dpi (CSS px). Matches browser print page size.
 * 210mm ≈ 794px, 297mm ≈ 1123px
 */
const PAGE_SIZE: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 794, h: 1123 },
  landscape: { w: 1123, h: 794 },
};

/** Fallback margin if the report HTML does not specify one */
const DEFAULT_PAGE_MARGIN_MM = 8;

/**
 * What "100%" means in the toolbar. 1 = page fits the full preview width;
 * 0.9 = 100% shows what used to be the 90% view (page slightly narrower than the preview).
 */
const BASE_VIEW_RATIO = 0.9;

/**
 * Single font size (CSS px) forced on all report text inside the dialog
 * (headings h1–h6 keep their own sizes). Change this one value to resize every report.
 */
const REPORT_FONT_PX = 9;

/**
 * Detect orientation from the report's @page rule,
 * e.g. `@page { size: A4 landscape; }` → "landscape"
 */
const detectOrientation = (html: string): Orientation => {
  const m = html.match(/@page\s*\{[^}]*?size\s*:\s*(?:A4\s+)?(portrait|landscape)/is);
  if (m) return m[1].toLowerCase() as Orientation;
  return /size[^;{]*landscape/i.test(html) ? "landscape" : "portrait";
};

/**
 * Detect page margin (mm) from the report's @page rule,
 * e.g. `@page { margin: 10mm; }` → 10
 */
const detectPageMarginMm = (html: string): number => {
  const m = html.match(/@page\s*\{[^}]*?margin\s*:\s*([\d.]+)\s*mm/is);
  if (m) {
    const v = parseFloat(m[1]);
    if (!isNaN(v) && v > 0) return v;
  }
  return DEFAULT_PAGE_MARGIN_MM;
};

const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4);

/**
 * Report preview modal with:
 * - Orientation auto-detected from the report HTML (@page size rule)
 * - Real page breaks based on HTML content height, snapped to table-row boundaries
 * - The report header (logo/company) and footer repeat on every page
 * - Toolbar page indicator + left thumbnails driven by page count
 * - Optional headerSlot for drill-down breadcrumbs / alerts (does not affect print/measure)
 * - 100% zoom = BASE_VIEW_RATIO (90%) of the preview width, centred
 * - Responsive: full-screen on phones, slide-over page navigator, trimmed toolbar, touch pinch-zoom
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
  headerSlot,
}: NewReportDialogProps) {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isCompact = bp !== "desktop";

  const measureRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pageSheetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** Search state */
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [matches, setMatches] = useState<{ y: number }[]>([]);
  const [curMatch, setCurMatch] = useState(-1);
  const searchRef = useRef({ q: "", cur: -1 });
  const matchesRef = useRef<{ y: number }[]>([]);
  const prevQueryRef = useRef("");
  /** Zoom (pinch / ctrl+wheel) helpers */
  const scaleRef = useRef(1);
  const zoomRef = useRef(100);
  const gestureBaseRef = useRef(100);
  const zoomFnRef = useRef<(dy: number, clientX: number, clientY: number) => void>(() => {});
  const zoomAnchor = useRef<{ cx: number; cy: number; cX: number; cY: number } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [totalPages, setTotalPages] = useState(1);
  const [measuring, setMeasuring] = useState(false);
  /** Left page-thumb navbar visible (starts closed on small screens) */
  const [navOpen, setNavOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768
  );
  /** Width of the scrollable preview area (px) — used to fit the page edge to edge */
  const [viewW, setViewW] = useState(0);
  /** Unscaled layout height of the pages wrapper (px) — used to size scroll area after scaling */
  const [layoutH, setLayoutH] = useState(0);

  /** Orientation the report HTML actually declares (auto-detected) */
  const autoOrientation = useMemo<Orientation>(
    () => (htmlContent ? detectOrientation(htmlContent) : "portrait"),
    [htmlContent]
  );

  /** Page margin declared by the report HTML (falls back to 8mm) */
  const pageMarginMm = useMemo(
    () => (htmlContent ? detectPageMarginMm(htmlContent) : DEFAULT_PAGE_MARGIN_MM),
    [htmlContent]
  );
  const pageMarginPx = mmToPx(pageMarginMm);

  const pageW = PAGE_SIZE[orientation].w;
  const pageH = PAGE_SIZE[orientation].h;
  /** Content area inside the report's own print margins */
  const contentW = pageW - pageMarginPx * 2;
  const contentH = pageH - pageMarginPx * 2;

  /** Scale that makes the A4 sheet as wide as the preview area (× BASE_VIEW_RATIO) */
  const baseScale = viewW > 0 ? (viewW / pageW) * BASE_VIEW_RATIO : 1;
  /** Final scale applied to the pages (100% zoom = old 90% view) */
  const scale = baseScale * (zoom / 100);
  scaleRef.current = scale;
  zoomRef.current = zoom;

  /**
   * Build HTML for preview that mirrors browser Print layout:
   * - Force the report's @media print rules on screen
   * - Constrain to A4 page width for the selected orientation
   * - Same margins as the report's @page rule
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
    font-size: ${REPORT_FONT_PX}px !important;
    color: #000 !important;
    /* let the parent handle pinch-zoom; one-finger pan still scrolls */
    touch-action: pan-x pan-y;
  }
  /* One constant font size for all report text (headings excluded) */
  body *:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6):not(script):not(style):not(.company-name):not(.group-title) {
    font-size: ${REPORT_FONT_PX}px !important;
  }
  .sheet {
    width: ${contentW}px !important;
    max-width: ${contentW}px !important;
    min-width: ${contentW}px !important;
    margin: 0 !important;
    padding: ${pageMarginMm}mm !important;
    background: #ffffff !important;
    overflow: visible !important;
  }
  * { box-sizing: border-box; }
  table {
    width: 100% !important;
    max-width: 100% !important;
    font-size: ${REPORT_FONT_PX}px !important;
    border-collapse: collapse !important;
  }
  th, td {
    white-space: nowrap !important;
  }
  thead { display: table-header-group !important; }
  tfoot { display: table-footer-group !important; }
  .actions { display: none !important; }
  /* Search highlights (CSS Custom Highlight API — no DOM changes) */
  ::highlight(nr-search) { background-color: #fde047; color: #000; }
  ::highlight(nr-search-current) { background-color: #f97316; color: #000; }
  img, svg { max-width: 100% !important; height: auto !important; }

  /* Keep real print consistent with dialog orientation */
  @media print {
    @page { size: A4 ${orientation}; margin: ${pageMarginMm}mm; }
    html, body {
      background: white !important;
      overflow: visible !important;
      font-size: ${REPORT_FONT_PX}px !important;
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
    }
    .sheet {
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
      padding: ${pageMarginMm}mm !important;
      overflow: visible !important;
    }
    table { font-size: ${REPORT_FONT_PX}px !important; }
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
  }, [htmlContent, contentW, orientation, pageMarginMm]);

  const [contentHeight, setContentHeight] = useState(0);
  const [layout, setLayout] = useState<PageLayout>(EMPTY_LAYOUT);

  // Measure the report and work out the pages (repeating header/footer, row-snapped breaks)
  const remeasure = useCallback(() => {
    const iframe = measureRef.current;
    if (!iframe || !preparedHtml) {
      setTotalPages(1);
      setContentHeight(0);
      setLayout(EMPTY_LAYOUT);
      return;
    }
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const win = iframe.contentWindow;
      if (!doc?.body || !win) return;

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

      const scrollY = win.pageYOffset || 0;
      const abs = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top + scrollY, bottom: r.bottom + scrollY };
      };

      // The report's outer shell table: thead = header, tfoot = footer, tbody = content
      const head = abs(doc.querySelector("table.report-shell > thead"));
      const foot = abs(doc.querySelector("table.report-shell > tfoot"));
      const bodyEl = doc.querySelector("table.report-shell > tbody");
      const body = abs(bodyEl);

      const headerTop = head ? head.top : 0;
      const headerH = head ? Math.ceil(head.bottom - head.top) : 0;
      const footerTop = foot ? foot.top : 0;
      const footerH = foot ? Math.ceil(foot.bottom - foot.top) : 0;
      const bodyTop = body ? body.top : 0;
      const bodyBottom = body ? body.bottom : height;

      // Body space available on each page once header + footer are reserved
      const areaH = Math.max(contentH - headerH - footerH, 100);

      // Preferred break points: bottoms of table rows (never inside the header rows)
      const root: ParentNode = bodyEl ?? doc.body;
      const cands = Array.from(root.querySelectorAll("tr"))
        .filter((tr) => !tr.closest("thead"))
        .map((tr) => tr.getBoundingClientRect().bottom + scrollY)
        .filter((b) => b > bodyTop + 1 && b < bodyBottom - 0.5)
        .sort((x, y) => x - y);

      // Data tables with a column header: when a page continues such a table,
      // its <thead> is repeated at the top of that page (like print does)
      const heads = Array.from(root.querySelectorAll("table"))
        .filter((t) => !t.classList.contains("report-shell"))
        .map((t) => {
          const th = Array.from(t.children).find((c) => c.tagName === "THEAD") ?? null;
          const h = abs(th);
          const tb = abs(t);
          return h && tb ? { headTop: h.top, headBottom: h.bottom, bottom: tb.bottom } : null;
        })
        .filter((x): x is { headTop: number; headBottom: number; bottom: number } => x !== null);

      const pages: PageLayout["pages"] = [];
      let start = bodyTop;
      while (start < bodyBottom - 0.5 && pages.length < 2000) {
        const rep = heads.find((t) => start > t.headBottom + 0.5 && start < t.bottom - 0.5) ?? null;
        const repH = rep ? Math.ceil(rep.headBottom - rep.headTop) : 0;
        const repeat = rep ? { top: rep.headTop, h: repH } : undefined;
        const maxEnd = start + Math.max(areaH - repH, 100);
        if (maxEnd >= bodyBottom) {
          pages.push({ start, end: bodyBottom, repeat });
          break;
        }
        let end = maxEnd;
        for (let k = cands.length - 1; k >= 0; k--) {
          if (cands[k] <= maxEnd + 0.5 && cands[k] > start + 20) {
            end = cands[k];
            break;
          }
        }
        pages.push({ start, end, repeat });
        start = end;
      }
      if (pages.length === 0) pages.push({ start: bodyTop, end: Math.max(bodyBottom, bodyTop + 1) });

      setLayout({ headerTop, headerH, footerTop, footerH, pages });
      setTotalPages(pages.length);
      setPage((p) => Math.min(p, pages.length));
    } catch {
      setTotalPages(1);
      setContentHeight(contentH);
      setLayout(EMPTY_LAYOUT);
    }
  }, [preparedHtml, contentH]);

  useEffect(() => {
    if (!open) {
      setZoom(100);
      setPage(1);
      setTotalPages(1);
      setOrientation("portrait");
      setMeasuring(false);
      setNavOpen(typeof window === "undefined" || window.innerWidth >= 768);
      setSearchOpen(false);
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  // Track the width of the scrollable preview area so the page can fit it edge to edge
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    setViewW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setViewW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Track the unscaled layout height of the pages wrapper (transform does not affect it)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setLayoutH(el.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setLayoutH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, loading, error, preparedHtml, totalPages]);

  // When htmlContent changes (e.g. drill-down navigation), reset page +
  // auto-detect orientation from the new HTML, then remeasure
  useEffect(() => {
    if (!open || !htmlContent) return;
    setOrientation(detectOrientation(htmlContent));
    setPage(1);
    setMeasuring(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [htmlContent, open]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/Cmd+F opens the in-report search instead of the browser's find
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === "Escape") {
        if (searchOpen) closeSearch();
        else onClose();
        return;
      }
      // Don't page-navigate while typing in an input (e.g. the search box)
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
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
  }, [open, onClose, totalPages, searchOpen, openSearch, closeSearch]);

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
          // Suppress window.print() from report HTML while measuring
          const win = iframe.contentWindow as Window & { print?: () => void };
          if (win && typeof win.print === "function") {
            const originalPrint = win.print.bind(win);
            win.print = () => {};
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
    // Web fonts (e.g. Inter) can change text metrics after load — measure again
    try {
      const fonts = (
        iframe?.contentDocument as (Document & { fonts?: { ready: Promise<unknown> } }) | null
      )?.fonts;
      fonts?.ready.then(() => requestAnimationFrame(remeasure));
    } catch {
      /* ignore */
    }
  };

  // Re-measure if content string changes
  useEffect(() => {
    if (preparedHtml) setMeasuring(true);
  }, [preparedHtml]);

  /* ───────────────────────── Search in report ───────────────────────── */

  const MAX_MATCHES = 5000;

  /** All (case-insensitive) occurrences of `q` in the text of a report document */
  const buildRanges = (doc: Document, q: string): Range[] => {
    const out: Range[] = [];
    if (!q || !doc.body) return out;
    const needle = q.toLowerCase();
    const root = (doc.querySelector(".sheet") as HTMLElement | null) ?? doc.body;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        const tag = el.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        if (el.closest(".actions")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue ?? "").toLowerCase();
      let idx = text.indexOf(needle);
      while (idx !== -1) {
        const r = doc.createRange();
        r.setStart(node, idx);
        r.setEnd(node, idx + needle.length);
        out.push(r);
        if (out.length >= MAX_MATCHES) return out;
        idx = text.indexOf(needle, idx + needle.length);
      }
    }
    return out;
  };

  /** Paint the search highlights inside one report document */
  const applyHighlightToDoc = (doc: Document) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = doc.defaultView as any;
    const registry = win?.CSS?.highlights;
    const HighlightCtor = win?.Highlight;
    if (!registry || !HighlightCtor) return;
    const { q, cur } = searchRef.current;
    registry.delete("nr-search");
    registry.delete("nr-search-current");
    if (!q) return;
    const ranges = buildRanges(doc, q);
    if (ranges.length) registry.set("nr-search", new HighlightCtor(...ranges));
    if (cur >= 0 && ranges[cur]) {
      const h = new HighlightCtor(ranges[cur]);
      h.priority = 1;
      registry.set("nr-search-current", h);
    }
  };

  /** Re-paint every displayed page / thumbnail */
  const applyHighlightsAll = () => {
    rootRef.current?.querySelectorAll("iframe").forEach((f) => {
      try {
        if (f.contentDocument) applyHighlightToDoc(f.contentDocument);
      } catch {
        /* ignore */
      }
    });
  };

  /** Scroll the preview so match #k is in view (and select its page) */
  const scrollToMatch = (k: number, list: { y: number }[]) => {
    const m = list[k];
    const root = scrollRef.current;
    if (!m || !root || layout.pages.length === 0) return;

    let pageIdx = layout.pages.findIndex((pg) => m.y >= pg.start && m.y < pg.end);
    if (pageIdx < 0) pageIdx = 0; // header / footer text appears on every page → use the first
    const pg = layout.pages[pageIdx];

    let off: number;
    if (layout.headerH > 0 && m.y >= layout.headerTop && m.y < layout.headerTop + layout.headerH) {
      off = m.y - layout.headerTop;
    } else if (layout.footerH > 0 && m.y >= layout.footerTop && m.y < layout.footerTop + layout.footerH) {
      off = contentH - layout.footerH + (m.y - layout.footerTop);
    } else {
      off = layout.headerH + (pg.repeat?.h ?? 0) + (m.y - pg.start);
    }
    off += pageMarginPx;

    const sheetEl = pageSheetRefs.current[pageIdx];
    if (!sheetEl) return;
    const rootRect = root.getBoundingClientRect();
    const elRect = sheetEl.getBoundingClientRect();
    const target =
      root.scrollTop + (elRect.top - rootRect.top) + off * scaleRef.current - root.clientHeight / 3;
    root.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    setPage(pageIdx + 1);
  };

  const stepMatch = (dir: 1 | -1) => {
    const n = matchesRef.current.length;
    if (!n) return;
    const cur = (searchRef.current.cur + dir + n) % n;
    searchRef.current.cur = cur;
    setCurMatch(cur);
    applyHighlightsAll();
    scrollToMatch(cur, matchesRef.current);
  };

  // Debounce typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Focus the box when the bar opens
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Find matches in the measured report; re-runs when pagination changes
  useEffect(() => {
    if (!open) return;
    const iframe = measureRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    const q = debouncedQuery;
    searchRef.current.q = q;

    if (!q || !doc?.body || !win) {
      matchesRef.current = [];
      setMatches([]);
      setCurMatch(-1);
      searchRef.current.cur = -1;
      prevQueryRef.current = q;
      applyHighlightsAll();
      return;
    }

    const ranges = buildRanges(doc, q);
    const sy = win.pageYOffset || 0;
    const list = ranges.map((r) => {
      const rc = r.getClientRects()[0] ?? r.getBoundingClientRect();
      return { y: rc.top + sy };
    });
    matchesRef.current = list;
    setMatches(list);

    const changed = prevQueryRef.current !== q;
    prevQueryRef.current = q;
    let cur = changed ? 0 : Math.min(searchRef.current.cur, list.length - 1);
    if (list.length === 0) cur = -1;
    else if (cur < 0) cur = 0;
    searchRef.current.cur = cur;
    setCurMatch(cur);
    applyHighlightsAll();
    if (changed && cur >= 0) requestAnimationFrame(() => scrollToMatch(cur, list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedQuery, layout, preparedHtml]);

  /* ─────────────── Pinch / Ctrl+wheel / touch zoom (anchored at the cursor) ─────────────── */

  zoomFnRef.current = (dy: number, clientX: number, clientY: number) => {
    const el = scrollRef.current;
    const sizer = sizerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const sc = scaleRef.current;
      let sl = 0;
      let st = 0;
      if (sizer) {
        const sr = sizer.getBoundingClientRect();
        sl = sr.left - rect.left + el.scrollLeft;
        st = sr.top - rect.top + el.scrollTop;
      }
      zoomAnchor.current = {
        cx,
        cy,
        cX: (el.scrollLeft + cx - sl) / sc,
        cY: (el.scrollTop + cy - st) / sc,
      };
    }
    const d = Math.max(-25, Math.min(25, dy));
    setZoom((z) => Math.min(300, Math.max(40, z * Math.exp(-d * 0.01))));
  };

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // trackpad pinch arrives as ctrl+wheel
      e.preventDefault();
      zoomFnRef.current(e.deltaY, e.clientX, e.clientY);
    };
    // Safari reports trackpad pinch as gesture events
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureBaseRef.current = zoomRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const sc = (e as unknown as { scale?: number }).scale ?? 1;
      zoomAnchor.current = null;
      setZoom(Math.min(300, Math.max(40, gestureBaseRef.current * sc)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    // Touch screens: two-finger pinch on the preview area
    const detachPinch = attachPinch(
      el,
      (x, y) => [x, y],
      (dy, x, y) => zoomFnRef.current(dy, x, y)
    );
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      detachPinch();
    };
  }, [open]);

  // Keep the point under the cursor fixed after the scale changes
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const el = scrollRef.current;
    if (!a || !el) return;
    zoomAnchor.current = null;
    const rect = el.getBoundingClientRect();
    let sl = 0;
    let st = 0;
    const sizer = sizerRef.current;
    if (sizer) {
      const sr = sizer.getBoundingClientRect();
      sl = sr.left - rect.left + el.scrollLeft;
      st = sr.top - rect.top + el.scrollTop;
    }
    el.scrollLeft = sl + a.cX * scale - a.cx;
    el.scrollTop = st + a.cY * scale - a.cy;
  }, [scale]);

  /** Runs when any displayed report frame (re)loads: highlights + pinch / Ctrl+F inside the frame */
  const onFrameLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const frame = e.currentTarget;
    try {
      const d = frame.contentDocument;
      if (!d) return;
      d.addEventListener(
        "wheel",
        (ev: WheelEvent) => {
          if (!ev.ctrlKey && !ev.metaKey) return;
          ev.preventDefault();
          const r = frame.getBoundingClientRect();
          const sc = scaleRef.current;
          zoomFnRef.current(ev.deltaY, r.left + ev.clientX * sc, r.top + ev.clientY * sc);
        },
        { passive: false }
      );
      d.addEventListener("keydown", (ev: KeyboardEvent) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "f") {
          ev.preventDefault();
          openSearch();
        }
      });
      // Touches inside the page iframes don't bubble to the parent — handle pinch here too
      attachPinch(
        d,
        (x, y) => {
          const r = frame.getBoundingClientRect();
          const sc = scaleRef.current;
          return [r.left + x * sc, r.top + y * sc];
        },
        (dy, x, y) => zoomFnRef.current(dy, x, y)
      );
      applyHighlightToDoc(d);
    } catch {
      /* ignore */
    }
  };

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
      iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-modals");
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

  /**
   * Update active page from scroll position.
   * Uses on-screen rects (not offsetTop) because the pages are CSS-scaled.
   */
  const onScrollPreview = () => {
    const root = scrollRef.current;
    if (!root || totalPages < 1) return;
    const rootTop = root.getBoundingClientRect().top;
    const sheets = pageSheetRefs.current;
    let best = 1;
    for (let i = 0; i < sheets.length; i++) {
      const el = sheets[i];
      if (!el) continue;
      if (el.getBoundingClientRect().top - rootTop <= 40) best = i + 1;
    }
    if (best !== page) setPage(best);
  };

  /**
   * One page = repeated report header + this page's slice of the body + repeated
   * footer pinned to the bottom. Every part is a clipped window onto the same report.
   */
  const renderComposite = (pageIdx: number, interactive: boolean, keyPrefix: string) => {
    const pg = layout.pages[pageIdx] ?? { start: 0, end: contentH };
    const fullH = Math.max(contentHeight, contentH);
    const windowOf = (top: number, h: number, part: string, live: boolean) => (
      <div
        style={{
          width: contentW,
          height: h,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
          background: "#ffffff",
        }}
      >
        <iframe
          title={`${title}-${keyPrefix}-${part}`}
          onLoad={onFrameLoad}
          srcDoc={preparedHtml ?? undefined}
          tabIndex={-1}
          sandbox={live ? "allow-same-origin allow-scripts" : "allow-same-origin"}
          style={{
            width: contentW,
            height: fullH,
            border: "none",
            display: "block",
            background: "#fff",
            transform: `translateY(${-top}px)`,
            pointerEvents: live ? "auto" : "none",
          }}
        />
      </div>
    );

    return (
      <div
        style={{
          width: contentW,
          height: contentH,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        {layout.headerH > 0 && windowOf(layout.headerTop, layout.headerH, "header", false)}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
          {pg.repeat && windowOf(pg.repeat.top, pg.repeat.h, "thead", false)}
          {windowOf(pg.start, Math.max(pg.end - pg.start, 1), "body", interactive)}
        </div>
        {layout.footerH > 0 && windowOf(layout.footerTop, layout.footerH, "footer", false)}
      </div>
    );
  };

  /** True when the user has manually overridden the auto-detected orientation */
  const orientationOverridden = orientation !== autoOrientation;

  const navW = orientation === "portrait" ? 100 : 132;

  return (
    <div
      ref={rootRef}
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
        padding: isMobile ? 0 : isCompact ? "12px 16px" : "20px 28px",
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
          maxHeight: "100%",
          background: "#ffffff",
          borderRadius: isMobile ? 0 : 10,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header — title + Portrait/Landscape toggle pills + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "10px 12px" : "14px 18px 12px",
            borderBottom: "1px solid #e5e7eb",
            flexShrink: 0,
            background: "#fff",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              columnGap: 14,
              rowGap: 8,
              minWidth: 0,
              flex: 1,
            }}
          >
            <div style={{ minWidth: 0, flex: isMobile ? "1 1 100%" : undefined }}>
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
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </div>
            </div>

            {/* Portrait / Landscape toggle */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                overflow: "hidden",
                flexShrink: 0,
                background: "#f8fafc",
              }}
              title={
                orientationOverridden
                  ? `Manual override (auto: ${autoOrientation})`
                  : `Auto-detected from report: ${autoOrientation}`
              }
            >
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                disabled={loading || !htmlContent}
                style={{
                  height: isMobile ? 30 : 32,
                  padding: isMobile ? "0 12px" : "0 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  border: "none",
                  cursor: loading || !htmlContent ? "not-allowed" : "pointer",
                  background: orientation === "portrait" ? "#1e3a8a" : "transparent",
                  color: orientation === "portrait" ? "#ffffff" : "#475569",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                disabled={loading || !htmlContent}
                style={{
                  height: isMobile ? 30 : 32,
                  padding: isMobile ? "0 12px" : "0 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  border: "none",
                  borderLeft: "1px solid #e2e8f0",
                  cursor: loading || !htmlContent ? "not-allowed" : "pointer",
                  background: orientation === "landscape" ? "#1e3a8a" : "transparent",
                  color: orientation === "landscape" ? "#ffffff" : "#475569",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                Landscape
              </button>
            </div>
          </div>

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
              flexShrink: 0,
              alignSelf: isMobile ? "flex-start" : undefined,
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
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
            gap: isMobile ? 4 : 8,
            padding: isMobile ? "4px 8px" : "6px 12px",
            background: "#1f2937",
            color: "#f1f5f9",
            flexShrink: 0,
            minHeight: 40,
            overflowX: "auto",
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
          {!isCompact && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 160,
                flexShrink: 0,
              }}
            >
              {title}
            </span>
          )}

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
              flexShrink: 0,
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginLeft: isMobile ? 0 : 4,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => {
                zoomAnchor.current = null;
                setZoom((z) => Math.max(40, z - 10));
              }}
              style={toolIconBtn}
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              title="Reset zoom"
              onClick={() => {
                zoomAnchor.current = null;
                setZoom(100);
              }}
              style={{
                ...toolIconBtn,
                width: "auto",
                minWidth: 38,
                padding: "0 4px",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {Math.round(zoom)}%
            </button>
            <button
              type="button"
              onClick={() => {
                zoomAnchor.current = null;
                setZoom((z) => Math.min(300, z + 10));
              }}
              style={toolIconBtn}
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {!isMobile && (
            <span style={{ fontSize: 11, color: "#9ca3af", marginRight: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
              {orientation === "portrait" ? "A4 Portrait" : "A4 Landscape"}
            </span>
          )}

          <button
            type="button"
            onClick={() => (searchOpen ? closeSearch() : openSearch())}
            style={{ ...toolIconBtn, background: searchOpen ? "#374151" : "transparent" }}
            title="Search in report (Ctrl+F)"
          >
            <Search size={14} />
          </button>
          <button type="button" onClick={handlePrint} style={toolIconBtn} title="Print">
            <Printer size={14} />
          </button>
          {!isMobile && (
            <button
              type="button"
              onClick={() => {
                zoomAnchor.current = null;
                setZoom(100);
              }}
              style={toolIconBtn}
              title="Reset zoom"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {!isMobile && (
            <button
              type="button"
              onClick={() => {
                zoomAnchor.current = null;
                setZoom(100);
              }}
              style={toolIconBtn}
              title="100%"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
            background: "#111827",
            position: "relative",
          }}
        >
          {/* Collapsible page navigator — real mini previews of each page (slide-over on phones) */}
          <div
            style={{
              position: isMobile ? "absolute" : "relative",
              top: 0,
              bottom: 0,
              left: 0,
              zIndex: 4,
              width: navOpen ? navW : 0,
              minWidth: navOpen ? navW : 0,
              background: "#1f2937",
              borderRight: navOpen ? "1px solid #374151" : "none",
              boxShadow: isMobile && navOpen ? "4px 0 16px rgba(0,0,0,0.4)" : "none",
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
                const thumbScale = thumbW / pageW;

                return (
                  <React.Fragment key={`thumb-${n}-${orientation}`}>
                    {showGap && (
                      <span style={{ fontSize: 10, color: "#6b7280" }}>···</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        goToPage(n);
                        if (isMobile) setNavOpen(false);
                      }}
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
                      {/* Mini page: repeated header + this page's body slice + footer, scaled down */}
                      {preparedHtml && !loading ? (
                        <div
                          style={{
                            width: pageW,
                            height: pageH,
                            transform: `scale(${thumbScale})`,
                            transformOrigin: "top left",
                            pointerEvents: "none",
                            overflow: "hidden",
                            background: "#fff",
                            boxSizing: "border-box",
                            padding: pageMarginPx,
                          }}
                        >
                          {renderComposite(n - 1, false, `thumb-${n}`)}
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

          {/* Scrollable multi-page preview — no horizontal padding so the page touches both sides */}
          <div
            ref={scrollRef}
            onScroll={onScrollPreview}
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: "auto",
              overflowX: pageW * scale > viewW + 1 ? "auto" : "hidden",
              background: "#374151",
              padding: "0 0 40px",
              touchAction: "pan-x pan-y",
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
                ref={sizerRef}
                style={{
                  // Occupies the scaled size so scrolling works in both directions when zoomed in
                  width: pageW * scale,
                  height: layoutH * scale,
                  margin: "0 auto",
                  position: "relative",
                }}
              >
                <div
                  ref={wrapperRef}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: pageW,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
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
                            height: pageH,
                            overflow: "hidden",
                            background: "#ffffff",
                            boxShadow:
                              page === pageNum
                                ? "0 0 0 2px #3b82f6, 0 8px 30px rgba(0,0,0,0.35)"
                                : "0 8px 30px rgba(0,0,0,0.35)",
                            position: "relative",
                            borderRadius: 1,
                            boxSizing: "border-box",
                            padding: pageMarginPx,
                          }}
                        >
                          {renderComposite(i, true, `page-${pageNum}`)}
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
              </div>
            )}

            {!loading && !error && !preparedHtml && (
              <div style={{ ...centerMsg, color: "#94a3b8" }}>No report content</div>
            )}
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div
              style={{
                position: "absolute",
                top: isMobile ? 8 : 10,
                left: isMobile ? 8 : undefined,
                right: isMobile ? 8 : 24,
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                padding: "4px 6px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              }}
            >
              <Search size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    stepMatch(e.shiftKey ? -1 : 1);
                  }
                }}
                placeholder="Search in report"
                style={{
                  width: isMobile ? undefined : 200,
                  flex: isMobile ? 1 : undefined,
                  minWidth: 0,
                  height: isMobile ? 30 : 26,
                  background: "#1f2937",
                  color: "#f1f5f9",
                  border: "1px solid #374151",
                  borderRadius: 4,
                  padding: "0 8px",
                  /* 16px on phones stops iOS focus-zoom */
                  fontSize: isMobile ? 16 : 12,
                  outline: "none",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  minWidth: isMobile ? 46 : 62,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {!debouncedQuery
                  ? ""
                  : matches.length === 0
                  ? "No results"
                  : `${curMatch + 1} / ${matches.length}${matches.length >= MAX_MATCHES ? "+" : ""}`}
              </span>
              <button
                type="button"
                onClick={() => stepMatch(-1)}
                disabled={matches.length === 0}
                style={{ ...toolIconBtn, opacity: matches.length === 0 ? 0.35 : 1 }}
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => stepMatch(1)}
                disabled={matches.length === 0}
                style={{ ...toolIconBtn, opacity: matches.length === 0 ? 0.35 : 1 }}
                title="Next match (Enter)"
              >
                <ChevronDown size={16} />
              </button>
              <button type="button" onClick={closeSearch} style={toolIconBtn} title="Close search (Esc)">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: 8,
            padding: isMobile ? "8px 10px" : "10px 16px",
            borderTop: "1px solid #e5e7eb",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          {!isMobile && (
            <span style={{ marginRight: "auto", fontSize: 12, color: "#94a3b8" }}>
              {isCompact
                ? "PDF preview · pinch to zoom"
                : "PDF preview · Esc to close · scroll or ← → for pages · Ctrl+F search · pinch / Ctrl+scroll to zoom"}
            </span>
          )}

          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              disabled={exportingExcel || loading}
              style={{
                ...footerBtn,
                ...(isMobile ? { flex: 1, justifyContent: "center" } : null),
                opacity: exportingExcel || loading ? 0.55 : 1,
                cursor: exportingExcel || loading ? "not-allowed" : "pointer",
              }}
            >
              <FileSpreadsheet size={14} strokeWidth={2} />
              {exportingExcel ? "Exporting…" : "Excel"}
            </button>
          )}

          {onOpenInNewWindow && (
            <button
              type="button"
              onClick={onOpenInNewWindow}
              style={{
                ...footerBtn,
                ...(isMobile ? { flex: 1, justifyContent: "center" } : null),
              }}
            >
              <ExternalLink size={14} strokeWidth={2} />
              {isMobile ? "New window" : "Open in new window"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              ...footerBtn,
              ...(isMobile ? { flex: 1, justifyContent: "center" } : null),
            }}
          >
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
  flexShrink: 0,
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