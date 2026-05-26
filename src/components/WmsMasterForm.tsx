// import { useEffect, useState } from "react";
// import { Save, X, CheckCircle2 } from "lucide-react";
// import type { FormEvent } from "react";
// import { getWmsMaster, fetchDropdownOptions } from "../api/wms";
// import { Button } from "./ui/Button";
// import { Card, CardContent, CardHeader } from "./ui/Card";
// import { Input } from "./ui/Input";
// import { Select } from "./ui/Select";
// import { LookupField } from "./ui/LookupField";
// import type { WmsMasterField, WmsMasterFormTab } from "../pages/wms/WmsSimpleMasterPage";
// import type { LookupRow } from "../api/lookups";
// import { DropdownOption } from "../pages/wms/dropdowns";

// type Props = {
//   fields: WmsMasterField[];
//   tabs?: WmsMasterFormTab[];
//   fieldsPerRow?: number;
//   form: Record<string, unknown>;
//   editMode: boolean;
//   saving: boolean;
//   notice: { type: "success" | "error"; message: string } | null;
//   onChange: (name: string, value: unknown) => void;
//   onSave: (e: FormEvent) => void;
//   onCancel: () => void;
// };

// export function WmsMasterForm({
//   fields, tabs, fieldsPerRow = 2, form, editMode, saving, notice, onChange, onSave, onCancel,
// }: Props) {
//   const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");

//   useEffect(() => {
//     setActiveTab(tabs?.[0]?.key ?? "__default");
//   }, [tabs]);

//   const [dropdownCache, setDropdownCache] = useState<Record<string, DropdownOption[]>>({});
//   const [asyncCache, setAsyncCache] = useState<Record<string, { label: string; value: string }[]>>({});
//   const [dropdownLoading, setDropdownLoading] = useState<Record<string, boolean>>({});

//   useEffect(() => {
//     fields.forEach((field) => {
//       if (!field.asyncOptions) return;
//       const { endpoint, labelKey, valueKey, dependsOn } = field.asyncOptions;
//       if (dependsOn && !form[dependsOn]) return;

//       const cacheKey = dependsOn
//         ? `${field.name}__${form[dependsOn]}`
//         : field.name;

//       if (asyncCache[cacheKey]) return;

//       void getWmsMaster(endpoint, {
//         page: 1,
//         limit: 10000,
//         ...(dependsOn ? { filter: JSON.stringify({ [dependsOn]: form[dependsOn] }) } : {}),
//       }).then((res) => {
//         const options = (res.tableData as Record<string, unknown>[]).map((row) => ({
//           label: String(row[labelKey] ?? ""),
//           value: String(row[valueKey] ?? ""),
//         }));
//         setAsyncCache((prev) => ({ ...prev, [cacheKey]: options }));
//       });
//     });
//   }, [fields, form, asyncCache]);

//   const loadDropdownOptions = async (field: WmsMasterField) => {
//     if (!field.dropdownKey) return;
//     const cacheKey = field.name;
//     if (dropdownCache[cacheKey]) return;
//     if (dropdownLoading[cacheKey]) return;

//     setDropdownLoading((prev) => ({ ...prev, [cacheKey]: true }));
//     try {
//       const options = await fetchDropdownOptions(field.dropdownKey);
//       setDropdownCache((prev) => ({ ...prev, [cacheKey]: options }));
//     } catch (error) {
//       console.error(`Error loading dropdown for ${field.name}:`, error);
//     } finally {
//       setDropdownLoading((prev) => ({ ...prev, [cacheKey]: false }));
//     }
//   };

//   const getOptions = (field: WmsMasterField): DropdownOption[] => {
//     if (field.options) return field.options;

//     if (field.dropdownKey) {
//       const cacheKey = field.dropdownDependsOn
//         ? `${field.name}__${form[field.dropdownDependsOn]}`
//         : field.name;
//       let options = dropdownCache[cacheKey] ?? [];
//       if (field.filterDependsOn) {
//         const filterValue = form[field.filterDependsOn];
//         options = options.filter(
//           (opt) => opt[field.filterDependsOn as string] === filterValue
//         );
//       }
//       return options;
//     }

//     if (field.asyncOptions) {
//       const { dependsOn } = field.asyncOptions;
//       const cacheKey = dependsOn ? `${field.name}__${form[dependsOn]}` : field.name;
//       return asyncCache[cacheKey] ?? [];
//     }

//     return [];
//   };

//   const hasTabs = tabs && tabs.length > 0;

//   const isTabCompleted = (tabKey: string): boolean => {
//     const tabFields = fields.filter((f) => (f.tab ?? tabs![0].key) === tabKey);
//     const requiredFields = tabFields.filter((f) => f.required === true);
//     if (requiredFields.length === 0) return false;
//     return requiredFields.every((f) => {
//       const value = form[f.name];
//       return value !== "" && value !== null && value !== undefined && value !== 0;
//     });
//   };

//   const renderFields = (tabKey?: string) => {
//     const visible = hasTabs
//       ? fields.filter((f) => (f.tab ?? tabs![0].key) === tabKey)
//       : fields;

//     const filtered = visible;

//     const sections: Record<string, typeof filtered> = {};
//     filtered.forEach((field) => {
//       const sectionKey = field.section || "__default";
//       if (!sections[sectionKey]) sections[sectionKey] = [];
//       sections[sectionKey].push(field);
//     });

//     return (
//       <div className="grid gap-0.5">
//         {Object.entries(sections).map(([sectionKey, sectionFields]) => (
//           <div key={sectionKey} className="grid gap-0.5">
//             {sectionKey !== "__default" && (
//               <h3 className="text-[10px] font-semibold text-primary uppercase tracking-wide mt-0 mb-0.5">
//                 {sectionKey}
//               </h3>
//             )}
//             <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${fieldsPerRow}, minmax(0, 1fr))` }}>
//               {sectionFields.map((field) => {
//                 const spanClass = field.colSpan === 1 ? "md:col-span-1" : field.type === "textarea" ? "col-span-full" : "";
//                 const isCheckbox = field.type === "checkbox";

//                 return isCheckbox ? (
//                   <div
//                     key={field.name}
//                     className={`field text-[10px] ${spanClass} flex items-center`}
//                   >
//                     {renderInput(
//                       field,
//                       form[field.name],
//                       Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
//                       getOptions(field),
//                       onChange,
//                       () => loadDropdownOptions(field),
//                       dropdownLoading[field.name] || false
//                     )}
//                   </div>
//                 ) : (
//                   <label
//                     key={field.name}
//                     className={`field text-[10px] ${spanClass}`}
//                   >
//                     <span className="text-[10px]">
//                       {field.label}
//                       {field.required === true && <strong className="text-destructive"> *</strong>}
//                     </span>
//                     {renderInput(
//                       field,
//                       form[field.name],
//                       Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
//                       getOptions(field),
//                       onChange,
//                       () => loadDropdownOptions(field),
//                       dropdownLoading[field.name] || false
//                     )}
//                   </label>
//                 );
//               })}
//             </div>
//           </div>
//         ))}
//       </div>
//     );
//   };

//   return (
//     <form className="grid gap-0.5" onSubmit={onSave}>
//       {notice && (
//         <div className={`${notice.type === "error" ? "alert error" : "alert success"} text-[10px] py-0.5 px-2`}>
//           {notice.message}
//         </div>
//       )}

//       {hasTabs ? (
//         <Card>
//           <div className="flex items-center border-b border-border px-2 gap-0.5">
//             {tabs!.map((tab, index) => {
//               const isCompleted = isTabCompleted(tab.key);
//               const isCurrent = activeTab === tab.key;
//               return (
//                 <div key={tab.key} className="flex items-center">
//                   <button
//                     type="button"
//                     onClick={() => setActiveTab(tab.key)}
//                     className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium border-b-2 transition-colors ${
//                       isCurrent
//                         ? "border-primary text-primary"
//                         : "border-transparent text-muted-foreground hover:text-foreground"
//                     }`}
//                   >
//                     <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
//                       isCompleted
//                         ? "bg-green-500 text-white"
//                         : isCurrent
//                         ? "bg-blue-600 text-white"
//                         : "bg-gray-300 text-gray-600"
//                     }`}>
//                       {isCompleted ? (
//                         <CheckCircle2 size={10} />
//                       ) : (
//                         <span className="text-[10px]">{index + 1}</span>
//                       )}
//                     </span>
//                     <span className="text-[10px]">{tab.label}</span>
//                   </button>
//                   {index < tabs!.length - 1 && (
//                     <div className={`h-0.5 w-4 ${isCompleted ? "bg-green-500" : "bg-gray-300"}`} />
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//           <CardContent className="pt-1 pb-1 px-2">
//             {renderFields(activeTab)}
//           </CardContent>
//         </Card>
//       ) : (
//         <Card>
//           <CardHeader className="pb-1 pt-1.5 px-2">
//             <div>
//               <p className="eyebrow text-[10px]">Details</p>
//               <h2 className="m-0 text-[10px] font-semibold">Basic Information</h2>
//             </div>
//           </CardHeader>
//           <CardContent className="pt-1 pb-1 px-2">{renderFields()}</CardContent>
//         </Card>
//       )}

//       <div className="flex justify-between gap-1 mt-1">
//         <Button type="button" variant="ghost" onClick={onCancel} size="sm" className="h-5 text-[10px] px-2 text-primary">
//           Back
//         </Button>
//         <Button disabled={saving} type="submit" size="sm" className="h-5 text-[10px] px-3 bg-blue-700 hover:bg-blue-800">
//           {saving ? "Saving..." : "Next"}
//         </Button>
//       </div>
//     </form>
//   );
// }

// function renderInput(
//   field: WmsMasterField,
//   value: unknown,
//   disabled: boolean,
//   options: DropdownOption[],
//   onChange: (name: string, value: unknown) => void,
//   onDropdownFocus: () => void,
//   isLoading: boolean,
// ) {
//   if (field.type === "select" || field.asyncOptions || field.dropdownKey) {
//     const hasApiOptions = field.asyncOptions || field.dropdownKey;

//     if (!hasApiOptions && field.options) {
//       return (
//         <Select
//           disabled={disabled}
//           value={String(value ?? "")}
//           onChange={(event) => onChange(field.name, event.target.value)}
//           className="text-[10px] py-0 px-1.5 h-5 w-full"
//         >
//           <option value="">Select {field.label}</option>
//           {options.map((option) => (
//             <option value={option.value} key={option.value}>
//               {option.label}
//             </option>
//           ))}
//         </Select>
//       );
//     }

//     const lookupRows: LookupRow[] = options.map((opt) => ({
//       value: opt.value,
//       label: opt.label,
//     }));

//     return (
//       <div
//         onClick={onDropdownFocus}
//         onFocus={onDropdownFocus}
//         role="presentation"
//         className="[&_input]:h-5 [&_input]:text-[10px] [&_input]:py-0 [&_input]:px-1.5 [&_button]:h-5 [&_button]:w-4"
//       >
//         <LookupField
//           label=""
//           value={String(value ?? "")}
//           displayValue={options.find((opt) => opt.value === String(value))?.label}
//           columns={[{ field: "label", header: "Label" }]}
//           valueField="value"
//           displayFields={["label"]}
//           loadOptions={async () => lookupRows}
//           onChange={(val) => onChange(field.name, val)}
//           disabled={disabled || isLoading}
//           placeholder={`Select ${field.label}`}
//         />
//       </div>
//     );
//   }

//   if (field.type === "textarea") {
//     return (
//       <textarea
//         className="input text-[10px] py-0.5 px-1.5 h-8 w-full"
//         disabled={disabled}
//         rows={2}
//         value={String(value ?? "")}
//         onChange={(e) => onChange(field.name, e.target.value)}
//       />
//     );
//   }

//   if (field.type === "checkbox") {
//     const isChecked = value === true || value === "true" || value === "Y";
//     return (
//       <label className="inline-flex items-center gap-1 cursor-pointer">
//         <input
//           type="checkbox"
//           checked={isChecked}
//           disabled={disabled}
//           onChange={(e) => onChange(field.name, e.target.checked)}
//           className="sr-only"
//         />
//         <div className={`w-2.5 h-2.5 flex-shrink-0 rounded-sm border flex items-center justify-center transition-colors ${
//           isChecked
//             ? "bg-blue-600 border-blue-600"
//             : "bg-white border-gray-300"
//         } ${disabled ? "opacity-50" : ""}`}>
//           {isChecked && (
//             <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
//               <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//             </svg>
//           )}
//         </div>
//         <span className="text-[10px] text-gray-700 select-none whitespace-nowrap">
//           {field.label}
//           {field.required === true && <strong className="text-destructive"> *</strong>}
//         </span>
//       </label>
//     );
//   }

//   return (
//     <Input
//       disabled={disabled}
//       type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
//       value={String(value ?? "")}
//       onChange={(e) =>
//         onChange(field.name, field.type === "number" ? Number(e.target.value || 0) : e.target.value)
//       }
//       className="text-[10px] py-0 px-1.5 h-5 w-full"
//     />
//   );
// }
import { useEffect, useState } from "react";
import { Save, X, CheckCircle2, ChevronRight, AlertCircle, Loader2, Plus, RefreshCw } from "lucide-react";
import type { FormEvent } from "react";
import { getWmsMaster, fetchDropdownOptions } from "../api/wms";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { LookupField } from "./ui/LookupField";
import type { WmsMasterField, WmsMasterFormTab } from "../pages/wms/WmsSimpleMasterPage";
import type { LookupRow } from "../api/lookups";
import { DropdownOption } from "../pages/wms/dropdowns";

type Props = {
  fields: WmsMasterField[];
  tabs?: WmsMasterFormTab[];
  fieldsPerRow?: number;
  form: Record<string, unknown>;
  editMode: boolean;
  saving: boolean;
  notice: { type: "success" | "error"; message: string } | null;
  onChange: (name: string, value: unknown) => void;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
};

export function WmsMasterForm({
  fields, tabs, fieldsPerRow = 2, form, editMode, saving, notice, onChange, onSave, onCancel,
}: Props) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "__default");

  useEffect(() => {
    setActiveTab(tabs?.[0]?.key ?? "__default");
  }, [tabs]);

  const [dropdownCache, setDropdownCache] = useState<Record<string, DropdownOption[]>>({});
  const [asyncCache, setAsyncCache] = useState<Record<string, { label: string; value: string }[]>>({});
  const [dropdownLoading, setDropdownLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fields.forEach((field) => {
      if (!field.asyncOptions) return;
      const { endpoint, labelKey, valueKey, dependsOn } = field.asyncOptions;
      if (dependsOn && !form[dependsOn]) return;

      const cacheKey = dependsOn
        ? `${field.name}__${form[dependsOn]}`
        : field.name;

      if (asyncCache[cacheKey]) return;

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

  const loadDropdownOptions = async (field: WmsMasterField) => {
    if (!field.dropdownKey) return;
    const cacheKey = field.name;
    if (dropdownCache[cacheKey]) return;
    if (dropdownLoading[cacheKey]) return;

    setDropdownLoading((prev) => ({ ...prev, [cacheKey]: true }));
    try {
      const options = await fetchDropdownOptions(field.dropdownKey);
      setDropdownCache((prev) => ({ ...prev, [cacheKey]: options }));
    } catch (error) {
      console.error(`Error loading dropdown for ${field.name}:`, error);
    } finally {
      setDropdownLoading((prev) => ({ ...prev, [cacheKey]: false }));
    }
  };

  const getOptions = (field: WmsMasterField): DropdownOption[] => {
    if (field.options) return field.options;

    if (field.dropdownKey) {
      const cacheKey = field.dropdownDependsOn
        ? `${field.name}__${form[field.dropdownDependsOn]}`
        : field.name;
      let options = dropdownCache[cacheKey] ?? [];
      if (field.filterDependsOn) {
        const filterValue = form[field.filterDependsOn];
        options = options.filter(
          (opt) => opt[field.filterDependsOn as string] === filterValue
        );
      }
      return options;
    }

    if (field.asyncOptions) {
      const { dependsOn } = field.asyncOptions;
      const cacheKey = dependsOn ? `${field.name}__${form[dependsOn]}` : field.name;
      return asyncCache[cacheKey] ?? [];
    }

    return [];
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

    const filtered = visible;

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
                      field,
                      form[field.name],
                      Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
                      getOptions(field),
                      onChange,
                      () => loadDropdownOptions(field),
                      dropdownLoading[field.name] || false
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
                      field,
                      form[field.name],
                      Boolean(editMode && field.disabledOnEdit) || Boolean(field.disabledWhen?.(form)),
                      getOptions(field),
                      onChange,
                      () => loadDropdownOptions(field),
                      dropdownLoading[field.name] || false
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

/* ─────────────────────────────────────────────
   renderInput — field-level renderer
───────────────────────────────────────────── */
function renderInput(
  field: WmsMasterField,
  value: unknown,
  disabled: boolean,
  options: DropdownOption[],
  onChange: (name: string, value: unknown) => void,
  onDropdownFocus: () => void,
  isLoading: boolean,
) {
  const baseInputClass =
    "h-6 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

  if (field.type === "select" || field.asyncOptions || field.dropdownKey) {
    const hasApiOptions = field.asyncOptions || field.dropdownKey;

    if (!hasApiOptions && field.options) {
      return (
        <Select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(field.name, event.target.value)}
          className={baseInputClass}
        >
          <option value="">— Select {field.label} —</option>
          {options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    }

    const lookupRows: LookupRow[] = options.map((opt) => ({
      value: opt.value,
      label: opt.label,
    }));

    return (
      <div
        onClick={onDropdownFocus}
        onFocus={onDropdownFocus}
        role="presentation"
        className={`[&_input]:h-6 [&_input]:text-[11px] [&_input]:py-0 [&_input]:px-2 [&_button]:h-6 ${isLoading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <LookupField
          label=""
          value={String(value ?? "")}
          displayValue={options.find((opt) => opt.value === String(value))?.label}
          columns={[{ field: "label", header: "Label" }]}
          valueField="value"
          displayFields={["label"]}
          loadOptions={async () => lookupRows}
          onChange={(val) => onChange(field.name, val)}
          disabled={disabled || isLoading}
          placeholder={isLoading ? "Loading…" : `Search ${field.label}…`}
        />
      </div>
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