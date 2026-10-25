// PerformanceReportDesign.tsx
import React, { useMemo, useEffect, useState, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pamsSelect } from "../../api/pams";
import { useAuth } from "../../state/AuthContext";
import NewReportDialog from "../../components/new_report_format/NewReportDialog";


const COMPANY_CODE = "BSG";

const FALLBACK_LOGOS: Record<string, string> = {
  BSG: "https://objectstorage.me-dubai-1.oraclecloud.com/n/axpnrpp1t5qs/b/app-dev-bucket-test/o/COMPANY_LOGO%2Falmadinalogo.jpeg",
};

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

export interface AppraisalCommentLogRow {
  FLOW_LEVEL: number | string;
  COMMENT_TYPE: string;
  COMMENT_TEXT: string;
  COMMENT_BY: string;
  COMMENT_BY_NAME: string;
  COMMENT_DATE: string;
}

export interface AppraisalSection5 {
  APPRAISER_COMMENTS: string;
  APPRAISEE_COMMENTS: string;
  LAST_ACTION_BY: string;
  LAST_ACTION_BY_NAME: string;
  COMMENTS_DATE: string;
  APPRAISEE_COMMENTS_DATE: string;
}

interface Props {
  required_values: {
    doc_no: string;
    employee_code: string;
    company_code?: string;
  };
  printRef?: React.RefObject<HTMLDivElement>;
  onReady?: (ready: boolean) => void;
  onClose?: () => void;
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
  skills: AppraisalCharacteristic[];
  goals: AppraisalCharacteristic[];
  totalWeightageDisplay: string;
  totalScoreDisplay: string;
  charTotal: string;
  skillTotal: string;
  goalTotal: string;
  finalRating: string;
  deptHeadDate: string;
  section5: AppraisalSection5;
  flowHistory: AppraisalFlowHistory[];
  commentLog: AppraisalCommentLogRow[];
  companyLogoUrl: string;
}

function fmtDateTime(val: string): string {
  if (!val || val === "null" || val === "undefined") return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  return `${date} ${time}`;
}

/** date-only formatter — strips ISO T18:30:00.000Z suffix */
function fmtDate(val: string): string {
  if (!val || val === "null" || val === "undefined") return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Joining date se aaj tak ka tenure: "8 years 11 months" */
function fmtTenure(joinVal: string): string {
  if (!joinVal || joinVal === "null" || joinVal === "undefined") return "";
  const j = new Date(joinVal);
  if (isNaN(j.getTime())) return "";
  const now = new Date();
  let months = (now.getFullYear() - j.getFullYear()) * 12 + (now.getMonth() - j.getMonth());
  if (now.getDate() < j.getDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y > 1 ? "s" : ""}`);
  if (m > 0 || y === 0) parts.push(`${m} month${m !== 1 ? "s" : ""}`);
  return parts.join(" ");
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
      const lines = t.KPI_ITEM_DESC.split(/\r?\n/)
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

function commentForLevel(
  log: AppraisalCommentLogRow[],
  level: number,
  type: "APPRAISER" | "APPRAISEE"
): string {
  const row = log.find(
    (r) => String(r.FLOW_LEVEL) === String(level) && r.COMMENT_TYPE === type
  );
  return row?.COMMENT_TEXT ?? "";
}

/* ─────────────── ReportContent ─────────────── */

const ReportContent = React.forwardRef<HTMLDivElement, ReportContentProps>(
  (
    {
      appraisal,
      ratings,
      groupedKpis,
      characteristics,
      skills,
      goals,
      totalWeightageDisplay,
      totalScoreDisplay,
      charTotal,
      skillTotal,
      goalTotal,
      finalRating,
      deptHeadDate,
      section5,
      flowHistory,
      commentLog,
      companyLogoUrl,
    }: ReportContentProps,
    ref: React.Ref<HTMLDivElement>
  ) => {
    const leftRatings = ratings.slice(0, 3);
    const rightRatings = ratings.slice(3);

    const ratingScaleRows = (
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
    );

    // Dept Head ne jis din submit kiya wahi date; na mile to purani value
    const reviewDateText = fmtDate(deptHeadDate) || fmtDate(appraisal.REVIEW_DATE);
    const discussionDateText = fmtDate(deptHeadDate) || fmtDate(appraisal.DISCUSSION_DATE);

    return (
      <div
        ref={ref}
        className="sheet"
        style={{ background: "#fff", padding: 20, width: "100%", boxSizing: "border-box" }}
      >
        <style>{`
          .prf-wrap { font-family: Arial, sans-serif; font-size: 8.25px; color: #000; }
          .prf-header { display: flex; align-items: center; margin-bottom: 13px; }
          .prf-header-title { flex: 1; text-align: center; font-size: 15px; font-weight: bold; }
          .prf-tbl { width: 100%; border-collapse: collapse; font-size: 8.25px; font-family: Arial, sans-serif; }
          .prf-sec2, .prf-sec3, .prf-sec3b, .prf-sec3c, .prf-sec4, .prf-sec5, .prf-sec6 { margin-top: 9.5px; }
          .prf-tbl td, .prf-tbl th { border: 1px solid #000; padding: 1.5px 4.75px; vertical-align: middle; line-height: 1.23; }
          .prf-tbl .c-bold { font-weight: bold; }
          .prf-tbl .c-center { text-align: center; }
          .prf-tbl .c-right { text-align: right; }
          .prf-tbl .c-section-head { font-weight: bold; border-bottom: 2px solid #000; }
          .prf-tbl .c-header { font-weight: bold; background-color: #f0f0f0; text-align: center; }
          .prf-tbl .c-dark-header { font-weight: bold; background-color: #d0d0d0; text-align: center; }
          .prf-tbl .c-kpi-merged { position: relative; font-weight: bold; }
          .prf-kpi-name-text { position: relative; z-index: 1; }
          .prf-tbl .c-subitem { padding-left: 5px; }
          .prf-tbl .c-total-top { border-top: 2px solid #000; font-weight: bold; text-align: center; }
          .prf-tbl .c-total-top-blank { border-top: 2px solid #000; }
          .prf-tbl .c-comment-area { height: 57px; vertical-align: top; padding: 4px; }
          .prf-tbl .c-comment-text { font-size: 8px; color: #111; white-space: pre-wrap; word-break: break-word; }
          .prf-tbl .c-spacer { height: 5.7px; border: none; }
          .prf-tbl .c-instruction { font-size: 7.5px; }
          .prf-tbl .c-row-spacer { height: 9.5px; }

          /* Override NewReportDialog's th,td { white-space: nowrap !important } */
          .sheet .prf-wrap .prf-tbl th,
          .sheet .prf-wrap .prf-tbl td { white-space: normal !important; }

          /* Keep original sizes even though NewReportDialog forces 9px on body * */
          .sheet .prf-wrap,
          .sheet .prf-wrap .prf-tbl,
          .sheet .prf-wrap .prf-tbl td,
          .sheet .prf-wrap .prf-tbl th { font-size: 8.25px !important; }
          .sheet .prf-wrap .prf-header-title { font-size: 15px !important; }
          .sheet .prf-wrap .prf-tbl .c-comment-text { font-size: 8px !important; }
          .sheet .prf-wrap .prf-tbl .c-instruction { font-size: 7.5px !important; }

          @media print {
            @page { size: A4 portrait; margin: 10mm 8mm; }
            body * { visibility: hidden; }
            .prf-wrap, .prf-wrap * { visibility: visible; }
            .prf-wrap { position: absolute; top: 0; left: 0; width: 100%; }
            .prf-tbl { page-break-inside: avoid; }
            .prf-sec2 { page-break-before: auto; }
            .prf-sec3, .prf-sec3b, .prf-sec3c, .prf-sec4, .prf-sec5, .prf-sec6 { page-break-inside: avoid; }
            .prf-tbl td, .prf-tbl th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .prf-tbl .c-header, .prf-tbl .c-dark-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>

        <div className="prf-wrap">
          {/* company logo from MS_COMPANY (fallback = original SVG) */}
          <div className="prf-header">
            <div style={{ flexShrink: 0, width: 187, height: 68 }}>
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt="Company Logo"
                  crossOrigin="anonymous"
                  style={{
                    width: 187,
                    height: 68,
                    objectFit: "contain",
                    objectPosition: "left center",
                    display: "block",
                  }}
                />
              ) : (
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
              )}
            </div>
            <div className="prf-header-title">Performance Review for Non-Managers</div>
          </div>

          {/* Section 1 : Details */}
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
                <td>{fmtDate(appraisal.JOIN_DATE)}</td>
                <td className="c-bold">Time in present<br />position:</td>
                <td>
                  {appraisal.JOIN_DATE ? `Since ${fmtDate(appraisal.JOIN_DATE)}` : ""}
                  <br />
                  {fmtTenure(appraisal.JOIN_DATE)}
                </td>
              </tr>
              <tr>
                <td className="c-bold">Name &amp; Emp.No. of Appraiser:</td>
                <td>{appraisal.SUPERVISOR_NAME}</td>
                <td className="c-bold">Review Date:</td>
                <td className="c-left">{reviewDateText}</td>
              </tr>
              <tr>
                <td className="c-bold">Name of Reviewer:</td>
                <td>{appraisal.DEPT_HEAD_NAME}</td>
                <td className="c-bold">Discussion Date:</td>
                <td className="c-left">{discussionDateText}</td>
              </tr>
              <tr>
                <td className="c-bold">Review Period</td>
                <td>{fmtDate(appraisal.APPRAISAL_FROM)} - {fmtDate(appraisal.APPRAISAL_TO)}</td>
                <td /><td />
              </tr>
              <tr><td colSpan={4} className="c-row-spacer" /></tr>
            </tbody>
          </table>

          {/* Instruction + Rating Scale */}
          <table className="prf-tbl">
            <tbody>
              <tr>
                <td colSpan={3} className="c-bold c-instruction">
                  Mention and rate tasks for the Review period in the space below.
                  The appraisee should be appraised on a minimum of 3 tasks and a maximum of 5 tasks.
                </td>
              </tr>
              {ratingScaleRows}
            </tbody>
          </table>

          {/* Section 2 : Performance Assessment */}
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

          {/* Section 3 : Employee Characteristics */}
          <table className="prf-tbl prf-sec3">
            <tbody>
              <tr>
                <td colSpan={3} className="c-bold c-section-head">Section 3: Employee Characteristics:</td>
              </tr>
              <tr>
                <td colSpan={3}>Rate the appraisee on the employee characteristics mentioned below.</td>
              </tr>
              {ratingScaleRows}
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

          {/* Section 3B : Skills */}
          <table className="prf-tbl prf-sec3b">
            <tbody>
              <tr>
                <td colSpan={3} className="c-bold c-section-head">Section 3B: Skills:</td>
              </tr>
              <tr>
                <td colSpan={3}>Rate the appraisee on the skills mentioned below.</td>
              </tr>
              {ratingScaleRows}
              <tr>
                <td colSpan={2} className="c-dark-header">Skills</td>
                <td className="c-dark-header" style={{ width: "12%" }}>Rating</td>
              </tr>
              {skills.length === 0
                ? Array.from({ length: 4 }).map((_, idx: number) => (
                    <tr key={`skill-empty-${idx}`}>
                      <td className="c-center" style={{ width: "5%" }}>{idx + 1}</td>
                      <td>&nbsp;</td>
                      <td className="c-center">&nbsp;</td>
                    </tr>
                  ))
                : skills.map((c: AppraisalCharacteristic, idx: number) => (
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
                <td className="c-right c-total-top c-bold">{skillTotal}</td>
              </tr>
            </tbody>
          </table>

          {/* Section 3C : Goals */}
          <table className="prf-tbl prf-sec3c">
            <tbody>
              <tr>
                <td colSpan={3} className="c-bold c-section-head">Section 3C: Goals:</td>
              </tr>
              <tr>
                <td colSpan={3}>Rate the appraisee on the goals mentioned below.</td>
              </tr>
              {ratingScaleRows}
              <tr>
                <td colSpan={2} className="c-dark-header">Goals</td>
                <td className="c-dark-header" style={{ width: "12%" }}>Rating</td>
              </tr>
              {goals.length === 0
                ? Array.from({ length: 4 }).map((_, idx: number) => (
                    <tr key={`goal-empty-${idx}`}>
                      <td className="c-center" style={{ width: "5%" }}>{idx + 1}</td>
                      <td>&nbsp;</td>
                      <td className="c-center">&nbsp;</td>
                    </tr>
                  ))
                : goals.map((c: AppraisalCharacteristic, idx: number) => (
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
                <td className="c-right c-total-top c-bold">{goalTotal}</td>
              </tr>
            </tbody>
          </table>

          {/* Section 4 : Overall Rating (Goals ke niche — final rating) */}
          <table className="prf-tbl prf-sec4">
            <tbody>
              <tr>
                <td colSpan={3} className="c-bold c-section-head">Section 4: Overall Rating</td>
              </tr>
              <tr>
                <td className="c-dark-header" style={{ width: "60%" }}>Component</td>
                <td className="c-dark-header" style={{ width: "20%" }}>Weightage</td>
                <td className="c-dark-header" style={{ width: "20%" }}>Score</td>
              </tr>
              <tr>
                <td>Task Score</td>
                <td className="c-center">70%</td>
                <td className="c-center">{totalScoreDisplay || "0.00"}</td>
              </tr>
              <tr>
                <td>Character Score</td>
                <td className="c-center">10%</td>
                <td className="c-center">{charTotal || "0.00"}</td>
              </tr>
              <tr>
                <td>Goal Score</td>
                <td className="c-center">10%</td>
                <td className="c-center">{goalTotal || "0.00"}</td>
              </tr>
              <tr>
                <td>Skill Score</td>
                <td className="c-center">10%</td>
                <td className="c-center">{skillTotal || "0.00"}</td>
              </tr>
              <tr>
                <td className="c-bold c-total-top">Final Rating</td>
                <td className="c-total-top-blank">&nbsp;</td>
                <td className="c-center c-bold c-total-top">{finalRating || "0.00"}</td>
              </tr>
            </tbody>
          </table>

          {/* Section 5 */}
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
                  const comment = commentForLevel(commentLog, level, "APPRAISER");
                  const appraiseeComment = commentForLevel(commentLog, 0, "APPRAISEE");
                  const isEmployeeSelfRow =
                    level === 0 && f.ACTION_BY === appraisal.EMPLOYEE_CODE;

                  return (
                    <tr key={f.HISTORY_ID ?? idx}>
                      <td style={{ verticalAlign: "top", padding: "5px 6px", textAlign: "center", fontWeight: 700, fontSize: "8px" }}>
                        {idx + 1}
                      </td>
                      <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                        <div style={{ fontWeight: 700, fontSize: "8.5px", color: "#000" }}>
                          {f.ACTION_BY_NAME || f.ACTION_BY || "—"}
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
                        {comment ? <span className="c-comment-text">{comment}</span> : <span>&nbsp;</span>}
                      </td>
                      <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                        {(isEmployeeSelfRow || f.ACTION_BY === appraisal.EMPLOYEE_CODE) && appraiseeComment
                          ? <span className="c-comment-text">{appraiseeComment}</span>
                          : <span>&nbsp;</span>}
                      </td>
                      <td style={{ verticalAlign: "top", padding: "5px 6px", height: "40px" }}>
                        <div style={{ borderBottom: "1px solid #000", height: "20px", marginBottom: "4px" }} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Signatures (Section 6 ki jagah) */}
          <table className="prf-tbl prf-sec6">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "50%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "22%" }} />
            </colgroup>
            <tbody>
              <tr style={{ height: "26px" }}>
                <td className="c-bold">Appraisee Name &amp; Signature</td>
                <td>&nbsp;</td>
                <td className="c-bold">Date:</td>
                <td>&nbsp;</td>
              </tr>
              <tr style={{ height: "26px" }}>
                <td className="c-bold">Appraiser Name &amp; Signature</td>
                <td>&nbsp;</td>
                <td className="c-bold">Date:</td>
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

/* ─────────────────────────── Main component ─────────────────────────── */

const PerformanceReportDesign: React.FC<Props> = ({
  required_values,
  printRef,
  onReady,
  onClose,
}) => {
  const { user } = useAuth();
  const { doc_no, employee_code, company_code = COMPANY_CODE } = required_values;
  const loginid = user?.loginid ?? user?.username ?? "";

  const reportRef = useRef<HTMLDivElement>(null);

  /* Keep latest callbacks in refs so parent re-renders don't re-trigger effects */
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasOpenedRef = useRef(false);

  const combinedRef = (node: HTMLDivElement | null) => {
    (reportRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (printRef) {
      (printRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };
  void combinedRef; // kept for parity with original (unused)

  const [flowHistory, setFlowHistory] = useState<AppraisalFlowHistory[]>([]);
  const [appraisalData, setAppraisalData] = useState<Record<string, unknown>[]>([]);
  const [ratingsData, setRatingsData] = useState<Record<string, unknown>[]>([]);
  const [taskData, setTaskData] = useState<AppraisalTaskDtl[]>([]);
  const [characteristicsData, setCharacteristics] = useState<AppraisalCharacteristic[]>([]);
  const [skillsData, setSkills] = useState<AppraisalCharacteristic[]>([]);
  const [goalsData, setGoals] = useState<AppraisalCharacteristic[]>([]);
  const [commentLog, setCommentLog] = useState<AppraisalCommentLogRow[]>([]);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>(FALLBACK_LOGOS[company_code] ?? "");
  const [deptHeadDate, setDeptHeadDate] = useState<string>("");

  const [section5Data, setSection5Data] = useState<AppraisalSection5>({
    APPRAISER_COMMENTS: "",
    APPRAISEE_COMMENTS: "",
    LAST_ACTION_BY: "",
    LAST_ACTION_BY_NAME: "",
    COMMENTS_DATE: "",
    APPRAISEE_COMMENTS_DATE: "",
  });

  const [isFetching, setIsFetching] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  /* fetch company logo (fallback already set from FALLBACK_LOGOS) */
  useEffect(() => {
    if (!loginid || !company_code) return;
    let cancelled = false;
    pamsSelect<Record<string, unknown>>({
      parameter: "MS_COMPANY_SELECT", // rename if backend param name differs
      loginid,
      code1: company_code,
    })
      .then((res) => {
        if (cancelled) return;
        const row = res?.[0] ?? {};
        const url = String(
          row["COMPANY_LOGO_AWSURL"] ??
            row["company_logo_awsurl"] ??
            row["COMPANY_LOGO"] ??
            row["company_logo"] ??
            ""
        ).trim();
        if (url) setCompanyLogoUrl(url);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [loginid, company_code]);

  useEffect(() => {
    if (!loginid || !doc_no || !employee_code) return;

    setIsFetching(true);
    hasOpenedRef.current = false;

    Promise.all([
      pamsSelect({
        parameter: "PERFORMANCE_REPORT_EMP_APPRAISAL_PART1_SELECT_BY_DOC_EMP",
        loginid,
        code1: doc_no,
        code2: employee_code,
      }),
      pamsSelect({
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
      // skills
      pamsSelect<AppraisalCharacteristic>({
        parameter: "Trn_skill", // rename if backend param name differs
        loginid,
        code1: company_code,
        code2: doc_no,
        code3: employee_code,
      }).catch(() => [] as AppraisalCharacteristic[]),
      // goals
      pamsSelect<AppraisalCharacteristic>({
        parameter: "Trn_goal", // rename if backend param name differs
        loginid,
        code1: company_code,
        code2: doc_no,
        code3: employee_code,
      }).catch(() => [] as AppraisalCharacteristic[]),
      pamsSelect<AppraisalFlowHistory>({
        parameter: "get_appraisal_flow_with_name",
        loginid,
        code1: doc_no,
      }),
      pamsSelect<AppraisalCommentLogRow>({
        parameter: "get_appraisal_comments_log",
        loginid,
        code1: doc_no,
      }),
      pamsSelect<Record<string, unknown>>({
        parameter: "appraisal_comments",
        loginid,
        code1: doc_no,
      }),
    ])
      .then(
        ([
          appraisal,
          ratings,
          tasks,
          chars,
          skillsRows,
          goalsRows,
          flowHist,
          commentLogRows,
          hdrComments,
        ]) => {
          setAppraisalData(appraisal as Record<string, unknown>[]);
          setRatingsData(ratings as Record<string, unknown>[]);

          const seen = new Set<number>();
          const uniqueFlow = (flowHist as AppraisalFlowHistory[]).filter((f) => {
            const level = Number(f.FLOW_LEVEL);
            if (level < 0 || level > 5) return false;
            if (seen.has(level)) return false;
            seen.add(level);
            return true;
          });
          setFlowHistory(uniqueFlow);

          // Dept Head ne jis din submit/approve kiya, wo date
          const dhName = String(
            get(
              ((appraisal as Record<string, unknown>[])[0] ?? {}) as Record<string, unknown>,
              "DEPT_HEAD_NAME",
              "dept_head_name"
            )
          )
            .trim()
            .toUpperCase();

          const dhRows = (flowHist as AppraisalFlowHistory[]).filter(
            (f) =>
              f.ACTION_DATE &&
              String(f.ACTION_BY_NAME ?? "").trim().toUpperCase() === dhName
          );
          const dhSubmit = dhRows.filter((f) =>
            /SUBMIT|APPROV/i.test(String(f.ACTION ?? ""))
          );
          const dhPick = [...(dhSubmit.length ? dhSubmit : dhRows)].sort(
            (a, b) =>
              new Date(b.ACTION_DATE).getTime() - new Date(a.ACTION_DATE).getTime()
          )[0];
          setDeptHeadDate(dhPick?.ACTION_DATE ?? "");

          setCommentLog(commentLogRows as AppraisalCommentLogRow[]);

          const sortedTasks = [...(tasks as AppraisalTaskDtl[])].sort(
            (a, b) => Number(a.KPI_CODE) - Number(b.KPI_CODE)
          );
          setTaskData(sortedTasks);

          const sortByCode = (arr: AppraisalCharacteristic[]) =>
            [...arr].sort((a, b) => Number(a.KPI_CODE) - Number(b.KPI_CODE));

          setCharacteristics(sortByCode(chars as AppraisalCharacteristic[]));
          setSkills(sortByCode(skillsRows as AppraisalCharacteristic[]));
          setGoals(sortByCode(goalsRows as AppraisalCharacteristic[]));

          const hdrRow = (hdrComments as Record<string, unknown>[])?.[0] ?? {};
          setSection5Data({
            APPRAISER_COMMENTS: String(
              hdrRow["APPRAISER_COMMENTS"] ?? hdrRow["appraiser_comments"] ?? ""
            ),
            APPRAISEE_COMMENTS: String(
              hdrRow["APPRAISEE_COMMENTS"] ?? hdrRow["appraisee_comments"] ?? ""
            ),
            LAST_ACTION_BY: String(hdrRow["LAST_ACTION_BY"] ?? ""),
            LAST_ACTION_BY_NAME: String(hdrRow["LAST_ACTION_BY_NAME"] ?? ""),
            COMMENTS_DATE: String(hdrRow["COMMENTS_DATE"] ?? hdrRow["comments_date"] ?? ""),
            APPRAISEE_COMMENTS_DATE: String(
              hdrRow["APPRAISEE_COMMENTS_DATE"] ?? hdrRow["appraisee_comments_date"] ?? ""
            ),
          });
        }
      )
      .catch(() => {
        setAppraisalData([]);
        setRatingsData([]);
        setTaskData([]);
        setCharacteristics([]);
        setSkills([]);
        setGoals([]);
        setDeptHeadDate("");
        onReadyRef.current?.(false);
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

  const avg = (rows: AppraisalCharacteristic[]) =>
    rows.length > 0
      ? rows.reduce((s, c) => s + Number(c.RATING ?? 0), 0) / rows.length
      : 0;

  const charTotalNum = avg(characteristicsData);
  const skillTotalNum = avg(skillsData);
  const goalTotalNum = avg(goalsData);

  const charTotal = charTotalNum > 0 ? charTotalNum.toFixed(2) : "";
  const skillTotal = skillTotalNum > 0 ? skillTotalNum.toFixed(2) : "";
  const goalTotal = goalTotalNum > 0 ? goalTotalNum.toFixed(2) : "";

  // Final Rating = Task 70% + Character 10% + Goal 10% + Skill 10%
  const finalRatingNum =
    totalScore * 0.7 +
    charTotalNum * 0.1 +
    goalTotalNum * 0.1 +
    skillTotalNum * 0.1;
  const finalRating = finalRatingNum > 0 ? finalRatingNum.toFixed(2) : "";

  /* Build report HTML string for NewReportDialog */
  const htmlContent = useMemo(() => {
    if (!appraisal) return "";
    try {
      return renderToStaticMarkup(
        <ReportContent
          appraisal={appraisal}
          ratings={ratings}
          groupedKpis={groupedKpis}
          characteristics={characteristicsData}
          skills={skillsData}
          goals={goalsData}
          totalWeightageDisplay={totalWeightageDisplay}
          totalScoreDisplay={totalScoreDisplay}
          charTotal={charTotal}
          skillTotal={skillTotal}
          goalTotal={goalTotal}
          finalRating={finalRating}
          deptHeadDate={deptHeadDate}
          section5={section5Data}
          flowHistory={flowHistory}
          commentLog={commentLog}
          companyLogoUrl={companyLogoUrl}
        />
      );
    } catch {
      return "";
    }
  }, [
    appraisal,
    ratings,
    groupedKpis,
    characteristicsData,
    skillsData,
    goalsData,
    totalWeightageDisplay,
    totalScoreDisplay,
    charTotal,
    skillTotal,
    goalTotal,
    finalRating,
    deptHeadDate,
    section5Data,
    flowHistory,
    commentLog,
    companyLogoUrl,
  ]);

  /* Open dialog once, only when content is fully ready */
  useEffect(() => {
    if (isFetching || !appraisal || !htmlContent) return;
    if (hasOpenedRef.current) return;
    const id = requestAnimationFrame(() => {
      hasOpenedRef.current = true;
      setDialogOpen(true);
      onReadyRef.current?.(true);
    });
    return () => cancelAnimationFrame(id);
  }, [isFetching, appraisal, htmlContent]);

  if (isFetching || !appraisal || !htmlContent || !dialogOpen) return null;

  return (
    <NewReportDialog
      open={dialogOpen}
      onClose={() => {
        setDialogOpen(false);
        onCloseRef.current?.();
      }}
      title={`Performance Report — ${doc_no}`}
      htmlContent={htmlContent}
    />
  );
};

PerformanceReportDesign.displayName = "PerformanceReportDesign";
export default PerformanceReportDesign;