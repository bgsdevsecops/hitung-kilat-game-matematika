import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('docker-entrypoint script', () => {
  const scriptPath = path.resolve(__dirname, '../../docker-entrypoint.d/40-firebase-config.sh');
  const tempOutputDir = path.resolve(__dirname, '../../.tmp-test-entrypoint');
  const tempOutputFile = path.join(tempOutputDir, 'firebase-config.js');

  beforeEach(() => {
    fs.mkdirSync(tempOutputDir, { recursive: true });
    if (fs.existsSync(tempOutputFile)) {
      fs.unlinkSync(tempOutputFile);
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempOutputDir)) {
      fs.rmSync(tempOutputDir, { recursive: true, force: true });
    }
  });

  it('generates fallback dummy config when FIREBASE_CONFIG_JSON is unset', () => {
    execSync(`TARGET_CONFIG_FILE="${tempOutputFile}" sh "${scriptPath}"`, {
      env: { ...process.env, FIREBASE_CONFIG_JSON: '' },
    });

    expect(fs.existsSync(tempOutputFile)).toBe(true);
    const content = fs.readFileSync(tempOutputFile, 'utf8');
    expect(content).toContain('// Default local fallback');
  });

  it('injects window.__FIREBASE_CONFIG__ when FIREBASE_CONFIG_JSON is provided', () => {
    const mockJson = JSON.stringify({ projectId: 'k8s-prod-project', apiKey: 'SECRET123' });
    execSync(`TARGET_CONFIG_FILE="${tempOutputFile}" sh "${scriptPath}"`, {
      env: { ...process.env, FIREBASE_CONFIG_JSON: mockJson },
    });

    expect(fs.existsSync(tempOutputFile)).toBe(true);
    const content = fs.readFileSync(tempOutputFile, 'utf8');
    expect(content).toContain('window.__FIREBASE_CONFIG__ = {"projectId":"k8s-prod-project","apiKey":"SECRET123"};');
  });
});
