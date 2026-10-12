import { ColumnDef } from "@tanstack/react-table";
import { Save, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DynamicQueryParams, getDynamicLookupaccount, LookupRow } from "../../api/lookups";
import { useAuth } from "../../state/AuthContext";
import { BiscDatePicker } from "../../components/ui/BiscDatePicker";
import { LookupField } from "../../components/ui/LookupField";
import { DataTable } from "../../components/ui/DataTable";


// const PROC_NAME = "PROC_BUILD_DYNAMIC_POST_DATED_CHEQUE";

type PdcRow = {
  rowId: string;
  DOC_TYPE: string;
  DOC_NO: string;
  AMOUNT: number | null;
  PDC_IND: string;
  CHEQUE_NO: string;
  CHEQUE_DATE: string;
  CLEAR_DATE: string;
  DOC_DATE: string;
  BANK_AC_CODE: string;
  COMPANY_CODE: string;
  DIV_CODE: string;
};

// The procedure filters with "date < P_DATE2 / P_DATE4", so add 1 day to make the "to" date inclusive.
const addOneDay = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
};

// Builds the payload using the fixed DynamicQueryParams type.
const buildPayload = (
  parameter: string,
  loginid: string,
  extra: Partial<Omit<DynamicQueryParams, "parameter" | "loginid">> = {},
): DynamicQueryParams => ({ parameter, loginid, ...extra });

// Normalise column-name casing coming back from the API.
const upperKeys = (row: LookupRow): Record<string, any> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toUpperCase(), v]));

const matches = (rows: LookupRow[], q?: string) => {
  const term = (q || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term)));
};

export default function PostDatedCheque() {
  const { user } = useAuth() as any;
  const companyCode: string = user?.companyCode ?? user?.company_code ?? "";
  const loginId: string = user?.loginId ?? user?.userId ?? user?.username ?? "";

  // filters
  const [divCode, setDivCode] = useState("All");
  const [bankAc, setBankAc] = useState("All");
  const [docType, setDocType] = useState("All");
  const [docFrom, setDocFrom] = useState("");
  const [docTo, setDocTo] = useState("");
  const [chqFrom, setChqFrom] = useState("");
  const [chqTo, setChqTo] = useState("");

  // grid
  const [rows, setRows] = useState<PdcRow[]>([]);
  const [original, setOriginal] = useState<Record<string, string>>({}); // rowId -> original clear date
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ---- lookups ----
  const loadDivisions = useCallback(
    async (q?: string) => {
      const data = await getDynamicLookupaccount(
        buildPayload("PDC_DIV_CODE", loginId, { code1: companyCode }),
      );
      return matches([{ DIV_CODE: "All", DIV_NAME: "All" }, ...data], q);
    },
    [companyCode, loginId],
  );

  const loadBankAccounts = useCallback(
    async (q?: string) => {
      const data = await getDynamicLookupaccount(
        buildPayload("PDC_BANK_ACCOUNT", loginId, { code1: companyCode }),
      );
      return matches([{ AC_CODE: "All", AC_NAME: "All" }, ...data], q);
    },
    [companyCode, loginId],
  );

  const loadDocTypes = useCallback(
    async (q?: string) => {
      const data = await getDynamicLookupaccount(buildPayload("PDC_DOC_TYPE", loginId, { code1: companyCode }));
      return matches([{ CODE: "All", DESCRIPTION: "All" }, ...data], q);
    },
    [companyCode, loginId],
  );

  // ---- detail data (loaded only when Retrieve is clicked) ----
  const handleRetrieve = async () => {
    // if (!companyCode || !divCode || !docFrom || !docTo || !chqFrom || !chqTo) {
    //   setError("Please select Division, Document Date (from/to) and Cheque Date (from/to).");
    //   return;
    // }
    setLoading(true);
    setError("");
    try {
      const data = await getDynamicLookupaccount(
        buildPayload("PDC_DETAIL_DATA", loginId, {
          code1: companyCode,
          code2: docType || "All",
          code3: bankAc || "All",
          code4: divCode || "All",
          code5: docFrom,
          code6: addOneDay(docTo),
          code7: chqFrom,
          code8: addOneDay(chqTo),
        }),
      );
      const mapped: PdcRow[] = data.map((raw, i) => {
        const r = upperKeys(raw);
        return {
          rowId: `${r.DOC_TYPE}|${r.DOC_NO}|${r.CHEQUE_NO ?? ""}|${i}`,
          DOC_TYPE: r.DOC_TYPE ?? "",
          DOC_NO: r.DOC_NO ?? "",
          AMOUNT: r.AMOUNT ?? null,
          PDC_IND: r.PDC_IND ?? "",
          CHEQUE_NO: r.CHEQUE_NO ?? "",
          CHEQUE_DATE: r.CHEQUE_DATE ?? "",
          CLEAR_DATE: r.CLEAR_DATE ?? "",
          DOC_DATE: r.DOC_DATE ?? "",
          BANK_AC_CODE: r.BANK_AC_CODE ?? "",
          COMPANY_CODE: r.COMPANY_CODE ?? "",
          DIV_CODE: r.DIV_CODE ?? "",
        };
      });
      setRows(mapped);
      setOriginal(Object.fromEntries(mapped.map((m) => [m.rowId, m.CLEAR_DATE])));
    } catch (err) {
      setRows([]);
      setOriginal({});
      setError(err instanceof Error ? err.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  };

  const updateClearDate = useCallback((rowId: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, CLEAR_DATE: value } : r)));
  }, []);

  const isChanged = useCallback(
    (r: PdcRow) => (original[r.rowId] ?? "") !== (r.CLEAR_DATE ?? ""),
    [original],
  );

  // ---- save ----
  const handleSave = () => {
    const allRows = rows.map((r) => ({ ...r, changed: isChanged(r) }));
    const changedRows = allRows.filter((r) => r.changed);
    console.log("PDC - all rows:", allRows);
    console.log("PDC - changed rows:", changedRows);
  };

  // ---- columns ----
  const columns = useMemo<ColumnDef<PdcRow, any>[]>(
    () => [
      { accessorKey: "DOC_TYPE", header: "Doc Type", size: 90 },
      { accessorKey: "DOC_NO", header: "Doc No", size: 130 },
      { accessorKey: "DOC_DATE", header: "Doc Date", size: 110 },
      { accessorKey: "BANK_AC_CODE", header: "Bank A/C Code", size: 130 },
      { accessorKey: "CHEQUE_NO", header: "Cheque No", size: 120 },
      { accessorKey: "CHEQUE_DATE", header: "Cheque Date", size: 110 },
      {
        accessorKey: "AMOUNT",
        header: "Amount",
        size: 120,
        cell: ({ getValue }) => {
          const v = getValue();
          return v === null || v === undefined || v === ""
            ? ""
            : Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },
      },
      { accessorKey: "PDC_IND", header: "PDC Ind", size: 80 },
      {
        id: "clear_date",
        accessorKey: "CLEAR_DATE",
        header: "Clear Date",
        size: 150,
        enableColumnFilter: true,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} className={isChanged(row.original) ? "ring-1 ring-amber-400 rounded" : ""}>
            <BiscDatePicker
              compact
              value={row.original.CLEAR_DATE}
              onChange={(v) => updateClearDate(row.original.rowId, v)}
            />
          </div>
        ),
      },
      { accessorKey: "DIV_CODE", header: "Div Code", size: 90 },
    ],
    [isChanged, updateClearDate],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      {/* Page heading with Save button on the right */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm">
        <h1 className="text-[15px] font-bold text-[#00378C]">Post Dated Cheque</h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!rows.length}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#00378C] px-3.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={14} />
          Save
        </button>
      </div>

      {/* Top: filters */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LookupField
            label="Division"
            value={divCode}
            displayValue={divCode === "All" ? "All" : undefined}
            columns={[
              { field: "DIV_CODE", header: "Code" },
              { field: "DIV_NAME", header: "Division" },
            ]}
            valueField="DIV_CODE"
            displayFields={["DIV_CODE", "DIV_NAME"]}
            loadOptions={loadDivisions}
            onChange={(v) => setDivCode(v || "All")}
            placeholder="Select division"
          />
          <LookupField
            label="Bank Account"
            value={bankAc}
            displayValue={bankAc === "All" ? "All" : undefined}
            columns={[
              { field: "AC_CODE", header: "A/C Code" },
              { field: "AC_NAME", header: "A/C Name" },
            ]}
            valueField="AC_CODE"
            displayFields={["AC_CODE", "AC_NAME"]}
            loadOptions={loadBankAccounts}
            onChange={(v) => setBankAc(v || "All")}
            placeholder="Select bank account"
          />
          <LookupField
            label="Doc Type"
            value={docType}
            displayValue={docType === "All" ? "All" : undefined}
            columns={[
              { field: "CODE", header: "Code" },
              { field: "DESCRIPTION", header: "Description" },
            ]}
            valueField="CODE"
            displayFields={["CODE", "DESCRIPTION"]}
            loadOptions={loadDocTypes}
            onChange={(v) => setDocType(v || "All")}
            placeholder="Select doc type"
          />

          <div className="field">
            <span>Document Date From</span>
            <BiscDatePicker value={docFrom} onChange={setDocFrom} />
          </div>
          <div className="field">
            <span>Document Date To</span>
            <BiscDatePicker value={docTo} onChange={setDocTo} />
          </div>
          <div className="hidden lg:block" />

          <div className="field">
            <span>Cheque Date From</span>
            <BiscDatePicker value={chqFrom} onChange={setChqFrom} />
          </div>
          <div className="field">
            <span>Cheque Date To</span>
            <BiscDatePicker value={chqTo} onChange={setChqTo} />
          </div>
          <div className="flex items-end justify-start lg:justify-end">
            <button
              type="button"
              onClick={handleRetrieve}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-[#00378C] px-4 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search size={14} />
              {loading ? "Retrieving..." : "Retrieve"}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: grid */}
      <div className="min-h-0 flex-1">
        {error && (
          <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
        )}
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          density="grid"
          height="calc(100vh - 380px)"
          enablePagination
          pageSize={25}
          exportFilename="post-dated-cheque.csv"
          getRowId={(row) => row.rowId}
          emptyText="No records found. Set the filters and click Retrieve."
        />
      </div>
    </div>
  );
}