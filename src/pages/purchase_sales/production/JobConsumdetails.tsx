import React, { useMemo, useState } from "react";
import { Columns3, List, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { PurchaseOrderLineRow, TteJmiConsumType } from "../purchase/Purchaseordertypes";
import {
    computeQuantity,
    formatAmount,
    isSameUom,
    numberOrZero,
    text,
} from "../purchase/Purchaseorderutils";

const plainHeaderStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    backgroundColor: "var(--primary, #1d4ed8)",
    width: "100%",
};

const TABLE_COLUMN_COUNT = 12; // matches the number of <th> elements

export function JobconsumLinesTable({
    rows,
    updateRow,
    addRow,
    removeRow,
    headerAndLineDisabled,
    discAmt,
    companyCode,
    loginid,
    ex_rate,
}: {
    rows: TteJmiConsumType[];
    updateRow: (id: string, patch: Partial<TteJmiConsumType>) => void;
    addRow: () => void;
    removeRow: (id: string) => void;
    headerAndLineDisabled: boolean;
    discAmt: number;
    companyCode?: string;
    loginid?: string;
    ex_rate?: number;
}) {
    const totalQtyPuom = rows.reduce((sum, row) => sum + (Number(row.qty_puom) || 0), 0);
    const totalQtyLuom = rows.reduce((sum, row) => sum + (Number(row.qty_luom) || 0), 0);
    const [lineSearch, setLineSearch] = useState("");
    const [showAllColumns, setShowAllColumns] = useState(false);
    const filteredRows = useMemo(() => {
        const q = lineSearch.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            r.prod_name?.toLowerCase().includes(q) ||
            r.prod_code?.toLowerCase().includes(q) ||
            r.line_remarks?.toLowerCase().includes(q)

        );
    }, [rows, lineSearch]);
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
                    <Button disabled={headerAndLineDisabled} size="sm" type="button" variant="outline" onClick={addRow} className="commercial-add-line-btn">
                        <Plus size={14} /> Add Line
                    </Button>
                </div>
            </div>
            <div className="commercial-lines-scroll max-h-[43vh] overflow-auto min-w-0">
                <table className={`finance-lines-table w-full text-xs ${showAllColumns ? "min-w-[1980px]" : "min-w-full"}`}>
                    <thead className="sticky top-0 bg-[#00378C] text-xs font-semibold text-white shadow-sm z-10">
                        <tr>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "10px", minWidth: "10px", maxWidth: "10px" }}
                            >
                                SNo
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "140px", minWidth: "140px", maxWidth: "140px" }}
                            >
                                Product Code
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "20px", minWidth: "20px", maxWidth: "20px" }}
                            >
                                P Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "60px", minWidth: "60px", maxWidth: "60px" }}
                            >
                                Qty Puom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "20px", minWidth: "20px", maxWidth: "20px" }}
                            >
                                L Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "60px", minWidth: "60px", maxWidth: "60px" }}
                            >
                                Qty Luom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "10px", minWidth: "10px", maxWidth: "10px" }}
                            >
                                Uppp
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "60px", minWidth: "60px", maxWidth: "60px" }}
                            >
                                Quantity
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "60px", minWidth: "60px", maxWidth: "60px" }}
                            >
                                Qty Used L Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "60px", minWidth: "60px", maxWidth: "60px" }}
                            >
                                Scrap Qty L Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "60px", minWidth: "60px", maxWidth: "60px" }}
                            >
                                Cost Total
                            </th>
                            <th className="finance-sticky-col-right px-2 py-2 text-center" >Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td className="px-3 py-8 text-center text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
                                    No lines yet
                                </td>
                            </tr>
                        ) : (
                            rows.map((row: any, index) => {
                                const qtyPuomNum = numberOrZero(row.qty_puom);
                                const qtyLuomNum = numberOrZero(row.qty_luom);
                                const sameUom = isSameUom(row);

                                return (
                                    <tr className="border-t odd:bg-muted/20" key={row.id}>
                                        <td className="px-2 py-1 text-xs w-18">{index + 1}</td>

                                        <td className="cell bg-card px-2 py-1">
                                            <LookupField
                                                label=""
                                                value={row.prod_code || ""}
                                                displayValue={
                                                    row.prod_name
                                                        ? `${row.prod_code} - ${row.prod_name}`
                                                        : row.prod_code
                                                }
                                                columns={[
                                                    { field: "prod_code", header: "Code" },
                                                    { field: "prod_name", header: "Name" },
                                                    { field: "p_uom", header: "P Uom" },
                                                    { field: "unit_price", header: "Unit Price" },
                                                ]}
                                                valueField="prod_code"
                                                displayFields={["prod_code", "prod_name"]}
                                                loadOptions={() =>
                                                    getDynamicLookup({
                                                        parameter: "PS_POORDER_ENTRY_PRODUCT_LIST",
                                                        code1: companyCode,
                                                        loginid: loginid || "ADMIN",
                                                    })
                                                }
                                                disabled={headerAndLineDisabled}
                                                onChange={(value, selectedRow) => {
                                                    const newPUom = text(getLookupValue(selectedRow || {}, "p_uom")) ||
                                                        row.p_uom;
                                                    const newLUom = text(getLookupValue(selectedRow || {}, "l_uom")) ||
                                                        row.l_uom;
                                                    const newUppp =
                                                        numberOrZero(getLookupValue(selectedRow || {}, "uppp")) ||
                                                        row.uppp;
                                                    const patch: Partial<TteJmiConsumType> = {
                                                        prod_code: value,
                                                        prod_name: text(
                                                            getLookupValue(selectedRow || {}, "prod_name")
                                                        ),
                                                        p_uom: newPUom,
                                                        l_uom: newLUom,
                                                        uppp: newUppp,
                                                        unit_price:
                                                            numberOrZero(
                                                                getLookupValue(selectedRow || {}, "unit_price")
                                                            ) || row.unit_price,
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

                                        <td className=" px-2 py-1">
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
                                                        uppp: newUppp,
                                                        quantity: computeQuantity({ ...row, ...{ uppp: newUppp } }),
                                                    });
                                                }}
                                            />
                                        </td>

                                        <td className=" px-2 py-1 text-right">
                                            {formatAmount(computeQuantity(row))}
                                        </td>

                                        <td className="  px-2 py-1">
                                            <Input
                                                className="finance-money-input"
                                                disabled={headerAndLineDisabled}
                                                type="number"
                                                style={{ textAlign: "right" }}
                                                step="0.01"
                                                value={row.qty_consumd}
                                                onChange={(event) =>
                                                    updateRow(row.id, {
                                                        qty_consumd: Number(event.target.value || 0),
                                                    })
                                                }
                                            />
                                        </td>

                                        <td className="  px-2 py-1">
                                            <Input
                                                className="finance-money-input"
                                                disabled={headerAndLineDisabled}
                                                type="number"
                                                style={{ textAlign: "right" }}
                                                step="0.01"
                                                value={row.qty_scrapped}
                                                onChange={(event) =>
                                                    updateRow(row.id, {
                                                        qty_scrapped: Number(event.target.value || 0),
                                                    })
                                                }
                                            />
                                        </td>

                                        <td className="  px-2 py-1">
                                            <Input
                                                className="finance-money-input"
                                                disabled={headerAndLineDisabled}
                                                type="number"
                                                style={{ textAlign: "right" }}
                                                step="0.01"
                                                value={row.cost_amount}
                                                onChange={(event) =>
                                                    updateRow(row.id, {
                                                        cost_amount: Number(event.target.value || 0),
                                                    })
                                                }
                                            />
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
                                );
                            })
                        )}
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
                <div className="flex items-center justify-end gap-8">
                    <span className="text-muted-foreground">Total Qty (Puom)</span>
                    <strong>
                        {totalQtyPuom.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 3,
                        })}
                    </strong>
                </div>
                <div className="flex items-center justify-end gap-8">
                    <span className="text-muted-foreground">Total Qty (Luom)</span>
                    <strong>
                        {totalQtyLuom.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 3,
                        })}
                    </strong>
                </div>
            </div>
        </div>
    );
}

export default JobconsumLinesTable;