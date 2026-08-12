import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, Plus, RefreshCw, Save, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { executeWmsInboundSql, patchWmsInbound, postWmsInbound } from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { InboundFormFrame } from "./InboundFormFrame";
import { InboundJobCreateForm } from "./InboundJobCreateForm";
import { useRawSqlDropdown } from "../../../hooks/useRawSqlDropdown";
import { listingTabs, inboundJobsPath } from "../../../config/staticData";
import {
  type WmsRow,
  value, normalizeRow, formatDate, flagBadge, filterJobByTab,
  makeEmptyJob, isCanceled, hasDate, sqlEscape, inboundJobDetailPath,
  JobClassPill,
} from "../../../utils/inboundHelpers";

export function InboundJobListing() {
  const { user }      = useAuth();
  const { toast }     = useToast();
  const companyCode   = user?.company_code || "";
  const navigate      = useNavigate();
  const [sortKey, setSortKey]           = useState(0);
  const [rows, setRows]                 = useState<WmsRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [query, setQuery]               = useState("");
  const [activeTab, setActiveTab]       = useState("in_progress");
  const [formOpen, setFormOpen]         = useState(false);
  const [form, setForm]                 = useState<WmsRow>(makeEmptyJob(companyCode));
  const [saving, setSaving]             = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WmsRow | null>(null);
  const [cancelRemarks, setCancelRemarks] = useState("");

  // Dropdown options (used by dropdownMap — kept for future field usage)
  useRawSqlDropdown({
    sql: `SELECT PRIN_CODE, PRIN_NAME FROM MS_PRINCIPAL WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY PRIN_NAME`,
    valueKey: "PRIN_CODE", labelKeys: ["PRIN_CODE", "PRIN_NAME"], enabled: !!companyCode,
  });
  useRawSqlDropdown({
    sql: `SELECT DIV_CODE, DIV_NAME FROM MS_HR_DIVISION WHERE COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY DIV_NAME`,
    valueKey: "DIV_CODE", labelKeys: ["DIV_CODE", "DIV_NAME"], enabled: !!companyCode,
  });

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await executeWmsInboundSql(
        `SELECT * FROM VW_TI_JOB WHERE JOB_TYPE = 'IMP' AND COMPANY_CODE = '${sqlEscape(companyCode)}' ORDER BY JOB_NO DESC`,
      );
      setRows(data.map(normalizeRow));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load inbound jobs");
    } finally {
      setLoading(false);
    }
  };

  useState(() => { void loadRows(); });

  const filteredRows = useMemo(
    () => rows.filter((row) => filterJobByTab(row, activeTab)),
    [rows, activeTab],
  );

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "job_no", header: "Job No", size: 130,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() => navigate(inboundJobDetailPath(row.original))}
          >
            {value(row.original, "job_no")}
          </button>
        ),
      },
      {
        accessorKey: "job_class", header: "Job Class", size: 180,
        cell: ({ row }) => <JobClassPill code={value(row.original, "job_class")} />,
      },
      {
        accessorKey: "prin_name", header: "Principal Name", size: 240,
        cell: ({ row }) => value(row.original, "prin_name"),
      },
      {
        accessorKey: "job_date", header: "Job Date", size: 120,
        cell: ({ row }) => formatDate(value(row.original, "job_date")),
      },
      ...(activeTab === "confirmed" ? [{
        accessorKey: "confirm_date", header: "Confirm Date", size: 130,
        cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "confirm_date")),
      }] : []),
      ...(activeTab === "cancel" ? [{
        accessorKey: "cancel_date", header: "Cancel Date", size: 130,
        cell: ({ row }: { row: { original: WmsRow } }) => formatDate(value(row.original, "cancel_date")),
      }] : []),
      { accessorKey: "doc_ref",      header: "Doc Ref",      size: 130, cell: ({ row }) => value(row.original, "doc_ref") },
      { accessorKey: "canceled",     header: "Canceled",     size: 100, cell: ({ row }) => flagBadge(value(row.original, "canceled")) },
      { accessorKey: "invoiced",     header: "Invoiced",     size: 100, cell: ({ row }) => flagBadge(value(row.original, "invoiced")) },
      { accessorKey: "invoice_date", header: "Invoice Date", size: 130, cell: ({ row }) => formatDate(value(row.original, "invoice_date")) },
      {
        id: "actions", header: "Actions", size: 120, enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" title="Open job"
              onClick={() => navigate(`view/${value(row.original, "job_no")}/shipment_details?principal_code=${value(row.original, "prin_code")}`)}>
              <Eye size={14} />
            </Button>
            {activeTab !== "cancel" && (
              <Button size="icon" variant="ghost" title="Cancel job" onClick={() => setCancelTarget(row.original)}>
                <Ban size={14} />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [activeTab, navigate],
  );

  const saveJob = async (event: FormEvent) => {
    event.preventDefault();
    if (!String(form.prin_code || "").trim()) { toast.warning("Principal is required"); return; }
    if (!String(form.job_class || "").trim()) { toast.warning("Job Classification is required"); return; }
    setSaving(true);
    try {
      const now   = new Date().toISOString();
      const today = now.slice(0, 10);
      await postWmsInbound("inboundjob", {
        job_type:            form.job_type || "IMP",
        company_code:        form.company_code || companyCode,
        job_date:            now,
        job_class:           form.job_class || "N",
        dept_code:           String(form.dept_code || ""),
        transport_mode:      String(form.transport_mode || "S"),
        doc_ref:             String(form.doc_ref || ""),
        port_code:           String(form.port_code || ""),
        description1:        String(form.description1 || ""),
        description2:        "",
        prin_ref1:           "",
        prin_ref2:           String(form.prin_ref2 || ""),
        remarks:             String(form.remarks || ""),
        eta: null, ata: null, etd: null,
        payment_terms: "", curr_code: "OMR", ex_rate: 1,
        frieght_value: 0, insurance_value: 0, cust_code: "",
        container_flag: "", container: "",
        packdet: "N", allocated: "N", canceled: "N", confirmed: "N",
        grn_no: null, invoiced: "N", completed: "", exp_jobno: "",
        picked: "N", ordered: "N",
        destination_port:    String(form.destination_port || ""),
        vessel_name: "", voyage_no: "", payableat: "",
        place_receipt: "", place_delivery: "", no_of_original_bl: null,
        broker_code: "", quotation_ref: "", be_deposits: "", ind_freight: "",
        country_origin:      String(form.country_origin || ""),
        country_destination: String(form.country_destination || ""),
        custom_recno: "", doc_ref2: "", hawb: "", reexport: "",
        ref_jobno: "", combined_jobno: "", carrier: "", job_lock: "",
        courier_code: "", delivery_point: "",
        div_code:            String(form.div_code || ""),
        salesman_code: "", transit_time: "", document_check: "",
        delivery_remarks: "", cargo_received: "", delivered_by: "",
        canceled_by: "", cancel_remarks: "", send_mail: "",
        backlog_mail: "", dplan_flag: "", trans_batch_id: "",
        send_mail_dn: "", kpi_inc: "", kpi_exc_remark: "",
        job_category:  "N/A", edit_user: "", tx_cat_code: "",
        bcf_code: "", request_category: "", load_point: "",
        updated_by:   user?.loginid || "Admin",
        created_by:   user?.loginid || "Admin",
        created_at:   now,
        prin_code:    String(form.prin_code || ""),
        schedule_date: String(form.schedule_date || today),
      });
      setFormOpen(false);
      toast.success("Inbound job saved successfully");
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save inbound job");
    } finally { setSaving(false); }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !cancelRemarks.trim()) {
      toast.warning("Please enter cancellation remarks");
      return;
    }
    setSaving(true);
    try {
      await patchWmsInbound("canceljob", {
        job_no:    value(cancelTarget, "job_no"),
        prin_code: value(cancelTarget, "prin_code"),
        remarks:   cancelRemarks,
      });
      setCancelTarget(null);
      setCancelRemarks("");
      toast.success("Inbound job cancellation submitted");
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel inbound job");
    } finally { setSaving(false); }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">WMS Inbound</p>
          <h1 className="m-0 text-2xl font-semibold text-foreground">Inbound Job Listing</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manage import jobs, shipment progress, receiving, putaway, confirmation, and activity billing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => { setForm(makeEmptyJob(companyCode)); setFormOpen(true); }}>
            <Plus size={15} /> Add Job
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
        {listingTabs.map((tab:any) => (
          <Button key={tab.value} size="sm" variant={activeTab === tab.value ? "default" : "outline"}
            onClick={() => setActiveTab(tab.value)}>
            {tab.label}
          </Button>
        ))}
      </div>

      <DataTable
        key={sortKey}
        columns={columns} data={filteredRows}
        title={loading ? "Loading" : `${filteredRows.length} Jobs`}
        subtitle="Inbound Jobs" searchValue={query} onSearchChange={setQuery}
        searchPlaceholder="Search job, principal, reference..."
        loading={loading} height="calc(100vh - 310px)" minWidth={1380} density="grid"
        enablePagination pageSize={50}
        getRowId={(row, index) => String(value(row, "job_no") || index)}
        rowClassName={(row) =>
          isCanceled(row)                        ? "bg-red-50/70"
          : hasDate(value(row, "confirm_date"))  ? "bg-emerald-50/70"
          : "bg-blue-50/50"
        }
      />

      {/* Add Job Modal */}
      <InboundFormFrame
        open={formOpen}
        title="Add Inbound Job"
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              <X size={15} /> Cancel
            </Button>
            <Button disabled={saving} form="inbound-job-form" type="submit">
              <Save size={15} /> {saving ? "Saving..." : "Save Job"}
            </Button>
          </>
        }
      >
        <InboundJobCreateForm
          form={form}
          setForm={setForm}
          companyCode={companyCode}
          onSubmit={saveJob}
        />
      </InboundFormFrame>

      {/* Cancel Job Dialog */}
      <Dialog
        open={Boolean(cancelTarget)}
        title={`Cancel Job ${cancelTarget ? value(cancelTarget, "job_no") : ""}`}
        description="Please enter cancellation remarks before submitting."
        compact tone="danger"
        onClose={() => setCancelTarget(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Close</Button>
            <Button variant="destructive" disabled={saving || !cancelRemarks.trim()} onClick={confirmCancel}>
              Confirm Cancel
            </Button>
          </>
        }
      >
        <label className="field">
          <span>Cancel Remarks</span>
          <Input value={cancelRemarks} onChange={(e) => setCancelRemarks(e.target.value)} placeholder="Enter reason..." />
        </label>
      </Dialog>
    </section>
  );
}