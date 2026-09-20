import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';

const MAX_ENTRY_GZIP_BYTES = 350 * 1024; // 350 KiB = 358,400 bytes per PRD §24

describe('PRD §24 Bundle Budget Verification (Task 4)', () => {
  const assetsDir = path.resolve(__dirname, '../../dist/assets');
  const indexHtmlPath = path.resolve(__dirname, '../../dist/index.html');

  beforeAll(() => {
    // Ensure build artifacts exist before testing so fresh checkouts do not fail
    if (!fs.existsSync(assetsDir) || !fs.existsSync(indexHtmlPath)) {
      execFileSync('npm', ['run', 'build'], {
        cwd: path.resolve(__dirname, '../..'),
        stdio: 'ignore',
      });
    }
  });

  it('verifies dist/assets contains index entry JS bundle <= 350 KiB gzip', () => {
    expect(fs.existsSync(assetsDir), 'dist/assets must exist').toBe(true);

    const files = fs.readdirSync(assetsDir);
    let entryFile: string | undefined;
    if (fs.existsSync(indexHtmlPath)) {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      const match = html.match(/src="[^"]*\/assets\/(index-[^"]+\.js)"/);
      if (match && files.includes(match[1])) {
        entryFile = match[1];
      }
    }
    if (!entryFile) {
      const candidates = files.filter((f) => f.startsWith('index-') && f.endsWith('.js'));
      if (candidates.length > 0) {
        candidates.sort((a, b) => fs.statSync(path.join(assetsDir, b)).size - fs.statSync(path.join(assetsDir, a)).size);
        entryFile = candidates[0];
      }
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
    expect(fs.existsSync(assetsDir)).toBe(true);
    const files = fs.readdirSync(assetsDir);
    const chartsChunk = files.find((f) => f.startsWith('vendor-charts-') && f.endsWith('.js'));
    expect(chartsChunk, 'vendor-charts-[hash].js must exist as an isolated chunk').toBeDefined();
  });

  it('verifies vendor-charts is not preloaded or referenced in initial dist/index.html', () => {
    expect(fs.existsSync(indexHtmlPath)).toBe(true);
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(html).not.toContain('vendor-charts');
  });
});
