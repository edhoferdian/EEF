export type Cents = number;

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) throw new TypeError(`cents must be an integer, got ${value}`);
  return value;
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((sum, v) => sum + v, 0);
}

export function percentOf(amount: Cents, percent: number): Cents {
  return Math.round((amount * percent) / 100);
}

export function formatCents(amount: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}
