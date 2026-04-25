import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

/**
 * Buttons follow name.com's brand language:
 *   - default (primary): pill-shaped, brand green bg, dark text (better
 *     contrast than white-on-green), brightness-based hover
 *   - outline (secondary): rounded-xl, neutral border, white bg
 *   - ghost: no background, hover wash
 *   - destructive: red, same pill shape as primary
 *
 * The brand colour comes from the Tailwind `indigo` palette which the
 * tailwind.config aliases to brand green — so `bg-indigo-500` renders as
 * #6EDA78 across the whole app.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary: pill, brand-green bg, dark text. Hover brightens the bg
        // rather than shifting hue (matches name.com's `hover:brightness-110`).
        default: "rounded-full bg-indigo-500 text-slate-900 hover:brightness-110 active:brightness-125",
        outline: "rounded-xl border border-slate-200 bg-white text-slate-900 hover:border-indigo-400 hover:text-indigo-700",
        ghost: "rounded-xl text-slate-700 hover:bg-slate-100",
        destructive: "rounded-full bg-red-600 text-white hover:bg-red-700",
        // Convenience subtle variant — soft brand-tinted bg, dark text
        subtle: "rounded-full bg-indigo-100 text-indigo-900 hover:bg-indigo-200",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-11 px-8",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
