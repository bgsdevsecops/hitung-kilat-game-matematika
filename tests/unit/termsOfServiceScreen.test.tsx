// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TermsOfServiceScreen } from '../../src/components/privacy/TermsOfServiceScreen';
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

describe('TermsOfServiceScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
  });

  it('renders official developer contact webmaster@k8s.web.id and official domain', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    const contactLinks = screen.getAllByRole('link', { name: /webmaster@k8s\.web\.id/i });
    expect(contactLinks.length).toBeGreaterThan(0);
    expect(contactLinks[0].getAttribute('href')).toBe('mailto:webmaster@k8s.web.id');
    expect(screen.getAllByText(/https:\/\/hitung-kilat\.k8s\.web\.id/i).length).toBeGreaterThan(0);
  });

  it('renders official developer identity and copyright as Hitung Kilat Team and excludes BGS references', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getAllByText(/Hitung Kilat Team/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/BGS DevSecOps/i)).toBeNull();
    expect(screen.queryByText(/Sahir Web ID/i)).toBeNull();
  });

  it('renders Acceptance of Terms section', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /2\. Penerimaan Ketentuan/i })).toBeInTheDocument();
  });

  it('renders Free Educational Service and No Ads statement', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /3\. Sifat Layanan Edukatif/i })).toBeInTheDocument();
    expect(screen.getByText(/Bebas Iklan Komersial/i)).toBeInTheDocument();
    expect(screen.getByText(/Gratis Penuh/i)).toBeInTheDocument();
  });

  it('renders Google OAuth2 and Guest Mode disclosures', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /4\. Akun Pengguna/i })).toBeInTheDocument();
    expect(screen.getByText(/Mode Tamu \(Guest Mode\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Akun Google \(Google OAuth2\)/i)).toBeInTheDocument();
  });

  it('renders COPPA & Child Safety provisions', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /5\. Kebijakan Pengguna di Bawah Umur/i })).toBeInTheDocument();
    expect(screen.getByText(/Safe Local Mode/i)).toBeInTheDocument();
  });

  it('renders Fair Play & Anti-Cheat rules', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /6\. Integritas Permainan/i })).toBeInTheDocument();
    expect(screen.getByText(/Kecurangan Teknis/i)).toBeInTheDocument();
    expect(screen.getByText(/Pseudonym yang Melanggar/i)).toBeInTheDocument();
  });

  it('renders User Rights and Account Deletion section', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /7\. Hak Pengguna/i })).toBeInTheDocument();
    expect(screen.getByText(/Ekspor Data \(Portabilitas\)/i)).toBeInTheDocument();
  });

  it('renders Disclaimer and Limitation of Liability', () => {
    render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /8\. Batasan Tanggung Jawab/i })).toBeInTheDocument();
  });

  it('calls onBack and plays click sound when clicking back button', () => {
    const handleBack = vi.fn();
    render(<TermsOfServiceScreen onBack={handleBack} />);

    const backButton = screen.getAllByRole('button', { name: /Kembali ke Permainan/i })[0];
    fireEvent.click(backButton);

    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigateToPrivacy when clicking privacy policy link', () => {
    const handleNavigateToPrivacy = vi.fn();
    render(<TermsOfServiceScreen onBack={vi.fn()} onNavigateToPrivacy={handleNavigateToPrivacy} />);

    const privacyButtons = screen.getAllByRole('button', { name: /Kebijakan Privasi/i });
    expect(privacyButtons.length).toBeGreaterThan(0);
    fireEvent.click(privacyButtons[0]);

    expect(soundManager.playClick).toHaveBeenCalled();
    expect(handleNavigateToPrivacy).toHaveBeenCalledTimes(1);
  });

  it('sets and restores document title correctly', () => {
    document.title = 'Original Title';
    const { unmount } = render(<TermsOfServiceScreen onBack={vi.fn()} />);
    expect(document.title).toBe('Ketentuan Layanan - Hitung Kilat');
    unmount();
    expect(document.title).toBe('Original Title');
  });
});
