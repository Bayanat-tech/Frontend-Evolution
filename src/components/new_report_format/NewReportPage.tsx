import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Filter, RotateCcw, Search, ChevronDown, X } from "lucide-react";
import type { NewReportPageProps, ReportFieldConfig, ReportOption } from "./types";
import { MultiSelectField } from "../../components/ui/MultiSelectField";

/**
 * Common report filter page — matches Freight Job List screenshot.
 *
 * Layout control for other developers:
 *   <NewReportPage fieldsPerRow={3} ... />   // 3 equal fields per row
 *   <NewReportPage fieldsPerRow={4} ... />   // 4 equal fields per row
 *   // or per-field:
 *   { key: "status", type: "select", colSpan: 3, ... }
 *   { key: "principal", type: "multiselect", colSpan: 4, ... }
 */
export function NewReportPage({
  title,
  fields,
  values,
  onChange,
  onClearAll,
  onGenerate,
  loading = false,
  optionsLoading = false,
  error = null,
  onClearError,
  children,
  reportVariantOptions,
  reportVariant,
  onReportVariantChange,
  defaultColSpan,
  fieldsPerRow,
}: NewReportPageProps) {
  const resolvedDefaultSpan =
    defaultColSpan ??
    (fieldsPerRow && fieldsPerRow > 0 ? Math.floor(12 / fieldsPerRow) : 4);

  return (
    <div
      style={{
        background: "#f1f5f9",
        minHeight: "100%",
        padding: "16px 20px 32px",
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          background: "#ffffff",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          overflow: "visible",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 12px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "#0f172a",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h1>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#2563eb",
              flexShrink: 0,
            }}
          />
        </div>

        {/* Report Filters header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 20px 6px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "#64748b",
            }}
          >
            <Filter size={14} strokeWidth={2} color="#64748b" />
            Report Filters
          </div>
          <button
            type="button"
            onClick={onClearAll}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              color: "#64748b",
              background: "transparent",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              padding: "4px 6px",
              borderRadius: 4,
            }}
          >
            <RotateCcw size={12} strokeWidth={2} />
            Clear All
          </button>
        </div>

        {error && (
          <div
            style={{
              margin: "4px 20px 10px",
              padding: "8px 12px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              color: "#b91c1c",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span style={{ flex: 1 }}>{error}</span>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#b91c1c",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Filter grid — Freight style: labels above, clean white */}
        <div style={{ padding: "4px 20px 16px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              columnGap: 14,
              rowGap: 16,
            }}
          >
            {fields.map((field) => (
              <FieldCell
                key={field.key}
                field={field}
                value={values[field.key]}
                toValue={field.toKey ? values[field.toKey] : undefined}
                onChange={onChange}
                disabled={loading || field.disabled}
                defaultSpan={resolvedDefaultSpan}
              />
            ))}

            {reportVariantOptions && onReportVariantChange && (
              <div style={{ gridColumn: `span ${resolvedDefaultSpan}` }}>
                <FieldLabel label="Report Variant" />
                <SingleSelectField
                  options={reportVariantOptions}
                  value={reportVariant ?? "Standard"}
                  onChange={onReportVariantChange}
                  placeholder="Standard"
                  loading={loading}
                />
              </div>
            )}
          </div>
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid #f1f5f9",
            background: "#fafbfc",
            minHeight: 56,
            borderRadius: "0 0 10px 10px",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
            Select filters and run the report.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || optionsLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 500,
              color: "#ffffff",
              background: loading || optionsLoading ? "#94a3b8" : "#1e3a8a",
              border: "none",
              borderRadius: 6,
              cursor: loading || optionsLoading ? "not-allowed" : "pointer",
              boxShadow:
                loading || optionsLoading
                  ? "none"
                  : "0 1px 2px rgba(30, 58, 138, 0.2)",
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 13,
                    height: 13,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "nr-spin 0.75s linear infinite",
                    display: "inline-block",
                  }}
                />
                Generating…
              </>
            ) : (
              <>
                <Search size={14} strokeWidth={2.25} />
                Generate Report
              </>
            )}
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

/* ───────────────────────────────────────────────────────────── */

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 500,
        color: "#64748b",
        marginBottom: 6,
        lineHeight: 1.2,
      }}
    >
      {label}
      {required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}
    </label>
  );
}

function FieldCell({
  field,
  value,
  toValue,
  onChange,
  disabled,
  defaultSpan,
}: {
  field: ReportFieldConfig;
  value: any;
  toValue?: any;
  onChange: (key: string, value: any) => void;
  disabled?: boolean;
  defaultSpan: number;
}) {
  const span = field.colSpan ?? defaultSpan;

  if (field.type === "daterange" && field.toKey) {
    const half = Math.min(span, 3);
    return (
      <>
        <div style={{ gridColumn: `span ${half}` }}>
          <FieldLabel
            label={field.label.replace(/ Range$/i, "") + " From"}
            required={field.required}
          />
          <DateInput
            value={value ?? ""}
            onChange={(v) => onChange(field.key, v)}
            disabled={disabled}
          />
        </div>
        <div style={{ gridColumn: `span ${half}` }}>
          <FieldLabel label="To" />
          <DateInput
            value={toValue ?? ""}
            onChange={(v) => onChange(field.toKey!, v)}
            disabled={disabled}
          />
        </div>
      </>
    );
  }

  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {field.type === "multiselect" && (
        <>
          <FieldLabel label={field.label} required={field.required} />
          <MultiSelectField
            label=""
            options={(field.options ?? []).map((o) => ({
              value: o.value,
              label: o.label,
              code: o.code,
            }))}
            value={Array.isArray(value) ? value : value ? [value] : ["All"]}
            onChange={(v) => onChange(field.key, v)}
            loading={field.loading || disabled}
            placeholder={field.placeholder ?? "All"}
          />
        </>
      )}

      {field.type === "select" && (
        <>
          <FieldLabel label={field.label} required={field.required} />
          <SingleSelectField
            options={field.options ?? []}
            value={value ?? ""}
            onChange={(v) => onChange(field.key, v)}
            placeholder={field.placeholder ?? "All"}
            loading={field.loading || disabled}
          />
        </>
      )}

      {field.type === "date" && (
        <>
          <FieldLabel label={field.label} required={field.required} />
          <DateInput
            value={value ?? ""}
            onChange={(v) => onChange(field.key, v)}
            disabled={disabled}
          />
        </>
      )}

      {field.type === "text" && (
        <>
          <FieldLabel label={field.label} required={field.required} />
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            style={inputStyle}
          />
        </>
      )}

      {field.hint && field.type !== "multiselect" && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{field.hint}</div>
      )}
    </div>
  );
}

function DateInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="DD / MM / YYYY"
      style={inputStyle}
    />
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
};

const THEME = "#1d4ed8";
const PANEL_Z = 2147483000;

/** Single-select portal dropdown — same visual language as MultiSelectField */
function SingleSelectField({
  options,
  value,
  onChange,
  placeholder = "All",
  loading,
}: {
  options: ReportOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelRect, setPanelRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const display = loading
    ? "Loading…"
    : selected
      ? selected.label
      : value
        ? value
        : placeholder;

  const recalcPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPanelRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 220),
    });
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) {
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

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      const id = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.code ? o.code.toLowerCase().includes(q) : false)
    );
  }, [options, searchQuery]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const panel =
    open && !loading && panelRect
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: panelRect.top,
              left: panelRect.left,
              width: panelRect.width,
              zIndex: PANEL_Z,
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={13}
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9ca3af",
                  }}
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
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
                />
              </div>
            </div>

            <div style={{ maxHeight: 240, overflowY: "auto", padding: 4 }}>
              <div
                role="option"
                onClick={() => pick("")}
                style={{
                  padding: "7px 10px",
                  fontSize: 12,
                  borderRadius: 5,
                  cursor: "pointer",
                  color: "#6b7280",
                  background: !value ? "#eff6ff" : "transparent",
                  fontWeight: !value ? 600 : 400,
                }}
              >
                {placeholder}
              </div>
              {filtered.length === 0 && (
                <div style={{ padding: "8px 10px", fontSize: 12, color: "#9ca3af" }}>
                  No options match
                </div>
              )}
              {filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(opt.value)}
                    style={{
                      padding: "7px 10px",
                      fontSize: 12,
                      borderRadius: 5,
                      cursor: "pointer",
                      color: active ? "#1e3a8a" : "#374151",
                      background: active ? "#eff6ff" : "transparent",
                      fontWeight: active ? 600 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {opt.label}
                  </div>
                );
              })}
            </div>

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
                {filtered.length} item{filtered.length === 1 ? "" : "s"}
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
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={loading}
        onClick={() => !loading && setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 12px",
          height: 36,
          fontSize: 13,
          color: loading || !selected ? "#94a3b8" : "#0f172a",
          background: "#fff",
          border: `1px solid ${open ? THEME : "#e2e8f0"}`,
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
          textAlign: "left",
          boxShadow: open ? "0 0 0 3px rgba(29,78,216,0.12)" : "none",
          boxSizing: "border-box",
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
          {display}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {value && !loading && (
            <span
              onClick={clear}
              title="Clear"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                color: "#9ca3af",
                cursor: "pointer",
              }}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            style={{
              color: "#94a3b8",
              transform: open ? "rotate(180deg)" : undefined,
              transition: "transform 0.15s",
            }}
          />
        </span>
      </button>
      {panel}
    </div>
  );
}

export default NewReportPage;