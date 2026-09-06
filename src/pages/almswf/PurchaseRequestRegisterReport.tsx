import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Printer,
    RotateCcw,
    BarChart2,
    Download,
    Eye,
} from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { almsCommonSelect } from "../../api/alms";
import { Select } from "../../components/ui/Select";
import { exportPRPurchaseSummaryExcel, getPRRegisterReportHtml } from "../../api/transactions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Option {
    value: string;
    label: string;
}

interface Params {
    division: string;
    status: string;
}

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

export default function PurchaseRequestRegisterReport() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginid = user?.loginid ?? "";

    // ── State
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string>("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

    const reportWindowRef = useRef<Window | null>(null);

    // ── Parameter options
    const [divisionOptions, setDivisionOptions] = useState<Option[]>([]);
    const [statusOptions, setStatusOptions] = useState<Option[]>([]);
    const [optLoading, setOptLoading] = useState(false);
    const [optError, setOptError] = useState<string>("");

    // ── Parameter values
    const [params, setParams] = useState<Params>({
        division: "ALL",
        status: "ALL",
    });

    const optionsLoadedRef = useRef(false);

    // ── Load options ──────────────────────────────────────────────────────────
    const loadOptions = useCallback(async () => {
        // FIX (issue #1): flag set BEFORE the awaits, not after — stops the
        // double-mount race that fired division+status twice each.
        if (optionsLoadedRef.current) return;
        optionsLoadedRef.current = true;

        setOptLoading(true);
        setOptError("");

        try {
            const divisionResult = await almsCommonSelect({
                parameter: "PS_PREQUEST_ENTRY_DIVISION",
                loginid,
                code1: companyCode,
                code2: "",
                code3: "",
                code4: "",
            });

            const statusResult = await almsCommonSelect({
                parameter: "PS_PREQUEST_ENTRY_STATUS_LIST",
                loginid,
                code1: companyCode,
                code2: "",
                code3: "",
                code4: "",
            });

            const divisions: Option[] = [
                { value: "ALL", label: "All Divisions" },
                ...(divisionResult || []).map((row: Record<string, unknown>) => ({
                    value: String(row.DIV_CODE || ""),
                    label: String(row.DIV_NAME || ""),
                })),
            ];

            let statuses: Option[] = [];
            if (statusResult && statusResult.length > 0) {
                statuses = (statusResult || []).map((row: Record<string, unknown>) => ({
                    value: String(row.STATUS_CODE || ""),
                    label: String(row.STATUS_NAME || ""),
                }));
            } else {
                const STATUS_LABELS: Record<string, string> = {
                    SAVEASDRAFT: "Draft",
                    SUBMITTED: "Submitted",
                    APPROVED: "Approved",
                    REJECTED: "Rejected",
                    SENDBACK: "Sent Back",
                    CANCELED: "Canceled",
                };
                statuses = [
                    { value: "ALL", label: "All" },
                    ...Object.entries(STATUS_LABELS).map(([code, label]) => ({
                        value: code,
                        label,
                    })),
                ];
            }

            setDivisionOptions(divisions);
            setStatusOptions(statuses);

        } catch (e: any) {
            console.error("Failed to load options", e);
            setOptError(e?.message ?? "Failed to load filter options");
            optionsLoadedRef.current = false; // allow retry on genuine failure
        } finally {
            setOptLoading(false);
        }
    }, [companyCode, loginid]);

    useEffect(() => {
        loadOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Fetch the report HTML ─────────────────────────────────────────────────────
    // FIX (issue #2): window.open() must fire synchronously on the click, before
    // any await — otherwise the browser drops the "trusted user gesture" and
    // silently blocks the popup, which is why Print/Open Report were failing.
    const fetchReport = useCallback(async (p: Params) => {
        setLoading(true);
        setError("");

        const newTab = window.open("", "_blank");
        if (!newTab) {
            setLoading(false);
            setError("Your browser blocked the new tab. Please allow pop-ups for this site and try again.");
            return;
        }
        newTab.document.write("<title>Purchase Request Register</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>");

        try {
            const html = await getPRRegisterReportHtml({
                parameter: "PS_PREQUEST_ENTRY_SUMMARY_REPORT",
                loginid: loginid,
                code1: companyCode,
                code2: p.division,
                code3: p.status,
                code4: "",
            });

            newTab.document.open();
            newTab.document.write(html);
            newTab.document.close();
            reportWindowRef.current = newTab;

            setHasGeneratedReport(true);
            setLastGeneratedAt(new Date());

        } catch (e: any) {
            newTab.document.open();
            newTab.document.write("<title>Purchase Request Register</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>");
            newTab.document.close();
            setError(e?.message ?? "Failed to load report. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [companyCode, loginid]);

    // ── Print ──────────────────────────────────────────────────────────────────
    const handlePrint = () => {
        if (reportWindowRef.current && !reportWindowRef.current.closed) {
            reportWindowRef.current.focus();
            reportWindowRef.current.print();
        } else {
            setError("No open report tab to print. Generate the report again.");
        }
    };

    // ── Excel export ───────────────────────────────────────────────────────────
    const handleExcel = async () => {
        setExporting(true);
        try {
            await exportPRPurchaseSummaryExcel({
                parameter: "PS_PREQUEST_ENTRY_SUMMARY_REPORT",
                loginid: loginid,
                code1: companyCode,
                code2: params.division,
                code3: params.status,
                code4: "",
            });
        } catch (e: any) {
            alert("Excel export failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    // ── Generate report ───────────────────────────────────────────────────────
    const handleGenerateReport = () => {
        fetchReport(params);
    };

    const setParam = <K extends keyof Params>(key: K, val: Params[K]) =>
        setParams((prev) => ({ ...prev, [key]: val }));

    const handleReset = () => {
        setParams({
            division: "ALL",
            status: "ALL",
        });
        setHasGeneratedReport(false);
        setError("");
        setLastGeneratedAt(null);
        if (reportWindowRef.current && !reportWindowRef.current.closed) {
            reportWindowRef.current.close();
        }
        reportWindowRef.current = null;
    };

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
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Purchase Request Register Report</span>
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

                            {/* Division + Status */}
                            <div className="field-row" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 6, width: "100%" }}>
                                <FloatLabel label="Division" bgColor={BG}>
                                    <SelectField
                                        label=""
                                        options={divisionOptions}
                                        value={params.division}
                                        onChange={(v) => setParam("division", v)}
                                        placeholder="Select Division"
                                        loading={optLoading}
                                    />
                                </FloatLabel>
                                <FloatLabel label="Status" bgColor={BG}>
                                    <SelectField
                                        label=""
                                        options={statusOptions}
                                        value={params.status}
                                        onChange={(v) => setParam("status", v)}
                                        placeholder="Select Status"
                                        loading={optLoading}
                                    />
                                </FloatLabel>
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