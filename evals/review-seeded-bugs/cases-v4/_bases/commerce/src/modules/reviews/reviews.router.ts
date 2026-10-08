import { Router } from "express";
import { page } from "../../pagination";
import { reviewService } from "./reviews.service";

export const reviewRouter = Router();

reviewRouter.get("/", async (req, res) => {
  res.json(await reviewService.list(req.store.id, page(req.query)));
});

reviewRouter.get("/:id", async (req, res) => {
  const row = await reviewService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

reviewRouter.post("/", async (req, res) => {
  const { body } = req.body ?? {};
  if (typeof body !== "string" || !body.trim() || body.length > 200) {
    return res.status(400).json({ error: "body must be 1-200 characters" });
  }
  res.status(201).json(await reviewService.create(req.store.id, { body: body.trim() }));
});
