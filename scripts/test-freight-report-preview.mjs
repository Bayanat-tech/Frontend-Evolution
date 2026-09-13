import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = process.cwd();
const output = path.join(root, "node_modules/.cache/freight-report-tests");
await fs.mkdir(output, { recursive: true });
await build({
  entryPoints: ["src/components/freight/freightReportDocument.ts", "src/components/freight/reportPreviewStore.ts"],
  bundle: true, packages: "external", platform: "node", format: "esm", outdir: output,
  define: { "import.meta.env.BASE_URL": '"/"' }, outExtension: { ".js": ".mjs" },
});
const { window } = new JSDOM("", { url: "http://localhost:3100" });
globalThis.window = window;
globalThis.document = window.document;
globalThis.fetch = async (url) => {
  assert.match(String(url), /^\/fonts\/reports\/Inter-(Regular|Bold)\.ttf$/);
  return new Response(await fs.readFile(path.join(root, "public", String(url))), { status: 200 });
};
const renderer = await import(pathToFileURL(path.join(output, "freightReportDocument.mjs")));
const store = await import(pathToFileURL(path.join(output, "reportPreviewStore.mjs")));
const identity = { title: "Freight report", company: "Example Logistics", user: "Report QA", generatedAt: "11 Sep 2026, 09:00" };

// Execute the real templates without mounting their API-backed React pages.
async function helpers(file, exports) {
  const source = await fs.readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const snippets = ast.statements.filter((node) => ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)).map((node) => node.getText(ast));
  const code = ts.transpileModule(snippets.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const icons = ["FileSpreadsheet", "Ship", "Boxes", "WalletCards", "BarChart3", "UserRound", "CalendarDays", "PackageCheck", "Activity", "MapPinned", "CreditCard", "ShipWheel", "FileText", "Paperclip"];
  const context = vm.createContext({ window, document: window.document, exports: {}, ...Object.fromEntries(icons.map((name) => [name, () => null])) });
  vm.runInContext(code + `\nglobalThis.result = {${exports.join(",")}}`, context);
  return context.result;
}

const reports = await helpers("src/pages/freight/FreightReportPage.tsx", ["reportConfigs", "emptyFilters", "reportHtml", "buildTotals", "normalizeRow"]);
async function render(name, html, orientation = "landscape") {
  const blob = await Promise.race([
    renderer.createFreightPdf({ html, orientation }, { ...identity, title: name }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error(`PDF generation hung: ${name}`)), 30000); timer.unref(); }),
  ]);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 1000);
  await fs.writeFile(path.join(output, `${name}.pdf`), bytes);
  return bytes;
}

for (const [key, config] of Object.entries(reports.reportConfigs)) {
  const rows = Array.from({ length: key === "freight_job_list" ? 120 : 3 }, (_, index) => reports.normalizeRow({
    ...Object.fromEntries(config.columns.map((column) => [column.key, column.kind === "amount" ? 1234.5 : column.kind === "date" ? "2026-09-11" : `Sample ${index + 1}`])),
    job_no: `0000${index + 1}`, enquiry_nr: `EQ-${index + 1}`, quotation_nr: `QT-${index + 1}`,
    prin_code: "P001", prin_name: "Example principal with a long name", transport_mode: "A", job_type: "EXP",
    company_code: "TEST", curr_code: "OMR", bill: 120, cost: 80, revenue: 120, expense: 80,
  }));
  const html = reports.reportHtml(config, "TEST", identity.user, reports.emptyFilters, "P001", rows, reports.buildTotals(rows, config.amountFields), false, "");
  await render(key, html);
}
const enquiry = await helpers("src/pages/freight/FreightEnquiryMainPage.tsx", ["buildFreightPrintHtml", "buildInitialHeader"]);
for (const type of ["enquiry", "rfq"]) {
  const header = { ...enquiry.buildInitialHeader({ company_code: "TEST" }, { mode: "air", direction: "export" }, type), enquiry_nr: "000123", shipper_name: "Example Shipper", consignee_name: "Example Consignee" };
  await render(type, enquiry.buildFreightPrintHtml(header, [], type === "rfq" ? "RFQ" : "Enquiry"), "portrait");
}
const quotation = await helpers("src/pages/freight/FreightQuotationPage.tsx", ["buildFreightPrintHtml", "buildInitialHeader"]);
await render("quotation", quotation.buildFreightPrintHtml({ ...quotation.buildInitialHeader({ company_code: "TEST" }), quotation_nr: "000124" }, []), "portrait");
await render("empty-report", reports.reportHtml(reports.reportConfigs.freight_job_list, "TEST", identity.user, reports.emptyFilters, "All", [], [], false, ""));

const first = store.openFreightReport("first");
store.openFreightReport("second");
first.ready({ html: "stale" });
assert.equal(store.getReportPreview().title, "second");
store.closeReportPreview();
first.fail("late error");
assert.equal(store.getReportPreview(), null);
const prepared = renderer.prepareReportHtml('<script>alert(1)</script><table><thead><tr><th>Reference</th></tr></thead><tbody><tr><td>000123</td></tr></tbody></table>');
assert.ok(!prepared.html.includes("script"));
assert.equal(prepared.doc.querySelector("td").textContent, "000123");
console.log(`PASS: 17 report formats, enquiry, RFQ, quotation, empty report, real browser PDF generation and stale/closed preview requests. PDFs: ${output}`);
