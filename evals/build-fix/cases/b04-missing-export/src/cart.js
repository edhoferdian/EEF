import { formatPrices } from "./price.js";

export function cartSummary(items) {
  const total = items.reduce((sum, item) => sum + item.cents * item.qty, 0);
  return `${items.length} item(s), ${formatPrices(total)}`;
}
