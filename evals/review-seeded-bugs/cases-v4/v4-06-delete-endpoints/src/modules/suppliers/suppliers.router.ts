import { Router } from "express";
import { page } from "../../pagination";
import { supplierService } from "./suppliers.service";

export const supplierRouter = Router();

supplierRouter.get("/", async (req, res) => {
  res.json(await supplierService.list(req.store.id, page(req.query)));
});

const STATUSES = ["active", "paused"];

supplierRouter.get("/status/:status", async (req, res) => {
  if (!STATUSES.includes(req.params.status)) return res.status(400).json({ error: "unknown status" });
  res.json(await supplierService.byStatus(req.store.id, req.params.status, page(req.query)));
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
