import rates from "./rates.json";

export function fromUsd(amount, currency) {
  const rate = rates[currency];
  if (rate === undefined) throw new Error(`no rate for ${currency}`);
  return Math.round(amount * rate * 100) / 100;
}
