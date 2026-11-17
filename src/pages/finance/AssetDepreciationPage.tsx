import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Calculator, FileText, RefreshCw, Save, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { executeCommonProcedure, getDynamicLookup, getLookupValue, LookupRow } from "../../api/lookups";
import { api } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { LookupField } from "../../components/ui/LookupField";
import { useAuth } from "../../state/AuthContext";

type DepRow = Record<string, string | number>;

export function AssetDepreciationPage() {
  const { user } = useAuth();
  const companyCode = user?.company_code || "";
  const loginId = user?.loginid || "";
  const [monthYear, setMonthYear] = useState("");
  const [division, setDivision] = useState("");
  const [divisionName, setDivisionName] = useState("");
  const [docType] = useState("ADP");
  const [docNo, setDocNo] = useState("");
  const [rows, setRows] = useState<DepRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);

  const [year, month] = monthYear ? monthYear.split("-") : ["", ""];

  // Helper to calculate exact PowerBuilder Doc No (division 10 uses YYYYMM, others use DIV+YYYYMM)
  const calculateDocNo = (y: string, m: string, div: string) => {
    if (!y || !m) return "";
    const base = `${y}${m}`;
    return div && div !== "10" ? `${div}${base}` : base;
  };

  // JV button is enabled only when the grid has at least one row
  const hasRows = rows.length > 0;

  const columns = useMemo<ColumnDef<DepRow>[]>(() => [
    col("asset_id", "Asset ID", 130),
    col("asset_name", "Asset Name", 220),
    col("reg_no", "Reg No", 110),
    col("purchase_date", "Purchase Date", 120),
    col("quantity", "Quantity", 100),
    col("amount", "pur.Amount", 120),
    col("dprc_percentage", "Dep. %", 90),
    col("accudprc_amount", "Accu Amount", 120),
    col("dprc_amount", "Dprc Amount", 130),
    col("wd_value", "WD Value", 120),
    col("last_dprc_date", "Last Dep.", 120),
    col("div_code", "Division", 100),
  ], []);

  const checkExceptions = async (div: string) => {
    try {
      const resp = await api.get<{ success: boolean; data: any[] }>(
        `/api/finance/asset-depreciation/exceptions?div_code=${encodeURIComponent(div)}`
      );
      if (resp.data?.success && Array.isArray(resp.data.data)) {
        setExceptions(resp.data.data);
        return resp.data.data;
      }
    } catch {
      // Non-blocking exception check
    }
    return [];
  };

  const retrieve = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_RETRIEVE_BUTTON",
        loginid: loginId,
        code1: companyCode,
        code2: division,
        code3: "", code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      const norm = data.map(normalize);
      setRows(norm);
      if (norm.length === 0) {
        setNotice({
          type: "info",
          message: "No saved depreciation records found for this period. Click 'Save' to calculate and generate depreciation.",
        });
      }
      if (division) {
        await checkExceptions(division);
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to retrieve depreciation" });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!year || !month || !division) {
      setNotice({ type: "error", message: "Month and division are required." });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await executeCommonProcedure({
        parameter: "PROC_DOC_NO_DEPRECIATION",
        loginid: loginId,
        val1s1: year,
        val1s2: month,
        val1s3: division,
        val1s4: companyCode,
        val1s5: docType,
      });
      const nextDocNo = calculateDocNo(year, month, division);
      setDocNo(nextDocNo);
      setNotice({ type: "success", message: `Depreciation document ${nextDocNo} generated successfully` });
      await retrieve();
      const exc = await checkExceptions(division);
      if (exc.length > 0) {
        setNotice({
          type: "error",
          message: `Depreciation generated with ${exc.length} exception(s). Please review the Exception Register before posting JV.`,
        });
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save depreciation" });
    } finally {
      setLoading(false);
    }
  };

  const postJv = async () => {
    if (!hasRows) return;
    const computedDocNo = calculateDocNo(year, month, division) || docNo;
    if (!computedDocNo || !division) {
      setNotice({ type: "error", message: "Retrieve or generate a document before posting JV." });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      // Check exceptions before posting JV
      const exc = await checkExceptions(division);
      if (exc.length > 0) {
        setNotice({
          type: "error",
          message: `Cannot post JV: ${exc.length} assets have missing Employee/Custodian or Location in the Exception Register.`,
        });
        setExceptionDialogOpen(true);
        return;
      }

      // Call PROC_DEPRECIATION_JVPOST (validates rowcount, checks exception register, and posts JV)
      await executeCommonProcedure({
        parameter: "PROC_DEPRECIATION_JVPOST",
        loginid: loginId,
        val1s1: companyCode,
        val1s2: docType,
        val1s3: String(Number(computedDocNo)),
        val1s4: division,
        val1s5: String(rows.length),
        val1n1: Number(computedDocNo),
      });
      setNotice({ type: "success", message: `Depreciation JV for document ${computedDocNo} posted successfully to General Ledger` });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to post JV" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="finance-utility-page finance-list-page grid gap-4">
      {/* ===================== PAGE HEADER (matches Prepaid Register) ===================== */}
      <div className="tariff-page-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="tariff-page-icon">
            <TrendingDown size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">Asset Depreciation</h1>
            <p className="m-0 text-xs text-slate-500">Asset Utility</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {exceptions.length > 0 && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setExceptionDialogOpen(true)}
              className="h-8 gap-1.5 text-xs font-semibold rounded-lg cursor-pointer text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
            >
              <AlertTriangle size={14} /> Exceptions ({exceptions.length})
            </Button>
          )}
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void retrieve()}
            className="h-8 gap-1.5 text-xs font-semibold rounded-lg cursor-pointer"
          >
            <RefreshCw size={14} /> Retrieve
          </Button>
          <Button
            disabled={loading}
            onClick={() => void save()}
            className="h-8 gap-1.5 bg-[#00378C] text-white hover:bg-[#002d72] shadow-xs text-xs font-semibold px-4 rounded-lg cursor-pointer transition-colors"
          >
            <Save size={14} /> Save
          </Button>
          <Button
            variant="secondary"
            disabled={loading || !hasRows}
            onClick={() => void postJv()}
            title={hasRows ? "Post depreciation JV" : "No rows to post"}
            className="h-8 gap-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={14} /> JV
          </Button>
        </div>
      </div>

      <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

      {/* ===================== CARD: DEPRECIATION RUN ===================== */}
      <div className="freight-master-form-card">
        <div className="freight-master-form-header">
          <h3>
            <span className="freight-section-icon"><Calculator size={16} /></span>
            Depreciation Run
          </h3>
        </div>
        <div className="freight-master-form-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="freight-master-field">
              <label className="freight-master-label">
                <span>Month</span>
                <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>
              </label>
              <input
                className="freight-master-input"
                type="month"
                value={monthYear}
                onChange={(event) => {
                  setMonthYear(event.target.value);
                  const [y, m] = event.target.value.split("-");
                  setDocNo(calculateDocNo(y, m, division));
                }}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">
                <span>Division</span>
                <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>
              </label>
              <LookupField
                compact
                value={division}
                displayValue={division ? `${division}${divisionName ? ` - ${divisionName}` : ""}` : ""}
                columns={[{ field: "div_code", header: "Division" }, { field: "div_name", header: "Name" }]}
                valueField="div_code"
                displayFields={["div_code", "div_name"]}
                loadOptions={() =>
                  getDynamicLookup({
                    parameter: "AC_ASSETS_DEPRECIATION_DIVISION_LIST",
                    loginid: loginId,
                    code1: companyCode,
                  })
                }
                onChange={(value, row) => {
                  setDivision(value);
                  setDivisionName(String(getLookupValue(row || {}, "div_name") || ""));
                  setDocNo(calculateDocNo(year, month, value));
                }}
              />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">Doc Type</label>
              <input className="freight-master-input" value={docType} disabled readOnly />
            </div>

            <div className="freight-master-field">
              <label className="freight-master-label">Doc No</label>
              <input className="freight-master-input" value={docNo} disabled readOnly />
            </div>
          </div>
        </div>
      </div>

      {/* ===================== DATA TABLE ===================== */}
      <DataTable
        columns={columns}
        data={rows}
        title={loading ? "Loading" : `${rows.length} Rows`}
        subtitle="Depreciation Details"
        loading={loading}
        emptyText="No depreciation rows found"
        height={560}
        minWidth={1400}
        density="grid"
        getRowId={(row, index) => `${row.asset_id || "row"}_${index}`}
      />
      {/* ===================== EXCEPTION REGISTER MODAL ===================== */}
      <Dialog
        open={exceptionDialogOpen}
        onClose={() => setExceptionDialogOpen(false)}
        title={`Asset Depreciation Exception Register (${exceptions.length} Issues)`}
      >
        <div className="p-4 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Action Required:</strong> The following assets cannot have depreciation posted because they are missing a Custodian (Employee ID) or Location (Site) in the Asset Master, or have written-down value discrepancies. Please update these assets in the <strong>Asset Register</strong> page.
          </div>
          <div className="max-h-80 overflow-y-auto border rounded-md">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 font-semibold text-slate-700 border-b">
                <tr>
                  <th className="p-2">Asset ID</th>
                  <th className="p-2">Asset Name</th>
                  <th className="p-2">Division</th>
                  <th className="p-2">WD Value</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Issue / Missing</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exceptions.map((exc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 font-mono font-medium">{exc.asset_id || exc.ASSET_ID}</td>
                    <td className="p-2">{exc.asset_name || exc.ASSET_NAME}</td>
                    <td className="p-2">{exc.div_code || exc.DIV_CODE}</td>
                    <td className="p-2 font-mono">{String(exc.wd_value ?? exc.WD_VALUE ?? "")}</td>
                    <td className="p-2 font-mono">{String(exc.amount ?? exc.AMOUNT ?? "")}</td>
                    <td className="p-2 text-rose-600 font-medium">Missing Custodian / Location</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setExceptionDialogOpen(false)}>Close</Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

function col(key: string, header: string, size: number): ColumnDef<DepRow> {
  return { accessorKey: key, header, size, cell: ({ getValue }) => <span>{String(getValue() ?? "")}</span> };
}

function normalize(row: LookupRow): DepRow {
  const output: DepRow = {};
  Object.keys(row).forEach((key) => {
    output[key.toLowerCase()] = row[key] as string | number;
  });
  return output;
}