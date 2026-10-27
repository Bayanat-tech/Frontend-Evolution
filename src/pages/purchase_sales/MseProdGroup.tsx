import { Edit2, FileText, List, Plus, Save, Trash2, X, Loader2, Building2, LayoutGrid } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { executeDynamicDelete, executeDynamicMutation, getDynamicLookup } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { useAuth } from "../../state/AuthContext";
import { LookupField } from "../../components/ui/LookupField";
import { Input } from "../../components/ui/Input";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

type ProductGroupRow = Record<string, any>;

const LIST_COLUMNS: { key: string; label: string; width?: number }[] = [
  { key: "group_code", label: "Group Code", width: 150 },
  { key: "group_name", label: "Group Name", width: 250 },
  { key: "inv_ac_code", label: "Inventory A/C", width: 150 },
  { key: "sales_ac_code", label: "Sales A/C", width: 150 },
  { key: "direct_expense_ac", label: "Direct Expense A/C", width: 150 },
  { key: "costofsales_ac_code", label: "Cost of Sales A/C", width: 150 },
];

const makeEmpty = (): ProductGroupRow => ({
  group_code: "",
  group_name: "",
  inv_ac_code: "",
  sales_ac_code: "",
  direct_expense_ac: "",
  costofsales_ac_code: "",
  gitin_ac_code: "",
  gitout_ac_code: "",
});

/* ─────────────────────────────────────────────────────────────
   SectionPanel — EXACT Freight structure
   ───────────────────────────────────────────────────────────── */
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field — matches WmsMasterForm / Freight label styling
   ───────────────────────────────────────────────────────────── */
function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MseProdGroup() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const [rows, setRows] = useState<ProductGroupRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // View state
  const [view, setView] = useState<"list" | "editor">("list");
  const [editMode, setEditMode] = useState(false);
  const [original, setOriginal] = useState<ProductGroupRow | null>(null);
  const [form, setForm] = useState<ProductGroupRow>(() => makeEmpty());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProductGroupRow | null>(null);

  const loadRows = async () => {
    setLoading(true);
    try {
      const response = await getDynamicLookup({
        parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DATA_TABLE",
        code1: companyCode,
      });
      setRows(Array.isArray(response) ? response : []);
    } catch (err) {
      // Handle error silently or add a toast here
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term))
    );
  }, [rows, query]);

  const openAdd = () => {
    setEditMode(false);
    setOriginal(null);
    setForm(makeEmpty());
    setError("");
    setView("editor");
  };

  const openEdit = (row: ProductGroupRow) => {
    setEditMode(true);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row });
    setError("");
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditMode(false);
    setOriginal(null);
  };

  const setField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.group_name?.trim()) {
      setError("Product Group Name is required");
      return;
    }

    try {
      setSaving(true);

      // empty on create → backend auto-generates
      const groupCode = editMode && original?.group_code
        ? String(original.group_code)
        : form.group_code
          ? String(form.group_code)
          : undefined;

      await executeDynamicMutation({
        parameter: "PURCHASE_SALES_INS_UPD_MSE_PRODGROUP",
        loginid: loginId,
        // key / WHERE
        wval1s1: companyCode,
        wval1s2: groupCode,
        // values
        val1s2: form.group_name ? String(form.group_name) : undefined,
        val1s3: form.gitin_ac_code ? String(form.gitin_ac_code) : undefined,
        val1s4: form.inv_ac_code ? String(form.inv_ac_code) : undefined,
        val1s5: form.gitout_ac_code ? String(form.gitout_ac_code) : undefined,
        val1s6: form.sales_ac_code ? String(form.sales_ac_code) : undefined,
        val1s7: form.costofsales_ac_code ? String(form.costofsales_ac_code) : undefined,
        val1s8: form.prodtype_code ? String(form.prodtype_code) : undefined,
        val1s9: form.direct_expense_ac ? String(form.direct_expense_ac) : undefined,
      });

      handleCloseEditor();
      await loadRows();
    } catch (err: any) {
      setError(err?.message || "Unable to save product group");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "PURCHASE_SALES_DEL_MSE_PRODGROUP",
        loginid: loginId,
        code1: companyCode,
        code2: String(deleteTarget.group_code),
      });
      setDeleteTarget(null);
      await loadRows();
    } catch (err: any) {
      // Handle delete error
      console.error(err);
    }
  };

  const columns = useMemo<ColumnDef<ProductGroupRow>[]>(
    () => [
      ...LIST_COLUMNS.map<ColumnDef<ProductGroupRow>>((column, index) => ({
        accessorKey: column.key,
        header: column.label,
        size: column.width,
        cell: ({ row }) =>
          index === 0 ? (
            <button
              type="button"
              onClick={() => openEdit(row.original)}
              className="font-semibold text-[#00378C] hover:underline cursor-pointer text-left bg-transparent border-none p-0"
              title="Click to edit"
            >
              {String(row.original[column.key] ?? "")}
            </button>
          ) : (
            <span>{String(row.original[column.key] ?? "")}</span>
          ),
      })),
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-600 hover:text-[#00378C] hover:bg-[#eff6ff] rounded-md"
              title="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Edit2 size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md"
              title="Delete"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">

        {/* Freight-style transaction header */}
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  {editMode ? "Edit Product Group" : "New Product Group"}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editMode ? "Editing" : "Draft"}
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-[#00378C]">
                  Product Group Code:
                  <strong className="font-semibold">
                    {editMode && form.group_code ? String(form.group_code) : "Auto-generated"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor}>
              <List size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </div>

        {/* Form Content wrapped in freight-tabs-shell for the border/shadow look */}
        <div className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2">

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
            <div className="p-3 grid gap-3">

              <SectionPanel title="Product Group Details" icon={Building2}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Product Group Name" required>
                    <Input
                      value={form.group_name ?? ""}
                      onChange={(e) => setField("group_name", e.target.value)}
                    />
                  </Field>
                </div>
              </SectionPanel>

              <SectionPanel title="Goods in Transit / Inventory A/C" icon={LayoutGrid}>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Inventory A/C Code">
                    <LookupField
                      label=""
                      value={form.inv_ac_code ?? ""}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      columns={[
                        { field: "ac_code", header: "Code" },
                        { field: "ac_name", header: "Name" },
                      ]}
                      loadOptions={async () => {
                        return await getDynamicLookup({
                          parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_INVENTORY_ACCOUNT",
                          loginid: loginId,
                          code1: companyCode,
                        }) || [];
                      }}
                      onChange={(value) => setField("inv_ac_code", value)}
                      compact
                    />
                  </Field>

                  <Field label="Sales A/C Code">
                    <LookupField
                      label=""
                      value={form.sales_ac_code ?? ""}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      columns={[
                        { field: "ac_code", header: "Code" },
                        { field: "ac_name", header: "Name" },
                      ]}
                      loadOptions={async () => {
                        return await getDynamicLookup({
                          parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_SALEAC_ACCOUNT",
                          loginid: loginId,
                          code1: companyCode,
                        }) || [];
                      }}
                      onChange={(value) => setField("sales_ac_code", value)}
                      compact
                    />
                  </Field>

                  <Field label="Direct Expense A/C">
                    <LookupField
                      label=""
                      value={form.direct_expense_ac ?? ""}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      columns={[
                        { field: "ac_code", header: "Code" },
                        { field: "ac_name", header: "Name" },
                      ]}
                      loadOptions={async () => {
                        return await getDynamicLookup({
                          parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_DIRECT_EXPENSE_ACCOUNT",
                          loginid: loginId,
                          code1: companyCode,
                        }) || [];
                      }}
                      onChange={(value) => setField("direct_expense_ac", value)}
                      compact
                    />
                  </Field>

                  <Field label="Cost of Sales A/C Code">
                    <LookupField
                      label=""
                      value={form.costofsales_ac_code ?? ""}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      columns={[
                        { field: "ac_code", header: "Code" },
                        { field: "ac_name", header: "Name" },
                      ]}
                      loadOptions={async () => {
                        return await getDynamicLookup({
                          parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_COSTSALES_ACCOUNT",
                          loginid: loginId,
                          code1: companyCode,
                        }) || [];
                      }}
                      onChange={(value) => setField("costofsales_ac_code", value)}
                      compact
                    />
                  </Field>

                  <Field label="GIT-IN A/C Code" required>
                    <LookupField
                      label=""
                      value={form.gitin_ac_code ?? ""}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      columns={[
                        { field: "ac_code", header: "Code" },
                        { field: "ac_name", header: "Name" },
                      ]}
                      loadOptions={async () => {
                        return await getDynamicLookup({
                          parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_GITIN_ACCOUNT",
                          loginid: loginId,
                          code1: companyCode,
                        }) || [];
                      }}
                      onChange={(value) => setField("gitin_ac_code", value)}
                      compact
                    />
                  </Field>

                  <Field label="GIT-OUT A/C Code">
                    <LookupField
                      label=""
                      value={form.gitout_ac_code ?? ""}
                      valueField="ac_code"
                      displayFields={["ac_code", "ac_name"]}
                      columns={[
                        { field: "ac_code", header: "Code" },
                        { field: "ac_name", header: "Name" },
                      ]}
                      loadOptions={async () => {
                        return await getDynamicLookup({
                          parameter: "PURCHASE_SALES_MSE_PROD_GROUP_DROP_DOWN_GITOUT_ACCOUNT",
                          loginid: loginId,
                          code1: companyCode,
                        }) || [];
                      }}
                      onChange={(value) => setField("gitout_ac_code", value)}
                      compact
                    />
                  </Field>

                </div>
              </SectionPanel>

            </div>
          </div>

        </div>
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title only — buttons live inside the DataTable toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Product Group
          </h2>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Product Groups`}
        subtitle="Manage Product Groups"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search product group..."
        loading={loading}
        emptyText="No product groups found"
        height="calc(100dvh - 150px)"
        minWidth={Math.max(900, LIST_COLUMNS.reduce((sum, column) => sum + (column.width || 160), 120))}
        density="grid"
        enablePagination={false}
        enableExport={false}
        getRowId={(row, index) => `${String(row.group_code ?? "")}_${index}`}
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Product Group
            </button>
            <FinanceListActionsMenu
              fyPeriod=""
              fyPeriods={[]}
              onFyPeriodChange={() => {}}
              onExport={() =>
                exportToCsv(filteredRows, columns, `product-group-${new Date().toISOString().slice(0, 10)}.csv`)
              }
              onRefresh={() => void loadRows()}
            />
          </div>
        }
      />

      {/* ---------- DELETE CONFIRM ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        compact
        tone="danger"
        title="Delete Product Group"
        description="This action cannot be undone."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Close
            </Button>
            <Button variant="destructive" onClick={() => void deleteRow()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          Delete <strong>{String(deleteTarget?.group_name ?? "")}</strong>?
        </p>
      </Dialog>
    </section>
  );
}