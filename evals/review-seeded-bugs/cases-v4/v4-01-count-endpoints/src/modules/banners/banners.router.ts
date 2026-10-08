import { Router } from "express";
import { page } from "../../pagination";
import { bannerService } from "./banners.service";

export const bannerRouter = Router();

const SORTABLE = ["createdAt", "startsAt"];

bannerRouter.get("/", async (req, res) => {
  const sort = typeof req.query.sort === "string" && SORTABLE.includes(req.query.sort) ? req.query.sort : "createdAt";
  res.json(await bannerService.list(req.store.id, page(req.query), sort));
});

bannerRouter.get("/:id", async (req, res) => {
  const row = await bannerService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

bannerRouter.post("/", async (req, res) => {
  const { headline } = req.body ?? {};
  if (typeof headline !== "string" || !headline.trim() || headline.length > 200) {
    return res.status(400).json({ error: "headline must be 1-200 characters" });
  }
  res.status(201).json(await bannerService.create(req.store.id, { headline: headline.trim() }));
});
