import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import NoticeToast, { ToastNotice } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import {
  executeCommonProcedure,
  getDynamicLookup,
  LookupRow,
} from "../../api/lookups";
import {
  buildLeaveEncashmentPayload,
  DOC_TYPE_LEAVE_ENCASHMENT,
  emptyDetailRow,
  emptyHeader,
  findBalanceForType,
  LeaveBalanceRow,
  LeaveDetailRow,
  LeaveHeader,
  toDateInputValue,
  validateDetailRow,
} from "./leaveEncashmentHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic procedure parameter names.
// PROC_BUILD_DYNAMIC_HR_LEAVE_ENCASHMENT for screen-specific data,
// PROC_BUILD_DYNAMIC_DROP_DOWN for shared org-structure drop-downs.
// ─────────────────────────────────────────────────────────────────────────────
const PARAM = {
  DIVISION: "DROP_DOWN_DIVISION",
  DEPARTMENT: "DROP_DOWN_DEPT_BASED_ON_DIV",
  SECTION: "HR_LEAVE_ENCASHMENT_SECTION_DROP_DOWN",
  EMPLOYEE: "HR_LEAVE_ENCASHMENT_EMPLOYEE_DROP_DOWN",
  DOC_NO: "HR_LEAVE_ENCASHMENT_DOC_NO_DROP_DOWN",
  HEADER: "HR_LEAVE_ENCASHMENT_HEADER",
  DETAIL: "HR_LEAVE_ENCASHMENT_DETAIL",
  LEAVE_BALANCE: "HR_LEAVE_ENCASHMENT_LEAVE_BALANCE",
  LEAVE_HISTORY: "HR_LEAVE_ENCASHMENT_LEAVE_BALANCE_HISTORY",
  // Not provided in the source procedures — wire to your actual save
  // procedure name when available. Kept isolated here so it's a one-line swap.
  SAVE: "HR_LEAVE_ENCASHMENT_SAVE",
} as const;

type FilterState = {
  divCode: string;
  divName: string;
  deptCode: string;
  deptName: string;
  sectionCode: string;
  sectionName: string;
  employeeId: string;
  employeeName: string;
};

const emptyFilters: FilterState = {
  divCode: "",
  divName: "",
  deptCode: "",
  deptName: "",
  sectionCode: "",
  sectionName: "",
  employeeId: "",
  employeeName: "",
};

export function LeaveEncashmentPage() {
  const { user } = useAuth();
  const loginid = user?.loginid || "";
  const companyCode = user?.company_code || "";

  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const [docNoOptions, setDocNoOptions] = useState<LookupRow[]>([]);
  const [selectedDocNo, setSelectedDocNo] = useState<string>("");

  const [header, setHeader] = useState<LeaveHeader>(emptyHeader(companyCode, ""));
  const [details, setDetails] = useState<LeaveDetailRow[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [history, setHistory] = useState<LookupRow[]>([]);

  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<ToastNotice>(null);
  const [lineEditorOpen, setLineEditorOpen] = useState(false);

  const employeeSelected = Boolean(filters.employeeId);

  // ── Lookups for the cascading filters ────────────────────────────────────

  const loadDivisions = async () =>
    (await getDynamicLookup({ parameter: PARAM.DIVISION, loginid, code1: companyCode })) as LookupRow[];

  const loadDepartments = async () =>
    filters.divCode
      ? ((await getDynamicLookup({
          parameter: PARAM.DEPARTMENT,
          loginid,
          code1: companyCode,
          code2: filters.divCode,
        })) as LookupRow[])
      : [];

  const loadSections = async () =>
    filters.divCode
      ? ((await getDynamicLookup({
          parameter: PARAM.SECTION,
          loginid,
          code1: filters.divCode,
          code2: filters.deptCode,
        })) as LookupRow[])
      : [];

  const loadEmployees = async () =>
    (await getDynamicLookup({
      parameter: PARAM.EMPLOYEE,
      loginid,
      // When Division is empty, omit all three codes so the procedure's
      // IF P_CODEx IS NOT NULL guards fall through and return every
      // employee company-wide — lets the user jump straight to Employee.
      // Once Division is picked, narrow by whatever's filled in below it.
      code1: filters.divCode || undefined,
      code2: filters.divCode ? filters.deptCode || undefined : undefined,
      code3: filters.divCode ? filters.sectionCode || undefined : undefined,
    })) as LookupRow[];

  // ── Data load on employee selection ──────────────────────────────────────

  const loadBalance = async (employeeId: string) => {
    setLoadingBalance(true);
    try {
      const data = await getDynamicLookup({
        parameter: PARAM.LEAVE_BALANCE,
        loginid,
        code1: employeeId,
        code2: companyCode,
        code3: "ALL",
      });
      setBalances(data as LeaveBalanceRow[]);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load leave balance" });
    } finally {
      setLoadingBalance(false);
    }
  };

  const loadDocNoOptions = async (employeeId: string) => {
    try {
      const data = await getDynamicLookup({
        parameter: PARAM.DOC_NO,
        loginid,
        code1: companyCode,
      });
      setDocNoOptions(data);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load document list" });
    }
  };

  const loadHistory = async (employeeId: string) => {
    try {
      const data = await getDynamicLookup({
        parameter: PARAM.LEAVE_HISTORY,
        loginid,
        code1: employeeId,
        code2: companyCode,
        code3: DOC_TYPE_LEAVE_ENCASHMENT,
      });
      setHistory(data);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load encashment history" });
    }
  };

  const resetDocument = () => {
    setSelectedDocNo("");
    setHeader(emptyHeader(companyCode, filters.employeeId));
    setDetails([]);
  };

  useEffect(() => {
    if (!filters.employeeId) {
      setBalances([]);
      setDocNoOptions([]);
      setHistory([]);
      resetDocument();
      return;
    }
    resetDocument();
    void loadBalance(filters.employeeId);
    void loadDocNoOptions(filters.employeeId);
    void loadHistory(filters.employeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.employeeId]);

  // ── Load an existing encashment document (header + detail) ──────────────

  const loadDocument = async (hdrLveSlno: string) => {
    if (!hdrLveSlno || !filters.employeeId) return;
    setLoadingDoc(true);
    setNotice(null);
    try {
      const [headerRows, detailRows] = await Promise.all([
        getDynamicLookup({
          parameter: PARAM.HEADER,
          loginid,
          code1: filters.employeeId,
          code2: companyCode,
          code3: DOC_TYPE_LEAVE_ENCASHMENT,
          code4: hdrLveSlno,
        }),
        getDynamicLookup({
          parameter: PARAM.DETAIL,
          loginid,
          code1: filters.employeeId,
          code2: companyCode,
          code3: DOC_TYPE_LEAVE_ENCASHMENT,
          code4: hdrLveSlno,
        }),
      ]);

      const loadedHeader = (headerRows[0] as LeaveHeader) || emptyHeader(companyCode, filters.employeeId);
      setHeader({ ...loadedHeader, hdr_lve_slno: hdrLveSlno });
      setDetails(detailRows as LeaveDetailRow[]);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load encashment document" });
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleDocNoChange = (value: string) => {
    setSelectedDocNo(value);
    if (!value) {
      resetDocument();
      return;
    }
    void loadDocument(value);
  };

  // ── Detail line management ───────────────────────────────────────────────

  const addDetailRow = (row: LeaveDetailRow) => {
    setDetails((current) => [...current, { ...row, id: `new-${Date.now()}` }]);
  };

  const removeDetailRow = (row: LeaveDetailRow) => {
    setDetails((current) => current.filter((item) => item !== row));
  };

  const detailColumns = useMemo<ColumnDef<LeaveDetailRow>[]>(
    () => [
      { accessorKey: "leave_type", header: "Leave Type" },
      { accessorKey: "leave_days", header: "Days" },
      { accessorKey: "leave_reason", header: "Reason" },
      { accessorKey: "half_day", header: "Half Day" },
      { accessorKey: "status", header: "Status" },
      { accessorKey: "remarks", header: "Remarks" },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }: { row: { original: LeaveDetailRow } }) => (
          <Button size="icon" variant="ghost" onClick={() => removeDetailRow(row.original)}>
            <Trash2 size={14} />
          </Button>
        ),
      },
    ],
    [],
  );

  // ── Save ──────────────────────────────────────────────────────────────────

  const canSave = employeeSelected && details.length > 0;

  const saveDocument = async () => {
    if (!canSave) return;
    setSaving(true);
    setNotice(null);
    try {
      const payload = buildLeaveEncashmentPayload(
        { ...header, employee_id: filters.employeeId, company_code: companyCode, doc_type: DOC_TYPE_LEAVE_ENCASHMENT },
        details,
      );
      await executeCommonProcedure({
        parameter: PARAM.SAVE,
        loginid,
        val1s1: filters.employeeId,
        val1s2: companyCode,
        val1s3: String(header.hdr_lve_slno || ""),
        payload,
      });
      setNotice({ type: "success", message: "Leave encashment saved successfully" });
      await loadDocNoOptions(filters.employeeId);
      await loadHistory(filters.employeeId);
      await loadBalance(filters.employeeId);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save leave encashment" });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">HR Transactions</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Leave Encashment</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={!filters.employeeId}
            onClick={() => filters.employeeId && void loadBalance(filters.employeeId)}
          >
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button disabled={!employeeSelected} onClick={() => setLineEditorOpen(true)}>
            <Plus size={15} /> Add
          </Button>
          <Button disabled={!canSave || saving} onClick={() => void saveDocument()}>
            <Save size={15} /> Save
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Org-structure filter cascade */}
      <div className="rounded-lg border bg-white p-4">
        <p className="eyebrow">Employee Selection</p>
        <div className="grid gap-3 md:grid-cols-4">
          <LookupField
            label="Division"
            value={filters.divCode}
            displayValue={filters.divName}
            columns={[
              { field: "div_code", header: "Code" },
              { field: "div_name", header: "Name" },
            ]}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            loadOptions={loadDivisions}
            onChange={(value, row) =>
              setFilters({
                ...emptyFilters,
                divCode: value,
                divName: row ? String(row.div_name ?? "") : "",
              })
            }
            required
          />
          <LookupField
            key={`department-${filters.divCode}`}
            label="Department"
            value={filters.deptCode}
            displayValue={filters.deptName}
            columns={[
              { field: "dept_code", header: "Code" },
              { field: "dept_name", header: "Name" },
            ]}
            valueField="dept_code"
            displayFields={["dept_code", "dept_name"]}
            loadOptions={loadDepartments}
            onChange={(value, row) =>
              setFilters((current) => ({
                ...current,
                deptCode: value,
                deptName: row ? String(row.dept_name ?? "") : "",
                sectionCode: "",
                sectionName: "",
                employeeId: "",
                employeeName: "",
              }))
            }
            disabled={!filters.divCode}
            required
          />
          <LookupField
            key={`section-${filters.divCode}-${filters.deptCode}`}
            label="Section"
            value={filters.sectionCode}
            displayValue={filters.sectionName}
            columns={[
              { field: "section_code", header: "Code" },
              { field: "section_name", header: "Name" },
            ]}
            valueField="section_code"
            displayFields={["section_code", "section_name"]}
            loadOptions={loadSections}
            onChange={(value, row) =>
              setFilters((current) => ({
                ...current,
                sectionCode: value,
                sectionName: row ? String(row.section_name ?? "") : "",
                employeeId: "",
                employeeName: "",
              }))
            }
            disabled={!filters.divCode}
            required
          />
          <LookupField
            // Remounts (and so re-fetches) whenever the narrowing scope
            // changes, since LookupField caches its loaded rows internally
            // and otherwise wouldn't widen/narrow after the first open.
            key={`employee-${filters.divCode}-${filters.deptCode}-${filters.sectionCode}`}
            label="Employee"
            value={filters.employeeId}
            displayValue={filters.employeeName}
            columns={[
              { field: "employee_id", header: "ID" },
              { field: "employee_code", header: "Code" },
              { field: "div_code", header: "Division" },
              { field: "dept_code", header: "Department" },
              { field: "section_code", header: "Section" },
              { field: "rpt_name", header: "Name" },
            ]}
            valueField="employee_id"
            displayFields={["employee_id", "rpt_name"]}
            loadOptions={loadEmployees}
            onChange={(value, row) =>
              setFilters((current) => {
                if (!row) {
                  return { ...current, employeeId: value, employeeName: "" };
                }
                const divCode = String(row.div_code ?? current.divCode ?? "");
                const deptCode = String(row.dept_code ?? current.deptCode ?? "");
                const sectionCode = String(row.section_code ?? current.sectionCode ?? "");
                return {
                  ...current,
                  employeeId: value,
                  employeeName: String(row.rpt_name ?? ""),
                  divCode,
                  // Falls back to the code itself if the employee row
                  // doesn't also carry a description column — still
                  // correct, just less friendly until re-selected via
                  // the Division box, which will fetch the real name.
                  divName: divCode ? String(row.div_name ?? (current.divName || divCode)) : current.divName,
                  deptCode,
                  deptName: deptCode ? String(row.dept_name ?? (current.deptName || deptCode)) : current.deptName,
                  sectionCode,
                  sectionName: sectionCode
                    ? String(row.section_name ?? (current.sectionName || sectionCode))
                    : current.sectionName,
                };
              })
            }
            required
          />
        </div>
      </div>

      {employeeSelected && (
        <>
          {/* Document header */}
          <div className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-3 md:grid-cols-3 md:flex-1">
                <label className="field">
                  <span>Doc No</span>
                  <select
                    className="ui-input h-9 rounded-md border px-3 text-sm"
                    value={selectedDocNo}
                    onChange={(event) => handleDocNoChange(event.target.value)}
                  >
                    <option value="">New (unsaved)</option>
                    {docNoOptions.map((row) => (
                      <option key={String(row.lve_doc_no)} value={String(row.lve_doc_no)}>
                        {String(row.lve_doc_no)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Request Date</span>
                  <Input
                    type="date"
                    value={toDateInputValue(header.leave_request_date)}
                    onChange={(event) => setHeader((current) => ({ ...current, leave_request_date: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Leave Status</span>
                  <Input value={header.verified_status || "New"} disabled />
                </label>
              </div>
            </div>
            <label className="field mt-3">
              <span>Remarks</span>
              <textarea
                className="ui-input min-h-[72px] rounded-md border px-3 py-2 text-sm"
                value={header.leave_remarks || ""}
                onChange={(event) => setHeader((current) => ({ ...current, leave_remarks: event.target.value }))}
              />
            </label>
          </div>

          {/* Leave detail lines */}
          <DataTable
            columns={detailColumns}
            data={details}
            loading={loadingDoc}
            height={280}
            density="grid"
            emptyText="No leave encashment lines yet — use Add to apply against available balance"
            getRowId={(row, index) => String(row.id ?? index)}
          />

          {/* Leave balance + history side by side */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white">
              <div className="border-b p-3">
                <p className="eyebrow m-0">Leave Balance</p>
              </div>
              <DataTable
                columns={[
                  { accessorKey: "leave_type", header: "Leave Type" },
                  { accessorKey: "leave_type_desc", header: "Description" },
                  { accessorKey: "max_no_of_leaves", header: "Max" },
                  { accessorKey: "no_of_leaves_taken", header: "Taken" },
                  { accessorKey: "leave_balance", header: "Remaining" },
                  { accessorKey: "no_of_leaves_accrued", header: "Accrued" },
                ]}
                data={balances}
                loading={loadingBalance}
                height={260}
                density="compact"
                emptyText="No leave balance found"
              />
            </div>
            <div className="rounded-lg border bg-white">
              <div className="border-b p-3">
                <p className="eyebrow m-0">Leave Encash History</p>
              </div>
              <DataTable
                columns={[
                  { accessorKey: "lve_doc_no", header: "Doc No" },
                  { accessorKey: "leave_request_date", header: "Request Date" },
                  { accessorKey: "leave_start_date", header: "Start Date" },
                  { accessorKey: "leave_end_date", header: "End Date" },
                  { accessorKey: "approval_status", header: "Status" },
                ]}
                data={history}
                height={260}
                density="compact"
                emptyText="No encashment history found"
                onRowClick={(row) => handleDocNoChange(String(row.lve_doc_no ?? ""))}
              />
            </div>
          </div>
        </>
      )}

      <LeaveLineEditor
        open={lineEditorOpen}
        balances={balances}
        onClose={() => setLineEditorOpen(false)}
        onAdd={(row) => {
          addDetailRow(row);
          setLineEditorOpen(false);
        }}
        employeeId={filters.employeeId}
        companyCode={companyCode}
        hdrLveSlno={header.hdr_lve_slno || ""}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-line dialog — picks a leave type, validates days against the loaded
// balance, and appends an unsaved detail row to the grid.
// ─────────────────────────────────────────────────────────────────────────────

function LeaveLineEditor({
  open,
  balances,
  onClose,
  onAdd,
  employeeId,
  companyCode,
  hdrLveSlno,
}: {
  open: boolean;
  balances: LeaveBalanceRow[];
  onClose: () => void;
  onAdd: (row: LeaveDetailRow) => void;
  employeeId: string;
  companyCode: string;
  hdrLveSlno: string | number;
}) {
  const [form, setForm] = useState<LeaveDetailRow>(emptyDetailRow(companyCode, employeeId, hdrLveSlno));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyDetailRow(companyCode, employeeId, hdrLveSlno));
      setError("");
    }
  }, [open, companyCode, employeeId, hdrLveSlno]);

  const selectedBalance = findBalanceForType(balances, form.leave_type || "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateDetailRow(form, balances);
    if (validationError) {
      setError(validationError);
      return;
    }
    onAdd(form);
  };

  return (
    <Dialog
      open={open}
      title="Add Leave Encashment Line"
      description="Apply against available leave balance"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            <X size={15} /> Cancel
          </Button>
          <Button type="submit" form="leave-encashment-line-form">
            <Save size={15} /> Add Line
          </Button>
        </>
      }
    >
      <form id="leave-encashment-line-form" className="grid gap-3" onSubmit={submit}>
        <label className="field">
          <span>Leave Type *</span>
          <Input
            className="uppercase"
            value={form.leave_type || ""}
            onChange={(event) =>
              setForm((current) => ({ ...current, leave_type: event.target.value.toUpperCase() }))
            }
            placeholder="e.g. AL"
            required
          />
        </label>

        {form.leave_type && !selectedBalance && (
          <p className="m-0 text-xs text-muted-foreground">No balance found for "{form.leave_type}"</p>
        )}

        {selectedBalance && (
          <p className="m-0 text-xs text-muted-foreground">
            {selectedBalance.leave_type_desc || selectedBalance.leave_type} — available balance:{" "}
            {selectedBalance.leave_balance ?? selectedBalance.no_of_leaves_available ?? 0} day(s)
          </p>
        )}

        <label className="field">
          <span>Days *</span>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={String(form.leave_days ?? "")}
            onChange={(event) => setForm((current) => ({ ...current, leave_days: Number(event.target.value) }))}
            required
          />
        </label>

        <label className="field">
          <span>Half Day</span>
          <select
            className="ui-input h-9 rounded-md border px-3 text-sm"
            value={form.half_day || "No"}
            onChange={(event) => setForm((current) => ({ ...current, half_day: event.target.value }))}
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </label>

        <label className="field">
          <span>Reason</span>
          <Input
            value={form.leave_reason || ""}
            onChange={(event) => setForm((current) => ({ ...current, leave_reason: event.target.value }))}
          />
        </label>

        <label className="field">
          <span>Remarks</span>
          <Input
            value={form.remarks || ""}
            onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
          />
        </label>

        {error && <div className="alert error">{error}</div>}
      </form>
    </Dialog>
  );
}

export default LeaveEncashmentPage;