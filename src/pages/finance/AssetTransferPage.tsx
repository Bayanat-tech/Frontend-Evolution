import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow, postFinance } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
// Card removed: editor now opens in modal Dialog
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

type TransferHeader = {
  company_code: string;
  doc_type: string;
  doc_no: string;
  doc_date: string;
  site_from: string;
  site_from_name: string;
  site_to: string;
  site_to_name: string;
  remarks: string;
  confirmed: string;
  div_code: string;
  div_name: string;
};

type TransferDetail = {
  id: string;
  serial_no: number;
  asset_id: string;
  asset_name: string;
  site_from: string;
  site_to: string;
  emp_id_from: string;
  emp_name_from: string;
  emp_id_to: string;
  emp_name_to: string;
  remarks: string;
};

type EditorState =
  | { mode: "create"; row?: undefined }
  | { mode: "edit"; row: TransferHeader }
  | { mode: "view"; row: TransferHeader }
  | null;

const EMPTY_HEADER: TransferHeader = {
  company_code: "",
  doc_type: "ATR",
  doc_no: "",
  doc_date: today(),
  site_from: "",
  site_from_name: "",
  site_to: "",
  site_to_name: "",
  remarks: "",
  confirmed: "N",
  div_code: "",
  div_name: "",
};

export function AssetTransferPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [rows, setRows] = useState<TransferHeader[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransferHeader | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_TRANSFER",
        loginid: loginId,
        code1: companyCode,
        code2: "",
        code3: "",
        code4: "",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      setRows(data.map(mapHeader));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load asset transfers" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [query, rows]);

  const columns = useMemo<ColumnDef<TransferHeader>[]>(() => [
    { accessorKey: "doc_no", header: "Document No", size: 140, cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span> },
    { accessorKey: "doc_date", header: "Date", size: 120 },
    { accessorKey: "site_from", header: "Location From", size: 160 },
    { accessorKey: "site_to", header: "Location To", size: 160 },
    { accessorKey: "div_code", header: "Division", size: 120 },
    { accessorKey: "remarks", header: "Remarks", size: 260 },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "view", row: row.original })}><Eye size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })}><Edit2 size={15} /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)}><Trash2 size={15} /></Button>
        </div>
      ),
    },
  ], []);

  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "AC_ASSETS_delete_AC_TRANSFER",
        loginid: loginId,
        code1: companyCode,
        code2: deleteTarget.doc_no,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Asset transfer deleted successfully" });
      await loadRows();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete asset transfer" });
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Asset Utility</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Asset Transfer</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} /> Create Transfer</Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Transfers"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search transfer..."
        loading={loading}
        emptyText="No asset transfers found"
        height={650}
        minWidth={1120}
        density="grid"
        getRowId={(row, index) => `${row.doc_no || "new"}_${index}`}
      />

      {editor && (
        <Dialog
          open
          wide
          title={`${editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Edit" : "View"} Asset Transfer`}
          description="Header and details"
          onClose={() => setEditor(null)}
        >
          <TransferEditor
            editor={editor}
            companyCode={companyCode}
            loginId={loginId}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setNotice({ type: "success", message: "Asset transfer saved successfully" });
              await loadRows();
            }}
          />
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog open compact tone="danger" title="Delete Transfer" description="This action cannot be undone." onClose={() => setDeleteTarget(null)} footer={<><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button></>}>
          <p className="modal-copy">Delete <strong>{deleteTarget.doc_no}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}

function TransferEditor({ editor, companyCode, loginId, onClose, onSaved }: { editor: Exclude<EditorState, null>; companyCode: string; loginId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const readOnly = editor.mode === "view";
  const [header, setHeader] = useState<TransferHeader>(() => ({ ...EMPTY_HEADER, company_code: companyCode, ...(editor.row || {}) }));
  const [details, setDetails] = useState<TransferDetail[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDetails = async () => {
    if (!header.doc_no) return;
    const data = await getDynamicLookup({ parameter: "AC_ASSETS_TRANSFER_DET", loginid: loginId, code1: companyCode, code2: header.doc_no, code3: header.doc_type, code4: "", number1: 0, number2: 0, number3: 0, number4: 0, date1: null, date2: null, date3: null, date4: null });
    setDetails(data.map(mapDetail));
  };

  useEffect(() => {
    void loadDetails();
  }, [header.doc_no]);

  const setField = (field: keyof TransferHeader, value: string) => setHeader((prev) => ({ ...prev, [field]: value }));
  const addDetail = () => setDetails((prev) => [...prev, { id: `new_${Date.now()}`, serial_no: prev.length + 1, asset_id: "", asset_name: "", site_from: header.site_from, site_to: header.site_to, emp_id_from: "", emp_name_from: "", emp_id_to: "", emp_name_to: "", remarks: "" }]);
  const updateDetail = (id: string, patch: Partial<TransferDetail>) => setDetails((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeDetail = (id: string) => setDetails((prev) => prev.filter((row) => row.id !== id).map((row, index) => ({ ...row, serial_no: index + 1 })));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!header.doc_date || !header.site_from || !header.site_to || details.length === 0) {
      setError("Document date, locations and at least one detail row are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await postFinance("insUpdTrAcAssetTransferBulk", {
        header: {
          company_code: companyCode,
          doc_type: header.doc_type,
          doc_no: header.doc_no || null,
          doc_date: header.doc_date,
          site_from: header.site_from,
          site_to: header.site_to,
          remarks: header.remarks,
          user_id: loginId,
          user_dt: new Date().toISOString(),
          last_serial_no: details.length,
          confirmed: header.confirmed,
          div_code: header.div_code,
        },
        details: details.map((row, index) => ({
          company_code: companyCode,
          doc_type: header.doc_type,
          doc_no: header.doc_no || null,
          serial_no: index + 1,
          asset_id: row.asset_id,
          site_from: row.site_from || header.site_from,
          site_to: row.site_to || header.site_to,
          emp_id_from: row.emp_id_from,
          emp_id_to: row.emp_id_to,
          remarks: row.remarks,
          user_id: loginId,
          user_dt: new Date().toISOString(),
          div_code: header.div_code,
        })),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[690px] flex-col">
      <div className="border-b p-4"><p className="eyebrow">{editor.mode === "create" ? "Create" : editor.mode === "edit" ? "Modify" : "View"}</p><h2 className="m-0 text-xl font-semibold tracking-tight">Asset Transfer</h2><p className="mt-1 text-xs text-muted-foreground">Doc No: {header.doc_no || "Autogenerated"}</p></div>
      <form className="grid flex-1 content-start gap-4 overflow-auto p-4" id="asset-transfer-form" onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Doc Date" type="date" value={header.doc_date} onChange={(value) => setField("doc_date", value)} disabled={readOnly} />
          <Lookup label="Division" parameter="Account_division" value={header.div_code} displayValue={display(header.div_code, header.div_name)} valueField="div_code" displayFields={["div_code", "div_name"]} columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("div_code", value); setField("div_name", String(getLookupValue(row || {}, "div_name") || "")); }} />
          <Lookup label="Location From *" parameter="AC_ASSETS_SITE" value={header.site_from} displayValue={display(header.site_from, header.site_from_name)} valueField="site_code" displayFields={["site_code", "site_name"]} columns={siteColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("site_from", value); setField("site_from_name", String(getLookupValue(row || {}, "site_name") || "")); }} />
          <Lookup label="Location To *" parameter="AC_ASSETS_SITE" value={header.site_to} displayValue={display(header.site_to, header.site_to_name)} valueField="site_code" displayFields={["site_code", "site_name"]} columns={siteColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value, row) => { setField("site_to", value); setField("site_to_name", String(getLookupValue(row || {}, "site_name") || "")); }} />
        </div>
        <label className="field"><span>Remarks</span><textarea className="ui-textarea min-h-[68px]" value={header.remarks} onChange={(event) => setField("remarks", event.target.value)} disabled={readOnly} /></label>

        <div className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b p-2"><div><p className="eyebrow">Details</p><h3 className="m-0 text-sm font-semibold">{details.length} Rows</h3></div>{!readOnly && <Button size="sm" onClick={addDetail}><Plus size={14} /> Add Row</Button>}</div>
          <div className="grid max-h-[330px] gap-2 overflow-auto p-2">
            {details.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">No detail rows</div> : details.map((row) => (
              <div className="grid gap-2 rounded-md border bg-secondary/30 p-2" key={row.id}>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Lookup label={`Asset ${row.serial_no}`} parameter="AC_ASSETS_SearchID" value={row.asset_id} displayValue={display(row.asset_id, row.asset_name)} valueField="asset_id" displayFields={["asset_id", "asset_name"]} columns={[{ field: "asset_id", header: "Asset ID" }, { field: "asset_name", header: "Asset Name" }]} companyCode={companyCode} disabled={readOnly} onSelect={(value, selected) => updateDetail(row.id, { asset_id: value, asset_name: String(getLookupValue(selected || {}, "asset_name") || "") })} />
                  {!readOnly && <Button size="icon" variant="ghost" onClick={() => removeDetail(row.id)}><Trash2 size={15} /></Button>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Lookup label="Custodian From" parameter="AC_ASSETS_SearchEmp" value={row.emp_id_from} displayValue={display(row.emp_id_from, row.emp_name_from)} valueField="employee_code" displayFields={["employee_code", "rpt_name"]} columns={employeeColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value, selected) => updateDetail(row.id, { emp_id_from: value, emp_name_from: String(getLookupValue(selected || {}, "rpt_name") || "") })} />
                  <Lookup label="Custodian To" parameter="AC_ASSETS_SearchEmp" value={row.emp_id_to} displayValue={display(row.emp_id_to, row.emp_name_to)} valueField="employee_code" displayFields={["employee_code", "rpt_name"]} columns={employeeColumns} companyCode={companyCode} disabled={readOnly} onSelect={(value, selected) => updateDetail(row.id, { emp_id_to: value, emp_name_to: String(getLookupValue(selected || {}, "rpt_name") || "") })} />
                </div>
                <Field label="Detail Remarks" value={row.remarks} onChange={(value) => updateDetail(row.id, { remarks: value })} disabled={readOnly} />
              </div>
            ))}
          </div>
        </div>
      </form>
      <div className="flex items-center justify-end gap-2 border-t bg-card p-4"><Button variant="outline" onClick={onClose}>Close</Button>{!readOnly && <Button disabled={saving} type="submit" form="asset-transfer-form">{saving ? <span className="spinner small" /> : <Save size={15} />} Save</Button>}</div>
    </div>
  );
}

function Lookup({ label, parameter, value, displayValue, valueField, displayFields, columns, companyCode, disabled, onSelect }: { label: string; parameter: string; value: string; displayValue: string; valueField: string; displayFields: string[]; columns: { field: string; header: string }[]; companyCode: string; disabled?: boolean; onSelect: (value: string, row: LookupRow | null) => void }) {
  return <LookupField label={label} value={value} displayValue={displayValue} columns={columns} valueField={valueField} displayFields={displayFields} disabled={disabled} loadOptions={() => getDynamicLookup({ parameter, code1: companyCode, code2: "", code3: "", code4: "", number1: 0, number2: 0, number3: 0, number4: 0, date1: null, date2: null, date3: null, date4: null })} onChange={onSelect} />;
}

function Field({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: "text" | "date" }) {
  return <label className="field"><span>{label}</span><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /></label>;
}

const siteColumns = [{ field: "site_code", header: "Location" }, { field: "site_name", header: "Name" }];
const employeeColumns = [{ field: "employee_code", header: "Employee" }, { field: "rpt_name", header: "Name" }];

function mapHeader(row: LookupRow): TransferHeader {
  return { ...EMPTY_HEADER, company_code: String(getLookupValue(row, "company_code") || ""), doc_type: String(getLookupValue(row, "doc_type") || "ATR"), doc_no: String(getLookupValue(row, "doc_no") || ""), doc_date: dateInput(getLookupValue(row, "doc_date")), site_from: String(getLookupValue(row, "site_from") || ""), site_to: String(getLookupValue(row, "site_to") || ""), remarks: String(getLookupValue(row, "remarks") || ""), confirmed: String(getLookupValue(row, "confirmed") || "N"), div_code: String(getLookupValue(row, "div_code") || "") };
}
function mapDetail(row: LookupRow, index: number): TransferDetail {
  return { id: `${String(getLookupValue(row, "serial_no") || index)}_${Date.now()}`, serial_no: Number(getLookupValue(row, "serial_no") || index + 1), asset_id: String(getLookupValue(row, "asset_id") || ""), asset_name: String(getLookupValue(row, "asset_name") || ""), site_from: String(getLookupValue(row, "site_from") || ""), site_to: String(getLookupValue(row, "site_to") || ""), emp_id_from: String(getLookupValue(row, "emp_id_from") || ""), emp_name_from: String(getLookupValue(row, "emp_name_from") || ""), emp_id_to: String(getLookupValue(row, "emp_id_to") || ""), emp_name_to: String(getLookupValue(row, "emp_name_to") || ""), remarks: String(getLookupValue(row, "remarks") || "") };
}
function display(code: string, name: string) { return code ? (name ? `${code} - ${name}` : code) : ""; }
function today() { return new Date().toISOString().slice(0, 10); }
function dateInput(value: unknown) { if (!value) return ""; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10); }
