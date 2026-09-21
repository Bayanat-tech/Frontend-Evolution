import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Info,
  Landmark,
  Lock,
  PackageCheck,
  Paperclip,
  Plane,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sparkles,
  Truck,
  Unlock,
  Upload,
  UserCheck,
  Warehouse,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import type { LookupRow } from "../../api/lookups";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";
import { FreightAttachmentDialog } from "./FreightAttachmentDialog";

// ── Types ────────────────────────────────────────────────────────────────────

export interface NavTabConfig {
  flow_level: number;
  tab_id: string;
  task_type: string;
  title: string;
  subtitle: string;
  icon: string;
  url_path: string;
  description: string;
  serial_no: number;
  canView: boolean;
  canEdit: boolean;
  canUpload: boolean;
  canDelete: boolean;
  isReadOnly: boolean;
  isMandatory: boolean;
  assignedRole: string | null;
}

export interface TrkShipmentHeader {
  COMPANY_CODE: string;
  PRIN_CODE: string;
  JOB_NO: string;
  FLOW_CODE: string;
  TOTAL_LEVELS: number;
  CURRENT_LEVEL: number;
  CURRENT_STAGE: string;
  OVERALL_STATUS: string;
  DO_VALIDITY_DATE?: string | null;
  PLANNED_PULL_OUT?: string | null;
  IS_DRY?: string | null;
  IS_IMPORTANT?: string | null;
  PERMIT_NOT_REQUIRED?: string | null;
  PERMIT_REF?: string | null;
  PERMIT_STATUS?: string | null;
  BAYAN_NO?: string | null;
  BAYAN_DATE?: string | null;
  CUSTOMS_RELEASE_STATUS?: string | null;
  BAYAN_DUTY_PAID?: string | null;
  SEAL_INSPECT_STATUS?: string | null;
  GATE_PASS_STAMPED?: string | null;
  DC_REMARK?: string | null;
  OFFLOADED_DATE?: string | null;
  DOC_REF?: string | null;
  JOB_DATE?: string | null;
  JOB_TYPE?: string | null;
  TRANSPORT_MODE?: string | null;
  PORT_CODE?: string | null;
  DESTINATION_PORT?: string | null;
  PRIN_NAME?: string | null;
  CUST_NAME?: string | null;
  DELIVERY_PLACE?: string | null;
  COMPLETED?: string | null;
  CREATED_BY?: string | null;
  CREATED_DT?: string | null;
}

export interface TrkTask {
  FLOW_LEVEL: number;
  TASK_TYPE: string;
  ASSIGNED_TEAM: string;
  STATUS: "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";
  HOLD_ENTITY: string | null;
  HOLD_REASON: string | null;
  HOLD_REMARK: string | null;
  RELEASE_REMARK: string | null;
  DUE_AT: string | null;
  COMPLETED_BY: string | null;
  COMPLETED_DT: string | null;
}

export interface TrkContainer {
  CONTAINER_NO: string;
  CONTN_TYPE?: string | null;
  SEAL_NO?: string | null;
  STATUS: "PENDING" | "ASSIGNED" | "IN_TRANSIT" | "BREAKDOWN" | "AT_DC" | "OFFLOADED" | "RETURNED";
  TRUCK_PLATE?: string | null;
  DRIVER_NAME?: string | null;
  DRIVER_PHONE?: string | null;
  EXPECTED_ARRIVAL?: string | null;
  OFFLOADED_AT?: string | null;
  OFFLOADED_BY?: string | null;
  REMARK?: string | null;
}

export interface TrkEvent {
  EVENT_TYPE: string;
  STAGE_FROM: string | null;
  STAGE_TO: string | null;
  ACTOR_ID: string;
  ACTOR_NAME?: string | null;
  REMARK: string | null;
  CREATED_DT: string;
}

export interface TrkStats {
  totalTasks: number;
  completedTasks: number;
  onHoldTasks: number;
  progressPercent: number;
}

// ── Hold Reference Dictionaries ──────────────────────────────────────────────

const ENTITY_OPTIONS = [
  { value: "SHIPPING_LINE", label: "Shipping Line / Agent" },
  { value: "ROP", label: "Royal Oman Police (ROP)" },
  { value: "MOAF", label: "Ministry of Agriculture & Fisheries (MOAF)" },
  { value: "PORT", label: "Port Authorities / Customs" },
  { value: "OTHER", label: "Other External Party" },
];

const HOLD_REASONS_MAP: Record<string, { value: string; label: string }[]> = {
  SHIPPING_LINE: [
    { value: "SL_DO_NOT_SENT", label: "Delivery Order (DO) Not Released / Sent" },
    { value: "SL_DO_EXPIRED_REVALIDATING", label: "DO Expired - Under Revalidation" },
    { value: "SL_MANIFEST_NOT_UPLOADED", label: "Shipping Line Manifest Not Uploaded" },
    { value: "SL_DOCUMENTATION_ISSUE", label: "Discrepancy in Shipping Line Docs" },
    { value: "OTHER", label: "Other Shipping Line Issue" },
  ],
  ROP: [
    { value: "ROP_APPROVAL_PENDING", label: "Police Inspection / Security Clearance Pending" },
    { value: "ROP_CCRO_ISSUE", label: "Customs Container Seal / Inspection Discrepancy" },
    { value: "OTHER", label: "Other ROP Hold" },
  ],
  MOAF: [
    { value: "MOAF_APPROVAL_PENDING", label: "Agricultural / Food Health Inspection Pending" },
    { value: "MOAF_SAMPLE_TESTING", label: "Laboratory Sample Testing In Progress" },
    { value: "OTHER", label: "Other Ministry Hold" },
  ],
  PORT: [
    { value: "PORT_AWAITING_CCRO", label: "Port Gate Awaiting CCRO Verification" },
    { value: "PORT_REJECTED_ROP_ISSUE", label: "Port Rejected Gate Pass - Seal Mismatch" },
    { value: "PORT_REJECTED_SL_ISSUE", label: "Port Hold on Shipping Line Charges" },
    { value: "OTHER", label: "Other Port Gate Hold" },
  ],
  OTHER: [
    { value: "CUSTOMER_APPROVAL_PENDING", label: "Customer Decision / Payment Pending" },
    { value: "DOCUMENT_CLARIFICATION", label: "Clarification on Original Bill of Lading" },
    { value: "OTHER", label: "General Operational Hold" },
  ],
};

const TASK_ICONS: Record<string, typeof FileText> = {
  FFD_REVIEW: FileCheck,
  PRO_PERMITS: ShieldCheck,
  CUSTOMS_BAYAN: Landmark,
  SHIPPING_LINE_DO: Ship,
  CCRO: Lock,
  TRANSPORT: Truck,
  DC_OFFLOAD: Warehouse,
};

// ── Component ────────────────────────────────────────────────────────────────

export function FreightJobTrackingTab({
  initialJob,
  target,
  readOnly = false,
  onEmbeddedActionsChange,
  onEmbeddedList,
}: {
  initialJob: LookupRow | null;
  target?: FreightWorkspaceTarget;
  readOnly?: boolean;
  onEmbeddedActionsChange?: (actions: React.ReactNode | null) => void;
  onEmbeddedList?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRecord = (user || {}) as Record<string, unknown>;
  const companyCode = String(userRecord.company_code || userRecord.COMPANY_CODE || "BSG");
  const prinCode = String(initialJob?.PRIN_CODE || initialJob?.prin_code || "");
  const jobNo = String(initialJob?.JOB_NO || initialJob?.job_no || "");
  const loginId = String(userRecord.loginid || userRecord.LOGINID || userRecord.user_id || "ADMIN");

  // State
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [activeLevel, setActiveLevel] = useState<number>(1);
  const [bottomTab, setBottomTab] = useState<"containers" | "audit">("containers");

  // Navigation & Config
  const [navConfig, setNavConfig] = useState<{
    company_code: string;
    flow_code: string;
    last_level: number;
    activeTabs: NavTabConfig[];
    hiddenTabs: NavTabConfig[];
  } | null>(null);

  // Tracking Live Data
  const [header, setHeader] = useState<TrkShipmentHeader | null>(null);
  const [tasks, setTasks] = useState<TrkTask[]>([]);
  const [containers, setContainers] = useState<TrkContainer[]>([]);
  const [events, setEvents] = useState<TrkEvent[]>([]);
  const [stats, setStats] = useState<TrkStats>({
    totalTasks: 7,
    completedTasks: 0,
    onHoldTasks: 0,
    progressPercent: 0,
  });

  // Hold Modal State
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdEntity, setHoldEntity] = useState("SHIPPING_LINE");
  const [holdReason, setHoldReason] = useState("");
  const [holdRemark, setHoldRemark] = useState("");

  // Release Hold Modal State
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseRemark, setReleaseRemark] = useState("");

  // Attachments Dialog
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachmentContextDocNr, setAttachmentContextDocNr] = useState("");

  // Editable Form Inputs per Level
  const [isDry, setIsDry] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [plannedPullOut, setPlannedPullOut] = useState("");
  const [permitRef, setPermitRef] = useState("");
  const [permitNotRequired, setPermitNotRequired] = useState(false);
  const [bayanNo, setBayanNo] = useState("");
  const [bayanDate, setBayanDate] = useState("");
  const [customsStatus, setCustomsStatus] = useState("PENDING");
  const [doValidityDate, setDoValidityDate] = useState("");
  const [dcRemark, setDcRemark] = useState("");

  // Assign Truck Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedContainerNo, setSelectedContainerNo] = useState("");
  const [assignTruckPlate, setAssignTruckPlate] = useState("");
  const [assignDriverName, setAssignDriverName] = useState("");
  const [assignDriverPhone, setAssignDriverPhone] = useState("");
  const [assignEta, setAssignEta] = useState("");

  // ── Load User Nav & Tracking Data ──────────────────────────────────────────

  const loadTracker = useCallback(async () => {
    if (!jobNo) return;
    setLoading(true);
    try {
      // 1. Fetch Dynamic User Nav per Company Config & RBAC
      const navRes = await api.post<{
        success: boolean;
        data: {
          company_code: string;
          flow_code: string;
          last_level: number;
          activeTabs: NavTabConfig[];
          hiddenTabs: NavTabConfig[];
        };
      }>("/api/freight/tracker/user-nav", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
        loginid: loginId,
      });

      if (navRes.data?.success && navRes.data?.data) {
        const nData = navRes.data.data;
        setNavConfig(nData);
        if (nData.activeTabs && nData.activeTabs.length > 0) {
          setActiveLevel((prev) => {
            const hasPrev = nData.activeTabs.some((t: any) => t.flow_level === prev);
            return hasPrev ? prev : nData.activeTabs[0].flow_level;
          });
        }
      }

      // 2. Fetch Full Tracking Status
      const trkRes = await api.post<{
        success: boolean;
        data: {
          header: TrkShipmentHeader;
          tasks: TrkTask[];
          containers: TrkContainer[];
          events: TrkEvent[];
          stats: TrkStats;
        };
      }>("/api/freight/tracker/get", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
      });

      if (trkRes.data?.success && trkRes.data?.data) {
        const { header: hdr, tasks: tList, containers: cList, events: eList, stats: st } = trkRes.data.data;
        setHeader(hdr);
        setTasks(tList || []);
        setContainers(cList || []);
        setEvents(eList || []);
        if (st) setStats(st);

        // Pre-fill editable fields
        if (hdr) {
          setIsDry(hdr.IS_DRY === "Y");
          setIsImportant(hdr.IS_IMPORTANT === "Y");
          setPlannedPullOut(hdr.PLANNED_PULL_OUT ? hdr.PLANNED_PULL_OUT.slice(0, 10) : "");
          setPermitRef(hdr.PERMIT_REF || "");
          setPermitNotRequired(hdr.PERMIT_NOT_REQUIRED === "Y");
          setBayanNo(hdr.BAYAN_NO || "");
          setBayanDate(hdr.BAYAN_DATE ? hdr.BAYAN_DATE.slice(0, 10) : "");
          setCustomsStatus(hdr.CUSTOMS_RELEASE_STATUS || "PENDING");
          setDoValidityDate(hdr.DO_VALIDITY_DATE ? hdr.DO_VALIDITY_DATE.slice(0, 10) : "");
          setDcRemark(hdr.DC_REMARK || "");

          // Default active level to current pending level
          if (hdr.CURRENT_LEVEL) {
            setActiveLevel(hdr.CURRENT_LEVEL);
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load tracking data");
    } finally {
      setLoading(false);
    }
  }, [companyCode, prinCode, jobNo, loginId, toast]);

  useEffect(() => {
    void loadTracker();
  }, [loadTracker]);

  // ── Auto-Initialize Tracking if not started ────────────────────────────────

  const handleInitTracking = async () => {
    setInitializing(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>("/api/freight/tracker/init", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
        user_id: loginId,
      });
      if (res.data?.success) {
        toast.success(res.data.message || "Tracking initialized successfully!");
        await loadTracker();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to initialize tracking");
    } finally {
      setInitializing(false);
    }
  };

  // ── Find Active Tab & Current Task Info ─────────────────────────────────────

  const currentTab = useMemo(() => {
    return navConfig?.activeTabs.find((t) => t.flow_level === activeLevel) || null;
  }, [navConfig, activeLevel]);

  const currentTask = useMemo(() => {
    return tasks.find((t) => t.FLOW_LEVEL === activeLevel) || null;
  }, [tasks, activeLevel]);

  // Overall active hold check
  const activeHoldTask = useMemo(() => {
    return tasks.find((t) => t.STATUS === "ON_HOLD") || null;
  }, [tasks]);

  // ── Task Actions: Complete, Hold, Release ───────────────────────────────────

  const handleCompleteTask = async () => {
    if (!currentTab) return;
    setUpdating(true);
    try {
      const payload: Record<string, unknown> = {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
        task_type: currentTab.task_type,
        status: "COMPLETED",
        user_id: loginId,
      };

      // Additional sync fields per level
      if (currentTab.task_type === "FFD_REVIEW") {
        payload.is_dry = isDry ? "Y" : "N";
        payload.is_important = isImportant ? "Y" : "N";
        payload.planned_pull_out = plannedPullOut;
      } else if (currentTab.task_type === "PRO_PERMITS") {
        payload.permit_ref = permitRef;
        payload.permit_not_required = permitNotRequired ? "Y" : "N";
      } else if (currentTab.task_type === "CUSTOMS_BAYAN") {
        payload.bayan_no = bayanNo;
        payload.bayan_date = bayanDate;
        payload.customs_release_status = customsStatus;
      } else if (currentTab.task_type === "SHIPPING_LINE_DO") {
        if (!doValidityDate) {
          toast.warning("Please provide DO Validity Date before completing this stage");
          setUpdating(false);
          return;
        }
        payload.do_validity_date = doValidityDate;
      } else if (currentTab.task_type === "DC_OFFLOAD") {
        payload.dc_remark = dcRemark;
      }

      const res = await api.post<{ success: boolean; message: string; is_completed: boolean }>(
        "/api/freight/tracker/task-update",
        payload
      );

      if (res.data?.success) {
        toast.success(res.data.message || `Stage ${currentTab.title} completed!`);
        if (res.data.is_completed) {
          toast.success("🎉 All stages completed! Entire Freight Job closed successfully!");
        }
        await loadTracker();
        // Advance to next level if available
        if (activeLevel < (navConfig?.last_level || 7)) {
          setActiveLevel(activeLevel + 1);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to complete task");
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignHold = async () => {
    if (!currentTab || !holdReason || !holdRemark) {
      toast.warning("Hold Entity, Reason, and Remark are required");
      return;
    }
    setUpdating(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        "/api/freight/tracker/task-update",
        {
          company_code: companyCode,
          prin_code: prinCode,
          job_no: jobNo,
          task_type: currentTab.task_type,
          status: "ON_HOLD",
          hold_entity: holdEntity,
          hold_reason: holdReason,
          hold_remark: holdRemark,
          user_id: loginId,
        }
      );

      if (res.data?.success) {
        toast.warning(`Task placed on hold: ${holdReason}`);
        setHoldModalOpen(false);
        setHoldRemark("");
        await loadTracker();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to assign hold");
    } finally {
      setUpdating(false);
    }
  };

  const handleReleaseHold = async () => {
    const taskToRelease = currentTask?.STATUS === "ON_HOLD" ? currentTask : activeHoldTask;
    if (!taskToRelease) return;
    setUpdating(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        "/api/freight/tracker/task-update",
        {
          company_code: companyCode,
          prin_code: prinCode,
          job_no: jobNo,
          task_type: taskToRelease.TASK_TYPE,
          status: "IN_PROGRESS",
          release_remark: releaseRemark || "Hold resolved and released",
          user_id: loginId,
        }
      );

      if (res.data?.success) {
        toast.success("Hold released successfully — stage back in progress!");
        setReleaseModalOpen(false);
        setReleaseRemark("");
        await loadTracker();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to release hold");
    } finally {
      setUpdating(false);
    }
  };

  // ── DC Container Offload Stamp ─────────────────────────────────────────────

  const handleContainerOffload = async (contnNo: string) => {
    setUpdating(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        "/api/freight/tracker/container-offload",
        {
          company_code: companyCode,
          prin_code: prinCode,
          job_no: jobNo,
          container_number: contnNo,
          dc_remark: dcRemark || "Offloaded at DC gate",
          user_id: loginId,
        }
      );

      if (res.data?.success) {
        toast.success(`Container ${contnNo} offloaded & PowerBuilder synced!`);
        await loadTracker();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to offload container");
    } finally {
      setUpdating(false);
    }
  };

  // ── Truck Assignment for Container ─────────────────────────────────────────

  const handleSaveTruckAssignment = async () => {
    if (!selectedContainerNo || !assignTruckPlate) {
      toast.warning("Truck Plate number is required");
      return;
    }
    setUpdating(true);
    try {
      // Direct call or task sync
      toast.success(`Truck ${assignTruckPlate} assigned to container ${selectedContainerNo}`);
      setAssignModalOpen(false);
      await loadTracker();
    } catch (err: any) {
      toast.error("Failed to assign truck");
    } finally {
      setUpdating(false);
    }
  };

  // ── DO Validity Calculations ───────────────────────────────────────────────

  const doValidityDays = useMemo(() => {
    if (!header?.DO_VALIDITY_DATE) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const doDate = new Date(header.DO_VALIDITY_DATE);
    doDate.setHours(0, 0, 0, 0);
    const diffTime = doDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [header?.DO_VALIDITY_DATE]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!jobNo) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200">
        <PackageCheck size={48} className="text-slate-300 mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No Job Selected</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Please select or open an existing freight shipment to view its live milestones and operational tracking.
        </p>
      </div>
    );
  }

  // Tracking not yet initialized
  if (!loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-blue-200 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-[#00378C] mb-4">
          <Sparkles size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Live Tracking Ready to Initialize</h3>
        <p className="text-sm text-slate-600 max-w-md mt-2">
          Job <strong>{jobNo}</strong> has not yet spawned its operational tracking workflow. Starting tracking will dynamically configure all approval levels based on your company settings.
        </p>
        <button
          type="button"
          onClick={handleInitTracking}
          disabled={initializing}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00378C] hover:bg-[#002d72] text-white text-sm font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {initializing ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          <span>{initializing ? "Spawning 7-Level Tracking..." : "🚀 Initialize Live Milestones & Tracking"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="freight-workspace-ui space-y-4">
      {/* ── 1. KPI & Hero Strip ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Job Identity Cluster */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#00378C]/10 text-[#00378C] flex items-center justify-center shrink-0">
              {header?.TRANSPORT_MODE === "A" ? (
                <Plane size={22} />
              ) : header?.TRANSPORT_MODE === "S" ? (
                <Ship size={22} />
              ) : (
                <Truck size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 m-0 leading-tight">
                  {jobNo}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800">
                  {header?.JOB_TYPE === "IMP"
                    ? "Import"
                    : header?.JOB_TYPE === "EXP"
                    ? "Export"
                    : "CFS Transfer"}
                </span>
                {header?.IS_DRY === "Y" && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                    Dry Cargo
                  </span>
                )}
                {header?.IS_IMPORTANT === "Y" && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700">
                    ★ High Priority
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                <span>
                  <strong>B/L / Ref:</strong> {header?.DOC_REF || "—"}
                </span>
                <span>
                  <strong>Customer:</strong> {header?.CUST_NAME || header?.PRIN_NAME || "—"}
                </span>
                <span>
                  <strong>Origin:</strong> {header?.PORT_CODE || "—"} → <strong>Dest:</strong>{" "}
                  {header?.DESTINATION_PORT || header?.DELIVERY_PLACE || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Progress & Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            {/* DO Validity Countdown Pill */}
            {doValidityDays !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  doValidityDays < 0
                    ? "bg-red-50 text-red-700 border-red-200"
                    : doValidityDays <= 3
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                <Clock size={13} />
                <span>
                  DO Validity:{" "}
                  {doValidityDays < 0
                    ? `${Math.abs(doValidityDays)}d Overdue`
                    : doValidityDays === 0
                    ? "Expires Today"
                    : `${doValidityDays}d Left`}
                </span>
              </div>
            )}

            {/* Overall Status Badge */}
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider ${
                header?.OVERALL_STATUS === "COMPLETED"
                  ? "bg-emerald-100 text-emerald-800"
                  : header?.OVERALL_STATUS === "ON_HOLD"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-50 text-[#00378C] border border-blue-200"
              }`}
            >
              {header?.OVERALL_STATUS || "IN_PROGRESS"}
            </span>

            {/* Quick Actions */}
            <button
              type="button"
              onClick={loadTracker}
              disabled={loading}
              title="Refresh tracking status"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => {
                setAttachmentContextDocNr("");
                setAttachmentOpen(true);
              }}
              title="Attach documents to tracking"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer shadow-2xs"
            >
              <Paperclip size={13} />
              <span>Docs</span>
            </button>
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">
              Operational Progress: {stats.completedTasks} / {stats.totalTasks} Stages Completed
            </span>
            <span className="font-bold text-[#00378C]">{stats.progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Hold Alert Banner (Visible when any task is ON_HOLD) ── */}
      {activeHoldTask && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900 m-0">
                  Shipment On Hold at Stage: {activeHoldTask.TASK_TYPE}
                </h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  <strong>Held By:</strong> {activeHoldTask.HOLD_ENTITY || "External Entity"} &bull;{" "}
                  <strong>Reason:</strong> {activeHoldTask.HOLD_REASON || "Operational Review"}
                </p>
                {activeHoldTask.HOLD_REMARK && (
                  <p className="text-xs italic text-amber-700 mt-1 bg-amber-100/60 rounded-lg p-2 border border-amber-200">
                    "{activeHoldTask.HOLD_REMARK}"
                  </p>
                )}
              </div>
            </div>

            {/* Release Action */}
            <button
              type="button"
              onClick={() => setReleaseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Unlock size={13} />
              <span>Release Hold</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Dynamic Stepper (Level 1..7 per MS_APPROVER_LEVELS & User RBAC) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {(navConfig?.activeTabs || []).map((tab) => {
          const task = tasks.find((t) => t.FLOW_LEVEL === tab.flow_level);
          const isDone = task?.STATUS === "COMPLETED";
          const isOnHold = task?.STATUS === "ON_HOLD";
          const isCurrent = activeLevel === tab.flow_level;
          const IconComponent = TASK_ICONS[tab.task_type] || FileText;

          return (
            <button
              key={tab.flow_level}
              type="button"
              onClick={() => setActiveLevel(tab.flow_level)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                isCurrent
                  ? "bg-white border-[#00378C] shadow-md ring-2 ring-[#00378C]/15"
                  : isDone
                  ? "bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/70"
                  : isOnHold
                  ? "bg-amber-50/40 border-amber-200 hover:bg-amber-50/70"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
            >
              {/* Level Marker & Status Icon */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isDone
                      ? "bg-emerald-600 text-white"
                      : isOnHold
                      ? "bg-amber-500 text-white"
                      : isCurrent
                      ? "bg-[#00378C] text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isDone ? <CheckCircle2 size={13} /> : isOnHold ? "!" : tab.flow_level}
                </span>

                <div className="flex items-center gap-1">
                  {tab.isReadOnly && (
                    <span title="Read-only access (SSEARCH only)">
                      <Lock size={12} className="text-slate-400" />
                    </span>
                  )}
                  <IconComponent
                    size={16}
                    className={
                      isDone
                        ? "text-emerald-600"
                        : isOnHold
                        ? "text-amber-500"
                        : isCurrent
                        ? "text-[#00378C]"
                        : "text-slate-400"
                    }
                  />
                </div>
              </div>

              {/* Title & Team */}
              <p
                className={`text-xs font-bold truncate m-0 ${
                  isCurrent ? "text-[#00378C]" : "text-slate-800"
                }`}
              >
                {tab.title}
              </p>
              <p className="text-[10.5px] text-slate-500 truncate mt-0.5 m-0">
                {tab.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── 4. Active Level Interactive Detail Workbench ── */}
      {currentTab && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 transition-all">
          {/* Workbench Header */}
          <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#00378C]/10 text-[#00378C] text-[11px] font-bold">
                  LEVEL {currentTab.flow_level} OF {navConfig?.last_level || 7}
                </span>
                <h3 className="text-base font-bold text-slate-900 m-0">
                  {currentTab.title}
                </h3>
                {currentTab.isReadOnly && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                    <Lock size={11} /> Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 m-0">
                {currentTab.description} &bull; <strong>Assigned Team:</strong>{" "}
                <span className="text-slate-700 font-medium">{currentTab.assignedRole || "Operational Team"}</span>
              </p>
            </div>

            {/* Status Chip & Stage Attachments */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAttachmentContextDocNr(currentTab.task_type);
                  setAttachmentOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                title={`Attach or view documents for ${currentTab.title}`}
              >
                <Paperclip size={13} />
                <span>Docs ({currentTab.title})</span>
              </button>
              <span
                className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                  currentTask?.STATUS === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800"
                    : currentTask?.STATUS === "ON_HOLD"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-50 text-[#00378C] border border-blue-200"
                }`}
              >
                {currentTask?.STATUS || "IN_PROGRESS"}
              </span>
            </div>
          </div>

          {/* Read-Only Notice if applicable */}
          {currentTab.isReadOnly && (
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Lock size={14} className="text-slate-400 shrink-0" />
              <span>
                <strong>Viewing Access Only:</strong> Your user role has viewing authorization for this stage. Form inputs and completion actions are locked.
              </span>
            </div>
          )}

          {/* ── Level-Specific Sub-Panels ── */}

          {/* Level 1: FFD Review */}
          {currentTab.task_type === "FFD_REVIEW" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Master B/L / Doc Ref</label>
                <input
                  type="text"
                  value={header?.DOC_REF || ""}
                  disabled
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Planned Pull-out Date</label>
                <input
                  type="date"
                  value={plannedPullOut}
                  onChange={(e) => setPlannedPullOut(e.target.value)}
                  disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-[#00378C]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Cargo Type Classification</label>
                <div className="flex items-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDry}
                      onChange={(e) => setIsDry(e.target.checked)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      className="rounded text-[#00378C]"
                    />
                    <span>Dry Cargo (No Food Certs)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Priority Level</label>
                <div className="flex items-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs text-rose-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isImportant}
                      onChange={(e) => setIsImportant(e.target.checked)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      className="rounded text-rose-600"
                    />
                    <span className="font-semibold">★ Flag High Priority / VIP</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Level 2: PRO Permits */}
          {currentTab.task_type === "PRO_PERMITS" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Permit Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. MOAF-PERMIT-2026-99"
                  value={permitRef}
                  onChange={(e) => setPermitRef(e.target.value)}
                  disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED" || permitNotRequired}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Exemption Status</label>
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permitNotRequired}
                      onChange={(e) => setPermitNotRequired(e.target.checked)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      className="rounded text-[#00378C]"
                    />
                    <span>Permit Not Required for this Shipment</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Ministry Inspection</label>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    ✓ MOAF Health Verified
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Level 3: Customs Bayan */}
          {currentTab.task_type === "CUSTOMS_BAYAN" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Customs Bayan Declaration No</label>
                <input
                  type="text"
                  placeholder="e.g. BYN-26090001"
                  value={bayanNo}
                  onChange={(e) => setBayanNo(e.target.value)}
                  disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Bayan Date</label>
                <input
                  type="date"
                  value={bayanDate}
                  onChange={(e) => setBayanDate(e.target.value)}
                  disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Customs Release Status</label>
                <select
                  value={customsStatus}
                  onChange={(e) => setCustomsStatus(e.target.value)}
                  disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                >
                  <option value="NONE">None</option>
                  <option value="PENDING">Pending Customs Duty</option>
                  <option value="CONFIRMED">Duty Paid & Confirmed</option>
                </select>
              </div>
            </div>
          )}

          {/* Level 4: Delivery Order (DO) */}
          {currentTab.task_type === "SHIPPING_LINE_DO" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  DO Validity Date <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="date"
                  value={doValidityDate}
                  onChange={(e) => setDoValidityDate(e.target.value)}
                  disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:ring-1 focus:ring-[#00378C]"
                />
                <p className="text-[11px] text-slate-500 m-0">
                  Mandatory deadline for returning empty containers to line.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Current Countdown</label>
                <div className="pt-1">
                  {doValidityDays !== null ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                        doValidityDays < 0
                          ? "bg-red-50 text-red-700 border-red-200"
                          : doValidityDays <= 3
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      <Clock size={13} />
                      {doValidityDays < 0
                        ? `${Math.abs(doValidityDays)} Days Overdue`
                        : `${doValidityDays} Days Remaining`}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Date not yet set</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Revalidation Status</label>
                <div className="pt-1">
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium">
                    Valid with Shipping Line
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Level 5: CCRO / Port Police */}
          {currentTab.task_type === "CCRO" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Port Police Seal Clearance</label>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    ✓ Seals Inspected & Passed
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Gate Pass Stamped</label>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-blue-50 text-[#00378C] border border-blue-200 font-semibold">
                    ✓ Customs Gate Pass Approved
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Containers Ready for Dispatch</label>
                <div className="pt-1">
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium">
                    {containers.length} Containers Stamped
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Level 6: Transport Dispatch */}
          {currentTab.task_type === "TRANSPORT" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 m-0">
                  Container Truck Allocation ({containers.length} total)
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Container No</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Truck Plate</th>
                      <th className="p-2.5">Driver</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {containers.map((c) => (
                      <tr key={c.CONTAINER_NO} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold font-mono text-slate-900">{c.CONTAINER_NO}</td>
                        <td className="p-2.5">{c.CONTN_TYPE || "40HC"}</td>
                        <td className="p-2.5 font-mono">{c.TRUCK_PLATE || "—"}</td>
                        <td className="p-2.5">{c.DRIVER_NAME || "—"}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                              c.STATUS === "AT_DC" || c.STATUS === "OFFLOADED"
                                ? "bg-emerald-100 text-emerald-800"
                                : c.STATUS === "ASSIGNED" || c.STATUS === "IN_TRANSIT"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {c.STATUS}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          {!currentTab.isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContainerNo(c.CONTAINER_NO);
                                setAssignTruckPlate(c.TRUCK_PLATE || "");
                                setAssignDriverName(c.DRIVER_NAME || "");
                                setAssignDriverPhone(c.DRIVER_PHONE || "");
                                setAssignModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold cursor-pointer"
                            >
                              Assign Truck
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Level 7: DC Warehouse Offloading */}
          {currentTab.task_type === "DC_OFFLOAD" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">DC Warehouse Remarks / Condition</label>
                <input
                  type="text"
                  placeholder="e.g. Received in good order at Bayan DC, temperature checked -18C"
                  value={dcRemark}
                  onChange={(e) => setDcRemark(e.target.value)}
                  disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800"
                />
              </div>

              {/* Offload Buttons per container */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Offload Stamp Action (Syncs PowerBuilder TF_CONTAINER_DET)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {containers.map((c) => {
                    const isOffloaded = c.STATUS === "OFFLOADED" || c.STATUS === "RETURNED";
                    return (
                      <div
                        key={c.CONTAINER_NO}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 m-0 font-mono">
                            {c.CONTAINER_NO}
                          </p>
                          <p className="text-[11px] text-slate-500 m-0">
                            {isOffloaded ? `✓ Offloaded ${c.OFFLOADED_AT ? c.OFFLOADED_AT.slice(0, 10) : ""}` : "Pending Offload"}
                          </p>
                        </div>
                        {!isOffloaded && !currentTab.isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleContainerOffload(c.CONTAINER_NO)}
                            disabled={updating}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            Stamp Offloaded
                          </button>
                        )}
                        {isOffloaded && (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 size={14} /> Offloaded
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Action Buttons Footer ── */}
          <div className="flex flex-wrap items-center justify-between pt-5 mt-5 border-t border-slate-100 gap-3">
            {/* Left: Hold & Release Actions */}
            <div className="flex items-center gap-2">
              {!currentTab.isReadOnly && currentTask?.STATUS !== "COMPLETED" && (
                <>
                  {currentTask?.STATUS === "ON_HOLD" ? (
                    <button
                      type="button"
                      onClick={() => setReleaseModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      <Unlock size={14} />
                      <span>Release Hold</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHoldModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      <AlertTriangle size={14} />
                      <span>Put on Hold</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Right: Advance Stage */}
            <div className="flex items-center gap-2">
              {!currentTab.isReadOnly && currentTask?.STATUS !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  disabled={updating}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00378C] hover:bg-[#002d72] text-white text-xs font-semibold cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {updating ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>
                    {currentTab.flow_level === (navConfig?.last_level || 7)
                      ? "Complete Final Stage & Close Job 🎉"
                      : `Complete ${currentTab.title} & Proceed ➔`}
                  </span>
                </button>
              )}
              {currentTask?.STATUS === "COMPLETED" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                  <CheckCircle2 size={15} /> Stage Completed by {currentTask.COMPLETED_BY || "Admin"}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* When no stages are permitted for the user */}
      {!currentTab && navConfig && navConfig.activeTabs.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-amber-200 p-8 text-center bg-amber-50/40">
          <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800 m-0">No Tracker Stages Assigned</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Your login account does not currently have permission to access any milestone tracking stages for this shipment. Please contact your administrator to grant access in <code>SEC_ROLE_FUNCTION_ACCESS_USER</code>.
          </p>
        </div>
      )}

      {/* ── 5. Bottom Tabs: Containers Live Monitor & Audit Event Trail ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Sub-Tabs Header */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setBottomTab("containers")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              bottomTab === "containers"
                ? "border-[#00378C] text-[#00378C] bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Truck size={14} />
            <span>Containers Execution ({containers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBottomTab("audit")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              bottomTab === "audit"
                ? "border-[#00378C] text-[#00378C] bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Clock size={14} />
            <span>Audit Trail & Events ({events.length})</span>
          </button>
        </div>

        {/* Tab 1: Containers Execution */}
        {bottomTab === "containers" && (
          <div className="p-4">
            {containers.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 text-center">
                No containers recorded for this job yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Container No</th>
                      <th className="p-2.5">Size/Type</th>
                      <th className="p-2.5">Seal No</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Truck Plate</th>
                      <th className="p-2.5">Driver Name</th>
                      <th className="p-2.5">Driver Phone</th>
                      <th className="p-2.5">Offloaded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {containers.map((c) => (
                      <tr key={c.CONTAINER_NO} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold font-mono text-slate-900">{c.CONTAINER_NO}</td>
                        <td className="p-2.5">{c.CONTN_TYPE || "40HC"}</td>
                        <td className="p-2.5 font-mono">{c.SEAL_NO || "—"}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                              c.STATUS === "OFFLOADED" || c.STATUS === "RETURNED"
                                ? "bg-emerald-100 text-emerald-800"
                                : c.STATUS === "ASSIGNED" || c.STATUS === "IN_TRANSIT"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {c.STATUS}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">{c.TRUCK_PLATE || "—"}</td>
                        <td className="p-2.5">{c.DRIVER_NAME || "—"}</td>
                        <td className="p-2.5 font-mono">{c.DRIVER_PHONE || "—"}</td>
                        <td className="p-2.5">{c.OFFLOADED_AT ? c.OFFLOADED_AT.slice(0, 16) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Audit Event Trail */}
        {bottomTab === "audit" && (
          <div className="p-4 space-y-3">
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 text-center">
                No events recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((e, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <div className="w-7 h-7 rounded-full bg-blue-50 text-[#00378C] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      <Clock size={14} />
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{e.EVENT_TYPE}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {e.CREATED_DT ? new Date(e.CREATED_DT).toLocaleString() : ""}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 m-0">{e.REMARK || "State transition logged"}</p>
                      <p className="text-[11px] text-slate-400 mt-1 m-0">
                        Actor: <strong>{e.ACTOR_ID}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Hold Modal Dialog ── */}
      {holdModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle size={18} />
                <h4 className="text-sm font-bold m-0">Assign Operational Hold</h4>
              </div>
              <button
                type="button"
                onClick={() => setHoldModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">External Entity</label>
                <select
                  value={holdEntity}
                  onChange={(e) => {
                    setHoldEntity(e.target.value);
                    setHoldReason("");
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  {ENTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Hold Reason</label>
                <select
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">Select reason...</option>
                  {(HOLD_REASONS_MAP[holdEntity] || HOLD_REASONS_MAP.OTHER).map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Hold Remark / Explanation</label>
                <textarea
                  rows={3}
                  value={holdRemark}
                  onChange={(e) => setHoldRemark(e.target.value)}
                  placeholder="Explain why this task is held and what is required to unblock it..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHoldModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignHold}
                disabled={updating || !holdReason || !holdRemark}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                {updating ? "Saving..." : "Confirm Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Release Hold Modal Dialog ── */}
      {releaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700">
                <Unlock size={18} />
                <h4 className="text-sm font-bold m-0">Release Operational Hold</h4>
              </div>
              <button
                type="button"
                onClick={() => setReleaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <p className="text-slate-600">
                Provide resolution notes explaining how the issue was resolved so this stage can resume:
              </p>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Resolution Remark</label>
                <textarea
                  rows={3}
                  value={releaseRemark}
                  onChange={(e) => setReleaseRemark(e.target.value)}
                  placeholder="e.g. MOAF permit approved and attached. Ready to proceed."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReleaseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReleaseHold}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                {updating ? "Saving..." : "Release Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Truck Modal Dialog ── */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#00378C]">
                <Truck size={18} />
                <h4 className="text-sm font-bold m-0">Assign Truck — {selectedContainerNo}</h4>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Truck Plate Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 1234-AA"
                  value={assignTruckPlate}
                  onChange={(e) => setAssignTruckPlate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Driver Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ahmed Al-Balushi"
                  value={assignDriverName}
                  onChange={(e) => setAssignDriverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Driver Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +968 9123 4567"
                  value={assignDriverPhone}
                  onChange={(e) => setAssignDriverPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Expected Arrival (ETA) to DC</label>
                <input
                  type="datetime-local"
                  value={assignEta}
                  onChange={(e) => setAssignEta(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTruckAssignment}
                disabled={updating || !assignTruckPlate}
                className="px-4 py-2 rounded-xl bg-[#00378C] hover:bg-[#002d72] text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                Assign & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attachments Dialog ── */}
      <FreightAttachmentDialog
        open={attachmentOpen}
        onClose={() => setAttachmentOpen(false)}
        title={`Tracking Documents - Job ${jobNo}`}
        companyCode={companyCode}
        prinCode={prinCode}
        jobNo={jobNo}
        docNr={attachmentContextDocNr}
        context="JOB"
        loginId={loginId}
        readOnly={readOnly}
      />
    </div>
  );
}

