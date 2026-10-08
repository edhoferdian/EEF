# Brightpath Load Balancer — TLS listeners

Applies to: Brightpath LB 4.x (current). Last updated: 2026-07-09

HTTPS listeners accept **TLS 1.2 and TLS 1.3**. TLS 1.0 and TLS 1.1 were
removed in version 4.0 (2025-11) and cannot be re-enabled.

The default security policy `bp-modern-2025` allows TLS 1.3 only; choose
`bp-compat-2025` to also allow TLS 1.2.
