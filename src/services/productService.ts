import { supabaseAnon as supabase } from "@/lib/supabase";
import { ProductRow } from "@/types";

export const productService = {
  async getProducts(): Promise<ProductRow[]> {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*");

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        const map = new Map<string, ProductRow>();
        data.forEach((tx) => {
          const name = tx.product_name;
          if (!name) return;
          if (!map.has(name)) {
            map.set(name, {
              product_name: name,
              category: tx.category || "General",
              totalTransactions: 0,
              totalRevenue: 0,
              totalProfit: 0,
              marginProfit: 0,
              successTransactions: 0,
            });
          }
          const item = map.get(name)!;
          item.totalTransactions += 1;
          
          if (tx.status === "success") {
            item.successTransactions = (item.successTransactions || 0) + 1;
            item.totalRevenue += Number(tx.price || 0);
            item.totalProfit += Number(tx.profit_amount || 0);
          }
        });

        const list = Array.from(map.values()).map((p) => ({
          ...p,
          marginProfit:
            p.totalRevenue > 0
              ? Math.round((p.totalProfit / p.totalRevenue) * 100)
              : 0,
        }));

        list.sort((a, b) => b.totalRevenue - a.totalRevenue);
        return list.map((p, idx) => ({ ...p, rank: idx + 1 }));
      }

      return [];
    } catch (err) {
      console.error("Error fetching products:", err);
      return [];
    }
  },

  async getProductAnalyticsByName(name: string) {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("price, profit_amount, customer_phone")
        .eq("product_name", name)
        .eq("status", "success");

      if (error) throw error;

      const customers = new Set<string>();
      let totalSold = 0;
      let totalRevenue = 0;
      let totalProfit = 0;

      if (data) {
        totalSold = data.length;
        data.forEach(tx => {
          totalRevenue += Number(tx.price || 0);
          totalProfit += Number(tx.profit_amount || 0);
          if (tx.customer_phone) customers.add(tx.customer_phone);
        });
      }

      return {
        totalSold,
        totalRevenue,
        totalProfit,
        customerCount: customers.size
      };
    } catch (err) {
      console.error("Error fetching product analytics:", err);
      return { totalSold: 0, totalRevenue: 0, totalProfit: 0, customerCount: 0 };
    }
  }
};
