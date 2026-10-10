import { Columns3, List, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { PODocType, PurchaseOrderForm, PurchaseOrderLineRow } from "./Purchaseordertypes";

import {
  formatAmount,
  lineAmount,
  lineDiscPrice,
  lineNetAmount,
  lineTaxAmount,
  numberOrZero,
  text,
  lineLcurrAmount,   // add
  computeQuantity,   // add
  isSameUom,
  taxLcurrAmount,
  LcurrDisAmount,
  DiscPrice,
  amountBeforeDiscPrice,
  finalRate,
  lineDiscPrecentage,
  TotalDiscAmount,
} from "./Purchaseorderutils";
import { SalesOrderLineRow, SODocType } from "../sales/SalesOrdertypes";
import { Select } from "../../../components/ui/Select";
import { useMemo, useRef, useState } from "react";

const STICKY_COLS = {
  sno: { width: 50, left: 0 },
  div: { width: 50, left: 50 },
  zone: { width: 140, left: 100 },
  PO: { width: 180, left: 240 },
  product: {
    width: 240,
    left: 240,
  },
} as const;

// Editable inputs: white. Disabled / fixed inputs: grayed.
const INPUT_BG = "!bg-white disabled:!bg-slate-100 disabled:!text-slate-500";
// Calculated (display-only) amount cells: grayed, green, bold.
const AMOUNT_CELL = "px-2 py-1 text-right font-bold text-emerald-600 bg-slate-200";
// Fixed UOM label (non-editable)
const UOM_LABEL = "bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500";

function hasGrnColumn(docType?: string | null): boolean {
  const code = String(docType ?? "").trim().toUpperCase();
  return code === "PIN" || code === "SIN";
}
function hasPoColumn(docType?: string | null): boolean {
  const code = String(docType ?? "").trim().toUpperCase();
  return code === "GRN";
}

function hasExtraStickyColumn(docType?: string | null): boolean {
  const code = String(docType ?? "").trim().toUpperCase();
  return code === "PIN" || code === "GRN" || code === "SIN";
}

// Div column is only visible in "All Columns" view, so Zone / Product sticky offsets shift left by 50 in compact view.
function resolveSticky(col: keyof typeof STICKY_COLS, docType?: string | null, showDiv: boolean = true) {
  const showExtraCol = hasExtraStickyColumn(docType);
  const shift = showDiv ? 0 : STICKY_COLS.div.width;

  if (col === "product") {
    return { width: STICKY_COLS.product.width, left: (showExtraCol ? 320 : STICKY_COLS.product.left) - shift };
  }
  if (col === "zone") {
    return { width: STICKY_COLS.zone.width, left: STICKY_COLS.zone.left - shift };
  }
  return STICKY_COLS[col];
}

function stickyStyle(col: keyof typeof STICKY_COLS, docType?: string | null, showDiv: boolean = true): React.CSSProperties {
  const { width, left } = resolveSticky(col, docType, showDiv);
  return { position: "sticky", left, width, minWidth: width, maxWidth: width, zIndex: 2, backgroundColor: "var(--card, #fff)" };
}

function stickyHeaderStyle(col: keyof typeof STICKY_COLS, docType?: string | null, showDiv: boolean = true, top: number = 0): React.CSSProperties {
  const { width, left } = resolveSticky(col, docType, showDiv);
  return { position: "sticky", top, left, width, minWidth: width, maxWidth: width, zIndex: 3, backgroundColor: "var(--primary, #1d4ed8)" };
}
const plainHeaderStyle = (width?: number, top: number = 0): React.CSSProperties => ({
  position: "sticky",
  top,
  zIndex: 1,
  backgroundColor: "var(--primary, #1d4ed8)",
  width,
  minWidth: width,
});

// Group header (Primary / Lowest / Discount / TAX) - coloured band above the column titles
const GROUP_ROW_HEIGHT = 10;
const groupHeaderStyle = (bg: string): React.CSSProperties => ({
  position: "sticky",
  top: 0,
  zIndex: 1,
  height: GROUP_ROW_HEIGHT,
  backgroundColor: bg,
  color: "#1e293b",
  border: "1px solid #94a3b8",
});

const TABLE_COLUMN_COUNT = 24;

// Final Rate = Unit Price - (Unit Price * Disc % / 100)  [matches lineNetAmount / "Final Rate" in the sheet]
// Total Amount (net, post-discount) = Net Qty * Final Rate  [sheet's "Total Amout" column]
function netTotalAmount(quantity: number, row: PurchaseOrderLineRow): number {
  return quantity * finalRate(row);
}

// Lcurr Amount = Total Amount * Final Rate  (=L2*K2 in the sheet)
function computeLcurrAmount(quantity: number, row: PurchaseOrderLineRow): number {
  return netTotalAmount(quantity, row) * finalRate(row) * numberOrZero(row.ex_rate);
}

export function PurchaseOrderLinesTable({
  rows,
  setdetails,
  form,
  updateRow,
  addRow,
  removeRow,
  headerAndLineDisabled,
  discAmt,
  companyCode,
  loginid,
  ex_rate,
  docType,
}: {
  form: PurchaseOrderForm;
  setdetails?: (rows: SalesOrderLineRow[]) => void;
  rows: PurchaseOrderLineRow[];
  updateRow: (id: string, patch: Partial<PurchaseOrderLineRow>) => void;
  addRow: () => void;
  removeRow: (id: string) => void;
  headerAndLineDisabled: boolean;
  discAmt: number;
  companyCode?: string;
  loginid?: string;
  ex_rate?: number;
  docType?: PODocType | SODocType | null;

}) {
  const totalQtyPuom = rows.reduce((sum, row) => sum + (Number(row.qty_puom) || 0), 0);
  const totalQtyLuom = rows.reduce((sum, row) => sum + (Number(row.qty_luom) || 0), 0);
  const totalAmountDisct = rows.reduce((sum, row) => sum + amountBeforeDiscPrice(row), 0);
  const totalDiscPrice = rows.reduce((sum, row) => sum + DiscPrice(row), 0);
  const totalTaxAmount = rows.reduce((sum, row) => sum + lineTaxAmount(row), 0);
  const grandTotal = totalAmountDisct - TotalDiscAmount(rows);
  const finalTotal = grandTotal + totalTaxAmount;
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const discountScope = form.discount_scoope || "ITEM";
  const [lineSearch, setLineSearch] = useState("");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const filteredRows = useMemo(() => {
    const q = lineSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.prod_name?.toLowerCase().includes(q) ||
      r.prod_code?.toLowerCase().includes(q) ||
      r.line_remarks?.toLowerCase().includes(q) ||
      r.job_no?.toLowerCase().includes(q)
    );
  }, [rows, lineSearch]);
  // Quantity is always derived, never typed directly:
  // - same UOM: quantity mirrors qty_luom
  // - different UOM: quantity = (qty_puom * uppp) + qty_luom

  // Compact view  = columns of the reference sheet (+ Action)
  // All Columns   = compact columns + Div, Lcurr Before Tax, Tax Type/Cat/Code, Tax Lcurr, Lcurr After Tax, Req Date, Remarks
  const tableColSpan = showAllColumns ? 27 : 18;

  return (
    <div
      className="commercial-lines-card rounded-md border bg-card min-w-0"
      style={{ height: "auto", minHeight: 0, maxHeight: "none", overflow: "visible", display: "block" }}
    >
      <div className="finance-line-actions">
        <div className="finance-line-actions-left">
          <span className="finance-line-actions-icon"><List size={14} /></span>
          <span className="finance-line-actions-title">Accounting Lines</span>
          <span className="finance-line-actions-badge">
            {lineSearch.trim()
              ? `${filteredRows.length} of ${rows.length} lines`
              : `${rows.length} ${rows.length === 1 ? "line" : "lines"}`}
          </span>
          {lineSearch.trim() && (
            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Filtered ({filteredRows.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAllColumns(!showAllColumns)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${showAllColumns
              ? "bg-blue-50 text-[#00378C] border-[#00378C]/40 shadow-xs"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              }`}
            title={showAllColumns ? "Switch to Compact View (fits screen)" : "Show all columns including per-line Currency, Tax Code, Job & Ex Rate"}
          >
            <Columns3 size={13} className={showAllColumns ? "text-[#00378C]" : "text-slate-500"} />
            <span>{showAllColumns ? "All Columns" : "Compact View"}</span>
          </button>

          <div className="bisc-table-search">
            <Search size={13} className="bisc-table-search-icon" />
            <input
              className="bisc-search-input"
              type="text"
              value={lineSearch}
              onChange={(e) => setLineSearch(e.target.value)}
              placeholder="Search lines..."
            />
            {lineSearch && (
              <button type="button" onClick={() => setLineSearch("")} className="bisc-table-search-clear" title="Clear">
                <X size={11} />
              </button>
            )}
          </div>
          <Button disabled={headerAndLineDisabled || !form.div_code || !form.curr_code} size="sm" type="button" variant="outline" onClick={addRow} className="commercial-add-line-btn">
            <Plus size={14} /> Add Line
          </Button>
        </div>
      </div>
      <div className="commercial-lines-scroll max-h-[43vh] overflow-auto min-w-0">
       <table className={`finance-lines-table w-full text-xs border-collapse [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-300 ${showAllColumns ? "min-w-[2300px]" : "min-w-full"}`}>
          <thead className="sticky top-0 bg-[#00378C] text-xs font-semibold text-white shadow-sm z-10">
            {/* Row 1: group bands only (Primary / Lowest / Discount / TAX). Ungrouped columns get an empty cell here - nothing is merged. */}
            <tr>
              <th className="finance-sticky-col" style={stickyHeaderStyle("sno", docType, showAllColumns)}></th>
              {showAllColumns && <th className="finance-sticky-col" style={stickyHeaderStyle("div", docType, showAllColumns)}></th>}
              <th className="finance-sticky-col" style={stickyHeaderStyle("zone", docType, showAllColumns)}></th>
              <th className="finance-sticky-col hover:!z-20" style={stickyHeaderStyle("product", docType, showAllColumns)}></th>
              <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#dbeafe")}>Primary</th>
              <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#e2e8f0")}>Lowest</th>
              <th colSpan={2} style={plainHeaderStyle(undefined, 0)}></th>
              <th colSpan={2} style={plainHeaderStyle(undefined, 0)}></th>
              <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#bbf7d0")}>Discount</th>
              <th style={plainHeaderStyle(undefined, 0)}></th>
              <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#f5d0fe")}>TAX</th>
              <th style={plainHeaderStyle(undefined, 0)}></th>
              {showAllColumns && <th colSpan={8} style={plainHeaderStyle(undefined, 0)}></th>}
              <th style={plainHeaderStyle(undefined, 0)}></th>
            </tr>
            {/* Row 2: every column title */}
            <tr>
              <th className="finance-sticky-col px-2 py-2 text-center" style={stickyHeaderStyle("sno", docType, showAllColumns, GROUP_ROW_HEIGHT)}>Sr No</th>
              {showAllColumns && (
                <th className="finance-sticky-col px-2 py-2 text-center" style={stickyHeaderStyle("div", docType, showAllColumns, GROUP_ROW_HEIGHT)}>Div</th>
              )}
              <th className="finance-sticky-col px-2 py-2 text-center w-32" style={stickyHeaderStyle("zone", docType, showAllColumns, GROUP_ROW_HEIGHT)}>Zone</th>
              <th className="finance-sticky-col px-2 py-2 text-center" style={stickyHeaderStyle("product", docType, showAllColumns, GROUP_ROW_HEIGHT)}>Product</th>
              <th className=" px-2 py-2 text-center" style={plainHeaderStyle(80, GROUP_ROW_HEIGHT)}>Qty</th>
              <th className=" px-2 py-2 text-center" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Uom</th>
              <th className=" px-2 py-2 text-center" style={plainHeaderStyle(80, GROUP_ROW_HEIGHT)}>Qty</th>
              <th className=" px-2 py-2 text-center" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Uom</th>
              {/* <th className=" px-1 py-2 text-center whitespace-normal leading-tight" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Unit Per<br />Primary</th> */}
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90, GROUP_ROW_HEIGHT)}> Net Quantity</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(110, GROUP_ROW_HEIGHT)}>Unit Price</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(110, GROUP_ROW_HEIGHT)}>Amount</th>
              <th className=" px-2 py-2 text-center" style={plainHeaderStyle(70, GROUP_ROW_HEIGHT)}>Disc %</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90, GROUP_ROW_HEIGHT)}>Disc Amount</th>
              <th
                className="finance-amount-cell group px-2 py-2 text-center hover:!z-20"
                style={plainHeaderStyle(102, GROUP_ROW_HEIGHT)}
              >
                Total Amount(E.T)
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  Total Amount Excluding Tax
                </span>
              </th>
              <th className=" px-2 py-2 text-center" style={plainHeaderStyle(60, GROUP_ROW_HEIGHT)}>Tax %</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(100, GROUP_ROW_HEIGHT)}>Tax Amount</th>
              <th className="finance-amount-cell group px-2 py-2 text-center hover:!z-20" style={plainHeaderStyle(120, GROUP_ROW_HEIGHT)}>Total Amount(I.T)
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  Total Amount Including Tax
                </span>
              </th>
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(120, GROUP_ROW_HEIGHT)}>Lcurr Amount Before Tax</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(100, GROUP_ROW_HEIGHT)}>Tax Type</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(120, GROUP_ROW_HEIGHT)}>Tax Cat</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(96, GROUP_ROW_HEIGHT)}>Tax code</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(112, GROUP_ROW_HEIGHT)}>Tax Lcurr amount</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(128, GROUP_ROW_HEIGHT)}>Lcurr amount After Tax</th>}
              {showAllColumns && <th className="px-2 py-2 text-center" style={plainHeaderStyle(150, GROUP_ROW_HEIGHT)}>Req Date</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(160, GROUP_ROW_HEIGHT)}>Remarks</th>}
              <th className="finance-sticky-col-right px-2 py-2 text-center" style={plainHeaderStyle(60, GROUP_ROW_HEIGHT)}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={tableColSpan}>No detail lines yet — click "Add Line" to get started</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={tableColSpan}>No lines match "<strong>{lineSearch}</strong>"</td></tr>
            ) : filteredRows.map((row, index) => {
              const qtyPuomNum = numberOrZero(row.qty_puom);
              const qtyLuomNum = numberOrZero(row.qty_luom);
              const upppNum = numberOrZero(row.uppp);

              const sameUom = isSameUom(row);
              const quantity = computeQuantity(row);
              const lcurrAmountValue = lineLcurrAmount(row, ex_rate);
              const taxLcurrAmountValue = taxLcurrAmount(row, ex_rate);

              return (
                <tr className="border-t odd:bg-muted/20" key={row.id}>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("sno", docType, showAllColumns)}>{index + 1}</td>
                  {showAllColumns && (
                    <td className="finance-sticky-col bg-card px-2 py-1 text-xs w-16" style={stickyStyle("div", docType, showAllColumns)}>
                      <Input className={`w-12 ${INPUT_BG}`} disabled={headerAndLineDisabled} value={row.div_code} onChange={(event) => updateRow(row.id, { div_code: event.target.value })} />
                    </td>
                  )}
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs w-32" style={stickyStyle("zone", docType, showAllColumns)}>
                    <LookupField
                      label=""
                      value={row.zone_code || ""}
                      displayValue={row.zone_code}
                      columns={[{ field: "zone_code", header: "Code" }, { field: "zone_name", header: "Name" }]}
                      valueField="zone_code"
                      displayFields={["zone_code", "zone_name"]}
                      loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_ZONE_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                      disabled={headerAndLineDisabled}
                      onChange={(value, selectedRow) => updateRow(row.id, {
                        zone_code: value,

                      })}
                    />
                  </td>

                  <td className="finance-sticky-col finance-account-cell group bg-card px-2 py-1 hover:!z-20" style={stickyStyle("product", docType, showAllColumns)}>
                    <LookupField
                      label=""
                      value={row.prod_code || ""}
                      displayValue={row.prod_name}
                      columns={[{ field: "prod_code", header: "Code" }, { field: "prod_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                      valueField="prod_code"
                      displayFields={["prod_code", "prod_name"]}
                      loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_PRODUCT_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                      disabled={headerAndLineDisabled}
                      onChange={(value, selectedRow) => {
                        const newPUom = text(getLookupValue(selectedRow || {}, "p_uom")) || row.p_uom;
                        const newLUom = text(getLookupValue(selectedRow || {}, "l_uom")) || row.l_uom;
                        const newUppp = numberOrZero(getLookupValue(selectedRow || {}, "uppp")) || row.uppp;
                        const patch: Partial<PurchaseOrderLineRow> = {
                          prod_code: value,
                          prod_name: text(getLookupValue(selectedRow || {}, "prod_name")),
                          p_uom: newPUom,
                          l_uom: newLUom,
                          uppp: newUppp,
                          unit_price: numberOrZero(getLookupValue(selectedRow || {}, "unit_price")) || row.unit_price,
                        };
                        const merged = { ...row, ...patch };
                        if (isSameUom(merged)) {
                          patch.qty_puom = row.qty_luom;
                        }
                        patch.quantity = computeQuantity({ ...row, ...patch });
                        updateRow(row.id, patch);
                      }}
                    />
                    <span className="pointer-events-none absolute left-1/2 top-full z-50 -mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      Unit Per Primary: {row.uppp}
                    </span>
                  </td>

                  {/* Primary: Qty */}
                  <td className="px-2 py-1">
                    <Input
                      className={`finance-money-input ${INPUT_BG}`}
                      disabled={headerAndLineDisabled}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"

                      value={row.qty_puom}
                      onChange={(event) => {
                        const newQtyPuom = Number(event.target.value || 0);

                        const patch: Partial<PurchaseOrderLineRow> = {
                          qty_puom: newQtyPuom,
                        };

                        patch.quantity = computeQuantity({
                          ...row,
                          ...patch,
                        });

                        updateRow(row.id, patch);
                      }}
                    />
                  </td>
                  {/* Primary: Unit of Measure */}
                  {/* <td className="px-2 py-1 text-center">
                    <span className={UOM_LABEL}>{row.p_uom || ""}</span>
                  </td> */}
                      <td className={UOM_LABEL} style={{ textAlign: "center", padding: "0.25rem 0.5rem" }}>
                   {row.p_uom || ""}
                  </td>

                  {/* Lowest: Qty */}
                  <td className="px-2 py-1">
                    <Input
                      className={`finance-money-input ${INPUT_BG}`}
                      disabled={headerAndLineDisabled || sameUom}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={sameUom ? 0 : row.qty_luom}
                      onChange={(event) => {
                        const newQtyLuom = Number(event.target.value || 0);

                        const patch: Partial<PurchaseOrderLineRow> = {
                          qty_luom: newQtyLuom,
                        };

                        patch.quantity = computeQuantity({
                          ...row,
                          ...patch,
                        });

                        updateRow(row.id, patch);
                      }}
                    />
                  </td>
                  {/* Lowest: Unit of Measure */}
                       <td className={UOM_LABEL} style={{ textAlign: "center", padding: "0.25rem 0.5rem" }}>
                   {row.l_uom || ""}
                  </td>

                  {/* Unit Per Primary (now visible in both views) */}
                  {/* <td className="px-1 py-1" style={{ width: 30, minWidth: 30, maxWidth: 30 }}>
                    <Input
                      className="finance-money-input"
                      disabled
                      readOnly
                      type="number"
                      style={{ textAlign: "right", width: "100%", paddingLeft: 4, paddingRight: 4 }}
                      step="0.001"
                      value={row.uppp}
                    />
                  </td> */}
                  {/* Quantity */}
                  <td className="finance-amount-cell px-2 py-1 text-right  bg-slate-200">
                    {formatAmount(quantity)}
                  </td>
                  {/* Unit Price */}
                  <td className="px-2 py-1">
                    <Input
                      className={`finance-money-input ${INPUT_BG}`}
                      disabled={headerAndLineDisabled}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.000001"
                      value={Number(row.unit_price || 0).toFixed(3)}
                      onChange={(event) =>
                        updateRow(row.id, {
                          unit_price: Number(event.target.value || 0)
                        })
                      }
                    />
                  </td>
                  {/* Amount (before discount) */}
                  <td className={AMOUNT_CELL}>
                    {formatAmount(amountBeforeDiscPrice(row))}
                  </td>
                  {/* Discount: Disc % */}
                  <td className="px-2 py-1">
                    <Input
                      className={`finance-money-input px-2 py-1 ${INPUT_BG}`}
                      disabled={headerAndLineDisabled || discountScope !== "ITEM"}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={row.disc_percent}
                      onChange={(event) => {
                        const discPercent = Number(event.target.value || 0);
                        const amount = amountBeforeDiscPrice(row);

                        updateRow(row.id, {
                          disc_percent: discPercent,
                          disc_price: amount * (discPercent / 100),
                        });
                      }}
                    />
                  </td>
                  {/* Discount: Disc Amount */}
                  <td className="px-2 py-1">
                    <Input
                      className={`finance-money-input px-2 py-1 ${INPUT_BG}`}
                      disabled={headerAndLineDisabled || discountScope !== "ITEM"}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={row.disc_price}
                      onChange={(event) => {
                        const discPrice = Number(event.target.value || 0);
                        const amount = amountBeforeDiscPrice(row);

                        updateRow(row.id, {
                          disc_price: discPrice,
                          disc_percent: amount > 0
                            ? (discPrice / amount) * 100
                            : 0,
                        });
                      }}
                    />
                  </td>
                  {/* Net Amount (Excl Tax) */}
                  <td className={AMOUNT_CELL}>{formatAmount(lineAmount(row))}</td>
                  {/* TAX: Tax % */}
                  <td className="px-2 py-1">
                    <Input className={`finance-money-input ${INPUT_BG}`} disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.tx_compnt_perc_1} onChange={(event) => updateRow(row.id, { tx_compnt_perc_1: Number(event.target.value || 0) })} />
                  </td>
                  {/* TAX: Tax Amount */}
                  <td className={AMOUNT_CELL}>{formatAmount(lineTaxAmount(row))}</td>
                  {/* Total Amount (Incl Tax) = Net + Tax */}
                  <td className={AMOUNT_CELL}>{formatAmount(lineAmount(row) + lineTaxAmount(row))}</td>

                  {/* ---------- All Columns view only ---------- */}
                  {showAllColumns && (<td className={AMOUNT_CELL}>
                    {formatAmount(lcurrAmountValue)}
                  </td>)}
                  {showAllColumns && (<td className="px-2 py-1">
                    <Select
                      value={row.tx_compnt_1_expmt || "N"}
                      onChange={(event) => {
                        const taxType = event.target.value;
                        const taxPerc = taxType === "S" ? 5 : 0;
                        const taxAmt = taxType === "S" ? (Number(lineAmount(row)) || 0) * (taxPerc / 100) : 0;
                        updateRow(row.id, {
                          tx_compnt_1_expmt: taxType,
                          tx_compnt_perc_1: taxPerc,
                          tx_compnt_amt_1: taxAmt,
                        });
                      }}
                    >
                      <option value="N">No Tax</option>
                      <option value="S">Std Tax</option>
                      <option value="Z">Zero</option>
                      <option value="E">Exempt</option>
                    </Select>
                  </td>)}
                  {showAllColumns && (<td className="w-32 px-2 py-1">
                    <LookupField
                      label="Tax Category"
                      compact
                      placeholder="Tax code"
                      value={row.tx_cat_code || ""}
                      displayValue={
                        row.tx_cat_name
                          ? `${row.tx_cat_code} - ${row.tx_cat_name}`
                          : row.tx_cat_code || ""
                      }
                      columns={[
                        { field: "tx_cat_code", header: "Code" },
                        { field: "tx_cat_name", header: "Name" }
                      ]}
                      valueField="tx_cat_code"
                      displayFields={["tx_cat_code", "tx_cat_name"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CATEGORY",
                          code1: companyCode
                        })
                      }
                      onChange={(value, selectedRow) => {
                        updateRow(row.id, {
                          tx_cat_code: text(value),
                          // tx_cat_name: text(
                          //   getLookupValue(selectedRow || {}, "tx_cat_name")
                          // ),
                        });
                      }}
                    />
                  </td>)}
                  {showAllColumns && (<td className="w-32 px-2 py-1">
                    <LookupField
                      label="Tax Code"
                      compact
                      placeholder="Tax code"
                      value={row.tx_compntcat_code_1 || ""}
                      displayValue={
                        row.tx_compntcat_name
                          ? `${row.tx_compntcat_code_1} - ${row.tx_compntcat_name}`
                          : row.tx_compntcat_code_1 || ""
                      }
                      columns={[
                        { field: "tx_compntcat_code", header: "Code" },
                        { field: "tx_compntcat_name", header: "Name" }
                      ]}
                      valueField="tx_compntcat_code"
                      displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE",
                          code1: companyCode
                        })
                      }
                      disabled={headerAndLineDisabled}
                      onChange={(value, selectedRow) => {
                        updateRow(row.id, {
                          tx_compntcat_code_1: text(value),
                          // tx_compntcat_name_1: text(
                          //   getLookupValue(selectedRow || {}, "tx_compntcat_name")
                          // ),
                        });
                      }}
                    />
                  </td>)}
                  {showAllColumns && (<td className={AMOUNT_CELL}>
                    {formatAmount(taxLcurrAmountValue)}
                  </td>)}
                  {showAllColumns && (<td className={`w-32 ${AMOUNT_CELL}`}>
                    {formatAmount(LcurrDisAmount(row, ex_rate))}
                  </td>)}
                  {showAllColumns && (<td className="w-32 px-2 py-1">
                    <Input className={INPUT_BG} type="date" disabled={headerAndLineDisabled} value={row.required_dt} onChange={(event) => updateRow(row.id, { required_dt: event.target.value })} />
                  </td>)}
                  {showAllColumns && (<td className="w-40 px-2 py-1 border border-gray-300 rounded-md">
                    <textarea className="bg-white disabled:bg-slate-100 disabled:text-slate-500" disabled={headerAndLineDisabled} value={row.line_remarks} onChange={(event) => updateRow(row.id, { line_remarks: event.target.value })} />
                  </td>)}

                  <td className="finance-sticky-col-right px-1 py-1 text-center">
                    <button
                      type="button"
                      disabled={headerAndLineDisabled}
                      title="Delete row"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div
        className="commercial-lines-footer flex flex-wrap items-center justify-end border-t border-[#cbd5e1] px-3 py-2 gap-3"
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          backgroundColor: "#f8fafc",
          boxShadow: "0 -2px 6px rgba(0,0,0,0.06)",
          fontSize: 14
        }}
      >
        {/* <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total Qty (Puom)</span>
          <strong>{totalQtyPuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total Qty (Luom)</span>
          <strong>{totalQtyLuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div> */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Amount Before Discount</span>
          <strong className="text-emerald-600">{formatAmount(totalAmountDisct)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Discount</span>
          <strong>{formatAmount(TotalDiscAmount(rows))}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Amount Before Tax</span>
          <strong>{formatAmount(grandTotal)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Tax</span>
          <strong>{formatAmount(totalTaxAmount)}</strong>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1">
          <span className="font-semibold text-[#00378C]">Amount After Tax</span>
          <strong className="text-sm text-emerald-600">{formatAmount(finalTotal)}</strong>
        </div>
      </div>
    </div>
  );
}