import type { Verdict } from '../types';

const VERDICT_RANK: Record<Verdict, number> = {
  safe: 0,
  caution: 1,
  danger: 2,
};

/**
 * Combines local and AI verdicts conservatively: the stricter verdict always wins.
 */
export function combineVerdicts(localVerdict: Verdict, aiVerdict?: Verdict | null): Verdict {
  if (!aiVerdict) {
    return localVerdict;
  }
  return VERDICT_RANK[aiVerdict] > VERDICT_RANK[localVerdict] ? aiVerdict : localVerdict;
}

export function verdictLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'safe':
      return 'Safe';
    case 'caution':
      return 'Caution';
    case 'danger':
      return 'Danger';
  }
}
