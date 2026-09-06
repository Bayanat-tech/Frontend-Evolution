import { ReactNode } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { EXPENSE_AC_OPTIONS, PODocType, PurchaseOrderForm, PurchaseOrderLineRow } from "./Purchaseordertypes";
import { DiscAmountPercentage, numberOrZero, text, TotalDiscAmount } from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";

// Updated CompactSection to be more flexible for the two-column layout
function CompactSection({ label, children, className, gridCols = "grid-cols-4" }: { label: string; children: ReactNode; className?: string; gridCols?: string }) {
  return (
    <div className={`px-2 py-1.5 ${className || ""}`}>
      <p className="m-0 mb-1.5 text-[9px] font-bold uppercase tracking-wide text-foreground/60 border-b border-gray-100 pb-1">{label}</p>
      <div className={`grid gap-x-2 gap-y-1.5 pt-0.5 ${gridCols} max-md:grid-cols-1`}>
        {children}
      </div>
    </div>
  );
}

// SideBox for the right-hand column sections
function SideBox({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border-2 border-gray-100  p-2.5 mb-2.5 ${className || ""}`}>
      <p className="m-0 mb-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {children}
      </div>
    </div>
  );
}

function CField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={`field flex flex-col gap-0.5 ${className || ""}`}>
      <span className="text-[9px] font-semibold text-foreground/75">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

export function PurchaseOrderHeaderForm({
  form,
  setForm,
  updateField,
  disabled,
  headerAndLineDisabled,
  editMode,
  companyCode,
  loginid,
  docType,
  setdetails,
  rows
}: {
  form: PurchaseOrderForm;
  setForm: (updater: (current: PurchaseOrderForm) => PurchaseOrderForm) => void;
  updateField: (field: keyof PurchaseOrderForm, value: string | number) => void;
  disabled: boolean;
  headerAndLineDisabled: boolean;
  editMode: boolean;
  companyCode?: string;
  loginid?: string;
  docType: PODocType | SODocType
  setdetails?: (details: any[]) => void;
  rows?: PurchaseOrderLineRow[];
}) {
  const loginIdOrAdmin = loginid || "ADMIN";

  return (
    <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
      {/* HEADER SECTION - HEIGHT UNCHANGED */}
      <div className="flex items-center justify-between border-b-2 border-gray-100 bg-gray-50 px-3 py-1">
        <div>
          <p className="eyebrow m-0 text-[9px] leading-tight uppercase opacity-70 font-semibold">Header</p>
          <h3 className="m-0 text-sm font-bold leading-tight">Purchase Order Information</h3>
        </div>
      </div>

      {/* TWO COLUMN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">

        {/* LEFT COLUMN: PRIMARY INFO */}
        <div className="lg:col-span-8 border-r-2 border-gray-100 divide-y divide-gray-200">

          {/* Document & Party Section */}
          <CompactSection label="Document & Party" gridCols="grid-cols-6">
            {editMode && <CField label="Doc No"><Input disabled value={form.doc_no || ""} /></CField>}
            <CField label="Doc Date " required>
              <Input type="date" disabled={headerAndLineDisabled} value={form.doc_date} onChange={(e) => updateField("doc_date", e.target.value)} />
            </CField>

            {(String(docType ?? "").trim().toUpperCase() === "SO" && <CField label="Quotation No">
              <Input type="Quotation No" disabled={headerAndLineDisabled} value={form.ref_no} onChange={(e) => updateField("ref_no", e.target.value)} />
            </CField>)}
            {(String(docType ?? "").trim().toUpperCase() === "LPO" &&
              <div>
                <label>Quotation No</label>
                <LookupField
                  label="Quotation No"
                  compact
                  placeholder="Quotation No"
                  value={String(form.doc_no ?? "")}
                  displayValue={String(form.doc_no ?? "")}
                  columns={[
                    { field: "doc_no", header: "Quotation No" },
                    { field: "ac_code", header: "A/c Code" },
                  ]}
                  valueField="doc_no"
                  displayFields={["doc_no"]}
                  loadOptions={() =>
                    getDynamicLookup({
                      parameter: "PS_POORDER_ENTRY_QUOTATION_NO_DETAIL",
                      code1: companyCode,
                      loginid: loginIdOrAdmin,
                      code2: form.div_code,
                      code3: 'PQA',
                      code4: form.ac_code
                    })
                  }
                  disabled={disabled}
                  onChange={async (value, row) => {
                    // Populate header fields immediately from the selected row
                    setForm((current) => ({
                      ...current,
                      ref_no: value,
                      doc_date: toDateInputValue(getLookupValue(row || {}, "doc_date")),
                      doc_no: text(getLookupValue(row || {}, "doc_no")),
                      ac_code: text(getLookupValue(row || {}, "ac_code")),
                      ac_name: text(getLookupValue(row || {}, "ac_name")),
                      dept_code: text(getLookupValue(row || {}, "dept_code")),
                      remarks: text(getLookupValue(row || {}, "remarks")),
                      ref_date: text(getLookupValue(row || {}, "ref_date")),
                      curr_code: text(getLookupValue(row || {}, "curr_code")),
                      curr_name: text(getLookupValue(row || {}, "curr_name")),
                      ex_rate: numberOrZero(getLookupValue(row || {}, "ex_rate")),
                      other_expense_cost: numberOrZero(getLookupValue(row || {}, "other_expense_cost")),
                      disc_hdr_percent: numberOrZero(getLookupValue(row || {}, "disc_hdr_percent")),
                      disc_hdr_price: numberOrZero(getLookupValue(row || {}, "disc_hdr_price")),
                      payment_terms: text(getLookupValue(row || {}, "payment_terms")),
                      credit_period: numberOrZero(getLookupValue(row || {}, "credit_period")),
                      due_date: getLookupValue(row || {}, "due_date"),
                      party_name: text(getLookupValue(row || {}, "party_name")),
                      party_address: text(getLookupValue(row || {}, "party_address")),
                      party_phone: text(getLookupValue(row || {}, "party_phone")),
                      party_fax: text(getLookupValue(row || {}, "party_fax")),
                      delivery_to: text(getLookupValue(row || {}, "delivery_to")),
                      dlvr_contact: text(getLookupValue(row || {}, "dlvr_contact")),
                      dlvr_email: text(getLookupValue(row || {}, "dlvr_email")),
                      dlvr_mobile: text(getLookupValue(row || {}, "dlvr_mobile")),
                      dlvr_term: text(getLookupValue(row || {}, "dlvr_term")),
                      salesman_code: text(getLookupValue(row || {}, "salesman_code")),
                      zone_code: text(getLookupValue(row || {}, "zone_code")),
                      tx_compntcat_code_1: text(getLookupValue(row || {}, "tx_compntcat_code_1")),
                      // tx_cat_code: `${text(getLookupValue(row || {}, "tx_cat_code"))} - ${text(
                      //   getLookupValue(row || {}, "tx_cat_name")
                      // )}`,
                      tx_cat_code: text(getLookupValue(row || {}, "tx_cat_code")),
                      tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")),
                      project_name: text(getLookupValue(row || {}, "project_name")),
                      pr_no: text(getLookupValue(row || {}, "pr_no")),
                      scope_of_work: text(getLookupValue(row || {}, "scope_of_work")),

                      tx_compnt_1_expmt: text(getLookupValue(row || {}, "tx_compnt_1_expmt")),


                    }));

                    // Fetch and populate line details — same logic as the lines table
                    try {
                      const divCodeForFetch = text(getLookupValue(row || {}, "div_code")) || form.div_code;

                      const details = await getDynamicLookup({
                        parameter: "PS_POORDER_ENTRY_QUOTATION_NO_DETAIL_DET",
                        code1: companyCode,
                        code2: value,
                      });

                      const mappedDetails = (details || []).map((item: any, index: number) => ({
                        id: `${value}-${index + 1}`,
                        div_code: text(getLookupValue(item, "div_code")),
                        prod_code: text(getLookupValue(item, "prod_code")),
                        prod_name: text(getLookupValue(item, "prod_name")),
                        p_uom: text(getLookupValue(item, "p_uom")),
                        qty_puom: numberOrZero(getLookupValue(item, "qty_puom")),
                        porder_qty_puom: numberOrZero(getLookupValue(item, "porder_qty_puom")),
                        l_uom: text(getLookupValue(item, "l_uom")),
                        qty_luom: numberOrZero(getLookupValue(item, "qty_luom")),
                        porder_qty_luom: numberOrZero(getLookupValue(item, "porder_qty_luom")),
                        unit_price: numberOrZero(getLookupValue(item, "unit_price")),
                        porder_unit_price: numberOrZero(getLookupValue(item, "porder_unit_price")),
                        disc_hdr_percent: numberOrZero(getLookupValue(item, "disc_hdr_percent")),
                        disc_percent: numberOrZero(getLookupValue(item, "disc_percent")),
                        porder_disc_percent: numberOrZero(getLookupValue(item, "porder_disc_percent")),
                        disc_price: numberOrZero(getLookupValue(item, "disc_price")),
                        tax_pct: numberOrZero(getLookupValue(item, "tax_pct")),
                        tax_amount: numberOrZero(getLookupValue(item, "tax_amount")),
                        lcur_amount: numberOrZero(getLookupValue(item, "lcur_amount")),
                        required_dt: text(getLookupValue(item, "required_dt")),
                        line_remarks: text(getLookupValue(item, "remarks")),
                        tx_cat_code: text(getLookupValue(item, "tx_cat_code")),
                        tx_compntcat_code_1: text(getLookupValue(item, "tx_compntcat_code_1")),
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
                        porder_tx_compnt_amt_1: text(getLookupValue(item, "porder_tx_compnt_amt_1")),
                        porder_tx_compnt_perc_1: text(getLookupValue(item, "porder_tx_compnt_perc_1")),
                        porder_tx_cat_code: text(getLookupValue(item, "porder_tx_cat_code")),
                        porder_tx_compntcat_code_1: text(getLookupValue(item, "porder_tx_compntcat_code_1")),
                        porder_required_dt: text(getLookupValue(item, "porder_required_dt")),
                        porder_tx_compnt_1_expmt: text(getLookupValue(item, "porder_tx_compnt_1_expmt")),
                        porder_remarks: text(getLookupValue(item, "porder_remarks")),
                        serial_no: numberOrZero(getLookupValue(item, "serial_no")),

                      }));
                      console.log("Mapped length:", mappedDetails?.length);
                      setdetails?.(mappedDetails);
                    } catch (error) {
                      console.error("ERROR LOADING GRN DETAILS FROM HEADER:", error);
                      setdetails?.([]);
                    }
                  }}
                />
              </div>
            )}
            <CField label="Quotn Date">
              <Input type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(e) => updateField("ref_date", e.target.value)} />
            </CField>

            {/* <div className="col-span-2">
              <LookupField
                label="Division *"
                value={form.div_code}
                displayValue={form.div_name ? `${form.div_code} - ${form.div_name}` : form.div_code}
                columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={() => getDynamicLookup({ parameter: "Account_division", code1: companyCode, loginid: loginIdOrAdmin })}
                disabled={headerAndLineDisabled}
                onChange={(value, row) => setForm((current) => ({
                  ...current,
                  div_code: value,
                  div_name: text(getLookupValue(row || {}, "div_name")),
                }))}
              />
            </div> */}

            <div className="col-span-2">
              <LookupField
                label="A/c code *"
                value={form.ac_code}
                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "address", header: "Address" }, { field: "tel", header: "Tel" }, { field: "fax", header: "Fax" }]}
                valueField="ac_code"
                displayFields={["ac_code", "ac_name"]}
                loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_For_suppier_customer", code1: companyCode, loginid: loginIdOrAdmin })}
                disabled={headerAndLineDisabled}
                onChange={(value, row) => setForm((current) => ({
                  ...current,
                  ac_code: value,
                  ac_name: text(getLookupValue(row || {}, "ac_name")),
                  party_address: text(getLookupValue(row || {}, "address")) || current.party_address,
                  party_phone: text(getLookupValue(row || {}, "tel")) || current.party_phone,
                  party_fax: text(getLookupValue(row || {}, "fax")) || current.party_fax,
                }))}
              />
            </div>
            <div className="col-span-1">
              <LookupField
                label="Currency *"
                value={form.curr_code}
                displayValue={form.curr_name ? `${form.curr_code} - ${form.curr_name}` : form.curr_code}
                columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                valueField="curr_code"
                displayFields={["curr_code", "curr_name"]}
                loadOptions={() => getDynamicLookup({ parameter: "Account_Currency_CODE_Serach", code1: companyCode, loginid: loginIdOrAdmin })}
                disabled={headerAndLineDisabled}
                onChange={(value, row) => setForm((current) => ({
                  ...current,
                  curr_code: value,
                  curr_name: text(getLookupValue(row || {}, "curr_name")),
                  ex_rate: Number(getLookupValue(row || {}, "ex_rate") || (row as any)?.ex_rate || current.ex_rate || 1),
                }))}
              />
            </div>
            <CField label="Ex Rate"><Input className="text-right" type="number" disabled={headerAndLineDisabled} step="0.000001" value={form.ex_rate} onChange={(e) => updateField("ex_rate", Number(e.target.value || 1))} /></CField>

            <CField label="Credit Period">
              <Input disabled={headerAndLineDisabled} className="text-right" type="number" value={form.credit_period} onChange={(e) => updateField("credit_period", Number(e.target.value || 0))} />
            </CField>
            <div className="col-span-2">
              <LookupField
                label="Department"
                value={form.dept_code || ""}
                displayValue={form.dept_name ? `${form.dept_code} - ${form.dept_name}` : form.dept_code}
                columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Name" }]}
                valueField="dept_code"
                displayFields={["dept_code", "dept_name"]}
                loadOptions={() => getDynamicLookup({ parameter: "DROP_DOWN_DEPT_BASED_ON_DIV", code1: companyCode, code2: form.div_code, loginid: loginIdOrAdmin })}
                disabled={headerAndLineDisabled}
                onChange={(value, row) => setForm((current) => ({ ...current, dept_code: value, dept_name: text(getLookupValue(row || {}, "dept_name")) }))}
              />
            </div>
            <CField label="Tel"><Input className="text-right" disabled={headerAndLineDisabled} value={form.party_phone} onChange={(e) => updateField("party_phone", e.target.value)} /></CField>
            <CField label="Address" className="col-span-3"><Input disabled={headerAndLineDisabled} value={form.party_address} onChange={(e) => updateField("party_address", e.target.value)} /></CField>
            <CField label="Fax"><Input className="text-right" disabled={headerAndLineDisabled} value={form.party_fax} onChange={(e) => updateField("party_fax", e.target.value)} /></CField>
            {(String(docType ?? "").trim().toUpperCase() === "LPO" && (
              <>
                <CField label="Buyer"><Input disabled={headerAndLineDisabled} value={form.buyer} onChange={(e) => updateField("buyer", e.target.value)} /></CField>
                <CField label="WO No"><Input disabled={headerAndLineDisabled} value={form.wo_number} onChange={(e) => updateField("wo_number", e.target.value)} /></CField>
              </>
            ))}


          </CompactSection>

          {/* Order, Currency & Tax (Core Fields) */}
          <CompactSection label="Order & Currency" gridCols="grid-cols-6">


            <CField label="Disc Amt"><Input className="text-right" type="number" step="0.01" disabled={headerAndLineDisabled} value={numberOrZero(form.disc_hdr_percent.toFixed(3)) > 0 ? TotalDiscAmount(rows || []) : form.disc_hdr_price.toFixed(3)}
              onChange={(e) => updateField("disc_hdr_price", Number(e.target.value || 0))} /></CField>
            <CField label="Disc %">
              <Input
                className="text-right"
                type="number"
                step="0.01"
                disabled={headerAndLineDisabled}
                value={numberOrZero(form.disc_hdr_price.toFixed(3)) > 0 ? DiscAmountPercentage(form, rows || []) : form.disc_hdr_percent.toFixed(6)}
                onChange={(e) => updateField("disc_hdr_percent", Number(e.target.value || 0))}
              />
            </CField>
            <CField label="Pay Terms" className="col-span-2"><Input disabled={headerAndLineDisabled} value={form.payment_terms} onChange={(e) => updateField("payment_terms", e.target.value)} /></CField>
            <CField label="Remarks" className="col-span-2"><Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(e) => updateField("remarks", e.target.value)} /></CField>
            {(String(docType ?? "").trim().toUpperCase() === "LPO" && (
              <><CField label="Delivery Contact Person"><Input disabled={headerAndLineDisabled} value={form.dlvr_contact} onChange={(e) => updateField("dlvr_contact", e.target.value)} /></CField>
                <CField label=" Delivery Telephone"><Input disabled={headerAndLineDisabled} value={form.dlvr_mobile} onChange={(e) => updateField("dlvr_mobile", e.target.value)} /></CField>
                <CField label="Delivery Email Address" className="col-span-1"><Input type="email" disabled={headerAndLineDisabled} value={form.dlvr_email} onChange={(e) => updateField("dlvr_email", e.target.value)} /></CField>
                <CField label="Delivery Term"><Input disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(e) => updateField("dlvr_term", e.target.value)} /></CField>
              </>
            ))}

          </CompactSection>

        </div>

        {/* RIGHT COLUMN: BOXED SECTIONS */}
        <div className="lg:col-span-4 p-2 flex flex-col gap-2">

          {/* Tax Section */}
          <SideBox label="Tax Configuration">
            <CField label="Tax Type">
              <Select value={form.tx_compnt_1_expmt || "N"} onChange={(e) => {
                const taxType = e.target.value;
                setForm((current) => ({ ...current, tx_compnt_1_expmt: taxType, tx_compnt_1_pct: taxType === "S" ? 5 : 0 }));
              }}>
                <option value="N">No Tax</option><option value="S">Std Tax</option><option value="Z">Zero</option><option value="E">Exempt</option>
              </Select>
            </CField>

            <LookupField
              label="Tax Category"
              // value={
              //   form.tx_cat_name
              //     ? `${form.tx_cat_code} - ${form.tx_cat_name}`
              //     : form.tx_cat_code
              // }
              value={form.tx_cat_code || ""}
              displayValue={
                form.tx_cat_name
                  ? `${form.tx_cat_code} - ${form.tx_cat_name}`
                  : form.tx_cat_code
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
                  code1: companyCode,
                  loginid: loginIdOrAdmin
                })
              }
              disabled={disabled}
              onChange={(value, row) =>
                setForm((current) => ({
                  ...current,
                  tx_cat_code: text(value).split(" - ")[0].trim(),
                  
                }))
              }
            />

            <LookupField
              label="Tax Code"
              value={form.tx_compntcat_name
                ? `${form.tx_compntcat_code_1} - ${form.tx_compntcat_name}`
                : form.tx_compntcat_code_1}
              displayValue={
                form.tx_compntcat_name
                  ? `${form.tx_compntcat_code_1} - ${form.tx_compntcat_name}`
                  : form.tx_compntcat_code_1
              }
              columns={[{ field: "tx_compntcat_code", header: "Code" }, { field: "tx_compntcat_name", header: "Name" }]}
              valueField="tx_compntcat_code"
              displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
              loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE", code1: companyCode, loginid: loginIdOrAdmin })}
              disabled={headerAndLineDisabled}
              onChange={(value) => setForm((current) => ({ ...current, tx_compntcat_code_1: value }))}
            />

            <CField label="Expense A/c Post">
              <Select disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </CField>
          </SideBox>

          {/* Project & Scope Section */}
          {(String(docType ?? "").trim().toUpperCase() === "LPO") && (
            <SideBox label="Project & Scope">
              <CField label="Project Name"><Input disabled={headerAndLineDisabled} value={form.project_name} onChange={(e) => updateField("project_name", e.target.value)} /></CField>
              <CField label="PR No"><Input className="text-right" disabled={headerAndLineDisabled} value={form.pr_no} onChange={(e) => updateField("pr_no", e.target.value)} /></CField>
              <CField label="Scope of Work"><Input disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(e) => updateField("scope_of_work", e.target.value)} /></CField>
            </SideBox>
          )}

          {/* Delivery Section */}
          {(String(docType ?? "").trim().toUpperCase() === "SO" && (
            <><SideBox label="Delivery Details">
              <CField label="Delivery Contact Person"><Input disabled={headerAndLineDisabled} value={form.dlvr_contact} onChange={(e) => updateField("dlvr_contact", e.target.value)} /></CField>
              <CField label=" Delivery Telephone"><Input disabled={headerAndLineDisabled} value={form.dlvr_mobile} onChange={(e) => updateField("dlvr_mobile", e.target.value)} /></CField>
              <CField label="Delivery Email Address" className="col-span-1"><Input type="email" disabled={headerAndLineDisabled} value={form.dlvr_email} onChange={(e) => updateField("dlvr_email", e.target.value)} /></CField>
              <CField label="Delivery Term"><Input disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(e) => updateField("dlvr_term", e.target.value)} /></CField>
            </SideBox>
            </>
          ))}


        </div>
      </div>
    </div>
  );
}