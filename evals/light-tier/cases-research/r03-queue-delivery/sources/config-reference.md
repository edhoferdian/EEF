# Tidewell Queue — Queue configuration reference

Last updated: 2026-08-01

| Setting | Default | Allowed |
|---|---|---|
| `retention_period` | 7 days | 1 hour - 14 days |
| `visibility_timeout` | 30 s | 0 s - 12 h |
| `max_message_size` | 256 KB | fixed |
| `max_receive_count` | 10 | 1 - 1000 (then dead-letter) |
