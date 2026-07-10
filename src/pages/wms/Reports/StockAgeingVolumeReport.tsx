import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../../api/client";
import { executeWmsInboundSql } from "../../../api/wms";
import { Select } from "../../../components/ui/Select";
import { MultiSelectField } from "../../../components/ui/MultiSelectField";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option {
  value: string;
  label: string;
}

interface LookupRow {
  [key: string]: any;
}

interface Params {
  prin_code:      string[];
  dept_code_from: string;
  prod_code_from: string;
  prod_code_to:   string;
  age1: string;
  age2: string;
  age3: string;
  age4: string;
  age5: string;
}

// ─── Param SQL queries ────────────────────────────────────────────────────────

const PARAM_SQL = {
  prin: "select distinct prin_code, prin_name from VW_BOWM_STKLED_FOREXPAGEING",
  prod: "select distinct prod_code, prod_name from VW_BOWM_STKLED_FOREXPAGEING",
  dept: "select distinct dept_code from VW_BOWM_STKLED_FOREXPAGEING",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getField = (row: LookupRow, ...keys: string[]): string => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return String(row[k]);
    const upper = k.toUpperCase();
    if (row[upper] !== undefined && row[upper] !== null) return String(row[upper]);
    const lower = k.toLowerCase();
    if (row[lower] !== undefined && row[lower] !== null) return String(row[lower]);
  }
  return "";
};

const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): Option[] =>
  rows
    .map((r) => {
      const code = getField(r, codeKey);
      const name = getField(r, nameKey);
      if (!code) return null;
      return { value: code, label: name ? `${code} - ${name}` : code };
    })
    .filter((o): o is Option => !!o)
    .sort((a, b) => a.value.localeCompare(b.value));

// Rows with only a single code column → { value: code, label: code }
const mapSingleColumnOptions = (rows: LookupRow[], codeKey: string): Option[] =>
  rows
    .map((r) => getField(r, codeKey))
    .filter((v) => !!v)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));

// ─── Shared label style ───────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4,
};

const numberInputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db",
  fontSize: 12, boxSizing: "border-box",
};

// ─── AgeRangeField ────────────────────────────────────────────────────────────

const AgeRangeField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label, value, onChange,
}) => (
  <div style={{ marginBottom: 10 }}>
    <label style={fieldLabelStyle}>{label}</label>
    <input
      type="number"
      min={1}
      style={numberInputStyle}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// ─── SelectField (single value, backed by the shared Select component) ────────

const SelectField: React.FC<{
  label:        string;
  options:      Option[];
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  loading?:     boolean;
}> = ({ label, options, value, onChange, placeholder, loading }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={fieldLabelStyle}>{label}</label>
    <Select
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      disabled={loading}
      style={{ fontSize: 12 }}
    >
      <option value="">{loading ? "Loading…" : (placeholder ?? "Select…")}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_PARAMS: Params = {
  prin_code: ["All"], dept_code_from: "", prod_code_from: "", prod_code_to: "",
  age1: "30", age2: "60", age3: "90", age4: "120", age5: "150",
};

const StockAgeingVolumeReport: React.FC = () => {
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [reportHtml, setReportHtml] = useState<string>("");
  const [error,      setError]      = useState<string>("");

  const [prinOptions, setPrinOptions] = useState<Option[]>([]);
  const [prodOptions, setProdOptions] = useState<Option[]>([]);
  const [deptOptions, setDeptOptions] = useState<Option[]>([]);
  const [optLoading,  setOptLoading]  = useState(false);
  const [optError,    setOptError]    = useState<string>("");

  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Load dropdown options
  useEffect(() => {
    setOptLoading(true);
    setOptError("");
    Promise.all([
      executeWmsInboundSql(PARAM_SQL.prin),
      executeWmsInboundSql(PARAM_SQL.prod),
      executeWmsInboundSql(PARAM_SQL.dept),
    ])
      .then(([prinRows, prodRows, deptRows]) => {
        setPrinOptions(mapCodeNameOptions(prinRows, "prin_code", "prin_name"));
        setProdOptions(mapCodeNameOptions(prodRows, "prod_code", "prod_name"));
        setDeptOptions(mapSingleColumnOptions(deptRows, "dept_code"));
      })
      .catch((e) => {
        console.error("Failed to load parameter options", e);
        setOptError(e?.message ?? "Failed to load filter options");
      })
      .finally(() => setOptLoading(false));
  }, []);

  // ── Auto-load report on mount with defaults
  useEffect(() => {
    fetchReport(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildPayload = (p: Params) => ({
    prin_code:      p.prin_code.includes("All") ? ["All"] : p.prin_code,
    dept_code_from: p.dept_code_from || null,
    prod_code_from: p.prod_code_from || null,
    prod_code_to:   p.prod_code_to   || null,
    age1: Number(p.age1) || 30,
    age2: Number(p.age2) || 60,
    age3: Number(p.age3) || 90,
    age4: Number(p.age4) || 120,
    age5: Number(p.age5) || 150,
  });

  // ── Fetch HTML report
  const fetchReport = useCallback(async (p: Params) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post(
        "/api/wms/reports/stockageing/volume/html",
        buildPayload(p),
        { responseType: "text" },
      );
      setReportHtml(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load report. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Print
  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  // ── Excel export
  const handleExcel = async () => {
    setExporting(true);
    try {
      const res = await api.post(
        "/api/wms/reports/stockageing/volume/excel",
        buildPayload(params),
        { responseType: "blob" },
      );
      const url  = URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `stock_ageing_volume_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleViewReport = () => {
    fetchReport(params);
    setPanelOpen(false);
  };

  const setParam = <K extends keyof Params>(key: K, val: Params[K]) =>
    setParams((prev) => ({ ...prev, [key]: val }));

  // ── Styles (deep blue theme — matches the HTML report title bar)
  const THEME       = "#0f766e";
  const THEME_DARK  = "#115e59";
  const THEME_LIGHT = "#5eead4";

  const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
    border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12,
    fontWeight: 600, color: "#374151", whiteSpace: "nowrap", transition: "background 0.15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9", overflow: "hidden" }}>

      {/* ── Top toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", background: "#fff", borderBottom: "1px solid #e5e7eb",
        flexShrink: 0, gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, background: THEME,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {/* Volume icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Stock Ageing (Volume) Report</div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Warehouse Management System</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            style={btnBase} onClick={handlePrint} disabled={!reportHtml || loading}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print
          </button>

          <button
            style={{ ...btnBase, color: "#166534", borderColor: "#86efac" }}
            onClick={handleExcel} disabled={!reportHtml || loading || exporting}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            {exporting ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: "spin 1s linear infinite" }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            )}
            {exporting ? "Exporting…" : "Excel"}
          </button>

          <button
            style={{
              ...btnBase,
              background: panelOpen ? THEME : "#fff",
              color: panelOpen ? "#fff" : "#374151",
              borderColor: panelOpen ? THEME : "#d1d5db",
            }}
            onClick={() => setPanelOpen((p) => !p)}
            onMouseEnter={(e) => { if (!panelOpen) e.currentTarget.style.background = "#f9fafb"; }}
            onMouseLeave={(e) => { if (!panelOpen) e.currentTarget.style.background = "#fff"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
            </svg>
            Parameters
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        <div style={{
          flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
          transition: "margin-right 0.3s ease", marginRight: panelOpen ? 320 : 0,
        }}>
          {loading && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(255,255,255,0.85)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              zIndex: 50, gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, border: "3px solid #e5e7eb", borderTop: `3px solid ${THEME}`,
                borderRadius: "50%", animation: "spin 0.8s linear infinite",
              }}/>
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Loading report…</span>
            </div>
          )}

          {error && !loading && (
            <div style={{
              margin: 20, padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, color: "#dc2626", fontSize: 13, display: "flex", alignItems: "center", gap: 10,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {reportHtml && !error && (
            <iframe
              ref={iframeRef}
              srcDoc={reportHtml}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
              title="Stock Ageing Volume Report"
            />
          )}

          {!reportHtml && !loading && !error && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", color: "#9ca3af", gap: 12,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span style={{ fontSize: 13 }}>No report loaded</span>
            </div>
          )}
        </div>

        {/* ── Slide-in Parameter Panel ── */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 320, background: "#fff",
          borderLeft: "1px solid #e5e7eb", boxShadow: "-4px 0 20px rgba(0,0,0,0.08)",
          transform: panelOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s ease",
          display: "flex", flexDirection: "column", zIndex: 40, overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex",
            justifyContent: "space-between", alignItems: "center", background: THEME, flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>Report Parameters</div>
              <div style={{ fontSize: 10, color: THEME_LIGHT, marginTop: 2 }}>Adjust filters and view report</div>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#fff" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            {optError && (
              <div style={{
                marginBottom: 14, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 6, color: "#dc2626", fontSize: 11,
              }}>
                {optError}
              </div>
            )}

            <MultiSelectField
              label="Principal Code"
              options={prinOptions}
              value={params.prin_code}
              onChange={(v: string[]) => setParam("prin_code", v)}
              loading={optLoading}
            />

            <SelectField
              label="Department Code From"
              options={deptOptions}
              value={params.dept_code_from}
              onChange={(v) => setParam("dept_code_from", v)}
              placeholder="Select department"
              loading={optLoading}
            />

            <SelectField
              label="Product Code From"
              options={prodOptions}
              value={params.prod_code_from}
              onChange={(v) => setParam("prod_code_from", v)}
              placeholder="Select start product"
              loading={optLoading}
            />

            <SelectField
              label="Product Code To"
              options={prodOptions}
              value={params.prod_code_to}
              onChange={(v) => setParam("prod_code_to", v)}
              placeholder="Select end product"
              loading={optLoading}
            />

            {/* Age bucket boundaries */}
            <div style={{
              background: "#f8fafc", borderRadius: 8, padding: "12px 14px",
              border: "1px solid #e5e7eb", marginBottom: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                Age Bucket Boundaries (days)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                <AgeRangeField label="Bucket 1 Cutoff" value={params.age1} onChange={(v) => setParam("age1", v)} />
                <AgeRangeField label="Bucket 2 Cutoff" value={params.age2} onChange={(v) => setParam("age2", v)} />
                <AgeRangeField label="Bucket 3 Cutoff" value={params.age3} onChange={(v) => setParam("age3", v)} />
                <AgeRangeField label="Bucket 4 Cutoff" value={params.age4} onChange={(v) => setParam("age4", v)} />
                <AgeRangeField label="Bucket 5 Cutoff" value={params.age5} onChange={(v) => setParam("age5", v)} />
              </div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                Produces buckets: Below {params.age1 || 30}, {params.age1 || 30}-{params.age2 || 60}, {params.age2 || 60}-{params.age3 || 90}, {params.age3 || 90}-{params.age4 || 120}, {params.age4 || 120}-{params.age5 || 150}, Above {params.age5 || 150}
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 18px", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
            <button
              onClick={handleViewReport}
              disabled={loading}
              style={{
                width: "100%", padding: "10px", background: loading ? "#9ca3af" : THEME, color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8, transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = THEME_DARK; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = THEME; }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite",
                  }}/>
                  Loading…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  View Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default StockAgeingVolumeReport;