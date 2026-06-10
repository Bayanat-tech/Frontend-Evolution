import { Check, ChevronDown, RefreshCw, Search, Shield, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteSecurityGm, getSecurityGm, getSecurityMaster, saveSecurityGm } from "../../api/security";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";

type AssignmentField = {
  name: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "select";
  optionsFrom?: string;
  optionValue?: string;
  optionLabel?: string;
  table?: boolean;
  width?: number;
};

export type SecurityAssignmentConfig = {
  title: string;
  subtitle: string;
  master: string;
  routeKeys: string[];
  keyFields: string[];
  fields: AssignmentField[];
  createEndpoint: string;
  deleteEndpoint: string;
  deletePayload: (row: Record<string, unknown>) => Record<string, unknown>;
  defaults?: Record<string, unknown>;
  updateEndpoint?: string;
};

const operationFields: AssignmentField[] = [
  { name: "snew", label: "New", type: "select", table: true, width: 80 },
  { name: "smodify", label: "Modify", type: "select", table: true, width: 90 },
  { name: "sdelete", label: "Delete", type: "select", table: true, width: 90 },
  { name: "ssave", label: "Save", type: "select", table: true, width: 80 },
  { name: "ssearch", label: "Search", type: "select", table: true, width: 90 },
  { name: "ssaveas", label: "Save As", type: "select", table: true, width: 90 },
  { name: "supload", label: "Upload", type: "select", table: true, width: 90 },
  { name: "sundo", label: "Undo", type: "select", table: true, width: 80 },
  { name: "sprint", label: "Print", type: "select", table: true, width: 80 },
  { name: "sprintsetup", label: "Print Setup", type: "select", table: true, width: 110 },
  { name: "shelp", label: "Help", type: "select", table: true, width: 80 },
];

export const securityAssignmentConfigs: Record<string, SecurityAssignmentConfig> = {
  screenAccess: {
    title: "Screen Access",
    subtitle: "Assign projects or application screens to users.",
    master: "project_access",
    routeKeys: ["project_access", "projectaccess", "screen_access", "screenaccess", "screen-access", "project access", "screen access", "screen acess", "project acess"],
    keyFields: ["user_id", "project_code"],
    createEndpoint: "projectaccess",
    deleteEndpoint: "projectaccess/delete",
    deletePayload: (row) => ({ screen_details: [{ user_id: row.user_id, project_code: row.project_code }] }),
    fields: [
      { name: "user_id", label: "User", required: true, optionsFrom: "sec_login", optionValue: "loginid", optionLabel: "username", table: true, width: 180 },
      { name: "project_code", label: "Project", required: true, optionsFrom: "projects", optionValue: "project_code", optionLabel: "project_name", table: true, width: 180 },
      { name: "project_name", label: "Project Name", table: true, width: 260 },
    ],
  },
  userRoleAccess: {
    title: "User Role Access",
    subtitle: "Assign security roles to login users.",
    master: "user_role_access",
    routeKeys: ["user_role_access", "userroleaccess", "user-role-access", "role_access", "roleaccess", "user role access", "role access", "user roll access", "roll access"],
    keyFields: ["user_id", "user_role"],
    createEndpoint: "userroleaccess",
    deleteEndpoint: "userroleaccess/delete",
    deletePayload: (row) => ({ screen_details: [{ user_id: row.user_id, user_role: row.user_role }] }),
    fields: [
      { name: "user_id", label: "User", required: true, optionsFrom: "sec_login", optionValue: "loginid", optionLabel: "username", table: true, width: 180 },
      { name: "user_role", label: "Role", required: true, optionsFrom: "roles", optionValue: "user_role", optionLabel: "role_name", table: true, width: 170 },
      { name: "role_name", label: "Role Name", table: true, width: 260 },
      { name: "company_code", label: "Company", table: true, width: 110 },
    ],
  },
  userDivisionAccess: {
    title: "User Division Access",
    subtitle: "",
    master: "user_division_access",
    routeKeys: ["user_division_access", "userdivisionaccess", "user-division-access", "division_access", "divisionaccess", "user division access", "division access", "user to division", "user division"],
    keyFields: ["user_id", "div_code"],
    createEndpoint: "userdivisionaccess",
    deleteEndpoint: "userdivisionaccess/delete",
    deletePayload: (row) => ({ screen_details: [{ user_id: row.user_id, div_code: row.div_code }] }),
    fields: [
      { name: "user_id", label: "User", required: true, optionsFrom: "sec_login", optionValue: "loginid", optionLabel: "username", table: true, width: 180 },
      { name: "div_code", label: "Division", required: true, optionsFrom: "divisions", optionValue: "div_code", optionLabel: "div_name", table: true, width: 150 },
      { name: "div_name", label: "Division Name", table: true, width: 260 },
    ],
  },
  accessAssignRole: {
    title: "Access Assign Role",
    subtitle: "Assign operation permissions to a security role for each screen.",
    master: "access_assign_role",
    routeKeys: [
      "access_assign_role",
      "accessassignrole",
      "access-assign-role",
      "access_assign_roll",
      "accessassignroll",
      "access to role",
      "accesstorole",
      "access to roll",
      "accesstoroll",
      "assign access role",
      "assignaccesstorole",
      "assign access to role",
      "assign access to roll",
    ],
    keyFields: ["role_id", "serial_no"],
    createEndpoint: "accessassignrole",
    updateEndpoint: "accessassignrole",
    deleteEndpoint: "accessassignrole/delete",
    deletePayload: (row) => ({ screen_details: [{ serial_no: row.serial_no, role_id: row.role_id }] }),
    defaults: operationDefaults(),
    fields: [
      { name: "role_id", label: "Role", required: true, type: "number", optionsFrom: "role_master", optionValue: "role_id", optionLabel: "role_desc", table: true, width: 120 },
      { name: "serial_no", label: "Screen", required: true, type: "number", optionsFrom: "serialno", optionValue: "serial_no", optionLabel: "level3", table: true, width: 120 },
      { name: "level3", label: "Screen Name", table: true, width: 260 },
      ...operationFields,
      { name: "company_code", label: "Company", table: true, width: 110 },
    ],
  },
  accessAssignUser: {
    title: "Access Assign User",
    subtitle: "Override operation permissions for a specific user and screen or role.",
    master: "access_assign_user",
    routeKeys: [
      "access_assign_user",
      "accessassignuser",
      "access-assign-user",
      "access to user",
      "accesstouser",
      "assign access user",
      "assignaccesstouser",
      "assign access to user",
    ],
    keyFields: ["loginid", "serial_no_or_role_id"],
    createEndpoint: "accessassignuser",
    updateEndpoint: "accessassignuser",
    deleteEndpoint: "accessassignuser/delete",
    deletePayload: (row) => ({ screen_details: [{ serial_no_or_role_id: row.serial_no_or_role_id, loginid: row.loginid }] }),
    defaults: operationDefaults(),
    fields: [
      { name: "loginid", label: "User", required: true, optionsFrom: "sec_login", optionValue: "loginid", optionLabel: "username", table: true, width: 180 },
      { name: "serial_no_or_role_id", label: "Screen / Role", required: true, type: "number", optionsFrom: "serialno", optionValue: "serial_no", optionLabel: "level3", table: true, width: 140 },
      { name: "level3", label: "Screen Name", table: true, width: 260 },
      ...operationFields,
      { name: "company_code", label: "Company", table: true, width: 110 },
    ],
  },
};

export function SecurityAssignmentPage({ config }: { config: SecurityAssignmentConfig }) {
  const { user } = useAuth();
  const [options, setOptions] = useState<Record<string, Record<string, unknown>[]>>({});
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedResource, setSelectedResource] = useState("");
  const [pendingItems, setPendingItems] = useState<Record<string, unknown>[]>([]);
  const [assignedItems, setAssignedItems] = useState<Record<string, unknown>[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const shape = getAssignmentShape(config);
  const userOptions = options.sec_login || [];
  const resourceOptions = options[shape.resourceMaster] || [];
  const assignedCodes = useMemo(() => new Set(assignedItems.map((item) => String(item[shape.assignmentCodeField] ?? item[shape.resourceCodeField] ?? ""))), [assignedItems, shape]);
  const pendingCodes = useMemo(() => new Set(pendingItems.map((item) => String(item[shape.resourceCodeField] ?? ""))), [pendingItems, shape]);
  const availableResources = useMemo(
    () => resourceOptions.filter((item) => {
      const code = String(item[shape.resourceCodeField] ?? "");
      return code && !assignedCodes.has(code) && !pendingCodes.has(code);
    }),
    [assignedCodes, pendingCodes, resourceOptions, shape],
  );
  const selectedUserRow = userOptions.find((item) => String(item.loginid ?? item.user_id ?? "") === selectedUser);

  const loadOptions = async () => {
    setLoading(true);
    const loaded: Record<string, Record<string, unknown>[]> = {};
    await Promise.all(["sec_login", shape.resourceMaster].map(async (master) => {
      try {
        const response = await getSecurityMaster(master, { page: 1, limit: 100000 });
        loaded[master] = response.tableData.map(normalizeRow);
      } catch {
        loaded[master] = [];
      }
    }));
    setOptions(loaded);
    setLoading(false);
  };

  const loadAssignments = async (userId = selectedUser, clearNotice = true) => {
    if (!userId) {
      setAssignedItems([]);
      return;
    }
    setAssignmentLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await getSecurityGm<Record<string, unknown>[]>(`${config.createEndpoint}/${userId}`);
      setAssignedItems((response || []).map(normalizeRow));
    } catch (error) {
      setAssignedItems([]);
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
    } finally {
      setAssignmentLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, [config.master]);

  useEffect(() => {
    setPendingItems([]);
    setSelectedResource("");
    void loadAssignments(selectedUser);
  }, [selectedUser]);

  const addPendingItem = (resourceCode: string) => {
    const item = resourceOptions.find((resource) => String(resource[shape.resourceCodeField] ?? "") === resourceCode);
    if (!item) return;
    setPendingItems((current) => [...current, item]);
    setSelectedResource("");
  };

  const saveAssignments = async () => {
    if (!selectedUser) {
      setNotice({ type: "error", message: "Select user first" });
      return;
    }
    if (!pendingItems.length) {
      setNotice({ type: "error", message: `Select at least one ${shape.resourceLabel.toLowerCase()}` });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await Promise.all(pendingItems.map((item) => saveSecurityGm(config.createEndpoint, buildAssignmentPayload(shape, selectedUser, item, user?.company_code))));
      setPendingItems([]);
      setNotice({ type: "success", message: `${config.title} saved successfully` });
      await loadAssignments(selectedUser, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to save ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setNotice(null);
    try {
      await deleteSecurityGm(config.deleteEndpoint, config.deletePayload(deleteTarget));
      setDeleteTarget(null);
      setNotice({ type: "success", message: `${config.title} deleted successfully` });
      await loadAssignments(selectedUser, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to delete ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="security-page security-assignment-page grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">{config.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => {
            void loadOptions();
            void loadAssignments();
          }}>
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card className="min-h-[640px] overflow-visible">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><UserRound size={20} /></span>
              <div>
                <p className="eyebrow">User</p>
                <h2 className="m-0 text-base font-semibold">Select Login User</h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4">
            <label className="field">
              <span>User</span>
              <SearchablePicker
                disabled={loading}
                emptyText="No users found"
                getLabel={formatUser}
                getValue={(item) => String(item.loginid ?? item.user_id ?? "")}
                options={userOptions}
                placeholder="Search user name or login id"
                value={selectedUser}
                onChange={setSelectedUser}
              />
            </label>
            {selectedUserRow && (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="font-semibold text-foreground">{String(selectedUserRow.username ?? selectedUser)}</div>
                <div className="text-xs text-muted-foreground">{selectedUser}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[640px] overflow-visible">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><Shield size={20} /></span>
                <div>
                  <p className="eyebrow">Assignment</p>
                  <h2 className="m-0 text-base font-semibold">{shape.resourceLabel} Assignment</h2>
                </div>
              </div>
              <Badge variant="secondary">{assignedItems.length} Assigned</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="field">
                <span>{shape.resourceLabel}</span>
                <SearchablePicker
                  disabled={!selectedUser || loading}
                  emptyText={`No available ${shape.resourceLabel.toLowerCase()}`}
                  getLabel={(item) => formatResource(shape, item)}
                  getValue={(item) => String(item[shape.resourceCodeField] ?? "")}
                  options={availableResources}
                  placeholder={`Search ${shape.resourceLabel.toLowerCase()} code or name`}
                  value={selectedResource}
                  onChange={addPendingItem}
                />
              </label>
              <Button className="self-end" disabled={!pendingItems.length || saving} onClick={saveAssignments}>
                <Check size={15} /> Assign Selected
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AssignmentList
                title={`Selected ${shape.resourceLabel}`}
                emptyText={`No ${shape.resourceLabel.toLowerCase()} selected`}
                items={pendingItems}
                shape={shape}
                action={(item) => (
                  <Button size="icon" variant="ghost" onClick={() => setPendingItems((current) => current.filter((entry) => String(entry[shape.resourceCodeField] ?? "") !== String(item[shape.resourceCodeField] ?? "")))}>
                    <X size={14} />
                  </Button>
                )}
              />
              <AssignmentList
                title={`Assigned ${shape.resourceLabel}`}
                emptyText={assignmentLoading ? "Loading assignments..." : `No assigned ${shape.resourceLabel.toLowerCase()}`}
                items={assignedItems}
                shape={shape}
                assigned
                action={(item) => (
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(item)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.title}`}
        description={`Revoke this ${shape.resourceLabel.toLowerCase()} from ${selectedUser}?`}
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

type AssignmentShape = {
  resourceLabel: string;
  resourceMaster: string;
  resourceCodeField: string;
  resourceNameField: string;
  assignmentCodeField: string;
  assignmentNameField: string;
};

function getAssignmentShape(config: SecurityAssignmentConfig): AssignmentShape {
  if (config.master === "user_role_access") {
    return {
      resourceLabel: "Role",
      resourceMaster: "roles",
      resourceCodeField: "user_role",
      resourceNameField: "role_name",
      assignmentCodeField: "user_role",
      assignmentNameField: "role_name",
    };
  }
  if (config.master === "user_division_access") {
    return {
      resourceLabel: "Division",
      resourceMaster: "divisions",
      resourceCodeField: "div_code",
      resourceNameField: "div_name",
      assignmentCodeField: "div_code",
      assignmentNameField: "div_name",
    };
  }
  return {
    resourceLabel: "Project",
    resourceMaster: "projects",
    resourceCodeField: "project_code",
    resourceNameField: "project_name",
    assignmentCodeField: "project_code",
    assignmentNameField: "project_name",
  };
}

function AssignmentList({
  title,
  emptyText,
  items,
  shape,
  assigned,
  action,
}: {
  title: string;
  emptyText: string;
  items: Record<string, unknown>[];
  shape: AssignmentShape;
  assigned?: boolean;
  action: (item: Record<string, unknown>) => JSX.Element;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        <Badge variant={assigned ? "default" : "secondary"}>{items.length}</Badge>
      </div>
      <div className="max-h-[360px] overflow-auto p-2">
        {items.length ? (
          <div className="grid gap-2">
            {items.map((item, index) => (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2" key={`${String(item[shape.assignmentCodeField] ?? item[shape.resourceCodeField] ?? "")}_${index}`}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{formatResource(shape, item, assigned)}</div>
                  <div className="text-xs text-muted-foreground">{String(item[assigned ? shape.assignmentCodeField : shape.resourceCodeField] ?? "")}</div>
                </div>
                {action(item)}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[160px] place-items-center rounded-md border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function SearchablePicker({
  value,
  options,
  placeholder,
  emptyText,
  disabled,
  getValue,
  getLabel,
  onChange,
}: {
  value: string;
  options: Record<string, unknown>[];
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  getValue: (item: Record<string, unknown>) => string;
  getLabel: (item: Record<string, unknown>) => string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((item) => getValue(item) === value);
  const query = search.trim().toLowerCase();
  const filtered = options
    .filter((item) => {
      if (!query) return true;
      return `${getValue(item)} ${getLabel(item)}`.toLowerCase().includes(query);
    })
    .slice(0, 80);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "min-w-0 truncate" : "min-w-0 truncate text-muted-foreground"}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
      </button>
      {open && !disabled && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-md border bg-popover shadow-xl"
          onMouseDown={(event) => event.preventDefault()}
        >
          <label className="m-2 flex h-9 items-center gap-2 rounded-md border bg-background px-2 text-muted-foreground">
            <Search size={14} />
            <Input
              autoFocus
              className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              placeholder={placeholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
              }}
            />
          </label>
          <div className="max-h-[420px] overflow-auto p-1">
            {filtered.length ? (
              filtered.map((item, index) => {
                const optionValue = getValue(item);
                const active = optionValue === value;
                return (
                  <button
                    type="button"
                    className={active ? "flex min-h-10 w-full items-center justify-between gap-2 rounded px-3 py-2.5 text-left text-sm font-semibold text-primary bg-primary/10" : "flex min-h-10 w-full items-center justify-between gap-2 rounded px-3 py-2.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"}
                    onClick={() => {
                      onChange(optionValue);
                      close();
                    }}
                    key={`${optionValue}_${index}`}
                  >
                    <span className="min-w-0 truncate">{getLabel(item)}</span>
                    {active && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildAssignmentPayload(shape: AssignmentShape, selectedUser: string, item: Record<string, unknown>, companyCode?: string) {
  const code = item[shape.resourceCodeField];
  const payload: Record<string, unknown> = { user_id: selectedUser };
  payload[shape.assignmentCodeField] = code;
  if (shape.resourceMaster === "roles") {
    payload.company_code = item.company_code || companyCode || "";
  }
  return payload;
}

function formatUser(item: Record<string, unknown>) {
  return [item.loginid || item.user_id, item.username].filter(Boolean).join(" - ");
}

function formatResource(shape: AssignmentShape, item: Record<string, unknown>, assigned = false) {
  const codeField = assigned ? shape.assignmentCodeField : shape.resourceCodeField;
  const nameField = assigned ? shape.assignmentNameField : shape.resourceNameField;
  return [item[codeField], item[nameField]].filter(Boolean).join(" - ");
}

function operationDefaults() {
  return Object.fromEntries(operationFields.map((field) => [field.name, "N"]));
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
    normalized[toSnakeCase(key)] = value;
  });
  alias(normalized, "user_id", ["userid", "userId", "USER_ID", "loginid", "LOGINID"]);
  alias(normalized, "project_code", ["projectcode", "projectCode", "PROJECT_CODE"]);
  alias(normalized, "project_name", ["projectname", "projectName", "PROJECT_NAME"]);
  alias(normalized, "user_role", ["userrole", "userRole", "USER_ROLE"]);
  alias(normalized, "role_name", ["rolename", "roleName", "ROLE_NAME"]);
  alias(normalized, "role_id", ["roleid", "roleId", "ROLE_ID"]);
  alias(normalized, "role_desc", ["roledesc", "roleDesc", "ROLE_DESC"]);
  alias(normalized, "div_code", ["divcode", "divCode", "DIV_CODE"]);
  alias(normalized, "div_name", ["divname", "divName", "DIV_NAME"]);
  alias(normalized, "serial_no", ["serialno", "serialNo", "SERIAL_NO"]);
  alias(normalized, "serial_no_or_role_id", ["serialnoorroleid", "serialNoOrRoleId", "SERIAL_NO_OR_ROLE_ID"]);
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
