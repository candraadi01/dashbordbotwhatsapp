import { supabaseAnon as supabase } from "@/lib/supabase";
import { TransactionRow, DashboardMetrics as BaseDashboardMetrics } from "@/types";

export type PeriodFilter =
  | "today"
  | "yesterday"
  | "7days"
  | "1month"
  | "2months"
  | "3months"
  | "6months"
  | "month"
  | "lastMonth"
  | "year"
  | "custom";

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface DailyDataPoint {
  date: string;
  label: string;
  transactions: number;
  successCount: number;
  revenue: number;
  profit: number;
}

export interface DashboardMetrics extends BaseDashboardMetrics {
  recentTransactions: TransactionRow[];
}

export interface ReportingData {
  metrics: DashboardMetrics;
  dailyData: DailyDataPoint[];
  period: PeriodFilter;
  startDate: string;
  endDate: string;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startMonthsAgo(now: Date, months: number) {
  const firstTargetDay = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const lastDay = new Date(firstTargetDay.getFullYear(), firstTargetDay.getMonth() + 1, 0).getDate();
  return new Date(
    firstTargetDay.getFullYear(),
    firstTargetDay.getMonth(),
    Math.min(now.getDate(), lastDay),
    0,
    0,
    0,
    0
  );
}

export const dashboardService = {
  async getReportingOverview(
    period: PeriodFilter = "7days",
    customRange: DateRange = {}
  ): Promise<ReportingData> {
    try {
      let transactions: TransactionRow[] = [];

      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (data && data.length > 0) {
          transactions = data;
        }
      } catch (err) {
        console.error("Supabase fetch failed in dashboardService:", err);
      }

      const now = new Date();
      let start = new Date();
      let end = new Date(now);
      end.setHours(23, 59, 59, 999);

      if (period === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (period === "yesterday") {
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      } else if (period === "7days") {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else if (period === "1month") {
        start = startMonthsAgo(now, 1);
      } else if (period === "2months") {
        start = startMonthsAgo(now, 2);
      } else if (period === "3months") {
        start = startMonthsAgo(now, 3);
      } else if (period === "6months") {
        start = startMonthsAgo(now, 6);
      } else if (period === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      } else if (period === "lastMonth") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      } else if (period === "year") {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      } else if (period === "custom" && customRange.startDate && customRange.endDate) {
        start = new Date(customRange.startDate + "T00:00:00");
        end = new Date(customRange.endDate + "T23:59:59");
      } else {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      }

      const dailyMap = new Map<string, DailyDataPoint>();
      const curr = new Date(start);
      while (curr <= end) {
        const dateKey = localDateKey(curr);
        const label = curr.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        dailyMap.set(dateKey, {
          date: dateKey,
          label,
          transactions: 0,
          successCount: 0,
          revenue: 0,
          profit: 0,
        });
        curr.setDate(curr.getDate() + 1);
      }

      const periodTransactions = transactions.filter((tx) => {
        if (!tx.created_at) return false;
        const txDate = new Date(tx.created_at);
        return txDate >= start && txDate <= end;
      });

      const uniquePhones = new Set(
        periodTransactions.map((tx) => tx.customer_phone).filter(Boolean)
      );

      let totalRevenue = 0;
      let totalProfit = 0;
      let successTransactions = 0;
      let pendingTransactions = 0;
      let cancelledTransactions = 0;

      periodTransactions.forEach((tx) => {
        const dateKey = localDateKey(new Date(tx.created_at));
        const point = dailyMap.get(dateKey);

        if (point) {
          point.transactions += 1;
        }

        if (tx.status === "success") {
          successTransactions += 1;
          const price = Number(tx.price || 0);
          const profit = Number(tx.profit_amount || 0);
          totalRevenue += price;
          totalProfit += profit;

          if (point) {
            point.successCount += 1;
            point.revenue += price;
            point.profit += profit;
          }
        } else if (tx.status === "pending") {
          pendingTransactions += 1;
        } else if (tx.status === "cancelled") {
          cancelledTransactions += 1;
        }
      });

      const totalTransactions = periodTransactions.length;
      const averageProfitPercentage =
        totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

      const todayStr = localDateKey(now);
      const todayTransactions = transactions.filter(
        (tx) => tx.created_at && localDateKey(new Date(tx.created_at)) === todayStr
      ).length;

      return {
        metrics: {
          totalTransactions,
          successTransactions,
          pendingTransactions,
          cancelledTransactions,
          totalCustomers: uniquePhones.size,
          totalRevenue,
          totalProfit,
          averageProfitPercentage,
          todayTransactions,
          recentTransactions: periodTransactions.slice(0, 5),
        },
        dailyData: Array.from(dailyMap.values()),
        period,
        startDate: localDateKey(start),
        endDate: localDateKey(end),
      };
    } catch (err: unknown) {
      console.error("Error in dashboardService.getReportingOverview:", err);
      throw err;
    }
  },
};
