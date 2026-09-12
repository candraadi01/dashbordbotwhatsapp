"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PeriodFilter } from "@/services/dashboardService";

type Props = {
  period: PeriodFilter;
  startDate: string;
  endDate: string;
  displayStartDate: string;
  displayEndDate: string;
  isRefreshing: boolean;
  onPeriodChange: (period: PeriodFilter) => void;
  onDateChange: (field: "startDate" | "endDate", value: string) => void;
};

const quickOptions: Array<{ value: PeriodFilter; label: string; hint: string }> = [
  { value: "today", label: "Hari Ini", hint: "00.00–sekarang" },
  { value: "yesterday", label: "Kemarin", hint: "1 hari sebelumnya" },
  { value: "7days", label: "7 Hari", hint: "7 hari terakhir" },
  { value: "1month", label: "1 Bulan", hint: "1 bulan terakhir" },
];

const moreOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: "month", label: "Bulan ini" },
  { value: "lastMonth", label: "Bulan lalu" },
  { value: "2months", label: "2 bulan terakhir" },
  { value: "3months", label: "3 bulan terakhir" },
  { value: "6months", label: "6 bulan terakhir" },
  { value: "year", label: "Tahun ini" },
  { value: "custom", label: "Pilih rentang tanggal" },
];

function displayDate(value: string) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OverviewControls({
  period,
  startDate,
  endDate,
  displayStartDate,
  displayEndDate,
  isRefreshing,
  onPeriodChange,
  onDateChange,
}: Props) {
  const isMorePeriod = moreOptions.some((option) => option.value === period);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3.5 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600">
            <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950">Periode laporan</h2>
              {isRefreshing && <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin text-indigo-500" />}
            </div>
            <p className="mt-0.5 truncate text-[11px] sm:text-xs font-medium text-indigo-600">
              {displayDate(displayStartDate)} – {displayDate(displayEndDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:w-auto">
          {quickOptions.map((option) => {
            const active = period === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={`min-h-11 sm:min-h-12 rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 text-left transition-all active:scale-[0.98] ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                }`}
              >
                <span className="block truncate text-xs sm:text-sm font-bold">{option.label}</span>
                <span className={`block truncate text-[10px] sm:text-[11px] ${active ? "text-indigo-100" : "text-slate-400"}`}>{option.hint}</span>
              </button>
            );
          })}

          <label className={`relative col-span-2 min-h-11 sm:min-h-12 rounded-xl border transition-colors sm:col-span-1 ${isMorePeriod ? "border-indigo-600 bg-indigo-50" : "border-slate-200 bg-white"}`}>
            <span className="pointer-events-none absolute left-3 top-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-slate-400">Lainnya</span>
            <select
              aria-label="Pilih periode lainnya"
              value={isMorePeriod ? period : ""}
              onChange={(event) => onPeriodChange(event.target.value as PeriodFilter)}
              className="h-full min-h-11 sm:min-h-12 w-full appearance-none bg-transparent px-3 pb-1 pt-3.5 sm:pt-4 pr-8 text-xs sm:text-sm font-bold text-slate-800 outline-none"
            >
              <option value="" disabled>Pilih periode</option>
              {moreOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </label>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {period === "custom" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Tanggal mulai
                <Input type="date" max={endDate} value={startDate} onChange={(event) => onDateChange("startDate", event.target.value)} className="h-11 bg-white" />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                Tanggal selesai
                <Input type="date" min={startDate} value={endDate} onChange={(event) => onDateChange("endDate", event.target.value)} className="h-11 bg-white" />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
