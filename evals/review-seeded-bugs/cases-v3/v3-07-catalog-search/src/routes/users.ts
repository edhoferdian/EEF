import { Router } from "express";
import { db } from "../db";

export const usersRouter = Router();

usersRouter.get("/me", async (req, res) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: req.user.id } });
  res.json({ id: user.id, email: user.email, name: user.name, memberSince: user.createdAt });
});

usersRouter.patch("/me", async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required" });
  const user = await db.user.update({ where: { id: req.user.id }, data: { name: name.trim() } });
  res.json({ id: user.id, email: user.email, name: user.name });
});
