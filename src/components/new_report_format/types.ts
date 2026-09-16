import React from "react";

/** Option used by single / multi selects */
export interface ReportOption {
  value: string;
  label: string;
  /** Optional code for MultiSelectField coded-list layout */
  code?: string;
}

/** Field types supported by the common filter form */
export type ReportFieldType =
  | "select"
  | "multiselect"
  | "date"
  | "text"
  | "daterange";

export interface ReportFieldConfig {
  /** Unique key – also used as the form value key */
  key: string;
  label: string;
  type: ReportFieldType;
  /** Placeholder shown inside the control */
  placeholder?: string;
  /** Show required asterisk */
  required?: boolean;
  /** Options for select / multiselect */
  options?: ReportOption[];
  /** Loading state for this field's options */
  loading?: boolean;
  /**
   * Grid column span on a 12-column row.
   * Examples: 4 = 3 fields/row, 3 = 4 fields/row, 6 = 2 fields/row, 12 = full width.
   * Defaults to page-level defaultColSpan / fieldsPerRow.
   */
  colSpan?: number;
  /** When type === "daterange", the "to" key */
  toKey?: string;
  /** Disable the field */
  disabled?: boolean;
  /** Help text under the field */
  hint?: string;
}

/** Props for the common NewReportPage */
export interface NewReportPageProps {
  /** Page / dialog title */
  title: string;
  /** Optional subtitle under the title */
  subtitle?: string;
  /** Filter field definitions – rendered in order */
  fields: ReportFieldConfig[];
  /**
   * Default grid span for fields that omit colSpan.
   * 12-column grid: 4 → 3 fields/row, 3 → 4 fields/row, 6 → 2 fields/row.
   * @default 4
   */
  defaultColSpan?: number;
  /**
   * How many equal-width fields per row when fields don't set colSpan.
   * 3 → colSpan 4, 4 → colSpan 3, 2 → colSpan 6.
   * Convenience alternative to defaultColSpan.
   */
  fieldsPerRow?: number;
  /** Current filter values (controlled) */
  values: Record<string, any>;
  /** Called when any filter value changes */
  onChange: (key: string, value: any) => void;
  /** Reset all filters to defaults */
  onClearAll: () => void;
  /** Generate the report (opens dialog) */
  onGenerate: () => void;
  /** Whether a generate request is in flight */
  loading?: boolean;
  /** Global options loading (disables Generate) */
  optionsLoading?: boolean;
  /** Error message to show above the form */
  error?: string | null;
  /** Clear the error */
  onClearError?: () => void;
  /** Extra content rendered after the filter grid */
  children?: React.ReactNode;
  /** Report variant dropdown options (optional) */
  reportVariantOptions?: ReportOption[];
  reportVariant?: string;
  onReportVariantChange?: (v: string) => void;
}

/** Props for the preview dialog */
export interface NewReportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  htmlContent: string | null;
  loading?: boolean;
  error?: string | null;
  meta?: {
    companyName?: string;
    recordCount?: number | string;
    generatedAt?: string;
    user?: string;
    period?: string;
    principal?: string;
    status?: string;
    [key: string]: string | number | undefined;
  };
  onExportExcel?: () => void;
  exportingExcel?: boolean;
  onOpenInNewWindow?: () => void;
  onDownloadPdf?: () => void;
}
