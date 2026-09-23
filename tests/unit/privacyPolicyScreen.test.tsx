// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyPolicyScreen } from '../../src/components/privacy/PrivacyPolicyScreen';
import { soundManager } from '../../src/utils/sound';

declare module 'vitest' {
  interface Assertion<R = void, T = unknown> {
    toBeInTheDocument(): R;
  }
}

expect.extend({
  toBeInTheDocument(received: HTMLElement | null) {
    const pass = Boolean(
      received !== null &&
      received !== undefined &&
      received.ownerDocument?.body.contains(received)
    );
    return {
      pass,
      message: () => `expected element ${pass ? 'not ' : ''}to be in document`,
    };
  },
});

describe('PrivacyPolicyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  it('renders official developer contact webmaster@k8s.web.id', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    const contactLinks = screen.getAllByRole('link', { name: /webmaster@k8s\.web\.id/i });
    expect(contactLinks.length).toBeGreaterThan(0);
    expect(contactLinks[0].getAttribute('href')).toBe('mailto:webmaster@k8s.web.id');
  });

  it('renders Google OAuth2 Limited Use disclosure', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    expect(screen.getByText(/Google API Services User Data Policy/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Limited Use/i).length).toBeGreaterThan(0);
  });

  it('renders COPPA and child protection safeguards', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    expect(screen.getByText(/Perlindungan Anak & Privasi Usia \(COPPA \/ GDPR-K\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Guest Mode/i)).toBeInTheDocument();
  });

  it('renders user rights and self-service data management disclosures', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    expect(screen.getByText(/Hak Pengguna & Penghapusan Data/i)).toBeInTheDocument();
    expect(screen.getByText(/Ekspor Data Mandiri/i)).toBeInTheDocument();
    expect(screen.getByText(/Penghapusan Akun/i)).toBeInTheDocument();
  });

  it('renders data storage and security disclosures', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    expect(screen.getByText(/Keamanan & Lokasi Penyimpanan Data/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Firestore/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/AES-256/i)).toBeInTheDocument();
  });

  it('renders application title, domain, and updated date metadata', () => {
    render(<PrivacyPolicyScreen onBack={vi.fn()} />);
    expect(screen.getByText(/Kebijakan Privasi & Perlindungan Data/i)).toBeInTheDocument();
    expect(screen.getAllByText(/https:\/\/hitung-kilat\.k8s\.web\.id/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/23 September 2026/i)).toBeInTheDocument();
  });

  it('invokes onBack callback when clicking back to game button', () => {
    const onBackMock = vi.fn();
    render(<PrivacyPolicyScreen onBack={onBackMock} />);
    const backBtns = screen.getAllByRole('button', { name: /Kembali ke Permainan/i });
    expect(backBtns.length).toBeGreaterThan(0);
    fireEvent.click(backBtns[0]);
    expect(onBackMock).toHaveBeenCalledTimes(1);
    expect(soundManager.playClick).toHaveBeenCalled();

    // Test the second back button (bottom action bar)
    if (backBtns.length > 1) {
      fireEvent.click(backBtns[1]);
      expect(onBackMock).toHaveBeenCalledTimes(2);
    }
  });
});
