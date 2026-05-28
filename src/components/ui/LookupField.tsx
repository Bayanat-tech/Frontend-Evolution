import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLookupText, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

type LookupColumn = { field: string; header: string };

type LookupFieldProps = {
  label?: any;
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
  placeholder,
}: LookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState<LookupRow | null>(null);
  // Track which row key was last clicked — used by the radio to show selection
  const [selectedKey, setSelectedKey] = useState<string>("");
  const pendingCommit = useRef<LookupRow | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setPage(1);
  }, [query]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((item) =>
        String(item ?? "").toLowerCase().includes(term)
      )
    );
  }, [query, rows]);

  const getRowKey = (row: LookupRow) =>
    String(getLookupValue(row, valueField) || "");

  const openLookup = async () => {
    if (disabled) return;
    setOpen(true);
    const preSelected = rows.find(
      (row) => String(getLookupValue(row, valueField) || "") === value
    ) || null;
    setSelectedRow(preSelected);
    setSelectedKey(preSelected ? getRowKey(preSelected) : "");
    if (rows.length > 0) return;
    setLoading(true);
    setError("");
    try {
      setRows(await loadOptions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load lookup");
    } finally {
      setLoading(false);
    }
  };

  const commitRow = (row: LookupRow) => {
    onChange(String(getLookupValue(row, valueField) || ""), row);
    setOpen(false);
    setQuery("");
    setSelectedRow(null);
    setPage(1);
    setSelectedKey("");
  };

  const confirmSelection = () => {
    if (selectedRow) commitRow(selectedRow);
  };

  // Called by the hidden radio input onChange — this is what actually fires on click
  const handleRadioChange = (row: LookupRow) => {
    setSelectedRow(row);
    setSelectedKey(getRowKey(row));
    pendingCommit.current = row;
  };

  return (
    <>
      <label className={compact ? "block" : "field"}>
        {!compact && <span>{label}</span>}
        <div className="flex h-9 overflow-hidden rounded-md border bg-background">
          <button
            className="min-w-0 flex-1 border-0 bg-transparent px-3 text-left text-sm text-foreground disabled:opacity-60"
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <span className={value ? "block truncate" : "block truncate text-muted-foreground"}>
              {displayValue || value || placeholder || `Select ${label}`}
            </span>
          </button>
          {/* FIX 1: removed duplicate nested <button> — only one clear button */}
          {value && !disabled && (
            <button
              className="grid w-8 place-items-center text-muted-foreground hover:bg-accent"
              type="button"
              onClick={() => onChange("", null)}
            >
              <X size={14} />
            </button>
          )}
          {/* FIX 2: removed duplicate nested <button> — only one search button */}
          <button
            className="grid w-9 place-items-center border-l text-muted-foreground hover:bg-accent"
            type="button"
            onClick={openLookup}
            disabled={disabled}
          >
            <Search size={15} />
          </button>
        </div>
      </label>{/* FIX 3: closing </label> was missing entirely */}

      {/* Dialog — same props as always */}
      <Dialog
        open={open}
        wide
        title={label}
        description="Select a value"
        onClose={() => {
          setOpen(false);
          setSelectedRow(null);
          setSelectedKey("");
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setSelectedRow(null);
                setSelectedKey("");
              }}
            >
              Cancel
            </Button>
            {/* FIX 4: removed duplicate <Button>Select</Button> */}
            <Button disabled={!selectedRow} onClick={confirmSelection}>
              Select
            </Button>
          </>
        }
      >
        <div className="grid gap-2">
          {/* Search */}
          <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground">
            <Search size={14} className="shrink-0" />
            <input
              autoFocus
              className="h-full flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, name, description..."
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          {error && <div className="alert error">{error}</div>}

          {/* 
            The table uses a REAL <input type="radio"> per row — hidden visually,
            but its onChange is what fires reliably on single click regardless of
            scroll containers or event interception. The visible dot is just CSS
            driven by the :checked state via a sibling label trick.
            Do NOT replace with onClick on <tr> — it gets swallowed by Dialog's
            overflow-y-auto scroll container.
          */}
          <div className="rounded-md border bg-card" style={{ maxHeight: 480, overflowY: "auto", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#eef3fb" }}>
                <tr>
                  <th style={{ width: 32, padding: "5px 6px", borderBottom: "1px solid #d7e1f1" }} />
                  {columns.map((col) => (
                    <th
                      key={col.field}
                      style={{
                        padding: "5px 10px",
                        textAlign: "left",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#17345f",
                        borderBottom: "1px solid #d7e1f1",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#888" }}>
                      Loading...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#888" }}>
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => {
                    const key = getRowKey(row) || String(index);
                    const sel = selectedKey === key || (!selectedKey && getRowKey(row) === value);
                    const inputId = `lookup-row-${key}-${index}`;

                    return (
                      // The <label> wraps the whole row — so clicking ANYWHERE on the
                      // row triggers the hidden radio input's onChange. This is native
                      // browser behavior and cannot be blocked by JS event propagation.
                      <tr
                        key={key}
                        style={{
                          borderBottom: "1px solid #f0f0f0",
                          borderLeft: sel ? "3px solid var(--primary)" : "3px solid transparent",
                          background: sel ? "color-mix(in srgb, var(--primary) 8%, white)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        {/* Radio cell */}
                        <td style={{ width: 32, padding: "0 6px", textAlign: "center", verticalAlign: "middle" }}>
                          <label
                            htmlFor={inputId}
                            style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: "4px 0" }}
                          >
                            {/* Hidden native radio — onChange fires reliably on single click */}
                            <input
                              id={inputId}
                              type="radio"
                              name="lookup-selection"
                              value={key}
                              checked={sel}
                              onChange={() => handleRadioChange(row)}
                              style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                            />
                            {/* Custom visible dot */}
                            <span style={{
                              display: "inline-block",
                              width: 11,
                              height: 11,
                              borderRadius: "50%",
                              background: sel ? "var(--primary)" : "white",
                              border: sel ? "2px solid var(--primary)" : "2px solid #bbb",
                              boxShadow: sel ? "0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)" : "none",
                              transition: "all 0.08s ease",
                              flexShrink: 0,
                            }} />
                          </label>
                        </td>

                        {/* Data cells — each wrapped in a label pointing to the radio */}
                        {columns.map((col) => (
                          <td key={col.field} style={{ padding: 0, verticalAlign: "middle" }}>
                            <label
                              htmlFor={inputId}
                              style={{
                                display: "block",
                                padding: "4px 10px",
                                fontSize: 11,
                                lineHeight: "15px",
                                fontWeight: sel ? 600 : 400,
                                color: sel ? "var(--primary)" : "#222",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 400,
                              }}
                            >
                              {String(getLookupValue(row, col.field) || "")}
                            </label>
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between px-1">
            <p className="m-0 text-[11px] text-muted-foreground">
              {filteredRows.length} record{filteredRows.length !== 1 ? "s" : ""}
              {query ? ` matching "${query}"` : ""}
            </p>
            {selectedRow && (
              <p className="m-0 text-[11px] font-semibold text-primary">
                ✓ {String(getLookupValue(selectedRow, valueField) || "")}
              </p>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}