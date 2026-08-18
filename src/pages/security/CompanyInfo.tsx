// import { useMemo } from "react";
// import { MasterPage } from "../../components/ui/MasterPage";
// import type { MasterField, MasterFormTab } from "../../components/ui/MasterPage";
// import { executeDynamicMutation } from "../../api/lookups";
// import { useAuth } from "../../state/AuthContext";
// import { executeWmsInboundSql } from "../../api/wms";

// export default function CompanyInfo() {
//   const { user } = useAuth();

//   // ── Tabs ──────────────────────────────────────────────────────────────
//   const formTabs = useMemo<MasterFormTab[]>(
//     () => [
//       { key: "basic", label: "Basic Info" },
//       { key: "address", label: "Address" },
//       { key: "contact", label: "Contact" },
//       { key: "bank", label: "Bank / Account" },
//       { key: "numbers", label: "Numbers / Aging" },
//     ],
//     [],
//   );

//   // ── Fields (assigned to tabs) ─────────────────────────────────────────
//   const fields = useMemo<MasterField[]>(
//     () => [
//       // ── Tab: Basic Info ───────────────────────────────────────────────
//       {
//         name: "company_code",
//         label: "Company Code",
//         required: true,
//         disabledOnEdit: true,
//         maxLength: 10,
//         width: 140,
//         tab: "basic",
//       },
//       {
//         name: "company_name",
//         label: "Company Name",
//         required: true,
//         width: 260,
//         tab: "basic",
//       },
//       {
//         name: "company_short_name",
//         label: "Short Name",
//         width: 160,
//         tab: "basic",
//       },

//       // ── Tab: Address ──────────────────────────────────────────────────
//       {
//         name: "address1",
//         label: "Address Line 1",
//         width: 240,
//         tab: "address",
//       },
//       {
//         name: "address2",
//         label: "Address Line 2",
//         width: 240,
//         tab: "address",
//       },
//       {
//         name: "address3",
//         label: "Address Line 3",
//         width: 240,
//         tab: "address",
//       },
//       {
//         name: "city",
//         label: "City",
//         width: 150,
//         tab: "address",
//       },
//       {
//         name: "country",
//         label: "Country",
//         width: 120,
//         tab: "address",
//       },

//       // ── Tab: Contact ──────────────────────────────────────────────────
//       {
//         name: "email",
//         label: "Email",
//         type: "email",
//         width: 220,
//         tab: "contact",
//       },
//       {
//         name: "tel_no",
//         label: "Telephone",
//         width: 150,
//         tab: "contact",
//       },
//       {
//         name: "fax_no",
//         label: "Fax",
//         width: 150,
//         tab: "contact",
//       },
//       {
//         name: "currency",
//         label: "Currency",
//         width: 100,
//         tab: "contact",
//       },

//       // ── Tab: Bank / Account ───────────────────────────────────────────
//       {
//         name: "bank_name",
//         label: "Bank Name",
//         width: 200,
//         tab: "bank",
//       },
//       {
//         name: "ac_code",
//         label: "Account Code",
//         width: 140,
//         tab: "bank",
//       },
//       {
//         name: "reference_no",
//         label: "Reference No",
//         width: 160,
//         tab: "bank",
//       },

//       // ── Tab: Numbers / Aging ──────────────────────────────────────────
//       {
//         name: "maxjob_no",
//         label: "Max Job No",
//         type: "number",
//         width: 120,
//         tab: "numbers",
//       },
//       {
//         name: "age_1",
//         label: "Age 1 (days)",
//         type: "number",
//         width: 110,
//         tab: "numbers",
//       },
//       {
//         name: "age_2",
//         label: "Age 2 (days)",
//         type: "number",
//         width: 110,
//         tab: "numbers",
//       },
//       {
//         name: "age_3",
//         label: "Age 3 (days)",
//         type: "number",
//         width: 110,
//         tab: "numbers",
//       },
//       {
//         name: "age_4",
//         label: "Age 4 (days)",
//         type: "number",
//         width: 110,
//         tab: "numbers",
//       },
//       {
//         name: "age_5",
//         label: "Age 5 (days)",
//         type: "number",
//         width: 110,
//         tab: "numbers",
//       },
//       {
//         name: "quotation_nr",
//         label: "Quotation Nr",
//         type: "number",
//         width: 120,
//         tab: "numbers",
//       },
//       {
//         name: "last_amendment_date",
//         label: "Last Amendment",
//         type: "date",
//         width: 150,
//         tab: "numbers",
//       },
//     ],
//     [],
//   );

//   // ── Load (Raw SQL) ──────────────────────────────────────────────────
//   const customLoad = async () => {
//     const typedUser = user as { loginid: string; company_code: string };

//     const data = await executeWmsInboundSql(`
//       SELECT *
//       FROM MS_COMPANYINFO
//       WHERE COMPANY_CODE = '${typedUser.company_code}'
//       ORDER BY COMPANY_CODE
//     `);

//     return {
//       tableData: Array.isArray(data) ? data : [],
//       count: Array.isArray(data) ? data.length : 0,
//     };
//   };

//   // ── Save (Insert / Update) ──────────────────────────────────────────
//   const customSave = async (
//     form: Record<string, unknown>,
//     context: { editMode: boolean; original: Record<string, unknown> | null; user: unknown },
//   ) => {
//     const typedUser = context.user as { loginid: string; company_code: string };

//     await executeDynamicMutation({
//       parameter: "COMPANYINFO_INS_UPD",
//       loginid: typedUser.loginid,

//       // Main string values
//       val1s1: form.company_name ? String(form.company_name) : undefined,
//       val1s2: form.address1 ? String(form.address1) : undefined,
//       val1s3: form.address2 ? String(form.address2) : undefined,
//       val1s4: form.address3 ? String(form.address3) : undefined,
//       val1s5: form.city ? String(form.city) : undefined,
//       val1s6: form.country ? String(form.country) : undefined,
//       val1s7: form.email ? String(form.email) : undefined,
//       val1s8: form.currency ? String(form.currency) : undefined,
//       val1s9: form.tel_no ? String(form.tel_no) : undefined,
//       val1s10: form.fax_no ? String(form.fax_no) : undefined,

//       // Numbers
//       val1n1: form.maxjob_no != null ? Number(form.maxjob_no) : undefined,
//       val1n2: form.age_1 != null ? Number(form.age_1) : undefined,
//       val1n3: form.age_2 != null ? Number(form.age_2) : undefined,
//       val1n4: form.age_3 != null ? Number(form.age_3) : undefined,
//       val1n5: form.age_4 != null ? Number(form.age_4) : undefined,

//       // Date
//       val1d1: form.last_amendment_date
//         ? String(form.last_amendment_date)
//         : undefined,

//       // Key + extra strings
//       wval1s1: form.company_code
//         ? String(form.company_code)
//         : typedUser.company_code,
//       wval1s2: form.company_short_name
//         ? String(form.company_short_name)
//         : undefined,
//       wval1s3: form.bank_name ? String(form.bank_name) : undefined,
//       wval1s4: form.ac_code ? String(form.ac_code) : undefined,
//       wval1s5: form.reference_no ? String(form.reference_no) : undefined,

//       wval1n1: form.age_5 != null ? Number(form.age_5) : undefined,
//       wval1n2: form.quotation_nr != null ? Number(form.quotation_nr) : undefined,
//     });
//   };

//   // ── Delete ──────────────────────────────────────────────────────────
//   const customDelete = async (row: Record<string, unknown>, userArg: unknown) => {
//     await executeWmsInboundSql(`
//       DELETE FROM MS_COMPANYINFO
//       WHERE COMPANY_CODE = '${String(row.company_code)}'
//     `);
//   };

//   return (
//     <MasterPage
//       config={{
//         title: "Company Detail",
//         subtitle: "Maintain company master information, address, contact and basic configuration.",
//         master: "companyinfo",
//         keyFields: ["company_code"],
//         rowIdSeparator: "_",
//         fieldsPerRow: 3,
//         formTabs,          // ← enables the tab UI
//         fields,
//         customLoad,
//         customSave,
//         customDelete,
//       }}
//     />
//   );
// }
import { useMemo } from "react";
import { MasterPage } from "../../components/ui/MasterPage";
import type { MasterField, MasterFormTab } from "../../components/ui/MasterPage";
import { executeDynamicMutationColumn90 } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { executeWmsInboundSql } from "../../api/wms";

const yesNo = [
  { label: "Yes", value: "Y" },
  { label: "No", value: "N" },
];

export default function CompanyInfo() {
  const { user } = useAuth();

  const formTabs = useMemo<MasterFormTab[]>(
    () => [
      { key: "basic", label: "Basic Info" },
      { key: "address", label: "Address & Contact" },
      { key: "web", label: "Web / Theme" },
      { key: "bank", label: "Bank & Finance" },
      { key: "numbers", label: "Numbers & Sequences" },
      { key: "flags", label: "Flags & Settings" },
      { key: "paths", label: "Paths & Integration" },
    ],
    [],
  );

  const fields = useMemo<MasterField[]>(
    () => [
      // ── Basic ──────────────────────────────────────────────────────
      { name: "company_code", label: "Company Code", required: true, disabledOnEdit: true, maxLength: 10, width: 140, tab: "basic" },
      { name: "company_name", label: "Company Name", required: true, width: 260, tab: "basic" },
      { name: "company_short_name", label: "Short Name", width: 160, tab: "basic" },
      { name: "company_group_no", label: "Company Group No", width: 140, tab: "basic" },
      { name: "default_prin_code", label: "Default Principal", width: 160, tab: "basic" },
      { name: "currency", label: "Currency", width: 100, tab: "basic" },
      { name: "logo_title", label: "Logo Title", width: 180, tab: "basic" },

      // ── Address & Contact ──────────────────────────────────────────
      { name: "address1", label: "Address Line 1", width: 240, tab: "address" },
      { name: "address2", label: "Address Line 2", width: 240, tab: "address" },
      { name: "address3", label: "Address Line 3", width: 240, tab: "address" },
      { name: "city", label: "City", width: 150, tab: "address" },
      { name: "country", label: "Country", width: 120, tab: "address" },
      { name: "email", label: "Email", type: "email", width: 220, tab: "address" },
      { name: "tel_no", label: "Telephone", width: 150, tab: "address" },
      { name: "fax_no", label: "Fax", width: 150, tab: "address" },
      { name: "da_rep_cardno", label: "DA Rep Card No", width: 140, tab: "address" },

      // ── Web / Theme ────────────────────────────────────────────────
      { name: "web_logopath", label: "Web Logo Path", width: 220, tab: "web" },
      { name: "web_col_head", label: "Header Color", width: 140, tab: "web" },
      { name: "web_col_foot", label: "Footer Color", width: 140, tab: "web" },
      { name: "web_col_button", label: "Button Color", width: 140, tab: "web" },
      { name: "web_col_table", label: "Table Color", width: 140, tab: "web" },
      { name: "web_col_text", label: "Text Color", width: 140, tab: "web" },
      { name: "invoice_col_text", label: "Invoice Text Color", width: 140, tab: "web" },
      { name: "footer_note", label: "Footer Note", type: "textarea", width: 300, tab: "web" },

      // ── Bank & Finance ─────────────────────────────────────────────
      { name: "bank_name", label: "Bank Name", width: 200, tab: "bank" },
      { name: "bank_address", label: "Bank Address", width: 240, tab: "bank" },
      { name: "ac_code", label: "Account Code", width: 140, tab: "bank" },
      { name: "reference_no", label: "Reference No", width: 160, tab: "bank" },
      { name: "swift_code", label: "SWIFT Code", width: 140, tab: "bank" },
      { name: "signatory_1", label: "Signatory 1", width: 160, tab: "bank" },
      { name: "signatory_2", label: "Signatory 2", width: 160, tab: "bank" },
      { name: "prin_auto_ac_code", label: "Prin Auto A/C", width: 160, tab: "bank" },
      { name: "upload_inv_ac", label: "Upload Inv A/C", width: 140, tab: "bank" },
      { name: "payment_term3", label: "Payment Term 3", width: 140, tab: "bank" },
      { name: "tax_num", label: "Tax Number", width: 140, tab: "bank" },
      { name: "company_trn_no", label: "Company TRN", width: 140, tab: "bank" },
      { name: "supp_trn_no", label: "Supplier TRN", width: 140, tab: "bank" },
      { name: "trn_no", label: "TRN No", width: 140, tab: "bank" },

      // ── Numbers & Sequences ────────────────────────────────────────
      { name: "maxjob_no", label: "Max Job No", type: "number", width: 120, tab: "numbers" },
      { name: "maxinv_no", label: "Max Inv No", type: "number", width: 120, tab: "numbers" },
      { name: "maxjob_no_exp", label: "Max Job No (Exp)", type: "number", width: 140, tab: "numbers" },
      { name: "ff_maxjob_nr", label: "FF Max Job Nr", type: "number", width: 130, tab: "numbers" },
      { name: "ff_maxcomminv_nr", label: "FF Max Comm Inv", type: "number", width: 140, tab: "numbers" },
      { name: "ff_maxgrn_nr", label: "FF Max GRN Nr", type: "number", width: 130, tab: "numbers" },
      { name: "quotation_nr", label: "Quotation Nr", type: "number", width: 120, tab: "numbers" },
      { name: "seq_number_bl", label: "Seq Number BL", type: "number", width: 130, tab: "numbers" },
      { name: "enquiry_nr", label: "Enquiry Nr", type: "number", width: 120, tab: "numbers" },
      { name: "service_booking_nr", label: "Service Booking Nr", type: "number", width: 150, tab: "numbers" },
      { name: "service_contract_nr", label: "Service Contract Nr", type: "number", width: 150, tab: "numbers" },
      { name: "consol_pick_id", label: "Consol Pick ID", type: "number", width: 130, tab: "numbers" },
      { name: "req_seq_nr", label: "Req Seq Nr", type: "number", width: 120, tab: "numbers" },
      { name: "max_mail_srno", label: "Max Mail Sr No", type: "number", width: 130, tab: "numbers" },
      { name: "age_1", label: "Age 1", type: "number", width: 100, tab: "numbers" },
      { name: "age_2", label: "Age 2", type: "number", width: 100, tab: "numbers" },
      { name: "age_3", label: "Age 3", type: "number", width: 100, tab: "numbers" },
      { name: "age_4", label: "Age 4", type: "number", width: 100, tab: "numbers" },
      { name: "age_5", label: "Age 5", type: "number", width: 100, tab: "numbers" },
      { name: "last_amendment_date", label: "Last Amendment", type: "date", width: 150, tab: "numbers" },
      { name: "ac_fy_period", label: "A/C FY Period", width: 130, tab: "numbers" },
      { name: "opn_fy_period", label: "Open FY Period", width: 130, tab: "numbers" },
      { name: "shift1", label: "Shift 1", width: 100, tab: "numbers" },
      { name: "shift2", label: "Shift 2", width: 100, tab: "numbers" },
      { name: "cfs_sms_stk_days", label: "CFS SMS Stk Days", type: "number", width: 140, tab: "numbers" },

      // ── Flags & Settings ───────────────────────────────────────────
      { name: "double_deep_putaway", label: "Double Deep Putaway", type: "select", options: yesNo, width: 150, tab: "flags" },
      { name: "hawb", label: "HAWB", type: "select", options: yesNo, width: 100, tab: "flags" },
      { name: "carton_group_no", label: "Carton Group No", width: 140, tab: "flags" },
      { name: "srvact_refno", label: "Srv Act Ref No", width: 140, tab: "flags" },
      { name: "erp_integration", label: "ERP Integration", type: "select", options: yesNo, width: 140, tab: "flags" },
      { name: "erp_integration_profile", label: "ERP Profile", width: 160, tab: "flags" },
      { name: "orditem_withstk", label: "Ord Item With Stk", type: "select", options: yesNo, width: 150, tab: "flags" },
      { name: "pda_gatepass", label: "PDA Gatepass", type: "select", options: yesNo, width: 130, tab: "flags" },
      { name: "perpectual_confirm_allow", label: "Perpetual Confirm", type: "select", options: yesNo, width: 150, tab: "flags" },
      { name: "strg_compute_mthd", label: "Storage Compute Mthd", width: 160, tab: "flags" },
      { name: "chklist_vald", label: "Checklist Validation", type: "select", options: yesNo, width: 150, tab: "flags" },
      { name: "dn_grn_apprval", label: "DN/GRN Approval", type: "select", options: yesNo, width: 140, tab: "flags" },
      { name: "stop_version", label: "Stop Version", type: "select", options: yesNo, width: 120, tab: "flags" },
      { name: "copack_ind", label: "Copack Indicator", type: "select", options: yesNo, width: 140, tab: "flags" },
      { name: "test_val", label: "Test Val", type: "select", options: yesNo, width: 100, tab: "flags" },
      { name: "act_amend_pwd", label: "Act Amend Password", width: 160, tab: "flags" },
      { name: "bl_code", label: "BL Code", width: 120, tab: "flags" },

      // ── Paths & Integration ────────────────────────────────────────
      { name: "dn_mail_file_path", label: "DN Mail File Path", width: 220, tab: "paths" },
      { name: "apeon_upload_folder", label: "Apeon Upload Folder", width: 200, tab: "paths" },
      { name: "srv_image_path", label: "Service Image Path", width: 200, tab: "paths" },
      { name: "vat_img_path", label: "VAT Image Path", width: 200, tab: "paths" },
    ],
    [],
  );

  // ── Load ────────────────────────────────────────────────────────────
  const customLoad = async () => {
    const typedUser = user as { loginid: string; company_code: string };
    const data = await executeWmsInboundSql(`
      SELECT * FROM MS_COMPANYINFO
      WHERE COMPANY_CODE = '${typedUser.company_code}'
      ORDER BY COMPANY_CODE
    `);
    return {
      tableData: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0,
    };
  };

  // ── Save (Column90) ─────────────────────────────────────────────────
  const customSave = async (
    form: Record<string, unknown>,
    context: { editMode: boolean; original: Record<string, unknown> | null; user: unknown },
  ) => {
    const typedUser = context.user as { loginid: string; company_code: string };

    const s = (v: unknown) => (v == null || v === "" ? undefined : String(v));
    const n = (v: unknown) => (v == null || v === "" ? undefined : Number(v));

    await executeDynamicMutationColumn90({
      parameter: "ms_companyinfo_ins_upd",
      loginid: typedUser.loginid,

      // Key
      val1s1: s(form.company_code) || typedUser.company_code,

      // Basic / Address
      val1s2: s(form.company_name),
      val1s3: s(form.address1),
      val1s4: s(form.address2),
      val1s5: s(form.address3),
      val1s6: s(form.city),
      val1s7: s(form.country),
      val1s8: s(form.email),
      val1s9: s(form.currency),

      // Web
      val1s10: s(form.web_logopath),
      val1s11: s(form.web_col_head),
      val1s12: s(form.web_col_foot),
      val1s13: s(form.web_col_button),
      val1s14: s(form.web_col_table),
      val1s15: s(form.web_col_text),

      // Date + contact
      val1s16: s(form.last_amendment_date), // YYYY-MM-DD
      val1s17: s(form.da_rep_cardno),
      val1s18: s(form.tel_no),
      val1s19: s(form.fax_no),

      // Numbers (first batch)
      val1n1: n(form.maxjob_no),
      val1n2: n(form.maxinv_no),
      val1n3: n(form.age_1),
      val1n4: n(form.age_2),
      val1n5: n(form.age_3),
      val1n6: n(form.age_4),
      val1n7: n(form.age_5),
      val1n8: n(form.quotation_nr),
      val1n9: n(form.seq_number_bl),
      val1n10: n(form.ff_maxjob_nr),

      // Remaining as strings (converted in procedure where needed)
      val1s20: s(form.ff_maxcomminv_nr),
      val1s21: s(form.bank_name),
      val1s22: s(form.ac_code),
      val1s23: s(form.reference_no),
      val1s24: s(form.swift_code),
      val1s25: s(form.act_amend_pwd),
      val1s26: s(form.bank_address),
      val1s27: s(form.signatory_1),
      val1s28: s(form.signatory_2),
      val1s29: s(form.prin_auto_ac_code),
      val1s30: s(form.double_deep_putaway),
      val1s31: s(form.company_short_name),
      val1s32: s(form.default_prin_code),
      val1s33: s(form.ff_maxgrn_nr),
      val1s34: s(form.hawb),
      val1s35: s(form.company_group_no),
      val1s36: s(form.carton_group_no),
      val1s37: s(form.srvact_refno),
      val1s38: s(form.erp_integration),
      val1s39: s(form.erp_integration_profile),
      val1s40: s(form.orditem_withstk),
      val1s41: s(form.pda_gatepass),
      val1s42: s(form.perpectual_confirm_allow),
      // val1s43 / 44 free if needed
      val1s45: s(form.enquiry_nr),
      val1s46: s(form.invoice_col_text),
      val1s47: s(form.logo_title),
      val1s48: s(form.strg_compute_mthd),
      val1s49: s(form.chklist_vald),
      val1s50: s(form.dn_grn_apprval),

      // Extra slots – extend DynamicMutationParams type for these
      // @ts-expect-error – extend type to val1s51+ if not already done
      val1s51: s(form.footer_note),
      val1s52: s(form.service_booking_nr),
      val1s53: s(form.service_contract_nr),
      val1s54: s(form.consol_pick_id),
      val1s55: s(form.shift1),
      val1s56: s(form.shift2),
      val1s57: s(form.stop_version),
      val1s58: s(form.req_seq_nr),
      val1s59: s(form.cfs_sms_stk_days),
      val1s60: s(form.srv_image_path),
      val1s61: s(form.vat_img_path),
      val1s62: s(form.company_trn_no),
      val1s63: s(form.supp_trn_no),
      val1s64: s(form.trn_no),
      val1s65: s(form.ac_fy_period),
      val1s66: s(form.upload_inv_ac),
      val1s67: s(form.bl_code),
      val1s68: s(form.copack_ind),
      val1s69: s(form.opn_fy_period),
      val1s70: s(form.payment_term3),
      val1s72: s(form.maxjob_no_exp),
      val1s73: s(form.dn_mail_file_path),
      val1s74: s(form.apeon_upload_folder),
      val1s75: s(form.max_mail_srno),
      val1s76: s(form.test_val),
      val1s77: s(form.tax_num),
    });
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const customDelete = async (row: Record<string, unknown>) => {
    await executeWmsInboundSql(`
      DELETE FROM MS_COMPANYINFO
      WHERE COMPANY_CODE = '${String(row.company_code)}'
    `);
  };

  return (
    <MasterPage
      config={{
        title: "Company Detail",
        subtitle: "Maintain complete company master information.",
        master: "companyinfo",
        keyFields: ["company_code"],
        rowIdSeparator: "_",
        fieldsPerRow: 3,
        formTabs,
        fields,
        customLoad,
        customSave,
        customDelete,
      }}
    />
  );
}