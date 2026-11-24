import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FolderPlus, Layers, Plus, Sparkles, User, UserCheck } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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

  // New Level 4 creation toggle
  const [isCreatingNewL4, setIsCreatingNewL4] = useState<boolean>(false);
  const [newL4Description, setNewL4Description] = useState<string>("");

  // Account form fields
  const [acName, setAcName] = useState<string>(initialAccountName);
  const [currCode, setCurrCode] = useState<string>(defaultCurrency);
  const [trnNo, setTrnNo] = useState<string>("");
  const [cityName, setCityName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");

  // Submission state
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset form when opened or initial name changes
  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setAcName(initialAccountName);
      setCurrCode(defaultCurrency);
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

    // Helper to find path to a target L4 code
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

    // If explicit default L4 provided
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
      // Look for Trade Receivables (standard 10203)
      const path = findL4Path("10203");
      if (path) {
        setSelectedL1(path.l1);
        setSelectedL2(path.l2);
        setSelectedL3(path.l3);
        setSelectedL4(path.l4);
      } else {
        // Fallback: Level 1 = 1, Level 2 = 102
        const l1 = treeData.find((n) => n.id === "1" || n.label.toLowerCase().includes("asset"));
        if (l1) {
          setSelectedL1(l1.id);
          const l2 = (l1.children || []).find((n) => n.id === "102" || n.label.toLowerCase().includes("current"));
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
    } else if (accountType === "supplier") {
      // Look for Trade Creditors (standard 20201)
      const path = findL4Path("20201");
      if (path) {
        setSelectedL1(path.l1);
        setSelectedL2(path.l2);
        setSelectedL3(path.l3);
        setSelectedL4(path.l4);
      } else {
        const l1 = treeData.find((n) => n.id === "2" || n.label.toLowerCase().includes("liabilit"));
        if (l1) {
          setSelectedL1(l1.id);
          const l2 = (l1.children || []).find((n) => n.id === "202" || n.label.toLowerCase().includes("current"));
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
      // General: default to first branch if empty
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

  // Handle saving new account
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = acName.trim();
    if (!trimmedName) {
      setErrorMsg("Account Name is required.");
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
        throw new Error("Please select or create a Level 4 parent group.");
      }

      // 2. Create the Level 5 Account
      const payload: Record<string, unknown> = {
        l4_code: targetL4,
        ac_name: trimmedName,
        curr_code: currCode || defaultCurrency,
        ac_active: "Y",
        ac_status: "A",
        trn_no: trnNo.trim() || undefined,
        city_name: cityName.trim() || undefined,
        phone: phone.trim() || undefined,
        e_mail: email.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
      };

      const accountRes = (await createAccountTreeNode(5, payload)) as any;

      // Extract generated account code
      const generatedAcCode =
        accountRes?.data?.ac_code ||
        accountRes?.ac_code ||
        String(accountRes?.message || "").match(/\b\d{8,12}\b/)?.[0] ||
        "";

      setSuccessMsg(`Account "${trimmedName}" (${generatedAcCode || "Saved"}) created successfully!`);

      // Callback to auto-select newly created account
      onAccountCreated({
        ac_code: generatedAcCode,
        ac_name: trimmedName,
        l4_code: targetL4,
        curr_code: currCode,
      });

      // Brief pause to let user see success, then close
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("Failed to quick create account:", err);
      setErrorMsg(err.message || "Failed to create account. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle =
    accountType === "customer"
      ? "Add New Customer Account"
      : accountType === "supplier"
      ? "Add New Supplier Account"
      : "Quick Add Chart of Account";

  const dialogDesc =
    accountType === "customer"
      ? "Create a customer account directly under Trade Receivables."
      : accountType === "supplier"
      ? "Create a supplier account directly under Trade Creditors."
      : "Quickly create an account and immediately use it in this document.";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      description={dialogDesc}
      wide
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            Company: <strong className="text-slate-700">{effectiveCompany}</strong> | Currency:{" "}
            <strong className="text-slate-700">{currCode}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="quick-add-account-form"
              size="sm"
              disabled={saving || !acName.trim()}
              className="bg-[#00378C] hover:bg-[#002b6e] text-white flex items-center gap-1.5"
            >
              {saving ? "Creating..." : <><Plus size={14} /> Create & Select Account</>}
            </Button>
          </div>
        </div>
      }
    >
      <form id="quick-add-account-form" onSubmit={handleSave} className="space-y-4">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Account Hierarchy Section */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00378C]" />
              Account Hierarchy (Levels 1 - 4)
            </span>
            <span className="text-[11px] text-slate-500">
              {accountType === "customer" && "Customer Group pre-selected"}
              {accountType === "supplier" && "Supplier Group pre-selected"}
              {accountType === "general" && "Select parent account group"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Level 1 */}
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
                className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
              >
                <option value="">-- Select L1 --</option>
                {level1Options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Level 2 */}
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
                className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
              >
                <option value="">-- Select L2 --</option>
                {level2Options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Level 3 */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Level 3 (Group)</label>
              <select
                disabled={saving || !selectedL2 || treeLoading}
                value={selectedL3}
                onChange={(e) => {
                  setSelectedL3(e.target.value);
                  setSelectedL4("");
                }}
                className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
              >
                <option value="">-- Select L3 --</option>
                {level3Options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Level 4 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600">Level 4 (Sub-group)*</label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewL4(!isCreatingNewL4)}
                  className="text-[10px] text-[#00378C] font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  <FolderPlus size={11} /> {isCreatingNewL4 ? "Select Existing" : "+ New L4"}
                </button>
              </div>

              {isCreatingNewL4 ? (
                <Input
                  disabled={saving}
                  placeholder="Enter New L4 Group Name"
                  value={newL4Description}
                  onChange={(e) => setNewL4Description(e.target.value)}
                  className="text-xs h-[30px] font-medium"
                  required
                />
              ) : (
                <select
                  disabled={saving || !selectedL3 || treeLoading}
                  value={selectedL4}
                  onChange={(e) => setSelectedL4(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00378C]"
                  required
                >
                  <option value="">-- Select L4 --</option>
                  {level4Options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* 2. Account Details Section */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            Account Information
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Account / Party Name <span className="text-rose-500">*</span>
              </label>
              <Input
                disabled={saving}
                placeholder="e.g. Al Wafi Trading Co. / Office Expense"
                value={acName}
                onChange={(e) => setAcName(e.target.value)}
                className="text-xs font-semibold"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
              <select
                disabled={saving}
                value={currCode}
                onChange={(e) => setCurrCode(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-2 focus:outline-none focus:ring-1 focus:ring-[#00378C] font-medium"
              >
                <option value="SAR">SAR - Saudi Riyal</option>
                <option value="OMR">OMR - Omani Rial</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="QAR">QAR - Qatari Riyal</option>
                <option value="BHD">BHD - Bahraini Dinar</option>
                <option value="KWD">KWD - Kuwaiti Dinar</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">VAT / TRN Registration No.</label>
              <Input
                disabled={saving}
                placeholder="e.g. 311827754400003"
                value={trnNo}
                onChange={(e) => setTrnNo(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">City / Location</label>
              <Input
                disabled={saving}
                placeholder="e.g. Dammam / Riyadh"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Contact Person</label>
              <Input
                disabled={saving}
                placeholder="e.g. Manager Name"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone / Mobile</label>
              <Input
                disabled={saving}
                placeholder="e.g. +966 50 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
              <Input
                disabled={saving}
                type="email"
                placeholder="e.g. billing@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
