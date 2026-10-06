import type { ColumnDef } from "@tanstack/react-table";
import {
  Eraser, FileText, FilePlus, History, ListChecks, Loader2, Pencil, Plus, RefreshCw, Save,
  Trash2, UserRound, Wallet, X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getDynamicLookup, type LookupRow } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Field, SectionPanel } from "../../components/ui/Formblocks";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";
import { saveLeaveEncashment } from "./api/Leaveencashmentapi";
import {
  buildLeaveEncashmentPayload,
  DOC_TYPE_LEAVE_ENCASHMENT,
  emptyDetailRow,
  emptyHeader,
  findBalanceForType,
  HALF_DAY_OPTIONS,
  type LeaveBalanceRow,
  type LeaveDetailRow,
  type LeaveHeader,
  STATUS_OPTIONS,
  toDateInputValue,
  toHalfDayDisplay,
  toLeaveReasonDisplay,
  toStatusDisplay,
  validateDetailRow,
} from "./leaveEncashmentHelpers";

/** Shape returned by saveLeaveEncashment — keep loose so API shape drift does not break the page. */
type SaveLeaveEncashmentResult = {
  message?: string;
  lve_doc_no?: string | number | null;
  doc_no?: string | number | null;
  hdr_lve_slno?: string | number | null;
  [key: string]: unknown;
};

const PARAM = {
  DIVISION: "DROP_DOWN_DIVISION",
  DEPARTMENT: "HR_LEAVE_ENCASHMENT_DEPT_DROP_DOWN",
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

/** Display-only date formatter – strips time/Z so tables show YYYY-MM-DD */
function formatDateDisplay(value: unknown): string {
  if (value == null || value === "") return "";
  const str = String(value).trim();
  if (str.includes("T")) return str.split("T")[0];
  if (str.includes(" ")) return str.split(" ")[0];
  return str;
}

export function LeaveEncashmentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  const [lineEditorOpen, setLineEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  const employeeSelected = Boolean(filters.employeeId);

  const selectedHistoryRow = useMemo(
    () => history.find((row) => String(row.lve_doc_no ?? "") === selectedDocNo),
    [history, selectedDocNo],
  );

  // Add is available whenever an employee is selected and a document is not loading.
  const canAddLine = employeeSelected && !loadingDoc;

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
          code3: companyCode,
        })) as LookupRow[])
      : [];

  const loadEmployees = async () =>
    (await getDynamicLookup({
      parameter: PARAM.EMPLOYEE,
      loginid,
      code1: filters.divCode || undefined,
      code2: filters.divCode ? filters.deptCode || undefined : undefined,
      code3: filters.divCode ? filters.sectionCode || undefined : undefined,
      code4: companyCode,
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
      toast.error(error instanceof Error ? error.message : "Unable to load leave balance");
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
      toast.error(error instanceof Error ? error.message : "Unable to load document list");
    }
  };

  const loadHistory = async (employeeId: string): Promise<LookupRow[]> => {
    try {
      const data = (await getDynamicLookup({
        parameter: PARAM.LEAVE_HISTORY,
        loginid,
        code1: employeeId,
        code2: companyCode,
        code3: DOC_TYPE_LEAVE_ENCASHMENT,
      })) as LookupRow[];
      setHistory(data);
      return data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load encashment history");
      return [];
    }
  };

  const resetDocument = useCallback(() => {
    setSelectedDocNo("");
    setHeader(emptyHeader(companyCode, filters.employeeId));
    setDetails([]);
    setEditingIndex(null);
    setLineEditorOpen(false);
    setConfirmDeleteIndex(null);
  }, [companyCode, filters.employeeId]);

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

  const loadDocument = async (hdrLveSlno: string) => {
    if (!hdrLveSlno || !filters.employeeId) return;
    setLoadingDoc(true);
    setConfirmDeleteIndex(null);
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

      const loadedHeader =
        (headerRows[0] as LeaveHeader) || emptyHeader(companyCode, filters.employeeId);
      setHeader({ ...loadedHeader, hdr_lve_slno: hdrLveSlno });

      const mappedDetails = (detailRows as LeaveDetailRow[]).map((row) => ({
        ...row,
        status: toStatusDisplay(row.status),
        half_day: toHalfDayDisplay(row.half_day),
        leave_reason: toLeaveReasonDisplay(row.leave_reason),
      }));

      // If DETAIL proc returns nothing, seed an editable line from history so
      // the grid always has Edit / Delete actions (not a read-only placeholder).
      if (mappedDetails.length === 0) {
        const historyRow = history.find(
          (row) => String(row.hdr_lve_slno ?? "") === String(hdrLveSlno),
        );
        if (historyRow) {
          setDetails([
            {
              id: `seeded-${hdrLveSlno}`,
              leave_type: String(historyRow.leave_type ?? ""),
              leave_days: historyRow.leave_days != null ? Number(historyRow.leave_days) : 0,
              leave_reason: toLeaveReasonDisplay(String(historyRow.leave_reason ?? "")),
              half_day: toHalfDayDisplay(String(historyRow.half_day ?? "")),
              status: toStatusDisplay(String(historyRow.status ?? historyRow.approval_status ?? "")),
              remarks: String(historyRow.remarks ?? ""),
              lve_doc_no: historyRow.lve_doc_no != null ? String(historyRow.lve_doc_no) : null,
              leave_start_date: String(historyRow.leave_start_date ?? ""),
              leave_end_date: String(historyRow.leave_end_date ?? ""),
              company_code: companyCode,
              employee_id: filters.employeeId,
              hdr_lve_slno: hdrLveSlno,
              doc_type: DOC_TYPE_LEAVE_ENCASHMENT,
            },
          ]);
        } else {
          setDetails([]);
        }
      } else {
        setDetails(mappedDetails);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load encashment document");
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
    // Also map from docNoOptions in case history is lagging
    docNoOptions.forEach((row) => {
      const docNo = row.lve_doc_no != null ? String(row.lve_doc_no) : "";
      const slno = row.hdr_lve_slno != null ? String(row.hdr_lve_slno) : "";
      if (docNo && slno && !map.has(docNo)) map.set(docNo, slno);
    });
    return map;
  }, [history, docNoOptions]);

  const handleDocNoChange = (value: string) => {
    setSelectedDocNo(value);
    setConfirmDeleteIndex(null);
    if (!value) {
      resetDocument();
      return;
    }
    const hdrLveSlno = docNoToHdrLveSlno.get(value);
    if (!hdrLveSlno) {
      toast.error(
        "Unable to locate document details for the selected Doc No. Please refresh and try again.",
      );
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

  const openEditLine = useCallback((index: number) => {
    setEditingIndex(index);
    setLineEditorOpen(true);
  }, []);

  const closeLineEditor = () => {
    setLineEditorOpen(false);
    setEditingIndex(null);
  };

  // `row` here is the form's working copy (DetailGridRow) and may carry
  // display-only doc_approval_status merged for rendering. Strip it before
  // writing into `details`, the source-of-truth sent to the save API.
  const saveDetailRow = (row: DetailGridRow) => {
    const { doc_approval_status: _docStatus, ...lineFields } = row;
    void _docStatus;

    setDetails((current) => {
      if (editingIndex !== null && editingIndex >= 0 && editingIndex < current.length) {
        const next = [...current];
        next[editingIndex] = {
          ...(lineFields as LeaveDetailRow),
          id: current[editingIndex].id,
        };
        return next;
      }
      return [
        ...current,
        {
          ...(lineFields as LeaveDetailRow),
          id: `new-${Date.now()}`,
        },
      ];
    });
    closeLineEditor();
  };

  // Delete simply removes the row from the in-memory `details` array.
  // User can then Save to persist the change.
  const removeDetailRow = useCallback((index: number) => {
    setDetails((current) => current.filter((_, i) => i !== index));
    setConfirmDeleteIndex(null);
    setEditingIndex((idx) => (idx === index ? null : idx));
  }, []);

  // Grid always reflects `details` (source of truth). Doc-level display fields
  // from the selected history row are merged for columns only.
  const detailsForGrid = useMemo<DetailGridRow[]>(() => {
    if (details.length === 0) return [];

    const historyRow = selectedDocNo
      ? history.find((row) => String(row.lve_doc_no ?? "") === selectedDocNo)
      : undefined;

    if (!historyRow) return details;

    return details.map((row) => ({
      ...row,
      lve_doc_no:
        row.lve_doc_no != null && row.lve_doc_no !== ""
          ? row.lve_doc_no
          : historyRow.lve_doc_no != null
            ? String(historyRow.lve_doc_no)
            : row.lve_doc_no,
      leave_start_date:
        row.leave_start_date ||
        (historyRow.leave_start_date != null ? String(historyRow.leave_start_date) : ""),
      leave_end_date:
        row.leave_end_date ||
        (historyRow.leave_end_date != null ? String(historyRow.leave_end_date) : ""),
      doc_approval_status:
        historyRow.approval_status != null ? String(historyRow.approval_status) : undefined,
    }));
  }, [details, history, selectedDocNo]);

  const editingRow = editingIndex !== null ? detailsForGrid[editingIndex] ?? null : null;

  const detailColumns = useMemo<ColumnDef<DetailGridRow>[]>(
    () => [
      { accessorKey: "leave_type", header: "Leave Type" },
      { accessorKey: "leave_days", header: "Days" },
      { accessorKey: "leave_reason", header: "Reason" },
      { accessorKey: "half_day", header: "Half Day" },
      { accessorKey: "status", header: "Status" },
      { accessorKey: "remarks", header: "Remarks" },
      { accessorKey: "lve_doc_no", header: "Doc No" },
      {
        accessorKey: "leave_start_date",
        header: "Start Date",
        cell: ({ getValue }) => formatDateDisplay(getValue()),
      },
      {
        accessorKey: "leave_end_date",
        header: "End Date",
        cell: ({ getValue }) => formatDateDisplay(getValue()),
      },
      { accessorKey: "doc_approval_status", header: "Doc Status" },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }: { row: { index: number } }) => {
          if (confirmDeleteIndex === row.index) {
            return (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => removeDetailRow(row.index)}>
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteIndex(null)}>
                  Cancel
                </Button>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                onClick={() => openEditLine(row.index)}
                title="Edit line"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                onClick={() => setConfirmDeleteIndex(row.index)}
                title="Remove line"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        },
      },
    ],
    [confirmDeleteIndex, openEditLine, removeDetailRow],
  );

  // ── Save ──────────────────────────────────────────────────────────────────

  const canSave = employeeSelected && details.length > 0 && !loadingDoc;

  const saveDocument = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = buildLeaveEncashmentPayload(
        {
          ...header,
          employee_id: filters.employeeId,
          company_code: companyCode,
          doc_type: DOC_TYPE_LEAVE_ENCASHMENT,
        },
        details,
        loginid,
      );
      const result = (await saveLeaveEncashment(payload)) as SaveLeaveEncashmentResult;
      toast.success(result?.message || "Leave encashment saved successfully");

      // Refresh lists, then try to land on the saved document if we can resolve it
      await loadDocNoOptions(filters.employeeId);
      const nextHistory = await loadHistory(filters.employeeId);
      await loadBalance(filters.employeeId);

      const rawDoc =
        result?.lve_doc_no != null && result.lve_doc_no !== ""
          ? result.lve_doc_no
          : result?.doc_no != null && result.doc_no !== ""
            ? result.doc_no
            : "";
      const returnedDocNo = rawDoc !== "" ? String(rawDoc) : "";

      if (returnedDocNo) {
        setSelectedDocNo(returnedDocNo);
        const slno =
          nextHistory.find((r) => String(r.lve_doc_no ?? "") === returnedDocNo)?.hdr_lve_slno ??
          result?.hdr_lve_slno ??
          null;
        if (slno != null && slno !== "") {
          void loadDocument(String(slno));
        }
      } else if (selectedDocNo) {
        // Re-load the current document so header/status stay in sync
        const slno = docNoToHdrLveSlno.get(selectedDocNo);
        if (slno) void loadDocument(slno);
      } else {
        // New document with no returned doc no — reset so the user starts clean
        resetDocument();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save leave encashment");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setBalances([]);
    setDocNoOptions([]);
    setHistory([]);
    resetDocument();
  };

  const startNewDocument = () => {
    if (!employeeSelected) return;
    resetDocument();
  };

  // Header status: prefer live document status, fall back to history for selected doc
  const headerStatusDisplay = useMemo(() => {
    if (selectedHistoryRow?.approval_status) {
      return String(selectedHistoryRow.approval_status);
    }
    return header.verified_status || "New";
  }, [selectedHistoryRow, header.verified_status]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
      {/* Freight-style transaction header */}
      <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Wallet size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">
                HR Transactions - Leave Encashment
              </h1>
              {employeeSelected && (
                <>
                  <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                    {headerStatusDisplay}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {filters.employeeName
                      ? `${filters.employeeName} (${filters.employeeId})`
                      : filters.employeeId}
                    {selectedDocNo ? ` · Doc ${selectedDocNo}` : " · New document"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {(filters.divCode || filters.employeeId) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearFilters}
              disabled={saving}
              title="Clear employee selection"
            >
              <Eraser size={14} /> Clear
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!employeeSelected || loadingBalance || saving}
            onClick={() => employeeSelected && void loadBalance(filters.employeeId)}
            title="Refresh leave balance"
          >
            {loadingBalance ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}{" "}
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!employeeSelected || loadingDoc || saving}
            onClick={startNewDocument}
            title="Start a new encashment document"
          >
            <FilePlus size={14} /> New
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAddLine || saving}
            onClick={openAddLine}
            title="Add encashment line"
          >
            <Plus size={14} /> Add
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave || saving}
            onClick={() => void saveDocument()}
            title="Save document"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{" "}
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      {/* Org-structure filter cascade */}
      <SectionPanel title="Employee Selection" icon={UserRound}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Division" required>
            <LookupField
              compact
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
            />
          </Field>
          <Field label="Department" required>
            <LookupField
              compact
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
            />
          </Field>
          <Field label="Section" required>
            <LookupField
              compact
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
            />
          </Field>
          <Field label="Employee" required>
            <LookupField
              compact
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
                    divName: divCode
                      ? String(row.div_name ?? (current.divName || divCode))
                      : current.divName,
                    deptCode,
                    deptName: deptCode
                      ? String(row.dept_name ?? (current.deptName || deptCode))
                      : current.deptName,
                    sectionCode,
                    sectionName: sectionCode
                      ? String(row.section_name ?? (current.sectionName || sectionCode))
                      : current.sectionName,
                  };
                })
              }
            />
          </Field>
        </div>
      </SectionPanel>

      {!employeeSelected && (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Select an employee to view leave balance, history, and create an encashment document.
        </div>
      )}

      {employeeSelected && (
        <>
          {/* Document header */}
          <SectionPanel title="Document Information" icon={FileText}>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Doc No">
                <Select
                  value={selectedDocNo}
                  disabled={loadingDoc || saving}
                  onChange={(event) => handleDocNoChange(event.target.value)}
                >
                  <option value="">New (unsaved)</option>
                  {docNoOptions.map((row) => (
                    <option key={String(row.lve_doc_no)} value={String(row.lve_doc_no)}>
                      {String(row.lve_doc_no)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Request Date">
                <Input
                  type="date"
                  value={toDateInputValue(header.leave_request_date)}
                  disabled={loadingDoc || saving}
                  onChange={(event) =>
                    setHeader((current) => ({ ...current, leave_request_date: event.target.value }))
                  }
                />
              </Field>
              <Field label="Leave Status">
                <Input value={headerStatusDisplay} disabled />
              </Field>
              <Field label="Remarks">
                <Input
                  value={header.leave_remarks || ""}
                  disabled={loadingDoc || saving}
                  onChange={(event) =>
                    setHeader((current) => ({ ...current, leave_remarks: event.target.value }))
                  }
                />
              </Field>
            </div>
          </SectionPanel>

          {/* Leave detail lines */}
          <SectionPanel title={`Encashment Lines (${details.length})`} icon={ListChecks}>
            <DataTable
              columns={detailColumns}
              data={detailsForGrid}
              loading={loadingDoc}
              height={220}
              density="compact"
              emptyText="No leave encashment lines yet — use Add to apply against available balance"
              getRowId={(row, index) => String(row.id ?? index)}
            />
          </SectionPanel>

          {/* Leave balance + history */}
          <div className="grid gap-2 md:grid-cols-2">
            <SectionPanel title="Leave Balance" icon={Wallet}>
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
                height={220}
                density="compact"
                emptyText="No leave balance found"
              />
            </SectionPanel>

            <SectionPanel title="Leave Encash History" icon={History}>
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
                  {
                    accessorKey: "leave_request_date",
                    header: "Request Date",
                    cell: ({ getValue }) => formatDateDisplay(getValue()),
                  },
                  {
                    accessorKey: "leave_start_date",
                    header: "Start Date",
                    cell: ({ getValue }) => formatDateDisplay(getValue()),
                  },
                  {
                    accessorKey: "leave_end_date",
                    header: "End Date",
                    cell: ({ getValue }) => formatDateDisplay(getValue()),
                  },
                  { accessorKey: "approval_status", header: "Status" },
                ]}
                data={history}
                height={220}
                density="compact"
                emptyText="No encashment history found"
                onRowClick={(row) => handleDocNoChange(String(row.lve_doc_no ?? ""))}
              />
            </SectionPanel>
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
        hdrLveSlno={header.hdr_lve_slno || ""}
      />
    </section>
  );
}

// ── Line editor dialog ────────────────────────────────────────────────────────

function LeaveLineEditor({
  open,
  balances,
  editingRow,
  onClose,
  onSave,
  employeeId,
  companyCode,
  hdrLveSlno,
}: {
  open: boolean;
  balances: LeaveBalanceRow[];
  editingRow: DetailGridRow | null;
  onClose: () => void;
  onSave: (row: DetailGridRow) => void;
  employeeId: string;
  companyCode: string;
  hdrLveSlno: string | number;
}) {
  const isEditing = Boolean(editingRow);

  const [form, setForm] = useState<DetailGridRow>(() =>
    editingRow ? { ...editingRow } : { ...emptyDetailRow(companyCode, employeeId, hdrLveSlno) },
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        editingRow
          ? { ...editingRow }
          : { ...emptyDetailRow(companyCode, employeeId, hdrLveSlno) },
      );
      setError("");
    }
  }, [open, editingRow, companyCode, employeeId, hdrLveSlno]);

  const selectedBalance = findBalanceForType(balances, form.leave_type || "");

  const availableDays = selectedBalance
    ? Number(selectedBalance.leave_balance ?? selectedBalance.no_of_leaves_available ?? 0)
    : 0;

  // Only leave types that appear in the balance table (no extra API call needed).
  const loadLeaveTypes = async () =>
    balances
      .filter((b) => String(b.leave_type ?? "").trim() !== "")
      .map((b) => ({
        leave_type: String(b.leave_type),
        leave_type_desc: String(b.leave_type_desc ?? b.leave_type),
      }));

  const submit = (event: FormEvent) => {
    event.preventDefault();

    const validationError = validateDetailRow(form as LeaveDetailRow, balances);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Hard cap: days must not exceed available balance for the chosen type.
    const days = Number(form.leave_days ?? 0);
    if (!form.leave_type) {
      setError("Leave type is required");
      return;
    }
    if (!selectedBalance) {
      setError(`No balance found for "${form.leave_type}"`);
      return;
    }
    if (days <= 0) {
      setError("Days must be greater than 0");
      return;
    }
    if (days > availableDays) {
      setError(
        `Cannot exceed available balance of ${availableDays} day(s) for ${
          selectedBalance.leave_type_desc || form.leave_type
        }`,
      );
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
      <form
        id="leave-encashment-line-form"
        className="freight-dense-form grid grid-cols-2 gap-x-4 gap-y-3"
        onSubmit={submit}
      >
        <Field label="Leave Type" required>
          <LookupField
            compact
            label="Leave Type"
            value={form.leave_type || ""}
            displayValue={form.leave_type || ""}
            columns={[
              { field: "leave_type", header: "Code" },
              { field: "leave_type_desc", header: "Description" },
            ]}
            valueField="leave_type"
            displayFields={["leave_type", "leave_type_desc"]}
            loadOptions={loadLeaveTypes}
            onChange={(value) =>
              setForm((c) => ({
                ...c,
                leave_type: value,
                // Clear days when type changes so user re-enters within new balance
                leave_days: c.leave_type === value ? c.leave_days : 0,
              }))
            }
          />
        </Field>

        <Field label="Days" required>
          <Input
            type="number"
            min={0}
            max={availableDays > 0 ? availableDays : undefined}
            step={0.5}
            value={String(form.leave_days ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              const next = raw === "" ? 0 : Number(raw);
              setForm((c) => ({ ...c, leave_days: next }));
            }}
            required
          />
        </Field>

        {form.leave_type && (
          <p className="col-span-2 -mt-1 m-0 text-[11px] text-muted-foreground">
            {!selectedBalance
              ? `No balance found for "${form.leave_type}"`
              : `${selectedBalance.leave_type_desc || selectedBalance.leave_type} — available: ${availableDays} day(s)`}
          </p>
        )}

        <Field label="Start Date">
          <Input
            type="date"
            value={toDateInputValue(form.leave_start_date)}
            onChange={(e) => setForm((c) => ({ ...c, leave_start_date: e.target.value }))}
          />
        </Field>

        <Field label="End Date">
          <Input
            type="date"
            value={toDateInputValue(form.leave_end_date)}
            onChange={(e) => setForm((c) => ({ ...c, leave_end_date: e.target.value }))}
          />
        </Field>

        <Field label="Half Day">
          <Select
            value={form.half_day || "No"}
            onChange={(e) => setForm((c) => ({ ...c, half_day: e.target.value }))}
          >
            {HALF_DAY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select
            value={form.status || STATUS_OPTIONS[0]}
            onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Doc No">
          <Input value={form.lve_doc_no || ""} disabled placeholder="Auto-assigned on save" />
        </Field>

        <Field label="Doc Status">
          <Input value={form.doc_approval_status || ""} disabled placeholder="Set on approval" />
        </Field>

        <Field label="Reason">
          <Input
            value={form.leave_reason || ""}
            onChange={(e) => setForm((c) => ({ ...c, leave_reason: e.target.value }))}
          />
        </Field>

        <Field label="Remarks">
          <Input
            value={form.remarks || ""}
            onChange={(e) => setForm((c) => ({ ...c, remarks: e.target.value }))}
          />
        </Field>

        {error && <p className="col-span-2 m-0 text-[12px] text-destructive">{error}</p>}
      </form>
    </Dialog>
  );
}

export default LeaveEncashmentPage;