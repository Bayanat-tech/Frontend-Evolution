import { Plus, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { InventoryLineRow } from "./Inventorytypes";
import { IV_DOC_TYPE, InventoryDocType } from "./Inventorytypes";

function formatAmount(value: number): string {
  return (Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// NOTE: "zone" was previously in this map with no corresponding <th>/<td> in
// the table below. That reserved a 140-340px sticky slot that nothing ever
// rendered into, producing an empty gap between the Div and Product Code
// columns. Removed, and "product".left recalculated to sit right after
// "div" (div.left 50 + div.width 90 = 140).
const STICKY_COLS = {
  sno: { width: 50, left: 0 },
  div: { width: 90, left: 50 },
  product: { width: 260, left: 140 },
} as const;

const p_COLS = {
  p_uom: { width: 180, left: 0 },
  l_uom: { width: 180, left: 50 },
   dept: { width: 180, left: 50 },
    job_no: { width: 180, left: 50 },
    sign_ind: { width: 180, left: 50 },
} as const;
function stickyStyle(col: keyof typeof STICKY_COLS): React.CSSProperties {
  const { width, left } = STICKY_COLS[col];
  return { position: "sticky", left, width, minWidth: width, maxWidth: width, zIndex: 2, backgroundColor: "var(--card, #fff)" };
}
function widthStyle(col: keyof typeof p_COLS): React.CSSProperties {
  const { width ,left} = p_COLS[col];
  return { width, minWidth: width, maxWidth: width };
}
function lineAmount(row: InventoryLineRow): number {
  return getRowQuantity(row) * (Number(row.unit_price) || 0);
}

function stickyHeaderStyle(col: keyof typeof STICKY_COLS): React.CSSProperties {
  const { width, left } = STICKY_COLS[col];
  return { position: "sticky", top: 0, left, width, minWidth: width, maxWidth: width, zIndex: 3, backgroundColor: "var(--primary, #1d4ed8)" };
}

const plainHeaderStyle: React.CSSProperties = { position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "100%" };

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function numberOrZero(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isSameUom(row: InventoryLineRow): boolean {
  return !!row.p_uom && !!row.l_uom && row.p_uom === row.l_uom;
}
function getRowQuantity(row: InventoryLineRow): number {
  const sameUom = isSameUom(row);
  return computeQuantity(
    numberOrZero(row.qty_puom),
    numberOrZero(row.uppp),
    numberOrZero(row.qty_luom),
    sameUom
  );
}

// Quantity is always derived, never typed directly:
// - same UOM: quantity mirrors qty_luom
// - different UOM: quantity = (qty_puom * uppp) + qty_luom
function computeQuantity(qtyPuom: number, uppp: number, qtyLuom: number, sameUom: boolean): number {
  if (sameUom) return qtyLuom;
  return qtyPuom * uppp + qtyLuom;
}

const BASE_COLUMN_COUNT = 12; // SNo, Div, Product Code, P Uom, Qty Puom, L Uom, Qty Luom, Uppp, Quantity, Unit Price, Amount, Action

export function StockDetail({
  rows,
  updateRow,
  addRow,
  removeRow,
  headerAndLineDisabled,
  companyCode,
  loginid,
  docType,
}: {
  rows: InventoryLineRow[];
  updateRow: (id: string, patch: Partial<InventoryLineRow>) => void;
  addRow: () => void;
  removeRow: (id: string) => void;
  headerAndLineDisabled: boolean;
  companyCode?: string;
  loginid?: string;
  docType?: InventoryDocType;
}) {
  const isStockTransfer = docType === IV_DOC_TYPE.STR;
  const isStockAdjustment = docType === IV_DOC_TYPE.SAJ;

  const totalQtyPuom = rows.reduce((sum, row) => sum + (Number(row.qty_puom) || 0), 0);
  const totalQtyLuom = rows.reduce((sum, row) => sum + (Number(row.qty_luom) || 0), 0);
  const totalQuantity = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + lineAmount(row), 0);

  const columnCount =
    BASE_COLUMN_COUNT + (isStockTransfer ? 3 : 0) + (isStockAdjustment ? 1 : 0);

  return (
    <div className="commercial-lines-card rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
        <div>
          <p className="eyebrow m-0">Lines</p>
          <h3 className="m-0 text-sm font-semibold leading-tight">
            {isStockTransfer ? "Stock Transfer Lines" : isStockAdjustment ? "Stock Adjustment Lines" : "Stock Lines"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={headerAndLineDisabled} size="sm" type="button" variant="outline" onClick={addRow}>
            <Plus size={14} /> Add Line
          </Button>
        </div>
      </div>
      <div className="commercial-lines-scroll max-h-[45vh] overflow-auto">
        <table className="finance-lines-table w-full min-w-[1800px] text-sm">
          <thead className="text-xs text-primary-foreground">
            <tr>
              <th className="px-2 py-2 text-left w-14 sticky top-0 z-[3] bg-primary" style={stickyHeaderStyle("sno")}>
                SNo
              </th>
              <th className="px-2 py-2 text-left w-20 sticky top-0 z-[3] bg-primary" style={stickyHeaderStyle("div")}>
                Div
              </th>
              <th className="px-2 py-2 text-left w-40 sticky top-0 z-[3] bg-primary" style={stickyHeaderStyle("product")}>
                Product Code
              </th>
              <th className="px-2 py-2 text-left w-64 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                P Uom
              </th>
              {isStockAdjustment && (
                <th className="px-2 py-2 text-left w-32 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                  Adjust Type
                </th>
              )}
              <th className="px-2 py-2 text-left w-24 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                Qty Puom
              </th>
              <th className="px-2 py-2 text-left w-48 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                L Uom
              </th>
              <th className="px-2 py-2 text-left w-24 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                Qty Luom
              </th>
              <th className="px-2 py-2 text-left w-24 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                Uppp
              </th>
              <th className="px-2 py-2 text-left w-24 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                Quantity
              </th>
              <th className="px-2 py-2 text-left w-28 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                Unit Price
              </th>
              {isStockTransfer && (
                <>
                  <th className="px-2 py-2 text-left w-40 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                    Remarks
                  </th>
                  <th className="px-2 py-2 text-left w-24 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                    Dept
                  </th>
                  <th className="px-2 py-2 text-left w-28 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                    Job No
                  </th>
                </>
              )}
              <th className="px-2 py-2 text-left w-28 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                Amount
              </th>
              <th className="px-2 py-2 text-left w-16 sticky top-0 z-[3] bg-primary" style={plainHeaderStyle}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-muted-foreground" colSpan={columnCount}>
                  No lines yet
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const sameUom = isSameUom(row);
                const qtyPuomNum = numberOrZero(row.qty_puom);
                const qtyLuomNum = numberOrZero(row.qty_luom);
                const upppNum = numberOrZero(row.uppp);
                const quantity = computeQuantity(qtyPuomNum, upppNum, qtyLuomNum, sameUom);

                return (
                <tr className="border-t odd:bg-muted/20" key={row.id}>
                  <td className="px-2 py-1 text-xs finance-sticky-col" style={stickyStyle("sno")}>
                    {index + 1}
                  </td>
                  <td className="px-2 py-1 finance-sticky-col" style={stickyStyle("div")}>
                    <Input
                      disabled={headerAndLineDisabled}
                      value={row.div_code}
                      onChange={(event) => updateRow(row.id, { div_code: event.target.value })}
                    />
                  </td>
                  <td className="finance-sticky-col finance-account-cell bg-card px-2 py-1 w-64" style={stickyStyle("product")}>
                    <LookupField
                      label=""
                      value={row.prod_code || ""}
                      displayValue={row.prod_name ? `${row.prod_code} - ${row.prod_name}` : row.prod_code}
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
                        const newPUom = text(getLookupValue(selectedRow || {}, "p_uom")) || row.p_uom;
                        const newLUom = text(getLookupValue(selectedRow || {}, "p_uom")) || row.l_uom;
                        const newSameUom = !!newPUom && !!newLUom && newPUom === newLUom;
                        const newUppp = numberOrZero(getLookupValue(selectedRow || {}, "uppp")) || row.uppp;
                        const patch: Partial<InventoryLineRow> = {
                          prod_code: value,
                          prod_name: text(getLookupValue(selectedRow || {}, "prod_name")),
                          p_uom: newPUom,
                          l_uom: newLUom,
                          uppp: newUppp,
                          unit_price: numberOrZero(getLookupValue(selectedRow || {}, "unit_price")) || row.unit_price,
                        };
                        if (newSameUom) {
                          patch.qty_puom = row.qty_luom;
                        }
                        patch.quantity = computeQuantity(
                          numberOrZero(newSameUom ? row.qty_luom : row.qty_puom),
                          numberOrZero(newUppp),
                          qtyLuomNum,
                          newSameUom
                        );
                        updateRow(row.id, patch);
                      }}
                    />
                  </td>
                  <td className="w-64 px-2  finance-account-cell" style={widthStyle("p_uom")} >
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
                        const newSameUom = !!value && !!row.l_uom && value === row.l_uom;
                        const patch: Partial<InventoryLineRow> = {
                          p_uom: value,
                          uom_name: text(getLookupValue(selectedRow || {}, "uom_name")) || row.uom_name,
                        };
                        const effectiveQtyPuom = newSameUom ? qtyLuomNum : qtyPuomNum;
                        if (newSameUom) {
                          patch.qty_puom = qtyLuomNum;
                        }
                        patch.quantity = computeQuantity(effectiveQtyPuom, upppNum, qtyLuomNum, newSameUom);
                        updateRow(row.id, patch);
                      }}
                    />
                  </td>

                  {isStockAdjustment && (
                    <td className="px-2 py-1 w-32 finance-account-cell" style={widthStyle("sign_ind")}>
                      <select
                        className="finance-select h-8 w-full rounded-md border px-2 text-md"
                        disabled={headerAndLineDisabled}
                        value={row.sign_ind }
                        onChange={(event) => updateRow(row.id, { sign_ind: Number(event.target.value) })}
                      >
                        <option value="">Select</option>
                        <option value="1">Increase</option>
                        <option value="-1">Decrease</option>
                      </select>
                    </td>
                  )}
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
                        updateRow(row.id, {
                          qty_puom: newQtyPuom,
                          quantity: computeQuantity(newQtyPuom, upppNum, qtyLuomNum, sameUom),
                        });
                      }}
                    />
                  </td>
                  <td className="w-48 px-2 py-1" style={widthStyle("l_uom")}>
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
                        const newSameUom = !!value && !!row.p_uom && value === row.p_uom;
                        const patch: Partial<InventoryLineRow> = {
                          l_uom: value,
                          uom_name: text(getLookupValue(selectedRow || {}, "uom_name")) || row.uom_name,
                        };
                        const effectiveQtyPuom = newSameUom ? qtyLuomNum : qtyPuomNum;
                        if (newSameUom) {
                          patch.qty_puom = qtyLuomNum;
                        }
                        patch.quantity = computeQuantity(effectiveQtyPuom, upppNum, qtyLuomNum, newSameUom);
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
                      value={row.qty_luom}
                      onChange={(event) => {
                        const newQtyLuom = Number(event.target.value || 0);
                        const patch: Partial<InventoryLineRow> = { qty_luom: newQtyLuom };
                        if (sameUom) {
                          patch.qty_puom = newQtyLuom;
                          patch.quantity = newQtyLuom;
                        } else {
                          patch.quantity = computeQuantity(qtyPuomNum, upppNum, newQtyLuom, sameUom);
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
                          uppp: Number(newUppp),
                          quantity: computeQuantity(qtyPuomNum, newUppp, qtyLuomNum, sameUom),
                        });
                      }}
                    />
                  </td>
                  <td className="finance-amount-cell px-2 py-1 text-right">
                    {formatAmount(quantity)}
                  </td>
                  <td className="finance-amount-cell px-2 py-1">
                    <Input
                      className="finance-money-input"
                      disabled={headerAndLineDisabled}
                      type="number"
                      style={{ textAlign: "right" }}
                      step="0.0001"
                      value={row.unit_price}
                      onChange={(event) => updateRow(row.id, { unit_price: Number(event.target.value || 0) })}
                    />
                  </td>
                  {isStockTransfer && (
                    <>
                      <td className="px-2 py-1 border border-gray-300 rounded-md">
                        <textarea
                          disabled={headerAndLineDisabled}
                          value={row.remarks || ""}
                          onChange={(event) => updateRow(row.id, { remarks: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1" style={widthStyle("dept")}>
                        <Input
                          disabled={headerAndLineDisabled}
                          value={row.dept_code || ""}
                          onChange={(event) => updateRow(row.id, { dept_code: event.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1" style={widthStyle("job_no")}>
                        <Input
                          disabled={headerAndLineDisabled}
                          value={row.job_no || ""}
                          onChange={(event) => updateRow(row.id, { job_no: event.target.value })}
                        />
                      </td>
                    </>
                  )}
                  <td className="finance-amount-cell px-2 py-1 text-right">{formatAmount(lineAmount(row))}</td>
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
          <strong>{totalQtyPuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Total Qty (Luom)</span>
          <strong>{totalQtyLuom.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
        <div className="flex items-center justify-end gap-8">
          <span className="text-muted-foreground">Total Quantity</span>
          <strong>{totalQuantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</strong>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-8 border-t pt-1 max-md:col-span-1">
          <span className="font-semibold text-muted-foreground">Amount Total</span>
          <strong className="text-base text-emerald-600">{formatAmount(totalAmount)}</strong>
        </div>
      </div>
    </div>
  );
}