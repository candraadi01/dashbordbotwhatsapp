import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export const customerRealtimeService = {
  subscribe(callback: (payload: RealtimePostgresChangesPayload<CustomerRow>) => void): RealtimeChannel {
    return supabase
      .channel(`customers-changes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, callback)
      .subscribe();
  },
  unsubscribe(channel: RealtimeChannel) {
    void supabase.removeChannel(channel);
  },
};
