// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Extracted / mocked routing logic evaluator matching public/sw.js
export function determineRouteStrategy(
  urlStr: string,
  mode: string,
  method: string
): 'network-only' | 'navigate-fallback' | 'cache-first' | 'passthrough' {
  if (method !== 'GET') return 'passthrough';
  const url = new URL(urlStr, 'https://hitung-kilat.k8s.web.id');
  if (url.origin !== 'https://hitung-kilat.k8s.web.id') return 'passthrough';
  if (url.pathname === '/firebase-config.js' || url.pathname === '/actuator') {
    return 'network-only';
  }
  if (mode === 'navigate') {
    return 'navigate-fallback';
  }
  if (url.pathname.startsWith('/assets/')) {
    return 'cache-first';
  }
  return 'cache-first';
}

export const serviceWorkerRouteStrategy = determineRouteStrategy;

describe('Service Worker Routing Rules', () => {
  it('bypasses non-GET requests', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/api/test', 'cors', 'POST')).toBe('passthrough');
  });

  it('bypasses external domains (Google Auth, Firestore, etc.)', () => {
    expect(determineRouteStrategy('https://firestore.googleapis.com/v1/projects', 'cors', 'GET')).toBe('passthrough');
  });

  it('enforces network-only for /firebase-config.js and /actuator', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/firebase-config.js', 'no-cors', 'GET')).toBe('network-only');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/actuator', 'no-cors', 'GET')).toBe('network-only');
  });

  it('routes SPA navigations to navigate-fallback', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/terms-of-service', 'navigate', 'GET')).toBe('navigate-fallback');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/', 'navigate', 'GET')).toBe('navigate-fallback');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/privacy-policy', 'navigate', 'GET')).toBe('navigate-fallback');
  });

  it('routes static assets to cache-first', () => {
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/assets/main-12345.js', 'cors', 'GET')).toBe('cache-first');
    expect(determineRouteStrategy('https://hitung-kilat.k8s.web.id/favicon.svg', 'no-cors', 'GET')).toBe('cache-first');
  });

  it('verifies public/sw.js exists and contains expected offline strategies and bypass rules', () => {
    const swPath = path.resolve(__dirname, '../../public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("CACHE_NAME = 'hitung-kilat-v2-cache-v1'");
    expect(swContent).toContain('/firebase-config.js');
    expect(swContent).toContain('/actuator');
    expect(swContent).toContain('SKIP_WAITING');
    expect(swContent).toContain('self.clients.claim()');
  });
});
