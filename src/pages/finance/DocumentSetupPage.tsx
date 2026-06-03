import { Edit2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { getDynamicLookup, getLookupText, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
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
type AddTarget = "header" | "detail" | null;

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
  const [addTarget, setAddTarget] = useState<AddTarget>(null);

  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const loadDocs = async (clearNotice = true) => {
    setLoadingDocs(true);
    if (clearNotice) setNotice(null);
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

  const loadDetails = async (doc: DocumentRow, clearNotice = true) => {
    setSelected(doc);
    setDocForm(doc);
    setDirtyHeader({});
    setDirtyDetail({});
    setActiveGrid(null);
    setLoadingDetails(true);
    if (clearNotice) setNotice(null);
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
    setAddTarget(type);
  };

  const commitAccount = (type: "header" | "detail", patch: Pick<DocAccountRow, "ac_code" | "ac_name" | "div_code" | "div_name">) => {
    if (!selected) return;
    const row: DocAccountRow = {
      id: `${type}_new_${Date.now()}`,
      company_code: selected.company_code || companyCode,
      doc_id: selected.doc_id,
      hdr_dtl: type === "header" ? "H" : "D",
      ac_code: patch.ac_code,
      ac_name: patch.ac_name,
      div_code: patch.div_code,
      div_name: patch.div_name,
    };
    if (type === "header") {
      setHeaderRows((prev) => [row, ...prev]);
      setDirtyHeader((prev) => ({ ...prev, [row.id]: row }));
      setActiveGrid("header");
      setAddTarget(null);
      return;
    }
    setDetailRows((prev) => [row, ...prev]);
    setDirtyDetail((prev) => ({ ...prev, [row.id]: row }));
    setActiveGrid("detail");
    setAddTarget(null);
  };

  const saveChanges = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selected || !docForm || dirtyCount === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      const headerToSave = Object.values(dirtyHeader)
        .filter((row) => row.ac_code.trim())
        .map((row) => stripAccountForSave(row, companyCode));
      const detailToSave = Object.values(dirtyDetail)
        .filter((row) => row.ac_code.trim())
        .map((row) => stripAccountForSave(row, companyCode));

      if (headerToSave.length) {
        await postFinance("insDocAccodeBulk", { rows: headerToSave, loginId });
      }
      if (detailToSave.length) {
        await postFinance("insDocAccodeBulk", { rows: detailToSave, loginId });
      }

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

      setNotice({ type: "success", message: "Document setup saved successfully" });
      setDirtyHeader({});
      setDirtyDetail({});
      setActiveGrid(null);
      await loadDocs(false);
      await loadDetails(docForm, false);
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
        rows: [stripAccountForSave(row, companyCode)],
        loginId,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Document account deleted" });
      if (selected) await loadDetails(selected, false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete account row" });
    }
  };

  const docColumns = useMemo<ColumnDef<DocumentRow>[]>(() => [
    {
      accessorKey: "doc_shortname",
      header: "ID",
      size: 90,
      cell: ({ row }) => <span className="font-semibold text-primary">{row.original.doc_shortname || row.original.doc_id}</span>,
    },
    { accessorKey: "doc_name", header: "Doc Name", size: 260 },
    { accessorKey: "doc_object", header: "Object", size: 160 },
    { accessorKey: "seq_no", header: "Seq No", size: 90 },
    { accessorKey: "default_sign", header: "Sign", size: 80 },
    { accessorKey: "default_h_ac", header: "Default H A/C", size: 150 },
    { accessorKey: "default_d_ac", header: "Default D A/C", size: 150 },
  ], []);

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

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <form id="document-setup-form" onSubmit={(event) => void saveChanges(event)} />

      <div className="grid gap-4">
        <DataTable
          columns={docColumns}
          data={filteredDocs}
          title={loadingDocs ? "Loading" : `${filteredDocs.length} Documents`}
          subtitle="Documents"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search document..."
          loading={loadingDocs}
          height={280}
          minWidth={980}
          density="grid"
          getRowId={(row) => row.doc_id}
          onRowClick={(doc) => void loadDetails(doc)}
          rowClassName={(doc) => doc.doc_id === selected?.doc_id ? "bg-[#eaf2ff] font-semibold" : ""}
        />

        {selected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <p className="eyebrow m-0">Selected Document</p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{selected.doc_shortname || selected.doc_id}</span>
                <h2 className="m-0 truncate text-base font-semibold">{selected.doc_name || "Untitled document"}</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border bg-secondary px-2.5 py-1">Header {headerRows.length}</span>
              <span className="rounded-full border bg-secondary px-2.5 py-1">Detail {detailRows.length}</span>
              {dirtyCount > 0 && <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{dirtyCount} Unsaved</span>}
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">Select a document to manage header and detail accounts.</div>
        )}

        <div className="grid min-h-[360px] grid-cols-2 gap-4 max-xl:grid-cols-1">
          <DocAccountTable
            title="Header Accounts"
            description="Accounts allowed at document header level"
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
            description="Accounts allowed at document line level"
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

      {addTarget && (
        <AddAccountDialog
          open
          type={addTarget}
          onClose={() => setAddTarget(null)}
          onAdd={(row) => commitAccount(addTarget, row)}
        />
      )}
    </section>
  );
}

function DocAccountTable({
  title,
  description,
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
  description: string;
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
          <span className="hidden max-w-[260px] truncate text-xs text-muted-foreground xl:inline">{description}</span>
          <Button size="sm" variant="outline" disabled={disabled} onClick={onAdd}><Plus size={14} /> Add</Button>
          <Button size="sm" variant={active ? "secondary" : "outline"} disabled={disabled} onClick={onEdit}>{active ? <X size={14} /> : <Edit2 size={14} />} {active ? "Done" : "Edit"}</Button>
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

function AddAccountDialog({
  open,
  type,
  onClose,
  onAdd,
}: {
  open: boolean;
  type: "header" | "detail";
  onClose: () => void;
  onAdd: (row: Pick<DocAccountRow, "ac_code" | "ac_name" | "div_code" | "div_name">) => void;
}) {
  const { user } = useAuth();
  const [division, setDivision] = useState({ div_code: "", div_name: "" });
  const [account, setAccount] = useState({ ac_code: "", ac_name: "" });
  const canAdd = Boolean(division.div_code && account.ac_code);

  return (
    <Dialog
      open={open}
      title={`Add ${type === "header" ? "Header" : "Detail"} Account`}
      description="Select the division first, then choose the account code."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!canAdd}
            onClick={() => onAdd({ ...division, ...account })}
          >
            <Plus size={15} /> Add Account
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <LookupField
          label="Division"
          value={division.div_code}
          displayValue={division.div_code ? `${division.div_code}${division.div_name ? ` - ${division.div_name}` : ""}` : ""}
          columns={[
            { field: "div_code", header: "Division Code" },
            { field: "div_name", header: "Division Name" },
          ]}
          valueField="div_code"
          displayFields={["div_code", "div_name"]}
          loadOptions={() => getDynamicLookup({ parameter: "Account_division", loginid: user?.loginid || "", code1: user?.company_code || "" })}
          onChange={(value, row) => setDivision({ div_code: value, div_name: row ? getLookupText(row, ["div_name", "DIV_NAME", "division_name"]) : "" })}
        />
        <LookupField
          label="Account"
          value={account.ac_code}
          displayValue={account.ac_code ? `${account.ac_code}${account.ac_name ? ` - ${account.ac_name}` : ""}` : ""}
          columns={[
            { field: "ac_code", header: "Account Code" },
            { field: "ac_name", header: "Account Name" },
          ]}
          valueField="ac_code"
          displayFields={["ac_code", "ac_name"]}
          loadOptions={() => getDynamicLookup({ parameter: "Account_AC_CODE_Serach", loginid: user?.loginid || "", code1: user?.company_code || "" })}
          onChange={(value, row) => setAccount({ ac_code: value, ac_name: row ? getLookupText(row, ["ac_name", "AC_NAME", "account_name"]) : "" })}
        />
      </div>
    </Dialog>
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

function stripAccountForSave(row: DocAccountRow, fallbackCompanyCode = "") {
  return {
    company_code: row.company_code || fallbackCompanyCode,
    doc_id: row.doc_id,
    hdr_dtl: row.hdr_dtl,
    ac_code: row.ac_code,
    div_code: row.div_code || "",
  };
}
