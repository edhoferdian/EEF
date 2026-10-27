// After sign-in, send the user back to the page they came from.
import type { Request, Response } from "express";

export function finishLogin(req: Request, res: Response): void {
  const next = typeof req.query.next === "string" ? req.query.next : "/";
  req.session.regenerate(() => {
    req.session.userId = res.locals.userId;
    res.redirect(302, next);
  });
}
