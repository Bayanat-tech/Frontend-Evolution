// PoOrderRegister.tsx
"use client";

import React, { useState, useRef, useCallback } from "react";
import { Printer, RotateCcw, FileText, Download, Eye } from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { LookupField } from "../../../components/ui/LookupField";
// import LookupField from "../../../components/LookupField"; // adjust path if different
// import {
//     getPoOrderRegisterReportHtml,
//     getPoOrderRegisterReportExcel,
// } from "../../../api/transactions"; // TODO: confirm actual export names/location

interface PoOrderRegisterParams {
    parameter: string;
    loginid: string;
    company_code: string;
    fromdate: string;
    todate: string;
    ac_code: string;
    po_number: string;
    prod_code: string;
    [key: string]: any;
}

const text = (v: any) => (v === null || v === undefined ? "" : String(v));

// ─── Shared styles (same as PLSummaryPage) ─────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 12,
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 7,
    background: "#fff",
    color: "#111827",
    boxSizing: "border-box",
    outline: "none",
};

function FloatLabel({ label, required, children, bgColor = "#fff" }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    bgColor?: string;
}) {
    return (
        <div style={{ position: "relative", marginTop: 6 }}>
            <span style={{
                position: "absolute", top: -8, left: 10, fontSize: 11, color: "#6b7280",
                background: bgColor, padding: "0 4px", zIndex: 1, textTransform: "uppercase",
                letterSpacing: "0.05em", fontWeight: 500,
            }}>
                {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
            </span>
            {children}
        </div>
    );
}

const DateField: React.FC<{
    value: string; onChange: (v: string) => void; max?: string; min?: string;
}> = ({ value, onChange, max, min }) => (
    <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        style={{ ...inputStyle, color: value ? "#111827" : "#9ca3af", cursor: "pointer" }}
    />
);

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PoOrderRegisterPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId = user?.loginid ?? user?.username ?? "ADMIN";

    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
    const reportWindowRef = useRef<Window | null>(null);

    const [fromDateIso, setFromDateIso] = useState("");
    const [toDateIso, setToDateIso] = useState("");

    // Supplier (A/c code)
    const [acCode, setAcCode] = useState("");
    const [acName, setAcName] = useState("");

    // PO Number (manual)
    const [poNumber, setPoNumber] = useState("");

    // Product
    const [prodCode, setProdCode] = useState("");
    const [prodName, setProdName] = useState("");

    const lastRequestRef = useRef<PoOrderRegisterParams | null>(null);

    const dateRangeValid = !fromDateIso || !toDateIso || fromDateIso <= toDateIso;

    const buildRequestParams = (): PoOrderRegisterParams => ({
        parameter: "PO_ORDER_REGISTER_REPORT", // TODO: confirm actual procedure parameter name
        loginid: loginId,
        company_code: companyCode,
        fromdate: fromDateIso || "All",
        todate: toDateIso || "All",
        ac_code: acCode || "All",
        po_number: poNumber || "All",
        prod_code: prodCode || "All",
    });

    const fetchReport = useCallback(async (params: PoOrderRegisterParams) => {
        setLoading(true);
        setError("");
        lastRequestRef.current = params;

        const newTab = window.open("", "_blank");
        if (!newTab) {
            setLoading(false);
            setError("Your browser blocked the new tab. Please allow pop-ups for this site and try again.");
            return;
        }
        newTab.document.write("<title>PO Order Register</title><body style='font-family:sans-serif;padding:40px;color:#6b7280;'>Loading report…</body>");

        // try {
        //     const html = await getPoOrderRegisterReportHtml(params);
        //     newTab.document.open();
        //     newTab.document.write(html);
        //     newTab.document.close();
        //     reportWindowRef.current = newTab;
        //     setHasGeneratedReport(true);
        //     setLastGeneratedAt(new Date());
        // } catch (err: any) {
        //     newTab.document.open();
        //     newTab.document.write("<title>PO Order Register</title><body style='font-family:sans-serif;padding:40px;color:#dc2626;'>Failed to load report. Please close this tab and try again.</body>");
        //     newTab.document.close();
        //     setError(err?.message ?? "Failed to load report. Please try again.");
        // } finally {
        //     setLoading(false);
        // }
    }, []);

    const handleGenerateReport = () => {
        if (!dateRangeValid) return;
        fetchReport(buildRequestParams());
    };

    const handleReset = () => {
        setFromDateIso(""); setToDateIso("");
        setAcCode(""); setAcName("");
        setPoNumber("");
        setProdCode(""); setProdName("");
        setError(""); setHasGeneratedReport(false); setLastGeneratedAt(null);
    };

    const handlePrint = () => {
        if (reportWindowRef.current && !reportWindowRef.current.closed) {
            reportWindowRef.current.focus();
            reportWindowRef.current.print();
        } else {
            setError("No open report tab to print. Generate the report again.");
        }
    };

    const handleExcel = async () => {
        if (!lastRequestRef.current) {
            setError("Generate the report at least once before exporting to Excel.");
            return;
        }
        setExporting(true);
        try {
           // await getPoOrderRegisterReportExcel(lastRequestRef.current);
        } catch (err) {
            console.error("Excel export error:", err);
            alert("Excel export failed. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    const BG = "#EEF5FD";
    return (
        <div style={{ background: "#f3f4f6", padding: "33px 10px", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
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
                        <FileText size={17} color="#185FA5" />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>PO Order Register</span>
                        {hasGeneratedReport && (
                            <span style={{ fontSize: 10, background: "#d1fae5", color: "#065f46", padding: "2px 10px", borderRadius: 12, fontWeight: 500 }}>
                                Report Generated
                            </span>
                        )}
                    </div>

                    {error && (
                        <div style={{ marginBottom: 10, padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>⚠️</span>{error}
                            <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626" }}>✕</button>
                        </div>
                    )}

                    {!dateRangeValid && (
                        <div style={{ marginBottom: 10, padding: "8px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, color: "#92400e", fontSize: 12 }}>
                            From date must be on or before To date.
                        </div>
                    )}

                    {/* ── Filter fields ── */}
                    <div className="field-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                        <FloatLabel label="Date From" bgColor={BG}>
                            <DateField value={fromDateIso} onChange={setFromDateIso} max={toDateIso || undefined} />
                        </FloatLabel>
                        <FloatLabel label="Date To" bgColor={BG}>
                            <DateField value={toDateIso} onChange={setToDateIso} min={fromDateIso || undefined} />
                        </FloatLabel>

                        {/* Supplier — LookupField using Account_AC_CODE_Serach_HDR */}
                        <LookupField
                            label="Supplier"
                            value={acCode}
                            displayValue={acName ? `${acCode} - ${acName}` : acCode}
                            columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "address", header: "Address" }, { field: "tel", header: "Tel" }, { field: "fax", header: "Fax" }]}
                            valueField="ac_code"
                            displayFields={["ac_code", "ac_name"]}
                            loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_HDR", code1: companyCode, loginid: loginId })}
                            disabled={false}
                            onChange={(value: string, row: any) => {
                                setAcCode(value);
                                setAcName(text(getLookupValue(row || {}, "ac_name")));
                            }}
                        />

                        {/* PO Number — manual entry */}
                        <FloatLabel label="PO Number" bgColor={BG}>
                            <input
                                type="text"
                                value={poNumber}
                                onChange={(e) => setPoNumber(e.target.value)}
                                //placeholder="All"
                                style={inputStyle}
                            />
                        </FloatLabel>

                        {/* Product — LookupField using PS_POORDER_ENTRY_PRODUCT_LIST */}
                        <LookupField
                            label="Product Code"
                            value={prodCode}
                            displayValue={prodName ? `${prodCode} - ${prodName}` : prodCode}
                            columns={[{ field: "prod_code", header: "Code" }, { field: "prod_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                            valueField="prod_code"
                            displayFields={["prod_code", "prod_name"]}
                            loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_PRODUCT_LIST", code1: companyCode, loginid: loginId })}
                            disabled={false}
                            onChange={(value: string, row: any) => {
                                setProdCode(value);
                                setProdName(text(getLookupValue(row || {}, "prod_name")));
                            }}
                        />
                    </div>

                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, marginLeft: 4 }}>
                        Leave a field on "All" to include every value for that filter.
                    </div>

                    {/* Status bar */}
                    {hasGeneratedReport && (
                        <div style={{ marginTop: 10, padding: "8px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 16 }}>✅</span>
                                <span style={{ fontSize: 12, color: "#065f46" }}>Report generated successfully at {lastGeneratedAt?.toLocaleTimeString()}</span>
                            </div>
                            <button
                                onClick={() => {
                                    if (reportWindowRef.current && !reportWindowRef.current.closed) reportWindowRef.current.focus();
                                    else setError("Report tab is closed. Please generate again.");
                                }}
                                style={{ padding: "4px 12px", background: "#185FA5", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                                <Eye size={12} /> Open Report
                            </button>
                        </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid #e5e7eb" }}>
                        <button className="action-btn-excel" onClick={handleReset} disabled={loading}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: loading ? 0.6 : 1 }}>
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button className="action-btn-excel" onClick={handlePrint} disabled={!hasGeneratedReport || loading}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: (!hasGeneratedReport || loading) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: (!hasGeneratedReport || loading) ? 0.5 : 1 }}>
                            <Printer size={13} /> Print
                        </button>
                        <button className="action-btn-excel" onClick={handleExcel} disabled={!hasGeneratedReport || loading || exporting}
                            style={{ padding: "7px 16px", border: "0.5px solid #d1d5db", background: "#fff", cursor: (!hasGeneratedReport || loading || exporting) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#374151", opacity: (!hasGeneratedReport || loading || exporting) ? 0.5 : 1 }}>
                            <Download size={13} /> {exporting ? "Exporting..." : "Export Excel"}
                        </button>
                        <button className="action-btn-primary" onClick={handleGenerateReport} disabled={loading || !dateRangeValid}
                            style={{ padding: "7px 16px", border: "0.5px solid #185FA5", background: (loading || !dateRangeValid) ? "#94a3b8" : "#185FA5", cursor: (loading || !dateRangeValid) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6, color: "#fff", transition: "background 0.2s" }}>
                            {loading ? (
                                <>
                                    <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                    Generating...
                                </>
                            ) : (
                                <><Eye size={13} /> View Report</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}