import { useEffect, useRef, useState } from 'react';
import { cn } from './cn';

export type AutocompleteOption = {
  id: number | string;
  label: string;
};

type AutocompleteProps<T extends AutocompleteOption> = {
  options: T[];
  value: T | null;
  onChange: (value: T | null) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  size?: 'small' | 'medium';
  error?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable single-select combobox — replaces MUI <Autocomplete />.
 * Click (or focus) to open the option list, type to filter, click an option
 * to select it. Click-away closes the list without changing the value.
 */
const Autocomplete = <T extends AutocompleteOption>({
  options,
  value,
  onChange,
  label,
  required,
  placeholder,
  size = 'small',
  error,
  disabled,
  className
}: AutocompleteProps<T>) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, []);

  const filteredOptions = query.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const displayValue = open ? query : value?.label ?? '';
  const sizeClasses = size === 'small' ? 'h-8 text-[12px] px-[10px] py-[7px]' : 'h-10 text-sm px-3 py-2';

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-[#5a728f] mb-1">
          {required && <span className="text-[#d83434] font-bold mr-0.5">*</span>}
          {label}
        </label>
      )}
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(event) => setQuery(event.target.value)}
        className={cn(
          'w-full bg-white border rounded-[3px] outline-none transition-colors',
          'focus:ring-1 focus:ring-[#0a6ed1]',
          error ? 'border-[#d32f2f] focus:border-[#d32f2f]' : 'border-[#c8ccd2] focus:border-[#0a6ed1]',
          'disabled:bg-[#f3f4f6] disabled:text-[#c4c8cf]',
          sizeClasses
        )}
      />

      {open && (
        <div className="absolute z-[1200] mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[#d5dbe3] rounded-md shadow-lg py-1">
          {filteredOptions.length === 0 && <p className="px-3 py-2 text-xs text-[#6b7280]">No options</p>}
          {filteredOptions.map((option) => {
            const selected = value?.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-[13px] transition-colors',
                  selected ? 'bg-[#eef6ff] text-[#0a6ed1] font-semibold' : 'text-[#1f2937] hover:bg-[#f4f7fb]'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Autocomplete;
