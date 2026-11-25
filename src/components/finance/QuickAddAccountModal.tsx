import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  X,
  Plus,
  AlertCircle,
  CheckCircle2,
  Layers,
  Building2,
  MapPin,
  CreditCard,
  Loader2
} from "lucide-react";
import { AccountTreeNode, createAccountTreeNode, getAccountTree } from "../../api/finance";
import { getMasterLookup } from "../../api/lookups";
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

  // Dynamic Master Data from Database
  const [countryList, setCountryList] = useState<Array<{ country_code: string; country_name: string }>>([]);
  const [currencyList, setCurrencyList] = useState<Array<{ curr_code: string; curr_name: string }>>([]);
  const [mastersLoading, setMastersLoading] = useState(false);

  // Chart of accounts tree state
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeData, setTreeData] = useState<AccountTreeNode[]>([]);

  // Selected hierarchy
  const [selectedL1, setSelectedL1] = useState<string>("");
  const [selectedL2, setSelectedL2] = useState<string>("");
  const [selectedL3, setSelectedL3] = useState<string>("");
  const [selectedL4, setSelectedL4] = useState<string>("");

  // Hierarchy view toggle for customer/supplier (pre-locked by default)
  const [showHierarchyCustomizer, setShowHierarchyCustomizer] = useState(false);
  const [isCreatingNewL4, setIsCreatingNewL4] = useState(false);
  const [newL4Description, setNewL4Description] = useState("");

  // =========================================================================
  // Section 1: Core / Account Details (As per our MS_ACCODES Master Form)
  // =========================================================================
  const [acName, setAcName] = useState<string>(initialAccountName);
  const [currCode, setCurrCode] = useState<string>(defaultCurrency);
  const [acActive, setAcActive] = useState<string>("Y");
  const [acType, setAcType] = useState<string>(
    accountType === "customer" ? "C" : accountType === "supplier" ? "S" : "G"
  );

  // =========================================================================
  // Section 2: Contact & Address Details (As per our MS_ACCODES Master Form)
  // =========================================================================
  const [contactPerson, setContactPerson] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [mobileNo, setMobileNo] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>(effectiveCompany.includes("OM") ? "OM" : "SA");
  const [cityName, setCityName] = useState<string>("");
  const [address1, setAddress1] = useState<string>("");

  // =========================================================================
  // Section 3: Tax & Commercial / Bank Details (As per our MS_ACCODES Master Form)
  // =========================================================================
  const [trnNo, setTrnNo] = useState<string>("");
  const [taxRegistered, setTaxRegistered] = useState<string>("Y");
  const [creditPeriod, setCreditPeriod] = useState<string>("30");
  const [creditAmount, setCreditAmount] = useState<string>("");
  const [contractExpryDate, setContractExpryDate] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");
  const [bankAcCode, setBankAcCode] = useState<string>("");

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

  // Load dynamic Country and Currency masters from database
  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setAcName(initialAccountName);
      setCurrCode(defaultCurrency);
      setAcActive("Y");
      setAcType(accountType === "customer" ? "C" : accountType === "supplier" ? "S" : "G");
      setContactPerson("");
      setPhone("");
      setMobileNo("");
      setEmail("");
      setCountryCode(effectiveCompany.includes("OM") ? "OM" : "SA");
      setCityName("");
      setAddress1("");
      setTrnNo("");
      setTaxRegistered("Y");
      setCreditPeriod("30");
      setCreditAmount("");
      setContractExpryDate("");
      setBankName("");
      setBankAcCode("");
      setShowHierarchyCustomizer(false);
      setIsCreatingNewL4(false);
      setNewL4Description("");

      void loadDynamicMasters();
      void loadTree();
    }
  }, [open, initialAccountName]);

  const loadDynamicMasters = async () => {
    setMastersLoading(true);
    try {
      const [countries, currencies] = await Promise.all([
        getMasterLookup("wms", "country"),
        getMasterLookup("wms", "currency"),
      ]);

      if (Array.isArray(countries)) {
        const formatted = countries
          .map((r: any) => ({
            country_code: String(r.country_code || r.COUNTRY_CODE || "").trim(),
            country_name: String(r.country_name || r.COUNTRY_NAME || r.country_code || "").trim(),
          }))
          .filter((r) => r.country_code);
        setCountryList(formatted);
      }

      if (Array.isArray(currencies)) {
        const formatted = currencies
          .map((r: any) => ({
            curr_code: String(r.curr_code || r.CURR_CODE || "").trim(),
            curr_name: String(r.curr_name || r.CURR_NAME || r.curr_code || "").trim(),
          }))
          .filter((r) => r.curr_code);
        setCurrencyList(formatted);
      }
    } catch (err: any) {
      console.warn("Could not load dynamic country/currency masters:", err);
    } finally {
      setMastersLoading(false);
    }
  };

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
          ? "Customer Account Name is required."
          : accountType === "supplier"
          ? "Supplier Account Name is required."
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

      // 2. Prepare payload for Oracle PROC_MANAGE_ACCODES (Real fields from our Master Form)
      const payload: Record<string, unknown> = {
        l4_code: targetL4,
        ac_name: trimmedName,
        curr_code: currCode || defaultCurrency,
        ac_active: acActive,
        ac_status: "A",
        ac_type: acType,
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        mobile_no: mobileNo.trim() || undefined,
        e_mail: email.trim() || undefined,
        country_code: countryCode.trim() || undefined,
        city_name: cityName.trim() || undefined,
        address_1: address1.trim() || undefined,
        trn_no: trnNo.trim() || undefined,
        tax_registrd: taxRegistered,
        credit_period: creditPeriod ? Number(creditPeriod) : undefined,
        credit_amount: creditAmount ? Number(creditAmount) : undefined,
        contract_expry_date: contractExpryDate || undefined,
        bank_name: bankName.trim() || undefined,
        bank_ac_code: bankAcCode.trim() || undefined,
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

  // Friendly L4 group description
  const activeL4Name =
    selectedL4 === "10203"
      ? "10203 - Trade Receivables (Customers)"
      : selectedL4 === "20201"
      ? "20201 - Trade Creditors (Suppliers)"
      : selectedL4 === "10202"
      ? "10202 - Bank Accounts"
      : selectedL4 === "10201"
      ? "10201 - Cash in Hand"
      : selectedL4
      ? `Group ${selectedL4}`
      : "Auto";

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
        className="w-[min(96vw,940px)] my-auto max-h-[94vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Navy Header Bar matching user's preferred layout */}
        <div className="bg-[#00378C] text-white px-5 py-3.5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
            className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
              SECTION 1: CORE / ACCOUNT DETAILS (Real Master Form Fields)
             ========================================================================= */}
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-xs font-extrabold tracking-wider text-[#00378C] uppercase flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#00378C]" />
                CORE ACCOUNT DETAILS
              </h3>
              {isPreLockedGroup && (
                <button
                  type="button"
                  onClick={() => setShowHierarchyCustomizer(!showHierarchyCustomizer)}
                  className="text-[11px] text-[#00378C] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {showHierarchyCustomizer ? "Hide Account Tree" : "View / Change Account Tree"}
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
                  <span className="text-slate-500 font-medium">
                    {accountType === "customer" && "Default: 10203 Trade Receivables"}
                    {accountType === "supplier" && "Default: 20201 Trade Creditors"}
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

            {/* Core Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Account Code (Auto) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Account Code
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value="Auto Generated"
                  className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50/80 px-3.5 py-2.5 text-slate-400 cursor-not-allowed select-none"
                />
              </div>

              {/* Parent Group / Level 4 */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Parent Account Group (L4)
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={activeL4Name}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-slate-50/80 px-3.5 py-2.5 text-slate-600 font-semibold cursor-not-allowed select-none"
                />
              </div>

              {/* DYNAMIC CURRENCY MASTER FROM DATABASE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Currency *</span>
                  {mastersLoading && <span className="text-[10px] text-blue-600 font-normal">Loading...</span>}
                </label>
                <select
                  value={currCode}
                  onChange={(e) => setCurrCode(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 font-medium focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  {currencyList.length > 0 ? (
                    currencyList.map((c) => (
                      <option key={c.curr_code} value={c.curr_code}>
                        {c.curr_code} - {c.curr_name}
                      </option>
                    ))
                  ) : (
                    <option value={currCode}>{currCode}</option>
                  )}
                </select>
              </div>

              {/* WIDE ACCOUNT NAME FIELD (User Requested: Increased Width & Prominent!) */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>
                    {accountType === "customer"
                      ? "Customer Account Name *"
                      : accountType === "supplier"
                      ? "Supplier Account Name *"
                      : "Account Name *"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Full Legal / Company Name</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    accountType === "customer"
                      ? "e.g. Al Wafi Al Takamul International for Food Products"
                      : accountType === "supplier"
                      ? "e.g. Saudi Logistics Services Co."
                      : "e.g. General Ledger Account Description"
                  }
                  value={acName}
                  onChange={(e) => setAcName(e.target.value)}
                  className="w-full text-sm font-semibold rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/20 transition-all shadow-2xs"
                />
              </div>

              {/* Active Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Account Status
                </label>
                <select
                  value={acActive}
                  onChange={(e) => setAcActive(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 font-medium focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 2: ADDRESS & CONTACT DETAILS (Real Master Form Fields)
             ========================================================================= */}
          <div>
            <div className="border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-xs font-extrabold tracking-wider text-[#15803d] uppercase flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#15803d]" />
                ADDRESS & CONTACT DETAILS
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Contact Person */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Contact Person / Authorized Rep
                </label>
                <input
                  type="text"
                  placeholder="Full name of representative"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Mobile No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mobile No *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +966 50 123 4567"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Phone / Landline */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Phone (Landline / Office)
                </label>
                <input
                  type="tel"
                  placeholder="Office phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="accounts@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* DYNAMIC COUNTRY MASTER FROM DATABASE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Country *</span>
                  {mastersLoading && <span className="text-[10px] text-emerald-600 font-normal">Loading...</span>}
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  <option value="">-- Select Country --</option>
                  {countryList.map((c) => (
                    <option key={c.country_code} value={c.country_code}>
                      {c.country_name} ({c.country_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div>
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

              {/* Address Line 1 */}
              <div className="col-span-full">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Street Address / Building Details
                </label>
                <input
                  type="text"
                  placeholder="Street, District, Building No, Postal Code..."
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 3: TAX & CREDIT DETAILS (Real Master Form Fields)
             ========================================================================= */}
          <div>
            <div className="border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-xs font-extrabold tracking-wider text-[#b45309] uppercase flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#b45309]" />
                TAX, CREDIT & BANKING DETAILS
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* TRN / VAT Number */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tax / VAT Registration No (TRN No)
                </label>
                <input
                  type="text"
                  placeholder="15-digit VAT / Tax Registration Number"
                  value={trnNo}
                  onChange={(e) => setTrnNo(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Tax Registered */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tax Registered?
                </label>
                <select
                  value={taxRegistered}
                  onChange={(e) => setTaxRegistered(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                >
                  <option value="Y">Yes - Tax Registered</option>
                  <option value="N">No - Not Registered</option>
                </select>
              </div>

              {/* Contract / CR Expiry Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  CR / Contract Expiry Date
                </label>
                <input
                  type="date"
                  value={contractExpryDate}
                  onChange={(e) => setContractExpryDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Credit Period (Days) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Credit Period (Days)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={creditPeriod}
                  onChange={(e) => setCreditPeriod(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Credit Limit Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Credit Limit ({currCode})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50000.00"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Bank Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Al Rajhi / SNB / Bank Muscat"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>

              {/* Bank IBAN / Account No */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bank IBAN / Account No
                </label>
                <input
                  type="text"
                  placeholder="SA... or OM..."
                  value={bankAcCode}
                  onChange={(e) => setBankAcCode(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] transition-all"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer Bar matching user's preferred layout */}
        <div className="border-t border-slate-200 bg-slate-50/60 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-extrabold text-slate-700 uppercase tracking-wider hover:bg-slate-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
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
