import {
  ArrowLeft, Edit2, FileText, Layers, Plus, Save, Trash2, X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { getWmsMaster, postWmsBillingActivity, upsertMsActivityBillingApi } from "../../../api/wms";
import { executeDynamicDelete, getDynamicLookup, getLookupText } from "../../../api/lookups";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { LookupField } from "../../../components/ui/LookupField";
import type { LucideIcon } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────── */
type TBillingActivity = {
  from?: string;
  to?: string;
  activityPassword?: string;
  activity?: string;
  prin_name?: number;
  prin_code: string;
  act_code?: string;
  wip_code?: string;
  cost: number;
  income_code?: string;
  bill_amount: number;
  jobtype: string;
  company_code?: string;
  freeze_flag?: string;
  mandatory_flag?: string;
  validate_flag?: string;
  uoc?: string;
  moc1?: string;
  moc2?: string;
  cust_code?: string;
  start_point?: string;
  end_point?: string;
  customer_type?: string;
  vtype_code?: string;
  serial_no?: number;
  serial_no2?: number;
  updated_at?: Date;
  updated_by?: string;
  created_by?: string;
  created_at?: Date;
  inb_show?: string;
  oub_show?: string;
  bill_dup?: number;
  cost_dup?: number;
  edit_user?: string;
};

const emptyBillingActivity: TBillingActivity = {
  prin_code: "",
  activity: "",
  jobtype: "",
  uoc: "",
  moc1: "",
  moc2: "",
  cost: 0,
  bill_amount: 0,
  inb_show: "",
};

type TPrincipal = { prin_code: string; prin_name: string };
type TUocWms = {
  company_code: string;
  charge_type: string;
  charge_code: string;
  description: string;
  activity_group_code: string;
  updated_at: Date;
  updated_by: string;
  created_by: string;
  created_at: Date;
};
type TMoc = {
  moc_code?: string;
  moc_name?: string;
  description: string;
  activity_group_code: string;
  company_code?: string;
  updated_at?: Date;
  updated_by?: string;
  created_by?: string;
  created_at?: Date;
};
type PopulateBillingActivity = { prin_from: string; prin_to: string };
const emptyPopBillAct: PopulateBillingActivity = { prin_from: "", prin_to: "" };

/* ─────────────────────────────────────────────────────────────
   SectionPanel — Freight structure
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
   Field — freight-field-label styling (single consistent wrapper)
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
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors min-h-[14px]">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Page
   ───────────────────────────────────────────────────────────── */
export function WmsBillingActPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TBillingActivity[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);

  const [view, setView] = useState<"list" | "editor">("list");
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<TBillingActivity>(emptyBillingActivity);

  const [popBillActform, setpopBillActform] = useState<PopulateBillingActivity>(emptyPopBillAct);
  const [populateOpen, setPopulateOpen] = useState(false);

  const [prinCode, setPrinCode] = useState("");
  const [principals, setPrincipals] = useState<TPrincipal[]>([]);

  const [ActOpen, setActOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TBillingActivity | null>(null);

  const { toast } = useToast();

  /* Load principals */
  useEffect(() => {
    getWmsMaster("principal", { page: 1, limit: 100000 })
      .then((res) => {
        setPrincipals(
          (res.tableData as Record<string, unknown>[]).map((r) => ({
            prin_code: String(r.PRIN_CODE ?? r.prin_code ?? ""),
            prin_name: String(r.PRIN_NAME ?? r.prin_name ?? r.PRIN_CODE ?? ""),
          })),
        );
      })
      .catch(() => {});
  }, []);

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    setLoading(true);
    try {
      const hasSearch = Boolean(query.trim());
      const response = await getWmsMaster("billing_activity", {
        page: hasSearch ? 1 : nextPageIndex + 1,
        limit: hasSearch ? 100000 : nextPageSize,
        ...(prinCode ? { code: prinCode } : {}),
      });
      setRows(response.tableData.map(mapBillingActivity));
      setTotalRows(response.count || response.tableData.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load billing activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [pageIndex, pageSize, query, prinCode]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [query, rows]);

  /* ── Populate (modal) ── */
  const openPopBillAct = () => {
    if (!prinCode) {
      toast.warning("Please select a Principal first");
      return;
    }
    setpopBillActform({ ...emptyPopBillAct, prin_from: prinCode || "" });
    setPopulateOpen(true);
  };

  /* ── Add / Edit → full-page editor ── */
  const openAdd = () => {
    if (!prinCode) {
      toast.warning("Please select a Principal first");
      return;
    }
    setEditMode(false);
    setForm({ ...emptyBillingActivity, prin_code: prinCode, company_code: user?.company_code || "" });
    setView("editor");
  };

  const openEdit = (row: TBillingActivity) => {
    setEditMode(true);
    setForm(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditMode(false);
    setForm(emptyBillingActivity);
  };

  const saveBillActivity = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.prin_code.trim() || !form.act_code?.trim()) {
      toast.warning("Principal and Activity are required");
      return;
    }
    setSaving(true);
    try {
      if (editMode) {
        await upsertMsActivityBillingApi({
          ...form,
          company_code: form.company_code || user?.company_code || "",
        });
      } else {
        await postWmsBillingActivity({
          ...form,
          company_code: form.company_code || user?.company_code || "",
        });
      }
      toast.success(editMode ? "Activity updated successfully" : "Activity added successfully");
      handleCloseEditor();
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save Activity");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (row: TBillingActivity) => {
    setDeleteTarget(row);
    setActOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await executeDynamicDelete({
        parameter: "BILLING_ACTIVITY_DET_PRINCIPAL",
        loginid: user?.loginid || "",
        code1: user?.company_code || "",
        code2: deleteTarget.prin_code || "",
        code3: deleteTarget.act_code || "",
        code4: deleteTarget.jobtype || "",
      });
      setActOpen(false);
      setDeleteTarget(null);
      toast.success("Activity deleted successfully");
      await loadRows(pageIndex, pageSize);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete activity");
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<TBillingActivity>[]>(
    () => [
      { accessorKey: "activity", header: "Activity", size: 200 },
      { accessorKey: "jobtype", header: "Job Type", size: 100 },
      { accessorKey: "uoc", header: "UOC", size: 80 },
      { accessorKey: "moc1", header: "MOC1", size: 80 },
      { accessorKey: "moc2", header: "MOC2", size: 80 },
      { accessorKey: "cost", header: "Cost", size: 80 },
      { accessorKey: "bill_amount", header: "Bill Amount", size: 80 },
      { accessorKey: "inb_show", header: "Inbound Show", size: 80 },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEdit(row.original)}
              title="Edit activity"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => requestDelete(row.original)}
              title="Delete activity"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
        size: 90,
      },
    ],
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  {editMode ? "Edit Activity" : "New Activity"}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {editMode ? "Editing" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            <Button
              type="submit"
              size="sm"
              form="billing-activity-form"
              disabled={saving}
            >
              <Save size={14} /> {saving ? "Saving" : editMode ? "Update" : "Save"}
            </Button>
          </div>
        </div>

        <form id="billing-activity-form" onSubmit={saveBillActivity} className="grid gap-2">
          <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
            <div className="freight-tabs-panel p-3 grid gap-3">
              <SectionPanel title="Activity Info" icon={Layers}>
                <div className="grid gap-3 md:grid-cols-2">
                  {/* LEFT COLUMN */}
                  <Field label="Principal Code" required>
                    <Input disabled value={form.prin_code} />
                  </Field>

                  <Field label="Activity" required>
                    <LookupField
                      label=""
                      disabled={editMode}
                      value={form.act_code ?? ""}
                      columns={[
                        { field: "act_code", header: "Activity Code" },
                        { field: "ACTIVITY", header: "Activity" },
                      ]}
                      valueField="act_code"
                      displayFields={["act_code", "ACTIVITY"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "ACTIVITY_ACT",
                          loginid: user?.loginid || "",
                          code1: user?.company_code || "",
                          code2: form.prin_code || "",
                        })
                      }
                      onChange={(value, row) =>
                        setForm((prev) => ({
                          ...prev,
                          act_code: value,
                          activity: row ? getLookupText(row, ["Activity", "ACTIVITY", "activity"]) : "",
                        }))
                      }
                      compact
                    />
                  </Field>

                  <Field label="Job Type" required>
                    <Select
                      value={form.jobtype}
                      onChange={(e) => setForm((c) => ({ ...c, jobtype: e.target.value }))}
                      disabled={editMode}
                    >
                      <option value="">Select...</option>
                      <option value="IMP">Import</option>
                      <option value="EXP">Export</option>
                      <option value="TFR">Transfer</option>
                    </Select>
                  </Field>

                  <Field label="UOC">
                    <LookupField
                      label=""
                      value={form.uoc ?? ""}
                      valueField="charge_code"
                      displayFields={["charge_code", "description"]}
                      columns={[
                        { field: "charge_code", header: "Charge Code" },
                        { field: "description", header: "Description" },
                      ]}
                      loadOptions={async () => {
                        const res = await getWmsMaster("uoc", { page: 1, limit: 100000 });
                        return res.tableData as TUocWms[];
                      }}
                      onChange={(value) => setForm((c) => ({ ...c, uoc: value }))}
                      compact
                    />
                  </Field>

                  <Field label="MOC1">
                    <LookupField
                      label=""
                      value={form.moc1 ?? ""}
                      valueField="moc_code"
                      displayFields={["moc_code", "moc_name"]}
                      columns={[
                        { field: "moc_code", header: "MOC Code" },
                        { field: "moc_name", header: "MOC Name" },
                      ]}
                      loadOptions={async () => {
                        const res = await getWmsMaster("moc", { page: 1, limit: 100000 });
                        return res.tableData as TMoc[];
                      }}
                      onChange={(value) => setForm((c) => ({ ...c, moc1: value }))}
                      compact
                    />
                  </Field>

                  <Field label="MOC2">
                    <LookupField
                      label=""
                      value={form.moc2 ?? ""}
                      valueField="charge_code"
                      displayFields={["charge_code", "description"]}
                      columns={[
                        { field: "charge_code", header: "Charge Code" },
                        { field: "description", header: "Description" },
                      ]}
                      loadOptions={async () => {
                        const res = await getWmsMaster("moc2", { page: 1, limit: 100000 });
                        return res.tableData as TUocWms[];
                      }}
                      onChange={(value) => setForm((c) => ({ ...c, moc2: value }))}
                      compact
                    />
                  </Field>
                </div>
              </SectionPanel>

              <SectionPanel title="Amounts & Flags" icon={Layers}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Bill Amount" required>
                    <Input
                      type="number"
                      value={form.bill_amount}
                      onChange={(e) => setForm((c) => ({ ...c, bill_amount: Number(e.target.value) }))}
                    />
                  </Field>

                  <Field label="Cost" required>
                    <Input
                      type="number"
                      value={form.cost}
                      onChange={(e) => setForm((c) => ({ ...c, cost: Number(e.target.value) }))}
                    />
                  </Field>

                  <Field label="Freeze Flag">
                    <Select
                      value={form.freeze_flag ?? "N"}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, freeze_flag: e.target.value as "Y" | "N" }))
                      }
                    >
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </Select>
                  </Field>

                  <Field label="Mandatory Flag">
                    <Select
                      value={form.mandatory_flag ?? "N"}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, mandatory_flag: e.target.value as "Y" | "N" }))
                      }
                    >
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </Select>
                  </Field>
                </div>
              </SectionPanel>
            </div>
          </div>
        </form>
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page title */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Activity Billing
          </h2>
        </div>
      </div>

      {/* Principal filter — compact, inline label like Freight */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
          Principal
        </span>
        <Select
          value={prinCode}
          onChange={(e) => {
            setPrinCode(e.target.value);
            setPageIndex(0);
          }}
          style={{ height: 32, minHeight: 32, width: 220, fontSize: 12, paddingInline: 9 }}
        >
          <option value="">— All Principals —</option>
          {principals.map((p) => (
            <option key={p.prin_code} value={p.prin_code}>
              {p.prin_name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Activities`}
        subtitle="Billing Activity List"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search activity, job type..."
        loading={loading}
        emptyText="No Billing Activity found"
        height={620}
        minWidth={900}
        density="grid"
        enablePagination
        manualPagination={!query.trim()}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={setPageIndex}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageIndex(0);
        }}
        getRowId={(row) => (row.act_code ?? "") + (row.jobtype ?? "")}
        enableExport
        exportFilename="wms-billing-activity-list.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPopBillAct}
              disabled={!prinCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Layers size={14} />
              Populate Activities
            </button>
            <button
              type="button"
              onClick={openAdd}
              disabled={!prinCode}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Add Activity
            </button>
          </div>
        }
      />

      {/* Populate Activities dialog — FIXED alignment using Field on both */}
      <Dialog
        open={populateOpen}
        title="Populate Activities"
        compact
        onClose={() => setPopulateOpen(false)}
      >
        <form className="freight-workspace-ui freight-dense-form freight-ui-standard grid gap-3">
          <SectionPanel title="Populate Range" icon={Layers}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="From Principal" required>
                <Input disabled value={popBillActform.prin_from} />
              </Field>

              <Field label="To Principal" required>
                <LookupField
                  label=""
                  value={popBillActform.prin_to ?? ""}
                  valueField="prin_code"
                  displayFields={["prin_code", "prin_name"]}
                  columns={[
                    { field: "prin_code", header: "Principal Code" },
                    { field: "prin_name", header: "Principal Name" },
                  ]}
                  loadOptions={async () => {
                    const res = await getWmsMaster("principal", { page: 1, limit: 100000 });
                    return res.tableData as TMoc[];
                  }}
                  onChange={(value) => setpopBillActform((c) => ({ ...c, prin_to: value }))}
                  compact
                />
              </Field>
            </div>
          </SectionPanel>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPopulateOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            <Button disabled type="submit">
              <Save size={15} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={ActOpen}
        title="Delete Activity"
        description={
          deleteTarget ? `Delete ${deleteTarget.act_code} - ${deleteTarget.activity}?` : undefined
        }
        compact
        tone="danger"
        onClose={() => setActOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setActOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} variant="destructive" onClick={confirmDelete}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">Are you sure you want to delete?</p>
      </Dialog>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */
function mapBillingActivity(row: Record<string, unknown>): TBillingActivity {
  return {
    prin_code: text(row.prin_code ?? row.PRIN_CODE),
    activity: text(row.activity ?? row.ACTIVITY),
    act_code: text(row.act_code ?? row.ACT_CODE),
    jobtype: text(row.jobtype ?? row.JOBTYPE),
    uoc: text(row.uoc ?? row.UOC),
    moc1: text(row.moc1 ?? row.MOC1),
    moc2: text(row.moc2 ?? row.MOC2),
    cost: Number(row.cost ?? row.COST ?? 0),
    bill_amount: Number(row.bill_amount ?? row.BILL_AMOUNT ?? 0),
    inb_show: text(row.inb_show ?? row.INB_SHOW),
    company_code: text(row.company_code ?? row.COMPANY_CODE),
    freeze_flag: text(row.freeze_flag ?? row.FREEZE_FLAG),
    mandatory_flag: text(row.mandatory_flag ?? row.MANDATORY_FLAG),
  };
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}