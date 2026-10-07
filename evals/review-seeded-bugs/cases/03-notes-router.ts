import { Router, Request, Response } from "express";
import { db } from "./db";
import { requireAuth } from "./auth";

export const notesRouter = Router();

notesRouter.get("/notes/:id", requireAuth, async (req: Request, res: Response) => {
  const note = await db.note.findUnique({ where: { id: req.params.id } });
  if (!note || note.ownerId !== req.user.id) {
    return res.status(404).json({ error: "not found" });
  }
  res.json(note);
});

notesRouter.put("/notes/:id", requireAuth, async (req: Request, res: Response) => {
  const { title, body } = req.body ?? {};
  if (typeof title !== "string" || typeof body !== "string") {
    return res.status(400).json({ error: "title and body are required" });
  }
  const note = await db.note.findUnique({ where: { id: req.params.id } });
  if (!note) {
    return res.status(404).json({ error: "not found" });
  }
  const updated = await db.note.update({
    where: { id: note.id },
    data: { title, body, updatedAt: new Date() },
  });
  res.json(updated);
});
