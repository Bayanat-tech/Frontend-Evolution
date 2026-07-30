import type { FreightMasterConfig } from "./FreightMasterPage";
import { freightDelete, freightSave, freightSelect, type FreightProcedureParams } from "../../api/freight";

const activeStatus = [
  { label: "Active", value: "A" },
  { label: "Inactive", value: "I" },
];

const transportMode = [
  { label: "Air", value: "A" },
  { label: "Sea", value: "S" },
  { label: "Road", value: "R" },
];

const partyType = [
  { label: "Customer", value: "C" },
  { label: "Broker", value: "B" },
  { label: "Forwarder", value: "F" },
  { label: "Carrier", value: "L" },
];

const disableDelete = {
  mode: "disabled" as const,
  payload: () => null,
  reason: "Delete must be routed through the registered freight database procedure.",
};

type FreightUser = {
  loginid?: string;
  LOGINID?: string;
  loginid1?: string;
  LOGINID1?: string;
  company_code?: string;
  COMPANY_CODE?: string;
};

const stringSlotLimit = 30;
const numberSlotLimit = 10;
const dateSlotLimit = 10;

function getLoginId(user: unknown) {
  const typed = (user || {}) as FreightUser;
  return typed.loginid || typed.LOGINID || typed.loginid1 || typed.LOGINID1 || "";
}

function getCompanyCode(user: unknown, form?: Record<string, unknown>) {
  const typed = (user || {}) as FreightUser;
  return String(form?.company_code || typed.company_code || typed.COMPANY_CODE || "");
}

function toSnake(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function buildProcedureParameter(configKey: string) {
  return `freight_${toSnake(configKey)}`;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSaveParams(
  config: FreightMasterConfig,
  parameter: string,
  form: Record<string, unknown>,
  context: { editMode: boolean; original: Record<string, unknown> | null; user: unknown }
): FreightProcedureParams {
  const params: FreightProcedureParams = {
    parameter,
    loginid: getLoginId(context.user),
    code1: getCompanyCode(context.user, form),
    code2: context.editMode ? "UPDATE" : "INSERT",
  };
  let stringIndex = 1;
  let numberIndex = 1;
  let dateIndex = 1;

  config.fields.forEach((field) => {
    const value = form[field.name];
    if (field.type === "number" && numberIndex <= numberSlotLimit) {
      params[`val1n${numberIndex}`] = numberValue(value);
      numberIndex += 1;
      return;
    }
    if (field.type === "date" && dateIndex <= dateSlotLimit) {
      params[`val1d${dateIndex}`] = value ? String(value) : null;
      dateIndex += 1;
      return;
    }
    if (stringIndex <= stringSlotLimit) {
      params[`val1s${stringIndex}`] = value == null ? "" : String(value);
      stringIndex += 1;
    }
  });

  const keyFields = config.keyFields?.length ? config.keyFields : config.keyField ? [config.keyField] : [];
  keyFields.slice(0, 10).forEach((fieldName, index) => {
    const value = context.original?.[fieldName] ?? form[fieldName];
    params[`wval1s${index + 1}`] = value == null ? "" : String(value);
  });

  return params;
}

function buildDeleteParams(config: FreightMasterConfig, parameter: string, row: Record<string, unknown>, user: unknown): FreightProcedureParams {
  const params: FreightProcedureParams = {
    parameter,
    loginid: getLoginId(user),
    code1: getCompanyCode(user, row),
  };
  const keyFields = config.keyFields?.length ? config.keyFields : config.keyField ? [config.keyField] : [];
  keyFields.slice(0, 10).forEach((fieldName, index) => {
    const value = row[fieldName] ?? row[fieldName.toUpperCase()];
    params[`code${index + 2}`] = value == null ? "" : String(value);
  });
  return params;
}

function withFreightProcedures(configKey: string, config: FreightMasterConfig): FreightMasterConfig {
  const parameter = buildProcedureParameter(configKey);
  return {
    ...config,
    customLoad: async (user) => {
      const tableData = await freightSelect<Record<string, unknown>>({
        parameter,
        loginid: getLoginId(user),
        code1: getCompanyCode(user),
      });
      return { tableData, count: tableData.length };
    },
    customSave: async (form, context) => {
      await freightSave(buildSaveParams(config, parameter, form, context));
    },
    customDelete: async (row, user) => {
      await freightDelete(buildDeleteParams(config, parameter, row, user));
    },
  };
}

const freightMasterDefinitions: Record<string, FreightMasterConfig> = {
  customer: {
    title: "Freight Customer Master",
    subtitle: "Maintain freight customer identity, contacts, credit terms, and communication details.",
    master: "freight-customer",
    gmEndpoint: "freight/customer",
    routeKeys: ["customer", "customers", "freight_customer", "freight-customer", "ms_customer", "ff_customer"],
    keyField: "customer_code",
    fieldsPerRow: 3,
    fields: [
      { name: "customer_code", label: "Customer Code", required: true, disabledOnEdit: true, width: 150, tab: "basic", section: "Identity" },
      { name: "customer_name", label: "Customer Name", required: true, width: 280, tab: "basic", section: "Identity" },
      { name: "partner_type", label: "Party Type", type: "select", options: partyType, width: 150, tab: "basic", section: "Identity" },
      { name: "status", label: "Status", type: "select", options: activeStatus, width: 120, tab: "basic", section: "Identity" },
      { name: "curr_code", label: "Currency", dropdownParam: "DROP_DOWN_CURRENCY", dropdownValueKey: "curr_code", dropdownDisplayFields: ["curr_code", "curr_name"], dropdownDisplaySeparator: " - ", width: 130, tab: "basic", section: "Finance" },
      { name: "payment_terms", label: "Payment Terms", width: 150, tab: "basic", section: "Finance" },
      { name: "credit_limit", label: "Credit Limit", type: "number", width: 140, tab: "basic", section: "Finance" },
      { name: "contact_person", label: "Contact Person", width: 180, tab: "contact", section: "Primary Contact" },
      { name: "tel_no", label: "Telephone", width: 150, tab: "contact", section: "Primary Contact" },
      { name: "fax_no", label: "Fax", width: 150, tab: "contact", section: "Primary Contact", table: false },
      { name: "email", label: "Email", type: "email", width: 220, tab: "contact", section: "Primary Contact" },
      { name: "addr1", label: "Address 1", width: 260, tab: "address", section: "Address", table: false },
      { name: "addr2", label: "Address 2", width: 260, tab: "address", section: "Address", table: false },
      { name: "addr3", label: "Address 3", width: 260, tab: "address", section: "Address", table: false },
      { name: "addr4", label: "Address 4", width: 260, tab: "address", section: "Address", table: false },
      { name: "city", label: "City", width: 160, tab: "address", section: "Address" },
      { name: "country_code", label: "Country", dropdownParam: "DROP_DOWN_COUNTRY", dropdownValueKey: "country_code", dropdownDisplayFields: ["country_code", "country_name"], dropdownDisplaySeparator: " - ", width: 150, tab: "address", section: "Address" },
    ],
    defaults: { status: "A", partner_type: "C" },
    formTabs: [
      { key: "basic", label: "Basic" },
      { key: "contact", label: "Contact" },
      { key: "address", label: "Address" },
    ],
    deleteConfig: disableDelete,
  },

  forwarder: {
    title: "Forwarder Master",
    subtitle: "Maintain forwarding agents with address, contact, currency, and payment details.",
    master: "freight-forwarder",
    gmEndpoint: "freight/forwarder",
    routeKeys: ["forwarder", "forwarders", "freight_forwarder", "freight-forwarder", "ms_forwarder"],
    keyField: "forwarder_code",
    fieldsPerRow: 3,
    fields: [
      { name: "forwarder_code", label: "Forwarder Code", required: true, disabledOnEdit: true, width: 160, tab: "basic", section: "Identity" },
      { name: "forwarder_name", label: "Forwarder Name", required: true, width: 280, tab: "basic", section: "Identity" },
      { name: "partner_type", label: "Party Type", type: "select", options: partyType, width: 150, tab: "basic", section: "Identity" },
      { name: "status", label: "Status", type: "select", options: activeStatus, width: 120, tab: "basic", section: "Identity" },
      { name: "curr_code", label: "Currency", dropdownParam: "DROP_DOWN_CURRENCY", dropdownValueKey: "curr_code", dropdownDisplayFields: ["curr_code", "curr_name"], dropdownDisplaySeparator: " - ", width: 130, tab: "basic", section: "Finance" },
      { name: "payment_terms", label: "Payment Terms", width: 150, tab: "basic", section: "Finance" },
      { name: "forwarder_contact1", label: "Contact 1", width: 180, tab: "contact", section: "Contacts" },
      { name: "forwarder_telno1", label: "Telephone 1", width: 150, tab: "contact", section: "Contacts" },
      { name: "forwarder_email1", label: "Email 1", type: "email", width: 220, tab: "contact", section: "Contacts" },
      { name: "forwarder_contact2", label: "Contact 2", width: 180, tab: "contact", section: "Contacts", table: false },
      { name: "forwarder_telno2", label: "Telephone 2", width: 150, tab: "contact", section: "Contacts", table: false },
      { name: "forwarder_email2", label: "Email 2", type: "email", width: 220, tab: "contact", section: "Contacts", table: false },
      { name: "forwarder_addr1", label: "Address 1", width: 260, tab: "address", section: "Address", table: false },
      { name: "forwarder_addr2", label: "Address 2", width: 260, tab: "address", section: "Address", table: false },
      { name: "forwarder_addr3", label: "Address 3", width: 260, tab: "address", section: "Address", table: false },
      { name: "forwarder_addr4", label: "Address 4", width: 260, tab: "address", section: "Address", table: false },
      { name: "forwarder_city", label: "City", width: 160, tab: "address", section: "Address" },
      { name: "country_code", label: "Country", dropdownParam: "DROP_DOWN_COUNTRY", dropdownValueKey: "country_code", dropdownDisplayFields: ["country_code", "country_name"], dropdownDisplaySeparator: " - ", width: 150, tab: "address", section: "Address" },
    ],
    defaults: { status: "A", partner_type: "F" },
    formTabs: [
      { key: "basic", label: "Basic" },
      { key: "contact", label: "Contact" },
      { key: "address", label: "Address" },
    ],
    deleteConfig: disableDelete,
  },

  broker: {
    title: "Broker Master",
    subtitle: "Maintain broker contact and address details for freight operations.",
    master: "freight-broker",
    gmEndpoint: "freight/broker",
    routeKeys: ["broker", "brokers", "partner", "freight_broker", "freight-broker", "ms_broker"],
    keyField: "broker_code",
    fieldsPerRow: 3,
    fields: [
      { name: "broker_code", label: "Broker Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "broker_name", label: "Broker Name", required: true, width: 260 },
      { name: "country_code", label: "Country", dropdownParam: "DROP_DOWN_COUNTRY", dropdownValueKey: "country_code", dropdownDisplayFields: ["country_code", "country_name"], dropdownDisplaySeparator: " - ", width: 150 },
      { name: "broker_city", label: "City", width: 150 },
      { name: "broker_contact1", label: "Contact", width: 180 },
      { name: "broker_telno1", label: "Telephone", width: 150 },
      { name: "broker_email1", label: "Email", type: "email", width: 220 },
      { name: "broker_addr1", label: "Address 1", table: false },
      { name: "broker_addr2", label: "Address 2", table: false },
      { name: "broker_addr3", label: "Address 3", table: false },
      { name: "broker_addr4", label: "Address 4", table: false },
    ],
    deleteConfig: disableDelete,
  },

  port: {
    title: "Freight Port Master",
    subtitle: "Maintain sea, air, and road port codes used in freight routing.",
    master: "freight-port",
    gmEndpoint: "freight/port",
    routeKeys: ["port", "ports", "freight_port", "freight-port", "ms_port"],
    keyField: "port_code",
    fieldsPerRow: 3,
    fields: [
      { name: "port_code", label: "Port Code", required: true, disabledOnEdit: true, width: 140 },
      { name: "port_name", label: "Port Name", required: true, width: 260 },
      { name: "country_code", label: "Country", dropdownParam: "DROP_DOWN_COUNTRY", dropdownValueKey: "country_code", dropdownDisplayFields: ["country_code", "country_name"], dropdownDisplaySeparator: " - ", width: 150 },
      { name: "trp_mode", label: "Transport Mode", type: "select", options: transportMode, width: 150 },
    ],
    deleteConfig: disableDelete,
  },

  airline: {
    title: "Airline Master",
    subtitle: "Maintain airline identity, contact, and airway communication details.",
    master: "freight-airline",
    gmEndpoint: "freight/airline",
    routeKeys: ["airline", "airlines", "freight_airline", "freight-airline", "ms_airline"],
    keyField: "airline_code",
    fieldsPerRow: 3,
    fields: [
      { name: "airline_code", label: "Airline Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "airline_name", label: "Airline Name", required: true, width: 280 },
      { name: "airline_no", label: "Airline No", width: 140 },
      { name: "contact_person", label: "Contact Person", width: 180 },
      { name: "tel_no", label: "Telephone", width: 150 },
      { name: "email", label: "Email", type: "email", width: 220 },
      { name: "address", label: "Address", table: false },
      { name: "fax_no", label: "Fax", table: false },
    ],
    deleteConfig: disableDelete,
  },

  line: {
    title: "Shipping Line Master",
    subtitle: "Maintain shipping line codes used by vessel and sea freight jobs.",
    master: "freight-line",
    gmEndpoint: "freight/line",
    routeKeys: ["line", "lines", "shipping_line", "shipping-line", "freight_line", "freight-line", "ms_line"],
    keyField: "line_code",
    fields: [
      { name: "line_code", label: "Line Code", required: true, disabledOnEdit: true, width: 140 },
      { name: "line_name", label: "Line Name", required: true, width: 280 },
      { name: "status", label: "Status", type: "select", options: activeStatus, width: 120 },
    ],
    defaults: { status: "A" },
    deleteConfig: disableDelete,
  },

  vessel: {
    title: "Vessel Master",
    subtitle: "Maintain vessel identity, shipping line, and contact details.",
    master: "freight-vessel",
    gmEndpoint: "freight/vessel",
    routeKeys: ["vessel", "vessels", "freight_vessel", "freight-vessel", "ms_vessel"],
    keyField: "vessel_code",
    fieldsPerRow: 3,
    fields: [
      { name: "vessel_code", label: "Vessel Code", required: true, disabledOnEdit: true, width: 150 },
      { name: "vessel_name", label: "Vessel Name", required: true, width: 260 },
      { name: "line_code", label: "Line", dropdownParam: "DROP_DOWN_LINE", dropdownValueKey: "line_code", dropdownDisplayFields: ["line_code", "line_name"], dropdownDisplaySeparator: " - ", width: 150 },
      { name: "contact_person", label: "Contact Person", width: 180 },
      { name: "tel_no", label: "Telephone", width: 150 },
      { name: "email", label: "Email", type: "email", width: 220 },
      { name: "address", label: "Address", table: false },
      { name: "fax_no", label: "Fax", table: false },
    ],
    deleteConfig: disableDelete,
  },

  activity: {
    title: "Freight Activity Master",
    subtitle: "Maintain freight activity codes, groups, charge linkage, and transport mode.",
    master: "freight-activity",
    gmEndpoint: "freight/activity",
    routeKeys: ["activity", "activities", "freight_activity", "freight-activity", "ms_activity", "ff_activity"],
    keyField: "activity_code",
    fieldsPerRow: 3,
    fields: [
      { name: "activity_code", label: "Activity Code", required: true, disabledOnEdit: true, width: 150, tab: "basic", section: "Identity" },
      { name: "activity", label: "Activity Name", required: true, width: 280, tab: "basic", section: "Identity" },
      { name: "activity_group_code", label: "Activity Group", dropdownParam: "DROP_DOWN_ACTIVITY_GROUP", dropdownValueKey: "activity_group_code", dropdownDisplayFields: ["activity_group_code", "activity_group"], dropdownDisplaySeparator: " - ", width: 170, tab: "basic", section: "Classification" },
      { name: "activity_subgroup_code", label: "Activity Subgroup", dropdownParam: "DROP_DOWN_ACTIVITY_SUBGROUP", dropdownValueKey: "activity_subgroup_code", dropdownDisplayFields: ["activity_subgroup_code", "activity_subgroup"], dropdownDisplaySeparator: " - ", width: 180, tab: "basic", section: "Classification" },
      { name: "trp_mode", label: "Transport Mode", type: "select", options: transportMode, width: 150, tab: "basic", section: "Classification" },
      { name: "charge_code", label: "Charge Code", width: 150, tab: "billing", section: "Billing" },
      { name: "uom_code", label: "UOM", dropdownParam: "DROP_DOWN_UOM", dropdownValueKey: "uom_code", dropdownDisplayFields: ["uom_code", "uom_name"], dropdownDisplaySeparator: " - ", width: 130, tab: "billing", section: "Billing" },
      { name: "status", label: "Status", type: "select", options: activeStatus, width: 120, tab: "billing", section: "Billing" },
    ],
    defaults: { status: "A" },
    formTabs: [
      { key: "basic", label: "Basic" },
      { key: "billing", label: "Billing" },
    ],
    deleteConfig: disableDelete,
  },

  activitySubgroup: {
    title: "Freight Activity Subgroup",
    subtitle: "Maintain subgroup classification used by freight activities.",
    master: "freight-activity-subgroup",
    gmEndpoint: "freight/activity-subgroup",
    routeKeys: ["activity_subgroup", "activity-subgroup", "activitysubgroup", "freight_activity_subgroup", "ms_activity_subgroup"],
    keyField: "activity_subgroup_code",
    fields: [
      { name: "activity_subgroup_code", label: "Subgroup Code", required: true, disabledOnEdit: true, width: 160 },
      { name: "activity_subgroup", label: "Subgroup Name", required: true, width: 280 },
      { name: "activity_group_code", label: "Activity Group", dropdownParam: "DROP_DOWN_ACTIVITY_GROUP", dropdownValueKey: "activity_group_code", dropdownDisplayFields: ["activity_group_code", "activity_group"], dropdownDisplaySeparator: " - ", width: 170 },
      { name: "status", label: "Status", type: "select", options: activeStatus, width: 120 },
    ],
    defaults: { status: "A" },
    deleteConfig: disableDelete,
  },

  container: {
    title: "Container Master",
    subtitle: "Maintain container size/type, ISO code, capacity, and tare weight.",
    master: "freight-container",
    gmEndpoint: "freight/container",
    routeKeys: ["container", "containers", "freight_container", "freight-container", "ms_container"],
    keyField: "container_code",
    fieldsPerRow: 3,
    fields: [
      { name: "container_code", label: "Container Code", required: true, disabledOnEdit: true, width: 160 },
      { name: "container_name", label: "Container Name", required: true, width: 240 },
      { name: "container_type", label: "Type", width: 150 },
      { name: "iso_code", label: "ISO Code", width: 130 },
      { name: "teu", label: "TEU", type: "number", width: 110 },
      { name: "tare_weight", label: "Tare Weight", type: "number", width: 140 },
      { name: "max_weight", label: "Max Weight", type: "number", width: 140 },
      { name: "status", label: "Status", type: "select", options: activeStatus, width: 120 },
    ],
    defaults: { status: "A" },
    deleteConfig: disableDelete,
  },
};

export const freightMasterConfigs = Object.fromEntries(
  Object.entries(freightMasterDefinitions).map(([key, config]) => [key, withFreightProcedures(key, config)])
) as Record<string, FreightMasterConfig>;
