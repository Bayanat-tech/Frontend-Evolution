import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    Printer,
    RotateCcw,
    Clock,
    Download,
    Eye,
} from "lucide-react";
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
    prin_code: string[];
    dept_code: string[];
    prod_code: string[];
    age1: string;
    age2: string;
    age3: string;
    age4: string;
    age5: string;
    group_by: string;
}

type AgeKey = "age1" | "age2" | "age3" | "age4" | "age5";

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

// Rows with a code + name pair → { value: "code::name", label: "code - name" }
// The option value is a unique composite of code+name (not just the code),
// because the same code can legitimately appear on multiple distinct rows
// with different names (e.g. same PROD_CODE reused across different
// products in the source data). If two options shared the same `value`,
// the multi-select would visually tick both when only one was clicked.
// Use codeFromOptionValue/codesFromSelection below to recover the actual
// code(s) whenever building a SQL filter or the API payload.
const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): Option[] => {
    const seen = new Set<string>();
    const options: Option[] = [];
    rows.forEach((r) => {
        const code = getField(r, codeKey);
        const name = getField(r, nameKey);
        if (!code) return;
        const value = `${code}::${name}`;
        if (seen.has(value)) return; // skip exact duplicate rows only
        seen.add(value);
        options.push({ value, label: name ? `${code} - ${name}` : code });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
};

// Recovers the underlying code from a composite "code::name" option value.
const codeFromOptionValue = (v: string): string => v.split("::")[0];

// Converts a selection array (which may hold composite option values, or
// the special "All" sentinel) into a deduped list of real codes for use in
// SQL IN-clauses and API payloads.
const codesFromSelection = (values: string[]): string[] => {
    if (!values.length || values.includes("All")) return ["All"];
    const codes = new Set<string>();
    values.forEach((v) => codes.add(codeFromOptionValue(v)));
    return Array.from(codes);
};

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

// Validates that each age bucket cutoff is a positive number and strictly
// greater than the previous bucket's cutoff. Returns a map of field -> error message.
const AGE_KEYS: AgeKey[] = ["age1", "age2", "age3", "age4", "age5"];

const validateAgeBuckets = (p: Params): Partial<Record<AgeKey, string>> => {
    const errors: Partial<Record<AgeKey, string>> = {};
    const values = AGE_KEYS.map((k) => Number(p[k]));

    values.forEach((val, i) => {
        if (p[AGE_KEYS[i]].trim() === "" || !Number.isFinite(val) || val <= 0) {
            errors[AGE_KEYS[i]] = "Enter a positive number";
            return;
        }
        if (i > 0 && Number.isFinite(values[i - 1]) && val <= values[i - 1]) {
            errors[AGE_KEYS[i]] = `Must be greater than Bucket ${i} Cutoff (${values[i - 1]})`;
        }
    });

    return errors;
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

const numberInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 12,
    boxSizing: "border-box",
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

// ─── AgeRangeField ────────────────────────────────────────────────────────────

const AgeRangeField: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
}> = ({ label, value, onChange, error }) => (
    <div style={{ marginBottom: 10 }}>
        <label style={fieldLabelStyle}>{label}</label>
        <input
            type="number"
            min={1}
            style={{
                ...numberInputStyle,
                borderColor: error ? "#dc2626" : "#d1d5db",
                outline: error ? "1px solid #fca5a5" : "none",
            }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
        {error && (
            <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2, lineHeight: 1.3 }}>
                {error}
            </div>
        )}
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_PARAMS: Params = {
    prin_code: ["All"], dept_code: ["All"], prod_code: ["All"],
    age1: "30", age2: "60", age3: "90", age4: "120", age5: "150",
    group_by: "product_group",
};

export default function StockAgeingQuantityReport() {
    // ── State
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string>("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

    const reportWindowRef = useRef<Window | null>(null);

    // ── Parameter options
    const [prinOptions, setPrinOptions] = useState<Option[]>([]);
    const [prodOptions, setProdOptions] = useState<Option[]>([]);
    const [deptOptions, setDeptOptions] = useState<Option[]>([]);
    const [optLoading, setOptLoading] = useState(false);
    const [optError, setOptError] = useState<string>("");

    // ── Parameter values
    const [params, setParams] = useState<Params>(DEFAULT_PARAMS);

    const optionsRequestRef = useRef(0);

    // ── Age bucket validation ────────────────────────────────────────────────
    const ageErrors = useMemo(() => validateAgeBuckets(params), [
        params.age1, params.age2, params.age3, params.age4, params.age5,
    ]);
    const hasAgeErrors = Object.keys(ageErrors).length > 0;

    // ── Cross-filtered option loader ─────────────────────────────────────────
    const loadCascadedOptions = useCallback(async (p: Params) => {
        const requestId = ++optionsRequestRef.current;
        setOptLoading(true);
        setOptError("");

        const prinFilter = inClause("prin_code", codesFromSelection(p.prin_code));
        const deptFilter = inClause("dept_code", p.dept_code);

        const whereExcept = (...exclude: string[]): string => {
            const all = { prin: prinFilter, dept: deptFilter };
            const clauses = Object.entries(all)
                .filter(([key]) => !exclude.includes(key))
                .map(([, clause]) => clause)
                .filter(Boolean);
            return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
        };

        const sql = {
            prin: `select distinct prin_code, prin_name from VW_BOWM_STKLED_FOREXPAGEING ${whereExcept("prin")}`,
            prod: `select distinct prod_code, prod_name from VW_BOWM_STKLED_FOREXPAGEING`,
            dept: `select distinct dept_code from VW_BOWM_STKLED_FOREXPAGEING ${whereExcept("dept")}`,
        };

        try {
            const [prinRows, prodRows, deptRows] = await Promise.all([
                executeWmsInboundSql(sql.prin),
                executeWmsInboundSql(sql.prod),
                executeWmsInboundSql(sql.dept),
            ]);

            if (requestId !== optionsRequestRef.current) return;

            const nextPrin = mapCodeNameOptions(prinRows, "prin_code", "prin_name");
            const nextProd = mapCodeNameOptions(prodRows, "prod_code", "prod_name");
            const nextDept = mapSingleColumnOptions(deptRows, "dept_code");

            setPrinOptions(nextPrin);
            setProdOptions(nextProd);
            setDeptOptions(nextDept);

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

                return {
                    ...prev,
                    prin_code: reset(prev.prin_code, nextPrin),
                    prod_code: reset(prev.prod_code, nextProd),
                    dept_code: reset(prev.dept_code, nextDept),
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

    // ── Re-run the cascade live when Principal/Department change
    const cascadeKey = JSON.stringify([params.prin_code, params.dept_code]);
    const prevCascadeKeyRef = useRef(cascadeKey);
    useEffect(() => {
        if (prevCascadeKeyRef.current === cascadeKey) return;
        prevCascadeKeyRef.current = cascadeKey;
        loadCascadedOptions(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cascadeKey]);

    const buildPayload = (p: Params) => ({
        prin_code: codesFromSelection(p.prin_code),
        dept_code: p.dept_code.includes("All") ? ["All"] : p.dept_code,
        prod_code: codesFromSelection(p.prod_code),
        age1: Number(p.age1) || 30,
        age2: Number(p.age2) || 60,
        age3: Number(p.age3) || 90,
        age4: Number(p.age4) || 120,
        age5: Number(p.age5) || 150,
        group_by: p.group_by || "product_group",
    });

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
            "<title>Stock Ageing (Quantity) Report</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>"
        );

        try {
            const res = await api.post(
                "/api/wms/reports/stockageing/quantity/html",
                buildPayload(p),
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
                "<title>Stock Ageing (Quantity) Report</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>"
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
                "/api/wms/reports/stockageing/quantity/excel",
                buildPayload(params),
                { responseType: "blob" },
            );
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = `stock_ageing_quantity_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
        if (hasAgeErrors) {
            setError("Please fix the age bucket cutoffs before generating the report.");
            return;
        }
        fetchReport(params);
    };

    const setParam = <K extends keyof Params>(key: K, val: Params[K]) =>
        setParams((prev) => ({ ...prev, [key]: val }));

    const handleReset = () => {
        setParams(DEFAULT_PARAMS);
        setHasGeneratedReport(false);
        setError("");
        setLastGeneratedAt(null);
    };

    const groupByOptions: Option[] = [
        { value: "product_group", label: "Stock Ageing (Quantity) Detail" },
        { value: "principal", label: "Stock Ageing (Quantity) Summary" },
    ];

    const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
    const BG = "#EFF6FF";
    const THEME = "#1d4ed8";

    return (
        <div style={{ background: "#f3f4f6", padding: "6px 10px", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
            <style>{`
                .action-btn-primary:hover { background: #1e3a8a !important; }
                .action-btn-excel:hover { background: #EFF6FF !important; border-color: ${THEME} !important; color: ${THEME} !important; }
                .field-row { background: #EFF6FF; border-radius: 8px; padding: 10px 12px; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "8px 12px" }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Clock size={17} color={THEME} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Stock Ageing (Quantity) Report</span>
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

                            {/* Principal + Product Code + Department Code */}
                            <div className="field-row" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 6, width: "100%" }}>
                                <FloatLabel label="Principal" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={prinOptions}
                                        value={params.prin_code}
                                        onChange={(v: string[]) => setParam("prin_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Product Code" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={prodOptions}
                                        value={params.prod_code}
                                        onChange={(v: string[]) => setParam("prod_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Department Code" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={deptOptions}
                                        value={params.dept_code}
                                        onChange={(v: string[]) => setParam("dept_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                            </div>

                            {/* Group By */}
                            <div className="field-row" style={row2}>
                                <FloatLabel label="Group By" bgColor={BG}>
                                    <SelectField
                                        label=""
                                        options={groupByOptions}
                                        value={params.group_by}
                                        onChange={(v) => setParam("group_by", v || "product_group")}
                                        placeholder="Select grouping"
                                    />
                                </FloatLabel>
                            </div>

                            {/* Age Bucket Boundaries */}
                            <div className="field-row">
                                <fieldset style={{ border: "0.5px solid #BFDBFE", borderRadius: 6, padding: "6px 12px 10px", margin: 0, background: "transparent" }}>
                                    <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                                        Age Bucket Boundaries (days)
                                    </legend>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0 10px" }}>
                                        <AgeRangeField label="Bucket 1 Cutoff" value={params.age1} onChange={(v) => setParam("age1", v)} error={ageErrors.age1} />
                                        <AgeRangeField label="Bucket 2 Cutoff" value={params.age2} onChange={(v) => setParam("age2", v)} error={ageErrors.age2} />
                                        <AgeRangeField label="Bucket 3 Cutoff" value={params.age3} onChange={(v) => setParam("age3", v)} error={ageErrors.age3} />
                                        <AgeRangeField label="Bucket 4 Cutoff" value={params.age4} onChange={(v) => setParam("age4", v)} error={ageErrors.age4} />
                                        <AgeRangeField label="Bucket 5 Cutoff" value={params.age5} onChange={(v) => setParam("age5", v)} error={ageErrors.age5} />
                                    </div>
                                    <div style={{ fontSize: 10, color: hasAgeErrors ? "#dc2626" : "#6b7280", marginTop: 2 }}>
                                        {hasAgeErrors
                                            ? "Each bucket cutoff must be a positive number greater than the previous bucket's cutoff."
                                            : `Produces buckets: Below ${params.age1 || 30}, ${params.age1 || 30}-${params.age2 || 60}, ${params.age2 || 60}-${params.age3 || 90}, ${params.age3 || 90}-${params.age4 || 120}, ${params.age4 || 120}-${params.age5 || 150}, Above ${params.age5 || 150}`}
                                    </div>
                                </fieldset>
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
                                    background: THEME,
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
                            disabled={loading || hasAgeErrors}
                            title={hasAgeErrors ? "Fix age bucket cutoffs before generating the report" : undefined}
                            style={{
                                padding: "7px 16px",
                                border: `0.5px solid ${THEME}`,
                                background: (loading || hasAgeErrors) ? "#94a3b8" : THEME,
                                cursor: (loading || hasAgeErrors) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#fff",
                                transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                if (!loading && !hasAgeErrors) e.currentTarget.style.background = "#1e3a8a";
                            }}
                            onMouseLeave={(e) => {
                                if (!loading && !hasAgeErrors) e.currentTarget.style.background = THEME;
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