import { Router } from "express";
import { page } from "../../pagination";
import { warehouseService } from "./warehouses.service";

export const warehouseRouter = Router();

warehouseRouter.get("/", async (req, res) => {
  res.json(await warehouseService.list(req.store.id, page(req.query)));
});

warehouseRouter.get("/count", async (req, res) => {
  res.json({ count: await warehouseService.count(req.store.id) });
});

warehouseRouter.get("/:id", async (req, res) => {
  const row = await warehouseService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

warehouseRouter.post("/", async (req, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== "string" || !code.trim() || code.length > 200) {
    return res.status(400).json({ error: "code must be 1-200 characters" });
  }
  res.status(201).json(await warehouseService.create(req.store.id, { code: code.trim() }));
});
