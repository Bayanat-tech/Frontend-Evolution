import { CheckCircle2, FileText, MessageSquare, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pamsSave, pamsSelect } from "../../api/pams";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { useToast } from "../../components/ui/AlertToast";

// ═══════════════════════════════════════════════════════════════════
// TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════
type Row = Record<string, unknown>;

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeRow(row: Row): Row {
  const out: Row = {};
  Object.entries(row || {}).forEach(([k, v]) => {
    out[k] = v;
    out[k.toUpperCase()] = v;
    out[k.toLowerCase()] = v;
  });
  return out;
}

function splitItems(v: unknown): string[] {
  const seen = new Set<string>();
  return text(v)
    .split(" | ")
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════
export function KpiAcceptancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const loginid = user?.loginid ?? "";
  const companyCode = user?.company_code ?? "";

  const [periodList, setPeriodList] = useState<Row[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [acceptStatus, setAcceptStatus] = useState("P");
  const [remarks, setRemarks] = useState("");
  const [existingRemarks, setExistingRemarks] = useState("");
  const [existingDate, setExistingDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalWeightage = useMemo(
    () => rows.reduce((s, r) => s + Number(r.WEIGHTAGE ?? 0), 0),
    [rows]
  );

  // ─── Load periods (Q1 only) ─────────────────────────────
  const loadPeriods = async () => {
    try {
      const data = await pamsSelect({
        parameter: "kpi_acceptance_periods",
        loginid,
        code1: companyCode,
      });
      const mapped = data.map(normalizeRow);
      setPeriodList(mapped);
      if (mapped.length > 0 && !selectedPeriod) {
        setSelectedPeriod(text(mapped[0].PERIOD_NUMBER));
      }
    } catch {
      setPeriodList([]);
    }
  };

  // ─── Load KPIs + status ─────────────────────────────────
  const loadData = async (period: string) => {
    if (!period) return;
    setLoading(true);
    try {
      const [kpiRows, statusRows] = await Promise.all([
        pamsSelect({
          parameter: "my_kpi_acceptance",
          loginid,
          code1: companyCode,
          code2: period,
        }),
        pamsSelect({
          parameter: "kpi_acceptance_status",
          loginid,
          code1: companyCode,
          code2: period,
        }),
      ]);

      setRows(kpiRows.map(normalizeRow));

      if (Array.isArray(statusRows) && statusRows.length > 0) {
        const s = normalizeRow(statusRows[0]);
        setAcceptStatus(text(s.STATUS) || "P");
        setExistingRemarks(text(s.REMARKS));
        setExistingDate(text(s.ACCEPTED_DATE));
        setRemarks(text(s.REMARKS));
      } else {
        setAcceptStatus("P");
        setExistingRemarks("");
        setExistingDate("");
        setRemarks("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load KPIs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginid, companyCode]);

  useEffect(() => {
    if (selectedPeriod) void loadData(selectedPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  // ─── Save ───────────────────────────────────────────────
  const saveAcceptance = async (status: "A" | "R") => {
    if (!selectedPeriod) {
      toast.warning("No period available");
      return;
    }
    if (rows.length === 0) {
      toast.warning("No KPIs assigned for this period");
      return;
    }
    if (status === "R" && !remarks.trim()) {
      toast.warning("Please provide remarks for request change");
      return;
    }

    setSaving(true);
    try {
      const divCode = rows.length > 0 ? text(rows[0].DIVISION_CODE) : "";
      const deptCode = rows.length > 0 ? text(rows[0].DEPARTMENT_CODE) : "";

      await pamsSave({
        parameter: "kpi_acceptance_save",
        loginid,
        val1s1: companyCode,
        val1s2: loginid,
        val1s3: selectedPeriod,
        val1s4: status,
        val1s5: remarks,
        val1s6: divCode,
        val1s7: deptCode,
      });

      toast.success(
        status === "A"
          ? "KPI accepted successfully"
          : "Change request sent to HOD"
      );
      setAcceptStatus(status);
      setExistingRemarks(remarks);
      await loadData(selectedPeriod);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const isLocked = acceptStatus !== "P";
  const hasData = selectedPeriod && rows.length > 0;

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <section className="grid gap-4">
      {/* ─── Page Title ─────────────────────────── */}
      <div>
        <h1 className="m-0 text-2xl font-semibold text-foreground">
          KPI Acceptance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and confirm your assigned KPIs for the annual period.
        </p>
      </div>

      {/* ─── Main Card ──────────────────────────── */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Period + Status */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-lg font-semibold text-foreground">
                    {selectedPeriod || "No Period"}
                  </h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Annual · Q1
                  </span>

                  {/* Status Badge inline */}
                  {acceptStatus === "A" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={12} /> Accepted
                    </span>
                  )}
                  {acceptStatus === "R" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <MessageSquare size={12} /> Change Requested
                    </span>
                  )}
                  {acceptStatus === "P" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      Pending Review
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {rows.length} KPI{rows.length === 1 ? "" : "s"} · Total weightage{" "}
                  <span className="font-semibold text-foreground">
                    {totalWeightage}%
                  </span>
                  {existingDate && acceptStatus !== "P" && (
                    <>
                      {" "}· Responded on {existingDate}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* ─── KPI Table ─────────────────────── */}
          {loading ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              Loading KPIs...
            </p>
          ) : !selectedPeriod ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              No Q1 period is available yet. Please contact your HOD.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              No KPIs assigned for {selectedPeriod}. Please contact your HOD.
            </p>
          ) : (
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="w-14 px-3 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    S.No
                  </th>
                  <th className="w-40 px-3 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    KPI Category
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    KPI · Activities
                  </th>
                  <th className="w-28 px-3 py-3 text-right text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Weightage %
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const items = splitItems(row.KPI_ITEMS);
                  return (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800/70"
                    >
                      <td className="px-3 py-4 text-center text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {text(row.KPI_CATEGORY) || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <p className="m-0 text-[14px] font-semibold text-foreground">
                          {text(row.KPI_DESC) || "—"}
                        </p>
                        {items.length > 0 && (
                          <div className="mt-2 grid gap-1.5 rounded-md border border-border bg-muted/30 p-3">
                            {items.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 text-xs text-muted-foreground"
                              >
                                <span className="mt-[2px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                                  {i + 1}
                                </span>
                                <span className="leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                          {text(row.WEIGHTAGE) || "0"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ─── Action Bar ─────────────────────────── */}
      {hasData && (
        <Card>
          <CardContent className="grid gap-3 pt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Remarks{" "}
                {!isLocked && (
                  <span className="text-amber-600">
                    (required if requesting change)
                  </span>
                )}
              </label>
              <textarea
                disabled={isLocked}
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={
                  isLocked
                    ? "Locked — you have already responded"
                    : "Optional notes for your HOD (e.g. weightage is too high)"
                }
              />
            </div>

            {!isLocked && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => void saveAcceptance("R")}
                  className="gap-2"
                >
                  <XCircle size={15} /> Request Change
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => void saveAcceptance("A")}
                  className="gap-2"
                >
                  <CheckCircle2 size={15} />
                  {saving ? "Saving..." : "Accept KPIs"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}