const chalk = require('chalk');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { recordTransaction, confirmPaymentByReply, cancelTransactionByReply } = require('./plugins/profitTracker'); // Import profit tracker
const { syncCatalog, startCatalogSync } = require('./lib/catalogSync');
startCatalogSync();

// Global context untuk menyimpan state pilihan user
// context: { step, options, chosenCategory, durations, prices, menuKey, categoryImage, chosenDuration, chosenPrice, subscriptionName, userName }
const userContext = {}; 
const welcomeCooldown = {}; // key: sender, value: timestamp

function resolveLocalImage(imagePath) {
  if (!imagePath) return null;
  if (/^https:\/\//i.test(imagePath)) return imagePath;
  if (fs.existsSync(imagePath)) return imagePath;
  const localPath = path.join(__dirname, 'database', 'img', path.basename(imagePath));
  return fs.existsSync(localPath) ? localPath : null;
}

module.exports = async (chiwa, m) => {
  // Ambil informasi dasar
  const prefix = process.env.PREFIX || '.';
  const body = m?.body || m?.text || m?.message?.conversation || "";
  const ownerNumber = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
  const ownerLid = String(process.env.OWNER_LID || '').replace(/\D/g, '');
  const senderNumber = String(m.sender || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  const chatNumber = String(m.chat || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  const alternateIds = [
    m.senderAlt,
    m.chatAlt,
    m.key?.remoteJidAlt,
    m.key?.participantAlt,
    m.key?.senderPn
  ].filter(Boolean);
  const alternateNumbers = alternateIds.map(
    value => String(value).split('@')[0].split(':')[0].replace(/\D/g, '')
  );
  const lidNumber = String(m.sender || m.chat || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');
  // Pada Baileys/WhatsApp baru, akun bisa muncul sebagai @lid sehingga nomor
  // tidak selalu tersedia di JID. Pesan fromMe adalah pesan yang benar-benar
  // dikirim dari akun bot/owner melalui salah satu linked device.
  const sentFromBotAccount = Boolean(m.key?.fromMe || m.fromMe);
  const isOwner = sentFromBotAccount || (
    Boolean(ownerNumber) && (
      senderNumber === ownerNumber ||
      chatNumber === ownerNumber ||
      alternateNumbers.includes(ownerNumber)
    )
  ) || (
    Boolean(ownerLid) && lidNumber === ownerLid
  );
  m.isOwner = isOwner;

  // Kompatibilitas dengan plugin lama yang masih mengecek m.sender.includes(OWNER_NUMBER).
  // WhatsApp versi baru dapat memberi sender @lid, jadi untuk pesan dari linked
  // device akun bot kita normalkan ke JID nomor owner.
  if (sentFromBotAccount && ownerNumber) {
    m.sender = `${ownerNumber}@s.whatsapp.net`;
  }

  // Pesan keluaran bot diabaikan agar tidak looping. Khusus akun owner/bot sendiri,
  // command dan reply y/t tetap diproses.
  if (m.key?.fromMe) {
    const normalizedBody = body.trim().toLowerCase();
    const isOwnerControl = isOwner && (
      normalizedBody.startsWith(prefix) ||
      (m.quoted && ['y', 't'].includes(normalizedBody))
    );
    if (!isOwnerControl) return;
  }
  
  // Bot hanya melayani private chat
  if (m.isGroup) return;

  const isCmd = body.startsWith(prefix);
  const time = moment(Date.now())
    .tz('Asia/Jakarta')
    .locale('id')
    .format('HH:mm:ss z');

  // Log pesan (hanya untuk private chat)
  if (m.message && !m.isGroup) {
    console.log(
      '\x1b[1;31m~\x1b[1;37m>',
      '[\x1b[1;32m CAK STORE🔥 \x1b[1;37m]',
      time,
      chalk.green(body.slice(0, 100)),
      'from',
      chalk.green(m.pushName || ''),
      'in',
      chalk.green('Private Chat')
    );
  }

  // === HANDLER REPLY UNTUK KONFIRMASI TRANSAKSI (PRIORITAS TERTINGGI) ===
  // Harus dicek pertama sebelum handler lainnya
  if (m.quoted && isOwner) {
    const replyText = body.trim().toLowerCase();
    
    // Cek apakah reply dengan 'y' untuk konfirmasi
    if (replyText === 'y') {
      welcomeCooldown[m.sender] = Date.now(); // reset cooldown
      await confirmPaymentByReply(chiwa, m);
      return;
    }
    
    // Cek apakah reply dengan 't' untuk batalkan
    if (replyText === 't') {
      welcomeCooldown[m.sender] = Date.now(); // reset cooldown
      await cancelTransactionByReply(chiwa, m);
      return;
    }
  }

  // === Handler untuk pesan "cs" tanpa prefix ===
 if (body.trim().toLowerCase() === 'cs') {
     await chiwa.sendMessage(m.chat, { text: 
    '🌟 *Terima kasih telah menghubungi kami!*\n\n' +
    '📸 Jika Anda mengalami kendala, silakan lampirkan *foto bukti masalah*.\n' +
    '❓ Jika ada pertanyaan, jangan ragu untuk mengirimkan pesan Anda sekarang.\n\n' +
    '*CS* kami akan segera menghubungi Anda.\n\n' +
    '📌 *Mohon ditunggu sebentar...*' }, { quoted: m });
    return;
  }

  // === Jika pesan merupakan perintah (diawali prefix) ===
  if (isCmd) {
    welcomeCooldown[m.sender] = Date.now(); // reset welcomeCooldown
    const command = body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();

    if (command === 'ping') {
      await chiwa.sendMessage(m.chat, { text: 'pong' }, { quoted: m });
      return;
    }

    if (command === 'synccatalog') {
      if (!isOwner) return;
      try {
        const result = await syncCatalog();
        await chiwa.sendMessage(m.chat, { text: `✅ Katalog disinkronkan dari Supabase: ${result.count} produk aktif.` }, { quoted: m });
      } catch (error) {
        await chiwa.sendMessage(m.chat, { text: `❌ Sinkronisasi katalog gagal: ${error.message}` }, { quoted: m });
      }
      return;
    }

    if (command === 'botversion') {
      await chiwa.sendMessage(m.chat, {
        text: `✅ *CAKSTORE Bot v1.3-lid-fix*\n\nOwner terdeteksi: ${isOwner ? 'YA' : 'TIDAK'}\nfromMe: ${sentFromBotAccount ? 'YA' : 'TIDAK'}\nNomor alternatif tersedia: ${alternateNumbers.length ? 'YA' : 'TIDAK'}`
      }, { quoted: m });
      return;
    }

    if (command === 'myid') {
      await chiwa.sendMessage(m.chat, {
        text: `🪪 *ID WhatsApp Anda*\n\n${m.sender || m.chat}\n\nJika berakhiran *@lid*, masukkan angka sebelum @lid ke variabel *OWNER_LID* di file .env.`
      }, { quoted: m });
      return;
    }

    // Jika ingin menggunakan command "cs" dengan prefix juga (opsional)
    if (command === 'cs') {
      await chiwa.sendMessage(m.chat, { text:
    '🌟 *Terima kasih telah menghubungi kami!*\n\n' +
    '📸 Jika Anda mengalami kendala, silakan lampirkan *foto bukti masalah*.\n' +
    '❓ Jika ada pertanyaan, jangan ragu untuk mengirimkan pesan Anda sekarang.\n\n' +
    '*CS* kami akan segera menghubungi Anda.\n\n' +
    '📌 *Mohon ditunggu sebentar...*' }, { quoted: m });
      return;
    }

    // Command untuk fitur keuntungan (hanya owner)
    if (command === 'stats') {
      const stats = require('./plugins/stats');
      await stats(chiwa, m);
      return;
    }
    if (command === 'profit') {
      const profit = require('./plugins/profit');
      await profit(chiwa, m);
      return;
    }
    if (command === 'transactions') {
      const transactions = require('./plugins/transactions');
      await transactions(chiwa, m);
      return;
    }
    
    if (command === 'setuntung') {
      const transactions = require('./plugins/setuntung');
      await transactions(chiwa, m);
      return;
    }

    // Command untuk transaksi pending (hanya owner)
    if (command === 'pending') {
      const pending = require('./plugins/pending');
      await pending(chiwa, m);
      return;
    }
    
    // Command untuk melihat transaksi yang dibatalkan (hanya owner)
    if (command === 'cancelled') {
      const cancelled = require('./plugins/cancelled');
      await cancelled(chiwa, m);
      return;
    }

    // Command untuk konfirmasi pembayaran (hanya owner) - Backward compatibility
    if (command === 'y' || command === 't') {
      const paymentConfirmation = require('./plugins/paymentConfirmation');
      await paymentConfirmation(chiwa, m);
      return;
    }

    // Command untuk hapus transaksi (hanya owner)
    if (command === 'del') {
      const deleteTransaction = require('./plugins/deleteTransaction');
      await deleteTransaction(chiwa, m);
      return;
    }
    
    // Command untuk konfirmasi hapus transaksi (hanya owner)
    if (command === 'confirmdelete') {
      const { confirmDelete } = require('./plugins/deleteTransaction');
      await confirmDelete(chiwa, m);
      return;
    }
    
    // Command untuk melihat transaksi yang dihapus (hanya owner)
    if (command === 'deleted') {
      const deletedTransactions = require('./plugins/deletedTransactions');
      await deletedTransactions(chiwa, m);
      return;
    }

    if (command.startsWith('addmenu')) {
      const addmenu = require('./plugins/addmenu');
      await addmenu(chiwa, m);
      return;
    }
    if (command.startsWith('addkategori')) {
      const addkategori = require('./plugins/addkategori');
      await addkategori(chiwa, m);
      return;
    }
    if (command.startsWith('adddurasi')) {
      const adddurasi = require('./plugins/adddurasi');
      await adddurasi(chiwa, m);
      return;
    }
    if (command.startsWith('allfiturown')) {
      const allfiturown = require('./plugins/allfiturown');
      await allfiturown(chiwa, m);
      return;
    }
  }

  // === Proses gambar untuk pending kategori (owner) ===
  const pendingPath = path.join(__dirname, 'database', 'pending_kategori.json');
  if (isOwner && fs.existsSync(pendingPath) && m.message?.imageMessage) {
    welcomeCooldown[m.sender] = Date.now();
    try {
      const pendingData = JSON.parse(fs.readFileSync(pendingPath));
      if (pendingData.sender === m.sender) {
        const stream = await downloadContentFromMessage(m.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const imgFolder = path.join(__dirname, 'database', 'img');
        if (!fs.existsSync(imgFolder)) fs.mkdirSync(imgFolder, { recursive: true });
        const imageFileName = `${pendingData.number}_${Date.now()}.jpg`;
        const imagePath = path.join(imgFolder, imageFileName);
        fs.writeFileSync(imagePath, buffer);
        const kategoriPath = path.join(__dirname, 'database', 'kategori.json');
        let kategoriData = {};
        if (fs.existsSync(kategoriPath)) {
          try {
            kategoriData = JSON.parse(fs.readFileSync(kategoriPath));
          } catch (err) {
            console.error('Error membaca database kategori:', err);
          }
        }
        kategoriData[pendingData.number] = { categories: pendingData.categories, image: imagePath };
        fs.writeFileSync(kategoriPath, JSON.stringify(kategoriData, null, 2));
        fs.unlinkSync(pendingPath);
        await chiwa.sendMessage(m.chat, {
          text: `Kategori dengan angka ${pendingData.number} telah disimpan dengan gambar.`
        }, { quoted: m });
        return;
      }
    } catch (err) {
      console.error('Error memproses pending kategori:', err);
    }
  }

  // === Jika ada konteks subscriptionCategory (user memilih kategori berlangganan) ===
  if (userContext[m.sender] && userContext[m.sender].step === 'subscriptionCategory') {
    welcomeCooldown[m.sender] = Date.now();
    const context = userContext[m.sender];
    const input = body.trim();
    if (input.toLowerCase() === "back") {
      delete userContext[m.sender];
      const dbDir = path.join(__dirname, 'database');
      let menuText = '';
      const menuDBPath = path.join(dbDir, 'menu.json');
      if (fs.existsSync(menuDBPath)) {
        try {
          const menuData = JSON.parse(fs.readFileSync(menuDBPath));
          for (const key in menuData) {
            menuText += `• Ketik ${key} untuk ${menuData[key]}\n`;
          }
        } catch (e) {
          menuText = 'Menu tidak tersedia saat ini.';
        }
      } else {
        menuText = 'Menu belum tersedia.';
      }
      const welcomeText =
`✨ Selamat Datang di *CakStore* ✨

⏰ *Jam Operasional*:
   • Senin - Sabtu: 09.00 - 21.00
   • Minggu: 12.00 - 21.00

*Silakan pilih layanan yang Anda butuhkan:*
${menuText}

Ketik cs untuk chat langsung dengan Customer Service!💬`;
      await chiwa.sendMessage(m.chat, { text: welcomeText });
      return;
    }
    let chosenCategory;
    if (/^\d+$/.test(input)) {
      const index = parseInt(input) - 1;
      if (index < 0 || index >= context.options.length) {
        await chiwa.sendMessage(m.chat, { text: 'Pilihan kategori tidak valid.' }, { quoted: m });
        return;
      }
      chosenCategory = context.options[index];
    } else {
      const inputLower = input.toLowerCase();
      chosenCategory = context.options.find(opt => opt.toLowerCase() === inputLower);
      if (!chosenCategory) {
        await chiwa.sendMessage(m.chat, {
          text: 'Nama kategori tidak ditemukan. Silakan ketik angka atau nama kategori yang benar, atau ketik "back" untuk kembali.'
        }, { quoted: m });
        return;
      }
    }
    const dbDir = path.join(__dirname, 'database');
    const durasiPath = path.join(dbDir, 'durasi.json');
    if (fs.existsSync(durasiPath)) {
      let durasiData = {};
      try {
        durasiData = JSON.parse(fs.readFileSync(durasiPath));
      } catch (err) {
        console.error('Error membaca durasi.json:', err);
      }
      // Cache baru dipisah per layanan agar kategori bernama sama (contoh:
      // PRIVATE) tidak mencampur durasi dari produk lain. Bentuk lama tetap
      // didukung selama proses transisi setelah file bot diganti.
      const serviceDurations = durasiData[context.subscriptionName];
      const selectedDurationData = serviceDurations?.[chosenCategory] || durasiData[chosenCategory];
      if (selectedDurationData) {
        const durations = selectedDurationData.durations;
        const prices = selectedDurationData.prices;
        let textMsg = `Anda memilih kategori *${chosenCategory}*.\n\n*Silakan pilih durasi berlangganan:*\n`;
        durations.forEach((d, idx) => { textMsg += `🔹 Ketik ${idx + 1} untuk "${d}" dengan harga ${prices[idx]}\n`; });
        textMsg += `\nCatatan: Anda dapat mengetik angka atau nama durasi, atau ketik "back" untuk kembali ke pemilihan kategori.\n`;
        userContext[m.sender] = {
          step: 'durationSelection',
          chosenCategory,
          durations,
          prices,
          menuKey: context.menuKey,
          subscriptionOptions: context.options,
          categoryImage: context.categoryImage,
          subscriptionName: context.subscriptionName
        };
        await chiwa.sendMessage(m.chat, { text: textMsg }, { quoted: m });
        return;
      } else {
        await chiwa.sendMessage(m.chat, { text: `Anda memilih kategori *${chosenCategory}*. Tidak ada opsi durasi yang tersedia.` }, { quoted: m });
        delete userContext[m.sender];
        return;
      }
    } else {
      await chiwa.sendMessage(m.chat, { text: `Anda memilih kategori *${chosenCategory}*. Tidak ada opsi durasi yang tersedia.` }, { quoted: m });
      delete userContext[m.sender];
      return;
    }
  }

  // === Jika ada konteks durationSelection (user memilih durasi) ===
  if (userContext[m.sender] && userContext[m.sender].step === 'durationSelection') {
    welcomeCooldown[m.sender] = Date.now();
    const context = userContext[m.sender];
    const input = body.trim();
    if (input.toLowerCase() === "back") {
      if (context.subscriptionOptions) {
        let textMsg = `Silakan pilih kategori berlangganan:\n`;
        context.subscriptionOptions.forEach((cat, idx) => { textMsg += `🔹 Ketik ${idx + 1} untuk "${cat}"\n`; });
        textMsg += `\nCatatan: Anda dapat mengetik angka atau nama kategori, atau ketik "back" untuk kembali ke menu utama.`;
        userContext[m.sender] = {
          step: 'subscriptionCategory',
          options: context.subscriptionOptions,
          menuKey: context.menuKey,
          categoryImage: context.categoryImage,
          subscriptionName: context.subscriptionName
        };
        if (context.categoryImage) {
          await chiwa.sendMessage(m.chat, { image: { url: context.categoryImage }, caption: textMsg }, { quoted: m });
        } else {
          await chiwa.sendMessage(m.chat, { text: textMsg }, { quoted: m });
        }
      }
      return;
    }
    if (/^\d+$/.test(input)) {
      const index = parseInt(input) - 1;
      if (index < 0 || index >= context.durations.length) {
        await chiwa.sendMessage(m.chat, { text: 'Pilihan durasi tidak valid.' }, { quoted: m });
        return;
      }
      const chosenDuration = context.durations[index];
      const chosenPrice = context.prices[index];
      userContext[m.sender].step = 'nameEntry';
      userContext[m.sender].chosenDuration = chosenDuration;
      userContext[m.sender].chosenPrice = chosenPrice;
      await chiwa.sendMessage(m.chat,  {
      text: `📄 Anda telah memilih:\n\n⏳ *Durasi* : ${chosenDuration}\n💰 *Harga* : ${chosenPrice}\n📂 *Kategori* : ${context.chosenCategory}\n\n📝 Silakan ketik *nama lengkap Anda* untuk melanjutkan proses transaksi.`
      }, { quoted: m });
      return;
    }
    const durationIndex = context.durations.findIndex(
      duration => duration.toLowerCase() === input.toLowerCase()
    );
    if (durationIndex >= 0) {
      const chosenDuration = context.durations[durationIndex];
      const chosenPrice = context.prices[durationIndex];
      userContext[m.sender].step = 'nameEntry';
      userContext[m.sender].chosenDuration = chosenDuration;
      userContext[m.sender].chosenPrice = chosenPrice;
      await chiwa.sendMessage(m.chat, {
        text: `📄 Anda telah memilih:\n\n⏳ *Durasi* : ${chosenDuration}\n💰 *Harga* : ${chosenPrice}\n📂 *Kategori* : ${context.chosenCategory}\n\n📝 Silakan ketik *nama lengkap Anda* untuk melanjutkan proses transaksi.`
      }, { quoted: m });
      return;
    }
    await chiwa.sendMessage(m.chat, {
      text: 'Pilihan durasi tidak valid. Ketik angka atau nama durasi yang tersedia.'
    }, { quoted: m });
    return;
  }

  // === Jika ada konteks nameEntry (user memasukkan nama untuk transaksi) ===
  if (userContext[m.sender] && userContext[m.sender].step === 'nameEntry') {
    welcomeCooldown[m.sender] = Date.now();
    const context = userContext[m.sender];
    const userName = body.trim();
    const subscriptionName = context.subscriptionName || context.menuKey;
    const confirmationMsg =
`✨ *Terima kasih!* Anda telah selesai mengisi informasi berlangganan. Berikut adalah data pendaftaran Anda:\n
👤 *Nama*          : ${userName}
🔹 *Langganan*   : ${subscriptionName}
🔹 *Kategori*     : ${context.chosenCategory}
🔹 *Durasi*        : ${context.chosenDuration}
🔹 *Total Harga*  : ${context.chosenPrice}\n
➡ Ketik *Y* untuk lanjut ke Pembayaran
🔁 Ketik *0* untuk kembali ke Menu Utama`;
    await chiwa.sendMessage(m.chat, { text: confirmationMsg }, { quoted: m });
    userContext[m.sender].step = 'paymentConfirmation';
    userContext[m.sender].userName = userName;
    return;
  }

  // === Jika ada konteks paymentConfirmation (user konfirmasi pembayaran) ===
  if (userContext[m.sender] && userContext[m.sender].step === 'paymentConfirmation') {
    welcomeCooldown[m.sender] = Date.now();
    const context = userContext[m.sender];
    const input = body.trim().toLowerCase();
    if (input === 'y') {
      // === CATAT TRANSAKSI DAN KIRIM NOTIFIKASI KE OWNER ===
      const transactionData = {
        userName: context.userName,
        userNumber: m.sender.replace('@s.whatsapp.net', ''),
        customerJid: m.chat,
        category: context.chosenCategory,
        duration: context.chosenDuration,
        price: context.chosenPrice,
        serviceName: context.subscriptionName || context.menuKey
      };
      
      // Record transaksi untuk pencatatan keuntungan (sekarang masuk ke pending)
      const transaction = await recordTransaction(chiwa, transactionData);
      const finalPrice = transaction?.price || context.chosenPrice;
      const discountNote = Number(transaction?.discountAmount || 0) > 0
        ? `\n🎁 Potongan poin: *Rp ${Number(transaction.discountAmount).toLocaleString('id-ID')}*\nHarga awal: *Rp ${Number(transaction.originalPrice).toLocaleString('id-ID')}*`
        : '';
      
      const paymentImagePath = path.join(__dirname, 'database', 'img', 'payment', 'payment.jpg');
      
      let paySettings = {
        greetingTemplate: "Hello Kak *{customer}* 👋\n\ntotalnya jadi : *{total}*{discount}\nsilahkan lakukan pembayaran ya",
        dana: "081455124049",
        bri: "068001007528536",
        ewallet: "082338184217",
        accountName: "candra adi kusuma",
        footerNotes: "⚠️ BCA BISA SCAN QRIS 🔮\n🔔 Kirimkan bukti pembayaran untuk aktivasi paket Anda. Disini 📌Terima kasih!"
      };
      const botSettingsPath = path.join(__dirname, 'database', 'bot_settings.json');
      if (fs.existsSync(botSettingsPath)) {
        try {
          const parsedSettings = JSON.parse(fs.readFileSync(botSettingsPath, 'utf8'));
          if (parsedSettings && parsedSettings.payment) {
            paySettings = { ...paySettings, ...parsedSettings.payment };
          }
        } catch (e) {}
      }

      const greeting = (paySettings.greetingTemplate || "Hello Kak *{customer}* 👋\n\ntotalnya jadi : *{total}*{discount}\nsilahkan lakukan pembayaran ya")
        .replace(/\{customer\}/g, context.userName || '')
        .replace(/\{total\}/g, finalPrice || '')
        .replace(/\{discount\}/g, discountNote || '');

      const caption =
`${greeting}

💳 Dana: ${paySettings.dana || '-'}
💳 BRI: ${paySettings.bri || '-'}
💳 gopay/shopeepay/ovo:      
      ${paySettings.ewallet || '-'}
👤 An (${paySettings.accountName || '-'})

${paySettings.footerNotes || ''}`.trim();

      if (fs.existsSync(paymentImagePath)) {
        try {
          const image = fs.readFileSync(paymentImagePath);
          await chiwa.sendMessage(m.chat, { image, caption }, { quoted: m });
        } catch (imgErr) {
          console.error('[PAYMENT IMAGE SEND ERROR]', imgErr.message);
          await chiwa.sendMessage(m.chat, { text: caption }, { quoted: m });
        }
      } else {
        await chiwa.sendMessage(m.chat, { text: caption }, { quoted: m });
      }
      delete userContext[m.sender];
      return;
    } else if (input === '0') {
      delete userContext[m.sender];
      const dbDir = path.join(__dirname, 'database');
      let menuText = '';
      const menuDBPath = path.join(dbDir, 'menu.json');
      if (fs.existsSync(menuDBPath)) {
        try {
          const menuData = JSON.parse(fs.readFileSync(menuDBPath));
          for (const key in menuData) { menuText += `• Ketik ${key} untuk ${menuData[key]}\n`; }
        } catch (e) { menuText = 'Menu tidak tersedia saat ini.'; }
      } else { menuText = 'Menu belum tersedia.'; }
      const welcomeText =
`✨ Selamat Datang di *CakStore* ✨

⏰ *Jam Operasional*:
   • Senin - Sabtu: 09.00 - 21.00
   • Minggu: 12.00 - 21.00

*Silakan pilih layanan yang Anda butuhkan:*
${menuText}

Ketik cs untuk chat langsung dengan Customer Service!💬`;
      await chiwa.sendMessage(m.chat, { text: welcomeText });
      return;
    } else {
      await chiwa.sendMessage(m.chat, { text: 'Pilihan tidak valid. Ketik *Y* untuk pembayaran atau *0* untuk kembali ke menu utama.' }, { quoted: m });
      return;
    }
  }

  // === Handler untuk membuka menu utama (ketik "0") ===
  if (body.trim() === "0") {
    welcomeCooldown[m.sender] = Date.now();
    try {
      await syncCatalog();
    } catch (error) {
      console.error('[CATALOG ON DEMAND]', error.message);
    }
    const dbDir = path.join(__dirname, 'database');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    let menuText = '';
    const menuDBPath = path.join(dbDir, 'menu.json');
    if (fs.existsSync(menuDBPath)) {
      try {
        const menuData = JSON.parse(fs.readFileSync(menuDBPath));
        for (const key in menuData) { menuText += `• Ketik ${key} untuk ${menuData[key]}\n`; }
      } catch (e) { menuText = 'Menu tidak tersedia saat ini.'; }
    } else { menuText = 'Menu belum tersedia.'; }
    const welcomeText =
`✨ Selamat Datang di *CakStore* ✨

⏰ *Jam Operasional*:
   • Senin - Sabtu: 09.00 - 21.00
   • Minggu: 12.00 - 21.00

*Silakan pilih layanan yang Anda butuhkan:*
${menuText}

Ketik cs untuk chat langsung dengan Customer Service!💬`;
    await chiwa.sendMessage(m.chat, { text: welcomeText });
    return;
  }

  // === Handler untuk input berupa angka (selain "0") pada menu utama ===
  if (!isCmd && /^\d+$/.test(body.trim()) && body.trim() !== "0") {
    welcomeCooldown[m.sender] = Date.now();
    const selected = body.trim();
    const kategoriDBPath = path.join(__dirname, 'database', 'kategori.json');
    if (fs.existsSync(kategoriDBPath)) {
      let kategoriData = {};
      try { kategoriData = JSON.parse(fs.readFileSync(kategoriDBPath)); }
      catch (err) { console.error('Error membaca database kategori:', err); }
      if (kategoriData[selected]) {
        const data = kategoriData[selected];
        let serviceName = "layanan";
        const menuDBPath = path.join(__dirname, 'database', 'menu.json');
        if (fs.existsSync(menuDBPath)) {
          try {
            const menuData = JSON.parse(fs.readFileSync(menuDBPath));
            if (menuData[selected]) serviceName = menuData[selected];
          } catch (e) { console.error('Error membaca database menu:', e); }
        }
        const categoryImage = resolveLocalImage(data.image);
        userContext[m.sender] = {
          step: 'subscriptionCategory',
          options: data.categories,
          menuKey: selected,
          categoryImage,
          subscriptionName: serviceName
        };
        let textMsg = `Anda memilih layanan *"${serviceName}"*.\n\n*Silakan pilih kategori berlangganan:*\n`;
        data.categories.forEach((cat, index) => { textMsg += `🔹 Ketik ${index + 1} untuk "${cat}"\n`; });
        textMsg += `\nCatatan: Anda dapat mengetik angka atau nama kategori, atau ketik "back" untuk kembali ke menu utama.\n`;
        if (categoryImage) {
          await chiwa.sendMessage(m.chat, { image: { url: categoryImage }, caption: textMsg }, { quoted: m });
        } else {
          await chiwa.sendMessage(m.chat, { text: textMsg }, { quoted: m });
        }
        return;
      }
    }
    const menuDBPath = path.join(__dirname, 'database', 'menu.json');
    if (fs.existsSync(menuDBPath)) {
      let menuData = {};
      try { menuData = JSON.parse(fs.readFileSync(menuDBPath)); }
      catch (err) { console.error('Error membaca database menu:', err); }
      if (menuData[selected]) {
        await chiwa.sendMessage(m.chat, { text: `Anda memilih layanan "${menuData[selected]}"` }, { quoted: m });
      } else {
        await chiwa.sendMessage(m.chat, { text: 'Menu tidak ditemukan. Silakan coba lagi.' }, { quoted: m });
      }
    } else {
      await chiwa.sendMessage(m.chat, { text: 'Menu belum tersedia. Silakan hubungi Customer Service.' }, { quoted: m });
    }
    return;
  }

  // === Default handler untuk pesan yang tidak dikenali ===
  const now = Date.now();
  if (!welcomeCooldown[m.sender] || (now - welcomeCooldown[m.sender] > 259200000)) { // 3 hari = 259200000 ms
    welcomeCooldown[m.sender] = now;
    await chiwa.sendMessage(m.chat, {   text: `Hallo kak *${m.pushName || 'Customer'}* 👋,\nSelamat datang di *CAKSTORE!*\n\nUntuk melihat menu, silakan ketik *0*`
  }, { quoted: m });
  }
};
