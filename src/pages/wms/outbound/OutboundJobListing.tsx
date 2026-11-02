import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { FormEvent, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { executeWmsInboundSql, putWmsInbound, postWmsInbound } from "../../../api/wms";
import { executeCommonProcedure } from "../../../api/lookups";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { NoticeToast } from "../../../components/ui/NoticeToast";
import { useAuth } from "../../../state/AuthContext";
import { listingTabs, jobFields } from "./Outboundtypes";
import {
  normalizeRow,
  value,
  filterJobByTab,
  canCancelOutboundJob,
  isCanceled,
  hasDate,
  formatDate,
  sqlEscape,
  processMessage,
  makeEmptyJob,
  makeOutboundJobForm,
  enrichOutboundJobFormNames,
  buildOutboundJobPayload,
  validateDepartmentDivision,
  flagBadge,
  outboundJobDetailPath,
} from "./OutboundHelpers";
import { JobClassPill } from "./OutboundFormFields";
import { OutboundJobCreateForm } from "./OutboundJobCreateform";

export type WmsRow = Record<string, unknown>;

export function OutboundJobListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("in_progress");
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingJobNo, setEditingJobNo] = useState("");
  const [form, setForm] = useState<WmsRow>(makeEmptyJob(user?.company_code));
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WmsRow | null>(null);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadRows = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const data = await executeWmsInboundSql(
        `SELECT * FROM VW_TI_JOB WHERE COMPANY_CODE = '${sqlEscape(user?.company_code || "")}' AND JOB_TYPE = 'EXP' ORDER BY JOB_DATE DESC, JOB_NO DESC`
      );
      setRows(data.map(normalizeRow));
    } catch (error) {
      setNotice({
        type: "error",
        message: processMessage("Unable to load outbound job listing.", error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const openEditJob = async (row: WmsRow) => {
    const jobNo = value(row, "job_no");
    setEditingJobNo(jobNo);
    setNotice(null);
    try {
      const jobForm = await enrichOutboundJobFormNames(
        makeOutboundJobForm(row, user?.company_code),
        user?.company_code || ""
      );
      setForm(jobForm);
    } catch {
      setForm(makeOutboundJobForm(row, user?.company_code));
    }
    setView("editor");
  };

  const handleCloseForm = () => {
    setView("list");
    setEditingJobNo("");
  };

  const filteredRows = useMemo(
    () => rows.filter((row) => filterJobByTab(row, activeTab)),
    [rows, activeTab]
  );

  // Count for tabs
  const getTabCount = (tabValue: string) => {
    return rows.filter((row) => filterJobByTab(row, tabValue)).length;
  };

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "job_no",
        header: "Job No",
        size: 130,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline text-[11.5px] text-left cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(outboundJobDetailPath(row.original));
            }}
          >
            {value(row.original, "job_no")}
          </button>
        ),
      },
            {
        accessorKey: "job_class",
        header: "Job Class",
        size: 180,
        cell: ({ row }) => (
          <JobClassPill code={value(row.original, "job_class")} />
        ),
      },
      {
        accessorKey: "prin_name",
        header: "Principal Name",
        size: 260,
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{value(row.original, "prin_name")}</span>,
      },
      {
        accessorKey: "job_date",
        header: "Job Date",
        size: 120,
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{formatDate(value(row.original, "job_date"))}</span>,
      },
      ...(activeTab === "confirmed"
        ? [
            {
              accessorKey: "confirm_date",
              header: "Confirm Date",
              size: 130,
              cell: ({ row }: { row: { original: WmsRow } }) =>
                <span className="text-[11.5px] text-foreground">{formatDate(value(row.original, "confirm_date"))}</span>,
            },
          ]
        : []),
      // {
      //   accessorKey: "doc_ref",
      //   header: "Doc Ref",
      //   size: 130,
      //   cell: ({ row }) => <span className="text-[11.5px] text-foreground">{value(row.original, "doc_ref")}</span>,
      // },
      // {
      //   accessorKey: "canceled",
      //   header: "Canceled",
      //   size: 105,
      //   cell: ({ row }) => <span className="text-[11.5px] text-foreground">{flagBadge(value(row.original, "canceled"))}</span>,
      // },
      {
        accessorKey: "invoiced",
        header: "Invoiced",
        size: 105,
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{flagBadge(value(row.original, "invoiced"))}</span>,
      },
      {
        accessorKey: "invoice_date",
        header: "Invoice Date",
        size: 130,
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{formatDate(value(row.original, "invoice_date"))}</span>,
      },
      {
        id: "actions",
        header: "ACTIONS",
        size: 125,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Open job"
              onClick={(e) => {
                e.stopPropagation();
                navigate(outboundJobDetailPath(row.original));
              }}
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Edit job"
              onClick={(e) => {
                e.stopPropagation();
                void openEditJob(row.original);
              }}
            >
              <Pencil size={13} />
            </button>
            {canCancelOutboundJob(row.original, activeTab) && (
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Cancel job"
                onClick={(e) => {
                  e.stopPropagation(); // ✅ Fix: Stop row click so modal can open
                  setCancelTarget(row.original);
                }}
              >
                <Ban size={13} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [activeTab, navigate, openEditJob]
  );

  const saveJob = async (event: FormEvent) => {
    event.preventDefault();
    const missing = jobFields.find(
      (field) => field.required && !String(form[field.name] || "").trim()
    );
    if (missing) {
      setNotice({ type: "error", message: `${missing.label} is required` });
      return;
    }
    setSaving(true);
    try {
      const departmentOk = await validateDepartmentDivision(
        user?.company_code || "",
        String(form.dept_code || ""),
        String(form.div_code || "")
      );
      if (!departmentOk) {
        setNotice({
          type: "error",
          message:
            "Cannot save outbound job: selected Department and Division do not exist together in MS_DEPARTMENT. Please select Department again.",
        });
        return;
      }
      const payload = buildOutboundJobPayload(form, user?.company_code || "");
      if (editingJobNo) {
        await putWmsInbound("inboundjob", payload);
      } else {
        await postWmsInbound("inboundjob", payload);
      }
      setView("list");
      setEditingJobNo("");
      setNotice({
        type: "success",
        message: editingJobNo
          ? `Outbound job ${editingJobNo} updated successfully.`
          : "Outbound job created successfully.",
      });
      await loadRows(false);
    } catch (error) {
      setNotice({
        type: "error",
        message: processMessage(
          editingJobNo
            ? `Unable to update outbound job ${editingJobNo}.`
            : "Unable to create outbound job.",
          error
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelRemarks.trim()) return;
    setSaving(true);
    try {
      if (
        hasDate(value(cancelTarget, "confirm_date")) ||
        activeTab === "confirmed"
      ) {
        await executeCommonProcedure({
          parameter: "sp_cancel_confirmedjob_oub",
          loginid: user?.loginid || "",
          val1s1: user?.company_code || "",
          val1s2: value(cancelTarget, "prin_code"),
          val1s3: value(cancelTarget, "job_no"),
          val1s4: cancelRemarks,
          val1s5: user?.loginid || "",
        });
      } else {
        await executeWmsInboundSql(`
          UPDATE TI_JOB
          SET CANCELED = 'Y',
              CANCEL_DATE = SYSDATE,
              CANCELED_BY = '${sqlEscape(user?.loginid || "")}',
              CANCEL_REMARKS = '${sqlEscape(cancelRemarks)}',
              UPDATED_AT = SYSDATE,
              UPDATED_BY = '${sqlEscape(user?.loginid || "")}'
          WHERE COMPANY_CODE = '${sqlEscape(user?.company_code || "")}'
            AND PRIN_CODE = '${sqlEscape(value(cancelTarget, "prin_code"))}'
            AND JOB_NO = '${sqlEscape(value(cancelTarget, "job_no"))}'
        `);
      }
      setRows((currentRows) =>
        currentRows.map((row) =>
          value(row, "job_no") === value(cancelTarget, "job_no")
            ? {
                ...row,
                canceled: "Y",
                CANCELED: "Y",
                cancel_date: new Date().toISOString(),
                CANCEL_DATE: new Date().toISOString(),
              }
            : row
        )
      );
      setCancelTarget(null);
      setCancelRemarks("");
      setNotice({
        type: "success",
        message: `Outbound job ${value(cancelTarget, "job_no")} canceled successfully.`,
      });
      await loadRows(false);
    } catch (error) {
      setNotice({
        type: "error",
        message: processMessage(
          `Unable to cancel outbound job ${value(cancelTarget, "job_no")}.`,
          error
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  // ── RENDER EDITOR (FULL PAGE) ──
  if (view === "editor") {
    return (
      <OutboundJobCreateForm
        form={form}
        setForm={setForm}
        companyCode={user?.company_code || ""}
        onSubmit={saveJob}
        onClose={handleCloseForm}
        saving={saving}
        isEditing={!!editingJobNo}
      />
    );
  }

  // ── RENDER LIST ──
  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Outbound Job Listing
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button
            onClick={() => {
              setEditingJobNo("");
              setForm(makeEmptyJob(user?.company_code));
              setView("editor");
            }}
          >
            <Plus size={15} /> Add Job
          </Button> */}
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      {/* Tabs with counts - exactly like Freight */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {listingTabs.map((tab) => {
          const count = getTabCount(tab.value);
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                active
                  ? "bg-[#00378C] text-white shadow-sm font-semibold"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table - exactly like Freight */}
      <DataTable
        columns={columns}
        data={filteredRows}
        toolbar={
          <button
            type="button"
            onClick={() => {
              setEditingJobNo("");
              setForm(makeEmptyJob(user?.company_code));
              setView("editor");
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-xs font-medium shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Add Job
          </button>
        }
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search job, principal, reference..."
        loading={loading}
        height="calc(100vh - 180px)"
        // minWidth={1420}
        density="grid"
        enablePagination
        pageSize={25}
        enableExport
        exportFilename="outbound-jobs-list.csv"
        getRowId={(row, index) => String(value(row, "job_no") || index)}
        rowClassName={(row) => {
          // Apply row colors based on status, forcing onto cells to override DataTable defaults
          if (isCanceled(row)) return "[&>td]:bg-red-50/70"; // Cancelled -> Light Red
          if (hasDate(value(row, "confirm_date"))) return "[&>td]:bg-emerald-50/70"; // Confirmed -> Light Green
          return "[&>td]:bg-amber-50/70"; // In Progress -> Light Yellow
        }}
        onRowClick={(row) => navigate(outboundJobDetailPath(row))}
      />

      {/* Cancel Job Dialog */}
      <Dialog
        open={Boolean(cancelTarget)}
        title={`Cancel Job ${cancelTarget ? value(cancelTarget, "job_no") : ""}`}
        description="Please enter cancellation remarks before submitting."
        compact
        tone="danger"
        onClose={() => setCancelTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Close
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !cancelRemarks.trim()}
              onClick={confirmCancel}
            >
              Confirm Cancel
            </Button>
          </>
        }
      >
        <label className="field">
          <span>Cancel Remarks</span>
          <Input
            value={cancelRemarks}
            onChange={(event) => setCancelRemarks(event.target.value)}
            placeholder="Enter reason..."
          />
        </label>
      </Dialog>
    </section>
  );
}