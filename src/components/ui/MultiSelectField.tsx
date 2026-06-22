import React, { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectFieldProps {
  label:       string;
  options:     MultiSelectOption[];
  value:       string[];
  onChange:    (v: string[]) => void;
  loading?:    boolean;
  /** Value used for the "All" sentinel option. Defaults to "All". */
  allValue?:   string;
  /** Hide the built-in "All" option (use when the caller manages "select all" differently). */
  hideAllOption?: boolean;
  placeholder?: string;
}

const fieldLabelStyle: React.CSSProperties = {
  display:      "block",
  fontSize:     11,
  fontWeight:   600,
  color:        "#374151",
  marginBottom: 4,
};

/**
 * Dropdown multi-select: click the field to open a checklist of options.
 * Each option has its own checkbox; the closed field shows a summary of what's
 * selected ("All", a single label, or "N selected"). Closes on outside click
 * or Escape. Used anywhere a multi-value filter is needed (Principal, Job
 * Number, Product, Site, etc.) so every report panel shares identical
 * select/clear behavior instead of re-implementing it per field.
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
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isAllSelected = !hideAllOption && value.includes(allValue);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const THEME = "#1d4ed8";

  return (
    <div style={{ marginBottom: 14 }} ref={rootRef}>
      <label style={fieldLabelStyle}>{label}</label>

      <div style={{ position: "relative" }}>
        {/* Closed field */}
        <button
          type="button"
          onClick={() => !loading && setOpen((o) => !o)}
          disabled={loading}
          style={{
            width:          "100%",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            8,
            padding:        "7px 10px",
            fontSize:       12,
            color:          loading ? "#9ca3af" : "#111827",
            background:     "#fff",
            border:         `1px solid ${open ? THEME : "#d1d5db"}`,
            borderRadius:   6,
            cursor:         loading ? "not-allowed" : "pointer",
            textAlign:      "left",
            boxShadow:      open ? "0 0 0 2px rgba(29,78,216,0.12)" : "none",
          }}
        >
          <span style={{
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
            flex:         1,
          }}>
            {summaryText()}
          </span>

          <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {!isAllSelected && value.length > 0 && (
              <span
                onClick={clearAll}
                title="Clear selection"
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  width:        16,
                  height:       16,
                  borderRadius: "50%",
                  color:        "#9ca3af",
                  cursor:       "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6b7280")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </span>
            )}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </button>

        {/* Dropdown panel */}
        {open && !loading && (
          <div style={{
            position:     "absolute",
            top:          "calc(100% + 4px)",
            left:         0,
            right:        0,
            zIndex:       60,
            background:   "#fff",
            border:       "1px solid #d1d5db",
            borderRadius: 8,
            boxShadow:    "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight:    220,
            overflowY:    "auto",
            padding:      4,
          }}>
            {!hideAllOption && (
              <label
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          8,
                  padding:      "6px 8px",
                  fontSize:     12,
                  fontWeight:   600,
                  color:        "#111827",
                  borderRadius: 5,
                  cursor:       "pointer",
                  background:   isAllSelected ? "#eff6ff" : "transparent",
                }}
                onMouseEnter={(e) => { if (!isAllSelected) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={(e) => { if (!isAllSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  style={{ accentColor: THEME, width: 14, height: 14, cursor: "pointer" }}
                />
                All
              </label>
            )}

            {!hideAllOption && options.length > 0 && (
              <div style={{ borderTop: "1px solid #f1f5f9", margin: "2px 4px" }} />
            )}

            {options.length === 0 && (
              <div style={{ padding: "8px 10px", fontSize: 12, color: "#9ca3af" }}>No options available</div>
            )}

            {options.map((opt) => {
              const checked = !isAllSelected && value.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          8,
                    padding:      "6px 8px",
                    fontSize:     12,
                    color:        "#374151",
                    borderRadius: 5,
                    cursor:       "pointer",
                    background:   checked ? "#eff6ff" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(opt.value)}
                    style={{ accentColor: THEME, width: 14, height: 14, cursor: "pointer", flexShrink: 0 }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        )}
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