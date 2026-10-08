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
    isSamePoUom,
    taxLcurrAmount,
    computePoQuantity,
} from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";
import { Select } from "../../../components/ui/Select";
import { useMemo, useState } from "react";



function hasExtraStickyColumn(docType?: string | null): boolean {
    const code = String(docType ?? "").trim().toUpperCase();
    return code === "PIN" || code === "GRN" || code === "SIN";
}


const plainHeaderStyle = (width?: number, top: number = 0): React.CSSProperties => ({
    position: "sticky",
    top,
    zIndex: 1,
    backgroundColor: "var(--primary, #1d4ed8)",
    width,
    minWidth: width,
});

// Group header (PO Primary / PO Lowest / Rvd Primary / Rvd Lowest) - coloured band above the column titles
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

const TABLE_COLUMN_COUNT = 17;
const UOM_LABEL = "bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500";

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
    //
    // EDITABLE: only Rvd Primary Qty and Rvd Lowest Qty (controlled by headerAndLineDisabled).
    // Every other field is display only (always disabled).

    return (
        <div className="commercial-lines-card rounded-md border bg-card">
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
                    {/* <Button disabled={headerAndLineDisabled || !form.div_code || !form.curr_code} size="sm" type="button" variant="outline" onClick={addRow} className="commercial-add-line-btn">
            <Plus size={14} /> Add Line
          </Button> */}
                </div>
            </div>
            <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
                <table className={`finance-lines-table w-full text-xs ${showAllColumns ? "min-w-[1980px]" : "min-w-full"}`}>
                    <thead className="sticky top-0 bg-[#00378C] text-xs font-semibold text-white shadow-sm z-10">
                        {/* Row 1: group bands only. Ungrouped columns get an empty cell here - nothing is merged. */}
                        <tr>
                            <th style={plainHeaderStyle(undefined, 0)}></th>
                            <th style={plainHeaderStyle(undefined, 0)}></th>
                            <th style={plainHeaderStyle(undefined, 0)}></th>
                            <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#dbeafe")}>PO Primary</th>
                            <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#e2e8f0")}>PO Lowest</th>
                            <th colSpan={3} style={plainHeaderStyle(undefined, 0)}></th>
                            <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#bbf7d0")}>Rvd Primary</th>
                            <th colSpan={2} className="px-2 py-1 text-center" style={groupHeaderStyle("#fde68a")}>Rvd Lowest</th>
                            <th colSpan={3} style={plainHeaderStyle(undefined, 0)}></th>
                        </tr>
                        {/* Row 2: every column title */}
                        <tr>
                            <th className="finance-sticky-col px-1 py-1 text-center" style={plainHeaderStyle(30, GROUP_ROW_HEIGHT)}>Sr No</th>
                            <th className="finance-sticky-col px-1 py-1 text-center" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Div</th>
                            <th className="finance-sticky-col px-2 py-2 text-center" style={plainHeaderStyle(200, GROUP_ROW_HEIGHT)}>Product</th>
                            <th className="px-2 py-2 text-center" style={plainHeaderStyle(80, GROUP_ROW_HEIGHT)}>Qty</th>
                            <th className="px-2 py-2 text-center" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Uom</th>
                            <th className="px-2 py-2 text-center" style={plainHeaderStyle(80, GROUP_ROW_HEIGHT)}>Qty</th>
                            <th className=" px-2 py-2 text-center" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Uom</th>
                            {/* <th className="px-1 py-2 text-center whitespace-normal leading-tight" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Unit Per Primary</th> */}
                            <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(100, GROUP_ROW_HEIGHT)}>Unit Price</th>
                            <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90, GROUP_ROW_HEIGHT)}>Quantity</th>
                            <th className="px-2 py-2 text-center" style={plainHeaderStyle(80, GROUP_ROW_HEIGHT)}>Qty</th>
                            <th className=" px-2 py-2 text-center" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Uom</th>
                            <th className="px-2 py-2 text-center" style={plainHeaderStyle(80, GROUP_ROW_HEIGHT)}>Qty</th>
                            <th className="px-2 py-2 text-center" style={plainHeaderStyle(50, GROUP_ROW_HEIGHT)}>Uom</th>
                            <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(90, GROUP_ROW_HEIGHT)}>Rvd Quantity</th>
                            <th className="finance-amount-cell px-2 py-2 text-center" style={plainHeaderStyle(160, GROUP_ROW_HEIGHT)}>Remarks</th>
                            <th className="px-2 py-2 text-center" style={plainHeaderStyle(60, GROUP_ROW_HEIGHT)}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>No lines yet</td></tr>
                        ) : filteredRows.map((row, index) => {
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
                                        {/* DISPLAY ONLY */}
                                        <Input className="w-12" disabled readOnly value={row.po_div_code} />
                                    </td>


                                    <td className="finance-sticky-col finance-account-cell group bg-card px-2 py-1 hover:!z-20">
                                        {/* DISPLAY ONLY */}
                                        <LookupField
                                            label=""
                                            value={row.prod_code || ""}
                                            displayValue={row.prod_name ? `${row.prod_code} - ${row.prod_name}` : row.prod_code}
                                            columns={[{ field: "prod_code", header: "Code" }, { field: "prod_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                                            valueField="prod_code"
                                            displayFields={["prod_code", "prod_name"]}
                                            loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_PRODUCT_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                                            disabled
                                            onChange={() => { }}
                                        />
                                        <span className="pointer-events-none absolute left-1/2 top-full z-50 -mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                                            Unit Per Primary: {row.uppp}
                                        </span>
                                    </td>

                                    {/* PO Primary: Qty — DISPLAY ONLY */}
                                    <td className="px-2 py-1">
                                        <Input
                                            className="finance-money-input"
                                            disabled
                                            readOnly
                                            type="number"
                                            style={{ textAlign: "right" }}
                                            step="0.001"
                                            value={row.po_qty_puom}
                                        />
                                    </td>
                                    {/* PO Primary: Uom */}
                                    <td className={UOM_LABEL} style={{ textAlign: "center", padding: "0.25rem 0.5rem" }}>
                                        {row.po_p_uom || ""}
                                    </td>

                                    {/* PO Lowest: Qty — DISPLAY ONLY */}
                                    <td className="px-2 py-1">
                                        <Input
                                            className="finance-money-input"
                                            disabled
                                            readOnly
                                            type="number"
                                            style={{ textAlign: "right" }}
                                            step="0.001"
                                            value={samePoUom ? 0 : row.po_qty_luom}
                                        />
                                    </td>
                                    {/* PO Lowest: Uom */}
                                    <td className={UOM_LABEL} style={{ textAlign: "center", padding: "0.25rem 0.5rem" }}>
                                        {row.po_l_uom || ""}
                                    </td>

                                    {/* Unit Per Primary */}
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
                                    {/* Unit Price — DISPLAY ONLY */}
                                    <td className="px-2 py-1">
                                        <Input className="finance-money-input" disabled readOnly type="number" style={{ textAlign: "right" }} step="0.0001" value={row.po_unit_price} />
                                    </td>
                                    {/* PO Quantity */}
                                    <td className="px-2 py-1 text-right bg-slate-200">
                                        {formatAmount(po_quantity)}
                                    </td>

                                    {/* Rvd Primary: Qty — EDITABLE */}
                                    <td className="px-2 py-1">
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
                                    {/* Rvd Primary: Uom */}
                                    <td className={UOM_LABEL} style={{ textAlign: "center", padding: "0.25rem 0.5rem" }}>
                                        {row.po_p_uom || ""}
                                    </td>

                                    {/* Rvd Lowest: Qty — EDITABLE */}
                                    <td className="px-2 py-1">
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
                                    {/* Rvd Lowest: Uom */}
                                    <td className={UOM_LABEL} style={{ textAlign: "center", padding: "0.25rem 0.5rem" }}>
                                        {row.po_l_uom || ""}
                                    </td>

                                    {/* Rvd Quantity */}
                                    <td className="px-2 py-1 text-right bg-slate-200">
                                        {formatAmount(quantity)}
                                    </td>
                                    {/* Remarks — DISPLAY ONLY */}
                                    <td className="w-40 px-2 py-1 border border-gray-300 rounded-md">
                                        <textarea disabled readOnly value={row.line_remarks} />
                                    </td>
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