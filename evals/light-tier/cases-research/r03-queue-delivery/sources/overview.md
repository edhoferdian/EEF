# Tidewell Queue — Overview

Last updated: 2026-08-01

Tidewell Queue is a managed message queue. Delivery is **at-least-once**: a
message is redelivered if the consumer does not acknowledge it within the
visibility timeout, so consumers must be idempotent. Tidewell does not offer
exactly-once delivery; deduplicate on the `message_id` header if you need it.

Messages are stored in three availability zones before the publish call
returns.
