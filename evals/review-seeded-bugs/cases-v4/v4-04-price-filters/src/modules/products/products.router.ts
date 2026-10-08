import { Router } from "express";
import { page } from "../../pagination";
import { productService } from "./products.service";

export const productRouter = Router();

productRouter.get("/", async (req, res) => {
  if (req.query.min !== undefined) {
    const minCents = Math.round(Number(req.query.min) * 100);
    if (!Number.isInteger(minCents) || minCents < 0) return res.status(400).json({ error: "bad minimum" });
    return res.json(await productService.atLeast(req.store.id, minCents, page(req.query)));
  }
  res.json(await productService.list(req.store.id, page(req.query)));
});

productRouter.get("/:id", async (req, res) => {
  const row = await productService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

productRouter.post("/", async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || name.length > 200) {
    return res.status(400).json({ error: "name must be 1-200 characters" });
  }
  res.status(201).json(await productService.create(req.store.id, { name: name.trim() }));
});
