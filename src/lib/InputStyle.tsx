// Add this component at the top of your file (before the main component)
export const FloatLabelInput = ({
    label,
    value,
    onChange,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
}) => (
    <div style={{ position: "relative", marginTop: 6 }}>
        <span style={{
            position: "absolute",
            top: -8,
            left: 10,
            fontSize: 11,
            color: "#6b7280",
            background: "#fff",
            padding: "0 4px",
            zIndex: 1,
            fontFamily: "system-ui, sans-serif",
        }}>
            {label}
        </span>
        <input
            type={type}
            value={value}
            onChange={onChange}
            style={{
                width: "100%",
                fontSize: 12,
                padding: "8px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#fff",
                color: "#111827",
                outline: "none",
                boxSizing: "border-box",
            }}
        />
    </div>
);