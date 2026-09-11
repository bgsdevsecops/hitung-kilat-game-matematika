import { AnswerSpec, EvaluationResult } from '../types/answer';

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x;
}

export function evaluateAnswer(spec: AnswerSpec, rawInput: string): EvaluationResult {
  const input = rawInput.trim();

  switch (spec.kind) {
    case 'integer': {
      const expectedDisplay = spec.value.toString();
      if (!/^-?\d+$/.test(input)) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }
      const parsed = Number(input);
      return {
        isCorrect: parsed === spec.value,
        normalizedUserAnswer: input,
        expectedDisplay,
      };
    }

    case 'rational': {
      const expectedDisplay = `${spec.numerator}/${spec.denominator}`;
      const match = input.match(/^(-?\d+)\s*\/\s*(\d+)$/);
      if (!match) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }
      const userNum = Number(match[1]);
      const userDen = Number(match[2]);

      if (userDen === 0) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }

      if (spec.requireSimplified) {
        const divisor = gcd(userNum, userDen);
        if (divisor !== 1) {
          return { isCorrect: false, normalizedUserAnswer: `${userNum}/${userDen}`, expectedDisplay };
        }
      }

      // Exact rational cross-multiplication: a/b === c/d <=> a*d === b*c
      const isEquivalent = userNum * spec.denominator === spec.numerator * userDen;
      return {
        isCorrect: isEquivalent,
        normalizedUserAnswer: `${userNum}/${userDen}`,
        expectedDisplay,
      };
    }

    case 'decimal': {
      const normalized = input.replace(',', '.');
      const expectedDisplay = (spec.scaledValue / Math.pow(10, spec.scale)).toString();
      if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
        return { isCorrect: false, normalizedUserAnswer: input, expectedDisplay };
      }

      const parts = normalized.split('.');
      const integerPart = Number(parts[0]);
      const fractionalPartStr = parts[1] || '';
      const mainFraction = fractionalPartStr.slice(0, spec.scale).padEnd(spec.scale, '0');
      const extraFractionStr = fractionalPartStr.slice(spec.scale);
      const extraFraction = extraFractionStr.length > 0 ? Number(`0.${extraFractionStr}`) : 0;

      const sign = integerPart < 0 || Object.is(integerPart, -0) ? -1 : 1;
      const userScaled = Math.abs(integerPart) * Math.pow(10, spec.scale) + Number(mainFraction) + extraFraction;
      const finalUserScaled = sign * userScaled;

      const tolerance = spec.acceptedTolerance || 0;
      const diff = Math.abs(finalUserScaled - spec.scaledValue);

      return {
        isCorrect: diff <= tolerance,
        normalizedUserAnswer: normalized,
        expectedDisplay,
      };
    }

    case 'choice': {
      const expectedOption = spec.options.find((o) => o.id === spec.optionId);
      const expectedDisplay = expectedOption ? expectedOption.label : spec.optionId;
      return {
        isCorrect: input === spec.optionId,
        normalizedUserAnswer: input,
        expectedDisplay,
      };
    }
  }
}
