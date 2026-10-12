// src/pages/hr/Hrempdependantspage.tsx
//
// Employee Dependants Page — Freight-style new UI (modelled on Grademasterpage.tsx):
//  • Single-file architecture: list view + full-page editor view
//  • List view with DataTable, toolbar (Refresh, Add Dependant) and row actions (Edit, View, Delete)
//  • Freight-style editor with transaction header (List, Close, Save) and tabbed panels
//  • Employee selection filter panel using LookupField
//  • AlertToast system for feedback and Dialog for delete confirmation

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  CreditCard,
  Edit2,
  Eye,
  FileText,
  HeartPulse,
  IdCard,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import hrEmpDependantsServiceInstance, {
  type THrEmpDependantDetail,
} from "./Upserthrempdependants";

// ── Types ─────────────────────────────────────────────────────────────────────

type DivisionOption = { div_code: string; div_name: string };
type DeptOption = { dept_code: string; dept_name: string };
type SectionOption = { section_code: string; section_name: string };
type EmployeeOption = { employee_id: string; employee_name: string };
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

const MARITAL_STATUS_OPTIONS: { code: string; label: string }[] = [
  { code: "S", label: "Single" },
  { code: "M", label: "Married" },
];

const TABS = ["Dependant Details", "Documents & Insurance"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildParams(
  parameter: string,
  loginid: string,
  companyCode: string,
  code2 = "",
  code3 = "",
  code4 = "",
) {
  return {
    parameter,
    loginid,
    code1: companyCode,
    code2,
    code3,
    code4,
    number1: 0,
    number2: 0,
    number3: 0,
    number4: 0,
    date1: null,
    date2: null,
    date3: null,
    date4: null,
  };
}

function formatDate(value: unknown): string {
  if (!value) return "-";
  const str = String(value).trim();
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toDate(value: unknown): string {
  if (!value) return "";
  const normalized = String(value).trim();
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

// ── UI Building Blocks (Freight Style) ─────────────────────────────────────────

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
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">
              {title}
            </h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`freight-field-label group flex flex-col gap-0.5 ${className ?? ""}`}
    >
      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
        {required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
      </span>
      {children}
      {error && <span className="text-destructive text-[10.5px]">{error}</span>}
    </label>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export function HrEmpDependantsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginid = user?.loginid ?? "ADMIN";
  const companyCode = user?.company_code ?? "";

  // ── Filter state ───────────────────────────────────────────────────────────
  const [division, setDivision] = useState<DivisionOption | null>(null);
  const [department, setDepartment] = useState<DeptOption | null>(null);
  const [section, setSection] = useState<SectionOption | null>(null);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // ── Grid & View state ──────────────────────────────────────────────────────
  const [rows, setRows] = useState<DependantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<FormMode>("add");
  const [activeDependant, setActiveDependant] = useState<DependantRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  // ── Editor Form State ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<DependantFormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<
    Partial<Record<keyof DependantFormState, string>>
  >({});

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DependantRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Master Lookups ─────────────────────────────────────────────────────────
  const { data: relationOpts = [] } = useQuery<RelationOption[]>({
    queryKey: ["hr-dependants-relation", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_DEPENDANTS_RELATION_SELECT", loginid, companyCode),
      );
      return (res as RelationOption[]) ?? [];
    },
  });

  const { data: eligibleOpts = [] } = useQuery<CodeValueOption[]>({
    queryKey: ["hr-dependants-eligible", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_DEPENDANTS_ELIGIBLE_SELECT", loginid, companyCode),
      );
      return (res as CodeValueOption[]) ?? [];
    },
  });

  const { data: ticketTypeOpts = [] } = useQuery<CodeValueOption[]>({
    queryKey: ["hr-dependants-ticket-type", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_DEPENDANTS_TICKET_TYPE_SELECT", loginid, companyCode),
      );
      return (res as CodeValueOption[]) ?? [];
    },
  });

  const { data: bloodGroupOpts = [] } = useQuery<CodeValueOption[]>({
    queryKey: ["hr-dependants-blood-group", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_DEPENDANTS_BLOOD_GROUP_SELECT", loginid, companyCode),
      );
      return (res as CodeValueOption[]) ?? [];
    },
  });

  const { data: statusOpts = [] } = useQuery<CodeValueOption[]>({
    queryKey: ["hr-dependants-status", companyCode],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_EMP_DEPENDANTS_STATUS_SELECT", loginid, companyCode),
      );
      return (res as CodeValueOption[]) ?? [];
    },
  });

  // ── Lookup Loaders for LookupField ─────────────────────────────────────────
  const loadDivisions = useCallback(
    () =>
      getDynamicLookup(
        buildParams("EDUCATION_QUALIFICATION_LANG_DIVISION_LIST", loginid, companyCode),
      ),
    [loginid, companyCode],
  );

  const loadDepartments = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_DEPARTMENT_DEPTCODE",
          loginid,
          companyCode,
          division?.div_code ?? "",
        ),
      ),
    [loginid, companyCode, division?.div_code],
  );

  const loadSections = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_MS_HR_SECTION",
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
        ),
      ),
    [loginid, companyCode, division?.div_code, department?.dept_code],
  );

  const loadEmployees = useCallback(
    () =>
      getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_HR_EMPLOYEE_LIST_WITH_MANAGER",
          loginid,
          companyCode,
          division?.div_code ?? "",
          department?.dept_code ?? "",
          section?.section_code ?? "",
        ),
      ),
    [loginid, companyCode, division?.div_code, department?.dept_code, section?.section_code],
  );

  // ── Fetch Dependants for Selected Employee ──────────────────────────────────
  const loadDependants = useCallback(async () => {
    if (!employee?.employee_id || !companyCode) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getDynamicLookup(
        buildParams(
          "EDUCATION_QUALIFICATION_EMP_DEPENDANTS_SELECT",
          loginid,
          companyCode,
          employee.employee_id,
        ),
      );
      const raw = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
      const list: DependantRow[] = raw.map((r, i) => ({
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
      }));
      setRows(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load dependants");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [employee?.employee_id, companyCode, loginid, toast]);

  useEffect(() => {
    void loadDependants();
  }, [loadDependants]);

  // Reset cascade
  useEffect(() => {
    setDepartment(null);
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, [division]);

  useEffect(() => {
    setSection(null);
    setEmployee(null);
    setRows([]);
  }, [department]);

  useEffect(() => {
    setEmployee(null);
    setRows([]);
  }, [section]);

  /* ── Populate Form on Mode Change ── */
  useEffect(() => {
    if (view === "editor") {
      setActiveTab(0);
      setErrors({});
      if ((editorMode === "edit" || editorMode === "view") && activeDependant) {
        setForm({
          dep_name: String(activeDependant.dep_name ?? ""),
          dep_relation: String(activeDependant.dep_relation ?? ""),
          dep_dob: toDate(activeDependant.dep_dob),
          dep_sponsored_by: String(activeDependant.dep_sponsored_by ?? ""),
          ticket_eligibility: String(activeDependant.ticket_eligibility ?? "N"),
          ticket_type: String(activeDependant.ticket_type ?? ""),
          marstat: String(activeDependant.marstat ?? "S"),
          medical_eligible: String(activeDependant.medical_eligible ?? "N"),
          dep_blood_group: String(activeDependant.dep_blood_group ?? ""),
          status_flag: String(activeDependant.status_flag ?? "A"),
          ppt_card: String(activeDependant.ppt_card ?? ""),
          res_card: String(activeDependant.res_card ?? ""),
          ppt_valid_from: toDate(activeDependant.ppt_valid_from),
          ppt_valid_to: toDate(activeDependant.ppt_valid_to),
          res_valid_from: toDate(activeDependant.res_valid_from),
          res_valid_to: toDate(activeDependant.res_valid_to),
          ins_card_no: String(activeDependant.ins_card_no ?? ""),
          ins_card_type: String(activeDependant.ins_card_type ?? ""),
          ins_card_issue_dt: toDate(activeDependant.ins_card_issue_dt),
          isn_card_exp_dt: toDate(activeDependant.isn_card_exp_dt),
        });
      } else {
        setForm({ ...EMPTY_FORM });
      }
    }
  }, [view, editorMode, activeDependant]);

  const setFormField = (field: keyof DependantFormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "ticket_eligibility" && value !== "Y") {
        next.ticket_type = "";
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  /* ── Form Validation ── */
  const validateForm = (): string | null => {
    const next: Partial<Record<keyof DependantFormState, string>> = {};
    if (!form.dep_name.trim()) next.dep_name = "Dependant Name is required";
    if (!form.dep_relation) next.dep_relation = "Relation is required";
    if (!form.status_flag) next.status_flag = "Status is required";

    if (form.ppt_valid_from && form.ppt_valid_to && form.ppt_valid_to < form.ppt_valid_from) {
      next.ppt_valid_to = "Passport Valid To must be after Valid From";
    }
    if (form.res_valid_from && form.res_valid_to && form.res_valid_to < form.res_valid_from) {
      next.res_valid_to = "Residence Valid To must be after Valid From";
    }
    if (
      form.ins_card_issue_dt &&
      form.isn_card_exp_dt &&
      form.isn_card_exp_dt < form.ins_card_issue_dt
    ) {
      next.isn_card_exp_dt = "Insurance Expiry Date must be after Issue Date";
    }

    setErrors(next);
    const firstKey = Object.keys(next)[0] as keyof DependantFormState | undefined;
    if (firstKey) {
      if (
        [
          "ppt_card",
          "ppt_valid_from",
          "ppt_valid_to",
          "res_card",
          "res_valid_from",
          "res_valid_to",
          "ins_card_no",
          "ins_card_type",
          "ins_card_issue_dt",
          "isn_card_exp_dt",
        ].includes(firstKey)
      ) {
        setActiveTab(1);
      } else {
        setActiveTab(0);
      }
      return next[firstKey] ?? "Validation error";
    }
    return null;
  };

  /* ── Navigation Handlers ── */
  const openEditor = (mode: FormMode, row: DependantRow | null = null) => {
    if (!employee?.employee_id) {
      toast.warning("Please select an employee first");
      return;
    }
    setEditorMode(mode);
    setActiveDependant(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditorMode("add");
    setActiveDependant(null);
  };

  /* ── Save Form ── */
  const handleSave = async () => {
    if (!employee?.employee_id) {
      toast.warning("Please select an employee first");
      return;
    }

    const error = validateForm();
    if (error) {
      toast.warning(error);
      return;
    }

    setSaving(true);
    try {
      let updatedRows: DependantRow[] = [];

      if (editorMode === "add") {
        const newRow: DependantRow = {
          _rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          _isPersisted: false,
          dep_serial_number: String(rows.length + 1),
          dep_relation: form.dep_relation,
          dep_relation_desc:
            relationOpts.find((o) => o.rel_code === form.dep_relation)?.rel_desc ?? "",
          dep_name: form.dep_name.trim(),
          dep_dob: form.dep_dob || "",
          dep_sponsored_by: form.dep_sponsored_by,
          ticket_eligibility: form.ticket_eligibility,
          ticket_type: form.ticket_type,
          marstat: form.marstat,
          medical_eligible: form.medical_eligible,
          dep_blood_group: form.dep_blood_group,
          status_flag: form.status_flag || "A",
          ppt_card: form.ppt_card,
          res_card: form.res_card,
          ppt_valid_from: form.ppt_valid_from || "",
          ppt_valid_to: form.ppt_valid_to || "",
          res_valid_from: form.res_valid_from || "",
          res_valid_to: form.res_valid_to || "",
          ins_card_no: form.ins_card_no,
          ins_card_type: form.ins_card_type,
          ins_card_issue_dt: form.ins_card_issue_dt || "",
          isn_card_exp_dt: form.isn_card_exp_dt || "",
        };
        updatedRows = [...rows, newRow];
      } else {
        updatedRows = rows.map((r) => {
          if (r._rowId === activeDependant?._rowId) {
            return {
              ...r,
              dep_relation: form.dep_relation,
              dep_relation_desc:
                relationOpts.find((o) => o.rel_code === form.dep_relation)?.rel_desc ?? "",
              dep_name: form.dep_name.trim(),
              dep_dob: form.dep_dob || "",
              dep_sponsored_by: form.dep_sponsored_by,
              ticket_eligibility: form.ticket_eligibility,
              ticket_type: form.ticket_type,
              marstat: form.marstat,
              medical_eligible: form.medical_eligible,
              dep_blood_group: form.dep_blood_group,
              status_flag: form.status_flag,
              ppt_card: form.ppt_card,
              res_card: form.res_card,
              ppt_valid_from: form.ppt_valid_from || "",
              ppt_valid_to: form.ppt_valid_to || "",
              res_valid_from: form.res_valid_from || "",
              res_valid_to: form.res_valid_to || "",
              ins_card_no: form.ins_card_no,
              ins_card_type: form.ins_card_type,
              ins_card_issue_dt: form.ins_card_issue_dt || "",
              isn_card_exp_dt: form.isn_card_exp_dt || "",
            };
          }
          return r;
        });
      }

      const dependant_details: THrEmpDependantDetail[] = updatedRows.map((r, idx) => ({
        dep_serial_number: idx + 1,
        employee_id: employee.employee_id,
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

      const success = await hrEmpDependantsServiceInstance.upsertHrEmpDependantsApi({
        company_code: companyCode,
        dependant_details,
        loginid,
      });

      if (!success) throw new Error("Save failed. Please try again.");
      toast.success(
        editorMode === "edit"
          ? "Dependant updated successfully"
          : "Dependant saved successfully",
      );
      handleCloseEditor();
      await loadDependants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save dependant");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const requestDelete = (row: DependantRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !employee?.employee_id) return;
    setDeleting(true);
    try {
      const updatedRows = rows.map((r) =>
        r._rowId === deleteTarget._rowId ? { ...r, status_flag: "D" } : r,
      );

      const dependant_details: THrEmpDependantDetail[] = updatedRows.map((r, idx) => ({
        dep_serial_number: idx + 1,
        employee_id: employee.employee_id,
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

      const success = await hrEmpDependantsServiceInstance.upsertHrEmpDependantsApi({
        company_code: companyCode,
        dependant_details,
        loginid,
      });

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

  /* ── Filtered rows for list view ── */
  const visibleRows = useMemo(
    () => rows.filter((r) => r.status_flag !== "D"),
    [rows],
  );

  /* ── Table Columns ── */
  const columns = useMemo<ColumnDef<DependantRow>[]>(
    () => [
      {
        id: "index",
        header: "SlNo",
        size: 60,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.index + 1}</span>
        ),
      },
      {
        accessorKey: "dep_name",
        header: "Dependant Name",
        size: 180,
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{String(getValue() || "-")}</span>
        ),
      },
      {
        accessorKey: "dep_relation",
        header: "Relation",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => {
          const code = row.original.dep_relation;
          const desc =
            row.original.dep_relation_desc ||
            relationOpts.find((o) => o.rel_code === code)?.rel_desc;
          return desc || code || "-";
        },
      },
      {
        accessorKey: "dep_dob",
        header: "Date of Birth",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => formatDate(getValue()),
      },
      {
        accessorKey: "marstat",
        header: "Marital Status",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() || "");
          if (val === "M") return "Married";
          if (val === "S") return "Single";
          return val || "-";
        },
      },
      {
        accessorKey: "ticket_eligibility",
        header: "Ticket Eligible",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => (String(getValue() || "N") === "Y" ? "Yes" : "No"),
      },
      {
        accessorKey: "ticket_type",
        header: "Ticket Type",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => {
          const code = row.original.ticket_type;
          const desc = ticketTypeOpts.find((o) => o.value_code === code)?.value_desc;
          return desc || code || "-";
        },
      },
      {
        accessorKey: "medical_eligible",
        header: "Medical Eligible",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => (String(getValue() || "N") === "Y" ? "Yes" : "No"),
      },
      {
        accessorKey: "dep_blood_group",
        header: "Blood Group",
        size: 100,
        enableSorting: false,
        cell: ({ getValue }) => String(getValue() || "-"),
      },
      {
        accessorKey: "status_flag",
        header: "Status",
        size: 100,
        enableSorting: false,
        cell: ({ getValue }) =>
          String(getValue() || "A") === "A" ? (
            <span className="text-[0.8125rem] font-semibold text-green-600">Active</span>
          ) : (
            <span className="text-[0.8125rem] font-semibold text-red-600">Inactive</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableColumnFilter: false,
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

  /* ─────────────────────────────────────────────────────────
     EDITOR VIEW — Full-page Freight Header + Dense Form
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    const isView = editorMode === "view";
    const title =
      editorMode === "add"
        ? "New Dependant"
        : editorMode === "edit"
        ? "Edit Dependant"
        : "View Dependant";
    const badge =
      editorMode === "add" ? "Draft" : editorMode === "edit" ? "Editing" : "View only";

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
                  {title}
                </h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                {employee && (
                  <span className="text-xs text-muted-foreground">
                    Employee: {employee.employee_id} - {employee.employee_name}
                  </span>
                )}
                {activeDependant?.dep_name && (
                  <span className="text-xs font-medium text-foreground">
                    ({activeDependant.dep_name})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCloseEditor}
              disabled={saving}
            >
              <X size={14} /> Close
            </Button>
            {!isView && (
              <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? "Saving" : "Save"}
              </Button>
            )}
          </div>
        </div>

        {/* Tabbed Form Shell */}
        <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
          <div className="freight-tabs-list flex overflow-x-auto">
            {TABS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(index)}
                aria-pressed={activeTab === index}
                className={`freight-workspace-tab ${activeTab === index ? "active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="freight-tabs-panel border-t p-3 grid gap-3">
            {/* ══ TAB 0 — Dependant Details & Entitlements ══ */}
            {activeTab === 0 && (
              <>
                <SectionPanel title="Personal Information" icon={IdCard}>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    <Field label="Dependant Name" required error={errors.dep_name}>
                      <Input
                        disabled={isView}
                        placeholder="Enter full name"
                        value={form.dep_name}
                        onChange={(e) => setFormField("dep_name", e.target.value)}
                      />
                    </Field>

                    <Field label="Relation" required error={errors.dep_relation}>
                      <Select
                        disabled={isView}
                        value={form.dep_relation}
                        onChange={(e) => setFormField("dep_relation", e.target.value)}
                      >
                        <option value="">-- Select Relation --</option>
                        {relationOpts.map((o) => (
                          <option key={o.rel_code} value={o.rel_code}>
                            {o.rel_desc}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Date of Birth">
                      <Input
                        type="date"
                        disabled={isView}
                        value={form.dep_dob}
                        onChange={(e) => setFormField("dep_dob", e.target.value)}
                      />
                    </Field>

                    <Field label="Marital Status">
                      <Select
                        disabled={isView}
                        value={form.marstat}
                        onChange={(e) => setFormField("marstat", e.target.value)}
                      >
                        {MARITAL_STATUS_OPTIONS.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Blood Group">
                      <Select
                        disabled={isView}
                        value={form.dep_blood_group}
                        onChange={(e) => setFormField("dep_blood_group", e.target.value)}
                      >
                        <option value="">-- Select Blood Group --</option>
                        {bloodGroupOpts.map((o) => (
                          <option key={o.value_code} value={o.value_code}>
                            {o.value_desc}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Status" required error={errors.status_flag}>
                      <Select
                        disabled={isView}
                        value={form.status_flag}
                        onChange={(e) => setFormField("status_flag", e.target.value)}
                      >
                        {statusOpts.length > 0 ? (
                          statusOpts.map((o) => (
                            <option key={o.value_code} value={o.value_code}>
                              {o.value_desc}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="A">Active</option>
                            <option value="I">Inactive</option>
                          </>
                        )}
                      </Select>
                    </Field>

                    <Field label="Sponsored By" className="sm:col-span-2">
                      <Input
                        disabled={isView}
                        placeholder="Company / Self / Sponsor Name"
                        value={form.dep_sponsored_by}
                        onChange={(e) => setFormField("dep_sponsored_by", e.target.value)}
                      />
                    </Field>
                  </div>
                </SectionPanel>

                <SectionPanel title="Travel & Medical Entitlements" icon={Plane}>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    <Field label="Ticket Eligible">
                      <Select
                        disabled={isView}
                        value={form.ticket_eligibility}
                        onChange={(e) => setFormField("ticket_eligibility", e.target.value)}
                      >
                        {eligibleOpts.length > 0 ? (
                          eligibleOpts.map((o) => (
                            <option key={o.value_code} value={o.value_code}>
                              {o.value_desc}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="N">No</option>
                            <option value="Y">Yes</option>
                          </>
                        )}
                      </Select>
                    </Field>

                    <Field label="Ticket Type">
                      <Select
                        disabled={isView || form.ticket_eligibility !== "Y"}
                        value={form.ticket_type}
                        onChange={(e) => setFormField("ticket_type", e.target.value)}
                      >
                        <option value="">-- Select Ticket Type --</option>
                        {ticketTypeOpts.map((o) => (
                          <option key={o.value_code} value={o.value_code}>
                            {o.value_desc}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Medical Eligible">
                      <Select
                        disabled={isView}
                        value={form.medical_eligible}
                        onChange={(e) => setFormField("medical_eligible", e.target.value)}
                      >
                        {eligibleOpts.length > 0 ? (
                          eligibleOpts.map((o) => (
                            <option key={o.value_code} value={o.value_code}>
                              {o.value_desc}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="N">No</option>
                            <option value="Y">Yes</option>
                          </>
                        )}
                      </Select>
                    </Field>
                  </div>
                </SectionPanel>
              </>
            )}

            {/* ══ TAB 1 — Documents & Insurance ══ */}
            {activeTab === 1 && (
              <>
                <div className="grid gap-3 lg:grid-cols-2">
                  <SectionPanel title="Passport Details" icon={FileText}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Passport No">
                        <Input
                          disabled={isView}
                          placeholder="e.g. A1234567"
                          value={form.ppt_card}
                          onChange={(e) => setFormField("ppt_card", e.target.value)}
                        />
                      </Field>

                      <Field label="Valid From">
                        <Input
                          type="date"
                          disabled={isView}
                          value={form.ppt_valid_from}
                          onChange={(e) => setFormField("ppt_valid_from", e.target.value)}
                        />
                      </Field>

                      <Field label="Valid To" error={errors.ppt_valid_to}>
                        <Input
                          type="date"
                          disabled={isView}
                          value={form.ppt_valid_to}
                          onChange={(e) => setFormField("ppt_valid_to", e.target.value)}
                        />
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Residence Card Details" icon={CreditCard}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Residence Card No">
                        <Input
                          disabled={isView}
                          placeholder="e.g. 10293847"
                          value={form.res_card}
                          onChange={(e) => setFormField("res_card", e.target.value)}
                        />
                      </Field>

                      <Field label="Valid From">
                        <Input
                          type="date"
                          disabled={isView}
                          value={form.res_valid_from}
                          onChange={(e) => setFormField("res_valid_from", e.target.value)}
                        />
                      </Field>

                      <Field label="Valid To" error={errors.res_valid_to}>
                        <Input
                          type="date"
                          disabled={isView}
                          value={form.res_valid_to}
                          onChange={(e) => setFormField("res_valid_to", e.target.value)}
                        />
                      </Field>
                    </div>
                  </SectionPanel>
                </div>

                <SectionPanel title="Insurance Details" icon={HeartPulse}>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <Field label="Insurance Card No">
                      <Input
                        disabled={isView}
                        placeholder="Policy / Card number"
                        value={form.ins_card_no}
                        onChange={(e) => setFormField("ins_card_no", e.target.value)}
                      />
                    </Field>

                    <Field label="Insurance Card Type">
                      <Input
                        disabled={isView}
                        placeholder="e.g. Silver, Gold"
                        value={form.ins_card_type}
                        onChange={(e) => setFormField("ins_card_type", e.target.value)}
                      />
                    </Field>

                    <Field label="Issue Date">
                      <Input
                        type="date"
                        disabled={isView}
                        value={form.ins_card_issue_dt}
                        onChange={(e) => setFormField("ins_card_issue_dt", e.target.value)}
                      />
                    </Field>

                    <Field label="Expiry Date" error={errors.isn_card_exp_dt}>
                      <Input
                        type="date"
                        disabled={isView}
                        value={form.isn_card_exp_dt}
                        onChange={(e) => setFormField("isn_card_exp_dt", e.target.value)}
                      />
                    </Field>
                  </div>
                </SectionPanel>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style + Employee Selection Panel
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            HR Employee - Employee Dependants
          </h2>
        </div>
      </div>

      {/* Employee Selection Filter Panel */}
      <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
        <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="freight-section-icon">
              <Users size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">
                Employee Selection
              </h3>
            </div>
          </div>
          {employee && (
            <span className="text-[11px] font-medium text-primary">
              Selected: {employee.employee_id} - {employee.employee_name}
            </span>
          )}
        </div>
        <div className="freight-panel-body p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="freight-field-label group flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">Division</span>
              <LookupField
                key={`division-${resetKey}`}
                compact
                label="Division"
                value={division?.div_code ?? ""}
                displayValue={division ? `${division.div_code} - ${division.div_name}` : ""}
                columns={[
                  { field: "div_code", header: "Code" },
                  { field: "div_name", header: "Division" },
                ]}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={loadDivisions}
                onChange={(_, row) => {
                  setDivision(
                    row
                      ? {
                          div_code: String(row.div_code ?? ""),
                          div_name: String(row.div_name ?? ""),
                        }
                      : null,
                  );
                }}
              />
            </label>

            <label className="freight-field-label group flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Department <strong className="text-destructive">*</strong>
              </span>
              <LookupField
                key={`department-${resetKey}-${division?.div_code ?? ""}`}
                compact
                label="Department"
                value={department?.dept_code ?? ""}
                displayValue={
                  department ? `${department.dept_code} - ${department.dept_name}` : ""
                }
                columns={[
                  { field: "dept_code", header: "Code" },
                  { field: "dept_name", header: "Department" },
                ]}
                valueField="dept_code"
                displayFields={["dept_code", "dept_name"]}
                loadOptions={loadDepartments}
                onChange={(_, row) => {
                  setDepartment(
                    row
                      ? {
                          dept_code: String(row.dept_code ?? ""),
                          dept_name: String(row.dept_name ?? ""),
                        }
                      : null,
                  );
                }}
              />
            </label>

            <label className="freight-field-label group flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Section <strong className="text-destructive">*</strong>
              </span>
              <LookupField
                key={`section-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}`}
                compact
                label="Section"
                value={section?.section_code ?? ""}
                displayValue={section ? `${section.section_code} - ${section.section_name}` : ""}
                columns={[
                  { field: "section_code", header: "Code" },
                  { field: "section_name", header: "Section" },
                ]}
                valueField="section_code"
                displayFields={["section_code", "section_name"]}
                loadOptions={loadSections}
                onChange={(_, row) => {
                  setSection(
                    row
                      ? {
                          section_code: String(row.section_code ?? ""),
                          section_name: String(row.section_name ?? ""),
                        }
                      : null,
                  );
                }}
              />
            </label>

            <label className="freight-field-label group flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Employee <strong className="text-destructive">*</strong>
              </span>
              <LookupField
                key={`employee-${resetKey}-${division?.div_code ?? ""}-${department?.dept_code ?? ""}-${section?.section_code ?? ""}`}
                compact
                label="Employee"
                value={employee?.employee_id ?? ""}
                displayValue={
                  employee ? `${employee.employee_id} - ${employee.employee_name}` : ""
                }
                columns={[
                  { field: "employee_id", header: "ID" },
                  { field: "employee_name", header: "Employee" },
                ]}
                valueField="employee_id"
                displayFields={["employee_id", "employee_name"]}
                loadOptions={loadEmployees}
                onChange={(_, row) => {
                  setEmployee(
                    row
                      ? {
                          employee_id: String(row.employee_id ?? ""),
                          employee_name: String(row.employee_name ?? row.rpt_name ?? ""),
                        }
                      : null,
                  );
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Dependants DataTable */}
      <DataTable
        columns={columns}
        data={visibleRows}
        title={
          loading
            ? "Loading..."
            : employee
            ? `${visibleRows.length.toLocaleString()} Dependant${visibleRows.length !== 1 ? "s" : ""}`
            : "No Employee Selected"
        }
        subtitle={
          employee
            ? `Dependants for ${employee.employee_id} - ${employee.employee_name}`
            : "Please select an employee above to view dependants"
        }
        searchValue={query}
        onSearchChange={(value) => setQuery(value)}
        searchPlaceholder="Search dependant name, relation..."
        loading={loading}
        emptyText={
          employee
            ? "No dependants found for this employee. Click 'Add Dependant' to create one."
            : "Please select an employee above to view dependants"
        }
        height={500}
        minWidth={1100}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => row._rowId}
        enableExport
        exportFilename="employee-dependants-list.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (employee) {
                  void loadDependants();
                } else {
                  setResetKey((k) => k + 1);
                  setDivision(null);
                  setDepartment(null);
                  setSection(null);
                  setEmployee(null);
                  setRows([]);
                  void queryClient.invalidateQueries({
                    queryKey: ["hr-dependants-relation", companyCode],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["hr-dependants-eligible", companyCode],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["hr-dependants-ticket-type", companyCode],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["hr-dependants-blood-group", companyCode],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["hr-dependants-status", companyCode],
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              type="button"
              disabled={!employee?.employee_id}
              onClick={() => openEditor("add")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Add Dependant
            </button>
          </div>
        }
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteOpen}
        title="Delete Dependant"
        description={deleteTarget ? `Delete dependant ${deleteTarget.dep_name}?` : undefined}
        compact
        tone="danger"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
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
    </section>
  );
}
export default HrEmpDependantsPage;