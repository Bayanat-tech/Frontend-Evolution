import { ReactNode, useState } from "react";
import { Briefcase, Building2, ChevronDown, ChevronUp, FileText, Percent, Receipt, Truck } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import { Select } from "../../../components/ui/Select";
import { getDynamicLookup, getLookupValue } from "../../../api/lookups";
import { EXPENSE_AC_OPTIONS, PODocType, PurchaseOrderForm, PurchaseOrderLineRow } from "./Purchaseordertypes";
import { amountBeforeDiscPrice, DiscAmountPercentage, lowerRecord, numberOrZero, text, TotalDiscAmount } from "./Purchaseorderutils";
import { SODocType } from "../sales/SalesOrdertypes";
import { toDateInputValue } from "../../hr/leaveEncashmentHelpers";

// One "Label: value" pair used in the collapsed summary bar.
function SummaryItem({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-[#00378C]">{label}:</span>
      <span className="font-medium">{value || "-"}</span>
    </span>
  );
}

// Group block — same structure as the Payment Document page:
// finance-payment-header-block > finance-section-title (finance-section-icon + label) > fields.
// Optional collapsible mode: pass `collapsible`, `open`, `onToggle`, `summary`.
function HeaderBlock({
  label,
  icon,
  children,
  gridCols = "grid-cols-4",
  collapsible = false,
  open = true,
  onToggle,
  summary,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  gridCols?: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  summary?: ReactNode;
}) {
  return (
    <div className="finance-payment-header-block">
      <div
        className={`finance-section-title flex items-center ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? onToggle : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <span className="finance-section-icon">{icon}</span>
        <span>{label}</span>
        {collapsible && (
          <span className="ml-auto flex items-center">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>
      {collapsible && !open && summary && (
        <div
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-blue-200 bg-blue-50/70 px-2.5 py-1 text-[10px] text-slate-700 cursor-pointer"
          onClick={onToggle}
        >
          {summary}
        </div>
      )}
      {(!collapsible || open) && (
        <div className={`grid gap-x-1 gap-y-1 px-2.5 py-1.5 ${gridCols} max-md:grid-cols-1`}>
          {children}
        </div>
      )}
    </div>
  );
}

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
  setdetails,
  rows,
  calculateDiscount
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
  calculateDiscount: (type: "amount" | "percent", value: number) => void;
}) {
  const loginIdOrAdmin = loginid || "ADMIN";

  const discountScope = form.discount_scoope || "ITEM";
  const docTypeUpper = String(docType ?? "").trim().toUpperCase();

  // Values shown in the collapsed summary bars
  const taxTypeLabel =
    ({ N: "No Tax", S: "Std Tax", Z: "Zero", E: "Exempt" } as Record<string, string>)[form.tx_compnt_1_expmt || "N"] || "No Tax";
  const discAmtShown =
    discountScope === "ITEM" ? TotalDiscAmount(rows || []) : numberOrZero(form.disc_hdr_price);
  const discPctShown =
    discountScope === "ITEM" ? DiscAmountPercentage(form, rows || []) : numberOrZero(form.disc_hdr_percent);

  // Accordion: only one of Tax / Discount open at a time; clicking the open one closes both.
  const [openSection, setOpenSection] = useState<"discount" | "tax" | null>("tax");
  const toggleSection = (section: "discount" | "tax") =>
    setOpenSection((current) => (current === section ? null : section));

  return (
    <div className="rounded-md border-2 border-gray-100 bg-card overflow-hidden">
      {/* HEADER SECTION - HEIGHT UNCHANGED */}
      {/* <div className="flex items-center justify-between border-b-2 border-gray-100 bg-gray-50 px-3 py-1">
        <div>
          <p className="eyebrow m-0 text-[9px] leading-tight uppercase opacity-70 font-semibold">Header</p>
          <h3 className="m-0 text-sm font-bold leading-tight"></h3>
        </div>
      </div> */}

      {/* THREE-COLUMN LAYOUT: left = Document & Party,
          middle = Project & Scope + Delivery Terms,
          right = Tax Configuration (top) + Discount Scope (below), both collapsible. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-2 p-2 items-start">

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-2">
          <HeaderBlock label="Document Details" icon={<FileText size={11} />} gridCols="grid-cols-4">
            <CField label="Doc No"><Input className="h-7 text-xs" disabled value={form.doc_no || ""} /></CField>

            <CField label="Doc Date " required>
              <Input className="h-7 text-xs w-24" type="date" disabled={headerAndLineDisabled} value={form.doc_date} onChange={(e) => updateField("doc_date", e.target.value)} />
            </CField>
            {(String(docType ?? "").trim().toUpperCase() === "LPO" &&
              <div className="col-span-2">
                <label className="text-[9px] font-semibold text-foreground/75 leading-none">Quotation No</label>
                <LookupField
                  label="Quotation No"
                  compact
                  placeholder="Quotation No"
                  value={String(form.ref_no ?? "")}
                  displayValue={String(form.ref_no ?? "")}
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
                    const selectedAcCode = text(getLookupValue(row || {}, "ac_code"));
                    let accountRow: Record<string, unknown> | undefined;
                    if (selectedAcCode) {
                      try {
                        const accountRows = await getDynamicLookup({
                          parameter: "Account_AC_CODE_Serach_For_suppier_customer",
                          code1: companyCode,
                          loginid: loginIdOrAdmin,
                        });
                        accountRow = (accountRows || [])
                          .map((account) => lowerRecord(account as Record<string, unknown>))
                          .find((account) => text(account.ac_code).trim().toUpperCase() === selectedAcCode.trim().toUpperCase());
                      } catch {
                        accountRow = undefined;
                      }
                    }

                    // Fill quotation fields and fall back to the selected account's master data.
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
                      address1: text(getLookupValue(row || {}, "address1") || accountRow?.address1),
                      address2: text(getLookupValue(row || {}, "address2") || accountRow?.address2),
                      address3: text(getLookupValue(row || {}, "address3") || accountRow?.address3),
                      e_mail: text(getLookupValue(row || {}, "e_mail") || accountRow?.e_mail),
                      prin_name: text(getLookupValue(row || {}, "prin_name") || accountRow?.prin_name),
                      
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
                      tx_compntcat_name_1: text(getLookupValue(row || {}, "tx_compntcat_name_1")),
                      tx_cat_code: text(getLookupValue(row || {}, "tx_cat_code")),
                      tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")),
                      project_name: text(getLookupValue(row || {}, "project_name")),
                      pr_no: text(getLookupValue(row || {}, "pr_no")),
                      scope_of_work: text(getLookupValue(row || {}, "scope_of_work")),

                      tx_compnt_1_expmt: text(getLookupValue(row || {}, "tx_compnt_1_expmt")),
                      discount_scoope:
                        text(getLookupValue(row || {}, "discount_scoope")) === "PO"
                          ? "PO"
                          : text(getLookupValue(row || {}, "discount_scoope")) === "ITEM"
                            ? "ITEM"
                            : current.discount_scoope || "ITEM",

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
                        tx_compnt_amt_1: text(getLookupValue(item, "tx_compnt_amt_1")),
                        tx_compnt_perc_1: numberOrZero(getLookupValue(item, "tx_compnt_perc_1")),
                        porder_tx_cat_code: text(getLookupValue(item, "porder_tx_cat_code")),
                        porder_tx_compntcat_code_1: text(getLookupValue(item, "porder_tx_compntcat_code_1")),
                        porder_required_dt: text(getLookupValue(item, "porder_required_dt")),
                        tx_compnt_1_expmt: text(getLookupValue(item, "tx_compnt_1_expmt")),
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
            <div className="col-span-2">
              <LookupField
                label="A/c code *"
                value={form.ac_code}
                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "party_address", header: "Address" }, { field: "party_phone", header: "Tel" }, { field: "party_fax", header: "Fax" }]}
                valueField="ac_code"
                displayFields={["ac_code", "ac_name"]}
                loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_For_suppier_customer", code1: companyCode, loginid: loginIdOrAdmin })}
                disabled={headerAndLineDisabled}
                onChange={(value, row) =>
                  setForm((current) => ({
                    ...current,

                    ac_code: value,
                    ac_name: text(getLookupValue(row || {}, "ac_name")),
                    address1: text(getLookupValue(row || {}, "address1")),
                    address2: text(getLookupValue(row || {}, "address2")),
                    address3: text(getLookupValue(row || {}, "address3")),
                    party_phone: text(
                      getLookupValue(row || {}, "party_phone")
                    ),

                    party_fax: text(
                      getLookupValue(row || {}, "party_fax")
                    ),

                    curr_code: text(
                      getLookupValue(row || {}, "curr_code")
                    ),

                    dept_code: text(
                      getLookupValue(row || {}, "dept_code")
                    ),
                    e_mail: text(getLookupValue(row || {}, "e_mail")),
                    prin_name: text(getLookupValue(row || {}, "prin_name")),
                    credit_period: numberOrZero(getLookupValue(row || {}, "credit_period")),
                  }))
                }
              />
            </div>
            <CField label="Tel no"><Input className="h-7 text-xs text-right" style={{ width: "12px" }} disabled={headerAndLineDisabled} value={form.party_phone} onChange={(e) => updateField("party_phone", e.target.value)} /></CField>
            <CField label="Faxn"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.party_fax} onChange={(e) => updateField("party_fax", e.target.value)} /></CField>
            <CField label="Credit Period">
              <Input className="h-7 w-full text-xs text-right" disabled={headerAndLineDisabled} type="number" value={form.credit_period} onChange={(e) => updateField("credit_period", Number(e.target.value || 0))} />
            </CField>
             
                
                <CField label="Prin Name"><Input className="h-7 text-xs text-right" style={{ width: "12px" }} disabled={headerAndLineDisabled} value={form.prin_name} onChange={(e) => updateField("prin_name", e.target.value)} /></CField>
                 <CField label="Email" className="col-span-2"><Input className=" h-7 text-xs   " disabled={headerAndLineDisabled} value={form.e_mail} onChange={(e) => updateField("e_mail", e.target.value)} /></CField>
            <CField label="Address Line 1" className={docTypeUpper === "LPO" ? "col-span-2" : "col-span-2"}>
              <Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.address1} onChange={(e) => updateField("address1", e.target.value)} />
            </CField>
             <CField label="Address Line 2" className={docTypeUpper === "LPO" ? "col-span-2" : "col-span-2"}>
              <Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.address2} onChange={(e) => updateField("address2", e.target.value)} />
            </CField>
             <CField label="Address Line 3" className={docTypeUpper === "LPO" ? "col-span-2" : "col-span-2"}>
              <Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.address3} onChange={(e) => updateField("address3", e.target.value)} />
            </CField>
            {(String(docType ?? "").trim().toUpperCase() === "SO" && <CField label="Quotation No">
              <Input className="h-7 text-xs" type="Quotation No" disabled={headerAndLineDisabled} value={form.ref_no} onChange={(e) => updateField("ref_no", e.target.value)} />
            </CField>)}

            {/* <CField label="Quotn Date">
              <Input className="h-7 text-xs" type="date" disabled={headerAndLineDisabled} value={form.ref_date} onChange={(e) => updateField("ref_date", e.target.value)} />
            </CField> */}



            <CField label="Payment Terms" className="col-span-2">
              <Input
                className="h-7 text-xs "
                disabled={headerAndLineDisabled}
                value={form.payment_terms}
                onChange={(e) =>
                  updateField("payment_terms", e.target.value)
                }
              />
            </CField>
            <CField label="Remarks" className="col-span-2">
              <Input
                className="h-7 text-xs"
                disabled={headerAndLineDisabled}
                value={form.remarks}
                onChange={(e) =>
                  updateField("remarks", e.target.value)
                }
              />
            </CField>
          </HeaderBlock>

          {/* <HeaderBlock label="Party Details" icon={<Building2 size={11} />} gridCols="grid-cols-6">
            <div className="col-span-4">
              <LookupField
                label="A/c code *"
                value={form.ac_code}
                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "party_address", header: "Address" }, { field: "party_phone", header: "Tel" }, { field: "party_fax", header: "Fax" }]}
                valueField="ac_code"
                displayFields={["ac_code", "ac_name"]}
                loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach_For_suppier_customer", code1: companyCode, loginid: loginIdOrAdmin })}
                disabled={headerAndLineDisabled}
                onChange={(value, row) =>
                  setForm((current) => ({
                    ...current,

                    ac_code: value,
                    ac_name: text(getLookupValue(row || {}, "ac_name")),

                    party_address: text(
                      getLookupValue(row || {}, "party_address")
                    ),

                    party_phone: text(
                      getLookupValue(row || {}, "party_phone")
                    ),

                    party_fax: text(
                      getLookupValue(row || {}, "party_fax")
                    ),

                    curr_code: text(
                      getLookupValue(row || {}, "curr_code")
                    ),

                    dept_code: text(
                      getLookupValue(row || {}, "dept_code")
                    ),
                  }))
                }
              />
            </div>
            <CField label="Tel"><Input className="h-7 text-xs text-right" disabled={headerAndLineDisabled} value={form.party_phone} onChange={(e) => updateField("party_phone", e.target.value)} /></CField>
            <CField label="Fax"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.party_fax} onChange={(e) => updateField("party_fax", e.target.value)} /></CField>
            <CField label="Address" className="col-span-3"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.party_address} onChange={(e) => updateField("party_address", e.target.value)} /></CField>
            <CField label="Expense A/c Post" className="col-span-2">
              <Select className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </CField>
            {(String(docType ?? "").trim().toUpperCase() === "LPO" && (
              <>
                <CField label="Buyer" className="col-span-2"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.buyer} onChange={(e) => updateField("buyer", e.target.value)} /></CField>
                <CField label="WO No" className="col-span-2"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.wo_number} onChange={(e) => updateField("wo_number", e.target.value)} /></CField>
              </>
            ))}
          </HeaderBlock> */}




        </div>

        {/* MIDDLE COLUMN — Project & Scope, Delivery Terms */}
        <div className="flex flex-col gap-2">
          {/* Delivery Terms (Pay Terms + delivery fields for LPO / SO) */}
          <HeaderBlock label="Other Details" icon={<Truck size={11} />} gridCols="grid-cols-3">
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
            <CField label="Ex Rate">
              <Input
                className=" w-full px-1 text-[11px] text-right"
                type="number"
                disabled={headerAndLineDisabled}
                step="0.000001"
                value={form.ex_rate}
                onChange={(e) =>
                  updateField("ex_rate", Number(e.target.value || 1))
                }
              />
            </CField>
            <div className="col-span-1">
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
            {(String(docType ?? "").trim().toUpperCase() === "LPO" && (
              <>
                <CField label="Buyer" className="col-span-1"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.buyer} onChange={(e) => updateField("buyer", e.target.value)} /></CField>
                <CField label="WO No" className="col-span-1"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.wo_number} onChange={(e) => updateField("wo_number", e.target.value)} /></CField>
              </>
            ))}
            <CField label="Expense A/c Post" className="col-span-1">
              <Select className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.expense_ac_post} onChange={(e) => updateField("expense_ac_post", e.target.value)}>
                {EXPENSE_AC_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </CField>
          </HeaderBlock>

          {/* Delivery Terms (Pay Terms + delivery fields for LPO / SO) */}
          <HeaderBlock label="Delivery Terms" icon={<Truck size={11} />} gridCols="grid-cols-2">

            {(docTypeUpper === "LPO" || docTypeUpper === "SO" || docTypeUpper === "PQA") && (
              <>
                <CField label="Delivery Contact Person"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.dlvr_contact} onChange={(e) => updateField("dlvr_contact", e.target.value)} /></CField>
                <CField label="Delivery Telephone"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.dlvr_mobile} onChange={(e) => updateField("dlvr_mobile", e.target.value)} /></CField>
                <CField label="Delivery Email Address"><Input className="h-7 text-xs" type="email" disabled={headerAndLineDisabled} value={form.dlvr_email} onChange={(e) => updateField("dlvr_email", e.target.value)} /></CField>
                <CField label="Delivery Term"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.dlvr_term} onChange={(e) => updateField("dlvr_term", e.target.value)} /></CField>
              </>
            )}
          </HeaderBlock>
        </div>

        {/* RIGHT COLUMN — Tax Configuration (top), Discount Scope (below), both collapsible */}
        <div className="flex flex-col gap-2">
          {/* Tax Configuration — collapsible */}
          <HeaderBlock
            label="Tax Configuration"
            icon={<Receipt size={11} />}
            gridCols="grid-cols-2"
            collapsible
            open={openSection === "tax"}
            onToggle={() => toggleSection("tax")}
            summary={
              <>
                <SummaryItem label="Type" value={taxTypeLabel} />
                <SummaryItem label="Category" value={form.tx_cat_name ? `${form.tx_cat_code} - ${form.tx_cat_name}` : form.tx_cat_code} />
                <SummaryItem label="Code" value={form.tx_compntcat_name_1 ? `${form.tx_compntcat_code_1} - ${form.tx_compntcat_name_1}` : form.tx_compntcat_code_1} />
              </>
            }
          >
            <CField label="Tax Type">
              <Select className="h-7 text-xs" value={form.tx_compnt_1_expmt || "N"} onChange={(e) => {
                const taxType = e.target.value;
                setForm((current) => ({ ...current, tx_compnt_1_expmt: taxType, tx_compnt_1_pct: taxType === "S" ? 5 : 0 }));
              }}>
                <option value="N">No Tax</option><option value="S">Std Tax</option><option value="Z">Zero</option><option value="E">Exempt</option>
              </Select>
            </CField>

            <LookupField
              label="Tax Category"
              value={form.tx_cat_name
                ? `${form.tx_cat_code} - ${form.tx_cat_name}`
                : form.tx_cat_code}
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
                  tx_cat_name: text(getLookupValue(row || {}, "tx_cat_name")),

                }))
              }
            />

            <LookupField
              label="Tax Code"
              value={form.tx_compntcat_name_1
                ? `${form.tx_compntcat_code_1} - ${form.tx_compntcat_name_1}`
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

          </HeaderBlock>

          {/* Discount Scope — scope only, collapsible */}
          <HeaderBlock
            label="Discount Scope"
            icon={<Percent size={11} />}
            gridCols="grid-cols-2"
            collapsible
            open={openSection === "discount"}
            onToggle={() => toggleSection("discount")}
            summary={
              <>
                <SummaryItem label="Applied To" value={discountScope === "PO" ? "Entire PO" : "Individual Items"} />
                <SummaryItem label="Amt" value={discAmtShown.toFixed(3)} />
                <SummaryItem label="%" value={discPctShown.toFixed(3)} />
              </>
            }
          >
            <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-gray-100 pb-1 mb-0.5">
              <span className="text-[9px] font-semibold text-foreground/75">
                Discount Applied To:
              </span>

              <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                <input
                  type="radio"
                  name="discount_scoope"
                  value="PO"
                  checked={discountScope === "PO"}
                  disabled={headerAndLineDisabled}
                  onChange={() => {
                    const seededPrice = TotalDiscAmount(rows || []);
                    const seededPercent = DiscAmountPercentage(form, rows || []);
                    setForm((current) => ({
                      ...current,
                      discount_scoope: "PO",
                      disc_hdr_price: seededPrice,
                      disc_hdr_percent: seededPercent,
                    }));
                  }}
                />
                Entire PO
              </label>

              <label className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer">
                <input
                  type="radio"
                  name="discount_scoope"
                  value="ITEM"
                  checked={discountScope === "ITEM"}
                  disabled={headerAndLineDisabled}
                  onChange={() =>
                    setForm((current) => ({
                      ...current,
                      discount_scoope: "ITEM",
                    }))
                  }
                />
                Individual Items
              </label>
            </div>

            <CField label="Disc Amt">
              <Input
                className="h-7 text-xs text-right"
                type="number"
                step="0.01"
                disabled={
                  headerAndLineDisabled ||
                  discountScope === "ITEM"
                }
                value={
                  discountScope === "ITEM"
                    ? TotalDiscAmount(rows || []).toFixed(3)
                    : numberOrZero(form.disc_hdr_price).toFixed(3)
                }
                onChange={(e) => {
                  const value = Number(e.target.value || 0);
                  updateField("disc_hdr_price", value);
                  calculateDiscount("amount", value);
                }}
              />
            </CField>
            <CField label="Disc %">
              <Input
                className="h-7 text-xs text-right"
                type="number"
                step="0.001"
                disabled={
                  headerAndLineDisabled ||
                  discountScope === "ITEM"
                }
                value={
                  discountScope === "ITEM"
                    ? DiscAmountPercentage(form, rows || []).toFixed(3)
                    : numberOrZero(form.disc_hdr_percent).toFixed(3)
                }
                onChange={(e) => {
                  const value = Number(e.target.value || 0);
                  updateField("disc_hdr_percent", value);
                  calculateDiscount("percent", value);
                }}
              />
            </CField>

          </HeaderBlock>
          {/* Project & Scope Section (LPO only) */}
          {docTypeUpper === "LPO" && (
            <HeaderBlock label="Project & Scope" icon={<Briefcase size={11} />} gridCols="grid-cols-3">
              <CField label="Project Name"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.project_name} onChange={(e) => updateField("project_name", e.target.value)} /></CField>
              <CField label="PR No"><Input className="h-7 text-xs text-right" disabled={headerAndLineDisabled} value={form.pr_no} onChange={(e) => updateField("pr_no", e.target.value)} /></CField>
              <CField label="Scope of Work"><Input className="h-7 text-xs" disabled={headerAndLineDisabled} value={form.scope_of_work} onChange={(e) => updateField("scope_of_work", e.target.value)} /></CField>
            </HeaderBlock>
          )}

        </div>


      </div>
    </div>
  );
}