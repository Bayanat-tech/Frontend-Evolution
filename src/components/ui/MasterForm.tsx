import { useEffect, useState } from "react";
import {  X, CheckCircle2, ChevronRight, Loader2, Plus, RefreshCw } from "lucide-react";
import type { FormEvent } from "react";
import { getDynamicLookup, LookupRow } from "../../api/lookups";
import { MasterField, MasterFormTab } from "./MasterPage";
import { UserProfile } from "../../types/auth";
import { Card, CardContent, CardHeader } from "./Card";
import { Select } from "./Select";
import { LookupField } from "./LookupField";
import { Input } from "./Input";


interface DropdownOption {
  label: string;
  value: string;
  raw?: LookupRow;
}

type Props = {
  fields: MasterField[];
  tabs?: MasterFormTab[];
  fieldsPerRow?: number;
  sectionsPerRow?: number;
  form: Record<string, unknown>;
  editMode: boolean;
  saving: boolean;
  user?: UserProfile | null;
  onChange: (name: string, value: unknown) => void;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
};

type FieldError = {
  [key: string]: string;
};

export function MasterForm({
  fields, tabs, fieldsPerRow = 2, sectionsPerRow = 1, form, editMode, saving, user, onChange, onSave, onCancel,
}: Props) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({})

  useEffect(() => {
    setActiveTab(tabs?.[0]?.key ?? "__default");
  }, [tabs]);

  const validateField = (field: MasterField, value: unknown): string => {
    if (field.maxLength && typeof value === 'string' && value.length > field.maxLength) {
      return `Maximum ${field.maxLength} characters allowed`;
    }
    return "";
  };

  const handleFieldChange = (name: string, value: unknown) => {
    const field = fields.find((f) => f.name === name);
    if (field) {
      const error = validateField(field, value);
      setFieldErrors((prev) => ({
        ...prev,
        [name]: error,
      }));
    }
    onChange(name, value);
  };

const loadDropdownOptions = async (field: MasterField): Promise<DropdownOption[]> => {
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
        ? field.dropdownDisplayFields
            .map((f) => String(row[f] || ""))
            .filter(Boolean)
            .join(separator)
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

  const hasTabs = tabs && tabs.length > 0;

  const isTabCompleted = (tabKey: string): boolean => {
    const tabFields = fields.filter((f) => (f.tab ?? tabs![0].key) === tabKey);
    const requiredFields = tabFields.filter((f) => f.required === true);
    if (requiredFields.length === 0) return false;
    return requiredFields.every((f) => {
      const value = form[f.name];
      return value !== "" && value !== null && value !== undefined && value !== 0;
    });
  };

  const hasTabErrors = (tabKey: string): boolean => {
    const tabFields = fields.filter((f) => (f.tab ?? tabs![0].key) === tabKey);
    const requiredFields = tabFields.filter((f) => f.required === true);
    return requiredFields.some((f) => {
      const value = form[f.name];
      return value === "" || value === null || value === undefined || value === 0;
    });
  };

  const activeTabIndex = tabs?.findIndex((t) => t.key === activeTab) ?? 0;
  const isLastTab = activeTabIndex === (tabs?.length ?? 1) - 1;

  const handleTabNext = () => {
    if (tabs && activeTabIndex < tabs.length - 1) {
      setActiveTab(tabs[activeTabIndex + 1].key);
    }
  };

  const renderFields = (tabKey?: string) => {
    const visible = hasTabs
      ? fields.filter((f) => (f.tab ?? tabs![0].key) === tabKey)
      : fields;

  const filtered = visible.filter((f) => !(f.hideOnAdd && !editMode));

    const sections: Record<string, typeof filtered> = {};
    filtered.forEach((field) => {
      const sectionKey = field.section || "__default";
      if (!sections[sectionKey]) sections[sectionKey] = [];
      sections[sectionKey].push(field);
    });

    return (
      <div className="wms-sections-grid grid gap-2 grid-cols-1">
        <style>{`
          @media (min-width: 1024px) {
            .wms-sections-grid {
              grid-template-columns: repeat(${sectionsPerRow}, minmax(0, 1fr)) !important;
            }
          }
        `}</style>
{Object.entries(sections).map(([sectionKey, sectionFields]) => (
  <div
    key={sectionKey}
    className="rounded-lg border border-border bg-slate-50 dark:bg-slate-800/40 p-2"
  >
    {sectionKey !== "__default" && (
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold text-primary uppercase tracking-widest px-1">
          {sectionKey}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )}
    <div className="wms-fields-grid grid gap-x-3 gap-y-3 grid-cols-1 sm:grid-cols-2">
            <style>{`
                @media (min-width: 768px) {
                  .wms-fields-grid {
                    grid-template-columns: repeat(${fieldsPerRow}, minmax(0, 1fr)) !important;
                  }
                }
              `}</style>
              {sectionFields.map((field) => {
                const spanClass =
                  field.colSpan === 1
                    ? "md:col-span-1"
                    : field.type === "textarea"
                    ? "col-span-full"
                    : "";
                const isCheckbox = field.type === "checkbox";
                const hasError = fieldErrors[field.name];

                return isCheckbox ? (
                  <div
                    key={field.name}
                    className={`flex items-center py-1 ${spanClass}`}
                  >
                    {renderInput(
                      field, form[field.name],
                      Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
                      form,
                      handleFieldChange,
                      loadDropdownOptions
                    )}
                  </div>
                ) : (
                  <label key={field.name} className={`group flex flex-col gap-0.5 ${spanClass}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                        {field.label}
                        {field.required === true && (
                          <strong className="text-destructive ml-0.5 font-bold"> *</strong>
                        )}
                        {field.maxLength && typeof form[field.name] === 'string' && (form[field.name] as string).length > field.maxLength && (
                          <span className="text-destructive ml-1 font-bold text-xs">●</span>
                        )}
                      </span>
                      {field.maxLength && typeof form[field.name] === 'string' && (
                        <span className={`text-[9px] font-medium ${
                          (form[field.name] as string).length > field.maxLength
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        }`}>
                          {(form[field.name] as string).length}/{field.maxLength}
                        </span>
                      )}
                    </div>
                    {renderInput(
                      field, form[field.name],
                      Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
                      form,
                      handleFieldChange,
                      loadDropdownOptions
                    )}
                    {hasError && (
                      <span className="text-[9px] text-destructive font-medium">{hasError}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ── Button label logic ── */
  const submitLabel = hasTabs
    ? isLastTab
      ? editMode
        ? "Update Record"
        : "Save Record"
      : "Next"
    : editMode
    ? "Update"
    : "Add";

  const submitIcon = hasTabs && !isLastTab
    ? <ChevronRight size={11} className="ml-1" />
    : saving
    ? <Loader2 size={11} className="ml-1 animate-spin" />
    : editMode
    ? <RefreshCw size={11} className="ml-1" />
    : <Plus size={11} className="ml-1" />;

  const handleSubmitOrNext = (e: FormEvent) => {
    if (hasTabs && !isLastTab) {
      e.preventDefault();
      handleTabNext();
    } else {
      onSave(e);
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmitOrNext}>
      {/* ── Tab Form ── */}
      {hasTabs ? (
        <Card className="overflow-hidden border-border shadow-sm">
          {/* Tab Strip */}
          {/* Mobile (<md): centered row of numbered circles connected by chevrons */}
          {/* Desktop (md+): left-aligned full label tabs */}

          {/* Mobile tab strip */}
          <div className="flex md:hidden items-center justify-center bg-muted/40 border-b border-border px-3 py-2 gap-1 flex-nowrap">
            {tabs!.map((tab, index) => {
              const completed = isTabCompleted(tab.key);
              const hasErrors = !completed && hasTabErrors(tab.key);
              const isCurrent = activeTab === tab.key;

              return (
                <div key={tab.key} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all
                      ${completed
                        ? "bg-green-500 text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                        : hasErrors
                        ? "bg-amber-400 text-white"
                        : "bg-muted-foreground/20 text-muted-foreground"
                      }`}
                  >
                    {completed ? <CheckCircle2 size={10} /> : index + 1}
                  </button>
                  {index < tabs!.length - 1 && (
                    <ChevronRight size={10} className="text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop tab strip */}
          <div className="hidden md:flex items-center bg-muted/40 border-b border-border px-3 gap-0">
            {tabs!.map((tab, index) => {
              const completed = isTabCompleted(tab.key);
              const hasErrors = !completed && hasTabErrors(tab.key);
              const isCurrent = activeTab === tab.key;

              return (
                <div key={tab.key} className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium transition-all whitespace-nowrap
                      ${isCurrent
                        ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t-full"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors
                        ${completed
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : hasErrors
                          ? "bg-amber-400 text-white"
                          : "bg-muted-foreground/20 text-muted-foreground"
                        }`}
                    >
                      {completed ? <CheckCircle2 size={9} /> : index + 1}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                  {index < tabs!.length - 1 && (
                    <ChevronRight size={11} className="text-muted-foreground/40 mx-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* MOBILE CHANGE: tighter padding on mobile */}
          <CardContent className="px-3 sm:px-4 py-3">
            {renderFields(activeTab)}
          </CardContent>
        </Card>
      ) : (
        /* ── Single Section Form ── */
        <Card className="overflow-hidden border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border px-3 sm:px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-1 rounded-full bg-primary" />
                <div>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {editMode ? "Edit Record" : "New Record"}
                  </p>
                  <h2 className="text-[11px] font-semibold text-foreground leading-tight">
                    Basic Information
                  </h2>
                </div>
              </div>
              {editMode && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-600 uppercase tracking-wide">
                  <RefreshCw size={8} /> Editing
                </span>
              )}
            </div>
          </CardHeader>
          {/* MOBILE CHANGE: tighter padding on mobile */}
          <CardContent className="px-3 sm:px-4 py-3">
            {renderFields()}
          </CardContent>
        </Card>
      )}

      {/* ── Action Row ── */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {/* MOBILE CHANGE: taller touch target on mobile */}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={11} /> Cancel
        </button>

        <div className="flex items-center gap-2">
          {/* Tab progress indicator */}
          {hasTabs && (
            <span className="text-[9px] text-muted-foreground">
              Step {activeTabIndex + 1} of {tabs!.length}
            </span>
          )}

          {/* MOBILE CHANGE: taller touch target on mobile */}
          <button
            disabled={saving}
            type="submit"
            className={`inline-flex items-center gap-1 rounded-md px-4 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-semibold shadow-sm transition-all
              ${saving
                ? "bg-primary/60 text-primary-foreground cursor-not-allowed"
                : editMode
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
          >
            {saving ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                {submitLabel}
                {submitIcon}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function getFieldDependencyKey(field: MasterField, form: Record<string, unknown>): string {
  const deps: string[] = [];

  if (field.filterDependsOn) {
    deps.push(String(form[field.filterDependsOn] ?? ""));
  }

  if (field.dropdownCodeMap) {
    for (const [fieldName] of Object.entries(field.dropdownCodeMap)) {
      if (fieldName === "company_code") continue;
      deps.push(String(form[fieldName] ?? ""));
    }
  }

  if (field.asyncOptions?.dependsOn) {
    deps.push(String(form[field.asyncOptions.dependsOn] ?? ""));
  }

  // If no dependencies, use a timestamp so it always remounts on open
  return deps.length > 0 ? deps.join("__") : Date.now().toString();
}

/* ─────────────────────────────────────────────
   renderInput — field-level renderer
───────────────────────────────────────────── */
function renderInput(
  field: MasterField,
  value: unknown,
  disabled: boolean,
  form: Record<string, unknown>,
  onChange: (name: string, value: unknown) => void,
  loadDropdownOptions: (field: MasterField) => Promise<DropdownOption[]>,
) {
  const baseInputClass =
    "h-8 sm:h-6 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

if (field.type === "select" || field.asyncOptions || field.dropdownParam) {
  if (!field.asyncOptions && !field.dropdownParam && field.options) {
    return (
      <Select
        disabled={disabled}
        value={String(value ?? "")}
        onChange={(event) => onChange(field.name, event.target.value)}
      >
        <option value="">— Select {field.label} —</option>
        {field.options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </Select>
    );
  }

  return (
    <LookupField
      label=""
      key={`${field.name}__${getFieldDependencyKey(field, form)}`}
      value={String(value ?? "")}
      displayValue={undefined}  // no cache to read display value from
      columns={[{ field: "label", header: "Label" }]}
      valueField="value"
      displayFields={["label"]}
      loadOptions={async () => {
        const options = await loadDropdownOptions(field);
        return options.map((opt) => ({ ...(opt.raw || {}), value: opt.value, label: opt.label }));
      }}
    onChange={(val, row) => {
    onChange(field.name, val);
    if (field.populateFields && row) {
        Object.entries(field.populateFields).forEach(([targetField, sourceKey]) => {
        onChange(targetField, row[sourceKey] ?? "");
        });
    }
    }}
      disabled={disabled}
      placeholder={`Search ${field.label}…`}
    />
  );
}

  if (field.type === "textarea") {
    return (
      <textarea
        className={`w-full rounded border bg-background px-2 py-1.5 sm:py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-1 focus:border-primary disabled:opacity-50 resize-none ${
          field.maxLength && String(value ?? "").length > field.maxLength
            ? "border-destructive focus:ring-destructive"
            : "border-input focus:ring-primary"
        }`}
        disabled={disabled}
        maxLength={field.maxLength}
        rows={3}
        value={String(value ?? "")}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === "checkbox") {
    const isChecked = value === true || value === "true" || value === "Y";
    return (
      /* MOBILE CHANGE: larger tap area for checkbox */
      <label className="inline-flex items-center gap-2 cursor-pointer select-none group min-h-[36px] sm:min-h-0">
        <input
          type="checkbox"
          checked={isChecked}
          disabled={disabled}
          onChange={(e) => onChange(field.name, e.target.checked)}
          className="sr-only"
        />
        {/* MOBILE CHANGE: slightly larger checkbox box on mobile */}
        <div
          className={`relative flex h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 items-center justify-center rounded-sm border-2 transition-all
            ${isChecked
              ? "bg-primary border-primary"
              : "border-input bg-background group-hover:border-primary/50"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isChecked && (
            <svg className="w-2 h-2 text-primary-foreground" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <span className="text-[11px] text-foreground leading-none">
          {field.label}
          {field.required === true && (
            <strong className="text-destructive ml-0.5"> *</strong>
          )}
        </span>
      </label>
    );
  }

  const hasError = field.maxLength && String(value ?? "").length > field.maxLength;
  return (
    <Input
      disabled={disabled}
      type={
        field.type === "number" ? "number"
        : field.type === "email" ? "email"
        : field.type === "date" ? "date"
        : "text"
      }
      value={String(value ?? "")}
      onChange={(e) =>
        onChange(
          field.name,
          field.type === "number" ? Number(e.target.value || 0) : e.target.value
        )
      }
      style={hasError ? { borderColor: "#dc2626", borderWidth: "2px" } : {}}
      className=""
    />
  );
}


