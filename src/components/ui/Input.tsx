import { cn } from "@/lib/utils";
import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-h-[96px] resize-y shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-zinc-600 mb-1.5", className)} {...props} />;
}

export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)} {...props} />;
}
