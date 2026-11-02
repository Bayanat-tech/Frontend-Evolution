import type { ReactNode } from "react";

// Full class names so Tailwind's scanner can see them
const SPAN = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  12: "md:col-span-12",
} as const;

export const Section = ({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) => (
  <div className="w-full rounded-md border bg-card">
    <div className="border-b bg-secondary/40 px-3 py-1.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h3 className="m-0 text-sm font-semibold leading-tight">{title}</h3>
    </div>
    <div className="grid w-full grid-cols-12 gap-4 p-3">{children}</div>
  </div>
);

export const Field = ({
  label,
  required,
  error,
  span = 3,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  span?: keyof typeof SPAN;
  children: ReactNode;
}) => (
  <div className={`col-span-12 ${SPAN[span]}`}>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);