import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Edit2, Eye, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  executeDynamicDelete,
  executeDynamicMutation,
  executeDynamicMutationColumn90,
  getDynamicLookup,
  LookupRow,
} from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import NoticeToast, { ToastNotice } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";

type EditorMode = "create" | "edit" | "view";
type EditorState<T> = { mode: EditorMode; row?: T } | null;
type OxRow = Record<string, unknown>;

type SimpleConfig = {
  title: string;
  noun: string;
  selectParameter: string;
  saveParameter: string;
  deleteParameter: string;
  codeField: string;
  nameField: string;
  searchPlaceholder: string;
  // Which P_CODEn slot PROC_BUILD_DYNAMIC_DEL_OX_MASTER reads for this master's
  // delete branch. ASSET_TYPE_CODE -> code2, STATUS_CODE -> code1, SITE_PROJECT_CODE -> code1.
  deleteCodeParam: "code1" | "code2" | "code3" | "code4" | "code5";
};

export const oxMaintMasterConfigs = {
  assetType: {
    title: "Asset Type",
    noun: "Asset Type",
    selectParameter: "OX_ASSET_TYPE_SELECT",
    saveParameter: "OX_MASTERS_ASSET_TYPE_INS_UPD",
    deleteParameter: "OX_MASTER_DEL_ASSET_TYPE",
    codeField: "asset_type_code",
    nameField: "asset_type_name",
    searchPlaceholder: "Search asset type...",
    deleteCodeParam: "code2",
  },
  status: {
    title: "Status",
    noun: "Status",
    selectParameter: "OX_STATUS_SELECT",
    saveParameter: "OX_MASTERS_STATUS_INS_UPD",
    deleteParameter: "OX_MASTER_DEL_STATUS",
    codeField: "status_code",
    nameField: "status_name",
    searchPlaceholder: "Search status...",
    deleteCodeParam: "code1",
  },
  siteProject: {
    title: "Site Project",
    noun: "Site Project",
    selectParameter: "OX_SITE_PROJECT_SELECT",
    saveParameter: "OX_MASTERS_SITE_PROJECT_INS_UPD",
    deleteParameter: "OX_MASTER_DEL_SITE_PROJECT",
    codeField: "site_project_code",
    nameField: "site_project_name",
    searchPlaceholder: "Search site project...",
    deleteCodeParam: "code1",
  },
} satisfies Record<string, SimpleConfig>;

const text = (row: OxRow, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row[key] ?? row[key.toUpperCase()];
    if (value !== undefined && value !== null) return String(value);
  }
  return fallback;
};

const numberValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const dateValue = (value: unknown) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const yesNo = (value: unknown) => (value === true || String(value).toUpperCase() === "Y" ? "Y" : "N");

function PageHeader({
  eyebrow = "Oxmaint",
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>}
    </div>
  );
}

export function OxSimpleMasterPage({ config }: { config: SimpleConfig }) {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const [rows, setRows] = useState<OxRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<EditorState<OxRow>>(null);
  const [notice, setNotice] = useState<ToastNotice>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({ parameter: config.selectParameter, loginid });
      setRows(data);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loginid) void loadRows();
  }, [loginid, config.selectParameter]);

  const saveRow = async (name: string, code?: string) => {
    await executeDynamicMutation({
      parameter: config.saveParameter,
      loginid,
      val1n1: numberValue(code),
      val1s1: user?.company_code || "",
      val1s2: "",
      val1s3: name,
      val1s4: "",
      val1s5: "",
      val1s6: "",
    });
    setEditor(null);
    setNotice({ type: "success", message: `${config.noun} saved successfully` });
    await loadRows(false);
  };

  const deleteRow = async (row: OxRow) => {
    try {
      const codeValue = text(row, [config.codeField]);
      await executeDynamicDelete({
        parameter: config.deleteParameter,
        loginid,
        [config.deleteCodeParam]: codeValue,
      });
      setNotice({ type: "success", message: `${config.noun} deleted successfully` });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to delete ${config.noun}` });
    }
  };

  const columns = useMemo<ColumnDef<OxRow>[]>(
    () => [
      {
        accessorKey: config.codeField,
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono text-xs font-semibold">{String(getValue() ?? "")}</span>,
      },
      { accessorKey: config.nameField, header: "Name" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "view", row: row.original })}><Eye size={14} /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={14} /></Button>
            <Button size="icon" variant="ghost" onClick={() => void deleteRow(row.original)}><Trash2 size={14} /></Button>
          </div>
        ),
      },
    ],
    [config],
  );

  return (
    <section className="grid gap-4">
      <PageHeader title={config.title} eyebrow="Oxmaint Master">
        <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
        <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Add {config.noun}</Button>
      </PageHeader>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable
        columns={columns}
        data={rows}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={config.searchPlaceholder}
        loading={loading}
        height="calc(100vh - 250px)"
        density="grid"
        enablePagination
        pageSize={100}
        emptyText={`No ${config.noun.toLowerCase()} records found`}
      />
      <SimpleMasterEditor config={config} editor={editor} onClose={() => setEditor(null)} onSave={saveRow} />
    </section>
  );
}

function SimpleMasterEditor({
  config,
  editor,
  onClose,
  onSave,
}: {
  config: SimpleConfig;
  editor: EditorState<OxRow>;
  onClose: () => void;
  onSave: (name: string, code?: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(editor?.row ? text(editor.row, [config.nameField]) : "");
  }, [editor, config.nameField]);
  if (!editor) return null;
  const readOnly = editor.mode === "view";
  const code = editor.row ? text(editor.row, [config.codeField]) : "";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly || !name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), code);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={Boolean(editor)}
      title={`${editor.mode === "create" ? "Add" : editor.mode === "edit" ? "Edit" : "View"} ${config.noun}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}><X size={15} /> {readOnly ? "Close" : "Cancel"}</Button>
          {!readOnly && <Button type="submit" form="ox-simple-editor" disabled={saving}><Save size={15} /> Save</Button>}
        </>
      }
    >
      <form id="ox-simple-editor" className="grid gap-4" onSubmit={submit}>
        <div className="rounded-lg border">
          <div className="border-b p-4">
            <p className="eyebrow">Details</p>
            <h3 className="m-0 text-base font-semibold">Basic Information</h3>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {code && (
              <label className="field">
                <span>Code</span>
                <Input value={code} disabled />
              </label>
            )}
            <label className="field">
              <span>{config.noun} Name <span className="text-destructive">*</span></span>
              <Input value={name} disabled={readOnly} onChange={(event) => setName(event.target.value)} required />
            </label>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function OxAssetInventoryPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const [rows, setRows] = useState<OxRow[]>([]);
  const [statusCards, setStatusCards] = useState<OxRow[]>([]);
  const [statusSelected, setStatusSelected] = useState("total");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);
  const [editor, setEditor] = useState<EditorState<OxRow>>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const [counts, data] = await Promise.all([
        getDynamicLookup({ parameter: "OX_ASSET_INVENTORY_STATUS_BASED_TOTAL_COUNT", loginid }),
        getDynamicLookup({ parameter: "OX_ASSET_INVENTORY_GET_BY_STATUS_NAME", loginid, code1: statusSelected }),
      ]);
      setStatusCards(counts);
      setRows(data);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load asset inventory" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loginid) void loadRows();
  }, [loginid, statusSelected]);

  const deleteRow = async (row: OxRow) => {
    try {
      await executeDynamicDelete({ parameter: "OX_DEL_ASSET_INVENTORY", loginid, number1: numberValue(row.asset_id ?? row.ASSET_ID) });
      setNotice({ type: "success", message: "Asset inventory deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete asset inventory" });
    }
  };

  const columns = useMemo<ColumnDef<OxRow>[]>(
    () => [
      { accessorKey: "asset_number", header: "Asset Number" },
      { accessorKey: "asset_name", header: "Asset Name" },
      { accessorKey: "asset_type_name", header: "Asset Type" },
      { accessorKey: "status_name", header: "Status" },
      { accessorKey: "site_project_name", header: "Site / Project" },
      { accessorKey: "running_hours", header: "Running Hours" },
      { accessorKey: "business_unit", header: "Business Unit" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "view", row: row.original })}><Eye size={14} /></Button>
            <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={14} /></Button>
            <Button size="icon" variant="ghost" onClick={() => void deleteRow(row.original)}><Trash2 size={14} /></Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      <PageHeader title="Asset Inventory" eyebrow="Oxmaint Asset">
        <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
        <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Add Asset</Button>
      </PageHeader>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <div className="grid gap-3 md:grid-cols-4">
        <button className={`rounded-lg border bg-white p-4 text-left shadow-sm ${statusSelected === "total" ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => setStatusSelected("total")}>
          <span className="eyebrow">All Assets</span>
          <strong className="mt-2 block text-xl">{rows.length}</strong>
        </button>
        {statusCards.slice(0, 7).map((row, index) => {
          const status = text(row, ["status_name", "status", "STATUS_NAME", "STATUS"], `status-${index}`);
          const total = text(row, ["count", "total", "COUNT", "TOTAL"], "");
          return (
            <button key={`${status}-${index}`} className={`rounded-lg border bg-white p-4 text-left shadow-sm ${statusSelected === status ? "border-primary ring-1 ring-primary" : ""}`} onClick={() => setStatusSelected(status)}>
              <span className="eyebrow">{status}</span>
              <strong className="mt-2 block text-xl">{total}</strong>
            </button>
          );
        })}
      </div>
      <DataTable columns={columns} data={rows} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search asset inventory..." loading={loading} height="calc(100vh - 360px)" density="grid" enablePagination pageSize={100} minWidth={1180} />
      <AssetInventoryEditor editor={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice({ type: "success", message: "Asset inventory saved successfully" }); await loadRows(false); }} />
    </section>
  );
}

function AssetInventoryEditor({ editor, onClose, onSaved }: { editor: EditorState<OxRow>; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const [form, setForm] = useState<OxRow>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editor?.row ? { ...editor.row } : { required_geo_location_while_inspection: "N", running_hours: 0 });
  }, [editor]);
  if (!editor) return null;
  const readOnly = editor.mode === "view";
  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await executeDynamicMutationColumn90({
        parameter: "OX_IN_UPD_ASSET_INVENTORY",
        loginid,
        val1s1: text(form, ["asset_number"]),
        val1s2: text(form, ["asset_name"]),
        val1s3: text(form, ["asset_category"]),
        val1s4: text(form, ["model_make"]),
        val1s5: text(form, ["manufacture"]),
        val1s6: text(form, ["business_unit"]),
        val1s7: yesNo(form.required_geo_location_while_inspection),
        val1s8: text(form, ["operator_name"]),
        val1s9: text(form, ["maintenance_priority"]),
        val1s10: text(form, ["ownership_mode"]),
        val1s11: text(form, ["inspection_form_ids"]),
        val1s12: dateValue(form.purchase_date),
        val1s13: dateValue(form.warranty_date),
        val1s14: dateValue(form.last_maintenance_date),
        val1s15: text(form, ["running_hours_unit"]),
        val1n1: numberValue(form.asset_id),
        val1n2: numberValue(form.asset_type),
        val1n3: numberValue(form.status),
        val1n4: numberValue(form.inventory),
        val1n5: numberValue(form.site_project),
        val1n6: numberValue(form.running_hours),
        val1n7: numberValue(form.asset_value),
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(editor)} title={`${editor.mode === "create" ? "Add" : editor.mode === "edit" ? "Edit" : "View"} Asset Inventory`} wide onClose={onClose} footer={<><Button variant="outline" onClick={onClose}><X size={15} /> Close</Button>{!readOnly && <Button type="submit" form="asset-inventory-editor" disabled={saving}><Save size={15} /> Save</Button>}</>}>
      <form id="asset-inventory-editor" className="grid gap-4" onSubmit={submit}>
        <div className="rounded-lg border">
          <div className="border-b p-4"><p className="eyebrow">Asset</p><h3 className="m-0 text-base font-semibold">Inventory Information</h3></div>
          <div className="grid gap-3 p-4 md:grid-cols-4">
            {[
              ["asset_number", "Asset Number", "text"],
              ["asset_name", "Asset Name", "text"],
              ["asset_category", "Category", "text"],
              ["model_make", "Model / Make", "text"],
              ["manufacture", "Manufacturer", "text"],
              ["business_unit", "Business Unit", "text"],
              ["running_hours", "Running Hours", "number"],
              ["running_hours_unit", "Hours Unit", "text"],
              ["asset_value", "Asset Value", "number"],
              ["purchase_date", "Purchase Date", "date"],
              ["warranty_date", "Warranty Date", "date"],
              ["operator_name", "Operator", "text"],
            ].map(([key, label, type]) => (
              <label key={key} className="field"><span>{label}</span><Input disabled={readOnly} type={type} value={String(form[key] ?? "")} onChange={(event) => set(key, type === "number" ? Number(event.target.value) : event.target.value)} /></label>
            ))}
            <LookupField label="Asset Type" value={String(form.asset_type ?? "")} displayValue={text(form, ["asset_type_name"])} columns={[{ field: "asset_type_code", header: "Code" }, { field: "asset_type_name", header: "Name" }]} valueField="asset_type_code" displayFields={["asset_type_code", "asset_type_name"]} loadOptions={() => getDynamicLookup({ parameter: "OX_ASSET_INVENTORY_ASSET_TYPE_DROPDWON", loginid })} onChange={(value, row) => setForm((current) => ({ ...current, asset_type: value, asset_type_name: text(row || {}, ["asset_type_name"]) }))} disabled={readOnly} />
            <LookupField label="Status" value={String(form.status ?? "")} displayValue={text(form, ["status_name"])} columns={[{ field: "status_code", header: "Code" }, { field: "status_name", header: "Name" }]} valueField="status_code" displayFields={["status_code", "status_name"]} loadOptions={() => getDynamicLookup({ parameter: "OX_ASSET_INVENTORY_STATUS_DROPDWON", loginid })} onChange={(value, row) => setForm((current) => ({ ...current, status: value, status_name: text(row || {}, ["status_name"]) }))} disabled={readOnly} />
            <LookupField label="Site Project" value={String(form.site_project ?? "")} displayValue={text(form, ["site_project_name"])} columns={[{ field: "site_project_code", header: "Code" }, { field: "site_project_name", header: "Name" }]} valueField="site_project_code" displayFields={["site_project_code", "site_project_name"]} loadOptions={() => getDynamicLookup({ parameter: "OX_ASSET_INVENTORY_SITE_PROJECT_DROPDWON", loginid })} onChange={(value, row) => setForm((current) => ({ ...current, site_project: value, site_project_name: text(row || {}, ["site_project_name"]) }))} disabled={readOnly} />
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function InspectionFormEditor({ editor, onClose, onSaved }: { editor: EditorState<OxRow>; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => { setName(text(editor?.row || {}, ["inspection_form_name"])); setDescription(text(editor?.row || {}, ["description"])); }, [editor]);
  if (!editor) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await executeDynamicMutation({ parameter: "OX_IN_UPD_INSPECTION_FORM", loginid: user?.loginid || "", val1s1: name, val1s2: description, val1n1: numberValue(editor.row?.inspection_form_code) });
    await onSaved();
  };
  return <Dialog open={Boolean(editor)} title={`${editor.mode === "create" ? "Add" : "Edit"} Inspection Form`} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}><X size={15} /> Cancel</Button><Button type="submit" form="inspection-form-editor"><Save size={15} /> Save</Button></>}><form id="inspection-form-editor" className="grid gap-3" onSubmit={submit}><label className="field"><span>Name *</span><Input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field"><span>Description</span><textarea className="ui-input min-h-24 rounded-md border px-3 py-2 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /></label></form></Dialog>;
}

function InspectionSectionsPanel({ form, onNotice }: { form: OxRow | null; onNotice: (notice: ToastNotice) => void }) {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const formId = numberValue(form?.inspection_form_code);
  const [sections, setSections] = useState<OxRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [selectedSection, setSelectedSection] = useState<OxRow | null>(null);

  const load = async () => {
    if (!formId) return;
    setSections(await getDynamicLookup({ parameter: "OX_INSPECTION_FORM_UNDER_SECTION_DATA", loginid, number1: formId }));
  };
  useEffect(() => { void load(); }, [formId]);
  const grouped = useMemo(() => {
    const map = new Map<string, { section: OxRow; items: OxRow[] }>();
    sections.forEach((row) => {
      const id = text(row, ["header_section_id"]);
      if (!map.has(id)) map.set(id, { section: row, items: [] });
      if (row.under_section_id) map.get(id)?.items.push(row);
    });
    return Array.from(map.values());
  }, [sections]);
  if (!form) return <div className="grid min-h-[360px] place-items-center rounded-lg border bg-white p-8 text-center text-muted-foreground"><div><p className="eyebrow">Sections</p><h3 className="m-0 text-base font-semibold text-foreground">Select an inspection form</h3><p className="mt-2 text-sm">Sections and inspection items open here.</p></div></div>;
  const addSection = async () => {
    if (!title.trim() || !formId) return;
    await executeDynamicMutation({ parameter: "OX_IN_UPD_HEADER_SECTION", loginid, val1s1: title.trim(), val1n1: formId });
    setTitle("");
    onNotice({ type: "success", message: "Section saved successfully" });
    await load();
  };
  const addItem = async () => {
    const sectionId = numberValue(selectedSection?.header_section_id);
    if (!itemTitle.trim() || !sectionId) return;
    await executeDynamicMutation({ parameter: "OX_IN_UPD_UNDER_SECTION", loginid, val1n1: sectionId, val1n3: 1, val1s1: itemTitle.trim(), val1s2: "YES/NO", val1s3: "Y", val1s4: "" });
    setItemTitle("");
    onNotice({ type: "success", message: "Inspection item saved successfully" });
    await load();
  };
  return (
    <div className="grid max-h-[calc(100vh-260px)] gap-3 overflow-auto rounded-lg border bg-white p-4 shadow-sm">
      <div><p className="eyebrow">Sections</p><h3 className="m-0 text-lg font-semibold">{text(form, ["inspection_form_name"])}</h3></div>
      <div className="grid gap-2 rounded-lg border bg-secondary/30 p-3"><label className="field"><span>New Section</span><Input value={title} onChange={(event) => setTitle(event.target.value)} /></label><Button size="sm" onClick={() => void addSection()}><Plus size={14} /> Add Section</Button></div>
      {selectedSection && <div className="grid gap-2 rounded-lg border bg-secondary/30 p-3"><p className="m-0 text-xs font-semibold">Add item under {text(selectedSection, ["header_section_title"])}</p><Input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} /><Button size="sm" onClick={() => void addItem()}><Plus size={14} /> Add Item</Button></div>}
      <div className="grid gap-2">
        {grouped.map(({ section, items }) => {
          const id = text(section, ["header_section_id"]);
          const open = expanded[id] ?? true;
          return <div key={id} className="rounded-lg border"><button className="flex w-full items-center justify-between p-3 text-left font-semibold" onClick={() => setExpanded((current) => ({ ...current, [id]: !open }))}>{text(section, ["header_section_title"])} {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>{open && <div className="grid gap-1 border-t p-2">{items.length === 0 && <span className="px-2 py-1 text-sm text-muted-foreground">No inspection items</span>}{items.map((item) => <button key={text(item, ["under_section_id"])} className="rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => setSelectedSection(section)}>{text(item, ["under_section_title"])} <span className="text-xs text-muted-foreground">({text(item, ["type"])})</span></button>)}<Button size="sm" variant="outline" onClick={() => setSelectedSection(section)}><Plus size={14} /> Add item</Button></div>}</div>;
        })}
      </div>
    </div>
  );
}

export function OxInspectionReportPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const [rows, setRows] = useState<OxRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<OxRow[] | null>(null);
  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      setRows(await getDynamicLookup({ parameter: "OX_INSPECTION_REPORT_GRID", loginid }));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load inspection reports" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (loginid) void loadRows(); }, [loginid]);
  const deleteRow = async (row: OxRow) => {
    await executeDynamicDelete({ parameter: "OX_DEL_INSPECTION_FORM_REPORT_DELETE", loginid, number1: numberValue(row.id) });
    setNotice({ type: "success", message: "Inspection report deleted successfully" });
    await loadRows(false);
  };
  const openPreview = async (row: OxRow) => setPreview(await getDynamicLookup({ parameter: "OX_INSPECTION_REPORT_HEADER_DETAILS", loginid, number1: numberValue(row.id) }));
  const columns = useMemo<ColumnDef<OxRow>[]>(() => [
    { accessorKey: "report_number", header: "Report No" },
    { accessorKey: "report_date", header: "Date" },
    { accessorKey: "asset_number", header: "Asset Number" },
    { accessorKey: "asset_name", header: "Asset Name" },
    { accessorKey: "location", header: "Location" },
    { accessorKey: "inspector_name", header: "Inspector" },
    { accessorKey: "asset_status", header: "Status" },
    { id: "actions", header: "Actions", cell: ({ row }) => <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => void openPreview(row.original)}><Eye size={14} /></Button><Button size="icon" variant="ghost" onClick={() => void deleteRow(row.original)}><Trash2 size={14} /></Button></div> },
  ], []);
  return <section className="grid gap-4"><PageHeader title="Inspection Report" eyebrow="Oxmaint Asset"><Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button><Button onClick={() => setEditorOpen(true)}><Plus size={15} /> Add Report</Button></PageHeader><NoticeToast notice={notice} onClose={() => setNotice(null)} /><DataTable columns={columns} data={rows} searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search inspection report..." loading={loading} density="grid" height="calc(100vh - 250px)" enablePagination pageSize={100} minWidth={1100} /><InspectionReportEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSaved={async () => { setEditorOpen(false); setNotice({ type: "success", message: "Inspection report saved successfully" }); await loadRows(false); }} /><Dialog open={Boolean(preview)} title="Inspection Report Preview" wide onClose={() => setPreview(null)} footer={<Button variant="outline" onClick={() => setPreview(null)}>Close</Button>}><DataTable columns={(preview?.[0] ? Object.keys(preview[0]).slice(0, 8).map((key) => ({ accessorKey: key, header: key.replace(/_/g, " ") })) : []) as ColumnDef<OxRow>[]} data={preview || []} density="grid" height={360} /></Dialog></section>;
}

function InspectionReportEditor({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const [form, setForm] = useState<OxRow>({ overall_condition: "Good", asset_safe_to_use: "Yes", maintenance_required: "No", asset_status: "Active" });
  const [structure, setStructure] = useState<OxRow[]>([]);
  const [responses, setResponses] = useState<Record<string, { value: string; note: string; upload: string }>>({});
  const [loadingStructure, setLoadingStructure] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ overall_condition: "Good", asset_safe_to_use: "Yes", maintenance_required: "No", asset_status: "Active" });
    setStructure([]);
    setResponses({});
  }, [open]);

  useEffect(() => {
    const formId = numberValue(form.inspection_form_code);
    if (!open || !loginid || !formId) {
      setStructure([]);
      setResponses({});
      return;
    }
    let active = true;
    setLoadingStructure(true);
    getDynamicLookup({ parameter: "OX_INSPECTION_REPORT_FETCH_STRUCTURE", loginid, number1: formId })
      .then((rows) => {
        if (!active) return;
        setStructure(rows);
        setResponses(
          rows.reduce<Record<string, { value: string; note: string; upload: string }>>((acc, row, index) => {
            const key = reportItemKey(row, index);
            acc[key] = {
              value: defaultInspectionValue(text(row, ["type", "type_status"])),
              note: "",
              upload: "",
            };
            return acc;
          }, {}),
        );
      })
      .finally(() => {
        if (active) setLoadingStructure(false);
      });
    return () => {
      active = false;
    };
  }, [form.inspection_form_code, loginid, open]);

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const setResponse = (key: string, patch: Partial<{ value: string; note: string; upload: string }>) => {
    const fallback = currentInspectionResponse();
    setResponses((current) => ({ ...current, [key]: { ...fallback, ...(current[key] || {}), ...patch } }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const detailRows = structure.map((row, index) => {
      const key = reportItemKey(row, index);
      const response = responses[key] || { value: "", note: "", upload: "" };
      return {
        inspection_form_id: numberValue(form.inspection_form_code) || 0,
        header_section_id: numberValue(row.header_section_id ?? row.HEADER_SECTION_ID) || 0,
        under_section_id: numberValue(row.under_section_id ?? row.UNDER_SECTION_ID) || 0,
        type_status: text(row, ["type", "type_status"]),
        type_value: response.value,
        inspection_note: response.note,
        upload: response.upload,
      };
    });
    await executeDynamicMutationColumn90({
      parameter: "OX_IN_UPD_INSPECTION_REPORT",
      loginid,
      val1s1: text(form, ["location"]),
      val1s2: text(form, ["asset_number"]),
      val1s3: text(form, ["asset_name"]),
      val1s4: text(form, ["inventory_no"]),
      val1s5: text(form, ["running_hours_unit"]),
      val1s6: text(form, ["overall_condition"]),
      val1s7: text(form, ["asset_safe_to_use"]),
      val1s8: text(form, ["maintenance_required"]),
      val1s9: text(form, ["asset_status"]),
      val1s10: text(form, ["additional_note"]),
      val1s11: text(form, ["inspector_name"]),
      val1n1: numberValue(form.running_hours) || 0,
      val1n2: numberValue(form.inspection_form_code) || 0,
      val1s90: JSON.stringify(detailRows),
    });
    await onSaved();
  };
  return (
    <Dialog open={open} title="Add Inspection Report" wide onClose={onClose} footer={<><Button variant="outline" onClick={onClose}><X size={15} /> Cancel</Button><Button type="submit" form="inspection-report-editor"><Save size={15} /> Save Report</Button></>}>
      <form id="inspection-report-editor" className="grid gap-4" onSubmit={submit}>
        <div className="rounded-lg border">
          <div className="border-b p-4"><p className="eyebrow">Report</p><h3 className="m-0 text-base font-semibold">Inspection Header</h3></div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <LookupField label="Inspection Form" value={String(form.inspection_form_code ?? "")} displayValue={text(form, ["inspection_form_name"])} columns={[{ field: "inspection_form_code", header: "Code" }, { field: "inspection_form_name", header: "Name" }]} valueField="inspection_form_code" displayFields={["inspection_form_code", "inspection_form_name"]} loadOptions={() => getDynamicLookup({ parameter: "OX_INSPECTION_REPORT_INSPECTION_FORM_DROPDOWN", loginid })} onChange={(value, row) => setForm((current) => ({ ...current, inspection_form_code: value, inspection_form_name: text(row || {}, ["inspection_form_name"]) }))} required />
            <LookupField label="Asset" value={String(form.asset_inventory_code ?? "")} displayValue={text(form, ["asset_number", "asset_name"])} columns={[{ field: "asset_inventory_code", header: "Code" }, { field: "asset_number", header: "Asset" }, { field: "asset_name", header: "Name" }]} valueField="asset_inventory_code" displayFields={["asset_number", "asset_name"]} loadOptions={() => getDynamicLookup({ parameter: "OX_INSPECTION_REPORT_ASSET_INVENTORY_DROPDOWN", loginid })} onChange={(value, row) => setForm((current) => ({ ...current, asset_inventory_code: value, asset_number: text(row || {}, ["asset_number"]), asset_name: text(row || {}, ["asset_name"]), inventory_no: text(row || {}, ["inventory_no"]), running_hours: text(row || {}, ["running_hours"]), running_hours_unit: text(row || {}, ["running_hours_unit"]) }))} required />
            {["location", "inspector_name", "running_hours", "running_hours_unit", "overall_condition", "asset_safe_to_use", "maintenance_required", "asset_status"].map((key) => <label key={key} className="field"><span>{key.replace(/_/g, " ")}</span><Input value={String(form[key] ?? "")} onChange={(event) => set(key, event.target.value)} /></label>)}
            <label className="field md:col-span-3"><span>Additional Note</span><textarea className="ui-input min-h-20 rounded-md border px-3 py-2 text-sm" value={String(form.additional_note ?? "")} onChange={(event) => set("additional_note", event.target.value)} /></label>
          </div>
        </div>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b p-4"><div><p className="eyebrow">Checklist</p><h3 className="m-0 text-base font-semibold">Inspection Details</h3></div>{loadingStructure && <span className="text-sm text-muted-foreground">Loading...</span>}</div>
          <div className="max-h-[320px] overflow-auto">
            {structure.length === 0 ? <div className="p-6 text-sm text-muted-foreground">Select an inspection form to load checklist rows.</div> : structure.map((row, index) => {
              const key = reportItemKey(row, index);
              const type = text(row, ["type", "type_status"]).toUpperCase();
              const response = responses[key] || { value: "", note: "", upload: "" };
              return (
                <div key={key} className="grid gap-3 border-b p-3 md:grid-cols-[minmax(220px,1fr)_180px_minmax(220px,1.2fr)_180px]">
                  <div><p className="m-0 text-xs font-semibold text-muted-foreground">{text(row, ["header_section_title", "section_name"])}</p><p className="m-0 text-sm font-semibold">{text(row, ["under_section_title", "item_name", "question"])}</p></div>
                  <label className="field"><span>Value</span>{type.includes("YES") || type.includes("NO") ? <select className="ui-input h-9 rounded-md border px-3 text-sm" value={response.value} onChange={(event) => setResponse(key, { value: event.target.value })}><option value="Yes">Yes</option><option value="No">No</option><option value="N/A">N/A</option></select> : <Input value={response.value} onChange={(event) => setResponse(key, { value: event.target.value })} />}</label>
                  <label className="field"><span>Inspection Note</span><Input value={response.note} onChange={(event) => setResponse(key, { note: event.target.value })} /></label>
                  <label className="field"><span>Upload Ref</span><Input value={response.upload} onChange={(event) => setResponse(key, { upload: event.target.value })} /></label>
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function reportItemKey(row: OxRow, index: number) {
  return String(row.under_section_id ?? row.UNDER_SECTION_ID ?? row.header_section_id ?? row.HEADER_SECTION_ID ?? index);
}

function defaultInspectionValue(type: string) {
  const normalized = type.toUpperCase();
  if (normalized.includes("YES") || normalized.includes("NO")) return "Yes";
  if (normalized.includes("NUMBER")) return "0";
  return "";
}

function currentInspectionResponse() {
  return { value: "", note: "", upload: "" };
}

export function OxMaintDashboard() {
  return (
    <section className="grid gap-4">
      <PageHeader title="Oxmaint Workbench" eyebrow="Oxmaint" />
      <div className="grid gap-4 md:grid-cols-3">
        {["Asset Inventory", "Inspection Form", "Inspection Report", "Asset Type", "Status", "Site Project"].map((item) => (
          <div key={item} className="rounded-lg border bg-white p-5 shadow-sm">
            <p className="eyebrow">Oxmaint</p>
            <h3 className="m-0 text-lg font-semibold">{item}</h3>
            <p className="mt-2 text-sm text-muted-foreground">Use the menu to open this screen.</p>
          </div>
        ))}
      </div>
    </section>
  );
}