import { NextFunction, Request, Response } from "express";
import { verifySession } from "./session";

const RANK = { customer: 0, staff: 1, admin: 2 } as const;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await verifySession(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "sign in required" });
  req.user = user;
  next();
}

export function requireRole(role: "staff" | "admin") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || RANK[req.user.role] < RANK[role]) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
