import { Router } from "express";
import { toCsv } from "../csv";
import { db } from "../db";

export const exportRouter = Router();

exportRouter.get("/my-orders.csv", async (req, res) => {
  const orders = await db.order.findMany({ where: { userId: req.user.id } });
  res.type("text/csv").send(toCsv(orders));
});

exportRouter.get("/all-users.csv", async (_req, res) => {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
  });
  res.type("text/csv").send(toCsv(users));
});
