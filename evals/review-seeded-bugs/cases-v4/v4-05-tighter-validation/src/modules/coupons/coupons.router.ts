import { Router } from "express";
import { page } from "../../pagination";
import { couponService } from "./coupons.service";

export const couponRouter = Router();

couponRouter.get("/", async (req, res) => {
  res.json(await couponService.list(req.store.id, page(req.query)));
});

couponRouter.get("/count", async (req, res) => {
  res.json({ count: await couponService.count(req.store.id) });
});

couponRouter.get("/:id", async (req, res) => {
  const row = await couponService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

couponRouter.post("/", async (req, res) => {
  const { code } = req.body ?? {};
  if (typeof code !== "string" || !code.trim() || code.length > 200) {
    return res.status(400).json({ error: "code must be 1-200 characters" });
  }
  res.status(201).json(await couponService.create(req.store.id, { code: code.trim() }));
});
