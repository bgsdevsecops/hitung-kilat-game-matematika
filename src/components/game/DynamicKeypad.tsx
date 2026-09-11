import React from 'react';
import { Delete, RefreshCw } from 'lucide-react';

export type KeypadAnswerKind = 'integer' | 'rational' | 'decimal' | 'signed' | 'choice';

export interface DynamicKeypadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  showNegative?: boolean;
  showSlash?: boolean;
  showDecimal?: boolean;
  answerKind?: KeypadAnswerKind;
  ruleKind?: string;
  onClear?: () => void;
  disabled?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  className?: string;
}

/**
 * Sanitizes input string when a keypad key is pressed.
 * Prevents invalid mathematical formats such as double negatives,
 * double slashes, duplicate decimal dots, and leading slashes.
 */
export function sanitizeKeypadInput(
  currentInput: string,
  key: string,
  maxLength?: number
): string {
  let nextInput = currentInput;

  if (key === '-') {
    if (currentInput.startsWith('-')) {
      nextInput = currentInput.slice(1);
    } else {
      nextInput = '-' + currentInput;
    }
  } else if (key === '/') {
    // Prevent leading slash or slash immediately following minus
    if (currentInput === '' || currentInput === '-' || currentInput.includes('/')) {
      return currentInput;
    }
    // Prevent slash in decimal numbers
    if (currentInput.includes('.')) {
      return currentInput;
    }
    nextInput = currentInput + '/';
  } else if (key === '.') {
    // Prevent duplicate dots or dots in fractions
    if (currentInput.includes('.') || currentInput.includes('/')) {
      return currentInput;
    }
    if (currentInput === '') {
      nextInput = '0.';
    } else if (currentInput === '-') {
      nextInput = '-0.';
    } else {
      nextInput = currentInput + '.';
    }
  } else if (key === 'backspace' || key === 'Backspace') {
    return currentInput.slice(0, -1);
  } else if (key === 'clear' || key === 'Clear') {
    return '';
  } else if (/^[0-9]$/.test(key)) {
    if (currentInput === '0') {
      nextInput = key === '0' ? '0' : key;
    } else if (currentInput === '-0') {
      nextInput = key === '0' ? '-0' : '-' + key;
    } else if (currentInput.endsWith('/0')) {
      nextInput = key === '0' ? currentInput : currentInput.slice(0, -1) + key;
    } else {
      nextInput = currentInput + key;
    }
  }

  if (maxLength !== undefined && nextInput.length > maxLength) {
    return currentInput;
  }

  return nextInput;
}

interface ModifierConfig {
  key: string;
  label: string;
  id: string;
  ariaLabel: string;
}

/**
 * Reusable dynamic keypad component with adaptive tactile buttons
 * supporting signed integers, fractions, and decimals.
 */
export const DynamicKeypad: React.FC<DynamicKeypadProps> = ({
  onKeyPress,
  onBackspace,
  onSubmit,
  showNegative,
  showSlash,
  showDecimal,
  answerKind,
  ruleKind,
  onClear,
  disabled = false,
  submitDisabled = false,
  submitLabel = 'ENTER',
  className = '',
}) => {
  const shouldShowNegative = showNegative ?? (answerKind === 'signed' || ruleKind === 'signed');
  const shouldShowSlash = showSlash ?? (answerKind === 'rational');
  const shouldShowDecimal = showDecimal ?? (answerKind === 'decimal');

  const activeModifiers: ModifierConfig[] = [];
  if (shouldShowNegative) {
    activeModifiers.push({ key: '-', label: '±', id: 'keypad--', ariaLabel: 'Plus minus' });
  }
  if (shouldShowSlash) {
    activeModifiers.push({ key: '/', label: '/', id: 'keypad-/', ariaLabel: 'Garis miring pecahan' });
  }
  if (shouldShowDecimal) {
    activeModifiers.push({ key: '.', label: '.', id: 'keypad-.', ariaLabel: 'Titik desimal' });
  }

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onKeyPress('clear');
    }
  };

  const renderDigitButton = (num: number) => (
    <button
      key={num}
      id={`keypad-${num}`}
      type="button"
      onClick={() => onKeyPress(num.toString())}
      disabled={disabled}
      aria-label={`Angka ${num}`}
      className="flex h-14 sm:h-15 items-center justify-center rounded-2xl font-black text-xl sm:text-2xl shadow-lg border-b-4 border-indigo-950 bg-indigo-800 text-white transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2 select-none disabled:opacity-40"
    >
      {num}
    </button>
  );

  const renderModifierButton = (mod: ModifierConfig) => (
    <button
      key={mod.key}
      id={mod.id}
      type="button"
      onClick={() => onKeyPress(mod.key)}
      disabled={disabled}
      aria-label={mod.ariaLabel}
      className="flex h-14 sm:h-15 items-center justify-center rounded-2xl font-black text-xl sm:text-2xl shadow-lg border-b-4 border-indigo-950 bg-indigo-700 text-indigo-100 transition hover:bg-indigo-600 active:translate-y-0.5 active:border-b-2 select-none disabled:opacity-40"
    >
      {mod.label}
    </button>
  );

  const renderBackspaceButton = () => (
    <button
      key="backspace"
      id="keypad-backspace"
      type="button"
      onClick={onBackspace}
      disabled={disabled}
      aria-label="Hapus satu karakter"
      className="flex h-14 sm:h-15 items-center justify-center rounded-2xl font-black text-xl sm:text-2xl shadow-lg border-b-4 border-rose-900 bg-rose-600 text-white transition hover:bg-rose-500 active:translate-y-0.5 active:border-b-2 select-none disabled:opacity-40"
    >
      <Delete className="h-6 w-6" />
    </button>
  );

  const renderClearButton = (colSpanClass = 'col-span-1') => (
    <button
      id="keypad-clear"
      type="button"
      onClick={handleClear}
      disabled={disabled}
      aria-label="Hapus semua input"
      className={`flex h-13 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-700/80 text-xs sm:text-sm font-black text-indigo-100 transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2 disabled:opacity-40 ${colSpanClass}`}
    >
      <RefreshCw className="h-4 w-4 mr-1.5" />
      HAPUS
    </button>
  );

  const renderSubmitButton = (colSpanClass = 'col-span-2') => (
    <button
      id="keypad-enter"
      type="button"
      onClick={onSubmit}
      disabled={disabled || submitDisabled}
      aria-label="Kirim jawaban"
      className={`flex h-13 items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-sm sm:text-base font-black text-white border-b-4 border-pink-800 shadow-xl shadow-pink-500/25 transition active:translate-y-0.5 active:border-b-2 disabled:opacity-40 uppercase tracking-wider ${colSpanClass}`}
    >
      {submitLabel}
    </button>
  );

  const modCount = activeModifiers.length;

  return (
    <div className={`dynamic-keypad-container w-full max-w-sm mx-auto ${className}`}>
      {/* 3x3 Digit Grid (1 to 9) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => renderDigitButton(n))}

        {/* Row 4: Adaptive Bottom Row */}
        {modCount === 0 && (
          <>
            <div className="invisible" aria-hidden="true" />
            {renderDigitButton(0)}
            {renderBackspaceButton()}
          </>
        )}

        {modCount === 1 && (
          <>
            {renderModifierButton(activeModifiers[0])}
            {renderDigitButton(0)}
            {renderBackspaceButton()}
          </>
        )}

        {modCount >= 2 && (
          <>
            {renderModifierButton(activeModifiers[0])}
            {renderDigitButton(0)}
            {renderModifierButton(activeModifiers[1])}
          </>
        )}
      </div>

      {/* Action Row */}
      {modCount <= 1 && (
        <div className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3">
          {renderClearButton('col-span-1')}
          {renderSubmitButton('col-span-2')}
        </div>
      )}

      {modCount === 2 && (
        <div className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3">
          {renderClearButton('col-span-1')}
          {renderBackspaceButton()}
          {renderSubmitButton('col-span-1')}
        </div>
      )}

      {modCount >= 3 && (
        <div className="mt-3 space-y-2.5">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {renderModifierButton(activeModifiers[2])}
            {renderClearButton('col-span-1')}
            {renderBackspaceButton()}
          </div>
          <div className="grid grid-cols-1">
            {renderSubmitButton('w-full')}
          </div>
        </div>
      )}
    </div>
  );
};
