import { Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { TteJmiConsumType } from "../purchase/Purchaseordertypes";
import {
    text,
} from "../purchase/Purchaseorderutils";

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

const plainHeaderStyle: React.CSSProperties = { position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "100%" };

const TABLE_COLUMN_COUNT = 24;

export function JobconsumLinesTable({
    rows,
    updateRow,
    addRow,
    removeRow,
    headerAndLineDisabled,
    discAmt,
    companyCode,
    loginid,
}: {
    rows: TteJmiConsumType[];
    updateRow: (id: string, patch: Partial<TteJmiConsumType>) => void;
    addRow: () => void;
    removeRow: (id: string) => void;
    headerAndLineDisabled: boolean;
    discAmt: number;
    companyCode?: string;
    loginid?: string;
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
                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "48px", minWidth: "48px", maxWidth: "48px" }}>
                                SNo
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "180px", minWidth: "180px", maxWidth: "180px" }}>
                                Product Code
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "140px", minWidth: "140px", maxWidth: "140px" }}>
                                P Uom
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}>
                                Qty Puom
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "140px", minWidth: "140px", maxWidth: "140px" }}>
                                L Uom
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}>
                                Qty Luom
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}>
                                Quantity
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "120px", minWidth: "120px", maxWidth: "120px" }}>
                                Qty Used L Uom
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "120px", minWidth: "120px", maxWidth: "120px" }}>
                                Scrap Qty L Uom
                            </th>

                            <th className="px-2 py-2 text-left"
                                style={{ ...plainHeaderStyle, width: "100px", minWidth: "100px", maxWidth: "100px" }}>
                                Cost Total
                            </th>

                            <th className="px-2 py-2 text-center"
                                style={{ ...plainHeaderStyle, width: "70px", minWidth: "70px", maxWidth: "70px" }}>
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>No lines yet</td></tr>
                        ) : rows.map((row, index) => (
                            <tr className="border-t odd:bg-muted/20" key={row.id}>
                                <td className=" px-2 py-1 text-xs w-18 " >{index + 1}</td>

                                <td className=" finance-account-cell bg-card px-2 py-1" >
                                    <LookupField
                                        label=""
                                        value={row.prod_code || ""}
                                        displayValue={row.prod_name ? `${row.prod_code} - ${row.prod_name}` : row.prod_code}
                                        columns={[{ field: "prod_code", header: "Code" }, { field: "prod_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                                        valueField="prod_code"
                                        displayFields={["prod_code", "prod_name"]}
                                        loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_PRODUCT_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
                                        disabled={headerAndLineDisabled}
                                        onChange={(value, selectedRow) => updateRow(row.id, {
                                            prod_code: value,
                                            prod_name: text(getLookupValue(selectedRow || {}, "prod_name")),

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
                                        loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_UOM_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
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
                                <td className="w-64 px-2 py-1">
                                    <LookupField
                                        label=""
                                        value={row.uom_code || ""}
                                        displayValue={row.uom_name ? `${row.uom_code} - ${row.uom_name}` : row.uom_code}
                                        columns={[{ field: "uom_code", header: "Code" }, { field: "uom_name", header: "Name" }, { field: "p_uom", header: "P Uom" }, { field: "unit_price", header: "Unit Price" }]}
                                        valueField="uom_code"
                                        displayFields={["uom_code", "uom_name"]}
                                        loadOptions={() => getDynamicLookup({ parameter: "PS_POORDER_ENTRY_UOM_LIST", code1: companyCode, loginid: loginid || "ADMIN" })}
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
                                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.qty} onChange={(event) => updateRow(row.id, { qty: Number(event.target.value || 0) })} />
                                </td>

                                <td className="finance-amount-cell w-28 px-2 py-1">
                                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.qty_consumd} onChange={(event) => updateRow(row.id, { qty_consumd: Number(event.target.value || 0) })} />
                                </td>
                                <td className="finance-amount-cell w-28 px-2 py-1">
                                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.qty_scrapped} onChange={(event) => updateRow(row.id, { qty_scrapped: Number(event.target.value || 0) })} />
                                </td>

                                <td className="finance-amount-cell w-28 px-2 py-1">
                                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.cost_amount} onChange={(event) => updateRow(row.id, { cost_amount: Number(event.target.value || 0) })} />
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





            </div>
        </div>
    );
}