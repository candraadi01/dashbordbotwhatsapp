import fs from "fs";
import path from "path";
import os from "os";
import { supabase } from "@/lib/supabase";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
  createdAt: string;
}

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_STORE_FILE = path.join(LOCAL_DATA_DIR, "push_subscriptions.json");
const FALLBACK_STORE_FILE = path.join(os.tmpdir(), "candra_push_subscriptions.json");

function getStorePath(): string {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    return LOCAL_STORE_FILE;
  } catch {
    return FALLBACK_STORE_FILE;
  }
}

function readLocalSubscriptions(): StoredPushSubscription[] {
  const filePath = getStorePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSubscriptions(list: StoredPushSubscription[]) {
  const filePath = getStorePath();
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error("[pushSubscriptionStore] Gagal menulis local store:", err);
  }
}

export const pushSubscriptionStore = {
  async save(
    subscription: { endpoint: string; keys: PushSubscriptionKeys },
    userAgent = ""
  ): Promise<void> {
    const current = readLocalSubscriptions();
    const existingIndex = current.findIndex((s) => s.endpoint === subscription.endpoint);
    const item: StoredPushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent,
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      current[existingIndex] = item;
    } else {
      current.push(item);
    }
    writeLocalSubscriptions(current);

    // Coba juga simpan ke Supabase table jika tabel push_subscriptions sudah dibuat
    try {
      await supabase.from("push_subscriptions" as any).upsert(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          created_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );
    } catch {
      // Abaikan jika tabel Supabase belum dibuat, penyimpanan lokal sudah aktif
    }
  },

  async remove(endpoint: string): Promise<void> {
    const current = readLocalSubscriptions();
    const filtered = current.filter((s) => s.endpoint !== endpoint);
    writeLocalSubscriptions(filtered);

    try {
      await supabase.from("push_subscriptions" as any).delete().eq("endpoint", endpoint);
    } catch {
      // Abaikan
    }
  },

  async removeMany(endpoints: string[]): Promise<void> {
    if (endpoints.length === 0) return;
    const endpointSet = new Set(endpoints);
    const current = readLocalSubscriptions();
    const filtered = current.filter((s) => !endpointSet.has(s.endpoint));
    writeLocalSubscriptions(filtered);

    try {
      await supabase.from("push_subscriptions" as any).delete().in("endpoint", endpoints);
    } catch {
      // Abaikan
    }
  },

  async getAll(): Promise<StoredPushSubscription[]> {
    const local = readLocalSubscriptions();
    const map = new Map<string, StoredPushSubscription>();
    local.forEach((item) => map.set(item.endpoint, item));

    // Gabungkan dengan data dari Supabase jika tabel tersedia
    try {
      const { data, error } = await supabase
        .from("push_subscriptions" as any)
        .select("endpoint, p256dh, auth, user_agent, created_at");

      if (!error && Array.isArray(data)) {
        for (const row of data as any[]) {
          if (row.endpoint && row.p256dh && row.auth && !map.has(row.endpoint)) {
            map.set(row.endpoint, {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
              userAgent: row.user_agent,
              createdAt: row.created_at,
            });
          }
        }
      }
    } catch {
      // Abaikan jika tabel Supabase belum ada
    }

    return Array.from(map.values());
  },
};
