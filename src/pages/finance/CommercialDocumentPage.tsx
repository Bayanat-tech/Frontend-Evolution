import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Edit2, Paperclip, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import {
  Division,
  FyPeriod,
  getCompanyInfo,
  getDefaultFyPeriod,
  getDivisions,
  getDocAccounts,
  getFyPeriods,
  getTransactionDetail,
  getTransactionDocuments,
  getTransactionHeader,
  TransactionDocumentRow,
  TransactionType,
  getLpoDocuments,
  getLpoHeader,
  getLpoDetail
} from "../../api/transactions";
import { getDynamicFinanceLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { Button } from "../../components/ui/Button";
import { CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../state/AuthContext";

type CommercialType = "PO" | "PI" | "SI" | "SV";

type Line = {
  id: string;
  serial_no: number;
  ac_code: string;
  ac_name?: string;
  remarks?: string;
  l4_description?: string;
  qty: number;
  price: number;
  amount: number;
  sign_ind: 1 | -1;
  job_no?: string;
  dept_code?: string;
  tx_compntcat_code_1?: string;
  tx_cat_code?: string;
  tx_compnt_1_expmt?: string;
  tx_compnt_perc_1?: number;
  tx_compnt_amt_1?: number;
  prod_code?: string;
  other_remarks?: string;
};

type FormState = {
  doc_no?: string;
  doc_type: CommercialType;
  doc_date: string;
  inv_no?: string;
  inv_date?: string;
  ac_code: string;
  ac_name?: string;
  div_code: string;
  div_name?: string;
  curr_code: string;
  curr_name?: string;
  ex_rate: number;
  remarks?: string;
  l4_description?: string;
  ref_doc_no?: string;
  ref_no?: string;
  ref_date?: string;
  party_address?: string;
  party_phone?: string;
  party_fax?: string;
  payment_terms?: string;
  delivery_info?: string;
  dlvr_term?: string;  
  // contact?: string;
  // mobile?: string;
  // email?: string;
  tax_category?: string;
  tax_cat_code?: string;
  tax_type?: string;
  hse_compliance?: string;
  app_ref_no?: string;
pdo_type?: string;
delivery_to?: string;
dlvr_mobile?: string;
dlvr_email?: string;
dlvr_contact?: string;
salesman_code?: string;
salesman_name?: string;
sector_code?: string;
sector_name?: string;
tx_compntcat_code_1?: string;
tx_cat_code?: string;
tx_compnt_1_expmt?: string;
tx_compnt_perc_1?: number;
print_letter_head?: boolean;
  detail: Line[];
};

const META: Record<CommercialType, { title: string;  addLabel: string }> = {
  PO: { title: "LPO",  addLabel: "Add LPO" },
  PI: { title: "Purchase", addLabel: "Add Purchase" },
  SI: { title: "Sales", addLabel: "Add Sales" },
  SV: { title: "Service Invoice", addLabel: "Add Service" },
};

const today = () => new Date().toISOString().slice(0, 10);
const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function CommercialDocumentPage({ docType }: { docType: CommercialType }) {
  const meta = META[docType];
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
  const [editor, setEditor] = useState<{ mode: "create"; div?: Division } | { mode: "edit"; row: TransactionDocumentRow } | null>(null);
  const [divisionPicker, setDivisionPicker] = useState(false);

  const loadLookups = async () => {
    const [fyData, divisionData, companyInfo] = await Promise.all([getFyPeriods(), getDivisions(), getCompanyInfo()]);
    setFyPeriods(fyData);
    setDivisions(divisionData);
    setFyPeriod((current) => current || getDefaultFyPeriod(fyData, companyInfo));
  };

  const loadRows = async (nextPageIndex = pageIndex, nextPageSize = pageSize) => {
    if (!fyPeriod) return;
    setLoading(true);
    try {
      // const response = await getTransactionDocuments(docType, fyPeriod, query, nextPageIndex + 1, nextPageSize);
      const response =
         docType === "PO"
             ? await getLpoDocuments(
        fyPeriod,
        query,
        nextPageIndex + 1,
        nextPageSize,
      )
         : await getTransactionDocuments(
        docType,
        fyPeriod,
        query,
        nextPageIndex + 1,
        nextPageSize,
      );
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
  }, [fyPeriod, docType, query, pageIndex, pageSize]);

  const columns = useMemo<ColumnDef<TransactionDocumentRow>[]>(() => [
    { accessorKey: "doc_no", header: "Doc No", cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span> },
    { accessorKey: "doc_date", header: "Date", cell: ({ getValue }) => dateInput(getValue()) },
    { accessorKey: "ac_name", header: "Party" },
    { accessorKey: "remarks", header: "Description" },
    { accessorKey: "div_code", header: "Div" },
    { accessorKey: "net_amount", header: "Amount", cell: ({ getValue }) => formatAmount(Number(getValue() || 0)) },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={15} /></Button>
          <Button size="icon" variant="ghost"><Trash2 size={15} /></Button>
        </div>
      ),
    },
  ], []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Transaction</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">{meta.title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select className="w-44" value={fyPeriod} onChange={(event) => setFyPeriod(event.target.value)}>
            {fyPeriods.map((period) => <option key={period.fy_period} value={period.fy_period}>{period.fy_period}</option>)}
          </Select>
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setDivisionPicker(true)}><Plus size={15} /> {meta.addLabel}</Button>
        </div>
      </div>

      {notice && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${totalRows.toLocaleString()} Documents`}
        searchValue={query}
        onSearchChange={(value) => {
          setQuery(value);
          setPageIndex(0);
        }}
        searchPlaceholder="Search document, party, reference..."
        loading={loading}
        height={620}
        minWidth={980}
        density="grid"
        enablePagination
        manualPagination
        manualFiltering
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={setPageIndex}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageIndex(0);
        }}
      />

      {editor && (
        <div className="fixed inset-0 z-50 bg-background">
          <CommercialEditor
            docType={docType}
            editor={editor}
            onClose={() => setEditor(null)}
            onSaved={async (message) => {
              setEditor(null);
              setNotice({ type: "success", message });
              await loadRows();
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
              onClick={() => {
                setDivisionPicker(false);
                setEditor({ mode: "create", div: division });
              }}
              type="button"
            >
              <span className="font-medium">{division.div_name}</span>
              <span className="text-muted-foreground">{division.div_code}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </section>
  );
}

function CommercialEditor({
  docType,
  editor,
  onClose,
  onSaved,
}: {
  docType: CommercialType;
  editor: { mode: "create"; div?: Division } | { mode: "edit"; row: TransactionDocumentRow };
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const editMode = editor.mode === "edit";
  const [form, setForm] = useState<FormState>(() => emptyForm(docType, editor.mode === "create" ? editor.div : undefined));
  const [loading, setLoading] = useState(editMode);
  const [saving, setSaving] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [error, setError] = useState("");
  const [showHeaderDetails, setShowHeaderDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!editMode || editor.mode !== "edit") return;
      setLoading(true);
      try {
        const [header, detail] = await Promise.all([
          // getTransactionHeader(editor.row.doc_no, docType),
          // getTransactionDetail(editor.row.doc_no, editor.row.div_code, docType),

          docType === "PO"
            ? getLpoHeader(editor.row.doc_no, docType)
            : getTransactionHeader(editor.row.doc_no, docType),

            docType === "PO"
             ? getLpoDetail(editor.row.doc_no, docType)
             : getTransactionDetail(
                 editor.row.doc_no,
                 editor.row.div_code,
                 docType,
             ),
         ]);
        
        if (mounted) setForm(mapForm(docType, header, detail));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load document");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [docType, editMode, editor]);

   const isPO    = docType === "PO";
   const isPI    = docType === "PI";
   const isSales = docType === "SI" || docType === "SV";

  const total = form.detail.reduce((sum, line) => sum + Number(line.amount || 0) * line.sign_ind, 0);

  const update = (field: keyof FormState, value: string | number) => setForm((current) => ({ ...current, [field]: value }));
  const updateLine = (id: string, patch: Partial<Line>) => {
    setForm((current) => ({ ...current, detail: current.detail.map((line) => line.id === id ? { ...line, ...patch } : line) }));
  };
  // const addLine = () => {
  //   setForm((current) => ({ ...current, detail: [...current.detail, emptyLine(docType, current.detail.length + 1)] }));
  // };

  const addLine = () => {
  setForm((current) => {
    const newLine = emptyLine(docType, current.detail.length + 1);
    const withTax = {
      ...newLine,
      tx_compntcat_code_1: current.tx_compntcat_code_1 || (isSales ? "11100" : "10100"),
      tx_compnt_1_expmt:   current.tx_compnt_1_expmt || current.tax_type || "S",
      tx_compnt_perc_1:    current.tx_compnt_perc_1 ?? 0,
    };
    return { ...current, detail: [...current.detail, withTax] };
  });
};
  const removeLine = (id: string) => {
    setForm((current) => ({ ...current, detail: current.detail.filter((line) => line.id !== id).map((line, index) => ({ ...line, serial_no: index + 1 })) }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = buildCommercialPayload(form, user?.company_code || "");
      const endpoint = docType === "PO"
        ? editMode ? "/api/finance/transactions/lpo-update" : "/api/finance/transactions/lpo-document"
        : editMode ? "/api/finance/transactions/purchase-document" : docType === "SI" || docType === "SV" ? "/api/finance/transactions/sales-document" : "/api/finance/transactions/purchase-document";
      const response = editMode ? await api.put(endpoint, payload) : await api.post(endpoint, payload);
      if (!response.data?.success) throw new Error(response.data?.message || "Unable to save document");
      await onSaved(editMode ? "Document updated successfully" : "Document created successfully");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save document");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="payment-workbench commercial-editor grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]" onSubmit={submit}>
      <CardHeader className="border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                {editMode ? "Edit Document" : "New Document"}
              </p>
              <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">{META[docType].title}</h2>
            </div>
            <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Doc No</span>
              <strong className="block text-xs leading-tight text-primary-foreground">{form.doc_no || "New"}</strong>
            </div>
            <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Total</span>
              <strong className="block text-xs leading-tight text-primary-foreground">{formatAmount(total)}</strong>
            </div>
            {form.div_code && (
              <div className="rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-0.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/65">Division</span>
                <strong className="block max-w-[220px] truncate text-xs leading-tight text-primary-foreground">{form.div_code}{form.div_name ? ` - ${form.div_name}` : ""}</strong>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setAttachmentOpen(true)}>
              <Paperclip size={15} /> Files
            </Button>
            <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={onClose}><X size={16} /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 overflow-y-auto overflow-x-hidden p-3">
        {loading ? (
          <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading document...</div>
        ) : (
          <div className="grid min-w-0 gap-3">
            {error && <div className="alert error">{error}</div>}

            {/* <div className="payment-header-grid grid grid-cols-6 gap-2.5 rounded-md border bg-card p-3 max-2xl:grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1">
              {editMode && <Field label="Doc No"><Input disabled value={form.doc_no || ""} /></Field>}
              <Field label="Doc Date"><Input type="date" value={dateInput(form.doc_date)} onChange={(event) => update("doc_date", event.target.value)} /></Field>
              <Field label="Division"><Input disabled value={`${form.div_code}${form.div_name ? ` - ${form.div_name}` : ""}`} /></Field>
              <LookupField
                label={docType === "SI" || docType === "SV" ? "Customer" : "Supplier"}
                value={form.ac_code}
                displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
                columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }]}
                valueField="ac_code"
                displayFields={["ac_code", "ac_name"]}
                loadOptions={() => getDocAccounts(docType, "H", form.div_code)}
                onChange={(value, row) => setForm((current) => ({ ...current, ac_code: value, ac_name: text(getLookupValue(row || {}, "ac_name")) }))}
              />
              <LookupField
                label="Currency"
                value={form.curr_code}
                displayValue={form.curr_name ? `${form.curr_code} - ${form.curr_name}` : form.curr_code}
                columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                valueField="curr_code"
                displayFields={["curr_code", "curr_name"]}
                loadOptions={() => getCurrencyRows()}
                onChange={(value, row) => setForm((current) => ({ ...current, curr_code: value, curr_name: text(getLookupValue(row || {}, "curr_name")) }))}
              />
              <Field label="Exchange Rate"><Input type="number" step="0.0001" value={form.ex_rate} onChange={(event) => update("ex_rate", Number(event.target.value || 1))} /></Field>
              <Field label="Invoice No"><Input value={form.inv_no || ""} onChange={(event) => update("inv_no", event.target.value)} /></Field>
              <Field label="Invoice Date"><Input type="date" value={dateInput(form.inv_date)} onChange={(event) => update("inv_date", event.target.value)} /></Field>
              <Field label="Reference"><Input value={form.ref_doc_no || ""} onChange={(event) => update("ref_doc_no", event.target.value)} /></Field>
              <Field label="Payment Terms"><Input value={form.payment_terms || ""} onChange={(event) => update("payment_terms", event.target.value)} /></Field>
              <Field label="Delivery Term"><Input value={form.delivery_term || ""} onChange={(event) => update("delivery_term", event.target.value)} /></Field>
              <Field label="Contact"><Input value={form.contact || ""} onChange={(event) => update("contact", event.target.value)} /></Field>
              <label className="field col-span-2 max-md:col-span-1"><span>Remarks</span><Input value={form.remarks || ""} onChange={(event) => update("remarks", event.target.value)} /></label>
            </div> */}


       <div className="commercial-header-shell rounded-md border bg-card">
       <div className={`commercial-header-panel payment-header-grid relative grid grid-cols-6 gap-2.5 p-3 max-2xl:grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 ${showHeaderDetails ? "is-expanded" : "is-collapsed"}`}>

  {/* ── Doc No (edit only) — ALL ── */}
  {editMode && (
    <Field label="Doc No"><Input disabled value={form.doc_no || ""} /></Field>
  )}

  {/* ── Doc Date — ALL ── */}
  <Field label="Doc Date">
    <Input type="date" value={dateInput(form.doc_date)}
      onChange={(e) => update("doc_date", e.target.value)} />
  </Field>

  {/* ── INV Date — PI / SI / SV only (field: inv_date) ── */}
  {!isPO && (
    <Field label="INV Date">
      <Input type="date" value={dateInput(form.inv_date)}
        onChange={(e) => update("inv_date", e.target.value)} />
    </Field>
  )}

  {/* ── Invoice No — PI / SI / SV only (field: ref_no in PI, inv_no in SI/SV) ── */}
  {isPI && (
    <Field label="Invoice No">
      <Input value={form.ref_no || ""}
        onChange={(e) => update("ref_no", e.target.value)} />
    </Field>
  )}
  {isSales && (
    <Field label="Invoice No">
      <Input value={form.inv_no || ""}
        onChange={(e) => update("inv_no", e.target.value)} />
    </Field>
  )}

  {/* ── PO-only: Ref No / Ref Date / APP Ref No / LPO Category ── */}
  {isPO && (
    <Field label="Ref No">
      <Input value={form.ref_no || ""}
        onChange={(e) => update("ref_no", e.target.value)} />
    </Field>
  )}
  {isPO && (
    <Field label="Ref Date">
      <Input type="date" value={dateInput(form.ref_date)}
        onChange={(e) => update("ref_date", e.target.value)} />
    </Field>
  )}
  {isPO && (
    <Field label="APP Ref No">
      <Input value={form.app_ref_no || ""}
        onChange={(e) => update("app_ref_no", e.target.value)} />
    </Field>
  )}
  {isPO && (
    <Field label="LPO Category">
      {/* field name: pdo_type in LPO table */}
      <Select value={form.pdo_type || ""}
        onChange={(e) => update("pdo_type", e.target.value)}>
        <option value="" />
        <option value="PDO-OTO">PDO-OTO</option>
        <option value="PDO-NON-OTO">PDO-NON-OTO</option>
        <option value="NON-PDO">NON-PDO</option>
      </Select>
    </Field>
  )}

  {/* ── Division — ALL (disabled, pre-selected before opening editor) ── */}
  <Field label="Division">
    <Input disabled
      value={`${form.div_code}${form.div_name ? ` - ${form.div_name}` : ""}`} />
  </Field>

  {/* ── Supplier Code + Name — PO / PI ── */}
  {/* ── Customer Code + Name — SI / SV ── */}
  {/* field: ac_code / ac_name — same in all tables ── */}
  <LookupField
    label={isSales ? "Customer" : "Supplier"}
    value={form.ac_code}
    displayValue={form.ac_name ? `${form.ac_code} - ${form.ac_name}` : form.ac_code}
    columns={[
      { field: "ac_code",        header: "Code"     },
      { field: "ac_name",        header: "Name"     },
      { field: "curr_code",      header: "Currency" },
      { field: "l4_description", header: "Remarks"  },
    ]}
    valueField="ac_code"
    displayFields={["ac_code", "ac_name"]}
    loadOptions={() => getDocAccounts(docType, "H", form.div_code)}
    onChange={(value, row) => {
      const r   = row || {} as Record<string, unknown>;
      const get = (k: string) =>
        text(r[k] ?? r[k.toUpperCase()] ?? r[k.toLowerCase()] ?? "");
      setForm((c) => ({
        ...c,
        ac_code:       value,
        ac_name:       get("ac_name"),
        curr_code:     get("curr_code"),
        party_address: get("address"),
        party_phone:   get("phone"),
        party_fax:     get("fax"),
        dlvr_contact:  get("contact_person"),
        dlvr_mobile:   get("mobile_no"),
        dlvr_email:    get("e_mail"),
        remarks:       get("l4_description"),  // remarks from l4_description
      }));
    }}
  />
  {/* Supplier/Customer Name — read-only display */}
  <Field label={isSales ? "Customer Name" : "Supplier Name"}>
    <Input disabled value={form.ac_name || ""} />
  </Field>

  {/* ── Currency — ALL (field: curr_code / curr_name) ── */}
  <LookupField
    label="Currency"
    value={form.curr_code}
    displayValue={form.curr_name
      ? `${form.curr_code} - ${form.curr_name}`
      : form.curr_code}
    columns={[
      { field: "curr_code", header: "Code" },
      { field: "curr_name", header: "Name" },
    ]}
    valueField="curr_code"
    displayFields={["curr_code", "curr_name"]}
    loadOptions={() => getCurrencyRows()}
    onChange={(value, row) =>
      setForm((c) => ({
        ...c,
        curr_code: value,
        curr_name: text(getLookupValue(row || {}, "curr_name")),
        ex_rate:   Number(getLookupValue(row || {}, "ex_rate") || c.ex_rate || 1),
      }))
    }
  />

  {/* ── Ex Rate — ALL (field: ex_rate) ── */}
  <Field label="Ex Rate">
    <Input type="number" step="0.0001" value={form.ex_rate}
      onChange={(e) => update("ex_rate", Number(e.target.value || 1))} />
  </Field>

  {/* ── Address — ALL (field: party_address) ── */}
  <label className="field col-span-2 max-md:col-span-1">
    <span>Address</span>
    <Input value={form.party_address || ""}
      onChange={(e) => update("party_address", e.target.value)} />
  </label>

  {/* ── Phone — ALL (field: party_phone) ── */}
  <Field label="Phone">
    <Input value={form.party_phone || ""}
      onChange={(e) => update("party_phone", e.target.value)} />
  </Field>

  {/* ── Fax — ── */}
  <Field label="Fax">
    <Input value={form.party_fax || ""}
      onChange={(e) => update("party_fax", e.target.value)} />
  </Field>

  {/* ── Mobile / Email / Contact — PO only ── */}
  {isPO && (
    <Field label="Mobile">
      <Input value={form.dlvr_mobile || ""}
        onChange={(e) => update("dlvr_mobile", e.target.value)} />
    </Field>
  )}
  {isPO && (
    <Field label="Email">
      <Input value={form.dlvr_email || ""}
        onChange={(e) => update("dlvr_email", e.target.value)} />
    </Field>
  )}
  {isPO && (
    <Field label="Contact">
      <Input value={form.dlvr_contact || ""}
        onChange={(e) => update("dlvr_contact", e.target.value)} />
    </Field>
  )}

  {/* ── Payment Terms ── */}
  <Field label="Payment Terms">
    <Input value={form.payment_terms || ""}
      onChange={(e) => update("payment_terms", e.target.value)} />
  </Field>

  {/* ── Delivery Term  ── */}
  {/* PO table field: dlvr_term | PI/SI/SV table field: delivery_term ── */}
  {/* <Field label="Delivery Term">
    <Input
      value={(isPO ? form.dlvr_term : form.delivery_term) || ""}
      onChange={(e) =>
        update(isPO ? "dlvr_term" : "delivery_term", e.target.value)
      }
    />
  </Field> */}

  <Field label="Delivery Term">
  <Input
    value={form.dlvr_term || ""}
    onChange={(e) => update("dlvr_term", e.target.value)}
  />
</Field>

  {/* ── Delivery To — PO only ── */}
  {isPO && (
    <Field label="Delivery To">
      <Input value={form.delivery_to || ""}
        onChange={(e) => update("delivery_to", e.target.value)} />
    </Field>
  )}

  {/* ── Ref Doc — PI / SI / SV (field: ref_doc_no) ── */}
  {!isPO && (
    <Field label="Ref Doc">
      <Input value={form.ref_doc_no || ""}
        onChange={(e) => update("ref_doc_no", e.target.value)} />
    </Field>
  )}

  {/* ── Salesman Code + Name — SI / SV only ── */}
  {isSales && (
  <LookupField
    label="Salesman"
    value={form.salesman_code ?? ""}
    displayValue={form.salesman_name ? `${form.salesman_code} - ${form.salesman_name}` : form.salesman_code ?? ""}
    columns={[
      { field: "salesman_code", header: "Code" },
      { field: "salesman_name", header: "Name" },
    ]}
    valueField="salesman_code"
    displayFields={["salesman_code", "salesman_name"]}
    loadOptions={() =>
      getDynamicFinanceLookup({
        parameter: "Salesman_Search",
        code1: user?.company_code || "",
      })
    }
    onChange={(value, row) =>
      setForm((c) => ({
        ...c,
        salesman_code: value,
        salesman_name: text(getLookupValue(row || {}, "salesman_name")),
      }))
    }
  />
  )}
  {isSales && (
  <Field label="Salesman Name">
    <Input disabled value={form.salesman_name || ""} />
  </Field>
 )}

  {/* ── Sector Code + Name — SI / SV only ── */}
  {/* {isSales && (
    <Field label="Sector">
      <Input value={form.sector_code || ""}
        onChange={(e) => update("sector_code", e.target.value)} />
    </Field>
  )} */}

   {isSales && (
  <LookupField
    label="Sector"
    value={form.sector_code ?? ""}
    displayValue={form.sector_name ? `${form.sector_code} - ${form.sector_name}` : form.sector_code ?? ""}
    columns={[
      { field: "sector_code", header: "Code" },
      { field: "sector_name", header: "Name" },
    ]}
    valueField="sector_code"
    displayFields={["sector_code", "sector_name"]}
    loadOptions={() =>
      getDynamicFinanceLookup({
        parameter: "Sector_Search",
        code1: user?.company_code || "",
      })
    }
    onChange={(value, row) =>
      setForm((c) => ({
        ...c,
        sector_code: value,
        sector_name: text(getLookupValue(row || {}, "sector_name")),
      }))
    }
  />
  )}
  {isSales && (
    <Field label="Sector Name">
      <Input disabled value={form.sector_name || ""} />
    </Field>
  )}

  {/* ── Tax Category — ── */}
  <Field label="Tax Category">
    <Input value={form.tx_compntcat_code_1 || ""}
      onChange={(e) => update("tx_compntcat_code_1", e.target.value)} />
  </Field>

  {/* ── Tax Code ── */}
  <Field label="Tax Code">
    <Input value={form.tx_cat_code || ""}
      onChange={(e) => update("tx_cat_code", e.target.value)} />
  </Field>

  {/* ── Tax Type  ── */}
  <Field label="Tax Type">
    <Select
      value={form.tax_type || ""}  // field: tax_type in UI, maps to tx_compnt_1_expmt in table
      onChange={(e) => {
        const v = e.target.value;
        setForm((c) => ({
          ...c,
          tax_type:          v,
          tx_compnt_1_expmt: v,                // actual table field
          tx_compnt_perc_1:  v === "S" ? 5 : 0, // auto-set % when Std Tax
        }));
      }}
    >
      <option value="" />
      <option value="S">Std. Tax</option>
      <option value="Z">Zero</option>
      <option value="E">Expmt</option>
      <option value="N">No Tax</option>
    </Select>
  </Field>

  {/* ── Remarks ) ── */}
  <label className="field col-span-2 max-md:col-span-1">
    <span>Remarks</span>
    <Input value={form.remarks || ""}
      onChange={(e) => update("remarks", e.target.value)} />
  </label>

  {/* ── HSE Compliant + Letter Head checkboxes — PO only ── */}
  {/* PO table fields: hse_compliance (Y/N) / print_letter_head (bool) ── */}
  {/* {isPO && (
    <label className="field flex-row items-center gap-2">
      <input
        type="checkbox"
        checked={form.hse_compliance === "Y"}
        onChange={(e) => update("hse_compliance", e.target.checked ? "Y" : "N")}
      />
      <span>HSE Compliant</span>
    </label>
  )}
  {isPO && (
    <label className="field flex-row items-center gap-2">
      <input
        type="checkbox"
        checked={!!form.print_letter_head}
        onChange={(e) => update("print_letter_head", e.target.checked)}
      />
      <span>Letter Head</span>
    </label>
  )} */}

</div>
<div className="commercial-header-footer flex items-center justify-between gap-3 border-t bg-secondary/30 px-3 py-2">
  <div className="min-w-0 text-xs text-muted-foreground">
    <span className="font-semibold text-foreground">{isSales ? "Customer" : "Supplier"}:</span>{" "}
    <span className="truncate">{form.ac_name || form.ac_code || "Not selected"}</span>
    <span className="mx-2 text-border">|</span>
    <span className="font-semibold text-foreground">Currency:</span>{" "}
    <span>{form.curr_code || "-"}</span>
  </div>
  <Button
    type="button"
    size="sm"
    variant="ghost"
    onClick={() => setShowHeaderDetails((value) => !value)}
  >
    {showHeaderDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    {showHeaderDetails ? "Compact header" : "Show all header fields"}
  </Button>
</div>
</div>
            <div className="min-w-0 rounded-md border bg-card">
              <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                <div>
                  <p className="eyebrow m-0">Details</p>
                  <h3 className="m-0 text-sm font-semibold leading-tight">Document Lines</h3>
                </div>
                <Button size="sm" type="button" variant="outline" onClick={addLine}><Plus size={14} /> Add Line</Button>
              </div>
              <div className="commercial-lines-scroll overflow-auto">
                <table className="w-full min-w-[2140px] text-[12px]">
                  <thead className="sticky top-0 bg-primary text-xs text-primary-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">No</th>
                      <th className="px-2 py-2 text-left">Division</th>
                      <th className="px-2 py-2 text-left">Account</th>
                      <th className="px-2 py-2 text-left">A/c Name</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Currency</th>
                      <th className="px-2 py-2 text-left">Ex Rate</th>
                      <th className="px-2 py-2 text-left">Qty</th>
                      <th className="px-2 py-2 text-left">Price</th>
                      <th className="px-2 py-2 text-left">Amount</th>
                      <th className="px-2 py-2 text-left">Cr/Dr</th>
                      <th className="px-2 py-2 text-left">Tax Code</th>
                      <th className="px-2 py-2 text-left">Tax Type</th>
                      <th className="px-2 py-2 text-left">Tax %</th>
                      <th className="px-2 py-2 text-left">Tax Amt</th>
                      <th className="px-2 py-2 text-left">Job</th>
                      <th className="px-2 py-2 text-left">Base Amount</th>
                      <th className="px-2 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.detail.length === 0 ? (
                      <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={18}>No lines yet</td></tr>
                    ) : form.detail.map((line) => (
                      <tr className="border-t odd:bg-muted/20" key={line.id}>
                        <td className="px-2 py-1 text-xs">{line.serial_no}</td>
                        <td className="w-32 px-2 py-1"><Input disabled value={form.div_code} /></td>
                        <td className="w-[260px] px-2 py-1">
                          <LookupField
                            label="Line Account"
                            compact
                            placeholder="A/c code"
                            value={line.ac_code}
                            displayValue={line.ac_name ? `${line.ac_code} - ${line.ac_name}` : line.ac_code}
                            columns={[{ field: "ac_code", header: "Code" }, { field: "ac_name", header: "Name" }, { field: "curr_code", header: "Currency" }]}
                            valueField="ac_code"
                            displayFields={["ac_code", "ac_name"]}
                            loadOptions={() => getDocAccounts(docType, "D", form.div_code)}
                            onChange={(value, row) => updateLine(line.id, { ac_code: value, ac_name: text(getLookupValue(row || {}, "ac_name")) })}
                          />
                        </td>
                        <td className="w-[240px] px-2 py-1"><Input disabled value={line.ac_name || ""} /></td>
                        <td className="w-[360px] px-2 py-1">
                          <textarea
                            className="commercial-line-description"
                            value={line.remarks || ""}
                            onChange={(event) => updateLine(line.id, { remarks: event.target.value })}
                            placeholder="Description"
                          />
                        </td>
                        <td className="w-[210px] px-2 py-1">
                          <LookupField
                            label="Currency"
                            compact
                            placeholder="Currency"
                            value={form.curr_code}
                            displayValue={form.curr_name ? `${form.curr_code} - ${form.curr_name}` : form.curr_code}
                            columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Name" }]}
                            valueField="curr_code"
                            displayFields={["curr_code", "curr_name"]}
                            loadOptions={() => getCurrencyRows()}
                            onChange={(value, row) => setForm((current) => ({ ...current, curr_code: value, curr_name: text(getLookupValue(row || {}, "curr_name")) }))}
                          />
                        </td>
                        <td className="w-40 px-2 py-1"><Input className="commercial-number-input text-right tabular-nums" type="number" step="0.0001" value={form.ex_rate} onChange={(event) => update("ex_rate", Number(event.target.value || 1))} /></td>
                        <td className="w-36 px-2 py-1"><Input className="commercial-number-input text-right tabular-nums" type="number" value={line.qty} onChange={(event) => updateLine(line.id, recalc({ ...line, qty: Number(event.target.value || 0) }))} /></td>
                        <td className="w-44 px-2 py-1"><Input className="commercial-number-input text-right tabular-nums" type="number" step="0.001" value={line.price} onChange={(event) => updateLine(line.id, recalc({ ...line, price: Number(event.target.value || 0) }))} /></td>
                        <td className="w-56 px-2 py-1"><Input className="commercial-number-input text-right tabular-nums" type="number" step="0.001" value={line.amount} onChange={(event) => updateLine(line.id, { amount: Number(event.target.value || 0) })} /></td>
                        <td className="w-28 px-2 py-1">
                          <Select className="h-9" value={line.sign_ind} onChange={(event) => updateLine(line.id, { sign_ind: Number(event.target.value) as 1 | -1 })}>
                            <option value={1}>Cr</option>
                            <option value={-1}>Dr</option>
                          </Select>
                        </td>
                        <td className="w-40 px-2 py-1"><Input value={line.tx_compntcat_code_1 || ""} onChange={(event) => updateLine(line.id, { tx_compntcat_code_1: event.target.value })} /></td>
                        <td className="w-40 px-2 py-1">
                          <Select value={line.tx_compnt_1_expmt || "N"} onChange={(event) => updateLine(line.id, { tx_compnt_1_expmt: event.target.value })}>
                            <option value="N">No Tax</option>
                            <option value="S">Std Tax</option>
                            <option value="Z">Zero</option>
                            <option value="E">Exempt</option>
                          </Select>
                        </td>
                        <td className="w-36 px-2 py-1"><Input className="commercial-number-input text-right tabular-nums" type="number" value={line.tx_compnt_perc_1 ?? 0} onChange={(event) => updateLine(line.id, { tx_compnt_perc_1: Number(event.target.value || 0) })} /></td>
                        <td className="w-52 px-2 py-1"><Input className="commercial-number-input text-right tabular-nums" type="number" value={line.tx_compnt_amt_1 ?? 0} onChange={(event) => updateLine(line.id, { tx_compnt_amt_1: Number(event.target.value || 0) })} /></td>
                        <td className="w-40 px-2 py-1"><Input value={line.job_no || ""} onChange={(event) => updateLine(line.id, { job_no: event.target.value })} /></td>
                        <td className="w-56 px-2 py-1">
                          {/* <Input disabled value={formatAmount(Number(line.amount || 0) * Number(form.ex_rate || 1) * Number(line.sign_ind || 1))} /> */}
                          <Input className="commercial-number-input text-right tabular-nums" disabled value={formatAmount(Math.abs(Number(line.amount || 0)) * Number(form.ex_rate || 1))} />
                          </td>
                        <td className="px-2 py-1"><Button size="icon" type="button" variant="ghost" onClick={() => removeLine(line.id)}><X size={14} /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total</span>
                <strong className={total < 0 ? "text-destructive" : "text-emerald-600"}>{formatAmount(total)}</strong>
              </div>
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
        <Button disabled={saving || loading || form.detail.length === 0} type="submit"><Save size={15} /> {saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
      <AttachmentDialog
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        requestNumber={form.doc_no || ""}
        title={`${META[docType].title} Attachments`}
        module={docType}
        type={META[docType].title}
        companyCode={user?.company_code || ""}
        loginId={user?.loginid || user?.username || ""}
        flowLevel={2}
      />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function emptyForm(docType: CommercialType, div?: Division): FormState {
  return {
    doc_type: docType,
    doc_date: today(),
    inv_date: today(),
    ac_code: "",
    div_code: div?.div_code || "",
    div_name: div?.div_name || "",
    curr_code: "",
    ex_rate: 1,
    hse_compliance: "N",
    detail: [],
  };
}

function emptyLine(docType: CommercialType, serialNo: number): Line {
  return {
    id: newId(),
    serial_no: serialNo,
    ac_code: "",
    qty: 1,
    price: 0,
    amount: 0,
    sign_ind: docType === "PI" || docType === "PO" ? 1 : -1,
    tx_compntcat_code_1: "",
    tx_cat_code: "",
    tx_compnt_1_expmt: "N",
    tx_compnt_perc_1: 0,
    tx_compnt_amt_1: 0,
    prod_code: docType==="PO" ? "" : undefined,    // only required for PO
    other_remarks: docType === "PO" ? "" : undefined,
  };
}

function mapForm(docType: CommercialType, headerRaw: Record<string, unknown>, detailRaw: Record<string, unknown>[]): FormState {
  const header = lowerRecord(headerRaw);
  return {
    doc_no: text(header.doc_no),
    doc_type: docType,
    doc_date: dateInput(header.doc_date),
    inv_no: text(header.inv_no ?? header.invoice_number),
    inv_date: dateInput(header.inv_date ?? header.invoice_date ?? header.ref_date),
    ref_date: dateInput(header.ref_date),
    app_ref_no: text(header.app_ref_no),
    ac_code: text(header.ac_code),
    ac_name: text(nested(headerRaw, ["Account", "ac_name"]) ?? header.ac_name),
    div_code: text(header.div_code),
    div_name: text(nested(headerRaw, ["Division", "div_name"]) ?? header.div_name),
    curr_code: text(header.curr_code),
    curr_name: text(nested(headerRaw, ["Currency", "curr_name"]) ?? header.curr_name),
    ex_rate: Number(header.ex_rate || 1),
    remarks: text(header.remarks),
    payment_terms: text(header.payment_terms ?? header.terms),
    delivery_to: text(header.delivery_to),
    dlvr_term: text(header.dlvr_term?? header.delivery_term),
    party_address: text(header.party_address ?? header.address),
    party_phone:   text(header.party_phone ?? header.phone),
    party_fax:     text(header.party_fax ?? header.fax),
    dlvr_contact:       text(header.dlvr_contact ?? header.contact_person),
    dlvr_mobile:        text(header.dlvr_mobile ?? header.mobile_no),
    dlvr_email:         text(header.dlvr_email ?? header.e_mail),
    pdo_type:      text(header.pdo_type),
    salesman_code: text(header.salesman_code),
    salesman_name: text(nested(headerRaw, ["Salesman", "salesman_name"]) ?? header.salesman_name),
    sector_code:   text(header.sector_code),
    sector_name:   text(nested(headerRaw, ["Sector", "sector_name"]) ?? header.sector_name),
    ref_no:     text(header.ref_no),
    ref_doc_no: text(header.ref_doc_no),
    tax_type: text(header.tx_compnt_1_expmt),
    tx_compnt_1_expmt: text(header.tx_compnt_1_expmt),
    tx_compntcat_code_1: text(header.tx_compntcat_code_1),
    tx_cat_code:         text(header.tx_cat_code),
    tx_compnt_perc_1:    Number(header.tx_compnt_perc_1 || 0),
    print_letter_head: !!header.print_letter_head,
    detail: detailRaw.map((raw, index) => {
      const row = lowerRecord(raw);
      return {
        id: newId(),
        serial_no: Number(row.serial_no || index + 1),
        ac_code: text(row.ac_code),
        ac_name: text(nested(raw, ["Account", "ac_name"]) ?? row.ac_name),
        remarks: text(row.remarks),
        qty: Number(row.qty || 1),
        price: Number(row.price || row.amount || 0),
        amount: Math.abs(Number(row.amount || 0)),
        sign_ind: Number(row.sign_ind || (docType === "PI" || docType === "PO" ? 1 : -1)) as 1 | -1,
        job_no: text(row.job_no),
        dept_code: text(row.dept_code),
        tx_compntcat_code_1: text(row.tx_compntcat_code_1),
        tx_cat_code: text(row.tx_cat_code),
        tx_compnt_1_expmt: text(row.tx_compnt_1_expmt),
        tx_compnt_perc_1: Number(row.tx_compnt_perc_1 || 0),
        tx_compnt_amt_1: Number(row.tx_compnt_amt_1 || 0),
        prod_code:     docType === "PO" ? text(row.prod_code) : undefined,
        other_remarks: docType === "PO" ? text(row.other_remarks) : undefined,
      };
    }),
  };
}

function buildCommercialPayload(form: FormState, companyCode: string) {
  return {
    ...form,
    company_code: companyCode,
    ex_rate: Number(form.ex_rate || 1),
    ref_doc_no: form.ref_doc_no || form.ref_no || form.doc_no || "",
    
    detail: form.detail.map((line) => ({
      company_code: companyCode,
      doc_type: form.doc_type,
      doc_no: form.doc_no || "1",
      serial_no: line.serial_no,
      doc_date: form.doc_date,
      ac_code: line.ac_code,
      remarks: line.remarks || "",
      curr_code: form.curr_code,
      ex_rate: Number(form.ex_rate || 1),
      price: Number(line.price || 0),
      qty: Number(line.qty || 1),
      amount: Math.abs(Number(line.amount || 0)),
      sign_ind: line.sign_ind,
      tx_compntcat_code_1: line.tx_compntcat_code_1 || "",
      tx_cat_code: line.tx_cat_code || "",
      tx_compnt_1_expmt: line.tx_compnt_1_expmt || "N",
      tx_compnt_perc_1: Number(line.tx_compnt_perc_1 || 0),
      tx_compnt_amt_1: Number(line.tx_compnt_amt_1 || 0),
      //  tx_compnt_amt_1: Math.abs(Number(line.amount || 0)) * Number(line.tx_compnt_perc_1 || 0) / 100,   //correct 
      job_no: line.job_no || "",
      dept_code: line.dept_code || "",
      div_code: form.div_code,
      // lcur_amount: Math.abs(Number(line.amount || 0)) * Number(form.ex_rate || 1) * Number(line.sign_ind || 1),
      lcur_amount: Math.abs(Number(line.amount || 0)) * Number(form.ex_rate || 1),
      prod_code: line.prod_code || "",
      other_remarks: line.other_remarks || "",
      tx_compnt_lcuramt_1: (Math.abs(Number(line.amount || 0)) * Number(line.tx_compnt_perc_1 || 0) / 100) * Number(form.ex_rate || 1),
      header_ac_code: form.ac_code,

    })),
    // children: {},

    // for child 
  //   children: form.doc_type !== "PO"
  // ? Object.fromEntries(
  //     form.detail.map((line) => [
  //       line.id,
  //       [{
  //         company_code:  companyCode,
  //         doc_type:      form.doc_type,
  //         doc_no:        form.doc_no || "",
  //         serial_no:     line.serial_no,
  //         dtl_sr_no:     1,
  //         doc_date:      form.doc_date,
  //         ac_code:       line.ac_code,
  //         inv_no:        form.inv_no || form.ref_no || "",
  //         inv_date:      form.inv_date || form.doc_date,
  //         amount:        Math.abs(Number(line.amount || 0)),
  //         lcur_amount:   Math.abs(Number(line.amount || 0)) * Number(form.ex_rate || 1),
  //         sign_ind:      line.sign_ind,
  //         curr_code:     form.curr_code,
  //         ex_rate:       Number(form.ex_rate || 1),
  //         div_code:      form.div_code,
  //         job_no:        line.job_no || "",
  //       }]
  //     ])
  //   )
  // : {},
    


  };
}

async function getCurrencyRows(): Promise<LookupRow[]> {
  const response = await api.get("/api/wms/currency", { params: { page: 1, limit: 1000 } });
  if (!response.data.success) throw new Error(response.data.message || "Unable to load currencies");
  return response.data.data?.tableData || response.data.data || [];
}

function recalc(line: Line) {
  return { qty: line.qty, price: line.price, amount: Number(line.qty || 0) * Number(line.price || 0) };
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

function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatAmount(value: number) {
  const amount = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return value < 0 ? `(${amount})` : amount;
}
