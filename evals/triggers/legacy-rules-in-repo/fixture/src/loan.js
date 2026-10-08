const MAX_TENOR = 24;

export function approve(applicant, amount, tenor) {
  if (applicant.age < 21) return { ok: false, reason: 'UNDERAGE' };
  if (tenor > MAX_TENOR) return { ok: false, reason: 'TENOR' };
  const limit = applicant.income * (applicant.hasCollateral ? 10 : 4);
  if (amount > limit) return { ok: false, reason: 'LIMIT' };
  return { ok: true, monthly: Math.ceil((amount * 1.015 ** tenor) / tenor) };
}
