// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineStatusBadge } from '../../src/components/common/OfflineStatusBadge';

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

describe('OfflineStatusBadge', () => {
  it('renders nothing when online', () => {
    const { container } = render(<OfflineStatusBadge isOnline={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders badge with offline icon and text when offline', () => {
    render(<OfflineStatusBadge isOnline={false} />);
    expect(screen.getByText(/Mode Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/Progres tersimpan lokal/i)).toBeInTheDocument();
  });

  it('includes accessibility attributes role="status" and aria-live="polite"', () => {
    render(<OfflineStatusBadge isOnline={false} />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('aria-live')).toBe('polite');
  });
});
