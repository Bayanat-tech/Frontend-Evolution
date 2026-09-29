import { useEffect, useState } from "react";
import { X, CheckCircle2, ChevronRight, Loader2, Plus, RefreshCw, PackageCheck } from "lucide-react";
import type { FormEvent } from "react";
import { getDynamicLookup } from "../api/lookups";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
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
  tabs?: WmsMasterFormTab[];
  fieldsPerRow?: number;
  form: Record<string, unknown>;
  editMode: boolean;
  saving: boolean;
  user?: UserProfile | null;
  onChange: (name: string, value: unknown) => void;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
};

type FieldError = { [key: string]: string };

/* Section panel — EXACT Freight structure. CSS does the styling. */
function SectionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof PackageCheck;
  children: React.ReactNode;
}) {
  return (
    <section className="freight-panel overflow-hidden rounded-md border bg-background shadow-sm">
      <div className="freight-panel-title flex items-center justify-between gap-2 border-b bg-muted/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="freight-section-icon">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[11px] font-semibold text-foreground">{title}</h3>
          </div>
        </div>
      </div>
      <div className="freight-panel-body p-3">{children}</div>
    </section>
  );
}

export function WmsMasterForm({
  fields, tabs, fieldsPerRow = 2, form, editMode, saving, user, onChange, onSave, onCancel,
}: Props) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});

  useEffect(() => {
    setActiveTab(tabs?.[0]?.key ?? "__default");
  }, [tabs]);

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

  const hasTabs = tabs && tabs.length > 0;
  const activeTabIndex = tabs?.findIndex((t) => t.key === activeTab) ?? 0;
  const isLastTab = activeTabIndex === (tabs?.length ?? 1) - 1;

  const handleTabNext = () => {
    if (tabs && activeTabIndex < tabs.length - 1) {
      setActiveTab(tabs[activeTabIndex + 1].key);
    }
  };

  const renderFields = (tabKey?: string) => {
    const visible = hasTabs ? fields.filter((f) => (f.tab ?? tabs![0].key) === tabKey) : fields;
    const filtered = visible.filter((f) => !(f.hideOnAdd && !editMode));

    const sections: Record<string, typeof filtered> = {};
    filtered.forEach((field) => {
      const sectionKey = field.section || "__default";
      if (!sections[sectionKey]) sections[sectionKey] = [];
      sections[sectionKey].push(field);
    });

    return (
      <div className="grid gap-3">
        {Object.entries(sections).map(([sectionKey, sectionFields]) => (
          <SectionPanel key={sectionKey} title={sectionKey !== "__default" ? sectionKey : "Basic Information"} icon={PackageCheck}>
            <div
              className="wms-fields-grid grid gap-x-3 gap-y-3 grid-cols-1"
              style={{ gridTemplateColumns: undefined }}
            >
              <style>{`
                @media (min-width: 640px) {
                  .wms-fields-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                }
                @media (min-width: 1024px) {
                  .wms-fields-grid { grid-template-columns: repeat(${fieldsPerRow}, minmax(0, 1fr)) !important; }
                }
              `}</style>
              {sectionFields.map((field) => {
                const spanClass = field.colSpan === 1
                  ? "md:col-span-1"
                  : field.type === "textarea"
                  ? "col-span-full"
                  : "";
                const isCheckbox = field.type === "checkbox";
                const hasError = fieldErrors[field.name];
                const disabled = Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form));

                return isCheckbox ? (
                  <div key={field.name} className={`flex items-center py-1 ${spanClass}`}>
                    {renderInput(field, form[field.name], disabled, form, handleFieldChange, loadDropdownOptions)}
                  </div>
                ) : (
                  <label key={field.name} className={`freight-field-label group flex flex-col gap-0.5 ${spanClass}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                        {field.label}
                        {field.required && <strong className="text-destructive ml-0.5 font-bold"> *</strong>}
                      </span>
                      {field.maxLength && typeof form[field.name] === "string" && (
                        <span
                          className={`text-[9px] font-medium ${
                            (form[field.name] as string).length > field.maxLength
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {(form[field.name] as string).length}/{field.maxLength}
                        </span>
                      )}
                    </div>
                    {renderInput(field, form[field.name], disabled, form, handleFieldChange, loadDropdownOptions)}
                    {hasError && <span className="text-[9px] text-destructive font-medium">{hasError}</span>}
                  </label>
                );
              })}
            </div>
          </SectionPanel>
        ))}
      </div>
    );
  };

  const submitLabel = hasTabs ? (isLastTab ? (editMode ? "Update Record" : "Save Record") : "Next") : (editMode ? "Update" : "Add");
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
    <form
      className="freight-workspace-ui freight-dense-form freight-ui-standard flex flex-col gap-2"
      onSubmit={handleSubmitOrNext}
    >
      {hasTabs ? (
        <div className="freight-tabs-shell grid gap-0 rounded-md border bg-card shadow-sm">
          <div className="freight-tabs-list flex overflow-x-auto">
            {tabs!.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={activeTab === tab.key}
                className={`freight-workspace-tab ${activeTab === tab.key ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="freight-tabs-panel border-t p-3">{renderFields(activeTab)}</div>
        </div>
      ) : (
        <div className="p-3">{renderFields()}</div>
      )}

      {/* Bottom action row (Freight style) */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
        >
          <X size={11} /> Cancel
        </button>
        <div className="flex items-center gap-2">
          {hasTabs && (
            <span className="text-[9px] text-muted-foreground">
              Step {activeTabIndex + 1} of {tabs!.length}
            </span>
          )}
          <button
            disabled={saving}
            type="submit"
            className={`inline-flex items-center gap-1 rounded-md px-4 py-2 sm:py-1.5 min-h-[36px] sm:min-h-0 text-[10px] font-semibold shadow-sm transition-all ${
              saving
                ? "bg-primary/60 text-primary-foreground cursor-not-allowed"
                : editMode
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {saving ? (
              <>
                <Loader2 size={11} className="animate-spin" /> Saving…
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

function renderInput(
  field: WmsMasterField,
  value: unknown,
  disabled: boolean,
  form: Record<string, unknown>,
  onChange: (name: string, value: unknown) => void,
  loadDropdownOptions: (field: WmsMasterField) => Promise<DropdownOption[]>,
) {
  const baseInputClass = "w-full";

  if (field.type === "select" || field.asyncOptions || field.dropdownParam) {
    if (!field.asyncOptions && !field.dropdownParam && field.options) {
      return (
        <Select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(field.name, event.target.value)}
          className={baseInputClass}
        >
          <option value="">— Select {field.label} —</option>
          {field.options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    }
    return (
      <LookupField
        label=""
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
        onChange={(val) => onChange(field.name, val)}
        disabled={disabled}
        placeholder={`Search ${field.label}…`}
        compact
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        disabled={disabled}
        maxLength={field.maxLength}
        rows={2}
        value={String(value ?? "")}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

if (field.type === "checkbox") {
  const isChecked = value === true || value === "true" || value === "Y";
  return (
    <div className="inline-flex items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={isChecked}
        disabled={disabled}
        onChange={(e) => onChange(field.name, e.target.checked)}
        style={{ accentColor: "#00378C", width: "15px", height: "15px" }}
        className="shrink-0 cursor-pointer rounded border border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00378C]/25 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span
        onClick={() => !disabled && onChange(field.name, !isChecked)}
        className={`text-[11.5px] font-medium text-slate-700 leading-none transition-colors ${
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:text-slate-900"
        }`}
      >
        {field.label}
        {field.required === true && (
          <strong className="text-destructive ml-0.5 font-bold"> *</strong>
        )}
      </span>
    </div>
  );
}

  return (
    <Input
      disabled={disabled}
      type={
        field.type === "number"
          ? "number"
          : field.type === "email"
          ? "email"
          : field.type === "date"
          ? "date"
          : "text"
      }
      value={String(value ?? "")}
      onChange={(e) =>
        onChange(field.name, field.type === "number" ? Number(e.target.value || 0) : e.target.value)
      }
      className={baseInputClass}
    />
  );
}