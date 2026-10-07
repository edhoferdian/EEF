import { config } from "./config";
import { HttpClient } from "./http-client";

const client = new HttpClient({
  baseUrl: config.shipping.baseUrl,
  timeoutMs: config.shipping.timeout,
});

export async function quote(weightKg: number, postcode: string): Promise<number> {
  if (weightKg <= 0) throw new RangeError("weightKg must be positive");
  const res = await client.post<{ price: number }>("/quotes", { weightKg, postcode });
  return res.price;
}
