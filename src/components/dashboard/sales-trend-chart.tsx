"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DailyDataPoint } from "@/services/dashboardService";
import { formatIDR, cn } from "@/lib/utils";
import { EyeOff } from "lucide-react";

function compactCurrency(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)} jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(value);
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-xs font-bold text-slate-800">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex min-w-40 items-center justify-between gap-5 text-xs">
          <span className="flex items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
          <strong className="text-slate-900">{formatIDR(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function SalesTrendChart({ data, isMasked = false }: { data: DailyDataPoint[]; isMasked?: boolean }) {
  return (
    <div className="relative h-[240px] w-full sm:h-[300px] overflow-hidden">
      <div className={cn("h-full w-full transition-all duration-300", isMasked && "blur-md select-none pointer-events-none opacity-30")}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={22} tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} width={46} tickFormatter={compactCurrency} tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <Tooltip content={<TrendTooltip />} />
            <Area type="monotone" dataKey="revenue" name="Omzet" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revenueFill)" />
            <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {isMasked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 p-4 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 shadow-xs mb-2.5">
            <EyeOff className="h-5 w-5" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-800">Mode Privasi Aktif</p>
          <p className="text-[11px] sm:text-xs text-slate-500 max-w-xs mt-0.5">Grafik omzet dan profit disamarkan untuk melindungi kerahasiaan data.</p>
        </div>
      )}
    </div>
  );
}
