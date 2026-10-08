---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
tags: [id, in-repo, coverage]
---

Payment gateway yang dipanggil di src/payment/client.ts sering timeout, dan error-nya cuma "payment failed". Tambahin retry pakai backoff sama circuit breaker, terus bikin jenis error-nya lebih jelas.
