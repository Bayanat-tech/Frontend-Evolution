// Employee Dependants tab — rendered inside EmployeeWorkspacePage.
// Employee comes from the workspace route. The tab keeps its own list ⇄ editor switch;
// the header Save saves the open dependant (and does nothing from the list view).

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, CreditCard, Edit2, Eye, FileText, HeartPulse, IdCard, Plane, Plus, Trash2 } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDynamicLookup } from "../../../api/lookups";
import { useToast } from "../../../components/ui/AlertToast";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Field, SectionPanel } from "../../../components/ui/Formblocks";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../state/AuthContext";
import type { TabHandle, TabProps } from "./Employee.workspace.shared";
import hrEmpDependantsServiceInstance, { type THrEmpDependantDetail } from "../../../pages/hr/Upserthrempdependants";

/* ================= TYPES ================= */

type RelationOption = { rel_code: string; rel_desc: string };
type CodeValueOption = { value_code: string; value_desc: string };
type FormMode = "add" | "edit" | "view";

export type DependantRow = {
  _rowId: string;
  _isPersisted: boolean;
  dep_serial_number: string;
  dep_relation: string;
  dep_relation_desc: string;
  dep_name: string;
  dep_dob: string;
  dep_sponsored_by: string;
  ticket_eligibility: string;
  ticket_type: string;
  marstat: string;
  medical_eligible: string;
  dep_blood_group: string;
  status_flag: string;
  ppt_card: string;
  res_card: string;
  ppt_valid_from: string;
  ppt_valid_to: string;
  res_valid_from: string;
  res_valid_to: string;
  ins_card_no: string;
  ins_card_type: string;
  ins_card_issue_dt: string;
  isn_card_exp_dt: string;
  [key: string]: unknown;
};

type DependantFormState = {
  dep_name: string;
  dep_relation: string;
  dep_dob: string;
  dep_sponsored_by: string;
  ticket_eligibility: string;
  ticket_type: string;
  marstat: string;
  medical_eligible: string;
  dep_blood_group: string;
  status_flag: string;
  ppt_card: string;
  res_card: string;
  ppt_valid_from: string;
  ppt_valid_to: string;
  res_valid_from: string;
  res_valid_to: string;
  ins_card_no: string;
  ins_card_type: string;
  ins_card_issue_dt: string;
  isn_card_exp_dt: string;
};

const EMPTY_FORM: DependantFormState = {
  dep_name: "",
  dep_relation: "",
  dep_dob: "",
  dep_sponsored_by: "",
  ticket_eligibility: "N",
  ticket_type: "",
  marstat: "S",
  medical_eligible: "N",
  dep_blood_group: "",
  status_flag: "A",
  ppt_card: "",
  res_card: "",
  ppt_valid_from: "",
  ppt_valid_to: "",
  res_valid_from: "",
  res_valid_to: "",
  ins_card_no: "",
  ins_card_type: "",
  ins_card_issue_dt: "",
  isn_card_exp_dt: "",
};

const MARITAL_STATUS_OPTIONS = [
  { code: "S", label: "Single" },
  { code: "M", label: "Married" },
];

/* ================= HELPERS ================= */

function buildParams(parameter: string, loginid: string, companyCode: string, code2 = "") {
  return {
    parameter,
    loginid,
    code1: companyCode,
    code2,
    code3: "",
    code4: "",
    number1: 0, number2: 0, number3: 0, number4: 0,
    date1: null, date2: null, date3: null, date4: null,
  };
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  const str = String(value).trim();
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function toDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Form → the editable fields of a row (shared by add and edit). */
const formToRowFields = (f: DependantFormState) => ({
  dep_relation: f.dep_relation,
  dep_name: f.dep_name.trim(),
  dep_dob: f.dep_dob || "",
  dep_sponsored_by: f.dep_sponsored_by,
  ticket_eligibility: f.ticket_eligibility,
  ticket_type: f.ticket_type,
  marstat: f.marstat,
  medical_eligible: f.medical_eligible,
  dep_blood_group: f.dep_blood_group,
  status_flag: f.status_flag || "A",
  ppt_card: f.ppt_card,
  res_card: f.res_card,
  ppt_valid_from: f.ppt_valid_from || "",
  ppt_valid_to: f.ppt_valid_to || "",
  res_valid_from: f.res_valid_from || "",
  res_valid_to: f.res_valid_to || "",
  ins_card_no: f.ins_card_no,
  ins_card_type: f.ins_card_type,
  ins_card_issue_dt: f.ins_card_issue_dt || "",
  isn_card_exp_dt: f.isn_card_exp_dt || "",
});

const rowToForm = (r: DependantRow): DependantFormState => ({
  dep_name: String(r.dep_name ?? ""),
  dep_relation: String(r.dep_relation ?? ""),
  dep_dob: toDate(r.dep_dob),
  dep_sponsored_by: String(r.dep_sponsored_by ?? ""),
  ticket_eligibility: String(r.ticket_eligibility ?? "N"),
  ticket_type: String(r.ticket_type ?? ""),
  marstat: String(r.marstat ?? "S"),
  medical_eligible: String(r.medical_eligible ?? "N"),
  dep_blood_group: String(r.dep_blood_group ?? ""),
  status_flag: String(r.status_flag ?? "A"),
  ppt_card: String(r.ppt_card ?? ""),
  res_card: String(r.res_card ?? ""),
  ppt_valid_from: toDate(r.ppt_valid_from),
  ppt_valid_to: toDate(r.ppt_valid_to),
  res_valid_from: toDate(r.res_valid_from),
  res_valid_to: toDate(r.res_valid_to),
  ins_card_no: String(r.ins_card_no ?? ""),
  ins_card_type: String(r.ins_card_type ?? ""),
  ins_card_issue_dt: toDate(r.ins_card_issue_dt),
  isn_card_exp_dt: toDate(r.isn_card_exp_dt),
});

function CodeOptions({ list }: { list: CodeValueOption[] }) {
  return (
    <>
      {list.map((o) => (
        <option key={o.value_code} value={o.value_code}>{o.value_desc}</option>
      ))}
    </>
  );
}

function YesNoOptions({ list }: { list: CodeValueOption[] }) {
  return list.length > 0 ? (
    <CodeOptions list={list} />
  ) : (
    <>
      <option value="N">No</option>
      <option value="Y">Yes</option>
    </>
  );
}

/* ================= TAB ================= */

export const HrEmpDependantsTab = forwardRef<TabHandle, TabProps>(function HrEmpDependantsTab(
  { employeeId },
  ref,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "ADMIN";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<DependantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<FormMode>("add");
  const [activeDependant, setActiveDependant] = useState<DependantRow | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<DependantFormState>({ ...EMPTY_FORM });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DependantRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Master lookups ── */
  const useMaster = <T,>(key: string, parameter: string) =>
    useQuery<T[]>({
      queryKey: [key, companyCode],
      staleTime: 10 * 60 * 1000,
      queryFn: async () => ((await getDynamicLookup(buildParams(parameter, loginid, companyCode))) as T[]) ?? [],
    });

  const { data: relationOpts = [] } = useMaster<RelationOption>(
    "hr-dependants-relation",
    "EDUCATION_QUALIFICATION_EMP_DEPENDANTS_RELATION_SELECT",
  );
  const { data: eligibleOpts = [] } = useMaster<CodeValueOption>(
    "hr-dependants-eligible",
    "EDUCATION_QUALIFICATION_EMP_DEPENDANTS_ELIGIBLE_SELECT",
  );
  const { data: ticketTypeOpts = [] } = useMaster<CodeValueOption>(
    "hr-dependants-ticket-type",
    "EDUCATION_QUALIFICATION_EMP_DEPENDANTS_TICKET_TYPE_SELECT",
  );
  const { data: bloodGroupOpts = [] } = useMaster<CodeValueOption>(
    "hr-dependants-blood-group",
    "EDUCATION_QUALIFICATION_EMP_DEPENDANTS_BLOOD_GROUP_SELECT",
  );
  const { data: statusOpts = [] } = useMaster<CodeValueOption>(
    "hr-dependants-status",
    "EDUCATION_QUALIFICATION_EMP_DEPENDANTS_STATUS_SELECT",
  );

  /* ── Fetch dependants ── */
  const loadDependants = useCallback(async () => {
    if (!employeeId || !companyCode) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_DEPENDANTS_SELECT", loginid, companyCode, employeeId),
      );
      const raw = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
      setRows(
        raw.map((r, i) => ({
          _rowId: `row_${i}_${r.dep_serial_number ?? i}`,
          _isPersisted: true,
          dep_serial_number: String(r.dep_serial_number ?? i + 1),
          dep_relation: String(r.dep_relation ?? ""),
          dep_relation_desc: String(r.dep_relation_desc ?? ""),
          dep_name: String(r.dep_name ?? ""),
          dep_dob: String(r.dep_dob ?? ""),
          dep_sponsored_by: String(r.dep_sponsored_by ?? ""),
          ticket_eligibility: String(r.ticket_eligibility ?? "N"),
          ticket_type: String(r.ticket_type ?? ""),
          marstat: String(r.marstat ?? "S"),
          medical_eligible: String(r.medical_eligible ?? "N"),
          dep_blood_group: String(r.dep_blood_group ?? ""),
          status_flag: String(r.status_flag ?? "A"),
          ppt_card: String(r.ppt_card ?? ""),
          res_card: String(r.res_card ?? ""),
          ppt_valid_from: String(r.ppt_valid_from ?? ""),
          ppt_valid_to: String(r.ppt_valid_to ?? ""),
          res_valid_from: String(r.res_valid_from ?? ""),
          res_valid_to: String(r.res_valid_to ?? ""),
          ins_card_no: String(r.ins_card_no ?? ""),
          ins_card_type: String(r.ins_card_type ?? ""),
          ins_card_issue_dt: String(r.ins_card_issue_dt ?? ""),
          isn_card_exp_dt: String(r.isn_card_exp_dt ?? ""),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load dependants");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, companyCode, loginid, toast]);

  useEffect(() => {
    setView("list");
    setActiveDependant(null);
    void loadDependants();
  }, [loadDependants]);

  /* ── Populate form when the editor opens ── */
  useEffect(() => {
    if (view !== "editor") return;
    if ((editorMode === "edit" || editorMode === "view") && activeDependant) {
      setForm(rowToForm(activeDependant));
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [view, editorMode, activeDependant]);

  const setFormField = (field: keyof DependantFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "ticket_eligibility" && value !== "Y") next.ticket_type = "";
      return next;
    });
  };

  const validateForm = (): string | null => {
    if (!form.dep_name.trim()) return "Dependant Name is required";
    if (!form.dep_relation) return "Relation is required";
    if (!form.status_flag) return "Status is required";
    if (form.ppt_valid_from && form.ppt_valid_to && form.ppt_valid_to < form.ppt_valid_from)
      return "Passport Valid To must be after Valid From";
    if (form.res_valid_from && form.res_valid_to && form.res_valid_to < form.res_valid_from)
      return "Residence Valid To must be after Valid From";
    if (form.ins_card_issue_dt && form.isn_card_exp_dt && form.isn_card_exp_dt < form.ins_card_issue_dt)
      return "Insurance Expiry Date must be after Issue Date";
    return null;
  };

  /* ── Navigation inside the tab ── */
  const openEditor = (mode: FormMode, row: DependantRow | null = null) => {
    setEditorMode(mode);
    setActiveDependant(row);
    setView("editor");
  };
  const closeEditor = () => {
    setView("list");
    setEditorMode("add");
    setActiveDependant(null);
  };

  /* ── Persist the whole dependants list (the API upserts all rows) ── */
  const persist = async (list: DependantRow[]) => {
    const dependant_details: THrEmpDependantDetail[] = list.map((r, idx) => ({
      dep_serial_number: idx + 1,
      employee_id: employeeId,
      dep_relation: r.dep_relation,
      dep_name: r.dep_name,
      dep_dob: r.dep_dob || null,
      dep_sponsored_by: r.dep_sponsored_by,
      ticket_eligibility: r.ticket_eligibility,
      ticket_type: r.ticket_type,
      marstat: r.marstat,
      medical_eligible: r.medical_eligible,
      dep_blood_group: r.dep_blood_group,
      status_flag: r.status_flag,
      ppt_card: r.ppt_card,
      res_card: r.res_card,
      ppt_valid_from: r.ppt_valid_from || null,
      ppt_valid_to: r.ppt_valid_to || null,
      res_valid_from: r.res_valid_from || null,
      res_valid_to: r.res_valid_to || null,
      ins_card_no: r.ins_card_no,
      ins_card_type: r.ins_card_type,
      ins_card_issue_dt: r.ins_card_issue_dt || null,
      isn_card_exp_dt: r.isn_card_exp_dt || null,
      company_code: companyCode,
      user_id: loginid,
    }));
    return hrEmpDependantsServiceInstance.upsertHrEmpDependantsApi({
      company_code: companyCode,
      dependant_details,
      loginid,
    });
  };

  /* ── Save (called by the header Save button) ── */
  const save = async () => {
    if (view !== "editor") {
      toast.warning("Open or add a dependant to save");
      return;
    }
    if (editorMode === "view") return;

    const error = validateForm();
    if (error) {
      toast.warning(error);
      return;
    }

    try {
      const fields = formToRowFields(form);
      const relationDesc = relationOpts.find((o) => o.rel_code === form.dep_relation)?.rel_desc ?? "";

      const updatedRows: DependantRow[] =
        editorMode === "add"
          ? [
              ...rows,
              {
                _rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                _isPersisted: false,
                dep_serial_number: String(rows.length + 1),
                dep_relation_desc: relationDesc,
                ...fields,
              },
            ]
          : rows.map((r) =>
              r._rowId === activeDependant?._rowId ? { ...r, dep_relation_desc: relationDesc, ...fields } : r,
            );

      const success = await persist(updatedRows);
      if (!success) throw new Error("Save failed. Please try again.");
      toast.success(editorMode === "edit" ? "Dependant updated successfully" : "Dependant saved successfully");
      closeEditor();
      await loadDependants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save dependant");
    }
  };

  useImperativeHandle(ref, () => ({ save }));

  /* ── Delete ── */
  const requestDelete = (row: DependantRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !employeeId) return;
    setDeleting(true);
    try {
      const updatedRows = rows.map((r) => (r._rowId === deleteTarget._rowId ? { ...r, status_flag: "D" } : r));
      const success = await persist(updatedRows);
      if (!success) throw new Error("Delete failed");
      toast.success(`Dependant ${deleteTarget.dep_name} deleted successfully`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadDependants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete dependant");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Visible rows / columns ── */
  const visibleRows = useMemo(() => rows.filter((r) => r.status_flag !== "D"), [rows]);

  const columns = useMemo<ColumnDef<DependantRow>[]>(
    () => [
      {
        id: "index", header: "SlNo", size: 60, enableSorting: false,
        cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.index + 1}</span>,
      },
      {
        accessorKey: "dep_name", header: "Dependant Name", size: 180, enableSorting: false,
        cell: ({ getValue }) => <span className="font-medium text-foreground">{String(getValue() || "-")}</span>,
      },
      {
        accessorKey: "dep_relation", header: "Relation", size: 130, enableSorting: false,
        cell: ({ row }) => {
          const code = row.original.dep_relation;
          const desc = row.original.dep_relation_desc || relationOpts.find((o) => o.rel_code === code)?.rel_desc;
          return desc || code || "-";
        },
      },
      {
        accessorKey: "dep_dob", header: "Date of Birth", size: 110, enableSorting: false,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      {
        accessorKey: "marstat", header: "Marital Status", size: 110, enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || "");
          return val === "M" ? "Married" : val === "S" ? "Single" : val || "-";
        },
      },
      {
        accessorKey: "ticket_eligibility", header: "Ticket Eligible", size: 110, enableSorting: false,
        cell: ({ getValue }) => (String(getValue() || "N") === "Y" ? "Yes" : "No"),
      },
      {
        accessorKey: "ticket_type", header: "Ticket Type", size: 130, enableSorting: false,
        cell: ({ row }) => {
          const code = row.original.ticket_type;
          return ticketTypeOpts.find((o) => o.value_code === code)?.value_desc || code || "-";
        },
      },
      {
        accessorKey: "medical_eligible", header: "Medical Eligible", size: 110, enableSorting: false,
        cell: ({ getValue }) => (String(getValue() || "N") === "Y" ? "Yes" : "No"),
      },
      {
        accessorKey: "dep_blood_group", header: "Blood Group", size: 100, enableSorting: false,
        cell: ({ getValue }) => String(getValue() || "-"),
      },
      {
        accessorKey: "status_flag", header: "Status", size: 100, enableSorting: false,
        cell: ({ getValue }) =>
          String(getValue() || "A") === "A" ? (
            <span className="text-[0.8125rem] font-semibold text-green-600">Active</span>
          ) : (
            <span className="text-[0.8125rem] font-semibold text-red-600">Inactive</span>
          ),
      },
      {
        id: "actions", header: "Actions", size: 110, enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("edit", row.original)}
              title="Edit dependant"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("view", row.original)}
              title="View dependant"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => requestDelete(row.original)}
              title="Delete dependant"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relationOpts, ticketTypeOpts],
  );

  /* ═════════════ EDITOR VIEW ═════════════ */
  if (view === "editor") {
    const isView = editorMode === "view";

    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Dependant</span>
            <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
              {editorMode === "add" ? "New" : editorMode === "edit" ? "Editing" : "View"}
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={closeEditor}>
            <ArrowLeft size={14} /> Back to Dependants
          </Button>
        </div>

        <div className="grid gap-2 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SectionPanel title="Personal Information" icon={IdCard}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Dependant Name" required>
                  <Input
                    disabled={isView}
                    placeholder="Enter full name"
                    value={form.dep_name}
                    onChange={(e) => setFormField("dep_name", e.target.value)}
                  />
                </Field>

                <Field label="Relation" required>
                  <Select disabled={isView} value={form.dep_relation} onChange={(e) => setFormField("dep_relation", e.target.value)}>
                    <option value="">-- Select Relation --</option>
                    {relationOpts.map((o) => (
                      <option key={o.rel_code} value={o.rel_code}>{o.rel_desc}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Date of Birth">
                  <Input type="date" disabled={isView} value={form.dep_dob} onChange={(e) => setFormField("dep_dob", e.target.value)} />
                </Field>

                <Field label="Marital Status">
                  <Select disabled={isView} value={form.marstat} onChange={(e) => setFormField("marstat", e.target.value)}>
                    {MARITAL_STATUS_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Blood Group">
                  <Select disabled={isView} value={form.dep_blood_group} onChange={(e) => setFormField("dep_blood_group", e.target.value)}>
                    <option value="">-- Select Blood Group --</option>
                    <CodeOptions list={bloodGroupOpts} />
                  </Select>
                </Field>

                <Field label="Status" required>
                  <Select disabled={isView} value={form.status_flag} onChange={(e) => setFormField("status_flag", e.target.value)}>
                    {statusOpts.length > 0 ? (
                      <CodeOptions list={statusOpts} />
                    ) : (
                      <>
                        <option value="A">Active</option>
                        <option value="I">Inactive</option>
                      </>
                    )}
                  </Select>
                </Field>

                <Field label="Sponsored By" className="md:col-span-2">
                  <Input
                    disabled={isView}
                    placeholder="Company / Self / Sponsor Name"
                    value={form.dep_sponsored_by}
                    onChange={(e) => setFormField("dep_sponsored_by", e.target.value)}
                  />
                </Field>
              </div>
            </SectionPanel>
          </div>

          <div>
            <SectionPanel title="Travel & Medical Entitlements" icon={Plane}>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ticket Eligible">
                    <Select disabled={isView} value={form.ticket_eligibility} onChange={(e) => setFormField("ticket_eligibility", e.target.value)}>
                      <YesNoOptions list={eligibleOpts} />
                    </Select>
                  </Field>

                  <Field label="Ticket Type">
                    <Select
                      disabled={isView || form.ticket_eligibility !== "Y"}
                      value={form.ticket_type}
                      onChange={(e) => setFormField("ticket_type", e.target.value)}
                    >
                      <option value="">-- Select Ticket Type --</option>
                      <CodeOptions list={ticketTypeOpts} />
                    </Select>
                  </Field>
                </div>

                <Field label="Medical Eligible">
                  <Select disabled={isView} value={form.medical_eligible} onChange={(e) => setFormField("medical_eligible", e.target.value)}>
                    <YesNoOptions list={eligibleOpts} />
                  </Select>
                </Field>
              </div>
            </SectionPanel>
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-3">
          <SectionPanel title="Passport Details" icon={FileText}>
            <div className="grid gap-3">
              <Field label="Passport No">
                <Input disabled={isView} placeholder="e.g. A1234567" value={form.ppt_card} onChange={(e) => setFormField("ppt_card", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valid From">
                  <Input type="date" disabled={isView} value={form.ppt_valid_from} onChange={(e) => setFormField("ppt_valid_from", e.target.value)} />
                </Field>
                <Field label="Valid To">
                  <Input
                    type="date"
                    disabled={isView}
                    value={form.ppt_valid_to}
                    min={form.ppt_valid_from || undefined}
                    onChange={(e) => setFormField("ppt_valid_to", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel title="Residence Card Details" icon={CreditCard}>
            <div className="grid gap-3">
              <Field label="Residence Card No">
                <Input disabled={isView} placeholder="e.g. 10293847" value={form.res_card} onChange={(e) => setFormField("res_card", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valid From">
                  <Input type="date" disabled={isView} value={form.res_valid_from} onChange={(e) => setFormField("res_valid_from", e.target.value)} />
                </Field>
                <Field label="Valid To">
                  <Input
                    type="date"
                    disabled={isView}
                    value={form.res_valid_to}
                    min={form.res_valid_from || undefined}
                    onChange={(e) => setFormField("res_valid_to", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </SectionPanel>

          <SectionPanel title="Insurance Details" icon={HeartPulse}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Insurance Card No">
                <Input disabled={isView} placeholder="Policy / Card number" value={form.ins_card_no} onChange={(e) => setFormField("ins_card_no", e.target.value)} />
              </Field>
              <Field label="Insurance Card Type">
                <Input disabled={isView} placeholder="e.g. Silver, Gold" value={form.ins_card_type} onChange={(e) => setFormField("ins_card_type", e.target.value)} />
              </Field>
              <Field label="Issue Date">
                <Input type="date" disabled={isView} value={form.ins_card_issue_dt} onChange={(e) => setFormField("ins_card_issue_dt", e.target.value)} />
              </Field>
              <Field label="Expiry Date">
                <Input
                  type="date"
                  disabled={isView}
                  value={form.isn_card_exp_dt}
                  min={form.ins_card_issue_dt || undefined}
                  onChange={(e) => setFormField("isn_card_exp_dt", e.target.value)}
                />
              </Field>
            </div>
          </SectionPanel>
        </div>
      </div>
    );
  }

  /* ═════════════ LIST VIEW ═════════════ */
  return (
    <div className="grid gap-2">
      <DataTable
        columns={columns}
        data={visibleRows}
        title={loading ? "Loading..." : `${visibleRows.length.toLocaleString()} Dependant${visibleRows.length !== 1 ? "s" : ""}`}
        subtitle="Employee Dependants"
        searchValue={query}
        onSearchChange={(value) => setQuery(value)}
        searchPlaceholder="Search dependant name, relation..."
        loading={loading}
        emptyText="No dependants found for this employee. Click 'Add Dependant' to create one."
        height={500}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => row._rowId}
        enableExport
        exportFilename="employee-dependants-list.csv"
        toolbar={
          <button
            type="button"
            onClick={() => openEditor("add")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Add Dependant
          </button>
        }
      />

      <Dialog
        open={deleteOpen}
        title="Delete Dependant"
        description={deleteTarget ? `Delete dependant ${deleteTarget.dep_name}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete dependant{" "}
          <strong>{deleteTarget?.dep_name}</strong>?
        </p>
      </Dialog>
    </div>
  );
});

export default HrEmpDependantsTab;