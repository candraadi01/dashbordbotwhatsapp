import { supabaseAnon as supabase } from "@/lib/supabase";
import { TransactionRow } from "@/types";

export type PeriodFilter = "today" | "7days" | "month" | "custom";

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface DailyFinancePoint {
  date: string;
  label: string;
  transactionCount: number;
  revenue: number;
  profit: number;
}

export interface ProductProfitStats {
  productName: string;
  soldCount: number;
  revenue: number;
  profit: number;
  margin: number;
}

export interface CustomerValueStats {
  customerName: string;
  customerPhone: string;
  totalOrder: number;
  totalSpending: number;
  totalProfit: number;
}

export interface FinancialData {
  metrics: {
    totalRevenue: number;
    totalProfit: number;
    profitMargin: number;
    totalTransactions: number;
    bestRevenueDay: string;
    bestProfitProduct: string;
    averageTransactionValue: number;
  };
  dailyTrend: DailyFinancePoint[];
  productProfits: ProductProfitStats[];
  customerValues: CustomerValueStats[];
  period: PeriodFilter;
  startDate: string;
  endDate: string;
}

export const financeService = {
  async getFinancialOverview(
    period: PeriodFilter = "7days",
    customRange: DateRange = {}
  ): Promise<FinancialData> {
    try {
      let transactions: TransactionRow[] = [];

      // Fetch all transactions using supabaseAnon
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("status", "success") // Only process success transactions for finance
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        transactions = data;
      }

      // Determine date boundaries
      const now = new Date();
      let start = new Date();
      let end = new Date(now);
      end.setHours(23, 59, 59, 999);

      if (period === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (period === "7days") {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else if (period === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      } else if (period === "custom" && customRange.startDate && customRange.endDate) {
        start = new Date(customRange.startDate + "T00:00:00");
        end = new Date(customRange.endDate + "T23:59:59");
      } else {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      }

      // Setup daily map
      const dailyMap = new Map<string, DailyFinancePoint>();
      const curr = new Date(start);
      while (curr <= end) {
        const dateKey = curr.toISOString().split("T")[0];
        const label = curr.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        dailyMap.set(dateKey, {
          date: dateKey,
          label,
          transactionCount: 0,
          revenue: 0,
          profit: 0,
        });
        curr.setDate(curr.getDate() + 1);
      }

      // Filter transactions by date range
      const periodTransactions = transactions.filter((tx) => {
        if (!tx.created_at) return false;
        const txDate = new Date(tx.created_at);
        return txDate >= start && txDate <= end;
      });

      let totalRevenue = 0;
      let totalProfit = 0;
      const totalTransactions = periodTransactions.length;

      const productMap = new Map<string, ProductProfitStats>();
      const customerMap = new Map<string, CustomerValueStats>();

      periodTransactions.forEach((tx) => {
        const dateKey = new Date(tx.created_at).toISOString().split("T")[0];
        const point = dailyMap.get(dateKey);
        const price = Number(tx.price || 0);
        const profit = Number(tx.profit_amount || 0);

        totalRevenue += price;
        totalProfit += profit;

        if (point) {
          point.transactionCount += 1;
          point.revenue += price;
          point.profit += profit;
        }

        // Product stats
        const prodName = tx.product_name || "Unknown";
        const prodStat = productMap.get(prodName) || {
          productName: prodName,
          soldCount: 0,
          revenue: 0,
          profit: 0,
          margin: 0,
        };
        prodStat.soldCount += 1;
        prodStat.revenue += price;
        prodStat.profit += profit;
        productMap.set(prodName, prodStat);

        // Customer stats
        const custPhone = tx.customer_phone || "Unknown";
        const custStat = customerMap.get(custPhone) || {
          customerName: tx.customer_name || custPhone,
          customerPhone: custPhone,
          totalOrder: 0,
          totalSpending: 0,
          totalProfit: 0,
        };
        custStat.totalOrder += 1;
        custStat.totalSpending += price;
        custStat.totalProfit += profit;
        customerMap.set(custPhone, custStat);
      });

      // Calculate derived metrics
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Finalize product margins
      const productProfits = Array.from(productMap.values()).map(p => {
        p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
        return p;
      }).sort((a, b) => b.profit - a.profit); // sort by profit desc

      // Finalize customer sorts
      const customerValues = Array.from(customerMap.values())
        .sort((a, b) => b.totalSpending - a.totalSpending); // sort by spending desc

      const dailyTrend = Array.from(dailyMap.values());
      
      // Best Revenue Day
      let bestDay = "-";
      let maxRev = -1;
      dailyTrend.forEach(d => {
        if (d.revenue > maxRev) {
          maxRev = d.revenue;
          bestDay = d.label;
        }
      });
      if (maxRev === 0) bestDay = "-";

      // Best Profit Product
      const bestProduct = productProfits.length > 0 ? productProfits[0].productName : "-";

      return {
        metrics: {
          totalRevenue,
          totalProfit,
          profitMargin,
          totalTransactions,
          bestRevenueDay: bestDay,
          bestProfitProduct: bestProduct,
          averageTransactionValue,
        },
        dailyTrend,
        productProfits,
        customerValues,
        period,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    } catch (err: unknown) {
      console.error("Error in financeService.getFinancialOverview:", err);
      throw err;
    }
  },
};
