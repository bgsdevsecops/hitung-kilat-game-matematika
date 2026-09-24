// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import App from '../../src/App';
import * as swModule from '../../src/utils/serviceWorkerRegistration';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

let capturedSwConfig: swModule.ServiceWorkerRegistrationConfig | undefined;

vi.mock('../../src/utils/serviceWorkerRegistration', () => ({
  registerServiceWorker: vi.fn((config?: swModule.ServiceWorkerRegistrationConfig) => {
    capturedSwConfig = config;
  }),
  applyServiceWorkerUpdate: vi.fn(),
  unregisterServiceWorker: vi.fn(),
}));

describe('App PWA Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    capturedSwConfig = undefined;
  });

  it('renders without error and displays offline badge when network drops', () => {
    render(<App />);

    // Initially online: no offline badge
    expect(screen.queryByText(/Mode Offline/i)).toBeNull();

    // Network drops: trigger offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const offlineBadges = screen.getAllByText(/Mode Offline/i);
    expect(offlineBadges.length).toBeGreaterThan(0);

    // Network recovers: trigger online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByText(/Mode Offline/i)).toBeNull();
  });

  it('registers service worker on mount and displays update toast when update found', () => {
    render(<App />);

    expect(swModule.registerServiceWorker).toHaveBeenCalledTimes(1);
    expect(capturedSwConfig?.onUpdate).toBeDefined();

    // No update toast initially
    expect(screen.queryByText(/Versi Baru Tersedia!/i)).toBeNull();

    // Simulate service worker update found
    const mockWaitingRegistration = {
      waiting: {
        postMessage: vi.fn(),
      },
    } as unknown as ServiceWorkerRegistration;

    act(() => {
      capturedSwConfig?.onUpdate?.(mockWaitingRegistration);
    });

    expect(screen.getByText(/Versi Baru Tersedia!/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Perbarui Sekarang/i })).toBeDefined();

    // Click "Perbarui Sekarang"
    const updateBtn = screen.getByRole('button', { name: /Perbarui Sekarang/i });
    fireEvent.click(updateBtn);

    expect(swModule.applyServiceWorkerUpdate).toHaveBeenCalledWith(mockWaitingRegistration);
  });

  it('allows dismissing the update notification toast', () => {
    render(<App />);

    const mockWaitingRegistration = {
      waiting: {
        postMessage: vi.fn(),
      },
    } as unknown as ServiceWorkerRegistration;

    act(() => {
      capturedSwConfig?.onUpdate?.(mockWaitingRegistration);
    });

    expect(screen.getByText(/Versi Baru Tersedia!/i)).toBeDefined();

    // Click "Nanti" to dismiss
    const dismissBtn = screen.getByRole('button', { name: /Nanti/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/Versi Baru Tersedia!/i)).toBeNull();
  });
});
