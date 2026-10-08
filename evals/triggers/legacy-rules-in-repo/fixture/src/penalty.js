export function latePenalty(installment, daysLate) {
  if (daysLate <= 3) return 0;
  return Math.min(installment * 0.001 * daysLate, installment * 0.1);
}
