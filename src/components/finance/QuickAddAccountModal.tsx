import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  X,
  Plus,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronDown,
  Sparkles,
  Building2,
  Globe,
  FileText,
  UserCheck
} from "lucide-react";
import { AccountTreeNode, createAccountTreeNode, getAccountTree } from "../../api/finance";
import { useAuth } from "../../state/AuthContext";

export type QuickAccountType = "customer" | "supplier" | "general" | "bank" | "cash" | "expense";

export interface CreatedAccountResult {
  ac_code: string;
  ac_name: string;
  l4_code: string;
  curr_code?: string;
}

export interface QuickAddAccountModalProps {
  open: boolean;
  onClose: () => void;
  onAccountCreated: (account: CreatedAccountResult) => void;
  accountType?: QuickAccountType;
  defaultL4Code?: string;
  companyCode?: string;
  initialAccountName?: string;
}

const COMMON_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "OM", name: "Oman", currency: "OMR" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "BH", name: "Bahrain", currency: "BHD" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "OTHER", name: "Other Country", currency: "USD" },
];

const COMMON_REGIONS = [
  "Central Region",
  "Western Region",
  "Eastern Region",
  "Southern Region",
  "Northern Region",
  "Gulf Region",
  "International"
];

const CUSTOMER_TYPES = [
  "Walk-In",
  "Corporate",
  "Trade / Credit",
  "Wholesale",
  "Retail",
  "Government / Semi-Gov"
];

export function QuickAddAccountModal({
  open,
  onClose,
  onAccountCreated,
  accountType = "general",
  defaultL4Code,
  companyCode,
  initialAccountName = "",
}: QuickAddAccountModalProps) {
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const effectiveCompany = companyCode || user?.company_code || "AMKSA";
  const defaultCurrency = user?.base_curr_code || user?.currency || "SAR";

  // Chart of accounts tree state
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeData, setTreeData] = useState<AccountTreeNode[]>([]);

  // Selected hierarchy
  const [selectedL1, setSelectedL1] = useState<string>("");
  const [selectedL2, setSelectedL2] = useState<string>("");
  const [selectedL3, setSelectedL3] = useState<string>("");
  const [selectedL4, setSelectedL4] = useState<string>("");

  // Hierarchy view toggle for customer/supplier (hidden by default since pre-locked)
  const [showHierarchyCustomizer, setShowHierarchyCustomizer] = useState(false);
  const [isCreatingNewL4, setIsCreatingNewL4] = useState(false);
  const [newL4Description, setNewL4Description] = useState("");

  // Section 1: Core Details
  const [acName, setAcName] = useState<string>(initialAccountName);
  const [mobile, setMobile] = useState<string>("");
  const [dob, setDob] = useState<string>("");
  const [currCode, setCurrCode] = useState<string>(defaultCurrency);
  const [contactPerson, setContactPerson] = useState<string>("");

  // Section 2: Regional Details
  const [country, setCountry] = useState<string>("Saudi Arabia");
  const [nationality, setNationality] = useState<string>("Saudi");
  const [region, setRegion] = useState<string>("Central Region");
  const [cityName, setCityName] = useState<string>("");
  const [customerType, setCustomerType] = useState<string>("Walk-In");
  const [isNonResident, setIsNonResident] = useState<boolean>(false);

  // Section 3: Legal & Tax Details
  const [nationalIdOrVat, setNationalIdOrVat] = useState<string>("");
  const [idExpiryDate, setIdExpiryDate] = useState<string>("");
  const [otherDetails, setOtherDetails] = useState<string>("");

  // Submission & Alert state
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setAcName(initialAccountName);
      setMobile("");
      setDob("");
      setCurrCode(defaultCurrency);
      setCountry(effectiveCompany.includes("OM") ? "Oman" : "Saudi Arabia");
      setNationality(effectiveCompany.includes("OM") ? "Omani" : "Saudi");
      setRegion("Central Region");
      setCityName("");
      setCustomerType("Walk-In");
      setIsNonResident(false);
      setNationalIdOrVat("");
      setIdExpiryDate("");
      setOtherDetails("");
      setShowHierarchyCustomizer(false);
      setIsCreatingNewL4(false);
      setNewL4Description("");
      void loadTree();
    }
  }, [open, initialAccountName]);

  const loadTree = async () => {
    setTreeLoading(true);
    try {
      const tree = await getAccountTree();
      setTreeData(tree || []);
    } catch (err: any) {
      console.warn("Could not load account tree:", err);
    } finally {
      setTreeLoading(false);
    }
  };

  // Level 1 options
  const level1Options = useMemo(() => {
    return treeData.map((node) => ({ id: node.id, label: `${node.id} - ${node.label}` }));
  }, [treeData]);

  // Level 2 options based on selected Level 1
  const level2Options = useMemo(() => {
    if (!selectedL1) return [];
    const l1Node = treeData.find((n) => n.id === selectedL1);
    return (l1Node?.children || []).map((node) => ({ id: node.id, label: `${node.id} - ${node.label}` }));
  }, [treeData, selectedL1]);

  // Level 3 options based on selected Level 2
  const level3Options = useMemo(() => {
    if (!selectedL1 || !selectedL2) return [];
    const l1Node = treeData.find((n) => n.id === selectedL1);
    const l2Node = (l1Node?.children || []).find((n) => n.id === selectedL2);
    return (l2Node?.children || []).map((node) => ({ id: node.id, label: `${node.id} - ${node.label}` }));
  }, [treeData, selectedL1, selectedL2]);

  // Level 4 options based on selected Level 3
  const level4Options = useMemo(() => {
    if (!selectedL1 || !selectedL2 || !selectedL3) return [];
    const l1Node = treeData.find((n) => n.id === selectedL1);
    const l2Node = (l1Node?.children || []).find((n) => n.id === selectedL2);
    const l3Node = (l2Node?.children || []).find((n) => n.id === selectedL3);
    return (l3Node?.children || []).map((node) => ({ id: node.id, label: `${node.id} - ${node.label}` }));
  }, [treeData, selectedL1, selectedL2, selectedL3]);

  // Smart Pre-Selection based on Account Type
  useEffect(() => {
    if (!treeData.length) return;

    const findL4Path = (targetL4: string) => {
      for (const l1 of treeData) {
        for (const l2 of l1.children || []) {
          for (const l3 of l2.children || []) {
            for (const l4 of l3.children || []) {
              if (l4.id === targetL4) {
                return { l1: l1.id, l2: l2.id, l3: l3.id, l4: l4.id };
              }
            }
          }
        }
      }
      return null;
    };

    if (defaultL4Code) {
      const path = findL4Path(defaultL4Code);
      if (path) {
        setSelectedL1(path.l1);
        setSelectedL2(path.l2);
        setSelectedL3(path.l3);
        setSelectedL4(path.l4);
        return;
      }
    }

    if (accountType === "customer") {
      const path = findL4Path("10203");
      if (path) {
        setSelectedL1(path.l1);
        setSelectedL2(path.l2);
        setSelectedL3(path.l3);
        setSelectedL4(path.l4);
      }
    } else if (accountType === "supplier") {
      const path = findL4Path("20201");
      if (path) {
        setSelectedL1(path.l1);
        setSelectedL2(path.l2);
        setSelectedL3(path.l3);
        setSelectedL4(path.l4);
      }
    } else if (accountType === "bank") {
      const path = findL4Path("10202");
      if (path) {
        setSelectedL1(path.l1);
        setSelectedL2(path.l2);
        setSelectedL3(path.l3);
        setSelectedL4(path.l4);
      }
    } else if (accountType === "cash") {
      const path = findL4Path("10201");
      if (path) {
        setSelectedL1(path.l1);
        setSelectedL2(path.l2);
        setSelectedL3(path.l3);
        setSelectedL4(path.l4);
      }
    } else {
      if (!selectedL1 && treeData.length > 0) {
        const l1 = treeData[0];
        setSelectedL1(l1.id);
        const l2 = (l1.children || [])[0];
        if (l2) {
          setSelectedL2(l2.id);
          const l3 = (l2.children || [])[0];
          if (l3) {
            setSelectedL3(l3.id);
            const l4 = (l3.children || [])[0];
            if (l4) setSelectedL4(l4.id);
          }
        }
      }
    }
  }, [treeData, accountType, defaultL4Code]);

  // Form submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = acName.trim();
    if (!trimmedName) {
      setErrorMsg(
        accountType === "customer"
          ? "Customer Name is required."
          : accountType === "supplier"
          ? "Supplier Name is required."
          : "Account Name is required."
      );
      return;
    }

    let targetL4 = selectedL4;

    setSaving(true);
    try {
      // 1. If user chose to create a new Level 4 sub-group first
      if (isCreatingNewL4) {
        if (!newL4Description.trim()) {
          throw new Error("Level 4 Group Description is required when creating a new group.");
        }
        if (!selectedL3) {
          throw new Error("Please select a Level 3 parent group.");
        }

        const l4Res = (await createAccountTreeNode(4, {
          l3_code: selectedL3,
          l4_description: newL4Description.trim(),
        })) as any;

        targetL4 = l4Res?.data?.l4_code || l4Res?.l4_code || "";
        if (!targetL4) {
          throw new Error("Created Level 4 group code could not be determined.");
        }
      }

      if (!targetL4) {
        throw new Error("Please select or specify a Level 4 parent group.");
      }

      // 2. Prepare payload for Oracle PROC_MANAGE_ACCODES
      const payload: Record<string, unknown> = {
        l4_code: targetL4,
        ac_name: trimmedName,
        curr_code: currCode || defaultCurrency,
        ac_active: "Y",
        ac_status: "A",
        trn_no: nationalIdOrVat.trim() || undefined,
        city_name: cityName.trim() || nationality.trim() || undefined,
        phone: mobile.trim() || undefined,
        contact_person: contactPerson.trim() || otherDetails.trim() || undefined,
      };

      const accountRes = (await createAccountTreeNode(5, payload)) as any;

      const generatedAcCode =
        accountRes?.data?.ac_code ||
        accountRes?.ac_code ||
        String(accountRes?.message || "").match(/\b\d{8,12}\b/)?.[0] ||
        "";

      setSuccessMsg(`Created "${trimmedName}" (${generatedAcCode || "Success"}) successfully!`);

      // Notify parent to auto-select
      onAccountCreated({
        ac_code: generatedAcCode,
        ac_name: trimmedName,
        l4_code: targetL4,
        curr_code: currCode,
      });

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("Failed to create account:", err);
      setErrorMsg(err.message || "Failed to create account. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // Header Title
  const headerTitle =
    accountType === "customer"
      ? "ADD NEW CUSTOMER"
      : accountType === "supplier"
      ? "ADD NEW SUPPLIER"
      : "ADD NEW ACCOUNT";

  // Action Button Title
  const actionButtonText =
    accountType === "customer"
      ? "+ ADD PARTY"
      : accountType === "supplier"
      ? "+ ADD SUPPLIER"
      : "+ ADD ACCOUNT";

  const isPreLockedGroup = accountType === "customer" || accountType === "supplier";

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-[2px] overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-[min(96vw,890px)] my-auto max-h-[94vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Navy Header Bar matching user's image */}
        <div className="bg-[#00378C] text-white px-5 py-3.5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              title="Back / Close"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-sm sm:text-base font-extrabold tracking-wider uppercase text-white">
              {headerTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="quick-add-party-form"
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-800"
        >
          {/* Notification Banners */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* =========================================================================
              SECTION 1: CORE DETAILS
             ========================================================================= */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-xs font-extrabold tracking-wider text-[#00378C] uppercase">
                CORE DETAILS
              </h3>
              {isPreLockedGroup && (
                <button
                  type="button"
                  onClick={() => setShowHierarchyCustomizer(!showHierarchyCustomizer)}
                  className="text-[11px] text-[#00378C] hover:underline font-semibold flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" />
                  {showHierarchyCustomizer ? "Hide Account Hierarchy" : "View / Change Account Tree"}
                </button>
              )}
            </div>

            {/* If user toggled custom tree or if general account */}
            {(!isPreLockedGroup || showHierarchyCustomizer) && (
              <div className="mb-4 bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5 uppercase">
                    <Layers className="w-3.5 h-3.5 text-[#00378C]" />
                    Chart of Accounts Hierarchy (Levels 1 - 4)
                  </span>
                  <span className="text-slate-500">
                    {accountType === "customer" && "Defaults to 10203 Trade Receivables"}
                    {accountType === "supplier" && "Defaults to 20201 Trade Creditors"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* L1 */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Level 1 (Major)</label>
                    <select
                      disabled={saving || treeLoading}
                      value={selectedL1}
                      onChange={(e) => {
                        setSelectedL1(e.target.value);
                        setSelectedL2("");
                        setSelectedL3("");
                        setSelectedL4("");
                      }}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
                    >
                      <option value="">-- Select L1 --</option>
                      {level1Options.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* L2 */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Level 2 (Category)</label>
                    <select
                      disabled={saving || !selectedL1 || treeLoading}
                      value={selectedL2}
                      onChange={(e) => {
                        setSelectedL2(e.target.value);
                        setSelectedL3("");
                        setSelectedL4("");
                      }}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
                    >
                      <option value="">-- Select L2 --</option>
                      {level2Options.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* L3 */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Level 3 (Group)</label>
                    <select
                      disabled={saving || !selectedL2 || treeLoading}
                      value={selectedL3}
                      onChange={(e) => {
                        setSelectedL3(e.target.value);
                        setSelectedL4("");
                      }}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
                    >
                      <option value="">-- Select L3 --</option>
                      {level3Options.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* L4 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-600">Level 4 (Sub-group)*</label>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewL4(!isCreatingNewL4)}
                        className="text-[10px] text-[#00378C] hover:underline font-semibold"
                      >
                        {isCreatingNewL4 ? "Select Existing" : "+ New L4"}
                      </button>
                    </div>
                    {isCreatingNewL4 ? (
                      <input
                        type="text"
                        placeholder="New L4 Name..."
                        value={newL4Description}
                        onChange={(e) => setNewL4Description(e.target.value)}
                        className="w-full text-xs rounded-lg border border-blue-400 bg-blue-50/50 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
                      />
                    ) : (
                      <select
                        disabled={saving || !selectedL3 || treeLoading}
                        value={selectedL4}
                        onChange={(e) => setSelectedL4(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
                      >
                        <option value="">-- Select L4 --</option>
                        {level4Options.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Core Details Inputs Grid (Exact layout from image) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* SR No. */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  SR No.
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value="Auto"
                  className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50/80 px-3.5 py-2.5 text-slate-400 cursor-not-allowed select-none"
                />
              </div>

              {/* Customer ID / Account ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {accountType === "customer" ? "Customer ID" : accountType === "supplier" ? "Supplier ID" : "Account ID"}
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={selectedL4 ? `Auto (${selectedL4}...)` : "Auto"}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50/80 px-3.5 py-2.5 text-slate-400 cursor-not-allowed select-none"
                />
              </div>

              {/* Customer Name * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {accountType === "customer" ? "Customer Name *" : accountType === "supplier" ? "Supplier Name *" : "Account Name *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Name"
                  value={acName}
                  onChange={(e) => setAcName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Mobile * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mobile*
                </label>
                <input
                  type="tel"
                  placeholder="Mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Date Of Birth / Registration Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Date Of Birth *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                  />
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Currency *
                </label>
                <select
                  value={currCode}
                  onChange={(e) => setCurrCode(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  <option value="SAR">SAR - Saudi Arabia Riyal</option>
                  <option value="OMR">OMR - Omani Rial</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="BHD">BHD - Bahraini Dinar</option>
                  <option value="KWD">KWD - Kuwaiti Dinar</option>
                </select>
              </div>

              {/* Contact Person */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Contact Person / Authorized Rep
                </label>
                <input
                  type="text"
                  placeholder="Full name of contact person"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 2: REGIONAL
             ========================================================================= */}
          <div>
            <div className="border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-xs font-extrabold tracking-wider text-[#15803d] uppercase">
                REGIONAL
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Country * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Country *
                </label>
                <select
                  value={country}
                  onChange={(e) => {
                    const sel = e.target.value;
                    setCountry(sel);
                    const matched = COMMON_COUNTRIES.find((c) => c.name === sel);
                    if (matched) setCurrCode(matched.currency);
                  }}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  {COMMON_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nationality * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nationality *
                </label>
                <input
                  type="text"
                  placeholder="Select nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Region * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Region *
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  {COMMON_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Customer Type
                </label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  {CUSTOMER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resident / Non-Resident Pill */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Resident
                </label>
                <label className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer select-none transition-all">
                  <input
                    type="checkbox"
                    checked={isNonResident}
                    onChange={(e) => setIsNonResident(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#00378C] focus:ring-[#00378C]"
                  />
                  <span className="text-xs font-bold text-slate-700">Non-Resident</span>
                </label>
              </div>

              {/* City Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  City / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Riyadh, Jeddah, Dammam, Muscat..."
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 3: LEGAL
             ========================================================================= */}
          <div>
            <div className="border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-xs font-extrabold tracking-wider text-[#b45309] uppercase">
                LEGAL
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* National ID / Passport Number / VAT No * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  National ID / Passport Number *
                </label>
                <input
                  type="text"
                  placeholder="Enter National ID / Passport Number"
                  value={nationalIdOrVat}
                  onChange={(e) => setNationalIdOrVat(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* ID / Passport Expiry Date * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ID / Passport Expiry Date *
                </label>
                <input
                  type="date"
                  value={idExpiryDate}
                  onChange={(e) => setIdExpiryDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Other Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Other Details
                </label>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={otherDetails}
                  onChange={(e) => setOtherDetails(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer Bar matching user's image */}
        <div className="border-t border-slate-200 bg-slate-50/60 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-extrabold text-slate-700 uppercase tracking-wider hover:bg-slate-50 active:scale-98 transition-all disabled:opacity-50"
          >
            DISCARD
          </button>

          <button
            type="submit"
            form="quick-add-party-form"
            disabled={saving || !acName.trim()}
            className="px-7 py-2.5 rounded-xl bg-[#00378C] hover:bg-[#002b6e] active:scale-98 text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? (
              <span>SAVING...</span>
            ) : (
              <>
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{actionButtonText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
