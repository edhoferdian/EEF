# Heron Auth — Security FAQ

**How long do sessions last?** By default a session ends 30 minutes after
sign-in. Many customers also turn on an idle timeout; we recommend 15
minutes for admin consoles.

**Can I force sign-out everywhere?** Yes, call `POST /sessions/revoke-all`.
