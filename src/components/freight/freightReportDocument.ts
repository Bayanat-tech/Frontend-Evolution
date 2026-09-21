import type { TDocumentDefinitions, Content, StyleDictionary } from "pdfmake/interfaces";
import type { FreightReportDocument } from "./reportPreviewStore";

export type ReportIdentity = { title: string; company: string; user: string; generatedAt: string };
export const reportFilename = (title: string) => title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim() || "Freight report";

export function prepareReportHtml(html: string, browserWindow: Window = window) {
  const parser = new (browserWindow as Window & typeof globalThis).DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,link,button,iframe,object,.viewerbar,.print-toolbar,.logo,.footer").forEach((el) => el.remove());
  // Page numbering is supplied by PDFMake, not the old HTML's fixed '1 of 1'.
  doc.querySelectorAll(".meta > div").forEach((el) => { if (/^Page:/i.test(el.textContent?.trim() || "")) el.remove(); });
  doc.querySelectorAll("img").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attribute of Array.from(el.attributes)) {
      if (attribute.name.startsWith("on") || ["style", "width", "height", "data-pdfmake"].includes(attribute.name)) el.removeAttribute(attribute.name);
    }
  });
  doc.querySelectorAll(".field .label").forEach((label) => { label.textContent = `${label.textContent?.trim().replace(/:$/, "")}: `; });
  doc.querySelectorAll(".party-block .label").forEach((label) => label.after(doc.createElement("br")));
  for (const grid of Array.from(doc.querySelectorAll(".party-grid,.info-grid,.params,.top-row"))) {
    const children = Array.from(grid.children);
    if (!children.length) continue;
    const table = doc.createElement("table");
    table.className = "report-details-table";
    const row = table.insertRow();
    children.forEach((child) => { row.insertCell().append(child); });
    grid.replaceWith(table);
  }
  let maxColumns = 0;
  doc.querySelectorAll("table").forEach((table) => {
    const columns = Math.max(1, ...Array.from(table.rows).map((row) => Array.from(row.cells).reduce((sum, cell) => sum + cell.colSpan, 0)));
    const details = table.classList.contains("report-details-table");
    if (!details) maxColumns = Math.max(maxColumns, columns);
    table.setAttribute("data-pdfmake", JSON.stringify({
      widths: Array(columns).fill("*"),
      headerRows: table.tHead?.rows.length || (table.rows[0]?.querySelector("th") ? 1 : 0),
      layout: details ? "noBorders" : "lightHorizontalLines",
    }));
    table.querySelectorAll("th").forEach((cell) => { cell.style.backgroundColor = "#eaf0f8"; cell.style.color = "#00378c"; });
  });
  return { doc, html: doc.body.innerHTML, maxColumns };
}

export async function buildFreightPdfDefinition(report: FreightReportDocument, identity: ReportIdentity, browserWindow: Window = window): Promise<TDocumentDefinitions> {
  const { default: htmlToPdfmake } = await import("html-to-pdfmake");
  const prepared = prepareReportHtml(report.html, browserWindow);
  const content = htmlToPdfmake(prepared.html, {
    // html-to-pdfmake supports browsers; its declarations only name JSDOM.
    window: browserWindow as unknown as import("jsdom").DOMWindow,
    defaultStyles: {
      h1: { fontSize: 13, bold: true, color: "#00378c", marginBottom: 5 },
      h2: { fontSize: 10, bold: true, marginBottom: 3 },
      h3: { fontSize: 9, bold: true, marginBottom: 2 },
      p: { margin: [0, 1, 0, 3] },
      td: { margin: [2, 1, 2, 1] },
      th: { bold: true, margin: [2, 1.5, 2, 1.5] },
      table: { margin: [0, 2, 0, 5] },
    },
  }) as Content;
  const styles: StyleDictionary = {
    num: { alignment: "right" }, right: { alignment: "right" }, center: { alignment: "center" },
    "primary-text": { bold: true, color: "#00378c" },
    "group-title": { bold: true, fontSize: 10, color: "#00378c", margin: [0, 6, 0, 2] },
    title: { fontSize: 13, bold: true, color: "#00378c", margin: [0, 0, 0, 3] },
    label: { bold: true, color: "#475569" }, sub: { color: "#64748b", margin: [0, 0, 0, 5] },
    signature: { margin: [0, 14, 0, 0], alignment: "right" },
    empty: { margin: [0, 12, 0, 12], alignment: "center", color: "#64748b" },
  };
  return {
    info: { title: identity.title, author: identity.company, subject: "Freight report" },
    pageSize: prepared.maxColumns > 14 ? "A3" : "A4",
    pageOrientation: report.orientation || (prepared.maxColumns > 7 ? "landscape" : "portrait"),
    pageMargins: [28, 48, 28, 32],
    defaultStyle: { font: "Inter", fontSize: prepared.maxColumns > 14 ? 6.5 : 7.5, color: "#1a1a2e", lineHeight: 1 },
    styles,
    header: {
      margin: [28, 14, 28, 0],
      columns: [
        { text: identity.company, color: "#00378c", bold: true, fontSize: 10 },
        { text: identity.title, alignment: "right", color: "#64748b", fontSize: 8 },
      ],
    },
    footer: (page, count) => ({
      margin: [28, 8, 28, 0], fontSize: 6.5, color: "#64748b",
      columns: [
        { text: `${identity.user} | ${identity.generatedAt}` },
        { text: `Page ${page} of ${count}`, alignment: "right", width: 90 },
      ],
    }),
    content,
  };
}

let fontPromise: Promise<Record<string, string>> | undefined;
async function fontVfs() {
  fontPromise ??= Promise.all(["Regular", "Bold"].map(async (weight) => {
    const name = `Inter-${weight}.ttf`;
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/reports/${name}`);
    if (!response.ok) throw new Error("Unable to load report fonts. Please retry.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return [name, btoa(binary)] as const;
  })).then(Object.fromEntries).catch((error) => { fontPromise = undefined; throw error; });
  return fontPromise;
}

export async function createFreightPdf(report: FreightReportDocument, identity: ReportIdentity) {
  const [{ default: pdfMake }, definition, vfs] = await Promise.all([
    import("pdfmake/build/pdfmake.js"), buildFreightPdfDefinition(report, identity), fontVfs(),
  ]);
  const fonts = { Inter: { normal: "Inter-Regular.ttf", bold: "Inter-Bold.ttf", italics: "Inter-Regular.ttf", bolditalics: "Inter-Bold.ttf" } };
  return new Promise<Blob>((resolve, reject) => {
    try { pdfMake.createPdf(definition, undefined, fonts, vfs).getBlob(resolve); }
    catch (error) { reject(error); }
  });
}

export async function downloadFreightExcel(report: FreightReportDocument, identity: ReportIdentity) {
  const XLSX = await import("xlsx-js-style");
  const { doc } = prepareReportHtml(report.html);
  const workbook = XLSX.utils.book_new();
  const styles = {
    title: { font: { name: "Inter", sz: 14, bold: true, color: { rgb: "00378C" } }, alignment: { vertical: "center" } },
    label: { font: { name: "Inter", sz: 10, bold: true, color: { rgb: "374151" } }, fill: { fgColor: { rgb: "F1F5F9" } } },
    header: { font: { name: "Inter", sz: 10, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "00378C" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } },
    body: { font: { name: "Inter", sz: 10, color: { rgb: "1A1A2E" } }, alignment: { vertical: "center" } },
    number: { font: { name: "Inter", sz: 10, color: { rgb: "1A1A2E" } }, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0.00;[Red]-#,##0.00" },
  };
  const summaryRows = [
    [identity.title],
    ["Company", identity.company],
    ["Generated by", identity.user],
    ["Generated at", identity.generatedAt],
    [],
    ["Report sections", doc.querySelectorAll("table:not(.report-details-table)").length],
  ];
  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary["!cols"] = [{ wch: 24 }, { wch: 70 }];
  summary["!rows"] = [{ hpt: 24 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 8 }, { hpt: 20 }];
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  summary["A1"].s = styles.title;
  for (const row of [1, 2, 3]) {
    summary[`A${row + 1}`].s = styles.label;
    summary[`B${row + 1}`].s = styles.body;
  }
  summary["A6"].s = styles.label;
  summary["B6"].s = styles.body;
  XLSX.utils.book_append_sheet(workbook, summary, "Report summary");

  Array.from(doc.querySelectorAll("table")).filter((table) => !table.classList.contains("report-details-table")).forEach((table, index) => {
    const sheet = XLSX.utils.table_to_sheet(table, { raw: true });
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const widths = Array.from({ length: range.e.c + 1 }, () => ({ wch: 12 }));
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      let maxLength = 10;
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const cell = sheet[address];
        const value = String(cell?.v ?? "");
        maxLength = Math.max(maxLength, Math.min(42, value.length + 2));
        if (cell) {
          cell.s = row === range.s.r
            ? styles.header
            : (/^-?\d[\d,]*(\.\d+)?$/.test(value) ? styles.number : styles.body);
          if (row > range.s.r && cell.s === styles.number) cell.v = Number(value.replace(/,/g, ""));
        }
      }
      widths[column] = { wch: maxLength };
    }
    sheet["!cols"] = widths;
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    sheet["!rows"] = [{ hpt: 30 }];
    XLSX.utils.book_append_sheet(workbook, sheet, `Report ${index + 1}`);
  });
  XLSX.writeFile(workbook, `${reportFilename(report.filename || identity.title)}.xlsx`, { bookType: "xlsx" });
}
