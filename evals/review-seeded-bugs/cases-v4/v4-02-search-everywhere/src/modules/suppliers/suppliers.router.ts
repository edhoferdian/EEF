import { Router } from "express";
import { page } from "../../pagination";
import { supplierService } from "./suppliers.service";

export const supplierRouter = Router();

supplierRouter.get("/", async (req, res) => {
  res.json(await supplierService.list(req.store.id, page(req.query)));
});

supplierRouter.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) return res.status(400).json({ error: "q must be at least 2 characters" });
  res.json(await supplierService.search(req.store.id, q, page(req.query)));
});

supplierRouter.get("/:id", async (req, res) => {
  const row = await supplierService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

supplierRouter.post("/", async (req, res) => {
  const { company } = req.body ?? {};
  if (typeof company !== "string" || !company.trim() || company.length > 200) {
    return res.status(400).json({ error: "company must be 1-200 characters" });
  }
  res.status(201).json(await supplierService.create(req.store.id, { company: company.trim() }));
});
