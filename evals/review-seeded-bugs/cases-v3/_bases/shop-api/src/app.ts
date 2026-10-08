import express from "express";
import { requireAuth, requireRole } from "./auth";
import { adminRouter } from "./routes/admin";
import { ordersRouter } from "./routes/orders";
import { productsRouter } from "./routes/products";
import { usersRouter } from "./routes/users";

export const app = express();
app.use(express.json());
app.use("/products", productsRouter);
app.use("/orders", requireAuth, ordersRouter);
app.use("/users", requireAuth, usersRouter);
app.use("/admin", requireAuth, requireRole("admin"), adminRouter);
