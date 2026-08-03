import { Check, ChevronDown, Edit2, Eye, EyeOff, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { deleteSecurityMaster, getSecurityMaster, saveSecurityMaster } from "../../api/security";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type SecurityField = {
  name: string;
  label: string;
  required?: boolean;
  requiredOnCreate?: boolean;
  disabledOnAdd?: boolean;
  disabledOnEdit?: boolean;
  type?: "text" | "number" | "email" | "password" | "select";
  options?: { label: string; value: string }[];
  optionsFromMaster?: string;
  optionValue?: string;
  optionLabelFields?: string[];
  optionFilter?: Record<string, string>;
  placeholder?: string;
  editPlaceholder?: string;
  table?: boolean;
  width?: number;
};

export type SecurityMasterConfig = {
  title: string;
  subtitle: string;
  master: string;
  gmEndpoint: string;
  routeKeys: string[];
  keyField: string;
  fields: SecurityField[];
  defaults?: Record<string, unknown>;
  deleteEnabled?: boolean;
  createEndpoint?: string;
  updateEndpoint?: string;
  createMethod?: "post" | "put" | "patch";
  updateMethod?: "post" | "put" | "patch";
};

export const securityMasterConfigs: Record<string, SecurityMasterConfig> = {
  flowMaster: {
    title: "Flow Master",
    subtitle: "Maintain workflow codes used by approvals and business processes.",
    master: "flow_master",
    gmEndpoint: "flowmaster",
    routeKeys: ["flow_master", "flowmaster", "flow-master", "flowmaster-sec", "flowmaster-sec-types", "flow master"],
    keyField: "flow_code",
    fields: [
      { name: "flow_code", label: "Flow Code", disabledOnEdit: true, table: true, width: 120 },
      { name: "flow_description", label: "Flow Description", required: true, table: true, width: 280 },
      { name: "company_code", label: "Company", disabledOnEdit: true, table: true, width: 110 },
    ],
    deleteEnabled: true,
  },
  roleMaster: {
    title: "Role Master",
    subtitle: "Maintain security roles used for screen and operation access.",
    master: "role_master",
    gmEndpoint: "rolemaster",
    routeKeys: ["role_master", "rolemaster", "role-master", "secrollmaster", "sec-roll-master", "role master", "roll master"],
    keyField: "role_id",
    fields: [
      { name: "role_id", label: "Role ID", type: "number", disabledOnEdit: true, table: true, width: 110 },
      { name: "role_desc", label: "Role Description", required: true, table: true, width: 260 },
      { name: "remarks", label: "Remarks", table: true, width: 260 },
      { name: "company_code", label: "Company", disabledOnEdit: true, table: true, width: 110 },
    ],
    deleteEnabled: true,
  },
  userLogin: {
    title: "User Login",
    subtitle: "Create and maintain login users, contact details, and active status.",
    master: "sec_login",
    gmEndpoint: "secmaster",
    routeKeys: ["sec_login", "seclogin", "sec-login", "user_login", "user-login", "secmaster", "sec master", "user login", "login master"],
    keyField: "id",
    fields: [
      { name: "id", label: "User ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, placeholder: "Auto generated", table: true, width: 100 },
      { name: "username", label: "User Name", required: true, table: true, width: 220 },
      { name: "loginid", label: "Login ID", disabledOnEdit: true, table: true, width: 140 },
      { name: "userpass", label: "Password", type: "password", requiredOnCreate: true, placeholder: "Enter password", editPlaceholder: "Leave blank to keep current password", table: false },
      { name: "contact_no", label: "Contact No", table: true, width: 150 },
      { name: "email_id", label: "Email", type: "email", table: true, width: 260 },
      { name: "active_flag", label: "Active", type: "select", options: [{ label: "Yes", value: "Y" }, { label: "No", value: "N" }], table: true, width: 100 },
      { name: "company_code", label: "Company", disabledOnEdit: true, table: true, width: 110 },
    ],
    defaults: { active_flag: "Y" },
    deleteEnabled: true,
  },
  moduleData: {
    title: "Screen Module",
    subtitle: "Maintain menu hierarchy, route paths, ordering, and application module mapping.",
    master: "sec_module_data",
    gmEndpoint: "secmoduledata",
    routeKeys: [
      "sec_module_data",
      "sec_module_date",
      "secmoduledata",
      "secmoduledate",
      "sec-module-data",
      "sec-module-date",
      "screen_module",
      "screen-module",
      "secmodulemaster",
      "sec module data",
      "sec module date",
      "module data",
      "module date",
      "screen module",
    ],
    keyField: "serial_no",
    fields: [
      { name: "serial_no", label: "Serial No", type: "number", disabledOnAdd: true, disabledOnEdit: true, placeholder: "Auto generated", table: true, width: 110 },
      { name: "app_code", label: "App Code", required: true, table: true, width: 110 },
      { name: "level1", label: "Level 1", required: true, table: true, width: 170 },
      { name: "level2", label: "Level 2", table: true, width: 180 },
      { name: "level3", label: "Level 3", table: true, width: 220 },
      { name: "position", label: "Position", type: "number", required: true, placeholder: "Sequence within this app", table: true, width: 110 },
      { name: "url_path", label: "Route Path", placeholder: "Auto built from App Code and levels", table: true, width: 320 },
      { name: "icon", label: "Icon", table: true, width: 120 },
      { name: "company_code", label: "Company", disabledOnEdit: true, table: true, width: 110 },
    ],
    deleteEnabled: true,
  },
  company: {
    title: "Company Master",
    subtitle: "Maintain tenant company identity and address information.",
    master: "sec_company",
    gmEndpoint: "seccompany",
    routeKeys: ["sec_company", "seccompany", "company", "company_master", "company-master", "companymaster", "company master"],
    keyField: "company_code",
    fields: [
      { name: "company_code", label: "Company Code", required: true, disabledOnEdit: true, table: true, width: 130 },
      { name: "company_name", label: "Company Name", table: true, width: 260 },
      { name: "address1", label: "Address 1", table: true, width: 220 },
      { name: "address2", label: "Address 2", table: true, width: 220 },
      { name: "address3", label: "Address 3", table: true, width: 220 },
      { name: "city", label: "City", table: true, width: 140 },
      { name: "country", label: "Country", table: true, width: 140 },
    ],
    deleteEnabled: true,
  },
  reportMaster: {
    title: "Report Master",
    subtitle: "Maintain report identifiers and module mapping used by the reporting engine.",
    master: "report_master",
    gmEndpoint: "reportmaster/create",
    createEndpoint: "reportmaster/create",
    updateEndpoint: "reportmaster/modify",
    updateMethod: "patch",
    routeKeys: ["report_master", "reportmaster", "report-master", "report master"],
    keyField: "report_no",
    fields: [
      { name: "report_no", label: "Report No", type: "number", disabledOnEdit: true, table: true, width: 110 },
      { name: "module", label: "Module", required: true, table: true, width: 140 },
      { name: "reportname", label: "Report Name", required: true, table: true, width: 260 },
      { name: "reportid", label: "Report ID", required: true, table: true, width: 220 },
      { name: "company_code", label: "Company", disabledOnEdit: true, table: true, width: 110 },
    ],
    deleteEnabled: true,
  },
  queryMaster: {
    title: "Query Master",
    subtitle: "Maintain dynamic query parameters used by lookup and report screens.",
    master: "query_master",
    gmEndpoint: "query_master",
    routeKeys: ["query_master", "querymaster", "query-master", "query master"],
    keyField: "SR_NO",
    fields: [
      { name: "SR_NO", label: "Sr No", type: "number", disabledOnEdit: true, table: true, width: 100 },
      { name: "COMPANY_CODE", label: "Company", required: true, table: true, width: 110 },
      { name: "PARAMETER", label: "Parameter", required: true, table: true, width: 240 },
      { name: "SQL_STRING", label: "SQL String", required: true, table: true, width: 420 },
      { name: "STRING1", label: "String 1", table: true, width: 140 },
      { name: "STRING2", label: "String 2", table: true, width: 140 },
      { name: "STRING3", label: "String 3", table: true, width: 140 },
      { name: "STRING4", label: "String 4", table: true, width: 140 },
      { name: "ORDER_BY", label: "Order By", table: true, width: 160 },
      { name: "USTRING1", label: "U String 1", table: false },
      { name: "USTRING2", label: "U String 2", table: false },
      { name: "USTRING3", label: "U String 3", table: false },
      { name: "USTRING4", label: "U String 4", table: false },
      { name: "USTRING5", label: "U String 5", table: false },
      { name: "USTRING6", label: "U String 6", table: false },
    ],
    deleteEnabled: true,
  },
  tenantUser: {
    title: "Tenant User",
    subtitle: "Create and maintain root-schema users used for tenant login and mapping.",
    master: "tenant_user",
    gmEndpoint: "tenant-user",
    routeKeys: ["tenant_user", "tenant-user", "tenant user", "tenantuser"],
    keyField: "LOGINID",
    fields: [
      { name: "ID", label: "User ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, placeholder: "Auto generated", table: true, width: 100 },
      { name: "USERNAME", label: "User Name", required: true, table: true, width: 220 },
      { name: "LOGINID", label: "Login ID", required: true, disabledOnEdit: true, table: true, width: 150 },
      { name: "USERPASS", label: "Password", type: "password", requiredOnCreate: true, placeholder: "Enter password", editPlaceholder: "Leave blank to keep current password", table: false },
      { name: "CONTACT_NO", label: "Contact No", table: true, width: 150 },
      { name: "EMAIL_ID", label: "Email", type: "email", table: true, width: 260 },
      { name: "ACTIVE_FLAG", label: "Active", type: "select", options: [{ label: "Yes", value: "Y" }, { label: "No", value: "N" }], table: true, width: 100 },
      { name: "COMPANY_CODE", label: "Company", required: true, table: true, width: 110 },
    ],
    defaults: { ACTIVE_FLAG: "Y", COMPANY_CODE: "BSG" },
    deleteEnabled: true,
  },
  tenantRegistry: {
    title: "Tenant Registry",
    subtitle: "Maintain root tenant database/schema connection registry records.",
    master: "tenant_registry",
    gmEndpoint: "tenant-registry",
    routeKeys: ["tenant_registry", "tenant-registry", "tenant registry", "tenantregistry"],
    keyField: "TENANT_ID",
    fields: [
      { name: "TENANT_ID", label: "Tenant ID", required: true, disabledOnEdit: true, table: true, width: 180 },
      { name: "TENANT_NAME", label: "Tenant Name", required: true, table: true, width: 240 },
      { name: "CONNECTION_TYPE", label: "Connection Type", type: "select", options: [{ label: "Schema", value: "SCHEMA" }, { label: "Database", value: "DATABASE" }], table: true, width: 150 },
      { name: "SCHEMA_NAME", label: "Schema Name", required: true, table: true, width: 150 },
      { name: "DB_HOST", label: "DB Host", required: true, table: true, width: 180 },
      { name: "DB_PORT", label: "DB Port", type: "number", table: true, width: 110 },
      { name: "DB_SERVICE", label: "DB Service", required: true, table: true, width: 220 },
      { name: "DB_USER", label: "DB User", required: true, table: true, width: 150 },
      { name: "DB_PASSWORD", label: "DB Password", type: "password", requiredOnCreate: true, placeholder: "Enter password", editPlaceholder: "Leave blank to keep current password", table: false },
      { name: "CONNECTION_STRING", label: "Connection String", table: false },
      { name: "COMPANY_CODE", label: "Company", required: true, table: true, width: 110 },
      { name: "IS_ACTIVE", label: "Active", type: "select", options: [{ label: "Yes", value: "Y" }, { label: "No", value: "N" }], table: true, width: 100 },
      { name: "MAX_CONNECTIONS", label: "Max Connections", type: "number", table: true, width: 140 },
    ],
    defaults: { CONNECTION_TYPE: "SCHEMA", DB_PORT: 1521, IS_ACTIVE: "Y", MAX_CONNECTIONS: 10, COMPANY_CODE: "BSG" },
    deleteEnabled: true,
  },
  tenantMapping: {
    title: "Tenant Mapping",
    subtitle: "Map root users to tenant registry entries and default tenant access.",
    master: "tenant_mapping",
    gmEndpoint: "tenant-mapping",
    routeKeys: ["tenant_mapping", "tenant-mapping", "tenant mapping", "tenantmapping"],
    keyField: "USER_MAP_ID",
    fields: [
      { name: "USER_MAP_ID", label: "Map ID", type: "number", disabledOnAdd: true, disabledOnEdit: true, placeholder: "Auto generated", table: true, width: 110 },
      {
        name: "LOGINID",
        label: "Login ID",
        required: true,
        type: "select",
        optionsFromMaster: "tenant_user",
        optionValue: "LOGINID",
        optionLabelFields: ["LOGINID"],
        optionFilter: { ACTIVE_FLAG: "Y" },
        table: true,
        width: 180,
      },
      {
        name: "TENANT_ID",
        label: "Tenant",
        required: true,
        type: "select",
        optionsFromMaster: "tenant_registry",
        optionValue: "TENANT_ID",
        optionLabelFields: ["TENANT_ID"],
        table: true,
        width: 260,
      },
      { name: "IS_DEFAULT", label: "Default", type: "select", options: [{ label: "Yes", value: "Y" }, { label: "No", value: "N" }], table: true, width: 110 },
    ],
    defaults: { IS_DEFAULT: "Y" },
    deleteEnabled: true,
  },
};

export function SecurityMasterPage({ config }: { config: SecurityMasterConfig }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [moduleDropdownRows, setModuleDropdownRows] = useState<Record<string, unknown>[]>([]);
  const [masterOptionRows, setMasterOptionRows] = useState<Record<string, Record<string, unknown>[]>>({});
  const [openOptionField, setOpenOptionField] = useState<string | null>(null);
  const [selectSearch, setSelectSearch] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const tableFields = config.fields.filter((field) => field.table !== false);
  const hasSearch = Boolean(query.trim() || columnFilters.some((filter) => String(filter.value ?? "").trim()));
  const isModuleData = config.gmEndpoint === "secmoduledata";
  const positionImpact = isModuleData
    ? getPositionImpact(form, moduleDropdownRows, editMode)
    : null;

  const makeEmpty = () => ({
    ...Object.fromEntries(config.fields.map((field) => [field.name, field.disabledOnAdd ? "" : field.type === "number" ? 0 : ""])),
    ...config.defaults,
    company_code: user?.company_code || "",
  });

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize, clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await getSecurityMaster(config.master, {
        page: hasSearch ? 1 : nextPageIndex + 1,
        limit: hasSearch ? 100000 : nextPageSize,
        search: query.trim(),
      });
      setRows(response.tableData.map(normalizeRow));
      setTotalRows(response.count || response.tableData.length);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [config.master, pageIndex, pageSize, query, columnFilters]);

  useEffect(() => {
    if (!isModuleData) {
      setModuleDropdownRows([]);
      return;
    }
    void loadModuleDropdownRows();
  }, [isModuleData]);

  useEffect(() => {
    const masters = Array.from(new Set(config.fields.map((field) => field.optionsFromMaster).filter(Boolean))) as string[];
    if (!masters.length) {
      setMasterOptionRows({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      masters.map(async (master) => {
        try {
          const response = await getSecurityMaster(master, { page: 1, limit: 100000 });
          return [master, response.tableData.map(normalizeRow)] as const;
        } catch {
          return [master, []] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setMasterOptionRows(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [config.master, config.fields]);

  useEffect(() => {
    if (!isModuleData || !formOpen) return;
    if (editMode) return;
    const nextPath = buildModuleUrlPath(form);
    if (nextPath && nextPath !== form.url_path) {
      setForm((current) => ({ ...current, url_path: nextPath }));
    }
  }, [editMode, isModuleData, formOpen, form.app_code, form.level1, form.level2, form.level3, form.url_path]);

  const loadModuleDropdownRows = async () => {
    try {
      const response = await getSecurityMaster("sec_module_dropdown", { page: 1, limit: 100000 });
      setModuleDropdownRows(response.tableData.map(normalizeRow));
    } catch {
      setModuleDropdownRows([]);
    }
  };

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      ...tableFields.map((field) => ({
        accessorKey: field.name,
        header: field.label,
        size: field.width || 160,
        cell: ({ row }: { row: { original: Record<string, unknown> } }) => formatValue(row.original[field.name]),
      })),
      {
        id: "actions",
        header: "Actions",
        size: 90,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title={`Edit ${config.title}`}>
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" disabled={!config.deleteEnabled} onClick={() => setDeleteTarget(row.original)} title={`Delete ${config.title}`}>
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [config, tableFields],
  );

  const openAdd = () => {
    setEditMode(false);
    setShowPassword(false);
    setOpenOptionField(null);
    setSelectSearch({});
    setForm(makeEmpty());
    setFormOpen(true);
    setNotice(null);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditMode(true);
    setShowPassword(false);
    setOpenOptionField(null);
    setSelectSearch({});
    setForm({ ...makeEmpty(), ...normalizeRow(row), ...(config.gmEndpoint === "secmaster" ? { userpass: "" } : {}) });
    setFormOpen(true);
    setNotice(null);
  };

  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();
    const missing = config.fields.find((field) => isRequiredField(field, editMode) && !String(form[field.name] ?? "").trim());
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    if (isModuleData && (!Number.isInteger(Number(form.position)) || Number(form.position) < 1)) {
      setNotice({ type: "error", message: "Position must be a whole number starting from 1" });
      return;
    }
    if (positionImpact?.affected.length) {
      const confirmed = window.confirm(positionImpact.confirmation);
      if (!confirmed) return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const endpoint = editMode ? config.updateEndpoint || config.gmEndpoint : config.createEndpoint || config.gmEndpoint;
      const method = editMode ? config.updateMethod || "put" : config.createMethod || "post";
      await saveSecurityMaster(endpoint, buildSecurityPayload(config, form, user?.company_code), method as "post" | "put");
      setFormOpen(false);
      setNotice({ type: "success", message: `${config.title} ${editMode ? "updated" : "added"} successfully` });
      await loadRows(pageIndex, pageSize, false);
      if (isModuleData) await loadModuleDropdownRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to save ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  const updateFormField = (field: SecurityField, value: unknown) => {
    setForm((current) => {
      const next = { ...current, [field.name]: value };
      if (isModuleData) {
        if (field.name === "app_code") {
          next.app_code = String(value ?? "").toUpperCase();
          next.level1 = "";
          next.level2 = "";
          next.level3 = "";
          next.position = getNextModulePosition(next.app_code, moduleDropdownRows, editMode ? form.serial_no : undefined);
        }
        if (field.name === "level1") {
          next.level2 = "";
          next.level3 = "";
        }
        if (field.name === "level2") {
          next.level3 = "";
        }
        if (field.name === "level3") {
          next.level3 = String(value ?? "").toUpperCase();
        }
        if (!editMode) {
          next.url_path = buildModuleUrlPath(next);
        }
      }
      return next;
    });
  };

  const showLockedScreenKeyNotice = () => {
    setNotice({
      type: "error",
      message: "Screen Key is locked after creation. To change page mapping, update the frontend route or use Component Name for the new screen.",
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !config.deleteEnabled) return;
    setSaving(true);
    setNotice(null);
    try {
      await deleteSecurityMaster(config.master, [deleteTarget[config.keyField] as string | number]);
      setDeleteTarget(null);
      setNotice({ type: "success", message: `${config.title} deleted successfully` });
      await loadRows(pageIndex, pageSize, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to delete ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="security-page grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">{config.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => loadRows()}>
            <RefreshCw size={15} />
          </Button>
          <Button title={`Add ${config.title}`} onClick={openAdd}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Records`}
        subtitle={`${config.title} List`}
        searchValue={query}
        onSearchChange={(value) => {
          setQuery(value);
          setPageIndex(0);
        }}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading}
        emptyText={`No ${config.title.toLowerCase()} records found`}
        height={620}
        minWidth={Math.max(900, tableFields.reduce((sum, field) => sum + (field.width || 160), 160))}
        density="grid"
        enablePagination
        manualPagination={!hasSearch}
        manualFiltering={false}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        columnFilters={columnFilters}
        onColumnFiltersChange={(filters) => {
          setColumnFilters(filters);
          setPageIndex(0);
        }}
        onPageChange={setPageIndex}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageIndex(0);
        }}
        getRowId={(row, index) => `${String(row[config.keyField] ?? row[config.keyField.toLowerCase()] ?? config.master)}_${index}`}
      />

      <Dialog open={formOpen} title={editMode ? `Edit ${config.title}` : `Add ${config.title}`} wide onClose={() => setFormOpen(false)}>
        <form className="grid gap-4" onSubmit={saveRecord}>
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
              {config.fields.map((field) => (
                <Field label={field.label} required={isRequiredField(field, editMode)} key={field.name}>
                  {renderInput(
                    field,
                    form[field.name],
                    Boolean((editMode && field.disabledOnEdit) || (!editMode && field.disabledOnAdd) || (isModuleData && field.name === "url_path")),
                    editMode,
                    showPassword,
                    getFieldOptions(field.name, form, moduleDropdownRows, isModuleData),
                    getSelectOptions(field, masterOptionRows, form[field.name]),
                    selectSearch[field.name] || "",
                    openOptionField === field.name,
                    (open) => {
                      setOpenOptionField(open ? field.name : null);
                      if (!open) setSelectSearch((current) => ({ ...current, [field.name]: "" }));
                    },
                    (nextSearch) => setSelectSearch((current) => ({ ...current, [field.name]: nextSearch })),
                    () => setShowPassword((current) => !current),
                    (value) => updateFormField(field, value),
                  )}
                </Field>
              ))}
              {positionImpact ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
                  <strong className="text-foreground">Position preview:</strong>{" "}
                  {positionImpact.summary}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            <Button disabled={saving} type="submit">
              <Save size={15} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description={deleteTarget ? `Delete ${formatValue(deleteTarget[config.keyField])}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button disabled={saving} variant="destructive" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">This action uses the existing Bayanat Security backend endpoint.</p>
      </Dialog>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </label>
  );
}

function isRequiredField(field: SecurityField, editMode: boolean) {
  return Boolean(field.required || (field.requiredOnCreate && !editMode));
}

function renderInput(
  field: SecurityField,
  value: unknown,
  disabled: boolean,
  editMode: boolean,
  showPassword: boolean,
  fieldOptions: string[],
  selectOptions: { label: string; value: string }[],
  selectSearch: string,
  optionsOpen: boolean,
  onOptionsOpenChange: (open: boolean) => void,
  onSelectSearchChange: (value: string) => void,
  onTogglePassword: () => void,
  onChange: (value: unknown) => void,
) {
  if (fieldOptions.length) {
    const currentValue = String(value ?? "");
    const visibleOptions = fieldOptions
      .filter((option) => !currentValue || option.toLowerCase().includes(currentValue.toLowerCase()))
      .slice(0, 12);
    return (
      <div className="relative">
        <Input
          disabled={disabled}
          type={field.type === "number" ? "number" : "text"}
          value={disabled && !value ? "" : String(value ?? "")}
          placeholder={editMode && field.editPlaceholder ? field.editPlaceholder : field.placeholder}
          className="pr-9"
          onFocus={() => onOptionsOpenChange(true)}
          onChange={(event) => {
            onChange(field.type === "number" ? Number(event.target.value || 0) : event.target.value);
            onOptionsOpenChange(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onOptionsOpenChange(false);
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none"
          onClick={() => onOptionsOpenChange(!optionsOpen)}
          aria-label={`Show ${field.label} options`}
        >
          <span className="text-[10px]">▼</span>
        </button>
        {optionsOpen && !disabled && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] overflow-hidden rounded-md border bg-popover text-sm shadow-xl"
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="max-h-56 overflow-auto p-1">
              {visibleOptions.length ? (
                visibleOptions.map((option) => (
                  <button
                    type="button"
                    className="flex w-full items-center rounded px-3 py-2 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      onChange(field.type === "number" ? Number(option || 0) : option);
                      onOptionsOpenChange(false);
                    }}
                    key={option}
                  >
                    <span className="min-w-0 truncate">{option}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-xs text-muted-foreground">No matching options</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  if (field.type === "select") {
    const options = selectOptions.length ? selectOptions : field.options || [];
    if (field.optionsFromMaster) {
      const currentValue = String(value ?? "");
      const selectedOption = options.find((option) => option.value === currentValue);
      const visibleOptions = options
        .filter((option) => {
          const needle = selectSearch.trim().toLowerCase();
          if (!needle) return true;
          return option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle);
        })
        .slice(0, 200);

      return (
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            className="ui-select flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onOptionsOpenChange(!optionsOpen)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onOptionsOpenChange(false);
            }}
            aria-haspopup="listbox"
            aria-expanded={optionsOpen}
          >
            <span className={selectedOption ? "min-w-0 truncate" : "min-w-0 truncate text-muted-foreground"}>
              {selectedOption?.label || `Select ${field.label}`}
            </span>
            <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
          </button>
          {optionsOpen && !disabled && (
            <div
              className="absolute left-0 top-[calc(100%+6px)] z-[140] w-full min-w-[260px] overflow-hidden rounded-lg border border-border bg-popover text-sm shadow-xl"
              onMouseDown={(event) => event.preventDefault()}
            >
              <div className="border-b bg-background p-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="h-8 w-full rounded-md border border-input bg-background py-1 pl-8 pr-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder={`Search ${field.label.toLowerCase()}...`}
                    value={selectSearch}
                    autoFocus
                    onChange={(event) => onSelectSearchChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") onOptionsOpenChange(false);
                    }}
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto p-1" role="listbox">
                {visibleOptions.length ? (
                  visibleOptions.map((option) => {
                    const selected = option.value === currentValue;
                    return (
                      <button
                        type="button"
                        className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          onChange(option.value);
                          onSelectSearchChange("");
                          onOptionsOpenChange(false);
                        }}
                        key={option.value}
                        role="option"
                        aria-selected={selected}
                      >
                        <span className="min-w-0 truncate">{option.label}</span>
                        {selected && <Check size={14} className="shrink-0 text-primary" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-3 text-xs text-muted-foreground">No matching options</div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <Select disabled={disabled} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select {field.label}</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </Select>
    );
  }
  if (field.type === "password") {
    return (
      <div className="relative">
        <Input
          disabled={disabled}
          type={showPassword ? "text" : "password"}
          value={String(value ?? "")}
          placeholder={editMode && field.editPlaceholder ? field.editPlaceholder : field.placeholder}
          className="pr-10"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onTogglePassword}
          aria-label={showPassword ? "Hide password" : "Show password"}
          title={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    );
  }
  return (
    <Input
      disabled={disabled}
      type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
      value={disabled && !value ? "" : String(value ?? "")}
      placeholder={editMode && field.editPlaceholder ? field.editPlaceholder : field.placeholder}
      onChange={(event) => onChange(field.type === "number" ? Number(event.target.value || 0) : event.target.value)}
    />
  );
}

function getFieldOptions(fieldName: string, form: Record<string, unknown>, rows: Record<string, unknown>[], isModuleData: boolean) {
  if (!isModuleData) return [];
  const appCode = String(form.app_code ?? "");
  const level1 = String(form.level1 ?? "");
  const level2 = String(form.level2 ?? "");
  const filtered = rows.filter((row) => {
    if (fieldName === "app_code") return true;
    if (appCode && String(row.app_code ?? "") !== appCode) return false;
    if (fieldName === "level1") return true;
    if (level1 && String(row.level1 ?? "") !== level1) return false;
    if (fieldName === "level2") return true;
    if (level2 && String(row.level2 ?? "") !== level2) return false;
    return fieldName === "level3";
  });
  const optionKey = fieldName === "app_code" ? "app_code" : fieldName;
  return uniqueStrings(filtered.map((row) => row[optionKey]));
}

function getSelectOptions(field: SecurityField, optionRows: Record<string, Record<string, unknown>[]>, currentValue: unknown) {
  if (!field.optionsFromMaster) return [];
  const valueKey = field.optionValue || field.name;
  const rows = (optionRows[field.optionsFromMaster] || []).filter((row) => matchesOptionFilter(row, field.optionFilter));
  const options = rows
    .map((row) => {
      const value = String(row[valueKey] ?? row[valueKey.toLowerCase()] ?? "").trim();
      if (!value) return null;
      const labelParts = (field.optionLabelFields?.length ? field.optionLabelFields : [valueKey])
        .map((key) => String(row[key] ?? row[key.toLowerCase()] ?? "").trim())
        .filter(Boolean);
      return { value, label: labelParts.length ? labelParts.join(" - ") : value };
    })
    .filter((option): option is { label: string; value: string } => Boolean(option));
  const uniqueOptions = Array.from(new Map(options.map((option) => [option.value, option])).values());
  const value = String(currentValue ?? "").trim();
  if (value && !uniqueOptions.some((option) => option.value === value)) {
    uniqueOptions.unshift({ value, label: value });
  }
  return uniqueOptions.sort((a, b) => a.label.localeCompare(b.label));
}

function matchesOptionFilter(row: Record<string, unknown>, optionFilter?: Record<string, string>) {
  if (!optionFilter) return true;
  return Object.entries(optionFilter).every(([key, expected]) => {
    const value = row[key] ?? row[key.toLowerCase()];
    return String(value ?? "").trim().toUpperCase() === expected.toUpperCase();
  });
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function getNextModulePosition(appCode: unknown, rows: Record<string, unknown>[], excludeSerial?: unknown) {
  const app = String(appCode ?? "").trim().toUpperCase();
  if (!app) return 1;
  const moduleRows = rows
    .filter((row) =>
      String(row.app_code ?? "").trim().toUpperCase() === app &&
      Number(row.serial_no) !== Number(excludeSerial),
    );
  // Positions are maintained as a compact 1..N sequence. Count-based next
  // position stays correct even while legacy data still contains gaps.
  return moduleRows.length + 1;
}

function getPositionImpact(
  form: Record<string, unknown>,
  rows: Record<string, unknown>[],
  editMode: boolean,
) {
  const appCode = String(form.app_code ?? "").trim().toUpperCase();
  const requested = Math.trunc(Number(form.position));
  if (!appCode || !Number.isFinite(requested) || requested < 1) return null;

  const serialNo = Number(form.serial_no);
  const current = editMode ? rows.find((row) => Number(row.serial_no) === serialNo) : undefined;
  const oldAppCode = String(current?.app_code ?? "").trim().toUpperCase();
  const currentAppRows = rows
    .filter((row) => String(row.app_code ?? "").trim().toUpperCase() === oldAppCode)
    .sort((left, right) => Number(left.position) - Number(right.position));
  const oldOrdinal = currentAppRows.findIndex((row) => Number(row.serial_no) === serialNo) + 1;
  const targetRows = rows
    .filter((row) => String(row.app_code ?? "").trim().toUpperCase() === appCode && Number(row.serial_no) !== serialNo)
    .sort((left, right) => Number(left.position) - Number(right.position));
  const finalPosition = Math.min(requested, targetRows.length + 1);

  let affected: Record<string, unknown>[] = [];
  let direction = "";
  if (!current || oldAppCode !== appCode) {
    affected = targetRows.slice(finalPosition - 1);
    direction = "down by one";
  } else if (finalPosition < oldOrdinal) {
    affected = targetRows.slice(finalPosition - 1, oldOrdinal - 1);
    direction = "down by one";
  } else if (finalPosition > oldOrdinal) {
    affected = targetRows.slice(oldOrdinal - 1, finalPosition - 1);
    direction = "up by one";
  }

  const screenName = getMenuScreenName(form) || "This screen";
  const detail = affected.length
    ? ` ${affected.length} existing ${appCode} screen${affected.length === 1 ? "" : "s"} will move ${direction}.`
    : " No existing screen will move.";

  return {
    affected,
    summary: `${screenName} will be position ${finalPosition} of ${targetRows.length + 1}.${detail}`,
    confirmation: `Change ${screenName} to position ${finalPosition} in ${appCode}?${detail}`,
  };
}

function getMenuScreenName(row: Record<string, unknown>) {
  return [row.level3, row.level2, row.level1]
    .map((value) => String(value ?? "").trim())
    .find((value) => value && value.toLowerCase() !== "null") || "";
}

function buildModuleUrlPath(form: Record<string, unknown>) {
  return [form.app_code, form.level1, form.level2, form.level3]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

function buildSecurityPayload(config: SecurityMasterConfig, form: Record<string, unknown>, companyCode?: string) {
  const fieldNames = new Set(config.fields.map((field) => field.name));
  const payload: Record<string, unknown> = {};
  config.fields.forEach((field) => {
    if (config.gmEndpoint === "secmaster" && field.name === "id" && !String(form.id ?? "").trim()) return;
    if (config.gmEndpoint === "secmaster" && field.name === "userpass" && !String(form.userpass ?? "").trim()) return;
    if (config.gmEndpoint === "secmoduledata" && field.name === "serial_no" && !String(form.serial_no ?? "").trim()) return;
    payload[field.name] = form[field.name];
  });
  if (fieldNames.has("company_code")) {
    payload.company_code = form.company_code || companyCode || "";
  }
  if (fieldNames.has("COMPANY_CODE")) {
    payload.COMPANY_CODE = form.COMPANY_CODE || companyCode || "";
  }
  return payload;
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
    normalized[toSnakeCase(key)] = value;
  });
  alias(normalized, "app_code", ["appcode", "appCode", "APP_CODE"]);
  alias(normalized, "serial_no", ["serialno", "serialNo", "SERIAL_NO"]);
  alias(normalized, "level1", ["LEVEL1"]);
  alias(normalized, "level2", ["LEVEL2"]);
  alias(normalized, "level3", ["LEVEL3"]);
  alias(normalized, "url_path", ["urlpath", "urlPath", "URL_PATH"]);
  alias(normalized, "company_code", ["companycode", "companyCode", "COMPANY_CODE"]);
  return normalized;
}

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function alias(row: Record<string, unknown>, target: string, sources: string[]) {
  if (row[target] !== undefined) return;
  const source = sources.find((key) => row[key] !== undefined);
  if (source) row[target] = row[source];
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
