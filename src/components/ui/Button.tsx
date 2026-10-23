"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

const variants: Record<Variant, string> = {
  primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20",
  secondary: "bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 shadow-sm",
  ghost: "hover:bg-zinc-100 text-zinc-600",
  danger: "bg-red-600 hover:bg-red-500 text-white",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
