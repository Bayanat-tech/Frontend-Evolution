import { FaCheck } from 'react-icons/fa';
import { cn } from './cn';

type CheckboxProps = {
  checked: boolean;
  className?: string;
};

/**
 * Small square checkbox indicator (visual only — parent buttons/rows own the
 * click handling), replacing MUI <Checkbox />.
 */
const Checkbox = ({ checked, className }: CheckboxProps) => (
  <span
    className={cn(
      'inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] border-2 shrink-0',
      checked ? 'bg-[#0a6ed1] border-[#0a6ed1] text-white' : 'bg-white border-[#9ca3af] text-transparent',
      className
    )}
  >
    <FaCheck size={10} />
  </span>
);

export default Checkbox;
