# fernvale-js SDK

Version 5.2.0 — 2026-04-11

`client.upload(file)` checks the size before sending. The client-side default
cap is 25 MB (`maxSinglePartBytes`), which you can raise up to the server's
limit; above it, `upload()` switches to a multipart session automatically.
