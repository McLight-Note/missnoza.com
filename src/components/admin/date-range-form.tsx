"use client";

import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export type RangePreset = { label: string; from: string; to: string };

/** From/to date filter (GET form) with quick presets. Extra fields go in `children`. */
export function DateRangeForm({
  action,
  from,
  to,
  presets,
  presetQuery = "",
  children,
}: {
  action: string;
  from: string;
  to: string;
  presets: RangePreset[];
  /** Extra query string to keep when a preset is clicked, e.g. "&status=new". */
  presetQuery?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = preset.from === from && preset.to === to;
          return (
            <Link
              key={preset.label}
              href={`${action}?from=${preset.from}&to=${preset.to}${presetQuery}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium",
                active ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line hover:border-brand-300",
              )}
            >
              {preset.label}
            </Link>
          );
        })}
      </div>
      <Form action={action} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="range-from" className="mb-1 block text-xs font-medium text-muted">
            Boshlanish sanasi
          </label>
          <Input id="range-from" type="date" name="from" defaultValue={from} max={to} className="w-auto" />
        </div>
        <div>
          <label htmlFor="range-to" className="mb-1 block text-xs font-medium text-muted">
            Tugash sanasi
          </label>
          <Input id="range-to" type="date" name="to" defaultValue={to} className="w-auto" />
        </div>
        {children}
        <button type="submit" className={buttonClass({ variant: "secondary" })}>
          Qoʻllash
        </button>
      </Form>
    </div>
  );
}
