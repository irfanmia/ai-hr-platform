"use client";

/**
 * PhoneInput — country-code dropdown + local-number input, combined into
 * a single E.164-style string ("+91 9876543210") via the onChange callback.
 *
 * Why custom rather than a library:
 *   one form field on the public site doesn't justify pulling in a
 *   ~70 KB phone-input dependency. The dropdown uses a popover so we
 *   get search + flag emojis without paying for tel-format metadata.
 *
 * Visual: matches the platform's `<Input>` component — same border,
 * radius, focus ring. The country trigger sits flush left, separated
 * by a hairline divider.
 */
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  COUNTRIES,
  type Country,
  DEFAULT_COUNTRY,
  findByIso,
} from "@/lib/country-codes";

interface PhoneInputProps {
  /** Combined value, e.g. "+91 9876543210". Empty string while user types. */
  value: string;
  onChange: (combined: string) => void;
  /** Default country ISO-2 to preselect (e.g. "IN", "US"). */
  defaultCountry?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  id?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = DEFAULT_COUNTRY,
  placeholder = "9876543210",
  required = false,
  autoComplete = "tel-national",
  id,
}: PhoneInputProps) {
  // Country selection (controlled internally — combined value is the
  // single source of truth surfaced upward).
  const [country, setCountry] = useState<Country>(() => findByIso(defaultCountry));
  const [local, setLocal] = useState<string>(() => extractLocal(value, country));

  // If parent resets the value (e.g. on form submit), keep the
  // local part in sync but don't churn the country.
  useEffect(() => {
    if (!value) {
      setLocal("");
      return;
    }
    const expectedPrefix = `+${country.dial}`;
    if (value.startsWith(expectedPrefix)) {
      setLocal(value.slice(expectedPrefix.length).trim());
    }
  }, [value, country]);

  function emit(c: Country, localPart: string) {
    const trimmed = localPart.trim();
    onChange(trimmed ? `+${c.dial} ${trimmed}` : "");
  }

  function handleCountryChange(c: Country) {
    setCountry(c);
    emit(c, local);
  }

  function handleLocalChange(next: string) {
    // Strip everything except digits, spaces, dashes — keep formatting flexible
    // but reject letters / leading + (the country picker already handles +).
    const cleaned = next.replace(/[^\d\s\-]/g, "");
    setLocal(cleaned);
    emit(country, cleaned);
  }

  return (
    <div className="flex w-full overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
      <CountryPicker selected={country} onSelect={handleCountryChange} />
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={local}
        onChange={(e) => handleLocalChange(e.target.value)}
        required={required}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

function extractLocal(combined: string, country: Country): string {
  if (!combined) return "";
  const prefix = `+${country.dial}`;
  return combined.startsWith(prefix) ? combined.slice(prefix.length).trim() : combined;
}

// ─── Country picker popover ───────────────────────────────────────────────

function CountryPicker({
  selected,
  onSelect,
}: {
  selected: Country;
  onSelect: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-focus the search input when the popover opens
  useEffect(() => {
    if (open) {
      // microtask delay so the input is mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => {
      const name = c.name.toLowerCase();
      const dial = c.dial.toLowerCase();
      const iso = c.iso2.toLowerCase();
      return (
        name.includes(q) ||
        iso.includes(q) ||
        dial.includes(q) ||
        // Also allow searching with the leading `+`
        ("+" + dial).includes(q)
      );
    });
  }, [query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-full items-center gap-1.5 border-r border-slate-200",
          "bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700",
          "transition hover:bg-slate-100 focus:outline-none",
        )}
      >
        <span className="text-base leading-none" aria-hidden>{selected.flag}</span>
        <span className="font-mono text-xs text-slate-600">+{selected.dial}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select country code"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search country or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-slate-400">
                No countries match "{query}"
              </li>
            )}
            {filtered.map((c) => (
              <li key={c.iso2}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso2 === selected.iso2}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
                    "hover:bg-slate-50",
                    c.iso2 === selected.iso2 && "bg-emerald-50 text-emerald-700",
                  )}
                >
                  <span className="text-base leading-none" aria-hidden>{c.flag}</span>
                  <span className="flex-1 truncate text-slate-700">{c.name}</span>
                  <span className="font-mono text-xs text-slate-500">+{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
