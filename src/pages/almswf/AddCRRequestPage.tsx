import { useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Save,
  Send,
  X,
  ChevronLeft,
  FileText,
  Paperclip,
  Loader2,
  ClipboardList,
  MapPin,
  Landmark,
  CreditCard,
  Layers,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Badge } from "../../components/ui/Badge";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { CardContent, CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { almsCommonSelect } from "../../api/alms";
import { executeDynamicMutationColumn90 } from "../../api/lookups";
import { AttachmentDialog } from "../../components/ui/AttachmentDialog";

// ─── Type ─────────────────────────────────────────────────────────────────
export type TCRHeader = {
  REQUEST_NUMBER?: string;
  REQUEST_DATE?: string | Date;
  DESCRIPTION?: string;
  REMARKS?: string;
  DEPARTMENT_CODE?: string;
  FLOW_CODE?: string;
  FLOW_LEVEL_INITIAL?: number;
  FLOW_LEVEL_RUNNING?: number;
  FLOW_LEVEL_FINAL?: number;
  FINAL_APPROVED?: string;
  CREATE_USER?: string;
  CREATE_DATE?: string | Date;
  LAST_ACTION?: string;
  HISTORY_SERIAL?: number;

  COMPANY_NAME?: string;
  AWARE_CUSTOMER_CODE?: string;
  WAY_NO?: string;
  BLDG_NO?: string;
  FLAT_NO?: string;
  LOCATION?: string;
  PO_BOX?: string;
  POSTAL_CODE?: number;
  CITY?: string;
  OFFICE_TEL_NO?: string;
  FAX_NO?: string;
  WEBSITE?: string;
  EMAIL?: string;

  CREDIT_LIMIT?: number;
  REQUESTED_CREDIT_PERIOD?: number;

  FIN_CONTACT_PERSON?: string;
  FIN_CONTACT_NUMBER?: string;
  FIN_CONTACT_EMAIL?: string;

  COMMERCIAL_REG_NO?: string;
  BUSINESS_SECTOR?: string;

  REMARKS_CONTACT_PERSON?: string;
  AUTHORIZED_SIGNATORY?: string;

  CREDIT_FORM_SIGNATURE_DATE?: string | Date;
  SANCTIONED_CREDIT_LIMIT_AMT?: number;
  SANCTIONED_CREDIT_PERIOD?: number;

  COMMENTS?: string;
  ATTACHMENT?: string;

  ACCOUNT_ENV_TMS?: "Y" | "N" | string;
  ACCOUNT_ENV_WMS?: "Y" | "N" | string;
  ACCOUNT_ENV_FREIGHT?: "Y" | "N" | string;
  ACCOUNT_NO?: string;
};

type ActionKey = "draft" | "submit" | "reject" | "sendBack" | "cancel";

type AddCRRequestPageProps = {
  isEditMode: boolean;
  isViewMode?: boolean;
  isPendingTab?: boolean;
  existingData?: { request_number?: string };
  onClose: (refresh?: boolean, message?: string) => void;
};


const Required = () => <span className="ml-0.5 text-destructive">*</span>;

const GRID_4 = "grid grid-cols-1 gap-0.5 p-1 md:grid-cols-2 xl:grid-cols-4";


const TEXTAREA_CLS =
  "min-h-[56px] w-full resize-y rounded-md border bg-background px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60";

type SectionCardProps = {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
};


const SectionCard = ({ icon: Icon, title, hint, children }: SectionCardProps) => (
  <div className="shrink-0 rounded-xl border bg-card shadow-sm">
    <div className="flex items-center justify-between gap-3 rounded-t-xl border-b bg-gradient-to-r from-slate-50 to-white px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00378C] text-white shadow-sm">
          <Icon size={16} />
        </span>
        <h3 className="m-0 text-sm font-semibold leading-tight">{title}</h3>
      </div>
      {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </div>
    {children}
  </div>
);

const AddCRRequestPage = ({
  isEditMode,
  isViewMode = false,
  isPendingTab = true,
  existingData,
  onClose,
}: AddCRRequestPageProps) => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestNumber] = useState<string | undefined>(existingData?.request_number);
  const [header, setHeader] = useState<Partial<TCRHeader>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const isCancelled = String(header.LAST_ACTION || "").toUpperCase() === "CANCELED";
  const disabled = isViewMode || saving || isCancelled;
  const canTakeAction = !isViewMode && isPendingTab && !isCancelled;
  const canSendBackOrReject = canTakeAction && isEditMode && !!requestNumber;
  const busy = saving || actionLoading !== null;

  const { data: hdrList = [], isLoading: hdrLoading, isError: hdrError } = useQuery<TCRHeader[]>({
    queryKey: ["cr-header", requestNumber, companyCode],
    queryFn: () =>
      almsCommonSelect<TCRHeader>({
        parameter: "Amlspf_VW_CR_PAGE",
        loginid,
        code1: companyCode,
        code2: requestNumber,
      }),
    enabled: (isEditMode || isViewMode) && !!requestNumber,
  });

  useEffect(() => {
    if (hdrList.length > 0) setHeader(hdrList[0]);
    if (!(isEditMode || isViewMode) || !hdrLoading) setLoading(false);
  }, [hdrList, hdrLoading, isEditMode, isViewMode]);

  const setHdr = (field: keyof TCRHeader, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));


  const envSelected = [
    header.ACCOUNT_ENV_TMS === "Y" && "TMS",
    header.ACCOUNT_ENV_WMS === "Y" && "WMS",
    header.ACCOUNT_ENV_FREIGHT === "Y" && "FREIGHT",
  ].filter(Boolean) as string[];

  const saveHeader = async (status: string, extra: Record<string, unknown> = {}) =>
    executeDynamicMutationColumn90({
      parameter: "capex_req_ins_upd",
      loginid,
      val1s1: requestNumber || "",
      val1s2: companyCode,
      val1s3: header.REQUEST_DATE ? String(header.REQUEST_DATE).slice(0, 10) : "",
      val1s4: header.DESCRIPTION || "",
      val1s5: header.REMARKS || "",
      val1s6: header.DEPARTMENT_CODE || "",
      val1s7: header.FLOW_CODE || "CR",
      val1s8: loginid,
      val1s9: header.FINAL_APPROVED || "",
      val1s10: header.CREATE_USER || loginid,
      val1s11: loginid,
      val1s12: status,
      val1s13: header.FAX_NO || "",

      val1s18: header.COMPANY_NAME || "",
      val1s19: header.AWARE_CUSTOMER_CODE || "",
      val1s20: header.WAY_NO || "",
      val1s21: header.BLDG_NO || "",
      val1s22: header.FLAT_NO || "",
      val1s23: header.LOCATION || "",
      val1s24: header.PO_BOX || "",
      val1s25: header.CITY || "",
      val1s26: header.OFFICE_TEL_NO || "",
      val1s27: header.WEBSITE || "",
      val1s28: header.EMAIL || "",

      val1s29: header.REMARKS_CONTACT_PERSON || "",
      val1s30: header.FIN_CONTACT_NUMBER || "",
      val1s31: header.FIN_CONTACT_EMAIL || "",
      val1s32: header.COMMERCIAL_REG_NO || "",
      val1s33: header.BUSINESS_SECTOR || "",
      val1s34: header.FIN_CONTACT_PERSON || "",
      val1s35: header.AUTHORIZED_SIGNATORY || "",
      val1s36: header.CREDIT_FORM_SIGNATURE_DATE
        ? String(header.CREDIT_FORM_SIGNATURE_DATE).slice(0, 10)
        : "",

      val1s37: header.COMMENTS || "",
      val1s38: header.ATTACHMENT || "",

      val1s39: header.ACCOUNT_ENV_TMS === "Y" ? "Y" : "N",
      val1s40: header.ACCOUNT_ENV_WMS === "Y" ? "Y" : "N",
      val1s41: header.ACCOUNT_ENV_FREIGHT === "Y" ? "Y" : "N",
      val1s42: header.ACCOUNT_NO || "",

      val1s43: loginid,
      val1s44: loginid,
      val1s45: "",
      val1s46: "",
      val1s47: "",

      val1n1: header.FLOW_LEVEL_INITIAL || 1,
      val1n2: header.FLOW_LEVEL_RUNNING || 1,
      val1n3: header.FLOW_LEVEL_FINAL || 3,
      val1n4: header.HISTORY_SERIAL || 0,
      val1n6: header.POSTAL_CODE || 0,
      val1n7: header.CREDIT_LIMIT || 0,
      val1n8: header.REQUESTED_CREDIT_PERIOD || 0,
      val1n9: header.SANCTIONED_CREDIT_LIMIT_AMT || 0,
      val1n10: header.SANCTIONED_CREDIT_PERIOD || 0,

      ...extra,
    });

  const validateTel = () => {
    if (header.FIN_CONTACT_NUMBER && header.FIN_CONTACT_NUMBER.length !== 10) {
      setNotice({ type: "error", message: "Tel No must be exactly 10 digits" });
      return false;
    }
    return true;
  };

  const execute = async (
    key: ActionKey,
    status: string,
    successMsg: string,
    extra: Record<string, unknown> = {},
    afterOk?: () => void
  ) => {
    setActionLoading(key);
    setSaving(true);
    setNotice(null);
    setDialogError("");
    try {
      const result = await saveHeader(status, extra);
      if (result.success) {
        afterOk?.();
        onClose(true, successMsg);
      } else {
        const msg = (result as any).message || "Action failed";

        if (rejectOpen || sendBackOpen) setDialogError(msg);
        else setNotice({ type: "error", message: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      if (rejectOpen || sendBackOpen) setDialogError(msg);
      else setNotice({ type: "error", message: msg });
    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  };

  const handleSaveDraft = () => {
    if (validateTel()) void execute("draft", "SAVEASDRAFT", "Draft saved successfully!");
  };
  const handleSubmit = () => {
    if (validateTel()) void execute("submit", "SUBMITTED", "CR submitted successfully!");
  };

  const handleRejectConfirm = () => {
    if (!remarkText.trim()) return setDialogError("Please enter a reject remark");
    void execute("reject", "REJECTED", "CR rejected successfully!", { val1s47: remarkText.trim() }, () =>
      setRejectOpen(false)
    );
  };
  const handleSendBackConfirm = () => {
    if (!remarkText.trim()) return setDialogError("Please enter a send back reason");
    void execute("sendBack", "SENTBACK", "CR sent back successfully!", { val1s46: remarkText.trim() }, () =>
      setSendBackOpen(false)
    );
  };
  const handleCancelConfirm = () => {
    void execute("cancel", "CANCELED", "CR canceled successfully!", {}, () => setCancelOpen(false));
  };

  const openReject = () => {
    setRemarkText("");
    setDialogError("");
    setRejectOpen(true);
  };
  const openSendBack = () => {
    setRemarkText("");
    setDialogError("");
    setSendBackOpen(true);
  };
  const closeReject = () => {
    if (actionLoading === "reject") return;
    setRejectOpen(false);
    setDialogError("");
  };
  const closeSendBack = () => {
    if (actionLoading === "sendBack") return;
    setSendBackOpen(false);
    setDialogError("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <section
        className={`finance-document-ui payment-workbench commercial-editor grid h-full min-h-0 ${isCancelled ? "is-cancelled grid-rows-[auto_auto_minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)]"
          }`}
      >
        <CardHeader className="commercial-command-header h-auto overflow-visible border-b bg-primary px-4 pb-2 pt-3 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                {isViewMode ? "View Document" : isEditMode ? "Edit Document" : "New Document"}
              </p>
              <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">
                Credit Request {requestNumber ? `— ${requestNumber}` : ""}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {isCancelled && (
                <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">
                  Cancelled
                </Badge>
              )}

              {canTakeAction && (
                <>
                  <Button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={busy}
                    className="rounded-full bg-blue-600 shadow-md hover:bg-blue-700 disabled:opacity-60"
                  >
                    {actionLoading === "draft" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={15} />}
                    {actionLoading === "draft" ? "Saving..." : "Save Draft"}
                  </Button>

                  <Button type="button" onClick={handleSubmit} disabled={busy}>
                    {actionLoading === "submit" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {actionLoading === "submit" ? "Submitting..." : "Submit"}
                  </Button>

                  {canSendBackOrReject && (
                    <>
                      <Button
                        type="button"
                        onClick={openSendBack}
                        disabled={busy}
                        className="rounded-full bg-yellow-500 shadow-md hover:bg-yellow-600 disabled:opacity-60"
                      >
                        <ChevronLeft size={15} /> {actionLoading === "sendBack" ? "Sending Back..." : "Send Back"}
                      </Button>
                      <Button
                        type="button"
                        onClick={openReject}
                        disabled={busy}
                        className="rounded-full bg-red-600 shadow-md hover:bg-red-700 disabled:opacity-60"
                      >
                        {actionLoading === "reject" ? "Rejecting..." : "Reject"}
                      </Button>
                    </>
                  )}

                  {!!requestNumber && (
                    <Button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      disabled={busy}
                      className="rounded-full bg-orange-500 shadow-md hover:bg-orange-600 disabled:opacity-60"
                    >
                      {actionLoading === "cancel" ? "Cancelling..." : "Cancel"}
                    </Button>
                  )}
                </>
              )}

              <Button type="button" variant="secondary" onClick={() => setAttachOpen(true)}>
                <Paperclip size={15} /> Files
              </Button>
              <Button type="button" variant="secondary" onClick={() => setLogOpen(true)}>
                <FileText size={15} /> Log
              </Button>
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}>
                <X size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isCancelled && (
          <div className="cancelled-document-banner" role="status">
            <div>
              <span className="cancelled-document-kicker">Cancelled Document</span>
              <strong>{requestNumber || "Credit Request"}</strong>
            </div>
            <p>This Credit Request is cancelled and opened in read-only mode.</p>
          </div>
        )}

        <CardContent className="commercial-editor-body min-h-0 min-w-0 overflow-auto p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">
              Loading Credit Request...
            </div>
          ) : hdrError ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-destructive">
              Unable to load Credit Request
            </div>
          ) : (
            <div
              className="grid w-full min-w-0 grid-cols-1 auto-rows-max content-start gap-1"
              style={{ height: "auto", maxHeight: "none", overflow: "visible" }}
            >
              <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

              {/* ── 1. Request Information ─────────────────────────────────── */}
              <SectionCard icon={ClipboardList} title="Request Information" hint="Credit Request">
                <div className={GRID_4}>
                  <label className="field">
                    <span>Request Number</span>
                    <Input disabled value={requestNumber || "New"} />
                  </label>
                  <label className="field">
                    <span>Request Date<Required /></span>
                    <Input
                      disabled={disabled}
                      type="date"
                      value={header.REQUEST_DATE ? String(header.REQUEST_DATE).slice(0, 10) : ""}
                      onChange={(e) => setHdr("REQUEST_DATE", e.target.value)}
                    />
                  </label>
                  <label className="field md:col-span-2">
                    <span>Company Name<Required /></span>
                    <Input disabled={disabled} value={header.COMPANY_NAME || ""} onChange={(e) => setHdr("COMPANY_NAME", e.target.value)} />
                  </label>
                </div>
              </SectionCard>

              {/* ── 2. Office Address ──────────────────────────────────────── */}
              <SectionCard icon={MapPin} title="Office Address" hint={header.CITY || "Office location"}>
                <div className={GRID_4}>
                  {/* Row 1 */}
                  <label className="field"><span>Way No<Required /></span><Input disabled={disabled} value={header.WAY_NO || ""} onChange={(e) => setHdr("WAY_NO", e.target.value)} /></label>
                  <label className="field"><span>Bldg No<Required /></span><Input disabled={disabled} value={header.BLDG_NO || ""} onChange={(e) => setHdr("BLDG_NO", e.target.value)} /></label>
                  <label className="field"><span>Flat No<Required /></span><Input disabled={disabled} value={header.FLAT_NO || ""} onChange={(e) => setHdr("FLAT_NO", e.target.value)} /></label>
                  <label className="field"><span>Location<Required /></span><Input disabled={disabled} value={header.LOCATION || ""} onChange={(e) => setHdr("LOCATION", e.target.value)} /></label>

                  {/* Row 2 */}
                  <label className="field"><span>Po Box<Required /></span><Input disabled={disabled} value={header.PO_BOX || ""} onChange={(e) => setHdr("PO_BOX", e.target.value)} /></label>
                  <label className="field"><span>Postal Code<Required /></span><Input disabled={disabled} type="number" value={header.POSTAL_CODE ?? ""} onChange={(e) => setHdr("POSTAL_CODE", Number(e.target.value))} /></label>
                  <label className="field"><span>City<Required /></span><Input disabled={disabled} value={header.CITY || ""} onChange={(e) => setHdr("CITY", e.target.value)} /></label>
                  <label className="field"><span>Tel No<Required /></span><Input disabled={disabled} value={header.OFFICE_TEL_NO || ""} onChange={(e) => setHdr("OFFICE_TEL_NO", e.target.value)} /></label>

                  {/* Row 3 */}
                  <label className="field"><span>Fax No<Required /></span><Input disabled={disabled} value={header.FAX_NO || ""} onChange={(e) => setHdr("FAX_NO", e.target.value)} /></label>
                  <label className="field"><span>Website<Required /></span><Input disabled={disabled} value={header.WEBSITE || ""} onChange={(e) => setHdr("WEBSITE", e.target.value)} /></label>
                  <label className="field md:col-span-2"><span>Email<Required /></span><Input disabled={disabled} type="email" value={header.EMAIL || ""} onChange={(e) => setHdr("EMAIL", e.target.value)} /></label>
                </div>
              </SectionCard>

              {/* ── 3. Finance Details ─────────────────────────────────────── */}
              <SectionCard icon={Landmark} title="Finance Details" hint="Contacts And Registration">
                <div className={GRID_4}>
                  {/* Row 1 */}
                  <label className="field"><span>Finance Contact Person<Required /></span><Input disabled={disabled} value={header.FIN_CONTACT_PERSON || ""} onChange={(e) => setHdr("FIN_CONTACT_PERSON", e.target.value)} /></label>
                  <label className="field">
                    <span>Finance Tel No<Required /></span>
                    <Input
                      disabled={disabled}
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={header.FIN_CONTACT_NUMBER || ""}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setHdr("FIN_CONTACT_NUMBER", digitsOnly);
                      }}
                    />
                    {header.FIN_CONTACT_NUMBER && header.FIN_CONTACT_NUMBER.length !== 10 && (
                      <p className="mt-1 text-xs text-destructive">Tel No must be exactly 10 digits</p>
                    )}
                  </label>
                  <label className="field"><span>Finance Email<Required /></span><Input disabled={disabled} type="email" value={header.FIN_CONTACT_EMAIL || ""} onChange={(e) => setHdr("FIN_CONTACT_EMAIL", e.target.value)} /></label>
                  <label className="field"><span>Commercial Reg No<Required /></span><Input disabled={disabled} value={header.COMMERCIAL_REG_NO || ""} onChange={(e) => setHdr("COMMERCIAL_REG_NO", e.target.value)} /></label>

                  {/* Row 2 */}
                  <label className="field"><span>Business Sector<Required /></span><Input disabled={disabled} value={header.BUSINESS_SECTOR || ""} onChange={(e) => setHdr("BUSINESS_SECTOR", e.target.value)} /></label>
                  <label className="field"><span>Contact Person<Required /></span><Input disabled={disabled} value={header.REMARKS_CONTACT_PERSON || ""} onChange={(e) => setHdr("REMARKS_CONTACT_PERSON", e.target.value)} /></label>
                  <label className="field"><span>Authorized Signatory<Required /></span><Input disabled={disabled} value={header.AUTHORIZED_SIGNATORY || ""} onChange={(e) => setHdr("AUTHORIZED_SIGNATORY", e.target.value)} /></label>
                  <label className="field">
                    <span>Credit Form Signature Date<Required /></span>
                    <Input
                      disabled={disabled}
                      type="date"
                      value={header.CREDIT_FORM_SIGNATURE_DATE ? String(header.CREDIT_FORM_SIGNATURE_DATE).slice(0, 10) : ""}
                      onChange={(e) => setHdr("CREDIT_FORM_SIGNATURE_DATE", e.target.value)}
                    />
                  </label>
                </div>
              </SectionCard>

              {/* ── 4. Credit Requested / Sanctioned ───────────────────────── */}
              <SectionCard icon={CreditCard} title="Credit Requested / Sanctioned" hint="Requested And Sanctioned Limits">
                <div className={GRID_4}>
                  <label className="field"><span>Credit Limit<Required /></span><Input disabled={disabled} type="number" step="0.001" value={header.CREDIT_LIMIT ?? ""} onChange={(e) => setHdr("CREDIT_LIMIT", Number(e.target.value))} /></label>
                  <label className="field"><span>Requested Credit Period<Required /></span><Input disabled={disabled} type="number" value={header.REQUESTED_CREDIT_PERIOD ?? ""} onChange={(e) => setHdr("REQUESTED_CREDIT_PERIOD", Number(e.target.value))} /></label>
                  <label className="field"><span>Sanctioned Credit Limit Amt<Required /></span><Input disabled={disabled} type="number" step="0.001" value={header.SANCTIONED_CREDIT_LIMIT_AMT ?? ""} onChange={(e) => setHdr("SANCTIONED_CREDIT_LIMIT_AMT", Number(e.target.value))} /></label>
                  <label className="field"><span>Sanctioned Credit Period<Required /></span><Input disabled={disabled} type="number" value={header.SANCTIONED_CREDIT_PERIOD ?? ""} onChange={(e) => setHdr("SANCTIONED_CREDIT_PERIOD", Number(e.target.value))} /></label>
                </div>
              </SectionCard>

              {/* ── 5. Account Environment ─────────────────────────────────── */}
              <SectionCard
                icon={Layers}
                title="Account Environment"
                hint={envSelected.length ? envSelected.join(" · ") : "No environment selected"}
              >
                <div className={GRID_4}>
                  {(
                    [
                      ["ACCOUNT_ENV_TMS", "TMS"],
                      ["ACCOUNT_ENV_WMS", "WMS"],
                      ["ACCOUNT_ENV_FREIGHT", "FREIGHT"],
                    ] as const
                  ).map(([field, label]) => {
                    const checked = header[field] === "Y";
                    return (
                      <label
                        key={field}
                        className={`flex h-9 items-center gap-2 self-end rounded-md border px-3 text-sm font-medium transition-colors ${checked ? "border-[#00378C]/40 bg-blue-50 text-[#00378C]" : "bg-background"
                          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-secondary"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={(e) => setHdr(field, e.target.checked ? "Y" : "N")}
                        />
                        {label}
                      </label>
                    );
                  })}

                  <label className="field">
                    <span>Account No<Required /></span>
                    <Input disabled={disabled} value={header.ACCOUNT_NO || ""} onChange={(e) => setHdr("ACCOUNT_NO", e.target.value)} />
                  </label>
                </div>
              </SectionCard>

              {/* ── 6. Comments ────────────────────────────────────────────── */}
              <SectionCard icon={MessageSquare} title="Comments" hint="Description And Remarks">
                <div className="grid grid-cols-1 gap-2 p-3 lg:grid-cols-3">
                  <label className="field">
                    <span>Description<Required /></span>
                    <textarea
                      disabled={disabled}
                      rows={2}
                      placeholder="Description"
                      value={header.DESCRIPTION || ""}
                      onChange={(e) => setHdr("DESCRIPTION", e.target.value)}
                      className={TEXTAREA_CLS}
                    />
                  </label>
                  <label className="field">
                    <span>Comments<Required /></span>
                    <textarea
                      disabled={disabled}
                      rows={2}
                      placeholder="Comments"
                      value={header.COMMENTS || ""}
                      onChange={(e) => setHdr("COMMENTS", e.target.value)}
                      className={TEXTAREA_CLS}
                    />
                  </label>
                  <label className="field">
                    <span>Remarks<Required /></span>
                    <textarea
                      disabled={disabled}
                      rows={2}
                      placeholder="Remarks"
                      value={header.REMARKS || ""}
                      onChange={(e) => setHdr("REMARKS", e.target.value)}
                      className={TEXTAREA_CLS}
                    />
                  </label>
                </div>
              </SectionCard>
            </div>
          )}
        </CardContent>
      </section>

      {/* Reject */}
      <Dialog
        open={rejectOpen}
        title="Reject Request"
        description="Enter the reason for rejection."
        onClose={closeReject}
        footer={
          <>
            <Button variant="outline" onClick={closeReject} disabled={actionLoading === "reject"}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={handleRejectConfirm}>
              {actionLoading === "reject" ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </>
        }
      >
        <textarea
          rows={3}
          value={remarkText}
          onChange={(e) => { setRemarkText(e.target.value); setDialogError(""); }}
          placeholder="Enter reject remark..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        {dialogError && <p className="mt-1 text-xs text-destructive">{dialogError}</p>}
      </Dialog>

      {/* Send Back */}
      <Dialog
        open={sendBackOpen}
        title="Send Back Request"
        description="Enter the reason for sending back."
        onClose={closeSendBack}
        footer={
          <>
            <Button variant="outline" onClick={closeSendBack} disabled={actionLoading === "sendBack"}>Cancel</Button>
            <Button disabled={busy} onClick={handleSendBackConfirm} variant="default">
              {actionLoading === "sendBack" ? "Sending Back..." : "Confirm Send Back"}
            </Button>
          </>
        }
      >
        <textarea
          rows={3}
          value={remarkText}
          onChange={(e) => { setRemarkText(e.target.value); setDialogError(""); }}
          placeholder="Enter send back reason..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        {dialogError && <p className="mt-1 text-xs text-destructive">{dialogError}</p>}
      </Dialog>

      {/* Cancel */}
      <Dialog
        open={cancelOpen}
        title="Cancel Request"
        description="Are you sure you want to cancel this credit request? This action cannot be undone."
        onClose={() => { if (actionLoading !== "cancel") setCancelOpen(false); }}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={actionLoading === "cancel"}>
              No, Keep It
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleCancelConfirm}>
              {actionLoading === "cancel" ? "Canceling..." : "Yes, Cancel Request"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Once canceled, this request will move to the "Canceled" tab and no further action can be taken on it.
        </p>
      </Dialog>

      <AttachmentDialog
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        requestNumber={requestNumber}
        title="Credit Request Attachments"
        module="LMS"
        type="CR"
        companyCode={companyCode}
        loginId={loginid}
        readOnly={isViewMode}
      />
    </div>
  );
};

export default AddCRRequestPage;