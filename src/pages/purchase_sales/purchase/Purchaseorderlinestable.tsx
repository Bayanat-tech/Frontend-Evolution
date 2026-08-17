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
  taxLcurrAmount,
} from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";

const STICKY_COLS = {
  sno: { width: 50, left: 0 },
  div: { width: 90, left: 50 },
  zone: { width: 180, left: 140 },
  GRN: { width: 180, left: 320 },
  product: {
    width: 260,
    left: 320,
  },
} as const;

function hasGrnColumn(docType?: string | null): boolean {
  const code = String(docType ?? "").trim().toUpperCase();
  return code === "PIN" || code === "SIN" || code === "SON";
}

function stickyStyle(col: keyof typeof STICKY_COLS, docType?: string | null): React.CSSProperties {
  const showGrn = hasGrnColumn(docType);

  const { width, left } =
    col === "product"
      ? { width: STICKY_COLS.product.width, left: showGrn ? 500 : STICKY_COLS.product.left }
      : STICKY_COLS[col];

  return { position: "sticky", left, width, minWidth: width, maxWidth: width, zIndex: 2, backgroundColor: "var(--card, #fff)" };
}

function stickyHeaderStyle(col: keyof typeof STICKY_COLS, docType?: string | null): React.CSSProperties {
  const showGrn = hasGrnColumn(docType);

  const { width, left } =
    col === "product"
      ? { width: STICKY_COLS.product.width, left: showGrn ? 500 : STICKY_COLS.product.left }
      : STICKY_COLS[col];

  return { position: "sticky", top: 0, left, width, minWidth: width, maxWidth: width, zIndex: 3, backgroundColor: "var(--primary, #1d4ed8)" };
}

const plainHeaderStyle: React.CSSProperties = { position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--primary, #1d4ed8)", width: "100%" };

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
              {hasGrnColumn(docType) && (
                <th className="finance-sticky-col px-2 py-2 text-left w-32" style={stickyHeaderStyle("GRN")}>GRN</th>
              )}
              <th className="finance-sticky-col px-2 py-2 text-left" style={stickyHeaderStyle("product")}>Product Code</th>
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
              const lcurrAmountValue = lineLcurrAmount(row,ex_rate);
              const taxLcurrAmountValue = taxLcurrAmount(row,ex_rate);

              return (
                <tr className="border-t odd:bg-muted/20" key={row.id}>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("sno")}>{index + 1}</td>
                  <td className="finance-sticky-col bg-card px-2 py-1 text-xs" style={stickyStyle("div")}>
                    <Input disabled={headerAndLineDisabled} value={row.div_code} onChange={(event) => updateRow(row.id, { div_code: event.target.value })} />
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
                  {hasGrnColumn(docType) && (
                    <td className="finance-sticky-col bg-card px-2 py-1" style={stickyStyle("GRN", docType)}>
                      <div>
                        <LookupField
                          label="GRN No"
                          compact
                          placeholder="GRN No"
                          value={String(form.doc_no ?? "")}
                          displayValue={String(form.doc_no ?? "")}
                          columns={[
                            { field: "doc_no", header: "GRN No" },
                            { field: "ac_code", header: "A/c Code" },
                            { field: "ac_name", header: "A/c Name" },
                            { field: "address", header: "Address" },
                            { field: "tel", header: "Tel" },
                            { field: "fax", header: "Fax" },
                          ]}
                          valueField="doc_no"
                          displayFields={["doc_no"]}
                          loadOptions={() =>
                            getDynamicLookup({
                              parameter: "PS_INVOICE_ENTRY_GRN_NO_DETAIL",
                              code1: companyCode,
                              code2: form.div_code,
                              code3: "GRN"
                            })
                          }
                          onChange={async (value, row) => {
                            try {
                              const details = await getDynamicLookup({
                                parameter: "PS_INVOICE_ENTRY_GRN_NO_DETAIL_DET",
                                code1: companyCode,
                                code2: form.div_code,
                                code3: String(value),
                              });

                              console.log("GRN NO:", value);
                              console.log("GRN DETAILS RESPONSE:", details);

                              const mappedDetails = (details || []).map(
                                (item: any, index: number) => ({
                                  id: `${value}-${index + 1}`,
                                  div_code: text(getLookupValue(row || {}, "div_code")),
                                  prod_code: text(getLookupValue(item, "prod_code")),
                                  prod_name: text(getLookupValue(item, "prod_name")),
                                  p_uom: text(getLookupValue(item, "p_uom")),
                                  qty_puom: numberOrZero(getLookupValue(item, "qty_puom")),
                                  l_uom: text(getLookupValue(item, "l_uom")),
                                  qty_luom: numberOrZero(getLookupValue(item, "qty_luom")),
                                  unit_price: numberOrZero(getLookupValue(item, "unit_price")),
                                  disc_hdr_percent: numberOrZero(getLookupValue(item, "disc_hdr_percent")),
                                  disc_percent: numberOrZero(getLookupValue(item, "disc_percent")),
                                  disc_price: numberOrZero(getLookupValue(item, "disc_price")),
                                  tax_pct: numberOrZero(getLookupValue(item, "tax_pct")),
                                  tax_amount: numberOrZero(getLookupValue(item, "tax_amount")),
                                  lcur_amount: numberOrZero(getLookupValue(item, "lcur_amount")),
                                  required_dt: text(getLookupValue(item, "required_dt")),
                                  line_remarks: text(getLookupValue(item, "remarks")),
                                  tax_cat: text(getLookupValue(item, "tx_cat_code")),
                                  tax_code: text(getLookupValue(item, "tx_compntcat_code_1")),
                                  tax_lcur_amount: numberOrZero(getLookupValue(item, "tx_compnt_lcuramt_1")),
                                  lcur_amount_disc: numberOrZero(getLookupValue(item, "lcur_amount_discounted")),
                                  zone_code: text(getLookupValue(item, "zone_code")),
                                  zone_name: text(getLookupValue(item, "zone_name")),
                                  uom_name: text(getLookupValue(item, "uom_name")),
                                  uom_code: text(getLookupValue(item, "uom_code")),
                                  job_no: text(getLookupValue(item, "job_no")),
                                  dept: text(getLookupValue(item, "dept_code")),
                                  sign_ind: numberOrZero(getLookupValue(item, "sign_ind")),
                                  uppp: numberOrZero(getLookupValue(item, "uppp")),
                                  quantity: numberOrZero(getLookupValue(item, "quantity")),
                                  ex_rate: numberOrZero(getLookupValue(item, "ex_rate")),
                                })
                              );

                              console.log("MAPPED GRN DETAILS:", mappedDetails);
                              setdetails?.(mappedDetails);
                            } catch (error) {
                              console.error("ERROR LOADING GRN DETAILS:", error);
                              setdetails?.([]);
                            }
                          }}
                        />
                      </div>
                    </td>
                  )}
                  <td className="finance-sticky-col finance-account-cell bg-card px-2 py-1" style={stickyStyle("product")}>
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
                        const patch: Partial<PurchaseOrderLineRow> = {
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
                  </td>
                  <td className="finance-amount-cell w-24 px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.001" value={row.qty_luom} onChange={(event) => {
                      const newQtyLuom = Number(event.target.value || 0);
                      const patch: Partial<PurchaseOrderLineRow> = { qty_luom: newQtyLuom };
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
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.0001" value={row.unit_price} onChange={(event) => updateRow(row.id, { unit_price: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell px-2 py-1 text-right">
                    {formatAmount(quantity)}
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
                  <td className="finance-amount-cell w-24 px-2 py-1">
                    <Input className="finance-money-input" disabled={headerAndLineDisabled} type="number" style={{ textAlign: "right" }} step="0.01" value={row.tax_pct} onChange={(event) => updateRow(row.id, { tax_pct: Number(event.target.value || 0) })} />
                  </td>
                  <td className="finance-amount-cell w-28 px-2 py-1 text-right">{formatAmount(lineTaxAmount(row))}</td>
                
                  <td className="w-32 px-2 py-1">
                    <Input type="date" disabled={headerAndLineDisabled} value={row.required_dt} onChange={(event) => updateRow(row.id, { required_dt: event.target.value })} />
                  </td>
                  <td className="w-40 px-2 py-1 border border-gray-300 rounded-md">
                    <textarea disabled={headerAndLineDisabled} value={row.line_remarks} onChange={(event) => updateRow(row.id, { line_remarks: event.target.value })} />
                  </td>
                  <td className="w-32 px-2 py-1">
                    <Input disabled={headerAndLineDisabled} value={row.tax_cat} onChange={(event) => updateRow(row.id, { tax_cat: event.target.value })} />
                  </td>
                  <td className="w-32 px-2 py-1">
                    <Input disabled={headerAndLineDisabled} value={row.tax_code} onChange={(event) => updateRow(row.id, { tax_code: event.target.value })} />
                  </td>
                      <td className="finance-amount-cell w-32 px-2 py-1 text-right">
                    {formatAmount(taxLcurrAmountValue)}
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