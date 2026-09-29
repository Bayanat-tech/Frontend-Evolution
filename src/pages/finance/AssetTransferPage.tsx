import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2, Building2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { DivisionPickerDialog } from "../../components/ui/DivisionPickerDialog";
import { Input } from "../../components/ui/Input";
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

  // Division select popup
  const [divisionOpen, setDivisionOpen] = useState(false);
  const [divisionSearch, setDivisionSearch] = useState("");
  const [divisions, setDivisions] = useState<TDivisionOption[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  // Form popup
  const [popup, setPopup] = useState<PopupState>({ open: false });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<TAssetTransferHeader | null>(null);

  // ===================== LOAD TRANSFERS =====================
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

  // ===================== LOAD DIVISIONS =====================
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
    setDivisionSearch("");
    setDivisionOpen(true);
    void loadDivisions();
  };

  const handleSelectDivision = (div: TDivisionOption) => {
    setDivisionOpen(false);
    setPopup({ open: true, mode: "create", div_code: div.div_code, div_name: div.div_name });
  };

  const filteredDivisions = useMemo(() => {
    const term = divisionSearch.trim().toLowerCase();
    if (!term) return divisions;
    return divisions.filter(
      (d) =>
        d.div_code.toLowerCase().includes(term) ||
        d.div_name.toLowerCase().includes(term)
    );
  }, [divisions, divisionSearch]);

  // ===================== TABLE FILTER =====================
  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  // ===================== COLUMNS =====================
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
              onClick={() =>
                setPopup({
                  open: true,
                  mode: "view",
                  doc_no: row.original.doc_no,
                  div_code: row.original.div_code,
                  div_name: row.original.div_name,
                })
              }
            >
              <Eye size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setPopup({
                  open: true,
                  mode: "edit",
                  doc_no: row.original.doc_no,
                  div_code: row.original.div_code,
                  div_name: row.original.div_name,
                })
              }
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

  // ===================== DELETE =====================
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

  const handleFormSaved = async () => {
    setPopup({ open: false });
    setNotice({ type: "success", message: "Asset transfer saved successfully" });
    await loadRows();
  };

  // ===================== RENDER =====================
  return (
    <section className="finance-utility-page finance-list-page grid gap-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Asset Utility</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Asset Transfer</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={handleOpenDivisionPopup}>
            <Plus size={15} /> Create Transfer
          </Button>
        </div>
      </div>

      {notice && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      {/* Table */}
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

      {/* ===================== DIVISION SELECT DIALOG ===================== */}
      <DivisionPickerDialog
        open={divisionOpen}
        divisions={divisions}
        loading={loadingDivisions}
        description="Choose a division to create a new asset transfer."
        onSelect={(div) => handleSelectDivision(div)}
        onClose={() => setDivisionOpen(false)}
      />

      {/* ===================== ADD / EDIT / VIEW FORM DIALOG ===================== */}
      {popup.open && (
        <>
          <style>{`
            .asset-transfer-dialog [class*="rounded-lg"][class*="border"][class*="bg-card"] {
              width: min(96vw, 1000px) !important;
              max-width: min(96vw, 1000px) !important;
            }
          `}</style>
          <div className="asset-transfer-dialog">
          <Dialog
            open
            title={
              popup.mode === "create"
                ? "Create Asset Transfer"
                : popup.mode === "edit"
                ? "Edit Asset Transfer"
                : "View Asset Transfer"
            }
            onClose={() => setPopup({ open: false })}
            footer={null}
          >
            <AddAssetTransferForm
              mode={popup.mode}
              doc_no={popup.mode !== "create" ? popup.doc_no : undefined}
              div_code={popup.div_code}
              div_name={popup.div_name}
              doc_type="ATR"
              companyCode={companyCode}
              loginId={loginId}
              onClose={() => setPopup({ open: false })}
              onSaved={handleFormSaved}
            />
          </Dialog>
          </div>
        </>
      )}

      {/* ===================== DELETE CONFIRM ===================== */}
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
