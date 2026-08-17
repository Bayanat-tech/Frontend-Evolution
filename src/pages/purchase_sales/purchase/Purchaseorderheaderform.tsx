import { ReactNode } from "react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { EXPENSE_AC_OPTIONS, PODocType, PurchaseOrderForm } from "./Purchaseordertypes";
import { numberOrZero, text } from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";

function CompactSection({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border-t px-3 py-1.5 first:border-t-0 ${className || ""}`}>
      <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-foreground">{label}</p>
      <div className="grid grid-cols-8 gap-x-2 gap-y-1 pt-1 max-2xl:grid-cols-6 max-xl:grid-cols-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
        {children}
      </div>
    </div>
  );
}

function CField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={`field ${className || ""}`}>
      <span className="text-[10px]   font-semibold">
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
  setdetails
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
}) {
  const loginIdOrAdmin = loginid || "ADMIN";

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1">
        <div>
          <p className="eyebrow m-0 text-[10px] leading-tight">Header</p>
          <h3 className="m-0 text-xs font-semibold leading-tight">Purchase Order Information</h3>
        </div>
      </div>

      <CompactSection label="Document & Party">
        {editMode && <CField label="Doc No"><Input disabled value={form.doc_no || ""} /></CField>}
        <CField label="Doc Date *">
          <Input type="date" disabled={headerAndLineDisabled} required value={form.doc_date} onChange={(event) => updateField("doc_date", event.target.value)} />
        </CField>
        {(String(docType ?? "").trim().toUpperCase() === "PIN" ||
          String(docType ?? "").trim().toUpperCase() === "SIN") && (
            <div>
              <label>GRN No</label>
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
                    loginid: loginIdOrAdmin,
                    code2: form.div_code,
                    code3: "GRN"
                  })
                }
                disabled={disabled}
                onChange={async (value, row) => {
                  // Populate header fields immediately from the selected row
                  setForm((current) => ({
                    ...current,
                    doc_no: value,
                    ac_code: text(getLookupValue(row || {}, "ac_code")),
                    ac_name: text(getLookupValue(row || {}, "ac_name")),
                    dept_code: text(getLookupValue(row || {}, "dept_code")),
                    remarks: text(getLookupValue(row || {}, "remarks")),
                    ref_no: text(getLookupValue(row || {}, "ref_no")),
                    ref_date: text(getLookupValue(row || {}, "ref_date")),
                    curr_code: text(getLookupValue(row || {}, "curr_code")),
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
                    tx_cat_code: `${text(getLookupValue(row || {}, "tx_cat_code"))} - ${text(
                      getLookupValue(row || {}, "tx_cat_name")
                    )}`,
                  }));

                  // Fetch and populate line details — same logic as the lines table
                  try {
                    const divCodeForFetch = text(getLookupValue(row || {}, "div_code")) || form.div_code;

                    const details = await getDynamicLookup({
                      parameter: "PS_INVOICE_ENTRY_GRN_NO_DETAIL_DET",
                      code1: companyCode,
                      code2: divCodeForFetch,
                      code3: 'GRN',
                      number1: Number(value),
                    });

                    const mappedDetails = (details || []).map((item: any, index: number) => ({
                      id: `${value}-${index + 1}`,
                      div_code: text(getLookupValue(item, "div_code")),
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
        <CField label="Quotn No">
          <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.ref_no} onChange={(event) => updateField("ref_no", event.target.value)} />
        </CField>
        <CField label="Quotn Date">
          <Input type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(event) => updateField("ref_date", event.target.value)} />
        </CField>

        <div className="col-span-2">
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
        </div>

        <div className="col-span-2">
          <LookupField
            label="A/c code *"
            value={form.ac_code}
            displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
            columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "address", header: "Address" }, { field: "tel", header: "Tel" }, { field: "fax", header: "Fax" }]}
            valueField="ac_code"
            displayFields={["ac_code", "ac_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_HDR", code1: companyCode, loginid: loginIdOrAdmin })}
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

        <CField label="Credit Period">
          <Input disabled={headerAndLineDisabled} className="text-right" type="number" step="1" value={form.credit_period} onChange={(event) => updateField("credit_period", Number(event.target.value || 0))} />
        </CField>
        <div className="col-span-2">
          <LookupField
            label="Department"
            value={form.dept_code || ""}
            displayValue={
              form.dept_name
                ? `${form.dept_code} - ${form.dept_name}`
                : form.dept_code
            }
            columns={[
              { field: "dept_code", header: "Code" },
              { field: "dept_name", header: "Name" },
            ]}
            valueField="dept_code"
            displayFields={["dept_code", "dept_name"]}
            loadOptions={() =>
              getDynamicLookup({
                parameter: "DROP_DOWN_DEPT_BASED_ON_DIV",
                code1: companyCode,
                code2: form.div_code,
                loginid: loginid || "ADMIN",
              })
            }
            disabled={headerAndLineDisabled}
            onChange={(value, row) =>
              setForm((current) => ({
                ...current,
                dept_code: value,
                dept_name: text(getLookupValue(row || {}, "dept_name")),
              }))
            }
          />
        </div>
        <CField label="Tel">
          <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.party_phone} onChange={(event) => updateField("party_phone", event.target.value)} />
        </CField>
        <CField label="Address" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.party_address} onChange={(event) => updateField("party_address", event.target.value)} />
        </CField>

        <CField label="Fax">
          <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.party_fax} onChange={(event) => updateField("party_fax", event.target.value)} />
        </CField>
      </CompactSection>


      <CompactSection label="Order, Currency & Tax">
        <CField label="Buyer">
          <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.buyer} onChange={(event) => updateField("buyer", event.target.value)} />
        </CField>
        <CField label="WO No">
          <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.wo_number} onChange={(event) => updateField("wo_number", event.target.value)} />
        </CField>

        <div className="col-span-2">
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
              ex_rate: Number(getLookupValue(row || {}, "ex_rate") || (row as Record<string, unknown>)?.ex_rate || current.ex_rate || 1),
            }))}
          />
        </div>

        <CField label="Ex Rate" className="w-18">
          <Input className="text-right" type="number" disabled={headerAndLineDisabled} step="0.000001" value={form.ex_rate} onChange={(event) => updateField("ex_rate", Number(event.target.value || 1))} />
        </CField>
        <CField label="Disc Amt">
          <Input className="text-right" type="number" step="0.01" disabled={headerAndLineDisabled} value={form.disc_hdr_price} onChange={(event) => updateField("disc_hdr_price", Number(event.target.value || 0))} />
        </CField>
        <CField label="Disc %">
          <Input className="text-right" type="number" step="0.01" disabled={headerAndLineDisabled} value={form.disc_hdr_percent} onChange={(event) => updateField("disc_hdr_percent", Number(event.target.value || 0))} />
          {/* <Input disabled={headerAndLineDisabled} type="number" step="0.01" value={form.disc_price} onChange={(event) => updateField("disc_price", Number(event.target.value || 0))} /> */}
        </CField>
        {/* <CField label="Disc %">
          <Input disabled={headerAndLineDisabled} type="number" step="0.01" value={form.disc_percent} onChange={(event) => updateField("disc_percent", Number(event.target.value || 0))} />
        </CField> */}
        <div>
          <label >Tax Category</label>
          <LookupField
            label="Tax Category"
            compact
            placeholder="Tax code"
            value={form.tx_cat_code || ""}
            displayValue={form.tx_cat_name ? `${form.tx_cat_code} - ${form.tx_cat_name}` : form.tx_cat_code}
            columns={[{ field: "tx_cat_code_1", header: "Code" }, { field: "tx_cat_name", header: "Name" }]}
            valueField="tx_cat_code"
            displayFields={["tx_cat_code", "tx_cat_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CATEGORY", code1: companyCode, loginid: loginIdOrAdmin })}
            disabled={disabled}
            onChange={(value, row) => setForm((current) => ({
              ...current,
              tx_cat_code: value,
              tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")),
            }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-primary-foreground/80">Tax Code</label>
          <LookupField
            label="Tax Code"
            compact
            placeholder="Tax code"
            value={form.tx_compntcat_code_1 || ""}
            displayValue={form.tx_compntcat_code_1 || ""}
            columns={[{ field: "tx_compntcat_code", header: "Code" }, { field: "tx_compntcat_name", header: "Name" }]}
            valueField="tx_compntcat_code"
            displayFields={["tx_compntcat_code", "tx_compntcat_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "DEBIT_NOTE_DROP_DOWN_TAX_CODE", code1: companyCode, loginid: loginIdOrAdmin })}
            disabled={headerAndLineDisabled}
            onChange={(value) => setForm((current) => ({ ...current, tx_compntcat_code_1: value }))}
          />
        </div>
        {(String(docType ?? "").trim().toUpperCase() === "PIN" ||
          String(docType ?? "").trim().toUpperCase() === "SIN") && (
            <div>
              <label>GRN No</label>
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
                    loginid: loginIdOrAdmin,
                    code2: form.div_code,
                    code3: "GRN"
                  })
                }
                disabled={disabled}
                onChange={(value, row) =>
                  setForm((current) => ({
                    ...current,

                    doc_no: value,

                    ac_code: text(getLookupValue(row || {}, "ac_code")),
                    ac_name: text(getLookupValue(row || {}, "ac_name")),

                    div_code: text(getLookupValue(row || {}, "div_code")),
                    dept_code: text(getLookupValue(row || {}, "dept_code")),

                    remarks: text(getLookupValue(row || {}, "remarks")),
                    ref_no: text(getLookupValue(row || {}, "ref_no")),
                    ref_date: text(getLookupValue(row || {}, "ref_date")),

                    curr_code: text(getLookupValue(row || {}, "curr_code")),
                    ex_rate: numberOrZero(getLookupValue(row || {}, "ex_rate")),

                    other_expense_cost: numberOrZero(getLookupValue(
                      row || {},
                      "other_expense_cost"
                    ),),

                    disc_hdr_percent: numberOrZero(getLookupValue(
                      row || {},
                      "disc_hdr_percent"
                    )),
                    disc_hdr_price: numberOrZero(getLookupValue(
                      row || {},
                      "disc_hdr_price"
                    )),

                    payment_terms: text(
                      getLookupValue(row || {}, "payment_terms")
                    ),

                    credit_period: numberOrZero(getLookupValue(
                      row || {},
                      "credit_period"
                    )),
                    due_date: getLookupValue(row || {}, "due_date"),

                    party_name: text(
                      getLookupValue(row || {}, "party_name")
                    ),

                    party_address: text(
                      getLookupValue(row || {}, "party_address")
                    ),

                    party_phone: text(
                      getLookupValue(row || {}, "party_phone")
                    ),

                    party_fax: text(
                      getLookupValue(row || {}, "party_fax")
                    ),

                    delivery_to: text(
                      getLookupValue(row || {}, "delivery_to")
                    ),

                    dlvr_contact: text(
                      getLookupValue(row || {}, "dlvr_contact")
                    ),

                    dlvr_email: text(
                      getLookupValue(row || {}, "dlvr_email")
                    ),

                    dlvr_mobile: text(
                      getLookupValue(row || {}, "dlvr_mobile")
                    ),

                    dlvr_term: text(
                      getLookupValue(row || {}, "dlvr_term")
                    ),

                    salesman_code: text(
                      getLookupValue(row || {}, "salesman_code")
                    ),

                    zone_code: text(
                      getLookupValue(row || {}, "zone_code")
                    ),
                  }))
                }
              />
            </div>
          )}

        <CField label="Pay Terms" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.payment_terms} onChange={(event) => updateField("payment_terms", event.target.value)} />
        </CField>

        <CField label="Remarks" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.remarks} onChange={(event) => updateField("remarks", event.target.value)} />
        </CField>

        <CField label="Delivery Term" className="col-span-1">
          <Input disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(event) => updateField("dlvr_term", event.target.value)} />
        </CField>
        <CField label="Expense A/c Post">
          <Select disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(event) => updateField("expense_ac_post", event.target.value)}>
            {EXPENSE_AC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </CField>
      </CompactSection>

      <CompactSection label="Project, Scope & Delivery" className="border-b-0">
        <CField label="Project Name" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.project_name} onChange={(event) => updateField("project_name", event.target.value)} />
        </CField>
        <CField label="PR No">
          <Input className="text-right" type="number" disabled={headerAndLineDisabled} value={form.pr_no} onChange={(event) => updateField("pr_no", event.target.value)} />
        </CField>
        <CField label="Scope of Work" className="col-span-2">
          <Input disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(event) => updateField("scope_of_work", event.target.value)} />
        </CField>
        <CField label="Delivery Contact">
          <Input disabled={headerAndLineDisabled} value={form.dlvr_contact} onChange={(event) => updateField("dlvr_contact", event.target.value)} />
        </CField>
        <CField label="Delivery Tel">
          <Input disabled={headerAndLineDisabled} value={form.dlvr_mobile} onChange={(event) => updateField("dlvr_mobile", event.target.value)} />
        </CField>
        <CField label="Delivery Email" className="col-span-1">
          <Input disabled={headerAndLineDisabled} type="email" value={form.dlvr_email} onChange={(event) => updateField("dlvr_email", event.target.value)} />
        </CField>
      </CompactSection>
    </div>
  );
}