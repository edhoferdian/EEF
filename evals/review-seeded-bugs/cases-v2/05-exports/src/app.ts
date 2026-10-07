import express from "express";
import { requireAdmin, requireAuth } from "./auth";
import { adminRouter } from "./routes/admin";
import { exportRouter } from "./routes/export";
import { publicRouter } from "./routes/public";

export const app = express();

app.use(express.json());
app.use("/", publicRouter);
app.use("/admin", requireAuth, requireAdmin, adminRouter);
// Exports are open to every signed-in user, for their own data.
app.use("/export", requireAuth, exportRouter);
