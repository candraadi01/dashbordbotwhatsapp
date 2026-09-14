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
  const str = String(phone).trim();
  if (str.includes('@lid') || str.includes('@s.whatsapp.net')) {
    return str;
  }
  const raw = str.replace(/\D/g, '');
  if (!raw) return null;
  // WhatsApp LID is typically 15-16 digits starting with 19...
  if (raw.length >= 15 || str.includes('lid')) {
    return `${raw}@lid`;
  }
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

let inMemorySettings = null;

const DEFAULT_TEMPLATES = {
  pending: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *PENDING*. Mohon menunggu konfirmasi admin ya!",
  success: "Halo, Pesanan kamu dengan ID *{id}* untuk produk *{product}* Kategori *{category}* saat ini berstatus *BERHASIL*. Terima kasih telah berbelanja!",
  cancelled: "Pesanan Anda dibatalkan. Silakan hubungi admin jika memerlukan bantuan."
};

function getBotSettings() {
  if (inMemorySettings && inMemorySettings.statusMessages) {
    return inMemorySettings;
  }
  const fromDisk = readJson(settingsFile, null);
  if (fromDisk && fromDisk.statusMessages) {
    return fromDisk;
  }
  return {
    statusMessages: { ...DEFAULT_TEMPLATES }
  };
}

async function fetchRemoteSettings() {
  if (!repository.enabled) return null;
  try {
    const { data, error } = await supabase
      .from('bot_instances')
      .select('metadata')
      .eq('id', 'bot_settings')
      .maybeSingle();

    if (data && data.metadata && data.metadata.statusMessages) {
      inMemorySettings = data.metadata;
      try {
        writeJsonAtomic(settingsFile, data.metadata);
      } catch (_) {}
      return data.metadata;
    }
  } catch (err) {
    console.error('[SETTINGS REMOTE FETCH ERROR]', err.message);
  }
  return null;
}

async function getLatestBotSettings() {
  const remote = await fetchRemoteSettings();
  if (remote) return remote;
  return getBotSettings();
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
    const targetCustJid = mapping?.customerJid || customerJid(row.customer_phone);

    // 1. Ambil setting template pesan terbaru langsung dari Supabase / cache lokal
    const settings = await getLatestBotSettings();
    const rawTpl = settings?.statusMessages?.[row.status] || DEFAULT_TEMPLATES[row.status] || DEFAULT_TEMPLATES.cancelled;
    const customerMsg = formatCustomerMessage(rawTpl, row, meta);

    // 2. Kirim pesan notifikasi custom HANYA ke Customer sesuai setingan dashboard
    if (targetCustJid) {
      try {
        await activeSocket.sendMessage(targetCustJid, { text: customerMsg });
        console.log(`[CUSTOMER STATUS NOTIF] Berhasil dikirim ke ${targetCustJid} (${transactionId}): "${customerMsg}"`);
      } catch (error) {
        console.error('[CUSTOMER STATUS NOTIF ERROR]', transactionId, error.message);
      }
    }

    // 3. Berikan reaksi emoji pada pesan notifikasi awal di WhatsApp jika ada key mapping
    if (owner && mapping?.messageKey) {
      try {
        await activeSocket.sendMessage(owner, {
          react: { text: meta.emoji, key: mapping.messageKey }
        });
      } catch (error) {
        console.error('[DASHBOARD STATUS REACTION]', error.message);
      }
    }

    // Tandai action status sinkronisasi selesai di database
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

  // Load settings remote Supabase on start
  fetchRemoteSettings().then(st => {
    if (st) console.log('[BOT SETTINGS] Pengaturan template berhasil dimuat dari Supabase');
  }).catch(e => console.error('[BOT SETTINGS INIT]', e.message));

  // Listen to realtime changes on bot_instances where id = bot_settings
  try {
    supabase.channel('bot-settings-live-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bot_instances',
        filter: 'id=eq.bot_settings'
      }, (payload) => {
        if (payload.new && payload.new.metadata && payload.new.metadata.statusMessages) {
          inMemorySettings = payload.new.metadata;
          try {
            writeJsonAtomic(settingsFile, payload.new.metadata);
          } catch (_) {}
          console.log('[BOT SETTINGS] Realtime update template pesan diterima dari Dashboard');
        }
      })
      .subscribe((status) => console.log(`[BOT SETTINGS CHANNEL] Realtime ${status}`));
  } catch (err) {
    console.warn('[BOT SETTINGS CHANNEL]', err.message);
  }

  // Subscribe to transactions changes
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
