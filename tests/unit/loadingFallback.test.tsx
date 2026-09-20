// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ScreenLoadingFallback,
  ModalLoadingFallback,
} from '../../src/components/common/LoadingFallback';
import { ChunkErrorBoundary } from '../../src/components/common/ChunkErrorBoundary';

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

describe('LoadingFallback and ChunkErrorBoundary (Task 1)', () => {
  it('renders ScreenLoadingFallback with accessible text and spinner', () => {
    render(<ScreenLoadingFallback />);
    expect(screen.getByTestId('screen-loading-fallback')).toBeInTheDocument();
    expect(screen.getByText(/Menyiapkan Arena/i)).toBeInTheDocument();
  });

  it('renders ModalLoadingFallback with backdrop and spinner', () => {
    render(<ModalLoadingFallback />);
    expect(screen.getByTestId('modal-loading-fallback')).toBeInTheDocument();
  });

  it('catches chunk load errors in ChunkErrorBoundary and displays retry UI', () => {
    const ProblemChild = () => {
      const err = new Error('Failed to fetch dynamically imported module: /assets/PlayScreen-xyz.js');
      err.name = 'ChunkLoadError';
      throw err;
    };

    // Suppress React error boundary console log for test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChunkErrorBoundary>
        <ProblemChild />
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('chunk-error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Gagal Memuat Komponen/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Muat Ulang Halaman/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided to ChunkErrorBoundary on error', () => {
    const ProblemChild = () => {
      throw new Error('Chunk load failed');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChunkErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
        <ProblemChild />
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom Error')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('renders children normally when no error occurs in ChunkErrorBoundary', () => {
    render(
      <ChunkErrorBoundary>
        <div data-testid="normal-child">Normal Child Content</div>
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('normal-child')).toBeInTheDocument();
    expect(screen.getByText('Normal Child Content')).toBeInTheDocument();
  });

  it('triggers window.location.reload when reload button is clicked', () => {
    const ProblemChild = () => {
      throw new Error('Chunk failure');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const reloadMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    render(
      <ChunkErrorBoundary>
        <ProblemChild />
      </ChunkErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /Muat Ulang Halaman/i });
    fireEvent.click(reloadButton);

    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    consoleSpy.mockRestore();
  });

  it('renders modal backdrop overlay when variant="modal" on error', () => {
    const ProblemChild = () => {
      throw new Error('Modal chunk failure');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChunkErrorBoundary variant="modal">
        <ProblemChild />
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('chunk-error-modal-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('chunk-error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Gagal Memuat Komponen/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
