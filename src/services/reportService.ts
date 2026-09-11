import { supabaseAnon as supabase } from "@/lib/supabase";
import { TransactionRow } from "@/types";

export type PeriodFilter = "today" | "7days" | "month" | "custom";

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface TopCustomer {
  customer_name: string;
  customer_phone: string;
  totalTransactions: number;
  totalSpending: number;
  totalProfit: number;
}

export interface TopProduct {
  product_name: string;
  totalTransactions: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface ReportSummary {
  totalRevenue: number;
  totalProfit: number;
  totalTransaction: number;
  newCustomerCount: number;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  transactions: number;
}

export interface ReportData {
  summary: ReportSummary;
  chartData: ChartDataPoint[];
  topCustomers: TopCustomer[];
  topProducts: TopProduct[];
  period: PeriodFilter;
  startDate: string;
  endDate: string;
}

export const reportService = {
  async getReportData(
    period: PeriodFilter = "7days",
    customRange: DateRange = {}
  ): Promise<ReportData> {
    try {
      // 1. Fetch data
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("status", "success")
        .order("created_at", { ascending: true });

      if (txError) throw txError;
      
      const { data: custData, error: custError } = await supabase
        .from("customers")
        .select("*");

      if (custError) throw custError;

      const transactions: TransactionRow[] = txData || [];
      const customers = custData || [];

      // 2. Determine Date Range
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

      // Filter transactions inside the period
      const periodTransactions = transactions.filter((tx) => {
        if (!tx.created_at) return false;
        const txDate = new Date(tx.created_at);
        return txDate >= start && txDate <= end;
      });

      // Filter customers whose first_seen is inside the period
      const newCustomers = customers.filter((c) => {
        if (!c.first_seen) return false;
        const cDate = new Date(c.first_seen);
        return cDate >= start && cDate <= end;
      });

      // 3. Prepare Chart Data (Daily breakdown)
      const dailyMap = new Map<string, ChartDataPoint>();
      const curr = new Date(start);
      while (curr <= end) {
        const dateKey = curr.toISOString().split("T")[0];
        const label = curr.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        dailyMap.set(dateKey, { date: dateKey, label, revenue: 0, profit: 0, transactions: 0 });
        curr.setDate(curr.getDate() + 1);
      }

      // 4. Calculate Summary, Chart Data, Top Customer, Top Product
      let totalRevenue = 0;
      let totalProfit = 0;
      const totalTransaction = periodTransactions.length;
      const newCustomerCount = newCustomers.length;

      const customerMap = new Map<string, TopCustomer>();
      const productMap = new Map<string, TopProduct>();

      periodTransactions.forEach((tx) => {
        const price = Number(tx.price || 0);
        const profit = Number(tx.profit_amount || 0);
        const dateKey = new Date(tx.created_at).toISOString().split("T")[0];
        
        // Summary
        totalRevenue += price;
        totalProfit += profit;

        // Chart
        const chartPoint = dailyMap.get(dateKey);
        if (chartPoint) {
          chartPoint.revenue += price;
          chartPoint.profit += profit;
          chartPoint.transactions += 1;
        }

        // Top Customer
        const phone = tx.customer_phone;
        if (phone) {
          if (!customerMap.has(phone)) {
            customerMap.set(phone, {
              customer_name: tx.customer_name || phone,
              customer_phone: phone,
              totalTransactions: 0,
              totalSpending: 0,
              totalProfit: 0,
            });
          }
          const cStats = customerMap.get(phone)!;
          cStats.totalTransactions += 1;
          cStats.totalSpending += price;
          cStats.totalProfit += profit;
        }

        // Top Product
        const pName = tx.product_name;
        if (pName) {
          if (!productMap.has(pName)) {
            productMap.set(pName, {
              product_name: pName,
              totalTransactions: 0,
              totalRevenue: 0,
              totalProfit: 0,
            });
          }
          const pStats = productMap.get(pName)!;
          pStats.totalTransactions += 1;
          pStats.totalRevenue += price;
          pStats.totalProfit += profit;
        }
      });

      // 5. Sort Maps to Arrays
      const topCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.totalSpending - a.totalSpending)
        .slice(0, 10); // get top 10

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10); // get top 10

      return {
        summary: {
          totalRevenue,
          totalProfit,
          totalTransaction,
          newCustomerCount,
        },
        chartData: Array.from(dailyMap.values()),
        topCustomers,
        topProducts,
        period,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      };
    } catch (err) {
      console.error("Error in getReportData:", err);
      throw err;
    }
  },
};
