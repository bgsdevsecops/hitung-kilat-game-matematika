// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { V2WelcomeModal } from '../../src/components/V2WelcomeModal';
import { soundManager } from '../../src/utils/sound';

describe('V2WelcomeModal (PRD §11 & Spec §7)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders migration summary when isOpen is true', () => {
    const handleClose = vi.fn();
    const playClickSpy = vi.spyOn(soundManager, 'playClick');

    render(
      <V2WelcomeModal
        isOpen={true}
        transferredStars={24}
        legacyStarCredits={6}
        unlockedLevelsCount={14}
        onClose={handleClose}
      />
    );

    expect(screen.getByText(/Selamat Datang di Hitung Kilat V2!/i)).toBeDefined();
    expect(screen.getByText(/24 Bintang/i)).toBeDefined();
    expect(screen.getByText(/6 Kredit/i)).toBeDefined();
    expect(screen.getByText(/14 Level/i)).toBeDefined();

    const ctaButton = screen.getByRole('button', { name: /mulai petualangan 72 level/i });
    expect(ctaButton).toBeDefined();
    expect(ctaButton.className).toContain('min-h-[48px]');

    fireEvent.click(ctaButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(playClickSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('hitung_kilat_migration_ack_v2')).toBe('true');
  });

  it('has accessible dialog attributes', () => {
    render(
      <V2WelcomeModal
        isOpen={true}
        transferredStars={10}
        legacyStarCredits={2}
        unlockedLevelsCount={5}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('v2-welcome-title');
    expect(screen.getByRole('heading', { level: 2 }).id).toBe('v2-welcome-title');
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <V2WelcomeModal
        isOpen={false}
        transferredStars={0}
        legacyStarCredits={0}
        unlockedLevelsCount={1}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('handles localStorage errors gracefully on dismiss', () => {
    const handleClose = vi.fn();
    const playClickSpy = vi.spyOn(soundManager, 'playClick');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    render(
      <V2WelcomeModal
        isOpen={true}
        transferredStars={5}
        legacyStarCredits={1}
        unlockedLevelsCount={2}
        onClose={handleClose}
      />
    );

    const ctaButton = screen.getByRole('button', { name: /mulai petualangan 72 level/i });
    fireEvent.click(ctaButton);

    expect(playClickSpy).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
