import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, BarChart3, Check, CheckCircle2, ChevronDown, Edit2, Eye, FileText, Paperclip, Plus, Printer, RefreshCw, RotateCcw, Save, Search, Send, Trash2, Users, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDynamicLookup } from "../../api/lookups";
import { pamsCommonProcedure, pamsDelete, pamsPopulateDepartmentKpi, pamsSave, pamsSelect, pamsUpdateRatings, type PamsProcedureParams } from "../../api/pams";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/PamsDataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { NoticeToast } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import type { LookupRow } from "../../api/lookups";

type Row = Record<string, unknown>;

type PamsField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  required?: boolean;
  disabledOnEdit?: boolean;
  readOnly?: boolean;
  table?: boolean;
  width?: number;
  display?: (row: Row) => unknown;
  lookup?: {
    parameter: string;
    value: string;
    label: string;
    dependsOn?: string;
    code1From?: string;
    code2From?: string;
    code3From?: string;
    code4From?: string;
  };
};

type PamsMasterConfig = {
  title: string;
  subtitle: string;
  routeKeys: string[];
  listParameter: string;
  saveParameter?: string;
  deleteParameter?: string;
  keyFields: string[];
  fields: PamsField[];
  defaults?: Row;
  buildSave?: (form: Row, ctx: PamsContext) => Row;
  buildDelete?: (row: Row, ctx: PamsContext) => Row;
};

type PamsContext = {
  companyCode: string;
  loginid: string;
  editMode: boolean;
  original: Row | null;
  lookups: Record<string, Row[]>;
};

export const pamsMasterConfigs: Record<string, PamsMasterConfig> = {
  appraisalCategory: {
    title: "Appraisal Categories",
    subtitle: "Maintain appraisal category codes and descriptions.",
    routeKeys: ["appraisal_categories", "kpi_type", "appraisal-category"],
    listParameter: "kpi_type",
    saveParameter: "kpi_type_ins_upd",
    deleteParameter: "delete_kpi_type",
    keyFields: ["KPI_TYPE_CODE"],
    fields: [
      { name: "KPI_TYPE_CODE", label: "Kpi Type Code", disabledOnEdit: true, table: true, width: 170 },
      { name: "KPI_TYPE_DESC", label: "Kpi Type Desc", required: true, table: true, width: 260 },
    ],
    buildSave: (form, ctx) => ({
      val1s1: ctx.companyCode,
      val1s2: text(form.KPI_TYPE_CODE),
      val1s3: text(form.KPI_TYPE_DESC),
      wval1s1: ctx.companyCode,
      wval1s2: text(form.KPI_TYPE_CODE),
    }),
    buildDelete: (row, ctx) => ({ code1: text(row.KPI_TYPE_CODE), code2: ctx.companyCode }),
  },

  departmentKpi: {
    title: "KPI Assignment",
    subtitle: "Assign KPIs to division, department, and employee scope.",
    routeKeys: ["department_kpi", "kpi_assignment"],
    listParameter: "kpi_assignment_page",
    saveParameter: "dept_kpi_ins_upd",
    deleteParameter: "delete_dept_kpi",
    keyFields: ["KPI_CODE", "EMPLOYEE_CODE"],
    fields: assignmentFields("KPI", "kpi"),
    buildSave: (form, ctx) => assignmentSave(form, ctx, "KPI"),
    buildDelete: (row, ctx) => assignmentDelete(row, ctx),
  },
  skill: {
    title: "Skill",
    subtitle: "Maintain skill appraisal library.",
    routeKeys: ["skill"],
    listParameter: "skill",
    saveParameter: "skill_ins_upd",
    deleteParameter: "delete_skill",
    keyFields: ["SKILL_CODE"],
    fields: libraryFields("SKILL", false),
    buildSave: (form, ctx) => ({
      val1s1: ctx.companyCode,
      val1s2: text(form.SKILL_CODE),
      val1s3: text(form.SKILL_DESC),
      val1s4: text(form.DIVISION_CODE),
      val1s5: lookupLabel(ctx.lookups.DIVISION_CODE, "DIV_CODE", "DIV_NAME", form.DIVISION_CODE),
      val1s6: text(form.DEPARTMENT_CODE),
      val1s7: lookupLabel(ctx.lookups.DEPARTMENT_CODE, "DEPT_CODE", "DEPT_NAME", form.DEPARTMENT_CODE),
      val1s8: text(form.SECTION_CODE),
      val1s9: lookupLabel(ctx.lookups.SECTION_CODE, "SECTION_CODE", "SECTION_NAME", form.SECTION_CODE),
      val1s10: text(form.DESG_CODE),
    }),
    buildDelete: (row, ctx) => ({ code1: text(row.SKILL_CODE), code2: ctx.companyCode }),
  },
  goal: {
    title: "Goal",
    subtitle: "Maintain goal appraisal library.",
    routeKeys: ["goal"],
    listParameter: "goal",
    saveParameter: "goal_ins_upd",
    deleteParameter: "delete_goal",
    keyFields: ["GOAL_CODE"],
    fields: libraryFields("GOAL", true),
    buildSave: (form, ctx) => ({
      val1s1: ctx.companyCode,
      val1s2: text(form.GOAL_CODE),
      val1s3: text(form.GOAL_DESC),
      val1s4: text(form.DIVISION_CODE),
      val1s5: text(form.DEPARTMENT_CODE),
      val1s6: text(form.SECTION_CODE),
      val1s7: text(form.DESG_CODE),
      val1n1: number(form.STANDARD_WEIGHTAGE),
    }),
    buildDelete: (row, ctx) => ({ code1: text(row.GOAL_CODE), code2: ctx.companyCode }),
  },
  rating: {
    title: "Rating Scale",
    subtitle: "Maintain appraisal rating scale and score ranges.",
    routeKeys: ["rating_scale", "rating"],
    listParameter: "rating",
    saveParameter: "rating_ins_upd",
    deleteParameter: "delete_rating",
    keyFields: ["RATING_CODE"],
    fields: [
      { name: "RATING_CODE", label: "Rating Code", disabledOnEdit: true, table: true, width: 140 },
      { name: "RATING_DESC", label: "Rating Desc", required: true, table: true, width: 280 },
      { name: "DIVISION_CODE", label: "Division", type: "select", lookup: { parameter: "division", value: "DIV_CODE", label: "DIV_NAME" }, table: false },
      { name: "DEPARTMENT_CODE", label: "Department", type: "select", lookup: { parameter: "department", value: "DEPT_CODE", label: "DEPT_NAME", dependsOn: "DIVISION_CODE", code2From: "DIVISION_CODE" }, table: false },
      { name: "SECTION_CODE", label: "Section", type: "select", lookup: { parameter: "section", value: "SECTION_CODE", label: "SECTION_NAME", dependsOn: "DEPARTMENT_CODE", code2From: "DIVISION_CODE", code3From: "DEPARTMENT_CODE" }, table: false },
    ],
    buildSave: (form, ctx) => ({
      val1s1: ctx.companyCode,
      val1s2: text(form.RATING_CODE),
      val1s3: text(form.RATING_DESC),
      val1s4: text(form.DIVISION_CODE),
      val1s5: text(form.DEPARTMENT_CODE),
      val1s6: text(form.SECTION_CODE),
    }),
    buildDelete: (row, ctx) => ({ code1: text(row.RATING_CODE), code2: ctx.companyCode }),
  },
  skillAssignment: {
    title: "Skill Assignment",
    subtitle: "Assign skills to employees or organization scope.",
    routeKeys: ["skill_assignment"],
    listParameter: "dept_kpi",
    saveParameter: "dept_kpi_ins_upd",
    deleteParameter: "delete_dept_kpi",
    keyFields: ["KPI_CODE", "EMPLOYEE_CODE"],
    fields: assignmentFields("SKILL", "skill"),
    defaults: { ITEM_TYPE: "SKILL" },
    buildSave: (form, ctx) => assignmentSave(form, ctx, "SKILL"),
    buildDelete: (row, ctx) => assignmentDelete(row, ctx),
  },
  goalAssignment: {
    title: "Goal Assignment",
    subtitle: "Assign goals to employees or organization scope.",
    routeKeys: ["goal_assignment"],
    listParameter: "dept_kpi",
    saveParameter: "dept_kpi_ins_upd",
    deleteParameter: "delete_dept_kpi",
    keyFields: ["KPI_CODE", "EMPLOYEE_CODE"],
    fields: assignmentFields("GOAL", "goal"),
    defaults: { ITEM_TYPE: "GOAL" },
    buildSave: (form, ctx) => assignmentSave(form, ctx, "GOAL"),
    buildDelete: (row, ctx) => assignmentDelete(row, ctx),
  },
  period: {
    title: "Appraisal Period Setup",
    subtitle: "Maintain appraisal period dates.",
    routeKeys: ["appraisal_period_setup", "period_setup"],
    listParameter: "period",
    saveParameter: "period_ins_upd",
    deleteParameter: "delete_kpi_period",
    keyFields: ["PERIOD_NUMBER"],
    fields: [
      { name: "PERIOD_NUMBER", label: "Period Number", disabledOnEdit: true, table: true, width: 150, display: (row) => formatPeriodQuarter(row) },
      { name: "PERIOD_FROM_DATE", label: "From Date", type: "date", required: true, table: true, width: 160, display: (row) => formatDateDisplay(row.PERIOD_FROM_DATE), },
      { name: "PERIOD_TO_DATE", label: "To Date", type: "date", required: true, table: true, width: 160, display: (row) => formatDateDisplay(row.PERIOD_TO_DATE), },
    ],
    buildSave: (form, ctx) => ({
      val1s1: text(form.PERIOD_NUMBER),
      val1s2: formatProcedureDate(form.PERIOD_FROM_DATE),
      val1s3: formatProcedureDate(form.PERIOD_TO_DATE),
      val1s4: ctx.companyCode,
    }),
    buildDelete: (row, ctx) => ({ code1: text(row.PERIOD_NUMBER), code2: ctx.companyCode }),
  },
};

export function PamsDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [metrics, setMetrics] = useState<Row[]>([]);
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  const loadDashboard = async () => {
    setLoading(true);
    setNotice("");
    try {
      const [total, division, department, section] = await Promise.all([
        pamsSelect({ parameter: "employee_hierarchy_total", loginid, code1: companyCode }),
        pamsSelect({ parameter: "employee_division", loginid, code1: companyCode }),
        pamsSelect({ parameter: "employee_department", loginid, code1: companyCode }),
        pamsSelect({ parameter: "employee_section", loginid, code1: companyCode }),
      ]);
      setMetrics([
        { label: "Employees", value: total.length ? Object.values(total[0])[0] : 0, group: "Total" },
        { label: "Divisions", value: division.length, group: "Hierarchy" },
        { label: "Departments", value: department.length, group: "Hierarchy" },
        { label: "Sections", value: section.length, group: "Hierarchy" },
      ]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load PAMS dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [loginid, companyCode]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Performance Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Appraisal coverage, hierarchy scope, and active performance work.</p>
        </div>
        <Button variant="outline" onClick={loadDashboard}><RefreshCw size={15} /> Refresh</Button>
      </div>
      <NoticeToast notice={notice ? { type: "error", message: notice } : null} onClose={() => setNotice("")} />
      <div className="grid gap-3 md:grid-cols-4">
        {(loading ? [{}, {}, {}, {}] : metrics).map((item, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><BarChart3 size={18} /></span>
                <Badge variant="secondary">{text(item.group || "PAMS")}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{loading ? "..." : text(item.value)}</div>
              <div className="text-sm text-muted-foreground">{loading ? "Loading" : text(item.label)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PamsProcedureTable title="Appraisal Overview" parameter="Trn_appraisal" />
    </section>
  );
}

export function PamsMasterPage({ config, extraActions, hideRefresh, headerActions, }: { config: PamsMasterConfig; extraActions?: (row: Row, reload: () => void) => ReactNode; hideRefresh?: boolean; headerActions?: ReactNode; }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [original, setOriginal] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [lookups, setLookups] = useState<Record<string, Row[]>>({});
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code || "";
  const tableFields = config.fields.filter((field) => field.table !== false);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await pamsSelect({ parameter: config.listParameter, loginid, code1: companyCode });
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to load ${config.title}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [config.listParameter, loginid, companyCode]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    ...tableFields.map((field) => ({
      accessorKey: field.name,
      header: field.label,
      size: field.width || 160,
      cell: ({ row }: { row: { original: Row } }) => formatValue(field.display ? field.display(row.original) : row.original[field.name]),
    })),
    {
      id: "actions",
      header: "Actions",
      size: extraActions ? 200 : 110,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" title="View" onClick={() => openView(row.original)}><Eye size={14} /></Button>
          <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(row.original)}><Edit2 size={14} /></Button>
          <Button size="icon" variant="ghost" title="Delete" disabled={!config.deleteParameter} onClick={() => setDeleteTarget(row.original)}><Trash2 size={14} /></Button>
          {extraActions?.(row.original, loadRows)}
        </div>
      ),
    },
  ], [config, tableFields]);

  const makeEmpty = () => ({ COMPANY_CODE: companyCode, ...config.defaults });

  const openAdd = () => {
    setEditMode(false);
    setViewMode(false);
    setOriginal(null);
    setForm(makeEmpty());
    setFormOpen(true);
    void loadLookups(makeEmpty());
  };

  const openEdit = (row: Row) => {
    setEditMode(true);
    setViewMode(false);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row });
    setFormOpen(true);
    void loadLookups({ ...makeEmpty(), ...row });
  };

  const openView = (row: Row) => {
    setEditMode(false);
    setViewMode(true);
    setOriginal(row);
    setForm({ ...makeEmpty(), ...row });
    setFormOpen(true);
    void loadLookups({ ...makeEmpty(), ...row });
  };

  const loadLookups = async (currentForm: Row) => {
    const lookupFields = config.fields.filter((field) => field.lookup);
    const result: Record<string, Row[]> = {};
    await Promise.all(lookupFields.map(async (field) => {
      const lookup = field.lookup!;
      if (lookup.dependsOn && !currentForm[lookup.dependsOn]) {
        result[field.name] = [];
        return;
      }
      try {
        result[field.name] = (await pamsSelect({
          parameter: lookup.parameter,
          loginid,
          code1: lookup.code1From ? text(currentForm[lookup.code1From]) : companyCode,
          code2: lookup.code2From ? text(currentForm[lookup.code2From]) : "NULL",
          code3: lookup.code3From ? text(currentForm[lookup.code3From]) : "NULL",
          code4: lookup.code4From ? text(currentForm[lookup.code4From]) : "NULL",
        })).map(normalizeRow);
      } catch {
        result[field.name] = [];
      }
    }));
    setLookups(result);
  };

  const updateField = (name: string, value: unknown) => {
    const next = { ...form, [name]: value };
    if (name === "DIVISION_CODE") {
      next.DEPARTMENT_CODE = "";
      next.SECTION_CODE = "";
      next.DESG_CODE = "";
    }
    if (name === "DEPARTMENT_CODE") {
      next.SECTION_CODE = "";
      next.DESG_CODE = "";
    }
    setForm(next);
    void loadLookups(next);
  };

  const saveRecord = async (event: FormEvent) => {
    event.preventDefault();
    const missing = config.fields.find((field) => field.required && !text(form[field.name]).trim());
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    if (!config.saveParameter) return;
    setSaving(true);
    setNotice(null);
    try {
      const ctx = { companyCode, loginid, editMode, original, lookups };
      const extra = config.buildSave?.(form, ctx) || genericSaveValues(config.fields, form, companyCode);
      await pamsSave({ parameter: config.saveParameter, loginid, ...extra });
      setFormOpen(false);
      setNotice({ type: "success", message: `${config.title} saved successfully` });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to save ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !config.deleteParameter) return;
    setSaving(true);
    setNotice(null);
    try {
      const ctx = { companyCode, loginid, editMode: false, original: deleteTarget, lookups };
      await pamsDelete({ parameter: config.deleteParameter, loginid, ...(config.buildDelete?.(deleteTarget, ctx) || genericDeleteValues(config.keyFields, deleteTarget, companyCode)) });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `${config.title} deleted successfully` });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : `Unable to delete ${config.title}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">{config.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex gap-2">
          {!hideRefresh && <Button
            size="sm"
            variant="outline"
            onClick={() => void loadRows()}
          >
            <RefreshCw size={13} /> Refresh
          </Button>}
          <Button
            size="sm"
            variant="default"
            disabled={!config.saveParameter}
            onClick={openAdd}
          >
            <Plus size={13} /> Add
          </Button>
          {headerActions}
        </div>
      </div>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle={`${config.title} List`}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
        loading={loading}
        height={620}
        minWidth={Math.max(980, tableFields.reduce((sum, field) => sum + (field.width || 160), 180))}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => config.keyFields.map((key) => text(row[key])).join("_") || `${config.listParameter}_${index}`}
      />
      <Dialog
        open={formOpen}
        wide
        title={viewMode ? `View ${config.title}` : editMode ? `Edit ${config.title}` : `Add ${config.title}`}
        description="Maintain setup using the existing Bayanat backend rules."
        onClose={() => setFormOpen(false)}
      >
        <form className="grid gap-4" onSubmit={saveRecord}>
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <div>
                <p className="eyebrow">Details</p>
                <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
              {config.fields.map((field) => (
                <Field label={field.label} required={field.required} key={field.name}>
                  {renderField(field, form[field.name], Boolean(viewMode || field.readOnly || (editMode && field.disabledOnEdit)), lookups[field.name] || [], (value) => updateField(field.name, value))}
                </Field>
              ))}
            </CardContent>
          </Card>
          <div className="sticky bottom-0 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}><X size={15} /> Cancel</Button>
            {!viewMode && <Button disabled={saving} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save"}</Button>}
          </div>
        </form>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} compact tone="danger" title={`Delete ${config.title}`} onClose={() => setDeleteTarget(null)} footer={<><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={confirmDelete}>Delete</Button></>}>
        <p className="m-0 text-sm text-muted-foreground">Please confirm to delete the selected record.</p>
      </Dialog>
    </section>
  );
}

export function PeriodProcessButton() {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const [notifying, setNotifying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const notifyHods = async () => {
    setNotifying(true);
    setResultMsg(null);
    try {
      const result = await pamsCommonProcedure({
        parameter: "PROC_NOTIFY_HOD_FOR_PERIOD",
        loginid,
        val1s1: companyCode,
        val1s2: "ALL",   // procedure ab ALL handle karta hai
        val1s3: loginid,
      });

      // result.data mein out_msg aa sakta hai backend se
      const msg = (result as Record<string, unknown>)?.out_msg
        || (result as Record<string, unknown>)?.message
        || "Notification sent successfully for all periods";

      setResultMsg({ type: "success", message: String(msg) });
    } catch (error) {
      setResultMsg({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to send HOD notifications",
      });
    } finally {
      setNotifying(false);
    }
  };

  const handleClose = () => {
    setConfirmOpen(false);
    setResultMsg(null);
  };

  return (
    <>
      <Button
        size="sm"
        variant="default"
        disabled={notifying}
        onClick={() => setConfirmOpen(true)}
        title="Send notification to all HODs for all periods"
      >
        {notifying
          ? <><RefreshCw size={13} className="animate-spin" /> Sending...</>
          : <><Send size={13} /> Process</>
        }
      </Button>

      <Dialog
        open={confirmOpen}
        compact
        title="Notify HODs"
        onClose={handleClose}
        footer={
          resultMsg ? (
            <Button variant="outline" onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button disabled={notifying} onClick={() => void notifyHods()}>
                <Send size={14} /> {notifying ? "Sending..." : "Yes, Send Notification"}
              </Button>
            </>
          )
        }
      >
        <div className="grid gap-3 text-sm text-muted-foreground">
          {resultMsg ? (
            <div className={`rounded-md px-3 py-2 text-sm font-medium ${resultMsg.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}>
              {resultMsg.message}
            </div>
          ) : (
            <>
              <p className="m-0">
                This will send an email to <strong>all Department Heads</strong> to generate
                KPI appraisal documents for their employees across <strong>all active periods</strong>.
              </p>
              <p className="m-0">Do you want to proceed?</p>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}

export function PamsTaskPage() {
  const navigate = useNavigate();
  const [activeStatus, setActiveStatus] = useState("PENDING");
  const [headerForm, setHeaderForm] = useState<{ open: boolean; row: Row | null; mode: "edit" | "view" }>({ open: false, row: null, mode: "edit" });
  const [reloadToken, setReloadToken] = useState(0);
  const statuses = ["PENDING", "IN PROGRESS", "REJECTED", "SENT BACK", "APPROVED"];
  const openTask = (row: Row, mode: "view") => {
    const docNo = getAppraisalDocNo(row);
    if (!docNo) return;
    const params = new URLSearchParams({
      mode,
      employee_code: text(row.EMPLOYEE_CODE || row.EMP_CODE || row.employee_code),
      employee_name: text(row.EMPLOYEE_NAME || row.RPT_NAME || row.employee_name),
      designation: text(row.DESG_NAME || row.DESIGNATION || row.designation),
      department: text(row.DEPT_NAME || row.DEPARTMENT_NAME || row.department),
    });
    navigate(`/workspace/pams/activity/request/my_task/view/${encodeURIComponent(docNo)}?${params.toString()}`, { state: row });
  };

  return (
    <>
      <PamsProcedureTable
        title="My Task"
        parameter="Trn_appraisal"
        icon={<FileText size={18} />}
        columnsOverride={myTaskColumns()}
        extraParams={{ code3: activeStatus }}
        reloadToken={reloadToken}
        toolbarTop={
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Button key={status} type="button" size="sm" variant={activeStatus === status ? "default" : "outline"} onClick={() => setActiveStatus(status)}>
                {status === "APPROVED" ? "Closed" : titleCase(status)}
              </Button>
            ))}
          </div>
        }
        actionColumn={(row) => {
          const docNo = getAppraisalDocNo(row);
          return (
            <>
              <Button size="sm" variant="outline" disabled={!docNo} onClick={() => setHeaderForm({ open: true, row, mode: "edit" })}>
                <Edit2 size={14} /> Edit
              </Button>
              <Button size="sm" variant="outline" disabled={!docNo} onClick={() => openTask(row, "view")}>
                <Eye size={14} /> View
              </Button>
            </>
          );
        }}
      />
      <PamsAppraisalHeaderDialog
        open={headerForm.open}
        row={headerForm.row}
        mode={headerForm.mode}
        onClose={(saved) => {
          setHeaderForm({ open: false, row: null, mode: "edit" });
          if (saved) setReloadToken((value) => value + 1);
        }}
      />
    </>
  );
}

export function PamsReportPage({ type }: { type: "summary" | "listing" }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<Row[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Row[]>([]);
  const [filters, setFilters] = useState({ division: "ALL", department: "ALL", section: "ALL" });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const title = type === "summary" ? "Appraisal Listing Summary" : "Appraisal Listing";

  const loadRows = async () => {
    setLoading(true);
    setNotice("");
    try {
      const parameter = type === "summary" ? "appraisal_summary_division_wise" : "appraisal_summary_by_login";
      const data = await pamsSelect({
        parameter,
        loginid,
        code1: companyCode,
        code2: type === "summary" ? filters.division : "",
        code3: type === "summary" ? filters.department : "",
        code4: type === "summary" ? filters.section : "",
      });
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Unable to load ${title}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([
      pamsSelect({ parameter: "report_divisions", loginid, code1: companyCode }).then((data) => setDivisionOptions([{ CODE: "ALL", NAME: "All Divisions" }, ...data.map(normalizeRow)])).catch(() => setDivisionOptions([{ CODE: "ALL", NAME: "All Divisions" }])),
      pamsSelect({ parameter: "report_departments", loginid, code1: companyCode, code2: filters.division }).then((data) => setDepartmentOptions([{ CODE: "ALL", NAME: "All Departments" }, ...data.map(normalizeRow)])).catch(() => setDepartmentOptions([{ CODE: "ALL", NAME: "All Departments" }])),
    ]);
  }, [loginid, companyCode, filters.division]);

  useEffect(() => {
    void loadRows();
  }, [type, loginid, companyCode]);

  const columns = useMemo<ColumnDef<Row>[]>(() => autoColumns(rows), [rows]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><CheckCircle2 size={18} /></span>
          <div><h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1></div>
        </div>
        <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>
      </div>
      {type === "summary" && (
        <Card>
          <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
            <Field label="Division">
              <SearchableSelect
                value={filters.division}
                placeholder="Select division"
                onChange={(value) => setFilters((current) => ({ ...current, division: value, department: "ALL" }))}
                options={divisionOptions.map((row, index) => {
                  const value = text(row.CODE || row.DIV_CODE || row.code);
                  const label = text(row.NAME || row.DIV_NAME || row.name || value);
                  return { value, label, key: `report_div_${value}_${index}` };
                })}
              />
            </Field>
            <Field label="Department">
              <SearchableSelect
                value={filters.department}
                placeholder="Select department"
                onChange={(value) => setFilters((current) => ({ ...current, department: value }))}
                options={departmentOptions.map((row, index) => {
                  const value = text(row.CODE || row.DEPT_CODE || row.code);
                  const label = text(row.NAME || row.DEPT_NAME || row.name || value);
                  return { value, label, key: `report_dept_${value}_${index}` };
                })}
              />
            </Field>
            <Field label="Section">
              <Input value={filters.section} onChange={(event) => setFilters((current) => ({ ...current, section: event.target.value || "ALL" }))} placeholder="ALL" />
            </Field>
          </CardContent>
        </Card>
      )}
      <NoticeToast notice={notice ? { type: "error", message: notice } : null} onClose={() => setNotice("")} />
      <DataTable columns={columns} data={rows} title={`${rows.length.toLocaleString()} Records`} subtitle={title} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search ${title.toLowerCase()}...`} loading={loading} height={620} minWidth={1200} density="grid" enablePagination pageSize={100} />
    </section>
  );
}
// Kpi Assignment master page used for both department KPI assignment and skill/goal assignment, differentiated by selectedType state and itemTypes options
export function PamsDepartmentAssignmentPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Row[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedType, setSelectedType] = useState("KPI");
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const itemTypes = [
    { value: "KPI", label: "Task" },
    { value: "CHARACTERISTICS", label: "Characteristics" },
    { value: "SKILL", label: "Skill" },
    { value: "GOAL", label: "Goal" },
  ];

  useEffect(() => {
    pamsSelect({ parameter: "employee_hierarchy", loginid, code1: companyCode })
      .then((data) => setEmployees(data.map(normalizeRow)))
      .catch(() => setEmployees([]));
  }, [loginid, companyCode]);

  const loadAssignments = async (clearNotice = true) => {
    if (!selectedEmployee || !selectedType) {
      setNotice({ type: "error", message: "Select employee and item type" });
      return;
    }
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      // pamsSave ki jagah pamsSelect use karo
      await pamsSelect({
        parameter: "populate_dept_kpi",
        loginid,
        code1: companyCode,
        code2: selectedEmployee,
        code3: selectedType,
      });

      const data = await pamsSelect({
        parameter: "kpi_assignment_page",
        loginid,
        code1: companyCode,
        code2: selectedType,
        code3: selectedEmployee
      });
      const normalized = data.map(normalizeRow);
      setRows(normalized);
      setSelectedRows(Object.fromEntries(
        normalized.map((row) => [assignmentRowKey(row), true])
      ));
      setExpandedRows({});
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load assignments"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmployee && selectedType) void loadAssignments();
  }, [selectedEmployee, selectedType]);

  const saveAssignments = async () => {
    const rowsToSave = rows.filter((row) => selectedRows[assignmentRowKey(row)]);
    if (!rowsToSave.length) {
      setNotice({ type: "error", message: "Select at least one row" });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await Promise.all(rowsToSave.map((row) => pamsSave({
        parameter: "dept_kpi_ins_upd",
        loginid,
        val1s1: companyCode,
        val1s2: text(row.DIVISION_CODE || row.DIV_CODE),
        val1s3: text(row.DEPARTMENT_CODE || row.DEPT_CODE),
        val1s4: selectedEmployee,
        val1s5: text(row.KPI_CODE),
        val1s6: selectedType,
        val1n1: number(row.WEIGHTAGE || row.STANDARD_WEIGHTAGE),
        val1s7: "Y",
      })));
      setNotice({ type: "success", message: "Assignment saved successfully" });
      setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      await loadAssignments(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save assignments" });
    } finally {
      setSaving(false);
    }
  };

  const employeeOptions = employees.map((employee, index) => ({
    value: text(employee.EMPLOYEE_CODE || employee.employee_code),
    label: [employee.EMPLOYEE_CODE || employee.employee_code, employee.EMP_NAME || employee.RPT_NAME || employee.employee_name].filter(Boolean).join(" - "),
    key: `employee_${index}`,
  }));
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;
  const allSelected = rows.length > 0 && rows.every((row) => selectedRows[assignmentRowKey(row)]);
  const selectedEmployeeLabel = employeeOptions.find((option) => option.value === selectedEmployee)?.label || selectedEmployee;
  const toggleAll = () => {
    const next = !allSelected;
    setSelectedRows(Object.fromEntries(rows.map((row) => [assignmentRowKey(row), next])));
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">KPI Assignment</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select employee, item type, and save the required appraisal assignment rows.</p>
        </div>
        <div className="flex gap-2">

        </div>
      </div>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-[1.3fr_1fr]">
          <Field label="Employee" required>
            <LookupField
              compact
              label="Employee"
              value={selectedEmployee}
              displayValue={employeeOptions.find((option) => option.value === selectedEmployee)?.label || selectedEmployee}
              placeholder="Search employee"
              columns={[
                { field: "EMPLOYEE_CODE", header: "Employee Code" },
                { field: "EMP_NAME", header: "Employee Name" },
                { field: "RPT_NAME", header: "Report Name" },
              ]}
              valueField="EMPLOYEE_CODE"
              displayFields={["EMPLOYEE_CODE", "EMP_NAME", "RPT_NAME"]}
              loadOptions={async () => {
                if (employees.length) return employees as LookupRow[];
                const data = (await pamsSelect({ parameter: "employee_hierarchy", loginid, code1: companyCode })).map(normalizeRow);
                setEmployees(data);
                return data as LookupRow[];
              }}
              onChange={(value) => setSelectedEmployee(value)}
            />
          </Field>
          <Field label="Item Type" required>
            <div className="flex flex-wrap gap-2">
              {itemTypes.map((item) => (
                <Button key={item.value} type="button" variant={selectedType === item.value ? "default" : "outline"} onClick={() => setSelectedType(item.value)}>
                  {item.label}
                </Button>
              ))}
            </div>
          </Field>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CheckCircle2 size={18} /></div>
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.26em] text-primary">Assignment</p>
                <h2 className="m-0 text-base font-semibold text-foreground">KPI Assignment</h2>
                <p className="m-0 text-xs text-muted-foreground">{selectedEmployee ? selectedEmployeeLabel : "Select an employee to load assignment rows"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lastSaved && <span className="text-xs text-muted-foreground">Last saved {lastSaved}</span>}
              <Badge variant="outline">{selectedCount} / {rows.length} selected</Badge>
              <Button type="button" variant="outline" disabled={!rows.length} onClick={toggleAll}>{allSelected ? "Deselect All" : "Select All"}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 text-[11px] uppercase tracking-[0.12em] text-primary">
                <tr>
                  <th className="w-16 border-b border-border px-3 py-2 text-left">Select</th>
                  <th className="border-b border-border px-3 py-2 text-left">KPI Code - Description</th>
                  <th className="w-40 border-b border-border px-3 py-2 text-left">Weightage</th>
                  <th className="w-44 border-b border-border px-3 py-2 text-left">Division</th>
                  <th className="w-44 border-b border-border px-3 py-2 text-left">Department</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-14 text-center text-muted-foreground">Loading assignment rows...</td></tr>
                ) : !selectedEmployee ? (
                  <tr><td colSpan={5} className="px-3 py-14 text-center text-muted-foreground">Select employee and item type to load rows.</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-14 text-center text-muted-foreground">No assignment rows found.</td></tr>
                ) : rows.map((row) => {
                  const key = assignmentRowKey(row);
                  const itemRows = splitItems(row.KPI_ITEM_DESC || row.ITEM_DESC);
                  return (
                    <tr key={key} className="border-b border-border align-top hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={Boolean(selectedRows[key])} onChange={(event) => setSelectedRows((current) => ({ ...current, [key]: event.target.checked }))} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpandedRows((current) => ({ ...current, [key]: !current[key] }))}>
                          <span>
                            <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{formatValue(row.KPI_CODE)}</span>
                            <span className="ml-2 font-semibold text-foreground">{formatValue(row.KPI_DESC || row.ITEM_DESC || row.DESCRIPTION)}</span>
                            {itemRows.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{itemRows.length} item{itemRows.length === 1 ? "" : "s"}</span>}
                          </span>
                          {itemRows.length > 0 && <ChevronDown size={16} className={expandedRows[key] ? "rotate-180 transition-transform" : "transition-transform"} />}
                        </button>
                        {expandedRows[key] && itemRows.length > 0 && (
                          <div className="mt-2 grid gap-1 rounded-md border border-border bg-muted/30 p-2">
                            {itemRows.map((item, index) => <div key={`${key}_item_${index}`} className="text-xs text-muted-foreground">{index + 1}. {item}</div>)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatValue(row.WEIGHTAGE || row.STANDARD_WEIGHTAGE)}</td>
                      <td className="px-3 py-2">{orgLabel(row, "DIVISION_CODE", "DIVISION_NAME") || orgLabel(row, "DIV_CODE", "DIV_NAME")}</td>
                      <td className="px-3 py-2">{orgLabel(row, "DEPARTMENT_CODE", "DEPARTMENT_NAME") || orgLabel(row, "DEPT_CODE", "DEPT_NAME")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-border p-3">
            <Button disabled={saving || !rows.length} onClick={saveAssignments}><Save size={15} /> {saving ? "Saving..." : "Save Selection"}</Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function PamsBulkAppraisalPage() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, boolean>>({});
  const [employeeRows, setEmployeeRows] = useState<Row[]>([]);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  useEffect(() => {
    pamsSelect({ parameter: "period", loginid, code1: companyCode }).then((rows) => setPeriods(rows.map(normalizeRow))).catch(() => setPeriods([]));
  }, [loginid, companyCode]);

  const refreshBulkRows = async () => {
    if (!selectedPeriod) return;
    const rows = await pamsSelect({ parameter: "bulk_appraisal_employees_with_status", loginid, code1: companyCode, code2: selectedPeriod });
    setEmployeeRows(rows.map(normalizeRow));
  };

  useEffect(() => {
    setEmployeeRows([]);
    setSelectedEmployees({});
    if (selectedPeriod) void refreshBulkRows().catch(() => setEmployeeRows([]));
  }, [selectedPeriod]);

  const loadEmployees = async () => {
    if (!selectedPeriod) {
      setNotice({ type: "error", message: "Select period before searching employees" });
      return;
    }
    setEmployeeLoading(true);
    setNotice(null);
    try {
      const rows = (await loadBulkEmployees(loginid, companyCode, selectedPeriod)).map(normalizeRow);
      setEmployees(rows);
      setEmployeeDialogOpen(true);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load employees" });
    } finally {
      setEmployeeLoading(false);
    }
  };

  const addEmployees = async () => {
    const employeeCodes = Object.keys(selectedEmployees).filter((key) => selectedEmployees[key]);
    if (!selectedPeriod || !employeeCodes.length) {
      setNotice({ type: "error", message: "Select period and at least one employee" });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await pamsCommonProcedure({ parameter: "PROC_INSERT_GT_PROCESS_APPRAISAL_DOC_BULK", loginid, val1s1: companyCode, val1s2: selectedPeriod, val1s3: employeeCodes.join(",") });
      await refreshBulkRows();
      setNotice({ type: "success", message: "Employees added to appraisal queue" });
      setEmployeeDialogOpen(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to add employees" });
    } finally {
      setLoading(false);
    }
  };

  const process = async () => {
    if (!selectedPeriod || !employeeRows.length) {
      setNotice({ type: "error", message: "Load employees before processing appraisal documents" });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const employeeCodes = employeeRows.map((row) => text(row.EMPLOYEE_CODE || row.employee_code)).filter(Boolean).join(",");
      await pamsCommonProcedure({ parameter: "PROC_CREATE_APPRAISAL_DOC_BULK", loginid, val1s1: companyCode, val1s2: selectedPeriod, val1s3: employeeCodes });
      await refreshBulkRows();
      setNotice({ type: "success", message: "Bulk appraisal documents processed successfully" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to process appraisals" });
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => bulkAppraisalColumns(), []);
  const filteredEmployees = employees.filter((employee) => formatEmployeeLabel(employee).toLowerCase().includes(employeeSearch.toLowerCase()));
  const selectedCount = Object.values(selectedEmployees).filter(Boolean).length;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="m-0 text-2xl font-semibold">Bulk Appraisal</h1><p className="mt-1 text-sm text-muted-foreground">Create appraisal documents for selected employees and period.</p></div>
      </div>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Period" required>
            <SearchableSelect
              value={selectedPeriod}
              placeholder="Search period"
              onChange={setSelectedPeriod}
              options={periods.map((period, index) => {
                const value = text(period.PERIOD_NUMBER || period.period_number);
                return { value, label: formatPeriodQuarter(period), key: `period_${value}_${index}` };
              })}
            />
          </Field>
          <Field label="Employee" required>
            <Button type="button" variant="outline" className="h-10 w-full justify-start" disabled={employeeLoading} onClick={loadEmployees}>
              <Search size={15} /> {selectedCount ? `${selectedCount} employee${selectedCount === 1 ? "" : "s"} selected` : "Search employee"}
            </Button>
          </Field>
          {/* REMOVED: Add button. ADDED: Process button */}
          <div className="flex items-end">
            <Button type="button" disabled={loading} onClick={process}>
              <Users size={15} /> {loading ? "Processing..." : "Process"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <DataTable columns={columns} data={employeeRows} title={`${employeeRows.length.toLocaleString()} Employees`} subtitle="Bulk Appraisal Status" height={520} minWidth={1300} density="grid" enablePagination pageSize={100} searchPlaceholder="Search employee, division, status..." />
      <Dialog
        open={employeeDialogOpen}
        wide
        title="Select Employees"
        onClose={() => setEmployeeDialogOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>Cancel</Button>
            <Button disabled={loading || selectedCount === 0} onClick={addEmployees}>
              <Plus size={15} /> Add Selected
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Input
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
            placeholder="Search employee code or name"
          />
          <div className="max-h-[460px] overflow-auto rounded-lg border border-border">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-10" />
                <col className="w-[22%]" />
                <col className="w-[30%]" />
                <col className="w-[48%]" />
              </colgroup>
              <thead className="sticky top-0 bg-muted text-[11px] uppercase tracking-[0.12em] text-primary">
                <tr>
                  <th className="border-b border-border px-3 py-2 text-left">
                    {/* Select All checkbox */}
                    <input
                      type="checkbox"
                      checked={
                        filteredEmployees.length > 0 &&
                        filteredEmployees.every((e) => Boolean(selectedEmployees[text(e.EMPLOYEE_CODE || e.employee_code)]))
                      }
                      onChange={(event) => {
                        const next = { ...selectedEmployees };
                        filteredEmployees.forEach((e) => {
                          next[text(e.EMPLOYEE_CODE || e.employee_code)] = event.target.checked;
                        });
                        setSelectedEmployees(next);
                      }}
                    />
                  </th>
                  <th className="border-b border-border px-3 py-2 text-left">Employee ID</th>
                  <th className="border-b border-border px-3 py-2 text-left">Employee Code</th>
                  <th className="border-b border-border px-3 py-2 text-left">Employee Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">No employees found.</td></tr>
                ) : filteredEmployees.map((employee, index) => {
                  const code = text(employee.EMPLOYEE_CODE || employee.employee_code);
                  return (
                    <tr key={`${code}_${index}`} className="border-b border-border hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={Boolean(selectedEmployees[code])} onChange={(event) => setSelectedEmployees((current) => ({ ...current, [code]: event.target.checked }))} />
                      </td>
                      <td className="truncate px-3 py-2">{formatValue(employee.EMPLOYEE_ID || employee.employee_id)}</td>
                      <td className="truncate px-3 py-2 font-medium text-foreground">{formatValue(employee.EMPLOYEE_CODE || employee.employee_code)}</td>
                      <td className="truncate px-3 py-2">{formatValue(employee.RPT_NAME || employee.EMP_NAME || employee.employee_name)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

export function PamsAppraisalViewPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const [activeTab, setActiveTab] = useState("task");
  const [rowsByTab, setRowsByTab] = useState<Record<string, Row[]>>({});
  const [appraiserComment, setAppraiserComment] = useState("");
  const [appraiseeComment, setAppraiseeComment] = useState("");
  const [flowLevel, setFlowLevel] = useState(0);
  const [finalApproved, setFinalApproved] = useState("NO");
  const [sentBackOpen, setSentBackOpen] = useState(false);
  const [sentBackLevels, setSentBackLevels] = useState<Row[]>([]);
  const [sentBackLevel, setSentBackLevel] = useState("");
  const [sentBackReason, setSentBackReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const docNo = decodeURIComponent(location.pathname.split("/view/")[1] || "");
  const stateRow = (location.state || {}) as Row;
  const employeeCode = text(queryParams.get("employee_code") || stateRow.EMPLOYEE_CODE || stateRow.EMP_CODE || stateRow.employee_code);
  const employeeName = text(queryParams.get("employee_name") || stateRow.EMPLOYEE_NAME || stateRow.RPT_NAME || stateRow.employee_name);
  const mode = queryParams.get("mode") === "view" ? "view" : "edit";
  const readOnly = mode === "view" || finalApproved === "YES";
  const tabs = [
    { key: "task", label: "Task Details", parameter: "Trn_task" },
    { key: "character", label: "Characteristics", parameter: "Trn_character" },
    { key: "goal", label: "Goals", parameter: "Trn_goal" },
    { key: "skill", label: "Skill", parameter: "Trn_skill" },
    { key: "comments", label: "Comments", parameter: "appraisal_comments" },
  ];

  const loadView = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [task, skill, goal, character, commentRows, flowRows, levelRows] = await Promise.all([
        pamsSelect({ parameter: "Trn_task", loginid, code1: companyCode, code2: docNo, code3: employeeCode }),
        pamsSelect({ parameter: "Trn_skill", loginid, code1: companyCode, code2: docNo, code3: employeeCode }),
        pamsSelect({ parameter: "Trn_goal", loginid, code1: companyCode, code2: docNo, code3: employeeCode }),
        pamsSelect({ parameter: "Trn_character", loginid, code1: companyCode, code2: docNo, code3: employeeCode }),
        pamsSelect({ parameter: "appraisal_comments", loginid, code1: docNo }).catch(() => []),
        pamsSelect({ parameter: "get_appraisal_flow_level", loginid, code1: docNo }).catch(() => []),
        pamsSelect({ parameter: "sentback_levels", loginid, code1: docNo }).catch(() => []),
      ]);
      setRowsByTab({ task: task.map(normalizeRow), skill: skill.map(normalizeRow), goal: goal.map(normalizeRow), character: character.map(normalizeRow) });
      const comments = normalizeRow(commentRows[0] || {});
      setAppraiserComment(text(comments.APPRAISER_COMMENTS));
      setAppraiseeComment(text(comments.APPRAISEE_COMMENTS));
      const flow = normalizeRow(flowRows[0] || {});
      setFlowLevel(number(flow.FLOW_LEVEL_RUNNING));
      setFinalApproved(text(flow.FINAL_APPROVED || "NO"));
      const levels = levelRows.map(normalizeRow);
      setSentBackLevels(levels);
      setSentBackLevel(text(levels[0]?.FLOW_RUNNING_LEVEL || levels[0]?.LEVEL_NO || "1"));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load appraisal document" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadView();
  }, [docNo, employeeCode, loginid, companyCode]);

  const activeRows = rowsByTab[activeTab] || [];
  const taskTotal = useMemo(() => Math.round((rowsByTab.task || []).reduce((sum, row) => sum + number(row.TOTAL), 0)), [rowsByTab.task]);
  const characterTotal = useMemo(() => {
    const rows = rowsByTab.character || [];
    const sum = rows.reduce((total, row) => total + number(row.RATING), 0);
    return rows.length ? Math.round(sum / 4) : 0;
  }, [rowsByTab.character]);
  const finalRating = Math.round(((taskTotal || 0) + (characterTotal || 0)) / 2);
  const showSaveSubmitButtons = !readOnly && flowLevel >= 1 && flowLevel <= 2;
  const showApproveRejectButtons = !readOnly && flowLevel >= 3 && flowLevel <= 7;
  const isEmployee = loginid.trim() === employeeCode.trim();
  const appraiserReadOnly = readOnly || isEmployee || flowLevel >= 3;
  const appraiseeReadOnly = readOnly || !isEmployee || flowLevel >= 3;

  const updateTabRows = (key: string, rows: Row[]) => setRowsByTab((current) => ({ ...current, [key]: rows }));

  const validateBeforeSubmit = () => {
    const missing: string[] = [];
    const ratingRows = [...(rowsByTab.task || []), ...(rowsByTab.character || []), ...(rowsByTab.goal || []), ...(rowsByTab.skill || [])];
    const missingRatings = ratingRows.filter((row) => number(row.RATING) <= 0).length;
    if (missingRatings) missing.push(`Rating missing for ${missingRatings} item(s)`);
    if (!isEmployee && !appraiserComment.trim()) missing.push("Appraiser comment is empty");
    if (isEmployee && !appraiseeComment.trim()) missing.push("Appraisee comment is empty");
    return missing;
  };

  const saveRatings = async () => {
    const rows = Object.values(rowsByTab).flat();
    if (!rows.length) return;
    setNotice(null);
    try {
      await pamsUpdateRatings(rows);
      setNotice({ type: "success", message: "Ratings saved successfully" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save ratings" });
    }
  };

  const runAction = async (action: "D" | "S" | "A" | "R" | "SB", level = "") => {
    setNotice(null);
    try {
      if (action === "D" || action === "S" || action === "A") {
        const allRows = Object.values(rowsByTab).flat();
        if (allRows.length) await pamsUpdateRatings(allRows);
        if (appraiserComment.trim()) await pamsSelect({ parameter: "update_appraiser_comments", loginid, code1: docNo, code2: employeeCode, code3: appraiserComment.trim() });
        if (appraiseeComment.trim()) await pamsSelect({ parameter: "update_appraisee_comments", loginid, code1: docNo, code2: employeeCode, code3: appraiseeComment.trim() });
      }
      await pamsSelect({ parameter: "update_appraisal_status", loginid, code1: docNo, code2: employeeCode, code3: action, code4: level });
      setNotice({ type: "success", message: action === "D" ? "Appraisal saved as draft" : action === "S" ? "Appraisal submitted" : action === "A" ? "Appraisal approved" : action === "SB" ? "Appraisal sent back" : "Appraisal rejected" });
      await loadView();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to update appraisal" });
    }
  };

  const confirmSentBack = async () => {
    if (!sentBackReason.trim()) {
      setNotice({ type: "error", message: "Please enter a reason for sending back" });
      return;
    }
    await runAction("SB", sentBackLevel || "1");
    setSentBackOpen(false);
    setSentBackReason("");
  };

  return (
    <section className="grid gap-4">
      <div className="rounded-lg bg-primary px-4 py-3 text-primary-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} /></Button>
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.24em] opacity-80">{mode === "view" ? "View Appraisal" : "Edit Appraisal"}</p>
              <h1 className="m-0 text-lg font-semibold">Appraisal: {docNo}</h1>
              <p className="m-0 text-xs opacity-80">{employeeName || employeeCode} {employeeCode && `(${employeeCode})`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Flow {flowLevel || "-"}</Badge>
            <Badge variant="secondary">Final {finalRating || "-"}</Badge>
          </div>
        </div>
      </div>
      <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.key} type="button" variant={activeTab === tab.key ? "default" : "outline"} onClick={() => setActiveTab(tab.key)}>
            {tab.label} <Badge variant="secondary">{(rowsByTab[tab.key] || []).length}</Badge>
          </Button>
        ))}
      </div>
      {activeTab === "comments" ? (
        <Card>
          <CardHeader className="border-b border-border">
            <div>
              <p className="eyebrow">Comments</p>
              <h2 className="m-0 text-sm font-semibold">Appraiser And Appraisee Comments</h2>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="m-0 text-xs text-muted-foreground">Task Score</p>
              <p className="m-0 text-2xl font-bold text-primary">{taskTotal}</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="m-0 text-xs text-muted-foreground">Character Score</p>
              <p className="m-0 text-2xl font-bold text-primary">{characterTotal}</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="m-0 text-xs text-muted-foreground">Final Rating</p>
              <p className="m-0 text-2xl font-bold text-emerald-600">{finalRating}</p>
            </div>
            <Field label="Appraiser Comments">
              <textarea className="min-h-44 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" disabled={appraiserReadOnly} value={appraiserComment} onChange={(event) => setAppraiserComment(event.target.value)} />
            </Field>
            <Field label="Appraisee Comments">
              <textarea className="min-h-44 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" disabled={appraiseeReadOnly} value={appraiseeComment} onChange={(event) => setAppraiseeComment(event.target.value)} />
            </Field>
          </CardContent>
        </Card>
      ) : (
        <AppraisalRatingTable
          type={activeTab}
          rows={activeRows}
          loading={loading}
          readOnly={readOnly}
          onChange={(rows) => updateTabRows(activeTab, rows)}
        />
      )}
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {showSaveSubmitButtons && (
            <>
              <Button onClick={() => runAction("D")}><Save size={15} /> Save as Draft</Button>
              <Button onClick={() => {
                const missing = validateBeforeSubmit();
                if (missing.length) {
                  setNotice({ type: "error", message: `Please fill before submitting: ${missing.join(", ")}` });
                  return;
                }
                void runAction("S");
              }}><Send size={15} /> Submit</Button>
            </>
          )}
          {showApproveRejectButtons && (
            <>
              <Button onClick={() => runAction("A")}><CheckCircle2 size={15} /> Approve</Button>
              <Button variant="destructive" onClick={() => runAction("R")}><X size={15} /> Reject</Button>
              <Button variant="outline" onClick={() => setSentBackOpen(true)}><RotateCcw size={15} /> Send Back</Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadView}><RefreshCw size={15} /> Refresh</Button>
          {!readOnly && <Button variant="outline" onClick={saveRatings}><Save size={15} /> Save Ratings</Button>}
          <Button variant="outline" onClick={() => window.print()}><Printer size={15} /> Print</Button>
          <Button variant="outline" disabled><Paperclip size={15} /> Attach</Button>
          <Button variant="outline" onClick={() => navigate(-1)}>Exit</Button>
        </div>
      </div>
      <Dialog
        compact
        title="Send Back"
        open={sentBackOpen}
        onClose={() => setSentBackOpen(false)}
        footer={<><Button variant="outline" onClick={() => setSentBackOpen(false)}>Cancel</Button><Button onClick={confirmSentBack}>Confirm Send Back</Button></>}
      >
        <div className="grid gap-3">
          <Field label="Send Back To Level">
            <SearchableSelect
              value={sentBackLevel}
              placeholder="Select level"
              onChange={setSentBackLevel}
              options={sentBackLevels.map((level, index) => {
                const value = text(level.FLOW_RUNNING_LEVEL || level.LEVEL_NO || index + 1);
                return { value, label: text(level.LEVEL_NAME || value), key: `level_${value}_${index}` };
              })}
            />
          </Field>
          <Field label="Reason">
            <textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring" value={sentBackReason} onChange={(event) => setSentBackReason(event.target.value)} placeholder="Enter reason for sending back" />
          </Field>
        </div>
      </Dialog>
    </section>
  );
}

function AppraisalRatingTable({ type, rows, loading, readOnly, onChange }: { type: string; rows: Row[]; loading: boolean; readOnly: boolean; onChange: (rows: Row[]) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isTask = type === "task";
  const isCharacter = type === "character";
  const showWeightage = type === "task" || type === "goal";
  const showTotal = type === "task" || type === "goal";
  const total = rows.reduce((sum, row) => sum + number(showTotal ? row.TOTAL : row.RATING), 0);

  const updateRating = (target: Row, ratingValue: string) => {
    const rating = number(ratingValue);
    const next = rows.map((row) => {
      if (ratingRowKey(row) !== ratingRowKey(target)) return row;
      const weightage = number(row.STANDARD_WEIGHTAGE);
      return {
        ...row,
        RATING: rating,
        TOTAL: showTotal ? Number(((weightage * rating) / 100).toFixed(2)) : row.TOTAL,
      };
    });
    onChange(next);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border px-4 py-3">
        <div>
          <p className="eyebrow">{isTask ? "Task Details" : isCharacter ? "Characteristics" : titleCase(type)}</p>
          <h2 className="m-0 text-sm font-semibold">{rows.length.toLocaleString()} Items</h2>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[540px] overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted/90 text-[11px] uppercase tracking-[0.12em] text-primary">
              <tr>
                <th className="w-16 border-b border-border px-3 py-2 text-left">S.No</th>
                <th className="border-b border-border px-3 py-2 text-left">KPI Code - Description</th>
                {showWeightage && <th className="w-40 border-b border-border px-3 py-2 text-center">Standard Weightage</th>}
                <th className="w-32 border-b border-border px-3 py-2 text-center">Rating</th>
                {showTotal && <th className="w-32 border-b border-border px-3 py-2 text-center">Total</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-14 text-center text-muted-foreground">Loading appraisal rows...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-14 text-center text-muted-foreground">No records found.</td></tr>
              ) : rows.map((row, index) => {
                const key = ratingRowKey(row);
                const items = splitItems(row.KPI_ITEM_DESC);
                return (
                  <tr key={key} className="border-b border-border align-top hover:bg-muted/40">
                    <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))}>
                        {items.length > 0 ? <ChevronDown size={15} className={expanded[key] ? "mt-0.5 rotate-180 transition-transform" : "mt-0.5 transition-transform"} /> : <span className="w-[15px]" />}
                        <span>
                          <span className="font-semibold text-foreground">{formatValue(row.KPI_CODE)} - {formatValue(row.KPI_DESC)}</span>
                          {items.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>}
                        </span>
                      </button>
                      {expanded[key] && items.length > 0 && (
                        <div className="mt-2 grid gap-1 rounded-md border border-border bg-muted/30 p-2">
                          {items.map((item, itemIndex) => <div key={`${key}_${itemIndex}`} className="text-xs text-muted-foreground">{itemIndex + 1}. {item}</div>)}
                        </div>
                      )}
                    </td>
                    {showWeightage && <td className="px-3 py-2 text-center">{formatValue(row.STANDARD_WEIGHTAGE)}</td>}
                    <td className="px-3 py-2 text-center">
                      <select
                        disabled={readOnly}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                        value={text(row.RATING && number(row.RATING) > 0 ? row.RATING : "")}
                        onChange={(event) => updateRating(row, event.target.value)}
                      >
                        <option value="">0</option>
                        {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                      </select>
                    </td>
                    {showTotal && <td className="px-3 py-2 text-center font-semibold text-emerald-600">{number(row.TOTAL) ? number(row.TOTAL).toFixed(2) : "-"}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/60 font-semibold">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">Total</td>
                {showWeightage && <td className="px-3 py-2" />}
                <td className="px-3 py-2" />
                {showTotal && <td className="px-3 py-2 text-center text-emerald-600">{Math.round(total)}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ratingRowKey(row: Row) {
  return [row.APPRAISAL_DOC_NO, row.EMPLOYEE_CODE, row.KPI_CODE, row.KPI_ITEM_SRNO].map(text).join("|");
}

function PamsAppraisalHeaderDialog({ open, row, mode, onClose }: { open: boolean; row: Row | null; mode: "edit" | "view"; onClose: (saved?: boolean) => void }) {
  const { user } = useAuth();
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";
  const [periods, setPeriods] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const readOnly = mode === "view";

  useEffect(() => {
    if (!open) return;
    setForm({
      COMPANY_CODE: row?.COMPANY_CODE || companyCode,
      APPRAISAL_DOC_NO: getAppraisalDocNo(row || {}),
      APPRAISAL_DOC_DATE: dateInput(row?.APPRAISAL_DOC_DATE),
      EMPLOYEE_CODE: row?.EMPLOYEE_CODE || row?.EMP_CODE || row?.employee_code || "",
      EMPLOYEE_NAME: row?.EMPLOYEE_NAME || row?.RPT_NAME || row?.employee_name || "",
      PERIOD_NUMBER: row?.PERIOD_NUMBER || "",
      APPRAISAL_FROM: dateInput(row?.APPRAISAL_FROM),
      APPRAISAL_TO: dateInput(row?.APPRAISAL_TO),
    });
    setNotice("");
    void Promise.all([
      pamsSelect({ parameter: "period", loginid, code1: companyCode }).then((data) => setPeriods(data.map(normalizeRow))).catch(() => setPeriods([])),
      loadBulkEmployees(loginid, companyCode).then((data) => setEmployees(data.map(normalizeRow))).catch(() => setEmployees([])),
    ]);
  }, [open, row, loginid, companyCode]);

  const update = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const selectedEmployee = employees.find((employee) => text(employee.EMPLOYEE_CODE || employee.employee_code) === text(form.EMPLOYEE_CODE));
  const handlePeriod = (periodNumber: string) => {
    const period = periods.find((item) => text(item.PERIOD_NUMBER || item.period_number) === periodNumber);
    update("PERIOD_NUMBER", periodNumber);
    update("APPRAISAL_FROM", dateInput(period?.PERIOD_FROM_DATE || period?.period_from_date || form.APPRAISAL_FROM));
    update("APPRAISAL_TO", dateInput(period?.PERIOD_TO_DATE || period?.period_to_date || form.APPRAISAL_TO));
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (readOnly) return;
    if (!text(form.EMPLOYEE_CODE) || !text(form.PERIOD_NUMBER)) {
      setNotice("Employee and period are required");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const isEdit = Boolean(getAppraisalDocNo(form));
      await pamsSave({
        parameter: "Trn_ems_appraisal_hdr",
        loginid,
        val1s1: text(form.COMPANY_CODE || companyCode),
        val1s4: text(form.EMPLOYEE_CODE),
        val1s5: text(form.APPRAISAL_DOC_NO),
        val1s6: text(form.APPRAISAL_DOC_DATE),
        val1s7: text(form.APPRAISAL_FROM),
        val1s8: text(form.APPRAISAL_TO),
        val1s9: text(form.PERIOD_NUMBER),
        ...(isEdit ? { wval1s1: text(form.COMPANY_CODE || companyCode), wval1s5: text(form.APPRAISAL_DOC_NO) } : {}),
      });
      onClose(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save appraisal header");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      wide
      open={open}
      title={readOnly ? "View Appraisal" : "Edit Appraisal"}
      onClose={() => onClose(false)}
      footer={<><Button variant="outline" onClick={() => onClose(false)}>Close</Button>{!readOnly && <Button disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? "Saving..." : "Save"}</Button>}</>}
    >
      <form className="grid max-w-full gap-4 overflow-hidden" onSubmit={save}>
        <NoticeToast notice={notice ? { type: "error", message: notice } : null} onClose={() => setNotice("")} />
        <Card className="max-w-full overflow-hidden">
          <CardHeader className="border-b border-border">
            <div>
              <p className="eyebrow">Details</p>
              <h2 className="m-0 text-sm font-semibold">Appraisal Header</h2>
            </div>
          </CardHeader>
          <CardContent className="grid max-w-full grid-cols-1 gap-3 pt-4 lg:grid-cols-2">
            <Field label="Appraisal Doc No">
              <Input disabled value={text(form.APPRAISAL_DOC_NO) || "Auto generated"} onChange={() => undefined} />
            </Field>
            <Field label="Appraisal Doc Date">
              <Input disabled={readOnly} type="date" value={text(form.APPRAISAL_DOC_DATE)} onChange={(event) => update("APPRAISAL_DOC_DATE", event.target.value)} />
            </Field>
            <div className="min-w-0 lg:col-span-2">
              <Field label="Employee" required>
                <LookupField
                  compact
                  disabled={readOnly}
                  label="Employee"
                  value={text(form.EMPLOYEE_CODE)}
                  displayValue={formatEmployeeLabel(selectedEmployee) || [form.EMPLOYEE_CODE, form.EMPLOYEE_NAME].filter(Boolean).join(" - ")}
                  placeholder="Search employee"
                  columns={[
                    { field: "EMPLOYEE_ID", header: "Employee ID" },
                    { field: "EMPLOYEE_CODE", header: "Employee Code" },
                    { field: "RPT_NAME", header: "Employee Name" },
                  ]}
                  valueField="EMPLOYEE_CODE"
                  displayFields={["EMPLOYEE_CODE", "RPT_NAME", "EMP_NAME"]}
                  loadOptions={async () => employees as LookupRow[]}
                  onChange={(value, selected) => {
                    update("EMPLOYEE_CODE", value);
                    update("EMPLOYEE_NAME", selected?.RPT_NAME || selected?.EMP_NAME || "");
                  }}
                />
              </Field>
            </div>
            <Field label="Period Number" required>
              <SearchableSelect
                disabled={readOnly}
                value={text(form.PERIOD_NUMBER)}
                placeholder="Select period"
                onChange={handlePeriod}
                options={periods.map((period, index) => {
                  const value = text(period.PERIOD_NUMBER || period.period_number);
                  return { value, label: formatPeriodQuarter(period), key: `period_header_${value}_${index}` };
                })}
              />
            </Field>
            <Field label="Appraisal From">
              <Input disabled type="date" value={text(form.APPRAISAL_FROM)} onChange={() => undefined} />
            </Field>
            <Field label="Appraisal To">
              <Input disabled type="date" value={text(form.APPRAISAL_TO)} onChange={() => undefined} />
            </Field>
          </CardContent>
        </Card>
      </form>
    </Dialog>
  );
}

function PamsProcedureTable({
  title,
  parameter,
  icon,
  actionColumn,
  columnsOverride,
  extraParams,
  toolbarTop,
  reloadToken,
}: {
  title: string;
  parameter: string;
  icon?: ReactNode;
  actionColumn?: (row: Row) => ReactNode;
  columnsOverride?: ColumnDef<Row>[];
  extraParams?: Partial<PamsProcedureParams>;
  toolbarTop?: ReactNode;
  reloadToken?: number;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const loginid = user?.loginid || user?.username || "";
  const companyCode = user?.company_code || "";

  const loadRows = async () => {
    setLoading(true);
    setNotice("");
    try {
      setRows((await pamsSelect({ parameter, loginid, code1: companyCode, ...extraParams })).map(normalizeRow));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Unable to load ${title}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [parameter, loginid, companyCode, JSON.stringify(extraParams || {}), reloadToken]);

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const generated = columnsOverride || autoColumns(rows);
    if (!actionColumn) return generated;
    return [
      ...generated,
      {
        id: "actions",
        header: "Actions",
        size: 120,
        cell: ({ row }) => <div className="flex items-center gap-1">{actionColumn(row.original)}</div>,
      },
    ];
  }, [rows, actionColumn, columnsOverride]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">{icon || <FileText size={18} />}</span>
          <div><h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1></div>
        </div>
        <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>
      </div>
      {toolbarTop}
      <NoticeToast notice={notice ? { type: "error", message: notice } : null} onClose={() => setNotice("")} />
      <DataTable columns={columns} data={rows} title={`${rows.length.toLocaleString()} Records`} subtitle={title} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search ${title.toLowerCase()}...`} loading={loading} height={620} minWidth={1200} density="grid" enablePagination pageSize={100} getRowId={(row, index) => `${parameter}_${Object.values(row).slice(0, 3).join("_")}_${index}`} />
    </section>
  );
}

function assignmentFields(itemLabel: string, lookupParameter: string): PamsField[] {
  return [
    { name: "ITEM_TYPE", label: "Item Type", table: false },
    { name: "KPI_CODE", label: `${itemLabel} Code`, type: "select", required: true, lookup: { parameter: lookupParameter, value: itemLabel === "KPI" ? "KPI_CODE" : `${itemLabel}_CODE`, label: itemLabel === "KPI" ? "KPI_DESC" : `${itemLabel}_DESC` }, table: true, width: 150 },
    { name: "KPI_DESC", label: `${itemLabel} Description`, table: false },
    { name: "DIVISION_CODE", label: "Division Code", type: "select", required: true, lookup: { parameter: "division", value: "DIV_CODE", label: "DIV_NAME" }, table: true, width: 160 },
    { name: "DEPARTMENT_CODE", label: "Department Code", type: "select", required: true, lookup: { parameter: "department", value: "DEPT_CODE", label: "DEPT_NAME", dependsOn: "DIVISION_CODE", code1From: "DIVISION_CODE" }, table: true, width: 180 },
    { name: "EMPLOYEE_CODE", label: "Employee Code", type: "select", lookup: { parameter: "employee", value: "EMPLOYEE_CODE", label: "EMP_NAME", dependsOn: "DEPARTMENT_CODE", code1From: "DIVISION_CODE", code2From: "DEPARTMENT_CODE" }, table: true, width: 160 },
    { name: "WEIGHTAGE", label: "Weightage", type: "number", table: true, width: 120 },
  ];
}

function libraryFields(prefix: "SKILL" | "GOAL", includeWeightage: boolean): PamsField[] {
  const fields: PamsField[] = [
    { name: `${prefix}_CODE`, label: `${titleCase(prefix)} Code`, disabledOnEdit: true, table: true, width: 150 },
    { name: `${prefix}_DESC`, label: `${titleCase(prefix)} Desc`, type: "textarea", required: true, table: true, width: 300 },
    { name: "DIVISION_CODE", label: "Division", type: "select", lookup: { parameter: "division", value: "DIV_CODE", label: "DIV_NAME" }, table: true, width: 250, display: (row) => orgLabel(row, "DIVISION_CODE", "DIVISION_NAME") },
    { name: "DEPARTMENT_CODE", label: "Department", type: "select", lookup: { parameter: "department", value: "DEPT_CODE", label: "DEPT_NAME", dependsOn: "DIVISION_CODE", code2From: "DIVISION_CODE" }, table: true, width: 250, display: (row) => orgLabel(row, "DEPARTMENT_CODE", "DEPARTMENT_NAME") },
    { name: "SECTION_CODE", label: "Section", type: "select", lookup: { parameter: "section", value: "SECTION_CODE", label: "SECTION_NAME", dependsOn: "DEPARTMENT_CODE", code2From: "DIVISION_CODE", code3From: "DEPARTMENT_CODE" }, table: true, width: 250, display: (row) => orgLabel(row, "SECTION_CODE", "SECTION_NAME") },
    { name: "DESG_CODE", label: "Designation", type: "select", lookup: { parameter: "designation", value: "DESG_CODE", label: "DESG_NAME", dependsOn: "DEPARTMENT_CODE", code2From: "DIVISION_CODE", code3From: "DEPARTMENT_CODE", code4From: "SECTION_CODE" }, table: true, width: 250, display: (row) => orgLabel(row, "DESG_CODE", "DESG_NAME") },
  ];
  if (includeWeightage) fields.push({ name: "STANDARD_WEIGHTAGE", label: "Weightage", type: "number", table: true, width: 120 });
  return fields;
}

function assignmentSave(form: Row, ctx: PamsContext, itemType: "KPI" | "SKILL" | "GOAL") {
  return {
    val1s1: ctx.companyCode,
    val1s2: text(form.DIVISION_CODE),
    val1s3: text(form.DEPARTMENT_CODE),
    val1s4: text(form.EMPLOYEE_CODE),
    val1s5: text(form.KPI_CODE),
    val1s6: itemType,
    val1n1: number(form.WEIGHTAGE || form.STANDARD_WEIGHTAGE),
  };
}

function assignmentDelete(row: Row, ctx: PamsContext) {
  return {
    code1: ctx.companyCode,
    code2: text(row.DIVISION_CODE),
    code3: text(row.DEPARTMENT_CODE),
    code4: text(row.EMPLOYEE_CODE),
    code5: text(row.KPI_CODE),
  };
}

async function loadBulkEmployees(loginid: string, companyCode: string, periodNumber?: string) {
  return await pamsSelect({ parameter: "dept_head_employees", loginid, code1: companyCode, code2: periodNumber || "NULL" });
}

function bulkAppraisalColumns(): ColumnDef<Row>[] {
  return [
    { accessorKey: "EMPLOYEE_ID", header: "Employee Id", size: 150, cell: ({ row }) => formatValue(row.original.EMPLOYEE_ID || row.original.employee_id) },
    { accessorKey: "EMPLOYEE_CODE", header: "Employee Code", size: 160, cell: ({ row }) => formatValue(row.original.EMPLOYEE_CODE || row.original.employee_code) },
    {
      accessorKey: "RPT_NAME",
      header: "Employee Name",
      size: 280,
      cell: ({ row }) => <span className="whitespace-nowrap">{formatValue(row.original.RPT_NAME || row.original.EMP_NAME || row.original.employee_name)}</span>,
    },
    {
      id: "division",
      header: "Division",
      size: 260,
      cell: ({ row }) => <span className="whitespace-nowrap">{orgLabel(row.original, "DIV_CODE", "DIV_NAME") || orgLabel(row.original, "DIVISION_CODE", "DIVISION_NAME")}</span>,
    },
    {
      id: "department",
      header: "Department",
      size: 260,
      cell: ({ row }) => <span className="whitespace-nowrap">{orgLabel(row.original, "DEPT_CODE", "DEPT_NAME") || orgLabel(row.original, "DEPARTMENT_CODE", "DEPARTMENT_NAME")}</span>,
    },
    {
      id: "section",
      header: "Section",
      size: 240,
      cell: ({ row }) => <span className="whitespace-nowrap">{orgLabel(row.original, "SECTION_CODE", "SECTION_NAME")}</span>,
    },
    {
      id: "designation",
      header: "Designation",
      size: 240,
      cell: ({ row }) => <span className="whitespace-nowrap">{orgLabel(row.original, "DESG_CODE", "DESG_NAME")}</span>,
    },
    {
      accessorKey: "STATUS",
      header: "Status",
      size: 160,
      // Sticky right column
      meta: { sticky: "right" },
      cell: ({ row }) => {
        const status = text(row.original.STATUS || row.original.status || row.original.MESSAGE);
        return (
          <span className={status.toLowerCase().includes("process")
            ? "inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
            : "inline-flex whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
          }>
            {status || "-"}
          </span>
        );
      },
    },
  ];
}

function assignmentRowKey(row: Row) {
  return [row.KPI_CODE, row.DIVISION_CODE || row.DIV_CODE, row.DEPARTMENT_CODE || row.DEPT_CODE, row.EMPLOYEE_CODE].map(text).join("|");
}

function splitItems(value: unknown) {
  return text(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function getAppraisalDocNo(row: Row) {
  return text(row.APPRAISAL_DOC_NO || row.DOC_NO || row.DOCNO || row.doc_no);
}

function myTaskColumns(): ColumnDef<Row>[] {
  return [
    { accessorKey: "APPRAISAL_DOC_NO", header: "Appraisal Doc No", size: 170, cell: ({ row }) => formatValue(getAppraisalDocNo(row.original)) },
    { accessorKey: "APPRAISAL_DOC_DATE", header: "Appraisal Date", size: 160, cell: ({ row }) => formatDateDisplay(row.original.APPRAISAL_DOC_DATE) },
    { accessorKey: "PERIOD_NUMBER", header: "Period Number", size: 160, cell: ({ row }) => formatValue(row.original.PERIOD_NUMBER) },
    { id: "employee", header: "Employee", size: 320, cell: ({ row }) => [row.original.EMPLOYEE_CODE, row.original.EMPLOYEE_NAME].filter(Boolean).join(" - ") },
    { id: "designation", header: "Designation", size: 220, cell: ({ row }) => orgLabel(row.original, "DESG_CODE", "DESG_NAME") },
    { accessorKey: "APPRAISAL_FROM", header: "Appraisal From", size: 160, cell: ({ row }) => formatDateDisplay(row.original.APPRAISAL_FROM) },
    { accessorKey: "APPRAISAL_TO", header: "Appraisal To", size: 160, cell: ({ row }) => formatDateDisplay(row.original.APPRAISAL_TO) },
    { accessorKey: "LAST_ACTION", header: "Status", size: 150, cell: ({ row }) => formatValue(row.original.LAST_ACTION || row.original.STATUS) },
  ];
}

function autoColumns(rows: Row[]): ColumnDef<Row>[] {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 16);
  return (keys.length ? keys : ["MESSAGE"]).map((key) => ({
    accessorKey: key,
    header: titleCase(key),
    size: key.toLowerCase().includes("name") || key.toLowerCase().includes("desc") ? 260 : 150,
    cell: ({ row }: { row: { original: Row } }) => formatValue(row.original[key]),
  }));
}

function renderField(field: PamsField, value: unknown, disabled: boolean, lookupRows: Row[], onChange: (value: unknown) => void) {
  if (field.lookup) {
    const lookup = field.lookup;
    const options = lookupRows.map((row, index) => {
      const optionValue = text(row[lookup.value]);
      const optionLabel = [row[lookup.value], row[lookup.label]].filter(Boolean).join(" - ");
      return { value: optionValue, label: optionLabel || optionValue, key: `${optionValue}_${index}` };
    });
    const selected = options.find((option) => option.value === text(value));
    return (
      <LookupField
        compact
        disabled={disabled}
        label={field.label}
        value={text(value)}
        displayValue={selected?.label || text(value)}
        placeholder={`Select ${field.label}`}
        columns={[
          { field: lookup.value, header: "Code" },
          { field: lookup.label, header: "Description" },
        ]}
        valueField={lookup.value}
        displayFields={[lookup.value, lookup.label]}
        loadOptions={async () => lookupRows as LookupRow[]}
        onChange={(nextValue) => onChange(nextValue)}
      />
    );
  }
  if (field.type === "select") {
    return <SearchableSelect disabled={disabled} value={text(value)} placeholder={`Select ${field.label}`} options={[]} onChange={onChange} />;
  }
  if (field.type === "textarea") {
    return <textarea disabled={disabled} className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" value={text(value)} onChange={(event) => onChange(event.target.value)} />;
  }
  return <Input disabled={disabled} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={field.type === "date" ? dateInput(value) : text(value)} onChange={(event) => onChange(field.type === "number" ? Number(event.target.value || 0) : event.target.value)} />;
}

function SearchableSelect({ value, options, placeholder, disabled, onChange }: { value: string; options: { value: string; label: string; key: string }[]; placeholder: string; disabled?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerId = useRef(`pams-picker-${Math.random().toString(36).slice(2)}`);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term ? options.filter((option) => `${option.value} ${option.label}`.toLowerCase().includes(term)) : options;
    return matches.slice(0, 100);
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
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
        onClick={() => open ? close() : openPicker()}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-left text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected?.label || value || placeholder}</span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
      </button>
      {open && !disabled && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[1000] w-full max-w-[560px] overflow-hidden rounded-md border border-border bg-white text-foreground shadow-2xl ring-1 ring-slate-950/10 dark:bg-slate-950"
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="m-2 flex h-9 items-center gap-2 rounded-md border bg-background px-2 text-muted-foreground">
            <Search size={15} className="text-muted-foreground" />
            <input
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
              autoFocus
              value={query}
              placeholder={placeholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
              }}
            />
          </div>
          <div className="max-h-72 overflow-auto bg-white p-1 dark:bg-slate-950">
            <button type="button" className={!value ? "flex min-h-8 w-full items-center justify-between gap-2 rounded bg-primary/10 px-3 py-1.5 text-left text-sm font-semibold text-primary" : "flex min-h-8 w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"} onClick={() => { onChange(""); close(); }}>
              <span className="text-muted-foreground">{placeholder}</span>
              {!value && <Check size={14} />}
            </button>
            {filtered.map((option) => (
              <button key={option.key} type="button" className={option.value === value ? "flex min-h-8 w-full items-center justify-between gap-2 rounded bg-primary/10 px-3 py-1.5 text-left text-sm font-semibold text-primary" : "flex min-h-8 w-full items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"} onClick={() => { onChange(option.value); close(); }}>
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check size={14} className="shrink-0 text-primary" />}
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-4 text-center text-sm text-muted-foreground">No records found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <div className="field"><span>{label}{required && <strong className="text-destructive"> *</strong>}</span>{children}</div>;
}

function genericSaveValues(fields: PamsField[], form: Row, companyCode: string) {
  const values: Row = {};
  fields.forEach((field, index) => {
    const key = field.type === "number" ? `val1n${index + 1}` : `val1s${index + 1}`;
    values[key] = field.type === "number" ? number(form[field.name]) : text(form[field.name]);
  });
  values.val1s10 = companyCode;
  return values;
}

function genericDeleteValues(keyFields: string[], row: Row, companyCode: string) {
  return { ...Object.fromEntries(keyFields.map((key, index) => [`code${index + 1}`, text(row[key])])), code4: companyCode };
}

function lookupLabel(rows: Row[] | undefined, valueKey: string, labelKey: string, value: unknown) {
  const selected = rows?.find((row) => text(row[valueKey]) === text(value));
  return text(selected?.[labelKey] || value);
}

function orgLabel(row: Row, codeKey: string, nameKey: string) {
  const code = text(row[codeKey]);
  const name = text(row[nameKey]);
  if (code && name) return `${code} - ${name}`;
  return code || name || "-";
}

function normalizeRow(row: Row) {
  const normalized: Row = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key] = value;
    normalized[key.toUpperCase()] = value;
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

function formatDateDisplay(value: unknown) {
  if (!value) return "NA";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "NA";
  return parsed.toLocaleDateString("en-GB");
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateInput(value: unknown) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function formatProcedureDate(value: unknown) {
  const date = dateInput(value);
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

function formatPeriodCode(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  return /^\d+$/.test(raw) ? raw.padStart(4, "0") : raw;
}

function formatPeriodQuarter(row: Row) {
  const dateValue = row.PERIOD_FROM_DATE;
  if (!dateValue) return text(row.PERIOD_NUMBER);
  const parsed = new Date(String(dateValue));
  if (Number.isNaN(parsed.getTime())) return text(row.PERIOD_NUMBER);
  const quarter = Math.floor(parsed.getMonth() / 3) + 1;
  return `Q${quarter} ${parsed.getFullYear()}`;
}

function formatEmployeeLabel(employee?: Row) {
  if (!employee) return "";
  return [
    employee.EMPLOYEE_CODE || employee.employee_code,
    employee.EMP_NAME || employee.RPT_NAME || employee.EMPLOYEE_NAME || employee.employee_name,
  ].filter(Boolean).join(" - ");
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
