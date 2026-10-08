import { Router } from "express";
import { db } from "../db";

export const usersRouter = Router();

const EDITABLE = ["name", "phone", "marketingOptIn", "role"] as const;

usersRouter.get("/me", async (req, res) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: req.user.id } });
  res.json({ id: user.id, email: user.email, name: user.name, phone: user.phone });
});

usersRouter.patch("/me", async (req, res) => {
  const body = req.body ?? {};
  const data = Object.fromEntries(Object.entries(body).filter(([key]) => (EDITABLE as readonly string[]).includes(key)));
  if ("name" in data && (typeof data.name !== "string" || !data.name.trim())) {
    return res.status(400).json({ error: "name must not be empty" });
  }
  const user = await db.user.update({ where: { id: req.user.id }, data });
  res.json({ id: user.id, email: user.email, name: user.name, phone: user.phone });
});
