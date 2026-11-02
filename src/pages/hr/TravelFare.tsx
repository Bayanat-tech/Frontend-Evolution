import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Edit2, Eye, FileText, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { executeDynamicDelete, getDynamicLookup } from "../../api/lookups";
import { useToast } from "../../components/ui/AlertToast";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { useAuth } from "../../state/AuthContext";
import { AddTravelFareForm, FARE_CLASS_OPTIONS, type TravelFareFormHandle } from "./Addtravelfareform";

export type TravelFareRow = {
  airport_code: string;
  airport_name: string;
  airport_short_name?: string;
  destination_country?: string;
  curr_code?: string;
  ex_rate?: number | string | null;
  fair_class?: string;
  adult_ticket_fair?: number | string | null;
  child_ticket_fair?: number | string | null;
  infant_ticket_fair?: number | string | null;
  fc_adult_fair?: number | string | null;
  fc_child_fair?: number | string | null;
  fc_infant_fair?: number | string | null;
  remarks?: string;
  status?: string;
  [key: string]: unknown;
};

type EditorMode = "add" | "edit" | "view";

// Backend rows may come back lower- or upper-case; read either.
const pick = (r: Record<string, unknown>, key: string) => r[key] ?? r[key.toUpperCase()];

export default function TravelFare() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [rows, setRows] = useState<TravelFareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // view state
  const [view, setView] = useState<"list" | "editor">("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("add");
  const [activeRow, setActiveRow] = useState<TravelFareRow | null>(null);
  const [saving, setSaving] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<TravelFareRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ref to the form so the header Save button can trigger it
  const formRef = useRef<TravelFareFormHandle>(null);

  const loadRows = useCallback(async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const data = await getDynamicLookup({
        parameter: "HR_TRAVEL_FARE_DATA_TABLE",
        code1: companyCode,
      });
      const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      // Keep every field the backend returns so the edit form can populate from the row.
      setRows(
        raw.map((r) => ({
          ...(r as TravelFareRow),
          airport_code: String(pick(r, "airport_code") ?? ""),
          airport_name: String(pick(r, "airport_name") ?? ""),
          airport_short_name: String(pick(r, "airport_short_name") ?? ""),
          destination_country: String(pick(r, "destination_country") ?? ""),
          curr_code: String(pick(r, "curr_code") ?? ""),
          ex_rate: pick(r, "ex_rate") as TravelFareRow["ex_rate"],
          fair_class: String(pick(r, "fair_class") ?? ""),
          adult_ticket_fair: pick(r, "adult_ticket_fair") as TravelFareRow["adult_ticket_fair"],
          child_ticket_fair: pick(r, "child_ticket_fair") as TravelFareRow["child_ticket_fair"],
          infant_ticket_fair: pick(r, "infant_ticket_fair") as TravelFareRow["infant_ticket_fair"],
          fc_adult_fair: pick(r, "fc_adult_fair") as TravelFareRow["fc_adult_fair"],
          fc_child_fair: pick(r, "fc_child_fair") as TravelFareRow["fc_child_fair"],
          fc_infant_fair: pick(r, "fc_infant_fair") as TravelFareRow["fc_infant_fair"],
          remarks: String(pick(r, "remarks") ?? ""),
          status: String(pick(r, "status") ?? "A"),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load travel fares");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyCode]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // Client-side search (code / name / short name / country)
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.airport_code, r.airport_name, r.airport_short_name, r.destination_country].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

  /* ── Navigation handlers ── */
  const openEditor = (mode: EditorMode, row: TravelFareRow | null = null) => {
    setEditorMode(mode);
    setActiveRow(row);
    setView("editor");
  };

  const handleCloseEditor = () => {
    setView("list");
    setEditorMode("add");
    setActiveRow(null);
  };

  const handleSaved = () => {
    handleCloseEditor();
    void loadRows();
  };

  /* ── Header Save button handler ── */
  const handleHeaderSave = async () => {
    setSaving(true);
    try {
      await formRef.current?.save();
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await executeDynamicDelete({
        parameter: "MST_HR_TRAVEL_FARE_DEL",
        loginid,
        code1: companyCode,
        code2: deleteTarget.airport_code,
      });
      toast.success(`Fare code ${deleteTarget.airport_code} deleted successfully`);
      setDeleteTarget(null);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete travel fare");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<TravelFareRow>[]>(
    () => [
      { accessorKey: "airport_code", header: "Fare Code", size: 120, enableSorting: false },
      { accessorKey: "airport_name", header: "Fare Code Name", size: 240, enableSorting: false },
      { accessorKey: "airport_short_name", header: "Short Name", size: 140, enableSorting: false },
      { accessorKey: "destination_country", header: "Country", size: 120, enableSorting: false },
      { accessorKey: "curr_code", header: "Currency", size: 100, enableSorting: false },
      {
        accessorKey: "fair_class",
        header: "Class",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => {
          const val = String(getValue() ?? "");
          return FARE_CLASS_OPTIONS.find((o) => o.value === val)?.label ?? (val || "-");
        },
      },
      {
        accessorKey: "adult_ticket_fair",
        header: "Adult Fare",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="block text-right">{getValue() == null || getValue() === "" ? "-" : String(getValue())}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        enableSorting: false,
        cell: ({ getValue }) =>
          String(getValue() || "A") === "A" ? (
            <span className="text-[0.8125rem] font-semibold text-green-600">Active</span>
          ) : (
            <span className="text-[0.8125rem] font-semibold text-red-600">Inactive</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 110,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("edit", row.original)}
              title="Edit travel fare"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => openEditor("view", row.original)}
              title="View travel fare"
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete travel fare"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ─────────────────────────────────────────────────────────
     EDITOR — Full-page, Freight-style header (with Save button)
     ───────────────────────────────────────────────────────── */
  if (view === "editor") {
    const isView = editorMode === "view";
    const title =
      editorMode === "add" ? "New Travel Fare" : editorMode === "edit" ? "Edit Travel Fare" : "View Travel Fare";
    const badge = editorMode === "add" ? "Draft" : editorMode === "edit" ? "Editing" : "View only";

    return (
      <section className="freight-workspace-ui freight-enquiry-editor freight-dense-form freight-ui-standard grid gap-2">
        <div className="freight-transaction-header flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileText size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{title}</h1>
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0 text-[10.5px] leading-tight font-medium text-amber-700">
                  {badge}
                </span>
                {activeRow?.airport_code && (
                  <span className="text-xs text-muted-foreground">
                    {activeRow.airport_code}
                    {activeRow.airport_name ? ` - ${activeRow.airport_name}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: List / Close / Save (Save hidden in view mode) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <ArrowLeft size={14} /> List
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCloseEditor} disabled={saving}>
              <X size={14} /> Close
            </Button>
            {!isView && (
              <Button type="button" size="sm" onClick={handleHeaderSave} disabled={saving}>
                <Save size={14} /> {saving ? "Saving" : "Save"}
              </Button>
            )}
          </div>
        </div>

        <AddTravelFareForm
          key={activeRow?.airport_code || "new"}
          ref={formRef}
          mode={editorMode}
          existingData={activeRow ?? undefined}
          onClose={(shouldRefetch?: boolean) => (shouldRefetch ? handleSaved() : handleCloseEditor())}
        />
      </section>
    );
  }

  /* ─────────────────────────────────────────────────────────
     LIST VIEW — Freight style (buttons inside DataTable toolbar)
     ───────────────────────────────────────────────────────── */
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <h2
          className="text-foreground m-0"
          style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
        >
          Travel Fare
        </h2>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length.toLocaleString()} Travel Fares`}
        subtitle="Airport / travel ticket fares"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search fare code, name..."
        loading={loading}
        emptyText="No travel fares found"
        height={560}
        minWidth={1000}
        density="grid"
        enablePagination
        pageSize={100}
        getRowId={(row, index) => row.airport_code || `temp-${index}`}
        enableExport
        exportFilename="travel-fares-list.csv"
        toolbar={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRows()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => openEditor("add")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Travel Fare
            </button>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        title="Delete Travel Fare"
        description={deleteTarget ? `Delete ${deleteTarget.airport_code} - ${deleteTarget.airport_name}?` : undefined}
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
        <p className="m-0 text-sm text-muted-foreground">
          This action cannot be undone. Are you sure you want to delete fare code{" "}
          <strong>{deleteTarget?.airport_code}</strong>?
        </p>
      </Dialog>
    </section>
  );
}