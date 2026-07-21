import { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

type BaseProps = {
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  label?: ReactNode;
  endAdornment?: ReactNode;
  className?: string;
  inputClassName?: string;
  readOnly?: boolean;
};

type TextFieldProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    multiline?: false;
    select?: false;
  };

type TextareaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
    multiline: true;
    minRows?: number;
    select?: false;
  };

type SelectFieldProps = BaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
    select: true;
    multiline?: false;
    children: ReactNode;
  };

const baseInputClasses =
  'w-full bg-white border border-[#c8ccd2] rounded-[3px] outline-none transition-colors ' +
  'focus:border-[#0a6ed1] focus:ring-1 focus:ring-[#0a6ed1] disabled:text-[#c4c8cf] disabled:bg-[#f3f4f6] ' +
  'placeholder:text-[#9ca3af]';

const sizePadding = {
  small: 'text-[12px] px-[10px] py-[7px] h-8',
  medium: 'text-sm px-3 py-2 h-10'
};

/**
 * Generic text input — replaces MUI <TextField />.
 */
const TextField = ({
  fullWidth,
  size = 'small',
  label,
  endAdornment,
  className,
  inputClassName,
  readOnly,
  multiline,
  select,
  ...rest
}: TextFieldProps | TextareaProps | SelectFieldProps) => {
  if (multiline) {
    const { minRows = 3, ...textareaRest } = rest as TextareaProps;
    return (
      <div className={cn(fullWidth && 'w-full', className)}>
        {label && <label className="block text-xs font-medium text-[#5a728f] mb-1">{label}</label>}
        <textarea
          rows={minRows}
          readOnly={readOnly}
          className={cn(baseInputClasses, 'text-sm px-3 py-2 resize-y', inputClassName)}
          {...textareaRest}
        />
      </div>
    );
  }

  if (select) {
    const { children, size: _uiSelectSize, ...selectRest } = rest as SelectFieldProps;
    return (
      <div className={cn(fullWidth && 'w-full', className)}>
        {label && <label className="block text-xs font-medium text-[#5a728f] mb-1">{label}</label>}
        <select
          className={cn(baseInputClasses, sizePadding[size], 'pr-8 cursor-pointer', inputClassName)}
          {...selectRest}
        >
          {children}
        </select>
      </div>
    );
  }

  const inputRest = rest as InputHTMLAttributes<HTMLInputElement>;

  return (
    <div className={cn(fullWidth && 'w-full', className)}>
      {label && <label className="block text-xs font-medium text-[#5a728f] mb-1">{label}</label>}
      <div className="relative flex items-center">
        <input
          readOnly={readOnly}
          className={cn(
            baseInputClasses,
            sizePadding[size],
            readOnly && 'bg-[#fbfbfc] cursor-pointer',
            inputClassName
          )}
          {...inputRest}
        />
        {endAdornment && <span className="absolute right-2.5 flex items-center text-[#66768a]">{endAdornment}</span>}
      </div>
    </div>
  );
};

export default TextField;
export type { TextFieldProps };

/** Convenience change-event type used by callers migrating off MUI's SelectChangeEvent/ChangeEvent */
export type TextFieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
