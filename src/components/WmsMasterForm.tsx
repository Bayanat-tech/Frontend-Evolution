import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  Anchor,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileText,
  MapPin,
  MapPinned,
  Network,
  PackageCheck,
  Phone,
  Plane,
  Save,
  Settings,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { getDynamicLookup, getLookupValue } from "../api/lookups";
import { LookupField } from "./ui/LookupField";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import { Button } from "./ui/Button";
import type { WmsMasterField, WmsMasterFormTab } from "../pages/wms/WmsSimpleMasterPage";
import type { LookupRow } from "../api/lookups";
import type { UserProfile } from "../types/auth";
import { isValidEmail, isValidPhoneNumber, sanitizePhoneNumber } from "../utils/inputValidation";

interface DropdownOption {
  label: string;
  value: string;
  raw?: LookupRow;
}

type Props = {
  characterLimitCards?: boolean;
  fields: WmsMasterField[];
  /** Optional. When provided (and non-empty) the form is split into steps with Back / Next buttons. */
  tabs?: WmsMasterFormTab[];
  /** Used for the default section heading, e.g. "Location Details". */
  title?: string;
  /** id applied to the <form> so the page header can submit it. */
  formId?: string;
  fieldsPerRow?: number;
  form: Record<string, unknown>;
  editMode: boolean;
  saving: boolean;
  user?: UserProfile | null;
  onChange: (name: string, value: unknown) => void;
  onSave: (e: FormEvent) => void;
  onCancel?: () => void;
};

type FieldError = Record<string, string>;

function isEmpty(value: unknown) {
  return value === "" || value === null || value === undefined || (typeof value === "string" && !value.trim());
}

function getSectionIcon(sectionName: string) {
  const s = sectionName.toLowerCase();
  if (s.includes("route") || s.includes("airline") || s.includes("flight")) return Plane;
  if (s.includes("port") || s.includes("vessel") || s.includes("sea")) return Anchor;
  if (s.includes("address") || s.includes("location") || s.includes("territory") || s.includes("destination") || s.includes("source")) return MapPinned;
  if (s.includes("contact") || s.includes("phone") || s.includes("email") || s.includes("person")) return Phone;
  if (s.includes("finance") || s.includes("tax") || s.includes("account") || s.includes("credit") || s.includes("billing") || s.includes("currency") || s.includes("pricing") || s.includes("tariff") || s.includes("cost")) return Coins;
  if (s.includes("custom") || s.includes("license") || s.includes("legal") || s.includes("reg") || s.includes("security")) return ShieldCheck;
  if (s.includes("org") || s.includes("division") || s.includes("dept") || s.includes("network")) return Network;
  if (s.includes("pick") || s.includes("storage") || s.includes("cargo") || s.includes("product") || s.includes("shipment") || s.includes("pack") || s.includes("warehouse") || s.includes("item")) return PackageCheck;
  if (s.includes("setting") || s.includes("rule") || s.includes("config") || s.includes("param") || s.includes("general")) return Settings;
  if (s.includes("transporter") || s.includes("fleet") || s.includes("truck")) return Truck;
  if (s.includes("company") || s.includes("identity") || s.includes("basic") || s.includes("partner") || s.includes("broker") || s.includes("forwarder") || s.includes("principal")) return Building2;
  return FileText;
}

function getGridColsClass(fields: WmsMasterField[]) {
  const hasSpans = fields.some((f) => f.colSpan && f.colSpan > 1);
  if (!hasSpans && fields.length === 4) {
    return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5";
  }
  if (!hasSpans && fields.length === 3) {
    return "grid grid-cols-1 sm:grid-cols-3 gap-2.5";
  }
  if (!hasSpans && fields.length === 2) {
    return "grid grid-cols-1 sm:grid-cols-2 gap-2.5";
  }
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5";
}

export function WmsMasterForm({
  characterLimitCards = false,
  fields,
  tabs,
  title = "Master",
  formId = "wms-master-form",
  form,
  editMode,
  saving,
  user,
  onChange,
  onSave,
  onCancel,
}: Props) {
  const TextControl = characterLimitCards ? Input : "input";
  const MultilineControl = characterLimitCards ? Textarea : "textarea";
  const hasTabs = Boolean(tabs && tabs.length > 0);
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [dropdownCache, setDropdownCache] = useState<Record<string, DropdownOption[]>>({});

  useEffect(() => {
    setActiveTab(tabs?.[0]?.key ?? "__default");
  }, [tabs]);

  useEffect(() => {
    fields.forEach((field) => {
      if (field.dropdownParam) {
        const depKey = getFieldDependencyKey(field, form);
        const cacheKey = `${field.name}__${depKey}`;
        if (!dropdownCache[cacheKey]) {
          loadDropdownOptions(field, cacheKey);
        }
      }
    });
  }, [fields, form]);

  /* ---------------- helpers ---------------- */

  const isVisible = (field: WmsMasterField) => !(field.hideOnAdd && !editMode);
  const fieldTab = (field: WmsMasterField) => field.tab ?? tabs![0].key;
  const tabFields = (tabKey: string) =>
    (hasTabs ? fields.filter((f) => fieldTab(f) === tabKey) : fields).filter(isVisible);

  const validateField = (field: WmsMasterField, value: unknown): string => {
    const strVal = String(value ?? "").trim();
    if (field.maxLength && typeof value === "string" && value.length > field.maxLength) {
      return `Maximum ${field.maxLength} characters allowed`;
    }
    if (characterLimitCards && field.maxLength && typeof value === "string" && new TextEncoder().encode(value).length > field.maxLength) {
      return `Maximum ${field.maxLength} UTF-8 bytes allowed`;
    }
    const isEmail = field.type === "email" || /(^|_)(email|e_mail)(_|$)/i.test(field.name);
    if (isEmail && strVal && !isValidEmail(strVal)) {
      return "Invalid email address (e.g. name@domain.com)";
    }
    const isPhone = /(^|_)(phone|mobile|tel|telephone|fax)(_|$|[0-9])/i.test(field.name);
    if (isPhone && strVal && !isValidPhoneNumber(strVal)) {
      return `${field.label} must contain numbers only`;
    }
    return "";
  };

  const handleFieldChange = (name: string, value: unknown) => {
    const field = fields.find((f) => f.name === name);
    if (field) {
      setFieldErrors((prev) => ({ ...prev, [name]: validateField(field, value) }));
    }
    onChange(name, value);
  };

  /** Validates every visible field of one tab (or the whole form when there are no tabs). */
  const validateTab = (tabKey: string): boolean => {
    const list = tabFields(tabKey);
    const errs: FieldError = {};
    list.forEach((field) => {
      if (field.autoGenerated && !editMode) return;
      const value = form[field.name];
      if (field.required && field.type !== "checkbox" && isEmpty(value)) {
        errs[field.name] = `${field.label} is required`;
      } else {
        const lengthError = validateField(field, value);
        if (lengthError) errs[field.name] = lengthError;
      }
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      list.forEach((field) => delete next[field.name]);
      return { ...next, ...errs };
    });
    return Object.keys(errs).length === 0;
  };

  const isTabCompleted = (tabKey: string): boolean => {
    const required = tabFields(tabKey).filter((f) => f.required && f.type !== "checkbox");
    if (!required.length) return false;
    return required.every((f) => !isEmpty(form[f.name]));
  };

  const hasTabErrors = (tabKey: string): boolean => tabFields(tabKey).some((f) => fieldErrors[f.name]);

  const activeTabIndex = Math.max(0, tabs?.findIndex((t) => t.key === activeTab) ?? 0);
  const isLastTab = !hasTabs || activeTabIndex === tabs!.length - 1;

  /** Jump to a step. Moving forward is only allowed when every step before it has valid entries. */
  const goToTab = (index: number) => {
    if (!tabs) return;
    if (index <= activeTabIndex) {
      setActiveTab(tabs[index].key);
      return;
    }
    for (let i = activeTabIndex; i < index; i++) {
      if (!validateTab(tabs[i].key)) {
        setActiveTab(tabs[i].key);
        return;
      }
    }
    setActiveTab(tabs[index].key);
  };

  const handleSubmit = (event: FormEvent) => {
    if (hasTabs && !isLastTab) {
      event.preventDefault();
      goToTab(activeTabIndex + 1);
      return;
    }
    if (hasTabs) {
      // Final step: every step must be valid before saving.
      for (const tab of tabs!) {
        if (!validateTab(tab.key)) {
          event.preventDefault();
          setActiveTab(tab.key);
          return;
        }
      }
    } else if (!validateTab("__default")) {
      event.preventDefault();
      return;
    }
    onSave(event);
  };

  /* ---------------- lookups ---------------- */

  const loadDropdownOptions = async (field: WmsMasterField, customKey?: string): Promise<DropdownOption[]> => {
    if (!field.dropdownParam) return [];
    try {
      const params: Record<string, unknown> = { parameter: field.dropdownParam };
      const loginId = user?.loginid || user?.LOGINID;
      if (loginId) params.loginid = loginId;
      const companyCode = form.company_code || user?.company_code || user?.COMPANY_CODE;
      if (companyCode) params.code1 = companyCode;

      if (field.dropdownCodeMap) {
        for (const [fieldName, paramKey] of Object.entries(field.dropdownCodeMap)) {
          const value = form[fieldName];
          if (paramKey) {
            params[paramKey] = value || "";
          } else if (fieldName !== "company_code") {
            params.code2 = value || "";
          }
        }
      }

      if (field.dropdownParam === "DROP_DOWN_CITY" || field.name.includes("city")) {
        const countryVal = String(form.country_code || form.tax_country_code || "").trim();
        params.country_code = countryVal;
        params.code1 = countryVal;
      }

      const results = await getDynamicLookup(params as any);
      const labelKey = field.dropdownLabelKey || "label";
      const valueKey = field.dropdownValueKey || "value";
      const separator = field.dropdownDisplaySeparator || " - ";

      const options: DropdownOption[] = results.map((row) => {
        const displayLabel = field.dropdownDisplayFields?.length
          ? field.dropdownDisplayFields
              .map((f) => String(getLookupValue(row, f) ?? ""))
              .filter(Boolean)
              .join(separator)
          : String(
              getLookupValue(row, labelKey) ||
              getLookupValue(row, "label") ||
              getLookupValue(row, "name") ||
              getLookupValue(row, "description") ||
              ""
            );
        const optValue = String(
          getLookupValue(row, valueKey) ||
          getLookupValue(row, "value") ||
          getLookupValue(row, "code") ||
          getLookupValue(row, "id") ||
          ""
        );
        return {
          label: displayLabel || optValue,
          value: optValue,
          raw: row,
        };
      });

      const deduplicated: DropdownOption[] = [];
      const seenVals = new Set<string>();
      for (const opt of options) {
        if (!opt.value) continue;
        if (!seenVals.has(opt.value)) {
          seenVals.add(opt.value);
          deduplicated.push(opt);
        }
      }
      const cacheKey = customKey || field.name;
      setDropdownCache((prev) => {
        return { ...prev, [cacheKey]: deduplicated, [field.name]: deduplicated };
      });
      return deduplicated;
    } catch (error) {
      console.error(`Error loading dropdown for ${field.name}:`, error);
      return [];
    }
  };

  /* ---------------- field rendering ---------------- */

  const renderField = (field: WmsMasterField) => {
    const rawValue = form[field.name];
    const isAuto = Boolean(field.autoGenerated && !editMode);
    const value = isAuto ? (rawValue || "Auto Generated") : rawValue;
    const disabled = isAuto || Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form));
    const error = isAuto ? null : fieldErrors[field.name];

    let spanClass = "col-span-1";
    if (field.type === "textarea") {
      if (field.colSpan === 2) spanClass = "col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2";
      else if (field.colSpan === 3) spanClass = "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-3";
      else if (field.colSpan && field.colSpan >= 4) spanClass = "col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-4";
      else spanClass = "col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2";
    } else if (field.colSpan === 2) {
      spanClass = "col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2";
    } else if (field.colSpan === 3) {
      spanClass = "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-3";
    } else if (field.colSpan && field.colSpan >= 4) {
      spanClass = "col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-4";
    }

    const errorText = error ? <span className="mt-0.5 text-[10px] font-medium text-red-600">{error}</span> : null;
    const isGlAccount = field.name === "broker_acref" || field.name === "ac_code" || field.name === "prin_acref";

    const label = (
      <div className="freight-master-label">
        <span className="truncate">{field.label}</span>
        {isGlAccount && (
          <span className="text-[10px] text-emerald-600 font-normal lowercase tracking-normal ml-1">
            (auto-created if blank)
          </span>
        )}
        {field.required && !isAuto && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>}
        {field.maxLength && typeof value === "string" && !isAuto && (
          <span className={`ml-auto text-[10px] font-medium lowercase ${value.length > field.maxLength ? "text-red-600 font-bold" : "text-slate-400"}`}>
            {value.length}/{field.maxLength}
          </span>
        )}
      </div>
    );

    if (field.type === "checkbox") {
      const checked = value === true || value === "true" || value === "Y";
      return (
        <div key={field.name} className={`freight-master-field flex flex-col justify-end ${spanClass}`}>
          <div className="freight-master-label select-none opacity-0" aria-hidden>&nbsp;</div>
          <label className="flex h-[32px] cursor-pointer select-none items-center gap-2 rounded-md border border-slate-200 bg-[#f8f9fb] px-2.5 transition-colors hover:bg-white hover:border-[#00378C]/40">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 accent-[#00378C] disabled:opacity-50"
            />
            <span className="text-xs font-semibold text-slate-700 truncate">
              {field.label}
              {field.required && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>}
            </span>
          </label>
          {errorText}
        </div>
      );
    }

    

    if (field.type === "select" || field.asyncOptions || field.dropdownParam) {
      if (!field.asyncOptions && !field.dropdownParam && field.options) {
        return (
          <div key={field.name} className={`freight-master-field flex flex-col ${spanClass}`}>
            {label}
            <select
              disabled={disabled}
              value={String(value ?? "")}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`freight-master-select ${error ? "border-red-400 focus:border-red-500" : ""}`}
            >
              <option value="">Select {field.label}</option>
              {field.options.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errorText}
          </div>
        );
      }

      const stringVal = String(value ?? "").trim();
      const cachedOption = (dropdownCache[field.name] || []).find(
        (opt) => String(opt.value).trim() === stringVal
      );

      return (
        <div key={field.name} className={`freight-master-field flex flex-col ${spanClass}`}>
          {label}
          <LookupField
            key={`${field.name}__${getFieldDependencyKey(field, form)}`}
            value={stringVal}
            displayValue={cachedOption ? cachedOption.label : undefined}
            columns={
              field.dropdownParam === "DROP_DOWN_CITY" || field.name.includes("city")
                ? [
                    { field: "label", header: "City Name" },
                    { field: "city_code", header: "Code", width: 90 },
                  ]
                : [
                    { field: "value", header: "Code", width: 100 },
                    { field: "label", header: "Description" },
                  ]
            }
            allowCustomValue={Boolean(field.dropdownParam === "DROP_DOWN_CITY" || field.name.includes("city") || field.type === "combobox")}
            valueField="value"
            displayFields={["label"]}
            loadOptions={async () => {
              const options = await loadDropdownOptions(field);
              return options.map((opt) => ({ ...(opt.raw || {}), value: opt.value, label: opt.label }));
            }}
            onChange={(val, row) => {
              handleFieldChange(field.name, val);
              if (row && typeof row.label === "string") {
                setDropdownCache((prev) => ({
                  ...prev,
                  [field.name]: [
                    ...(prev[field.name] || []).filter((o) => o.value !== val),
                    { label: row.label as string, value: val, raw: row },
                  ],
                }));
              }
            }}
            disabled={disabled}
            placeholder={isGlAccount ? "Auto-creates in Chart of Accounts if blank..." : `Search ${field.label}…`}
            compact
          />
          {isGlAccount && (
            <span className="mt-0.5 text-[9px] font-medium text-emerald-700">
              {stringVal
                ? `🔗 Linked to GL Account: ${cachedOption ? cachedOption.label : stringVal}`
                : "💡 Leave blank to auto-create under Chart of Accounts L4 (20206)"}
            </span>
          )}
          {(field.dropdownParam === "DROP_DOWN_CITY" || field.name.includes("city")) && (
            <span className="mt-0.5 text-[9px] font-medium text-slate-500">
              {form.country_code
                ? `💡 Cities for ${form.country_code} (or search / enter custom)`
                : "💡 Select Country to filter cities (or search / enter custom)"}
            </span>
          )}
          {errorText}
        </div>
      );
    }

    let control: ReactNode;
    if (field.type === "textarea") {
      control = (
        <MultilineControl
          {...(characterLimitCards ? { maxBytes: field.maxLength } : {})}
          disabled={disabled}
          maxLength={field.maxLength}
          value={String(value ?? "")}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          className={`freight-master-input min-h-[60px] h-[60px] py-1.5 resize-none ${error ? "border-red-400 focus:border-red-500" : ""}`}
        />
      );
    } else {
      const isPhone = /(^|_)(phone|mobile|tel|telephone|fax)(_|$|[0-9])/i.test(field.name);
      const isEmail = field.type === "email" || /(^|_)(email|e_mail)(_|$)/i.test(field.name);
      const tooLong = field.maxLength && String(value ?? "").length > field.maxLength;
      control = (
        <TextControl
          {...(characterLimitCards ? { maxBytes: field.maxLength } : {})}
          disabled={disabled}
          maxLength={characterLimitCards ? field.maxLength : undefined}
          type={
            field.type === "number"
              ? "number"
              : isEmail
              ? "email"
              : isPhone
              ? "tel"
              : field.type === "date"
              ? "date"
              : "text"
          }
          value={String(value ?? "")}
          placeholder={isAuto ? "Auto Generated" : field.placeholder}
          onChange={(e) => {
            if (isAuto) return;
            const rawVal = e.target.value;
            const finalVal = isPhone
              ? sanitizePhoneNumber(rawVal)
              : field.type === "number"
              ? Number(rawVal || 0)
              : rawVal;
            handleFieldChange(field.name, finalVal);
          }}
          className={`freight-master-input ${field.type === "number" ? "numeric" : ""} ${isAuto ? "bg-slate-100 text-slate-500 font-medium italic cursor-not-allowed select-none" : ""} ${tooLong || error ? "border-red-400 focus:border-red-500" : ""}`}
        />
      );
    }

    return (
      <div key={field.name} className={`freight-master-field flex flex-col ${spanClass}`}>
        {label}
        {control}
        {errorText}
      </div>
    );
  };

  const renderSections = (tabKey?: string) => {
    const list = tabFields(tabKey ?? "__default");
    const sectionMap = new Map<string, WmsMasterField[]>();
    list.forEach((field) => {
      const key = field.section || "__default";
      if (!sectionMap.has(key)) {
        sectionMap.set(key, []);
      }
      sectionMap.get(key)!.push(field);
    });

    const defaultTitle = hasTabs ? tabs!.find((t) => t.key === tabKey)?.label ?? "Details" : `${title} Details`;

    return (
      <div className="flex flex-col gap-2.5">
        {Array.from(sectionMap.entries()).map(([sectionKey, sectionFields]) => {
          const SectionIcon = getSectionIcon(sectionKey === "__default" ? defaultTitle : sectionKey);
          return (
            <div key={sectionKey} className="freight-master-form-card">
              <div className="freight-master-form-header">
                <h3>
                  <span className="freight-section-icon">
                    <SectionIcon size={16} />
                  </span>
                  <span>{sectionKey === "__default" ? defaultTitle : sectionKey}</span>
                </h3>
                <span className="freight-master-form-subtitle">
                  {sectionFields.length} {sectionFields.length === 1 ? "field" : "fields"}
                </span>
              </div>
              <div className="freight-master-form-body">
                <div className={getGridColsClass(sectionFields)}>
                  {sectionFields.map(renderField)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ---------------- layout ---------------- */

  return (
    <form id={formId} className="wms-master-form-container flex flex-col gap-2.5" onSubmit={handleSubmit} noValidate autoComplete="off">
      {/* ---------- Step strip (only when tabs are provided) ---------- */}
      {hasTabs && (
        <div className="flex items-center gap-0 overflow-x-auto rounded-lg border border-slate-200 bg-white px-2 shadow-xs">
          {tabs!.map((tab, index) => {
            const completed = isTabCompleted(tab.key);
            const errored = !completed && hasTabErrors(tab.key);
            const current = activeTab === tab.key;
            return (
              <div key={tab.key} className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => goToTab(index)}
                  className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors ${
                    current
                      ? "text-[#00378C] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t-full after:bg-[#00378C]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      completed
                        ? "bg-green-500 text-white"
                        : errored
                          ? "bg-red-500 text-white"
                          : current
                            ? "bg-[#00378C] text-white"
                            : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {completed ? <CheckCircle2 size={9} /> : index + 1}
                  </span>
                  <span>{tab.label}</span>
                </button>
                {index < tabs!.length - 1 && <ChevronRight size={11} className="mx-0.5 shrink-0 text-slate-300" />}
              </div>
            );
          })}
        </div>
      )}

      {renderSections(hasTabs ? activeTab : undefined)}

      {/* ---------- Back / Next (only when tabs are provided) ---------- */}
      {hasTabs && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs">
          <button
            type="button"
            disabled={activeTabIndex === 0 || saving}
            onClick={() => goToTab(activeTabIndex - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={13} /> Back
          </button>

          <span className="text-[11px] font-medium text-slate-500">
            Step {activeTabIndex + 1} of {tabs!.length}
          </span>

          {!isLastTab ? (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[#00378C] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#002d72] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next <ChevronRight size={13} />
            </button>
          ) : (
            <div className="w-[72px]" aria-hidden />
          )}
        </div>
      )}


    </form>
  );
}

function getFieldDependencyKey(field: WmsMasterField, form: Record<string, unknown>): string {
  const deps: string[] = [];
  if (field.filterDependsOn) deps.push(String(form[field.filterDependsOn] ?? ""));
  if (field.dropdownCodeMap) {
    for (const [fieldName] of Object.entries(field.dropdownCodeMap)) {
      if (fieldName === "company_code") continue;
      deps.push(String(form[fieldName] ?? ""));
    }
  }
  if (field.asyncOptions?.dependsOn) deps.push(String(form[field.asyncOptions.dependsOn] ?? ""));
  return deps.length > 0 ? deps.join("__") : "static";
}
