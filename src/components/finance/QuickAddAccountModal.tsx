import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import "flag-icons/css/flag-icons.min.css";
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
  Loader2,
  Search,
  ChevronDown,
  Check,
  Globe,
  Coins,
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
  phone?: string;
  address_1?: string;
  contact_person?: string;
  trn_no?: string;
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

// =========================================================================
// Country & Currency ISO / Flag / Dial Code Helpers
// =========================================================================

interface CountryMeta {
  iso2: string;
  dialCode: string;
}

const COUNTRY_LOOKUP_MAP: Record<string, CountryMeta> = {
  // GCC & Middle East
  SA: { iso2: "sa", dialCode: "+966" },
  KSA: { iso2: "sa", dialCode: "+966" },
  SAU: { iso2: "sa", dialCode: "+966" },
  OM: { iso2: "om", dialCode: "+968" },
  OMA: { iso2: "om", dialCode: "+968" },
  OMN: { iso2: "om", dialCode: "+968" },
  AE: { iso2: "ae", dialCode: "+971" },
  ARE: { iso2: "ae", dialCode: "+971" },
  UAE: { iso2: "ae", dialCode: "+971" },
  QA: { iso2: "qa", dialCode: "+974" },
  QAT: { iso2: "qa", dialCode: "+974" },
  KW: { iso2: "kw", dialCode: "+965" },
  KWT: { iso2: "kw", dialCode: "+965" },
  BH: { iso2: "bh", dialCode: "+973" },
  BHR: { iso2: "bh", dialCode: "+973" },
  EG: { iso2: "eg", dialCode: "+20" },
  EGY: { iso2: "eg", dialCode: "+20" },
  JO: { iso2: "jo", dialCode: "+962" },
  JOR: { iso2: "jo", dialCode: "+962" },
  LB: { iso2: "lb", dialCode: "+961" },
  LBN: { iso2: "lb", dialCode: "+961" },
  IQ: { iso2: "iq", dialCode: "+964" },
  IRQ: { iso2: "iq", dialCode: "+964" },
  YE: { iso2: "ye", dialCode: "+967" },
  YEM: { iso2: "ye", dialCode: "+967" },
  TR: { iso2: "tr", dialCode: "+90" },
  TUR: { iso2: "tr", dialCode: "+90" },
  SY: { iso2: "sy", dialCode: "+963" },
  SYR: { iso2: "sy", dialCode: "+963" },

  // South / East / Southeast Asia
  IN: { iso2: "in", dialCode: "+91" },
  IND: { iso2: "in", dialCode: "+91" },
  PK: { iso2: "pk", dialCode: "+92" },
  PAK: { iso2: "pk", dialCode: "+92" },
  BD: { iso2: "bd", dialCode: "+880" },
  BGD: { iso2: "bd", dialCode: "+880" },
  LK: { iso2: "lk", dialCode: "+94" },
  LKA: { iso2: "lk", dialCode: "+94" },
  NP: { iso2: "np", dialCode: "+977" },
  NPL: { iso2: "np", dialCode: "+977" },
  PH: { iso2: "ph", dialCode: "+63" },
  PHL: { iso2: "ph", dialCode: "+63" },
  CN: { iso2: "cn", dialCode: "+86" },
  CHN: { iso2: "cn", dialCode: "+86" },
  JP: { iso2: "jp", dialCode: "+81" },
  JPN: { iso2: "jp", dialCode: "+81" },
  KR: { iso2: "kr", dialCode: "+82" },
  KOR: { iso2: "kr", dialCode: "+82" },
  SG: { iso2: "sg", dialCode: "+65" },
  SGP: { iso2: "sg", dialCode: "+65" },
  MY: { iso2: "my", dialCode: "+60" },
  MYS: { iso2: "my", dialCode: "+60" },
  TH: { iso2: "th", dialCode: "+66" },
  THA: { iso2: "th", dialCode: "+66" },
  ID: { iso2: "id", dialCode: "+62" },
  IDN: { iso2: "id", dialCode: "+62" },
  VN: { iso2: "vn", dialCode: "+84" },
  VNM: { iso2: "vn", dialCode: "+84" },

  // Americas & Europe & Oceania & Africa
  US: { iso2: "us", dialCode: "+1" },
  USA: { iso2: "us", dialCode: "+1" },
  GB: { iso2: "gb", dialCode: "+44" },
  GBR: { iso2: "gb", dialCode: "+44" },
  UK: { iso2: "gb", dialCode: "+44" },
  CA: { iso2: "ca", dialCode: "+1" },
  CAN: { iso2: "ca", dialCode: "+1" },
  DE: { iso2: "de", dialCode: "+49" },
  DEU: { iso2: "de", dialCode: "+49" },
  FR: { iso2: "fr", dialCode: "+33" },
  FRA: { iso2: "fr", dialCode: "+33" },
  IT: { iso2: "it", dialCode: "+39" },
  ITA: { iso2: "it", dialCode: "+39" },
  ES: { iso2: "es", dialCode: "+34" },
  ESP: { iso2: "es", dialCode: "+34" },
  NL: { iso2: "nl", dialCode: "+31" },
  NLD: { iso2: "nl", dialCode: "+31" },
  CH: { iso2: "ch", dialCode: "+41" },
  CHE: { iso2: "ch", dialCode: "+41" },
  AU: { iso2: "au", dialCode: "+61" },
  AUS: { iso2: "au", dialCode: "+61" },
  NZ: { iso2: "nz", dialCode: "+64" },
  NZL: { iso2: "nz", dialCode: "+64" },
  ZA: { iso2: "za", dialCode: "+27" },
  ZAF: { iso2: "za", dialCode: "+27" },
  SD: { iso2: "sd", dialCode: "+249" },
  SDN: { iso2: "sd", dialCode: "+249" },
  ET: { iso2: "et", dialCode: "+251" },
  ETH: { iso2: "et", dialCode: "+251" },
  KE: { iso2: "ke", dialCode: "+254" },
  KEN: { iso2: "ke", dialCode: "+254" },
  NG: { iso2: "ng", dialCode: "+234" },
  NGA: { iso2: "ng", dialCode: "+234" },
  BR: { iso2: "br", dialCode: "+55" },
  BRA: { iso2: "br", dialCode: "+55" },
  MX: { iso2: "mx", dialCode: "+52" },
  MEX: { iso2: "mx", dialCode: "+52" },
  RU: { iso2: "ru", dialCode: "+7" },
  RUS: { iso2: "ru", dialCode: "+7" },
};

function getCountryMeta(code: string, name?: string, shortDesc?: string): CountryMeta {
  const upperCode = String(code || "").trim().toUpperCase();
  const upperShort = String(shortDesc || "").trim().toUpperCase();

  if (COUNTRY_LOOKUP_MAP[upperCode]) return COUNTRY_LOOKUP_MAP[upperCode];
  if (upperShort && COUNTRY_LOOKUP_MAP[upperShort]) return COUNTRY_LOOKUP_MAP[upperShort];

  if (name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("saudi")) return COUNTRY_LOOKUP_MAP["SA"];
    if (lowerName.includes("oman")) return COUNTRY_LOOKUP_MAP["OM"];
    if (lowerName.includes("emirates") || lowerName.includes("uae")) return COUNTRY_LOOKUP_MAP["AE"];
    if (lowerName.includes("qatar")) return COUNTRY_LOOKUP_MAP["QA"];
    if (lowerName.includes("kuwait")) return COUNTRY_LOOKUP_MAP["KW"];
    if (lowerName.includes("bahrain")) return COUNTRY_LOOKUP_MAP["BH"];
    if (lowerName.includes("egypt")) return COUNTRY_LOOKUP_MAP["EG"];
    if (lowerName.includes("jordan")) return COUNTRY_LOOKUP_MAP["JO"];
    if (lowerName.includes("india")) return COUNTRY_LOOKUP_MAP["IN"];
    if (lowerName.includes("pakistan")) return COUNTRY_LOOKUP_MAP["PK"];
    if (lowerName.includes("bangladesh")) return COUNTRY_LOOKUP_MAP["BD"];
    if (lowerName.includes("china")) return COUNTRY_LOOKUP_MAP["CN"];
    if (lowerName.includes("united states") || lowerName.includes("usa")) return COUNTRY_LOOKUP_MAP["US"];
    if (lowerName.includes("united kingdom") || lowerName.includes("britain")) return COUNTRY_LOOKUP_MAP["GB"];
  }

  if (upperCode.length === 2) {
    return { iso2: upperCode.toLowerCase(), dialCode: "" };
  }

  return { iso2: "un", dialCode: "" };
}

function getCurrencyFlag(currCode: string): string {
  const upper = String(currCode || "").trim().toUpperCase();
  const CURR_MAP: Record<string, string> = {
    SAR: "sa",
    OMR: "om",
    AED: "ae",
    QAR: "qa",
    KWD: "kw",
    BHD: "bh",
    EGP: "eg",
    JOD: "jo",
    USD: "us",
    EUR: "eu",
    GBP: "gb",
    INR: "in",
    PKR: "pk",
    BDT: "bd",
    LKR: "lk",
    PHP: "ph",
    CNY: "cn",
    JPY: "jp",
    KRW: "kr",
    SGD: "sg",
    MYR: "my",
    THB: "th",
    IDR: "id",
    VND: "vn",
    CAD: "ca",
    AUD: "au",
    NZD: "nz",
    CHF: "ch",
    TRY: "tr",
    ZAR: "za",
    BRL: "br",
    RUB: "ru",
  };

  if (CURR_MAP[upper]) return CURR_MAP[upper];
  if (upper.length >= 2) return upper.slice(0, 2).toLowerCase();
  return "un";
}

// Hook to position fixed popovers reliably above modal overflow
function usePopoverPosition(triggerRef: React.RefObject<HTMLElement | null>, isOpen: boolean) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  const update = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.min(Math.max(rect.width, 320), viewportWidth - 24);
    const spaceBelow = viewportHeight - rect.bottom - 6;
    const spaceAbove = rect.top - 6;
    const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + width > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - width - 12);
    }

    setStyle({
      position: "fixed",
      left,
      top: openAbove ? undefined : rect.bottom + 4,
      bottom: openAbove ? viewportHeight - rect.top + 4 : undefined,
      width,
      maxHeight: 280,
      zIndex: 10050,
    });
  }, [triggerRef, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, update]);

  return style;
}

// =========================================================================
// Main QuickAddAccountModal Component
// =========================================================================

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
  const defaultCurrency = user?.base_curr_code || user?.currency || (effectiveCompany.includes("OM") ? "OMR" : "SAR");

  // Dynamic Master Data from Database
  const [countryList, setCountryList] = useState<Array<{ country_code: string; country_name: string; short_desc?: string }>>([]);
  const [currencyList, setCurrencyList] = useState<Array<{ curr_code: string; curr_name: string }>>([]);
  const [mastersLoading, setMastersLoading] = useState(false);

  // Dropdown UI states for Country & Currency
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryTriggerRef = useRef<HTMLButtonElement>(null);
  const countryMenuRef = useRef<HTMLDivElement>(null);
  const countrySearchInputRef = useRef<HTMLInputElement>(null);

  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const currencyTriggerRef = useRef<HTMLButtonElement>(null);
  const currencyMenuRef = useRef<HTMLDivElement>(null);
  const currencySearchInputRef = useRef<HTMLInputElement>(null);

  const countryMenuStyle = usePopoverPosition(countryTriggerRef, countryDropdownOpen);
  const currencyMenuStyle = usePopoverPosition(currencyTriggerRef, currencyDropdownOpen);

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
  // Section 1: Core / Account Details
  // =========================================================================
  const [acName, setAcName] = useState<string>(initialAccountName);
  const [currCode, setCurrCode] = useState<string>(defaultCurrency);
  const [acActive, setAcActive] = useState<string>("Y");
  const [acType, setAcType] = useState<string>(
    accountType === "customer" ? "C" : accountType === "supplier" ? "S" : "G"
  );

  // =========================================================================
  // Section 2: Contact & Address Details
  // =========================================================================
  const [contactPerson, setContactPerson] = useState<string>("");
  const [phoneDigits, setPhoneDigits] = useState<string>("");
  const [mobileDigits, setMobileDigits] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>(effectiveCompany.includes("OM") ? "OM" : "KSA");
  const [cityName, setCityName] = useState<string>("");
  const [address1, setAddress1] = useState<string>("");

  // =========================================================================
  // Section 3: Tax & Commercial / Bank Details
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

  // Close popovers on click outside
  useEffect(() => {
    if (!countryDropdownOpen && !currencyDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        countryDropdownOpen &&
        countryTriggerRef.current &&
        !countryTriggerRef.current.contains(target) &&
        countryMenuRef.current &&
        !countryMenuRef.current.contains(target)
      ) {
        setCountryDropdownOpen(false);
      }

      if (
        currencyDropdownOpen &&
        currencyTriggerRef.current &&
        !currencyTriggerRef.current.contains(target) &&
        currencyMenuRef.current &&
        !currencyMenuRef.current.contains(target)
      ) {
        setCurrencyDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [countryDropdownOpen, currencyDropdownOpen]);

  // Focus search inputs when opened
  useEffect(() => {
    if (countryDropdownOpen) {
      const timer = setTimeout(() => countrySearchInputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [countryDropdownOpen]);

  useEffect(() => {
    if (currencyDropdownOpen) {
      const timer = setTimeout(() => currencySearchInputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [currencyDropdownOpen]);

  // Close modal on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (countryDropdownOpen) {
          e.preventDefault();
          setCountryDropdownOpen(false);
          return;
        }
        if (currencyDropdownOpen) {
          e.preventDefault();
          setCurrencyDropdownOpen(false);
          return;
        }
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, countryDropdownOpen, currencyDropdownOpen]);

  // Initialize modal state on open
  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setAcName(initialAccountName);
      setCurrCode(defaultCurrency);
      setAcActive("Y");
      setAcType(accountType === "customer" ? "C" : accountType === "supplier" ? "S" : "G");
      setContactPerson("");
      setPhoneDigits("");
      setMobileDigits("");
      setEmail("");
      setCountryCode(effectiveCompany.includes("OM") ? "OM" : "KSA");
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
      setCountryDropdownOpen(false);
      setCurrencyDropdownOpen(false);
      setCountrySearch("");
      setCurrencySearch("");

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
            short_desc: String(r.short_desc || r.SHORT_DESC || "").trim(),
          }))
          .filter((r) => r.country_code);

        setCountryList(formatted);

        // Auto-select initial country code based on company & available list
        setCountryCode((prev) => {
          if (prev && formatted.some((c) => c.country_code.toUpperCase() === prev.toUpperCase())) {
            return prev;
          }
          if (effectiveCompany.includes("OM")) {
            const omMatch = formatted.find(
              (c) => c.country_code.toUpperCase() === "OM" || c.country_code.toUpperCase() === "OMA"
            );
            if (omMatch) return omMatch.country_code;
          }
          const ksaMatch = formatted.find(
            (c) => c.country_code.toUpperCase() === "KSA" || c.country_code.toUpperCase() === "SA"
          );
          if (ksaMatch) return ksaMatch.country_code;
          return formatted[0]?.country_code || "KSA";
        });
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
      const custPath = findL4Path("10203");
      if (custPath) {
        setSelectedL1(custPath.l1);
        setSelectedL2(custPath.l2);
        setSelectedL3(custPath.l3);
        setSelectedL4(custPath.l4);
        return;
      }
    } else if (accountType === "supplier") {
      const suppPath = findL4Path("20201");
      if (suppPath) {
        setSelectedL1(suppPath.l1);
        setSelectedL2(suppPath.l2);
        setSelectedL3(suppPath.l3);
        setSelectedL4(suppPath.l4);
        return;
      }
    } else if (accountType === "bank") {
      const bankPath = findL4Path("10202");
      if (bankPath) {
        setSelectedL1(bankPath.l1);
        setSelectedL2(bankPath.l2);
        setSelectedL3(bankPath.l3);
        setSelectedL4(bankPath.l4);
        return;
      }
    } else if (accountType === "cash") {
      const cashPath = findL4Path("10201");
      if (cashPath) {
        setSelectedL1(cashPath.l1);
        setSelectedL2(cashPath.l2);
        setSelectedL3(cashPath.l3);
        setSelectedL4(cashPath.l4);
        return;
      }
    }

    if (!selectedL1 && treeData.length > 0) {
      const firstL1 = treeData[0];
      setSelectedL1(firstL1.id);
      if (firstL1.children?.length) {
        const firstL2 = firstL1.children[0];
        setSelectedL2(firstL2.id);
        if (firstL2.children?.length) {
          const firstL3 = firstL2.children[0];
          setSelectedL3(firstL3.id);
          if (firstL3.children?.length) {
            setSelectedL4(firstL3.children[0].id);
          }
        }
      }
    }
  }, [treeData, accountType, defaultL4Code]);

  // Selected Country & Currency Metadata
  const selectedCountry = useMemo(() => {
    return countryList.find((c) => c.country_code.toUpperCase() === countryCode.toUpperCase());
  }, [countryList, countryCode]);

  const selectedCountryMeta = useMemo(() => {
    return getCountryMeta(countryCode, selectedCountry?.country_name, selectedCountry?.short_desc);
  }, [countryCode, selectedCountry]);

  const selectedCurrency = useMemo(() => {
    return currencyList.find((c) => c.curr_code.toUpperCase() === currCode.toUpperCase());
  }, [currencyList, currCode]);

  const selectedCurrencyFlag = useMemo(() => {
    return getCurrencyFlag(currCode);
  }, [currCode]);

  // Filtered dropdown lists for search
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countryList;
    const q = countrySearch.toLowerCase().trim();
    return countryList.filter((c) => {
      const meta = getCountryMeta(c.country_code, c.country_name, c.short_desc);
      return (
        c.country_name.toLowerCase().includes(q) ||
        c.country_code.toLowerCase().includes(q) ||
        (meta.dialCode && meta.dialCode.includes(q)) ||
        (c.short_desc && c.short_desc.toLowerCase().includes(q))
      );
    });
  }, [countryList, countrySearch]);

  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return currencyList;
    const q = currencySearch.toLowerCase().trim();
    return currencyList.filter((c) => {
      return c.curr_code.toLowerCase().includes(q) || c.curr_name.toLowerCase().includes(q);
    });
  }, [currencyList, currencySearch]);

  // Country selection handler
  const handleCountrySelect = (newCode: string) => {
    setCountryCode(newCode);
    setCountryDropdownOpen(false);
    setCountrySearch("");
  };

  // Phone number input handlers (strictly cleans accidental dial codes, spaces, non-digits)
  const onMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const dial = selectedCountryMeta.dialCode;
    if (dial && val.includes(dial)) {
      val = val.split(dial).join("");
    }
    val = val.replace(/^\+\d+\s*/, "");
    val = val.replace(/[^\d\s-]/g, "");
    if (val.startsWith("0")) {
      val = val.slice(1);
    }
    setMobileDigits(val);
  };

  const onPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const dial = selectedCountryMeta.dialCode;
    if (dial && val.includes(dial)) {
      val = val.split(dial).join("");
    }
    val = val.replace(/^\+\d+\s*/, "");
    val = val.replace(/[^\d\s-]/g, "");
    if (val.startsWith("0")) {
      val = val.slice(1);
    }
    setPhoneDigits(val);
  };

  // Level change cascading
  const handleL1Change = (l1: string) => {
    setSelectedL1(l1);
    const l1Node = treeData.find((n) => n.id === l1);
    const l2Node = l1Node?.children?.[0];
    const nextL2 = l2Node?.id || "";
    setSelectedL2(nextL2);
    const l3Node = l2Node?.children?.[0];
    const nextL3 = l3Node?.id || "";
    setSelectedL3(nextL3);
    const nextL4 = l3Node?.children?.[0]?.id || "";
    setSelectedL4(nextL4);
  };

  const handleL2Change = (l2: string) => {
    setSelectedL2(l2);
    const l1Node = treeData.find((n) => n.id === selectedL1);
    const l2Node = l1Node?.children?.find((n) => n.id === l2);
    const l3Node = l2Node?.children?.[0];
    const nextL3 = l3Node?.id || "";
    setSelectedL3(nextL3);
    const nextL4 = l3Node?.children?.[0]?.id || "";
    setSelectedL4(nextL4);
  };

  const handleL3Change = (l3: string) => {
    setSelectedL3(l3);
    const l1Node = treeData.find((n) => n.id === selectedL1);
    const l2Node = l1Node?.children?.find((n) => n.id === selectedL2);
    const l3Node = l2Node?.children?.find((n) => n.id === l3);
    const nextL4 = l3Node?.children?.[0]?.id || "";
    setSelectedL4(nextL4);
  };

  // Handle Save
  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const trimmedName = acName.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter an Account Name.");
      return;
    }

    if (!mobileDigits.trim()) {
      setErrorMsg("Please enter the Mobile Number.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Resolve Level 4 group code
      let targetL4 = selectedL4;
      if (isCreatingNewL4) {
        if (!selectedL3) {
          throw new Error("Cannot create a Level 4 group without selecting a Level 3 parent.");
        }
        if (!newL4Description.trim()) {
          throw new Error("Please enter a description for the new Level 4 group.");
        }

        const l4Res = (await createAccountTreeNode(4, {
          l3_code: selectedL3,
          l4_name: newL4Description.trim(),
        })) as any;

        targetL4 = l4Res?.data?.l4_code || l4Res?.l4_code || "";
        if (!targetL4) {
          throw new Error("Created Level 4 group code could not be determined.");
        }
      }

      if (!targetL4) {
        throw new Error("Please select or specify a Level 4 parent group.");
      }

      // Format international phone numbers using selected country dial code
      const resolvedMobile = mobileDigits.trim()
        ? (selectedCountryMeta.dialCode ? `${selectedCountryMeta.dialCode} ${mobileDigits.trim()}` : mobileDigits.trim())
        : undefined;

      const resolvedPhone = phoneDigits.trim()
        ? (selectedCountryMeta.dialCode ? `${selectedCountryMeta.dialCode} ${phoneDigits.trim()}` : phoneDigits.trim())
        : undefined;

      // 2. Prepare payload for Oracle PROC_MANAGE_ACCODES
      const payload: Record<string, unknown> = {
        l4_code: targetL4,
        ac_name: trimmedName,
        curr_code: currCode || defaultCurrency,
        ac_active: acActive || "Y",
        ac_status: "A",
        ac_type: acType,
        contact_person: contactPerson.trim() || undefined,
        phone: resolvedPhone,
        mobile_no: resolvedMobile,
        e_mail: email.trim() || undefined,
        country_code: countryCode.trim() || undefined,
        city_name: cityName.trim() || undefined,
        address_1: address1.trim() || undefined,
        trn_no: trnNo.trim() || undefined,
        tax_registrd: taxRegistered || "Y",
        credit_period: creditPeriod && !isNaN(Number(creditPeriod)) ? Number(creditPeriod) : undefined,
        credit_amount: creditAmount && !isNaN(Number(creditAmount)) ? Number(creditAmount) : undefined,
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
        phone: resolvedMobile || resolvedPhone,
        address_1: address1.trim() || cityName.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
        trn_no: trnNo.trim() || undefined,
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
        {/* Navy Header Bar */}
        <div className="bg-[#00378C] text-white px-5 py-3.5 flex items-center justify-between shrink-0 select-none shadow-xs">
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-800">
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
              SECTION 1: CORE / ACCOUNT DETAILS
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

            {/* Collapsible Chart of Accounts Customizer */}
            {(!isPreLockedGroup || showHierarchyCustomizer) && (
              <div className="mb-5 p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#00378C] flex items-center gap-1.5 uppercase">
                    <Layers className="w-3.5 h-3.5" />
                    Chart of Accounts Hierarchy (Levels 1 - 4)
                  </span>
                  {treeLoading && (
                    <span className="text-[11px] text-blue-600 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading tree...
                    </span>
                  )}
                  {isPreLockedGroup && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      Default: {activeL4Name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Level 1 */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Level 1 (Major)
                    </label>
                    <select
                      value={selectedL1}
                      onChange={(e) => handleL1Change(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 font-medium focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] focus:outline-none shadow-2xs"
                    >
                      {level1Options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Level 2 */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Level 2 (Category)
                    </label>
                    <select
                      value={selectedL2}
                      onChange={(e) => handleL2Change(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 font-medium focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] focus:outline-none shadow-2xs"
                    >
                      {level2Options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Level 3 */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Level 3 (Group)
                    </label>
                    <select
                      value={selectedL3}
                      onChange={(e) => handleL3Change(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 font-medium focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] focus:outline-none shadow-2xs"
                    >
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
                      <label className="text-[11px] font-bold text-slate-600">
                        Level 4 (Sub-group)*
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewL4(!isCreatingNewL4)}
                        className="text-[10px] text-[#00378C] hover:underline font-bold cursor-pointer"
                      >
                        {isCreatingNewL4 ? "Select Existing" : "+ New L4"}
                      </button>
                    </div>

                    {isCreatingNewL4 ? (
                      <input
                        type="text"
                        placeholder="Enter new L4 description..."
                        value={newL4Description}
                        onChange={(e) => setNewL4Description(e.target.value)}
                        className="w-full text-xs rounded-xl border border-blue-400 bg-white px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#00378C] shadow-2xs"
                      />
                    ) : (
                      <select
                        value={selectedL4}
                        onChange={(e) => setSelectedL4(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700 font-medium focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C] focus:outline-none shadow-2xs"
                      >
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
            )}

            {/* Standard Core Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Account Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Account Code
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value="Auto Generated"
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-500 font-mono font-medium cursor-not-allowed select-none shadow-2xs"
                />
              </div>

              {/* Parent Group L4 Display */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Parent Account Group (L4)
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={activeL4Name}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-700 font-semibold cursor-not-allowed select-none shadow-2xs"
                />
              </div>

              {/* CURRENCY MASTER LOOK FIELD WITH FLAG */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Currency *</span>
                  {mastersLoading && (
                    <span className="text-[10px] text-blue-600 font-normal">Loading...</span>
                  )}
                </label>

                {/* ERP-Styled Currency Trigger Button */}
                <button
                  ref={currencyTriggerRef}
                  type="button"
                  onClick={() => {
                    setCurrencyDropdownOpen(!currencyDropdownOpen);
                    setCountryDropdownOpen(false);
                    setCurrencySearch("");
                  }}
                  className="w-full flex items-center justify-between gap-2 text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 font-medium hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all text-left shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedCurrency ? (
                      <>
                        <span
                          className={`fi fi-${selectedCurrencyFlag} shrink-0 rounded-[2px] shadow-2xs border border-slate-200/60`}
                          style={{ width: 18, height: 13.5 }}
                        />
                        <span className="font-mono font-bold text-slate-900">
                          {selectedCurrency.curr_code}
                        </span>
                        <span className="truncate text-slate-600 text-xs">
                          - {selectedCurrency.curr_name}
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Coins className="w-4 h-4 text-slate-400" />
                        <span>-- Select Currency --</span>
                      </div>
                    )}
                  </div>
                  <ChevronDown
                    className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200"
                    style={{ transform: currencyDropdownOpen ? "rotate(180deg)" : "none" }}
                  />
                </button>
              </div>

              {/* WIDE ACCOUNT NAME FIELD */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>
                    {accountType === "customer"
                      ? "Customer Account Name *"
                      : accountType === "supplier"
                      ? "Supplier Account Name *"
                      : "Account Name *"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Full Legal / Company Name
                  </span>
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
                  className="w-full text-sm font-semibold rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 font-medium hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all cursor-pointer shadow-2xs"
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 2: ADDRESS & CONTACT DETAILS (Attractive Inputs & No Overlap)
             ========================================================================= */}
          <div>
            <div className="border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-xs font-extrabold tracking-wider text-[#15803d] uppercase flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#15803d]" />
                ADDRESS & CONTACT DETAILS
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* COUNTRY MASTER LOOK FIELD WITH FLAG */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Country *</span>
                  {mastersLoading && (
                    <span className="text-[10px] text-emerald-600 font-normal">Loading...</span>
                  )}
                </label>

                {/* ERP-Styled Country Trigger Button */}
                <button
                  ref={countryTriggerRef}
                  type="button"
                  onClick={() => {
                    setCountryDropdownOpen(!countryDropdownOpen);
                    setCurrencyDropdownOpen(false);
                    setCountrySearch("");
                  }}
                  className="w-full flex items-center justify-between gap-2 text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 font-medium hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all text-left shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedCountry ? (
                      <>
                        <span
                          className={`fi fi-${selectedCountryMeta.iso2} shrink-0 rounded-[2px] shadow-2xs border border-slate-200/60`}
                          style={{ width: 18, height: 13.5 }}
                        />
                        <span className="truncate font-semibold text-slate-900">
                          {selectedCountry.country_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold shrink-0">
                          {selectedCountry.country_code}
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <span>-- Select Country --</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {selectedCountryMeta.dialCode && (
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/80">
                        {selectedCountryMeta.dialCode}
                      </span>
                    )}
                    <ChevronDown
                      className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200"
                      style={{ transform: countryDropdownOpen ? "rotate(180deg)" : "none" }}
                    />
                  </div>
                </button>
              </div>

              {/* City / Location */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  City / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Riyadh, Jeddah, Dammam, Muscat, Dubai..."
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
                />
              </div>

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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
                />
              </div>

              {/* MOBILE NUMBER WITH FLEX INPUT GROUP (ZERO OVERLAP EVER) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mobile No *
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 bg-white shadow-2xs hover:border-slate-400 focus-within:border-[#00378C] focus-within:ring-2 focus-within:ring-[#00378C]/15 transition-all overflow-hidden">
                  {/* Pinned Country Flag & Dial Code Pill */}
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50/90 border-r border-slate-200 select-none shrink-0">
                    <span
                      className={`fi fi-${selectedCountryMeta.iso2} shrink-0 rounded-[2px] shadow-2xs border border-slate-200/60`}
                      style={{ width: 18, height: 13.5 }}
                    />
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {selectedCountryMeta.dialCode || "+"}
                    </span>
                  </div>
                  {/* Clean Input Field */}
                  <input
                    type="tel"
                    required
                    placeholder={selectedCountryMeta.iso2 === "sa" ? "50 123 4567" : "9123 4567"}
                    value={mobileDigits}
                    onChange={onMobileChange}
                    className="flex-1 w-full px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 bg-transparent border-0 outline-none font-mono font-medium focus:ring-0"
                  />
                </div>
              </div>

              {/* PHONE (LANDLINE / OFFICE) WITH FLEX INPUT GROUP (ZERO OVERLAP EVER) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Phone (Landline / Office)
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 bg-white shadow-2xs hover:border-slate-400 focus-within:border-[#00378C] focus-within:ring-2 focus-within:ring-[#00378C]/15 transition-all overflow-hidden">
                  {/* Pinned Country Flag & Dial Code Pill */}
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-50/90 border-r border-slate-200 select-none shrink-0">
                    <span
                      className={`fi fi-${selectedCountryMeta.iso2} shrink-0 rounded-[2px] shadow-2xs border border-slate-200/60`}
                      style={{ width: 18, height: 13.5 }}
                    />
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {selectedCountryMeta.dialCode || "+"}
                    </span>
                  </div>
                  {/* Clean Input Field */}
                  <input
                    type="tel"
                    placeholder={selectedCountryMeta.iso2 === "sa" ? "11 234 5678" : "24 123 456"}
                    value={phoneDigits}
                    onChange={onPhoneChange}
                    className="flex-1 w-full px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 bg-transparent border-0 outline-none font-mono font-medium focus:ring-0"
                  />
                </div>
              </div>

              {/* Street Address / Building Details */}
              <div className="col-span-full">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Street Address / Building Details
                </label>
                <input
                  type="text"
                  placeholder="Street, District, Building No, Postal Code..."
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 3: TAX & CREDIT DETAILS
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all cursor-pointer shadow-2xs"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs cursor-pointer"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
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
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-[#00378C] focus:ring-2 focus:ring-[#00378C]/15 transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-extrabold text-slate-700 uppercase tracking-wider hover:bg-slate-50 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            DISCARD
          </button>

          <button
            type="button"
            onClick={(e) => void handleSave(e)}
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

      {/* =========================================================================
          PORTALED SEARCHABLE COUNTRY LOOK FIELD POPOVER
         ========================================================================= */}
      {countryDropdownOpen &&
        createPortal(
          <div
            ref={countryMenuRef}
            style={countryMenuStyle}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl p-2.5 flex flex-col text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="relative mb-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={countrySearchInputRef}
                type="text"
                placeholder="Search country or code..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C]"
              />
              {countrySearch && (
                <button
                  type="button"
                  onClick={() => setCountrySearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scrollable Results List */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 max-h-56">
              {filteredCountries.map((c) => {
                const isSelected = c.country_code.toUpperCase() === countryCode.toUpperCase();
                const meta = getCountryMeta(c.country_code, c.country_name, c.short_desc);
                return (
                  <button
                    key={c.country_code}
                    type="button"
                    onClick={() => handleCountrySelect(c.country_code)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-left cursor-pointer ${
                      isSelected
                        ? "bg-[#00378C]/10 text-[#00378C] font-semibold"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`fi fi-${meta.iso2} shrink-0 rounded-[2px] shadow-2xs border border-slate-200/60`}
                        style={{ width: 18, height: 13.5 }}
                      />
                      <span className="truncate">{c.country_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono font-bold shrink-0">
                        {c.country_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {meta.dialCode && (
                        <span className="text-[11px] font-mono text-slate-400 font-medium">
                          {meta.dialCode}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#00378C]" />}
                    </div>
                  </button>
                );
              })}
              {filteredCountries.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching countries found
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* =========================================================================
          PORTALED SEARCHABLE CURRENCY LOOK FIELD POPOVER
         ========================================================================= */}
      {currencyDropdownOpen &&
        createPortal(
          <div
            ref={currencyMenuRef}
            style={currencyMenuStyle}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl p-2.5 flex flex-col text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="relative mb-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={currencySearchInputRef}
                type="text"
                placeholder="Search currency or name..."
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#00378C] focus:ring-1 focus:ring-[#00378C]"
              />
              {currencySearch && (
                <button
                  type="button"
                  onClick={() => setCurrencySearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scrollable Results List */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 max-h-56">
              {filteredCurrencies.map((c) => {
                const isSelected = c.curr_code.toUpperCase() === currCode.toUpperCase();
                const flagIso = getCurrencyFlag(c.curr_code);
                return (
                  <button
                    key={c.curr_code}
                    type="button"
                    onClick={() => {
                      setCurrCode(c.curr_code);
                      setCurrencyDropdownOpen(false);
                      setCurrencySearch("");
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-left cursor-pointer ${
                      isSelected
                        ? "bg-[#00378C]/10 text-[#00378C] font-semibold"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`fi fi-${flagIso} shrink-0 rounded-[2px] shadow-2xs border border-slate-200/60`}
                        style={{ width: 18, height: 13.5 }}
                      />
                      <span className="font-mono font-bold text-slate-900">{c.curr_code}</span>
                      <span className="truncate text-slate-600">{c.curr_name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#00378C] shrink-0 ml-2" />}
                  </button>
                );
              })}
              {filteredCurrencies.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching currencies found
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
