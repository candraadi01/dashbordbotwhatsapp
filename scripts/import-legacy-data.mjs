import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const source = path.resolve(process.argv[2] || "../database");
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
const db = createClient(url, key, { auth: { persistSession: false } });
const read = (name, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(source, name), "utf8")); } catch { return fallback; } };
const number = value => Number(String(value ?? 0).replace(/[^0-9-]/g, "")) || 0;
const menu = read("menu.json", {}), categories = read("kategori.json", {}), durations = read("durasi.json", {}), profit = read("profit_config_v2.json", {});

for (const [menuKey, serviceName] of Object.entries(menu)) {
  for (const category of categories[menuKey]?.categories || []) {
    const rows = durations[category] || { durations: [], prices: [] };
    for (let i = 0; i < rows.durations.length; i++) {
      const duration = rows.durations[i], price = number(rows.prices[i]);
      const profitAmount = number(profit[category]?.[duration]?.profitAmount);
      const payload = { name: serviceName, category, duration, price, cost: Math.max(price - profitAmount, 0), image_url: /^https:\/\//.test(categories[menuKey]?.image || "") ? categories[menuKey].image : null, status: "ACTIVE" };
      const { data: existing } = await db.from("products").select("id").eq("name", serviceName).eq("category", category).eq("duration", duration).maybeSingle();
      const query = existing ? db.from("products").update(payload).eq("id", existing.id) : db.from("products").insert(payload);
      const { error } = await query; if (error) throw error;
    }
  }
}

const all = [
  ...read("transactions.json", []).map(v => ({ ...v, status: "success" })),
  ...read("pending_transactions.json", []).map(v => ({ ...v, status: "pending" })),
  ...read("cancelled_transactions.json", []).map(v => ({ ...v, status: "cancelled" })),
];
for (const item of all) {
  const customer = { customer_phone: item.userNumber, customer_name: item.userName || item.userNumber, last_seen: new Date(item.timestamp || Date.now()).toISOString(), updated_at: new Date().toISOString() };
  const { error: customerError } = await db.from("customers").upsert(customer, { onConflict: "customer_phone" }); if (customerError) throw customerError;
  const status = item.status === "paid" ? "success" : item.status;
  const transaction = { transaction_id: item.id, customer_name: item.userName || item.userNumber, customer_phone: item.userNumber, product_name: item.serviceName || "Produk", category: item.category || null, duration: item.duration || "-", price: number(item.priceNumber ?? item.price), profit_amount: number(item.profitAmount), profit_percentage: number(item.profitPercentage), status, created_at: new Date(item.timestamp || Date.now()).toISOString(), updated_at: new Date().toISOString() };
  const { error } = await db.from("transactions").upsert(transaction, { onConflict: "transaction_id" }); if (error) throw error;
}
console.log(`Migrasi selesai: ${Object.keys(menu).length} layanan dan ${all.length} transaksi diproses.`);

