import { ChevronDown, Search, X } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
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
  required?: boolean;
  multiSelect?: boolean;
  showLabelInCompact?: boolean;
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
  required,
  enforceRequired,
  multiSelect,
}: LookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const validityRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    validityRef.current?.setCustomValidity("");
  }, [value]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const placePopover = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adapt width to the field: match trigger width or min needed for columns
      const minIdealWidth = columns.length >= 3 ? 340 : 280;
      const width = Math.min(
        Math.max(rect.width, minIdealWidth),
        Math.min(600, viewportWidth - 24),
      );

      const belowSpace = viewportHeight - rect.bottom - 10;
      const aboveSpace = rect.top - 10;
      const preferredSpace = belowSpace >= 200 ? belowSpace : Math.max(belowSpace, aboveSpace);
      const maxHeight = Math.max(240, Math.min(380, preferredSpace));
      const opensAbove = belowSpace < 200 && aboveSpace > belowSpace;

      // Horizontal alignment: if trigger is on right side of screen or overflows, align flush with trigger's right edge
      let left = rect.left;
      if (left + width > viewportWidth - 12) {
        left = Math.max(12, rect.right - width);
      } else {
        left = Math.max(12, left);
      }

      const top = opensAbove
        ? Math.max(10, rect.top - maxHeight - 6)
        : Math.min(rect.bottom + 4, viewportHeight - maxHeight - 10);

      setPopoverStyle({ left, top, width, maxHeight });
    };

    const closePopover = () => {
      setOpen(false);
      setQuery("");
      setPage(1);
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      closePopover();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopover();
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
  }, [columns.length, compact, open]);

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

  return (
    <>
      <label className={compact ? "block w-full min-w-0" : "field"}>
        {(!compact || showLabelInCompact) && (
          <span>
            {label} {required && <span style={{ color: "#E24B4A", marginLeft: 2 }}>*</span>}
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
          {enforceRequired && (
            <input
              ref={validityRef}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full border-0 bg-transparent p-0 text-transparent opacity-0"
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
              dense || compact ? "px-2 text-xs" : "px-2.5 text-xs"
            } ${!disabled && currentText ? "text-slate-800 font-medium" : !disabled ? "text-slate-400" : ""}`}
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <span className="block truncate">
              {currentText || placeholder || `Select ${label || ""}`}
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
            className="lookup-popover fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
            style={popoverStyle}
          >
            {/* Search header */}
            <div className="flex-none p-2 border-b border-slate-200 bg-slate-50/80">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  autoFocus
                  className="w-full h-7.5 pl-8 pr-7 rounded-lg border border-slate-300 focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/20 bg-white text-slate-800 text-[11.5px] placeholder:text-slate-400 focus:outline-none transition-all shadow-xs"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search code or description..."
                />
                {query && (
                  <button
                    type="button"
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    onClick={() => setQuery("")}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {error && <div className="m-2 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200">{error}</div>}

            {/* Table */}
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="lookup-results-table w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#00378C] text-white">
                  <tr className="h-7.5 bg-[#00378C]">
                    {columns.map((column, columnIndex) => (
                      <th
                        className="px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white select-none whitespace-nowrap"
                        key={column.field}
                        style={columnIndex === 0 ? { width: columns.length > 2 ? "25%" : "35%" } : undefined}
                        title={column.header}
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-xs text-slate-500" colSpan={columns.length}>
                        Loading...
                      </td>
                    </tr>
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-xs text-slate-500" colSpan={columns.length}>
                        No records found
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row, index) => {
                      const rowValue = String(getLookupValue(row, valueField) ?? "");
                      const selected = multiSelect
                        ? selectedValues.includes(rowValue)
                        : rowValue === value;
                      return (
                        <tr
                          key={`${rowValue || index}`}
                          onClick={() => selectRow(row)}
                          className={`h-7.5 cursor-pointer transition-colors ${
                            selected
                              ? "bg-[#E8F0FE] text-[#00378C] font-semibold"
                              : "hover:bg-[#E8F0FE]/60 text-slate-800"
                          }`}
                        >
                          {columns.map((column, columnIndex) => {
                            const cellText = formatLookupDisplayValue(column.field, getLookupValue(row, column.field));
                            return (
                              <td
                                className={`px-2.5 py-1 text-xs truncate whitespace-nowrap max-w-[220px] ${
                                  columnIndex === 0 ? "font-semibold text-[#00378C] font-mono text-[11px]" : "text-slate-700"
                                }`}
                                key={column.field}
                                title={cellText}
                              >
                                {cellText}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="lookup-footer flex-none px-2.5 py-1.5 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between text-xs text-slate-600">
              <span className="text-[11px] font-medium text-slate-500">
                {filteredRows.length} item{filteredRows.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-1.5">
                {filteredRows.length > 10 && (
                  <>
                    <select
                      className="h-6 px-1.5 rounded border border-slate-300 bg-white text-[10.5px] font-semibold text-slate-700 focus:outline-none focus:border-[#00378C]"
                      value={rowsPerPage}
                      onChange={(event) => {
                        setRowsPerPage(Number(event.target.value));
                        setPage(1);
                      }}
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size} / page
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="h-6 px-2 rounded border border-slate-300 bg-white text-[10.5px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      disabled={page === 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Prev
                    </button>
                    <span className="text-[10.5px] font-semibold text-slate-600 px-0.5">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="h-6 px-2 rounded border border-slate-300 bg-white text-[10.5px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      disabled={page === totalPages}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    >
                      Next
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="h-6 px-2 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 text-[10.5px] font-semibold transition-colors cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    setPage(1);
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
