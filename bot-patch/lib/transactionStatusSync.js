const supabase = require('./supabase');
const repository = require('./supabaseRepository');
const { readJson, writeJsonAtomic, databasePath } = require('./dataStore');

const mappingFile = databasePath('message_transaction_mapping.json');
const processing = new Set();
let activeSocket = null;
let channel = null;
let poller = null;

function ownerJid() {
  const raw = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
  if (!raw) return null;
  const normalized = raw.startsWith('08') ? `62${raw.slice(1)}` : raw;
  return `${normalized}@s.whatsapp.net`;
}

function findMapping(transactionId) {
  const map = readJson(mappingFile, {});
  for (const [messageId, entry] of Object.entries(map)) {
    const mappedId = typeof entry === 'string' ? entry : entry?.transactionId;
    if (mappedId === transactionId) {
      return { messageId, messageKey: entry?.messageKey || null };
    }
  }
  return null;
}

function statusMeta(status) {
  if (status === 'success') {
    return {
      emoji: '✅',
      label: 'BERHASIL',
      desc: 'Pembayaran telah dikonfirmasi melalui Dashboard.'
    };
  }
  if (status === 'cancelled') {
    return {
      emoji: '❌',
      label: 'GAGAL / DIBATALKAN',
      desc: 'Pesanan telah dibatalkan melalui Dashboard.'
    };
  }
  return {
    emoji: '⏳',
    label: 'PENDING',
    desc: 'Status pesanan diubah ke Pending melalui Dashboard.'
  };
}

async function processAction(row) {
  if (!activeSocket || !row?.id || processing.has(row.id)) return;
  if (row.status_source !== 'dashboard' || row.status_sync_state !== 'pending') return;
  processing.add(row.id);

  try {
    const meta = statusMeta(row.status);
    const transactionId = row.transaction_id || row.id;
    const mapping = findMapping(transactionId);
    const owner = ownerJid();

    // 1. Berikan reaksi emoji pada pesan notifikasi awal owner di WhatsApp
    if (owner && mapping?.messageKey) {
      try {
        await activeSocket.sendMessage(owner, {
          react: { text: meta.emoji, key: mapping.messageKey }
        });
      } catch (error) {
        console.error('[DASHBOARD STATUS REACTION]', error.message);
      }
    }

    // 2. Kirim info pemberitahuan HANYA ke nomor Owner (BUKAN ke customer)
    if (owner) {
      try {
        const cleanCustPhone = String(row.customer_phone || '-').replace(/@.*$/, '');
        const priceFormatted = Number(row.price || 0).toLocaleString('id-ID');
        const profitFormatted = Number(row.profit_amount || 0).toLocaleString('id-ID');

        let text = `🔔 *INFO UPDATE TRANSAKSI (DASHBOARD)*\n\n` +
          `🆔 *${transactionId}*\n` +
          `👤 Customer: ${row.customer_name || '-'}\n` +
          `📱 No. Customer: ${cleanCustPhone}\n` +
          `🛍️ Produk: ${row.product_name}\n` +
          `📦 Kategori: ${row.category || '-'}\n` +
          `⏱️ Durasi: ${row.duration || '-'}\n` +
          `💵 Total Bayar: Rp ${priceFormatted}\n`;

        if (row.profit_amount) {
          text += `💰 Profit: Rp ${profitFormatted}\n`;
        }

        text += `📌 Status: *${meta.label}* ${meta.emoji}\n\n` +
          `ℹ️ ${meta.desc}`;

        await activeSocket.sendMessage(owner, { text });
      } catch (error) {
        console.error('[OWNER STATUS NOTIFICATION]', transactionId, error.message);
      }
    }

    // CATATAN: TIDAK mengirim pesan ke customer.
    // Pembaruan status dari dashboard khusus ditujukan sebagai notifikasi ke Owner.

    await repository.markDashboardStatusSynced(row.id);
    console.log(`[DASHBOARD STATUS] ${transactionId} -> ${meta.label} tersinkron ke WhatsApp Owner`);
  } catch (error) {
    console.error('[DASHBOARD STATUS SYNC]', row.transaction_id || row.id, error.message);
  } finally {
    processing.delete(row.id);
  }
}

async function pollPending() {
  if (!activeSocket || !repository.enabled) return;
  try {
    const rows = await repository.listPendingDashboardActions();
    for (const row of rows) await processAction(row);
  } catch (error) {
    console.error('[DASHBOARD STATUS POLL]', error.message);
  }
}

function startTransactionStatusSync(socket) {
  activeSocket = socket;
  if (!repository.enabled) return console.log('[DASHBOARD STATUS] Supabase belum aktif');
  if (!channel) {
    channel = supabase.channel('bot-dashboard-transaction-actions')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions' }, (payload) => void processAction(payload.new))
      .subscribe((status) => console.log(`[DASHBOARD STATUS] Realtime ${status}`));
  }
  if (!poller) {
    poller = setInterval(() => void pollPending(), 8000);
    poller.unref();
  }
  void pollPending();
}

module.exports = { startTransactionStatusSync };
