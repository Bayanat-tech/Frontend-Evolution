import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Boxes, Filter, Layers, Layers3, Loader2, Search, UserRound } from "lucide-react";
import { api } from "../../../api/client";
import { executeWmsInboundSql } from "../../../api/wms";
import { Select } from "../../../components/ui/Select";
import { MultiSelectField } from "../../../components/ui/MultiSelectField";
import { Button } from "../../../components/ui/Button";
import { ReportFilterHeader } from "../../../components/reports/ReportFilterHeader";
import { openWmsReport } from "../../../components/wms/reports/wmsReportPreviewStore";

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
const mapCodeNameOptions = (rows: LookupRow[], codeKey: string, nameKey: string): Option[] => {
    const seen = new Set<string>();
    const options: Option[] = [];
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

const mapSingleColumnOptions = (rows: LookupRow[], codeKey: string): Option[] =>
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

const summaryText = (values: string[], options: Option[]): string => {
    if (!values.length || values.includes("All")) return "All";
    const map = new Map(options.map((o) => [o.value, o.label]));
    const labels = values.map((v) => map.get(v) || v);
    return labels.length ? labels.join(", ") : "All";
};

// ─── Small presentational helpers (mirroring the Freight report layout) ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="grid gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
            {label}
            {children}
        </label>
    );
}

function SummaryBadge({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className={`rounded-md border px-3 py-1.5 ${strong ? "border-primary/20 bg-primary/10 text-primary" : "bg-muted/40 text-foreground"}`}>
            <div className="text-[9px] font-semibold uppercase text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold">{value}</div>
        </div>
    );
}

function SummaryStripItem({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon size={16} />
            </span>
            <div className="min-w-0 leading-tight">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-primary/70">{label}</div>
                <div className="truncate text-[13px] font-semibold text-slate-800" title={value}>
                    {value}
                </div>
            </div>
        </div>
    );
}

const numberInputClass =
    "h-8 w-full rounded-md border bg-background px-2 text-sm font-medium text-foreground shadow-sm";

const AgeRangeField: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
}> = ({ label, value, onChange, error }) => (
    <Field label={label}>
        <input
            type="number"
            min={1}
            className={`${numberInputClass} ${error ? "border-red-400" : ""}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
        {error && <div className="text-[10px] leading-snug text-red-600">{error}</div>}
    </Field>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_PARAMS: Params = {
    prin_code: ["All"], dept_code: ["All"], prod_code: ["All"],
    age1: "30", age2: "60", age3: "90", age4: "120", age5: "150",
    group_by: "product_group",
};

export default function StockAgeingVolumeReport() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const [message, setMessage] = useState("Select filters and generate the report.");

    const [prinOptions, setPrinOptions] = useState<Option[]>([]);
    const [prodOptions, setProdOptions] = useState<Option[]>([]);
    const [deptOptions, setDeptOptions] = useState<Option[]>([]);
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
            prin: `select distinct prin_code, prin_name from VW_BOWM_STKLED_FOREXPAGEING ${whereExcept()}`,
            prod: `select distinct prod_code, prod_name from VW_BOWM_STKLED_FOREXPAGEING ${whereExcept()}`,
            dept: `select distinct dept_code from VW_BOWM_STKLED_FOREXPAGEING ${whereExcept()}`,
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
                const reset = (current: string[], validOptions: Option[]): string[] => {
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

    const groupByOptions: Option[] = [
        { value: "product_group", label: "Stock Ageing (Volume) Detail" },
        { value: "principal", label: "Stock Ageing (Volume) Summary" },
    ];

    const handleGenerateReport = async () => {
        if (hasAgeErrors) {
            setError("Please fix the age bucket cutoffs before generating the report.");
            return;
        }
        setLoading(true);
        setError("");
        setMessage("");
        const preview = openWmsReport("Stock Ageing (Volume) Report");
        const payload = buildPayload(params);

        try {
            const res = await api.post(
                "/api/wms/reports/stockageing/volume/html",
                payload,
                { responseType: "text" },
            );
            preview.ready({
                html: res.data,
                filename: `stock_ageing_volume_report_${new Date().toISOString().slice(0, 10)}`,
                orientation: "landscape",
                excelEndpoint: "/api/wms/reports/stockageing/volume/excel",
                excelPayload: payload,
            });
            setHasGeneratedReport(true);
            setMessage("Report generated successfully.");
        } catch (e: any) {
            const failure = e?.response?.data?.message ?? "Failed to load report. Please try again.";
            setError(failure);
            setMessage(failure);
            preview.fail(failure);
        } finally {
            setLoading(false);
        }
    };

    const setParam = <K extends keyof Params>(key: K, val: Params[K]) =>
        setParams((prev) => ({ ...prev, [key]: val }));

    const handleReset = () => {
        setParams(DEFAULT_PARAMS);
        setHasGeneratedReport(false);
        setError("");
        setMessage("Select filters and generate the report.");
    };

    return (
        <section className="stock-ageing-report-screen">
            <div className="rounded-xl border bg-white shadow-sm">

                {/* Title bar */}
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                    <Layers size={17} color="#185FA5" />
                    <h1 className="text-sm font-semibold text-slate-900">Stock Ageing (Volume) Report</h1>
                    <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#cbd5e1" }} aria-hidden="true" />
                    {hasGeneratedReport && <SummaryBadge label="Status" value="Generated" strong />}
                </div>

                {(error || optError) && (
                    <div className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-600">
                        <span>⚠️</span>
                        <span>{error || optError}</span>
                        {error && (
                            <button onClick={() => setError("")} className="ml-auto text-red-600">
                                ✕
                            </button>
                        )}
                    </div>
                )}

                <ReportFilterHeader onClear={handleReset} />

                {/* Summary strip */}
                <div className="grid grid-cols-2 gap-2 border-b bg-muted/10 p-3 md:grid-cols-4">
                    <SummaryStripItem icon={UserRound} label="Principal" value={summaryText(params.prin_code, prinOptions)} />
                    <SummaryStripItem icon={Boxes} label="Product" value={summaryText(params.prod_code, prodOptions)} />
                    <SummaryStripItem icon={Filter} label="Department" value={summaryText(params.dept_code, deptOptions)} />
                    <SummaryStripItem
                        icon={Layers3}
                        label="Group By"
                        value={groupByOptions.find((g) => g.value === params.group_by)?.label || "Detail"}
                    />
                </div>

                {/* Fields */}
                <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
                    <MultiSelectField
                        label="Principal"
                        options={prinOptions}
                        value={params.prin_code}
                        onChange={(v: string[]) => setParam("prin_code", v)}
                        loading={optLoading}
                    />
                    <MultiSelectField
                        label="Product Code"
                        options={prodOptions}
                        value={params.prod_code}
                        onChange={(v: string[]) => setParam("prod_code", v)}
                        loading={optLoading}
                    />
                    <MultiSelectField
                        label="Department Code"
                        options={deptOptions}
                        value={params.dept_code}
                        onChange={(v: string[]) => setParam("dept_code", v)}
                        loading={optLoading}
                    />
                    <Field label="Group By">
                        <Select
                            value={params.group_by}
                            onChange={(e) => setParam("group_by", e.target.value || "product_group")}
                            disabled={optLoading}
                            style={{ fontSize: 12 }}
                        >
                            {groupByOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>

                {/* Age bucket boundaries — bespoke to this report, no Freight equivalent */}
                <div className="border-t bg-muted/10 p-3">
                    <fieldset className="rounded-md border p-3">
                        <legend className="px-1 text-[11px] font-semibold uppercase text-muted-foreground">
                            Age Bucket Boundaries (days)
                        </legend>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                            <AgeRangeField label="Bucket 1 Cutoff" value={params.age1} onChange={(v) => setParam("age1", v)} error={ageErrors.age1} />
                            <AgeRangeField label="Bucket 2 Cutoff" value={params.age2} onChange={(v) => setParam("age2", v)} error={ageErrors.age2} />
                            <AgeRangeField label="Bucket 3 Cutoff" value={params.age3} onChange={(v) => setParam("age3", v)} error={ageErrors.age3} />
                            <AgeRangeField label="Bucket 4 Cutoff" value={params.age4} onChange={(v) => setParam("age4", v)} error={ageErrors.age4} />
                            <AgeRangeField label="Bucket 5 Cutoff" value={params.age5} onChange={(v) => setParam("age5", v)} error={ageErrors.age5} />
                        </div>
                        <div className={`mt-2 text-[10px] ${hasAgeErrors ? "text-red-600" : "text-muted-foreground"}`}>
                            {hasAgeErrors
                                ? "Each bucket cutoff must be a positive number greater than the previous bucket's cutoff."
                                : `Produces buckets: Below ${params.age1 || 30}, ${params.age1 || 30}-${params.age2 || 60}, ${params.age2 || 60}-${params.age3 || 90}, ${params.age3 || 90}-${params.age4 || 120}, ${params.age4 || 120}-${params.age5 || 150}, Above ${params.age5 || 150}`}
                        </div>
                    </fieldset>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 border-t px-3 py-3">
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleGenerateReport}
                        disabled={loading || hasAgeErrors}
                        title={hasAgeErrors ? "Fix age bucket cutoffs before generating the report" : undefined}
                    >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Generate Report
                    </Button>
                </div>
                {message ? <p className="px-3 pb-3 text-sm text-muted-foreground">{message}</p> : null}
            </div>
        </section>
    );
}