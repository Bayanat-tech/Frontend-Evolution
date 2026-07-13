import { ReactNode } from 'react';
import { cn } from './cn';

export const RadioGroup = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>
);

type RadioOptionProps = {
  checked: boolean;
  label: ReactNode;
  onClick: () => void;
  className?: string;
};

/** Radio + its label as one clickable control, replacing MUI <FormControlLabel control={<Radio/>} />. */
export const RadioOption = ({ checked, label, onClick, className }: RadioOptionProps) => (
  <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1.5 text-left', className)}>
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-full border-2 shrink-0',
        checked ? 'border-[#0a6ed1]' : 'border-[#9ca3af]'
      )}
    >
      {checked && <span className="w-2 h-2 rounded-full bg-[#0a6ed1]" />}
    </span>
    <span className="text-[0.8rem] text-[#1f2937]">{label}</span>
  </button>
);

/** Field label above a control group, replacing MUI <FormLabel />. */
export const FieldLabel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-[0.8rem] font-medium text-[#374151] mb-0.5', className)}>{children}</p>
);

type CheckboxOptionProps = {
  checked: boolean;
  label: ReactNode;
  onChange: (checked: boolean) => void;
  className?: string;
};

/** Checkbox + label as one clickable control, replacing MUI <FormControlLabel control={<Checkbox/>} />. */
export const CheckboxOption = ({ checked, label, onChange, className }: CheckboxOptionProps) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={cn('inline-flex items-center gap-1.5 text-left', className)}
  >
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-[3px] border-2 shrink-0',
        checked ? 'bg-[#0a6ed1] border-[#0a6ed1]' : 'bg-white border-[#9ca3af]'
      )}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="w-2.5 h-2.5 fill-white">
          <path d="M13.7 3.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L6 9.6l6.3-6.3a1 1 0 0 1 1.4 0z" />
        </svg>
      )}
    </span>
    <span className="text-[0.8rem] text-[#1f2937]">{label}</span>
  </button>
);
