import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, Search, X } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";

export type RegistrationCountry = {
  code: string;
  name: string;
  iso2: string | null;
  dialCode: string | null;
};

export function RegistrationCountryPicker({
  countries,
  value,
  onChange,
  dialing = false,
  disabled = false,
}: {
  countries: RegistrationCountry[];
  value: string;
  onChange: (country: RegistrationCountry) => void;
  dialing?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  const options = dialing
    ? [...new Map(countries.filter((c) => c.iso2 && c.dialCode).map((c) => [c.iso2, c])).values()]
    : countries;

  const selected = options.find((c) => (dialing ? c.iso2 : c.code) === value);

  const matches = options.filter((c) =>
    `${c.name} ${c.code} ${c.iso2 || ""} ${c.dialCode || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const choose = (country: RegistrationCountry) => {
    onChange(country);
    setOpen(false);
    setSearch("");
  };

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const flag = (country?: RegistrationCountry | null) =>
    country?.iso2 ? (
      <span
        aria-hidden="true"
        className={`fi fi-${country.iso2.toLowerCase()} reg-country-flag rounded-[2px] shadow-2xs border border-slate-200/60 shrink-0`}
        style={{ width: 18, height: 13.5 }}
      />
    ) : (
      <Globe2 size={16} aria-hidden="true" className="text-slate-400 shrink-0" />
    );

  return (
    <div className={`reg-country-picker ${dialing ? "dialing" : ""}`} ref={wrapper}>
      <button
        type="button"
        disabled={disabled}
        aria-label={dialing ? "Calling country" : "Country"}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setSearch("");
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              {flag(selected)}
              <span className="font-semibold text-slate-900 truncate">
                {dialing ? selected.dialCode : selected.name}
              </span>
              {!dialing && selected.code && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold shrink-0">
                  {selected.code}
                </span>
              )}
            </>
          ) : (
            <>
              <Globe2 size={16} className="text-slate-400 shrink-0" />
              <span className="text-slate-400 font-medium">
                {dialing ? "Code" : "-- Select Country --"}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {!dialing && selected?.dialCode && (
            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/80">
              {selected.dialCode}
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="reg-country-menu">
          <div className="reg-country-search">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              ref={input}
              role="combobox"
              aria-label={dialing ? "Search calling countries" : "Search countries"}
              aria-controls={id}
              aria-expanded="true"
              aria-autocomplete="list"
              aria-activedescendant={matches[active] ? `${id}-${active}` : undefined}
              placeholder={dialing ? "Search code or country..." : "Search country or code..."}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) =>
                    Math.max(
                      0,
                      Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))
                    )
                  );
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (matches[active]) choose(matches[active]);
                }
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="reg-country-search-clear"
                title="Clear"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div role="listbox" id={id} aria-label={dialing ? "Calling countries" : "Countries"}>
            {matches.map((country, index) => {
              const isSelected = (dialing ? country.iso2 : country.code) === value;
              return (
                <button
                  type="button"
                  role="option"
                  id={`${id}-${index}`}
                  key={country.code + (dialing ? "-" + country.dialCode : "")}
                  aria-selected={isSelected}
                  className={`${active === index ? "active" : ""} ${isSelected ? "selected" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(country)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {flag(country)}
                    <span className="reg-country-option-name truncate font-medium text-slate-800">
                      {country.name}
                      {!dialing && (
                        <small className="font-mono text-slate-500 font-bold bg-slate-100 px-1 py-0.5 rounded ml-1.5">
                          {country.code}
                        </small>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {country.dialCode && (
                      <span className="font-mono text-[11px] font-semibold text-slate-400">
                        {country.dialCode}
                      </span>
                    )}
                    {isSelected && <Check size={14} className="text-[#00378C] shrink-0" />}
                  </div>
                </button>
              );
            })}
            {!matches.length && (
              <p className="reg-country-empty text-xs text-slate-400 py-4 text-center">
                No matching countries found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
