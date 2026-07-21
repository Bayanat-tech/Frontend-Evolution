import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { executeDynamicDelete, getDynamicLookupaccount } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddZoneMasterForm } from "./PS_AddZoneMasterPage";

// ─── Types ──────────────────────────────────────────────────────────────────
// Field set matches the OLD dw_erp_zone DataWindow / MSE_ZONE table exactly
// (COMPANY_CODE, ZONE_CODE, ZONE_NAME, USER_ID, USER_DT) — no invented
// columns, since the old grid only ever exposed code + name.
type ZoneRow = {
  zone_code: string;
  zone_name: string;
  [key: string]: unknown;
};

type PopupState = {
  open: boolean;
  mode: "add" | "edit" | "view";
  data: Partial<ZoneRow>;
};

// ─── Lookup / delete params — VERIFY against the actual DB proc names ──────
// Placeholder parameter names below — swap for the real
// PROC_BUILD_DYNAMIC_LOOKUP / PROC_BUILD_DYNAMIC_DELETE entries for
// MSE_ZONE if these differ.
const baseParams = (loginid: string, companyCode: string) => ({
  parameter: "PURCHASE_SALE_MSE_ZONE",
  loginid,
  code1: companyCode,
  code2: "NULL",
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

// ─── Normalizer ─────────────────────────────────────────────────────────────
// Same defensive mapping used on Product Category — the API may return
// upper/lower cased keys (zone_code / ZONE_CODE) that don't line up 1:1 with
// what the grid/form expect. Normalizing once here at the fetch boundary
// avoids touching every consumer if casing differs by environment.
const normalizeRow = (r: any): ZoneRow => ({
  ...r,
  zone_code: r.zone_code ?? r.ZONE_CODE ?? "",
  zone_name: r.zone_name ?? r.ZONE_NAME ?? "",
});

export function ZoneMasterPage() {
  const { user } = useAuth();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [popup, setPopup] = useState<PopupState>({ open: false, mode: "add", data: {} });
  const [deleteTarget, setDeleteTarget] = useState<ZoneRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── FETCH: Main grid data ──────────────────────────────────────────────
  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookupaccount(baseParams(loginid, companyCode));
      const list = Array.isArray(data) ? data : [];
      setRows(list.map(normalizeRow));
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load zone records",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loginid, companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // ─── DELETE ─────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const zoneCode = deleteTarget.zone_code ?? (deleteTarget as any).ZONE_CODE ?? "";

    if (!zoneCode) {
      console.error("Missing zone_code for delete:", deleteTarget);
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    setNotice(null);
    try {
      await executeDynamicDelete({
        parameter: "PURCHASE_SALE_MSE_ZONE_DELETE",
        loginid,
        code1: companyCode,
        code2: String(zoneCode),
      });
      setDeleteTarget(null);
      setNotice({ type: "success", message: `Zone ${zoneCode} deleted successfully.` });
      await loadRows();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete zone",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ─── COLUMNS — same columns as the old page (Zone Code, Zone Name) ────
  const columns = useMemo<ColumnDef<ZoneRow>[]>(
    () => [
      { accessorKey: "zone_code", header: "Zone Code", size: 160 },
      { accessorKey: "zone_name", header: "Zone Name", size: 260 },
      {
        id: "actions",
        header: "Actions",
        size: 120,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="Edit"
              onClick={() => setPopup({ open: true, mode: "edit", data: row.original })}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="View"
              onClick={() => setPopup({ open: true, mode: "view", data: row.original })}
            >
              <Eye size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Delete"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Zone Master</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Manage zone master records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button onClick={() => setPopup({ open: true, mode: "add", data: {} })}>
            <Plus size={15} /> Create Zone
          </Button>
        </div>
      </div>

      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        title={`${rows.length.toLocaleString()} Records`}
        subtitle="Zone Master List"
        searchPlaceholder="Search code, name..."
        loading={loading}
        height={560}
        minWidth={700}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row) => {
          const zoneCode = row.zone_code ?? (row as any).ZONE_CODE ?? "";
          return String(zoneCode);
        }}
      />

      {popup.open && (
        <Dialog
          open
          title={
            popup.mode === "add"
              ? "Add Zone"
              : popup.mode === "edit"
                ? "Edit Zone"
                : "View Zone"
          }
          onClose={() => setPopup((p) => ({ ...p, open: false }))}
        >
          <AddZoneMasterForm
            mode={popup.mode}
            existingData={popup.data}
            onClose={(shouldRefetch?: boolean) => {
              setPopup((p) => ({ ...p, open: false }));
              if (shouldRefetch) void loadRows();
            }}
          />
        </Dialog>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete Zone"
        description="This action cannot be undone."
        compact
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Confirm delete for zone <strong>{deleteTarget?.zone_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}