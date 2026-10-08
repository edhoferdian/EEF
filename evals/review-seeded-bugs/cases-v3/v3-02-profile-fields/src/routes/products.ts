import { Router } from "express";
import { config } from "../config";
import { db } from "../db";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const products = await db.product.findMany({
    where: { active: true, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
    take: config.searchLimit,
  });
  res.json(products);
});

productsRouter.get("/:id", async (req, res) => {
  const product = await db.product.findFirst({ where: { id: req.params.id, active: true } });
  if (!product) return res.status(404).json({ error: "not found" });
  res.json(product);
});
