import { Edit2, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { getDynamicLookup, getLookupValue } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import type { TAssetTransferDetail } from "./AddAssetTransferForm";

// ===================== TYPES =====================
type TProps = {
  details: TAssetTransferDetail[];
  siteFrom: string;
  siteTo: string;
  companyCode: string;
  loginId: string;
  disabled?: boolean;
  onChange: (details: TAssetTransferDetail[]) => void;
};

// ===================== EMPTY ROW =====================
function createEmptyRow(serial_no: number, siteFrom: string, siteTo: string): TAssetTransferDetail {
  return {
    id: crypto.randomUUID(),
    serial_no,
    asset_id: "",
    asset_name: "",
    site_from: siteFrom,
    site_to: siteTo,
    emp_id_from: "",
    emp_name_from: "",
    emp_id_to: "",
    emp_name_to: "",
    remarks: "",
  };
}

function display(code: string, name: string) {
  return code ? (name ? `${code} - ${name}` : code) : "";
}

const assetColumns = [
  { field: "asset_id", header: "Asset ID" },
  { field: "asset_name", header: "Asset Name" },
];

const employeeColumns = [
  { field: "employee_code", header: "Employee" },
  { field: "rpt_name", header: "Name" },
];

// ===================== MAIN COMPONENT =====================
export function AssetTransferDetailTable({
  details,
  siteFrom,
  siteTo,
  companyCode,
  loginId,
  disabled = false,
  onChange,
}: TProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<TAssetTransferDetail | null>(null);

  // ===================== ADD =====================
  const handleAdd = () => {
    const newRow = createEmptyRow(details.length + 1, siteFrom, siteTo);
    setEditRow({ ...newRow });
    setDialogOpen(true);
  };

  // ===================== EDIT =====================
  const handleEdit = (row: TAssetTransferDetail) => {
    setEditRow({ ...row });
    setDialogOpen(true);
  };

  // ===================== DELETE =====================
  const handleDelete = (id: string) => {
    const updated = details
      .filter((r) => r.id !== id)
      .map((r, i) => ({ ...r, serial_no: i + 1 }));
    onChange(updated);
  };

  // ===================== SAVE ROW =====================
  const handleSaveRow = () => {
    if (!editRow) return;
    const index = details.findIndex((r) => r.id === editRow.id);
    let updated: TAssetTransferDetail[];
    if (index === -1) {
      updated = [...details, editRow];
    } else {
      updated = details.map((r) => (r.id === editRow.id ? editRow : r));
    }
    onChange(updated);
    setDialogOpen(false);
    setEditRow(null);
  };

  const setEditField = (field: keyof TAssetTransferDetail, value: string) => {
    setEditRow((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  // ===================== RENDER =====================
  return (
    <div className="grid gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Detail Rows</p>
          <h3 className="m-0 text-sm font-semibold">{details.length} Rows</h3>
        </div>
        {!disabled && (
          <Button size="sm" onClick={handleAdd}>
            <Plus size={14} /> Add Row
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">#</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Asset ID – Name</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Custodian From</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Custodian To</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Remarks</th>
              {!disabled && (
                <th className="px-3 py-2 text-center font-medium text-muted-foreground w-20">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr>
                <td
                  colSpan={disabled ? 5 : 6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No detail rows — click <strong>Add Row</strong> to begin
                </td>
              </tr>
            ) : (
              details.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground">{row.serial_no}</td>
                  <td className="px-3 py-2 font-medium">
                    {row.asset_id ? `${row.asset_id} – ${row.asset_name}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.emp_id_from || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.emp_id_to || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px]">
                    {row.remarks || "—"}
                  </td>
                  {!disabled && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(row)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===================== ADD / EDIT ROW DIALOG ===================== */}
      {dialogOpen && editRow && (
        <Dialog
          open
          compact
          title={editRow.asset_id ? "Edit Detail Row" : "Add Detail Row"}
          onClose={() => { setDialogOpen(false); setEditRow(null); }}
          footer={
            <>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setEditRow(null); }}>
                <X size={14} /> Cancel
              </Button>
              {!disabled && (
                <Button onClick={handleSaveRow}>
                  <Save size={14} /> OK
                </Button>
              )}
            </>
          }
        >
          <div className="grid gap-3">
            {/* Asset */}
            <LookupField
              label="Asset ID – Name"
              value={editRow.asset_id}
              displayValue={display(editRow.asset_id, editRow.asset_name)}
              columns={assetColumns}
              valueField="asset_id"
              displayFields={["asset_id", "asset_name"]}
              disabled={disabled}
              loadOptions={() =>
                getDynamicLookup({
                  parameter: "AC_ASSETS_SearchID",
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
                })
              }
              onChange={(value, row) => {
                setEditField("asset_id", value);
                setEditField("asset_name", String(getLookupValue(row || {}, "asset_name") || ""));
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              {/* Custodian From */}
              <LookupField
                label="Custodian From"
                value={editRow.emp_id_from}
                displayValue={display(editRow.emp_id_from, editRow.emp_name_from)}
                columns={employeeColumns}
                valueField="employee_code"
                displayFields={["employee_code", "rpt_name"]}
                disabled={disabled}
                loadOptions={() =>
                  getDynamicLookup({
                    parameter: "AC_ASSETS_SearchEmp",
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
                  })
                }
                onChange={(value, row) => {
                  setEditField("emp_id_from", value);
                  setEditField("emp_name_from", String(getLookupValue(row || {}, "rpt_name") || ""));
                }}
              />

              {/* Custodian To */}
              <LookupField
                label="Custodian To"
                value={editRow.emp_id_to}
                displayValue={display(editRow.emp_id_to, editRow.emp_name_to)}
                columns={employeeColumns}
                valueField="employee_code"
                displayFields={["employee_code", "rpt_name"]}
                disabled={disabled}
                loadOptions={() =>
                  getDynamicLookup({
                    parameter: "AC_ASSETS_SearchEmp",
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
                  })
                }
                onChange={(value, row) => {
                  setEditField("emp_id_to", value);
                  setEditField("emp_name_to", String(getLookupValue(row || {}, "rpt_name") || ""));
                }}
              />
            </div>

            {/* Remarks */}
            <label className="field">
              <span>Remarks</span>
              <Input
                value={editRow.remarks}
                onChange={(e) => setEditField("remarks", e.target.value)}
                disabled={disabled}
              />
            </label>
          </div>
        </Dialog>
      )}
    </div>
  );
}