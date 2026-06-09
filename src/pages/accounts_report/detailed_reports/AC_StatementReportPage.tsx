import { useRef, useState } from "react";
import {
  ChevronRight,
  ChevronsRight,
  ChevronLeft,
  ChevronsLeft,
  Printer,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { getDynamicFinanceLookup, getDynamicLookup } from "../../../api/lookups";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import ReportDialogPage from "../../../components/ReportDialogPage";
// import { AgGridReact } from "ag-grid-react";
// import type { ColDef } from "ag-grid-community";
// import { useQuery } from "@tanstack/react-query";
// import { useAuth } from "../../state/AuthContext";
// import { Button } from "../../components/ui/Button";
// import { Select } from "../../components/ui/Select";
// import { getDynamicLookup, getDynamicFinanceLookup } from "../../api/lookups";
// import ReportDialogPage from "../../report/ReportDialogPage";
// import AC_StatementReport from "./AC_StatementReport";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRowKey = (row: any, tab: "acCode" | "group"): string =>
  tab === "acCode" ? String(row.ac_code ?? "") : String(row.l4_code ?? "");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function formatDisplay(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Column Defs ──────────────────────────────────────────────────────────────

const defaultColDef: ColDef = { sortable: true, filter: true, resizable: true };

const groupColumnDefs: ColDef[] = [
  {
    headerCheckboxSelection: true,
    checkboxSelection: true,
    filter: false,
    maxWidth: 50,
    pinned: "left",
    headerCheckboxSelectionFilteredOnly: true,
  },
  { headerName: "L4 Code", field: "l4_code", flex: 1 },
  { headerName: "Description", field: "description", flex: 3 },
];

const acCodeColumnDefs: ColDef[] = [
  {
    headerCheckboxSelection: true,
    checkboxSelection: true,
    filter: false,
    maxWidth: 50,
    pinned: "left",
    headerCheckboxSelectionFilteredOnly: true,
  },
  { headerName: "AC Code", field: "ac_code", flex: 1 },
  { headerName: "AC Name", field: "ac_name", flex: 2 },
  { headerName: "Currency", field: "curr_code", flex: 1 },
];

// ─── Transfer Button ──────────────────────────────────────────────────────────

function TransferBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AC_StatementReportPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginId = user?.loginid ?? "";

  const leftGridRef = useRef<any>(null);
  const rightGridRef = useRef<any>(null);

  const [dateFrom, setDateFrom] = useState(startOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [currency, setCurrency] = useState<"local" | "foreign">("local");
  const [division, setDivision] = useState("");
  const [activeTab, setActiveTab] = useState<"acCode" | "group">("group");
  const [selected, setSelected] = useState<any[]>([]);
  const [highlightedLeft, setHighlightedLeft] = useState<string[]>([]);
  const [highlightedRight, setHighlightedRight] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: divisionData } = useQuery({
    queryKey: ["division-list", companyCode],
    queryFn: () =>
      getDynamicLookup({
        parameter: "Account_division",
        loginid: loginId,
        code1: companyCode,
        code2: "", code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      }),
  });

  const { data: acCodeData } = useQuery({
    queryKey: ["ac-code-list", companyCode, division],
    enabled: !!division,
    queryFn: () =>
      getDynamicFinanceLookup({
        parameter: "Account_Report_AC",
        loginid: loginId,
        code1: companyCode,
        code2: division,
        code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      }),
  });

  const { data: groupData } = useQuery({
    queryKey: ["group-list", companyCode, division],
    enabled: !!division,
    queryFn: () =>
      getDynamicFinanceLookup({
        parameter: "Account_Report_Group",
        loginid: loginId,
        code1: companyCode,
        code2: division,
        code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      }),
  });

  const availableData: any[] =
    activeTab === "acCode" ? (acCodeData ?? []) : (groupData ?? []);
  const selectedKeys = new Set(selected.map((r) => getRowKey(r, activeTab)));
  const filteredAvailable = availableData.filter(
    (r) => !selectedKeys.has(getRowKey(r, activeTab))
  );

  // ── Clear helpers ─────────────────────────────────────────────────────────

  const clearLeft = () => {
    setHighlightedLeft([]);
    leftGridRef.current?.api?.deselectAll();
  };
  const clearRight = () => {
    setHighlightedRight([]);
    rightGridRef.current?.api?.deselectAll();
  };

  // ── Transfer logic ────────────────────────────────────────────────────────

  const moveRight = () => {
    const moving = filteredAvailable.filter((r) =>
      highlightedLeft.includes(getRowKey(r, activeTab))
    );
    if (!moving.length) return;
    setSelected((p) => [...p, ...moving]);
    clearLeft();
  };

  const moveAllRight = () => {
    setSelected((p) => {
      const existing = new Set(p.map((r) => getRowKey(r, activeTab)));
      return [...p, ...filteredAvailable.filter((r) => !existing.has(getRowKey(r, activeTab)))];
    });
    clearLeft();
  };

  const moveLeft = () => {
    const removing = new Set(highlightedRight);
    setSelected((p) => p.filter((r) => !removing.has(getRowKey(r, activeTab))));
    clearRight();
  };

  const moveAllLeft = () => {
    setSelected([]);
    clearRight();
  };

  const handleReset = () => {
    setSelected([]);
    clearLeft();
    clearRight();
  };

  // ── AG Grid handlers ──────────────────────────────────────────────────────

  const onLeftSelectionChanged = (e: any) => {
    const keys: string[] = [];
    e.api.forEachNode((node: any) => {
      if (node.isSelected()) keys.push(getRowKey(node.data, activeTab));
    });
    setHighlightedLeft(keys);
  };

  const onRightSelectionChanged = (e: any) => {
    setHighlightedRight(e.api.getSelectedRows().map((r: any) => getRowKey(r, activeTab)));
  };

  // ── Report values ─────────────────────────────────────────────────────────

  const reportValues = {
    loginid: loginId,
    company_code: companyCode,
    date_from: formatDisplay(dateFrom),
    date_to: formatDisplay(dateTo),
    date_from_iso: dateFrom,
    date_to_iso: dateTo,
    currency,
    division: division || "All",
    ac_codes:
      activeTab === "acCode"
        ? selected.length > 0
          ? selected.map((r) => getRowKey(r, "acCode")).join(",")
          : "All"
        : "All",
    l4_codes:
      activeTab === "group"
        ? selected.length > 0
          ? selected.map((r) => getRowKey(r, "group")).join(",")
          : "All"
        : "All",
    selected_groups: selected.map((r) => getRowKey(r, activeTab)),
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="flex flex-col gap-4 h-full">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div>
        <p className="eyebrow">Finance Reports</p>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">AC Statement</h1>
      </div>

      {/* ── Filter row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Date Range */}
        <div className="rounded-lg border bg-card p-3">
          <p className="eyebrow mb-2">Date Range</p>
          <div className="flex gap-2">
            <label className="field flex-1">
              <span>From</span>
              <input
                type="date"
                className="ui-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="field flex-1">
              <span>To</span>
              <input
                type="date"
                className="ui-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Currency */}
        <div className="rounded-lg border bg-card p-3">
          <p className="eyebrow mb-2">Currency</p>
          <div className="flex gap-4 pt-1">
            {(["local", "foreign"] as const).map((val) => (
              <label key={val} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="currency"
                  value={val}
                  checked={currency === val}
                  onChange={() => setCurrency(val)}
                  className="accent-primary"
                />
                {val === "local" ? "Local Currency" : "Foreign Currency"}
              </label>
            ))}
          </div>
        </div>

        {/* Division */}
        <div className="rounded-lg border bg-card p-3">
          <p className="eyebrow mb-2">Division</p>
          <label className="field">
            <span>Select Division</span>
            <Select
              value={division}
              onChange={(e) => {
                setDivision(e.target.value);
                setSelected([]);
                clearLeft();
                clearRight();
              }}
            >
              <option value="">— All Divisions —</option>
              {(divisionData ?? []).map((d: any) => (
                <option key={d.div_code} value={d.div_code}>
                  {d.div_code} – {d.div_name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      {/* ── Transfer list card ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col rounded-lg border bg-card">

        {/* Tabs */}
        <div className="flex border-b">
          {(["group", "acCode"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                clearLeft();
                clearRight();
              }}
              className={[
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab === "acCode" ? "A/C Code" : "Group"}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3">

          {/* Transfer area */}
          <div className="flex gap-2 flex-1 items-stretch min-h-0">

            {/* Available grid */}
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Available
                </span>
                <span className="text-xs text-muted-foreground">
                  {filteredAvailable.length} records
                </span>
              </div>
              <div className="ag-theme-alpine flex-1" style={{ height: 400 }}>
                <AgGridReact
                  ref={leftGridRef}
                  columnDefs={activeTab === "acCode" ? acCodeColumnDefs : groupColumnDefs}
                  defaultColDef={defaultColDef}
                  rowData={filteredAvailable}
                  getRowId={(p) => getRowKey(p.data, activeTab)}
                  rowSelection="multiple"
                  suppressCellFocus
                  enableCellTextSelection
                  onSelectionChanged={onLeftSelectionChanged}
                  rowHeight={28}
                  headerHeight={32}
                />
              </div>
            </div>

            {/* Transfer buttons */}
            <div className="flex flex-col items-center justify-center gap-2 px-1">
              <TransferBtn
                title="Move selected →"
                onClick={moveRight}
                disabled={highlightedLeft.length === 0}
              >
                <ChevronRight size={15} />
              </TransferBtn>
              <TransferBtn
                title="Move all →"
                onClick={moveAllRight}
                disabled={filteredAvailable.length === 0}
              >
                <ChevronsRight size={15} />
              </TransferBtn>

              <div className="my-1 h-px w-6 bg-border" />

              <TransferBtn
                title="Move selected ←"
                onClick={moveLeft}
                disabled={highlightedRight.length === 0}
              >
                <ChevronLeft size={15} />
              </TransferBtn>
              <TransferBtn
                title="Move all ←"
                onClick={moveAllLeft}
                disabled={selected.length === 0}
              >
                <ChevronsLeft size={15} />
              </TransferBtn>
            </div>

            {/* Selected grid */}
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Selected
                </span>
                <span className="text-xs text-muted-foreground">
                  {selected.length} records
                </span>
              </div>
              <div className="ag-theme-alpine flex-1" style={{ height: 400 }}>
                <AgGridReact
                  ref={rightGridRef}
                  columnDefs={activeTab === "acCode" ? acCodeColumnDefs : groupColumnDefs}
                  defaultColDef={defaultColDef}
                  rowData={selected}
                  getRowId={(p) => getRowKey(p.data, activeTab)}
                  rowSelection="multiple"
                  suppressCellFocus
                  enableCellTextSelection
                  onSelectionChanged={onRightSelectionChanged}
                  rowHeight={28}
                  headerHeight={32}
                />
              </div>
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw size={15} /> Reset
            </Button>
            <Button onClick={() => setReportOpen(true)}>
              <Printer size={15} /> Generate Report
            </Button>
          </div>

        </div>
      </div>

      {/* ── Report Dialog ─────────────────────────────────────────────────── */}
      {/* {reportOpen && (
        <ReportDialogPage
          Report={AC_StatementReport}
          required_values={reportValues}
          title="AC Statement"
          onClose={() => setReportOpen(false)}
        />
      )} */}
    </section>
  );
}

function useQuery(arg0: { queryKey: string[]; queryFn: () => any; }): { data: any; } {
  throw new Error("Function not implemented.");
}
