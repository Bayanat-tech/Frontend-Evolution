import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft, Banknote, Calculator, ChevronDown, ChevronUp, Edit2, FileText, List, Loader2,
  Plus, RefreshCw, Save, StickyNote, Trash2, UserCheck, X,
} from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup, type LookupRow } from "../../api/lookups";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/AlertToast";
import { LookupField } from "../../components/ui/LookupField";

// ---------- Types ----------
type MainRow = {
  company_code: string;
  doc_type: string;
  doc_no: number | string;
  doc_date: string | null;
  ref_no: string | null;
  name_from: string | null;
  addr_from: string | null;
  name_to: string | null;
  addr_to: string | null;
  lettr_subject: string | null;
  remarks_1: string | null;
  remarks_2: string | null;
  remarks_3: string | null;
  curr_code: string | null;
  ex_rate: number;
  amount: number;
  signatory_name: string | null;
  signatory_position: string | null;
  user_id: string | null;
  user_dt: string | null;
  employee_id: string | null;
  employee_code: string | null;
  pay_comp_id: string | null;
  recover_mth_amt: number;
  recover_from_dt: string | null;
  allocated_amt: number;
  balance_amt: number;
  employee_name: string | null;
  deduct_from_leave: string;
  deduct_noof_leavedays: number;
  ref_hdr_lve_slno: string | null;
  ref_leave_doc_no: string | null;
  cancel_by: string | null;
  cancel_date: string | null;
  doc_status: string;
  recovery_period: number | null;
};

type DetailRow = {
  company_code: string;
  doc_type: string;
  doc_no: number | string;
  serial_no: number;
  employee_id: string | null;
  emplyee_code: string | null;
  employee_code?: string | null;
  pay_comp_id: string | null;
  description?: string | null;
  recover_mth_amt: number;
  recover_from_dt: string | null;
  allocated_amt: number;
  balance_amt: number;
  deduct_from_leave: string;
  deduct_noof_leavedays: number;
  ref_leave_doc_no: string | null;
  ref_hdr_lve_slno: string | null;
  amount: number;
  cancel_by: string | null;
  cancel_date: string | null;
  cancel_status: string | null;
  sr_no: number | null;
  post_payroll: string | null;
  payroll_closed: string | null;
  recover_in: number;
  remarks?: string | null;
  last_posted_month?: number | null;
  post_date?: string | null;
  leave_days_paid?: number | null;
  sal_type_flag?: string | null;
  last_updated_by?: string | null;
  sys_gen?: string | null;
  pay_month?: number | null;
  pay_year?: number | null;
};

type FormMode = "list" | "add" | "edit";

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  details?: string;
};

const DOC_TYPE_OPTIONS = [
  { value: "ADV", label: "Salary Advance" },
  { value: "LON", label: "Loan Recovery" },
  { value: "TRP", label: "Transport Recovery" },
] as const;

const DOC_TYPE_PAY_COMP_MAP: Record<string, string> = {
  ADV: "SA",
  LON: "003",
  TRP: "013",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  ADV: "Salary Advance",
  LON: "Loan Recovery",
  TRP: "Transport Recovery",
  SA: "Salary Advance", // legacy
};

/* ── Default letter signatory values ── */
const DEFAULT_NAME_FROM          = "Abdullah Khalfan Al Fulaiti";
const DEFAULT_ADDR_FROM          = "HR Manager";
const DEFAULT_SIGNATORY_NAME     = "Abdullah Khalfan Al Fulaiti";
const DEFAULT_SIGNATORY_POSITION = "HR Manager";

const normalizeDocType = (dt: string | null | undefined): string => {
  if (!dt) return "ADV";
  if (dt === "SA") return "ADV"; // legacy → new code
  return ["ADV", "LON", "TRP"].includes(dt) ? dt : "ADV";
};

// ---------- Oracle column widths (subset used by the form) ----------
const FIELD_LIMITS = {
  // HDR
  ref_no:               30,     // REF_NO VARCHAR2(30)
  name_from:           100,     // NAME_FROM VARCHAR2(100)
  addr_from:           250,     // ADDR_FROM VARCHAR2(250)
  name_to:             100,     // NAME_TO VARCHAR2(100)
  addr_to:             250,     // ADDR_TO VARCHAR2(250)
  lettr_subject:       250,     // LETTR_SUBJECT VARCHAR2(250)
  remarks_1:          1000,     // REMARKS_1 VARCHAR2(1000)
  remarks_2:          1000,     // REMARKS_2 VARCHAR2(1000)
  signatory_name:      100,     // SIGNATORY_NAME VARCHAR2(100)
  signatory_position:  100,     // SIGNATORY_POSITION VARCHAR2(100)
  // DTL — description is persisted into REMARKS VARCHAR2(20)
  description:          20,     // DTL.REMARKS VARCHAR2(20)
} as const;

function countDecimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = String(Math.abs(n));
  const m = s.match(/e-(\d+)/i);
  if (m) return Number(m[1]);
  const dot = s.indexOf(".");
  return dot >= 0 ? s.length - dot - 1 : 0;
}

function validateForm(header: Partial<MainRow>, details: DetailRow[]): string | null {
  const hdrChecks: Array<[keyof typeof FIELD_LIMITS, string | null | undefined, string]> = [
    ["ref_no",             header.ref_no,             "Ref No"],
    ["name_from",          header.name_from,          "Name From"],
    ["addr_from",          header.addr_from,          "Addr From"],
    ["name_to",            header.name_to,            "Name To"],
    ["addr_to",            header.addr_to,            "Addr To"],
    ["lettr_subject",      header.lettr_subject,      "Letter Subject"],
    ["remarks_1",          header.remarks_1,          "Remarks 1"],
    ["remarks_2",          header.remarks_2,          "Remarks 2"],
    ["signatory_name",     header.signatory_name,     "Signatory Name"],
    ["signatory_position", header.signatory_position, "Signatory Position"],
  ];
  for (const [key, val, label] of hdrChecks) {
    if ((val?.length ?? 0) > FIELD_LIMITS[key]) {
      return `${label} exceeds ${FIELD_LIMITS[key]} characters (currently ${val?.length}).`;
    }
  }

  const amt = Number(header.amount ?? 0);
  if (Number.isFinite(amt) && Math.abs(amt) >= 1e14) {
    return "Amount is too large (max 14 integer digits, 4 decimals).";
  }
  if (countDecimals(amt) > 4) {
    return "Amount can have at most 4 decimal places.";
  }
  const period = Number(header.recovery_period ?? 0);
  if (period < 0 || period > 99999) {
    return "Period must be between 0 and 99999.";
  }

  for (let i = 0; i < details.length; i++) {
    const d = details[i];
    if ((d.description?.length ?? 0) > FIELD_LIMITS.description) {
      return `Line ${i + 1}: Description exceeds ${FIELD_LIMITS.description} characters.`;
    }
    if (countDecimals(Number(d.recover_mth_amt ?? 0)) > 6) {
      return `Line ${i + 1}: Month Amount can have at most 6 decimal places.`;
    }
  }

  return null; // OK
}

// ---------- API helper ----------
function extractApiErrorMessage(error: unknown, fallback: string): string {
  const anyErr = error as {
    response?: { data?: { details?: string; message?: string } };
    message?: string;
  };
  const data = anyErr?.response?.data;
  const backendMessage = data?.details || data?.message;
  if (backendMessage && typeof backendMessage === "string") return backendMessage;
  if (error instanceof Error) return error.message;
  return fallback;
}

async function insUpdHrSalaryAdvDed(payload: {
  header: Record<string, unknown>;
  details: Record<string, unknown>[];
}) {
  try {
    const response = await api.post<ApiResponse>("/api/hr/advancesalaryrecovery/insUpd", payload);
    if (!response.data.success) {
      throw new Error(
        response.data.details || response.data.message || "Unable to save salary advance recovery",
      );
    }
    return response.data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Unable to save salary advance recovery"));
  }
}

// ---------- Helpers ----------
const toInputDate = (val: unknown): string => {
  if (!val) return "";
  const raw = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const DOC_TYPE_DEFAULTS: Record<string, { pay_comp_id: string; description: string }> = {
  ADV: { pay_comp_id: "SA",  description: "Salary Advance" },
  LON: { pay_comp_id: "003", description: "Loan Recovery" },
  TRP: { pay_comp_id: "013", description: "Transport Recovery" },
};

const getDocTypeDefaults = (docType: string | null | undefined) => {
  const dt = normalizeDocType(docType);
  return DOC_TYPE_DEFAULTS[dt] ?? DOC_TYPE_DEFAULTS.ADV;
};

const emptyHeader = (): Partial<MainRow> => {
  const defaults = getDocTypeDefaults("ADV");
  return {
    doc_type: "ADV",
    doc_date: new Date().toISOString().slice(0, 10),
    ref_no: "",
    name_from: DEFAULT_NAME_FROM,
    addr_from: DEFAULT_ADDR_FROM,
    name_to: "",
    addr_to: "",
    lettr_subject: "Salary Advance",
    remarks_1: "",
    remarks_2: "",
    remarks_3: "",
    curr_code: null,
    ex_rate: 1,
    amount: 0,
    recover_from_dt: new Date().toISOString().slice(0, 10),
    recovery_period: 0,
    signatory_name: DEFAULT_SIGNATORY_NAME,
    signatory_position: DEFAULT_SIGNATORY_POSITION,
    employee_code: "",
    employee_id: "",
    employee_name: "",
    pay_comp_id: defaults.pay_comp_id,
    recover_mth_amt: 0,
    allocated_amt: 0,
    balance_amt: 0,
    deduct_from_leave: "N",
    deduct_noof_leavedays: 0,
    ref_hdr_lve_slno: null,
    ref_leave_doc_no: null,
    cancel_by: null,
    cancel_date: null,
    doc_status: "N",
    user_id: null,
    user_dt: null,
  };
};

const emptyDetailRow = (
  companyCode: string,
  docType: string,
  docNo: string | number,
  serial: number,
): DetailRow => {
  const dt = docType || "ADV";
  const defaults = getDocTypeDefaults(dt);
  return {
    company_code: companyCode,
    doc_type: docType || "ADV",
    doc_no: docNo || "",
    serial_no: serial,
    employee_id: null,
    emplyee_code: null,
    pay_comp_id: defaults.pay_comp_id,
    description: defaults.description,
    recover_mth_amt: 0,
    recover_from_dt: new Date().toISOString().slice(0, 10),
    allocated_amt: 0,
    balance_amt: 0,
    deduct_from_leave: "N",
    deduct_noof_leavedays: 0,
    ref_leave_doc_no: null,
    ref_hdr_lve_slno: null,
    amount: 0,
    cancel_by: null,
    cancel_date: null,
    cancel_status: "N",
    sr_no: serial,
    post_payroll: null,
    payroll_closed: "N",
    recover_in: 0,
    remarks: null,
    last_posted_month: null,
    post_date: null,
    leave_days_paid: null,
    sal_type_flag: "N",
    last_updated_by: null,
    sys_gen: "N",
    pay_month: null,
    pay_year: null,
  };
};

const formatDisplayDate = (val: string | null | undefined) => {
  if (!val) return "";
  try {
    return new Date(val).toLocaleDateString("en-GB");
  } catch {
    return val;
  }
};

function buildSavePayload(
  header: Partial<MainRow>,
  details: DetailRow[],
  companyCode: string,
  userId: string | null | undefined,
) {
  const isNew = !header.doc_no || header.doc_no === "" || Number(header.doc_no) === 0;

  const headerPayload: Record<string, unknown> = {
    company_code: companyCode,
    doc_type: header.doc_type || "ADV",
    doc_no: isNew ? 0 : Number(header.doc_no),
    doc_date: header.doc_date || null,
    ref_no: header.ref_no || null,
    name_from: header.name_from || null,
    addr_from: header.addr_from || null,
    name_to: header.name_to || null,
    addr_to: header.addr_to || null,
    lettr_subject: header.lettr_subject || null,
    remarks_1: header.remarks_1 || null,
    remarks_2: header.remarks_2 || null,
    remarks_3: header.remarks_3 || null,
    curr_code: header.curr_code || null,
    ex_rate: header.ex_rate != null && String(header.ex_rate) !== "" ? Number(header.ex_rate) : 1,
    amount: header.amount != null ? Number(header.amount) : 0,
    signatory_name: header.signatory_name || null,
    signatory_position: header.signatory_position || null,
    user_id: header.user_id || userId || null,
    user_dt: header.user_dt || new Date().toISOString(),
    employee_id: header.employee_id || null,
    employee_code: header.employee_code || null,
    pay_comp_id: header.pay_comp_id || null,
    recover_mth_amt: header.recover_mth_amt != null ? Number(header.recover_mth_amt) : 0,
    recover_from_dt: header.recover_from_dt || null,
    allocated_amt: header.allocated_amt != null ? Number(header.allocated_amt) : 0,
    balance_amt: header.balance_amt != null ? Number(header.balance_amt) : 0,
    deduct_from_leave: header.deduct_from_leave || "N",
    deduct_noof_leavedays:
      header.deduct_noof_leavedays != null ? Number(header.deduct_noof_leavedays) : 0,
    ref_hdr_lve_slno:
      header.ref_hdr_lve_slno != null && header.ref_hdr_lve_slno !== ""
        ? Number(header.ref_hdr_lve_slno)
        : null,
    ref_leave_doc_no: header.ref_leave_doc_no || null,
    cancel_by: header.cancel_by || null,
    cancel_date: header.cancel_date || null,
    doc_status: header.doc_status || "N",
    recovery_period: header.recovery_period != null ? Number(header.recovery_period) : null,
    sys_gen: "N",
    pay_month: null,
    pay_year: null,
  };

  const detailPayload = details.map((d, idx) => ({
    company_code: companyCode,
    doc_type: header.doc_type || "ADV",
    doc_no: isNew ? 0 : Number(header.doc_no),
    serial_no: d.serial_no != null ? Number(d.serial_no) : idx + 1,
    employee_id: d.employee_id || header.employee_id || null,
    emplyee_code: d.emplyee_code || d.employee_code || header.employee_code || null,
    pay_comp_id: d.pay_comp_id || null,
    recover_mth_amt: d.recover_mth_amt != null ? Number(d.recover_mth_amt) : 0,
    recover_from_dt: d.recover_from_dt || null,
    amount: d.amount != null ? Number(d.amount) : Number(d.recover_mth_amt || 0),
    allocated_amt: d.allocated_amt != null ? Number(d.allocated_amt) : 0,
    balance_amt: d.balance_amt != null ? Number(d.balance_amt) : 0,
    deduct_from_leave: d.deduct_from_leave || "N",
    deduct_noof_leavedays: d.deduct_noof_leavedays != null ? Number(d.deduct_noof_leavedays) : 0,
    ref_leave_doc_no: d.ref_leave_doc_no || null,
    ref_hdr_lve_slno:
      d.ref_hdr_lve_slno != null && d.ref_hdr_lve_slno !== "" ? Number(d.ref_hdr_lve_slno) : null,
    last_posted_month: d.last_posted_month != null ? Number(d.last_posted_month) : null,
    post_payroll: d.post_payroll || null,
    post_date: d.post_date || null,
    cancel_by: d.cancel_by || null,
    cancel_date: d.cancel_date || null,
    cancel_status: d.cancel_status || "N",
    leave_days_paid: d.leave_days_paid != null ? Number(d.leave_days_paid) : null,
    sal_type_flag: d.sal_type_flag || "N",
    sr_no: null,
    payroll_closed: d.payroll_closed || "N",
    remarks: d.remarks || d.description || null,
    pay_month: d.pay_month != null ? Number(d.pay_month) : null,
    pay_year: d.pay_year != null ? Number(d.pay_year) : null,
    last_updated_by: d.last_updated_by || userId || null,
    sys_gen: d.sys_gen || "N",
  }));

  return { header: headerPayload, details: detailPayload };
}

// ---------- UI building blocks ----------

const CTL = "h-7 text-xs";
const TEXTAREA =
  "h-[68px] w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

function HeaderBlock({
  label,
  icon,
  children,
  actions,
  gridCols = "grid-cols-2",
  bodyClass,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  gridCols?: string;
  bodyClass?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-md border border-[#cbd5e1] bg-card ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] bg-slate-50 px-2.5 py-1">
        <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">{icon}</span>
        <span className="text-xs font-bold text-[#00378C]">{label}</span>
        {actions && <span className="ml-auto">{actions}</span>}
      </div>
      <div
        className={
          bodyClass ?? `grid gap-x-2 gap-y-1.5 px-2.5 py-2 ${gridCols} max-md:grid-cols-1`
        }
      >
        {children}
      </div>
    </div>
  );
}

function CField({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 truncate">
      <span className="font-semibold text-[#00378C]">{label}:</span>
      <span className="truncate font-medium">{value}</span>
    </span>
  );
}

// ---------- Main Component ----------
export default function SalaryAdvanceRecoveryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyCode = user?.company_code ?? "";
  const userId =
    (user as { login_id?: string; user_id?: string } | null)?.login_id ??
    (user as { login_id?: string; user_id?: string } | null)?.user_id ??
    null;

  const [mode, setMode] = useState<FormMode>("list");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mainData, setMainData] = useState<MainRow[]>([]);
  const [search, setSearch] = useState("");

  const [header, setHeader] = useState<Partial<MainRow>>(emptyHeader());
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showHeader, setShowHeader] = useState(true);

  const patchHeader = (patch: Partial<MainRow>) => setHeader((prev) => ({ ...prev, ...patch }));

  const fetchMain = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const rows = await getDynamicLookup({
        parameter: "MST_HR_SALARY_ADVANCED_RECOVERY_MAIN_PAGE_DATA",
        code1: companyCode,
      });
      setMainData((rows as MainRow[]) || []);
    } catch (err) {
      console.error(err);
      setMainData([]);
      toast.error(err instanceof Error ? err.message : "Unable to load records");
    } finally {
      setLoading(false);
    }
  }, [companyCode, toast]);

  useEffect(() => {
    void fetchMain();
  }, [fetchMain]);

  const fetchDetail = useCallback(
    async (docNo: string | number) => {
      if (!companyCode || !docNo) return;
      setDetailLoading(true);
      try {
        const rows = await getDynamicLookup({
          parameter: "MST_HR_SALARY_ADVANCED_RECOVERY_DETAIL_DATA",
          code1: companyCode,
          code2: String(docNo),
        });
        setDetails(
          ((rows as DetailRow[]) || []).map((r) => ({
            ...r,
            description: r.description ?? r.remarks ?? "",
            recover_from_dt: toInputDate(r.recover_from_dt) || null,
          })),
        );
      } catch (err) {
        console.error(err);
        setDetails([]);
        toast.error(err instanceof Error ? err.message : "Unable to load detail lines");
      } finally {
        setDetailLoading(false);
      }
    },
    [companyCode, toast],
  );

  const openAdd = () => {
    setHeader({
      ...emptyHeader(),
      company_code: companyCode,
      user_id: userId,
    });
    setDetails([]);
    setShowHeader(true);
    setMode("add");
  };

  const openEdit = (row: MainRow) => {
    const dt = normalizeDocType(row.doc_type);
    setHeader({
      ...row,
      doc_type: dt,
      pay_comp_id: row.pay_comp_id ?? DOC_TYPE_PAY_COMP_MAP[dt] ?? "",
      doc_date: toInputDate(row.doc_date),
      recover_from_dt: toInputDate(row.recover_from_dt),
      // fall back to defaults when stored values are blank
      name_from: row.name_from?.trim() || DEFAULT_NAME_FROM,
      addr_from: row.addr_from?.trim() || DEFAULT_ADDR_FROM,
      signatory_name: row.signatory_name?.trim() || DEFAULT_SIGNATORY_NAME,
      signatory_position: row.signatory_position?.trim() || DEFAULT_SIGNATORY_POSITION,
    });
    setShowHeader(true);
    setMode("edit");
    void fetchDetail(row.doc_no);
  };

  const closeForm = () => {
    if (saving) return;
    setMode("list");
    setHeader(emptyHeader());
    setDetails([]);
  };

  const handleSave = async () => {
    if (!companyCode) {
      toast.warning("Company code is missing. Please re-login.");
      return;
    }

    if (!header.doc_date) {
      toast.warning("Document Date is required.");
      return;
    }

    const validationError = validateForm(header, details);
    if (validationError) {
      toast.warning(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = buildSavePayload(header, details, companyCode, userId);
      await insUpdHrSalaryAdvDed(payload);
      toast.success(
        mode === "edit"
          ? "Salary advance recovery updated successfully"
          : "Salary advance recovery saved successfully",
      );
      setMode("list");
      setHeader(emptyHeader());
      setDetails([]);
      await fetchMain();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const loadEmployeeOptions = useCallback(async (): Promise<LookupRow[]> => {
    if (!companyCode) return [];
    const rows = await getDynamicLookup({
      parameter: "HR_ADDITION_DEDUCTION_EMPLOYEE_DROP_DOWN",
      code1: companyCode,
    });
    return (rows as LookupRow[]) || [];
  }, [companyCode]);

  const loadPayComponentOptions = useCallback(async (): Promise<LookupRow[]> => {
    const defaults = getDocTypeDefaults(header.doc_type);
    const defaultOption = {
      value_code: defaults.pay_comp_id,
      value_desc: defaults.description,
    } as LookupRow;

    if (!companyCode || !header.employee_id) {
      return [defaultOption];
    }

    const rows = await getDynamicLookup({
      parameter: "PAY_COMPONENT_DependentPayCompId",
      code1: companyCode,
      code2: header.employee_id,
    });
    const list = (rows as LookupRow[]) || [];

    if (!list.some((r) => (r as { value_code?: string }).value_code === defaults.pay_comp_id)) {
      return [defaultOption, ...list];
    }
    return list;
  }, [companyCode, header.employee_id, header.doc_type]);

  const addDetailRow = () => {
    setDetails((prev) => [
      ...prev,
      emptyDetailRow(
        companyCode,
        header.doc_type || "ADV",
        header.doc_no || "",
        prev.length + 1,
      ),
    ]);
  };

  const removeDetailRow = useCallback((index: number) => {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateDetail = useCallback((index: number, field: keyof DetailRow, value: unknown) => {
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleAllocate = useCallback(() => {
    const amount = Number(header.amount || 0);
    const period = Number(header.recovery_period || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning("Enter a valid Amount (greater than 0) before allocating.");
      return;
    }
    if (!Number.isFinite(period) || period <= 0 || !Number.isInteger(period)) {
      toast.warning("Enter a valid Period (positive whole months) before allocating.");
      return;
    }

    const perRow = Number((amount / period).toFixed(3));
    const startDate = header.recover_from_dt || new Date().toISOString().slice(0, 10);
    const dt = header.doc_type || "ADV";

    let running = 0;
    const newDetails: DetailRow[] = Array.from({ length: period }, (_, i) => {
      const isLast = i === period - 1;
      const rowAmount = isLast ? Number((amount - running).toFixed(3)) : perRow;
      running += rowAmount;

      const rowDate = new Date(startDate);
      rowDate.setMonth(rowDate.getMonth() + i);

      const base = emptyDetailRow(companyCode, dt, header.doc_no || "", i + 1);
      return {
        ...base,
        employee_id: header.employee_id || null,
        emplyee_code: header.employee_code || null,
        recover_mth_amt: rowAmount,
        amount: rowAmount,
        recover_from_dt: rowDate.toISOString().slice(0, 10),
        allocated_amt: 0,
        balance_amt: rowAmount,
      };
    });

    setDetails(newDetails);
    toast.success(
      `Allocated ${period} row${period === 1 ? "" : "s"} of ${perRow.toFixed(3)} each.`,
    );
  }, [header, companyCode, toast]);

  const mainColumns = useMemo<ColumnDef<MainRow>[]>(
    () => [
      { accessorKey: "doc_no", header: "Doc No", size: 90, enableSorting: false },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => formatDisplayDate(getValue() as string),
      },
      {
        accessorKey: "doc_type",
        header: "Doc Type",
        size: 120,
        enableSorting: false,
        cell: ({ getValue }) => DOC_TYPE_LABELS[String(getValue() ?? "")] || String(getValue() ?? ""),
      },
      { accessorKey: "employee_code", header: "Emp Code", size: 100, enableSorting: false },
      { accessorKey: "employee_name", header: "Employee Name", size: 170, enableSorting: false },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => Number(getValue() || 0).toFixed(3),
      },
      {
        accessorKey: "recover_mth_amt",
        header: "Mth Amt",
        size: 100,
        enableSorting: false,
        cell: ({ getValue }) => Number(getValue() || 0).toFixed(3),
      },
      {
        accessorKey: "recover_from_dt",
        header: "Effective From",
        size: 120,
        enableSorting: false,
        cell: ({ getValue }) => formatDisplayDate(getValue() as string),
      },
      { accessorKey: "recovery_period", header: "Period", size: 80, enableSorting: false },
      { accessorKey: "name_from", header: "Name From", size: 140, enableSorting: false },
      { accessorKey: "signatory_name", header: "Signatory", size: 140, enableSorting: false },
      { accessorKey: "doc_status", header: "Status", size: 80, enableSorting: false },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row.original);
              }}
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const detailColumns = useMemo<ColumnDef<DetailRow>[]>(
    () => [
      {
        id: "sno",
        header: "SNo",
        size: 55,
        enableSorting: false,
        cell: ({ row }) => <span className="text-xs font-medium text-muted-foreground">{row.index + 1}</span>,
      },
      {
        accessorKey: "pay_comp_id",
        header: "Pay Unit",
        size: 170,
        enableSorting: false,
        cell: ({ row }) => (
          <LookupField
            value={row.original.pay_comp_id ?? ""}
            displayValue={row.original.pay_comp_id ?? ""}
            columns={[
              { field: "value_code", header: "Code" },
              { field: "value_desc", header: "Description" },
            ]}
            valueField="value_code"
            displayFields={["value_code"]}
            loadOptions={loadPayComponentOptions}
            onChange={(val, selected) => {
              updateDetail(row.index, "pay_comp_id", selected?.value_code || val || "");
              updateDetail(row.index, "description", selected?.value_desc || "");
            }}
            disabled={!header.employee_id}
            compact
            dense
            placeholder="Select pay unit"
          />
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 220,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            className="h-7 px-2 text-sm"
            value={row.original.description ?? ""}
            onChange={(e) => updateDetail(row.index, "description", e.target.value)}
            placeholder="Enter description"
            maxLength={FIELD_LIMITS.description}
          />
        ),
      },
      {
        accessorKey: "recover_mth_amt",
        header: "Month Amount",
        size: 130,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            type="number"
            step="0.000001"
            className="h-7 px-2 text-right font-mono text-sm"
            value={row.original.recover_mth_amt ?? 0}
            onChange={(e) => updateDetail(row.index, "recover_mth_amt", Number(e.target.value) || 0)}
          />
        ),
      },
      {
        accessorKey: "recover_from_dt",
        header: "Effective From",
        size: 150,
        enableSorting: false,
        cell: ({ row }) => (
          <Input
            type="date"
            className="h-7 px-2 text-sm"
            value={row.original.recover_from_dt ?? ""}
            onChange={(e) => updateDetail(row.index, "recover_from_dt", e.target.value)}
          />
        ),
      },
      {
        accessorKey: "cancel_status",
        header: "Cancel",
        size: 100,
        enableSorting: false,
        cell: ({ row }) => (
          <Select
            className="h-7 px-2 text-sm"
            value={row.original.cancel_status ?? "N"}
            onChange={(e) => updateDetail(row.index, "cancel_status", e.target.value)}
          >
            <option value="N">No</option>
            <option value="Y">Yes</option>
          </Select>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => removeDetailRow(row.index)}
              title="Remove row"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [loadPayComponentOptions, header.employee_id, updateDetail, removeDetailRow],
  );

  const gridDetailColumns = useMemo(
    () => detailColumns.map((c) => ({ ...c, enableColumnFilter: false })),
    [detailColumns],
  );

  if (mode === "list") {
    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Banknote size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                  HR Salary Advance Recovery
                </h1>
                <span className="text-xs text-muted-foreground">
                  {mainData.length.toLocaleString()} Row{mainData.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => void fetchMain()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </Button>
            <Button type="button" size="sm" onClick={openAdd}>
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>

        <DataTable
          columns={mainColumns}
          data={mainData}
          title={loading ? "Loading" : `${mainData.length.toLocaleString()} Documents`}
          subtitle="Manage salary advance recovery documents"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by Doc No, Employee, Signatory..."
          loading={loading}
          emptyText="No salary advance recovery records found"
          height={560}
          minWidth={1300}
          density="grid"
          enablePagination
          pageSize={25}
          getRowId={(row) => String(row.doc_no)}
          onRowClick={openEdit}
        />
      </section>
    );
  }

  const isEdit = mode === "edit";
  const totalAmount = details.reduce((sum, r) => sum + Number(r.recover_mth_amt || 0), 0);
  const lineCount = details.length;

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
                {isEdit ? "Edit Salary Advance Recovery" : "New Salary Advance Recovery"}
              </h1>
              <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                {isEdit ? "Editing" : "Draft"}
              </span>
              <span className="text-xs text-muted-foreground">
                Doc {header.doc_no ? String(header.doc_no) : "New"} · Amount{" "}
                {Number(header.amount || 0).toFixed(3)}
                {header.doc_status ? ` · Status ${header.doc_status}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
            <ArrowLeft size={14} /> List
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={saving}>
            <X size={14} /> Close
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
            {saving ? "Saving" : isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </div>

      {!showHeader ? (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-1.5 text-xs shadow-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-4 text-slate-700">
            <SummaryItem label="Doc No" value={header.doc_no ? String(header.doc_no) : "Auto"} />
            <SummaryItem label="Doc Date" value={formatDisplayDate(header.doc_date) || "-"} />
            <SummaryItem
              label="Employee"
              value={header.employee_name || header.employee_code || "Not selected"}
            />
            <SummaryItem label="Amount" value={Number(header.amount || 0).toFixed(3)} />
            <SummaryItem label="Period" value={`${Number(header.recovery_period || 0)} mo`} />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-2 h-6 shrink-0 cursor-pointer border-[#00378C] text-xs font-semibold text-[#00378C] hover:bg-blue-100/60"
            onClick={() => setShowHeader(true)}
          >
            Show Header Fields <ChevronDown size={13} className="ml-1" />
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border-2 border-gray-100 bg-card">
          <div className="grid items-stretch gap-1.5 p-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)]">
            {/* ══ Block 1: Document Details ══ */}
            <HeaderBlock
              label="Document Details"
              icon={<FileText size={11} />}
              actions={
                <button
                  type="button"
                  onClick={() => setShowHeader(false)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#00378C] hover:underline"
                >
                  Hide <ChevronUp size={12} />
                </button>
              }
            >
              <CField label="Doc No">
                <Input
                  className={CTL}
                  value={header.doc_no ?? ""}
                  onChange={(e) => patchHeader({ doc_no: e.target.value })}
                  disabled={isEdit}
                  placeholder="Auto"
                />
              </CField>

              <CField label="Doc Date" required className="max-w-[150px]">
                <Input
                  className={CTL}
                  type="date"
                  value={header.doc_date ?? ""}
                  onChange={(e) => patchHeader({ doc_date: e.target.value })}
                />
              </CField>

              <CField label="Doc Type">
                <Select
                  className={CTL}
                  value={header.doc_type ?? "ADV"}
                  onChange={(e) => {
                    const newDocType = e.target.value;
                    const newDefaults = getDocTypeDefaults(newDocType);

                    patchHeader({
                      doc_type: newDocType,
                      pay_comp_id: newDefaults.pay_comp_id,
                    });

                    setDetails((prev) =>
                      prev.map((d) => ({
                        ...d,
                        doc_type: newDocType,
                        pay_comp_id: newDefaults.pay_comp_id,
                        description: newDefaults.description,
                      })),
                    );
                  }}
                >
                  {DOC_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </CField>

              <CField label="Ref No">
                <Input
                  className={CTL}
                  value={header.ref_no ?? ""}
                  onChange={(e) => patchHeader({ ref_no: e.target.value })}
                  maxLength={FIELD_LIMITS.ref_no}
                />
              </CField>

              <CField label="Employee" required className="col-span-2 max-w-[340px]">
                <LookupField
                  value={header.employee_id ?? ""}
                  displayValue={header.employee_name ?? header.employee_code ?? ""}
                  columns={[
                    { field: "employee_code", header: "Code" },
                    { field: "rpt_name", header: "Name" },
                  ]}
                  valueField="employee_id"
                  displayFields={["employee_code", "rpt_name"]}
                  loadOptions={loadEmployeeOptions}
                  onChange={(_val, row) => {
                    patchHeader({
                      employee_id: (row?.employee_id as string | undefined) ?? "",
                      employee_code: (row?.employee_code as string | undefined) ?? "",
                      employee_name: (row?.rpt_name as string | undefined) ?? "",
                    });
                  }}
                  compact
                  dense
                  placeholder="Select employee"
                />
              </CField>
            </HeaderBlock>

            {/* ══ Block 2: From, To & Signatory ══ */}
            <HeaderBlock label="From, To & Signatory" icon={<UserCheck size={11} />}>
              <CField label="Name From">
                <Input
                  className={CTL}
                  value={header.name_from ?? ""}
                  onChange={(e) => patchHeader({ name_from: e.target.value })}
                  maxLength={FIELD_LIMITS.name_from}
                />
              </CField>

              <CField label="Name To">
                <Input
                  className={CTL}
                  value={header.name_to ?? ""}
                  onChange={(e) => patchHeader({ name_to: e.target.value })}
                  maxLength={FIELD_LIMITS.name_to}
                />
              </CField>

              <CField label="Addr From">
                <Input
                  className={CTL}
                  value={header.addr_from ?? ""}
                  onChange={(e) => patchHeader({ addr_from: e.target.value })}
                  maxLength={FIELD_LIMITS.addr_from}
                />
              </CField>

              <CField label="Addr To">
                <Input
                  className={CTL}
                  value={header.addr_to ?? ""}
                  onChange={(e) => patchHeader({ addr_to: e.target.value })}
                  maxLength={FIELD_LIMITS.addr_to}
                />
              </CField>

              <CField label="Signatory Name">
                <Input
                  className={CTL}
                  value={header.signatory_name ?? ""}
                  onChange={(e) => patchHeader({ signatory_name: e.target.value })}
                  maxLength={FIELD_LIMITS.signatory_name}
                />
              </CField>

              <CField label="Signatory Position">
                <Input
                  className={CTL}
                  value={header.signatory_position ?? ""}
                  onChange={(e) => patchHeader({ signatory_position: e.target.value })}
                  maxLength={FIELD_LIMITS.signatory_position}
                />
              </CField>
            </HeaderBlock>

            {/* ══ Block 3: Letter Details ══ */}
            <HeaderBlock label="Letter Details" icon={<StickyNote size={11} />}>
              <CField label="Letter Subject" className="col-span-2">
                <Input
                  className={CTL}
                  value={header.lettr_subject ?? ""}
                  onChange={(e) => patchHeader({ lettr_subject: e.target.value })}
                  maxLength={FIELD_LIMITS.lettr_subject}
                />
              </CField>

              <CField label="Remarks 1">
                <textarea
                  className={TEXTAREA}
                  value={header.remarks_1 ?? ""}
                  onChange={(e) => patchHeader({ remarks_1: e.target.value })}
                  maxLength={FIELD_LIMITS.remarks_1}
                />
              </CField>

              <CField label="Remarks 2">
                <textarea
                  className={TEXTAREA}
                  value={header.remarks_2 ?? ""}
                  onChange={(e) => patchHeader({ remarks_2: e.target.value })}
                  maxLength={FIELD_LIMITS.remarks_2}
                />
              </CField>
            </HeaderBlock>

            {/* ══ Block 4: Recovery Details ══ */}
            <HeaderBlock
              label="Recovery Details"
              icon={<Banknote size={11} />}
              className="xl:col-span-3"
              bodyClass="flex flex-wrap items-end gap-x-3 gap-y-1.5 px-2.5 py-2"
            >
              <CField label="Effective From" className="w-[150px]">
                <Input
                  className={CTL}
                  type="date"
                  value={header.recover_from_dt ?? ""}
                  onChange={(e) => patchHeader({ recover_from_dt: e.target.value })}
                />
              </CField>

              <CField label="Amount (Base Currency)" className="w-[170px]">
                <Input
                  className={`${CTL} text-right font-mono`}
                  type="number"
                  step="0.0001"
                  value={header.amount ?? 0}
                  onChange={(e) => patchHeader({ amount: Number(e.target.value) })}
                />
              </CField>

              <CField label="Period (Months)" className="w-[110px]">
                <Input
                  className={`${CTL} text-right`}
                  type="number"
                  step="1"
                  min={0}
                  max={99999}
                  value={header.recovery_period ?? 0}
                  onChange={(e) => patchHeader({ recovery_period: Number(e.target.value) })}
                />
              </CField>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-[#00378C] px-2.5 text-xs font-semibold text-[#00378C] hover:bg-blue-50"
                onClick={handleAllocate}
                title="Split Amount ÷ Period into detail rows"
              >
                <Calculator size={13} /> Allocate
              </Button>
            </HeaderBlock>
          </div>
        </div>
      )}

      {/* ══ Lines card ══ */}
      <div className="min-w-0 overflow-hidden rounded-md border border-[#cbd5e1] bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-[#cbd5e1] bg-slate-50 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded bg-[#00378C] text-white">
              <List size={11} />
            </span>
            <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-[#00378C]">Detail Lines</h3>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#00378C]">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            title="Add row"
            onClick={addDetailRow}
          >
            <Plus size={13} /> Add Row
          </Button>
        </div>

        <div className="p-2">
          <DataTable
            columns={gridDetailColumns}
            data={details}
            loading={detailLoading}
            emptyText="No recovery lines. Click Add Row to start."
            height={240}
            minWidth={950}
            density="grid"
            getRowId={(row) => String(row.serial_no)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#cbd5e1] bg-slate-50/95 px-4 py-2">
          <div className="flex min-h-9 items-center gap-3 rounded-md border-2 border-[#00378c]/50 bg-blue-50 px-4 py-1.5 shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider text-[#00378c]">
              Total Month Amount
            </span>
            <strong className="font-mono text-base font-black tabular-nums text-[#00378c]">
              {totalAmount.toFixed(3)}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}