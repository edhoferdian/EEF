const express = require("express");
const { requireUser } = require("./auth");
const db = require("./db");

const app = express();
app.use(express.json());

app.get("/invoices/:id", requireUser, async (req, res) => {
  const invoice = await db.one("SELECT * FROM invoices WHERE id = $1", [req.params.id]);
  res.json(invoice);
});

app.post("/invoices/:id/pay", requireUser, async (req, res) => {
  await db.none("UPDATE invoices SET status = 'paid' WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000);
