import { Router } from "express";
import { page } from "../../pagination";
import { categoryService } from "./categories.service";

export const categoryRouter = Router();

categoryRouter.get("/", async (req, res) => {
  res.json(await categoryService.list(req.store.id, page(req.query)));
});

categoryRouter.get("/:id", async (req, res) => {
  const row = await categoryService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

categoryRouter.post("/", async (req, res) => {
  const { title } = req.body ?? {};
  if (typeof title !== "string" || !title.trim() || title.trim().length > 120) {
    return res.status(400).json({ error: "title must be 1-120 characters" });
  }
  res.status(201).json(await categoryService.create(req.store.id, { title: title.trim() }));
});
