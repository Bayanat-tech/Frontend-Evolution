import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

// Only reveals what the administrator is typing. Stored passwords remain write-only.
export function PlatformPasswordInput(
  props: InputHTMLAttributes<HTMLInputElement>,
) {
  const [visible, setVisible] = useState(false);
  const fallbackId = useId();
  const inputId = props.id || fallbackId;
  return (
    <div className="platform-password-field">
      <input {...props} id={inputId} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="platform-password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={inputId}
        disabled={props.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <EyeOff size={17} aria-hidden="true" />
        ) : (
          <Eye size={17} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
