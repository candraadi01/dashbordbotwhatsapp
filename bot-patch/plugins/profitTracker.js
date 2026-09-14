const moment = require('moment-timezone');
const crypto = require('crypto');
const repository = require('../lib/supabaseRepository');
const { readJson, writeJsonAtomic, databasePath } = require('../lib/dataStore');

const mappingFile = databasePath('message_transaction_mapping.json');
const statusProcessing = new Set();
const jakartaNow = () => moment().tz('Asia/Jakarta');
function parsePrice(value) { return Number(String(value ?? 0).replace(/[^0-9-]/g, '')) || 0; }
function extractDurationMultiplier(value) { const match = String(value || '').match(/\d+/); return match ? Number(match[0]) : 1; }
function generateTransactionId() { return `CAK${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`; }
function saveMapping(messageId, transactionId, messageKey, customerJid) { 
  const data = readJson(mappingFile, {}); 
  data[messageId] = { 
    transactionId, 
    messageKey, 
    customerJid: customerJid || null, 
    timestamp: Date.now() 
  }; 
  writeJsonAtomic(mappingFile, data); 
}
function mappedTransactionId(m) { const id = m?.quoted?.id || m?.quoted?.key?.id; const found = id ? readJson(mappingFile, {})[id] : null; return typeof found === 'string' ? found : found?.transactionId || null; }
function cleanupMapping(messageId) { if (!messageId) return; const data = readJson(mappingFile, {}); delete data[messageId]; writeJsonAtomic(mappingFile, data); }
function cleanupMappingByTransactionId(transactionId) { const data = readJson(mappingFile, {}); let changed = false; for (const [messageId, value] of Object.entries(data)) { const id = typeof value === 'string' ? value : value?.transactionId; if (id === transactionId) { delete data[messageId]; changed = true; } } if (changed) writeJsonAtomic(mappingFile, data); }
function findKey(object, wanted) {
  return Object.keys(object || {}).find(key => key.trim().toLowerCase() === String(wanted || '').trim().toLowerCase());
}

async function notifyOwner(chiwa, transaction) {
  const owner = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
  if (!owner) { console.error('[OWNER] OWNER_NUMBER belum diisi'); return null; }
  const modal = Math.max(transaction.priceNumber - transaction.profitAmount, 0);
  const discountLine = transaction.discountAmount > 0 ? `\n🎁 Potongan poin: Rp ${transaction.discountAmount.toLocaleString('id-ID')}\n🏷️ Harga awal: Rp ${transaction.originalPrice.toLocaleString('id-ID')}` : '';
  const text = `🎉 *TRANSAKSI BARU MASUK*\n\n🆔 ${transaction.id}\n👤 ${transaction.userName}\n📱 ${transaction.userNumber}\n🛍️ ${transaction.serviceName}\n📦 ${transaction.category}\n⏱️ ${transaction.duration}\n💵 Total bayar: ${transaction.price}${discountLine}\n💳 Modal: Rp ${modal.toLocaleString('id-ID')}\n💰 Profit: Rp ${transaction.profitAmount.toLocaleString('id-ID')} (${transaction.profitPercentage}%)\n⏰ ${transaction.date}\n\nReply *y* untuk konfirmasi atau *t* untuk membatalkan.`;
  const sent = await chiwa.sendMessage(`${owner}@s.whatsapp.net`, { text });
  if (sent?.key?.id) saveMapping(sent.key.id, transaction.id, sent.key, transaction.customerJid || transaction.userNumber);
  try { await chiwa.sendMessage(`${owner}@s.whatsapp.net`, { react: { text: '⏳', key: sent.key } }); } catch {}
  return sent;
}

async function recordTransaction(chiwa, input) {
  try {
    const product = await repository.findProduct(input);
    const fallbackPrice = parsePrice(input.price);
    const config = readJson(databasePath('profit_config_v2.json'), {});
    const serviceKey = findKey(config, input.serviceName);
    const serviceConfig = serviceKey ? config[serviceKey] : null;
    const categoryKey = findKey(serviceConfig || config, input.category);
    const categoryConfig = categoryKey ? (serviceConfig || config)[categoryKey] : null;
    const durationKey = findKey(categoryConfig, input.duration);
    const cachedEntry = durationKey ? categoryConfig[durationKey] : null;
    const cachedProfit = Number(cachedEntry?.profitAmount ?? 0);
    const priceNumber = Number(product?.price ?? fallbackPrice);
    const profitAmount = Number(product?.profit_amount ?? cachedProfit);
    const transaction = {
      id: generateTransactionId(), timestamp: Date.now(), date: jakartaNow().format('YYYY-MM-DD HH:mm:ss'),
      userName: input.userName || 'Customer', userNumber: input.userNumber || '-', serviceName: input.serviceName || 'Produk',
      customerJid: input.customerJid || null,
      category: input.category || '-', duration: input.duration || '-', price: `Rp ${priceNumber.toLocaleString('id-ID')}`,
      priceNumber, cost: Number(product?.cost ?? cachedEntry?.cost ?? Math.max(priceNumber - profitAmount, 0)), profitAmount,
      profitPercentage: priceNumber > 0 ? Number(((profitAmount / priceNumber) * 100).toFixed(2)) : 0,
      profitSource: product ? 'supabase_product' : 'offline_cache', status: 'pending'
    };
    try {
      const saved = await repository.upsertTransaction(transaction);
      transaction.rowId = saved.id;
      transaction.priceNumber = Number(saved.price || transaction.priceNumber);
      transaction.price = `Rp ${transaction.priceNumber.toLocaleString('id-ID')}`;
      transaction.originalPrice = Number(saved.original_price || transaction.priceNumber);
      transaction.discountAmount = Number(saved.discount_amount || 0);
      transaction.cost = Number(saved.cost || transaction.cost);
      transaction.profitAmount = Number(saved.profit_amount || 0);
      transaction.profitPercentage = Number(saved.profit_percentage || 0);
    }
    catch (error) { console.error('[TRANSACTION QUEUED]', transaction.id, error.message); }
    await notifyOwner(chiwa, transaction); return transaction;
  } catch (error) { console.error('[RECORD TRANSACTION]', error); return null; }
}

async function saveTransactionToSupabase(transaction) { return repository.upsertTransaction(transaction); }
async function setStatus(chiwa, m, transactionId, status) {
  if (!m.isOwner) return chiwa.sendMessage(m.chat, { text: '❌ Perintah ini hanya untuk owner.' }, { quoted: m });
  if (statusProcessing.has(transactionId)) return null;
  statusProcessing.add(transactionId);

  try {
    const transaction = await repository.getTransaction(transactionId);
    if (!transaction) return chiwa.sendMessage(m.chat, { text: `❌ Transaksi ${transactionId} tidak ditemukan.` }, { quoted: m });
    if (transaction.status !== 'pending') {
      cleanupMappingByTransactionId(transactionId);
      return chiwa.sendMessage(m.chat, { text: `ℹ️ Transaksi *${transactionId}* sudah diproses dengan status *${transaction.status === 'success' ? 'BERHASIL' : 'GAGAL'}*. Data tidak diubah agar tidak bentrok dengan dashboard.` }, { quoted: m });
    }

    try { await repository.updateStatus(transactionId, status); }
    catch (error) {
      if (String(error.message).includes('STATUS_CONFLICT')) {
        cleanupMappingByTransactionId(transactionId);
        return chiwa.sendMessage(m.chat, { text: `⚠️ Transaksi *${transactionId}* sudah lebih dulu diproses dari dashboard/perangkat lain. Data terbaru dipertahankan agar status tidak bentrok.` }, { quoted: m });
      }
      return chiwa.sendMessage(m.chat, { text: `⚠️ Status disimpan ke antrean sinkronisasi karena Supabase belum dapat dihubungi: ${error.message}` }, { quoted: m });
    }

    const emoji = status === 'success' ? '✅' : '❌';
    const quotedKey = m?.quoted?.key || readJson(mappingFile, {})[m?.quoted?.id]?.messageKey;
    if (quotedKey) try { await chiwa.sendMessage(m.chat, { react: { text: emoji, key: quotedKey } }); } catch {}
    cleanupMapping(m?.quoted?.id);
    cleanupMappingByTransactionId(transactionId);

    const price = Number(transaction.priceNumber || parsePrice(transaction.price));
    const profit = Number(transaction.profitAmount || 0);
    const modal = Number(transaction.cost ?? Math.max(price - profit, 0));
    const percentage = Number(transaction.profitPercentage ?? (price > 0 ? (profit / price) * 100 : 0));

    if (status === 'success') {
      const confirmation = `✅ Transaksi *${transactionId}* telah dikonfirmasi sebagai *TERBAYAR* dan disimpan ke database.\n\n💰 Keuntungan: *Rp ${profit.toLocaleString('id-ID')} (${percentage.toFixed(1)}%)*\n💸 Modal: Rp ${modal.toLocaleString('id-ID')}\n👤 Pembeli: ${transaction.userName}\n📱 No. HP: ${transaction.userNumber}\n🛍️ Produk: ${transaction.serviceName}\n📦 Kategori: ${transaction.category || '-'}\n⏱️ Durasi: ${transaction.duration || '-'}\n💵 Total bayar: Rp ${price.toLocaleString('id-ID')}`;
      await chiwa.sendMessage(m.chat, { text: confirmation }, { quoted: m });

      const stats = await getProfitStats();
      const statistics = `📈 *Statistik Keuntungan*\n\n📅 Hari ini: Rp ${stats.todayProfit.toLocaleString('id-ID')}\n🗓️ Bulan ini: Rp ${stats.monthlyProfit.toLocaleString('id-ID')}\n💼 Total keseluruhan: Rp ${stats.totalProfit.toLocaleString('id-ID')}\n✅ Transaksi sukses: ${stats.paidTransactions}\n⏳ Pending: ${stats.pendingTransactions}\n❌ Gagal/dibatalkan: ${stats.cancelledTransactions}`;
      return chiwa.sendMessage(m.chat, { text: statistics });
    }

    return chiwa.sendMessage(m.chat, { text: `❌ Transaksi *${transactionId}* telah *DIBATALKAN*.\n\n👤 ${transaction.userName}\n🛍️ ${transaction.serviceName} - ${transaction.category || '-'}\n⏱️ ${transaction.duration || '-'}\n💵 Rp ${price.toLocaleString('id-ID')}` }, { quoted: m });
  } finally {
    statusProcessing.delete(transactionId);
  }
}
async function confirmPayment(chiwa, m, id) { return setStatus(chiwa, m, id, 'success'); }
async function cancelTransaction(chiwa, m, id) { return setStatus(chiwa, m, id, 'cancelled'); }
async function confirmPaymentByReply(chiwa, m) { const id = mappedTransactionId(m); if (!id) return chiwa.sendMessage(m.chat, { text: '❌ ID transaksi tidak ditemukan pada pesan yang direply.' }, { quoted: m }); return confirmPayment(chiwa, m, id); }
async function cancelTransactionByReply(chiwa, m) { const id = mappedTransactionId(m); if (!id) return chiwa.sendMessage(m.chat, { text: '❌ ID transaksi tidak ditemukan pada pesan yang direply.' }, { quoted: m }); return cancelTransaction(chiwa, m, id); }
async function viewPendingTransactions(chiwa, m) {
  if (!m.isOwner) return;
  const rows = await repository.listTransactions({ status: 'pending', limit: 20 });
  if (!rows.length) return chiwa.sendMessage(m.chat, { text: '✅ Tidak ada transaksi pending.' }, { quoted: m });
  const text = `⏳ *TRANSAKSI PENDING*\n\n${rows.map((row, index) => `${index + 1}. *${row.id}*\n👤 ${row.userName}\n🛍️ ${row.serviceName} - ${row.category}\n💵 ${row.price}\n📅 ${row.date}`).join('\n\n')}\n\nGunakan *.y ID* atau *.t ID* untuk memproses.`;
  return chiwa.sendMessage(m.chat, { text }, { quoted: m });
}
async function getProfitStats() {
  const rows = await repository.listTransactions({ limit: 5000 }), success = rows.filter(row => row.status === 'success');
  const today = jakartaNow().format('YYYY-MM-DD'), month = jakartaNow().format('YYYY-MM');
  const jakartaDate = row => moment(row.date).tz('Asia/Jakarta').format('YYYY-MM-DD');
  return { totalTransactions: success.length, totalProfit: success.reduce((s,r)=>s+r.profitAmount,0), todayProfit: success.filter(r=>jakartaDate(r) === today).reduce((s,r)=>s+r.profitAmount,0), monthlyProfit: success.filter(r=>jakartaDate(r).startsWith(month)).reduce((s,r)=>s+r.profitAmount,0), pendingTransactions: rows.filter(r=>r.status==='pending').length, paidTransactions: success.length, cancelledTransactions: rows.filter(r=>r.status==='cancelled').length };
}

module.exports = { recordTransaction, confirmPayment, cancelTransaction, confirmPaymentByReply, cancelTransactionByReply, viewPendingTransactions, getProfitStats, parsePrice, extractDurationMultiplier, saveTransactionToSupabase, cleanupMappingByTransactionId };
