import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Printer,
    RotateCcw,
    BarChart2,
    Download,
    Eye,
} from "lucide-react";
import { api } from "../../api/client";
import { executeWmsInboundSql } from "../../api/wms";
import { Select } from "../../components/ui/Select";
import { MultiSelectField } from "../../components/ui/MultiSelectField";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option {
    value: string;
    label: string;
}

interface LookupRow {
    [key: string]: any;
}

interface Params {
    prin_code: string[];
    job_no: string[];
    prod_code: string[];
    site_code: string[];
    location_code_from: string;
    location_code_to: string;
    group_by: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Case-insensitive key lookup
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

// Rows with a code + name pair → { value: code, label: "code - name" }
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

// Escapes single quotes for safe interpolation into a SQL string literal
const sqlEscape = (v: string): string => v.replace(/'/g, "''");

// Builds a `COL IN ('a','b')` clause for a selected-values array
const inClause = (col: string, values: string[]): string => {
    if (!values.length || values.includes("All")) return "";
    const list = values.map((v) => `'${sqlEscape(v)}'`).join(",");
    return `${col} IN (${list})`;
};

// ─── Shared styles ─────────────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: "#6b7280",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

// ─── Reusable components ──────────────────────────────────────────────────────

function FloatLabel({ label, required, children, bgColor = "#fff" }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    bgColor?: string;
}) {
    return (
        <div style={{ position: "relative", marginTop: 6 }}>
            <span style={{
                position: "absolute",
                top: -8,
                left: 10,
                fontSize: 11,
                color: "#6b7280",
                background: bgColor,
                padding: "0 4px",
                zIndex: 1,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 500,
            }}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </span>
            {children}
        </div>
    );
}

// ─── SelectField ──────────────────────────────────────────────────────────────

const SelectField: React.FC<{
    label: string;
    options: Option[];
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    loading?: boolean;
}> = ({ label, options, value, onChange, placeholder, loading }) => (
    <div style={{ marginBottom: 14 }}>
        <label style={fieldLabelStyle}>{label}</label>
        <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
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

export default function StockDetailReport() {
    // ── State
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string>("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

    const reportWindowRef = useRef<Window | null>(null);

    // ── Parameter options
    const [prinOptions, setPrinOptions] = useState<Option[]>([]);
    const [jobOptions, setJobOptions] = useState<Option[]>([]);
    const [prodOptions, setProdOptions] = useState<Option[]>([]);
    const [siteOptions, setSiteOptions] = useState<Option[]>([]);
    const [locationOptions, setLocationOptions] = useState<Option[]>([]);
    const [optLoading, setOptLoading] = useState(false);
    const [optError, setOptError] = useState<string>("");

    // ── Parameter values
    const [params, setParams] = useState<Params>({
        prin_code: ["All"],
        job_no: ["All"],
        prod_code: ["All"],
        site_code: ["All"],
        location_code_from: "",
        location_code_to: "",
        group_by: "",
    });

    const optionsRequestRef = useRef(0);

    // ── Cross-filtered option loader ─────────────────────────────────────────
    const loadCascadedOptions = useCallback(async (p: Params) => {
        const requestId = ++optionsRequestRef.current;
        setOptLoading(true);
        setOptError("");

        const prinFilter = inClause("PRIN_CODE", p.prin_code);
        const jobFilter = inClause("JOB_NO", p.job_no);
        const prodFilter = inClause("PROD_CODE", p.prod_code);
        const siteFilter = inClause("SITE_CODE", p.site_code);

        const whereExcept = (...exclude: string[]): string => {
            const all = { prin: prinFilter, job: jobFilter, prod: prodFilter, site: siteFilter };
            const clauses = Object.entries(all)
                .filter(([key]) => !exclude.includes(key))
                .map(([, clause]) => clause)
                .filter(Boolean);
            return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
        };

        const sql = {
            prin: `select distinct prin_code, prin_name from VW_BOWM_STK_LEDGER ${whereExcept("prin")}`,
            job: `select distinct(JOB_NO) from VW_BOWM_STK_LEDGER ${whereExcept("job")}`,
            prod: `select distinct PROD_CODE, PROD_NAME from VW_BOWM_STK_LEDGER ${whereExcept("prod")}`,
            site: `select distinct site_code from VW_BOWM_STK_LEDGER ${whereExcept("site")}`,
            location: `select distinct location_code from VW_BOWM_STK_LEDGER ${whereExcept()}`,
        };

        try {
            const [prinRows, jobRows, prodRows, siteRows, locRows] = await Promise.all([
                executeWmsInboundSql(sql.prin),
                executeWmsInboundSql(sql.job),
                executeWmsInboundSql(sql.prod),
                executeWmsInboundSql(sql.site),
                executeWmsInboundSql(sql.location),
            ]);

            if (requestId !== optionsRequestRef.current) return;

            const nextPrin = mapCodeNameOptions(prinRows, "prin_code", "prin_name");
            const nextJob = mapSingleColumnOptions(jobRows, "job_no");
            const nextProd = mapCodeNameOptions(prodRows, "prod_code", "prod_name");
            const nextSite = mapSingleColumnOptions(siteRows, "site_code");
            const nextLocation = mapSingleColumnOptions(locRows, "location_code");

            setPrinOptions(nextPrin);
            setJobOptions(nextJob);
            setProdOptions(nextProd);
            setSiteOptions(nextSite);
            setLocationOptions(nextLocation);

            setParams((prev) => {
                const reset = (
                    current: string[],
                    validOptions: Option[],
                ): string[] => {
                    if (current.includes("All")) return current;
                    const validValues = new Set(validOptions.map((o) => o.value));
                    const stillValid = current.filter((v) => validValues.has(v));
                    return stillValid.length ? stillValid : ["All"];
                };

                const validLocations = new Set(nextLocation.map((o) => o.value));
                const nextFrom = prev.location_code_from && !validLocations.has(prev.location_code_from)
                    ? "" : prev.location_code_from;
                const nextTo = prev.location_code_to && !validLocations.has(prev.location_code_to)
                    ? "" : prev.location_code_to;

                return {
                    ...prev,
                    prin_code: reset(prev.prin_code, nextPrin),
                    job_no: reset(prev.job_no, nextJob),
                    prod_code: reset(prev.prod_code, nextProd),
                    site_code: reset(prev.site_code, nextSite),
                    location_code_from: nextFrom,
                    location_code_to: nextTo,
                };
            });
        } catch (e: any) {
            if (requestId !== optionsRequestRef.current) return;
            console.error("Failed to load parameter options", e);
            setOptError(e?.message ?? "Failed to load filter options");
        } finally {
            if (requestId === optionsRequestRef.current) setOptLoading(false);
        }
    }, []);

    // ── Initial option load
    useEffect(() => {
        loadCascadedOptions(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Re-run the cascade live when Principal/Job/Product/Site change
    const cascadeKey = JSON.stringify([params.prin_code, params.job_no, params.prod_code, params.site_code]);
    const prevCascadeKeyRef = useRef(cascadeKey);
    useEffect(() => {
        if (prevCascadeKeyRef.current === cascadeKey) return;
        prevCascadeKeyRef.current = cascadeKey;
        loadCascadedOptions(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cascadeKey]);

    // ── Fetch the report HTML from the API and open it in a new browser tab
    const fetchReport = useCallback(async (p: Params) => {
        setLoading(true);
        setError("");

        const newTab = window.open("", "_blank");
        if (!newTab) {
            setLoading(false);
            setError("Your browser blocked the new tab. Please allow pop-ups for this site and try again.");
            return;
        }
        newTab.document.write(
            "<title>Stock Detail Report</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>"
        );

        try {
            const res = await api.post(
                "/api/wms/reports/stockdetails/html",
                {
                    prin_code: p.prin_code.includes("All") ? ["All"] : p.prin_code,
                    job_no: p.job_no.includes("All") ? ["All"] : p.job_no,
                    prod_code: p.prod_code.includes("All") ? ["All"] : p.prod_code,
                    site_code: p.site_code.includes("All") ? ["All"] : p.site_code,
                    location_code_from: p.location_code_from || null,
                    location_code_to: p.location_code_to || null,
                    group_by: p.group_by || null,
                },
                { responseType: "text" },
            );

            newTab.document.open();
            newTab.document.write(res.data);
            newTab.document.close();

            reportWindowRef.current = newTab;
            setHasGeneratedReport(true);
            setLastGeneratedAt(new Date());
        } catch (e: any) {
            newTab.document.open();
            newTab.document.write(
                "<title>Stock Detail Report</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>"
            );
            newTab.document.close();
            setError(e?.response?.data?.message ?? "Failed to load report. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Print (targets the most recently opened report tab)
    const handlePrint = () => {
        if (reportWindowRef.current && !reportWindowRef.current.closed) {
            reportWindowRef.current.focus();
            reportWindowRef.current.print();
        } else {
            setError("No open report tab to print. Generate the report again.");
        }
    };

    // ── Excel export
    const handleExcel = async () => {
        setExporting(true);
        try {
            const res = await api.post(
                "/api/wms/reports/stockdetails/excel",
                {
                    prin_code: params.prin_code.includes("All") ? ["All"] : params.prin_code,
                    job_no: params.job_no.includes("All") ? ["All"] : params.job_no,
                    prod_code: params.prod_code.includes("All") ? ["All"] : params.prod_code,
                    site_code: params.site_code.includes("All") ? ["All"] : params.site_code,
                    location_code_from: params.location_code_from || null,
                    location_code_to: params.location_code_to || null,
                    group_by: params.group_by || null,
                },
                { responseType: "blob" },
            );
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = `stock_detail_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert("Excel export failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    // ── Generate report
    const handleGenerateReport = () => {
        if (!params.prin_code.length || params.prin_code[0] === "") {
            setError("Please select a Principal before generating.");
            return;
        }
        fetchReport(params);
    };

    const setParam = <K extends keyof Params>(key: K, val: Params[K]) =>
        setParams((prev) => ({ ...prev, [key]: val }));

    const handleReset = () => {
        setParams({
            prin_code: ["All"],
            job_no: ["All"],
            prod_code: ["All"],
            site_code: ["All"],
            location_code_from: "",
            location_code_to: "",
            group_by: "",
        });
        setHasGeneratedReport(false);
        setError("");
        setLastGeneratedAt(null);
    };

    const groupByOptions: Option[] = [
        { value: "group_brand", label: "Product Group → Brand" },
        { value: "principal_product", label: "Principal → Product" },
        { value: "product_group", label: "Product Group" },
        { value: "site_location", label: "Site / Location" },
    ];

    const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
    const BG = "#EEF5FD";

    return (
        <div style={{ background: "#f3f4f6", padding: "6px 10px", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
            <style>{`
                .action-btn-primary:hover { background: #1e40af !important; }
                .action-btn-excel:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
                .field-row { background: #EEF5FD; border-radius: 8px; padding: 10px 12px; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "8px 12px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <BarChart2 size={17} color="#185FA5" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Stock Detail Report</span>
                        {hasGeneratedReport && (
                            <span style={{
                                fontSize: 10,
                                background: "#d1fae5",
                                color: "#065f46",
                                padding: "2px 10px",
                                borderRadius: 12,
                                fontWeight: 500,
                            }}>
                                Report Generated
                            </span>
                        )}
                    </div>

                    {/* Error display */}
                    {error && (
                        <div style={{
                            marginBottom: 10,
                            padding: "8px 14px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 6,
                            color: "#dc2626",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}>
                            <span>⚠️</span>
                            {error}
                            <button
                                onClick={() => setError("")}
                                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626" }}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {optError && (
                        <div style={{
                            marginBottom: 10,
                            padding: "8px 14px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 6,
                            color: "#dc2626",
                            fontSize: 12,
                        }}>
                            {optError}
                        </div>
                    )}

                    {/* Main layout */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, alignItems: "start" }}>

                        {/* ── Left: form fields ── */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                            {/* Principal + Product From + Product To */}
                            <div className="field-row" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 6, width: "100%" }}>
                                <FloatLabel label="Principal" required bgColor={BG}>
                                    <SelectField
                                        label=""
                                        options={prinOptions}
                                        value={params.prin_code[0] === "All" ? "" : params.prin_code[0] || ""}
                                        onChange={(v) => setParam("prin_code", v ? [v] : ["All"])}
                                        placeholder="Select Principal"
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Product From" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={prodOptions}
                                        value={params.prod_code}
                                        onChange={(v) => setParam("prod_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Site" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={siteOptions}
                                        value={params.site_code}
                                        onChange={(v) => setParam("site_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                            </div>

                            {/* Location Code Range */}
                            <div className="field-row">
                                <fieldset style={{ border: "0.5px solid #BFDBFE", borderRadius: 6, padding: "6px 12px 10px", margin: 0, background: "transparent" }}>
                                    <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                                        Location Code Range
                                    </legend>
                                    <div style={row2}>
                                        <SelectField
                                            label="From"
                                            options={locationOptions}
                                            value={params.location_code_from}
                                            onChange={(v) => setParam("location_code_from", v)}
                                            placeholder="Select start location"
                                            loading={optLoading}
                                        />
                                        <SelectField
                                            label="To"
                                            options={locationOptions}
                                            value={params.location_code_to}
                                            onChange={(v) => setParam("location_code_to", v)}
                                            placeholder="Select end location"
                                            loading={optLoading}
                                        />
                                    </div>
                                </fieldset>
                            </div>

                            {/* Job No */}
                            <div className="field-row" style={row2}>
                                <FloatLabel label="Job No" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={jobOptions}
                                        value={params.job_no}
                                        onChange={(v) => setParam("job_no", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <div>
                                  <FloatLabel label="Group By" bgColor={BG}>
                                      <SelectField
                                          label=""
                                          options={[{ value: "", label: "No grouping" }, ...groupByOptions]}
                                          value={params.group_by}
                                          onChange={(v) => setParam("group_by", v)}
                                          placeholder="Select grouping"
                                          loading={optLoading}
                                      />
                                  </FloatLabel>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status bar when report is generated */}
                    {hasGeneratedReport && (
                        <div style={{
                            marginTop: 10,
                            padding: "8px 14px",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>✅</span>
                                <span style={{ fontSize: 12, color: "#065f46" }}>
                                    Report generated successfully at {lastGeneratedAt?.toLocaleTimeString()}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    if (reportWindowRef.current && !reportWindowRef.current.closed) {
                                        reportWindowRef.current.focus();
                                    } else {
                                        setError("Report tab is closed. Please generate again.");
                                    }
                                }}
                                style={{
                                    padding: "4px 12px",
                                    background: "#185FA5",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <Eye size={12} /> Open Report
                            </button>
                        </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                            className="action-btn-excel"
                            onClick={handleReset}
                            disabled={loading}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #d1d5db",
                                background: "#fff",
                                cursor: loading ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#374151",
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>

                        <button
                            className="action-btn-excel"
                            onClick={handlePrint}
                            disabled={!hasGeneratedReport || loading}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #d1d5db",
                                background: "#fff",
                                cursor: (!hasGeneratedReport || loading) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#374151",
                                opacity: (!hasGeneratedReport || loading) ? 0.5 : 1,
                            }}
                        >
                            <Printer size={13} /> Print
                        </button>

                        <button
                            className="action-btn-excel"
                            onClick={handleExcel}
                            disabled={!hasGeneratedReport || loading || exporting}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #d1d5db",
                                background: "#fff",
                                cursor: (!hasGeneratedReport || loading || exporting) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#374151",
                                opacity: (!hasGeneratedReport || loading || exporting) ? 0.5 : 1,
                            }}
                        >
                            <Download size={13} /> {exporting ? "Exporting..." : "Export Excel"}
                        </button>

                        <button
                            className="action-btn-primary"
                            onClick={handleGenerateReport}
                            disabled={loading}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #185FA5",
                                background: loading ? "#94a3b8" : "#185FA5",
                                cursor: loading ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#fff",
                                transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) e.currentTarget.style.background = "#1e40af";
                            }}
                            onMouseLeave={(e) => {
                                if (!loading) e.currentTarget.style.background = "#185FA5";
                            }}
                        >
                            {loading ? (
                                <>
                                    <span style={{
                                        width: 12,
                                        height: 12,
                                        border: "2px solid rgba(255,255,255,0.3)",
                                        borderTop: "2px solid #fff",
                                        borderRadius: "50%",
                                        animation: "spin 0.8s linear infinite",
                                    }} />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Printer size={13} /> Generate Report
                                </>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}