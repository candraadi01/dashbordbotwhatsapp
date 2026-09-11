import { supabase } from "@/lib/supabase";
import { CustomerWithAnalytics } from "@/types";

export type LoyaltyAction = "ADD" | "DEDUCT" | "REDEEM";
export type LoyaltyResult = { loyalty_points: number; lifetime_points: number; discount_balance: number };

export const customerService = {
  async deleteCustomer(customerPhone: string): Promise<void> {
    const { error } = await supabase.from("customers").delete().eq("customer_phone", customerPhone);
    if (error) throw new Error(error.message);
  },
  async manageLoyalty(customerId: string, action: LoyaltyAction, points: number, note = ""): Promise<LoyaltyResult> {
    const { data, error } = await supabase.rpc("manage_customer_loyalty", {
      p_customer_id: customerId,
      p_action: action,
      p_points: points,
      p_note: note || null,
    });
    if (error) throw new Error(error.message);
    return data as unknown as LoyaltyResult;
  },
  async getCustomersWithAnalytics(): Promise<CustomerWithAnalytics[]> {
    try {
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("*");

      if (customersError) console.error("Error fetching customers:", customersError);

      const { data: transactions, error: transactionsError } = await supabase
        .from("transactions")
        .select("*");

      if (transactionsError) console.error("Error fetching transactions:", transactionsError);

      const rawCustomers = customers || [];
      const rawTransactions = transactions || [];

      const customerMap = new Map<
        string,
        {
          id: string;
          customer_name: string;
          customer_phone: string;
          totalTransactions: number;
          totalSpending: number;
          totalProfit: number;
          productCounts: Map<string, number>;
          lastPurchase: string | null;
          firstPurchase: string | null;
          loyalty_points: number;
          lifetime_points: number;
          discount_balance: number;
        }
      >();

      rawCustomers.forEach((c) => {
        if (c.customer_phone) {
          customerMap.set(c.customer_phone, {
            id: c.id,
            customer_name: c.customer_name || "",
            customer_phone: c.customer_phone,
            totalTransactions: 0,
            totalSpending: 0,
            totalProfit: 0,
            productCounts: new Map<string, number>(),
            lastPurchase: null,
            firstPurchase: null,
            loyalty_points: Number(c.loyalty_points || 0),
            lifetime_points: Number(c.lifetime_points || 0),
            discount_balance: Number(c.discount_balance || 0)
          });
        }
      });

      rawTransactions.forEach((tx) => {
        const phone = tx.customer_phone;
        if (!phone) return;

        if (!customerMap.has(phone)) {
          customerMap.set(phone, {
            id: tx.customer_id || `phone:${phone}`,
            customer_name: tx.customer_name || phone,
            customer_phone: phone,
            totalTransactions: 0,
            totalSpending: 0,
            totalProfit: 0,
            productCounts: new Map<string, number>(),
            lastPurchase: null,
            firstPurchase: null,
            loyalty_points: 0,
            lifetime_points: 0,
            discount_balance: 0
          });
        }

        const stats = customerMap.get(phone)!;

        if (tx.status === "success") {
          stats.totalTransactions += 1;
          stats.totalSpending += Number(tx.price || 0);
          stats.totalProfit += Number(tx.profit_amount || 0);

          if (tx.product_name) {
            stats.productCounts.set(
              tx.product_name,
              (stats.productCounts.get(tx.product_name) || 0) + 1
            );
          }
        }

        if (!stats.lastPurchase || new Date(tx.created_at) > new Date(stats.lastPurchase)) {
          stats.lastPurchase = tx.created_at;
        }
        if (!stats.firstPurchase || new Date(tx.created_at) < new Date(stats.firstPurchase)) {
          stats.firstPurchase = tx.created_at;
        }
      });

      const now = new Date();
      
      const results: CustomerWithAnalytics[] = Array.from(customerMap.values()).map(
        (stats) => {
          let favoriteProduct = "-";
          let maxCount = 0;

          stats.productCounts.forEach((count, product) => {
            if (count > maxCount) {
              maxCount = count;
              favoriteProduct = product;
            }
          });

          // CRM Scoring (0-100)
          // 1. Spending (40%): max 40 points if spending >= 2,000,000
          const spendingScore = Math.min(40, (stats.totalSpending / 2000000) * 40);
          
          // 2. Frequency (30%): max 30 points if tx >= 10
          const freqScore = Math.min(30, (stats.totalTransactions / 10) * 30);
          
          // 3. Recency (30%): max 30 points
          let recencyScore = 0;
          let daysSinceLastPurchase = 999;
          
          if (stats.lastPurchase) {
            const lastDate = new Date(stats.lastPurchase);
            const diffTime = Math.abs(now.getTime() - lastDate.getTime());
            daysSinceLastPurchase = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (daysSinceLastPurchase <= 7) recencyScore = 30;
            else if (daysSinceLastPurchase <= 30) recencyScore = 20;
            else if (daysSinceLastPurchase <= 90) recencyScore = 10;
            else recencyScore = 5;
          }
          
          const totalScore = Math.round(spendingScore + freqScore + recencyScore);
          
          // Determine Segment
          let segment: "VIP" | "ACTIVE" | "NEW" | "INACTIVE" = "INACTIVE";
          if (stats.totalTransactions === 1 && daysSinceLastPurchase <= 14) {
            segment = "NEW";
          } else if (totalScore >= 80) {
            segment = "VIP";
          } else if (daysSinceLastPurchase <= 45 && stats.totalTransactions > 0) {
            segment = "ACTIVE";
          } else {
            segment = "INACTIVE";
          }
          
          // Purchase Frequency label
          let purchaseFrequency = "Jarang";
          if (stats.firstPurchase && stats.totalTransactions > 1) {
             const firstDate = new Date(stats.firstPurchase);
             const diffTime = Math.abs(now.getTime() - firstDate.getTime());
             const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
             const daysPerOrder = totalDays / stats.totalTransactions;
             if (daysPerOrder <= 7) purchaseFrequency = "Sangat Sering (Mingguan)";
             else if (daysPerOrder <= 30) purchaseFrequency = "Sering (Bulanan)";
             else purchaseFrequency = "Jarang";
          } else if (stats.totalTransactions === 1) {
             purchaseFrequency = "Sekali";
          } else if (stats.totalTransactions === 0) {
             purchaseFrequency = "Belum Pernah";
          }

          return {
            id: stats.id,
            customer_name: stats.customer_name,
            customer_phone: stats.customer_phone,
            totalTransactions: stats.totalTransactions,
            totalSpending: stats.totalSpending,
            totalProfit: stats.totalProfit,
            favoriteProduct: maxCount > 0 ? favoriteProduct : "-",
            lastPurchase: stats.lastPurchase,
            score: totalScore,
            segment,
            purchaseFrequency,
            loyalty_points: stats.loyalty_points,
            lifetime_points: stats.lifetime_points,
            discount_balance: stats.discount_balance
          };
        }
      );

      return results.sort((a, b) => (b.score || 0) - (a.score || 0));
    } catch (err) {
      console.error("Error in getCustomersWithAnalytics:", err);
      return [];
    }
  },

  async getCustomerDetail(customerPhone: string): Promise<import("@/types").CustomerDetail | null> {
    try {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("customer_phone", customerPhone)
        .limit(1)
        .single();
      
      let customer: import("@/types").CustomerRow;

      if (customerError || !customerData) {
        customer = {
          id: "unknown",
          name: customerPhone,
          phone: customerPhone,
          created_at: new Date().toISOString(),
        };
      } else {
        customer = {
          id: customerData.id || "unknown",
          name: customerData.customer_name || customerPhone,
          phone: customerData.customer_phone || customerPhone,
          created_at: customerData.first_seen || new Date().toISOString(),
          updated_at: customerData.last_seen || undefined,
        };
      }

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("id, created_at, product_name, price, profit_amount, status")
        .eq("customer_phone", customerPhone)
        .order("created_at", { ascending: false });

      if (transactionsError) {
        console.error("Error fetching transactions for customer:", transactionsError);
        return null;
      }

      const transactions = transactionsData || [];

      let totalTransactions = 0;
      let totalSpending = 0;
      let totalProfit = 0;
      let lastPurchase: string | null = null;
      const productCounts = new Map<string, number>();

      transactions.forEach((tx) => {
        if (tx.status === "success") {
          totalTransactions += 1;
          totalSpending += Number(tx.price || 0);
          totalProfit += Number(tx.profit_amount || 0);
          if (tx.product_name) {
            productCounts.set(tx.product_name, (productCounts.get(tx.product_name) || 0) + 1);
          }
        }
        if (!lastPurchase || new Date(tx.created_at) > new Date(lastPurchase)) {
          lastPurchase = tx.created_at;
        }
      });

      let favoriteProduct = null;
      let maxCount = 0;
      productCounts.forEach((count, product) => {
        if (count > maxCount) {
          maxCount = count;
          favoriteProduct = product;
        }
      });

      const summary = {
        totalTransactions,
        totalSpending,
        totalProfit,
        favoriteProduct,
        lastPurchase,
      };

      return {
         
        customer: customer as any,
        summary,
         
        transactions: transactions as any[],
      };
    } catch (err) {
      console.error("Error in getCustomerDetail:", err);
      return null;
    }
  },
};
