const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const botPanelDir = path.resolve('D:/BOT WHSATAPP SUPABASE/BOT CANDRA/BOT PANEL');
const baseZip = path.join(botPanelDir, 'CAKSTORE_CANDRA_V8_ALWAYS_ON_FULL_NO_ENV_NO_SESSION (3).zip');
const outputDir = path.resolve('D:/BOT WHSATAPP SUPABASE/BOT CANDRA/PANEL BUATAN ANTIGRAVITI');
const stagingDir = path.join(outputDir, '_staging');
const finalZipName = 'CAKSTORE_BOT_PANEL_FULL_ANTIGRAVITY.zip';
const finalZipPath = path.join(outputDir, finalZipName);
const finalTarGzName = 'CAKSTORE_BOT_PANEL_FULL_ANTIGRAVITY.tar.gz';
const finalTarGzPath = path.join(outputDir, finalTarGzName);

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
      if (file.startsWith('.env')) continue;
      if (file.toLowerCase().includes('session')) continue;
      if (file.toLowerCase().includes('auth_info')) continue;
      if (file.endsWith('.zip')) continue;
      if (file.endsWith('.tar.gz')) continue;
      if (file === 'node_modules') continue;

      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    const basename = path.basename(src);
    if (basename.startsWith('.env')) return;
    if (basename.toLowerCase().includes('session')) return;
    if (basename.toLowerCase().includes('auth_info')) return;
    if (basename.endsWith('.zip')) return;
    if (basename.endsWith('.tar.gz')) return;

    fs.copyFileSync(src, dest);
  }
}

for (const item of fs.readdirSync(botPanelDir)) {
  if (item.startsWith('.env')) continue;
  if (item.toLowerCase().includes('session')) continue;
  if (item.toLowerCase().includes('auth_info')) continue;
  if (item.endsWith('.zip')) continue;
  if (item.endsWith('.tar.gz')) continue;
  if (item === 'node_modules') continue;

  copyRecursive(path.join(botPanelDir, item), path.join(stagingDir, item));
}

// Ensure latest patched files
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

// Clean any forbidden files
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
      if (f.startsWith('.env') || f.endsWith('.zip') || f.endsWith('.tar.gz') || f.toLowerCase().includes('session') || f.toLowerCase().includes('auth_info')) {
        console.log('Removing forbidden file:', full);
        fs.rmSync(full, { force: true });
      }
    }
  }
}
cleanForbidden(stagingDir);

console.log('4. Creating clean POSIX ZIP archive using bsdtar (Linux/Pterodactyl compatible)...');
if (fs.existsSync(finalZipPath)) fs.rmSync(finalZipPath, { force: true });
if (fs.existsSync(finalTarGzPath)) fs.rmSync(finalTarGzPath, { force: true });

// Get top level items
const topLevelItems = fs.readdirSync(stagingDir);
const itemsArgs = topLevelItems.map(i => `"${i}"`).join(' ');

// Create standard ZIP with POSIX forward-slashes
execSync(`tar.exe -a -cf "${finalZipPath}" -C "${stagingDir}" ${itemsArgs}`, { stdio: 'inherit' });
// Also create standard tar.gz
execSync(`tar.exe -czf "${finalTarGzPath}" -C "${stagingDir}" ${itemsArgs}`, { stdio: 'inherit' });

console.log('5. Verifying final zip file entries...');
const zipListing = execSync(`tar.exe -tf "${finalZipPath}"`, { encoding: 'utf8' });
console.log('Zip listing preview (first 10 lines):');
console.log(zipListing.split('\n').slice(0, 10).join('\n'));

// Check for forbidden characters
if (zipListing.includes('\\') || zipListing.includes('./')) {
  console.warn('WARNING: Listing still contains backslashes or dot-slash!');
} else {
  console.log('SUCCESS: All paths in zip use clean POSIX format without backslashes or ./ prefix!');
}

// Clean staging folder
fs.rmSync(stagingDir, { recursive: true, force: true });
console.log('Finished successfully.');
