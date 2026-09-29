import type { TDocumentDefinitions, Content, StyleDictionary } from "pdfmake/interfaces";
import { PurchaseReportDocument } from "./PurchaseReportPreviewState";

export type ReportIdentity = { title: string; company: string; user: string; generatedAt: string };
export const reportFilename = (title: string) => title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim() || "Purchase report";

const NUMBER_PATTERN = /^-?\d[\d,]*(?:\.\d+)?$/;

export type PrepareOptions = {
  // true => backend cha header/footer kadhun fakta title + table thev (P&L sarkhya reports sathi)
  stripChrome?: boolean;
};

export type ExtractedCompany = { name: string; address: string[]; logo: string };

export function prepareReportHtml(html: string, browserWindow: Window = window, options: PrepareOptions = {}) {
  const parser = new (browserWindow as Window & typeof globalThis).DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,link,button,iframe,object,.viewerbar,.print-toolbar,.logo,.footer,.doc-title-row .print-meta").forEach((el) => el.remove());
  doc.querySelectorAll(".meta > div").forEach((el) => { if (/^Page:/i.test(el.textContent?.trim() || "")) el.remove(); });

  // report_common.ts (buildReportDocument) sagle reports sathi HTML asa wrap karto:
  //   table.report-shell > thead(.company-header) / tbody(content) / tfoot(.report-footer)
  // Ithun logo/name/address extract kara (backend cha khara data, frontend cha
  // separate lookup peksha jast reliable) ani thead/tfoot body madhun kadha —
  // navhe tar pdfmake cha swataacha header/footer sobat duplicate disतो.
  let extractedCompany: ExtractedCompany | null = null;
  const shell = doc.querySelector("table.report-shell");
  if (shell) {
    const logo = doc.querySelector(".company-logo")?.getAttribute("src") || "";
    const name = doc.querySelector(".company-name")?.textContent?.trim() || "";
    const address = Array.from(doc.querySelectorAll(".company-address-line"))
      .map((el) => el.textContent?.trim() || "")
      .filter(Boolean);
    if (name || logo || address.length) extractedCompany = { name, address, logo };

    const bodyTd = shell.querySelector("tbody > tr > td");
    if (bodyTd) {
      doc.body.replaceChildren(...Array.from(bodyTd.childNodes));
    } else {
      shell.remove();
    }
  }

  doc.querySelectorAll("img").forEach((el) => el.remove());

  // Opt-in: title (.pl-title / .report-title / .doc-title) + fakta table.data-table thev.
  // (report-shell already unwrap zalay, mhanun he aata rarely lagel — purnapane
  // custom body havi asel tarach vapra.)
  if (options.stripChrome) {
    const table = doc.querySelector("table.data-table");
    if (table) {
      const holder = table.closest(".group") || table;
      const wrap = doc.createElement("div");
      const titleText = doc.querySelector(".pl-title, .report-title, .doc-title")?.textContent?.trim();
      if (titleText) {
        const h1 = doc.createElement("h1");
        h1.textContent = titleText;
        wrap.append(h1);
      }
      wrap.append(holder);
      doc.body.replaceChildren(wrap);
    }
  }

  doc.querySelectorAll("*").forEach((el) => {
    for (const attribute of Array.from(el.attributes)) {
      if (attribute.name.startsWith("on") || ["style", "width", "height", "data-pdfmake"].includes(attribute.name)) el.removeAttribute(attribute.name);
    }
  });
  doc.querySelectorAll(".field .label").forEach((label) => { label.textContent = `${label.textContent?.trim().replace(/:$/, "")}: `; });
  doc.querySelectorAll(".party-block .label").forEach((label) => label.after(doc.createElement("br")));

  // Detail report: turn each ".po-group-header" (doc label + supplier + cancelled badge) into a shaded banner
  doc.querySelectorAll(".po-group-header").forEach((header) => {
    const badge = header.querySelector(".status-badge");
    const cancelled = badge ? " (Cancelled)" : "";
    badge?.remove();
    const label = header.querySelector(".doc-label")?.textContent?.trim() || "";
    const supplier = header.querySelector(".supplier-name")?.textContent?.trim() || "";
    const text = [label, supplier + cancelled].filter((part) => part.trim()).join("  |  ");

    const bannerTable = doc.createElement("table");
    bannerTable.className = "group-header-banner";
    bannerTable.setAttribute("data-pdfmake", JSON.stringify({
      widths: ["*"],
      layout: "noBorders",
    }));
    const row = bannerTable.insertRow();
    const cell = row.insertCell();
    cell.style.backgroundColor = "#eaf0f8";
    cell.style.color = "#00378c";
    cell.style.fontWeight = "bold";
    cell.textContent = text;
    header.replaceWith(bannerTable);
  });


  doc.querySelectorAll(".grand-total-box").forEach((box) => {
    const totals = doc.createElement("table");
    totals.className = "grand-total-table";
    box.querySelectorAll(".row").forEach((row) => {
      const spans = row.querySelectorAll("span");
      const tr = totals.insertRow();
      const label = tr.insertCell();
      label.className = "right";
      label.textContent = spans[0]?.textContent?.trim() || "";
      const value = tr.insertCell();
      value.className = "right";
      value.textContent = spans[1]?.textContent?.trim() || "";
    });
    box.replaceWith(totals);
  });

  doc.querySelectorAll(".totals-box").forEach((box) => {
    const totals = doc.createElement("table");
    totals.className = "grand-total-table";
    box.querySelectorAll(".row").forEach((row) => {
      const spans = Array.from(row.children); // <span>label</span><span>value</span>
      const isGrand = row.classList.contains("grand");
      const tr = totals.insertRow();
      const label = tr.insertCell();
      label.className = "right";
      label.textContent = spans[0]?.textContent?.trim() || "";
      const value = tr.insertCell();
      value.className = "right";
      value.textContent = spans[1]?.textContent?.trim() || "";
      if (isGrand) {
        [label, value].forEach((cell) => {
          cell.style.backgroundColor = "#00378c";
          cell.style.color = "#ffffff";
          cell.style.fontWeight = "bold";
        });
      }
    });
    box.replaceWith(totals);
  });

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
    if (table.classList.contains("group-header-banner")) return;
    const isTotals = table.classList.contains("grand-total-table");
    const columns = Math.max(1, ...Array.from(table.rows).map((row) => Array.from(row.cells).reduce((sum, cell) => sum + cell.colSpan, 0)));
    const details = table.classList.contains("report-details-table") || isTotals;
    if (!details) maxColumns = Math.max(maxColumns, columns);

    // Column widths based on header text
    let widths: (string | number)[] = Array(columns).fill("*");
    if (isTotals) {
      widths = ["*", 80];
    } else if (!details && table.rows[0]) {
      const headerCells = Array.from(table.rows[0].cells);
      widths = headerCells.map((cell) => {
        const text = cell.textContent?.trim().toLowerCase() || "";
        // Opt-in (stripChrome) reports: lamb invoice no ani amount columns sathi fixed width
        if (options.stripChrome) {
          if (/^inv(oice)?\s*(no\.?)?$/.test(text)) return 95;
          if (/(value|amount|profit|cost|total|price)/.test(text)) return 68;
        }
        if (/(vat\s*%|tax\s*amount|amount\s*\(inc)/.test(text)) return 62;
        if (/^unit\s*rate$/.test(text)) return 45;
        if (/^amount$/.test(text)) return 55;
        if (/^s\.?no\.?$/.test(text)) return 32;
        if (/^unit$/.test(text)) return 40;


        if (/^(sr\s*no|line|#)$/.test(text)) return 26;
        if (/^uom$/.test(text)) return 34;
        if (/date/.test(text)) return 58;
        if (/^doc(ument)?\s*no\.?$/.test(text)) return 80;
        if (/(qty|quantity|items)/.test(text)) return 64;
        return "*";
      });
      // Ensure at least one column is '*' so the table spans full width
      if (!widths.includes("*") && widths.length > 0) {
        widths[widths.length - 1] = "*";
      }
    }

    table.setAttribute("data-pdfmake", JSON.stringify({
      widths,
      headerRows: table.tHead?.rows.length || (table.rows[0]?.querySelector("th") ? 1 : 0),
      dontBreakRows: true,
      layout: details ? "noBorders" : "biscReportTable",
    }));

    table.querySelectorAll("th").forEach((cell) => {
      cell.style.backgroundColor = "#eaf0f8";
      cell.style.color = "#00378c";
      cell.style.fontWeight = "bold";
    });
    table.querySelectorAll<HTMLElement>(".subtotal-row td, .subtotal-row th").forEach((cell) => {
      cell.style.backgroundColor = "#f1f5f9";
      cell.style.color = "#00378c";
      cell.style.fontWeight = "bold";
    });
    // Section header rows (e.g. customer / group heading)
    table.querySelectorAll<HTMLElement>(".section-row td").forEach((cell) => {
      cell.style.backgroundColor = "#eaf0f8";
      cell.style.color = "#00378c";
      cell.style.fontWeight = "bold";
    });
    // Grand total row inside a data table
    table.querySelectorAll<HTMLElement>(".grand-total td").forEach((cell) => {
      cell.style.backgroundColor = "#e2e8f0";
      cell.style.color = "#00378c";
      cell.style.fontWeight = "bold";
    });
    if (isTotals) {
      table.querySelectorAll<HTMLElement>("td").forEach((cell) => {
        cell.style.backgroundColor = "#e2e8f0";
        cell.style.color = "#00378c";
        cell.style.fontWeight = "bold";
      });
    }
  });

  return { doc, html: doc.body.innerHTML, maxColumns, extractedCompany };
}

export async function buildPurchasePdfDefinition(report: PurchaseReportDocument, identity: ReportIdentity, browserWindow: Window = window): Promise<TDocumentDefinitions> {
  const { default: htmlToPdfmake } = await import("html-to-pdfmake");
  const prepared = prepareReportHtml(report.html, browserWindow, { stripChrome: report.stripChrome });

  // Backend cha HTML madhun mिळालेला company data (.company-header) sagle reports
  // sathi sarvat reliable source ahe — vegळ्या frontend lookup peksha jast trust
  // karayacha, mhanun to pahilyanda vaparaycha. report.company fakta fallback.
  const company = prepared.extractedCompany || report.company;

  let logo: string | undefined;
  if (company?.logo) {
    try {
      const response = await fetch(company.logo);
      if (!response.ok) throw new Error("Company logo unavailable");
      const blob = await response.blob();
      logo = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) { console.warn("Unable to load company report logo", error); }
  }
  const companyName = company?.name || identity.company;
  const address = company?.address || [];
  const branded = Boolean(company);
  const pageOrientation = report.orientation || (prepared.maxColumns > 6 ? "landscape" : "portrait");
  const landscape = pageOrientation === "landscape";
  const pageWidth = prepared.maxColumns > 14 ? (landscape ? 1190.55 : 841.89) : (landscape ? 841.89 : 595.28);
  const content = htmlToPdfmake(prepared.html, {
    // html-to-pdfmake supports browsers; its declarations only name JSDOM.
    window: browserWindow as unknown as import("jsdom").DOMWindow,
    defaultStyles: {
      h1: { fontSize: 13, bold: true, color: "#00378c", marginBottom: 4 },
      h2: { fontSize: 10.5, bold: true, color: "#00378c", marginBottom: 3 },
      h3: { fontSize: 9, bold: true, color: "#00378c", marginBottom: 2 },
      p: { margin: [0, 1, 0, 3] },
      td: { margin: [1, 1.5, 1, 1.5] },
      th: { bold: true, color: "#00378c", fillColor: "#eaf0f8", margin: [1, 2.5, 1, 2.5] },
      table: { margin: [0, 2, 0, 5] },
    },
  }) as Content;
  const styles: StyleDictionary = {
    num: { alignment: "right" }, right: { alignment: "right" }, center: { alignment: "center" },
    "primary-text": { bold: true, color: "#00378c" },
    "group-title": { bold: true, fontSize: 9.5, color: "#00378c", margin: [0, 6, 0, 2] },
    "grand-total-title": { bold: true, fontSize: 10.5, color: "#00378c", margin: [0, 8, 0, 2] },
    title: { fontSize: 13, bold: true, color: "#00378c", margin: [0, 0, 0, 3] },
    "doc-sub": { fontSize: 8.5, color: "#64748b", margin: [0, 0, 0, 6] },
    "subtotal-row": { bold: true, fillColor: "#f1f5f9", color: "#00378c" },
    "grand-total-row": { bold: true, fillColor: "#e2e8f0", color: "#00378c" },
    label: { bold: true, color: "#475569" }, sub: { color: "#64748b", margin: [0, 0, 0, 4] },
    "filter-summary": { fontSize: 8, color: "#475569", margin: [0, 4, 0, 6] },
    signature: { margin: [0, 14, 0, 0], alignment: "right" },
    empty: { margin: [0, 12, 0, 12], alignment: "center", color: "#64748b" },
  };
  return {
    info: { title: identity.title, author: identity.company, subject: "Purchase report" },
    pageSize: prepared.maxColumns > 14 ? "A3" : "A4",
    pageOrientation,
    pageMargins: [28, branded ? 92 : 44, 28, 36],
    defaultStyle: { font: "Inter", fontSize: prepared.maxColumns > 12 ? 7 : (prepared.maxColumns > 8 ? 7.5 : 8.5), color: "#1e293b", lineHeight: 1.15 },
    styles,
    header: {
      margin: [28, 14, 28, 0],
      stack: [
        {
          columns: [
            logo ? { image: logo, fit: [155, 58], width: 170 } : { text: "", width: 170 },
            {
              stack: [
                { text: companyName, bold: true, fontSize: 14, color: "#172033", margin: [0, 0, 0, 4] },
                ...address.map((line) => ({ text: line, fontSize: 8, color: "#64748b", margin: [0, 0, 0, 2] as [number, number, number, number] })),
              ], alignment: "right"
            },
          ]
        },
        { canvas: [{ type: "line", x1: 0, y1: 8, x2: pageWidth - 56, y2: 8, lineWidth: 1.3, lineColor: "#1455a3" }] },
      ],
    },
    footer: (page, count) => ({
      margin: [28, 4, 28, 0], fontSize: 6.5, color: "#64748b",
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: pageWidth - 56, y2: 0, lineWidth: 0.5, lineColor: "#cbd5e1" }], margin: [0, 0, 0, 5] },
        {
          columns: [
            { text: "Print: " + identity.generatedAt + " | User: " + identity.user },
            { text: "Report: " + identity.title + " | Powered by Bayanat Technology", alignment: "right" },
          ]
        },
        { text: "Page " + page + " of " + count, alignment: "right", margin: [0, 3, 0, 0] },
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

export async function createPurchasePdf(report: PurchaseReportDocument, identity: ReportIdentity) {
  const [{ default: pdfMake }, definition, vfs] = await Promise.all([
    import("pdfmake/build/pdfmake.js"), buildPurchasePdfDefinition(report, identity), fontVfs(),
  ]);
  const fonts = { Inter: { normal: "Inter-Regular.ttf", bold: "Inter-Bold.ttf", italics: "Inter-Regular.ttf", bolditalics: "Inter-Bold.ttf" } };
  const tableLayouts = {
    biscReportTable: {
      hLineWidth: (i: number, node: any) => {
        if (i === 0) return 0.75;
        if (i === (node.table.headerRows || 1)) return 1.5;
        if (i === node.table.body.length) return 0.75;
        return 0.5;
      },
      vLineWidth: () => 0,
      hLineColor: (i: number, node: any) => {
        if (i === (node.table.headerRows || 1)) return "#00378c";
        if (i === 0 || i === node.table.body.length) return "#cbd5e1";
        return "#e2e8f0";
      },
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3.5,
      paddingBottom: () => 3.5,
      fillColor: (rowIndex: number, node: any) => {
        if (rowIndex < (node.table.headerRows || 1)) return "#eaf0f8";
        return rowIndex % 2 === 1 ? "#ffffff" : "#fcfdfe";
      },
    },
    noBorders: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 2.5,
      paddingBottom: () => 2.5,
    },
  };
  return new Promise<Blob>((resolve, reject) => {
    try {
      const createPdf = (pdfMake as any).createPdf(definition, tableLayouts, fonts, vfs);
      createPdf.getBlob(resolve);
    }
    catch (error) { reject(error); }
  });
}

export async function downloadPurchaseExcel(report: PurchaseReportDocument, identity: ReportIdentity) {
  const XLSX = await import("xlsx-js-style");
  const { doc } = prepareReportHtml(report.html, window, { stripChrome: report.stripChrome });
  const workbook = XLSX.utils.book_new();

  const thin = (rgb: string) => ({ style: "thin", color: { rgb } });
  const styles = {
    title: { font: { name: "Inter", sz: 14, bold: true, color: { rgb: "00378C" } }, alignment: { vertical: "center" } },
    groupTitle: { font: { name: "Inter", sz: 11, bold: true, color: { rgb: "00378C" } }, fill: { fgColor: { rgb: "EAF0F8" } }, alignment: { vertical: "center" } },
    label: { font: { name: "Inter", sz: 10, bold: true, color: { rgb: "374151" } }, fill: { fgColor: { rgb: "F1F5F9" } } },
    header: { font: { name: "Inter", sz: 10, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "00378C" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } },
    body: { font: { name: "Inter", sz: 10, color: { rgb: "1A1A2E" } }, alignment: { vertical: "center" } },
    number: { font: { name: "Inter", sz: 10, color: { rgb: "1A1A2E" } }, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0.00;[Red]-#,##0.00" },
    subtotal: { font: { name: "Inter", sz: 10, bold: true, color: { rgb: "00378C" } }, fill: { fgColor: { rgb: "F1F5F9" } }, alignment: { vertical: "center" }, border: { top: thin("94A3B8"), bottom: thin("94A3B8") } },
    subtotalNumber: { font: { name: "Inter", sz: 10, bold: true, color: { rgb: "00378C" } }, fill: { fgColor: { rgb: "F1F5F9" } }, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0.00;[Red]-#,##0.00", border: { top: thin("94A3B8"), bottom: thin("94A3B8") } },
    grandTotal: { font: { name: "Inter", sz: 11, bold: true, color: { rgb: "00378C" } }, fill: { fgColor: { rgb: "E2E8F0" } }, alignment: { vertical: "center" }, border: { top: { style: "medium", color: { rgb: "00378C" } }, bottom: { style: "double", color: { rgb: "00378C" } } } },
    grandTotalNumber: { font: { name: "Inter", sz: 11, bold: true, color: { rgb: "00378C" } }, fill: { fgColor: { rgb: "E2E8F0" } }, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0.00;[Red]-#,##0.00", border: { top: { style: "medium", color: { rgb: "00378C" } }, bottom: { style: "double", color: { rgb: "00378C" } } } },
  };

  // Sections: Detail report → one per ".po-group"; Summary report → the single data table
  type Section = { title?: string; table: HTMLTableElement };
  const groups = Array.from(doc.querySelectorAll(".po-group"));
  const sections: Section[] = groups.length
    ? groups.flatMap((group) => {
      const table = group.querySelector<HTMLTableElement>("table:not(.group-header-banner)");
      if (!table) return [];
      return [{ title: group.querySelector(".group-header-banner")?.textContent?.trim(), table }];
    })
    : Array.from(doc.querySelectorAll<HTMLTableElement>("table.data-table")).map((table) => ({ table }));
  const totals = Array.from(doc.querySelectorAll<HTMLTableElement>("table.grand-total-table"));

  const columnCount = Math.max(
    2,
    ...sections.map(({ table }) =>
      Math.max(1, ...Array.from(table.rows).map((row) => Array.from(row.cells).reduce((sum, cell) => sum + cell.colSpan, 0))),
    ),
  );
  const lastCol = columnCount - 1;

  const sheetData: any[][] = [];
  const merges: any[] = [];
  const rowTypes: string[] = [];

  sheetData.push([identity.title]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
  rowTypes.push("title");
  sheetData.push([]);
  rowTypes.push("blank");

  sections.forEach(({ title, table }) => {
    if (title) {
      const curR = sheetData.length;
      sheetData.push([title]);
      merges.push({ s: { r: curR, c: 0 }, e: { r: curR, c: lastCol } });
      rowTypes.push("groupTitle");
    }

    Array.from(table.rows).forEach((row, rIdx) => {
      const isHead = row.parentElement?.tagName === "THEAD" || (rIdx === 0 && !!row.querySelector("th"));
      const isSub = row.classList.contains("subtotal-row");

      const curR = sheetData.length;
      const rowValues: any[] = [];
      let c = 0;

      Array.from(row.cells).forEach((cell) => {
        const colSpan = cell.colSpan || 1;
        const text = cell.textContent?.trim() || "";
        rowValues[c] = NUMBER_PATTERN.test(text) && !isHead ? Number(text.replace(/,/g, "")) : text;
        if (colSpan > 1) merges.push({ s: { r: curR, c }, e: { r: curR, c: c + colSpan - 1 } });
        c += colSpan;
      });

      sheetData.push(rowValues);
      rowTypes.push(isHead ? "header" : isSub ? "subtotal" : "data");
    });

    sheetData.push([]);
    rowTypes.push("blank");
  });

  // Grand totals: label in column A, value in column B
  totals.forEach((table) => {
    Array.from(table.rows).forEach((row) => {
      const [label = "", value = ""] = Array.from(row.cells).map((cell) => cell.textContent?.trim() || "");
      sheetData.push([label, NUMBER_PATTERN.test(value) ? Number(value.replace(/,/g, "")) : value]);
      rowTypes.push("grandTotal");
    });
  });

  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  sheet["!merges"] = merges;

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const widths: number[] = Array(range.e.c + 1).fill(12);

  for (let r = 0; r <= range.e.r; r++) {
    const rType = rowTypes[r] || "data";
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;

      const valStr = String(cell.v ?? "");
      // Title / group banner text spans merged columns, so it shouldn't widen column A
      if (rType !== "title" && rType !== "groupTitle") widths[c] = Math.max(widths[c], Math.min(45, valStr.length + 3));

      const isNum = typeof cell.v === "number" || (NUMBER_PATTERN.test(valStr) && rType !== "header");

      if (rType === "title") cell.s = styles.title;
      else if (rType === "groupTitle") cell.s = styles.groupTitle;
      else if (rType === "header") cell.s = styles.header;
      else if (rType === "subtotal") cell.s = isNum ? styles.subtotalNumber : styles.subtotal;
      else if (rType === "grandTotal") cell.s = isNum ? styles.grandTotalNumber : styles.grandTotal;
      else if (isNum) cell.s = styles.number;
      else cell.s = styles.body;
    }
  }

  sheet["!cols"] = widths.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(workbook, sheet, reportFilename(report.filename || identity.title).slice(0, 31));

  // Summary sheet
  const summaryRows = [
    [identity.title],
    ["Company", identity.company],
    ["Generated by", identity.user],
    ["Generated at", identity.generatedAt],
    [],
    ["Report sections", sections.length],
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

  XLSX.writeFile(workbook, `${reportFilename(report.filename || identity.title)}.xlsx`, { bookType: "xlsx" });
}