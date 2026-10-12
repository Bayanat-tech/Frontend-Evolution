import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Save } from "lucide-react";
import { getDynamicLookup } from "../api/lookups";
import { LookupField } from "./ui/LookupField";
import type { WmsMasterField, WmsMasterFormTab } from "../pages/wms/WmsSimpleMasterPage";
import type { LookupRow } from "../api/lookups";
import type { UserProfile } from "../types/auth";

interface DropdownOption {
  label: string;
  value: string;
  raw?: LookupRow;
}

type Props = {
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

const inputClass =
  "h-7 w-full rounded-md border bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed";
const inputOk = "border-slate-200 focus:border-[#00378C] focus:ring-[#00378C]/30";
const inputBad = "border-red-400 focus:border-red-500 focus:ring-red-300";

const COL_SPAN: Record<number, string> = { 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" };

function isEmpty(value: unknown) {
  return value === "" || value === null || value === undefined || (typeof value === "string" && !value.trim());
}

export function WmsMasterForm({
  fields,
  tabs,
  title = "Master",
  formId = "wms-master-form",
  fieldsPerRow = 4,
  form,
  editMode,
  saving,
  user,
  onChange,
  onSave,
}: Props) {
  const hasTabs = Boolean(tabs && tabs.length > 0);
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});

  useEffect(() => {
    setActiveTab(tabs?.[0]?.key ?? "__default");
  }, [tabs]);

  /* ---------------- helpers ---------------- */

  const isVisible = (field: WmsMasterField) => !(field.hideOnAdd && !editMode);
  const fieldTab = (field: WmsMasterField) => field.tab ?? tabs![0].key;
  const tabFields = (tabKey: string) =>
    (hasTabs ? fields.filter((f) => fieldTab(f) === tabKey) : fields).filter(isVisible);

  const validateField = (field: WmsMasterField, value: unknown): string => {
    if (field.maxLength && typeof value === "string" && value.length > field.maxLength) {
      return `Maximum ${field.maxLength} characters allowed`;
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

  const loadDropdownOptions = async (field: WmsMasterField): Promise<DropdownOption[]> => {
    if (!field.dropdownParam) return [];
    try {
      const params: Record<string, unknown> = { parameter: field.dropdownParam };
      const loginId = user?.loginid || user?.LOGINID;
      if (loginId) params.loginid = loginId;
      const companyCode = form.company_code || user?.company_code || user?.COMPANY_CODE;
      if (companyCode) params.code1 = companyCode;

      if (field.dropdownCodeMap) {
        let codeIndex = 2;
        for (const [fieldName] of Object.entries(field.dropdownCodeMap)) {
          if (fieldName === "company_code") continue;
          const value = form[fieldName];
          if (value) params[`code${codeIndex}`] = value;
          codeIndex++;
        }
      }

      const results = await getDynamicLookup(params as any);
      const labelKey = field.dropdownLabelKey || "label";
      const valueKey = field.dropdownValueKey || "value";
      const separator = field.dropdownDisplaySeparator || " - ";

      return results.map((row) => {
        const displayLabel = field.dropdownDisplayFields?.length
          ? field.dropdownDisplayFields.map((f) => String(row[f] || "")).filter(Boolean).join(separator)
          : String(row[labelKey] ?? row.label ?? row.name ?? row.description ?? "");
        return {
          label: displayLabel,
          value: String(row[valueKey] ?? row.value ?? row.code ?? row.id ?? ""),
          raw: row,
        };
      });
    } catch (error) {
      console.error(`Error loading dropdown for ${field.name}:`, error);
      return [];
    }
  };

  /* ---------------- field rendering ---------------- */

  const renderField = (field: WmsMasterField) => {
    const value = form[field.name];
    const disabled = Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form));
    const error = fieldErrors[field.name];
    const border = error ? inputBad : inputOk;

    const spanClass =
      field.type === "textarea"
        ? "col-span-full"
        : field.colSpan && COL_SPAN[field.colSpan]
          ? COL_SPAN[field.colSpan]
          : "";

    const errorText = error ? <span className="mt-0.5 text-[10px] font-medium text-red-600">{error}</span> : null;

    // Shared label used by all field types (including LookupField) so labels are always visible
    // and styled consistently.
    const label = (
      <div className="mb-0.5 flex items-center justify-between">
        <label className="block text-[11px] font-medium text-slate-600 text-left">
          {field.label}
          {field.required && <span className="text-destructive font-bold ml-0.5" style={{ color: "#E24B4A" }}>*</span>}
        </label>
        {field.maxLength && typeof value === "string" && (
          <span className={`text-[10px] font-medium ${value.length > field.maxLength ? "text-red-600" : "text-slate-400"}`}>
            {value.length}/{field.maxLength}
          </span>
        )}
      </div>
    );

    if (field.type === "checkbox") {
      const checked = value === true || value === "true" || value === "Y";
      return (
        <div key={field.name} className={`flex flex-col justify-end ${spanClass}`}>
          <label className="inline-flex h-7 cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 accent-[#00378C] disabled:opacity-50"
            />
            <span className="text-sm text-slate-900">
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
          <div key={field.name} className={`flex flex-col ${spanClass}`}>
            {label}
            <select
              disabled={disabled}
              value={String(value ?? "")}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`${inputClass} ${border}`}
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

      // Lookup / async dropdown: render the same outer label as other fields so it is always
      // visible. Do not pass a label into LookupField when compact, to avoid a second (or
      // missing) label inside the component.
      return (
        <div key={field.name} className={`flex flex-col ${spanClass}`}>
          {label}
          <LookupField
            key={`${field.name}__${getFieldDependencyKey(field, form)}`}
            value={String(value ?? "")}
            displayValue={undefined}
            columns={[{ field: "label", header: "Label" }]}
            valueField="value"
            displayFields={["label"]}
            loadOptions={async () => {
              const options = await loadDropdownOptions(field);
              return options.map((opt) => ({ ...(opt.raw || {}), value: opt.value, label: opt.label }));
            }}
            onChange={(val) => handleFieldChange(field.name, val)}
            disabled={disabled}
            placeholder={`Search ${field.label}…`}
            compact
          />
          {errorText}
        </div>
      );
    }

    let control: ReactNode;
    if (field.type === "textarea") {
      control = (
        <textarea
          disabled={disabled}
          maxLength={field.maxLength}
          value={String(value ?? "")}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          className={`w-full h-[52px] resize-none rounded-md border bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-500 ${border}`}
        />
      );
    } else {
      const tooLong = field.maxLength && String(value ?? "").length > field.maxLength;
      control = (
        <input
          disabled={disabled}
          type={
            field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "date" ? "date" : "text"
          }
          value={String(value ?? "")}
          onChange={(e) =>
            handleFieldChange(field.name, field.type === "number" ? Number(e.target.value || 0) : e.target.value)
          }
          className={`${inputClass} ${tooLong ? inputBad : border}`}
        />
      );
    }

    return (
      <div key={field.name} className={`flex flex-col ${spanClass}`}>
        {label}
        {control}
        {errorText}
      </div>
    );
  };

  const renderSections = (tabKey?: string) => {
    const list = tabFields(tabKey ?? "__default");
    const sections: Record<string, WmsMasterField[]> = {};
    list.forEach((field) => {
      const key = field.section || "__default";
      (sections[key] ||= []).push(field);
    });

    const defaultTitle = hasTabs ? tabs!.find((t) => t.key === tabKey)?.label ?? "Details" : `${title} Details`;
    const fieldsStyle = { "--cols": fieldsPerRow } as CSSProperties;
    const fieldsCls =
      fieldsPerRow > 1
        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-x-3 gap-y-2.5"
        : "grid grid-cols-1 gap-y-2.5";

    return (
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(sections).map(([sectionKey, sectionFields]) => (
          <div key={sectionKey} className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 rounded-t-lg border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00378C]/10 text-[#00378C]">
                <FileText size={12} />
              </div>
              <h3 className="m-0 text-xs font-semibold text-slate-800">
                {sectionKey === "__default" ? defaultTitle : sectionKey}
              </h3>
            </div>
            <div className="p-3">
              <div className={fieldsCls} style={fieldsStyle}>
                {sectionFields.map(renderField)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ---------------- layout ---------------- */

  return (
    <form id={formId} className="flex flex-col gap-2" onSubmit={handleSubmit} noValidate>
      {/* ---------- Step strip (only when tabs are provided) ---------- */}
      {hasTabs && (
        <div className="flex items-center gap-0 overflow-x-auto rounded-lg border border-slate-200 bg-white px-2 shadow-sm">
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
                      ? "text-[#00378C] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t-full after:bg-[#00378C]"
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

      {/* ---------- Back / Next (only when tabs are provided).
          Save lives in the page header (formId), so the last step has no bottom Save/Submit. */}
      {hasTabs && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            disabled={activeTabIndex === 0 || saving}
            onClick={() => goToTab(activeTabIndex - 1)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={13} /> Back
          </button>

          <span className="text-[11px] text-slate-500">
            Step {activeTabIndex + 1} of {tabs!.length}
          </span>

          {!isLastTab ? (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#00378C] px-3 text-xs font-semibold text-white shadow-sm hover:bg-[#002d72] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next <ChevronRight size={13} />
            </button>
          ) : (
            // Keep layout balanced on the last step; header Save is the only submit control.
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
  return deps.length > 0 ? deps.join("__") : Date.now().toString();
}