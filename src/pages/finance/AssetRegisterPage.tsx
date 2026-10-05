import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, Trash2, Boxes } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { DivisionPickerDialog } from "../../components/ui/DivisionPickerDialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { FinanceListActionsMenu } from "../../components/finance/FinanceListActionsMenu";
import { exportToCsv } from "../../components/ui/ExportCSVButton";
import { useAuth } from "../../state/AuthContext";
import { AddAssetRegisterForm } from "./AddAssetRegisterForm";

// ===================== TYPES =====================
export type TAssetRow = {
  company_code: string;
  asset_id: string;
  asset_name: string;
  site_code: string;
  site_name: string;
  div_code: string;
  div_name: string;
  asset_group_code: string;
  asset_group_name: string;
  asset_subgroup_code: string;
  asset_subgroup_name: string;
  asset_brand_code: string;
  asset_brand_name: string;
  asset_ac_code: string;
  dprc_ac_code: string;
  accudprc_ac_code: string;
  dprc_percentage: string;
  dprc_commence_date: string;
  doc_type: string;
  doc_no: string;
  asset_properties: string;
  purchase_date: string;
  quantity: string;
  price: string;
  amount: string;
  supplier_name: string;
  supplier_ac_code: string;
  supp_code: string;
  status: string;
};

type TDivisionOption = {
  div_code: string;
  div_name: string;
};

type PopupState =
  | { open: false }
  | { open: true; mode: "create"; div_code: string; div_name: string; asset_id?: undefined }
  | { open: true; mode: "edit"; div_code: string; div_name: string; asset_id: string }
  | { open: true; mode: "view"; div_code: string; div_name: string; asset_id: string };

// ===================== MAP =====================
function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value: unknown) {
  return num(value).toFixed(3);
}
function dateInput(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

const EMPTY_ASSET: TAssetRow = {
  company_code: "", asset_id: "", asset_name: "", site_code: "", site_name: "",
  div_code: "", div_name: "", asset_group_code: "", asset_group_name: "",
  asset_subgroup_code: "", asset_subgroup_name: "", asset_brand_code: "", asset_brand_name: "",
  asset_ac_code: "", dprc_ac_code: "", accudprc_ac_code: "", dprc_percentage: "0.000",
  dprc_commence_date: "", doc_type: "", doc_no: "", asset_properties: "", purchase_date: "",
  quantity: "1.000", price: "0.000", amount: "0.000", supplier_name: "",
  supplier_ac_code: "", supp_code: "", status: "Y",
};

function mapAsset(row: LookupRow): TAssetRow {
  return {
    ...EMPTY_ASSET,
    company_code: String(getLookupValue(row, "company_code") || ""),
    asset_id: String(getLookupValue(row, "asset_id") || ""),
    asset_name: String(getLookupValue(row, "asset_name") || ""),
    site_code: String(getLookupValue(row, "site_code") || ""),
    site_name: String(getLookupValue(row, "site_name") || ""),
    div_code: String(getLookupValue(row, "div_code") || ""),
    div_name: String(getLookupValue(row, "div_name") || ""),
    asset_group_code: String(getLookupValue(row, "asset_group_code") || ""),
    asset_group_name: String(getLookupValue(row, "asset_group_name") || ""),
    asset_subgroup_code: String(getLookupValue(row, "asset_subgroup_code") || ""),
    asset_subgroup_name: String(getLookupValue(row, "asset_subgroup_name") || ""),
    asset_brand_code: String(getLookupValue(row, "asset_brand_code") || ""),
    asset_brand_name: String(getLookupValue(row, "asset_brand_name") || ""),
    asset_ac_code: String(getLookupValue(row, "asset_ac_code") || ""),
    dprc_ac_code: String(getLookupValue(row, "dprc_ac_code") || ""),
    accudprc_ac_code: String(getLookupValue(row, "accudprc_ac_code") || ""),
    dprc_percentage: money(getLookupValue(row, "dprc_percentage")),
    dprc_commence_date: dateInput(getLookupValue(row, "dprc_commence_date")),
    doc_type: String(getLookupValue(row, "doc_type") || ""),
    doc_no: String(getLookupValue(row, "doc_no") || ""),
    asset_properties: String(getLookupValue(row, "asset_properties") || ""),
    purchase_date: dateInput(getLookupValue(row, "purchase_date")),
    quantity: money(getLookupValue(row, "quantity") || 1),
    price: money(getLookupValue(row, "price")),
    amount: money(getLookupValue(row, "amount")),
    supplier_name: String(getLookupValue(row, "supplier_name") || ""),
    supplier_ac_code: String(getLookupValue(row, "supplier_ac_code") || ""),
    supp_code: String(getLookupValue(row, "supp_code") || ""),
    status: String(getLookupValue(row, "status") || "Y"),
  };
}

// ===================== MAIN PAGE =====================
export function AssetRegisterPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const [rows, setRows] = useState<TAssetRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Division popup
  const [divisionOpen, setDivisionOpen] = useState(false);
  const [divisions, setDivisions] = useState<TDivisionOption[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  // Form popup
  const [popup, setPopup] = useState<PopupState>({ open: false });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<TAssetRow | null>(null);

  // ===================== LOAD ASSETS =====================
  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_register",
        loginid: loginId,
        code1: companyCode,
        code2: "NULL",
        code3: "NULL",
        code4: "NULL",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      setRows(data.map(mapAsset));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load asset register" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRows(); }, []);

  // ===================== LOAD DIVISIONS =====================
  const loadDivisions = async () => {
    setLoadingDivisions(true);
    try {
      const data = await getDynamicLookup({
        parameter: "Account_division",
        loginid: loginId,
        code1: companyCode,
        code2: "", code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      setDivisions(
        data.map((row) => ({
          div_code: String(getLookupValue(row, "div_code") || ""),
          div_name: String(getLookupValue(row, "div_name") || ""),
        }))
      );
    } catch {
      // silently fail
    } finally {
      setLoadingDivisions(false);
    }
  };

  const handleOpenDivisionPopup = () => {
    setNotice(null);
    setDivisionOpen(true);
    void loadDivisions();
  };

  const handleSelectDivision = (div: TDivisionOption) => {
    setDivisionOpen(false);
    setPopup({ open: true, mode: "create", div_code: div.div_code, div_name: div.div_name });
  };

  // ===================== TABLE FILTER =====================
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  // ===================== COLUMNS =====================
  const columns = useMemo<ColumnDef<TAssetRow>[]>(
    () => [
      {
        accessorKey: "asset_id", header: "Asset ID", size: 130,
        cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span>,
      },
      { accessorKey: "asset_name", header: "Asset Name", size: 260 },
      { accessorKey: "asset_group_code", header: "Group", size: 120 },
      { accessorKey: "asset_subgroup_code", header: "Subgroup", size: 130 },
      { accessorKey: "asset_brand_code", header: "Brand", size: 120 },
      { accessorKey: "asset_ac_code", header: "Asset A/C", size: 150 },
      { accessorKey: "purchase_date", header: "Purchase", size: 120 },
      { accessorKey: "quantity", header: "Qty", size: 90 },
      { accessorKey: "amount", header: "Value", size: 120 },
      { accessorKey: "status", header: "Status", size: 90 },
      {
        id: "actions", header: "Actions", enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost"
              onClick={() => { setNotice(null); setPopup({ open: true, mode: "view", asset_id: row.original.asset_id, div_code: row.original.div_code, div_name: row.original.div_name }); }}>
              <Eye size={15} />
            </Button>
            <Button size="icon" variant="ghost"
              onClick={() => { setNotice(null); setPopup({ open: true, mode: "edit", asset_id: row.original.asset_id, div_code: row.original.div_code, div_name: row.original.div_name }); }}>
              <Edit2 size={15} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row.original)}>
              <Trash2 size={15} />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  // ===================== DELETE =====================
  const deleteRow = async () => {
    if (!deleteTarget) return;
    try {
      await executeDynamicDelete({
        parameter: "AC_ASSETS_delete_asset_register",
        loginid: loginId,
        code1: deleteTarget.asset_id,
        code2: companyCode,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Asset deleted successfully" });
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete asset" });
    }
  };

  const closeForm = () => {
    setNotice(null);
    setPopup({ open: false });
  };

  const handleFormSaved = async () => {
    setPopup({ open: false });
    setNotice({ type: "success", message: "Asset saved successfully" });
    await loadRows(false);
  };

  // ===================== INLINE EDITOR VIEW =====================
  if (popup.open) {
    return (
      <AddAssetRegisterForm
        key={`${popup.mode}_${popup.asset_id || "new"}`}
        mode={popup.mode}
        asset_id={popup.mode !== "create" ? popup.asset_id : undefined}
        div_code={popup.div_code}
        div_name={popup.div_name}
        companyCode={companyCode}
        loginId={loginId}
        onClose={closeForm}
        onSaved={handleFormSaved}
      />
    );
  }

  // ===================== LIST VIEW =====================
  return (
    <section className="finance-utility-page finance-list-page grid gap-4">
      {/* Page Header - Matching Prepaid Register */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <Boxes size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Asset Register</h1>
            <p className="m-0 text-xs text-slate-500">Asset Utility</p>
          </div>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={filteredRows}
          title={loading ? "Loading" : `${filteredRows.length} Records`}
          subtitle="Assets"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search asset id, name, account..."
          loading={loading}
          emptyText="No assets found"
          height={650}
          minWidth={1450}
          density="grid"
          enableExport={false}
          actionButton={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="h-8 gap-1.5 px-3.5 rounded-lg bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold cursor-pointer transition-colors"
                title="Create Asset"
                onClick={handleOpenDivisionPopup}
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
              <FinanceListActionsMenu
                onExport={() =>
                  exportToCsv(
                    filteredRows,
                    columns.filter((column) => column.id !== "actions"),
                    "asset-register.csv",
                  )
                }
                onRefresh={() => void loadRows(false)}
              />
            </div>
          }
          getRowId={(row, index) => `${row.asset_id || "new"}_${index}`}
        />
      </div>

      <DivisionPickerDialog
        open={divisionOpen}
        divisions={divisions}
        loading={loadingDivisions}
        description="Choose a division to create a new asset."
        onSelect={(div) => handleSelectDivision(div)}
        onClose={() => setDivisionOpen(false)}
      />

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Asset"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>Delete</Button>
            </>
          }
        >
          <p className="modal-copy">Delete <strong>{deleteTarget.asset_id}</strong>?</p>
        </Dialog>
      )}
    </section>
  );
}