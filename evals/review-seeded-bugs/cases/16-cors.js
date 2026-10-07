const ALLOWED_ROOT = "example.com";

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && origin.endsWith(ALLOWED_ROOT)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return res.status(204).end();
  }
  next();
}

module.exports = { corsMiddleware };
