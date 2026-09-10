import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    BarChart2,
} from "lucide-react";
import { openWmsReport } from "../../../components/wms/reports/wmsReportPreviewStore";
import { api } from "../../../api/client";
import { executeWmsInboundSql } from "../../../api/wms";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { Button } from "../../../components/ui/Button";
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
    prod_code: string[];
    site_code: string[];
    location_code: string[];
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

export default function StockSummaryReport() {
    // ── State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

    // ── Parameter options
    const [prinOptions, setPrinOptions] = useState<Option[]>([]);
    const [prodOptions, setProdOptions] = useState<Option[]>([]);
    const [siteOptions, setSiteOptions] = useState<Option[]>([]);
    const [locationOptions, setLocationOptions] = useState<Option[]>([]);
    const [optLoading, setOptLoading] = useState(false);
    const [optError, setOptError] = useState<string>("");

    // ── Parameter values (no job_no — summary does not filter by job)
    const [params, setParams] = useState<Params>({
        prin_code: ["All"],
        prod_code: ["All"],
        site_code: ["All"],
        location_code: ["All"],
        group_by: "",
    });

    const optionsRequestRef = useRef(0);

    // ── Cross-filtered option loader ─────────────────────────────────────────
    const loadCascadedOptions = useCallback(async (p: Params) => {
        const requestId = ++optionsRequestRef.current;
        setOptLoading(true);
        setOptError("");

        const prinFilter = inClause("PRIN_CODE", codesFromSelection(p.prin_code));
        const prodFilter = inClause("PROD_CODE", codesFromSelection(p.prod_code));
        const siteFilter = inClause("SITE_CODE", p.site_code);

        const whereExcept = (...exclude: string[]): string => {
            const all = { prin: prinFilter, prod: prodFilter, site: siteFilter };
            const clauses = Object.entries(all)
                .filter(([key]) => !exclude.includes(key))
                .map(([, clause]) => clause)
                .filter(Boolean);
            return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
        };

        const sql = {
            prin: `select distinct prin_code, prin_name from VW_BOWM_STK_LEDGER ${whereExcept("prin")}`,
            prod: `select distinct PROD_CODE, PROD_NAME from VW_BOWM_STK_LEDGER ${whereExcept("prod")}`,
            site: `select distinct site_code from VW_BOWM_STK_LEDGER ${whereExcept("site")}`,
            location: `select distinct location_code from VW_BOWM_STK_LEDGER ${whereExcept()}`,
        };

        try {
            const [prinRows, prodRows, siteRows, locRows] = await Promise.all([
                executeWmsInboundSql(sql.prin),
                executeWmsInboundSql(sql.prod),
                executeWmsInboundSql(sql.site),
                executeWmsInboundSql(sql.location),
            ]);

            if (requestId !== optionsRequestRef.current) return;

            const nextPrin = mapCodeNameOptions(prinRows, "prin_code", "prin_name");
            const nextProd = mapCodeNameOptions(prodRows, "prod_code", "prod_name");
            const nextSite = mapSingleColumnOptions(siteRows, "site_code");
            const nextLocation = mapSingleColumnOptions(locRows, "location_code");

            setPrinOptions(nextPrin);
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

                const siteIsSpecific = prev.site_code.length > 0 && !prev.site_code.includes("All");

                let nextLocationCode = reset(prev.location_code, nextLocation);

                if (siteIsSpecific && nextLocation.length > 0 && nextLocationCode.includes("All")) {
                    // Auto-fill the location code once a specific site is selected
                    nextLocationCode = [nextLocation[0].value];
                } else if (!siteIsSpecific) {
                    nextLocationCode = ["All"];
                }

                return {
                    ...prev,
                    prin_code: reset(prev.prin_code, nextPrin),
                    prod_code: reset(prev.prod_code, nextProd),
                    site_code: reset(prev.site_code, nextSite),
                    location_code: nextLocationCode,
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

    // ── Re-run the cascade live when Principal/Product/Site change
    const cascadeKey = JSON.stringify([params.prin_code, params.prod_code, params.site_code]);
    const prevCascadeKeyRef = useRef(cascadeKey);
    useEffect(() => {
        if (prevCascadeKeyRef.current === cascadeKey) return;
        prevCascadeKeyRef.current = cascadeKey;
        loadCascadedOptions(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cascadeKey]);

    // ── Fetch the report HTML and publish it to the shared WMS preview
    const fetchReport = useCallback(async (p: Params) => {
        setLoading(true);
        setError("");
        const preview = openWmsReport("Stock Summary Report");

        try {
            const res = await api.post(
                "/api/wms/reports/stocksummary/html",
                {
                    prin_code: codesFromSelection(p.prin_code),
                    prod_code: codesFromSelection(p.prod_code),
                    site_code: p.site_code.includes("All") ? ["All"] : p.site_code,
                    location_code: p.location_code.includes("All") ? ["All"] : p.location_code,
                    group_by: p.group_by || null,
                },
                { responseType: "text" },
            );
            preview.ready({
                html: res.data,
                filename: "stock_summary_report",
                excelEndpoint: "/api/wms/reports/stocksummary/excel",
                excelPayload: {
                    prin_code: codesFromSelection(p.prin_code),
                    prod_code: codesFromSelection(p.prod_code),
                    site_code: p.site_code.includes("All") ? ["All"] : p.site_code,
                    location_code: p.location_code.includes("All") ? ["All"] : p.location_code,
                    group_by: p.group_by || null,
                },
            });
        } catch (e: any) {
            const message = e?.response?.data?.message ?? "Failed to load report. Please try again.";
            preview.fail(message);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Generate report
    // NOTE: Principal is now a multi-select with an "All" default (same as
    // Product/Site), so it's always populated and no longer needs a
    // "must pick one" guard before generating.
    const handleGenerateReport = () => {
        fetchReport(params);
    };

    const setParam = <K extends keyof Params>(key: K, val: Params[K]) =>
        setParams((prev) => ({ ...prev, [key]: val }));

    const handleReset = () => {
        setParams({
            prin_code: ["All"],
            prod_code: ["All"],
            site_code: ["All"],
            location_code: ["All"],
            group_by: "",
        });
        setError("");
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
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Stock Summary Report</span>
                    </div>

                    <ReportFilterHeader onClear={handleReset} label="Stock Summary Filters" />

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

                            {/* Principal + Product */}
                            <div className="field-row" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 6, width: "100%" }}>
                                <FloatLabel label="Principal" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={prinOptions}
                                        value={params.prin_code}
                                        onChange={(v: string[]) => setParam("prin_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Product" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={prodOptions}
                                        value={params.prod_code}
                                        onChange={(v) => setParam("prod_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                            </div>

                            {/* Site + Location Code (side by side; location auto-fills once a site is chosen) */}
                            <div className="field-row" style={row2}>
                                <FloatLabel label="Site" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={siteOptions}
                                        value={params.site_code}
                                        onChange={(v) => setParam("site_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Location Code" bgColor={BG}>
                                    <MultiSelectField
                                        label=""
                                        options={locationOptions}
                                        value={params.location_code}
                                        onChange={(v: string[]) => setParam("location_code", v)}
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                            </div>

                            {/* Group By */}
                            <div className="field-row" style={row2}>
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
                                <div />
                            </div>
                        </div>
                    </div>

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <Button
                            className="action-btn-primary"
                            size="sm"
                            onClick={handleGenerateReport}
                            disabled={loading}
                        >
                            {loading ? "Generating..." : "Generate Report"}
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
}