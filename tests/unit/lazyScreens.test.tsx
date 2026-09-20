// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import * as firebaseLib from '../../src/lib/firebase';
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

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock recharts ResponsiveContainer to prevent JSDOM layout sizing issues
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

// Mock firebase
vi.mock('../../src/lib/firebase', async () => {
  const actual = await vi.importActual<any>('../../src/lib/firebase');
  return {
    ...actual,
    auth: { currentUser: null },
    onAuthStateChanged: vi.fn((_auth: any, cb: any) => {
      return vi.fn();
    }),
    loginWithGoogle: vi.fn(),
    loginAsGuest: vi.fn(),
    logoutUser: vi.fn(),
    saveGameDataToCloud: vi.fn().mockResolvedValue(undefined),
    loadGameDataFromCloud: vi.fn().mockResolvedValue(null),
    mergeGameProgress: vi.fn(actual.mergeGameProgress),
  };
});

describe('Lazy Screen & Modal Loading Integration (Task 5)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hitung_kilat_migration_ack_v2', 'true');
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playFanfare').mockImplementation(() => {});
  });

  it('renders LevelMap immediately on initial load without showing screen fallback', () => {
    render(<App />);
    expect(screen.getByText(/Peta Kampanye|Peta Petualangan/i)).toBeInTheDocument();
    expect(screen.queryByTestId('screen-loading-fallback')).toBeNull();
  });

  it('dynamically loads and renders PlayScreen when a level is clicked', async () => {
    render(<App />);
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();

    fireEvent.click(level1Card!);

    // PlayScreen should load and mount
    await waitFor(() => {
      expect(
        screen.getByText(/T1-ADD-01|Level 1/i)
      ).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('dynamically loads and renders StatsModal when header stars badge is clicked', async () => {
    render(<App />);
    const starsBadge = screen.getByTitle(/Total Bintang Diraih/i);
    fireEvent.click(starsBadge);

    await waitFor(() => {
      expect(screen.getByText(/Statistik & Pencapaian|Statistik Pemain/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('dynamically loads and renders HelpModal when help button is clicked', async () => {
    render(<App />);
    const helpBtn = screen.getByTitle(/Panduan.*(Trik|Tips)|Panduan & Trik Cepat/i);
    fireEvent.click(helpBtn);

    await waitFor(() => {
      expect(screen.getByText(/Panduan & (Tips|Trik) Hitung Kilat/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('dynamically loads and renders CompetitiveModeSelectModal when mode button is clicked', async () => {
    render(<App />);
    const compBtn = screen.getByRole('button', { name: /Mode Kompetitif|Kompetitif/i });
    fireEvent.click(compBtn);

    await waitFor(() => {
      expect(screen.getByText(/(Pilih )?Mode Kompetitif/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});
