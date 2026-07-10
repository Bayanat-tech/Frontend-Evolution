  import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
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
  import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
  import { Input } from "../../../components/ui/Input";
  import { LookupField } from "../../../components/ui/LookupField";


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

  type TPrincipal = {
    prin_code: string;
    prin_name: string;
  };

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

  type PopulateBillingActivity ={
    prin_from : string,
    prin_to : string,
  };

  const emptyPopBillAct : PopulateBillingActivity ={
    prin_from : '',
    prin_to : '',
  }

  export function WmsBillingActPage() {
    const { user } = useAuth();
    const [rows, setRows] = useState<TBillingActivity[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(100);
    const [totalRows, setTotalRows] = useState(0);
    // const [formOpen, setFormOpen] = useState(false);  
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState<TBillingActivity>(emptyBillingActivity);
    // const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [popBillActform, setpopBillActform] = useState<PopulateBillingActivity>(emptyPopBillAct);
    const [openDailog , setOpenDailog] =useState<"add" | "populate" | null>(null);

    // Principal filter
    const [prinCode, setPrinCode] = useState("");
    const [principals, setPrincipals] = useState<TPrincipal[]>([]);

    //Dialog for Activity delete
    const [ActOpen, setActOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<TBillingActivity | null>(null);

    //Toast
    const {toast} = useToast();


    // Load principals for the filter dropdown
    useEffect(() => {
      getWmsMaster("principal", { page: 1, limit: 100000 })
        .then((res) => {
          setPrincipals(
            (res.tableData as Record<string, unknown>[]).map((r) => ({
              prin_code: String(r.PRIN_CODE ?? r.prin_code ?? ""),
              prin_name: String(r.PRIN_NAME ?? r.prin_name ?? r.PRIN_CODE ?? ""),
            }))
          );
        })
        .catch(() => {});
    }, []);

    const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
      setLoading(true);
      // setNotice(null);
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
        // setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load billing activities" });
        toast.error( error instanceof Error ? error.message : "Unable to load billing activities")
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
        Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term))
      );
    }, [query, rows]);

    const openPopBillAct = () =>{
      console.log('openPopBillAct hit');
      if (!prinCode) {
        // setNotice({ type: "error", message: "Please select a principal first" });
        toast.warning("Please select a Principal first");
        return;
      }
      setpopBillActform({ ...emptyPopBillAct, prin_from: prinCode || "" });
      setOpenDailog('populate');
    }

    const openAdd = () => {
      console.log('openAdd hit');
      if (!prinCode) {
        // setNotice({ type: "error", message: "Please select a principal first" });
        toast.warning("Please select a Principal first");
        return;
      }
      setEditMode(false);
      setForm({ ...emptyBillingActivity, prin_code: prinCode, company_code: user?.company_code || "" });
      setOpenDailog('add');
      // setNotice(null);
    };

    const openEdit = (row: TBillingActivity) => {
      setEditMode(true);
      setForm(row);
      setOpenDailog('add');
      // setNotice(null);
    };

    const saveBillActivity = async (event: FormEvent) => {
      event.preventDefault();
      if (!form.prin_code.trim() || !form.act_code?.trim()) {
        // setNotice({ type: "error", message: "Principal and Activity are required" });
        toast.warning("Principal and Activity are required");
        return;
      }
      setSaving(true);
      // setNotice(null);
      try {
        if(editMode){
        console.log('hit edit mode api');
        await upsertMsActivityBillingApi(
          { ...form, company_code: form.company_code || user?.company_code || "" },
        );
        }else{
        await postWmsBillingActivity(
          { ...form, company_code: form.company_code || user?.company_code || "" },
        );
        }
        setOpenDailog(null);
        // setNotice({ type: "success", message: editMode ? "Activity updated successfully" : "Activity added successfully" });
        toast.success( editMode ? "Activity updated successfully" : "Activity added successfully")
        await loadRows(pageIndex, pageSize);
      } catch (error) {
        // setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save Activity" });
        toast.error( error instanceof Error ? error.message : "Unable to save Activity")
      } finally {
        setSaving(false);
      }
    };

    // Open password dialog instead of deleting directly
    const requestDelete = (row: TBillingActivity) => {
      setDeleteTarget(row);
      setActOpen(true);
    };

    const confirmDelete = async () => {
      if (!deleteTarget) return;
      setSaving(true);
      // setNotice(null);
      try {
        await executeDynamicDelete({parameter: "BILLING_ACTIVITY_DET_PRINCIPAL",
                loginid: user?.loginid || "",
                code1: user?.company_code || "",
                code2: deleteTarget.prin_code || "",
                code3: deleteTarget.act_code || "",
                code4: deleteTarget.jobtype || "",
            });
        setActOpen(false);
        setDeleteTarget(null);
        // setNotice({ type: "success", message: "Activity deleted successfully" });
        toast.success("Activity deleted successfully")
        await loadRows(pageIndex, pageSize);
      } catch (error) {
        // setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete activity" });
        toast.error( error instanceof Error ? error.message : "Unable to delete activity")
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
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(row.original)} title="Edit activity">
                <Edit2 size={14} />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => requestDelete(row.original)} title="Delete activity">
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
        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">WMS Master</p>
            <h1 className="m-0 text-2xl font-semibold text-foreground">Activity Billing</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => loadRows()}>
              <RefreshCw size={15} /> Refresh
            </Button>
            <Button onClick={openAdd} disabled={!prinCode}>
              <Plus size={15} /> Add Activity
            </Button>
            <Button onClick={openPopBillAct} disabled={!prinCode}>
              <Plus size={15} /> Populate Activities
            </Button>
          </div>
        </div>

        {/* {notice && <div className={notice.type === "error" ? "alert error" : "alert success"}>{notice.message}</div>} */}

        {/* ── Principal Filter ── */}
        <div className="flex items-center gap-3">
          <label className="field" style={{ minWidth: 260 }}>
            <span>Principal</span>
            <Select
              value={prinCode}
              onChange={(e) => { setPrinCode(e.target.value); setPageIndex(0); }}
            >
              <option value="">— All Principals —</option>
              {principals.map((p) => (
                <option key={p.prin_code} value={p.prin_code}>
                  {p.prin_name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {/* ── Table ── */}
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
          onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPageIndex(0); }}
          getRowId={(row) => (row.act_code ?? "") + (row.jobtype ?? "")}
        />

        <Dialog
        open={openDailog === "populate"}
        title={"Populate Activities"}
        compact
        onClose={() => setOpenDailog(null)}
        >
          <form className="grid gap-4">
            <Card>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Field label="From Principal" required>
                  <Input disabled value={popBillActform.prin_from} />
                </Field>

                <LookupField
                  label="To Principal"
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
                />

              </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenDailog(null)}>
                <X size={15} /> Cancel
              </Button>
              <Button disabled type="submit">
                <Save size={15} /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* ── Add / Edit Form Dialog ── */}
        <Dialog
          open={openDailog === "add"}
          title={editMode ? "Edit Activity" : "Add Activity"}
          description="Activity information"
          compact
          onClose={() => setOpenDailog(null)}
          wide
        >
          <form className="grid gap-4" onSubmit={saveBillActivity}>
            <Card>
              <CardHeader>
                <div>
                  <p className="eyebrow">Activity Info</p>
                  <h2 className="m-0 text-sm font-semibold">Basic Details</h2>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Field label="Principal Code" required>
                  <Input disabled value={form.prin_code} />
                </Field>

                <LookupField
                  disabled={editMode}
                  label="Activity"
                  value={form.act_code ?? ''}
                  columns={[
                    { field: "act_code", header: "Activity Code" },
                    { field: "ACTIVITY", header: "Activity" },
                  ]}
                  valueField= "act_code"
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
                />

                <Field label="Job Type"  required>
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

                <LookupField
                    label="UOC"
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
                />


                <LookupField
                  label="MOC1"
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
                />

                <LookupField
                  label="MOC2"
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
                />

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
                    onChange={(e) => setForm((c) => ({ ...c, freeze_flag: e.target.value as "Y" | "N" }))}
                  >
                    <option value="N">No</option>
                    <option value="Y">Yes</option>
                  </Select>
                </Field>

                <Field label="Mandatory Flag">
                  <Select
                    value={form.mandatory_flag ?? "N"}
                    onChange={(e) => setForm((c) => ({ ...c, mandatory_flag: e.target.value as "Y" | "N" }))}
                  >
                    <option value="N">No</option>
                    <option value="Y">Yes</option>
                  </Select>
                </Field>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenDailog(null)}>
                <X size={15} /> Cancel
              </Button>
              <Button disabled={saving} type="submit">
                <Save size={15} /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* ── Delete Password Dialog ── */}
        <Dialog
          open={ActOpen}
          title="Delete Activity"
          description={deleteTarget ? `Delete ${deleteTarget.act_code} - ${deleteTarget.activity}?` : undefined}
          compact
          tone="danger"
          onClose={() => { setActOpen(false) }}
          footer={
            <>
              <Button variant="outline" onClick={() => { setActOpen(false)}}>
                Cancel
              </Button>
              <Button
                disabled={saving}
                variant="destructive"
                onClick={confirmDelete}
              >
                {saving ? "Deleting..." : "Delete"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <p className="m-0 text-sm text-muted-foreground">Are you sure you want to delete?</p>
          </div>
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
      freeze_flag : text(row.freeze_flag ?? row.FREEZE_FLAG),
      mandatory_flag :text(row.mandatory_flag ?? row.MANDATORY_FLAG),
    };
  }

  function text(value: unknown) {
    return value === null || value === undefined ? "" : String(value);
  }