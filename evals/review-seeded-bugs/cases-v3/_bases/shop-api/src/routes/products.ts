import { Router } from "express";
import { db } from "../db";

export const productsRouter = Router();

productsRouter.get("/", async (_req, res) => {
  const products = await db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  res.json(products);
});

productsRouter.get("/:id", async (req, res) => {
  const product = await db.product.findFirst({ where: { id: req.params.id, active: true } });
  if (!product) return res.status(404).json({ error: "not found" });
  res.json(product);
});
