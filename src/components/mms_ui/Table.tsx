import { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from './cn';

export const TableContainer = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('overflow-x-auto', className)}>{children}</div>
);

export const Table = ({ children, className }: { children: ReactNode; className?: string }) => (
  <table className={cn('w-full border-collapse', className)}>{children}</table>
);

export const TableHead = ({ children, className }: { children: ReactNode; className?: string }) => (
  <thead className={className}>{children}</thead>
);

export const TableBody = ({ children, className }: { children: ReactNode; className?: string }) => (
  <tbody className={className}>{children}</tbody>
);

export const TableRow = ({
  children,
  className,
  hover,
  onClick,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) => (
  <tr
    className={cn(hover && 'hover:bg-[#f4f7fb] cursor-pointer transition-colors', className)}
    onClick={onClick}
    {...rest}
  >
    {children}
  </tr>
);

type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> &
  ThHTMLAttributes<HTMLTableHeaderCellElement> & {
    head?: boolean;
    align?: 'left' | 'center' | 'right';
  };

export const TableCell = ({ children, className, head, align, colSpan, ...rest }: TableCellProps) => {
  const Tag = head ? 'th' : 'td';
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <Tag
      colSpan={colSpan}
      className={cn(
        'py-2 px-3 border-b border-[#e5e7eb]',
        head && 'font-semibold text-[#243447] bg-[#f4f7fb]',
        alignClass,
        className
      )}
      {...(rest as any)}
    >
      {children}
    </Tag>
  );
};

export const Paper = ({
  children,
  className,
  onClick
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <div className={cn('bg-white', className)} onClick={onClick}>
    {children}
  </div>
);
