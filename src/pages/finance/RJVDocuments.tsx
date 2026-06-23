import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { Ban, Download, Edit2, Paperclip, Plus, Printer, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import {
  cancelTransactionDocument,
  deleteTransactionDocument,
  Division,
  FyPeriod,
  getCheque,
  getChildTableName,
  getDivisions,
  getDocAccounts,
  getFinanceMasterRows,
  getFyPeriods,
  getTransactionChildren,
  getTransactionDefaultData,
  getTransactionDetail,
  getTransactionDocuments,
  getTransactionHeader,
  saveTransactionDocument,
  TransactionDetail,
  TransactionChildRow,
  TransactionDocumentRow,
  TransactionHeader,
  TransactionType,
  upsertBulkAccountEntryApi,
  getFinanceOutstanding,
  openDocumentReport,
  downloadDocumentReportExcel,
} from "../../api/transactions";
import { getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Badge } from "../../components/ui/Badge";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { Button } from "../../components/ui/Button";
import { CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type EditorState =
  | { mode: "create"; divCode?: string; divName?: string }
  | { mode: "edit"; row: TransactionDocumentRow }
  | null;

const DOCUMENT_META: Record<TransactionType, { title: string; subtitle: string; addLabel: string }> = {
  BP: { title: "Cheque Payment", subtitle: "Bank payment document", addLabel: "Add Payment" },
  BR: { title: "Cheque Receipt", subtitle: "Bank receipt document", addLabel: "Add Receipt" },
  CR: { title: "Cash Receipt", subtitle: "Cash receipt document", addLabel: "Add Receipt" },
  CP: { title: "Petty Cash Payment", subtitle: "Petty cash document", addLabel: "Add Payment" },
  CN: { title: "Credit Note", subtitle: "Customer credit adjustment", addLabel: "Add Credit Note" },
  DN: { title: "Debit Note", subtitle: "Debit adjustment document", addLabel: "Add Debit Note" },
  PO: { title: "LPO", subtitle: "Local purchase order", addLabel: "Add LPO" },
  PI: { title: "Purchase", subtitle: "Purchase invoice document", addLabel: "Add Purchase" },
  SI: { title: "Sales", subtitle: "Sales invoice document", addLabel: "Add Sales" },
  SV: { title: "Service Invoice", subtitle: "Service billing document", addLabel: "Add Service" },
  JV: { title: "Journal Voucher", subtitle: "General ledger journal", addLabel: "Add Voucher" },
   RJV: { title: "Reverse Journal Voucher", subtitle: "Reverse general ledger journal", addLabel: "Add Reverse Voucher" },
};

const today = () => new Date().toISOString().slice(0, 10);
const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function RJVDocumentEditor({ docType }: { docType: TransactionType }) {
  const meta = DOCUMENT_META[docType];
  const [rows, setRows] = useState<TransactionDocumentRow[]>([]);
  const [fyPeriods, setFyPeriods] = useState<FyPeriod[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [fyPeriod, setFyPeriod] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionDocumentRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TransactionDocumentRow | null>(null);
  const [divisionPicker, setDivisionPicker] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const loadLookups = async () => {
    const [fyData, divisionData] = await Promise.all([getFyPeriods(), getDivisions()]);
    setFyPeriods(fyData);
    setDivisions(divisionData);
    setFyPeriod((current) => current || fyData[0]?.fy_period || "");
  };

  const loadRows = async (nextFy = fyPeriod, nextQuery = query, nextPageIndex = pageIndex, nextPageSize = pageSize, nextColumnFilters = columnFilters, clearNotice = true) => {
    if (!nextFy) return;
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const hasSearch = Boolean(query.trim() || nextColumnFilters.some((filter) => String(filter.value ?? "").trim()));
      const requestPageIndex = hasSearch ? 0 : nextPageIndex;
      const requestPageSize = hasSearch ? 100000 : nextPageSize;
      const activeFilters = nextColumnFilters
        .map((filter) => ({ field: filter.id, values: String(filter.value ?? "").trim() }))
        .filter((filter) => filter.values);
      const params: Record<string, any> = {};
      if (query.trim()) params.search = query.trim();
      if (activeFilters.length) params.filter = JSON.stringify({ search: activeFilters });
      const response = await getTransactionDocuments(docType, nextFy, nextQuery, requestPageIndex + 1, requestPageSize, activeFilters);
      setRows(response.tableData);
      setTotalRows(response.count || response.tableData.length);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load documents" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLookups().catch((error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load lookups" });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void loadRows();
  }, [fyPeriod, docType, query, pageIndex, pageSize, columnFilters]);



  const columns = useMemo<ColumnDef<TransactionDocumentRow>[]>(() => [
    {
      accessorKey: "doc_no",
      header: "Doc No",
      cell: ({ row }) => <span className="font-semibold">{row.original.doc_no}</span>,
    },
    { accessorKey: "doc_date", header: "Date", cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: "ac_name", header: "Account Name" },
    ...(docType === "CP" ? [{ accessorKey: "ac_payee", header: "Account Payee" } as ColumnDef<TransactionDocumentRow>] : []),
    { accessorKey: "remarks", header: "Description" },
    ...(docType !== "CR" ? [{ accessorKey: "cheque_no", header: "Cheque No" } as ColumnDef<TransactionDocumentRow>] : []),
    ...(docType === "BR" ? [{ accessorKey: "cheque_bank", header: "Cheque Bank" } as ColumnDef<TransactionDocumentRow>] : []),
    { accessorKey: "div_code", header: "Div" },
    {
      accessorKey: "canceled",
      header: "Status",
      cell: ({ getValue }) => String(getValue() || "N") === "Y" ? <Badge variant="outline" className="border-destructive text-destructive">Cancelled</Badge> : <Badge>Active</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })} title="Edit">
            <Edit2 size={15} />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => window.print()} title="Print">
            <Printer size={15} />
          </Button>
          {row.original.canceled !== "Y" && (
            <Button size="icon" variant="ghost" onClick={() => setCancelTarget(row.original)} title="Cancel">
              <Ban size={15} />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)} title="Delete">
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ], [docType, columnFilters]);

  const openCreateForDivision = (division: Division) => {
    setDivisionPicker(false);
    setEditor({ mode: "create", divCode: division.div_code, divName: division.div_name });
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelTransactionDocument(cancelTarget.doc_no, docType);
      setCancelTarget(null);
      setNotice({ type: "success", message: "Document cancelled successfully" });
      await loadRows(fyPeriod, query, pageIndex, pageSize, columnFilters, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to cancel document" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTransactionDocument([deleteTarget.doc_no], docType);
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Document deleted successfully" });
      await loadRows(fyPeriod, query, pageIndex, pageSize, columnFilters, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete document" });
    }
  };


  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>
        <div className="finance-list-actions">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => void loadRows()}>
            <RefreshCw size={15} />
          </Button>
          <Button title={meta.addLabel} onClick={() => setDivisionPicker(true)}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${totalRows.toLocaleString()} Documents`}
          subtitle={`${meta.title} List`}
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search document, account, reference..."
          loading={loading}
          emptyText="No documents found"
          height={620}
          minWidth={1120}
          density="grid"
          enablePagination
          manualPagination
          manualFiltering
          toolbar={
            <div className="finance-list-controls">
              <label className="finance-period-control">
                <span>FY</span>
                <Select value={fyPeriod} onChange={(event) => setFyPeriod(event.target.value)}>
                {fyPeriods.map((period) => <option key={period.fy_period} value={period.fy_period}>{period.fy_period}</option>)}
                </Select>
              </label>
            </div>
          }
          enableExport
          exportFilename={`${meta.title.toLowerCase().replace(/\s+/g, "-")}-${fyPeriod || "documents"}.csv`}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={totalRows}
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters) => {
            setColumnFilters(filters);
            setPageIndex(0);
          }}
          onPageChange={setPageIndex}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPageIndex(0);
          }}
          getRowId={(row, index) => `${row.doc_no}_${index}`}
        />
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-background">
          <JVDocument
            docType={docType}
            editor={editor}
            onClose={() => setEditor(null)}
            onSaved={async (message) => {
              setEditor(null);
              setNotice({ type: "success", message });
              await loadRows(fyPeriod, query, pageIndex, pageSize, columnFilters, false);
            }}
          />
        </div>
      )}

      <Dialog
        open={divisionPicker}
        title="Select Division"
        description="Choose the division before opening the document form."
        onClose={() => setDivisionPicker(false)}
        footer={<Button variant="outline" onClick={() => setDivisionPicker(false)}>Cancel</Button>}
      >
        <div className="grid max-h-[420px] gap-2 overflow-auto">
          {divisions.map((division) => (
            <button
              key={division.div_code}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => openCreateForDivision(division)}
              type="button"
            >
              <span className="font-medium">{division.div_name}</span>
              <span className="text-muted-foreground">{division.div_code}</span>
            </button>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        tone="danger"
        title="Cancel Document"
        description="This will mark the selected document as cancelled."
        actionLabel="Cancel Document"
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancel()}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        tone="danger"
        title="Delete Document"
        description="This action cannot be undone."
        actionLabel="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

function JVDocument({
  docType,
  editor,
  onClose,
  onSaved,
}: {
  docType: TransactionType;
  editor: EditorState;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const editMode = editor?.mode === "edit";
  const [form, setForm] = useState<TransactionHeader>(() => emptyHeader(docType, editor));
  const [selectedDetailId, setSelectedDetailId] = useState<string>("");
  const [childLoading, setChildLoading] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(Boolean(editMode));
  const [saving, setSaving] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [error, setError] = useState("");
  const [showHeaderDetails, setShowHeaderDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadForm() {
      setLoading(true);
      setError("");
      try {
        if (editMode && editor?.mode === "edit") {
          const [headerRaw, detailRaw, childrenRaw] = await Promise.all([
            getTransactionHeader(editor.row.doc_no, docType),
            getTransactionDetail(editor.row.doc_no, editor.row.div_code, docType),
            getTransactionChildren(editor.row.doc_no, editor.row.div_code, docType),
          ]);
          if (!mounted) return;
          // map existing document first
          const mapped = mapExistingDocument(docType, headerRaw, detailRaw, childrenRaw);
          setForm(mapped);
          // for invoice children, fetch outstanding balances and update child rows
          try {
            const updatedChildren = { ...mapped.children } as Record<string, TransactionChildRow[]>;
            await Promise.all(
              Object.entries(updatedChildren).map(async ([detailId, childRows]) => {
                // find corresponding detail to know child_table
                const detail = mapped.detail.find((d) => d.id === detailId);
                if (!detail || detail.child_table !== "invoice") return;
                await Promise.all(
                  childRows.map(async (child, idx) => {
                    const invNo = text((child as Record<string, unknown>).inv_no);
                    if (!invNo) return;
                    try {
                      const resp = await getFinanceOutstanding(mapped.div_code, invNo);
                      const balance = resp?.balances?.[0];
                      if (balance) {
                        childRows[idx] = { ...childRows[idx], inv_amt: balance.original_amount, c_bal_amt_org: balance.outstanding_amount, paid_amt: balance.paid_amount } as TransactionChildRow;
                      }
                    } catch {
                      // ignore individual failures
                    }
                  }),
                );
              }),
            );
            // apply updated children to form
            setForm((current) => ({ ...current, children: updatedChildren }));
          } catch {
            // ignore overall errors
          }
        } else {
          const defaults = await getTransactionDefaultData(docType, false);
          if (!mounted) return;
          setForm((current) => ({
            ...current,
            ac_code: text(defaults.ac_code ?? defaults.Account?.ac_code ?? current.ac_code),
            ac_name: text(defaults.Account?.ac_name ?? current.ac_name),
            curr_code: text(defaults.curr_code ?? defaults.Currency?.curr_code ?? current.curr_code),
            curr_name: text(defaults.Currency?.curr_name ?? current.curr_name),
            ex_rate: Number(defaults.ex_rate ?? current.ex_rate ?? 1),
            bank_ac_code: text(defaults.bank_ac_code ?? defaults.MS_AC_BANKCODE?.ac_code ?? current.bank_ac_code),
            bank_ac_name: text(defaults.bank_ac_name ?? defaults.MS_AC_BANKCODE?.Account?.ac_name ?? defaults.MS_AC_BANKCODE?.ac_name ?? current.bank_ac_name),
          }));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load form");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadForm();
    return () => {
      mounted = false;
    };
  }, [docType, editMode, editor]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      detail: current.detail.map((d) => {
        if (d.tx_compnt_1_expmt !== "S") return d;
        const taxAmt = (Number(d.amount) || 0) * ((Number(d.tx_compnt_perc_1) || 5) / 100);
        return { ...d, tx_compnt_amt_1: taxAmt };
      }),
    }));
  }, [form.detail.map((d) => d.amount).join(",")]);

  const disabled = form.canceled === "Y" || saving;
  const isCancelled = form.canceled === "Y";
  const totalTax = form.detail.reduce((sum, row) => sum + (Number(row.tx_compnt_amt_1) || 0) * row.sign_ind, 0);
  const total = form.detail.reduce((sum, row) => sum + (Number(row.amount) || 0) * row.sign_ind, 0);
  const creditTotal = form.detail.reduce((sum, row) => sum + (row.sign_ind === -1 ? Number(row.amount) || 0 : 0), 0);
  const debitTotal = form.detail.reduce((sum, row) => sum + (row.sign_ind === 1 ? Number(row.amount) || 0 : 0), 0);

  const updateField = (field: keyof TransactionHeader, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateDetail = (id: string, patch: Partial<TransactionDetail>) => {
    setForm((current) => ({
      ...current,
      detail: current.detail.map((row) => row.id === id ? { ...row, ...patch } : row),
    }));
  };

  // REPLACE WITH:
  const selectDetailAccount = async (detail: TransactionDetail, value: string, row: LookupRow | null) => {
    const acName = text(getLookupValue(row || {}, "ac_name"));
    updateDetail(detail.id, { ac_code: value, ac_name: acName, child_table: "", child_code: "" });
    if (docType === "CP") {
      setForm((current) => ({ ...current, ac_payee: acName }));
    }
    if (!value) return;
    setSelectedDetailId(detail.id);
    try {
      const child = await getChildTableName(value);
      const childTable = child?.table || "";
      const childCode = child?.code || "";
      updateDetail(detail.id, { child_table: childTable, child_code: childCode });

      if (childTable === "expense" && childCode) {
        setForm((current) => {
          const updatedDetail = current.detail.find((d) => d.id === detail.id);
          if (!updatedDetail) return current;
          const existingRows = (current.children[detail.id] || []) as TransactionChildRow[];
          const shouldAutoFill =
            existingRows.length === 0 ||
            (existingRows.length === 1 && !text((existingRows[0] as Record<string, unknown>).exp_type_code));
          if (!shouldAutoFill) return current;
          const autoRow: TransactionChildRow = {
            id: newId(),
            dtl_sr_no: 1,
            serial_no: updatedDetail.serial_no,
            doc_no: current.doc_no || "1",
            doc_type: docType,
            div_code: current.div_code,
            doc_date: current.doc_date,
            company_code: updatedDetail.company_code || "",
            ac_code: value,
            sign_ind: updatedDetail.sign_ind,
            amount: 0,
            lcur_amount: 0,
            curr_code: current.curr_code,
            ex_rate: current.ex_rate,
            isEditMode: false,
            exp_type_code: childCode,
            exp_subtype_code: "",
            exp_code: childCode,
            exp_type_description: "",
            job_no: "",
          };
          return {
            ...current,
            children: { ...current.children, [detail.id]: [autoRow] },
          };
        });
      }
    } catch {
      updateDetail(detail.id, { child_table: "", child_code: "" });
    }
  };

  const addDetailRow = () => {
    setForm((current) => ({
      ...current,
      detail: [
        ...current.detail,
        {
          ...emptyDetailRow({
            docType,
            docNo: current.doc_no || "1",
            docDate: current.doc_date,
            divCode: current.div_code,
            currCode: current.curr_code,
            currName: current.curr_name,
            companyCode: user?.company_code,
          }),
          serial_no: current.detail.length + 1,
        },
      ],
    }));
  };

  const removeDetailRow = (id: string) => {
    setForm((current) => ({
      ...current,
      detail: current.detail.filter((row) => row.id !== id).map((row, index) => ({ ...row, serial_no: index + 1 })),
      children: Object.fromEntries(Object.entries(current.children || {}).filter(([key]) => key !== id)),
    }));
    if (selectedDetailId === id) setSelectedDetailId("");
  };

  const selectedDetail = form.detail.find((row) => row.id === selectedDetailId) || form.detail[0];
  const selectedChildren = selectedDetail ? (form.children[selectedDetail.id] as TransactionChildRow[] | undefined) || [] : [];

  const loadChildrenForDetail = async (detail: TransactionDetail) => {
    if (!detail.child_table) return;
    setChildLoading(true);
    setError("");
    try {
      const rows = await getFinanceMasterRows(detail.child_table, {
        code: detail.ac_code,
        extra_param1: form.div_code,
        extra_param2: docType,
        extra_param3: form.doc_no || "1",
        extra_param4: String(detail.serial_no),
      });
      let mapped = rows.map((row, index) => mapChildRow(row, detail, form, docType, user?.company_code || "", index + 1));
      // if invoice child rows, fetch outstanding balances for each invoice and populate amounts
      if (detail.child_table === "invoice") {
        mapped = await Promise.all(
          mapped.map(async (m) => {
            try {
              const invNo = text((m as Record<string, unknown>).inv_no);
              if (!invNo) return m;
              const resp = await getFinanceOutstanding(form.div_code, invNo);
              const balance = resp?.balances?.[0];
              if (balance) {
                return { ...m, inv_amt: balance.original_amount, c_bal_amt_org: balance.outstanding_amount } as TransactionChildRow;
              }
              return m;
            } catch {
              return m;
            }
          }),
        );
      }
      setForm((current) => ({ ...current, children: { ...current.children, [detail.id]: mapped } }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load allocations");
    } finally {
      setChildLoading(false);
    }
  };

  const addChildRow = () => {
    if (!selectedDetail?.child_table) return;
    setForm((current) => {
      const currentRows = ((current.children[selectedDetail.id] || []) as TransactionChildRow[]);
      const nextRows = [
        ...currentRows,
        emptyChildRow(selectedDetail, current, docType, user?.company_code || "", currentRows.length + 1),
      ];
      return { ...current, children: { ...current.children, [selectedDetail.id]: nextRows } };
    });
  };

  const updateChildRow = (childId: string, patch: Partial<TransactionChildRow>) => {
    if (!selectedDetail) return;
    setForm((current) => {
      const rows = ((current.children[selectedDetail.id] || []) as TransactionChildRow[]).map((row) =>
        row.id === childId ? { ...row, ...patch } : row,
      );
      const childTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      return {
        ...current,
        children: { ...current.children, [selectedDetail.id]: rows },
        detail: current.detail.map((d) =>
          d.id === selectedDetail.id ? { ...d, amount: childTotal } : d,
        ),
      };
    });
  };

  const removeChildRow = (childId: string) => {
    if (!selectedDetail) return;
    setForm((current) => {
      const rows = ((current.children[selectedDetail.id] || []) as TransactionChildRow[])
        .filter((row) => row.id !== childId)
        .map((row, index) => ({ ...row, dtl_sr_no: index + 1 }));
      const childTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      return {
        ...current,
        children: { ...current.children, [selectedDetail.id]: rows },
        detail: current.detail.map((d) =>
          d.id === selectedDetail.id ? { ...d, amount: childTotal } : d,
        ),
      };
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.doc_date) return setError("Doc Date is required");
    if (!form.div_code) return setError("Division is required");
    if (!form.curr_code) return setError("Currency is required");
    if (!form.ex_rate) return setError("Exchange Rate is required");
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload(form, docType, user?.company_code || "");
      console.log("detail child_table:", form.detail.map(d => ({ ac: d.ac_code, table: d.child_table, children: form.children[d.id] })));
      const bulkPayload = buildBulkAccountEntryPayload(form, docType, user?.company_code || "", user?.loginid || "");
      console.log("Bulk payload header:", bulkPayload.header);
      await upsertBulkAccountEntryApi(bulkPayload);
      await onSaved(editMode ? "Document updated successfully" : "Document created successfully");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save document");
    } finally {
      setSaving(false);
    }
  };

  const fetchOutstanding = async (invNo: string) => {
    try {
      console.log("fetchOutstanding called", { div: form.div_code, invNo });
      const response = await getFinanceOutstanding(form.div_code, invNo);
      return response as { balances: { inv_no: string; original_amount: number; paid_amount: number; outstanding_amount: number; payment_percentage: number; is_fully_paid: boolean; error?: string }[] };
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to fetch outstanding details");
      return { balances: [] };
    }
  };

  const handleInvNoBlur = (childId: string, invNo: string, parentIdArg?: string) => {
    console.log("handleInvNoBlur called", { childId, invNo, selectedDetailId, parentIdArg });
    if (!invNo) return;
    // prefer provided parent id (from table) else find the parent detail id that contains this child row
    const parentDetailId = parentIdArg || Object.keys(form.children || {}).find((key) => ((form.children as Record<string, TransactionChildRow[]>)[key] || []).some((r) => r.id === childId));
    if (!parentDetailId) {
      console.log("handleInvNoBlur: parent detail not found for child", childId);
      return;
    }
    void fetchOutstanding(invNo).then((data) => {
      const balance = data?.balances?.[0];
      if (!balance) return;
      setForm((current) => {
        const rows = ((current.children[parentDetailId] || []) as TransactionChildRow[]).map((row) =>
          row.id === childId
            ? { ...row, inv_amt: balance.original_amount, c_bal_amt_org: balance.outstanding_amount }
            : row,
        );
        return { ...current, children: { ...current.children, [parentDetailId]: rows } };
      });
    });
  };
  const isBalanced =
    Number(creditTotal.toFixed(3)) ===
    Number(debitTotal.toFixed(3));
  console.log({
    disabled,
    loading,
    detailLength: form.detail.length,
    creditTotal,
    debitTotal,
  });

  return (
 <form className="payment-workbench grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]" onSubmit={submit}>
      <CardHeader className="border-b bg-primary px-5 py-2.5 text-primary-foreground shadow-sm">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                {editMode ? "Edit Document" : "New Document"}
              </p>
              <h2 className="m-0 text-lg font-semibold leading-tight text-primary-foreground">{DOCUMENT_META[docType].title}</h2>
            </div>
            <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Doc No</span>
              <strong className="block text-sm leading-tight text-primary-foreground">{form.doc_no || "New"}</strong>
            </div>
            <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Total</span>
              <strong className="block text-sm leading-tight text-primary-foreground">{formatAmount(total)}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {form.canceled === "Y" && <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">Cancelled</Badge>}
            <Button type="button" variant="secondary" onClick={() => setAttachmentOpen(true)}>
              <Paperclip size={15} /> Files
            </Button>
            <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={onClose}><X size={16} /></Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 overflow-auto p-3">
        {loading ? (
          <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading voucher...</div>
        ) : (
          <div className="shrink-0 border-b bg-background ">
            <AutoDismissAlert notice={error ? { type: "error", message: error } : null} onClose={() => setError("")} />

            <div className="commercial-header-shell rounded-md border bg-card">
              <div className="commercial-section-title">
                <div>
                  <p className="eyebrow m-0">Header</p>
                   <h3 className="m-0 text-sm font-semibold leading-tight">RJV Information</h3>
                </div>
                <span></span>
              </div>
              <div className={`commercial-header-panel payment-header-grid relative grid grid-cols-4 gap-2.5 p-3 max-2xl:grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 ${showHeaderDetails ? "is-expanded" : "is-collapsed"}`}>
                {editMode && (
                  <Field label="Doc No"><Input disabled value={form.doc_no || ""} /></Field>
                )}
                <Field label="Doc Date"><Input disabled={disabled} required type="date" value={dateInput(form.doc_date)} onChange={(event) => updateField("doc_date", event.target.value)} /></Field>
                <LookupField
                  label="Division"
                  value={form.div_code}
                  displayValue={form.div_name ? `${form.div_code} - ${form.div_name}` : form.div_code}
                  columns={[{ field: "div_code", header: "Code" }, { field: "div_name", header: "Name" }]}
                  valueField="div_code"
                  displayFields={["div_code", "div_name"]}
                  loadOptions={() => getDynamicLookup({ parameter: "Account_division", code1: user?.company_code, loginid: user?.loginid || user?.username || "ADMIN" })}
                  disabled={disabled}
                  onChange={async (value, row) => {
                    setForm((current) => ({ ...current, div_code: value, div_name: text(getLookupValue(row || {}, "div_name")) }));
                  }}
                />
                <LookupField
                  label="Currency"  
                  value={form.curr_code}
                  displayValue={form.curr_name ? `${form.curr_code} - ${form.curr_name}` : form.curr_code}
                  columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                  valueField="curr_code"
                  displayFields={["curr_code", "curr_name"]}
                  loadOptions={getCurrencyRows}
                  disabled={disabled}
                  onChange={(value, row) => setForm((current) => ({ ...current, curr_code: value, curr_name: text(getLookupValue(row || {}, "curr_name")), ex_rate: Number(row?.ex_rate ?? 1) }))}
                />
                <Field label="Exchange Rate"><Input disabled={disabled} required type="number" style={{ textAlign: "right" }} step="0.0001" value={Number.isFinite(form.ex_rate) ? form.ex_rate.toFixed(6) : ""} onChange={(event) => updateField("ex_rate", Number(event.target.value || 1))} /></Field>
                <label className="field col-span-2 max-md:col-span-1">
                  <span>Remarks</span>
                  <Input disabled={disabled} value={form.remarks || ""} onChange={(event) => updateField("remarks", event.target.value)} />
                </label>
              </div>
              <div className="commercial-header-footer flex items-center justify-between gap-3 border-t bg-secondary/30 px-3 py-2">
                <div className="min-w-0 truncate text-xs text-muted-foreground">
                  <span>Doc: {form.doc_no || "-"}</span>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowHeaderDetails((value) => !value)}>
                  {showHeaderDetails ? "Hide Details" : "Show Details"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-card">
              <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-2">
                <div>
                  <p className="eyebrow">Details</p>
                  <h3 className="m-0 text-sm font-semibold">Reverse Jv Lines</h3>
                </div>
                <Button size="sm" type="button" variant="outline" onClick={addDetailRow} disabled={disabled}>
                  <Plus size={14} /> Add Line
                </Button>
              </div>
              <div className="commercial-lines-scroll max-h-[43vh] overflow-auto">
                <table className="finance-lines-table w-full min-w-[2000px] text-sm">
                  <thead className="sticky top-0 bg-primary text-xs text-primary-foreground">
                    <tr>
                      <th className="finance-sticky-col finance-col-no px-2 py-2 text-left">No</th>
                      <th className="finance-sticky-col finance-col-div px-2 py-2 text-left">Division</th>
                      <th className="finance-sticky-col finance-col-account px-2 py-2 text-left">Account</th>
                      <th className="px-2 py-2 text-left">Select</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Currency</th>
                      <th className="px-2 py-2 text-left">Ex Rate</th>
                      <th className="finance-amount-cell px-2 py-2 text-left">Amount</th>
                      <th className="px-2 py-2 text-left">Cr/Dr</th>
                      <th className="px-2 py-2 text-left">Tax Type</th>
                      <th className="px-2 py-2 text-left">Job No</th>
                      <th className="px-2 py-2 text-left">Dept</th>
                      <th className="finance-amount-cell px-2 py-2 text-left">Base Amount</th>
                      <th className="px-2 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.detail.length === 0 ? (
                      <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={13}>No detail lines yet</td></tr>
                    ) : form.detail.map((detail) => (
                      <tr className={selectedDetail?.id === detail.id ? "border-t bg-primary/5" : "border-t odd:bg-muted/20"} key={detail.id}>
                        <td className="finance-sticky-col finance-col-no px-2 py-1 text-xs">{detail.serial_no}</td>
                        <td className="finance-sticky-col finance-col-div w-32 px-2 py-1"><Input disabled value={detail.div_code || form.div_code} /></td>
                        <td className="finance-sticky-col finance-col-account finance-account-cell w-[430px] px-2 py-1">
                          <LookupField
                            label="Detail Account"
                            compact
                            placeholder="A/c code"
                            value={detail.ac_code}
                            displayValue={detail.ac_name ? `${detail.ac_code} - ${detail.ac_name}` : detail.ac_code}
                            columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "curr_code", header: "Currency" }]}
                            valueField="ac_code"
                            displayFields={["ac_code", "ac_name", "curr_code"]}
                            loadOptions={() => getDynamicLookup({
                              parameter: "Account_AC_CODE_Serach_HDR",
                              code1: user?.company_code,
                              code2: "D",
                              code3: form.doc_type,
                              code4: form.div_code
                            })}
                            disabled={disabled}
                            onChange={(value, row) => void selectDetailAccount(detail, value, row)}
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input
                            checked={selectedDetail?.id === detail.id}
                            className="h-4 w-4 accent-[var(--primary)]"
                            disabled={!detail.ac_code}
                            onChange={() => setSelectedDetailId(detail.id)}
                            type="radio"
                          />
                        </td>
                        <td className="w-[220px] px-2 py-1"><Input disabled={disabled} value={detail.remarks || ""} onChange={(event) => updateDetail(detail.id, { remarks: event.target.value })} /></td>
                        <td className="w-[210px] px-2 py-1">
                          <LookupField
                            label="Currency"
                            compact
                            placeholder="Currency"
                            value={detail.curr_code || form.curr_code}
                            displayValue={detail.curr_name ? `${detail.curr_code} - ${detail.curr_name}` : detail.curr_code || form.curr_code}
                            columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                            valueField="curr_code"
                            displayFields={["curr_code", "curr_name"]}
                            loadOptions={() => getDynamicLookup({
                              parameter: "Account_Currency_CODE_Serach",
                              code1: user?.company_code,
                              loginid: user?.loginid || user?.username || "ADMIN"
                            })}
                            disabled={disabled}
                            onChange={(value, row) => updateDetail(detail.id, { curr_code: value, curr_name: text(getLookupValue(row || {}, "curr_name")), ex_rate: Number(row?.ex_rate ?? form.ex_rate ?? 1) })}
                          />
                        </td>
                        <td className="w-28 px-2 py-1"><Input className="finance-money-input" disabled={disabled} type="number" step="0.0001" value={Number.isFinite(detail.ex_rate) ? detail.ex_rate.toFixed(6) : ""} onChange={(event) => updateDetail(detail.id, { ex_rate: Number(event.target.value || 1) })} /></td>
                        <td className="finance-amount-cell w-36 px-2 py-1"><Input className="finance-money-input" disabled={disabled} type="number" step="0.001" value={detail.amount} onChange={(event) => updateDetail(detail.id, { amount: Number(event.target.value || 0) })} /></td>
                        <td className="w-28 px-2 py-1">
                          <Select className="h-9" disabled={disabled} value={detail.sign_ind} onChange={(event) => updateDetail(detail.id, { sign_ind: Number(event.target.value) as 1 | -1 })}>
                            <option value={1}>Dr</option>
                            <option value={-1}>Cr</option>
                          </Select>
                        </td>
                        <td className="w-28 px-2 py-1">
                          <Select
                            disabled={disabled}
                            value={detail.tx_compnt_1_expmt || "N"}
                            onChange={(event) => {
                              const taxType = event.target.value;
                              const taxPerc = taxType === "S" ? 5 : 0;
                              const taxAmt = taxType === "S" ? (Number(detail.amount) || 0) * (taxPerc / 100) : 0;
                              updateDetail(detail.id, {
                                tx_compnt_1_expmt: taxType,
                                tx_compnt_perc_1: taxPerc,
                                tx_compnt_amt_1: taxAmt,
                              });
                            }}
                          >
                            <option value="N">No Tax</option>
                            <option value="S">Std Tax</option>
                            <option value="Z">Zero</option>
                            <option value="E">Exempt</option>
                          </Select>
                        </td>
                        <td className="w-32 px-2 py-1"><Input disabled={disabled} value={detail.job_no || ""} onChange={(event) => updateDetail(detail.id, { job_no: event.target.value })} /></td>
                        <td className="w-28 px-2 py-1"><Input disabled={disabled} value={detail.dept_code || ""} onChange={(event) => updateDetail(detail.id, { dept_code: event.target.value })} /></td>
                        <td className="finance-amount-cell w-36 px-2 py-1"><Input className="finance-money-input" disabled value={(Number(detail.amount || 0) * Number(detail.ex_rate || form.ex_rate || 1) * Number(detail.sign_ind || 1))} /></td>
                        <td className="px-2 py-1"><Button disabled={disabled} size="icon" type="button" variant="ghost" onClick={() => removeDetailRow(detail.id)}><X size={14} /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
                <span className="text-muted-foreground">Balance</span>
                <strong className={Math.abs(total) > 0.001 ? "text-destructive" : "text-emerald-600"}>
                  {formatAmount(total)}
                </strong>

              </div>
              <div className="flex items-center justify-end gap-8  px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">Tax</span>
                <strong className={total < 0 ? "text-destructive" : "text-emerald-600"}>{formatAmount(totalTax)}</strong>
              </div>
              <div className="flex items-center justify-end gap-8 border-t px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">Net Total</span>
                <strong className={total < 0 ? "text-destructive" : "text-emerald-600"}>{(formatAmount(total + totalTax))}</strong>
              </div>
            </div>
            <div className="rounded-md border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-3 py-1.5">
                <div>
                  <p className="eyebrow m-0">Allocations</p>
                  <h3 className="m-0 text-sm font-semibold leading-tight">
                    {selectedDetail?.child_table ? `${titleCase(selectedDetail.child_table)} Allocation` : "Select a detail account"}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    className="w-56"
                    value={selectedDetail?.id || ""}
                    onChange={(event) => setSelectedDetailId(event.target.value)}
                  >
                    {form.detail.map((detail) => (
                      <option key={detail.id} value={detail.id}>
                        {detail.serial_no}. {detail.ac_code || "No account"} {detail.child_table ? `- ${detail.child_table}` : ""}
                      </option>
                    ))}
                  </Select>
                  {selectedDetail?.child_table === "invoice" && (
                    <Button disabled={disabled || childLoading} size="sm" type="button" variant="outline" onClick={() => selectedDetail && void loadChildrenForDetail(selectedDetail)}>
                      <RefreshCw size={14} /> Load
                    </Button>
                  )}
                  <Button disabled={disabled || !selectedDetail?.child_table} size="sm" type="button" variant="outline" onClick={addChildRow}>
                    <Plus size={14} /> Add
                  </Button>
                </div>
              </div>
              <ChildAllocationTable
                childTable={selectedDetail?.child_table || ""}
                parentId={selectedDetail?.id}
                disabled={disabled}
                loading={childLoading}
                rows={selectedChildren}
                onChange={updateChildRow}
                onRemove={removeChildRow}
                onInvNoBlur={handleInvNoBlur}
              />
            </div>
          </div>
        )}
      </CardContent>

      <div className="flex items-center justify-between gap-3 border-t bg-secondary/60 px-4 py-2">
        <div className="text-sm text-muted-foreground">
          Total Amount <strong className={total < 0 ? "text-destructive" : "text-emerald-600"}>{formatAmount(total)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={saving} type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={disabled || loading || form.detail.length === 0 || !isBalanced} type="submit">
            <Save size={15} /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <AttachmentDialog
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        requestNumber={form.doc_no || ""}
        title={`${DOCUMENT_META[docType].title} Attachments`}
        module={docType}
        type={DOCUMENT_META[docType].title}
        companyCode={user?.company_code || ""}
        loginId={user?.loginid || user?.username || ""}
        flowLevel={2}
        readOnly={form.canceled === "Y"}
      />
    </form>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  actionLabel,
  tone,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  tone?: "default" | "danger";
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      compact
      open={open}
      tone={tone}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant={tone === "danger" ? "destructive" : "default"} onClick={onConfirm}>{actionLabel}</Button>
        </>
      }
    >
      <p className="m-0 text-sm text-muted-foreground">Please confirm to continue.</p>
    </Dialog>
  );
}

function ChildAllocationTable({
  childTable,
  rows,
  loading,
  disabled,
  onChange,
  onRemove,
  onInvNoBlur,
  parentId,
}: {
  childTable: TransactionDetail["child_table"];
  rows: TransactionChildRow[];
  loading: boolean;
  disabled: boolean;
  onChange: (id: string, patch: Partial<TransactionChildRow>) => void;
  onRemove: (id: string) => void;
  onInvNoBlur?: (childId: string, invNo: string, parentId?: string) => void;
  parentId?: string;

}) {
  if (!childTable) {
    return <div className="grid min-h-[120px] place-items-center p-6 text-center text-sm text-muted-foreground">This detail account has no allocation table.</div>;
  }

  const headers =
    childTable === "invoice"
      ? ["No", "Invoice", "Invoice Date", "Invoice Amount", "Outstanding", "Amount", "Paid Amount", "Action"]
      : childTable === "job"
        ? ["No", "Job No", "Doc Ref", "Doc Ref 2", "Amount", "Action"]
        : ["No", "Expense Type Code ", "Expense Subtype Code", "Description", "Job No", "Amount", "Action"];

  const user = useAuth()

  return (
    <div className="max-h-[31vh] overflow-auto">
      <table className="w-full min-w-[1180px] text-sm">
        <thead className="sticky top-0 bg-primary text-xs text-primary-foreground">
          <tr>{headers.map((header) => <th className="px-2 py-2 text-left" key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={headers.length}>Loading allocations...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={headers.length}>No allocation rows</td></tr>
          ) : rows.map((row) => (
            <tr className="border-t" key={row.id}>
              <td className="px-2 py-1 text-xs">{row.dtl_sr_no}</td>
              {childTable === "invoice" ? (
                <>
                  <td className="px-2 py-1">
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                      disabled={disabled}
                      value={text(row.inv_no)}
                      onChange={(event) => onChange(row.id, { inv_no: event.target.value })}
                      onBlur={(event) => {
                        console.log("ChildAllocationTable onBlur", { childId: row.id, parentId, value: event.target.value });
                        onInvNoBlur?.(row.id, event.target.value, parentId);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input disabled={disabled} type="date" value={dateInput(row.inv_date)} onChange={(event) => onChange(row.id, { inv_date: event.target.value })} />
                  </td>
                  <td className="px-2 py-1"><Input disabled value={text(row.inv_amt)} /></td>
                  <td className="px-2 py-1"><Input disabled value={text(row.c_bal_amt_org)} /></td>
                  <td className="w-32 px-2 py-1">
                    <div className="flex flex-col gap-1">
                      <Input
                        disabled={disabled}
                        type="number"
                        step="0.001"
                        value={Number(row.amount || 0)}
                        onChange={(event) =>
                          onChange(row.id, {
                            amount: Number(event.target.value || 0),
                          })
                        }
                        color={
                          Number(row.amount || 0) > Number(row.c_bal_amt_org || 0)
                            ? "danger"
                            : "neutral"
                        }
                      />

                      {Number(row.amount || 0) > Number(row.c_bal_amt_org || 0) && (
                        <span className="text-xs text-red-500">
                          Amount exceeds available balance
                        </span>
                      )}
                    </div>
                  </td>
                </>
              ) : childTable === "job" ? (
                <>
                  <td className="px-2 py-1">
                    <LookupField
                      label="Job No"
                      compact
                      placeholder="Job No"
                      value={text(row.job_no)}
                      displayValue={text(row.job_no)}
                      columns={[{ field: "job_no", header: "Job No" }, { field: "job_date", header: "Job Date" }, { field: "confrim_date", header: "Confirm Date" }, { field: "prin_code", header: "Principal Code" }]}
                      valueField="job_no"
                      displayFields={["job_no", "job_date", "confrim_date", "prin_code"]}
                      loadOptions={() => getDynamicLookup({
                        parameter: "AC_BP_BR_TR_TI_JOBDETAIL",
                        loginid: user?.user?.loginid ?? "",
                        code1: user?.user?.company_code ?? "",
                      })}
                      disabled={disabled}
                      onChange={(value) => onChange(row.id, { job_no: value })}
                    />
                  </td>
                  <td className="px-2 py-1"><Input disabled={disabled} value={text(row.doc_refno)} onChange={(event) => onChange(row.id, { doc_refno: event.target.value })} /></td>
                  <td className="px-2 py-1"><Input disabled={disabled} value={text(row.doc_refno_2)} onChange={(event) => onChange(row.id, { doc_refno_2: event.target.value })} /></td>
                </>
              ) : (
                <>
                  <td className="px-2 py-1">
                    <LookupField
                      label="Expense type"
                      compact
                      placeholder="Expense type"
                      value={text(row.exp_type_code)}
                      displayValue={
                        text(row.exp_type_code)
                          ? `${row.exp_type_code} - ${row.exp_type_description}`
                          : ""
                      }
                      columns={[
                        { field: "exp_type_code", header: "Expense Type Code" },
                        { field: "exp_description", header: "Expense Type Description" }
                      ]}
                      valueField="exp_type_code"
                      displayFields={["exp_type_code", "exp_type_description"]}
                      loadOptions={() =>
                        getDynamicLookup({
                          parameter: "AC_BP_BR_EXP_TYPE_CODE",
                          loginid: user?.user?.loginid ?? "",
                          code1: user?.user?.company_code ?? "",
                        })
                      }
                      disabled={disabled}
                      onChange={(value, lookupRow) =>
                        onChange(row.id, {
                          exp_type_code: value,
                          exp_type_description: value
                            ? text(getLookupValue(lookupRow || {}, "exp_type_description"))
                            : "",
                          exp_subtype_code: "",
                          exp_subtype_description: "",
                        })
                      }
                    />
                  </td>

                  <td className="px-2 py-1">
                    <LookupField
                      key={`subtype-${row.id}-${row.exp_type_code || "none"}`}
                      label="Expense subtype"
                      compact
                      placeholder="Expense subtype"
                      value={text(row.exp_subtype_description)}
                      displayValue={
                        text(row.exp_subtype_code)
                          ? `${row.exp_subtype_code} - ${row.exp_subtype_description}`
                          : ""
                      }
                      columns={[
                        { field: "exp_subtype_code", header: "Expense Subtype Code" },
                        {
                          field: "exp_subtype_description",
                          header: "Expense Subtype Description"
                        }
                      ]}
                      valueField="exp_subtype_code"
                      displayFields={[
                        "exp_subtype_code",
                        "exp_subtype_description"
                      ]}
                      loadOptions={() => {
                        const currentExpType = text(row.exp_type_code);
                        if (!currentExpType) return Promise.resolve([]);
                        return getDynamicLookup({
                          parameter: "AC_BP_BR_EXP_SUBTYPE_CODE",
                          loginid: user?.user?.loginid ?? "",
                          code1: user?.user?.company_code ?? "",
                          code2: currentExpType,
                        });
                      }}
                      disabled={disabled || !row.exp_type_code}
                      onChange={(value, lookupRow) =>
                        onChange(row.id, {
                          exp_subtype_code: value,
                          exp_subtype_description: value
                            ? text(
                              getLookupValue(
                                lookupRow || {},
                                "exp_subtype_description"
                              )
                            )
                            : "",
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1"><Input disabled={disabled} value={text(row.exp_description)} onChange={(event) => onChange(row.id, { exp_description: event.target.value })} /></td>

                  <td className="px-2 py-1"><Input disabled={disabled} value={text(row.job_no)} onChange={(event) => onChange(row.id, { job_no: event.target.value })} /></td>
                </>
              )}

              {childTable !== "invoice" && <td className="w-32 px-2 py-1"><Input disabled={disabled} type="number" step="0.001" value={Number(row.amount || 0)} onChange={(event) => onChange(row.id, { amount: Number(event.target.value || 0) })} /></td>}
              {childTable === "invoice" && <td className="w-32 px-2 py-1"><Input disabled value={Number(row.paid_amt || 0)} /></td>}
              <td className="px-2 py-1"><Button disabled={disabled} size="icon" type="button" variant="ghost" onClick={() => onRemove(row.id)}><X size={14} /></Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function emptyHeader(docType: TransactionType, editor: EditorState): TransactionHeader {
  return {
    doc_type: docType,
    doc_no: editor?.mode === "edit" ? editor.row.doc_no : undefined,
    doc_date: today(),
    ac_code: "",
    curr_code: "",
    ex_rate: 1,
    div_code: editor?.mode === "create" ? editor.divCode || "" : "",
    div_name: editor?.mode === "create" ? editor.divName || "" : "",
    remarks: "",
    cheque_date: docType === "CR" ? undefined : today(),
    detail: [],
    children: {},
    ...(docType === "CP" ? { ac_payee: "", files: [] } : {}),
  };
}

function emptyDetailRow({
  docType,
  docNo,
  docDate,
  divCode,
  currCode,
  currName,
  companyCode,
}: {
  docType: TransactionType;
  docNo: string;
  docDate: string;
  divCode: string;
  currCode: string;
  currName?: string;
  companyCode?: string;
}): TransactionDetail {
  return {
    id: newId(),
    isEditMode: false,
    serial_no: 1,
    doc_no: docNo,
    doc_type: docType,
    div_code: divCode,
    doc_date: docDate,
    company_code: companyCode,
    ac_code: "",
    ac_name: "",
    remarks: "",
    curr_code: currCode,
    curr_name: currName || "",
    ex_rate: 1,
    amount: 0,
    sign_ind: docType === "CP" ? 1 : -1,
    tx_compntcat_code_1: "11100",
    tx_cat_code: "",
    tx_compnt_1_expmt: "N",
    tx_compnt_lcuramt_1: null,
    tx_compnt_perc_1: null,
    tx_compnt_amt_1: null,
    job_no: "",
    dept_code: "",
    child_table: "",
    child_code: "",
  };
}

function emptyChildRow(
  detail: TransactionDetail,
  form: TransactionHeader,
  docType: TransactionType,
  companyCode: string,
  dtlSrNo: number,
): TransactionChildRow {
  return {
    id: newId(),
    dtl_sr_no: dtlSrNo,
    serial_no: detail.serial_no,
    doc_no: form.doc_no || "1",
    doc_type: docType,
    div_code: form.div_code,
    doc_date: form.doc_date,
    company_code: companyCode,
    ac_code: detail.ac_code,
    sign_ind: detail.sign_ind,
    amount: 0,
    lcur_amount: 0,
    curr_code: form.curr_code,
    ex_rate: form.ex_rate,
    isEditMode: false,
    ...(detail.child_table === "invoice"
      ? { inv_no: "", inv_date: "", inv_amt: null, c_bal_amt_org: null, c_curr_amt: null, IsDeletable: true }
      : detail.child_table === "job"
        ? { job_no: "", doc_refno: "", doc_refno_2: "" }
        : { exp_type_code: detail.child_code || "", exp_subtype_code: "", exp_code: "", exp_description: "", job_no: "" }),
  };
}

function mapChildRow(
  raw: Record<string, unknown>,
  detail: TransactionDetail,
  form: TransactionHeader,
  docType: TransactionType,
  companyCode: string,
  fallbackSrNo: number,
): TransactionChildRow {
  const row = lowerRecord(raw);
  return {
    ...row,
    id: newId(),
    dtl_sr_no: Number(row.dtl_sr_no || fallbackSrNo),
    serial_no: detail.serial_no,
    doc_no: text(row.doc_no || form.doc_no || "1"),
    doc_type: docType,
    div_code: text(row.div_code || form.div_code),
    doc_date: dateInput(row.doc_date || form.doc_date),
    company_code: text(row.company_code || companyCode),
    ac_code: text(row.ac_code || detail.ac_code),
    sign_ind: Number(row.sign_ind || detail.sign_ind) as 1 | -1,
    amount: Math.abs(Number(row.amount || 0)),
    lcur_amount: Number(row.lcur_amount || row.amount || 0),
    curr_code: text(row.curr_code || form.curr_code),
    ex_rate: Number(row.ex_rate || form.ex_rate || 1),
    isEditMode: Boolean(row.dtl_sr_no),
    IsDeletable: Boolean(row.isdeletable ?? row.IsDeletable),
  };
}

function inferChildTable(
  serialNo: number,
  childrenRaw: { invoice?: Record<string, unknown>[]; job?: Record<string, unknown>[]; expense?: Record<string, unknown>[] },
): "invoice" | "job" | "expense" | "" {
  if ((childrenRaw.invoice || []).some((row) => Number(lowerRecord(row).serial_no) === serialNo)) return "invoice";
  if ((childrenRaw.job || []).some((row) => Number(lowerRecord(row).serial_no) === serialNo)) return "job";
  if ((childrenRaw.expense || []).some((row) => Number(lowerRecord(row).serial_no) === serialNo)) return "expense";
  return "";
}

function mapExistingDocument(
  docType: TransactionType,
  headerRaw: Record<string, unknown>,
  detailRaw: Record<string, unknown>[],
  childrenRaw: { invoice?: Record<string, unknown>[]; job?: Record<string, unknown>[]; expense?: Record<string, unknown>[] } = {},
): TransactionHeader {
  const header = lowerRecord(headerRaw);
  const detail = detailRaw.map((raw, index) => {
    const row = lowerRecord(raw);
    const serialNo = Number(row.serial_no || index + 1);
    const table = inferChildTable(serialNo, childrenRaw);
    return {
      id: newId(),
      isEditMode: true,
      company_code: text(row.company_code),
      doc_type: docType,
      doc_no: text(row.doc_no),
      serial_no: serialNo,
      doc_date: dateInput(row.doc_date),
      ac_code: text(row.ac_code),
      ac_name: text(nested(raw, ["Account", "ac_name"]) ?? row.ac_name),
      remarks: text(row.remarks),
      curr_code: text(row.curr_code),
      curr_name: text(nested(raw, ["Currency", "curr_name"]) ?? row.curr_name),
      ex_rate: Number(row.ex_rate || 1),
      amount: Math.abs(Number(row.amount || 0)),
      sign_ind: Number(row.sign_ind || (docType === "BP" || docType === "CP" ? 1 : -1)) as 1 | -1,
      div_code: text(row.div_code),
      tx_compntcat_code_1: text(row.tx_compntcat_code_1),
      tx_cat_code: text(row.tx_cat_code),
      tx_compnt_1_expmt: text(row.tx_compnt_1_expmt),
      tx_compnt_lcuramt_1: numberOrNull(row.tx_compnt_lcuramt_1),
      tx_compnt_perc_1: numberOrNull(row.tx_compnt_perc_1),
      tx_compnt_amt_1: numberOrNull(row.tx_compnt_amt_1),
      job_no: text(row.job_no),
      dept_code: text(row.dept_code),
      dept_name: text(nested(raw, ["Department", "dept_name"]) ?? row.dept_name),
      lcur_amount: Number(row.lcur_amount || 0),
      child_table: table,
      child_code: "",
    } satisfies TransactionDetail;
  });
  const children = Object.fromEntries(
    detail.map((line) => [
      line.id,
      line.child_table
        ? ((childrenRaw[line.child_table] || [])
          .filter((child) => Number(lowerRecord(child).serial_no) === line.serial_no)
          .map((child, index) => mapChildRow(child, line, {
            doc_type: docType,
            doc_no: text(header.doc_no),
            doc_date: dateInput(header.doc_date),
            ac_code: text(header.ac_code),
            curr_code: text(header.curr_code),
            ex_rate: Number(header.ex_rate || 1),
            div_code: text(header.div_code),
            detail: [],
            children: {},
          } as TransactionHeader, docType, text(header.company_code), index + 1)))
        : [],
    ]),
  );

  return {
    doc_type: docType,
    doc_no: text(header.doc_no),
    doc_date: dateInput(header.doc_date),
    ac_code: text(header.ac_code),
    ac_name: text(nested(headerRaw, ["Account", "ac_name"]) ?? header.ac_name),
    bank_ac_code: text(header.bank_ac_code),
    bank_ac_name: text(nested(headerRaw, ["MS_AC_BANKCODE", "Account", "ac_name"]) ?? header.bank_ac_name),
    curr_code: text(header.curr_code),
    curr_name: text(nested(headerRaw, ["Currency", "curr_name"]) ?? header.curr_name),
    ex_rate: Number(header.ex_rate || 1),
    div_code: text(header.div_code),
    div_name: text(nested(headerRaw, ["Division", "div_name"]) ?? header.div_name),
    remarks: text(header.remarks),
    cheque_no: text(header.cheque_no),
    cheque_date: dateInput(header.cheque_date),
    cheque_bank: text(header.cheque_bank),
    ac_payee: text(header.ac_payee),
    canceled: text(header.canceled),
    detail,
    children,
  };
}

function buildPayload(form: TransactionHeader, docType: TransactionType, companyCode: string): TransactionHeader {
  const base: TransactionHeader = {
    ...form,
    doc_type: docType,
    ex_rate: Number(form.ex_rate || 1),
    detail: form.detail.map((row, index) => {
      const detail = {
        company_code: row.company_code || companyCode,
        doc_type: docType,
        doc_no: form.doc_no || row.doc_no || "1",
        serial_no: row.serial_no || index + 1,
        doc_date: form.doc_date,
        ac_code: row.ac_code,
        remarks: row.remarks || "",
        curr_code: form.curr_code,
        ex_rate: Number(row.ex_rate || form.ex_rate || 1),
        amount: Math.abs(Number(row.amount || 0)),
        sign_ind: row.sign_ind,
        tx_compntcat_code_1: row.tx_compntcat_code_1 || "11100",
        tx_compnt_1_expmt: row.tx_compnt_1_expmt || "N",
        tx_compnt_perc_1: row.tx_compnt_perc_1 ?? null,
        tx_compnt_amt_1: row.tx_compnt_amt_1 ?? null,
        tx_compnt_lcuramt_1: row.tx_compnt_lcuramt_1 ?? null,
        tx_cat_code: row.tx_cat_code || "",
        job_no: row.job_no || "",
        dept_code: row.dept_code || "",
        div_code: form.div_code,
        lcur_amount: Math.abs(Number(row.amount || 0)) * Number(row.ex_rate || form.ex_rate || 1) * Number(row.sign_ind || 1),
      };
      return detail as TransactionDetail;
    }),
    children: groupChildren(form),
  };

  delete (base as Record<string, unknown>).ac_name;
  delete (base as Record<string, unknown>).curr_name;
  delete (base as Record<string, unknown>).div_name;
  delete (base as Record<string, unknown>).bank_ac_name;

  if (docType !== "BP" && docType !== "CP") {
    delete base.ac_payee;
    delete base.files;
  }

  if (docType === "CR" || docType === "CP") {
    delete base.bank_ac_code;
    delete base.cheque_no;
    delete base.cheque_date;
    delete base.cheque_bank;
  }

  return base;
}

function buildBulkAccountEntryPayload(originalForm: TransactionHeader, docType: TransactionType, companyCode: string, loginid: string) {
  const docNo = originalForm.doc_no || "0";
  const header = {
    ...originalForm,
    company_code: companyCode,
    doc_type: docType,
    doc_no: docNo,
    create_user: loginid,
    edit_user: loginid,
    canceled: originalForm.canceled || "N",
    last_dtl_serial_no: originalForm.detail.length,
    sys_gen: "N",
  };
  // ensure ac_payee is explicitly preserved in the header
  (header as Record<string, unknown>).ac_payee = originalForm.ac_payee ?? (header as Record<string, unknown>).ac_payee ?? "";
  delete (header as Record<string, unknown>).detail;
  delete (header as Record<string, unknown>).children;

  const details = originalForm.detail.map((row, index) => ({
    ...row,
    company_code: row.company_code || companyCode,
    sign_ind: row.sign_ind,
    doc_type: docType,
    doc_no: docNo,
    serial_no: row.serial_no || index + 1,
    doc_date: originalForm.doc_date,
    header_ac_code: originalForm.ac_code,
    curr_code: row.curr_code || originalForm.curr_code,
    ex_rate: Number(row.ex_rate || originalForm.ex_rate || 1),
    lcur_amount: Number(row.lcur_amount ?? Math.abs(Number(row.amount || 0)) * Number(row.ex_rate || originalForm.ex_rate || 1) * Number(row.sign_ind || 1)),
    div_code: row.div_code || originalForm.div_code,
  }));

  const children = groupChildren(originalForm);
  return {
    header,
    details,
    invoiceDetails: children.invoice,
    expenseDetails: children.expense,
    jobDetails: children.job,
    loginid,
  };
}

function groupChildren(form: TransactionHeader) {
  console.log("=== groupChildren ===");
  console.log("detail ids:", form.detail.map(d => d.id));
  console.log("children keys:", Object.keys(form.children || {}));
  console.log("match check:", form.detail.map(d => ({ id: d.id, hasChildren: !!form.children?.[d.id] })));

  const grouped: Record<"invoice" | "job" | "expense", Record<string, unknown>[]> = {
    invoice: [],
    job: [],
    expense: [],
  };

  form.detail.forEach((detail) => {
    console.log("detail.child_table:", detail.child_table);
    if (!detail.child_table || !["invoice", "job", "expense"].includes(detail.child_table)) return;
    const table = detail.child_table as "invoice" | "job" | "expense";
    const rows = (form.children?.[detail.id] || []) as TransactionChildRow[];
    rows.forEach((row) => {
      if (table === "invoice" && Number(row.amount || 0) === 0) return;
      const cleaned: Record<string, unknown> = { ...row };
      delete cleaned.id;
      delete cleaned.isEditMode;
      delete cleaned.isSelected;
      delete cleaned.curr_name;
      delete cleaned.c_curr_name_orgin;
      delete cleaned.exp_description;
      delete cleaned.exp_subtype_description;
      cleaned.doc_type = form.doc_type;
      cleaned.doc_no = form.doc_no || cleaned.doc_no || "1";
      cleaned.serial_no = detail.serial_no;
      cleaned.dtl_sr_no = Number(cleaned.dtl_sr_no || grouped[table].length + 1);
      cleaned.doc_date = form.doc_date;
      cleaned.div_code = form.div_code;
      cleaned.ac_code = detail.ac_code;
      cleaned.sign_ind = detail.sign_ind;
      cleaned.curr_code = cleaned.curr_code || form.curr_code;
      cleaned.ex_rate = Number(cleaned.ex_rate || form.ex_rate || 1);
      cleaned.amount = Number(cleaned.amount || 0);
      cleaned.lcur_amount = Math.abs(Number(cleaned.amount || 0)) * Number(cleaned.ex_rate || 1) * Number(detail.sign_ind || 1);
      grouped[table].push(cleaned);
    });
  });

  return grouped;
}

async function getCurrencyRows(): Promise<LookupRow[]> {
  const response = await api.get("/api/wms/currency", { params: { page: 1, limit: 1000 } });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load currencies");
  return response.data.data?.tableData || response.data.data || [];
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function lowerRecord(raw: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(raw || {}).map(([key, value]) => [key.toLowerCase(), value]));
}

function nested(source: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: unknown) {
  const date = dateInput(value);
  return date || "";
}

function formatAmount(value: number) {
  const amount = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return value < 0 ? `(${amount})` : amount;
}

function formatExRate(value: number) {
  const amount = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  return value < 0 ? `(${amount})` : amount;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0.000";
  return value.toFixed(3);
}
