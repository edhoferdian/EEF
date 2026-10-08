import { Router } from "express";
import { page } from "../../pagination";
import { returnRequestService } from "./returns.service";

export const returnRequestRouter = Router();

returnRequestRouter.get("/", async (req, res) => {
  res.json(await returnRequestService.list(req.store.id, page(req.query)));
});

returnRequestRouter.get("/count", async (req, res) => {
  res.json({ count: await returnRequestService.count(req.store.id) });
});

returnRequestRouter.get("/:id", async (req, res) => {
  const row = await returnRequestService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

returnRequestRouter.post("/", async (req, res) => {
  const { reason } = req.body ?? {};
  if (typeof reason !== "string" || !reason.trim() || reason.length > 200) {
    return res.status(400).json({ error: "reason must be 1-200 characters" });
  }
  res.status(201).json(await returnRequestService.create(req.store.id, { reason: reason.trim() }));
});
