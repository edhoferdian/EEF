import { Router } from "express";
import { page } from "../../pagination";
import { addressService } from "./addresses.service";

export const addressRouter = Router();

addressRouter.get("/", async (req, res) => {
  res.json(await addressService.list(req.store.id, page(req.query)));
});

addressRouter.get("/:id", async (req, res) => {
  const row = await addressService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

addressRouter.post("/", async (req, res) => {
  const { line1 } = req.body ?? {};
  if (typeof line1 !== "string" || !line1.trim() || line1.trim().length > 120) {
    return res.status(400).json({ error: "line1 must be 1-120 characters" });
  }
  res.status(201).json(await addressService.create(req.store.id, { line1: line1.trim() }));
});
