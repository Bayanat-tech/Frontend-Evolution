import { Edit2, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { getDynamicLookup, getLookupText, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../state/AuthContext";

type DocumentRow = {
  doc_id: string;
  doc_shortname: string;
  doc_name: string;
  doc_object: string;
  seq_no: string;
  default_h_ac: string;
  default_h_ac_name: string;
  default_d_ac: string;
  default_d_ac_name: string;
  default_sign: string;
  sign_editable: string;
  last_doc_no: string;
  company_code: string;
  prepared: string;
  verified: string;
  approved: string;
  received: string;
  back_date: string;
  prin_on_save: string;
  default_div_code: string;
  default_div_name: string;
  trans_type: string;
  doc_code: string;
  docno_prefix: string;
  default_h_code_co: string;
  curr_code: string;
  curr_name: string;
};

type DocAccountRow = {
  id: string;
  company_code: string;
  doc_id: string;
  hdr_dtl: "H" | "D";
  ac_code: string;
  ac_name: string;
  div_code: string;
  div_name: string;
};

type ActiveGrid = "header" | "detail" | null;
type DeleteTarget = { type: "header" | "detail"; row: DocAccountRow } | null;

export function DocumentSetupPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [docForm, setDocForm] = useState<DocumentRow | null>(null);
  const [headerRows, setHeaderRows] = useState<DocAccountRow[]>([]);
  const [detailRows, setDetailRows] = useState<DocAccountRow[]>([]);
  const [dirtyHeader, setDirtyHeader] = useState<Record<string, DocAccountRow>>({});
  const [dirtyDetail, setDirtyDetail] = useState<Record<string, DocAccountRow>>({});
  const [activeGrid, setActiveGrid] = useState<ActiveGrid>(null);
  const [query, setQuery] = useState("");
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const loadDocs = async () => {
    setLoadingDocs(true);
    setNotice(null);
    try {
      const rows = await getDynamicLookup({
        parameter: "MS_AC_SETUP_DOC",
        loginid: loginId,
        code1: companyCode,
      });
      setDocs(rows.map(mapDocument));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load documents" });
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadDetails = async (doc: DocumentRow) => {
    setSelected(doc);
    setDocForm(doc);
    setDirtyHeader({});
    setDirtyDetail({});
    setActiveGrid(null);
    setLoadingDetails(true);
    setNotice(null);
    try {
      const [headers, details] = await Promise.all([
        getDynamicLookup({ parameter: "MS_AC_SETUP_DOC_ACCODE_HDR", loginid: loginId, code1: doc.doc_id }),
        getDynamicLookup({ parameter: "MS_AC_SETUP_DOC_ACCODE_DTL", loginid: loginId, code1: doc.doc_id }),
      ]);
      setHeaderRows(headers.map((row, index) => mapDocAccount(row, index, "H", doc, companyCode)));
      setDetailRows(details.map((row, index) => mapDocAccount(row, index, "D", doc, companyCode)));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load document accounts" });
      setHeaderRows([]);
      setDetailRows([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    void loadDocs();
  }, []);

  const filteredDocs = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter((doc) => `${doc.doc_shortname} ${doc.doc_name} ${doc.doc_object}`.toLowerCase().includes(term));
  }, [docs, query]);

  const docDirty = Boolean(selected && docForm && JSON.stringify(selected) !== JSON.stringify(docForm));
  const dirtyCount = Object.keys(dirtyHeader).length + Object.keys(dirtyDetail).length + (docDirty ? 1 : 0);

  const updateAccount = (type: "header" | "detail", row: DocAccountRow) => {
    if (type === "header") {
      setHeaderRows((prev) => prev.map((item) => (item.id === row.id ? row : item)));
      setDirtyHeader((prev) => ({ ...prev, [row.id]: row }));
      return;
    }
    setDetailRows((prev) => prev.map((item) => (item.id === row.id ? row : item)));
    setDirtyDetail((prev) => ({ ...prev, [row.id]: row }));
  };

  const addAccount = (type: "header" | "detail") => {
    if (!selected) return;
    const row: DocAccountRow = {
      id: `${type}_new_${Date.now()}`,
      company_code: selected.company_code || companyCode,
      doc_id: selected.doc_id,
      hdr_dtl: type === "header" ? "H" : "D",
      ac_code: "",
      ac_name: "",
      div_code: "",
      div_name: "",
    };
    if (type === "header") {
      setHeaderRows((prev) => [row, ...prev]);
      setDirtyHeader((prev) => ({ ...prev, [row.id]: row }));
      setActiveGrid("header");
      return;
    }
    setDetailRows((prev) => [row, ...prev]);
    setDirtyDetail((prev) => ({ ...prev, [row.id]: row }));
    setActiveGrid("detail");
  };

  const saveChanges = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selected || !docForm || dirtyCount === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      if (docDirty) {
        await postFinance("upsertSetupDoc", {
          ...docForm,
          company_code: docForm.company_code || companyCode,
          seq_no: Number(docForm.seq_no || 0),
          default_sign: Number(docForm.default_sign || 0),
          last_doc_no: Number(docForm.last_doc_no || 0),
          back_date: Number(docForm.back_date || 0),
          loginid: loginId,
        });
      }

      const headerToSave = Object.values(dirtyHeader).filter((row) => row.ac_code.trim()).map(stripAccountForSave);
      const detailToSave = Object.values(dirtyDetail).filter((row) => row.ac_code.trim()).map(stripAccountForSave);
      const rows = [...headerToSave, ...detailToSave];
      if (rows.length) {
        await postFinance("insDocAccodeBulk", { rows, loginId });
      }

      setNotice({ type: "success", message: "Document setup saved successfully" });
      setDirtyHeader({});
      setDirtyDetail({});
      setActiveGrid(null);
      await loadDocs();
      await loadDetails(docForm);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save document setup" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!deleteTarget) return;
    const { type, row } = deleteTarget;
    if (row.id.includes("_new_")) {
      if (type === "header") setHeaderRows((prev) => prev.filter((item) => item.id !== row.id));
      if (type === "detail") setDetailRows((prev) => prev.filter((item) => item.id !== row.id));
      setDeleteTarget(null);
      return;
    }

    try {
      await postFinance("delDocAccodeBulk", {
        rows: [stripAccountForSave(row)],
        loginId,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Document account deleted" });
      if (selected) await loadDetails(selected);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete account row" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Finance Master</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Document Setup</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirtyCount > 0 && <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{dirtyCount} unsaved</span>}
          <Button variant="outline" onClick={() => void loadDocs()}><RefreshCw size={15} /> Refresh</Button>
          <Button disabled={!selected || dirtyCount === 0 || saving} type="submit" form="document-setup-form">{saving ? <span className="spinner small" /> : <Save size={15} />} Save Changes</Button>
        </div>
      </div>

      {notice && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      <div className="grid min-h-[700px] grid-cols-[380px_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
        <Card className="overflow-hidden">
          <CardHeader className="gap-3 border-b">
            <div>
              <p className="eyebrow">Documents</p>
              <h2 className="m-0 text-base font-semibold">{loadingDocs ? "Loading" : `${filteredDocs.length} Records`}</h2>
            </div>
            <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground">
              <Search size={15} />
              <Input className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document..." />
            </label>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[640px] overflow-auto">
              {loadingDocs ? (
                <div className="grid gap-2 p-3">{Array.from({ length: 12 }).map((_, index) => <Skeleton key={index} />)}</div>
              ) : filteredDocs.length === 0 ? (
                <div className="px-3 py-12 text-center text-sm text-muted-foreground">No documents found</div>
              ) : (
                <div className="divide-y">
                  {filteredDocs.map((doc) => {
                    const active = doc.doc_id === selected?.doc_id;
                    return (
                      <button className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent ${active ? "bg-[#eaf2ff]" : ""}`} key={doc.doc_id} onClick={() => void loadDetails(doc)}>
                        <span className="rounded-md bg-[#eef3fb] px-2 py-1 text-xs font-bold text-[#17345f]">{doc.doc_shortname || doc.doc_id}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{doc.doc_name || "Untitled"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{doc.doc_object || "No object"} | Seq {doc.seq_no || "0"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid min-h-[700px] grid-rows-[auto_1fr_1fr] gap-4">
          <Card className="overflow-hidden">
            {docForm ? (
              <form className="grid gap-3 p-4" id="document-setup-form" onSubmit={(event) => void saveChanges(event)}>
                <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
                  <Field label="Short Name" value={docForm.doc_shortname} onChange={(value) => setDocForm({ ...docForm, doc_shortname: value })} />
                  <Field label="Document Name" value={docForm.doc_name} onChange={(value) => setDocForm({ ...docForm, doc_name: value })} />
                  <Field label="Object" value={docForm.doc_object} onChange={(value) => setDocForm({ ...docForm, doc_object: value })} />
                  <Field label="Sequence No" value={docForm.seq_no} onChange={(value) => setDocForm({ ...docForm, seq_no: value })} />
                  <AccountLookup label="Default Header A/C" value={docForm.default_h_ac} name={docForm.default_h_ac_name} onChange={(value, name) => setDocForm({ ...docForm, default_h_ac: value, default_h_ac_name: name })} />
                  <AccountLookup label="Default Detail A/C" value={docForm.default_d_ac} name={docForm.default_d_ac_name} onChange={(value, name) => setDocForm({ ...docForm, default_d_ac: value, default_d_ac_name: name })} />
                  <Field label="Default Sign" value={docForm.default_sign} onChange={(value) => setDocForm({ ...docForm, default_sign: value })} />
                  <Field label="Sign Editable" value={docForm.sign_editable} onChange={(value) => setDocForm({ ...docForm, sign_editable: value })} />
                  <Field label="Last Doc No" value={docForm.last_doc_no} onChange={(value) => setDocForm({ ...docForm, last_doc_no: value })} />
                  <Field label="Prepared" value={docForm.prepared} onChange={(value) => setDocForm({ ...docForm, prepared: value })} />
                  <Field label="Verified" value={docForm.verified} onChange={(value) => setDocForm({ ...docForm, verified: value })} />
                  <Field label="Approved" value={docForm.approved} onChange={(value) => setDocForm({ ...docForm, approved: value })} />
                  <Field label="Received" value={docForm.received} onChange={(value) => setDocForm({ ...docForm, received: value })} />
                  <Field label="Back Date" value={docForm.back_date} onChange={(value) => setDocForm({ ...docForm, back_date: value })} />
                  <Field label="Print On Save" value={docForm.prin_on_save} onChange={(value) => setDocForm({ ...docForm, prin_on_save: value })} />
                  <LookupField
                    label="Default Division"
                    value={docForm.default_div_code}
                    displayValue={docForm.default_div_code ? `${docForm.default_div_code}${docForm.default_div_name ? ` - ${docForm.default_div_name}` : ""}` : ""}
                    columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]}
                    valueField="div_code"
                    displayFields={["div_code", "div_name"]}
                    loadOptions={() => getDynamicLookup({ parameter: "Account_division", loginid: loginId, code1: companyCode })}
                    onChange={(value, row) => setDocForm({ ...docForm, default_div_code: value, default_div_name: row ? getLookupText(row, ["div_name", "DIV_NAME"]) : "" })}
                  />
                  <Field label="Transaction Type" value={docForm.trans_type} onChange={(value) => setDocForm({ ...docForm, trans_type: value })} />
                  <Field label="Document Code" value={docForm.doc_code} onChange={(value) => setDocForm({ ...docForm, doc_code: value })} />
                  <Field label="Doc No Prefix" value={docForm.docno_prefix} onChange={(value) => setDocForm({ ...docForm, docno_prefix: value })} />
                  <Field label="Default H Code Co" value={docForm.default_h_code_co} onChange={(value) => setDocForm({ ...docForm, default_h_code_co: value })} />
                  <LookupField
                    label="Currency"
                    value={docForm.curr_code}
                    displayValue={docForm.curr_code ? `${docForm.curr_code}${docForm.curr_name ? ` - ${docForm.curr_name}` : ""}` : ""}
                    columns={[{ field: "curr_code", header: "Currency" }, { field: "curr_name", header: "Name" }]}
                    valueField="curr_code"
                    displayFields={["curr_code", "curr_name"]}
                    loadOptions={() => getDynamicLookup({ parameter: "Currency_code", loginid: loginId, code1: companyCode })}
                    onChange={(value, row) => setDocForm({ ...docForm, curr_code: value, curr_name: row ? getLookupText(row, ["curr_name", "CURR_NAME", "curr_desc"]) : "" })}
                  />
                  <Field label="Document ID" value={docForm.doc_id} onChange={() => undefined} disabled />
                </div>
              </form>
            ) : (
              <div className="grid min-h-[132px] place-items-center p-4 text-center text-muted-foreground">
                <div>
                  <p className="eyebrow">No Document Selected</p>
                  <h2 className="m-0 text-base font-semibold text-foreground">Select a document to manage accounts</h2>
                </div>
              </div>
            )}
          </Card>

          <DocAccountTable
            title="Header Accounts"
            type="header"
            rows={headerRows}
            loading={loadingDetails}
            active={activeGrid === "header"}
            disabled={!selected || activeGrid === "detail"}
            onEdit={() => setActiveGrid(activeGrid === "header" ? null : "header")}
            onAdd={() => addAccount("header")}
            onChange={(row) => updateAccount("header", row)}
            onDelete={(row) => setDeleteTarget({ type: "header", row })}
          />
          <DocAccountTable
            title="Detail Accounts"
            type="detail"
            rows={detailRows}
            loading={loadingDetails}
            active={activeGrid === "detail"}
            disabled={!selected || activeGrid === "header"}
            onEdit={() => setActiveGrid(activeGrid === "detail" ? null : "detail")}
            onAdd={() => addAccount("detail")}
            onChange={(row) => updateAccount("detail", row)}
            onDelete={(row) => setDeleteTarget({ type: "detail", row })}
          />
        </div>
      </div>

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Account"
          description="This will remove the selected account mapping."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteAccount()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.row.ac_code || "this row"}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function DocAccountTable({
  title,
  type,
  rows,
  loading,
  active,
  disabled,
  onEdit,
  onAdd,
  onChange,
  onDelete,
}: {
  title: string;
  type: "header" | "detail";
  rows: DocAccountRow[];
  loading: boolean;
  active: boolean;
  disabled: boolean;
  onEdit: () => void;
  onAdd: () => void;
  onChange: (row: DocAccountRow) => void;
  onDelete: (row: DocAccountRow) => void;
}) {
  const { user } = useAuth();
  const columns = useMemo<ColumnDef<DocAccountRow>[]>(() => [
    {
      id: "division",
      header: "Division",
      size: 190,
      accessorFn: (row) => row.div_code,
      cell: ({ row }) => {
        const original = row.original;
        return active ? (
          <LookupField
            label=""
            value={original.div_code}
            displayValue={original.div_code ? `${original.div_code}${original.div_name ? ` - ${original.div_name}` : ""}` : ""}
            columns={[
              { field: "div_code", header: "Division Code" },
              { field: "div_name", header: "Division Name" },
            ]}
            valueField="div_code"
            displayFields={["div_code", "div_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "Account_division", loginid: user?.loginid || "", code1: user?.company_code || "" })}
            onChange={(value, lookupRow) => onChange({ ...original, div_code: value, div_name: lookupRow ? getLookupText(lookupRow, ["div_name", "DIV_NAME", "division_name"]) : "" })}
          />
        ) : (
          <span>{original.div_code || "-"}</span>
        );
      },
    },
    {
      id: "account",
      header: "Account",
      size: 210,
      accessorFn: (row) => row.ac_code,
      cell: ({ row }) => {
        const original = row.original;
        return active ? (
          <LookupField
            label=""
            value={original.ac_code}
            displayValue={original.ac_code ? `${original.ac_code}${original.ac_name ? ` - ${original.ac_name}` : ""}` : ""}
            columns={[
              { field: "ac_code", header: "Account Code" },
              { field: "ac_name", header: "Account Name" },
            ]}
            valueField="ac_code"
            displayFields={["ac_code", "ac_name"]}
            loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach", loginid: user?.loginid || "" })}
            onChange={(value, lookupRow) => onChange({ ...original, ac_code: value, ac_name: lookupRow ? getLookupText(lookupRow, ["ac_name", "AC_NAME", "account_name"]) : "" })}
          />
        ) : (
          <span className="font-medium">{original.ac_code || "-"}</span>
        );
      },
    },
    {
      accessorKey: "ac_name",
      header: "Name",
      cell: ({ getValue }) => String(getValue() || "-"),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <Button size="icon" variant="ghost" disabled={!active} onClick={() => onDelete(row.original)}>
          <Trash2 size={15} />
        </Button>
      ),
    },
  ], [active, onChange, onDelete, user?.company_code, user?.loginid]);

  return (
    <div className={active ? "rounded-md ring-2 ring-primary/30" : ""}>
      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length} Accounts`}
        subtitle={title}
        loading={loading}
        emptyText={`No ${type} accounts found`}
        height={250}
        minWidth={760}
        density="grid"
        getRowId={(row) => row.id}
        toolbar={
          <>
          <Button size="sm" variant="outline" disabled={disabled || !active} onClick={onAdd}><Plus size={14} /> Add</Button>
          <Button size="sm" variant={active ? "secondary" : "outline"} disabled={disabled} onClick={onEdit}>{active ? <X size={14} /> : <Edit2 size={14} />} {active ? "Cancel" : "Edit"}</Button>
          </>
        }
      />
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

function AccountLookup({ label, value, name, onChange }: { label: string; value: string; name: string; onChange: (value: string, name: string) => void }) {
  const { user } = useAuth();
  return (
    <LookupField
      label={label}
      value={value}
      displayValue={value ? `${value}${name ? ` - ${name}` : ""}` : ""}
      columns={[
        { field: "ac_code", header: "Account Code" },
        { field: "ac_name", header: "Account Name" },
      ]}
      valueField="ac_code"
      displayFields={["ac_code", "ac_name"]}
      loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach", loginid: user?.loginid || "", code1: user?.company_code || "" })}
      onChange={(nextValue, row) => onChange(nextValue, row ? getLookupText(row, ["ac_name", "AC_NAME", "account_name"]) : "")}
    />
  );
}

function mapDocument(row: LookupRow): DocumentRow {
  return {
    doc_id: String(getLookupValue(row, "doc_id") || ""),
    doc_shortname: String(getLookupValue(row, "doc_shortname") || ""),
    doc_name: String(getLookupValue(row, "doc_name") || ""),
    doc_object: String(getLookupValue(row, "doc_object") || ""),
    seq_no: String(getLookupValue(row, "seq_no") || ""),
    default_h_ac: String(getLookupValue(row, "default_h_ac") || ""),
    default_h_ac_name: String(getLookupValue(row, "default_h_ac_name") || getLookupValue(row, "default_h_ac_desc") || ""),
    default_d_ac: String(getLookupValue(row, "default_d_ac") || ""),
    default_d_ac_name: String(getLookupValue(row, "default_d_ac_name") || getLookupValue(row, "default_d_ac_desc") || ""),
    default_sign: String(getLookupValue(row, "default_sign") || ""),
    sign_editable: String(getLookupValue(row, "sign_editable") || ""),
    last_doc_no: String(getLookupValue(row, "last_doc_no") || ""),
    company_code: String(getLookupValue(row, "company_code") || ""),
    prepared: String(getLookupValue(row, "prepared") || ""),
    verified: String(getLookupValue(row, "verified") || ""),
    approved: String(getLookupValue(row, "approved") || ""),
    received: String(getLookupValue(row, "received") || ""),
    back_date: String(getLookupValue(row, "back_date") || ""),
    prin_on_save: String(getLookupValue(row, "prin_on_save") || ""),
    default_div_code: String(getLookupValue(row, "default_div_code") || ""),
    default_div_name: String(getLookupValue(row, "default_div_name") || getLookupValue(row, "div_name") || ""),
    trans_type: String(getLookupValue(row, "trans_type") || ""),
    doc_code: String(getLookupValue(row, "doc_code") || ""),
    docno_prefix: String(getLookupValue(row, "docno_prefix") || ""),
    default_h_code_co: String(getLookupValue(row, "default_h_code_co") || ""),
    curr_code: String(getLookupValue(row, "curr_code") || ""),
    curr_name: String(getLookupValue(row, "curr_name") || getLookupValue(row, "currency_name") || ""),
  };
}

function mapDocAccount(row: LookupRow, index: number, fallbackType: "H" | "D", doc: DocumentRow, companyCode: string): DocAccountRow {
  const acCode = String(getLookupValue(row, "ac_code") || "");
  const divCode = String(getLookupValue(row, "div_code") || "");
  return {
    id: `${fallbackType}_${index}_${acCode}_${divCode}`,
    company_code: String(getLookupValue(row, "company_code") || doc.company_code || companyCode),
    doc_id: String(getLookupValue(row, "doc_id") || doc.doc_id),
    hdr_dtl: String(getLookupValue(row, "hdr_dtl") || fallbackType).toUpperCase() === "H" ? "H" : "D",
    ac_code: acCode,
    ac_name: String(getLookupValue(row, "ac_name") || getLookupValue(row, "account_name") || ""),
    div_code: divCode,
    div_name: String(getLookupValue(row, "div_name") || getLookupValue(row, "division_name") || ""),
  };
}

function stripAccountForSave(row: DocAccountRow) {
  return {
    company_code: row.company_code,
    doc_id: row.doc_id,
    hdr_dtl: row.hdr_dtl,
    ac_code: row.ac_code,
    div_code: row.div_code || "",
  };
}
