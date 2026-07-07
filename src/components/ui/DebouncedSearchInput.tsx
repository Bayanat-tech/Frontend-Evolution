import { useRef } from "react";

function DebouncedSearchInput({
  value,
  onChange,
  placeholder,
  delay = 400,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(val); // only this triggers parent re-render + API
    }, delay);
  };

  return (
    <input
      defaultValue={value}
      onChange={handleChange}
      placeholder={placeholder}
      className="..." // your existing search input classes
    />
  );
}