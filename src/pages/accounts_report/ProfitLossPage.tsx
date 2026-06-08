"use client";

import React, { Component, useState } from "react";
import { BarChart2, RotateCcw, Printer } from "lucide-react";
import dayjs from "dayjs";

import { useAuth } from "../../state/AuthContext";
import { Division } from "../../api/transactions";
import { LookupField } from "../../components/ui/LookupField";
import { getDynamicLookup, getDynamicLookupaccount } from "../../api/lookups";
import { buildPrintHTML, ReportValues } from "./Profitlossreport";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PnlOption = "period" | "month" | "monthwise";

interface PnlRow {
    h_code: string;
    h_name: string;
    pl_code: string;
    pl_name: string;
    lcur_amount: number;
    s_order: number;
}

// ─── Error boundary ────────────────────────────────────────────────────────────

class ReportErrorBoundary extends Component<
    { children: React.ReactNode },
    { hasError: boolean; message: string }
> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, message: "" };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, message: error?.message ?? "Unknown error" };
    }
    render() {
        if (this.state.hasError)
            return (
                <div style={{
                    padding: "10px 14px", background: "#fef2f2",
                    border: "0.5px solid #fca5a5", borderRadius: 6,
                    fontSize: 12, color: "#b91c1c",
                    display: "flex", flexDirection: "column" as const, gap: 4,
                }}>
                    <span>⚠ Report failed to render.</span>
                    <span style={{ fontSize: 11, color: "#9b1c1c" }}>{this.state.message}</span>
                </div>
            );
        return this.props.children;
    }
}

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

// ─── Main Component ─────────────────────────────────────────────────────────────

const ProfitLossPage: React.FC = () => {
    const { user } = useAuth();

    const [option, setOption] = useState<PnlOption>("period");
    const [division, setDivision] = useState<Division[]>([]);
    const [dateFrom, setDateFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
    const [dateTo, setDateTo] = useState(dayjs().format("YYYY-MM-DD"));
    const [reportError, setReportError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);

    const formatDate = (date: string) => {
        if (!date) return "";
        const d = new Date(date);
        return [
            String(d.getDate()).padStart(2, "0"),
            String(d.getMonth() + 1).padStart(2, "0"),
            d.getFullYear(),
        ].join("/");
    };

    const reportValues: ReportValues = {
        company_code: user?.company_code ?? "",
        option,
        division: division[0]?.div_code || "All",
        date_from: dateFrom,
        date_to: dateTo,
    };

    const handleReset = () => {
        setOption("period");
        setDivision([]);
        setDateFrom(dayjs().startOf("month").format("YYYY-MM-DD"));
        setDateTo(dayjs().format("YYYY-MM-DD"));
        setReportError(null);
        setGenerating(false);
    };

    /**
     * Fetches P&L data, builds the full HTML string, and opens it
     * in a new popup window. The popup contains its own Print button
     * so only the report is printed — not the parent page.
     */
    const handleGenerate = async () => {
        // ── Validation ──────────────────────────────────────────────────────
        if (!division[0]?.div_code) {
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
            // ── Fetch data ───────────────────────────────────────────────────
            const response = await getDynamicLookupaccount({
                parameter: "Account_Report_PROFIT_AND_LOSS_VW_PROFIT_AND_LOSS",
                loginid: user?.loginid ?? user?.username ?? "ADMIN",
                code1: reportValues.company_code,
                code2: reportValues.division,
                code3: reportValues.date_from,
                code4: reportValues.date_to,
            });

            const data: PnlRow[] = Array.isArray(response)
                ? (response as unknown as PnlRow[])
                : [];

            if (!data.length) {
                setReportError("No data found for the selected criteria.");
                return;
            }

            // ── Build HTML & open popup ──────────────────────────────────────
            const html = buildPrintHTML(data, reportValues);

            const popup = window.open(
                "",
                "PnLReport",
                "width=960,height=760,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no"
            );

            if (!popup) {
                setReportError(
                    "Popup was blocked by your browser. Please allow popups for this site and try again."
                );
                return;
            }

            popup.document.open();
            popup.document.write(html);
            popup.document.close();
            popup.focus();

        } catch (err: any) {
            setReportError(
                err?.message ?? "An unexpected error occurred while generating the report."
            );
        } finally {
            setGenerating(false);
        }
    };

    const optionRows: { value: PnlOption; label: string }[] = [
        { value: "period", label: "P&L for the period" },
        { value: "month", label: "P&L for the month" },
        { value: "monthwise", label: "P&L month wise" },
    ];

    const summaryRows: [string, string][] = [
        ["Report type", option === "period" ? "Period" : option === "month" ? "Month" : "Month wise"],
        ["Division", division[0]?.div_code || "All"],
        ["From", formatDate(dateFrom) || "—"],
        ["To", formatDate(dateTo) || "—"],
    ];

    return (
        <div style={{ background: "#f3f4f6", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
            <style>{`
                .action-btn:hover          { background: #f9fafb !important; }
                .action-btn-primary:hover  { background: #0C447C !important; border-color: #0C447C !important; }
                .pnl-radio-row             { display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer; }
                .pnl-radio-row input[type="radio"] { accent-color: #185FA5; }
                .pnl-radio-row span        { font-size:12px; color:#374151; }
            `}</style>

            <div style={{ maxWidth: 900, margin: "0 auto" }}>

                {/* ── Filter card ── */}
                <div style={{
                    background: "#fff", border: "0.5px solid #e5e7eb",
                    borderRadius: 12, padding: "20px 24px",
                }}>

                    {/* Title */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                        <BarChart2 size={18} color="#185FA5" />
                        <span style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
                            Profit &amp; Loss Filter
                        </span>
                    </div>

                    {/* 3-col grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 200px", gap: 24 }}>

                        {/* Col 1 — Option */}
                        <div>
                            <div style={fieldLabelStyle}>Option</div>
                            {optionRows.map(({ value, label }) => (
                                <label key={value} className="pnl-radio-row">
                                    <input
                                        type="radio"
                                        name="pnlOption"
                                        value={value}
                                        checked={option === value}
                                        onChange={() => setOption(value)}
                                    />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </div>

                        {/* Col 2 — Division + Dates */}
                        <div style={{ borderLeft: "0.5px solid #e5e7eb", paddingLeft: 24 }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={fieldLabelStyle}>Division</div>
                                <LookupField
                                    label="Division *"
                                    value={division[0]?.div_code || ""}
                                    displayValue={division[0]?.div_name || ""}
                                    columns={[
                                        { field: "div_code", header: "Code" },
                                        { field: "div_name", header: "Name" },
                                    ]}
                                    valueField="div_code"
                                    displayFields={["div_code", "div_name"]}
                                    loadOptions={() =>
                                        getDynamicLookup({
                                            parameter: "Account_division",
                                            code1: user?.company_code,
                                            loginid: user?.loginid || user?.username || "ADMIN",
                                        })
                                    }
                                    onChange={(val: any) => {
                                        setDivision([{ div_code: val, div_name: "" }]);
                                    }}
                                />
                            </div>

                            <div style={fieldLabelStyle}>Date range</div>
                            <div style={{
                                display: "grid", gridTemplateColumns: "36px 1fr",
                                alignItems: "center", gap: "8px 8px",
                            }}>
                                <span style={{ fontSize: 12, color: "#6b7280" }}>From</span>
                                <input
                                    type="date"
                                    style={inputStyle}
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                                <span style={{ fontSize: 12, color: "#6b7280" }}>To</span>
                                <input
                                    type="date"
                                    style={inputStyle}
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Col 3 — Summary */}
                        <div style={{ borderLeft: "0.5px solid #e5e7eb", paddingLeft: 24 }}>
                            <div style={fieldLabelStyle}>Summary</div>
                            <div style={{
                                background: "#f9fafb", border: "0.5px solid #e5e7eb",
                                borderRadius: 8, padding: "12px 14px",
                                fontSize: 12, color: "#374151", lineHeight: 2,
                            }}>
                                {summaryRows.map(([k, v]) => (
                                    <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span style={{ color: "#6b7280" }}>{k}</span>
                                        <span style={{ fontWeight: 500 }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Error banner */}
                    {reportError && (
                        <div style={{
                            marginTop: 14, padding: "8px 14px",
                            background: "#fef2f2", border: "0.5px solid #fca5a5",
                            borderRadius: 6, fontSize: 12, color: "#b91c1c",
                            display: "flex", alignItems: "center", gap: 8,
                        }}>
                            <span>⚠</span> {reportError}
                        </div>
                    )}

                    {/* Action bar */}
                    <div style={{
                        display: "flex", justifyContent: "flex-end", gap: 8,
                        marginTop: 20, paddingTop: 14, borderTop: "0.5px solid #e5e7eb",
                    }}>
                        <button
                            className="action-btn"
                            onClick={handleReset}
                            disabled={generating}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #d1d5db",
                                background: "#fff", cursor: "pointer", display: "flex",
                                alignItems: "center", gap: 6, fontSize: 12, borderRadius: 6,
                                color: "#374151", opacity: generating ? 0.6 : 1,
                            }}
                        >
                            <RotateCcw size={13} /> Reset
                        </button>

                        <div style={{ width: "0.5px", background: "#e5e7eb", alignSelf: "stretch" }} />

                        <button
                            className="action-btn-primary"
                            onClick={handleGenerate}
                            disabled={generating}
                            style={{
                                padding: "7px 16px", border: "0.5px solid #185FA5",
                                background: "#185FA5", cursor: generating ? "wait" : "pointer",
                                display: "flex", alignItems: "center", gap: 6,
                                fontSize: 12, borderRadius: 6, color: "#fff",
                                opacity: generating ? 0.7 : 1,
                            }}
                        >
                            <Printer size={13} />
                            {generating ? "Generating…" : "Generate Report"}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ProfitLossPage;