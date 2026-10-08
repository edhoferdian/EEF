import { NextFunction, Request, Response } from "express";
import { resolveStore } from "./stores";

export async function requireStore(req: Request, res: Response, next: NextFunction) {
  const store = await resolveStore(req.hostname);
  if (!store) return res.status(404).json({ error: "unknown store" });
  req.store = store;
  next();
}
