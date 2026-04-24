"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal checkbox primitive. Supports:
 *  - checked (boolean)
 *  - indeterminate (shows a dash — useful for "some rows selected")
 *  - any native button props (aria-label, disabled, onClick override, etc.)
 *
 * We don't use Radix here to keep the bundle small; the component is
 * button-based and fully keyboard-accessible via native Space/Enter.
 */
export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
  className,
  checked = false,
  indeterminate = false,
  onCheckedChange,
  disabled,
  ...rest
}: CheckboxProps) {
  const showCheck = checked && !indeterminate;
  const showDash = indeterminate;
  const active = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded border transition",
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-300 bg-white hover:border-indigo-400",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      {showCheck ? "✓" : showDash ? "–" : null}
    </button>
  );
}
