import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import type { FormEvent } from "react";
import { getWmsMaster } from "../api/wms";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import type { WmsMasterField, WmsMasterFormTab } from "../pages/wms/WmsSimpleMasterPage";

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
  // asyncOptions cache: fieldName → options[]
  const [asyncCache, setAsyncCache] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  // fetch async options for all fields (or re-fetch when dependsOn field changes)
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

  const getOptions = (field: WmsMasterField) => {
    if (field.options) return field.options;
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

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((field) => (
          <label
            key={field.name}
            className={`field${field.type === "textarea" ? " md:col-span-2" : ""}`}
          >
            <span>
              {field.label}
              {field.required && <strong className="text-destructive"> *</strong>}
            </span>
            {renderInput(field, form[field.name], Boolean(editMode && field.disabledOnEdit), getOptions(field), onChange)}
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
  options: { label: string; value: string }[],
  onChange: (name: string, value: unknown) => void,
) {
  if (field.type === "select" || field.asyncOptions) {
    return (
      <Select
        disabled={disabled}
        value={String(value ?? "")}
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