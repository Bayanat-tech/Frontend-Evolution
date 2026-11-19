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
} from "lucide-react";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";
import { Button } from "../../components/ui/Button";
import "./platform-admin.css";

type Row = Record<string, any>;
type Column = {
  name: string;
  type: string;
  required: boolean;
  secret: boolean;
  readonly: boolean;
};
type Catalog = {
  owner: string;
  companies: Row[];
  tables: { name: string; label: string }[];
};
type Records = { columns: Column[]; rows: Row[]; count: number };
const label = (name: string) =>
  ({
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
  })[name] ||
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
      (mode === "screens" && !company)
    )
      return;
    let active = true;
    setLoading(true);
    setError("");
    setEditor(null);
    setNotice("");
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
          else setRecords(data);
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
  const openEditor = (row: Row) => {
    setEditor(row);
    setDeleting(false);
    setError("");
    setNotice("");
    const initial: Row = {};
    for (const c of records.columns.filter((c) => !c.readonly && !c.secret)) {
      if (row._rowid) initial[c.name] = row[c.name] ?? "";
      else if (c.name === "COMPANY_CODE") initial[c.name] = company;
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
      setNotice(deleting ? "Record deleted." : "Changes saved.");
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
  const visible = records.columns.filter((c) => !c.secret && !c.readonly);
  const formColumns = records.columns.filter(
    (c) => !c.readonly && !["SEC_PASSWD", "PASSWORD"].includes(c.name),
  );
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
            Manage central accounts and security across every registered tenant.
          </p>
        </div>
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
          <label>
            Company
            <select
              value={company}
              disabled={saving || loading}
              onChange={(e) => {
                setCompany(e.target.value);
                setPage(1);
              }}
            >
              {catalog.companies.map((c) => (
                <option key={c.COMPANY_CODE} value={c.COMPANY_CODE}>
                  {c.COMPANY_CODE} · {c.COMPANY_NAME}
                </option>
              ))}
            </select>
          </label>
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
          Security records
        </button>
        {tenant !== "root" && (
          <>
            <button
              aria-current={mode === "access" ? "page" : undefined}
              disabled={saving}
              onClick={() => setMode("access")}
            >
              Users & access
            </button>
            <button
              aria-current={mode === "screens" ? "page" : undefined}
              disabled={saving}
              onClick={() => setMode("screens")}
            >
              Company screens
            </button>
          </>
        )}
        <button
          aria-current={mode === "audit" ? "page" : undefined}
          disabled={saving}
          onClick={() => setMode("audit")}
        >
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
        {mode === "records" && (
          <Button
            disabled={loading || saving || !table}
            onClick={() => openEditor({})}
          >
            <Plus size={16} />
            Add record
          </Button>
        )}
      </div>
      {mode === "access" && (
        <>
          <div className="platform-toolbar">
            <label>
              User
              <select
                value={loginid}
                disabled={loading || saving}
                onChange={(e) => setLoginid(e.target.value)}
              >
                <option value="">Select user</option>
                {access.users.map((u) => (
                  <option key={u.LOGINID} value={u.LOGINID}>
                    {u.LOGINID} · {u.USERNAME}
                  </option>
                ))}
              </select>
            </label>
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
          </div>
          <p className="platform-help">
            Create a user once to add their central login, tenant login and
            default tenant mapping together. Granting a screen enables all its
            actions; use Security records to fine tune individual actions. Role
            inherited access remains managed in Role screen access.
          </p>
        </>
      )}
      {newUser && mode === "access" && (
        <form className="platform-editor" onSubmit={provision}>
          <h3>Create user in {company}</h3>
          <div className="platform-form">
            {(
              [
                ["loginid", "Login ID", "text"],
                ["username", "User name", "text"],
                ["email", "Email", "email"],
                ["password", "Password (12+ characters)", "password"],
              ] as const
            ).map(([key, text, type]) => (
              <label key={key}>
                {text}
                <input
                  type={type}
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
            ))}
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
          <div className="platform-editor-heading">
            <h3 tabIndex={-1} ref={editorHeading}>
              {deleting
                ? "Delete this record?"
                : editor._rowid
                  ? "Edit record"
                  : "Add record"}
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
            <div className="platform-form">
              {formColumns.map((c) => (
                <label key={c.name}>
                  {label(c.name)}
                  {c.required ? " *" : ""}
                  {/^S(NEW|MODIFY|DELETE|SAVE|SEARCH|SAVEAS|UPLOAD|UNDO|PRINT|PRINTSETUP|HELP)$/.test(
                    c.name,
                  ) ||
                  ["ACTIVE_FLAG", "IS_ACTIVE", "IS_DEFAULT"].includes(
                    c.name,
                  ) ? (
                    <select
                      value={draft[c.name] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [c.name]: e.target.value }))
                      }
                    >
                      <option value="">Select</option>
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </select>
                  ) : (
                    <input
                      type={
                        c.secret
                          ? "password"
                          : /NUMBER|FLOAT/.test(c.type)
                            ? "number"
                            : /DATE|TIMESTAMP/.test(c.type)
                              ? "datetime-local"
                              : "text"
                      }
                      step="any"
                      value={
                        /DATE|TIMESTAMP/.test(c.type)
                          ? String(draft[c.name] || "").slice(0, 16)
                          : (draft[c.name] ?? "")
                      }
                      autoComplete={c.secret ? "new-password" : "off"}
                      disabled={
                        c.name === "COMPANY_CODE" &&
                        tenant !== "root" &&
                        !(table === "MS_COMPANY" && !editor._rowid)
                      }
                      placeholder={
                        c.secret && editor._rowid
                          ? "Leave blank to keep current password"
                          : ""
                      }
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [c.name]: e.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          <div className="platform-editor-actions">
            <Button
              type="submit"
              variant={deleting ? "destructive" : "default"}
              disabled={saving}
            >
              <Save size={15} />
              {saving ? "Saving…" : deleting ? "Delete record" : "Save record"}
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
                <th>Direct access</th>
                <th>Screen</th>
                <th>Module</th>
                <th>Menu</th>
              </tr>
            </thead>
            <tbody>
              {accessScreens.map((s, i) => (
                <tr key={`${s.SERIAL_NO}-${i}`}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!loginid || saving}
                      checked={access.access.some(
                        (a) =>
                          Number(a.SERIAL_NO_OR_ROLE_ID) ===
                          Number(s.SERIAL_NO),
                      )}
                      onChange={(e) =>
                        grant([Number(s.SERIAL_NO)], e.target.checked)
                      }
                      aria-label={`Grant screen ${s.SERIAL_NO}`}
                    />
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
