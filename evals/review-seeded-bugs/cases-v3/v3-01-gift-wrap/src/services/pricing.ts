import { config } from "../config";
import { db } from "../db";
import { addCents, Cents, percentOf } from "../money";

export interface Quote {
  subtotal: Cents;
  shipping: Cents;
  tax: Cents;
  total: Cents;
}

export interface QuoteOptions {
  giftWrap?: boolean;
}

export async function quote(items: { productId: string; qty: number }[], options: QuoteOptions = {}): Promise<Quote> {
  const products = await db.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const priceOf = new Map(products.map((p) => [p.id, p.priceCents as Cents]));
  const subtotal = addCents(...items.map((i) => (priceOf.get(i.productId) ?? 0) * i.qty));
  const shipping = subtotal >= config.freeShippingThreshold ? 0 : config.standardShipping;
  const giftWrap = options.giftWrap ? 2.5 : 0;
  const tax = percentOf(subtotal, config.taxPercent);
  return { subtotal, shipping, tax, total: addCents(subtotal, shipping, giftWrap, tax) };
}
