import { Router } from "express";
import { page } from "../../pagination";
import { supplierService } from "./suppliers.service";

export const supplierRouter = Router();

supplierRouter.get("/", async (req, res) => {
  res.json(await supplierService.list(req.store.id, page(req.query)));
});

supplierRouter.get("/:id", async (req, res) => {
  const row = await supplierService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

supplierRouter.post("/", async (req, res) => {
  const { company } = req.body ?? {};
  if (typeof company !== "string" || !company.trim() || company.trim().length > 120) {
    return res.status(400).json({ error: "company must be 1-120 characters" });
  }
  res.status(201).json(await supplierService.create(req.store.id, { company: company.trim() }));
});
