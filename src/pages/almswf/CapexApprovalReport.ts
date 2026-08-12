// src/pages/almswf/CapexApprovalReport.ts
//
// Generates and prints a "CAPEX Approval Form" that matches the company's
// official paper form:
//
//   [Item] [Rate] [Qty] [Total RO]
//   [Cost Code]
//   VAT      [amount]
//   GRAND TOTAL [amount]
//   Sl Supplier: [code]     Total Cost RO [amount]
//   Budgeted: Yes/No    Board Approved: Yes/No
//   ... (repeated per line item)
//   Justification
//   Note: ...
//   Requested by | Purchased by | Reviewed by FM | Approved by CEO/GM
//
// Printing strategy: "print-in-place". Instead of opening a new window or
// iframe (both get silently blocked/redirected to printing the whole app
// in embedded/webview/Electron shells), we inject the report markup into a
// hidden container in the current document and use print-only CSS to hide
// everything else on the page. Then we call window.print() on the current
// window itself, which is always available regardless of the host shell.
//
// Usage (from AddCPRequestPage or anywhere with header + items in hand):
//
//   import { printCapexApprovalReport } from "./CapexApprovalReport";
//
//   printCapexApprovalReport({
//     companyName: "AL MADINA LOGISTIC SERVICES CO SAOC",
//     requestNumber: header.REQUEST_NUMBER,
//     requestDate: header.REQUEST_DATE,
//     supplierCode: header.SUPPLIER,
//     budgeted: header.BUDGETED,
//     boardApproval: header.BOARD_APPROVAL,
//     justification: header.DESCRIPTION,
//     items: items.map((it) => ({
//       itemCode: it.ITEM_CODE,
//       itemDesp: it.ITEM_DESP,
//       costCode: (it as any).COST_CODE, // include if your item type carries it
//       rate: it.ITEM_RATE,
//       qty: it.ITEM_QTY,
//       amount: it.AMOUNT,
//       vatAmount: it.TX_COMPNT_AMT_1,
//     })),
//   });

export interface CapexApprovalReportItem {
  itemCode?: string;
  itemDesp?: string;
  costCode?: string;
  rate?: number;
  qty?: number;
  amount?: number;      // pre-VAT line total (Rate x Qty)
  vatAmount?: number;   // VAT for this line
}

export interface CapexApprovalReportData {
  companyName?: string;
  requestNumber?: string;
  requestDate?: string | Date;
  supplierCode?: string;
  budgeted?: string;       // "Y" | "N" (or "Yes"/"No")
  boardApproval?: string;  // "Y" | "N" (or "Yes"/"No")
  justification?: string;
  items: CapexApprovalReportItem[];
}

// ── Formatting helpers ──────────────────────────────────────────────────────
function num(v: unknown): number {
  return Number(v) || 0;
}

// Trims trailing zeros but never shows more than 3 decimals
// (95 -> "95", others show up to 3 decimals trimmed)
function fmtAmt(v: unknown): string {
  const n = num(v);
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function fmtRate(v: unknown): string {
  return num(v).toFixed(3);
}

function fmtDate(v: unknown): string {
  const raw = v ? new Date(v as string) : new Date();
  if (isNaN(raw.getTime())) return new Date().toLocaleDateString("en-GB");
  const dd = String(raw.getDate()).padStart(2, "0");
  const mm = String(raw.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${raw.getFullYear()}`;
}

function yesNo(v?: string): string {
  const s = String(v || "").trim().toUpperCase();
  if (s === "Y" || s === "YES") return "Yes";
  if (s === "N" || s === "NO") return "No";
  return s || "—";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── HTML builders ───────────────────────────────────────────────────────────
function buildItemBlock(item: CapexApprovalReportItem, data: CapexApprovalReportData, index: number): string {
  const amount = num(item.amount);
  const vat = num(item.vatAmount);
  const grandTotal = amount + vat;

  return `
    <section class="item-block" aria-label="Line item ${index + 1}">
      <table class="line-table">
        <thead>
          <tr>
            <th class="col-desc">Item Description</th>
            <th class="col-num">Rate (RO)</th>
            <th class="col-num">Quantity</th>
            <th class="col-num">Total RO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="col-desc">
              <span class="item-code">${escapeHtml(item.itemCode || "")}</span><br />
              <span class="item-name">${escapeHtml(item.itemDesp || "")}</span>
            </td>
            <td class="col-num">${fmtRate(item.rate)}</td>
            <td class="col-num">${num(item.qty)}</td>
            <td class="col-num">${fmtAmt(amount)}</td>
          </tr>
          ${item.costCode ? `
          <tr class="sub-row">
            <td colspan="4" class="cost-code">${escapeHtml(item.costCode)}</td>
          </tr>` : ""}
          <tr class="sub-row">
            <td colspan="3" class="label-cell">VAT</td>
            <td class="col-num">${fmtAmt(vat)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" class="label-cell">GRAND TOTAL</td>
            <td class="col-num">${fmtAmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <table class="meta-table">
        <tbody>
          <tr>
            <td class="meta-label">Sl Supplier:</td>
            <td class="meta-value">${escapeHtml(data.supplierCode || "—")}</td>
            <td class="meta-label align-right">Total Cost RO</td>
            <td class="meta-value align-right">${fmtAmt(grandTotal)}</td>
          </tr>
          <tr>
            <td class="meta-label">Budgeted:</td>
            <td class="meta-value">${yesNo(data.budgeted)}</td>
            <td class="meta-label align-right">Board Approved:</td>
            <td class="meta-value align-right">${yesNo(data.boardApproval)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function buildReportContentHtml(data: CapexApprovalReportData): string {
  const companyName = data.companyName || "AL MADINA LOGISTIC SERVICES CO SAOC";
  const dateStr = fmtDate(data.requestDate);
  const itemsHtml = data.items.map((item, i) => buildItemBlock(item, data, i)).join("\n");

  return `
    <header class="doc-header">
      <div class="date">Date:<br /><strong>${dateStr}</strong></div>
      <div class="titles">
        <div class="company">${escapeHtml(companyName)}</div>
        <div class="form-title">Capex Approval Form</div>
      </div>
      <div class="req-no">${data.requestNumber ? "Req No:<br/><strong>" + escapeHtml(data.requestNumber) + "</strong>" : ""}</div>
    </header>

    ${itemsHtml}

    <section class="justification">
      <h3>Justification</h3>
      <p>${escapeHtml(data.justification || "GENERATED FOR CAPEX PROCESS")}</p>
      <p class="note">Note: This form should be filled prior to all capex purchases as per Board direction</p>
    </section>

    <section class="signatures">
      <div class="signature-cell">Requested by</div>
      <div class="signature-cell">Purchased by</div>
      <div class="signature-cell">Reviewed by FM</div>
      <div class="signature-cell">Approved by CEO/GM</div>
    </section>
  `;
}

// ── Print-in-place setup ────────────────────────────────────────────────────
// No popup, no iframe — hides the rest of the app during print and prints
// the current window. Reliable across browsers, webviews, and Electron.

let printStyleInjected = false;

function ensurePrintStyle() {
  if (printStyleInjected) return;

  const style = document.createElement("style");
  style.id = "capex-print-style";
  style.textContent = `
    @media print {
      body > *:not(#capex-print-root) { display: none !important; }
      #capex-print-root {
        display: block !important;
        position: static !important;
      }
    }
    #capex-print-root {
      display: none;
      font-family: Georgia, "Times New Roman", serif;
      color: #1a1a1a;
      font-size: 13px;
      line-height: 1.45;
    }
    #capex-print-root .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 10px;
      margin-bottom: 18px;
    }
    #capex-print-root .doc-header .date { font-size: 12px; color: #444; }
    #capex-print-root .doc-header .titles { text-align: center; flex: 1; }
    #capex-print-root .doc-header .company {
      font-size: 16px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
    }
    #capex-print-root .doc-header .form-title {
      font-size: 13px; font-weight: 600; color: #082A89;
      letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px;
    }
    #capex-print-root .doc-header .req-no { font-size: 12px; color: #444; text-align: right; min-width: 90px; }
    #capex-print-root .item-block {
      border: 1px solid #1a1a1a; border-radius: 4px; margin-bottom: 16px; padding: 10px 12px;
      page-break-inside: avoid;
    }
    #capex-print-root table.line-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    #capex-print-root table.line-table thead th {
      font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #444;
      text-align: left; border-bottom: 1px solid #bbb; padding: 4px 6px; font-weight: 600;
    }
    #capex-print-root table.line-table .col-num { text-align: right; white-space: nowrap; }
    #capex-print-root table.line-table td { padding: 6px 6px; vertical-align: top; }
    #capex-print-root .item-code { font-weight: 700; font-size: 12.5px; }
    #capex-print-root .item-name { color: #444; font-size: 12px; }
    #capex-print-root .sub-row td { padding-top: 2px; padding-bottom: 2px; border-top: 1px dashed #bbb; }
    #capex-print-root .cost-code { font-size: 11.5px; color: #444; letter-spacing: 0.03em; }
    #capex-print-root .label-cell { text-align: right; font-weight: 600; color: #444; }
    #capex-print-root .total-row td { border-top: 1px solid #1a1a1a; font-weight: 700; font-size: 13.5px; }
    #capex-print-root table.meta-table {
      width: 100%; border-collapse: collapse; background: #fafafa; border: 1px solid #bbb; border-radius: 3px;
    }
    #capex-print-root table.meta-table td { padding: 5px 10px; font-size: 12px; }
    #capex-print-root .meta-label { color: #444; font-weight: 600; white-space: nowrap; }
    #capex-print-root .meta-value { font-weight: 700; }
    #capex-print-root .align-right { text-align: right; }
    #capex-print-root .justification { margin-top: 20px; padding-top: 14px; border-top: 2px solid #1a1a1a; }
    #capex-print-root .justification h3 {
      font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px 0; color: #444;
    }
    #capex-print-root .justification p { margin: 0 0 4px 0; font-size: 12.5px; }
    #capex-print-root .note { margin-top: 10px; font-size: 11px; font-style: italic; color: #444; }
    #capex-print-root .signatures {
      margin-top: 36px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
    }
    #capex-print-root .signature-cell {
      text-align: center; padding-top: 28px; border-top: 1px solid #1a1a1a; font-size: 11.5px; color: #444;
    }
    @media print {
      #capex-print-root .item-block { break-inside: avoid; }
      @page { margin: 18mm 14mm; }
    }
  `;
  document.head.appendChild(style);
  printStyleInjected = true;
}

/**
 * Prints the CAPEX Approval Form using the current window — no popup,
 * no iframe. Injects the report markup into a hidden container and uses
 * print-only CSS to hide the rest of the app while printing. This is the
 * most reliable approach in embedded/webview/Electron contexts where
 * window.open() and iframe printing get intercepted by the host shell.
 */
export function printCapexApprovalReport(data: CapexApprovalReportData): void {
  ensurePrintStyle();

  let root = document.getElementById("capex-print-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "capex-print-root";
    document.body.appendChild(root);
  }
  root.innerHTML = buildReportContentHtml(data);

  window.print();
}