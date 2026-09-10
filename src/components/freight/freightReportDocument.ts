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
    window: browserWindow,
    defaultStyles: {
      h1: { fontSize: 17, bold: true, color: "#00378c", marginBottom: 10 },
      h2: { fontSize: 13, bold: true, marginBottom: 6 },
      h3: { fontSize: 11, bold: true, marginBottom: 5 },
      p: { margin: [0, 2, 0, 5] },
      td: { margin: [3, 3, 3, 3] },
      th: { bold: true, margin: [3, 4, 3, 4] },
      table: { margin: [0, 5, 0, 10] },
    },
  }) as Content;
  const styles: StyleDictionary = {
    num: { alignment: "right" }, right: { alignment: "right" }, center: { alignment: "center" },
    "primary-text": { bold: true, color: "#00378c" },
    "group-title": { bold: true, fontSize: 11, color: "#00378c", margin: [0, 8, 0, 3] },
    title: { fontSize: 17, bold: true, color: "#00378c", margin: [0, 0, 0, 6] },
    label: { bold: true, color: "#475569" }, sub: { color: "#64748b", margin: [0, 0, 0, 8] },
    signature: { margin: [0, 24, 0, 0], alignment: "right" },
    empty: { margin: [0, 20, 0, 20], alignment: "center", color: "#64748b" },
  };
  return {
    info: { title: identity.title, author: identity.company, subject: "Freight report" },
    pageSize: prepared.maxColumns > 14 ? "A3" : "A4",
    pageOrientation: report.orientation || (prepared.maxColumns > 7 ? "landscape" : "portrait"),
    pageMargins: [32, 58, 32, 40],
    defaultStyle: { font: "Inter", fontSize: prepared.maxColumns > 14 ? 7 : 8.5, color: "#172033", lineHeight: 1.15 },
    styles,
    header: {
      margin: [32, 20, 32, 0],
      columns: [
        { text: identity.company, color: "#00378c", bold: true, fontSize: 12 },
        { text: identity.title, alignment: "right", color: "#64748b", fontSize: 9 },
      ],
    },
    footer: (page, count) => ({
      margin: [32, 10, 32, 0], fontSize: 7, color: "#64748b",
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
    import("pdfmake/build/pdfmake"), buildFreightPdfDefinition(report, identity), fontVfs(),
  ]);
  const fonts = { Inter: { normal: "Inter-Regular.ttf", bold: "Inter-Bold.ttf", italics: "Inter-Regular.ttf", bolditalics: "Inter-Bold.ttf" } };
  return new Promise<Blob>((resolve, reject) => {
    try { pdfMake.createPdf(definition, undefined, fonts, vfs).getBlob(resolve); }
    catch (error) { reject(error); }
  });
}

export async function downloadFreightExcel(report: FreightReportDocument, identity: ReportIdentity) {
  const XLSX = await import("xlsx");
  const { doc } = prepareReportHtml(report.html);
  const workbook = XLSX.utils.book_new();
  const metadata = XLSX.utils.aoa_to_sheet([
    [identity.title], ["Company", identity.company], ["Generated by", identity.user], ["Generated at", identity.generatedAt], [],
    ...Array.from(doc.querySelectorAll(".params,.meta,.top,.top-row,.party-block,.info-grid,.field,.totals,.signature")).map((element) => [element.textContent?.trim() || ""]),
  ]);
  metadata["!cols"] = [{ wch: 30 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(workbook, metadata, "Report details");
  Array.from(doc.querySelectorAll("table")).filter((table) => !table.classList.contains("report-details-table")).forEach((table, index) => {
    table.querySelectorAll("td.num,td.right").forEach((cell) => {
      const value = cell.textContent?.trim().replace(/,/g, "") || "";
      if (/^-?\d+(\.\d+)?$/.test(value)) { cell.setAttribute("data-t", "n"); cell.setAttribute("data-v", value); }
    });
    const sheet = XLSX.utils.table_to_sheet(table, { raw: true });
    XLSX.utils.book_append_sheet(workbook, sheet, `Report ${index + 1}`);
  });
  XLSX.writeFile(workbook, `${reportFilename(report.filename || identity.title)}.xlsx`);
}
