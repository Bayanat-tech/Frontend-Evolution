import { useRef } from "react";
import { BiscDatePicker, type BiscDatePickerProps } from "../ui/BiscDatePicker";
import { Input } from "../ui/Input";

/** Finance's calendar, with native required-field validation for Freight forms. */
export function FreightDatePicker(props: BiscDatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <BiscDatePicker {...props} />
      {props.required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          value={props.value || ""}
          disabled={props.disabled}
          required
          onChange={() => {}}
          onInvalid={(event) => {
            event.preventDefault();
            rootRef.current?.querySelector("button")?.focus();
          }}
        />
      )}
    </div>
  );
}

/** Retains the time portion when a date-time field uses the Finance calendar. */
export function FreightDateTimePicker(props: BiscDatePickerProps) {
  const { value = "", onChange, disabled, required, ...calendarProps } = props;
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_100px] items-center gap-1">
      <FreightDatePicker
        {...calendarProps}
        value={date}
        disabled={disabled}
        required={required}
        onChange={(nextDate) => onChange(nextDate ? `${nextDate}T${time || "00:00"}` : "")}
      />
      <Input
        type="time"
        aria-label="Time"
        value={time}
        disabled={disabled || !date}
        required={required}
        onChange={(event) => onChange(date ? `${date}T${event.target.value || "00:00"}` : "")}
      />
    </div>
  );
}
