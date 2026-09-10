import type { TDocumentDefinitions, Content, StyleDictionary } from "pdfmake/interfaces";
import { api } from "../../../api/client";
import type { WmsReportDocument } from "./wmsReportPreviewStore";

export type ReportIdentity = { title: string; company: string; user: string; generatedAt: string };
export const reportFilename = (title: string) => title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim() || "WMS report";

// Duplicated from Freight's report-document pipeline (not imported) so this
// module has no dependency on the Freight feature folder. Generic HTML
// cleanup — nothing here is Freight-specific.
export function prepareReportHtml(html: string, browserWindow: Window = window) {
  const parser = new (browserWindow as Window & typeof globalThis).DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,link,button,iframe,object,.viewerbar,.print-toolbar,.logo,.footer").forEach((el) => el.remove());
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

export async function buildWmsPdfDefinition(report: WmsReportDocument, identity: ReportIdentity, browserWindow: Window = window): Promise<TDocumentDefinitions> {
  const { default: htmlToPdfmake } = await import("html-to-pdfmake");
  const prepared = prepareReportHtml(report.html, browserWindow);
  const content = htmlToPdfmake(prepared.html, {
    window: browserWindow,
    defaultStyles: {
      h1: { fontSize: 14, bold: true, color: "#00378c", marginBottom: 6 },
      h2: { fontSize: 11, bold: true, marginBottom: 4 },
      h3: { fontSize: 9.5, bold: true, marginBottom: 3 },
      p: { margin: [0, 1, 0, 3] },
      td: { margin: [2, 2, 2, 2] },
      th: { bold: true, margin: [2, 3, 2, 3] },
      table: { margin: [0, 3, 0, 6] },
    },
  }) as Content;
  const styles: StyleDictionary = {
    num: { alignment: "right" }, right: { alignment: "right" }, center: { alignment: "center" },
    "primary-text": { bold: true, color: "#00378c" },
    "group-title": { bold: true, fontSize: 11, color: "#00378c", margin: [0, 8, 0, 3] },
    title: { fontSize: 14, bold: true, color: "#00378c", margin: [0, 0, 0, 4] },
    label: { bold: true, color: "#475569" }, sub: { color: "#64748b", margin: [0, 0, 0, 5] },
    signature: { margin: [0, 14, 0, 0], alignment: "right" },
    empty: { margin: [0, 12, 0, 12], alignment: "center", color: "#64748b" },
  };
  return {
    info: { title: identity.title, author: identity.company, subject: "WMS report" },
    pageSize: prepared.maxColumns > 14 ? "A3" : "A4",
    pageOrientation: report.orientation || (prepared.maxColumns > 7 ? "landscape" : "portrait"),
    pageMargins: [28, 48, 28, 32],
    defaultStyle: { font: "Inter", fontSize: prepared.maxColumns > 14 ? 6.5 : 7.5, color: "#172033", lineHeight: 1.05 },
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

export async function createWmsPdf(report: WmsReportDocument, identity: ReportIdentity) {
  const [{ default: pdfMake }, definition, vfs] = await Promise.all([
    import("pdfmake/build/pdfmake"), buildWmsPdfDefinition(report, identity), fontVfs(),
  ]);
  const fonts = { Inter: { normal: "Inter-Regular.ttf", bold: "Inter-Bold.ttf", italics: "Inter-Regular.ttf", bolditalics: "Inter-Bold.ttf" } };
  return new Promise<Blob>((resolve, reject) => {
    try { pdfMake.createPdf(definition, undefined, fonts, vfs).getBlob(resolve); }
    catch (error) { reject(error); }
  });
}

// Unlike Freight, this does NOT derive an .xlsx from the rendered HTML client-side.
// Stock Summary already has a working backend export; this just calls it.
export async function downloadWmsExcel(report: WmsReportDocument, identity: ReportIdentity) {
  if (!report.excelEndpoint) throw new Error("Excel export is not available for this report.");
  const response = await api.post(report.excelEndpoint, report.excelPayload ?? {}, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reportFilename(report.filename || identity.title)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}