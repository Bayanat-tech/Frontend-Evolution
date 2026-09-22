import { Download, Edit2, Eye, Plus, Printer, RefreshCw } from "lucide-react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Division, getDivisions } from "../../../api/transactions";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { AutoDismissAlert } from "../../../components/ui/AutoDismissAlert";

import { getDynamicLookup } from "../../../api/lookups";
import { useAuth } from "../../../state/AuthContext";
import { TabStrip } from "../../vendor/components";
import { PurchaseOrderEditorState } from "../../purchase_sales/purchase/Purchaseordereditor";
import { SalesDNEditor } from "./SalesDNeditor";
import { SDN_CONFIG } from "./SalesOrdertypes";
import ReportDialogPage from "../../../components/ReportDialogPage";
import { SalesDNReport, downloadSalesDNExcel } from "./SalesDNReport";

// TODO: replace with the real purchase-order row shape once the backend contract is confirmed.
export interface SalesOrderRow {
  doc_type: string;
  doc_no: string;
  doc_date: string;
  quotn_no?: string;
  quotn_date?: string;
  div_code: string;
  div_name?: string;
  ac_code: string;
  ac_name?: string;
  address?: string;
  credit_period?: number;
  dept_code?: string;
  tel?: string;
  fax?: string;
  buyer?: string;
  wo_no?: string;
  curr_code?: string;
  curr_name?: string;
  ex_rate?: number;
  pay_terms?: string;
  delivery_term?: string;
  delivery_contact?: string;
  delivery_tel?: string;
  delivery_email?: string;
  remarks?: string;
  disc_amt?: number;
  disc_pct?: number;
  tax_category?: string;
  tax_code?: string;
  expense_ac_post?: string;
  print_on_letterhead?: string;
  project_name?: string;
  pr_no?: string;
  scope_of_work?: string;
  status?: string;
  canceled?: string;
  flow_level_running?: number;
  flow_level?: number;
  sentback_reason?: string;
  reject_reason?: string;
  last_action?: "SENTBACK" | "REJECTED" | "APPROVED" | "CANCELED" | "PENDING" | string;
}

type RequestTab = "PENDING" | "INPROGRESS" | "CLOSED" | "CANCELED" | "REJECTED" | "SENDBACK";

export function SalesDNPage({ onClose }: { onClose?: () => void } = {}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SalesOrderRow[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RequestTab>("PENDING");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [approvalLevel, setApprovalLevel] = useState<number>(0);
  const isPendingTab = tab === "PENDING";
  const isViewOnlyTab = tab === "CLOSED" || tab === "CANCELED";
  const canViewCanceledTab = approvalLevel <= 1;
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editor, setEditor] = useState<PurchaseOrderEditorState>(null);
  const [cancelTarget, setCancelTarget] = useState<SalesOrderRow | null>(null);
  const [divisionPicker, setDivisionPicker] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({
  PENDING: 0,
  INPROGRESS: 0,
  CLOSED: 0,
  CANCELED: 0,
  REJECTED: 0,
  SENDBACK: 0,
});
  // ── Report dialog state ────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportValues, setReportValues] = useState<{
    company_code?: string;
    doc_type?: string;
    doc_no: string;
  } | null>(null);

  const openReport = (row: SalesOrderRow) => {
    setReportValues({
      company_code: user?.company_code,
      doc_type: row.doc_type || "SDN",
      doc_no: row.doc_no,
    });
    setReportOpen(true);
  };

  const closeReport = () => {
    setReportOpen(false);
    setReportValues(null);
  };

  const handleExcelFromReport = async () => {
    if (!reportValues?.doc_no) return;
    try {
      await downloadSalesDNExcel(reportValues);
    } catch (e) {
      setNotice({
        type: "error",
        message: e instanceof Error ? e.message : "Unable to export Excel",
      });
    }
  };

  const loadLookups = async () => {
    const divisionData = await getDivisions();
    setDivisions(divisionData);
  };
  const purchaseOrderTabs = [
  { value: "PENDING", label: "Pending" },
  { value: "INPROGRESS", label: "In Progress" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELED", label: "Canceled" },
  { value: "REJECTED", label: "Rejected" },
];
const getTabCount = (tabValue: string) => {
  return tabCounts[tabValue] ?? 0;
};

const loadRows = async (clearNotice = true) => {
  setLoading(true);

  if (clearNotice) setNotice(null);

  try {
    const response = await fetchPurchaseOrders();

    setRows(response);
    setTotalRows(response.length);

    setTabCounts((prev) => ({
      ...prev,
      [tab]: response.length,
    }));
  } catch (error) {
    setNotice({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to load purchase orders",
    });
  } finally {
    setLoading(false);
  }
};


  // TODO: confirm lookup parameter name against your Oracle package (mirrors MS_BUDGET_ACCOUNT_TAB__List).
  const fetchPurchaseOrders = async () => {
    const response = await getDynamicLookup({
      parameter: "PS_SDN_ENTRY_TAB_LIST",
      code1: user?.company_code,
      code2: user?.loginid || user?.username || "ADMIN",
      code3: tab,
    });

    return response as unknown as SalesOrderRow[];
  };
  const loadTabCounts = async () => {
  const visibleTabs: RequestTab[] =
    approvalLevel === 0
      ? ["PENDING", "CLOSED", "CANCELED"]
      : [
          "PENDING",
          "INPROGRESS",
          "CLOSED",
          ...(canViewCanceledTab ? ["CANCELED" as RequestTab] : []),
          "REJECTED",
        ];

  const results = await Promise.all(
    visibleTabs.map(async (tabValue) => {
      const response = await getDynamicLookup({
        parameter: "PS_POORDER_ENTRY_TAB_List",
        code1: user?.company_code,
        code2: user?.loginid || user?.username || "ADMIN",
        code3: tabValue,
      });

      return {
        tab: tabValue,
        count: response.length,
      };
    })
  );

  setTabCounts((prev) => {
    const next = { ...prev };

    results.forEach(({ tab, count }) => {
      next[tab] = count;
    });

    return next;
  });
};

useEffect(() => {
  if (!user?.company_code || approvalLevel === undefined) return;

  void loadTabCounts();
}, [
  user?.company_code,
  user?.loginid,
  user?.username,
  approvalLevel,
  canViewCanceledTab,
]);
  useEffect(() => {
    if (approvalLevel === 0 && !["PENDING", "CLOSED", "CANCELED"].includes(tab)) {
      setTab("PENDING");
    }
  }, [approvalLevel, tab]);

  useEffect(() => {
    void loadLookups().catch((error) => {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load lookups",
      });
      setLoading(false);
    });

    let mounted = true;
    (async () => {
      try {
        const rows = await getDynamicLookup({
          parameter: "PS_POORDER_ENTRY_FUN_CHECK_GLOBAL_APPR_LEVEL",
          code1: user?.company_code,
          code2: user?.loginid || user?.username || "ADMIN",
          code3: "purchase_order",
        });
        if (!mounted) return;
        const first = (rows || [])[0] as Record<string, unknown> | undefined;
        const level = first
          ? Number(
              first.level ?? first.flow_level ?? first.flow_level_running ?? Object.values(first)[0],
            )
          : 0;
        setApprovalLevel(Number.isFinite(level) ? level : 0);
      } catch {
        if (mounted) setApprovalLevel(0);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.company_code, user?.loginid, user?.username]);

  useEffect(() => {
    void loadRows();
  }, [tab, query, pageIndex, pageSize, columnFilters]);

  const columns = useMemo<ColumnDef<SalesOrderRow>[]>(
    () => [
      {
        accessorKey: "doc_no",
        header: "Doc No",
        cell: ({ row }) => <span className="font-semibold">{row.original.doc_no}</span>,
      },
      {
        accessorKey: "doc_date",
        header: "Doc Date",
        cell: ({ getValue }) => formatDate(getValue()),
      },
      { accessorKey: "div_code", header: "Div" },
      { accessorKey: "ac_code", header: "A/c Code" },
      { accessorKey: "ac_name", header: "A/c Name" },
      { accessorKey: "curr_code", header: "Currency" },
      {
        accessorKey: "canceled",
        header: "Status",
        cell: ({ getValue }) =>
          String(getValue() || "N") === "Y" ? (
            <Badge variant="outline" className="border-destructive text-destructive">
              Cancelled
            </Badge>
          ) : (
            <Badge>Active</Badge>
          ),
      },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (row) =>
          row.last_action === "SENTBACK" ? row.sentback_reason : row.reject_reason,
      },
      { accessorKey: "last_action", header: "Last Action" },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
         <Button
  size="icon"
  variant="ghost"
  onClick={() => setEditor({ mode: "edit", row: row.original as any })}
  title={isViewOnlyTab ? "View" : "Edit"}
>
  {isViewOnlyTab ? <Eye size={15} /> : <Edit2 size={15} />}
</Button>
            <Button
              size="icon"
              variant="ghost"
              title="Print / PDF"
              onClick={() => openReport(row.original)}
            >
              <Printer size={15} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Excel"
              onClick={async () => {
                try {
                  await downloadSalesDNExcel({
                    company_code: user?.company_code,
                    doc_type: row.original.doc_type || "SDN",
                    doc_no: row.original.doc_no,
                  });
                } catch (e) {
                  setNotice({
                    type: "error",
                    message: e instanceof Error ? e.message : "Unable to export Excel",
                  });
                }
              }}
            >
              <Download size={15} />
            </Button>
          </div>
        ),
      },
    ],
    [user?.company_code ,isViewOnlyTab],
  );

  const openCreateForDivision = (division: Division) => {
    setDivisionPicker(false);
    setEditor({ mode: "create", divCode: division.div_code, divName: division.div_name });
  };

  return (
    <section className="finance-list-page grid gap-4">
      {/* <div className="finance-list-heading">
        <div className="finance-list-title">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Sales Delivery Note</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Sales Delivery Note document</p>
        </div>
        <div className="finance-list-actions">
          <Button
            variant="outline"
            size="icon"
            title="Refresh"
            aria-label="Refresh"
            onClick={() => void loadRows()}
          >
            <RefreshCw size={15} />
          </Button>
          {tab === "PENDING" && (
            <Button title="Add Sales Delivery Note" onClick={() => setDivisionPicker(true)}>
              <Plus size={15} /> Add
            </Button>
          )}
        </div>
      </div> */}
            <div className="finance-list-title">
          <h6 className="m-0 text-xl font-semibold tracking-tight">Sales Delivery Note</h6>
        </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />
    <div className="flex flex-wrap items-center gap-1.5 pb-1">
  {purchaseOrderTabs
    .filter((item) => {
      if (approvalLevel === 0) {
        return ["PENDING", "CLOSED", "CANCELED"].includes(item.value);
      }

      if (item.value === "CANCELED" && !canViewCanceledTab) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const active = tab === item.value;

      return (
        <button
          key={item.value}
          type="button"
          onClick={() => {
            setTab(item.value as RequestTab);
            setPageIndex(0);
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            active
              ? "bg-[#00378C] text-white shadow-sm font-semibold"
              : "border border-border bg-card text-foreground hover:bg-secondary"
          }`}
        >
          <span>{item.label}</span>

          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              active
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {getTabCount(item.value)}
          </span>
        </button>
      );
    })}
</div>

      <div className="min-h-[650px]">
        <DataTable
          columns={columns}
          data={rows}
            toolbar={
            tab === "PENDING" && (
              <button
                title="Add Delivery Note"
                onClick={() => setDivisionPicker(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                Add DN
              </button>
            )
          }
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPageIndex(0);
          }}
          searchPlaceholder="Search doc no, division, vendor..."
          loading={loading}
          emptyText="No Sales Delivery Note found"
          height={620}
          minWidth={1000}
          density="grid"
          enablePagination
          manualPagination
          enableExport
          exportFilename="sales-delivery-notes.csv"
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
          <SalesDNEditor
            key={editor?.mode === "edit" ? editor.row.doc_no : editor?.mode || "create"}
            config={SDN_CONFIG}
            editor={editor}
            isPendingTab={isPendingTab}
            onClose={() => setEditor(null)}
            onSaved={async (message) => {
              setEditor(null);
              setNotice({ type: "success", message });
              await loadRows(false);
            }}
          />
        </div>
      )}

      {/* Report dialog — Print opens this; Excel downloads from API */}
      {reportOpen && reportValues && (
        <ReportDialogPage
          Report={SalesDNReport}
          required_values={reportValues}
          title={`Delivery Note - ${reportValues.doc_no}`}
          onClose={closeReport}
          excel={handleExcelFromReport}
        />
      )}

      <Dialog
        open={divisionPicker}
        title="Select Division"
        description="Choose the division before opening the Sales Delivery Note form."
        onClose={() => setDivisionPicker(false)}
        footer={
          <Button variant="outline" onClick={() => setDivisionPicker(false)}>
            Cancel
          </Button>
        }
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