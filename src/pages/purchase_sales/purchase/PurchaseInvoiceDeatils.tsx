import { Plus, X } from "lucide-react";
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

  numberOrZero,
  text,
  lineLcurrAmount,   // add
  computeQuantity,   // add
  isSameUom,
  taxLcurrAmount,
  lineDiscPoPrice,
  linePOAmount,
  lineLcurrPOAmount,
  lineNetPOAmount,
  taxLcurrpoAmount,
  lineTaxpoAmount,
  LcurrDisAmount,
  lineTaxAmount,
  amountBeforeDiscPrice,
} from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";
import { Select } from "../../../components/ui/Select";

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
      ? { width: STICKY_COLS.product.width, left: showExtraCol ? 260 : STICKY_COLS.product.left }
      : STICKY_COLS[col];

  return { position: "sticky", left, width, minWidth: width, maxWidth: width, zIndex: 2, backgroundColor: "var(--card, #fff)" };
}

function stickyHeaderStyle(col: keyof typeof STICKY_COLS, docType?: string | null): React.CSSProperties {
  const showExtraCol = hasExtraStickyColumn(docType);

  const { width, left } =
    col === "product"
      ? { width: STICKY_COLS.product.width, left: showExtraCol ? 260 : STICKY_COLS.product.left }
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
function finalRate(row: PurchaseOrderLineRow): number {
  const price = numberOrZero(row.unit_price);

  const discPct = numberOrZero(row.disc_percent);
  return price - (price * discPct) / 100;
}

function finalPORate(row: PurchaseOrderLineRow): number {
  const price = numberOrZero(row.porder_unit_price);

  const discPct = numberOrZero(row.porder_disc_percent);
  return price - (price * discPct) / 100;
}


// Total Amount (net, post-discount) = Net Qty * Final Rate  [sheet's "Total Amout" column]
function netTotalAmount(quantity: number, row: PurchaseOrderLineRow): number {
  return quantity * finalRate(row);
}

// Lcurr Amount = Total Amount * Final Rate  (=L2*K2 in the sheet)
function computeLcurrAmount(quantity: number, row: PurchaseOrderLineRow): number {
  return netTotalAmount(quantity, row) * finalRate(row) * numberOrZero(row.ex_rate);
}

export function PurchaseInvoiceLinesTable({
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
  setdetails?: (rows: PurchaseOrderLineRow[]) => void;
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
  const totalAmount = rows.reduce((sum, row) => sum + linePOAmount(row), 0);
  const totalDiscPrice = rows.reduce((sum, row) => sum + lineDiscPoPrice(row), 0);
  const totalTaxAmount = rows.reduce((sum, row) => sum + lineTaxpoAmount(row), 0);
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
        {/* <div className="flex items-center gap-2">
          <Button disabled={headerAndLineDisabled} size="sm" type="button" variant="outline" onClick={addRow}>
            <Plus size={14} /> Add Line
          </Button>
        </div> */}
      </div>
      <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
         <table className="finance-lines-table w-full min-w-[2600px] text-sm" style={{ tableLayout: "fixed" }}>
          <thead className="text-xs text-primary-foreground">
            <tr>
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("sno")}>SNo</th>
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("div")}>Div</th>
              <th className="finance-sticky-col px-2 py-2 text-left w-32" style={stickyHeaderStyle("zone")}>Zone</th>
              {/* {hasGrnColumn(docType) && (
                <th className="finance-sticky-col px-2 py-2 text-left w-32" style={stickyHeaderStyle("GRN")}>GRN</th>
              )} */}
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("product", docType)}>Product Code</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(80)}>P Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(80)}>Qty Puom</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(80)}>L Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(80)}>Qty Luom</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(80)}>Uppp</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(100)}>Unit Price</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(100)}>Quantity</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(110)}>Amount Before Disc</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(96)}>Disc %</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(90)}>Disc Price(Per Unit)</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(90)}>Unit price Net Amt</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(112)}>Amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(128)}>Lcurr Amount Before Tax</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(96)}>Tax Type</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(60)}>Tax %</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(110)}>Tax Amount</th>
              <th className="px-2 py-2 text-left" style={plainHeaderStyle(128)}>Req Date</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(160)}>Remarks</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(120)}>Tax Cat</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(96)}>Tax code</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(112)}>Tax Lcurr amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left" style={plainHeaderStyle(128)}>Lcurr amount After Tax</th>
              <th className="px-2 py-2 text-left" style={plainHeaderStyle(64)}>Action</th>
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
              const taxLcurrAmountValue = taxLcurrpoAmount(row, ex_rate);
              const taxLcurrAmountpoValue = taxLcurrpoAmount(row, ex_rate);

              return (
                <tr className="border-t odd:bg-muted/20" key={row.id}>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("sno")}>{index + 1}</td>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("div")}>
                    <Input disabled={headerAndLineDisabled} value={row.porder_div_code} onChange={(event) => updateRow(row.id, { porder_div_code: event.target.value })} />
                  </td>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs w-32" style={stickyStyle("zone")}>
                    <LookupField
                      label=""
                      value={row.porder_zone_code || ""}
                      displayValue={row.porder_zone_code}
                      columns={[{ field: "zone_code", header: "Code" }, { field: "zone_name", header: "Name" }]}
                      valueField="zone_code"
                      displayFields={["zone_code", "zone_name"]}
                      loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_ZONE_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                      disabled={headerAndLineDisabled}
                      onChange={(value, selectedRow) => updateRow(row.id, {
                        porder_zone_code: value,

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

                  <td className="px-2 py-1">
                    <Input
                      className="finance-money-input w-full"
                      disabled
                      value={row.p_uom || ""}
                      readOnly
                    />
                  </td>
                  <td className="finance-amount-cell px-2 py-1">
                    <Input
                      className="finance-money-input"
                      disabled={headerAndLineDisabled || sameUom}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={sameUom ? 0 : row.qty_puom}
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
                  <td className="px-2 py-1">
                    <Input
                      className="finance-money-input w-full"
                      disabled
                      value={row.l_uom || ""}
                      readOnly
                    />
                  </td>
                  <td className="finance-amount-cell w-24 px-2 py-1">
                    <Input
                      className="finance-money-input"
                      disabled={headerAndLineDisabled}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.001"
                      value={row.qty_luom}
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
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.0001" value={row.unit_price} onChange={(event) => updateRow(row.id, { unit_price: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell px-2 py-1 text-right">
                    {formatAmount(quantity)}
                  </td>
                  <td className="finance-amount-cell px-2 py-1 text-right">
                    {formatAmount(amountBeforeDiscPrice(row))}
                  </td>
                  <td className="finance-amount-cell w-24 px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.disc_percent} onChange={(event) => updateRow(row.id, { disc_percent: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineDiscPrice(row))}</td>
                  <td className="finance-amount-cell px-2 py-1 text-right">{formatAmount(finalRate(row))}</td>
                  <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineAmount(row))}</td>
                  <td className="finance-amount-cell w-32 px-2 py-1 text-right">
                    {formatAmount(lcurrAmountValue)}
                  </td>
                  <td className="w-40 px-2 py-1">
                    <Select
                      value={row.porder_tx_compnt_1_expmt || "N"}
                      onChange={(event) => {
                        const taxType = event.target.value;
                        const taxPerc = taxType === "S" ? 5 : 0;
                        {/* FIX #1: call linePOAmount(row), not the bare function reference */ }
                        const taxAmt = taxType === "S" ? (Number(lineAmount(row)) || 0) * (taxPerc / 100) : 0;
                        updateRow(row.id, {
                          porder_tx_compnt_1_expmt: taxType,
                          porder_tx_compnt_perc_1: taxPerc,
                          porder_tx_compnt_amt_1: taxAmt,
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
                    {/* FIX #2: write to porder_tx_compnt_perc_1, matching the displayed value */}
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.porder_tx_compnt_perc_1} onChange={(event) => updateRow(row.id, { porder_tx_compnt_perc_1: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineTaxpoAmount(row))}</td>

                  <td className="w-32 px-2 py-1">
                    <Input type="date" disabled={headerAndLineDisabled} value={row.porder_required_dt} onChange={(event) => updateRow(row.id, { porder_required_dt: event.target.value })} />
                  </td>
                  <td className="w-40 px-2 py-1 border border-gray-300 rounded-md">
                    <textarea disabled={headerAndLineDisabled} value={row.porder_remarks} onChange={(event) => updateRow(row.id, { porder_remarks: event.target.value })} />
                  </td>


                  <td className="w-32 px-2 py-1">
                    {/* FIX #3: read porder_tx_cat_code so the field reflects what onChange writes */}
                    <LookupField
                      label="Tax Category"
                      compact
                      placeholder="Tax code"
                      value={row.porder_tx_cat_code || ""}
                      displayValue={
                        row.porder_tx_cat_name
                          ? `${row.porder_tx_cat_code} - ${row.porder_tx_cat_name}`
                          : row.porder_tx_cat_code || ""
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
                          porder_tx_cat_code: text(value),
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
                      value={row.porder_tx_compntcat_code_1 || ""}
                      displayValue={
                        row.porder_tx_compntcat_name_1
                          ? `${row.porder_tx_compntcat_code_1} - ${row.porder_tx_compntcat_name_1}`
                          : row.porder_tx_compntcat_code_1 || ""
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
                          porder_tx_compntcat_code_1: text(value),
                          // tx_compntcat_name_1: text(
                          //   getLookupValue(selectedRow || {}, "tx_compntcat_name")
                          // ),
                        });
                      }}
                    />
                  </td>
                  <td className="finance-amount-cell w-32 px-2 py-1 text-right">
                    {formatAmount(taxLcurrAmountValue)}
                  </td>
                  <td className="finance-amount-cell w-32 px-2 py-1 text-right">
                    {formatAmount(lineLcurrAmount(row, ex_rate) + taxLcurrAmount(row, ex_rate))}
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