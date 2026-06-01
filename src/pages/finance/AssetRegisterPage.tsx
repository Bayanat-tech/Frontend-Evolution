import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  executeDynamicDelete,
  getDynamicLookup,
  getLookupValue,
  type LookupRow,
} from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../state/AuthContext";
import { AddAssetRegisterForm } from "./AddAssetRegisterForm";

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

function value(row: LookupRow, field: string) {
  return String(getLookupValue(row, field) || "");
}

function money(raw: unknown) {
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : "0.000";
}

function dateValue(raw: unknown) {
  if (!raw) return "";
  const text = String(raw);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function mapAsset(row: LookupRow): TAssetRow {
  return {
    company_code: value(row, "company_code"),
    asset_id: value(row, "asset_id"),
    asset_name: value(row, "asset_name"),
    site_code: value(row, "site_code"),
    site_name: value(row, "site_name"),
    div_code: value(row, "div_code"),
    div_name: value(row, "div_name"),
    asset_group_code: value(row, "asset_group_code"),
    asset_group_name: value(row, "asset_group_name"),
    asset_subgroup_code: value(row, "asset_subgroup_code"),
    asset_subgroup_name: value(row, "asset_subgroup_name"),
    asset_brand_code: value(row, "asset_brand_code"),
    asset_brand_name: value(row, "asset_brand_name"),
    asset_ac_code: value(row, "asset_ac_code"),
    dprc_ac_code: value(row, "dprc_ac_code"),
    accudprc_ac_code: value(row, "accudprc_ac_code"),
    dprc_percentage: money(getLookupValue(row, "dprc_percentage")),
    dprc_commence_date: dateValue(getLookupValue(row, "dprc_commence_date")),
    doc_type: value(row, "doc_type"),
    doc_no: value(row, "doc_no"),
    asset_properties: value(row, "asset_properties"),
    purchase_date: dateValue(getLookupValue(row, "purchase_date")),
    quantity: money(getLookupValue(row, "quantity")),
    price: money(getLookupValue(row, "price")),
    amount: money(getLookupValue(row, "amount")),
    supplier_name: value(row, "supplier_name"),
    supplier_ac_code: value(row, "supplier_ac_code"),
    supp_code: value(row, "supp_code"),
    status: value(row, "status") || value(row, "active_flag") || "Y",
  };
}

export function AssetRegisterPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";

  const [rows, setRows] = useState<TAssetRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [divisionOpen, setDivisionOpen] = useState(false);
  const [divisionSearch, setDivisionSearch] = useState("");
  const [divisions, setDivisions] = useState<TDivisionOption[]>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  const [popup, setPopup] = useState<PopupState>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<TAssetRow | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_register",
        loginid: loginId,
        code1: companyCode,
        code2: "",
        code3: "NULL",
        code4: "NULL",
        number1: 0,
        number2: 0,
        number3: 0,
        number4: 0,
        date1: null,
        date2: null,
        date3: null,
        date4: null,
      });
      setRows(data.map(mapAsset));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load asset register",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

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
      setDivisions([]);
    } finally {
      setLoadingDivisions(false);
    }
  };

  const handleOpenDivisionPopup = () => {
    setDivisionSearch("");
    setDivisionOpen(true);
    void loadDivisions();
  };

  const handleSelectDivision = (division: TDivisionOption) => {
    setDivisionOpen(false);
    setPopup({
      open: true,
      mode: "create",
      div_code: division.div_code,
      div_name: division.div_name,
    });
  };

  const filteredDivisions = useMemo(() => {
    const term = divisionSearch.trim().toLowerCase();
    if (!term) return divisions;
    return divisions.filter(
      (division) =>
        division.div_code.toLowerCase().includes(term) ||
        division.div_name.toLowerCase().includes(term)
    );
  }, [divisionSearch, divisions]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      Object.values(row).some((fieldValue) => String(fieldValue ?? "").toLowerCase().includes(term))
    );
  }, [query, rows]);

  const columns = useMemo<ColumnDef<TAssetRow>[]>(
    () => [
      {
        accessorKey: "asset_id",
        header: "Asset ID",
        size: 140,
        cell: ({ getValue }) => <span className="font-semibold">{String(getValue() || "")}</span>,
      },
      { accessorKey: "asset_name", header: "Asset Name", size: 240 },
      { accessorKey: "asset_group_name", header: "Group", size: 180 },
      { accessorKey: "asset_brand_name", header: "Brand", size: 160 },
      { accessorKey: "site_name", header: "Site", size: 160 },
      { accessorKey: "div_code", header: "Div", size: 90 },
      { accessorKey: "purchase_date", header: "Purchase Date", size: 130 },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 130,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{String(getValue() || "0.000")}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        size: 130,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="View"
              onClick={() =>
                setPopup({
                  open: true,
                  mode: "view",
                  asset_id: row.original.asset_id,
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
              title="Edit"
              onClick={() =>
                setPopup({
                  open: true,
                  mode: "edit",
                  asset_id: row.original.asset_id,
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
              title="Delete"
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
        parameter: "AC_ASSETS_delete_asset_register",
        loginid: loginId,
        code1: companyCode,
        code2: deleteTarget.asset_id,
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: "Asset deleted successfully" });
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete asset",
      });
    }
  };

  const handleFormSaved = async () => {
    setPopup({ open: false });
    setNotice({ type: "success", message: "Asset saved successfully" });
    await loadRows();
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Asset Utility</p>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Asset Register</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={handleOpenDivisionPopup}>
            <Plus size={15} /> Add Asset
          </Button>
        </div>
      </div>

      {notice && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Records`}
        subtitle="Assets"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search asset register..."
        loading={loading}
        emptyText="No assets found"
        height={650}
        minWidth={1260}
        density="grid"
        getRowId={(row, index) => `${row.asset_id || "new"}_${index}`}
      />

      <div className="[&_.w-\\[min\\(96vw\\,560px\\)\\]]:!w-[min(96vw,600px)] [&_.w-\\[min\\(96vw\\,560px\\)\\]]:!max-w-[600px]">
        <Dialog
          open={divisionOpen}
          compact
          title="Select Division"
          description="Choose a division to create a new asset."
          onClose={() => setDivisionOpen(false)}
          footer={
            <Button variant="outline" onClick={() => setDivisionOpen(false)}>
              Cancel
            </Button>
          }
        >
          <div className="grid gap-3 min-w-[480px]">
            <Input
              placeholder="Search division..."
              value={divisionSearch}
              onChange={(event) => setDivisionSearch(event.target.value)}
            />

            <div className="grid max-h-72 gap-1 overflow-y-auto rounded-md border bg-muted/30 p-1">
              {loadingDivisions ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading divisions...</div>
              ) : filteredDivisions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No divisions found</div>
              ) : (
                filteredDivisions.map((division) => (
                  <button
                    key={division.div_code}
                    type="button"
                    onClick={() => handleSelectDivision(division)}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <div>
                      <span className="font-medium">{division.div_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{division.div_code}</span>
                    </div>
                    <Building2 size={14} className="shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>
        </Dialog>
      </div>

      {popup.open && (
        <div className="[&_.w-\\[min\\(96vw\\,560px\\)\\]]:!w-[min(96vw,1120px)] [&_.w-\\[min\\(96vw\\,560px\\)\\]]:!max-w-[1120px]">
          <Dialog
            open
            title={
              popup.mode === "create"
                ? "Add Asset"
                : popup.mode === "edit"
                ? "Edit Asset"
                : "View Asset"
            }
            onClose={() => setPopup({ open: false })}
            footer={null}
          >
            <AddAssetRegisterForm
              mode={popup.mode}
              asset_id={popup.mode !== "create" ? popup.asset_id : undefined}
              div_code={popup.div_code}
              div_name={popup.div_name}
              companyCode={companyCode}
              loginId={loginId}
              onClose={() => setPopup({ open: false })}
              onSaved={handleFormSaved}
            />
          </Dialog>
        </div>
      )}

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
            Delete <strong>{deleteTarget.asset_id}</strong>?
          </p>
        </Dialog>
      )}
    </section>
  );
}
