const fs = require('fs');
const path = require('path');

const targetPaths = [
  path.resolve(__dirname, '../../BOT PANEL/chiww.js'),
  path.resolve(__dirname, '../../BOT PANEL BACKUP/chiww.js')
];

const targetPattern = /const paymentImagePath = path\.join\(__dirname, 'database', 'img', 'payment', 'payment\.jpg'\);[\s\S]*?const caption =\s*`Hello Kak \*[\s\S]*?Terima kasih!`;/m;

const replacementCode = `const paymentImagePath = path.join(__dirname, 'database', 'img', 'payment', 'payment.jpg');
      
      let paySettings = {
        greetingTemplate: "Hello Kak *{customer}* 👋\\n\\ntotalnya jadi : *{total}*{discount}\\nsilahkan lakukan pembayaran ya",
        dana: "081455124049",
        bri: "068001007528536",
        ewallet: "082338184217",
        accountName: "candra adi kusuma",
        footerNotes: "⚠️ BCA BISA SCAN QRIS 🔮\\n🔔 Kirimkan bukti pembayaran untuk aktivasi paket Anda. Disini 📌Terima kasih!"
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

      const greeting = (paySettings.greetingTemplate || "Hello Kak *{customer}* 👋\\n\\ntotalnya jadi : *{total}*{discount}\\nsilahkan lakukan pembayaran ya")
        .replace(/\\{customer\\}/g, context.userName || '')
        .replace(/\\{total\\}/g, finalPrice || '')
        .replace(/\\{discount\\}/g, discountNote || '');

      const caption =
\`\${greeting}

💳 Dana: \${paySettings.dana || '-'}
💳 BRI: \${paySettings.bri || '-'}
💳 gopay/shopeepay/ovo:      
      \${paySettings.ewallet || '-'}
👤 An (\${paySettings.accountName || '-'})

\${paySettings.footerNotes || ''}\`.trim();`;

for (const p of targetPaths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    if (targetPattern.test(content)) {
      content = content.replace(targetPattern, replacementCode);
      fs.writeFileSync(p, content, 'utf8');
      console.log(`[PATCH OK] ${p}`);
    } else {
      console.log(`[PATTERN NOT MATCHED] ${p}, checking if already patched...`);
      if (content.includes('botSettingsPath')) {
        console.log(`[ALREADY PATCHED] ${p}`);
      } else {
        console.warn(`[WARNING] Could not match target pattern in ${p}`);
      }
    }
  } else {
    console.log(`[NOT FOUND] ${p}`);
  }
}

// Also save patched chiww.js into bot-patch/
const botPanelChiww = targetPaths[0];
if (fs.existsSync(botPanelChiww)) {
  const patchDest = path.resolve(__dirname, '../bot-patch/chiww.js');
  fs.copyFileSync(botPanelChiww, patchDest);
  console.log(`[SAVED TO BOT-PATCH] ${patchDest}`);
}
