import { Search, X } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatLookupDisplayValue, getLookupText, getLookupValue, LookupRow } from "../../api/lookups";
import { Input } from "./Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

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
  dense?: boolean; // trims height further than `compact`, opt-in only
  placeholder?: string;
  required?: boolean;
  multiSelect?: boolean;
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
      const width = Math.min(
        Math.max(rect.width, compact ? 360 : 460),
        Math.min(720, viewportWidth - 24),
      );
      const belowSpace = viewportHeight - rect.bottom - 10;
      const aboveSpace = rect.top - 10;
      const preferredSpace = belowSpace >= 180 ? belowSpace : Math.max(belowSpace, aboveSpace);
      const maxHeight = Math.max(220, Math.min(380, preferredSpace));
      const opensAbove = belowSpace < 180 && aboveSpace > belowSpace;
      const left = Math.min(Math.max(12, rect.left), viewportWidth - width - 12);
      const top = opensAbove
        ? Math.max(10, rect.top - maxHeight - 8)
        : Math.min(rect.bottom + 6, viewportHeight - maxHeight - 10);

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
  }, [compact, open]);

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
        .join(", ") || value || " "
      : value
        ? getLookupText(
          rows.find((row) => String(getLookupValue(row, valueField) ?? "") === String(value)) || {
            [valueField]: value,
          },
          displayFields.length ? displayFields : [valueField],
        ) || String(value)
        : " ");

  return (
    <>
      <label className={compact ? "block w-full min-w-0" : "field"}>
        {!compact && (
          <span>
            {label} {required && <span style={{ color: "#E24B4A", marginLeft: 2 }}>*</span>}
          </span>
        )}
        <div
          ref={triggerRef}
          className={`relative flex w-full min-w-0 overflow-hidden rounded-md border border-gray-400 bg-background ${
            dense ? "h-7" : compact ? "h-7" : "h-9"
          }`}
        >
          {enforceRequired && (
            <input
              ref={validityRef}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-transparent p-0 opacity-0"
              value={value}
              required
              onChange={() => {}}
              onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(`${label || "This field"} is required`)}
            />
          )}
          <button
            className={`min-w-0 flex-1 border-0 bg-transparent text-left text-foreground disabled:opacity-60 ${
              dense || compact ? "px-2 text-xs" : "px-3 text-sm"
            }`}
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <span className={currentText ? "block truncate" : "block truncate text-muted-foreground"}>
              {currentText || placeholder || `Select ${label}`}
            </span>
          </button>
          {value && !disabled && (
            <button
              className={`${dense || compact ? "w-7" : "w-8"} grid place-items-center text-muted-foreground hover:bg-accent`}
              type="button"
              onClick={() => onChange("", null)}
            >
              <X size={dense ? 12 : 14} />
            </button>
          )}
          <button
            className={`${dense || compact ? "w-7" : "w-9"} grid place-items-center border-l text-muted-foreground hover:bg-accent`}
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <Search size={dense ? 13 : 15} />
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
            <div className="flex-none border-b bg-[#f8fbff] px-3 py-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="eyebrow m-0">{label}</p>
                  <p className="m-0 truncate text-xs text-muted-foreground">Current: {currentText}</p>
                </div>
                <button
                  aria-label="Close lookup"
                  className="grid h-7 w-7 flex-none place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    setPage(1);
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
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search code, name, description..."
                />
              </label>
            </div>

            {error && <div className="m-2 alert error">{error}</div>}

            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[#edf4ff]">
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.field}>{column.header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell className="px-3 py-8 text-center text-muted-foreground" colSpan={columns.length}>
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell className="px-3 py-8 text-center text-muted-foreground" colSpan={columns.length}>
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((row, index) => {
                      const rowValue = String(getLookupValue(row, valueField) ?? "");
                      const selected = multiSelect
                        ? selectedValues.includes(rowValue)
                        : rowValue === value;
                      return (
                        <TableRow
                          className={selected
                            ? "cursor-pointer bg-primary/10 outline outline-1 outline-primary"
                            : "cursor-pointer hover:bg-accent"
                          }
                          key={`${rowValue || index}`}
                          onClick={() => selectRow(row)}
                          aria-selected={selected}
                        >
                          {columns.map((column) => (
                            <TableCell className="px-3 py-1.5 text-xs" key={column.field}>
                              {formatLookupDisplayValue(column.field, getLookupValue(row, column.field))}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="lookup-footer flex flex-none items-center justify-between border-t bg-[#fafbfd] px-3 py-2 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="lookup-pager flex items-center gap-1.5">
                <span>Rows</span>
                <select
                  className="rounded border border-[#d7e1f1] bg-white px-1.5 py-0.5 text-xs text-[#17345f] focus:outline-none"
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <button type="button" className="lookup-page-button" disabled={page === 1} onClick={() => setPage(1)}>
                  First
                </button>
                <button
                  type="button"
                  className="lookup-page-button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="lookup-page-button"
                  disabled={page === totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="lookup-page-button"
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  Last
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}