import { ChevronDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatLookupDisplayValue, getLookupText, getLookupValue, LookupRow } from "../../api/lookups";

type LookupColumn = {
  field: string;
  header: string;
};

type LookupFieldProps = {
  label?: string;
  value: string;
  displayValue?: string;
  columns: LookupColumn[];
  valueField: string;
  displayFields: string[];
  loadOptions: (query?: string) => Promise<LookupRow[]>;
  onChange: (value: string, row: LookupRow | null) => void;
  disabled?: boolean;
  enforceRequired?: boolean;
  compact?: boolean;
  dense?: boolean;
  placeholder?: string;
  placeholderClassName?: string;
  required?: boolean;
  multiSelect?: boolean;
  showLabelInCompact?: boolean;
  renderRowActions?: (row: LookupRow) => ReactNode;
  className?: string;
};

export function LookupField({
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
  dense = false,
  showLabelInCompact = false,
  placeholder,
  placeholderClassName,
  required,
  enforceRequired,
  multiSelect,
  renderRowActions,
  className,
}: LookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const validityRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useEffect(() => {
    validityRef.current?.setCustomValidity("");
  }, [value]);

  useEffect(() => {
    setPage(1);
    setHighlightedIndex(0);
  }, [query]);

  const placePopover = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const minIdealWidth = 540;
    const width = Math.min(
      Math.max(rect.width, minIdealWidth),
      Math.min(780, viewportWidth - 24),
    );

    // Leave a comfortable 28px margin from top and bottom screen edges (taskbar safety)
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 28);
    const spaceAbove = Math.max(0, rect.top - 28);

    // If trigger is in the lower half of viewport or space below is tight (< 380px), open ABOVE!
    const opensAbove = (spaceBelow < 380 && spaceAbove >= 200) || (spaceAbove > spaceBelow);
    const availableSpace = opensAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(520, Math.max(220, availableSpace));

    let left = rect.left;
    if (left + width > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - width - 12);
    } else {
      left = Math.max(12, left);
    }

    const nextStyle: CSSProperties = {
      position: "fixed",
      left,
      width,
      maxHeight,
      zIndex: 9999,
    };

    if (opensAbove) {
      nextStyle.bottom = viewportHeight - rect.top + 4;
      nextStyle.top = "auto";
    } else {
      nextStyle.top = rect.bottom + 4;
      nextStyle.bottom = "auto";
    }

    setPopoverStyle(nextStyle);
  }, []);

  useEffect(() => {
    if (!open) return;

    const closePopover = () => {
      setOpen(false);
      setQuery("");
      setPage(1);
      setHighlightedIndex(0);
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      closePopover();
    };

    placePopover();
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, placePopover]);

  const selectedValues = useMemo(() => {
    if (!multiSelect) return value ? [value] : [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, [value, multiSelect]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((item) => String(item ?? "").toLowerCase().includes(term)),
    );
  }, [query, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const pagedRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => {
    if (open && rowRefs.current[highlightedIndex]) {
      rowRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        setRows(await loadOptions(query));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load lookup");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadOptions, open, query]);

  const openLookup = async () => {
    if (disabled) return;
    setOpen(true);
    setLoading(true);
    setError("");
    setHighlightedIndex(0);
    try {
      setRows(await loadOptions(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load lookup");
    } finally {
      setLoading(false);
    }
  };

  const selectRow = (row: LookupRow) => {
    const rowValue = String(getLookupValue(row, valueField) ?? "");
    if (multiSelect) {
      const selected = selectedValues.includes(rowValue);
      const nextValues = selected
        ? selectedValues.filter((valueItem) => valueItem !== rowValue)
        : [...selectedValues, rowValue];
      onChange(nextValues.join(","), row);
      return;
    }

    onChange(rowValue, row);
    setOpen(false);
    setQuery("");
    setPage(1);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      setPage(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (pagedRows.length > 0 ? (prev + 1) % pagedRows.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (pagedRows.length > 0 ? (prev - 1 + pagedRows.length) % pagedRows.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (pagedRows[highlightedIndex]) {
        selectRow(pagedRows[highlightedIndex]);
      }
    } else if (event.key === "PageDown") {
      event.preventDefault();
      setPage((p) => Math.min(totalPages, p + 1));
      setHighlightedIndex(0);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      setPage((p) => Math.max(1, p - 1));
      setHighlightedIndex(0);
    }
  };

  const currentText =
    displayValue ||
    (multiSelect
      ? rows
        .filter((row) => selectedValues.includes(String(getLookupValue(row, valueField) ?? "")))
        .map((row) => getLookupText(row, displayFields.length ? displayFields : [valueField]))
        .join(", ") || value || ""
      : value
        ? getLookupText(
          rows.find((row) => String(getLookupValue(row, valueField) ?? "") === String(value)) || {
            [valueField]: value,
          },
          displayFields.length ? displayFields : [valueField],
        ) || String(value)
        : "");

  const totalCols = columns.length + (renderRowActions ? 1 : 0);
  const hasAsterisk = Boolean(label && /\*\s*$/.test(label));
  const cleanLabel = label ? label.replace(/\s*\*\s*$/, "") : "";
  const isRequired = Boolean(required || enforceRequired || hasAsterisk);

  const startRecord = filteredRows.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endRecord = Math.min(page * rowsPerPage, filteredRows.length);

  return (
    <>
      <label className={`${compact ? "block w-full min-w-0" : "field"} ${className || ""}`}>
        {(!compact || showLabelInCompact) && label && (
          <span>
            {cleanLabel}
            {isRequired && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}> *</span>}
          </span>
        )}
        <div
          ref={triggerRef}
          className={`lookup-field-trigger relative flex w-full min-w-0 items-center overflow-hidden rounded-md border transition-all ${
            disabled
              ? "bg-slate-100/90 border-slate-200 cursor-not-allowed"
              : "border-[#d5dbe3] bg-white focus-within:border-[#00378C] focus-within:ring-1 focus-within:ring-[#00378C]/20"
          } ${dense ? "h-7" : compact ? "h-7" : "h-8"}`}
        >
          {enforceRequired && !disabled && (
            <input
              ref={validityRef}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 h-0 w-0 border-0 bg-transparent p-0 text-transparent opacity-0"
              style={{ opacity: 0, color: "transparent", width: 0, height: 0, pointerEvents: "none" }}
              value={value}
              required
              onChange={() => {}}
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(`${label || "This field"} is required`)}
            />
          )}
          <button
            className={`min-w-0 flex-1 border-0 bg-transparent text-left truncate ${
              disabled ? "cursor-not-allowed text-slate-700 font-medium" : "cursor-pointer"
            } ${
              dense || compact ? "px-2" : "px-2.5"
            } ${!disabled && currentText ? "text-slate-800 font-medium text-[11px]" : !disabled ? "text-slate-400 text-[10px]" : "text-[11px]"}`}
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <span className={`block truncate ${!currentText ? "italic font-light" : ""} ${!currentText && placeholderClassName ? placeholderClassName : ""}`}>
              {currentText ||
                (placeholder
                  ? `${placeholder.replace(/\.*$/, "")}...`
                  : `${cleanLabel || label || ""}...`)}
            </span>
          </button>
          {value && !disabled && (
            <button
              className={`${dense || compact ? "w-6" : "w-6.5"} shrink-0 grid place-items-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer`}
              type="button"
              aria-label="Clear lookup"
              onClick={(e) => {
                e.stopPropagation();
                onChange("", null);
              }}
            >
              <X size={dense ? 11 : 13} />
            </button>
          )}
          <button
            className={`${dense || compact ? "w-6" : "w-7"} shrink-0 grid place-items-center ${
              disabled ? "text-slate-300 pointer-events-none" : "text-slate-400 hover:bg-slate-100 cursor-pointer"
            }`}
            type="button"
            onClick={openLookup}
            disabled={disabled}
            aria-label="Open lookup"
          >
            <ChevronDown size={dense ? 13 : 15} />
          </button>
        </div>
      </label>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="lookup-popover fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
            style={popoverStyle}
          >
            <div className="flex-none p-2 border-b border-slate-200 bg-slate-50/90">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  className="lookup-search-input w-full h-8.5 min-h-[34px] pl-8 pr-7 rounded-lg border border-slate-300 focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/20 bg-white text-slate-800 text-[11.5px] placeholder:text-slate-400 focus:outline-none transition-all shadow-xs"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by code, description, or any field..."
                />
                {query && (
                  <button
                    type="button"
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    onClick={() => setQuery("")}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {error && <div className="m-2 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">{error}</div>}

            {/* Scrollable table body with custom scrollbar */}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto select-none bg-white">
              <table className="lookup-results-table w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#00378C] text-white shadow-xs">
                  <tr className="h-7.5 bg-[#00378C]">
                    {columns.map((column, columnIndex) => (
                      <th
                        className={`px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white select-none whitespace-nowrap ${
                          columnIndex === 0 ? "w-[130px] min-w-[110px]" : "w-auto"
                        }`}
                        key={column.field}
                        title={column.header}
                      >
                        {column.header}
                      </th>
                    ))}
                    {renderRowActions && (
                      <th className="w-16 px-2 py-1.5 text-center text-[10.5px] font-bold uppercase tracking-wider text-white select-none whitespace-nowrap">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-xs text-slate-500 font-medium" colSpan={totalCols}>
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#00378C] border-r-transparent" />
                          Loading options...
                        </div>
                      </td>
                    </tr>
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-xs text-slate-500" colSpan={totalCols}>
                        {query ? (
                          <span>No records match "<strong>{query}</strong>"</span>
                        ) : (
                          <span>No records found</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row, index) => {
                      const rowValue = String(getLookupValue(row, valueField) ?? "");
                      const isSelected = multiSelect
                        ? selectedValues.includes(rowValue)
                        : rowValue === value;
                      const isHighlighted = index === highlightedIndex;

                      return (
                        <tr
                          ref={(el) => (rowRefs.current[index] = el)}
                          key={`${rowValue || index}`}
                          onClick={() => selectRow(row)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={`min-h-[30px] cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#E8F0FE] text-[#00378C] font-semibold"
                              : isHighlighted
                                ? "bg-slate-100 text-slate-900"
                                : "hover:bg-slate-50 text-slate-800"
                          }`}
                        >
                          {columns.map((column, columnIndex) => {
                            const cellText = formatLookupDisplayValue(column.field, getLookupValue(row, column.field));
                            return (
                              <td
                                className={`px-3 py-1.5 text-xs ${
                                  columnIndex === 0
                                    ? "font-mono font-semibold text-[#00378C] text-[11.5px] whitespace-nowrap w-[130px] min-w-[110px]"
                                    : "text-slate-800 font-medium text-[11.5px] whitespace-normal break-words leading-snug"
                                }`}
                                key={column.field}
                                title={cellText}
                              >
                                {cellText}
                              </td>
                            );
                          })}

                          {renderRowActions && (
                            <td
                              className="px-2 py-1 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {renderRowActions(row)}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Action Footer */}
            <div className="lookup-footer flex-none px-3 py-2 border-t border-slate-200 bg-slate-50/95 flex items-center justify-between text-xs text-slate-600 gap-2 flex-wrap">
              <span className="text-[11.5px] font-medium text-slate-500 whitespace-nowrap">
                Showing <strong className="text-slate-800">{startRecord}–{endRecord}</strong> of <strong className="text-slate-800">{filteredRows.length.toLocaleString()}</strong>
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  className="h-7 px-2 rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-[#00378C] cursor-pointer shadow-2xs"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                    setHighlightedIndex(0);
                  }}
                  title="Rows per page"
                >
                  {[10, 25, 50, 100, 250, 500].map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>

                {totalPages > 1 && (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      className="h-7 px-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-[#00378C]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs inline-flex items-center justify-center"
                      disabled={page === 1}
                      onClick={() => {
                        setPage(1);
                        setHighlightedIndex(0);
                      }}
                      title="First page"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="h-7 px-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-[#00378C]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs inline-flex items-center justify-center"
                      disabled={page === 1}
                      onClick={() => {
                        setPage((current) => Math.max(1, current - 1));
                        setHighlightedIndex(0);
                      }}
                      title="Previous page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[11px] font-semibold text-slate-700 px-1.5 whitespace-nowrap min-w-[42px] text-center">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="h-7 px-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-[#00378C]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs inline-flex items-center justify-center"
                      disabled={page === totalPages}
                      onClick={() => {
                        setPage((current) => Math.min(totalPages, current + 1));
                        setHighlightedIndex(0);
                      }}
                      title="Next page"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      className="h-7 px-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-[#00378C]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs inline-flex items-center justify-center"
                      disabled={page === totalPages}
                      onClick={() => {
                        setPage(totalPages);
                        setHighlightedIndex(0);
                      }}
                      title="Last page"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="h-7 px-3 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300 text-[11px] font-semibold transition-colors cursor-pointer ml-1 shadow-2xs"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    setPage(1);
                    setHighlightedIndex(0);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}