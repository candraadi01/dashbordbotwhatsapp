const supabase = require('./supabase');
const repository = require('./supabaseRepository');
const { readJson, writeJsonAtomic, databasePath } = require('./dataStore');

const mappingFile = databasePath('message_transaction_mapping.json');
const settingsFile = databasePath('bot_settings.json');
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

function customerJid(phone) {
  if (!phone) return null;
  const raw = String(phone).replace(/\D/g, '');
  if (!raw) return null;
  const normalized = raw.startsWith('08') ? `62${raw.slice(1)}` : raw;
  return `${normalized}@s.whatsapp.net`;
}

function findMapping(transactionId) {
  const map = readJson(mappingFile, {});
  for (const [messageId, entry] of Object.entries(map)) {
    const mappedId = typeof entry === 'string' ? entry : entry?.transactionId;
    if (mappedId === transactionId) {
      return { 
        messageId, 
        messageKey: entry?.messageKey || null,
        customerJid: entry?.customerJid || null 
      };
    }
  }
  return null;
}

function getBotSettings() {
  return readJson(settingsFile, {
    statusMessages: {
      pending: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *PENDING*. Mohon menunggu konfirmasi admin ya!",
      success: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *BERHASIL*. Terima kasih telah berbelanja!",
      cancelled: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *DIBATALKAN*. Silakan hubungi admin jika ada kendala."
    }
  });
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

function formatCustomerMessage(template, row, meta) {
  const transactionId = row.transaction_id || row.id || '-';
  const priceFormatted = Number(row.price || 0).toLocaleString('id-ID');
  return String(template || '')
    .replace(/\{id\}/gi, transactionId)
    .replace(/\{customer\}/gi, row.customer_name || 'Kak')
    .replace(/\{product\}/gi, row.product_name || '-')
    .replace(/\{category\}/gi, row.category || '-')
    .replace(/\{duration\}/gi, row.duration || '-')
    .replace(/\{price\}/gi, `Rp ${priceFormatted}`)
    .replace(/\{status\}/gi, meta.label);
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

    // 2. Kirim info pemberitahuan ke nomor Owner
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

    // 3. Kirim pesan notifikasi custom ke Customer sesuai setingan dashboard (Photo 4)
    const targetCustJid = customerJid(row.customer_phone) || mapping?.customerJid;
    if (targetCustJid) {
      try {
        const settings = getBotSettings();
        const defaultTpls = {
          pending: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *PENDING*. Mohon menunggu konfirmasi admin ya!",
          success: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *BERHASIL*. Terima kasih telah berbelanja!",
          cancelled: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *DIBATALKAN*. Silakan hubungi admin jika ada kendala."
        };
        const rawTpl = settings?.statusMessages?.[row.status] || defaultTpls[row.status] || defaultTpls.pending;
        const customerMsg = formatCustomerMessage(rawTpl, row, meta);
        await activeSocket.sendMessage(targetCustJid, { text: customerMsg });
        console.log(`[CUSTOMER STATUS NOTIF] Berhasil dikirim ke ${targetCustJid} (${transactionId})`);
      } catch (error) {
        console.error('[CUSTOMER STATUS NOTIF ERROR]', transactionId, error.message);
      }
    }

    await repository.markDashboardStatusSynced(row.id);
    console.log(`[DASHBOARD STATUS] ${transactionId} -> ${meta.label} tersinkron`);
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
