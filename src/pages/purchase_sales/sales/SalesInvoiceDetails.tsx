import { Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";


import { PurchaseOrderForm, SalesOrderLineRow, SODocType } from "../sales/SalesOrdertypes";
import { Select } from "../../../components/ui/Select";
import { computeQuantity, formatAmount, isSameUom, lineAmount, lineDiscPoPrice, lineDiscPrice, lineLcurrAmount, lineLcurrPOAmount, linePOAmount, lineTaxAmount, lineTaxpoAmount, numberOrZero, taxLcurrAmount, taxLcurrpoAmount, text } from "./SalesOrderutils";
import { PODocType } from "../purchase/Purchaseordertypes";

const STICKY_COLS = {
  sno: { width: 50, left: 0 },
  div: { width: 90, left: 50 },
  zone: { width: 180, left: 140 },
  PO: { width: 180, left: 320 },
  product: {
    width: 260,
    left: 320,
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
const plainHeaderStyle: React.CSSProperties = { position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "100%" };

const TABLE_COLUMN_COUNT = 24;

// Final Rate = Unit Price - (Unit Price * Disc % / 100)  [matches lineNetAmount / "Final Rate" in the sheet]
function finalRate(row: SalesOrderLineRow): number {
  const price = numberOrZero(row.unit_price);

  const discPct = numberOrZero(row.disc_percent);
  return price - (price * discPct) / 100;
}

function finalPORate(row: SalesOrderLineRow): number {
  const price = numberOrZero(row.sorder_unit_price);

  const discPct = numberOrZero(row.sorder_disc_percent);
  return price - (price * discPct) / 100;
}


// Total Amount (net, post-discount) = Net Qty * Final Rate  [sheet's "Total Amout" column]
function netTotalAmount(quantity: number, row: SalesOrderLineRow): number {
  return quantity * finalRate(row);
}

// Lcurr Amount = Total Amount * Final Rate  (=L2*K2 in the sheet)
function computeLcurrAmount(quantity: number, row: SalesOrderLineRow): number {
  return netTotalAmount(quantity, row) * finalRate(row) * numberOrZero(row.ex_rate);
}

export function SalesInvoiceLinesTable({
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
  docType
}: {
  form: PurchaseOrderForm;
  setdetails?: (rows: SalesOrderLineRow[]) => void;
  rows: SalesOrderLineRow[];
  updateRow: (id: string, patch: Partial<SalesOrderLineRow>) => void;
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
  const totalAmount = rows.reduce((sum, row) => sum + lineAmount(row), 0);
  const totalDiscPrice = rows.reduce((sum, row) => sum + lineDiscPrice(row), 0);
  const totalTaxAmount = rows.reduce((sum, row) => sum + lineTaxAmount(row), 0);
  const grandTotal = totalAmount - totalDiscPrice - discAmt;
  const finalTotal = grandTotal + totalTaxAmount;

  // Quantity is always derived, never typed directly:
  // - same UOM: quantity mirrors qty_luom
  // - different UOM: quantity = (qty_puom * uppp) + qty_luom

  return (
    <div className="commercial-lines-card rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
        <div>
          <p className="eyebrow m-0">Lines</p>
          <h3 className="m-0 text-sm font-semibold leading-tight">Purchase Order Lines</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={headerAndLineDisabled} size="sm" type="button" variant="outline" onClick={addRow}>
            <Plus size={14} /> Add Line
          </Button>
        </div>
      </div>
      <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
        <table className="finance-lines-table w-full min-w-[2600px] text-sm">
          <thead className="text-xs text-primary-foreground">
            <tr>
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("sno")}>SNo</th>
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("div")}>Div</th>
              <th className="finance-sticky-col px-2 py-2 text-left w-32" style={stickyHeaderStyle("zone")}>Zone</th>
              {/* {hasGrnColumn(docType) && (
                <th className="finance-sticky-col px-2 py-2 text-left w-32" style={stickyHeaderStyle("GRN")}>GRN</th>
              )} */}
              {hasPoColumn(docType) && (
                <th className="finance-sticky-col px-2 py-2 text-left w-32" style={stickyHeaderStyle("PO")}>PO</th>
              )}
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("product", docType)}>Product Code</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-64" style={plainHeaderStyle}>P Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Qty Puom</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>L Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-20" style={plainHeaderStyle}>Qty Luom</th>
              <th className="px-2 py-2 text-left w-24 sticky top-0 z-[3] bg-primary">Uppp</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Unit Price</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Quantity</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Disc %</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Disc Price</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Unit price Net Amt</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-32" style={plainHeaderStyle}>Lcurr Amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Tax Type</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Tax %</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-32" style={plainHeaderStyle}>Tax Amount</th>
              <th className="px-2 py-2 text-left w-32" style={plainHeaderStyle}>Req Date</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-40" style={plainHeaderStyle}>Remarks</th>

              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Tax Cat</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Tax code</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Tax Lcurr amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-32" style={plainHeaderStyle}>Lcurr amount Discount</th>
              <th className="px-2 py-2 text-left w-16" style={plainHeaderStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>No lines yet</td></tr>
            ) : rows.map((row, index) => {
              const qtyPuomNum = numberOrZero(row.qty_puom);
              const qtyLuomNum = numberOrZero(row.qty_luom);
              const upppNum = numberOrZero(row.uppp);

              const sameUom = isSameUom(row);
              const quantity = computeQuantity(row);
              const lcurrAmountValue = lineLcurrAmount(row, ex_rate);
              const lcurrAmountPOValue = lineLcurrPOAmount(row, ex_rate);
              const taxLcurrAmountValue = taxLcurrAmount(row, ex_rate);
              const taxLcurrAmountpoValue = taxLcurrpoAmount(row, ex_rate);

              return (
                <tr className="border-t odd:bg-muted/20" key={row.id}>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("sno")}>{index + 1}</td>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("div")}>
                    <Input disabled={headerAndLineDisabled} value={row.sorder_div_code} onChange={(event) => updateRow(row.id, { sorder_div_code: event.target.value })} />
                  </td>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs w-32" style={stickyStyle("zone")}>
                    <LookupField
                      label=""
                      value={row.sorder_zone_code || ""}
                      displayValue={row.sorder_zone_code}
                      columns={[{ field: "zone_code", header: "Code" }, { field: "zone_name", header: "Name" }]}
                      valueField="zone_code"
                      displayFields={["zone_code", "zone_name"]}
                      loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_ZONE_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                      disabled={headerAndLineDisabled}
                      onChange={(value, selectedRow) => updateRow(row.id, {
                        sorder_zone_code: value,

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
                        const patch: Partial<SalesOrderLineRow> = {
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

                  <td className="w-64 px-2 py-1">
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
                        const patch: Partial<SalesOrderLineRow> = {
                          p_uom: value,
                          uom_name: text(getLookupValue(selectedRow || {}, "uom_name")) || row.uom_name,
                        };
                        const merged = { ...row, ...patch };
                        if (isSameUom(merged)) {
                          patch.qty_puom = qtyLuomNum;
                        }
                        patch.quantity = computeQuantity({ ...row, ...patch });
                        updateRow(row.id, patch);
                      }}
                    />
                  </td>
                  <td className="finance-amount-cell px-2 py-1">
                    <Input
                      className="finance-money-input"
                      disabled={headerAndLineDisabled || sameUom}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={sameUom ? qtyLuomNum : row.qty_puom}
                      onChange={(event) => {
                        const newQtyPuom = Number(event.target.value || 0);
                        const patch = { qty_puom: newQtyPuom };
                        updateRow(row.id, {
                          ...patch,
                          quantity: computeQuantity({ ...row, ...patch }),
                        });
                      }}
                    />
                  </td>
                  <td className="w-64 px-2 py-1">
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
                        const patch: Partial<SalesOrderLineRow> = {
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
                  </td>
                  <td className="finance-amount-cell w-24 px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.001" value={row.qty_luom} onChange={(event) => {
                      const newQtyLuom = Number(event.target.value || 0);
                      const patch: Partial<SalesOrderLineRow> = { qty_luom: newQtyLuom };
                      if (sameUom) {
                        patch.qty_puom = newQtyLuom;
                        patch.quantity = newQtyLuom;
                      } else {
                        patch.quantity = computeQuantity({ ...row, ...patch });
                      }
                      updateRow(row.id, patch);
                    }} />
                  </td>
                  <td className="finance-amount-cell px-2 py-1">
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
                  </td>
                  <td className="finance-amount-cell w-28 px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.0001" value={row.sorder_unit_price} onChange={(event) => updateRow(row.id, { sorder_unit_price: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell px-2 py-1 text-right">
                    {formatAmount(quantity)}
                  </td>

                  <td className="finance-amount-cell w-24 px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.sorder_disc_percent} onChange={(event) => updateRow(row.id, { sorder_disc_percent: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineDiscPoPrice(row))}</td>
                  <td className="finance-amount-cell px-2 py-1 text-right">{formatAmount(finalPORate(row))}</td>
                  <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(linePOAmount(row))}</td>
                  <td className="finance-amount-cell w-32 px-2 py-1 text-right">
                    {formatAmount(lcurrAmountPOValue)}
                  </td>
                  <td className="w-40 px-2 py-1">
                    <Select
                      value={row.sorder_tx_compnt_1_expmt || "N"}
                      onChange={(event) => {
                        const taxType = event.target.value;
                        const taxPerc = taxType === "S" ? 5 : 0;
                        {/* FIX #1: call linePOAmount(row), not the bare function reference */}
                        const taxAmt = taxType === "S" ? (Number(linePOAmount(row)) || 0) * (taxPerc / 100) : 0;
                        updateRow(row.id, {
                          sorder_tx_compnt_1_expmt: taxType,
                          sorder_tx_compnt_perc_1: taxPerc,
                          sorder_tx_compnt_amt_1: taxAmt,
                        });
                      }}
                    >
                      <option value="N">No Tax</option>
                      <option value="S">Std Tax</option>
                      <option value="Z">Zero</option>
                      <option value="E">Exempt</option>
                    </Select>
                  </td>
                  <td className="finance-amount-cell w-24 px-2 py-1">
                    {/* FIX #2: write to sorder_tx_compnt_perc_1, matching the displayed value */}
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.sorder_tx_compnt_perc_1} onChange={(event) => updateRow(row.id, { sorder_tx_compnt_perc_1: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineTaxpoAmount(row))}</td>

                  <td className="w-32 px-2 py-1">
                    <Input type="date" disabled={headerAndLineDisabled} value={row.sorder_required_dt} onChange={(event) => updateRow(row.id, { sorder_required_dt: event.target.value })} />
                  </td>
                  <td className="w-40 px-2 py-1 border border-gray-300 rounded-md">
                    <textarea disabled={headerAndLineDisabled} value={row.line_remarks} onChange={(event) => updateRow(row.id, { line_remarks: event.target.value })} />
                  </td>


                  <td className="w-32 px-2 py-1">
                    {/* FIX #3: read sorder_tx_cat_code so the field reflects what onChange writes */}
                    <LookupField
                      label="Tax Category"
                      compact
                      placeholder="Tax code"
                      value={row.sorder_tx_cat_code || ""}
                      displayValue={
                        row.sorder_tx_cat_name
                          ? `${row.sorder_tx_cat_code} - ${row.sorder_tx_cat_name}`
                          : row.sorder_tx_cat_code || ""
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
                          sorder_tx_cat_code: text(value),
                          // tx_cat_name: text(
                          //   getLookupValue(selectedRow || {}, "tx_cat_name")
                          // ),
                        });
                      }}
                    />
                  </td>
                  <td className="w-32 px-2 py-1">
                    <LookupField
                      label="Tax Code"
                      compact
                      placeholder="Tax code"
                      value={row.sorder_tx_compntcat_code_1 || ""}
                      displayValue={
                        row.sorder_tx_compntcat_name_1
                          ? `${row.sorder_tx_compntcat_code_1} - ${row.sorder_tx_compntcat_name_1}`
                          : row.sorder_tx_compntcat_code_1 || ""
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
                          sorder_tx_compntcat_code_1: text(value),
                          // tx_compntcat_name_1: text(
                          //   getLookupValue(selectedRow || {}, "tx_compntcat_name")
                          // ),
                        });
                      }}
                    />
                  </td>
                  <td className="finance-amount-cell w-32 px-2 py-1 text-right">
                    {formatAmount(taxLcurrAmountpoValue)}
                  </td>
                  <td className="finance-amount-cell w-32 px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.lcur_amount_disc} onChange={(event) => updateRow(row.id, { lcur_amount_disc: Number(event.target.value || 0) })} />
                  </td>
                  <td className="px-2 py-1">
                    <Button disabled={headerAndLineDisabled} size="icon" type="button" variant="ghost" onClick={() => removeRow(row.id)}><X size={14} /></Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-t px-3 py-2 text-sm max-md:grid-cols-1">
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Total Qty (Puom)</span>
          <strong>{totalQtyPuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Total Qty (Luom)</span>
          <strong>{totalQtyLuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Amount Total</span>
          <strong className="text-emerald-600">{formatAmount(totalAmount)}</strong>
        </div>
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Discount</span>
          <strong>{formatAmount(totalDiscPrice + discAmt)}</strong>
        </div>
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Total</span>
          <strong>{formatAmount(grandTotal)}</strong>
        </div>
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Tax</span>
          <strong>{formatAmount(totalTaxAmount)}</strong>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-8 border-t pt-1 max-md:col-span-1">
          <span className="font-semibold text-muted-foreground">Total</span>
          <strong className="text-base text-emerald-600">{formatAmount(finalTotal)}</strong>
        </div>
      </div>
    </div>
  );
}