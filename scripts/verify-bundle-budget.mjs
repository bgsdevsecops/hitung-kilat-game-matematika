import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_GZIP_BYTES = 350 * 1024; // 350 KiB
const assetsDir = path.resolve(__dirname, '../dist/assets');
const indexHtmlPath = path.resolve(__dirname, '../dist/index.html');

if (!fs.existsSync(assetsDir)) {
  console.error('❌ dist/assets directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);

// Locate the entry index-[hash].js file from dist/index.html
let entryFile = null;
if (fs.existsSync(indexHtmlPath)) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Verify vendor-charts is NOT leaked into initial page HTML (modulepreload or script)
  if (html.includes('vendor-charts')) {
    console.error('❌ VIOLATION: vendor-charts is leaked into dist/index.html preload/script list!');
    process.exit(1);
  }

  const match = html.match(/src="[^"]*\/assets\/(index-[^"]+\.js)"/);
  if (match && files.includes(match[1])) {
    entryFile = match[1];
  }
}
if (!entryFile) {
  // Disambiguate entry: ensure we don't accidentally pick up a non-entry chunk like taxonomy
  const candidates = files.filter((f) => f.startsWith('index-') && f.endsWith('.js'));
  // If multiple candidates exist, pick the largest which is the app entry
  if (candidates.length > 0) {
    candidates.sort((a, b) => fs.statSync(path.join(assetsDir, b)).size - fs.statSync(path.join(assetsDir, a)).size);
    entryFile = candidates[0];
  }
}

if (!entryFile) {
  console.error('❌ Could not find entry index-[hash].js file in dist/assets.');
  process.exit(1);
}

const entryPath = path.join(assetsDir, entryFile);
const rawBuffer = fs.readFileSync(entryPath);
const gzipBuffer = zlib.gzipSync(rawBuffer);

const rawKiB = (rawBuffer.length / 1024).toFixed(2);
const gzipKiB = (gzipBuffer.length / 1024).toFixed(2);

console.log('--------------------------------------------------');
console.log('📦 Hitung Kilat V2 — Bundle Budget Report (PRD §24)');
console.log('--------------------------------------------------');
console.log(`Entry Asset:     ${entryFile}`);
console.log(`Uncompressed:    ${rawKiB} KiB`);
console.log(`Gzip Compressed: ${gzipKiB} KiB`);
console.log(`Budget Limit:    350.00 KiB gzip`);
console.log('--------------------------------------------------');

// Inspect vendor chunks
const vendorChunks = files.filter((f) => f.startsWith('vendor-') && f.endsWith('.js'));
console.log(`Vendor Chunks (${vendorChunks.length} chunks isolated):`);
for (const chunk of vendorChunks) {
  const cPath = path.join(assetsDir, chunk);
  const cBuf = fs.readFileSync(cPath);
  const cGzip = zlib.gzipSync(cBuf);
  console.log(`  • ${chunk.padEnd(30)}: ${(cBuf.length / 1024).toFixed(2)} KiB (${(cGzip.length / 1024).toFixed(2)} KiB gzip)`);
}
console.log('--------------------------------------------------');

if (gzipBuffer.length > MAX_GZIP_BYTES) {
  console.error(`❌ VIOLATION: Entry bundle gzip size (${gzipKiB} KiB) exceeds 350 KiB budget!`);
  process.exit(1);
}

console.log('✅ SUCCESS: Entry bundle is within the PRD §24 budget (<= 350 KiB gzip)!');
process.exit(0);
