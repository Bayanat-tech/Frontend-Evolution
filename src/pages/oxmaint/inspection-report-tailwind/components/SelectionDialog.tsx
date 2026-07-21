import { FaSearch } from 'react-icons/fa';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '../../../../components/mms_ui';
import { SelectionDialogProps, SelectionOption } from '../types/SelectionDialog.types';

const SelectionDialog = <T extends SelectionOption>({
  open,
  title,
  options,
  loading,
  searchValue,
  onSearchChange,
  onClose,
  onSelect,
  selectedCode,
  emptyMessage = 'No items found',
  loadingMessage = 'Loading...',
  searchPlaceholder = 'Search'
}: SelectionDialogProps<T>) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" paperClassName="h-[560px] max-h-[560px]">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent className="pt-0 flex flex-col">
        <TextField
          fullWidth
          size="small"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          endAdornment={loading ? <CircularProgress size={16} /> : <FaSearch size={13} />}
          className="mb-2"
        />

        <div className="border border-[#d5dbe3] rounded-md max-h-[420px] overflow-y-auto flex-1">
          {options.map((option) => {
            const selected = selectedCode === option.code;

            return (
              <button
                key={option.code}
                type="button"
                onClick={() => onSelect(option)}
                className={`w-full text-left px-4 py-1.5 border-b border-[#e5e7eb] last:border-b-0 transition-colors ${
                  selected ? 'bg-[#eef6ff]' : 'hover:bg-[#f4f7fb]'
                }`}
              >
                <div className="text-[13px] font-semibold text-[#1f2937]">{option.displayText}</div>
                {option.secondaryText && <div className="text-xs text-[#6b7280] mt-0.5">{option.secondaryText}</div>}
              </button>
            );
          })}

          {!loading && options.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-[#6b7280]">{emptyMessage}</p>
          )}
          {loading && (
            <div className="flex items-center gap-2 px-2.5 py-2">
              <CircularProgress size={20} />
              <p className="text-xs text-[#6b7280]">{loadingMessage}</p>
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button className="text-[#243447] bg-transparent hover:bg-black/5" onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SelectionDialog;
