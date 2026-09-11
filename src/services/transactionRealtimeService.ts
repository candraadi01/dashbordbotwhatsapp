import { supabaseAnon as supabase } from "@/lib/supabase";
import { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";
import { TransactionRow } from "@/types";

export type TransactionRealtimeCallback = (
  payload: RealtimePostgresChangesPayload<TransactionRow>
) => void;

export const transactionRealtimeService = {
  subscribeTransactions(callback: TransactionRealtimeCallback): RealtimeChannel {
    try {
      const channel = supabase
        .channel("transactions-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
          },
          callback
        )
        .subscribe();

      return channel;
    } catch {
      return {
        unsubscribe: () => {},
      } as unknown as RealtimeChannel;
    }
  },

  unsubscribe(channel: RealtimeChannel) {
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.error("Error unsubscribing", e);
      }
    }
  }
};
