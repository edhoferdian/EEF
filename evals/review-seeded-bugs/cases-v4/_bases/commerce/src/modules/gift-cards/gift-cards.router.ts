import { Router } from "express";
import { page } from "../../pagination";
import { giftCardService } from "./gift-cards.service";

export const giftCardRouter = Router();

giftCardRouter.get("/", async (req, res) => {
  res.json(await giftCardService.list(req.store.id, page(req.query)));
});

giftCardRouter.get("/:id", async (req, res) => {
  const row = await giftCardService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

giftCardRouter.post("/", async (req, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== "string" || !code.trim() || code.length > 200) {
    return res.status(400).json({ error: "code must be 1-200 characters" });
  }
  res.status(201).json(await giftCardService.create(req.store.id, { code: code.trim() }));
});
