import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type ButtonSize = 'small' | 'medium';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  size?: ButtonSize;
  fullWidth?: boolean;
  /**
   * All color / background / border styling is supplied by the caller via
   * `className` (arbitrary Tailwind values), matching the exact colors the
   * MUI + custom CSS version used. This component only owns shared layout
   * (icon spacing, sizing, disabled state) so callers keep full control of
   * look without Tailwind class-order/specificity surprises.
   */
  className?: string;
};

const sizeClasses: Record<ButtonSize, string> = {
  small: 'text-xs px-2.5 py-1 min-h-[26px]',
  medium: 'text-sm px-3.5 py-1.5 min-h-[36px]'
};

const Button = ({
  children,
  startIcon,
  endIcon,
  size = 'medium',
  fullWidth,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) => {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold leading-none transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {startIcon}
      {children}
      {endIcon}
    </button>
  );
};

export default Button;

/** Icon-only button, replaces MUI IconButton */
type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  size?: ButtonSize;
  className?: string;
};

export const IconButton = ({ children, size = 'medium', className, ...rest }: IconButtonProps) => {
  const dim = size === 'small' ? 'w-8 h-8' : 'w-10 h-10';
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-colors',
        'hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed',
        dim,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
};
