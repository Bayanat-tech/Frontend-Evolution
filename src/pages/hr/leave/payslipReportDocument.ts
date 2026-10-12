import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { FreightReportDocument } from "../../../components/freight/reportPreviewStore";
import { ReportIdentity } from "../../../components/freight/freightReportDocument";
import { fontVfs } from "../../../components/finance/reports/financeReportDocument";


type LV = { label: string; value: string };

const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();

function readLV(el: Element): LV | null {
  const spans = el.querySelectorAll(":scope > span");
  if (spans.length < 2) return null;
  return { label: clean(spans[0].textContent), value: clean(spans[1].textContent).replace(/^:\s*/, "") };
}
const isLV = (x: LV | null): x is LV => !!x;

// Reads the styled payslip HTML returned by the backend
export function parsePayslipHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector("#payslip-content") ?? doc.body;
  if (!root) throw new Error("No data found");
  const paragraphs = Array.from(root.querySelectorAll("p"));

  const title = clean(root.querySelector("p")?.textContent); // "P a y s l i p ( Division : 10 )"
  const divisionCode = title.match(/Division\s*:\s*([^\s)]+)/i)?.[1] ?? "";

  const [left = [], right = []] = Array.from(root.querySelectorAll(".payslip-info-grid > div"))
    .map((col) => Array.from(col.children).map(readLV).filter(isLV));

  const tables = Array.from(root.querySelectorAll("table"));
  const payRows = Array.from(tables[0]?.rows ?? []).map((r) => Array.from(r.cells).map((c) => clean(c.textContent)));
  const currency = payRows[1]?.[0] ?? "";
  const fourCol = payRows.filter((r) => r.length === 4);
  const totals = fourCol.pop() ?? ["Gross Earnings", "0.000", "Gross Deductions", "0.000"];
  const lines = fourCol; // [earnDesc, earnAmt, dedDesc, dedAmt]

  const total = clean(paragraphs.find((p) => /^Total Paid Salary/i.test(clean(p.textContent)))?.textContent);
  const attendance = Array.from(tables[1]?.rows ?? [])
    .map((r) => Array.from(r.cells).map((c) => clean(c.textContent)))
    .filter((r) => r.length === 2);

  const expiryBox = paragraphs.find((p) => clean(p.textContent) === "Expiry Details")?.parentElement;
  const expiry = expiryBox ? Array.from(expiryBox.children).map(readLV).filter(isLV) : [];

  return { divisionCode, left, right, currency, lines, totals, total, attendance, expiry, logoSrc: root.querySelector("img")?.getAttribute("src") || "" };
}

async function toDataUri(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Logo unavailable");
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Unable to load payslip logo", error);
    return undefined;
  }
}

const BLACK = "#000000";
const GREY = "#d1d5db";
const plain = {
  hLineWidth: () => 0, vLineWidth: () => 0,
  paddingLeft: () => 0, paddingRight: () => 4, paddingTop: () => 1.5, paddingBottom: () => 1.5,
};

export async function buildPayslipPdfDefinition(report: FreightReportDocument, identity: ReportIdentity): Promise<TDocumentDefinitions> {
  const p = parsePayslipHtml(report.html);
  const logo = await toDataUri(report.company?.logo || p.logoSrc);

  const topRule: Content = {
    table: { widths: ["*"], body: [[{ text: "", fontSize: 1 }]] },
    layout: { ...plain, hLineWidth: (i: number) => (i === 0 ? 2 : 0), hLineColor: () => BLACK },
    margin: [0, 2, 0, 6],
  };

  const title: Content = {
    table: { widths: ["*"], body: [[{ text: `Payslip ( Division : ${p.divisionCode} )`, bold: true, fontSize: 11, characterSpacing: 3 }]] },
    layout: { ...plain, hLineWidth: (i: number) => (i === 1 ? 0.5 : 0), hLineColor: () => GREY, paddingBottom: () => 5 },
    margin: [0, 0, 0, 10],
  };

  const infoCount = Math.max(p.left.length, p.right.length);
  const info: Content = {
    table: {
      widths: [82, "*", 82, "*"],
      body: Array.from({ length: infoCount }, (_, i): TableCell[] => [
        { text: p.left[i]?.label ?? "", bold: true }, { text: p.left[i] ? `: ${p.left[i].value}` : "" },
        { text: p.right[i]?.label ?? "", bold: true }, { text: p.right[i] ? `: ${p.right[i].value}` : "" },
      ]),
    },
    layout: plain,
    margin: [0, 0, 0, 10],
  };

  const payRows: TableCell[][] = [
    [{ text: "Earnings", colSpan: 2, alignment: "center", bold: true, fontSize: 9.5 }, {}, { text: "Deductions", colSpan: 2, alignment: "center", bold: true, fontSize: 9.5 }, {}],
    [{ text: p.currency, colSpan: 2, bold: true, color: "#555555", fontSize: 8 }, {}, { text: "", colSpan: 2 }, {}],
    ...p.lines.map((r): TableCell[] => [
      { text: r[0] }, { text: r[1], alignment: "right" }, { text: r[2] }, { text: r[3], alignment: "right" },
    ]),
    [
        { text: "", margin: [0, 28, 0, 28] },
        { text: "", margin: [0, 28, 0, 28] },
        { text: "", margin: [0, 28, 0, 28] },
        { text: "", margin: [0, 28, 0, 28] },
    ],
    [
      { text: p.totals[0], bold: true }, { text: p.totals[1], bold: true, alignment: "right" },
      { text: p.totals[2], bold: true }, { text: p.totals[3], bold: true, alignment: "right" },
    ],
  ];
  const payBox: Content = {
    table: { widths: ["*", 80, "*", 80], body: payRows },
    layout: {
      hLineWidth: (i: number, node: any) => (i <= 2 || i >= node.table.body.length - 1 ? 0.75 : 0),
      vLineWidth: (i: number) => (i === 0 || i === 2 || i === 4 ? 0.75 : 0),
      hLineColor: () => BLACK, vLineColor: () => BLACK,
      paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 2, paddingBottom: () => 2,
    },
  };

  const totalBar: Content = {
    table: {
      widths: ["*", "auto"],
      body: [[
        { text: "  ", fontSize: 7.5, color: "#555555" },
        { text: p.total, bold: true, fontSize: 9.5 },
      ]],
    },
    layout: {
      hLineWidth: (i: number) => (i === 1 ? 0.75 : 0),
      vLineWidth: (i: number) => (i === 1 ? 0 : 0.75),
      hLineColor: () => BLACK, vLineColor: () => BLACK,
      paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 4, paddingBottom: () => 4,
    },
  };

  const attendance: Content = p.attendance.length
    ? {
        table: {
          widths: ["*", 40],
          body: p.attendance.map((r): TableCell[] => [{ text: r[0], fontSize: 8 }, { text: r[1], alignment: "right", bold: true, fontSize: 8 }]),
        },
        layout: plain,
      }
    : { text: "No attendance data available", fontSize: 7.5, color: "#9ca3af" };

  const expiry: Content = {
    table: {
      widths: ["*"],
      body: [[{
        table: {
          widths: [58, "*"],
          body: [
            [{ text: "Expiry Details", bold: true, colSpan: 2, fontSize: 8 }, {}],
            ...p.expiry.map((e): TableCell[] => [{ text: e.label, bold: true }, { text: `: ${e.value}` }]),
          ],
        },
        layout: plain,
      }]],
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => GREY, vLineColor: () => GREY,
      paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 4, paddingBottom: () => 4,
    },
  };

  const attendanceBox: Content = {
    table: {
      widths: ["*"],
      body: [
        [{ text: "Attendance Details", bold: true, fontSize: 8.5 }],
        [{ columns: [{ width: "*", stack: [attendance] }, { width: 200, stack: [expiry] }], columnGap: 20 }],
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
      vLineWidth: () => 0.5, hLineColor: () => GREY, vLineColor: () => GREY,
      paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 4, paddingBottom: () => 6,
    },
  };
  const landscape = (report.orientation || "portrait") === "landscape";
  const pageWidth = landscape ? 841.89 : 595.28;

  return {
    info: { title: identity.title, author: identity.company, subject: "Payslip" },
    pageSize: "A4",
    pageOrientation: report.orientation || "portrait",
    pageMargins: [28, 28, 28, 44],
    defaultStyle: { font: "Inter", fontSize: 8.5, color: BLACK, lineHeight: 1.15 },
    footer: (page: number, count: number) => ({
      margin: [28, 4, 28, 0], fontSize: 6.5, color: "#64748b",
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: pageWidth - 56, y2: 0, lineWidth: 0.5, lineColor: "#cbd5e1" }], margin: [0, 0, 0, 5] },
        { columns: [
          { text: "Print: " + identity.generatedAt + " | User: " + identity.user },
          { text: "Report: " + identity.title + " | Powered by Bayanat Technology", alignment: "right" },
        ] },
        { text: "Page " + page + " of " + count, alignment: "right", margin: [0, 3, 0, 0] },
      ],
    }),
    content: [
      logo ? { image: logo, fit: [155, 58] } : { text: "", margin: [0, 0, 0, 50] },
      topRule, title, info, payBox, totalBar, attendanceBox,
    ],
  };
}

export async function createPayslipPdf(report: FreightReportDocument, identity: ReportIdentity) {
  const [{ default: pdfMake }, definition, vfs] = await Promise.all([
    import("pdfmake/build/pdfmake.js"), buildPayslipPdfDefinition(report, identity), fontVfs(),
  ]);
  const fonts = { Inter: { normal: "Inter-Regular.ttf", bold: "Inter-Bold.ttf", italics: "Inter-Regular.ttf", bolditalics: "Inter-Bold.ttf" } };
  return new Promise<Blob>((resolve, reject) => {
    try { (pdfMake as any).createPdf(definition, {}, fonts, vfs).getBlob(resolve); }
    catch (error) { reject(error); }
  });
}