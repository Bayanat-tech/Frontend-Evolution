import { Download, Edit2, Plus, Printer, RefreshCw } from "lucide-react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";
import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { TabStrip } from "../../vendor/components";
import { AbsentProcessEditor } from "./AbsentProcessEditor";
import { AbsentProcessEditorState, AbsentProcessRow } from "./Absentprocesstypes";

type AbsentProcessTab = "ACTIVE" | "REVERSED";

export function AbsentProcessPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AbsentProcessRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AbsentProcessTab>("ACTIVE");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<AbsentProcessEditorState>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const response = await getDynamicLookup({
        parameter: "PS_ABSENT_PROCESS_ENTRY_TAB_List",
        code1: user?.company_code,
        code2: user?.loginid || user?.username || "ADMIN",
        code3: tab,
      });
      const data = response as unknown as AbsentProcessRow[];
      setRows(data);
      setTotalRows(data.length);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to load absent process documents" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [tab, query, pageIndex, pageSize, columnFilters]);

  const columns = useMemo<ColumnDef<AbsentProcessRow>[]>(
    () => [
      {
        accessorKey: "doc_no",
        header: "Doc No",
        cell: ({ row }) => <span className="font-semibold">{row.original.doc_no}</span>,
      },
      { accessorKey: "doc_date", header: "Doc Date", cell: ({ getValue }) => formatDate(getValue()) },
      { accessorKey: "employee_code", header: "Employee Code" },
      { accessorKey: "employee_name", header: "Employee Name" },
      { accessorKey: "letter_subject", header: "Subject" },
      {
        accessorKey: "total_days",
        header: "Days",
        cell: ({ getValue }) => <span className="tabular-nums">{Number(getValue() || 0)}</span>,
      },
      {
        accessorKey: "total_amount",
        header: "Amount",
        cell: ({ getValue }) => <span className="tabular-nums">{Number(getValue() || 0).toFixed(2)}</span>,
      },
      {
        accessorKey: "canceled",
        header: "Status",
        cell: ({ getValue }) =>
          String(getValue() || "N") === "Y" ? (
            <Badge variant="outline" className="border-destructive text-destructive">
              Reversed
            </Badge>
          ) : (
            <Badge>Active</Badge>
          ),
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
    ],
    [],
  );

  return (
    <section className="finance-list-page grid gap-4">
      <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Absent Process</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Employee absence letters and deduction entries</p>
        </div>
        <div className="finance-list-actions">
          <Button variant="outline" size="icon" title="Refresh" aria-label="Refresh" onClick={() => void loadRows()}>
            <RefreshCw size={15} />
          </Button>
          {tab === "ACTIVE" && (
            <Button title="Add Absent Process" onClick={() => setEditor({ mode: "create" })}>
              <Plus size={15} /> Add
            </Button>
          )}
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      <TabStrip
        value={tab}
        onChange={(value) => setTab(value as AbsentProcessTab)}
        tabs={[
          { label: "Active", value: "ACTIVE", icon: "pending" },
          { label: "Reversed", value: "REVERSED", icon: "canceled" as const },
        ]}
      />

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={rows}
          title={loading ? "Loading" : `${totalRows.toLocaleString()} Absent Process Documents`}
          subtitle="Absent Process List"
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search doc no, employee..."
          loading={loading}
          emptyText="No absent process documents found"
          height={620}
          minWidth={1000}
          density="grid"
          enablePagination
          manualPagination
          enableExport
          exportFilename="absent-process.csv"
          initialSorting={[{ id: "doc_date", desc: true }]}
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
          getRowId={(row, index) => `${row.doc_no}_${index}`}
        />
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 bg-background">
          <AbsentProcessEditor
            key={editor?.mode === "edit" ? editor.row.doc_no : editor?.mode || "create"}
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
    </section>
  );
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}