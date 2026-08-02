import { executeDynamicMutation } from "../../api/lookups";
import { executeWmsInboundSql } from "../../api/wms";
import msPrincipalServiceInstance from "../../api/principal";
import type { WmsSimpleMasterConfig } from "./WmsSimpleMasterPage";
import ImportLocationEdi from "./edi/ImportLocationEdi";
import { api } from "../../api/client";

const yesNo = [
  { label: "No", value: "N" },
  { label: "Yes", value: "Y" },
];

const activeInactive = [
  { label: "Active", value: "A" },
  { label: "Inactive", value: "I" },
];

const transportMode = [
  { label: "Sea", value: "Sea" },
  { label: "Air", value: "Air" },
  { label: "Road", value: "Road" },
];

export const wmsSimpleMasterConfigs: Record<string, WmsSimpleMasterConfig> = {
  activity: {
    title: "Activity Master",
    subtitle: "Maintain WMS activity codes, group/subgroup links, cost & billing components.",
    master: "activity",
    gmEndpoint: "activity",
    routeKeys: ["activity"],
    keyField: "activity_code",
    fieldsPerRow: 4,
    fields: [
      // General
      { name: "activity_code", label: "Activity Code", required: true, disabledOnEdit: true, width: 150, maxLength: 5, section: "General" },
      { name: "activity", label: "Activity Name", required: true, width: 280, section: "General" },
      { name: "activity_group_code", label: "Activity Group", dropdownParam: "DROP_DOWN_ACTIVITY_GROUP", dropdownDisplayFields: ["activity_group_code", "act_group_name"], dropdownLabelKey: "act_group_name", dropdownValueKey: "activity_group_code", width: 170, section: "General" },
      { name: "activity_subgroup_code", label: "Activity Sub Group", dropdownParam: "DROP_DOWN_ACTIVITY_SUBGROUP", 
        // dropdownCodeMap: { activity_group_code: "code1" }, 
        dropdownDisplayFields: ["activity_subgroup_code", "act_subgroup_name"], dropdownLabelKey: "act_subgroup_name", dropdownValueKey: "activity_subgroup_code", width: 180, section: "General" },
      { name: "wip_code", label: "WIP Code", width: 140, maxLength: 5, section: "General" },
      { name: "income_code", label: "Income Code", width: 150, maxLength: 10, section: "General" },
      { name: "site_ind", label: "Site Indicator", dropdownParam: "DROP_DOWN_SITE_IND", dropdownDisplayFields: ["site_ind", "ind_desc"], dropdownDisplaySeparator: " - ", dropdownValueKey: "site_ind", width: 150, maxLength: 5, section: "General" },
      { name: "act_type", label: "Activity Type", width: 120, maxLength: 1, section: "General" },
      { name: "mandatory_flag", label: "Mandatory", type: "select", options: yesNo, width: 120, section: "General" },
      { name: "freeze_flag", label: "Freeze", type: "select", options: yesNo, width: 120, section: "General" },

      // Movement / UOM
      { name: "start_point", label: "Start Point", width: 150, maxLength: 10, section: "Movement" },
      { name: "end_point", label: "End Point", width: 150, maxLength: 10, section: "Movement" },
      { name: "vtype", label: "Vehicle Type", width: 140, maxLength: 10, section: "Movement" },
      { name: "quantity", label: "Quantity", type: "number", width: 130, section: "Movement" },
      { name: "uom", label: "UOM", width: 130, maxLength: 20, section: "Movement" },

      // Cost / Billing
      { name: "cost", label: "Cost", type: "number", width: 130, section: "Billing" },
      { name: "bill", label: "Bill", type: "number", width: 130, section: "Billing" },
      { name: "budget_cost", label: "Budget Cost", type: "number", width: 140, section: "Billing" },
      { name: "exp_code", label: "Expense Code", width: 150, maxLength: 15, section: "Billing" },
      { name: "exp_sub_type", label: "Expense Sub Type", width: 160, maxLength: 10, section: "Billing" },

      // Tax components
      { name: "tx_compnt_1_perc", label: "Tax Comp 1 %", type: "number", width: 130, section: "Tax Components" },
      { name: "tx_compnt_1_expmt", label: "Tax Comp 1 Exempt", type: "select", options: yesNo, width: 150, section: "Tax Components" },
      { name: "tx_compnt_2_perc", label: "Tax Comp 2 %", type: "number", width: 130, section: "Tax Components" },
      { name: "tx_compnt_2_expmt", label: "Tax Comp 2 Exempt", type: "select", options: yesNo, width: 150, section: "Tax Components" },
      { name: "tx_compnt_3_perc", label: "Tax Comp 3 %", type: "number", width: 130, section: "Tax Components" },
      { name: "tx_compnt_3_expmt", label: "Tax Comp 3 Exempt", type: "select", options: yesNo, width: 150, section: "Tax Components" },
      { name: "tx_compnt_4_perc", label: "Tax Comp 4 %", type: "number", width: 130, section: "Tax Components" },
      { name: "tx_compnt_4_expmt", label: "Tax Comp 4 Exempt", type: "select", options: yesNo, width: 150, section: "Tax Components" },
    ],
    defaults: {
      freeze_flag: "N",
      mandatory_flag: "N",
      act_type: "V",
      tx_compnt_1_perc: 0,
      tx_compnt_2_perc: 0,
      tx_compnt_3_perc: 0,
      tx_compnt_4_perc: 0,
      tx_compnt_1_expmt: "N",
      tx_compnt_2_expmt: "N",
      tx_compnt_3_expmt: "N",
      tx_compnt_4_expmt: "N",
    },

    customLoad: async (user) => {
      const typedUser = user as { loginid: string; company_code: string };
      const data = await executeWmsInboundSql(`
        SELECT
          ACTIVITY_CODE          AS "activity_code",
          ACTIVITY                AS "activity",
          WIP_CODE                AS "wip_code",
          INCOME_CODE              AS "income_code",
          COST                     AS "cost",
          BILL                     AS "bill",
          COMPANY_CODE             AS "company_code",
          ACTIVITY_GROUP_CODE      AS "activity_group_code",
          ACTIVITY_SUBGROUP_CODE   AS "activity_subgroup_code",
          START_POINT              AS "start_point",
          END_POINT                AS "end_point",
          VTYPE                    AS "vtype",
          FREEZE_FLAG              AS "freeze_flag",
          QUANTITY                 AS "quantity",
          UOM                      AS "uom",
          MANDATORY_FLAG           AS "mandatory_flag",
          ACT_TYPE                 AS "act_type",
          SITE_IND                 AS "site_ind",
          TX_COMPNT_1_PERC         AS "tx_compnt_1_perc",
          TX_COMPNT_2_PERC         AS "tx_compnt_2_perc",
          TX_COMPNT_3_PERC         AS "tx_compnt_3_perc",
          TX_COMPNT_4_PERC         AS "tx_compnt_4_perc",
          TX_COMPNT_1_EXPMT        AS "tx_compnt_1_expmt",
          TX_COMPNT_2_EXPMT        AS "tx_compnt_2_expmt",
          TX_COMPNT_3_EXPMT        AS "tx_compnt_3_expmt",
          TX_COMPNT_4_EXPMT        AS "tx_compnt_4_expmt",
          EXP_CODE                 AS "exp_code",
          EXP_SUB_TYPE              AS "exp_sub_type",
          BUDGET_COST               AS "budget_cost"
        FROM MS_ACTIVITY
        WHERE COMPANY_CODE = '${typedUser.company_code}'
        ORDER BY ACTIVITY_CODE
      `);
      return {
        tableData: data as Record<string, unknown>[],
        count: data.length,
      };
    },

    customSave: async (form, context) => {
      const { editMode, original, user } = context;
      const typedUser = user as { loginid: string; company_code: string };
      const companyCode = typedUser.company_code;

      // Key used to look up an existing row: on edit, prefer the original code
      // (in case the code field itself is somehow being changed), otherwise use the form value.
      const activityCode = (editMode ? (original?.activity_code ?? form.activity_code) : form.activity_code) as string;

      if (!activityCode) {
        throw new Error("Activity Code is required.");
      }

      // --- helpers for safe literal building (this endpoint takes raw SQL, so we build defensively) ---
      const strLit = (v: unknown) =>
        v === undefined || v === null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
      const numLit = (v: unknown) =>
        v === undefined || v === null || v === "" ? "NULL" : Number(v);

      // Check whether the record already exists for this company + activity code
      const existing = await executeWmsInboundSql(`
        SELECT ACTIVITY_CODE AS "activity_code"
        FROM MS_ACTIVITY
        WHERE COMPANY_CODE = ${strLit(companyCode)}
        AND ACTIVITY_CODE = ${strLit(activityCode)}
      `);

      const recordExists = Array.isArray(existing) && existing.length > 0;

      if (recordExists) {
        // UPDATE existing record
        await executeWmsInboundSql(`
          UPDATE MS_ACTIVITY SET
            ACTIVITY               = ${strLit(form.activity)},
            WIP_CODE                = ${strLit(form.wip_code)},
            INCOME_CODE              = ${strLit(form.income_code)},
            COST                     = ${numLit(form.cost)},
            BILL                     = ${numLit(form.bill)},
            ACTIVITY_GROUP_CODE      = ${strLit(form.activity_group_code)},
            ACTIVITY_SUBGROUP_CODE   = ${strLit(form.activity_subgroup_code)},
            START_POINT              = ${strLit(form.start_point)},
            END_POINT                = ${strLit(form.end_point)},
            VTYPE                    = ${strLit(form.vtype)},
            FREEZE_FLAG              = ${strLit(form.freeze_flag ?? "N")},
            QUANTITY                 = ${numLit(form.quantity)},
            UOM                      = ${strLit(form.uom)},
            MANDATORY_FLAG           = ${strLit(form.mandatory_flag ?? "N")},
            ACT_TYPE                 = ${strLit(form.act_type ?? "V")},
            SITE_IND                 = ${strLit(form.site_ind)},
            TX_COMPNT_1_PERC         = ${numLit(form.tx_compnt_1_perc ?? 0)},
            TX_COMPNT_2_PERC         = ${numLit(form.tx_compnt_2_perc ?? 0)},
            TX_COMPNT_3_PERC         = ${numLit(form.tx_compnt_3_perc ?? 0)},
            TX_COMPNT_4_PERC         = ${numLit(form.tx_compnt_4_perc ?? 0)},
            TX_COMPNT_1_EXPMT        = ${strLit(form.tx_compnt_1_expmt ?? "N")},
            TX_COMPNT_2_EXPMT        = ${strLit(form.tx_compnt_2_expmt ?? "N")},
            TX_COMPNT_3_EXPMT        = ${strLit(form.tx_compnt_3_expmt ?? "N")},
            TX_COMPNT_4_EXPMT        = ${strLit(form.tx_compnt_4_expmt ?? "N")},
            EXP_CODE                 = ${strLit(form.exp_code)},
            EXP_SUB_TYPE             = ${strLit(form.exp_sub_type)},
            BUDGET_COST              = ${numLit(form.budget_cost)}
          WHERE COMPANY_CODE = ${strLit(companyCode)}
          AND ACTIVITY_CODE = ${strLit(activityCode)}
        `);
      } else {
        // INSERT new record
        await executeWmsInboundSql(`
          INSERT INTO MS_ACTIVITY (
            COMPANY_CODE, ACTIVITY_CODE, ACTIVITY, WIP_CODE, INCOME_CODE, COST, BILL,
            ACTIVITY_GROUP_CODE, ACTIVITY_SUBGROUP_CODE, START_POINT, END_POINT, VTYPE,
            FREEZE_FLAG, QUANTITY, UOM, MANDATORY_FLAG, ACT_TYPE, SITE_IND,
            TX_COMPNT_1_PERC, TX_COMPNT_2_PERC, TX_COMPNT_3_PERC, TX_COMPNT_4_PERC,
            TX_COMPNT_1_EXPMT, TX_COMPNT_2_EXPMT, TX_COMPNT_3_EXPMT, TX_COMPNT_4_EXPMT,
            EXP_CODE, EXP_SUB_TYPE, BUDGET_COST
          ) VALUES (
            ${strLit(companyCode)}, ${strLit(activityCode)}, ${strLit(form.activity)}, ${strLit(form.wip_code)},
            ${strLit(form.income_code)}, ${numLit(form.cost)}, ${numLit(form.bill)},
            ${strLit(form.activity_group_code)}, ${strLit(form.activity_subgroup_code)},
            ${strLit(form.start_point)}, ${strLit(form.end_point)}, ${strLit(form.vtype)},
            ${strLit(form.freeze_flag ?? "N")}, ${numLit(form.quantity)}, ${strLit(form.uom)},
            ${strLit(form.mandatory_flag ?? "N")}, ${strLit(form.act_type ?? "V")}, ${strLit(form.site_ind)},
            ${numLit(form.tx_compnt_1_perc ?? 0)}, ${numLit(form.tx_compnt_2_perc ?? 0)},
            ${numLit(form.tx_compnt_3_perc ?? 0)}, ${numLit(form.tx_compnt_4_perc ?? 0)},
            ${strLit(form.tx_compnt_1_expmt ?? "N")}, ${strLit(form.tx_compnt_2_expmt ?? "N")},
            ${strLit(form.tx_compnt_3_expmt ?? "N")}, ${strLit(form.tx_compnt_4_expmt ?? "N")},
            ${strLit(form.exp_code)}, ${strLit(form.exp_sub_type)}, ${numLit(form.budget_cost)}
          )
        `);
      }
    },

    // NOTE: MS_ACTIVITY has a BEFORE DELETE trigger (TRG_MS_ACTIVITY_BD) that always
    // raises ORA-20001 and blocks deletion at the DB level. This function will run,
    // but the DELETE statement itself will be rejected by the trigger unless that
    // trigger is dropped or altered.
    customDelete: async (row, user) => {
      const typedUser = user as { loginid: string; company_code: string };
      await executeWmsInboundSql(`
        DELETE FROM MS_ACTIVITY
        WHERE COMPANY_CODE = '${typedUser.company_code}'
        AND ACTIVITY_CODE = '${row.activity_code}'
      `);
    },
  },
  producttype: {
    title: "Product Type Master",
    subtitle: "Maintain product type codes used by product and inbound setup.",
    master: "producttype",
    gmEndpoint: "producttype",
    routeKeys: ["producttype", "product_type", "product-type"],
    keyField: "prodtype_code",
    fields: [
      { name: "prodtype_code", label: "Product Type Code", required: true, type: "text", disabledOnEdit: true, width: 170 },
      { name: "prodtype_desc", label: "Product Type Description", required: true, width: 280 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.prodtype_code] },
  },
  country: {
    title: "Country Master",
    subtitle: "Maintain country code, country name, GCC flag, short description, and nationality.",
    master: "country",
    gmEndpoint: "country",
    routeKeys: ["country"],
    keyField: "country_code",
    // formTabs: [
    //   { key: "basic", label: "Basic Info" },
    //   { key: "extra", label: "Extra Details" },
    // ],
    fields: [
      { name: "country_code", label: "Country Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "country_name", label: "Country Name", required: true, width: 260 },
      { name: "country_gcc",     label: "GCC",           type: "select", options: yesNo, width: 100 },
      { name: "short_desc",   label: "Short Description", width: 200 },
      { name: "nationality",  label: "Nationality",   width: 180 },
    ],
    defaults: { country_gcc: "N" },
    deleteConfig: { mode: "registered", payload: (row) => [row.country_code] },
  },
  activitygroup: {
    fieldsPerRow: 4,
    title: "Activity Group Master",
    subtitle: "Maintain WMS activity groups, validation behavior, accounting links, and reporting group.",
    master: "activitygroup",
    gmEndpoint: "activitygroup",
    routeKeys: ["activitygroup", "activity_group", "activity-group"],
    keyField: "activity_group_code",
    fields: [
      { name: "activity_group_code", label: "Activity Group Code", required: true, disabledOnEdit: true, width: 180, maxLength: 5 },
      { name: "act_group_name", label: "Activity Group Name", required: true, width: 260 },
      { name: "mandatory_flag", label: "Mandatory", type: "select", options: yesNo, width: 120 },
      { name: "validate_flag", label: "Validate", type: "select", options: yesNo, width: 120 },
      { name: "act_group_type", label: "Group Type", width: 140, maxLength: 2 },
      { name: "account_code", label: "Account Code", dropdownParam: "Account_AC_CODE_Serach", dropdownDisplayFields:["ac_code","ac_name"],dropdownValueKey: "ac_code", width: 150, required: true },
      { name: "alternate_accode", label: "Alternate Account", width: 160 },
      { name: "exp_account_code", label: "Expense Account", width: 160 },
      { name: "freight_flag", label: "Freight", type: "select", options: yesNo, width: 110 },
      { name: "sw_flag", label: "SW Flag", type: "select", options: yesNo, width: 110 },
      { name: "rpt_group_name", label: "Report Group", width: 180 },
      { name: "sort_order", label: "Sort Order", type: "number", width: 120 },
      { name: "cost_group", label: "Cost Group", width: 140, maxLength: 1 },
    ],
    defaults: { mandatory_flag: "N", validate_flag: "N", freight_flag: "N", sw_flag: "N" },
    deleteConfig: { mode: "registered", payload: (row) => [row.activity_group_code] },
  },
  activitysubgroup: {
    title: "Activity Sub Group Master",
    subtitle: "Maintain activity sub groups linked with WMS activity groups.",
    master: "activitysubgroup",
    gmEndpoint: "activitysubgroup",
    routeKeys: ["activitysubgroup", "activity_subgroup", "activity-subgroup"],
    keyField: "activity_subgroup_code",
    fields: [
      { name: "activity_subgroup_code", label: "Sub Group Code", required: true, disabledOnEdit: true, width: 170 },
      { name: "act_subgroup_name", label: "Sub Group Name", required: true, width: 260 },
      { name: "act_group_code", label: "Activity Group Code", required: true, width: 180, maxLength: 5, dropdownParam: 'DROP_DOWN_ACTIVITY_GROUP', dropdownDisplayFields: ['activity_group_code','act_group_name'], dropdownLabelKey: 'act_group_name', dropdownValueKey: 'activity_group_code' },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.activity_subgroup_code] },
  },
  activitykpi: {
    title: "Activity KPI Master",
    subtitle: "Maintain expected hours by principal, activity, customer, and job type.",
    master: "activitykpi",
    gmEndpoint: "activity-kpi",
    routeKeys: ["activity-kpi", "activitykpi", "activity_kpi"],
    keyField: "act_code",
    fields: [
      { name: "prin_code", label: "Principal Code", required: true, width: 160 },
      { name: "job_type", label: "Job Type", required: true, width: 130 },
      { name: "act_code", label: "Activity Code", required: true, width: 150 },
      { name: "cust_code", label: "Customer Code", required: true, width: 150 },
      { name: "exp_hours", label: "Expected Hours", type: "number", width: 150 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.prin_code] },
  },
  department: {
    title: "Department Master",
    subtitle: "Maintain department code, name, and division link.",
    master: "department",
    gmEndpoint: "department",
    routeKeys: ["department"],
    keyField: "dept_code",
    fields: [
      { name: "dept_code", label: "Department Code", required: true, disabledOnEdit: true, width: 170 },
      { name: "dept_name", label: "Department Name", required: true, width: 260 },
      { name: "div_code", label: "Division Code", dropdownParam: "DROP_DOWN_DIVISION",dropdownDisplayFields:["div_code", "div_name"],
      dropdownValueKey: "div_code",  width: 150, required: true },
    ],
    deleteConfig: { mode: "rawDelete", payload: (row) => ({ ids: [row.dept_code] }) },
  },
  division: {
    title: "Division Master",
    subtitle: "Maintain division identity, address, contacts, and status.",
    master: "division",
    gmEndpoint: "division",
    routeKeys: ["division"],
    keyField: "div_code",
    fieldsPerRow:4,
    fields: [
      { name: "div_code", label: "Division Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "div_name", label: "Division Name", required: true, width: 260 },
      { name: "div_short_name", label: "Short Name", width: 150 },
      { name: "country_code", label: "Country Code", dropdownParam: "DROP_DOWN_COUNTRY", dropdownDisplayFields: ["country_code", "country_name"], dropdownValueKey: "country_code", width: 140 },
      { name: "phone", label: "Phone", width: 150 },
      { name: "fax", label: "Fax", width: 140 },
      { name: "email", label: "Email", type: "email", width: 220 },
      { name: "status", label: "Status", type: "select", options: activeInactive, width: 120 },
      { name: "div_address1", label: "Address 1", required: true, table: false },
      { name: "div_address2", label: "Address 2", table: false },
      { name: "div_address3", label: "Address 3", table: false },
      { name: "remarks", label: "Remarks", table: false },
    ],
    defaults: { status: "A" },
    deleteConfig: { mode: "rawDelete", payload: (row) => [{ company_code: row.company_code, div_code: row.div_code }] },
  },
  manufacture: {
    title: "Manufacturer Master",
    subtitle: "Maintain manufacturer codes by principal.",
    master: "manufacturer",
    gmEndpoint: "manufacture",
    routeKeys: ["manufacture", "manufacturer"],
    keyField: "manu_code",
    fields: [
      { name: "prin_code", label: "Principal Code", required: true, dropdownParam: "DROP_DOWN_PRINCIPAL", dropdownDisplayFields: ["prin_code", "prin_name"], dropdownValueKey: "prin_code", width: 150 },
      { name: "manu_code", label: "Manufacturer Code", required: true, disabledOnEdit: true, width: 180 },
      { name: "manu_name", label: "Manufacturer Name", required: true, width: 280 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [{ manu_code: row.manu_code, prin_code: row.prin_code }] },
  },
  moc2: {
    title: "MOC2 Master",
    subtitle: "Maintain charge codes, charge type, and activity group mapping.",
    master: "moc2",
    gmEndpoint: "moc2",
    routeKeys: ["moc2"],
    keyField: "charge_code",
    fields: [
      { name: "charge_code", label: "Charge Code", required: true, width: 150, maxLength: 4 },
      { name: "description", label: "Description", required: true, width: 260 },
      { name: "charge_type", label: "Charge Type", required: true, width: 140, disabledOnEdit: true },
      { name: "activity_group_code", label: "Activity Group", dropdownParam: 'DROP_DOWN_ACTIVITY_GROUP', 
        dropdownDisplayFields: ['activity_group_code','act_group_name'], dropdownLabelKey: 'act_group_name', dropdownValueKey: 'activity_group_code', required: true, width: 170 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [{ charge_code: row.charge_code, charge_type: row.charge_type, company_code: row.company_code }] },
  },
  moc: {
    title: "MOC Master",
    subtitle: "Maintain mode of collection codes and activity group mapping.",
    master: "moc",
    gmEndpoint: "moc",
    routeKeys: ["moc"],
    keyField: "moc_code",
    fields: [
      { name: "moc_code", label: "MOC Code", required: true, disabledOnEdit: true, width: 140 },
      { name: "moc_name", label: "MOC Name", required: true, width: 260 },
      { name: "activity_group_code", label: "Activity Group", width: 170 },
      { name: "description", label: "Description", width: 260 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => ({ moc_code: row.moc_code, company_code: row.company_code }) },
  },
  harmonize: {
    title: "Harmonize Code Master",
    subtitle: "Maintain harmonized commodity and customs reference codes.",
    master: "harmonize",
    gmEndpoint: "harmonize",
    routeKeys: ["harmonize"],
    keyField: "harm_code",
    fields: [
      { name: "harm_code", label: "Harmonize Code", required: true, disabledOnEdit: true, width: 170 },
      { name: "harm_desc", label: "Description", required: true, width: 320 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.harm_code] },
  },
  port: {
    title: "Port Master",
    subtitle: "Maintain port codes by country and transport mode.",
    master: "port",
    gmEndpoint: "port",
    routeKeys: ["port"],
    keyField: "port_code",
    fields: [
      { name: "port_code", label: "Port Code", required: true, disabledOnEdit: true, width: 140 },
      { name: "port_name", label: "Port Name", required: true, width: 260 },
      { name: "country_code", label: "Country Code", width: 150, dropdownParam: "DROP_DOWN_COUNTRY", dropdownDisplayFields: ["country_code", "country_name"], dropdownValueKey: "country_code", dropdownDisplaySeparator: " - " },
      { name: "trp_mode", label: "Transport Mode", type: "select", options: transportMode, width: 150 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.port_code] },
  },
  partner: {
    title: "Partner Master",
    subtitle: "Maintain broker and partner contact information.",
    master: "partner",
    gmEndpoint: "partner",
    routeKeys: ["partner", "broker"],
    keyField: "broker_code",
    fields: [
      { name: "broker_code", label: "Partner Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "broker_name", label: "Partner Name", required: true, width: 260 },
      { name: "curr_code", label: "Country", dropdownParam: "DROP_DOWN_COUNTRY", dropdownDisplayFields: ["country_code", "country_name"], dropdownValueKey: "country_code", width: 150, dropdownDisplaySeparator: " - " },
      { name: "broker_city", label: "City", width: 150 },
      { name: "broker_contact1", label: "Contact", width: 180 },
      { name: "broker_telno1", label: "Telephone", width: 150 },
      { name: "broker_email1", label: "Email", type: "email", width: 220 },
      { name: "broker_addr1", label: "Address 1", table: false },
      { name: "broker_addr2", label: "Address 2", table: false },
      { name: "broker_addr3", label: "Address 3", table: false },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.broker_code] },
  },
  locationtype: {
    title: "Location Type Master",
    subtitle: "Maintain warehouse location dimensions and push level setup.",
    master: "locationtype",
    gmEndpoint: "locationtype",
    routeKeys: ["locationtype", "location_type", "location-type"],
    keyField: "loc_type",
    fields: [
      { name: "loc_type", label: "Location Type", required: true, disabledOnEdit: true, width: 150 },
      { name: "loc_name", label: "Location Name", required: true, width: 240 },
      { name: "loc_cbm", label: "CBM", type: "number", width: 120 },
      { name: "loc_wt", label: "Weight", type: "number", width: 120 },
      { name: "push_level", label: "Push Level", type: "number", width: 130 },
    ],
    deleteConfig: { mode: "disabled", payload: () => null, reason: "Delete endpoint is not registered in the existing backend" },
  },
  salesman: {
    title: "Salesman Master",
    subtitle: "Maintain salesman codes and names.",
    master: "salesman",
    gmEndpoint: "salesman",
    routeKeys: ["salesman"],
    keyField: "salesman_code",
    fields: [
      { name: "salesman_code", label: "Salesman Code", required: true, disabledOnEdit: true, width: 160 },
      { name: "salesman_name", label: "Salesman Name", required: true, width: 280 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.salesman_code] },
  },
  alert: {
    title: "Alert Master",
    subtitle: "Maintain operational alert sequence, module, mode, and instruction text.",
    master: "alert",
    gmEndpoint: "alert",
    routeKeys: ["alert"],
    keyField: "op_code",
    fields: [
      { name: "op_type", label: "Operation Type", required: true, width: 150, maxLength: 3 },
      { name: "op_code", label: "Operation Code", required: true, width: 160, type:"number" },
      { name: "op_desc", label: "Description", required: true, width: 260 },
      { name: "op_sequence", label: "Sequence", type: "number", width: 120 },
      { name: "op_module", label: "Module", width: 130 },
      { name: "op_mode", label: "Mode", width: 120, maxLength: 1 },
      { name: "instruction", label: "Instruction", table: false, width: 300, type: "select", options: yesNo},
    ],
    // saveEndpoint: (form, { editMode, original }) =>
      // editMode ? `alert/${original?.op_type || form.op_type}/${original?.op_code || form.op_code}` : "alert",
saveEndpoint: (form, { editMode, original }) => {
  if (editMode && original) {
    const originalOpCode = original["op_code"] ?? original["opCode"];
    const originalOpType = original["op_type"] ?? original["opType"];
    return `alert/${originalOpCode}/${originalOpType}`; // ← no leading slash
  }
  return "alert";
},
    deleteConfig: { mode: "registered", payload: (row) => [{ op_type: row.op_type, op_code: row.op_code, company_code: row.company_code }] },
  },
  principal: {
    title: "Principal Master",
    subtitle: "Maintain principal identity, division, country, currency, and primary contact details.",
    master: "principal",
    gmEndpoint: "principal",
    routeKeys: ["principal"],
    keyField: "prin_code",
    fieldsPerRow: 5,
    formTabs: [
      { key: "basic-info", label: "Basic Info" },
      { key: "contact-info", label: "Contact Info" },
      { key: "organization", label: "Organization" },
      { key: "account-info", label: "Account Info" },
      { key: "settings", label: "Settings" },
      { key: "storage-info", label: "Storage Info" },
    ],
    fields: [
      // Basic Info Tab - Company Details
      { name: "prin_code", label: "Principal Code", disabledOnEdit: true, width: 160, tab: "basic-info", section: "COMPANY DETAILS", hideOnAdd:true },
      { name: "prin_name", label: "Principal Name", required: true, width: 280, tab: "basic-info", section: "COMPANY DETAILS", colSpan: 2 },
      { name: "prin_status", label: "Status", required: true, type: "select", options: [{ label: "Active", value: "A" }, { label: "Inactive", value: "I" }], tab: "basic-info", section: "COMPANY DETAILS" },
      { name: "prin_city", label: "City", width: 280, tab: "basic-info", section: "COMPANY DETAILS" },
      { name: "country_code", label: "Country", required: true, dropdownParam: "DROP_DOWN_COUNTRY",dropdownDisplayFields: ["country_code", "country_name"], dropdownValueKey: "country_code",
      dropdownDisplaySeparator: " - ", tab: "basic-info", section: "COMPANY DETAILS" },
      { name: "prin_addr1", label: "Address 1", type: "textarea", tab: "basic-info", section: "COMPANY DETAILS", colSpan: 2, maxLength: 50 },
      { name: "prin_addr2", label: "Address 2", type: "textarea", tab: "basic-info", section: "COMPANY DETAILS", colSpan: 2, maxLength: 50 },
      { name: "prin_addr3", label: "Address 3", type: "textarea", tab: "basic-info", section: "COMPANY DETAILS", maxLength: 50 },
      { name: "prin_addr4", label: "Address 4", type: "textarea", tab: "basic-info", section: "COMPANY DETAILS", maxLength: 50 },
      { name: "territory_code", label: "Territory", dropdownParam: "DROP_DOWN_TERRITORY", dropdownCodeMap: { country_code: "code1" },dropdownDisplayFields: ["territory_code", "territory_name"], dropdownValueKey: "territory_code", tab: "basic-info", section: "COMPANY DETAILS" },
      { name: "sector_code", label: "Sector", tab: "basic-info", section: "COMPANY DETAILS" },
      // Basic Info Tab - Contact Information
      { name: "acc_email", label: "Email Account", type: "email", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_email1", label: "Email 1", type: "email", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_email2", label: "Email 2", type: "email", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_email3", label: "Email 3", type: "email", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_faxno1", label: "Company Fax 1", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_faxno2", label: "Company Fax 2", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_faxno3", label: "Company Fax 3", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_contact1", label: "Contact Person 1", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_contact2", label: "Contact Person 2", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_contact3", label: "Contact Person 3", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_telno1", label: "Telephone 1", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_telno2", label: "Telephone 2", tab: "contact-info", section: "CONTACT INFORMATION" },
      { name: "prin_telno3", label: "Telephone 3", tab: "contact-info", section: "CONTACT INFORMATION" },
      // Basic Info Tab - Organization
      { name: "div_code", label: "Division", required: true, dropdownParam: "DROP_DOWN_DIVISION", dropdownDisplayFields: ["div_code", "div_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "div_code", dropdownCodeMap: { company_code: "code1" }, tab: "organization", section: "ORGANIZATION" },
      { name: "prin_dept_code", label: "Department", required: true, dropdownParam: "DROP_DOWN_DEPT_BASED_ON_DIV", dropdownDisplayFields: ["dept_code", "dept_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "dept_code", dropdownCodeMap: { div_code: "code1" }, tab: "organization", section: "ORGANIZATION" },
      { name: "prin_acref", label: "Reference", tab: "organization", section: "ORGANIZATION" },
      { name: "auto_generate_product_code", label: "Auto Generate Product Code", type: "checkbox", tab: "organization", section: "ORGANIZATION" },
      // Account Info Tab - Company Registration Information
      { name: "trn_no", label: "Tax Registered No.", type: "text", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      { name: "trn_exp_date", label: "Tax Reg. Expiry Date", type: "date", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      { name: "comm_reg_no", label: "Commercial Reg. No.", type: "text", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      { name: "comm_reg_exp_date", label: "Commercial Reg. Expiry", type: "date", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      { name: "prin_lic_no", label: "License No.", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      { name: "prin_lic_type", label: "License Type", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      { name: "curr_code", label: "Default Currency", dropdownParam: "DROP_DOWN_CURRENCY", dropdownDisplayFields: ["curr_code", "curr_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "curr_code", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      { name: "prin_infze", label: "In Designated Zone", type: "checkbox", tab: "account-info", section: "COMPANY REGISTRATION INFORMATION" },
      // Account Info Tab - Account and Credit Information
      { name: "prin_acref", label: "A/C Reference", tab: "account-info", section: "ACCOUNT AND CREDIT INFORMATION" },
      { name: "credit_limit", label: "Credit Limit", type: "number", tab: "account-info", section: "ACCOUNT AND CREDIT INFORMATION" },
      { name: "creditdays", label: "Credit Period (WMS)", type: "number", tab: "account-info", section: "ACCOUNT AND CREDIT INFORMATION" },
      { name: "creditdays_freight", label: "Credit Freight", type: "number", tab: "account-info", section: "ACCOUNT AND CREDIT INFORMATION" },
      // Account Info Tab - Invoice and Transaction History
      { name: "prin_imp_code", label: "Import Code", tab: "account-info", section: "INVOICE AND TRANSACTION HISTORY" },
      { name: "parent_prin_code", label: "Parent Principal Code", tab: "account-info", section: "INVOICE AND TRANSACTION HISTORY" },
      { name: "prin_invdate", label: "Last Invoice Date", type: "date", tab: "account-info", section: "INVOICE AND TRANSACTION HISTORY" },
      // Settings Tab - Pick Rules
      { name: "pick_wave", label: "Pick Wave", dropdownParam:"DROP_DOWN_PICK_WAVE", dropdownDisplayFields: [ "wave_code","wave_name"],dropdownDisplaySeparator: " - ", dropdownValueKey: "wave_code", tab: "settings", section: "PICK RULES" },
      { name: "pick_wave_ign_min_exp", label: "Pick Wave (Minimum Exp)", type: "checkbox", tab: "settings", section: "PICK RULES" },
      { name: "pick_wave_qty_sort", label: "Pick Wave (Least Quantity)", type: "checkbox", tab: "settings", section: "PICK RULES" },
      // Settings Tab - General Settings
      { name: "under_value", label: "Allow Undervalue", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      { name: "auto_insert_billactivity", label: "Auto Populate Bill", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      { name: "prin_charge", label: "Chargeable", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      { name: "prin_pricechk", label: "Export Price Check", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      { name: "prin_landedpr", label: "Compute Landed Cost", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      { name: "auto_job", label: "Auto Job No Generate", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      { name: "validate_lotno", label: "Validate Lot No.", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      { name: "automate_activity", label: "Automate Activity", type: "checkbox", tab: "settings", section: "GENERAL SETTINGS" },
      // Settings Tab - Product and Shipment Settings
      { name: "storage_productwise", label: "Product Wise Storage", type: "checkbox", tab: "settings", section: "PRODUCT AND SHIPMENT SETTINGS" },
      { name: "dir_shpmnt", label: "Direct Shipment", type: "checkbox", tab: "settings", section: "PRODUCT AND SHIPMENT SETTINGS" },
      { name: "perpectual_confirm_allow", label: "Perpetual Confirm Allow", type: "checkbox", tab: "settings", section: "PRODUCT AND SHIPMENT SETTINGS" },
      { name: "validate_expdate", label: "Outbound Validate Exp Date", type: "date", tab: "settings", section: "PRODUCT AND SHIPMENT SETTINGS" },
      { name: "minperiod_exppick", label: "Outbound Min Exp Period", type: "number", tab: "settings", section: "PRODUCT AND SHIPMENT SETTINGS" },
      { name: "rcpt_exp_limit", label: "Inbound Exp Limit (days)", type: "number", tab: "settings", section: "PRODUCT AND SHIPMENT SETTINGS" },
      // Storage Info Tab - Location
      { name: "pref_site", label: "Preferred Site", dropdownParam: "DROP_DOWN_SITE", dropdownDisplayFields: ["site_code", "site_name"], dropdownValueKey: "site_code", tab: "storage-info", section: "LOCATION" },
      { name: "pref_loc_from", label: "Location From", dropdownParam: "DROP_DOWN_LOCATION", dropdownCodeMap: { pref_site: "code1" }, dropdownDisplayFields: ["location_code", "location_name"], dropdownValueKey: "location_code", tab: "storage-info", section: "LOCATION" },
      { name: "pref_loc_to", label: "Location To", dropdownParam: "DROP_DOWN_LOCATION", dropdownCodeMap: { pref_site: "code1", pref_loc_from: "code2" }, dropdownDisplayFields: ["location_code", "location_name"], dropdownValueKey: "location_code", tab: "storage-info", section: "LOCATION" },
      { name: "pref_aisle_from", label: "Aisle From", type: "text", tab: "storage-info", section: "LOCATION" },
      { name: "pref_aisle_to", label: "Aisle To", type: "text", tab: "storage-info", section: "LOCATION" },
      { name: "pref_col_from", label: "Column From", type: "number", tab: "storage-info", section: "LOCATION" },
      { name: "pref_col_to", label: "Column To", type: "number", tab: "storage-info", section: "LOCATION" },
      // Storage Info Tab - Site, Service and Storage Details
      { name: "pref_ht_from", label: "Height From", type: "number", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "pref_ht_to", label: "Height To", type: "number", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "prin_siteind", label: "Default Site Ind", dropdownParam: "DROP_DOWN_SITE_IND", dropdownDisplayFields: ["site_ind", "ind_desc"],
        dropdownDisplaySeparator: " - ", dropdownValueKey: "site_ind", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "service_date", label: "Service Date", type: "date", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "storage_type", label: "Storage Type", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "default_foc", label: "Default FOC", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      // Storage Info Tab - Additional Fields
      { name: "pri_grnno", label: "GRN Number", type: "number", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "prin_license", label: "License", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "backorder_pick", label: "Backorder Pick", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "box_no", label: "Box Number", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "storage_slab_bill", label: "Storage Slab Bill", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "free_storage", label: "Free Storage", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "displ_siteind_faltarea", label: "Display Site Indicator", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
      { name: "inb_jobwise_bill", label: "Inbound Job Wise Bill", type: "text", tab: "storage-info", section: "SITE, SERVICE AND STORAGE DETAILS" },
    ],
    saveEndpoint: (form, { editMode, original }) => (editMode ? `principal/${original?.prin_code || form.prin_code}` : "principal"),
    customSave: async (form, context) => {
      const { user } = context;
      const typedUser = user as { loginid: string };
      await msPrincipalServiceInstance.upsertMsPrincipalApi({
        data: form as any,
        loginid: typedUser.loginid,
      });
    },
    customLoad: async (user) => {
      const typedUser = user as { loginid: string; company_code: string };
      const data = await executeWmsInboundSql(`
        SELECT *
        FROM MS_PRINCIPAL
        WHERE COMPANY_CODE = '${typedUser.company_code}'
        ORDER BY NVL(updated_at, created_at)
      `);
      return {
        tableData: data as Record<string, unknown>[],
        count: data.length,
      };
    },
    deleteConfig: { mode: "disabled", payload: () => null, reason: "Delete endpoint is not registered in the existing backend" },
  },

  customer: {
    title: "Customer Master",
    subtitle: "Maintain customer details by principal with currency, country, and contacts.",
    master: "customer",
    gmEndpoint: "customer",
    routeKeys: ["customer"],
    keyField: "cust_code",
    fields: [
      { name: "prin_code", label: "Principal Code", required: true, width: 150 },
      { name: "cust_code", label: "Customer Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "cust_name", label: "Customer Name", required: true, width: 280 },
      { name: "curr_code", label: "Currency", width: 130 },
      { name: "country_code", label: "Country Code", width: 140 },
      { name: "cust_city", label: "City", width: 150 },
      { name: "cust_contact1", label: "Contact", width: 180 },
      { name: "cust_telno1", label: "Telephone", width: 150 },
      { name: "cust_email1", label: "Email", type: "email", width: 220 },
      { name: "cust_addr1", label: "Address 1", table: false },
      { name: "cust_addr2", label: "Address 2", table: false },
      { name: "cust_addr3", label: "Address 3", table: false },
    ],
    deleteConfig: { mode: "disabled", payload: () => null, reason: "Delete endpoint is not registered in the existing backend" },
  },
  
  supplier: {
    title: "Supplier Master",
    subtitle: "Maintain supplier details with currency, country, and contacts.",
    master: "supplier",
    gmEndpoint: "supplier",
    routeKeys: ["supplier"],
    keyField: "supp_code",
    fields: [
      { name: "supp_code", label: "Supplier Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "supp_name", label: "Supplier Name", required: true, width: 280 },
      { name: "curr_code", label: "Currency", width: 130 },
      { name: "country_code", label: "Country Code", width: 140 },
      { name: "supp_city", label: "City", width: 150 },
      { name: "supp_contact1", label: "Contact", width: 180 },
      { name: "supp_telno1", label: "Telephone", width: 150 },
      { name: "supp_email1", label: "Email", type: "email", width: 220 },
      { name: "supp_addr1", label: "Address 1", table: false },
      { name: "supp_addr2", label: "Address 2", table: false },
      { name: "supp_addr3", label: "Address 3", table: false },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.supp_code] },
  },

//   product: {
//     title: "Product Master",
//     subtitle: "Maintain product identity, principal, group, brand, UOM, and packing setup.",
//     master: "product",
//     gmEndpoint: "product",
//     routeKeys: ["product"],
//     keyField: "prod_code",
//     fieldsPerRow: 5,
//     formTabs: [
//       { key: "product-details", label: "Product Details" },
//       { key: "uom-volume", label: "UOM & Volume" },
//       { key: "manufacture-validation", label: "Manufacture & Validation" },
//       { key: "category-product", label: "Category & Product" },
//     ],
//     fields: [
//       // Product Details Tab - Principal Info
//       { name: "prin_code", label: "Principal Code", required: true, dropdownParam: "DROP_DOWN_PRINCIPAL", dropdownDisplayFields:["prin_code","prin_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "prin_code", width: 150, tab: "product-details", section: "PRINCIPAL INFO" },
//       { name: "group_code", label: "Group Code", required: true, dropdownParam: "DROP_DOWN_GROUP", dropdownCodeMap: { prin_code: "code1" }, dropdownDisplayFields: ["group_code", "group_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "group_code", width: 140, tab: "product-details", section: "PRINCIPAL INFO" },
//       { name: "brand_code", label: "Brand Code", required: true, dropdownParam: "DROP_DOWN_BRAND", dropdownCodeMap: { prin_code: "code1", group_code: "code2" }, dropdownDisplayFields: ["brand_code", "brand_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "brand_code", width: 140, tab: "product-details", section: "PRINCIPAL INFO" },

//       // Product Details Tab - Product Info
//       { name: "prod_code", label: "Product Code", disabledOnEdit: true, width: 160, tab: "product-details", section: "PRODUCT INFO" },
//       { name: "prod_name", label: "Product Name", required: true, width: 320, tab: "product-details", section: "PRODUCT INFO", colSpan: 2 },
//       { name: "model_number", label: "Model #", tab: "product-details", section: "PRODUCT INFO" },
//       { name: "variant_code", label: "Variant", tab: "product-details", section: "PRODUCT INFO" },

//       // UOM & Volume Tab - Unit of Measurement
//       { name: "uom_count", label: "No. of UOMs", type: "number", tab: "uom-volume", section: "UNIT OF MEASUREMENT", required : true },
//       { name: "p_uom", label: "Primary UOM", required: true, dropdownParam: "DROP_DOWN_UOM", dropdownDisplayFields: ["uom_code", "uom_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "uom_code", width: 140, tab: "uom-volume", section: "UNIT OF MEASUREMENT" },
//       { name: "l_uom", label: "Lowest UOM", required: true, dropdownParam: "DROP_DOWN_UOM", dropdownDisplayFields: ["uom_code", "uom_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "uom_code", width: 130, tab: "uom-volume", section: "UNIT OF MEASUREMENT" },
//       { name: "uppp", label: "Units/Prim Pack", required: true, type: "number", tab: "uom-volume", section: "UNIT OF MEASUREMENT" },
//       { name: "upp", label: "Def. Units/Pallette", required: true, type: "number", tab: "uom-volume", section: "UNIT OF MEASUREMENT" },
//       { name: "qty_as_wt", label: "Qty As Wt", type: "checkbox", tab: "uom-volume", section: "UNIT OF MEASUREMENT" },

//       // UOM & Volume Tab - Volume
//       { name: "length", label: "Length", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },
//       { name: "breadth", label: "Width", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },
//       { name: "height", label: "Height", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },
//       { name: "volume", label: "Volume", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },
//       { name: "gross_wt", label: "Gross Weight", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },
//       { name: "net_wt", label: "Net Weight", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },
//       { name: "prod_hi", label: "Layers", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },
//       { name: "prod_ti", label: "Carton / Layer", type: "number", tab: "uom-volume", section: "VOLUME (METER / KILOGRAM)" },

//       // Manufacture & Validation Tab - Manufacturer
//       { name: "harm_code", label: "Harmonize Code", dropdownParam: "DROP_DOWN_HARMONIZE", dropdownDisplayFields: ["harm_code", "harm_desc"], dropdownDisplaySeparator: " - ", dropdownValueKey: "harm_code", tab: "manufacture-validation", section: "MANUFACTURER" },
//       { name: "imco_code", label: "IMCO Code", tab: "manufacture-validation", section: "MANUFACTURER" },
//       { name: "manu_code", label: "Manufacturer", dropdownParam: "DROP_DOWN_MANUFACTURER", dropdownCodeMap: { prin_code: "code1" }, dropdownDisplayFields: ["manu_code", "manu_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "manu_code", tab: "manufacture-validation", section: "MANUFACTURER" },
//       { name: "alt_prod_code", label: "Alternate Prod Code", tab: "manufacture-validation", section: "MANUFACTURER" },
//       { name: "site_ind", label: "Default Site Ind", required: true, dropdownParam: "DROP_DOWN_SITE_IND",dropdownDisplayFields: ["site_ind", "ind_desc"], dropdownDisplaySeparator: " - ", dropdownValueKey: "site_ind", tab: "manufacture-validation", section: "MANUFACTURER" },
//       { name: "batch_type", label: "Batch Type", type: "number", tab: "manufacture-validation", section: "MANUFACTURER" },

//       // Manufacture & Validation Tab - Validation
//       { name: "chk_mfgexpdt", label: "Mfg/Exp Dt", type: "checkbox", tab: "manufacture-validation", section: "VALIDATION" },
//       { name: "chk_manucode", label: "Supp. cd", type: "checkbox", tab: "manufacture-validation", section: "VALIDATION" },
//       { name: "chk_lotno", label: "Lot No", type: "checkbox", tab: "manufacture-validation", section: "VALIDATION" },
//       { name: "kitting", label: "Kitting", type: "checkbox", tab: "manufacture-validation", section: "VALIDATION" },
//       { name: "serialize", label: "Serialize", type: "checkbox", tab: "manufacture-validation", section: "VALIDATION" },
//       { name: "rcpt_exp_limit", label: "Receipt Exp Limit", type: "number", tab: "manufacture-validation", section: "VALIDATION" },
//       { name: "minperiod_exppick", label: "Min Period Exp Pick", type: "number", tab: "manufacture-validation", section: "VALIDATION" },

//       // Category & Product Tab - Category
//       { name: "category_abc", label: "Category ABC", type: "select", options: [{ label: "A", value: "A" }, { label: "B", value: "B" }, { label: "C", value: "C" }], tab: "category-product", section: "CATEGORY" },
//       { name: "prod_status", label: "Status", required: true, type: "select", options: [{ label: "Active", value: "A" }, { label: "Inactive", value: "I" }], tab: "category-product", section: "CATEGORY" },
//       { name: "prod_type", label: "Product Type", dropdownParam: "DROP_DOWN_PRODUCT_TYPE", tab: "category-product", section: "CATEGORY" },
//       { name: "product_stage", label: "Product Stage", tab: "category-product", section: "CATEGORY" },
//       { name: "base_price", label: "Base Price", type: "number", tab: "category-product", section: "CATEGORY" },
//       { name: "wave_code", label: "Def. Pick Wave", type: "select", options: [{ label: "Wave 1", value: "1" }, { label: "Wave 2", value: "2" }, { label: "Wave 3", value: "3" }], tab: "category-product", section: "CATEGORY" },
//       { name: "shelf_life", label: "Shelf Life (Days)", type: "number", tab: "category-product", section: "CATEGORY" },

//       // Category & Product Tab - Flags
//       { name: "co_pack", label: "Co-packed", type: "checkbox", tab: "category-product", section: "FLAGS" },
//       { name: "pack_key", label: "Barcode Print", type: "checkbox", tab: "category-product", section: "FLAGS" },
//       { name: "hazmat_class", label: "Hazmat Class", type: "checkbox", tab: "category-product", section: "FLAGS" },
//       { name: "food_ind", label: "Food Ind", type: "checkbox", tab: "category-product", section: "FLAGS" },
//       { name: "pharma_ind", label: "Pharma Ind", type: "checkbox", tab: "category-product", section: "FLAGS" },

//       // Category & Product Tab - Putaway Preference
//       { name: "special_instructions", label: "Special Instructions", type: "textarea", tab: "category-product", section: "PUTAWAY PREFERENCE" },
//     ],

//     saveEndpoint: (form, { editMode, original }) =>
//       editMode ? `product` : "product",
//     deleteConfig: {
//       mode: "rawDelete",
//       payload: (row) => [{ prod_code: row.prod_code, prin_code: row.prin_code }],
//     },
//     customLoad: async (user) => {
//       const typedUser = user as { loginid: string; company_code: string };
//       const data = await executeWmsInboundSql(`
//         SELECT p.*,
//               pr.PRIN_NAME,
//               g.GROUP_NAME,
//               b.BRAND_NAME
//         FROM MS_PRODUCT p
//         LEFT JOIN MS_PRINCIPAL pr
//               ON pr.COMPANY_CODE = p.COMPANY_CODE
//               AND pr.PRIN_CODE    = p.PRIN_CODE
//         LEFT JOIN MS_PRODGROUP g
//               ON g.COMPANY_CODE = p.COMPANY_CODE
//               AND g.PRIN_CODE    = p.PRIN_CODE
//               AND g.GROUP_CODE   = p.GROUP_CODE
//         LEFT JOIN MS_PRODBRAND b
//               ON b.COMPANY_CODE = p.COMPANY_CODE
//               AND b.PRIN_CODE    = p.PRIN_CODE
//               AND b.GROUP_CODE   = p.GROUP_CODE
//               AND b.BRAND_CODE   = p.BRAND_CODE
//         WHERE p.COMPANY_CODE = '${typedUser.company_code}'
//         ORDER BY p.PROD_CODE
//       `);
//       return {
//         tableData: data as Record<string, unknown>[],
//         count: data.length,
//       };
//     },
// customSave: async (form, context) => {
//   const { user } = context;
//   const typedUser = user as { loginid: string };
//   await api.post('api/wms/inbound/upsertMsProduct', {
//     ...form,
//     loginid: typedUser.loginid,
//   });
// },
// ediUploadConfig: {
//   open: true,
//   name: "product",
// }
//   },
 
site: {
    title: "Site Master",
    subtitle: "Maintain site setup with warehouse, division, type, and storage behavior.",
    master: "site",
    gmEndpoint: "siteMaster",
    routeKeys: ["site", "sitemaster", "site_master"],
    keyField: "site_code",
    fields: [
      { name: "site_code", label: "Site Code", required: true, disabledOnEdit: true, width: 140 },
      { name: "site_name", label: "Site Name", required: true, width: 260 },
      { name: "site_ind", label: "Site Indicator", width: 130 },
      { name: "site_type", label: "Site Type", width: 130 },
      { name: "country_code", label: "Country Code", width: 140 },
      { name: "wh_code", label: "Warehouse Code", width: 160 },
      { name: "div_code", label: "Division Code", width: 140 },
      { name: "loc_type", label: "Location Type", width: 150 },
      { name: "site_uom", label: "Site UOM", width: 130 },
      { name: "inc_storage", label: "Include Storage", type: "select", options: yesNo, width: 150 },
      { name: "status", label: "Status", type: "select", options: activeInactive, width: 120 },
    ],
    defaults: { inc_storage: "N", status: "A" },
    deleteConfig: { mode: "disabled", payload: () => null, reason: "Delete endpoint is not registered in the existing backend" },
    ediUploadConfig: {
      open: true,
      name: "site",
    },
    customLoad: async (user) => {
      const typedUser = user as { loginid: string; company_code: string };
      const data = await executeWmsInboundSql(`
        SELECT
          SITE_CODE AS "site_code",
          SITE_IND AS "site_ind",
          SITE_TYPE AS "site_type",
          SITE_NAME AS "site_name",
          SITE_ADDR1 AS "site_addr1",
          SITE_ADDR2 AS "site_addr2",
          SITE_ADDR3 AS "site_addr3",
          SITE_ADDR4 AS "site_addr4",
          CITY AS "city",
          COUNTRY_CODE AS "country_code",
          CONTACT_NAME AS "contact_name",
          TEL_NO AS "tel_no",
          CHARGE_IND AS "charge_ind",
          PRIN_CODE AS "prin_code",
          GROUP_CODE AS "group_code",
          LOC_TYPE AS "loc_type",
          COMPANY_CODE AS "company_code"
        FROM MS_SITE
        WHERE COMPANY_CODE = '${typedUser.company_code}'
        ORDER BY SITE_CODE
      `);
      return {
        tableData: data as Record<string, unknown>[],
        count: data.length,
      };
    },
  },
  warehouse: {
    title: "Warehouse Master",
    subtitle: "Maintain warehouse code, address, country, city, and contact information.",
    master: "warehouse",
    gmEndpoint: "warehouse",
    routeKeys: ["warehouse"],
    keyField: "wh_code",
    fields: [
      { name: "wh_code", label: "Warehouse Code", required: true, disabledOnEdit: true, width: 160 },
      { name: "wh_name", label: "Warehouse Name", required: true, width: 280 },
      { name: "address_1", label: "Address Line 1", width: 220, table: false },
      { name: "address_2", label: "Address Line 2", width: 220, table: false },
      { name: "address_3", label: "Address Line 3", width: 220, table: false },
      { name: "country_code", label: "Country Code", width: 140 },
      { name: "city", label: "City", width: 150 },
      { name: "phone", label: "Phone", width: 150 },
      { name: "fax", label: "Fax", width: 150, table: false },
      { name: "contact_person", label: "Contact Person", width: 180, table: false },
    ],
    customLoad: async (user) => {
      const typedUser = user as { loginid: string; company_code: string };
      const data = await executeWmsInboundSql(`
        SELECT *
        FROM MS_WAREHOUSE
        WHERE COMPANY_CODE = '${typedUser.company_code}'
        ORDER BY WH_CODE
      `);
      return {
        tableData: data as Record<string, unknown>[],
        count: data.length,
      };
    },
    customSave: async (form, context) => {
      console.log("Custom save logic for Warehouse Master", form, context);
      const { editMode, original, user } = context;
      const typedUser = user as { loginid: string; company_code: string };
      await executeDynamicMutation({
        loginid: typedUser.loginid,
        parameter: "WAREHOUSE_INS_UPD",
        val1s1: (editMode ? (original?.wh_code ?? form.wh_code) : undefined) as string | undefined,
        val1s2: form.wh_name as string,
        val1s3: form.address_1 as string,
        val1s4: form.address_2 as string,
        val1s5: form.address_3 as string,
        val1s6: form.city as string,
        val1s7: form.country_code as string,
        val1s8: form.phone as string,
        val1s9: form.fax as string,
        val1s10: form.contact_person as string,
        wval1s1: typedUser.company_code,
        wval1s2: (editMode ? original?.wh_code : form.wh_code) as string,
      });
    },
    customDelete: async (row, user) => {
      const typedUser = user as { loginid: string; company_code: string };
      await executeWmsInboundSql(`
        DELETE FROM MS_WAREHOUSE
        WHERE COMPANY_CODE = '${typedUser.company_code}'
        AND WH_CODE = '${row.wh_code}'
      `);
    },
  },

  location: {
    title: "Location Master",
    subtitle: "Maintain warehouse location code, type, status, physical dimensions, and site.",
    master: "location",
    gmEndpoint: "location",
    routeKeys: ["location"],
    keyFields: ["site_code", "location_code"],
    rowIdSeparator: "|",
    fieldsPerRow: 4,
    fields: [
      // general
      { name: "site_code", label: "Site Code",dropdownParam: "DROP_DOWN_SITE", dropdownDisplayFields: ["site_code", "site_name"], dropdownValueKey: "site_code", required: true, width: 140, section:"General" },
      { name: "location_code", label: "Location Code", disabledOnEdit: true, width: 170, section:"General" },

      // location
      { name: "aisle", label: "Aisle", required: true, width: 110, section:"Location" },
      { name: "column_no", label: "Column", type: "number", required: true, width: 110, section:"Location" },
      { name: "height", label: "Height", type: "number", width: 110, required: true, section:"Location"},
      { name: "loc_desc", label: "Description", width: 260, section:"Location" },
      { name: "loc_type", label: "Location Type", width: 150, section:"Location" },
      { name: "loc_stat", label: "Status", width: 120, section:"Location" },
      { name:"barcode", label:"Barcode", width: 170, section:"Location" },
      { name:"uom", label:"UOM", width: 170, section:"Location" },

      // dimensions
      { name: "volume_cbm", label: "CBM", type: "number", width: 110, section:"Dimensions" },
      { name: "height_cm", label: "Height (cm)", type: "number", width: 110, section:"Dimensions" },
      { name:"breadth_cm", label:"Breadth (cm)", type:"number", width:110, section:"Dimensions" },
      { name:"length_cm", label:"Length (cm)", type:"number", width:110, section:"Dimensions" },
      { name:"depth", label:"Depth (cm)", type:"number", width:110, section:"Dimensions" },
      { name:'max_qty', label:'Max Qty', type:'number', width:110, section:"Dimensions" },
      { name:"reorder_qty", label:"Reorder Qty", type:"number", width:110, section:"Dimensions" },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.location_code] },
    ediUploadConfig: {
      open: true,
      name: "location",
    }
  },

  assetgroup: {
    title: "Asset Group Master",
    subtitle: "Maintain WMS asset group codes and names.",
    master: "assetgroup",
    gmEndpoint: "assetgroup",
    routeKeys: ["assetgroup", "asset_group", "asset-group"],
    keyField: "asset_group_code",
    fields: [
      { name: "asset_group_code", label: "Asset Group Code", required: true, disabledOnEdit: true, width: 180 },
      { name: "asset_group_name", label: "Asset Group Name", required: true, width: 280 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.asset_group_code] },
  },

  currency: {
    title: "Currency Master",
    subtitle: "Maintain currency code, name, exchange rate, division, subdivision, and sign.",
    master: "currency",
    gmEndpoint: "currency",
    keyField: "curr_code",
    fields: [
      { name: "curr_code", label: "Currency Code", required: true, disabledOnEdit: true, width: 130 },
      { name: "curr_name", label: "Currency Name", required: true, width: 220 },
      { name: "ex_rate", label: "Exchange Rate", type: "text", width: 130 },
      { name: "division", label: "Division", dropdownParam: "DROP_DOWN_DIVISION", dropdownDisplayFields: ["div_code", "div_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "div_code", required: true, width: 130 },
      { name: "subdivision", label: "Sub Division", type: "text", required: true, width: 130 },
      { name: "curr_sign", label: "Currency Sign", width: 120 },
    ],
    defaults: { ex_rate: "1", subdivision: "100" },
    deleteConfig: { mode: "registered", payload: (row) => [row.curr_code] },
  },

  uom: {
    title: "UOM Master",
    subtitle: "Maintain unit of measurement codes used by product and warehouse transactions.",
    master: "uom",
    gmEndpoint: "uom",
    keyField: "uom_code",
    fields: [
      { name: "uom_code", label: "UOM Code", required: true, disabledOnEdit: true, width: 140 },
      { name: "uom_name", label: "UOM Name", required: true, width: 260 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.uom_code] },
  },

  uoc: {
    title: "UOC Master",
    subtitle: "Maintain unit of charge records for WMS billing activity.",
    master: "uoc",
    gmEndpoint: "uoc",
    keyField: "charge_code",
    fields: [
      { name: "charge_code", label: "Charge Code", required: true, width: 140 },
      { name: "description", label: "Description", required: true, width: 260 },
      { name: "activity_group_code", label: "Activity Group", required: true, width: 170 },
      { name: "charge_type", label: "Charge Type", required: true, width: 140 },
    ],
    mapBeforeSave: (form, { editMode, original }) => ({
      ...form,
      ...(editMode
        ? {
            old_charge_code: original?.charge_code || form.charge_code,
            old_charge_type: original?.charge_type || form.charge_type,
          }
        : {}),
    }),
    deleteConfig: { mode: "registered", payload: (row) => [{ company_code: row.company_code, charge_type: row.charge_type, charge_code: row.charge_code }] },
  },

  brand: {
    title: "Brand Master",
    subtitle: "Maintain brand setup by principal and group with preferred storage ranges.",
    master: "brand",
    gmEndpoint: "brand",
    keyField: "brand_code",
    fields: [
      { name: "brandCode", label: "Brand Code", disabledOnEdit: true, width: 130, hideOnAdd: true },
      { name: "prinCode", label: "Principal Code", required: true, dropdownParam: "DROP_DOWN_PRINCIPAL", dropdownDisplayFields: ["prin_code", "prin_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "prin_code", width: 150 },
      { name: "groupCode", label: "Group Code", required: true, dropdownParam: "DROP_DOWN_GROUP", dropdownDisplayFields: ["group_code", "group_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "group_code", dropdownCodeMap: { prinCode: "code1" }, width: 150, disabledWhen: (form) => !form.prinCode },
      { name: "brandName", label: "Brand Name", required: true, width: 230 },
      { name: "prefSite", label: "Preferred Site", required: false, width: 140 },
      { name: "prefAisleFrom", label: "Location From", required: false, width: 150 },
      { name: "prefAisleTo", label: "Location To", required: false, width: 150 },
    ],
    deleteConfig: {
      mode: "registered",
      payload: (row) => [{ company_code: row.company_code, prin_code: row.prin_code, group_code: row.group_code, brand_code: row.brand_code }],
    },
    customSave: async (form, context) => {
      console.log("Custom save logic for Brand Master", form, context);
      const { editMode, original, user } = context;
      const typedUser = user as { loginid: string };
      await executeDynamicMutation({
        loginid: typedUser.loginid,
        parameter: "MWMS_ms_prodbrand",
        val1s1: form.company_code as string,
        val1s2: (form.brandCode ? form.brandCode : editMode ? original?.brandCode : undefined) as string | undefined,
        val1s3: form.prinCode as string,
        val1s4: form.groupCode as string,
        val1s5: form.brandName as string,
      });
    },
  },

  group: {
    title: "Group Master",
    subtitle: "Maintain product groups by principal with optional storage preferences.",
    master: "group",
    gmEndpoint: "group",
    keyField: "group_code",
    fields: [
      { name: "group_code", label: "Group Code", disabledOnEdit: true, width: 140, hideOnAdd: true },
      { name: "prin_code", label: "Principal Code", required: true, dropdownParam: "DROP_DOWN_PRINCIPAL", dropdownDisplayFields: ["prin_code", "prin_name"], dropdownDisplaySeparator: " - ", dropdownValueKey: "prin_code", width: 150 },
      { name: "group_name", label: "Group Name", required: true, width: 260 },
    ],
    deleteConfig: {
      mode: "rawDelete",
      payload: (row) => [{ group_code: row.group_code, prin_code: row.prin_code, company_code: row.company_code }],
    },
  },

  line: {
    title: "Line Master",
    subtitle: "Maintain shipping line codes and names.",
    master: "line",
    gmEndpoint: "line",
    keyField: "line_code",
    fields: [
      { name: "line_code", label: "Line Code", hideOnAdd: true, disabledOnEdit: true, width: 140 },
      { name: "line_name", label: "Line Name", required: true, width: 260 },
    ],
    deleteConfig: { mode: "registered", payload: (row) => [row.line_code] },
  },

  vessel: {
    title: "Vessel Master",
    subtitle: "Maintain vessel details, line, contact, and communication information.",
    master: "vessel",
    gmEndpoint: "vessel",
    keyField: "vessel_code",
    fields: [
      { name: "vessel_code", label: "Vessel Code", required: true, width: 140 },
      { name: "vessel_name", label: "Vessel Name", required: true, width: 240 },
      { name: "line_code", label: "Line Code", width: 140 },
      { name: "contact_person", label: "Contact Person", width: 180 },
      { name: "tel_no", label: "Telephone", width: 140 },
      { name: "email", label: "Email", type: "email", width: 220 },
      { name: "address", label: "Address", table: false },
      { name: "fax_no", label: "Fax No", table: false },
    ],
    mapBeforeSave: (form, { editMode, original }) => ({
      ...form,
      ...(editMode
        ? {
            original_vessel_code: original?.vessel_code || form.vessel_code,
            original_company_code: original?.company_code || form.company_code,
          }
        : {}),
    }),
    deleteConfig: { mode: "registered", payload: (row) => [{ vessel_code: row.vessel_code, company_code: row.company_code }] },
  },

  airline: {
    title: "Airline Master",
    subtitle: "Maintain airline codes and names.",
    master: "airline",
    gmEndpoint: "airline",
    keyField: "airline_code",
    fields: [
      { name: "airline_code", label: "Airline Code", required: true, width: 150 },
      { name: "airline_name", label: "Airline Name", required: true, width: 280 },
      { name: "airline_no", label: "Airline No", width: 140 },
      { name: "contact_person", label: "Contact Person", width: 180 },
      { name: "tel_no", label: "Telephone", width: 140 },
      { name: "email", label: "Email", type: "email", width: 220 },
      { name: "address", label: "Address", table: false },
      { name: "fax_no", label: "Fax No", table: false },
    ],
    mapBeforeSave: (form, { editMode, original }) => {
      if (editMode && original) {
        return {
          ...form,
          old_airline_code: original["airline_code"], // capture original code
        };
      }
      return form;
    },
    deleteConfig: { mode: "registered", payload: (row) => [{ airline_code: row.airline_code, company_code: row.company_code }] },
  },

};

export { yesNo };
