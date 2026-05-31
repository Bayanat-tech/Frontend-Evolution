import { useEffect, useState } from "react";
import { Save, X, CheckCircle2, ChevronRight, AlertCircle, Loader2, Plus, RefreshCw } from "lucide-react";
import type { FormEvent } from "react";
import { getWmsMaster } from "../api/wms";
import { getDynamicLookup } from "../api/lookups";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { LookupField } from "./ui/LookupField";
import type { WmsMasterField, WmsMasterFormTab } from "../pages/wms/WmsSimpleMasterPage";
import type { LookupRow } from "../api/lookups";
import type { UserProfile } from "../types/auth";
interface DropdownOption {
  label: string;
  value: string;
}

type Props = {
  fields: WmsMasterField[];
  tabs?: WmsMasterFormTab[];
  fieldsPerRow?: number;
  form: Record<string, unknown>;
  editMode: boolean;
  saving: boolean;
  notice: { type: "success" | "error"; message: string } | null;
  user?: UserProfile | null;
  onChange: (name: string, value: unknown) => void;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
};

export function WmsMasterForm({
  fields, tabs, fieldsPerRow = 2, form, editMode, saving, notice, user, onChange, onSave, onCancel,
}: Props) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");

  useEffect(() => {
    setActiveTab(tabs?.[0]?.key ?? "__default");
  }, [tabs]);

const loadDropdownOptions = async (field: WmsMasterField): Promise<DropdownOption[]> => {
  if (!field.dropdownParam) return [];

  try {
    const params: Record<string, unknown> = { parameter: field.dropdownParam };

    const loginId = user?.loginid || user?.LOGINID;
    if (loginId) params.loginid = loginId;

    const companyCode = form.company_code || user?.company_code || user?.COMPANY_CODE;
    if (companyCode) params.code1 = companyCode;

    console.log(`Loading dropdown options for ${field.name} with params:`, params);
    console.log("Current form state:", form);
    console.log("Dropdown code map:", field.dropdownCodeMap);
    if (field.dropdownCodeMap) {
      let codeIndex = 2;
      for (const [fieldName] of Object.entries(field.dropdownCodeMap)) {
        console.log(`Processing dropdown code map entry: ${fieldName} -> code${codeIndex}`);
        if (fieldName === "company_code") continue;
        const value = form[fieldName];
        console.log(`Value for ${fieldName}:`, value);
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
        : String(row[labelKey] || row.label || row.name || row.description || "");

      return {
        label: displayLabel,
        value: String(row[valueKey] || row.value || row.code || row.id || ""),
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
      <div className="space-y-3">
        {Object.entries(sections).map(([sectionKey, sectionFields]) => (
          <div key={sectionKey}>
            {sectionKey !== "__default" && (
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold text-primary uppercase tracking-widest px-1">
                  {sectionKey}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <div
              className="grid gap-x-3 gap-y-2"
              style={{ gridTemplateColumns: `repeat(${fieldsPerRow}, minmax(0, 1fr))` }}
            >
              {sectionFields.map((field) => {
                const spanClass =
                  field.colSpan === 1
                    ? "md:col-span-1"
                    : field.type === "textarea"
                    ? "col-span-full"
                    : "";
                const isCheckbox = field.type === "checkbox";

                return isCheckbox ? (
                  <div
                    key={field.name}
                    className={`flex items-center py-1 ${spanClass}`}
                  >
                    {renderInput(
                      field, form[field.name],
                      Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
                      form,
                      onChange,
                      loadDropdownOptions
                    )}
                  </div>
                ) : (
                  <label key={field.name} className={`group flex flex-col gap-0.5 ${spanClass}`}>
                    <span className="text-[10px] font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                      {field.label}
                      {field.required === true && (
                        <strong className="text-destructive ml-0.5 font-bold"> *</strong>
                      )}
                    </span>
                    {renderInput(
                      field, form[field.name],
                      Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
                      form,
                      onChange,
                      loadDropdownOptions
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
      {/* ── Notice Banner ── */}
      {notice && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] font-medium
            ${notice.type === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
            }`}
        >
          {notice.type === "error"
            ? <AlertCircle size={13} className="mt-px shrink-0" />
            : <CheckCircle2 size={13} className="mt-px shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* ── Tab Form ── */}
      {hasTabs ? (
        <Card className="overflow-hidden border-border shadow-sm">
          {/* Tab Strip */}
          <div className="flex items-center bg-muted/40 border-b border-border px-3 gap-0 overflow-x-auto">
            {tabs!.map((tab, index) => {
              const completed = isTabCompleted(tab.key);
              const hasErrors = !completed && hasTabErrors(tab.key);
              const isCurrent = activeTab === tab.key;

              return (
                <div key={tab.key} className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium transition-all
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

          <CardContent className="px-4 py-3">
            {renderFields(activeTab)}
          </CardContent>
        </Card>
      ) : (
        /* ── Single Section Form ── */
        <Card className="overflow-hidden border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border px-4 py-2">
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
          <CardContent className="px-4 py-3">
            {renderFields()}
          </CardContent>
        </Card>
      )}

      {/* ── Action Row ── */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
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

          <button
            disabled={saving}
            type="submit"
            className={`inline-flex items-center gap-1 rounded-md px-4 py-1.5 text-[10px] font-semibold shadow-sm transition-all
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

function getFieldDependencyKey(field: WmsMasterField, form: Record<string, unknown>): string {
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
  field: WmsMasterField,
  value: unknown,
  disabled: boolean,
  form: Record<string, unknown>,
  onChange: (name: string, value: unknown) => void,
  loadDropdownOptions: (field: WmsMasterField) => Promise<DropdownOption[]>,
) {
  const baseInputClass =
    "h-6 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

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
        return options.map((opt) => ({ value: opt.value, label: opt.label }));
      }}
      onChange={(val) => onChange(field.name, val)}
      disabled={disabled}
      placeholder={`Search ${field.label}…`}
    />
  );
}

  if (field.type === "textarea") {
    return (
      <textarea
        className="w-full rounded border border-input bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 resize-none"
        disabled={disabled}
        rows={3}
        value={String(value ?? "")}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === "checkbox") {
    const isChecked = value === true || value === "true" || value === "Y";
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={isChecked}
          disabled={disabled}
          onChange={(e) => onChange(field.name, e.target.checked)}
          className="sr-only"
        />
        <div
          className={`relative flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-2 transition-all
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
      className={baseInputClass}
    />
  );
}