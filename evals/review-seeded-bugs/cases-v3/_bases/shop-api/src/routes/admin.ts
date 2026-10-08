import { Router } from "express";
import { db } from "../db";

export const adminRouter = Router();

const ROLES = ["customer", "staff", "admin"] as const;

adminRouter.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body ?? {};
  if (!ROLES.includes(role)) return res.status(400).json({ error: "unknown role" });
  const user = await db.user.update({ where: { id: req.params.id }, data: { role } });
  res.json({ id: user.id, role: user.role });
});
