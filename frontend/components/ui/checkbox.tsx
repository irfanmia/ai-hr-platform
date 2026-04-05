"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  checked,
  onCheckedChange,
}: {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded border border-slate-300 transition",
        checked ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white",
        className
      )}
    >
      {checked ? "✓" : null}
    </button>
  );
}
