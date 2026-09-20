import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "../../../api/client";
import { executeWmsInboundSql } from "../../../api/wms";
import { openWmsReport } from "../../../components/wms/reports/wmsReportPreviewStore";
import { NewReportPage } from "../../../components/new_report_format/NewReportPage";
import type { ReportFieldConfig, ReportOption } from "../../../components/new_report_format/types";
// ─── Types ────────────────────────────────────────────────────────────────────

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
// with different names. Use codeFromOptionValue/codesFromSelection below to
// recover the actual code(s) whenever building a SQL filter or API payload.
const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): ReportOption[] => {
    const seen = new Set<string>();
    const options: ReportOption[] = [];
    rows.forEach((r) => {
        const code = getField(r, codeKey);
        const name = getField(r, nameKey);
        if (!code) return;
        const value = `${code}::${name}`;
        if (seen.has(value)) return;
        seen.add(value);
        options.push({ value, label: name ? `${code} - ${name}` : code });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
};

const codeFromOptionValue = (v: string): string => v.split("::")[0];

const codesFromSelection = (values: string[]): string[] => {
    if (!values.length || values.includes("All")) return ["All"];
    const codes = new Set<string>();
    values.forEach((v) => codes.add(codeFromOptionValue(v)));
    return Array.from(codes);
};

const mapSingleColumnOptions = (rows: LookupRow[], codeKey: string): ReportOption[] =>
    rows
        .map((r) => getField(r, codeKey))
        .filter((v) => !!v)
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v }));

const sqlEscape = (v: string): string => v.replace(/'/g, "''");

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

// ─── Age bucket field (bespoke to this report, rendered as children) ──────────

const numberInputClass =
    "h-8 w-full rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm";

const AgeRangeField: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    disabled?: boolean;
}> = ({ label, value, onChange, error, disabled }) => (
    <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
        <input
            type="number"
            min={1}
            disabled={disabled}
            className={`${numberInputClass} ${error ? "border-red-400" : ""}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
        {error && <div className="text-[10px] leading-snug text-red-600 normal-case">{error}</div>}
    </label>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_PARAMS: Params = {
    prin_code: ["All"], dept_code: ["All"], prod_code: ["All"],
    age1: "30", age2: "60", age3: "90", age4: "120", age5: "150",
    group_by: "product_group",
};

export default function StockAgeingQuantityReport() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);

    const [prinOptions, setPrinOptions] = useState<ReportOption[]>([]);
    const [prodOptions, setProdOptions] = useState<ReportOption[]>([]);
    const [deptOptions, setDeptOptions] = useState<ReportOption[]>([]);
    const [optLoading, setOptLoading] = useState(false);
    const [optError, setOptError] = useState<string>("");

    const [params, setParams] = useState<Params>(DEFAULT_PARAMS);

    const optionsRequestRef = useRef(0);

    const ageErrors = useMemo(() => validateAgeBuckets(params), [
        params.age1, params.age2, params.age3, params.age4, params.age5,
    ]);
    const hasAgeErrors = Object.keys(ageErrors).length > 0;

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
                const reset = (current: string[], validOptions: ReportOption[]): string[] => {
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

    useEffect(() => {
        loadCascadedOptions(params);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const groupByOptions: ReportOption[] = [
        { value: "product_group", label: "Stock Ageing (Quantity) Detail" },
        { value: "principal", label: "Stock Ageing (Quantity) Summary" },
    ];

    const handleGenerateReport = async () => {
        if (hasAgeErrors) {
            setError("Please fix the age bucket cutoffs before generating the report.");
            return;
        }
        setLoading(true);
        setError("");
        const preview = openWmsReport("Stock Ageing (Quantity) Report");
        const payload = buildPayload(params);

        try {
            const res = await api.post(
                "/api/wms/reports/stockageing/quantity/html",
                payload,
                { responseType: "text" },
            );
            preview.ready({
                html: res.data,
                filename: `stock_ageing_quantity_report_${new Date().toISOString().slice(0, 10)}`,
                orientation: "landscape",
                excelEndpoint: "/api/wms/reports/stockageing/quantity/excel",
                excelPayload: payload,
            });
            setHasGeneratedReport(true);
        } catch (e: any) {
            const failure = e?.response?.data?.message ?? "Failed to load report. Please try again.";
            setError(failure);
            preview.fail(failure);
        } finally {
            setLoading(false);
        }
    };

    const setParam = (key: string, val: any) =>
        setParams((prev) => ({ ...prev, [key]: val }));

    const handleReset = () => {
        setParams(DEFAULT_PARAMS);
        setHasGeneratedReport(false);
        setError("");
        setOptError("");
    };

    const fields: ReportFieldConfig[] = [
        {
            key: "prin_code",
            label: "Principal",
            type: "multiselect",
            options: prinOptions,
            loading: optLoading,
        },
        {
            key: "prod_code",
            label: "Product Code",
            type: "multiselect",
            options: prodOptions,
            loading: optLoading,
        },
        {
            key: "dept_code",
            label: "Department Code",
            type: "multiselect",
            options: deptOptions,
            loading: optLoading,
        },
        {
            key: "group_by",
            label: "Group By",
            type: "select",
            options: groupByOptions,
            loading: optLoading,
            placeholder: groupByOptions[0].label,
        },
    ];

    return (
        <NewReportPage
            title="Stock Ageing (Quantity) Report"
            fields={fields}
            values={params}
            onChange={setParam}
            onClearAll={handleReset}
            onGenerate={handleGenerateReport}
            loading={loading}
            optionsLoading={optLoading}
            error={error || optError || null}
            onClearError={() => {
                setError("");
                setOptError("");
            }}
            fieldsPerRow={4}
        >
            {/* Age bucket boundaries — bespoke to this report, no matching NewReportPage field type */}
            <div style={{ marginTop: 8 }}>
                <fieldset className="rounded-md border p-3">
                    <legend className="px-1 text-[11px] font-semibold uppercase text-muted-foreground">
                        Age Bucket Boundaries (days)
                    </legend>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <AgeRangeField label="Bucket 1 Cutoff" value={params.age1} onChange={(v) => setParam("age1", v)} error={ageErrors.age1} disabled={loading} />
                        <AgeRangeField label="Bucket 2 Cutoff" value={params.age2} onChange={(v) => setParam("age2", v)} error={ageErrors.age2} disabled={loading} />
                        <AgeRangeField label="Bucket 3 Cutoff" value={params.age3} onChange={(v) => setParam("age3", v)} error={ageErrors.age3} disabled={loading} />
                        <AgeRangeField label="Bucket 4 Cutoff" value={params.age4} onChange={(v) => setParam("age4", v)} error={ageErrors.age4} disabled={loading} />
                        <AgeRangeField label="Bucket 5 Cutoff" value={params.age5} onChange={(v) => setParam("age5", v)} error={ageErrors.age5} disabled={loading} />
                    </div>
                    <div className={`mt-2 text-[10px] ${hasAgeErrors ? "text-red-600" : "text-muted-foreground"}`}>
                        {hasAgeErrors
                            ? "Each bucket cutoff must be a positive number greater than the previous bucket's cutoff."
                            : `Produces buckets: Below ${params.age1 || 30}, ${params.age1 || 30}-${params.age2 || 60}, ${params.age2 || 60}-${params.age3 || 90}, ${params.age3 || 90}-${params.age4 || 120}, ${params.age4 || 120}-${params.age5 || 150}, Above ${params.age5 || 150}`}
                    </div>
                </fieldset>
            </div>

            {hasAgeErrors && !error && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
                    Fix the age bucket cutoffs before generating the report.
                </div>
            )}

            {hasGeneratedReport && (
                <div style={{ marginTop: 8 }}>
                    <span
                        style={{
                            fontSize: 12,
                            color: "#065f46",
                            background: "#d1fae5",
                            padding: "3px 10px",
                            borderRadius: 12,
                            fontWeight: 500,
                        }}
                    >
                        Report generated successfully
                    </span>
                </div>
            )}
        </NewReportPage>
    );
}