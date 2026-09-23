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

describe('Privacy Routing Integration', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
  });

  afterEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('renders PrivacyPolicyScreen directly when starting at /privacy-policy', async () => {
    window.history.pushState(null, '', '/privacy-policy');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('navigates back to game and updates URL to / when clicking back from PrivacyPolicyScreen', async () => {
    window.history.pushState(null, '', '/privacy-policy');
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
    });
  });

  it('navigates to /privacy-policy when clicking footer link', async () => {
    render(<App />);

    const footerLink = await screen.findByRole('button', { name: /Kebijakan Privasi/i });
    fireEvent.click(footerLink);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/privacy-policy');
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('renders PrivacyPolicyScreen directly when starting at /privacy alias', async () => {
    window.history.pushState(null, '', '/privacy');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });
  });

  it('handles popstate browser back and forward navigation', async () => {
    window.history.pushState(null, '', '/');
    render(<App />);

    // Click footer link to go to /privacy-policy
    const footerLink = await screen.findByRole('button', { name: /Kebijakan Privasi/i });
    fireEvent.click(footerLink);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/privacy-policy');
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });

    // Simulate browser Back button: pushState to / and fire popstate
    window.history.pushState(null, '', '/');
    fireEvent(window, new PopStateEvent('popstate'));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
      expect(screen.queryByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).not.toBeInTheDocument();
    });
  });

  it('navigates to /privacy-policy from SettingsModal', async () => {
    render(<App />);

    const settingsTrigger = document.getElementById('settings-modal-trigger');
    expect(settingsTrigger).toBeDefined();
    fireEvent.click(settingsTrigger!);

    const privacyBtn = await screen.findByRole(
      'button',
      { name: /Baca Kebijakan Privasi/i },
      { timeout: 4000 }
    );
    fireEvent.click(privacyBtn);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/privacy-policy');
      expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i, level: 1 })).toBeInTheDocument();
    });
  });
});
