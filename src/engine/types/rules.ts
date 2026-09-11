export type AdditionRule = {
  kind: 'addition';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  termsCount?: number;
  targetSumMax?: number;
};

export type SubtractionRule = {
  kind: 'subtraction';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  allowNegative?: boolean;
};

export type MultiplicationRule = {
  kind: 'multiplication';
  fixedOperand?: number;
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
};

export type DivisionRule = {
  kind: 'division';
  minDivisor: number;
  maxDivisor: number;
  minQuotient: number;
  maxQuotient: number;
  requireInteger?: boolean;
};

export type MissingOperandRule = {
  kind: 'missing_operand';
  operation: '+' | '-' | '×' | '÷';
  missingPosition: 'first' | 'second' | 'random';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
};

export type GeneratorRule =
  | AdditionRule
  | SubtractionRule
  | MultiplicationRule
  | DivisionRule
  | MissingOperandRule;
