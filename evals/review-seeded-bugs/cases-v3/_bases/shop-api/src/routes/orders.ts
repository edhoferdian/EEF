import { Router } from "express";
import { config } from "../config";
import { db } from "../db";
import { email } from "../services/email";
import { inventory, OutOfStock } from "../services/inventory";
import { payments, PaymentDeclined } from "../services/payments";
import { quote } from "../services/pricing";

export const ordersRouter = Router();

ordersRouter.post("/", async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > config.maxItemsPerOrder) {
    return res.status(400).json({ error: "1 to 50 items required" });
  }
  if (!items.every((i) => typeof i?.productId === "string" && Number.isInteger(i?.qty) && i.qty > 0)) {
    return res.status(400).json({ error: "each item needs a productId and a positive whole qty" });
  }
  const priced = await quote(items);
  let reservation;
  try {
    reservation = await inventory.reserve(items);
  } catch (err) {
    if (err instanceof OutOfStock) return res.status(409).json({ error: err.message });
    throw err;
  }
  try {
    await payments.charge(req.user.id, priced.total);
  } catch (err) {
    await inventory.release(reservation);
    if (err instanceof PaymentDeclined) return res.status(402).json({ error: "payment declined" });
    throw err;
  }
  const order = await db.order.create({ data: { userId: req.user.id, total: priced.total, items } });
  await email.orderConfirmation(req.user.id, order.id);
  res.status(201).json(order);
});
