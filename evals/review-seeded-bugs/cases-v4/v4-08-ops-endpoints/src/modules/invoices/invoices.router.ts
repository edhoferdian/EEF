import { Router } from "express";
import { page } from "../../pagination";
import { invoiceService } from "./invoices.service";

export const invoiceRouter = Router();

invoiceRouter.get("/", async (req, res) => {
  res.json(await invoiceService.list(req.store.id, page(req.query)));
});

const STATUSES = ["open", "paid", "void"];

invoiceRouter.get("/status/:status", async (req, res) => {
  if (!STATUSES.includes(req.params.status)) return res.status(400).json({ error: "unknown status" });
  res.json(await invoiceService.byStatus(req.store.id, req.params.status, page(req.query)));
});

invoiceRouter.get("/:id", async (req, res) => {
  const row = await invoiceService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

invoiceRouter.post("/", async (req, res) => {
  const { number } = req.body ?? {};
  if (typeof number !== "string" || !number.trim() || number.length > 200) {
    return res.status(400).json({ error: "number must be 1-200 characters" });
  }
  res.status(201).json(await invoiceService.create(req.store.id, { number: number.trim() }));
});
