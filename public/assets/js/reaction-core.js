export const MIN_WAIT_MS = 1600;
export const MAX_WAIT_MS = 4200;
export const TRIAL_COUNT = 5;
export const REFERENCE_MEAN_MS = 250;
export const REFERENCE_STANDARD_DEVIATION_MS = 50;

export function secureRandomInt(maxExclusive, cryptoSource = globalThis.crypto) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('최댓값은 양의 정수여야 합니다.');
  }
  if (!cryptoSource?.getRandomValues) {
    throw new Error('안전한 난수를 사용할 수 없습니다.');
  }

  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const buffer = new Uint32Array(1);
  do {
    cryptoSource.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

export function getWaitDelay(randomInt = secureRandomInt) {
  return MIN_WAIT_MS + randomInt((MAX_WAIT_MS - MIN_WAIT_MS) + 1);
}

export function summarizeResults(values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('유효한 반응속도 기록이 필요합니다.');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);

  return {
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    best: sorted[0],
    median,
  };
}

export function getPerformanceLabel(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError('반응속도는 0 이상의 숫자여야 합니다.');
  }
  if (milliseconds < 180) return '매우 빠름';
  if (milliseconds < 230) return '빠름';
  if (milliseconds < 300) return '보통';
  if (milliseconds < 400) return '조금 느림';
  return '천천히 반응함';
}

function errorFunction(value) {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const t = 1 / (1 + (0.3275911 * absolute));
  let polynomial = 1.061405429;
  polynomial = (polynomial * t) - 1.453152027;
  polynomial = (polynomial * t) + 1.421413741;
  polynomial = (polynomial * t) - 0.284496736;
  polynomial = ((polynomial * t) + 0.254829592) * t;
  return sign * (1 - (polynomial * Math.exp(-(absolute ** 2))));
}

export function normalCdf(
  value,
  mean = REFERENCE_MEAN_MS,
  standardDeviation = REFERENCE_STANDARD_DEVIATION_MS,
) {
  if (![value, mean, standardDeviation].every(Number.isFinite) || standardDeviation <= 0) {
    throw new RangeError('정규분포 계산에는 유효한 값과 0보다 큰 표준편차가 필요합니다.');
  }
  return 0.5 * (1 + errorFunction((value - mean) / (standardDeviation * Math.sqrt(2))));
}

export function getDistributionPosition(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError('반응속도는 0 이상의 숫자여야 합니다.');
  }

  const cumulative = normalCdf(milliseconds);
  const topPercent = Math.min(99, Math.max(1, Math.round(cumulative * 100)));
  const fasterThanPercent = Math.min(99, Math.max(1, Math.round((1 - cumulative) * 100)));

  return {
    zScore: Number(((milliseconds - REFERENCE_MEAN_MS) / REFERENCE_STANDARD_DEVIATION_MS).toFixed(2)),
    topPercent,
    fasterThanPercent,
  };
}
