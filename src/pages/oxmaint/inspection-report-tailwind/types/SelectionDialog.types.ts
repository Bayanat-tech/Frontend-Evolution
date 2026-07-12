export interface SelectionOption {
  code: string;
  displayText: string;
  secondaryText?: string;
}

export interface SelectionDialogProps<T extends SelectionOption> {
  open: boolean;
  title: string;
  options: T[];
  loading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onSelect: (option: T) => void;
  selectedCode?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  searchPlaceholder?: string;
}
