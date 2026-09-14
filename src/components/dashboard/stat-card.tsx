import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: string;
  isMasked?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  isMasked = false,
}: StatCardProps) {
  return (
    <Card className="group overflow-hidden border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-center justify-between gap-1.5">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            {title}
          </p>
          <div
            className={cn(
              "flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border",
              iconColor
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <h3
            className={cn(
              "truncate text-base min-[380px]:text-lg sm:text-2xl font-black tracking-tight text-slate-950 transition-all duration-200",
              isMasked && "tracking-widest select-none text-slate-700"
            )}
            title={isMasked ? "Nilai disembunyikan" : String(value)}
          >
            {value}
          </h3>
          {description && (
            <p className="mt-0.5 sm:mt-1 truncate text-[10px] sm:text-xs text-slate-500 leading-normal" title={isMasked ? "" : description}>
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
