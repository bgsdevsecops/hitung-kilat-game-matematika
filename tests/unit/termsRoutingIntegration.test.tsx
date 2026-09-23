// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';

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

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

describe('Terms Routing Integration', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
  });

  afterEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('renders TermsOfServiceScreen directly when starting at /terms-of-service', async () => {
    window.history.pushState(null, '', '/terms-of-service');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Ketentuan Layanan/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('renders TermsOfServiceScreen directly when starting at /terms', async () => {
    window.history.pushState(null, '', '/terms');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Ketentuan Layanan/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('renders TermsOfServiceScreen directly when starting at /syarat-ketentuan', async () => {
    window.history.pushState(null, '', '/syarat-ketentuan');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Ketentuan Layanan/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('navigates back to game and updates URL to / when clicking back from TermsOfServiceScreen', async () => {
    window.history.pushState(null, '', '/terms-of-service');
    render(<App />);

    await waitFor(() => {
      const backButtons = screen.getAllByRole('button', { name: /Kembali ke Permainan/i });
      expect(backButtons.length).toBeGreaterThan(0);
      expect(backButtons[0]).toBeInTheDocument();
    });

    const backBtn = screen.getAllByRole('button', { name: /Kembali ke Permainan/i })[0];
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
      expect(screen.queryByRole('heading', { name: /Ketentuan Layanan/i, level: 1 })).toBeNull();
    });
  });

  it('navigates to /terms-of-service when clicking Ketentuan Layanan in the game footer', async () => {
    window.history.pushState(null, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ketentuan Layanan/i })).toBeInTheDocument();
    });

    const termsFooterBtn = screen.getByRole('button', { name: /Ketentuan Layanan/i });
    fireEvent.click(termsFooterBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/terms-of-service');
      expect(screen.getByRole('heading', { name: /Ketentuan Layanan/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('allows cross-navigation between Terms of Service and Privacy Policy screens', async () => {
    window.history.pushState(null, '', '/terms-of-service');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Ketentuan Layanan/i, level: 1 })).toBeInTheDocument();
    });

    // Navigate from Terms to Privacy
    const privacyBtn = screen.getAllByRole('button', { name: /Kebijakan Privasi/i })[0];
    fireEvent.click(privacyBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/privacy-policy');
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });

    // Navigate from Privacy to Terms
    const termsBtn = screen.getAllByRole('button', { name: /Ketentuan Layanan/i })[0];
    fireEvent.click(termsBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/terms-of-service');
      expect(screen.getByRole('heading', { name: /Ketentuan Layanan/i, level: 1 })).toBeInTheDocument();
    });
  });
});
