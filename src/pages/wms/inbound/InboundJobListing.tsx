import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, Pencil, Plus, RefreshCw } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { executeWmsInboundSql, patchWmsInbound, postWmsInbound } from "../../../api/wms";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Dialog } from "../../../components/ui/Dialog";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../../../state/AuthContext";
import { useToast } from "../../../components/ui/AlertToast";
import { InboundJobForm } from "./InboundJobForm";
import { useRawSqlDropdown } from "../../../hooks/useRawSqlDropdown";
import {
  type WmsRow,
  value, normalizeRow, formatDate, flagBadge, filterJobByTab,
  makeEmptyJob, isCanceled, hasDate, sqlEscape, inboundJobDetailPath,
  JobClassPill,
} from "../../../utils/inboundHelpers";

// Define the tabs exactly like Freight
const listTabs = [
  { key: "in_progress", label: "In Progress" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancel", label: "Cancelled" },
];

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
  const [editingJobNo, setEditingJobNo] = useState("");

  // Dropdown options
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

  useEffect(() => {
    void loadRows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = useMemo(
    () => rows.filter((row) => filterJobByTab(row, activeTab)),
    [rows, activeTab],
  );

  // Count for tabs
  const getTabCount = (tabKey: string) => {
    return rows.filter((row) => filterJobByTab(row, tabKey)).length;
  };

  const openEditJob = (row: WmsRow) => {
    setEditingJobNo(value(row, "job_no"));
    setForm(row); 
    setFormOpen(true);
  };

  const columns = useMemo<ColumnDef<WmsRow>[]>(
    () => [
      {
        accessorKey: "job_no", header: "Job No", size: 50,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline text-[11.5px] text-left cursor-pointer"
            onClick={() => navigate(inboundJobDetailPath(row.original))}
          >
            {value(row.original, "job_no")}
          </button>
        ),
      },
      {
        accessorKey: "job_class", header: "Job Class", size: 50,
        cell: ({ row }) => <JobClassPill code={value(row.original, "job_class")} />,
      },
      {
        accessorKey: "prin_name", header: "Principal Name", size: 100,
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{value(row.original, "prin_name")}</span>,
      },
      {
        accessorKey: "job_date", header: "Job Date", size: 120,
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{formatDate(value(row.original, "job_date"))}</span>,
      },
      ...(activeTab === "confirmed" ? [{
        accessorKey: "confirm_date", header: "Confirm Date", size: 130,
        cell: ({ row }: { row: { original: WmsRow } }) => <span className="text-[11.5px] text-foreground">{formatDate(value(row.original, "confirm_date"))}</span>,
      }] : []),
      ...(activeTab === "cancel" ? [{
        accessorKey: "cancel_date", header: "Cancel Date", size: 130,
        cell: ({ row }: { row: { original: WmsRow } }) => <span className="text-[11.5px] text-foreground">{formatDate(value(row.original, "cancel_date"))}</span>,
      }] : []),
      { 
        accessorKey: "invoiced", 
        header: "Invoiced", 
        size: 100, 
        cell: ({ row }) => <span className="text-[11.5px] text-foreground">{flagBadge(value(row.original, "invoiced"))}</span> 
      },
      {
        id: "actions", header: "ACTIONS", size: 125, enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Open job"
              onClick={(event) => {
                event.stopPropagation(); // Prevent row click
                navigate(`view/${value(row.original, "job_no")}/job_details?principal_code=${value(row.original, "prin_code")}`);
              }}
            >
              <Eye size={13} />
            </button>
            <button
              type="button"
              className="h-6 w-6 grid place-items-center text-slate-500 hover:text-[#00378C] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Edit job"
              onClick={(event) => {
                event.stopPropagation(); // Prevent row click
                openEditJob(row.original);
              }}
            >
              <Pencil size={13} />
            </button>
            {activeTab !== "cancel" && (
              <button
                type="button"
                className="h-6 w-6 grid place-items-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Cancel job"
                onClick={(event) => {
                  event.stopPropagation(); // ✅ Fix: Stop row click so modal can open
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
    [activeTab, navigate, openEditJob],
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
        created_at:   String(form.schedule_date || today),
        prin_code:    String(form.prin_code || ""),
        schedule_date: String(form.schedule_date || today),
      });
      setFormOpen(false);
      setEditingJobNo("");
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

  // Page-style form replaces the listing entirely while adding a job
  if (formOpen) {
    return (
      <InboundJobForm
        form={form}
        setForm={setForm}
        companyCode={companyCode}
        saving={saving}
        onSubmit={saveJob}
        onClose={() => { setFormOpen(false); setEditingJobNo(""); }}
      />
    );
  }

  return (
    <section className="freight-enquiry-list-screen grid gap-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2.5">
          <h2
            className="text-foreground m-0"
            style={{ fontSize: "18px", letterSpacing: "-0.01em", fontWeight: 600 }}
          >
            Inbound Job Listing
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* <Button variant="outline" onClick={loadRows}><RefreshCw size={15} /> Refresh</Button> */}
        </div>
      </div>

      {/* Tabs with counts - exactly like Freight */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {listTabs.map((tab) => {
          const count = getTabCount(tab.key);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
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
        key={sortKey}
        columns={columns} 
        data={filteredRows}
        toolbar={
          <button
            type="button"
            onClick={() => { setEditingJobNo(""); setForm(makeEmptyJob(companyCode)); setFormOpen(true); }}
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
        // minWidth={1380} 
        density="grid"
        enablePagination 
        pageSize={25}
        enableExport
        exportFilename="inbound-jobs-list.csv"
        getRowId={(row, index) => String(value(row, "job_no") || index)}
        rowClassName={(row) => {
          // Apply row colors based on status, forcing onto cells to override DataTable defaults
          if (isCanceled(row)) return "[&>td]:bg-red-50/70"; // Cancelled -> Light Red
          if (hasDate(value(row, "confirm_date"))) return "[&>td]:bg-emerald-50/70"; // Confirmed -> Light Green
          return "[&>td]:bg-amber-50/70"; // In Progress -> Light Yellow
        }}
        onRowClick={(row) => navigate(inboundJobDetailPath(row))}
      />

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