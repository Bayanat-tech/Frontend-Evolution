"use client";

import React from "react";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookupaccount } from "../../api/lookups";

// ─── Types ─────────────────────────────────────────────

interface PnlRow {
    h_code: string;
    h_name: string;
    pl_code: string;
    pl_name: string;
    lcur_amount: number;
    s_order: number;
}

interface GroupedHeader {
    h_code: string;
    h_name: string;
    s_order: number;
    rows: PnlRow[];
    total: number;
}

export interface ReportValues {
    company_code: string;
    option: "period" | "month" | "monthwise";
    division: string;
    date_from: string;
    date_to: string;
}

interface Props {
    required_values: ReportValues;
}

// ─── Helpers ─────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(n));

const amountStr = (n: number) => (n < 0 ? `(${fmt(n)})` : fmt(n));

const groupByHeader = (rows: PnlRow[]): GroupedHeader[] => {
    const map = new Map<string, GroupedHeader>();

    for (const row of rows) {
        if (!map.has(row.h_code)) {
            map.set(row.h_code, {
                h_code: row.h_code,
                h_name: row.h_name ?? row.h_code,
                s_order: row.s_order,
                rows: [],
                total: 0,
            });
        }

        const grp = map.get(row.h_code)!;
        grp.rows.push(row);
        grp.total += row.lcur_amount ?? 0;
    }

    return Array.from(map.values()).sort((a, b) =>
        a.s_order !== b.s_order
            ? a.s_order - b.s_order
            : a.h_code.localeCompare(b.h_code)
    );
};

// ─── Build the full HTML string for the popup print window ───────────────────

export const buildPrintHTML = (
    data: PnlRow[],
    required_values: ReportValues
): string => {
    const groups = groupByHeader(data);

    const income = groups.filter((g) => g.s_order === 1);
    const expense = groups.filter((g) => g.s_order === 2);

    const totalIncome = income.reduce((s, g) => s + g.total, 0);
    const totalExpense = expense.reduce((s, g) => s + g.total, 0);
    const net = totalIncome - totalExpense;

    const renderGroup = (g: GroupedHeader) => `
        <tr class="group-row">
            <td colspan="3">${g.h_name}</td>
        </tr>
        ${g.rows
            .map(
                (r) => `
            <tr>
                <td>${r.pl_code}</td>
                <td>${r.pl_name}</td>
                <td class="amount">${amountStr(r.lcur_amount)}</td>
            </tr>`
            )
            .join("")}
        <tr class="subtotal">
            <td colspan="2">Total ${g.h_name}</td>
            <td class="amount">${amountStr(g.total)}</td>
        </tr>`;

    const incomeSection =
        income.length > 0
            ? `
        <h3>INCOME</h3>
        <table>
            <thead>
                <tr><th>Code</th><th>Description</th><th class="amount">Amount</th></tr>
            </thead>
            <tbody>
                ${income.map(renderGroup).join("")}
            </tbody>
        </table>
        <p class="total-line">TOTAL INCOME: ${amountStr(totalIncome)}</p>`
            : "";

    const expenseSection =
        expense.length > 0
            ? `
        <h3>EXPENSES</h3>
        <table>
            <thead>
                <tr><th>Code</th><th>Description</th><th class="amount">Amount</th></tr>
            </thead>
            <tbody>
                ${expense.map(renderGroup).join("")}
            </tbody>
        </table>
        <p class="total-line">TOTAL EXPENSES: ${amountStr(totalExpense)}</p>`
            : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Profit &amp; Loss Statement</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #000;
            padding: 20px;
        }

        /* ── Print button — hidden on actual print ── */
        .print-bar {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-bottom: 14px;
        }

        .print-bar button {
            padding: 7px 16px;
            font-size: 12px;
            cursor: pointer;
            border-radius: 6px;
        }

        .btn-print {
            background: #185FA5;
            color: #fff;
            border: 1px solid #185FA5;
        }

        .btn-close {
            background: #fff;
            color: #374151;
            border: 1px solid #d1d5db;
        }

        .btn-print:hover { background: #0C447C; }
        .btn-close:hover  { background: #f3f4f6; }

        /* ── Report header ── */
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        .header h2 { font-size: 16px; margin-bottom: 4px; }
        .header p  { font-size: 12px; color: #374151; }

        /* ── Section headings ── */
        h3 {
            margin-top: 20px;
            font-size: 13px;
            border-bottom: 1px solid #000;
            padding-bottom: 4px;
        }

        /* ── Tables ── */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            page-break-inside: auto;
        }
        tr { page-break-inside: avoid; page-break-after: auto; }
        th, td {
            border: 1px solid #000;
            padding: 6px;
            font-size: 11px;
        }
        th { background: #f2f2f2; }
        td.amount, th.amount { text-align: right; }

        .group-row td { font-weight: bold; background: #fafafa; }
        .subtotal td  { font-weight: bold; background: #f5f5f5; }
        .subtotal td.amount { text-align: right; }

        /* ── Totals & net ── */
        .total-line {
            text-align: right;
            font-weight: bold;
            margin-top: 8px;
        }

        .net {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #000;
            font-weight: bold;
            text-align: right;
            font-size: 13px;
        }

        /* ── Print media ── */
        @page { size: A4; margin: 15mm; }

        @media print {
            .print-bar { display: none !important; }
            body { padding: 0; }
            .net { border: 2px solid #000; }
        }
    </style>
</head>
<body>

    <!-- Print / Close buttons -->
    <div class="print-bar">
        <button class="btn-close" onclick="window.close()">✕ Close</button>
        <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <!-- Header -->
    <div class="header">
        <h2>PROFIT &amp; LOSS STATEMENT</h2>
        <p>Period: ${required_values.date_from} – ${required_values.date_to}</p>
        <p>Division: ${required_values.division}</p>
    </div>

    ${incomeSection}
    ${expenseSection}

    <!-- Net -->
    <div class="net">
        NET ${net >= 0 ? "PROFIT" : "LOSS"}: ${amountStr(net)}
    </div>

</body>
</html>`;
};

// ─── Component ─────────────────────────────────────────────

const ProfitLossReport: React.FC<Props> = ({ required_values }) => {
    const { user } = useAuth();

    const [data, setData] = React.useState<PnlRow[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (!required_values.company_code) return;

        const fetchData = async () => {
            try {
                setLoading(true);

                const response = await getDynamicLookupaccount({
                    parameter:
                        "Account_Report_PROFIT_AND_LOSS_VW_PROFIT_AND_LOSS",
                    loginid: user?.loginid ?? user?.username ?? "ADMIN",
                    code1: required_values.company_code,
                    code2: required_values.division,
                    code3: required_values.date_from,
                    code4: required_values.date_to,
                });

                setData(
                    Array.isArray(response)
                        ? (response as unknown as PnlRow[])
                        : []
                );
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [required_values, user]);

    // ── Open a new popup window with the full printable HTML ──────────────────
    const handleOpenPrintWindow = () => {
        const html = buildPrintHTML(data, required_values);

        const popup = window.open(
            "",
            "PnLReport",
            "width=900,height=700,scrollbars=yes,resizable=yes"
        );

        if (!popup) {
            alert(
                "Popup was blocked. Please allow popups for this site and try again."
            );
            return;
        }

        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
    };

    const groups = groupByHeader(data);

    const income = groups.filter((g) => g.s_order === 1);
    const expense = groups.filter((g) => g.s_order === 2);

    const totalIncome = income.reduce((s, g) => s + g.total, 0);
    const totalExpense = expense.reduce((s, g) => s + g.total, 0);
    const net = totalIncome - totalExpense;

    if (loading) return <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>Loading…</div>;
    if (!data.length) return <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>No data found.</div>;

    return (
        <div className="report">

            {/* ── Action bar (not printed) ── */}
            <div className="no-print actions">
                <button className="btn-open-popup" onClick={handleOpenPrintWindow}>
                    🖨️ Open Print View
                </button>
            </div>

            {/* ── Report header ── */}
            <div className="header">
                <h2>PROFIT &amp; LOSS STATEMENT</h2>
                <p>
                    Period: {required_values.date_from} –{" "}
                    {required_values.date_to}
                </p>
                <p>Division: {required_values.division}</p>
            </div>

            {/* ── Income ── */}
            {income.length > 0 && (
                <>
                    <h3>INCOME</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Description</th>
                                <th style={{ textAlign: "right" }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {income.map((g) => (
                                <React.Fragment key={g.h_code}>
                                    <tr className="group-row">
                                        <td colSpan={3}>{g.h_name}</td>
                                    </tr>
                                    {g.rows.map((r) => (
                                        <tr key={r.pl_code}>
                                            <td>{r.pl_code}</td>
                                            <td>{r.pl_name}</td>
                                            <td style={{ textAlign: "right" }}>
                                                {amountStr(r.lcur_amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="subtotal">
                                        <td colSpan={2}>Total {g.h_name}</td>
                                        <td style={{ textAlign: "right" }}>
                                            {amountStr(g.total)}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    <p className="total-line">
                        TOTAL INCOME: {amountStr(totalIncome)}
                    </p>
                </>
            )}

            {/* ── Expenses ── */}
            {expense.length > 0 && (
                <>
                    <h3>EXPENSES</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Description</th>
                                <th style={{ textAlign: "right" }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expense.map((g) => (
                                <React.Fragment key={g.h_code}>
                                    <tr className="group-row">
                                        <td colSpan={3}>{g.h_name}</td>
                                    </tr>
                                    {g.rows.map((r) => (
                                        <tr key={r.pl_code}>
                                            <td>{r.pl_code}</td>
                                            <td>{r.pl_name}</td>
                                            <td style={{ textAlign: "right" }}>
                                                {amountStr(r.lcur_amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="subtotal">
                                        <td colSpan={2}>Total {g.h_name}</td>
                                        <td style={{ textAlign: "right" }}>
                                            {amountStr(g.total)}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    <p className="total-line">
                        TOTAL EXPENSES: {amountStr(totalExpense)}
                    </p>
                </>
            )}

            {/* ── Net ── */}
            <div className="net">
                NET {net >= 0 ? "PROFIT" : "LOSS"}: {amountStr(net)}
            </div>

            {/* ── Styles ── */}
            <style>{`
                .report {
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                    color: #000;
                    padding: 20px;
                }

                .actions {
                    margin-bottom: 12px;
                    display: flex;
                    justify-content: flex-end;
                }

                .btn-open-popup {
                    padding: 7px 16px;
                    font-size: 12px;
                    cursor: pointer;
                    border-radius: 6px;
                    background: #185FA5;
                    color: #fff;
                    border: 1px solid #185FA5;
                }
                .btn-open-popup:hover { background: #0C447C; }

                .header {
                    text-align: center;
                    margin-bottom: 20px;
                }
                .header h2 { margin: 0; font-size: 16px; }
                .header p  { font-size: 12px; color: #374151; margin-top: 2px; }

                h3 {
                    margin-top: 20px;
                    font-size: 13px;
                    border-bottom: 1px solid #000;
                    padding-bottom: 4px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 8px;
                    page-break-inside: auto;
                }
                tr { page-break-inside: avoid; page-break-after: auto; }
                th, td {
                    border: 1px solid #000;
                    padding: 6px;
                    font-size: 11px;
                }
                th { background: #f2f2f2; }

                .group-row td { font-weight: bold; background: #fafafa; }
                .subtotal     { font-weight: bold; background: #f5f5f5; }

                .total-line {
                    text-align: right;
                    font-weight: bold;
                    margin-top: 8px;
                }

                .net {
                    margin-top: 20px;
                    padding: 10px;
                    border: 1px solid #000;
                    font-weight: bold;
                    text-align: right;
                }
            `}</style>
        </div>
    );
};

export default ProfitLossReport;