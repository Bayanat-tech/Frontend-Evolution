// PerformanceReportDesign.tsx
import React, { useMemo, useEffect, useState, useRef } from "react";
import { pamsSelect, pamsCommonSelect } from "../../api/pams";
import { useAuth } from "../../state/AuthContext";

const COMPANY_CODE = "BSG";

export interface AppraisalFlowHistory {
    HISTORY_ID: string;
    FLOW_LEVEL: string;
    ACTION: string;
    ACTION_BY: string;
    ACTION_BY_NAME: string;
    ACTION_DATE: string;
}

export interface AppraisalPart1 {
    APPRAISAL_DOC_NO: string;
    RPT_NAME: string;
    DESG_NAME: string;
    JOIN_DATE: string;
    SUPERVISOR_NAME: string;
    DEPT_HEAD_NAME: string;
    EMPLOYEE_CODE: string;
    EMPLOYEE_ID: string;
    DEPT_NAME: string;
    TIME_IN_PRESENT_POSITION: string;
    REVIEW_DATE: string;
    DISCUSSION_DATE: string;
    APPRAISAL_FROM: string;
    APPRAISAL_TO: string;
}

export interface EamRating {
    RATING_CODE: string;
    RATING_DESC: string;
}

export interface AppraisalTaskDtl {
    KPI_CODE?: string;
    KPI_DESC?: string;
    KPI_TYPE_CODE?: string;
    KPI_TYPE_DESC?: string;
    KPI_ITEM_DESC?: string;
    STANDARD_WEIGHTAGE?: string | number;
    RATING?: string | number;
    TOTAL?: string | number;
}

export interface AppraisalCharacteristic {
    KPI_CODE?: string;
    KPI_DESC?: string;
    KPI_ITEM_DESC?: string;
    KPI_TYPE_CODE?: string;
    RATING?: string | number;
}

export interface AppraisalSection5 {
    APPRAISER_COMMENTS: string;
    APPRAISEE_COMMENTS: string;
    LAST_ACTION_BY: string;
    LAST_ACTION_BY_NAME: string;
    COMMENTS_DATE: string;
    APPRAISEE_COMMENTS_DATE: string;
    APPRAISER_COMMENTS1?: string;
    APPRAISER_COMMENTS2?: string;
    APPRAISER_COMMENTS3?: string;
    APPRAISER_COMMENTS4?: string;
    APPRAISER_COMMENTS5?: string;
}

interface Props {
    required_values: {
        doc_no: string;
        employee_code: string;
        company_code?: string;
    };
    printRef?: React.RefObject<HTMLDivElement>;
    onReady?: (ready: boolean) => void;  
}

type KpiGroup = {
    kpiCode: string;
    kpiDesc: string;
    standardWeightage: string | number;
    rating: string | number;
    total: string | number;
    subItems: string[];
};

interface ReportContentProps {
    appraisal: AppraisalPart1;
    ratings: EamRating[];
    groupedKpis: KpiGroup[];
    characteristics: AppraisalCharacteristic[];
    totalWeightageDisplay: string;
    totalScoreDisplay: string;
    charTotal: string;
    section5: AppraisalSection5;
    flowHistory: AppraisalFlowHistory[];
}

function fmtDateTime(val: string): string {
    if (!val || val === "null" || val === "undefined") return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;

    const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;

    return `${date} ${time}`;
}

function groupByKpi(tasks: AppraisalTaskDtl[]): KpiGroup[] {
    const map = new Map<string, KpiGroup>();
    for (const t of tasks) {
        const key = t.KPI_CODE ?? "";
        if (!map.has(key)) {
            map.set(key, {
                kpiCode: t.KPI_CODE ?? "",
                kpiDesc: t.KPI_DESC ?? t.KPI_TYPE_DESC ?? "",
                standardWeightage: t.STANDARD_WEIGHTAGE ?? "",
                rating: t.RATING ?? "",
                total: t.TOTAL ?? "",
                subItems: [],
            });
        }
        if (t.KPI_ITEM_DESC) {
            const lines = t.KPI_ITEM_DESC
                .split(/\r?\n/)
                .map((l: string) => l.trim())
                .filter(Boolean);
            map.get(key)!.subItems.push(...lines);
        }
    }
    return Array.from(map.values());
}

function get(r: Record<string, unknown>, upper: string, lower: string): string {
    return String(r[upper] ?? r[lower] ?? "");
}

function fmtDate(val: string): string {
    if (!val || val === "null" || val === "undefined") return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const ReportContent = React.forwardRef<HTMLDivElement, ReportContentProps>(
    (
        {
            appraisal,
            ratings,
            groupedKpis,
            characteristics,
            totalWeightageDisplay,
            totalScoreDisplay,
            charTotal,
            section5,
            flowHistory,
        }: ReportContentProps,
        ref: React.Ref<HTMLDivElement>
    ) => {
        const leftRatings = ratings.slice(0, 3);
        const rightRatings = ratings.slice(3);

        // Index 0 here is reused only as a fallback; Level 0 (employee's own
        // self-rating comment) is NOT stored in APPRAISER_COMMENTS1-5 -- it
        // lives in APPRAISEE_COMMENTS, handled separately below.
        const commentsByLevel = [
            section5.APPRAISER_COMMENTS1 ?? "",
            section5.APPRAISER_COMMENTS2 ?? "",
            section5.APPRAISER_COMMENTS3 ?? "",
            section5.APPRAISER_COMMENTS4 ?? "",
            section5.APPRAISER_COMMENTS5 ?? "",
        ];

        return (
            <div
                ref={ref}
                style={{ background: "#fff", padding: 20, width: "100%", boxSizing: "border-box" }}
            >
                <style>{`
          .prf-wrap { font-family: Arial, sans-serif; font-size: 8.25px; color: #000; }
          .prf-header { display: flex; align-items: center; margin-bottom: 13px; }
          .prf-header-title { flex: 1; text-align: center; font-size: 15px; font-weight: bold; }
          .prf-tbl { width: 100%; border-collapse: collapse; font-size: 8.25px; font-family: Arial, sans-serif; }
          .prf-sec2, .prf-sec3, .prf-sec4, .prf-sec5, .prf-sec6 { margin-top: 9.5px; }
          .prf-tbl td, .prf-tbl th { border: 1px solid #000; padding: 1.5px 4.75px; vertical-align: middle; line-height: 1.23; }
          .prf-tbl .c-bold { font-weight: bold; }
          .prf-tbl .c-center { text-align: center; }
          .prf-tbl .c-right { text-align: right; }
          .prf-tbl .c-section-head { font-weight: bold; border-bottom: 2px solid #000; }
          .prf-tbl .c-header { font-weight: bold; background-color: #f0f0f0; text-align: center; }
          .prf-tbl .c-dark-header { font-weight: bold; background-color: #d0d0d0; text-align: center; }
          .prf-tbl .c-kpi-merged { position: relative; font-weight: bold; }
          .prf-kpi-name-text { position: relative; z-index: 1; }
          .prf-kpi-overall-center {
            position: absolute; left: 0; right: 0; top: 50%;
            transform: translateY(-50%); text-align: center;
            font-weight: normal; pointer-events: none;
          }
          .prf-tbl .c-subitem { padding-left: 5px; }
          .prf-tbl .c-total-top { border-top: 2px solid #000; font-weight: bold; text-align: center; }
          .prf-tbl .c-total-top-blank { border-top: 2px solid #000; }
          .prf-tbl .c-comment-area { height: 57px; vertical-align: top; padding: 4px; }
          .prf-tbl .c-comment-text { font-size: 8px; color: #111; white-space: pre-wrap; word-break: break-word; }
          .prf-tbl .c-spacer { height: 5.7px; border: none; }
          .prf-tbl .c-instruction { font-size: 7.5px; }
          .prf-tbl .c-row-spacer { height: 9.5px; }
          @media print {
            @page { size: A4 portrait; margin: 10mm 8mm; }
            body * { visibility: hidden; }
            .prf-wrap, .prf-wrap * { visibility: visible; }
            .prf-wrap { position: absolute; top: 0; left: 0; width: 100%; }
            .prf-tbl { page-break-inside: avoid; }
            .prf-sec2 { page-break-before: auto; }
            .prf-sec3, .prf-sec4, .prf-sec5, .prf-sec6 { page-break-inside: avoid; }
            .prf-tbl td, .prf-tbl th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .prf-tbl .c-header, .prf-tbl .c-dark-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>

                <div className="prf-wrap">
                    <div className="prf-header">
                        <div style={{ flexShrink: 0, width: 187, height: 68 }}>
                            <svg width="187" height="68" viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0" y="0" width="40" height="80" fill="#F7941D" />
                                <rect x="40" y="0" width="155" height="80" fill="#008B9B" />
                                <text x="117" y="17" fill="#fff" fontSize="10.5" fontFamily="Arial" textAnchor="middle" fontWeight="bold">المدينة</text>
                                <text x="117" y="34" fill="#fff" fontSize="16" fontFamily="Arial" textAnchor="middle" fontWeight="bold">al madina</text>
                                <text x="117" y="50" fill="#F7941D" fontSize="10" fontFamily="Arial" textAnchor="middle" fontWeight="bold" letterSpacing="2.5">LOGISTICS</text>
                                <text x="117" y="62" fill="#fff" fontSize="8.5" fontFamily="Arial" textAnchor="middle">اللوجستية</text>
                                <text x="117" y="74" fill="#fff" fontSize="7" fontFamily="Arial" textAnchor="middle">خدمات لوجستية فائقة</text>
                                <polygon points="185,14 204,40 185,66" fill="#F7941D" />
                                <polygon points="174,19 191,40 174,61" fill="#F7941D" opacity="0.5" />
                            </svg>
                        </div>
                        <div className="prf-header-title">Performance Review for Non-Managers</div>
                    </div>

                    <table className="prf-tbl">
                        <tbody>
                            <tr>
                                <td colSpan={4} className="c-bold c-section-head">Section 1 : Details</td>
                            </tr>
                            <tr>
                                <td className="c-bold" style={{ width: "18%" }}>Name:</td>
                                <td style={{ width: "46%" }}>{appraisal.RPT_NAME}</td>
                                <td className="c-bold" style={{ width: "16%" }}>Emp No.:</td>
                                <td style={{ width: "20%" }}>{appraisal.EMPLOYEE_CODE}</td>
                            </tr>
                            <tr>
                                <td className="c-bold">Job Title:</td>
                                <td>{appraisal.DESG_NAME}</td>
                                <td className="c-bold">Department:</td>
                                <td>{appraisal.DEPT_NAME}</td>
                            </tr>
                            <tr>
                                <td className="c-bold">Date of joining:</td>
                                <td>{appraisal.JOIN_DATE}</td>
                                <td className="c-bold">Time in present<br />position:</td>
                                <td>{appraisal.TIME_IN_PRESENT_POSITION}</td>
                            </tr>
                            <tr>
                                <td className="c-bold">Name &amp; Emp.No. of Appraiser:</td>
                                <td>{appraisal.SUPERVISOR_NAME}</td>
                                <td className="c-bold">Review Date:</td>
                                <td className="c-center">{appraisal.REVIEW_DATE}</td>
                            </tr>
                            <tr>
                                <td className="c-bold">Name of Reviewer:</td>
                                <td>{appraisal.DEPT_HEAD_NAME}</td>
                                <td className="c-bold">Discussion Date:</td>
                                <td className="c-center">{appraisal.DISCUSSION_DATE}</td>
                            </tr>
                            <tr>
                                <td className="c-bold">Review Period</td>
                                <td>{appraisal.APPRAISAL_FROM} - {appraisal.APPRAISAL_TO}</td>
                                <td /><td />
                            </tr>
                            <tr><td colSpan={4} className="c-row-spacer" /></tr>
                        </tbody>
                    </table>

                    <table className="prf-tbl">
                        <tbody>
                            <tr>
                                <td colSpan={3} className="c-bold c-instruction">
                                    Mention and rate tasks for the Review period in the space below.
                                    The appraisee should be appraised on a minimum of 3 tasks and a maximum of 5 tasks.
                                </td>
                            </tr>
                            <tr>
                                <td className="c-bold" style={{ width: "26%" }}>Rating Scale:</td>
                                <td style={{ width: "44%" }}>
                                    {leftRatings.map((r: EamRating) => (
                                        <div key={r.RATING_CODE}>{r.RATING_CODE} = {r.RATING_DESC}</div>
                                    ))}
                                </td>
                                <td style={{ width: "30%" }}>
                                    {rightRatings.map((r: EamRating) => (
                                        <div key={r.RATING_CODE}>{r.RATING_CODE} = {r.RATING_DESC}</div>
                                    ))}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="prf-tbl prf-sec2">
                        <colgroup>
                            <col style={{ width: "4%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "47%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "11%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <td colSpan={6} className="c-bold c-section-head">Section 2 : Performance Assessment</td>
                            </tr>
                            <tr>
                                <th className="c-header">S.N.</th>
                                <th className="c-header" colSpan={2}>Tasks ( To be entered by the Appraiser)</th>
                                <th className="c-header">Wt.%</th>
                                <th className="c-header">Rating</th>
                                <th className="c-header">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedKpis.length === 0
                                ? Array.from({ length: 5 }).map((_, idx: number) => (
                                    <tr key={`empty-${idx}`}>
                                        <td className="c-center">{idx + 1}</td>
                                        <td colSpan={2}>&nbsp;</td>
                                        <td className="c-center">&nbsp;</td>
                                        <td className="c-center">&nbsp;</td>
                                        <td className="c-center">&nbsp;</td>
                                    </tr>
                                ))
                                : groupedKpis.map((kpi: KpiGroup, groupIdx: number) => (
                                    <React.Fragment key={kpi.kpiCode || groupIdx}>
                                        <tr>
                                            <td className="c-center c-bold">{groupIdx + 1}</td>
                                            <td colSpan={2} className="c-kpi-merged">
                                                <span className="prf-kpi-name-text">{kpi.kpiDesc}</span>
                                                <span className="prf-kpi-overall-center">(overall rating)</span>
                                            </td>
                                            <td className="c-center c-bold">
                                                {kpi.standardWeightage !== "" ? `${kpi.standardWeightage}%` : ""}
                                            </td>
                                            <td className="c-center c-bold">{kpi.rating}</td>
                                            <td className="c-center c-bold">{kpi.total}</td>
                                        </tr>
                                        {kpi.subItems.map((line: string, lineIdx: number) => (
                                            <tr key={`${kpi.kpiCode}-sub-${lineIdx}`}>
                                                <td>&nbsp;</td>
                                                <td>&nbsp;</td>
                                                <td className="c-subitem">
                                                    {String.fromCharCode(97 + lineIdx)})&nbsp;&nbsp;{line}
                                                </td>
                                                <td className="c-center">&nbsp;</td>
                                                <td className="c-center">&nbsp;</td>
                                                <td className="c-center">&nbsp;</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            <tr>
                                <td colSpan={3} className="c-total-top-blank">&nbsp;</td>
                                <td className="c-total-top">{totalWeightageDisplay}</td>
                                <td className="c-total-top-blank">&nbsp;</td>
                                <td className="c-total-top">{totalScoreDisplay}</td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="prf-tbl prf-sec3">
                        <tbody>
                            <tr>
                                <td colSpan={3} className="c-bold c-section-head">Section 3: Employee Characteristics:</td>
                            </tr>
                            <tr>
                                <td colSpan={3}>Rate the appraisee on the employee characteristics mentioned below.</td>
                            </tr>
                            <tr>
                                <td className="c-bold" style={{ width: "26%" }}>Rating Scale:</td>
                                <td style={{ width: "44%" }}>
                                    {leftRatings.map((r: EamRating) => (
                                        <div key={r.RATING_CODE}>{r.RATING_CODE} = {r.RATING_DESC}</div>
                                    ))}
                                </td>
                                <td style={{ width: "30%" }}>
                                    {rightRatings.map((r: EamRating) => (
                                        <div key={r.RATING_CODE}>{r.RATING_CODE} = {r.RATING_DESC}</div>
                                    ))}
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2} className="c-dark-header">Employee Characteristics</td>
                                <td className="c-dark-header" style={{ width: "12%" }}>Rating</td>
                            </tr>
                            {characteristics.length === 0
                                ? Array.from({ length: 4 }).map((_, idx: number) => (
                                    <tr key={`char-empty-${idx}`}>
                                        <td className="c-center" style={{ width: "5%" }}>{idx + 1}</td>
                                        <td>&nbsp;</td>
                                        <td className="c-center">&nbsp;</td>
                                    </tr>
                                ))
                                : characteristics.map((c: AppraisalCharacteristic, idx: number) => (
                                    <tr key={c.KPI_CODE ?? idx}>
                                        <td className="c-center" style={{ width: "5%" }}>{idx + 1}</td>
                                        <td>{c.KPI_DESC ?? c.KPI_ITEM_DESC ?? ""}</td>
                                        <td className="c-right" style={{ width: "12%" }}>
                                            {c.RATING !== undefined && c.RATING !== ""
                                                ? Number(c.RATING).toFixed(2)
                                                : ""}
                                        </td>
                                    </tr>
                                ))}
                            <tr>
                                <td colSpan={2} className="c-right">&nbsp;</td>
                                <td className="c-right c-total-top c-bold">{charTotal}</td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="prf-tbl prf-sec4">
                        <tbody>
                            <tr>
                                <td colSpan={2} className="c-bold c-section-head">Section 4: Overall Rating</td>
                            </tr>
                            <tr>
                                <td className="c-bold" style={{ width: "88%" }}>Overall Rating for the Review</td>
                                <td className="c-center c-bold" style={{ width: "12%" }}>
                                    {totalScoreDisplay || ""}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="prf-tbl prf-sec5">
                        <tbody>
                            <tr>
                                <td colSpan={6} className="c-bold c-section-head">
                                    Section 5 : Comments &amp; Signatures:
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={6} className="c-instruction">
                                    Use this space for any additional comments. Signatures of appraisee, appraiser and
                                    reviewer are mandatory before final submissions of forms.
                                </td>
                            </tr>

                            <tr>
                                <td className="c-dark-header" style={{ width: "5%" }}>Sr.</td>
                                <td className="c-dark-header" style={{ width: "22%" }}>Approved By</td>
                                <td className="c-dark-header" style={{ width: "18%" }}>Date &amp; Time</td>
                                <td className="c-dark-header" style={{ width: "20%" }}>Appraiser Comments</td>
                                <td className="c-dark-header" style={{ width: "20%" }}>Appraisee Comments</td>
                                <td className="c-dark-header" style={{ width: "15%" }}>Signature</td>
                            </tr>

                            {flowHistory.length === 0 ? (
                                <tr>
                                    <td style={{ padding: "5px 6px" }}>—</td>
                                    <td style={{ padding: "5px 6px" }}>&nbsp;</td>
                                    <td style={{ padding: "5px 6px" }}>&nbsp;</td>
                                    <td style={{ padding: "5px 6px" }}>
                                        {section5.APPRAISER_COMMENTS || <span>&nbsp;</span>}
                                    </td>
                                    <td style={{ padding: "5px 6px" }}>
                                        {section5.APPRAISEE_COMMENTS || <span>&nbsp;</span>}
                                    </td>
                                    <td style={{ padding: "5px 6px" }}>
                                        <div style={{ borderBottom: "1px solid #000", height: "20px" }} />
                                    </td>
                                </tr>
                            ) : (
                                flowHistory.map((f: AppraisalFlowHistory, idx: number) => {
                                    const level = Number(f.FLOW_LEVEL);
                                    // Level 0 = employee's own self-rating draft submission.
                                    // Its remark lives in APPRAISEE_COMMENTS (not APPRAISER_COMMENTS1-5),
                                    // so it's picked up in the Appraisee Comments cell below, not here.
                                    const comment = level >= 1 && level <= 5
                                        ? commentsByLevel[level - 1]
                                        : "";
                                    const isEmployeeSelfRow =
                                        level === 0 && f.ACTION_BY === appraisal.EMPLOYEE_CODE;

                                    return (
                                        <tr key={f.HISTORY_ID ?? idx}>
                                            <td style={{
                                                verticalAlign: "top",
                                                padding: "5px 6px",
                                                textAlign: "center",
                                                fontWeight: 700,
                                                fontSize: "8px"
                                            }}>
                                                {idx + 1}
                                            </td>

                                            <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                                                <div style={{ fontWeight: 700, fontSize: "8.5px", color: "#000" }}>
                                                    {f.ACTION_BY_NAME || f.ACTION_BY || "—"}
                                                </div>
                                                <div style={{
                                                    fontSize: "7px",
                                                    color: "#444",
                                                    marginTop: "2px",
                                                    fontStyle: "italic"
                                                }}>
                                                </div>
                                            </td>

                                            <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                                                {f.ACTION_DATE ? (
                                                    <div>

                                                        <div style={{ fontSize: "8px", fontWeight: 600, color: "#000" }}>
                                                            {fmtDateTime(f.ACTION_DATE).split(" ")[0]}
                                                        </div>
                                                        <div style={{ fontSize: "7.5px", color: "#555", marginTop: "2px" }}>
                                                            {fmtDateTime(f.ACTION_DATE).split(" ")[1] || ""}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "#aaa" }}>—</span>
                                                )}
                                            </td>

                                            <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                                                {comment
                                                    ? <span className="c-comment-text">{comment}</span>
                                                    : <span>&nbsp;</span>}
                                            </td>

                                            <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                                                {(isEmployeeSelfRow || f.ACTION_BY === appraisal.EMPLOYEE_CODE) && section5.APPRAISEE_COMMENTS
                                                    ? <span className="c-comment-text">{section5.APPRAISEE_COMMENTS}</span>
                                                    : <span>&nbsp;</span>}
                                            </td>

                                            <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                                                <div style={{
                                                    borderBottom: "1px solid #000",
                                                    height: "20px",
                                                    marginBottom: "4px"
                                                }} />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    <table className="prf-tbl prf-sec6">
                        <tbody>
                            <tr>
                                <td colSpan={3} className="c-bold c-section-head">
                                    Section 6 : For use by the CEO/COO for overall rating of 1 or 5
                                </td>
                            </tr>
                            <tr>
                                <td style={{ width: "20%" }}>&nbsp;</td>
                                <td className="c-dark-header" style={{ width: "60%" }}>Name &amp; Signature</td>
                                <td className="c-dark-header" style={{ width: "20%" }}>Date</td>
                            </tr>
                            <tr>
                                <td className="c-bold">Approval for Rating 1 &amp; 5:</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
);
ReportContent.displayName = "ReportContent";

// ─── Main Component ───────────────────────────────────────────────────────────
const PerformanceReportDesign: React.FC<Props> = ({ required_values, printRef, onReady }) => {
    const { user } = useAuth();
    const { doc_no, employee_code, company_code = COMPANY_CODE } = required_values;
    const loginid = user?.loginid ?? user?.username ?? "";

    const reportRef = useRef<HTMLDivElement>(null);

    const combinedRef = (node: HTMLDivElement | null) => {
        (reportRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (printRef) {
            (printRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
    };

    const [flowHistory, setFlowHistory] = useState<AppraisalFlowHistory[]>([]);
    const [appraisalData, setAppraisalData] = useState<Record<string, unknown>[]>([]);
    const [ratingsData, setRatingsData] = useState<Record<string, unknown>[]>([]);
    const [taskData, setTaskData] = useState<AppraisalTaskDtl[]>([]);
    const [characteristicsData, setCharacteristics] = useState<AppraisalCharacteristic[]>([]);
    const [headerData, setHeaderData] = useState<Record<string, unknown> | null>(null);

    const [section5Data, setSection5Data] = useState<AppraisalSection5>({
        APPRAISER_COMMENTS: "",
        APPRAISEE_COMMENTS: "",
        LAST_ACTION_BY: "",
        LAST_ACTION_BY_NAME: "",
        COMMENTS_DATE: "",
        APPRAISEE_COMMENTS_DATE: "",
        APPRAISER_COMMENTS1: "",
        APPRAISER_COMMENTS2: "",
        APPRAISER_COMMENTS3: "",
        APPRAISER_COMMENTS4: "",
        APPRAISER_COMMENTS5: "",
    });

    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        if (!loginid || !doc_no || !employee_code) return;

        setIsFetching(true);

        Promise.all([
            pamsCommonSelect({
                parameter: "PERFORMANCE_REPORT_EMP_APPRAISAL_PART1_SELECT_BY_DOC_EMP",
                loginid,
                code1: doc_no,
                code2: employee_code,
            }),
            pamsCommonSelect({
                parameter: "PERFORMANCE_REPORT_EAM_RATING_SELECT",
                loginid,
                code1: company_code,
            }),
            pamsSelect<AppraisalTaskDtl>({
                parameter: "Trn_task",
                loginid,
                code1: company_code,
                code2: doc_no,
                code3: employee_code,
            }),
            pamsSelect<AppraisalCharacteristic>({
                parameter: "Trn_character",
                loginid,
                code1: company_code,
                code2: doc_no,
                code3: employee_code,
            }),
            pamsSelect<Record<string, unknown>>({
                parameter: "appraisal_comments",
                loginid,
                code1: doc_no,
            }),
            pamsSelect<AppraisalFlowHistory>({
                parameter: "get_appraisal_flow_with_name",
                loginid,
                code1: doc_no,
            }),
            pamsSelect<Record<string, unknown>>({
                parameter: "appraisal_comments",
                loginid,
                code1: doc_no,
            }),
        ])
            .then(async ([appraisal, ratings, tasks, chars, comments, flowHist, hdrComments]) => {
                setAppraisalData(appraisal as Record<string, unknown>[]);
                setRatingsData(ratings as Record<string, unknown>[]);
                const seen = new Set<number>();
                const uniqueFlow = (flowHist as AppraisalFlowHistory[])
                    .filter(f => {
                        const level = Number(f.FLOW_LEVEL);
                        // Level 0 (self-rating employee's own draft submission)
                        // is now INCLUDED so it shows up as a row in the report.
                        if (level < 0 || level > 5) return false;
                        if (seen.has(level)) return false;
                        seen.add(level);
                        return true;
                    });
                setFlowHistory(uniqueFlow);

                const sortedTasks = [...(tasks as AppraisalTaskDtl[])].sort(
                    (a, b) => Number(a.KPI_CODE) - Number(b.KPI_CODE)
                );
                setTaskData(sortedTasks);

                const sortedChars = [...(chars as AppraisalCharacteristic[])].sort(
                    (a, b) => Number(a.KPI_CODE) - Number(b.KPI_CODE)
                );
                setCharacteristics(sortedChars);

                const commentsArr = comments as Record<string, unknown>[];
                const commentsRow = commentsArr[0] ?? {};

                const appraiserComments = String(
                    commentsRow["APPRAISER_COMMENTS"] ?? commentsRow["appraiser_comments"] ?? ""
                );
                const appraiseeComments = String(
                    commentsRow["APPRAISEE_COMMENTS"] ?? commentsRow["appraisee_comments"] ?? ""
                );
                const commentsDate = String(
                    commentsRow["COMMENTS_DATE"] ?? commentsRow["comments_date"] ?? ""
                );
                const appraiseeCmtDate = String(
                    commentsRow["APPRAISEE_COMMENTS_DATE"] ?? commentsRow["appraisee_comments_date"] ?? ""
                );
                const hdrRow = (hdrComments as Record<string, unknown>[])?.[0] ?? {};
                setHeaderData(hdrRow);

                setSection5Data({
                    APPRAISER_COMMENTS: appraiserComments,
                    APPRAISEE_COMMENTS: appraiseeComments,
                    LAST_ACTION_BY: String(hdrRow["LAST_ACTION_BY"] ?? ""),
                    LAST_ACTION_BY_NAME: String(hdrRow["LAST_ACTION_BY_NAME"] ?? ""),
                    COMMENTS_DATE: commentsDate,
                    APPRAISEE_COMMENTS_DATE: appraiseeCmtDate,
                    APPRAISER_COMMENTS1: String(hdrRow["APPRAISER_COMMENTS1"] ?? ""),
                    APPRAISER_COMMENTS2: String(hdrRow["APPRAISER_COMMENTS2"] ?? ""),
                    APPRAISER_COMMENTS3: String(hdrRow["APPRAISER_COMMENTS3"] ?? ""),
                    APPRAISER_COMMENTS4: String(hdrRow["APPRAISER_COMMENTS4"] ?? ""),
                    APPRAISER_COMMENTS5: String(hdrRow["APPRAISER_COMMENTS5"] ?? ""),
                });
            })
            .catch(() => {
                setAppraisalData([]);
                setRatingsData([]);
                setTaskData([]);
                setCharacteristics([]);
                onReady?.(false);
            })
            .finally(() => setIsFetching(false));
    }, [loginid, doc_no, employee_code, company_code]);

    const appraisal: AppraisalPart1 | null = useMemo(() => {
        if (!appraisalData.length) return null;
        const r = appraisalData[0];
        return {
            APPRAISAL_DOC_NO: get(r, "APPRAISAL_DOC_NO", "appraisal_doc_no"),
            RPT_NAME: get(r, "RPT_NAME", "rpt_name"),
            DESG_NAME: get(r, "DESG_NAME", "desg_name"),
            JOIN_DATE: get(r, "JOIN_DATE", "join_date"),
            SUPERVISOR_NAME: get(r, "SUPERVISOR_NAME", "supervisor_name"),
            DEPT_HEAD_NAME: get(r, "DEPT_HEAD_NAME", "dept_head_name"),
            EMPLOYEE_CODE: get(r, "EMPLOYEE_CODE", "employee_code"),
            EMPLOYEE_ID: get(r, "EMPLOYEE_ID", "employee_id"),
            DEPT_NAME: get(r, "DEPT_NAME", "dept_name"),
            TIME_IN_PRESENT_POSITION: get(r, "TIME_IN_PRESENT_POSITION", "time_in_present_position"),
            REVIEW_DATE: get(r, "REVIEW_DATE", "review_date"),
            DISCUSSION_DATE: get(r, "DISCUSSION_DATE", "discussion_date"),
            APPRAISAL_FROM: get(r, "APPRAISAL_FROM", "appraisal_from"),
            APPRAISAL_TO: get(r, "APPRAISAL_TO", "appraisal_to"),
        };
    }, [appraisalData]);

    const ratings: EamRating[] = useMemo(
        () =>
            ratingsData.map((r) => ({
                RATING_CODE: String(r["RATING_CODE"] ?? r["rating_code"] ?? ""),
                RATING_DESC: String(r["RATING_DESC"] ?? r["rating_desc"] ?? ""),
            })),
        [ratingsData]
    );

    const groupedKpis = useMemo(() => groupByKpi(taskData), [taskData]);

    const totalWeightage = useMemo(
        () =>
            groupedKpis.reduce((sum, kpi) => {
                const w = parseFloat(String(kpi.standardWeightage));
                return sum + (isNaN(w) ? 0 : w);
            }, 0),
        [groupedKpis]
    );

    const totalScore = useMemo(
        () =>
            groupedKpis.reduce((sum, kpi) => {
                const t = parseFloat(String(kpi.total));
                return sum + (isNaN(t) ? 0 : t);
            }, 0),
        [groupedKpis]
    );

    const totalWeightageDisplay = totalWeightage > 0 ? `${totalWeightage}%` : "100%";
    const totalScoreDisplay = totalScore > 0 ? totalScore.toFixed(2) : "";

    const charTotalNum =
        characteristicsData.length > 0
            ? characteristicsData.reduce((sum, c) => sum + Number(c.RATING ?? 0), 0) /
            characteristicsData.length
            : 0;
    const charTotal = charTotalNum > 0 ? charTotalNum.toFixed(2) : "";
    useEffect(() => {
    if (!isFetching && appraisal) {
        // Ek frame wait karo taaki ReportContent DOM mein fully paint ho chuke
        const id = requestAnimationFrame(() => onReady?.(true));
        return () => cancelAnimationFrame(id);
    }
    // Loading shuru hote hi parent ko "not ready" bata do
    onReady?.(false);
}, [isFetching, appraisal, onReady]);

    if (isFetching) return <div style={{ padding: 24 }}>Loading...</div>;
    if (!appraisal) return <div style={{ padding: 24 }}>No Data</div>;

    return (
        <ReportContent
            ref={combinedRef}
            appraisal={appraisal}
            ratings={ratings}
            groupedKpis={groupedKpis}
            characteristics={characteristicsData}
            totalWeightageDisplay={totalWeightageDisplay}
            totalScoreDisplay={totalScoreDisplay}
            charTotal={charTotal}
            section5={section5Data}
            flowHistory={flowHistory}
        />
    );
};

PerformanceReportDesign.displayName = "PerformanceReportDesign";
export default PerformanceReportDesign;