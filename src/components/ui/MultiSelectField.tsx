import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional short code shown in its own column (e.g. "00001"). Omit to render a single-column list. */
  code?: string;
}

export interface MultiSelectFieldProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
  loading?: boolean;
  /** Value used for the "All" sentinel option. Defaults to "All". */
  allValue?: string;
  /** Hide the built-in "All" option (use when the caller manages "select all" differently). */
  hideAllOption?: boolean;
  placeholder?: string;
  /** Header label for the code column, when options carry a `code`. Defaults to "Code". */
  codeColumnLabel?: string;
  /** Header label for the label column, when options carry a `code`. Defaults to the field `label`. */
  labelColumnLabel?: string;
}

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
};

const optionRowBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  fontSize: 12,
  borderRadius: 5,
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
};

const checkboxStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  minWidth: 14,
  minHeight: 14,
  margin: 0,
  cursor: "pointer",
  flexShrink: 0,
};

const CODE_COL_WIDTH = 64;

const THEME = "#1d4ed8";
/** Dark navy header background used for the CODE / label table (matches the coded-list screens). */
const HEADER_NAVY = "#16296b";
/** Bold blue used for the code text in the coded-list rows. */
const CODE_TEXT_COLOR = "#2952cc";

/** z-index high enough to clear any app chrome (modals, sticky headers, etc). */
const PANEL_Z_INDEX = 2147483000;

const CheckmarkIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={THEME} strokeWidth="3" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Dropdown multi-select: click the field to open a checklist of options.
 * Each option has its own checkbox; the closed field shows a summary of what's
 * selected ("All", a single label, or "N selected"). Closes on outside click
 * or Escape. Used anywhere a multi-value filter is needed (Principal, Job
 * Number, Product, Site, etc.) so every report panel shares identical
 * select/clear behavior instead of re-implementing it per field.
 *
 * The dropdown panel is rendered through a React portal into document.body,
 * positioned with `position: fixed` from the trigger's bounding rect. This is
 * deliberate: several screens wrap this field in cards that set
 * `overflow: hidden` (e.g. `.freight-report-card`), which used to clip the
 * panel and break its stacking/shadow. Portaling sidesteps any ancestor's
 * overflow, transform, or z-index entirely, so the panel always floats
 * cleanly above the rest of the page regardless of where the field lives.
 *
 * The panel includes a search box (filters by code or label) and a footer
 * showing the visible item count with a Close button. When any option
 * carries a `code`, the panel switches to the coded-list look: a dark navy
 * CODE / label table header, bold blue code text, no checkbox squares, and a
 * trailing checkmark on selected rows instead. Options without a `code`
 * fall back to the plain checkbox list.
 *
 * Option rows use <div role="option"> (not bare <label>) so global form CSS
 * that forces label { flex-direction: column } cannot stack the checkbox
 * under the text (e.g. Freight .freight-ui-standard screens).
 */
export const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  label,
  options,
  value,
  onChange,
  loading,
  allValue = "All",
  hideAllOption = false,
  placeholder = "Select…",
  codeColumnLabel = "Code",
  labelColumnLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = !hideAllOption && value.includes(allValue);
  const hasCode = useMemo(() => options.some((o) => !!o.code), [options]);

  const recalcPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  // Position the portal panel under the trigger, and keep it pinned on scroll/resize.
  useEffect(() => {
    if (!open) return;
    recalcPosition();
    window.addEventListener("scroll", recalcPosition, true);
    window.addEventListener("resize", recalcPosition);
    return () => {
      window.removeEventListener("scroll", recalcPosition, true);
      window.removeEventListener("resize", recalcPosition);
    };
  }, [open, recalcPosition]);

  // Close on outside click / Escape (checks both the trigger and the portaled panel).
  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideRoot && !insidePanel) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset search when the dropdown opens/closes, and focus the search box on open
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      // Focus after the panel has mounted
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.code ? o.code.toLowerCase().includes(q) : false)
    );
  }, [options, searchQuery]);

  const toggleOption = (optValue: string) => {
    if (isAllSelected) {
      // Coming from "All" → start a fresh specific selection with just this one
      onChange([optValue]);
      return;
    }
    const next = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];

    if (!next.length) {
      onChange(hideAllOption ? [] : [allValue]);
      return;
    }
    onChange(next);
  };

  const toggleAll = () => {
    onChange([allValue]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(hideAllOption ? [] : [allValue]);
  };

  const summaryText = (): string => {
    if (loading) return "Loading…";
    if (!value.length || isAllSelected) return "All";
    if (value.length === 1) {
      const match = options.find((o) => o.value === value[0]);
      return match ? match.label : value[0];
    }
    return `${value.length} selected`;
  };

  const panel =
    open && !loading && panelRect ? (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: panelRect.top,
          left: panelRect.left,
          width: panelRect.width,
          zIndex: PANEL_Z_INDEX,
          background: "#fff",
          border: "1px solid #d1d5db",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search box */}
        <div style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ position: "relative" }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or description..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px 6px 26px",
                fontSize: 12,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                outline: "none",
                color: "#111827",
                background: "#fff",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = THEME)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
            />
          </div>
        </div>

        {/* Column header (only when options carry a code) */}
        {hasCode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: HEADER_NAVY,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            <span style={{ width: CODE_COL_WIDTH, flexShrink: 0 }}>{codeColumnLabel}</span>
            <span style={{ flex: 1 }}>{labelColumnLabel || label || "Description"}</span>
          </div>
        )}

        {/* Scrollable option list */}
        <div style={{ maxHeight: 220, overflowY: "auto", padding: 4, background: "#fff" }}>
          {!hideAllOption && (
            <div
              role="option"
              aria-selected={isAllSelected}
              onClick={toggleAll}
              style={{
                ...optionRowBase,
                fontWeight: 600,
                color: "#111827",
                background: isAllSelected ? "#eff6ff" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isAllSelected) e.currentTarget.style.background = "#f9fafb";
              }}
              onMouseLeave={(e) => {
                if (!isAllSelected) e.currentTarget.style.background = "transparent";
              }}
            >
              {hasCode ? (
                <span style={{ width: CODE_COL_WIDTH, flexShrink: 0 }} />
              ) : (
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...checkboxStyle, accentColor: THEME }}
                />
              )}
              <span style={{ flex: 1 }}>All</span>
              {hasCode && isAllSelected && <CheckmarkIcon />}
            </div>
          )}

          {!hideAllOption && filteredOptions.length > 0 && (
            <div style={{ borderTop: "1px solid #f1f5f9", margin: "2px 4px" }} />
          )}

          {filteredOptions.length === 0 && (
            <div style={{ padding: "8px 10px", fontSize: 12, color: "#9ca3af" }}>
              {options.length === 0 ? "No options available" : "No options match your search"}
            </div>
          )}

          {filteredOptions.map((opt) => {
            const checked = !isAllSelected && value.includes(opt.value);
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={checked}
                onClick={() => toggleOption(opt.value)}
                style={{
                  ...optionRowBase,
                  color: "#374151",
                  background: checked ? "#eff6ff" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!checked) e.currentTarget.style.background = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  if (!checked) e.currentTarget.style.background = "transparent";
                }}
              >
                {hasCode ? (
                  <span
                    style={{
                      width: CODE_COL_WIDTH,
                      flexShrink: 0,
                      fontWeight: 700,
                      color: CODE_TEXT_COLOR,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.code}
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(opt.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ ...checkboxStyle, accentColor: THEME }}
                  />
                )}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {opt.label}
                </span>
                {hasCode && checked && <CheckmarkIcon />}
              </div>
            );
          })}
        </div>

        {/* Footer: item count + Close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            borderTop: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {filteredOptions.length} item{filteredOptions.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#374151",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 5,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div style={{ marginBottom: 14 }} ref={rootRef}>
      {label ? <label style={fieldLabelStyle}>{label}</label> : null}

      <div style={{ position: "relative" }}>
        {/* Closed field */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !loading && setOpen((o) => !o)}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "7px 10px",
            fontSize: 12,
            color: loading ? "#9ca3af" : "#111827",
            background: "#fff",
            border: `1px solid ${open ? THEME : "#d1d5db"}`,
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            textAlign: "left",
            boxShadow: open ? "0 0 0 2px rgba(29,78,216,0.12)" : "none",
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {summaryText()}
          </span>

          <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {!isAllSelected && value.length > 0 && (
              <span
                onClick={clearAll}
                title="Clear selection"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  color: "#9ca3af",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6b7280")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
            )}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
                flexShrink: 0,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>

        {/* Dropdown panel: portaled to <body> so ancestor overflow/z-index never clips or discolors it */}
        {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
      </div>

      {!open && (
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
          {loading ? "" : "Click to select multiple"}
        </div>
      )}
    </div>
  );
};

export default MultiSelectField;