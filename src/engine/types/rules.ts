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

export type ChainRule = {
  kind: 'chain';
  operators: Array<'+' | '-'>;
  termsCount: 3 | 4;
  minOperand: number;
  maxOperand: number;
  allowIntermediateNegative?: boolean;
};

export type BodmasTemplate =
  | 'a_plus_b_times_c'
  | 'a_times_b_plus_c'
  | 'a_times_b_minus_c'
  | 'a_minus_b_div_c'
  | 'a_div_b_plus_c'
  | 'paren_add_div_c'
  | 'paren_sub_mul_c'
  | 'paren_nested_bodmas';

export type BodmasRule = {
  kind: 'bodmas';
  template: BodmasTemplate;
  minOperand: number;
  maxOperand: number;
  requireCleanDivision?: boolean;
};

export type SignedRule = {
  kind: 'signed';
  operation: '+' | '-' | '×' | '÷';
  minOperand: number;
  maxOperand: number;
  allowZeroOperand?: boolean;
};

export type AlgebraTemplate =
  | 'one_step_add'
  | 'one_step_sub'
  | 'two_step_linear'
  | 'nested_linear';

export type AlgebraRule = {
  kind: 'algebra';
  template: AlgebraTemplate;
  variableName?: 'x' | 'y' | 'n';
  minSolution: number;
  maxSolution: number;
  minCoefficient: number;
  maxCoefficient: number;
};

export type PowerRootRule = {
  kind: 'power_root';
  mode: 'square' | 'square_root';
  minBase: number;
  maxBase: number;
};

export type FractionPercentageRule = {
  kind: 'fraction_percentage';
  variant: 'fraction_add' | 'ratio_equality' | 'mental_percentage';
  minBase?: number;
  maxBase?: number;
};

export type MixedBlitzRule = {
  kind: 'mixed_blitz';
  subRules: GeneratorRule[];
};

export type GeneratorRule =
  | AdditionRule
  | SubtractionRule
  | MultiplicationRule
  | DivisionRule
  | MissingOperandRule
  | ChainRule
  | BodmasRule
  | SignedRule
  | AlgebraRule
  | PowerRootRule
  | FractionPercentageRule
  | MixedBlitzRule;
