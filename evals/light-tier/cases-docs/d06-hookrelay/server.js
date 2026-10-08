import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { enqueue } from "./queue.js";

const port = Number(process.env.PORT ?? 3000);
const secret = process.env.HOOK_SECRET;

function validSignature(body, header) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return header && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

http
  .createServer(async (req, res) => {
    const match = req.method === "POST" && req.url.match(/^\/hooks\/([\w-]+)$/);
    if (!match) return res.writeHead(404).end();
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    if (!validSignature(body, req.headers["x-signature"])) return res.writeHead(401).end();
    await enqueue(match[1], body);
    res.writeHead(202).end();
  })
  .listen(port);
