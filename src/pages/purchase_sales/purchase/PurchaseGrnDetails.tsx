
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
    lineTaxAmount,
    numberOrZero,
    text,
    lineLcurrAmount,   // add
    computeQuantity,   // add
    isSameUom,
    isSamePoUom,
    taxLcurrAmount,
    computePoQuantity,
} from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";
import { Select } from "../../../components/ui/Select";



function hasExtraStickyColumn(docType?: string | null): boolean {
    const code = String(docType ?? "").trim().toUpperCase();
    return code === "PIN" || code === "GRN" || code === "SIN";
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

// Total Amount (net, post-discount) = Net Qty * Final Rate  [sheet's "Total Amout" column]
function netTotalAmount(quantity: number, row: PurchaseOrderLineRow): number {
    return quantity * finalRate(row);
}

// Lcurr Amount = Total Amount * Final Rate  (=L2*K2 in the sheet)
function computeLcurrAmount(quantity: number, row: PurchaseOrderLineRow): number {
    return netTotalAmount(quantity, row) * finalRate(row) * numberOrZero(row.ex_rate);
}

export function PurchaseGrnDetailsTable({
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
                    <h3 className="m-0 text-sm font-semibold leading-tight"></h3>
                </div>
                {/* <div className="flex items-center gap-2">
                    <Button disabled={headerAndLineDisabled} size="sm" type="button" variant="outline" onClick={addRow}>
                        <Plus size={14} /> Add Line
                    </Button>
                </div> */}
            </div>
            <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
                <table className="finance-lines-table w-full min-w-[1500px] text-sm" style={{ tableLayout: "fixed" }}>
                    <thead className="text-xs text-primary-foreground">
                        <tr>
                            <th className="finance-sticky-col px-1 py-1 text-center" style={plainHeaderStyle(0.5)}>SNo</th>
                            <th className="finance-sticky-col px-1 py-1 text-center" style={plainHeaderStyle(1)}>Div</th>
                            <th className="finance-sticky-col px-2 py-2 text-center" style={plainHeaderStyle(50)}>Product Code</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-64" style={plainHeaderStyle(5)}>P Uom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-24" style={plainHeaderStyle(10)}>Qty Puom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-24" style={plainHeaderStyle(10)}>L Uom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-20" style={plainHeaderStyle(10)}>Qty Luom</th>
                            <th className="px-2 py-2 text-center w-24 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle(10)}>Uppp</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-28" style={plainHeaderStyle(10)}>Unit Price</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-28" style={plainHeaderStyle(20)}>Quantity</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-64" style={plainHeaderStyle(10)}>Recevied P Uom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-24" style={plainHeaderStyle(10)}>Recevied Qty Puom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-24" style={plainHeaderStyle(10)}>Recevied L Uom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-20" style={plainHeaderStyle(10)}>Recevied Qty Luom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-28" style={plainHeaderStyle(10)}>Recevied Quantity</th>
                            <th className="finance-amount-cell px-2 py-2 text-center w-40" style={plainHeaderStyle(40)}>Remarks</th>
                            <th className="px-2 py-2 text-center w-16" style={plainHeaderStyle(10)}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>No lines yet</td></tr>
                        ) : rows.map((row, index) => {
                            const qtyPuomNum = numberOrZero(row.qty_puom);
                            const qtyLuomNum = numberOrZero(row.qty_luom);
                            const qtyPoLuomNum = numberOrZero(row.po_qty_luom);
                            const upppNum = numberOrZero(row.uppp);

                            const sameUom = isSameUom(row);
                            const samePoUom = isSamePoUom(row);
                            const quantity = computeQuantity(row);
                            const po_quantity = computePoQuantity(row);
                            const lcurrAmountValue = lineLcurrAmount(row, ex_rate);
                            const taxLcurrAmountValue = taxLcurrAmount(row, ex_rate);

                            return (
                                <tr className="border-t odd:bg-muted/20" key={row.id}>
                                    <td className="finance-sticky-col bg-card px-2 py-1 text-xs" >{index + 1}</td>
                                    <td className="finance-sticky-col bg-card px-2 py-1 text-xs" >
                                        <Input disabled={headerAndLineDisabled} value={row.po_div_code} onChange={(event) => updateRow(row.id, { po_div_code: event.target.value })} />
                                    </td>


                                    <td className="finance-sticky-col finance-account-cell bg-card px-2 py-1" >
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
                                                const newPUom = text(getLookupValue(selectedRow || {}, "p_uom")) || row.po_p_uom;
                                                const newLUom = text(getLookupValue(selectedRow || {}, "l_uom")) || row.po_l_uom;
                                                const newUppp = numberOrZero(getLookupValue(selectedRow || {}, "uppp")) || row.uppp;
                                                const patch: Partial<PurchaseOrderLineRow> = {
                                                    prod_code: value,
                                                    prod_name: text(getLookupValue(selectedRow || {}, "prod_name")),
                                                    po_p_uom: newPUom,
                                                    po_l_uom: newLUom,
                                                    uppp: newUppp,
                                                    po_unit_price: numberOrZero(getLookupValue(selectedRow || {}, "unit_price")) || row.unit_price,
                                                };
                                                const merged = { ...row, ...patch };
                                                if (isSamePoUom(merged)) {
                                                    patch.po_qty_puom = row.po_qty_luom;
                                                }
                                                patch.po_quantity = computePoQuantity({ ...row, ...patch });
                                                updateRow(row.id, patch);
                                            }}
                                        />
                                    </td>

                                    <td className="px-2 py-1">
                                        <Input
                                            className="finance-money-input w-full"
                                            disabled
                                            value={row.po_p_uom || ""}
                                            readOnly
                                        />
                                    </td>
                                    <td className="finance-amount-cell px-2 py-1">
                                        <Input
                                            className="finance-money-input"
                                            disabled={headerAndLineDisabled}
                                            type="number"
                                            style={{ textAlign: "right" }}
                                            step="0.001"
                                            value={row.po_qty_puom}

                                            onChange={(event) => {
                                                const newQtyPuom = Number(event.target.value || 0);

                                                const patch: Partial<PurchaseOrderLineRow> = {
                                                    po_qty_puom: newQtyPuom,
                                                };

                                                patch.po_quantity = computePoQuantity({
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
                                            value={row.po_l_uom || ""}
                                            readOnly
                                        />
                                    </td>
                                    <td className="finance-amount-cell w-24 px-2 py-1">
                                        <Input
                                            className="finance-money-input"
                                            disabled={headerAndLineDisabled || sameUom}
                                            type="number"
                                            style={{ textAlign: "right" }}
                                            step="0.001"
                                            value={sameUom ? 0 : row.po_qty_luom}
                                            onChange={(event) => {
                                                const newQtyLuom = Number(event.target.value || 0);

                                                const patch: Partial<PurchaseOrderLineRow> = {
                                                    po_qty_luom: newQtyLuom,
                                                };

                                                patch.po_quantity = computePoQuantity({
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
                                                    po_quantity: computePoQuantity({ ...row, ...{ uppp: Number(newUppp) } }),
                                                });
                                            }}
                                        />
                                    </td>
                                    <td className="finance-amount-cell w-28 px-2 py-1">
                                        <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.0001" value={row.po_unit_price} onChange={(event) => updateRow(row.id, { po_unit_price: Number(event.target.value || 0) })} />
                                    </td>
                                    <td className="finance-amount-cell px-2 py-1 text-right">
                                        {formatAmount(po_quantity)}
                                    </td>

                                    <td className="px-2 py-1">
                                        <Input
                                            className="finance-money-input w-full"
                                            disabled
                                            value={row.po_p_uom || ""}
                                            readOnly
                                        />
                                    </td>
                                    <td className="finance-amount-cell px-2 py-1">
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
                                    <td className="px-2 py-1">
                                        <Input
                                            className="finance-money-input w-full"
                                            disabled
                                            value={row.po_l_uom || ""}
                                            readOnly
                                        />
                                    </td>
                                    <td className="finance-amount-cell w-24 px-2 py-1">
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
                                    <td className="finance-amount-cell px-2 py-1 text-right">
                                        {formatAmount(quantity)}
                                    </td>
                                    <td className="w-40 px-2 py-1 border border-gray-300 rounded-md">
                                        <textarea disabled={headerAndLineDisabled} value={row.line_remarks} onChange={(event) => updateRow(row.id, { line_remarks: event.target.value })} />
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
            {/* <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-t px-3 py-2 text-sm max-md:grid-cols-1">
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
            </div> */}
        </div>
    );
}