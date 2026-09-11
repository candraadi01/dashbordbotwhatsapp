import { Database } from "./database.types";

export * from "./database.types";

export type TransactionStatus = Database["public"]["Enums"]["transaction_status"];

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at?: string;
}

export interface ProductRow {
  product_name: string;
  category?: string | null;
  totalTransactions: number;
  totalRevenue: number;
  totalProfit: number;
  marginProfit: number;
  successTransactions?: number;
  rank?: number;
}

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
export type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

export type TransactionLogRow = Database["public"]["Tables"]["transaction_logs"]["Row"];
export type TransactionLogInsert = Database["public"]["Tables"]["transaction_logs"]["Insert"];
export type BotInstanceRow = Database["public"]["Tables"]["bot_instances"]["Row"];

export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at?: string;
}

export interface DashboardMetrics {
  totalTransactions: number;
  successTransactions: number;
  pendingTransactions: number;
  cancelledTransactions: number;
  totalCustomers: number;
  totalRevenue: number;
  totalProfit: number;
  averageProfitPercentage: number;
  todayTransactions: number;
}

export interface CustomerWithAnalytics {
  id: string;
  customer_name: string;
  customer_phone: string;
  first_seen?: string | null;
  last_seen?: string | null;
  totalTransactions: number;
  totalSpending: number;
  totalProfit: number;
  favoriteProduct: string | null;
  lastPurchase: string | null;
  score?: number;
  segment?: "VIP" | "ACTIVE" | "NEW" | "INACTIVE";
  purchaseFrequency?: string;
  loyalty_points: number;
  lifetime_points: number;
  discount_balance: number;
}

export interface CustomerSummary {
  totalTransactions: number;
  totalSpending: number;
  totalProfit: number;
  favoriteProduct: string | null;
  lastPurchase: string | null;
}

export interface CustomerTransaction {
  id: string;
  created_at: string;
  product_name: string;
  price: number;
  profit_amount: number | null;
  status: string;
}

export interface CustomerDetail {
  customer: CustomerRow;
  summary: CustomerSummary;
  transactions: CustomerTransaction[];
}
