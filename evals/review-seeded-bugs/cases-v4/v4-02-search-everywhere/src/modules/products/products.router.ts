import { Router } from "express";
import { page } from "../../pagination";
import { productService } from "./products.service";

export const productRouter = Router();

productRouter.get("/", async (req, res) => {
  res.json(await productService.list(req.store.id, page(req.query)));
});

const STATUSES = ["draft", "active", "archived"];

productRouter.get("/status/:status", async (req, res) => {
  if (!STATUSES.includes(req.params.status)) return res.status(400).json({ error: "unknown status" });
  res.json(await productService.byStatus(req.store.id, req.params.status, page(req.query)));
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
