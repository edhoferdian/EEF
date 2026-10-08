# Fernvale Storage API reference — POST /v3/uploads

Last updated: 2026-05-20

Uploads a single file in one request.

- Maximum request body: **50 MB**. Larger bodies are rejected with
  `413 Payload Too Large`.
- For files above 50 MB use the multipart session API (`/v3/upload-sessions`),
  which accepts parts of 5-50 MB and files up to 5 GB.
- Supported content types: any; `Content-Type` is stored as given.
