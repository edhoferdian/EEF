# hookrelay

Receives webhooks and forwards them to an internal queue.

## Running

    npm start

The server listens on port 8080 by default; set `PORT` to change it.
Incoming webhooks are accepted at `POST /hooks/:source` and must carry an
`X-Signature` header (HMAC-SHA256 of the body with `HOOK_SECRET`).
