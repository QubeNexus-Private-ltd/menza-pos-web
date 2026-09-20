import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const monorepoSrcDir = path.resolve(__dirname, '../../src');
const localSharedDir = path.resolve(__dirname, '../shared');

function copyFolderSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      // Only copy if changed or destination missing
      let shouldCopy = true;
      if (fs.existsSync(destPath)) {
        const srcStat = fs.statSync(srcPath);
        const destStat = fs.statSync(destPath);
        if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) {
          shouldCopy = false;
        }
      }
      if (shouldCopy) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

const monorepoPaymentsDir = path.resolve(__dirname, '../../payments');
const localPaymentsDir = path.resolve(__dirname, '../payments');

if (fs.existsSync(monorepoSrcDir)) {
  console.log('[sync-shared] Syncing core business logic from ../src to ./shared...');
  copyFolderSync(monorepoSrcDir, localSharedDir);
  if (fs.existsSync(monorepoPaymentsDir)) {
    copyFolderSync(monorepoPaymentsDir, localPaymentsDir);
  }
  console.log('[sync-shared] Sync completed successfully.');
} else {
  console.log('[sync-shared] Standalone environment detected (e.g. Vercel deployment), using bundled ./shared and ./payments.');
}
