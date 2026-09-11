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
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
}: StatCardProps) {
  return (
    <Card className="group overflow-hidden border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
            {title}
          </p>
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border",
              iconColor
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="break-words text-lg font-black tracking-tight text-slate-950 sm:text-2xl">{value}</h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
