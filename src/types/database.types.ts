export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type TransactionStatus = "pending" | "success" | "cancelled";
type Customer = { id: string; customer_name: string; customer_phone: string; first_seen: string; last_seen: string; notes: string | null; loyalty_points: number; lifetime_points: number; discount_balance: number; updated_at: string };
type Product = { id: string; name: string; category: string; duration: string; price: number; cost: number; profit_amount: number; description: string | null; image_url: string | null; image_public_id: string | null; stock: number | null; status: "ACTIVE" | "INACTIVE"; sort_order: number; category_sort_order: number; variant_sort_order: number; created_at: string; updated_at: string };
type Transaction = { id: string; transaction_id: string | null; customer_id: string | null; product_id: string | null; customer_name: string; customer_phone: string; product_name: string; category: string | null; duration: string; original_price: number; discount_amount: number; discount_refunded: boolean; price: number; cost: number; profit_amount: number; profit_percentage: number; status: TransactionStatus; status_source: string; status_sync_state: string; status_changed_by: string | null; whatsapp_synced_at: string | null; created_at: string; updated_at: string };
type TransactionLog = { id: string; transaction_id: string | null; action: string; old_data: Json | null; new_data: Json | null; actor_id: string | null; created_at: string };
type TransactionPointAward = { transaction_id: string; customer_id: string; points: number; applied: boolean; created_at: string };
type CustomerPointLog = { id: string; customer_id: string; transaction_id: string | null; action: string; points_delta: number; discount_delta: number; note: string | null; actor_id: string | null; created_at: string };
type UserRoleRow = { id: string; email: string; role: "OWNER" | "ADMIN" | "STAFF"; created_at: string; updated_at: string };
type BotInstance = { id: string; name: string; status: "starting" | "online" | "offline" | "error"; version: string | null; last_seen: string; metadata: Json; updated_at: string };
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };
export interface Database { public: { Tables: {
  customers: Table<Customer, Omit<Customer, "id" | "first_seen" | "last_seen" | "updated_at"> & Partial<Pick<Customer, "id" | "first_seen" | "last_seen" | "updated_at">>>;
  products: Table<Product, Omit<Product, "id" | "profit_amount" | "created_at" | "updated_at"> & Partial<Pick<Product, "id" | "created_at" | "updated_at">>>;
  transactions: Table<Transaction, Omit<Transaction, "id" | "created_at" | "updated_at"> & Partial<Pick<Transaction, "id" | "created_at" | "updated_at">>>;
  transaction_logs: Table<TransactionLog>; transaction_point_awards: Table<TransactionPointAward>; customer_point_logs: Table<CustomerPointLog>; user_roles: Table<UserRoleRow>;
  bot_instances: Table<BotInstance, Omit<BotInstance, "updated_at"> & Partial<Pick<BotInstance, "updated_at">>>;
}; Views: { [_ in never]: never }; Functions: {
  current_role: { Args: Record<PropertyKey, never>; Returns: string };
  dashboard_purge_data: { Args: { p_target: string }; Returns: Json };
  manage_customer_loyalty: { Args: { p_customer_id: string; p_action: string; p_points: number; p_note?: string | null }; Returns: Json };
  dashboard_set_transaction_status: { Args: { p_transaction_id: string; p_status: TransactionStatus; p_expected_updated_at: string }; Returns: Transaction };
}; Enums: { transaction_status: TransactionStatus }; CompositeTypes: { [_ in never]: never } } }
