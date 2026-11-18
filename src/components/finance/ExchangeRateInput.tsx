import React, { useState, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

export interface ExchangeRateInputProps {
  value: number | undefined | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  maxDecimals?: number;
}

/**
 * High-precision, fully editable exchange rate input for finance screens.
 * Uses text with decimal inputMode to allow typing, backspacing, decimal points,
 * and pasting without premature formatting or resetting to 1.
 */
export const ExchangeRateInput: React.FC<ExchangeRateInputProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  placeholder = "1.000000",
  style,
  maxDecimals = 6,
}) => {
  const formatValue = (num: number | null | undefined): string => {
    if (num === null || num === undefined || !Number.isFinite(num)) return "";
    // If it's a valid number, format up to maxDecimals cleanly
    return num.toFixed(maxDecimals);
  };

  const [rawText, setRawText] = useState<string>(() => formatValue(value));
  const isFocusedRef = useRef(false);

  // Sync external value changes (e.g. from currency dropdown or document loading)
  // only when the user is NOT actively typing inside the field.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setRawText(formatValue(value));
    }
  }, [value, maxDecimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    // Allow digits and at most one decimal point
    if (!/^[0-9]*\.?[0-9]*$/.test(nextVal)) return;

    setRawText(nextVal);

    if (nextVal !== "" && nextVal !== ".") {
      const parsed = parseFloat(nextVal);
      if (Number.isFinite(parsed) && parsed >= 0) {
        onChange(parsed);
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    e.target.select();
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const parsed = parseFloat(rawText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      // Fallback to 1 if completely empty or non-positive
      const fallback = 1;
      setRawText(fallback.toFixed(maxDecimals));
      onChange(fallback);
    } else {
      setRawText(parsed.toFixed(maxDecimals));
      onChange(parsed);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      value={rawText}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{ textAlign: "right", ...style }}
      className={cn(
        "ui-input flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 font-mono",
        className
      )}
    />
  );
};
