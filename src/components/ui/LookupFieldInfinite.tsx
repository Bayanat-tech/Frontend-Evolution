import { Search, X } from "lucide-react";
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getLookupText, getLookupValue, LookupRow } from "../../api/lookups";
import { Input } from "./Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";

// ─── Types ────────────────────────────────────────────────────────────────────
type LookupColumn = {
  field: string;
  header: string;
};

type LookupFieldInfiniteProps = {
  label: string;
  value: string;
  displayValue?: string;
  columns: LookupColumn[];
  valueField: string;
  displayFields: string[];
  loadOptions: () => Promise<LookupRow[]>;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
  compact?: boolean;
  placeholder?: string;
  required?: boolean;
  /** How many rows to render per "page" of infinite scroll. Default: 20 */
  batchSize?: number;
};

// ─── Component ────────────────────────────────────────────────────────────────
export function LookupFieldInfinite({
  label,
  value,
  displayValue,
  columns,
  valueField,
  displayFields,
  loadOptions,
  onChange,
  disabled,
  compact,
  placeholder,
  required,
  batchSize = 20,
}: LookupFieldInfiniteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Sentinel element at bottom of list — IntersectionObserver watches this
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Reset visible count when search query changes ──
  useEffect(() => {
    setVisibleCount(batchSize);
  }, [query, batchSize]);

  // ── Popover positioning + close-on-outside-click ──
  useEffect(() => {
    if (!open) return;

    const placePopover = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(
        Math.max(rect.width, compact ? 360 : 460),
        Math.min(720, vw - 24)
      );
      const belowSpace = vh - rect.bottom - 10;
      const aboveSpace = rect.top - 10;
      const maxHeight = Math.max(
        260,
        Math.min(430, Math.max(belowSpace, aboveSpace))
      );
      const opensAbove = belowSpace < 300 && aboveSpace > belowSpace;
      const left = Math.min(Math.max(12, rect.left), vw - width - 12);
      const top = opensAbove
        ? Math.max(10, rect.top - maxHeight - 8)
        : Math.min(rect.bottom + 6, vh - maxHeight - 10);

      setPopoverStyle({ left, top, width, maxHeight });
    };

    const closePopover = () => {
      setOpen(false);
      setQuery("");
      setVisibleCount(batchSize);
    };

    const handlePointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        popoverRef.current?.contains(t)
      )
        return;
      closePopover();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };

    placePopover();
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, compact, batchSize]);

  // ── IntersectionObserver — load more rows when sentinel is visible ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + batchSize);
        }
      },
      {
        // Use the scroll container as root so intersection is relative to it
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, batchSize, rows, query]);

  // ── Filtered rows (all matching, visibility sliced below) ──
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? "").toLowerCase().includes(term)
      )
    );
  }, [query, rows]);

  // ── Visible slice — grows as user scrolls ──
  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  );

  const hasMore = visibleCount < filteredRows.length;

  // ── Open lookup and fetch if needed ──
  const openLookup = async () => {
    if (disabled) return;
    setOpen(true);
    if (rows.length > 0) return; // already loaded
    setLoading(true);
    setError("");
    try {
      setRows(await loadOptions());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load lookup"
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Select row ──
  const selectRow = (row: LookupRow) => {
    const rowValue = String(getLookupValue(row, valueField) ?? "");
    onChange(rowValue, row);
    setOpen(false);
    setQuery("");
    setVisibleCount(batchSize);
  };

  // ── Display text shown in trigger ──
  const currentText =
    displayValue ||
    (value
      ? getLookupText(
          rows.find(
            (r) => String(getLookupValue(r, valueField) ?? "") === String(value)
          ) || { [valueField]: value },
          displayFields.length ? displayFields : [valueField]
        ) || String(value)
      : "None");

  return (
    <>
      <label className={compact ? "block" : "field"}>
        {!compact && (
          <span>
            {label}
            {required && (
              <span style={{ color: "#E24B4A", marginLeft: 2 }}>*</span>
            )}
          </span>
        )}
        <div
          ref={triggerRef}
          className="flex h-9 overflow-hidden rounded-md border bg-background"
        >
          <button
            className="min-w-0 flex-1 border-0 bg-transparent px-3 text-left text-sm text-foreground disabled:opacity-60"
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <span
              className={
                currentText
                  ? "block truncate"
                  : "block truncate text-muted-foreground"
              }
            >
              {currentText || placeholder || `Select ${label}`}
            </span>
          </button>
          {value && !disabled && (
            <button
              className="grid w-8 place-items-center text-muted-foreground hover:bg-accent"
              type="button"
              onClick={() => onChange("", null)}
            >
              <X size={14} />
            </button>
          )}
          <button
            className="grid w-9 place-items-center border-l text-muted-foreground hover:bg-accent"
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <Search size={15} />
          </button>
        </div>
      </label>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="lookup-popover fixed z-[9999] flex flex-col overflow-hidden rounded-lg border bg-card shadow-2xl"
            style={popoverStyle}
          >
            {/* ── Search header ── */}
            <div className="flex-none border-b bg-[#f8fbff] px-3 py-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="eyebrow m-0">{label}</p>
                  <p className="m-0 truncate text-xs text-muted-foreground">
                    Current: {currentText}
                  </p>
                </div>
                <button
                  aria-label="Close lookup"
                  className="grid h-7 w-7 flex-none place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    setVisibleCount(batchSize);
                  }}
                >
                  <X size={15} />
                </button>
              </div>
              <label className="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-muted-foreground shadow-sm">
                <Search size={14} />
                <Input
                  autoFocus
                  className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search code, name, description..."
                />
              </label>
            </div>

            {error && <div className="m-2 alert error">{error}</div>}

            {/* ── Scrollable table ── */}
            <div
              ref={scrollContainerRef}
              className="min-h-0 flex-1 overflow-auto"
            >
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[#edf4ff]">
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.field}>{col.header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        className="px-3 py-8 text-center text-muted-foreground"
                        colSpan={columns.length}
                      >
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        className="px-3 py-8 text-center text-muted-foreground"
                        colSpan={columns.length}
                      >
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {visibleRows.map((row, index) => {
                        const rowValue = String(
                          getLookupValue(row, valueField) ?? ""
                        );
                        const selected = rowValue === value;
                        return (
                          <TableRow
                            key={rowValue || index}
                            className={
                              selected
                                ? "cursor-pointer bg-primary/10 outline outline-1 outline-primary"
                                : "cursor-pointer hover:bg-accent"
                            }
                            onClick={() => selectRow(row)}
                            aria-selected={selected}
                          >
                            {columns.map((col) => (
                              <TableCell
                                className="px-3 py-1.5 text-xs"
                                key={col.field}
                              >
                                {String(getLookupValue(row, col.field) || "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}

                      {/* ── Sentinel row — observed by IntersectionObserver ── */}
                      <TableRow ref={sentinelRef} className="pointer-events-none">
                        <TableCell
                          colSpan={columns.length}
                          className="py-2 text-center"
                        >
                          {hasMore ? (
                            <span className="text-[11px] text-muted-foreground">
                              Loading more...
                            </span>
                          ) : filteredRows.length > batchSize ? (
                            <span className="text-[11px] text-muted-foreground">
                              All {filteredRows.length} records loaded
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── Footer: just a count, no pagination controls ── */}
            <div className="flex flex-none items-center justify-between border-t bg-[#fafbfd] px-3 py-2 text-xs text-muted-foreground">
              <span>
                {loading
                  ? "Loading..."
                  : `Showing ${visibleRows.length} of ${filteredRows.length} records`}
              </span>
              {query && (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default LookupFieldInfinite;