import React, { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  Plus,
  Trash2,
  Ship,
  Plane,
  Truck,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  FileSearch,
  ExternalLink,
} from "lucide-react";
import { api } from "../../api/client";
import { useAuth } from "../../state/AuthContext";

interface ExtractedContainer {
  container_no: string;
  seal_no?: string;
  size?: string;
  is_valid_iso: boolean;
}

interface ParsedDocData {
  detected_type: "CFS_TRANSFER" | "BILL_OF_LADING" | "AIR_WAYBILL" | "CUSTOMS_BAYAN" | "GENERAL_SHIPPING";
  bl_number: string | null;
  transfer_request_number: string | null;
  invoice_number: string | null;
  containers: ExtractedContainer[];
  container_count: number;
  status: string | null;
  status_ok: boolean;
  port_name: string | null;
  port_code: string | null;
  suggested_job_type: "CFS" | "IMP" | "EXP";
  suggested_transport_mode: "SEA" | "AIR" | "LAND";
  raw_text_snippet: string;
}

interface LookupItem {
  PRIN_CODE?: string;
  PRIN_NAME?: string;
  CUST_CODE?: string;
  CUST_NAME?: string;
  PORT_CODE?: string;
  PORT_NAME?: string;
}

export const FreightSmartJobCreationDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onJobCreated?: (jobNo: string) => void;
}> = ({ open, onClose, onJobCreated }) => {
  const { user } = useAuth();
  const companyCode = (user as any)?.company_code || "BSG";

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Extracted Data Form State
  const [parsed, setParsed] = useState<ParsedDocData | null>(null);
  const [blNumber, setBlNumber] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [jobType, setJobType] = useState<string>("IMP");
  const [transportMode, setTransportMode] = useState<string>("SEA");
  const [portCode, setPortCode] = useState<string>("SOH");
  const [prinCode, setPrinCode] = useState<string>("");
  const [custCode, setCustCode] = useState<string>("");
  const [containers, setContainers] = useState<ExtractedContainer[]>([]);

  // Lookups loaded from parsing response
  const [principals, setPrincipals] = useState<LookupItem[]>([]);
  const [customers, setCustomers] = useState<LookupItem[]>([]);
  const [ports, setPorts] = useState<LookupItem[]>([]);

  // Submission State
  const [creating, setCreating] = useState(false);
  const [createdJobNo, setCreatedJobNo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");

  // File Drop / Selection Handler
  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile || selectedFile.type !== "application/pdf") {
      setParseError("Please select a valid PDF file");
      return;
    }
    setFile(selectedFile);
    setParseError(null);
    setParsing(true);
    setCreatedJobNo(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("company_code", companyCode);

      const res = await api.post("/api/freight/tracker/smart-doc/parse", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data.data) {
        const d: ParsedDocData = res.data.data;
        setParsed(d);
        setBlNumber(d.bl_number || "");
        setRefNumber(d.transfer_request_number || d.invoice_number || "");
        setJobType(d.suggested_job_type || (d.detected_type === "CFS_TRANSFER" ? "CFS" : "IMP"));
        setTransportMode(d.suggested_transport_mode || "SEA");
        setPortCode(d.port_code || "SOH");
        setContainers(d.containers || []);

        if (res.data.lookups) {
          const lkPrins = res.data.lookups.principals || [];
          const lkCusts = res.data.lookups.customers || [];
          const lkPorts = res.data.lookups.ports || [];
          setPrincipals(lkPrins);
          setCustomers(lkCusts);
          setPorts(lkPorts);

          if (lkPrins.length > 0) setPrinCode(lkPrins[0].PRIN_CODE || "");
          if (lkCusts.length > 0) setCustCode(lkCusts[0].CUST_CODE || "");
        }
      } else {
        setParseError(res.data?.message || "Failed to extract text from document");
      }
    } catch (err: any) {
      setParseError(err.response?.data?.message || "Document parsing error: please check PDF format");
    } finally {
      setParsing(false);
    }
  };

  const openPdfPreview = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPdfBlobUrl(url);
    setPdfPreviewOpen(true);
  };

  const handleCreateJob = async () => {
    if (!blNumber.trim()) {
      setParseError("B/L Number is required");
      return;
    }
    if (!prinCode) {
      setParseError("Please select a Principal");
      return;
    }
    if (!custCode) {
      setParseError("Please select a Customer");
      return;
    }

    setCreating(true);
    setParseError(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      }
      formData.append("company_code", companyCode);
      formData.append("prin_code", prinCode);
      formData.append("cust_code", custCode);
      formData.append("job_type", jobType);
      formData.append("transport_mode", transportMode);
      formData.append("bl_number", blNumber.trim());
      formData.append("transfer_request_number", refNumber.trim());
      formData.append("port_code", portCode);
      formData.append("containers", JSON.stringify(containers));
      formData.append("user_id", user?.loginid || "ADMIN");

      const res = await api.post("/api/freight/tracker/smart-doc/create-job", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data.data?.job_no) {
        setCreatedJobNo(res.data.data.job_no);
        if (onJobCreated) {
          onJobCreated(res.data.data.job_no);
        }
      } else {
        setParseError(res.data?.message || "Failed to create verified freight job");
      }
    } catch (err: any) {
      setParseError(err.response?.data?.message || "Failed to create verified freight job");
    } finally {
      setCreating(false);
    }
  };

  const addContainerRow = () => {
    setContainers((prev) => [
      ...prev,
      { container_no: "", seal_no: "", size: "40", is_valid_iso: false },
    ]);
  };

  const removeContainerRow = (idx: number) => {
    setContainers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateContainerRow = (idx: number, field: string, val: string) => {
    setContainers((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const updated = { ...c, [field]: val };
        if (field === "container_no") {
          updated.is_valid_iso = val.trim().length === 11;
        }
        return updated;
      })
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Smart Shipping Document Ingestion & Auto Job Creation
                </h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {companyCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload Oman eCustoms Transfer Request, Shipping Line B/L, or Sea/Air Waybill. The AI engine parses text, validates ISO containers, and creates an official Freight Job.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {parseError && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* STEP 1: SUCCESS STATE (Job Created) */}
          {createdJobNo ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                Freight Job Created Successfully!
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Document verified, {containers.length} container(s) registered in ERP inventory, and live shipment tracking initialized.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-mono font-bold text-emerald-800 shadow-xs dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                <span>JOB NO: {createdJobNo}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdJobNo);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Copy Job Number"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                </button>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreatedJobNo(null);
                    setFile(null);
                    setParsed(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Ingest Another Document
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
                >
                  <span>Open in Live Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* DROPZONE */}
              {!parsed && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
                    parsing
                      ? "border-blue-400 bg-blue-50/40 dark:border-blue-700 dark:bg-blue-950/20"
                      : "border-slate-300 bg-slate-50/60 hover:border-blue-500 hover:bg-blue-50/20 dark:border-slate-700 dark:bg-slate-800/40"
                  }`}
                >
                  {parsing ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                      <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                        Analyzing Document Structure & Extracting Metadata...
                      </p>
                      <p className="text-xs text-slate-500">
                        Running OCR text parsing, B/L detection, and ISO 6346 container check digit validation
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        <Upload className="h-7 w-7" />
                      </div>
                      <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                        Drag & Drop Shipping PDF Document Here
                      </h4>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Supports Oman eCustoms Transfer Requests, Shipping Line B/Ls, and Sea/Air Waybills (PDF up to 25MB)
                      </p>

                      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700">
                        <FileSearch className="h-4 w-4" />
                        <span>Select PDF Document</span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileChange(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* STEP 2: VERIFICATION & EDIT PANEL */}
              {parsed && (
                <div className="space-y-4">
                  {/* Document Badge & Preview Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {file?.name}
                          </span>
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                            {parsed.detected_type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          {parsed.status_ok ? (
                            <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {parsed.status || "Status Verified"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {parsed.status || "Status check required"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openPdfPreview}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-600" />
                        <span>Preview PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setParsed(null);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Upload different document"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Form Grid */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* B/L Number */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        B/L Number / Transport Doc No *
                      </label>
                      <input
                        type="text"
                        value={blNumber}
                        onChange={(e) => setBlNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. MEDUO9505266"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    {/* Reference / Transfer Request No */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Transfer Request / Ref Number
                      </label>
                      <input
                        type="text"
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. TR-2026-9812"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    {/* Port Code */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Port of Discharge / Clearance
                      </label>
                      <select
                        value={portCode}
                        onChange={(e) => setPortCode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="SOH">Sohar Port (SOH)</option>
                        <option value="MCT">Port Sultan Qaboos (MCT)</option>
                        <option value="SLL">Salalah Port (SLL)</option>
                        <option value="DQM">Duqm Port (DQM)</option>
                        {ports.map((p) => (
                          <option key={p.PORT_CODE} value={p.PORT_CODE}>
                            {p.PORT_NAME} ({p.PORT_CODE})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Job Type */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Job Flow Type
                      </label>
                      <select
                        value={jobType}
                        onChange={(e) => setJobType(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="IMP">Ocean / Air Import (IMP)</option>
                        <option value="CFS">CFS Bonded Transfer (CFS)</option>
                        <option value="EXP">Export (EXP)</option>
                      </select>
                    </div>

                    {/* Principal */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Shipper / Principal *
                      </label>
                      <select
                        value={prinCode}
                        onChange={(e) => setPrinCode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {principals.length === 0 && <option value="PRIN01">Standard Freight Principal</option>}
                        {principals.map((p) => (
                          <option key={p.PRIN_CODE} value={p.PRIN_CODE}>
                            {p.PRIN_NAME || p.PRIN_CODE}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Customer */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Consignee / Customer *
                      </label>
                      <select
                        value={custCode}
                        onChange={(e) => setCustCode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {customers.length === 0 && <option value="CUST01">Standard Consignee Customer</option>}
                        {customers.map((c) => (
                          <option key={c.CUST_CODE} value={c.CUST_CODE}>
                            {c.CUST_NAME || c.CUST_CODE}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Containers Inventory List */}
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Extracted Containers Inventory ({containers.length})
                        </h4>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          ISO 6346 Checked
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={addContainerRow}
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Container</span>
                      </button>
                    </div>

                    {containers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No containers extracted from this document. Click "Add Container" to enter manually.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {containers.map((cntr, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-800/40"
                          >
                            <span className="w-6 text-center font-mono text-[11px] font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={cntr.container_no}
                                onChange={(e) => updateContainerRow(idx, "container_no", e.target.value.toUpperCase())}
                                placeholder="CONTAINER NO (e.g. MEDU1234567)"
                                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                            <div className="w-32">
                              <input
                                type="text"
                                value={cntr.seal_no || ""}
                                onChange={(e) => updateContainerRow(idx, "seal_no", e.target.value)}
                                placeholder="SEAL NO"
                                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                            <div className="w-24">
                              <select
                                value={cntr.size || "40"}
                                onChange={(e) => updateContainerRow(idx, "size", e.target.value)}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              >
                                <option value="20">20 ft</option>
                                <option value="40">40 ft</option>
                                <option value="45">45 ft</option>
                              </select>
                            </div>
                            <div className="w-8 flex justify-center">
                              {cntr.is_valid_iso ? (
                                <span title="Valid ISO 6346 Container Number">
                                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                </span>
                              ) : (
                                <span title="Check-digit validation failed or custom container code">
                                  <AlertCircle className="h-4 w-4 text-amber-500" />
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeContainerRow(idx)}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Submit Action Bar */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setParsed(null);
                      }}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancel & Choose Different File
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateJob}
                      disabled={creating || !blNumber.trim()}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Creating Job & Registering Inventory...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Verify & Create Freight ERP Job (1-Click)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>

      {/* In-App PDF Preview Dialog */}
      {pdfPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  Document Preview: {file?.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {pdfBlobUrl && (
                  <a
                    href={pdfBlobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open in Tab</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPdfPreviewOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2">
              <iframe
                title="Smart Document Preview"
                src={pdfBlobUrl}
                className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

