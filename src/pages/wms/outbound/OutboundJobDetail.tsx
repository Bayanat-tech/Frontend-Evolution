import { ArrowLeft, Printer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { executeWmsInboundSql } from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../state/AuthContext";
import type { WmsRow } from "./Outboundtypes";
import { detailTabs, outboundJobsPath } from "./Outboundtypes";
import {
  normalizeRow,
  value,
  isCanceled,
  hasDate,
  formatDate,
  sqlEscape,
} from "./OutboundHelpers";
import { jobClassLabels } from "./Outboundtypes";
import { outboundJobTabPath } from "./OutboundHelpers";
import { OutboundOperationalTab } from "./OutboundOperationalTab";

export function OutboundJobDetail({
  jobNo,
  tab,
}: {
  jobNo: string;
  tab: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const principalCode =
    new URLSearchParams(location.search).get("principal_code") || "";
  const [job, setJob] = useState<WmsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJob = async () => {
    setLoading(true);
    try {
      const data = await executeWmsInboundSql(
        `SELECT * FROM TO_ORDER
         WHERE JOB_NO       = '${sqlEscape(jobNo)}' AND PRIN_CODE = '${sqlEscape(principalCode)}'
           AND COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'`
      );
      setJob(
        normalizeRow(data[0] || { job_no: jobNo, prin_code: principalCode })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJob();
  }, [jobNo]);

  const activeTab = detailTabs.some((item) => item.value === tab)
    ? tab
    : "order_entry";
  const jobClass =
    jobClassLabels[value(job || {}, "job_class")] ||
    value(job || {}, "job_class") ||
    "Normal";
  const status = isCanceled(job || {})
    ? "Canceled"
    : hasDate(value(job || {}, "confirm_date"))
      ? "Confirmed"
      : "In Progress";
  const jobDate = formatDate(value(job || {}, "job_date"));

  return (
    <section className="grid gap-3">
      {/* ── Job Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            size="icon"
            variant="outline"
            onClick={() => navigate(outboundJobsPath)}
            title="Back to jobs"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Outbound Job
            </p>
            <h1 className="m-0 truncate text-2xl font-bold text-foreground">
              {jobNo}
            </h1>
          </div>

          {/* Principal chip */}
          <div className="hidden items-center gap-1 rounded-md border bg-background px-3 py-1.5 sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Principal
            </span>
            <span className="ml-1.5 text-sm font-bold text-foreground">
              {value(job || {}, "prin_code") || principalCode || "-"}
            </span>
          </div>

          {/* Job Date chip */}
          {jobDate && (
            <div className="hidden items-center gap-1 rounded-md border bg-background px-3 py-1.5 sm:flex">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Job Date
              </span>
              <span className="ml-1.5 text-sm font-bold text-foreground">
                {jobDate}
              </span>
            </div>
          )}

          {/* Job Class badge */}
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {jobClass}
          </span>

          {/* Status badge */}
          <span
            className={
              status === "Canceled"
                ? "rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700"
                : status === "Confirmed"
                  ? "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                  : "rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700"
            }
          >
            {status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={loadJob}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" variant="outline">
            <Printer size={14} /> Print
          </Button>
        </div>
      </div>

      {/* ── Tab Strip ── */}
      <div className="flex gap-2 overflow-x-auto rounded-md border bg-card p-2">
        {detailTabs.map((item) => (
          <Link
            className={
              item.value === activeTab
                ? "ui-button ui-button-default ui-button-sm"
                : "ui-button ui-button-outline ui-button-sm"
            }
            key={item.value}
            to={outboundJobTabPath(jobNo, item.value, job || { prin_code: principalCode } as WmsRow)}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <OutboundOperationalTab
        job={job}
        jobNo={jobNo}
        tab={activeTab}
        loadingJob={loading}
        principalCode={principalCode}
      />
    </section>
  );
}