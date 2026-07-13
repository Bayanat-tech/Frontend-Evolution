import { cn } from './cn';

type CircularProgressProps = {
  size?: number;
  className?: string;
};

/** Replaces MUI <CircularProgress /> with a plain CSS-animated spinner. */
const CircularProgress = ({ size = 20, className }: CircularProgressProps) => (
  <span
    role="status"
    aria-label="loading"
    className={cn('inline-block rounded-full border-2 border-[#0a6ed1]/25 border-t-[#0a6ed1] animate-spin', className)}
    style={{ width: size, height: size }}
  />
);

export default CircularProgress;
