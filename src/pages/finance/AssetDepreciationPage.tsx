import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Calculator, CheckCircle2, FileText, RefreshCw, RotateCcw, Save, Trash2, TrendingDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  // JV status tracking (detects if linked JV is active or canceled in TR_AC_HEADER)
  const [jvStatus, setJvStatus] = useState<{ isJvPosted: boolean; isJvCanceled: boolean; jvNo: string | null }>({
    isJvPosted: false,
    isJvCanceled: false,
    jvNo: null,
  });

  // JV button is enabled only when the grid has at least one row
  const hasRows = rows.length > 0;
  const postedJvNo = jvStatus.jvNo || rows.find((r) => Boolean(r.ref_doc_no))?.ref_doc_no;
  const isJvCanceled = jvStatus.isJvCanceled;
  const hasActivePostedJv = Boolean(postedJvNo) && !isJvCanceled;

  const columns = useMemo<ColumnDef<DepRow>[]>(() => [
    col("asset_id", "Asset ID", 110),
    col("asset_name", "Asset Name", 220),
    col("reg_no", "Reg No", 110),
    colDate("purchase_date", "Purchase Date", 120),
    col("quantity", "Quantity", 80),
    colNumber("amount", "Pur. Amount", 120),
    colNumber("dprc_percentage", "Dep. %", 90, 2),
    colNumber("accudprc_amount", "Accu Amount", 120),
    colNumber("dprc_amount", "Dprc Amount", 120),
    colNumber("wd_value", "WD Value", 120),
    colDate("last_dprc_date", "Last Dep.", 120),
    col("div_code", "Division", 90),
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
      const targetDocNo = calculateDocNo(year, month, division) || docNo;
      const data = await getDynamicLookup({
        parameter: "AC_ASSETS_RETRIEVE_BUTTON",
        loginid: loginId,
        code1: companyCode,
        code2: division,
        code3: targetDocNo,
        code4: "",
        number1: 0, number2: 0, number3: 0, number4: 0,
        date1: null, date2: null, date3: null, date4: null,
      });
      const norm = data.map(normalize);
      setRows(norm);

      // Check JV cancellation status from backend
      let isCanceled = false;
      const foundDocNo = norm.find((r) => Boolean(r.ref_doc_no))?.ref_doc_no;
      let jvDocNum: string | null = foundDocNo ? String(foundDocNo) : null;
      try {
        const stResp = await api.get<{
          success: boolean;
          isJvPosted: boolean;
          isJvCanceled: boolean;
          jvNo: string | null;
        }>(`/api/finance/asset-depreciation/status?doc_no=${targetDocNo}&div_code=${division}`);
        if (stResp.data?.success) {
          isCanceled = Boolean(stResp.data.isJvCanceled);
          jvDocNum = stResp.data.jvNo ? String(stResp.data.jvNo) : jvDocNum;
          setJvStatus({
            isJvPosted: Boolean(stResp.data.isJvPosted),
            isJvCanceled: isCanceled,
            jvNo: jvDocNum,
          });
        }
      } catch {
        // Non-blocking status check
      }

      if (norm.length === 0) {
        setNotice({
          type: "info",
          message: "No saved depreciation records found for this period. Click 'Save' to calculate and generate depreciation.",
        });
      } else {
        if (jvDocNum && isCanceled) {
          setNotice({
            type: "warning",
            message: `⚠️ Depreciation is calculated, but the linked Journal Voucher (JV #${jvDocNum}) was CANCELLED. You can post a new JV or Reset/Delete this calculation to re-calculate.`,
          });
        } else if (jvDocNum) {
          setNotice({
            type: "success",
            message: `✓ Depreciation JV posted to General Ledger (JV Doc #${jvDocNum}).`,
          });
        } else {
          setNotice({
            type: "info",
            message: `✓ Depreciation calculated for ${monthYear || "this period"} (${norm.length} assets). Click "JV" to post to General Ledger.`,
          });
        }
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

  useEffect(() => {
    if (year && month && division) {
      const nextDoc = calculateDocNo(year, month, division);
      setDocNo(nextDoc);
      void retrieve();
    } else {
      setRows([]);
    }
  }, [year, month, division]);

  const save = async () => {
    if (!year || !month || !division) {
      setNotice({ type: "error", message: "Month and division are required." });
      return;
    }
    if (hasRows) {
      if (!hasActivePostedJv) {
        await recalculate();
        return;
      }
      setNotice({
        type: "success",
        message: `Depreciation document ${docNo} is already generated for ${monthYear} (${rows.length} assets). Click "JV" to post to General Ledger.`,
      });
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
      setNotice({ type: "success", message: `Depreciation document ${nextDocNo} generated successfully. Ready for JV Posting.` });
      await retrieve();
      const exc = await checkExceptions(division);
      if (exc.length > 0) {
        setNotice({
          type: "error",
          message: `Depreciation generated with ${exc.length} exception(s). Please review the Exception Register before posting JV.`,
        });
      }
    } catch (error) {
      setNotice({ type: "error", message: friendlyError(error, "Unable to save depreciation") });
    } finally {
      setLoading(false);
    }
  };

  const recalculate = async () => {
    if (!year || !month || !division) return;
    if (hasActivePostedJv) {
      setNotice({
        type: "error",
        message: `Cannot recalculate: Journal Voucher #${postedJvNo} is active in General Ledger. Please cancel the JV in Journal Voucher screen first.`,
      });
      return;
    }
    if (!confirm(`Are you sure you want to recalculate depreciation for ${monthYear}? This will clear the previous calculation and recalculate all eligible assets.`)) {
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const computedDocNo = calculateDocNo(year, month, division) || docNo;
      await api.post("/api/finance/asset-depreciation/delete", {
        doc_no: Number(computedDocNo),
        div_code: division,
      });
      await executeCommonProcedure({
        parameter: "PROC_DOC_NO_DEPRECIATION",
        loginid: loginId,
        val1s1: year,
        val1s2: month,
        val1s3: division,
        val1s4: companyCode,
        val1s5: docType,
      });
      setNotice({ type: "success", message: `Depreciation for ${monthYear} recalculated successfully!` });
      await retrieve();
      const exc = await checkExceptions(division);
      if (exc.length > 0) {
        setNotice({
          type: "error",
          message: `Depreciation generated with ${exc.length} exception(s). Please review the Exception Register before posting JV.`,
        });
      }
    } catch (error) {
      setNotice({ type: "error", message: friendlyError(error, "Unable to recalculate depreciation") });
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
      setNotice({ type: "success", message: `Depreciation JV for document ${computedDocNo} posted successfully to General Ledger!` });
      await retrieve();
    } catch (error) {
      setNotice({ type: "error", message: friendlyError(error, "Unable to post JV") });
    } finally {
      setLoading(false);
    }
  };

  const deleteDepreciation = async () => {
    const computedDocNo = calculateDocNo(year, month, division) || docNo;
    if (!computedDocNo || !division) return;
    if (hasActivePostedJv) {
      setNotice({
        type: "error",
        message: `Cannot reset: Journal Voucher #${postedJvNo} is active in General Ledger. Please cancel the JV in Journal Voucher screen first.`,
      });
      return;
    }
    if (!confirm(`Are you sure you want to delete depreciation document ${computedDocNo}? Asset book values (WD_VALUE) will be restored so you can recalculate.`)) {
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const resp = await api.post<{ success: boolean; message: string }>(
        "/api/finance/asset-depreciation/delete",
        { doc_no: Number(computedDocNo), div_code: division }
      );
      if (resp.data?.success) {
        setNotice({
          type: "success",
          message: resp.data.message || `Depreciation ${computedDocNo} deleted successfully. Ready to recalculate.`,
        });
        await retrieve();
      } else {
        setNotice({
          type: "error",
          message: resp.data?.message || "Failed to delete depreciation",
        });
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        message: err.message || "Failed to delete depreciation",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="finance-utility-page finance-list-page grid gap-4 p-4 pb-24 overflow-y-auto max-w-full">
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
            disabled={loading || (hasRows && hasActivePostedJv)}
            onClick={() => (hasRows ? void recalculate() : void save())}
            title={
              hasActivePostedJv
                ? `Depreciation is locked while JV #${postedJvNo} is active in GL`
                : hasRows
                ? "Recalculate depreciation for this period (clears old run and recalculates fresh)"
                : "Generate and save depreciation"
            }
            className={`h-8 gap-1.5 shadow-xs text-xs font-semibold px-4 rounded-lg transition-colors ${
              hasActivePostedJv
                ? "bg-emerald-700 text-white opacity-85 cursor-not-allowed"
                : "bg-[#00378C] text-white hover:bg-[#002d72] cursor-pointer"
            }`}
          >
            {hasActivePostedJv ? (
              <CheckCircle2 size={14} />
            ) : hasRows ? (
              <Calculator size={14} />
            ) : (
              <Save size={14} />
            )}
            {hasActivePostedJv ? "Calculated" : hasRows ? "Recalculate" : "Save"}
          </Button>
          <Button
            variant={hasActivePostedJv ? "outline" : "secondary"}
            disabled={loading || !hasRows || hasActivePostedJv}
            onClick={() => void postJv()}
            title={hasActivePostedJv ? `JV already posted (Doc #${postedJvNo})` : isJvCanceled ? `JV was cancelled in GL. Click to re-post JV.` : hasRows ? "Post depreciation JV" : "No rows to post"}
            className={`h-8 gap-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              hasActivePostedJv
                ? "border-emerald-500 text-emerald-700 bg-emerald-50 cursor-default"
                : isJvCanceled
                ? "border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100"
                : "disabled:cursor-not-allowed disabled:opacity-50"
            }`}
          >
            {hasActivePostedJv ? <CheckCircle2 size={14} className="text-emerald-600" /> : isJvCanceled ? <AlertTriangle size={14} className="text-amber-600" /> : <FileText size={14} />}
            {hasActivePostedJv ? `JV Posted (#${postedJvNo})` : isJvCanceled ? `Re-Post JV (Cancelled #${postedJvNo})` : "JV"}
          </Button>
          {hasRows && (
            <Button
              variant="outline"
              disabled={loading || hasActivePostedJv}
              onClick={() => void deleteDepreciation()}
              title={hasActivePostedJv ? `Cannot delete while JV #${postedJvNo} is active in GL` : "Delete this month's depreciation and restore asset values"}
              className={`h-8 gap-1.5 text-xs font-semibold rounded-lg transition-colors ${
                hasActivePostedJv
                  ? "opacity-50 cursor-not-allowed text-slate-400 border-slate-200"
                  : "text-rose-700 border-rose-300 bg-rose-50 hover:bg-rose-100 cursor-pointer"
              }`}
            >
              <RotateCcw size={14} /> Reset Calculation
            </Button>
          )}
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

function formatDisplayDate(val: unknown): string {
  if (!val) return "";
  const s = String(val).trim();
  if (!s) return "";
  // Check if ISO format YYYY-MM-DD...
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
  }
  // Check if DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const yr = d.getFullYear();
    return `${day}-${month}-${yr}`;
  }
  return s.split("T")[0];
}

function colDate(key: string, header: string, size: number): ColumnDef<DepRow> {
  return {
    accessorKey: key,
    header,
    size,
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return <span className="text-slate-400">—</span>;
      const formatted = formatDisplayDate(v);
      return <span className="font-mono text-xs">{formatted || "—"}</span>;
    },
  };
}

function colNumber(key: string, header: string, size: number, decimals: number = 3): ColumnDef<DepRow> {
  return {
    accessorKey: key,
    header,
    size,
    cell: ({ getValue }) => {
      const v = getValue();
      if (v === null || v === undefined || v === "") return <span className="text-slate-400">—</span>;
      const num = Number(v);
      if (isNaN(num)) return <span>{String(v)}</span>;
      return (
        <span className="font-mono text-xs tabular-nums text-right block">
          {num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        </span>
      );
    },
  };
}

function normalize(row: LookupRow): DepRow {
  const output: DepRow = {};
  Object.keys(row).forEach((key) => {
    output[key.toLowerCase()] = row[key] as string | number;
  });
  return output;
}

function friendlyError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("NO DETAILS FOUND"))
    return "No depreciation has been saved for this month and division. Click Save first, then post the JV.";
  if (raw.includes("Do Depreciation Calculation"))
    return "Run the depreciation calculation (Save) before posting the JV.";
  if (raw.includes("Please check the Exception register"))
    return "Some assets are in the Exception Register. Fix them before posting the JV.";
  if (raw.includes("Already calculated for future period") || raw.includes("Depreciation restricted"))
    return "Depreciation restricted! A subsequent period has already been calculated. In accordance with PowerBuilder ERP rules, prior months cannot be recalculated once future periods are run. Existing records for this month are loaded below.";
  // Any other ORA-20xxx: show only its message, without the ORA-06512 stack
  const match = raw.match(/ORA-20\d{3}:\s*([\s\S]*?)(?=\s*ORA-\d{5}|$)/);
  if (match?.[1]) return match[1].trim();
  return fallback;
}