"use client";

import { useState } from "react";
import { FileText, BarChart2, Loader2 } from "lucide-react";

import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { LookupField } from "../../../components/ui/LookupField";
import { Division, openBalanceSheetReport } from "../../../api/transactions";

export default function BalanceSheetReportFilter() {
    const { user } = useAuth();

    const [division, setDivision] = useState<Division[]>([]);
    const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);

    const [generating, setGenerating] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const formatDate = (date: string) => {
        if (!date) return null;
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const fieldLabelStyle: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 500,
        color: "#6b7280",
        marginBottom: 5,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        fontSize: 12,
        padding: "6px 9px",
        border: "0.5px solid #d1d5db",
        borderRadius: 6,
        background: "#fff",
        color: "#111827",
    };

    const handleGenerate = async () => {
        if (!division[0]?.div_code) {
            setReportError("Please select a Division before generating.");
            return;
        }
        if (!asOnDate) {
            setReportError("Please select an As On date.");
            return;
        }

        setReportError(null);
        setGenerating(true);

        const params = {
            parameter: "Account_Balance_Sheet",
            loginid: user?.loginid || user?.username || "ADMIN",
            code1: user?.company_code || "",
            code2: division[0]?.div_code || "",
            code3: "All",
            code4: "All",
            code5: String(formatDate(asOnDate)),
            code20: "RAWSQL",
        };

        try {
            await openBalanceSheetReport(params);
        } catch (err: any) {
            console.error("Balance Sheet Report error:", err);
            setReportError(err.message || "Failed to generate Balance Sheet report.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
                .action-btn-primary:disabled { background: #93c5fd !important; border-color: #93c5fd !important; cursor: not-allowed !important; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 600, margin: "0 auto" }}>
                <div style={{
                    background: "#fff",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "20px 24px",
                }}>
                    {/* ── page title ── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                        <BarChart2 size={18} color="#185FA5" />
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>Balance Sheet report</span>
                    </div>

                    {/* ── filters ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
                        <div>
                            <div style={{ ...fieldLabelStyle, marginBottom: 6 }}>Division</div>
                            <LookupField
                                label="Division *"
                                value={division[0]?.div_code || ""}
                                displayValue={division[0]?.div_name || ""}
                                columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
                                valueField="div_code"
                                displayFields={["div_code", "div_name"]}
                                loadOptions={() => getDynamicLookup({
                                    parameter: "Account_division",
                                    code1: user?.company_code,
                                    loginid: user?.loginid || user?.username || "ADMIN",
                                })}
                                onChange={(val) => {
                                    setDivision([{ div_code: val, div_name: "" }]);
                                }}
                            />
                        </div>

                        <div>
                            <div style={fieldLabelStyle}>As on date</div>
                            <input
                                type="date"
                                style={inputStyle}
                                value={asOnDate}
                                onChange={(e) => setAsOnDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* ── error banner ── */}
                    {reportError && (
                        <div style={{
                            marginTop: 12,
                            padding: "8px 14px",
                            background: "#fef2f2",
                            border: "0.5px solid #fca5a5",
                            borderRadius: 6,
                            fontSize: 12,
                            color: "#b91c1c",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}>
                            <span>⚠</span> {reportError}
                        </div>
                    )}

                    {/* ── action bar ── */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "0.5px solid #e5e7eb" }}>
                        <button
                            className="action-btn-primary"
                            disabled={generating}
                            onClick={handleGenerate}
                            style={{
                                padding: "7px 16px",
                                border: "0.5px solid #185FA5",
                                background: "#185FA5",
                                cursor: generating ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                borderRadius: 6,
                                color: "#fff",
                                opacity: generating ? 0.75 : 1,
                            }}
                        >
                            {generating
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</>
                                : <><FileText size={13} /> Generate report</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}