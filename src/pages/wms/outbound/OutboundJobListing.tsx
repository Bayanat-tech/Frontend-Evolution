import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, Pencil, Plus, RefreshCw } from "lucide-react";
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
// import type { WmsRow } from "./OutboundTypes";
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
import { JobClassPill, DialogActions } from "./OutboundFormFields";
import { OutboundFormFrame } from "./OutboundFormFields";
import { OutboundJobCreateForm } from "./OutboundJobCreateform";

export type WmsRow = Record<string, unknown>;

export function OutboundJobListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<WmsRow[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("in_progress");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
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
    setFormOpen(true);
  };

  const filteredRows = useMemo(
    () => rows.filter((row) => filterJobByTab(row, activeTab)),
    [rows, activeTab]
  );

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "job_no",
        header: "Job No",
        size: 130,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() => navigate(outboundJobDetailPath(row.original))}
          >
            {value(row.original, "job_no")}
          </button>
        ),
      },
      {
        accessorKey: "prin_name",
        header: "Principal Name",
        size: 260,
        cell: ({ row }) => value(row.original, "prin_name"),
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
        accessorKey: "job_date",
        header: "Job Date",
        size: 120,
        cell: ({ row }) => formatDate(value(row.original, "job_date")),
      },
      ...(activeTab === "confirmed"
        ? [
            {
              accessorKey: "confirm_date",
              header: "Confirm Date",
              size: 130,
              cell: ({ row }: { row: { original: WmsRow } }) =>
                formatDate(value(row.original, "confirm_date")),
            },
          ]
        : []),
      {
        accessorKey: "doc_ref",
        header: "Doc Ref",
        size: 130,
        cell: ({ row }) => value(row.original, "doc_ref"),
      },
      {
        accessorKey: "canceled",
        header: "Canceled",
        size: 105,
        cell: ({ row }) => flagBadge(value(row.original, "canceled")),
      },
      {
        accessorKey: "invoiced",
        header: "Invoiced",
        size: 105,
        cell: ({ row }) => flagBadge(value(row.original, "invoiced")),
      },
      {
        accessorKey: "invoice_date",
        header: "Invoice Date",
        size: 130,
        cell: ({ row }) => formatDate(value(row.original, "invoice_date")),
      },
      {
        id: "actions",
        header: "Actions",
        size: 125,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="Open job"
              onClick={() => navigate(outboundJobDetailPath(row.original))}
            >
              <Eye size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Edit job"
              onClick={() => void openEditJob(row.original)}
            >
              <Pencil size={14} />
            </Button>
            {canCancelOutboundJob(row.original, activeTab) && (
              <Button
                size="icon"
                variant="ghost"
                title="Cancel job"
                onClick={() => setCancelTarget(row.original)}
              >
                <Ban size={14} />
              </Button>
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
      setFormOpen(false);
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

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-foreground">
            Outbound Job Listing
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manage export jobs, customer orders, stock picking, cancellation,
            confirmation, and billing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => loadRows()}>
            <RefreshCw size={15} /> Refresh
          </Button>
          <Button
            onClick={() => {
              setEditingJobNo("");
              setForm(makeEmptyJob(user?.company_code));
              setFormOpen(true);
            }}
          >
            <Plus size={15} /> Add Job
          </Button>
        </div>
      </div>

      <NoticeToast notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
        {listingTabs.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={activeTab === tab.value ? "default" : "outline"}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        subtitle="Outbound Jobs"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search job, principal, reference..."
        loading={loading}
        height="calc(100vh - 310px)"
        minWidth={1420}
        density="grid"
        enablePagination
        pageSize={50}
        getRowId={(row, index) => String(value(row, "job_no") || index)}
        rowClassName={(row) =>
          isCanceled(row)
            ? "bg-red-50/70"
            : hasDate(value(row, "confirm_date"))
              ? "bg-emerald-50/70"
              : "bg-blue-50/50"
        }
      />

      <OutboundFormFrame
        open={formOpen}
        title={editingJobNo ? `Edit Outbound Job ${editingJobNo}` : "Add Outbound Job"}
        onClose={() => {
          setFormOpen(false);
          setEditingJobNo("");
        }}
        footer={
          <DialogActions
            formId="outbound-job-form"
            saving={saving}
            onCancel={() => {
              setFormOpen(false);
              setEditingJobNo("");
            }}
            submitText={editingJobNo ? "Update Job" : "Save Job"}
          />
        }
      >
        <OutboundJobCreateForm
          form={form}
          setForm={setForm}
          companyCode={user?.company_code || ""}
          onSubmit={saveJob}
        />
      </OutboundFormFrame>

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