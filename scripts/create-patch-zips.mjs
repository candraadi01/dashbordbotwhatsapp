import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const patchFolder = path.resolve('bot-patch');
const botV7Folder = 'C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\f4b912fa-b18d-4ce0-8c82-03bb98160f8e\\scratch\\bot_v7';

const patchZipWorkspace = path.resolve('PATCH_BOT_FIX_STATUS_OWNER.zip');
const patchZipDownloads = 'C:\\Users\\LENOVO\\Downloads\\PATCH_BOT_FIX_STATUS_OWNER.zip';

const fullZipWorkspace = path.resolve('CAKSTORE_BOT_V7.1_FIX_STATUS_OWNER_FULL.zip');
const fullZipDownloads = 'C:\\Users\\LENOVO\\Downloads\\CAKSTORE_BOT_V7.1_FIX_STATUS_OWNER_FULL.zip';

// Clean old files
[patchZipWorkspace, patchZipDownloads, fullZipWorkspace, fullZipDownloads].forEach(f => {
  if (fs.existsSync(f)) fs.unlinkSync(f);
});

// Compress patch folder
execSync(`powershell -Command "Compress-Archive -Path '${patchFolder}\\*' -DestinationPath '${patchZipWorkspace}' -Force"`);
fs.copyFileSync(patchZipWorkspace, patchZipDownloads);

// Compress full bot folder
execSync(`powershell -Command "Compress-Archive -Path '${botV7Folder}\\*' -DestinationPath '${fullZipWorkspace}' -Force"`);
fs.copyFileSync(fullZipWorkspace, fullZipDownloads);

console.log('Successfully created:');
console.log('1. ', patchZipWorkspace, fs.statSync(patchZipWorkspace).size);
console.log('2. ', patchZipDownloads, fs.statSync(patchZipDownloads).size);
console.log('3. ', fullZipWorkspace, fs.statSync(fullZipWorkspace).size);
console.log('4. ', fullZipDownloads, fs.statSync(fullZipDownloads).size);
