import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const MAX_ENTRY_GZIP_BYTES = 350 * 1024; // 350 KiB = 358,400 bytes per PRD §24

describe('PRD §24 Bundle Budget Verification (Task 4)', () => {
  it('verifies dist/assets contains index entry JS bundle <= 350 KiB gzip', () => {
    const assetsDir = path.resolve(__dirname, '../../dist/assets');
    expect(fs.existsSync(assetsDir), 'dist/assets must exist (run npm run build first)').toBe(true);

    const files = fs.readdirSync(assetsDir);
    const indexHtmlPath = path.resolve(__dirname, '../../dist/index.html');
    let entryFile: string | undefined;
    if (fs.existsSync(indexHtmlPath)) {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      const match = html.match(/src="[^"]*\/assets\/(index-[^"]+\.js)"/);
      if (match && files.includes(match[1])) {
        entryFile = match[1];
      }
    }
    if (!entryFile) {
      entryFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
    }

    expect(entryFile, 'Entry index-[hash].js must exist in dist/assets').toBeDefined();

    const entryPath = path.join(assetsDir, entryFile!);
    const rawBuffer = fs.readFileSync(entryPath);
    const gzipBuffer = zlib.gzipSync(rawBuffer);

    const rawKiB = (rawBuffer.length / 1024).toFixed(2);
    const gzipKiB = (gzipBuffer.length / 1024).toFixed(2);

    console.log(`Entry bundle: ${entryFile} -> ${rawKiB} KiB uncompressed, ${gzipKiB} KiB gzip`);

    expect(
      gzipBuffer.length,
      `Entry bundle ${entryFile} gzip size (${gzipKiB} KiB) exceeds PRD §24 budget of 350 KiB`
    ).toBeLessThanOrEqual(MAX_ENTRY_GZIP_BYTES);
  });

  it('verifies vendor-charts is isolated into its own chunk', () => {
    const assetsDir = path.resolve(__dirname, '../../dist/assets');
    const files = fs.readdirSync(assetsDir);
    const chartsChunk = files.find((f) => f.startsWith('vendor-charts-') && f.endsWith('.js'));
    expect(chartsChunk, 'vendor-charts-[hash].js must exist as an isolated chunk').toBeDefined();
  });
});
