import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { deleteWmsGm, getWmsMaster, saveWmsGm } from "../../api/wms";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type CountryRow = {
  country_code: string;
  country_name: string;
  country_gcc: "Y" | "N";
  short_desc: string;
  nationality: string;
  company_code?: string;
};

const emptyCountry: CountryRow = {
  country_code: "",
  country_name: "",
  country_gcc: "N",
  short_desc: "",
  nationality: "",
};

export function WmsCountryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<CountryRow>(emptyCountry);
  const [deleteTarget, setDeleteTarget] = useState<CountryRow | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await getWmsMaster("country", { page: nextPageIndex + 1, limit: nextPageSize });
      setRows(response.tableData.map(mapCountry));
      setTotalRows(response.count || response.tableData.length);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load countries" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [pageIndex, pageSize]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  const openAdd = () => {
    setEditMode(false);
    setForm({ ...emptyCountry, company_code: user?.company_code || "" });
    setFormOpen(true);
    setNotice(null);
  };

  const openEdit = (row: CountryRow) => {
    setEditMode(true);
    setForm(row);
    setFormOpen(true);
    setNotice(null);
  };

  const saveCountry = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.country_code.trim() || !form.country_name.trim()) {
      setNotice({ type: "error", message: "Country code and country name are required" });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await saveWmsGm(
        "country",
        {
          ...form,
          company_code: form.company_code || user?.company_code || "",
        },
        editMode ? "put" : "post",
      );
      setFormOpen(false);
      setNotice({ type: "success", message: editMode ? "Country updated successfully" : "Country added successfully" });
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save country" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setNotice(null);
    try {
      await deleteWmsGm("country", [deleteTarget.country_code]);
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Country deleted successfully" });
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete country" });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<CountryRow>[]>(
    () => [
      { accessorKey: "country_code", header: "Country Code", size: 130 },
      { accessorKey: "country_name", header: "Country Name", size: 240 },
      { accessorKey: "country_gcc", header: "GCC", size: 80 },
      { accessorKey: "short_desc", header: "Short Description", size: 180 },
      { accessorKey: "nationality", header: "Nationality", size: 180 },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title="Edit country">
              <Edit2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)} title="Delete country">
              <Trash2 size={14} />
            </Button>
          </div>
        ),
        size: 90,
      },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">WMS Master</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Country Master</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Maintain country code, country name, GCC flag, short description, and nationality using the existing Bayanat WMS backend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={openAdd}>
            <Plus size={15} /> Add Country
          </Button>
        </div>
      </div>

      {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>}

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Countries`}
        subtitle="Country List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search country code, name, nationality..."
        loading={loading}
        emptyText="No countries found"
        height={620}
        minWidth={900}
        density="grid"
        enablePagination
        manualPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={setPageIndex}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageIndex(0);
        }}
        getRowId={(row) => row.country_code}
      />

      <Dialog
        open={formOpen}
        title={editMode ? "Edit Country" : "Add Country"}
        description="Country information"
        compact
        onClose={() => setFormOpen(false)}
      >
        <form className="grid gap-4" onSubmit={saveCountry}>
          <Card>
            <CardHeader>
              <div>
                <p className="eyebrow">Country Info</p>
                <h2 className="m-0 text-sm font-semibold">Basic Details</h2>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Country Code" required>
                <Input
                  autoFocus
                  disabled={editMode}
                  value={form.country_code}
                  onChange={(event) => setForm((current) => ({ ...current, country_code: event.target.value.toUpperCase() }))}
                />
              </Field>
              <Field label="Country Name" required>
                <Input value={form.country_name} onChange={(event) => setForm((current) => ({ ...current, country_name: event.target.value }))} />
              </Field>
              <Field label="Short Description">
                <Input value={form.short_desc} onChange={(event) => setForm((current) => ({ ...current, short_desc: event.target.value }))} />
              </Field>
              <Field label="Nationality">
                <Input value={form.nationality} onChange={(event) => setForm((current) => ({ ...current, nationality: event.target.value }))} />
              </Field>
              <Field label="Is GCC">
                <Select value={form.country_gcc} onChange={(event) => setForm((current) => ({ ...current, country_gcc: event.target.value as "Y" | "N" }))}>
                  <option value="N">No</option>
                  <option value="Y">Yes</option>
                </Select>
              </Field>
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
        title="Delete Country"
        description={deleteTarget ? `Delete ${deleteTarget.country_code} - ${deleteTarget.country_name}?` : undefined}
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
        <p className="m-0 text-sm text-muted-foreground">This will call the existing WMS delete endpoint for country master.</p>
      </Dialog>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

function mapCountry(row: Record<string, unknown>): CountryRow {
  return {
    country_code: text(row.country_code ?? row.COUNTRY_CODE),
    country_name: text(row.country_name ?? row.COUNTRY_NAME),
    country_gcc: (text(row.country_gcc ?? row.country_GCC ?? row.COUNTRY_GCC) || "N") === "Y" ? "Y" : "N",
    short_desc: text(row.short_desc ?? row.SHORT_DESC),
    nationality: text(row.nationality ?? row.NATIONALITY),
    company_code: text(row.company_code ?? row.COMPANY_CODE),
  };
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
