import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import NoticeToast, { ToastNotice } from "../../components/ui/NoticeToast";
import { useAuth } from "../../state/AuthContext";
import { getDynamicLookup, LookupRow } from "../../api/lookups";
import { saveLeaveEncashment } from "./api/Leaveencashmentapi";
import {
  buildLeaveEncashmentPayload,
  DOC_TYPE_LEAVE_ENCASHMENT,
  emptyDetailRow,
  emptyHeader,
  findBalanceForType,
  HALF_DAY_OPTIONS,
  LeaveBalanceRow,
  LeaveDetailRow,
  LeaveHeader,
  STATUS_OPTIONS,
  toDateInputValue,
  toHalfDayDisplay,
  toLeaveReasonDisplay,
  toStatusDisplay,
  validateDetailRow,
} from "./leaveEncashmentHelpers";

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
  LEAVE_TYPE: "HR_LEAVE_ENCASHMENT_LEAVE_TYPE_DROP_DOWN",
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

// Shape rendered in the Detail Lines grid: a LeaveDetailRow plus doc-level
// fields merged in for display only (see `detailsForGrid`). These doc-level
// fields (lve_doc_no, doc_approval_status, dates merged from history) are
// DISPLAY ONLY — HR_EMP_LEAVE_DET has no LVE_DOC_NO column, so they must
// never be persisted back into `details` (source-of-truth state).
type DetailGridRow = LeaveDetailRow & {
  doc_approval_status?: string;
};

const FALLBACK_ID_PREFIX = "history-fallback-";

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const employeeSelected = Boolean(filters.employeeId);

  // Only one encashment detail line is allowed per document at a time.
  // The Add button is hidden once a real (non-fallback) row exists in
  // `details`, and reappears automatically once the row is removed.
  const canAddLine = employeeSelected && details.length === 0;

  // ── Lookups ───────────────────────────────────────────────────────────────

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
      code1: filters.divCode || undefined,
      code2: filters.divCode ? filters.deptCode || undefined : undefined,
      code3: filters.divCode ? filters.sectionCode || undefined : undefined,
    })) as LookupRow[];

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
        code2: employeeId,
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
    setEditingIndex(null);
    setLineEditorOpen(false);
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
  }, [filters.employeeId]);

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
      setDetails(
        (detailRows as LeaveDetailRow[]).map((row) => ({
          ...row,
          status: toStatusDisplay(row.status),
          half_day: toHalfDayDisplay(row.half_day),
          leave_reason: toLeaveReasonDisplay(row.leave_reason),
        })),
      );
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load encashment document" });
    } finally {
      setLoadingDoc(false);
    }
  };

  const docNoToHdrLveSlno = useMemo(() => {
    const map = new Map<string, string>();
    history.forEach((row) => {
      const docNo = row.lve_doc_no != null ? String(row.lve_doc_no) : "";
      const slno = row.hdr_lve_slno != null ? String(row.hdr_lve_slno) : "";
      if (docNo && slno) map.set(docNo, slno);
    });
    return map;
  }, [history]);

  const handleDocNoChange = (value: string) => {
    setSelectedDocNo(value);
    if (!value) {
      resetDocument();
      return;
    }
    const hdrLveSlno = docNoToHdrLveSlno.get(value);
    if (!hdrLveSlno) {
      setNotice({
        type: "error",
        message: "Unable to locate document details for the selected Doc No. Please refresh and try again.",
      });
      return;
    }
    void loadDocument(hdrLveSlno);
  };

  // ── Detail line management ────────────────────────────────────────────────

  const openAddLine = () => {
    if (!canAddLine) return;
    setEditingIndex(null);
    setLineEditorOpen(true);
  };

  const openEditLine = (index: number) => {
    setEditingIndex(index);
    setLineEditorOpen(true);
  };

  const closeLineEditor = () => {
    setLineEditorOpen(false);
    setEditingIndex(null);
  };

  // `row` here is the form's working copy, which is a DetailGridRow and may
  // carry display-only doc-level fields (lve_doc_no, doc_approval_status)
  // that were merged in purely for rendering. HR_EMP_LEAVE_DET has no
  // LVE_DOC_NO column — strip those before writing into `details`, the
  // array that actually gets sent to the save API.
  const saveDetailRow = (row: DetailGridRow) => {
    const { doc_approval_status, lve_doc_no, ...lineFields } = row;
    void doc_approval_status;
    void lve_doc_no;

    setDetails((current) => {
      if (editingIndex !== null && editingIndex >= 0 && editingIndex < current.length) {
        const next = [...current];
        next[editingIndex] = { ...lineFields, id: current[editingIndex].id } as LeaveDetailRow;
        return next;
      }
      // Enforce single-line-per-document on the add path as well, in case
      // openAddLine's guard was bypassed (e.g. dialog left open from a
      // stale render). Editing an existing row is always allowed.
      if (current.length > 0) return current;
      return [...current, { ...lineFields, id: `new-${Date.now()}` } as LeaveDetailRow];
    });
    closeLineEditor();
  };

  const removeDetailRow = (index: number) => {
    setDetails((current) => current.filter((_, i) => i !== index));
  };

  // When the DETAIL proc returns rows, merge doc-level fields (doc no,
  // start/end date, approval status) from the history list which carries them.
  // When DETAIL returns nothing for a selected doc, fall back to the history
  // row itself so the user sees something in the grid instead of an empty table.
  // NOTE: the fallback row (id starting with FALLBACK_ID_PREFIX) is
  // display-only and does NOT exist in `details` — actions on it must be
  // disabled, see detailColumns below.
  const detailsForGrid = useMemo<DetailGridRow[]>(() => {
    if (!selectedDocNo && details.length === 0) return [];

    const historyRow = history.find((row) => String(row.lve_doc_no ?? "") === selectedDocNo);

    if (details.length > 0) {
      if (!historyRow) return details;
      return details.map((row) => ({
        ...row,
        lve_doc_no: historyRow.lve_doc_no != null ? String(historyRow.lve_doc_no) : row.lve_doc_no,
        leave_start_date:
          historyRow.leave_start_date != null ? String(historyRow.leave_start_date) : row.leave_start_date,
        leave_end_date:
          historyRow.leave_end_date != null ? String(historyRow.leave_end_date) : row.leave_end_date,
        doc_approval_status:
          historyRow.approval_status != null ? String(historyRow.approval_status) : undefined,
      }));
    }

    // DETAIL proc returned nothing — show history row as a display-only fallback
    if (selectedDocNo && historyRow) {
      return [
        {
          id: `${FALLBACK_ID_PREFIX}${selectedDocNo}`,
          leave_type: String(historyRow.leave_type ?? ""),
          leave_days: historyRow.leave_days != null ? Number(historyRow.leave_days) : undefined,
          leave_reason: String(historyRow.leave_reason ?? ""),
          half_day: String(historyRow.half_day ?? ""),
          status: String(historyRow.approval_status ?? ""),
          remarks: String(historyRow.remarks ?? ""),
          lve_doc_no: String(historyRow.lve_doc_no ?? ""),
          leave_start_date: String(historyRow.leave_start_date ?? ""),
          leave_end_date: String(historyRow.leave_end_date ?? ""),
          doc_approval_status: String(historyRow.approval_status ?? ""),
          company_code: companyCode,
          employee_id: filters.employeeId,
          hdr_lve_slno: String(historyRow.hdr_lve_slno ?? ""),
        } as DetailGridRow,
      ];
    }

    return [];
  }, [details, history, selectedDocNo, companyCode, filters.employeeId]);

  // FIX (Bug 1): editingRow must read from `detailsForGrid`, not `details`.
  // `details` is the raw API/source-of-truth array and never carries
  // lve_doc_no / doc_approval_status — those are merged in only on
  // `detailsForGrid`. Editing from `details` caused the dialog to always
  // show blank Doc No / Doc Status even though the table row displayed them.
  const editingRow = editingIndex !== null ? detailsForGrid[editingIndex] ?? null : null;

  const isFallbackRow = (row: DetailGridRow) => String(row.id ?? "").startsWith(FALLBACK_ID_PREFIX);

  const detailColumns = useMemo<ColumnDef<DetailGridRow>[]>(
    () => [
      { accessorKey: "leave_type", header: "Leave Type" },
      { accessorKey: "leave_days", header: "Days" },
      { accessorKey: "leave_reason", header: "Reason" },
      { accessorKey: "half_day", header: "Half Day" },
      { accessorKey: "status", header: "Status" },
      { accessorKey: "remarks", header: "Remarks" },
      { accessorKey: "lve_doc_no", header: "Doc No" },
      { accessorKey: "leave_start_date", header: "Start Date" },
      { accessorKey: "leave_end_date", header: "End Date" },
      { accessorKey: "doc_approval_status", header: "Doc Status" },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        // NOTE: this DataTable wrapper only guarantees `row.index`, not a
        // full TanStack row with `.original` — so look the row up from
        // `detailsForGrid` (closed over here) by index instead of reading
        // row.original directly. The synthetic "history fallback" row has
        // no corresponding entry in `details`, so openEditLine/removeDetailRow
        // (which operate by index into `details`) must never be wired to it.
        cell: ({ row }: { row: { index: number } }) => {
          const original = detailsForGrid[row.index];
          if (!original || isFallbackRow(original)) {
            return <span className="text-xs text-muted-foreground">Add a line to edit</span>;
          }
          return (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEditLine(row.index)}>
                <Pencil size={14} />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => removeDetailRow(row.index)}>
                <Trash2 size={14} />
              </Button>
            </div>
          );
        },
      },
    ],
    [detailsForGrid],
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
        loginid,
      );
      const result = await saveLeaveEncashment(payload);
      setNotice({ type: "success", message: result.message || "Leave encashment saved successfully" });
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
    <section className="grid gap-2">
      {/* Page title + actions — compact */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="m-0 text-lg font-semibold tracking-tight">Leave Encashment</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={!filters.employeeId}
            onClick={() => filters.employeeId && void loadBalance(filters.employeeId)}
          >
            <RefreshCw size={13} /> Refresh
          </Button>
          {/* Only one detail line is allowed per document — hide Add once a
              real (non-fallback) row exists; it reappears after removal. */}
          {canAddLine && (
            <Button size="sm" onClick={openAddLine}>
              <Plus size={13} /> Add
            </Button>
          )}
          <Button size="sm" disabled={!canSave || saving} onClick={() => void saveDocument()}>
            <Save size={13} /> Save
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Org-structure filter cascade — compact padding */}
      <div className="rounded-md border bg-white p-2">
        <p className="eyebrow mb-1.5 text-xs">Employee Selection</p>
        <div className="grid gap-2 md:grid-cols-4">
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
          {/* Document header — all fields in one compact row */}
          <div className="rounded-md border bg-white p-2">
            <div className="grid gap-2 md:grid-cols-4">
              <label className="field">
                <span className="text-xs">Doc No</span>
                <select
                  className="ui-input h-8 rounded-md border px-2 text-sm"
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
                <span className="text-xs">Request Date</span>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={toDateInputValue(header.leave_request_date)}
                  onChange={(event) => setHeader((current) => ({ ...current, leave_request_date: event.target.value }))}
                />
              </label>
              <label className="field">
                <span className="text-xs">Leave Status</span>
                <Input className="h-8 text-sm" value={header.verified_status || "New"} disabled />
              </label>
              <label className="field">
                <span className="text-xs">Remarks</span>
                <Input
                  className="h-8 text-sm"
                  value={header.leave_remarks || ""}
                  onChange={(event) => setHeader((current) => ({ ...current, leave_remarks: event.target.value }))}
                />
              </label>
            </div>
          </div>

          {/* Leave detail lines — reduced height */}
          <DataTable
            columns={detailColumns}
            data={detailsForGrid}
            loading={loadingDoc}
            height={200}
            density="compact"
            emptyText="No leave encashment lines yet — use Add to apply against available balance"
            getRowId={(row, index) => String(row.id ?? index)}
          />

          {/* Leave balance + history side by side — reduced height */}
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-md border bg-white">
              <div className="border-b px-3 py-1.5">
                <p className="eyebrow m-0 text-xs">Leave Balance</p>
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
                height={200}
                density="compact"
                emptyText="No leave balance found"
              />
            </div>
            <div className="rounded-md border bg-white">
              <div className="border-b px-3 py-1.5">
                <p className="eyebrow m-0 text-xs">Leave Encash History</p>
              </div>
              <DataTable
                columns={[
                  {
                    accessorKey: "lve_doc_no",
                    header: "Doc No",
                    cell: ({ row }: { row: { original: LookupRow } }) => {
                      const docNo = String(row.original.lve_doc_no ?? "");
                      const isCurrent = docNo !== "" && docNo === selectedDocNo;
                      return (
                        <span className={isCurrent ? "font-semibold text-primary" : undefined}>
                          {docNo}
                          {isCurrent && (
                            <span className="ml-1 text-[10px] text-muted-foreground">(current)</span>
                          )}
                        </span>
                      );
                    },
                  },
                  { accessorKey: "leave_request_date", header: "Request Date" },
                  { accessorKey: "leave_start_date", header: "Start Date" },
                  { accessorKey: "leave_end_date", header: "End Date" },
                  { accessorKey: "approval_status", header: "Status" },
                ]}
                data={history}
                height={200}
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
        editingRow={editingRow}
        onClose={closeLineEditor}
        onSave={saveDetailRow}
        employeeId={filters.employeeId}
        companyCode={companyCode}
        loginid={loginid}
        hdrLveSlno={header.hdr_lve_slno || ""}
      />
    </section>
  );
}

// ── Line editor dialog ────────────────────────────────────────────────────────
// 2-column layout with all 10 grid columns covered as editable fields.

function LeaveLineEditor({
  open,
  balances,
  editingRow,
  onClose,
  onSave,
  employeeId,
  companyCode,
  loginid,
  hdrLveSlno,
}: {
  open: boolean;
  balances: LeaveBalanceRow[];
  editingRow: DetailGridRow | null;
  onClose: () => void;
  onSave: (row: DetailGridRow) => void;
  employeeId: string;
  companyCode: string;
  loginid: string;
  hdrLveSlno: string | number;
}) {
  const isEditing = Boolean(editingRow);

  const [form, setForm] = useState<DetailGridRow>(
    editingRow || (emptyDetailRow(companyCode, employeeId, hdrLveSlno) as DetailGridRow),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(editingRow || (emptyDetailRow(companyCode, employeeId, hdrLveSlno) as DetailGridRow));
      setError("");
    }
  }, [open, editingRow, companyCode, employeeId, hdrLveSlno]);

  const selectedBalance = findBalanceForType(balances, form.leave_type || "");

  // Loads leave types from MS_HR_LEAVE_TYPES for the company, excluding any
  // row explicitly flagged as not encashable (ENCASHMENT = 'N'). Rows with
  // ENCASHMENT null/blank/'Y' (or anything other than 'N') are shown.
  const loadLeaveTypes = async () => {
    const rows = (await getDynamicLookup({
      parameter: "HR_LEAVE_ENCASHMENT_LEAVE_TYPE_DROP_DOWN",
      loginid,
      code1: companyCode,
    })) as LookupRow[];
    return rows.filter((row) => String(row.encashment ?? "").trim().toUpperCase() !== "N");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateDetailRow(form, balances);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(form);
  };

  return (
    <Dialog
      open={open}
      title={isEditing ? "Edit Leave Encashment Line" : "Add Leave Encashment Line"}
      description="Apply against available leave balance"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            <X size={14} /> Cancel
          </Button>
          <Button type="submit" form="leave-encashment-line-form">
            <Save size={14} /> {isEditing ? "Save Changes" : "Add Line"}
          </Button>
        </>
      }
    >
      <form id="leave-encashment-line-form" className="grid grid-cols-2 gap-x-4 gap-y-2" onSubmit={submit}>

        {/* Row 1: Leave Type + Days */}
        <label className="field">
          <span className="text-xs font-medium">Leave Type *</span>
          <LookupField
            label=""
            value={form.leave_type || ""}
            displayValue={form.leave_type || ""}
            columns={[
              { field: "leave_type", header: "Code" },
              { field: "leave_type_desc", header: "Description" },
            ]}
            valueField="leave_type"
            displayFields={["leave_type", "leave_type_desc"]}
            loadOptions={loadLeaveTypes}
            onChange={(value) => setForm((c) => ({ ...c, leave_type: value }))}
            required
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Days *</span>
          <Input
            type="number"
            className="h-8 text-sm"
            min={0}
            step={0.5}
            value={String(form.leave_days ?? "")}
            onChange={(e) => setForm((c) => ({ ...c, leave_days: Number(e.target.value) }))}
            required
          />
        </label>

        {/* Balance hint */}
        {form.leave_type && (
          <p className="col-span-2 -mt-1 m-0 text-xs text-muted-foreground">
            {!selectedBalance
              ? `No balance found for "${form.leave_type}"`
              : `${selectedBalance.leave_type_desc || selectedBalance.leave_type} — available: ${
                  selectedBalance.leave_balance ?? selectedBalance.no_of_leaves_available ?? 0
                } day(s)`}
          </p>
        )}

        {/* Row 2: Start Date + End Date */}
        <label className="field">
          <span className="text-xs font-medium">Start Date</span>
          <Input
            type="date"
            className="h-8 text-sm"
            value={toDateInputValue(form.leave_start_date)}
            onChange={(e) => setForm((c) => ({ ...c, leave_start_date: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">End Date</span>
          <Input
            type="date"
            className="h-8 text-sm"
            value={toDateInputValue(form.leave_end_date)}
            onChange={(e) => setForm((c) => ({ ...c, leave_end_date: e.target.value }))}
          />
        </label>

        {/* Row 3: Half Day + Status */}
        <label className="field">
          <span className="text-xs font-medium">Half Day</span>
          <select
            className="ui-input h-8 rounded-md border px-2 text-sm"
            value={form.half_day || "No"}
            onChange={(e) => setForm((c) => ({ ...c, half_day: e.target.value }))}
          >
            {HALF_DAY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>

        {/* Status maps "Active"/"Inactive" to "A"/"I" in buildLeaveEncashmentPayload */}
        <label className="field">
          <span className="text-xs font-medium">Status</span>
          <select
            className="ui-input h-8 rounded-md border px-2 text-sm"
            value={form.status || STATUS_OPTIONS[0]}
            onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>

        {/* Row 4: Doc No + Doc Status — read-only: doc number is assigned by
            the backend (HDR_LVE_SLNO -> LVE_DOC_NO) and approval status is a
            header-level value; neither is a column on HR_EMP_LEAVE_DET, so
            they must not be free-typed as if they were per-line fields. */}
        <label className="field">
          <span className="text-xs font-medium">Doc No</span>
          <Input
            className="h-8 text-sm"
            value={form.lve_doc_no || ""}
            disabled
            placeholder="Auto-assigned on save"
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Doc Status</span>
          <Input
            className="h-8 text-sm"
            value={form.doc_approval_status || ""}
            disabled
            placeholder="Set on approval"
          />
        </label>

        {/* Row 5: Reason + Remarks */}
        <label className="field">
          <span className="text-xs font-medium">Reason</span>
          <Input
            className="h-8 text-sm"
            value={form.leave_reason || ""}
            onChange={(e) => setForm((c) => ({ ...c, leave_reason: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="text-xs font-medium">Remarks</span>
          <Input
            className="h-8 text-sm"
            value={form.remarks || ""}
            onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))}
          />
        </label>

        {error && <div className="alert error col-span-2 text-sm">{error}</div>}
      </form>
    </Dialog>
  );
}

export default LeaveEncashmentPage;