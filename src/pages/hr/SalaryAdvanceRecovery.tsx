// pages/hr/SalaryAdvanceRecovery.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Edit2, Plus, Trash2, X, Save, Loader2 } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup, LookupRow } from "../../api/lookups";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { DynamicDropDown } from "./api/DynamicDropDown";
import { BiscDatePicker } from "../../components/ui/BiscDatePicker";
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
    const response = await api.post<ApiResponse>(
      "/api/hr/advancesalaryrecovery/insUpd",
      payload
    );
    if (!response.data.success) {
      throw new Error(
        response.data.details ||
          response.data.message ||
          "Unable to save salary advance recovery"
      );
    }
    return response.data;
  } catch (error) {
    throw new Error(
      extractApiErrorMessage(error, "Unable to save salary advance recovery")
    );
  }
}

// ---------- Helpers ----------
const emptyHeader = (): Partial<MainRow> => ({
  doc_type: "SA",
  doc_date: new Date().toISOString().slice(0, 10),
  ref_no: "",
  name_from: "",
  addr_from: "",
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
  signatory_name: "",
  signatory_position: "",
  employee_code: "",
  employee_id: "",
  employee_name: "",
  pay_comp_id: "",
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
});

const emptyDetailRow = (
  companyCode: string,
  docType: string,
  docNo: string | number,
  serial: number
): DetailRow => ({
  company_code: companyCode,
  doc_type: docType || "SA",
  doc_no: docNo || "",
  serial_no: serial,
  employee_id: null,
  emplyee_code: null,
  pay_comp_id: "",
  description: "",
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
});

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
  userId: string | null | undefined
) {
  const isNew =
    !header.doc_no || header.doc_no === "" || Number(header.doc_no) === 0;

  const headerPayload: Record<string, unknown> = {
    company_code: companyCode,
    doc_type: "SA",
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
    ex_rate:
      header.ex_rate != null && String(header.ex_rate) !== ""
        ? Number(header.ex_rate)
        : 1,
    amount: header.amount != null ? Number(header.amount) : 0,
    signatory_name: header.signatory_name || null,
    signatory_position: header.signatory_position || null,
    user_id: header.user_id || userId || null,
    user_dt: header.user_dt || new Date().toISOString(),
    employee_id: header.employee_id || null,
    employee_code: header.employee_code || null,
    pay_comp_id: header.pay_comp_id || null,
    recover_mth_amt:
      header.recover_mth_amt != null ? Number(header.recover_mth_amt) : 0,
    recover_from_dt: header.recover_from_dt || null,
    allocated_amt:
      header.allocated_amt != null ? Number(header.allocated_amt) : 0,
    balance_amt: header.balance_amt != null ? Number(header.balance_amt) : 0,
    deduct_from_leave: header.deduct_from_leave || "N",
    deduct_noof_leavedays:
      header.deduct_noof_leavedays != null
        ? Number(header.deduct_noof_leavedays)
        : 0,
    ref_hdr_lve_slno:
      header.ref_hdr_lve_slno != null && header.ref_hdr_lve_slno !== ""
        ? Number(header.ref_hdr_lve_slno)
        : null,
    ref_leave_doc_no: header.ref_leave_doc_no || null,
    cancel_by: header.cancel_by || null,
    cancel_date: header.cancel_date || null,
    doc_status: header.doc_status || "N",
    recovery_period:
      header.recovery_period != null ? Number(header.recovery_period) : null,
    sys_gen: "N",
    pay_month: null,
    pay_year: null,
  };

  const detailPayload = details.map((d, idx) => ({
    company_code: companyCode,
    doc_type: "SA",
    doc_no: isNew ? 0 : Number(header.doc_no),
    serial_no: d.serial_no != null ? Number(d.serial_no) : idx + 1,
    employee_id: d.employee_id || header.employee_id || null,
    emplyee_code:
      d.emplyee_code || d.employee_code || header.employee_code || null,
    pay_comp_id: d.pay_comp_id || null,
    recover_mth_amt:
      d.recover_mth_amt != null ? Number(d.recover_mth_amt) : 0,
    recover_from_dt: d.recover_from_dt || null,
    amount:
      d.amount != null
        ? Number(d.amount)
        : Number(d.recover_mth_amt || 0),
    allocated_amt: d.allocated_amt != null ? Number(d.allocated_amt) : 0,
    balance_amt: d.balance_amt != null ? Number(d.balance_amt) : 0,
    deduct_from_leave: d.deduct_from_leave || "N",
    deduct_noof_leavedays:
      d.deduct_noof_leavedays != null
        ? Number(d.deduct_noof_leavedays)
        : 0,
    ref_leave_doc_no: d.ref_leave_doc_no || null,
    ref_hdr_lve_slno:
      d.ref_hdr_lve_slno != null && d.ref_hdr_lve_slno !== ""
        ? Number(d.ref_hdr_lve_slno)
        : null,
    last_posted_month:
      d.last_posted_month != null ? Number(d.last_posted_month) : null,
    post_payroll: d.post_payroll || null,
    post_date: d.post_date || null,
    cancel_by: d.cancel_by || null,
    cancel_date: d.cancel_date || null,
    cancel_status: d.cancel_status || "N",
    leave_days_paid:
      d.leave_days_paid != null ? Number(d.leave_days_paid) : null,
    sal_type_flag: d.sal_type_flag || "N",
    sr_no: null, // generated by procedure
    payroll_closed: d.payroll_closed || "N",
    remarks: d.remarks || d.description || null,
    pay_month: d.pay_month != null ? Number(d.pay_month) : null,
    pay_year: d.pay_year != null ? Number(d.pay_year) : null,
    last_updated_by: d.last_updated_by || userId || null,
    sys_gen: d.sys_gen || "N",
  }));

  return { header: headerPayload, details: detailPayload };
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
      toast.error(
        err instanceof Error ? err.message : "Unable to load records"
      );
    } finally {
      setLoading(false);
    }
  }, [companyCode, toast]);

  useEffect(() => {
    fetchMain();
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
        setDetails((rows as DetailRow[]) || []);
      } catch (err) {
        console.error(err);
        setDetails([]);
        toast.error(
          err instanceof Error ? err.message : "Unable to load detail lines"
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [companyCode, toast]
  );

  const openAdd = () => {
    setHeader({
      ...emptyHeader(),
      company_code: companyCode,
      user_id: userId,
    });
    setDetails([]);
    setMode("add");
  };

  const openEdit = (row: MainRow) => {
    setHeader({
      ...row,
      doc_type: "SA",
      doc_date: row.doc_date ? String(row.doc_date).slice(0, 10) : "",
      recover_from_dt: row.recover_from_dt
        ? String(row.recover_from_dt).slice(0, 10)
        : "",
    });
    setMode("edit");
    fetchDetail(row.doc_no);
  };

  const closeForm = () => {
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

    setSaving(true);
    try {
      const payload = buildSavePayload(header, details, companyCode, userId);
      await insUpdHrSalaryAdvDed(payload);
      toast.success(
        mode === "edit"
          ? "Salary advance recovery updated successfully"
          : "Salary advance recovery saved successfully"
      );
      await fetchMain();
      closeForm();
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Save failed"
      );
    } finally {
      setSaving(false);
    }
  };

    const loadEmployeeOptions = useCallback(
    async (): Promise<LookupRow[]> => {
        if (!companyCode) return [];
        const rows = await getDynamicLookup({
        parameter: "HR_ADDITION_DEDUCTION_EMPLOYEE_DROP_DOWN",
        code1: companyCode,
        });
        return (rows as LookupRow[]) || [];
    },
    [companyCode]
    );

    const loadPayComponentOptions = useCallback(
    async (): Promise<LookupRow[]> => {
        if (!companyCode || !header.employee_id) return [];
        const rows = await getDynamicLookup({
        parameter: "PAY_COMPONENT_DependentPayCompId",
        code1: companyCode,
        code2: header.employee_id,
        });
        return (rows as LookupRow[]) || [];
    },
    [companyCode, header.employee_id]
    );

  const addDetailRow = () => {
    setDetails((prev) => [
      ...prev,
      emptyDetailRow(
        companyCode,
        header.doc_type || "SA",
        header.doc_no || "",
        prev.length + 1
      ),
    ]);
  };

  const removeDetailRow = (index: number) => {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDetail = (
    index: number,
    field: keyof DetailRow,
    value: unknown
  ) => {
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const mainColumns = useMemo<ColumnDef<MainRow>[]>(
    () => [
      { accessorKey: "doc_no", header: "Doc No", size: 90 },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        size: 110,
        cell: ({ getValue }) => formatDisplayDate(getValue() as string),
      },
      {
        accessorKey: "doc_type",
        header: "Doc Type",
        size: 110,
        cell: () => "Salary Advance",
      },
      { accessorKey: "employee_code", header: "Emp Code", size: 100 },
      { accessorKey: "employee_name", header: "Employee Name", size: 160 },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 110,
        cell: ({ getValue }) => Number(getValue() || 0).toFixed(3),
      },
      {
        accessorKey: "recover_mth_amt",
        header: "Mth Amt",
        size: 90,
        cell: ({ getValue }) => Number(getValue() || 0).toFixed(3),
      },
      {
        accessorKey: "recover_from_dt",
        header: "Effective From",
        size: 120,
        cell: ({ getValue }) => formatDisplayDate(getValue() as string),
      },
      { accessorKey: "recovery_period", header: "Period", size: 80 },
      { accessorKey: "name_from", header: "Name From", size: 140 },
      { accessorKey: "signatory_name", header: "Signatory", size: 130 },
      { accessorKey: "doc_status", header: "Status", size: 80 },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[#00378C] hover:bg-[#00378C]/10"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row.original);
              }}
              title="Edit"
            >
              <Edit2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                console.log("Delete", row.original.doc_no);
              }}
              title="Delete"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );


const detailColumns = useMemo<ColumnDef<DetailRow>[]>(
  () => [
      {
        id: "actions",
        header: "",
        size: 40,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:bg-destructive/10"
            onClick={() => removeDetailRow(row.index)}
            title="Remove row"
          >
            <Trash2 size={13} />
          </Button>
        ),
      },
      {
        id: "sno",
        header: "SNo",
        size: 48,
        cell: ({ row }) => (
          <span className="text-[11px] font-medium text-slate-600">
            {row.index + 1}
          </span>
        ),
      },
    {
      accessorKey: "pay_comp_id",
      header: "Pay Unit",
      size: 140,
      cell: ({ row }) => (
        <LookupField
          value={row.original.pay_comp_id ?? ""}
          displayValue={row.original.pay_comp_id ?? ""}
          columns={[
            { field: "value_code", header: "Code" },
            { field: "value_desc", header: "Description" },
          ]}
          valueField="value_code"          // ← fixed: matches actual row field
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
        size: 200,
        cell: ({ row }) => (
          <Input
            value={row.original.description ?? ""}
            onChange={(e) =>
              updateDetail(row.index, "description", e.target.value)
            }
            className="h-6 border-slate-300 text-[11px] px-1.5"
            placeholder="Enter description"
          />
        ),
      },
      {
        accessorKey: "recover_mth_amt",
        header: "Month Amount",
        size: 115,
        cell: ({ row }) => (
          <Input
            type="number"
            step="0.001"
            value={row.original.recover_mth_amt ?? 0}
            onChange={(e) =>
              updateDetail(
                row.index,
                "recover_mth_amt",
                Number(e.target.value) || 0
              )
            }
            className="h-6 border-slate-300 text-right text-[11px] px-1.5"
          />
        ),
      },
      {
        accessorKey: "recover_from_dt",
        header: "Effective From",
        size: 135,
        cell: ({ row }) => (
          <BiscDatePicker
            value={row.original.recover_from_dt ?? ""}
            onChange={(val) =>
              updateDetail(row.index, "recover_from_dt", val)
            }
            className="!h-6"
          />
        ),
      },
      {
        accessorKey: "cancel_status",
        header: "Cancel",
        size: 85,
        cell: ({ row }) => (
          <select
            value={row.original.cancel_status ?? "N"}
            onChange={(e) =>
              updateDetail(row.index, "cancel_status", e.target.value)
            }
            className="h-6 w-full rounded border border-slate-300 bg-white px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#00378C]"
          >
            <option value="N">NO</option>
            <option value="Y">YES</option>
          </select>
        ),
      },
  ],
  [loadPayComponentOptions, header.employee_id] // ← was [], now correctly reactive
);

  if (mode === "list") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 bg-slate-50 p-4 font-sans">
        <div className="flex shrink-0 items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              HR Salary Advance Recovery
            </h1>
            <p className="text-xs text-slate-500">
              Manage salary advance recovery documents
            </p>
          </div>
          <Button
            className="bg-[#00378C] hover:bg-[#002d73] text-white shadow-sm"
            onClick={openAdd}
          >
            <Plus size={16} />
            Add New
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <DataTable
            columns={mainColumns}
            data={mainData}
            loading={loading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by Doc No, Employee, Signatory..."
            enablePagination
            pageSize={25}
            height="100%"
            stickyFirstColumn
            stickyLastColumn
            density="comfortable"
            emptyText="No salary advance recovery records found"
            onRowClick={openEdit}
          />
        </div>
      </div>
    );
  }

  const isEdit = mode === "edit";
  const totalAmount = details.reduce(
    (sum, r) => sum + Number(r.recover_mth_amt || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-100 font-sans">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 bg-[#00378C] px-4 py-2 text-white shadow">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-semibold tracking-wide">
            {isEdit
              ? "EDIT SALARY ADVANCE RECOVERY"
              : "NEW SALARY ADVANCE RECOVERY"}
          </span>
          <div className="flex items-center gap-1.5 rounded border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs">
            <span className="opacity-80">DOC</span>
            <span className="font-semibold">{header.doc_no ?? "New"}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs">
            <span className="opacity-80">AMT</span>
            <span className="font-semibold">
              {Number(header.amount || 0).toFixed(3)}
            </span>
          </div>
          {header.doc_status && (
            <div className="flex items-center gap-1.5 rounded border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs">
              <span className="opacity-80">STS</span>
              <span className="font-semibold">{header.doc_status}</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 border-white/40 bg-white/10 px-2.5 text-white hover:bg-white/20"
          onClick={closeForm}
        >
          <X size={14} />
          Close
        </Button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-2 overflow-hidden p-3">
          {/* HEADER */}
          <section className="shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 py-1">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#00378C]">
                Header Information
              </h2>
            </div>

            <div className="grid grid-cols-12 gap-x-3 gap-y-1.5 p-2.5">
              <div className="col-span-1 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Doc No
                </label>
                <Input
                  value={header.doc_no ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, doc_no: e.target.value }))
                  }
                  disabled={isEdit}
                  placeholder="Auto"
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-1 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Doc Date
                </label>
                <BiscDatePicker
                  value={header.doc_date ?? ""}
                  onChange={(val) =>
                    setHeader((p) => ({ ...p, doc_date: val }))
                  }
                  className="!h-7"
                />
              </div>
              <div className="col-span-1 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Doc Type
                </label>
                <Input
                  value="Salary Advance"
                  disabled
                  className="h-7 border-slate-300 text-[11px] bg-slate-50"
                />
              </div>
              <div className="col-span-1 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Ref No
                </label>
                <Input
                  value={header.ref_no ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, ref_no: e.target.value }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
            <div className="col-span-4 space-y-0">
            <label className="text-[9px] font-medium text-slate-500">
                Employee
            </label>
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
                onChange={(val, row) => {
                const id = (row?.employee_id as string | undefined) ?? "";
                const code = (row?.employee_code as string | undefined) ?? "";
                const name = (row?.rpt_name as string | undefined) ?? "";
                setHeader((p) => ({
                    ...p,
                    employee_id: id,
                    employee_code: code,
                    employee_name: name,
                }));
                }}
                compact
                dense
                placeholder="Select employee"
            />
            </div>
              <div className="col-span-1 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Effective From
                </label>
                <BiscDatePicker
                  value={header.recover_from_dt ?? ""}
                  onChange={(val) =>
                    setHeader((p) => ({ ...p, recover_from_dt: val }))
                  }
                  className="!h-7"
                />
              </div>
              <div className="col-span-1 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Amount
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={header.amount ?? 0}
                  onChange={(e) =>
                    setHeader((p) => ({
                      ...p,
                      amount: Number(e.target.value),
                    }))
                  }
                  className="h-7 border-slate-300 text-right text-[11px]"
                />
              </div>
              <div className="col-span-1 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Period
                </label>
                <Input
                  type="number"
                  value={header.recovery_period ?? 0}
                  onChange={(e) =>
                    setHeader((p) => ({
                      ...p,
                      recovery_period: Number(e.target.value),
                    }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>

              <div className="col-span-2 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Name From
                </label>
                <Input
                  value={header.name_from ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, name_from: e.target.value }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-2 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Name To
                </label>
                <Input
                  value={header.name_to ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, name_to: e.target.value }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-2 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Addr From
                </label>
                <Input
                  value={header.addr_from ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, addr_from: e.target.value }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-2 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Addr To
                </label>
                <Input
                  value={header.addr_to ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, addr_to: e.target.value }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-2 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Signatory Name
                </label>
                <Input
                  value={header.signatory_name ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({
                      ...p,
                      signatory_name: e.target.value,
                    }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-2 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Signatory Position
                </label>
                <Input
                  value={header.signatory_position ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({
                      ...p,
                      signatory_position: e.target.value,
                    }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>

              <div className="col-span-4 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Letter Subject
                </label>
                <Input
                  value={header.lettr_subject ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({
                      ...p,
                      lettr_subject: e.target.value,
                    }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-4 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Remarks 1
                </label>
                <Input
                  value={header.remarks_1 ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, remarks_1: e.target.value }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
              <div className="col-span-4 space-y-0">
                <label className="text-[9px] font-medium text-slate-500">
                  Remarks 2
                </label>
                <Input
                  value={header.remarks_2 ?? ""}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, remarks_2: e.target.value }))
                  }
                  className="h-7 border-slate-300 text-[11px]"
                />
              </div>
            </div>
          </section>

          {/* DETAIL */}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
              <div className="flex items-center gap-3">
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#00378C]">
                  Detail Lines
                </h2>
                <Button
                  size="sm"
                  className="h-6 gap-1 bg-[#00378C] px-2 text-xs text-white hover:bg-[#002d73]"
                  onClick={addDetailRow}
                >
                  <Plus size={12} />
                  Add Row
                </Button>
              </div>
              <div className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                Total Month Amount:{" "}
                <span className="font-semibold text-[#00378C]">
                  {totalAmount.toFixed(3)}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-2">
              <DataTable
                columns={detailColumns}
                data={details}
                loading={detailLoading}
                enablePagination={false}
                height="100%"
                density="compact"
                stickyFirstColumn={false}
                stickyLastColumn={false}
                emptyText="No recovery lines. Click Add Row to start."
                truncateCellText
              />
            </div>
          </section>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-xs text-slate-500">
          {isEdit
            ? `Editing document ${header.doc_no}`
            : "Creating new document"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={closeForm}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="min-w-[100px] bg-[#00378C] text-white hover:bg-[#002d73]"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                {isEdit ? "Update" : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}