import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  LayoutGrid,
  History,
  KeyRound,
  CheckCircle2,
  SlidersHorizontal,
  Globe2,
} from "lucide-react";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import { Button } from "../../components/ui/Button";
import { PlatformPasswordInput } from "./PlatformPasswordInput";
import { LookupField } from "../../components/ui/LookupField";
import {
  primaryFields,
  resourceHints,
  friendlyLabels,
} from "./platformForm.config";
import "./platform-admin.css";

type Row = Record<string, any>;
type Column = {
  name: string;
  type: string;
  required: boolean;
  secret: boolean;
  readonly: boolean;
  maxLength?: number;
  generated?: boolean;
};
type Catalog = {
  owner: string;
  companies: Row[];
  tables: { name: string; label: string; readonly?: boolean }[];
};
type Records = { columns: Column[]; rows: Row[]; count: number };
const label = (name: string) =>
  friendlyLabels[name] ||
  {
    SEC_ROLE_FUNCTION_ACCESS_USER: "User screen / role access",
    SERIAL_NO_OR_ROLE_ID: "Screen serial / role ID",
    USERPASS: "Password",
    SNEW: "Create",
    SMODIFY: "Modify",
    SDELETE: "Delete",
    SSAVE: "Save",
    SSEARCH: "Search",
    SSAVEAS: "Save as",
    SUPLOAD: "Upload",
    SUNDO: "Undo",
    SPRINT: "Print",
    SPRINTSETUP: "Print setup",
    SHELP: "Help",
  }[name] ||
  name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const errorText = (e: any) =>
  e?.response?.data?.message || e.message || "Unable to complete the request";
async function request(path: string, method = "get", data?: unknown) {
  const response = await api.request({
    url: `/api/security/platform${path}`,
    method,
    data,
  });
  if (!response.data.success) throw new Error(response.data.message);
  return response.data.data;
}

export function PlatformAdminPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Row[]>([]);
  const [tenant, setTenant] = useState("root");
  const [company, setCompany] = useState("");
  const [catalog, setCatalog] = useState<Catalog>({
    owner: "CUSTOMERS",
    companies: [],
    tables: [],
  });
  const [table, setTable] = useState("");
  const [mode, setMode] = useState("records");
  const [records, setRecords] = useState<Records>({
    columns: [],
    rows: [],
    count: 0,
  });
  const [screens, setScreens] = useState<Row[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [access, setAccess] = useState<{
    users: Row[];
    screens: Row[];
    access: Row[];
    inherited?: Row[];
  }>({ users: [], screens: [], access: [] });
  const [loginid, setLoginid] = useState("");
  const [module, setModule] = useState("");
  const [newUser, setNewUser] = useState(false);
  const [userDraft, setUserDraft] = useState({
    loginid: "",
    username: "",
    email: "",
    password: "",
  });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row>({});
  const [deleting, setDeleting] = useState(false);
  const [version, setVersion] = useState(0);
  const [fieldOptions, setFieldOptions] = useState<
    Record<string, { value: string; label: string }[]>
  >({});
  const [optionsLoading, setOptionsLoading] = useState(false);
  const pendingCompany = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const allowed = user?.isPlatformAdmin === true;
  const scope = `/${encodeURIComponent(tenant)}`;
  const params = `?company=${encodeURIComponent(company)}&page=${page}&search=${encodeURIComponent(search)}`;

  useEffect(() => {
    if (!allowed) return;
    request("/tenants")
      .then(setTenants)
      .catch((e) => setError(errorText(e)));
  }, [allowed]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    setError("");
    setEditor(null);
    setNewUser(false);
    setFieldOptions({});
    pendingCompany.current = false;
    setLoginid("");
    setCompany("");
    setTable("");
    setMode("records");
    setPage(1);
    setRecords({ columns: [], rows: [], count: 0 });
    request(`${scope}/catalog`)
      .then((data: Catalog) => {
        if (active) {
          setCatalog(data);
          setCompany(data.companies[0]?.COMPANY_CODE || "");
          setTable(data.tables[0]?.name || "");
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant, allowed]);
  useEffect(() => {
    if (
      !allowed ||
      (mode === "records" && !table) ||
      ((mode === "screens" || mode === "access") && !company)
    )
      return;
    let active = true;
    setLoading(true);
    setError("");
    setEditor(null);
    const path =
      mode === "audit"
        ? "/audit"
        : mode === "access"
          ? `${scope}/access${params}&loginid=${encodeURIComponent(loginid)}`
          : mode === "screens"
            ? `${scope}/screens${params}`
            : `${scope}/records/${table}${params}`;
    request(path)
      .then((data) => {
        if (active) {
          if (mode === "screens") setScreens(data);
          else if (mode === "access") setAccess(data);
          else if (mode === "audit") setAudit(data);
          else {
            setRecords(data);
            if (pendingCompany.current && table === "MS_COMPANY") {
              pendingCompany.current = false;
              openEditor({}, data.columns);
            }
          }
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant, company, table, mode, page, search, version, allowed, loginid]);
  useEffect(() => {
    if (!allowed || !editor || deleting) return;
    let active = true;
    setOptionsLoading(true);
    request(`${scope}/options?company=${encodeURIComponent(company)}`)
      .then((data) => {
        if (active) setFieldOptions(data);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant, company, Boolean(editor), deleting, allowed]);
  useEffect(() => {
    if (editor) editorHeading.current?.focus();
  }, [editor]);

  if (!allowed)
    return (
      <section className="platform-console">
        <h1>Super Admin Console</h1>
        <p role="alert">Platform Super Admin access is required.</p>
      </section>
    );
  const title =
    mode === "access"
      ? "User screen access"
      : mode === "screens"
        ? "Company screen availability"
        : mode === "audit"
          ? "Activity log"
          : catalog.tables.find((t) => t.name === table)?.label ||
            "Security records";
  const openEditor = (row: Row, columns = records.columns) => {
    setEditor(row);
    setDeleting(false);
    setError("");
    setNotice("");
    const initial: Row = {};
    for (const c of columns.filter(
      (c) => !c.readonly && !c.secret && !c.generated,
    )) {
      if (row._rowid) initial[c.name] = row[c.name] ?? "";
      else if (c.name === "COMPANY_CODE")
        initial[c.name] = table === "MS_COMPANY" ? "" : company;
      else if (c.name === "ACTIVE_FLAG" || c.name === "IS_ACTIVE")
        initial[c.name] = "Y";
      else if (
        /^S(NEW|MODIFY|DELETE|SAVE|SEARCH|SAVEAS|UPLOAD|UNDO|PRINT|PRINTSETUP|HELP)$/.test(
          c.name,
        )
      )
        initial[c.name] = "Y";
    }
    setDraft(initial);
  };
  const startNewCompany = () => {
    setEditor(null);
    setNewUser(false);
    setError("");
    setNotice("");
    setSearch("");
    setQuery("");
    setPage(1);
    if (table === "MS_COMPANY" && mode === "records" && !loading) {
      openEditor({});
      return;
    }
    pendingCompany.current = true;
    setMode("records");
    setTable("MS_COMPANY");
    setVersion((v) => v + 1);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const values = Object.fromEntries(
        Object.entries(draft).filter(
          ([k, v]) =>
            !(records.columns.find((c) => c.name === k)?.secret && !v),
        ),
      );
      await request(
        `${scope}/records/${table}${params}`,
        deleting ? "delete" : "post",
        { rowid: editor?._rowid, values: deleting ? {} : values },
      );
      const creatingCompany =
        table === "MS_COMPANY" && !editor?._rowid && !deleting;
      if (table === "MS_COMPANY") {
        const nextCatalog: Catalog = await request(`${scope}/catalog`);
        setCatalog(nextCatalog);
        setCompany(
          deleting
            ? nextCatalog.companies[0]?.COMPANY_CODE || ""
            : String(values.COMPANY_CODE || company),
        );
      }
      if (tenant === "root" && table === "TENANT_REGISTRY")
        setTenants(await request("/tenants"));
      setEditor(null);
      setVersion((v) => v + 1);
      setNotice(
        creatingCompany
          ? `${values.COMPANY_NAME || values.COMPANY_CODE} was created and is now selected.`
          : deleting
            ? "Record deleted."
            : "Changes saved.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  const toggleScreen = async (screen: Row) => {
    setSaving(true);
    setError("");
    try {
      await request(`${scope}/screens${params}`, "put", {
        serialNo: Number(screen.SERIAL_NO),
        enabled: !screen.enabled,
      });
      setScreens((rows) =>
        rows.map((r) =>
          r.SERIAL_NO === screen.SERIAL_NO
            ? { ...r, enabled: !screen.enabled }
            : r,
        ),
      );
      setNotice("Company screen availability updated.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  const visible = records.columns.filter(
    (c) =>
      !c.secret &&
      !c.readonly &&
      (primaryFields[table]?.includes(c.name) || !primaryFields[table]),
  );
  const formColumns = records.columns.filter(
    (c) =>
      !c.readonly &&
      !c.generated &&
      !["SEC_PASSWD", "PASSWORD"].includes(c.name),
  );
  const mainFields = formColumns.filter(
    (c) =>
      c.required ||
      primaryFields[table]?.includes(c.name) ||
      (!primaryFields[table] && formColumns.indexOf(c) < 8),
  );
  const advancedFields = formColumns.filter((c) => !mainFields.includes(c));
  const readOnly =
    catalog.tables.find((t) => t.name === table)?.readonly === true;
  const scoped = user?.platformAccess?.scope === "SCOPED";
  const renderField = (c: Column) => {
    const InputControl = c.secret ? PlatformPasswordInput : "input";
    const locked =
      (["SEC_LOGIN", "SEC_LOGINTEST"].includes(table) &&
        c.name === "LOGINID" &&
        Boolean(editor?._rowid)) ||
      (c.name === "COMPANY_CODE" &&
        tenant !== "root" &&
        !(table === "MS_COMPANY" && !editor?._rowid));
    const optionsKey =
      c.name === "ROLE_ID" && table === "MS_PS_USER_ROLE_MAPPING"
        ? "PROJECT_ROLE_ID"
        : c.name;
    const choices = fieldOptions[optionsKey] || [];
    const isReference =
      [
        "COMPANY_CODE",
        "LOGINID",
        "USER_ID",
        "ROLE_ID",
        "PROJECT_CODE",
        "DIV_CODE",
        "FLOW_CODE",
        "CURR_CODE",
        "COUNTRY",
        "COUNTRY_CODE",
        "TENANT_ID",
        "SERIAL_NO_OR_ROLE_ID",
        "SERIAL_NO",
      ].includes(c.name) &&
      !(table === "MS_COMPANY" && c.name === "COMPANY_CODE") &&
      !(
        ["SEC_LOGIN", "SEC_LOGINTEST"].includes(table) &&
        ["LOGINID", "USER_ID"].includes(c.name)
      ) &&
      !(table === "SEC_ROLE_MASTER" && c.name === "ROLE_ID") &&
      !(table === "SEC_MODULE_DATA" && c.name === "SERIAL_NO") &&
      !(table === "TENANT_REGISTRY" && c.name === "TENANT_ID");
    if (isReference && choices.length)
      return (
        <LookupField
          key={c.name}
          label={label(c.name)}
          required={c.required}
          enforceRequired={c.required}
          value={String(draft[c.name] ?? "")}
          displayValue={
            choices.find((o) => o.value === String(draft[c.name]))?.label ||
            String(draft[c.name] || "")
          }
          columns={[{ field: "label", header: label(c.name) }]}
          valueField="value"
          displayFields={["label"]}
          loadOptions={async (q) =>
            choices.filter((o) =>
              o.label.toLowerCase().includes((q || "").toLowerCase()),
            )
          }
          onChange={(value) => setDraft((d) => ({ ...d, [c.name]: value }))}
          disabled={locked || saving}
          placeholder={`Choose ${label(c.name).toLowerCase()}`}
        />
      );
    const yesNo =
      /^S(NEW|MODIFY|DELETE|SAVE|SEARCH|SAVEAS|UPLOAD|UNDO|PRINT|PRINTSETUP|HELP)$/.test(
        c.name,
      ) ||
      ["ACTIVE_FLAG", "IS_ACTIVE", "IS_DEFAULT", "TAX_INCLUDED"].includes(
        c.name,
      );
    return (
      <label
        key={c.name}
        className={
          /ADDRESS|REMARKS|DESCRIPTION/.test(c.name)
            ? "platform-field-wide"
            : undefined
        }
      >
        <span>
          {label(c.name)}
          {c.required && <b className="platform-required"> *</b>}
        </span>
        {c.name === "STATUS" ? (
          <select
            value={draft[c.name] ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, [c.name]: e.target.value }))
            }
          >
            <option value="">Choose status</option>
            <option value="A">Active</option>
            <option value="I">Inactive</option>
            {draft[c.name] && !["A", "I"].includes(draft[c.name]) && (
              <option value={draft[c.name]}>{draft[c.name]} (current)</option>
            )}
          </select>
        ) : yesNo ? (
          <select
            required={c.required}
            value={draft[c.name] ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, [c.name]: e.target.value }))
            }
          >
            <option value="">Choose</option>
            <option value="Y">Yes</option>
            <option value="N">No</option>
          </select>
        ) : (
          <InputControl
            type={
              c.secret
                ? "password"
                : /NUMBER|FLOAT/.test(c.type)
                  ? "number"
                  : /DATE|TIMESTAMP/.test(c.type)
                    ? "datetime-local"
                    : /EMAIL/.test(c.name)
                      ? "email"
                      : "text"
            }
            required={
              c.required ||
              (c.name === "COMPANY_CODE" && table === "MS_COMPANY") ||
              (c.name === "COMPANY_NAME" && table === "MS_COMPANY")
            }
            maxLength={c.maxLength}
            step="any"
            value={
              /DATE|TIMESTAMP/.test(c.type)
                ? String(draft[c.name] || "").slice(0, 16)
                : (draft[c.name] ?? "")
            }
            disabled={locked || saving}
            autoComplete={c.secret ? "new-password" : "off"}
            placeholder={
              c.secret && editor?._rowid
                ? "Leave blank to keep current value"
                : `Enter ${label(c.name).toLowerCase()}`
            }
            onChange={(e) =>
              setDraft((d) => ({ ...d, [c.name]: e.target.value }))
            }
          />
        )}
        {locked && (
          <small>
            {c.name === "COMPANY_CODE"
              ? "Uses the selected company"
              : "Login IDs stay fixed to preserve user mappings"}
          </small>
        )}
      </label>
    );
  };
  const filteredScreens = screens.filter((s) =>
    `${s.APP_CODE} ${s.LEVEL1} ${s.LEVEL2} ${s.LEVEL3} ${s.SERIAL_NO}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const accessScreens = access.screens.filter(
    (s) =>
      (!module || s.APP_CODE === module) &&
      `${s.APP_CODE} ${s.LEVEL1} ${s.LEVEL2} ${s.LEVEL3} ${s.SERIAL_NO}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const grant = async (serials: number[], enabled: boolean) => {
    setSaving(true);
    setError("");
    try {
      await request(`${scope}/access${params}`, "put", {
        loginid,
        serials,
        enabled,
      });
      setNotice(`${enabled ? "Granted" : "Removed"} access for ${serials.length} screen${serials.length === 1 ? "" : "s"}.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  const provision = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(`${scope}/users${params}`, "post", userDraft);
      setNotice(
        `User ${userDraft.loginid} was created with a central sign-in account and linked to ${company}. Assign screens below to finish access setup.`,
      );
      setNewUser(false);
      setUserDraft({ loginid: "", username: "", email: "", password: "" });
      setLoginid(userDraft.loginid);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      className="platform-console"
      aria-label="Platform security administration"
    >
      <header className="platform-heading">
        <div>
          <h1>
            <ShieldCheck aria-hidden="true" size={24} />
            Super Admin Console
          </h1>
          <p>
            {scoped
              ? "Manage central QA accounts and the WMSTST test environment."
              : "Manage companies, people and permissions from one secure workspace."}
          </p>
        </div>
        <span className="platform-account-badge">
          <CheckCircle2 size={14} />
          {scoped ? "QA · CUSTOMERS + WMSTST" : "Production · All tenants"}
        </span>
        <Button
          variant="outline"
          onClick={() => setVersion((v) => v + 1)}
          disabled={loading || saving}
        >
          <RefreshCw size={15} />
          Refresh
        </Button>
      </header>
      <div className="platform-scope">
        <label>
          Tenant
          <select
            value={tenant}
            disabled={saving}
            onChange={(e) => {
              setTenant(e.target.value);
              setQuery("");
              setSearch("");
            }}
          >
            <option value="root">CUSTOMERS — Central administration</option>
            {tenants.map((t) => (
              <option key={t.TENANT_ID} value={t.TENANT_ID}>
                {t.TENANT_NAME} · {t.SCHEMA_NAME}
                {t.IS_ACTIVE !== "Y" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        {tenant !== "root" && (
          <LookupField
            label="Company"
            value={company}
            displayValue={
              catalog.companies.find((c) => c.COMPANY_CODE === company)
                ?.COMPANY_NAME
                ? `${company} · ${catalog.companies.find((c) => c.COMPANY_CODE === company)?.COMPANY_NAME}`
                : company
            }
            columns={[{ field: "label", header: "Company" }]}
            valueField="value"
            displayFields={["label"]}
            disabled={saving || loading}
            loadOptions={async (q) => [
              { value: "__new_company__", label: "Create a new company…" },
              ...catalog.companies
                .map((c) => ({
                  value: c.COMPANY_CODE,
                  label: `${c.COMPANY_CODE} · ${c.COMPANY_NAME}`,
                }))
                .filter((c) =>
                  c.label.toLowerCase().includes((q || "").toLowerCase()),
                ),
            ]}
            onChange={(value) => {
              if (value === "__new_company__") {
                startNewCompany();
                return;
              }
              setCompany(value);
              setLoginid("");
              setNewUser(false);
              setPage(1);
            }}
            placeholder="Choose a company"
          />
        )}
        {tenant !== "root" && (
          <Button
            variant="outline"
            onClick={startNewCompany}
            disabled={saving || loading}
          >
            <Building2 size={16} />
            New company
          </Button>
        )}
        <div className="platform-scope-note">
          <strong>{catalog.owner}</strong>
          <span>
            {tenant === "root"
              ? "Central users, tenants and mappings"
              : "Changes apply to the selected tenant and company"}
          </span>
        </div>
      </div>
      <nav className="platform-tabs" aria-label="Administration views">
        <button
          aria-current={mode === "records" ? "page" : undefined}
          disabled={saving}
          onClick={() => setMode("records")}
        >
          <LayoutGrid size={16} />
          Security records
        </button>
        {tenant !== "root" && (
          <>
            <button
              aria-current={mode === "access" ? "page" : undefined}
              disabled={saving}
              onClick={() => setMode("access")}
            >
              <Users size={16} />
              Users & access
            </button>
            <button
              aria-current={mode === "screens" ? "page" : undefined}
              disabled={saving}
              onClick={() => setMode("screens")}
            >
              <KeyRound size={16} />
              Company screens
            </button>
          </>
        )}
        <button
          aria-current={mode === "audit" ? "page" : undefined}
          disabled={saving}
          onClick={() => setMode("audit")}
        >
          <History size={16} />
          Activity log
        </button>
      </nav>
      {error && (
        <p className="platform-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="platform-notice" role="status">
          {notice}
        </p>
      )}
      <div className="platform-toolbar">
        <h2>{title}</h2>
        {mode === "records" && (
          <label className="platform-resource">
            <span className="sr-only">Security resource</span>
            <select
              value={table}
              disabled={saving || loading}
              onChange={(e) => {
                setTable(e.target.value);
                setPage(1);
                setQuery("");
                setSearch("");
              }}
            >
              {catalog.tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode !== "audit" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query);
              setPage(1);
            }}
            className="platform-search"
          >
            <label>
              <span className="sr-only">Search {title}</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records"
              />
            </label>
            <Button type="submit" variant="outline" aria-label="Search">
              <Search size={16} />
            </Button>
          </form>
        )}
        {mode === "records" && !readOnly && (
          <Button
            disabled={loading || saving || !table}
            onClick={() => {
              if (table === "MS_COMPANY") {
                startNewCompany();
                return;
              }
              if (table === "SEC_LOGIN") {
                setMode("access");
                setNewUser(true);
                return;
              }
              if (table === "SEC_LOGINTEST" && scoped) {
                setTenant("WMSTST_TENANT");
                return;
              }
              openEditor({});
            }}
          >
            <Plus size={16} />
            {table === "MS_COMPANY"
              ? "New company"
              : table === "SEC_ROLE_MASTER"
                ? "New role"
                : table === "SEC_LOGIN" || table === "SEC_LOGINTEST"
                  ? "Create user"
                  : "Add record"}
          </Button>
        )}
      </div>
      {mode === "records" && (
        <p className="platform-context-help">
          <Globe2 size={16} />
          {readOnly
            ? "Your QA account can view this tenant connection. Production administrators manage connection settings."
            : resourceHints[table] ||
              "Choose existing records from the dropdowns and complete the essential details. Optional settings are available under Advanced."}
        </p>
      )}
      {mode === "access" && (
        <>
          <div className="platform-access-controls">
            <LookupField
              label="User"
              value={loginid}
              displayValue={
                access.users.find((u) => u.LOGINID === loginid)?.USERNAME
                  ? `${loginid} · ${access.users.find((u) => u.LOGINID === loginid)?.USERNAME}`
                  : loginid
              }
              columns={[{ field: "label", header: "User" }]}
              valueField="value"
              displayFields={["label"]}
              disabled={loading || saving}
              loadOptions={async (q) =>
                access.users
                  .map((u) => ({
                    value: u.LOGINID,
                    label: `${u.LOGINID} · ${u.USERNAME || ""}`,
                  }))
                  .filter((u) =>
                    u.label.toLowerCase().includes((q || "").toLowerCase()),
                  )
              }
              onChange={setLoginid}
              placeholder="Search and choose a user"
            />
            <label>
              Module
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
              >
                <option value="">All modules</option>
                {[
                  ...new Set(access.screens.map((s) => String(s.APP_CODE))),
                ].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setNewUser(!newUser)}
            >
              <Plus size={15} />
              Create user
            </Button>
            <Button
              disabled={!loginid || saving || loading || !accessScreens.length}
              onClick={() =>
                grant(
                  accessScreens.map((s) => Number(s.SERIAL_NO)),
                  true,
                )
              }
            >
              Grant all shown screens
            </Button>
            <Button variant="outline"
              disabled={!loginid || saving || loading || !accessScreens.length}
              onClick={() => {
                if (window.confirm(`Remove access to ${accessScreens.length} shown screens for ${loginid}? Other screen permissions will be preserved.`))
                  void grant(accessScreens.map((s) => Number(s.SERIAL_NO)), false);
              }}>
              Remove all shown access
            </Button>
          </div>
          <p className="platform-help">
            <strong>{accessScreens.length} screens shown{module ? ` in ${module}` : " across all modules"}.</strong>{" "}
            Create a user once to add their central login, tenant login and
            default tenant mapping together. Granting a screen enables all its
            actions; use Security records to fine tune individual actions. Removal
            covers direct and role access for this user. Other permissions are
            preserved as direct grants; shared role definitions stay unchanged.
          </p>
        </>
      )}
      {newUser && mode === "access" && (
        <form className="platform-editor" onSubmit={provision}>
          <div className="platform-editor-heading">
            <div>
              <h3>Create user</h3>
              <p>
                Creates the central sign-in account, the user in {company}, and
                the tenant mapping together.
              </p>
            </div>
            <Users size={22} />
          </div>
          <div className="platform-form">
            {(
              [
                ["loginid", "Login ID", "text"],
                ["username", "User name", "text"],
                ["email", "Email", "email"],
                ["password", "Password (12+ characters)", "password"],
              ] as const
            ).map(([key, text, type]) => {
              const InputControl =
                key === "password" ? PlatformPasswordInput : "input";
              return (
                <label key={key}>
                  {text}
                  <InputControl
                    type={type}
                    disabled={saving}
                    required
                    maxLength={key === "loginid" ? 15 : undefined}
                    minLength={key === "password" ? 12 : undefined}
                    autoComplete={key === "password" ? "new-password" : "off"}
                    value={userDraft[key]}
                    onChange={(e) =>
                      setUserDraft((d) => ({ ...d, [key]: e.target.value }))
                    }
                  />
                </label>
              );
            })}
          </div>
          <div className="platform-editor-actions">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setNewUser(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {mode === "records" && table === "SEC_ROLE_FUNCTION_ACCESS_USER" && (
        <p className="platform-help">
          Assign a screen serial number (for example, 127) or role ID to a user
          in this company. Choose Yes for the actions they can perform.
        </p>
      )}
      {mode === "records" && table === "SEC_LOGINTEST" && (
        <p className="platform-help">
          Central accounts sign in here. Add a tenant user and a user tenant
          mapping to connect a new account to its tenant. Super Admin privileges
          are managed separately.
        </p>
      )}
      {mode === "screens" && (
        <p className="platform-help">
          Enabled screens are available for assignment to this company’s users.
          Existing user permissions still apply. Changes appear when users
          reload their session.
        </p>
      )}
      {editor && (
        <form onSubmit={save} className="platform-editor">
          {table === "SEC_LOGIN" && !deleting && (
            <p className="platform-help">
              Password, name, email and active-status changes also update the
              central sign-in account. Passwords are never displayed after
              saving.
            </p>
          )}
          <div className="platform-editor-heading">
            <h3 tabIndex={-1} ref={editorHeading}>
              {deleting
                ? "Delete this record?"
                : editor._rowid
                  ? `Edit ${table === "MS_COMPANY" ? "company" : title.toLowerCase()}`
                  : table === "MS_COMPANY"
                    ? "New company"
                    : table === "SEC_ROLE_MASTER"
                      ? "New role"
                      : `Add ${title.toLowerCase()}`}
            </h3>
            <Button
              variant="ghost"
              aria-label="Close editor"
              onClick={() => setEditor(null)}
              disabled={saving}
            >
              <X size={18} />
            </Button>
          </div>
          {deleting ? (
            <p>
              This will delete the selected record from {catalog.owner} /{" "}
              {company || "central administration"}. This action cannot be
              undone.
            </p>
          ) : (
            <>
              <div className="platform-editor-intro">
                <CheckCircle2 size={16} />
                <span>
                  {table === "MS_COMPANY"
                    ? "Start with a unique company code and name. The new company will appear in the Company dropdown after saving."
                    : "Choose related records from the searchable dropdowns. Identifiers are assigned automatically."}
                </span>
              </div>
              {optionsLoading && (
                <p role="status" className="platform-help">
                  Loading dropdown choices…
                </p>
              )}
              <fieldset className="platform-fieldset">
                <legend>
                  {table === "MS_COMPANY"
                    ? "Company details"
                    : "Essential details"}
                </legend>
                <div className="platform-form">
                  {mainFields.map(renderField)}
                </div>
              </fieldset>
              {advancedFields.length > 0 && (
                <details className="platform-advanced">
                  <summary>
                    <SlidersHorizontal size={16} />
                    Advanced settings
                    <span>{advancedFields.length} optional fields</span>
                  </summary>
                  <div className="platform-form">
                    {advancedFields.map(renderField)}
                  </div>
                </details>
              )}
            </>
          )}
          <div className="platform-editor-actions">
            <Button
              type="submit"
              variant={deleting ? "destructive" : "default"}
              disabled={saving}
            >
              <Save size={15} />
              {saving
                ? "Saving…"
                : deleting
                  ? "Delete record"
                  : table === "MS_COMPANY" && !editor._rowid
                    ? "Create company"
                    : "Save changes"}
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      <div className="platform-grid" aria-busy={loading}>
        {loading ? (
          <p className="platform-empty" role="status">
            Loading security records…
          </p>
        ) : mode === "access" ? (
          <table>
            <thead>
              <tr>
                <th>Screen access</th>
                <th>Screen</th>
                <th>Module</th>
                <th>Menu</th>
              </tr>
            </thead>
            <tbody>
              {accessScreens.map((s) => (
                <tr key={String(s.SERIAL_NO)}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!loginid || saving}
                      checked={(access.inherited || []).some((a) => Number(a.SERIAL_NO) === Number(s.SERIAL_NO)) || access.access.some(
                        (a) =>
                          Number(a.SERIAL_NO_OR_ROLE_ID) ===
                          Number(s.SERIAL_NO),
                      )}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const fromRole = (access.inherited || []).some((a) => Number(a.SERIAL_NO) === Number(s.SERIAL_NO));
                        if (!enabled && fromRole && !window.confirm("Remove this user's access to this screen? Their other role permissions will be preserved as direct grants.")) return;
                        void grant([Number(s.SERIAL_NO)], enabled);
                      }}
                      aria-label={`Access to screen ${s.SERIAL_NO}`}
                    />
                    {(access.inherited || []).some((a) => Number(a.SERIAL_NO) === Number(s.SERIAL_NO)) && <small className="platform-access-source">From role</small>}
                  </td>
                  <td>{s.SERIAL_NO}</td>
                  <td>{s.APP_CODE}</td>
                  <td>
                    {[s.LEVEL1, s.LEVEL2, s.LEVEL3].filter(Boolean).join(" / ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : mode === "screens" ? (
          <table>
            <thead>
              <tr>
                <th>Available</th>
                <th>Screen</th>
                <th>Module</th>
                <th>Menu</th>
                <th>Route</th>
              </tr>
            </thead>
            <tbody>
              {filteredScreens.map((s, i) => (
                <tr key={`${s.SERIAL_NO}-${i}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      disabled={saving}
                      onChange={() => toggleScreen(s)}
                      aria-label={`Enable screen ${s.SERIAL_NO} ${s.LEVEL3 || s.LEVEL2 || s.LEVEL1}`}
                    />
                  </td>
                  <td>{s.SERIAL_NO}</td>
                  <td>{s.APP_CODE}</td>
                  <td>
                    {[s.LEVEL1, s.LEVEL2, s.LEVEL3].filter(Boolean).join(" / ")}
                  </td>
                  <td>{s.URL_PATH}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : mode === "audit" ? (
          <table>
            <thead>
              <tr>
                {[
                  "Time",
                  "Administrator",
                  "Tenant",
                  "Company",
                  "Action",
                  "Resource",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.AUDIT_ID}>
                  <td>{new Date(a.CREATED_AT).toLocaleString()}</td>
                  <td>{a.ACTOR}</td>
                  <td>{a.TENANT_ID}</td>
                  <td>{a.COMPANY_CODE}</td>
                  <td>{a.ACTION}</td>
                  <td>{a.RESOURCE_NAME}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : records.rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Actions</th>
                {visible.map((c) => (
                  <th key={c.name}>{label(c.name)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.rows.map((row) => (
                <tr key={row._rowid}>
                  <td className="platform-row-actions">
                    {!readOnly && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditor(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            openEditor(row);
                            setDeleting(true);
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                  {visible.map((c) => (
                    <td key={c.name}>{String(row[c.name] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="platform-empty">
            No records found. Add a record or change your search.
          </p>
        )}
      </div>
      {mode === "records" && (
        <footer className="platform-pagination">
          <span>
            {records.count} records · Page {page} of{" "}
            {Math.max(1, Math.ceil(records.count / 50))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={15} />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page * 50 >= records.count}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight size={15} />
          </Button>
        </footer>
      )}
    </section>
  );
}
