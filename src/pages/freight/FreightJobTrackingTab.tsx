import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  Layers,
  Lock,
  Mail,
  PackageCheck,
  Paperclip,
  Plane,
  Plus,
  RefreshCw,
  Send,
  Settings,
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
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";
import { FreightAttachmentDialog } from "./FreightAttachmentDialog";
import { FreightTrackerSettingsDialog } from "./FreightTrackerSettingsDialog";
import { FreightDatePicker, FreightDateTimePicker } from "../../components/freight/FreightDatePicker";

// ── Date Formatting Helpers (ERP Standard DD/MM/YYYY) ────────────────────────

function normalizeDateValue(value?: string | null): string {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str.slice(0, 10);
}

function formatTrackingDate(val?: string | null): string {
  if (!val) return "—";
  const str = String(val).trim();
  if (!str || str === "—") return "—";
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return `${match[3].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[1]}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  return str.slice(0, 10);
}

function formatTrackingDateTime(val?: string | null): string {
  if (!val) return "—";
  const str = String(val).trim();
  if (!str || str === "—") return "—";
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
  if (match) {
    const d = match[3].padStart(2, "0");
    const m = match[2].padStart(2, "0");
    const y = match[1];
    const time = match[4] ? ` ${match[4].padStart(2, "0")}:${match[5].padStart(2, "0")}` : "";
    return `${d}/${m}/${y}${time}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return str.slice(0, 16);
}

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
  BL_NUMBER?: string | null;
  DOC_REF?: string | null;
  INVOICE_NUMBER?: string | null;
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
  CONTAINER_NO?: string;
  CONTAINER_NUMBER?: string;
  CONTN_TYPE?: string | null;
  CONTAINER_TYPE?: string | null;
  SEAL_NO?: string | null;
  STATUS: "PENDING" | "ASSIGNED" | "IN_TRANSIT" | "BREAKDOWN" | "AT_DC" | "OFFLOADED" | "RETURNED";
  TRUCK_PLATE?: string | null;
  TRUCK_PLATE_NUMBER?: string | null;
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
  const [bottomTab, setBottomTab] = useState<"containers" | "audit" | "docs">("containers");
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
  const [jobDocs, setJobDocs] = useState<LookupRow[]>([]);
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
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState("");
  const [pdfModalTitle, setPdfModalTitle] = useState("");

  const openDocViewer = (title: string, rawUrl: string) => {
    let finalUrl = (rawUrl || "").trim();
    if (finalUrl && !finalUrl.startsWith("http://") && !finalUrl.startsWith("https://") && !finalUrl.startsWith("blob:")) {
      const cleanPath = finalUrl.startsWith("/") ? finalUrl : "/" + finalUrl;
      finalUrl = "http://localhost:3500" + cleanPath;
    }
    setPdfModalTitle(title);
    setPdfModalUrl(finalUrl);
    setPdfModalOpen(true);
  };
  const [attachmentContextDocNr, setAttachmentContextDocNr] = useState("");

  // Mail & Admin Settings Dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Stage-Gated Document Verification Modal
  const [docWarningModalOpen, setDocWarningModalOpen] = useState(false);
  const [missingDocNotice, setMissingDocNotice] = useState<{ docName: string; docCode: string } | null>(null);

  // Assign Truck Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedContainerNo, setSelectedContainerNo] = useState("");
  const [assignTruckPlate, setAssignTruckPlate] = useState("");
  const [assignDriverName, setAssignDriverName] = useState("");
  const [assignDriverPhone, setAssignDriverPhone] = useState("");
  const [assignEta, setAssignEta] = useState("");

  // Copy helper
  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // ── Load User Nav, Tracking & Job Documents ────────────────────────────────

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
          setPlannedPullOut(normalizeDateValue(hdr.PLANNED_PULL_OUT));
          setPermitRef(hdr.PERMIT_REF || "");
          setPermitNotRequired(hdr.PERMIT_NOT_REQUIRED === "Y");
          setBayanNo(hdr.BAYAN_NO || "");
          setBayanDate(normalizeDateValue(hdr.BAYAN_DATE));
          setCustomsStatus(hdr.CUSTOMS_RELEASE_STATUS || "PENDING");
          setDoValidityDate(normalizeDateValue(hdr.DO_VALIDITY_DATE));
          setDcRemark(hdr.DC_REMARK || "");

          // Default active level to current pending level if available
          if (hdr.CURRENT_LEVEL) {
            setActiveLevel(hdr.CURRENT_LEVEL);
          }
        }
      }

      // 3. Fetch Job Documents Checklist
      try {
        const docsRes = await api.post<{ success?: boolean; data?: LookupRow[] }>("/api/freight/job-documents/list", {
          company_code: companyCode,
          prin_code: prinCode,
          job_no: jobNo,
        });
        if (docsRes.data?.data) {
          setJobDocs(docsRes.data.data);
        }
      } catch {
        // Non-blocking document lookup
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

  const handleCompleteTask = async (forceBypass?: boolean | unknown) => {
    const bypass = forceBypass === true;
    if (!currentTab) return;

    // Stage-Gated Document Compliance Check (Enterprise Freight ERP Standard)
    if (!bypass) {
      if (currentTab.task_type === "PRO_PERMITS" && !permitNotRequired) {
        const hasPermitDoc = standardDocs.some(d => d.code === "PRM" && d.collected);
        if (!hasPermitDoc && !permitRef) {
          setMissingDocNotice({ docName: "Ministry Import Permit Certificate", docCode: "PRM" });
          setDocWarningModalOpen(true);
          return;
        }
      } else if (currentTab.task_type === "CUSTOMS_BAYAN") {
        const hasBayanDoc = standardDocs.some(d => d.code === "BYN" && d.collected);
        if (!hasBayanDoc && !bayanNo) {
          setMissingDocNotice({ docName: "Customs Bayan Declaration Entry", docCode: "BYN" });
          setDocWarningModalOpen(true);
          return;
        }
      } else if (currentTab.task_type === "SHIPPING_LINE_DO") {
        const hasDoDoc = standardDocs.some(d => d.code === "DO" && d.collected);
        if (!hasDoDoc && !doValidityDate) {
          setMissingDocNotice({ docName: "Original Shipping Line Delivery Order (DO)", docCode: "DO" });
          setDocWarningModalOpen(true);
          return;
        }
      } else if (currentTab.task_type === "CCRO") {
        const hasCcroDoc = standardDocs.some(d => d.code === "CCRO" && d.collected);
        if (!hasCcroDoc && containers.length > 0) {
          setMissingDocNotice({ docName: "Port Police / CCRO Gate Pass", docCode: "CCRO" });
          setDocWarningModalOpen(true);
          return;
        }
      }
    }

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
      const res = await api.post<{ success: boolean; message: string }>("/api/freight/tracker/dc/container-update", {
        company_code: companyCode,
        prin_code: prinCode,
        job_no: jobNo,
        container_no: selectedContainerNo,
        status: "PULLED_OUT",
        truck_plate: assignTruckPlate,
        driver_name: assignDriverName,
        driver_phone: assignDriverPhone,
        expected_arrival: assignEta || undefined,
        user_id: loginId,
      });

      if (res.data?.success) {
        toast.success(`Truck ${assignTruckPlate} assigned to container ${selectedContainerNo}`);
        setAssignModalOpen(false);
        await loadTracker();
      } else {
        toast.error(res.data?.message || "Failed to assign truck");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to assign truck");
    } finally {
      setUpdating(false);
    }
  };

  // ── DO Validity Calculations ───────────────────────────────────────────────

  const doValidityDays = useMemo(() => {
    const raw = doValidityDate || header?.DO_VALIDITY_DATE;
    if (!raw) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const doDate = new Date(raw);
    if (isNaN(doDate.getTime())) return null;
    doDate.setHours(0, 0, 0, 0);
    const diffTime = doDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [doValidityDate, header?.DO_VALIDITY_DATE]);

  // Standard Documents list for checklist
  const standardDocs = useMemo(() => {
    const defaultList = [
      { code: "CI", name: "Commercial Invoice", mandatory: true },
      { code: "PL", name: "Packing List", mandatory: true },
      { code: "BL", name: "Bill of Lading / Transfer Document", mandatory: true },
      { code: "COO", name: "Certificate of Origin", mandatory: false },
      { code: "PRM", name: "Ministry Import Permit", mandatory: !isDry },
      { code: "BYN", name: "Customs Bayan Declaration", mandatory: true },
      { code: "DO", name: "Delivery Order (DO)", mandatory: true },
      { code: "CCRO", name: "Port Police / CCRO Pass", mandatory: true },
      { code: "DCR", name: "DC Receiving Inspection", mandatory: true },
    ];

    return defaultList.map((doc) => {
      const match = jobDocs.find((jd) => {
        const nr = String(jd.DOC_NR || jd.DOC_CODE || jd.doc_code || jd.doc_nr || "").toUpperCase();
        const type = String(jd.DOCUMENT_TYPE || jd.DOC_DESC || jd.DOC_NAME || jd.doc_name || "").toUpperCase();
        if (doc.code === "BL" && (nr === "BL" || nr === "DOC01" || type.includes("SOURCE") || type.includes("TRANSFER") || type.includes("BILL") || type.includes("LADING"))) {
          return true;
        }
        if (doc.code === "BYN" && (nr === "BYN" || type.includes("BAYAN") || type.includes("CUSTOMS"))) return true;
        if (doc.code === "DO" && (nr === "DO" || type.includes("DELIVERY ORDER"))) return true;
        if (doc.code === "PRM" && (nr === "PRM" || type.includes("PERMIT") || type.includes("MINISTRY"))) return true;
        if (doc.code === "CCRO" && (nr === "CCRO" || type.includes("CCRO") || type.includes("POLICE"))) return true;
        if (nr === doc.code || type.includes(doc.code)) return true;
        return false;
      });

      const docPath = match ? String(match.DOC_PATH || match.doc_path || match.AWS_FILE_LOCN || match.aws_file_locn || "") : "";
      const isCollected = match ? (String(match.COLLECTED || match.collected || "") === "Y" || Boolean(docPath)) : false;

      return {
        ...doc,
        collected: isCollected,
        ref: match ? String(match.REMARKS || match.remarks || match.DOC_REF || match.doc_ref || "") : "",
        path: docPath,
      };
    });
  }, [jobDocs, isDry]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!jobNo) {
    return (
      <div className="flex flex-col items-center justify-center p-14 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#00378C] flex items-center justify-center mb-3">
          <PackageCheck size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Shipment Selected</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Select or open a freight shipment file to view its live 7-level milestone tracker, container dispatch, and audit trail.
        </p>
      </div>
    );
  }

  // Tracking not yet initialized
  if (!loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-14 text-center bg-white rounded-3xl border border-blue-200 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-blue-100/50 rounded-full blur-2xl pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl bg-[#00378C]/10 text-[#00378C] flex items-center justify-center mb-4 ring-8 ring-blue-50">
          <Sparkles size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Live Tracking Ready to Initialize</h3>
        <p className="text-sm text-slate-600 max-w-md mt-2 leading-relaxed">
          Job <strong>{jobNo}</strong> is ready for operational tracking. Launching tracking will activate all 7 levels according to your company workflow rules and send notifications to team CCs.
        </p>
        <button
          type="button"
          onClick={handleInitTracking}
          disabled={initializing}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00378C] to-blue-700 hover:from-[#002d72] hover:to-blue-800 text-white text-sm font-semibold shadow-md shadow-blue-900/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {initializing ? <RefreshCw size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
          <span>{initializing ? "Spawning 7-Level Tracking..." : "🚀 Initialize Live Milestones & Tracking"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="freight-workspace-ui space-y-4">
      {/* ── 1. Executive Master Header Card ── */}
      <div className="bg-gradient-to-r from-slate-900 via-[#071d49] to-[#00378C] text-white rounded-2xl p-5 shadow-lg border border-blue-950/40 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-16 -top-16 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-16 w-56 h-56 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Job Identity Cluster */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-cyan-300 ring-1 ring-white/20 flex items-center justify-center shrink-0 shadow-inner">
                {header?.TRANSPORT_MODE === "A" ? (
                  <Plane size={24} />
                ) : header?.TRANSPORT_MODE === "S" ? (
                  <Ship size={24} />
                ) : (
                  <Truck size={24} />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-white m-0">
                    {jobNo}
                  </h2>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(jobNo, "Job No")}
                    title="Copy Job Number"
                    className="p-1 rounded-md hover:bg-white/15 text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    {copiedField === "Job No" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>

                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-white/20 text-white backdrop-blur-xs">
                    {header?.JOB_TYPE === "IMP"
                      ? "Import"
                      : header?.JOB_TYPE === "EXP"
                      ? "Export"
                      : "CFS Transfer"}
                  </span>

                  {header?.IS_DRY === "Y" && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-slate-800/80 text-slate-200 border border-slate-700">
                      Dry Cargo
                    </span>
                  )}

                  {header?.IS_IMPORTANT === "Y" && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950 shadow-xs animate-pulse">
                      ★ VIP High Priority
                    </span>
                  )}
                </div>

                {/* Route & Customer Strip */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">Route:</span>
                    <span className="font-mono text-cyan-200">{header?.PORT_CODE || "ORIGIN"}</span>
                    <div className="flex items-center gap-1 text-slate-400 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span className="text-[10px]">➔</span>
                    </div>
                    <span className="font-mono text-cyan-200">
                      {header?.DESTINATION_PORT || header?.DELIVERY_PLACE || "DESTINATION"}
                    </span>
                  </div>

                  {header?.DOC_REF && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">B/L:</span>
                      <span className="font-mono text-white font-medium">{header.DOC_REF}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(header.DOC_REF || "", "B/L Reference")}
                        className="p-0.5 hover:text-white text-slate-400 cursor-pointer"
                        title="Copy B/L Number"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Customer:</span>
                    <span className="text-white font-medium truncate max-w-xs">
                      {header?.CUST_NAME || header?.PRIN_NAME || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Progress & Status Badges */}
            <div className="flex flex-wrap items-center gap-3">
              {/* DO Countdown Pill */}
              {doValidityDays !== null && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold backdrop-blur-md shadow-xs ${
                    doValidityDays < 0
                      ? "bg-rose-500/25 text-rose-200 border-rose-400/50 animate-pulse"
                      : doValidityDays <= 3
                      ? "bg-amber-500/25 text-amber-200 border-amber-400/50 animate-pulse"
                      : "bg-emerald-500/25 text-emerald-200 border-emerald-400/50"
                  }`}
                >
                  <Clock size={14} />
                  <span>
                    DO:{" "}
                    {doValidityDays < 0
                      ? `${Math.abs(doValidityDays)}d Overdue`
                      : doValidityDays === 0
                      ? "Expires Today!"
                      : `${doValidityDays}d Remaining`}
                  </span>
                </div>
              )}

              {/* Overall Status Badge */}
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider backdrop-blur-md ${
                  header?.OVERALL_STATUS === "COMPLETED"
                    ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/50"
                    : header?.OVERALL_STATUS === "ON_HOLD"
                    ? "bg-amber-500/30 text-amber-200 border border-amber-400/50"
                    : "bg-blue-500/30 text-cyan-200 border border-cyan-400/40"
                }`}
              >
                {header?.OVERALL_STATUS || "IN_PROGRESS"}
              </span>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/15">
                <button
                  type="button"
                  onClick={loadTracker}
                  disabled={loading}
                  title="Refresh tracking data"
                  className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/15 transition cursor-pointer"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  title="Mail & Alert Admin Settings (Team CCs & Daily Digest)"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/15 transition cursor-pointer"
                >
                  <Settings size={14} />
                  <span className="hidden sm:inline">Mail Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAttachmentContextDocNr("");
                    setAttachmentOpen(true);
                  }}
                  title="Attach or inspect shipment files"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                >
                  <Paperclip size={14} />
                  <span>Docs ({jobDocs.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Linear Progress Bar */}
          <div className="mt-4 pt-3.5 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Milestone Progress:</span>
                <strong className="text-white">{stats.completedTasks} of {stats.totalTasks} Stages Completed</strong>
              </span>
              <span className="font-mono font-bold text-cyan-300">{stats.progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-black/30 overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 transition-all duration-700 shadow-sm shadow-cyan-500/50"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Hold Alert Banner (Visible when any task is ON_HOLD) ── */}
      {activeHoldTask && (
        <div className="bg-amber-50/95 border border-amber-300/80 rounded-2xl p-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950 m-0">
                  ⚠️ Shipment Blocked at Stage: {activeHoldTask.TASK_TYPE}
                </h4>
                <p className="text-xs text-amber-800 mt-1 m-0">
                  <strong>Held By:</strong> {activeHoldTask.HOLD_ENTITY || "External Entity"} &bull;{" "}
                  <strong>Reason:</strong> {activeHoldTask.HOLD_REASON || "Operational Review"}
                </p>
                {activeHoldTask.HOLD_REMARK && (
                  <p className="text-xs text-amber-900 mt-1.5 bg-amber-100/70 rounded-xl p-2.5 border border-amber-200/70 font-mono">
                    "{activeHoldTask.HOLD_REMARK}"
                  </p>
                )}
              </div>
            </div>

            {/* Release Action */}
            <button
              type="button"
              onClick={() => setReleaseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition"
            >
              <Unlock size={14} />
              <span>Release Hold</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Connected Horizontal Stepper Ribbon ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {(navConfig?.activeTabs || []).map((tab, idx) => {
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
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  isCurrent
                    ? "bg-blue-50/50 border-[#00378C] shadow-md ring-2 ring-[#00378C]/20"
                    : isDone
                    ? "bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70"
                    : isOnHold
                    ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70"
                    : "bg-white border-slate-200 hover:bg-slate-50/80"
                }`}
              >
                {/* Level Marker & Status Icon */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-2xs ${
                      isDone
                        ? "bg-emerald-600 text-white"
                        : isOnHold
                        ? "bg-amber-500 text-white"
                        : isCurrent
                        ? "bg-[#00378C] text-white ring-2 ring-blue-300"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isDone ? <Check size={13} strokeWidth={3} /> : isOnHold ? "!" : tab.flow_level}
                  </span>

                  <div className="flex items-center gap-1">
                    {tab.isReadOnly && (
                      <span title="Read-only access for your role">
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

                {/* Title & Subtitle */}
                <p
                  className={`text-xs font-bold truncate m-0 leading-tight ${
                    isCurrent ? "text-[#00378C]" : "text-slate-800"
                  }`}
                >
                  {tab.title}
                </p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5 m-0 font-medium">
                  {tab.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. Main 2-Column Workbench: Active Stage Form + Document Checklist Tray ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Active Stage Workbench */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {currentTab && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 transition-all">
              {/* Workbench Header */}
              <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#00378C]/10 text-[#00378C] text-[11px] font-bold">
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
                    <span className="text-slate-800 font-semibold">{currentTab.assignedRole || "Operational Team"}</span>
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
                    <span>Stage Docs</span>
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
                      value={header?.BL_NUMBER || header?.DOC_REF || ""}
                      disabled
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Planned Pull-out Date</label>
                    <FreightDatePicker
                      className="freight-calendar-field"
                      value={plannedPullOut}
                      onChange={(val) => setPlannedPullOut(val)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Cargo Classification</label>
                    <button
                      type="button"
                      onClick={() => !currentTab.isReadOnly && currentTask?.STATUS !== "COMPLETED" && setIsDry(!isDry)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border transition text-left cursor-pointer ${
                        isDry
                          ? "bg-amber-50/70 border-amber-300 text-amber-900"
                          : "bg-blue-50/50 border-blue-200 text-blue-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isDry ? "bg-amber-500" : "bg-blue-500"}`} />
                        <span className="text-xs font-semibold">{isDry ? "Dry General Cargo" : "Reefer / Foodstuffs"}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200">
                        {isDry ? "No Permits" : "Permits Req"}
                      </span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Priority Level</label>
                    <button
                      type="button"
                      onClick={() => !currentTab.isReadOnly && currentTask?.STATUS !== "COMPLETED" && setIsImportant(!isImportant)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border transition text-left cursor-pointer ${
                        isImportant
                          ? "bg-rose-50 border-rose-300 text-rose-800"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isImportant ? "bg-rose-600 animate-pulse" : "bg-slate-400"}`} />
                        <span className="text-xs font-semibold">{isImportant ? "★ VIP / High Priority" : "Standard Priority"}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200">
                        {isImportant ? "FAST-TRACK" : "NORMAL"}
                      </span>
                    </button>
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
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-mono"
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
                    <label className="text-xs font-semibold text-slate-700">Ministry Health Inspection</label>
                    <div className="flex items-center gap-2 pt-1.5">
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
                    <FreightDatePicker
                      className="freight-calendar-field"
                      value={bayanDate}
                      onChange={(val) => setBayanDate(val)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Customs Duty Release Status</label>
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
                    <FreightDatePicker
                      className="freight-calendar-field"
                      value={doValidityDate}
                      onChange={(val) => setDoValidityDate(val)}
                      disabled={currentTab.isReadOnly || currentTask?.STATUS === "COMPLETED"}
                      required
                      placeholder="DD/MM/YYYY"
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
                    <div className="flex items-center gap-2 pt-1.5">
                      <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        ✓ Seals Inspected & Passed
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Gate Pass Stamped</label>
                    <div className="flex items-center gap-2 pt-1.5">
                      <span className="text-xs px-3 py-1.5 rounded-xl bg-blue-50 text-[#00378C] border border-blue-200 font-semibold">
                        ✓ Customs Gate Pass Approved
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Containers Ready for Dispatch</label>
                    <div className="pt-1.5">
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

                  <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
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
                        {containers.map((c, idx) => {
                      const containerNo = c.CONTAINER_NO || c.CONTAINER_NUMBER || "—";
                      const truckPlate = c.TRUCK_PLATE || c.TRUCK_PLATE_NUMBER || "—";
                      const sizeType = c.CONTN_TYPE || c.CONTAINER_TYPE || "40HC";
                      const sealNo = c.SEAL_NO || "—";
                      return (
                        <tr key={containerNo + idx} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-mono font-bold text-slate-900 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-600" />
                              <span>{containerNo}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[11px] font-semibold">
                              {sizeType}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600 text-xs">{sealNo}</td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                                c.STATUS === "OFFLOADED" || c.STATUS === "RETURNED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.STATUS === "ASSIGNED" || c.STATUS === "IN_TRANSIT"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {c.STATUS || "PENDING"}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800 text-xs">{truckPlate}</td>
                          <td className="p-3 text-slate-700 text-xs">{c.DRIVER_NAME || "—"}</td>
                          <td className="p-3 font-mono text-slate-600 text-xs">{c.DRIVER_PHONE || "—"}</td>
                          <td className="p-3 text-slate-500 text-xs">{formatTrackingDateTime(c.OFFLOADED_AT)}</td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContainerNo(containerNo);
                                setAssignTruckPlate(truckPlate === "—" ? "" : truckPlate);
                                setAssignDriverName(c.DRIVER_NAME || "");
                                setAssignDriverPhone(c.DRIVER_PHONE || "");
                                setAssignModalOpen(true);
                              }}
                              className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#00378C] text-[11px] font-semibold cursor-pointer transition border border-blue-200 shadow-2xs"
                            >
                              Update Truck
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
                      placeholder="e.g. Received in good order at Bayan DC, seal inspected, temperature checked -18C"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {containers.map((c) => {
                        const isOffloaded = c.STATUS === "OFFLOADED" || c.STATUS === "RETURNED";
                        return (
                          <div
                            key={c.CONTAINER_NO}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 shadow-2xs"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900 m-0 font-mono">
                                {c.CONTAINER_NO}
                              </p>
                              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                                {isOffloaded
                                  ? `✓ Offloaded ${formatTrackingDate(c.OFFLOADED_AT)}`
                                  : "Pending Offload"}
                              </p>
                            </div>
                            {!isOffloaded && !currentTab.isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleContainerOffload(c.CONTAINER_NO || c.CONTAINER_NUMBER || "")}
                                disabled={updating}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition"
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
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition"
                        >
                          <Unlock size={14} />
                          <span>Release Hold</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setHoldModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer shadow-xs transition"
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
                      onClick={() => void handleCompleteTask(false)}
                      disabled={updating}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00378C] to-blue-700 hover:from-[#002d72] hover:to-blue-800 text-white text-xs font-bold cursor-pointer shadow-sm disabled:opacity-50 transition"
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
                Your login account does not currently have permission to access milestone tracking stages for this shipment. Please contact your administrator to grant access in <code>SEC_ROLE_FUNCTION_ACCESS_USER</code>.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Embedded Document Checklist Tray */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800">
                <FileCheck size={16} className="text-[#00378C]" />
                <h4 className="text-xs font-bold uppercase tracking-wider m-0">Documents Checklist</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttachmentContextDocNr("");
                  setAttachmentOpen(true);
                }}
                className="text-[11px] font-semibold text-[#00378C] hover:underline cursor-pointer"
              >
                + Upload
              </button>
            </div>

            <p className="text-[11px] text-slate-500 m-0 leading-tight">
              Standard import/export documents and clearance certificates required for this job:
            </p>

            <div className="space-y-2">
              {standardDocs.map((doc) => (
                <div
                  key={doc.code}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition border text-xs ${
                    doc.collected
                      ? "bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50"
                      : "bg-white border-slate-200/80 hover:border-blue-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs shadow-2xs ${
                        doc.collected
                          ? "bg-emerald-600 text-white font-bold"
                          : "border border-slate-300 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {doc.collected ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`truncate text-xs ${doc.collected ? "text-slate-900 font-bold" : "text-slate-700 font-semibold"}`}>
                          {doc.name}
                        </span>
                        {doc.mandatory && !doc.collected && (
                          <span className="text-[9px] font-extrabold uppercase text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded shrink-0">
                            Required
                          </span>
                        )}
                      </div>
                      {doc.ref && (
                        <p className="text-[10px] font-mono text-slate-500 m-0 truncate">Ref: {doc.ref}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.collected && doc.path ? (
                      <button
                        type="button"
                        onClick={() => openDocViewer(doc.name, doc.path)}
                        title="View / Preview PDF document"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold cursor-pointer transition shadow-2xs"
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachmentContextDocNr(doc.code);
                          setAttachmentOpen(true);
                        }}
                        title="Upload document"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#00378C] text-[11px] font-semibold cursor-pointer transition border border-blue-200"
                      >
                        <Paperclip size={12} />
                        <span>Upload</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}</div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                {standardDocs.filter((d) => d.collected).length} of {standardDocs.length} Collected
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttachmentContextDocNr("");
                  setAttachmentOpen(true);
                }}
                className="text-[11px] font-bold text-[#00378C] hover:underline cursor-pointer"
              >
                Open Full Hub ➔
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Bottom Tabs: Containers Live Monitor, Audit Event Trail & Documents ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
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
            <span>Containers Fleet Matrix ({containers.length})</span>
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
            <span>Audit Trail & Event Timeline ({events.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setBottomTab("docs")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              bottomTab === "docs"
                ? "border-[#00378C] text-[#00378C] bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText size={14} />
            <span>Attached Shipment Docs ({jobDocs.length})</span>
          </button>
        </div>

        {/* Tab 1: Containers Fleet Matrix */}
        {bottomTab === "containers" && (
          <div className="p-4">
            {containers.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-6 text-center">
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
                      <th className="p-2.5 text-right">Actions</th>
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
                        <td className="p-2.5 font-mono font-semibold">{c.TRUCK_PLATE || c.TRUCK_PLATE_NUMBER || "—"}</td>
                        <td className="p-2.5">{c.DRIVER_NAME || "—"}</td>
                        <td className="p-2.5 font-mono">{c.DRIVER_PHONE || "—"}</td>
                        <td className="p-2.5">{formatTrackingDateTime(c.OFFLOADED_AT)}</td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedContainerNo(c.CONTAINER_NO || c.CONTAINER_NUMBER || "");
                              setAssignTruckPlate(c.TRUCK_PLATE || c.TRUCK_PLATE_NUMBER || "");
                              setAssignDriverName(c.DRIVER_NAME || "");
                              setAssignDriverPhone(c.DRIVER_PHONE || "");
                              setAssignModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer transition"
                          >
                            Update Truck
                          </button>
                        </td>
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
          <div className="p-5 space-y-3">
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-6 text-center">
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
                          {formatTrackingDateTime(e.CREATED_DT)}
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

        {/* Tab 3: Attached Shipment Docs */}
        {bottomTab === "docs" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-700 m-0">
                Official Documents & Uploaded Certificates
              </p>
              <button
                type="button"
                onClick={() => {
                  setAttachmentContextDocNr("");
                  setAttachmentOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#00378C] text-white text-xs font-semibold hover:bg-[#002d72] cursor-pointer transition shadow-2xs"
              >
                + Upload / Attach File
              </button>
            </div>

            {jobDocs.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-6 text-center">
                No documents found for this job. Use the upload button above to attach files.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Document Title</th>
                      <th className="p-2.5">Reference No</th>
                      <th className="p-2.5">Mandatory</th>
                      <th className="p-2.5">Collected</th>
                      <th className="p-2.5">Received Date</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {jobDocs.map((doc, idx) => {
                      const docCode = String(doc.DOC_NR || doc.DOC_CODE || doc.doc_code || doc.doc_nr || "—");
                      const docTitle = String(doc.DOCUMENT_TYPE || doc.DOC_DESC || doc.DOC_NAME || doc.doc_name || "Shipment Document");
                      const docPath = String(doc.DOC_PATH || doc.doc_path || doc.AWS_FILE_LOCN || doc.aws_file_locn || "");
                      const isCollected = String(doc.COLLECTED || doc.collected || "") === "Y" || Boolean(docPath);
                      const rawRecv = doc.DOC_RECEIVED_DT || doc.RECEIVE_DATE || doc.receive_date;
                      const recvDate = rawRecv ? formatTrackingDate(String(rawRecv)) : "—";
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-bold font-mono text-[#00378C] text-xs">{docCode}</td>
                          <td className="p-3 font-semibold text-slate-800 text-xs">{docTitle}</td>
                          <td className="p-3 font-mono text-slate-600 text-xs truncate max-w-xs">{String(doc.REMARKS || doc.remarks || doc.DOC_REF || "—")}</td>
                          <td className="p-3">
                            {String(doc.MANDATORY || doc.mandatory || "") === "Y" ? (
                              <span className="text-rose-600 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded text-[10px]">Yes</span>
                            ) : (
                              <span className="text-slate-400 text-xs">Optional</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isCollected ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10.5px]">✓ Collected</span>
                            ) : (
                              <span className="text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10.5px]">Pending</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 text-xs">{recvDate}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {docPath ? (
                                <button
                                  type="button"
                                  onClick={() => openDocViewer(docTitle, docPath)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold cursor-pointer transition border border-emerald-200 flex items-center gap-1 shadow-2xs"
                                >
                                  <Eye size={12} />
                                  <span>Preview</span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setAttachmentContextDocNr(docCode === "—" ? "" : docCode);
                                  setAttachmentOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#00378C] text-[11px] font-semibold cursor-pointer transition border border-blue-200 flex items-center gap-1"
                              >
                                <Paperclip size={12} />
                                <span>{docPath ? "Re-upload" : "Attach"}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Hold Modal Dialog ── */}
      {holdModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
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
                <FreightDateTimePicker
                  className="freight-calendar-field"
                  value={assignEta}
                  onChange={(val) => setAssignEta(val)}
                  placeholder="DD/MM/YYYY"
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
        onClose={() => {
          setAttachmentOpen(false);
          void loadTracker();
        }}
        title={`Tracking Documents - Job ${jobNo}`}
        companyCode={companyCode}
        prinCode={prinCode}
        jobNo={jobNo}
        docNr={attachmentContextDocNr}
        context="JOB"
        loginId={loginId}
        readOnly={readOnly}
      />

      {/* ── Stage-Gated Document Verification Warning Modal ── */}
      {docWarningModalOpen && missingDocNotice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 border border-amber-200">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <div className="flex items-center gap-2 text-amber-800">
                <FileCheck size={20} className="text-amber-600" />
                <h4 className="text-sm font-bold m-0">Document Compliance Verification</h4>
              </div>
              <button
                type="button"
                onClick={() => setDocWarningModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <p className="text-slate-700 leading-relaxed m-0">
                Stage <strong>{currentTab?.title}</strong> requires document <strong>{missingDocNotice.docName}</strong>. Standard Freight ERP compliance recommends attaching this document before advancing.
              </p>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-700" />
                <span>
                  Would you like to attach the document now, or confirm and proceed anyway?
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDocWarningModalOpen(false);
                  setAttachmentContextDocNr(missingDocNotice.docCode);
                  setAttachmentOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#00378C] hover:bg-[#002d72] text-white text-xs font-semibold cursor-pointer shadow-xs transition"
              >
                + Attach Document Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setDocWarningModalOpen(false);
                  void handleCompleteTask(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition"
              >
                Proceed & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mail & Admin Settings Dialog ── */}
      {/* ── Built-In Freight PDF Reader / Document Viewer Modal ── */}
      {pdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 md:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#00378C] flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 m-0 leading-tight">
                    {pdfModalTitle || "Shipment Document Viewer"}
                  </h4>
                  <p className="text-[11px] text-slate-500 m-0">
                    Job: <span className="font-mono font-bold text-slate-700">{jobNo}</span>
                    {header?.BL_NUMBER && <> • B/L: <span className="font-mono font-bold text-slate-700">{header.BL_NUMBER}</span></>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pdfModalUrl && (
                  <a
                    href={pdfModalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
                  >
                    <ExternalLink size={13} />
                    <span>Open in New Tab</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPdfModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 bg-slate-100 p-2 relative overflow-hidden">
              {pdfModalUrl ? (
                <iframe
                  title="Shipment Document Preview"
                  src={pdfModalUrl}
                  className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-inner"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <FileText size={36} className="mb-2 text-slate-300" />
                  <p>Document URL is not available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <FreightTrackerSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
