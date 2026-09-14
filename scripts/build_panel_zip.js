const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const botPanelDir = path.resolve('D:/BOT WHSATAPP SUPABASE/BOT CANDRA/BOT PANEL');
const baseZip = path.join(botPanelDir, 'CAKSTORE_CANDRA_V8_ALWAYS_ON_FULL_NO_ENV_NO_SESSION (3).zip');
const outputDir = path.resolve('D:/BOT WHSATAPP SUPABASE/BOT CANDRA/PANEL BUATAN ANTIGRAVITI');
const stagingDir = path.join(outputDir, '_staging');
const finalZipName = 'CAKSTORE_BOT_PANEL_FULL_ANTIGRAVITY.zip';
const finalZipPath = path.join(outputDir, finalZipName);

console.log('1. Preparing staging directory...');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

console.log('2. Extracting base files from base zip...');
if (fs.existsSync(baseZip)) {
  execSync(`tar -xf "${baseZip}" -C "${stagingDir}"`, { stdio: 'inherit' });
} else {
  console.warn('Base zip not found at', baseZip);
}

console.log('3. Overwriting with latest updated files from BOT PANEL...');
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      // Exclude session, env, zip, node_modules
      if (file.startsWith('.env')) continue;
      if (file.toLowerCase().includes('session')) continue;
      if (file.toLowerCase().includes('auth_info')) continue;
      if (file.endsWith('.zip')) continue;
      if (file === 'node_modules') continue;

      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    // Exclude env, zip
    const basename = path.basename(src);
    if (basename.startsWith('.env')) return;
    if (basename.toLowerCase().includes('session')) return;
    if (basename.toLowerCase().includes('auth_info')) return;
    if (basename.endsWith('.zip')) return;

    fs.copyFileSync(src, dest);
  }
}

// Copy active bot panel files
for (const item of fs.readdirSync(botPanelDir)) {
  if (item.startsWith('.env')) continue;
  if (item.toLowerCase().includes('session')) continue;
  if (item.toLowerCase().includes('auth_info')) continue;
  if (item.endsWith('.zip')) continue;
  if (item === 'node_modules') continue;

  copyRecursive(path.join(botPanelDir, item), path.join(stagingDir, item));
}

// Explicitly ensure the latest chiww.js and transactionStatusSync.js from bot-patch are in staging
const patchedChiww = path.resolve(__dirname, '../bot-patch/chiww.js');
if (fs.existsSync(patchedChiww)) {
  fs.copyFileSync(patchedChiww, path.join(stagingDir, 'chiww.js'));
  console.log('Verified: Patched chiww.js copied to staging');
}

const patchedStatusSync = path.resolve(__dirname, '../bot-patch/lib/transactionStatusSync.js');
if (fs.existsSync(patchedStatusSync)) {
  const libDir = path.join(stagingDir, 'lib');
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
  fs.copyFileSync(patchedStatusSync, path.join(libDir, 'transactionStatusSync.js'));
  console.log('Verified: Patched transactionStatusSync.js copied to staging');
}

// Explicitly ensure database/bot_settings.json and database/img/payment/payment.jpg
const dbSettings = path.resolve(__dirname, '../data/bot_settings.json');
if (fs.existsSync(dbSettings)) {
  const stagingDb = path.join(stagingDir, 'database');
  if (!fs.existsSync(stagingDb)) fs.mkdirSync(stagingDb, { recursive: true });
  fs.copyFileSync(dbSettings, path.join(stagingDb, 'bot_settings.json'));
  console.log('Verified: bot_settings.json copied to staging');
}

const qrisImg = path.resolve(__dirname, '../public/uploads/qris/payment.jpg');
if (fs.existsSync(qrisImg)) {
  const qrisDir = path.join(stagingDir, 'database', 'img', 'payment');
  if (!fs.existsSync(qrisDir)) fs.mkdirSync(qrisDir, { recursive: true });
  fs.copyFileSync(qrisImg, path.join(qrisDir, 'payment.jpg'));
  console.log('Verified: payment.jpg copied to staging');
}

// Remove any residual .env, session, zip in staging
function cleanForbidden(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f.toLowerCase().includes('session') || f.toLowerCase().includes('auth_info')) {
        console.log('Removing forbidden dir:', full);
        fs.rmSync(full, { recursive: true, force: true });
      } else {
        cleanForbidden(full);
      }
    } else {
      if (f.startsWith('.env') || f.endsWith('.zip') || f.toLowerCase().includes('session') || f.toLowerCase().includes('auth_info')) {
        console.log('Removing forbidden file:', full);
        fs.rmSync(full, { force: true });
      }
    }
  }
}
cleanForbidden(stagingDir);

console.log('4. Creating ZIP archive in target folder...');
if (fs.existsSync(finalZipPath)) {
  fs.rmSync(finalZipPath, { force: true });
}

// Compress staging directory contents to finalZipPath
execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${finalZipPath}' -Force"`, { stdio: 'inherit' });

console.log('5. Verifying final zip file...');
if (fs.existsSync(finalZipPath)) {
  const zipStat = fs.statSync(finalZipPath);
  console.log(`SUCCESS: Zip created at ${finalZipPath} (${(zipStat.size / 1024).toFixed(1)} KB)`);
} else {
  throw new Error('Failed to create zip file');
}

// Clean staging folder
fs.rmSync(stagingDir, { recursive: true, force: true });
console.log('Staging cleanup complete.');
