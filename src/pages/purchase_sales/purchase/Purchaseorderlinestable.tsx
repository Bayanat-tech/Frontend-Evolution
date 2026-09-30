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
  zone: { width: 160, left: 100 },
  PO: { width: 180, left: 260 },
  product: {
    width: 260,
    left: 260,
  },
} as const;

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

function stickyStyle(col: keyof typeof STICKY_COLS, docType?: string | null): React.CSSProperties {
  const showExtraCol = hasExtraStickyColumn(docType);

  const { width, left } =
    col === "product"
      ? { width: STICKY_COLS.product.width, left: showExtraCol ? 320 : STICKY_COLS.product.left }
      : STICKY_COLS[col];

  return { position: "sticky", left, width, minWidth: width, maxWidth: width, zIndex: 2, backgroundColor: "var(--card, #fff)" };
}

function stickyHeaderStyle(col: keyof typeof STICKY_COLS, docType?: string | null): React.CSSProperties {
  const showExtraCol = hasExtraStickyColumn(docType);

  const { width, left } =
    col === "product"
      ? { width: STICKY_COLS.product.width, left: showExtraCol ? 320 : STICKY_COLS.product.left }
      : STICKY_COLS[col];

  return { position: "sticky", top: 0, left, width, minWidth: width, maxWidth: width, zIndex: 3, backgroundColor: "var(--primary, #1d4ed8)" };
}
const plainHeaderStyle = (width?: number): React.CSSProperties => ({
  position: "sticky",
  top: 0,
  zIndex: 1,
  backgroundColor: "var(--primary, #1d4ed8)",
  width,
  minWidth: width,
});

const TABLE_COLUMN_COUNT = 24;

// Final Rate = Unit Price - (Unit Price * Disc % / 100)  [matches lineNetAmount / "Final Rate" in the sheet]
// function finalRate(row: PurchaseOrderLineRow): number {
//   const price =
//     Math.trunc(numberOrZero(row.unit_price) * 1_000_000) / 1_000_000;

//   const discPct =
//     Math.trunc(numberOrZero(row.disc_percent) * 1_000_000) / 1_000_000;

//   const rate = price - (price * discPct) / 100;

//   return Math.trunc(rate * 1_000_000) / 1_000_000;
// }
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
        <table className={`finance-lines-table w-full text-xs ${showAllColumns ? "min-w-[1980px]" : "min-w-full"}`}>
          <thead className="sticky top-0 bg-[#00378C] text-xs font-semibold text-white shadow-sm z-10">
            <tr>
              <th className="finance-sticky-col px-2 py-2 text-center" style={stickyHeaderStyle("sno")}>SNo</th>
              <th className="finance-sticky-col px-2 py-2 text-center" style={stickyHeaderStyle("div")}>Div</th>
              <th className="finance-sticky-col px-2 py-2 text-center w-32" style={stickyHeaderStyle("zone")}>Zone</th>
              {/* {hasGrnColumn(docType) && (
                <th className="finance-sticky-col px-2 py-2 text-center w-32" style={stickyHeaderStyle("GRN")}>GRN</th>
              )} */}

              <th className="finance-sticky-col px-2 py-2 text-center" style={stickyHeaderStyle("product", docType)}>Product Code</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(80)}>P Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(20)}>Qty Puom</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(80)}>L Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(70)}>Qty Luom</th>
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(60)}>Uppp</th>}
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(110)}>Unit Price</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90)}>Quantity</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(110)}>Amount Before Disc</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90)}>Disc %</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90)}>Disc Amount</th>
              {/* <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90)}>Unit price Net Amt</th> */}
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(112)}>Final Amount</th>
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(120)}>Lcurr Amount Before Tax</th>
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(100)}>Tax Type</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(60)}>Tax %</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(100)}>Tax Amount</th>}
              {showAllColumns && <th className="px-2 py-2 text-center" style={plainHeaderStyle(150)}>Req Date</th>}
              <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(160)}>Remarks</th>
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(120)}>Tax Cat</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(96)}>Tax code</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(112)}>Tax Lcurr amount</th>}
              {showAllColumns && <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(128)}>Lcurr amount After Tax</th>}
              <th className="finance-sticky-col-right px-2 py-2 text-center" style={plainHeaderStyle(64)}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={showAllColumns ? 26 : 16}>No detail lines yet — click "Add Line" to get started</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={showAllColumns ? 26 : 16}>No lines match "<strong>{lineSearch}</strong>"</td></tr>
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
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("sno")}>{index + 1}</td>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs w-16" style={stickyStyle("div")}>
                    <Input className="w-12" disabled={headerAndLineDisabled} value={row.div_code} onChange={(event) => updateRow(row.id, { div_code: event.target.value })} />
                  </td>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs w-32" style={stickyStyle("zone")}>
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

                  <td className="finance-sticky-col finance-account-cell bg-card px-2 py-1" style={stickyStyle("product", docType)}>
                    <LookupField
                      label=""
                      value={row.prod_code || ""}
                      displayValue={row.prod_name ? `${row.prod_code} - ${row.prod_name}` : row.prod_code}
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
                  </td>

                  {/* <td className="w-12 px-2 py-1">
                    <LookupField
                      label=""
                      value={row.p_uom || ""}
                      displayValue={
                        row.p_uom
                      }
                      columns={[
                        { field: "uom_code", header: "Code" },
                        { field: "uom_name", header: "Name" },
                        { field: "unit_price", header: "Unit Price" },
                      ]}
                      valueField="uom_code"
                      displayFields={["uom_code", "uom_name"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "PS_POORDER_ENTRY_UOM_LIST",
                          code1: companyCode,
                          loginid: loginid || "ADMIN",
                        })
                      }
                      disabled={headerAndLineDisabled}
                      onChange={(value, selectedRow) => {
                        const patch: Partial<PurchaseOrderLineRow> = {
                          p_uom: value,
                          uom_name:
                            text(getLookupValue(selectedRow || {}, "uom_name")) ||
                            row.uom_name,
                        };

                        const merged = { ...row, ...patch };

                        if (isSameUom(merged)) {
                          patch.qty_puom = 0;
                        }

                        patch.quantity = computeQuantity({
                          ...row,
                          ...patch,
                        });

                        updateRow(row.id, patch);
                      }}
                    />
                  </td> */}
                  <td className="px-2 py-1">
                    <Input
                      className="finance-money-input w-full"
                      disabled
                      value={row.p_uom || ""}
                      readOnly
                    />
                  </td>
                  <td className=" px-2 py-1">
                    <Input
                      className="finance-money-input"
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
                  {/* <td className="w-64 px-2 py-1">

                    <LookupField
                      label=""
                      value={row.l_uom || ""}
                      displayValue={
                        row.l_uom
                      }
                      columns={[
                        { field: "uom_code", header: "Code" },
                        { field: "uom_name", header: "Name" },
                        { field: "unit_price", header: "Unit Price" },
                      ]}
                      valueField="uom_code"
                      displayFields={["uom_code", "uom_name"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "PS_POORDER_ENTRY_UOM_LIST",
                          code1: companyCode,
                          loginid: loginid || "ADMIN",
                        })
                      }
                      disabled={headerAndLineDisabled}
                      onChange={(value, selectedRow) => {
                        const patch: Partial<PurchaseOrderLineRow> = {
                          l_uom: value,
                          uom_name: text(getLookupValue(selectedRow || {}, "uom_name")) || row.uom_name,
                        };
                        const merged = { ...row, ...patch };
                        if (isSameUom(merged)) {
                          patch.qty_luom = qtyLuomNum;
                        }
                        patch.quantity = computeQuantity({ ...row, ...patch });
                        updateRow(row.id, patch);
                      }}
                    />
                  </td> */}
                  <td className="px-2 py-1" >
                    <Input
                      className="finance-money-input w-full"
                      disabled
                      value={row.l_uom || ""}
                      readOnly
                    />
                  </td>
                  <td className="  px-2 py-1">
                    <Input
                      className="finance-money-input"
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
                  {/* <td className="finance-amount-cell px-2 py-1">
                    <Input
                      className="finance-money-input"
                      disabled={headerAndLineDisabled}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={row.uppp}
                      onChange={(event) => {
                        const newUppp = Number(event.target.value || 0);
                        updateRow(row.id, {
                          uppp: Number(newUppp),
                          quantity: computeQuantity({ ...row, ...{ uppp: Number(newUppp) } }),
                        });
                      }}
                    />
                  </td> */}


                  {showAllColumns && (<td className=" px-2 py-1">
                    <Input
                      className="finance-money-input"
                      disabled
                      readOnly
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={row.uppp}
                    />
                  </td>)}
                  <td className="px-2 py-1">
                    <Input
                      className="finance-money-input"
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
                  <td className=" px-2 py-1 text-right">
                    {formatAmount(quantity)}
                  </td>
                  <td className=" px-2 py-1 text-right">
                    {formatAmount(amountBeforeDiscPrice(row))}
                  </td>
                  <td className=" px-2 py-1">
                    <Input
                      className="finance-money-input px-2 py-1"
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
                  {/* <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineDiscPrice(row))}</td> */}
                  <td className=" px-2 py-1">
                    <Input
                      className="finance-money-input px-2 py-1"
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
                  {/* <td className="finance-amount-cell px-2 py-1 text-right">
                    {finalRate(row).toFixed(3)}
                  </td> */}
                  <td className=" px-2 py-1 text-right">{formatAmount(lineAmount(row))}</td>
                  <td className=" px-2 py-1 text-right">
                    {formatAmount(lcurrAmountValue)}
                  </td>
                  {showAllColumns && (<td className="px-2 py-1">
                    <Select
                      value={row.tx_compnt_1_expmt || "N"}
                      onChange={(event) => {
                        const taxType = event.target.value;
                        const taxPerc = taxType === "S" ? 5 : 0;
                        const taxAmt = taxType === "S" ? (Number(lineAmount) || 0) * (taxPerc / 100) : 0;
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
                  {showAllColumns && (<td className=" px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.tx_compnt_perc_1} onChange={(event) => updateRow(row.id, { tx_compnt_perc_1: Number(event.target.value || 0) })} />
                  </td>)}
                  {showAllColumns && (<td className=" px-2 py-1 text-right">{formatAmount(lineTaxAmount(row))}</td>)}

                  {showAllColumns && (<td className="w-32 px-2 py-1">
                    <Input type="date" disabled={headerAndLineDisabled} value={row.required_dt} onChange={(event) => updateRow(row.id, { required_dt: event.target.value })} />
                  </td>)}
                  <td className="w-40 px-2 py-1 border border-gray-300 rounded-md">
                    <textarea disabled={headerAndLineDisabled} value={row.line_remarks} onChange={(event) => updateRow(row.id, { line_remarks: event.target.value })} />
                  </td>


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
                  {showAllColumns && (<td className=" px-2 py-1 text-right">
                    {formatAmount(taxLcurrAmountValue)}
                  </td>)}
                  {showAllColumns && (<td className=" w-32 px-2 py-1 text-right">
                    {formatAmount(LcurrDisAmount(row, ex_rate))}
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
          fontSize:14
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total Qty (Puom)</span>
          <strong>{totalQtyPuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Total Qty (Luom)</span>
          <strong>{totalQtyLuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
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