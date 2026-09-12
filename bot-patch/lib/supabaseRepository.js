const crypto = require('crypto');
const supabase = require('./supabase');
const { readJson, writeJsonAtomic, cachePath } = require('./dataStore');

const queueFile = cachePath('sync_queue.json');
const transactionsCache = cachePath('transactions_snapshot.json');
const enabled = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let flushing = false;
let currentStatus = 'starting';

const iso = value => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};
const normalizeStatus = status => status === 'paid' ? 'success' : ['pending', 'success', 'cancelled'].includes(status) ? status : 'pending';
const money = value => typeof value === 'number' ? value : Number(String(value ?? 0).replace(/[^0-9-]/g, '')) || 0;
const toRow = tx => ({
  transaction_id: tx.transaction_id || tx.id,
  customer_name: tx.customer_name || tx.userName || 'Customer',
  customer_phone: tx.customer_phone || tx.userNumber || '-',
  product_name: tx.product_name || tx.serviceName || 'Produk',
  category: tx.category || null,
  duration: tx.duration || '-',
  original_price: money(tx.originalPrice ?? tx.original_price ?? tx.priceNumber ?? tx.price),
  discount_amount: money(tx.discountAmount ?? tx.discount_amount),
  price: money(tx.priceNumber ?? tx.price),
  cost: Number(tx.cost ?? Math.max(Number(tx.priceNumber || 0) - Number(tx.profitAmount || 0), 0)),
  profit_amount: Number(tx.profit_amount ?? tx.profitAmount ?? 0),
  profit_percentage: Number(tx.profit_percentage ?? tx.profitPercentage ?? 0),
  status: normalizeStatus(tx.status),
  status_source: tx.statusSource || tx.status_source || 'bot',
  status_sync_state: tx.statusSyncState || tx.status_sync_state || 'synced',
  whatsapp_synced_at: tx.whatsappSyncedAt || tx.whatsapp_synced_at || new Date().toISOString(),
  created_at: iso(tx.created_at || tx.timestamp || tx.date),
  updated_at: new Date().toISOString()
});
const toLegacy = row => ({
  id: row.transaction_id || row.id, rowId: row.id, customerId: row.customer_id, timestamp: new Date(row.created_at).getTime(), date: row.created_at,
  userName: row.customer_name, userNumber: row.customer_phone, serviceName: row.product_name,
  category: row.category, duration: row.duration, price: `Rp ${Number(row.price || 0).toLocaleString('id-ID')}`,
  priceNumber: Number(row.price || 0), cost: Number(row.cost || 0), profitAmount: Number(row.profit_amount || 0),
  originalPrice: Number(row.original_price || row.price || 0), discountAmount: Number(row.discount_amount || 0),
  profitPercentage: Number(row.profit_percentage || 0), status: normalizeStatus(row.status),
  statusSource: row.status_source || 'bot', statusSyncState: row.status_sync_state || 'synced', whatsappSyncedAt: row.whatsapp_synced_at || null
});

function updateCache(item) {
  const rows = readJson(transactionsCache, []);
  const index = rows.findIndex(row => row.id === item.id);
  if (index >= 0) rows[index] = item; else rows.unshift(item);
  writeJsonAtomic(transactionsCache, rows.slice(0, 2000));
}
function updateCachedStatus(id, status) {
  const rows = readJson(transactionsCache, []);
  const index = rows.findIndex(row => row.id === id);
  if (index >= 0) {
    rows[index] = { ...rows[index], status: normalizeStatus(status), updated_at: new Date().toISOString() };
    writeJsonAtomic(transactionsCache, rows);
  }
}
function enqueue(type, payload, error) {
  const queue = readJson(queueFile, []);
  const dedupeKey = `${type}:${payload.id || payload.transaction_id || ''}:${payload.status || ''}`;
  if (!queue.some(item => item.dedupeKey === dedupeKey)) queue.push({ id: crypto.randomUUID(), dedupeKey, type, payload, attempts: 0, createdAt: new Date().toISOString(), lastError: error?.message || String(error || '') });
  writeJsonAtomic(queueFile, queue);
}
async function execute(type, payload) {
  if (type === 'upsertTransaction') return upsertTransaction(payload, false);
  if (type === 'updateStatus') return updateStatus(payload.id, payload.status, false);
  if (type === 'deleteTransaction') return deleteTransaction(payload.id, false);
  throw new Error(`Operasi queue tidak dikenal: ${type}`);
}
async function flushQueue() {
  if (!enabled || flushing) return;
  flushing = true;
  const queue = readJson(queueFile, []), remaining = [];
  for (const item of queue) {
    try { await execute(item.type, item.payload); }
    catch (error) { remaining.push({ ...item, attempts: item.attempts + 1, lastError: error.message }); }
  }
  writeJsonAtomic(queueFile, remaining); flushing = false;
}
async function upsertCustomer(tx) {
  if (!enabled) throw new Error('Supabase belum dikonfigurasi');
  const row = toRow(tx);
  const { data, error } = await supabase.from('customers').upsert({ customer_phone: row.customer_phone, customer_name: row.customer_name, last_seen: row.updated_at, updated_at: row.updated_at }, { onConflict: 'customer_phone' }).select('id,customer_phone,discount_balance').single();
  if (error) throw error;
  return data;
}
async function upsertTransaction(tx, queueOnFailure = true) {
  const row = toRow(tx);
  try {
    const customer = await upsertCustomer(row);
    const { data: existing, error: existingError } = await supabase.from('transactions').select('*').eq('transaction_id', row.transaction_id).maybeSingle();
    if (existingError) throw existingError;
    if (existing) { updateCache(toLegacy(existing)); return existing; }
    const { data, error } = await supabase.from('transactions').insert({ ...row, customer_id: customer.id }).select().single();
    if (error) throw error;
    updateCache(toLegacy(data));
    try {
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
      const cust = data.customer_name || 'Pelanggan';
      const prod = data.product_name || 'Produk';
      const txCode = data.transaction_id || data.id;
      const priceFormatted = Number(data.price || 0).toLocaleString('id-ID');
      if (typeof fetch === 'function') {
        fetch(dashboardUrl + '/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🛒 Transaksi Baru: ' + cust,
            body: prod + ' (Rp ' + priceFormatted + ') · ' + txCode,
            url: '/dashboard/transactions?edit=' + encodeURIComponent(txCode),
            transactionId: txCode,
          }),
        }).catch(() => {});
      }
    } catch (_) {}
    return data;
  } catch (error) {
    if (queueOnFailure) { enqueue('upsertTransaction', tx, error); updateCache(toLegacy(row)); }
    throw error;
  }
}
async function updateStatus(id, status, queueOnFailure = true) {
  try {
    if (!enabled) throw new Error('Supabase belum dikonfigurasi');
    const now = new Date().toISOString();
    const target = normalizeStatus(status);
    let query = supabase.from('transactions').update({ status: target, status_source: 'whatsapp', status_sync_state: 'synced', whatsapp_synced_at: now, updated_at: now }).eq('transaction_id', id);
    if (target !== 'pending') query = query.eq('status', 'pending');
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: current, error: readError } = await supabase.from('transactions').select('*').eq('transaction_id', id).maybeSingle();
      if (readError) throw readError;
      if (current && normalizeStatus(current.status) === target) return current;
      const conflict = new Error('STATUS_CONFLICT: transaksi sudah diproses dari dashboard atau perangkat lain');
      conflict.noQueue = true;
      throw conflict;
    }
    updateCache(toLegacy(data));
    try {
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
      const cust = data.customer_name || 'Pelanggan';
      const prod = data.product_name || 'Produk';
      const txCode = data.transaction_id || data.id;
      const targetStatus = normalizeStatus(status);
      let pushTitle = `⏳ Status Transaksi Pending: ${cust}`;
      let pushBody = `Pesanan ${txCode} (${prod}) menunggu konfirmasi.`;

      if (targetStatus === 'cancelled') {
        pushTitle = `❌ Transaksi Dibatalkan: ${cust}`;
        pushBody = `Pesanan ${txCode} (${prod}) telah dibatalkan.`;
      } else if (targetStatus === 'success') {
        pushTitle = `✅ Pembayaran Berhasil: ${cust}`;
        pushBody = `Pesanan ${txCode} (${prod}) telah dikonfirmasi berhasil.`;
      }

      if (typeof fetch === 'function') {
        fetch(dashboardUrl + '/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: pushTitle,
            body: pushBody,
            url: '/dashboard/transactions?edit=' + encodeURIComponent(txCode),
            transactionId: txCode,
          }),
        }).catch(() => {});
      }
    } catch (_) {}
    return data;
  } catch (error) {
    if (queueOnFailure && !error.noQueue) { updateCachedStatus(id, status); enqueue('updateStatus', { id, status }, error); }
    throw error;
  }
}
async function getTransaction(id) {
  if (enabled) {
    const { data, error } = await supabase.from('transactions').select('*').eq('transaction_id', id).maybeSingle();
    if (!error && data) return toLegacy(data);
  }
  return readJson(transactionsCache, []).find(row => row.id === id) || null;
}
async function listTransactions({ status, limit = 1000 } = {}) {
  if (enabled) {
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status) query = query.eq('status', normalizeStatus(status));
    const { data, error } = await query;
    if (!error) {
      const rows = (data || []).map(toLegacy);
      if (status) rows.forEach(updateCache); else writeJsonAtomic(transactionsCache, rows);
      return rows;
    }
    console.error('[SUPABASE LIST]', error.message);
  }
  const rows = readJson(transactionsCache, []);
  return status ? rows.filter(row => normalizeStatus(row.status) === normalizeStatus(status)).slice(0, limit) : rows.slice(0, limit);
}
async function deleteTransaction(id, queueOnFailure = true) {
  try {
    if (!enabled) throw new Error('Supabase belum dikonfigurasi');
    const { error } = await supabase.from('transactions').delete().eq('transaction_id', id); if (error) throw error;
    writeJsonAtomic(transactionsCache, readJson(transactionsCache, []).filter(row => row.id !== id));
    try {
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
      if (typeof fetch === 'function') {
        fetch(dashboardUrl + '/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🗑️ Transaksi Dihapus',
            body: `Pesanan ${id} telah dihapus dari sistem.`,
            url: '/dashboard/transactions',
            transactionId: id,
          }),
        }).catch(() => {});
      }
    } catch (_) {}
    return true;
  } catch (error) {
    if (queueOnFailure) {
      writeJsonAtomic(transactionsCache, readJson(transactionsCache, []).filter(row => row.id !== id));
      enqueue('deleteTransaction', { id }, error);
    }
    throw error;
  }
}
async function findProduct({ serviceName, category, duration }) {
  if (!enabled) return null;
  const { data, error } = await supabase.from('products').select('*').eq('name', serviceName).eq('category', category).eq('duration', duration).eq('status', 'ACTIVE').maybeSingle();
  return error ? null : data;
}
async function listDeletedTransactions(limit = 20) {
  if (!enabled) return [];
  const { data, error } = await supabase.from('transaction_logs').select('old_data,created_at').eq('action', 'DELETE').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('[AUDIT LIST]', error.message); return []; }
  return (data || []).map(item => ({ ...toLegacy(item.old_data || {}), deletedAt: item.created_at }));
}
async function listPendingDashboardActions(limit = 50) {
  if (!enabled) return [];
  const { data, error } = await supabase.from('transactions').select('*').eq('status_source', 'dashboard').eq('status_sync_state', 'pending').order('updated_at', { ascending: true }).limit(limit);
  if (error) throw error;
  return data || [];
}
async function markDashboardStatusSynced(rowId) {
  if (!enabled) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('transactions').update({ status_sync_state: 'synced', whatsapp_synced_at: now, updated_at: now }).eq('id', rowId).eq('status_source', 'dashboard').eq('status_sync_state', 'pending').select().maybeSingle();
  if (error) throw error;
  if (data) updateCache(toLegacy(data));
  return data;
}
async function heartbeat(status = currentStatus) {
  if (!enabled) return;
  const { error } = await supabase.from('bot_instances').upsert({ id: process.env.BOT_INSTANCE_ID || 'cakstore-main', name: process.env.BOT_NAME || 'CAKSTORE Bot', status, version: '2.0.0', last_seen: new Date().toISOString(), metadata: { pid: process.pid, node: process.version } });
  if (error) console.error('[HEARTBEAT]', error.message);
}
function setBotStatus(status) { currentStatus = status; return heartbeat(status); }
function startBackgroundSync() { flushQueue().catch(()=>{}); heartbeat().catch(()=>{}); setInterval(()=>flushQueue().catch(()=>{}), 30000).unref(); setInterval(()=>heartbeat().catch(()=>{}), 30000).unref(); }

module.exports = { enabled, toRow, toLegacy, upsertTransaction, updateStatus, getTransaction, listTransactions, deleteTransaction, findProduct, listDeletedTransactions, listPendingDashboardActions, markDashboardStatusSynced, flushQueue, heartbeat, setBotStatus, startBackgroundSync };
