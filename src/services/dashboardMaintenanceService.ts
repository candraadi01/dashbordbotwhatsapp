import { supabase } from "@/lib/supabase";

export type PurgeTarget = "transactions" | "customers" | "sales_data";

export interface PurgeResult {
  deleted_transactions: number;
  deleted_customers: number;
  deleted_logs: number;
}

export const dashboardMaintenanceService = {
  async purge(target: PurgeTarget): Promise<PurgeResult> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error("Sesi login berakhir. Silakan login kembali.");

    const { data, error } = await supabase.rpc("dashboard_purge_data", { p_target: target });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("delete requires a where clause") || message.includes("schema cache") || message.includes("could not find the function")) {
        throw new Error("Fungsi pembersihan Supabase masih versi lama. Jalankan file supabase/CRITICAL-FIX-STATUS-DELETE.sql satu kali, lalu coba lagi.");
      }
      if (message.includes("akses") || message.includes("permission") || message.includes("row-level security")) {
        throw new Error("Akses ditolak. Pembersihan database hanya dapat dilakukan oleh akun dengan role OWNER.");
      }
      throw new Error(error.message);
    }
    return (data || {
      deleted_transactions: 0,
      deleted_customers: 0,
      deleted_logs: 0,
    }) as unknown as PurgeResult;
  },
};
