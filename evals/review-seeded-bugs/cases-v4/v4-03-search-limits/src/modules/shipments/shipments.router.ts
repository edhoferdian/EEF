import { Router } from "express";
import { page } from "../../pagination";
import { shipmentService } from "./shipments.service";

export const shipmentRouter = Router();

shipmentRouter.get("/", async (req, res) => {
  res.json(await shipmentService.list(req.store.id, page(req.query)));
});

shipmentRouter.get("/:id", async (req, res) => {
  const row = await shipmentService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

shipmentRouter.post("/", async (req, res) => {
  const { trackingNo } = req.body ?? {};
  if (typeof trackingNo !== "string" || !trackingNo.trim() || trackingNo.length > 200) {
    return res.status(400).json({ error: "trackingNo must be 1-200 characters" });
  }
  res.status(201).json(await shipmentService.create(req.store.id, { trackingNo: trackingNo.trim() }));
});

shipmentRouter.delete("/:id", async (req, res) => {
  const result = await shipmentService.remove(req.store.id, req.params.id);
  if (result.count === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});
