import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, Send, X, ChevronLeft, FileText, Paperclip } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { AutoDismissAlert } from "../../components/ui/AutoDismissAlert";
import { CardHeader } from "../../components/ui/Card";
import { useAuth } from "../../state/AuthContext";
import { almsSave, almsCommonSelect } from "../../api/alms";

// ─── Type ─────────────────────────────────────────────────────────────────
// TODO: move this into PurchaseSummary-types.ts (or a CreditRequest-types.ts) if you prefer
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
  TEL_NO?: string; // OFFICE_TEL_NO
  FAX_NO?: string;
  WEBSITE?: string;
  EMAIL?: string;

  CREDIT_LIMIT?: number;
  REQUESTED_CREDIT_PERIOD?: number;

  // Finance Details section on the UI
  FIN_CONTACT_PERSON?: string;   // -> maps to REMARKS_CONTACT_PERSON column in SP
  FIN_CONTACT_NUMBER?: string;   // -> maps to FINANCE_TEL_NO column in SP
  FIN_CONTACT_EMAIL?: string;    // -> maps to FINANCE_EMAIL column in SP

  COMMERCIAL_REG_NO?: string;
  BUSINESS_SECTOR?: string;

  // Remarks section on the UI
  REMARKS_CONTACT_PERSON?: string; // -> maps to CONTACT_PERSON column in SP
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

type AddCRRequestPageProps = {
  isEditMode: boolean;
  isViewMode?: boolean;
  existingData?: { request_number?: string };
  onClose: (refresh?: boolean) => void;
};

const AddCRRequestPage = ({ isEditMode, isViewMode = false, existingData, onClose }: AddCRRequestPageProps) => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? "";
  const loginid = user?.loginid ?? "";

  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestNumber, setRequestNumber] = useState<string | undefined>(existingData?.request_number);
  const [header, setHeader] = useState<Partial<TCRHeader>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [remarkText, setRemarkText] = useState("");
    const [attachOpen, setAttachOpen] = useState(false);
    const [logOpen, setLogOpen] = useState(false);

  const disabled = isViewMode || saving;
  const Required = () => <span className="text-destructive ml-0.5">*</span>;

  // ── Fetch existing CR (edit/view mode) ────────────────────────────────────
  const { data: hdrList = [] } = useQuery<TCRHeader[]>({
    queryKey: ["cr-header", requestNumber, companyCode],
    queryFn: () =>
      almsCommonSelect<TCRHeader>({
        parameter: "Amlspf_TabCRHeader", // TODO: confirm actual select parameter name
        loginid,
        code1: companyCode,
        code2: requestNumber,
      }),
    enabled: isEditMode && !!requestNumber,
  });

  useEffect(() => {
    if (hdrList.length > 0) {
      setHeader(hdrList[0]);
      setLoading(false);
    } else if (!isEditMode) {
      setLoading(false);
    }
  }, [hdrList, isEditMode]);

  const setHdr = (field: keyof TCRHeader, value: unknown) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  // ── Save (matches PROC_BUILD_DYNAMIC_INS_UPD_COLUMN90 -> 'capex_req_ins_upd') ──
  const saveHeader = async (status: string) =>
    almsSave({
      parameter: "capex_req_ins_upd", // TODO: confirm exact wrapper "parameter" value you call
      loginid,
      // ── Strings ──────────────────────────────────────────────
      val1s1: requestNumber || "",                      // REQUEST_NUMBER
      val1s2: companyCode,                               // COMPANY_CODE
      val1s3: header.REQUEST_DATE
        ? String(header.REQUEST_DATE).slice(0, 10)
        : "",                                            // REQUEST_DATE (YYYY-MM-DD)
      val1s4: header.DESCRIPTION || "",                  // DESCRIPTION
      val1s5: header.REMARKS || "",                      // REMARKS
      val1s6: header.DEPARTMENT_CODE || "",               // DEPARTMENT_CODE
      val1s7: header.FLOW_CODE || "CR",               // FLOW_CODE
      val1s8: loginid,                                    // USER_ID
      val1s9: header.FINAL_APPROVED || "",               // FINAL_APPROVED
      val1s10: header.CREATE_USER || loginid,             // CREATE_USER
      val1s11: loginid,                                   // LAST_UPDATED
      val1s12: status,                                    // LAST_ACTION ("DRAFT" / "SUBMITTED")

      val1s18: header.COMPANY_NAME || "",                 // COMPANY_NAME
      val1s19: header.AWARE_CUSTOMER_CODE || "",          // AWARE_CUSTOMER_CODE
      val1s20: header.WAY_NO || "",                       // WAY_NO
      val1s21: header.BLDG_NO || "",                      // BLDG_NO
      val1s22: header.FLAT_NO || "",                      // FLAT_NO
      val1s23: header.LOCATION || "",                     // LOCATION
      val1s24: header.PO_BOX || "",                       // PO_BOX
      val1s25: header.CITY || "",                         // CITY
      val1s26: header.TEL_NO || "",                       // OFFICE_TEL_NO
      val1s27: header.WEBSITE || "",                      // WEBSITE
      val1s28: header.EMAIL || "",                        // EMAIL

      val1s29: header.REMARKS_CONTACT_PERSON || "",       // CONTACT_PERSON
      val1s30: header.FIN_CONTACT_NUMBER || "",           // FINANCE_TEL_NO
      val1s31: header.FIN_CONTACT_EMAIL || "",            // FINANCE_EMAIL
      val1s32: header.COMMERCIAL_REG_NO || "",            // COMMERCIAL_REG_NO
      val1s33: header.BUSINESS_SECTOR || "",              // BUSINESS_SECTOR
      val1s34: header.FIN_CONTACT_PERSON || "",           // REMARKS_CONTACT_PERSON
      val1s35: header.AUTHORIZED_SIGNATORY || "",         // AUTHORIZED_SIGNATORY
      val1s36: header.CREDIT_FORM_SIGNATURE_DATE
        ? String(header.CREDIT_FORM_SIGNATURE_DATE).slice(0, 10)
        : "",                                             // CREDIT_FORM_SIGNATURE_DATE

      val1s37: header.COMMENTS || "",                     // COMMENTS
      val1s38: header.ATTACHMENT || "",                   // ATTACHMENT

      val1s39: header.ACCOUNT_ENV_TMS === "Y" ? "Y" : "N",     // ACCOUNT_ENV_TMS
      val1s40: header.ACCOUNT_ENV_WMS === "Y" ? "Y" : "N",     // ACCOUNT_ENV_WMS
      val1s41: header.ACCOUNT_ENV_FREIGHT === "Y" ? "Y" : "N", // ACCOUNT_ENV_FREIGHT
      val1s42: header.ACCOUNT_NO || "",                   // ACCOUNT_NO

      // ── Numbers ──────────────────────────────────────────────
      val1n1: header.FLOW_LEVEL_INITIAL || 1,             // FLOW_LEVEL_INITIAL
      val1n2: header.FLOW_LEVEL_RUNNING || 1,             // FLOW_LEVEL_RUNNING
      val1n3: header.FLOW_LEVEL_FINAL || 3,               // FLOW_LEVEL_FINAL
      val1n4: header.HISTORY_SERIAL || 0,                 // HISTORY_SERIAL
      val1n6: header.POSTAL_CODE || 0,                    // POSTAL_CODE
      val1n7: header.CREDIT_LIMIT || 0,                   // CREDIT_LIMIT
      val1n8: header.REQUESTED_CREDIT_PERIOD || 0,        // REQUESTED_CREDIT_PERIOD
      val1n9: header.SANCTIONED_CREDIT_LIMIT_AMT || 0,    // SANCTIONED_CREDIT_LIMIT_AMT
      val1n10: header.SANCTIONED_CREDIT_PERIOD || 0,      // SANCTIONED_CREDIT_PERIOD
    });

  const runAction = async (status: string, successMsg: string) => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await saveHeader(status);
      if (result.success) {
        setNotice({ type: "success", message: successMsg });
        onClose(true);
      }
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => runAction("SAVEASDRAFT", "Draft saved successfully!");
  const handleSubmit = () => runAction("SUBMITTED", "CR submitted successfully!");

  const handleRejectConfirm = async () => {
    if (!remarkText.trim()) return setNotice({ type: "error", message: "Please enter a reject remark" });
    setSaving(true);
    setNotice(null);
    try {
      await almsSave({
        parameter: "Amlspf_RejectCR", // TODO: confirm actual SP name
        loginid,
        code1: companyCode,
        code2: requestNumber,
        code3: remarkText,
      });
      setNotice({ type: "success", message: "CR rejected successfully!" });
      setRejectOpen(false);
      setRemarkText("");
      onClose(true);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to reject" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendBackConfirm = async () => {
    if (!remarkText.trim()) return setNotice({ type: "error", message: "Please enter a send back reason" });
    setSaving(true);
    setNotice(null);
    try {
      await almsSave({
        parameter: "Amlspf_SendBackCR", // TODO: confirm actual SP name
        loginid,
        code1: companyCode,
        code2: requestNumber,
        code3: remarkText,
      });
      setNotice({ type: "success", message: "CR sent back successfully!" });
      setSendBackOpen(false);
      setRemarkText("");
      onClose(true);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to send back" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <section className="payment-workbench commercial-editor grid h-screen grid-rows-[auto_minmax(0,1fr)_auto]">
        <CardHeader className="commercial-command-header border-b bg-primary px-4 py-1.5 text-primary-foreground shadow-sm">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                {isEditMode ? "Edit Document" : "New Document"}
              </p>
              <h2 className="m-0 text-base font-semibold leading-tight text-primary-foreground">
                Credit Request {requestNumber ? `— ${requestNumber}` : ""}
              </h2>
            </div>
             {/* <Button type="button" variant="secondary" onClick={() => setAttachOpen(true)}><Paperclip size={15} /> Files</Button>
            <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}>
              <X size={16} />
            </Button> */}

             <div className="flex items-center gap-2">
          
                <>
                  <Button type="button" variant="secondary" onClick={() => setAttachOpen(true)}><Paperclip size={15} /> Files</Button>
                  <Button type="button" variant="secondary" onClick={() => setLogOpen(true)}><FileText size={15} /> Log</Button>
                </>
              
              <Button aria-label="Close" type="button" variant="secondary" size="icon" onClick={() => onClose()}><X size={16} /></Button>
            </div>
          </div>
        </CardHeader>

        <div className="min-h-0 overflow-auto p-3">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center text-sm text-muted-foreground">Loading document...</div>
          ) : (
            <div className="grid gap-2">
              <AutoDismissAlert notice={notice} onClose={() => setNotice(null)} />

              {/* Request Number / Date + Company */}
              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1">
                  <p className="eyebrow m-0">Header</p>
                  <h3 className="m-0 text-sm font-semibold leading-tight">Request Information</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-2 lg:grid-cols-6">
                  <label className="field">
                    {/* <span>Request Number</span> */}
                    <span>Request Number <Required /></span>
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
                  <label className="field col-span-3">
                    <span>Company Name<Required /></span>
                    <Input disabled={disabled} value={header.COMPANY_NAME || ""} onChange={(e) => setHdr("COMPANY_NAME", e.target.value)} />
                  </label>
                </div>
              </div>

              {/* Office Address */}
              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1.5">
                  <h3 className="m-0 text-sm font-semibold leading-tight">Office Address</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:grid-cols-6">
                  <label className="field"><span>Way No<Required /></span><Input disabled={disabled} value={header.WAY_NO || ""} onChange={(e) => setHdr("WAY_NO", e.target.value)} /></label>
                  <label className="field"><span>Bldg No<Required /></span><Input disabled={disabled} value={header.BLDG_NO || ""} onChange={(e) => setHdr("BLDG_NO", e.target.value)} /></label>
                  <label className="field"><span>Flat No<Required /></span><Input disabled={disabled} value={header.FLAT_NO || ""} onChange={(e) => setHdr("FLAT_NO", e.target.value)} /></label>
                  <label className="field"><span>Location<Required /></span><Input disabled={disabled} value={header.LOCATION || ""} onChange={(e) => setHdr("LOCATION", e.target.value)} /></label>

                  <label className="field"><span>Po Box<Required /></span><Input disabled={disabled} value={header.PO_BOX || ""} onChange={(e) => setHdr("PO_BOX", e.target.value)} /></label>
                  <label className="field"><span>Postal Code<Required /></span><Input disabled={disabled} type="number" value={header.POSTAL_CODE ?? ""} onChange={(e) => setHdr("POSTAL_CODE", Number(e.target.value))} /></label>
                  <label className="field"><span>City<Required /></span><Input disabled={disabled} value={header.CITY || ""} onChange={(e) => setHdr("CITY", e.target.value)} /></label>
                  <label className="field"><span>Tel No<Required /></span><Input disabled={disabled} value={header.TEL_NO || ""} onChange={(e) => setHdr("TEL_NO", e.target.value)} /></label>

                  <label className="field"><span>Fax No<Required /></span><Input disabled={disabled} value={header.FAX_NO || ""} onChange={(e) => setHdr("FAX_NO", e.target.value)} /></label>
                  <label className="field"><span>Website<Required /></span><Input disabled={disabled} value={header.WEBSITE || ""} onChange={(e) => setHdr("WEBSITE", e.target.value)} /></label>
                  <label className="field col-span-2"><span>Email<Required /></span><Input disabled={disabled} type="email" value={header.EMAIL || ""} onChange={(e) => setHdr("EMAIL", e.target.value)} /></label>
                </div>
              </div>

              {/* Finance Details */}
              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1.5">
                  <h3 className="m-0 text-sm font-semibold leading-tight">Finance Details</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-6">
                  <label className="field"><span>Contact Person<Required /></span><Input disabled={disabled} value={header.FIN_CONTACT_PERSON || ""} onChange={(e) => setHdr("FIN_CONTACT_PERSON", e.target.value)} /></label>
                  <label className="field"><span>Tel No<Required /></span><Input disabled={disabled} value={header.FIN_CONTACT_NUMBER || ""} onChange={(e) => setHdr("FIN_CONTACT_NUMBER", e.target.value)} /></label>
                  <label className="field"><span>Email<Required /></span><Input disabled={disabled} type="email" value={header.FIN_CONTACT_EMAIL || ""} onChange={(e) => setHdr("FIN_CONTACT_EMAIL", e.target.value)} /></label>
                  <label className="field"><span>Commercial Reg No<Required /></span><Input disabled={disabled} value={header.COMMERCIAL_REG_NO || ""} onChange={(e) => setHdr("COMMERCIAL_REG_NO", e.target.value)} /></label>
                  <label className="field"><span>Business Sector<Required /></span><Input disabled={disabled} value={header.BUSINESS_SECTOR || ""} onChange={(e) => setHdr("BUSINESS_SECTOR", e.target.value)} /></label>
                  <label className="field"><span>Contact Person<Required /></span><Input disabled={disabled} value={header.REMARKS_CONTACT_PERSON || ""} onChange={(e) => setHdr("REMARKS_CONTACT_PERSON", e.target.value)} /></label>
                  <label className="field"><span>Authorized Signatory<Required /></span><Input disabled={disabled} value={header.AUTHORIZED_SIGNATORY || ""} onChange={(e) => setHdr("AUTHORIZED_SIGNATORY", e.target.value)} /></label>
                </div>
              </div>

              
              {/* Comments */}
              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1">
                  <h3 className="m-0 text-sm font-semibold leading-tight">Comments</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 p-1 md:grid-cols-2">
                  <label className="field">
                    <span>Comments<Required /></span>
                    <textarea
                      disabled={disabled}
                      rows={2}
                      value={header.COMMENTS || ""}
                      onChange={(e) => setHdr("COMMENTS", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="field">
                    <span>Remarks<Required /></span>
                    <textarea
                      disabled={disabled}
                      rows={1}
                      value={header.REMARKS || ""}
                      onChange={(e) => setHdr("REMARKS", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>

              {/* Credit Requested */}
              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1.5">
                  <h3 className="m-0 text-sm font-semibold leading-tight">Credit Requested/Sanctioned</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-5">
                  <label className="field"><span>Credit Limit<Required /></span><Input disabled={disabled} type="number" step="0.001" value={header.CREDIT_LIMIT ?? ""} onChange={(e) => setHdr("CREDIT_LIMIT", Number(e.target.value))} /></label>
                  <label className="field"><span>Requested Credit Period<Required /></span><Input disabled={disabled} type="number" value={header.REQUESTED_CREDIT_PERIOD ?? ""} onChange={(e) => setHdr("REQUESTED_CREDIT_PERIOD", Number(e.target.value))} /></label>
                  <label className="field">
                    <span>Credit Form Signature Date<Required /></span>
                    <Input
                      disabled={disabled}
                      type="date"
                      value={header.CREDIT_FORM_SIGNATURE_DATE ? String(header.CREDIT_FORM_SIGNATURE_DATE).slice(0, 10) : ""}
                      onChange={(e) => setHdr("CREDIT_FORM_SIGNATURE_DATE", e.target.value)}
                    />
                  </label>
                   <label className="field"><span>Sanctioned Credit Limit Amt<Required /></span><Input disabled={disabled} type="number" step="0.001" value={header.SANCTIONED_CREDIT_LIMIT_AMT ?? ""} onChange={(e) => setHdr("SANCTIONED_CREDIT_LIMIT_AMT", Number(e.target.value))} /></label>
                  <label className="field"><span>Sanctioned Credit Period<Required /></span><Input disabled={disabled} type="number" value={header.SANCTIONED_CREDIT_PERIOD ?? ""} onChange={(e) => setHdr("SANCTIONED_CREDIT_PERIOD", Number(e.target.value))} /></label>
                </div>
              </div>

              {/* Credit Sanctioned */}
              {/* <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1.5">
                  <h3 className="m-0 text-sm font-semibold leading-tight">Credit Sanctioned</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
                  <label className="field"><span>Sanctioned Credit Limit Amt</span><Input disabled={disabled} type="number" step="0.001" value={header.SANCTIONED_CREDIT_LIMIT_AMT ?? ""} onChange={(e) => setHdr("SANCTIONED_CREDIT_LIMIT_AMT", Number(e.target.value))} /></label>
                  <label className="field"><span>Sanctioned Credit Period</span><Input disabled={disabled} type="number" value={header.SANCTIONED_CREDIT_PERIOD ?? ""} onChange={(e) => setHdr("SANCTIONED_CREDIT_PERIOD", Number(e.target.value))} /></label>
                </div>
              </div> */}

              {/* Account Environment */}
              <div className="rounded-md border bg-card">
                <div className="border-b bg-secondary/40 px-3 py-1.5">
                  <h3 className="m-0 text-sm font-semibold leading-tight">Account Environment</h3>
                </div>
                <div className="flex flex-wrap items-center gap-4 p-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={header.ACCOUNT_ENV_TMS === "Y"}
                      onChange={(e) => setHdr("ACCOUNT_ENV_TMS", e.target.checked ? "Y" : "N")}
                    />
                    TMS
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={header.ACCOUNT_ENV_WMS === "Y"}
                      onChange={(e) => setHdr("ACCOUNT_ENV_WMS", e.target.checked ? "Y" : "N")}
                    />
                    WMS
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={header.ACCOUNT_ENV_FREIGHT === "Y"}
                      onChange={(e) => setHdr("ACCOUNT_ENV_FREIGHT", e.target.checked ? "Y" : "N")}
                    />
                    FREIGHT
                  </label>
                  {/* <label className=" flex-1 min-w-[50px]"> */}
                  {/* <label className="flex flex-wrap items-center gap-2 p-1">
                    <span >Account No</span>
                    <Input disabled={disabled} value={header.ACCOUNT_NO || ""} onChange={(e) => setHdr("ACCOUNT_NO", e.target.value)} />
                  </label> */}

                  <label className="field  min-w-[200px]">
                    <span>Account No<Required /></span>
                    <Input disabled={disabled} value={header.ACCOUNT_NO || ""} onChange={(e) => setHdr("ACCOUNT_NO", e.target.value)} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-secondary/60 px-4 py-2">
          {!isViewMode && (
            <>
              <Button disabled={saving} type="button" variant="outline" onClick={() => onClose()}>Close</Button>
              <Button disabled={saving} type="button" variant="outline" onClick={handleSaveDraft}>
                <Save size={15} /> {saving ? "Saving..." : "Save As Draft"}
              </Button>
              <Button disabled={saving} type="button" variant="default" onClick={handleSubmit}>
                <Send size={15} /> Submit
              </Button>
              <Button
                disabled={saving}
                type="button"
                variant="outline"
                onClick={() => { setRemarkText(""); setRejectOpen(true); }}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <X size={15} /> Reject
              </Button>
              <Button
                disabled={saving}
                type="button"
                variant="outline"
                onClick={() => { setRemarkText(""); setSendBackOpen(true); }}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <ChevronLeft size={15} /> Send Back
              </Button>
            </>
          )}
        </div>
      </section>

      <Dialog
        open={rejectOpen}
        title="Reject Request"
        description="Enter the reason for rejection."
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={handleRejectConfirm}>Confirm Reject</Button>
          </>
        }
      >
        <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter reject remark..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </Dialog>

      <Dialog
        open={sendBackOpen}
        title="Send Back Request"
        description="Enter the reason for sending back."
        onClose={() => setSendBackOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={handleSendBackConfirm} variant="default">Confirm Send Back</Button>
          </>
        }
      >
        <textarea rows={4} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Enter send back reason..." className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      </Dialog>
    </div>
  );
};

export default AddCRRequestPage;