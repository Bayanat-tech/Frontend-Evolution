import { ArrowLeft, Printer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getWmsInbound, executeWmsInboundSql } from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../state/AuthContext";
import { cn } from "../../../lib/utils";
import { InboundOperationalTab } from "./InboundOperationalTab";
import { getTabsForJob } from "../../../config/tabConfig";
import {
  type WmsRow,
  value, normalizeRow, formatDate, sqlEscape,
  isCanceled, hasDate, locationSearchPrincipal, JobClassPill,
} from "../../../utils/inboundHelpers";

type Props = { jobNo: string; tab: string };

export function InboundJobDetail({ jobNo, tab }: Props) {
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const location      = useLocation();
  const [job, setJob] = useState<WmsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const basePath = location.pathname.split("/").slice(0, -1).join("/");

  const loadJob = async () => {
    setLoading(true);
    try {
      const data = await getWmsInbound<WmsRow>(`job/${encodeURIComponent(jobNo)}`);
      setJob(normalizeRow(data || {}));
    } catch {
      try {
        const fallback = await executeWmsInboundSql(
          `SELECT * FROM VW_TI_JOB WHERE JOB_NO = '${sqlEscape(jobNo)}' AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`,
        );
        setJob(normalizeRow(fallback[0] || { job_no: jobNo }));
      } catch {
        setJob(normalizeRow({ job_no: jobNo }));
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadJob(); }, [jobNo]);

  const availableTabs = getTabsForJob(value(job || {}, "job_class"));
  const activeTab     = availableTabs.some((t:any) => t.value === tab) ? tab : "shipment_details";

  const jobStatus   = isCanceled(job || {}) ? "Canceled"
    : hasDate(value(job || {}, "confirm_date")) ? "Confirmed" : "In Progress";

  const statusColor = jobStatus === "Canceled"  ? "text-red-600 bg-red-50 border-red-200"
    : jobStatus === "Confirmed" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : "text-blue-600 bg-blue-50 border-blue-200";

  return (
    <section className="grid gap-3">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button size="icon" variant="outline"
            onClick={() => navigate("/workspace/wms/wms/transactions/inbound/jobs")}
            title="Back to jobs"
          >
            <ArrowLeft size={16} />
          </Button>

          <div className="min-w-0">
            <p className="eyebrow mb-0.5">Inbound Job</p>
            <h1 className="m-0 truncate text-xl font-semibold leading-tight">{jobNo}</h1>
          </div>

          <div className="hidden h-8 w-px bg-border sm:block" />

          {job && value(job, "prin_code") && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Principal</span>
              <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {value(job, "prin_code")}
                {value(job, "prin_name") ? ` · ${value(job, "prin_name")}` : ""}
              </span>
            </div>
          )}

          {job && value(job, "job_date") && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Job Date</span>
              <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {formatDate(value(job, "job_date"))}
              </span>
            </div>
          )}

          <div className="hidden h-8 w-px bg-border sm:block" />

          {job && <JobClassPill code={value(job, "job_class")} />}

          <span className={cn(
            "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
            statusColor,
          )}>
            {jobStatus}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadJob}><RefreshCw size={14} /> Refresh</Button>
          <Button size="sm" variant="outline"><Printer size={14} /> Print</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
        {availableTabs.map((item:any) => (
          <Link
            key={item.value}
            className={
              item.value === activeTab
                ? "ui-button ui-button-default ui-button-sm whitespace-nowrap"
                : "ui-button ui-button-outline ui-button-sm whitespace-nowrap"
            }
            to={`${basePath}/${item.value}${locationSearchPrincipal(job)}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <InboundOperationalTab job={job} jobNo={jobNo} tab={activeTab} loadingJob={loading} />

    </section>
  );
}