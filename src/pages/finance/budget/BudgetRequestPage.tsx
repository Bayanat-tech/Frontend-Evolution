import { Download, Edit2, Plus, Printer, RefreshCw } from "lucide-react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Division, getDivisions } from "../../../api/transactions";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { BudgetEditorState, BudgetRequestEditor } from "./BudgetRequestEditor";
import {  getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";


// TODO: replace with the real budget-request row shape once the backend contract is confirmed.
export interface BudgetRequestRow {
  request_number: string;
  div_code: string;
  div_name?: string;
  budget_year: string;
  request_date: string;
  curr_code?: string;
  description?: string;
  status?: string;
  canceled?: string;
}

// TODO: swap for a real API call, e.g. cancelBudgetRequest(budgetNo)
async function cancelBudgetRequestApi(_budgetNo: string): Promise<void> {
  return;
}

export function BudgetRequestPage({ onClose }: { onClose?: () => void } = {}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<BudgetRequestRow[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<BudgetEditorState>(null);
  const [cancelTarget, setCancelTarget] = useState<BudgetRequestRow | null>(null);
  const [divisionPicker, setDivisionPicker] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const loadLookups = async () => {
    const divisionData = await getDivisions();
    setDivisions(divisionData);
  };

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await fetchBudgetRequests();
      setRows(response);
      setTotalRows(response.length);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load budget requests" });
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetRequests = async () => {
    const response = await getDynamicLookup({
      parameter: "Account_Budget_PAGE",
      code1: user?.company_code,
      loginid: user?.loginid || user?.username || "ADMIN",
    });
    return response as unknown as BudgetRequestRow[];
  };

  useEffect(() => {
    
    void loadLookups().catch((error) => {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load lookups" });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void loadRows();
  }, [query, pageIndex, pageSize, columnFilters]);

  const columns = useMemo<ColumnDef<BudgetRequestRow>[]>(() => [
    {
      accessorKey: "request_number",
      header: "Budget Number",
      cell: ({ row }) => <span className="font-semibold">{row.original.request_number}</span>,
    },
    { accessorKey: "request_date", header: "Request Date", cell: ({ getValue }) => formatDate(getValue()) },
    { accessorKey: "div_code", header: "Div" },
    { accessorKey: "div_name", header: "Division Name" },
    { accessorKey: "curr_code", header: "Currency" },
    { accessorKey: "description", header: "Description" },
    {
      accessorKey: "canceled",
      header: "Status",
      cell: ({ getValue }) => String(getValue() || "N") === "Y" ? <Badge variant="outline" className="border-destructive text-destructive">Cancelled</Badge> : <Badge>Active</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditor({ mode: "edit", row: row.original })} title="Edit">
            <Edit2 size={15} />
          </Button>
          <Button size="icon" variant="ghost" title="Print / PDF">
            <Printer size={15} />
          </Button>
          <Button size="icon" variant="ghost" title="Excel">
            <Download size={15} />
          </Button>
        </div>
      ),
    },
  ], []);

  const openCreateForDivision = (division: Division) => {
    setDivisionPicker(false);
    setEditor({ mode: "create", divCode: division.div_code, divName: division.div_name });
  };

  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Budget Request</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Project budget request document</p>
        </div>
        <div className="finance-list-actions">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => void loadRows()}>
            <RefreshCw size={15} />
          </Button>
          <Button title="Add Budget Request" onClick={() => setDivisionPicker(true)}>
            <Plus size={15} /> Add
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${totalRows.toLocaleString()} Budget Requests`}
          subtitle="Budget Request List"
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search budget no, division, description..."
          loading={loading}
          emptyText="No budget requests found"
          height={620}
          minWidth={1000}
          density="grid"
          enablePagination
          manualPagination
          enableExport
          exportFilename="budget-requests.csv"
          initialSorting={[{ id: "request_date", desc: true }]}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={totalRows}
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters) => {
            setColumnFilters(filters);
            setPageIndex(0);
          }}
          onPageChange={setPageIndex}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPageIndex(0);
          }}
          getRowId={(row, index) => `${row.request_number}_${index}`}
        />
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-background">
          <BudgetRequestEditor
            key={editor?.mode === "edit" ? editor.row.request_number : editor?.mode || "create"}
            editor={editor}
            onClose={() => setEditor(null)}
            onSaved={async (message) => {
              setEditor(null);
              setNotice({ type: "success", message });
              await loadRows(false);
            }}
          />
        </div>
      )}

      <Dialog
        open={divisionPicker}
        title="Select Division"
        description="Choose the division before opening the budget request form."
        onClose={() => setDivisionPicker(false)}
        footer={<Button variant="outline" onClick={() => setDivisionPicker(false)}>Cancel</Button>}
      >
        <div className="grid max-h-[420px] gap-2 overflow-auto">
          {divisions.map((division) => (
            <button
              key={division.div_code}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => openCreateForDivision(division)}
              type="button"
            >
              <span className="font-medium">{division.div_name}</span>
              <span className="text-muted-foreground">{division.div_code}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </section>
  );
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

