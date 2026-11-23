import { Check, ChevronDown, KeyRound, RefreshCw, Save, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteSecurityGm, getSecurityGm, getSecurityGmWithParams, getSecurityMaster, saveSecurityGm } from "../../api/security";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { cn } from "../../lib/utils";
import { useAuth } from "../../state/AuthContext";

type SecurityOperationAccessPageProps = {
  mode: "role" | "user";
};

type OptionRow = Record<string, unknown>;
type PermissionRow = Record<string, unknown>;

const permissionFields = [
  { key: "snew", label: "New" },
  { key: "smodify", label: "Modify" },
  { key: "sdelete", label: "Delete" },
  { key: "ssave", label: "Save" },
  { key: "ssearch", label: "Search" },
  { key: "ssaveas", label: "Save As" },
  { key: "supload", label: "Upload" },
  { key: "sundo", label: "Undo" },
  { key: "sprint", label: "Print" },
  { key: "sprintsetup", label: "Print Setup" },
  { key: "shelp", label: "Help" },
];

export function SecurityOperationAccessPage({ mode }: SecurityOperationAccessPageProps) {
  const { user } = useAuth();
  const [principalOptions, setPrincipalOptions] = useState<OptionRow[]>([]);
  const [screenOptions, setScreenOptions] = useState<OptionRow[]>([]);
  const [selectedPrincipal, setSelectedPrincipal] = useState("");
  const [selectedApp, setSelectedApp] = useState("");
  const [selectedScreen, setSelectedScreen] = useState("");
  const [permissions, setPermissions] = useState<PermissionRow | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const permissionRequest = useRef(0);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const isRoleMode = mode === "role";
  const title = isRoleMode ? "Access To Role" : "Access To User";
  const principalLabel = isRoleMode ? "Role" : "User";
  const principalMaster = isRoleMode ? "role_master" : "sec_login";
  const endpoint = isRoleMode ? "accessassignrole" : "accessassignuser";
  const Icon = isRoleMode ? ShieldCheck : KeyRound;

  const appOptions = useMemo(
    () => Array.from(new Set(screenOptions.map((screen) => String(screen.app_code ?? "")).filter(Boolean))).sort().map((appCode) => ({ app_code: appCode })),
    [screenOptions],
  );
  const assignableScreens = useMemo(() => getAssignableScreens(screenOptions), [screenOptions]);
  const filteredScreens = useMemo(
    () => assignableScreens.filter((screen) => !selectedApp || String(screen.app_code ?? "") === selectedApp),
    [assignableScreens, selectedApp],
  );
  const selectedScreenRow = useMemo(
    () => assignableScreens.find((screen) => String(screen.serial_no ?? "") === selectedScreen.split(",")[0]),
    [assignableScreens, selectedScreen],
  );
  const selectedPrincipalRow = useMemo(
    () => principalOptions.find((option) => String(option[isRoleMode ? "role_id" : "loginid"] ?? "") === selectedPrincipal),
    [isRoleMode, principalOptions, selectedPrincipal],
  );
  const selectedScreenIds = selectedScreen.split(",").filter(Boolean);
  const canLoadPermissions = Boolean(selectedPrincipal && selectedScreen);
  const activePermissions = permissions || emptyPermissionRow();

  const loadOptions = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [principalResponse, screenResponse] = await Promise.all([
        getSecurityMaster(principalMaster, { page: 1, limit: 100000 }),
        getSecurityMaster("serialno", { page: 1, limit: 100000 }),
      ]);
      setPrincipalOptions(principalResponse.tableData.map(normalizeRow));
      setScreenOptions(screenResponse.tableData.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${title}` });
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async (clearNotice = true) => {
    const request = ++permissionRequest.current;
    if (!canLoadPermissions) {
      setPermissions(null);
      setHasExisting(false);
      return;
    }
    if (selectedScreenIds.length > 1) {
      setPermissions(emptyPermissionRow());
      setHasExisting(true);
      setPermissionLoading(false);
      setNotice({ type: "info", message: "Choose the operations to apply to every selected screen. Saving replaces their direct permissions; unavailable operations stay disabled." });
      return;
    }
    setPermissionLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const existing = await getExistingPermission(endpoint, mode, selectedPrincipal, selectedScreen);
      if (request !== permissionRequest.current) return;
      if (existing) {
        setPermissions(normalizePermission(existing));
        setHasExisting(true);
        return;
      }
      const template = await getOperationTemplate(endpoint, selectedScreen);
      if (request !== permissionRequest.current) return;
      setPermissions(normalizePermission(template?.[0] || emptyPermissionRow()));
      setHasExisting(false);
      setNotice({ type: "info", message: "No existing access found. Review the default screen operations and save to assign access." });
    } catch (error) {
      if (request !== permissionRequest.current) return;
      setPermissions(emptyPermissionRow());
      setHasExisting(false);
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load operation access" });
    } finally {
      if (request === permissionRequest.current) setPermissionLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, [mode]);

  useEffect(() => {
    setSelectedScreen("");
    setPermissions(null);
    setHasExisting(false);
  }, [selectedApp]);

  useEffect(() => {
    void loadPermissions();
  }, [selectedPrincipal, selectedScreen]);

  const togglePermission = (key: string) => {
    setPermissions((current) => {
      const next = normalizePermission(current || emptyPermissionRow());
      if (String(next[key] ?? "N").toUpperCase() === "NA") return next;
      return { ...next, [key]: String(next[key] ?? "N").toUpperCase() === "Y" ? "N" : "Y" };
    });
  };

  const saveAccess = async () => {
    if (!canLoadPermissions || !permissions) {
      setNotice({ type: "error", message: `Select ${principalLabel.toLowerCase()} and screen first` });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      let completed = 0;
      try {
        for (const serial of selectedScreenIds) {
          const row = assignableScreens.find((screen) => String(screen.serial_no) === serial);
          const template = await getOperationTemplate(endpoint, serial);
          const supported = normalizePermission(template?.[0] || emptyPermissionRow());
          const values = { ...activePermissions };
          for (const field of permissionFields)
            if (String(supported[field.key]).toUpperCase() === "NA") values[field.key] = "NA";
          const payload = buildPayload(mode, selectedPrincipal, serial, values, row, user?.company_code);
          await saveSecurityGm(endpoint, payload, selectedScreenIds.length > 1 ? "post" : hasExisting ? "put" : "post");
          completed++;
        }
      } catch (error) {
        throw new Error(`Saved ${completed} of ${selectedScreenIds.length} screens. ${error instanceof Error ? error.message : "Please retry the remaining screens."}`);
      }
      setHasExisting(true);
      await loadPermissions(false);
      setNotice({ type: "success", message: `Access saved for ${selectedScreenIds.length} screen(s)` });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to save ${title}` });
    } finally {
      setSaving(false);
    }
  };

  const deleteAccess = async () => {
    if (!canLoadPermissions || !hasExisting) return;
    setSaving(true);
    setNotice(null);
    try {
      if (!window.confirm(`Remove direct access to ${selectedScreenIds.length} selected screen(s)? Role permissions are managed separately.`)) return;
      await deleteSecurityGm(`${endpoint}/delete`, { screen_details: selectedScreenIds.map((serial) => buildDeletePayload(mode, selectedPrincipal, serial).screen_details[0]) });
      setHasExisting(false);
      setPermissions(emptyPermissionRow());
      setNotice({ type: "success", message: `${title} deleted successfully` });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to delete ${title}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="security-page security-access-page grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1>
        </div>
        <Button variant="outline" onClick={() => loadOptions()}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <Card className="overflow-visible">
        <CardHeader className="border-b bg-muted/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon size={20} />
              </span>
              <div>
                <h2 className="m-0 text-base font-semibold">Choose {principalLabel.toLowerCase()} and {isRoleMode ? "screen" : "screens"}</h2>
              </div>
            </div>
            <Badge variant={hasExisting ? "default" : "secondary"}>{selectedScreenIds.length > 1 ? `${selectedScreenIds.length} screens selected` : hasExisting ? "Existing Access" : "New Assignment"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
          <label className="field">
            <span>{principalLabel}</span>
            <SearchablePicker
              disabled={loading || saving}
              emptyText={`No ${principalLabel.toLowerCase()} found`}
              getLabel={(option) => formatPrincipal(option, isRoleMode)}
              getValue={(option) => String(option[isRoleMode ? "role_id" : "loginid"] ?? "")}
              options={principalOptions}
              placeholder={`Search ${principalLabel.toLowerCase()}`}
              value={selectedPrincipal}
              onChange={setSelectedPrincipal}
            />
          </label>
          <label className="field">
            <span>Application</span>
            <SearchablePicker
              disabled={loading || saving}
              emptyText="No application found"
              getLabel={(option) => String(option.app_code ?? "")}
              getValue={(option) => String(option.app_code ?? "")}
              options={appOptions}
              placeholder="All applications"
              value={selectedApp}
              onChange={setSelectedApp}
              allowClear
            />
          </label>
          <label className="field">
            <span>{isRoleMode ? "Screen" : "Screens · select one or more"}</span>
            <SearchablePicker
              disabled={loading || saving || !filteredScreens.length}
              emptyText="No screen found"
              getLabel={formatScreen}
              getValue={(screen) => String(screen.serial_no ?? "")}
              options={filteredScreens}
              placeholder="Search screen"
              multiple={!isRoleMode}
              value={selectedScreen}
              onChange={setSelectedScreen}
            />
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div>
              <h2 className="m-0 text-base font-semibold">Permission Matrix</h2>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {!canLoadPermissions ? (
              <div className="grid min-h-[250px] place-items-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
                Select {principalLabel.toLowerCase()} and screen to load permissions.
              </div>
            ) : permissionLoading ? (
              <div className="grid min-h-[250px] place-items-center rounded-md border bg-muted/20 text-sm text-muted-foreground">Loading permissions...</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {permissionFields.map((field) => {
                  const value = String(activePermissions[field.key] ?? "N").toUpperCase();
                  const disabled = value === "NA";
                  const enabled = value === "Y";
                  return (
                    <button
                      type="button"
                      disabled={disabled || saving}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors",
                        enabled && "border-primary bg-primary/10 text-primary",
                        disabled && "cursor-not-allowed bg-muted/40 text-muted-foreground",
                        !enabled && !disabled && "bg-background hover:bg-accent",
                      )}
                      onClick={() => togglePermission(field.key)}
                      key={field.key}
                    >
                      <span className="text-sm font-semibold">{field.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", enabled ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                        {disabled ? "N/A" : enabled ? "Yes" : "No"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <div>
              <h2 className="m-0 text-base font-semibold">Selected Access</h2>
            </div>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-3 text-sm">
            <SummaryRow label={principalLabel} value={selectedPrincipalRow ? formatPrincipal(selectedPrincipalRow, isRoleMode) : "Not selected"} />
            <SummaryRow label="App" value={selectedApp || String(selectedScreenRow?.app_code ?? "All")} />
            <SummaryRow label="Screen" value={selectedScreenIds.length > 1 ? `${selectedScreenIds.length} screens selected` : selectedScreenRow ? getScreenName(selectedScreenRow) : "Not selected"} />
            <SummaryRow label="Company" value={String(selectedScreenRow?.company_code || user?.company_code || "")} />
            <div className="mt-2 grid gap-2">
              <Button className="w-full justify-center" disabled={!canLoadPermissions || saving || permissionLoading} onClick={saveAccess}>
                <Save size={15} /> {saving ? "Saving..." : selectedScreenIds.length > 1 ? `Save ${selectedScreenIds.length} screens` : "Save Access"}
              </Button>
              <Button className="w-full justify-center" disabled={!hasExisting || saving} variant="destructive" onClick={deleteAccess}>
                <Trash2 size={15} /> Remove direct access
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

async function getExistingPermission(endpoint: string, mode: "role" | "user", selectedPrincipal: string, selectedScreen: string) {
  try {
    const params = mode === "role"
      ? { role_id: Number(selectedPrincipal), serial_no: Number(selectedScreen) }
      : { loginid: selectedPrincipal, serial_no_or_role_id: Number(selectedScreen) };
    const result = await getSecurityGmWithParams<PermissionRow | null>(endpoint, params);
    return result ? normalizePermission(result) : null;
  } catch {
    return null;
  }
}

async function getOperationTemplate(endpoint: string, selectedScreen: string) {
  try {
    return await getSecurityGm<PermissionRow[]>(`${endpoint}/${selectedScreen}`);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unable to load screen operations. Please retry.");
  }
}

function buildPayload(mode: "role" | "user", selectedPrincipal: string, selectedScreen: string, permissions: PermissionRow, screen: OptionRow | undefined, userCompany?: string) {
  const permissionValues = Object.fromEntries(permissionFields.map((field) => [field.key, String(permissions[field.key] ?? "N").toUpperCase()]));
  const companyCode = String(userCompany || permissions.company_code || screen?.company_code || "");
  if (mode === "role") {
    return {
      role_id: Number(selectedPrincipal),
      serial_no: Number(selectedScreen),
      ...permissionValues,
      company_code: companyCode,
    };
  }
  return {
    loginid: selectedPrincipal,
    serial_no_or_role_id: Number(selectedScreen),
    ...permissionValues,
    company_code: companyCode,
  };
}

function buildDeletePayload(mode: "role" | "user", selectedPrincipal: string, selectedScreen: string) {
  if (mode === "role") {
    return { screen_details: [{ role_id: Number(selectedPrincipal), serial_no: Number(selectedScreen) }] };
  }
  return { screen_details: [{ loginid: selectedPrincipal, serial_no_or_role_id: Number(selectedScreen) }] };
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 p-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-[13px] font-semibold leading-snug text-foreground" title={value}>{value}</div>
    </div>
  );
}

function SearchablePicker({
  value,
  options,
  placeholder,
  emptyText,
  disabled,
  allowClear,
  multiple,
  getValue,
  getLabel,
  onChange,
}: {
  value: string;
  options: OptionRow[];
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  allowClear?: boolean;
  multiple?: boolean;
  getValue: (item: OptionRow) => string;
  getLabel: (item: OptionRow) => string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerId = useRef(`picker-${Math.random().toString(36).slice(2)}`);
  const selected = options.find((item) => getValue(item) === value);
  const query = search.trim().toLowerCase();
  const matches = options
    .filter((item) => {
      if (!query) return true;
      return `${getValue(item)} ${getLabel(item)}`.toLowerCase().includes(query);
    });
  const filtered = matches.slice(0, 100);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const openPicker = () => {
    window.dispatchEvent(new CustomEvent("bayanat-picker-open", { detail: pickerId.current }));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePickerOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== pickerId.current) close();
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("bayanat-picker-open", handlePickerOpen);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("bayanat-picker-open", handlePickerOpen);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => open ? close() : openPicker()}
      >
        <span className={selected ? "min-w-0 truncate" : "min-w-0 truncate text-muted-foreground"}>
          {multiple && value ? `${value.split(",").length} screens selected` : selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
      </button>
      {open && !disabled && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1000] overflow-hidden rounded-md border border-border bg-white text-foreground shadow-2xl ring-1 ring-slate-950/10 dark:bg-slate-950"
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
          {multiple && <div className="flex flex-wrap gap-2 border-b px-3 py-2">
            <button type="button" className="text-sm font-semibold text-primary" onClick={() => onChange(Array.from(new Set([...value.split(",").filter(Boolean), ...matches.map(getValue)])).join(","))}>Select all matching ({matches.length})</button>
            <button type="button" className="text-sm text-muted-foreground" onClick={() => onChange("")}>Clear selection</button>
            <button type="button" className="ml-auto text-sm font-semibold text-primary" onClick={close}>Done</button>
          </div>}
          <div className="max-h-64 overflow-auto p-1" role="listbox" aria-multiselectable={multiple || undefined} aria-label={placeholder}>
            {allowClear && (
              <button
                type="button"
                className={!value ? "flex min-h-8 w-full items-center justify-between gap-2 rounded bg-primary/10 px-3 py-1.5 text-left text-sm font-semibold text-primary" : "flex min-h-8 w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"}
                onClick={() => {
                  onChange("");
                  close();
                }}
              >
                <span>{placeholder}</span>
                {!value && <Check size={14} />}
              </button>
            )}
            {filtered.length ? (
              filtered.map((item, index) => {
                const optionValue = getValue(item);
                const active = multiple ? value.split(",").includes(optionValue) : optionValue === value;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? "flex min-h-8 w-full items-center justify-between gap-2 rounded bg-primary/10 px-3 py-1.5 text-left text-sm font-semibold text-primary" : "flex min-h-8 w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"}
                    onClick={() => {
                      if (multiple) {
                        const ids = value.split(",").filter(Boolean);
                        onChange((active ? ids.filter((id) => id !== optionValue) : [...ids, optionValue]).join(","));
                      } else { onChange(optionValue); close(); }
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

function emptyPermissionRow() {
  return Object.fromEntries(permissionFields.map((field) => [field.key, "Y"]));
}

function normalizePermission(row: PermissionRow) {
  const normalized = normalizeRow(row);
  return {
    ...emptyPermissionRow(),
    ...normalized,
    ...Object.fromEntries(permissionFields.map((field) => [field.key, normalizePermissionValue(normalized[field.key])])),
  };
}

function normalizePermissionValue(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();
  return normalized === "Y" || normalized === "N" || normalized === "NA" ? normalized : "Y";
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...row };
  Object.entries(row).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
    normalized[toSnakeCase(key)] = value;
  });
  alias(normalized, "role_id", ["roleid", "roleId", "ROLE_ID"]);
  alias(normalized, "role_desc", ["roledesc", "roleDesc", "ROLE_DESC"]);
  alias(normalized, "loginid", ["loginId", "LOGINID", "user_id", "USER_ID"]);
  alias(normalized, "username", ["userName", "USERNAME"]);
  alias(normalized, "serial_no", ["serialno", "serialNo", "SERIAL_NO"]);
  alias(normalized, "serial_no_or_role_id", ["serialnoorroleid", "serialNoOrRoleId", "SERIAL_NO_OR_ROLE_ID"]);
  alias(normalized, "app_code", ["appcode", "appCode", "APP_CODE"]);
  alias(normalized, "level1", ["LEVEL1"]);
  alias(normalized, "level2", ["LEVEL2"]);
  alias(normalized, "level3", ["LEVEL3"]);
  alias(normalized, "company_code", ["companycode", "companyCode", "COMPANY_CODE"]);
  normalized.level1 = cleanMenuLevel(normalized.level1);
  normalized.level2 = cleanMenuLevel(normalized.level2);
  normalized.level3 = cleanMenuLevel(normalized.level3);
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

function formatPrincipal(row: OptionRow, isRoleMode: boolean) {
  if (isRoleMode) {
    return [row.role_id, row.role_desc].filter(Boolean).join(" - ");
  }
  return [row.loginid, row.username].filter(Boolean).join(" - ");
}

function formatScreen(row: OptionRow) {
  return [row.serial_no, getScreenName(row)].filter(Boolean).join(" - ");
}

function getAssignableScreens(rows: OptionRow[]) {
  const level3Parents = new Set(
    rows
      .filter((row) => hasText(row.level3))
      .map((row) => menuLevelKey(row.app_code, row.level1, row.level2)),
  );
  const level2Parents = new Set(
    rows
      .filter((row) => hasText(row.level2))
      .map((row) => menuLevelKey(row.app_code, row.level1)),
  );
  const bySerial = new Map<string, OptionRow>();

  rows.forEach((row) => {
    const serialNo = String(row.serial_no ?? "").trim();
    if (!serialNo) return;

    const hasLevel3 = hasText(row.level3);
    const isLeafLevel2 = hasText(row.level2) && !hasLevel3 && !level3Parents.has(menuLevelKey(row.app_code, row.level1, row.level2));
    const isLeafLevel1 = hasText(row.level1) && !hasText(row.level2) && !hasLevel3 && !level2Parents.has(menuLevelKey(row.app_code, row.level1));
    if (hasLevel3 || isLeafLevel2 || isLeafLevel1) {
      bySerial.set(serialNo, row);
    }
  });

  return Array.from(bySerial.values()).sort((left, right) => {
    const leftSerial = Number(left.serial_no);
    const rightSerial = Number(right.serial_no);
    if (Number.isFinite(leftSerial) && Number.isFinite(rightSerial)) return leftSerial - rightSerial;
    return String(left.serial_no ?? "").localeCompare(String(right.serial_no ?? ""));
  });
}

function hasText(value: unknown) {
  return cleanMenuLevel(value).length > 0;
}

function cleanMenuLevel(value: unknown) {
  const text = String(value ?? "").trim();
  return text.toUpperCase() === "NULL" ? "" : text;
}

function getScreenName(row: OptionRow) {
  return cleanMenuLevel(row.level3) || cleanMenuLevel(row.level2) || cleanMenuLevel(row.level1) || String(row.serial_no ?? "").trim();
}

function menuLevelKey(...parts: unknown[]) {
  return parts.map((part) => String(part ?? "").trim().toLowerCase()).join("||");
}
