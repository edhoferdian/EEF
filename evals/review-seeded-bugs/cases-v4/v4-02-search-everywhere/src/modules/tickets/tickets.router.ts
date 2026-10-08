import { Router } from "express";
import { page } from "../../pagination";
import { ticketService } from "./tickets.service";

export const ticketRouter = Router();

ticketRouter.get("/", async (req, res) => {
  res.json(await ticketService.list(req.store.id, page(req.query)));
});

ticketRouter.get("/count", async (req, res) => {
  res.json({ count: await ticketService.count(req.store.id) });
});

ticketRouter.get("/:id", async (req, res) => {
  const row = await ticketService.get(req.store.id, req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

ticketRouter.post("/", async (req, res) => {
  const { subject } = req.body ?? {};
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200) {
    return res.status(400).json({ error: "subject must be 1-200 characters" });
  }
  res.status(201).json(await ticketService.create(req.store.id, { subject: subject.trim() }));
});
