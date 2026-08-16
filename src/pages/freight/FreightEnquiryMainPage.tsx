import type { ColumnDef } from "@tanstack/react-table";
import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, Ban, CreditCard, Eye, MapPinned, PackageCheck, Paperclip, Plus, RefreshCw, RotateCcw, Save, ShieldCheck, ShipWheel, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../../api/client";
import { freightSelect } from "../../api/freight";
import { getLookupValue, type LookupRow } from "../../api/lookups";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { LookupField } from "../../components/ui/LookupField";
import { useToast } from "../../components/ui/AlertToast";
import { useAuth } from "../../state/AuthContext";
import type { FreightWorkspaceTarget } from "./FreightWorkspacePage";

type EnquiryHeader = {
  company_code: string;
  prin_code: string;
  enquiry_nr: string;
  enquiry_date: string;
  dept_code: string;
  origin_port: string;
  destination_port: string;
  transit_time: string;
  cargo_detail: string;
  frequency: string;
  tos: string;
  commodity: string;
  dimension: string;
  carrier: string;
  weight: string;
  volume: string;
  remarks: string;
  payment_terms: string;
  curr_code: string;
  ex_rate: string;
  job_type: string;
  transport_mode: string;
  via: string;
  job_number: string;
  schedule_date: string;
  country_origin: string;
  country_destination: string;
  indstatus: string;
  enquiry_type: string;
  offer_validity: string;
  spl_instructions: string;
  walkin_prin_code: string;
  salesman_code: string;
  member_type: string;
  sale_type: string;
  shipper_name: string;
  shipper_address: string;
  consignee_name: string;
  consignee_address: string;
  job_category: string;
  ref_enquiry_type: string;
  ref_enquiry_nr: string;
  b: string;
  h: string;
  l: string;
  forwarder_code: string;
  gross_wt: string;
  shipment_status: string;
  container_type: string;
  no_of_contaners: string;
  vehicle_type: string;
  t_f: string;
  flow_level_running: string;
  flow_level_initial: string;
  flow_level_final: string;
  final_approved: string;
  last_action: string;
  history_serial: string;
  next_action_by: string;
  sentback_reason: string;
  reject_reason: string;
  submitted_by: string;
  submitted_date: string;
};

type EnquiryDetail = {
  srno: number;
  act_code: string;
  activity: string;
  quantity: string;
  uom: string;
  bill_rate: string;
  cost_rate: string;
  bill: string;
  cost: string;
  curr_code: string;
  ex_rate: string;
  uoc: string;
  moc1: string;
  moc2: string;
  partners_price: string;
  fc_cost: string;
  fc_bill: string;
  fc_partners: string;
  fc_costrate: string;
  fc_billrate: string;
  origin_port: string;
  destination_port: string;
  transport_mode: string;
  cost_curr_code: string;
  cost_ex_rate: string;
  partners_curr_code: string;
  partners_ex_rate: string;
  enquiry_type: string;
  remarks: string;
};

type EnquiryHeaderNames = {
  prin_name: string;
  walkin_prin_name: string;
  dept_name: string;
  curr_name: string;
  origin_port_name: string;
  destination_port_name: string;
  salesman_name: string;
  forwarder_name: string;
  vehicle_type_name: string;
  carrier_name: string;
};

const emptyHeaderNames: EnquiryHeaderNames = {
  prin_name: "",
  walkin_prin_name: "",
  dept_name: "",
  curr_name: "",
  origin_port_name: "",
  destination_port_name: "",
  salesman_name: "",
  forwarder_name: "",
  vehicle_type_name: "",
  carrier_name: "",
};

type Notice = { type: "success" | "error"; text: string } | null;
type EnquiryTab = "cargo" | "journey" | "carrier" | "payment" | "activities";
type EnquiryView = "list" | "editor";
type EnquiryListRow = LookupRow;
type SmartCheck = { tone: "ok" | "warn" | "danger"; title: string; detail: string };

const paymentTerms = ["CIF", "CFR", "FOB", "EXW", "FCA", "FAS", "CPT", "CIP", "DAF", "DES", "DEQ", "DDU", "DDP"];
const jobTypes = [
  { value: "IMP", label: "Import" },
  { value: "EXP", label: "Export" },
];
const transportModes = [
  { value: "A", label: "Air" },
  { value: "S", label: "Sea" },
  { value: "R", label: "Road" },
];
const tosOptions = ["ORIGIN", "DESTINATION"];
const memberTypes = ["", "IFLN", "AFFAL", "None"];
const saleTypes = ["Normal", "FreeIn"];
const jobCategories = ["International", "Combined services", "Clearance", "Others"];
const enquiryTabs: { key: EnquiryTab; label: string; icon: typeof PackageCheck }[] = [
  { key: "cargo", label: "Cargo", icon: PackageCheck },
  { key: "journey", label: "Journey", icon: MapPinned },
  { key: "carrier", label: "Carrier", icon: ShipWheel },
  { key: "payment", label: "Payment", icon: CreditCard },
  { key: "activities", label: "Activities", icon: Activity },
];

type FreightEnquiryMainPageProps = {
  target?: FreightWorkspaceTarget;
  screenType?: "enquiry" | "rfq";
};

type ListStatusTab = "draft" | "in_progress" | "approved" | "sentback" | "rejected" | "cancelled" | "all";

const listStatusTabs: { key: ListStatusTab; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "in_progress", label: "In Progress" },
  { key: "approved", label: "Approved" },
  { key: "sentback", label: "Sent Back" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export function FreightEnquiryMainPage({ target, screenType = "enquiry" }: FreightEnquiryMainPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const userInfo = user as Record<string, unknown> | null;
  const isRfq = screenType === "rfq";
  const initialHeader = useMemo(() => buildInitialHeader(userInfo, target, screenType), [screenType, target, userInfo]);
  const [header, setHeader] = useState<EnquiryHeader>(initialHeader);
  const [details, setDetails] = useState<EnquiryDetail[]>([buildInitialDetail(initialHeader, 1)]);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [listRows, setListRows] = useState<EnquiryListRow[]>([]);
  const [listQuery, setListQuery] = useState("");
  const [activeListTab, setActiveListTab] = useState<ListStatusTab>("draft");
  const [view, setView] = useState<EnquiryView>("list");
  const [notice, setNotice] = useState<Notice>(null);
  const [deepOpenDone, setDeepOpenDone] = useState("");
  const [activeTab, setActiveTab] = useState<EnquiryTab>("cargo");
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [headerNames, setHeaderNames] = useState<EnquiryHeaderNames>(emptyHeaderNames);
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pendingValidateTab, setPendingValidateTab] = useState<EnquiryTab | null>(null);
  const freightSearchRecord = (location.state as { freightSearchRecord?: LookupRow } | null)?.freightSearchRecord;
  const openRecordNo = new URLSearchParams(location.search).get("open") || "";

  useEffect(() => {
    if (!notice) return;
    if (notice.type === "success") toast.success(notice.text);
    else toast.error(notice.text);
    setNotice(null);
  }, [notice, toast]);

  useEffect(() => {
    let alive = true;
    const loadApprovalConfig = async () => {
      try {
        const response = await api.post<{ success?: boolean; data?: { approval_enabled?: boolean } }>("/api/freight/approval/config", {
          company_code: initialHeader.company_code,
          process: isRfq ? "frt_rfq" : "frt_enquiry",
        });
        if (alive) setApprovalEnabled(Boolean(response.data?.data?.approval_enabled));
      } catch {
        if (alive) setApprovalEnabled(false);
      }
    };
    void loadApprovalConfig();
    return () => {
      alive = false;
    };
  }, [initialHeader.company_code, isRfq]);

  const enquiryLabel = isRfq ? "RFQ" : "Enquiry";
  const loginId = String(userInfo?.loginid || userInfo?.USERID || userInfo?.user_id || userInfo?.username || "");
  const isApproved = header.indstatus === "A" || header.final_approved === "Y";
  const isCancelled = header.indstatus === "C";
  const isRejected = header.indstatus === "R" || header.last_action === "REJECTED";
  const isSentBack = header.last_action === "SENTBACK";
  const isLocked = isApproved || isCancelled || isRejected;
  const isApprovalInProgress =
    approvalEnabled &&
    !isLocked &&
    ["SUBMITTED", "APPROVED"].includes(header.last_action) &&
    header.final_approved !== "Y";
  const isReadOnly = isLocked || isApprovalInProgress;
  const isAssignedWorkflowUser = !header.next_action_by || header.next_action_by === loginId;
  const canSubmit =
    approvalEnabled &&
    Boolean(header.enquiry_nr) &&
    !isReadOnly &&
    (!header.last_action || header.last_action === "SAVEASDRAFT" || (header.last_action === "SENTBACK" && isAssignedWorkflowUser));
  const canApprove =
    approvalEnabled &&
    Boolean(header.enquiry_nr) &&
    !isApproved &&
    !isCancelled &&
    !isRejected &&
    isApprovalInProgress &&
    isAssignedWorkflowUser;
  const canDirectApprove =
    !approvalEnabled &&
    Boolean(header.enquiry_nr) &&
    !isApproved &&
    !isCancelled &&
    !isRejected;
  const attachmentRequestNumber = header.enquiry_nr ? `${header.company_code}-${header.enquiry_type}-${header.enquiry_nr}` : "";
  const sourceAttachmentRequestNumbers = useMemo(() => {
    if (!isRfq || !header.ref_enquiry_nr) return [];
    const sourceKey = `${header.company_code}-${header.ref_enquiry_type || "EQI"}-${header.ref_enquiry_nr}`;
    return sourceKey && sourceKey !== attachmentRequestNumber ? [sourceKey] : [];
  }, [attachmentRequestNumber, header.company_code, header.ref_enquiry_nr, header.ref_enquiry_type, isRfq]);
  const smartChecks = useMemo(() => buildSmartChecks(header, details, isRfq), [details, header, isRfq]);
  const urgentChecks = smartChecks.filter((item) => item.tone === "danger").length;
  const warningChecks = smartChecks.filter((item) => item.tone === "warn").length;
  const visibleListStatusTabs = useMemo(
    () => listStatusTabs.filter((tab) => approvalEnabled || !["in_progress", "sentback", "rejected"].includes(tab.key)),
    [approvalEnabled]
  );
  const filteredListRows = useMemo(
    () => listRows.filter((row) => matchesListStatusTab(row, activeListTab)),
    [activeListTab, listRows]
  );

  const requiredFieldChecks: { tab: EnquiryTab; test: () => boolean; label: string }[] = [
  { tab: "journey", test: () => Boolean(header.origin_port), label: "Port of Loading" },
  { tab: "payment", test: () => Boolean(header.curr_code), label: "Currency" },
  { tab: "payment", test: () => Number(header.ex_rate || 0) > 0, label: "Exchange Rate" },
 ];

  const listColumns = useMemo<ColumnDef<EnquiryListRow>[]>(
    () => [
      {
        accessorKey: "enquiry_nr",
        header: `${enquiryLabel} No`,
        size: 140,
        cell: ({ row }) => (
          <button
            className="font-semibold text-primary hover:underline"
            type="button"
            onClick={() => openEnquiry(row.original)}
          >
            {lookupText(row.original, "enquiry_nr")}
          </button>
        ),
      },
      { accessorKey: "enquiry_date", header: "Date", size: 120, cell: ({ row }) => formatDisplayDate(lookupText(row.original, "enquiry_date")) },
      { accessorKey: "prin_code", header: "Principal", size: 130, cell: ({ row }) => lookupText(row.original, "prin_code") },
      { accessorKey: "prin_name", header: "Principal Name", size: 260, cell: ({ row }) => lookupText(row.original, "prin_name") },
      { accessorKey: "job_type", header: "Job Type", size: 110, cell: ({ row }) => jobTypeLabel(lookupText(row.original, "job_type")) },
      { accessorKey: "transport_mode", header: "Mode", size: 100, cell: ({ row }) => modeLabel(lookupText(row.original, "transport_mode")) },
      { accessorKey: "origin_port", header: "Origin", size: 110, cell: ({ row }) => lookupText(row.original, "origin_port") },
      { accessorKey: "destination_port", header: "Destination", size: 120, cell: ({ row }) => lookupText(row.original, "destination_port") },
      { accessorKey: "curr_code", header: "Currency", size: 100, cell: ({ row }) => lookupText(row.original, "curr_code") },
      {
        accessorKey: "indstatus",
        header: "Status",
        size: 130,
        cell: ({ row }) => {
          const status = lookupText(row.original, "indstatus");
          return (
            <span className={statusBadgeClass(status, lookupText(row.original, "last_action"), lookupText(row.original, "final_approved"))}>
              {statusLabel(status, lookupText(row.original, "last_action"), lookupText(row.original, "final_approved"))}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 90,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Button type="button" size="icon" variant="ghost" title={`Open ${enquiryLabel}`} onClick={() => openEnquiry(row.original)}>
            <Eye size={14} />
          </Button>
        ),
      },
    ],
    [enquiryLabel],
  );

  useEffect(() => {
    void loadEnquiries();
  }, [screenType, userInfo?.company_code, userInfo?.COMPANY_CODE]);

const setHeaderField = (field: keyof EnquiryHeader, value: string) => {
  setHeader((current) => ({ ...current, [field]: value }));
  if (field === "transport_mode") {
    setDetails((current) => current.map((row) => ({ ...row, transport_mode: value })));
  }
};

  // const applyHeaderLookup = (field: keyof EnquiryHeader, value: string, row: LookupRow | null) => {
  //   setHeader((current) => {
  //     const next = { ...current, [field]: value };
  //     if (field === "prin_code" && row) {
  //       next.dept_code = lookupText(row, "prin_dept_code") || next.dept_code;
  //       next.curr_code = lookupText(row, "curr_code") || next.curr_code;
  //       next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
  //     }
  //     if (field === "origin_port" && row) {
  //       next.country_origin = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_origin;
  //     }
  //     if (field === "destination_port" && row) {
  //       next.country_destination = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_destination;
  //     }
  //     if (field === "curr_code" && row) {
  //       next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
  //     }
  //     return next;
  //   });
  // };


  const applyHeaderLookup = (field: keyof EnquiryHeader, value: string, row: LookupRow | null) => {
  setHeader((current) => {
    const next = { ...current, [field]: value };
    if (field === "prin_code" && row) {
      next.dept_code = lookupText(row, "prin_dept_code") || next.dept_code;
      next.curr_code = lookupText(row, "curr_code") || next.curr_code;
      next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
    }
    if (field === "origin_port" && row) {
      next.country_origin = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_origin;
    }
    if (field === "destination_port" && row) {
      next.country_destination = lookupText(row, "country_name") || lookupText(row, "country_code") || next.country_destination;
    }
    if (field === "curr_code" && row) {
      next.ex_rate = lookupText(row, "ex_rate") || next.ex_rate;
    }
    return next;
  });

  setHeaderNames((current) => {
    const next = { ...current };
    if (field === "prin_code") {
      next.prin_name = row ? lookupText(row, "prin_name") : "";
      if (row) {
        next.dept_name = lookupText(row, "dept_name") || next.dept_name;
        next.curr_name = lookupText(row, "curr_name") || next.curr_name;
      }
    }
    if (field === "walkin_prin_code") next.walkin_prin_name = row ? lookupText(row, "prin_name") : "";
    if (field === "dept_code") next.dept_name = row ? lookupText(row, "dept_name") : "";
    if (field === "curr_code") next.curr_name = row ? lookupText(row, "curr_name") : "";
    if (field === "origin_port") next.origin_port_name = row ? lookupText(row, "port_name") : "";
    if (field === "destination_port") next.destination_port_name = row ? lookupText(row, "port_name") : "";
    if (field === "salesman_code") next.salesman_name = row ? lookupText(row, "salesman_name") : "";
    if (field === "forwarder_code") next.forwarder_name = row ? lookupText(row, "forwarder_name") : "";
    if (field === "vehicle_type") next.vehicle_type_name = row ? lookupText(row, "vtype_name") : "";
    if (field === "carrier") {
      next.carrier_name = row
        ? lookupText(row, "vessel_name") || lookupText(row, "vehicle_desc") || lookupText(row, "airline_name")
        : "";
    }
    return next;
  });
 };

  const applyReferenceEnquiryLookup = async (value: string, row: LookupRow | null) => {
    setHeaderField("ref_enquiry_nr", value);
    if (!value) {
      setHeaderField("ref_enquiry_type", "");
      return;
    }

    const companyCode = lookupText(row || {}, "company_code") || header.company_code;
    const referenceType = lookupText(row || {}, "enquiry_type") || "EQI";
    setHeader((current) => ({ ...current, ref_enquiry_nr: value, ref_enquiry_type: referenceType }));

    if (!isRfq) return;

    setLoadingRecord(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow | null; details?: LookupRow[] }; message?: string }>(
        "/api/freight/enquiry/get",
        { company_code: companyCode, enquiry_type: referenceType, enquiry_nr: value },
      );
      if (response.data?.success === false) throw new Error(response.data.message || "Reference enquiry not found");
      const sourceRow = normalizeLookupRow(response.data?.data?.header || {});
      const detailRows = response.data?.data?.details || [];
      if (!response.data?.data?.header) {
        throw new Error("Reference enquiry not found");
      }

      const currentRfqNo = header.enquiry_nr;
      const copiedHeader = {
        ...toHeaderFromRow(sourceRow, userInfo, target, "rfq"),
        enquiry_nr: currentRfqNo,
        enquiry_date: header.enquiry_date || toInputDate(new Date()),
        enquiry_type: "RFQ",
        indstatus: "N",
        flow_level_running: "0",
        flow_level_initial: "0",
        flow_level_final: "0",
        final_approved: "N",
        history_serial: "0",
        last_action: "SAVEASDRAFT",
        next_action_by: "",
        sentback_reason: "",
        reject_reason: "",
        submitted_by: "",
        submitted_date: "",
        ref_enquiry_type: referenceType,
        ref_enquiry_nr: value,
      };

      setHeader(copiedHeader);
      setHeaderNames({
        prin_name: lookupText(sourceRow, "prin_name"),
        walkin_prin_name: lookupText(sourceRow, "walkin_prin_name"),
        dept_name: lookupText(sourceRow, "dept_name"),
        curr_name: lookupText(sourceRow, "curr_name"),
        origin_port_name: lookupText(sourceRow, "origin_port_name"),
        destination_port_name: lookupText(sourceRow, "destination_port_name"),
        salesman_name: lookupText(sourceRow, "salesman_name"),
        forwarder_name: lookupText(sourceRow, "forwarder_name"),
        vehicle_type_name: lookupText(sourceRow, "vtype_name"),
        carrier_name: "",
      });
      setDetails(detailRows.length ? detailRows.map((detail, index) => ({
        ...toDetailFromRow(normalizeLookupRow(detail), copiedHeader, index + 1),
        enquiry_type: "RFQ",
      })) : [buildInitialDetail(copiedHeader, 1)]);
      setNotice({ type: "success", text: `Copied approved enquiry ${value} into RFQ` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to copy enquiry into RFQ" });
    } finally {
      setLoadingRecord(false);
    }
  };

  const setDetailField = (index: number, field: keyof EnquiryDetail, value: string) => {
    setDetails((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [field]: value };
        if (field === "quantity" || field === "bill_rate") {
          next.bill = multiplyText(next.quantity, next.bill_rate);
        }
        if (field === "quantity" || field === "cost_rate") {
          next.cost = multiplyText(next.quantity, next.cost_rate);
        }
        return next;
      }),
    );
  };

  const applyDetailActivityLookup = (index: number, value: string, row: LookupRow | null) => {
    setDetails((current) =>
      current.map((line, rowIndex) => {
        if (rowIndex !== index) return line;
        const quantity = lookupText(row || {}, "quantity") || line.quantity || "1";
        const billRate = lookupText(row || {}, "bill") || line.bill_rate || "0";
        const costRate = lookupText(row || {}, "cost") || line.cost_rate || "0";
        return {
          ...line,
          act_code: value,
        activity: lookupText(row || {}, "activity") || line.activity,
        transport_mode: header.transport_mode || line.transport_mode,
        quantity,
        uom: lookupText(row || {}, "uom") || line.uom,
        bill_rate: billRate,
          cost_rate: costRate,
          bill: multiplyText(quantity, billRate),
          cost: multiplyText(quantity, costRate),
        };
      }),
    );
  };

  const loadEnquiries = async () => {
    const companyCode = String(userInfo?.company_code || userInfo?.COMPANY_CODE || header.company_code || "");
    if (!companyCode) return;
    setLoadingList(true);
    try {
      const response = await api.post<{ success?: boolean; data?: LookupRow[]; message?: string }>(
        isRfq ? "/api/freight/rfq/list" : "/api/freight/enquiry/list",
        { company_code: companyCode, enquiry_type: screenType === "rfq" ? "RFQ" : "EQI" },
      );
      if (response.data?.success === false) throw new Error(response.data.message || `Unable to load ${enquiryLabel} list`);
      setListRows((response.data?.data || []).map(normalizeLookupRow));
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : `Unable to load ${enquiryLabel} list` });
    } finally {
      setLoadingList(false);
    }
  };

  const resetForm = () => {
    const freshHeader = buildInitialHeader(userInfo, target, screenType);
    setHeader(freshHeader);
    setHeaderNames(emptyHeaderNames);
    setDetails([buildInitialDetail(freshHeader, 1)]);
    setNotice(null);
  };

  const startNew = () => {
    resetForm();
    setActiveTab("cargo");
    setView("editor");
  };

  const requestCancel = () => {
    if (!header.enquiry_nr) {
      setView("list");
      return;
    }
    if (isReadOnly) {
      setNotice({ type: "error", text: `${statusLabel(header.indstatus, header.last_action, header.final_approved)} ${enquiryLabel.toLowerCase()} cannot be cancelled` });
      return;
    }
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelRemarks.trim()) {
      setNotice({ type: "error", text: "Please enter cancellation remarks" });
      return;
    }
    setCancelling(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; message?: string }>(
        isRfq ? "/api/freight/rfq/cancel" : "/api/freight/enquiry/cancel",
        {
          company_code: header.company_code,
          enquiry_type: header.enquiry_type,
          enquiry_nr: header.enquiry_nr,
          cancel_by: loginId,
          cancel_remarks: cancelRemarks.trim(),
        },
      );
      if (response.data?.success === false) {
        throw new Error(response.data.message || `Unable to cancel ${enquiryLabel}`);
      }
      setHeaderField("indstatus", "C");
      setCancelOpen(false);
      setCancelRemarks("");
      setNotice({ type: "success", text: response.data?.message || `${enquiryLabel} cancelled` });
      await loadEnquiries();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : `Unable to cancel ${enquiryLabel}` });
    } finally {
      setCancelling(false);
    }
  };

  const applyWorkflowResult = (row: LookupRow | null | undefined) => {
    if (!row) return;
    const normalized = normalizeLookupRow(row);
    setHeader((current) => ({
      ...current,
      indstatus: lookupText(normalized, "indstatus") || current.indstatus,
      flow_level_running: lookupText(normalized, "flow_level_running") || current.flow_level_running,
      flow_level_final: lookupText(normalized, "flow_level_final") || current.flow_level_final,
      final_approved: lookupText(normalized, "final_approved") || current.final_approved,
      last_action: lookupText(normalized, "last_action") || current.last_action,
      next_action_by: lookupText(normalized, "next_action_by") || current.next_action_by,
      sentback_reason: lookupText(normalized, "sentback_reason") || current.sentback_reason,
      reject_reason: lookupText(normalized, "reject_reason") || current.reject_reason,
    }));
  };

  const runWorkflowAction = async (action: "SUBMITTED" | "APPROVED" | "SENTBACK" | "REJECTED", remarks = "", sentbackTo = "") => {
    if (!header.enquiry_nr) {
      setNotice({ type: "error", text: `Save ${enquiryLabel.toLowerCase()} before workflow action` });
      return;
    }
    if (isLocked && action !== "SENTBACK") {
      setNotice({ type: "error", text: `${statusLabel(header.indstatus, header.last_action, header.final_approved)} ${enquiryLabel.toLowerCase()} is read-only` });
      return;
    }
    if (action === "SENTBACK" && !sentbackTo.trim()) {
      setNotice({ type: "error", text: "Send back user is required" });
      return;
    }

    setApproving(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; message?: string; data?: LookupRow | null }>(
        isRfq ? "/api/freight/rfq/workflow-action" : "/api/freight/enquiry/workflow-action",
        {
          company_code: header.company_code,
          enquiry_type: header.enquiry_type,
          enquiry_nr: header.enquiry_nr,
          action,
          action_by: loginId,
          action_remarks: remarks,
          sentback_to: sentbackTo,
        },
      );
      if (response.data?.success === false) {
        throw new Error(response.data.message || `Unable to update ${enquiryLabel} workflow`);
      }
      applyWorkflowResult(response.data?.data);
      setNotice({ type: "success", text: response.data?.message || `${enquiryLabel} workflow updated` });
      await loadEnquiries();
      if (action === "SUBMITTED" ||action === "APPROVED" || action === "REJECTED") {
        setView("list");
      }
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : `Unable to update ${enquiryLabel} workflow` });
    } finally {
      setApproving(false);
    }
  };

  const submitForApproval = () => {
    void runWorkflowAction("SUBMITTED");
  };

  const approveEnquiry = () => {
    const remarks = window.prompt("Approval remarks", "") || "";
    void runWorkflowAction("APPROVED", remarks);
  };

  const directApproveEnquiry = async () => {
    if (!header.enquiry_nr) {
      setNotice({ type: "error", text: `Save ${enquiryLabel.toLowerCase()} before approval` });
      return;
    }
    const remarks = window.prompt("Approval remarks", "") || "";
    setApproving(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; message?: string }>(
        isRfq ? "/api/freight/rfq/approve" : "/api/freight/enquiry/approve",
        {
          company_code: header.company_code,
          enquiry_type: header.enquiry_type,
          enquiry_nr: header.enquiry_nr,
          approved_by: loginId,
          approval_remarks: remarks,
        },
      );
      if (response.data?.success === false) {
        throw new Error(response.data.message || `Unable to approve ${enquiryLabel}`);
      }
      setHeader((current) => ({ ...current, indstatus: "A", final_approved: "Y", last_action: "APPROVED" }));
      setNotice({ type: "success", text: response.data?.message || `${enquiryLabel} approved` });
      await loadEnquiries();
      setView("list");
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : `Unable to approve ${enquiryLabel}` });
    } finally {
      setApproving(false);
    }
  };

  const sendBackEnquiry = () => {
    const sentbackTo = window.prompt("Send back to user/employee id", header.submitted_by || "") || "";
    if (!sentbackTo.trim()) return;
    const remarks = window.prompt("Send back remarks", "") || "";
    void runWorkflowAction("SENTBACK", remarks, sentbackTo);
  };

  const rejectEnquiry = () => {
    const remarks = window.prompt("Reject reason", "") || "";
    if (!remarks.trim()) {
      setNotice({ type: "error", text: "Reject reason is required" });
      return;
    }
    void runWorkflowAction("REJECTED", remarks);
  };

  const openEnquiry = async (row: EnquiryListRow) => {
    const companyCode = lookupText(row, "company_code") || header.company_code;
    const enquiryNr = lookupText(row, "enquiry_nr");
    const enquiryType = lookupText(row, "enquiry_type") || (screenType === "rfq" ? "RFQ" : "EQI");
    if (!companyCode || !enquiryNr) return;
    setLoadingRecord(true);
    setNotice(null);
    try {
      const response = await api.post<{ success?: boolean; data?: { header?: LookupRow | null; details?: LookupRow[] }; message?: string }>(
        isRfq ? "/api/freight/rfq/get" : "/api/freight/enquiry/get",
        {
          company_code: companyCode,
          enquiry_type: enquiryType,
          enquiry_nr: enquiryNr,
        }
      );
      if (response.data?.success === false) {
        throw new Error(response.data.message || `Unable to open ${enquiryLabel}`);
      }
      const headerRow = normalizeLookupRow(response.data?.data?.header || row);
      const detailRows = (response.data?.data?.details || []).map(normalizeLookupRow);
      const listRow = normalizeLookupRow(row);
      const loadedRow = { ...listRow, ...headerRow };
      const loadedHeader = toHeaderFromRow(loadedRow, userInfo, target, screenType);
      setHeader(loadedHeader);
      setHeaderNames({
        prin_name: lookupText(loadedRow, "prin_name"),
        walkin_prin_name: lookupText(loadedRow, "walkin_prin_name"),
        dept_name: lookupText(loadedRow, "dept_name"),
        curr_name: lookupText(loadedRow, "curr_name"),
        origin_port_name: lookupText(loadedRow, "origin_port_name"),
        destination_port_name: lookupText(loadedRow, "destination_port_name"),
        salesman_name: lookupText(loadedRow, "salesman_name"),
        forwarder_name: lookupText(loadedRow, "forwarder_name"),
        vehicle_type_name: lookupText(loadedRow, "vtype_name"),
        carrier_name: "",
      });

      if (loadedHeader.carrier) {
        loadCarrierLookup(loadedHeader.company_code, loadedHeader.transport_mode)
          .then((rows) => {
            const match = rows.find((r) => lookupText(r, "vessel_code") === loadedHeader.carrier
              || lookupText(r, "vehicle_no") === loadedHeader.carrier
              || lookupText(r, "airline_code") === loadedHeader.carrier);
            if (match) {
              const name = lookupText(match, "vessel_name") || lookupText(match, "vehicle_desc") || lookupText(match, "airline_name");
              setHeaderNames((current) => ({ ...current, carrier_name: name }));
            }
          })
          .catch(() => {});
      }
      setDetails(detailRows.length ? detailRows.map((detail, index) => toDetailFromRow(detail, loadedHeader, index + 1)) : [buildInitialDetail(loadedHeader, 1)]);
      setActiveTab("cargo");
      setView("editor");
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : `Unable to open ${enquiryLabel}` });
    } finally {
      setLoadingRecord(false);
    }
  };

  useEffect(() => {
    if (!openRecordNo || deepOpenDone === openRecordNo) return;
    const recordType = lookupText(freightSearchRecord || {}, "record_type").toUpperCase();
    if (isRfq ? recordType !== "RFQ" : recordType !== "ENQUIRY") return;
    setDeepOpenDone(openRecordNo);
    void openEnquiry(normalizeLookupRow({
      company_code: lookupText(freightSearchRecord || {}, "company_code") || header.company_code,
      prin_code: lookupText(freightSearchRecord || {}, "prin_code"),
      enquiry_nr: openRecordNo,
      enquiry_type: isRfq ? "RFQ" : "EQI",
    }) as EnquiryListRow);
  }, [deepOpenDone, freightSearchRecord, header.company_code, isRfq, openRecordNo]);

  const addDetail = () => {
    setDetails((current) => [...current, buildInitialDetail(header, current.length + 1)]);
  };

  const removeDetail = (index: number) => {
    setDetails((current) =>
      current.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, srno: rowIndex + 1 })),
    );
  };

  const saveEnquiry = async (event: FormEvent) => {
    event.preventDefault();
    if (isReadOnly) {
      setNotice({ type: "error", text: `${statusLabel(header.indstatus, header.last_action, header.final_approved)} ${enquiryLabel.toLowerCase()} is read-only` });
      return;
    }

  const failedCheck = requiredFieldChecks.find((check) => !check.test());
  if (failedCheck) {
    if (activeTab !== failedCheck.tab) {
      setActiveTab(failedCheck.tab);
      setPendingValidateTab(failedCheck.tab);
    } else {
      formRef.current?.reportValidity();
    }
    return;
  }
    setSaving(true);
    setNotice(null);
    try {
      const loginid = String(userInfo?.loginid || userInfo?.USERID || userInfo?.user_id || "");
      const payload = {
        header: {
          ...header,
          userid: loginid,
          user_date: new Date().toISOString(),
        },
        details: details.filter((row) => row.act_code.trim()).map((row, index) => ({
          ...row,
          srno: index + 1,
          sr_no: index + 1,
          company_code: header.company_code,
          prin_code: header.prin_code,
          enquiry_nr: header.enquiry_nr || "0",
          enquiry_type: header.enquiry_type,
          curr_code: row.curr_code || header.curr_code,
          ex_rate: row.ex_rate || header.ex_rate,
          origin_port: row.origin_port || header.origin_port,
          destination_port: row.destination_port || header.destination_port,
          transport_mode: row.transport_mode || header.transport_mode,
          userid: loginid,
          user_dt: new Date().toISOString(),
        })),
      };

      const response = await api.post<{ success?: boolean; message?: string; data?: { enquiry_nr?: string } }>(
        isRfq ? "/api/freight/rfq/save" : "/api/freight/enquiry/save",
        payload
      );
      if (response.data?.success === false) {
        throw new Error(response.data.message || "Unable to save enquiry");
      }
      if (response.data?.data?.enquiry_nr) {
        setHeaderField("enquiry_nr", response.data.data.enquiry_nr);
      }
      setNotice({ type: "success", text: response.data?.message || "Enquiry saved" });
      await loadEnquiries();
      setView("list");
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save enquiry" });
    } finally {
      setSaving(false);
    }
  };

  if (view === "list") {
    return (
      <section className="grid gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <ShipWheel size={17} />
            </div>
            <div className="min-w-0">
              {/* <p className="eyebrow mb-0.5">{isRfq ? "Freight RFQ" : "Freight Enquiry"}</p> */}
              <h1 className="m-0 text-xl font-semibold leading-tight text-foreground"> {isRfq ? "Freight RFQ" : "Freight Enquiry"}
                {/* {enquiryLabel} Listing */}
                </h1>
              {/* <p className="m-0 mt-1 text-xs text-muted-foreground">Create, search, and reopen freight {enquiryLabel.toLowerCase()} records.</p> */}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice && (
              <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {notice.text}
              </span>
            )}
            <HeaderChip label="Records" value={String(listRows.length)} />
            <Button type="button" size="sm" variant="outline" onClick={loadEnquiries} disabled={loadingList}>
              <RefreshCw size={14} />
              {loadingList ? "Loading" : "Refresh"}
            </Button>
            <Button type="button" size="sm" onClick={startNew}>
              <Plus size={14} />
              Add {enquiryLabel}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 shadow-sm">
          {visibleListStatusTabs.map((tab) => {
            const count = listRows.filter((row) => matchesListStatusTab(row, tab.key)).length;
            const active = activeListTab === tab.key;
            return (
              <Button
                key={tab.key}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setActiveListTab(tab.key)}
                className={active ? "" : "bg-background"}
              >
                {tab.label}
                <span className={`ml-1 rounded px-1.5 text-[10px] font-bold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </Button>
            );
          })}
        </div>

        <DataTable
          columns={listColumns}
          data={filteredListRows}
          title={loadingList ? "Loading" : `${filteredListRows.length} ${enquiryLabel} Records`}
          subtitle={`Freight ${enquiryLabel}`}
          searchValue={listQuery}
          onSearchChange={setListQuery}
          searchPlaceholder={`Search ${enquiryLabel.toLowerCase()}, principal, port, job...`}
          loading={loadingList}
          height="calc(100vh - 240px)"
          minWidth={1380}
          density="grid"
          enablePagination
          pageSize={50}
          enableExport
          exportFilename={`freight-${enquiryLabel.toLowerCase()}-list.csv`}
          getRowId={(row, index) => `${lookupText(row, "company_code")}-${lookupText(row, "enquiry_type")}-${lookupText(row, "enquiry_nr") || index}`}
          rowClassName={statusRowClassName}
          onRowClick={openEnquiry}
        />
      </section>
    );
  }

  return (
    <>
    <form className="freight-dense-form" onSubmit={saveEnquiry}>
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ShipWheel size={15} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow mb-10"> {isRfq ? "Request For Quote" : "Freight Enquiry"}
              {/* {isRfq ? "Freight RFQ" : "Freight Enquiry"} */}
              </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">{header.enquiry_nr}
                {/* {isRfq ? "Request For Quote" : "Freight Enquiry"} */}
                </h1>
              {/* <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {header.enquiry_nr || (isRfq ? "New RFQ" : "New enquiry")}
              </span> */}
              <span className={statusBadgeClass(header.indstatus, header.last_action, header.final_approved)}>
                {statusLabel(header.indstatus, header.last_action, header.final_approved)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {/* <span>{modeLabel(header.transport_mode)}</span> */}
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              {/* <span>{header.job_type === "IMP" ? "Import" : "Export"}</span> */}
              {/* <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              <span>{header.enquiry_nr}</span> */}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => setView("list")}>
            <ArrowLeft size={14} />
            List
          </Button>
          <HeaderChip label="Route" value={`${header.origin_port || "-"} -> ${header.destination_port || "-"}`} />
          <HeaderChip label="Currency" value={`${header.curr_code || "-"} / ${header.ex_rate || "1"}`} />
          <HeaderChip label="Lines" value={String(details.length)} />
          {loadingRecord && <HeaderChip label="Opening" value="Loading" />}
          {notice && (
            <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {notice.text}
            </span>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setAssistOpen((open) => !open)} disabled={isCancelled}>
            <Sparkles size={14} />
            Check
            {(urgentChecks + warningChecks) > 0 && (
              <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{urgentChecks + warningChecks}</span>
            )}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAttachmentOpen(true)}>
            <Paperclip size={14} />
            Files
          </Button>
          {canSubmit && (
            <Button type="button" size="sm" variant="outline" onClick={submitForApproval} disabled={approving || saving}>
              <ShieldCheck size={14} />
              {isSentBack ? "Resubmit" : "Submit"}
            </Button>
          )}
          {canDirectApprove && (
            <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={directApproveEnquiry} disabled={approving || saving}>
              <ShieldCheck size={14} />
              {approving ? "Working" : "Approve"}
            </Button>
          )}
          {canApprove && (
            <>
              <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={approveEnquiry} disabled={approving || saving}>
                <ShieldCheck size={14} />
                {approving ? "Working" : "Approve"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={sendBackEnquiry} disabled={approving || saving}>
                <RotateCcw size={14} />
                Send Back
              </Button>
              <Button type="button" size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={rejectEnquiry} disabled={approving || saving}>
                <Ban size={14} />
                Reject
              </Button>
            </>
          )}
          {!isApprovalInProgress && (
            <Button type="button" size="sm" variant="outline" onClick={requestCancel} disabled={isReadOnly}>
              {header.enquiry_nr ? <Ban size={14} /> : <X size={14} />}
              {header.enquiry_nr ? "Cancel" : "Close"}
            </Button>
          )}
          {!isApprovalInProgress && (
            <Button type="button" size="sm" variant="outline" onClick={resetForm} disabled={isReadOnly}>
              <RotateCcw size={14} />
              Reset
            </Button>
          )}
          {!isApprovalInProgress && (
            <Button type="submit" size="sm" disabled={saving || isReadOnly}>
              <Save size={14} />
              {saving ? "Saving" : "Save Draft"}
            </Button>
          )}
        </div>
      </div>

      {assistOpen && <FreightAssistPanel checks={smartChecks} />}

      <fieldset disabled={isReadOnly} className="contents">
      <section className="freight-form-card rounded-md border bg-card shadow-sm">
        <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
          {/* <FormInput label="Company" value={header.company_code} onChange={(value) => setHeaderField("company_code", value)} required /> */}
          <FormInput label={`${enquiryLabel} No`} value={header.enquiry_nr} onChange={(value) => setHeaderField("enquiry_nr", value)} placeholder="Auto" disabled required inputClassName={header.enquiry_nr
            ? "bg-muted text-foreground"
            : "bg-amber-50 border-dashed border-amber-300 text-amber-700 italic"
           } />
          <FormInput label="Date" type="date" value={header.enquiry_date} onChange={(value) => setHeaderField("enquiry_date", value)} required />
          {/* <FormLookup label="Department" value={header.dept_code} displayValue={headerNames.dept_name} valueField="dept_code" displayFields={["dept_code", "dept_name"]} columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Department" }]} loadOptions={() => loadDepartmentLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("dept_code", value, row)} className="sm:col-span-2 xl:col-span-1.5" /> */}
          <FormSelect label="Job Type" value={header.job_type} onChange={(value) => setHeaderField("job_type", value)} options={jobTypes} required/>
          <FormSelect label="Mode" value={header.transport_mode} onChange={(value) => setHeaderField("transport_mode", value)} options={transportModes}  required />
          <FormLookup label="Department" value={header.dept_code} displayValue={headerNames.dept_name} valueField="dept_code" displayFields={["dept_code", "dept_name"]} columns={[{ field: "dept_code", header: "Code" }, { field: "dept_name", header: "Department" }]} loadOptions={() => loadDepartmentLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("dept_code", value, row)} required className="sm:col-span-2 xl:col-span-1.5" />
          <FormLookup label="Principal" value={header.prin_code} displayValue={headerNames.prin_name} valueField="prin_code" displayFields={["prin_code", "prin_name"]} columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Principal" }, { field: "curr_code", header: "Currency" }]} loadOptions={() => loadPrincipalLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("prin_code", value, row)} required className="sm:col-span-2 xl:col-span-1.5" />
          <FormLookup label="Walk-in Principal" value={header.walkin_prin_code} displayValue={headerNames.walkin_prin_name} valueField="prin_code" displayFields={["prin_code", "prin_name"]} columns={[{ field: "prin_code", header: "Code" }, { field: "prin_name", header: "Name" }, { field: "prin_telno1", header: "Phone" }]} loadOptions={() => loadWalkinPrincipalLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("walkin_prin_code", value, row)} className="sm:col-span-2 xl:col-span-1.5" />
          <FormLookup label="Salesman" value={header.salesman_code} displayValue={headerNames.salesman_name} valueField="salesman_code" displayFields={["salesman_code", "salesman_name"]} columns={[{ field: "salesman_code", header: "Code" }, { field: "salesman_name", header: "Salesman" }]} loadOptions={() => loadSalesmanLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("salesman_code", value, row)} className="sm:col-span-2 xl:col-span-1.5" />
          <StatusField status={header.indstatus} action={header.last_action} finalApproved={header.final_approved} />
          <TypeField label="Approval Level" value={workflowLevelText(header)} />
          <FormInput label="Offer Validity" type="date" value={header.offer_validity} onChange={(value) => setHeaderField("offer_validity", value)} />
          <TypeField label="Type" value={header.enquiry_type} />
          {isRfq && !header.enquiry_nr && (
            <FormLookup
              label="Source Enquiry"
              value={header.ref_enquiry_nr}
              valueField="enquiry_nr"
              displayFields={["enquiry_nr", "enquiry_date_display"]}
              columns={[
                { field: "enquiry_nr", header: "Enquiry" },
                { field: "enquiry_date_display", header: "Date" },
                { field: "prin_code", header: "Principal" },
                { field: "prin_name", header: "Principal Name" },
              ]}
              loadOptions={() => loadReferenceEnquiryLookup(header.company_code)}
              onChange={applyReferenceEnquiryLookup}
              className="xl:col-span-2"
            />
          )}
          {isRfq && header.enquiry_nr && <TypeField label="Source Enquiry" value={header.ref_enquiry_nr || "-"} />}
        </div>
      </section>
      </fieldset>

      <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
        <div className="freight-tabs-list flex overflow-x-auto">
          {enquiryTabs.map((tab) => (
            <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />
          ))}
        </div>

        <fieldset disabled={isReadOnly} className="contents">
        <div className="freight-tabs-panel border-t">
          {activeTab === "cargo" && (
            <section>
              <SectionHeading title="Cargo And Parties" description="Commodity, measurement, shipper and consignee details" />
              <div className="grid gap-1.5 xl:grid-cols-12">
                <SectionPanel className="xl:col-span-12" icon={PackageCheck} title="Cargo Profile" meta={`${header.commodity || "Commodity pending"} / ${header.gross_wt || header.weight || "0"} kgs`}>
                  <div className="grid gap-1 sm:grid-cols-3 xl:grid-cols-7">
                    <FormLookup label="Commodity" value={header.commodity} valueField="prodtype_desc" displayFields={["prodtype_desc", "prodtype_code"]} columns={[{ field: "prodtype_desc", header: "Commodity" }, { field: "prodtype_code", header: "Code" }]} loadOptions={() => loadCommodityLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("commodity", value, row)} className="xl:col-span-2" />
                    <FormInput label="Weight(kgs)" type="number" value={header.weight} onChange={(value) => setHeaderField("weight", value)} />
                    <FormInput label="Gross Weight(kgs)" type="number" value={header.gross_wt} onChange={(value) => setHeaderField("gross_wt", value)} />
                    <FormInput label="Volume" type="number" value={header.volume} onChange={(value) => setHeaderField("volume", value)} />
                    <FormInput label="Length(cm)" type="number" value={header.l} onChange={(value) => setHeaderField("l", value)} />
                    <FormInput label="Breadth(cm)" type="number" value={header.b} onChange={(value) => setHeaderField("b", value)} />
                    <FormInput label="Height(cm)" type="number" value={header.h} onChange={(value) => setHeaderField("h", value)} />
                    <FormInput label="Dimension" value={header.dimension} onChange={(value) => setHeaderField("dimension", value)} />
                    {header.transport_mode === "S" && (
                    <>
                    <FormInput label="Container Type" value={header.container_type} onChange={(value) => setHeaderField("container_type", value)} />
                    <FormInput label="Containers" type="number" value={header.no_of_contaners} onChange={(value) => setHeaderField("no_of_contaners", value)} />
                    <FormInput label="T/F" value={header.t_f} onChange={(value) => setHeaderField("t_f", value)} />
                    </>)}
                    {header.transport_mode === "R" && (
                    <>
                    <FormLookup label="Vehicle Type" value={header.vehicle_type} valueField="vtype_code" displayFields={["vtype_code", "vtype_name"]} columns={[{ field: "vtype_code", header: "Code" }, { field: "vtype_name", header: "Vehicle Type" }]} loadOptions={() => loadVehicleTypeLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("vehicle_type", value, row)} className="xl:col-span-2" />
                    </>)}
                    <FormTextarea label="Cargo Detail" value={header.cargo_detail} onChange={(value) => setHeaderField("cargo_detail", value)} compact className="xl:col-span-2" />
                  </div>
                </SectionPanel>

                {/* <SectionPanel className="xl:col-span-5" icon={ShipWheel} title="Equipment" meta={`${header.no_of_contaners || "0"} containers`}>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <FormInput label="Container Type" value={header.container_type} onChange={(value) => setHeaderField("container_type", value)} />
                    <FormInput label="Containers" type="number" value={header.no_of_contaners} onChange={(value) => setHeaderField("no_of_contaners", value)} />
                    <FormLookup label="Vehicle Type" value={header.vehicle_type} valueField="vtype_code" displayFields={["vtype_code", "vtype_name"]} columns={[{ field: "vtype_code", header: "Code" }, { field: "vtype_name", header: "Vehicle Type" }]} loadOptions={() => loadVehicleTypeLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("vehicle_type", value, row)} />
                    <FormInput label="T/F" value={header.t_f} onChange={(value) => setHeaderField("t_f", value)} />
                  </div>
                </SectionPanel> */}

                <SectionPanel className="xl:col-span-12" icon={MapPinned} title="Parties" meta={`${header.shipper_name || "Shipper pending"} / ${header.consignee_name || "Consignee pending"}`}>
                  <div className="grid gap-1 sm:grid-cols-4">
                    <FormTextarea label="Shipper" value={header.shipper_name} onChange={(value) => setHeaderField("shipper_name", value)} compact />
                    <FormTextarea label="Shipper Address" value={header.shipper_address} onChange={(value) => setHeaderField("shipper_address", value)} compact />
                    <FormTextarea label="Consignee" value={header.consignee_name} onChange={(value) => setHeaderField("consignee_name", value)} compact />
                    <FormTextarea label="Consignee Address" value={header.consignee_address} onChange={(value) => setHeaderField("consignee_address", value)} compact />
                  </div>
                </SectionPanel>

                <SectionPanel className="xl:col-span-12" icon={CreditCard} title="Cargo Notes" meta={header.remarks ? "Remarks added" : "No remarks"}>
                  <div className="grid grid-cols-1">
                    <FormTextarea label="Remarks" value={header.remarks} onChange={(value) => setHeaderField("remarks", value)} compact />
                  </div>
                </SectionPanel>

              </div>
            </section>
          )}
          {activeTab === "journey" && (
            <section>
              <SectionHeading title="Journey" description="Port routing, country movement, and shipment reference" />
              <div className="grid gap-1.5 lg:grid-cols-12">
                <SectionPanel className="lg:col-span-7" icon={MapPinned} title="Routing" meta={`${header.origin_port || "Origin"} -> ${header.destination_port || "Destination"}`}>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <FormLookup label="Port of Loading" value={header.origin_port} valueField="port_code" displayFields={["port_code", "port_name"]} columns={portColumns} loadOptions={() => loadPortLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("origin_port", value, row)} required />
                    <FormLookup label="Port of Destination" value={header.destination_port} valueField="port_code" displayFields={["port_code", "port_name"]} columns={portColumns} loadOptions={() => loadPortLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("destination_port", value, row)} />
                    <FormInput label="Country Origin" value={header.country_origin} onChange={(value) => setHeaderField("country_origin", value)} />
                    <FormInput label="Country Destination" value={header.country_destination} onChange={(value) => setHeaderField("country_destination", value)} />
                  </div>
                </SectionPanel>

                <SectionPanel className="lg:col-span-5" icon={ShipWheel} title="Shipment Reference" meta={header.job_number || "Job pending"}>
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <FormInput label="Via" value={header.via} onChange={(value) => setHeaderField("via", value)} />
                    <FormInput label="Job No" value={header.job_number} onChange={(value) => setHeaderField("job_number", value)} />
                    <FormInput label="Ready Date" type="date" value={header.schedule_date} onChange={(value) => setHeaderField("schedule_date", value)} />
                    {header.transport_mode === "S" && (
                    <>
                    <FormInput label="Shipment Status" value={header.shipment_status} onChange={(value) => setHeaderField("shipment_status", value)} />
                    </>)}
                  </div>
                </SectionPanel>
              </div>
            </section>
          )}

          {activeTab === "carrier" && (
            <section>
              <SectionHeading title="Carrier Details" description="Carrier, forwarder, transit schedule, and sales owner" />
              <div className="grid gap-1.5 lg:grid-cols-12">
                <SectionPanel className="lg:col-span-6" icon={ShipWheel} title="Carrier And Forwarder" meta={`${modeLabel(header.transport_mode)} / ${header.carrier || "Carrier pending"}`}>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <FormLookup key={`carrier-${header.transport_mode}`} label="Carrier" value={header.carrier} {...carrierLookupProps(header.transport_mode, header.company_code)} onChange={(value, row) => applyHeaderLookup("carrier", value, row)} />
                    <FormLookup label="Forwarder" value={header.forwarder_code} valueField="forwarder_code" displayFields={["forwarder_code", "forwarder_name"]} columns={[{ field: "forwarder_code", header: "Code" }, { field: "forwarder_name", header: "Forwarder" }]} loadOptions={() => loadForwarderLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("forwarder_code", value, row)} />
                  </div>
                </SectionPanel>

                <SectionPanel className="lg:col-span-6" icon={Activity} title="Schedule And Sales" meta={header.salesman_code || "Sales executive pending"}>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <FormInput
                      label="Transit Time"
                      type="datetime-local"
                      value={toInputDateTime(header.transit_time)}
                      onChange={(value) => setHeaderField("transit_time", fromInputDateTime(value))}
                      inputClassName="font-semibold"
                    />
                    <FormInput label="Frequency" value={header.frequency} onChange={(value) => setHeaderField("frequency", value)} />
                    <FormLookup label="Sales Executive" value={header.salesman_code} displayValue={headerNames.salesman_name} valueField="salesman_code" displayFields={["salesman_code", "salesman_name"]} columns={[{ field: "salesman_code", header: "Code" }, { field: "salesman_name", header: "Sales Executive" }]} loadOptions={() => loadSalesmanLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("salesman_code", value, row)} />
                    <FormInput label="Ready Date" type="date" value={header.schedule_date} onChange={(value) => setHeaderField("schedule_date", value)} />
                  </div>
                </SectionPanel>
              </div>
            </section>
          )}

          {activeTab === "payment" && (
            <section>
              <SectionHeading title="Payment Terms" description="Commercial terms, currency, references, and instructions" />
              <div className="grid gap-1.5 lg:grid-cols-12">
                <SectionPanel className="lg:col-span-6" icon={CreditCard} title="Terms And Currency" meta={`${header.payment_terms || "Terms"} / ${header.curr_code || "Currency"}`}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FormSelect label="INCO Terms" value={header.payment_terms} onChange={(value) => setHeaderField("payment_terms", value)} options={paymentTerms.map((value) => ({ value, label: value }))} />
                    <FormSelect label="Freight Payable At" value={header.tos} onChange={(value) => setHeaderField("tos", value)} options={tosOptions.map((value) => ({ value, label: value }))} />
                    <FormLookup label="Currency" value={header.curr_code} valueField="curr_code" displayFields={["curr_code", "curr_name"]} columns={[{ field: "curr_code", header: "Code" }, { field: "curr_name", header: "Currency" }, { field: "ex_rate", header: "Rate" }]} loadOptions={() => loadCurrencyLookup(header.company_code)} onChange={(value, row) => applyHeaderLookup("curr_code", value, row)} required />
                    <FormInput label="Exchange Rate" type="number" value={header.ex_rate} onChange={(value) => setHeaderField("ex_rate", value)} required/>
                  </div>
                </SectionPanel>

                <SectionPanel className="lg:col-span-6" icon={PackageCheck} title="Classification" meta={`${header.sale_type || "Sale"} / ${header.job_category || "Category"}`}>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <FormSelect label="Member Type" value={header.member_type} onChange={(value) => setHeaderField("member_type", value)} options={memberTypes.map((value) => ({ value, label: value || "Blank" }))} />
                    <FormSelect label="Sale Type" value={header.sale_type} onChange={(value) => setHeaderField("sale_type", value)} options={saleTypes.map((value) => ({ value, label: value }))} />
                    <FormSelect label="Job Category" value={header.job_category} onChange={(value) => setHeaderField("job_category", value)} options={jobCategories.map((value) => ({ value, label: value }))} />
                  </div>
                </SectionPanel>

                <SectionPanel className="lg:col-span-12" icon={Activity} title="Instructions" meta={header.spl_instructions ? "Added" : "Pending"}>
                  <FormTextarea label="Special Instructions" value={header.spl_instructions} onChange={(value) => setHeaderField("spl_instructions", value)} />
                </SectionPanel>
              </div>
            </section>
          )}

          {activeTab === "activities" && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="m-0 text-sm font-semibold uppercase text-muted-foreground">Activities</h2>
                <Button type="button" size="sm" variant="outline" onClick={addDetail} disabled={isReadOnly}>
                  <Plus size={14} />
                  Add Line
                </Button>
              </div>
              <div className="max-h-[calc(100vh-360px)] overflow-auto rounded-md border">
        <table className="min-w-[1880px] w-full border-collapse text-xs">
                        <thead>
                          <tr className="sticky top-0 z-10 border-b bg-muted text-left text-[11px] uppercase text-muted-foreground">
              <th className="w-[360px] px-1.5 py-1.5 font-semibold">Activity Code</th>
              <th className="w-[120px] px-1.5 py-1.5 font-semibold">Mode</th>
              <th className="w-[130px] px-1.5 py-1.5 font-semibold">Origin</th>
              <th className="w-[130px] px-1.5 py-1.5 font-semibold">Destination</th>
              <th className="w-[90px] px-1.5 py-1.5 font-semibold">Qty</th>
              <th className="w-[90px] px-1.5 py-1.5 font-semibold">UOM</th>
              <th className="w-[310px] px-1.5 py-1.5 font-semibold">Bill Rate</th>
              <th className="w-[310px] px-1.5 py-1.5 font-semibold">Cost Rate</th>
              <th className="w-[290px] px-1.5 py-1.5 font-semibold">Bill</th>
              <th className="w-[290px] px-1.5 py-1.5 font-semibold">Cost</th>
                            <th className="w-[110px] px-1.5 py-1.5 font-semibold">Currency</th>
                            <th className="w-[260px] px-1.5 py-1.5 font-semibold">Remarks</th>
                            <th className="w-12 px-1.5 py-1.5 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((row, index) => (
                      <tr key={row.srno} className="border-b transition hover:bg-primary/5 last:border-0">
                              <td className="px-1.5 py-1.5">
                                <LookupField
                                  compact
                    label="Activity Code"
                                  value={row.act_code}
                                  valueField="activity_code"
                                  displayFields={["activity_code", "activity"]}
                            columns={[
                              { field: "activity_code", header: "Code" },
                              { field: "activity", header: "Activity" },
                              { field: "uom", header: "UOM" },
                              { field: "bill", header: "Bill" },
                              { field: "cost", header: "Cost" },
                                  ]}
                                  loadOptions={() => loadActivityLookup(header.company_code)}
                                  onChange={(value, lookupRow) => applyDetailActivityLookup(index, value, lookupRow)}
                    placeholder="Activity code / name"
                  />
                </td>
                <td className="px-1.5 py-1.5">
                  <div className="flex h-8 w-28 items-center rounded-md border border-primary/20 bg-primary/5 px-2 text-xs font-semibold text-primary">
                    {modeLabel(row.transport_mode || header.transport_mode)}
                  </div>
                </td>
                <CellInput value={row.origin_port} onChange={(value) => setDetailField(index, "origin_port", value)} className="w-32" />
                <CellInput value={row.destination_port} onChange={(value) => setDetailField(index, "destination_port", value)} className="w-32" />
                <CellInput type="number" value={row.quantity} onChange={(value) => setDetailField(index, "quantity", value)} className="w-20 text-right" />
                <CellInput value={row.uom} onChange={(value) => setDetailField(index, "uom", value)} className="w-20" />
                <CellInput type="number" value={row.bill_rate} onChange={(value) => setDetailField(index, "bill_rate", value)} className="w-72 text-right" />
                <CellInput type="number" value={row.cost_rate} onChange={(value) => setDetailField(index, "cost_rate", value)} className="w-72 text-right" />
                <CellInput type="number" value={row.bill} onChange={(value) => setDetailField(index, "bill", value)} className="w-72 text-right" />
                <CellInput type="number" value={row.cost} onChange={(value) => setDetailField(index, "cost", value)} className="w-72 text-right" />
                        <CellInput value={row.curr_code} onChange={(value) => setDetailField(index, "curr_code", value)} className="w-24" />
                        <CellInput value={row.remarks} onChange={(value) => setDetailField(index, "remarks", value)} className="min-w-56" />
                        <td className="px-2 py-2 text-right">
                          <Button type="button" size="icon" variant="ghost" title="Remove line" disabled={isReadOnly || details.length === 1} onClick={() => removeDetail(index)}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>Showing {details.length} activity line{details.length === 1 ? "" : "s"}</span>
                <span>Bill and cost amounts save with the enquiry header</span>
              </div>
            </section>
          )}
        </div>
        </fieldset>
      </div>
    </form>
    <AttachmentDialog
      open={attachmentOpen}
      onClose={() => setAttachmentOpen(false)}
      requestNumber={attachmentRequestNumber}
      relatedRequestNumbers={sourceAttachmentRequestNumbers}
      title={`${enquiryLabel} Attachments`}
      module="FREIGHT"
      type={isRfq ? "FRT_RFQ" : "FRT_ENQUIRY"}
      companyCode={header.company_code}
      loginId={loginId}
      readOnly={!header.enquiry_nr || isCancelled}
    />
    <Dialog
      open={cancelOpen}
      tone="danger"
      compact
      title={`Cancel ${enquiryLabel}`}
      description="This marks the record as cancelled and keeps the enquiry history."
      onClose={() => setCancelOpen(false)}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>Close</Button>
          <Button type="button" variant="destructive" onClick={confirmCancel} disabled={cancelling}>{cancelling ? "Cancelling" : "Confirm Cancel"}</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Delete is not used for enquiries. Cancel will call the Oracle cancel procedure and set the record status to Cancelled.
        </div>
        <label className="grid gap-1 text-xs font-semibold uppercase text-muted-foreground">
          Cancel Remarks
          <Input value={cancelRemarks} onChange={(event) => setCancelRemarks(event.target.value)} placeholder="Enter reason..." />
        </label>
      </div>
    </Dialog>
    </>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { key: EnquiryTab; label: string; icon: typeof PackageCheck };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ui-button ui-button-sm whitespace-nowrap ${
        active
          ? "ui-button-default"
          : "ui-button-outline"
      }`}
    >
      <Icon size={14} />
      {tab.label}
    </button>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="freight-section-heading">
      <h2 className="m-0 text-xs font-semibold uppercase text-slate-700">{title}</h2>
      <p className="m-0 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function FreightAssistPanel({ checks }: { checks: SmartCheck[] }) {
  const ready = checks.every((item) => item.tone === "ok");
  const reviewCount = checks.filter((item) => item.tone !== "ok").length;
  return (
    <section className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card p-1.5 shadow-sm">
      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
        {ready ? <ShieldCheck size={13} /> : <Sparkles size={13} />}
        {ready ? "Ready" : `${reviewCount} review`}
      </span>
      {checks.map((check) => (
        <span
          key={check.title}
          title={check.detail}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold ${
            check.tone === "danger"
              ? "border-red-200 bg-red-50 text-red-800"
              : check.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {check.tone === "ok" ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
          {check.title}
        </span>
      ))}
    </section>
  );
}

function SectionPanel({
  title,
  meta,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  icon: typeof PackageCheck;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`freight-panel overflow-hidden rounded-md border bg-background shadow-sm ${className}`}>
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon size={12} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold uppercase text-foreground">{title}</h3>
            {meta && <p className="m-0 truncate text-[11px] text-muted-foreground">{meta}</p>}
          </div>
        </div>
      </div>
      <div className="freight-panel-body">{children}</div>
    </section>
  );
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-52 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px]">
      <span className="font-semibold uppercase text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </span>
  );
}

function statusBadgeClass(status: string, action = "", finalApproved = "") {
  if (status === "A" || finalApproved === "Y") {
    return "inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700";
  }
  if (status === "C") {
    return "inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700";
  }
  if (status === "R" || action === "REJECTED") {
    return "inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700";
  }
  if (action === "SENTBACK") {
    return "inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700";
  }
  if (action === "SUBMITTED" || action === "APPROVED") {
    return "inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700";
  }
  return "inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700";
}

function statusLabel(status: string, action = "", finalApproved = "") {
  if (status === "A" || finalApproved === "Y") return "Approved";
  if (status === "C") return "Cancelled";
  if (status === "R" || action === "REJECTED") return "Rejected";
  if (action === "SENTBACK") return "Sent Back";
  if (action === "SUBMITTED" || action === "APPROVED") return "In Approval";
  return "Draft";
}

function matchesListStatusTab(row: EnquiryListRow, tab: ListStatusTab) {
  const status = lookupText(row, "indstatus");
  const action = lookupText(row, "last_action");
  const finalApproved = lookupText(row, "final_approved");
  if (tab === "approved") return status === "A" || finalApproved === "Y";
  if (tab === "cancelled") return status === "C";
  if (tab === "rejected") return status === "R" || action === "REJECTED";
  if (tab === "sentback") return action === "SENTBACK";
  if (tab === "draft") return status !== "A" && status !== "C" && status !== "R" && (!action || action === "SAVEASDRAFT");
  if (tab === "in_progress") return status !== "A" && status !== "C" && status !== "R" && ["SUBMITTED", "APPROVED"].includes(action) && finalApproved !== "Y";
  return true;
}

function statusRowClassName(row: EnquiryListRow) {
  const status = lookupText(row, "indstatus");
  const action = lookupText(row, "last_action");
  if (status === "A") return "bg-emerald-50/60";
  if (status === "C" || status === "R") return "bg-red-50/50";
  if (action === "SENTBACK") return "bg-orange-50/50";
  if (action === "SUBMITTED" || action === "APPROVED") return "bg-sky-50/50";
  return "bg-amber-50/50";
}

function workflowLevelText(header: EnquiryHeader) {
  if (header.indstatus === "C") return "Cancelled";
  if (header.indstatus === "R" || header.last_action === "REJECTED") return "Rejected";
  if (header.indstatus === "A" || header.final_approved === "Y") return "Final approved";
  if (header.last_action === "SENTBACK") return header.next_action_by ? `Sent back to ${header.next_action_by}` : "Sent back";
  if (header.last_action === "SUBMITTED" || header.last_action === "APPROVED") {
    const level = header.flow_level_running || "";
    return header.next_action_by ? `Level ${level} - ${header.next_action_by}` : `Level ${level || "-"} pending`;
  }
  return "Draft";
}

function buildSmartChecks(header: EnquiryHeader, details: EnquiryDetail[], isRfq: boolean): SmartCheck[] {
  const activeDetails = details.filter((row) => row.act_code.trim() || row.activity.trim());
  const missingRates = activeDetails.filter((row) => Number(row.bill_rate || 0) <= 0 && Number(row.cost_rate || 0) <= 0).length;
  const offerDate = header.offer_validity ? new Date(`${header.offer_validity}T00:00:00`) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [
    header.prin_code || header.walkin_prin_code
      ? { tone: "ok", title: "Party", detail: "Principal or walk-in principal is selected." }
      : { tone: "danger", title: "Party", detail: "Select principal or walk-in principal before save." },
    header.origin_port && header.destination_port
      ? { tone: "ok", title: "Route", detail: `${header.origin_port} to ${header.destination_port} is ready.` }
      : { tone: "danger", title: "Route", detail: "Origin and destination ports are required for a useful freight enquiry." },
    header.curr_code && Number(header.ex_rate || 0) > 0
      ? { tone: "ok", title: "Currency", detail: `${header.curr_code} exchange rate ${header.ex_rate || "1"}.` }
      : { tone: "danger", title: "Currency", detail: "Currency and exchange rate are required for costing." },
    header.commodity || header.cargo_detail
      ? { tone: "ok", title: "Cargo", detail: "Cargo profile has commodity or details." }
      : { tone: "warn", title: "Cargo", detail: "Add commodity or cargo detail so quotation/job teams know the shipment scope." },
    activeDetails.length
      ? missingRates
        ? { tone: "warn", title: "Activities", detail: `${missingRates} activity line${missingRates === 1 ? "" : "s"} missing bill/cost rates.` }
        : { tone: "ok", title: "Activities", detail: `${activeDetails.length} activity line${activeDetails.length === 1 ? "" : "s"} ready.` }
      : { tone: isRfq ? "warn" : "ok", title: "Activities", detail: isRfq ? "RFQ normally needs activity/rate lines before sending." : "No activity lines added yet." },
    offerDate
      ? offerDate < today
        ? { tone: "warn", title: "Validity", detail: "Offer validity date is already expired." }
        : { tone: "ok", title: "Validity", detail: `Valid until ${formatDisplayDate(header.offer_validity)}.` }
      : { tone: "warn", title: "Validity", detail: "Offer validity is blank." },
    header.shipper_name && header.consignee_name
      ? { tone: "ok", title: "Parties", detail: "Shipper and consignee details are present." }
      : { tone: "warn", title: "Parties", detail: "Add shipper and consignee where available." },
    header.transport_mode === "A" || header.carrier
      ? { tone: "ok", title: "Carrier", detail: header.carrier ? "Carrier selected." : "Carrier can be added later for air enquiry." }
      : { tone: "warn", title: "Carrier", detail: "Carrier/forwarder is still pending." },
  ];
}

function buildInitialHeader(user: Record<string, unknown> | null, target?: FreightWorkspaceTarget, screenType: "enquiry" | "rfq" = "enquiry"): EnquiryHeader {
  const company = String(user?.company_code || user?.COMPANY_CODE || "");
  const mode = target?.mode === "sea" ? "S" : target?.mode === "land" ? "R" : "A";
  const jobType = target?.direction === "import" ? "IMP" : "EXP";
  return {
    company_code: company,
    prin_code: "",
    enquiry_nr: "",
    enquiry_date: toInputDate(new Date()),
    dept_code: "",
    origin_port: "",
    destination_port: "",
    transit_time: "",
    cargo_detail: "",
    frequency: "",
    tos: "ORIGIN",
    commodity: "",
    dimension: "",
    carrier: "",
    weight: "",
    volume: "0",
    remarks: "",
    payment_terms: "CIF",
    curr_code: "OMR",
    ex_rate: "1",
    job_type: jobType,
    transport_mode: mode,
    via: "",
    job_number: "",
    schedule_date: "",
    country_origin: "",
    country_destination: "",
    indstatus: "N",
    enquiry_type: screenType === "rfq" ? "RFQ" : "EQI",
    offer_validity: "",
    spl_instructions: "",
    walkin_prin_code: "",
    salesman_code: "",
    member_type: "",
    sale_type: "Normal",
    shipper_name: "",
    shipper_address: "",
    consignee_name: "",
    consignee_address: "",
    job_category: "Others",
    ref_enquiry_type: "",
    ref_enquiry_nr: "",
    b: "",
    h: "",
    l: "",
    forwarder_code: "",
    gross_wt: "",
    shipment_status: "",
    container_type: "",
    no_of_contaners: "",
    vehicle_type: "",
    t_f: "T",
    flow_level_running: "0",
    flow_level_initial: "0",
    flow_level_final: "0",
    final_approved: "N",
    last_action: "SAVEASDRAFT",
    history_serial: "0",
    next_action_by: "",
    sentback_reason: "",
    reject_reason: "",
    submitted_by: "",
    submitted_date: "",
  };
}

function buildInitialDetail(header: EnquiryHeader, srno: number): EnquiryDetail {
  return {
    srno,
    act_code: "",
    activity: "",
    quantity: "1",
    uom: "",
    bill_rate: "0",
    cost_rate: "0",
    bill: "0",
    cost: "0",
    curr_code: header.curr_code,
    ex_rate: header.ex_rate,
    uoc: "",
    moc1: "",
    moc2: "",
    partners_price: "0",
    fc_cost: "0",
    fc_bill: "0",
    fc_partners: "0",
    fc_costrate: "0",
    fc_billrate: "0",
    origin_port: header.origin_port,
    destination_port: header.destination_port,
    transport_mode: header.transport_mode,
    cost_curr_code: header.curr_code,
    cost_ex_rate: header.ex_rate,
    partners_curr_code: header.curr_code,
    partners_ex_rate: header.ex_rate,
    enquiry_type: header.enquiry_type,
    remarks: "",
  };
}

function toHeaderFromRow(row: LookupRow, user: Record<string, unknown> | null, target: FreightWorkspaceTarget | undefined, screenType: "enquiry" | "rfq"): EnquiryHeader {
  const fallback = buildInitialHeader(user, target, screenType);
  return {
    company_code: lookupText(row, "company_code") || fallback.company_code,
    prin_code: lookupText(row, "prin_code"),
    enquiry_nr: lookupText(row, "enquiry_nr"),
    enquiry_date: toDateInputValue(lookupText(row, "enquiry_date")) || fallback.enquiry_date,
    dept_code: lookupText(row, "dept_code") || fallback.dept_code,
    origin_port: lookupText(row, "origin_port"),
    destination_port: lookupText(row, "destination_port"),
    transit_time: lookupText(row, "transit_time"),
    cargo_detail: lookupText(row, "cargo_detail"),
    frequency: lookupText(row, "frequency"),
    tos: lookupText(row, "tos") || fallback.tos,
    commodity: lookupText(row, "commodity"),
    dimension: lookupText(row, "dimension"),
    carrier: lookupText(row, "carrier"),
    weight: lookupText(row, "weight"),
    volume: lookupText(row, "volume") || fallback.volume,
    remarks: lookupText(row, "remarks"),
    payment_terms: lookupText(row, "payment_terms") || fallback.payment_terms,
    curr_code: lookupText(row, "curr_code") || fallback.curr_code,
    ex_rate: lookupText(row, "ex_rate") || fallback.ex_rate,
    job_type: lookupText(row, "job_type") || fallback.job_type,
    transport_mode: lookupText(row, "transport_mode") || fallback.transport_mode,
    via: lookupText(row, "via"),
    job_number: lookupText(row, "job_number"),
    schedule_date: toDateInputValue(lookupText(row, "schedule_date")),
    country_origin: lookupText(row, "country_origin"),
    country_destination: lookupText(row, "country_destination"),
    indstatus: lookupText(row, "indstatus") || fallback.indstatus,
    enquiry_type: lookupText(row, "enquiry_type") || fallback.enquiry_type,
    offer_validity: toDateInputValue(lookupText(row, "offer_validity")),
    spl_instructions: lookupText(row, "spl_instructions"),
    walkin_prin_code: lookupText(row, "walkin_prin_code"),
    salesman_code: lookupText(row, "salesman_code"),
    member_type: lookupText(row, "member_type"),
    sale_type: lookupText(row, "sale_type") || fallback.sale_type,
    shipper_name: lookupText(row, "shipper_name"),
    shipper_address: lookupText(row, "shipper_address"),
    consignee_name: lookupText(row, "consignee_name"),
    consignee_address: lookupText(row, "consignee_address"),
    job_category: lookupText(row, "job_category") || fallback.job_category,
    ref_enquiry_type: lookupText(row, "ref_enquiry_type"),
    ref_enquiry_nr: lookupText(row, "ref_enquiry_nr"),
    b: lookupText(row, "b"),
    h: lookupText(row, "h"),
    l: lookupText(row, "l"),
    forwarder_code: lookupText(row, "forwarder_code"),
    gross_wt: lookupText(row, "gross_wt"),
    shipment_status: lookupText(row, "shipment_status"),
    container_type: lookupText(row, "container_type"),
    no_of_contaners: lookupText(row, "no_of_contaners"),
    vehicle_type: lookupText(row, "vehicle_type"),
    t_f: lookupText(row, "t_f") || fallback.t_f,
    flow_level_running: lookupText(row, "flow_level_running") || fallback.flow_level_running,
    flow_level_initial: lookupText(row, "flow_level_initial") || fallback.flow_level_initial,
    flow_level_final: lookupText(row, "flow_level_final") || fallback.flow_level_final,
    final_approved: lookupText(row, "final_approved") || fallback.final_approved,
    last_action: lookupText(row, "last_action") || fallback.last_action,
    history_serial: lookupText(row, "history_serial") || fallback.history_serial,
    next_action_by: lookupText(row, "next_action_by"),
    sentback_reason: lookupText(row, "sentback_reason"),
    reject_reason: lookupText(row, "reject_reason"),
    submitted_by: lookupText(row, "submitted_by"),
    submitted_date: toDateInputValue(lookupText(row, "submitted_date")),
  };
}

function toDetailFromRow(row: LookupRow, header: EnquiryHeader, srno: number): EnquiryDetail {
  return {
    ...buildInitialDetail(header, srno),
    srno: Number(lookupText(row, "srno") || lookupText(row, "sr_no") || srno),
    act_code: lookupText(row, "act_code"),
    activity: lookupText(row, "activity"),
    quantity: lookupText(row, "quantity") || "1",
    uom: lookupText(row, "uom"),
    bill_rate: lookupText(row, "bill_rate") || "0",
    cost_rate: lookupText(row, "cost_rate") || "0",
    bill: lookupText(row, "bill") || "0",
    cost: lookupText(row, "cost") || "0",
    curr_code: lookupText(row, "curr_code") || header.curr_code,
    ex_rate: lookupText(row, "ex_rate") || header.ex_rate,
    uoc: lookupText(row, "uoc"),
    moc1: lookupText(row, "moc1"),
    moc2: lookupText(row, "moc2"),
    partners_price: lookupText(row, "partners_price") || "0",
    fc_cost: lookupText(row, "fc_cost") || "0",
    fc_bill: lookupText(row, "fc_bill") || "0",
    fc_partners: lookupText(row, "fc_partners") || "0",
    fc_costrate: lookupText(row, "fc_costrate") || "0",
    fc_billrate: lookupText(row, "fc_billrate") || "0",
    origin_port: lookupText(row, "origin_port") || header.origin_port,
    destination_port: lookupText(row, "destination_port") || header.destination_port,
    transport_mode: lookupText(row, "transport_mode") || header.transport_mode,
    cost_curr_code: lookupText(row, "cost_curr_code") || header.curr_code,
    cost_ex_rate: lookupText(row, "cost_ex_rate") || header.ex_rate,
    partners_curr_code: lookupText(row, "partners_curr_code") || header.curr_code,
    partners_ex_rate: lookupText(row, "partners_ex_rate") || header.ex_rate,
    enquiry_type: lookupText(row, "enquiry_type") || header.enquiry_type,
    remarks: lookupText(row, "remarks"),
  };
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  className = "",
  disabled,
  inputClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputClassName?: string;
}) {
  return (
    // <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground ${className}`}>
      <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
        {label}
      <Input
        className={`h-7 text-[11px] ${inputClassName}`}
        value={value}
        type={type}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLInputElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLInputElement).setCustomValidity("")}
      />
    </label>
  );
}

function StatusField({ status, action = "", finalApproved = "" }: { status: string; action?: string; finalApproved?: string }) {
  return (
    <div className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
      Status
      <div className="flex h-7 items-center rounded-md border border-input bg-muted/40 px-2">
        <span className={statusBadgeClass(status, action, finalApproved)}>{statusLabel(status, action, finalApproved)}</span>
      </div>
    </div>
  );
}

function TypeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
      {label}
      <div className="flex h-7 items-center rounded-md border border-input bg-muted/40 px-2 text-[11px] font-semibold text-foreground">
        {value || "-"}
      </div>
    </div>
  );
}

function FormLookup({
  label,
  value,
  displayValue,
  valueField,
  displayFields,
  columns,
  loadOptions,
  onChange,
  required,
  className = "",
}: {
  label: string;
  value: string;
  displayValue?: string;
  valueField: string;
  displayFields: string[];
  columns: Array<{ field: string; header: string }>;
  loadOptions: () => Promise<LookupRow[]>;
  onChange: (value: string, row: LookupRow | null) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    // <div className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground ${className}`}>
    <div className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
    <span>
       {label} {required && <span style={{ color: "#E24B4A" }}>*</span>}
     </span>
      <LookupField
        compact
        label={label}
        value={value}
        displayValue={displayValue}
        columns={columns}
        valueField={valueField}
        displayFields={displayFields}
        loadOptions={loadOptions}
        onChange={onChange}
        required={required}
        enforceRequired={required}
        placeholder={`Select ${label}`}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
   required?: boolean;
}) {
  return (
    // <label className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
    //   <span> {label} {required && <span style={{ color: "#E24B4A" }}>*</span>} </span>
    //   <select className={fieldClassName} value={value} required={required} onChange={(event) => onChange(event.target.value)}>
    //     {options.map((option) => (
    //       <option key={option.value} value={option.value}>
    //         {option.label}
    //       </option>
    //     ))}
    //   </select>
    // </label>

    //  <label className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
     <label className="grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label">
    <span> {label} {required && <span style={{ color: "#E24B4A" }}>*</span>} </span>
      <select
        className={fieldClassName}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={(event) => (event.target as HTMLSelectElement).setCustomValidity(`${label} is required`)}
        onInput={(event) => (event.target as HTMLSelectElement).setCustomValidity("")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>

  );
}

function FormTextarea({
  label,
  value,
  onChange,
  compact,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    // <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground ${className}`}>
     <label className={`grid gap-0.5 text-[11px] font-semibold uppercase text-muted-foreground freight-field-label ${className}`}>
       {label}
      <textarea className={`${fieldClassName} ${compact ? "min-h-8" : "min-h-10"} resize-y py-1`} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CellInput({
  value,
  onChange,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <td className="px-1.5 py-1.5">
      {/* <Input className={`h-7 text-xs ${className}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} /> */}
     <Input className={`h-7 text-sm font-medium text-foreground ${className}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </td>
  );
}

function modeLabel(mode: string) {
  if (mode === "S") return "Sea";
  if (mode === "R") return "Road";
  return "Air";
}

function jobTypeLabel(jobType: string) {
  if (jobType === "IMP") return "Import";
  if (jobType === "EXP") return "Export";
  return jobType || "-";
}

const portColumns = [
  { field: "port_code", header: "Code" },
  { field: "port_name", header: "Port" },
  { field: "country_name", header: "Country" },
];

function carrierLookupProps(mode: string, companyCode: string) {
  if (mode === "S") {
    return {
      valueField: "vessel_code",
      displayFields: ["vessel_code", "vessel_name"],
      columns: [
        { field: "vessel_code", header: "Code" },
        { field: "vessel_name", header: "Vessel" },
      ],
      loadOptions: () => loadCarrierLookup(companyCode, mode),
    };
  }
  if (mode === "R") {
    return {
      valueField: "vehicle_no",
      displayFields: ["vehicle_no", "vehicle_desc"],
      columns: [
        { field: "vehicle_no", header: "Vehicle" },
        { field: "vehicle_desc", header: "Description" },
      ],
      loadOptions: () => loadCarrierLookup(companyCode, mode),
    };
  }
  return {
    valueField: "airline_code",
    displayFields: ["airline_code", "airline_name"],
    columns: [
      { field: "airline_code", header: "Code" },
      { field: "airline_name", header: "Airline" },
    ],
    loadOptions: () => loadCarrierLookup(companyCode, mode),
  };
}

async function loadPrincipalLookup(companyCode: string) {
  return loadFreightLookup("freight_principal", companyCode);
}

async function loadWalkinPrincipalLookup(companyCode: string) {
  return loadFreightLookup("freight_walkin_principal", companyCode);
}

async function loadDepartmentLookup(companyCode: string) {
  return loadFreightLookup("freight_department", companyCode);
}

async function loadCommodityLookup(companyCode: string) {
  return loadFreightLookup("freight_commodity", companyCode);
}

async function loadPortLookup(companyCode: string) {
  return loadFreightLookup("freight_port", companyCode);
}

async function loadCurrencyLookup(companyCode: string) {
  return loadFreightLookup("freight_currency", companyCode);
}

async function loadSalesmanLookup(companyCode: string) {
  return loadFreightLookup("freight_salesman", companyCode);
}

async function loadForwarderLookup(companyCode: string) {
  return loadFreightLookup("freight_forwarder", companyCode);
}

async function loadVehicleTypeLookup(companyCode: string) {
  return loadFreightLookup("freight_vehicle_type", companyCode);
}

async function loadCarrierLookup(companyCode: string, mode: string) {
  if (mode === "S") {
    return loadFreightLookup("freight_vessel", companyCode);
  }
  if (mode === "R") {
    return loadFreightLookup("freight_vehicle", companyCode);
  }
  return loadFreightLookup("freight_airline", companyCode);
}

async function loadActivityLookup(companyCode: string) {
  return loadFreightLookup("freight_activity", companyCode);
}

async function loadReferenceEnquiryLookup(companyCode: string) {
  return loadFreightLookup("freight_approved_enquiry", companyCode);
}

async function loadFreightLookup(parameter: string, companyCode: string, query = "") {
  const rows = await freightSelect<LookupRow>({ parameter, code1: companyCode, code2: query || "NULL", number1: 50 });
  return Array.isArray(rows) ? rows.map(normalizeLookupRow) : [];
}

function normalizeLookupRow(row: LookupRow): LookupRow {
  const normalized: LookupRow = { ...row };
  Object.entries(row || {}).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = value;
  });
  return normalized;
}

function lookupText(row: LookupRow, field: string) {
  return String(getLookupValue(row, field) ?? "").trim();
}

function multiplyText(quantity: string, rate: string) {
  const total = Number(quantity || 0) * Number(rate || 0);
  if (!Number.isFinite(total)) return "0";
  return total.toFixed(3).replace(/\.?0+$/, "");
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDateInputValue(input: string) {
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const match = input.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return "";
}

function toInputDateTime(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (isoMatch) return `${isoMatch[1]}T${isoMatch[2]}`;

  const ymdMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (ymdMatch) return `${ymdMatch[1]}T00:00`;

  const dmyMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (dmyMatch) {
    const [, day, month, year, hour = "00", minute = "00"] = dmyMatch;
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function fromInputDateTime(value: string) {
  return value ? value.replace("T", " ") : "";
}

function formatDisplayDate(input: string) {
  if (!input) return "";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString("en-GB");
}

const fieldClassName =
  "flex h-7 w-full rounded-md border border-input bg-background px-2 py-0.5 text-[11px] text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
