export type IntegerAnswer = {
  kind: 'integer';
  value: number;
};

export type RationalAnswer = {
  kind: 'rational';
  numerator: number;
  denominator: number;
  requireSimplified?: boolean;
};

export type DecimalAnswer = {
  kind: 'decimal';
  scaledValue: number;
  scale: number;
  acceptedTolerance?: number;
};

export type ChoiceAnswer = {
  kind: 'choice';
  optionId: string;
  options: Array<{ id: string; label: string }>;
};

export type AnswerSpec = IntegerAnswer | RationalAnswer | DecimalAnswer | ChoiceAnswer;

export interface EvaluationResult {
  isCorrect: boolean;
  normalizedUserAnswer: string;
  expectedDisplay: string;
}
