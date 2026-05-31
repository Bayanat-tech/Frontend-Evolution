import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import type { FormEvent } from "react";
import { getWmsMaster, fetchDropdownOptions } from "../api/wms";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import type { WmsMasterField, WmsMasterFormTab } from "../pages/wms/WmsSimpleMasterPage";
import type { DropdownOption } from "../api/dropdowns";

type Props = {
  fields: WmsMasterField[];
  tabs?: WmsMasterFormTab[];
  form: Record<string, unknown>;
  editMode: boolean;
  saving: boolean;
  notice: { type: "success" | "error"; message: string } | null;
  onChange: (name: string, value: unknown) => void;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
};

export function WmsMasterForm({
  fields, tabs, form, editMode, saving, notice, onChange, onSave, onCancel,
}: Props) {
const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");

useEffect(() => {
  setActiveTab(tabs?.[0]?.key ?? "__default");
}, [tabs]);

  // dropdownOptions cache: key → options[]
  const [dropdownCache, setDropdownCache] = useState<
    Record<string, DropdownOption[]>
  >({});

  // asyncOptions cache: fieldName → options[]
  const [asyncCache, setAsyncCache] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  // Track which dropdowns are loading
  const [dropdownLoading, setDropdownLoading] = useState<Record<string, boolean>>({});

  // Fetch async options for all fields (or re-fetch when dependsOn field changes)
  useEffect(() => {
    fields.forEach((field) => {
      if (!field.asyncOptions) return;
      const { endpoint, labelKey, valueKey, dependsOn } = field.asyncOptions;
      // if this field depends on another, only fetch when that value exists
      if (dependsOn && !form[dependsOn]) return;

      const cacheKey = dependsOn
        ? `${field.name}__${form[dependsOn]}`
        : field.name;

      if (asyncCache[cacheKey]) return; // already fetched

      void getWmsMaster(endpoint, {
        page: 1,
        limit: 10000,
        ...(dependsOn ? { filter: JSON.stringify({ [dependsOn]: form[dependsOn] }) } : {}),
      }).then((res) => {
        const options = (res.tableData as Record<string, unknown>[]).map((row) => ({
          label: String(row[labelKey] ?? ""),
          value: String(row[valueKey] ?? ""),
        }));
        setAsyncCache((prev) => ({ ...prev, [cacheKey]: options }));
      });
    });
  }, [fields, form, asyncCache]);

  /**
   * Lazy load dropdown options when field is focused
   */
  const loadDropdownOptions = async (field: WmsMasterField) => {
    if (!field.dropdownKey) return;

    const cacheKey = field.name;

    // Return cached options if available
    if (dropdownCache[cacheKey]) return;

    // Skip if already loading
    if (dropdownLoading[cacheKey]) return;

    setDropdownLoading((prev) => ({ ...prev, [cacheKey]: true }));

    try {
      console.log(`Fetching ${field.dropdownKey}`);
      const options = await fetchDropdownOptions(field.dropdownKey);
      console.log(`Fetched ${options.length} options for ${field.name}:`, options);
      setDropdownCache((prev) => ({ ...prev, [cacheKey]: options }));
    } catch (error) {
      console.error(`Error loading dropdown for ${field.name}:`, error);
    } finally {
      setDropdownLoading((prev) => ({ ...prev, [cacheKey]: false }));
    }
  };

  const getOptions = (field: WmsMasterField): DropdownOption[] => {
    // Static options
    if (field.options) return field.options;

    // Dropdown API options
    if (field.dropdownKey) {
      const cacheKey = field.dropdownDependsOn
        ? `${field.name}__${form[field.dropdownDependsOn]}`
        : field.name;
      let options = dropdownCache[cacheKey] ?? [];

      // Filter options based on filterDependsOn property
      if (field.filterDependsOn) {
        const filterValue = form[field.filterDependsOn];
        options = options.filter(
          (opt) => opt[field.filterDependsOn as string] === filterValue
        );
      }

      return options;
    }

    // Legacy async options
    if (field.asyncOptions) {
      const { dependsOn } = field.asyncOptions;
      const cacheKey = dependsOn ? `${field.name}__${form[dependsOn]}` : field.name;
      return asyncCache[cacheKey] ?? [];
    }

    return [];
  };

  const hasTabs = tabs && tabs.length > 0;

  const renderFields = (tabKey?: string) => {
    const visible = hasTabs
      ? fields.filter((f) => (f.tab ?? tabs![0].key) === tabKey)
      : fields;

    // On add/update pages, show only fields where required === true
    const filtered = visible.filter((f) => f.required === true);

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((field) => (
          <label
            key={field.name}
            className={`field${field.type === "textarea" ? " md:col-span-2" : ""}`}
          >
            <span>
              {field.label}
              {field.required === true && <strong className="text-destructive"> *</strong>}
            </span>
            {renderInput(
              field,
              form[field.name],
              Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
              getOptions(field),
              onChange,
              () => loadDropdownOptions(field),
              dropdownLoading[field.name] || false
            )}
          </label>
        ))}
      </div>
    );
  };

  return (
    <form className="grid gap-4" onSubmit={onSave}>
      {notice && (
        <div className={notice.type === "error" ? "alert error" : "alert success"}>
          {notice.message}
        </div>
      )}

      {hasTabs ? (
        <Card>
          {/* Tab header */}
          <div className="flex border-b border-border px-4 gap-1">
            {tabs!.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <CardContent className="pt-4">
            {renderFields(activeTab)}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow">Details</p>
              <h2 className="m-0 text-sm font-semibold">Basic Information</h2>
            </div>
          </CardHeader>
          <CardContent>{renderFields()}</CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X size={15} /> Cancel
        </Button>
        <Button disabled={saving} type="submit">
          <Save size={15} /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function renderInput(
  field: WmsMasterField,
  value: unknown,
  disabled: boolean,
  options: DropdownOption[],
  onChange: (name: string, value: unknown) => void,
  onDropdownFocus: () => void,
  isLoading: boolean,
) {
  if (field.type === "select" || field.asyncOptions || field.dropdownKey) {
    return (
      <Select
        disabled={disabled || isLoading}
        value={String(value ?? "")}
        onFocus={onDropdownFocus}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Select>
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        className="input"
        disabled={disabled}
        rows={3}
        value={String(value ?? "")}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }
  return (
    <Input
      disabled={disabled}
      type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
      value={String(value ?? "")}
      onChange={(e) =>
        onChange(field.name, field.type === "number" ? Number(e.target.value || 0) : e.target.value)
      }
    />
  );
}