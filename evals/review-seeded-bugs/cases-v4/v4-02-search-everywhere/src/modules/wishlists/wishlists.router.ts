import { Router } from "express";
import { page } from "../../pagination";
import { wishlistService } from "./wishlists.service";

export const wishlistRouter = Router();

wishlistRouter.get("/", async (req, res) => {
  res.json(await wishlistService.list(req.store.id, page(req.query)));
});

wishlistRouter.get("/:id", async (req, res) => {
  const row = await wishlistService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

wishlistRouter.post("/", async (req, res) => {
  const { label } = req.body ?? {};
  if (typeof label !== "string" || !label.trim() || label.trim().length > 120) {
    return res.status(400).json({ error: "label must be 1-120 characters" });
  }
  res.status(201).json(await wishlistService.create(req.store.id, { label: label.trim() }));
});
