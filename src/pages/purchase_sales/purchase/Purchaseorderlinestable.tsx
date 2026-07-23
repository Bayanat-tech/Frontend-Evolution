import { Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { PurchaseOrderLineRow } from "./Purchaseordertypes";
import {
  formatAmount,
  lineAmount,
  lineDiscPrice,
  lineNetAmount,
  lineTaxAmount,
  numberOrZero,
  text,
} from "./Purchaseorderutils";

const STICKY_COLS = {
  sno: { width: 50, left: 0 },
  div: { width: 90, left: 50 },
  zone: { width: 200, left: 140 },
  product: { width: 260, left: 230 },
} as const;

function stickyStyle(col: keyof typeof STICKY_COLS): React.CSSProperties {
  const { width, left } = STICKY_COLS[col];
  return { position: "sticky", left, width, minWidth: width, maxWidth: width, zIndex: 2, backgroundColor: "var(--card, #fff)" };
}

function stickyHeaderStyle(col: keyof typeof STICKY_COLS): React.CSSProperties {
  const { width, left } = STICKY_COLS[col];
  return { position: "sticky", top: 0, left, width, minWidth: width, maxWidth: width, zIndex: 3, backgroundColor: "var(--primary, #1d4ed8)" };
}

const plainHeaderStyle: React.CSSProperties = { position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)" };

const TABLE_COLUMN_COUNT = 24;

export function PurchaseOrderLinesTable({
  rows,
  updateRow,
  addRow,
  removeRow,
  headerAndLineDisabled,
  discAmt,
  companyCode,
  loginid,
}: {
  rows: PurchaseOrderLineRow[];
  updateRow: (id: string, patch: Partial<PurchaseOrderLineRow>) => void;
  addRow: () => void;
  removeRow: (id: string) => void;
  headerAndLineDisabled: boolean;
  discAmt: number;
  companyCode?: string;
  loginid?: string;
}) {
  const totalQtyPuom = rows.reduce((sum, row) => sum + (Number(row.qty_puom) || 0), 0);
  const totalQtyLuom = rows.reduce((sum, row) => sum + (Number(row.qty_luom) || 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + lineAmount(row), 0);
  const totalDiscPrice = rows.reduce((sum, row) => sum + lineDiscPrice(row), 0);
  const totalTaxAmount = rows.reduce((sum, row) => sum + lineTaxAmount(row), 0);
  const grandTotal = totalAmount - totalDiscPrice - discAmt;
  const finalTotal = grandTotal + totalTaxAmount;

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
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("product")}>Product Code</th>
              <th className="px-2 py-2 text-left w-24" style={plainHeaderStyle}>P Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Qty Puom</th>
              <th className="px-2 py-2 text-left w-24" style={plainHeaderStyle}>L Uom</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-20" style={plainHeaderStyle}>Qty Luom</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Unit Price</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Disc %</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Disc Price</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Unit price Net Amt</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Quantity</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-24" style={plainHeaderStyle}>Tax %</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-32" style={plainHeaderStyle}>Tax Amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-32" style={plainHeaderStyle}>Lcurr Amount</th>
              <th className="px-2 py-2 text-left w-32" style={plainHeaderStyle}>Req Date</th>
              <th className="px-2 py-2 text-left w-40" style={plainHeaderStyle}>Remarks</th>
              <th className="px-2 py-2 text-left w-24" style={plainHeaderStyle}>Tax Cat</th>
              <th className="px-2 py-2 text-left w-24" style={plainHeaderStyle}>Tax code</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-28" style={plainHeaderStyle}>Tax Lcurr amount</th>
              <th className="finance-amount-cell px-2 py-2 text-left w-32" style={plainHeaderStyle}>Lcurr amount Discount</th>
              <th className="px-2 py-2 text-left w-16" style={plainHeaderStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>No lines yet</td></tr>
            ) : rows.map((row, index) => (
              <tr className="border-t odd:bg-muted/20" key={row.id}>
                <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("sno")}>{index + 1}</td>
                <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("div")}>
                  <Input disabled={headerAndLineDisabled} value={row.div_code} onChange={(event) => updateRow(row.id, { div_code: event.target.value })} />
                </td>
                <td className="finance-sticky-col bg-card px-2 py-1 text-xs w-32" style={stickyStyle("zone")}>
                   <LookupField
                    label=""
                    value={row.zone_code || ""}
                    displayValue={row.zone_name ? `${row.zone_code} - ${row.zone_name}` : row.zone_code}
                    columns={[{ field: "zone_code", header: "Code" }, { field: "zone_name", header: "Name" }]}
                    valueField="zone_code"
                    displayFields={["zone_code", "zone_name"]}
                    loadOptions={() => getDynamicLookup({ parameter: "POORDER_ENTRY_ZONE_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                    disabled={headerAndLineDisabled}
                    onChange={(value, selectedRow) => updateRow(row.id, {
                      zone_code: value,
                      zone_name: text(getLookupValue(selectedRow || {}, "zone_name")),
                    })}
                  />
                </td>
                <td className="finance-sticky-col finance-account-cell bg-card px-2 py-1" style={stickyStyle("product")}>
                  <LookupField
                    label=""
                    value={row.prod_code || ""}
                    displayValue={row.prod_name ? `${row.prod_code} - ${row.prod_name}` : row.prod_code}
                    columns={[{ field: "prod_code", header: "Code" }, { field: "prod_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                    valueField="prod_code"
                    displayFields={["prod_code", "prod_name"]}
                    loadOptions={() => getDynamicLookup({ parameter: "POORDER_ENTRY_PRODUCT_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                    disabled={headerAndLineDisabled}
                    onChange={(value, selectedRow) => updateRow(row.id, {
                      prod_code: value,
                      prod_name: text(getLookupValue(selectedRow || {}, "prod_name")),
                      p_uom: text(getLookupValue(selectedRow || {}, "p_uom")) || row.p_uom,
                      unit_price: numberOrZero(getLookupValue(selectedRow || {}, "unit_price")) || row.unit_price,
                    })}
                  />
                </td>

                <td className="w-28 px-2 py-1">
                   <LookupField
                    label=""
                    value={row.uom_code || ""}
                    displayValue={row.uom_name ? `${row.uom_code} - ${row.uom_name}` : row.uom_code}
                    columns={[{ field: "uom_code", header: "Code" }, { field: "uom_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                    valueField="uom_code"
                    displayFields={["uom_code", "uom_name"]}
                    loadOptions={() => getDynamicLookup({ parameter: "POORDER_ENTRY_UOM_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                    disabled={headerAndLineDisabled}
                    onChange={(value, selectedRow) => updateRow(row.id, {
                      uom_code: value,
                      uom_name: text(getLookupValue(selectedRow || {}, "uom_name")),
                    })}
                  />
                </td>
                <td className="finance-amount-cell w-24 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.001" value={row.qty_puom} onChange={(event) => updateRow(row.id, { qty_puom: Number(event.target.value || 0) })} />
                </td>
                <td className="w-32 px-2 py-1">
                  <LookupField
                    label=""
                    value={row.uom_code || ""}
                    displayValue={row.uom_name ? `${row.uom_code} - ${row.uom_name}` : row.uom_code}
                    columns={[{ field: "uom_code", header: "Code" }, { field: "uom_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                    valueField="uom_code"
                    displayFields={["uom_code", "uom_name"]}
                    loadOptions={() => getDynamicLookup({ parameter: "POORDER_ENTRY_UOM_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                    disabled={headerAndLineDisabled}
                    onChange={(value, selectedRow) => updateRow(row.id, {
                      uom_code: value,
                      uom_name: text(getLookupValue(selectedRow || {}, "uom_name")),
                     
                    })}
                  />
                </td>
                <td className="finance-amount-cell w-24 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.001" value={row.qty_luom} onChange={(event) => updateRow(row.id, { qty_luom: Number(event.target.value || 0) })} />
                </td>
                <td className="finance-amount-cell w-28 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.0001" value={row.unit_price} onChange={(event) => updateRow(row.id, { unit_price: Number(event.target.value || 0) })} />
                </td>
                <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineAmount(row))}</td>
                <td className="finance-amount-cell w-24 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.disc_pct} onChange={(event) => updateRow(row.id, { disc_pct: Number(event.target.value || 0) })} />
                </td>
                <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineDiscPrice(row))}</td>
                <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineNetAmount(row))}</td>
                <td className="finance-amount-cell w-28 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.qty} onChange={(event) => updateRow(row.id, { qty: Number(event.target.value || 0) })} />
                </td>
                <td className="finance-amount-cell w-24 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.tax_pct} onChange={(event) => updateRow(row.id, { tax_pct: Number(event.target.value || 0) })} />
                </td>
                <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineTaxAmount(row))}</td>
                <td className="finance-amount-cell w-28 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.lcurr_amount} onChange={(event) => updateRow(row.id, { lcurr_amount: Number(event.target.value || 0) })} />
                </td>
                <td className="w-32 px-2 py-1">
                  <Input type="date" disabled={headerAndLineDisabled} value={row.req_date} onChange={(event) => updateRow(row.id, { req_date: event.target.value })} />
                </td>
                <td className="w-40 px-2 py-1">
                  <Input disabled={headerAndLineDisabled} value={row.line_remarks} onChange={(event) => updateRow(row.id, { line_remarks: event.target.value })} />
                </td>
                <td className="w-32 px-2 py-1">
                  <Input disabled={headerAndLineDisabled} value={row.tax_cat} onChange={(event) => updateRow(row.id, { tax_cat: event.target.value })} />
                </td>
                <td className="w-32 px-2 py-1">
                  <Input disabled={headerAndLineDisabled} value={row.tax_code} onChange={(event) => updateRow(row.id, { tax_code: event.target.value })} />
                </td>
                <td className="finance-amount-cell w-28 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.tax_lcurr_amount} onChange={(event) => updateRow(row.id, { tax_lcurr_amount: Number(event.target.value || 0) })} />
                </td>
                <td className="finance-amount-cell w-32 px-2 py-1">
                  <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.lcurr_amount_disc} onChange={(event) => updateRow(row.id, { lcurr_amount_disc: Number(event.target.value || 0) })} />
                </td>
                <td className="px-2 py-1">
                  <Button disabled={headerAndLineDisabled} size="icon" type="button" variant="ghost" onClick={() => removeRow(row.id)}><X size={14} /></Button>
                </td>
              </tr>
            ))}
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