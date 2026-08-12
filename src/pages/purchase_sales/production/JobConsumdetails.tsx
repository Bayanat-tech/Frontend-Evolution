import React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { TteJmiConsumType } from "../purchase/Purchaseordertypes";
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
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "48px", minWidth: "48px", maxWidth: "48px" }}
                            >
                                SNo
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "180px", minWidth: "180px", maxWidth: "180px" }}
                            >
                                Product Code
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "140px", minWidth: "140px", maxWidth: "140px" }}
                            >
                                P Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}
                            >
                                Qty Puom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "140px", minWidth: "140px", maxWidth: "140px" }}
                            >
                                L Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}
                            >
                                Qty Luom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "140px", minWidth: "140px", maxWidth: "140px" }}
                            >
                                Uppp
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}
                            >
                                Quantity
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "120px", minWidth: "120px", maxWidth: "120px" }}
                            >
                                Qty Used L Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "120px", minWidth: "120px", maxWidth: "120px" }}
                            >
                                Scrap Qty L Uom
                            </th>
                            <th
                                className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}
                            >
                                Cost Total
                            </th>
                            <th
                                className="px-2 py-2 text-center"
                                style={{ ...plainHeaderStyle, width: "70px", minWidth: "70px", maxWidth: "70px" }}
                            >
                                Action
                            </th>
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
                            rows.map((row:any, index) => {
                                const qtyPuomNum = numberOrZero(row.qty_puom);
                                const qtyLuomNum = numberOrZero(row.qty_luom);
                                const sameUom = isSameUom(row);

                                return (
                                    <tr className="border-t odd:bg-muted/20" key={row.id}>
                                        <td className="px-2 py-1 text-xs w-18">{index + 1}</td>

                                        <td className="finance-account-cell bg-card px-2 py-1">
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

                                        <td className="w-28 px-2 py-1">
                                            <LookupField
                                                label=""
                                                value={row.p_uom || ""}
                                                displayValue={row.p_uom}
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
                                                    const patch: Partial<TteJmiConsumType> = {
                                                        p_uom: value,
                                                        uom_name:
                                                            text(getLookupValue(selectedRow || {}, "uom_name")) ||
                                                            row.uom_name,
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
                                                displayValue={row.l_uom}
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
                                                    const patch: Partial<TteJmiConsumType> = {
                                                        l_uom: value,
                                                        uom_name:
                                                            text(getLookupValue(selectedRow || {}, "uom_name")) ||
                                                            row.uom_name,
                                                    };
                                                    const merged = { ...row, ...patch };
                                                    if (isSameUom(merged)) {
                                                        // When l_uom becomes equal to p_uom, qty_puom should follow qty_luom
                                                        patch.qty_puom = qtyLuomNum;
                                                    }
                                                    patch.quantity = computeQuantity({ ...row, ...patch });
                                                    updateRow(row.id, patch);
                                                }}
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
                                                    const patch: Partial<TteJmiConsumType> = { qty_luom: newQtyLuom };
                                                    if (sameUom) {
                                                        patch.qty_puom = newQtyLuom;
                                                        patch.quantity = newQtyLuom;
                                                    } else {
                                                        patch.quantity = computeQuantity({ ...row, ...patch });
                                                    }
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
                                                        uppp: newUppp,
                                                        quantity: computeQuantity({ ...row, ...{ uppp: newUppp } }),
                                                    });
                                                }}
                                            />
                                        </td>

                                        <td className="finance-amount-cell px-2 py-1 text-right">
                                            {formatAmount(computeQuantity(row))}
                                        </td>

                                        <td className="finance-amount-cell w-28 px-2 py-1">
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

                                        <td className="finance-amount-cell w-28 px-2 py-1">
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

                                        <td className="finance-amount-cell w-28 px-2 py-1">
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

                                        <td className="px-2 py-1">
                                            <Button
                                                disabled={headerAndLineDisabled}
                                                size="icon"
                                                type="button"
                                                variant="ghost"
                                                onClick={() => removeRow(row.id)}
                                            >
                                                <X size={14} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-t px-3 py-2 text-sm max-md:grid-cols-1">
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