import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import {
  DynamicKeypad,
  sanitizeKeypadInput,
  DynamicKeypadProps,
} from '../../src/components/game/DynamicKeypad';

// Helper to find a React element by ID in the virtual DOM tree
function findElementById(node: any, id: string): any {
  if (!node) return null;
  if (node.props?.id === id) return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementById(child, id);
      if (found) return found;
    }
  }
  if (node.props?.children) {
    return findElementById(node.props.children, id);
  }
  return null;
}

// Helper to find all elements matching a predicate
function findAllElements(node: any, predicate: (n: any) => boolean): any[] {
  const results: any[] = [];
  function traverse(curr: any) {
    if (!curr) return;
    if (predicate(curr)) results.push(curr);
    if (Array.isArray(curr)) {
      curr.forEach(traverse);
    } else if (curr.props?.children) {
      traverse(curr.props.children);
    }
  }
  traverse(node);
  return results;
}

describe('DynamicKeypad input sanitization', () => {
  it('prevents multiple leading minus signs', () => {
    expect(sanitizeKeypadInput('', '-')).toBe('-');
    expect(sanitizeKeypadInput('-', '-')).toBe(''); // toggles minus
    expect(sanitizeKeypadInput('12', '-')).toBe('-12'); // toggles sign
    expect(sanitizeKeypadInput('-12', '-')).toBe('12');
  });

  it('prevents duplicate slash or leading slash in fractions', () => {
    expect(sanitizeKeypadInput('', '/')).toBe(''); // no leading slash
    expect(sanitizeKeypadInput('3', '/')).toBe('3/');
    expect(sanitizeKeypadInput('3/', '/')).toBe('3/'); // ignore duplicate
    expect(sanitizeKeypadInput('3/4', '/')).toBe('3/4'); // ignore extra slash
  });

  it('prevents duplicate decimal dots', () => {
    expect(sanitizeKeypadInput('', '.')).toBe('0.');
    expect(sanitizeKeypadInput('2', '.')).toBe('2.');
    expect(sanitizeKeypadInput('2.', '.')).toBe('2.');
    expect(sanitizeKeypadInput('2.5', '.')).toBe('2.5');
  });

  it('handles negative decimals and fraction edge cases', () => {
    expect(sanitizeKeypadInput('-', '.')).toBe('-0.');
    expect(sanitizeKeypadInput('-2', '.')).toBe('-2.');
    expect(sanitizeKeypadInput('-2.', '.')).toBe('-2.');
    expect(sanitizeKeypadInput('-', '/')).toBe('-'); // cannot put slash right after minus
    expect(sanitizeKeypadInput('3.5', '/')).toBe('3.5'); // cannot put slash in decimal
    expect(sanitizeKeypadInput('3/4', '.')).toBe('3/4'); // cannot put dot in fraction
  });

  it('handles standard digit entry', () => {
    expect(sanitizeKeypadInput('', '5')).toBe('5');
    expect(sanitizeKeypadInput('5', '7')).toBe('57');
    expect(sanitizeKeypadInput('0', '5')).toBe('5'); // replaces standalone 0
    expect(sanitizeKeypadInput('0', '0')).toBe('0'); // prevents 00
    expect(sanitizeKeypadInput('-0', '3')).toBe('-3');
    expect(sanitizeKeypadInput('-', '8')).toBe('-8');
    expect(sanitizeKeypadInput('1/0', '2')).toBe('1/2'); // replaces leading 0 in denominator
  });

  it('handles backspace and clear actions', () => {
    expect(sanitizeKeypadInput('123', 'backspace')).toBe('12');
    expect(sanitizeKeypadInput('1', 'backspace')).toBe('');
    expect(sanitizeKeypadInput('', 'backspace')).toBe('');
    expect(sanitizeKeypadInput('123', 'clear')).toBe('');
  });

  it('respects optional maxLength constraint', () => {
    expect(sanitizeKeypadInput('12345', '6', 5)).toBe('12345');
    expect(sanitizeKeypadInput('1234', '5', 5)).toBe('12345');
  });
});

describe('DynamicKeypad component', () => {
  const defaultProps: DynamicKeypadProps = {
    onKeyPress: vi.fn(),
    onBackspace: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('renders standard digit keys 0-9, backspace, and submit button', () => {
    const vdom = DynamicKeypad(defaultProps);

    for (let i = 0; i <= 9; i++) {
      const btn = findElementById(vdom, `keypad-${i}`);
      expect(btn).toBeDefined();
      expect(btn).not.toBeNull();
    }

    const backspaceBtn = findElementById(vdom, 'keypad-backspace');
    expect(backspaceBtn).toBeDefined();
    expect(backspaceBtn).not.toBeNull();

    const submitBtn = findElementById(vdom, 'keypad-enter');
    expect(submitBtn).toBeDefined();
    expect(submitBtn).not.toBeNull();
  });

  it('does not render adaptive keys when flags are false or pure integer', () => {
    const vdom = DynamicKeypad({
      ...defaultProps,
      showNegative: false,
      showSlash: false,
      showDecimal: false,
    });

    expect(findElementById(vdom, 'keypad--')).toBeNull();
    expect(findElementById(vdom, 'keypad-/')).toBeNull();
    expect(findElementById(vdom, 'keypad-.')).toBeNull();
  });

  it('renders negative button when showNegative is true or answerKind is signed', () => {
    const vdomNegative = DynamicKeypad({
      ...defaultProps,
      showNegative: true,
    });
    const minusBtn = findElementById(vdomNegative, 'keypad--');
    expect(minusBtn).toBeDefined();
    expect(minusBtn).not.toBeNull();

    const vdomSigned = DynamicKeypad({
      ...defaultProps,
      answerKind: 'signed',
    });
    expect(findElementById(vdomSigned, 'keypad--')).not.toBeNull();
  });

  it('renders slash button when showSlash is true or answerKind is rational', () => {
    const vdomSlash = DynamicKeypad({
      ...defaultProps,
      showSlash: true,
    });
    const slashBtn = findElementById(vdomSlash, 'keypad-/');
    expect(slashBtn).toBeDefined();
    expect(slashBtn).not.toBeNull();

    const vdomRational = DynamicKeypad({
      ...defaultProps,
      answerKind: 'rational',
    });
    expect(findElementById(vdomRational, 'keypad-/')).not.toBeNull();
  });

  it('renders decimal button when showDecimal is true or answerKind is decimal', () => {
    const vdomDecimal = DynamicKeypad({
      ...defaultProps,
      showDecimal: true,
    });
    const dotBtn = findElementById(vdomDecimal, 'keypad-.');
    expect(dotBtn).toBeDefined();
    expect(dotBtn).not.toBeNull();

    const vdomDecKind = DynamicKeypad({
      ...defaultProps,
      answerKind: 'decimal',
    });
    expect(findElementById(vdomDecKind, 'keypad-.')).not.toBeNull();
  });

  it('handles click events properly for digits, backspace, and submit', () => {
    const onKeyPress = vi.fn();
    const onBackspace = vi.fn();
    const onSubmit = vi.fn();

    const vdom = DynamicKeypad({
      onKeyPress,
      onBackspace,
      onSubmit,
      showNegative: true,
      showSlash: true,
    });

    // Test digit click
    const btn7 = findElementById(vdom, 'keypad-7');
    btn7.props.onClick();
    expect(onKeyPress).toHaveBeenCalledWith('7');

    // Test negative key click
    const btnMinus = findElementById(vdom, 'keypad--');
    btnMinus.props.onClick();
    expect(onKeyPress).toHaveBeenCalledWith('-');

    // Test slash key click
    const btnSlash = findElementById(vdom, 'keypad-/');
    btnSlash.props.onClick();
    expect(onKeyPress).toHaveBeenCalledWith('/');

    // Test backspace click
    const btnBack = findElementById(vdom, 'keypad-backspace');
    btnBack.props.onClick();
    expect(onBackspace).toHaveBeenCalledTimes(1);

    // Test submit click
    const btnSubmit = findElementById(vdom, 'keypad-enter');
    btnSubmit.props.onClick();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('supports clear action if onClear or default is used', () => {
    const onClear = vi.fn();
    const onKeyPress = vi.fn();

    const vdomWithClear = DynamicKeypad({
      ...defaultProps,
      onClear,
      onKeyPress,
    });

    const clearBtn = findElementById(vdomWithClear, 'keypad-clear');
    expect(clearBtn).not.toBeNull();
    clearBtn.props.onClick();
    expect(onClear).toHaveBeenCalledTimes(1);

    // Without onClear, falls back to onKeyPress('clear')
    const vdomWithoutClear = DynamicKeypad({
      ...defaultProps,
      onKeyPress,
    });
    const clearBtn2 = findElementById(vdomWithoutClear, 'keypad-clear');
    clearBtn2.props.onClick();
    expect(onKeyPress).toHaveBeenCalledWith('clear');
  });

  it('propagates disabled state to buttons', () => {
    const vdom = DynamicKeypad({
      ...defaultProps,
      disabled: true,
      submitDisabled: true,
      showNegative: true,
    });

    const btn5 = findElementById(vdom, 'keypad-5');
    expect(btn5.props.disabled).toBe(true);

    const btnMinus = findElementById(vdom, 'keypad--');
    expect(btnMinus.props.disabled).toBe(true);

    const btnSubmit = findElementById(vdom, 'keypad-enter');
    expect(btnSubmit.props.disabled).toBe(true);
  });

  it('renders all three modifier buttons when requested simultaneously', () => {
    const vdom = DynamicKeypad({
      ...defaultProps,
      showNegative: true,
      showSlash: true,
      showDecimal: true,
      submitLabel: 'JAWAB',
    });

    expect(findElementById(vdom, 'keypad--')).not.toBeNull();
    expect(findElementById(vdom, 'keypad-/')).not.toBeNull();
    expect(findElementById(vdom, 'keypad-.')).not.toBeNull();
    expect(findElementById(vdom, 'keypad-backspace')).not.toBeNull();
    expect(findElementById(vdom, 'keypad-clear')).not.toBeNull();

    const submitBtn = findElementById(vdom, 'keypad-enter');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn.props.children).toBe('JAWAB');
  });
});
