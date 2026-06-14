"use client";

import React, { useState, useEffect } from "react";
import { BarChart2, RotateCcw, Printer, Loader2 } from "lucide-react";

import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup } from "../../api/lookups";
import { openProfitLossReport } from "../../api/transactions";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PnlOption = "period" | "month" | "monthwise";

// ─── Date helpers ───────────────────────────────────────────────────────────────

const getStartOfMonth = (): string => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
};

const getToday = (): string => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const formatDisplay = (iso: string): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
};

// ─── Shared styles ──────────────────────────────────────────────────────────────

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
    boxSizing: "border-box",
};

const radioLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    cursor: "pointer",
    color: "#374151",
};

// ─── Parameter map ──────────────────────────────────────────────────────────────

const PARAMETER_MAP: Record<PnlOption, string> = {
    period:    "Account_Report_VW_PROFIT_AND_LOSS",
    month:     "",
    monthwise: "",
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function ProfitLossPage() {
    const { user } = useAuth();
    const companyCode = user?.company_code ?? "";
    const loginId     = user?.loginid ?? user?.username ?? "ADMIN";

    // ── Division ────────────────────────────────────────────────────────────────
    const [divisionList,         setDivisionList]         = useState<any[]>([]);
    const [division,             setDivision]             = useState("");
    const [divisionDisplay,      setDivisionDisplay]      = useState("");
    const [divisionSearch,       setDivisionSearch]       = useState("");
    const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);

    // ── Filter state ────────────────────────────────────────────────────────────
    const [option]      = useState<PnlOption>("period");
    const [dateFrom,    setDateFrom]    = useState(getStartOfMonth());
    const [dateTo,      setDateTo]      = useState(getToday());
    const [reportError, setReportError] = useState<string | null>(null);
    const [generating,  setGenerating]  = useState(false);

    // ── Fetch divisions ─────────────────────────────────────────────────────────
    useEffect(() => {
        getDynamicLookup({
            parameter: "Account_division",
            loginid: loginId,
            code1: companyCode,
            code2: "", code3: "", code4: "",
            number1: 0, number2: 0, number3: 0, number4: 0,
            date1: null, date2: null, date3: null, date4: null,
        })
            .then((res) => setDivisionList(res || []))
            .catch(console.error);
    }, []);

    const filteredDivisions = divisionList.filter((d: any) =>
        `${d.div_code} ${d.div_name}`.toLowerCase().includes(divisionSearch.toLowerCase())
    );

    // ── Reset ───────────────────────────────────────────────────────────────────
    const handleReset = () => {
        setDivision("");
        setDivisionDisplay("");
        setDivisionSearch("");
        setDateFrom(getStartOfMonth());
        setDateTo(getToday());
        setReportError(null);
        setGenerating(false);
    };

    // ── Generate ────────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!division) {
            setReportError("Please select a Division before generating.");
            return;
        }
        if (!dateFrom || !dateTo) {
            setReportError("Please select both From and To dates.");
            return;
        }

        setReportError(null);
        setGenerating(true);

        try {
            await openProfitLossReport({
                parameter: PARAMETER_MAP[option],
                loginid:   loginId,
                code1:     companyCode,
                code2:     division,
                code3:     dateFrom,
                code4:     dateTo,
            });
        } catch (err: any) {
            setReportError(err?.message ?? "Failed to generate report. Please try again.");
            console.error(err);
        } finally {
            setGenerating(false);
        }
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif", minHeight: "100%" }}>
            <style>{`
                .action-btn:hover         { background: #f9fafb !important; }
                .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
                .div-option:hover         { background: #f0f7ff; }
                @keyframes spin           { to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* ══ Card 1 — Filters ══════════════════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>

                    {/* Card title */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                        <BarChart2 size={18} color="#185FA5" />
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
                            Profit &amp; Loss Filter
                        </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>

                        {/* ── Col 1: Division → Date Range ── */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 260, flex: "1 1 260px" }}>

                            {/* Division searchable dropdown */}
                            <div style={{ position: "relative" }}>
                                <div style={fieldLabelStyle}>Division</div>
                                <input
                                    type="text"
                                    placeholder="Search division..."
                                    value={divisionSearch !== "" ? divisionSearch : divisionDisplay}
                                    onChange={(e) => { setDivisionSearch(e.target.value); setShowDivisionDropdown(true); }}
                                    onFocus={() => setShowDivisionDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDivisionDropdown(false), 150)}
                                    style={inputStyle}
                                />
                                {showDivisionDropdown && filteredDivisions.length > 0 && (
                                    <div style={{
                                        position: "absolute", zIndex: 100, top: "calc(100% + 2px)", left: 0, right: 0,
                                        background: "#fff", border: "0.5px solid #d1d5db", borderRadius: 6,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto",
                                    }}>
                                        {filteredDivisions.map((d: any) => (
                                            <div
                                                key={d.div_code}
                                                className="div-option"
                                                style={{ padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
                                                onMouseDown={() => {
                                                    setDivision(d.div_code);
                                                    setDivisionDisplay(`${d.div_code} - ${d.div_name}`);
                                                    setDivisionSearch("");
                                                    setShowDivisionDropdown(false);
                                                    setReportError(null);
                                                }}
                                            >
                                                <span style={{ fontWeight: 500 }}>{d.div_code}</span>
                                                <span style={{ color: "#6b7280", marginLeft: 6 }}>{d.div_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Date Range — From and To side by side in one line ── */}
                            <fieldset style={{ border: "0.5px solid #d1d5db", borderRadius: 6, padding: "6px 12px 12px", margin: 0 }}>
                                <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Date Range
                                </legend>
                                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                                    {/* From */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ ...fieldLabelStyle, marginBottom: 3 }}>From</div>
                                        <input
                                            type="date"
                                            value={dateFrom}
                                            max={dateTo || undefined}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            style={inputStyle}
                                        />
                                    </div>
                                    {/* To */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ ...fieldLabelStyle, marginBottom: 3 }}>To</div>
                                        <input
                                            type="date"
                                            value={dateTo}
                                            min={dateFrom || undefined}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            </fieldset>
                        </div>

                        {/* ── Col 2: Report Option — only "period" shown, others hidden ── */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 200, flex: "1 1 200px" }}>
                            <fieldset style={{ border: "0.5px solid #d1d5db", borderRadius: 6, padding: "6px 12px 12px", margin: 0 }}>
                                <legend style={{ fontSize: 10, color: "#6b7280", padding: "0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Report Option
                                </legend>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>

                                    {/* Only "period" visible */}
                                    <label style={{ ...radioLabelStyle, cursor: "default" }}>
                                        <input
                                            type="radio"
                                            name="pnlOption"
                                            value="period"
                                            checked
                                            readOnly
                                            style={{ accentColor: "#185FA5" }}
                                        />
                                        P&amp;L for the period
                                    </label>

                                    {/* Hidden — preserved for future use */}
                                    <label style={{ display: "none" }}>
                                        <input type="radio" name="pnlOption" value="month" readOnly />
                                        P&amp;L for the month
                                    </label>
                                    <label style={{ display: "none" }}>
                                        <input type="radio" name="pnlOption" value="monthwise" readOnly />
                                        P&amp;L month wise
                                    </label>

                                </div>
                            </fieldset>
                        </div>

                    </div>

                    {/* Error banner */}
                    {reportError && (
                        <div style={{
                            marginTop: 12, fontSize: 12, color: "#dc2626",
                            background: "#fef2f2", border: "0.5px solid #fecaca",
                            borderRadius: 6, padding: "6px 12px",
                        }}>
                            ⚠ {reportError}
                        </div>
                    )}
                </div>

                {/* ══ Card 2 — Summary + Action bar ════════════════════════════════ */}
                <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px" }}>

                    <div style={{ marginBottom: 16 }}>
                        <div style={fieldLabelStyle}>Report Summary</div>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: "12px 24px",
                            background: "#f9fafb",
                            border: "0.5px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "14px 16px",
                            marginTop: 8,
                        }}>
                            {[
                                ["Report Type", "P&L for the Period"],
                                ["Division",    divisionDisplay || "—"],
                                ["From",        formatDisplay(dateFrom) || "—"],
                                ["To",          formatDisplay(dateTo)   || "—"],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                                        {k}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action bar */}
                    <div style={{
                        display: "flex", justifyContent: "flex-end", gap: 8,
                        paddingTop: 14, borderTop: "0.5px solid #e5e7eb",
                    }}>
                        <button
                            className="action-btn"
                            onClick={handleReset}
                            disabled={generating}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #d1d5db",
                                background: "#fff", cursor: generating ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                                fontSize: 12, borderRadius: 6, color: "#374151",
                                opacity: generating ? 0.6 : 1,
                            }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>

                        <button
                            className="action-btn-primary"
                            onClick={handleGenerate}
                            disabled={generating}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #185FA5",
                                background: "#185FA5", cursor: generating ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                                fontSize: 12, borderRadius: 6, color: "#fff",
                                opacity: generating ? 0.7 : 1,
                            }}
                        >
                            {generating
                                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                                : <><Printer size={13} /> Generate Report</>
                            }
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}