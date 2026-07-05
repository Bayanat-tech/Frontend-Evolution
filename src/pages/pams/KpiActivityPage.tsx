import type { ColumnDef } from "@tanstack/react-table";
import { Check, ChevronDown, Edit2, Eye, Plus, Save, Search, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import { pamsSelect, pamsSave, pamsDelete } from "../../api/pams";
import type { PamsProcedureParams } from "../../api/pams";

type Row = Record<string, unknown>;

type TKpiItem = {
  COMPANY_CODE: string;
  KPI_CODE: string;
  KPI_ITEM_SRNO?: number;
  KPI_ITEM_DESC: string;
  DIV_CODE?: string;
  DEPT_CODE?: string;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

function normalizeRow(row: Row): Row {
  const normalized: Row = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key] = value;
    normalized[key.toUpperCase()] = value;
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}


function SearchableSelect({
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; key: string }[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerId = useRef(`pams-picker-${Math.random().toString(36).slice(2)}`);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? options.filter((o) => `${o.value} ${o.label}`.toLowerCase().includes(term))
      : options;
    return matches.slice(0, 100);
  }, [options, query]);

  const close = () => { setOpen(false); setQuery(""); };
  const openPicker = () => {
    window.dispatchEvent(new CustomEvent("bayanat-picker-open", { detail: pickerId.current }));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePickerOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== pickerId.current) close();
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
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
        onClick={() => (open ? close() : openPicker())}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
          {selected?.label || value || placeholder}
        </span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
      </button>
      {open && !disabled && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[1000] w-full max-w-[560px] overflow-hidden rounded-md border border-border bg-white text-foreground shadow-2xl ring-1 ring-slate-950/10 dark:bg-slate-950"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="m-2 flex h-9 items-center gap-2 rounded-md border bg-background px-2 text-muted-foreground">
            <Search size={15} className="text-muted-foreground" />
            <input
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
              autoFocus
              value={query}
              placeholder={placeholder}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") close(); }}
            />
          </div>
          <div className="max-h-72 overflow-auto bg-white p-1 dark:bg-slate-950">
            <button
              type="button"
              className={!value
                ? "flex min-h-8 w-full items-center justify-between gap-2 rounded bg-primary/10 px-3 py-1.5 text-left text-sm font-semibold text-primary"
                : "flex min-h-8 w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"}
              onClick={() => { onChange(""); close(); }}
            >
              <span className="text-muted-foreground">{placeholder}</span>
              {!value && <Check size={14} />}
            </button>
            {filtered.map((option) => (
              <button
                key={option.key}
                type="button"
                className={option.value === value
                  ? "flex min-h-8 w-full items-center justify-between gap-2 rounded bg-primary/10 px-3 py-1.5 text-left text-sm font-semibold text-primary"
                  : "flex min-h-8 w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"}
                onClick={() => { onChange(option.value); close(); }}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check size={14} className="shrink-0 text-primary" />}
              </button>
            ))}
            {!filtered.length && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">No records found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <span>
        {label}
        {required && <strong className="text-destructive"> *</strong>}
      </span>
      {children}
    </div>
  );
}


async function pamsProc(params: PamsProcedureParams): Promise<Row[]> {
  return pamsSelect(params);
}


export function KpiActivityPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("");
  const [selectedKpiType, setSelectedKpiType] = useState("");
  const [selectedKpiDesc, setSelectedKpiDesc] = useState("");
  const [divisionList, setDivisionList] = useState<Row[]>([]);
  const [departmentList, setDepartmentList] = useState<Row[]>([]);
  const [sectionList, setSectionList] = useState<Row[]>([]);
  const [designationList, setDesignationList] = useState<Row[]>([]);
  const [kpiTypeList, setKpiTypeList] = useState<Row[]>([]);
  const [kpiDescList, setKpiDescList] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [kpiItemLoading, setKpiItemLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<TKpiItem>>({});
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!companyCode) return;
    pamsProc({ parameter: "division", loginid, code1: companyCode, code2: "NULL", code3: "NULL", code4: "NULL" })
      .then(setDivisionList)
      .catch(() => setDivisionList([]));
  }, [loginid, companyCode]);

  useEffect(() => {
    setSelectedDepartment("");
    setSelectedSection("");
    setSelectedDesignation("");
    setSelectedKpiType("");
    setSelectedKpiDesc("");
    setDepartmentList([]);
    setSectionList([]);
    setDesignationList([]);
    setKpiTypeList([]);
    setKpiDescList([]);
    setRows([]);
    if (!selectedDivision) return;
    pamsProc({ parameter: "department", loginid, code1: companyCode, code2: selectedDivision, code3: "NULL", code4: "NULL" })
      .then(setDepartmentList)
      .catch(() => setDepartmentList([]));
  }, [selectedDivision]);

  useEffect(() => {
    setSelectedSection("");
    setSelectedDesignation("");
    setSelectedKpiType("");
    setSelectedKpiDesc("");
    setSectionList([]);
    setDesignationList([]);
    setKpiTypeList([]);
    setKpiDescList([]);
    setRows([]);
    if (!selectedDepartment) return;
    pamsProc({ parameter: "section", loginid, code1: companyCode, code2: selectedDivision, code3: selectedDepartment, code4: "NULL" })
      .then(setSectionList)
      .catch(() => setSectionList([]));
    pamsProc({ parameter: "designation", loginid, code1: companyCode, code2: selectedDivision, code3: selectedDepartment, code4: "NULL" })
      .then(setDesignationList)
      .catch(() => setDesignationList([]));
  }, [selectedDepartment]);

  useEffect(() => {
    setSelectedKpiType("");
    setSelectedKpiDesc("");
    setKpiTypeList([]);
    setKpiDescList([]);
    setRows([]);
    if (!selectedDesignation) return;
    pamsProc({ parameter: "kpi_type", loginid, code1: companyCode, code2: "NULL", code3: "NULL", code4: "NULL" })
      .then(setKpiTypeList)
      .catch(() => setKpiTypeList([]));
  }, [selectedDesignation]);

  useEffect(() => {
    setSelectedKpiDesc("");
    setKpiDescList([]);
    setRows([]);
    if (!selectedKpiType || !selectedDepartment) return;
    pamsProc({
      parameter: "select_kpi_desc_for_kpitype",
      loginid,
      code1: companyCode,
      code2: selectedKpiType,
      code3: selectedDepartment,
      code4: `${selectedDesignation}$$${selectedDivision}$$${selectedSection}`,
    })
      .then((data) => {
        const seen = new Set<string>();
        setKpiDescList(
          data.filter((k) => {
            const key = text(k.KPI_CODE ?? k.kpi_code);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
        );
      })
      .catch(() => setKpiDescList([]));
  }, [selectedKpiType]);

  const loadItems = () => {
    if (!selectedKpiDesc) { setRows([]); return; }
    setKpiItemLoading(true);
    pamsProc({ parameter: "kpi_item_page", loginid, code1: companyCode, code2: selectedKpiDesc, code3: "NULL", code4: "NULL" })
      .then((data) =>
        setRows(
          data.map((row) =>
            normalizeRow({
              ...row,
              KPI_ITEM_SRNO: row.KPI_ITEM_SRNO ?? row.kpi_item_srno,
              KPI_CODE: row.KPI_CODE ?? row.kpi_code,
              KPI_ITEM_DESC: row.KPI_ITEM_DESC ?? row.kpi_item_desc,
            })
          )
        )
      )
      .catch(() => setRows([]))
      .finally(() => setKpiItemLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, [selectedKpiDesc]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setNotice(null);
    try {
      await pamsDelete({
        parameter: "delete_kpi_item",
        loginid,
        code1: text(deleteTarget.COMPANY_CODE ?? companyCode),
        code2: text(deleteTarget.KPI_CODE),
        number1: Number(deleteTarget.KPI_ITEM_SRNO ?? 0),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "KPI Item deleted successfully" });
      loadItems();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete KPI Item" });
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditMode(false);
    setViewMode(false);
    setFormData({ COMPANY_CODE: companyCode, KPI_CODE: selectedKpiDesc, KPI_ITEM_DESC: "", DIV_CODE: selectedDivision, DEPT_CODE: selectedDepartment });
    setFormOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditMode(true);
    setViewMode(false);
    setFormData({ COMPANY_CODE: text(row.COMPANY_CODE ?? companyCode), KPI_CODE: text(row.KPI_CODE), KPI_ITEM_SRNO: Number(row.KPI_ITEM_SRNO ?? 0), KPI_ITEM_DESC: text(row.KPI_ITEM_DESC), DIV_CODE: text(row.DIV_CODE ?? selectedDivision), DEPT_CODE: text(row.DEPT_CODE ?? selectedDepartment) });
    setFormOpen(true);
  };

  const openView = (row: Row) => {
    setEditMode(false);
    setViewMode(true);
    setFormData({ COMPANY_CODE: text(row.COMPANY_CODE ?? companyCode), KPI_CODE: text(row.KPI_CODE), KPI_ITEM_SRNO: Number(row.KPI_ITEM_SRNO ?? 0), KPI_ITEM_DESC: text(row.KPI_ITEM_DESC), DIV_CODE: text(row.DIV_CODE ?? selectedDivision), DEPT_CODE: text(row.DEPT_CODE ?? selectedDepartment) });
    setFormOpen(true);
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "KPI_ITEM_SRNO", header: "Item SRNO", size: 120, cell: ({ row }) => formatValue(row.original.KPI_ITEM_SRNO) },
      { accessorKey: "KPI_ITEM_DESC", header: "Item Description", size: 520, cell: ({ row }) => formatValue(row.original.KPI_ITEM_DESC) },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="View" onClick={() => openView(row.original)}><Eye size={14} /></Button>
            <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(row.original)}><Edit2 size={14} /></Button>
            <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(row.original)}><Trash2 size={14} /></Button>
          </div>
        ),
      },
    ],
    []
  );

  const divisionOptions = divisionList.map((d, i) => ({ value: text(d.DIV_CODE), label: `${d.DIV_CODE} - ${d.DIV_NAME}`, key: `div_${i}` }));
  const departmentOptions = departmentList.map((d, i) => ({ value: text(d.dept_code ?? d.DEPT_CODE), label: text(d.dept_name ?? d.DEPT_NAME), key: `dept_${i}` }));
  const sectionOptions = sectionList.map((s, i) => ({ value: text(s.section_code ?? s.SECTION_CODE), label: text(s.section_name ?? s.SECTION_NAME), key: `sec_${i}` }));
  const designationOptions = designationList.map((d, i) => ({ value: text(d.DESG_CODE), label: text(d.DESG_NAME), key: `desg_${i}` }));
  const kpiTypeOptions = kpiTypeList.map((k, i) => ({ value: text(k.KPI_TYPE_CODE ?? k.kpi_type_code), label: text(k.KPI_TYPE_DESC ?? k.kpi_type_desc), key: `kpitype_${i}` }));
  const kpiDescOptions = kpiDescList.map((k, i) => {
    const code = text(k.KPI_CODE ?? k.kpi_code);
    const desc = text(k.KPI_DESC ?? k.kpi_desc);
    return { value: code, label: code && desc ? `${code} - ${desc}` : code || desc, key: `kpidesc_${i}` };
  });

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">KPI Activities</h1>
        </div>

      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div>
            <p className="eyebrow">Select KPI Scope</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Division">
            <SearchableSelect value={selectedDivision} placeholder="Select division" options={divisionOptions} onChange={setSelectedDivision} />
          </Field>
          <Field label="Department">
            <SearchableSelect value={selectedDepartment} placeholder="Select department" disabled={!selectedDivision} options={departmentOptions} onChange={setSelectedDepartment} />
          </Field>
          <Field label="Section">
            <SearchableSelect value={selectedSection} placeholder="Select section" disabled={!selectedDepartment} options={sectionOptions} onChange={(v) => setSelectedSection(v)} />
          </Field>
          <Field label="Designation">
            <SearchableSelect value={selectedDesignation} placeholder="Select designation" disabled={!selectedDepartment} options={designationOptions} onChange={setSelectedDesignation} />
          </Field>
          <Field label="KPI Type">
            <SearchableSelect value={selectedKpiType} placeholder="Select KPI type" disabled={!selectedDesignation} options={kpiTypeOptions} onChange={setSelectedKpiType} />
          </Field>
          <Field label="KPI Description">
            <SearchableSelect value={selectedKpiDesc} placeholder="Select KPI description" disabled={!selectedKpiType} options={kpiDescOptions} onChange={setSelectedKpiDesc} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={!selectedKpiDesc} onClick={openAdd}>
          <Plus size={15} /> Create KPI Item
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="KPI Item List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search KPI items..."
        loading={kpiItemLoading}
        height={500}
        minWidth={800}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => `kpi_item_${text(row.KPI_CODE)}_${text(row.KPI_ITEM_SRNO)}_${index}`}
      />

      <Dialog
        open={formOpen}
        wide
        title={viewMode ? "View KPI Item" : editMode ? "Edit KPI Item" : "Add KPI Item"}
        description="Maintain KPI item description."
        onClose={() => setFormOpen(false)}
      >
        <KpiItemForm
          isEditMode={editMode}
          isViewMode={viewMode}
          existingData={formData}
          loginid={loginid}
          companyCode={companyCode}
          onClose={(saved) => {
            setFormOpen(false);
            if (saved) {
              setNotice({ type: "success", message: editMode ? "KPI Item updated successfully" : "KPI Item created successfully" });
              loadItems();
            }
          }}
        />
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Delete KPI Item"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">Please confirm to delete the selected KPI item.</p>
      </Dialog>
    </section>
  );
}


function KpiItemForm({
  isEditMode,
  isViewMode,
  existingData,
  loginid,
  companyCode,
  onClose,
}: {
  isEditMode: boolean;
  isViewMode: boolean;
  existingData: Partial<TKpiItem>;
  loginid: string;
  companyCode: string;
  onClose: (saved?: boolean) => void;
}) {
  const [kpiItemDesc, setKpiItemDesc] = useState(existingData.KPI_ITEM_DESC ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setKpiItemDesc(existingData.KPI_ITEM_DESC ?? "");
    setError("");
  }, [existingData]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!kpiItemDesc.trim()) { setError("KPI Item Description is required"); return; }
    setSaving(true);
    setError("");
    try {
      await pamsSave({
        parameter: "kpi_item_ins_upd",
        loginid,
        val1s1: existingData.COMPANY_CODE ?? companyCode,
        val1s2: existingData.KPI_CODE ?? "",
        val1n1: existingData.KPI_ITEM_SRNO,
        val1s3: kpiItemDesc.trim(),
        val1s4: existingData.DIV_CODE ?? "",
        val1s5: existingData.DEPT_CODE ?? "",
      });
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save KPI Item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div>
            <p className="eyebrow">Details</p>
            <h2 className="m-0 text-sm font-semibold">KPI Item Information</h2>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
          <Field label="KPI Code">
            <Input disabled value={existingData.KPI_CODE ?? ""} onChange={() => undefined} />
          </Field>
          {isEditMode && (
            <Field label="Item SRNO">
              <Input disabled value={text(existingData.KPI_ITEM_SRNO)} onChange={() => undefined} />
            </Field>
          )}
          <div className="md:col-span-2">
            <Field label="KPI Item Description" required>
              <textarea
                disabled={isViewMode}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                value={kpiItemDesc}
                onChange={(e) => setKpiItemDesc(e.target.value)}
                placeholder="Enter KPI item description"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <NoticeToast notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

      <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
        {!isViewMode && (
          <Button disabled={saving} type="submit">
            <Save size={15} /> {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>
    </form>
  );
}
