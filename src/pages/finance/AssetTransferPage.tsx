import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, Trash2, Building2 } from "lucide-react";
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
import { AddAssetTransferForm } from "./AddAssetTransferForm";

export type TAssetTransferHeader = {
  doc_no: string;
  company_code: string;
  doc_type: string;
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

type TDivisionOption = {
  div_code: string;
  div_name: string;
};

type PopupState =
  | { open: false }
  | { open: true; mode: "create"; div_code: string; div_name: string; doc_no?: undefined }
  | { open: true; mode: "edit"; div_code: string; div_name: string; doc_no: string }
  | { open: true; mode: "view"; div_code: string; div_name: string; doc_no: string };

function mapHeader(row: LookupRow): TAssetTransferHeader {
  return {
    doc_no: String(getLookupValue(row, "doc_no") || ""),
    company_code: String(getLookupValue(row, "company_code") || ""),
    doc_type: String(getLookupValue(row, "doc_type") || "ATR"),
    doc_date: String(getLookupValue(row, "doc_date") || "").slice(0, 10),
    site_from: String(getLookupValue(row, "site_from") || ""),
    site_from_name: String(getLookupValue(row, "site_from_name") || ""),
    site_to: String(getLookupValue(row, "site_to") || ""),
    site_to_name: String(getLookupValue(row, "site_to_name") || ""),
    remarks: String(getLookupValue(row, "remarks") || ""),
    confirmed: String(getLookupValue(row, "confirmed") || "N"),
    div_code: String(getLookupValue(row, "div_code") || ""),
    div_name: String(getLookupValue(row, "div_name") || ""),
  };
}

export function AssetTransferPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const [rows, setRows] = useState<TAssetTransferHeader[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [divisionOpen, setDivisionOpen] = useState(false);
  const [divisions, setDivisions] = useState<TDivisionOption[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  const [popup, setPopup] = useState<PopupState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<TAssetTransferHeader | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
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

  useEffect(() => { void loadRows(); }, []);

  const loadDivisions = async () => {
    setLoadingDivisions(true);
    try {
      const data = await getDynamicLookup({
        parameter: "Account_division",
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

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  const columns = useMemo<ColumnDef<TAssetTransferHeader>[]>(
    () => [
      {
        accessorKey: "doc_no",
        header: "Document No",
        size: 140,
        cell: ({ getValue }) => (
          <span className="font-semibold">{String(getValue() || "")}</span>
        ),
      },
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
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setNotice(null);
                setPopup({
                  open: true,
                  mode: "view",
                  doc_no: row.original.doc_no,
                  div_code: row.original.div_code,
                  div_name: row.original.div_name,
                });
              }}
            >
              <Eye size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setNotice(null);
                setPopup({
                  open: true,
                  mode: "edit",
                  doc_no: row.original.doc_no,
                  div_code: row.original.div_code,
                  div_name: row.original.div_name,
                });
              }}
            >
              <Edit2 size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

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
      await loadRows(false);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete asset transfer" });
    }
  };

  const closeForm = () => {
    setNotice(null);
    setPopup({ open: false });
  };

  const handleFormSaved = async () => {
    setPopup({ open: false });
    setNotice({ type: "success", message: "Asset transfer saved successfully" });
    await loadRows(false);
  };

  // ===================== INLINE EDITOR VIEW =====================
  if (popup.open) {
    return (
      <AddAssetTransferForm
        key={`${popup.mode}_${popup.doc_no || "new"}`}
        mode={popup.mode}
        doc_no={popup.mode !== "create" ? popup.doc_no : undefined}
        div_code={popup.div_code}
        div_name={popup.div_name}
        doc_type="ATR"
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
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <Building2 size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Asset Transfer</h1>
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
          subtitle="Transfers"
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search transfer..."
          loading={loading}
          emptyText="No asset transfers found"
          height={650}
          minWidth={1120}
          density="grid"
          enableExport={false}
          actionButton={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="h-8 gap-1.5 px-3.5 rounded-lg bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold cursor-pointer transition-colors"
                title="Create Transfer"
                onClick={handleOpenDivisionPopup}
              >
                <Plus size={14} strokeWidth={2.5} /> Add
              </Button>
              <FinanceListActionsMenu
                onExport={() =>
                  exportToCsv(
                    filteredRows,
                    columns.filter((column) => column.id !== "actions"),
                    "asset-transfer.csv",
                  )
                }
                onRefresh={() => void loadRows(false)}
              />
            </div>
          }
          getRowId={(row, index) => `${row.doc_no || "new"}_${index}`}
        />
      </div>

      <DivisionPickerDialog
        open={divisionOpen}
        divisions={divisions}
        loading={loadingDivisions}
        description="Choose a division to create a new asset transfer."
        onSelect={(div) => handleSelectDivision(div)}
        onClose={() => setDivisionOpen(false)}
      />

      {deleteTarget && (
        <Dialog
          open
          compact
          tone="danger"
          title="Delete Transfer"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void deleteRow()}>
                Delete
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            Delete <strong>{deleteTarget.doc_no}</strong>?
          </p>
        </Dialog>
      )}
    </section>
  );
}